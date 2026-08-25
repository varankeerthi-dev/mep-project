-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration: 20260817000001_payment_ar_security_hardening.sql
-- Description: Phase 2 Accounts Receivable / Customer Payment Security Hardening
--   1. Server-Authoritative record_customer_payment SECURITY DEFINER RPC
--   2. Database-level immutability triggers for posted receipts
--   3. Cross-client IDOR validation & overpayment prevention
--   4. Atomic double-entry GL journal posting (Dr Bank/Cash, Cr Accounts Receivable)
--   5. Hardened tenant RLS policies for journal_entries and journal_entry_lines
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. NUMBER SERIES GENERATOR FOR RECEIPTS
CREATE OR REPLACE FUNCTION public.generate_next_receipt_number(p_org_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_num INTEGER;
  v_receipt_no TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(receipt_no FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO v_next_num
  FROM public.receipts
  WHERE org_id = p_org_id AND receipt_no ~ '^PAY-[0-9]+$';

  v_receipt_no := 'PAY-' || LPAD(v_next_num::TEXT, 4, '0');
  RETURN v_receipt_no;
END;
$$;

-- 2. SERVER-AUTHORITATIVE CUSTOMER PAYMENT RPC
CREATE OR REPLACE FUNCTION public.record_customer_payment(
  p_organisation_id UUID,
  p_client_id UUID,
  p_invoice_id UUID DEFAULT NULL,
  p_amount NUMERIC DEFAULT 0,
  p_receipt_date DATE DEFAULT CURRENT_DATE,
  p_payment_mode TEXT DEFAULT 'bank',
  p_reference_no TEXT DEFAULT NULL,
  p_remarks TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice RECORD;
  v_client RECORD;
  v_remaining NUMERIC(15,2);
  v_receipt_id UUID;
  v_receipt_no TEXT;
  v_bank_account_id UUID;
  v_ar_account_id UUID;
  v_journal_id UUID;
  v_new_paid_amount NUMERIC(15,2);
  v_result JSONB;
BEGIN
  -- A. Authentication & Tenant Authorization
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organization access';
  END IF;

  -- B. Parameter Validation
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;

  IF p_client_id IS NULL THEN
    RAISE EXCEPTION 'Client ID is required';
  END IF;

  -- Validate client belongs to organisation
  SELECT * INTO v_client
  FROM public.clients
  WHERE id = p_client_id AND (organisation_id = p_organisation_id OR org_id = p_organisation_id);

  IF v_client IS NULL THEN
    RAISE EXCEPTION 'Client not found or does not belong to organization';
  END IF;

  -- C. Invoice Allocation Validation (if invoice_id is provided)
  IF p_invoice_id IS NOT NULL THEN
    SELECT * INTO v_invoice
    FROM public.invoices
    WHERE id = p_invoice_id
      AND (organisation_id = p_organisation_id OR org_id = p_organisation_id)
    FOR UPDATE;

    IF v_invoice IS NULL THEN
      RAISE EXCEPTION 'Invoice not found or does not belong to organization';
    END IF;

    -- Cross-client IDOR validation: Invoice client must match payment client
    IF v_invoice.client_id != p_client_id THEN
      RAISE EXCEPTION 'Invoice belongs to a different client than the payment client';
    END IF;

    -- Invoice status check: Invoice must be finalized
    IF v_invoice.status != 'final' THEN
      RAISE EXCEPTION 'Cannot record payments against non-finalized invoices (status: %)', v_invoice.status;
    END IF;

    -- Overpayment Check
    v_remaining := ROUND((v_invoice.total - COALESCE(v_invoice.paid_amount, 0))::NUMERIC, 2);
    IF p_amount > v_remaining THEN
      RAISE EXCEPTION 'Payment amount (₹%) exceeds invoice remaining balance (₹%)', p_amount, v_remaining;
    END IF;
  END IF;

  -- D. Generate Receipt Number
  v_receipt_no := public.generate_next_receipt_number(p_organisation_id);

  -- E. Insert Receipt Record
  INSERT INTO public.receipts (
    org_id, client_id, invoice_id, receipt_no, amount,
    receipt_date, payment_type, payment_mode, reference_no,
    remarks, status, created_by
  ) VALUES (
    p_organisation_id, p_client_id, p_invoice_id, v_receipt_no, p_amount,
    COALESCE(p_receipt_date, CURRENT_DATE), 'Payment', COALESCE(p_payment_mode, 'bank'), p_reference_no,
    p_remarks, 'paid', auth.uid()
  ) RETURNING id INTO v_receipt_id;

  -- F. Retrieve Updated Paid Amount from Invoice
  IF p_invoice_id IS NOT NULL THEN
    SELECT COALESCE(paid_amount, 0) INTO v_new_paid_amount
    FROM public.invoices
    WHERE id = p_invoice_id;
  END IF;

  -- G. Atomic Double-Entry GL Journal Posting
  -- Resolve Chart of Accounts: Bank/Cash vs Accounts Receivable
  IF LOWER(TRIM(COALESCE(p_payment_mode, ''))) = 'cash' THEN
    SELECT id INTO v_bank_account_id
    FROM public.accounts
    WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id)
      AND account_code = '1300' -- Cash-in-Hand
    LIMIT 1;
  END IF;

  IF v_bank_account_id IS NULL THEN
    SELECT id INTO v_bank_account_id
    FROM public.accounts
    WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id)
      AND account_code = '1200' -- Bank Accounts
    LIMIT 1;
  END IF;

  SELECT id INTO v_ar_account_id
  FROM public.accounts
  WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id)
    AND account_code = '1100' -- Accounts Receivable / Sundry Debtors
  LIMIT 1;

  IF v_bank_account_id IS NOT NULL AND v_ar_account_id IS NOT NULL THEN
    -- Create Header Journal Entry
    INSERT INTO public.journal_entries (
      company_id, voucher_no, voucher_date, voucher_type,
      narration, status, created_by
    ) VALUES (
      p_organisation_id,
      v_receipt_no,
      COALESCE(p_receipt_date, CURRENT_DATE),
      'Receipt',
      'Customer Payment Received - ' || v_receipt_no || COALESCE(' (' || p_remarks || ')', ''),
      'Posted',
      auth.uid()
    ) RETURNING id INTO v_journal_id;

    -- Line 1: Debit Bank/Cash Account
    INSERT INTO public.journal_entry_lines (
      journal_id, account_id, party_type, party_id, debit, credit, narration
    ) VALUES (
      v_journal_id, v_bank_account_id, 'client', p_client_id, p_amount, 0.00, 'Bank/Cash Received'
    );

    -- Line 2: Credit Accounts Receivable
    INSERT INTO public.journal_entry_lines (
      journal_id, account_id, party_type, party_id, debit, credit, narration
    ) VALUES (
      v_journal_id, v_ar_account_id, 'client', p_client_id, 0.00, p_amount, 'Accounts Receivable Settlement'
    );
  END IF;

  v_result := jsonb_build_object(
    'status', 'success',
    'receipt_id', v_receipt_id,
    'receipt_no', v_receipt_no,
    'amount', p_amount,
    'invoice_id', p_invoice_id,
    'new_paid_amount', v_new_paid_amount,
    'journal_id', v_journal_id
  );

  RETURN v_result;
