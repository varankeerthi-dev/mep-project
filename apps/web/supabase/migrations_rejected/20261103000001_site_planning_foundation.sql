-- Migration: 20261103000001_site_planning_foundation.sql
-- Description: Site Planning & Workforce Allocation Foundation
-- 1. Adds missing linkages: site_visits.employee_id and tasks.site_visit_id
-- 2. Creates site_plans, site_plan_allocations, and site_plan_schedule_history tables
-- 3. Enables multi-tenant RLS policies using user_can_access_org
-- 4. Provides idempotent execution linkage to site_visits

-- 1. Linkage enhancements
ALTER TABLE public.site_visits
  ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_site_visits_employee_id
  ON public.site_visits(employee_id);

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS site_visit_id UUID REFERENCES public.site_visits(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_site_visit_id
  ON public.tasks(site_visit_id);

-- 2. Dedicated Site Planning Models
CREATE TABLE IF NOT EXISTS public.site_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  plan_name VARCHAR(255) NOT NULL,
  plan_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  trade VARCHAR(100),
  headcount_required INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  
  -- Three independent lifecycle dimensions:
  plan_status VARCHAR(30) NOT NULL DEFAULT 'draft',
  client_confirmation_status VARCHAR(30) NOT NULL DEFAULT 'not_confirmed',
  execution_status VARCHAR(30) NOT NULL DEFAULT 'scheduled',

  site_visit_id UUID REFERENCES public.site_visits(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  approval_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_site_plan_status CHECK (
    plan_status IN ('draft', 'pending_approval', 'approved', 'rejected', 'cancelled')
  ),
  CONSTRAINT chk_site_plan_client_confirmation CHECK (
    client_confirmation_status IN ('not_confirmed', 'confirmed', 'postponement_requested', 'cancelled')
  ),
  CONSTRAINT chk_site_plan_execution_status CHECK (
    execution_status IN ('scheduled', 'dispatched', 'in_progress', 'completed', 'cancelled')
  )
);

CREATE INDEX IF NOT EXISTS idx_site_plans_org_date
  ON public.site_plans(organisation_id, plan_date);

CREATE INDEX IF NOT EXISTS idx_site_plans_project
  ON public.site_plans(project_id);

CREATE INDEX IF NOT EXISTS idx_site_plans_client
  ON public.site_plans(client_id);

CREATE INDEX IF NOT EXISTS idx_site_plans_status
  ON public.site_plans(plan_status, client_confirmation_status);

-- 3. Allocations (Workers / Subcontractors assigned to plan)
CREATE TABLE IF NOT EXISTS public.site_plan_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_plan_id UUID NOT NULL REFERENCES public.site_plans(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  subcontractor_id UUID REFERENCES public.subcontractors(id) ON DELETE SET NULL,
  allocation_type VARCHAR(30) NOT NULL DEFAULT 'employee',
  allocated_trade VARCHAR(100),
  headcount INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(30) NOT NULL DEFAULT 'assigned',
  notes TEXT,
  allocated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  allocated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_allocation_type CHECK (
    allocation_type IN ('employee', 'subcontractor', 'headcount_placeholder')
  ),
  CONSTRAINT chk_allocation_status CHECK (
    status IN ('assigned', 'confirmed', 'present', 'absent', 'replaced')
  )
);

CREATE INDEX IF NOT EXISTS idx_site_plan_alloc_plan
  ON public.site_plan_allocations(site_plan_id);

CREATE INDEX IF NOT EXISTS idx_site_plan_alloc_emp
  ON public.site_plan_allocations(employee_id);

CREATE INDEX IF NOT EXISTS idx_site_plan_alloc_sub
  ON public.site_plan_allocations(subcontractor_id);

-- 4. Rescheduling and confirmation change history
CREATE TABLE IF NOT EXISTS public.site_plan_schedule_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_plan_id UUID NOT NULL REFERENCES public.site_plans(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  previous_date DATE NOT NULL,
  new_date DATE NOT NULL,
  previous_status VARCHAR(30),
  new_status VARCHAR(30),
  reason TEXT NOT NULL,
  client_agreed BOOLEAN DEFAULT false,
  rescheduled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rescheduled_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_plan_sched_hist_plan
  ON public.site_plan_schedule_history(site_plan_id, rescheduled_at DESC);

-- 5. Row Level Security Policies
ALTER TABLE public.site_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_plan_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_plan_schedule_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_plans_org_access" ON public.site_plans;
CREATE POLICY "site_plans_org_access" ON public.site_plans
  FOR ALL USING (public.user_can_access_org(organisation_id))
  WITH CHECK (public.user_can_access_org(organisation_id));

DROP POLICY IF EXISTS "site_plan_allocations_org_access" ON public.site_plan_allocations;
CREATE POLICY "site_plan_allocations_org_access" ON public.site_plan_allocations
  FOR ALL USING (public.user_can_access_org(organisation_id))
  WITH CHECK (public.user_can_access_org(organisation_id));

DROP POLICY IF EXISTS "site_plan_schedule_history_org_access" ON public.site_plan_schedule_history;
CREATE POLICY "site_plan_schedule_history_org_access" ON public.site_plan_schedule_history
  FOR ALL USING (public.user_can_access_org(organisation_id))
  WITH CHECK (public.user_can_access_org(organisation_id));

-- 6. Idempotent Execution Linkage Function
CREATE OR REPLACE FUNCTION public.link_or_create_execution_visit(p_site_plan_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan RECORD;
  v_visit_id UUID;
BEGIN
  SELECT * INTO v_plan
  FROM public.site_plans
  WHERE id = p_site_plan_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Site plan not found: %', p_site_plan_id;
  END IF;

  IF NOT public.user_can_access_org(v_plan.organisation_id) THEN
    RAISE EXCEPTION 'Access denied to organisation %', v_plan.organisation_id;
  END IF;

  -- Idempotency check: if already linked, return existing visit ID
  IF v_plan.site_visit_id IS NOT NULL THEN
    RETURN v_plan.site_visit_id;
  END IF;

  -- Create corresponding site visit as execution record
  INSERT INTO public.site_visits (
    organisation_id,
    project_id,
    client_id,
    visit_date,
    visit_time,
    purpose,
    status
  ) VALUES (
    v_plan.organisation_id,
    v_plan.project_id,
    v_plan.client_id,
    v_plan.plan_date,
    COALESCE(to_char(v_plan.start_time, 'HH24:MI'), '09:00'),
    v_plan.plan_name,
    'Scheduled'
  ) RETURNING id INTO v_visit_id;

  -- Update site plan with execution link
  UPDATE public.site_plans
  SET site_visit_id = v_visit_id,
      execution_status = 'dispatched',
      updated_at = now()
  WHERE id = p_site_plan_id;

  RETURN v_visit_id;
END;
$$;
