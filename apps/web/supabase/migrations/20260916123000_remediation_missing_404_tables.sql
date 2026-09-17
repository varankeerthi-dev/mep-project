-- ============================================================================
-- REMEDIATION PHASE 1.3 — Missing-and-required tables for reachable 404 flows
-- Live defects (verified 2026-09-16, project rujqejtisqermjyqqgoj):
--   PostgREST 404 (PGRST205) for tables the routed app writes/reads:
--     notifications            (ClientLookup.tsx:412 assignment notice)
--     client_communication_entries (ClientLookup.tsx:401 briefing entry;
--                              the client_communication insert SUCCEEDS first,
--                              so the flow currently dies mid-way with 404)
--     manager_alerts           (pages/ManagerAlerts.tsx select/update/realtime;
--                              full historical SQL exists in repo:
--                              supabase-manager-alerts.sql — never applied;
--                              extended here with alert_type used by
--                              lib/workInstructionNotify.ts pushManagerAlert)
--     reminders                (pages/RemindMe.tsx select/insert, TodoList select)
--     quotation_variant_discounts (pages/CreateQuotation{,V2} save/load; the
--                              try/catch today silently discards variant
--                              discounts on 404)
--
-- NOT created here (classified separately, see PHASE-0-DRIFT-CLASSIFICATION.md):
--   boms/quotation_headers/project_tasks/invoice_line_items  -> renamed tables,
--      fixed in application code (Phase 1.3 code fixes)
--   expense_claims/material_dispatches/salary_increments/subcontractor_attendance/
--   project_closure_*  -> obsolete superseded surfaces
--   work_instructions/work_items/subscriptions/...  -> dead code
--
-- Security model follows the live convention: org-scoped policies via
-- user_can_access_org(organisation_id). Forward-only, idempotent.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. notifications — per-user notification pipe
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL,
  organisation_id   uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  title             text NOT NULL,
  body              text,
  link              text,
  notification_type text NOT NULL DEFAULT 'general',
  read_at           timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, read_at NULLS FIRST, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_org
  ON public.notifications (organisation_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_insert_org_members" ON public.notifications;
CREATE POLICY "notifications_insert_org_members" ON public.notifications
  FOR INSERT WITH CHECK (public.user_can_access_org(organisation_id));

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2. client_communication_entries — communication thread entries
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_communication_entries (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_communication_id  uuid NOT NULL REFERENCES public.client_communication(id) ON DELETE CASCADE,
  entry_type               text NOT NULL DEFAULT 'Note',
  brief                    text,
  entered_by               uuid,
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cc_entries_parent
  ON public.client_communication_entries (parent_communication_id, created_at);

ALTER TABLE public.client_communication_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cc_entries_org_all" ON public.client_communication_entries;
CREATE POLICY "cc_entries_org_all" ON public.client_communication_entries
  FOR ALL USING (public.user_can_access_org(
    (SELECT c.organisation_id FROM public.client_communication c
      WHERE c.id = parent_communication_id)))
  WITH CHECK (public.user_can_access_org(
    (SELECT c.organisation_id FROM public.client_communication c
      WHERE c.id = parent_communication_id)));

-- ---------------------------------------------------------------------------
-- 3. manager_alerts — MD/manager alert surface (extends never-applied repo SQL)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.manager_alerts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id   uuid REFERENCES public.organisations(id) ON DELETE CASCADE,
  communication_id  uuid REFERENCES public.client_communication(id) ON DELETE CASCADE,
  alert_type        text NOT NULL DEFAULT 'communication',
  logged_by         uuid,
  logged_by_name    text,
  party_type        text,
  party_name        text,
  summary           text NOT NULL,
  suggested_options jsonb NOT NULL DEFAULT '[]'::jsonb,
  status            text NOT NULL DEFAULT 'new',
  selected_option   text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT manager_alerts_status_check
    CHECK (status = ANY (ARRAY['new'::text, 'acknowledged'::text, 'actioned'::text]))
);

CREATE INDEX IF NOT EXISTS idx_manager_alerts_org
  ON public.manager_alerts (organisation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_manager_alerts_status
  ON public.manager_alerts (organisation_id, status);

ALTER TABLE public.manager_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "manager_alerts_select_org" ON public.manager_alerts;
CREATE POLICY "manager_alerts_select_org" ON public.manager_alerts
  FOR SELECT USING (public.user_can_access_org(organisation_id));

DROP POLICY IF EXISTS "manager_alerts_insert_org" ON public.manager_alerts;
CREATE POLICY "manager_alerts_insert_org" ON public.manager_alerts
  FOR INSERT WITH CHECK (public.user_can_access_org(organisation_id));

DROP POLICY IF EXISTS "manager_alerts_update_org" ON public.manager_alerts;
CREATE POLICY "manager_alerts_update_org" ON public.manager_alerts
  FOR UPDATE USING (public.user_can_access_org(organisation_id))
  WITH CHECK (public.user_can_access_org(organisation_id));

-- Realtime for the Manager Alerts page (page subscribes to manager_alerts channel).
DO $fn$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.manager_alerts;
EXCEPTION WHEN duplicate_object THEN NULL; -- already in publication
END;
$fn$;

-- ---------------------------------------------------------------------------
-- 4. reminders — org announcements/reminders (Remind Me / Tasks > Reminders)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reminders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  title           text NOT NULL,
  remind_date     date,
  description     text,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reminders_org_date
  ON public.reminders (organisation_id, remind_date);

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reminders_org_all" ON public.reminders;
CREATE POLICY "reminders_org_all" ON public.reminders
  FOR ALL USING (public.user_can_access_org(organisation_id))
  WITH CHECK (public.user_can_access_org(organisation_id));

-- ---------------------------------------------------------------------------
-- 5. quotation_variant_discounts — per-variant header discounts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quotation_variant_discounts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id     uuid NOT NULL REFERENCES public.quotation_header(id) ON DELETE CASCADE,
  variant_id       uuid,
  discount_percent numeric(8,2) NOT NULL DEFAULT 0,
  organisation_id  uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_quotation_variant_discounts_q_v
  ON public.quotation_variant_discounts (quotation_id, variant_id);

ALTER TABLE public.quotation_variant_discounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quotation_variant_discounts_org_all" ON public.quotation_variant_discounts;
CREATE POLICY "quotation_variant_discounts_org_all" ON public.quotation_variant_discounts
  FOR ALL USING (public.user_can_access_org(organisation_id))
  WITH CHECK (public.user_can_access_org(organisation_id));
