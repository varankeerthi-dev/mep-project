# Comprehensive UX Report — MEP Project ERP (All Modules)

> Single master document covering **every module**: UX issues **and** improvements,
> grounded in the actual source (verified files listed at the end) plus the
> architecture/worklogic wiki. No missing-feature or code-correctness findings — only
> UX friction, bottlenecks, and consistency, at both the strategic and per-component
> level.
>
> Companion files already produced:
> - `UX-REVIEW.md` — strategic UX review.
> - `UX-MICRO-FRICTIONS.md` — Part 1 tactical (warehouse, invoice editor, cross-cutting).
> - `UX-MICRO-FRICTIONS-PART2.md` — Part 2 tactical (quotation table, materials).
>
> This file is the consolidated, all-modules rollup. Prior tactical items are
> summarized per module under "Known micro-frictions" so nothing is lost.

---

## 0. Cross-Cutting Foundations (apply to every module)

### Issues
- **C1. Three+ competing design languages.** `DESIGN.md` documents brand-blue
  `#185FA5` buttons, "Paper 2.0" black `#0A0A0A` buttons, and green `#16A34A` SubTabs;
  `QuickAccessBar.tsx` adds a 4th inline-style system; `ReportsDashboard.tsx:4-8`
  hardcodes yet another palette (`#7f1d1d` wine, `#fafaf9` bg). Save is blue on one
  screen, black on another. **Fix:** one `Button` + one token set in `design-system.ts`.
- **C2. Demo / legacy / v2 routes live in production.** `App.tsx` carries 31
  `/v0`, `/v2`, `/demo` route variants (Dashboard Demo, Table Demo, Pricing Demo,
  `manufacturing-v0/*`, six `*-create-v2` editors). Sidebar links several demos.
  **Fix:** gate behind dev-only; remove from sidebar.
- **C3. No shared EmptyState / NotFound / AccessDenied.** 26 bare `Access Denied`
  divs in `App.tsx`; no shared empty state; unknown routes fall through to Dashboard
  (`App.tsx:770`). **Fix:** three shared components.
- **C4. Loading skeleton not universal.** `PageSkeleton` exists (`App.tsx:40`) but
  most lazy routes render `null` while loading → blank flash. **Fix:** wrap Suspense.
- **C5. Global search dead-end.** `QuickAccessBar.tsx:84-91` placeholder promises
  "clients, projects, materials" but only routes to `/clients?search=`. **Fix:**
  real search or honest placeholder.
- **C6. Sidebar sprawl + no persistence.** 14 sections / 80+ items; collapse state
  resets each login (`App.tsx:286`). **Fix:** job-to-be-done grouping, localStorage.
- **C7. Two parallel "create" paths.** Quick Create menu vs sidebar with different
  item sets. **Fix:** Create menu = single quick-create; sidebar = lists only.
- **C8. Duplicated cell-dropdown logic.** `QuotationItemsTable`, `InvoiceItemsEditor`,
  warehouse `MakeCell` each re-implement `position:fixed` dropdown anchoring that
  detaches on scroll. **Fix:** one `<CellDropdown>` portal component.

### Improvements
- Ship a **design-system enforcement**: lint rule / component library so no screen
  hand-rolls buttons or colors.
- **Command palette (Cmd/Ctrl-K)** as the universal navigation + search surface;
  sidebar becomes a curated default, not the only path.
- **Shared `PageHeader`** (breadcrumb + title + primary action) for every
  list/create/edit page.
- **Toast standard** for all create/update/delete confirmations via one helper.

---

## 1. Navigation / Shell / Sidebar

### Issues
- 1.1 Same as C2/C6/C7 above (sprawl, demos in prod, persistence, dual create).
- 1.2 Flyout vs inline-expand inconsistency: some sections use `flyout` on hover
  (Sub-contractor, Materials, Warehouse, Manufacturing, Purchase, Settings) while
  others inline-expand (`Sidebar.tsx`). No uniform behavior.
- 1.3 Only the *active* parent auto-expands on load (`Sidebar.tsx:479`); all other
  groups collapsed → most of the app is hidden until explored.

### Improvements
- 1.4 Type-to-filter in the sidebar; persist collapse + pinned favorites.
- 1.5 Uniform expand/flyout behavior; consider a single collapsed-icon rail + search.

---

## 2. Dashboard / Operations

### Issues
- 2.1 **Operations has parallel V1/V2** (`Operations.tsx` + `OperationsV2.tsx`,
  `useOperationsQueries` + `useOperationsQueriesV2`, `mockData` + `mockDataV2`,
  `FinancialPulseZone` + `FinancialPulseZoneV2`, etc.). Two full copies of every zone
  component — users/developers can't tell which is canonical; double maintenance.
