-- Phase 5B Database Migration: Zero-Trust Financial Security Hardening
-- Target: Quotations, Proforma Invoices, Subcontractors (Work Orders, Bills, Payments, Retentions, TDS)

-- ═══════════════════════════════════════════════════════════════════════
-- 1. IDEMPOTENCY COLUMNS & TENANT-SCOPED INDEXES
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.quotation_header ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE public.subcontractor_work_orders ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE public.subcontractor_invoices ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE public.subcontractor_payments ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE public.subcontractor_retention ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE public.subcontractor_retention ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.subcontractor_tds_payments ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_quotation_header_org_idempotency 
  ON public.quotation_header (organisation_id, idempotency_key) 
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_proforma_invoices_org_idempotency 
  ON public.proforma_invoices (organisation_id, idempotency_key) 
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subcontractor_work_orders_org_idempotency 
  ON public.subcontractor_work_orders (organisation_id, idempotency_key) 
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subcontractor_invoices_org_idempotency 
  ON public.subcontractor_invoices (organisation_id, idempotency_key) 
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subcontractor_payments_org_idempotency 
  ON public.subcontractor_payments (organisation_id, idempotency_key) 
  WHERE idempotency_key IS NOT NULL;

-- Drop global unique constraints if present and create tenant-scoped unique indexes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quotation_header_quotation_no_key') THEN
    ALTER TABLE public.quotation_header DROP CONSTRAINT quotation_header_quotation_no_key;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subcontractor_work_orders_work_order_no_key') THEN
    ALTER TABLE public.subcontractor_work_orders DROP CONSTRAINT subcontractor_work_orders_work_order_no_key;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subcontractors_sub_number_key') THEN
    ALTER TABLE public.subcontractors DROP CONSTRAINT subcontractors_sub_number_key;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_quotation_header_org_quotation_no 
  ON public.quotation_header (organisation_id, quotation_no) 
  WHERE quotation_no IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_proforma_invoices_org_pi_number 
  ON public.proforma_invoices (organisation_id, pi_number) 
  WHERE pi_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subcontractor_work_orders_org_wo_no 
  ON public.subcontractor_work_orders (organisation_id, work_order_no) 
  WHERE work_order_no IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subcontractors_org_sub_number 
  ON public.subcontractors (organisation_id, sub_number) 
  WHERE sub_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subcontractor_invoices_org_invoice_no 
  ON public.subcontractor_invoices (organisation_id, invoice_no) 
  WHERE invoice_no IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════
-- 2. TENANT-SCOPED NUMBERING GENERATORS
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.generate_next_quotation_number(p_org_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INT;
  v_year TEXT;
  v_next_no TEXT;
BEGIN
  v_year := to_char(CURRENT_DATE, 'YY');
  SELECT COALESCE(MAX(
    CASE 
      WHEN quotation_no ~ ('^QT-' || v_year || '-[0-9]+$') 
      THEN (regexp_match(quotation_no, '^QT-' || v_year || '-([0-9]+)$'))[1]::INT
      ELSE 0
    END
  ), 0) + 1 INTO v_count
  FROM public.quotation_header
  WHERE organisation_id = p_org_id;

  v_next_no := 'QT-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');
  RETURN v_next_no;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_next_proforma_number_v2(p_org_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INT;
  v_year TEXT;
  v_next_no TEXT;
BEGIN
  v_year := to_char(CURRENT_DATE, 'YY');
  SELECT COALESCE(MAX(
    CASE 
      WHEN pi_number ~ ('^PI-' || v_year || '-[0-9]+$') 
      THEN (regexp_match(pi_number, '^PI-' || v_year || '-([0-9]+)$'))[1]::INT
      ELSE 0
    END
  ), 0) + 1 INTO v_count
  FROM public.proforma_invoices
  WHERE organisation_id = p_org_id;

  v_next_no := 'PI-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');
  RETURN v_next_no;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_next_work_order_number(p_org_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INT;
  v_year TEXT;
  v_next_no TEXT;
BEGIN
  v_year := to_char(CURRENT_DATE, 'YY');
  SELECT COALESCE(MAX(
    CASE 
      WHEN work_order_no ~ ('^WO-' || v_year || '-[0-9]+$') 
      THEN (regexp_match(work_order_no, '^WO-' || v_year || '-([0-9]+)$'))[1]::INT
      ELSE 0
    END
  ), 0) + 1 INTO v_count
  FROM public.subcontractor_work_orders
  WHERE organisation_id = p_org_id;

  v_next_no := 'WO-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');
  RETURN v_next_no;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_next_subcontractor_bill_number(p_org_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INT;
  v_year TEXT;
  v_next_no TEXT;
BEGIN
  v_year := to_char(CURRENT_DATE, 'YY');
  SELECT COALESCE(MAX(
    CASE 
      WHEN invoice_no ~ ('^SUB-BILL-' || v_year || '-[0-9]+$') 
      THEN (regexp_match(invoice_no, '^SUB-BILL-' || v_year || '-([0-9]+)$'))[1]::INT
      ELSE 0
    END
  ), 0) + 1 INTO v_count
  FROM public.subcontractor_invoices
  WHERE organisation_id = p_org_id;

  v_next_no := 'SUB-BILL-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');
  RETURN v_next_no;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_next_subcontractor_payment_number(p_org_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INT;
  v_year TEXT;
  v_next_no TEXT;
BEGIN
  v_year := to_char(CURRENT_DATE, 'YY');
  SELECT COALESCE(MAX(
    CASE 
      WHEN reference_no ~ ('^SUB-PAY-' || v_year || '-[0-9]+$') 
      THEN (regexp_match(reference_no, '^SUB-PAY-' || v_year || '-([0-9]+)$'))[1]::INT
      ELSE 0
    END
  ), 0) + 1 INTO v_count
  FROM public.subcontractor_payments
  WHERE organisation_id = p_org_id;

  v_next_no := 'SUB-PAY-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');
  RETURN v_next_no;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- 3. CREATION ENFORCEMENT & IMMUTABILITY TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_enforce_posted_proforma_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('app.allow_posted_proforma_creation', true) IS DISTINCT FROM 'true' THEN
    IF NEW.status IN ('accepted', 'converted') THEN
      RAISE EXCEPTION 'Direct REST creation of accepted or converted proforma invoices is prohibited. Use record_proforma_invoice().';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_posted_proforma_creation ON public.proforma_invoices;
