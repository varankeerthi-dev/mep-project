const fs = require('fs');
const path = require('path');

const SUPABASE_QUERY_URL = 'https://api.supabase.com/v1/projects/rujqejtisqermjyqqgoj/database/query';
const SUPABASE_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || '';

async function queryDb(sql) {
  const res = await fetch(SUPABASE_QUERY_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DB Error (${res.status}): ${err}`);
  }

  return await res.json();
}

async function main() {
  console.log('[TEST] Reading Phase 3 migration file...');
  const migrationPath = path.resolve(__dirname, '../apps/web/supabase/migrations/20261103040000_phase3_contractor_wages_measurements.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  console.log('[TEST] Verifying Phase 3 migration inside a rollback-wrapped transaction...');

  const testScript = `
    BEGIN;

    -- Apply the migration DDL
    ${migrationSql}

    -- Verification 1: Schema Checks
    DO $$
    BEGIN
      ASSERT (SELECT count(*) FROM information_schema.tables WHERE table_name = 'labour_wage_runs') = 1, 'labour_wage_runs table missing';
      ASSERT (SELECT count(*) FROM information_schema.tables WHERE table_name = 'labour_wage_lines') = 1, 'labour_wage_lines table missing';
      ASSERT (SELECT count(*) FROM information_schema.tables WHERE table_name = 'labour_wage_line_sources') = 1, 'labour_wage_line_sources table missing';
      ASSERT (SELECT count(*) FROM information_schema.tables WHERE table_name = 'labour_advances') = 1, 'labour_advances table missing';
      ASSERT (SELECT count(*) FROM information_schema.tables WHERE table_name = 'labour_measurements') = 1, 'labour_measurements table missing';
      ASSERT (SELECT count(*) FROM information_schema.columns WHERE table_name = 'organisations' AND column_name = 'business_profile') = 1, 'business_profile column missing';
      ASSERT (SELECT count(*) FROM information_schema.columns WHERE table_name = 'rate_cards' AND column_name = 'pay_basis') = 1, 'pay_basis column missing';
      ASSERT (SELECT count(*) FROM information_schema.columns WHERE table_name = 'manpower_attendance' AND column_name = 'productivity_only') = 1, 'productivity_only column missing';
    END $$;

    -- Verification 2: Full Wages & Measurement Workflows (W5c & W8)
    DO $$
    DECLARE
      v_org_id uuid := gen_random_uuid();
      v_user_id uuid;
      v_emp_id uuid := gen_random_uuid();
      v_role_id uuid := gen_random_uuid();
      v_worker_id uuid := gen_random_uuid();
      v_vendor_id uuid := gen_random_uuid();
      v_client_id uuid := gen_random_uuid();
      v_project_id uuid := gen_random_uuid();
      v_cat_id uuid := gen_random_uuid();

      v_adv_id uuid;
      v_att_id uuid;
      v_prod_att_id uuid;
      v_run_res jsonb;
      v_run_id uuid;
      v_pay_res jsonb;
      v_journal_id uuid;
      v_adv_row RECORD;

      v_meas_res jsonb;
      v_meas_id uuid;
      v_appr_meas_res jsonb;
      v_prod_row RECORD;
      v_margin_row RECORD;
    BEGIN
      SELECT id INTO v_user_id FROM auth.users ORDER BY created_at LIMIT 1;
      IF v_user_id IS NULL THEN
        v_user_id := gen_random_uuid();
        INSERT INTO auth.users (id, email, encrypted_password, aud, role)
        VALUES (v_user_id, 'test.p3@example.com', 'dummy-pw-hash', 'authenticated', 'authenticated');
      END IF;

      -- Create Org with business profile
      INSERT INTO public.organisations (id, name, business_profile)
      VALUES (v_org_id, 'Phase 3 Labour Contractor Org', 'labour_supplier');

      -- Employee & Role
      INSERT INTO public.employees (id, organisation_id, name, email, status)
      VALUES (v_emp_id, v_org_id, 'Contractor Owner', 'owner.p3@example.com', 'active');

      INSERT INTO public.roles (id, organisation_id, name, is_system, is_active)
      VALUES (v_role_id, v_org_id, 'Contractor Owner', false, true);

      INSERT INTO public.role_permissions (role_id, permission_key)
      VALUES 
        (v_role_id, 'labour.attendance.create'),
        (v_role_id, 'labour.attendance.edit'),
        (v_role_id, 'labour.attendance.view'),
        (v_role_id, 'labour.attendance.approve'),
        (v_role_id, 'labour.wages.run'),
        (v_role_id, 'labour.wages.pay'),
        (v_role_id, 'labour.wages.view'),
        (v_role_id, 'labour.measurement.entry'),
        (v_role_id, 'labour.measurement.approve'),
        (v_role_id, 'labour.rates.manage'),
        (v_role_id, 'labour.workers.manage');

      INSERT INTO public.rbac_assignment_receipts (organisation_id, employee_id, role_id)
      VALUES (v_org_id, v_emp_id, v_role_id);

      INSERT INTO public.org_members (organisation_id, user_id, employee_id, role, role_id, status)
      VALUES (v_org_id, v_user_id, v_emp_id, 'manager', v_role_id, 'active');

      -- Set JWT session claims
      EXECUTE format('SET LOCAL "request.jwt.claims" = %L', json_build_object(
        'sub', v_user_id,
        'role', 'authenticated',
        'aud', 'authenticated'
      )::text);

      -- Master Data
      INSERT INTO public.clients (id, organisation_id, client_id, client_name)
      VALUES (v_client_id, v_org_id, 'CLI-P3-001', 'General Contractor EPC');

      INSERT INTO public.subcontractors (id, organisation_id, company_name)
      VALUES (v_vendor_id, v_org_id, 'Subcontractor Crew Alpha');

      INSERT INTO public.parties (id, organisation_id, name, status)
      VALUES 
        (v_client_id, v_org_id, 'General Contractor EPC', 'active'),
        (v_vendor_id, v_org_id, 'Subcontractor Crew Alpha', 'active');

      INSERT INTO public.party_roles (party_id, role)
      VALUES (v_client_id, 'customer'), (v_vendor_id, 'subcontractor');

      INSERT INTO public.projects (id, organisation_id, client_id, name, project_name)
      VALUES (v_project_id, v_org_id, v_client_id, 'Metro Station Ducting', 'Metro Station Ducting');

      INSERT INTO public.labour_categories (id, organisation_id, name, code, base_rate, unit, is_active)
      VALUES (v_cat_id, v_org_id, 'Duct Erector', 'DUCT-01', 700.00, 'day', true);

      -- Casual Worker
      INSERT INTO public.labour_workers (
        id, organisation_id, name, phone, trade, worker_type, pay_basis, default_rate, is_active, payout_ref
      ) VALUES (
        v_worker_id, v_org_id, 'Ramesh Plumber', '9876543210', v_cat_id, 'casual', 'daily', 700.00, true, 'ramesh@upi'
      );

      -- =====================================================================
      -- WORKFLOW W5.c: ADVANCES & WAGE RUN
      -- =====================================================================
      -- 1. Give Advance of 1000 to Ramesh
      v_adv_id := public.give_labour_advance(
        p_organisation_id := v_org_id,
        p_worker_id := v_worker_id,
        p_amount := 1000.00,
        p_date := CURRENT_DATE - 7,
        p_notes := 'Emergency family medical advance'
      );
      ASSERT v_adv_id IS NOT NULL, 'give_labour_advance failed';

      -- 2. Log 5 days of attendance for Ramesh @ 700 = 3500 gross
      INSERT INTO public.manpower_attendance (
        organisation_id, attendance_date, labour_category_id, worker_id, workers_count,
        hours_worked, base_rate, adjusted_rate, original_amount, adjusted_amount,
        status, entry_kind, client_id, project_id
      ) VALUES (
        v_org_id, CURRENT_DATE - 3, v_cat_id, v_worker_id, 1,
        40.0, 700.00, 700.00, 3500.00, 3500.00,
        'APPROVED', 'ACTUAL', v_client_id, v_project_id
      ) RETURNING id INTO v_att_id;

      -- 3. Generate Wage Run (recover advance up to 1000 cap)
      v_run_res := public.generate_wage_run(
        p_organisation_id := v_org_id,
        p_period_from := CURRENT_DATE - 10,
        p_period_to := CURRENT_DATE,
        p_kind := 'weekly',
        p_max_advance_recovery_cap := 1000.00,
        p_idempotency_key := 'wr-test-key-01'
      );

      v_run_id := (v_run_res->>'run_id')::uuid;
      ASSERT v_run_id IS NOT NULL, 'generate_wage_run failed';
      ASSERT (v_run_res->>'total_gross')::numeric = 3500.00, 'Wage run gross mismatch (expected 3500.00)';
      ASSERT (v_run_res->>'total_advance_recovered')::numeric = 1000.00, 'Advance recovered mismatch (expected 1000.00)';
      ASSERT (v_run_res->>'total_net')::numeric = 2500.00, 'Net wages mismatch (expected 2500.00 = 3500 - 1000)';

      -- Assert wage line source join table populated
      ASSERT (SELECT count(*) FROM public.labour_wage_line_sources WHERE attendance_id = v_att_id) = 1,
        'labour_wage_line_sources entry missing for attendance row';

      -- 4. Approve Wage Run
      PERFORM public.approve_wage_run(v_run_id, v_org_id);
      ASSERT (SELECT status FROM public.labour_wage_runs WHERE id = v_run_id) = 'approved', 'Wage run not approved';

      -- 5. Pay Wage Run & verify balanced GL posting
      v_pay_res := public.pay_wage_run(
        p_run_id := v_run_id,
        p_organisation_id := v_org_id,
        p_idempotency_key := 'wr-pay-key-01'
      );

      v_journal_id := (v_pay_res->>'journal_id')::uuid;
      ASSERT v_journal_id IS NOT NULL, 'pay_wage_run journal_id missing';
      ASSERT (v_pay_res->>'gl_debit')::numeric = 3500.00, 'GL debit not 3500.00';
      ASSERT (v_pay_res->>'gl_credit')::numeric = 3500.00, 'GL credit not 3500.00';

      -- Assert advance marked recovered
      SELECT * INTO v_adv_row FROM public.labour_advances WHERE id = v_adv_id;
      ASSERT v_adv_row.recovered_amount = 1000.00, 'Advance recovered_amount not 1000.00';
      ASSERT v_adv_row.status = 'recovered', 'Advance status not recovered';

      -- Idempotency replay on pay_wage_run
      DECLARE
        v_pay_res2 jsonb;
      BEGIN
        v_pay_res2 := public.pay_wage_run(v_run_id, v_org_id, NULL, 'wr-pay-key-01');
        ASSERT (v_pay_res2->>'idempotent_replayed')::boolean = true, 'pay_wage_run idempotency replay failed';
      END;

      -- =====================================================================
      -- WORKFLOW W8: MEASUREMENT-BASED PAY (PER-METER)
      -- =====================================================================
      -- 1. Create per_meter rate card agreement: 120.00 / m
      INSERT INTO public.rate_cards (
        organisation_id, subcontractor_id, work_unit_id, labour_category_id,
        base_rate, negotiated_rate, pay_basis, unit, effective_from, is_active
      ) VALUES (
        v_org_id, v_vendor_id, v_project_id, v_cat_id,
        120.00, 120.00, 'per_meter', 'm', CURRENT_DATE - 30, true
      );

      -- 2. Log productivity-only attendance for vendor (5 mandays x 8h = 40h)
      -- In per_meter agreements, attendance does NOT generate daily payable
      INSERT INTO public.manpower_attendance (
        organisation_id, attendance_date, labour_category_id, subcontractor_id, workers_count,
        hours_worked, base_rate, adjusted_rate, original_amount, adjusted_amount,
        status, entry_kind, productivity_only, client_id, project_id
      ) VALUES (
        v_org_id, CURRENT_DATE - 2, v_cat_id, v_vendor_id, 5,
        8.0, 0.00, 0.00, 0.00, 0.00,
        'APPROVED', 'ACTUAL', true, v_client_id, v_project_id
      ) RETURNING id INTO v_prod_att_id;

      -- 3. Record measurement of 50 m -> server-resolved @ 120 = 6000.00
      v_meas_res := public.record_measurement(
        p_organisation_id := v_org_id,
        p_subcontractor_id := v_vendor_id,
        p_client_id := v_client_id,
        p_project_id := v_project_id,
        p_task := 'GI Duct Installation 500mm',
        p_unit := 'm',
        p_qty := 50.00,
        p_measurement_date := CURRENT_DATE - 2,
        p_evidence_notes := 'Inspection completed with client engineer'
      );

      v_meas_id := (v_meas_res->>'measurement_id')::uuid;
      ASSERT v_meas_id IS NOT NULL, 'record_measurement failed';
      ASSERT (v_meas_res->>'rate')::numeric = 120.00, 'Measurement rate not resolved to 120.00';
      ASSERT (v_meas_res->>'amount')::numeric = 6000.00, 'Measurement amount mismatch (expected 50 * 120 = 6000.00)';

      -- 4. Approve measurement -> drives the payable
      v_appr_meas_res := public.approve_measurement(v_meas_id, v_org_id);
      ASSERT (v_appr_meas_res->>'status') = 'APPROVED', 'Measurement not approved';

      -- 5. Assert Productivity View: 50 meters / 5 mandays = 10.00 meters_per_manday
      SELECT * INTO v_prod_row FROM public.v_labour_productivity
      WHERE organisation_id = v_org_id AND project_id = v_project_id AND subcontractor_id = v_vendor_id;

      ASSERT v_prod_row.total_meters = 50.00, 'Productivity total_meters mismatch';
      ASSERT v_prod_row.total_mandays = 5.00, 'Productivity total_mandays mismatch';
      ASSERT v_prod_row.meters_per_manday = 10.00, 'Productivity meters_per_manday mismatch (expected 50/5 = 10.00)';

      -- 6. Assert Margin View incorporates measurement cost
      SELECT * INTO v_margin_row FROM public.v_labour_margin
      WHERE organisation_id = v_org_id AND project_id = v_project_id;

      ASSERT v_margin_row.total_cost >= 6000.00, 'Margin total_cost does not include measurement amount of 6000';
    END $$;

    ROLLBACK;
  `;

  console.log('[TEST] Executing rollback test query for Phase 3...');
  const res = await queryDb(testScript);
  console.log('[TEST] Result:', res);
  console.log('[SUCCESS] Phase 3 migration, wages, and measurements passed completely inside rollback transaction!');
}

main().catch(err => {
  console.error('[FAILED] Verification error:', err);
  process.exit(1);
});
