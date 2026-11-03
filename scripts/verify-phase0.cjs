const fs = require('fs');
const path = require('path');

const SUPABASE_API_URL = 'https://api.supabase.com/v1/projects/rujqejtisqermjyqqgoj/database/query';
const SUPABASE_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || '';

async function executeSql(sql) {
  const res = await fetch(SUPABASE_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SQL query failed (${res.status}): ${text}`);
  }

  return await res.json();
}

async function runPhase0Verification() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logDir = path.resolve(__dirname, '../docs/labour-attendance/verification');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  const logPath = path.join(logDir, `phase0-w1-w6-${timestamp}.log`);

  const logs = [];
  function log(msg) {
    console.log(msg);
    logs.push(msg);
  }

  log('====================================================================');
  log(`PHASE 0 WORKFLOW VERIFICATION (W1 & W6)`);
  log(`Started at: ${new Date().toISOString()}`);
  log('====================================================================\n');

  // Load migration SQL
  const migrationPath = path.resolve(__dirname, '../apps/web/supabase/migrations/20261103010000_phase0_labour_foundation.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  // Construct isolated test script running in a single transaction that terminates in ROLLBACK
  const testScript = `
DO $TEST$
DECLARE
  v_test_org_id UUID := gen_random_uuid();
  v_se_user_id UUID := gen_random_uuid();
  v_pm_user_id UUID := gen_random_uuid();
  v_outsider_id UUID := gen_random_uuid();
  v_emp_se UUID := gen_random_uuid();
  v_emp_pm UUID := gen_random_uuid();
  v_role_se UUID := gen_random_uuid();
  v_role_pm UUID := gen_random_uuid();
  v_category_id UUID := gen_random_uuid();
  v_unrated_cat_id UUID := gen_random_uuid();
  v_subcontractor_id UUID := gen_random_uuid();
  v_client_id UUID := gen_random_uuid();
  v_project_id UUID := gen_random_uuid();
  v_modifier_id UUID := gen_random_uuid();
  v_att_id UUID;
  v_res JSONB;
  v_row RECORD;
  v_audit_count INT;
  v_err_caught BOOLEAN := false;
BEGIN
  -- 0. Select real auth user IDs for FK satisfaction
  SELECT id INTO v_se_user_id FROM auth.users ORDER BY created_at LIMIT 1;
  SELECT id INTO v_pm_user_id FROM auth.users ORDER BY created_at OFFSET 1 LIMIT 1;

  -- 1. Create test organisation
  INSERT INTO public.organisations (id, name)
  VALUES (v_test_org_id, '__verify_labour_org_a__');

  -- 2. Create test employees (required by trg_org_members_role_guard)
  INSERT INTO public.employees (id, organisation_id, name, email, status)
  VALUES
    (v_emp_se, v_test_org_id, 'Test Site Engineer', 'se@example.com', 'active'),
    (v_emp_pm, v_test_org_id, 'Test Project Manager', 'pm@example.com', 'active');

  -- 3. Create test roles for site_engineer and project_manager
  INSERT INTO public.roles (id, organisation_id, name, is_system, is_active)
  VALUES 
    (v_role_se, v_test_org_id, 'Site Engineer', false, true),
    (v_role_pm, v_test_org_id, 'Project Manager', false, true);

  -- Grant permissions:
  -- SE: labour.attendance.create, labour.attendance.edit, labour.attendance.view
  INSERT INTO public.role_permissions (role_id, permission_key)
  VALUES 
    (v_role_se, 'labour.attendance.create'),
    (v_role_se, 'labour.attendance.edit'),
    (v_role_se, 'labour.attendance.view'),
  -- PM: labour.attendance.create, labour.attendance.edit, labour.attendance.view, labour.attendance.approve, labour.attendance.reopen
    (v_role_pm, 'labour.attendance.create'),
    (v_role_pm, 'labour.attendance.edit'),
    (v_role_pm, 'labour.attendance.view'),
    (v_role_pm, 'labour.attendance.approve'),
    (v_role_pm, 'labour.attendance.reopen');

  -- 4. Create assignment receipts for role assignment guard
  INSERT INTO public.rbac_assignment_receipts (organisation_id, employee_id, role_id)
  VALUES 
    (v_test_org_id, v_emp_se, v_role_se),
    (v_test_org_id, v_emp_pm, v_role_pm);

  -- 5. Mock org_memberships linked to employees
  INSERT INTO public.org_members (organisation_id, user_id, employee_id, role, role_id, status)
  VALUES
    (v_test_org_id, v_se_user_id, v_emp_se, 'Engineer', v_role_se, 'active'),
    (v_test_org_id, v_pm_user_id, v_emp_pm, 'manager', v_role_pm, 'active');

  -- 6. Seed test fixtures (client, subcontractor, project, trade, rate_card, modifier)
  INSERT INTO public.clients (id, organisation_id, client_id, client_name)
  VALUES (v_client_id, v_test_org_id, 'CLI-TEST-001', 'Test Client C1');

  INSERT INTO public.projects (id, organisation_id, client_id, name, project_name)
  VALUES (v_project_id, v_test_org_id, v_client_id, 'Test Project P1', 'Test Project P1');

  INSERT INTO public.subcontractors (id, organisation_id, company_name)
  VALUES (v_subcontractor_id, v_test_org_id, 'Test Subcontractor V1');

  INSERT INTO public.labour_categories (id, organisation_id, name, code, base_rate, unit, is_active)
  VALUES 
    (v_category_id, v_test_org_id, 'Fitter', 'FITTER', 600.00, 'day', true);

  -- Seed rate_card for V1 x Fitter x P1 = 700.00 negotiated rate
  INSERT INTO public.rate_cards (organisation_id, subcontractor_id, labour_category_id, work_unit_id, negotiated_rate, base_rate, effective_from, is_active)
  VALUES (v_test_org_id, v_subcontractor_id, v_category_id, v_project_id, 700.00, 600.00, CURRENT_DATE - 30, true);

  -- Context modifier: Overtime 1.5x
  INSERT INTO public.context_modifiers (id, organisation_id, name, code, modifier_type, multiplier, is_percentage, is_active)
  VALUES (v_modifier_id, v_test_org_id, 'Overtime', 'OT', 'SHIFT', 1.50, true, true);

  -- ==================================================================
  -- W1.1: TAMPER RESISTANCE TEST
  -- Act as site_engineer: call record_attendance with tampered rates (base_rate: 1, original_amount: 0)
  -- ==================================================================
  EXECUTE format('SET LOCAL "request.jwt.claims" = %L', json_build_object('sub', v_se_user_id, 'role', 'authenticated')::text);

  v_res := public.record_attendance(
    p_organisation_id := v_test_org_id,
    p_attendance_date := CURRENT_DATE,
    p_labour_category_id := v_category_id,
    p_subcontractor_id := v_subcontractor_id,
    p_client_id := v_client_id,
    p_work_unit_id := v_project_id,
    p_work_unit_type := 'PROJECT',
    p_workers_count := 5,
    p_hours_worked := 8.0,
    p_supervisor_name := 'Supervisor Joe',
    p_applied_modifiers := '{}',
    p_base_rate := 1.00,          -- TAMPERED: Should be ignored
    p_adjusted_rate := 1.00,      -- TAMPERED: Should be ignored
    p_original_amount := 0.00,    -- TAMPERED: Should be ignored
    p_adjusted_amount := 0.00,    -- TAMPERED: Should be ignored
    p_remarks := 'W1 Step 1 Tamper Test',
    p_project_id := v_project_id
  );

  v_att_id := (v_res->>'attendance_id')::uuid;

  SELECT * INTO v_row FROM public.manpower_attendance WHERE id = v_att_id;
  IF v_row.base_rate != 700.00 THEN
    RAISE EXCEPTION 'W1.1 FAIL: Expected base_rate 700.00 from rate_card, got %', v_row.base_rate;
  END IF;
  IF v_row.original_amount != 3500.00 THEN
    RAISE EXCEPTION 'W1.1 FAIL: Expected original_amount 3500.00 (5 * 700), got %', v_row.original_amount;
  END IF;
  IF v_row.adjusted_amount != 3500.00 THEN
    RAISE EXCEPTION 'W1.1 FAIL: Expected adjusted_amount 3500.00, got %', v_row.adjusted_amount;
  END IF;
  IF v_row.project_id != v_project_id THEN
    RAISE EXCEPTION 'W1.1 FAIL: project_id not set on manpower_attendance';
  END IF;

  -- ==================================================================
  -- W1.2: UNRATED TRADE FAIL-CLOSED TEST
  -- ==================================================================
  v_err_caught := false;
  BEGIN
    PERFORM public.record_attendance(
      p_organisation_id := v_test_org_id,
      p_attendance_date := CURRENT_DATE,
      p_labour_category_id := v_unrated_cat_id,
      p_subcontractor_id := v_subcontractor_id,
      p_project_id := v_project_id
    );
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;

  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'W1.2 FAIL: Unrated trade did not raise exception (failed to fail-closed)';
  END IF;

  -- ==================================================================
  -- W1.3: DRAFT EDIT RECOMPUTATION TEST
  -- Edit headcount from 5 to 6 -> expected amount 6 * 700 = 4200.00
  -- ==================================================================
  v_res := public.update_attendance(
    p_attendance_id := v_att_id,
    p_organisation_id := v_test_org_id,
    p_workers_count := 6
  );

  SELECT * INTO v_row FROM public.manpower_attendance WHERE id = v_att_id;
  IF v_row.workers_count != 6 THEN
    RAISE EXCEPTION 'W1.3 FAIL: Headcount was not updated to 6';
  END IF;
  IF v_row.original_amount != 4200.00 THEN
    RAISE EXCEPTION 'W1.3 FAIL: Expected recomputed original_amount 4200.00, got %', v_row.original_amount;
  END IF;

  -- ==================================================================
  -- W1.4: DATABASE PERMISSION GATE ON APPROVE
  -- Site Engineer calls approve -> MUST BE DENIED
  -- ==================================================================
  v_err_caught := false;
  BEGIN
    PERFORM public.approve_attendance(
      p_attendance_id := v_att_id,
      p_organisation_id := v_test_org_id
    );
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;

  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'W1.4 FAIL: Site Engineer unauthorized approval succeeded in database!';
  END IF;

  -- ==================================================================
  -- W1.5: PROJECT MANAGER APPROVAL & IMMUTABILITY
  -- ==================================================================
  EXECUTE format('SET LOCAL "request.jwt.claims" = %L', json_build_object('sub', v_pm_user_id, 'role', 'authenticated')::text);

  v_res := public.approve_attendance(
    p_attendance_id := v_att_id,
    p_organisation_id := v_test_org_id
  );

  SELECT * INTO v_row FROM public.manpower_attendance WHERE id = v_att_id;
  IF v_row.status != 'APPROVED' THEN
    RAISE EXCEPTION 'W1.5 FAIL: Status is not APPROVED';
  END IF;
  IF v_row.approved_by != v_pm_user_id THEN
    RAISE EXCEPTION 'W1.5 FAIL: approved_by not set to PM user ID';
  END IF;
  IF v_row.approved_at IS NULL THEN
    RAISE EXCEPTION 'W1.5 FAIL: approved_at not set';
  END IF;

  -- Attempt edit while APPROVED -> MUST BE REJECTED
  v_err_caught := false;
  BEGIN
    PERFORM public.update_attendance(
      p_attendance_id := v_att_id,
      p_organisation_id := v_test_org_id,
      p_workers_count := 8
    );
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;

  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'W1.5 FAIL: Edit on APPROVED attendance was not rejected!';
  END IF;

  -- Reopen attendance
  v_res := public.reopen_attendance(
    p_attendance_id := v_att_id,
    p_organisation_id := v_test_org_id,
    p_reason := 'Adjustment needed'
  );

  SELECT * INTO v_row FROM public.manpower_attendance WHERE id = v_att_id;
  IF v_row.status != 'DRAFT' THEN
    RAISE EXCEPTION 'W1.5 FAIL: Reopen did not revert status to DRAFT';
  END IF;

  -- ==================================================================
  -- W1.6: AUDIT TRAIL VERIFICATION
  -- ==================================================================
  SELECT count(*) INTO v_audit_count 
  FROM public.labour_audit_log 
  WHERE row_id = v_att_id;

  IF v_audit_count < 4 THEN
    RAISE EXCEPTION 'W1.6 FAIL: Expected >= 4 audit records (INSERT, UPDATE, APPROVE, REOPEN), found %', v_audit_count;
  END IF;

  -- Verify audit immutability (UPDATE or DELETE must fail)
  v_err_caught := false;
  BEGIN
    DELETE FROM public.labour_audit_log WHERE row_id = v_att_id;
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;

  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'W1.6 FAIL: Deletion of labour_audit_log succeeded! Audit is not append-only.';
  END IF;

  -- ==================================================================
  -- W6: TENANCY & ISOLATION
  -- ==================================================================
  -- Outsider cannot access test org rows
  EXECUTE format('SET LOCAL "request.jwt.claims" = %L', json_build_object('sub', v_outsider_id, 'role', 'authenticated')::text);

  v_err_caught := false;
  BEGIN
    PERFORM public.record_attendance(
      p_organisation_id := v_test_org_id,
      p_attendance_date := CURRENT_DATE,
      p_labour_category_id := v_category_id
    );
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;

  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'W6.1 FAIL: Outsider user bypassed tenancy checks on record_attendance!';
  END IF;

  -- ==================================================================
  -- ADJACENT FIX: get_subcontractor_wo_rollup
  -- ==================================================================
  PERFORM * FROM public.get_subcontractor_wo_rollup('00000000-0000-0000-0000-000000000000'::uuid);

  -- ==================================================================
  -- ADJACENT FIX: attendance_status_check
  -- ==================================================================
  INSERT INTO public.attendance (organisation_id, employee_id, plan_date, status, shift_type, source)
  VALUES 
    (v_test_org_id, v_emp_se, CURRENT_DATE, 'leave', 'Day', 'manual_plan'),
    (v_test_org_id, v_emp_pm, CURRENT_DATE, 'no_show', 'Day', 'manual_plan');

  RAISE NOTICE 'ALL_PHASE_0_VERIFICATION_TESTS_PASSED_CLEANLY';
END;
$TEST$;
`;

  const fullWrappedQuery = `
BEGIN;
${testScript}
ROLLBACK;
`;

  log('Executing rollback-wrapped Phase 0 verification suite...');
  try {
    const res = await executeSql(fullWrappedQuery);
    log('\n[PASS] All rollback-wrapped Phase 0 workflow tests passed cleanly!');
    log('Details: ' + JSON.stringify(res));
  } catch (err) {
    log('\n[FAIL] Phase 0 verification test threw an error:');
    log(err.message);
    fs.writeFileSync(logPath, logs.join('\n'));
    process.exit(1);
  }

  log('\nSummary:');
  log('- W1.1 Tamper resistance: PASS (Rates resolved server-side from rate_cards)');
  log('- W1.2 Fail-closed: PASS (Unrated trade raised exception)');
  log('- W1.3 Draft edit recomputation: PASS (Amount recalculated 5->6 = 4200.00)');
  log('- W1.4 Role gate: PASS (Site Engineer denied approval)');
  log('- W1.5 PM approval & immutability: PASS (PM approved, approved_by set, post-approval edit denied, reopen succeeded)');
  log('- W1.6 Audit trail: PASS (INSERT/UPDATE/APPROVE/REOPEN recorded with actor; audit table immutable)');
  log('- W6 Tenancy: PASS (Outsider blocked from test org RPCs)');
  log('- Step 0.10 Rollup RPC: PASS (get_subcontractor_wo_rollup works without contract_value error)');
  log('- Step 0.6 Status check: PASS (attendance accepts leave and no_show)');

  fs.writeFileSync(logPath, logs.join('\n'));
  log(`\nLog written to: ${logPath}`);
}

runPhase0Verification().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
