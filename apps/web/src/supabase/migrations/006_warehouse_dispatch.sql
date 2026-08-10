-- ============================================================================
-- 006 — Warehouse Dispatch (Phase 4 completion): Shipment Execution
--
-- PRD §4.13 (Dispatch Queue) + TAD §3.13 (Dispatch Module) + TAD §5.11
-- (Reservations belong to the Movement Engine):
--   * warehouse_dispatches       — dispatch records with the full queue
--                                  lifecycle: draft (pending sales order) →
--                                  reserved → picking → packing → ready →
--                                  loaded → completed, plus cancelled.
--                                  Reservation (reserved_qty) is tracked on
--                                  the row AND posted to the source bin's
--                                  reserved_quantity so no other operation
--                                  can consume reserved stock.
--   * reserve_for_dispatch       — TAD §5.11: reserve stock at the source
--                                  bin (fails if insufficient unreserved qty).
--   * release_dispatch_reserve   — cancel a reservation (restores availability).
--   * execute_warehouse_dispatch — shipment confirmation: validates the
--                                  dispatch (reserved & in a shippable state),
--                                  decrements the source bin (Movement
--                                  Engine), writes a 'dispatch' movement
--                                  audit row, completes the dispatch.
--   * execute_warehouse_transfer / replenish_bin are REPLACED with
--     reservation-aware versions: available = quantity - reserved_quantity,
--     so reserved stock cannot be transferred or replenished (TAD §5.11).
--
-- RLS: org-scoped, same convention as 004/005.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. warehouse_dispatches
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS warehouse_dispatches (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id   UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  dispatch_no       TEXT NOT NULL,
  sales_order_ref   TEXT,                          -- PRD §4.13: pending sales orders
  item_id           UUID,
  quantity          NUMERIC(14,3) NOT NULL DEFAULT 0,
  reserved_qty      NUMERIC(14,3) NOT NULL DEFAULT 0,
  source_bin_id     UUID NOT NULL REFERENCES warehouse_bins(id),
  priority          TEXT NOT NULL DEFAULT 'normal'
                    CHECK (priority IN ('low','normal','high','urgent','critical')),
  status            TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','reserved','picking','packing',
                                      'ready','loaded','completed','cancelled')),
  reserved_at       TIMESTAMPTZ,
  picked_at         TIMESTAMPTZ,
  packed_at         TIMESTAMPTZ,
  ready_at          TIMESTAMPTZ,
  loaded_at         TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  cancelled_at      TIMESTAMPTZ,
  vehicle_no        TEXT,
  driver_name       TEXT,
  shipment_notes    TEXT,
  remarks           TEXT,
  created_by        UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_warehouse_dispatches_no
  ON warehouse_dispatches (organisation_id, dispatch_no);
CREATE INDEX IF NOT EXISTS ix_warehouse_dispatches_status
  ON warehouse_dispatches (organisation_id, status, created_at DESC);

-- ---------------------------------------------------------------------------
-- 2. RLS — org-scoped
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  policy_name TEXT;
BEGIN
  ALTER TABLE warehouse_dispatches ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS warehouse_dispatches_all_access ON warehouse_dispatches;
  policy_name := 'wh_org_member_all_warehouse_dispatches';
  EXECUTE format('DROP POLICY IF EXISTS %I ON warehouse_dispatches', policy_name);
  EXECUTE format($pol$
    CREATE POLICY %I ON warehouse_dispatches
      FOR ALL
      USING (
        organisation_id IN (
          SELECT organisation_id FROM user_organisations
          WHERE user_id = auth.uid() AND status = 'active'
        )
      )
      WITH CHECK (
        organisation_id IN (
          SELECT organisation_id FROM user_organisations
          WHERE user_id = auth.uid() AND status = 'active'
        )
      )
  $pol$, policy_name);
END $$;

