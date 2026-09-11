# ERP Production Runtime Performance Audit

**Date:** 2026-09-11 · **Auditor:** opencode (read-only pass, zero source changes)
**Commit:** `5e9bc64` · **Tree:** clean except this report
**Measured on:** local prod build (`vite preview`, port 4173) + dev server (5173), Chrome 153, 1500×900
**Production URL/credentials:** NOT provided — authenticated modules audited via static evidence only (marked as such). No prod data touched.

---

## 1. Executive Summary

The app is a large multi-module ERP (~150 lazy routes, 579 `useQuery` + 392 `useMutation` across 210 files) with sane global query defaults (5m stale, no focus refetch) and genuine per-tab code splitting. The production login page loads in ~1s (316KB over 12 chunks). The systemic risks are all in the data layer, not the bundle:

1. **Waterfall-heavy editors** — the invoice editor needs 4–5 serial round-trips before it renders (header→items per source type, plus `useEffect` fetches outside React Query).
2. **Over-fetching at scale** — 505 `select('*')` sites; Ledger pulls "all-time" (2000→2099) then filters in-browser; one query loads a pricing table with no org filter and discards rows in JS.
3. **Cache fragmentation** — unstable keys (RHF `watch()` arrays, inline arrays), `undefined`-orgId keys, colliding `'empty'` fallbacks, and nuke-style invalidations (`['ledger']` wipes 6 queries; org-switch wipes everything).
4. **91 files fetch Supabase from `useEffect`**, bypassing cache/dedupe entirely.
5. **Almost no pagination** — 1 `useInfiniteQuery` in the whole app; 196 raw `<table>`s.

No P0 (no infinite loops, retry storms, or broken lazy imports found). The top items are P1 fetch-layer fixes with clear evidence.

---

## 2. Application Architecture Observations

- Router is a `BrowserRouter` + giant `App.tsx` switch (`renderedPage` useMemo), not `<Routes>`; navigation via drilled `onNavigate`. Unmatched authed paths fall through to Dashboard (no 404). `AdminRoute` is defined but never used.
- `src/app/routing/*` + per-feature `routes.ts` (with their own duplicate `lazy()` defs) are **dead code** — never imported. Confusing but zero runtime cost.
- Dual `QueryClient` files: active `src/queryClient.ts` (stale 5m, gc 30m, `refetchOnMount: true`, no focus refetch, single retry) vs dead `src/config/queryClient.ts` (gc 10m, `refetchOnMount: false`). Import-the-wrong-one risk.
- `StrictMode` is on: dev double-fetch masks real waterfall cost.
- Manufacturing V0 shell (eager imports) ships alongside V2 lazy shell — check V0 isn't reachable/bundled unnecessarily.
- Pre-existing TS errors (`api.ts` BOQItem, `supabase.ts` auth types, `hooks/index.ts` exports, SettingsV2Page skeleton variant) — build passes (no typecheck in build), but they signal drift.

---

## 3. Discovered Module Inventory

14 feature dirs, 3 `src/modules`, 135 top-level pages + 7 sub-dirs. 18 dashboards. Full route map (authoritative): Auth, Dashboard/Operations, Projects, Clients/Meetings/Field, Subcontractors v1+v2, Sales (PO/Leads/Quotation/SalesOrders), Billing (Invoices/Proforma/CreditNotes/Ledger/BOQ-old), Estimation (BOQ/Tenders/Resources), WorkCompletion/Issues/Governance, Purchase shell, Warehouse shell, Manufacturing V2+V0, Inventory/Store, DC (+non-billable), Reports (7 hubs), Accounting, GST (8 screens), HR, Partners, Advances, Settings V2 (12 lazy tabs).

---

## 4. Global Performance Metrics (measured, prod build, localhost)

| Metric | Value |
|---|---|
| Prod login cold: DCL / load / FCP | 959ms / 965ms / **1064ms** |
| Prod login transfer | **316KB over 12 JS chunks**, 22 resources total |
| Largest login chunks | index 182KB, vendor-data 65KB, Auth 38KB, vendor-react 17KB |
| Dev login FCP (unbundled, 134 resources) | 816ms |
| Total JS in dist | **12.5MB / 560 files** (maps excluded from served bytes) |
| Heaviest chunks (uncompressed) | registerFonts 1.4MB, index-DL 620KB, xlsx 429KB, jspdf 391KB, PDFButton 389KB, openSans 349KB, Warehouse 315KB, Purchase 263KB |
| Authenticated pages | **not directly measurable** (no prod creds) — static evidence only |

