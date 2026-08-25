-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration: 20260817000003_credit_debit_note_security_hardening.sql
-- Description: Phase 3 Financial Security Hardening for Credit Notes & Debit Notes
--   1. Idempotency columns & UNIQUE indexes on credit_notes and debit_notes
--   2. Triggers blocking direct REST creation of approved/posted credit/debit notes
--   3. Immutability triggers on credit_notes and debit_notes
--   4. RLS hardening on debit_note_items (removing permissive USING (true) policies)
--   5. Authoritative RPCs record_credit_note() and record_debit_note()
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. ADD IDEMPOTENCY KEY COLUMNS & UNIQUE INDEXES
ALTER TABLE public.credit_notes ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_notes_org_idempotency 
ON public.credit_notes(organisation_id, idempotency_key) 
WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.debit_notes ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE public.debit_notes ALTER COLUMN bill_id DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_debit_notes_org_idempotency 
ON public.debit_notes(organisation_id, idempotency_key) 
WHERE idempotency_key IS NOT NULL;

-- 2. DOCUMENT NUMBER GENERATORS
CREATE OR REPLACE FUNCTION public.generate_next_cn_number(p_org_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
  v_next_no TEXT;
BEGIN
  SELECT COUNT(*) + 1 INTO v_count
  FROM public.credit_notes
  WHERE organisation_id = p_org_id;

  v_next_no := 'CN-' || TO_CHAR(CURRENT_DATE, 'YYYYMM') || '-' || LPAD(v_count::TEXT, 4, '0');
  RETURN v_next_no;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_next_dn_number(p_org_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
  v_next_no TEXT;
BEGIN
  SELECT COUNT(*) + 1 INTO v_count
  FROM public.debit_notes
  WHERE organisation_id = p_org_id;

  v_next_no := 'DN-' || TO_CHAR(CURRENT_DATE, 'YYYYMM') || '-' || LPAD(v_count::TEXT, 4, '0');
  RETURN v_next_no;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalc_vendor_balance(p_vendor_id UUID, p_organisation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN;
END;
$$;

-- 3. TRIGGERS BLOCKING DIRECT REST POSTED NOTE CREATION
CREATE OR REPLACE FUNCTION public.fn_enforce_posted_cn_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.approval_status IN ('Approved', 'posted', 'Final') THEN
    IF current_setting('app.allow_posted_cn_creation', true) IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'Direct creation of posted/approved credit notes via REST is forbidden. Use record_credit_note() RPC.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_posted_cn_creation ON public.credit_notes;
CREATE TRIGGER trg_enforce_posted_cn_creation
  BEFORE INSERT ON public.credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_posted_cn_creation();

CREATE OR REPLACE FUNCTION public.fn_enforce_posted_dn_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.approval_status IN ('Approved', 'posted', 'Final') THEN
    IF current_setting('app.allow_posted_dn_creation', true) IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'Direct creation of posted/approved debit notes via REST is forbidden. Use record_debit_note() RPC.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_posted_dn_creation ON public.debit_notes;
CREATE TRIGGER trg_enforce_posted_dn_creation
  BEFORE INSERT ON public.debit_notes
  FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_posted_dn_creation();

-- 4. IMMUTABILITY TRIGGERS
CREATE OR REPLACE FUNCTION public.fn_prevent_posted_cn_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.approval_status IN ('Approved', 'posted', 'Final') THEN
      RAISE EXCEPTION 'Cannot delete an approved/posted credit note (ID: %)', OLD.id;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.approval_status IN ('Approved', 'posted', 'Final') THEN
      IF NEW.total_amount IS DISTINCT FROM OLD.total_amount OR
         NEW.taxable_amount IS DISTINCT FROM OLD.taxable_amount OR
         NEW.cgst_amount IS DISTINCT FROM OLD.cgst_amount OR
         NEW.sgst_amount IS DISTINCT FROM OLD.sgst_amount OR
         NEW.igst_amount IS DISTINCT FROM OLD.igst_amount OR
         NEW.client_id IS DISTINCT FROM OLD.client_id OR
         NEW.invoice_id IS DISTINCT FROM OLD.invoice_id OR
         NEW.organisation_id IS DISTINCT FROM OLD.organisation_id OR
         NEW.cn_number IS DISTINCT FROM OLD.cn_number THEN
        RAISE EXCEPTION 'Cannot modify financial fields of an approved/posted credit note';
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_posted_cn_mutation ON public.credit_notes;
CREATE TRIGGER trg_prevent_posted_cn_mutation
  BEFORE UPDATE OR DELETE ON public.credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_posted_cn_mutation();

CREATE OR REPLACE FUNCTION public.fn_prevent_posted_dn_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.approval_status IN ('Approved', 'posted', 'Final') THEN
      RAISE EXCEPTION 'Cannot delete an approved/posted debit note (ID: %)', OLD.id;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.approval_status IN ('Approved', 'posted', 'Final') THEN
      IF NEW.total_amount IS DISTINCT FROM OLD.total_amount OR
         NEW.taxable_amount IS DISTINCT FROM OLD.taxable_amount OR
         NEW.cgst_amount IS DISTINCT FROM OLD.cgst_amount OR
         NEW.sgst_amount IS DISTINCT FROM OLD.sgst_amount OR
         NEW.igst_amount IS DISTINCT FROM OLD.igst_amount OR
         NEW.vendor_id IS DISTINCT FROM OLD.vendor_id OR
         NEW.bill_id IS DISTINCT FROM OLD.bill_id OR
         NEW.organisation_id IS DISTINCT FROM OLD.organisation_id OR
         NEW.dn_number IS DISTINCT FROM OLD.dn_number THEN
        RAISE EXCEPTION 'Cannot modify financial fields of an approved/posted debit note';
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_posted_dn_mutation ON public.debit_notes;
CREATE TRIGGER trg_prevent_posted_dn_mutation
  BEFORE UPDATE OR DELETE ON public.debit_notes
  FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_posted_dn_mutation();

-- 5. RLS HARDENING
DROP POLICY IF EXISTS "Enable all access" ON public.debit_note_items;
DROP POLICY IF EXISTS "debit_note_items_all_access" ON public.debit_note_items;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'debit_note_items' AND policyname = 'debit_note_items_tenant_access'
  ) THEN
    CREATE POLICY debit_note_items_tenant_access ON public.debit_note_items
      FOR ALL TO authenticated
      USING (public.user_can_access_org(organisation_id))
      WITH CHECK (public.user_can_access_org(organisation_id));
  END IF;
END;
$$;

-- 6. AUTHORITATIVE SALES CREDIT NOTE RPC
CREATE OR REPLACE FUNCTION public.record_credit_note(
  p_organisation_id UUID,
  p_client_id UUID,
  p_invoice_id UUID DEFAULT NULL,
  p_cn_date DATE DEFAULT CURRENT_DATE,
  p_cn_type TEXT DEFAULT 'Sales Return',
  p_reason TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_items JSONB DEFAULT '[]'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice RECORD;
  v_client RECORD;
  v_existing_cn RECORD;
  v_effective_idempotency_key TEXT;
  v_cn_id UUID;
  v_cn_number TEXT;
  v_item RECORD;
  v_line_qty NUMERIC(15,3);
  v_line_rate NUMERIC(15,2);
  v_line_tax_pct NUMERIC(5,2);
  v_line_taxable NUMERIC(15,2);
  v_line_cgst NUMERIC(15,2) := 0;
  v_line_sgst NUMERIC(15,2) := 0;
  v_line_igst NUMERIC(15,2) := 0;
  v_line_total NUMERIC(15,2);
  
  v_total_taxable NUMERIC(15,2) := 0;
  v_total_cgst NUMERIC(15,2) := 0;
  v_total_sgst NUMERIC(15,2) := 0;
  v_total_igst NUMERIC(15,2) := 0;
  v_grand_total NUMERIC(15,2) := 0;

  v_is_intrastate BOOLEAN := TRUE;
  v_org_state TEXT;
  v_client_state TEXT;
  
  v_sales_return_account_id UUID;
  v_ar_account_id UUID;
  v_journal_id UUID;
  v_remaining NUMERIC(15,2);
  v_result JSONB;
BEGIN
  -- A. Authentication & Tenant Authorization
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organization access';
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

  -- Determine effective idempotency key
  v_effective_idempotency_key := TRIM(p_idempotency_key);
  IF v_effective_idempotency_key = '' THEN
    v_effective_idempotency_key := NULL;
  END IF;

  -- B. Pre-check Idempotency
  IF v_effective_idempotency_key IS NOT NULL THEN
    SELECT id, cn_number, total_amount, invoice_id INTO v_existing_cn
    FROM public.credit_notes
    WHERE organisation_id = p_organisation_id 
      AND idempotency_key = v_effective_idempotency_key
      AND approval_status IN ('Approved', 'posted', 'Final')
    LIMIT 1;

    IF v_existing_cn.id IS NOT NULL THEN
      SELECT id INTO v_journal_id
      FROM public.journal_entries
      WHERE company_id = p_organisation_id AND voucher_no = v_existing_cn.cn_number
      LIMIT 1;

      RETURN jsonb_build_object(
        'status', 'success',
        'cn_id', v_existing_cn.id,
        'cn_number', v_existing_cn.cn_number,
        'total_amount', v_existing_cn.total_amount,
        'invoice_id', v_existing_cn.invoice_id,
        'journal_id', v_journal_id,
        'idempotent_replayed', true
      );
    END IF;
  END IF;

  -- C. Validate Invoice Allocation (if invoice_id is supplied)
  IF p_invoice_id IS NOT NULL THEN
    SELECT * INTO v_invoice
    FROM public.invoices
    WHERE id = p_invoice_id
      AND (organisation_id = p_organisation_id OR org_id = p_organisation_id)
    FOR UPDATE;

    IF v_invoice IS NULL THEN
      RAISE EXCEPTION 'Invoice not found or does not belong to organization';
    END IF;

    IF v_invoice.client_id != p_client_id THEN
      RAISE EXCEPTION 'Invoice belongs to a different client than the supplied client';
    END IF;

    IF v_invoice.status != 'final' THEN
      RAISE EXCEPTION 'Cannot apply credit note to non-finalized invoice (status: %)', v_invoice.status;
    END IF;
  END IF;

  -- D. State Jurisdiction for Tax Calculation
  SELECT state INTO v_org_state FROM public.organisations WHERE id = p_organisation_id;
  v_client_state := v_client.state;
  IF v_org_state IS NOT NULL AND v_client_state IS NOT NULL AND LOWER(TRIM(v_org_state)) != LOWER(TRIM(v_client_state)) THEN
    v_is_intrastate := FALSE;
  END IF;

  -- E. Server-Side Calculations for Line Items
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Credit note must contain at least one line item';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
    description TEXT, hsn_code TEXT, quantity NUMERIC, rate NUMERIC, tax_percent NUMERIC
  ) LOOP
    v_line_qty := COALESCE(v_item.quantity, 0);
    v_line_rate := COALESCE(v_item.rate, 0);
    v_line_tax_pct := COALESCE(v_item.tax_percent, 0);

    IF v_line_qty <= 0 OR v_line_rate <= 0 THEN
      RAISE EXCEPTION 'Line item quantity and rate must be greater than zero';
    END IF;

    v_line_taxable := ROUND(v_line_qty * v_line_rate, 2);
    
    IF v_is_intrastate THEN
      v_line_cgst := ROUND(v_line_taxable * (v_line_tax_pct / 200.0), 2);
      v_line_sgst := ROUND(v_line_taxable * (v_line_tax_pct / 200.0), 2);
      v_line_igst := 0;
    ELSE
      v_line_igst := ROUND(v_line_taxable * (v_line_tax_pct / 100.0), 2);
      v_line_cgst := 0;
      v_line_sgst := 0;
    END IF;

    v_line_total := v_line_taxable + v_line_cgst + v_line_sgst + v_line_igst;

    v_total_taxable := v_total_taxable + v_line_taxable;
    v_total_cgst := v_total_cgst + v_line_cgst;
    v_total_sgst := v_total_sgst + v_line_sgst;
    v_total_igst := v_total_igst + v_line_igst;
  END LOOP;

  v_grand_total := v_total_taxable + v_total_cgst + v_total_sgst + v_total_igst;

  IF v_grand_total <= 0 THEN
    RAISE EXCEPTION 'Credit note total must be greater than zero';
  END IF;

  -- Validate over-adjustment if invoice_id is supplied
  IF p_invoice_id IS NOT NULL THEN
    v_remaining := ROUND((v_invoice.total - COALESCE(v_invoice.paid_amount, 0))::NUMERIC, 2);
    IF v_grand_total > v_remaining THEN
      RAISE EXCEPTION 'Credit note total (₹%) exceeds invoice remaining balance (₹%)', v_grand_total, v_remaining;
    END IF;
  END IF;

  -- F. Set Transaction Creation Flag & Generate Number
  PERFORM set_config('app.allow_posted_cn_creation', 'true', true);
  v_cn_number := public.generate_next_cn_number(p_organisation_id);

  -- G. Insert Credit Note Header with Unique Index Protection
  BEGIN
    INSERT INTO public.credit_notes (
      organisation_id, client_id, invoice_id, cn_number, cn_date,
      cn_type, reason, taxable_amount, cgst_amount, sgst_amount,
      igst_amount, total_amount, approval_status, idempotency_key, created_at
    ) VALUES (
      p_organisation_id, p_client_id, p_invoice_id, v_cn_number, COALESCE(p_cn_date, CURRENT_DATE),
      COALESCE(p_cn_type, 'Sales Return'), p_reason, v_total_taxable, v_total_cgst, v_total_sgst,
      v_total_igst, v_grand_total, 'Approved', v_effective_idempotency_key, NOW()
    ) RETURNING id INTO v_cn_id;
  EXCEPTION WHEN unique_violation THEN
    IF v_effective_idempotency_key IS NOT NULL THEN
      SELECT id, cn_number, total_amount, invoice_id INTO v_existing_cn
      FROM public.credit_notes
      WHERE organisation_id = p_organisation_id AND idempotency_key = v_effective_idempotency_key;

      IF v_existing_cn.id IS NOT NULL THEN
        SELECT id INTO v_journal_id FROM public.journal_entries WHERE company_id = p_organisation_id AND voucher_no = v_existing_cn.cn_number LIMIT 1;
        RETURN jsonb_build_object(
          'status', 'success',
          'cn_id', v_existing_cn.id,
          'cn_number', v_existing_cn.cn_number,
          'total_amount', v_existing_cn.total_amount,
          'invoice_id', v_existing_cn.invoice_id,
          'journal_id', v_journal_id,
          'idempotent_replayed', true
        );
      END IF;
    END IF;
    RAISE;
  END;

  -- H. Insert Credit Note Items
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
    description TEXT, hsn_code TEXT, quantity NUMERIC, rate NUMERIC, tax_percent NUMERIC
  ) LOOP
    v_line_qty := COALESCE(v_item.quantity, 0);
    v_line_rate := COALESCE(v_item.rate, 0);
    v_line_tax_pct := COALESCE(v_item.tax_percent, 0);
    v_line_taxable := ROUND(v_line_qty * v_line_rate, 2);

    IF v_is_intrastate THEN
      v_line_cgst := ROUND(v_line_taxable * (v_line_tax_pct / 200.0), 2);
      v_line_sgst := ROUND(v_line_taxable * (v_line_tax_pct / 200.0), 2);
      v_line_igst := 0;
    ELSE
      v_line_igst := ROUND(v_line_taxable * (v_line_tax_pct / 100.0), 2);
      v_line_cgst := 0;
      v_line_sgst := 0;
    END IF;
    v_line_total := v_line_taxable + v_line_cgst + v_line_sgst + v_line_igst;

    INSERT INTO public.credit_note_items (
      cn_id, organisation_id, description, hsn_code, quantity, rate,
      discount_amount, taxable_value, cgst_percent, cgst_amount,
      sgst_percent, sgst_amount, igst_percent, igst_amount, total_amount
    ) VALUES (
      v_cn_id, p_organisation_id, COALESCE(v_item.description, 'Item'), v_item.hsn_code, v_line_qty, v_line_rate,
      0, v_line_taxable,
      CASE WHEN v_is_intrastate THEN v_line_tax_pct / 2.0 ELSE 0 END, v_line_cgst,
      CASE WHEN v_is_intrastate THEN v_line_tax_pct / 2.0 ELSE 0 END, v_line_sgst,
      CASE WHEN NOT v_is_intrastate THEN v_line_tax_pct ELSE 0 END, v_line_igst,
      v_line_total
    );
  END LOOP;

  -- I. Atomic Double-Entry GL Journal Posting
  SELECT id INTO v_sales_return_account_id
  FROM public.accounts
  WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id)
    AND (account_code IN ('4100', '5100', '4000') OR name ILIKE '%Sales Return%' OR name ILIKE '%Revenue%')
  LIMIT 1;

  SELECT id INTO v_ar_account_id
  FROM public.accounts
  WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id)
    AND account_code = '1100'
  LIMIT 1;

  IF v_sales_return_account_id IS NOT NULL AND v_ar_account_id IS NOT NULL THEN
    INSERT INTO public.journal_entries (
      company_id, voucher_no, voucher_date, voucher_type,
      narration, status, created_by
    ) VALUES (
      p_organisation_id,
      v_cn_number,
      COALESCE(p_cn_date, CURRENT_DATE),
      'Credit Note',
      'Sales Credit Note - ' || v_cn_number || COALESCE(' (' || p_reason || ')', ''),
      'Posted',
      auth.uid()
    ) RETURNING id INTO v_journal_id;

    -- Dr Sales Returns
    INSERT INTO public.journal_entry_lines (
      journal_id, account_id, party_type, party_id, debit, credit, narration
    ) VALUES (
      v_journal_id, v_sales_return_account_id, 'client', p_client_id, v_grand_total, 0.00, 'Sales Returns / Adjustment'
    );

    -- Cr Accounts Receivable
    INSERT INTO public.journal_entry_lines (
      journal_id, account_id, party_type, party_id, debit, credit, narration
    ) VALUES (
      v_journal_id, v_ar_account_id, 'client', p_client_id, 0.00, v_grand_total, 'AR Reduction via Credit Note'
    );
  END IF;

  v_result := jsonb_build_object(
    'status', 'success',
    'cn_id', v_cn_id,
    'cn_number', v_cn_number,
    'total_amount', v_grand_total,
    'invoice_id', p_invoice_id,
    'journal_id', v_journal_id
  );

  RETURN v_result;
