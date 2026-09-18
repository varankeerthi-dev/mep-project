# Project Module — Runtime, Performance & Data-Fetch Audit

**Date:** 2026-09-15 · **Scope:** Live module at `apps/web/src/projects/` (routed from `App.tsx`: `/projects`, `/projects/new`, `/projects/:id/edit`, `/projects-v2/*`) plus its hooks and shared data layer. Legacy module at `src/pages/*` (`/projects-old`) reviewed for drift only.

**Verdict:** 🟡 Functionally healthy, architecturally over-limit, with **9 data-fetch defects** — 2 of them correctness/tenancy risks, the rest performance waste that grows linearly with data volume.

---

## 1. Architecture Review

### 1.1 Module map (live)
```
/projects                          → src/projects/pages/Projects.tsx (542 lines)   — tab shell (list/tasks/timeline/material/collab)
/projects  → ProjectList (tab)     → src/projects/pages/ProjectList.tsx (529)      — paginated table, detail toggle
/projects  → detail (in-place)     → src/projects/pages/ProjectDetailView.tsx (1,512 ⚠️) — 9-tab detail
/projects/new|:id/edit             → src/projects/pages/CreateProject.tsx (1,518 ⚠️)
Data layer                         → src/projects/hooks/useProjects.ts, useProjectDetails.ts
                                   → src/hooks/useProjectTransactions.ts, useMilestones.ts
Features (good structure)          → src/projects/features/{summary,transactions,equipment,snags,improvement,collaboration}
```

### 1.2 Violations of the >800–1000-line rule

| File | Lines | Responsibilities crammed in |
|---|---|---|
| `ProjectDetailView.tsx` | **1,512** | 9 tabs, 40+ `useState`, 4 modal form controllers (equipment/snag/claim/insight), inline T&C certificate modal, archive/unarchive, milestone CRUD orchestration |
| `CreateProject.tsx` | **1,518** | 40-field form state, draft persistence, 7 ad-hoc fetch loaders, PO linking, close-guard RPC, template system, full page JSX |

`ProjectDetailView` alone manages equipment, snag, warranty-claim, insight-enrich, and milestone form state simultaneously — five bounded contexts in one component. Any keystroke in any modal re-renders the entire 9-tab shell's virtual tree.

### 1.3 Redundant legacy module (drift risk)
- `src/pages/ProjectList.tsx` — **4,797 lines** — still routed at `/projects-old`
- `src/pages/CreateProject.tsx` (1,541), `src/pages/Projects.tsx` (531), legacy `src/hooks/useProjects.ts` (stub)
- `src/features/projects/routes.ts` is **dead code** (never imported anywhere)

Two parallel implementations of the same domain will drift; bug fixes must be applied twice (the button-audit docs already show this happening).

### 1.4 What is done well ✅
- Lazy-loaded detail subtree, tabs, and modals (`React.lazy` + `Suspense`)
- Tab-level query gating in `useProjectDetails` (`enabled:` flags) — inactive tabs don't fetch
- `TabErrorBoundary` around tab content; shared `PageSkeleton`
- Query-key factory (`projectKeys`) and memoized `calculateFinancialSummary` / `calculateEquipmentStats` calculators
- Server-side pagination + filtering in `useProjects`

---

## 2. Data-Fetch Audit (defects, ordered by severity)

### D1 — 🔴 Correctness/tenancy: `tc_protocols` query has **no project filter at all**
`src/projects/hooks/useProjectDetails.ts:218-232`
```ts
supabase.from('tc_protocols').select('*, site_visit:site_visits(...)')
  .order('created_at', { ascending: false });   // ← no .eq('project_id', pId), no .eq('organisation_id')
```
Every Equipment-tab open downloads the **entire table across all projects (and potentially all orgs, depending purely on RLS)**, then matches client-side. Fix: add `.eq('project_id', pId)`; verify RLS on `tc_protocols` independently.

### D2 — 🔴 Tenancy: unscoped queries in `CreateProject.tsx`
- `loadEmployees` (line 623): `.from('employees').select('id, name').order('name')` — **no `organisation_id` filter**
- `loadClientPOs` (line 644): filters by `client_id` only — **no `organisation_id` filter**

If RLS on either table is relaxed, this crosses tenant boundaries. Defence in depth requires the explicit filter.

