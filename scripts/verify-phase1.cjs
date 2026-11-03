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

async function runPhase1Verification() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logDir = path.resolve(__dirname, '../docs/labour-attendance/verification');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  const logPath = path.join(logDir, `phase1-w1-w4-w5a-w6-w9-${timestamp}.log`);

  const logs = [];
  function log(msg) {
    console.log(msg);
    logs.push(msg);
  }

  log('====================================================================');
  log(`PHASE 1 WORKFLOW VERIFICATION (W1, W4, W5a, W6, W9)`);
  log(`Started at: ${new Date().toISOString()}`);
  log('====================================================================\n');

  const testScript = `
DO $SUITE$
DECLARE
  -- Organisations: Org A (EPC), Org B (Labour Contractor), Org C (Outsider)
  v_org_a UUID := gen_random_uuid();
  v_org_b UUID := gen_random_uuid();
  v_org_c UUID := gen_random_uuid();

  -- Users
  v_user_se UUID;
  v_user_pm UUID;
  v_user_owner_b UUID;
  v_user_outsider UUID;

  -- Employees
  v_emp_se UUID := gen_random_uuid();
  v_emp_pm UUID := gen_random_uuid();
  v_emp_b UUID := gen_random_uuid();
  v_emp_out UUID := gen_random_uuid();

  -- Roles
  v_role_se UUID := gen_random_uuid();
  v_role_pm UUID := gen_random_uuid();
  v_role_owner_b UUID := gen_random_uuid();
  v_role_out UUID := gen_random_uuid();

  -- Domain fixtures
  v_client_c1 UUID := gen_random_uuid();
  v_project_p1 UUID := gen_random_uuid();
  v_vendor_v1 UUID := gen_random_uuid();
  v_cat_fitter UUID := gen_random_uuid();
  v_cat_welder UUID := gen_random_uuid();
  v_mod_ot UUID := gen_random_uuid();

  -- Party & Worker fixtures
  v_party_firm UUID := gen_random_uuid();
  v_casual_worker UUID;
  v_own_worker UUID;

  -- Workflow outputs
  v_plan_res JSONB;
  v_plan_id UUID;
  v_actual_res JSONB;
  v_actual_id UUID;
  v_att_res JSONB;
  v_att_id UUID;
  v_legacy RECORD;
  v_view_row RECORD;
  v_err_caught BOOLEAN;
  v_audit_count INT;
BEGIN
  -- 0. Fetch real users for auth linkage
  SELECT id INTO v_user_se FROM auth.users ORDER BY created_at LIMIT 1;
  SELECT id INTO v_user_pm FROM auth.users ORDER BY created_at OFFSET 1 LIMIT 1;
  SELECT id INTO v_user_owner_b FROM auth.users ORDER BY created_at OFFSET 2 LIMIT 1;
  IF v_user_owner_b IS NULL THEN v_user_owner_b := v_user_pm; END IF;
  SELECT id INTO v_user_outsider FROM auth.users ORDER BY created_at OFFSET 3 LIMIT 1;
  IF v_user_outsider IS NULL THEN v_user_outsider := gen_random_uuid(); END IF;

  -- 1. Create Organisations
  INSERT INTO public.organisations (id, name) VALUES (v_org_a, '__verify_p1_org_a__');
  INSERT INTO public.organisations (id, name) VALUES (v_org_b, '__verify_p1_org_b__');
  INSERT INTO public.organisations (id, name) VALUES (v_org_c, '__verify_p1_org_c__');

  -- 2. Create Employees
  INSERT INTO public.employees (id, organisation_id, name, email, status)
  VALUES 
    (v_emp_se, v_org_a, 'SE OrgA', 'se@example.com', 'active'),
    (v_emp_pm, v_org_a, 'PM OrgA', 'pm@example.com', 'active'),
    (v_emp_b, v_org_b, 'Owner OrgB', 'ownerb@example.com', 'active'),
    (v_emp_out, v_org_c, 'Outsider OrgC', 'out@example.com', 'active');

  -- 3. Create Roles
  INSERT INTO public.roles (id, organisation_id, name, is_system, is_active)
  VALUES
    (v_role_se, v_org_a, 'Site Engineer', false, true),
    (v_role_pm, v_org_a, 'Project Manager', false, true),
    (v_role_owner_b, v_org_b, 'Contractor Owner', false, true),
    (v_role_out, v_org_c, 'Viewer', false, true);

  -- Role permissions
  INSERT INTO public.role_permissions (role_id, permission_key)
  VALUES
    -- SE Org A: create + edit + view
    (v_role_se, 'labour.attendance.create'),
    (v_role_se, 'labour.attendance.edit'),
    (v_role_se, 'labour.attendance.view'),
    -- PM Org A: create + edit + view + approve + reopen + rates
    (v_role_pm, 'labour.attendance.create'),
    (v_role_pm, 'labour.attendance.edit'),
    (v_role_pm, 'labour.attendance.view'),
    (v_role_pm, 'labour.attendance.approve'),
    (v_role_pm, 'labour.attendance.reopen'),
    (v_role_pm, 'labour.rates.manage'),
    (v_role_pm, 'labour.workers.manage'),
    -- Owner Org B: all labour permissions
    (v_role_owner_b, 'labour.attendance.create'),
    (v_role_owner_b, 'labour.attendance.edit'),
    (v_role_owner_b, 'labour.attendance.view'),
    (v_role_owner_b, 'labour.attendance.approve'),
    (v_role_owner_b, 'labour.workers.manage'),
    (v_role_owner_b, 'labour.rates.manage'),
    -- Outsider Org C: view only
    (v_role_out, 'labour.attendance.view');

  -- 4. Assignment receipts & Org Memberships
  INSERT INTO public.rbac_assignment_receipts (organisation_id, employee_id, role_id)
  VALUES
    (v_org_a, v_emp_se, v_role_se),
    (v_org_a, v_emp_pm, v_role_pm),
    (v_org_b, v_emp_b, v_role_owner_b),
    (v_org_c, v_emp_out, v_role_out);

  INSERT INTO public.org_members (organisation_id, user_id, employee_id, role, role_id, status)
  VALUES
    (v_org_a, v_user_se, v_emp_se, 'Engineer', v_role_se, 'active'),
    (v_org_a, v_user_pm, v_emp_pm, 'manager', v_role_pm, 'active'),
    (v_org_b, v_user_owner_b, v_emp_b, 'admin', v_role_owner_b, 'active'),
    (v_org_c, v_user_outsider, v_emp_out, 'member', v_role_out, 'active');

  -- 5. Seed Trades & Rate Cards in Org A
  INSERT INTO public.labour_categories (id, organisation_id, name, code, base_rate, unit, is_active)
  VALUES 
    (v_cat_fitter, v_org_a, 'Fitter', 'FITTER', 600.00, 'day', true),
    (v_cat_welder, v_org_a, 'Welder', 'WELDER', 750.00, 'day', true);

  -- Legacy client & project & subcontractor in Org A
  INSERT INTO public.clients (id, organisation_id, client_id, client_name)
  VALUES (v_client_c1, v_org_a, 'C-C1-001', 'Client C1 EPC');

  INSERT INTO public.projects (id, organisation_id, client_id, name, project_name)
  VALUES (v_project_p1, v_org_a, v_client_c1, 'Project P1 Alpha', 'Project P1 Alpha');

  INSERT INTO public.subcontractors (id, organisation_id, company_name)
  VALUES (v_vendor_v1, v_org_a, 'Subcontractor V1 Quality MEP');

  -- Rate card: V1 x Fitter x P1 = 700.00
  INSERT INTO public.rate_cards (organisation_id, subcontractor_id, labour_category_id, work_unit_id, negotiated_rate, base_rate, effective_from, is_active)
  VALUES (v_org_a, v_vendor_v1, v_cat_fitter, v_project_p1, 700.00, 600.00, CURRENT_DATE - 30, true);

  -- =========================================================================
  -- SUITE W9: UNIFIED PARTIES & DEDUPLICATION / RESOLVER
  -- =========================================================================
  RAISE NOTICE '>>> RUNNING SUITE W9: Parties & Deduplication';

  -- Create a firm in Org B that has GSTIN '33ABCDE9999F1Z1'
  INSERT INTO public.parties (id, organisation_id, name, gstin, phone, email, address, status)
  VALUES (v_party_firm, v_org_b, 'Apex Multi Services', '33ABCDE9999F1Z1', '9888877777', 'apex@example.com', 'Mumbai', 'Active');

  -- Act as Owner B
  EXECUTE format('SET LOCAL "request.jwt.claims" = %L', json_build_object('sub', v_user_owner_b, 'role', 'authenticated')::text);

  -- Resolve legacy ID as customer
  SELECT * INTO v_legacy FROM public.resolve_legacy_ids(v_party_firm, 'customer');
  ASSERT v_legacy.legacy_id IS NOT NULL, 'W9.1: resolve_legacy_ids customer failed';
  ASSERT v_legacy.legacy_table = 'clients', 'W9.1: expected table clients';
  ASSERT (SELECT party_id FROM public.clients WHERE id = v_legacy.legacy_id) = v_party_firm, 'W9.1: mirror client party_id mismatch';

  -- Resolve legacy ID as subcontractor (same party, second role)
  SELECT * INTO v_legacy FROM public.resolve_legacy_ids(v_party_firm, 'subcontractor');
  ASSERT v_legacy.legacy_id IS NOT NULL, 'W9.2: resolve_legacy_ids subcontractor failed';
  ASSERT v_legacy.legacy_table = 'subcontractors', 'W9.2: expected table subcontractors';
  ASSERT (SELECT party_id FROM public.subcontractors WHERE id = v_legacy.legacy_id) = v_party_firm, 'W9.2: mirror subcontractor party_id mismatch';

  -- Assert party has BOTH roles in party_roles
  ASSERT (SELECT count(*) FROM public.party_roles WHERE party_id = v_party_firm) = 2, 'W9.3: expected exactly 2 roles for unified party';
  RAISE NOTICE 'W9 PASSED: Unified parties and resolver verified.';

  -- =========================================================================
  -- SUITE W5a: LABOUR-CONTRACTOR WORKERS (D4)
  -- =========================================================================
  RAISE NOTICE '>>> RUNNING SUITE W5a: Workers Model';

  -- Seed trade in Org B
  DECLARE
    v_cat_plumber_b UUID := gen_random_uuid();
  BEGIN
    INSERT INTO public.labour_categories (id, organisation_id, name, code, base_rate, unit, is_active)
    VALUES (v_cat_plumber_b, v_org_b, 'Plumber B', 'PLUMB-B', 800.00, 'day', true);

    -- Quick add casual worker in Org B: rate 850
    SELECT public.quick_add_worker(
      p_organisation_id := v_org_b,
      p_name := 'Ramesh Casual Plumber',
      p_trade_id := v_cat_plumber_b,
      p_default_rate := 850.00,
      p_phone := '9876501234',
      p_worker_type := 'casual',
      p_pay_basis := 'daily',
      p_payout_ref := 'ramesh@upi',
      p_vendor_party_id := v_party_firm
    ) INTO v_casual_worker;

    ASSERT v_casual_worker IS NOT NULL, 'W5a.1: quick_add_worker failed';
    ASSERT (SELECT default_rate FROM public.labour_workers WHERE id = v_casual_worker) = 850.00, 'W5a.1: default_rate mismatch';

    -- Record attendance in Org B using named casual worker: 1 worker x 8h @ 850 = 850.00
    v_att_res := public.record_attendance(
      p_organisation_id := v_org_b,
      p_attendance_date := CURRENT_DATE,
      p_labour_category_id := v_cat_plumber_b,
      p_subcontractor_id := NULL,
      p_client_id := NULL,
      p_work_unit_id := NULL,
      p_work_unit_type := 'GENERAL',
      p_workers_count := 1,
      p_hours_worked := 8.0,
      p_supervisor_name := 'B Supervisor',
      p_applied_modifiers := '[]'::jsonb,
      p_base_rate := NULL,
      p_adjusted_rate := NULL,
      p_original_amount := NULL,
      p_adjusted_amount := NULL,
      p_remarks := 'Casual plumber attendance',
      p_project_id := NULL,
      p_worker_id := v_casual_worker
    );

    v_att_id := (v_att_res->>'id')::uuid;
    ASSERT (SELECT base_rate FROM public.manpower_attendance WHERE id = v_att_id) = 850.00, 'W5a.2: base_rate not 850';
    ASSERT (SELECT adjusted_amount FROM public.manpower_attendance WHERE id = v_att_id) = 850.00, 'W5a.2: amount not 850';
    ASSERT (SELECT worker_id FROM public.manpower_attendance WHERE id = v_att_id) = v_casual_worker, 'W5a.2: worker_id not set';

    -- Check constraint: worker_id AND employee_id cannot both be set
    v_err_caught := false;
    BEGIN
      INSERT INTO public.manpower_attendance (
        organisation_id, attendance_date, labour_category_id, base_rate, adjusted_rate, original_amount, adjusted_amount,
        worker_id, employee_id
      ) VALUES (
        v_org_b, CURRENT_DATE, v_cat_plumber_b, 850, 850, 850, 850,
        v_casual_worker, v_emp_b
      );
    EXCEPTION WHEN check_violation THEN
      v_err_caught := true;
    END;
    ASSERT v_err_caught = true, 'W5a.3: chk_worker_or_employee failed to reject simultaneous worker + employee';
    RAISE NOTICE 'W5a PASSED: Workers model and constraints verified.';
  END;

  -- =========================================================================
  -- SUITE W4: PLANNED VS ACTUAL (D2)
  -- =========================================================================
  RAISE NOTICE '>>> RUNNING SUITE W4: Planned vs Actual Attendance';

  -- Act as Site Engineer in Org A
  EXECUTE format('SET LOCAL "request.jwt.claims" = %L', json_build_object('sub', v_user_se, 'role', 'authenticated')::text);

  -- 1. Create a PLANNED row: 5 fitters x 8h @ V1 rate (700.00) = 3500.00
  v_plan_res := public.plan_labour(
    p_organisation_id := v_org_a,
    p_attendance_date := CURRENT_DATE + 1,
    p_labour_category_id := v_cat_fitter,
    p_workers_count := 5,
    p_subcontractor_id := v_vendor_v1,
    p_client_id := v_client_c1,
    p_project_id := v_project_p1,
    p_confirmation := 'planned_unconfirmed',
    p_remarks := 'Planned site fitters for tomorrow'
  );

  v_plan_id := (v_plan_res->>'id')::uuid;
  ASSERT v_plan_id IS NOT NULL, 'W4.1: plan_labour failed';
  ASSERT (SELECT entry_kind FROM public.manpower_attendance WHERE id = v_plan_id) = 'PLANNED', 'W4.1: entry_kind not PLANNED';
  ASSERT (SELECT client_confirmation FROM public.manpower_attendance WHERE id = v_plan_id) = 'planned_unconfirmed', 'W4.1: confirmation mismatch';
  ASSERT (SELECT base_rate FROM public.manpower_attendance WHERE id = v_plan_id) = 700.00, 'W4.1: rate card 700 not resolved for plan';
  ASSERT (SELECT original_amount FROM public.manpower_attendance WHERE id = v_plan_id) = 3500.00, 'W4.1: plan amount not 3500';

  -- 2. Confirm plan with client: update to 'confirmed'
  PERFORM public.confirm_plan_with_client(v_plan_id, v_org_a, 'confirmed');
  ASSERT (SELECT client_confirmation FROM public.manpower_attendance WHERE id = v_plan_id) = 'confirmed', 'W4.2: confirmation not updated to confirmed';

  -- 3. convert_plan_to_actual with actual headcount 4 (planned was 5): 4 x 8h @ 700 = 2800.00
  v_actual_res := public.convert_plan_to_actual(
    p_plan_id := v_plan_id,
    p_organisation_id := v_org_a,
    p_actual_headcount := 4,
    p_actual_hours := 8.0,
    p_supervisor_name := 'Supervisor Joe',
    p_applied_modifiers := '[]'::jsonb,
    p_remarks := 'Actual deployment: 1 worker was absent'
  );

  v_actual_id := (v_actual_res->>'id')::uuid;
  ASSERT v_actual_id IS NOT NULL, 'W4.3: convert_plan_to_actual failed';
  ASSERT (SELECT status FROM public.manpower_attendance WHERE id = v_plan_id) = 'CONVERTED', 'W4.3: plan status not CONVERTED';
  ASSERT (SELECT planned_from_id FROM public.manpower_attendance WHERE id = v_actual_id) = v_plan_id, 'W4.3: planned_from_id not linked';
  ASSERT (SELECT entry_kind FROM public.manpower_attendance WHERE id = v_actual_id) = 'ACTUAL', 'W4.3: entry_kind not ACTUAL';
  ASSERT (SELECT workers_count FROM public.manpower_attendance WHERE id = v_actual_id) = 4, 'W4.3: actual headcount not 4';
  ASSERT (SELECT adjusted_amount FROM public.manpower_attendance WHERE id = v_actual_id) = 2800.00, 'W4.3: actual amount not 2800.00 (hand-computed: 4 x 700)';

  -- 4. Check View v_planned_vs_actual
  SELECT * INTO v_view_row FROM public.v_planned_vs_actual WHERE plan_id = v_plan_id;
  ASSERT v_view_row.plan_id = v_plan_id, 'W4.4: view plan_id mismatch';
  ASSERT v_view_row.planned_headcount = 5, 'W4.4: view planned_headcount not 5';
  ASSERT v_view_row.actual_headcount = 4, 'W4.4: view actual_headcount not 4';
  ASSERT v_view_row.headcount_variance = -1, 'W4.4: view headcount_variance not -1 (4 - 5)';
  ASSERT v_view_row.actual_amount = 2800.00, 'W4.4: view actual_amount not 2800.00';
  RAISE NOTICE 'W4 PASSED: Planned vs Actual workflow verified.';

  -- =========================================================================
  -- SUITE W1: REGRESSION (APPROVAL & TAMPER RESISTANCE)
  -- =========================================================================
  RAISE NOTICE '>>> RUNNING SUITE W1: Regression on Approval and Rates';

  -- Site Engineer tries to approve -> must fail
  v_err_caught := false;
  BEGIN
    PERFORM public.approve_attendance(v_actual_id, v_org_a);
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  ASSERT v_err_caught = true, 'W1.1: SE approval should have been denied';

  -- Act as Project Manager Org A
  EXECUTE format('SET LOCAL "request.jwt.claims" = %L', json_build_object('sub', v_user_pm, 'role', 'authenticated')::text);

  -- PM approves
  PERFORM public.approve_attendance(v_actual_id, v_org_a);
  ASSERT (SELECT status FROM public.manpower_attendance WHERE id = v_actual_id) = 'APPROVED', 'W1.2: PM approval failed';
  ASSERT (SELECT approved_by FROM public.manpower_attendance WHERE id = v_actual_id) = v_user_pm, 'W1.2: approved_by not set';

  -- Post-approval edit must fail
  v_err_caught := false;
  BEGIN
    PERFORM public.update_attendance(v_actual_id, v_org_a, 5, 8.0, 'Supervisor Joe', 'Attempted edit');
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  ASSERT v_err_caught = true, 'W1.3: Post-approval edit should have failed';

  -- Reopen attendance by PM
  PERFORM public.reopen_attendance(v_actual_id, v_org_a, 'Adjusting supervisor note');
  ASSERT (SELECT status FROM public.manpower_attendance WHERE id = v_actual_id) = 'DRAFT', 'W1.4: Reopen failed';
  RAISE NOTICE 'W1 PASSED: Regression suite verified.';

  -- =========================================================================
  -- SUITE W6: TENANCY BARRIERS & AUDIT IMMUTABILITY
  -- =========================================================================
  RAISE NOTICE '>>> RUNNING SUITE W6: Tenancy, Permissions, and Immutability';

  -- Act as Outsider in Org C
  EXECUTE format('SET LOCAL "request.jwt.claims" = %L', json_build_object('sub', v_user_outsider, 'role', 'authenticated')::text);

  -- 1. Outsider cannot access Org A or Org B
  ASSERT public.user_can_access_org(v_org_a) = false, 'W6.1: Outsider has access to Org A';
  ASSERT public.user_can_access_org(v_org_b) = false, 'W6.1: Outsider has access to Org B';

  -- 2. Outsider calls convert_plan_to_actual on Org A's plan -> must fail
  v_err_caught := false;
  BEGIN
    PERFORM public.convert_plan_to_actual(v_plan_id, v_org_a, 3, 8.0, 'Hacker', '[]'::jsonb, 'Illicit convert');
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  ASSERT v_err_caught = true, 'W6.2: Outsider converted foreign org plan';

  -- 3. Outsider calls quick_add_worker on Org B -> must fail
  v_err_caught := false;
  BEGIN
    PERFORM public.quick_add_worker(v_org_b, 'Hacker Worker', v_cat_fitter, 1000);
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  ASSERT v_err_caught = true, 'W6.3: Outsider created worker in foreign org';

  -- 4. Outsider calls plan_labour on Org A -> must fail
  v_err_caught := false;
  BEGIN
    PERFORM public.plan_labour(v_org_a, CURRENT_DATE, v_cat_fitter, 5);
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  ASSERT v_err_caught = true, 'W6.4: Outsider created plan in foreign org';

  -- 5. Outsider calls resolve_legacy_ids on Org B's party -> must fail
  v_err_caught := false;
  BEGIN
    PERFORM public.resolve_legacy_ids(v_party_firm, 'subcontractor');
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  ASSERT v_err_caught = true, 'W6.5: Outsider resolved foreign org party';

  -- 6. Assert audit rows were logged for the actions above
  SELECT count(*) INTO v_audit_count FROM public.labour_audit_log WHERE organisation_id IN (v_org_a, v_org_b);
  ASSERT v_audit_count > 0, 'W6.6: Expected audit rows for attendance and worker mutations';

  -- 7. Assert audit table immutability (UPDATE or DELETE forbidden)
  v_err_caught := false;
  BEGIN
    DELETE FROM public.labour_audit_log WHERE organisation_id = v_org_a;
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  ASSERT v_err_caught = true, 'W6.7: Audit log deletion must be blocked by security trigger';
  RAISE NOTICE 'W6 PASSED: Tenancy and immutability verified.';

END $SUITE$;
`;

  log('[VERIFY] Executing verification suite against database inside rollback wrapper...');
  await executeSql(`BEGIN;\n${testScript}\nROLLBACK;`);
  log('[VERIFY] Transaction completed and rolled back cleanly. 0 leftover test rows!');

  log('\n====================================================================');
  log('ALL PHASE 1 SUITES PASSED CLEANLY (W1, W4, W5a, W6, W9)');
  log(`Finished at: ${new Date().toISOString()}`);
  log('====================================================================');

  fs.writeFileSync(logPath, logs.join('\n'), 'utf8');
  console.log(`[LOG] Saved raw verification log to ${logPath}`);
}

runPhase1Verification().catch(err => {
  console.error('[FAILED] Verification failed:', err);
  process.exit(1);
});
