-- =============================================================================
-- 076 — Leads, Cadence/SLA, Win/Loss reasons
-- Phase 1 of "Follow-Up Centre → ambient follow-up" refactor.
-- Additive: no renames, no breaking changes.
--   1. leads                          (pre-quote capture)
--   2. win_loss_reasons               (org-configurable taxonomy)
--   3. cadence_rules                  (per-org SLA: T+1/T+2/T+3 escalation)
--   4. follow_up_quotation_tracking   (next_action_at, escalation_stage, win/loss link)
--   5. next_action_index              (view for ambient client-row chips)
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. leads
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,

  -- Identity
  contact_name TEXT NOT NULL,
  company_name TEXT NOT NULL DEFAULT '',
  contact_phone TEXT NOT NULL DEFAULT '',
  contact_email TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'Other' CHECK (source IN (
    'Referral', 'Trade Show', 'Cold Call', 'Website', 'Existing Client',
    'LinkedIn', 'Advertisement', 'Walk-in', 'Other'
  )),

  -- Pipeline link
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'New' CHECK (status IN (
    'New', 'Qualified', 'Converted', 'Disqualified', 'On Hold'
  )),
  disqualified_reason TEXT,

  -- Context
  project_name TEXT NOT NULL DEFAULT '',
  requirement_summary TEXT NOT NULL DEFAULT '',
  estimated_value NUMERIC(15,2) NOT NULL DEFAULT 0,
  expected_close_date DATE,

  -- Ownership & cadence
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  next_action_at TIMESTAMPTZ,
  next_action_label TEXT NOT NULL DEFAULT '',

  -- Audit
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  converted_at TIMESTAMPTZ,
  converted_to_client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  converted_to_quotation_id UUID REFERENCES public.quotation_header(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_leads_org_status
  ON public.leads(organisation_id, status);

CREATE INDEX IF NOT EXISTS idx_leads_org_owner
  ON public.leads(organisation_id, owner_user_id)
  WHERE owner_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_org_next_action
  ON public.leads(organisation_id, next_action_at)
  WHERE status IN ('New', 'Qualified') AND next_action_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_org_client
  ON public.leads(organisation_id, client_id)
  WHERE client_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. win_loss_reasons (org-scoped taxonomy)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.win_loss_reasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('win', 'loss', 'disqualify')),
  label TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, category, label)
);

CREATE INDEX IF NOT EXISTS idx_win_loss_reasons_org_category
  ON public.win_loss_reasons(organisation_id, category, sort_order);

-- Seed default reasons for every existing organisation (idempotent via DO block)
DO $$
DECLARE
  org_rec RECORD;
  defaults_loss TEXT[] := ARRAY[
    'Price too high',
    'Lost to competitor',
    'Scope mismatch',
    'Project cancelled / on hold',
    'Payment terms unacceptable',
    'Delivery timeline too long',
    'Client budget frozen',
    'No response after follow-up',
    'Quality concerns',
    'Other'
  ];
  defaults_win TEXT[] := ARRAY[
    'Competitive pricing',
    'Existing relationship',
    'Fast delivery',
    'Technical fit',
    'Referral',
    'Payment terms accepted',
    'Other'
  ];
  defaults_disq TEXT[] := ARRAY[
    'Not a fit',
    'No budget',
    'Duplicate / spam',
    'Wrong contact',
    'Other'
  ];
  i INTEGER;
BEGIN
  FOR org_rec IN SELECT id FROM public.organisations LOOP
    FOR i IN 1..array_length(defaults_loss, 1) LOOP
      INSERT INTO public.win_loss_reasons (organisation_id, category, label, is_default, sort_order)
      VALUES (org_rec.id, 'loss', defaults_loss[i], true, i)
      ON CONFLICT (organisation_id, category, label) DO NOTHING;
    END LOOP;
    FOR i IN 1..array_length(defaults_win, 1) LOOP
      INSERT INTO public.win_loss_reasons (organisation_id, category, label, is_default, sort_order)
      VALUES (org_rec.id, 'win', defaults_win[i], true, i)
      ON CONFLICT (organisation_id, category, label) DO NOTHING;
    END LOOP;
    FOR i IN 1..array_length(defaults_disq, 1) LOOP
      INSERT INTO public.win_loss_reasons (organisation_id, category, label, is_default, sort_order)
      VALUES (org_rec.id, 'disqualify', defaults_disq[i], true, i)
      ON CONFLICT (organisation_id, category, label) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3. cadence_rules (per-org SLA escalation)
