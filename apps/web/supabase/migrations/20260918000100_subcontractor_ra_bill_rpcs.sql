-- RA Bill Generation RPC
-- Generates subcontractor invoices from approved measurement sheets with:
-- - cumulative billed qty vs measured qty validation
-- - retention, TDS, advance adjustment
-- - bill status flow: Draft → Submitted → Approved → Paid

CREATE OR REPLACE FUNCTION public.generate_ra_bill(
  p_organisation_id uuid,
  p_work_order_id uuid,
  p_measurement_sheet_id uuid,
  p_invoice_date date DEFAULT NULL::date,
  p_remarks text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_work_order RECORD;
  v_measurement RECORD;
  v_invoice_no text;
  v_next_seq int;
  v_gross_amount numeric := 0;
  v_subtotal numeric := 0;
  v_tds_amount numeric := 0;
  v_retention_amount numeric := 0;
  v_advance_amount numeric := 0;
  v_net_amount numeric := 0;
  v_cgst_amount numeric := 0;
  v_sgst_amount numeric := 0;
  v_igst_amount numeric := 0;
  v_cumulative_billed_qty numeric := 0;
  v_measured_qty numeric := 0;
  v_billed_qty numeric := 0;
  v_invoice_id uuid;
  v_existing_draft_count int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organization access';
  END IF;

  -- Get work order
  SELECT * INTO v_work_order FROM public.subcontractor_work_orders
  WHERE id = p_work_order_id AND organisation_id = p_organisation_id;

  IF v_work_order IS NULL THEN
    RAISE EXCEPTION 'Work order not found or unauthorized';
  END IF;

  -- Get measurement sheet
  SELECT * INTO v_measurement FROM public.subcontractor_measurement_sheets
  WHERE id = p_measurement_sheet_id AND work_order_id = p_work_order_id AND organisation_id = p_organisation_id;

  IF v_measurement IS NULL THEN
    RAISE EXCEPTION 'Measurement sheet not found or unauthorized';
  END IF;

  IF v_measurement.status != 'Approved' THEN
    RAISE EXCEPTION 'Only approved measurement sheets can be billed';
  END IF;

  -- Calculate measured value from line items
  IF v_measurement.line_items IS NOT NULL AND jsonb_array_length(v_measurement.line_items) > 0 THEN
    SELECT COALESCE(SUM((li->>'actual_qty')::numeric * (li->>'rate')::numeric), 0)
    INTO v_gross_amount
    FROM jsonb_array_elements(v_measurement.line_items) AS li;
    
    SELECT COALESCE(SUM((li->>'actual_qty')::numeric), 0)
    INTO v_measured_qty
    FROM jsonb_array_elements(v_measurement.line_items) AS li;
  ELSE
    v_gross_amount := v_measurement.actual_value;
    v_measured_qty := v_measurement.actual_value;
  END IF;

  v_subtotal := v_gross_amount;

  -- Calculate TDS
  IF v_work_order.tax_type = 'TDS' AND v_work_order.tds_percent IS NOT NULL THEN
    v_tds_amount := v_subtotal * (v_work_order.tds_percent / 100);
  END IF;

  -- Calculate retention
  IF v_work_order.retention_held AND v_work_order.retention_percent IS NOT NULL THEN
    v_retention_amount := v_subtotal * (v_work_order.retention_percent / 100);
  END IF;

  -- Calculate advance recovery (if advance was paid)
  IF v_work_order.advance_amount IS NOT NULL AND v_work_order.advance_amount > 0 THEN
    -- Recover advance proportionally from this bill
    v_advance_amount := LEAST(
      v_work_order.advance_amount,
      v_subtotal * 0.1
    );
  END IF;

  -- Calculate net amount
  v_net_amount := v_subtotal - v_tds_amount - v_retention_amount - v_advance_amount;

  IF v_net_amount < 0 THEN
    v_net_amount := 0;
  END IF;

  -- Get cumulative billed qty for this WO (excluding drafts)
  SELECT COALESCE(SUM(cumulative_billed_qty), 0)
  INTO v_cumulative_billed_qty
  FROM public.subcontractor_invoices
  WHERE work_order_id = p_work_order_id
    AND status NOT IN ('Draft', 'Cancelled')
    AND id != COALESCE(p_measurement_sheet_id, '');

  v_billed_qty := v_measured_qty;
  
  -- Prevent over-billing: if cumulative billed + this bill > measured, cap it
  IF v_cumulative_billed_qty + v_billed_qty > v_measured_qty THEN
    v_billed_qty := GREATEST(0, v_measured_qty - v_cumulative_billed_qty);
    IF v_billed_qty = 0 THEN
      RAISE EXCEPTION 'Work order is already fully billed. Measured: %, Cumulative billed: %', v_measured_qty, v_cumulative_billed_qty;
    END IF;
  END IF;

  -- Check for existing draft invoices for this measurement sheet
  SELECT COUNT(*) INTO v_existing_draft_count
  FROM public.subcontractor_invoices
  WHERE work_order_id = p_work_order_id
    AND measurement_sheet_id = p_measurement_sheet_id
    AND status = 'Draft';

  IF v_existing_draft_count > 0 THEN
    RAISE EXCEPTION 'A draft invoice already exists for this measurement sheet';
  END IF;

  -- Generate invoice number
  SELECT COALESCE(MAX(
    CASE
      WHEN invoice_no ~ '^RA/[0-9]+$' THEN (regexp_match(invoice_no, '^RA/([0-9]+)$'))[1]::INT
      ELSE 0
    END
  ), 0) + 1 INTO v_next_seq
  FROM public.subcontractor_invoices
  WHERE work_order_id = p_work_order_id;

  v_invoice_no := 'RA/' || LPAD(v_next_seq::TEXT, 3, '0');

  -- Create invoice
  INSERT INTO public.subcontractor_invoices (
    organisation_id, subcontractor_id, work_order_id, invoice_no, invoice_date,
    amount, subtotal, gross_amount, net_amount, tax_type,
    cgst_percent, sgst_percent, igst_percent,
    cgst_amount, sgst_amount, igst_amount,
    tds_percent, tds_amount,
    retention_percent, retention_amount,
    advance_percent, advance_amount,
    billed_qty, measured_qty, cumulative_billed_qty,
    measurement_sheet_id, status, remarks,
    is_final_invoice, work_order_version_id
  ) VALUES (
    p_organisation_id, v_work_order.subcontractor_id, p_work_order_id, v_invoice_no, COALESCE(p_invoice_date, CURRENT_DATE),
    v_net_amount, v_subtotal, v_gross_amount, v_net_amount, v_work_order.tax_type,
    0, 0, 0,
    v_cgst_amount, v_sgst_amount, v_igst_amount,
    COALESCE(v_work_order.tds_percent, 0), v_tds_amount,
    COALESCE(v_work_order.retention_percent, 0), v_retention_amount,
    COALESCE(v_work_order.advance_percent, 0), v_advance_amount,
    v_billed_qty, v_measured_qty, v_cumulative_billed_qty + v_billed_qty,
    p_measurement_sheet_id, 'Draft', p_remarks,
    false, v_work_order.current_version_id
  )
  RETURNING id INTO v_invoice_id;

  RETURN jsonb_build_object(
    'status', 'success',
    'invoice_id', v_invoice_id,
    'invoice_no', v_invoice_no,
    'gross_amount', v_gross_amount,
    'tds_amount', v_tds_amount,
    'retention_amount', v_retention_amount,
    'advance_amount', v_advance_amount,
    'net_amount', v_net_amount,
    'billed_qty', v_billed_qty,
    'measured_qty', v_measured_qty,
    'cumulative_billed_qty', v_cumulative_billed_qty + v_billed_qty
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.generate_ra_bill(uuid, uuid, uuid, date, text) TO authenticated;


-- Update invoice status RPC
CREATE OR REPLACE FUNCTION public.update_invoice_status(
  p_invoice_id uuid,
  p_organisation_id uuid,
  p_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_invoice RECORD;
  v_now timestamptz := NOW();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organization access';
  END IF;

  SELECT * INTO v_invoice FROM public.subcontractor_invoices
  WHERE id = p_invoice_id AND organisation_id = p_organisation_id;

  IF v_invoice IS NULL THEN
    RAISE EXCEPTION 'Invoice not found or unauthorized';
  END IF;

  -- Validate status transition
  IF v_invoice.status = 'Paid' AND p_status != 'Paid' THEN
    RAISE EXCEPTION 'Paid invoices cannot be reverted';
  END IF;

  IF v_invoice.status = 'Cancelled' AND p_status != 'Cancelled' THEN
    RAISE EXCEPTION 'Cancelled invoices cannot be modified';
  END IF;

  -- Update timestamps based on status
  IF p_status = 'Approved' AND v_invoice.status != 'Approved' THEN
    UPDATE public.subcontractor_invoices SET
      status = p_status,
      approved_at = v_now,
      approved_by = auth.uid(),
      updated_at = v_now
    WHERE id = p_invoice_id;
  ELSIF p_status = 'Paid' AND v_invoice.status != 'Paid' THEN
    UPDATE public.subcontractor_invoices SET
      status = p_status,
      paid_at = v_now,
      updated_at = v_now
    WHERE id = p_invoice_id;
  ELSE
    UPDATE public.subcontractor_invoices SET
      status = p_status,
      updated_at = v_now
    WHERE id = p_invoice_id;
  END IF;

  RETURN jsonb_build_object('status', 'success', 'invoice_id', p_invoice_id, 'new_status', p_status);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.update_invoice_status(uuid, uuid, text) TO authenticated;


-- Finalize RA bill (lock from further edits)
CREATE OR REPLACE FUNCTION public.finalize_ra_bill(
  p_invoice_id uuid,
  p_organisation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_invoice RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organization access';
  END IF;

  SELECT * INTO v_invoice FROM public.subcontractor_invoices
  WHERE id = p_invoice_id AND organisation_id = p_organisation_id;

  IF v_invoice IS NULL THEN
    RAISE EXCEPTION 'Invoice not found or unauthorized';
  END IF;

  IF v_invoice.status != 'Approved' THEN
    RAISE EXCEPTION 'Only approved invoices can be finalized';
  END IF;

  UPDATE public.subcontractor_invoices SET
    is_final_invoice = true,
    updated_at = NOW()
  WHERE id = p_invoice_id;

  RETURN jsonb_build_object('status', 'success', 'invoice_id', p_invoice_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.finalize_ra_bill(uuid, uuid) TO authenticated;