CREATE TRIGGER trg_enforce_posted_proforma_creation
  BEFORE INSERT ON public.proforma_invoices
  FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_posted_proforma_creation();

CREATE OR REPLACE FUNCTION public.fn_enforce_posted_subcontractor_bill_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('app.allow_posted_subcontractor_bill_creation', true) IS DISTINCT FROM 'true' THEN
    IF NEW.status IN ('Approved', 'Posted', 'Paid') THEN
      RAISE EXCEPTION 'Direct REST creation of approved/posted subcontractor bills is prohibited. Use record_subcontractor_bill().';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_posted_subcontractor_bill_creation ON public.subcontractor_invoices;
CREATE TRIGGER trg_enforce_posted_subcontractor_bill_creation
  BEFORE INSERT ON public.subcontractor_invoices
  FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_posted_subcontractor_bill_creation();

CREATE OR REPLACE FUNCTION public.fn_enforce_posted_subcontractor_payment_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('app.allow_posted_subcontractor_payment_creation', true) IS DISTINCT FROM 'true' THEN
    IF NEW.workflow_step IN ('released', 'approved') OR NEW.approval_status IN ('Released', 'Approved') THEN
      RAISE EXCEPTION 'Direct REST creation of released/approved subcontractor payments is prohibited. Use record_subcontractor_payment().';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_posted_subcontractor_payment_creation ON public.subcontractor_payments;
CREATE TRIGGER trg_enforce_posted_subcontractor_payment_creation
  BEFORE INSERT ON public.subcontractor_payments
  FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_posted_subcontractor_payment_creation();

-- Immutability Triggers
CREATE OR REPLACE FUNCTION public.fn_prevent_posted_quotation_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('Approved', 'Converted', 'converted') THEN
      RAISE EXCEPTION 'Approved or Converted quotations cannot be deleted.';
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IN ('Approved', 'Converted', 'converted') THEN
      IF NEW.grand_total IS DISTINCT FROM OLD.grand_total OR
         NEW.subtotal IS DISTINCT FROM OLD.subtotal OR
         NEW.total_tax IS DISTINCT FROM OLD.total_tax OR
         NEW.client_id IS DISTINCT FROM OLD.client_id OR
         NEW.organisation_id IS DISTINCT FROM OLD.organisation_id THEN
        RAISE EXCEPTION 'Financial and structural fields of Approved/Converted quotations cannot be modified.';
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_posted_quotation_mutation ON public.quotation_header;
CREATE TRIGGER trg_prevent_posted_quotation_mutation
  BEFORE UPDATE OR DELETE ON public.quotation_header
  FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_posted_quotation_mutation();

CREATE OR REPLACE FUNCTION public.fn_prevent_posted_proforma_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('accepted', 'converted') THEN
      RAISE EXCEPTION 'Accepted or Converted proforma invoices cannot be deleted.';
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IN ('accepted', 'converted') THEN
      IF NEW.total IS DISTINCT FROM OLD.total OR
         NEW.subtotal IS DISTINCT FROM OLD.subtotal OR
         NEW.cgst IS DISTINCT FROM OLD.cgst OR
         NEW.sgst IS DISTINCT FROM OLD.sgst OR
         NEW.igst IS DISTINCT FROM OLD.igst OR
         NEW.client_id IS DISTINCT FROM OLD.client_id OR
         NEW.organisation_id IS DISTINCT FROM OLD.organisation_id THEN
        RAISE EXCEPTION 'Financial fields of Accepted/Converted proforma invoices cannot be modified.';
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_posted_proforma_mutation ON public.proforma_invoices;
CREATE TRIGGER trg_prevent_posted_proforma_mutation
  BEFORE UPDATE OR DELETE ON public.proforma_invoices
  FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_posted_proforma_mutation();

CREATE OR REPLACE FUNCTION public.fn_prevent_posted_subcontractor_bill_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('Approved', 'Posted', 'Paid') THEN
      RAISE EXCEPTION 'Approved or Posted subcontractor bills cannot be deleted.';
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IN ('Approved', 'Posted', 'Paid') THEN
      IF NEW.amount IS DISTINCT FROM OLD.amount OR
         NEW.subcontractor_id IS DISTINCT FROM OLD.subcontractor_id OR
         NEW.organisation_id IS DISTINCT FROM OLD.organisation_id THEN
        RAISE EXCEPTION 'Financial fields of Approved/Posted subcontractor bills cannot be modified.';
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_posted_subcontractor_bill_mutation ON public.subcontractor_invoices;
CREATE TRIGGER trg_prevent_posted_subcontractor_bill_mutation
  BEFORE UPDATE OR DELETE ON public.subcontractor_invoices
  FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_posted_subcontractor_bill_mutation();

CREATE OR REPLACE FUNCTION public.fn_prevent_posted_subcontractor_payment_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.workflow_step IN ('released', 'approved') OR OLD.approval_status IN ('Released', 'Approved') THEN
      RAISE EXCEPTION 'Released or Approved subcontractor payments cannot be deleted.';
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.workflow_step IN ('released', 'approved') OR OLD.approval_status IN ('Released', 'Approved') THEN
      IF NEW.amount IS DISTINCT FROM OLD.amount OR
         NEW.gross_amount IS DISTINCT FROM OLD.gross_amount OR
         NEW.tds_amount IS DISTINCT FROM OLD.tds_amount OR
         NEW.net_amount IS DISTINCT FROM OLD.net_amount OR
         NEW.subcontractor_id IS DISTINCT FROM OLD.subcontractor_id OR
         NEW.organisation_id IS DISTINCT FROM OLD.organisation_id THEN
        RAISE EXCEPTION 'Financial fields of Released/Approved subcontractor payments cannot be modified.';
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_posted_subcontractor_payment_mutation ON public.subcontractor_payments;
CREATE TRIGGER trg_prevent_posted_subcontractor_payment_mutation
  BEFORE UPDATE OR DELETE ON public.subcontractor_payments
  FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_posted_subcontractor_payment_mutation();

