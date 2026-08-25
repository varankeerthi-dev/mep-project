-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration: 20260817000004_purchase_ap_security_hardening.sql
-- Description: Phase 4 Financial Security Hardening for Purchase Bills & Vendor Payments
--   1. Add idempotency_key columns and UNIQUE partial indexes
--   2. Convert global purchase_payments.voucher_no uniqueness to tenant-scoped
--   3. Document number generators for Purchase Bills and Payment Vouchers
--   4. Triggers blocking direct REST creation of approved/posted bills and payments
--   5. Immutability triggers on purchase_bills, purchase_bill_items, purchase_payments
--   6. RLS hardening replacing permissive USING (true) with strict user_can_access_org()
--   7. Authoritative recalc_vendor_balance() logic
--   8. Authoritative SECURITY DEFINER RPC record_purchase_bill()
--   9. Authoritative SECURITY DEFINER RPC record_vendor_payment()
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. IDEMPOTENCY KEYS & UNIQUE INDEXES
ALTER TABLE public.purchase_bills ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_bills_org_idempotency 
ON public.purchase_bills(organisation_id, idempotency_key) 
WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.purchase_payments ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_payments_org_idempotency 
ON public.purchase_payments(organisation_id, idempotency_key) 
WHERE idempotency_key IS NOT NULL;

-- 2. TENANT-SCOPED VOUCHER NUMBERING ON PAYMENTS
ALTER TABLE public.purchase_payments DROP CONSTRAINT IF EXISTS purchase_payments_voucher_no_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_payments_org_voucher 
ON public.purchase_payments(organisation_id, voucher_no);

-- 3. NUMBER GENERATORS
CREATE OR REPLACE FUNCTION public.generate_next_purchase_bill_number(p_org_id UUID)
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
  FROM public.purchase_bills
  WHERE organisation_id = p_org_id;

  v_next_no := 'BILL-' || TO_CHAR(CURRENT_DATE, 'YYYYMM') || '-' || LPAD(v_count::TEXT, 4, '0');
  RETURN v_next_no;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_next_payment_voucher_number(p_org_id UUID)
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
  FROM public.purchase_payments
  WHERE organisation_id = p_org_id;

  v_next_no := 'PV-' || TO_CHAR(CURRENT_DATE, 'YYYYMM') || '-' || LPAD(v_count::TEXT, 4, '0');
  RETURN v_next_no;
END;
$$;

-- 4. TRIGGERS BLOCKING DIRECT REST POSTED/APPROVED TRANSACTION CREATION
CREATE OR REPLACE FUNCTION public.fn_enforce_posted_purchase_bill_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.approval_status IN ('Approved', 'posted', 'Final') OR NEW.payment_status IN ('Paid', 'Partially Paid') THEN
    IF current_setting('app.allow_posted_purchase_bill_creation', true) IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'Direct creation of posted/approved purchase bills via REST is forbidden. Use record_purchase_bill() RPC.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_posted_purchase_bill_creation ON public.purchase_bills;
CREATE TRIGGER trg_enforce_posted_purchase_bill_creation
  BEFORE INSERT ON public.purchase_bills
  FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_posted_purchase_bill_creation();

CREATE OR REPLACE FUNCTION public.fn_enforce_posted_purchase_payment_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.approval_status IN ('Approved', 'Released', 'posted', 'Final') OR NEW.workflow_step IN ('approved', 'released') THEN
    IF current_setting('app.allow_posted_purchase_payment_creation', true) IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'Direct creation of posted/released vendor payments via REST is forbidden. Use record_vendor_payment() RPC.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_posted_purchase_payment_creation ON public.purchase_payments;
CREATE TRIGGER trg_enforce_posted_purchase_payment_creation
  BEFORE INSERT ON public.purchase_payments
  FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_posted_purchase_payment_creation();

