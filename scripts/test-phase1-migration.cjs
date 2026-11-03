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
  console.log('[TEST] Reading migration file...');
  const migrationPath = path.resolve(__dirname, '../apps/web/supabase/migrations/20261103020000_phase1_parties_workers_planning.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  console.log('[TEST] Verifying Phase 1 migration inside a rollback-wrapped transaction...');

  const testScript = `
    BEGIN;

    -- Apply the migration DDL
    ${migrationSql}

    -- Verification 1: Check that columns exist
    DO $$
    BEGIN
      ASSERT (SELECT count(*) FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'party_id') = 1, 'clients.party_id missing';
      ASSERT (SELECT count(*) FROM information_schema.columns WHERE table_name = 'purchase_vendors' AND column_name = 'party_id') = 1, 'purchase_vendors.party_id missing';
      ASSERT (SELECT count(*) FROM information_schema.columns WHERE table_name = 'subcontractors' AND column_name = 'party_id') = 1, 'subcontractors.party_id missing';
      ASSERT (SELECT count(*) FROM information_schema.tables WHERE table_name = 'labour_workers') = 1, 'labour_workers missing';
      ASSERT (SELECT count(*) FROM information_schema.columns WHERE table_name = 'manpower_attendance' AND column_name = 'entry_kind') = 1, 'entry_kind missing';
      ASSERT (SELECT count(*) FROM information_schema.columns WHERE table_name = 'manpower_attendance' AND column_name = 'worker_id') = 1, 'worker_id missing';
      ASSERT (SELECT count(*) FROM information_schema.columns WHERE table_name = 'manpower_attendance' AND column_name = 'planned_from_id') = 1, 'planned_from_id missing';
    END $$;

    -- Verification 2: Test resolve_legacy_ids and planning flow
    DO $$
    DECLARE
      v_org_id uuid := gen_random_uuid();
      v_user_id uuid;
      v_emp_id uuid := gen_random_uuid();
      v_role_id uuid := gen_random_uuid();
      v_party_id uuid;
      v_legacy RECORD;
      v_cat_id uuid;
      v_worker_id uuid;
      v_plan_res jsonb;
      v_plan_id uuid;
      v_actual_res jsonb;
      v_actual_id uuid;
    BEGIN
      -- Select real auth user
      SELECT id INTO v_user_id FROM auth.users ORDER BY created_at LIMIT 1;

      -- 1. Create test organisation
      INSERT INTO public.organisations (id, name)
      VALUES (v_org_id, '__verify_p1_test__');

      -- 2. Create test employee
      INSERT INTO public.employees (id, organisation_id, name, email, status)
      VALUES (v_emp_id, v_org_id, 'P1 Admin Employee', 'p1_admin@example.com', 'active');

      -- 3. Create test role with labour permissions
      INSERT INTO public.roles (id, organisation_id, name, is_system, is_active)
      VALUES (v_role_id, v_org_id, 'P1 Administrator', false, true);

      INSERT INTO public.role_permissions (role_id, permission_key)
      VALUES 
        (v_role_id, 'labour.attendance.view'),
        (v_role_id, 'labour.attendance.create'),
        (v_role_id, 'labour.attendance.edit'),
        (v_role_id, 'labour.attendance.approve'),
        (v_role_id, 'labour.rates.manage'),
        (v_role_id, 'labour.workers.manage');

      -- 4. Create assignment receipt
      INSERT INTO public.rbac_assignment_receipts (organisation_id, employee_id, role_id)
      VALUES (v_org_id, v_emp_id, v_role_id);

      -- 5. Create org member
      INSERT INTO public.org_members (organisation_id, user_id, employee_id, role, role_id, status)
      VALUES (v_org_id, v_user_id, v_emp_id, 'admin', v_role_id, 'active');

      -- Set JWT claims to authenticate as v_user_id
      EXECUTE format('SET LOCAL "request.jwt.claims" = %L', json_build_object('sub', v_user_id, 'role', 'authenticated')::text);

      -- Insert test category
      INSERT INTO public.labour_categories (organisation_id, name, code, base_rate, unit)
      VALUES (v_org_id, 'Test Plumber', 'PLUMB', 850, 'day')
      RETURNING id INTO v_cat_id;

      -- Create a party
      INSERT INTO public.parties (organisation_id, name, gstin, phone, email, address, status)
      VALUES (v_org_id, 'Test Unified Contracting Co', '33ABCDE1234F1Z5', '9876543210', 'test@example.com', 'Chennai', 'Active')
      RETURNING id INTO v_party_id;

      -- Test resolve_legacy_ids for subcontractor
      SELECT * INTO v_legacy FROM public.resolve_legacy_ids(v_party_id, 'subcontractor');
      ASSERT v_legacy.legacy_id IS NOT NULL, 'resolve_legacy_ids subcontractor failed';
      ASSERT v_legacy.legacy_table = 'subcontractors', 'resolve_legacy_ids table mismatch';

      -- Test resolve_legacy_ids idempotency (should return same ID)
      DECLARE
        v_legacy2 RECORD;
      BEGIN
        SELECT * INTO v_legacy2 FROM public.resolve_legacy_ids(v_party_id, 'subcontractor');
        ASSERT v_legacy.legacy_id = v_legacy2.legacy_id, 'resolve_legacy_ids subcontractor not idempotent';
      END;

      -- Test quick_add_worker
      SELECT public.quick_add_worker(
        v_org_id,
        'Ramesh Casual Worker',
        v_cat_id,
        900,
        '9876500000',
        'casual',
        'daily',
        'ramesh@upi',
        v_party_id
      ) INTO v_worker_id;

      ASSERT v_worker_id IS NOT NULL, 'quick_add_worker failed';

      -- Test plan_labour (D2)
      SELECT public.plan_labour(
        v_org_id,
        CURRENT_DATE,
        v_cat_id,
        5,
        v_legacy.legacy_id,
        NULL,
        NULL,
        'planned_unconfirmed',
        'Initial test site plan'
      ) INTO v_plan_res;

      v_plan_id := (v_plan_res->>'id')::uuid;
      ASSERT v_plan_id IS NOT NULL, 'plan_labour failed';

      -- Test confirm_plan_with_client
      PERFORM public.confirm_plan_with_client(v_plan_id, v_org_id, 'confirmed');

      ASSERT (SELECT client_confirmation FROM public.manpower_attendance WHERE id = v_plan_id) = 'confirmed',
        'confirm_plan_with_client failed';

      -- Test convert_plan_to_actual
      SELECT public.convert_plan_to_actual(
        v_plan_id,
        v_org_id,
        4, -- actual 4 workers instead of planned 5
        8,
        'Site Supervisor John',
        '[]'::jsonb,
        'Converted from test plan'
      ) INTO v_actual_res;

      v_actual_id := (v_actual_res->>'id')::uuid;
      ASSERT v_actual_id IS NOT NULL, 'convert_plan_to_actual failed';
      ASSERT (SELECT status FROM public.manpower_attendance WHERE id = v_plan_id) = 'CONVERTED', 'plan status not CONVERTED';
      ASSERT (SELECT planned_from_id FROM public.manpower_attendance WHERE id = v_actual_id) = v_plan_id, 'planned_from_id mismatch';
      ASSERT (SELECT workers_count FROM public.manpower_attendance WHERE id = v_actual_id) = 4, 'actual workers_count mismatch';

      -- Test record_attendance with worker_id
      DECLARE
        v_named_att_res jsonb;
        v_named_att_id uuid;
      BEGIN
        SELECT public.record_attendance(
          p_organisation_id := v_org_id,
          p_attendance_date := CURRENT_DATE,
          p_labour_category_id := v_cat_id,
          p_subcontractor_id := v_legacy.legacy_id,
          p_client_id := NULL,
          p_work_unit_id := NULL,
          p_work_unit_type := 'GENERAL',
          p_workers_count := 1,
          p_hours_worked := 8,
          p_supervisor_name := 'Supervisor',
          p_applied_modifiers := '[]'::jsonb,
          p_base_rate := NULL,
          p_adjusted_rate := NULL,
          p_original_amount := NULL,
          p_adjusted_amount := NULL,
          p_remarks := 'Named casual worker attendance',
          p_project_id := NULL,
          p_worker_id := v_worker_id
        ) INTO v_named_att_res;

        v_named_att_id := (v_named_att_res->>'id')::uuid;
        ASSERT v_named_att_id IS NOT NULL, 'record_attendance with worker_id failed';
        -- worker default rate was 900, so base_rate must be 900 and amount 900
        ASSERT (SELECT base_rate FROM public.manpower_attendance WHERE id = v_named_att_id) = 900, 'worker default rate not resolved';
        ASSERT (SELECT adjusted_amount FROM public.manpower_attendance WHERE id = v_named_att_id) = 900, 'worker amount not 900';
      END;

      -- Check view v_planned_vs_actual
      ASSERT (
        SELECT count(*) FROM public.v_planned_vs_actual 
        WHERE plan_id = v_plan_id AND planned_headcount = 5 AND actual_headcount = 4
      ) = 1, 'v_planned_vs_actual view check failed';

    END $$;

    ROLLBACK;
  `;

  console.log('[TEST] Executing rollback test query...');
  const res = await queryDb(testScript);
  console.log('[TEST] Result:', res);
  console.log('[SUCCESS] Phase 1 migration and RPC verification passed completely inside rollback transaction!');
}

main().catch(err => {
  console.error('[FAILED] Verification error:', err);
  process.exit(1);
});
