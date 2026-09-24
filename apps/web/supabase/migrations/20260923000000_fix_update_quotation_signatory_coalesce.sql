-- Fix: update_quotation failed on EVERY edit save with
--   "COALESCE types text and uuid cannot be matched"
-- Cause: p_authorized_signatory_id is declared TEXT while
--   quotation_header.authorized_signatory_id is UUID
--   (see src/database-signatory.sql), so
--   COALESCE(p_authorized_signatory_id, authorized_signatory_id)
--   can never resolve to a common type.
-- Fix: cast with NULLIF guard (same pattern as
--   20260922000002_dc_atomic_lifecycle.sql line 163).
-- Signature is unchanged, so existing GRANTs stay intact.

CREATE OR REPLACE FUNCTION public.update_quotation(
  p_quotation_id uuid,
  p_organisation_id uuid,
  p_client_id uuid DEFAULT NULL::uuid,
  p_project_id uuid DEFAULT NULL::uuid,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_remarks text DEFAULT NULL::text,
  p_payment_terms text DEFAULT NULL::text,
  p_valid_till date DEFAULT NULL::date,
  p_billing_address text DEFAULT NULL::text,
  p_gstin text DEFAULT NULL::text,
  p_state text DEFAULT NULL::text,
  p_contact_no text DEFAULT NULL::text,
  p_reference text DEFAULT NULL::text,
  p_authorized_signatory_id text DEFAULT NULL::text,
  p_revision_no integer DEFAULT NULL::integer,
  p_revision_history jsonb DEFAULT NULL::jsonb
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_quote RECORD; v_client RECORD; v_item JSONB;
  v_line_qty NUMERIC(15,4); v_line_rate NUMERIC(15,2);
  v_disc_pct NUMERIC(5,2); v_tax_pct NUMERIC(5,2);
  v_gross NUMERIC(15,2); v_disc_amt NUMERIC(15,2);
  v_taxable NUMERIC(15,2); v_tax_amt NUMERIC(15,2); v_line_total NUMERIC(15,2);
  v_subtotal NUMERIC(15,2) := 0; v_total_tax NUMERIC(15,2) := 0; v_grand_total NUMERIC(15,2) := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.user_can_access_org(p_organisation_id) THEN RAISE EXCEPTION 'Unauthorized organization access'; END IF;

  SELECT * INTO v_quote FROM public.quotation_header
  WHERE id = p_quotation_id AND organisation_id = p_organisation_id FOR UPDATE;

  IF v_quote IS NULL THEN RAISE EXCEPTION 'Quotation not found or unauthorized'; END IF;
  IF LOWER(COALESCE(v_quote.status, '')) IN ('approved', 'converted') THEN
    RAISE EXCEPTION 'Approved or Converted quotations cannot be modified';
  END IF;

  IF p_client_id IS NOT NULL THEN
    SELECT * INTO v_client FROM public.clients WHERE id = p_client_id AND organisation_id = p_organisation_id;
    IF v_client IS NULL THEN RAISE EXCEPTION 'Client not found or does not belong to organization'; END IF;
  END IF;

  -- Re-calculate items server-side if items provided
  IF jsonb_array_length(p_items) > 0 THEN
    DELETE FROM public.quotation_items WHERE quotation_id = p_quotation_id;

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
        p_quotation_id, p_organisation_id,
        CASE WHEN (v_item->>'item_id') IS NOT NULL AND (v_item->>'item_id') != '' THEN (v_item->>'item_id')::UUID ELSE NULL END,
        CASE WHEN (v_item->>'variant_id') IS NOT NULL AND (v_item->>'variant_id') != '' THEN (v_item->>'variant_id')::UUID ELSE NULL END,
        COALESCE(v_item->>'description', ''), v_line_qty, COALESCE(v_item->>'uom', ''), v_line_rate, v_disc_pct, v_disc_amt, v_tax_pct, v_tax_amt, v_line_total
      );
    END LOOP;
    v_grand_total := v_subtotal + v_total_tax;
  ELSE
    v_subtotal := v_quote.subtotal;
    v_total_tax := v_quote.total_tax;
    v_grand_total := v_quote.grand_total;
  END IF;

  UPDATE public.quotation_header SET
    client_id = COALESCE(p_client_id, client_id),
    project_id = COALESCE(p_project_id, project_id),
    remarks = COALESCE(p_remarks, remarks),
    payment_terms = COALESCE(p_payment_terms, payment_terms),
    valid_till = COALESCE(p_valid_till, valid_till),
    billing_address = COALESCE(p_billing_address, billing_address),
    gstin = COALESCE(p_gstin, gstin),
    state = COALESCE(p_state, state),
    contact_no = COALESCE(p_contact_no, contact_no),
    reference = COALESCE(p_reference, reference),
    authorized_signatory_id = COALESCE(NULLIF(p_authorized_signatory_id, '')::uuid, authorized_signatory_id),
    revision_no = COALESCE(p_revision_no, revision_no),
    revision_history = COALESCE(p_revision_history, revision_history),
    subtotal = v_subtotal,
    total_tax = v_total_tax,
    grand_total = v_grand_total,
    updated_at = NOW()
  WHERE id = p_quotation_id;

  RETURN jsonb_build_object(
    'status', 'success',
    'quotation_id', p_quotation_id,
    'subtotal', v_subtotal,
    'total_tax', v_total_tax,
    'grand_total', v_grand_total
  );
END;
$function$;