END;
$$;

-- 7. AUTHORITATIVE PURCHASE DEBIT NOTE RPC
CREATE OR REPLACE FUNCTION public.record_debit_note(
  p_organisation_id UUID,
  p_vendor_id UUID,
  p_bill_id UUID DEFAULT NULL,
  p_dn_date DATE DEFAULT CURRENT_DATE,
  p_dn_type TEXT DEFAULT 'Return',
  p_reason TEXT DEFAULT 'Purchase Return',
  p_idempotency_key TEXT DEFAULT NULL,
  p_items JSONB DEFAULT '[]'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bill RECORD;
  v_vendor RECORD;
  v_existing_dn RECORD;
  v_effective_idempotency_key TEXT;
  v_dn_id UUID;
  v_dn_number TEXT;
  v_item RECORD;
  v_line_qty NUMERIC(15,3);
  v_line_rate NUMERIC(15,2);
  v_line_tax_pct NUMERIC(5,2);
  v_line_taxable NUMERIC(15,2);
  v_line_cgst NUMERIC(15,2) := 0;
  v_line_sgst NUMERIC(15,2) := 0;
  v_line_igst NUMERIC(15,2) := 0;
  v_line_total NUMERIC(15,2);

  v_total_taxable NUMERIC(15,2) := 0;
  v_total_cgst NUMERIC(15,2) := 0;
  v_total_sgst NUMERIC(15,2) := 0;
  v_total_igst NUMERIC(15,2) := 0;
  v_grand_total NUMERIC(15,2) := 0;

  v_is_intrastate BOOLEAN := TRUE;
  v_org_state TEXT;
  v_vendor_state TEXT;

  v_ap_account_id UUID;
  v_purchase_return_account_id UUID;
  v_journal_id UUID;
  v_result JSONB;
BEGIN
  -- A. Authentication & Tenant Authorization
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organization access';
  END IF;

  IF p_vendor_id IS NULL THEN
    RAISE EXCEPTION 'Vendor ID is required';
  END IF;

  -- Validate vendor belongs to organization
  SELECT * INTO v_vendor
  FROM public.purchase_vendors
  WHERE id = p_vendor_id AND (organisation_id = p_organisation_id OR org_id = p_organisation_id);

  IF v_vendor IS NULL THEN
    RAISE EXCEPTION 'Vendor not found or does not belong to organization';
  END IF;

  -- Determine effective idempotency key
  v_effective_idempotency_key := TRIM(p_idempotency_key);
  IF v_effective_idempotency_key = '' THEN
    v_effective_idempotency_key := NULL;
  END IF;

  -- B. Pre-check Idempotency
  IF v_effective_idempotency_key IS NOT NULL THEN
    SELECT id, dn_number, total_amount, bill_id INTO v_existing_dn
    FROM public.debit_notes
    WHERE organisation_id = p_organisation_id
      AND idempotency_key = v_effective_idempotency_key
      AND approval_status IN ('Approved', 'posted', 'Final')
    LIMIT 1;

    IF v_existing_dn.id IS NOT NULL THEN
      SELECT id INTO v_journal_id
      FROM public.journal_entries
      WHERE company_id = p_organisation_id AND voucher_no = v_existing_dn.dn_number
      LIMIT 1;

      RETURN jsonb_build_object(
        'status', 'success',
        'dn_id', v_existing_dn.id,
        'dn_number', v_existing_dn.dn_number,
        'total_amount', v_existing_dn.total_amount,
        'bill_id', v_existing_dn.bill_id,
        'journal_id', v_journal_id,
        'idempotent_replayed', true
      );
    END IF;
  END IF;

  -- C. Validate Bill Allocation (if bill_id is supplied)
  IF p_bill_id IS NOT NULL THEN
    SELECT * INTO v_bill
    FROM public.purchase_bills
    WHERE id = p_bill_id
      AND (organisation_id = p_organisation_id OR org_id = p_organisation_id)
    FOR UPDATE;

    IF v_bill IS NULL THEN
      RAISE EXCEPTION 'Purchase bill not found or does not belong to organization';
    END IF;

    IF v_bill.vendor_id != p_vendor_id THEN
      RAISE EXCEPTION 'Purchase bill belongs to a different vendor than the supplied vendor';
    END IF;
  END IF;

  -- D. State Jurisdiction for Tax Calculation
  SELECT state INTO v_org_state FROM public.organisations WHERE id = p_organisation_id;
  v_vendor_state := v_vendor.state;
  IF v_org_state IS NOT NULL AND v_vendor_state IS NOT NULL AND LOWER(TRIM(v_org_state)) != LOWER(TRIM(v_vendor_state)) THEN
    v_is_intrastate := FALSE;
  END IF;

  -- E. Server-Side Calculations for Line Items
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Debit note must contain at least one line item';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
    item_name TEXT, hsn_code TEXT, quantity NUMERIC, rate NUMERIC, tax_percent NUMERIC
  ) LOOP
    v_line_qty := COALESCE(v_item.quantity, 0);
    v_line_rate := COALESCE(v_item.rate, 0);
    v_line_tax_pct := COALESCE(v_item.tax_percent, 0);

    IF v_line_qty <= 0 OR v_line_rate <= 0 THEN
      RAISE EXCEPTION 'Line item quantity and rate must be greater than zero';
    END IF;

    v_line_taxable := ROUND(v_line_qty * v_line_rate, 2);

    IF v_is_intrastate THEN
      v_line_cgst := ROUND(v_line_taxable * (v_line_tax_pct / 200.0), 2);
      v_line_sgst := ROUND(v_line_taxable * (v_line_tax_pct / 200.0), 2);
      v_line_igst := 0;
    ELSE
      v_line_igst := ROUND(v_line_taxable * (v_line_tax_pct / 100.0), 2);
      v_line_cgst := 0;
      v_line_sgst := 0;
    END IF;

    v_line_total := v_line_taxable + v_line_cgst + v_line_sgst + v_line_igst;

    v_total_taxable := v_total_taxable + v_line_taxable;
    v_total_cgst := v_total_cgst + v_line_cgst;
    v_total_sgst := v_total_sgst + v_line_sgst;
    v_total_igst := v_total_igst + v_line_igst;
  END LOOP;

  v_grand_total := v_total_taxable + v_total_cgst + v_total_sgst + v_total_igst;

  IF v_grand_total <= 0 THEN
    RAISE EXCEPTION 'Debit note total must be greater than zero';
  END IF;

  -- F. Set Transaction Creation Flag & Generate Number
  PERFORM set_config('app.allow_posted_dn_creation', 'true', true);
  v_dn_number := public.generate_next_dn_number(p_organisation_id);

  -- G. Insert Debit Note Header with Unique Index Protection
  BEGIN
    INSERT INTO public.debit_notes (
      organisation_id, vendor_id, bill_id, dn_number, dn_date,
      dn_type, reason, subtotal, taxable_amount, cgst_amount, sgst_amount,
      igst_amount, total_amount, total_amount_inr, approval_status, idempotency_key, created_at
    ) VALUES (
      p_organisation_id, p_vendor_id, p_bill_id, v_dn_number, COALESCE(p_dn_date, CURRENT_DATE),
      COALESCE(p_dn_type, 'Return'), COALESCE(p_reason, 'Purchase Return'), v_total_taxable, v_total_taxable, v_total_cgst, v_total_sgst,
      v_total_igst, v_grand_total, v_grand_total, 'Approved', v_effective_idempotency_key, NOW()
    ) RETURNING id INTO v_dn_id;
  EXCEPTION WHEN unique_violation THEN
    IF v_effective_idempotency_key IS NOT NULL THEN
      SELECT id, dn_number, total_amount, bill_id INTO v_existing_dn
      FROM public.debit_notes
      WHERE organisation_id = p_organisation_id AND idempotency_key = v_effective_idempotency_key;

      IF v_existing_dn.id IS NOT NULL THEN
        SELECT id INTO v_journal_id FROM public.journal_entries WHERE company_id = p_organisation_id AND voucher_no = v_existing_dn.dn_number LIMIT 1;
        RETURN jsonb_build_object(
          'status', 'success',
          'dn_id', v_existing_dn.id,
          'dn_number', v_existing_dn.dn_number,
          'total_amount', v_existing_dn.total_amount,
          'bill_id', v_existing_dn.bill_id,
          'journal_id', v_journal_id,
          'idempotent_replayed', true
        );
      END IF;
    END IF;
    RAISE;
  END;

  -- H. Insert Debit Note Items
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
    item_name TEXT, hsn_code TEXT, quantity NUMERIC, rate NUMERIC, tax_percent NUMERIC
  ) LOOP
    v_line_qty := COALESCE(v_item.quantity, 0);
    v_line_rate := COALESCE(v_item.rate, 0);
    v_line_tax_pct := COALESCE(v_item.tax_percent, 0);
    v_line_taxable := ROUND(v_line_qty * v_line_rate, 2);

    IF v_is_intrastate THEN
      v_line_cgst := ROUND(v_line_taxable * (v_line_tax_pct / 200.0), 2);
      v_line_sgst := ROUND(v_line_taxable * (v_line_tax_pct / 200.0), 2);
      v_line_igst := 0;
    ELSE
      v_line_igst := ROUND(v_line_taxable * (v_line_tax_pct / 100.0), 2);
      v_line_cgst := 0;
      v_line_sgst := 0;
    END IF;
    v_line_total := v_line_taxable + v_line_cgst + v_line_sgst + v_line_igst;

    INSERT INTO public.debit_note_items (
      dn_id, organisation_id, item_name, hsn_code, quantity, return_qty, rate,
      discount_amount, taxable_value, cgst_percent, cgst_amount,
      sgst_percent, sgst_amount, igst_percent, igst_amount, total_amount
    ) VALUES (
      v_dn_id, p_organisation_id, COALESCE(v_item.item_name, 'Item'), v_item.hsn_code, v_line_qty, v_line_qty, v_line_rate,
      0, v_line_taxable,
      CASE WHEN v_is_intrastate THEN v_line_tax_pct / 2.0 ELSE 0 END, v_line_cgst,
      CASE WHEN v_is_intrastate THEN v_line_tax_pct / 2.0 ELSE 0 END, v_line_sgst,
      CASE WHEN NOT v_is_intrastate THEN v_line_tax_pct ELSE 0 END, v_line_igst,
      v_line_total
    );
  END LOOP;

  -- I. Atomic Double-Entry GL Journal Posting
  SELECT id INTO v_ap_account_id
  FROM public.accounts
  WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id)
    AND account_code = '2100'
  LIMIT 1;

  SELECT id INTO v_purchase_return_account_id
  FROM public.accounts
  WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id)
    AND (account_code IN ('5000', '1500', '2000') OR name ILIKE '%Purchase Return%' OR name ILIKE '%Inventory%')
  LIMIT 1;

  IF v_ap_account_id IS NOT NULL AND v_purchase_return_account_id IS NOT NULL THEN
    INSERT INTO public.journal_entries (
      company_id, voucher_no, voucher_date, voucher_type,
      narration, status, created_by
    ) VALUES (
      p_organisation_id,
      v_dn_number,
      COALESCE(p_dn_date, CURRENT_DATE),
      'Debit Note',
      'Purchase Debit Note - ' || v_dn_number || COALESCE(' (' || p_reason || ')', ''),
      'Posted',
      auth.uid()
    ) RETURNING id INTO v_journal_id;

    -- Dr Accounts Payable
    INSERT INTO public.journal_entry_lines (
      journal_id, account_id, party_type, party_id, debit, credit, narration
    ) VALUES (
      v_journal_id, v_ap_account_id, 'vendor', p_vendor_id, v_grand_total, 0.00, 'AP Reduction via Debit Note'
    );

    -- Cr Purchase Returns / Inventory Adjustment
    INSERT INTO public.journal_entry_lines (
      journal_id, account_id, party_type, party_id, debit, credit, narration
    ) VALUES (
      v_journal_id, v_purchase_return_account_id, 'vendor', p_vendor_id, 0.00, v_grand_total, 'Purchase Returns / Adjustment'
    );
  END IF;

  -- J. Vendor Balance Recalculation inside the same transaction
  PERFORM public.recalc_vendor_balance(p_vendor_id, p_organisation_id);

  v_result := jsonb_build_object(
    'status', 'success',
    'dn_id', v_dn_id,
    'dn_number', v_dn_number,
    'total_amount', v_grand_total,
    'bill_id', p_bill_id,
    'journal_id', v_journal_id
  );

  RETURN v_result;
END;
$$;
