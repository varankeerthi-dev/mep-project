-- Migration: 20261019000001_quotation_approval_requirement_rpc.sql
-- Description: Server-side, fail-closed "does this quotation need approval?" decision (PRD v3.4 Q1).
--
-- Replaces the browser-side check in src/approvals/integration.ts (checkApprovalNeeded), which
-- returned { needed: false } on a missing session, an unresolved organisation or any query error,
-- so a database hiccup silently skipped the approval gate. It also took the amount from the
-- caller, so the number that decided the threshold was not the number on the saved document.
--
-- SECURITY DEFINER is deliberate: the live RLS on approval_settings and approval_workflows keys
-- membership off user_organisations, while quotation_header keys it off user_can_access_org() /
-- org_members (supabase/remediation/baseline_policies.json, captured 2026-09-16). Under SECURITY
-- INVOKER a caller who is an active org_member without a user_organisations row would read zero
-- settings rows and be told no approval is required - the same fail-open this change removes.
-- The definition is therefore pinned to a safe search_path and authorisation is re-established
-- explicitly below with user_can_access_org().

-- Pre-flight: the live catalog was captured 2026-09-16 and a re-run was waived, so assert against
-- the deployed schema instead of assuming it. This migration aborts rather than creating a
-- function that will raise at runtime.
DO $$
DECLARE
  v_missing TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF to_regclass('public.quotation_header') IS NULL THEN
    v_missing := array_append(v_missing, 'table public.quotation_header');
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quotation_header'
      AND column_name = 'grand_total'
  ) THEN
    v_missing := array_append(v_missing, 'column public.quotation_header.grand_total');
  END IF;

  IF to_regclass('public.approval_settings') IS NULL THEN
    v_missing := array_append(v_missing, 'table public.approval_settings');
  END IF;

  IF to_regclass('public.approval_workflows') IS NULL THEN
    v_missing := array_append(v_missing, 'table public.approval_workflows');
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'approval_workflows'
      AND column_name = 'is_active'
  ) THEN
    v_missing := array_append(v_missing, 'column public.approval_workflows.is_active');
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

CREATE OR REPLACE FUNCTION public.quotation_approval_requirement(p_quotation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_organisation_id  uuid;
  v_amount           numeric;
  v_setting_count    int;
  v_gate_enabled     boolean;
  v_requires_review  boolean;
  v_reviewer_id      text;
  v_workflow_count   int;
  v_matching_count   int;
  v_needed           boolean;
  v_reason           text;
BEGIN
  IF p_quotation_id IS NULL THEN
    RAISE EXCEPTION 'QUOTATION_APPROVAL_GATE: p_quotation_id is required';
  END IF;

  -- Amount and tenant come from the stored document, never from the caller.
  SELECT organisation_id, grand_total
    INTO v_organisation_id, v_amount
  FROM public.quotation_header
  WHERE id = p_quotation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'QUOTATION_APPROVAL_GATE: quotation % does not exist', p_quotation_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_organisation_id IS NULL THEN
    RAISE EXCEPTION 'QUOTATION_APPROVAL_GATE: quotation % has no organisation, so it cannot be gated', p_quotation_id;
  END IF;

  IF v_amount IS NULL THEN
    RAISE EXCEPTION 'QUOTATION_APPROVAL_GATE: quotation % has no stored total; save it before requesting approval', p_quotation_id;
  END IF;

  -- The DEFINER privilege must not become an oracle across tenants.
  IF NOT public.user_can_access_org(v_organisation_id) THEN
    RAISE EXCEPTION 'QUOTATION_APPROVAL_GATE: caller is not an active member of organisation %', v_organisation_id
      USING ERRCODE = '42501';
  END IF;

  SELECT count(*), coalesce(bool_or(setting_value = 'true'), false)
    INTO v_setting_count, v_gate_enabled
  FROM public.approval_settings
  WHERE organisation_id = v_organisation_id
    AND setting_key = 'QUOTATION';

  SELECT coalesce(bool_or(setting_value = 'true'), false)
    INTO v_requires_review
  FROM public.approval_settings
  WHERE organisation_id = v_organisation_id
    AND setting_key = 'QUOTATION_REQUIRES_REVIEW';

  SELECT max(nullif(setting_value, ''))
    INTO v_reviewer_id
  FROM public.approval_settings
  WHERE organisation_id = v_organisation_id
    AND setting_key = 'QUOTATION_REVIEWER_ID';

  SELECT count(*),
         count(*) FILTER (
           WHERE v_amount >= coalesce(min_amount, 0)
             AND (max_amount IS NULL OR v_amount <= max_amount)
         )
    INTO v_workflow_count, v_matching_count
  FROM public.approval_workflows
  WHERE organisation_id = v_organisation_id
    AND approval_type = 'QUOTATION'
    AND coalesce(is_active, false);

  IF v_setting_count > 0 AND NOT v_gate_enabled THEN
    -- An explicit "off" in Settings -> Approval -> Quotation is a decision, not a failure.
    v_needed := false;
    v_reason := 'GATE_DISABLED';
  ELSIF v_workflow_count > 0 THEN
    v_needed := v_matching_count > 0;
    v_reason := CASE WHEN v_needed THEN 'ABOVE_THRESHOLD' ELSE 'BELOW_THRESHOLD' END;
  ELSIF v_gate_enabled THEN
    -- Gate switched on but no tiers configured: approve anyway rather than wave it through.
    v_needed := true;
    v_reason := 'GATE_ENABLED_WITHOUT_WORKFLOWS';
  ELSE
    v_needed := false;
    v_reason := 'GATE_NOT_CONFIGURED';
  END IF;

  RETURN jsonb_build_object(
    'needed', v_needed,
    'reason', v_reason,
    'amount', v_amount,
    'organisation_id', v_organisation_id,
    'requires_review', v_requires_review,
    'reviewer_id', v_reviewer_id,
    'checked_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.quotation_approval_requirement(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quotation_approval_requirement(uuid) TO authenticated;

COMMENT ON FUNCTION public.quotation_approval_requirement(uuid) IS
  'Fail-closed quotation approval gate decision: reads amount and organisation from quotation_header, resolves the tenant''s QUOTATION gate settings and workflow tiers, and raises instead of defaulting to "no approval needed". Caller must be an active member of the quotation''s organisation.';
