# UX Review — MEP Project ERP (apps/web)

> Scope: User-experience quality across the codebase, read from the perspective of
> (a) the end user sitting in front of the screen and (b) the internal teams who use
> the app every day. This review intentionally does **not** cover missing features,
> architecture, or code-correctness — only UX friction, bottlenecks, and consistency.
> All findings are grounded in actual source: `src/components/Sidebar.tsx`,
> `src/components/QuickAccessBar.tsx`, `src/App.tsx`, `DESIGN.md`, `src/pages/Dashboard.tsx`,
> and the `.qoder/repowiki` worklogic docs.

---

## 1. Executive Summary

The app is functionally rich but UX-fragmented. The two structural problems dominate
everything else:

1. **Navigation sprawl.** The sidebar exposes ~14 sections and 80+ items, and the
   router switch in `App.tsx` carries **31 dead/duplicate route variants**
   (`* /v0`, `* /v2`, `* /demo`, `Dashboard Demo`, `Table Demo`, `Pricing Demo`).
   Demo and legacy routes sit side-by-side with production routes. A new user cannot
   tell what is real and what is a prototype.
2. **No single design language.** `DESIGN.md` documents **three conflicting button
   systems** (brand-blue `#185FA5`, "Paper 2.0" black `#0A0A0A`, SubTabs green
   `#16A34A`) and several inline-style patterns. `QuickAccessBar.tsx` then introduces
   a **fourth** ad-hoc inline style system. There is no enforced component, so every
   screen looks slightly different.

Secondary bottlenecks: the global search is a dead-end (only routes to clients),
there is no consistent empty/error/loading state, and destructive/secondary actions
are inconsistently placed.

**Headline recommendation:** collapse the route surface, ship one Button + one
EmptyState + one AccessDenied component, and turn the sidebar from a flat dump into a
role/persona-aware, searchable nav. These four moves remove the majority of daily
friction.

---

## 2. Navigation & Information Architecture

### 2.1 Sidebar is a wall of links (CRITICAL)
`Sidebar.tsx` renders 14 sections:
`(top)`, Projects, Work, Client and field, CRM, Estimation, Sales, Supply chain,
Finance, Reports, Human Resources, Settings — with deep flyout submenus
(Sub-contractor has 8 items, Purchase has 9, Manufacturing has 8, Warehouse has 7).

- A user who wants to "create an invoice" must open **Sales → Invoices → Create
  invoice** (3 clicks, one flyout). The same action is also a one-click item in the
  top **Create** menu (`QuickAccessBar`). Two parallel paths, no consistency about
  which is canonical.
- **Fix:** Group by *job-to-be-done*, not by backend module. A field user does not
  think "Supply chain → Purchase → Requisitions"; they think "I need to requisition
  material." Provide a small set of primary destinations + a searchable command
  palette (Cmd/Ctrl-K) for everything else.

### 2.2 Demo / legacy / v2 routes pollute production (CRITICAL)
`App.tsx` routes that should never be one click from production:
- `/dashboard-demo` → `DashboardDemo`
- `/table-demo`, `/custom-table-demo`, `/dynamic-table-demo` → demo pages
- `/pricing-demo` → `PricingTableOneDemo`
- `/manufacturing-v0/*` (20 routes) preserved "not in the sidebar" but still live
- 6 `*-create-v2` / `edit-v2` parallel editors (quotation, sales-orders, credit-notes,
  invoices, DC, subcontractor work orders)

The sidebar also links demo routes: `Dashboard Demo`, `Table Demo`,
`Dynamic Table Demo`, `Custom Table Demo`, `Pricing Demo` (lines 79, 360-362).
**Impact:** users land on throwaway screens, get confused, and assume the app is
unfinished. **Fix:** gate all demo/`*v0` routes behind a `NODE_ENV==='development'`
or an `?dev` flag; remove them from the sidebar; keep at most one canonical editor per
document type (retire the `v2` duplicates or promote them and delete the old).

### 2.3 No breadcrumbs / no "where am I" on deep pages
Most create/edit pages are full-screen with only a Cancel button. There is no
breadcrumb trail (Project → Quotation → New) and no persistent context of the parent
record. **Fix:** a shared `PageHeader` with breadcrumb + title + primary action.

### 2.4 Sidebar collapse state is not remembered
`App.tsx:286` `sidebarCollapsed` defaults to `false` every session; there is no
`localStorage` persistence. Power users who collapse it must re-collapse on every
login. **Fix:** persist collapse + any pinned/favorite items.

