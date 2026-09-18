# PHASE 0 — Production Truth & Object-Drift Classification

**Date:** 2026-09-16 · **Project:** `rujqejtisqermjyqqgoj` · **Mode:** audit evidence only — no production object was modified.
**Supersedes, for database facts:** all repo-derived claims; see `MODULE-AUDIT-LIVE-DB-VERIFICATION-2026-09-16.md`.

---

## 0.1 Live DB baseline captured

Saved in `apps/web/supabase/remediation/` (all read via `supabase db query --linked`, 2026-09-16):

| File | Rows | Notes |
|---|---|---|
| `baseline_tables.json` | 415 | public tables + RLS flag + policy count |
| `baseline_policies.json` | 948 | full policy definitions |
| `baseline_functions.json` | 427 | incl. `prosecdef`, `proconfig`, anon-exec flag, 5,000-char body head |
| `baseline_triggers.json` | 302 | incl. action statement |
| `baseline_constraints.json` | 1,873 | incl. CHECK/enums/unique defs |
| `baseline_indexes.json` | 1,479 | incl. indexdef |
| `baseline_views.json` | 13 | view names + reloptions |
| `baseline_storage_buckets.json` | 9 | `attachments`, `avatars`, `invoice-submissions`, `meeting-references`, `organisation-assets`, `project-collab-attachments`, `subcontractor-documents`, `task-attachments`, `vendor-documents` |
| `baseline_extensions.json` | 6 | incl. `pg_trgm` in public |
| `baseline_database_types.ts` | 31,654 | `gen types --linked` snapshot |

Also captured: security advisors 634 / performance advisors 720; the 11 org-less-policy tables; the full envelope-RPC absence check.

## 0.2 Migration-drift strategy (decision)

**Root cause of drift:** production was built out-of-band; 149 of 205 repo migration files are 0-byte placeholders. The repo cannot reproduce production and must not be used as schema evidence.

**Adopted strategy — "forward-only on live truth":**
1. **Baseline as ground truth** — this directory's JSON/TS snapshots are the recorded production state (Phase 0.1).
2. **Never edit applied history.** No file in `supabase/migrations/` will be edited, and no placeholder backfill will attempt to recreate history.
3. **Every remediation ships as its own forward migration** in `apps/web/supabase/migrations/`, named `20260916xxxxxx_remediation_<topic>.sql`, idempotent where practical, each verified against the live catalog after deployment.
4. **A full `pg_dump`-style schema baseline** (to later re-seed a reproducible migration chain) is **DEFERRED** — the CLI's `db dump` needs Docker (absent here) and no `pg_dump`/psql binary exists on this machine. Not a blocker: `db query` + `gen types` give everything the forward migrations need.
5. Old `sql/` and `src/database-*.sql` scripts are **frozen as historical evidence** — never to be executed again against production.

## 0.3 Object-drift classification

Reachability: import graph from `App.tsx`/`main.tsx` → **930 of 1,196** web files reachable (`drift-scan.cjs`, output in `drift-references.json`). 47 audited objects: **35 referenced from reachable code, 12 dead**. Every suspected table was also probed via PostgREST with the app's own anon key (404 = absent for the app).

### A. Missing AND required — Phase 1.3 scope (create, with org-scoped RLS)

| Object | Reachable callers | Evidence of required |
|---|---|---|
| `notifications` | `pages/ClientLookup.tsx` (insert on assignment); `lib/workInstructionNotify.ts` `notifyAssignees` (insert; Work Instructions module); TodoList/RemindMe ecosystem | Live has `approval_notifications` / `warranty_notifications` (approval/warranty-shaped) but **no general user-notification table**; two independent modules write the identical `{user_id, organisation_id, title, body, link, notification_type}` shape |
| `client_communication_entries` | `ClientLookup.tsx:401` (insert, then **throws on 404 — breaks the "call logged & routed" flow**; the `client_communication` insert succeeds first, so partial state is created) | `client_communication` has `parent_communication_id`-style threading intent (`parent_communication_id` column exists live) |
| `manager_alerts` | `pages/ManagerAlerts.tsx` (select/update/realtime); `lib/workInstructionNotify.ts` `pushManagerAlert` (insert with `alert_type` column) | **Full repo SQL exists** (`supabase-manager-alerts.sql`) — table + RLS — simply never applied. ManagerAlerts type matches it except `alert_type` (used by the WI helper) must be added |
| `reminders` | `pages/RemindMe.tsx` (select/insert; route `/remind-me`), `pages/TodoList.tsx` (select) | Fields used: `organisation_id, title, remind_date, description, created_at`; TodoList orders by `created_at` |