--    Defines: at what age (days) of a stale next_action does the item bump
--    from one escalation stage to the next.
--    Stage 0 = fresh, 1 = gentle nudge, 2 = T+1, 3 = T+2 (critical), 4 = T+3 (red)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cadence_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  applies_to TEXT NOT NULL CHECK (applies_to IN ('lead', 'quotation', 'podc', 'invoice', 'global')),
  stage_1_days INTEGER NOT NULL DEFAULT 1 CHECK (stage_1_days >= 0),
  stage_2_days INTEGER NOT NULL DEFAULT 3 CHECK (stage_2_days >= stage_1_days),
  stage_3_days INTEGER NOT NULL DEFAULT 7 CHECK (stage_3_days >= stage_2_days),
  stage_4_days INTEGER NOT NULL DEFAULT 15 CHECK (stage_4_days >= stage_3_days),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cadence_rules_org_applies
  ON public.cadence_rules(organisation_id, applies_to)
  WHERE is_active = true;

-- Seed default rules per org (per applies_to scope)
INSERT INTO public.cadence_rules (organisation_id, applies_to, stage_1_days, stage_2_days, stage_3_days, stage_4_days)
SELECT o.id, 'lead', 1, 3, 7, 14
FROM public.organisations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.cadence_rules r
  WHERE r.organisation_id = o.id AND r.applies_to = 'lead' AND r.is_active = true
);

INSERT INTO public.cadence_rules (organisation_id, applies_to, stage_1_days, stage_2_days, stage_3_days, stage_4_days)
SELECT o.id, 'quotation', 1, 3, 7, 15
FROM public.organisations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.cadence_rules r
  WHERE r.organisation_id = o.id AND r.applies_to = 'quotation' AND r.is_active = true
);

INSERT INTO public.cadence_rules (organisation_id, applies_to, stage_1_days, stage_2_days, stage_3_days, stage_4_days)
SELECT o.id, 'podc', 2, 5, 10, 21
FROM public.organisations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.cadence_rules r
  WHERE r.organisation_id = o.id AND r.applies_to = 'podc' AND r.is_active = true
);

INSERT INTO public.cadence_rules (organisation_id, applies_to, stage_1_days, stage_2_days, stage_3_days, stage_4_days)
SELECT o.id, 'invoice', 1, 3, 15, 30
FROM public.organisations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.cadence_rules r
  WHERE r.organisation_id = o.id AND r.applies_to = 'invoice' AND r.is_active = true
);

-- ---------------------------------------------------------------------------
-- 4. Extend follow_up_quotation_tracking with cadence + win/loss columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.follow_up_quotation_tracking
  ADD COLUMN IF NOT EXISTS next_action_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_action_label TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS escalation_stage SMALLINT NOT NULL DEFAULT 0 CHECK (escalation_stage BETWEEN 0 AND 4),
  ADD COLUMN IF NOT EXISTS win_loss_reason_id UUID REFERENCES public.win_loss_reasons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS win_loss_notes TEXT,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_value NUMERIC(15,2);

CREATE INDEX IF NOT EXISTS idx_follow_up_quotation_next_action
  ON public.follow_up_quotation_tracking(organisation_id, next_action_at)
  WHERE next_action_at IS NOT NULL AND follow_up_status NOT IN ('approved', 'lost_to_competitor', 'cancelled', 'expired');

