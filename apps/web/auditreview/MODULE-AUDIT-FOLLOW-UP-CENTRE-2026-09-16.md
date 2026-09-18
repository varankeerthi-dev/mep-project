# FOLLOW-UP CENTRE — Production Audit Report

> **⚠ CORRECTED 2026-09-16 — see `MODULE-AUDIT-LIVE-DB-VERIFICATION-2026-09-16.md`.**
> Two of the three headline claims are wrong against the live project: all five `follow_up_*` tables exist with org-scoped RLS, correct CHECKs and the unique indexes the upserts need, and `user_can_access_org` **is** defined (`SECURITY DEFINER`, `search_path=public`). `follow_up_procurement_tracking` is **not** missing. The remaining claim is **confirmed live and is the module's real defect**: the activity-log CHECK accepts only 6 event types and 4 tabs, while the code writes `quotation_status_changed`, `invoice_edited`, `approval_status_changed` and `procurement_reminder_sent` / tab `procurement`, and the write path then throws after the tracking row is already written. The verdict stays FAIL, on that ground alone.

**Standard:** `MODULE_REFERENCE_PATTERN.md` (audit-only mode, §36).
**Date:** 2026-09-16
**Scope:** Follow-Up Centre — priority queue, quotation / PO-DC / invoice / procurement follow-up tabs, activity log, assignment, lead overlay.
**Evidence basis:** repository only — **superseded**: the live database was subsequently read (see `MODULE-AUDIT-LIVE-DB-VERIFICATION-2026-09-16.md`).

---

## Executive Status

```text
FAIL
```

The module's RLS depends on a database function that does not exist anywhere in the repository, one table the module writes is created by no script at all, and the activity-log write path violates the only CHECK constraint that exists for it.

---

## Module Inventory

| Area | Findings |
|---|---|
| Pages | `pages/FollowUpCentre.tsx` (1,318 lines) |
| Components | `components/follow-up/*` — 17 components (filter bar, tabs, 6 row/card types, virtualized shell, assignee select, escalation badge, reminder action sheet, item history drawer, activity log item, mobile bottom actions) |
| Hooks | `hooks/use-followup-data.ts` (queries + mutations), `use-followup-access.ts` (role gate), `use-followup-assignees.ts`, `use-followup-filters.ts`, `use-followup-search.ts`, plus `use-invoice-escalation.ts`, `use-item-history.ts`, `use-leads.ts` |
| Lib | `lib/followup/*` — escalation engine, priority queue, quotation workflow, whatsapp builder, formatters, utils, currency/date format, motion |
| API | `follow-up/api.ts` (625), `follow-up/leads-api.ts` (522) |
| Database tables | `follow_up_activity_log`, `follow_up_quotation_tracking`, `follow_up_podc_backlog`, `follow_up_invoice_tracking`, **`follow_up_procurement_tracking` (missing)**, plus reads of `quotation_header`, `invoices`, `purchase_orders`, `delivery_challans`, `leads` |
| RPCs | `follow_up_log_activity` (SECURITY DEFINER, guarded), plus `user_can_access_org` referenced by all policies |
| Integrations | Procurement (PO follow-up), invoicing, quotations, leads cadence, WhatsApp share, item history |
| Exports | none (CSV/PDF handled elsewhere) |
| Mobile | **none** — web only |
| Repository migrations | `20240101000067_follow_up_centre.sql`, `..._068_follow_up_assignee.sql`, `..._069_follow_up_quotation_workflow.sql` are **0-byte placeholders**; the only real definition is the ad-hoc `apps/web/src/database-follow-up-centre.sql` |

---

## P0 Findings

None established from repository evidence. Whether P1-2 is P0 depends on the production state of `user_can_access_org` — see the verification queries in the rollup report. If that function is missing or permissive in production, every follow-up table is unprotected and P1-2 must be re-classified immediately.

---

## P1 Findings

### P1-1 — The module's schema and RLS live only in an ad-hoc script