### B. Renamed/replaced — Phase 1.3/1.4: fix the code, not the DB

| Missing name | Live canonical | Caller(s) | Action |
|---|---|---|→ `quotation_header` | `ClientLookup.tsx:248` (`select id, quotation_no, quotation_date, status, total_value, project_id`) — live has `quotation_no`, `date`, `grand_total`, `status`, `project_id`; **no** `quotation_date`/`total_value` columns | Map to live columns; then read-only selects work with existing RLS (`user_can_access_org`) |
| `boms` | `bom_headers` (has `is_active`, `product_id`, `organisation_id`) | `sales/components/StockCheckPanel.tsx:188` (BOM guard: `.eq('material_id', check.item_id)` → live column is `product_id`) | Map table+column |
| `invoice_line_items` | `invoice_items` | `reports/invoiceApi.ts:138` (report joins `invoices`, `items`, `clients`) | Map table name |
| `project_tasks` | `tasks` (+ `task_groups`, `task_views`) | `SiteStoppageTaskIntents.tsx` | Map table (verify column compatibility at implementation time) |
| `quotation_variant_discounts` | `quotation_revision_variant_discount` | `CreateQuotation/index.tsx`, `CreateQuotationV2/index.tsx` | Verify at implementation time (careful: quoted ref may be inside a comment/type — the `.from(` regex says it is a real query) |

### C. Obsolete / superseded — do NOT create

| Missing name | Caller | Why obsolete |
|---|---|---|
| `expense_claims` | `approvals/integration.ts` (rpc caller), `approvals/api.ts` (mention) | Live has `expense_entries` (used by `Approvals.tsx` for the same approval flow) |
| `material_dispatches` | `approvals/integration.ts` | Live `dispatch_orders` (manufacturing) exists; the approvals path targets `expense_entries`/`dispatch_orders` |
| `salary_increments` | `hooks/useSalarySlip.ts` | Only HR table live is `hr_advances_expenses`; no payslip/salary-increment feature is routed (verify route at fix time) |
| `subcontractor_attendance` | `pages/Subcontractors.tsx`, `subcontractor-v2/services/subcontractorService.ts` | Live has `attendance`, `manpower_attendance`; the v2 Subcontractors page is not the live subcon surface (route uses `features/subcontractor-v2/pages/SubcontractorsPage`) |
| `project_closure_checklists/_gates/_templates` | `hooks/useProjectClosureChecklist.ts` | No closure tables live; closure feature not reachable in current nav (verify at fix time) |
| `quotations`, `quotation_headers` (as separate table) | see §B | superseded by `quotation_header` |

### D. Dead / unreachable — remove in Phase 6 (no DB objects)

`avatars`(bucket), `feature_flags`, `plan_features`, `pricing_plans`, `project_comments`, `project_scope_items`, `project_scope_item_versions`, `subscription_events`, `subscriptions`, `work_instructions`, `work_items`, `attachments`(bucket), `audit_logs`(local-only files), `client_communication_entries` variants in stale docs.

### E. RPCs — the never-deployed envelope-RPC family

**22 functions missing live, with ZERO SQL source in the repo** (checked all `*.sql`): the work-order family (`work_orders_list`, `work_order_detail`, `work_order_save_draft`, `work_order_submit_for_approval`, `work_order_bind_approval`, `work_order_issue`, `work_order_approve`), the payment-request family (`payment_requests_list`, `payment_request_create`, `payment_request_approve`, `payment_request_release`, `payment_request_bind_approval`), `approval_transition`, `backfill_approval_denorm`, `create_complete_site_report`, `update_complete_site_report`, `increment_measurement_count`, `calculate_job_card_variances`, `release_job_card`, `rollup_item_item_standard_cost`→`rollup_item_standard_cost`, `execute_standard_cost_rollup_run`, `update_purchase_requisition_header_status`.