-- ═══════════════════════════════════════════════════════════════════════
-- 4. STRICT RLS POLICIES (TENANT ISOLATION)
-- ═══════════════════════════════════════════════════════════════════════

-- Quotations
ALTER TABLE public.quotation_header ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON public.quotation_header;
DROP POLICY IF EXISTS "quotation_header_all_access" ON public.quotation_header;
DROP POLICY IF EXISTS "quotation_header_org_policy" ON public.quotation_header;

CREATE POLICY "quotation_header_org_policy" ON public.quotation_header
  FOR ALL TO authenticated
  USING (public.user_can_access_org(organisation_id))
  WITH CHECK (public.user_can_access_org(organisation_id));

ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON public.quotation_items;
DROP POLICY IF EXISTS "quotation_items_all_access" ON public.quotation_items;
DROP POLICY IF EXISTS "quotation_items_org_policy" ON public.quotation_items;

CREATE POLICY "quotation_items_org_policy" ON public.quotation_items
  FOR ALL TO authenticated
  USING (public.user_can_access_org(organisation_id))
  WITH CHECK (public.user_can_access_org(organisation_id));

-- Proforma Invoices
ALTER TABLE public.proforma_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "proforma_invoices_org_select" ON public.proforma_invoices;
DROP POLICY IF EXISTS "proforma_invoices_org_insert" ON public.proforma_invoices;
DROP POLICY IF EXISTS "proforma_invoices_org_update" ON public.proforma_invoices;
DROP POLICY IF EXISTS "proforma_invoices_org_delete" ON public.proforma_invoices;

CREATE POLICY "proforma_invoices_org_policy" ON public.proforma_invoices
  FOR ALL TO authenticated
  USING (public.user_can_access_org(organisation_id))
  WITH CHECK (public.user_can_access_org(organisation_id));

ALTER TABLE public.proforma_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "proforma_items_org_select" ON public.proforma_items;
DROP POLICY IF EXISTS "proforma_items_org_insert" ON public.proforma_items;
DROP POLICY IF EXISTS "proforma_items_org_update" ON public.proforma_items;
DROP POLICY IF EXISTS "proforma_items_org_delete" ON public.proforma_items;

CREATE POLICY "proforma_items_org_policy" ON public.proforma_items
  FOR ALL TO authenticated
  USING (public.user_can_access_org(organisation_id))
  WITH CHECK (public.user_can_access_org(organisation_id));

-- Subcontractors & Transaction Tables
ALTER TABLE public.subcontractors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON public.subcontractors;
DROP POLICY IF EXISTS "subcontractors_all_access" ON public.subcontractors;
DROP POLICY IF EXISTS "subcontractors_org_policy" ON public.subcontractors;

CREATE POLICY "subcontractors_org_policy" ON public.subcontractors
  FOR ALL TO authenticated
  USING (public.user_can_access_org(organisation_id))
  WITH CHECK (public.user_can_access_org(organisation_id));

ALTER TABLE public.subcontractor_work_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.subcontractor_work_orders;
DROP POLICY IF EXISTS "subcontractor_work_orders_all_access" ON public.subcontractor_work_orders;
DROP POLICY IF EXISTS "swo_org_policy" ON public.subcontractor_work_orders;

CREATE POLICY "swo_org_policy" ON public.subcontractor_work_orders
  FOR ALL TO authenticated
  USING (public.user_can_access_org(organisation_id))
  WITH CHECK (public.user_can_access_org(organisation_id));

ALTER TABLE public.subcontractor_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON public.subcontractor_invoices;
DROP POLICY IF EXISTS "subcontractor_invoices_all_access" ON public.subcontractor_invoices;

CREATE POLICY "subcontractor_invoices_org_policy" ON public.subcontractor_invoices
  FOR ALL TO authenticated
  USING (public.user_can_access_org(organisation_id))
  WITH CHECK (public.user_can_access_org(organisation_id));

ALTER TABLE public.subcontractor_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON public.subcontractor_payments;
DROP POLICY IF EXISTS "subcontractor_payments_all_access" ON public.subcontractor_payments;

CREATE POLICY "subcontractor_payments_org_policy" ON public.subcontractor_payments
  FOR ALL TO authenticated
  USING (public.user_can_access_org(organisation_id))
  WITH CHECK (public.user_can_access_org(organisation_id));

ALTER TABLE public.subcontractor_retention ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.subcontractor_retention;
DROP POLICY IF EXISTS "subcontractor_retention_all_access" ON public.subcontractor_retention;

CREATE POLICY "subcontractor_retention_org_policy" ON public.subcontractor_retention
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.subcontractor_work_orders wo
      WHERE wo.id = subcontractor_retention.work_order_id
        AND public.user_can_access_org(wo.organisation_id)
    )
  );

ALTER TABLE public.subcontractor_tds_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.subcontractor_tds_payments;
DROP POLICY IF EXISTS "subcontractor_tds_payments_all_access" ON public.subcontractor_tds_payments;

CREATE POLICY "subcontractor_tds_payments_org_policy" ON public.subcontractor_tds_payments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.subcontractors s
      WHERE s.id = subcontractor_tds_payments.subcontractor_id
        AND public.user_can_access_org(s.organisation_id)
    )
  );

-- ═══════════════════════════════════════════════════════════════════════
-- 5. AUTHORITATIVE SERVER-SIDE RPCS
-- ═══════════════════════════════════════════════════════════════════════