### D3 — 🟠 Duplicate fetch of the same tables in the same view
`ProjectDetailView` runs **both**:
- `useProjectDetails().transactionsQuery` → `client_purchase_orders`, `project_invoices`, `project_expenses`, `project_payments` (`select('*')`)
- `useProjectTransactions(projectId)` (line 226) → `client_purchase_orders`, `project_invoices` **again**, under a different cache key (`['project-transactions', id]` vs `projectKeys.transactions(id)`)

Result: 2× PO/invoice payload per detail mount, and two caches that can disagree after a mutation invalidates only one of them.

### D4 — 🟠 Whole-table fetch + client-side filter for warranty claims
`useProjectDetails.ts:124-137`
```ts
.from('warranty_claims')
.select('*, equipment:project_equipment(*), snag:project_snags(*)')  // nested select(*) of two tables
.eq('organisation_id', organisationId)                                // org-wide, then…
return (data || []).filter(c => c.equipment?.project_id === pId);     // …filtered in browser
```
Downloads the org's entire claims history with two full nested joins. Fix: `.eq('equipment.project_id', pId)` with an `!inner` embed, or a view/RPC.

### D5 — 🟠 Search has no debounce; every keystroke = a `count:'exact'` paginated query
`ProjectList.tsx:207-208` writes `searchTerm` straight into `useProjects` (no debounce, no `keepPreviousData`), so each character fires:
```ts
.or(`project_name.ilike.%${search}%,project_code.ilike.%${search}%`)
```
…plus the exact-count scan. Also: raw user input interpolated into the PostgREST `or()` string — a value containing `,` `(` `)` breaks or manipulates the filter expression. Needs debounce (300 ms), `keepPreviousData`, and input sanitization/escaping.

### D6 — 🟡 Unbounded aggregate queries done in the browser
- `useProjectStats`: fetches **every project row's status** to count in JS → should be one `count` query per status or an RPC `group by`
- At-risk milestone badge (`ProjectList.tsx:73-98`): fetches **all incomplete milestones org-wide**, counts per project in JS
- `deleteProject` guard: 4 queries fetching full `id` lists of POs/invoices/expenses/payments to check "any exists" → one RPC returning boolean (also removes the check-then-delete race)

### D7 — 🟡 `CreateProject` bypasses React Query entirely
Seven `loadX` functions wired to `useState`/`useEffect` (clients, projects, employees, cost centers, client POs, project). No cache → every mount refetches everything; `loadProject` runs 2 sequential round-trips where 1 parallel batch would do. Loses the staleTime/invalidation benefits the rest of the module has.

### D8 — 🟡 Overfetching & cache-hygiene
- `select('*')` on `project_invoices`, `project_expenses`, `project_payments`, `client_purchase_orders` in the transactions query — wide tables fetched in full
- No `.limit()` anywhere in detail-tab queries (transactions, snags, equipment, insights, drawings, materials, joint measurements) — unbounded as projects accumulate history
- Detail queries use `staleTime: 30s` with the **default `refetchOnWindowFocus: true`** → refetch storm on every alt-tab; `milestones` and `teamMembers` queries have **no staleTime at all** (refetch on every mount + focus)

