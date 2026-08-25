-- ============================================================
-- PHASE 5H MIGRATION: RPC SECURITY ENHANCEMENT FOR QUOTATIONS & PROFORMAS
-- ============================================================
-- Applied: 2026-08-18
-- Auditor: Zero-Trust Financial Hardening Phase 5H
-- ============================================================

-- PART 1: ENHANCED record_quotation RPC
CREATE OR REPLACE FUNCTION public.record_quotation(
  p_organisation_id UUID,
  p_client_id UUID,
  p_project_id UUID DEFAULT NULL,
  p_items JSONB DEFAULT '[]'::jsonb,
  p_remarks TEXT DEFAULT NULL,
  p_payment_terms TEXT DEFAULT NULL,
  p_valid_till DATE DEFAULT NULL,
  p_billing_address TEXT DEFAULT NULL,
  p_gstin TEXT DEFAULT NULL,
  p_state TEXT DEFAULT NULL,
  p_contact_no TEXT DEFAULT NULL,
  p_reference TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_client RECORD; v_item JSONB; v_line_qty NUMERIC(15,4); v_line_rate NUMERIC(15,2);
  v_disc_pct NUMERIC(5,2); v_tax_pct NUMERIC(5,2); v_gross NUMERIC(15,2); v_disc_amt NUMERIC(15,2);
  v_taxable NUMERIC(15,2); v_tax_amt NUMERIC(15,2); v_line_total NUMERIC(15,2);
  v_subtotal NUMERIC(15,2) := 0; v_total_tax NUMERIC(15,2) := 0; v_grand_total NUMERIC(15,2) := 0;
  v_quotation_id UUID; v_quotation_no TEXT; v_existing_id UUID; v_creator_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.user_can_access_org(p_organisation_id) THEN RAISE EXCEPTION 'Unauthorized organization access'; END IF;

  SELECT id INTO v_creator_id FROM public.user_profiles WHERE user_id = auth.uid() OR id = auth.uid() LIMIT 1;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_id FROM public.quotation_header WHERE organisation_id = p_organisation_id AND idempotency_key = p_idempotency_key;
    IF v_existing_id IS NOT NULL THEN
      SELECT quotation_no, grand_total INTO v_quotation_no, v_grand_total FROM public.quotation_header WHERE id = v_existing_id;
      RETURN jsonb_build_object('status', 'success', 'idempotent_replayed', true, 'quotation_id', v_existing_id, 'quotation_no', v_quotation_no, 'grand_total', v_grand_total);
    END IF;
  END IF;

  SELECT * INTO v_client FROM public.clients WHERE id = p_client_id AND organisation_id = p_organisation_id;
  IF v_client IS NULL THEN RAISE EXCEPTION 'Client not found or does not belong to organization'; END IF;
  IF jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'Quotation must contain at least one line item'; END IF;

  v_quotation_no := public.generate_next_quotation_number(p_organisation_id);

  INSERT INTO public.quotation_header (
    quotation_no, organisation_id, client_id, project_id, date, valid_till, payment_terms,
    remarks, billing_address, gstin, state, contact_no, reference, status, subtotal, total_tax, grand_total, created_by, idempotency_key
  ) VALUES (
    v_quotation_no, p_organisation_id, p_client_id, p_project_id, CURRENT_DATE, p_valid_till, p_payment_terms,
    p_remarks, COALESCE(p_billing_address, v_client.address1), COALESCE(p_gstin, v_client.gstin), COALESCE(p_state, v_client.state), p_contact_no, p_reference, 'Draft', 0, 0, 0, v_creator_id, p_idempotency_key
  ) RETURNING id INTO v_quotation_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_line_qty := COALESCE((v_item->>'qty')::NUMERIC, (v_item->>'quantity')::NUMERIC, 1);
    v_line_rate := COALESCE((v_item->>'rate')::NUMERIC, 0);
    v_disc_pct := COALESCE((v_item->>'discount_percent')::NUMERIC, 0);
    v_tax_pct := COALESCE((v_item->>'tax_percent')::NUMERIC, 18);
    IF v_line_qty <= 0 OR v_line_rate < 0 THEN RAISE EXCEPTION 'Line item quantity and rate must be valid non-negative values'; END IF;

    v_gross := ROUND((v_line_qty * v_line_rate)::NUMERIC, 2);
    v_disc_amt := ROUND((v_gross * (v_disc_pct / 100.0))::NUMERIC, 2);
    v_taxable := v_gross - v_disc_amt;
    v_tax_amt := ROUND((v_taxable * (v_tax_pct / 100.0))::NUMERIC, 2);
    v_line_total := v_taxable + v_tax_amt;
    v_subtotal := v_subtotal + v_taxable;
    v_total_tax := v_total_tax + v_tax_amt;

    INSERT INTO public.quotation_items (
      quotation_id, organisation_id, item_id, variant_id, description, qty, uom, rate, discount_percent, discount_amount, tax_percent, tax_amount, line_total
    ) VALUES (
      v_quotation_id, p_organisation_id,
      CASE WHEN (v_item->>'item_id') IS NOT NULL AND (v_item->>'item_id') != '' THEN (v_item->>'item_id')::UUID ELSE NULL END,
      CASE WHEN (v_item->>'variant_id') IS NOT NULL AND (v_item->>'variant_id') != '' THEN (v_item->>'variant_id')::UUID ELSE NULL END,
      COALESCE(v_item->>'description', ''), v_line_qty, COALESCE(v_item->>'uom', ''), v_line_rate, v_disc_pct, v_disc_amt, v_tax_pct, v_tax_amt, v_line_total
    );
  END LOOP;

  v_grand_total := v_subtotal + v_total_tax;
  UPDATE public.quotation_header SET subtotal = v_subtotal, total_tax = v_total_tax, grand_total = v_grand_total WHERE id = v_quotation_id;

  RETURN jsonb_build_object('status', 'success', 'quotation_id', v_quotation_id, 'quotation_no', v_quotation_no, 'subtotal', v_subtotal, 'total_tax', v_total_tax, 'grand_total', v_grand_total);
END;
$$;

-- PART 2: NEW update_proforma_invoice RPC
CREATE OR REPLACE FUNCTION public.update_proforma_invoice(
  p_proforma_id UUID,
  p_organisation_id UUID,
  p_client_id UUID,
  p_items JSONB DEFAULT '[]'::jsonb,
  p_notes TEXT DEFAULT NULL,
  p_terms TEXT DEFAULT NULL,
  p_po_number TEXT DEFAULT NULL,
  p_po_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_proforma RECORD; v_client RECORD; v_org RECORD; v_is_intra_state BOOLEAN := TRUE; v_item JSONB;
  v_line_qty NUMERIC(15,4); v_line_rate NUMERIC(15,2); v_disc_pct NUMERIC(5,2); v_tax_pct NUMERIC(5,2);
  v_gross NUMERIC(15,2); v_disc_amt NUMERIC(15,2); v_taxable NUMERIC(15,2);
  v_subtotal NUMERIC(15,2) := 0; v_cgst NUMERIC(15,2) := 0; v_sgst NUMERIC(15,2) := 0; v_igst NUMERIC(15,2) := 0; v_total NUMERIC(15,2) := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.user_can_access_org(p_organisation_id) THEN RAISE EXCEPTION 'Unauthorized organization access'; END IF;

  SELECT * INTO v_proforma FROM public.proforma_invoices WHERE id = p_proforma_id AND organisation_id = p_organisation_id FOR UPDATE;
  IF v_proforma IS NULL THEN RAISE EXCEPTION 'Proforma invoice not found'; END IF;
  IF v_proforma.status IN ('accepted', 'converted') THEN RAISE EXCEPTION 'Accepted or converted proforma invoices cannot be modified'; END IF;

  SELECT * INTO v_client FROM public.clients WHERE id = p_client_id AND organisation_id = p_organisation_id;
  IF v_client IS NULL THEN RAISE EXCEPTION 'Client not found or does not belong to organization'; END IF;
  SELECT * INTO v_org FROM public.organisations WHERE id = p_organisation_id;
  IF v_client.state IS NOT NULL AND v_org.state IS NOT NULL THEN
    IF LOWER(TRIM(v_client.state)) != LOWER(TRIM(v_org.state)) THEN v_is_intra_state := FALSE; END IF;
  END IF;

  IF jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'Proforma invoice must contain at least one line item'; END IF;

  -- Delete existing items
  DELETE FROM public.proforma_items WHERE proforma_id = p_proforma_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_line_qty := COALESCE((v_item->>'qty')::NUMERIC, (v_item->>'quantity')::NUMERIC, 1);
    v_line_rate := COALESCE((v_item->>'rate')::NUMERIC, 0);
    v_disc_pct := COALESCE((v_item->>'discount_percent')::NUMERIC, 0);
    v_tax_pct := COALESCE((v_item->>'tax_percent')::NUMERIC, 18);
    IF v_line_qty <= 0 OR v_line_rate < 0 THEN RAISE EXCEPTION 'Line item quantity and rate must be valid non-negative values'; END IF;

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
      proforma_id, organisation_id, item_id, description, qty, rate, amount, discount_percent, discount_amount, tax_percent
    ) VALUES (
      p_proforma_id, p_organisation_id,
      CASE WHEN (v_item->>'item_id') IS NOT NULL AND (v_item->>'item_id') != '' THEN (v_item->>'item_id')::UUID ELSE NULL END,
      COALESCE(v_item->>'description', 'Line Item'), v_line_qty, v_line_rate, v_taxable, v_disc_pct, v_disc_amt, v_tax_pct
    );
  END LOOP;

  v_total := v_subtotal + v_cgst + v_sgst + v_igst;
  UPDATE public.proforma_invoices
  SET client_id = p_client_id, company_state = v_org.state, client_state = v_client.state,
      subtotal = v_subtotal, cgst = v_cgst, sgst = v_sgst, igst = v_igst, total = v_total,
      notes = p_notes, terms = p_terms, po_number = p_po_number, po_date = p_po_date, updated_at = NOW()
  WHERE id = p_proforma_id;

  RETURN jsonb_build_object('status', 'success', 'proforma_id', p_proforma_id, 'subtotal', v_subtotal, 'cgst', v_cgst, 'sgst', v_sgst, 'igst', v_igst, 'total', v_total);
END;
$$;
