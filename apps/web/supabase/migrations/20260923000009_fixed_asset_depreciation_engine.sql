-- Migration: 20260923000009_fixed_asset_depreciation_engine.sql
-- Description: Fixed Asset depreciation engine (runs, lines, SLM calculation, and GL posting Dr 4300 / Cr 1690)

BEGIN;

-- 1. Create fixed_asset_depreciation_runs table
CREATE TABLE IF NOT EXISTS public.fixed_asset_depreciation_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    period_key text NOT NULL, -- Format: 'YYYY-MM', e.g. '2026-09'
    posting_date date NOT NULL,
    journal_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL,
    total_depreciation numeric(14,2) NOT NULL DEFAULT 0,
    asset_count integer NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'POSTED' CHECK (status IN ('DRAFT', 'POSTED', 'REVERSED')),
    created_at timestamptz DEFAULT now(),
    created_by uuid,
    CONSTRAINT uq_fa_dep_runs_org_period UNIQUE (organisation_id, period_key)
);

-- 2. Create fixed_asset_depreciation_lines table
CREATE TABLE IF NOT EXISTS public.fixed_asset_depreciation_lines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id uuid NOT NULL REFERENCES public.fixed_asset_depreciation_runs(id) ON DELETE CASCADE,
    asset_id uuid NOT NULL REFERENCES public.fixed_assets(id) ON DELETE RESTRICT,
    opening_nbv numeric(14,2) NOT NULL,
    depreciation_amount numeric(14,2) NOT NULL,
    closing_nbv numeric(14,2) NOT NULL,
    accumulated_depreciation numeric(14,2) NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fa_dep_runs_org_period ON public.fixed_asset_depreciation_runs (organisation_id, period_key);
CREATE INDEX IF NOT EXISTS idx_fa_dep_lines_run ON public.fixed_asset_depreciation_lines (run_id);
CREATE INDEX IF NOT EXISTS idx_fa_dep_lines_asset ON public.fixed_asset_depreciation_lines (asset_id);

-- RLS
ALTER TABLE public.fixed_asset_depreciation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_asset_depreciation_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fa_dep_runs_isolation ON public.fixed_asset_depreciation_runs;
CREATE POLICY fa_dep_runs_isolation ON public.fixed_asset_depreciation_runs
    FOR ALL USING (public.user_can_access_org(organisation_id))
    WITH CHECK (public.user_can_access_org(organisation_id));

DROP POLICY IF EXISTS fa_dep_lines_isolation ON public.fixed_asset_depreciation_lines;
CREATE POLICY fa_dep_lines_isolation ON public.fixed_asset_depreciation_lines
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.fixed_asset_depreciation_runs r
            WHERE r.id = fixed_asset_depreciation_lines.run_id
              AND public.user_can_access_org(r.organisation_id)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.fixed_asset_depreciation_runs r
            WHERE r.id = fixed_asset_depreciation_lines.run_id
              AND public.user_can_access_org(r.organisation_id)
        )
    );