-- Helper: Subcontractor Balance Recalculation
CREATE OR REPLACE FUNCTION public.recalc_subcontractor_balance(
  p_subcontractor_id UUID,
  p_organisation_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Reserved for subcontractor master balance updates
  NULL;
END;
$$;

-- A. record_quotation
CREATE OR REPLACE FUNCTION public.record_quotation(
  p_organisation_id UUID,
  p_client_id UUID,
  p_project_id UUID DEFAULT NULL,
  p_items JSONB DEFAULT '[]'::JSONB,
  p_remarks TEXT DEFAULT NULL,
  p_payment_terms TEXT DEFAULT NULL,
  p_valid_till DATE DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_client RECORD;
  v_item JSONB;
  v_line_qty NUMERIC(15,4);
  v_line_rate NUMERIC(15,2);
  v_disc_pct NUMERIC(5,2);
  v_tax_pct NUMERIC(5,2);
  v_gross NUMERIC(15,2);
  v_disc_amt NUMERIC(15,2);
  v_taxable NUMERIC(15,2);
  v_tax_amt NUMERIC(15,2);
  v_line_total NUMERIC(15,2);
  
  v_subtotal NUMERIC(15,2) := 0;
  v_total_tax NUMERIC(15,2) := 0;
  v_grand_total NUMERIC(15,2) := 0;
  
  v_quotation_id UUID;
  v_quotation_no TEXT;
  v_existing_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organization access';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_id
    FROM public.quotation_header
    WHERE organisation_id = p_organisation_id
      AND idempotency_key = p_idempotency_key;

    IF v_existing_id IS NOT NULL THEN
      SELECT quotation_no, grand_total INTO v_quotation_no, v_grand_total
      FROM public.quotation_header WHERE id = v_existing_id;

      RETURN jsonb_build_object(
        'status', 'success',
        'idempotent_replayed', true,
        'quotation_id', v_existing_id,
        'quotation_no', v_quotation_no,
        'grand_total', v_grand_total
      );
    END IF;
  END IF;

  SELECT * INTO v_client FROM public.clients WHERE id = p_client_id AND organisation_id = p_organisation_id;
  IF v_client IS NULL THEN
    RAISE EXCEPTION 'Client not found or does not belong to organization';
  END IF;

  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Quotation must contain at least one line item';
  END IF;

  v_quotation_no := public.generate_next_quotation_number(p_organisation_id);

  INSERT INTO public.quotation_header (
    quotation_no, organisation_id, client_id, project_id,
    date, valid_till, payment_terms, remarks, status,
    subtotal, total_tax, grand_total, created_by, idempotency_key
  ) VALUES (
    v_quotation_no, p_organisation_id, p_client_id, p_project_id,
    CURRENT_DATE, p_valid_till, p_payment_terms, p_remarks, 'Draft',
    0, 0, 0, auth.uid(), p_idempotency_key
  ) RETURNING id INTO v_quotation_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_line_qty := COALESCE((v_item->>'qty')::NUMERIC, 1);
    v_line_rate := COALESCE((v_item->>'rate')::NUMERIC, 0);
    v_disc_pct := COALESCE((v_item->>'discount_percent')::NUMERIC, 0);
    v_tax_pct := COALESCE((v_item->>'tax_percent')::NUMERIC, 18);

    IF v_line_qty <= 0 OR v_line_rate < 0 THEN
      RAISE EXCEPTION 'Line item quantity and rate must be valid non-negative values';
    END IF;

    v_gross := ROUND((v_line_qty * v_line_rate)::NUMERIC, 2);
    v_disc_amt := ROUND((v_gross * (v_disc_pct / 100.0))::NUMERIC, 2);
    v_taxable := v_gross - v_disc_amt;
    v_tax_amt := ROUND((v_taxable * (v_tax_pct / 100.0))::NUMERIC, 2);
    v_line_total := v_taxable + v_tax_amt;

    v_subtotal := v_subtotal + v_taxable;
    v_total_tax := v_total_tax + v_tax_amt;

    INSERT INTO public.quotation_items (
      quotation_id, organisation_id, item_id, description, qty, rate,
      discount_percent, discount_amount, tax_percent, tax_amount, line_total
    ) VALUES (
      v_quotation_id, p_organisation_id, (v_item->>'item_id')::UUID,
      v_item->>'description', v_line_qty, v_line_rate,
      v_disc_pct, v_disc_amt, v_tax_pct, v_tax_amt, v_line_total
    );
  END LOOP;

  v_grand_total := v_subtotal + v_total_tax;

  UPDATE public.quotation_header
  SET subtotal = v_subtotal,
      total_tax = v_total_tax,
      grand_total = v_grand_total
  WHERE id = v_quotation_id;

  RETURN jsonb_build_object(
    'status', 'success',
    'quotation_id', v_quotation_id,
    'quotation_no', v_quotation_no,
    'subtotal', v_subtotal,
    'total_tax', v_total_tax,
    'grand_total', v_grand_total
  );
END;
$$;

-- B. record_proforma_invoice
CREATE OR REPLACE FUNCTION public.record_proforma_invoice(
  p_organisation_id UUID,
  p_client_id UUID,
  p_items JSONB DEFAULT '[]'::JSONB,
  p_notes TEXT DEFAULT NULL,
  p_terms TEXT DEFAULT NULL,
  p_po_number TEXT DEFAULT NULL,
  p_po_date DATE DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_client RECORD;
  v_org RECORD;
  v_is_intra_state BOOLEAN := TRUE;
  v_item JSONB;
  v_line_qty NUMERIC(15,4);
  v_line_rate NUMERIC(15,2);
  v_disc_pct NUMERIC(5,2);
  v_tax_pct NUMERIC(5,2);
  v_gross NUMERIC(15,2);
  v_disc_amt NUMERIC(15,2);
  v_taxable NUMERIC(15,2);
  
  v_subtotal NUMERIC(15,2) := 0;
  v_cgst NUMERIC(15,2) := 0;
  v_sgst NUMERIC(15,2) := 0;
  v_igst NUMERIC(15,2) := 0;
  v_total NUMERIC(15,2) := 0;
  
  v_proforma_id UUID;
  v_pi_number TEXT;
  v_existing_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organization access';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_id
    FROM public.proforma_invoices
    WHERE organisation_id = p_organisation_id
      AND idempotency_key = p_idempotency_key;

    IF v_existing_id IS NOT NULL THEN
      SELECT pi_number, total INTO v_pi_number, v_total
      FROM public.proforma_invoices WHERE id = v_existing_id;

      RETURN jsonb_build_object(
        'status', 'success',
        'idempotent_replayed', true,
        'proforma_id', v_existing_id,
        'pi_number', v_pi_number,
        'total', v_total
      );
    END IF;
  END IF;

  SELECT * INTO v_client FROM public.clients WHERE id = p_client_id AND organisation_id = p_organisation_id;
  IF v_client IS NULL THEN
    RAISE EXCEPTION 'Client not found or does not belong to organization';
  END IF;

  SELECT * INTO v_org FROM public.organisations WHERE id = p_organisation_id;
  IF v_client.state IS NOT NULL AND v_org.state IS NOT NULL THEN
    IF LOWER(TRIM(v_client.state)) != LOWER(TRIM(v_org.state)) THEN
      v_is_intra_state := FALSE;
    END IF;
  END IF;

  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Proforma invoice must contain at least one line item';
  END IF;

  v_pi_number := public.generate_next_proforma_number_v2(p_organisation_id);

  PERFORM set_config('app.allow_posted_proforma_creation', 'true', true);

  INSERT INTO public.proforma_invoices (
    pi_number, organisation_id, client_id, status, company_state, client_state,
    subtotal, cgst, sgst, igst, total, notes, terms, po_number, po_date, idempotency_key
  ) VALUES (
    v_pi_number, p_organisation_id, p_client_id, 'draft', v_org.state, v_client.state,
    0, 0, 0, 0, 0, p_notes, p_terms, p_po_number, p_po_date, p_idempotency_key
  ) RETURNING id INTO v_proforma_id;

  PERFORM set_config('app.allow_posted_proforma_creation', 'false', true);

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_line_qty := COALESCE((v_item->>'qty')::NUMERIC, 1);
    v_line_rate := COALESCE((v_item->>'rate')::NUMERIC, 0);
    v_disc_pct := COALESCE((v_item->>'discount_percent')::NUMERIC, 0);
    v_tax_pct := COALESCE((v_item->>'tax_percent')::NUMERIC, 18);

    IF v_line_qty <= 0 OR v_line_rate < 0 THEN
      RAISE EXCEPTION 'Line item quantity and rate must be valid non-negative values';
    END IF;

    v_gross := ROUND((v_line_qty * v_line_rate)::NUMERIC, 2);
    v_disc_amt := ROUND((v_gross * (v_disc_pct / 100.0))::NUMERIC, 2);
    v_taxable := v_gross - v_disc_amt;

    v_subtotal := v_subtotal + v_taxable;

    IF v_is_intra_state THEN
      v_cgst := v_cgst + ROUND((v_taxable * (v_tax_pct / 2.0 / 100.0))::NUMERIC, 2);
      v_sgst := v_sgst + ROUND((v_taxable * (v_tax_pct / 2.0 / 100.0))::NUMERIC, 2);
    ELSE
      v_igst := v_igst + ROUND((v_taxable * (v_tax_pct / 100.0))::NUMERIC, 2);
    END IF;

    INSERT INTO public.proforma_items (
      proforma_id, organisation_id, item_id, description, qty, rate, amount,
      discount_percent, discount_amount, tax_percent
    ) VALUES (
      v_proforma_id, p_organisation_id, (v_item->>'item_id')::UUID,
      v_item->>'description', v_line_qty, v_line_rate, v_taxable,
      v_disc_pct, v_disc_amt, v_tax_pct
    );
  END LOOP;

  v_total := v_subtotal + v_cgst + v_sgst + v_igst;

  UPDATE public.proforma_invoices
  SET subtotal = v_subtotal,
      cgst = v_cgst,
      sgst = v_sgst,
      igst = v_igst,
      total = v_total
  WHERE id = v_proforma_id;

  RETURN jsonb_build_object(
    'status', 'success',
    'proforma_id', v_proforma_id,
    'pi_number', v_pi_number,
    'subtotal', v_subtotal,
    'cgst', v_cgst,
    'sgst', v_sgst,
    'igst', v_igst,
    'total', v_total
  );
END;
$$;

-- C. convert_proforma_to_invoice
CREATE OR REPLACE FUNCTION public.convert_proforma_to_invoice(
  p_proforma_id UUID,
  p_organisation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_proforma RECORD;
  v_item RECORD;
  v_invoice_id UUID;
  v_finalize_res JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organization access';
  END IF;

  SELECT * INTO v_proforma
  FROM public.proforma_invoices
  WHERE id = p_proforma_id AND organisation_id = p_organisation_id
  FOR UPDATE;

  IF v_proforma IS NULL THEN
    RAISE EXCEPTION 'Proforma invoice not found or does not belong to organization';
  END IF;

  IF v_proforma.converted_invoice_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'already_converted',
      'proforma_id', p_proforma_id,
      'converted_invoice_id', v_proforma.converted_invoice_id
    );
  END IF;

  -- Create draft Sales Invoice
  INSERT INTO public.invoices (
    organisation_id, client_id, status, invoice_date, proforma_id, po_number, po_date,
    template_type, mode, source_type, subtotal, cgst, sgst, igst, total
  ) VALUES (
    p_organisation_id, v_proforma.client_id, 'draft', CURRENT_DATE, p_proforma_id, v_proforma.po_number, v_proforma.po_date,
    'standard', 'itemized', 'quotation', 0, 0, 0, 0, 0
  ) RETURNING id INTO v_invoice_id;

  FOR v_item IN
    SELECT item_id, description, qty, rate, discount_percent, tax_percent
    FROM public.proforma_items
    WHERE proforma_id = p_proforma_id
  LOOP
    INSERT INTO public.invoice_items (
      invoice_id, organisation_id, description, qty, rate, amount,
      meta_json
    ) VALUES (
      v_invoice_id, p_organisation_id, COALESCE(v_item.description, 'Line Item'), v_item.qty, v_item.rate,
      ROUND((v_item.qty * v_item.rate)::NUMERIC, 2),
      jsonb_build_object('tax_percent', v_item.tax_percent)
    );
  END LOOP;

  -- Finalize Sales Invoice (Posts GL & Stock atomically)
  v_finalize_res := public.finalize_sales_invoice(v_invoice_id, p_organisation_id);
  UPDATE public.proforma_invoices SET converted_invoice_id = v_invoice_id, status = 'accepted', updated_at = NOW() WHERE id = p_proforma_id;

  RETURN jsonb_build_object(
    'status', 'success',
    'proforma_id', p_proforma_id,
    'converted_invoice_id', v_invoice_id,
    'finalize_details', v_finalize_res
  );
END;
$$;

-- D. record_subcontractor_work_order
CREATE OR REPLACE FUNCTION public.record_subcontractor_work_order(
  p_organisation_id UUID,
  p_subcontractor_id UUID,
  p_items JSONB DEFAULT '[]'::JSONB,
  p_project_id UUID DEFAULT NULL,
  p_work_description TEXT DEFAULT NULL,
  p_site_location TEXT DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_retention_percent NUMERIC DEFAULT 0,
  p_tds_percent NUMERIC DEFAULT 0,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sub RECORD;
  v_wo_id UUID;
  v_wo_no TEXT;
  v_existing_id UUID;
  v_item JSONB;
  v_qty NUMERIC(15,4);
  v_rate NUMERIC(15,2);
  v_subtotal NUMERIC(15,2) := 0;
  v_total_amount NUMERIC(15,2) := 0;
  v_retention_amount NUMERIC(15,2) := 0;
  v_tds_amount NUMERIC(15,2) := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organization access';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_id
    FROM public.subcontractor_work_orders
    WHERE organisation_id = p_organisation_id AND idempotency_key = p_idempotency_key;

    IF v_existing_id IS NOT NULL THEN
      SELECT work_order_no, total_amount INTO v_wo_no, v_total_amount
      FROM public.subcontractor_work_orders WHERE id = v_existing_id;

      RETURN jsonb_build_object(
        'status', 'success',
        'idempotent_replayed', true,
        'work_order_id', v_existing_id,
        'work_order_no', v_wo_no,
        'total_amount', v_total_amount
      );
    END IF;
  END IF;

  SELECT * INTO v_sub FROM public.subcontractors WHERE id = p_subcontractor_id AND organisation_id = p_organisation_id;
  IF v_sub IS NULL THEN
    RAISE EXCEPTION 'Subcontractor not found or does not belong to organization';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := COALESCE((v_item->>'quantity')::NUMERIC, (v_item->>'qty')::NUMERIC, 1);
    v_rate := COALESCE((v_item->>'rate')::NUMERIC, 0);
    IF v_qty <= 0 OR v_rate < 0 THEN
      RAISE EXCEPTION 'Work order item quantity and rate must be valid non-negative numbers';
    END IF;
    v_subtotal := v_subtotal + ROUND((v_qty * v_rate)::NUMERIC, 2);
  END LOOP;

  v_total_amount := v_subtotal;
  v_retention_amount := ROUND((v_total_amount * (COALESCE(p_retention_percent, 0) / 100.0))::NUMERIC, 2);
  v_tds_amount := ROUND((v_total_amount * (COALESCE(p_tds_percent, 0) / 100.0))::NUMERIC, 2);

  v_wo_no := public.generate_next_work_order_number(p_organisation_id);

  INSERT INTO public.subcontractor_work_orders (
    work_order_no, organisation_id, subcontractor_id, project_id, status,
    issue_date, start_date, end_date, work_description, site_location,
    line_items, subtotal, total_amount, retention_percent, retention_amount,
    tds_percent, tds_amount, created_by, idempotency_key
  ) VALUES (
    v_wo_no, p_organisation_id, p_subcontractor_id, p_project_id, 'Draft',
    CURRENT_DATE, p_start_date, p_end_date, p_work_description, p_site_location,
    p_items, v_subtotal, v_total_amount, p_retention_percent, v_retention_amount,
    p_tds_percent, v_tds_amount, auth.uid(), p_idempotency_key
  ) RETURNING id INTO v_wo_id;

  RETURN jsonb_build_object(
    'status', 'success',
    'work_order_id', v_wo_id,
    'work_order_no', v_wo_no,
    'subtotal', v_subtotal,
    'total_amount', v_total_amount
  );
END;
$$;

-- E. record_subcontractor_bill
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
  v_sub RECORD;
  v_wo RECORD;
  v_bill_id UUID;
  v_bill_no TEXT;
  v_existing_id UUID;
  
  v_retention_percent NUMERIC(5,2) := 0;
  v_retention_amt NUMERIC(15,2) := 0;
  v_payable_amt NUMERIC(15,2) := 0;
  
  v_expense_account_id UUID;
  v_ap_account_id UUID;
  v_retention_account_id UUID;
  v_journal_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organization access';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Subcontractor bill amount must be greater than zero';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_id
    FROM public.subcontractor_invoices
    WHERE organisation_id = p_organisation_id AND idempotency_key = p_idempotency_key;

    IF v_existing_id IS NOT NULL THEN
      SELECT invoice_no, amount INTO v_bill_no, p_amount
      FROM public.subcontractor_invoices WHERE id = v_existing_id;

      RETURN jsonb_build_object(
        'status', 'success',
        'idempotent_replayed', true,
        'bill_id', v_existing_id,
        'invoice_no', v_bill_no,
        'amount', p_amount
      );
    END IF;
  END IF;

  SELECT * INTO v_sub FROM public.subcontractors WHERE id = p_subcontractor_id AND organisation_id = p_organisation_id;
  IF v_sub IS NULL THEN
    RAISE EXCEPTION 'Subcontractor not found or does not belong to organization';
  END IF;

  IF p_work_order_id IS NOT NULL THEN
    SELECT * INTO v_wo FROM public.subcontractor_work_orders
    WHERE id = p_work_order_id AND organisation_id = p_organisation_id AND subcontractor_id = p_subcontractor_id
    FOR UPDATE;

    IF v_wo IS NULL THEN
      RAISE EXCEPTION 'Work order not found or belongs to a different subcontractor/organization';
    END IF;
    v_retention_percent := COALESCE(v_wo.retention_percent, 0);
  END IF;

  v_retention_amt := ROUND((p_amount * (v_retention_percent / 100.0))::NUMERIC, 2);
  v_payable_amt := p_amount - v_retention_amt;

  v_bill_no := public.generate_next_subcontractor_bill_number(p_organisation_id);

  PERFORM set_config('app.allow_posted_subcontractor_bill_creation', 'true', true);

  INSERT INTO public.subcontractor_invoices (
    invoice_no, organisation_id, subcontractor_id, work_order_id,
    invoice_date, amount, status, remarks, idempotency_key
  ) VALUES (
    v_bill_no, p_organisation_id, p_subcontractor_id, p_work_order_id,
    p_invoice_date, p_amount, 'Approved', p_remarks, p_idempotency_key
  ) RETURNING id INTO v_bill_id;

  PERFORM set_config('app.allow_posted_subcontractor_bill_creation', 'false', true);

  IF v_retention_amt > 0 AND p_work_order_id IS NOT NULL THEN
    INSERT INTO public.subcontractor_retention (
      work_order_id, retention_percentage, retention_amount, status, notes, idempotency_key
    ) VALUES (
      p_work_order_id, v_retention_percent, v_retention_amt, 'Held', 'Retained from Bill ' || v_bill_no, p_idempotency_key
    );
  END IF;

  -- General Ledger Double-Entry Posting
  SELECT id INTO v_expense_account_id FROM public.accounts WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id) AND account_code IN ('4100', '4101', '4000') ORDER BY account_code DESC LIMIT 1;
  SELECT id INTO v_ap_account_id FROM public.accounts WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id) AND account_code = '2100' LIMIT 1;
  SELECT id INTO v_retention_account_id FROM public.accounts WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id) AND account_code = '2150' LIMIT 1;

  INSERT INTO public.journal_entries (
    company_id, voucher_no, voucher_date, voucher_type,
    narration, status, created_by
  ) VALUES (
    p_organisation_id, v_bill_no, p_invoice_date, 'Purchase',
    'Subcontractor Bill ' || v_bill_no || ' (' || v_sub.company_name || ')', 'Posted', auth.uid()
  ) RETURNING id INTO v_journal_id;

  IF v_expense_account_id IS NOT NULL THEN
    INSERT INTO public.journal_entry_lines (journal_id, account_id, party_type, party_id, debit, credit, narration)
    VALUES (v_journal_id, v_expense_account_id, 'vendor', p_subcontractor_id, p_amount, 0.00, 'Subcontractor Expense');
  END IF;

  IF v_ap_account_id IS NOT NULL AND v_payable_amt > 0 THEN
    INSERT INTO public.journal_entry_lines (journal_id, account_id, party_type, party_id, debit, credit, narration)
    VALUES (v_journal_id, v_ap_account_id, 'vendor', p_subcontractor_id, 0.00, v_payable_amt, 'Accounts Payable - Subcontractor');
  END IF;

  IF v_retention_account_id IS NOT NULL AND v_retention_amt > 0 THEN
    INSERT INTO public.journal_entry_lines (journal_id, account_id, party_type, party_id, debit, credit, narration)
    VALUES (v_journal_id, v_retention_account_id, 'vendor', p_subcontractor_id, 0.00, v_retention_amt, 'Retention Payable');
  END IF;

  PERFORM public.recalc_subcontractor_balance(p_subcontractor_id, p_organisation_id);

  RETURN jsonb_build_object(
    'status', 'success',
    'bill_id', v_bill_id,
    'invoice_no', v_bill_no,
    'amount', p_amount,
    'retention_amount', v_retention_amt,
    'payable_amount', v_payable_amt,
    'journal_id', v_journal_id
  );
END;
$$;

-- F. record_subcontractor_payment
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
  v_sub RECORD;
  v_payment_id UUID;
  v_ref_no TEXT;
  v_existing_id UUID;
  
  v_gross_amt NUMERIC(15,2);
  v_tds_amt NUMERIC(15,2) := 0;
  v_net_amt NUMERIC(15,2) := 0;
  
  v_ap_account_id UUID;
  v_bank_account_id UUID;
  v_tds_account_id UUID;
  v_journal_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organization access';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_id
    FROM public.subcontractor_payments
    WHERE organisation_id = p_organisation_id AND idempotency_key = p_idempotency_key;

    IF v_existing_id IS NOT NULL THEN
      SELECT reference_no, amount INTO v_ref_no, p_amount
      FROM public.subcontractor_payments WHERE id = v_existing_id;

      RETURN jsonb_build_object(
        'status', 'success',
        'idempotent_replayed', true,
        'payment_id', v_existing_id,
        'reference_no', v_ref_no,
        'amount', p_amount
      );
    END IF;
  END IF;

  SELECT * INTO v_sub FROM public.subcontractors WHERE id = p_subcontractor_id AND organisation_id = p_organisation_id;
  IF v_sub IS NULL THEN
    RAISE EXCEPTION 'Subcontractor not found or does not belong to organization';
  END IF;

  v_gross_amt := p_amount;
  v_tds_amt := ROUND((v_gross_amt * (COALESCE(p_tds_percent, 0) / 100.0))::NUMERIC, 2);
  v_net_amt := v_gross_amt - v_tds_amt;

  IF p_reference_no IS NOT NULL AND p_reference_no != '' THEN
    v_ref_no := p_reference_no;
  ELSE
    v_ref_no := public.generate_next_subcontractor_payment_number(p_organisation_id);
  END IF;

  PERFORM set_config('app.allow_posted_subcontractor_payment_creation', 'true', true);

  INSERT INTO public.subcontractor_payments (
    organisation_id, subcontractor_id, amount, gross_amount, tds_percentage,
    tds_amount, net_amount, payment_date, payment_mode, reference_no,
    workflow_step, approval_status, approved_at, released_at, released_by, idempotency_key
  ) VALUES (
    p_organisation_id, p_subcontractor_id, v_gross_amt, v_gross_amt, p_tds_percent,
    v_tds_amt, v_net_amt, p_payment_date, p_payment_mode, v_ref_no,
    'released', 'Released', NOW(), NOW(), auth.uid(), p_idempotency_key
  ) RETURNING id INTO v_payment_id;

  PERFORM set_config('app.allow_posted_subcontractor_payment_creation', 'false', true);

  IF v_tds_amt > 0 THEN
    INSERT INTO public.subcontractor_tds_payments (
      subcontractor_id, payment_id, tds_amount, status, idempotency_key
    ) VALUES (
      p_subcontractor_id, v_payment_id, v_tds_amt, 'Pending', p_idempotency_key
    );
  END IF;

  -- General Ledger Double-Entry Posting
  SELECT id INTO v_ap_account_id FROM public.accounts WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id) AND account_code = '2100' LIMIT 1;
  IF LOWER(p_payment_mode) LIKE '%cash%' THEN
    SELECT id INTO v_bank_account_id FROM public.accounts WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id) AND account_code IN ('1300', '1301') ORDER BY account_code DESC LIMIT 1;
  ELSE
    SELECT id INTO v_bank_account_id FROM public.accounts WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id) AND account_code = '1200' LIMIT 1;
  END IF;
  SELECT id INTO v_tds_account_id FROM public.accounts WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id) AND account_code = '2200' LIMIT 1;

  INSERT INTO public.journal_entries (
    company_id, organisation_id, voucher_no, voucher_date, voucher_type,
    narration, status, created_by
  ) VALUES (
    p_organisation_id, p_organisation_id, v_ref_no, p_payment_date, 'Payment',
    'Subcontractor Payment ' || v_ref_no || ' (' || v_sub.company_name || ')', 'Posted', auth.uid()
  ) RETURNING id INTO v_journal_id;

  IF v_ap_account_id IS NOT NULL AND v_gross_amt > 0 THEN
    INSERT INTO public.journal_entry_lines (journal_id, account_id, party_type, party_id, debit, credit, narration)
    VALUES (v_journal_id, v_ap_account_id, 'vendor', p_subcontractor_id, v_gross_amt, 0.00, 'Accounts Payable Settlement');
  END IF;

  IF v_bank_account_id IS NOT NULL AND v_net_amt > 0 THEN
    INSERT INTO public.journal_entry_lines (journal_id, account_id, party_type, party_id, debit, credit, narration)
    VALUES (v_journal_id, v_bank_account_id, 'vendor', p_subcontractor_id, 0.00, v_net_amt, 'Bank / Cash Disbursement');
  END IF;

  IF v_tds_account_id IS NOT NULL AND v_tds_amt > 0 THEN
    INSERT INTO public.journal_entry_lines (journal_id, account_id, party_type, party_id, debit, credit, narration)
    VALUES (v_journal_id, v_tds_account_id, 'vendor', p_subcontractor_id, 0.00, v_tds_amt, 'TDS Payable (194C)');
  END IF;

  PERFORM public.recalc_subcontractor_balance(p_subcontractor_id, p_organisation_id);

  RETURN jsonb_build_object(
    'status', 'success',
    'payment_id', v_payment_id,
    'reference_no', v_ref_no,
    'gross_amount', v_gross_amt,
    'tds_amount', v_tds_amt,
    'net_amount', v_net_amt,
    'journal_id', v_journal_id
  );
