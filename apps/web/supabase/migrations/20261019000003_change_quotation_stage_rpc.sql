-- Migration: 20261019000003_change_quotation_stage_rpc.sql
-- Description: The single server-side path for a quotation stage change, with the transition
--              graph, the document-status projection and idempotency all enforced in the
--              database (PRD v3.4 §5.4, §4.2).
--
-- Today the row menu on the Follow-up Center writes follow_up_quotation_tracking.follow_up_status
-- and quotation_header.status from the browser, with the graph validated in TypeScript only. Any
-- other writer can therefore put a quotation in a stage the UI would never offer, and a
-- double-click writes two audit rows. This function is the version those writers are meant to
-- call: it re-checks the graph server-side, refuses to move a quotation whose approval request is
-- still open, and treats a repeated dedupe key as a replay rather than a second change.
--
-- Step 10 of §5.3 (notification fan-out) is deliberately absent: the canonical notifications
-- table does not exist yet (H1) and is Phase 3. Nothing is lost relative to today, because the
-- browser path notifies no one either.
--
-- The transition graph and the dbStatus projections are transcribed from
-- src/lib/followup/quotation-workflow.ts (TRANSITION_GRAPH, TRANSITION_META) and
-- src/follow-up/api.ts (mapQuotationStatus). They are duplicated here on purpose - the database
-- cannot import TypeScript - so the two must move together. The Phase 1b trigger reuses the same
-- SQL helpers rather than re-deriving them.