`apps/web/src/database-follow-up-centre.sql` opens with:

```
-- Identical to: supabase/migrations/051_follow_up_centre.sql
```

No `051_follow_up_centre.sql` exists in either `apps/web/src/supabase/migrations` or `apps/web/supabase/migrations`, and the placeholder migration intended to carry it (`20240101000067_follow_up_centre.sql`) is empty. Consequently:

- the module's four tables, six policies, two indexes sets, RBAC permission rows, backfill and RPC are **not part of applied migration history** (§28);
- a fresh environment cannot reproduce the module;
- `docs/follow-up-centre/SUPABASE_SETUP.md` instructs operators to run a script that no longer matches any migration.

### P1-2 — RLS depends on an undefined authorization function

All eight policies in the ad-hoc script call `public.user_can_access_org(organisation_id)`:

```sql
CREATE POLICY follow_up_quotation_all ON public.follow_up_quotation_tracking
  FOR ALL TO authenticated
  USING (public.user_can_access_org(organisation_id))
  WITH CHECK (public.user_can_access_org(organisation_id));
```

Repository-wide there are **14 references and zero definitions** of `user_can_access_org`:

- the migration whose name says it defines it — `apps/web/supabase/migrations/20240101000094_fix_user_can_access_org.sql` — is **0 bytes** (as are `20240101000059_fix_org_membership_check.sql`, `20240101000085_add_org_member_rpc.sql`, `20240101000135_fix_rls_auth.sql`, all 0 bytes);
- the function is invoked by ~100 call sites across purchase, credit/debit notes, quotations, invoices, site visits and manufacturing costing, so its behaviour is a project-wide dependency.

Consequences per §8: the tenant predicate **cannot be inspected** → cannot be proven free of column/variable shadowing or tautology, and cannot be proven to check the right membership table (`org_members` vs `user_organisations`, the exact bug class fixed elsewhere in this repo by `database-fix-approvals-rls.sql`).

### P1-3 — `follow_up_procurement_tracking` is written and joined but never created

`follow-up/api.ts` uses the table in three places:

- `recordProcurementReminder` (line 497) — upsert by `(organisation_id, po_id)`;
- `assignFollowUpOwner` (line 549) — upsert;
- `fetchFollowUpProcurement` (line 578) — embedded select `tracking:follow_up_procurement_tracking(last_reminder_at, contact_phone, assignee_user_id)`.

No SQL file in the repository creates it (`database-follow-up-centre.sql` creates only the other three tracking tables). The Procurement tab therefore fails on load in any environment where the table was not created by hand (`PGRST205` schema-cache / `42P01`).

The codebase already anticipated this class of failure — `isFollowUpSchemaError()` exists in `follow-up/api.ts:73` — but it is **exported and never called anywhere** (`grep` finds exactly one match, the definition). There is no graceful degradation and no user-visible explanation.

### P1-4 — The activity-log vocabulary exceeds the DB CHECK constraint, and the failure is thrown after the state change

`types/followup.ts:76-88` defines:

```ts
export type ActivityEventType =
  | 'quotation_reminder_sent' | 'quotation_response_logged' | 'quotation_status_changed'
  | 'quotation_expired' | 'podc_pack_shared' | 'podc_issue_flagged'
  | 'invoice_reminder_sent' | 'invoice_escalation_changed' | 'invoice_edited'
  | 'invoice_finalized' | 'procurement_reminder_sent';
```

The only DB definition restricts it (`database-follow-up-centre.sql:19-26`):

```sql
event_type CHECK (event_type IN ('quotation_reminder_sent','quotation_response_logged',
  'podc_pack_shared','podc_issue_flagged','invoice_reminder_sent','invoice_escalation_changed')),
tab_source CHECK (tab_source IN ('quotation','podc','invoice','activity'))
```

The application sends `quotation_status_changed` (api.ts, the normal path for every quotation response logged), `procurement_reminder_sent`, and `tab_source: 'procurement'`. Those inserts raise `23514`.

