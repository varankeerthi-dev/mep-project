-- ============================================================
-- MIGRATION: Atomic quotation save/update
-- Extends record_quotation and update_quotation to persist
-- all item fields, variant discounts, terms conditions,
-- and header fields inside a single PostgreSQL transaction.
-- ============================================================

-- ---------------------------------------------------------------------------
-- 1. EXTEND update_quotation
-- ---------------------------------------------------------------------------
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
  p_revision_history jsonb DEFAULT NULL::jsonb,
  p_status text DEFAULT NULL::text,
  p_negotiation_mode boolean DEFAULT NULL::boolean,
  p_extra_discount_percent numeric DEFAULT NULL::numeric,
  p_extra_discount_amount numeric DEFAULT NULL::numeric,
  p_round_off numeric DEFAULT NULL::numeric,
  p_round_off_enabled boolean DEFAULT NULL::boolean,
  p_include_erection_charges boolean DEFAULT NULL::boolean,
  p_variant_discounts jsonb DEFAULT '{}'::jsonb,
  p_terms_conditions jsonb DEFAULT NULL::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_quote RECORD;
  v_client RECORD;
  v_item JSONB;
  v_item_idx INT := 0;
  v_line_qty NUMERIC(15,4);
  v_line_rate NUMERIC(15,2);
  v_base_rate NUMERIC(15,2);
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
  v_discount JSONB;
  v_new_item_id UUID;
  v_inserted_items JSONB := '[]'::jsonb;
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

  IF jsonb_array_length(p_items) > 0 THEN
    DELETE FROM public.quotation_items WHERE quotation_id = p_quotation_id;

    v_item_idx := 0;
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
      v_item_idx := v_item_idx + 1;
      v_line_qty := COALESCE((v_item->>'qty')::NUMERIC, (v_item->>'quantity')::NUMERIC, 1);
      v_line_rate := COALESCE((v_item->>'rate')::NUMERIC, 0);
      v_base_rate := COALESCE((v_item->>'base_rate_snapshot')::NUMERIC, v_line_rate);
      v_disc_pct := COALESCE((v_item->>'discount_percent')::NUMERIC, 0);
      v_tax_pct := COALESCE((v_item->>'tax_percent')::NUMERIC, 18);
      IF v_line_qty <= 0 OR v_line_rate < 0 THEN RAISE EXCEPTION 'Line item quantity and rate must be valid non-negative values'; END IF;

      v_gross := ROUND((v_line_qty * v_base_rate)::NUMERIC, 2);
      v_disc_amt := ROUND((v_gross * (v_disc_pct / 100.0))::NUMERIC, 2);
      v_taxable := v_gross - v_disc_amt;
      v_tax_amt := ROUND((v_taxable * (v_tax_pct / 100.0))::NUMERIC, 2);
      v_line_total := v_taxable + v_tax_amt;
      v_subtotal := v_subtotal + v_taxable;
      v_total_tax := v_total_tax + v_tax_amt;

      INSERT INTO public.quotation_items (
        quotation_id, organisation_id, item_id, variant_id, description, qty, uom, rate,
        discount_percent, discount_amount, tax_percent, tax_amount, line_total,
        sac_code, display_order, custom1, custom2,
        base_rate_snapshot, applied_discount_percent, is_override, final_rate_snapshot,
        is_header, is_subtotal, subtotal_label
      ) VALUES (
        p_quotation_id, p_organisation_id,
        CASE WHEN (v_item->>'item_id') IS NOT NULL AND (v_item->>'item_id') != '' THEN (v_item->>'item_id')::UUID ELSE NULL END,
        CASE WHEN (v_item->>'variant_id') IS NOT NULL AND (v_item->>'variant_id') != '' THEN (v_item->>'variant_id')::UUID ELSE NULL END,
        COALESCE(v_item->>'description', ''),
        v_line_qty,
        COALESCE(v_item->>'uom', ''),
        v_line_rate,
        v_disc_pct, v_disc_amt, v_tax_pct, v_tax_amt, v_line_total,
        CASE WHEN (v_item->>'sac_code') IS NOT NULL AND (v_item->>'sac_code') != '' THEN (v_item->>'sac_code') ELSE NULL END,
        COALESCE((v_item->>'display_order')::INT, v_item_idx),
        COALESCE(v_item->>'custom1', ''),
        COALESCE(v_item->>'custom2', ''),
        v_base_rate,
        COALESCE((v_item->>'applied_discount_percent')::NUMERIC, v_disc_pct),
        COALESCE((v_item->>'is_override')::BOOLEAN, FALSE),
        COALESCE((v_item->>'final_rate_snapshot')::NUMERIC, v_line_total),
        COALESCE((v_item->>'is_header')::BOOLEAN, FALSE),
        COALESCE((v_item->>'is_subtotal')::BOOLEAN, FALSE),
        CASE WHEN (v_item->>'subtotal_label') IS NOT NULL AND (v_item->>'subtotal_label') != '' THEN (v_item->>'subtotal_label') ELSE NULL END
      )
      RETURNING id INTO v_new_item_id;
      v_inserted_items := v_inserted_items || jsonb_build_object('id', v_new_item_id::text, 'display_order', v_item_idx);
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
    status = COALESCE(p_status, status),
    negotiation_mode = COALESCE(p_negotiation_mode, negotiation_mode),
    extra_discount_percent = COALESCE(p_extra_discount_percent, extra_discount_percent),
    extra_discount_amount = COALESCE(p_extra_discount_amount, extra_discount_amount),
    round_off = COALESCE(p_round_off, round_off),
    round_off_enabled = COALESCE(p_round_off_enabled, round_off_enabled),
    include_erection_charges = COALESCE(p_include_erection_charges, include_erection_charges),
    subtotal = v_subtotal,
    total_tax = v_total_tax,
    grand_total = v_grand_total,
    updated_at = NOW()
  WHERE id = p_quotation_id;

  DELETE FROM public.quotation_variant_discounts WHERE quotation_id = p_quotation_id;
  IF jsonb_object_length(p_variant_discounts) > 0 THEN
    FOR v_discount IN SELECT * FROM jsonb_each_text(p_variant_discounts) LOOP
      INSERT INTO public.quotation_variant_discounts (quotation_id, variant_id, discount_percent, organisation_id)
      VALUES (p_quotation_id, v_discount.key::UUID, COALESCE((v_discount.value)::NUMERIC, 0), p_organisation_id);
    END LOOP;
  END IF;

  IF p_terms_conditions IS NOT NULL THEN
    DELETE FROM public.quotation_terms_conditions WHERE quotation_id = p_quotation_id;
    INSERT INTO public.quotation_terms_conditions (quotation_id, organisation_id, custom_content, template_id, is_custom)
    VALUES (
      p_quotation_id, p_organisation_id,
      p_terms_conditions->>'custom_content',
      CASE WHEN (p_terms_conditions->>'template_id') IS NOT NULL AND (p_terms_conditions->>'template_id') != '' THEN (p_terms_conditions->>'template_id')::UUID ELSE NULL END,
      COALESCE((p_terms_conditions->>'is_custom')::BOOLEAN, FALSE)
    );
  END IF;

  RETURN jsonb_build_object(
    'status', 'success',
    'quotation_id', p_quotation_id,
    'items', v_inserted_items,
    'subtotal', v_subtotal,
    'total_tax', v_total_tax,
    'grand_total', v_grand_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_quotation(
  uuid, uuid, uuid, uuid, jsonb, text, text, date, text, text, text, text, text, text, integer, jsonb,
  text, boolean, numeric, numeric, numeric, boolean, boolean, jsonb, jsonb
) TO authenticated;


-- ---------------------------------------------------------------------------
-- 2. EXTEND record_quotation
-- ---------------------------------------------------------------------------
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
  p_idempotency_key TEXT DEFAULT NULL,
  p_quotation_no TEXT DEFAULT NULL,
  p_authorized_signatory_id TEXT DEFAULT NULL,
  p_revision_no integer DEFAULT 1,
  p_revision_history jsonb DEFAULT '[]'::jsonb,
  p_status text DEFAULT 'Draft',
  p_negotiation_mode boolean DEFAULT FALSE,
  p_extra_discount_percent numeric DEFAULT 0,
  p_extra_discount_amount numeric DEFAULT 0,
  p_round_off numeric DEFAULT 0,
  p_round_off_enabled boolean DEFAULT TRUE,
  p_include_erection_charges boolean DEFAULT FALSE,
  p_variant_discounts jsonb DEFAULT '{}'::jsonb,
  p_terms_conditions jsonb DEFAULT NULL,
  p_series_config jsonb DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_client RECORD;
  v_item JSONB;
  v_item_idx INT := 0;
  v_line_qty NUMERIC(15,4);
  v_line_rate NUMERIC(15,2);
  v_base_rate NUMERIC(15,2);
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
  v_creator_id UUID;
  v_discount JSONB;
  v_new_item_id UUID;
  v_inserted_items JSONB := '[]'::jsonb;
  v_settings RECORD;
  v_series RECORD;
  v_next_num INT;
  v_padding INT;
  v_prefix TEXT;
  v_suffix TEXT;
  v_fy TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.user_can_access_org(p_organisation_id) THEN RAISE EXCEPTION 'Unauthorized organization access'; END IF;

  SELECT id INTO v_creator_id FROM public.user_profiles WHERE user_id = auth.uid() OR id = auth.uid() LIMIT 1;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id, quotation_no, grand_total INTO v_existing_id, v_quotation_no, v_grand_total
    FROM public.quotation_header
    WHERE organisation_id = p_organisation_id AND idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object('status', 'success', 'idempotent_replayed', true, 'quotation_id', v_existing_id, 'quotation_no', v_quotation_no, 'grand_total', v_grand_total);
    END IF;
  END IF;

  SELECT * INTO v_client FROM public.clients WHERE id = p_client_id AND organisation_id = p_organisation_id;
  IF v_client IS NULL THEN RAISE EXCEPTION 'Client not found or does not belong to organization'; END IF;
  IF jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'Quotation must contain at least one line item'; END IF;

  IF p_quotation_no IS NOT NULL THEN
    v_quotation_no := p_quotation_no;
  ELSE
    v_quotation_no := public.generate_next_quotation_number(p_organisation_id);
  END IF;

  INSERT INTO public.quotation_header (
    quotation_no, organisation_id, client_id, project_id, date, valid_till, payment_terms,
    remarks, billing_address, gstin, state, contact_no, reference, status, subtotal, total_tax, grand_total, created_by, idempotency_key,
    authorized_signatory_id, revision_no, revision_history,
    negotiation_mode, extra_discount_percent, extra_discount_amount, round_off, round_off_enabled, include_erection_charges
  ) VALUES (
    v_quotation_no, p_organisation_id, p_client_id, p_project_id, CURRENT_DATE, p_valid_till, p_payment_terms,
    p_remarks, COALESCE(p_billing_address, v_client.address1), COALESCE(p_gstin, v_client.gstin), COALESCE(p_state, v_client.state), p_contact_no, p_reference, COALESCE(p_status, 'Draft'), 0, 0, 0, v_creator_id, p_idempotency_key,
    NULLIF(p_authorized_signatory_id, '')::uuid,
    COALESCE(p_revision_no, 1),
    COALESCE(p_revision_history, '[]'::jsonb),
    COALESCE(p_negotiation_mode, FALSE),
    COALESCE(p_extra_discount_percent, 0),
    COALESCE(p_extra_discount_amount, 0),
    COALESCE(p_round_off, 0),
    COALESCE(p_round_off_enabled, TRUE),
    COALESCE(p_include_erection_charges, FALSE)
  ) RETURNING id INTO v_quotation_id;

  v_item_idx := 0;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_item_idx := v_item_idx + 1;
    v_line_qty := COALESCE((v_item->>'qty')::NUMERIC, (v_item->>'quantity')::NUMERIC, 1);
    v_line_rate := COALESCE((v_item->>'rate')::NUMERIC, 0);
    v_base_rate := COALESCE((v_item->>'base_rate_snapshot')::NUMERIC, v_line_rate);
    v_disc_pct := COALESCE((v_item->>'discount_percent')::NUMERIC, 0);
    v_tax_pct := COALESCE((v_item->>'tax_percent')::NUMERIC, 18);
    IF v_line_qty <= 0 OR v_line_rate < 0 THEN RAISE EXCEPTION 'Line item quantity and rate must be valid non-negative values'; END IF;

    v_gross := ROUND((v_line_qty * v_base_rate)::NUMERIC, 2);
    v_disc_amt := ROUND((v_gross * (v_disc_pct / 100.0))::NUMERIC, 2);
    v_taxable := v_gross - v_disc_amt;
    v_tax_amt := ROUND((v_taxable * (v_tax_pct / 100.0))::NUMERIC, 2);
    v_line_total := v_taxable + v_tax_amt;
    v_subtotal := v_subtotal + v_taxable;
    v_total_tax := v_total_tax + v_tax_amt;

    INSERT INTO public.quotation_items (
      quotation_id, organisation_id, item_id, variant_id, description, qty, uom, rate,
      discount_percent, discount_amount, tax_percent, tax_amount, line_total,
      sac_code, display_order, custom1, custom2,
      base_rate_snapshot, applied_discount_percent, is_override, final_rate_snapshot,
      is_header, is_subtotal, subtotal_label
    ) VALUES (
      v_quotation_id, p_organisation_id,
      CASE WHEN (v_item->>'item_id') IS NOT NULL AND (v_item->>'item_id') != '' THEN (v_item->>'item_id')::UUID ELSE NULL END,
      CASE WHEN (v_item->>'variant_id') IS NOT NULL AND (v_item->>'variant_id') != '' THEN (v_item->>'variant_id')::UUID ELSE NULL END,
      COALESCE(v_item->>'description', ''),
      v_line_qty,
      COALESCE(v_item->>'uom', ''),
      v_line_rate,
      v_disc_pct, v_disc_amt, v_tax_pct, v_tax_amt, v_line_total,
      CASE WHEN (v_item->>'sac_code') IS NOT NULL AND (v_item->>'sac_code') != '' THEN (v_item->>'sac_code') ELSE NULL END,
      COALESCE((v_item->>'display_order')::INT, v_item_idx),
      COALESCE(v_item->>'custom1', ''),
      COALESCE(v_item->>'custom2', ''),
      v_base_rate,
      COALESCE((v_item->>'applied_discount_percent')::NUMERIC, v_disc_pct),
      COALESCE((v_item->>'is_override')::BOOLEAN, FALSE),
      COALESCE((v_item->>'final_rate_snapshot')::NUMERIC, v_line_total),
      COALESCE((v_item->>'is_header')::BOOLEAN, FALSE),
      COALESCE((v_item->>'is_subtotal')::BOOLEAN, FALSE),
      CASE WHEN (v_item->>'subtotal_label') IS NOT NULL AND (v_item->>'subtotal_label') != '' THEN (v_item->>'subtotal_label') ELSE NULL END
    )
    RETURNING id INTO v_new_item_id;
    v_inserted_items := v_inserted_items || jsonb_build_object('id', v_new_item_id::text, 'display_order', v_item_idx);
  END LOOP;

  v_grand_total := v_subtotal + v_total_tax;
  UPDATE public.quotation_header SET subtotal = v_subtotal, total_tax = v_total_tax, grand_total = v_grand_total WHERE id = v_quotation_id;

  DELETE FROM public.quotation_variant_discounts WHERE quotation_id = v_quotation_id;
  IF jsonb_object_length(p_variant_discounts) > 0 THEN
    FOR v_discount IN SELECT * FROM jsonb_each_text(p_variant_discounts) LOOP
      INSERT INTO public.quotation_variant_discounts (quotation_id, variant_id, discount_percent, organisation_id)
      VALUES (v_quotation_id, v_discount.key::UUID, COALESCE((v_discount.value)::NUMERIC, 0), p_organisation_id);
    END LOOP;
  END IF;

  IF p_terms_conditions IS NOT NULL THEN
    INSERT INTO public.quotation_terms_conditions (quotation_id, organisation_id, custom_content, template_id, is_custom)
    VALUES (
      v_quotation_id, p_organisation_id,
      p_terms_conditions->>'custom_content',
      CASE WHEN (p_terms_conditions->>'template_id') IS NOT NULL AND (p_terms_conditions->>'template_id') != '' THEN (p_terms_conditions->>'template_id')::UUID ELSE NULL END,
      COALESCE((p_terms_conditions->>'is_custom')::BOOLEAN, FALSE)
    );
  END IF;

  IF p_series_config IS NOT NULL THEN
    IF (p_series_config->>'source') = 'document_settings' THEN
      UPDATE public.document_settings
      SET quotation_current_number = COALESCE((p_series_config->>'next_number')::int, 1) + 1,
          updated_at = NOW()
      WHERE organisation_id = (p_series_config->>'organisation_id')::uuid;
    ELSIF (p_series_config->>'source') = 'document_series' THEN
      UPDATE public.document_series
      SET current_number = COALESCE((p_series_config->>'next_number')::int, 1) + 1,
          configs = jsonb_set(configs, '{quote,start_number}', to_jsonb(COALESCE((p_series_config->>'next_number')::int, 1) + 1))
      WHERE id = (p_series_config->>'legacy_row_id')::uuid;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'status', 'success',
    'quotation_id', v_quotation_id,
    'quotation_no', v_quotation_no,
    'items', v_inserted_items,
    'subtotal', v_subtotal,
    'total_tax', v_total_tax,
    'grand_total', v_grand_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_quotation(
  uuid, uuid, uuid, jsonb, text, text, date, text, text, text, text, text, text,
  text, text, integer, jsonb, text, boolean, numeric, numeric, numeric, boolean, boolean, jsonb, jsonb, jsonb
) TO authenticated;
