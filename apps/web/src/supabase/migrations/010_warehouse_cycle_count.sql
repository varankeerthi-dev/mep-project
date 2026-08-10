-- ============================================================================
-- 010 — Inventory Accuracy: Cycle Count (PRD §4.21 / Phase 7, TAD §3.x)
--
-- Enterprise-grade counting with:
--   * ABC classification (A = high-value/low-volume, B, C) driving count
--     frequency — the client asks the engine for a recommended batch.
--   * Blind count: counted_qty is entered WITHOUT seeing the system qty,
--     so the counter can't anchor on it (the API returns expected_qty only
--     AFTER a count is submitted, or the UI hides it during entry).
--   * Freeze bin / zone / warehouse while counting (bin.status = 'cycle_count')
--     so movements don't race the count.
--   * Variance = counted − expected per item; every variance line needs
--     investigation before approval.
--   * Approval workflow: approving a batch with variance executes the
--     adjustment THROUGH the Movement Engine (adjust audit rows, same
--     sign-encoding as migration 008) — never a direct bin_item write.
--   * Audit: every approved adjustment writes warehouse_movements rows with
--     reference_type 'cycle_count' + the batch id, so TAD §5.12 reversal can
--     undo a wrong adjustment and history is never deleted.
--
-- RLS: org-scoped, same convention as 003–009.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS warehouse_cycle_count_batches (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id   UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  batch_no          TEXT NOT NULL,
  name              TEXT NOT NULL,
  abc_class         TEXT NOT NULL DEFAULT 'C' CHECK (abc_class IN ('A','B','C')),
  scope_type        TEXT NOT NULL DEFAULT 'zone' CHECK (scope_type IN ('warehouse','zone','bin')),
  scope_id          UUID,                          -- warehouse_id / zone_id / bin_id
  status            TEXT NOT NULL DEFAULT 'scheduled'
                    CHECK (status IN ('scheduled','in_progress','completed','cancelled')),
  planned_for       DATE,
  started_at        TIMESTAMPTZ,
  started_by        UUID,
  completed_at      TIMESTAMPTZ,
  completed_by      UUID,
  frozen_bins       INTEGER NOT NULL DEFAULT 0,
  item_count        INTEGER NOT NULL DEFAULT 0,
  variance_count    INTEGER NOT NULL DEFAULT 0,
  approval_status   TEXT NOT NULL DEFAULT 'none'
                    CHECK (approval_status IN ('none','pending','approved','rejected')),
  approved_at       TIMESTAMPTZ,
  approved_by       UUID,
  notes             TEXT,
  created_by        UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS warehouse_cycle_count_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id   UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  batch_id          UUID NOT NULL REFERENCES warehouse_cycle_count_batches(id) ON DELETE CASCADE,
  bin_id            UUID NOT NULL REFERENCES warehouse_bins(id),
  item_id           UUID REFERENCES materials(id) ON DELETE SET NULL,
  expected_qty      NUMERIC(14,3) NOT NULL DEFAULT 0,   -- system qty at batch creation
  counted_qty       NUMERIC(14,3),                      -- blind entry; NULL until counted
  variance          NUMERIC(14,3) DEFAULT 0,            -- counted − expected
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','counted','matched','variance',
                                      'investigated','adjusted')),
  investigation_note TEXT,
  adjusted_at       TIMESTAMPTZ,
  adjusted_by       UUID,
  counted_at        TIMESTAMPTZ,
  counted_by        UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_cycle_batches_no
  ON warehouse_cycle_count_batches (organisation_id, batch_no);
CREATE INDEX IF NOT EXISTS ix_cycle_items_batch
  ON warehouse_cycle_count_items (batch_id);
CREATE INDEX IF NOT EXISTS ix_cycle_batches_status
  ON warehouse_cycle_count_batches (organisation_id, status, planned_for);

