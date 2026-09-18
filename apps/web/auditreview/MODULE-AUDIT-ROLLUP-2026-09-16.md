# ERP MODULE AUDIT — ROLLUP & CROSS-CUTTING FINDINGS

> **⚠ SUPERSEDED 2026-09-16 — read `MODULE-AUDIT-LIVE-DB-VERIFICATION-2026-09-16.md` first.**
> This report was written from the repository only. The linked Supabase project (`rujqejtisqermjyqqgoj`, the same one `apps/web/.env.local` points at) refutes most of the database findings below: `rls_disabled_in_public` and `rls_enabled_no_policy` are **zero**, only 11 public tables lack an org token in any policy, and `user_can_access_org` **does** exist. The P0 verdicts for Communication, Manufacturing and Purchase therefore rest on invalid evidence. Still true: the Follow-Up activity-log vocabulary rejection and the `recalc_vendor_balance` no-op. The live report adds confirmed defects the repository could not reveal (browser-visible 404s on routed pages).

**Standard:** `MODULE_REFERENCE_PATTERN.md` (audit-only mode, §36 — nothing was modified or fixed).
**Date:** 2026-09-16
**Modules audited:** Communication Log · Follow-Up Centre · Manufacturing · Purchase
**Individual reports:** `MODULE-AUDIT-COMMUNICATION-LOG-2026-09-16.md`, `MODULE-AUDIT-FOLLOW-UP-CENTRE-2026-09-16.md`, `MODULE-AUDIT-MANUFACTURING-2026-09-16.md`, `MODULE-AUDIT-PURCHASE-2026-09-16.md`

---

## Executive Status

| Module | Status | Blocking findings |
|---|---|---|
| Communication Log | **FAIL** | No tenant boundary on `client_communication`; unprotected child table + security-definer view; `notifications` with RLS never enabled; Quick Lookup write path violates its own CHECK constraint |
| Follow-Up Centre | **FAIL** | Schema + RLS outside migration history; RLS depends on an undefined `user_can_access_org`; `follow_up_procurement_tracking` created nowhere; activity-log vocabulary rejected by the DB constraint |
| Manufacturing | **FAIL** | 12 tables (`dispatch_*`, `goods_receipt_notes`, `grn_items`, `material_requisitions*`, `*qc*`) carry `FOR ALL USING (true) WITH CHECK (true)` with no later migration replacing them |
| Purchase | **FAIL** | `purchase_orders`, `purchase_order_items`, requisitions, availability inquiries and `purchase_audit_log` have no policy anywhere; inventory is deducted from the browser; `recalc_vendor_balance` is a no-op; client-side approval fallback |

No module reached `PASS` or `PASS WITH WARNINGS`.

---

## Method & Evidence Limits

- The audit is **static and repository-scoped**: schema, RLS, RPCs, queries, mutations, cache, architecture and migration history were inspected in the repository.
- ~~**No production database, test tenants, credentials or running app were available.**~~ **Corrected:** the linked production database *was* reachable through `supabase db query --linked` / `db advisors` / `gen types`, and was read in `MODULE-AUDIT-LIVE-DB-VERIFICATION-2026-09-16.md`. No signed-in user session or second tenant was available, so §32/§33 runtime tests remain NOT VERIFIED. Where this report conflicts with the live report, the live report wins. Therefore:
  - every DB finding is stated as *"as represented in the repository"*;
  - §32 runtime tests and §33 multi-tenant tests are reported as **NOT VERIFIED**, not PASS/FAIL;
  - where production may already differ, the report says so and the verification SQL below is provided.
- `tsc --noEmit` for `apps/web` exceeded 10 minutes in this environment and was not completed; it is reported as **NOT RUN** in every report (no code was changed, so this is not a regression signal — it is an uncompleted verification).
- Only manufacturing has a touchable test: `vitest run src/features/manufacturing/validation/bomSchemas.test.ts` → **PASS (5 tests)**.

---

## Cross-Cutting Root Causes

These four issues explain most of the individual findings and are worth fixing as *platform* work rather than module-by-module.

### RC-1 — Repository migration history does not represent the production database

`apps/web/supabase/migrations` holds **205 files, of which 149 are 0 bytes**.

```bash
find apps/web/supabase/migrations -maxdepth 1 -type f -size 0 | wc -l   # 149
```

Every module audited is affected:

| Module | 0-byte migrations |
|---|---|
| Communication Log | `20240101000111_communication_subject_followup.sql` (and nothing else exists at all) |
| Follow-Up Centre | `20240101000067_follow_up_centre.sql`, `..._068_follow_up_assignee.sql`, `..._069_follow_up_quotation_workflow.sql` |
| Purchase | `00008`, `00015`, `00075`, `00077`, `00078`, `00079`, `00080`, `00081`, `00084` |
| Manufacturing | `00096`, `00098`, `00100`, `00102`, `00103`, `00104` |
| (Platform-wide) | `00059_fix_org_membership_check`, `00085_add_org_member_rpc`, `00094_fix_user_can_access_org`, `00135_fix_rls_auth`, the whole `00131–00151` tools-management / debug / test-scaffolding series, plus most of `00001–00130` (invoices, materials, ledger, RBAC, quotes, site visits) |

Consequence: for four modules it is impossible to reconstruct the schema, RLS or functions from history; a fresh environment cannot reproduce them; and every audit (including this one) must reason about ad-hoc scripts (`apps/web/src/*.sql`, `apps/web/sql/*`) whose execution order is unknown.

### RC-2 — The canonical authorization helper is not in the repository

`public.user_can_access_org(...)` is referenced by RLS policies and RPC guards in purchase (AP), follow-up centre, credit/debit notes, quotations, invoices, site visits, billing and the zero-trust migration series — **14 repository files reference it; zero define it**. The migration named after it, `20240101000094_fix_user_can_access_org.sql`, is 0 bytes.

Two other helpers coexist:

- `public.current_org_id()` (defined in four ad-hoc files, returns a single org — the *first* active `org_members` row, which is exactly wrong for multi-org users);
- inline `organisation_id IN (SELECT organisation_id FROM org_members WHERE user_id = auth.uid())` inside manufacturing and work-centre policies.

§7 requires one established mechanism. Today there are three, and the most-used one is unauditable. **This is the single highest-leverage fix in the project.**

### RC-3 — Hardening was applied per module, not per table

The August 2026 hardening series (`20260817000000…000005`, `202608180000001…3`) replaced `USING (true)` with `user_can_access_org` for invoices, payments/AR, credit/debit notes, purchase AP and quotations. But:

- Purchase orders, order items, requisitions, requisition lines, availability inquiries/lines/responses and the purchase audit log were **never covered**;
- The 12 manufacturing gap-feature tables were created with `USING (true)` on 2026-07-30, i.e. **before** the August hardening series — the series scoped itself to finance/AP/AR/quotation/invoice modules and simply left them (and every later check that would have caught them) untouched;
- Communication and follow-up were never covered at all.

There is no repository-wide inventory that would have surfaced the omission. A policy-coverage check (§39 proposal below) makes this class of miss impossible to repeat.

### RC-4 — Ad-hoc "one-shot" scripts that cannot be re-applied

The module scripts create policies without `DROP POLICY IF EXISTS` (e.g. `20260730_manufacturing_gap_features.sql:249-260`, `src/database-purchase-module.sql`), overwrite each other's function bodies (see RC-5), and mix schema with seed/backfill (`database-follow-up-centre.sql` §9 re-runs its backfill on every execution). Nothing in the repository tells an operator which script owns which table.

### RC-5 — Two regressions introduced *by* security work

1. `recalc_vendor_balance` — the hardened version (20260817000004) computes the balance and returns without persisting it, replacing a working version. Vendor outstanding is now wrong.
2. `user_can_access_org` — the migration that was supposed to fix it is empty, so the policies that depend on it may have been created loosely (or the function may exist only as a hand-edited production object).

Both are invisible without the kind of side-by-side definition comparison this standard's "verify, don't assume" rule requires.

---

## Consolidated Finding Counts

| Severity | Communication | Follow-Up | Manufacturing | Purchase |
|---|---|---|---|---|
| P0 | 3 | 0 (see note) | 1 | 2 |
| P1 | 5 | 5 | 4 | 5 |
| P2 | 9 | 7 | 7 | 12 |
| P3 | 3 | 3 | 3 | 4 |

Note: Follow-Up Centre's P1-2 (undefined RLS helper) becomes P0 if production lacks a strict `user_can_access_org`. Verify with the SQL below before treating it as non-blocking.

---

## The Same Three Deficiencies Appear in Every Module

1. **Tenant isolation is enforced in the frontend, not the database**, for at least **23 tables** across the four modules (`client_communication`, `client_communication_entries`, `notifications`, the 12 manufacturing tables, `purchase_orders`, `purchase_order_items`, requisitions/lines, availability inquiries/lines/responses, `purchase_audit_log`).
2. **Multi-step business operations are executed as a sequence of independent HTTP calls** from the browser: communication create (site visit + record + issue + uploads), quotation response (tracking + header + 2 logs), dispatch create, job card create, BOM save, PO update/delete, requisition create/update/delete, availability→PO conversion, store fulfilment. Only the AP document RPCs and the manufacturing stock RPCs are transactions.
3. **Financial/inventory state is sometimes computed in the browser**: inventory deduction (`fulfillFromStoreLine`), approval level transitions (requisition fallbacks), GST totals, vendor balances, WIP valuation, escalation/collection-risk thresholds.

