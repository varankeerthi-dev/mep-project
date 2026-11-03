# BillFast Labour & Subcontractor Attendance — End-to-End Implementation Prompt (Phase 0 → Phase 4)

Paste everything below into OpenCode.

---

```
You are implementing a multi-phase feature in the BillFast codebase (multi-tenant SaaS ERP for MEP/EPC contractors; React/TypeScript frontend, Supabase/Postgres backend). You will implement, verify against REAL WORKFLOWS, then apply migrations through the supervised Supabase MCP, phase by phase, until the whole feature is live and proven.

Read this entire prompt before touching anything. Work autonomously, but obey the HARD RULES and STOP CONDITIONS.

====================================================================
0. HARD RULES
====================================================================
R1. ADDITIVE ONLY. Never drop tables/columns, never delete production data, never rewrite history. New columns are nullable or defaulted; backfills are idempotent. Anything destructive => STOP and ask.
R2. EVERY schema change ships as a LOCAL migration file first: supabase/migrations/<YYYYMMDDHHMMSS>_<snake_name>.sql (timestamps strictly after the latest existing file). Files must be idempotent (IF NOT EXISTS / CREATE OR REPLACE / guarded DO blocks) and include a commented ROLLBACK section at the bottom.
R3. APPLY TO THE DATABASE ONLY THROUGH THE SUPABASE MCP (supervised). Never use raw psql/connection strings/service keys. Call the MCP once per migration, with SQL byte-identical to the local file. The MCP is supervised: show what you are applying, wait for approval where the tool requires it, never try to bypass. After applying, list migrations via MCP and confirm the applied name/version matches the local filename so local and remote never drift.
R4. NOTHING IS APPLIED UNTIL ITS VERIFICATION PASSES (see section 3). Order per migration: write local file -> verify on an isolated target (Supabase dev branch via MCP if available; otherwise rollback-wrapped tests, see 3.2) -> apply to the real project via MCP -> re-run the smoke + workflow checks against the real project.
R5. VERIFICATION MUST EXERCISE THE ACTUAL WORKFLOW. grep, file-exists checks, "the code looks right", tsc, lint and build are necessary but NEVER sufficient. A phase passes only when real RPCs have been called as real authenticated users (JWT claims set, role authenticated) and real UI flows have been driven in a browser, and the resulting DB rows and amounts match values computed independently in the test.
R6. Do not weaken, skip, or delete a test to make it pass. If a test is wrong, fix it and explain why in the verification log.
R7. Money is computed ON THE SERVER. The client never supplies rates or amounts that the server trusts.
R8. Tenancy convention for every new table/policy/function: organisation_id uuid NOT NULL, RLS enabled, policies `TO authenticated` using (SELECT user_can_access_org(organisation_id)). NEVER `TO public`, never `user_organisations` subqueries, never an unconditional "Enable all" policy. Every SECURITY DEFINER function: SET search_path = public, unconditional tenancy check (no `auth.uid() IS NOT NULL AND ...` escape), no test GUC short-circuits.
R9. Permissions are enforced in the DATABASE (RPC checks has_permission), and the UI merely mirrors them. Never gate on user_metadata.role.
R10. Keep a resumable log: docs/labour-attendance/PROGRESS.md (phase, step, what passed, what is applied, migration file names, open issues). Update after every step. If your context resets, read it first.

STOP CONDITIONS (stop and ask the user, do not guess):
- any destructive operation, or a backfill that would change/delete existing rows;
- a verification you cannot make pass after 3 genuine fix attempts;
- a test that would need to mutate the real project's data in a way that cannot be rolled back or cleaned up;
- the live schema differs materially from the audit findings below.

====================================================================
1. BACKGROUND AND DECIDED DESIGN
====================================================================
1.1 The business. The user's company is an EPC contractor (supply + installation) that outsources installation labour to subcontractors/labour contractors who charge per DAY (headcount x rate) or per RUNNING METER (measured work x rate), varying by client. The user ALSO bills the client for that labour. A labour contractor can be his OWN tenant of BillFast: he supplies labour to the user and to other clients; he saves clients, marks attendance (client name + worker name), uses his own employees plus casual/emergency individuals, bills the client, and pays salary/wages to his own team and the casuals. So there are two tenant profiles using ONE engine:
  - EPC tenant: labour = cost owed to vendors, optionally recharged to client.
  - Labour-contractor tenant: labour = revenue billed to clients AND cost paid to workers; margin per client matters.
  Both share one attendance record and one rate system.

1.2 What the audit found (treat as true but VERIFY against the live DB in Phase 0 step 1; the audit only saw the 2026-09-16 snapshot):
  - `manpower_attendance` is confirmed-live and is THE labour row: subcontractor_id, client_id, labour_category_id, workers_count, hours_worked, supervisor_name (free text), work_unit_id (UUID, no FK, never populated), work_unit_type, applied_modifiers UUID[], base_rate/adjusted_rate/original_amount/adjusted_amount (NOT NULL snapshots), status DRAFT|SUBMITTED|APPROVED|REJECTED, approved_by (never set), approved_at, source/source_report_id (never written). It has NO project_id, NO billable flag, NO meter columns.
  - `labour_categories` (trade master with base_rate, unit), `rate_cards` (per-vendor negotiated, dated), `context_modifiers` (multipliers), `manpower_billing` (attendance_entries UUID[] — zero app references), `subcontractor_measurement_sheets` (line_items JSONB {unit, contract_qty, actual_qty, rate, amount}).
  - The 4 attendance write RPCs (record_attendance, update_attendance, delete_attendance, approve_attendance) and get_labour_categories, create_labour_category, get_context_modifiers, get_rate_cards are NOT in the 2026-09-16 snapshot; supabase/migrations/20260916170000_subcontractor_v2_rpc_hardening.sql may define them but may not be applied.
  - record_subcontractor_bill / record_subcontractor_payment are the only trustworthy money writers (SECURITY DEFINER, idempotency keys, fail-closed GL lookup, debit=credit assertion, immutability triggers). They insert journal lines WITHOUT project_id/cost_center_id.
  - Four parallel party masters: clients, purchase_vendors, subcontractors, and parties + party_roles (live schema, dead UI, RLS enabled with ZERO policies).
  - Three different meanings of employee_id across tables (employees.id, auth.users.id, user_profiles.id). Never add another.
  - No RBAC keys exist for attendance/subcontractor/manpower/labour. No audit trail exists in this domain. attendance_status_check lacks 'leave' and 'no_show'.
  - A migration supabase/migrations/20261103000001_site_planning_foundation.sql (+ features/site-planning/ UI) exists, UNAPPLIED.

1.3 DECISIONS ALREADY MADE BY THE USER (do not re-litigate):
  D1. Build ON `manpower_attendance` (extend it); do not create a parallel attendance table.
  D2. DROP the site_planning_foundation migration: do NOT apply it. Move it to supabase/migrations_rejected/ (do not delete). Re-point the Site Plan feature (planned manpower per date/client/project with client-confirmation status) to manpower_attendance rows in a PLANNED state, using labour_categories as the only trade vocabulary.
  D3. Move to `parties` / `party_roles` as the unified party model, STAGED: add party_id mapping columns + GSTIN-dedupe backfill; leave old tables and screens working; the new labour features use party pickers (PartySelector / SmartPartyDropdown / CreatePartyModal) from day one. Add policies to parties/party_roles first.
  D4. Named workers: BOTH. Own permanent staff stay in `employees` and are referenced by employee_id. Casuals, emergency individuals and vendor crews live in a new `labour_workers` table. A labour row references AT MOST ONE of {employee_id, worker_id}; a row with neither is a pure headcount-by-trade row.
  D5. Client recharge: BOTH. Rows carry is_billable + bill_rate snapshot (data layer); the client invoice flow PULLS approved, billable, not-yet-invoiced rows at invoice time (billing layer), marks them invoiced, and the same rows give margin per client/project.
  D6. Running meter = measured work, NOT an equipment master. Reuse the measurement-sheet line shape. Equipment/plant hire is OUT OF SCOPE.
  D7. Light wages module for own team + casuals (attendance -> payable -> advances/deductions -> payment). Statutory payroll (PF/ESIC/PT) is OUT OF SCOPE.
  D8. Cross-tenant attendance sharing is LAST (Phase 4). It shares only attendance for the linked client; never wages, margin, or rates.

====================================================================
2. PHASES
====================================================================
Every phase = implement -> local migration files -> verification (section 3) -> MCP apply -> post-apply verification -> one git commit -> update PROGRESS.md. Do not start phase N+1 until phase N's exit gate is green.

------------------------------------------------------------
PHASE 0 — REPAIR THE FOUNDATION
------------------------------------------------------------
0.1 Live check (READ-ONLY, via MCP execute_sql / list_*). Report actual state of: the 8 attendance RPCs above; subcontractor_work_orders.contract_value (does it exist?) and get_subcontractor_wo_rollup; subcontractor_invoices RA columns (subtotal, gross_amount, net_amount, billed_qty, measured_qty, tds_percent, retention_amount); org_members.employee_id; whether 20260916170000_subcontractor_v2_rpc_hardening.sql and 20260918000000_subcontractor_ra_billing_extension.sql are applied; whether the site_planning tables exist; current policies on labour_categories, context_modifiers, rate_cards, manpower_attendance, manpower_billing, parties, party_roles; RLS-enabled-without-policy tables in this domain. Write results to docs/labour-attendance/live-state.md. Adjust the plan below to what is ACTUALLY missing. If something the audit called missing already exists, reuse it.

0.2 Deploy the missing RPCs: review 20260916170000_subcontractor_v2_rpc_hardening.sql, fix anything wrong, and apply (via the R2-R4 flow).

0.3 Server-side money. Rewrite record_attendance/update_attendance so the client sends ONLY: organisation context, subcontractor/vendor, client, project_id, labour_category_id, work_date, workers_count, hours_worked, applied_modifiers, optional remarks. The function resolves rates itself, in this order: (a) rate_cards matching vendor x trade x project (effective on work_date) -> (b) rate_cards vendor x trade -> (c) tenant-level labour_categories.base_rate -> (d) if none, RAISE (fail closed; never default to 0). Apply context_modifiers multipliers server-side. Compute original_amount/adjusted_amount server-side. Ignore/remove p_base_rate/p_adjusted_rate/p_original_amount/p_adjusted_amount params (keep a compatible signature only if needed, but values must be ignored). Update subcontractorService.ts (remove `|| 0` defaults) and AttendancePage.tsx.

0.4 Project on the row. Add manpower_attendance.project_id uuid REFERENCES projects(id). Backfill from work_unit_id WHERE work_unit_type='PROJECT' AND the id exists in projects (report count of unmatched rows; do not guess). Wire the project picker in AttendancePage.tsx (setSelectedWorkUnit is never called today). Keep work_unit_* columns for back-compat.

0.5 Approval correctness. approve_attendance sets approved_by = auth.uid() and approved_at; reject_attendance (add if absent) likewise records actor + reason. Allow rate corrections while status='DRAFT' (update_attendance recomputes server-side). Approved rows are immutable except via an explicit reopen function that is permission-gated and audited.

0.6 Status CHECK fix for attendance (add 'leave', 'no_show') OR remove those UI options — pick adding them to the CHECK.

0.7 Client column fix: query embeds clients (or joins in an RPC) so the Client column on the attendance list is populated.

0.8 Tenancy leaks. Re-create policies on labour_categories and context_modifiers TO authenticated with user_can_access_org; stop admitting organisation_id IS NULL rows to anonymous/every org. Re-home the seeded global rows as per-tenant rows (backfill per organisation, idempotent; or a clearly-scoped template mechanism that is not anonymously readable). Fix manpower_attendance/rate_cards/manpower_billing policies off role=public and user_organisations onto authenticated + user_can_access_org. Make the org checks in the functions you touch unconditional.

0.9 RBAC + audit foundation (used by every later phase):
  - Add permission keys to permission-catalog.ts AND the DB seed: labour.attendance.view/create/edit/approve/reopen, labour.rates.manage, labour.workers.manage, labour.billing.view/generate, labour.wages.view/run/pay, labour.measurement.entry/approve, labour.share.manage. Wrap /subcontractors-v2/*, attendance routes and the Site Plan route in PermissionGuard. All RPCs that mutate check has_permission server-side.
  - Create a generic audit mechanism (one SECURITY DEFINER trigger function + audit table with organisation_id, table_name, row_id, action, old/new JSONB, actor uuid = auth.uid(), at) and attach it to manpower_attendance, rate_cards, labour_categories, manpower_billing and every new table below. The audit table is append-only (no UPDATE/DELETE policies) and tenant-scoped for reads.

0.10 Adjacent defects: fix these ONLY if you touch the file anyway, otherwise list them in docs/labour-attendance/adjacent-defects.md: work-order rate mapping bug (SubcontractorWorkOrderCreate.tsx:523-527/545-549 `rate: item.unit_price || item.total || 0` -> `item.rate`); discarded 35-field payload (:482); ledgerCalculator.ts retention hardcoded 0; get_subcontractor_wo_rollup contract_value -> total_amount; the three UI selects on non-existent columns; site-report fallback bypassing the role-gated RPC; 30 RLS-enabled-no-policy tables (at least parties, party_roles, and work_order_* if you touch them).

PHASE 0 EXIT GATE = workflows W1 and W6 (section 3.4) green on isolation target AND on real project after MCP apply.

------------------------------------------------------------
PHASE 1 — PARTIES, WORKERS, PLANNED-vs-ACTUAL
------------------------------------------------------------
1.1 Parties (D3). Add RLS policies to parties and party_roles (tenant + permission). Add party_id uuid (nullable, FK parties) to clients, purchase_vendors, subcontractors. Backfill: one party per distinct normalised GSTIN within an organisation (fallback: normalised legal name + phone only when GSTIN is absent, flagged `needs_review`); a firm present in two old masters becomes ONE party with TWO roles (customer/vendor/subcontractor) in party_roles. Idempotent, with a dry-run report first (counts of merged/ambiguous). Do not modify existing clients/vendors/subcontractors rows beyond setting party_id. Provide a resolver function `resolve_legacy_ids(party_id, role)` that returns (and, if missing, creates a legacy mirror row for) client_id / subcontractor_id so existing FKs on manpower_attendance keep working. The new attendance UI uses PartySelector.

1.2 Workers (D4). Create `labour_workers`: id, organisation_id, name, phone, trade (labour_category_id FK), worker_type CHECK in ('own_daily','casual','emergency','vendor_crew'), pay_basis CHECK in ('daily','hourly','per_meter','monthly'), default_rate numeric, vendor party_id nullable (when a vendor crew), employee_id nullable (never used together with a non-employee worker_type), is_active, notes. NO ID numbers/bank fields in v1 beyond optional UPI/phone text field `payout_ref`. Add to manpower_attendance: worker_id uuid REFERENCES labour_workers, employee_id uuid REFERENCES employees(id) (explicitly employees.id), CHECK (worker_id IS NULL OR employee_id IS NULL). Quick-add casual worker from the attendance screen in under 10 seconds (name + trade + rate; phone optional). Fix SubcontractorForm.tsx silently discarding team_members: either persist crew into labour_workers or remove the dead fields.

1.3 Planned vs actual (D2). Extend manpower_attendance with: entry_kind CHECK in ('PLANNED','ACTUAL') default 'ACTUAL', client_confirmation CHECK in ('confirmed','planned','planned_unconfirmed') nullable, planned_from_id uuid (self-FK: the planned row an actual was converted from). Move site_planning_foundation.sql to supabase/migrations_rejected/. Re-point features/site-planning/ (sitePlanApi.ts etc.) to manpower_attendance (+ the new RPCs: plan_labour, confirm_plan_with_client, convert_plan_to_actual(p_plan_id, p_actual_headcount, ...) which creates the ACTUAL row via the server-side rate resolution, links planned_from_id, and marks the plan 'converted'). Operations > Dashboard / Site Plan sub-tabs, calendar/table views, client-confirmed status toggle, and the communication-log side panel from the existing Site Plan UI keep working. Optional approval gate: if the tenant setting is on, planned rows need approval before becoming visible to service/erection.

PHASE 1 EXIT GATE = W1, W4, W5a (workers/parties part), W6, W9 green.

------------------------------------------------------------
PHASE 2 — PAYABLES AND CLIENT RECHARGE
------------------------------------------------------------
2.1 Payable roll-up. Create join table `manpower_billing_entries` (billing_id, attendance_id UNIQUE, organisation_id) and backfill from manpower_billing.attendance_entries (idempotent; report orphans). Rows included in a bill are locked (status BILLED). Enforce one attendance row in at most one bill. Keep the UUID[] column for back-compat but stop writing it. Create `generate_manpower_bill(p_vendor, p_client?, p_project?, p_period_from, p_period_to, p_idempotency_key)`: gathers APPROVED not-yet-billed rows, writes manpower_billing + entries, totals computed server-side.

2.2 Post to the ledger by REUSING the pattern/functions of record_subcontractor_bill / record_subcontractor_payment (idempotency key, fail-closed GL lookup, debit=credit assert). Retention/TDS/advance must come from the SAME source those functions use (work order / retention table) so the two paths never disagree. Populate project_id and cost_center_id on journal_entry_lines for labour cost (also patch record_subcontractor_bill to pass project_id where the WO has one). Wire manpower_billing.payment_id properly. Fix `recalc_subcontractor_balance` no-op only if the new flow depends on it.

2.3 Client recharge (D5). Add to manpower_attendance: is_billable boolean default false, bill_rate numeric, bill_amount numeric (server-computed snapshot), invoiced_at timestamptz, invoice_id uuid, invoice_line_ref. Create `labour_bill_rates` (organisation_id, client party/legacy client_id, labour_category_id, project_id nullable, rate, unit, effective_from/to; UNIQUE on the natural key). Bill rate resolution order mirrors cost: client x trade x project -> client x trade -> labour_categories default bill rate -> RAISE if billable and none (never 0). Create `pull_billable_labour(p_client, p_project, p_period_from, p_period_to)` that returns approved, billable, not-invoiced rows grouped by trade/rate, and `attach_labour_to_invoice(p_invoice_id, p_idempotency_key)` that creates invoice lines (follow the erection-charges pattern: master rate -> invoice line with rate_manually_edited freeze) and sets invoiced_at/invoice_id on the pulled rows in the same transaction. Re-running with the same key creates nothing new. Add the invoice-screen UI action "Add labour charges". Add views: `v_labour_margin` (per client/project: cost, billed, margin) and `v_labour_billable_uninvoiced`. Optionally include labour cost/revenue in project_financial_summary — do that only if you can prove existing numbers for projects without labour are unchanged.

PHASE 2 EXIT GATE = W1, W2, W3, W6 green.

------------------------------------------------------------
PHASE 3 — LABOUR-CONTRACTOR TENANT: WAGES, METERS, MARGIN
------------------------------------------------------------
3.1 Business profile setting per tenant (EPC / labour supplier / both) that shows/hides screens only; data model identical.

3.2 Wages module (D7). Tables: `labour_wage_runs` (organisation_id, period_from, period_to, kind 'weekly'|'monthly'|'on_demand', status draft/approved/paid), `labour_wage_lines` (run_id, worker_id XOR employee_id, days_or_units, gross, advance_recovered, deductions, net, source_attendance_ids via join table not array), `labour_advances` (worker/employee, amount, date, recovered_amount, status). Functions: `generate_wage_run` (aggregates APPROVED actual attendance for own/casual workers by pay_basis: daily = days x rate snapshot, hourly, per_meter from approved measurements, monthly staff = attendance days / working days x monthly rate), `approve_wage_run`, `pay_wage_run` (posts GL with the same fail-closed/idempotent/balanced pattern; assert debit=credit). Advances are recovered automatically up to a configurable cap per run and never push net below zero. Payslip/wage-statement view per worker. Employees' monthly pay must not double-count with HRFlow (separate app) — document the boundary in the migration header.

3.3 Measurement-based pay (D6). `labour_measurements`: organisation_id, vendor/worker, client, project_id, work_order_id nullable, task, unit, qty, rate snapshot (server-resolved from rate_cards/agreement), amount, status DRAFT/SUBMITTED/APPROVED, approved_by, evidence note. Agreements can carry pay_basis 'daily' | 'per_meter' | 'lump_sum' per vendor x client x project; for per_meter agreements, attendance is recorded for productivity only and does NOT drive the payable; the approved measurement does. Productivity view: meters per man-day. Billing the client on a different basis than paying the vendor (pay daily, bill per meter, or vice versa) MUST work: cost basis and bill basis are independent.

3.4 Margin UI: per client and per project, cost vs billed vs margin, with drill-down to the underlying rows.

PHASE 3 EXIT GATE = W5 (full), W8 green, plus W1-W4, W6, W9 re-run (regression).

------------------------------------------------------------
PHASE 4 — CROSS-TENANT SHARING (LAST)
------------------------------------------------------------
4.1 `labour_attendance_shares` + link table so a labour-contractor tenant's client record can be LINKED to another BillFast tenant (both sides must accept the link; link carries party_id on each side). The labour contractor can SUBMIT approved attendance rows for that client to the linked tenant; the receiving tenant sees them in an inbox, approves/rejects/disputes (with reason), and approved rows land in the receiving tenant's payable statement without re-entry. Shared payload: date, project reference name, trade, headcount/worker names, hours. NEVER shared: rates, wages, margin, other clients' data, workers' payout_ref. Each side keeps its own row; a shared_ref links them; edits after submission require re-submission. RLS must make it impossible to read across tenants EXCEPT through the share inbox rows addressed to your org. Full audit on every share action.

PHASE 4 EXIT GATE = W7 green + full regression of W1-W9 on the real project.

====================================================================
3. VERIFICATION — MUST BE REAL WORKFLOWS, NOT TEXT CHECKS
====================================================================
3.1 Static gates (necessary, not sufficient): tsc --noEmit, lint, build all pass. In addition, a "missing RPC" gate: enumerate every `.rpc('name'` call in src/ and assert each exists in pg_proc on the target. This catches the "24 of 32 RPCs missing live" class of bug.

3.2 Test targets, in order of preference:
  (a) A Supabase development BRANCH created via MCP, migrations applied there first, tests run there, branch deleted afterwards.
  (b) If branching is unavailable: run every DB test inside a single transaction that ends in ROLLBACK (via MCP execute_sql), so nothing persists. If a test cannot be rolled back (e.g. needs real auth users), use a dedicated test organisation whose name starts with `__verify_labour__`, tag every row, and delete everything you created in a cleanup step you also verify (row counts back to zero). Never touch real tenants' rows.

3.3 Test fixtures (create fresh each run): Org A (EPC) and Org B (labour contractor); users in Org A: site_engineer (create+view only), project_manager (approve), accountant (billing/pay), viewer; one outsider user in Org C; for Org B: owner. Seed: labour_categories per tenant (e.g. Fitter 800/day), rate_cards (vendor V1 Fitter 700 effective, one older superseded rate), labour_bill_rates (client C1 Fitter 950), a project P1 for client C1, employees (2 own staff), a casual worker, GL accounts required by the money functions. Use hand-computed expected numbers in the test source, e.g. 5 fitters x 8h x 700 = 3500 cost; billed 5 x 950 = 4750; margin 1250. Tests assert these EXACT figures from the database, not from the code under test.

3.4 Workflow suites. Each is an executable script (SQL via MCP and/or Playwright against the running app pointed at the test target). Save each run's raw output (row ids, amounts, error messages) to docs/labour-attendance/verification/<phase>-<suite>-<timestamp>.log.

W1 EPC daily-rate vendor flow (real roles):
  1. Sign in as site_engineer -> record_attendance for V1, C1, P1, Fitter, 5 workers, 8h while sending TAMPERED rates (base_rate 1, amounts 0) -> row stored with server-resolved 700/3500; tampered values ignored.
  2. Same call with a trade that has no rate anywhere -> raises (never stores 0).
  3. Edit headcount while DRAFT -> amount recomputed (e.g. 6 -> 4200).
  4. site_engineer calls approve -> DENIED by the database (not only the UI).
  5. project_manager approves -> approved_by = that user's uuid, approved_at set; further edit by anyone -> rejected; reopen requires labour.attendance.reopen and writes an audit row.
  6. Audit table contains create/edit/approve rows with the right actor each time.
  7. UI (Playwright): the attendance page lists the row with the Client AND Project columns populated; project picker works; the 'leave'/'no_show' statuses save without CHECK errors on the HR attendance screen.

W2 Payable and ledger:
  1. generate_manpower_bill for V1/period -> bill total equals sum of approved rows (hand-computed); rows now BILLED; re-run with same idempotency key -> no duplicate; attempting to bill the same row in a second bill -> rejected by the unique constraint.
  2. Post bill + payment via the money functions -> journal entries exist, SUM(debit)=SUM(credit), journal_entry_lines carry project_id for P1; payment with a missing GL account fails closed with no partial rows.
  3. Retention/TDS from the work order match what record_subcontractor_bill would compute for the same WO.
  4. Immutability: posted journal rows cannot be updated/deleted.

W3 Client recharge:
  1. Mark approved rows billable with client C1 -> bill_rate 950 resolved server-side; billable with no bill rate -> raises.
  2. Create a client invoice in the UI (Playwright) -> click "Add labour charges" -> invoice lines match hand-computed totals (4750 etc.); rows get invoiced_at/invoice_id; clicking again / re-calling with same key adds nothing; a row already invoiced is not pulled again.
  3. v_labour_margin for C1/P1 returns cost 3500, billed 4750, margin 1250 (hand-computed).
  4. Pay daily / bill per meter combination: create a per_meter bill basis and verify cost and bill are independent.

W4 Planned vs actual:
  1. In the Site Plan UI create a PLANNED row (date, client, project, trade, headcount, vendor) with status 'planned_unconfirmed'; toggle to 'confirmed'; calendar and table views both show it; communication-log panel works.
  2. If the approval gate setting is ON, an unapproved plan is not visible to service/erection; approve -> visible.
  3. convert_plan_to_actual with actual headcount 4 (planned 5) -> ACTUAL row created, rates server-resolved, planned_from_id set, plan marked converted; planned-vs-actual report shows 5 vs 4.

W5 Labour-contractor tenant (log in as Org B owner):
  a. Parties/workers: create client party via CreatePartyModal; a firm that exists as BOTH client and subcontractor (same GSTIN) resolves to ONE party with two roles; quick-add a casual plumber from the attendance screen (<10 seconds, name+trade+rate); record attendance mixing an own employee, the casual worker and a headcount row against the client.
  b. Billing: bill the client (labour invoice lines via attach_labour_to_invoice), exact amounts hand-checked.
  c. Wages: generate_wage_run for own employee + casual; an advance of 1000 is recovered up to the cap and net never negative; approve; pay -> GL posted balanced; wage statement matches hand-computed net.
  d. Margin per client = billed - (wages + vendor cost) matches hand-computed.

W6 Tenancy, permissions, anonymous:
  1. As Org A users: SELECT from every new/changed table and every new view and call every new RPC with Org B's ids -> zero rows / permission error. Repeat as Org B against Org A; repeat as the outsider.
  2. As anon: labour_categories, context_modifiers, parties, party_roles, manpower_*, labour_* all return nothing / denied.
  3. Calling mutating RPCs without the needed permission fails for each permission key (one negative test per key).
  4. RLS-enabled-with-no-policy check: list every table touched by this feature and assert it has >=1 policy.
  5. The audit table cannot be updated or deleted by any role.

W8 Measurement pay: record a per_meter agreement (rate 120/m), measurement of 50 m -> amount 6000 server-computed; attendance for that vendor does NOT change the payable; approving the measurement creates the payable; meters-per-man-day productivity view equals 50 / mandays; a tampered rate from the client is ignored.

W9 Party migration: run the backfill dry-run -> report; run for real on the test target -> idempotent (second run changes nothing); counts of merged firms match fixtures; existing Clients/Vendors/Subcontractors screens still load and CRUD still works (Playwright); the legacy FKs on manpower_attendance still resolve; resolve_legacy_ids creates a mirror row exactly once.

W7 Cross-tenant sharing (Phase 4): Org B links client record to Org A (both accept); B submits approved rows; A sees them ONLY in its inbox; A approves one, disputes another with a reason; approved row appears in A's payable statement with no re-entry and A's totals match hand-computed; B never sees A's rates and A never sees B's wages/margin/payout_ref (assert by querying every table/view as each side); revoking the link stops new submissions and hides the inbox.

3.5 Pass criteria. A phase passes only if: all static gates green; every suite in its exit gate green with logs saved; negative tests behaved (denials happened where expected); no leftover test data on the real project (verified by counts); regression suites from earlier phases still green. If anything fails: diagnose root cause, fix, re-run the WHOLE gate (not just the failing test). Record every failure/fix in the log.

====================================================================
4. APPLY-TO-DATABASE PROTOCOL (per migration, every phase)
====================================================================
1. Write the migration to supabase/migrations/<timestamp>_<name>.sql (idempotent + rollback comments).
2. Apply to the isolation target (branch) or execute within rollback-wrapped tests; run the phase's suites.
3. When green, apply the SAME file content to the real project through the supervised Supabase MCP (one migration per call, in order, with the file's exact name). Do not combine unrelated migrations. Show the SQL and wait for the supervision approval.
4. After applying: list migrations via MCP and confirm name/version parity with the local directory; run the Phase's smoke + workflow suites against the real project in the rollback-wrapped/test-org mode (3.2b), then confirm zero leftover test rows.
5. If post-apply verification fails: stop, do NOT push more migrations on top; apply a corrective forward migration (never edit an applied file), or run the file's documented rollback after asking the user. Record in PROGRESS.md.
6. Regenerate Supabase types (baseline_database_types.ts or the project's convention) after schema changes and fix compile errors.
7. Commit per phase: "labour: phase N — <summary>", including migrations, code, tests, logs, PROGRESS.md.

====================================================================
5. DELIVERABLES
====================================================================
- Migration files (local, ordered) + applied-state confirmation per file.
- Code changes (RPC wrappers, pages, hooks, permission keys, routes).
- docs/labour-attendance/: live-state.md, PROGRESS.md, adjacent-defects.md, verification/*.log, and a final REPORT.md containing: the phase-by-phase results table (suite x pass/fail x log path), migrations applied (name, date), defects found during verification and how fixed, anything deferred, and the exact manual steps (if any) the user must still do.
- A final one-screen summary for the user: what now works end to end (EPC flow, labour-contractor flow, planned vs actual, recharge, wages, meters, sharing), what is deliberately out of scope (equipment hire, statutory payroll), and remaining risks.

Begin with Phase 0 step 0.1 (read-only live check). Do not write any migration until docs/labour-attendance/live-state.md exists and you have reconciled the plan to it.
```

---

## Notes for you (not part of the prompt)

- **Why the prompt starts with a read-only live check:** the audit only saw the 2026-09-16 snapshot, so some "missing" items may already be live.
- **Verification is behavioural.** The suites call real RPCs as real roles, drive the real UI with Playwright, and compare against hand-computed numbers. Typecheck and build are just prerequisites.
- **Migration safety:** each file is saved locally, tested on a Supabase branch or in rollback-wrapped tests, and only then applied through the supervised MCP. The local filename is checked against the remote migration list afterwards, so nothing drifts.
- **Stop conditions** mean OpenCode asks you before anything destructive or ambiguous.
- If one run is too large, tell it to stop after each phase's exit gate and resume from `docs/labour-attendance/PROGRESS.md`.