| RPC | Caller(s) | Workflow impact | Classification |
|---|---|---|---|
| `approval_transition` | `approvals/api.ts` `triggerPostApprovalActions` for `work_orders`, `payment_requests`, `purchase_payments`, `subcontractor_payments` | Approving a work order / payment request / purchase or subcontractor payment **silently does nothing** to the target document (error swallowed with `console.error`) | **Required — Phase 1.4 core** |
| `payment_request_*` (5) | `modules/Purchase/hooks/usePurchaseQueries.ts` (`create` at :815, `approve` at :855/:886), `payment-requests/hooks/usePaymentRequests.ts` (list/create/approve/release), `approvals/integration.ts:431` (`bindApproval`) | Payment-request creation/approval/release flows fail; PaymentsHub uses table-level mutations elsewhere, so behavior varies by surface | **Required (create/approve/release/list; bind depends on approvals bridge)** |
| `backfill_approval_denorm` | `ApprovalSettings.tsx` (admin maintenance button) | Maintenance action fails | **Required** (trivial backfill SQL) |
| `update_purchase_requisition_header_status` | `purchase-inquiries/api.ts:246` `updateRequisitionHeaderStatus` | Requisition header status not synced from line actions | **Required** (small, well-defined) |
| `create_complete_site_report`, `update_complete_site_report` | `pages/SiteReport.tsx` | Site-report save/update fails → callers either fallback or error | **Required** (verify fallback behavior at fix time) |
| `increment_measurement_count` | `hooks/useMeasurementSheets.ts` | Measurement counter increment fails | **Required** (small) |
| `work_order_*` (6) + `work_order_approve` | `work-orders/api/rpc.ts` (list/detail/saveDraft/submitForApproval/bindApproval/issue/approve) | Work-order RPC surface unused at runtime? — `useWorkOrders.ts` calls it; verify whether that hook is mounted by reachable UI | **Investigate → likely required for WO flow** |
| `calculate_job_card_variances`, `release_job_card`, `rollup_item_standard_cost`, `execute_standard_cost_rollup_run` | `features/manufacturing/repository/{jobCardRepository,bomRepository}.ts` | Manufacturing RPC surface; verify reachability of the repository functions | **Phase 3.2 scope** |
| `ensure_site_report_photos_bucket` | none reachable | dead | **Deferred (dead)** |

**Cross-cutting finding (fail-closed, Phase 1.4/2.1):** `approvals/api.ts` `triggerPostApprovalActions` catches ALL errors and logs them; with `approval_transition` missing, approvals of four reference types complete the approval record but never transition the target document. Also: purchase payment approval has a **direct-table UPDATE fallback** (`usePurchaseQueries.ts` approval fallback via `supabase.from('purchase_payments').update(...)`) that must be removed (Phase 2.1) — RPC failure must never trigger a browser-side authorization path.

### F. 12 dead objects — no reachable references (no action now)

`avatars`, `expense_claims`*, `feature_flags`, `inventory_lots`*, `invoice_line_items`*, `manager_alerts` *(only if we choose code-side removal instead of create)*, `plan_features`, `pricing_plans`, `project_comments`, `project_scope_item_versions`, `project_scope_items`, `subscription_events`, `subscriptions`, `work_instructions`, `work_items`, `salary_increments`, `project_closure_*` (3), `quotation_headers` (as table)

*listed here for completeness; their classification lives in §B/§C above.

---

## Classification ledger (rule §Issue classification)

| Finding | Class |
|---|---|
| Envelope-RPC family never deployed (22 fns) | **CONFIRMED** (absence verified live) |
| `recalc_vendor_balance` no-op | **CONFIRMED** (financial correctness) |
| Follow-up activity-log CHECK vs app vocabulary | **CONFIRMED** |
| 404s on `notifications`/`client_communication_entries`/`manager_alerts`/`reminders` | **CONFIRMED** (PostgREST-probed with app key) |
| Old "12 USING(true)" manufacturing finding | **REFUTED** (live policies are org-scoped) |
| Old "Purchase PO/RLS missing" finding | **REFUTED** (live policies are org+permission scoped) |
| Old "Communication RLS reconstruction" | **REFUTED** (`user_can_access_org` policy live) |
| Old "`user_can_access_org` undefined" | **REFUTED** (exists, SECURITY DEFINER, pinned search_path) |
| `fulfillFromStoreLine` browser-side stock deduction | **STATIC / HIGH-RISK** (code path confirmed; no live reproduction) |
| Approval browser fallback on purchase payments | **STATIC / HIGH-RISK** (code confirmed) |
| Runtime multi-tenant tests | **NOT VERIFIED** (needs two tenants + signed-in user) |
| `tsc --noEmit` full-project | **NOT VERIFIED** (times out >10 min in this env) |
| Payment-request UI using table mutations on some surfaces | **STATIC / HIGH-RISK** (review in Phase 2) |
