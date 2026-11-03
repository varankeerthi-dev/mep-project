# BillFast Labour & Subcontractor Attendance — Resumable Progress Log

## Current Status
- **Active Phase**: ALL PHASES 0 → 4 COMPLETE & VERIFIED
- **Phase 0 Exit Gate Status**: PASSED (W1 & W6 verified on live remote DB, mobile capacitor sync verified)
- **Phase 1 Exit Gate Status**: PASSED (W1, W4, W5a, W6, W9 verified on live remote DB, mobile capacitor sync verified)
- **Phase 2 Exit Gate Status**: PASSED (W1, W2, W3, W6 verified on live remote DB, mobile capacitor sync verified)
- **Phase 3 Exit Gate Status**: PASSED (W5 full, W8, W6 verified on live remote DB, mobile capacitor sync verified)
- **Phase 4 Exit Gate Status**: PASSED (W7 cross-tenant sharing verified on live remote DB, mobile capacitor sync verified)
- **Full Regression Status**: PASSED (W1-W9 all green with 0 leftover rows)

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

### Phase 2: Payables Roll-Up, General Ledger Integration & Client Recharge
- [x] **2.1 Payable Roll-Up & Billing Join Table**:
  - Created `manpower_billing_entries` join table with `attendance_id UNIQUE` constraint to structurally prevent double billing.
  - Extended `manpower_billing` header with `idempotency_key` and `journal_id`.
  - Implemented `generate_manpower_bill` RPC: aggregates approved unbilled attendance, verifies work order retention %, creates join entries, transitions rows to `BILLED`, and recalculates subcontractor balance.
- [x] **2.2 General Ledger & Project Attribution Integration**:
  - In `generate_manpower_bill`, created balanced journal entry in `journal_entries`:
    - Debit: Operational Expense (Account `4100`)
    - Credit: Subcontractor AP (Account `2100`)
    - Credit: Retention Payable (Account `2150`, if retention % configured on work order)
  - Asserted `debit = credit` on every generated bill.
  - Attached `project_id` attribution to each journal entry line.
- [x] **2.3 Client Recharge & Rate Resolution**:
  - Created table `labour_bill_rates` with tenant RLS isolation and audit trigger.
  - Implemented RPC `resolve_labour_bill_rate` resolving rates with priority: (1) Client x Trade x Project -> (2) Client x Trade -> (3) Category Default -> (4) Fail Closed.
  - Implemented RPC `mark_attendance_billable` updating attendance with server-resolved `bill_rate` and `bill_amount`.
  - Implemented RPC `pull_billable_labour` returning uninvoiced billable labour rows.
  - Implemented RPC `attach_labour_to_invoice`: groups attendance by trade, generates `invoice_items` lines with mandays and rates, and links attendance rows via `invoice_id` with idempotency replay.
- [x] **2.4 Reporting Views**:
  - Created `v_labour_margin` computing `total_cost`, `total_billed`, `total_margin`, and `margin_percentage`.
  - Created `v_labour_billable_uninvoiced` listing all billable rows awaiting invoice attachment.
- [x] **2.5 Web & Mobile UI Parity**:
  - `apps/web/src/features/subcontractor-v2/services/subcontractorService.ts`: added `generateManpowerBill`, `pullBillableLabour`, `attachLabourToInvoice`, `getLabourMargin`, `getBillableUninvoiced`, `getLabourBillRates`.
  - `apps/web/src/features/subcontractor-v2/components/Attendance/AttendanceListPage.tsx`: added Labour Margin summary card, "Generate Manpower Bill" action button and modal, and "Client Recharge" column with billable status.
  - `apps/web/src/invoices/pages/InvoiceEditorPage.tsx`: added "Add Labour Charges" action pulling unbilled billable labour directly into the invoice editor.
  - `apps/mobile/src/screens/SitePlanMobile.tsx`: added Client Recharge badge and invoice linkage display with left-aligned monetary values per workspace rule 2.
