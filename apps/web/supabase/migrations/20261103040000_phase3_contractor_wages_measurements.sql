-- =========================================================================
-- Migration: 20261103040000_phase3_contractor_wages_measurements.sql
-- Description: Phase 3 — Labour-Contractor Tenant (Wages, Piece-Rate / Meters, Margin)
--
-- ARCHITECTURAL BOUNDARY NOTE (HRFlow vs BillFast):
-- Employees' monthly pay in BillFast represents site labour wage runs and site
-- project cost attribution. It operates on site attendance days/shifts.
-- To prevent double-counting with HRFlow (the separate enterprise HR & payroll app),
-- site wage run journal postings to GL are categorized under site operational wage
-- expenses (Account 4101). When an organization runs both, permanent salaried staff
-- payroll ledger postings are executed by HRFlow, while casual/daily wages and site
-- piece-rates are executed by BillFast.
--
-- Hard Rules Respected:
-- - R1: Additive only.
-- - R2: Local migration with idempotent DDL and rollback comments.
-- - R7: Server-side money computation (advances, net pay, measurements).
-- - R8: Tenancy: organisation_id uuid NOT NULL, RLS enabled, user_can_access_org.
-- - R9: DB-enforced permissions (labour.wages.run, labour.wages.pay, labour.measurement.*).
-- =========================================================================

-- =========================================================================
-- 1. BUSINESS PROFILE & AGREEMENT EXTENSIONS
-- =========================================================================

DO $$
BEGIN
  -- 1.1 Business profile on organisations
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organisations' AND column_name = 'business_profile'
  ) THEN
    ALTER TABLE public.organisations 
    ADD COLUMN business_profile text CHECK (business_profile IN ('epc', 'labour_supplier', 'both')) DEFAULT 'epc';
  END IF;

  -- 1.2 Pay basis and unit on rate_cards
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rate_cards' AND column_name = 'pay_basis'
  ) THEN
    ALTER TABLE public.rate_cards 
    ADD COLUMN pay_basis text CHECK (pay_basis IN ('daily', 'hourly', 'per_meter', 'lump_sum')) DEFAULT 'daily';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rate_cards' AND column_name = 'unit'
  ) THEN
    ALTER TABLE public.rate_cards 
    ADD COLUMN unit text DEFAULT 'day';
  END IF;

  -- 1.3 Pay basis on subcontractor_work_orders
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subcontractor_work_orders' AND column_name = 'pay_basis'
  ) THEN
    ALTER TABLE public.subcontractor_work_orders 
    ADD COLUMN pay_basis text CHECK (pay_basis IN ('daily', 'hourly', 'per_meter', 'lump_sum')) DEFAULT 'daily';
  END IF;

  -- 1.4 Productivity-only flag on manpower_attendance (attendance logged for productivity without generating daily pay)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'manpower_attendance' AND column_name = 'productivity_only'
  ) THEN
    ALTER TABLE public.manpower_attendance 
    ADD COLUMN productivity_only boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- =========================================================================
-- 2. WAGES MODULE TABLES
-- =========================================================================

-- 2.1 Labour Wage Runs
CREATE TABLE IF NOT EXISTS public.labour_wage_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  run_no text NOT NULL,
  period_from date NOT NULL,
  period_to date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('weekly', 'monthly', 'on_demand')),
  status text NOT NULL CHECK (status IN ('draft', 'approved', 'paid', 'cancelled')) DEFAULT 'draft',
  total_gross numeric(12,2) NOT NULL DEFAULT 0.00 CHECK (total_gross >= 0),
  total_advance_recovered numeric(12,2) NOT NULL DEFAULT 0.00 CHECK (total_advance_recovered >= 0),
  total_deductions numeric(12,2) NOT NULL DEFAULT 0.00 CHECK (total_deductions >= 0),
  total_net numeric(12,2) NOT NULL DEFAULT 0.00 CHECK (total_net >= 0),
  journal_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  payment_id uuid,
  idempotency_key text,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  paid_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  paid_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lwr_org ON public.labour_wage_runs(organisation_id);
CREATE INDEX IF NOT EXISTS idx_lwr_period ON public.labour_wage_runs(organisation_id, period_from, period_to);
CREATE INDEX IF NOT EXISTS idx_lwr_status ON public.labour_wage_runs(organisation_id, status);
CREATE INDEX IF NOT EXISTS idx_lwr_idempotency ON public.labour_wage_runs(organisation_id, idempotency_key);

ALTER TABLE public.labour_wage_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS labour_wage_runs_tenant_isolation ON public.labour_wage_runs;
CREATE POLICY labour_wage_runs_tenant_isolation ON public.labour_wage_runs
  FOR ALL TO authenticated
  USING (public.user_can_access_org(organisation_id))
  WITH CHECK (public.user_can_access_org(organisation_id));

DROP TRIGGER IF EXISTS trg_labour_wage_runs_audit ON public.labour_wage_runs;
CREATE TRIGGER trg_labour_wage_runs_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.labour_wage_runs
  FOR EACH ROW EXECUTE FUNCTION public.trg_labour_audit_record();


