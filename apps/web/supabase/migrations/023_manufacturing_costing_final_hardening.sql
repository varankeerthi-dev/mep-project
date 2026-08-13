-- ============================================================
-- MANUFACTURING ENGINE V2 — PHASE 4: FINAL RED-TEAM SECURITY HARDENING
-- Migration: 023_manufacturing_costing_final_hardening.sql
-- Date: August 13, 2026
-- ============================================================

-- ============================================================
-- 1. P1 FINDING #1 — CROSS-TENANT BOM TRAVERSAL PREVENTION
-- Introduce organization-aware subassembly resolution and defense-in-depth tenant validation
-- ============================================================

-- 1.1 Organization-Aware Subassembly Resolver
CREATE OR REPLACE FUNCTION resolve_subassembly_bom(
  p_material_id UUID,
  p_production_date DATE,
  p_org_id UUID
) RETURNS UUID
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bom_ids UUID[];
  v_count INT;
  v_mat_name VARCHAR;
BEGIN
  -- Enforce bom_headers.product_id = p_material_id AND bom_headers.organisation_id = p_org_id
  SELECT ARRAY_AGG(id) INTO v_bom_ids
  FROM bom_headers
  WHERE product_id = p_material_id
    AND organisation_id = p_org_id
    AND is_active = true
    AND approval_status IN ('approved', 'published')
    AND (effective_date IS NULL OR effective_date <= p_production_date)
    AND (valid_to IS NULL OR valid_to >= p_production_date);

  v_count := COALESCE(CARDINALITY(v_bom_ids), 0);

  IF v_count = 0 THEN
    RETURN NULL; -- Leaf raw material (no subassembly BOM)
  ELSIF v_count = 1 THEN
    RETURN v_bom_ids[1]; -- Single deterministic active BOM for this organisation
  ELSE
    SELECT name INTO v_mat_name FROM materials WHERE id = p_material_id AND organisation_id = p_org_id;
    RAISE EXCEPTION 'Ambiguous BOM revision: Found % active published BOM revisions for material % (%) in organisation % on date %',
      v_count, COALESCE(v_mat_name, 'Unknown'), p_material_id, p_org_id, p_production_date;
  END IF;
END;
$$;

-- 1.2 Backwards-Compatible Overloaded 2-Parameter Subassembly Resolver
CREATE OR REPLACE FUNCTION resolve_subassembly_bom(
  p_material_id UUID,
  p_production_date DATE
) RETURNS UUID
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  SELECT organisation_id INTO v_org_id FROM materials WHERE id = p_material_id;
  IF v_org_id IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN resolve_subassembly_bom(p_material_id, p_production_date, v_org_id);
END;
$$;

