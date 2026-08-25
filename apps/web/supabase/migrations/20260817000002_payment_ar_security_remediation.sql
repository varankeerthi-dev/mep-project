-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration: 20260817000002_payment_ar_security_remediation.sql
-- Description: Phase 2.2 Payment / AR Security Remediation
--   1. Add idempotency_key column and UNIQUE index on public.receipts(org_id, idempotency_key)
--   2. Database trigger BEFORE INSERT on public.receipts blocking direct REST creation of posted receipts
--   3. Idempotency & race-safe deduplication inside record_customer_payment() RPC
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. ADD IDEMPOTENCY KEY COLUMN & UNIQUE INDEX ON RECEIPTS
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_receipts_org_idempotency 
ON public.receipts(org_id, idempotency_key) 
WHERE idempotency_key IS NOT NULL;

-- 2. TRIGGER FUNCTION BLOCKING DIRECT REST CREATION OF POSTED RECEIPTS
CREATE OR REPLACE FUNCTION public.fn_enforce_posted_receipt_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Direct REST clients cannot insert receipts with status IN ('paid', 'posted')
  IF NEW.status IN ('paid', 'posted') THEN
    IF current_setting('app.allow_posted_receipt_creation', true) IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'Direct creation of posted payment receipts via REST is forbidden. Use record_customer_payment() RPC.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_posted_receipt_creation ON public.receipts;
CREATE TRIGGER trg_enforce_posted_receipt_creation
  BEFORE INSERT ON public.receipts
  FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_posted_receipt_creation();

-- 3. REMEDIATED SERVER-AUTHORITATIVE CUSTOMER PAYMENT RPC WITH IDEMPOTENCY
CREATE OR REPLACE FUNCTION public.record_customer_payment(
  p_organisation_id UUID,
  p_client_id UUID,
  p_invoice_id UUID DEFAULT NULL,
  p_amount NUMERIC DEFAULT 0,
  p_receipt_date DATE DEFAULT CURRENT_DATE,
  p_payment_mode TEXT DEFAULT 'bank',
  p_reference_no TEXT DEFAULT NULL,
  p_remarks TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
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
  v_existing_receipt RECORD;
  v_effective_idempotency_key TEXT;
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

  -- Determine effective idempotency key (use p_idempotency_key or fallback to p_reference_no if present)
  v_effective_idempotency_key := COALESCE(TRIM(p_idempotency_key), TRIM(p_reference_no));
  IF v_effective_idempotency_key = '' THEN
    v_effective_idempotency_key := NULL;
  END IF;

  -- C. Server-Side Idempotency Check (Pre-check)
  IF v_effective_idempotency_key IS NOT NULL THEN
    SELECT id, receipt_no, amount, invoice_id INTO v_existing_receipt
    FROM public.receipts
    WHERE org_id = p_organisation_id 
      AND idempotency_key = v_effective_idempotency_key
      AND status IN ('paid', 'posted')
    LIMIT 1;

    IF v_existing_receipt.id IS NOT NULL THEN
      IF p_invoice_id IS NOT NULL THEN
        SELECT COALESCE(paid_amount, 0) INTO v_new_paid_amount
        FROM public.invoices
        WHERE id = p_invoice_id;
      END IF;

      SELECT id INTO v_journal_id
      FROM public.journal_entries
      WHERE company_id = p_organisation_id AND voucher_no = v_existing_receipt.receipt_no
      LIMIT 1;

      RETURN jsonb_build_object(
        'status', 'success',
        'receipt_id', v_existing_receipt.id,
        'receipt_no', v_existing_receipt.receipt_no,
        'amount', v_existing_receipt.amount,
        'invoice_id', v_existing_receipt.invoice_id,
        'new_paid_amount', v_new_paid_amount,
        'journal_id', v_journal_id,
        'idempotent_replayed', true
      );
    END IF;
  END IF;

  -- D. Invoice Allocation Validation (if invoice_id is provided)
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

  -- E. Set Transaction-Local Session Flag for Trigger Bypass
  PERFORM set_config('app.allow_posted_receipt_creation', 'true', true);

  -- F. Generate Receipt Number
  v_receipt_no := public.generate_next_receipt_number(p_organisation_id);

  -- G. Insert Receipt Record with Unique Constraint Protection
  BEGIN
    INSERT INTO public.receipts (
      org_id, client_id, invoice_id, receipt_no, amount,
      receipt_date, payment_type, payment_mode, reference_no,
      remarks, status, idempotency_key, created_by
    ) VALUES (
      p_organisation_id, p_client_id, p_invoice_id, v_receipt_no, p_amount,
      COALESCE(p_receipt_date, CURRENT_DATE), 'Payment', COALESCE(p_payment_mode, 'bank'), p_reference_no,
      p_remarks, 'paid', v_effective_idempotency_key, auth.uid()
    ) RETURNING id INTO v_receipt_id;
  EXCEPTION WHEN unique_violation THEN
    -- Race condition safety: if a concurrent insert won the race with the same idempotency key
    IF v_effective_idempotency_key IS NOT NULL THEN
      SELECT id, receipt_no, amount, invoice_id INTO v_existing_receipt
      FROM public.receipts
      WHERE org_id = p_organisation_id AND idempotency_key = v_effective_idempotency_key
      LIMIT 1;

      IF v_existing_receipt.id IS NOT NULL THEN
        IF p_invoice_id IS NOT NULL THEN
          SELECT COALESCE(paid_amount, 0) INTO v_new_paid_amount FROM public.invoices WHERE id = p_invoice_id;
        END IF;
        SELECT id INTO v_journal_id FROM public.journal_entries WHERE company_id = p_organisation_id AND voucher_no = v_existing_receipt.receipt_no LIMIT 1;

        RETURN jsonb_build_object(
          'status', 'success',
          'receipt_id', v_existing_receipt.id,
          'receipt_no', v_existing_receipt.receipt_no,
          'amount', v_existing_receipt.amount,
          'invoice_id', v_existing_receipt.invoice_id,
          'new_paid_amount', v_new_paid_amount,
          'journal_id', v_journal_id,
          'idempotent_replayed', true
        );
      END IF;
    END IF;
    RAISE;
  END;

  -- H. Retrieve Updated Paid Amount from Invoice
  IF p_invoice_id IS NOT NULL THEN
    SELECT COALESCE(paid_amount, 0) INTO v_new_paid_amount
    FROM public.invoices
    WHERE id = p_invoice_id;
  END IF;

  -- I. Atomic Double-Entry GL Journal Posting
  IF LOWER(TRIM(COALESCE(p_payment_mode, ''))) = 'cash' THEN
    SELECT id INTO v_bank_account_id
    FROM public.accounts
    WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id)
      AND account_code = '1300'
    LIMIT 1;
  END IF;

  IF v_bank_account_id IS NULL THEN
    SELECT id INTO v_bank_account_id
    FROM public.accounts
    WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id)
      AND account_code = '1200'
    LIMIT 1;
  END IF;

  SELECT id INTO v_ar_account_id
  FROM public.accounts
  WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id)
    AND account_code = '1100'
  LIMIT 1;

  IF v_bank_account_id IS NOT NULL AND v_ar_account_id IS NOT NULL THEN
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

    INSERT INTO public.journal_entry_lines (
      journal_id, account_id, party_type, party_id, debit, credit, narration
    ) VALUES (
      v_journal_id, v_bank_account_id, 'client', p_client_id, p_amount, 0.00, 'Bank/Cash Received'
    );

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
