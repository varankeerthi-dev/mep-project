-- =============================================================================
-- 079 — Link leads to site visits: add lead_id to site_visits
-- =============================================================================

ALTER TABLE public.site_visits
  ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_site_visits_lead_id
  ON public.site_visits(lead_id);
