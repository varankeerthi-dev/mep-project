# MANUFACTURING — Production Audit Report

> **⚠ CORRECTED 2026-09-16 — see `MODULE-AUDIT-LIVE-DB-VERIFICATION-2026-09-16.md`.**
> The headline finding is **refuted**: live `dispatch_orders`, `dispatch_items`, `dispatch_packing`, `dispatch_count_verification`, `grn_items`, `goods_receipt_notes`, `material_requisitions` and `material_requisition_items` all carry real `user_can_access_org(organisation_id)` policies on both `USING` and `WITH CHECK` — there is no `USING (true)` in production. The tenant gap that **is** real and narrower: the manufacturing cost tables `bom_cost_lines`, `bom_routing_operations`, `item_standard_costs`, `standard_cost_calculation_runs` and `benchmark_runs` have policies containing no org predicate. Separately, five manufacturing RPCs/tables the code calls (`rollup_item_standard_cost`, `execute_standard_cost_rollup_run`, `release_job_card`, `calculate_job_card_variances`, `boms`, `inventory_lots`) do not exist in production.

**Standard:** `MODULE_REFERENCE_PATTERN.md` (audit-only mode, §36).
**Date:** 2026-09-16
**Scope:** Manufacturing module — BOM engine, routing/work centres, production plans & schedules, job cards, production entries, stores (requisitions/GRN), QC (RM/IPQC/FG), dispatch, WIP valuation, machine board, costing/GL.
**Evidence basis:** repository only — **superseded**: the live database was subsequently read (see `MODULE-AUDIT-LIVE-DB-VERIFICATION-2026-09-16.md`).

---

## Executive Status

```text
FAIL
```

Twelve manufacturing tables are shipped with `USING (true) WITH CHECK (true)` policies and no later migration replaces them, so the database provides **no** tenant boundary for dispatch, GRN, QC and store-requisition data.

---

## Module Inventory

| Area | Findings |
|---|---|
| Pages | `pages/manufacturing/*` — 28 files (shell, dashboard, BOM list/editor/preview, custom fields/units, inventory report, job cards, production entries, schedules, plans, stores, QC, dispatch, machine board, work centres, activity log, WIP valuation) + **legacy `pages/manufacturing-v0/*` — 6 files still routed** |
| Feature layer | `features/manufacturing/` — `hooks/` (10), `model/` (11), `persistence/` (11), `repository/` (10, incl. `procurement/procurementRepository.ts`), `validation/` (zod schemas + 1 test file) |
| Components | `pages/manufacturing/machine-board/*` (AddMachineModal, DowntimeModal, MachineBoardDrawer), `BOMPreview`, plus shared UI |
| Database tables | `bom_headers`, `bom_items`, `bom_routing_operations`, `bom_cost_lines`, `bom_work_centers`, `job_cards`, `job_card_materials`, `job_card_cost_variances`, `production_entries`, `production_entry_items`, `production_plans`, `production_plan_items`, `job_card_activity_log`, `manufacturing_activity_log`, `work_centers`, `manufacturing_tooling`, `machine_downtime`, `item_standard_costs`, `standard_cost_calculation_runs`, `material_requisitions`, `material_requisition_items`, `goods_receipt_notes`, `grn_items`, `rm_qc_inspections`, `fg_qc_inspections`, `qc_parameters`, `qc_parameter_results`, `ipqc_checkpoints`, `ipqc_inspections`, `dispatch_orders`, `dispatch_items`, `dispatch_packing`, `dispatch_count_verification`, `inventory_lots`, `item_stock`, `warehouses`, `stock_movements` |
| RPCs | `accept_grn`, `release_fg_after_qc`, `issue_job_card_materials`, `return_job_card_materials`, `resolve_subassembly_bom`, `rollup_item_standard_cost`, `post_manufacturing_inventory_gl`, `generate_job_card_no`, `generate_bom_code`, `create_bom_revision`, `execute_warehouse_transfer`, `replenish_bin`, `dispatch_manufacturing_order_atomic` (+ warehouse chain 003–010) |
| Integrations | Purchase (PO/GRN), warehouse & inventory engine, accounting (`journal_entries`, GL posting), sales orders/MRP, mobile machine board |
| Exports | Inventory/WIP reports, BOM preview/print |
| Mobile | `apps/mobile/src/screens/MachineBoardMobile.tsx` only |
| Migrations | `supabase/migrations/013–023_*`, `20260730_manufacturing_gap_features.sql`, `20240101000096–104_*` (**0 bytes**), `20260718_add_organisation_id_to_stock_transfers.sql`, plus `src/supabase/migrations/003–018` |