---

## 5. Module Performance Scorecard

| Module | Cold | Warm | Reqs | API | UI-ready | Dupe | Waterfall | Sev |
|---|---|---|---|---|---|---|---|---|
| Login (prod, measured) | ~1.0s | n/m | 12 JS | ~0 | ~1.1s | no | no | — |
| Invoice editor | n/m | n/m | 12+ q | 4–5 hops | n/m | yes | **4–5 serial** | P1 |
| Ledger dashboard | n/m | n/m | 6+ | all-time pull | n/m | n/m | n/m | P1 |
| Purchase (60 hooks) | n/m | n/m | many | tuned 30s | n/m | n/m | gated OK | P3 |
| Manufacturing | n/m | n/m | per-tab | 30s–5m | n/m | n/m | gated OK | P3 |
| Lists (generic) | n/m | n/m | n/m | 5m stale | n/m | remount | no | P2 |
| Settings V2 | n/m | n/m | 12 lazy tabs | n/m | n/m | n/m | no | P3 |

n/m = not directly measurable without authed session. Warm-load behavior is structurally good (5m stale + conditional mount in shells).

---

## 6. Network Analysis

- Login needs no API (correct). No waterfall/failure observed on public routes.
- Authed traffic unmeasured; static shape: editors fan out 6–12 queries per page with serial dependencies (§8).

## 7. TanStack Query Analysis

Global defaults sane. Problems: dead duplicate client file; ~70% of queries rely on global 5m with no per-list tuning (Purchase/manufacturing tune to 30s — the pattern to copy); `refetchOnMount: true` + remount-heavy shells = refetch on every tab revisit (structurally P2, unmeasured); org-switch nukes entire cache (`App.tsx:318,996`) instead of scoping by org.

## 8. Supabase/Data Fetch Analysis

- 505 `select('*')` / 1859 total selects; list+detail share fat shapes (`api.ts` fetchers).
- Worst single case: `InvoiceEditorPage.tsx:770-808` loads full `item_variant_pricing` **without org filter**, discards in JS.
- Ledger "all-time" (2000-01-01→2099-12-31) × 3 lists, then `useMemo` filter in browser.
- Client-side `.sort` in 6+ hooks instead of `.order()`; JS joins in `supabase.ts` org fallback.
- `createOrganization`: 3 serial writes, no txn. Consolidation `in(ids)` breaks past 1000 ids.
- `explode_bom` RPC itself is sound (per-level wastage, recursive) — verified in prior session.

## 9. Lazy Loading Analysis

Real splitting (~150 `lazyAny` + 33 manufacturing + 12 settings tabs, `memoLazyModule` dedupe, skeletons per branch). Gaps: V0 eager shell retained; registry files duplicate split definitions (dead); icon-per-file chunks (1KB each — fine); registerFonts 1.4MB + openSans 349KB deserve a font-loading check (measured transfer didn't include them on login — confirm they're not render-blocking elsewhere).

## 10. Rendering Analysis

239 files use memo/callback (healthy adoption). Risks (suspected, not profiled): `AuthContext` consumed app-wide (verify value memoization); PurchaseOrders has local context; `InvoiceEditorPage` (2180 lines, 12 queries, RHF `watch()` in query key = refetch per keystroke); 196 raw tables with zero virtualization except follow-up shell/BOQ form.

## 11. Loading UX

Per-branch `PageSkeleton` variants + `keepPreviousData` on DC lists (good). Gap: only 2 lists keep previous data — all other lists flash loading on page/search change.

## 12. Forms & Mutations

392 mutations, invalidation wired in 138 files (generally correct, e.g. invoices `setQueryData` + invalidate). Gaps: broad `['ledger']`/`['clients']`/`['materials']` invalidations vs org-scoped keys (stale or over-refetch); `payment-requests` invalidates keys no hook owns; task timer invalidation relies on prefix matching; org-switch double-invalidate.

## 13. Tables/Large Data

1 `useInfiniteQuery` (collaboration only). Ledger all-time, full `item_stock`, full `materials` will degrade with scale. No server `ilike` on material search.

## 14. Memory/Resources

No leak evidence found (no abandoned-observer pattern widespread; 6 realtime subscriptions are feature-scoped). 162 files hold listeners/timers — per-file cleanup unverified; no growth data without a long session. **No leak claimed.**

## 15. Runtime Errors

None observed on public routes (prod build). 575 `console.error/warn` call sites = logging hygiene backlog, not observed failures. Pre-existing TS errors listed in §2 (build unaffected).

