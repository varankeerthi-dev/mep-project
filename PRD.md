# MEP Project — Product Requirements Document (PRD)
**Version:** 1.0 · **Date:** April 2026 · **Author:** Engineering

---

## 1. Executive Summary

This PRD defines improvements across four axes for the MEP Project — a multi-tenant, Supabase-backed React/Vite ERP for MEP (Mechanical, Electrical, Plumbing) businesses. The app already covers Quotations, Purchase Orders, Delivery Challans, Inventory, Subcontractors, Site Visits, Projects, Invoicing, and HR modules.

---

## 2. Module Enhancement — Existing Screens

### 2.1 POList (`/client-po`)
**Current state:** Raw `useState` + manual `loadPOs()` fetch, client-side pagination on already-fetched data, `confirm()` for delete, no export, no detail preview in-line.

| # | Enhancement | Priority |
|---|---|---|
| P1 | Migrate `loadPOs` to `useQuery` with `['client-po', orgId, statusFilter, dateFrom, dateTo]` key — remove manual refetch | High |
| P2 | Add server-side pagination (`.range()`) — current client-side pagination defeats the purpose for large datasets | High |
| P3 | Replace `confirm()` delete with a proper `AlertDialog` component | Medium |
| P4 | Add "Export to Excel" button — PO list with Amount, Balance, Status | Medium |
| P5 | Inline PO detail drawer/sheet (slide-in from right) so users don't navigate away | Medium |
| P6 | Add `Cancelled` status support — currently only 3 statuses hardcoded | Low |
| P7 | Show utilisation % bar in the Balance column (visual progress bar) | Low |

---

### 2.2 MaterialsList (`/store/materials`)
**Current state:** 3,221-line monolithic file; parallel data loading via `useMaterialsPageData`; `loadItemTransactions` fires 8+ sequential queries per item click; local-storage audit trail as fallback.

| # | Enhancement | Priority |
|---|---|---|
| P1 | **Split the file** — extract `ItemsTab`, `ServiceTab`, `CategoryTab`, `UnitTab`, `WarehouseTab`, `VariantsTab` into separate files under `src/pages/materials/` | Critical |
| P2 | `loadItemTransactions` — convert to `useQuery` with `['item-transactions', itemId]` and `staleTime: 60_000`; currently re-fetches on every row click | High |
| P3 | Add server-side search (`.ilike('name', '%term%')`) rather than client-side filtering 10k+ items in browser | High |
| P4 | Implement `@tanstack/react-virtual` row virtualization for the items table (hook `useVirtualizedTable` already exists but is unused here) | High |
| P5 | Add Low-Stock Alert banner — query items where `current_stock < low_stock_level` and surface as a dismissable warning strip at the top | Medium |
| P6 | Bulk select + bulk deactivate / bulk export for items | Medium |
| P7 | Item image upload (Supabase Storage bucket `item-images` already provisioned) | Low |

---

### 2.3 SiteVisits (`/site-visits`)
**Current state:** Well-structured with React Query; however: `refetchInterval: 30000` on both visits and clients (wasteful), table column headers show "Name ^", "Phone number", "Street name", "Suburb", "Postcode" — these are copy-paste placeholder labels from a generic CRM template.

| # | Enhancement | Priority |
|---|---|---|
| P1 | **Fix placeholder column headers** — rename "Name ^" → "Client", "Phone number" → "Contact", "Street name" → "Site Address", "Suburb" → "City", "Postcode" → "Postcode", "Last activity" → "Updated" | Critical |
| P2 | Remove `refetchInterval: 30000` from clients query (clients change rarely) — replace with `staleTime: 5 * 60 * 1000` | High |
| P3 | Add date range filter — currently only status filter; visits can't be filtered by month/period | High |
| P4 | Add purpose-of-visit analytics panel (pie chart by purpose) in the Calendar tab | Medium |
| P5 | Quick summary cards at top: Today's Visits, Completed This Week, Pending Follow-ups | Medium |
| P6 | Export visits to PDF/Excel (date range) | Low |
| P7 | GPS location link — show a "📍 Open Map" button when `location_url` is present | Low |

---