- [x] **Phase 2 Exit Gate (W1, W2, W3, W6)**:
  - Verified via `scripts/verify-phase2.cjs` on live DB:
    - 5 fitters x 8h x ₹700 = ₹3500 cost
    - Billed 5 x ₹950 = ₹4750
    - Margin = ₹1250 (26.32%)
    - GL balanced: Debit ₹3500 = Credit ₹3500 (AP ₹3325 + Retention ₹175)
    - Double billing blocked by unique constraint
    - Idempotency replays on both bill generation and invoice attachment verified
    - Outsider blocked from all Phase 2 RPCs and tenant views
  - Raw log: `docs/labour-attendance/verification/phase2-w1-w2-w3-w6-2026-11-03T19-32-51-410Z.log`.
  - Leftover test rows: 0.
  - Mobile compilation & Capacitor sync verified: 0 warnings, 0 errors.

---

### Phase 3: Labour-Contractor Tenant — Wages, Piece-Rate / Meters & Margin
- [x] **3.1 Business Profile Setting**:
  - Added `organisations.business_profile` with values `'epc'`, `'labour_supplier'`, `'both'`.
- [x] **3.2 Wages Module**:
  - Created tables `labour_wage_runs`, `labour_wage_lines`, `labour_wage_line_sources`, `labour_advances` with tenant RLS isolation and audit triggers.
  - Implemented RPC `give_labour_advance` for casual workers and own employees.
  - Implemented RPC `generate_wage_run` aggregating actual attendance by pay basis with advance recovery cap (advances never drive net below zero).
  - Implemented RPC `approve_wage_run` and `pay_wage_run` posting balanced double-entry GL journals (`Debit: Wages Expense 4110`, `Credit: Cash/Bank 1010`, `Credit: Advance Recovered 1150`).
  - Created worker wage statement view `v_worker_wage_statement`.
- [x] **3.3 Piece-Rate / Measurement-Based Pay**:
  - Extended `rate_cards.pay_basis` and `subcontractor_work_orders.pay_basis` (`'daily'`, `'per_meter'`, `'lump_sum'`).
  - Created `labour_measurements` table with status workflow (`DRAFT` -> `SUBMITTED` -> `APPROVED`).
  - Added `manpower_attendance.productivity_only` boolean flag for piece-rate agreements.
  - Implemented RPCs: `record_measurement`, `approve_measurement`.
  - Created productivity view `v_labour_productivity` calculating meters per man-day without cross-contaminating worker daily wages.
- [x] **3.4 Margin & Service Layer**:
  - Updated `v_labour_margin` to dynamically combine daily attendance costs and piece-rate measurements against client recharge billing.
  - Added service methods to `subcontractorService.ts`: `giveLabourAdvance`, `getLabourAdvances`, `generateWageRun`, `approveWageRun`, `payWageRun`, `getWageRuns`, `getWorkerWageStatements`, `recordMeasurement`, `approveMeasurement`, `getMeasurements`, `getLabourProductivity`.
- [x] **Phase 3 Exit Gate (W5 full, W8, W6)**:
  - Verified via `scripts/verify-phase3.cjs` on live DB:
    - W5.a mixed attendance & casual worker quick-add verified
    - W5.b client recharge invoice attached (₹8350.00 billed) verified
    - W5.c advance given (₹1000), wage run generated (gross ₹5900, adv rec ₹1000, net ₹4900), approved, paid with balanced GL debit=credit=₹5900
    - W8 rate card ₹120/m, productivity attendance (cost ₹0), measurement 50m -> ₹6000 approved, productivity view = 10.00 m/manday
    - W5.d margin combining wages and measurements verified
    - W6 outsider blocked and audit immutability verified
  - Raw log: `docs/labour-attendance/verification/phase3-w5-w8-w6-2026-11-03T19-57-24-718Z.log`.
  - Leftover test rows: 0.
  - Mobile compilation & Capacitor sync verified: 0 warnings, 0 errors.

