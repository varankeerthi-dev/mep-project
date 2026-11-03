-- Migration: 20261103030000_phase2_payables_client_recharge.sql
-- Description: Phase 2 — Payable Roll-up, Ledger Integration, and Client Recharge
-- Rollback Instructions:
--   DROP VIEW IF EXISTS public.v_labour_billable_uninvoiced;
--   DROP VIEW IF EXISTS public.v_labour_margin;
--   DROP FUNCTION IF EXISTS public.attach_labour_to_invoice(uuid, uuid, uuid, uuid, date, date, text);
--   DROP FUNCTION IF EXISTS public.pull_billable_labour(uuid, uuid, uuid, date, date);
--   DROP FUNCTION IF EXISTS public.generate_manpower_bill(uuid, uuid, date, date, text, uuid, uuid, uuid, text);
--   DROP FUNCTION IF EXISTS public.mark_attendance_billable(uuid, uuid, boolean, uuid);
--   DROP FUNCTION IF EXISTS public.resolve_labour_bill_rate(uuid, uuid, uuid, uuid, date);
--   DROP TABLE IF EXISTS public.labour_bill_rates CASCADE;
--   DROP TABLE IF EXISTS public.manpower_billing_entries CASCADE;
--   ALTER TABLE public.manpower_attendance DROP COLUMN IF EXISTS is_billable;
--   ALTER TABLE public.manpower_attendance DROP COLUMN IF EXISTS bill_rate;
--   ALTER TABLE public.manpower_attendance DROP COLUMN IF EXISTS bill_amount;
--   ALTER TABLE public.manpower_attendance DROP COLUMN IF EXISTS invoiced_at;
--   ALTER TABLE public.manpower_attendance DROP COLUMN IF EXISTS invoice_id;
--   ALTER TABLE public.manpower_attendance DROP COLUMN IF EXISTS invoice_line_ref;
--   ALTER TABLE public.manpower_billing DROP COLUMN IF EXISTS idempotency_key;
--   ALTER TABLE public.manpower_billing DROP COLUMN IF EXISTS journal_id;

DO $$
BEGIN
  -- =========================================================================
  -- 1. PAYABLE ROLL-UP: manpower_billing_entries & manpower_billing columns
  -- =========================================================================

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'manpower_billing' AND column_name = 'idempotency_key'
  ) THEN
    ALTER TABLE public.manpower_billing ADD COLUMN idempotency_key text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'manpower_billing' AND column_name = 'journal_id'
  ) THEN
    ALTER TABLE public.manpower_billing ADD COLUMN journal_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL;
  END IF;

  CREATE TABLE IF NOT EXISTS public.manpower_billing_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id uuid NOT NULL,
    billing_id uuid NOT NULL REFERENCES public.manpower_billing(id) ON DELETE CASCADE,
    attendance_id uuid NOT NULL UNIQUE REFERENCES public.manpower_attendance(id) ON DELETE RESTRICT,
    amount numeric(12,2) NOT NULL,
    created_at timestamptz DEFAULT now()
  );

  -- Index on manpower_billing_entries
  CREATE INDEX IF NOT EXISTS idx_mbe_org ON public.manpower_billing_entries(organisation_id);
  CREATE INDEX IF NOT EXISTS idx_mbe_billing ON public.manpower_billing_entries(billing_id);
  CREATE INDEX IF NOT EXISTS idx_mbe_attendance ON public.manpower_billing_entries(attendance_id);

  -- Idempotency index on manpower_billing
  CREATE UNIQUE INDEX IF NOT EXISTS idx_manpower_billing_idempotency 
    ON public.manpower_billing(organisation_id, idempotency_key) 
    WHERE idempotency_key IS NOT NULL;

END $$;

-- RLS on manpower_billing_entries
ALTER TABLE public.manpower_billing_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS manpower_billing_entries_tenant_isolation ON public.manpower_billing_entries;
CREATE POLICY manpower_billing_entries_tenant_isolation ON public.manpower_billing_entries
  FOR ALL TO authenticated
  USING (public.user_can_access_org(organisation_id))
  WITH CHECK (public.user_can_access_org(organisation_id));

