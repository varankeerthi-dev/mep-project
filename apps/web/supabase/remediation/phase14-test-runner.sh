#!/usr/bin/env bash
# PHASE 1.4 runtime tests — SAFE harness for `supabase db query --linked`.
# The Management API executes batches statement-by-statement, so BEGIN/ROLLBACK
# spanning statements DOES NOT roll back. The only atomic unit is a single DO
# block. Therefore every test is ONE DO block that ALWAYS raises, with the
# outcome (PASS/FAIL + evidence) in the error message, captured by the runner.
# Nothing persists, ever.
set -u
cd "$(dirname "$0")/../.." || exit 1   # apps/web

ORG_A=77c7f8a6-938e-42da-bdf4-cef9c35838c1
ORG_B=39875ba3-4c9a-465b-863f-31a7da7f38cc
USR=7e82c53b-b060-4c14-9f46-cdfc08e43155
PR=6e5a28d9-68f4-4e23-b64e-534ef5f30d54
BILL=5e36b187-44ad-4283-962b-4062626387ea
FOREIGN_PR=2bbd4365-d4fd-45d4-b502-a21fd34e0c45

EX() { timeout 120 supabase db query --linked "$1" 2>&1 | tr -d ' ' | grep -oE "(PASS|FAIL)[^\\\"]*" | head -1; }

echo "T1 unauthenticated approval_transition rejected"; \
EX "DO \$\$ BEGIN PERFORM public.approval_transition(jsonb_build_object('organisationId','$ORG_A','referenceType','payment_requests','referenceId','$PR','action','approve')); RAISE EXCEPTION 'T1 FAIL: unauthenticated call succeeded'; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'T1 FAIL%' THEN RAISE; ELSE RAISE EXCEPTION 'T1 PASS guard=%', SQLERRM; END IF; END \$\$;"

echo "T2 own-org list returns rows"; \
EX "DO \$\$ DECLARE r jsonb; BEGIN PERFORM set_config('role','authenticated',true); PERFORM set_config('request.jwt.claim.sub','$USR',true); PERFORM set_config('request.jwt.claim.role','authenticated',true); r := public.payment_requests_list(jsonb_build_object('organisationId','$ORG_A','page',0,'pageSize',2)); IF r->>'error' IS NOT NULL THEN RAISE EXCEPTION 'T2 FAIL envelope=%', r->'error'->>'code'; END IF; IF jsonb_array_length(r->'data'->'rows') > 0 THEN RAISE EXCEPTION 'T2 PASS rows=% total=%', jsonb_array_length(r->'data'->'rows'), r->'data'->>'totalCount'; ELSE RAISE EXCEPTION 'T2 FAIL rows=0'; END IF; END \$\$;"

echo "T3 foreign-org list rejected"; \
EX "DO \$\$ BEGIN PERFORM set_config('role','authenticated',true); PERFORM set_config('request.jwt.claim.sub','$USR',true); PERFORM public.payment_requests_list(jsonb_build_object('organisationId','$ORG_B','page',0,'pageSize',2)); RAISE EXCEPTION 'T3 FAIL foreign-org list succeeded'; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'T3 FAIL%' THEN RAISE; ELSE RAISE EXCEPTION 'T3 PASS guard=%', SQLERRM; END IF; END \$\$;"

echo "T4 approve Pending PR persists Approved columns"; \
EX "DO \$\$ DECLARE r jsonb; v record; BEGIN PERFORM set_config('role','authenticated',true); PERFORM set_config('request.jwt.claim.sub','$USR',true); r := public.approval_transition(jsonb_build_object('organisationId','$ORG_A','referenceType','payment_requests','referenceId','$PR','action','approve','clientRequestId','phase14-t4')); IF r->>'error' IS NOT NULL THEN RAISE EXCEPTION 'T4 FAIL envelope=%', r->'error'->>'message'; END IF; SELECT status, approval_status, approved_by, approved_amount INTO v FROM public.payment_requests WHERE id='$PR'; IF v.status='Approved' AND v.approval_status='Approved' AND v.approved_by IS NOT NULL AND v.approved_amount > 0 THEN RAISE EXCEPTION 'T4 PASS status=% approved_amount=%', v.status, v.approved_amount; ELSE RAISE EXCEPTION 'T4 FAIL status=% approval=%', v.status, v.approval_status; END IF; END \$\$;"

