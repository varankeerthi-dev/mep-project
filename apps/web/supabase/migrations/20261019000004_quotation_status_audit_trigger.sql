-- Migration: 20261019000004_quotation_status_audit_trigger.sql
-- Description: Observation-only BEFORE UPDATE trigger on quotation_header.status. It records every
--              raw status write and whether the Phase 1b document graph (PRD v3.4 §4.1) would have
--              allowed it. Nothing is rejected - this is the first half of the §4.4 / §11 rollout
--              ("audit-only trigger first, enforcement after a clean observation window").
--
-- Why it must not raise yet: Phase 1b puts a CHECK on quotation_header.status and rejects illegal
-- transitions here. Applying that on day one breaks every writer this PRD has not retired - the
-- approvals write-back (approvals/api.ts:659,830), Mark as Sent (QuotationList.tsx:1037), the
-- browser-side save path, and any caller the review missed. The window is how those writers get
-- enumerated from data instead of from grep.
--
-- The trigger swallows its own failures, which is the opposite of the H8 defect class elsewhere in
-- this loop. The difference is blast radius: a failed audit insert must never abort a quotation
-- save. The pre-flight below removes the failure modes that would otherwise leave the window
-- silently empty, and every skip is emitted as NOTICE so it can be seen in the query log.
--
-- Expect the window to report the sanctioned RPC itself. change_quotation_stage still projects
-- in_negotiation -> 'Under Negotiation' (mirroring TRANSITION_META today), and 'Under Negotiation'
-- is retired in §4.1, so those rows appear as actor_kind='rpc', reason='target_outside_vocabulary'.
-- That is the finding, not a false positive: Phase 1b has to change
-- quotation_document_status_for_stage in the same migration as the CHECK, or the RPC becomes the
-- first illegal writer.
--
-- Draft -> Pending Approval is deliberately absent from the edge list: §4.1 records the origin
-- state of integration.ts:256-263 as unconfirmed ("may also leave Draft"). If a writer performs
-- that transition the window shows it, which is the confirmation the PRD asked for.

-- ---------------------------------------------------------------------------
-- 0. Pre-flight
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_missing TEXT[] := ARRAY[]::TEXT[];
  v_def     TEXT;
