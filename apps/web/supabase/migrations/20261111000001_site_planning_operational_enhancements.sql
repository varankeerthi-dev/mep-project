-- Migration: 20261111000001_site_planning_operational_enhancements.sql
-- Description: Add operational fields to site_plans (work_type, 4-point readiness checklist, PTW notes, tools required, SLA deadline)

ALTER TABLE public.site_plans
  ADD COLUMN IF NOT EXISTS work_type VARCHAR(30) DEFAULT 'erection_project',
  ADD COLUMN IF NOT EXISTS site_access_cleared BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS permits_approved BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS materials_staged BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tools_dispatched BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ptw_notes TEXT,
  ADD COLUMN IF NOT EXISTS tools_required TEXT,
  ADD COLUMN IF NOT EXISTS emergency_sla_deadline TIMESTAMPTZ;

-- Add check constraint for work_type if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_site_plans_work_type'
  ) THEN
    ALTER TABLE public.site_plans
      ADD CONSTRAINT chk_site_plans_work_type
      CHECK (work_type IN ('erection_project', 'service_breakdown', 'amc_ppm', 'other'));
  END IF;
END $$;

-- Indexes for operational querying
CREATE INDEX IF NOT EXISTS idx_site_plans_work_type ON public.site_plans(organisation_id, work_type);
CREATE INDEX IF NOT EXISTS idx_site_plans_plan_date_org ON public.site_plans(organisation_id, plan_date);
CREATE INDEX IF NOT EXISTS idx_site_plan_allocations_subcontractor ON public.site_plan_allocations(subcontractor_id);
