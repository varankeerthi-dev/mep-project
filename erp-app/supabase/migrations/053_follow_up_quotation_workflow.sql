-- =============================================================================
-- FOLLOW-UP CENTRE — Status Workflow Enhancements
-- Adds: extended quotation statuses, status history log, enhanced tracking fields
-- Run after: 051_follow_up_centre.sql and 052_follow_up_assignee.sql
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Extend follow_up_quotation_tracking status CHECK constraint
-- ---------------------------------------------------------------------------
ALTER TABLE public.follow_up_quotation_tracking
  DROP CONSTRAINT IF EXISTS follow_up_quotation_tracking_follow_up_status_check;

ALTER TABLE public.follow_up_quotation_tracking
  ADD CONSTRAINT follow_up_quotation_tracking_follow_up_status_check
  CHECK (follow_up_status IN (
    'sent', 'under_review', 'in_negotiation', 'pending',
    'lost_to_competitor', 'approved', 'expired', 'cancelled', 'on_hold'
  ));

-- ---------------------------------------------------------------------------
-- 2. Add tracking fields to follow_up_quotation_tracking
-- ---------------------------------------------------------------------------
ALTER TABLE public.follow_up_quotation_tracking
  ADD COLUMN IF NOT EXISTS previous_status TEXT,
  ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status_changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 3. Add quotation_header statuses for workflow
-- Ensure quotation_header supports Cancelled and PENDING_APPROVAL statuses
-- (These may already exist in the main schema; only add if missing)
-- ---------------------------------------------------------------------------
-- Note: quotation_header.status is a TEXT column, so new status values
-- 'Cancelled' and 'PENDING_APPROVAL' work without ALTER.
-- We extend the QUOTATION_FOLLOW_UP_STATUSES filter in the app layer.

-- ---------------------------------------------------------------------------
-- 4. Activity log event types — add new quotation workflow events
-- ---------------------------------------------------------------------------
ALTER TABLE public.follow_up_activity_log
  DROP CONSTRAINT IF EXISTS follow_up_activity_log_event_type_check;

ALTER TABLE public.follow_up_activity_log
  ADD CONSTRAINT follow_up_activity_log_event_type_check
  CHECK (event_type IN (
    'quotation_reminder_sent',
    'quotation_response_logged',
    'quotation_status_changed',
    'quotation_expired',
    'podc_pack_shared',
    'podc_issue_flagged',
    'invoice_reminder_sent',
    'invoice_escalation_changed'
  ));

-- ---------------------------------------------------------------------------
-- 5. Standardised quotation status history log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.follow_up_quotation_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  quotation_id UUID NOT NULL REFERENCES public.quotation_header(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_quotation_status_history_org
  ON public.follow_up_quotation_status_history(organisation_id);

CREATE INDEX IF NOT EXISTS idx_quotation_status_history_quotation
  ON public.follow_up_quotation_status_history(organisation_id, quotation_id, changed_at DESC);

-- ---------------------------------------------------------------------------
-- 6. RLS for status history
-- ---------------------------------------------------------------------------
ALTER TABLE public.follow_up_quotation_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS follow_up_quotation_status_history_select ON public.follow_up_quotation_status_history;
DROP POLICY IF EXISTS follow_up_quotation_status_history_all ON public.follow_up_quotation_status_history;

CREATE POLICY follow_up_quotation_status_history_select ON public.follow_up_quotation_status_history
  FOR SELECT TO authenticated
  USING (public.user_can_access_org(organisation_id));

CREATE POLICY follow_up_quotation_status_history_all ON public.follow_up_quotation_status_history
  FOR ALL TO authenticated
  USING (public.user_can_access_org(organisation_id))
  WITH CHECK (public.user_can_access_org(organisation_id));

-- ---------------------------------------------------------------------------
-- 7. Trigger: log status changes to history table
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.quotation_status_history_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.follow_up_status IS DISTINCT FROM NEW.follow_up_status THEN
    INSERT INTO public.follow_up_quotation_status_history (
      organisation_id, quotation_id, from_status, to_status, changed_by, notes
    ) VALUES (
      NEW.organisation_id,
      NEW.quotation_id,
      OLD.follow_up_status,
      NEW.follow_up_status,
      auth.uid(),
      COALESCE(NEW.notes, '')
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quotation_status_history ON public.follow_up_quotation_tracking;
CREATE TRIGGER trg_quotation_status_history
  AFTER UPDATE ON public.follow_up_quotation_tracking
  FOR EACH ROW EXECUTE FUNCTION public.quotation_status_history_trigger();

-- ---------------------------------------------------------------------------
-- 8. Auto-expire quotations past valid_till (batch procedure)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expire_stale_quotations(p_organisation_id UUID)
RETURNS TABLE(expired_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  rec RECORD;
BEGIN
  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Access denied for organisation';
  END IF;

  FOR rec IN
    SELECT t.id AS tracking_id, t.quotation_id, t.follow_up_status AS old_status
    FROM public.follow_up_quotation_tracking t
    JOIN public.quotation_header q ON q.id = t.quotation_id
    WHERE t.organisation_id = p_organisation_id
      AND t.follow_up_status IN ('sent', 'under_review', 'in_negotiation', 'pending', 'on_hold')
      AND q.valid_till IS NOT NULL
      AND q.valid_till::date < CURRENT_DATE
  LOOP
    UPDATE public.follow_up_quotation_tracking
    SET follow_up_status = 'expired',
        previous_status = rec.old_status,
        status_changed_at = now(),
        notes = 'Auto-expired: validity date passed'
    WHERE t.id = rec.tracking_id;

    v_count := v_count + 1;

    PERFORM public.follow_up_log_activity(
      p_organisation_id,
      'quotation_expired',
      'quotation',
      'Quotation expired',
      concat('Quotation validity date passed — auto-expired from ', rec.old_status),
      rec.quotation_id,
      '',
      '{"auto": true}'::jsonb,
      NULL
    );
  END LOOP;

  RETURN QUERY SELECT v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_stale_quotations TO authenticated;

COMMIT;