---

## 3. Global Search is a Dead-End (HIGH)

`QuickAccessBar.tsx:84-91`: the search box placeholder says
*"Search clients, projects, materials..."* but on Enter it only navigates to
`/clients?search=...` (line 86). Projects and materials are promised but ignored.

- **Impact:** users trust the search, type a project name, and are dumped on the
  clients list with a filter that matches nothing → blank screen, perceived bug.
- **Fix:** implement a real global search results page (or a command palette) that
  queries clients, projects, materials, and documents, with type-filtered results and
  a "no results" empty state. Until then, the placeholder should say only what it does.

---

## 4. Inconsistent Visual Language (HIGH)

`DESIGN.md` itself proves the fragmentation — it is a **catalogue of competing
patterns**, not one system:

| Pattern | Color | Where |
|---|---|---|
| Primary button | `#185FA5` brand blue | DESIGN.md "Buttons" |
| Paper 2.0 primary | `#0A0A0A` near-black | Requisitions, PurchaseModule |
| SubTabs active | `#16A34A` green | SubTabsNav |
| QuickAccess buttons | ad-hoc inline `style={{...}}` | QuickAccessBar (4th system) |

Consequences a user notices:
- The **same "Save" action is blue on one screen and black on another**.
- **QuickAccessBar** buttons (fontSize 11px, hand-rolled hover handlers setting
  `e.currentTarget.style.background`) do not match the documented tokens at all.
- Sub-tab active color (green) clashes with the brand blue used elsewhere, so "active"
  looks different per module.

**Fix:** one `Button` component with `variant="primary|secondary|destructive"` driven
by `design-system.ts` tokens; delete the inline-style buttons in `QuickAccessBar`;
reconcile `DESIGN.md` to a single button + one active-color rule.

---

## 5. Empty / Error / Loading / Permission States (HIGH)

### 5.1 "Access Denied" is a裸 div, 26 times
`grep` finds **26** occurrences of
`<div className="p-6">Access Denied</div>` (App.tsx:444-768). Problems:
- No explanation of *why* (missing permission?), no link back, no contact-admin CTA.
- Inconsistent with the nicer `PermissionGuard` concept — it is a dead-end dead-end.
- **Fix:** one `<AccessDenied permission="..." />` component with a reason, a "Request
  access" button, and a back link.

### 5.2 No standardized empty states
Lists (clients, projects, materials, invoices) do not share an empty-state component.
A first-time user with zero records sees either a bare table or a spinner. **Fix:** a
`EmptyState` component (icon + message + primary "Create first X" action) reused
everywhere.

### 5.3 Loading skeleton not universally applied
`PageSkeleton` exists (`App.tsx:40`) but is **not** used by `Suspense` fallbacks —
most lazy routes render `null` while loading (e.g. App.tsx:415-422), so navigation
shows a blank flash. **Fix:** wrap every lazy route's `Suspense` in `PageSkeleton`.

### 5.4 Unknown routes fall through to Dashboard
`App.tsx:770` `default: return <Dashboard />`. A typo'd or stale deep link silently
shows the dashboard instead of a "page not found" — users think their data vanished.
**Fix:** a `NotFound` page with a search + nav shortcut.

---

## 6. Action Discoverability & Feedback (MEDIUM)

### 6.1 Two competing "create" entry points
The top **Create** menu (`QuickAccessBar`) and the sidebar both create records, with
**different item sets** (Create menu has Quotation/DC/Client/Invoice/PO; sidebar has
those plus many more). Users learn neither path fully. **Fix:** make the Create menu
the single quick-create surface; sidebar items should navigate to *list* pages, not
duplicate create actions.

### 6.2 No toast/confirmation standard visible at the shell level
`QuickAccessBar` uses raw `navigate`. There is a `Toaster` (`App.tsx:12`) but success
feedback after create/navigate is inconsistent across pages (some show toasts, some
just navigate). **Fix:** standardize post-action feedback (toast on create/update/
delete) through one helper.

### 6.3 Flyout vs expand inconsistency (mobile/desktop)
Sidebar uses `flyout` on hover for some sections (Sub-contractor, Materials,
Warehouse, Manufacturing, Purchase, Settings) but inline expand for others. On first
load only the *active* parent auto-expands (`initialExpandedMenus`, Sidebar:479); all
other groups are collapsed, hiding most of the app until explored. **Fix:** make
expand/collapse behavior uniform; consider type-to-filter in the sidebar.