- 2.2 Dashboard is the default landing for unknown routes (`App.tsx:770`) — a typo'd
  deep link silently shows the dashboard, looking like data vanished.

### Improvements
- 2.3 Retire Operations V1 (promote V2 or delete); keep one zone-component set.
- 2.4 Make the dashboard role-aware: show the user's pending approvals, overdue
  items, and today's tasks first (data is already wired via `Dashboard.tsx` queries).

---

## 3. Projects

### Issues
- 3.1 **Parallel V1/V2 editors**: `/projects` + `/projects-v2`, `/projects/new` +
  `/projects-v2/new`, edit variants — same dual-copy problem as Operations
  (`App.tsx:444-450`).
- 3.2 No shared project header/breadcrumb; create flows are full-screen with only
  Cancel.

### Improvements
- 3.3 Unify on one Projects editor; add a project context header (status, client,
  value, linked docs) reused across sub-pages.
- 3.4 Quick "create from template" for repeat project types.

---

## 4. Quotation

### Issues
- 4.1 Wide virtualized grid (`QuotationItemsTable.tsx:253-255`) virtualizes against
  `document.documentElement` → whole app scrolls on long quotations; Make/Variant
  dropdowns (`position:fixed`) detach from rows on scroll.
- 4.2 "Add Row" only via header/empty-state/last-row-focus trick (lines 347-350,
  436-438); no bottom-of-table add.
- 4.3 Make/Variant each need a separate click (lines 35-162).
- 4.4 Header/sub-total rows delete on bare `×` with no undo (lines 380, 420).
- 4.5 No required markers on QTY/RATE; no top-of-form validation summary.

### Improvements
- 4.6 Bound the table to an inner scroll container; extract `<CellDropdown>` (C8).
- 4.7 Bottom add row + undo-delete; auto-open variant after material pick.
- 4.8 Sticky section header + validation summary (ties to `UX-REVIEW.md §7`).

---

## 5. Invoice

### Issues
- 5.1 **Two editors**: `InvoiceEditorPage` + `InvoiceEditorPageV2` (`App.tsx:516-528`).
- 5.2 ~18-column line-item table at 10-11px forces horizontal scroll to reach
  QTY/RATE/AMOUNT (`InvoiceItemsEditor.tsx:604`).
- 5.3 MATERIAL column declared twice (lines 630-657).
- 5.4 Make/Variant/Warehouse each a separate click; no undo on row delete.
- 5.5 "Add" only in header; no bottom add row.

### Improvements
- 5.6 One editor; sticky right columns (QTY/RATE/AMOUNT/delete) or details-expander.
- 5.7 De-duplicate MATERIAL; bottom add + undo delete; pre-fill make/warehouse from
  defaults, skip dropdown when single value.

---

## 6. Credit Notes / Proforma

### Issues
- 6.1 Parallel V2 editors (`credit-notes/create-v2`, `invoices/create-v2`) — same
  dual-copy pattern (`App.tsx:525-527`).
- 6.2 These reuse the invoice line-item grid, so they inherit 5.2-5.5.

### Improvements
- 6.3 Promote one editor; share the line-item grid component across
  invoice/credit-note/proforma so fixes apply once.

---

## 7. Sales Orders

### Issues
- 7.1 Parallel V2 (`sales-orders/create-v2`, `App.tsx:510-511`).

### Improvements
- 7.2 Unify; reuse shared document editor + line-item grid.

---

## 8. Delivery Challan (DC)

### Issues
- 8.1 Parallel V2 (`/dc/create-v2`, `App.tsx:648`); NB-DC separate editor.
- 8.2 Long create form; no documented sticky-section/autosave (see `UX-REVIEW.md §7`).

### Improvements
- 8.3 One DC editor; shared document shell with the others.

---

## 9. Materials & Inventory

### Issues
- 9.1 **13 tabs in one SubTabsNav** mixing catalog + stock-operations
  (`MaterialsPage.tsx:29-43`) — localized sidebar sprawl.
- 9.2 Tab switch is a full route `navigate` (line 25-27) → remounts + refetches.
- 9.3 `ItemsTab` captures `isLoading` but likely flashes empty grid, not skeleton
  (`ItemsTab.tsx:37`).
- 9.4 Quick Create "New Material" button lives in `QuickAccessBar` (separate path
  from the Materials tab) — dual entry, C7.