---

## P0 Findings

### P0-1 — Twelve manufacturing tables have no tenant isolation

`apps/web/supabase/migrations/20260730_manufacturing_gap_features.sql:238-260`

```sql
ALTER TABLE dispatch_orders ENABLE ROW LEVEL SECURITY;
...
CREATE POLICY "Enable all access for dispatch_orders" ON dispatch_orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for dispatch_items"  ON dispatch_items  FOR ALL USING (true) WITH CHECK (true);
... (12 policies in total)
```

Tables affected: `dispatch_orders`, `dispatch_items`, `dispatch_packing`, `dispatch_count_verification`, `qc_parameters`, `fg_qc_inspections`, `qc_parameter_results`, `material_requisitions`, `material_requisition_items`, `goods_receipt_notes`, `grn_items`, `rm_qc_inspections`.

Verified detail:

- the policies are **not** preceded by `DROP POLICY IF EXISTS` (lines 249-251) — so re-applying fails, indicating this file is treated as a one-shot script;
- **no later migration references those tables at all** (`grep -l` over `202608*.sql` and `202609*.sql` returns nothing), so these are the latest policies known to the repository;
- RLS is enabled, so `anon` is blocked, but every authenticated user of **every** tenant can `SELECT`/`INSERT`/`UPDATE`/`DELETE` all rows through PostgREST.

The web pages do filter by `organisation_id` (DispatchCreate/Detail, GRNDetail, StoresDashboard, QCInspection*), which is exactly the pattern Rule 1 rejects: **frontend filtering is not the tenant boundary**.

**Also check in production:** whether these tables exist with these policies, and whether anyone has since replaced them by hand (`select tablename, policyname, qual from pg_policies where tablename in (...)`).

**Mobile amplification:** `apps/mobile/src/screens/MachineBoardMobile.tsx:26-29` loads four tables with `select('*')` and **no organisation filter and no limit**:

```ts
supabase.from('work_centers').select('*')
supabase.from('manufacturing_tooling').select('*')
supabase.from('job_cards').select('*').not('status','in','("completed","cancelled")')
supabase.from('machine_downtime').select('*').is('downtime_end', null)
```

`work_centers` is protected (see `src/supabase/migrations/011_work_centers_rls.sql`, org-scoped), so this is a payload/performance problem there — but it demonstrates that the mobile layer has no tenant-aware query discipline at all, while for `job_cards`/`manufacturing_tooling`/`machine_downtime` it depends entirely on the DB policy being present.

---

## P1 Findings

### P1-1 — Document numbering is race-prone and, for dispatch/job cards, not uniqueness-protected

| Generator | Implementation | Risk |
|---|---|---|
| `generateNextDispatchNumber` | `select dispatch_no order by dispatch_no desc limit 1` then `parseInt+1` | read-modify-write; two concurrent creates produce the same `DO-####`; no org-scoped unique index in repo |
| `generateNextJobCardNumber` | RPC `generate_job_card_no`, with a client-side fallback that uses `order by created_at desc limit 1` + `parseInt` | same, and the fallback silently changes the numbering source |
| `generateRequisitionNumber` / `generateInquiryNumber` (purchase side, used by manufacturing stores flows) | row-count based | duplicates after deletions |
| `purchase_orders(organisation_id, po_number)` | unique index added by `20260912000000_document_number_unique_indexes.sql` | **good** — but callers that generate the number client-side will now surface raw `23505` errors |

### P1-2 — Aggregate creates are not atomic

