-- ============================================================================
-- 007 — Movement Reversal (TAD §5.12)
--
-- Every completed movement shall support reversal:
--   Wrong Transfer → Reverse Movement → Restore Previous Inventory
--                   → Create Reverse Audit
-- History shall never be deleted — reversal GENERATES NEW transactions; the
-- original movement rows are never deleted, only marked reversed.
--
-- Semantics:
--   * A transfer is recorded as a PAIR of rows (transfer_out −q, transfer_in
--     +q) for ONE logical movement, so reversal operates on the whole
--     REFERENCE GROUP (all non-reversed rows sharing reference_type +
--     reference_id) and applies the NET inverse effect exactly once.
--   * A movement's effect on stock: source loses |qty|, destination gains
--     |qty|. Reversal inverts that: source gains |qty| back, destination
--     loses |qty|.
--   * Reservations (TAD §5.11): if the reference is a dispatch that still
--     holds an ACTIVE reservation, reversal releases it so restored stock is
--     immediately consumable. Completed dispatches already released their
--     reservation at execute time, so this guard is a no-op there.
--
-- RLS: org-scoped, same convention as 004/005/006.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Schema additions — warehouse_movements stays IMMUTABLE (no deleted_at);
--    reversal is recorded via marking columns on the original + a NEW
--    'reversal' movement row that points back (reversal_of).
-- ---------------------------------------------------------------------------
ALTER TABLE warehouse_movements
  ADD COLUMN IF NOT EXISTS reversal_of   UUID REFERENCES warehouse_movements(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reversed_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reversed_by   UUID;

-- Allow the new 'reversal' movement type (rebuild the column CHECK).
ALTER TABLE warehouse_movements
  DROP CONSTRAINT IF EXISTS warehouse_movements_movement_type_check;
ALTER TABLE warehouse_movements
  ADD CONSTRAINT warehouse_movements_movement_type_check
  CHECK (movement_type IN ('receive','transfer_out','transfer_in','dispatch',
                           'consolidate','overflow','replenish','adjust',
                           'other','reversal'));

CREATE INDEX IF NOT EXISTS ix_warehouse_movements_reversal_of
  ON warehouse_movements (reversal_of) WHERE reversal_of IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_warehouse_movements_unreversed_ref
  ON warehouse_movements (reference_type, reference_id) WHERE reversed_at IS NULL;

-- ---------------------------------------------------------------------------
-- 2. reverse_warehouse_movement — the single Movement-Engine reversal RPC.
--    Validates, restores stock, releases reservations, and writes reversal
--    audit rows — all atomically.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION reverse_warehouse_movement(
  p_movement_id UUID,
  p_operator_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_anchor RECORD;
  v_org UUID;
  v_item_id UUID;
  v_group_id UUID;
  v_apply RECORD;
  v_available NUMERIC;
  v_capacity NUMERIC;
  v_current NUMERIC;
  v_items INTEGER;
  v_count INTEGER;
  v_ok BOOLEAN;
  v_reversed_count INTEGER := 0;
BEGIN
  -- 1. Load the anchor movement.
  SELECT id, organisation_id, movement_type, reference_type, reference_id,
         item_id, source_bin_id, destination_bin_id, quantity, reversed_at
    INTO v_anchor
    FROM warehouse_movements
   WHERE id = p_movement_id;

  IF v_anchor.organisation_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Movement not found');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM user_organisations
     WHERE organisation_id = v_anchor.organisation_id
       AND user_id = auth.uid() AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not a member of this organisation');
  END IF;
  IF v_anchor.movement_type = 'reversal' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cannot reverse a reversal');
  END IF;
  IF v_anchor.reversed_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Movement already reversed');
  END IF;
  IF COALESCE(v_anchor.quantity, 0) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Movement has no quantity to reverse');
  END IF;
  IF v_anchor.source_bin_id IS NULL AND v_anchor.destination_bin_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Movement has no bins to reverse');
  END IF;

  v_org := v_anchor.organisation_id;
  v_item_id := v_anchor.item_id;

  -- 2. Reference group: every non-reversed row of the same reference
  --    (transfer pairs reverse together); when reference_id is NULL (receive,
  --    replenish) only the anchor row belongs to the group.
  --    All temp tables are ON COMMIT DROP so no early-RETURN path can leak
  --    them into the pooled session (a second call would otherwise fail with
  --    "relation already exists").
  CREATE TEMP TABLE _rev_group ON COMMIT DROP AS
  SELECT id, source_bin_id, destination_bin_id, quantity, item_id
    FROM warehouse_movements
   WHERE organisation_id = v_org
     AND reversed_at IS NULL
     AND movement_type <> 'reversal'
     AND (
       (v_anchor.reference_id IS NOT NULL
        AND reference_type = v_anchor.reference_type
        AND reference_id = v_anchor.reference_id)
       OR
       (v_anchor.reference_id IS NULL AND id = p_movement_id)
     );

  SELECT COUNT(*), COUNT(DISTINCT item_id) INTO v_count, v_items FROM _rev_group;
  IF v_count = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No reversible movements in this reference');
  END IF;
  IF v_items > 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Reference mixes multiple items — cannot reverse as a unit');
  END IF;

  -- 3. NET effect of the group: source loses |qty|, destination gains |qty|.
  --    A transfer is recorded as a PAIR (transfer_out −q, transfer_in +q) for
  --    ONE logical movement, so both rows produce the IDENTICAL per-bin effect
  --    (src −q, dst +q). DISTINCT on (bin_id, delta) dedupes the pair so the
  --    net effect is never double-counted (TAD §5.12).
  CREATE TEMP TABLE _rev_effects (bin_id UUID PRIMARY KEY, delta NUMERIC NOT NULL) ON COMMIT DROP;
  INSERT INTO _rev_effects (bin_id, delta)
  SELECT DISTINCT source_bin_id, -ABS(quantity)
    FROM _rev_group WHERE source_bin_id IS NOT NULL
  ON CONFLICT (bin_id) DO UPDATE SET delta = _rev_effects.delta + EXCLUDED.delta;
  INSERT INTO _rev_effects (bin_id, delta)
  SELECT DISTINCT destination_bin_id, ABS(quantity)
    FROM _rev_group WHERE destination_bin_id IS NOT NULL
  ON CONFLICT (bin_id) DO UPDATE SET delta = _rev_effects.delta + EXCLUDED.delta;

  -- Reversal = invert every bin's net effect.
  CREATE TEMP TABLE _rev_apply ON COMMIT DROP AS
  SELECT bin_id, -delta AS delta FROM _rev_effects;

  -- 4. Tenant isolation: every affected bin belongs to the caller's org.
  SELECT COUNT(*) = (SELECT COUNT(*) FROM _rev_apply) INTO v_ok
    FROM warehouse_bins
   WHERE id IN (SELECT bin_id FROM _rev_apply)
     AND organisation_id = v_org AND deleted_at IS NULL;
  IF NOT v_ok THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Affected bin not found in this organisation');
  END IF;

  -- 5. Feasibility validation.
  --    Removals (delta < 0): bin must hold enough unreserved stock.
  FOR v_apply IN SELECT * FROM _rev_apply WHERE delta < 0 LOOP
    SELECT COALESCE(SUM(bi.quantity), 0) - COALESCE(b.reserved_quantity, 0) INTO v_available
      FROM warehouse_bins b
      LEFT JOIN warehouse_bin_items bi
        ON bi.bin_id = b.id AND bi.item_id IS NOT DISTINCT FROM v_item_id AND bi.deleted_at IS NULL
     WHERE b.id = v_apply.bin_id;
    IF v_available < -v_apply.delta THEN
      RETURN jsonb_build_object('ok', false, 'error',
        'Cannot reverse: insufficient unreserved stock in bin ' || v_apply.bin_id ||
        ' (' || v_available || ' < ' || (-v_apply.delta) || ')');
    END IF;
  END LOOP;

  --    Restorations (delta > 0): bin capacity must not be exceeded.
  FOR v_apply IN SELECT * FROM _rev_apply WHERE delta > 0 LOOP
    SELECT max_quantity INTO v_capacity
      FROM warehouse_bins WHERE id = v_apply.bin_id AND deleted_at IS NULL;
    IF v_capacity IS NOT NULL AND v_capacity > 0 THEN
      SELECT COALESCE(SUM(quantity), 0) INTO v_current
        FROM warehouse_bin_items WHERE bin_id = v_apply.bin_id AND deleted_at IS NULL;
      IF v_current + v_apply.delta > v_capacity THEN
        RETURN jsonb_build_object('ok', false, 'error',
          'Cannot reverse: capacity exceeded in bin ' || v_apply.bin_id);
      END IF;
    END IF;
  END LOOP;

  -- 6. Release an ACTIVE reservation tied to this reference (TAD §5.11) so
  --    restored stock is consumable. Completed dispatches already released
  --    theirs at execute, so this only fires for still-reserved references.
  IF v_anchor.reference_type = 'dispatch' AND v_anchor.reference_id IS NOT NULL THEN
    UPDATE warehouse_bins b
       SET reserved_quantity = GREATEST(0, COALESCE(b.reserved_quantity, 0) - d.reserved_qty),
           updated_at = now()
      FROM warehouse_dispatches d
     WHERE d.id::TEXT = v_anchor.reference_id
       AND d.status IN ('reserved','picking','packing')
       AND d.source_bin_id = b.id
       AND d.reserved_qty > 0;
  END IF;

  -- 7. Apply the reversal to stock (Movement Engine): remove from destination
  --    bins, restore to source bins. Soft-delete empty rows — never hard-delete.
  FOR v_apply IN SELECT * FROM _rev_apply WHERE delta < 0 LOOP
    UPDATE warehouse_bin_items
       SET quantity = GREATEST(0, quantity + v_apply.delta), updated_at = now()
     WHERE bin_id = v_apply.bin_id AND item_id IS NOT DISTINCT FROM v_item_id AND deleted_at IS NULL;
    UPDATE warehouse_bin_items
       SET deleted_at = now(), quantity = 0, updated_at = now()
     WHERE bin_id = v_apply.bin_id AND item_id IS NOT DISTINCT FROM v_item_id
       AND quantity <= 0 AND deleted_at IS NULL;
  END LOOP;

  FOR v_apply IN SELECT * FROM _rev_apply WHERE delta > 0 LOOP
    INSERT INTO warehouse_bin_items
      (organisation_id, bin_id, item_id, quantity, is_primary, created_at, updated_at)
    VALUES (v_org, v_apply.bin_id, v_item_id, v_apply.delta, false, now(), now())
    ON CONFLICT (bin_id, item_id)
    DO UPDATE SET quantity = warehouse_bin_items.quantity + EXCLUDED.quantity,
                  deleted_at = NULL,
                  updated_at = now();
  END LOOP;

  -- 8. Mark originals reversed + write reversal audit rows (history never
  --    deleted — reversal generates NEW transactions, TAD §5.12).
  FOR v_group_id IN SELECT id FROM _rev_group LOOP
    INSERT INTO warehouse_movements
      (organisation_id, movement_type, reference_type, reference_id, item_id,
       source_bin_id, destination_bin_id, quantity, operator_id, device,
       remarks, reversal_of)
    SELECT v_org, 'reversal', m.reference_type, m.reference_id, m.item_id,
           m.destination_bin_id, m.source_bin_id, -m.quantity,
           p_operator_id, 'web', 'Reversal of ' || m.id, m.id
      FROM warehouse_movements m WHERE m.id = v_group_id;

    UPDATE warehouse_movements
       SET reversed_at = now(), reversed_by = p_operator_id
     WHERE id = v_group_id;
    v_reversed_count := v_reversed_count + 1;
  END LOOP;

  -- 9. Reference-document status: a reversed transfer/dispatch can no longer
  --    present as completed — its stock has been rolled back. Flipping the
  --    reference to cancelled keeps the UI truthful (TAD §5.12 "restore
  --    previous inventory"); the movement history retains the full chain.
  IF v_anchor.reference_type = 'transfer' AND v_anchor.reference_id IS NOT NULL THEN
    UPDATE warehouse_transfers
       SET status = 'cancelled',
           cancelled_at = now(),
           cancelled_by = p_operator_id,
           updated_at = now()
     WHERE id::TEXT = v_anchor.reference_id
       AND status NOT IN ('cancelled','rejected');
  ELSIF v_anchor.reference_type = 'dispatch' AND v_anchor.reference_id IS NOT NULL THEN
    UPDATE warehouse_dispatches
       SET status = 'cancelled',
           cancelled_at = now(),
           updated_at = now()
     WHERE id::TEXT = v_anchor.reference_id
       AND status NOT IN ('completed','cancelled');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'reversed', v_reversed_count,
    'reference_type', v_anchor.reference_type,
    'reference_id', v_anchor.reference_id
  );
END;
$$;