-- ---------------------------------------------------------------------------
-- 3. Dispatch number sequence (org-membership gated)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION next_warehouse_dispatch_no(p_organisation_id UUID)
RETURNS TEXT
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN EXISTS (
           SELECT 1 FROM user_organisations
            WHERE organisation_id = p_organisation_id
              AND user_id = auth.uid() AND status = 'active'
         )
    THEN 'DSP-' || LPAD(
      (COALESCE(MAX(CAST(SUBSTRING(dispatch_no FROM 5) AS INTEGER)), 0) + 1)::TEXT,
      6, '0')
    ELSE NULL END
  FROM warehouse_dispatches
   WHERE organisation_id = p_organisation_id AND dispatch_no LIKE 'DSP-%';
$$;

-- ---------------------------------------------------------------------------
-- 4. Reserve stock for a dispatch (TAD §5.11).
--    Reservation is posted to the source bin's reserved_quantity so every
--    other movement engine operation sees it as unavailable.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION reserve_for_dispatch(
  p_dispatch_id UUID,
  p_operator_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID;
  v_item_id UUID;
  v_qty NUMERIC;
  v_src UUID;
  v_reserved NUMERIC;
  v_available NUMERIC;
  v_status TEXT;
BEGIN
  SELECT organisation_id, item_id, quantity, source_bin_id, status
    INTO v_org, v_item_id, v_qty, v_src, v_status
    FROM warehouse_dispatches WHERE id = p_dispatch_id;

  IF v_org IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Dispatch not found');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM user_organisations
     WHERE organisation_id = v_org AND user_id = auth.uid() AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not a member of this organisation');
  END IF;
  IF v_status NOT IN ('draft','reserved') THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'Cannot reserve a dispatch in status ' || v_status);
  END IF;

  -- Bin must belong to the org AND have enough unreserved stock.
  -- COALESCE + NOT FOUND: a bin with a NULL (never-reserved) reserved_quantity
  -- must NOT be reported as "not found" — only a genuinely missing bin may.
  SELECT COALESCE(reserved_quantity, 0) INTO v_reserved
    FROM warehouse_bins
   WHERE id = v_src AND organisation_id = v_org AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Source bin not found in this organisation');
  END IF;

  -- Conservative by design: subtract the bin's TOTAL reserved_quantity
  -- (across all items) from this item's stock. Never over-commits; may
  -- under-count availability for a different item sharing the bin.
  -- (TAD §5.11 — reserved stock is unavailable to every consumer.)

  SELECT COALESCE(SUM(quantity), 0) - COALESCE(v_reserved, 0) INTO v_available
    FROM warehouse_bin_items
   WHERE bin_id = v_src AND item_id IS NOT DISTINCT FROM v_item_id AND deleted_at IS NULL;
  IF v_available < v_qty THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'Insufficient unreserved stock: ' || v_available || ' < ' || v_qty);
  END IF;

  -- Post the reservation on the bin AND the dispatch.
  UPDATE warehouse_bins
     SET reserved_quantity = COALESCE(reserved_quantity, 0) + v_qty,
         updated_at = now()
   WHERE id = v_src;
  UPDATE warehouse_dispatches
     SET status = 'reserved',
         reserved_qty = v_qty,
         reserved_at = COALESCE(reserved_at, now()),
         updated_at = now()
   WHERE id = p_dispatch_id;

  RETURN jsonb_build_object('ok', true, 'dispatch_id', p_dispatch_id, 'reserved_qty', v_qty);
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Release a dispatch reservation (cancel before shipment).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION release_dispatch_reserve(
  p_dispatch_id UUID,
  p_operator_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID;
  v_src UUID;
  v_reserved NUMERIC;
  v_status TEXT;
BEGIN
  SELECT organisation_id, source_bin_id, status, reserved_qty
    INTO v_org, v_src, v_status, v_reserved
    FROM warehouse_dispatches WHERE id = p_dispatch_id;
  IF v_org IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Dispatch not found');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM user_organisations
     WHERE organisation_id = v_org AND user_id = auth.uid() AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not a member of this organisation');
  END IF;
  IF v_status NOT IN ('reserved','picking','packing') THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'Cannot release reservation from status ' || v_status);
  END IF;

  -- Release the bin's reservation (never below zero).
  UPDATE warehouse_bins
     SET reserved_quantity = GREATEST(0, COALESCE(reserved_quantity, 0) - COALESCE(v_reserved, 0)),
         updated_at = now()
   WHERE id = v_src;

  UPDATE warehouse_dispatches
     SET status = 'cancelled',
         reserved_qty = 0,
         cancelled_at = now(),
         updated_at = now()
   WHERE id = p_dispatch_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. Execute dispatch — shipment confirmation (TAD §3.13: Shipment
--    Confirmation → Movement Posting). Validates the dispatch is reserved and
--    shippable, decrements the source bin (Movement Engine), writes the
--    'dispatch' movement audit row and completes the dispatch.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION execute_warehouse_dispatch(
  p_dispatch_id UUID,
  p_vehicle_no TEXT DEFAULT NULL,
  p_driver_name TEXT DEFAULT NULL,
  p_operator_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID;
  v_item_id UUID;
  v_qty NUMERIC;
  v_src UUID;
  v_status TEXT;
  v_reserved NUMERIC;
  v_bin_reserved NUMERIC;
BEGIN
  SELECT organisation_id, item_id, quantity, source_bin_id, status, reserved_qty
    INTO v_org, v_item_id, v_qty, v_src, v_status, v_reserved
    FROM warehouse_dispatches WHERE id = p_dispatch_id;

  IF v_org IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Dispatch not found');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM user_organisations
     WHERE organisation_id = v_org AND user_id = auth.uid() AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not a member of this organisation');
  END IF;
  -- TAD §3.13: Loading must precede Shipment Confirmation. Only a LOADED
  -- dispatch may execute (movement posting) — matches the UI lifecycle
  -- (Ship & Complete is only rendered at status 'loaded').
  IF v_status <> 'loaded' THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'Cannot dispatch from status ' || v_status || ' — must be loaded');
  END IF;

  -- Bin must belong to the org. COALESCE + NOT FOUND: a bin whose
  -- reserved_quantity is NULL (never reserved) is still a valid source bin.
  SELECT COALESCE(reserved_quantity, 0) INTO v_bin_reserved
    FROM warehouse_bins WHERE id = v_src AND organisation_id = v_org AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Source bin not found in this organisation');
  END IF;

  -- Decrement the source bin (Movement Engine). Only live rows count.
  UPDATE warehouse_bin_items
     SET quantity = GREATEST(0, quantity - v_qty), updated_at = now()
   WHERE bin_id = v_src AND item_id IS NOT DISTINCT FROM v_item_id AND deleted_at IS NULL;
  UPDATE warehouse_bin_items
     SET deleted_at = now(), quantity = 0, updated_at = now()
   WHERE bin_id = v_src AND item_id IS NOT DISTINCT FROM v_item_id
     AND quantity <= 0 AND deleted_at IS NULL;

  -- Release the reservation on the bin.
  UPDATE warehouse_bins
     SET reserved_quantity = GREATEST(0, COALESCE(reserved_quantity, 0) - COALESCE(v_reserved, 0)),
         updated_at = now()
   WHERE id = v_src;

  -- Audit row (PRD §9.23): dispatch movement.
  INSERT INTO warehouse_movements
    (organisation_id, movement_type, reference_type, reference_id, item_id,
     source_bin_id, quantity, operator_id, device, remarks)
  VALUES
    (v_org, 'dispatch', 'dispatch', p_dispatch_id::TEXT, v_item_id,
     v_src, -v_qty, p_operator_id, 'web',
     'Shipment ' || COALESCE(p_vehicle_no, '') || ' ' || COALESCE(p_driver_name, ''));

  UPDATE warehouse_dispatches
     SET status = 'completed',
         completed_at = now(),
         vehicle_no = COALESCE(p_vehicle_no, vehicle_no),
         driver_name = COALESCE(p_driver_name, driver_name),
         updated_at = now()
   WHERE id = p_dispatch_id;

  RETURN jsonb_build_object('ok', true, 'dispatch_id', p_dispatch_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. Reservation-aware transfer + replenish (TAD §5.11 — reserved stock
--    cannot be transferred or consumed). Replaces the 005 versions:
--    available stock = quantity - reserved_quantity.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION execute_warehouse_transfer(
  p_transfer_id UUID,
  p_operator_id UUID DEFAULT NULL,
  p_device TEXT DEFAULT NULL,
  p_remarks TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID;
  v_item_id UUID;
  v_qty NUMERIC;
  v_src UUID;
  v_dst UUID;
  v_src_qty NUMERIC;
  v_dst_max NUMERIC;
  v_ok BOOLEAN;
  v_row RECORD;
BEGIN
  SELECT organisation_id, item_id, quantity, source_bin_id, destination_bin_id, status
    INTO v_org, v_item_id, v_qty, v_src, v_dst, v_row.status
    FROM warehouse_transfers WHERE id = p_transfer_id;

  IF v_org IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Transfer not found');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM user_organisations
     WHERE organisation_id = v_org AND user_id = auth.uid() AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not a member of this organisation');
  END IF;
  IF v_row.status NOT IN ('requested','approved','picking','in_transit') THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'Transfer status ' || v_row.status || ' cannot be executed');
  END IF;

  -- BOTH bins must belong to the caller's org (SECURITY DEFINER bypasses RLS).
  SELECT COUNT(*) = 2 INTO v_ok
    FROM warehouse_bins
   WHERE id IN (v_src, v_dst) AND organisation_id = v_org AND deleted_at IS NULL;
  IF NOT v_ok THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Source/destination bin not found in this organisation');
  END IF;

  -- Available = quantity minus reserved (reserved stock cannot be moved).
  SELECT COALESCE(SUM(bi.quantity), 0) - COALESCE(b.reserved_quantity, 0) INTO v_src_qty
    FROM warehouse_bins b
    LEFT JOIN warehouse_bin_items bi
      ON bi.bin_id = b.id AND bi.item_id IS NOT DISTINCT FROM v_item_id AND bi.deleted_at IS NULL
   WHERE b.id = v_src;
  IF v_src_qty < v_qty THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'Insufficient unreserved stock in source bin: ' || v_src_qty || ' < ' || v_qty);
  END IF;

  SELECT max_quantity INTO v_dst_max FROM warehouse_bins WHERE id = v_dst;
  IF v_dst_max IS NOT NULL AND v_dst_max > 0 THEN
    SELECT COALESCE(SUM(quantity), 0) INTO v_src_qty
      FROM warehouse_bin_items WHERE bin_id = v_dst AND deleted_at IS NULL;
    IF v_src_qty + v_qty > v_dst_max THEN
      RETURN jsonb_build_object('ok', false, 'error',
        'Destination bin capacity exceeded: ' || v_src_qty || ' + ' || v_qty || ' > ' || v_dst_max);
    END IF;
  END IF;

  UPDATE warehouse_bin_items
     SET quantity = GREATEST(0, quantity - v_qty), updated_at = now()
   WHERE bin_id = v_src AND item_id IS NOT DISTINCT FROM v_item_id AND deleted_at IS NULL;
  UPDATE warehouse_bin_items
     SET deleted_at = now(), quantity = 0, updated_at = now()
   WHERE bin_id = v_src AND item_id IS NOT DISTINCT FROM v_item_id
     AND quantity <= 0 AND deleted_at IS NULL;

  INSERT INTO warehouse_bin_items (organisation_id, bin_id, item_id, quantity, is_primary, created_at, updated_at)
  VALUES (v_org, v_dst, v_item_id, v_qty, false, now(), now())
  ON CONFLICT (bin_id, item_id)
  DO UPDATE SET quantity = warehouse_bin_items.quantity + EXCLUDED.quantity,
                deleted_at = NULL,
                updated_at = now();

  INSERT INTO warehouse_movements
    (organisation_id, movement_type, reference_type, reference_id, item_id,
     source_bin_id, destination_bin_id, quantity, operator_id, device, remarks)
  VALUES
    (v_org, 'transfer_out', 'transfer', p_transfer_id::TEXT, v_item_id,
     v_src, v_dst, -v_qty, p_operator_id, p_device, p_remarks),
    (v_org, 'transfer_in', 'transfer', p_transfer_id::TEXT, v_item_id,
     v_src, v_dst, v_qty, p_operator_id, p_device, p_remarks);

  UPDATE warehouse_transfers
     SET status = 'received',
         received_by = COALESCE(p_operator_id, received_by),
         received_at = now(),
         updated_at = now()
   WHERE id = p_transfer_id;

  RETURN jsonb_build_object('ok', true, 'transfer_id', p_transfer_id);
