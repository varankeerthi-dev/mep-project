-- Consolidated record of invoice V2 structural changes applied directly
-- to the live database via Supabase MCP on 2026-09-28.
--
-- Contents (all idempotent, safe to re-apply):
--   1. invoice_items: section/subtotal/ordering/custom columns + backfill
--   2. invoice_terms_conditions table + org-isolation RLS (mirrors quotation_terms_conditions)
--   3. invoices.authorized_signatory_id column
--   4. finalize_sales_invoice(): mode-aware stock deduction (lot) +
--      skip structural (header/subtotal) rows in totals recalc and GL posting
--
-- NOTE: the backfill deliberately skips items of finalized invoices, which
-- are immutable under fn_prevent_final_invoice_item_mutation(). Those rows
-- keep display_order 0 and render exactly as before.

-- ── 1. invoice_items structure columns ──────────────────────────────
ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS is_header boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_subtotal boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS subtotal_label text NULL,
  ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custom1 text NULL,
  ADD COLUMN IF NOT EXISTS custom2 text NULL;

-- Backfill explicit order for editable (non-final) invoices only.
WITH ordered AS (
  SELECT ii.id, ROW_NUMBER() OVER (PARTITION BY ii.invoice_id ORDER BY ii.created_at, ii.id) - 1 AS rn
  FROM public.invoice_items ii
  JOIN public.invoices i ON i.id = ii.invoice_id
  WHERE i.status IS DISTINCT FROM 'final'
)
UPDATE public.invoice_items i SET display_order = o.rn FROM ordered o WHERE o.id = i.id;

-- ── 2. invoice_terms_conditions table ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.invoice_terms_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NULL,
  organisation_id uuid NULL,
  template_id uuid NULL,
  is_custom boolean NULL DEFAULT false,
  custom_content jsonb NULL,
  created_at timestamptz NULL DEFAULT now(),
  updated_at timestamptz NULL DEFAULT now()
);

ALTER TABLE public.invoice_terms_conditions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invoice_terms_conditions_org_isolation ON public.invoice_terms_conditions;
CREATE POLICY invoice_terms_conditions_org_isolation ON public.invoice_terms_conditions
  FOR ALL TO public
  USING (public.user_can_access_org(organisation_id))
  WITH CHECK (public.user_can_access_org(organisation_id));

-- ── 3. invoices signatory column ─────────────────────────────────────
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS authorized_signatory_id uuid NULL;

