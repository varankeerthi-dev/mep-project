-- Migration: 20261019000005_quotation_edit_guard_under_approval.sql
-- Description: PRD v3.4 F33 / G3 - a quotation cannot be edited while its approval request is
--              open, enforced in the database on the save path, with one named error.
--
-- WHAT CHANGES FOR USERS (G4 release note, PRD §4.5)
-- Before this migration, "Submit for approval" locked nothing: the quotation stayed editable and
-- the editor could change rates, quantities, discounts or the client while a manager was reading
-- the numbers submitted a minute earlier. The approval could therefore land on a document that is
-- not the document that was approved. After it, Save on such a quotation fails with a message
-- naming the request and the approver at its current level. That removes an edit users have today,
-- so it needs a release note and an announcement before it is applied.
--
-- WHY THE CHECK KEYS ON public.approvals AND NOT ON quotation_header.status
-- The status column is written by the browser after the request row is created
-- (approvals/integration.ts:267-273) and those write-backs discard their own errors
-- (approvals/api.ts:670, :841, :923 never check the result). A header whose status never moved
-- would therefore pass a status-string guard while its request is wide open, which is precisely
-- the "ships as a no-op" failure mode G3 warns about. The approvals row is the record the approval
-- itself is read from, so it is the record the lock has to be read from too.
--
-- WHY ONLY status = 'PENDING' COUNTS AS OPEN
-- approvals.status can be PENDING, APPROVED, REJECTED, HOLD, FORWARDED or RETURNED. Both live
-- decision paths refuse to act on anything but PENDING (approvals/api.ts:307 and
-- approvals/workflow-engine.ts:42); the one function that would accept HOLD,
-- executeApprovalGateDecision (approvalGateEngine.ts:415), has no call site. So a HOLD or FORWARDED
-- request cannot be approved, rejected or returned - only resubmitted back to PENDING. Including
-- those two in the blocked set would therefore freeze the document with no way for any approver to
-- close the request: the same unreachable-state bug just fixed on the reject path
-- (20261019000003 / Q2). REJECTED and RETURNED must release the lock by design - a rejected or
-- returned quotation is handed back to its author to fix and resubmit, so blocking it is a dead
-- end. APPROVED is already blocked by the existing approved/converted check.
-- GAP, left as a decision rather than a silent choice: while a request sits in HOLD or FORWARDED
-- the quotation is editable again, and approvals.amount keeps the figure captured at submission,
-- so an approval can still be decided against stale numbers. Closing it needs the approvals engine
-- to be able to close a HOLD/FORWARDED request first. See PRD §15 Q12.
--
-- RACE, accepted: the header row is locked before the request is read, so a decision that has
-- already been written is always seen; a request created after this read is not. That leaves a
-- save racing with "Submit for approval" still possible (it is possible today as well) and is not
-- worth a second lock on a table the approver's own write-back also locks.
--
-- OVERLOAD CONVERGENCE (read this before applying)
-- The 2026-09-16 remediation capture lists public.update_quotation with 16 parameters; the newest
-- definition in the repo (20261006000001) has 25, and both client call sites send all 25
-- (src/api.ts:677-703, .../CreateQuotation/hooks/useQuotationMutations.ts:222-248). The capture
-- predates those migrations, so it is not evidence about today's deploy. This matters because
-- CREATE OR REPLACE does NOT replace a function whose argument list differs - it creates a second
-- overload, and PostgREST then has to disambiguate two update_quotation functions while the guarded
-- one may never be the one that runs. The pre-flight therefore fails loudly unless exactly one
-- overload exists with the expected 25-type signature. Nothing is dropped. If it aborts, the
-- deployed save path is not the one in this repo and that must be resolved first.
--
-- The replacement body is 20261006000001 verbatim plus the guard; nothing else is re-derived. It
-- also pins search_path (the live function carries search_path=public) and revokes EXECUTE from
-- anon, which the capture shows as currently granted. anon cannot use the function either way -
-- auth.uid() is NULL for it and the body raises immediately - so that revocation is defence in
-- depth, not a behaviour change.
--
-- Apply as the owner of quotation_header, after 20261019000002 and 20261019000003. Idempotent.

-- ---------------------------------------------------------------------------
-- 0. Pre-flight
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_expected CONSTANT text := 'public.update_quotation(uuid, uuid, uuid, uuid, jsonb, text, text, date, '
    || 'text, text, text, text, text, text, integer, jsonb, text, boolean, numeric, numeric, numeric, '
    || 'boolean, boolean, jsonb, jsonb)';
  v_overloads INT;
  v_found TEXT;
  v_is_definer BOOLEAN;