---

## 16. Cross-Module Root Causes

1. **Every editor re-derives shared masters** (clients/materials/warehouses/item-stock) with its own keys → same tables fetched N times per session. Candidate: shared cached master queries.
2. **Every list refetches on mount** (`refetchOnMount: true` + remount shells) → repeated Supabase traffic on tab revisits.
3. **Fat shared fetchers** (`api.ts`, `subcontractorService`) return `*` for list and detail alike.
4. **Invalidation by prefix-nuke** instead of key-matched invalidation.

---

## 17. Prioritized Findings

**F1 — P1, Confirmed.** Invoice editor waterfall (4–5 serial hops + 2 out-of-Query fetches). Evidence: `InvoiceEditorPage.tsx:583-979,704-768`. Fix: parallelize independent reads, move discount loader into Query, split header/items fetches. Benefit: editor ready in ~1 round-trip set. Risk: low (read path).
**F2 — P1, Strong.** Unfiltered pricing-table pull + JS discard (`:770-808`). Fix: add org filter/server-side join. Benefit: removes full-table transfer per editor open. Risk: low.
**F3 — P1, Strong.** Ledger all-time pull + browser filter (`LedgerDashboard.tsx:258-283`). Fix: date-bounded queries + server filter/pagination. Benefit: bounded payload at scale. Risk: medium (verify FY logic).
**F4 — P1, Confirmed.** RHF `watch()` array in query key → refetch per keystroke (`:678`). Fix: debounce + stable key. Benefit: kills refetch storm. Risk: low.
**F5 — P2, Confirmed.** 91 files fetch outside React Query (no cache/dedupe). Fix: migrate hot paths to hooks. Benefit: dedupe + fewer requests. Risk: low per-site.
**F6 — P2, Confirmed.** Broad invalidations (`['ledger']`, org-switch nuke, prefix mismatches). Fix: key-matched invalidation. Benefit: fewer refetch cascades. Risk: low (verify freshness).
**F7 — P2, Confirmed.** 505 `select('*')`; list/detail share fat shapes. Fix: column-scoped selects per view. Benefit: smaller payloads everywhere. Risk: low (verify columns).
**F8 — P2, Strong.** `refetchOnMount: true` + remount shells → refetch every revisit. Fix: mount-aware config for lists. Benefit: instant warm nav. Risk: medium (staleness review per list).
**F9 — P2, Suspected.** No pagination except collaboration; raw tables everywhere. Fix: paginate Ledger/stock/materials first. Benefit: scale safety. Risk: medium.
**F10 — P3, Confirmed.** Dead duplicate QueryClient + dead routing registry + V0 shell. Fix: delete/merge. Benefit: no confusion, smaller graph. Risk: low.
**F11 — P3, Strong.** Only 2 lists use `keepPreviousData`. Fix: extend to main lists. Benefit: no loading flash. Risk: low.
**F12 — P3, Suspected.** AuthContext/context breadth; 2180-line editor. Fix: profile before splitting. Benefit: unknown until measured. Risk: medium — needs prod profile.
**F13 — P3, Confirmed.** 1.4MB font chunk + 349KB openSans in bundle. Fix: subset/preload check. Benefit: faster first paint on font-heavy routes. Risk: low.
**F14 — P3, Confirmed.** Pre-existing TS errors (api/supabase/hooks/settings). Fix: type cleanup. Benefit: CI signal. Risk: none (no runtime).

---

## 18. Remediation Roadmap

Phase 0: none required (no P0). Phase 1 (fetch): F1, F2, F4, F5, F7. Phase 2 (cache): F6, F8. Phase 3 (loading/nav): F11, F13, F10. Phase 4 (render): F12 (profile-gated), F9. Phase 5 (architecture): shared master-data queries (Root Cause 1) — needs approval.

## 19. Baseline Metrics

| Metric | Before |
|---|---|
| Prod login FCP / transfer | 1064ms / 316KB (12 chunks) |
| Total JS shipped | 12.5MB / 560 files |
| useQuery / useMutation | 579 / 392 across 210 files |
| select('*') sites | 505 |
| useEffect-direct fetches | 91 files |
| Paginated lists | 1 (collaboration) |
| Console errors (public) | 0 observed |
| Duplicates/waterfalls (authed) | per F1–F6, unmeasured latency |

*Limitations: no prod URL/creds → authed latencies are structural estimates, not measurements. Re-audit with an authed session to fill the scorecard.*
