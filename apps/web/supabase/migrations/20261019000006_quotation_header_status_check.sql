-- Migration: 20261019000006_quotation_header_status_check.sql
-- Description: Adds the first CHECK constraint quotation_header.status has ever had (PRD v3.4 §4.1,
--              §11 Phase 1b). The live capture of 2026-09-16 shows zero CHECK constraints on the
--              table, so today any string at all is a valid quotation status.
--
-- It is a CONVERGING SUPERSET, not the target vocabulary, for the same reason 20261019000002
-- re-states its constraints as supersets: a CHECK narrower than the data fails the ALTER, and a
-- CHECK narrower than the code breaks a writer this PRD has not retired. Widening can never
-- invalidate an existing row. So the accepted set is
--
--     the canonical keys (read from 20261019000004, asserted below, not copied from this file)
--   + the keys that reachable application code still writes
--   + every key observed in the deployed data (reported and admitted, never rewritten)
--
-- and each later round deletes entries from the second and third groups. This migration writes no
-- rows: offenders are admitted so it cannot lose or silently reclassify a document, and the report
-- says exactly what has to be decided next.
--
-- Normalisation is delegated to public.quotation_document_status_key (20261019000004) rather than
-- re-typed as a literal list. That is what keeps the constraint and the observation trigger from
-- disagreeing - they are the same predicate - and it is why both spellings of the pending token
-- ('PENDING_APPROVAL' and 'Pending Approval') are accepted while the Q5 rename is undecided.
-- The constraint therefore DEPENDS on that function: if a later migration changes the normaliser or
-- 20261019000004's canonical set, this file must be re-run so its accepted list is recomputed. The
-- pre-flight turns that requirement into an abort instead of a silent drift.
--
-- WHY 'UNDER NEGOTIATION' IS ADMITTED ALTHOUGH §4.1 RETIRES IT (Q3 is open)
-- Three live writers still produce it: quotation_document_status_for_stage projects the
-- in_negotiation stage onto it (20261019000003:103, mirroring TRANSITION_META today), the approval
-- return path writes it (approvals/api.ts:843, pending Q3), and the quotation editor's own status
-- <select> offers it (CreateQuotation/components/QuotationActions.tsx:215). Rejecting it here would
-- make the sanctioned RPC and the editor's save path fail on the click, for a decision nobody has
-- taken yet. 20261019000004 already reports those writes as target_outside_vocabulary - that report,
-- not this constraint, is the tracker for the migration that removes it.
--
-- WHY 'PARTIALLY CONVERTED' IS ADMITTED - AND WHY IT IS A FINDING (new, Q13)
-- Invoices write it into quotation_header on every partial conversion
-- (invoices/editor/hooks/useSaveInvoice.ts:285, reachable from convert-to-invoice when not all lines
-- are billed). §4.1 never enumerates the value, so:
--   * 20261019000004's edge function has no origin and no target for it - every such write is
--     reported, and once enforcement is switched on it would be rejected;
--   * nothing can leave it: the graph's ELSE arm returns no edges for a non-canonical origin, so a
--     document that reaches 'Partially Converted' has no legal next status (the same dead-end class
--     as the Q2 reject path - prove a state is escapable before anyone can enter it);
--   * it is absent from QUOTATION_FOLLOW_UP_STATUSES, so the Follow-up Center stops showing the row
--     the moment a partial invoice is raised against it.
-- It is admitted so this migration cannot break billing. The decision is Q13: make it a real
-- document status with edges (Partially Converted -> Converted / Approved / Cancelled), or stop the
-- invoice path writing status at all and let conversion_status carry it.
--
-- WHY 'RETURNED' IS NOT ON THE EXPECTED-ACCEPT LIST
-- approvals/approvalGateEngine.ts:606 writes status 'Returned' into quotation_header, but the only
-- route to that function is executeApprovalGateDecision (:415), which has no call site in the
-- application. Dead code does not get to shape the vocabulary, so §3 expects the constraint to
-- reject it. If the gate engine is ever wired up, its Return action fails at the database and that
-- test is the proof of why - retire the writer or decide it alongside Q13. Note the asymmetry: if
-- 'Returned' is already in the deployed data, §1 admits it like any other offender and §3 reports
-- rather than aborts, because keeping existing rows valid outranks the vocabulary being tidy.
--
-- 'SUPERSEDED' is canonical in §4.1 but nothing writes it yet - versioning is Q4. It is admitted
-- ahead of that decision so taking Q4 does not need a schema change.
--
-- Locking: ADD CONSTRAINT takes ACCESS EXCLUSIVE and validates the table in one pass. Apply from
-- the SQL editor as the table owner, in order, after 20261019000002 -> 003 -> 004 -> 005 (this file
-- asserts 004's helpers, so 004 is a hard prerequisite). Re-runnable: it drops and rebuilds only
-- its own constraint, and leaves any other CHECK it finds on the column alone but visible.
--
-- One consequence of naming a function inside a CHECK, so it is not a surprise later: the table now
-- depends on public.quotation_document_status_key. Migrations replay in order, so this project does
-- not feel it, but a pg_dump restore does - pg_dump writes tables before functions, and restoring a
-- dump this way fails on the constraint until the helper functions are created first. The alternative
-- was to re-type the normalisation into the constraint, which would let the CHECK and the trigger in
-- 20261019000004 drift apart while both still looked authoritative. The drift is the worse failure.

-- ---------------------------------------------------------------------------
-- 0. Pre-flight: the table, the helpers, and agreement with 20261019000004
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_missing TEXT[] := ARRAY[]::TEXT[];
  v_bad     TEXT[] := ARRAY[]::TEXT[];
  v_vol     "char";
  v_key     text;
  v_core    text[] := ARRAY['DRAFT', 'SENT', 'PENDING APPROVAL', 'APPROVED', 'CONVERTED',
                             'REJECTED', 'CANCELLED', 'EXPIRED', 'SUPERSEDED'];
  v_live    text[] := ARRAY['UNDER NEGOTIATION', 'PARTIALLY CONVERTED', 'RETURNED'];
BEGIN
  IF to_regclass('public.quotation_header') IS NULL THEN
    v_missing := array_append(v_missing, 'table public.quotation_header');
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quotation_header' AND column_name = 'status'
  ) THEN
    v_missing := array_append(v_missing, 'column quotation_header.status');
  END IF;

  -- Both helpers must exist, and the normaliser must be IMMUTABLE: Postgres only allows an
  -- immutable expression in a CHECK, and the constraint embeds whatever that function does today.
  IF to_regprocedure('public.quotation_document_status_key(text)') IS NULL THEN
    v_missing := array_append(v_missing, 'function public.quotation_document_status_key (run 20261019000004 first)');
  ELSE
    SELECT provolatile INTO v_vol
    FROM pg_proc WHERE oid = to_regprocedure('public.quotation_document_status_key(text)');
    IF v_vol IS DISTINCT FROM 'i' THEN
      v_bad := array_append(v_bad, format('quotation_document_status_key has volatility %s; a CHECK requires immutable', v_vol));
    END IF;
  END IF;

  IF to_regprocedure('public.quotation_document_status_is_canonical(text)') IS NULL THEN
    v_missing := array_append(v_missing, 'function public.quotation_document_status_is_canonical (run 20261019000004 first)');
  END IF;

  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'pre-flight failed, missing: %', array_to_string(v_missing, ', ')
      USING HINT = 'The deployed schema differs from the 2026-09-16 remediation capture or from the migration set in supabase/migrations; verify before applying.';
  END IF;

  -- Agreement, asserted rather than assumed. If 20261019000004's canonical set has moved, the list
  -- computed below is stale, so abort instead of shipping a constraint the trigger disagrees with.
  FOREACH v_key IN ARRAY v_core LOOP
    IF NOT public.quotation_document_status_is_canonical(v_key) THEN
      v_bad := array_append(v_bad, format('% is not canonical in 20261019000004', quote_literal(v_key)));
    END IF;
  END LOOP;
  FOREACH v_key IN ARRAY v_live LOOP
    IF public.quotation_document_status_is_canonical(v_key) THEN
      v_bad := array_append(v_bad, format('% has become canonical in 20261019000004 - re-read this migration before applying', quote_literal(v_key)));
    END IF;
  END LOOP;
  -- The normaliser must fold both live spellings of the pending token onto one key, or admitting
  -- 'PENDING APPROVAL' here silently rejects the underscore form the integration actually writes.
  IF public.quotation_document_status_key('PENDING_APPROVAL')
     IS DISTINCT FROM public.quotation_document_status_key('Pending Approval') THEN
    v_bad := array_append(v_bad, 'quotation_document_status_key does not normalise PENDING_APPROVAL and Pending Approval onto one key');
  END IF;

  IF array_length(v_bad, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'pre-flight failed, vocabulary drift: %', array_to_string(v_bad, '; ')
      USING HINT = 'Update this migration so the CHECK and the document graph in 20261019000004 accept the same set, then apply it again.';
  END IF;

  -- Not fatal, but the owner has to know: an older, narrower CHECK on the same column would keep
  -- rejecting writes after this one is added, and deleting a constraint this file did not author is
  -- not this migration's call.
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.quotation_header'::regclass
      AND contype = 'c'
      AND conname <> 'quotation_header_status_vocabulary_check'
      AND pg_get_constraintdef(oid) ~* 'status'
  ) THEN
    RAISE NOTICE 'WARNING: another CHECK on quotation_header references status. A narrower one will still reject writes this superset admits, so list them all and retire the stale one before relying on this constraint.';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 1. Observe the data, admit what is found, report it, apply the constraint