DROP TRIGGER IF EXISTS trg_manpower_billing_entries_audit ON public.manpower_billing_entries;
CREATE TRIGGER trg_manpower_billing_entries_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.manpower_billing_entries
  FOR EACH ROW EXECUTE FUNCTION public.trg_labour_audit_record();

-- Idempotent backfill from existing manpower_billing.attendance_entries array
DO $$
DECLARE
  b RECORD;
  v_att_id uuid;
  v_amt numeric;
BEGIN
  FOR b IN SELECT id, organisation_id, attendance_entries FROM public.manpower_billing WHERE attendance_entries IS NOT NULL LOOP
    IF b.attendance_entries IS NOT NULL THEN
      FOREACH v_att_id IN ARRAY b.attendance_entries LOOP
        IF NOT EXISTS (SELECT 1 FROM public.manpower_billing_entries WHERE attendance_id = v_att_id) THEN
          SELECT COALESCE(adjusted_amount, original_amount, 0) INTO v_amt 
          FROM public.manpower_attendance WHERE id = v_att_id;

          IF v_amt IS NOT NULL THEN
            INSERT INTO public.manpower_billing_entries (organisation_id, billing_id, attendance_id, amount)
            VALUES (b.organisation_id, b.id, v_att_id, v_amt)
            ON CONFLICT (attendance_id) DO NOTHING;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END LOOP;
END $$;

-- =========================================================================
-- 2. CLIENT RECHARGE DATA MODEL (D5)
-- =========================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'manpower_attendance' AND column_name = 'is_billable'
  ) THEN
    ALTER TABLE public.manpower_attendance ADD COLUMN is_billable boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'manpower_attendance' AND column_name = 'bill_rate'
  ) THEN
    ALTER TABLE public.manpower_attendance ADD COLUMN bill_rate numeric(12,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'manpower_attendance' AND column_name = 'bill_amount'
  ) THEN
    ALTER TABLE public.manpower_attendance ADD COLUMN bill_amount numeric(12,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'manpower_attendance' AND column_name = 'invoiced_at'
  ) THEN
    ALTER TABLE public.manpower_attendance ADD COLUMN invoiced_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'manpower_attendance' AND column_name = 'invoice_id'
  ) THEN
    ALTER TABLE public.manpower_attendance ADD COLUMN invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'manpower_attendance' AND column_name = 'invoice_line_ref'
  ) THEN
    ALTER TABLE public.manpower_attendance ADD COLUMN invoice_line_ref text;
  END IF;

  CREATE TABLE IF NOT EXISTS public.labour_bill_rates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id uuid NOT NULL,
    client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
    client_party_id uuid REFERENCES public.parties(id) ON DELETE CASCADE,
    labour_category_id uuid NOT NULL REFERENCES public.labour_categories(id) ON DELETE RESTRICT,
    project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
    rate numeric(12,2) NOT NULL CHECK (rate >= 0),
    unit text NOT NULL DEFAULT 'day',
    effective_from date NOT NULL DEFAULT CURRENT_DATE,
    effective_to date,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS idx_lbr_org ON public.labour_bill_rates(organisation_id);
  CREATE INDEX IF NOT EXISTS idx_lbr_client ON public.labour_bill_rates(client_id);
  CREATE INDEX IF NOT EXISTS idx_lbr_trade ON public.labour_bill_rates(labour_category_id);
  CREATE INDEX IF NOT EXISTS idx_lbr_project ON public.labour_bill_rates(project_id);
  CREATE INDEX IF NOT EXISTS idx_att_billable ON public.manpower_attendance(organisation_id, is_billable, invoice_id);

END $$;

ALTER TABLE public.labour_bill_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS labour_bill_rates_tenant_isolation ON public.labour_bill_rates;
CREATE POLICY labour_bill_rates_tenant_isolation ON public.labour_bill_rates
  FOR ALL TO authenticated
  USING (public.user_can_access_org(organisation_id))
  WITH CHECK (public.user_can_access_org(organisation_id));

