-- =============================================================================
-- FOLLOW-UP CENTRE — Run in Supabase SQL Editor (copy entire file)
-- Identical to: supabase/migrations/051_follow_up_centre.sql
-- Setup guide: docs/follow-up-centre/SUPABASE_SETUP.md
-- =============================================================================

-- Follow-Up Centre module
-- Run in Supabase SQL editor or via: supabase db push / migration apply
-- Phases 7–10: schema, RLS, permissions, indexes

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Activity log (unified audit trail)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.follow_up_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'quotation_reminder_sent',
    'quotation_response_logged',
    'podc_pack_shared',
    'podc_issue_flagged',
    'invoice_reminder_sent',
    'invoice_escalation_changed'
  )),
  tab_source TEXT NOT NULL CHECK (tab_source IN ('quotation', 'podc', 'invoice', 'activity')),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL DEFAULT 'System',
  reference_id UUID,
  reference_label TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_follow_up_activity_org_created
  ON public.follow_up_activity_log(organisation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_follow_up_activity_org_tab
  ON public.follow_up_activity_log(organisation_id, tab_source);

CREATE INDEX IF NOT EXISTS idx_follow_up_activity_reference
  ON public.follow_up_activity_log(organisation_id, reference_id);

-- ---------------------------------------------------------------------------
-- 2. Quotation follow-up tracking (overlay on quotation_header)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.follow_up_quotation_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  quotation_id UUID NOT NULL REFERENCES public.quotation_header(id) ON DELETE CASCADE,
  follow_up_status TEXT CHECK (follow_up_status IN (
    'sent', 'under_review', 'in_negotiation', 'pending', 'lost_to_competitor'
  )),
  last_reminder_at TIMESTAMPTZ,
  pdf_url TEXT,
  contact_phone TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, quotation_id)
);

CREATE INDEX IF NOT EXISTS idx_follow_up_quotation_org
  ON public.follow_up_quotation_tracking(organisation_id);

CREATE INDEX IF NOT EXISTS idx_follow_up_quotation_status
  ON public.follow_up_quotation_tracking(organisation_id, follow_up_status);

-- ---------------------------------------------------------------------------
-- 3. PO/DC backlog (procurement gap — work/DC done, client PO pending)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.follow_up_podc_backlog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  delivery_challan_id UUID REFERENCES public.delivery_challans(id) ON DELETE SET NULL,
  dc_wo_number TEXT NOT NULL,
  client_name TEXT NOT NULL,
  project_name TEXT NOT NULL DEFAULT '',
  estimated_value NUMERIC(15,2) NOT NULL DEFAULT 0,
  days_pending_po INTEGER NOT NULL DEFAULT 0,
  site_engineer TEXT NOT NULL DEFAULT '',
  client_coordinator TEXT NOT NULL DEFAULT '',
  delivery_proof_status TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_proof_status IN (
    'verified', 'partial', 'pending', 'missing'
  )),
  dispute_status TEXT NOT NULL DEFAULT 'none' CHECK (dispute_status IN ('none', 'open', 'resolved')),
  issue_flag TEXT CHECK (issue_flag IN (
    'quantity_mismatch', 'damaged_material', 'incomplete_delivery', 'disputed_execution'
  )),
  signed_dc_url TEXT,
  delivery_photo_urls TEXT[] NOT NULL DEFAULT '{}',
  completion_photo_urls TEXT[] NOT NULL DEFAULT '{}',
  contact_phone TEXT,
  po_received_at DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_follow_up_podc_org_active
  ON public.follow_up_podc_backlog(organisation_id, is_active)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_follow_up_podc_days
  ON public.follow_up_podc_backlog(organisation_id, days_pending_po DESC);

CREATE INDEX IF NOT EXISTS idx_follow_up_podc_dc
  ON public.follow_up_podc_backlog(delivery_challan_id)
  WHERE delivery_challan_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4. Invoice follow-up tracking (overlay on invoices)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.follow_up_invoice_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  last_reminder_at TIMESTAMPTZ,
  collection_risk TEXT CHECK (collection_risk IN ('low', 'medium', 'high', 'critical')),
  payment_link TEXT,
  contact_phone TEXT,
  escalation_notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, invoice_id)
);

CREATE INDEX IF NOT EXISTS idx_follow_up_invoice_org
  ON public.follow_up_invoice_tracking(organisation_id);

-- ---------------------------------------------------------------------------
-- 5. Updated_at triggers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.follow_up_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_follow_up_quotation_updated ON public.follow_up_quotation_tracking;
CREATE TRIGGER trg_follow_up_quotation_updated
  BEFORE UPDATE ON public.follow_up_quotation_tracking
  FOR EACH ROW EXECUTE FUNCTION public.follow_up_set_updated_at();

DROP TRIGGER IF EXISTS trg_follow_up_podc_updated ON public.follow_up_podc_backlog;
CREATE TRIGGER trg_follow_up_podc_updated
  BEFORE UPDATE ON public.follow_up_podc_backlog
  FOR EACH ROW EXECUTE FUNCTION public.follow_up_set_updated_at();

DROP TRIGGER IF EXISTS trg_follow_up_invoice_updated ON public.follow_up_invoice_tracking;
CREATE TRIGGER trg_follow_up_invoice_updated
  BEFORE UPDATE ON public.follow_up_invoice_tracking
  FOR EACH ROW EXECUTE FUNCTION public.follow_up_set_updated_at();

