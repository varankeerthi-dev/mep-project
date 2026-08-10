-- ============================================================================
-- 009 — Picking Module (TAD §3.12)
--
-- Functions per TAD §3.12:
--   * Generate Pick Lists   — warehouse_pick_lists + items (from outbound
--                             orders; source_ref is a free-text outbound
--                             reference). Lifecycle: queued → picking →
--                             completed (+ cancelled). Per-line status:
--                             pending → picked.
--   * Recommend Bins        — client-side pure ranking (picking.ts): picking
--                             storage-role bins first, primary picking bin
--                             first, then other bins holding the item, all
--                             filtered to available qty ≥ requested.
--   * Pick Validation       — complete_pick_list validates each line against
--                             live unreserved stock (qty − reserved, TAD
--                             §5.11) and capacity-safe removal.
--   * Completion            — Movement Engine: each picked line decrements
--                             the source bin and writes a 'pick' movement
--                             audit row (TAD §5.19: consumption always
--                             through movements). Then the list completes.
--
-- Route Optimization is explicitly FUTURE (TAD §3.12).
--
-- Movement-type encoding: a pick is a source-side negative movement
-- (stock leaves the picking bin), so it stays compatible with the TAD §5.12
-- reversal engine built in migration 007.
--
-- RLS: org-scoped, same convention as 003–008.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. warehouse_pick_lists + warehouse_pick_list_items
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS warehouse_pick_lists (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id   UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  pick_no           TEXT NOT NULL,
  source_ref        TEXT,                          -- outbound order reference
  priority          TEXT NOT NULL DEFAULT 'normal'
                    CHECK (priority IN ('low','normal','high','urgent','critical')),
  status            TEXT NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued','picking','completed','cancelled')),
  assigned_to       UUID,
  created_by        UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ,
  cancelled_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS warehouse_pick_list_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_list_id      UUID NOT NULL REFERENCES warehouse_pick_lists(id) ON DELETE CASCADE,
  item_id           UUID,
  source_bin_id     UUID NOT NULL REFERENCES warehouse_bins(id),
  quantity_requested NUMERIC(14,3) NOT NULL DEFAULT 0,
  quantity_picked   NUMERIC(14,3) NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','picked')),
  picked_by         UUID,
  picked_at         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_warehouse_pick_lists_no
  ON warehouse_pick_lists (organisation_id, pick_no);
CREATE INDEX IF NOT EXISTS ix_warehouse_pick_lists_status
  ON warehouse_pick_lists (organisation_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_warehouse_pick_items_list
  ON warehouse_pick_list_items (pick_list_id);

-- ---------------------------------------------------------------------------
-- 2. RLS — org-scoped
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  policy_name TEXT;
BEGIN
  ALTER TABLE warehouse_pick_lists ENABLE ROW LEVEL SECURITY;
  ALTER TABLE warehouse_pick_list_items ENABLE ROW LEVEL SECURITY;

  policy_name := 'wh_org_member_all_warehouse_pick_lists';
  EXECUTE format('DROP POLICY IF EXISTS %I ON warehouse_pick_lists', policy_name);
  EXECUTE format($pol$
    CREATE POLICY %I ON warehouse_pick_lists
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

  -- Items are scoped through their parent pick list.
  policy_name := 'wh_org_member_all_warehouse_pick_list_items';
  EXECUTE format('DROP POLICY IF EXISTS %I ON warehouse_pick_list_items', policy_name);
  EXECUTE format($pol$
    CREATE POLICY %I ON warehouse_pick_list_items
      FOR ALL
      USING (
        pick_list_id IN (
          SELECT id FROM warehouse_pick_lists WHERE organisation_id IN (
            SELECT organisation_id FROM user_organisations
            WHERE user_id = auth.uid() AND status = 'active'
          )
        )
      )
      WITH CHECK (
        pick_list_id IN (
          SELECT id FROM warehouse_pick_lists WHERE organisation_id IN (
            SELECT organisation_id FROM user_organisations
            WHERE user_id = auth.uid() AND status = 'active'
          )
        )
      )
  $pol$, policy_name);
END $$;

-- ---------------------------------------------------------------------------
-- 3. Movement audit types: add 'pick' movement + 'picking' reference.
--    Rebuild both CHECKs (007 already rebuilt movement_type to add
--    'reversal'; this extends both to the picking vocabulary).
-- ---------------------------------------------------------------------------
ALTER TABLE warehouse_movements
  DROP CONSTRAINT IF EXISTS warehouse_movements_movement_type_check;
ALTER TABLE warehouse_movements
  ADD CONSTRAINT warehouse_movements_movement_type_check
  CHECK (movement_type IN ('receive','transfer_out','transfer_in','dispatch',
                           'consolidate','overflow','replenish','adjust',
                           'other','reversal','pick'));

ALTER TABLE warehouse_movements
  DROP CONSTRAINT IF EXISTS warehouse_movements_reference_type_check;
ALTER TABLE warehouse_movements
  ADD CONSTRAINT warehouse_movements_reference_type_check
  CHECK (reference_type IN ('transfer','receiving','dispatch',
                            'consolidation','replenishment',
                            'adjustment','other','picking'));

-- ---------------------------------------------------------------------------
-- 4. Pick-list number sequence (org-membership gated)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION next_warehouse_pick_no(p_organisation_id UUID)
RETURNS TEXT
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN EXISTS (
           SELECT 1 FROM user_organisations
            WHERE organisation_id = p_organisation_id
              AND user_id = auth.uid() AND status = 'active'
         )
    THEN 'PK-' || LPAD(
      (COALESCE(MAX(CAST(SUBSTRING(pick_no FROM 4) AS INTEGER)), 0) + 1)::TEXT,
      6, '0')
    ELSE NULL END
  FROM warehouse_pick_lists
   WHERE organisation_id = p_organisation_id AND pick_no LIKE 'PK-%';
$$;

-- ---------------------------------------------------------------------------
-- 5. complete_pick_list — Movement Engine (TAD §5.19: consumption always
--    through movements). For every pending line with quantity_picked > 0:
--      validate unreserved stock at the source bin (TAD §5.11)
--      decrement the bin (soft-delete empty rows — never hard-delete)
--      write a 'pick' audit row (source-side negative)
--    Then mark the list completed. All atomic.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION complete_pick_list(
  p_pick_list_id UUID,
  p_operator_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID;
  v_status TEXT;
  v_row RECORD;
  v_available NUMERIC;
  v_picked INTEGER := 0;
  v_skipped INTEGER := 0;
BEGIN
  SELECT organisation_id, status INTO v_org, v_status
    FROM warehouse_pick_lists WHERE id = p_pick_list_id;

  IF v_org IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Pick list not found');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM user_organisations
     WHERE organisation_id = v_org AND user_id = auth.uid() AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not a member of this organisation');
  END IF;
  IF v_status NOT IN ('queued','picking') THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'Cannot complete a pick list in status ' || v_status);
  END IF;

  FOR v_row IN
    SELECT i.id, i.item_id, i.source_bin_id, i.quantity_requested, i.quantity_picked, i.status
      FROM warehouse_pick_list_items i
     WHERE i.pick_list_id = p_pick_list_id
  LOOP
    -- Already-picked lines were completed by a prior partial run — skip.
    IF v_row.status = 'picked' THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    IF COALESCE(v_row.quantity_picked, 0) <= 0 THEN
      RETURN jsonb_build_object('ok', false, 'error',
        'Line ' || v_row.id || ' has no picked quantity — set quantity_picked before completing');
    END IF;

    -- Source bin must belong to the caller's org.
    IF NOT EXISTS (
      SELECT 1 FROM warehouse_bins
       WHERE id = v_row.source_bin_id AND organisation_id = v_org AND deleted_at IS NULL
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Source bin not found in this organisation');
    END IF;

    -- Pick validation: unreserved stock must cover the pick (TAD §5.11).
    SELECT COALESCE(SUM(bi.quantity), 0) - COALESCE(b.reserved_quantity, 0) INTO v_available
      FROM warehouse_bins b
      LEFT JOIN warehouse_bin_items bi
        ON bi.bin_id = b.id AND bi.item_id IS NOT DISTINCT FROM v_row.item_id AND bi.deleted_at IS NULL
     WHERE b.id = v_row.source_bin_id;
    IF v_available < v_row.quantity_picked THEN
      RETURN jsonb_build_object('ok', false, 'error',
        'Insufficient unreserved stock for line ' || v_row.id || ': ' ||
        v_available || ' < ' || v_row.quantity_picked);
    END IF;

    -- Movement Engine: decrement the source bin.
    UPDATE warehouse_bin_items
       SET quantity = GREATEST(0, quantity - v_row.quantity_picked), updated_at = now()
     WHERE bin_id = v_row.source_bin_id AND item_id IS NOT DISTINCT FROM v_row.item_id AND deleted_at IS NULL;
    UPDATE warehouse_bin_items
       SET deleted_at = now(), quantity = 0, updated_at = now()
     WHERE bin_id = v_row.source_bin_id AND item_id IS NOT DISTINCT FROM v_row.item_id
       AND quantity <= 0 AND deleted_at IS NULL;

    -- Audit row — source-side negative, reversal-compatible.
    INSERT INTO warehouse_movements
      (organisation_id, movement_type, reference_type, reference_id, item_id,
       source_bin_id, quantity, operator_id, device, remarks)
    VALUES
      (v_org, 'pick', 'picking', p_pick_list_id::TEXT, v_row.item_id,
       v_row.source_bin_id, -v_row.quantity_picked, p_operator_id, 'web',
       'Picking task ' || p_pick_list_id);

    UPDATE warehouse_pick_list_items
       SET status = 'picked', picked_by = p_operator_id, picked_at = now(), updated_at = now()
     WHERE id = v_row.id;
    v_picked := v_picked + 1;
  END LOOP;

  UPDATE warehouse_pick_lists
     SET status = 'completed', completed_at = now(), updated_at = now()
   WHERE id = p_pick_list_id;

  RETURN jsonb_build_object('ok', true, 'pick_list_id', p_pick_list_id,
                            'picked', v_picked, 'skipped', v_skipped);
END;
$$;
