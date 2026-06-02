-- Work Stoppages for Site Reports
-- Phase H: track work stoppages per daily report with reason + expected restart date
-- Run in Supabase SQL Editor
-- Idempotent: safe to re-run

-- ------------------------------------------------------------
-- 0. Helper: current_org_id() (idempotent)
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

-- ------------------------------------------------------------
-- 1. site_report_work_stoppages
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.site_report_work_stoppages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  report_id uuid NOT NULL REFERENCES public.site_reports(id) ON DELETE CASCADE,

  -- Why work stopped
  category VARCHAR(30) NOT NULL
    CHECK (category IN (
      'payment',               -- client / sub payment issue
      'site_clearance',        -- area not handed over, civil/structural not ready
      'client_confirmation',   -- drawing/material approval pending from client
      'site_dependency',       -- another trade / sub / our team not finished
      'material',              -- material not on site
      'planned_shutdown',      -- known shutdown (monsoon, holiday, scheduled)
      'other'
    )),

  -- Which work is blocked (free text since site_reports has no system/area column)
  affected_work TEXT NOT NULL DEFAULT '',

  -- Detailed reason
  reason_detail TEXT NOT NULL DEFAULT '',

  -- Who is responsible for unblocking
  blocking_party VARCHAR(30) NOT NULL DEFAULT 'external'
    CHECK (blocking_party IN ('client', 'subcontractor', 'our_team', 'external', 'unknown')),

  -- Restart date — NULL when engineer doesn't know (e.g. payment / client confirmation).
  -- For 'planned_shutdown' the engineer should usually fill this in.
  expected_resolution_date DATE,

  -- Resolution
  is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
  actual_resolution_date DATE,
  resolution_notes TEXT DEFAULT '',

  -- Audit
  reported_by uuid,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sr_stoppages_org
  ON public.site_report_work_stoppages(organisation_id);
CREATE INDEX IF NOT EXISTS idx_sr_stoppages_report
  ON public.site_report_work_stoppages(report_id);
CREATE INDEX IF NOT EXISTS idx_sr_stoppages_open
  ON public.site_report_work_stoppages(organisation_id, is_resolved)
  WHERE is_resolved = FALSE;
CREATE INDEX IF NOT EXISTS idx_sr_stoppages_expected
  ON public.site_report_work_stoppages(expected_resolution_date)
  WHERE is_resolved = FALSE AND expected_resolution_date IS NOT NULL;

-- ------------------------------------------------------------
-- 2. RLS
-- ------------------------------------------------------------
ALTER TABLE public.site_report_work_stoppages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_stoppages_select" ON public.site_report_work_stoppages;
DROP POLICY IF EXISTS "sr_stoppages_insert" ON public.site_report_work_stoppages;
DROP POLICY IF EXISTS "sr_stoppages_update" ON public.site_report_work_stoppages;
DROP POLICY IF EXISTS "sr_stoppages_delete" ON public.site_report_work_stoppages;

CREATE POLICY "sr_stoppages_select" ON public.site_report_work_stoppages
  FOR SELECT TO authenticated
  USING (organisation_id = public.current_org_id());

CREATE POLICY "sr_stoppages_insert" ON public.site_report_work_stoppages
  FOR INSERT TO authenticated
  WITH CHECK (organisation_id = public.current_org_id());

CREATE POLICY "sr_stoppages_update" ON public.site_report_work_stoppages
  FOR UPDATE TO authenticated
  USING (organisation_id = public.current_org_id())
  WITH CHECK (organisation_id = public.current_org_id());

CREATE POLICY "sr_stoppages_delete" ON public.site_report_work_stoppages
  FOR DELETE TO authenticated
  USING (organisation_id = public.current_org_id());

-- ------------------------------------------------------------
-- 3. updated_at trigger
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_sr_stoppages_updated_at ON public.site_report_work_stoppages;
CREATE TRIGGER trg_sr_stoppages_updated_at
  BEFORE UPDATE ON public.site_report_work_stoppages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
