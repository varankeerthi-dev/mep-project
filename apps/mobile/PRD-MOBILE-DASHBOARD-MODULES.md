# PRD: Mobile Dashboard — Client, Project & Purchase Modules

## Problem Statement

The mobile app's Dashboard currently shows a bare "Active Projects" count card and a plain project list, with no quick access to **Clients**, **Projects**, or **Purchases** as first-class navigable modules. On the web app these are rich modules (clients directory, project management, full purchase requisition/PO workflows). Mobile users cannot browse clients, jump into a project's detail, or see purchase activity on the go.

We need a mobile-native dashboard section — placed **below Active Projects** — that surfaces three module entry cards (Client, Project, Purchase). Tapping a card navigates into a module screen that uses **sub-tabs** to organize its content, following the existing mobile design system (`Mobile_app_design.md`).

## Solution Overview

Add a "Modules" section to the Dashboard beneath the existing Active Projects list. It contains three entry cards: **Client**, **Project**, **Purchase**. Each card navigates to a dedicated full-screen module screen that uses the standard mobile **Tab Switcher Pattern** (§11 of design doc) to switch between sub-tabs. All screens follow the Nira/Expense design tokens, glass-card containers, rounded-xl/rounded-2xl radii, Inter font, Framer Motion page entry, and `BottomSheetPicker` for any dropdowns.

Demo mode (already present in the app) must be supported with mock data so the screens render without a backend.

---

## User Stories

1. As a mobile user, I want a "Modules" section below Active Projects with Client / Project / Purchase entries, so I can reach those modules from the dashboard.
2. As a mobile user, I want the three entries to look consistent with the rest of the dashboard (glass cards, icons, count badges), so the UI feels unified.
3. As a mobile user, I want to tap "Client" and land on a Client module screen, so I can reach client data on mobile.
4. As a mobile user, on the Client screen I want sub-tabs (**List | Client PO | Meetings**) mirroring the web client module, so I can switch between the directory, client purchase orders, and meetings without leaving the screen.
5. As a mobile user, I want to search clients by name/code on the List tab, so I can find a client quickly.
6. As a mobile user, I want to tap a client row to expand its details (contact, GSTIN, state, category), so I can see key info without a full page.
7. As a mobile user, on the Client PO tab I want to see client purchase orders with PO number, amount, and status pill, so I can scan order status.
8. As a mobile user, on the Meetings tab I want to see meetings with date, client, and status, so I can review scheduled meetings.
9. As a mobile user, I want to tap "Project" and land on a Project module screen, so I can browse projects.
8. As a mobile user, on the Project screen I want sub-tabs (e.g. **Active / Completed / All**), so I can filter by lifecycle status.
9. As a mobile user, I want to tap a project to see its details (code, client, status), so I can reference it in the field.
10. As a mobile user, I want to tap "Purchase" and land on a Purchase module screen, so I can see procurement activity.
11. As a mobile user, on the Purchase screen I want sub-tabs (e.g. **Requisitions / Orders / Pending Approval**), so I can separate procurement stages.
12. As a mobile user, I want each purchase list item to show PO/PR number, vendor, amount, and status pill, so I can scan status at a glance.
13. As a mobile user, I want a back affordance on every module screen, so I can return to the dashboard.
14. As a demo user, I want the three modules to show realistic mock data, so I can preview the feature without Supabase.
15. As a mobile user, I want dates in `dd-mmm-yyyy` or `dd-mm-yyyy` format (per §18), so dates are unambiguous.
16. As a mobile user, when a module has no data, I want an empty state, so I understand there's nothing to show.

---

## Implementation Decisions

### Navigation Model
- Keep the existing 5-item bottom nav (Dashboard, Approvals, Site Report, Site Visit, Comms) **unchanged**.
- Module screens are **in-app stacked screens** rendered by `App.tsx` state (not bottom-nav items). Add a `module: 'none' | 'client' | 'project' | 'purchase'` state to `App.tsx`, defaulting to `'none'`. When set, render the corresponding module screen above/instead of the dashboard content.
- `App.tsx` passes `onOpenModule={(m) => setModule(m)}` and `onBackToDashboard={() => setModule('none')}` props to `Dashboard`. Module screens receive `onBack={onBackToDashboard}`.
- This avoids disturbing the navigation contract and mirrors how `SiteReport`/`SiteVisits` are currently swapped by `currentScreen`.

### Screens to Create (under `apps/mobile/src/screens/`)
1. **`ClientModule.tsx`** — entry from Client card.
2. **`ProjectModule.tsx`** — entry from Project card.
3. **`PurchaseModule.tsx`** — entry from Purchase card.