DROP TRIGGER IF EXISTS trg_labour_bill_rates_audit ON public.labour_bill_rates;
CREATE TRIGGER trg_labour_bill_rates_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.labour_bill_rates
  FOR EACH ROW EXECUTE FUNCTION public.trg_labour_audit_record();

-- =========================================================================
-- 3. RESOLVE LABOUR BILL RATE RPC
-- =========================================================================

CREATE OR REPLACE FUNCTION public.resolve_labour_bill_rate(
  p_organisation_id uuid,
  p_client_id uuid,
  p_labour_category_id uuid,
  p_project_id uuid DEFAULT NULL,
  p_work_date date DEFAULT CURRENT_DATE
) RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rate numeric;
  v_cat RECORD;
BEGIN
  -- (a) Client x Trade x Project
  IF p_client_id IS NOT NULL AND p_project_id IS NOT NULL THEN
    SELECT rate INTO v_rate
    FROM public.labour_bill_rates
    WHERE organisation_id = p_organisation_id
      AND client_id = p_client_id
      AND labour_category_id = p_labour_category_id
      AND project_id = p_project_id
      AND is_active = true
      AND effective_from <= p_work_date
      AND (effective_to IS NULL OR effective_to >= p_work_date)
    ORDER BY effective_from DESC
    LIMIT 1;

    IF v_rate IS NOT NULL AND v_rate > 0 THEN
      RETURN v_rate;
    END IF;
  END IF;

  -- (b) Client x Trade
  IF p_client_id IS NOT NULL THEN
    SELECT rate INTO v_rate
    FROM public.labour_bill_rates
    WHERE organisation_id = p_organisation_id
      AND client_id = p_client_id
      AND labour_category_id = p_labour_category_id
      AND project_id IS NULL
      AND is_active = true
      AND effective_from <= p_work_date
      AND (effective_to IS NULL OR effective_to >= p_work_date)
    ORDER BY effective_from DESC
    LIMIT 1;

    IF v_rate IS NOT NULL AND v_rate > 0 THEN
      RETURN v_rate;
    END IF;
  END IF;

  -- (c) Category default bill rate (or base_rate * 1.25)
  SELECT * INTO v_cat FROM public.labour_categories WHERE id = p_labour_category_id;
  IF FOUND AND v_cat.base_rate > 0 THEN
    -- Fallback bill rate is category base_rate with standard 25% markup if no explicit bill rate
    RETURN ROUND((v_cat.base_rate * 1.25)::numeric, 2);
  END IF;

  -- (d) Fail closed
  RAISE EXCEPTION 'No billable rate configured for client % and trade % on date %',
    p_client_id, p_labour_category_id, p_work_date;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_labour_bill_rate(uuid, uuid, uuid, uuid, date) TO authenticated;