-- ── 4. finalize_sales_invoice(): lot deduction + structural skip ────
CREATE OR REPLACE FUNCTION public.finalize_sales_invoice(p_invoice_id uuid, p_organisation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_invoice RECORD;
  v_client RECORD;
  v_org RECORD;
  r_item RECORD;
  r_deduct RECORD;
  v_mat RECORD;

  v_line_amount NUMERIC(15,2);
  v_subtotal NUMERIC(15,2) := 0;
  v_cgst NUMERIC(15,2) := 0;
  v_sgst NUMERIC(15,2) := 0;
  v_igst NUMERIC(15,2) := 0;
  v_total NUMERIC(15,2) := 0;

  v_tax_percent NUMERIC(5,2);
  v_is_intra_state BOOLEAN := TRUE;

  v_ar_account_id UUID;
  v_default_sales_account_id UUID;
  v_line_sales_account_id UUID;
  v_cgst_account_id UUID;
  v_sgst_account_id UUID;
  v_igst_account_id UUID;
  v_cogs_account_id UUID;
  v_inv_account_id UUID;

  v_unit_cost NUMERIC(15,2);
  v_line_cogs NUMERIC(15,2);
  v_total_debit NUMERIC(15,2);
  v_total_credit NUMERIC(15,2);

  v_journal_id UUID;
  v_has_insufficient BOOLEAN := FALSE;
  v_result JSONB;
BEGIN
  -- A. Auth & Tenant Authorization
  IF auth.uid() IS NOT NULL AND NOT public.user_can_access_org(p_organisation_id) THEN
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

  -- D. Recalculate Line Amounts & Subtotal Server-Side (normal rows only;
  --    section-header / subtotal rows carry no financial value)
  FOR r_item IN
    SELECT id, qty, rate, meta_json
    FROM public.invoice_items
    WHERE invoice_id = p_invoice_id
      AND NOT COALESCE(is_header, false)
      AND NOT COALESCE(is_subtotal, false)
    FOR UPDATE
  LOOP
    v_line_amount := ROUND((r_item.qty * r_item.rate)::NUMERIC, 2);

    UPDATE public.invoice_items
    SET amount = v_line_amount
    WHERE id = r_item.id;

    v_subtotal := v_subtotal + v_line_amount;

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

  -- E. Atomic Stock Deduction (mode-aware: lot invoices deduct invoice_materials)
  IF v_invoice.mode = 'lot' THEN
    FOR r_deduct IN
      SELECT * FROM public.deduct_invoice_stock_lot(p_invoice_id, p_organisation_id, FALSE)
    LOOP
      IF r_deduct.status = 'INSUFFICIENT' THEN
        v_has_insufficient := TRUE;
      END IF;
    END LOOP;
  ELSE
    FOR r_deduct IN
      SELECT * FROM public.deduct_invoice_stock(p_invoice_id, p_organisation_id, FALSE)
    LOOP
      IF r_deduct.status = 'INSUFFICIENT' THEN
        v_has_insufficient := TRUE;
      END IF;
    END LOOP;
  END IF;

  IF v_has_insufficient THEN
    RAISE EXCEPTION 'Stock deduction failed due to insufficient material inventory';
  END IF;

  -- F. Atomic Double-Entry GL Journal Posting
  SELECT id INTO v_journal_id
  FROM public.journal_entries
  WHERE (company_id = p_organisation_id OR organisation_id = p_organisation_id)
    AND voucher_no = COALESCE(v_invoice.invoice_no, p_invoice_id::TEXT)
    AND voucher_type = 'Sales';

  IF v_journal_id IS NULL THEN
    -- Resolve Debtors Account
    SELECT id INTO v_ar_account_id FROM public.accounts WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id) AND account_code = '1100' LIMIT 1;
    IF v_ar_account_id IS NULL THEN
      v_ar_account_id := public.ensure_gl_account_exists(p_organisation_id, '1100', 'Sundry Debtors', 'Asset');
    END IF;

    -- Resolve Default Sales Account
    SELECT id INTO v_default_sales_account_id FROM public.accounts WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id) AND account_code IN ('3100', '3101') ORDER BY account_code DESC LIMIT 1;
    IF v_default_sales_account_id IS NULL THEN
      v_default_sales_account_id := public.ensure_gl_account_exists(p_organisation_id, '3100', 'Sales Accounts', 'Income');
    END IF;

    -- Resolve Output GST Accounts
    SELECT id INTO v_cgst_account_id FROM public.accounts WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id) AND account_code = '2201' LIMIT 1;
    IF v_cgst_account_id IS NULL AND v_cgst > 0 THEN
      v_cgst_account_id := public.ensure_gl_account_exists(p_organisation_id, '2201', 'CGST Output', 'Liability');
    END IF;

    SELECT id INTO v_sgst_account_id FROM public.accounts WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id) AND account_code = '2202' LIMIT 1;
    IF v_sgst_account_id IS NULL AND v_sgst > 0 THEN
      v_sgst_account_id := public.ensure_gl_account_exists(p_organisation_id, '2202', 'SGST Output', 'Liability');
    END IF;

    SELECT id INTO v_igst_account_id FROM public.accounts WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id) AND account_code = '2203' LIMIT 1;
    IF v_igst_account_id IS NULL AND v_igst > 0 THEN
      v_igst_account_id := public.ensure_gl_account_exists(p_organisation_id, '2203', 'IGST Output', 'Liability');
    END IF;

    -- Create Journal Header
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

    -- 1. Debit Accounts Receivable (Total Gross Amount)
    IF v_ar_account_id IS NOT NULL AND v_total > 0 THEN
      INSERT INTO public.journal_entry_lines (journal_id, account_id, party_type, party_id, debit, credit, narration)
      VALUES (v_journal_id, v_ar_account_id, 'client', v_invoice.client_id, v_total, 0.00, 'Accounts Receivable');
    END IF;

    -- 2. Credit Sales Revenue Lines (normal rows only; structural rows excluded)
    FOR r_item IN
      SELECT ii.id, ii.qty, ii.rate, ii.amount, ii.description, ii.meta_json
      FROM public.invoice_items ii
      WHERE ii.invoice_id = p_invoice_id
        AND NOT COALESCE(ii.is_header, false)
        AND NOT COALESCE(ii.is_subtotal, false)
    LOOP
      v_line_sales_account_id := NULL;

      -- Check material override
      IF r_item.meta_json->>'material_id' IS NOT NULL THEN
        SELECT * INTO v_mat FROM public.materials WHERE id = (r_item.meta_json->>'material_id')::UUID;
        IF v_mat.id IS NOT NULL AND v_mat.sales_income_account_id IS NOT NULL THEN
          v_line_sales_account_id := v_mat.sales_income_account_id;
        END IF;
      END IF;

      IF v_line_sales_account_id IS NULL THEN
        v_line_sales_account_id := v_default_sales_account_id;
      END IF;

      INSERT INTO public.journal_entry_lines (journal_id, account_id, party_type, party_id, debit, credit, narration)
      VALUES (v_journal_id, v_line_sales_account_id, 'client', v_invoice.client_id, 0.00, r_item.amount, COALESCE(r_item.description, 'Sales Revenue'));

      -- 3. COGS & Inventory Reduction for Stockable Inventory Items
      IF v_mat.id IS NOT NULL AND COALESCE(v_mat.is_stockable, false) = true AND v_mat.gl_classification = 'INVENTORY_ASSET' THEN
        v_unit_cost := COALESCE(NULLIF(v_mat.purchase_price, 0), NULLIF(v_mat.default_rate, 0), 0);

        IF v_unit_cost > 0 THEN
          v_line_cogs := ROUND((r_item.qty * v_unit_cost)::NUMERIC, 2);

          IF v_line_cogs > 0 THEN
            -- Resolve COGS Account
            SELECT id INTO v_cogs_account_id FROM public.accounts
            WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id)
              AND (name ILIKE '%Cost of Goods%' OR account_code = '5000') LIMIT 1;
            IF v_cogs_account_id IS NULL THEN
              v_cogs_account_id := public.ensure_gl_account_exists(p_organisation_id, '5000', 'Cost of Goods Sold', 'Expense');
            END IF;

            -- Resolve Inventory Asset Account
            SELECT id INTO v_inv_account_id FROM public.accounts
            WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id)
              AND root_type = 'Asset' AND (name ILIKE '%Inventory%' OR account_code = '1410') LIMIT 1;
            IF v_inv_account_id IS NULL THEN
              v_inv_account_id := public.ensure_gl_account_exists(p_organisation_id, '1410', 'Inventory Asset', 'Asset');
            END IF;

            -- Debit COGS Expense
            INSERT INTO public.journal_entry_lines (journal_id, account_id, party_type, party_id, debit, credit, narration)
            VALUES (v_journal_id, v_cogs_account_id, 'client', v_invoice.client_id, v_line_cogs, 0.00, 'COGS - ' || v_mat.name);

            -- Credit Inventory Asset
            INSERT INTO public.journal_entry_lines (journal_id, account_id, party_type, party_id, debit, credit, narration)
            VALUES (v_journal_id, v_inv_account_id, 'client', v_invoice.client_id, 0.00, v_line_cogs, 'Inventory Reduction - ' || v_mat.name);
          END IF;
        ELSE
          RAISE NOTICE 'Skipping COGS for material % (no unit cost/purchase price defined)', v_mat.name;
        END IF;
      END IF;
    END LOOP;

    -- 4. Credit Output GST Liabilities
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

    -- 5. Mathematical Balance Verification
    SELECT SUM(COALESCE(debit,0)), SUM(COALESCE(credit,0))
    INTO v_total_debit, v_total_credit
    FROM public.journal_entry_lines WHERE journal_id = v_journal_id;

    IF ABS(v_total_debit - v_total_credit) > 0.01 THEN
      RAISE EXCEPTION 'GL imbalance: debit=% credit=%. Transaction rolled back.', v_total_debit, v_total_credit;
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
    'journal_id', v_journal_id,
    'gl_debit', v_total_debit,
    'gl_credit', v_total_credit
  );

  RETURN v_result;
END;
$function$;
