# Project Module P0/P1 Fix Report

**Date:** 2026-09-15 · **Scope:** `apps/web/src/projects/` live module + shared invoice modal
**Method:** CODE CHANGE → STATIC CHECK → SECOND CODE REVIEW → RUNTIME/NETWORK CHECK (as far as tooling permits)

### 1. Executive Summary

* Audit findings verified: **6** (D1–D6)
* Confirmed against current code: **6**
* Fixed: **6** (D6 partially — see below)
* Already fixed before this task: **0**
* Rejected / not reproducible: **0**
* Requiring further investigation / deferred: **1 sub-item** (at-risk-milestone aggregate needs a new DB function — deferred)

### 2. Finding-by-Finding Result

| Finding | Status | What was found | What changed | Verification |
|---|---|---|---|---|
| D1 tc_protocols | FIXED | Query fetched the **entire** `tc_protocols` table (no project/org filter). No direct `project_id` column verified; link is via `equipment_id → project_equipment.project_id` (FK proven by embeds in `SiteVisits.tsx` and `EquipmentTab.tsx` matching `tc.equipment_id`) | `useProjectDetails.ts`: added `equipment:project_equipment!inner(project_id)` embed + `.eq('equipment.project_id', pId)` — server-side scoping via the verified FK | Second review: org isolation achieved transitively through project; UI match (`tc.equipment_id === eq.id`) unchanged; site_visit embed preserved |
| D2 employees/POs | FIXED | `loadEmployees` had **no** `organisation_id` filter; `loadClientPOs` filtered by `client_id` only | Both got `.eq('organisation_id', organisation.id)` (column existence verified: `WorkCompletionCertificatePage.tsx:211` uses the same pattern) | Second review: matches existing tenancy pattern; RLS untouched |
| D3 duplicate transactions | FIXED | `ProjectDetailView` fetched POs+invoices twice (`useProjectDetails.transactionsQuery` + `useProjectTransactions`) under 2 cache keys; worse — the invoice modal invalidated the duplicate + legacy keys but **never the canonical key**, so the live view could show stale financials after saving an invoice | `ProjectDetailView`: `linkedData` now derived (useMemo) from the canonical `transactionsQuery`; second hook call removed. `CreateProjectInvoiceModal`: now also invalidates `projectKeys.transactions(projectId)` (legacy keys kept — legacy view still uses them) | Grep confirms **no** `useProjectTransactions(` call remains in the live module (legacy `/projects-old` intentionally kept); one authoritative cache key for the live view; modal invalidates it |
| D4 warranty claims | FIXED | Org-wide fetch + nested `select(*)` joins + browser filter by `equipment.project_id` | `.eq('equipment.project_id', pId)` with `!inner` embed; client-side filter removed. Behaviour identical: claims with NULL/foreign equipment were already excluded by the JS filter | `!inner` uses the same FK the old embed used, so it works with the current schema; `organisation_id` filter retained |
| D5 search | FIXED | No debounce (query per keystroke, `count:'exact'`), raw input interpolated into PostgREST `or()` (`,` `(` `)` quotes break or alter the filter) | 300 ms debounce in `ProjectList` (input binds `searchInput`, debounced `searchTerm` feeds the query); sanitizer strips `, " \ ( )` before building the filter; `placeholderData: keepPreviousData` prevents skeleton flashes | Second review **caught and fixed a self-introduced bug** (input was initially bound to the debounced state — would have dropped keystrokes); representative inputs: `abc`/`100` unchanged; `A,B`, `A(B`, `A)`, quotes → sanitized to a safe term; `%`/`_` keep existing ilike wildcard semantics (search semantics preserved) |
| D6 aggregates | PARTIALLY FIXED | (a) `useProjectStats` downloaded every project row to count in JS; (b) delete guard fetched 4 full ID lists; (c) at-risk milestones downloaded org-wide milestone rows | (a) → 7 parallel **head-only COUNT** queries (zero row payload); (b) → existing `can_delete_project` RPC (in `src/database-project-enhancement.sql` alongside the already-used `can_close_project`), original 4-query check kept as automatic fallback, identical alert messages; (c) → **DEFERRED** — per-project counts require a new DB function (needs approval + deployment; current query already fetches only `project_id` strings) | (a)/(b) second review: same business rules, same user-visible behaviour, no schema change required |

### 3. Security Verification