echo "T5 replay same clientRequestId => noop"; \
EX "DO \$\$ DECLARE r1 jsonb; r2 jsonb; BEGIN PERFORM set_config('role','authenticated',true); PERFORM set_config('request.jwt.claim.sub','$USR',true); r1 := public.approval_transition(jsonb_build_object('organisationId','$ORG_A','referenceType','payment_requests','referenceId','$PR','action','approve','clientRequestId','phase14-t5')); r2 := public.approval_transition(jsonb_build_object('organisationId','$ORG_A','referenceType','payment_requests','referenceId','$PR','action','approve','clientRequestId','phase14-t5')); IF r1->>'error' IS NULL AND r2->>'error' IS NULL AND r2->'data'->>'status'='noop' THEN RAISE EXCEPTION 'T5 PASS first=% replay=%', r1->'data'->>'status', r2->'data'->>'status'; ELSE RAISE EXCEPTION 'T5 FAIL first_err=% replay_status=%', COALESCE(r1->'error'->>'code','none'), COALESCE(r2->'data'->>'status','ERR'); END IF; END \$\$;"

echo "T6 approve a Cancelled request => INVALID_STATE (Approved now idempotent-noop)"; \
EX "DO \$\$ DECLARE r jsonb; r2 jsonb; BEGIN PERFORM set_config('role','authenticated',true); PERFORM set_config('request.jwt.claim.sub','$USR',true); UPDATE public.payment_requests SET status='Cancelled' WHERE id='$PR'; r := public.payment_request_approve(jsonb_build_object('organisationId','$ORG_A','paymentRequestId','$PR','clientRequestId','phase14-t6')); IF r->'error'->>'code'='INVALID_STATE' THEN UPDATE public.payment_requests SET status='Approved' WHERE id='$PR'; r2 := public.payment_request_approve(jsonb_build_object('organisationId','$ORG_A','paymentRequestId','$PR','clientRequestId','phase14-t6b')); IF r2->'data'->>'status'='noop' THEN RAISE EXCEPTION 'T6 PASS INVALID_STATE+idempotent-noop'; ELSE RAISE EXCEPTION 'T6 FAIL noop-status=%', COALESCE(r2->'data'->>'status','ERR'); END IF; ELSE RAISE EXCEPTION 'T6 FAIL code=%', COALESCE(r->'error'->>'code','none'); END IF; END \$\$;"

echo "T7 release a Pending request => INVALID_STATE"; \
EX "DO \$\$ DECLARE r jsonb; BEGIN PERFORM set_config('role','authenticated',true); PERFORM set_config('request.jwt.claim.sub','$USR',true); r := public.payment_request_release(jsonb_build_object('organisationId','$ORG_A','paymentRequestId','$PR','clientRequestId','phase14-t7')); IF r->'error'->>'code'='INVALID_STATE' THEN RAISE EXCEPTION 'T7 PASS INVALID_STATE'; ELSE RAISE EXCEPTION 'T7 FAIL code=%', COALESCE(r->'error'->>'code','none'); END IF; END \$\$;"

echo "T8 create idempotent on clientRequestId"; \
EX "DO \$\$ DECLARE r1 jsonb; r2 jsonb; n1 int; n2 int; BEGIN PERFORM set_config('role','authenticated',true); PERFORM set_config('request.jwt.claim.sub','$USR',true); r1 := public.payment_request_create(jsonb_build_object('organisationId','$ORG_A','clientRequestId','phase14-t8','sourceType','purchase_bill','sourceBillId','$BILL','amountRequested',1000,'priority','Normal','reason','phase14')); IF r1->>'error' IS NOT NULL THEN RAISE EXCEPTION 'T8 FAIL create=%', r1->'error'->>'code'; END IF; SELECT count(*) INTO n1 FROM public.payment_requests WHERE client_request_id='phase14-t8'; r2 := public.payment_request_create(jsonb_build_object('organisationId','$ORG_A','clientRequestId','phase14-t8','sourceType','purchase_bill','sourceBillId','$BILL','amountRequested',1000,'priority','Normal','reason','phase14')); SELECT count(*) INTO n2 FROM public.payment_requests WHERE client_request_id='phase14-t8'; IF n1=1 AND n2=1 AND COALESCE((r2->'data'->>'duplicate')::boolean,false) THEN RAISE EXCEPTION 'T8 PASS request_no=% duplicate=true', r1->'data'->>'requestNo'; ELSE RAISE EXCEPTION 'T8 FAIL counts=%/% duplicate=%', n1, n2, COALESCE((r2->'data'->>'duplicate')::text,'ERR'); END IF; END \$\$;"