### 2.4 TodoList / Tasks (`/todo`)
**Current state:** `useState` + raw `supabase.from('tasks')` calls (no React Query), drag-and-drop board view with native HTML5 DnD (brittle), task edit not implemented (only delete), reminders tab empty.

| # | Enhancement | Priority |
|---|---|---|
| P1 | Migrate all task fetches to `useQuery` + `useMutation`; eliminate `fetchTasks()` manual calls | High |
| P2 | Replace native HTML5 drag-and-drop with `@dnd-kit/core` (already installed) for reliable touch + mouse drag | High |
| P3 | Add **task edit modal** — currently tasks can only be deleted, not edited after creation | High |
| P4 | Implement the **Reminders tab** — show `reminders` table data with due-date countdown and "Mark Done" action | Medium |
| P5 | Add assignee field with org member dropdown (`organisation_members` table) | Medium |
| P6 | Add subtasks support (parent_id self-relation) | Low |

---

### 2.5 QuotationList (`/quotation`)
**Current state:** Good React Query setup; but PDF download has multiple dead code blocks commented out with `/*` — `QTN_TALLY`, `QTN_PROFESSIONAL`, `QTN_GRID_PRO` templates are all commented out; `generateZohoTemplate` called but not imported.

| # | Enhancement | Priority |
|---|---|---|
| P1 | Fix `generateZohoTemplate` — it's called on line 235 but never imported (runtime error) | Critical |
| P2 | Clean up / re-enable commented PDF template paths or remove them permanently | High |
| P3 | Add column: `Project` (most quotations have a `project_id` — not shown in list) | Medium |
| P4 | Add bulk status update — select multiple quotations → mark as Sent / Approved | Medium |
| P5 | Add quotation value total in the header strip (like POList metric strip) | Low |
| P6 | Add "Convert to Invoice" button in the actions menu | Low |

---

### 2.6 Subcontractors (`/subcontractors`)
**Current state:** Well-built with React Query + mutation; `window.subToView = row.original` is used to pass data to the View page — this is a global mutation and will fail on refresh.

| # | Enhancement | Priority |
|---|---|---|
| P1 | Remove `window.subToView` — pass subcontractor data via URL param + React Query refetch (`useQuery` with `id`) in `SubcontractorView` | High |
| P2 | Add subcontractor rating/score (1–5 stars) stored in DB for performance tracking | Medium |
| P3 | Add document upload tab (Pan Card, GST Certificate, Agreement) via Supabase Storage | Medium |
| P4 | Subcontractor payment history summary card in the dashboard table row | Low |

---

### 2.7 Dashboard (`/dashboard`)
**Current state:** ~1,100 lines; the entire dashboard card logic is commented out. The actual rendered page is just a static header with organisation name and a refresh button — **the dashboard is essentially empty**.

| # | Enhancement | Priority |
|---|---|---|
| P1 | **Restore and activate KPI cards** — Today's Site Visits, Pending Approvals, Active Projects, Month Revenue | Critical |
| P2 | **Restore activity cards** — Approvals, Client Communication, Site Visit Plan, Quotation Approval, Invoices | Critical |
| P3 | Add quick-action buttons: New DC, New Quotation, Log Site Visit, New Task | High |
| P4 | Add real-time Supabase subscription for dashboard data (site visits, approvals) using `supabase.channel()` | Medium |
| P5 | Add a "Today at a Glance" timeline widget showing all events for today chronologically | Medium |

---

## 3. UX Improvements

### 3.1 Consistency & Design System

| # | Issue | Fix |
|---|---|---|
| U1 | **Mixed alert patterns** — some modules use `alert()`, some use `toast`, some use inline error divs | Standardise on `sonner` toast for all success/error feedback; remove all `alert()` / `confirm()` calls |
| U2 | **Inconsistent page headers** — SiteVisits has a full hero header, POList has a tiny 2-line header, QuotationList has a medium header | Create a shared `<PageHeader>` component |
| U3 | **Inconsistent empty states** — some show "No data found" text, some show nothing, some show a spinner forever | Create a shared `<EmptyState>` component with icon, title, description, and optional CTA |
| U4 | **No global error boundary** — an unhandled render error crashes the whole app | Wrap route content in React `ErrorBoundary` with a retry button |
| U5 | Auth loading state shows plain `<div>Loading...</div>` with no spinner | Replace with a branded full-page loader |