-- 1.3 Updated explode_bom() with Organization-Aware Resolver
CREATE OR REPLACE FUNCTION explode_bom(
  p_bom_id UUID,
  p_production_qty NUMERIC DEFAULT 1,
  p_production_date DATE DEFAULT CURRENT_DATE
) RETURNS TABLE (
  bom_id UUID,
  material_id UUID,
  material_name TEXT,
  material_code TEXT,
  unit TEXT,
  unit_cost NUMERIC,
  bom_level INT,
  component_path TEXT,
  parent_material_id UUID,
  required_qty_per_unit NUMERIC,
  wastage_pct NUMERIC,
  effective_qty_per_unit NUMERIC,
  total_required_qty NUMERIC,
  line_estimated_cost NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bom_org_id UUID;
BEGIN
  SELECT organisation_id INTO v_bom_org_id FROM bom_headers WHERE id = p_bom_id;

  RETURN QUERY
  WITH RECURSIVE bom_tree AS (
    SELECT 
      bh.id AS current_bom_id,
      bi.material_id,
      m.name AS material_name,
      m.code AS material_code,
      bi.unit,
      COALESCE(m.unit_cost, 0) AS unit_cost,
      1 AS bom_level,
      m.code::TEXT AS component_path,
      bh.product_id AS parent_material_id,
      (bi.required_qty / NULLIF(bh.output_qty, 0)) AS required_qty_per_unit,
      COALESCE(bi.wastage_pct, 0) AS wastage_pct,
      (bi.required_qty / NULLIF(bh.output_qty, 0)) * (1.0 + (COALESCE(bi.wastage_pct, 0) / 100.0)) AS effective_qty_per_unit,
      ARRAY[bh.product_id, bi.material_id] AS path_visited
    FROM bom_headers bh
    JOIN bom_items bi ON bi.bom_id = bh.id
    JOIN materials m ON m.id = bi.material_id
    WHERE bh.id = p_bom_id

    UNION ALL

    SELECT 
      sub_bh.id AS current_bom_id,
      bi.material_id,
      m.name AS material_name,
      m.code AS material_code,
      bi.unit,
      COALESCE(m.unit_cost, 0) AS unit_cost,
      bt.bom_level + 1 AS bom_level,
      bt.component_path || ' -> ' || m.code AS component_path,
      bt.material_id AS parent_material_id,
      (bi.required_qty / NULLIF(sub_bh.output_qty, 0)) AS required_qty_per_unit,
      COALESCE(bi.wastage_pct, 0) AS wastage_pct,
      bt.effective_qty_per_unit * (bi.required_qty / NULLIF(sub_bh.output_qty, 0)) * (1.0 + (COALESCE(bi.wastage_pct, 0) / 100.0)) AS effective_qty_per_unit,
      bt.path_visited || bi.material_id AS path_visited
    FROM bom_tree bt
    JOIN bom_headers sub_bh ON sub_bh.id = resolve_subassembly_bom(bt.material_id, p_production_date, v_bom_org_id)
    JOIN bom_items bi ON bi.bom_id = sub_bh.id
    JOIN materials m ON m.id = bi.material_id
    WHERE NOT (bi.material_id = ANY(bt.path_visited))
  )
  SELECT 
    bt.current_bom_id AS bom_id,
    bt.material_id,
    bt.material_name,
    bt.material_code,
    bt.unit,
    bt.unit_cost,
    bt.bom_level,
    bt.component_path,
    bt.parent_material_id,
    ROUND(bt.required_qty_per_unit, 4) AS required_qty_per_unit,
    ROUND(bt.wastage_pct, 2) AS wastage_pct,
    ROUND(bt.effective_qty_per_unit, 4) AS effective_qty_per_unit,
    ROUND(bt.effective_qty_per_unit * p_production_qty, 4) AS total_required_qty,
    ROUND(bt.effective_qty_per_unit * p_production_qty * bt.unit_cost, 2) AS line_estimated_cost
  FROM bom_tree bt
  ORDER BY bt.bom_level, bt.component_path;
END;
$$;

-- 1.4 Hardened rollup_item_standard_cost with Defense-in-Depth Cross-Tenant Material Rejection
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

  -- Defense-in-depth: Reject material if it belongs to another organisation
  IF NOT EXISTS (
    SELECT 1 FROM materials WHERE id = p_material_id AND organisation_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'Cross-tenant material reference is not permitted: Material % does not belong to organisation %', p_material_id, p_org_id;
  END IF;

  -- 1. Circular BOM detection guard
  IF p_material_id = ANY(p_visited_ids) THEN
    RAISE EXCEPTION 'Circular BOM dependency detected at material % during standard cost rollup', p_material_id;
  END IF;

  -- 2. Resolve active published BOM for material at p_production_date strictly within p_org_id
  v_bom_id := resolve_subassembly_bom(p_material_id, p_production_date, p_org_id);

  -- 3. Leaf item handling (Purchased Raw Material / Component without active BOM)
  IF v_bom_id IS NULL THEN
    SELECT COALESCE(unit_cost, 0) INTO v_prime_standard_cost
    FROM materials
    WHERE id = p_material_id AND organisation_id = p_org_id;

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
  WHERE id = v_bom_id AND organisation_id = p_org_id;

  -- 5. Post-Order Traversal — Process child items first
  FOR v_item IN
    SELECT bi.material_id, bi.required_qty, COALESCE(bi.wastage_pct, 0) AS wastage_pct
    FROM bom_items bi
    WHERE bi.bom_id = v_bom_id
  LOOP
    -- Verify child material ownership before recursion
    IF NOT EXISTS (
      SELECT 1 FROM materials WHERE id = v_item.material_id AND organisation_id = p_org_id
    ) THEN
      RAISE EXCEPTION 'Cross-tenant material reference is not permitted: Child material % does not belong to organisation %', v_item.material_id, p_org_id;
    END IF;

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
  WHERE bom_id = v_bom_id AND organisation_id = p_org_id;

  -- 8. Blanket Manufacturing Overhead Calculation
  v_overhead_base := v_total_material_cost + v_inhouse_conversion_cost + v_consumables_cost;
  v_overhead_percentage := v_bom.overhead_percentage;
  v_overhead_amount := ROUND(v_overhead_base * (v_overhead_percentage / 100.0), 2);

  -- 9. Prime Cost vs Full Standard Cost
  v_prime_standard_cost := ROUND(v_total_material_cost + v_inhouse_conversion_cost + v_consumables_cost + v_subcontract_cost, 4);
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

  -- Synchronize materials.unit_cost strictly for current organisation
  UPDATE materials
  SET unit_cost = v_full_standard_cost,
      updated_at = NOW()
  WHERE id = p_material_id AND organisation_id = p_org_id;

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


-- ============================================================
-- 2. P1 FINDING #2 — DOCUMENT-DRIVEN GL POSTING & PRIVILEGE REVOCATION
-- ============================================================

-- 2.1 Refactored Document-Driven post_manufacturing_inventory_gl RPC
CREATE OR REPLACE FUNCTION post_manufacturing_inventory_gl(
  p_org_id UUID,
  p_movement_type TEXT, -- 'CONSUME' | 'PRODUCE' | 'DISPATCH'
  p_source_type TEXT,   -- 'JOB_CARD_MATERIAL' | 'QC_INSPECTION' | 'RETURN_ITEM' | 'GRN'
  p_source_id UUID,
  p_override_qty NUMERIC DEFAULT NULL,
  p_override_unit_cost NUMERIC DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_material_id UUID;
  v_qty NUMERIC;
  v_unit_cost NUMERIC;
  v_reference_no TEXT;
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
  -- Tenant & Business Role Authorization Check
  IF auth.uid() IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM user_organisations
      WHERE organisation_id = p_org_id AND user_id = auth.uid() AND status = 'active'
    ) AND COALESCE((auth.jwt() ->> 'org_id')::uuid, '00000000-0000-0000-0000-000000000000'::uuid) != p_org_id THEN
      RAISE EXCEPTION 'Tenant security violation: Not an active member of organisation %', p_org_id;
    END IF;
  END IF;

  -- Derive quantity, cost, material, and reference strictly from committed DB source documents
  IF p_source_type = 'JOB_CARD_MATERIAL' THEN
    SELECT jcm.material_id, COALESCE(NULLIF(p_override_qty, 0), jcm.consumed_qty, jcm.issued_qty, 0), COALESCE(m.unit_cost, 0), 'JC-MAT-' || jcm.id::TEXT
    INTO v_material_id, v_qty, v_unit_cost, v_reference_no
    FROM job_card_materials jcm
    JOIN job_cards jc ON jc.id = jcm.job_card_id
    JOIN materials m ON m.id = jcm.material_id
    WHERE jcm.id = p_source_id AND jc.organisation_id = p_org_id;
  ELSIF p_source_type = 'QC_INSPECTION' THEN
    SELECT qc.product_id, COALESCE(NULLIF(p_override_qty, 0), qc.accepted_qty, 0), COALESCE(m.unit_cost, 0), 'QC-' || qc.inspection_no
    INTO v_material_id, v_qty, v_unit_cost, v_reference_no
    FROM fg_qc_inspections qc
    JOIN materials m ON m.id = qc.product_id
    WHERE qc.id = p_source_id AND qc.organisation_id = p_org_id;
  ELSIF p_source_type = 'RETURN_ITEM' THEN
    SELECT ri.item_id, COALESCE(NULLIF(p_override_qty, 0), ri.quantity, 0), COALESCE(NULLIF(ri.rate, 0), m.unit_cost, 0), 'RET-ITEM-' || ri.id::TEXT
    INTO v_material_id, v_qty, v_unit_cost, v_reference_no
    FROM return_items ri
    JOIN returns r ON r.id = ri.return_id
    JOIN materials m ON m.id = ri.item_id
    WHERE ri.id = p_source_id AND r.organisation_id = p_org_id;
  ELSIF p_source_type = 'GRN' THEN
    SELECT gi.material_id, COALESCE(NULLIF(p_override_qty, 0), gi.accepted_qty, gi.received_qty, 0), COALESCE(m.unit_cost, 0), 'GRN-LINE-' || gi.id::TEXT
    INTO v_material_id, v_qty, v_unit_cost, v_reference_no
    FROM grn_items gi
    JOIN goods_receipt_notes grn ON grn.id = gi.grn_id
    JOIN materials m ON m.id = gi.material_id
    WHERE gi.id = p_source_id AND grn.organisation_id = p_org_id;
  ELSE
    RAISE EXCEPTION 'Invalid source document type % for GL posting', p_source_type;
  END IF;

  IF v_material_id IS NULL THEN
    RAISE EXCEPTION 'Tenant security violation: Source document % (%) does not exist or belong to organisation %', p_source_type, p_source_id, p_org_id;
  END IF;

  -- Use trusted database values
  v_amount := ROUND(ABS(COALESCE(v_qty, 0)) * COALESCE(v_unit_cost, 0), 2);
  IF v_amount <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'Zero or negative movement value');
  END IF;

  v_voucher_no := 'GL-' || p_movement_type || '-' || UPPER(REGEXP_REPLACE(v_reference_no, '[^a-zA-Z0-9]', '', 'g'));

  IF EXISTS (
    SELECT 1 FROM journal_entries
    WHERE voucher_no = v_voucher_no
  ) THEN
    RETURN jsonb_build_object('ok', true, 'already_processed', true, 'voucher_no', v_voucher_no);
  END IF;

  SELECT COALESCE(name, 'Material') INTO v_mat_name FROM materials WHERE id = v_material_id;

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
    v_narration := 'Manufacturing Consume ' || v_reference_no || ' — ' || v_mat_name;
  ELSIF p_movement_type = 'PRODUCE' THEN
    v_dr_acc_id := v_fg_acc_id;
    v_cr_acc_id := v_wip_acc_id;
    v_narration := 'Manufacturing Production ' || v_reference_no || ' — ' || v_mat_name;
  ELSIF p_movement_type = 'DISPATCH' THEN
    v_dr_acc_id := v_cogs_acc_id;
    v_cr_acc_id := v_fg_acc_id;
    v_narration := 'Sales Dispatch ' || v_reference_no || ' — ' || v_mat_name;
  ELSE
    RAISE EXCEPTION 'Invalid movement type: %', p_movement_type;
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

-- 2.2 Revoke Public Direct EXECUTE Privileges on Sensitive GL Function
REVOKE EXECUTE ON FUNCTION post_manufacturing_inventory_gl(UUID, TEXT, TEXT, UUID, NUMERIC, NUMERIC) FROM PUBLIC, authenticated, anon;
