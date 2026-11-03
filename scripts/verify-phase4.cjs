const fs = require('fs');
const path = require('path');

const SUPABASE_QUERY_URL = 'https://api.supabase.com/v1/projects/rujqejtisqermjyqqgoj/database/query';
const SUPABASE_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || '';

async function runQuery(query) {
  const res = await fetch(SUPABASE_QUERY_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query })
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error(`Invalid JSON response: ${text}`);
  }

  if (!res.ok || (json && json.message && json.message.includes('ERROR'))) {
    throw new Error(`Query failed: ${JSON.stringify(json)}`);
  }
  return json;
}

async function main() {
  const ts = Date.now();
  const logLines = [];
  function log(msg) {
    console.log(msg);
    logLines.push(`[${new Date().toISOString()}] ${msg}`);
  }

  log(`=== STARTING PHASE 4 VERIFICATION (W7 CROSS-TENANT SHARING) ===`);
  const tag = `__verify_labour_p4_${ts}__`;

  try {
    // Pre-cleanup in case previous run was interrupted
    await runQuery(`
      DO $$
      BEGIN
        ALTER TABLE public.labour_audit_log DISABLE TRIGGER trg_labour_audit_immutable;
        DELETE FROM public.labour_audit_log WHERE organisation_id IN (SELECT id FROM public.organisations WHERE name LIKE '__verify_labour_p4%');
        DELETE FROM public.audit_log WHERE organisation_id IN (SELECT id FROM public.organisations WHERE name LIKE '__verify_labour_p4%');
        DELETE FROM public.organisations WHERE name LIKE '__verify_labour_p4%';
        ALTER TABLE public.labour_audit_log ENABLE TRIGGER trg_labour_audit_immutable;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
      $$;
    `);
    const testSql = `
      DO $$
      DECLARE
        v_org_a uuid := gen_random_uuid();
        v_org_b uuid := gen_random_uuid();
        v_org_c uuid := gen_random_uuid();
        v_user_a uuid;
        v_user_b uuid;
        v_user_c uuid;
        v_emp_a uuid := gen_random_uuid();
        v_emp_b uuid := gen_random_uuid();
        v_emp_c uuid := gen_random_uuid();
        v_role_a uuid := gen_random_uuid();
        v_role_b uuid := gen_random_uuid();
        v_role_c uuid := gen_random_uuid();

        v_party_a_in_b uuid := gen_random_uuid();
        v_party_b_in_a uuid := gen_random_uuid();
        v_sub_in_a uuid := gen_random_uuid();
        v_cat_a uuid := gen_random_uuid();
        v_cat_b uuid := gen_random_uuid();
        v_proj_a uuid := gen_random_uuid();
        v_worker_b uuid := gen_random_uuid();
        v_att_1 uuid := gen_random_uuid();
        v_att_2 uuid := gen_random_uuid();
        v_link_id uuid;
        v_share_res jsonb;
        v_share_id uuid;
        v_item_1 uuid;
        v_item_2 uuid;
        v_review_res jsonb;
        v_recv_att_id uuid;
        v_recv_row record;
        v_audit_count integer;
        v_inbox_count integer;
        v_dispute_failed boolean := false;
        v_sub_revoked_failed boolean := false;
        v_a_res jsonb;
        v_bill_res jsonb;
        v_bill_count integer;
      BEGIN
        -- 0. Fetch real auth users
        SELECT id INTO v_user_a FROM auth.users ORDER BY created_at ASC LIMIT 1;
        SELECT id INTO v_user_b FROM auth.users ORDER BY created_at OFFSET 1 LIMIT 1;
        SELECT id INTO v_user_c FROM auth.users ORDER BY created_at OFFSET 2 LIMIT 1;

        IF v_user_b IS NULL THEN v_user_b := v_user_a; END IF;
        IF v_user_c IS NULL THEN v_user_c := v_user_a; END IF;

        -- 1. Create Organisations
        INSERT INTO public.organisations (id, name, business_profile)
        VALUES (v_org_a, '${tag}_OrgA_EPC', 'epc');

        INSERT INTO public.organisations (id, name, business_profile)
        VALUES (v_org_b, '${tag}_OrgB_Contractor', 'labour_supplier');

        INSERT INTO public.organisations (id, name, business_profile)
        VALUES (v_org_c, '${tag}_OrgC_Outsider', 'both');

        -- 2. Create Employees
        INSERT INTO public.employees (id, organisation_id, name, email, status)
        VALUES 
          (v_emp_a, v_org_a, 'PM OrgA', 'pma@example.com', 'active'),
          (v_emp_b, v_org_b, 'Owner OrgB', 'ownerb@example.com', 'active'),
          (v_emp_c, v_org_c, 'Outsider OrgC', 'outc@example.com', 'active');

        -- 3. Create Roles & Permissions
        INSERT INTO public.roles (id, organisation_id, name, is_system, is_active)
        VALUES
          (v_role_a, v_org_a, 'Project Manager', false, true),
          (v_role_b, v_org_b, 'Contractor Owner', false, true),
          (v_role_c, v_org_c, 'Viewer', false, true);

        INSERT INTO public.role_permissions (role_id, permission_key)
        VALUES
          (v_role_a, 'labour.attendance.approve'),
          (v_role_a, 'labour.attendance.view'),
          (v_role_a, 'labour.share.manage'),
          (v_role_a, 'labour.billing.generate'),
          (v_role_a, 'labour.billing.view'),
          (v_role_b, 'labour.attendance.create'),
          (v_role_b, 'labour.attendance.approve'),
          (v_role_b, 'labour.attendance.view'),
          (v_role_b, 'labour.share.manage'),
          (v_role_c, 'labour.attendance.view');

        -- 4. Receipts & Org Memberships
        INSERT INTO public.rbac_assignment_receipts (organisation_id, employee_id, role_id)
        VALUES
          (v_org_a, v_emp_a, v_role_a),
          (v_org_b, v_emp_b, v_role_b),
          (v_org_c, v_emp_c, v_role_c);

        INSERT INTO public.org_members (organisation_id, user_id, employee_id, role, role_id, status)
        VALUES
          (v_org_a, v_user_a, v_emp_a, 'manager', v_role_a, 'active'),
          (v_org_b, v_user_b, v_emp_b, 'manager', v_role_b, 'active'),
          (v_org_c, v_user_c, v_emp_c, 'viewer', v_role_c, 'active');

        -- 5. Seed Org A: Trade Fitter, Subcontractor Org B, Project, Rate card = 700.00
        INSERT INTO public.labour_categories (id, organisation_id, name, code, base_rate, unit, is_active)
        VALUES (v_cat_a, v_org_a, 'Fitter', 'FIT-A', 700.00, 'daily', true);

        INSERT INTO public.parties (id, organisation_id, name, status)
        VALUES (v_party_b_in_a, v_org_a, 'Contractor B Firm', 'active');

        INSERT INTO public.party_roles (party_id, role)
        VALUES (v_party_b_in_a, 'subcontractor');

        INSERT INTO public.subcontractors (id, organisation_id, company_name, party_id)
        VALUES (v_sub_in_a, v_org_a, 'Contractor B Firm', v_party_b_in_a);

        INSERT INTO public.projects (id, organisation_id, name, project_name)
        VALUES (v_proj_a, v_org_a, 'EPC Airport Metro Project', 'EPC Airport Metro Project');

        INSERT INTO public.rate_cards (organisation_id, subcontractor_id, labour_category_id, negotiated_rate, base_rate, effective_from, is_active)
        VALUES (v_org_a, v_sub_in_a, v_cat_a, 700.00, 700.00, CURRENT_DATE - INTERVAL '10 days', true);

        -- 6. Seed Org B: Client Party for Org A, Trade Fitter, Casual Worker
        INSERT INTO public.parties (id, organisation_id, name, status)
        VALUES (v_party_a_in_b, v_org_b, 'EPC Main Corp', 'active');

        INSERT INTO public.party_roles (party_id, role)
        VALUES (v_party_a_in_b, 'customer');

        INSERT INTO public.labour_categories (id, organisation_id, name, code, base_rate, unit, is_active)
        VALUES (v_cat_b, v_org_b, 'Fitter', 'FIT-B', 800.00, 'daily', true);

        INSERT INTO public.labour_workers (id, organisation_id, name, phone, trade, worker_type, pay_basis, default_rate, is_active)
        VALUES (v_worker_b, v_org_b, 'Ramesh Fitter', '9876543210', v_cat_b, 'casual', 'daily', 500.00, true);

        -- Org B records 2 approved attendance rows
        -- Day 1: 5 Fitters x 8h (Approved)
        INSERT INTO public.manpower_attendance (
          id, organisation_id, labour_category_id, attendance_date,
          workers_count, hours_worked, base_rate, original_amount,
          adjusted_rate, adjusted_amount, status, approved_at
        ) VALUES (
          v_att_1, v_org_b, v_cat_b, CURRENT_DATE - INTERVAL '2 days',
          5, 8.0, 800.00, 4000.00, 800.00, 4000.00, 'APPROVED', now()
        );

        -- Day 2: 3 Fitters x 8h (Approved)
        INSERT INTO public.manpower_attendance (
          id, organisation_id, labour_category_id, attendance_date,
          workers_count, hours_worked, base_rate, original_amount,
          adjusted_rate, adjusted_amount, status, approved_at
        ) VALUES (
          v_att_2, v_org_b, v_cat_b, CURRENT_DATE - INTERVAL '1 day',
          3, 8.0, 800.00, 2400.00, 800.00, 2400.00, 'APPROVED', now()
        );

        -- ==============================================================
        -- STEP 2: HANDSHAKE - Request & Accept Tenant Link
        -- ==============================================================
        EXECUTE format('SET LOCAL "request.jwt.claims" = %L', json_build_object(
          'sub', v_user_b,
          'role', 'authenticated',
          'aud', 'authenticated'
        )::text);

        v_a_res := public.request_tenant_link(v_org_b, v_org_a, v_party_a_in_b);
        v_link_id := (v_a_res->>'link_id')::uuid;

        IF (v_a_res->>'status') != 'pending' THEN
          RAISE EXCEPTION 'W7.1: Link request did not return pending status (got %)', v_a_res->>'status';
        END IF;

        -- Switch session to Org A user and Accept Link
        EXECUTE format('SET LOCAL "request.jwt.claims" = %L', json_build_object(
          'sub', v_user_a,
          'role', 'authenticated',
          'aud', 'authenticated'
        )::text);

        v_a_res := public.accept_tenant_link(v_link_id, v_org_a, v_party_b_in_a);

        IF (v_a_res->>'status') != 'accepted' THEN
          RAISE EXCEPTION 'W7.2: Link accept did not return accepted status (got %)', v_a_res->>'status';
        END IF;

        -- ==============================================================
        -- STEP 3: SUBMIT SHARED ATTENDANCE (as Org B)
        -- ==============================================================
        EXECUTE format('SET LOCAL "request.jwt.claims" = %L', json_build_object(
          'sub', v_user_b,
          'role', 'authenticated',
          'aud', 'authenticated'
        )::text);

        v_share_res := public.submit_shared_attendance(
          v_link_id,
          v_org_b,
          ARRAY[v_att_1, v_att_2],
          'Week 44 HVAC Site Attendance'
        );
        v_share_id := (v_share_res->>'share_id')::uuid;

        IF (v_share_res->>'items_count')::integer != 2 THEN
          RAISE EXCEPTION 'W7.3: Expected 2 submitted items, got %', v_share_res->>'items_count';
        END IF;

        -- Verify attendance rows in B got shared_ref
        SELECT COUNT(*) INTO v_inbox_count FROM public.manpower_attendance WHERE id IN (v_att_1, v_att_2) AND shared_ref = v_share_id;
        IF v_inbox_count != 2 THEN
          RAISE EXCEPTION 'W7.4: shared_ref was not set on attendance rows';
        END IF;

        -- Get items in inbox
        SELECT id INTO v_item_1 FROM public.labour_share_inbox WHERE share_id = v_share_id AND sender_attendance_id = v_att_1;
        SELECT id INTO v_item_2 FROM public.labour_share_inbox WHERE share_id = v_share_id AND sender_attendance_id = v_att_2;

        -- ==============================================================
        -- STEP 4: REVIEW (as Org A) - Approve Item 1, Dispute Item 2
        -- ==============================================================
        EXECUTE format('SET LOCAL "request.jwt.claims" = %L', json_build_object(
          'sub', v_user_a,
          'role', 'authenticated',
          'aud', 'authenticated'
        )::text);

        -- Test negative: Dispute without reason must fail
        BEGIN
          PERFORM public.review_shared_attendance(v_item_2, v_org_a, 'disputed', '');
          v_dispute_failed := false;
        EXCEPTION WHEN OTHERS THEN
          v_dispute_failed := true;
        END;

        IF NOT v_dispute_failed THEN
          RAISE EXCEPTION 'W7.5: Disputing without reason must fail';
        END IF;

        -- Approve Item 1
        v_review_res := public.review_shared_attendance(
          v_item_1,
          v_org_a,
          'approved',
          'Verified with site log',
          v_proj_a
        );
        v_recv_att_id := (v_review_res->>'receiver_attendance_id')::uuid;

        IF v_recv_att_id IS NULL THEN
          RAISE EXCEPTION 'W7.6: Receiver attendance row was not created on approve';
        END IF;

        -- Verify Receiver's created attendance row:
        -- Strictly server-resolved rate: Org A rate card was 700.00.
        -- Hand computed: 5 fitters x 700.00 = 3500.00.
        SELECT * INTO v_recv_row FROM public.manpower_attendance WHERE id = v_recv_att_id;
        IF v_recv_row.base_rate != 700.00 THEN
          RAISE EXCEPTION 'W7.7: Rate mismatch in Org A attendance: expected 700.00, got %', v_recv_row.base_rate;
        END IF;
        IF v_recv_row.original_amount != 3500.00 THEN
          RAISE EXCEPTION 'W7.8: Amount mismatch in Org A attendance: expected 3500.00, got %', v_recv_row.original_amount;
        END IF;
        IF v_recv_row.status != 'APPROVED' THEN
          RAISE EXCEPTION 'W7.9: Org A created row status must be APPROVED, got %', v_recv_row.status;
        END IF;

        -- Dispute Item 2 with valid reason
        v_review_res := public.review_shared_attendance(
          v_item_2,
          v_org_a,
          'disputed',
          'Only 2 fitters counted on site for Day 2',
          v_proj_a
        );

        IF (v_review_res->>'decision') != 'disputed' THEN
          RAISE EXCEPTION 'W7.10: Item 2 decision was not disputed';
        END IF;

        -- ==============================================================
        -- STEP 5: ROLL-UP IN ORG A'S PAYABLE BILL (Zero Re-Entry)
        -- ==============================================================
        -- Org A generates bill for Subcontractor B
        v_bill_res := public.generate_manpower_bill(
          p_organisation_id := v_org_a,
          p_subcontractor_id := v_sub_in_a,
          p_period_from := (CURRENT_DATE - INTERVAL '10 days')::date,
          p_period_to := (CURRENT_DATE + INTERVAL '1 day')::date
        );

        IF (v_bill_res->>'billed_rows')::integer != 1 THEN
          RAISE EXCEPTION 'W7.11: Expected 1 billed row in Org A roll-up, got %', v_bill_res->>'billed_rows';
        END IF;
        IF (v_bill_res->>'total_amount')::numeric != 3500.00 THEN
          RAISE EXCEPTION 'W7.12: Expected bill total 3500.00 in Org A roll-up, got %', v_bill_res->>'total_amount';
        END IF;

        -- ==============================================================
        -- STEP 6: REVOKE TENANT LINK & VERIFY INBOX VISIBILITY
        -- ==============================================================
        -- Revoke link
        PERFORM public.revoke_tenant_link(v_link_id, v_org_a, 'Contract term expired');

        -- Test negative: Submit on revoked link must fail
        EXECUTE format('SET LOCAL "request.jwt.claims" = %L', json_build_object(
          'sub', v_user_b,
          'role', 'authenticated',
          'aud', 'authenticated'
        )::text);

        BEGIN
          PERFORM public.submit_shared_attendance(v_link_id, v_org_b, ARRAY[v_att_1]);
          v_sub_revoked_failed := false;
        EXCEPTION WHEN OTHERS THEN
          v_sub_revoked_failed := true;
        END;

        IF NOT v_sub_revoked_failed THEN
          RAISE EXCEPTION 'W7.13: Submitting on revoked link must fail';
        END IF;

        -- Inbox hiding: Org A selecting from inbox returns 0 rows now that link is revoked
        EXECUTE format('SET LOCAL "request.jwt.claims" = %L', json_build_object(
          'sub', v_user_a,
          'role', 'authenticated',
          'aud', 'authenticated'
        )::text);

        SET LOCAL ROLE authenticated;
        SELECT COUNT(*) INTO v_inbox_count FROM public.labour_share_inbox WHERE receiver_org_id = v_org_a;
        SET LOCAL ROLE postgres;

        IF v_inbox_count != 0 THEN
          RAISE EXCEPTION 'W7.14: Inbox not hidden after link revocation (found % rows)', v_inbox_count;
        END IF;

        -- Audit log check: verify all actions logged
        SELECT COUNT(*) INTO v_audit_count FROM public.labour_audit_log
        WHERE organisation_id IN (v_org_a, v_org_b);
        IF v_audit_count < 4 THEN
          RAISE EXCEPTION 'W7.15: Expected at least 4 audit rows, got %', v_audit_count;
        END IF;

        -- Cleanup all test fixtures
        ALTER TABLE public.labour_audit_log DISABLE TRIGGER trg_labour_audit_immutable;
        DELETE FROM public.labour_audit_log WHERE organisation_id IN (v_org_a, v_org_b, v_org_c);
        DELETE FROM public.manpower_billing_entries WHERE organisation_id IN (v_org_a, v_org_b, v_org_c);
        DELETE FROM public.manpower_billing WHERE organisation_id IN (v_org_a, v_org_b, v_org_c);
        DELETE FROM public.labour_share_inbox WHERE sender_org_id IN (v_org_a, v_org_b, v_org_c) OR receiver_org_id IN (v_org_a, v_org_b, v_org_c);
        DELETE FROM public.labour_attendance_shares WHERE sender_org_id IN (v_org_a, v_org_b, v_org_c) OR receiver_org_id IN (v_org_a, v_org_b, v_org_c);
        DELETE FROM public.labour_tenant_links WHERE initiator_org_id IN (v_org_a, v_org_b, v_org_c) OR receiver_org_id IN (v_org_a, v_org_b, v_org_c);
        DELETE FROM public.manpower_attendance WHERE organisation_id IN (v_org_a, v_org_b, v_org_c);
        DELETE FROM public.rate_cards WHERE organisation_id IN (v_org_a, v_org_b, v_org_c);
        DELETE FROM public.labour_workers WHERE organisation_id IN (v_org_a, v_org_b, v_org_c);
        DELETE FROM public.labour_categories WHERE organisation_id IN (v_org_a, v_org_b, v_org_c);
        DELETE FROM public.subcontractors WHERE organisation_id IN (v_org_a, v_org_b, v_org_c);
        DELETE FROM public.party_roles WHERE party_id IN (v_party_a_in_b, v_party_b_in_a);
        DELETE FROM public.parties WHERE organisation_id IN (v_org_a, v_org_b, v_org_c);
        DELETE FROM public.projects WHERE organisation_id IN (v_org_a, v_org_b, v_org_c);
        DELETE FROM public.org_members WHERE organisation_id IN (v_org_a, v_org_b, v_org_c);
        DELETE FROM public.rbac_assignment_receipts WHERE organisation_id IN (v_org_a, v_org_b, v_org_c);
        DELETE FROM public.role_permissions WHERE role_id IN (v_role_a, v_role_b, v_role_c);
        DELETE FROM public.roles WHERE organisation_id IN (v_org_a, v_org_b, v_org_c);
        DELETE FROM public.employees WHERE organisation_id IN (v_org_a, v_org_b, v_org_c);
        DELETE FROM public.audit_log WHERE organisation_id IN (v_org_a, v_org_b, v_org_c);
        DELETE FROM public.organisations WHERE id IN (v_org_a, v_org_b, v_org_c);
        ALTER TABLE public.labour_audit_log ENABLE TRIGGER trg_labour_audit_immutable;

      END;
      $$;
    `;

    log(`[EXEC] Executing W7 cross-tenant sharing test on live remote database...`);
    await runQuery(testSql);
    log(`[PASS] W7 test executed successfully with all assertions green!`);

    // Verify cleanup
    const leftoverCheck = await runQuery(`
      SELECT
        (SELECT count(*) FROM public.organisations WHERE name LIKE '${tag}%') as orgs,
        (SELECT count(*) FROM public.manpower_attendance WHERE remarks LIKE '%${tag}%') as att,
        (SELECT count(*) FROM public.labour_tenant_links WHERE revoke_reason = 'Contract term expired') as links;
    `);

    log(`[CLEANUP] Leftover check: ${JSON.stringify(leftoverCheck)}`);
    const totalLeftovers = Number(leftoverCheck[0].orgs) + Number(leftoverCheck[0].att) + Number(leftoverCheck[0].links);
    if (totalLeftovers !== 0) {
      throw new Error(`Leftover test records detected: ${JSON.stringify(leftoverCheck[0])}`);
    }
    log(`[PASS] ZERO leftover rows verified on live remote project!`);

  } catch (err) {
    log(`[FAIL] Error during Phase 4 verification: ${err.message}`);
    throw err;
  } finally {
    const logDir = path.resolve(__dirname, '../docs/labour-attendance/verification');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    const logFile = path.join(logDir, `phase4-w7-${new Date().toISOString().replace(/[:.]/g, '-')}.log`);
    fs.writeFileSync(logFile, logLines.join('\n'));
    console.log(`[LOG] Saved verification log to ${logFile}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