- `createDispatchOrderAggregate` (`repository/dispatchRepository.ts`): generate number → `INSERT dispatch_orders` → `INSERT dispatch_items`. A failure on items leaves a dispatch order with no lines that still owns a consumed `DO-` number and appears in the dispatch list.
- `createJobCardAggregate` (`repository/jobCardRepository.ts`): job card insert → job card materials insert, no transaction.
- BOM editor paths write `bom_headers` and `bom_items` separately. `bom_items.parent_item_id` (migration `015_bom_item_hierarchy`) makes a partially written BOM structurally invalid.

For job cards this is not cosmetic: stores issuance (`issue_job_card_materials`), QC (`ipqc_checkpoints`) and costing snapshots all read the parent, so an orphaned header with missing materials can be picked up by downstream automation.

### P1-3 — Confirm-dispatch can report failure after inventory has moved

`confirmDispatchAggregate` calls the atomic RPC `dispatch_manufacturing_order_atomic`, re-reads the order, then inserts an activity-log row. If the log insert fails (e.g. policy/drift), the mutation rejects and the UI shows an error even though **stock has already been decremented**. The status guard (`status === 'dispatched'` → throw) then makes a retry a hard error rather than an idempotent replay — correct for safety, confusing for the operator, and there is no "already dispatched" success path.

### P1-4 — Missing column migrations for the module's own tables

`20240101000096_production_schedule_items.sql`, `..._098_fix_production_schedules_columns.sql`, `..._102_add_job_cards_missing_columns.sql`, `..._103_add_production_entries_missing_columns.sql`, `..._104_add_production_entries_extended_fields.sql` are **0 bytes**, as is `20240101000100_add_outward_missing_columns.sql`. The persistence layer writes fields introduced by exactly these migrations (e.g. production entry extended fields, job card columns). In a fresh environment the module cannot be reproduced; in production the schema exists only because it was changed by hand.

---

## P2 Findings

1. **Legacy duplicate implementation still reachable.** `App.tsx:576-591` routes `/manufacturing-v0/*` to `pages/manufacturing-v0/*` (6 files: shell, BOM list/editor, job card list/create/detail, production entry form) in parallel with the v2 shell. Two implementations of the same screens double the audit and regression surface (§24/§29).
2. **Validation exists but is never used.** `features/manufacturing/validation/bomSchemas.ts` (zod) is imported by **nothing**; only its own test imports it. So BOM quantity/yield/cost validation is not enforced in the UI, and the repository contains no CHECK constraints for those fields either (§21). Note: this is one of the few test files in the module — `bomSchemas.test.ts`, 5 tests, **PASS** as executed for this audit.
3. **Two parallel data-access styles.** `features/manufacturing/persistence/*` and page-level `supabase` calls in `pages/manufacturing/*` (e.g. `IPQCDashboard.tsx`, `QCInspectionCreate.tsx`, `GRNCreate.tsx`, `IPQCCheckpointConfig.tsx`) read the same tables with different projections and different query keys → duplicate requests and cache collisions (§14/§16).
4. **Projection and payload.** `select('*')` with nested embeds (`material_requisitions(*, job_cards(job_card_no, bom_headers(product_name)))`, `goods_receipt_notes(*)`, `dispatch_orders(*)`) and no pagination anywhere in the feature layer (§15/§27). The machine board then fetches `*` again for `job_cards`.
5. **Duplicate activity logging.** Three DB loggers (`log_job_card_activity`, `log_production_entry_activity`, `log_schedule_activity`) plus a client-side `insertActivityLog` writer, plus `Pages/manufacturing/ActivityLog.tsx` reading them — with no unified contract.
6. **Inventory-report aggregates computed client-side.** `pages/manufacturing/InventoryReport.tsx` (1,132 lines) and `inventory/WIPValuationReport.tsx` build valuation views in the browser from stock/lot rows rather than from a DB view, so figures will diverge from the GL postings (`post_manufacturing_inventory_gl`) as volume grows.
7. **Migrations 003–018 exist in two places** — `apps/web/src/supabase/migrations/*` (003–018, treated as applied by 011/012 references) and `apps/web/supabase/migrations/*` (013–018 with the same numbers) → ambiguous provenance for manufacturing schema changes (§28).