Worse, `logActivity()` throws when the RPC fails *and* when the fallback insert fails, and `upsertQuotationResponse()` calls it **after** the tracking upsert and the `quotation_header.status` update have already committed. Result: the follow-up status is changed, then the mutation reports an error, and the user retries a transition that the workflow guard may now reject.

### P1-5 — Quotation response is written to two independent sources without a transaction

`follow-up/api.ts:318-390`, `upsertQuotationResponse()`:

```text
1. SELECT existing tracking status
2. UPSERT follow_up_quotation_tracking (status + notes)
3. UPDATE quotation_header SET status = <mapped db status>
4. RPC follow_up_log_activity × 2
```

Four independent round trips, no transaction, no idempotency key, no optimistic-concurrency guard. Steps 2 and 3 can diverge permanently (tracking says `lost_to_competitor`, `quotation_header` still `Sent`), and the two sources are read by different modules — the Follow-Up Centre renders the overlay, quotation screens read the header. §19/§25.

---

## P2 Findings

1. **Client-side approval of a protected helper.** `logActivity()` (api.ts:266-290) falls back to a direct `insert` into `follow_up_activity_log` when the RPC fails, with a client-supplied `actor_name` and `organisation_id`. The RPC is `SECURITY DEFINER` and validates `user_can_access_org`; the fallback bypasses that gate and lets the caller claim any actor name (§20).
2. **Unbounded fetch + client-side filtering.** Every fetch uses `.limit(500)` and the filtering/scoring happens in `lib/followup/*` over the full arrays. The priority queue is computed in the browser from five full lists on every filter change (§27).
3. **Assignment is spread across four storage locations** (three tracking tables + PODC backlog) with four different write paths and a duplicated `'quotation' | 'podc' | 'invoice' | 'procurement'` union. `useAssignFollowUp` (hooks) accepts only three of the four, while `follow-up/api.ts` supports `procurement` — the capability is inconsistent between layers (§14).
4. **RBAC is UI-only.** `database-follow-up-centre.sql` seeds `follow_up.read` / `follow_up.manage`, but the `/follow-up` route in `App.tsx:530` is **not** wrapped in `PermissionGuard` (unlike `/warehouse`, `/work-completion`), and `use-followup-access.ts` merely hides controls based on `organisations[].role`. A read-only user can still call every write endpoint directly.
5. **Silent failures in mutation paths.** `recordQuotationReminder` and `assignFollowUpOwner` call `.upsert(...)` and **never inspect the returned error**; failures are invisible to the user even though the subsequent activity log may succeed, producing a log entry for a reminder that was never recorded (§26).
6. **No mobile implementation.** The module is web-only while its inputs (client calls, PO delivery dates) are exactly the mobile use case. `apps/mobile` has no follow-up screen; the mobile ClientLookup writes `link: '/follow-up'` notifications that mobile users cannot open.
7. **Optimistic updates without tenant guard.** `useLogQuotationResponse` / `useFlagPodcIssue` implement `onMutate` cache writes keyed by the current `orgId` and roll back on error — correct in the normal case, but a mutation started before an organisation switch resolves against the *old* key while the UI shows the new org.

---

## P3 Findings

1. `types/followup.ts` includes tabs `'queue'` and `'lead'` that the activity-log CHECK constraint cannot store; the divergence is intentional in the types but undocumented.
2. `docs/follow-up-centre/SUPABASE_SETUP.md` references the non-existent migration 051.
3. The procurement follow-up type declares five statuses (`pending_inquiry`, `po_draft`, `pending_delivery`, `delayed`, `completed`) that are assumed from `purchase_orders.status` with no mapping table, so PO statuses stored by purchase (Draft/Approved/Sent/…) render as the first union member by cast (`api.ts:600`).

---

## Database & Security