echo "T9 create with foreign/missing bill => RECORD_NOT_FOUND"; \
EX "DO \$\$ DECLARE r jsonb; BEGIN PERFORM set_config('role','authenticated',true); PERFORM set_config('request.jwt.claim.sub','$USR',true); r := public.payment_request_create(jsonb_build_object('organisationId','$ORG_A','clientRequestId','phase14-t9','sourceType','purchase_bill','sourceBillId','00000000-0000-0000-0000-000000000000','amountRequested',1000)); IF r->'error'->>'code'='RECORD_NOT_FOUND' THEN RAISE EXCEPTION 'T9 PASS RECORD_NOT_FOUND'; ELSE RAISE EXCEPTION 'T9 FAIL code=%', COALESCE(r->'error'->>'code','none'); END IF; END \$\$;"

echo "T10 transition foreign-org record => RECORD_NOT_FOUND"; \
EX "DO \$\$ DECLARE r jsonb; BEGIN PERFORM set_config('role','authenticated',true); PERFORM set_config('request.jwt.claim.sub','$USR',true); r := public.approval_transition(jsonb_build_object('organisationId','$ORG_A','referenceType','payment_requests','referenceId','$FOREIGN_PR','action','approve')); IF r->'error'->>'code'='RECORD_NOT_FOUND' THEN RAISE EXCEPTION 'T10 PASS RECORD_NOT_FOUND'; ELSE RAISE EXCEPTION 'T10 FAIL code=%', COALESCE(r->'error'->>'code','none'); END IF; END \$\$;"

echo "T11 work_orders transition path"; \
EX "DO \$\$ DECLARE v_id uuid; r jsonb; v_st text; BEGIN PERFORM set_config('role','authenticated',true); PERFORM set_config('request.jwt.claim.sub','$USR',true); SELECT id INTO v_id FROM public.subcontractor_work_orders WHERE organisation_id='$ORG_A' AND status='Draft' LIMIT 1; IF v_id IS NULL THEN RAISE EXCEPTION 'T11 SKIP no-draft-workorder'; END IF; r := public.approval_transition(jsonb_build_object('organisationId','$ORG_A','referenceType','work_orders','referenceId',v_id::text,'action','approve','clientRequestId','phase14-t11')); IF r->>'error' IS NOT NULL THEN RAISE EXCEPTION 'T11 FAIL envelope=%', r->'error'->>'message'; END IF; SELECT status INTO v_st FROM public.subcontractor_work_orders WHERE id=v_id; IF v_st='APPROVED' THEN RAISE EXCEPTION 'T11 PASS approved-ok'; ELSE RAISE EXCEPTION 'T11 FAIL status=%', v_st; END IF; END \$\$;"

echo "T12 backfill_approval_denorm(p_org_id)"; \
EX "DO \$\$ DECLARE r jsonb; BEGIN PERFORM set_config('role','authenticated',true); PERFORM set_config('request.jwt.claim.sub','$USR',true); r := public.backfill_approval_denorm('$ORG_A'::uuid); IF r->>'error' IS NULL THEN RAISE EXCEPTION 'T12 PASS names=% projects=%', r->'data'->>'requesterNamesBackfilled', r->'data'->>'projectNamesBackfilled'; ELSE RAISE EXCEPTION 'T12 FAIL envelope=%', r->'error'->>'message'; END IF; END \$\$;"

echo "T13 rollback proof: no lingering test rows after all blocks"; \
EX "DO \$\$ DECLARE c int; w int; BEGIN SELECT count(*) INTO c FROM public.payment_requests WHERE client_request_id LIKE 'phase14-%'; SELECT count(*) INTO w FROM public.subcontractor_work_orders WHERE organisation_id='$ORG_A' AND status='APPROVED' AND NOT EXISTS (SELECT 1 FROM public.approvals a WHERE a.reference_type='work_orders' AND a.reference_id=subcontractor_work_orders.id AND a.status='APPROVED'); IF c=0 AND w=0 THEN RAISE EXCEPTION 'T13 PASS nothing-persisted'; ELSE RAISE EXCEPTION 'T13 FAIL strays=% wos=%', c, w; END IF; END \$\$;"

echo "T14 PR still Pending (restore intact)"; \
EX "DO \$\$ DECLARE v record; BEGIN SELECT status, approved_by INTO v FROM public.payment_requests WHERE id='$PR'; IF v.status='Pending' AND v.approved_by IS NULL THEN RAISE EXCEPTION 'T14 PASS pending-intact'; ELSE RAISE EXCEPTION 'T14 FAIL status=%', v.status; END IF; END \$\$;"