---

## P3 Findings

1. Stale artefacts at repository root and in the app: `nul`, `C:Usersadminmep-projectCreateQuotation_old_commit.tsx`, `apps/web/src/index.css.checkpoint.bak` (58 KB, June), `apps/web/_served_view.js` (473 KB, August), `apps/web/src/pages/BOQ.backup.tsx` (104 KB, April), `apps/web/src/pages/SiteVisits.tsx.backup2`. Flagged only (§29).
2. `pages/manufacturing/BOMEditor.tsx` (1,874 lines) and `pages/manufacturing-v0/BOMEditor.tsx` (657) carry overlapping BOM logic.
3. `CustomUnits.tsx` / `CustomFields.tsx` write into generic custom-field tables shared with other modules; ownership model is GLOBAL vs TENANT-OWNED is undocumented for them.

---

## Database & Security

| Check | Result |
|---|---|
| Tenancy model declared | Partially: BOM/job card/production tables are tenant-owned with `organisation_id NOT NULL REFERENCES organisations(id)` and proper per-operation policies (`src/database-manufacturing.sql`); the 12 gap-feature tables are tenant-owned by column but **unprotected by policy** |
| `work_centers` | Correct org-scoped policy (`011_work_centers_rls.sql`) — this is the model the other 12 should follow |
| `job_cards` / `production_entries` / `bom_*` | Correct per-operation policies (`org_isolation_select/insert/update/delete`) |
| Costing tables (`bom_routing_operations`, `bom_cost_lines`, `item_standard_costs`, `standard_cost_calculation_runs`, `job_card_cost_variances`) | RLS enabled (015–020); policies not shown as org-scoped in those files — verify before relying on them |
| Authorization helper | Mixed: manufacturing relies on inline `organisation_id IN (SELECT organisation_id FROM org_members ...)`; the rest of the ERP uses `user_can_access_org`. Two mechanisms for the same purpose (§7/§9 of the standard: use the established mechanism) |
| RPC security | `013_manufacturing_v2_hardening.sql` (`accept_grn`, `release_fg_after_qc`) documents `FOR UPDATE` locking + idempotency — good; verify each RPC's `SECURITY DEFINER`, `search_path` and tenant check |
| Immutability | `022/023` add release/snapshot immutability triggers on `job_cards` — good |
| Indexes | Present for status/org on job cards and dispatch tables; the gap-feature tables rely on the same indexes as the mobile `select('*')` scans |

---

## Query & Cache

| Check | Result |
|---|---|
| Query keys tenant-scoped | Feature-layer hooks include `organisation?.id` in page-level keys (e.g. `['active-job-cards-ipqc', organisation?.id]`); feature `persistence` functions take `orgId` as an argument and rely on the caller's key |
| Organisation switch | Not uniformly guaranteed — keys are correct where inspected, but mobile has no org filter at all and no `enabled` guard |
| Polling | None in the manufacturing feature layer (machine board is manual refresh) |
| Invalidation | Page-level mutations invalidate precise keys (good); feature-layer repository functions invalidate nothing (page must remember) |
| Projection | `SELECT *` dominates; several pages re-fetch the same parents |
| N+1 | `storesPersistence.fetchMaterialRequisitionItems` is called per requisition in some flows; QC dashboard resolves parameters per checkpoint |

---

## Frontend Architecture

The intended layering is present and unusually explicit for this codebase:

```text
pages/manufacturing/*  →  features/manufacturing/hooks  →  features/manufacturing/repository
                        →  features/manufacturing/persistence  →  supabase
```

with a `model/` domain layer and a `validation/` layer. That is the §24 target structure. The gaps are: page-level `supabase` calls that bypass the repository layer, a `procurement/` repository that overlaps the Purchase module, and the abandoned `manufacturing-v0` tree. `pages/manufacturing/InventoryReport.tsx` (1,132) and `BOMEditor.tsx` (1,874) are the two components that combine data access, business rules and heavy UI.