| Check | Result |
|---|---|
| Tenancy model | Tenant-owned, `organisation_id NOT NULL REFERENCES organisations(id) ON DELETE CASCADE` (good, in the ad-hoc script) |
| RLS enabled for all four tables | Yes (in the ad-hoc script) |
| Policy matrix | SELECT for `authenticated` on all four; `FOR ALL` (USING + WITH CHECK) on quotation/podc/invoice tracking; **no UPDATE/DELETE policy on `follow_up_activity_log`** (append-only by design — acceptable, but it means `recordPodcPackShared` and friends depend on INSERT only, which is correct) |
| Tenant predicate inspectable | **No** — depends on undefined `user_can_access_org` |
| Unique constraints | `UNIQUE (organisation_id, quotation_id)` and `UNIQUE (organisation_id, invoice_id)` — good; the procurement tracking table has none because it does not exist |
| Child/overlay tables | `follow_up_*_tracking` are overlays on `quotation_header` / `invoices` / `purchase_orders`; nothing enforces that `tracking.organisation_id` equals the parent document's organisation. A user who can write one tenant's tracking row could point it at another tenant's `quotation_id` UUID if RLS ever regresses |
| FKs | `quotation_id`, `invoice_id`, `delivery_challan_id`, `created_by`, `actor_id` present; `assignee_user_id` FK is not declared (`database-follow-up-centre.sql` adds no FK, and the assignee migration is empty) |
| Helper RPC | `follow_up_log_activity` — `SECURITY DEFINER`, `SET search_path = public`, explicit `user_can_access_org` check, `GRANT EXECUTE ... TO authenticated`: this is the correct pattern and should be copied by the other ERP modules |
| Backfill safety | The PODC backfill `INSERT ... SELECT` uses `NOT EXISTS` (idempotent) — good; but it is part of the same script as the DDL, so a re-run re-executes it |

---

## Query & Cache

| Check | Result |
|---|---|
| Query keys tenant-scoped | **PASS** — every hook uses `['follow-up', <domain>, orgId]` and `enabled: !!orgId` |
| Organisation switch | **PASS by construction** — keys change with the org, and the previous org's cache entries are not read; no client-side persisted state was found |
| `staleTime` | 15–30 s; no polling anywhere in the module (PASS on §17) |
| Invalidation | Broad `invalidateQueries({ queryKey: ['follow-up'] })` after mutations — correct but over-invalidating |
| Optimistic updates | Present with rollback for two mutations; absent for reminders/assignment |
| Duplicate hooks | `use-invoice-escalation.ts` and `use-item-history.ts` live outside the `follow-up` key namespace, so activity invalidation does not refresh them (item history drawer shows stale timeline after logging) |

---

## Frontend Architecture

`FollowUpCentre.tsx` (1,318 lines) is large but reasonably decomposed: filtering/scoring live in `lib/followup`, rows are separate components, metrics/queue/filters are separated, and a virtualized shell exists. Remaining §24 concerns:

- the page itself contains **zero** inline `useQuery`/`useMutation` calls — it composes 14 dedicated hooks (`useFollowupQuotations/Podc/Invoices/Procurement/Activity`, `useLeads`, `useLogQuotationResponse`, `useRecordReminder`, `useAssignFollowUp`, `useFlagPodcIssue`, `useFollowupFilters`, `useFollowupSearch`, `useFollowupAssignees`, `useFollowupAccess`), which is the correct shape. What remains in the page is filter/URL state, queue assembly and WhatsApp/PDF side effects;
- `priority-queue.ts` merges five unrelated domain models into one synthetic item type, so a change to any upstream shape silently degrades the queue (`as` casts at `api.ts:600`).

The layering (`page → components → hooks → follow-up/api.ts → DB`) is the healthiest of the four modules reviewed.

---

## Business Integrity