### D9 — 🟡 Mutations via raw `refetch()` + blocking `alert()`/`confirm()`
Equipment/snag/claim/insight handlers call `supabase` directly, then `refetchX()` and `alert()`. No invalidation of *related* keys (e.g., adding a snag doesn't refresh at-risk counts), no optimistic updates, and synchronous dialogs freeze the UI.

---

## 3. Performance Findings

| # | Finding | Impact |
|---|---|---|
| P1 | Whole-table / whole-org queries (D1, D4, D6) | Response time & payload grow with total data, not with the project being viewed; degrades first on `tc_protocols` and `warranty_claims` |
| P2 | Duplicate transactions fetch (D3) | ~2× bytes + 2 extra round trips per detail open |
| P3 | Keystroke queries without debounce or `keepPreviousData` (D5) | Table flashes to skeleton per keystroke; N× DB count scans while typing |
| P4 | `ProjectDetailView` monolith (1,512 lines) | Any modal keystroke re-renders the full shell tree; 40+ state slots in one reconciler scope |
| P5 | `refetchOnWindowFocus` storms on 30s-stale queries | Wasted repeated queries on tab switching |
| P6 | Inline style objects in `Projects.tsx` / detail modals | New object identities per render; minor but pervasive |
| P7 | `alert()` / `confirm()` for errors and deletes | Blocking, unstyled, untestable |

**Good:** route-level code splitting, lazy tabs/modals, tab-gated queries, memoized financial calculators, server pagination.

---

## 4. Risk Assessment

| Risk | Likelihood | Impact | Priority |
|---|---|---|---|
| Cross-tenant data exposure if RLS misconfigured (`tc_protocols`, `employees`, `client_purchase_orders`) | Medium | Critical (data) | **P0 — D1, D2** |
| Stale/divergent transaction caches after invoice/PO mutations | Medium | High (wrong financials shown) | **P1 — D3** |
| Unbounded queries degrade with data growth | High (over time) | High | P1 — D1, D4, D6, D8 |
| Search filter-string manipulation (`,` / `)` in input) | Low | Medium | P1 — D5 |
| Delete check/delete race | Low | Medium | P2 — D6 |
| Legacy `/projects-old` divergence doubles every future fix | High | Medium (maintenance) | P2 — §1.3 |

---

## 5. Refactoring Plan (proposed — awaiting approval, no implementation done)

**Phase 0 — Correctness (small, safe PRs)**
1. Add `.eq('project_id', pId)` (+ org filter) to `tc_protocols` query; audit RLS on it.
2. Add `.eq('organisation_id', …)` to `loadEmployees` and `loadClientPOs`.
3. Sanitize/escape search input; add 300 ms debounce + `keepPreviousData` in `useProjects`.

**Phase 1 — Deduplicate & bound queries**
4. Merge `useProjectTransactions` into `projectKeys.transactions` (single cache; `TransactionsTab` consumes the same query).
5. Replace warranty-claims client filter with `!inner` embed on `equipment.project_id`.
6. Replace browser aggregates with RPCs: `get_project_status_counts`, `get_at_risk_milestone_counts`, `can_delete_project`.
7. Add explicit column lists + `.limit()` caps; set `staleTime` / `refetchOnWindowFocus: false` consistently; add missing invalidations after mutations.

**Phase 2 — Decompose the two >1000-line pages**
8. `ProjectDetailView` → container + per-tab feature folders; move the 5 modal form states into their feature components (the `features/` scaffolding already exists — this completes it).
9. `CreateProject` → form sections + a `useProjectForm` hook moving all 7 loaders into React Query.
10. Migrate detail navigation from in-place state to a URL route (`/projects/:id`) for deep links / back-button.

**Phase 3 — Cleanup**
11. Delete dead `src/features/projects/routes.ts`; deprecate & remove `/projects-old` pages after a parity check.

### File tree after refactor (target)
```
src/projects/
  pages/
    Projects.tsx                (~300) tab shell
    ProjectList.tsx             (~400) list only
    ProjectDetailView.tsx       (~250) container routing tabs
    CreateProject.tsx           (~300) container
  hooks/
    useProjects.ts  useProjectDetails.ts  useProjectTransactions.ts (merged keys)
  features/
    summary/ transactions/ equipment/ snags/ improvement/ collaboration/
    (each owning its tab UI + modal forms + mutations)
  components/  (ExtractedProjectTable, ProjectToolbar, modals)
```

---

## 6. Recommendation Summary

| Priority | Action | Effort |
|---|---|---|
| P0 | Fix unscoped `tc_protocols` / `employees` / `client_purchase_orders` queries (D1, D2) | ~1 day |
| P0 | Debounce + sanitize search (D5) | ~0.5 day |
| P1 | Merge duplicate transaction caches (D3) | ~1 day |
| P1 | Server-side filter for warranty claims (D4) | ~0.5 day |
| P1 | RPCs for stats / at-risk counts / delete guard (D6) | ~2 days |
| P2 | React Query adoption in CreateProject (D7); cache hygiene (D8); mutation invalidation (D9) | ~3 days |
| P2 | Decompose the two 1.5k-line pages (needs approval per AGENTS.md) | ~1–2 weeks |
| P3 | Remove dead routes file; retire `/projects-old` | ~2 days + QA |

*No code was changed in this audit.*


