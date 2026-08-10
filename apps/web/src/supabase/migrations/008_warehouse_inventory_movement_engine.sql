-- ============================================================================
-- 008 — Inventory Assignment through the Movement Engine (TAD §5.4)
--
-- TAD §5.4 Single Movement Engine Rule: *inventory is owned only by the
-- Movement Engine*. Every mutation of warehouse_bin_items MUST flow through a
-- SECURITY DEFINER RPC that writes a matching warehouse_movements audit row.
--
-- Previously, Phase 3 assignment (upsertBinItem / adjustBinItemQty /
-- deleteBinItem) wrote warehouse_bin_items directly — no audit trail. This
-- migration replaces those writes with three RPCs:
--
--   * assign_warehouse_bin_item      — upsert: set absolute quantity + flags
--   * adjust_warehouse_bin_item_qty  — apply a signed delta to one row
--   * remove_warehouse_bin_item      — soft-delete a row (full stock removal)
--
-- Audit-row sign encoding (stays compatible with TAD §5.12 reversal):
--   * delta > 0 (stock added to a bin)  → destination_bin_id = bin, qty = +d
--   * delta < 0 (stock leaves a bin)    → source_bin_id = bin, qty = d (neg)
-- A bin that gains stock on the reversal model gains it back on reverse, and
-- a bin that lost stock regains it — exactly like receive/transfer/dispatch.
--
-- Capacity (TAD §5.10) is enforced on increases only; removals can never
-- violate a cap. Empty rows are soft-deleted — never hard-deleted.
--
-- RLS: org-scoped, same convention as 003–007.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Fix: warehouse_bin_items was missing updated_by (the old client wrote it
--    directly — a latent runtime bug). Add it here.
-- ---------------------------------------------------------------------------
ALTER TABLE warehouse_bin_items
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_wh_bin_items_updated_by
  ON warehouse_bin_items (updated_by) WHERE updated_by IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. assign_warehouse_bin_item — upsert (absolute quantity + flags) + audit.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION assign_warehouse_bin_item(
  p_organisation_id UUID,
  p_bin_id UUID,
  p_item_id UUID,
  p_quantity NUMERIC,
  p_is_primary BOOLEAN DEFAULT false,
  p_is_reserve BOOLEAN DEFAULT false,
  p_batch_no TEXT DEFAULT NULL,
  p_lot_no TEXT DEFAULT NULL,
  p_operator_id UUID DEFAULT NULL,
  p_device TEXT DEFAULT NULL,
  p_remarks TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max NUMERIC;
  v_old NUMERIC;
  v_delta NUMERIC;
  v_row_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_organisations
     WHERE organisation_id = p_organisation_id AND user_id = auth.uid() AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not a member of this organisation');
  END IF;
  IF p_quantity < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Quantity cannot be negative');
  END IF;

  -- Bin must belong to the caller's org. (max_quantity may be NULL — uncapped
  -- — so existence is checked separately.)
  SELECT max_quantity INTO v_max
    FROM warehouse_bins
   WHERE id = p_bin_id AND organisation_id = p_organisation_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Bin not found in this organisation');
  END IF;

  -- Old live quantity for this (bin, item) — single source of truth.
  SELECT COALESCE(SUM(quantity), 0) INTO v_old
    FROM warehouse_bin_items
   WHERE bin_id = p_bin_id AND item_id IS NOT DISTINCT FROM p_item_id AND deleted_at IS NULL;

  v_delta := p_quantity - v_old;

  -- Capacity on increases only (TAD §5.10).
  IF v_delta > 0 AND COALESCE(v_max, 0) > 0 AND v_old + v_delta > v_max THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'Bin capacity exceeded: ' || v_old || ' + ' || v_delta || ' > ' || v_max);
  END IF;

  -- Upsert (revives soft-deleted rows, like receive_warehouse_stock).
  INSERT INTO warehouse_bin_items
    (organisation_id, bin_id, item_id, quantity, is_primary, is_reserve,
     batch_no, lot_no, created_by, created_at, updated_by, updated_at)
  VALUES
    (p_organisation_id, p_bin_id, p_item_id, p_quantity, p_is_primary, p_is_reserve,
     p_batch_no, p_lot_no, p_operator_id, now(), p_operator_id, now())
  ON CONFLICT (bin_id, item_id)
  DO UPDATE SET quantity = EXCLUDED.quantity,
                is_primary = EXCLUDED.is_primary,
                is_reserve = EXCLUDED.is_reserve,
                batch_no = EXCLUDED.batch_no,
                lot_no = EXCLUDED.lot_no,
                deleted_at = NULL,
                updated_by = p_operator_id,
                updated_at = now()
  RETURNING id INTO v_row_id;

  -- Audit row only when stock actually changed (flag-only updates are not a
  -- movement). Sign-encoded for TAD §5.12 reversal compatibility.
  IF v_delta <> 0 THEN
    INSERT INTO warehouse_movements
      (organisation_id, movement_type, reference_type, reference_id, item_id,
       source_bin_id, destination_bin_id, quantity, operator_id, device, remarks)
    VALUES
      (p_organisation_id, 'adjust', 'adjustment', v_row_id::TEXT, p_item_id,
       CASE WHEN v_delta < 0 THEN p_bin_id ELSE NULL END,
       CASE WHEN v_delta > 0 THEN p_bin_id ELSE NULL END,
       v_delta, p_operator_id, p_device,
       COALESCE(p_remarks, 'Inventory assignment (Movement Engine)'));
  END IF;

  RETURN jsonb_build_object('ok', true, 'bin_item_id', v_row_id, 'delta', v_delta);
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. adjust_warehouse_bin_item_qty — signed delta on one row + audit.
--    When the result is ≤ 0 the row is soft-deleted (stock moved out fully)
--    and the audit records the FULL removal (what actually left the bin).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION adjust_warehouse_bin_item_qty(
  p_row_id UUID,
  p_delta NUMERIC,
  p_operator_id UUID DEFAULT NULL,
  p_device TEXT DEFAULT NULL,
  p_remarks TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID;
  v_bin UUID;
  v_item UUID;
  v_qty NUMERIC;
  v_max NUMERIC;
  v_next NUMERIC;
  v_applied NUMERIC;
BEGIN
  SELECT organisation_id, bin_id, item_id, quantity
    INTO v_org, v_bin, v_item, v_qty
    FROM warehouse_bin_items
   WHERE id = p_row_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Bin item row not found');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM user_organisations
     WHERE organisation_id = v_org AND user_id = auth.uid() AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not a member of this organisation');
  END IF;

  -- Defense-in-depth: the row is org-scoped, but the bin it references must
  -- also belong to the org (same hardening as the 006 transfer RPC).
  IF NOT EXISTS (
    SELECT 1 FROM warehouse_bins
     WHERE id = v_bin AND organisation_id = v_org AND deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Bin not found in this organisation');
  END IF;

  IF p_delta = 0 THEN
    RETURN jsonb_build_object('ok', true, 'bin_item_id', p_row_id, 'applied_delta', 0);
  END IF;

  -- Capacity on increases only.
  IF p_delta > 0 THEN
    SELECT max_quantity INTO v_max
      FROM warehouse_bins WHERE id = v_bin AND deleted_at IS NULL;
    IF COALESCE(v_max, 0) > 0 AND v_qty + p_delta > v_max THEN
      RETURN jsonb_build_object('ok', false, 'error',
        'Bin capacity exceeded: ' || v_qty || ' + ' || p_delta || ' > ' || v_max);
    END IF;
  END IF;

  v_next := v_qty + p_delta;

  IF v_next <= 0 THEN
    -- Full removal: audit the quantity that actually leaves the bin.
    v_applied := -v_qty;
    UPDATE warehouse_bin_items
       SET deleted_at = now(), quantity = 0, updated_by = p_operator_id, updated_at = now()
     WHERE id = p_row_id;
  ELSE
    v_applied := p_delta;
    UPDATE warehouse_bin_items
       SET quantity = v_next, updated_by = p_operator_id, updated_at = now()
     WHERE id = p_row_id;
  END IF;

  -- Audit only when stock actually moved (adjusting an already-empty row to
  -- ≤ 0 soft-deletes it but must not create a zero-quantity audit row).
  IF v_applied <> 0 THEN
    INSERT INTO warehouse_movements
      (organisation_id, movement_type, reference_type, reference_id, item_id,
       source_bin_id, destination_bin_id, quantity, operator_id, device, remarks)
    VALUES
      (v_org, 'adjust', 'adjustment', p_row_id::TEXT, v_item,
       CASE WHEN v_applied < 0 THEN v_bin ELSE NULL END,
       CASE WHEN v_applied > 0 THEN v_bin ELSE NULL END,
       v_applied, p_operator_id, p_device,
       COALESCE(p_remarks, 'Quantity adjustment (Movement Engine)'));
  END IF;

  RETURN jsonb_build_object('ok', true, 'bin_item_id', p_row_id, 'applied_delta', v_applied);
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. remove_warehouse_bin_item — soft-delete a row; audit the full removal.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION remove_warehouse_bin_item(
  p_row_id UUID,
  p_operator_id UUID DEFAULT NULL,
  p_device TEXT DEFAULT NULL,
  p_remarks TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID;
  v_bin UUID;
  v_item UUID;
  v_qty NUMERIC;
BEGIN
  SELECT organisation_id, bin_id, item_id, quantity
    INTO v_org, v_bin, v_item, v_qty
    FROM warehouse_bin_items
   WHERE id = p_row_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Bin item row not found');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM user_organisations
     WHERE organisation_id = v_org AND user_id = auth.uid() AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not a member of this organisation');
  END IF;

  -- Defense-in-depth: the row is org-scoped, but the bin it references must
  -- also belong to the org (same hardening as the 006 transfer RPC).
  IF NOT EXISTS (
    SELECT 1 FROM warehouse_bins
     WHERE id = v_bin AND organisation_id = v_org AND deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Bin not found in this organisation');
  END IF;

  UPDATE warehouse_bin_items
     SET deleted_at = now(), quantity = 0, updated_by = p_operator_id, updated_at = now()
   WHERE id = p_row_id;

  IF COALESCE(v_qty, 0) <> 0 THEN
    INSERT INTO warehouse_movements
      (organisation_id, movement_type, reference_type, reference_id, item_id,
       source_bin_id, quantity, operator_id, device, remarks)
    VALUES
      (v_org, 'adjust', 'adjustment', p_row_id::TEXT, v_item,
       v_bin, -v_qty, p_operator_id, p_device,
       COALESCE(p_remarks, 'Item removed from bin (Movement Engine)'));
  END IF;

  RETURN jsonb_build_object('ok', true, 'bin_item_id', p_row_id, 'removed_qty', v_qty);
END;
$$;
