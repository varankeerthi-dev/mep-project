-- Fix-forward for 20260929000004 (record_purchase_order, update_purchase_order_draft):
-- item_name is the MATERIAL name (what the line is); description is the free
-- user text from the pen-icon editor (what the line says). The recordsets
-- carried no description field and both INSERTs wrote item_name into the
-- description column, so user-written descriptions were silently replaced by
-- the material name on every save. This adds `description text` to all four
-- item recordsets and persists v_item.description. Nothing else changes.
-- Applied live 2026-10-01 as purchase_order_items_description_column.
CREATE OR REPLACE FUNCTION public.record_purchase_order(
  p_organisation_id uuid,
  p_vendor_id uuid,
  p_po_date date DEFAULT CURRENT_DATE,
  p_delivery_date date DEFAULT NULL::date,
  p_reference_no text DEFAULT NULL::text,
  p_terms_conditions text DEFAULT NULL::text,
  p_delivery_location text DEFAULT NULL::text,
  p_internal_notes text DEFAULT NULL::text,
  p_currency text DEFAULT 'INR'::text,
  p_exchange_rate numeric DEFAULT 1.0,
  p_project_id uuid DEFAULT NULL::uuid,
  p_extra_discount_percent numeric DEFAULT 0,
  p_extra_discount_amount numeric DEFAULT 0,
  p_round_off_enabled boolean DEFAULT true,
  p_status text DEFAULT 'Draft',
  p_authorized_signatory_id uuid DEFAULT NULL::uuid,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_idempotency_key text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
DECLARE
  v_vendor RECORD;
  v_po_id UUID;
  v_po_number TEXT;
  v_created_by UUID;
  v_effective_key TEXT;
  v_existing RECORD;
  v_item RECORD;
  v_sr INT := 1;

  v_org_state TEXT;
  v_vendor_state TEXT;
  v_is_intrastate BOOLEAN := TRUE;

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
  v_extra_discount NUMERIC(15,2) := 0;
  v_grand_total NUMERIC(15,2) := 0;
  v_grand_total_inr NUMERIC(15,2) := 0;
  v_round_off NUMERIC(15,2) := 0;
  v_base_total NUMERIC(15,2) := 0;
BEGIN
  -- ---- A. Authentication & tenant authorisation -------------------------
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organization access';
  END IF;

  -- ---- B. Validation ------------------------------------------------------
  IF p_vendor_id IS NULL THEN
    RAISE EXCEPTION 'Vendor ID is required';
  END IF;

  SELECT * INTO v_vendor
  FROM public.purchase_vendors
  WHERE id = p_vendor_id AND organisation_id = p_organisation_id;
  IF v_vendor.id IS NULL THEN
    RAISE EXCEPTION 'Vendor not found or does not belong to organization';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Purchase order must contain at least one line item';
  END IF;

  -- Only Draft may be created implicitly. Anything further is an explicit,
  -- deliberate request, never a side effect of saving a form.
  IF p_status IS NULL OR LOWER(p_status) NOT IN ('draft', 'pending', 'pending approval') THEN
    RAISE EXCEPTION 'New purchase orders must be created as Draft (requested: %)', COALESCE(p_status, 'null');
  END IF;

  -- ---- C. Idempotency ----------------------------------------------------
  v_effective_key := NULLIF(TRIM(p_idempotency_key), '');
  IF v_effective_key IS NOT NULL THEN
    SELECT id, po_number, total_amount, status INTO v_existing
    FROM public.purchase_orders
    WHERE organisation_id = p_organisation_id AND idempotency_key = v_effective_key
    LIMIT 1;
    IF v_existing.id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'status', 'success',
        'po_id', v_existing.id,
        'po_number', v_existing.po_number,
        'total_amount', v_existing.total_amount,
        'doc_status', v_existing.status,
        'idempotent_replayed', true
      );
    END IF;
  END IF;

  -- ---- D. GST jurisdiction (server decides, not the client) --------------
  SELECT state INTO v_org_state FROM public.organisations WHERE id = p_organisation_id;
  v_vendor_state := v_vendor.state;
  IF v_org_state IS NOT NULL AND v_vendor_state IS NOT NULL
     AND LOWER(TRIM(v_org_state)) <> LOWER(TRIM(v_vendor_state)) THEN
    v_is_intrastate := FALSE;
  END IF;

  -- ---- E. Recompute every line from quantity/rate/discount/tax ----------
  -- Client-supplied line totals are ignored, matching record_purchase_bill.
  FOR v_item IN
    SELECT * FROM jsonb_to_recordset(p_items) AS x(
      item_id uuid, variant_id uuid, item_name text, description text, hsn_code text,
      quantity numeric, unit text, rate numeric,
      discount_percent numeric, discount_amount numeric, discount_category_id uuid,
      tax_percent numeric, make text, variant text, notes text
    )
  LOOP
    v_line_qty := COALESCE(v_item.quantity, 0);
    v_line_rate := COALESCE(v_item.rate, 0);
    v_line_discount := COALESCE(v_item.discount_amount, 0);
    v_line_tax_pct := COALESCE(v_item.tax_percent, 0);

    IF v_line_qty <= 0 THEN
      RAISE EXCEPTION 'Line item quantity must be greater than zero (Item: %)', COALESCE(v_item.item_name, 'Unknown');
    END IF;
    IF v_line_rate < 0 THEN
      RAISE EXCEPTION 'Line item rate cannot be negative (Item: %)', COALESCE(v_item.item_name, 'Unknown');
    END IF;

    v_line_taxable := ROUND((v_line_qty * v_line_rate) - v_line_discount, 2);
    IF v_line_taxable < 0 THEN
      RAISE EXCEPTION 'Line item discount cannot exceed gross amount (Item: %)', COALESCE(v_item.item_name, 'Unknown');
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

  -- Header-level extra discount, applied after line discounts.
  v_extra_discount := ROUND(
    (v_total_taxable * COALESCE(p_extra_discount_percent, 0) / 100.0)
    + COALESCE(p_extra_discount_amount, 0)
  , 2);
  IF v_extra_discount < 0 THEN
    RAISE EXCEPTION 'Additional discount cannot be negative';
  END IF;

  v_total_taxable := GREATEST(v_total_taxable - v_extra_discount, 0);
  v_base_total := v_total_taxable + v_total_cgst + v_total_sgst + v_total_igst;

  IF COALESCE(p_round_off_enabled, true) THEN
    v_round_off := ROUND(ROUND(v_base_total) - v_base_total, 2);
  END IF;

  v_grand_total := ROUND(v_base_total + v_round_off, 2);
  v_grand_total_inr := ROUND(v_grand_total * COALESCE(p_exchange_rate, 1.0), 2);

  -- ---- F. Persist --------------------------------------------------------
  v_created_by := auth.uid();
  v_po_number := public.purchase_order_next_number(p_organisation_id);

  BEGIN
    INSERT INTO public.purchase_orders (
      organisation_id, vendor_id, po_number, po_date, delivery_date,
      reference_no, terms_conditions, internal_notes, delivery_location,
      currency, exchange_rate, project_id,
      extra_discount_percent, extra_discount_amount, round_off, round_off_enabled,
      subtotal, discount_amount, taxable_amount,
      cgst_amount, sgst_amount, igst_amount,
      total_amount, total_amount_inr,
      approval_status, status, idempotency_key, authorized_signatory_id, created_by, created_at, updated_at
    ) VALUES (
      p_organisation_id, p_vendor_id, v_po_number, COALESCE(p_po_date, CURRENT_DATE), p_delivery_date,
      p_reference_no, p_terms_conditions, p_internal_notes, p_delivery_location,
      COALESCE(p_currency, 'INR'), COALESCE(p_exchange_rate, 1.0), p_project_id,
      COALESCE(p_extra_discount_percent, 0), v_extra_discount, v_round_off, COALESCE(p_round_off_enabled, false),
      v_subtotal, v_total_discount, v_total_taxable,
      v_total_cgst, v_total_sgst, v_total_igst,
      v_grand_total, v_grand_total_inr,
      'Draft', 'Draft', v_effective_key, p_authorized_signatory_id, v_created_by, NOW(), NOW()
    ) RETURNING id INTO v_po_id;
  EXCEPTION WHEN unique_violation THEN
    IF v_effective_key IS NOT NULL THEN
      SELECT id, po_number, total_amount, status INTO v_existing
      FROM public.purchase_orders
      WHERE organisation_id = p_organisation_id AND idempotency_key = v_effective_key;
      IF v_existing.id IS NOT NULL THEN
        RETURN jsonb_build_object(
          'status', 'success',
          'po_id', v_existing.id,
          'po_number', v_existing.po_number,
          'total_amount', v_existing.total_amount,
          'doc_status', v_existing.status,
          'idempotent_replayed', true
        );
      END IF;
    END IF;
    RAISE;
  END;

  -- ---- G. Line items -----------------------------------------------------
  v_sr := 1;
  FOR v_item IN
    SELECT * FROM jsonb_to_recordset(p_items) AS x(
      item_id uuid, variant_id uuid, item_name text, description text, hsn_code text,
      quantity numeric, unit text, rate numeric,
      discount_percent numeric, discount_amount numeric, discount_category_id uuid,
      tax_percent numeric, make text, variant text, notes text
    )
  LOOP
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

    INSERT INTO public.purchase_order_items (
      organisation_id, po_id, sr,
      item_id, variant_id, item_name, description, hsn_code,
      quantity, unit, rate, discount_percent, discount_amount, discount_category_id, taxable_value,
      cgst_percent, cgst_amount, sgst_percent, sgst_amount, igst_percent, igst_amount,
      total_amount, total_amount_inr, received_qty, balance_qty,
      make, variant, notes
    ) VALUES (
      p_organisation_id, v_po_id, v_sr,
      v_item.item_id, v_item.variant_id, COALESCE(v_item.item_name, 'Item'), v_item.description, v_item.hsn_code,
      v_line_qty, COALESCE(v_item.unit, 'Nos'), v_line_rate,
      COALESCE(v_item.discount_percent, 0), v_line_discount, v_item.discount_category_id, v_line_taxable,
      CASE WHEN v_is_intrastate THEN v_line_tax_pct / 2.0 ELSE 0 END, v_line_cgst,
      CASE WHEN v_is_intrastate THEN v_line_tax_pct / 2.0 ELSE 0 END, v_line_sgst,
      CASE WHEN NOT v_is_intrastate THEN v_line_tax_pct ELSE 0 END, v_line_igst,
      v_line_total, ROUND(v_line_total * COALESCE(p_exchange_rate, 1.0), 2),
      0, v_line_qty,
      v_item.make, v_item.variant, v_item.notes
    );
    v_sr := v_sr + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'status', 'success',
    'po_id', v_po_id,
    'po_number', v_po_number,
    'subtotal', v_subtotal,
    'discount_amount', v_total_discount,
    'taxable_amount', v_total_taxable,
    'cgst_amount', v_total_cgst,
    'sgst_amount', v_total_sgst,
    'igst_amount', v_total_igst,
    'total_amount', v_grand_total,
    'total_amount_inr', v_grand_total_inr,
    'round_off', v_round_off,
    'doc_status', 'Draft',
    'is_inter_state', NOT v_is_intrastate,
    'idempotent_replayed', false
  );
