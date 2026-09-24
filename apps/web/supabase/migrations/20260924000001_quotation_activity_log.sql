-- Quotation activity log: records creation + manual edits so the
-- quotation History timeline can show them. Written fire-and-forget
-- from the editor; reads never block the page (client falls back
-- to header/approval data when rows are absent).
-- Run this in the Supabase Dashboard SQL Editor.

CREATE TABLE IF NOT EXISTS public.quotation_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  quotation_id UUID NOT NULL REFERENCES quotation_header(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  summary JSONB,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quotation_activity_log_quotation
  ON public.quotation_activity_log(quotation_id, created_at);

ALTER TABLE public.quotation_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quotation_activity_log_org_policy" ON public.quotation_activity_log;
CREATE POLICY "quotation_activity_log_org_policy" ON public.quotation_activity_log
  FOR ALL TO authenticated
  USING (public.user_can_access_org(organisation_id))
  WITH CHECK (public.user_can_access_org(organisation_id));

NOTIFY pgrst, 'reload schema';
