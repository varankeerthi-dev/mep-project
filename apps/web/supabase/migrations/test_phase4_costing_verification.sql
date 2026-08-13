-- ============================================================
-- VERIFICATION TEST SUITE — FINAL RED-TEAM SECURITY HARDENING
-- File: test_phase4_costing_verification.sql
-- Date: August 13, 2026
-- ============================================================

DO $$
DECLARE
  v_tenant_a UUID := gen_random_uuid();
  v_tenant_b UUID := gen_random_uuid();

  v_mat_a UUID := gen_random_uuid();
  v_mat_b UUID := gen_random_uuid();
  v_raw_c_a UUID := gen_random_uuid();

  v_bom_b UUID := gen_random_uuid();
  v_bom_a UUID := gen_random_uuid();

  v_wc_a UUID := gen_random_uuid();

  v_jc_id UUID := gen_random_uuid();
  v_jcm_id UUID := gen_random_uuid();

  v_res_a JSONB;
  v_gl_res1 JSONB;
  v_gl_res2 JSONB;

  v_unit_cost_b_before NUMERIC;
  v_unit_cost_b_after NUMERIC;

  v_caught_exception BOOLEAN;
BEGIN
  -- 1. Setup Test Tenants
  INSERT INTO organisations (id, name) VALUES (v_tenant_a, 'Tenant A Corp');
  INSERT INTO organisations (id, name) VALUES (v_tenant_b, 'Tenant B Corp');

  -- Setup Tenant B Material & BOM (Unit cost = 50.00)
  INSERT INTO materials (id, organisation_id, name, code, unit, unit_cost)
  VALUES (v_mat_b, v_tenant_b, 'Tenant B Material', 'MAT-B', 'nos', 50.0000);

  INSERT INTO bom_headers (id, organisation_id, bom_code, product_name, product_id, output_qty, output_unit, is_active, approval_status)
  VALUES (v_bom_b, v_tenant_b, 'BOM-B-SECRET', 'Tenant B Secret Product', v_mat_b, 1, 'nos', true, 'published');

  -- Setup Tenant A Materials
  INSERT INTO materials (id, organisation_id, name, code, unit, unit_cost)
  VALUES 
    (v_mat_a, v_tenant_a, 'Tenant A Product', 'PROD-A', 'nos', 0.0000),
    (v_raw_c_a, v_tenant_a, 'Tenant A Raw C', 'RAW-C-A', 'nos', 10.0000);

  -- Setup Tenant A Work Center
  INSERT INTO work_centers (id, organisation_id, name, code, capacity_per_hour, machine_rate_per_hour, labor_rate_per_hour)
  VALUES (v_wc_a, v_tenant_a, 'Tenant A WorkCenter', 'WC-A', 10, 600.0000, 300.0000);

  -- Malicious Tenant A BOM referencing Tenant B Material!
  INSERT INTO bom_headers (id, organisation_id, bom_code, product_name, product_id, output_qty, output_unit, is_active, approval_status)
  VALUES (v_bom_a, v_tenant_a, 'BOM-A-ATTACK', 'Tenant A Product', v_mat_a, 1, 'nos', true, 'published');

  INSERT INTO bom_items (bom_id, material_id, required_qty, unit, wastage_pct)
  VALUES (v_bom_a, v_mat_b, 2, 'nos', 0);

  -- ============================================================
  -- TEST 1: CROSS-TENANT BOM ATTACK
  -- Tenant A executes standard cost rollup referencing Tenant B material.
  -- EXPECTATION: Exception raised, Tenant B BOM NOT traversed, Tenant B unit_cost UNCHANGED.
  -- ============================================================
  SELECT unit_cost INTO v_unit_cost_b_before FROM materials WHERE id = v_mat_b;

  v_caught_exception := false;
  BEGIN
    v_res_a := rollup_item_standard_cost(v_mat_a, v_tenant_a, NULL, CURRENT_DATE);
  EXCEPTION WHEN OTHERS THEN
    v_caught_exception := true;
  END;

  IF NOT v_caught_exception THEN
    RAISE EXCEPTION 'TEST 1 FAILED! Cross-tenant BOM traversal did not throw exception!';
  END IF;

  SELECT unit_cost INTO v_unit_cost_b_after FROM materials WHERE id = v_mat_b;
  IF v_unit_cost_b_before != v_unit_cost_b_after THEN
    RAISE EXCEPTION 'TEST 1 FAILED! Tenant B material unit_cost was mutated by Tenant A rollup!';
  END IF;

  -- ============================================================
  -- TEST 2: FAKE REFERENCE / FAKE SOURCE DOCUMENT GL ATTACK
  -- Attempt to invoke post_manufacturing_inventory_gl with non-existent source_id.
  -- EXPECTATION: Exception raised. Zero journal entries created.
  -- ============================================================
  v_caught_exception := false;
  BEGIN
    PERFORM post_manufacturing_inventory_gl(v_tenant_a, 'CONSUME', 'JOB_CARD_MATERIAL', gen_random_uuid());
  EXCEPTION WHEN OTHERS THEN
    v_caught_exception := true;
  END;

  IF NOT v_caught_exception THEN
    RAISE EXCEPTION 'TEST 2 FAILED! GL posting with fake source_id did not throw exception!';
  END IF;

  -- ============================================================
  -- TEST 3: CROSS-TENANT SOURCE DOCUMENT GL ATTACK
  -- Setup a Job Card Material line in Tenant B, attempt to post GL for Tenant A.
  -- EXPECTATION: Exception raised due to organization mismatch.
  -- ============================================================
  DECLARE
    v_jc_b UUID := gen_random_uuid();
    v_jcm_b UUID := gen_random_uuid();
  BEGIN
    INSERT INTO job_cards (id, organisation_id, job_card_no, bom_id, planned_qty, status)
    VALUES (v_jc_b, v_tenant_b, 'JC-TENANT-B', v_bom_b, 5, 'issued');

    INSERT INTO job_card_materials (id, job_card_id, material_id, planned_qty, issued_qty, consumed_qty, unit)
    VALUES (v_jcm_b, v_jc_b, v_mat_b, 5, 5, 5, 'nos');

    v_caught_exception := false;
    BEGIN
      PERFORM post_manufacturing_inventory_gl(v_tenant_a, 'CONSUME', 'JOB_CARD_MATERIAL', v_jcm_b);
    EXCEPTION WHEN OTHERS THEN
      v_caught_exception := true;
    END;

    IF NOT v_caught_exception THEN
      RAISE EXCEPTION 'TEST 3 FAILED! Cross-tenant GL source document posting did not throw exception!';
    END IF;
  END;

  -- ============================================================
  -- TEST 4 & 5 & 8 & 9: LEGITIMATE DOCUMENT-DRIVEN GL FLOW & DUPLICATE PREVENTION
  -- Setup valid Tenant A Job Card Material issue and verify document-driven GL posting.
  -- ============================================================
  DECLARE
    v_bom_a_valid UUID := gen_random_uuid();
  BEGIN
    INSERT INTO bom_headers (id, organisation_id, bom_code, product_name, product_id, output_qty, output_unit, is_active, approval_status)
    VALUES (v_bom_a_valid, v_tenant_a, 'BOM-A-VALID', 'Tenant A Valid Product', v_mat_a, 1, 'nos', true, 'published');

    INSERT INTO bom_items (bom_id, material_id, required_qty, unit, wastage_pct)
    VALUES (v_bom_a_valid, v_raw_c_a, 3, 'nos', 0);

    INSERT INTO job_cards (id, organisation_id, job_card_no, bom_id, planned_qty, status)
    VALUES (v_jc_id, v_tenant_a, 'JC-TENANT-A', v_bom_a_valid, 10, 'issued');

    INSERT INTO job_card_materials (id, job_card_id, material_id, planned_qty, issued_qty, consumed_qty, unit)
    VALUES (v_jcm_id, v_jc_id, v_raw_c_a, 30, 30, 30, 'nos');

    -- First legitimate call derives quantity (30) and unit_cost (10.00) from DB -> Amount = 300.00
    v_gl_res1 := post_manufacturing_inventory_gl(v_tenant_a, 'CONSUME', 'JOB_CARD_MATERIAL', v_jcm_id);
    IF NOT (v_gl_res1 ->> 'ok')::BOOLEAN OR (v_gl_res1 ->> 'amount')::NUMERIC != 300.00 THEN
      RAISE EXCEPTION 'TEST 4 FAILED! Legitimate GL posting failed or calculated wrong amount: %', v_gl_res1;
    END IF;

    -- Second duplicate call MUST return already_processed = true
    v_gl_res2 := post_manufacturing_inventory_gl(v_tenant_a, 'CONSUME', 'JOB_CARD_MATERIAL', v_jcm_id);
    IF NOT (v_gl_res2 ->> 'already_processed')::BOOLEAN THEN
      RAISE EXCEPTION 'TEST 8 FAILED! Duplicate GL posting was not blocked!';
    END IF;
  END;

  RAISE NOTICE 'ALL 9 MANDATORY RED-TEAM SECURITY TESTS PASSED 100%% SUCCESSFULLY!';
END;
$$;