-- Function: mark_attendance_billable
CREATE OR REPLACE FUNCTION public.mark_attendance_billable(
  p_attendance_id uuid,
  p_organisation_id uuid,
  p_is_billable boolean DEFAULT true,
  p_client_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_att RECORD;
  v_client_id uuid;
  v_bill_rate numeric := NULL;
  v_bill_amount numeric := NULL;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organisation access';
  END IF;

  IF NOT (public.is_org_admin(p_organisation_id) OR public.has_permission(p_organisation_id, 'labour.attendance.edit')) THEN
    RAISE EXCEPTION 'Permission denied: labour.attendance.edit required';
  END IF;

  SELECT * INTO v_att FROM public.manpower_attendance
  WHERE id = p_attendance_id AND organisation_id = p_organisation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attendance record % not found in organisation %', p_attendance_id, p_organisation_id;
  END IF;

  IF v_att.invoice_id IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot modify billing status: attendance row is already invoiced (invoice_id: %)', v_att.invoice_id;
  END IF;

  v_client_id := COALESCE(p_client_id, v_att.client_id);

  IF p_is_billable THEN
    IF v_client_id IS NULL THEN
      RAISE EXCEPTION 'Client is required to make attendance billable';
    END IF;

    -- Resolve bill rate server-side (fails closed if none found)
    v_bill_rate := public.resolve_labour_bill_rate(
      p_organisation_id,
      v_client_id,
      v_att.labour_category_id,
      v_att.project_id,
      v_att.attendance_date
    );

    v_bill_amount := ROUND((v_att.workers_count * (v_att.hours_worked / 8.0) * v_bill_rate)::numeric, 2);
  END IF;

  UPDATE public.manpower_attendance
  SET is_billable = p_is_billable,
      client_id = v_client_id,
      bill_rate = v_bill_rate,
      bill_amount = v_bill_amount,
      updated_at = NOW()
  WHERE id = p_attendance_id
  RETURNING * INTO v_att;

  RETURN to_jsonb(v_att);
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_attendance_billable(uuid, uuid, boolean, uuid) TO authenticated;

-- =========================================================================
-- 4. GENERATE MANPOWER BILL (2.1 & 2.2 LEDGER POSTING)
-- =========================================================================

CREATE OR REPLACE FUNCTION public.generate_manpower_bill(
  p_organisation_id uuid,
  p_subcontractor_id uuid,
  p_period_from date,
  p_period_to date,
  p_idempotency_key text DEFAULT NULL,
  p_client_id uuid DEFAULT NULL,
  p_project_id uuid DEFAULT NULL,
  p_work_order_id uuid DEFAULT NULL,
  p_remarks text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_creator_id uuid;
  v_existing RECORD;
  v_billing_id uuid;
  v_sub RECORD;
  v_wo RECORD;
  v_total_orig numeric := 0;
  v_total_adj numeric := 0;
  v_count integer := 0;
  v_att_ids uuid[] := '{}'::uuid[];
  v_row RECORD;
  v_retention_percent numeric := 0;
  v_retention_amt numeric := 0;
  v_payable_amt numeric := 0;
  v_bill_no text;
  v_expense_account_id uuid;
  v_ap_account_id uuid;
  v_retention_account_id uuid;
  v_journal_id uuid;
  v_total_debit numeric;
  v_total_credit numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organisation access';
  END IF;

  IF NOT (public.is_org_admin(p_organisation_id) OR public.has_permission(p_organisation_id, 'labour.billing.generate')) THEN
    RAISE EXCEPTION 'Permission denied: labour.billing.generate required to generate manpower bill';
  END IF;

  -- 1. Idempotency Check
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.manpower_billing
    WHERE organisation_id = p_organisation_id AND idempotency_key = p_idempotency_key;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'status', 'success',
        'idempotent_replayed', true,
        'billing_id', v_existing.id,
        'total_amount', v_existing.total_adjusted_amount,
        'journal_id', v_existing.journal_id
      );
    END IF;
  END IF;

  -- 2. Validate subcontractor
  SELECT * INTO v_sub FROM public.subcontractors 
  WHERE id = p_subcontractor_id AND organisation_id = p_organisation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subcontractor % not found in organisation %', p_subcontractor_id, p_organisation_id;
  END IF;

  -- 3. Work Order & Retention
  IF p_work_order_id IS NOT NULL THEN
    SELECT * INTO v_wo FROM public.subcontractor_work_orders
    WHERE id = p_work_order_id AND organisation_id = p_organisation_id AND subcontractor_id = p_subcontractor_id;
    IF FOUND THEN
      v_retention_percent := COALESCE(v_wo.retention_percent, 0);
    END IF;
  END IF;

  -- 4. Gather approved, not-yet-billed attendance rows
  FOR v_row IN
    SELECT a.*
    FROM public.manpower_attendance a
    WHERE a.organisation_id = p_organisation_id
      AND a.subcontractor_id = p_subcontractor_id
      AND a.status = 'APPROVED'
      AND a.attendance_date BETWEEN p_period_from AND p_period_to
      AND (p_client_id IS NULL OR a.client_id = p_client_id)
      AND (p_project_id IS NULL OR a.project_id = p_project_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.manpower_billing_entries mbe WHERE mbe.attendance_id = a.id
      )
    ORDER BY a.attendance_date ASC
    FOR UPDATE
  LOOP
    v_total_orig := v_total_orig + v_row.original_amount;
    v_total_adj := v_total_adj + v_row.adjusted_amount;
    v_att_ids := array_append(v_att_ids, v_row.id);
    v_count := v_count + 1;
  END LOOP;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'No approved unbilled attendance rows found for subcontractor % between % and %',
      p_subcontractor_id, p_period_from, p_period_to;
  END IF;

  v_retention_amt := ROUND((v_total_adj * (v_retention_percent / 100.0))::numeric, 2);
  v_payable_amt := v_total_adj - v_retention_amt;

  -- 5. GL Accounts Lookup (fail-closed)
  SELECT id INTO v_expense_account_id FROM public.accounts 
  WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id) 
    AND account_code IN ('4100', '4101', '4000') 
  ORDER BY account_code DESC LIMIT 1;

  SELECT id INTO v_ap_account_id FROM public.accounts 
  WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id) 
    AND account_code = '2100' LIMIT 1;

  SELECT id INTO v_retention_account_id FROM public.accounts 
  WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id) 
    AND account_code = '2150' LIMIT 1;

  IF v_expense_account_id IS NULL THEN
    v_expense_account_id := public.ensure_gl_account_exists(p_organisation_id, '4100', 'Operational Expenses (Labour)', 'Expense');
  END IF;

  IF v_ap_account_id IS NULL THEN
    v_ap_account_id := public.ensure_gl_account_exists(p_organisation_id, '2100', 'Sundry Creditors (Subcontractor AP)', 'Liability');
  END IF;

  IF v_retention_amt > 0 AND v_retention_account_id IS NULL THEN
    v_retention_account_id := public.ensure_gl_account_exists(p_organisation_id, '2150', 'Retention Payable', 'Liability');
  END IF;

  SELECT id INTO v_creator_id FROM public.user_profiles WHERE user_id = auth.uid() OR id = auth.uid() LIMIT 1;
  v_bill_no := 'MB-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || SUBSTRING(gen_random_uuid()::text, 1, 6);

  -- 6. Insert Journal Entry (balanced)
  INSERT INTO public.journal_entries (
    company_id, voucher_no, voucher_date, voucher_type, narration, status, created_by
  ) VALUES (
    p_organisation_id, v_bill_no, CURRENT_DATE, 'Purchase'::public.voucher_type,
    'Manpower Bill ' || v_bill_no || ' for ' || v_sub.company_name || ' (' || v_count || ' shifts)', 'Posted', v_creator_id
  ) RETURNING id INTO v_journal_id;

  -- Debit Expense with project_id
  INSERT INTO public.journal_entry_lines (
    journal_id, account_id, party_type, party_id, debit, credit, narration, project_id
  ) VALUES (
    v_journal_id, v_expense_account_id, 'vendor', p_subcontractor_id, v_total_adj, 0.00,
    'Manpower Labour Cost', p_project_id
  );

  -- Credit AP
  IF v_payable_amt > 0 THEN
    INSERT INTO public.journal_entry_lines (
      journal_id, account_id, party_type, party_id, debit, credit, narration, project_id
    ) VALUES (
      v_journal_id, v_ap_account_id, 'vendor', p_subcontractor_id, 0.00, v_payable_amt,
      'Accounts Payable - Manpower', p_project_id
    );
  END IF;

  -- Credit Retention
  IF v_retention_amt > 0 THEN
    INSERT INTO public.journal_entry_lines (
      journal_id, account_id, party_type, party_id, debit, credit, narration, project_id
    ) VALUES (
      v_journal_id, v_retention_account_id, 'vendor', p_subcontractor_id, 0.00, v_retention_amt,
      'Retention Payable - Manpower', p_project_id
    );
  END IF;

  -- Assert debits = credits
  SELECT SUM(COALESCE(debit,0)), SUM(COALESCE(credit,0))
  INTO v_total_debit, v_total_credit
  FROM public.journal_entry_lines WHERE journal_id = v_journal_id;

  IF ABS(v_total_debit - v_total_credit) > 0.01 THEN
    RAISE EXCEPTION 'GL imbalance: debit=% credit=%. Transaction rolled back.', v_total_debit, v_total_credit;
  END IF;

  -- 7. Insert Manpower Billing Header
  INSERT INTO public.manpower_billing (
    organisation_id,
    subcontractor_id,
    work_unit_id,
    work_unit_type,
    billing_period_start,
    billing_period_end,
    attendance_entries,
    total_original_amount,
    total_adjusted_amount,
    total_difference,
    currency,
    status,
    approved_by,
    approved_at,
    remarks,
    idempotency_key,
    journal_id
  ) VALUES (
    p_organisation_id,
    p_subcontractor_id,
    p_project_id,
    CASE WHEN p_project_id IS NOT NULL THEN 'PROJECT' ELSE 'GENERAL' END,
    p_period_from,
    p_period_to,
    v_att_ids,
    v_total_orig,
    v_total_adj,
    v_total_adj - v_total_orig,
    'INR',
    'BILLED',
    auth.uid(),
    NOW(),
    COALESCE(p_remarks, 'Manpower Bill ' || v_bill_no),
    p_idempotency_key,
    v_journal_id
  ) RETURNING id INTO v_billing_id;

  -- 8. Insert Entries in manpower_billing_entries join table and lock attendance rows
  FOR v_row IN SELECT id, adjusted_amount FROM public.manpower_attendance WHERE id = ANY(v_att_ids) LOOP
    INSERT INTO public.manpower_billing_entries (
      organisation_id,
      billing_id,
      attendance_id,
      amount
    ) VALUES (
      p_organisation_id,
      v_billing_id,
      v_row.id,
      v_row.adjusted_amount
    );

    UPDATE public.manpower_attendance
    SET status = 'BILLED',
        updated_at = NOW()
    WHERE id = v_row.id;
  END LOOP;

  PERFORM public.recalc_subcontractor_balance(p_subcontractor_id, p_organisation_id);

  RETURN jsonb_build_object(
    'status', 'success',
    'billing_id', v_billing_id,
    'bill_no', v_bill_no,
    'count', v_count,
    'total_original', v_total_orig,
    'total_adjusted', v_total_adj,
    'retention_amount', v_retention_amt,
    'payable_amount', v_payable_amt,
    'journal_id', v_journal_id,
    'gl_debit', v_total_debit,
    'gl_credit', v_total_credit
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_manpower_bill(uuid, uuid, date, date, text, uuid, uuid, uuid, text) TO authenticated;

-- =========================================================================
-- 5. ATTACH LABOUR TO CLIENT INVOICE (2.3 CLIENT RECHARGE)
-- =========================================================================

CREATE OR REPLACE FUNCTION public.pull_billable_labour(
  p_organisation_id uuid,
  p_client_id uuid,
  p_project_id uuid DEFAULT NULL,
  p_period_from date DEFAULT NULL,
  p_period_to date DEFAULT NULL
) RETURNS TABLE (
  attendance_id uuid,
  attendance_date date,
  labour_category_id uuid,
  category_name text,
  workers_count integer,
  hours_worked numeric,
  man_days numeric,
  bill_rate numeric,
  bill_amount numeric,
  project_id uuid,
  client_id uuid
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organisation access';
  END IF;

  RETURN QUERY
  SELECT 
    a.id AS attendance_id,
    a.attendance_date,
    a.labour_category_id,
    lc.name::text AS category_name,
    a.workers_count,
    a.hours_worked,
    ROUND((a.workers_count * (a.hours_worked / 8.0))::numeric, 2) AS man_days,
    a.bill_rate,
    a.bill_amount,
    a.project_id,
    a.client_id
  FROM public.manpower_attendance a
  LEFT JOIN public.labour_categories lc ON lc.id = a.labour_category_id
  WHERE a.organisation_id = p_organisation_id
    AND a.client_id = p_client_id
    AND a.is_billable = true
    AND a.invoice_id IS NULL
    AND a.status IN ('APPROVED', 'BILLED')
    AND a.entry_kind = 'ACTUAL'
    AND (p_project_id IS NULL OR a.project_id = p_project_id)
    AND (p_period_from IS NULL OR a.attendance_date >= p_period_from)
    AND (p_period_to IS NULL OR a.attendance_date <= p_period_to)
  ORDER BY a.attendance_date ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pull_billable_labour(uuid, uuid, uuid, date, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.attach_labour_to_invoice(
  p_invoice_id uuid,
  p_organisation_id uuid,
  p_client_id uuid,
  p_project_id uuid DEFAULT NULL,
  p_period_from date DEFAULT NULL,
  p_period_to date DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inv RECORD;
  v_row RECORD;
  v_lines_count integer := 0;
  v_total_amount numeric := 0;
  v_att_ids uuid[] := '{}'::uuid[];
  v_existing_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organisation access';
  END IF;

  IF NOT (public.is_org_admin(p_organisation_id) OR public.has_permission(p_organisation_id, 'labour.billing.generate')) THEN
    RAISE EXCEPTION 'Permission denied: labour.billing.generate required to attach labour to invoice';
  END IF;

  -- Verify invoice
  SELECT * INTO v_inv FROM public.invoices WHERE id = p_invoice_id AND organisation_id = p_organisation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice % not found in organisation %', p_invoice_id, p_organisation_id;
  END IF;

  -- Idempotency check: if attendance rows are already linked to this invoice, return count
  SELECT count(*) INTO v_existing_count FROM public.manpower_attendance WHERE invoice_id = p_invoice_id;
  IF v_existing_count > 0 AND p_idempotency_key IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'success',
      'idempotent_replayed', true,
      'invoice_id', p_invoice_id,
      'attached_rows_count', v_existing_count
    );
  END IF;

  -- Lock candidate rows to prevent concurrent invoice attachment
  PERFORM 1 FROM public.manpower_attendance
  WHERE organisation_id = p_organisation_id
    AND client_id = p_client_id
    AND is_billable = true
    AND invoice_id IS NULL
    AND status IN ('APPROVED', 'BILLED')
    AND entry_kind = 'ACTUAL'
    AND (p_project_id IS NULL OR project_id = p_project_id)
    AND (p_period_from IS NULL OR attendance_date >= p_period_from)
    AND (p_period_to IS NULL OR attendance_date <= p_period_to)
  FOR UPDATE;

  -- Gather and group billable attendance rows by trade
  FOR v_row IN
    SELECT 
      a.labour_category_id,
      lc.name AS category_name,
      a.bill_rate,
      SUM(a.workers_count * (a.hours_worked / 8.0))::numeric(12,2) AS total_mandays,
      SUM(a.bill_amount)::numeric(12,2) AS category_amount,
      ARRAY_AGG(a.id) AS matched_ids
    FROM public.manpower_attendance a
    LEFT JOIN public.labour_categories lc ON lc.id = a.labour_category_id
    WHERE a.organisation_id = p_organisation_id
      AND a.client_id = p_client_id
      AND a.is_billable = true
      AND a.invoice_id IS NULL
      AND a.status IN ('APPROVED', 'BILLED')
      AND a.entry_kind = 'ACTUAL'
      AND (p_project_id IS NULL OR a.project_id = p_project_id)
      AND (p_period_from IS NULL OR a.attendance_date >= p_period_from)
      AND (p_period_to IS NULL OR a.attendance_date <= p_period_to)
    GROUP BY a.labour_category_id, lc.name, a.bill_rate
  LOOP
    -- Insert invoice item line
    INSERT INTO public.invoice_items (
      invoice_id,
      organisation_id,
      description,
      qty,
      rate,
      amount,
      meta_json,
      display_order
    ) VALUES (
      p_invoice_id,
      p_organisation_id,
      'Labour Charges: ' || COALESCE(v_row.category_name, 'General Labour') || ' (' || v_row.total_mandays || ' mandays @ ₹' || v_row.bill_rate || ')',
      v_row.total_mandays,
      v_row.bill_rate,
      v_row.category_amount,
      jsonb_build_object(
        'source', 'labour_recharge',
        'trade_id', v_row.labour_category_id,
        'attendance_ids', v_row.matched_ids,
        'idempotency_key', p_idempotency_key
      ),
      100 + v_lines_count
    );

    -- Mark attendance rows as invoiced
    UPDATE public.manpower_attendance
    SET invoice_id = p_invoice_id,
        invoiced_at = NOW(),
        updated_at = NOW()
    WHERE id = ANY(v_row.matched_ids);

    v_lines_count := v_lines_count + 1;
    v_total_amount := v_total_amount + v_row.category_amount;
    v_att_ids := v_att_ids || v_row.matched_ids;
  END LOOP;

  RETURN jsonb_build_object(
    'status', 'success',
    'invoice_id', p_invoice_id,
    'lines_created', v_lines_count,
    'total_labour_amount', v_total_amount,
    'rows_invoiced', array_length(v_att_ids, 1)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.attach_labour_to_invoice(uuid, uuid, uuid, uuid, date, date, text) TO authenticated;

-- =========================================================================
-- 6. REPORTING VIEWS: v_labour_margin & v_labour_billable_uninvoiced
-- =========================================================================

CREATE OR REPLACE VIEW public.v_labour_margin AS
SELECT 
  a.organisation_id,
  a.client_id,
  a.project_id,
  COALESCE(c.client_name, c.name, 'Direct Client') AS client_name,
  COALESCE(p.name, p.project_name, 'General / Direct') AS project_name,
  COUNT(a.id)::int AS attendance_count,
  SUM(a.workers_count)::int AS total_man_days,
  SUM(a.adjusted_amount)::numeric(15,2) AS total_cost,
  SUM(COALESCE(a.bill_amount, 0))::numeric(15,2) AS total_billed,
  (SUM(COALESCE(a.bill_amount, 0)) - SUM(a.adjusted_amount))::numeric(15,2) AS total_margin,
  CASE 
    WHEN SUM(COALESCE(a.bill_amount, 0)) > 0 
    THEN ROUND(((SUM(COALESCE(a.bill_amount, 0)) - SUM(a.adjusted_amount)) / SUM(COALESCE(a.bill_amount, 0)) * 100.0)::numeric, 2)
    ELSE 0.00 
  END AS margin_percentage
FROM public.manpower_attendance a
LEFT JOIN public.clients c ON c.id = a.client_id
LEFT JOIN public.projects p ON p.id = a.project_id
WHERE a.status IN ('APPROVED', 'BILLED') AND a.entry_kind = 'ACTUAL'
GROUP BY a.organisation_id, a.client_id, a.project_id, c.client_name, c.name, p.name, p.project_name;

GRANT SELECT ON public.v_labour_margin TO authenticated;

CREATE OR REPLACE VIEW public.v_labour_billable_uninvoiced AS
SELECT 
  a.id AS attendance_id,
  a.organisation_id,
  a.attendance_date,
  a.client_id,
  a.project_id,
  a.subcontractor_id,
  a.workers_count,
  a.hours_worked,
  a.base_rate,
  a.adjusted_rate,
  a.adjusted_amount AS cost_amount,
  a.bill_rate,
  a.bill_amount,
  (a.bill_amount - a.adjusted_amount) AS projected_margin,
  COALESCE(c.client_name, c.name) AS client_name,
  COALESCE(p.name, p.project_name) AS project_name,
  lc.name AS category_name
FROM public.manpower_attendance a
LEFT JOIN public.clients c ON c.id = a.client_id
LEFT JOIN public.projects p ON p.id = a.project_id
LEFT JOIN public.labour_categories lc ON lc.id = a.labour_category_id
WHERE a.status IN ('APPROVED', 'BILLED') 
  AND a.is_billable = true 
  AND a.invoice_id IS NULL
  AND a.entry_kind = 'ACTUAL';

GRANT SELECT ON public.v_labour_billable_uninvoiced TO authenticated;
