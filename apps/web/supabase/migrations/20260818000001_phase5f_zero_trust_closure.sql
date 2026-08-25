-- ============================================================
-- PHASE 5F MIGRATION: Zero-Trust Financial Closure
-- Fixes: SC-REST-01 (DB side), GL-IMB-01, QT-RLS-01
-- ============================================================
-- Applied: 2026-08-18
-- Auditor: Phase 5F Adversarial Closure
-- ============================================================

-- PART 1: SEED ACCOUNT 2150 (Retention Payable) FOR ALL ORGS
-- Ensures all organisations that have account 2100 (Sundry Creditors)
-- also have account 2150 (Retention Payable) as a sub-liability account.
DO $$
DECLARE
  v_org RECORD;
  v_parent_id UUID;
  v_inserted INT := 0;
BEGIN
  FOR v_org IN
    SELECT DISTINCT id AS org_id, name AS org_name
    FROM public.organisations
    WHERE NOT EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE (a.organisation_id = id OR a.company_id = id)
        AND a.account_code = '2150'
    )
  LOOP
    SELECT id INTO v_parent_id
    FROM public.accounts
    WHERE (organisation_id = v_org.org_id OR company_id = v_org.org_id)
      AND account_code = '2100'
    LIMIT 1;

    IF v_parent_id IS NOT NULL THEN
      INSERT INTO public.accounts (
        company_id, account_code, name, root_type, parent_id, is_group
      ) VALUES (
        v_org.org_id, '2150', 'Retention Payable', 'Liability', v_parent_id, false
      );
      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;
  RAISE NOTICE 'Seeded account 2150 for % organisations', v_inserted;
END;
$$;

