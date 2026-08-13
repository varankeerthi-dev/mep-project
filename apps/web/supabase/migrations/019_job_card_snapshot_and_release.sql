-- ============================================================
-- MANUFACTURING ENGINE V2 — PHASE 4G: RELEASED JOB CARD IMMUTABLE BOM SNAPSHOT
-- Migration: 019_job_card_snapshot_and_release.sql
-- Date: August 13, 2026
-- ============================================================

-- 1. Add BOM Snapshot and release metadata to job_cards
ALTER TABLE job_cards
  ADD COLUMN IF NOT EXISTS bom_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS released_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Atomic Release Job Card RPC (Freezes Immutable BOM Snapshot)
CREATE OR REPLACE FUNCTION release_job_card(
  p_job_card_id UUID,
  p_org_id UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jc RECORD;
  v_bom RECORD;
  v_items JSONB[] := ARRAY[]::JSONB[];
  v_ops JSONB[] := ARRAY[]::JSONB[];
  v_costs JSONB[] := ARRAY[]::JSONB[];
  v_item RECORD;
  v_op RECORD;
  v_cost RECORD;
  v_std_cost RECORD;
  v_snapshot JSONB;
BEGIN
  -- 1. Verify user membership
  IF NOT EXISTS (
    SELECT 1 FROM user_organisations
    WHERE organisation_id = p_org_id AND user_id = auth.uid() AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not an active member of this organisation');
  END IF;

  -- 2. Lock Job Card FOR UPDATE
  SELECT id, job_card_no, bom_id, planned_qty, status, organisation_id
  INTO v_jc
  FROM job_cards
  WHERE id = p_job_card_id
  FOR UPDATE;

  IF v_jc.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Job Card not found');
  END IF;

  IF v_jc.organisation_id != p_org_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Organisation mismatch');
  END IF;

  -- 3. Idempotency Check: if already released or beyond, return success
  IF v_jc.status IN ('issued', 'in_progress', 'completed') THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_processed', true,
      'message', 'Job Card is already released with a frozen BOM snapshot.',
      'job_card_id', p_job_card_id
    );
  END IF;

  -- 4. Load BOM Header
  SELECT id, bom_code, product_name, product_id, output_qty, output_unit, revision, effective_date, valid_to, COALESCE(overhead_percentage, 0) AS overhead_percentage
  INTO v_bom
  FROM bom_headers
  WHERE id = v_jc.bom_id;

  IF v_bom.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Referenced BOM not found');
  END IF;

  -- 5. Collect BOM Items
  FOR v_item IN
    SELECT bi.id, bi.material_id, m.name AS material_name, bi.required_qty, bi.unit, COALESCE(bi.wastage_pct, 0) AS wastage_pct, COALESCE(m.unit_cost, 0) AS unit_cost
    FROM bom_items bi
    JOIN materials m ON m.id = bi.material_id
    WHERE bi.bom_id = v_jc.bom_id
  LOOP
    v_items := ARRAY_APPEND(v_items, jsonb_build_object(
      'id', v_item.id,
      'material_id', v_item.material_id,
      'material_name', v_item.material_name,
      'required_qty', v_item.required_qty,
      'unit', v_item.unit,
      'wastage_pct', v_item.wastage_pct,
      'unit_cost', v_item.unit_cost,
      'effective_unit_qty', ROUND((v_item.required_qty / NULLIF(v_bom.output_qty, 0)) * (1.0 + (v_item.wastage_pct / 100.0)), 4)
    ));
  END LOOP;

  -- 6. Collect Routing Operations
  FOR v_op IN
    SELECT ro.id, ro.sequence_no, ro.operation_name, ro.work_center_id, wc.name AS work_center_name,
           ro.setup_time_minutes, ro.cycle_time_minutes,
           COALESCE(ro.machine_rate_per_hour, wc.machine_rate_per_hour, 0) AS machine_rate,
           COALESCE(ro.labor_rate_per_hour, wc.labor_rate_per_hour, 0) AS labor_rate,
           ro.is_subcontract, ro.subcontract_rate_per_unit
    FROM bom_routing_operations ro
    LEFT JOIN work_centers wc ON wc.id = ro.work_center_id
    WHERE ro.bom_id = v_jc.bom_id
    ORDER BY ro.sequence_no ASC
  LOOP
    v_ops := ARRAY_APPEND(v_ops, jsonb_build_object(
      'id', v_op.id,
      'sequence_no', v_op.sequence_no,
      'operation_name', v_op.operation_name,
      'work_center_id', v_op.work_center_id,
      'work_center_name', v_op.work_center_name,
      'setup_time_minutes', v_op.setup_time_minutes,
      'cycle_time_minutes', v_op.cycle_time_minutes,
      'machine_rate_per_hour', v_op.machine_rate,
      'labor_rate_per_hour', v_op.labor_rate,
      'is_subcontract', v_op.is_subcontract,
      'subcontract_rate_per_unit', v_op.subcontract_rate_per_unit
    ));
  END LOOP;

  -- 7. Collect Flat Cost Lines
  FOR v_cost IN
    SELECT cl.id, cl.description, cl.amount, m.name AS material_name
    FROM bom_cost_lines cl
    LEFT JOIN materials m ON m.id = cl.material_id
    WHERE cl.bom_id = v_jc.bom_id
  LOOP
    v_costs := ARRAY_APPEND(v_costs, jsonb_build_object(
      'id', v_cost.id,
      'description', v_cost.description,
      'material_name', v_cost.material_name,
      'amount', v_cost.amount
    ));
  END LOOP;

  -- 8. Collect Current Active Standard Cost
  SELECT prime_standard_cost, overhead_amount, full_standard_cost
  INTO v_std_cost
  FROM item_standard_costs
  WHERE material_id = v_bom.product_id
    AND effective_from <= NOW()
    AND (effective_to IS NULL OR effective_to >= NOW())
  ORDER BY effective_from DESC
  LIMIT 1;

  -- 9. Construct Complete Immutable BOM Snapshot
  v_snapshot := jsonb_build_object(
    'bom_id', v_bom.id,
    'bom_code', v_bom.bom_code,
    'product_name', v_bom.product_name,
    'product_id', v_bom.product_id,
    'revision', v_bom.revision,
    'effective_date', v_bom.effective_date,
    'output_qty', v_bom.output_qty,
    'output_unit', v_bom.output_unit,
    'overhead_percentage', v_bom.overhead_percentage,
    'items', to_jsonb(v_items),
    'routing_operations', to_jsonb(v_ops),
    'cost_lines', to_jsonb(v_costs),
    'standard_cost', jsonb_build_object(
      'prime_standard_cost', COALESCE(v_std_cost.prime_standard_cost, 0),
      'overhead_amount', COALESCE(v_std_cost.overhead_amount, 0),
      'full_standard_cost', COALESCE(v_std_cost.full_standard_cost, 0)
    ),
    'frozen_at', NOW()
  );

  -- 10. Update Job Card with frozen snapshot and transition status to 'issued'
  UPDATE job_cards
  SET status = 'issued',
      bom_snapshot = v_snapshot,
      released_at = NOW(),
      released_by = auth.uid(),
      updated_at = NOW()
  WHERE id = p_job_card_id;

  -- 11. Log activity
  INSERT INTO manufacturing_activity_log (
    entity_type, entity_id, action, action_details, user_id, organisation_id
  ) VALUES (
    'job_card', p_job_card_id, 'released',
    jsonb_build_object(
      'job_card_no', v_jc.job_card_no,
      'bom_code', v_bom.bom_code,
      'revision', v_bom.revision
    ),
    auth.uid(), p_org_id
  );

  RETURN jsonb_build_object(
    'ok', true,
    'already_processed', false,
    'job_card_id', p_job_card_id,
    'status', 'issued',
    'bom_revision', v_bom.revision
  );
END;
$$;
