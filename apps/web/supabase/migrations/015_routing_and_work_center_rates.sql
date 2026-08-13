-- ============================================================
-- MANUFACTURING ENGINE V2 — PHASE 4B: ROUTING & CONVERSION COSTING
-- Migration: 015_routing_and_work_center_rates.sql
-- Date: August 13, 2026
-- ============================================================

-- 1. Add cost rates to work_centers
ALTER TABLE work_centers
  ADD COLUMN IF NOT EXISTS machine_rate_per_hour NUMERIC(15,4) NOT NULL DEFAULT 0.0000,
  ADD COLUMN IF NOT EXISTS labor_rate_per_hour NUMERIC(15,4) NOT NULL DEFAULT 0.0000;

-- 2. Multi-operation routing table
CREATE TABLE IF NOT EXISTS bom_routing_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_id UUID NOT NULL REFERENCES bom_headers(id) ON DELETE CASCADE,
  sequence_no INT NOT NULL DEFAULT 1,
  operation_name TEXT NOT NULL,
  work_center_id UUID REFERENCES work_centers(id) ON DELETE RESTRICT,
  setup_time_minutes NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  cycle_time_minutes NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  machine_rate_per_hour NUMERIC(15,4),
  labor_rate_per_hour NUMERIC(15,4),
  is_subcontract BOOLEAN NOT NULL DEFAULT false,
  subcontract_rate_per_unit NUMERIC(15,4) NOT NULL DEFAULT 0.0000,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE bom_routing_operations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for bom_routing_operations" ON bom_routing_operations;
CREATE POLICY "Enable all access for bom_routing_operations" ON bom_routing_operations FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_bom_routing_ops_bom_id ON bom_routing_operations(bom_id);
CREATE INDEX IF NOT EXISTS idx_bom_routing_ops_org_id ON bom_routing_operations(organisation_id);

-- 3. Conversion Cost Calculator Function
-- Correct batch formula:
--   Setup Machine Cost = (setup_time_minutes / 60.0) * machine_rate_per_hour (one-time per batch)
--   Run Machine Cost   = (cycle_time_minutes / 60.0) * batch_qty * machine_rate_per_hour
--   Labor Cost         = ((setup_time_minutes + cycle_time_minutes * batch_qty) / 60.0) * labor_rate_per_hour
--   Subcontract Cost   = subcontract_rate_per_unit * batch_qty (excluded from overhead base)
CREATE OR REPLACE FUNCTION calculate_routing_cost(
  p_bom_id UUID,
  p_batch_qty NUMERIC DEFAULT 1
) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_effective_batch_qty NUMERIC;
  v_op RECORD;
  v_mach_rate NUMERIC;
  v_lab_rate NUMERIC;
  v_setup_mach_cost NUMERIC := 0;
  v_run_mach_cost NUMERIC := 0;
  v_lab_cost NUMERIC := 0;
  v_subcontract_cost NUMERIC := 0;
  v_total_inhouse_op_cost NUMERIC := 0;
  v_total_subcontract_op_cost NUMERIC := 0;
  v_total_op_cost NUMERIC := 0;
  v_op_details JSONB[] := ARRAY[]::JSONB[];
BEGIN
  v_effective_batch_qty := GREATEST(COALESCE(p_batch_qty, 1), 0.0001);

  FOR v_op IN
    SELECT ro.*, wc.machine_rate_per_hour AS wc_mach_rate, wc.labor_rate_per_hour AS wc_lab_rate
    FROM bom_routing_operations ro
    LEFT JOIN work_centers wc ON wc.id = ro.work_center_id
    WHERE ro.bom_id = p_bom_id
    ORDER BY ro.sequence_no ASC
  LOOP
    IF v_op.is_subcontract THEN
      DECLARE
        v_sub_cost NUMERIC := ROUND(COALESCE(v_op.subcontract_rate_per_unit, 0) * v_effective_batch_qty, 2);
      BEGIN
        v_subcontract_cost := v_subcontract_cost + v_sub_cost;
        v_total_subcontract_op_cost := v_total_subcontract_op_cost + v_sub_cost;
        v_op_details := ARRAY_APPEND(v_op_details, jsonb_build_object(
          'id', v_op.id,
          'sequence_no', v_op.sequence_no,
          'operation_name', v_op.operation_name,
          'is_subcontract', true,
          'subcontract_rate_per_unit', v_op.subcontract_rate_per_unit,
          'total_cost', v_sub_cost
        ));
      END;
    ELSE
      v_mach_rate := COALESCE(v_op.machine_rate_per_hour, v_op.wc_mach_rate, 0);
      v_lab_rate  := COALESCE(v_op.labor_rate_per_hour, v_op.wc_lab_rate, 0);

      DECLARE
        v_op_setup_mach NUMERIC := ROUND((COALESCE(v_op.setup_time_minutes, 0) / 60.0) * v_mach_rate, 4);
        v_op_run_mach   NUMERIC := ROUND((COALESCE(v_op.cycle_time_minutes, 0) / 60.0) * v_effective_batch_qty * v_mach_rate, 4);
        v_op_lab        NUMERIC := ROUND(((COALESCE(v_op.setup_time_minutes, 0) + COALESCE(v_op.cycle_time_minutes, 0) * v_effective_batch_qty) / 60.0) * v_lab_rate, 4);
        v_op_total      NUMERIC := ROUND(v_op_setup_mach + v_op_run_mach + v_op_lab, 2);
      BEGIN
        v_setup_mach_cost := v_setup_mach_cost + v_op_setup_mach;
        v_run_mach_cost   := v_run_mach_cost + v_op_run_mach;
        v_lab_cost        := v_lab_cost + v_op_lab;
        v_total_inhouse_op_cost := v_total_inhouse_op_cost + v_op_total;

        v_op_details := ARRAY_APPEND(v_op_details, jsonb_build_object(
          'id', v_op.id,
          'sequence_no', v_op.sequence_no,
          'operation_name', v_op.operation_name,
          'is_subcontract', false,
          'setup_machine_cost', v_op_setup_mach,
          'run_machine_cost', v_op_run_mach,
          'labor_cost', v_op_lab,
          'total_cost', v_op_total
        ));
      END;
    END IF;
  END LOOP;

  v_total_op_cost := v_total_inhouse_op_cost + v_total_subcontract_op_cost;

  RETURN jsonb_build_object(
    'batch_qty', v_effective_batch_qty,
    'setup_machine_cost', ROUND(v_setup_mach_cost, 2),
    'run_machine_cost', ROUND(v_run_mach_cost, 2),
    'total_machine_cost', ROUND(v_setup_mach_cost + v_run_mach_cost, 2),
    'labor_cost', ROUND(v_lab_cost, 2),
    'inhouse_operation_cost', ROUND(v_total_inhouse_op_cost, 2),
    'subcontract_operation_cost', ROUND(v_total_subcontract_op_cost, 2),
    'total_operation_cost', ROUND(v_total_op_cost, 2),
    'operations', to_jsonb(v_op_details)
  );
END;
$$;
