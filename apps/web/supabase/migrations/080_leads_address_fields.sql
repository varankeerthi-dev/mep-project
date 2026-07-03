-- =============================================================================
-- 080 — Add city/state/pin columns to leads for geographic filtering
-- =============================================================================

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS city TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS pin TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_leads_city ON public.leads(city);
CREATE INDEX IF NOT EXISTS idx_leads_state ON public.leads(state);