### 3.2 Mobile Responsiveness

| # | Issue |
|---|---|
| M1 | Tables (POList, QuotationList, MaterialsList) overflow on mobile — no horizontal scroll indicators or card fallback |
| M2 | Sidebar mobile backdrop exists but sidebar auto-closes only on navigation — tapping outside on mobile doesn't close it reliably |
| M3 | The 5-step SiteVisit form modal is too tall for mobile viewports — needs scroll or step collapsing |
| M4 | Date range pickers are very small on touch screens |

### 3.3 Keyboard & Accessibility

| # | Issue |
|---|---|
| A1 | Modals don't trap focus (Tab key escapes modal) |
| A2 | Table rows that act as buttons (QuotationList row click to navigate) have no `role="button"` or `aria-label` |
| A3 | Status badges use colour alone to convey meaning — need text |
| A4 | `ReactQueryDevtools` ships in production bundle (should be `process.env.NODE_ENV === 'development'` gated) |

---

## 4. Performance Improvements

### 4.1 Data Fetching

| # | Item | Action |
|---|---|---|
| Perf-1 | `TodoList` uses raw `useEffect` + supabase calls — no caching, re-fetches every render cycle | Migrate to React Query |
| Perf-2 | `SiteVisits` refetches clients every 30 seconds unnecessarily | Remove interval; use `staleTime: 10min` |
| Perf-3 | `POList` fetches all POs for org, then paginates client-side — bad for large datasets | Use `.range(from, to)` server pagination |
| Perf-4 | `loadItemTransactions` in MaterialsList runs 8+ sequential await calls, no caching | Batch into `Promise.all` (partially done), add `useQuery` caching |
| Perf-5 | Dashboard query invalidation fires `invalidateQueries` on the entire `['dashboard']` key — causes all dashboard queries to refetch simultaneously | Use targeted per-key invalidation |

### 4.2 Bundle & Rendering

| # | Item | Action |
|---|---|---|
| Perf-6 | `MaterialsList.tsx` is 150KB / 3,221 lines — single largest file, compiled into one chunk | Split into sub-components (see §2.2 P1) |
| Perf-7 | `ReactQueryDevtools` included unconditionally in production | Gate with `import.meta.env.DEV` |
| Perf-8 | `BOQ.tsx` (96KB) and `CreateQuotation.tsx` (104KB) are among the largest pages — no code splitting inside them | Extract form sections into separate lazy-loaded components |
| Perf-9 | Large pages like `Subcontractors.tsx` (87KB) define sub-components inline — prevents React from memoizing stable references | Move sub-components to module scope |
| Perf-10 | `useVirtualizedTable` hook exists but is not used in MaterialsList table which can have 1000s of items | Wire up virtualization for item rows |

### 4.3 Database

| # | Item |
|---|---|
| DB-1 | Add index on `client_purchase_orders(organisation_id, status, po_date)` for POList queries |
| DB-2 | Add index on `site_visits(organisation_id, visit_date)` for date-filtered SiteVisit queries |
| DB-3 | Add index on `tasks(organisation_id, category, is_personal)` for TodoList filtering |
| DB-4 | Migrate remaining pages from direct `supabase.from()` calls to Supabase RLS + shared hooks for consistent org-scoping |

---

## 5. New Features

### 5.1 🔔 In-App Notification Centre
**Description:** A bell icon in the sidebar header that shows unread notifications with count badge.

**Sources of notifications:**
- Quotation status changes (Approved / Rejected)
- PO balance falling below 10%
- Site visit status updates
- Task due date approaching (< 24 hrs)
- Subcontractor payment due

**Tech:** Supabase Realtime subscriptions + `notifications` table (org_id, user_id, type, payload, read, created_at).

---

### 5.2 📊 Advanced Reporting Module (`/reports`)
**Description:** Replace the stub `Reports.tsx` (currently just a placeholder) with a full reporting suite.

