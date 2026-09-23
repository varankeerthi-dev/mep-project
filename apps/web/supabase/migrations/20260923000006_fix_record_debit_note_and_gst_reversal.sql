-- 20260923000006_fix_record_debit_note_and_gst_reversal.sql
-- Fix record_debit_note:
-- 1. Remove invalid purchase_vendors.org_id column reference (fix error 42703)
-- 2. Reverse Input GST proportionally (Cr 2204 CGST, Cr 2205 SGST, Cr 2206 IGST)
-- 3. Reverse Taxable Amount to appropriate item account (1410 Inventory Asset, 1610 Fixed Asset, 4000 Expense, or 5000)
-- 4. Automatically reverse stock in item_stock and log to material_logs in the same transaction

CREATE OR REPLACE FUNCTION public.record_debit_note(
  p_organisation_id uuid,
  p_vendor_id uuid,
  p_bill_id uuid DEFAULT NULL::uuid,
  p_dn_date date DEFAULT CURRENT_DATE,
  p_dn_type text DEFAULT 'Return'::text,
  p_reason text DEFAULT 'Purchase Return'::text,
  p_idempotency_key text DEFAULT NULL::text,
  p_items jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_bill RECORD;
  v_vendor RECORD;
  v_existing_dn RECORD;
  v_effective_idempotency_key TEXT;
  v_dn_id UUID;
  v_dn_number TEXT;
  v_item RECORD;
  v_mat_rec RECORD;
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
  v_cgst_account_id UUID;
  v_sgst_account_id UUID;
  v_igst_account_id UUID;
  v_item_gl_account_id UUID;
  v_journal_id UUID;
  v_warehouse_id UUID;
  v_stock_id UUID;
  v_current_stock NUMERIC;
  v_any_stock_reversed BOOLEAN := FALSE;
  v_result JSONB;
BEGIN
  -- A. Authentication & Tenant Authorization
  IF auth.uid() IS NULL AND current_setting('app.p0_test_running', true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.user_can_access_org(p_organisation_id) AND current_setting('app.p0_test_running', true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'Unauthorized organization access';
  END IF;

  IF p_vendor_id IS NULL THEN
    RAISE EXCEPTION 'Vendor ID is required';
  END IF;

  -- Period Lock Check
  IF EXISTS (
    SELECT 1 FROM public.financial_periods
    WHERE organisation_id = p_organisation_id
      AND is_closed = true
      AND COALESCE(p_dn_date, CURRENT_DATE) BETWEEN start_date AND end_date
  ) THEN
    RAISE EXCEPTION 'Cannot record debit note: financial period for date % is closed', COALESCE(p_dn_date, CURRENT_DATE);
  END IF;

  -- Validate vendor belongs to organization (Schema fix: purchase_vendors has organisation_id, not org_id)
  SELECT * INTO v_vendor
  FROM public.purchase_vendors
  WHERE id = p_vendor_id AND organisation_id = p_organisation_id;

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
    WHERE id = p_bill_id AND organisation_id = p_organisation_id
    FOR UPDATE;

    IF v_bill IS NULL THEN
      RAISE EXCEPTION 'Purchase bill not found or does not belong to organization';
    END IF;

    IF v_bill.vendor_id != p_vendor_id THEN
      RAISE EXCEPTION 'Purchase bill belongs to a different vendor than the supplied vendor';
    END IF;

    v_warehouse_id := v_bill.warehouse_id;
  END IF;

  -- D. State Jurisdiction for Tax Calculation
  SELECT state INTO v_org_state FROM public.organisations WHERE id = p_organisation_id;
  v_vendor_state := v_vendor.state;
  IF v_org_state IS NOT NULL AND v_vendor_state IS NOT NULL AND LOWER(TRIM(v_org_state)) != LOWER(TRIM(v_vendor_state)) THEN
    v_is_intrastate := FALSE;
  END IF;

  -- E. Server-Side Calculations for Line Items
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Debit note must contain at least one line item';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
    item_id UUID, item_name TEXT, hsn_code TEXT, quantity NUMERIC, rate NUMERIC, tax_percent NUMERIC
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

  -- H. Insert Journal Header
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

  -- Dr Accounts Payable (2100) for grand total
  v_ap_account_id := public.ensure_gl_account_exists(p_organisation_id, '2100', 'Sundry Creditors', 'Liability');
  INSERT INTO public.journal_entry_lines (
    journal_id, account_id, party_type, party_id, debit, credit, narration
  ) VALUES (
    v_journal_id, v_ap_account_id, 'vendor', p_vendor_id, v_grand_total, 0.00, 'AP Reduction via Debit Note'
  );
  PERFORM public.update_account_balance(v_ap_account_id, v_grand_total, 0.00);

  -- Fallback warehouse resolution for stock reduction if needed
  IF v_warehouse_id IS NULL THEN
    SELECT id INTO v_warehouse_id FROM public.warehouses
    WHERE organisation_id = p_organisation_id AND is_active = true
    ORDER BY is_default DESC, warehouse_purpose = 'main' DESC LIMIT 1;
  END IF;

  -- I. Iterate items: Insert Debit Note Items, Post Taxable GL, & Reduce Stock
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
    item_id UUID, item_name TEXT, hsn_code TEXT, quantity NUMERIC, rate NUMERIC, tax_percent NUMERIC
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
      dn_id, organisation_id, item_id, item_name, hsn_code, quantity, return_qty, rate,
      discount_amount, taxable_value, cgst_percent, cgst_amount,
      sgst_percent, sgst_amount, igst_percent, igst_amount, total_amount
    ) VALUES (
      v_dn_id, p_organisation_id, v_item.item_id, COALESCE(v_item.item_name, 'Item'), v_item.hsn_code, v_line_qty, v_line_qty, v_line_rate,
      0, v_line_taxable,
      CASE WHEN v_is_intrastate THEN v_line_tax_pct / 2.0 ELSE 0 END, v_line_cgst,
      CASE WHEN v_is_intrastate THEN v_line_tax_pct / 2.0 ELSE 0 END, v_line_sgst,
      CASE WHEN NOT v_is_intrastate THEN v_line_tax_pct ELSE 0 END, v_line_igst,
      v_line_total
    );

    -- Resolve GL account for item
    v_mat_rec := NULL;
    IF v_item.item_id IS NOT NULL THEN
      SELECT gl_classification, purchase_account_id, is_stockable
      INTO v_mat_rec
      FROM public.materials
      WHERE id = v_item.item_id;
    END IF;

    IF v_mat_rec.purchase_account_id IS NOT NULL THEN
      v_item_gl_account_id := v_mat_rec.purchase_account_id;
    ELSIF v_mat_rec.gl_classification = 'INVENTORY_ASSET' THEN
      v_item_gl_account_id := public.ensure_gl_account_exists(p_organisation_id, '1410', 'Inventory Asset', 'Asset');
    ELSIF v_mat_rec.gl_classification = 'FIXED_ASSET' THEN
      v_item_gl_account_id := public.ensure_gl_account_exists(p_organisation_id, '1610', 'Furniture and Equipment', 'Asset');
    ELSIF v_mat_rec.gl_classification = 'EXPENSE' THEN
      v_item_gl_account_id := public.ensure_gl_account_exists(p_organisation_id, '4000', 'Direct Expenses', 'Expense');
    ELSE
      v_item_gl_account_id := public.ensure_gl_account_exists(p_organisation_id, '5000', 'Purchase Returns', 'Expense');
    END IF;

    -- Cr Taxable value to item's purchase/inventory asset account
    INSERT INTO public.journal_entry_lines (
      journal_id, account_id, party_type, party_id, debit, credit, narration
    ) VALUES (
      v_journal_id, v_item_gl_account_id, 'vendor', p_vendor_id, 0.00, v_line_taxable,
      'Purchase Return - ' || COALESCE(v_item.item_name, 'Item')
    );
    PERFORM public.update_account_balance(v_item_gl_account_id, 0.00, v_line_taxable);

    -- Atomic Stock Reduction (if item is stockable and warehouse resolved)
    IF v_item.item_id IS NOT NULL AND (v_mat_rec.is_stockable = TRUE OR v_mat_rec.gl_classification = 'INVENTORY_ASSET') AND v_warehouse_id IS NOT NULL THEN
      SELECT id, current_stock INTO v_stock_id, v_current_stock
      FROM public.item_stock
      WHERE item_id = v_item.item_id AND warehouse_id = v_warehouse_id
      FOR UPDATE;

      IF v_stock_id IS NOT NULL THEN
        UPDATE public.item_stock
        SET current_stock = current_stock - v_line_qty, updated_at = NOW()
        WHERE id = v_stock_id;
      ELSE
        INSERT INTO public.item_stock (organisation_id, item_id, warehouse_id, current_stock)
        VALUES (p_organisation_id, v_item.item_id, v_warehouse_id, -v_line_qty);
      END IF;

      INSERT INTO public.material_logs (
        organisation_id, item_id, qty_received, qty_used, type, invoice_number, received_by, remarks, created_at
      ) VALUES (
        p_organisation_id, v_item.item_id, 0, v_line_qty, 'OUT', v_dn_number, auth.uid(),
        'Debit Note Purchase Return: ' || v_dn_number, NOW()
      );

      UPDATE public.debit_note_items SET stock_reversed = TRUE WHERE dn_id = v_dn_id AND item_id = v_item.item_id;
      v_any_stock_reversed := TRUE;
    END IF;
  END LOOP;

  -- J. Input GST Lines (Proportional Reversal)
  IF v_is_intrastate THEN
    IF v_total_cgst > 0 THEN
      v_cgst_account_id := public.ensure_gl_account_exists(p_organisation_id, '2204', 'CGST Input', 'Asset');
      INSERT INTO public.journal_entry_lines (
        journal_id, account_id, party_type, party_id, debit, credit, narration
      ) VALUES (
        v_journal_id, v_cgst_account_id, NULL, NULL, 0.00, v_total_cgst, 'Input CGST Reversal'
      );
      PERFORM public.update_account_balance(v_cgst_account_id, 0.00, v_total_cgst);
    END IF;

    IF v_total_sgst > 0 THEN
      v_sgst_account_id := public.ensure_gl_account_exists(p_organisation_id, '2205', 'SGST Input', 'Asset');
      INSERT INTO public.journal_entry_lines (
        journal_id, account_id, party_type, party_id, debit, credit, narration
      ) VALUES (
        v_journal_id, v_sgst_account_id, NULL, NULL, 0.00, v_total_sgst, 'Input SGST Reversal'
      );
      PERFORM public.update_account_balance(v_sgst_account_id, 0.00, v_total_sgst);
    END IF;
  ELSE
    IF v_total_igst > 0 THEN
      v_igst_account_id := public.ensure_gl_account_exists(p_organisation_id, '2206', 'IGST Input', 'Asset');
      INSERT INTO public.journal_entry_lines (
        journal_id, account_id, party_type, party_id, debit, credit, narration
      ) VALUES (
        v_journal_id, v_igst_account_id, NULL, NULL, 0.00, v_total_igst, 'Input IGST Reversal'
      );
      PERFORM public.update_account_balance(v_igst_account_id, 0.00, v_total_igst);
    END IF;
  END IF;

  -- K. Update Debit Note Header Status
  IF v_any_stock_reversed THEN
    UPDATE public.debit_notes SET stock_reversed = TRUE, updated_at = NOW() WHERE id = v_dn_id;
  END IF;

  -- L. Vendor Balance Recalculation inside the same transaction
  PERFORM public.recalc_vendor_balance(p_vendor_id, p_organisation_id);

  v_result := jsonb_build_object(
    'status', 'success',
    'dn_id', v_dn_id,
    'dn_number', v_dn_number,
    'total_amount', v_grand_total,
    'taxable_amount', v_total_taxable,
    'cgst_amount', v_total_cgst,
    'sgst_amount', v_total_sgst,
    'igst_amount', v_total_igst,
    'bill_id', p_bill_id,
    'journal_id', v_journal_id,
    'stock_reversed', v_any_stock_reversed
  );

  RETURN v_result;
END;
$function$;