END;
$$;

-- 3. DATABASE IMMUTABILITY TRIGGER FOR POSTED RECEIPTS
CREATE OR REPLACE FUNCTION public.fn_prevent_posted_receipt_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IN ('paid', 'posted') THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Cannot delete a posted payment receipt (Receipt No: %). Issue a payment reversal.', OLD.receipt_no;
    ELSIF TG_OP = 'UPDATE' THEN
      -- Block modification of core financial fields
      IF NEW.amount IS DISTINCT FROM OLD.amount OR
         NEW.client_id IS DISTINCT FROM OLD.client_id OR
         NEW.invoice_id IS DISTINCT FROM OLD.invoice_id OR
         NEW.org_id IS DISTINCT FROM OLD.org_id THEN
        RAISE EXCEPTION 'Cannot modify financial fields of a posted payment receipt (Receipt No: %).', OLD.receipt_no;
      END IF;

      IF NEW.status = 'draft' THEN
        RAISE EXCEPTION 'Cannot revert a posted payment receipt back to draft status.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_posted_receipt_mutation ON public.receipts;
CREATE TRIGGER trg_prevent_posted_receipt_mutation
  BEFORE UPDATE OR DELETE ON public.receipts
  FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_posted_receipt_mutation();

-- 4. HARDEN RLS POLICIES FOR JOURNAL_ENTRIES & JOURNAL_ENTRY_LINES
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view journal_entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Users can insert journal_entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Users can update journal_entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Users can delete journal_entries" ON public.journal_entries;
DROP POLICY IF EXISTS "journal_entries_tenant_isolation" ON public.journal_entries;

CREATE POLICY "journal_entries_tenant_isolation" ON public.journal_entries
  FOR ALL TO authenticated
  USING (public.user_can_access_org(company_id))
  WITH CHECK (public.user_can_access_org(company_id));

ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view journal_entry_lines" ON public.journal_entry_lines;
DROP POLICY IF EXISTS "Users can insert journal_entry_lines" ON public.journal_entry_lines;
DROP POLICY IF EXISTS "Users can update journal_entry_lines" ON public.journal_entry_lines;
DROP POLICY IF EXISTS "Users can delete journal_entry_lines" ON public.journal_entry_lines;
DROP POLICY IF EXISTS "journal_entry_lines_tenant_isolation" ON public.journal_entry_lines;

CREATE POLICY "journal_entry_lines_tenant_isolation" ON public.journal_entry_lines
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.journal_entries je
      WHERE je.id = journal_entry_lines.journal_id
        AND public.user_can_access_org(je.company_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.journal_entries je
      WHERE je.id = journal_entry_lines.journal_id
        AND public.user_can_access_org(je.company_id)
    )
  );