END;
$$;

CREATE OR REPLACE FUNCTION replenish_bin(
  p_organisation_id UUID,
  p_source_bin_id UUID,
  p_destination_bin_id UUID,
  p_item_id UUID,
  p_quantity NUMERIC,
  p_operator_id UUID DEFAULT NULL,
  p_device TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_src_qty NUMERIC;
  v_ok BOOLEAN;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_organisations
     WHERE organisation_id = p_organisation_id AND user_id = auth.uid() AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not a member of this organisation');
  END IF;
  IF p_quantity <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Quantity must be positive');
  END IF;

  SELECT COUNT(*) = 2 INTO v_ok
    FROM warehouse_bins
   WHERE id IN (p_source_bin_id, p_destination_bin_id)
     AND organisation_id = p_organisation_id AND deleted_at IS NULL;
  IF NOT v_ok THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Source/destination bin not found in this organisation');
  END IF;

  -- Available = quantity minus reserved (reserved stock cannot be consumed).
  SELECT COALESCE(SUM(bi.quantity), 0) - COALESCE(b.reserved_quantity, 0) INTO v_src_qty
    FROM warehouse_bins b
    LEFT JOIN warehouse_bin_items bi
      ON bi.bin_id = b.id AND bi.item_id IS NOT DISTINCT FROM p_item_id AND bi.deleted_at IS NULL
   WHERE b.id = p_source_bin_id;
  IF v_src_qty < p_quantity THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'Insufficient unreserved bulk stock: ' || v_src_qty || ' < ' || p_quantity);
  END IF;

  UPDATE warehouse_bin_items
     SET quantity = GREATEST(0, quantity - p_quantity), updated_at = now()
   WHERE bin_id = p_source_bin_id AND item_id IS NOT DISTINCT FROM p_item_id AND deleted_at IS NULL;
  UPDATE warehouse_bin_items
     SET deleted_at = now(), quantity = 0, updated_at = now()
   WHERE bin_id = p_source_bin_id AND item_id IS NOT DISTINCT FROM p_item_id
     AND quantity <= 0 AND deleted_at IS NULL;

  INSERT INTO warehouse_bin_items (organisation_id, bin_id, item_id, quantity, is_primary, created_at, updated_at)
  VALUES (p_organisation_id, p_destination_bin_id, p_item_id, p_quantity, false, now(), now())
  ON CONFLICT (bin_id, item_id)
  DO UPDATE SET quantity = warehouse_bin_items.quantity + EXCLUDED.quantity,
                deleted_at = NULL,
                updated_at = now();

  INSERT INTO warehouse_movements
    (organisation_id, movement_type, reference_type, reference_id, item_id,
     source_bin_id, destination_bin_id, quantity, operator_id, device, remarks)
  VALUES
    (p_organisation_id, 'replenish', 'replenishment', NULL, p_item_id,
     p_source_bin_id, p_destination_bin_id, p_quantity, p_operator_id, p_device,
     'Bulk → Picking replenishment');

  RETURN jsonb_build_object('ok', true);
END;
$$;
