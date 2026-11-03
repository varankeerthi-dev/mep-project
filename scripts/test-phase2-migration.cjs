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
  console.log('[TEST] Reading Phase 2 migration file...');
  const migrationPath = path.resolve(__dirname, '../apps/web/supabase/migrations/20261103030000_phase2_payables_client_recharge.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  console.log('[TEST] Verifying Phase 2 migration inside a rollback-wrapped transaction...');

  const testScript = `
    BEGIN;

    -- Apply the migration DDL
    ${migrationSql}

    -- Verification 1: Schema Checks
    DO $$
    BEGIN
      ASSERT (SELECT count(*) FROM information_schema.tables WHERE table_name = 'manpower_billing_entries') = 1, 'manpower_billing_entries table missing';
      ASSERT (SELECT count(*) FROM information_schema.tables WHERE table_name = 'labour_bill_rates') = 1, 'labour_bill_rates table missing';
      ASSERT (SELECT count(*) FROM information_schema.columns WHERE table_name = 'manpower_attendance' AND column_name = 'is_billable') = 1, 'is_billable column missing';
      ASSERT (SELECT count(*) FROM information_schema.columns WHERE table_name = 'manpower_attendance' AND column_name = 'bill_rate') = 1, 'bill_rate column missing';
      ASSERT (SELECT count(*) FROM information_schema.columns WHERE table_name = 'manpower_attendance' AND column_name = 'bill_amount') = 1, 'bill_amount column missing';
      ASSERT (SELECT count(*) FROM information_schema.columns WHERE table_name = 'manpower_attendance' AND column_name = 'invoice_id') = 1, 'invoice_id column missing';
    END $$;

    -- Verification 2: Workflows W2 & W3 in full
    DO $$
    DECLARE
      v_org_id uuid := gen_random_uuid();
      v_user_id uuid;
      v_emp_id uuid := gen_random_uuid();
      v_role_id uuid := gen_random_uuid();
      v_client_id uuid := gen_random_uuid();
      v_project_id uuid := gen_random_uuid();
      v_vendor_id uuid := gen_random_uuid();
      v_cat_id uuid := gen_random_uuid();
      v_invoice_id uuid := gen_random_uuid();
      v_att_res jsonb;
      v_att_id uuid;
      v_bill_res jsonb;
      v_bill_id uuid;
      v_journal_id uuid;
      v_attach_res jsonb;
      v_margin_row RECORD;
      v_err_caught boolean;
    BEGIN
      -- Select real auth user
      SELECT id INTO v_user_id FROM auth.users ORDER BY created_at LIMIT 1;

      -- 1. Create test organisation
      INSERT INTO public.organisations (id, name) VALUES (v_org_id, '__verify_p2_test__');

      -- 2. Create employee & role with permissions
      INSERT INTO public.employees (id, organisation_id, name, email, status)
      VALUES (v_emp_id, v_org_id, 'P2 Manager', 'p2_pm@example.com', 'active');

      INSERT INTO public.roles (id, organisation_id, name, is_system, is_active)
      VALUES (v_role_id, v_org_id, 'P2 Admin Role', false, true);

      INSERT INTO public.role_permissions (role_id, permission_key)
      VALUES 
        (v_role_id, 'labour.attendance.view'),
        (v_role_id, 'labour.attendance.create'),
        (v_role_id, 'labour.attendance.edit'),
        (v_role_id, 'labour.attendance.approve'),
        (v_role_id, 'labour.rates.manage'),
        (v_role_id, 'labour.billing.view'),
        (v_role_id, 'labour.billing.generate');

      INSERT INTO public.rbac_assignment_receipts (organisation_id, employee_id, role_id)
      VALUES (v_org_id, v_emp_id, v_role_id);

      INSERT INTO public.org_members (organisation_id, user_id, employee_id, role, role_id, status)
      VALUES (v_org_id, v_user_id, v_emp_id, 'manager', v_role_id, 'active');

      -- Authenticate as v_user_id
      EXECUTE format('SET LOCAL "request.jwt.claims" = %L', json_build_object('sub', v_user_id, 'role', 'authenticated')::text);

      -- 3. Seed Domain Entities: Client C1, Project P1, Vendor V1, Trade Fitter
      INSERT INTO public.clients (id, organisation_id, client_id, client_name)
      VALUES (v_client_id, v_org_id, 'CLI-C1', 'Client C1 Industrial');

      INSERT INTO public.projects (id, organisation_id, client_id, name, project_name)
      VALUES (v_project_id, v_org_id, v_client_id, 'Project P1 Plant', 'Project P1 Plant');

      INSERT INTO public.subcontractors (id, organisation_id, company_name)
      VALUES (v_vendor_id, v_org_id, 'Vendor V1 Labour Corp');

      INSERT INTO public.labour_categories (id, organisation_id, name, code, base_rate, unit, is_active)
      VALUES (v_cat_id, v_org_id, 'Fitter', 'FITTER', 600.00, 'day', true);

      -- Cost rate card: V1 x Fitter x P1 = 700.00
      INSERT INTO public.rate_cards (organisation_id, subcontractor_id, labour_category_id, work_unit_id, negotiated_rate, base_rate, effective_from, is_active)
      VALUES (v_org_id, v_vendor_id, v_cat_id, v_project_id, 700.00, 600.00, CURRENT_DATE - 30, true);

      -- Bill rate: Client C1 x Fitter x P1 = 950.00
      INSERT INTO public.labour_bill_rates (organisation_id, client_id, labour_category_id, project_id, rate, unit, effective_from, is_active)
      VALUES (v_org_id, v_client_id, v_cat_id, v_project_id, 950.00, 'day', CURRENT_DATE - 30, true);

      -- 4. Record attendance: 5 fitters x 8h = 3500.00 cost (700 x 5)
      v_att_res := public.record_attendance(
        p_organisation_id := v_org_id,
        p_attendance_date := CURRENT_DATE,
        p_labour_category_id := v_cat_id,
        p_subcontractor_id := v_vendor_id,
        p_client_id := v_client_id,
        p_work_unit_id := v_project_id,
        p_work_unit_type := 'PROJECT',
        p_workers_count := 5,
        p_hours_worked := 8.0,
        p_supervisor_name := 'Supervisor',
        p_applied_modifiers := '[]'::jsonb,
        p_base_rate := NULL,
        p_adjusted_rate := NULL,
        p_original_amount := NULL,
        p_adjusted_amount := NULL,
        p_remarks := 'Shift 1',
        p_project_id := v_project_id
      );

      v_att_id := (v_att_res->>'id')::uuid;
      ASSERT (SELECT adjusted_amount FROM public.manpower_attendance WHERE id = v_att_id) = 3500.00, 'Attendance cost not 3500.00';

      -- 5. Mark attendance billable (W3.1)
      PERFORM public.mark_attendance_billable(v_att_id, v_org_id, true, v_client_id);
      ASSERT (SELECT bill_rate FROM public.manpower_attendance WHERE id = v_att_id) = 950.00, 'Resolved bill_rate not 950.00';
      ASSERT (SELECT bill_amount FROM public.manpower_attendance WHERE id = v_att_id) = 4750.00, 'Resolved bill_amount not 4750.00 (5 x 950)';

      -- 6. Approve attendance
      PERFORM public.approve_attendance(v_att_id, v_org_id);
      ASSERT (SELECT status FROM public.manpower_attendance WHERE id = v_att_id) = 'APPROVED', 'Attendance not approved';

      -- 7. Generate Manpower Bill (W2.1 & W2.2)
      v_bill_res := public.generate_manpower_bill(
        p_organisation_id := v_org_id,
        p_subcontractor_id := v_vendor_id,
        p_period_from := CURRENT_DATE - 5,
        p_period_to := CURRENT_DATE + 5,
        p_idempotency_key := 'test-key-mb-01',
        p_client_id := v_client_id,
        p_project_id := v_project_id
      );

      v_bill_id := (v_bill_res->>'billing_id')::uuid;
      v_journal_id := (v_bill_res->>'journal_id')::uuid;

      ASSERT v_bill_id IS NOT NULL, 'generate_manpower_bill failed';
      ASSERT (v_bill_res->>'total_adjusted')::numeric = 3500.00, 'Bill total not 3500.00';
      ASSERT (SELECT status FROM public.manpower_attendance WHERE id = v_att_id) = 'BILLED', 'Attendance status not BILLED';
      ASSERT (SELECT count(*) FROM public.manpower_billing_entries WHERE attendance_id = v_att_id) = 1, 'Billing entry not created';

      -- Verify journal entry lines balanced and carrying project_id
      ASSERT (v_bill_res->>'gl_debit')::numeric = 3500.00, 'GL debit not 3500.00';
      ASSERT (v_bill_res->>'gl_credit')::numeric = 3500.00, 'GL credit not 3500.00';
      ASSERT (SELECT count(*) FROM public.journal_entry_lines WHERE journal_id = v_journal_id AND project_id = v_project_id) > 0,
        'journal_entry_lines missing project_id';

      -- Idempotency check: re-running with same key returns identical bill
      DECLARE
        v_bill_res2 jsonb;
      BEGIN
        v_bill_res2 := public.generate_manpower_bill(
          p_organisation_id := v_org_id,
          p_subcontractor_id := v_vendor_id,
          p_period_from := CURRENT_DATE - 5,
          p_period_to := CURRENT_DATE + 5,
          p_idempotency_key := 'test-key-mb-01'
        );
        ASSERT (v_bill_res2->>'idempotent_replayed')::boolean = true, 'Idempotency replayed flag missing';
        ASSERT (v_bill_res2->>'billing_id')::uuid = v_bill_id, 'Idempotent billing_id mismatch';
      END;

      -- Double billing rejection test: attempting to bill same row in a 2nd bill must fail
      v_err_caught := false;
      BEGIN
        INSERT INTO public.manpower_billing_entries (organisation_id, billing_id, attendance_id, amount)
        VALUES (v_org_id, gen_random_uuid(), v_att_id, 3500.00);
      EXCEPTION WHEN unique_violation THEN
        v_err_caught := true;
      END;
      ASSERT v_err_caught = true, 'Unique constraint failed to block duplicate attendance_id billing';

      -- 8. Client Invoice Integration (W3.2)
      INSERT INTO public.invoices (
        id, organisation_id, invoice_no, invoice_date, client_id, status,
        template_type, mode, subtotal, cgst, sgst, igst, total, round_off
      ) VALUES (
        v_invoice_id, v_org_id, 'INV-TEST-001', CURRENT_DATE, v_client_id, 'draft',
        'standard', 'itemized', 0, 0, 0, 0, 0, 0
      );

      v_attach_res := public.attach_labour_to_invoice(
        p_invoice_id := v_invoice_id,
        p_organisation_id := v_org_id,
        p_client_id := v_client_id,
        p_project_id := v_project_id,
        p_idempotency_key := 'test-key-attach-01'
      );

      ASSERT (v_attach_res->>'total_labour_amount')::numeric = 4750.00, 'Attached labour amount not 4750.00';
      ASSERT (SELECT count(*) FROM public.invoice_items WHERE invoice_id = v_invoice_id) = 1, 'Invoice item line not created';
      ASSERT (SELECT invoice_id FROM public.manpower_attendance WHERE id = v_att_id) = v_invoice_id, 'Attendance invoice_id not set';

      -- Calling attach again with same key does not add duplicate lines
      DECLARE
        v_attach_res2 jsonb;
      BEGIN
        v_attach_res2 := public.attach_labour_to_invoice(
          p_invoice_id := v_invoice_id,
          p_organisation_id := v_org_id,
          p_client_id := v_client_id,
          p_project_id := v_project_id,
          p_idempotency_key := 'test-key-attach-01'
        );
        ASSERT (v_attach_res2->>'idempotent_replayed')::boolean = true, 'Attach labour idempotency replay failed';
        ASSERT (SELECT count(*) FROM public.invoice_items WHERE invoice_id = v_invoice_id) = 1, 'Duplicate invoice items created';
      END;

      -- 9. Check View v_labour_margin (W3.3)
      SELECT * INTO v_margin_row FROM public.v_labour_margin
      WHERE organisation_id = v_org_id AND client_id = v_client_id AND project_id = v_project_id;

      ASSERT v_margin_row.total_cost = 3500.00, 'v_labour_margin total_cost mismatch (expected 3500.00)';
      ASSERT v_margin_row.total_billed = 4750.00, 'v_labour_margin total_billed mismatch (expected 4750.00)';
      ASSERT v_margin_row.total_margin = 1250.00, 'v_labour_margin total_margin mismatch (expected 1250.00)';

    END $$;

    ROLLBACK;
  `;

  console.log('[TEST] Executing rollback test query for Phase 2...');
  const res = await queryDb(testScript);
  console.log('[TEST] Result:', res);
  console.log('[SUCCESS] Phase 2 migration and workflows passed completely inside rollback transaction!');
}

main().catch(err => {
  console.error('[FAILED] Verification error:', err);
  process.exit(1);
});