-- ---------------------------------------------------------------------------
-- 0. Pre-flight
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_missing TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF to_regclass('public.follow_up_quotation_tracking') IS NULL THEN
    v_missing := array_append(v_missing, 'table public.follow_up_quotation_tracking');
  ELSIF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN LATERAL (
      SELECT array_agg(att.attname::text ORDER BY x.ord) AS cols
      FROM unnest(c.conkey) WITH ORDINALITY AS x(attnum, ord)
      JOIN pg_attribute att ON att.attrelid = c.conrelid AND att.attnum = x.attnum
    ) k ON true
    WHERE c.conrelid = 'public.follow_up_quotation_tracking'::regclass
      AND c.contype = 'u'
      AND k.cols = ARRAY['organisation_id', 'quotation_id']::text[]
  ) THEN
    v_missing := array_append(v_missing, 'unique(organisation_id, quotation_id) on follow_up_quotation_tracking');
  END IF;

  IF to_regclass('public.follow_up_activity_log') IS NULL THEN
    v_missing := array_append(v_missing, 'table public.follow_up_activity_log');
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'follow_up_activity_log' AND column_name = 'dedupe_key'
  ) THEN
    v_missing := array_append(v_missing, 'column follow_up_activity_log.dedupe_key (run 20261019000002 first)');
  END IF;

  IF to_regprocedure('public.user_can_access_org(uuid)') IS NULL THEN
    v_missing := array_append(v_missing, 'function public.user_can_access_org(uuid)');
  END IF;

  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'pre-flight failed, missing: %', array_to_string(v_missing, ', ')
      USING HINT = 'The deployed schema differs from the 2026-09-16 remediation capture; verify before applying.';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 1. The transition graph, as the database sees it
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.quotation_stage_is_legal(p_from text, p_to text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT coalesce((
    CASE p_from
      WHEN 'sent'           THEN ARRAY['under_review','in_negotiation','pending','lost_to_competitor','cancelled']
      WHEN 'under_review'   THEN ARRAY['in_negotiation','pending','approved','lost_to_competitor','on_hold','cancelled']
      WHEN 'in_negotiation' THEN ARRAY['approved','pending','under_review','lost_to_competitor','on_hold','cancelled']
      WHEN 'pending'        THEN ARRAY['under_review','in_negotiation','lost_to_competitor','on_hold','cancelled']
      WHEN 'expired'        THEN ARRAY['under_review','in_negotiation','pending','cancelled']
      WHEN 'cancelled'      THEN ARRAY['sent']
      WHEN 'on_hold'        THEN ARRAY['under_review','in_negotiation','pending','cancelled']
      ELSE ARRAY[]::text[]  -- approved and lost_to_competitor are terminal; unknown values are illegal
    END
  ) @> ARRAY[p_to], false);
$$;

-- Stage -> quotation_header.status. Mirrors TRANSITION_META.dbStatus plus the stage the menu
-- cannot reach (sent) and the auto-ageing stage (expired).
CREATE OR REPLACE FUNCTION public.quotation_document_status_for_stage(p_stage text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE p_stage
    WHEN 'sent'              THEN 'Sent'
    WHEN 'under_review'      THEN 'Sent'
    WHEN 'pending'           THEN 'Sent'
    WHEN 'on_hold'           THEN 'Sent'
    WHEN 'in_negotiation'    THEN 'Under Negotiation'
    WHEN 'approved'          THEN 'Approved'
    WHEN 'lost_to_competitor' THEN 'Rejected'
    WHEN 'cancelled'         THEN 'Cancelled'
    WHEN 'expired'           THEN 'Expired'
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.quotation_stage_label(p_stage text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE p_stage
    WHEN 'sent'               THEN 'Sent'
    WHEN 'under_review'       THEN 'Under Review'
    WHEN 'in_negotiation'     THEN 'In Negotiation'
    WHEN 'pending'            THEN 'Pending'
    WHEN 'on_hold'            THEN 'On Hold'
    WHEN 'approved'           THEN 'Approved'
    WHEN 'lost_to_competitor' THEN 'Lost to Competitor'
    WHEN 'cancelled'          THEN 'Cancelled'
    WHEN 'expired'            THEN 'Expired'
    ELSE initcap(p_stage)
  END;
$$;

-- ---------------------------------------------------------------------------
-- 2. The stage change
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.change_quotation_stage(
  p_quotation_id   uuid,
  p_expected_stage text,
  p_next_stage     text,
  p_reason         text,
  p_dedupe_key     uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_organisation_id  uuid;
  v_quotation_no     text;
  v_header_status    text;
  v_valid_till       date;
  v_tracking_stage   text;
  v_current_stage    text;
  v_document_status  text;
  v_actor_id         uuid := auth.uid();
  v_actor_name       text;
  v_last_actor_name  text;
  v_activity_id      uuid;
  v_existing         follow_up_activity_log%ROWTYPE;
  v_reason           text := nullif(trim(coalesce(p_reason, '')), '');
BEGIN
  IF p_quotation_id IS NULL THEN
    RAISE EXCEPTION 'STAGE_QUOTATION_REQUIRED: a quotation id is required';
  END IF;
  IF v_reason IS NULL OR length(v_reason) < 3 THEN
    RAISE EXCEPTION 'STAGE_REASON_REQUIRED: a stage change needs a reason';
  END IF;
  IF p_next_stage IS NULL THEN
    RAISE EXCEPTION 'STAGE_ARGUMENT_REQUIRED: a target stage is required';
  END IF;
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'STAGE_UNAUTHENTICATED: an authenticated session is required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM unnest(ARRAY[
      'sent','under_review','in_negotiation','pending','approved',
      'expired','cancelled','on_hold','lost_to_competitor'
    ]) AS s(value) WHERE s.value = p_next_stage
  ) THEN
    RAISE EXCEPTION 'STAGE_UNKNOWN: % is not a quotation stage', p_next_stage;
  END IF;

  SELECT organisation_id, quotation_no, status, valid_till
    INTO v_organisation_id, v_quotation_no, v_header_status, v_valid_till
  FROM public.quotation_header
  WHERE id = p_quotation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'STAGE_QUOTATION_NOT_FOUND: quotation % does not exist', p_quotation_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_organisation_id IS NULL THEN
    RAISE EXCEPTION 'STAGE_WITHOUT_ORGANISATION: quotation % has no organisation', p_quotation_id;
  END IF;

  IF NOT public.user_can_access_org(v_organisation_id) THEN
    RAISE EXCEPTION 'STAGE_FORBIDDEN: caller is not an active member of organisation %', v_organisation_id
      USING ERRCODE = '42501';
  END IF;

  -- A replay of the same logical change returns the original row and writes nothing.
  IF p_dedupe_key IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM public.follow_up_activity_log
    WHERE dedupe_key = p_dedupe_key
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'replayed', true,
        'activity_id', v_existing.id,
        'result', v_existing.metadata
      );
    END IF;
  END IF;

  SELECT follow_up_status INTO v_tracking_stage
  FROM public.follow_up_quotation_tracking
  WHERE organisation_id = v_organisation_id
    AND quotation_id = p_quotation_id;

  -- With no tracking row the effective stage is the one the list already shows the user,
  -- derived from the document status exactly as src/follow-up/api.ts mapQuotationStatus does
  -- (including its null-is-'sent' default, so the two sides never disagree about the starting
  -- stage and produce a STAGE_CONFLICT the user cannot explain).
  v_current_stage := coalesce(v_tracking_stage, CASE
    WHEN lower(coalesce(v_header_status, 'sent')) LIKE '%negotiation%'  THEN 'in_negotiation'
    WHEN lower(coalesce(v_header_status, 'sent')) LIKE '%review%'       THEN 'under_review'
    WHEN lower(coalesce(v_header_status, 'sent')) = 'rejected'          THEN 'lost_to_competitor'
    WHEN lower(coalesce(v_header_status, 'sent')) = 'sent'              THEN 'sent'
    WHEN lower(coalesce(v_header_status, 'sent')) = 'approved'          THEN 'approved'
    WHEN lower(coalesce(v_header_status, 'sent')) = 'expired'           THEN 'expired'
    WHEN lower(coalesce(v_header_status, 'sent')) = 'cancelled'         THEN 'cancelled'
    WHEN lower(coalesce(v_header_status, 'sent')) IN ('pending_approval', 'pending approval') THEN 'pending'
    ELSE 'pending'
  END);

  -- Ageing, mirroring detectEffectiveStatus exactly: it applies to a stored stage, and not to a
  -- closed one. The no-tracking-row branch deliberately skips it, because the list query skips it
  -- too (src/follow-up/api.ts mapQuotationStatus). If the two disagreed, every click on an aged
  -- row would come back as STAGE_CONFLICT.
  IF v_tracking_stage IS NOT NULL
     AND v_current_stage NOT IN ('approved', 'lost_to_competitor', 'cancelled', 'on_hold')
     AND v_valid_till IS NOT NULL
     AND v_valid_till < current_date THEN
    v_current_stage := 'expired';
  END IF;

  -- Checked before the compare-and-set, because "an approval is in flight" is the more useful
  -- message than "the stage moved" when both are true.
  -- Both spellings, because the live token is PENDING_APPROVAL and a case-sensitive literal
  -- check on 'Pending Approval' would silently never match (F33, G3).
  IF lower(coalesce(v_header_status, '')) IN ('pending_approval', 'pending approval') THEN
    RAISE EXCEPTION 'QUOTATION_UNDER_APPROVAL: % has an approval request in flight — return or reject it before changing the stage', v_quotation_no;
  END IF;

  -- Compare-and-set. A caller that never saw a stage (the quotation document view) passes NULL
  -- and skips it; the graph, the tenant check, the approval guard and the audit row still apply.
  IF p_expected_stage IS NOT NULL AND p_expected_stage <> v_current_stage THEN
    SELECT last_row.actor_name INTO v_last_actor_name
    FROM (
      SELECT actor_name
      FROM public.follow_up_activity_log
      WHERE organisation_id = v_organisation_id
        AND reference_id = p_quotation_id
        AND event_type = 'quotation_status_changed'
      ORDER BY created_at DESC
      LIMIT 1
    ) last_row;

    RAISE EXCEPTION 'STAGE_CONFLICT: % is at %, not %. Reload the list and try again.',
      v_quotation_no, public.quotation_stage_label(v_current_stage), public.quotation_stage_label(p_expected_stage)
      USING HINT = coalesce('Last recorded change by ' || v_last_actor_name, 'No recorded change on this quotation');
  END IF;

  IF NOT public.quotation_stage_is_legal(v_current_stage, p_next_stage) THEN
    RAISE EXCEPTION 'STAGE_NOT_ALLOWED: % to % is not a legal transition',
      public.quotation_stage_label(v_current_stage), public.quotation_stage_label(p_next_stage);
  END IF;

  v_document_status := public.quotation_document_status_for_stage(p_next_stage);

  INSERT INTO public.follow_up_quotation_tracking (
    organisation_id, quotation_id, follow_up_status, next_action_label, created_at, created_by, updated_at
  ) VALUES (
    v_organisation_id, p_quotation_id, p_next_stage,
    public.quotation_stage_label(p_next_stage), now(), v_actor_id, now()
  )
  ON CONFLICT (organisation_id, quotation_id) DO UPDATE
    SET follow_up_status = EXCLUDED.follow_up_status,
        next_action_label = EXCLUDED.next_action_label,
        updated_at = now();

  IF v_document_status IS NOT NULL THEN
    -- Transaction-local tag so the observation trigger (20261019000004) records this header write
    -- as a sanctioned RPC rather than an untracked browser write. Name and value follow the
    -- app.allow_* = 'true' convention the 19 live financial guards already use.
    PERFORM set_config('app.allow_quotation_status_mutation', 'true', true);

    UPDATE public.quotation_header
       SET status = v_document_status,
           updated_at = now()
     WHERE id = p_quotation_id;
  END IF;

  SELECT full_name INTO v_actor_name
  FROM public.user_profiles
  WHERE user_id = v_actor_id;

  BEGIN
    INSERT INTO public.follow_up_activity_log (
      organisation_id, event_type, tab_source, title, description,
      reference_id, reference_label, metadata, actor_id, actor_name, dedupe_key, created_at
    ) VALUES (
      v_organisation_id,
      'quotation_status_changed',
      'quotation',
      'Stage changed: ' || public.quotation_stage_label(v_current_stage) || ' to ' || public.quotation_stage_label(p_next_stage),
      v_reason,
      p_quotation_id,
      v_quotation_no,
      jsonb_build_object(
        'from', v_current_stage,
        'to', p_next_stage,
        'reason', v_reason,
        'document_status', v_document_status
      ),
      v_actor_id,
      coalesce(v_actor_name, 'System'),
      p_dedupe_key,
      now()
    )
    RETURNING id INTO v_activity_id;
  EXCEPTION WHEN unique_violation THEN
    -- Two tabs racing with the same key: the first write won, this one is a replay.
    SELECT * INTO v_existing
    FROM public.follow_up_activity_log
    WHERE dedupe_key = p_dedupe_key
    LIMIT 1;

    RETURN jsonb_build_object(
      'replayed', true,
      'activity_id', v_existing.id,
      'result', v_existing.metadata
    );
  END;

  RETURN jsonb_build_object(
    'replayed', false,
    'activity_id', v_activity_id,
    'result', jsonb_build_object(
      'quotation_id', p_quotation_id,
      'previous_stage', v_current_stage,
      'stage', p_next_stage,
      'document_status', v_document_status
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.change_quotation_stage(uuid, text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.change_quotation_stage(uuid, text, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.quotation_stage_is_legal(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.quotation_document_status_for_stage(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.quotation_stage_label(text) TO authenticated;

COMMENT ON FUNCTION public.change_quotation_stage(uuid, text, text, text, uuid) IS
  'The only sanctioned write path for a quotation sales stage: authorises the tenant, optionally compare-and-sets on the expected stage (pass NULL from surfaces that never read one), validates the transition graph, blocks stages while an approval is in flight, projects quotation_header.status, and writes one idempotent audit row. Raises STAGE_CONFLICT, STAGE_NOT_ALLOWED, STAGE_REASON_REQUIRED or QUOTATION_UNDER_APPROVAL.';