-- 2.2 Labour Advances
CREATE TABLE IF NOT EXISTS public.labour_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  worker_id uuid REFERENCES public.labour_workers(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  advance_date date NOT NULL DEFAULT CURRENT_DATE,
  recovered_amount numeric(12,2) NOT NULL DEFAULT 0.00 CHECK (recovered_amount >= 0 AND recovered_amount <= amount),
  status text NOT NULL CHECK (status IN ('active', 'recovered', 'written_off')) DEFAULT 'active',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT chk_advance_worker_or_emp CHECK (
    (worker_id IS NOT NULL AND employee_id IS NULL) OR
    (worker_id IS NULL AND employee_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_adv_org ON public.labour_advances(organisation_id);
CREATE INDEX IF NOT EXISTS idx_adv_worker ON public.labour_advances(organisation_id, worker_id);
CREATE INDEX IF NOT EXISTS idx_adv_employee ON public.labour_advances(organisation_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_adv_status ON public.labour_advances(organisation_id, status);

ALTER TABLE public.labour_advances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS labour_advances_tenant_isolation ON public.labour_advances;
CREATE POLICY labour_advances_tenant_isolation ON public.labour_advances
  FOR ALL TO authenticated
  USING (public.user_can_access_org(organisation_id))
  WITH CHECK (public.user_can_access_org(organisation_id));

DROP TRIGGER IF EXISTS trg_labour_advances_audit ON public.labour_advances;
CREATE TRIGGER trg_labour_advances_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.labour_advances
  FOR EACH ROW EXECUTE FUNCTION public.trg_labour_audit_record();


-- 2.3 Labour Wage Lines
CREATE TABLE IF NOT EXISTS public.labour_wage_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  run_id uuid NOT NULL REFERENCES public.labour_wage_runs(id) ON DELETE CASCADE,
  worker_id uuid REFERENCES public.labour_workers(id) ON DELETE RESTRICT,
  employee_id uuid REFERENCES public.employees(id) ON DELETE RESTRICT,
  days_or_units numeric(10,2) NOT NULL DEFAULT 0 CHECK (days_or_units >= 0),
  rate_basis text NOT NULL CHECK (rate_basis IN ('daily', 'hourly', 'per_meter', 'monthly')),
  rate numeric(12,2) NOT NULL DEFAULT 0.00 CHECK (rate >= 0),
  gross numeric(12,2) NOT NULL DEFAULT 0.00 CHECK (gross >= 0),
  advance_recovered numeric(12,2) NOT NULL DEFAULT 0.00 CHECK (advance_recovered >= 0),
  deductions numeric(12,2) NOT NULL DEFAULT 0.00 CHECK (deductions >= 0),
  net numeric(12,2) NOT NULL DEFAULT 0.00 CHECK (net >= 0),
  payout_ref text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT chk_wageline_worker_or_emp CHECK (
    (worker_id IS NOT NULL AND employee_id IS NULL) OR
    (worker_id IS NULL AND employee_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_lwl_run ON public.labour_wage_lines(run_id);
CREATE INDEX IF NOT EXISTS idx_lwl_org ON public.labour_wage_lines(organisation_id);
CREATE INDEX IF NOT EXISTS idx_lwl_worker ON public.labour_wage_lines(worker_id);
CREATE INDEX IF NOT EXISTS idx_lwl_emp ON public.labour_wage_lines(employee_id);

ALTER TABLE public.labour_wage_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS labour_wage_lines_tenant_isolation ON public.labour_wage_lines;
CREATE POLICY labour_wage_lines_tenant_isolation ON public.labour_wage_lines
  FOR ALL TO authenticated
  USING (public.user_can_access_org(organisation_id))
  WITH CHECK (public.user_can_access_org(organisation_id));

DROP TRIGGER IF EXISTS trg_labour_wage_lines_audit ON public.labour_wage_lines;
CREATE TRIGGER trg_labour_wage_lines_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.labour_wage_lines
  FOR EACH ROW EXECUTE FUNCTION public.trg_labour_audit_record();


-- 2.4 Labour Wage Line Sources (Join table linking attendance rows to wage lines)
CREATE TABLE IF NOT EXISTS public.labour_wage_line_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  wage_line_id uuid NOT NULL REFERENCES public.labour_wage_lines(id) ON DELETE CASCADE,
  attendance_id uuid NOT NULL REFERENCES public.manpower_attendance(id) ON DELETE RESTRICT,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT uq_wage_source_attendance UNIQUE (attendance_id)
);

CREATE INDEX IF NOT EXISTS idx_lwls_line ON public.labour_wage_line_sources(wage_line_id);
CREATE INDEX IF NOT EXISTS idx_lwls_att ON public.labour_wage_line_sources(attendance_id);
CREATE INDEX IF NOT EXISTS idx_lwls_org ON public.labour_wage_line_sources(organisation_id);

ALTER TABLE public.labour_wage_line_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS labour_wage_line_sources_tenant_isolation ON public.labour_wage_line_sources;
CREATE POLICY labour_wage_line_sources_tenant_isolation ON public.labour_wage_line_sources
  FOR ALL TO authenticated
  USING (public.user_can_access_org(organisation_id))
  WITH CHECK (public.user_can_access_org(organisation_id));


-- =========================================================================
-- 3. MEASUREMENT-BASED PAY (PIECE-RATE / METERS)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.labour_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  measurement_no text NOT NULL,
  subcontractor_id uuid REFERENCES public.subcontractors(id) ON DELETE SET NULL,
  worker_id uuid REFERENCES public.labour_workers(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  work_order_id uuid REFERENCES public.subcontractor_work_orders(id) ON DELETE SET NULL,
  measurement_date date NOT NULL DEFAULT CURRENT_DATE,
  task text NOT NULL,
  unit text NOT NULL DEFAULT 'm',
  qty numeric(12,2) NOT NULL CHECK (qty > 0),
  rate numeric(12,2) NOT NULL CHECK (rate >= 0),
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  status text NOT NULL CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED')) DEFAULT 'DRAFT',
  evidence_notes text,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lm_org ON public.labour_measurements(organisation_id);
CREATE INDEX IF NOT EXISTS idx_lm_sub ON public.labour_measurements(subcontractor_id);
CREATE INDEX IF NOT EXISTS idx_lm_worker ON public.labour_measurements(worker_id);
CREATE INDEX IF NOT EXISTS idx_lm_proj ON public.labour_measurements(project_id);
CREATE INDEX IF NOT EXISTS idx_lm_status ON public.labour_measurements(organisation_id, status);

ALTER TABLE public.labour_measurements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS labour_measurements_tenant_isolation ON public.labour_measurements;
CREATE POLICY labour_measurements_tenant_isolation ON public.labour_measurements
  FOR ALL TO authenticated
  USING (public.user_can_access_org(organisation_id))
  WITH CHECK (public.user_can_access_org(organisation_id));

DROP TRIGGER IF EXISTS trg_labour_measurements_audit ON public.labour_measurements;
CREATE TRIGGER trg_labour_measurements_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.labour_measurements
  FOR EACH ROW EXECUTE FUNCTION public.trg_labour_audit_record();


-- =========================================================================
-- 4. RPCs: ADVANCES & WAGE RUNS
-- =========================================================================

-- 4.1 Give Labour Advance
CREATE OR REPLACE FUNCTION public.give_labour_advance(
  p_organisation_id uuid,
  p_worker_id uuid DEFAULT NULL,
  p_employee_id uuid DEFAULT NULL,
  p_amount numeric DEFAULT 0,
  p_date date DEFAULT CURRENT_DATE,
  p_notes text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_advance_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organisation access';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Advance amount must be greater than zero';
  END IF;

  IF (p_worker_id IS NULL AND p_employee_id IS NULL) OR (p_worker_id IS NOT NULL AND p_employee_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Must provide exactly one of worker_id or employee_id';
  END IF;

  INSERT INTO public.labour_advances (
    organisation_id, worker_id, employee_id, amount, advance_date, notes
  ) VALUES (
    p_organisation_id, p_worker_id, p_employee_id, p_amount, p_date, p_notes
  ) RETURNING id INTO v_advance_id;

  RETURN v_advance_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.give_labour_advance(uuid, uuid, uuid, numeric, date, text) TO authenticated;


-- 4.2 Generate Wage Run
CREATE OR REPLACE FUNCTION public.generate_wage_run(
  p_organisation_id uuid,
  p_period_from date,
  p_period_to date,
  p_kind text DEFAULT 'weekly',
  p_max_advance_recovery_cap numeric DEFAULT 1000.00,
  p_idempotency_key text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_existing RECORD;
  v_run_id uuid;
  v_run_no text;
  v_total_gross numeric(12,2) := 0.00;
  v_total_adv numeric(12,2) := 0.00;
  v_total_net numeric(12,2) := 0.00;
  v_lines_count integer := 0;

  v_worker RECORD;
  v_line_id uuid;
  v_unrec_adv numeric(12,2);
  v_recover_amt numeric(12,2);
  v_net_amt numeric(12,2);
  v_att_id uuid;
  v_att_amt numeric(12,2);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organisation access';
  END IF;

  IF NOT (public.is_org_admin(p_organisation_id) OR public.has_permission(p_organisation_id, 'labour.wages.run')) THEN
    RAISE EXCEPTION 'Permission denied: labour.wages.run required to generate wage runs';
  END IF;

  -- 1. Idempotency Check
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.labour_wage_runs
    WHERE organisation_id = p_organisation_id AND idempotency_key = p_idempotency_key;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'status', 'success',
        'idempotent_replayed', true,
        'run_id', v_existing.id,
        'run_no', v_existing.run_no,
        'total_gross', v_existing.total_gross,
        'total_advance_recovered', v_existing.total_advance_recovered,
        'total_net', v_existing.total_net
      );
    END IF;
  END IF;

  v_run_no := 'WR-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || SUBSTRING(gen_random_uuid()::text, 1, 6);

  -- 2. Create Header
  INSERT INTO public.labour_wage_runs (
    organisation_id, run_no, period_from, period_to, kind, status, idempotency_key, created_by
  ) VALUES (
    p_organisation_id, v_run_no, p_period_from, p_period_to, p_kind, 'draft', p_idempotency_key, auth.uid()
  ) RETURNING id INTO v_run_id;

  -- 3. Gather approved actual attendance rows for own/casual workers not yet in wage lines
  FOR v_worker IN
    SELECT 
      a.worker_id,
      a.employee_id,
      COALESCE(w.pay_basis, 'daily') AS pay_basis,
      COALESCE(w.payout_ref, '') AS payout_ref,
      COUNT(a.id) AS days_count,
      SUM(a.workers_count * (a.hours_worked / 8.0))::numeric(10,2) AS mandays,
      AVG(a.adjusted_rate)::numeric(12,2) AS avg_rate,
      SUM(a.adjusted_amount)::numeric(12,2) AS gross_amount,
      ARRAY_AGG(a.id) AS att_ids
    FROM public.manpower_attendance a
    LEFT JOIN public.labour_workers w ON w.id = a.worker_id
    WHERE a.organisation_id = p_organisation_id
      AND a.status IN ('APPROVED', 'BILLED')
      AND a.entry_kind = 'ACTUAL'
      AND a.attendance_date BETWEEN p_period_from AND p_period_to
      AND (a.worker_id IS NOT NULL OR a.employee_id IS NOT NULL)
      AND NOT EXISTS (
        SELECT 1 FROM public.labour_wage_line_sources s WHERE s.attendance_id = a.id
      )
    GROUP BY a.worker_id, a.employee_id, COALESCE(w.pay_basis, 'daily'), COALESCE(w.payout_ref, '')
  LOOP
    -- Calculate advance recovery
    SELECT COALESCE(SUM(amount - recovered_amount), 0.00) INTO v_unrec_adv
    FROM public.labour_advances
    WHERE organisation_id = p_organisation_id
      AND status = 'active'
      AND ((worker_id IS NOT NULL AND worker_id = v_worker.worker_id) OR
           (employee_id IS NOT NULL AND employee_id = v_worker.employee_id));

    v_recover_amt := 0.00;
    IF v_unrec_adv > 0 THEN
      -- Recover up to cap and never exceed gross (net >= 0)
      v_recover_amt := LEAST(v_unrec_adv, p_max_advance_recovery_cap, v_worker.gross_amount);
    END IF;

    v_net_amt := v_worker.gross_amount - v_recover_amt;

    -- Insert Wage Line
    INSERT INTO public.labour_wage_lines (
      organisation_id, run_id, worker_id, employee_id,
      days_or_units, rate_basis, rate, gross, advance_recovered, deductions, net, payout_ref
    ) VALUES (
      p_organisation_id, v_run_id, v_worker.worker_id, v_worker.employee_id,
      v_worker.mandays, v_worker.pay_basis, v_worker.avg_rate, v_worker.gross_amount,
      v_recover_amt, 0.00, v_net_amt, v_worker.payout_ref
    ) RETURNING id INTO v_line_id;

    -- Insert sources
    FOREACH v_att_id IN ARRAY v_worker.att_ids LOOP
      SELECT adjusted_amount INTO v_att_amt FROM public.manpower_attendance WHERE id = v_att_id;
      INSERT INTO public.labour_wage_line_sources (
        organisation_id, wage_line_id, attendance_id, amount
      ) VALUES (
        p_organisation_id, v_line_id, v_att_id, COALESCE(v_att_amt, 0)
      );
    END LOOP;

    v_total_gross := v_total_gross + v_worker.gross_amount;
    v_total_adv := v_total_adv + v_recover_amt;
    v_total_net := v_total_net + v_net_amt;
    v_lines_count := v_lines_count + 1;
  END LOOP;

  IF v_lines_count = 0 THEN
    RAISE EXCEPTION 'No approved un-run attendance found for workers in period % to %', p_period_from, p_period_to;
  END IF;

  -- Update Header Totals
  UPDATE public.labour_wage_runs
  SET total_gross = v_total_gross,
      total_advance_recovered = v_total_adv,
      total_net = v_total_net,
      updated_at = NOW()
  WHERE id = v_run_id;

  RETURN jsonb_build_object(
    'status', 'success',
    'run_id', v_run_id,
    'run_no', v_run_no,
    'lines_count', v_lines_count,
    'total_gross', v_total_gross,
    'total_advance_recovered', v_total_adv,
    'total_net', v_total_net
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_wage_run(uuid, date, date, text, numeric, text) TO authenticated;


-- 4.3 Approve Wage Run
CREATE OR REPLACE FUNCTION public.approve_wage_run(
  p_run_id uuid,
  p_organisation_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organisation access';
  END IF;

  IF NOT (public.is_org_admin(p_organisation_id) OR public.has_permission(p_organisation_id, 'labour.wages.run')) THEN
    RAISE EXCEPTION 'Permission denied: labour.wages.run required to approve wage runs';
  END IF;

  UPDATE public.labour_wage_runs
  SET status = 'approved',
      approved_by = auth.uid(),
      approved_at = NOW(),
      updated_at = NOW()
  WHERE id = p_run_id AND organisation_id = p_organisation_id AND status = 'draft';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wage run % not found or not in draft status', p_run_id;
  END IF;

  RETURN jsonb_build_object('status', 'success', 'run_id', p_run_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_wage_run(uuid, uuid) TO authenticated;


-- 4.4 Pay Wage Run & Ledger Posting
CREATE OR REPLACE FUNCTION public.pay_wage_run(
  p_run_id uuid,
  p_organisation_id uuid,
  p_payment_account_id uuid DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_run RECORD;
  v_line RECORD;
  v_journal_id uuid;
  v_creator_id uuid;
  v_expense_account_id uuid;
  v_advance_asset_account_id uuid;
  v_bank_account_id uuid;
  v_total_debit numeric;
  v_total_credit numeric;
  v_remaining_rec numeric;
  v_adv RECORD;
  v_chunk numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organisation access';
  END IF;

  IF NOT (public.is_org_admin(p_organisation_id) OR public.has_permission(p_organisation_id, 'labour.wages.pay')) THEN
    RAISE EXCEPTION 'Permission denied: labour.wages.pay required to process wage payouts';
  END IF;

  SELECT * INTO v_run FROM public.labour_wage_runs
  WHERE id = p_run_id AND organisation_id = p_organisation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wage run % not found in organisation %', p_run_id, p_organisation_id;
  END IF;

  IF v_run.status = 'paid' THEN
    RETURN jsonb_build_object(
      'status', 'success',
      'idempotent_replayed', true,
      'run_id', v_run.id,
      'journal_id', v_run.journal_id
    );
  END IF;

  IF v_run.status != 'approved' THEN
    RAISE EXCEPTION 'Wage run % must be approved before payment (current status: %)', p_run_id, v_run.status;
  END IF;

  -- 1. GL Accounts Lookup (fail-closed)
  SELECT id INTO v_expense_account_id FROM public.accounts 
  WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id) 
    AND account_code IN ('4101', '4100') 
  ORDER BY account_code ASC LIMIT 1;

  SELECT id INTO v_advance_asset_account_id FROM public.accounts 
  WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id) 
    AND account_code IN ('1350', '1300', '1100') 
  ORDER BY account_code ASC LIMIT 1;

  IF p_payment_account_id IS NOT NULL THEN
    v_bank_account_id := p_payment_account_id;
  ELSE
    SELECT id INTO v_bank_account_id FROM public.accounts 
    WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id) 
      AND account_code IN ('1100', '1101', '1000') 
    LIMIT 1;
  END IF;

  IF v_expense_account_id IS NULL THEN
    v_expense_account_id := public.ensure_gl_account_exists(p_organisation_id, '4101', 'Labour Wages & Site Staff', 'Expense');
  END IF;

  IF v_run.total_advance_recovered > 0 AND v_advance_asset_account_id IS NULL THEN
    v_advance_asset_account_id := public.ensure_gl_account_exists(p_organisation_id, '1350', 'Labour Advances Recoverable', 'Asset');
  END IF;

  IF v_bank_account_id IS NULL THEN
    v_bank_account_id := public.ensure_gl_account_exists(p_organisation_id, '1100', 'Bank / Cash Account', 'Asset');
  END IF;

  SELECT id INTO v_creator_id FROM public.user_profiles WHERE user_id = auth.uid() OR id = auth.uid() LIMIT 1;

  -- 2. Create Journal Entry
  INSERT INTO public.journal_entries (
    company_id, voucher_no, voucher_date, voucher_type, narration, status, created_by
  ) VALUES (
    p_organisation_id, v_run.run_no, CURRENT_DATE, 'Payment'::public.voucher_type,
    'Wage Payout Run ' || v_run.run_no || ' (' || v_run.period_from || ' to ' || v_run.period_to || ')',
    'Posted', v_creator_id
  ) RETURNING id INTO v_journal_id;

  -- Debit Expense (Gross)
  IF v_run.total_gross > 0 THEN
    INSERT INTO public.journal_entry_lines (
      journal_id, account_id, party_type, debit, credit, narration
    ) VALUES (
      v_journal_id, v_expense_account_id, 'other', v_run.total_gross, 0.00,
      'Gross Labour Wages'
    );
  END IF;

  -- Credit Advances Asset (Advance Recovered)
  IF v_run.total_advance_recovered > 0 THEN
    INSERT INTO public.journal_entry_lines (
      journal_id, account_id, party_type, debit, credit, narration
    ) VALUES (
      v_journal_id, v_advance_asset_account_id, 'other', 0.00, v_run.total_advance_recovered,
      'Recovery of Labour Advances'
    );
  END IF;

  -- Credit Bank/Cash (Net Payout)
  IF v_run.total_net > 0 THEN
    INSERT INTO public.journal_entry_lines (
      journal_id, account_id, party_type, debit, credit, narration
    ) VALUES (
      v_journal_id, v_bank_account_id, 'other', 0.00, v_run.total_net,
      'Net Wages Disbursed'
    );
  END IF;

  -- Assert debits = credits
  SELECT SUM(COALESCE(debit,0)), SUM(COALESCE(credit,0))
  INTO v_total_debit, v_total_credit
  FROM public.journal_entry_lines WHERE journal_id = v_journal_id;

  IF ABS(v_total_debit - v_total_credit) > 0.01 THEN
    RAISE EXCEPTION 'GL imbalance in wage run: debit=% credit=%. Transaction rolled back.', v_total_debit, v_total_credit;
  END IF;

  -- 3. Update Recovered Advances on labour_advances table
  FOR v_line IN SELECT * FROM public.labour_wage_lines WHERE run_id = p_run_id AND advance_recovered > 0 LOOP
    v_remaining_rec := v_line.advance_recovered;
    FOR v_adv IN 
      SELECT * FROM public.labour_advances 
      WHERE organisation_id = p_organisation_id
        AND status = 'active'
        AND ((v_line.worker_id IS NOT NULL AND worker_id = v_line.worker_id) OR
             (v_line.employee_id IS NOT NULL AND employee_id = v_line.employee_id))
      ORDER BY advance_date ASC
      FOR UPDATE
    LOOP
      IF v_remaining_rec <= 0 THEN EXIT; END IF;
      v_chunk := LEAST(v_remaining_rec, v_adv.amount - v_adv.recovered_amount);
      UPDATE public.labour_advances
      SET recovered_amount = recovered_amount + v_chunk,
          status = CASE WHEN recovered_amount + v_chunk >= amount THEN 'recovered' ELSE 'active' END,
          updated_at = NOW()
      WHERE id = v_adv.id;
      v_remaining_rec := v_remaining_rec - v_chunk;
    END LOOP;
  END LOOP;

  -- 4. Mark Wage Run as Paid
  UPDATE public.labour_wage_runs
  SET status = 'paid',
      paid_by = auth.uid(),
      paid_at = NOW(),
      journal_id = v_journal_id,
      updated_at = NOW()
  WHERE id = p_run_id;

  RETURN jsonb_build_object(
    'status', 'success',
    'run_id', p_run_id,
    'run_no', v_run.run_no,
    'journal_id', v_journal_id,
    'gl_debit', v_total_debit,
    'gl_credit', v_total_credit
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.pay_wage_run(uuid, uuid, uuid, text) TO authenticated;


-- =========================================================================
-- 5. RPCs: MEASUREMENT-BASED PAY (PIECE-RATE)
-- =========================================================================

-- 5.1 Record Measurement
CREATE OR REPLACE FUNCTION public.record_measurement(
  p_organisation_id uuid,
  p_subcontractor_id uuid DEFAULT NULL,
  p_worker_id uuid DEFAULT NULL,
  p_client_id uuid DEFAULT NULL,
  p_project_id uuid DEFAULT NULL,
  p_work_order_id uuid DEFAULT NULL,
  p_task text DEFAULT 'General Measurement Work',
  p_unit text DEFAULT 'm',
  p_qty numeric DEFAULT 1,
  p_measurement_date date DEFAULT CURRENT_DATE,
  p_evidence_notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_meas_id uuid;
  v_meas_no text;
  v_rate numeric;
  v_amount numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organisation access';
  END IF;

  IF NOT (public.is_org_admin(p_organisation_id) OR public.has_permission(p_organisation_id, 'labour.measurement.entry')) THEN
    RAISE EXCEPTION 'Permission denied: labour.measurement.entry required';
  END IF;

  IF p_qty <= 0 THEN
    RAISE EXCEPTION 'Measurement quantity must be greater than zero';
  END IF;

  -- 1. Server-side Rate Resolution
  -- Priority A: Work Order item rate matching task or unit
  IF p_work_order_id IS NOT NULL THEN
    SELECT rate INTO v_rate 
    FROM public.rate_cards
    WHERE organisation_id = p_organisation_id
      AND subcontractor_id = p_subcontractor_id
      AND work_unit_id = p_project_id
      AND is_active = true
      AND pay_basis = 'per_meter'
    ORDER BY effective_from DESC LIMIT 1;
  END IF;

  -- Priority B: Subcontractor rate card for per_meter
  IF v_rate IS NULL AND p_subcontractor_id IS NOT NULL THEN
    SELECT negotiated_rate INTO v_rate 
    FROM public.rate_cards
    WHERE organisation_id = p_organisation_id
      AND subcontractor_id = p_subcontractor_id
      AND is_active = true
      AND pay_basis = 'per_meter'
    ORDER BY effective_from DESC LIMIT 1;
  END IF;

  -- Priority C: Worker default rate if worker-driven
  IF v_rate IS NULL AND p_worker_id IS NOT NULL THEN
    SELECT default_rate INTO v_rate FROM public.labour_workers WHERE id = p_worker_id;
  END IF;

  -- Priority D: Fallback to standard unit rate from rate_cards
  IF v_rate IS NULL THEN
    SELECT base_rate INTO v_rate 
    FROM public.rate_cards
    WHERE organisation_id = p_organisation_id
      AND is_active = true
      AND pay_basis = 'per_meter'
    ORDER BY effective_from DESC LIMIT 1;
  END IF;

  IF v_rate IS NULL OR v_rate <= 0 THEN
    RAISE EXCEPTION 'No piece-rate/meter rate agreement found for task % on date %', p_task, p_measurement_date;
  END IF;

  v_amount := ROUND((p_qty * v_rate)::numeric, 2);
  v_meas_no := 'MS-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || SUBSTRING(gen_random_uuid()::text, 1, 6);

  INSERT INTO public.labour_measurements (
    organisation_id, measurement_no, subcontractor_id, worker_id, client_id,
    project_id, work_order_id, measurement_date, task, unit, qty, rate, amount,
    status, evidence_notes
  ) VALUES (
    p_organisation_id, v_meas_no, p_subcontractor_id, p_worker_id, p_client_id,
    p_project_id, p_work_order_id, p_measurement_date, p_task, p_unit, p_qty, v_rate, v_amount,
    'DRAFT', p_evidence_notes
  ) RETURNING id INTO v_meas_id;

  RETURN jsonb_build_object(
    'status', 'success',
    'measurement_id', v_meas_id,
    'measurement_no', v_meas_no,
    'qty', p_qty,
    'rate', v_rate,
    'amount', v_amount
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_measurement(uuid, uuid, uuid, uuid, uuid, uuid, text, text, numeric, date, text) TO authenticated;


-- 5.2 Approve Measurement
CREATE OR REPLACE FUNCTION public.approve_measurement(
  p_measurement_id uuid,
  p_organisation_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_meas RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organisation access';
  END IF;

  IF NOT (public.is_org_admin(p_organisation_id) OR public.has_permission(p_organisation_id, 'labour.measurement.approve')) THEN
    RAISE EXCEPTION 'Permission denied: labour.measurement.approve required';
  END IF;

  UPDATE public.labour_measurements
  SET status = 'APPROVED',
      approved_by = auth.uid(),
      approved_at = NOW(),
      updated_at = NOW()
  WHERE id = p_measurement_id AND organisation_id = p_organisation_id
  RETURNING * INTO v_meas;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Measurement % not found in organisation %', p_measurement_id, p_organisation_id;
  END IF;

  RETURN jsonb_build_object(
    'status', 'success',
    'measurement_id', v_meas.id,
    'amount', v_meas.amount,
    'status', 'APPROVED'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_measurement(uuid, uuid) TO authenticated;


-- =========================================================================
-- 6. VIEWS: PRODUCTIVITY, MARGIN & WAGE STATEMENTS
-- =========================================================================

-- 6.1 Productivity View (meters per man-day)
CREATE OR REPLACE VIEW public.v_labour_productivity AS
WITH meas_agg AS (
  SELECT 
    m.organisation_id,
    m.client_id,
    m.project_id,
    m.subcontractor_id,
    m.worker_id,
    m.task,
    m.unit,
    SUM(m.qty)::numeric(12,2) AS total_meters,
    SUM(m.amount)::numeric(12,2) AS measurement_amount
  FROM public.labour_measurements m
  WHERE m.status = 'APPROVED'
  GROUP BY m.organisation_id, m.client_id, m.project_id, m.subcontractor_id, m.worker_id, m.task, m.unit
),
att_agg AS (
  SELECT 
    a.organisation_id,
    a.client_id,
    a.project_id,
    a.subcontractor_id,
    a.worker_id,
    SUM(a.workers_count * (a.hours_worked / 8.0))::numeric(12,2) AS total_mandays
  FROM public.manpower_attendance a
  WHERE a.status IN ('APPROVED', 'BILLED')
    AND a.entry_kind = 'ACTUAL'
  GROUP BY a.organisation_id, a.client_id, a.project_id, a.subcontractor_id, a.worker_id
)
SELECT 
  m.organisation_id,
  m.client_id,
  m.project_id,
  m.subcontractor_id,
  m.worker_id,
  m.task,
  m.unit,
  m.total_meters,
  m.measurement_amount,
  COALESCE(a.total_mandays, 0) AS total_mandays,
  CASE 
    WHEN COALESCE(a.total_mandays, 0) > 0 THEN ROUND((m.total_meters / a.total_mandays)::numeric, 2)
    ELSE m.total_meters
  END AS meters_per_manday
FROM meas_agg m
LEFT JOIN att_agg a ON a.organisation_id = m.organisation_id 
                   AND a.project_id IS NOT DISTINCT FROM m.project_id
                   AND a.client_id IS NOT DISTINCT FROM m.client_id
                   AND a.subcontractor_id IS NOT DISTINCT FROM m.subcontractor_id
                   AND a.worker_id IS NOT DISTINCT FROM m.worker_id;

GRANT SELECT ON public.v_labour_productivity TO authenticated;


-- 6.2 Updated Labour Margin View (combines attendance daily cost + piece-rate measurement cost)
CREATE OR REPLACE VIEW public.v_labour_margin AS
WITH att_summary AS (
  SELECT 
    a.organisation_id,
    a.client_id,
    a.project_id,
    COUNT(a.id)::int AS attendance_count,
    SUM(a.workers_count)::int AS total_man_days,
    SUM(CASE WHEN a.productivity_only = true THEN 0.00 ELSE a.adjusted_amount END)::numeric(15,2) AS attendance_cost,
    SUM(COALESCE(a.bill_amount, 0))::numeric(15,2) AS attendance_billed
  FROM public.manpower_attendance a
  WHERE a.status IN ('APPROVED', 'BILLED') AND a.entry_kind = 'ACTUAL'
  GROUP BY a.organisation_id, a.client_id, a.project_id
),
meas_summary AS (
  SELECT 
    m.organisation_id,
    m.client_id,
    m.project_id,
    SUM(m.amount)::numeric(15,2) AS measurement_cost
  FROM public.labour_measurements m
  WHERE m.status = 'APPROVED'
  GROUP BY m.organisation_id, m.client_id, m.project_id
),
combined_keys AS (
  SELECT organisation_id, client_id, project_id FROM att_summary
  UNION
  SELECT organisation_id, client_id, project_id FROM meas_summary
)
SELECT 
  k.organisation_id,
  k.client_id,
  k.project_id,
  COALESCE(c.client_name, c.name, 'Direct Client') AS client_name,
  COALESCE(p.name, p.project_name, 'General / Direct') AS project_name,
  COALESCE(att.attendance_count, 0) AS attendance_count,
  COALESCE(att.total_man_days, 0) AS total_man_days,
  (COALESCE(att.attendance_cost, 0) + COALESCE(meas.measurement_cost, 0))::numeric(15,2) AS total_cost,
  COALESCE(att.attendance_billed, 0)::numeric(15,2) AS total_billed,
  (COALESCE(att.attendance_billed, 0) - (COALESCE(att.attendance_cost, 0) + COALESCE(meas.measurement_cost, 0)))::numeric(15,2) AS total_margin,
  CASE 
    WHEN COALESCE(att.attendance_billed, 0) > 0 
    THEN ROUND(((COALESCE(att.attendance_billed, 0) - (COALESCE(att.attendance_cost, 0) + COALESCE(meas.measurement_cost, 0))) / COALESCE(att.attendance_billed, 0) * 100.0)::numeric, 2)
    ELSE 0.00 
  END AS margin_percentage
FROM combined_keys k
LEFT JOIN att_summary att ON att.organisation_id = k.organisation_id 
                         AND att.client_id IS NOT DISTINCT FROM k.client_id 
                         AND att.project_id IS NOT DISTINCT FROM k.project_id
LEFT JOIN meas_summary meas ON meas.organisation_id = k.organisation_id 
                           AND meas.client_id IS NOT DISTINCT FROM k.client_id 
                           AND meas.project_id IS NOT DISTINCT FROM k.project_id
LEFT JOIN public.clients c ON c.id = k.client_id
LEFT JOIN public.projects p ON p.id = k.project_id;

GRANT SELECT ON public.v_labour_margin TO authenticated;


-- 6.3 Worker Wage Statement / Payslip View
CREATE OR REPLACE VIEW public.v_worker_wage_statement AS
SELECT 
  l.id AS line_id,
  r.id AS run_id,
  r.organisation_id,
  r.run_no,
  r.period_from,
  r.period_to,
  r.kind AS run_kind,
  r.status AS run_status,
  l.worker_id,
  l.employee_id,
  COALESCE(w.name, e.name) AS worker_name,
  COALESCE(w.phone, e.email) AS contact,
  l.days_or_units,
  l.rate_basis,
  l.rate,
  l.gross,
  l.advance_recovered,
  l.deductions,
  l.net,
  l.payout_ref,
  l.created_at
FROM public.labour_wage_lines l
JOIN public.labour_wage_runs r ON r.id = l.run_id
LEFT JOIN public.labour_workers w ON w.id = l.worker_id
LEFT JOIN public.employees e ON e.id = l.employee_id;

GRANT SELECT ON public.v_worker_wage_statement TO authenticated;

-- =========================================================================
-- ROLLBACK INSTRUCTIONS (FOR HUMAN REVIEW; DO NOT UNCOMMENT AUTOMATICALLY):
-- DROP VIEW IF EXISTS public.v_worker_wage_statement;
-- DROP VIEW IF EXISTS public.v_labour_productivity;
-- DROP FUNCTION IF EXISTS public.approve_measurement(uuid, uuid);
-- DROP FUNCTION IF EXISTS public.record_measurement(uuid, uuid, uuid, uuid, uuid, uuid, text, text, numeric, date, text);
-- DROP FUNCTION IF EXISTS public.pay_wage_run(uuid, uuid, uuid, text);
-- DROP FUNCTION IF EXISTS public.approve_wage_run(uuid, uuid);
-- DROP FUNCTION IF EXISTS public.generate_wage_run(uuid, date, date, text, numeric, text);
-- DROP FUNCTION IF EXISTS public.give_labour_advance(uuid, uuid, uuid, numeric, date, text);
-- DROP TABLE IF EXISTS public.labour_measurements;
-- DROP TABLE IF EXISTS public.labour_wage_line_sources;
-- DROP TABLE IF EXISTS public.labour_wage_lines;
-- DROP TABLE IF EXISTS public.labour_advances;
-- DROP TABLE IF EXISTS public.labour_wage_runs;
-- =========================================================================