-- PART 2: record_subcontractor_bill — FAIL CLOSED + GL balance invariant
-- Replaces the Phase 5B version that silently skipped GL lines on missing accounts.
CREATE OR REPLACE FUNCTION public.record_subcontractor_bill(
  p_organisation_id UUID,
  p_subcontractor_id UUID,
  p_work_order_id UUID,
  p_amount NUMERIC,
  p_invoice_date DATE DEFAULT CURRENT_DATE,
  p_remarks TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sub RECORD; v_wo RECORD; v_bill_id UUID; v_bill_no TEXT; v_existing_id UUID; v_creator_id UUID;
  v_retention_percent NUMERIC(5,2) := 0; v_retention_amt NUMERIC(15,2) := 0; v_payable_amt NUMERIC(15,2) := 0;
  v_expense_account_id UUID; v_ap_account_id UUID; v_retention_account_id UUID; v_journal_id UUID;
  v_total_debit NUMERIC(15,2); v_total_credit NUMERIC(15,2);
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.user_can_access_org(p_organisation_id) THEN RAISE EXCEPTION 'Unauthorized organization access'; END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Subcontractor bill amount must be greater than zero'; END IF;

  SELECT id INTO v_creator_id FROM public.user_profiles WHERE user_id = auth.uid() OR id = auth.uid() LIMIT 1;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_id FROM public.subcontractor_invoices WHERE organisation_id = p_organisation_id AND idempotency_key = p_idempotency_key;
    IF v_existing_id IS NOT NULL THEN
      SELECT invoice_no, amount INTO v_bill_no, p_amount FROM public.subcontractor_invoices WHERE id = v_existing_id;
      RETURN jsonb_build_object('status', 'success', 'idempotent_replayed', true, 'bill_id', v_existing_id, 'invoice_no', v_bill_no, 'amount', p_amount);
    END IF;
  END IF;

  SELECT * INTO v_sub FROM public.subcontractors WHERE id = p_subcontractor_id AND organisation_id = p_organisation_id;
  IF v_sub IS NULL THEN RAISE EXCEPTION 'Subcontractor not found or does not belong to organization'; END IF;

  IF p_work_order_id IS NOT NULL THEN
    SELECT * INTO v_wo FROM public.subcontractor_work_orders WHERE id = p_work_order_id AND organisation_id = p_organisation_id AND subcontractor_id = p_subcontractor_id FOR UPDATE;
    IF v_wo IS NULL THEN RAISE EXCEPTION 'Work order not found or belongs to a different subcontractor/organization'; END IF;
    v_retention_percent := COALESCE(v_wo.retention_percent, 0);
  END IF;

  v_retention_amt := ROUND((p_amount * (v_retention_percent / 100.0))::NUMERIC, 2);
  v_payable_amt   := p_amount - v_retention_amt;

  SELECT id INTO v_expense_account_id FROM public.accounts WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id) AND account_code IN ('4100','4101','4000') ORDER BY account_code DESC LIMIT 1;
  SELECT id INTO v_ap_account_id FROM public.accounts WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id) AND account_code = '2100' LIMIT 1;
  SELECT id INTO v_retention_account_id FROM public.accounts WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id) AND account_code = '2150' LIMIT 1;

  -- FAIL CLOSED: required accounts must exist
  IF v_expense_account_id IS NULL THEN
    RAISE EXCEPTION 'GL account for Subcontractor Expense (4100/4101/4000) not configured for this organisation.';
  END IF;
  IF v_ap_account_id IS NULL THEN
    RAISE EXCEPTION 'GL account for Accounts Payable (2100) not configured for this organisation.';
  END IF;
  IF v_retention_amt > 0 AND v_retention_account_id IS NULL THEN
    RAISE EXCEPTION 'GL account for Retention Payable (2150) not configured for this organisation. Required when retention_percent > 0.';
  END IF;

  v_bill_no := public.generate_next_subcontractor_bill_number(p_organisation_id);

  PERFORM set_config('app.allow_posted_subcontractor_bill_creation', 'true', true);
  INSERT INTO public.subcontractor_invoices (
    invoice_no, organisation_id, subcontractor_id, work_order_id, invoice_date, amount, status, remarks, idempotency_key
  ) VALUES (
    v_bill_no, p_organisation_id, p_subcontractor_id, p_work_order_id, p_invoice_date, p_amount, 'Approved', p_remarks, p_idempotency_key
  ) RETURNING id INTO v_bill_id;
  PERFORM set_config('app.allow_posted_subcontractor_bill_creation', 'false', true);

  IF v_retention_amt > 0 AND p_work_order_id IS NOT NULL THEN
    INSERT INTO public.subcontractor_retention (
      work_order_id, retention_percentage, retention_amount, status, notes, idempotency_key
    ) VALUES (
      p_work_order_id, v_retention_percent, v_retention_amt, 'Held', 'Retained from Bill ' || v_bill_no, p_idempotency_key
    );
  END IF;

  INSERT INTO public.journal_entries (
    company_id, voucher_no, voucher_date, voucher_type, narration, status, created_by
  ) VALUES (
    p_organisation_id, v_bill_no, p_invoice_date, 'Purchase',
    'Subcontractor Bill ' || v_bill_no || ' (' || v_sub.company_name || ')', 'Posted', v_creator_id
  ) RETURNING id INTO v_journal_id;

  INSERT INTO public.journal_entry_lines (journal_id, account_id, party_type, party_id, debit, credit, narration)
  VALUES (v_journal_id, v_expense_account_id, 'vendor', p_subcontractor_id, p_amount, 0.00, 'Subcontractor Expense');

  IF v_payable_amt > 0 THEN
    INSERT INTO public.journal_entry_lines (journal_id, account_id, party_type, party_id, debit, credit, narration)
    VALUES (v_journal_id, v_ap_account_id, 'vendor', p_subcontractor_id, 0.00, v_payable_amt, 'Accounts Payable - Subcontractor');
  END IF;

  IF v_retention_amt > 0 THEN
    INSERT INTO public.journal_entry_lines (journal_id, account_id, party_type, party_id, debit, credit, narration)
    VALUES (v_journal_id, v_retention_account_id, 'vendor', p_subcontractor_id, 0.00, v_retention_amt, 'Retention Payable');
  END IF;

  SELECT SUM(COALESCE(debit,0)), SUM(COALESCE(credit,0))
  INTO v_total_debit, v_total_credit
  FROM public.journal_entry_lines WHERE journal_id = v_journal_id;

  IF ABS(v_total_debit - v_total_credit) > 0.01 THEN
    RAISE EXCEPTION 'GL imbalance: debit=% credit=%. Transaction rolled back.', v_total_debit, v_total_credit;
  END IF;

  PERFORM public.recalc_subcontractor_balance(p_subcontractor_id, p_organisation_id);

  RETURN jsonb_build_object(
    'status', 'success', 'bill_id', v_bill_id, 'invoice_no', v_bill_no,
    'amount', p_amount, 'retention_amount', v_retention_amt, 'payable_amount', v_payable_amt,
    'journal_id', v_journal_id, 'gl_debit', v_total_debit, 'gl_credit', v_total_credit
  );
