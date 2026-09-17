-- ============================================================================
-- REMEDIATION PHASE 1.4 — Deploy the never-deployed envelope-RPC family
-- Live defect (verified 2026-09-16, project rujqejtisqermjyqqgoj):
-- 22 RPCs called by reachable, routed application code do not exist in the
-- production database (zero SQL source in the repo either — the wrapper layer
-- was built against a spec that was never shipped). Highest-impact paths:
--   * approvals/api.ts triggerPostApprovalActions calls approval_transition
--     for work_orders / payment_requests / purchase_payments /
--     subcontractor_payments — with the RPC missing, approving those records
--     completes the approval row but SILENTLY never transitions the target
--     document (error swallowed with console.error).
--   * payment_request_create / approve / release / list — the Payment Request
--     module's protected workflow fails at the RPC boundary.
--
-- Design (Phase 0 classification §E, "required"):
--   * p_input jsonb envelopes exactly matching the TS zod contracts in
--     src/payment-requests/types/index.ts and src/approvals/rpc.ts
--     (camelCase keys; list rows carry EXACTLY the 18 strict-schema fields).
--   * SECURITY DEFINER + SET search_path = public + organisation guard.
--   * idempotency via payment_requests.client_request_id (added below).
--   * state guards mirror the live status vocabularies (verified 2026-09-16).
--
-- Forward-only. Idempotent (DROP IF EXISTS + CREATE for each fn).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0a. Idempotency key column for payment requests
-- ---------------------------------------------------------------------------
ALTER TABLE public.payment_requests
  ADD COLUMN IF NOT EXISTS client_request_id text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_requests_org_client_req
  ON public.payment_requests (organisation_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 0b. Shared helpers (private: service_role-only execute)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._remediation_guard_org(p_input jsonb)
RETURNS void
LANGUAGE plpgsql STABLE
SET search_path = public
AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.user_can_access_org((p_input->>'organisationId')::uuid) THEN
    RAISE EXCEPTION 'Organisation access denied' USING ERRCODE = '42501';
  END IF;
END;
$fn$;

CREATE OR REPLACE FUNCTION public._remediation_ok(p_data jsonb, p_request_id text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE
SET search_path = public
AS $fn$
BEGIN
  RETURN jsonb_build_object('data', p_data, 'error', NULL, 'request_id', p_request_id);
END;
$fn$;

CREATE OR REPLACE FUNCTION public._remediation_err(p_code text, p_message text, p_retryable boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql STABLE
SET search_path = public
AS $fn$
BEGIN
  RETURN jsonb_build_object(
    'data', NULL,
    'error', jsonb_build_object('code', p_code, 'message', p_message, 'retryable', p_retryable)
  );
END;
$fn$;

-- ===========================================================================
-- 1. approval_transition — work_orders | payment_requests |
--                          purchase_payments | subcontractor_payments
--    actions: approve | return | resubmit
--    NOTE: public.work_orders does not exist in this database; the live
--    canonical store is subcontractor_work_orders (live statuses: Draft,
--    APPROVED). Approvals rows with reference_type='work_orders' therefore
--    transition subcontractor_work_orders.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.approval_transition(p_input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_ref_type  text;
  v_ref_id    uuid;
  v_action    text;
  v_org       uuid;
  v_actor     uuid;
  v_req_id    text;
  v_pr        record;
  v_appr_id   uuid;
  v_status    text;
BEGIN
  PERFORM public._remediation_guard_org(p_input);

  v_ref_type := p_input->>'referenceType';
  v_ref_id   := (p_input->>'referenceId')::uuid;
  v_action   := p_input->>'action';
  v_org      := (p_input->>'organisationId')::uuid;
  v_actor    := auth.uid();
  v_req_id   := p_input->>'clientRequestId';

  IF v_ref_type NOT IN ('work_orders','payment_requests','purchase_payments','subcontractor_payments') THEN
    RETURN public._remediation_err('VALIDATION_FAILED', 'Unsupported referenceType: ' || COALESCE(v_ref_type,'(null)'));
  END IF;
  IF v_action NOT IN ('approve','return','resubmit') THEN
    RETURN public._remediation_err('VALIDATION_FAILED', 'Unsupported action: ' || COALESCE(v_action,'(null)'));
  END IF;

  SELECT id INTO v_appr_id FROM public.approvals
  WHERE reference_type = v_ref_type AND reference_id = v_ref_id AND organisation_id = v_org
  LIMIT 1;

  -- Idempotency: same approval + same action + same clientRequestId => no-op
  -- (action stored uppercase per approval_actions CHECK; input is lowercase)
  IF v_appr_id IS NOT NULL AND v_req_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.approval_actions
    WHERE approval_id = v_appr_id
      AND action = (CASE v_action WHEN 'approve' THEN 'APPROVED' WHEN 'return' THEN 'RETURNED' WHEN 'resubmit' THEN 'RESUBMITTED' ELSE UPPER(v_action) END)
      AND comments = 'clientRequestId:' || v_req_id
  ) THEN
    RETURN public._remediation_ok(
      jsonb_build_object('referenceType', v_ref_type, 'referenceId', v_ref_id, 'status', 'noop'), v_req_id);
  END IF;

  -- ---------------- payment_requests ----------------
  IF v_ref_type = 'payment_requests' THEN
    SELECT status INTO v_status FROM public.payment_requests
    WHERE id = v_ref_id AND organisation_id = v_org;
    IF v_status IS NULL THEN
      RETURN public._remediation_err('RECORD_NOT_FOUND', 'Payment request not found in this organisation.');
    END IF;

    IF v_action = 'approve' THEN
      IF v_status IN ('Approved','Paid') THEN
        -- Idempotent: target already approved (retry after partial failure)
        RETURN public._remediation_ok(jsonb_build_object('referenceType','payment_requests','referenceId',v_ref_id::text,'status','noop'), v_req_id);
      END IF;
      IF v_status NOT IN ('Pending','Draft') THEN
        RETURN public._remediation_err('INVALID_STATE', 'Payment request is ' || v_status || '; only Pending/Draft can be approved.');
      END IF;
      UPDATE public.payment_requests SET
        status = 'Approved',
        approved_by = v_actor,
        approved_at = now(),
        approval_status = 'Approved',
        amount_approved = CASE WHEN COALESCE(amount_approved, 0) > 0 THEN amount_approved ELSE amount_requested END,
        approved_amount = CASE WHEN COALESCE(approved_amount, 0) > 0 THEN approved_amount ELSE amount_requested END,
        updated_at = now()
      WHERE id = v_ref_id AND organisation_id = v_org;
    ELSIF v_action = 'return' THEN
      IF v_status NOT IN ('Pending','Draft') THEN
        RETURN public._remediation_err('INVALID_STATE', 'Payment request is ' || v_status || '; only Pending/Draft can be returned.');
      END IF;
      UPDATE public.payment_requests SET
        status = 'Returned', approval_status = 'Returned',
        rejection_reason = COALESCE(p_input->>'note', rejection_reason), updated_at = now()
      WHERE id = v_ref_id AND organisation_id = v_org;
    ELSE -- resubmit
      IF v_status NOT IN ('Returned','Rejected') THEN
        RETURN public._remediation_err('INVALID_STATE', 'Payment request is ' || v_status || '; only Returned/Rejected can be resubmitted.');
      END IF;
      UPDATE public.payment_requests SET
        status = 'Pending', approval_status = 'Pending Approval', updated_at = now()
      WHERE id = v_ref_id AND organisation_id = v_org;
    END IF;

    PERFORM public._remediation_log_approval_action(v_appr_id, v_org, v_action, v_actor, v_req_id);
    RETURN public._remediation_ok(jsonb_build_object('referenceType','payment_requests','referenceId',v_ref_id::text,'status',v_action), v_req_id);
  END IF;

  -- ---------------- purchase_payments ----------------
  IF v_ref_type = 'purchase_payments' THEN
    SELECT approval_status INTO v_status FROM public.purchase_payments
    WHERE id = v_ref_id AND organisation_id = v_org;
    IF v_status IS NULL THEN
      RETURN public._remediation_err('RECORD_NOT_FOUND', 'Vendor payment not found in this organisation.');
    END IF;

    IF v_action = 'approve' THEN
      IF v_status = 'Approved' THEN
        RETURN public._remediation_ok(jsonb_build_object('referenceType','purchase_payments','referenceId',v_ref_id::text,'status','noop'), v_req_id);
      END IF;
      IF COALESCE(v_status,'') NOT IN ('Pending Approval','Pending','Draft','') THEN
        RETURN public._remediation_err('INVALID_STATE', 'Vendor payment is ' || COALESCE(v_status,'(blank)') || '; not approvable.');
      END IF;
      UPDATE public.purchase_payments SET approval_status = 'Approved', updated_at = now()
      WHERE id = v_ref_id AND organisation_id = v_org;
    ELSE
      -- return / resubmit: back to the approval queue
      UPDATE public.purchase_payments SET approval_status = 'Pending Approval', updated_at = now()
      WHERE id = v_ref_id AND organisation_id = v_org;
    END IF;

    PERFORM public._remediation_log_approval_action(v_appr_id, v_org, v_action, v_actor, v_req_id);
    RETURN public._remediation_ok(jsonb_build_object('referenceType','purchase_payments','referenceId',v_ref_id::text,'status',v_action), v_req_id);
  END IF;

  -- ---------------- subcontractor_payments ----------------
  IF v_ref_type = 'subcontractor_payments' THEN
    SELECT approval_status INTO v_status FROM public.subcontractor_payments
    WHERE id = v_ref_id AND organisation_id = v_org;
    IF v_status IS NULL THEN
      RETURN public._remediation_err('RECORD_NOT_FOUND', 'Subcontractor payment not found in this organisation.');
    END IF;

    IF v_action = 'approve' THEN
      IF v_status = 'Approved' THEN
        RETURN public._remediation_ok(jsonb_build_object('referenceType','subcontractor_payments','referenceId',v_ref_id::text,'status','noop'), v_req_id);
      END IF;
      UPDATE public.subcontractor_payments SET approval_status = 'Approved'
      WHERE id = v_ref_id AND organisation_id = v_org;
    ELSE
      UPDATE public.subcontractor_payments SET approval_status = 'Pending Approval'
      WHERE id = v_ref_id AND organisation_id = v_org;
    END IF;

    PERFORM public._remediation_log_approval_action(v_appr_id, v_org, v_action, v_actor, v_req_id);
    RETURN public._remediation_ok(jsonb_build_object('referenceType','subcontractor_payments','referenceId',v_ref_id::text,'status',v_action), v_req_id);
  END IF;

  -- ---------------- work_orders (=> subcontractor_work_orders, live store) --
  IF v_ref_type = 'work_orders' THEN
    SELECT status INTO v_status FROM public.subcontractor_work_orders
    WHERE id = v_ref_id AND organisation_id = v_org;
    IF v_status IS NULL THEN
      RETURN public._remediation_err('RECORD_NOT_FOUND', 'Work order not found in this organisation.');
    END IF;

    IF v_action = 'approve' THEN
      IF v_status = 'APPROVED' THEN
        RETURN public._remediation_ok(jsonb_build_object('referenceType','work_orders','referenceId',v_ref_id::text,'status','noop'), v_req_id);
      END IF;
      UPDATE public.subcontractor_work_orders SET status = 'APPROVED', updated_at = now()
      WHERE id = v_ref_id AND organisation_id = v_org;
    ELSIF v_action = 'return' THEN
      UPDATE public.subcontractor_work_orders SET status = 'Draft', updated_at = now()
      WHERE id = v_ref_id AND organisation_id = v_org;
    ELSE
      UPDATE public.subcontractor_work_orders SET status = 'Draft', updated_at = now()
      WHERE id = v_ref_id AND organisation_id = v_org;
    END IF;

    PERFORM public._remediation_log_approval_action(v_appr_id, v_org, v_action, v_actor, v_req_id);
    RETURN public._remediation_ok(jsonb_build_object('referenceType','work_orders','referenceId',v_ref_id::text,'status',v_action), v_req_id);
  END IF;

  RETURN public._remediation_err('VALIDATION_FAILED', 'Unhandled reference type');
END;
$fn$;

-- Audit trail row for every successful transition (fire-and-forget)
CREATE OR REPLACE FUNCTION public._remediation_log_approval_action(
  p_approval uuid, p_org uuid, p_action text, p_actor uuid, p_req_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_action text;
BEGIN
  IF p_approval IS NULL THEN RETURN; END IF;
  -- approval_actions.action CHECK requires the uppercase vocabulary
  v_action := CASE p_action
    WHEN 'approve' THEN 'APPROVED'
    WHEN 'return' THEN 'RETURNED'
    WHEN 'resubmit' THEN 'RESUBMITTED'
    ELSE UPPER(p_action)
  END;
  BEGIN
    INSERT INTO public.approval_actions (approval_id, action, approver_id, comments, organisation_id)
    VALUES (p_approval, v_action, p_actor, 'clientRequestId:' || COALESCE(p_req_id, gen_random_uuid()::text), p_org);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'approval_actions log failed: %', SQLERRM;
  END;
END;
$fn$;

-- ===========================================================================
-- 2. payment_requests_list — rows match paymentRequestRowSchema EXACTLY
--    (18 strict fields; no extras — .strict() rejects unknown keys)
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.payment_requests_list(p_input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_org      uuid;
  v_page     int;
  v_size     int;
  v_search   text;
  v_status   text;
  v_woid     uuid;
  v_from     date;
  v_to       date;
  v_inc_cxl  boolean;
  v_total    int;
  v_rows     jsonb;
BEGIN
  PERFORM public._remediation_guard_org(p_input);

  v_org    := (p_input->>'organisationId')::uuid;
  v_page   := COALESCE((p_input->>'page')::int, 0);
  v_size   := COALESCE((p_input->>'pageSize')::int, 25);
  v_search := p_input->>'search';
  v_status := p_input->>'status';
  v_woid   := (p_input->>'workOrderId')::uuid;
  v_from   := (p_input->>'dueFrom')::date;
  v_to     := (p_input->>'dueTo')::date;
  v_inc_cxl := COALESCE((p_input->>'includeCancelled')::boolean, false);

  SELECT count(*) INTO v_total
  FROM public.payment_requests pr
  WHERE pr.organisation_id = v_org
    AND (v_inc_cxl OR pr.status NOT IN ('Cancelled','Rejected'))
    AND (v_status IS NULL OR pr.status = v_status)
    AND (v_woid IS NULL OR pr.work_order_id = v_woid)
    AND (v_from IS NULL OR pr.due_date >= v_from)
    AND (v_to IS NULL OR pr.due_date <= v_to)
    AND (v_search IS NULL OR pr.request_no ILIKE '%' || v_search || '%' OR pr.reason ILIKE '%' || v_search || '%');

  SELECT COALESCE(jsonb_agg(t ORDER BY created_at DESC), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT pr.created_at AS created_at,
           jsonb_build_object(
      'id',               pr.id::text,
      'organisationId',   pr.organisation_id::text,
      'requestNo',        pr.request_no,
      'sourceType',       COALESCE(pr.source_type, CASE WHEN pr.subcontractor_id IS NOT NULL THEN 'subcontractor' ELSE 'purchase' END),
      'sourceBillId',     pr.source_id::text,
      'workOrderId',      pr.work_order_id::text,
      'workOrderNo',      swo.work_order_no,
      'payeeName',        COALESCE(v.company_name, sc.company_name, 'Unknown Payee'),
      'amountRequested',  COALESCE(pr.amount_requested, 0),
      'approvedAmount',   COALESCE(pr.approved_amount, pr.amount_approved, 0),
      'paidAmount',       COALESCE(pr.paid_amount, 0),
      'balanceAmount',    COALESCE(pr.amount_requested, 0) - COALESCE(pr.paid_amount, 0),
      'priority',         CASE WHEN pr.priority IN ('Low','Normal','High','Urgent') THEN pr.priority ELSE 'Normal' END,
      'dueDate',          to_char(pr.due_date, 'YYYY-MM-DD'),
      'status',           pr.status,
      'approvalStatus',   COALESCE(pr.approval_status, ''),
      'workflowStep',     pr.workflow_step,
      'settlementType',   CASE WHEN COALESCE(pr.source_type,'') IN ('subcontractor','subcontractor_bill') OR pr.subcontractor_id IS NOT NULL THEN 'subcontractor' ELSE 'purchase' END
    ) AS t
    FROM public.payment_requests pr
    LEFT JOIN public.purchase_vendors v        ON v.id = pr.vendor_id
    LEFT JOIN public.subcontractors sc         ON sc.id = pr.subcontractor_id
    LEFT JOIN public.subcontractor_work_orders swo ON swo.id = pr.work_order_id
    WHERE pr.organisation_id = v_org
      AND (v_inc_cxl OR pr.status NOT IN ('Cancelled','Rejected'))
      AND (v_status IS NULL OR pr.status = v_status)
      AND (v_woid IS NULL OR pr.work_order_id = v_woid)
      AND (v_from IS NULL OR pr.due_date >= v_from)
      AND (v_to IS NULL OR pr.due_date <= v_to)
      AND (v_search IS NULL OR pr.request_no ILIKE '%' || v_search || '%' OR pr.reason ILIKE '%' || v_search || '%')
    ORDER BY pr.created_at DESC
    LIMIT v_size OFFSET v_page * v_size
  ) x;

  RETURN public._remediation_ok(jsonb_build_object(
    'rows', v_rows, 'totalCount', v_total, 'page', v_page, 'pageSize', v_size
  ));
END;
$fn$;

-- ===========================================================================
-- 3. payment_request_create — tenant-validated source bill + idempotency
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.payment_request_create(p_input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_org      uuid;
  v_actor    uuid;
  v_req_id   text;
  v_src_type text;
  v_src_bill uuid;
  v_amount   numeric;
  v_priority text;
  v_due      date;
  v_mode     text;
  v_bank     uuid;
  v_reason   text;
  v_vendor   uuid;
  v_sc       uuid;
  v_wo       uuid;
  v_no       text;
  v_id       uuid;
  v_attempt  int;
BEGIN
  PERFORM public._remediation_guard_org(p_input);

  v_org      := (p_input->>'organisationId')::uuid;
  v_actor    := auth.uid();
  v_req_id   := p_input->>'clientRequestId';
  v_src_type := p_input->>'sourceType';
  v_src_bill := (p_input->>'sourceBillId')::uuid;
  v_amount   := (p_input->>'amountRequested')::numeric;
  v_priority := COALESCE(p_input->>'priority', 'Normal');
  v_due      := (p_input->>'dueDate')::date;
  v_mode     := p_input->>'paymentMode';
  v_bank     := (p_input->>'bankAccountId')::uuid;
  v_reason   := p_input->>'reason';
  v_wo       := (p_input->>'workOrderId')::uuid;

  IF v_src_type NOT IN ('purchase_bill','subcontractor_bill','purchase','subcontractor') THEN
    RETURN public._remediation_err('VALIDATION_FAILED', 'Invalid sourceType.');
  END IF;
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RETURN public._remediation_err('VALIDATION_FAILED', 'amountRequested must be positive.');
  END IF;

  -- Idempotency: replay of the same clientRequestId returns the original row.
  IF v_req_id IS NOT NULL THEN
    SELECT id::text INTO v_id FROM public.payment_requests
    WHERE organisation_id = v_org AND client_request_id = v_req_id LIMIT 1;
    IF v_id IS NOT NULL THEN
      RETURN public._remediation_ok(
        jsonb_build_object('id', v_id, 'duplicate', true), v_req_id);
    END IF;
  END IF;

  -- Tenant-validate the source bill (MUST belong to v_org)
  IF v_src_type IN ('purchase_bill','purchase') THEN
    SELECT vendor_id INTO v_vendor
    FROM public.purchase_bills WHERE id = v_src_bill AND organisation_id = v_org;
    IF v_vendor IS NULL THEN
      RETURN public._remediation_err('RECORD_NOT_FOUND', 'Source purchase bill not found in this organisation.');
    END IF;
  ELSE
    SELECT subcontractor_id INTO v_sc
    FROM public.subcontractor_invoices WHERE id = v_src_bill AND organisation_id = v_org;
    IF v_sc IS NULL THEN
      RETURN public._remediation_err('RECORD_NOT_FOUND', 'Source subcontractor invoice not found in this organisation.');
    END IF;
  END IF;

  -- Org-scoped request number; unique constraint backstops the MAX+1 race
  -- (3 attempts, then surface the conflict).
  FOR v_attempt IN 1..3 LOOP
    BEGIN
      SELECT 'PR-' || to_char(now(),'YYMM') || '-' ||
             LPAD((COALESCE(MAX(CASE WHEN regexp_replace(request_no, '^PR-[0-9]{6}-', '') ~ '^[0-9]+$'
                     THEN (regexp_replace(request_no, '^PR-[0-9]{6}-', ''))::int END), 0) + 1)::text, 4, '0')
      INTO v_no
      FROM public.payment_requests
      WHERE organisation_id = v_org
        AND request_no LIKE 'PR-' || to_char(now(),'YYMM') || '-%';
      INSERT INTO public.payment_requests (
        organisation_id, request_no, vendor_id, subcontractor_id, request_date,
        amount_requested, priority, due_date, payment_mode, bank_account_id,
        reason, status, requested_by, source_type, source_id, work_order_id,
        approval_status, workflow_step, client_request_id, created_at, updated_at
      ) VALUES (
        v_org, v_no, v_vendor, v_sc, CURRENT_DATE,
        v_amount, v_priority, v_due, v_mode, v_bank,
        COALESCE(v_reason, 'Payment Request'), 'Pending', v_actor,
        v_src_type, v_src_bill, v_wo,
        'Pending Approval', 'created', v_req_id, now(), now()
      )
      RETURNING id INTO v_id;

      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempt = 3 THEN
        RETURN public._remediation_err('CONFLICT', 'Could not allocate a unique request number; retry.', true);
      END IF;
    END;
  END LOOP;

  RETURN public._remediation_ok(jsonb_build_object('id', v_id::text, 'requestNo', v_no), v_req_id);
END;
$fn$;

-- ===========================================================================
-- 4. payment_request_approve — Pending/Draft/Returned -> Approved
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.payment_request_approve(p_input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_org uuid; v_id uuid; v_actor uuid; v_req_id text; v_status text;
BEGIN
  PERFORM public._remediation_guard_org(p_input);
  v_org    := (p_input->>'organisationId')::uuid;
  v_id     := (p_input->>'paymentRequestId')::uuid;
  v_actor  := auth.uid();
  v_req_id := p_input->>'clientRequestId';

  SELECT status INTO v_status FROM public.payment_requests
  WHERE id = v_id AND organisation_id = v_org;
  IF v_status IS NULL THEN
    RETURN public._remediation_err('RECORD_NOT_FOUND', 'Payment request not found.');
  END IF;
  IF v_status IN ('Approved','Paid') THEN
    -- Idempotent: already approved (retry after timeout returns the same result)
    RETURN public._remediation_ok(jsonb_build_object('id', v_id::text, 'status', 'noop'), v_req_id);
  END IF;
  IF v_status NOT IN ('Pending','Draft','Returned') THEN
    RETURN public._remediation_err('INVALID_STATE', 'Payment request is ' || v_status || '; only Pending/Draft/Returned can be approved.');
  END IF;

  UPDATE public.payment_requests SET
    status = 'Approved', approved_by = v_actor, approved_at = now(),
    approval_status = 'Approved',
    amount_approved = CASE WHEN COALESCE(amount_approved, 0) > 0 THEN amount_approved ELSE amount_requested END,
    approved_amount = CASE WHEN COALESCE(approved_amount, 0) > 0 THEN approved_amount ELSE amount_requested END,
    updated_at = now()
  WHERE id = v_id AND organisation_id = v_org;

  RETURN public._remediation_ok(jsonb_build_object('id', v_id::text, 'status', 'Approved'), v_req_id);
END;
$fn$;

-- ===========================================================================
-- 5. payment_request_release — Approved/Partially Paid -> Paid
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.payment_request_release(p_input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_org uuid; v_id uuid; v_req_id text; v_status text;
BEGIN
  PERFORM public._remediation_guard_org(p_input);
  v_org    := (p_input->>'organisationId')::uuid;
  v_id     := (p_input->>'paymentRequestId')::uuid;
  v_req_id := p_input->>'clientRequestId';

  SELECT status INTO v_status FROM public.payment_requests
  WHERE id = v_id AND organisation_id = v_org;
  IF v_status IS NULL THEN
    RETURN public._remediation_err('RECORD_NOT_FOUND', 'Payment request not found.');
  END IF;
  IF v_status = 'Paid' THEN
    -- Idempotent: already released (retry after timeout returns the same result)
    RETURN public._remediation_ok(jsonb_build_object('id', v_id::text, 'status', 'noop'), v_req_id);
  END IF;
  IF v_status NOT IN ('Approved','Partially Paid') THEN
    RETURN public._remediation_err('INVALID_STATE', 'Payment request is ' || v_status || '; only Approved/Partially Paid can be released.');
  END IF;

  UPDATE public.payment_requests SET
    status = 'Paid',
    paid_amount = GREATEST(COALESCE(paid_amount, 0), COALESCE(amount_approved, amount_requested, 0)),
    workflow_step = 'released',
    updated_at = now()
  WHERE id = v_id AND organisation_id = v_org;

  RETURN public._remediation_ok(jsonb_build_object('id', v_id::text, 'status', 'Paid'), v_req_id);
END;
$fn$;

-- ===========================================================================
-- 6. payment_request_bind_approval — link an approval to a payment request
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.payment_request_bind_approval(p_input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_org uuid; v_pr uuid; v_appr uuid;
BEGIN
  PERFORM public._remediation_guard_org(p_input);
  v_org  := (p_input->>'organisationId')::uuid;
  v_pr   := (p_input->>'paymentRequestId')::uuid;
  v_appr := (p_input->>'approvalId')::uuid;

  IF NOT EXISTS (SELECT 1 FROM public.approvals WHERE id = v_appr AND organisation_id = v_org) THEN
    RETURN public._remediation_err('RECORD_NOT_FOUND', 'Approval not found in this organisation.');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.payment_requests WHERE id = v_pr AND organisation_id = v_org) THEN
    RETURN public._remediation_err('RECORD_NOT_FOUND', 'Payment request not found in this organisation.');
  END IF;

  UPDATE public.payment_requests SET approval_id = v_appr, updated_at = now()
  WHERE id = v_pr AND organisation_id = v_org;

  RETURN public._remediation_ok(jsonb_build_object('paymentRequestId', v_pr::text, 'approvalId', v_appr::text));
END;
$fn$;

-- ===========================================================================
-- 7. backfill_approval_denorm — refresh approvals denormalised fields
--    (requester_name from employees, project_name from projects; approver
--     directory fields live on approval_approvers, not here)
--    Caller (ApprovalSettings.tsx) invokes with p_org_id.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.backfill_approval_denorm(p_org_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_org uuid;
  v_names int;
  v_projects int;
BEGIN
  v_org := COALESCE(p_org_id, (SELECT organisation_id FROM public.org_members WHERE user_id = auth.uid() LIMIT 1));
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Organisation access denied' USING ERRCODE = '42501';
  END IF;
  IF NOT public.user_can_access_org(v_org) THEN
    RAISE EXCEPTION 'Organisation access denied' USING ERRCODE = '42501';
  END IF;

  UPDATE public.approvals a
  SET requester_name = e.name
  FROM public.employees e
  WHERE a.requested_by = e.id
    AND a.organisation_id = v_org
    AND (a.requester_name IS NULL OR a.requester_name = '');
  GET DIAGNOSTICS v_names = ROW_COUNT;

  UPDATE public.approvals a
  SET project_name = p.name
  FROM public.projects p
  WHERE a.project_id = p.id
    AND a.organisation_id = v_org
    AND (a.project_name IS NULL OR a.project_name = '');
  GET DIAGNOSTICS v_projects = ROW_COUNT;

  RETURN public._remediation_ok(jsonb_build_object(
    'organisationId', v_org::text, 'requesterNamesBackfilled', v_names, 'projectNamesBackfilled', v_projects
  ));
END;
$fn$;

-- ===========================================================================
-- 8. update_purchase_requisition_header_status — derive header status from lines
--    (header CHECK live: Draft/Pending/Approved/Rejected/Partially Fulfilled/
--     Fulfilled/Cancelled; line CHECK: Open/Partially Fulfilled/Fulfilled/
--     Cancelled)
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.update_purchase_requisition_header_status(p_requisition_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_org uuid;
  v_open int; v_partial int; v_fulfilled int; v_total int; v_current text;
BEGIN
  SELECT organisation_id, status INTO v_org, v_current
  FROM public.purchase_requisitions WHERE id = p_requisition_id;
  IF v_org IS NULL THEN RETURN; END IF;

  SELECT count(*),
         count(*) FILTER (WHERE status = 'Open'),
         count(*) FILTER (WHERE status = 'Partially Fulfilled'),
         count(*) FILTER (WHERE status = 'Fulfilled')
  INTO v_total, v_open, v_partial, v_fulfilled
  FROM public.purchase_requisition_lines
  WHERE requisition_id = p_requisition_id AND status <> 'Cancelled';

  IF v_total = 0 THEN RETURN; END IF;

  IF v_open = v_total THEN
    v_current := 'Pending';
  ELSIF v_fulfilled = v_total THEN
    v_current := 'Fulfilled';
  ELSE
    v_current := 'Partially Fulfilled';
  END IF;

  UPDATE public.purchase_requisitions SET status = v_current, updated_at = now()
  WHERE id = p_requisition_id;
END;
$fn$;

-- ===========================================================================
-- Grants: authenticated + service_role only (fail closed for anon).
-- ===========================================================================
REVOKE EXECUTE ON FUNCTION public._remediation_guard_org(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._remediation_guard_org(jsonb) TO service_role;
REVOKE EXECUTE ON FUNCTION public._remediation_ok(jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._remediation_ok(jsonb, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public._remediation_err(text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._remediation_err(text, text, boolean) TO service_role;
REVOKE EXECUTE ON FUNCTION public._remediation_log_approval_action(uuid, uuid, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._remediation_log_approval_action(uuid, uuid, text, uuid, text) TO service_role;

GRANT EXECUTE ON FUNCTION public.approval_transition(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.payment_requests_list(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.payment_request_create(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.payment_request_approve(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.payment_request_release(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.payment_request_bind_approval(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.backfill_approval_denorm(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_purchase_requisition_header_status(uuid) TO authenticated, service_role;
