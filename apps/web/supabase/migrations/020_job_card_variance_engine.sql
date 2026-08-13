-- ============================================================
-- MANUFACTURING ENGINE V2 — PHASE 4H & 4I: ACTUAL COSTING & 5-BUCKET VARIANCE ENGINE
-- Migration: 020_job_card_variance_engine.sql
-- Date: August 13, 2026
-- ============================================================

-- 1. Add actual tracking fields to job_cards
ALTER TABLE job_cards
  ADD COLUMN IF NOT EXISTS actual_labor_hours NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS actual_machine_hours NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS actual_subcontract_cost NUMERIC(15,2) NOT NULL DEFAULT 0.00;

-- 2. Create Job Card Cost Variances Table
CREATE TABLE IF NOT EXISTS job_card_cost_variances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_card_id UUID NOT NULL REFERENCES job_cards(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  standard_material_cost NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  actual_material_cost NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  material_variance NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  standard_labor_cost NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  actual_labor_cost NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  labor_variance NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  standard_machine_cost NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  actual_machine_cost NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  machine_variance NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  standard_subcontract_cost NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  actual_subcontract_cost NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  subcontract_variance NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  standard_overhead_cost NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  actual_overhead_cost NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  overhead_variance NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  total_standard_cost NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  total_actual_cost NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  total_variance NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_variance_per_job_card UNIQUE (job_card_id)
);

ALTER TABLE job_card_cost_variances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for job_card_cost_variances" ON job_card_cost_variances;
CREATE POLICY "Enable all access for job_card_cost_variances" ON job_card_cost_variances FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_job_card_variances_jc ON job_card_cost_variances(job_card_id);
CREATE INDEX IF NOT EXISTS idx_job_card_variances_org ON job_card_cost_variances(organisation_id);