---

## Business Integrity

| Workflow | Finding |
|---|---|
| BOM create/revision | Header + items written separately; revision RPC exists (`create_bom_revision`) — prefer it |
| Job card release → material issue | Uses RPCs (`issue_job_card_materials`, `return_job_card_materials`) — correct pattern |
| Production entry | Client-side header + items writes; extended fields depend on 0-byte migrations |
| GRN accept | `accept_grn` RPC with locking + idempotency — correct |
| QC release | `release_fg_after_qc` RPC with multi-warehouse routing — correct |
| Dispatch create | Non-atomic aggregate, race-prone number |
| Dispatch confirm | Atomic RPC, but post-RPC logging can fail the request |
| WIP valuation / costing | Client-side reports vs GL postings; no reconciliation surface |

---

## Migration Integrity

| Object | Repository migration | Status |
|---|---|---|
| `bom_*`, `job_cards`, `production_entries`, `job_card_materials` | `src/database-manufacturing.sql` (ad-hoc) | Not in applied migration history |
| Warehouse chain (bins, transfers, picking, cycle count) | `003–010` in `src/supabase/migrations` | Duplicated numbering with `apps/web/supabase/migrations` |
| Gap-feature tables | `20260730_manufacturing_gap_features.sql` | Applied, but with permissive policies and no `DROP POLICY IF EXISTS` |
| Production schedule / job card / production entry columns | `096–104` | **0 bytes** |
| Manufacturing v2 + costing hardening | `013–023` | Present and substantive |

---

## Runtime Verification

| Test | Result |
|---|---|
| Load | NOT VERIFIED |
| Search | NOT VERIFIED |
| Filter | NOT VERIFIED |
| Create (BOM / job card) | NOT VERIFIED |
| Edit | NOT VERIFIED |
| Primary workflow (job card → issue → production → QC → dispatch) | NOT VERIFIED |
| Secondary workflow (GRN accept → RM QC → stores) | NOT VERIFIED |
| Delete / cancel | NOT VERIFIED |
| Export (inventory / WIP report) | NOT VERIFIED |
| Organisation switch | NOT VERIFIED |

No credentials or test tenants were available. The §33 matrix must be executed against the 12 tables listed in P0-1 as the first acceptance test after remediation.

---

## Build Verification

```text
TypeScript:  NOT RUN (full `tsc --noEmit` exceeded 10 minutes in this environment; no code changes made)
Lint:        NOT RUN
Web build:   NOT RUN
Tests:       PARTIAL — `vitest run src/features/manufacturing/validation/bomSchemas.test.ts` → PASS (5/5 tests, 4.2s)
Mobile build: NOT RUN
Capacitor sync: NOT RUN
```

---

## Remaining Issues

**Blocking**

- P0-1 (no tenant boundary on 12 tables; unverifiable-in-production caveat applies but nothing in the repo closes it).

**Non-blocking**

- P1-1 … P1-4; all P2/P3 items.

---

## Final Status

```text
FAIL
```

The module is architecturally the most disciplined of the four reviewed (explicit layer separation, atomic RPCs for the high-risk stock movements, idempotency in the GRN/QC gates) but it fails the standard's first requirement: tenant isolation is enforced in the database for most manufacturing tables and **not at all** for the twelve most recently added ones.

---

## Suggested Remediation Order (for the follow-up "audit and fix" pass — not performed here)

1. Replace all 12 `USING (true)` policies with the `work_centers` pattern (or `user_can_access_org`) using `DROP POLICY IF EXISTS` + `CREATE POLICY ... TO authenticated`, in a single forward migration.
2. Move every document-number generator into an org-scoped sequence/RPC and add unique indexes per `(organisation_id, <number>)`.
3. Wrap the four remaining multi-write flows (dispatch create, job card create, BOM save, production entry save) in RPCs; make post-RPC activity logging non-fatal.
4. Delete `pages/manufacturing-v0` and its routes, and commit the 0-byte column migrations.
5. Enforce `bomSchemas` at the editor boundary and add the matching CHECK constraints.