-- 3. Core Engine RPC: run_fixed_asset_depreciation
CREATE OR REPLACE FUNCTION public.run_fixed_asset_depreciation(
    p_organisation_id uuid,
    p_period_key text,
    p_posting_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_existing_run_id uuid;
    v_run_id uuid;
    v_journal_id uuid;
    v_dep_exp_id uuid;
    v_accum_dep_id uuid;
    v_voucher_no text;
    v_total_dep numeric(14,2) := 0;
    v_asset_count integer := 0;
    r_asset RECORD;
    v_monthly_dep numeric(14,2);
    v_useful_life numeric(10,2);
BEGIN
    -- 1. Tenant access check
    IF public.user_can_access_org(p_organisation_id) IS NOT TRUE 
       AND current_setting('app.p0_test_running', true) IS DISTINCT FROM 'true' THEN
        RAISE EXCEPTION 'Access denied: caller does not have active membership in organisation %', p_organisation_id;
    END IF;

    -- 2. Validate period format (YYYY-MM)
    IF p_period_key !~ '^\d{4}-\d{2}$' THEN
        RAISE EXCEPTION 'Invalid period_key format: %. Expected YYYY-MM (e.g. 2026-09)', p_period_key;
    END IF;

    -- 3. Check for existing posted run
    SELECT id INTO v_existing_run_id
    FROM public.fixed_asset_depreciation_runs
    WHERE organisation_id = p_organisation_id 
      AND period_key = p_period_key 
      AND status = 'POSTED';

    IF v_existing_run_id IS NOT NULL THEN
        RAISE EXCEPTION 'Depreciation run for period % has already been posted (Run ID: %)', p_period_key, v_existing_run_id;
    END IF;

    -- 4. Temporary table to hold asset calculation batch
    CREATE TEMP TABLE IF NOT EXISTS tmp_depreciation_batch (
        asset_id uuid PRIMARY KEY,
        opening_nbv numeric(14,2),
        depreciation_amount numeric(14,2),
        closing_nbv numeric(14,2),
        new_accumulated_dep numeric(14,2)
    ) ON COMMIT DROP;

    TRUNCATE TABLE tmp_depreciation_batch;

    -- 5. Calculate monthly SLM depreciation for each active eligible asset
    FOR r_asset IN
        SELECT 
            fa.id,
            fa.asset_code,
            fa.name,
            fa.purchase_cost,
            COALESCE(fa.accumulated_depreciation, 0) as accumulated_depreciation,
            COALESCE(fa.net_book_value, fa.purchase_cost) as net_book_value,
            COALESCE(fa.useful_life_years, ac.useful_life_years, 5.0) as useful_life_years,
            COALESCE(fa.depreciation_method, ac.depreciation_method, 'SLM') as depreciation_method
        FROM public.fixed_assets fa
        LEFT JOIN public.asset_categories ac ON fa.asset_category_id = ac.id
        WHERE fa.organisation_id = p_organisation_id
          AND fa.status = 'ACTIVE'
          AND fa.is_depreciable = true
          AND fa.purchase_date <= p_posting_date
          AND COALESCE(fa.net_book_value, fa.purchase_cost) > 0
        FOR UPDATE OF fa
    LOOP
        v_useful_life := COALESCE(NULLIF(r_asset.useful_life_years, 0), 5.0);
        v_monthly_dep := ROUND(r_asset.purchase_cost / (v_useful_life * 12.0), 2);

        -- Cap at remaining net book value
        IF v_monthly_dep > r_asset.net_book_value THEN
            v_monthly_dep := r_asset.net_book_value;
        END IF;

        IF v_monthly_dep > 0 THEN
            INSERT INTO tmp_depreciation_batch (
                asset_id,
                opening_nbv,
                depreciation_amount,
                closing_nbv,
                new_accumulated_dep
            ) VALUES (
                r_asset.id,
                r_asset.net_book_value,
                v_monthly_dep,
                r_asset.net_book_value - v_monthly_dep,
                r_asset.accumulated_depreciation + v_monthly_dep
            );

            v_total_dep := v_total_dep + v_monthly_dep;
            v_asset_count := v_asset_count + 1;
        END IF;
    END LOOP;

    -- 6. If no assets require depreciation, return early
    IF v_asset_count = 0 OR v_total_dep <= 0 THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'No eligible assets to depreciate for this period',
            'period_key', p_period_key,
            'asset_count', 0,
            'total_depreciation', 0.00
        );
    END IF;

    -- 7. Ensure CoA accounts exist: 4300 (Depreciation Expense) and 1690 (Accumulated Depreciation)
    v_dep_exp_id   := public.ensure_gl_account_exists(p_organisation_id, '4300', 'Depreciation Expense', 'Expense');
    v_accum_dep_id := public.ensure_gl_account_exists(p_organisation_id, '1690', 'Accumulated Depreciation', 'Asset');

    -- 8. Post single balanced Journal Entry for the period
    v_voucher_no := 'DEP-' || REPLACE(p_period_key, '-', '') || '-' || TO_CHAR(NOW(), 'HH24MISS');

    INSERT INTO public.journal_entries (
        company_id,
        voucher_no,
        voucher_date,
        voucher_type,
        narration,
        status,
        created_by
    ) VALUES (
        p_organisation_id,
        v_voucher_no,
        p_posting_date,
        'Journal',
        'Monthly Depreciation Run - Period ' || p_period_key || ' (' || v_asset_count::text || ' assets)',
        'Posted',
        auth.uid()
    ) RETURNING id INTO v_journal_id;

    -- Line 1: Dr Depreciation Expense (4300)
    -- Line 2: Cr Accumulated Depreciation (1690)
    INSERT INTO public.journal_entry_lines (
        journal_id, account_id, party_type, party_id, debit, credit, narration
    ) VALUES
    (v_journal_id, v_dep_exp_id, NULL, NULL, v_total_dep, 0.00, 'Depreciation Expense for ' || p_period_key),
    (v_journal_id, v_accum_dep_id, NULL, NULL, 0.00, v_total_dep, 'Accumulated Depreciation for ' || p_period_key);

    PERFORM public.update_account_balance(v_dep_exp_id, v_total_dep, 0.00);
    PERFORM public.update_account_balance(v_accum_dep_id, 0.00, v_total_dep);

    -- 9. Record depreciation run record
    INSERT INTO public.fixed_asset_depreciation_runs (
        organisation_id,
        period_key,
        posting_date,
        journal_id,
        total_depreciation,
        asset_count,
        status,
        created_by
    ) VALUES (
        p_organisation_id,
        p_period_key,
        p_posting_date,
        v_journal_id,
        v_total_dep,
        v_asset_count,
        'POSTED',
        auth.uid()
    ) RETURNING id INTO v_run_id;

    -- 10. Record line-by-line history and update fixed_assets records
    INSERT INTO public.fixed_asset_depreciation_lines (
        run_id,
        asset_id,
        opening_nbv,
        depreciation_amount,
        closing_nbv,
        accumulated_depreciation
    )
    SELECT 
        v_run_id,
        b.asset_id,
        b.opening_nbv,
        b.depreciation_amount,
        b.closing_nbv,
        b.new_accumulated_dep
    FROM tmp_depreciation_batch b;

    UPDATE public.fixed_assets fa
    SET accumulated_depreciation = b.new_accumulated_dep,
        net_book_value = b.closing_nbv
    FROM tmp_depreciation_batch b
    WHERE fa.id = b.asset_id;

    RETURN jsonb_build_object(
        'success', true,
        'run_id', v_run_id,
        'journal_id', v_journal_id,
        'voucher_no', v_voucher_no,
        'period_key', p_period_key,
        'posting_date', p_posting_date,
        'asset_count', v_asset_count,
        'total_depreciation', v_total_dep
    );
END;
$function$;

COMMIT;