-- 3. Atomic Idempotent 5-Bucket Variance Calculator RPC
CREATE OR REPLACE FUNCTION calculate_job_card_variances(
  p_job_card_id UUID,
  p_org_id UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jc RECORD;
  v_snapshot JSONB;
  v_output_qty NUMERIC;
  v_completed_qty NUMERIC;
  v_scale NUMERIC;

  v_std_mat NUMERIC := 0;
  v_std_lab NUMERIC := 0;
  v_std_mach NUMERIC := 0;
  v_std_sub NUMERIC := 0;
  v_std_ovhd NUMERIC := 0;
  v_std_total NUMERIC := 0;

  v_act_mat NUMERIC := 0;
  v_act_lab NUMERIC := 0;
  v_act_mach NUMERIC := 0;
  v_act_sub NUMERIC := 0;
  v_act_ovhd NUMERIC := 0;
  v_act_total NUMERIC := 0;

  v_var_mat NUMERIC := 0;
  v_var_lab NUMERIC := 0;
  v_var_mach NUMERIC := 0;
  v_var_sub NUMERIC := 0;
  v_var_ovhd NUMERIC := 0;
  v_var_total NUMERIC := 0;

  v_routing_calc JSONB;
  v_item JSONB;
  v_ovhd_pct NUMERIC := 0;
  v_avg_mach_rate NUMERIC := 0;
  v_avg_lab_rate NUMERIC := 0;
BEGIN
  -- 1. Lock Job Card FOR UPDATE
  SELECT id, job_card_no, bom_id, planned_qty, COALESCE(actual_qty, planned_qty, 1) AS completed_qty,
         actual_labor_hours, actual_machine_hours, actual_subcontract_cost,
         bom_snapshot, status, organisation_id
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

  v_snapshot := v_jc.bom_snapshot;
  IF v_snapshot IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Job Card has no released BOM snapshot');
  END IF;

  v_completed_qty := GREATEST(COALESCE(v_jc.completed_qty, 1), 0.0001);
  v_output_qty := GREATEST(COALESCE((v_snapshot ->> 'output_qty')::NUMERIC, 1), 0.0001);
  v_scale := v_completed_qty / v_output_qty;
  v_ovhd_pct := COALESCE((v_snapshot ->> 'overhead_percentage')::NUMERIC, 0);

  -- 2. Compute Standard Baseline Costs from Frozen Snapshot
  -- Material Standard Cost
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_snapshot -> 'items') LOOP
    v_std_mat := v_std_mat + ROUND(
      ((v_item ->> 'required_qty')::NUMERIC * (1.0 + (COALESCE((v_item ->> 'wastage_pct')::NUMERIC, 0) / 100.0)))
      * COALESCE((v_item ->> 'unit_cost')::NUMERIC, 0) * v_scale, 2
    );
  END LOOP;

  -- Routing Standard Costs
  v_routing_calc := calculate_routing_cost(v_jc.bom_id, v_completed_qty);
  v_std_mach := COALESCE((v_routing_calc ->> 'total_machine_cost')::NUMERIC, 0);
  v_std_lab  := COALESCE((v_routing_calc ->> 'labor_cost')::NUMERIC, 0);
  v_std_sub  := COALESCE((v_routing_calc ->> 'subcontract_operation_cost')::NUMERIC, 0);

  -- Consumables Flat Cost
  DECLARE
    v_consumables_flat NUMERIC := 0;
    v_c JSONB;
  BEGIN
    FOR v_c IN SELECT * FROM jsonb_array_elements(v_snapshot -> 'cost_lines') LOOP
      v_consumables_flat := v_consumables_flat + COALESCE((v_c ->> 'amount')::NUMERIC, 0);
    END LOOP;

    -- Standard Overhead
    v_std_ovhd := ROUND((v_std_mat + v_std_mach + v_std_lab + (v_consumables_flat * v_scale)) * (v_ovhd_pct / 100.0), 2);
  END;

  v_std_total := v_std_mat + v_std_mach + v_std_lab + v_std_sub + v_std_ovhd;

  -- 3. Compute Actual Production Costs
  -- Actual Material Cost from job_card_materials consumed_qty * unit_cost
  SELECT ROUND(COALESCE(SUM(jcm.consumed_qty * COALESCE(m.unit_cost, 0)), 0), 2)
  INTO v_act_mat
  FROM job_card_materials jcm
  JOIN materials m ON m.id = jcm.material_id
  WHERE jcm.job_card_id = p_job_card_id;

  -- Work center average hourly rates for actual labor & machine costing
  SELECT COALESCE(AVG(machine_rate_per_hour), 0), COALESCE(AVG(labor_rate_per_hour), 0)
  INTO v_avg_mach_rate, v_avg_lab_rate
  FROM work_centers
  WHERE organisation_id = p_org_id AND is_active = true;

  v_act_mach := ROUND(COALESCE(v_jc.actual_machine_hours, 0) * v_avg_mach_rate, 2);
  v_act_lab  := ROUND(COALESCE(v_jc.actual_labor_hours, 0) * v_avg_lab_rate, 2);
  v_act_sub  := ROUND(COALESCE(v_jc.actual_subcontract_cost, 0), 2);
  v_act_ovhd := ROUND((v_act_mat + v_act_mach + v_act_lab) * (v_ovhd_pct / 100.0), 2);
  v_act_total := v_act_mat + v_act_mach + v_act_lab + v_act_sub + v_act_ovhd;

  -- 4. Calculate Variances (Actual - Standard)
  v_var_mat   := v_act_mat - v_std_mat;
  v_var_lab   := v_act_lab - v_std_lab;
  v_var_mach  := v_act_mach - v_std_mach;
  v_var_sub   := v_act_sub - v_std_sub;
  v_var_ovhd  := v_act_ovhd - v_std_ovhd;
  v_var_total := v_act_total - v_std_total;

  -- 5. Idempotent Upsert into job_card_cost_variances
  INSERT INTO job_card_cost_variances (
    job_card_id, organisation_id,
    standard_material_cost, actual_material_cost, material_variance,
    standard_labor_cost, actual_labor_cost, labor_variance,
    standard_machine_cost, actual_machine_cost, machine_variance,
    standard_subcontract_cost, actual_subcontract_cost, subcontract_variance,
    standard_overhead_cost, actual_overhead_cost, overhead_variance,
    total_standard_cost, actual_total_cost, total_variance
  ) VALUES (
    p_job_card_id, p_org_id,
    v_std_mat, v_act_mat, v_var_mat,
    v_std_lab, v_act_lab, v_var_lab,
    v_std_mach, v_act_mach, v_var_mach,
    v_std_sub, v_act_sub, v_var_sub,
    v_std_ovhd, v_act_ovhd, v_var_ovhd,
    v_std_total, v_act_total, v_var_total
  )
  ON CONFLICT (job_card_id) DO UPDATE SET
    standard_material_cost = EXCLUDED.standard_material_cost,
    actual_material_cost = EXCLUDED.actual_material_cost,
    material_variance = EXCLUDED.material_variance,
    standard_labor_cost = EXCLUDED.standard_labor_cost,
    actual_labor_cost = EXCLUDED.actual_labor_cost,
    labor_variance = EXCLUDED.labor_variance,
    standard_machine_cost = EXCLUDED.standard_machine_cost,
    actual_machine_cost = EXCLUDED.actual_machine_cost,
    machine_variance = EXCLUDED.machine_variance,
    standard_subcontract_cost = EXCLUDED.standard_subcontract_cost,
    actual_subcontract_cost = EXCLUDED.actual_subcontract_cost,
    subcontract_variance = EXCLUDED.subcontract_variance,
    standard_overhead_cost = EXCLUDED.standard_overhead_cost,
    actual_overhead_cost = EXCLUDED.actual_overhead_cost,
    overhead_variance = EXCLUDED.overhead_variance,
    total_standard_cost = EXCLUDED.total_standard_cost,
    actual_total_cost = EXCLUDED.actual_total_cost,
    total_variance = EXCLUDED.total_variance,
    created_at = NOW();

  RETURN jsonb_build_object(
    'ok', true,
    'job_card_id', p_job_card_id,
    'standard_total', v_std_total,
    'actual_total', v_act_total,
    'total_variance', v_var_total,
    'material_variance', v_var_mat,
    'labor_variance', v_var_lab,
    'machine_variance', v_var_mach,
    'subcontract_variance', v_var_sub,
    'overhead_variance', v_var_ovhd
  );
END;
$$;
