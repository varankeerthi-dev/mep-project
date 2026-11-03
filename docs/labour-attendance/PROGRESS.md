# BillFast Labour & Subcontractor Attendance — Resumable Progress Log

## Current Status
- **Active Phase**: Phase 2 — Payables Roll-Up & Client Recharge
- **Current Step**: Step 2.1 Payable Roll-Up & Step 2.3 Client Recharge Preparation
- **Phase 0 Exit Gate Status**: PASSED (W1 & W6 verified on live remote DB, mobile capacitor sync verified)
- **Phase 1 Exit Gate Status**: PASSED (W1, W4, W5a, W6, W9 verified on live remote DB, mobile capacitor sync verified)

---

## Step-by-Step Progress

### Phase 0: Foundation Repair
- [x] **0.1 Live check (READ-ONLY)**:
  - Completed on 2026-11-03.
  - Verified remote project `rujqejtisqermjyqqgoj`.
  - Discovered existing RPCs, table schemas, missing columns, policies, and syntax errors in `get_subcontractor_wo_rollup`.
  - Wrote comprehensive findings to `docs/labour-attendance/live-state.md`.
- [x] **0.2 & 0.3 Server-side money & RPC deployment**:
  - Migration file `20261103010000_phase0_labour_foundation.sql` applied to live project.
  - Rate resolution implemented (`resolve_labour_rate`, `calculate_context_multiplier`).
  - Tamper resistance verified: client rates ignored, server computes base_rate and amounts.
- [x] **0.4 Project on the row**:
  - `manpower_attendance.project_id` added with FK to `projects(id)`.
- [x] **0.5 Approval correctness**:
  - `approved_by = auth.uid()`, `reject_attendance`, `reopen_attendance` implemented and tested.
- [x] **0.6 Status CHECK fix**:
  - Added `'leave'`, `'no_show'` to `attendance`. Tested and verified.
- [x] **0.7 Client column fix**:
  - Client and Project columns added and joined on AttendancePage and AttendanceListPage.
- [x] **0.8 Tenancy leaks**:
  - Re-homed global templates for `labour_categories` and `context_modifiers`.
  - Tightened policies to `TO authenticated` with `user_can_access_org(organisation_id)`.
- [x] **0.9 RBAC + audit foundation**:
  - Permission catalog keys seeded (15 `labour.*` keys).
  - Generic audit trigger and append-only table `labour_audit_log` with security trigger preventing updates/deletes.
- [x] **0.10 Adjacent defects**:
  - Fixed `get_subcontractor_wo_rollup` to reference `wo.total_amount` instead of non-existent `wo.contract_value`.
- [x] **Phase 0 Exit Gate (W1, W6)**:
  - Automated verification test run against live database `rujqejtisqermjyqqgoj`.
  - Verified W1.1 (tamper resistance), W1.2 (unrated trade fail closed), W1.3 (draft recalculation), W1.4 (engineer approval denied), W1.5 (PM approval succeeded, post-approval edit blocked, reopen succeeded), W1.6 (audit logging), W6 (tenancy barrier, audit table immutability), 0.10 (wo rollup fix), 0.6 (leave/no_show).
  - Raw log: `docs/labour-attendance/verification/phase0-w1-w6-2026-11-03T18-35-32-215Z.log`.
  - Leftover test rows: 0.

---

### Phase 1: Unified Parties & Workers, Planned-vs-Actual Attendance
- [x] **1.1 Parties (D3)**:
  - Added `party_id` uuid column to `clients`, `purchase_vendors`, and `subcontractors`.
  - Idempotent deduplication backfill executed across clients, purchase vendors, subcontractors.
  - Implemented `resolve_legacy_ids(party_id, role)` RPC returning legacy ids and creating mirror rows if missing.
  - Verified multi-role mapping (firm with both customer and subcontractor roles).
- [x] **1.2 Workers (D4)**:
  - Created `labour_workers` table with RLS tenant isolation and audit logging.
  - Added `worker_id` and `employee_id` to `manpower_attendance` with check constraint `chk_worker_or_employee`.
  - Implemented `quick_add_worker` RPC (<10s flow for casual workers with default rate and trade).
  - Implemented rate resolution priority for named workers.
- [x] **1.3 Planned vs Actual (D2)**:
  - Extended `manpower_attendance` with `entry_kind` (`'PLANNED'`, `'ACTUAL'`), `client_confirmation`, and `planned_from_id`.
  - Created `v_planned_vs_actual` view with headcount variance and server-resolved actual amounts.
  - Implemented RPCs: `plan_labour`, `confirm_plan_with_client`, and `convert_plan_to_actual`.
  - Re-pointed web `sitePlanApi.ts` and mobile `SitePlanMobile.tsx` to `manpower_attendance` (`entry_kind = 'PLANNED'`).
  - Moved `site_planning_foundation.sql` to `apps/web/supabase/migrations_rejected/`.
- [x] **Phase 1 Exit Gate (W1, W4, W5a, W6, W9)**:
  - Executed verification runner `scripts/verify-phase1.cjs` against live database `rujqejtisqermjyqqgoj`.
  - Verified W1 (approval & rate regression), W4 (planning, confirmation toggle, conversion with server rates, v_planned_vs_actual view), W5a (party multi-role, quick-add worker, named worker attendance), W6 (tenancy barriers, outsider blocked from RPCs, audit log immutability), W9 (idempotency, legacy resolution).
  - Raw log: `docs/labour-attendance/verification/phase1-w1-w4-w5a-w6-w9-2026-11-03T19-09-54-030Z.log`.
  - Leftover test rows: 0.
  - Mobile compilation & Capacitor sync verified: 0 warnings, 0 errors.

---

## Applied Migrations
| Timestamp / Version | Name | Applied At | Status |
|:---|:---|:---|:---|
| 20260916170000 | subcontractor_v2_rpc_hardening | Pre-existing | Applied |
| 20260918000000 | subcontractor_ra_billing_extension | Pre-existing | Applied |
| 20261103000001 | site_planning_foundation | Pre-existing | Moved to migrations_rejected |
| 20261103010000 | phase0_labour_foundation | 2026-11-04 00:04 | Applied & Verified |
| 20261103020000 | phase1_parties_workers_planning | 2026-11-04 00:37 | Applied & Verified |


---

## Open Issues / Notes
- `20261103000001_site_planning_foundation.sql` was already applied to remote DB. Per Rule R1, we preserve tables and implement unified site planning on `manpower_attendance` (`entry_kind = 'PLANNED'`).
- In PowerShell, direct API calls use `Invoke-RestMethod` against `https://api.supabase.com/v1/projects/rujqejtisqermjyqqgoj/database/...` using personal access token from `mcp_oauth_tokens.json`.