-- ---------------------------------------------------------------------------
-- 2. RLS — org-scoped
-- ---------------------------------------------------------------------------
ALTER TABLE warehouse_cycle_count_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "warehouse_cycle_count_batches_all_access" ON warehouse_cycle_count_batches;
CREATE POLICY "warehouse_cycle_count_batches_all_access" ON warehouse_cycle_count_batches
  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE warehouse_cycle_count_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "warehouse_cycle_count_items_all_access" ON warehouse_cycle_count_items;
CREATE POLICY "warehouse_cycle_count_items_all_access" ON warehouse_cycle_count_items
  FOR ALL USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 3. Batch number sequence
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION next_warehouse_cycle_batch_no(p_organisation_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_year TEXT; v_count INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_organisations uo
    WHERE uo.organisation_id = p_organisation_id AND uo.user_id = auth.uid()
  ) THEN RETURN NULL; END IF;
  v_year := to_char(now(), 'YY');
  SELECT count(*) + 1 INTO v_count
    FROM warehouse_cycle_count_batches
   WHERE organisation_id = p_organisation_id;
  RETURN 'CC-' || v_year || '-' || lpad(v_count::TEXT, 4, '0');
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Create batch — snapshots the requested scope's current stock per bin/item.
--    The client picks the scope + ABC class; this snapshots expected quantities.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_cycle_count_batch(
  p_organisation_id UUID,
  p_name TEXT,
  p_abc_class TEXT,
  p_scope_type TEXT,
  p_scope_id UUID,
  p_planned_for DATE,
  p_operator_id UUID,
  p_notes TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_batch_id UUID;
  v_batch_no TEXT;
  v_bin_ids UUID[];
  v_count INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_organisations uo
    WHERE uo.organisation_id = p_organisation_id AND uo.user_id = auth.uid()
  ) THEN RETURN jsonb_build_object('ok', false, 'error', 'Not a member of this organisation'); END IF;

  -- Resolve the bins in scope (warehouse → floors → zones → bins; zone → bins; bin → itself).
  IF p_scope_type = 'bin' THEN
    v_bin_ids := ARRAY(SELECT id FROM warehouse_bins WHERE id = p_scope_id AND organisation_id = p_organisation_id AND deleted_at IS NULL);
  ELSIF p_scope_type = 'zone' THEN
    v_bin_ids := ARRAY(
      SELECT DISTINCT b.id FROM warehouse_bins b
      JOIN warehouse_tiers t ON t.id = b.tier_id
      JOIN warehouse_racks r ON r.id = t.rack_id
      JOIN warehouse_layouts l ON l.id = r.layout_id
      WHERE l.zone_id = p_scope_id AND b.organisation_id = p_organisation_id AND b.deleted_at IS NULL
    );
  ELSE -- warehouse
    v_bin_ids := ARRAY(
      SELECT DISTINCT b.id FROM warehouse_bins b
      JOIN warehouse_tiers t ON t.id = b.tier_id
      JOIN warehouse_racks r ON r.id = t.rack_id
      JOIN warehouse_layouts l ON l.id = r.layout_id
      JOIN warehouse_zones z ON z.id = l.zone_id
      JOIN warehouse_floors f ON f.id = z.floor_id
      WHERE f.warehouse_id = p_scope_id AND b.organisation_id = p_organisation_id AND b.deleted_at IS NULL
    );
  END IF;
  IF cardinality(v_bin_ids) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No bins found in the requested scope');
  END IF;

  v_batch_no := next_warehouse_cycle_batch_no(p_organisation_id);
  IF v_batch_no IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Permission denied'); END IF;

  INSERT INTO warehouse_cycle_count_batches
    (organisation_id, batch_no, name, abc_class, scope_type, scope_id,
     planned_for, notes, created_by, approval_status)
  VALUES
    (p_organisation_id, v_batch_no, p_name, p_abc_class, p_scope_type, p_scope_id,
     p_planned_for, p_notes, p_operator_id, 'none')
  RETURNING id INTO v_batch_id;

  -- Snapshot current stock: one line per (bin, item) with quantity > 0.
  INSERT INTO warehouse_cycle_count_items
    (organisation_id, batch_id, bin_id, item_id, expected_qty)
  SELECT p_organisation_id, v_batch_id, bi.bin_id, bi.item_id, SUM(bi.quantity)
    FROM warehouse_bin_items bi
   WHERE bi.bin_id = ANY(v_bin_ids)
     AND bi.organisation_id = p_organisation_id
     AND bi.deleted_at IS NULL
     AND bi.item_id IS NOT NULL
   GROUP BY bi.bin_id, bi.item_id
  HAVING SUM(bi.quantity) > 0;

  SELECT count(*) INTO v_count FROM warehouse_cycle_count_items WHERE batch_id = v_batch_id;

  UPDATE warehouse_cycle_count_batches
     SET item_count = v_count, updated_at = now()
   WHERE id = v_batch_id;

  RETURN jsonb_build_object('ok', true, 'batch_id', v_batch_id, 'batch_no', v_batch_no, 'item_count', v_count);
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Freeze / unfreeze scope — bins go to 'cycle_count' status so the
--    movement engine refuses to move stock during the count.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION freeze_cycle_scope(
  p_batch_id UUID,
  p_operator_id UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org UUID; v_status TEXT; v_bin_ids UUID[]; v_n INTEGER;
BEGIN
  SELECT organisation_id, status INTO v_org, v_status
    FROM warehouse_cycle_count_batches WHERE id = p_batch_id;
  IF v_org IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Batch not found'); END IF;
  IF NOT EXISTS (SELECT 1 FROM user_organisations uo WHERE uo.organisation_id = v_org AND uo.user_id = auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not a member of this organisation');
  END IF;
  IF v_status NOT IN ('scheduled','in_progress') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only scheduled/in-progress batches can freeze scope');
  END IF;

  v_bin_ids := ARRAY(
    SELECT DISTINCT bi.bin_id FROM warehouse_cycle_count_items bi WHERE bi.batch_id = p_batch_id
  );
  UPDATE warehouse_bins SET status = 'cycle_count', updated_at = now()
   WHERE id = ANY(v_bin_ids) AND status NOT IN ('cycle_count','inactive');
  GET DIAGNOSTICS v_n = ROW_COUNT;

  UPDATE warehouse_cycle_count_batches
     SET frozen_bins = (SELECT count(*) FROM warehouse_bins WHERE id = ANY(v_bin_ids)),
         status = 'in_progress', started_at = now(), started_by = p_operator_id,
         updated_at = now()
   WHERE id = p_batch_id;

  RETURN jsonb_build_object('ok', true, 'frozen', v_n);
END;
$$;

CREATE OR REPLACE FUNCTION unfreeze_cycle_scope(
  p_batch_id UUID,
  p_operator_id UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org UUID; v_bin_ids UUID[];
BEGIN
  SELECT organisation_id INTO v_org FROM warehouse_cycle_count_batches WHERE id = p_batch_id;
  IF v_org IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Batch not found'); END IF;
  IF NOT EXISTS (SELECT 1 FROM user_organisations uo WHERE uo.organisation_id = v_org AND uo.user_id = auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not a member of this organisation');
  END IF;
  v_bin_ids := ARRAY(
    SELECT DISTINCT bi.bin_id FROM warehouse_cycle_count_items bi WHERE bi.batch_id = p_batch_id
  );
  UPDATE warehouse_bins SET status = 'available', updated_at = now()
   WHERE id = ANY(v_bin_ids) AND status = 'cycle_count';
  UPDATE warehouse_cycle_count_batches SET updated_at = now() WHERE id = p_batch_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. Submit a blind count for one line. Computes variance, derives status.
--    Blind: counted_qty is written; expected_qty is NOT returned for the
--    same line (see fetch below) until after counting.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION submit_cycle_count_item(
  p_item_id UUID,
  p_counted_qty NUMERIC,
  p_operator_id UUID,
  p_investigation_note TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org UUID; v_expected NUMERIC; v_variance NUMERIC;
BEGIN
  SELECT organisation_id, expected_qty INTO v_org, v_expected
    FROM warehouse_cycle_count_items WHERE id = p_item_id;
  IF v_org IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Count item not found'); END IF;
  IF NOT EXISTS (SELECT 1 FROM user_organisations uo WHERE uo.organisation_id = v_org AND uo.user_id = auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not a member of this organisation');
  END IF;

  v_variance := p_counted_qty - v_expected;
  UPDATE warehouse_cycle_count_items
     SET counted_qty = p_counted_qty,
         variance = v_variance,
         status = CASE WHEN v_variance = 0 THEN 'matched' ELSE 'variance' END,
         investigation_note = COALESCE(p_investigation_note, investigation_note),
         counted_at = now(), counted_by = p_operator_id, updated_at = now()
   WHERE id = p_item_id;

  -- Track variance count on the batch.
  UPDATE warehouse_cycle_count_batches b SET
    variance_count = (SELECT count(*) FROM warehouse_cycle_count_items i
                      WHERE i.batch_id = b.id AND i.status = 'variance'),
    updated_at = now()
   WHERE b.id = (SELECT batch_id FROM warehouse_cycle_count_items WHERE id = p_item_id);

  RETURN jsonb_build_object('ok', true, 'variance', v_variance,
                            'status', CASE WHEN v_variance = 0 THEN 'matched' ELSE 'variance' END);
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. Approve the batch — every variance line is adjusted THROUGH the
--    Movement Engine (sign-encoded 'adjust' rows, reference cycle_count).
--    Approved zero-variance lines are marked adjusted too (no movement row,
--    stock unchanged) so the batch reads complete.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION approve_cycle_count_batch(
  p_batch_id UUID,
  p_operator_id UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org UUID; v_status TEXT; v_adjusted INTEGER := 0; v_skipped INTEGER := 0;
  v_row RECORD; v_live_qty NUMERIC; v_existing UUID; v_delta NUMERIC;
BEGIN
  SELECT organisation_id, status INTO v_org, v_status
    FROM warehouse_cycle_count_batches WHERE id = p_batch_id;
  IF v_org IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Batch not found'); END IF;
  IF NOT EXISTS (SELECT 1 FROM user_organisations uo WHERE uo.organisation_id = v_org AND uo.user_id = auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not a member of this organisation');
  END IF;
  IF v_status <> 'in_progress' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only in-progress batches can be approved');
  END IF;
  IF EXISTS (SELECT 1 FROM warehouse_cycle_count_items i
             WHERE i.batch_id = p_batch_id AND i.status = 'pending') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'All lines must be counted before approval');
  END IF;

  FOR v_row IN
    SELECT i.id, i.bin_id, i.item_id, i.expected_qty, i.counted_qty, i.variance, i.status
      FROM warehouse_cycle_count_items i
     WHERE i.batch_id = p_batch_id
       AND i.status <> 'adjusted'
     ORDER BY i.id
  LOOP
    IF v_row.status = 'matched' OR v_row.variance = 0 THEN
      UPDATE warehouse_cycle_count_items SET status = 'adjusted', adjusted_at = now(), adjusted_by = p_operator_id, updated_at = now()
       WHERE id = v_row.id;
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    -- Live qty currently in the bin for this item (movement-engine source of truth).
    SELECT COALESCE(SUM(quantity), 0) INTO v_live_qty
      FROM warehouse_bin_items
     WHERE bin_id = v_row.bin_id AND item_id IS NOT DISTINCT FROM v_row.item_id AND deleted_at IS NULL;

    -- v_delta = counted − live: if counted 30 but live 20, we must ADD 10.
    v_delta := v_row.counted_qty - v_live_qty;

    IF v_delta = 0 THEN
      UPDATE warehouse_cycle_count_items SET status = 'adjusted', adjusted_at = now(), adjusted_by = p_operator_id, updated_at = now()
       WHERE id = v_row.id;
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    IF v_delta > 0 THEN
      -- Surplus: upsert the live row to counted qty (movement engine handles capacity).
      SELECT id INTO v_existing
        FROM warehouse_bin_items
       WHERE bin_id = v_row.bin_id AND item_id IS NOT DISTINCT FROM v_row.item_id AND deleted_at IS NULL
       LIMIT 1;
      IF v_existing IS NULL THEN
        INSERT INTO warehouse_bin_items
          (organisation_id, bin_id, item_id, quantity, created_by, updated_by)
        VALUES (v_org, v_row.bin_id, v_row.item_id, v_row.counted_qty, p_operator_id, p_operator_id);
      ELSE
        UPDATE warehouse_bin_items
           SET quantity = v_row.counted_qty, updated_by = p_operator_id, updated_at = now()
         WHERE id = v_existing;
      END IF;
      INSERT INTO warehouse_movements
        (organisation_id, movement_type, reference_type, reference_id, item_id,
         destination_bin_id, quantity, operator_id, device, remarks)
      VALUES
        (v_org, 'adjust', 'cycle_count', p_batch_id::TEXT, v_row.item_id,
         v_row.bin_id, v_delta, p_operator_id, 'web',
         'Cycle count surplus correction (' || p_batch_id || ')');
    ELSE
      -- Shortage: decrement the live row, soft-delete when it crosses zero.
      UPDATE warehouse_bin_items
         SET quantity = GREATEST(0, quantity + v_delta),
             updated_by = p_operator_id, updated_at = now(),
             deleted_at = CASE WHEN quantity + v_delta <= 0 THEN now() ELSE deleted_at END
       WHERE bin_id = v_row.bin_id AND item_id IS NOT DISTINCT FROM v_row.item_id AND deleted_at IS NULL;
      INSERT INTO warehouse_movements
        (organisation_id, movement_type, reference_type, reference_id, item_id,
         source_bin_id, quantity, operator_id, device, remarks)
      VALUES
        (v_org, 'adjust', 'cycle_count', p_batch_id::TEXT, v_row.item_id,
         v_row.bin_id, v_delta, p_operator_id, 'web',
         'Cycle count shortage correction (' || p_batch_id || ')');
    END IF;

    UPDATE warehouse_cycle_count_items SET status = 'adjusted', adjusted_at = now(), adjusted_by = p_operator_id, updated_at = now()
     WHERE id = v_row.id;
    v_adjusted := v_adjusted + 1;
  END LOOP;

  UPDATE warehouse_cycle_count_batches
     SET status = 'completed', completed_at = now(), completed_by = p_operator_id,
         approval_status = 'approved', approved_at = now(), approved_by = p_operator_id,
         variance_count = 0, updated_at = now()
   WHERE id = p_batch_id;

  -- Unfreeze the counted bins.
  UPDATE warehouse_bins SET status = 'available', updated_at = now()
   WHERE id IN (SELECT DISTINCT bi.bin_id FROM warehouse_cycle_count_items bi WHERE bi.batch_id = p_batch_id)
     AND status = 'cycle_count';

  RETURN jsonb_build_object('ok', true, 'adjusted', v_adjusted, 'matched', v_skipped);
END;
$$;

-- ---------------------------------------------------------------------------
-- 8. Cancel a batch — releases the freeze, no adjustments.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION cancel_cycle_count_batch(
  p_batch_id UUID,
  p_operator_id UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org UUID; v_status TEXT;
BEGIN
  SELECT organisation_id, status INTO v_org, v_status
    FROM warehouse_cycle_count_batches WHERE id = p_batch_id;
  IF v_org IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Batch not found'); END IF;
  IF NOT EXISTS (SELECT 1 FROM user_organisations uo WHERE uo.organisation_id = v_org AND uo.user_id = auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not a member of this organisation');
  END IF;
  IF v_status = 'completed' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Completed batches cannot be cancelled');
  END IF;
  UPDATE warehouse_cycle_count_batches
     SET status = 'cancelled', updated_at = now()
   WHERE id = p_batch_id;
  UPDATE warehouse_bins SET status = 'available', updated_at = now()
   WHERE id IN (SELECT DISTINCT bi.bin_id FROM warehouse_cycle_count_items bi WHERE bi.batch_id = p_batch_id)
     AND status = 'cycle_count';
  RETURN jsonb_build_object('ok', true);
END;
$$;