Shared small UI helpers can live in `components/` if reused (e.g. a `ModuleScreenShell` wrapper with header + back button + page-entry motion), but keep it minimal — prefer inline JSX consistent with `Dashboard.tsx` / `SiteVisits.tsx` style.

### Dashboard Changes (`Dashboard.tsx`)
- After the existing **Active Projects** list block (ends ~line 468), insert a new **"Modules"** section:
  - Section heading "Modules" with a sub-label.
  - A 3-column (or 1×3 stacked) row of module entry cards: Client, Project, Purchase.
  - Each card: `glass-card rounded-2xl p-4`, icon box `h-10 w-10 rounded-xl bg-{color}/10` with lucide icon (`Users` / `Folder` / `ShoppingCart`), title, and a count badge fetched from Supabase (client count, project count already available, purchase count).
  - `onClick` calls the new `onOpenModule('client'|'project'|'purchase')` prop.
- Add `onOpenModule` to `DashboardProps`.

### Data Layer
- **Clients**: query `supabase.from('clients').select('id, client_name, client_id, contact, email, gstin, state, category, city').eq('organisation_id', orgId).order('client_name')` — mirrors `useClients.ts`.
- **Client PO**: query `supabase.from('client_purchase_orders').select('id, po_number, po_no, po_total_value, status, client_id, project_id, po_date').eq('organisation_id', orgId).order('po_date', { ascending: false })` — mirrors `POList.tsx` (note web uses both `po_number` and `po_no`; confirm which column exists in the live schema).
- **Meetings**: query `supabase.from('meetings').select('id, meeting_date, meeting_time, client_name, location, status, project_id').eq('organisation_id', orgId).order('meeting_date', { ascending: false })` — mirrors `Meetings.tsx`.
- **Projects**: reuse the existing `projects` fetch already in `Dashboard.fetchDashboardData` (columns `id, project_name, name, project_code, status`). Extend select to include `status` and `client_id` for detail rows.
- **Purchases**: two sources (mirror web `usePurchaseQueries.ts` / `purchase-inquiries/api.ts`):
  - Requisitions: `supabase.from('purchase_requisitions').select('*').eq('organisation_id', orgId)` — if table exists.
  - Orders: `supabase.from('purchase_orders').select('id, po_no, vendor_name, total_amount, status, order_date, project_id').eq('organisation_id', orgId).order('order_date', { ascending: false })`.
  - **Defensive**: wrap each purchase query in try/catch; if a table/column is missing, fall back to an empty list (don't crash the screen). Confirm exact purchase table/column names against the live schema before wiring the real query — the web module uses both `purchase_requisitions` and `purchase_orders`.
- **Org resolution**: reuse the `org_members → organisation_id` pattern from `Dashboard.fetchDashboardData` and `useNextActionsMobile`.
- **Demo data**: each module screen accepts `isDemo` and renders mock arrays (clients, projects, purchase POs) when true, consistent with `loadDemoData()` in Dashboard and `useNextActionsMobile` demo branch.

### Sub-Tab Pattern (all three modules)
Use the **Tab Switcher** from design §11:
```tsx
<div className="flex items-center gap-1 p-1 rounded-xl bg-secondary">
  {tabs.map(t => (
    <button key={t.key}
      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${
        active === t.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
      }`}
      onClick={() => setActive(t.key)}>
      {t.label}
    </button>
  ))}
