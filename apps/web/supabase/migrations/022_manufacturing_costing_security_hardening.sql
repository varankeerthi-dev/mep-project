-- ============================================================
-- MANUFACTURING ENGINE V2 — PHASE 4: SECURITY & IMMUTABILITY HARDENING
-- Migration: 022_manufacturing_costing_security_hardening.sql
-- Date: August 13, 2026
-- ============================================================

-- ============================================================
-- 1. P1 FINDING #1 — RLS TENANT ISOLATION HARDENING
-- Replace permissive development policies with explicit organisation isolation
-- ============================================================

-- 1.1 bom_routing_operations
DROP POLICY IF EXISTS "Enable all access for bom_routing_operations" ON bom_routing_operations;
CREATE POLICY "Tenant isolation for bom_routing_operations" ON bom_routing_operations
  FOR ALL
  USING (
    organisation_id = (auth.jwt() ->> 'org_id')::uuid
    OR EXISTS (
      SELECT 1 FROM user_organisations
      WHERE organisation_id = bom_routing_operations.organisation_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  )
  WITH CHECK (
    organisation_id = (auth.jwt() ->> 'org_id')::uuid
    OR EXISTS (
      SELECT 1 FROM user_organisations
      WHERE organisation_id = bom_routing_operations.organisation_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

-- 1.2 bom_cost_lines
DROP POLICY IF EXISTS "Enable all access for bom_cost_lines" ON bom_cost_lines;
CREATE POLICY "Tenant isolation for bom_cost_lines" ON bom_cost_lines
  FOR ALL
  USING (
    organisation_id = (auth.jwt() ->> 'org_id')::uuid
    OR EXISTS (
      SELECT 1 FROM user_organisations
      WHERE organisation_id = bom_cost_lines.organisation_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  )
  WITH CHECK (
    organisation_id = (auth.jwt() ->> 'org_id')::uuid
    OR EXISTS (
      SELECT 1 FROM user_organisations
      WHERE organisation_id = bom_cost_lines.organisation_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

-- 1.3 standard_cost_calculation_runs
DROP POLICY IF EXISTS "Enable all access for standard_cost_calculation_runs" ON standard_cost_calculation_runs;
CREATE POLICY "Tenant isolation for standard_cost_calculation_runs" ON standard_cost_calculation_runs
  FOR ALL
  USING (
    organisation_id = (auth.jwt() ->> 'org_id')::uuid
    OR EXISTS (
      SELECT 1 FROM user_organisations
      WHERE organisation_id = standard_cost_calculation_runs.organisation_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  )
  WITH CHECK (
    organisation_id = (auth.jwt() ->> 'org_id')::uuid
    OR EXISTS (
      SELECT 1 FROM user_organisations
      WHERE organisation_id = standard_cost_calculation_runs.organisation_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

-- 1.4 item_standard_costs
DROP POLICY IF EXISTS "Enable all access for item_standard_costs" ON item_standard_costs;
CREATE POLICY "Tenant isolation for item_standard_costs" ON item_standard_costs
  FOR ALL
  USING (
    organisation_id = (auth.jwt() ->> 'org_id')::uuid
    OR EXISTS (
      SELECT 1 FROM user_organisations
      WHERE organisation_id = item_standard_costs.organisation_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  )
  WITH CHECK (
    organisation_id = (auth.jwt() ->> 'org_id')::uuid
    OR EXISTS (
      SELECT 1 FROM user_organisations
      WHERE organisation_id = item_standard_costs.organisation_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

-- 1.5 job_card_cost_variances
DROP POLICY IF EXISTS "Enable all access for job_card_cost_variances" ON job_card_cost_variances;
CREATE POLICY "Tenant isolation for job_card_cost_variances" ON job_card_cost_variances
  FOR ALL
  USING (
    organisation_id = (auth.jwt() ->> 'org_id')::uuid
    OR EXISTS (
      SELECT 1 FROM user_organisations
      WHERE organisation_id = job_card_cost_variances.organisation_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  )
  WITH CHECK (
    organisation_id = (auth.jwt() ->> 'org_id')::uuid
    OR EXISTS (
      SELECT 1 FROM user_organisations
      WHERE organisation_id = job_card_cost_variances.organisation_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );


-- ============================================================
-- 2. P1 FINDING #2 — JOB CARD BOM SNAPSHOT IMMUTABILITY TRIGGER
-- Prevents direct client UPDATE of bom_snapshot once Job Card status != 'draft'
-- ============================================================

CREATE OR REPLACE FUNCTION prevent_released_job_card_snapshot_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Reject attempts to modify bom_snapshot if the Job Card was already released/issued/completed
  IF OLD.status IN ('issued', 'in_progress', 'completed')
     AND NEW.bom_snapshot IS DISTINCT FROM OLD.bom_snapshot THEN
    RAISE EXCEPTION 'Immutable record error: job_cards.bom_snapshot cannot be modified once the Job Card is issued or completed.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_prevent_released_job_card_snapshot_mutation ON job_cards;
CREATE TRIGGER trigger_prevent_released_job_card_snapshot_mutation
  BEFORE UPDATE ON job_cards
  FOR EACH ROW
  EXECUTE FUNCTION prevent_released_job_card_snapshot_mutation();


-- ============================================================
-- 3. P2 FINDING #3 — SECURITY DEFINER RPC AUTHORIZATION HARDENING
-- Multi-tenant membership verification for helper RPCs
-- ============================================================

-- 3.1 Hardened calculate_routing_cost RPC
CREATE OR REPLACE FUNCTION calculate_routing_cost(
  p_bom_id UUID,
  p_batch_qty NUMERIC DEFAULT 1
) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bom_org_id UUID;
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
  -- Tenant membership authorization check
  SELECT organisation_id INTO v_bom_org_id FROM bom_headers WHERE id = p_bom_id;
  IF v_bom_org_id IS NOT NULL AND auth.uid() IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM user_organisations
      WHERE organisation_id = v_bom_org_id AND user_id = auth.uid() AND status = 'active'
    ) AND COALESCE((auth.jwt() ->> 'org_id')::uuid, '00000000-0000-0000-0000-000000000000'::uuid) != v_bom_org_id THEN
      RAISE EXCEPTION 'Tenant security violation: Not an active member of BOM organisation %', v_bom_org_id;
    END IF;
  END IF;

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


-- 3.2 Hardened rollup_item_standard_cost RPC
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
  -- Tenant membership authorization check
  IF auth.uid() IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM user_organisations
      WHERE organisation_id = p_org_id AND user_id = auth.uid() AND status = 'active'
    ) AND COALESCE((auth.jwt() ->> 'org_id')::uuid, '00000000-0000-0000-0000-000000000000'::uuid) != p_org_id THEN
      RAISE EXCEPTION 'Tenant security violation: Not an active member of organisation %', p_org_id;
    END IF;
  END IF;

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


-- 3.3 Hardened post_manufacturing_inventory_gl RPC
CREATE OR REPLACE FUNCTION post_manufacturing_inventory_gl(
  p_org_id UUID,
  p_movement_type TEXT,
  p_reference_no TEXT,
  p_material_id UUID,
  p_qty NUMERIC,
  p_unit_cost NUMERIC
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount NUMERIC;
  v_mat_name TEXT;
  v_voucher_no TEXT;
  v_voucher_id UUID;

  v_raw_mat_acc_id UUID;
  v_wip_acc_id UUID;
  v_fg_acc_id UUID;
  v_cogs_acc_id UUID;

  v_dr_acc_id UUID;
  v_cr_acc_id UUID;
  v_narration TEXT;
BEGIN
  -- Tenant membership authorization check
  IF auth.uid() IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM user_organisations
      WHERE organisation_id = p_org_id AND user_id = auth.uid() AND status = 'active'
    ) AND COALESCE((auth.jwt() ->> 'org_id')::uuid, '00000000-0000-0000-0000-000000000000'::uuid) != p_org_id THEN
      RAISE EXCEPTION 'Tenant security violation: Not an active member of organisation %', p_org_id;
    END IF;
  END IF;

  v_amount := ROUND(ABS(COALESCE(p_qty, 0)) * COALESCE(p_unit_cost, 0), 2);
  IF v_amount <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'Zero or negative movement value');
  END IF;

  v_voucher_no := 'GL-' || p_movement_type || '-' || UPPER(REGEXP_REPLACE(p_reference_no, '[^a-zA-Z0-9]', '', 'g'));

  IF EXISTS (
    SELECT 1 FROM journal_entries
    WHERE voucher_no = v_voucher_no
  ) THEN
    RETURN jsonb_build_object('ok', true, 'already_processed', true, 'voucher_no', v_voucher_no);
  END IF;

  SELECT COALESCE(name, 'Material') INTO v_mat_name FROM materials WHERE id = p_material_id;

  SELECT id INTO v_raw_mat_acc_id FROM accounts
  WHERE organisation_id = p_org_id AND (account_code = '1410' OR LOWER(name) LIKE '%raw material%') AND is_group = false LIMIT 1;
  IF v_raw_mat_acc_id IS NULL THEN
    INSERT INTO accounts (account_code, name, is_group, root_type, organisation_id)
    VALUES ('1410', 'Raw Material Stock', false, 'Asset', p_org_id) RETURNING id INTO v_raw_mat_acc_id;
  END IF;

  SELECT id INTO v_wip_acc_id FROM accounts
  WHERE organisation_id = p_org_id AND (account_code = '1420' OR LOWER(name) LIKE '%work in process%' OR LOWER(name) LIKE '%wip%') AND is_group = false LIMIT 1;
  IF v_wip_acc_id IS NULL THEN
    INSERT INTO accounts (account_code, name, is_group, root_type, organisation_id)
    VALUES ('1420', 'Work In Process Inventory', false, 'Asset', p_org_id) RETURNING id INTO v_wip_acc_id;
  END IF;

  SELECT id INTO v_fg_acc_id FROM accounts
  WHERE organisation_id = p_org_id AND (account_code = '1430' OR LOWER(name) LIKE '%finished goods%') AND is_group = false LIMIT 1;
  IF v_fg_acc_id IS NULL THEN
    INSERT INTO accounts (account_code, name, is_group, root_type, organisation_id)
    VALUES ('1430', 'Finished Goods Stock', false, 'Asset', p_org_id) RETURNING id INTO v_fg_acc_id;
  END IF;

  SELECT id INTO v_cogs_acc_id FROM accounts
  WHERE organisation_id = p_org_id AND (account_code = '5100' OR LOWER(name) LIKE '%cost of goods sold%' OR LOWER(name) LIKE '%cogs%') AND is_group = false LIMIT 1;
  IF v_cogs_acc_id IS NULL THEN
    INSERT INTO accounts (account_code, name, is_group, root_type, organisation_id)
    VALUES ('5100', 'Cost of Goods Sold', false, 'Expense', p_org_id) RETURNING id INTO v_cogs_acc_id;
  END IF;

  IF p_movement_type = 'CONSUME' THEN
    v_dr_acc_id := v_wip_acc_id;
    v_cr_acc_id := v_raw_mat_acc_id;
    v_narration := 'Manufacturing Consume ' || p_reference_no || ' — ' || v_mat_name;
  ELSIF p_movement_type = 'PRODUCE' THEN
    v_dr_acc_id := v_fg_acc_id;
    v_cr_acc_id := v_wip_acc_id;
    v_narration := 'Manufacturing Production ' || p_reference_no || ' — ' || v_mat_name;
  ELSIF p_movement_type = 'DISPATCH' THEN
    v_dr_acc_id := v_cogs_acc_id;
    v_cr_acc_id := v_fg_acc_id;
    v_narration := 'Sales Dispatch ' || p_reference_no || ' — ' || v_mat_name;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid movement type: ' || p_movement_type);
  END IF;

  INSERT INTO journal_entries (
    voucher_no, voucher_date, voucher_type, narration, status, organisation_id
  ) VALUES (
    v_voucher_no, CURRENT_DATE, 'JOURNAL', v_narration, 'posted', p_org_id
  ) RETURNING id INTO v_voucher_id;

  INSERT INTO journal_entry_lines (
    journal_entry_id, account_id, debit, credit, narration
  ) VALUES (
    v_voucher_id, v_dr_acc_id, v_amount, 0.00, v_narration
  );

  INSERT INTO journal_entry_lines (
    journal_entry_id, account_id, debit, credit, narration
  ) VALUES (
    v_voucher_id, v_cr_acc_id, 0.00, v_amount, v_narration
  );

  RETURN jsonb_build_object(
    'ok', true,
    'voucher_id', v_voucher_id,
    'voucher_no', v_voucher_no,
    'amount', v_amount,
    'movement_type', p_movement_type
  );
END;
$$;
