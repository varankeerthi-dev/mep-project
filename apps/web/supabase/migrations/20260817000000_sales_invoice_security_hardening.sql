-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration: 20260817000000_sales_invoice_security_hardening.sql
-- Description: Phase 1 Sales Invoice Security Hardening
--   1. Server-Authoritative finalize_sales_invoice SECURITY DEFINER RPC
--   2. Database-level immutability triggers for finalized invoices & line items
--   3. RLS policy hardening for invoice_items, invoice_materials, GL, and payments
--   4. Hardened SECURITY DEFINER stock deduction functions
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. HARDENED STOCK DEDUCTION FUNCTIONS
CREATE OR REPLACE FUNCTION public.deduct_invoice_stock(
  p_invoice_id UUID,
  p_organisation_id UUID,
  p_allow_insufficient BOOLEAN DEFAULT FALSE
)
RETURNS TABLE(
  material_id UUID,
  warehouse_id UUID,
  requested_qty NUMERIC,
  available_qty NUMERIC,
  deducted_qty NUMERIC,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item_rec RECORD;
  stock_rec RECORD;
  v_material_id UUID;
  v_warehouse_id UUID;
  v_variant_id UUID;
  v_qty DECIMAL(12,3);
  v_available DECIMAL(12,3);
BEGIN
  -- Authenticated user & tenant authorization check
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organization access';
  END IF;

  -- Reverse any existing deductions for this invoice
  PERFORM public.reverse_invoice_stock_deductions(p_invoice_id);

  -- Iterate over invoice items that have a material_id in meta_json
  FOR item_rec IN
    SELECT
      ii.id AS item_id,
      (ii.meta_json->>'material_id')::UUID AS material_id,
      (ii.meta_json->>'warehouse_id')::UUID AS warehouse_id,
      (ii.meta_json->>'variant_id')::UUID AS variant_id,
      ii.qty
    FROM public.invoice_items ii
    WHERE ii.invoice_id = p_invoice_id
      AND ii.meta_json->>'material_id' IS NOT NULL
      AND (ii.meta_json->>'is_service') IS DISTINCT FROM 'true'
  LOOP
    v_material_id := item_rec.material_id;
    v_warehouse_id := item_rec.warehouse_id;
    v_variant_id := item_rec.variant_id;
    v_qty := item_rec.qty;

    -- Skip if no warehouse assigned
    IF v_warehouse_id IS NULL THEN
      material_id := v_material_id;
      warehouse_id := NULL;
      requested_qty := v_qty;
      available_qty := 0;
      deducted_qty := 0;
      status := 'NO_WAREHOUSE';
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- Look up stock with row lock FOR UPDATE
    SELECT * INTO stock_rec
    FROM public.item_stock
    WHERE item_id = v_material_id
      AND warehouse_id = v_warehouse_id
      AND (v_variant_id IS NULL OR company_variant_id = v_variant_id)
    FOR UPDATE;

    IF NOT FOUND THEN
      v_available := 0;
    ELSE
      v_available := stock_rec.current_stock;
    END IF;

    -- Check sufficiency
    IF v_available < v_qty AND NOT p_allow_insufficient THEN
      material_id := v_material_id;
      warehouse_id := v_warehouse_id;
      requested_qty := v_qty;
      available_qty := v_available;
      deducted_qty := 0;
      status := 'INSUFFICIENT';
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- Deduct stock
    IF FOUND THEN
      UPDATE public.item_stock
      SET current_stock = GREATEST(0, current_stock - v_qty),
          updated_at = NOW()
      WHERE id = stock_rec.id;
    END IF;

    -- Record deduction
    INSERT INTO public.invoice_stock_deductions (
      invoice_id, invoice_item_id, material_id, warehouse_id, variant_id,
      qty_deducted, organisation_id
    ) VALUES (
      p_invoice_id, item_rec.item_id, v_material_id, v_warehouse_id, v_variant_id,
      LEAST(v_qty, v_available), p_organisation_id
    );

    material_id := v_material_id;
    warehouse_id := v_warehouse_id;
    requested_qty := v_qty;
    available_qty := v_available;
    deducted_qty := LEAST(v_qty, v_available);
    status := 'DEDUCTED';
    RETURN NEXT;
  END LOOP;

  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.reverse_invoice_stock_deductions(p_invoice_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  stock_rec RECORD;
BEGIN
  FOR rec IN
    SELECT id, material_id, warehouse_id, variant_id, qty_deducted
    FROM public.invoice_stock_deductions
    WHERE invoice_id = p_invoice_id
      AND is_reversed = false
  LOOP
    -- Restore stock to item_stock
    SELECT * INTO stock_rec
    FROM public.item_stock
    WHERE item_id = rec.material_id
      AND warehouse_id = rec.warehouse_id
      AND (rec.variant_id IS NULL OR company_variant_id = rec.variant_id)
    FOR UPDATE;

    IF FOUND THEN
      UPDATE public.item_stock
      SET current_stock = current_stock + rec.qty_deducted,
          updated_at = NOW()
      WHERE id = stock_rec.id;
    END IF;

    -- Mark deduction as reversed
    UPDATE public.invoice_stock_deductions
    SET is_reversed = true,
        reversed_at = NOW()
    WHERE id = rec.id;
  END LOOP;
END;
$$;

-- 2. SERVER-AUTHORITATIVE INVOICE FINALIZATION RPC
CREATE OR REPLACE FUNCTION public.finalize_sales_invoice(
  p_invoice_id UUID,
  p_organisation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice RECORD;
  v_client RECORD;
  v_org RECORD;
  r_item RECORD;
  r_deduct RECORD;
  
  v_line_amount NUMERIC(15,2);
  v_subtotal NUMERIC(15,2) := 0;
  v_cgst NUMERIC(15,2) := 0;
  v_sgst NUMERIC(15,2) := 0;
  v_igst NUMERIC(15,2) := 0;
  v_total NUMERIC(15,2) := 0;
  
  v_tax_percent NUMERIC(5,2);
  v_is_intra_state BOOLEAN := TRUE;
  
  v_ar_account_id UUID;
  v_sales_account_id UUID;
  v_cgst_account_id UUID;
  v_sgst_account_id UUID;
  v_igst_account_id UUID;
  
  v_journal_id UUID;
  v_has_insufficient BOOLEAN := FALSE;
  v_result JSONB;
BEGIN
  -- A. Auth & Tenant Authorization
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organization access';
  END IF;

  -- B. Lock Invoice Row FOR UPDATE
  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id
    AND (organisation_id = p_organisation_id OR org_id = p_organisation_id)
  FOR UPDATE;

  IF v_invoice IS NULL THEN
    RAISE EXCEPTION 'Invoice not found or does not belong to organization';
  END IF;

  -- Idempotent check
  IF v_invoice.status = 'final' THEN
    RETURN jsonb_build_object(
      'status', 'already_finalized',
      'invoice_id', v_invoice.id,
      'invoice_no', v_invoice.invoice_no,
      'total', v_invoice.total
    );
  ELSIF v_invoice.status != 'draft' THEN
    RAISE EXCEPTION 'Invoice must be in draft status to finalize (current status: %)', v_invoice.status;
  END IF;

  -- C. Fetch Client & Organization State for Tax Jurisdiction
  SELECT * INTO v_client FROM public.clients WHERE id = v_invoice.client_id;
  SELECT * INTO v_org FROM public.organisations WHERE id = p_organisation_id;

  IF v_client.state IS NOT NULL AND v_org.state IS NOT NULL THEN
    IF LOWER(TRIM(v_client.state)) != LOWER(TRIM(v_org.state)) THEN
      v_is_intra_state := FALSE;
    END IF;
  END IF;

  -- D. Recalculate Line Amounts & Subtotal Server-Side
  FOR r_item IN
    SELECT id, qty, rate, meta_json
    FROM public.invoice_items
    WHERE invoice_id = p_invoice_id
    FOR UPDATE
  LOOP
    v_line_amount := ROUND((r_item.qty * r_item.rate)::NUMERIC, 2);
    
    UPDATE public.invoice_items
    SET amount = v_line_amount
    WHERE id = r_item.id;

    v_subtotal := v_subtotal + v_line_amount;

    -- Extract line tax percentage or default 18.0
    IF r_item.meta_json->>'tax_percent' IS NOT NULL AND (r_item.meta_json->>'tax_percent')::NUMERIC > 0 THEN
      v_tax_percent := (r_item.meta_json->>'tax_percent')::NUMERIC;
    ELSE
      v_tax_percent := 18.0;
    END IF;

    IF v_is_intra_state THEN
      v_cgst := v_cgst + ROUND((v_line_amount * (v_tax_percent / 2.0 / 100.0))::NUMERIC, 2);
      v_sgst := v_sgst + ROUND((v_line_amount * (v_tax_percent / 2.0 / 100.0))::NUMERIC, 2);
    ELSE
      v_igst := v_igst + ROUND((v_line_amount * (v_tax_percent / 100.0))::NUMERIC, 2);
    END IF;
  END LOOP;

  v_total := v_subtotal + v_cgst + v_sgst + v_igst;

  -- E. Atomic Stock Deduction
  FOR r_deduct IN
    SELECT * FROM public.deduct_invoice_stock(p_invoice_id, p_organisation_id, FALSE)
  LOOP
    IF r_deduct.status = 'INSUFFICIENT' THEN
      v_has_insufficient := TRUE;
    END IF;
  END LOOP;

  IF v_has_insufficient THEN
    RAISE EXCEPTION 'Stock deduction failed due to insufficient material inventory';
  END IF;

  -- F. Atomic Double-Entry GL Journal Posting
  -- Idempotency check: check if GL voucher already posted for this invoice
  SELECT id INTO v_journal_id
  FROM public.journal_entries
  WHERE (company_id = p_organisation_id OR organisation_id = p_organisation_id)
    AND voucher_no = COALESCE(v_invoice.invoice_no, p_invoice_id::TEXT)
    AND voucher_type = 'Sales';

  IF v_journal_id IS NULL THEN
    -- Resolve Chart of Account IDs for this organisation
    SELECT id INTO v_ar_account_id FROM public.accounts WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id) AND account_code = '1100' LIMIT 1;
    SELECT id INTO v_sales_account_id FROM public.accounts WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id) AND account_code IN ('3100', '3101') ORDER BY account_code DESC LIMIT 1;
    SELECT id INTO v_cgst_account_id FROM public.accounts WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id) AND account_code = '2201' LIMIT 1;
    SELECT id INTO v_sgst_account_id FROM public.accounts WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id) AND account_code = '2202' LIMIT 1;
    SELECT id INTO v_igst_account_id FROM public.accounts WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id) AND account_code = '2203' LIMIT 1;

    -- Create Header Journal Entry
    INSERT INTO public.journal_entries (
      company_id, organisation_id, voucher_no, voucher_date, voucher_type,
      narration, status, created_by
    ) VALUES (
      p_organisation_id, p_organisation_id,
      COALESCE(v_invoice.invoice_no, p_invoice_id::TEXT),
      COALESCE(v_invoice.invoice_date, CURRENT_DATE),
      'Sales',
      'Sales Invoice ' || COALESCE(v_invoice.invoice_no, ''),
      'Posted',
      auth.uid()
    ) RETURNING id INTO v_journal_id;

    -- Create Journal Lines (Dr Accounts Receivable, Cr Sales Revenue, Cr GST Liability)
    IF v_ar_account_id IS NOT NULL AND v_total > 0 THEN
      INSERT INTO public.journal_entry_lines (journal_id, account_id, party_type, party_id, debit, credit, narration)
      VALUES (v_journal_id, v_ar_account_id, 'client', v_invoice.client_id, v_total, 0.00, 'Accounts Receivable');
    END IF;

    IF v_sales_account_id IS NOT NULL AND v_subtotal > 0 THEN
      INSERT INTO public.journal_entry_lines (journal_id, account_id, party_type, party_id, debit, credit, narration)
      VALUES (v_journal_id, v_sales_account_id, 'client', v_invoice.client_id, 0.00, v_subtotal, 'Sales Revenue');
    END IF;

    IF v_cgst_account_id IS NOT NULL AND v_cgst > 0 THEN
      INSERT INTO public.journal_entry_lines (journal_id, account_id, party_type, party_id, debit, credit, narration)
      VALUES (v_journal_id, v_cgst_account_id, 'client', v_invoice.client_id, 0.00, v_cgst, 'Output CGST Liability');
    END IF;

    IF v_sgst_account_id IS NOT NULL AND v_sgst > 0 THEN
      INSERT INTO public.journal_entry_lines (journal_id, account_id, party_type, party_id, debit, credit, narration)
      VALUES (v_journal_id, v_sgst_account_id, 'client', v_invoice.client_id, 0.00, v_sgst, 'Output SGST Liability');
    END IF;

    IF v_igst_account_id IS NOT NULL AND v_igst > 0 THEN
      INSERT INTO public.journal_entry_lines (journal_id, account_id, party_type, party_id, debit, credit, narration)
      VALUES (v_journal_id, v_igst_account_id, 'client', v_invoice.client_id, 0.00, v_igst, 'Output IGST Liability');
    END IF;
  END IF;

  -- G. Write Authoritative Financial Values & Finalize Status
  UPDATE public.invoices
  SET subtotal = v_subtotal,
      cgst = v_cgst,
      sgst = v_sgst,
      igst = v_igst,
      total = v_total,
      status = 'final',
      updated_at = NOW()
  WHERE id = p_invoice_id;

  v_result := jsonb_build_object(
    'status', 'success',
    'invoice_id', p_invoice_id,
    'subtotal', v_subtotal,
    'cgst', v_cgst,
    'sgst', v_sgst,
    'igst', v_igst,
    'total', v_total,
    'journal_id', v_journal_id
  );

  RETURN v_result;
