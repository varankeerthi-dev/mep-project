-- ============================================================================
-- PHASE 1.4 runtime tests — every mutation rolls back; results accumulate
-- in a temp table via a SECURITY DEFINER logger (so authenticated context
-- can record outcomes), printed by the final SELECT.
-- Session user: 7e82c53b-b060-4c14-9f46-cdfc08e43155 (member of org A only)
--   org A = 77c7f8a6-938e-42da-bdf4-cef9c35838c1
--   org B = 39875ba3-4c9a-465b-863f-31a7da7f38cc (foreign to the test user)
-- ============================================================================
CREATE TEMP TABLE test_results(line text);
CREATE FUNCTION pg_temp._tlog(p_line text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_temp, public
AS $fn$ BEGIN INSERT INTO test_results VALUES (p_line); END $fn$;

-- T1: unauthenticated call must be rejected by the org guard ---------------
DO $$
BEGIN
  PERFORM public.approval_transition(jsonb_build_object(
    'organisationId','77c7f8a6-938e-42da-bdf4-cef9c35838c1',
    'referenceType','payment_requests',
    'referenceId','6e5a28d9-68f4-4e23-b64e-534ef5f30d54',
    'action','approve'));
  PERFORM pg_temp._tlog('T1 FAIL: unauthenticated approval_transition succeeded');
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp._tlog('T1 PASS (guard rejected unauthenticated): ' || SQLERRM);
END $$;

-- T2: list returns rows for own org -----------------------------------------
BEGIN;
SELECT set_config('role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '7e82c53b-b060-4c14-9f46-cdfc08e43155', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT pg_temp._tlog('T2 ' || CASE WHEN n > 0 THEN 'PASS' ELSE 'FAIL' END
       || ' (own-org list rows=' || n || ', total=' || t || ')')
FROM (
  SELECT jsonb_array_length(r->'data'->'rows') AS n, (r->'data'->>'totalCount') AS t
  FROM (SELECT public.payment_requests_list(jsonb_build_object(
    'organisationId','77c7f8a6-938e-42da-bdf4-cef9c35838c1','page',0,'pageSize',2)) AS r) s
) x;
ROLLBACK;

-- T3: list against a foreign org must fail ----------------------------------
BEGIN;
SELECT set_config('role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '7e82c53b-b060-4c14-9f46-cdfc08e43155', true);
DO $$
BEGIN
  PERFORM public.payment_requests_list(jsonb_build_object(
    'organisationId','39875ba3-4c9a-465b-863f-31a7da7f38cc','page',0,'pageSize',2));
  PERFORM pg_temp._tlog('T3 FAIL: foreign-org list succeeded');
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp._tlog('T3 PASS (foreign org denied): ' || SQLERRM);
END $$;
ROLLBACK;

-- T4: approve a Pending payment request; verify persisted columns -----------
BEGIN;
SELECT set_config('role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '7e82c53b-b060-4c14-9f46-cdfc08e43155', true);
SELECT pg_temp._tlog('T4 ' || CASE WHEN st='Approved' AND ap='Approved' AND ab IS NOT NULL THEN 'PASS'
                     ELSE 'FAIL' END
       || ' (status=' || st || ', approval_status=' || ap || ', approved_by=' || COALESCE(ab::text,'NULL')
       || ', approved_amount=' || COALESCE(aa::text,'NULL') || ')')
FROM (
  SELECT (public.approval_transition(jsonb_build_object(
    'organisationId','77c7f8a6-938e-42da-bdf4-cef9c35838c1',
    'referenceType','payment_requests',
    'referenceId','6e5a28d9-68f4-4e23-b64e-534ef5f30d54',
    'action','approve','clientRequestId','phase14-t4'))->>'error') IS NULL AS ok
) q
CROSS JOIN LATERAL (
  SELECT pr.status AS st, pr.approval_status AS ap, pr.approved_by AS ab, pr.approved_amount AS aa
  FROM public.payment_requests pr WHERE pr.id='6e5a28d9-68f4-4e23-b64e-534ef5f30d54'
) v;
ROLLBACK;

-- T5: approve twice with SAME clientRequestId => idempotent no-op -----------
BEGIN;
SELECT set_config('role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '7e82c53b-b060-4c14-9f46-cdfc08e43155', true);
SELECT pg_temp._tlog('T5 ' || CASE WHEN e1 IS NULL AND e2 IS NULL AND s2 = 'noop' THEN 'PASS' ELSE 'FAIL' END
       || ' (first_status=' || COALESCE(s1,'NULL') || ', replay_status=' || COALESCE(s2,'NULL') || ')')
FROM (
  SELECT (r1->>'error') AS e1, (r1->'data'->>'status') AS s1,
         (r2->>'error') AS e2, (r2->'data'->>'status') AS s2
  FROM (
    SELECT public.approval_transition(jsonb_build_object(
      'organisationId','77c7f8a6-938e-42da-bdf4-cef9c35838c1',
      'referenceType','payment_requests',
      'referenceId','6e5a28d9-68f4-4e23-b64e-534ef5f30d54',
      'action','approve','clientRequestId','phase14-t5')) AS r1
  ) a
  CROSS JOIN LATERAL (
    SELECT public.approval_transition(jsonb_build_object(
      'organisationId','77c7f8a6-938e-42da-bdf4-cef9c35838c1',
      'referenceType','payment_requests',
      'referenceId','6e5a28d9-68f4-4e23-b64e-534ef5f30d54',
      'action','approve','clientRequestId','phase14-t5')) AS r2
  ) b
) x;
ROLLBACK;

-- T6: approve an already-Approved request => INVALID_STATE ------------------
BEGIN;
SELECT set_config('role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '7e82c53b-b060-4c14-9f46-cdfc08e43155', true);
UPDATE public.payment_requests SET status='Approved' WHERE id='6e5a28d9-68f4-4e23-b64e-534ef5f30d54';
DO $$
BEGIN
  PERFORM public.payment_request_approve(jsonb_build_object(
    'organisationId','77c7f8a6-938e-42da-bdf4-cef9c35838c1',
    'paymentRequestId','6e5a28d9-68f4-4e23-b64e-534ef5f30d54',
    'clientRequestId','phase14-t6'));
  PERFORM pg_temp._tlog('T6 FAIL: approving an Approved request succeeded');
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp._tlog('T6 PASS (state guard): ' || SQLERRM);
END $$;
ROLLBACK;

-- T7: release a Pending request => INVALID_STATE ----------------------------
BEGIN;
SELECT set_config('role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '7e82c53b-b060-4c14-9f46-cdfc08e43155', true);
DO $$
BEGIN
  PERFORM public.payment_request_release(jsonb_build_object(
    'organisationId','77c7f8a6-938e-42da-bdf4-cef9c35838c1',
    'paymentRequestId','6e5a28d9-68f4-4e23-b64e-534ef5f30d54',
    'clientRequestId','phase14-t7'));
  PERFORM pg_temp._tlog('T7 FAIL: releasing a Pending request succeeded');
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp._tlog('T7 PASS (release guard): ' || SQLERRM);
END $$;
ROLLBACK;

-- T8: create is idempotent on clientRequestId -------------------------------
BEGIN;
SELECT set_config('role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '7e82c53b-b060-4c14-9f46-cdfc08e43155', true);
SELECT pg_temp._tlog('T8 ' || CASE WHEN e1 IS NULL AND e2 IS NULL AND d2 THEN 'PASS' ELSE 'FAIL' END
       || ' (first=' || COALESCE(i1,'ERR') || ', replay=' || COALESCE(i2,'ERR') || ', duplicate=' || d2 || ')')
FROM (
  SELECT (r1->>'error') AS e1, (r1->'data'->>'id') AS i1,
         (r2->>'error') AS e2, (r2->'data'->>'id') AS i2,
         COALESCE((r2->'data'->>'duplicate')::boolean, false) AS d2
  FROM (
    SELECT public.payment_request_create(jsonb_build_object(
      'organisationId','77c7f8a6-938e-42da-bdf4-cef9c35838c1',
      'clientRequestId','phase14-t8','sourceType','purchase_bill',
      'sourceBillId','5e36b187-44ad-4283-962b-4062626387ea',
      'amountRequested',1000,'priority','Normal','reason','phase 1.4 test')) AS r1
  ) a
  CROSS JOIN LATERAL (
    SELECT public.payment_request_create(jsonb_build_object(
      'organisationId','77c7f8a6-938e-42da-bdf4-cef9c35838c1',
      'clientRequestId','phase14-t8','sourceType','purchase_bill',
      'sourceBillId','5e36b187-44ad-4283-962b-4062626387ea',
      'amountRequested',1000,'priority','Normal','reason','phase 1.4 test')) AS r2
  ) b
) x;
ROLLBACK;

-- T9: create with a nonexistent/foreign source bill => RECORD_NOT_FOUND -----
BEGIN;
SELECT set_config('role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '7e82c53b-b060-4c14-9f46-cdfc08e43155', true);
DO $$
BEGIN
  PERFORM public.payment_request_create(jsonb_build_object(
    'organisationId','77c7f8a6-938e-42da-bdf4-cef9c35838c1',
    'clientRequestId','phase14-t9','sourceType','purchase_bill',
    'sourceBillId','00000000-0000-0000-0000-000000000000',
    'amountRequested',1000));
  PERFORM pg_temp._tlog('T9 FAIL: create with missing/foreign bill succeeded');
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp._tlog('T9 PASS (source-bill tenant check): ' || SQLERRM);
END $$;
ROLLBACK;

-- T10: transition of a foreign-org record -----------------------------------
BEGIN;
SELECT set_config('role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '7e82c53b-b060-4c14-9f46-cdfc08e43155', true);
DO $$
BEGIN
  PERFORM public.approval_transition(jsonb_build_object(
    'organisationId','77c7f8a6-938e-42da-bdf4-cef9c35838c1',
    'referenceType','payment_requests',
    'referenceId','2bbd4365-d4fd-45d4-b502-a21fd34e0c45',
    'action','approve'));
  PERFORM pg_temp._tlog('T10 FAIL: foreign-org record transitioned');
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp._tlog('T10 PASS (cross-tenant row denied): ' || SQLERRM);
END $$;
ROLLBACK;

-- T11: subcontractor_work_orders transition path ----------------------------
BEGIN;
SELECT set_config('role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '7e82c53b-b060-4c14-9f46-cdfc08e43155', true);
DO $$
DECLARE v_id uuid; v_res jsonb;
BEGIN
  SELECT id INTO v_id FROM public.subcontractor_work_orders
  WHERE organisation_id='77c7f8a6-938e-42da-bdf4-cef9c35838c1' LIMIT 1;
  IF v_id IS NULL THEN
    PERFORM pg_temp._tlog('T11 SKIP: no subcontractor_work_orders in org A');
  ELSE
    v_res := public.approval_transition(jsonb_build_object(
      'organisationId','77c7f8a6-938e-42da-bdf4-cef9c35838c1',
      'referenceType','work_orders','referenceId',v_id::text,
      'action','approve','clientRequestId','phase14-t11'));
    PERFORM pg_temp._tlog(
      CASE WHEN v_res->>'error' IS NULL
        THEN 'T11 PASS (work_orders transition ok for ' || v_id || ')'
        ELSE 'T11 FAIL: ' || (v_res->'error'->>'message') END);
  END IF;
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp._tlog('T11 FAIL: ' || SQLERRM);
END $$;
ROLLBACK;

-- T12: backfill_approval_denorm with p_org_id -------------------------------
BEGIN;
SELECT set_config('role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '7e82c53b-b060-4c14-9f46-cdfc08e43155', true);
SELECT pg_temp._tlog('T12 ' || CASE WHEN r->>'error' IS NULL THEN 'PASS' ELSE 'FAIL' END
       || ' (names=' || (r->'data'->>'requesterNamesBackfilled')
       || ', projects=' || (r->'data'->>'projectNamesBackfilled') || ')')
FROM (SELECT public.backfill_approval_denorm('77c7f8a6-938e-42da-bdf4-cef9c35838c1'::uuid) AS r) s;
ROLLBACK;

SELECT line FROM test_results ORDER BY line;
