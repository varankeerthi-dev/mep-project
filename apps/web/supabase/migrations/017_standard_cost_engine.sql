-- ============================================================
-- MANUFACTURING ENGINE V2 — PHASE 4C & 4D: STANDARD COST ENGINE & HISTORICAL AUDIT RUNS
-- Migration: 017_standard_cost_engine.sql
-- Date: August 13, 2026
-- ============================================================

-- 1. Standard Cost Calculation Runs (Audit Header for Rollup Batches)
CREATE TABLE IF NOT EXISTS standard_cost_calculation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'running', -- running | completed | failed
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  items_processed INT NOT NULL DEFAULT 0,
  initiated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  error_log TEXT
);

ALTER TABLE standard_cost_calculation_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for standard_cost_calculation_runs" ON standard_cost_calculation_runs;
CREATE POLICY "Enable all access for standard_cost_calculation_runs" ON standard_cost_calculation_runs FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_std_cost_runs_org ON standard_cost_calculation_runs(organisation_id);

-- 2. Historical Item Standard Costs Table (Dual Prime vs Full Cost Storage)
CREATE TABLE IF NOT EXISTS item_standard_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
  bom_id UUID REFERENCES bom_headers(id) ON DELETE SET NULL,
  bom_revision VARCHAR(20),
  prime_standard_cost NUMERIC(15,4) NOT NULL DEFAULT 0.0000,
  overhead_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  full_standard_cost NUMERIC(15,4) NOT NULL DEFAULT 0.0000,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_to TIMESTAMPTZ,
  calculation_run_id UUID REFERENCES standard_cost_calculation_runs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE item_standard_costs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for item_standard_costs" ON item_standard_costs;
CREATE POLICY "Enable all access for item_standard_costs" ON item_standard_costs FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_item_std_costs_mat_org ON item_standard_costs(material_id, organisation_id);
CREATE INDEX IF NOT EXISTS idx_item_std_costs_effective ON item_standard_costs(material_id, effective_from, effective_to);

-- 3. Helper Function to Get Current Active Prime Standard Cost for an Item
CREATE OR REPLACE FUNCTION get_active_prime_standard_cost(
  p_material_id UUID,
  p_as_of_date TIMESTAMPTZ DEFAULT now()
) RETURNS NUMERIC
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cost NUMERIC;
BEGIN
  SELECT prime_standard_cost INTO v_cost
  FROM item_standard_costs
  WHERE material_id = p_material_id
    AND effective_from <= p_as_of_date
    AND (effective_to IS NULL OR effective_to >= p_as_of_date)
  ORDER BY effective_from DESC
  LIMIT 1;

  IF v_cost IS NULL THEN
    -- Fallback to materials.unit_cost if standard cost record has not been calculated yet
    SELECT COALESCE(unit_cost, 0) INTO v_cost
    FROM materials
    WHERE id = p_material_id;
  END IF;

  RETURN COALESCE(v_cost, 0);
END;
$$;