-- 5. IMMUTABILITY TRIGGERS
CREATE OR REPLACE FUNCTION public.fn_prevent_posted_purchase_bill_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.approval_status IN ('Approved', 'posted', 'Final') OR OLD.payment_status IN ('Paid', 'Partially Paid') THEN
      RAISE EXCEPTION 'Cannot delete an approved or posted purchase bill (ID: %)', OLD.id;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.approval_status IN ('Approved', 'posted', 'Final') THEN
      IF NEW.total_amount IS DISTINCT FROM OLD.total_amount OR
         NEW.taxable_amount IS DISTINCT FROM OLD.taxable_amount OR
         NEW.cgst_amount IS DISTINCT FROM OLD.cgst_amount OR
         NEW.sgst_amount IS DISTINCT FROM OLD.sgst_amount OR
         NEW.igst_amount IS DISTINCT FROM OLD.igst_amount OR
         NEW.subtotal IS DISTINCT FROM OLD.subtotal OR
         NEW.vendor_id IS DISTINCT FROM OLD.vendor_id OR
         NEW.organisation_id IS DISTINCT FROM OLD.organisation_id OR
         NEW.bill_number IS DISTINCT FROM OLD.bill_number OR
         NEW.po_id IS DISTINCT FROM OLD.po_id THEN
        RAISE EXCEPTION 'Cannot modify financial or relationship fields of an approved purchase bill';
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_posted_purchase_bill_mutation ON public.purchase_bills;
CREATE TRIGGER trg_prevent_posted_purchase_bill_mutation
  BEFORE UPDATE OR DELETE ON public.purchase_bills
  FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_posted_purchase_bill_mutation();

CREATE OR REPLACE FUNCTION public.fn_prevent_posted_purchase_bill_item_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bill_status TEXT;
  v_bill_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_bill_id := OLD.bill_id;
  ELSE
    v_bill_id := NEW.bill_id;
  END IF;

  SELECT approval_status INTO v_bill_status
  FROM public.purchase_bills
  WHERE id = v_bill_id;

  IF v_bill_status IN ('Approved', 'posted', 'Final') THEN
    IF current_setting('app.allow_posted_purchase_bill_creation', true) IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'Cannot insert, modify or delete line items of an approved purchase bill';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_posted_purchase_bill_item_mutation ON public.purchase_bill_items;
CREATE TRIGGER trg_prevent_posted_purchase_bill_item_mutation
  BEFORE INSERT OR UPDATE OR DELETE ON public.purchase_bill_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_posted_purchase_bill_item_mutation();

CREATE OR REPLACE FUNCTION public.fn_prevent_posted_purchase_payment_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.approval_status IN ('Approved', 'Released', 'posted', 'Final') OR OLD.workflow_step IN ('approved', 'released') THEN
      RAISE EXCEPTION 'Cannot delete an approved/released vendor payment (ID: %)', OLD.id;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.approval_status IN ('Approved', 'Released') OR OLD.workflow_step IN ('approved', 'released') THEN
      IF NEW.amount IS DISTINCT FROM OLD.amount OR
         NEW.net_amount IS DISTINCT FROM OLD.net_amount OR
         NEW.vendor_id IS DISTINCT FROM OLD.vendor_id OR
         NEW.organisation_id IS DISTINCT FROM OLD.organisation_id OR
         NEW.voucher_no IS DISTINCT FROM OLD.voucher_no THEN
        RAISE EXCEPTION 'Cannot modify financial or recipient fields of an approved/released vendor payment';
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_posted_purchase_payment_mutation ON public.purchase_payments;
CREATE TRIGGER trg_prevent_posted_purchase_payment_mutation
  BEFORE UPDATE OR DELETE ON public.purchase_payments
  FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_posted_purchase_payment_mutation();

-- 6. STRICT RLS POLICIES (REPLACE PERMISSIVE USING (true))
DROP POLICY IF EXISTS "Enable all access" ON public.purchase_bills;
DROP POLICY IF EXISTS "purchase_bills_all_access" ON public.purchase_bills;
DROP POLICY IF EXISTS "purchase_bills_tenant_isolation" ON public.purchase_bills;
CREATE POLICY purchase_bills_tenant_isolation ON public.purchase_bills
  FOR ALL TO authenticated
  USING (public.user_can_access_org(organisation_id))
  WITH CHECK (public.user_can_access_org(organisation_id));

DROP POLICY IF EXISTS "Enable all access" ON public.purchase_bill_items;
DROP POLICY IF EXISTS "purchase_bill_items_all_access" ON public.purchase_bill_items;
DROP POLICY IF EXISTS "purchase_bill_items_tenant_isolation" ON public.purchase_bill_items;
CREATE POLICY purchase_bill_items_tenant_isolation ON public.purchase_bill_items
  FOR ALL TO authenticated
  USING (public.user_can_access_org(organisation_id))
  WITH CHECK (public.user_can_access_org(organisation_id));