BEGIN
  IF to_regclass('public.quotation_header') IS NULL THEN
    RAISE EXCEPTION 'pre-flight failed: table public.quotation_header is missing';
  END IF;

  IF to_regclass('public.approvals') IS NULL THEN
    RAISE EXCEPTION 'pre-flight failed: table public.approvals is missing'
      USING HINT = 'The edit lock is keyed on the approval request, so it cannot exist without this table.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM (
      SELECT unnest(ARRAY['reference_id', 'reference_type', 'approval_type', 'status',
                          'current_level', 'max_levels', 'organisation_id', 'requested_at']) AS need
    ) n
    LEFT JOIN information_schema.columns c
      ON c.table_schema = 'public' AND c.table_name = 'approvals' AND c.column_name = n.need
    WHERE c.column_name IS NULL
  ) THEN
    RAISE EXCEPTION 'pre-flight failed: public.approvals is missing a column the edit lock reads'
      USING HINT = 'Expected reference_id, reference_type, approval_type, status, current_level, '
                || 'max_levels, organisation_id, requested_at.';
  END IF;

  IF to_regprocedure('public.user_can_access_org(uuid)') IS NULL THEN
    RAISE EXCEPTION 'pre-flight failed: function public.user_can_access_org(uuid) is missing';
  END IF;

  SELECT count(*), max(p.secudef::text), max(p.proargstrings)
    INTO v_overloads, v_is_definer, v_found
    FROM (
      SELECT pr.prosecdef AS secudef,
             pg_get_function_arguments(pr.oid) AS proargstrings
        FROM pg_proc pr
        JOIN pg_namespace ns ON ns.oid = pr.pronamespace
       WHERE ns.nspname = 'public' AND pr.proname = 'update_quotation'
    ) p;

  IF coalesce(v_overloads, 0) > 1 THEN
    RAISE EXCEPTION 'pre-flight failed: public.update_quotation has % overloads', v_overloads
      USING HINT = 'Replace one signature and PostgREST picks the other, so the lock would be decoration. '
                || 'Drop the stale overload, then re-run this migration.';
  ELSIF coalesce(v_overloads, 0) = 1
    AND to_regprocedure(v_expected) IS NULL THEN
    RAISE EXCEPTION 'pre-flight failed: the deployed public.update_quotation is not the signature this migration replaces'
      USING HINT = 'Deployed: ' || v_found
                || E'\nExpected: ' || v_expected
                || E'\nThe deployed save path differs from 20261006000001. Reconcile it first; '
                || 'replacing a different argument list would leave two overloads behind.';
  ELSIF coalesce(v_overloads, 0) = 1 AND v_is_definer <> 'true' THEN
    RAISE EXCEPTION 'pre-flight failed: public.update_quotation is SECURITY INVOKER, and this migration keeps it DEFINER'
      USING HINT = 'The lock reads public.approvals, whose RLS would hide an open request from a browser '
                || 'role and make the guard fail open. Either apply it as the function owner with DEFINER, '
                || 'or change the guard to read the request through a security_invoker view first.';
  ELSIF coalesce(v_overloads, 0) = 0 THEN
    RAISE NOTICE 'public.update_quotation does not exist yet; this migration creates it. If the deployed database has a different save path, stop here.';
  END IF;

  IF to_regclass('public.user_profiles') IS NULL THEN
    RAISE NOTICE 'public.user_profiles is missing: the lock message will name the approval level but not the approver.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quotation_header_pkey'
  ) THEN
    RAISE NOTICE 'quotation_header has no primary key named quotation_header_pkey; the header lock still works, but check the capture.';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 1. The one definition of "this quotation has an open approval request"
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER on purpose, for the same live-schema reason as 20261019000001: the browser role
-- can read approvals but a future policy tightening would turn a missing row into "no approval
-- needed", which is the fail-open bug this whole phase removes. The tenant is checked before
-- anything is read, and only the requesting user's own organisation can ever reach a row.
CREATE OR REPLACE FUNCTION public.quotation_open_approval(
  p_quotation_id uuid,
  p_organisation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_approval_id   uuid;
  v_level         integer;
  v_max_levels    integer;
  v_requested_at  timestamptz;
  v_approver      text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'QUOTATION_OPEN_APPROVAL: no session';
  END IF;
  IF NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'QUOTATION_OPEN_APPROVAL: organization mismatch';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.quotation_header
    WHERE id = p_quotation_id AND organisation_id = p_organisation_id
  ) THEN
    RETURN NULL;
  END IF;

  -- reference_type is matched in both spellings because approvalGateEngine.ts:563 still defends
  -- against 'quotation_header' rows and no CHECK constrains the column. approval_type is accepted
  -- as an alternative key for the same reason: legacy rows are not guaranteed to agree.
  SELECT a.id, a.current_level, a.max_levels, a.requested_at
    INTO v_approval_id, v_level, v_max_levels, v_requested_at
    FROM public.approvals a
   WHERE a.reference_id = p_quotation_id
     AND a.status = 'PENDING'
     AND (a.reference_type::text IN ('quotations', 'quotation_header')
          OR a.approval_type::text = 'QUOTATION')
   ORDER BY a.requested_at DESC NULLS LAST
   LIMIT 1;

  IF v_approval_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Best effort only. approver_id lives in auth.uid() space by FK (H5: approval_workflows.approver_id
  -- -> user_profiles(user_id)), so the name is read from user_profiles and NOT from employees.id --
  -- that is the mapping getContact (approvals/notifications.ts:11-18) gets wrong today, which is why
  -- approval contacts silently come back null. approver_id is often NULL (a role-based level names
  -- no one). A lookup that fails must not weaken the lock, so this cannot raise out of the function.
  BEGIN
    SELECT p.full_name INTO v_approver
      FROM public.approval_workflows w
      LEFT JOIN public.user_profiles p ON p.user_id = w.approver_id
     WHERE w.approval_type = 'QUOTATION'
       AND w.level = coalesce(v_level, 1)
       AND coalesce(w.is_active, true)
       AND w.approver_id IS NOT NULL
     ORDER BY w.min_amount NULLS FIRST
     LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_approver := NULL;
  END;

  RETURN jsonb_build_object(
    'approval_id', v_approval_id,
    'level', coalesce(v_level, 1),
    'max_levels', coalesce(v_max_levels, 1),
    'requested_at', v_requested_at,
    'approver_name', v_approver
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- 2. The save path, with the lock
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_quotation(
  p_quotation_id uuid,
  p_organisation_id uuid,
  p_client_id uuid DEFAULT NULL::uuid,
  p_project_id uuid DEFAULT NULL::uuid,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_remarks text DEFAULT NULL::text,
  p_payment_terms text DEFAULT NULL::text,
  p_valid_till date DEFAULT NULL::date,
  p_billing_address text DEFAULT NULL::text,
  p_gstin text DEFAULT NULL::text,
  p_state text DEFAULT NULL::text,
  p_contact_no text DEFAULT NULL::text,
  p_reference text DEFAULT NULL::text,
  p_authorized_signatory_id text DEFAULT NULL::text,
  p_revision_no integer DEFAULT NULL::integer,
  p_revision_history jsonb DEFAULT NULL::jsonb,
  p_status text DEFAULT NULL::text,
  p_negotiation_mode boolean DEFAULT NULL::boolean,
  p_extra_discount_percent numeric DEFAULT NULL::numeric,
  p_extra_discount_amount numeric DEFAULT NULL::numeric,
  p_round_off numeric DEFAULT NULL::numeric,
  p_round_off_enabled boolean DEFAULT NULL::boolean,
  p_include_erection_charges boolean DEFAULT NULL::boolean,
  p_variant_discounts jsonb DEFAULT '{}'::jsonb,
  p_terms_conditions jsonb DEFAULT NULL::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_quote RECORD;
  v_client RECORD;
  v_item JSONB;
  v_item_idx INT := 0;
  v_line_qty NUMERIC(15,4);
  v_line_rate NUMERIC(15,2);
  v_base_rate NUMERIC(15,2);
  v_disc_pct NUMERIC(5,2);
  v_tax_pct NUMERIC(5,2);
  v_gross NUMERIC(15,2);
  v_disc_amt NUMERIC(15,2);
  v_taxable NUMERIC(15,2);
  v_tax_amt NUMERIC(15,2);
  v_line_total NUMERIC(15,2);
  v_subtotal NUMERIC(15,2) := 0;
  v_total_tax NUMERIC(15,2) := 0;
  v_grand_total NUMERIC(15,2) := 0;
  v_discount RECORD;
  v_new_item_id UUID;
  v_inserted_items JSONB := '[]'::jsonb;
  v_open JSONB;
  v_message TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.user_can_access_org(p_organisation_id) THEN RAISE EXCEPTION 'Unauthorized organization access'; END IF;

  SELECT * INTO v_quote FROM public.quotation_header
  WHERE id = p_quotation_id AND organisation_id = p_organisation_id FOR UPDATE;

  IF v_quote IS NULL THEN RAISE EXCEPTION 'Quotation not found or unauthorized'; END IF;
  IF LOWER(COALESCE(v_quote.status, '')) IN ('approved', 'converted') THEN
    RAISE EXCEPTION 'Approved or Converted quotations cannot be modified';
  END IF;

  -- F33 / G3. Read after the header lock so a decision written by an approver is always seen, and
  -- read from the request rather than from v_quote.status, which the submit flow writes from the
  -- browser and does not verify. Deliberately before every write, including the line-item DELETE.
  -- The message avoids the words the editor's error classifier keys on (session, jwt, token,
  -- refresh_token, invalid_grant, not authenticated, conflict) so it reaches the user as written.
  v_open := public.quotation_open_approval(p_quotation_id, p_organisation_id);
  IF v_open IS NOT NULL THEN
    v_message := 'QUOTATION_UNDER_APPROVAL: '
      || COALESCE(v_quote.quotation_no, p_quotation_id::text)
      || ' is locked while its approval request is pending (level '
      || COALESCE(v_open ->> 'level', '1') || ' of ' || COALESCE(v_open ->> 'max_levels', '1') || ').'
      || CASE WHEN v_open ->> 'approver_name' IS NOT NULL
              THEN ' Current approver: ' || (v_open ->> 'approver_name') || '.'
              ELSE ' An approver has it now.' END
      || ' Save again once it has been approved, rejected, returned or put on hold.';
    RAISE EXCEPTION '%', v_message
      USING ERRCODE = 'P0001',
            HINT = 'Ask the approver to return or reject the request first, then edit and resubmit.';
  END IF;

  IF p_client_id IS NOT NULL THEN
    SELECT * INTO v_client FROM public.clients WHERE id = p_client_id AND organisation_id = p_organisation_id;
    IF v_client IS NULL THEN RAISE EXCEPTION 'Client not found or does not belong to organization'; END IF;
  END IF;

  IF jsonb_array_length(p_items) > 0 THEN
    DELETE FROM public.quotation_items WHERE quotation_id = p_quotation_id;

    v_item_idx := 0;
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
      v_item_idx := v_item_idx + 1;
      v_line_qty := COALESCE((v_item->>'qty')::NUMERIC, (v_item->>'quantity')::NUMERIC, 1);
      v_line_rate := COALESCE((v_item->>'rate')::NUMERIC, 0);
      v_base_rate := COALESCE((v_item->>'base_rate_snapshot')::NUMERIC, v_line_rate);
      v_disc_pct := COALESCE((v_item->>'discount_percent')::NUMERIC, 0);
      v_tax_pct := COALESCE((v_item->>'tax_percent')::NUMERIC, 18);
      IF v_line_qty <= 0 OR v_line_rate < 0 THEN RAISE EXCEPTION 'Line item quantity and rate must be valid non-negative values'; END IF;

      v_gross := ROUND((v_line_qty * v_base_rate)::NUMERIC, 2);
      v_disc_amt := ROUND((v_gross * (v_disc_pct / 100.0))::NUMERIC, 2);
      v_taxable := v_gross - v_disc_amt;
      v_tax_amt := ROUND((v_taxable * (v_tax_pct / 100.0))::NUMERIC, 2);
      v_line_total := v_taxable + v_tax_amt;
      v_subtotal := v_subtotal + v_taxable;
      v_total_tax := v_total_tax + v_tax_amt;

      INSERT INTO public.quotation_items (
        quotation_id, organisation_id, item_id, variant_id, description, qty, uom, rate,
        discount_percent, discount_amount, tax_percent, tax_amount, line_total,
        sac_code, display_order, custom1, custom2,
        base_rate_snapshot, applied_discount_percent, is_override, final_rate_snapshot,
        is_header, is_subtotal, subtotal_label
      ) VALUES (
        p_quotation_id, p_organisation_id,
        CASE WHEN (v_item->>'item_id') IS NOT NULL AND (v_item->>'item_id') != '' THEN (v_item->>'item_id')::UUID ELSE NULL END,
        CASE WHEN (v_item->>'variant_id') IS NOT NULL AND (v_item->>'variant_id') != '' THEN (v_item->>'variant_id')::UUID ELSE NULL END,
        COALESCE(v_item->>'description', ''),
        v_line_qty,
        COALESCE(v_item->>'uom', ''),
        v_line_rate,
        v_disc_pct, v_disc_amt, v_tax_pct, v_tax_amt, v_line_total,
        CASE WHEN (v_item->>'sac_code') IS NOT NULL AND (v_item->>'sac_code') != '' THEN (v_item->>'sac_code') ELSE NULL END,
        COALESCE((v_item->>'display_order')::INT, v_item_idx),
        COALESCE(v_item->>'custom1', ''),
        COALESCE(v_item->>'custom2', ''),
        v_base_rate,
        COALESCE((v_item->>'applied_discount_percent')::NUMERIC, v_disc_pct),
        COALESCE((v_item->>'is_override')::BOOLEAN, FALSE),
        COALESCE((v_item->>'final_rate_snapshot')::NUMERIC, v_line_total),
        COALESCE((v_item->>'is_header')::BOOLEAN, FALSE),
        COALESCE((v_item->>'is_subtotal')::BOOLEAN, FALSE),
        CASE WHEN (v_item->>'subtotal_label') IS NOT NULL AND (v_item->>'subtotal_label') != '' THEN (v_item->>'subtotal_label') ELSE NULL END
      )
      RETURNING id INTO v_new_item_id;
      v_inserted_items := v_inserted_items || jsonb_build_object('id', v_new_item_id::text, 'display_order', v_item_idx);
    END LOOP;
    v_grand_total := v_subtotal + v_total_tax;
  ELSE
    v_subtotal := v_quote.subtotal;
    v_total_tax := v_quote.total_tax;
    v_grand_total := v_quote.grand_total;
  END IF;

  UPDATE public.quotation_header SET
    client_id = COALESCE(p_client_id, client_id),
    project_id = COALESCE(p_project_id, project_id),
    remarks = COALESCE(p_remarks, remarks),
    payment_terms = COALESCE(p_payment_terms, payment_terms),
    valid_till = COALESCE(p_valid_till, valid_till),
    billing_address = COALESCE(p_billing_address, billing_address),
    gstin = COALESCE(p_gstin, gstin),
    state = COALESCE(p_state, state),
    contact_no = COALESCE(p_contact_no, contact_no),
    reference = COALESCE(p_reference, reference),
    authorized_signatory_id = COALESCE(NULLIF(p_authorized_signatory_id, '')::uuid, authorized_signatory_id),
    revision_no = COALESCE(p_revision_no, revision_no),
    revision_history = COALESCE(p_revision_history, revision_history),
    status = COALESCE(p_status, status),
    negotiation_mode = COALESCE(p_negotiation_mode, negotiation_mode),
    extra_discount_percent = COALESCE(p_extra_discount_percent, extra_discount_percent),
    extra_discount_amount = COALESCE(p_extra_discount_amount, extra_discount_amount),
    round_off = COALESCE(p_round_off, round_off),
    round_off_enabled = COALESCE(p_round_off_enabled, round_off_enabled),
    include_erection_charges = COALESCE(p_include_erection_charges, include_erection_charges),
    subtotal = v_subtotal,
    total_tax = v_total_tax,
    grand_total = v_grand_total,
    updated_at = NOW()
  WHERE id = p_quotation_id;

  DELETE FROM public.quotation_variant_discounts WHERE quotation_id = p_quotation_id;
  IF jsonb_object_length(p_variant_discounts) > 0 THEN
    FOR v_discount IN SELECT * FROM jsonb_each_text(p_variant_discounts) LOOP
      INSERT INTO public.quotation_variant_discounts (quotation_id, variant_id, discount_percent, organisation_id)
      VALUES (p_quotation_id, v_discount.key::UUID, COALESCE((v_discount.value)::NUMERIC, 0), p_organisation_id);
    END LOOP;
  END IF;

  IF p_terms_conditions IS NOT NULL THEN
    INSERT INTO public.quotation_terms_conditions (quotation_id, organisation_id, custom_content, template_id, is_custom)
    VALUES (
      p_quotation_id, p_organisation_id,
      CASE
        WHEN jsonb_typeof(p_terms_conditions->'custom_content') = 'string'
          THEN to_jsonb(p_terms_conditions->>'custom_content')
        WHEN p_terms_conditions->'custom_content' IS NOT NULL
          THEN p_terms_conditions->'custom_content'
        WHEN p_terms_conditions ? 'custom_content'
          THEN to_jsonb(p_terms_conditions->>'custom_content')
        ELSE p_terms_conditions
      END,
      CASE WHEN (p_terms_conditions->>'template_id') IS NOT NULL AND (p_terms_conditions->>'template_id') != '' THEN (p_terms_conditions->>'template_id')::UUID ELSE NULL END,
      COALESCE((p_terms_conditions->>'is_custom')::BOOLEAN, FALSE)
    )
    ON CONFLICT (quotation_id) DO UPDATE SET
      custom_content = EXCLUDED.custom_content,
      template_id = EXCLUDED.template_id,
      is_custom = EXCLUDED.is_custom,
      updated_at = NOW();
  END IF;

  RETURN jsonb_build_object(
    'status', 'success',
    'quotation_id', p_quotation_id,
    'items', v_inserted_items,
    'subtotal', v_subtotal,
    'total_tax', v_total_tax,
    'grand_total', v_grand_total
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- 3. Grants, then proof that the lock is in the body that got installed
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.quotation_open_approval(uuid, uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.update_quotation(
  uuid, uuid, uuid, uuid, jsonb, text, text, date, text, text, text, text, text, text,
  integer, jsonb, text, boolean, numeric, numeric, numeric, boolean, boolean, jsonb, jsonb
) FROM anon;

GRANT EXECUTE ON FUNCTION public.quotation_open_approval(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_quotation(
  uuid, uuid, uuid, uuid, jsonb, text, text, date, text, text, text, text, text, text,
  integer, jsonb, text, boolean, numeric, numeric, numeric, boolean, boolean, jsonb, jsonb
) TO authenticated;

DO $$
DECLARE
  v_oid   oid;
  v_src   TEXT;
  v_count INT;
BEGIN
  v_oid := to_regprocedure('public.update_quotation(uuid, uuid, uuid, uuid, jsonb, text, text, date, '
    || 'text, text, text, text, text, text, integer, jsonb, text, boolean, numeric, numeric, numeric, '
    || 'boolean, boolean, jsonb, jsonb)');

  SELECT count(*) INTO v_count
    FROM pg_proc pr
    JOIN pg_namespace ns ON ns.oid = pr.pronamespace
   WHERE ns.nspname = 'public' AND pr.proname = 'update_quotation';

  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'post-check failed: public.update_quotation is not installed with the expected 25-argument signature'
      USING HINT = 'Overloads named update_quotation in schema public: ' || v_count;
  ELSIF v_count <> 1 THEN
    RAISE EXCEPTION 'post-check failed: public.update_quotation has % overloads', v_count
      USING HINT = 'PostgREST chooses between them by argument list, so a guarded overload can be skipped. Resolve before shipping.';
  END IF;

  SELECT prosrc INTO v_src FROM pg_proc WHERE oid = v_oid;
  IF v_src NOT LIKE '%quotation_open_approval%' THEN
    RAISE EXCEPTION 'post-check failed: the installed update_quotation does not call the approval lock'
      USING HINT = 'This is the G3 no-op case: the migration ran, but the save path is still unguarded.';
  END IF;
  IF v_src NOT LIKE '%FOR UPDATE%' THEN
    RAISE EXCEPTION 'post-check failed: the installed update_quotation no longer locks the header row'
      USING HINT = 'The replacement body drifted from 20261006000001; concurrent saves would overwrite each other.';
  END IF;

  RAISE NOTICE 'update_quotation reinstalled as a single overload with the approval lock in place.';
END;
$$;

COMMENT ON FUNCTION public.quotation_open_approval(uuid, uuid) IS
  'The open approval request blocking edits on a quotation, or NULL. Keys on public.approvals '
  '(status PENDING), not on quotation_header.status, because the submit flow writes that column '
  'from the browser and ignores its own write failures. Tenant-checked; SECURITY DEFINER so a '
  'policy on approvals cannot make it answer "nothing open".';

COMMENT ON FUNCTION public.update_quotation(
  uuid, uuid, uuid, uuid, jsonb, text, text, date, text, text, text, text, text, text,
  integer, jsonb, text, boolean, numeric, numeric, numeric, boolean, boolean, jsonb, jsonb
) IS
  'The quotation save path. Refuses Approved or Converted documents, and refuses any edit while an '
  'approval request for this quotation is PENDING (QUOTATION_UNDER_APPROVAL).';