| Workflow | Finding |
|---|---|
| Log quotation response | Two sources written without transaction (P1-5); activity log fails on CHECK (P1-4) |
| Send reminder (quotation / invoice / procurement) | Tracking upsert errors are not surfaced; procurement table missing (P1-3) |
| Flag PODC issue | Correct: sets `issue_flag` + `dispute_status='open'` then logs |
| Assign owner | 4 storage paths, no FK on `assignee_user_id`, errors swallowed |
| Escalation stage / collection risk | Computed in the browser from `days_overdue` and balance thresholds hard-coded in `follow-up/api.ts:64-69` (`2000000`, stage ≥ 4) — not configurable per organisation and not stored |
| Lead follow-up overlay | `leads-api.ts` present; not covered by the four tracking tables, so "unassigned urgent" counts mix sources with different rules |

---

## Migration Integrity

| Object | Repository migration | Ad-hoc |
|---|---|---|
| `follow_up_activity_log`, `follow_up_*_tracking`, `follow_up_podc_backlog` | Placeholder `20240101000067/068/069` (0 bytes) | `src/database-follow-up-centre.sql` |
| `follow_up_procurement_tracking` | none | none — **missing entirely** |
| `user_can_access_org` | `20240101000094` (0 bytes) | none |
| `assignee_user_id` columns | `20240101000068` (0 bytes) | `src/database-follow-up-centre.sql` header claims parity with a non-existent 051 |
| RBAC permission rows | none | ad-hoc script |

---

## Runtime Verification

| Test | Result |
|---|---|
| Load | NOT VERIFIED |
| Search | NOT VERIFIED |
| Filter | NOT VERIFIED |
| Create (log response / reminder) | NOT VERIFIED |
| Edit (assignment) | NOT VERIFIED |
| Primary workflow (quotation response → activity timeline) | NOT VERIFIED |
| Secondary workflow (PODC issue flag) | NOT VERIFIED |
| Delete | N/A — module is append/overlay only |
| Export | N/A |
| Organisation switch | NOT VERIFIED (cache design is correct; runtime confirmation outstanding) |

**Static defect confirmations** (these were verified in code, not at runtime): the procurement tab issues a query against a table that no script creates; the quotation-response path emits an `event_type` rejected by the published CHECK constraint.

---

## Build Verification

```text
TypeScript:  NOT RUN (full `tsc --noEmit` exceeded 10 minutes; no code changes made)
Lint:        NOT RUN
Web build:   NOT RUN
Tests:       NOT RUN — no test files exist for this module
Mobile build: N/A (no mobile implementation)
Capacitor sync: N/A
```

---

## Remaining Issues

**Blocking**

- P1-1 (module not reproducible from migrations).
- P1-2 (tenant predicate unverifiable — treat as blocking until the function definition is recovered and reviewed).
- P1-3 (feature simply cannot work where the table is absent).
- P1-4 (every quotation status change reports a spurious failure).

**Non-blocking**

- P1-5 and all P2/P3 items.

---

## Final Status

```text
FAIL
```

The module has the best cache/org-switch discipline of the four modules reviewed and a correctly written activity-log RPC, but it cannot be certified: its schema is outside migration history, its RLS depends on an undefined function, one of its tabs queries a table that does not exist in the repository, and its main mutation path emits values the published constraint rejects.

---

## Suggested Remediation Order (for the follow-up "audit and fix" pass — not performed here)

1. Recover and commit `user_can_access_org` (plus the three other empty-migration bodies) as a forward migration; then re-audit every call site.
2. Write one forward migration that creates the four tracking tables, the activity log, the missing `follow_up_procurement_tracking`, the `assignee_user_id` columns/FKs and the policies; retire the ad-hoc script and fix `SUPABASE_SETUP.md`.
3. Widen the CHECK constraints to the actual event/tab vocabulary (or narrow the TypeScript unions), and make `logActivity` best-effort (never fail the business mutation).
4. Wrap quotation response into one idempotent RPC that updates tracking + header + activity atomically.
5. Add `PermissionGuard` on `/follow-up` and enforce `follow_up.manage` in the write RPCs.