DROP POLICY IF EXISTS "Enable all access" ON public.purchase_vendors;
DROP POLICY IF EXISTS "purchase_vendors_all_access" ON public.purchase_vendors;
DROP POLICY IF EXISTS "purchase_vendors_tenant_isolation" ON public.purchase_vendors;
CREATE POLICY purchase_vendors_tenant_isolation ON public.purchase_vendors
  FOR ALL TO authenticated
  USING (public.user_can_access_org(organisation_id))
  WITH CHECK (public.user_can_access_org(organisation_id));

DROP POLICY IF EXISTS "Enable all access" ON public.purchase_payments;
DROP POLICY IF EXISTS "purchase_payments_all_access" ON public.purchase_payments;
DROP POLICY IF EXISTS "purchase_payments_tenant_isolation" ON public.purchase_payments;
CREATE POLICY purchase_payments_tenant_isolation ON public.purchase_payments
  FOR ALL TO authenticated
  USING (public.user_can_access_org(organisation_id))
  WITH CHECK (public.user_can_access_org(organisation_id));

DROP POLICY IF EXISTS "Enable all access" ON public.purchase_payment_bills;
DROP POLICY IF EXISTS "purchase_payment_bills_all_access" ON public.purchase_payment_bills;
DROP POLICY IF EXISTS "purchase_payment_bills_tenant_isolation" ON public.purchase_payment_bills;
CREATE POLICY purchase_payment_bills_tenant_isolation ON public.purchase_payment_bills
  FOR ALL TO authenticated
  USING (public.user_can_access_org(organisation_id))
  WITH CHECK (public.user_can_access_org(organisation_id));

DROP POLICY IF EXISTS "Enable all access" ON public.payment_requests;
DROP POLICY IF EXISTS "payment_requests_all_access" ON public.payment_requests;
DROP POLICY IF EXISTS "payment_requests_tenant_isolation" ON public.payment_requests;
CREATE POLICY payment_requests_tenant_isolation ON public.payment_requests
  FOR ALL TO authenticated
  USING (public.user_can_access_org(organisation_id))
  WITH CHECK (public.user_can_access_org(organisation_id));