**Reports:**
| Report | Description |
|---|---|
| Sales Summary | Monthly quotation value, win rate, top clients |
| PO Utilisation | Per-client PO balance burn rate |
| Inventory Movement | Inward vs Outward per item per period |
| Site Visit Log | Visits per engineer, per client, per month |
| Subcontractor Payments | Payment summary per subcontractor |
| Project P&L | Revenue vs costs per project |

**Export:** All reports exportable to Excel (ExcelJS already installed) and PDF (jsPDF already installed).

---

### 5.3 ✅ Approval Workflow Engine
**Description:** Currently `Approvals.tsx` is a 337-byte stub. Build a real approval module.

**Features:**
- Define approval chains per document type (Quotation, PO, DC, Work Order)
- Role-based approvers (from `organisation_members`)
- Email notification on approval request
- Approve / Reject with remarks from the notification centre
- Audit log of all approvals

---

### 5.4 📱 Progressive Web App (PWA)
**Description:** Enable offline-capable PWA for field teams.

**Features:**
- Add `vite-plugin-pwa` — service worker + manifest
- Offline site visit logging (queue syncs when online)
- Install prompt on mobile devices
- Push notifications via Web Push API

---

### 5.5 🔗 WhatsApp / Email Quick Share
**Description:** From QuotationList and PODetails, add "Share" button that opens a pre-filled WhatsApp deep link or mailto with the PDF attached.

**Fields:** Client phone (from clients table), PDF blob (already generated), custom message template.

---

### 5.6 📅 Unified Calendar View
**Description:** A single `/calendar` page aggregating:
- Site Visits (by `visit_date`)
- Meetings (by meeting date)
- Task due dates
- Subcontractor attendance
- Project milestone dates

**Tech:** `date-fns` (already installed) + a custom calendar grid (like the one in SiteVisits but shared).

---

### 5.7 🏷️ Client Portal (Read-Only)
**Description:** A separate auth route `/portal` where clients can log in (via invitation) and view:
- Their quotations and status
- Delivery challan history
- Invoices and payment status

**Tech:** Supabase Row-Level Security (already set up); add a `client_portal_access` table linking `client_id` + `auth.user_id`.

---

## 6. Technical Debt to Resolve

| # | Debt Item |
|---|---|
| T1 | `window.subToView` global mutation in Subcontractors — replace with URL param |
| T2 | `generateZohoTemplate` called but not imported in QuotationList |
| T3 | Dashboard.tsx is 1,179 lines of which ~800 are commented-out dead code — clean up |
| T4 | `BOQ.backup.tsx` and `SiteVisits.tsx.backup2` checked into repo — remove backup files |
| T5 | Multiple SQL migration files in `src/` directory root (100+ `.sql` files) — move to `src/migrations/` or a dedicated `db/` folder |
| T6 | `any[]` typed state arrays across most pages — replace with typed interfaces |
| T7 | `useAuth` imported from both `../App` and `../contexts/AuthContext` inconsistently — standardise on `../contexts/AuthContext` |
| T8 | `ReactQueryDevtools` renders in production — gate with `import.meta.env.DEV` |

---

## 7. Prioritisation Matrix

| Priority | Items |
|---|---|
| **P0 – Critical (Fix Now)** | Dashboard restored (§2.7 P1/P2), SiteVisits column headers (§2.3 P1), QuotationList ZohoTemplate import fix (§2.5 P1), window.subToView removal (T1) |
| **P1 – High (Next Sprint)** | POList React Query migration, TodoList React Query migration, MaterialsList file split, server-side pagination for POList |
| **P2 – Medium (Q2)** | Notification Centre, Approval Workflow, Unified Calendar, Advanced Reports |
| **P3 – Low (Backlog)** | PWA, Client Portal, WhatsApp Share, subcontractor ratings |

---

## 8. Definition of Done

- [ ] React Query used for all data fetching (no raw `useEffect` + supabase)
- [ ] No `alert()` or `confirm()` — replaced with proper UI components
- [ ] No `any[]` on state arrays — typed with interfaces
- [ ] `ReactQueryDevtools` gated to dev mode
- [ ] All tables have loading skeleton and empty state
- [ ] All destructive actions use `AlertDialog` confirmation
- [ ] All new features have organisation-scoped RLS policies