---

## Production Verification SQL (run before acting on any P0)

```sql
-- 1. Which of the audited tables still have no tenant predicate?
select schemaname, tablename, policyname, cmd, qual, withcheck
from pg_policies
where tablename in (
  'client_communication','client_communication_entries','notifications',
  'dispatch_orders','dispatch_items','dispatch_packing','dispatch_count_verification',
  'qc_parameters','fg_qc_inspections','qc_parameter_results',
  'material_requisitions','material_requisition_items',
  'goods_receipt_notes','grn_items','rm_qc_inspections',
  'purchase_orders','purchase_order_items','purchase_requisitions','purchase_requisition_lines',
  'availability_inquiries','availability_inquiry_lines','availability_responses','purchase_audit_log'
)
order by tablename, policyname;

-- 2. Which audited tables are not protected at all?
select relname as table_without_rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity = false
  and relname in ('notifications','client_communication','client_communication_entries',
                  'purchase_orders','purchase_requisitions','availability_inquiries')
order by 1;

-- 3. Does the canonical authorization helper exist, and is it strict?
select p.proname, pg_get_functiondef(p.oid)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('user_can_access_org','current_org_id','is_org_admin');

-- 4. Which follow-up / communication tables exist at all?
select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and relname like 'follow_up%' or relname like 'client_communication%'
order by 1;

-- 5. Is the vendor balance function still a no-op?
select pg_get_functiondef(p.oid)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'recalc_vendor_balance';

-- 6. Migration bookkeeping consistency
select version, name from supabase_migrations.schema_migrations order by version desc limit 40;
```

Then execute the §33 matrix (Tenant A → Tenant A vs Tenant A → Tenant B) for SELECT/INSERT/UPDATE/DELETE on the tables returned by query 1, and the §13 organisation-switch test in the UI for all four modules.

---

## Proposed Updates to the Standard (§39)

The audit surfaced four checks that the standard does not yet state explicitly. Recommend adding them to `MODULE_REFERENCE_PATTERN.md`:

1. **Migration provenance rule** — *"A module is not production-auditable unless its tables, policies, functions and RPCs are created by applied migrations inside `apps/web/supabase/migrations`. 0-byte placeholder migrations are findings of at least P1."*
2. **Authorization-helper registry** — the standard should name the canonical helper and forbid new mechanisms; audits must grep the repository for the helper definition and confirm it is reviewable (not an opaque production object).
3. **Policy coverage inventory** — require a machine-checkable list of `(table, policy, predicate)` derived from the repository, so modules hardened in one pass cannot be silently missed in the next.
4. **Fallback rule** — *"Client-side fallbacks for server-validated operations (approvals, payments, stock) are P1 minimum; a fallback predicate that matches authorization error strings is P0."*

---

## Recommended Delivery Plan (for the follow-up "audit and fix" pass — not performed here)

| Priority | Work | Scope |
|---|---|---|
| 1 | Recover and commit `user_can_access_org` (+ the three other 0-byte auth migrations) as reviewed, forward migrations | platform |
| 2 | Forward migration: tenant policies for the 23 unprotected tables, using `DROP POLICY IF EXISTS` + `TO authenticated` + USING/WITH CHECK | platform |
| 3 | `notifications` RLS; `client_communication_entries` org column/composite-FK; recreate the communication view with `security_invoker = true` | communication |
| 4 | Fix `recalc_vendor_balance` persistence + backfill; re-verify against the vendor ledger | purchase |
| 5 | Replace `fulfillFromStoreLine` with a locked, ledger-writing RPC | purchase |
| 6 | Delete client-side approval/release fallbacks; delete or fix disabled-but-rendered mutation hooks | purchase |
| 7 | Atomic RPCs for communication create, quotation response, dispatch/job-card/BOM create, PO update/delete, requisition CRUD, availability→PO | all four |
| 8 | Commit the 0-byte manufacturing/purchase column migrations or re-derive them from production | manufacturing, purchase |
| 9 | Constraint alignment: follow-up activity vocabulary, communication `entry_type='Briefing'`, communication status/priority enums | follow-up, communication |
| 10 | Cleanup: delete `pages/manufacturing-v0`, `PurchaseOrdersV2`/`DebitNoteViewV2` duplicates, stale `.backup`/`nul` artefacts | all |

---

## Overall Final Status

```text
FAIL — across all four modules
```

The audit confirms the premise stated in the standard: longevity and newer coding style are not evidence of correctness. The AP/payment RPCs, the manufacturing stock RPCs and the follow-up cache discipline show the project already contains the right patterns — they are simply not applied consistently, and the two layers that matter most (database tenancy and transactional business operations) are the least consistent.