---

## 7. Forms & Data Entry (MEDIUM)

### 7.1 Document forms are wide, dense, and unguided
Per `DESIGN.md`, create forms (Quotation, BOM, DC) use a 2-column grid of 70px-label
rows at 11–12px font. For long documents this is a very long scroll with no section
anchors, no autosave indicator, and no "required vs optional" distinction visible.
**Fix:** sticky section nav for long forms, visible required-field markers, and an
autosave/saved-state indicator (data loss on accidental close is a real risk today).

### 7.2 No consistent validation-summary
Inline errors exist (`helperText` in the component library) but there is no standard
"fix N errors before saving" banner at the top of a form. Users discover errors only
after a failed submit. **Fix:** a form-level error summary that jumps to the first
invalid field.

---

## 8. Prioritized Enhancement Steps

Ordered by UX impact per unit of effort. Each step is self-contained.

| # | Step | Solves | Effort |
|---|------|--------|--------|
| 1 | **Route cleanup:** gate `/dashboard-demo`, `/table-demo`, `/custom-table-demo`, `/dynamic-table-demo`, `/pricing-demo`, and all `/manufacturing-v0/*` behind dev-only; remove demo links from `Sidebar.tsx` (lines 79, 360-362). | 2.2, confusion from prototype screens | S |
| 2 | **One Button component:** build `Button` (primary/secondary/destructive) from `design-system.ts`; replace inline buttons in `QuickAccessBar.tsx` and reconcile `DESIGN.md` to a single active color. | 4, visual inconsistency | M |
| 3 | **One AccessDenied component:** replace the 26 `Access Denied` divs with a component that explains the missing permission + requests access + back link. | 5.1, dead-end权限页 | S |
| 4 | **EmptyState + NotFound + universal PageSkeleton:** add `EmptyState`, a `NotFound` page (replace `App.tsx:770` default), and wrap all lazy `Suspense` in `PageSkeleton`. | 5.2, 5.3, 5.4 | M |
| 5 | **Real global search / command palette:** implement a results page (or Cmd-K palette) covering clients, projects, materials, documents; fix the placeholder in `QuickAccessBar.tsx:233`. | 3, dead-end search | L |
| 6 | **Sidebar redesign:** group by job-to-be-done, add type-to-filter, persist collapse state in `localStorage`, unify flyout/expand behavior, make Create menu the single quick-create surface. | 2.1, 2.3, 2.4, 6.1, 6.3 | L |
| 7 | **Shared PageHeader** with breadcrumb + title + primary action for all create/edit/list pages. | 2.3 | M |
| 8 | **Form UX:** sticky section nav for long documents, visible required markers, autosave indicator, and a top-level validation-summary banner. | 7.1, 7.2 | M |
| 9 | **Standardized post-action toasts** via one helper so create/update/delete always confirm. | 6.2 | S |

**Quick win path:** Steps 1, 2, 3, 4 remove the most visible daily friction and are
all small. Steps 5–8 are the larger reshaping that makes the product feel finished.

---

## 9. What Already Works (keep)

- `PageSkeleton` and `Toaster` infrastructure already exist — just under-used.
- `PermissionGuard` + RBAC is solid; the gap is only the *fallback UI*, not the logic.
- Design tokens live in `design-system.ts` and `tailwind.config.cjs` — the foundation
  for a single Button/EmptyState is already there.
- Onboarding tour exists (`App.tsx` tourSteps) — good first step; extend it to explain
  the new command palette and sidebar filter once built.

---

## 10. Method & Evidence

Findings derived from reading:
- `src/components/Sidebar.tsx` (740 lines) — full menu tree, flyout logic.
- `src/components/QuickAccessBar.tsx` (373 lines) — search dead-end, inline styles.
- `src/App.tsx` (850+ lines) — 31 demo/v0/v2 route variants, 26 Access-Denied divs.
- `DESIGN.md` — three conflicting button/color systems.
- `src/pages/Dashboard.tsx` — confirms `design-system` tokens + dashboard query model.
- `.qoder/repowiki/en/content/**` — worklogic/architecture docs (used to understand
  intended flows; the review cites where reality diverges from them).

No code was modified. This is a review artifact.
