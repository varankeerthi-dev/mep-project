-- Migration: 20261019000002_followup_vocabulary_and_stage_dedupe.sql
-- Description: Guarantees the follow-up vocabulary the quotation loop writes, and adds the
--              idempotency key change_quotation_stage needs (PRD v3.5 H3, H8, §5.4).
--
-- Why this re-states constraints that 20260916121500_remediation_followup_vocabulary.sql already
-- authoring: that migration and the live capture are the same day (2026-09-16), and the capture -
-- the only live evidence available, since the catalog re-run was waived - shows the OLD narrow
-- CHECKs. So the deployment state of the remediation migration is unknown. Rather than assume
-- either way, this migration converges: each constraint is replaced by a fixed name with a list
-- that is a superset of both the capture and the remediation text, so applying it is correct
-- whether or not the September migration ran. Widening a CHECK can never invalidate existing
-- rows, because every value already stored satisfied the narrower list.
--
-- Values are taken from what the application actually writes (src/types/followup.ts
-- ActivityEventType / FollowUpTab and every call site of follow_up_log_activity), not from a
-- wish list. Two additions beyond the September text:
--   * po_created, po_expected_updated, po_supplier_call_logged, followup_reassigned - already in
--     the TS union and already written by FollowupsTable.tsx:61, so they were being rejected live
--     and swallowed.
--   * followup_priority_changed - replaces the 'escalation' value the Kanban drag handler writes,
--     which no vocabulary has ever accepted.

-- ---------------------------------------------------------------------------
-- 0. Pre-flight
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_missing TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF to_regclass('public.follow_up_activity_log') IS NULL THEN
    v_missing := array_append(v_missing, 'table public.follow_up_activity_log');
  END IF;
  IF to_regclass('public.follow_up_quotation_tracking') IS NULL THEN
    v_missing := array_append(v_missing, 'table public.follow_up_quotation_tracking');
  END IF;
  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'pre-flight failed, missing: %', array_to_string(v_missing, ', ')
      USING HINT = 'The deployed schema differs from the 2026-09-16 remediation capture; verify before applying.';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 1. event_type
-- ---------------------------------------------------------------------------
ALTER TABLE public.follow_up_activity_log
  DROP CONSTRAINT IF EXISTS follow_up_activity_log_event_type_check;

ALTER TABLE public.follow_up_activity_log
  ADD CONSTRAINT follow_up_activity_log_event_type_check
  CHECK (event_type = ANY (ARRAY[
    'quotation_reminder_sent'::text,
    'quotation_response_logged'::text,
    'quotation_status_changed'::text,
    'quotation_expired'::text,
    'podc_pack_shared'::text,
    'podc_issue_flagged'::text,
    'invoice_reminder_sent'::text,
    'invoice_escalation_changed'::text,
    'invoice_edited'::text,
    'invoice_finalized'::text,
    'approval_status_changed'::text,
    'procurement_reminder_sent'::text,
    'po_created'::text,
    'po_expected_updated'::text,
    'po_supplier_call_logged'::text,
    'followup_reassigned'::text,
    'followup_priority_changed'::text
  ]));

-- ---------------------------------------------------------------------------
-- 2. tab_source
-- ---------------------------------------------------------------------------
ALTER TABLE public.follow_up_activity_log
  DROP CONSTRAINT IF EXISTS follow_up_activity_log_tab_source_check;

ALTER TABLE public.follow_up_activity_log
  ADD CONSTRAINT follow_up_activity_log_tab_source_check
  CHECK (tab_source = ANY (ARRAY[
    'quotation'::text,
    'podc'::text,
    'invoice'::text,
    'procurement'::text,
    'lead'::text,
    'queue'::text,
    'activity'::text
  ]));

-- ---------------------------------------------------------------------------
-- 3. sales stage vocabulary on the tracking row
-- ---------------------------------------------------------------------------
ALTER TABLE public.follow_up_quotation_tracking
  DROP CONSTRAINT IF EXISTS follow_up_quotation_tracking_follow_up_status_check;

ALTER TABLE public.follow_up_quotation_tracking
  ADD CONSTRAINT follow_up_quotation_tracking_follow_up_status_check
  CHECK (follow_up_status = ANY (ARRAY[
    'sent'::text,
    'under_review'::text,
    'in_negotiation'::text,
    'pending'::text,
    'approved'::text,
    'expired'::text,
    'cancelled'::text,
    'on_hold'::text,
    'lost_to_competitor'::text
  ]));

-- ---------------------------------------------------------------------------
-- 4. Idempotency for change_quotation_stage: a replayed submit must not write a second
--    audit row. Nullable because every pre-existing row predates the key.
-- ---------------------------------------------------------------------------
ALTER TABLE public.follow_up_activity_log
  ADD COLUMN IF NOT EXISTS dedupe_key uuid;

CREATE UNIQUE INDEX IF NOT EXISTS idx_follow_up_activity_dedupe
  ON public.follow_up_activity_log (dedupe_key)
  WHERE dedupe_key IS NOT NULL;

COMMENT ON COLUMN public.follow_up_activity_log.dedupe_key IS
  'Client-generated key identifying one logical stage change. A second write with the same key is a replay and must return the original result rather than duplicate the row.';

-- ---------------------------------------------------------------------------
-- 5. Converge with the September migration's last item: the audit primitive is SECURITY
--    DEFINER and must not be callable without a session. Guarded, because the argument list is
--    asserted rather than assumed.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regprocedure('public.follow_up_log_activity(uuid, text, text, text, text, uuid, text, jsonb, text)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.follow_up_log_activity(
      uuid, text, text, text, text, uuid, text, jsonb, text
    ) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.follow_up_log_activity(
      uuid, text, text, text, text, uuid, text, jsonb, text
    ) TO authenticated, service_role;
  ELSE
    RAISE NOTICE 'follow_up_log_activity does not have the expected 9-argument signature; grant left as deployed';
  END IF;
END;
$$;
