-- Site Visit Activity Log
CREATE TABLE IF NOT EXISTS public.site_visit_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  site_visit_id UUID REFERENCES public.site_visits(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'site_visit_created',
    'site_visit_updated',
    'site_visit_draft_saved',
    'site_visit_deleted',
    'site_visit_status_changed'
  )),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL DEFAULT 'System',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_visit_activity_org_created
  ON public.site_visit_activity_log(organisation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_site_visit_activity_visit
  ON public.site_visit_activity_log(organisation_id, site_visit_id);

ALTER TABLE public.site_visit_activity_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'site_visit_activity_log' AND policyname = 'site_visit_activity_select'
  ) THEN
    CREATE POLICY site_visit_activity_select ON public.site_visit_activity_log
      FOR SELECT USING (
        organisation_id IN (
          SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'site_visit_activity_log' AND policyname = 'site_visit_activity_insert'
  ) THEN
    CREATE POLICY site_visit_activity_insert ON public.site_visit_activity_log
      FOR INSERT WITH CHECK (
        organisation_id IN (
          SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;