END;
$function$;


-- ---------------------------------------------------------------------------
-- update_purchase_order_draft — same description split (see above).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_purchase_order_draft(
  p_po_id uuid,
  p_organisation_id uuid,
  p_vendor_id uuid,
  p_po_date date DEFAULT NULL::date,
  p_delivery_date date DEFAULT NULL::date,
  p_reference_no text DEFAULT NULL::text,
  p_terms_conditions text DEFAULT NULL::text,
  p_delivery_location text DEFAULT NULL::text,
  p_internal_notes text DEFAULT NULL::text,
  p_currency text DEFAULT 'INR'::text,
  p_exchange_rate numeric DEFAULT 1.0,
  p_project_id uuid DEFAULT NULL::uuid,
  p_extra_discount_percent numeric DEFAULT 0,
  p_extra_discount_amount numeric DEFAULT 0,
  p_round_off_enabled boolean DEFAULT true,
  p_authorized_signatory_id uuid DEFAULT NULL::uuid,
  p_items jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
DECLARE
  v_po RECORD;
  v_item RECORD;
  v_sr INT := 1;
  v_org_state TEXT;
  v_vendor_state TEXT;
  v_is_intrastate BOOLEAN := TRUE;
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
  v_extra_discount NUMERIC(15,2) := 0;
  v_grand_total NUMERIC(15,2) := 0;
  v_grand_total_inr NUMERIC(15,2) := 0;
  v_round_off NUMERIC(15,2) := 0;
  v_base_total NUMERIC(15,2) := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organization access';
  END IF;

  SELECT * INTO v_po
  FROM public.purchase_orders
  WHERE id = p_po_id AND organisation_id = p_organisation_id
  FOR UPDATE;

  IF v_po.id IS NULL THEN
    RAISE EXCEPTION 'Purchase order not found or unauthorized';
  END IF;

  IF LOWER(COALESCE(v_po.status, '')) <> 'draft' THEN
    RAISE EXCEPTION 'Only Draft purchase orders can be edited. This PO is "%". Use cancellation instead.', v_po.status;
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Purchase order must contain at least one line item';
  END IF;

  SELECT state INTO v_org_state FROM public.organisations WHERE id = p_organisation_id;
  SELECT state INTO v_vendor_state FROM public.purchase_vendors
  WHERE id = COALESCE(p_vendor_id, v_po.vendor_id);
  IF v_org_state IS NOT NULL AND v_vendor_state IS NOT NULL
     AND LOWER(TRIM(v_org_state)) <> LOWER(TRIM(v_vendor_state)) THEN
    v_is_intrastate := FALSE;
  END IF;

  FOR v_item IN
    SELECT * FROM jsonb_to_recordset(p_items) AS x(
      item_id uuid, variant_id uuid, item_name text, description text, hsn_code text,
      quantity numeric, unit text, rate numeric,
      discount_percent numeric, discount_amount numeric, discount_category_id uuid,
      tax_percent numeric, make text, variant text, notes text
    )
  LOOP
    v_line_qty := COALESCE(v_item.quantity, 0);
    v_line_rate := COALESCE(v_item.rate, 0);
    v_line_discount := COALESCE(v_item.discount_amount, 0);
    v_line_tax_pct := COALESCE(v_item.tax_percent, 0);

    IF v_line_qty <= 0 THEN
      RAISE EXCEPTION 'Line item quantity must be greater than zero (Item: %)', COALESCE(v_item.item_name, 'Unknown');
    END IF;

    v_line_taxable := ROUND((v_line_qty * v_line_rate) - v_line_discount, 2);
    IF v_line_taxable < 0 THEN
      RAISE EXCEPTION 'Line item discount cannot exceed gross amount (Item: %)', COALESCE(v_item.item_name, 'Unknown');
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

  v_extra_discount := ROUND(
    (v_total_taxable * COALESCE(p_extra_discount_percent, 0) / 100.0)
    + COALESCE(p_extra_discount_amount, 0)
  , 2);
  v_total_taxable := GREATEST(v_total_taxable - v_extra_discount, 0);
  v_base_total := v_total_taxable + v_total_cgst + v_total_sgst + v_total_igst;
  IF COALESCE(p_round_off_enabled, true) THEN
    v_round_off := ROUND(ROUND(v_base_total) - v_base_total, 2);
  END IF;
  v_grand_total := ROUND(v_base_total + v_round_off, 2);
  v_grand_total_inr := ROUND(v_grand_total * COALESCE(p_exchange_rate, 1.0), 2);

  UPDATE public.purchase_orders SET
    vendor_id = COALESCE(p_vendor_id, v_po.vendor_id),
    po_date = COALESCE(p_po_date, v_po.po_date),
    delivery_date = p_delivery_date,
    reference_no = p_reference_no,
    terms_conditions = p_terms_conditions,
    internal_notes = p_internal_notes,
    delivery_location = p_delivery_location,
    currency = COALESCE(p_currency, v_po.currency),
    exchange_rate = COALESCE(p_exchange_rate, v_po.exchange_rate),
    project_id = p_project_id,
    authorized_signatory_id = p_authorized_signatory_id,
    extra_discount_percent = COALESCE(p_extra_discount_percent, 0),
    extra_discount_amount = v_extra_discount,
    round_off = v_round_off,
    round_off_enabled = COALESCE(p_round_off_enabled, false),
    subtotal = v_subtotal,
    discount_amount = v_total_discount,
    taxable_amount = v_total_taxable,
    cgst_amount = v_total_cgst,
    sgst_amount = v_total_sgst,
    igst_amount = v_total_igst,
    total_amount = v_grand_total,
    total_amount_inr = v_grand_total_inr,
    updated_at = NOW()
  WHERE id = p_po_id;

  -- Replace lines. Safe because the PO is Draft (no receipts, no bills can exist).
  DELETE FROM public.purchase_order_items WHERE po_id = p_po_id;

  v_sr := 1;
  FOR v_item IN
    SELECT * FROM jsonb_to_recordset(p_items) AS x(
      item_id uuid, variant_id uuid, item_name text, description text, hsn_code text,
      quantity numeric, unit text, rate numeric,
      discount_percent numeric, discount_amount numeric, discount_category_id uuid,
      tax_percent numeric, make text, variant text, notes text
    )
  LOOP
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

    INSERT INTO public.purchase_order_items (
      organisation_id, po_id, sr,
      item_id, variant_id, item_name, description, hsn_code,
      quantity, unit, rate, discount_percent, discount_amount, discount_category_id, taxable_value,
      cgst_percent, cgst_amount, sgst_percent, sgst_amount, igst_percent, igst_amount,
      total_amount, total_amount_inr, received_qty, balance_qty,
      make, variant, notes
    ) VALUES (
      p_organisation_id, p_po_id, v_sr,
      v_item.item_id, v_item.variant_id, COALESCE(v_item.item_name, 'Item'), v_item.description, v_item.hsn_code,
      v_line_qty, COALESCE(v_item.unit, 'Nos'), v_line_rate,
      COALESCE(v_item.discount_percent, 0), v_line_discount, v_item.discount_category_id, v_line_taxable,
      CASE WHEN v_is_intrastate THEN v_line_tax_pct / 2.0 ELSE 0 END, v_line_cgst,
      CASE WHEN v_is_intrastate THEN v_line_tax_pct / 2.0 ELSE 0 END, v_line_sgst,
      CASE WHEN NOT v_is_intrastate THEN v_line_tax_pct ELSE 0 END, v_line_igst,
      v_line_total, ROUND(v_line_total * COALESCE(p_exchange_rate, 1.0), 2),
      0, v_line_qty,
      v_item.make, v_item.variant, v_item.notes
    );
    v_sr := v_sr + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'status', 'success',
    'po_id', p_po_id,
    'po_number', v_po.po_number,
    'subtotal', v_subtotal,
    'discount_amount', v_total_discount,
    'taxable_amount', v_total_taxable,
    'cgst_amount', v_total_cgst,
    'sgst_amount', v_total_sgst,
    'igst_amount', v_total_igst,
    'total_amount', v_grand_total,
    'total_amount_inr', v_grand_total_inr,
    'round_off', v_round_off,
    'doc_status', 'Draft',
    'is_inter_state', NOT v_is_intrastate
  );
END;
$function$;
