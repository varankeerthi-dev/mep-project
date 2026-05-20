-- Follow-Up Centre: assignee (who owns the follow-up action)
-- Run after 051_follow_up_centre.sql

BEGIN;

ALTER TABLE public.follow_up_quotation_tracking
  ADD COLUMN IF NOT EXISTS assignee_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.follow_up_podc_backlog
  ADD COLUMN IF NOT EXISTS assignee_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.follow_up_invoice_tracking
  ADD COLUMN IF NOT EXISTS assignee_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_follow_up_quotation_assignee
  ON public.follow_up_quotation_tracking(organisation_id, assignee_user_id);

CREATE INDEX IF NOT EXISTS idx_follow_up_podc_assignee
  ON public.follow_up_podc_backlog(organisation_id, assignee_user_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_follow_up_invoice_assignee
  ON public.follow_up_invoice_tracking(organisation_id, assignee_user_id);

COMMENT ON COLUMN public.follow_up_quotation_tracking.assignee_user_id IS 'Org member responsible for quote follow-up';
COMMENT ON COLUMN public.follow_up_podc_backlog.assignee_user_id IS 'Org member responsible for PO/DC follow-up';
COMMENT ON COLUMN public.follow_up_invoice_tracking.assignee_user_id IS 'Org member responsible for invoice collection follow-up';

COMMIT;