END;
$$;

-- 3. DATABASE IMMUTABILITY TRIGGERS FOR FINALIZED INVOICES
CREATE OR REPLACE FUNCTION public.fn_prevent_final_invoice_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'final' THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Cannot delete a finalized invoice (ID: %). Must issue a Credit Note.', OLD.id;
    ELSIF TG_OP = 'UPDATE' THEN
      -- Block modification of financial snapshot fields
      IF NEW.subtotal IS DISTINCT FROM OLD.subtotal OR
         NEW.cgst IS DISTINCT FROM OLD.cgst OR
         NEW.sgst IS DISTINCT FROM OLD.sgst OR
         NEW.igst IS DISTINCT FROM OLD.igst OR
         NEW.total IS DISTINCT FROM OLD.total OR
         NEW.client_id IS DISTINCT FROM OLD.client_id OR
         NEW.invoice_no IS DISTINCT FROM OLD.invoice_no THEN
        RAISE EXCEPTION 'Cannot modify financial snapshot fields of a finalized invoice (ID: %).', OLD.id;
      END IF;
      
      -- Prevent reverting status from final to draft
      IF NEW.status = 'draft' THEN
        RAISE EXCEPTION 'Cannot revert a finalized invoice back to draft status.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_final_invoice_mutation ON public.invoices;
