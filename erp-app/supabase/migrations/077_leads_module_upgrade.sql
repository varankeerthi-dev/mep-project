-- =============================================================================
-- 077 — Leads Module Upgrade: org-configurable statuses, industries, history,
--        assignment rules, and new lead fields.
-- Additive: no renames, no breaking changes.
--   1. lead_statuses         (org-configurable pipeline stages)
--   2. lead_industries        (org-configurable industry picklist)
--   3. lead_history           (activity / audit log)
--   4. lead_assignment_rules  (round-robin assignment config)
--   5. New columns on leads   (industry_id, referred_by, remarks, lead_status_id)
--   6. RLS policies
--   7. RBAC permissions
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. lead_statuses — org-configurable pipeline stages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6B7280',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  category TEXT NOT NULL DEFAULT 'open' CHECK (category IN ('open', 'won', 'lost', 'junk')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, name)
);

CREATE INDEX IF NOT EXISTS idx_lead_statuses_org_order
  ON public.lead_statuses(organisation_id, sort_order);

-- ---------------------------------------------------------------------------
-- 2. lead_industries — org-configurable industry picklist
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_industries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, name)
);

CREATE INDEX IF NOT EXISTS idx_lead_industries_org_order
  ON public.lead_industries(organisation_id, sort_order);