CREATE INDEX IF NOT EXISTS idx_follow_up_quotation_escalation
  ON public.follow_up_quotation_tracking(organisation_id, escalation_stage)
  WHERE escalation_stage >= 2;

-- ---------------------------------------------------------------------------
-- 5. updated_at trigger for new tables (reuse follow_up helper if exists)
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_leads_updated ON public.leads;
CREATE TRIGGER trg_leads_updated
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.follow_up_set_updated_at();

DROP TRIGGER IF EXISTS trg_cadence_rules_updated ON public.cadence_rules;
CREATE TRIGGER trg_cadence_rules_updated
  BEFORE UPDATE ON public.cadence_rules
  FOR EACH ROW EXECUTE FUNCTION public.follow_up_set_updated_at();

-- ---------------------------------------------------------------------------
-- 6. RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.win_loss_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cadence_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS leads_select ON public.leads;
DROP POLICY IF EXISTS leads_all ON public.leads;
DROP POLICY IF EXISTS win_loss_reasons_select ON public.win_loss_reasons;
DROP POLICY IF EXISTS win_loss_reasons_all ON public.win_loss_reasons;
DROP POLICY IF EXISTS cadence_rules_select ON public.cadence_rules;
DROP POLICY IF EXISTS cadence_rules_all ON public.cadence_rules;

CREATE POLICY leads_select ON public.leads
  FOR SELECT TO authenticated
  USING (public.user_can_access_org(organisation_id));

CREATE POLICY leads_all ON public.leads
  FOR ALL TO authenticated
  USING (public.user_can_access_org(organisation_id))
  WITH CHECK (public.user_can_access_org(organisation_id));

CREATE POLICY win_loss_reasons_select ON public.win_loss_reasons
  FOR SELECT TO authenticated
  USING (public.user_can_access_org(organisation_id));

CREATE POLICY win_loss_reasons_all ON public.win_loss_reasons
  FOR ALL TO authenticated
  USING (public.user_can_access_org(organisation_id))
  WITH CHECK (public.user_can_access_org(organisation_id));

CREATE POLICY cadence_rules_select ON public.cadence_rules
  FOR SELECT TO authenticated
  USING (public.user_can_access_org(organisation_id));

CREATE POLICY cadence_rules_all ON public.cadence_rules
  FOR ALL TO authenticated
  USING (public.user_can_access_org(organisation_id))
  WITH CHECK (public.user_can_access_org(organisation_id));

-- ---------------------------------------------------------------------------
-- 7. RBAC permissions
-- ---------------------------------------------------------------------------
INSERT INTO public.permissions (key, description)
VALUES
  ('leads.read', 'View leads'),
  ('leads.manage', 'Create/update/convert/disqualify leads'),
  ('follow_up.win_loss', 'Capture win/loss reasons at close'),
  ('follow_up.cadence', 'Configure cadence/SLA rules')
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 8. Helper RPC: compute escalation stage from next_action_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.compute_escalation_stage(
  p_organisation_id UUID,
  p_applies_to TEXT,
  p_next_action_at TIMESTAMPTZ,
  p_now TIMESTAMPTZ DEFAULT now()
)
RETURNS SMALLINT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage_1 INTEGER;
  v_stage_2 INTEGER;
  v_stage_3 INTEGER;
  v_stage_4 INTEGER;
  v_age_days NUMERIC;
  v_stage SMALLINT := 0;