-- 7. AUTHORITATIVE VENDOR BALANCE RECALCULATION
CREATE OR REPLACE FUNCTION public.recalc_vendor_balance(p_vendor_id UUID, p_organisation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_bills NUMERIC(15,2) := 0;
  v_total_debits NUMERIC(15,2) := 0;
  v_total_paid NUMERIC(15,2) := 0;
  v_balance NUMERIC(15,2) := 0;
BEGIN
  -- Sum bills
  SELECT COALESCE(SUM(total_amount), 0) INTO v_total_bills
  FROM public.purchase_bills
  WHERE vendor_id = p_vendor_id AND organisation_id = p_organisation_id
    AND approval_status IN ('Approved', 'posted', 'Final');

  -- Sum debit notes
  SELECT COALESCE(SUM(total_amount), 0) INTO v_total_debits
  FROM public.debit_notes
  WHERE vendor_id = p_vendor_id AND organisation_id = p_organisation_id
    AND approval_status IN ('Approved', 'posted', 'Final');

  -- Sum payments
  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
  FROM public.purchase_payments
  WHERE vendor_id = p_vendor_id AND organisation_id = p_organisation_id
    AND (workflow_step = 'released' OR approval_status IN ('Approved', 'Released', 'posted', 'Final'))
    AND is_deleted = false;

  v_balance := v_total_bills - v_total_debits - v_total_paid;
  RETURN;
END;
$$;

-- 8. AUTHORITATIVE PURCHASE BILL TRANSACTION RPC
CREATE OR REPLACE FUNCTION public.record_purchase_bill(
  p_organisation_id UUID,
  p_vendor_id UUID,
  p_po_id UUID DEFAULT NULL,
  p_bill_number TEXT DEFAULT NULL,
  p_vendor_invoice_no TEXT DEFAULT NULL,
  p_bill_date DATE DEFAULT CURRENT_DATE,
  p_due_date DATE DEFAULT NULL,
  p_currency TEXT DEFAULT 'INR',
  p_exchange_rate NUMERIC DEFAULT 1.0,
  p_warehouse_id UUID DEFAULT NULL,
  p_project_site_id UUID DEFAULT NULL,
  p_direct_supply_to_site BOOLEAN DEFAULT FALSE,
  p_site_address TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_items JSONB DEFAULT '[]'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor RECORD;
  v_po RECORD;
  v_existing_bill RECORD;
  v_effective_idempotency_key TEXT;
  v_bill_id UUID;
  v_bill_number TEXT;
  v_item RECORD;
  v_line_qty NUMERIC(15,3);
  v_line_rate NUMERIC(15,2);
  v_line_discount NUMERIC(15,2);
  v_line_tax_pct NUMERIC(5,2);
  v_line_taxable NUMERIC(15,2);
  v_line_cgst NUMERIC(15,2) := 0;
  v_line_sgst NUMERIC(15,2) := 0;
  v_line_igst NUMERIC(15,2) := 0;
  v_line_total NUMERIC(15,2);

  v_subtotal NUMERIC(15,2) := 0;
  v_total_discount NUMERIC(15,2) := 0;
  v_total_taxable NUMERIC(15,2) := 0;
  v_total_cgst NUMERIC(15,2) := 0;
  v_total_sgst NUMERIC(15,2) := 0;
  v_total_igst NUMERIC(15,2) := 0;
  v_grand_total NUMERIC(15,2) := 0;
  v_grand_total_inr NUMERIC(15,2) := 0;

  v_is_intrastate BOOLEAN := TRUE;
  v_org_state TEXT;
  v_vendor_state TEXT;

  v_purchase_account_id UUID;
  v_ap_account_id UUID;
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
  WHERE id = p_vendor_id AND organisation_id = p_organisation_id;

  IF v_vendor IS NULL THEN
    RAISE EXCEPTION 'Vendor not found or does not belong to organization';
  END IF;

  -- Validate PO if provided
  IF p_po_id IS NOT NULL THEN
    SELECT * INTO v_po
    FROM public.purchase_orders
    WHERE id = p_po_id AND organisation_id = p_organisation_id;

    IF v_po IS NULL THEN
      RAISE EXCEPTION 'Purchase order not found or does not belong to organization';
    END IF;

    IF v_po.vendor_id != p_vendor_id THEN
      RAISE EXCEPTION 'Purchase order belongs to a different vendor than the supplied vendor';
    END IF;
  END IF;

  -- Determine effective idempotency key
  v_effective_idempotency_key := TRIM(p_idempotency_key);
  IF v_effective_idempotency_key = '' THEN
    v_effective_idempotency_key := NULL;
  END IF;

  -- B. Pre-check Idempotency
  IF v_effective_idempotency_key IS NOT NULL THEN
    SELECT id, bill_number, total_amount INTO v_existing_bill
    FROM public.purchase_bills
    WHERE organisation_id = p_organisation_id
      AND idempotency_key = v_effective_idempotency_key
      AND approval_status IN ('Approved', 'posted', 'Final')
    LIMIT 1;

    IF v_existing_bill.id IS NOT NULL THEN
      SELECT id INTO v_journal_id
      FROM public.journal_entries
      WHERE company_id = p_organisation_id AND voucher_no = v_existing_bill.bill_number
      LIMIT 1;

      RETURN jsonb_build_object(
        'status', 'success',
        'bill_id', v_existing_bill.id,
        'bill_number', v_existing_bill.bill_number,
        'total_amount', v_existing_bill.total_amount,
        'journal_id', v_journal_id,
        'idempotent_replayed', true
      );
    END IF;
  END IF;

  -- C. State Jurisdiction for GST Breakdown
  SELECT state INTO v_org_state FROM public.organisations WHERE id = p_organisation_id;
  v_vendor_state := v_vendor.state;
  IF v_org_state IS NOT NULL AND v_vendor_state IS NOT NULL AND LOWER(TRIM(v_org_state)) != LOWER(TRIM(v_vendor_state)) THEN
    v_is_intrastate := FALSE;
  END IF;

  -- D. Server-Side Calculation of Line Items
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Purchase bill must contain at least one line item';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
    item_name TEXT, batch_no TEXT, quantity NUMERIC, unit TEXT, rate NUMERIC, discount_amount NUMERIC, tax_percent NUMERIC
  ) LOOP
    v_line_qty := COALESCE(v_item.quantity, 0);
    v_line_rate := COALESCE(v_item.rate, 0);
    v_line_discount := COALESCE(v_item.discount_amount, 0);
    v_line_tax_pct := COALESCE(v_item.tax_percent, 0);

    IF v_line_qty <= 0 OR v_line_rate <= 0 THEN
      RAISE EXCEPTION 'Line item quantity and rate must be greater than zero';
    END IF;

    v_line_taxable := ROUND((v_line_qty * v_line_rate) - v_line_discount, 2);
    IF v_line_taxable < 0 THEN
      RAISE EXCEPTION 'Line item discount cannot exceed gross amount';
    END IF;

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

    v_subtotal := v_subtotal + ROUND(v_line_qty * v_line_rate, 2);
    v_total_discount := v_total_discount + v_line_discount;
    v_total_taxable := v_total_taxable + v_line_taxable;
    v_total_cgst := v_total_cgst + v_line_cgst;
    v_total_sgst := v_total_sgst + v_line_sgst;
    v_total_igst := v_total_igst + v_line_igst;
  END LOOP;

  v_grand_total := v_total_taxable + v_total_cgst + v_total_sgst + v_total_igst;
  v_grand_total_inr := ROUND(v_grand_total * COALESCE(p_exchange_rate, 1.0), 2);

  IF v_grand_total <= 0 THEN
    RAISE EXCEPTION 'Purchase bill total must be greater than zero';
  END IF;

  -- E. Set Transaction Creation Flag & Generate Number
  PERFORM set_config('app.allow_posted_purchase_bill_creation', 'true', true);
  v_bill_number := COALESCE(NULLIF(TRIM(p_bill_number), ''), public.generate_next_purchase_bill_number(p_organisation_id));

  -- F. Insert Purchase Bill Header with Race-Safe Unique Violation Handling
  BEGIN
    INSERT INTO public.purchase_bills (
      organisation_id, vendor_id, po_id, bill_number, vendor_invoice_no,
      bill_date, due_date, currency, exchange_rate, warehouse_id, project_site_id,
      direct_supply_to_site, site_address, subtotal, discount_amount, taxable_amount,
      cgst_amount, sgst_amount, igst_amount, total_amount, total_amount_inr,
      net_amount, approval_status, payment_status, paid_amount, balance_amount,
      idempotency_key, created_at
    ) VALUES (
      p_organisation_id, p_vendor_id, p_po_id, v_bill_number, p_vendor_invoice_no,
      COALESCE(p_bill_date, CURRENT_DATE), p_due_date, COALESCE(p_currency, 'INR'), COALESCE(p_exchange_rate, 1.0),
      p_warehouse_id, p_project_site_id, COALESCE(p_direct_supply_to_site, false), p_site_address,
      v_subtotal, v_total_discount, v_total_taxable, v_total_cgst, v_total_sgst, v_total_igst,
      v_grand_total, v_grand_total_inr, v_grand_total, 'Approved', 'Unpaid', 0.00, v_grand_total,
      v_effective_idempotency_key, NOW()
    ) RETURNING id INTO v_bill_id;
  EXCEPTION WHEN unique_violation THEN
    IF v_effective_idempotency_key IS NOT NULL THEN
      SELECT id, bill_number, total_amount INTO v_existing_bill
      FROM public.purchase_bills
      WHERE organisation_id = p_organisation_id AND idempotency_key = v_effective_idempotency_key;

      IF v_existing_bill.id IS NOT NULL THEN
        SELECT id INTO v_journal_id FROM public.journal_entries WHERE company_id = p_organisation_id AND voucher_no = v_existing_bill.bill_number LIMIT 1;
        RETURN jsonb_build_object(
          'status', 'success',
          'bill_id', v_existing_bill.id,
          'bill_number', v_existing_bill.bill_number,
          'total_amount', v_existing_bill.total_amount,
          'journal_id', v_journal_id,
          'idempotent_replayed', true
        );
      END IF;
    END IF;
    RAISE;
  END;

  -- G. Insert Purchase Bill Items
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
    item_name TEXT, batch_no TEXT, quantity NUMERIC, unit TEXT, rate NUMERIC, discount_amount NUMERIC, tax_percent NUMERIC
  ) LOOP
    v_line_qty := COALESCE(v_item.quantity, 0);
    v_line_rate := COALESCE(v_item.rate, 0);
    v_line_discount := COALESCE(v_item.discount_amount, 0);
    v_line_tax_pct := COALESCE(v_item.tax_percent, 0);
    v_line_taxable := ROUND((v_line_qty * v_line_rate) - v_line_discount, 2);

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

    INSERT INTO public.purchase_bill_items (
      bill_id, organisation_id, item_name, batch_no, quantity, unit,
      rate, discount_amount, taxable_value, cgst_percent, cgst_amount,
      sgst_percent, sgst_amount, igst_percent, igst_amount, total_amount
    ) VALUES (
      v_bill_id, p_organisation_id, COALESCE(v_item.item_name, 'Item'), v_item.batch_no, v_line_qty, COALESCE(v_item.unit, 'Nos'),
      v_line_rate, v_line_discount, v_line_taxable,
      CASE WHEN v_is_intrastate THEN v_line_tax_pct / 2.0 ELSE 0 END, v_line_cgst,
      CASE WHEN v_is_intrastate THEN v_line_tax_pct / 2.0 ELSE 0 END, v_line_sgst,
      CASE WHEN NOT v_is_intrastate THEN v_line_tax_pct ELSE 0 END, v_line_igst,
      v_line_total
    );
  END LOOP;

  -- Clear creation flag immediately after inserts
  PERFORM set_config('app.allow_posted_purchase_bill_creation', 'false', true);

  -- H. Atomic Balanced GL Journal Posting
  SELECT id INTO v_purchase_account_id
  FROM public.accounts
  WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id)
    AND (account_code IN ('4100', '4101', '4000') OR name ILIKE '%Purchase%' OR name ILIKE '%Direct Expense%')
  LIMIT 1;

  SELECT id INTO v_ap_account_id
  FROM public.accounts
  WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id)
    AND account_code = '2100'
  LIMIT 1;

  IF v_purchase_account_id IS NOT NULL AND v_ap_account_id IS NOT NULL THEN
    INSERT INTO public.journal_entries (
      company_id, voucher_no, voucher_date, voucher_type,
      narration, status, created_by
    ) VALUES (
      p_organisation_id,
      v_bill_number,
      COALESCE(p_bill_date, CURRENT_DATE),
      'Purchase',
      'Purchase Bill - ' || v_bill_number || COALESCE(' (' || v_vendor.company_name || ')', ''),
      'Posted',
      auth.uid()
    ) RETURNING id INTO v_journal_id;

    -- Dr Purchase Account (Expense/Inventory)
    INSERT INTO public.journal_entry_lines (
      journal_id, account_id, party_type, party_id, debit, credit, narration
    ) VALUES (
      v_journal_id, v_purchase_account_id, 'vendor', p_vendor_id, v_grand_total, 0.00, 'Purchase Expense / Inward Supply'
    );

    -- Cr Accounts Payable (Sundry Creditors)
    INSERT INTO public.journal_entry_lines (
      journal_id, account_id, party_type, party_id, debit, credit, narration
    ) VALUES (
      v_journal_id, v_ap_account_id, 'vendor', p_vendor_id, 0.00, v_grand_total, 'Accounts Payable Accrual'
    );
  END IF;

  -- I. Recalculate Vendor Balance Inside Transaction
  PERFORM public.recalc_vendor_balance(p_vendor_id, p_organisation_id);

  v_result := jsonb_build_object(
    'status', 'success',
    'bill_id', v_bill_id,
    'bill_number', v_bill_number,
    'total_amount', v_grand_total,
    'journal_id', v_journal_id
  );

  RETURN v_result;