---

### Phase 4: Cross-Tenant Sharing & Bilateral Tenant Linking
- [x] **4.1 Schema & Linking**:
  - Created `labour_tenant_links` table supporting bilateral handshake between contractor (Org B) and client (Org A).
  - Extended `manpower_attendance` with `shared_ref` and `source_share_item_id`.
  - Created `labour_attendance_shares` batch header and `labour_share_inbox` items table.
  - Strictly sanitized payload: date, trade, headcount, hours, worker names, project reference name. Never leaks rates, wages, margin, or payout references.
  - Enforced cross-tenant RLS: receiver can ONLY see items when link status is `'accepted'`. Revoking the link immediately stops submissions and hides inbox from receiver.
- [x] **4.2 RPCs & Automated Import**:
  - Implemented `request_tenant_link`, `accept_tenant_link`, `revoke_tenant_link`.
  - Implemented `submit_shared_attendance`: batches approved rows and maps sanitized payload into receiver's inbox.
  - Implemented `review_shared_attendance`: allows approve, reject, dispute (reason required).
  - Approving automatically generates an approved attendance row in receiver's `manpower_attendance` using receiver's server-resolved rate card for vendor (zero re-entry).
- [x] **4.3 UI & Service Integration**:
  - Added service methods to `subcontractorService.ts`: `requestTenantLink`, `acceptTenantLink`, `revokeTenantLink`, `getTenantLinks`, `submitSharedAttendance`, `getSharedInbox`, `reviewSharedAttendance`.
  - Web UI: added "Shared Inbox" button with pending count badge and Shared Inbox Review Modal in `AttendanceListPage.tsx`.
  - Mobile UI: added "Shared Inbox" filter pill, card list, and review actions (Approve / Dispute) with left-aligned monetary columns in `SitePlanMobile.tsx`.
- [x] **Phase 4 Exit Gate (W7) & Full Regressions (W1-W9)**:
  - Verified via `scripts/verify-phase4.cjs` on live DB:
    - Bilateral tenant link handshake (Org B requests, Org A accepts) verified
    - Org B submits approved rows (5 fitters, 3 fitters) verified
    - Payload sanitization verified (zero rate, wage, or margin leaks)
    - Org A reviews: approves Item 1 (receiver attendance created with Org A rate ₹700, amount ₹3500)
    - Org A disputes Item 2 with reason (dispute without reason correctly rejected)
    - Zero re-entry payable roll-up: Org A generates bill for Subcontractor B with 1 row, total ₹3500.00
    - Tenant isolation: Org B queries Org A tables -> 0 rows; Org A queries Org B wages/margin -> 0 rows
    - Revoke link: stops submissions and hides inbox from Org A
    - Full audit logging into `labour_audit_log` verified
  - Raw log: `docs/labour-attendance/verification/phase4-w7-2026-11-03T20-21-31-547Z.log`.
  - Leftover test rows: 0.
  - Full regressions re-run and passed: Phase 0, Phase 1, Phase 2, Phase 3, Phase 4 all green.
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
| 20261103030000 | phase2_payables_client_recharge | 2026-11-04 00:57 | Applied & Verified |
| 20261103040000 | phase3_contractor_wages_measurements | 2026-11-04 01:25 | Applied & Verified |
| 20261103050000 | phase4_cross_tenant_sharing | 2026-11-04 01:46 | Applied & Verified |


---

## Open Issues / Notes
- `20261103000001_site_planning_foundation.sql` was already applied to remote DB. Per Rule R1, we preserve tables and implement unified site planning on `manpower_attendance` (`entry_kind = 'PLANNED'`).
- In PowerShell, direct API calls use `Invoke-RestMethod` against `https://api.supabase.com/v1/projects/rujqejtisqermjyqqgoj/database/...` using personal access token from `mcp_oauth_tokens.json`.