### Improvements
- 9.5 Split Materials tabs into "Catalog" vs "Stock operations" groups.
- 9.6 Keep tab state in component state to avoid remount/refetch; use `PageSkeleton`.
- 9.7 Positive reference: `MaterialsPage` already mounts only the active tab
  (lines 53-65) — the pattern `WarehouseModule` should copy.

---

## 10. Warehouse

### Issues
- 10.1 **All 7 tab panels mount at once** and toggle with `display:none`
  (`WarehouseModule.tsx:57-77`) → all data queries fire on entry, Viewer/Designer
  keep running in background ("double work / two-time" feel).
- 10.2 Global search bar renders on the Viewer too (lines 52-55), competing with the
  canvas.
- 10.3 No "New warehouse" entry point from the Warehouses tab.

### Improvements
- 10.4 Mount only the active tab (copy `MaterialsPage` pattern).
- 10.5 Hide search on viewer/designer; add "New warehouse" to the tab header.

---

## 11. Manufacturing

### Issues
- 11.1 **Dual shells**: `/manufacturing` (V2, default) + `/manufacturing-v0` (20
  preserved routes, `App.tsx:544-592`) — legacy copy still live.
- 11.2 Many sub-pages (BOMs, schedules, job cards, production, custom units…) — deep
  navigation, no breadcrumb.

### Improvements
- 11.3 Delete `manufacturing-v0`; single shell with breadcrumb + sub-nav.

---

## 12. Purchase

### Issues
- 12.1 Large module (vendors, requisitions, inquiries, orders, bills, verification,
  debit notes, payments, payment queue) — deep sidebar submenu (`Sidebar.tsx`).
- 12.2 `PurchaseModule` uses "Paper 2.0" button style (`DESIGN.md`) — diverges from
  brand-blue used elsewhere (C1).

### Improvements
- 12.3 Sub-nav with type-to-filter; align buttons to the single system (C1).
- 12.4 Payment-queue first screen for approvers (surface what needs action).

---

## 13. Estimation (BOQ / Tenders / Resources)

### Issues
- 13.1 Separate estimation module + separate Sales→Quotation→BOQ entry points;
  BOQ reachable from both sidebar and quotation submenu (`Sidebar.tsx`) — duplicate
  paths.
- 13.2 BOQ form is a long grid (same wide-table risk as invoices).

### Improvements
- 13.3 Single BOQ entry; shared line-item grid; add autosave + section nav.

---

## 14. Partner Allocation

### Issues
- 14.1 Three surfaces: Partners, Allocations, Partner Inbox — inbox/allocations
  overlap conceptually; no clear "what needs my action" surfacing.
- 14.2 Allocation modals (`AllocatePartnerModal`, `DealerAvailabilityDrawer`) — no
  documented empty/loading state consistency.

### Improvements
- 14.3 Inbox-first default showing pending allocations; standardize modal states.

---

## 15. Approvals (positive reference)

### Issues
- 15.1 Largest component (`Approvals.tsx`, ~2051 lines) — monolithic; hard to
  maintain, but UX is comparatively strong.

### Improvements
- 15.2 **Use as the design reference for other modules**: it already has good
  empty states (`EMPTY_STATES`, lines 104-128), status badges
  (`SCORE_COLORS`/`TYPE_COLORS`), and action buttons. Extract its empty-state +
  badge patterns into the shared `EmptyState` / `StatusBadge` components (C3) so the
  rest of the app matches this quality.
- 15.3 Split the monolith into focused components for maintainability.

---

## 16. Reports

### Issues
- 16.1 **Hardcoded fake data in production.** `ReportsDashboard.tsx:22-45` shows
  fixed `count: 156`, `recentReports` with dates `03 May 2024`, and `kpi` `1,247`
  reports generated — none of it real. Users see plausible-but-wrong numbers.
- 16.2 Separate report pages (Financial, Projects, Inventory, Compliance, Invoices,
  Profit) — each its own layout; inconsistent styling.
- 16.3 `ReportsDashboard` uses a one-off wine palette (`#7f1d1d`) unlike the rest of
  the app (C1).

### Improvements
- 16.4 Wire dashboard counts to real queries (or clearly mark as sample).
- 16.5 Shared report shell + chart/table components; align palette to design system.

---

## 17. HR & Attendance

### Issues
- 17.1 Four separate pages (Employees, Planning, Entry, Salary Slip) under one
  sidebar group; no unified employee context.
- 17.2 Attendance entry is a daily grid — high click-count to fill a month.

### Improvements
- 17.3 Employee 360 view (profile + attendance + salary + documents); bulk
  attendance entry with copy-pattern.