BEGIN
  IF to_regclass('public.quotation_header') IS NULL THEN
    v_missing := array_append(v_missing, 'table public.quotation_header');
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quotation_header' AND column_name = 'status'
  ) THEN
    v_missing := array_append(v_missing, 'column quotation_header.status');
  END IF;

  IF to_regclass('public.follow_up_activity_log') IS NULL THEN
    v_missing := array_append(v_missing, 'table public.follow_up_activity_log');
  ELSE
    SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint
    WHERE conrelid = 'public.follow_up_activity_log'::regclass
      AND conname = 'follow_up_activity_log_event_type_check';

    IF v_def IS NULL THEN
      v_missing := array_append(v_missing, 'constraint follow_up_activity_log_event_type_check');
    ELSIF v_def NOT LIKE '%quotation_status_transition_audited%' THEN
      v_missing := array_append(v_missing,
        'event_type value quotation_status_transition_audited (re-run 20261019000002, it was edited after first draft)');
    END IF;
  END IF;

  IF to_regprocedure('public.change_quotation_stage(uuid, text, text, text, uuid)') IS NULL THEN
    v_missing := array_append(v_missing, 'function public.change_quotation_stage (run 20261019000003 first)');
  END IF;

  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'pre-flight failed, missing: %', array_to_string(v_missing, ', ')
      USING HINT = 'The deployed schema differs from the 2026-09-16 remediation capture; verify before applying.';
  END IF;

  -- Not fatal, but it decides whether the window has any rows in it. The trigger relies on the
  -- function owner being the table owner to get past follow_up_activity_log RLS; applied by a
  -- non-owner, every audit insert lands in the exception handler and the report looks clean.
  IF (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.follow_up_activity_log'::regclass) THEN
    RAISE NOTICE 'follow_up_activity_log has RLS enabled - apply this migration as the table owner (SQL editor / service role), otherwise the audit window stays empty.';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 1. The document vocabulary, as the database sees it (§4.1)
-- ---------------------------------------------------------------------------
-- Normalises the live token against the renamed one: PENDING_APPROVAL and 'Pending Approval' must
-- resolve to the same key, because the rename (Q5) is undecided and a case-sensitive literal check
-- on one spelling is dead on the other (F28, G3). 'Under Negotiation' normalises to a key that is
-- simply not canonical, so it reports as a retired value instead of being coerced.
CREATE OR REPLACE FUNCTION public.quotation_document_status_key(p_status text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN nullif(trim(coalesce(p_status, '')), '') IS NULL THEN NULL
    ELSE regexp_replace(upper(replace(trim(p_status), '_', ' ')), '\s+', ' ', 'g')
  END;
$$;

CREATE OR REPLACE FUNCTION public.quotation_document_status_is_canonical(p_key text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(p_key = ANY (ARRAY[
    'DRAFT', 'SENT', 'PENDING APPROVAL', 'APPROVED', 'CONVERTED',
    'REJECTED', 'CANCELLED', 'EXPIRED', 'SUPERSEDED'
  ]::text[]), false);
$$;

-- The legal edges, transcribed from PRD §4.1. Keys are the normalised form. p_system opens the
-- explicit system-only edges (§4.4: date-driven expiry and the versioning supersede); an
-- interactive writer may not take them, but the caller passes it true for the sanctioned RPC too,
-- which may legitimately expire a quotation on a user's behalf.
CREATE OR REPLACE FUNCTION public.quotation_document_edge_is_legal(
  p_from_key text,
  p_to_key   text,
  p_system   boolean
) RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT coalesce((
    CASE p_from_key
      WHEN 'DRAFT' THEN ARRAY['SENT', 'CANCELLED']
      WHEN 'SENT' THEN
        ARRAY['PENDING APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED']
        || CASE WHEN p_system THEN ARRAY['EXPIRED', 'SUPERSEDED'] ELSE ARRAY[]::text[] END
      WHEN 'PENDING APPROVAL' THEN
        ARRAY['APPROVED', 'SENT', 'CANCELLED']
        || CASE WHEN p_system THEN ARRAY['EXPIRED'] ELSE ARRAY[]::text[] END
      WHEN 'APPROVED' THEN ARRAY['CONVERTED']
      ELSE ARRAY[]::text[]  -- Converted, Rejected, Superseded are terminal; unknown origins illegal
    END
  ) @> ARRAY[p_to_key], false);
$$;

-- ---------------------------------------------------------------------------
-- 2. The observation trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_quotation_status_transition_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id   uuid;
  v_actor_name text;
  v_rpc        boolean := coalesce(current_setting('app.allow_quotation_status_mutation', true), '') = 'true';
  v_system     boolean := false;
  v_actor_kind text;
  v_from_key   text;
  v_to_key     text;
  v_legal      boolean := false;
  v_reason     text;
BEGIN
  -- A quotation without an organisation cannot be logged against a tenant, and the activity row
  -- would fail anyway. Such a document is itself a finding, but it is not this trigger's job.
  IF NEW.organisation_id IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_actor_id := auth.uid();
    -- §4.4 defines a system actor as a write with no session behind it (the expiry job and any cron
    -- run on the service role, so auth.uid() is NULL), which is also why actor_name falls back to
    -- 'System' below. No extra GUC is needed to recognise it.
    v_system := v_actor_id IS NULL;
    v_actor_kind := CASE
      WHEN v_rpc    THEN 'rpc'
      WHEN v_system THEN 'system'
      ELSE 'interactive'
    END;

    v_from_key := public.quotation_document_status_key(OLD.status);
    v_to_key   := public.quotation_document_status_key(NEW.status);

    IF NOT public.quotation_document_status_is_canonical(v_to_key) THEN
      v_legal  := false;
      v_reason := CASE WHEN v_to_key IS NULL THEN 'target_null' ELSE 'target_outside_vocabulary' END;
    ELSIF NOT public.quotation_document_status_is_canonical(v_from_key) THEN
      v_legal  := false;
      v_reason := CASE WHEN v_from_key IS NULL THEN 'origin_null' ELSE 'origin_outside_vocabulary' END;
    ELSIF public.quotation_document_edge_is_legal(v_from_key, v_to_key, v_system OR v_rpc) THEN
      v_legal  := true;
      v_reason := NULL;
    ELSE
      v_legal  := false;
      v_reason := 'edge_not_allowed';
    END IF;

    IF v_actor_id IS NOT NULL THEN
      SELECT full_name INTO v_actor_name FROM public.user_profiles WHERE user_id = v_actor_id;
    END IF;

    INSERT INTO public.follow_up_activity_log (
      organisation_id, event_type, tab_source, title, description,
      reference_id, reference_label, metadata, actor_id, actor_name, created_at
    ) VALUES (
      NEW.organisation_id,
      'quotation_status_transition_audited',
      'quotation',
      'Status write observed: ' || coalesce(OLD.status, '(none)') || ' to ' || coalesce(NEW.status, '(none)'),
      CASE
        WHEN v_legal THEN 'Matches the Phase 1b document graph.'
        WHEN v_reason IN ('target_null', 'origin_null')
          THEN 'A status write with a blank side; the Phase 1b CHECK would reject it.'
        WHEN v_reason IN ('target_outside_vocabulary', 'origin_outside_vocabulary')
          THEN 'Value outside the canonical document vocabulary.'
        ELSE 'Transition not in the Phase 1b document graph.'
      END,
      NEW.id,
      NEW.quotation_no,
      jsonb_build_object(
        'audit_only', true,
        'from', OLD.status,
        'to', NEW.status,
        'from_key', v_from_key,
        'to_key', v_to_key,
        'legal', v_legal,
        'reason', v_reason,
        'actor_kind', v_actor_kind,
        'quotation_total', NEW.grand_total
      ),
      v_actor_id,
      -- 'System' must mean "no session", not "the profile row is missing", or the audit trail
      -- mislabels a real person as the cron.
      coalesce(v_actor_name, CASE WHEN v_actor_id IS NULL THEN 'System' ELSE 'Unknown member' END),
      now()
    );
  EXCEPTION WHEN OTHERS THEN
    -- Never fail the save. An audit window with holes is a worse-but-still-usable instrument than
    -- a quotation module that throws.
    RAISE NOTICE 'quotation status audit skipped for %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quotation_status_transition_audit ON public.quotation_header;
CREATE TRIGGER trg_quotation_status_transition_audit
BEFORE UPDATE ON public.quotation_header
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.trg_quotation_status_transition_audit();

-- ---------------------------------------------------------------------------
-- 3. The window report
-- ---------------------------------------------------------------------------
-- Detail, then the aggregate the go/no-go is actually read from (§11: "no legitimate rejected
-- writes over an agreed window"). Both are security_invoker so follow_up_activity_log RLS keeps
-- applying - this is a report over tenant rows, not a way to read another organisation's log.
CREATE OR REPLACE VIEW public.quotation_status_transition_audit
WITH (security_invoker = on)
AS
SELECT
  l.created_at,
  l.organisation_id,
  l.reference_id                AS quotation_id,
  l.reference_label             AS quotation_no,
  l.actor_id,
  l.actor_name,
  l.metadata ->> 'from'         AS from_status,
  l.metadata ->> 'to'           AS to_status,
  (l.metadata ->> 'legal')::boolean AS graph_allows,
  l.metadata ->> 'reason'       AS reason,
  l.metadata ->> 'actor_kind'   AS actor_kind,
  l.metadata
FROM public.follow_up_activity_log l
WHERE l.event_type = 'quotation_status_transition_audited'
ORDER BY l.created_at DESC;

CREATE OR REPLACE VIEW public.quotation_status_transition_reject_report
WITH (security_invoker = on)
AS
SELECT
  l.organisation_id,
  l.metadata ->> 'from'                    AS from_status,
  l.metadata ->> 'to'                      AS to_status,
  l.metadata ->> 'reason'                  AS reason,
  l.metadata ->> 'actor_kind'              AS actor_kind,
  count(*)                                 AS writes,
  min(l.created_at)                        AS first_seen,
  max(l.created_at)                        AS last_seen
FROM public.follow_up_activity_log l
WHERE l.event_type = 'quotation_status_transition_audited'
  AND (l.metadata ->> 'legal')::boolean IS NOT TRUE
GROUP BY 1, 2, 3, 4, 5
ORDER BY count(*) DESC;

-- ---------------------------------------------------------------------------
-- 4. Grants
-- ---------------------------------------------------------------------------
-- The trigger function is SECURITY DEFINER and Postgres grants EXECUTE to PUBLIC by default, so it
-- has to be pulled back or any session could call the writer directly. Firing the trigger does not
-- require EXECUTE.
REVOKE ALL ON FUNCTION public.trg_quotation_status_transition_audit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.quotation_document_status_key(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.quotation_document_status_is_canonical(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.quotation_document_edge_is_legal(text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quotation_document_status_key(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.quotation_document_status_is_canonical(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.quotation_document_edge_is_legal(text, text, boolean) TO authenticated;

-- Supabase's default privileges hand anon read on anything created in public, so the reports are
-- pinned to the roles that have a reason to read them.
REVOKE ALL ON public.quotation_status_transition_audit FROM anon;
REVOKE ALL ON public.quotation_status_transition_reject_report FROM anon;
GRANT SELECT ON public.quotation_status_transition_audit TO authenticated, service_role;
GRANT SELECT ON public.quotation_status_transition_reject_report TO authenticated, service_role;

COMMENT ON FUNCTION public.trg_quotation_status_transition_audit() IS
  'Audit-only observer for quotation_header.status changes: logs the raw from/to, the normalised keys, whether the Phase 1b document graph would allow the edge, and the actor kind (rpc / system / interactive, where system means no session behind the write). Never raises. Phase 1b flips it to enforcing.';
COMMENT ON VIEW public.quotation_status_transition_reject_report IS
  'Rejected-or-outside-vocabulary status writes grouped by transition, reason and actor kind. Read this to decide whether enforcement can be switched on (§11 Phase 1b).';
