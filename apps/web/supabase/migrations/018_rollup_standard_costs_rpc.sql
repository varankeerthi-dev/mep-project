-- ============================================================
-- MANUFACTURING ENGINE V2 — PHASE 4C/4D/4E/4F: POST-ORDER ATOMIC COST ROLLUP RPC
-- Migration: 018_rollup_standard_costs_rpc.sql
-- Date: August 13, 2026
-- ============================================================

CREATE OR REPLACE FUNCTION rollup_item_standard_cost(
  p_material_id UUID,
  p_org_id UUID,
  p_run_id UUID DEFAULT NULL,
  p_production_date DATE DEFAULT CURRENT_DATE,
  p_visited_ids UUID[] DEFAULT ARRAY[]::UUID[]
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bom_id UUID;
  v_bom RECORD;
  v_item RECORD;
  v_child_prime_cost NUMERIC := 0;
  v_child_rollup_res JSONB;
  v_line_effective_qty NUMERIC;
  v_line_cost NUMERIC;
  v_total_material_cost NUMERIC := 0;

  v_routing_res JSONB;
  v_inhouse_conversion_cost NUMERIC := 0;
  v_subcontract_cost NUMERIC := 0;

  v_consumables_cost NUMERIC := 0;

  v_overhead_base NUMERIC := 0;
  v_overhead_percentage NUMERIC := 0;
  v_overhead_amount NUMERIC := 0;

  v_prime_standard_cost NUMERIC := 0;
  v_full_standard_cost NUMERIC := 0;

  v_new_cost_id UUID;
BEGIN
  -- 1. Circular BOM detection guard
  IF p_material_id = ANY(p_visited_ids) THEN
    RAISE EXCEPTION 'Circular BOM dependency detected at material % during standard cost rollup', p_material_id;
  END IF;

  -- 2. Resolve active published BOM for material at p_production_date
  v_bom_id := resolve_subassembly_bom(p_material_id, p_production_date);

  -- 3. Leaf item handling (Purchased Raw Material / Component without active BOM)
  IF v_bom_id IS NULL THEN
    SELECT COALESCE(unit_cost, 0) INTO v_prime_standard_cost
    FROM materials
    WHERE id = p_material_id;

    v_full_standard_cost := v_prime_standard_cost;

    -- Expire old active standard cost row & write new row
    UPDATE item_standard_costs
    SET effective_to = NOW()
    WHERE material_id = p_material_id AND organisation_id = p_org_id AND effective_to IS NULL;

    INSERT INTO item_standard_costs (
      organisation_id, material_id, bom_id, bom_revision,
      prime_standard_cost, overhead_amount, full_standard_cost,
      currency, effective_from, calculation_run_id
    ) VALUES (
      p_org_id, p_material_id, NULL, NULL,
      ROUND(v_prime_standard_cost, 4), 0.00, ROUND(v_full_standard_cost, 4),
      'INR', NOW(), p_run_id
    ) RETURNING id INTO v_new_cost_id;

    RETURN jsonb_build_object(
      'material_id', p_material_id,
      'is_manufactured', false,
      'prime_standard_cost', ROUND(v_prime_standard_cost, 4),
      'overhead_amount', 0.00,
      'full_standard_cost', ROUND(v_full_standard_cost, 4)
    );
  END IF;

  -- 4. Manufactured Item Handling — Load BOM Header
  SELECT id, bom_code, revision, output_qty, COALESCE(overhead_percentage, 0) AS overhead_percentage
  INTO v_bom
  FROM bom_headers
  WHERE id = v_bom_id;

  -- 5. Post-Order Traversal — Process child items first
  FOR v_item IN
    SELECT bi.material_id, bi.required_qty, COALESCE(bi.wastage_pct, 0) AS wastage_pct
    FROM bom_items bi
    WHERE bi.bom_id = v_bom_id
  LOOP
    -- Recursively rollup child item to ensure fresh child prime costs exist
    v_child_rollup_res := rollup_item_standard_cost(
      v_item.material_id,
      p_org_id,
      p_run_id,
      p_production_date,
      ARRAY_APPEND(p_visited_ids, p_material_id)
    );

    -- Retrieve child's PRIME standard cost (excluding child overhead to prevent double compounding)
    v_child_prime_cost := (v_child_rollup_res ->> 'prime_standard_cost')::NUMERIC;

    -- Calculate unit-normalized effective quantity: (required_qty / output_qty) * (1 + wastage_pct/100)
    v_line_effective_qty := (v_item.required_qty / NULLIF(v_bom.output_qty, 0)) * (1.0 + (v_item.wastage_pct / 100.0));
    v_line_cost := ROUND(v_line_effective_qty * v_child_prime_cost, 4);

    v_total_material_cost := v_total_material_cost + v_line_cost;
  END LOOP;

  -- 6. In-house Conversion Cost & Subcontract Cost (per unit)
  v_routing_res := calculate_routing_cost(v_bom_id, 1);
  v_inhouse_conversion_cost := COALESCE((v_routing_res ->> 'inhouse_operation_cost')::NUMERIC, 0);
  v_subcontract_cost        := COALESCE((v_routing_res ->> 'subcontract_operation_cost')::NUMERIC, 0);

  -- 7. Flat Consumable Cost Lines (per unit)
  SELECT ROUND(COALESCE(SUM(amount), 0) / NULLIF(v_bom.output_qty, 0), 4)
  INTO v_consumables_cost
  FROM bom_cost_lines
  WHERE bom_id = v_bom_id;

  -- 8. Blanket Manufacturing Overhead Calculation
  -- Overhead base = Direct Material + In-house Conversion + Consumable Lines (Subcontract excluded)
  v_overhead_base := v_total_material_cost + v_inhouse_conversion_cost + v_consumables_cost;
  v_overhead_percentage := v_bom.overhead_percentage;
  v_overhead_amount := ROUND(v_overhead_base * (v_overhead_percentage / 100.0), 2);

  -- 9. Prime Cost vs Full Standard Cost
  -- Prime Standard Cost = Direct Material + In-house Conversion + Consumable Lines + Subcontract
  v_prime_standard_cost := ROUND(v_total_material_cost + v_inhouse_conversion_cost + v_consumables_cost + v_subcontract_cost, 4);

  -- Full Standard Cost = Prime Standard Cost + Overhead Amount
  v_full_standard_cost := ROUND(v_prime_standard_cost + v_overhead_amount, 4);

  -- 10. Persist Historical Standard Cost Record
  UPDATE item_standard_costs
  SET effective_to = NOW()
  WHERE material_id = p_material_id AND organisation_id = p_org_id AND effective_to IS NULL;

  INSERT INTO item_standard_costs (
    organisation_id, material_id, bom_id, bom_revision,
    prime_standard_cost, overhead_amount, full_standard_cost,
    currency, effective_from, calculation_run_id
  ) VALUES (
    p_org_id, p_material_id, v_bom_id, v_bom.revision,
    v_prime_standard_cost, v_overhead_amount, v_full_standard_cost,
    'INR', NOW(), p_run_id
  ) RETURNING id INTO v_new_cost_id;

  -- Synchronize materials.unit_cost for catalog displays
  UPDATE materials
  SET unit_cost = v_full_standard_cost,
      updated_at = NOW()
  WHERE id = p_material_id;

  RETURN jsonb_build_object(
    'material_id', p_material_id,
    'is_manufactured', true,
    'bom_id', v_bom_id,
    'bom_revision', v_bom.revision,
    'material_cost', ROUND(v_total_material_cost, 4),
    'inhouse_conversion_cost', ROUND(v_inhouse_conversion_cost, 4),
    'subcontract_cost', ROUND(v_subcontract_cost, 4),
    'consumables_cost', ROUND(v_consumables_cost, 4),
    'overhead_base', ROUND(v_overhead_base, 4),
    'overhead_percentage', v_overhead_percentage,
    'overhead_amount', ROUND(v_overhead_amount, 2),
    'prime_standard_cost', v_prime_standard_cost,
    'full_standard_cost', v_full_standard_cost
  );
END;
$$;


-- 11. Rollup Batch Execution RPC
CREATE OR REPLACE FUNCTION execute_standard_cost_rollup_run(
  p_org_id UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run_id UUID;
  v_run_code TEXT;
  v_mat RECORD;
  v_processed INT := 0;
  v_res JSONB;
BEGIN
  -- Validate user membership
  IF NOT EXISTS (
    SELECT 1 FROM user_organisations
    WHERE organisation_id = p_org_id AND user_id = auth.uid() AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not an active member of this organisation');
  END IF;

  v_run_code := 'SCR-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MISS');

  INSERT INTO standard_cost_calculation_runs (
    run_code, status, started_at, initiated_by, organisation_id
  ) VALUES (
    v_run_code, 'running', NOW(), auth.uid(), p_org_id
  ) RETURNING id INTO v_run_id;

  -- Process all manufactured materials with active published BOMs
  FOR v_mat IN
    SELECT DISTINCT bh.product_id
    FROM bom_headers bh
    WHERE bh.organisation_id = p_org_id
      AND bh.is_active = true
      AND bh.approval_status IN ('approved', 'published')
  LOOP
    BEGIN
      v_res := rollup_item_standard_cost(v_mat.product_id, p_org_id, v_run_id, CURRENT_DATE);
      v_processed := v_processed + 1;
    EXCEPTION WHEN OTHERS THEN
      -- Log error but continue remaining items
      UPDATE standard_cost_calculation_runs
      SET error_log = COALESCE(error_log, '') || 'Error rolling up material ' || v_mat.product_id || ': ' || SQLERRM || E'\n'
      WHERE id = v_run_id;
    END BEGIN;
  END LOOP;

  UPDATE standard_cost_calculation_runs
  SET status = 'completed',
      completed_at = NOW(),
      items_processed = v_processed
  WHERE id = v_run_id;

  RETURN jsonb_build_object(
    'ok', true,
    'run_id', v_run_id,
    'run_code', v_run_code,
    'items_processed', v_processed
  );
END;
$$;