---

## 18. Issues / Site Reports

### Issues
- 18.1 Issue dashboard + list + detail + create modal — no clear "my open issues"
  surfacing on the dashboard.
- 18.2 Create modal opens over list (`IssueCreateModal`); no autosave.

### Improvements
- 18.3 Surface "my/open/issues due" widgets; standardize create/edit with the shared
  document shell.

---

## 19. Client & Field (Clients, Leads, Follow-up, Meetings, Site Visits)

### Issues
- 19.1 Clients reachable via sidebar submenu AND `QuickAccessBar` "New Client" (C7).
- 19.2 Leads has List + Kanban — two views, no unified toggle memory.
- 19.3 Follow-up centre is a standalone page; no proactive "due today" surfacing on
  dashboard.

### Improvements
- 19.4 Client 360 (orders, invoices, communications, site visits) as one view.
- 19.5 Remember Kanban/List preference; surface follow-ups on dashboard.

---

## 20. Finance / Accounting

### Issues
- 20.1 Payments hub, Advances & Expenses, Chart of Accounts, Day Book — spread
  across sidebar + modules; no unified "money in / out" view.
- 20.2 Accounting pages use their own styling (C1 risk).

### Improvements
- 20.3 Unified finance nav; shared money-flow widgets; align to design system.

---

## 21. Settings

### Issues
- 21.1 Settings submenu has 14 items including three **demo** links (Table Demo,
  Dynamic Table Demo, Custom Table Demo — `Sidebar.tsx:360-362`).
- 21.2 Settings, Settings V2, Module Settings all exist (`App.tsx:232-234`) —
  overlapping config surfaces.

### Improvements
- 21.3 Remove demo links; consolidate to one Settings surface (or clearly separate
  "App settings" vs "Org settings").

---

## 22. Prioritized Roadmap (all modules)

**Phase 1 — Foundations (unblocks everything):**
1. One `Button` + token system (C1). 2. Shared `EmptyState` / `NotFound` /
`AccessDenied` (C3). 3. Universal `PageSkeleton` (C4). 4. `<CellDropdown>` (C8).
5. Gate demo/`*v0`/`*v2` routes (C2).

**Phase 2 — Navigation:**
6. Sidebar regroup + persistence + filter (1.x, C6, C7). 7. Command palette /
real search (C5). 8. Shared `PageHeader`.

**Phase 3 — Module unification (kill dual copies):**
9. Retire Operations V1, Projects V1, Invoice/SO/Credit/DC/Proforma V2 duplicates.
10. Retire `manufacturing-v0`. 11. One shared document editor + line-item grid.

**Phase 4 — Per-module polish:**
12. Warehouse mount-only-active (10.4). 13. Materials tab split + skeleton (9.5-9.6).
14. Reports real data (16.4). 15. Quotation/invoice table scroll + add-row + undo
(4.6-4.7, 5.6-5.7). 16. Approval patterns extracted as shared components (15.2).

Each item is independently shippable and testable. Detailed per-file fixes for the
Document/Inventory modules are in `UX-MICRO-FRICTIONS.md` and
`UX-MICRO-FRICTIONS-PART2.md`; strategic framing in `UX-REVIEW.md`.

---

## 23. Evidence (files actually read/verified)

- `src/components/Sidebar.tsx` (740 lines) — menu tree, flyouts, dual-create.
- `src/components/QuickAccessBar.tsx` (373) — search dead-end, inline styles.
- `src/App.tsx` (850+) — 31 demo/v0/v2 routes, 26 Access-Denied divs, fallback.
- `DESIGN.md` — 3+ conflicting button/color systems.
- `src/warehouse/WarehouseModule.tsx` — mount-all-tabs, search-on-viewer.
- `src/invoices/components/InvoiceItemsEditor.tsx` — 18-col table, dup MATERIAL,
  per-cell dropdowns.
- `src/pages/CreateQuotation/components/QuotationItemsTable.tsx` — doc-virtualized
  grid, detachable dropdowns, no bottom add, no undo.
- `src/features/materials/page/MaterialsPage.tsx` — 13 tabs, mount-only-active
  (good), route-churn tabs.
- `src/features/materials/page/ItemsTab.tsx` — isLoading not skeletoned.
- `src/pages/Approvals.tsx` — positive reference (empty states, badges).
- `src/pages/Reports/ReportsDashboard.tsx` — hardcoded fake counts/dates.
- `.qoder/repowiki/en/content/**` — worklogic/architecture docs (used to map
  modules; review cites where reality diverges).