-- ---------------------------------------------------------------------------
-- 3. lead_history — activity / audit log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_history_lead
  ON public.lead_history(lead_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lead_history_org
  ON public.lead_history(organisation_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 4. lead_assignment_rules — round-robin / manual assignment config
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_assignment_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  method TEXT NOT NULL DEFAULT 'manual' CHECK (method IN ('round_robin', 'manual')),
  user_ids UUID[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_assigned_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organisation_id)
);

-- ---------------------------------------------------------------------------
-- 5. New columns on leads table (additive)
-- ---------------------------------------------------------------------------
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS industry_id UUID REFERENCES public.lead_industries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referred_by TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS remarks TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS lead_status_id UUID REFERENCES public.lead_statuses(id) ON DELETE SET NULL;

-- Migration helper: create a function to convert legacy status names to IDs
-- (used in seeding below)

-- ---------------------------------------------------------------------------
-- Seed default statuses for every existing organisation
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  org_rec RECORD;
  new_statuses TEXT[][] := ARRAY[
    ARRAY['Attempted to Contact', '#F59E0B', '1', 'open'],
    ARRAY['Contact in Future', '#3B82F6', '2', 'open'],
    ARRAY['Contacted', '#10B981', '3', 'open'],
    ARRAY['Not Contacted', '#6B7280', '4', 'open'],
    ARRAY['Pre-Qualified', '#8B5CF6', '5', 'open'],
    ARRAY['Not Qualified', '#EF4444', '6', 'lost'],
    ARRAY['Junk Lead', '#DC2626', '7', 'junk'],
    ARRAY['Lost Lead', '#991B1B', '8', 'lost'],
    -- Legacy statuses preserved for backward compatibility
    ARRAY['New', '#3B82F6', '9', 'open'],
    ARRAY['Qualified', '#10B981', '10', 'open'],
    ARRAY['Converted', '#059669', '11', 'won'],
    ARRAY['Disqualified', '#EF4444', '12', 'lost'],
    ARRAY['On Hold', '#F59E0B', '13', 'open']
  ];
  i INTEGER;
  v_status RECORD;
BEGIN
  FOR org_rec IN SELECT id FROM public.organisations LOOP
    FOR i IN 1..array_length(new_statuses, 1) LOOP
      INSERT INTO public.lead_statuses (organisation_id, name, color, sort_order, category, is_default)
      VALUES (org_rec.id, new_statuses[i][1], new_statuses[i][2], new_statuses[i][3]::INTEGER, new_statuses[i][4], i = 1)
      ON CONFLICT (organisation_id, name) DO NOTHING;
    END LOOP;

    -- Set lead_status_id for existing leads based on their current status
    FOR v_status IN
      SELECT ls.id, ls.name FROM public.lead_statuses ls WHERE ls.organisation_id = org_rec.id
    LOOP
      UPDATE public.leads
        SET lead_status_id = v_status.id
        WHERE organisation_id = org_rec.id
          AND status = v_status.name
          AND lead_status_id IS NULL;
    END LOOP;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Seed default industries for every existing organisation
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  org_rec RECORD;
  industries TEXT[] := ARRAY[
    'ASP (Application Service Provider)',
    'Data/Telecom OEM',
    'ERP (Enterprise Resource Planning)',
    'Government/Military',
    'Large Enterprise',
    'Management ISV',
    'MSP (Management Service Provider)',
    'Network Equipment Enterprise',
    'Non-management ISV',
    'Optical Networking',
    'Service Provider',
    'Small/Medium Enterprise',
    'Storage Equipment',
    'Storage Service Provider',
    'Systems Integrator',
    'Wireless Industry',
    'ERP',
    'Management ISV'
  ];
  i INTEGER;
BEGIN
  FOR org_rec IN SELECT id FROM public.organisations LOOP
    FOR i IN 1..array_length(industries, 1) LOOP
      INSERT INTO public.lead_industries (organisation_id, name, sort_order)
      VALUES (org_rec.id, industries[i], i)
      ON CONFLICT (organisation_id, name) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 6. RLS policies
-- ---------------------------------------------------------------------------
ALTER TABLE public.lead_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_industries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_assignment_rules ENABLE ROW LEVEL SECURITY;

-- lead_statuses
DROP POLICY IF EXISTS lead_statuses_select ON public.lead_statuses;
DROP POLICY IF EXISTS lead_statuses_all ON public.lead_statuses;
CREATE POLICY lead_statuses_select ON public.lead_statuses
  FOR SELECT TO authenticated
  USING (public.user_can_access_org(organisation_id));
CREATE POLICY lead_statuses_all ON public.lead_statuses
  FOR ALL TO authenticated
  USING (public.user_can_access_org(organisation_id))
  WITH CHECK (public.user_can_access_org(organisation_id));

-- lead_industries
DROP POLICY IF EXISTS lead_industries_select ON public.lead_industries;
DROP POLICY IF EXISTS lead_industries_all ON public.lead_industries;
CREATE POLICY lead_industries_select ON public.lead_industries
  FOR SELECT TO authenticated
  USING (public.user_can_access_org(organisation_id));
CREATE POLICY lead_industries_all ON public.lead_industries
  FOR ALL TO authenticated
  USING (public.user_can_access_org(organisation_id))
  WITH CHECK (public.user_can_access_org(organisation_id));

-- lead_history
DROP POLICY IF EXISTS lead_history_select ON public.lead_history;
DROP POLICY IF EXISTS lead_history_insert ON public.lead_history;
CREATE POLICY lead_history_select ON public.lead_history
  FOR SELECT TO authenticated
  USING (public.user_can_access_org(organisation_id));
CREATE POLICY lead_history_insert ON public.lead_history
  FOR INSERT TO authenticated
  WITH CHECK (public.user_can_access_org(organisation_id));

-- lead_assignment_rules
DROP POLICY IF EXISTS lead_assignment_rules_select ON public.lead_assignment_rules;
DROP POLICY IF EXISTS lead_assignment_rules_all ON public.lead_assignment_rules;
CREATE POLICY lead_assignment_rules_select ON public.lead_assignment_rules
  FOR SELECT TO authenticated
  USING (public.user_can_access_org(organisation_id));
CREATE POLICY lead_assignment_rules_all ON public.lead_assignment_rules
  FOR ALL TO authenticated
  USING (public.user_can_access_org(organisation_id))
  WITH CHECK (public.user_can_access_org(organisation_id));

-- ---------------------------------------------------------------------------
-- 7. RBAC permissions
-- ---------------------------------------------------------------------------
INSERT INTO public.permissions (key, description)
VALUES
  ('leads.settings', 'Configure lead statuses, industries, and assignment rules'),
  ('leads.auto_assign', 'Configure lead auto-assignment rules')
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 8. updated_at trigger for lead_assignment_rules
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_lead_assignment_rules_updated ON public.lead_assignment_rules;
CREATE TRIGGER trg_lead_assignment_rules_updated
  BEFORE UPDATE ON public.lead_assignment_rules
  FOR EACH ROW EXECUTE FUNCTION public.follow_up_set_updated_at();

COMMIT;
