-- 20260818000003_phase5i_zero_trust_remediation.sql
-- Phase 5I Remediation: Complete RPC authority, work order triggers, proforma acceptance RPC, and case-insensitive trigger enforcement.

-- 1. HARDEN EXISTING TRIGGER FUNCTIONS (CASE-INSENSITIVE COMPARISONS)

CREATE OR REPLACE FUNCTION public.fn_enforce_posted_proforma_creation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF current_setting('app.allow_posted_proforma_creation', true) IS DISTINCT FROM 'true' THEN
    IF LOWER(COALESCE(NEW.status, '')) IN ('accepted', 'converted') THEN
      RAISE EXCEPTION 'Direct REST creation of accepted or converted proforma invoices is prohibited. Use record_proforma_invoice().';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_prevent_posted_proforma_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF LOWER(COALESCE(OLD.status, '')) IN ('accepted', 'converted') THEN
      RAISE EXCEPTION 'Accepted or Converted proforma invoices cannot be deleted.';
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF LOWER(COALESCE(OLD.status, '')) IN ('accepted', 'converted') THEN
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
$function$;

CREATE OR REPLACE FUNCTION public.fn_prevent_posted_quotation_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF LOWER(COALESCE(OLD.status, '')) IN ('approved', 'converted') THEN
      RAISE EXCEPTION 'Approved or Converted quotations cannot be deleted.';
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF LOWER(COALESCE(OLD.status, '')) IN ('approved', 'converted') THEN
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
$function$;

CREATE OR REPLACE FUNCTION public.fn_enforce_posted_subcontractor_bill_creation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF current_setting('app.allow_posted_subcontractor_bill_creation', true) IS DISTINCT FROM 'true' THEN
    IF LOWER(COALESCE(NEW.status, '')) IN ('approved', 'posted', 'paid') THEN
      RAISE EXCEPTION 'Direct REST creation of approved/posted subcontractor bills is prohibited. Use record_subcontractor_bill().';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_prevent_posted_subcontractor_bill_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF LOWER(COALESCE(OLD.status, '')) IN ('approved', 'posted', 'paid') THEN
      RAISE EXCEPTION 'Approved or Posted subcontractor bills cannot be deleted.';
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF LOWER(COALESCE(OLD.status, '')) IN ('approved', 'posted', 'paid') THEN
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
$function$;

CREATE OR REPLACE FUNCTION public.fn_enforce_posted_subcontractor_payment_creation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF current_setting('app.allow_posted_subcontractor_payment_creation', true) IS DISTINCT FROM 'true' THEN
    IF LOWER(COALESCE(NEW.workflow_step, '')) IN ('released', 'approved') OR LOWER(COALESCE(NEW.approval_status, '')) IN ('released', 'approved') THEN
      RAISE EXCEPTION 'Direct REST creation of released/approved subcontractor payments is prohibited. Use record_subcontractor_payment().';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_prevent_posted_subcontractor_payment_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF LOWER(COALESCE(OLD.workflow_step, '')) IN ('released', 'approved') OR LOWER(COALESCE(OLD.approval_status, '')) IN ('released', 'approved') THEN
      RAISE EXCEPTION 'Released or Approved subcontractor payments cannot be deleted.';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF LOWER(COALESCE(OLD.workflow_step, '')) IN ('released', 'approved') OR LOWER(COALESCE(OLD.approval_status, '')) IN ('released', 'approved') THEN
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
$function$;


-- 2. WORK ORDER MUTATION PROTECTIONS

CREATE OR REPLACE FUNCTION public.fn_prevent_posted_work_order_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF LOWER(COALESCE(OLD.status, '')) IN ('approved', 'issued', 'completed') THEN
      RAISE EXCEPTION 'Approved, Issued, or Completed subcontractor work orders cannot be deleted.';
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF LOWER(COALESCE(OLD.status, '')) IN ('approved', 'issued', 'completed') THEN
      IF NEW.total_amount IS DISTINCT FROM OLD.total_amount OR
         NEW.subtotal IS DISTINCT FROM OLD.subtotal OR
         NEW.retention_amount IS DISTINCT FROM OLD.retention_amount OR
         NEW.tds_amount IS DISTINCT FROM OLD.tds_amount OR
         NEW.subcontractor_id IS DISTINCT FROM OLD.subcontractor_id OR
         NEW.organisation_id IS DISTINCT FROM OLD.organisation_id THEN
        RAISE EXCEPTION 'Financial fields of Approved/Issued subcontractor work orders cannot be modified.';
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_prevent_posted_work_order_mutation ON public.subcontractor_work_orders;
CREATE TRIGGER trg_prevent_posted_work_order_mutation
  BEFORE UPDATE OR DELETE ON public.subcontractor_work_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_prevent_posted_work_order_mutation();


-- 3. RPC: update_quotation
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
    authorized_signatory_id = COALESCE(p_authorized_signatory_id, authorized_signatory_id),
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

GRANT EXECUTE ON FUNCTION public.update_quotation(uuid, uuid, uuid, uuid, jsonb, text, text, date, text, text, text, text, text, text, integer, jsonb) TO authenticated;