-- ---------------------------------------------------------------------------
-- Scan and ALTER in one block so both see the same snapshot. Values taken from the table are
-- interpolated with %L, so a stored status containing a quote cannot break out of the statement.
DO $$
DECLARE
  v_allowed text[] := ARRAY['DRAFT', 'SENT', 'PENDING APPROVAL', 'APPROVED', 'CONVERTED',
                             'REJECTED', 'CANCELLED', 'EXPIRED', 'SUPERSEDED',  -- canonical (§4.1)
                             'UNDER NEGOTIATION', 'PARTIALLY CONVERTED'];       -- written by live code
  v_offend  text;
  v_offends text[] := ARRAY[]::text[];
  v_blank   bigint := 0;
  v_nulls   bigint := 0;
  v_rows    bigint;
  v_pred    text;
  v_list    text;
BEGIN
  SELECT count(*) INTO v_rows FROM public.quotation_header;
  SELECT count(*) INTO v_nulls FROM public.quotation_header WHERE status IS NULL;
  SELECT count(*) INTO v_blank FROM public.quotation_header
  WHERE status IS NOT NULL AND btrim(status) = '';

  RAISE NOTICE 'quotation_header: % rows (NULL status: %, blank status: %)', v_rows, v_nulls, v_blank;

  -- Only real values are scanned for offenders. A NULL or blank status normalises to no key at all,
  -- so it would otherwise enter the list as a sentinel string and be admitted as if it were a status.
  FOR v_offend IN
    SELECT DISTINCT public.quotation_document_status_key(status) AS k
    FROM public.quotation_header
    WHERE status IS NOT NULL AND btrim(status) <> ''
      AND public.quotation_document_status_key(status) <> ALL (v_allowed)
    ORDER BY 1
  LOOP
    v_offends := array_append(v_offends, v_offend);
  END LOOP;

  IF v_offends <> '{}'::text[] THEN
    RAISE NOTICE 'OFFENDERS admitted so existing rows stay valid: %', array_to_string(v_offends, ', ');
    RAISE NOTICE 'each one is a decision (Q13) or a writer to retire before the next round can delete it';
    v_allowed := v_allowed || v_offends;
  ELSE
    RAISE NOTICE 'no offenders: every stored status is already expected by this migration';
  END IF;

  -- Blank strings are admitted, never rewritten: this migration changes no rows. A follow-up should
  -- backfill them to NULL and re-run this file, which then drops the empty entry for good.
  IF v_blank > 0 THEN
    v_allowed := array_append(v_allowed, '');
    RAISE NOTICE 'blank statuses admitted as empty string: backfill them to NULL and re-run this migration to close that gap';
  END IF;

  SELECT string_agg(format('%L', k), ', ' ORDER BY k) INTO v_list FROM unnest(v_allowed) k;

  -- The NULL arm is explicit even though a CHECK treats a NULL result as satisfied, so the intent
  -- survives a future reader who does not know that rule (and §3 tests for its presence).
  v_pred := 'status IS NULL OR coalesce(public.quotation_document_status_key(status), ''''::text) '
         || '= ANY (ARRAY[' || v_list || ']::text[])';

  EXECUTE format('ALTER TABLE public.quotation_header DROP CONSTRAINT IF EXISTS %I',
                 'quotation_header_status_vocabulary_check');
  EXECUTE format('ALTER TABLE public.quotation_header ADD CONSTRAINT %I CHECK (%s)',
                 'quotation_header_status_vocabulary_check', v_pred);

  RAISE NOTICE 'quotation_header_status_vocabulary_check now accepts % distinct normalised values',
    array_length(v_allowed, 1);
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Verify the stored constraint is the one intended
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_def text;
  v_bad text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO v_def
  FROM pg_constraint
  WHERE conrelid = 'public.quotation_header'::regclass
    AND conname  = 'quotation_header_status_vocabulary_check';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'post-check failed: quotation_header_status_vocabulary_check does not exist';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.quotation_header'::regclass
      AND conname = 'quotation_header_status_vocabulary_check'
      AND contype = 'c' AND convalidated
  ) THEN
    RAISE EXCEPTION 'post-check failed: the constraint exists but is not a validated CHECK, so existing rows were never verified';
  END IF;

  IF v_def NOT LIKE '%quotation_document_status_key%' THEN
    RAISE EXCEPTION 'post-check failed: the constraint does not use the shared normaliser, so it will drift from 20261019000004: %', v_def;
  END IF;

  IF v_def NOT LIKE '%status IS NULL%' THEN
    RAISE EXCEPTION 'post-check failed: the constraint lost its NULL arm, so a status-less quotation could not be saved: %', v_def;
  END IF;

  FOREACH v_bad IN ARRAY ARRAY['DRAFT', 'SENT', 'PENDING APPROVAL', 'APPROVED', 'CONVERTED',
                               'REJECTED', 'CANCELLED', 'EXPIRED', 'SUPERSEDED',
                               'UNDER NEGOTIATION', 'PARTIALLY CONVERTED'] LOOP
    IF v_def NOT LIKE '%' || v_bad || '%' THEN
      RAISE EXCEPTION 'post-check failed: % is missing from the constraint definition', quote_literal(v_bad);
    END IF;
  END LOOP;

  -- Deliberately NOT re-testing the rows here: the predicate is rebuilt from the data it scanned, so
  -- any such query is a tautology that passes by construction and would manufacture confidence.
  -- ALTER TABLE ... ADD CONSTRAINT has already validated every row or failed, and convalidated above
  -- is what proves it.
  RAISE NOTICE 'verified: validated CHECK, shared normaliser, NULL arm, 11 expected keys present';
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Test the constraint itself, not a copy of its logic
-- ---------------------------------------------------------------------------
-- The stored definition is lifted into a throwaway table and the samples are actually inserted, so
-- what is tested is the predicate Postgres will apply to quotation_header - including any offender
-- §1 admitted - rather than this file's opinion about it. Nothing touches the real table.
DO $$
DECLARE
  v_def     text;
  v_accepted boolean;
  v_stored   boolean;
  r          record;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO v_def
  FROM pg_constraint
  WHERE conrelid = 'public.quotation_header'::regclass
    AND conname  = 'quotation_header_status_vocabulary_check';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'test aborted: the constraint is not there to test';
  END IF;

  EXECUTE 'DROP TABLE IF EXISTS pg_temp.qh_status_probe';
  EXECUTE format('CREATE TABLE pg_temp.qh_status_probe (status text, CONSTRAINT %I %s)',
                 'qh_status_probe_check', v_def);

  FOR r IN
    SELECT * FROM (VALUES
      ('Draft',               true),  ('Sent',              true),
      ('PENDING_APPROVAL',    true),  ('Pending Approval',  true),
      (' approved ',          true),  ('Superseded',        true),
      ('Under Negotiation',   true),  ('Partially Converted', true),
      ('Returned',            false), ('pending',           false),
      ('In Negotiation',      false), ('Sent to Client',    false),
      ('ARCHIVED',            false)
    ) AS t(sample, expected)
  LOOP
    DELETE FROM pg_temp.qh_status_probe;
    BEGIN
      INSERT INTO pg_temp.qh_status_probe (status) VALUES (r.sample);
      v_accepted := true;
    EXCEPTION WHEN CHECK_VIOLATION THEN
      v_accepted := false;
    END;

    IF v_accepted IS DISTINCT FROM r.expected THEN
      -- A reject case that the constraint accepts is only legitimate if the value is already stored:
      -- §1 had to admit it to keep that row valid. Say so instead of aborting the apply.
      SELECT EXISTS (
        SELECT 1 FROM public.quotation_header
        WHERE status IS NOT NULL
          AND public.quotation_document_status_key(status)
              = public.quotation_document_status_key(r.sample)
      ) INTO v_stored;

      IF r.expected OR NOT v_stored THEN
        RAISE EXCEPTION 'test failed: % was % by the constraint, expected %',
          quote_literal(r.sample),
          CASE WHEN v_accepted THEN 'accepted' ELSE 'rejected' END,
          CASE WHEN r.expected THEN 'accepted' ELSE 'rejected' END;
      END IF;

      RAISE NOTICE 'note: % is stored in quotation_header, so the constraint admitted it (offender, not a bug)',
        quote_literal(r.sample);
    END IF;
  END LOOP;

  -- The NULL arm has to work on a real insert, not just appear in the definition text.
  DELETE FROM pg_temp.qh_status_probe;
  BEGIN
    INSERT INTO pg_temp.qh_status_probe (status) VALUES (NULL);
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'test failed: a NULL status was rejected, but the column is nullable: %', SQLERRM;
  END;

  EXECUTE 'DROP TABLE IF EXISTS pg_temp.qh_status_probe';
  RAISE NOTICE 'constraint tests passed: 8 accepted, 5 rejected (or explained), NULL inserted';
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. The inventory the tightening round is read from
-- ---------------------------------------------------------------------------
-- Rows, not distinct values, decide what is safe to remove from the CHECK, so last_written matters:
-- an offender with rows only from 2024 is a backfill, one written this week is a live writer.
CREATE OR REPLACE VIEW public.quotation_header_status_inventory
WITH (security_invoker = on)
AS
SELECT
  h.status,
  public.quotation_document_status_key(h.status)      AS status_key,
  public.quotation_document_status_is_canonical(public.quotation_document_status_key(h.status)) AS is_canonical,
  count(*)                                            AS row_count,
  min(h.created_at)                                   AS first_created,
  max(h.updated_at)                                   AS last_written
FROM public.quotation_header h
GROUP BY 1, 2, 3
ORDER BY count(*) DESC;

-- ---------------------------------------------------------------------------
-- 5. Grants
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.quotation_header_status_inventory FROM anon;
GRANT SELECT ON public.quotation_header_status_inventory TO authenticated, service_role;

COMMENT ON CONSTRAINT quotation_header_status_vocabulary_check ON public.quotation_header IS
  'Phase 1b converging superset for quotation_header.status: 20261019000004''s canonical keys, plus the keys live code still writes (Under Negotiation pending Q3, Partially Converted pending Q13), plus every key observed in the data. Normalised through quotation_document_status_key, so both spellings of the pending token pass. Re-run this migration if that function or the canonical set changes. Tightening means deleting entries once the writers stop using them.';
COMMENT ON VIEW public.quotation_header_status_inventory IS
  'Distinct quotation_header.status values with their normalised key, whether §4.1 considers them canonical, row counts and last write. Read it to decide Q13 and to plan the next narrowing of quotation_header_status_vocabulary_check.';
