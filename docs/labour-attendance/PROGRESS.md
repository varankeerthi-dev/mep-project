# BillFast Labour & Subcontractor Attendance — Resumable Progress Log

## Current Status
- **Active Phase**: Phase 1 — Unified Parties & Workers, Planned-vs-Actual Attendance
- **Current Step**: Step 1.1 Parties (D3) & Step 1.2 Workers (D4)
- **Phase 0 Exit Gate Status**: PASSED (W1 & W6 verified on live remote DB, mobile capacitor sync verified)

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
- [ ] **1.1 Parties (D3)**:
  - Add `party_id` uuid column to `clients`, `purchase_vendors`, and `subcontractors`.
  - Migration for party deduplication backfill by GSTIN (and normalized phone/name).
  - Implement `resolve_legacy_ids(party_id, role)` RPC.
  - Frontend party management and role assignment.
- [ ] **1.2 Workers (D4)**:
  - Create `labour_workers` table.
  - Add `worker_id` and `employee_id` to `manpower_attendance` with `CHECK (worker_id IS NULL OR employee_id IS NULL)`.
  - Quick-add casual worker modal from attendance screen.
- [ ] **1.3 Planned vs Actual (D2)**:
  - Extend `manpower_attendance` with `entry_kind` (`'PLANNED'`, `'ACTUAL'`), `client_confirmation`, and `planned_from_id`.
  - Implement RPCs: `plan_labour`, `confirm_plan_with_client`, `convert_plan_to_actual`.
  - Re-point site planning UI to use `manpower_attendance` with `entry_kind = 'PLANNED'`.
- [ ] **1.4 Verification & Mobile Parity (W1, W4, W5a, W6, W9)**:
  - Verification suite executed with 0 leftover rows.
  - Mobile parity build & sync: `pnpm --filter=mobile build && pnpm --filter=mobile exec cap sync`.

---

## Applied Migrations
| Timestamp / Version | Name | Applied At | Status |
|:---|:---|:---|:---|
| 20260916170000 | subcontractor_v2_rpc_hardening | Pre-existing | Applied |
| 20260918000000 | subcontractor_ra_billing_extension | Pre-existing | Applied |
| 20261103000001 | site_planning_foundation | Pre-existing | Applied (0 rows) |
| 20261103010000 | phase0_labour_foundation | 2026-11-04 00:04 | Applied & Verified |


---

## Open Issues / Notes
- `20261103000001_site_planning_foundation.sql` was already applied to remote DB. Per Rule R1, we preserve tables and implement unified site planning on `manpower_attendance` (`entry_kind = 'PLANNED'`).
- In PowerShell, direct API calls use `Invoke-RestMethod` against `https://api.supabase.com/v1/projects/rujqejtisqermjyqqgoj/database/...` using personal access token from `mcp_oauth_tokens.json`.