END;
$$;

-- PART 3: record_subcontractor_payment — FAIL CLOSED + GL balance invariant
CREATE OR REPLACE FUNCTION public.record_subcontractor_payment(
  p_organisation_id UUID,
  p_subcontractor_id UUID,
  p_amount NUMERIC,
  p_payment_date DATE DEFAULT CURRENT_DATE,
  p_payment_mode TEXT DEFAULT 'Bank Transfer',
  p_reference_no TEXT DEFAULT NULL,
  p_tds_percent NUMERIC DEFAULT 0,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sub RECORD; v_payment_id UUID; v_ref_no TEXT; v_existing_id UUID; v_creator_id UUID;
  v_gross_amt NUMERIC(15,2); v_tds_amt NUMERIC(15,2) := 0; v_net_amt NUMERIC(15,2) := 0;
  v_ap_account_id UUID; v_bank_account_id UUID; v_tds_account_id UUID; v_journal_id UUID;
  v_total_debit NUMERIC(15,2); v_total_credit NUMERIC(15,2);
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.user_can_access_org(p_organisation_id) THEN RAISE EXCEPTION 'Unauthorized organization access'; END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Payment amount must be greater than zero'; END IF;

  SELECT id INTO v_creator_id FROM public.user_profiles WHERE user_id = auth.uid() OR id = auth.uid() LIMIT 1;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_id FROM public.subcontractor_payments WHERE organisation_id = p_organisation_id AND idempotency_key = p_idempotency_key;
    IF v_existing_id IS NOT NULL THEN
      SELECT reference_no, amount INTO v_ref_no, p_amount FROM public.subcontractor_payments WHERE id = v_existing_id;
      RETURN jsonb_build_object('status', 'success', 'idempotent_replayed', true, 'payment_id', v_existing_id, 'reference_no', v_ref_no, 'amount', p_amount);
    END IF;
  END IF;

  SELECT * INTO v_sub FROM public.subcontractors WHERE id = p_subcontractor_id AND organisation_id = p_organisation_id;
  IF v_sub IS NULL THEN RAISE EXCEPTION 'Subcontractor not found or does not belong to organization'; END IF;

  v_gross_amt := p_amount;
  v_tds_amt   := ROUND((v_gross_amt * (COALESCE(p_tds_percent, 0) / 100.0))::NUMERIC, 2);
  v_net_amt   := v_gross_amt - v_tds_amt;

  IF p_reference_no IS NOT NULL AND p_reference_no != '' THEN
    v_ref_no := p_reference_no;
  ELSE
    v_ref_no := public.generate_next_subcontractor_payment_number(p_organisation_id);
  END IF;

  SELECT id INTO v_ap_account_id FROM public.accounts WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id) AND account_code = '2100' LIMIT 1;
  IF LOWER(p_payment_mode) LIKE '%cash%' THEN
    SELECT id INTO v_bank_account_id FROM public.accounts WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id) AND account_code IN ('1300','1301') ORDER BY account_code DESC LIMIT 1;
  ELSE
    SELECT id INTO v_bank_account_id FROM public.accounts WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id) AND account_code = '1200' LIMIT 1;
  END IF;
  SELECT id INTO v_tds_account_id FROM public.accounts WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id) AND account_code = '2200' LIMIT 1;

  -- FAIL CLOSED: mandatory accounts must exist
  IF v_ap_account_id IS NULL THEN
    RAISE EXCEPTION 'GL account for Accounts Payable (2100) not configured for this organisation.';
  END IF;
  IF v_bank_account_id IS NULL THEN
    RAISE EXCEPTION 'GL account for Bank/Cash (1200/1300/1301) not configured for this organisation.';
  END IF;
  IF v_tds_amt > 0 AND v_tds_account_id IS NULL THEN
    RAISE EXCEPTION 'GL account for TDS Payable (2200) not configured. Required when TDS percent > 0.';
  END IF;

  PERFORM set_config('app.allow_posted_subcontractor_payment_creation', 'true', true);
  INSERT INTO public.subcontractor_payments (
    organisation_id, subcontractor_id, amount, gross_amount, tds_percentage, tds_amount, net_amount,
    payment_date, payment_mode, reference_no, workflow_step, approval_status, approved_at, released_at, released_by, idempotency_key
  ) VALUES (
    p_organisation_id, p_subcontractor_id, v_gross_amt, v_gross_amt, p_tds_percent, v_tds_amt, v_net_amt,
    p_payment_date, p_payment_mode, v_ref_no, 'released', 'Released', NOW(), NOW(), v_creator_id, p_idempotency_key
  ) RETURNING id INTO v_payment_id;
  PERFORM set_config('app.allow_posted_subcontractor_payment_creation', 'false', true);

  IF v_tds_amt > 0 THEN
    INSERT INTO public.subcontractor_tds_payments (subcontractor_id, payment_id, tds_amount, status, idempotency_key)
    VALUES (p_subcontractor_id, v_payment_id, v_tds_amt, 'Pending', p_idempotency_key);
  END IF;

  INSERT INTO public.journal_entries (
    company_id, voucher_no, voucher_date, voucher_type, narration, status, created_by
  ) VALUES (
    p_organisation_id, v_ref_no, p_payment_date, 'Payment',
    'Subcontractor Payment ' || v_ref_no || ' (' || v_sub.company_name || ')', 'Posted', v_creator_id
  ) RETURNING id INTO v_journal_id;

  INSERT INTO public.journal_entry_lines (journal_id, account_id, party_type, party_id, debit, credit, narration)
  VALUES (v_journal_id, v_ap_account_id, 'vendor', p_subcontractor_id, v_gross_amt, 0.00, 'Accounts Payable Settlement');

  INSERT INTO public.journal_entry_lines (journal_id, account_id, party_type, party_id, debit, credit, narration)
  VALUES (v_journal_id, v_bank_account_id, 'vendor', p_subcontractor_id, 0.00, v_net_amt, 'Bank / Cash Disbursement');

  IF v_tds_amt > 0 THEN
    INSERT INTO public.journal_entry_lines (journal_id, account_id, party_type, party_id, debit, credit, narration)
    VALUES (v_journal_id, v_tds_account_id, 'vendor', p_subcontractor_id, 0.00, v_tds_amt, 'TDS Payable (194C)');
  END IF;

  SELECT SUM(COALESCE(debit,0)), SUM(COALESCE(credit,0))
  INTO v_total_debit, v_total_credit
  FROM public.journal_entry_lines WHERE journal_id = v_journal_id;

  IF ABS(v_total_debit - v_total_credit) > 0.01 THEN
    RAISE EXCEPTION 'GL imbalance: debit=% credit=%. Transaction rolled back.', v_total_debit, v_total_credit;
  END IF;

  PERFORM public.recalc_subcontractor_balance(p_subcontractor_id, p_organisation_id);

  RETURN jsonb_build_object(
    'status', 'success', 'payment_id', v_payment_id, 'reference_no', v_ref_no,
    'gross_amount', v_gross_amt, 'tds_amount', v_tds_amt, 'net_amount', v_net_amt,
    'journal_id', v_journal_id, 'gl_debit', v_total_debit, 'gl_credit', v_total_credit
  );
