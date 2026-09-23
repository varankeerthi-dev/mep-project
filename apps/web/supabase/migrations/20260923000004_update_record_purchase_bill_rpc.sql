-- Migration: 20260923000004_update_record_purchase_bill_rpc.sql
-- Description: Update record_purchase_bill RPC to split Input GST (2204/2205/2206), support Zoho-like per-item account overrides, post by item classification, and create fixed_assets records.

BEGIN;

CREATE OR REPLACE FUNCTION public.record_purchase_bill(
  p_organisation_id uuid,
  p_vendor_id uuid,
  p_po_id uuid DEFAULT NULL::uuid,
  p_bill_number text DEFAULT NULL::text,
  p_vendor_invoice_no text DEFAULT NULL::text,
  p_bill_date date DEFAULT NULL::date,
  p_due_date date DEFAULT NULL::date,
  p_currency text DEFAULT 'INR'::text,
  p_exchange_rate numeric DEFAULT 1.0,
  p_warehouse_id uuid DEFAULT NULL::uuid,
  p_project_site_id uuid DEFAULT NULL::uuid,
  p_direct_supply_to_site boolean DEFAULT false,
  p_site_address text DEFAULT NULL::text,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_idempotency_key text DEFAULT NULL::text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_vendor RECORD;
  v_po RECORD;
  v_existing_bill RECORD;
  v_effective_idempotency_key TEXT;
  v_bill_id UUID;
  v_bill_number TEXT;
  v_bill_item_id UUID;
  v_item RECORD;
  v_mat RECORD;

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

  v_ap_account_id UUID;
  v_cgst_input_id UUID;
  v_sgst_input_id UUID;
  v_igst_input_id UUID;
  v_line_account_id UUID;
  v_journal_id UUID;
  v_asset_code TEXT;
  v_total_debit NUMERIC(15,2);
  v_total_credit NUMERIC(15,2);
  v_result JSONB;
BEGIN
  -- A. Authentication & Tenant Authorization
  IF auth.uid() IS NOT NULL AND NOT public.user_can_access_org(p_organisation_id) THEN
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
    item_id UUID, material_id UUID, item_name TEXT, batch_no TEXT, quantity NUMERIC, unit TEXT,
    rate NUMERIC, discount_amount NUMERIC, tax_percent NUMERIC
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

  -- F. Insert Purchase Bill Header
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

  -- G. Fetch Control & GST Accounts
  SELECT id INTO v_ap_account_id
  FROM public.accounts
  WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id)
    AND account_code = '2100'
  LIMIT 1;

  IF v_ap_account_id IS NULL THEN
    v_ap_account_id := public.ensure_gl_account_exists(p_organisation_id, '2100', 'Sundry Creditors', 'Liability');
  END IF;

  IF v_total_cgst > 0 THEN
    SELECT id INTO v_cgst_input_id FROM public.accounts WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id) AND account_code = '2204' LIMIT 1;
    IF v_cgst_input_id IS NULL THEN
      v_cgst_input_id := public.ensure_gl_account_exists(p_organisation_id, '2204', 'CGST Input', 'Liability');
    END IF;
  END IF;

  IF v_total_sgst > 0 THEN
    SELECT id INTO v_sgst_input_id FROM public.accounts WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id) AND account_code = '2205' LIMIT 1;
    IF v_sgst_input_id IS NULL THEN
      v_sgst_input_id := public.ensure_gl_account_exists(p_organisation_id, '2205', 'SGST Input', 'Liability');
    END IF;
  END IF;

  IF v_total_igst > 0 THEN
    SELECT id INTO v_igst_input_id FROM public.accounts WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id) AND account_code = '2206' LIMIT 1;
    IF v_igst_input_id IS NULL THEN
      v_igst_input_id := public.ensure_gl_account_exists(p_organisation_id, '2206', 'IGST Input', 'Liability');
    END IF;
  END IF;

  -- H. Create Journal Header
  INSERT INTO public.journal_entries (
    company_id, organisation_id, voucher_no, voucher_date, voucher_type,
    narration, status, created_by
  ) VALUES (
    p_organisation_id, p_organisation_id,
    v_bill_number,
    COALESCE(p_bill_date, CURRENT_DATE),
    'Purchase',
    'Purchase Bill - ' || v_bill_number || COALESCE(' (' || v_vendor.company_name || ')', ''),
    'Posted',
    auth.uid()
  ) RETURNING id INTO v_journal_id;

  -- I. Insert Items, Resolve Accounts, and Post Debits
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
    item_id UUID, material_id UUID, item_name TEXT, batch_no TEXT, quantity NUMERIC, unit TEXT,
    rate NUMERIC, discount_amount NUMERIC, tax_percent NUMERIC
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

    -- Insert Purchase Bill Item
    INSERT INTO public.purchase_bill_items (
      bill_id, organisation_id, item_id, item_name, batch_no, quantity, unit,
      rate, discount_amount, taxable_value, cgst_percent, cgst_amount,
      sgst_percent, sgst_amount, igst_percent, igst_amount, total_amount
    ) VALUES (
      v_bill_id, p_organisation_id, COALESCE(v_item.material_id, v_item.item_id), COALESCE(v_item.item_name, 'Item'), v_item.batch_no, v_line_qty, COALESCE(v_item.unit, 'Nos'),
      v_line_rate, v_line_discount, v_line_taxable,
      CASE WHEN v_is_intrastate THEN v_line_tax_pct / 2.0 ELSE 0 END, v_line_cgst,
      CASE WHEN v_is_intrastate THEN v_line_tax_pct / 2.0 ELSE 0 END, v_line_sgst,
      CASE WHEN NOT v_is_intrastate THEN v_line_tax_pct ELSE 0 END, v_line_igst,
      v_line_total
    ) RETURNING id INTO v_bill_item_id;

    -- Lookup Material Master
    SELECT * INTO v_mat 
    FROM public.materials 
    WHERE id = COALESCE(v_item.material_id, v_item.item_id);

    -- Account Resolution Hierarchy
    v_line_account_id := NULL;

    -- 1. Zoho-style per-item purchase account override
    IF v_mat.id IS NOT NULL AND v_mat.purchase_account_id IS NOT NULL THEN
      v_line_account_id := v_mat.purchase_account_id;
    END IF;

    -- 2. Derived from gl_classification
    IF v_line_account_id IS NULL THEN
      IF v_mat.gl_classification = 'FIXED_ASSET' THEN
        -- FA Priority: Item FA Account -> Category FA Account -> Existing Org FA Account (Never create CoA account)
        IF v_mat.fixed_asset_account_id IS NOT NULL THEN
          v_line_account_id := v_mat.fixed_asset_account_id;
        ELSIF v_mat.asset_category_id IS NOT NULL THEN
          SELECT gl_account_id INTO v_line_account_id FROM public.asset_categories WHERE id = v_mat.asset_category_id;
        END IF;

        IF v_line_account_id IS NULL THEN
          SELECT id INTO v_line_account_id
          FROM public.accounts
          WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id)
            AND root_type = 'Asset'
            AND (name ILIKE '%Furniture and Equipment%' OR name ILIKE '%Fixed Asset%' OR account_code IN ('1610','1600','1620','1640'))
          ORDER BY account_code ASC
          LIMIT 1;
        END IF;

        -- Fallback safety for FA
        IF v_line_account_id IS NULL THEN
          v_line_account_id := public.ensure_gl_account_exists(p_organisation_id, '1610', 'Furniture and Equipment', 'Asset');
        END IF;

        -- Register in Fixed Asset Register
        v_asset_code := 'AST-' || TO_CHAR(CURRENT_DATE, 'YYYYMM') || '-' || LPAD(((
          SELECT COUNT(*) + 1 FROM public.fixed_assets WHERE organisation_id = p_organisation_id
        ))::TEXT, 4, '0');

        INSERT INTO public.fixed_assets (
          organisation_id, asset_code, name, asset_category_id, gl_account_id,
          purchase_bill_id, purchase_bill_item_id, material_id, vendor_id,
          purchase_date, purchase_cost, taxable_amount, gst_amount,
          accumulated_depreciation, net_book_value, is_depreciable,
          useful_life_years, depreciation_method, status
        ) VALUES (
          p_organisation_id, v_asset_code, COALESCE(v_item.item_name, v_mat.name, 'Fixed Asset'),
          v_mat.asset_category_id, v_line_account_id, v_bill_id, v_bill_item_id,
          v_mat.id, p_vendor_id, COALESCE(p_bill_date, CURRENT_DATE),
          v_line_taxable, v_line_taxable, (v_line_cgst + v_line_sgst + v_line_igst),
          0.00, v_line_taxable, COALESCE(v_mat.is_depreciable, true),
          COALESCE(v_mat.useful_life_years, 5.00), 'SLM', 'ACTIVE'
        );

      ELSIF v_mat.gl_classification = 'INVENTORY_ASSET' THEN
        -- Inventory Priority by item_classification
        IF v_mat.item_classification = 'RAW_MATERIAL' THEN
          SELECT id INTO v_line_account_id FROM public.accounts 
          WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id)
            AND root_type = 'Asset' AND (name ILIKE '%Raw Material%' OR name ILIKE '%Inventory%')
          LIMIT 1;
        ELSIF v_mat.item_classification = 'FINISHED_GOOD' THEN
          SELECT id INTO v_line_account_id FROM public.accounts 
          WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id)
            AND root_type = 'Asset' AND (name ILIKE '%Finished Good%' OR name ILIKE '%Inventory%')
          LIMIT 1;
        ELSE
          SELECT id INTO v_line_account_id FROM public.accounts 
          WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id)
            AND root_type = 'Asset' AND (name ILIKE '%Inventory Asset%' OR name ILIKE '%Stock%')
          LIMIT 1;
        END IF;

        IF v_line_account_id IS NULL THEN
          v_line_account_id := public.ensure_gl_account_exists(p_organisation_id, '1410', 'Inventory Asset', 'Asset');
        END IF;

      ELSE
        -- Default: EXPENSE
        SELECT id INTO v_line_account_id FROM public.accounts 
        WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id)
          AND (account_code IN ('4100', '4101', '4000') OR name ILIKE '%Purchase%' OR name ILIKE '%Direct Expense%')
        ORDER BY account_code ASC
        LIMIT 1;

        IF v_line_account_id IS NULL THEN
          v_line_account_id := public.ensure_gl_account_exists(p_organisation_id, '4100', 'Purchase Accounts', 'Expense');
        END IF;
      END IF;
    END IF;

    -- Debit line for taxable amount
    INSERT INTO public.journal_entry_lines (
      journal_id, account_id, party_type, party_id, debit, credit, narration
    ) VALUES (
      v_journal_id, v_line_account_id, 'vendor', p_vendor_id, v_line_taxable, 0.00,
      COALESCE(v_item.item_name, 'Purchase Inward Supply')
    );
  END LOOP;

  -- J. Debit Lines for Input GST
  IF v_total_cgst > 0 AND v_cgst_input_id IS NOT NULL THEN
    INSERT INTO public.journal_entry_lines (
      journal_id, account_id, party_type, party_id, debit, credit, narration
    ) VALUES (
      v_journal_id, v_cgst_input_id, 'vendor', p_vendor_id, v_total_cgst, 0.00, 'Input CGST'
    );
  END IF;

  IF v_total_sgst > 0 AND v_sgst_input_id IS NOT NULL THEN
    INSERT INTO public.journal_entry_lines (
      journal_id, account_id, party_type, party_id, debit, credit, narration
    ) VALUES (
      v_journal_id, v_sgst_input_id, 'vendor', p_vendor_id, v_total_sgst, 0.00, 'Input SGST'
    );
  END IF;

  IF v_total_igst > 0 AND v_igst_input_id IS NOT NULL THEN
    INSERT INTO public.journal_entry_lines (
      journal_id, account_id, party_type, party_id, debit, credit, narration
    ) VALUES (
      v_journal_id, v_igst_input_id, 'vendor', p_vendor_id, v_total_igst, 0.00, 'Input IGST'
    );
  END IF;

  -- K. Credit Accounts Payable (Sundry Creditors) for Grand Total
  INSERT INTO public.journal_entry_lines (
    journal_id, account_id, party_type, party_id, debit, credit, narration
  ) VALUES (
    v_journal_id, v_ap_account_id, 'vendor', p_vendor_id, 0.00, v_grand_total, 'Accounts Payable Accrual'
  );

  -- L. Mathematical Balance Verification
  SELECT SUM(COALESCE(debit,0)), SUM(COALESCE(credit,0))
  INTO v_total_debit, v_total_credit
  FROM public.journal_entry_lines WHERE journal_id = v_journal_id;

  IF ABS(v_total_debit - v_total_credit) > 0.01 THEN
    RAISE EXCEPTION 'GL imbalance: debit=% credit=%. Transaction rolled back.', v_total_debit, v_total_credit;
  END IF;

  -- Clear creation flag
  PERFORM set_config('app.allow_posted_purchase_bill_creation', 'false', true);

  -- Recalculate Vendor Balance Inside Transaction
  PERFORM public.recalc_vendor_balance(p_vendor_id, p_organisation_id);

  v_result := jsonb_build_object(
    'status', 'success',
    'bill_id', v_bill_id,
    'bill_number', v_bill_number,
    'total_amount', v_grand_total,
    'journal_id', v_journal_id,
    'gl_debit', v_total_debit,
    'gl_credit', v_total_credit
  );

  RETURN v_result;
END;
$$;

COMMIT;