BEGIN
  IF p_next_action_at IS NULL THEN
    RETURN 0;
  END IF;

  v_age_days := EXTRACT(EPOCH FROM (p_now - p_next_action_at)) / 86400.0;

  IF v_age_days <= 0 THEN
    RETURN 0;
  END IF;

  SELECT stage_1_days, stage_2_days, stage_3_days, stage_4_days
    INTO v_stage_1, v_stage_2, v_stage_3, v_stage_4
  FROM public.cadence_rules
  WHERE organisation_id = p_organisation_id
    AND applies_to = p_applies_to
    AND is_active = true
  ORDER BY (applies_to = p_applies_to) DESC
  LIMIT 1;

  IF v_stage_1 IS NULL THEN
    -- Fallback if no rule defined
    v_stage_1 := 1; v_stage_2 := 3; v_stage_3 := 7; v_stage_4 := 15;
  END IF;

  IF v_age_days >= v_stage_4 THEN v_stage := 4;
  ELSIF v_age_days >= v_stage_3 THEN v_stage := 3;
  ELSIF v_age_days >= v_stage_2 THEN v_stage := 2;
  ELSIF v_age_days >= v_stage_1 THEN v_stage := 1;
  ELSE v_stage := 0;
  END IF;

  RETURN v_stage;
END;
$$;

GRANT EXECUTE ON FUNCTION public.compute_escalation_stage TO authenticated;

-- ---------------------------------------------------------------------------
-- 9. View: next_action_index — feeds the ambient client-row chip
--    One row per (org, client) for the most-pressing open follow-up item
--    across leads, quotations, invoices, podc.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.next_action_index AS
SELECT
  l.organisation_id,
  l.client_id,
  'lead'::TEXT AS source_type,
  l.id AS source_id,
  l.contact_name AS reference_label,
  l.next_action_at,
  l.next_action_label,
  public.compute_escalation_stage(l.organisation_id, 'lead', l.next_action_at) AS escalation_stage
FROM public.leads l
WHERE l.client_id IS NOT NULL
  AND l.status IN ('New', 'Qualified')
  AND l.next_action_at IS NOT NULL

UNION ALL

SELECT
  t.organisation_id,
  q.client_id,
  'quotation'::TEXT AS source_type,
  t.quotation_id AS source_id,
  q.quotation_no AS reference_label,
  t.next_action_at,
  t.next_action_label,
  COALESCE(t.escalation_stage, public.compute_escalation_stage(t.organisation_id, 'quotation', t.next_action_at)) AS escalation_stage
FROM public.follow_up_quotation_tracking t
JOIN public.quotation_header q ON q.id = t.quotation_id
WHERE q.client_id IS NOT NULL
  AND t.next_action_at IS NOT NULL
  AND t.follow_up_status NOT IN ('approved', 'lost_to_competitor', 'cancelled', 'expired')

UNION ALL

SELECT
  t.organisation_id,
  inv.client_id,
  'invoice'::TEXT AS source_type,
  t.invoice_id AS source_id,
  inv.invoice_no AS reference_label,
  t.last_reminder_at AS next_action_at,
  'Awaiting payment'::TEXT AS next_action_label,
  public.compute_escalation_stage(t.organisation_id, 'invoice', t.last_reminder_at) AS escalation_stage
FROM public.follow_up_invoice_tracking t
JOIN public.invoices inv ON inv.id = t.invoice_id
WHERE inv.client_id IS NOT NULL
  AND t.collection_risk IN ('medium', 'high', 'critical');

GRANT SELECT ON public.next_action_index TO authenticated;

-- ---------------------------------------------------------------------------
-- 10. Helper RPC: closest_next_action — what to show on a client chip
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_closest_next_action(
  p_organisation_id UUID,
  p_client_id UUID,
  p_now TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE (
  source_type TEXT,
  source_id UUID,
  reference_label TEXT,
  next_action_at TIMESTAMPTZ,
  next_action_label TEXT,
  escalation_stage SMALLINT,
  hours_until_due NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    nai.source_type,
    nai.source_id,
    nai.reference_label,
    nai.next_action_at,
    nai.next_action_label,
    nai.escalation_stage,
    ROUND(EXTRACT(EPOCH FROM (nai.next_action_at - p_now)) / 3600.0, 1) AS hours_until_due
  FROM public.next_action_index nai
  WHERE nai.organisation_id = p_organisation_id
    AND nai.client_id = p_client_id
  ORDER BY nai.next_action_at ASC
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_closest_next_action TO authenticated;

COMMIT;