CREATE TRIGGER trg_prevent_final_invoice_mutation
  BEFORE UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_final_invoice_mutation();

CREATE OR REPLACE FUNCTION public.fn_prevent_final_invoice_item_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_status TEXT;
  v_target_invoice_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_target_invoice_id := OLD.invoice_id;
  ELSE
    v_target_invoice_id := NEW.invoice_id;
  END IF;

  SELECT status INTO v_parent_status
  FROM public.invoices
  WHERE id = v_target_invoice_id;

  IF v_parent_status = 'final' THEN
    RAISE EXCEPTION 'Cannot insert, modify, or delete line items on a finalized invoice (Invoice ID: %).', v_target_invoice_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_final_invoice_item_mutation ON public.invoice_items;
CREATE TRIGGER trg_prevent_final_invoice_item_mutation
  BEFORE INSERT OR UPDATE OR DELETE ON public.invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_final_invoice_item_mutation();

-- 4. RLS POLICY HARDENING
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access" ON public.invoice_items;
DROP POLICY IF EXISTS "invoice_items_all_access" ON public.invoice_items;
DROP POLICY IF EXISTS "invoice_items_tenant_isolation" ON public.invoice_items;

CREATE POLICY "invoice_items_tenant_isolation" ON public.invoice_items
  FOR ALL TO authenticated
  USING (
    public.user_can_access_org(organisation_id) OR
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_items.invoice_id
        AND public.user_can_access_org(COALESCE(i.organisation_id, i.org_id))
    )
  )
  WITH CHECK (
    public.user_can_access_org(organisation_id) OR
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_items.invoice_id
        AND public.user_can_access_org(COALESCE(i.organisation_id, i.org_id))
    )
  );