-- ---------------------------------------------------------------------------
-- 6. RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.follow_up_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_up_quotation_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_up_podc_backlog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_up_invoice_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS follow_up_activity_select ON public.follow_up_activity_log;
DROP POLICY IF EXISTS follow_up_activity_insert ON public.follow_up_activity_log;
DROP POLICY IF EXISTS follow_up_quotation_select ON public.follow_up_quotation_tracking;
DROP POLICY IF EXISTS follow_up_quotation_all ON public.follow_up_quotation_tracking;
DROP POLICY IF EXISTS follow_up_podc_select ON public.follow_up_podc_backlog;
DROP POLICY IF EXISTS follow_up_podc_all ON public.follow_up_podc_backlog;
DROP POLICY IF EXISTS follow_up_invoice_select ON public.follow_up_invoice_tracking;
DROP POLICY IF EXISTS follow_up_invoice_all ON public.follow_up_invoice_tracking;

CREATE POLICY follow_up_activity_select ON public.follow_up_activity_log
  FOR SELECT TO authenticated
  USING (public.user_can_access_org(organisation_id));

CREATE POLICY follow_up_activity_insert ON public.follow_up_activity_log
  FOR INSERT TO authenticated
  WITH CHECK (public.user_can_access_org(organisation_id));

CREATE POLICY follow_up_quotation_select ON public.follow_up_quotation_tracking
  FOR SELECT TO authenticated
  USING (public.user_can_access_org(organisation_id));

CREATE POLICY follow_up_quotation_all ON public.follow_up_quotation_tracking
  FOR ALL TO authenticated
  USING (public.user_can_access_org(organisation_id))
  WITH CHECK (public.user_can_access_org(organisation_id));

CREATE POLICY follow_up_podc_select ON public.follow_up_podc_backlog
  FOR SELECT TO authenticated
  USING (public.user_can_access_org(organisation_id));

CREATE POLICY follow_up_podc_all ON public.follow_up_podc_backlog
  FOR ALL TO authenticated
  USING (public.user_can_access_org(organisation_id))
  WITH CHECK (public.user_can_access_org(organisation_id));

CREATE POLICY follow_up_invoice_select ON public.follow_up_invoice_tracking
  FOR SELECT TO authenticated
  USING (public.user_can_access_org(organisation_id));

CREATE POLICY follow_up_invoice_all ON public.follow_up_invoice_tracking
  FOR ALL TO authenticated
  USING (public.user_can_access_org(organisation_id))
  WITH CHECK (public.user_can_access_org(organisation_id));

-- ---------------------------------------------------------------------------
-- 7. RBAC permissions
-- ---------------------------------------------------------------------------
INSERT INTO public.permissions (key, description)
VALUES
  ('follow_up.read', 'View Follow-Up Centre'),
  ('follow_up.manage', 'Manage follow-up actions (reminders, responses, flags)')
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 8. Helper: log activity (callable from app)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.follow_up_log_activity(
  p_organisation_id UUID,
  p_event_type TEXT,
  p_tab_source TEXT,
  p_title TEXT,
  p_description TEXT DEFAULT '',
  p_reference_id UUID DEFAULT NULL,
  p_reference_label TEXT DEFAULT '',
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_actor_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_actor_name TEXT;
BEGIN
  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Access denied for organisation';
  END IF;

  v_actor_name := COALESCE(
    p_actor_name,
    (SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = auth.uid()),
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    'User'
  );

  INSERT INTO public.follow_up_activity_log (
    organisation_id, event_type, tab_source, title, description,
    actor_id, actor_name, reference_id, reference_label, metadata
  ) VALUES (
    p_organisation_id, p_event_type, p_tab_source, p_title, p_description,
    auth.uid(), v_actor_name, p_reference_id, p_reference_label, p_metadata
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.follow_up_log_activity TO authenticated;

-- ---------------------------------------------------------------------------
-- 9. Optional: backfill PODC backlog from delivery challans
-- ---------------------------------------------------------------------------
INSERT INTO public.follow_up_podc_backlog (
  organisation_id,
  delivery_challan_id,
  dc_wo_number,
  client_name,
  project_name,
  estimated_value,
  days_pending_po,
  site_engineer,
  client_coordinator,
  delivery_proof_status,
  dispute_status,
  signed_dc_url,
  is_active
)
SELECT
  dc.organisation_id,
  dc.id,
  COALESCE(dc.dc_number, 'DC-' || LEFT(dc.id::text, 8)),
  COALESCE(dc.client_name, 'Unknown'),
  COALESCE(p.project_name, ''),
  COALESCE(
    (SELECT SUM(COALESCE(dci.amount, dci.quantity * COALESCE(dci.rate, 0), 0))
     FROM public.delivery_challan_items dci
     WHERE dci.delivery_challan_id = dc.id),
    0
  ),
  GREATEST(0, (CURRENT_DATE - COALESCE(dc.dc_date::date, dc.created_at::date))::integer),
  COALESCE(dc.driver_name, ''),
  COALESCE(dc.client_name, ''),
  'pending',
  'none',
  NULL,
  true
FROM public.delivery_challans dc
LEFT JOIN public.projects p ON p.id = dc.project_id
WHERE dc.organisation_id IS NOT NULL
  AND COALESCE(dc.status, '') IN ('delivered', 'completed', 'signed', 'final')
  AND NOT EXISTS (
    SELECT 1 FROM public.follow_up_podc_backlog b
    WHERE b.delivery_challan_id = dc.id
  );

COMMIT;