</div>
```
Sub-tabs mirror the **web client module** structure (`ClientList.tsx` reports sub-tabs: Ledger, Transactions, Quotations, **Client PO**, Projects, Site Visits, Delivery Challans, **Meetings**, Communications). For mobile v1 we surface the three highest-value client sub-areas as module tabs:

- **Client tabs**: `List | Client PO | Meetings`
  - *List* → client directory (`clients` table: `client_name`, `client_id`, `contact`, `gstin`, `state`, `category`).
  - *Client PO* → client purchase orders (`client_purchase_orders` table: `po_number`/`po_no`, `po_total_value`, `status`, `client_id`, `project_id`, `po_date`). Mirrors web `POList.tsx`.
  - *Meetings* → meetings (`meetings` table: `meeting_date`, `meeting_time`, `client_name`, `location`, `status`, `project_id`). Mirrors web `Meetings.tsx`.
- **Project tabs**: `Active | Completed | All` (filter on `status` column; map web statuses to these three).
- **Purchase tabs**: `Requisitions | Orders | Pending Approval` (Pending Approval filters `status` containing pending/awaiting). Orders read from `purchase_orders` (`po_no`, `vendor_name`, `total_amount`, `status`, `order_date`); Requisitions from `purchase_requisitions`.

### List Item Patterns
- Client row: `glass-card rounded-xl p-4 flex items-center justify-between` with name, code/category sub-label, chevron to expand details (use Framer Motion height-expand §8).
- Project row: same card style, show `project_name`, `project_code`, and a status pill.
- Purchase row: card showing PO/PR number, vendor, `tabular-nums` amount (currency via `font-currency`/Inter), and a colored **status pill** (`bg-green-500/10 text-green-600` etc.).
- Status pill colors map: Approved/Completed → green, Pending → amber, Rejected/Cancelled → red, Draft → muted.

### Search
- Client & Project screens get a search input (`rounded-xl h-11 text-sm`, with `focus:ring-2 ring-primary/30`) filtering the local list by name/code. Keep it simple client-side filter.

### Styling Rules (must follow `Mobile_app_design.md`)
- App shell `max-w-lg mx-auto`, page `px-4 pt-10 pb-24`.
- Glass cards `glass-card rounded-2xl p-4/p-5`; inputs `rounded-xl h-11 text-sm`; buttons `rounded-xl h-11 text-base font-semibold`.
- Icons: inline `h-4 w-4`/`h-5 w-5`; section icons `h-5 w-5`; FAB not used here.
- Page entry: `motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.1}}`.
- Dates: `dd-mmm-yyyy` for detail headers, `dd-mm-yyyy` for compact lists (§18).
- Font: Inter (already loaded globally).
- Dropdowns (if any filter picker needed beyond tabs): use `BottomSheetPicker` (§149), never native `<select>`.

### Files to Modify / Create
| File | Change |
|------|--------|
| `apps/mobile/src/App.tsx` | Add `module` state; render module screens; pass `onOpenModule`/`onBack` props |
| `apps/mobile/src/screens/Dashboard.tsx` | Add `onOpenModule` prop; insert "Modules" section with 3 entry cards below Active Projects; fetch client + purchase counts |
| `apps/mobile/src/screens/ClientModule.tsx` | **NEW** — client module with sub-tabs (List / Client PO / Meetings) + search + expand |
| `apps/mobile/src/screens/ProjectModule.tsx` | **NEW** — project browser with sub-tabs + search + detail |
| `apps/mobile/src/screens/PurchaseModule.tsx` | **NEW** — purchase requisitions/orders with sub-tabs + status pills |

### Backward Compatibility
- No changes to existing screens (Approvals, SiteReport, SiteVisits, ClientCommunication) or bottom nav.
- `Dashboard` signature change is additive (`onOpenModule` optional with default no-op).

---

## Testing Decisions

- **Demo path**: Launch app in demo mode → Dashboard shows Modules section → each card opens its module with mock data → sub-tabs switch → back returns to dashboard.
- **Empty states**: With a real org that has 0 clients/projects/purchases, each module shows its empty-state card, no crash.
- **Live data**: Authenticate against Supabase → modules reflect real `clients`, `projects`, `purchase_orders` for the resolved org.
- **Defensive query**: Temporarily point purchase query at a non-existent column → screen shows empty list + console warning, not a white screen.
- **Design conformance**: Verify radii (`rounded-xl` inputs, `rounded-2xl` cards), glass-card usage, Inter font, tab switcher style, and date formats match `Mobile_app_design.md`.
- **Navigation**: Bottom nav still switches all 5 tabs correctly while module screens are stacked on top; back from module returns to Dashboard without losing scroll/filters.
- Prior art: mirror the structure/testing approach of `Dashboard.tsx` (loading spinner, error banner, demo branch) and `SiteVisits.tsx` (tabs, cards, pickers).

---

## Out of Scope

- Creating/editing clients, projects, or purchases from mobile (read-only browse in this PR).
- Deep-linking a client/project from a Site Report or Next Action into these modules.
- Purchase 3-way matching, goods receipt, or approval actions on mobile.
- Adding module icons to the bottom navigation bar.
- Offline caching/sync.
- Web parity for every field — mobile shows a curated subset.

## Further Notes

- The web `purchase` module is large (requisitions, inquiries, POs, invoices, approvals). Mobile v1 is **browse-only** with the three sub-tabs; deeper purchase workflows can follow later.
- Confirm live schema for purchase tables (`purchase_orders` vs `purchase_requisitions`) and their column names before finalizing the real query — the defensive try/catch ensures the screen won't break if names differ.
- Keep each new screen self-contained (own `useState` for tabs/search/data) to match the existing screen-file style in this repo.