* `tc_protocols`: ✅ now project-scoped server-side via `equipment.project_id` (transitively organisation-scoped through the project row)
* `employees` (CreateProject): ✅ `.eq('organisation_id', …)` added
* `client_purchase_orders` (CreateProject): ✅ `.eq('organisation_id', …)` added on top of existing `client_id`
* warranty claims: ✅ org filter **kept** + server-side project filter added
* project transactions: ✅ filters unchanged (invoices/expenses/payments already had `organisation_id`; POs scoped by `project_id`); RLS untouched
* No RLS policy was modified; no security condition was removed.

### 4. Performance Verification

* Duplicate requests removed: PO+invoice fetch halved per detail view; the always-on `useProjectTransactions` fetch (ran even on non-transaction tabs) is gone from the live view
* Organisation-wide queries removed: `tc_protocols` full-table, `warranty_claims` org-wide + 2 nested joins, unscoped employees/POs fetches, delete-guard ID lists
* Search: ≈1 request per 300 ms pause instead of 1 per keystroke; previous results stay visible (`keepPreviousData`)
* Aggregates: status counts and delete guard now execute server-side with zero/1-row payloads
* Cache: one canonical transaction cache key; invoice save now invalidates it (stale-financials bug fixed)

### 5. Validation Results

| Check | Command | Result |
|---|---|---|
| Tests | `npm test` (vitest) | ✅ **331/331 passed** (23 files, incl. `projects/features/collaboration/schemas.test.ts`) |
| Build | `npm run build` (NODE_OPTIONS=8192MB) | ✅ **`✓ built in 2m 14s`** (only pre-existing font/chunk warnings) |
| TypeScript | `npm run typecheck` (NODE_OPTIONS=8192MB; default heap **OOM-crashes** on this repo) | ⚠️ **926 pre-existing repo-wide errors**; **none on changed hunks** (ProjectDetailView:542/628 and CreateProject:682/893 errors are in untouched code — verified via git diff hunks; only line numbers shifted) |
| Lint | `npx eslint <6 changed files>` | ⚠️ parser "Parsing error" on **every TS file repo-wide, including untouched baseline files** (`useMilestones.ts`, `Dashboard.tsx`) — pre-existing broken parser config; no new findings attributable to changes |
| Runtime (browser) | dev server + UI walk-through | ❌ **NOT PERFORMED** — no browser automation/credentials in this session; testing against the production Supabase backend was out of scope per safety rules. Recommended before merge. |
| Network capture | browser devtools | ❌ NOT PERFORMED (same reason) — expected request shapes documented in §2 instead |

### 6. Files Changed

| File | Why |
|---|---|
| `src/projects/hooks/useProjectDetails.ts` | D1: `tc_protocols` server-side project scoping; D4: warranty-claims DB-side project filter |
| `src/projects/hooks/useProjects.ts` | D5: search sanitisation + `keepPreviousData`; D6: head-count status stats |
| `src/projects/pages/ProjectList.tsx` | D5: 300 ms search debounce; D6: delete guard via `can_delete_project` RPC (with fallback) |
| `src/projects/pages/CreateProject.tsx` | D2: `organisation_id` scoping for employees and client POs |
| `src/projects/pages/ProjectDetailView.tsx` | D3: single canonical transaction fetch/cache; duplicate hook call removed |
| `src/components/CreateProjectInvoiceModal.tsx` | D3: invalidates the canonical transaction cache after invoice save |

*Note: the working tree also contains pre-existing uncommitted changes (invoices, credit-notes, purchase, document-editor, proforma, DC files) made outside this task — untouched and not part of this fix.*

### 7. Database Changes

`No database changes were made.` (The `can_delete_project` RPC used in D6 already existed in `src/database-project-enhancement.sql`; a code fallback preserves behaviour if it is absent in a given environment.)

### 8. Remaining Issues

* **At-risk-milestone aggregate (D6c) deferred** — needs a new SQL function (`group by project_id`), i.e. a database change requiring approval/deployment
* `select('*')` on the canonical transactions query retained — many tab consumers; narrowing columns risks breaking UI fields (deferred to the approved architectural refactor)
* Pre-existing repo-wide typecheck errors (926) and broken ESLint TS parser — outside this task
* Runtime/browser verification not performed (see §5) — do a manual smoke test of Project List search and Detail → Equipment/Warranty tabs before release
* Legacy `/projects-old` still duplicates all of these patterns (untouched per instructions)

### 9. Final Verdict

🟡 **VERIFIED WITH FOLLOW-UP** — all six confirmed P0/P1 findings are fixed and pass tests + production build + second code review; follow-ups: deferred D6c aggregate, the pre-existing typecheck/lint baseline, and a manual runtime smoke test (network panel) before deployment.