END;
$$;

-- 9. AUTHORITATIVE VENDOR PAYMENT TRANSACTION RPC
CREATE OR REPLACE FUNCTION public.record_vendor_payment(
  p_organisation_id UUID,
  p_vendor_id UUID,
  p_amount NUMERIC,
  p_payment_date DATE DEFAULT CURRENT_DATE,
  p_payment_mode TEXT DEFAULT 'Bank Transfer',
  p_reference_no TEXT DEFAULT NULL,
  p_narration TEXT DEFAULT NULL,
  p_is_advance BOOLEAN DEFAULT FALSE,
  p_idempotency_key TEXT DEFAULT NULL,
  p_bill_allocations JSONB DEFAULT '[]'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor RECORD;
  v_existing_payment RECORD;
  v_effective_idempotency_key TEXT;
  v_payment_id UUID;
  v_voucher_no TEXT;
  v_alloc RECORD;
  v_bill RECORD;
  v_alloc_amount NUMERIC(15,2);
  v_total_allocated NUMERIC(15,2) := 0;
  v_remaining_balance NUMERIC(15,2);
  v_new_paid NUMERIC(15,2);
  v_new_balance NUMERIC(15,2);
  v_new_status TEXT;

  v_bank_account_id UUID;
  v_ap_account_id UUID;
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

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;

  -- Validate vendor belongs to organization
  SELECT * INTO v_vendor
  FROM public.purchase_vendors
  WHERE id = p_vendor_id AND organisation_id = p_organisation_id;

  IF v_vendor IS NULL THEN
    RAISE EXCEPTION 'Vendor not found or does not belong to organization';
  END IF;

  -- Determine effective idempotency key
  v_effective_idempotency_key := COALESCE(NULLIF(TRIM(p_idempotency_key), ''), NULLIF(TRIM(p_reference_no), ''));

  -- B. Pre-check Idempotency
  IF v_effective_idempotency_key IS NOT NULL THEN
    SELECT id, voucher_no, amount INTO v_existing_payment
    FROM public.purchase_payments
    WHERE organisation_id = p_organisation_id
      AND idempotency_key = v_effective_idempotency_key
      AND (workflow_step = 'released' OR approval_status IN ('Approved', 'Released', 'posted', 'Final'))
    LIMIT 1;

    IF v_existing_payment.id IS NOT NULL THEN
      SELECT id INTO v_journal_id
      FROM public.journal_entries
      WHERE company_id = p_organisation_id AND voucher_no = v_existing_payment.voucher_no
      LIMIT 1;

      RETURN jsonb_build_object(
        'status', 'success',
        'payment_id', v_existing_payment.id,
        'voucher_no', v_existing_payment.voucher_no,
        'amount', v_existing_payment.amount,
        'journal_id', v_journal_id,
        'idempotent_replayed', true
      );
    END IF;
  END IF;

  -- C. Validate Allocations and Lock Bills FOR UPDATE
  IF jsonb_array_length(p_bill_allocations) > 0 THEN
    FOR v_alloc IN SELECT * FROM jsonb_to_recordset(p_bill_allocations) AS x(
      bill_id UUID, adjusted_amount NUMERIC
    ) LOOP
      v_alloc_amount := COALESCE(v_alloc.adjusted_amount, 0);
      IF v_alloc_amount <= 0 THEN
        RAISE EXCEPTION 'Bill allocation amount must be greater than zero';
      END IF;

      -- Lock bill
      SELECT * INTO v_bill
      FROM public.purchase_bills
      WHERE id = v_alloc.bill_id AND organisation_id = p_organisation_id
      FOR UPDATE;

      IF v_bill IS NULL THEN
        RAISE EXCEPTION 'Purchase bill % not found in this organization', v_alloc.bill_id;
      END IF;

      IF v_bill.vendor_id != p_vendor_id THEN
        RAISE EXCEPTION 'Purchase bill % belongs to a different vendor', v_bill.bill_number;
      END IF;

      v_remaining_balance := ROUND(v_bill.total_amount - COALESCE(v_bill.paid_amount, 0), 2);
      IF v_alloc_amount > v_remaining_balance THEN
        RAISE EXCEPTION 'Allocation amount (₹%) exceeds bill % remaining balance (₹%)', v_alloc_amount, v_bill.bill_number, v_remaining_balance;
      END IF;

      v_total_allocated := v_total_allocated + v_alloc_amount;
    END LOOP;

    IF v_total_allocated > p_amount THEN
      RAISE EXCEPTION 'Total allocated amount (₹%) cannot exceed total payment amount (₹%)', v_total_allocated, p_amount;
    END IF;
  END IF;

  -- D. Set Transaction Creation Flag & Generate Voucher Number
  PERFORM set_config('app.allow_posted_purchase_payment_creation', 'true', true);
  v_voucher_no := public.generate_next_payment_voucher_number(p_organisation_id);

  -- E. Insert Payment Record with Race-Safe Unique Violation Handling
  BEGIN
    INSERT INTO public.purchase_payments (
      organisation_id, vendor_id, voucher_no, payment_date, amount,
      net_amount, reference_no, narration, is_advance, advance_remaining,
      payment_mode, workflow_step, approval_status, approved_by, approved_at,
      released_by, released_at, released_amount, idempotency_key, created_at
    ) VALUES (
      p_organisation_id, p_vendor_id, v_voucher_no, COALESCE(p_payment_date, CURRENT_DATE), p_amount,
      p_amount, p_reference_no, p_narration, COALESCE(p_is_advance, false),
      CASE WHEN p_is_advance THEN p_amount - v_total_allocated ELSE 0 END,
      COALESCE(p_payment_mode, 'Bank Transfer'), 'released', 'Released', auth.uid(), NOW(),
      auth.uid(), NOW(), p_amount, v_effective_idempotency_key, NOW()
    ) RETURNING id INTO v_payment_id;
  EXCEPTION WHEN unique_violation THEN
    IF v_effective_idempotency_key IS NOT NULL THEN
      SELECT id, voucher_no, amount INTO v_existing_payment
      FROM public.purchase_payments
      WHERE organisation_id = p_organisation_id AND idempotency_key = v_effective_idempotency_key;

      IF v_existing_payment.id IS NOT NULL THEN
        SELECT id INTO v_journal_id FROM public.journal_entries WHERE company_id = p_organisation_id AND voucher_no = v_existing_payment.voucher_no LIMIT 1;
        RETURN jsonb_build_object(
          'status', 'success',
          'payment_id', v_existing_payment.id,
          'voucher_no', v_existing_payment.voucher_no,
          'amount', v_existing_payment.amount,
          'journal_id', v_journal_id,
          'idempotent_replayed', true
        );
      END IF;
    END IF;
    RAISE;
  END;

  -- F. Insert Allocations & Update Bill Balances
  IF jsonb_array_length(p_bill_allocations) > 0 THEN
    FOR v_alloc IN SELECT * FROM jsonb_to_recordset(p_bill_allocations) AS x(
      bill_id UUID, adjusted_amount NUMERIC
    ) LOOP
      v_alloc_amount := COALESCE(v_alloc.adjusted_amount, 0);

      INSERT INTO public.purchase_payment_bills (
        organisation_id, payment_id, bill_id, adjusted_amount
      ) VALUES (
        p_organisation_id, v_payment_id, v_alloc.bill_id, v_alloc_amount
      );

      SELECT * INTO v_bill FROM public.purchase_bills WHERE id = v_alloc.bill_id;
      v_new_paid := COALESCE(v_bill.paid_amount, 0) + v_alloc_amount;
      v_new_balance := GREATEST(0, v_bill.total_amount - v_new_paid);
      
      IF v_new_balance = 0 THEN
        v_new_status := 'Paid';
      ELSE
        v_new_status := 'Partially Paid';
      END IF;

      UPDATE public.purchase_bills
      SET paid_amount = v_new_paid,
          balance_amount = v_new_balance,
          payment_status = v_new_status,
          updated_at = NOW()
      WHERE id = v_alloc.bill_id;
    END LOOP;
  END IF;

  -- Clear creation flag immediately after inserts
  PERFORM set_config('app.allow_posted_purchase_payment_creation', 'false', true);

  -- G. Atomic Double-Entry GL Posting (Dr Accounts Payable 2100, Cr Bank 1200 / Cash 1300)
  SELECT id INTO v_ap_account_id
  FROM public.accounts
  WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id)
    AND account_code = '2100'
  LIMIT 1;

  IF LOWER(TRIM(COALESCE(p_payment_mode, ''))) = 'cash' THEN
    SELECT id INTO v_bank_account_id
    FROM public.accounts
    WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id)
      AND account_code = '1300'
    LIMIT 1;
  ELSE
    SELECT id INTO v_bank_account_id
    FROM public.accounts
    WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id)
      AND account_code = '1200'
    LIMIT 1;
  END IF;

  IF v_ap_account_id IS NOT NULL AND v_bank_account_id IS NOT NULL THEN
    INSERT INTO public.journal_entries (
      company_id, voucher_no, voucher_date, voucher_type,
      narration, status, created_by
    ) VALUES (
      p_organisation_id,
      v_voucher_no,
      COALESCE(p_payment_date, CURRENT_DATE),
      'Payment',
      'Vendor Payment - ' || v_voucher_no || COALESCE(' (' || v_vendor.company_name || ')', ''),
      'Posted',
      auth.uid()
    ) RETURNING id INTO v_journal_id;

    -- Dr Accounts Payable
    INSERT INTO public.journal_entry_lines (
      journal_id, account_id, party_type, party_id, debit, credit, narration
    ) VALUES (
      v_journal_id, v_ap_account_id, 'vendor', p_vendor_id, p_amount, 0.00, 'Accounts Payable Settlement'
    );

    -- Cr Bank/Cash Account
    INSERT INTO public.journal_entry_lines (
      journal_id, account_id, party_type, party_id, debit, credit, narration
    ) VALUES (
      v_journal_id, v_bank_account_id, 'vendor', p_vendor_id, 0.00, p_amount, 'Bank/Cash Disbursement'
    );
  END IF;

  -- H. Recalculate Vendor Balance Inside Transaction
  PERFORM public.recalc_vendor_balance(p_vendor_id, p_organisation_id);

  v_result := jsonb_build_object(
    'status', 'success',
    'payment_id', v_payment_id,
    'voucher_no', v_voucher_no,
    'amount', p_amount,
    'journal_id', v_journal_id
  );

  RETURN v_result;
END;
$$;