-- 4. RPC: update_subcontractor_work_order
CREATE OR REPLACE FUNCTION public.update_subcontractor_work_order(
  p_work_order_id uuid,
  p_organisation_id uuid,
  p_subcontractor_id uuid DEFAULT NULL::uuid,
  p_project_id uuid DEFAULT NULL::uuid,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_work_description text DEFAULT NULL::text,
  p_site_location text DEFAULT NULL::text,
  p_start_date date DEFAULT NULL::date,
  p_end_date date DEFAULT NULL::date,
  p_retention_percent numeric DEFAULT NULL::numeric,
  p_tds_percent numeric DEFAULT NULL::numeric,
  p_status text DEFAULT NULL::text,
  p_remarks text DEFAULT NULL::text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_wo RECORD; v_sub RECORD; v_item JSONB;
  v_qty NUMERIC(15,4); v_rate NUMERIC(15,2);
  v_subtotal NUMERIC(15,2) := 0; v_total_amount NUMERIC(15,2) := 0;
  v_retention_amount NUMERIC(15,2) := 0; v_tds_amount NUMERIC(15,2) := 0;
  v_ret_pct NUMERIC(5,2); v_tds_pct NUMERIC(5,2);
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.user_can_access_org(p_organisation_id) THEN RAISE EXCEPTION 'Unauthorized organization access'; END IF;

  SELECT * INTO v_wo FROM public.subcontractor_work_orders
  WHERE id = p_work_order_id AND organisation_id = p_organisation_id FOR UPDATE;

  IF v_wo IS NULL THEN RAISE EXCEPTION 'Work order not found or unauthorized'; END IF;
  IF LOWER(COALESCE(v_wo.status, '')) IN ('approved', 'issued', 'completed') THEN
    RAISE EXCEPTION 'Approved, Issued, or Completed work orders cannot be modified';
  END IF;

  IF p_subcontractor_id IS NOT NULL THEN
    SELECT * INTO v_sub FROM public.subcontractors WHERE id = p_subcontractor_id AND organisation_id = p_organisation_id;
    IF v_sub IS NULL THEN RAISE EXCEPTION 'Subcontractor not found or does not belong to organization'; END IF;
  END IF;

  v_ret_pct := COALESCE(p_retention_percent, v_wo.retention_percent, 0);
  v_tds_pct := COALESCE(p_tds_percent, v_wo.tds_percent, 0);

  IF jsonb_array_length(p_items) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
      v_qty := COALESCE((v_item->>'quantity')::NUMERIC, (v_item->>'qty')::NUMERIC, 1);
      v_rate := COALESCE((v_item->>'rate')::NUMERIC, 0);
      IF v_qty <= 0 OR v_rate < 0 THEN RAISE EXCEPTION 'Work order item quantity and rate must be valid non-negative numbers'; END IF;
      v_subtotal := v_subtotal + ROUND((v_qty * v_rate)::NUMERIC, 2);
    END LOOP;
    v_total_amount := v_subtotal;
  ELSE
    v_subtotal := v_wo.subtotal;
    v_total_amount := v_wo.total_amount;
  END IF;

  v_retention_amount := ROUND((v_total_amount * (v_ret_pct / 100.0))::NUMERIC, 2);
  v_tds_amount := ROUND((v_total_amount * (v_tds_pct / 100.0))::NUMERIC, 2);

  UPDATE public.subcontractor_work_orders SET
    subcontractor_id = COALESCE(p_subcontractor_id, subcontractor_id),
    project_id = COALESCE(p_project_id, project_id),
    line_items = CASE WHEN jsonb_array_length(p_items) > 0 THEN p_items ELSE line_items END,
    work_description = COALESCE(p_work_description, work_description),
    site_location = COALESCE(p_site_location, site_location),
    start_date = COALESCE(p_start_date, start_date),
    end_date = COALESCE(p_end_date, end_date),
    retention_percent = v_ret_pct,
    retention_amount = v_retention_amount,
    tds_percent = v_tds_pct,
    tds_amount = v_tds_amount,
    subtotal = v_subtotal,
    total_amount = v_total_amount,
    status = COALESCE(p_status, status),
    remarks = COALESCE(p_remarks, remarks),
    updated_at = NOW()
  WHERE id = p_work_order_id;

  RETURN jsonb_build_object(
    'status', 'success',
    'work_order_id', p_work_order_id,
    'subtotal', v_subtotal,
    'total_amount', v_total_amount,
    'retention_amount', v_retention_amount,
    'tds_amount', v_tds_amount
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.update_subcontractor_work_order(uuid, uuid, uuid, uuid, jsonb, text, text, date, date, numeric, numeric, text, text) TO authenticated;


-- 5. RPC: accept_proforma_invoice
CREATE OR REPLACE FUNCTION public.accept_proforma_invoice(
  p_proforma_id uuid,
  p_organisation_id uuid
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_proforma RECORD;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.user_can_access_org(p_organisation_id) THEN RAISE EXCEPTION 'Unauthorized organization access'; END IF;

  SELECT * INTO v_proforma FROM public.proforma_invoices
  WHERE id = p_proforma_id AND organisation_id = p_organisation_id FOR UPDATE;

  IF v_proforma IS NULL THEN RAISE EXCEPTION 'Proforma invoice not found or unauthorized'; END IF;

  IF LOWER(COALESCE(v_proforma.status, '')) IN ('accepted', 'converted') THEN
    RETURN jsonb_build_object('status', 'already_accepted', 'proforma_id', p_proforma_id);
  END IF;

  UPDATE public.proforma_invoices
  SET status = 'accepted', accepted_at = NOW(), updated_at = NOW()
  WHERE id = p_proforma_id;

  RETURN jsonb_build_object('status', 'success', 'proforma_id', p_proforma_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.accept_proforma_invoice(uuid, uuid) TO authenticated;