ALTER TABLE public.invoice_materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access" ON public.invoice_materials;
DROP POLICY IF EXISTS "invoice_materials_all_access" ON public.invoice_materials;
DROP POLICY IF EXISTS "invoice_materials_tenant_isolation" ON public.invoice_materials;

CREATE POLICY "invoice_materials_tenant_isolation" ON public.invoice_materials
  FOR ALL TO authenticated
  USING (
    public.user_can_access_org(organisation_id) OR
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_materials.invoice_id
        AND public.user_can_access_org(COALESCE(i.organisation_id, i.org_id))
    )
  )
  WITH CHECK (
    public.user_can_access_org(organisation_id) OR
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_materials.invoice_id
        AND public.user_can_access_org(COALESCE(i.organisation_id, i.org_id))
    )
  );

ALTER TABLE public.project_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access" ON public.project_payments;
DROP POLICY IF EXISTS "project_payments_all_access" ON public.project_payments;
DROP POLICY IF EXISTS "project_payments_tenant_isolation" ON public.project_payments;

CREATE POLICY "project_payments_tenant_isolation" ON public.project_payments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_payments.project_id
        AND public.user_can_access_org(p.organisation_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_payments.project_id
        AND public.user_can_access_org(p.organisation_id)
    )
  );

ALTER TABLE public.debit_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access" ON public.debit_notes;
DROP POLICY IF EXISTS "debit_notes_all_access" ON public.debit_notes;
DROP POLICY IF EXISTS "debit_notes_tenant_isolation" ON public.debit_notes;

CREATE POLICY "debit_notes_tenant_isolation" ON public.debit_notes
  FOR ALL TO authenticated
  USING (public.user_can_access_org(organisation_id))
  WITH CHECK (public.user_can_access_org(organisation_id));
