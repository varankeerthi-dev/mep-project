-- ============================================
-- SITE REPORT CHILD TABLES
-- Phase C: normalise JSON-stringified columns to proper child tables
-- Run in Supabase SQL Editor
-- ============================================

-- ------------------------------------------------------------
-- 0. Helper: current_org_id() (re-defined for self-containedness;
--    identical to database-site-report-photos.sql)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT organisation_id FROM public.org_members
  WHERE user_id = auth.uid()
    AND (status = 'active' OR status = 'Active' OR status IS NULL)
  ORDER BY joined_at DESC
  LIMIT 1
$$;

-- ============================================
-- 1. site_report_client_requirements
--    Replaces site_reports.client_req_details JSON
--    Form shape: [{ value: string }]
-- ============================================
CREATE TABLE IF NOT EXISTS public.site_report_client_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  report_id uuid NOT NULL REFERENCES public.site_reports(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sr_client_req_report ON public.site_report_client_requirements(report_id);
CREATE INDEX IF NOT EXISTS idx_sr_client_req_org ON public.site_report_client_requirements(organisation_id);
CREATE INDEX IF NOT EXISTS idx_sr_client_req_sort ON public.site_report_client_requirements(report_id, sort_order);

-- ============================================
-- 2. site_report_work_plan_next_day
--    Replaces site_reports.work_plan_next_day JSON
--    Form shape: [{ value: string }]
-- ============================================
CREATE TABLE IF NOT EXISTS public.site_report_work_plan_next_day (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  report_id uuid NOT NULL REFERENCES public.site_reports(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sr_wpnd_report ON public.site_report_work_plan_next_day(report_id);
CREATE INDEX IF NOT EXISTS idx_sr_wpnd_org ON public.site_report_work_plan_next_day(organisation_id);
CREATE INDEX IF NOT EXISTS idx_sr_wpnd_sort ON public.site_report_work_plan_next_day(report_id, sort_order);

-- ============================================
-- 3. site_report_special_instructions
--    Replaces site_reports.special_instructions JSON
--    Form shape: [{ value: string }]
-- ============================================
CREATE TABLE IF NOT EXISTS public.site_report_special_instructions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  report_id uuid NOT NULL REFERENCES public.site_reports(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sr_si_report ON public.site_report_special_instructions(report_id);
CREATE INDEX IF NOT EXISTS idx_sr_si_org ON public.site_report_special_instructions(organisation_id);
CREATE INDEX IF NOT EXISTS idx_sr_si_sort ON public.site_report_special_instructions(report_id, sort_order);

-- ============================================
-- 4. site_report_issues_faced
--    Replaces site_reports.issues_faced JSON
--    Form shape: [{ issue: string, solution: string }]
-- ============================================
CREATE TABLE IF NOT EXISTS public.site_report_issues_faced (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  report_id uuid NOT NULL REFERENCES public.site_reports(id) ON DELETE CASCADE,
  issue text NOT NULL DEFAULT '',
  solution text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sr_issues_report ON public.site_report_issues_faced(report_id);
CREATE INDEX IF NOT EXISTS idx_sr_issues_org ON public.site_report_issues_faced(organisation_id);
CREATE INDEX IF NOT EXISTS idx_sr_issues_sort ON public.site_report_issues_faced(report_id, sort_order);

-- ============================================
-- 5. RLS on all four tables
--    Pattern: organisation_id = current_org_id()
-- ============================================
ALTER TABLE public.site_report_client_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_report_work_plan_next_day ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_report_special_instructions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_report_issues_faced ENABLE ROW LEVEL SECURITY;

-- client_requirements
DROP POLICY IF EXISTS "sr_cr_select" ON public.site_report_client_requirements;
DROP POLICY IF EXISTS "sr_cr_insert" ON public.site_report_client_requirements;
DROP POLICY IF EXISTS "sr_cr_update" ON public.site_report_client_requirements;
DROP POLICY IF EXISTS "sr_cr_delete" ON public.site_report_client_requirements;
CREATE POLICY "sr_cr_select" ON public.site_report_client_requirements FOR SELECT TO authenticated USING (organisation_id = public.current_org_id());
CREATE POLICY "sr_cr_insert" ON public.site_report_client_requirements FOR INSERT TO authenticated WITH CHECK (organisation_id = public.current_org_id());
CREATE POLICY "sr_cr_update" ON public.site_report_client_requirements FOR UPDATE TO authenticated USING (organisation_id = public.current_org_id()) WITH CHECK (organisation_id = public.current_org_id());
CREATE POLICY "sr_cr_delete" ON public.site_report_client_requirements FOR DELETE TO authenticated USING (organisation_id = public.current_org_id());

-- work_plan_next_day
DROP POLICY IF EXISTS "sr_wpnd_select" ON public.site_report_work_plan_next_day;
DROP POLICY IF EXISTS "sr_wpnd_insert" ON public.site_report_work_plan_next_day;
DROP POLICY IF EXISTS "sr_wpnd_update" ON public.site_report_work_plan_next_day;
DROP POLICY IF EXISTS "sr_wpnd_delete" ON public.site_report_work_plan_next_day;
CREATE POLICY "sr_wpnd_select" ON public.site_report_work_plan_next_day FOR SELECT TO authenticated USING (organisation_id = public.current_org_id());
CREATE POLICY "sr_wpnd_insert" ON public.site_report_work_plan_next_day FOR INSERT TO authenticated WITH CHECK (organisation_id = public.current_org_id());
CREATE POLICY "sr_wpnd_update" ON public.site_report_work_plan_next_day FOR UPDATE TO authenticated USING (organisation_id = public.current_org_id()) WITH CHECK (organisation_id = public.current_org_id());
CREATE POLICY "sr_wpnd_delete" ON public.site_report_work_plan_next_day FOR DELETE TO authenticated USING (organisation_id = public.current_org_id());

-- special_instructions
DROP POLICY IF EXISTS "sr_si_select" ON public.site_report_special_instructions;
DROP POLICY IF EXISTS "sr_si_insert" ON public.site_report_special_instructions;
DROP POLICY IF EXISTS "sr_si_update" ON public.site_report_special_instructions;
DROP POLICY IF EXISTS "sr_si_delete" ON public.site_report_special_instructions;
CREATE POLICY "sr_si_select" ON public.site_report_special_instructions FOR SELECT TO authenticated USING (organisation_id = public.current_org_id());
CREATE POLICY "sr_si_insert" ON public.site_report_special_instructions FOR INSERT TO authenticated WITH CHECK (organisation_id = public.current_org_id());
CREATE POLICY "sr_si_update" ON public.site_report_special_instructions FOR UPDATE TO authenticated USING (organisation_id = public.current_org_id()) WITH CHECK (organisation_id = public.current_org_id());
CREATE POLICY "sr_si_delete" ON public.site_report_special_instructions FOR DELETE TO authenticated USING (organisation_id = public.current_org_id());

-- issues_faced
DROP POLICY IF EXISTS "sr_issues_select" ON public.site_report_issues_faced;
DROP POLICY IF EXISTS "sr_issues_insert" ON public.site_report_issues_faced;
DROP POLICY IF EXISTS "sr_issues_update" ON public.site_report_issues_faced;
DROP POLICY IF EXISTS "sr_issues_delete" ON public.site_report_issues_faced;
CREATE POLICY "sr_issues_select" ON public.site_report_issues_faced FOR SELECT TO authenticated USING (organisation_id = public.current_org_id());
CREATE POLICY "sr_issues_insert" ON public.site_report_issues_faced FOR INSERT TO authenticated WITH CHECK (organisation_id = public.current_org_id());
CREATE POLICY "sr_issues_update" ON public.site_report_issues_faced FOR UPDATE TO authenticated USING (organisation_id = public.current_org_id()) WITH CHECK (organisation_id = public.current_org_id());
CREATE POLICY "sr_issues_delete" ON public.site_report_issues_faced FOR DELETE TO authenticated USING (organisation_id = public.current_org_id());

-- ============================================
-- 6. Backfill: parse existing JSON columns into the new tables
--    Idempotent: uses NOT EXISTS to avoid duplicates on re-run.
--    Skips rows with invalid JSON (logged as RAISE NOTICE).
-- ============================================
DO $$
DECLARE
  r RECORD;
  arr JSONB;
  elem JSONB;
  i INT;
BEGIN
  -- --- client_req_details -> site_report_client_requirements
  FOR r IN SELECT id, organisation_id, client_req_details FROM public.site_reports
           WHERE client_req_details IS NOT NULL AND TRIM(client_req_details) != '' LOOP
    BEGIN
      arr := r.client_req_details::jsonb;
      IF jsonb_typeof(arr) != 'array' THEN CONTINUE; END IF;
      i := 0;
      FOR elem IN SELECT * FROM jsonb_array_elements(arr) LOOP
        IF jsonb_typeof(elem) = 'object' AND elem ? 'value' AND NULLIF(TRIM(elem->>'value'), '') IS NOT NULL THEN
          IF NOT EXISTS (
            SELECT 1 FROM public.site_report_client_requirements
            WHERE report_id = r.id AND sort_order = i
          ) THEN
            INSERT INTO public.site_report_client_requirements (organisation_id, report_id, description, sort_order)
            VALUES (r.organisation_id, r.id, TRIM(elem->>'value'), i);
          END IF;
          i := i + 1;
        END IF;
      END LOOP;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skip report % (client_req_details): %', r.id, SQLERRM;
    END;
  END LOOP;

  -- --- work_plan_next_day -> site_report_work_plan_next_day
  FOR r IN SELECT id, organisation_id, work_plan_next_day FROM public.site_reports
           WHERE work_plan_next_day IS NOT NULL AND TRIM(work_plan_next_day) != '' LOOP
    BEGIN
      arr := r.work_plan_next_day::jsonb;
      IF jsonb_typeof(arr) != 'array' THEN CONTINUE; END IF;
      i := 0;
      FOR elem IN SELECT * FROM jsonb_array_elements(arr) LOOP
        IF jsonb_typeof(elem) = 'object' AND elem ? 'value' AND NULLIF(TRIM(elem->>'value'), '') IS NOT NULL THEN
          IF NOT EXISTS (
            SELECT 1 FROM public.site_report_work_plan_next_day
            WHERE report_id = r.id AND sort_order = i
          ) THEN
            INSERT INTO public.site_report_work_plan_next_day (organisation_id, report_id, description, sort_order)
            VALUES (r.organisation_id, r.id, TRIM(elem->>'value'), i);
          END IF;
          i := i + 1;
        END IF;
      END LOOP;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skip report % (work_plan_next_day): %', r.id, SQLERRM;
    END;
  END LOOP;

  -- --- special_instructions -> site_report_special_instructions
  FOR r IN SELECT id, organisation_id, special_instructions FROM public.site_reports
           WHERE special_instructions IS NOT NULL AND TRIM(special_instructions) != '' LOOP
    BEGIN
      arr := r.special_instructions::jsonb;
      IF jsonb_typeof(arr) != 'array' THEN CONTINUE; END IF;
      i := 0;
      FOR elem IN SELECT * FROM jsonb_array_elements(arr) LOOP
        IF jsonb_typeof(elem) = 'object' AND elem ? 'value' AND NULLIF(TRIM(elem->>'value'), '') IS NOT NULL THEN
          IF NOT EXISTS (
            SELECT 1 FROM public.site_report_special_instructions
            WHERE report_id = r.id AND sort_order = i
          ) THEN
            INSERT INTO public.site_report_special_instructions (organisation_id, report_id, description, sort_order)
            VALUES (r.organisation_id, r.id, TRIM(elem->>'value'), i);
          END IF;
          i := i + 1;
        END IF;
      END LOOP;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skip report % (special_instructions): %', r.id, SQLERRM;
    END;
  END LOOP;

  -- --- issues_faced -> site_report_issues_faced
  FOR r IN SELECT id, organisation_id, issues_faced FROM public.site_reports
           WHERE issues_faced IS NOT NULL AND TRIM(issues_faced) != '' LOOP
    BEGIN
      arr := r.issues_faced::jsonb;
      IF jsonb_typeof(arr) != 'array' THEN CONTINUE; END IF;
      i := 0;
      FOR elem IN SELECT * FROM jsonb_array_elements(arr) LOOP
        IF jsonb_typeof(elem) = 'object' AND elem ? 'issue' AND NULLIF(TRIM(elem->>'issue'), '') IS NOT NULL THEN
          IF NOT EXISTS (
            SELECT 1 FROM public.site_report_issues_faced
            WHERE report_id = r.id AND sort_order = i
          ) THEN
            INSERT INTO public.site_report_issues_faced (organisation_id, report_id, issue, solution, sort_order)
            VALUES (
              r.organisation_id,
              r.id,
              TRIM(elem->>'issue'),
              COALESCE(NULLIF(TRIM(elem->>'solution'), ''), ''),
              i
            );
          END IF;
          i := i + 1;
        END IF;
      END LOOP;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skip report % (issues_faced): %', r.id, SQLERRM;
    END;
  END LOOP;
END $$;