END;
$$;

-- PART 4: release_subcontractor_retention — FAIL CLOSED + GL balance invariant
CREATE OR REPLACE FUNCTION public.release_subcontractor_retention(
  p_organisation_id UUID,
  p_retention_id UUID,
  p_release_date DATE DEFAULT CURRENT_DATE,
  p_payment_mode TEXT DEFAULT 'Bank Transfer',
  p_payment_reference TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ret RECORD; v_wo RECORD; v_retention_account_id UUID; v_bank_account_id UUID;
  v_journal_id UUID; v_ref_no TEXT; v_creator_id UUID;
  v_total_debit NUMERIC(15,2); v_total_credit NUMERIC(15,2);
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.user_can_access_org(p_organisation_id) THEN RAISE EXCEPTION 'Unauthorized organization access'; END IF;

  SELECT id INTO v_creator_id FROM public.user_profiles WHERE user_id = auth.uid() OR id = auth.uid() LIMIT 1;

  SELECT * INTO v_ret FROM public.subcontractor_retention WHERE id = p_retention_id FOR UPDATE;
  IF v_ret IS NULL THEN RAISE EXCEPTION 'Retention record not found'; END IF;

  SELECT * INTO v_wo FROM public.subcontractor_work_orders WHERE id = v_ret.work_order_id AND organisation_id = p_organisation_id;
  IF v_wo IS NULL THEN RAISE EXCEPTION 'Work order for retention does not belong to organization'; END IF;

  IF v_ret.status = 'Released' THEN
    RETURN jsonb_build_object('status', 'already_released', 'retention_id', p_retention_id, 'retention_amount', v_ret.retention_amount);
  END IF;

  SELECT id INTO v_retention_account_id FROM public.accounts WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id) AND account_code = '2150' LIMIT 1;
  IF LOWER(p_payment_mode) LIKE '%cash%' THEN
    SELECT id INTO v_bank_account_id FROM public.accounts WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id) AND account_code IN ('1300','1301') ORDER BY account_code DESC LIMIT 1;
  ELSE
    SELECT id INTO v_bank_account_id FROM public.accounts WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id) AND account_code = '1200' LIMIT 1;
  END IF;

  -- FAIL CLOSED: required accounts must exist
  IF v_retention_account_id IS NULL THEN
    RAISE EXCEPTION 'GL account for Retention Payable (2150) not configured for this organisation.';
  END IF;
  IF v_bank_account_id IS NULL THEN
    RAISE EXCEPTION 'GL account for Bank/Cash (1200/1300/1301) not configured for this organisation.';
  END IF;

  v_ref_no := COALESCE(p_payment_reference, 'RET-REL-' || p_retention_id::TEXT);

  UPDATE public.subcontractor_retention
  SET status = 'Released', actual_release_date = p_release_date, payment_reference = v_ref_no, idempotency_key = p_idempotency_key
  WHERE id = p_retention_id;

  INSERT INTO public.journal_entries (
    company_id, voucher_no, voucher_date, voucher_type, narration, status, created_by
  ) VALUES (
    p_organisation_id, v_ref_no, p_release_date, 'Payment',
    'Retention Release for Work Order ' || v_wo.work_order_no, 'Posted', v_creator_id
  ) RETURNING id INTO v_journal_id;

  INSERT INTO public.journal_entry_lines (journal_id, account_id, party_type, party_id, debit, credit, narration)
  VALUES (v_journal_id, v_retention_account_id, 'vendor', v_wo.subcontractor_id, v_ret.retention_amount, 0.00, 'Retention Liability Discharge');

  INSERT INTO public.journal_entry_lines (journal_id, account_id, party_type, party_id, debit, credit, narration)
  VALUES (v_journal_id, v_bank_account_id, 'vendor', v_wo.subcontractor_id, 0.00, v_ret.retention_amount, 'Bank Disbursement for Retention');

  SELECT SUM(COALESCE(debit,0)), SUM(COALESCE(credit,0))
  INTO v_total_debit, v_total_credit
  FROM public.journal_entry_lines WHERE journal_id = v_journal_id;

  IF ABS(v_total_debit - v_total_credit) > 0.01 THEN
    RAISE EXCEPTION 'GL imbalance: debit=% credit=%. Transaction rolled back.', v_total_debit, v_total_credit;
  END IF;

  RETURN jsonb_build_object(
    'status', 'success', 'retention_id', p_retention_id,
    'released_amount', v_ret.retention_amount, 'journal_id', v_journal_id,
    'gl_debit', v_total_debit, 'gl_credit', v_total_credit
  );
END;
$$;

-- PART 5: DROP LEGACY QUOTATION RLS POLICIES (QT-RLS-01)
-- These are superseded by quotation_header_org_policy (user_can_access_org)
DROP POLICY IF EXISTS quotation_header_organisation_policy ON public.quotation_header;
DROP POLICY IF EXISTS quotation_header_select ON public.quotation_header;
DROP POLICY IF EXISTS quotation_header_insert ON public.quotation_header;
DROP POLICY IF EXISTS quotation_header_update ON public.quotation_header;
DROP POLICY IF EXISTS quotation_header_delete ON public.quotation_header;
DROP POLICY IF EXISTS quotation_items_organisation_policy ON public.quotation_items;