END;
$$;

-- G. release_subcontractor_retention
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
  v_ret RECORD;
  v_wo RECORD;
  v_retention_account_id UUID;
  v_bank_account_id UUID;
  v_journal_id UUID;
  v_ref_no TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organization access';
  END IF;

  SELECT * INTO v_ret FROM public.subcontractor_retention WHERE id = p_retention_id FOR UPDATE;
  IF v_ret IS NULL THEN
    RAISE EXCEPTION 'Retention record not found';
  END IF;

  SELECT * INTO v_wo FROM public.subcontractor_work_orders WHERE id = v_ret.work_order_id AND organisation_id = p_organisation_id;
  IF v_wo IS NULL THEN
    RAISE EXCEPTION 'Work order for retention does not belong to organization';
  END IF;

  IF v_ret.status = 'Released' THEN
    RETURN jsonb_build_object(
      'status', 'already_released',
      'retention_id', p_retention_id,
      'retention_amount', v_ret.retention_amount
    );
  END IF;

  v_ref_no := COALESCE(p_payment_reference, 'RET-REL-' || p_retention_id::TEXT);

  UPDATE public.subcontractor_retention
  SET status = 'Released',
      actual_release_date = p_release_date,
      payment_reference = v_ref_no,
      idempotency_key = p_idempotency_key
  WHERE id = p_retention_id;

  SELECT id INTO v_retention_account_id FROM public.accounts WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id) AND account_code = '2150' LIMIT 1;
  IF LOWER(p_payment_mode) LIKE '%cash%' THEN
    SELECT id INTO v_bank_account_id FROM public.accounts WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id) AND account_code IN ('1300', '1301') ORDER BY account_code DESC LIMIT 1;
  ELSE
    SELECT id INTO v_bank_account_id FROM public.accounts WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id) AND account_code = '1200' LIMIT 1;
  END IF;

  INSERT INTO public.journal_entries (
    company_id, organisation_id, voucher_no, voucher_date, voucher_type,
    narration, status, created_by
  ) VALUES (
    p_organisation_id, p_organisation_id, v_ref_no, p_release_date, 'Payment',
    'Retention Release for Work Order ' || v_wo.work_order_no, 'Posted', auth.uid()
  ) RETURNING id INTO v_journal_id;

  IF v_retention_account_id IS NOT NULL AND v_ret.retention_amount > 0 THEN
    INSERT INTO public.journal_entry_lines (journal_id, account_id, party_type, party_id, debit, credit, narration)
    VALUES (v_journal_id, v_retention_account_id, 'vendor', v_wo.subcontractor_id, v_ret.retention_amount, 0.00, 'Retention Liability Discharge');
  END IF;

  IF v_bank_account_id IS NOT NULL AND v_ret.retention_amount > 0 THEN
    INSERT INTO public.journal_entry_lines (journal_id, account_id, party_type, party_id, debit, credit, narration)
    VALUES (v_journal_id, v_bank_account_id, 'vendor', v_wo.subcontractor_id, 0.00, v_ret.retention_amount, 'Bank Disbursement for Retention');
  END IF;

  RETURN jsonb_build_object(
    'status', 'success',
    'retention_id', p_retention_id,
    'released_amount', v_ret.retention_amount,
    'journal_id', v_journal_id
  );
END;
$$;
