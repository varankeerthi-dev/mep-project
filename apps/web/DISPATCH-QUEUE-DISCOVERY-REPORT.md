# Dispatch Queue Feature — Codebase Discovery Report

**Date**: 2026-07-09  
**Purpose**: Pre-PRD investigation for the Dispatch Queue module and Operations sidebar cluster  
**Status**: Discovery only — no code changes made

---

## Table of Contents

1. [Current Sidebar / Navigation Structure](#1-current-sidebar--navigation-structure)
2. [Sales Order Status Computation Audit](#2-sales-order-status-computation-audit)
3. [Client Communication Reuse Feasibility](#3-client-communication-reuse-feasibility)
4. [Existing Action-Oriented Patterns](#4-existing-action-oriented-patterns)
5. [Role / Ownership Audit](#5-role--ownership-audit)
6. [Complexity & Gaps Assessment](#6-complexity--gaps-assessment)

---

## 1. CURRENT SIDEBAR / NAVIGATION STRUCTURE

### File Path

```
src/components/Sidebar.tsx (643 lines)
```

### Current Cluster/Grouping Structure

The sidebar has **7 named sections** plus an unnamed root section:

| Section | Items |
|---|---|
| *(unnamed root)* | Dashboard, CEO Dashboard |
| **Work** | Projects, Approvals, To do, Follow-up, Communication log, Quick Lookup |
| **Client and field** | Clients (submenu), **Site visit** (standalone), Site report (submenu), Issues (submenu), Sub-contractor (flyout) |
| **Commerce** | Leads, Quotation, Sales Orders, Invoices, Ledger, **Delivery challan** (submenu) |
| **Supply chain** | Procurement, Materials (flyout), Manufacturing (flyout), Purchase (flyout) |
| **Finance** | Payments hub, Advances & Expenses, Chart of accounts, Day book |
| **Reports** | Reports (submenu) |
| **Settings** | Settings (flyout, rendered separately at bottom) |

### Site Visits — Current Location

- **Section**: "Client and field"
- **Type**: Standalone leaf item (no submenu)
- **Path**: `/site-visits`
- **Module ID**: `site_visits`

### Equipment Warranty — Current Location

- **DOES NOT EXIST** as a sidebar entry or route. No `/warranty` route, no sidebar item, no `SIDEBAR_MODULE_MAP` entry.
- Warranty functionality is **embedded inside the ProjectList page** under an "Equipment & Warranty" tab (`src/pages/ProjectList.tsx:987`). It uses tables `project_equipment` and `warranty_claims` (defined in migration `092_field_service_long_term.sql`).
- Dashboard shows warranty SLA alerts (`src/pages/Dashboard.tsx:1008-1063`).

### Delivery Challan — Current Location

- **Section**: "Commerce"
- **Type**: Submenu (not flyout)
- **Items**: DC list (`/dc/list`), Create DC (`/dc/create`), NB-DC list (`/nb-dc/list`), Consolidation (`/dc/consolidation`)
- **Module ID**: `delivery_challans`

### SIDEBAR_MODULE_MAP (relevant entries)

```ts
'site-visit':       'site_visits',
'site-report':      'site_reports',
'client-communication': 'site_reports',
'dc':               'delivery_challans',
'non-billable-dc':  'delivery_challans',
```

### Module Registry

**File**: `src/config/module-registry.ts`

25 modules registered across categories: core, sales, inventory, procurement, projects, reports. The `useOrgModules` hook queries Supabase RPC `get_org_modules` and merges with `MODULE_REGISTRY` — new modules default to enabled.

---

## 2. SALES ORDER STATUS COMPUTATION AUDIT

### Table: `sales_orders`

**File**: `supabase/migrations/085_sales_orders_mrp.sql:10-36`

| Column | Type | Notes |
|---|---|---|
| `status` | `VARCHAR(30)` | CHECK: `draft`, `waiting_approval`, `open`, `in_production`, `partially_shipped`, `completed`, `cancelled` |
| `stock_status` | `VARCHAR(30)` | CHECK: `fully_reserved`, `partially_reserved`, `shortfall` |
| `created_at` | `TIMESTAMPTZ` | Default `NOW()` |
| `updated_at` | `TIMESTAMPTZ` | Default `NOW()`, updated by approval integration |
| `cancelled_at` | `TIMESTAMPTZ` | Set on cancellation |
| `closed_at` | `TIMESTAMPTZ` | Set on completion |

### Table: `sales_order_items`

**File**: `supabase/migrations/085_sales_orders_mrp.sql:71-87`

| Column | Type | Notes |
|---|---|---|
| `status` | `VARCHAR(30)` | CHECK: `pending`, `reserved`, `in_production`, `ready_to_ship`, `partially_shipped`, `shipped`, `cancelled` |
| `reserved_qty` | `DECIMAL(12,3)` | Auto-updated by trigger from `sales_order_reservations` |
| `produced_qty` | `DECIMAL(12,3)` | Auto-incremented by `trigger_auto_reserve_on_prod` |
| `shipped_qty` | `DECIMAL(12,3)` | **No trigger** — must be updated manually when DC is finalized |

### Table: `sales_order_reservations`

**File**: `supabase/migrations/085_sales_orders_mrp.sql:127-135`

| Column | Type | Notes |
|---|---|---|
| `sales_order_item_id` | `UUID FK` | References `sales_order_items` |
| `item_id` | `UUID FK` | References `materials` |
| `warehouse_id` | `UUID FK` | References `warehouses` |
| `qty` | `DECIMAL(12,3)` | CHECK: `> 0` |

### Existing "Blocker Reason" Computation

**YES — `get_dispatch_status()` RPC exists.**

**File**: `supabase/migrations/103_quick_lookup.sql:20-116`

Returns JSONB:

```json
{
  "status_label": "Blocked: Stock Shortfall" | "Blocked: Advance Payment Pending" | "Blocked: Pending Approval" | "Ready to Dispatch",
  "detail": "Shortage on items: ...",
  "so_status": "open",
  "stock_status": "shortfall",
  "payment_pending": 0
}
```

Priority logic:

1. `cancelled` → "Cancelled"
2. `completed` → "Completed"
3. `waiting_approval` → "Blocked: Pending Approval"
4. Unpaid invoices > 0 → "Blocked: Advance Payment Pending"
5. `stock_status = 'shortfall'` → "Blocked: Stock Shortfall"
6. `in_production` → "In Production"
7. `open` + `fully_reserved` → "Ready to Dispatch"
8. Else → `InitCap(status)`

**This RPC can be reused directly by Dispatch Queue.** You would call it per SO (or batch via a new wrapper RPC).

### "Days in Status" Calculation

- `updated_at` exists on `sales_orders` but is updated on ANY change (approval workflow, edit, etc.), not just status changes.
- `status_changed_at` does **NOT** exist on `sales_orders` (it exists only on `quotations` — migration `053_follow_up_quotation_workflow.sql`).
- **Closest option**: Use `updated_at` as an approximation. For accuracy, you would need to add a `status_changed_at` column via migration.

### Existing Triggers

| Trigger | File | Purpose |
|---|---|---|
| `trigger_sync_quotation_conversion` | `085_sales_orders_mrp.sql:214` | Locks quotation to `converted` when SO is active |
| `trigger_calculate_so_item_status` | `085_sales_orders_mrp.sql:252` | Computes item status from qty fields |
| `trigger_sync_so_stock_status_items` | `085_sales_orders_mrp.sql:280` | Recomputes SO header `stock_status` |
| `trigger_update_reserved_qty` | `085_sales_orders_mrp.sql:336` | Aggregates reservations into `reserved_qty` |
| `trigger_auto_reserve_on_prod` | `085_sales_orders_mrp.sql:365` | Auto-reserves on production receipt |

---

## 3. CLIENT COMMUNICATION REUSE FEASIBILITY

### `call_category` Values

**No CHECK constraint at database level.** The column is `VARCHAR(50) NOT NULL` with values enforced only in the frontend:

```ts
// src/pages/ClientCommunication.tsx:53-61
const CALL_CATEGORIES = [
  { value: 'incoming', label: 'Incoming Call' },
  { value: 'outgoing', label: 'Outgoing Call' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'sms', label: 'SMS' },
];
```

**Adding "ops_note" or "internal" category**: No schema change needed — just add to the frontend constant. No DB migration required.

### `linked_type` Values

Documented via `COMMENT ON COLUMN` (no CHECK constraint):

```
'quotation' | 'invoice' | 'podc' | 'site_visit' | 'sales_order'
```

The `sales_order` value was already added in migration `103_quick_lookup.sql:17`. **Ready to use.**

### `logged_by_role` Column

**Already exists** — added in migration `103_quick_lookup.sql:12-14`. Type `TEXT`. Currently only populated from `ClientLookup.tsx` (line 434).

### Full Column List (after all migrations)

| Column | Type | Source |
|--------|------|--------|
| `id` | UUID (PK) | Base table |
| `client_id` | UUID (FK clients) | Base table |
| `call_received_by` | UUID (FK auth.users) | Base table |
| `call_entered_by` | UUID (FK auth.users) | Base table |
| `call_type` | VARCHAR(50) | Base table |
| `call_category` | VARCHAR(50) NOT NULL | Base table |
| `call_category_other` | VARCHAR(255) | Base table |
| `call_regarding` | VARCHAR(100) NOT NULL | Base table |
| `call_regarding_other` | VARCHAR(255) | Base table |
| `call_brief` | TEXT | Base table |
| `next_action` | TEXT | Base table |
| `site_visit_id` | UUID (FK site_visits) | Base table |
| `is_site_visit_scheduled` | BOOLEAN | Base table |
| `site_visit_date` | TIMESTAMPTZ | Base table |
| `site_visit_notes` | TEXT | Base table |
| `status` | VARCHAR(50) | Base table |
| `priority` | VARCHAR(20) | Base table |
| `created_at` | TIMESTAMPTZ | Base table |
| `updated_at` | TIMESTAMPTZ | Base table |
| `linked_type` | VARCHAR(50) | `sql/client_communication_linked_items.sql` |
| `linked_id` | UUID | `sql/client_communication_linked_items.sql` |
| `assigned_to` | UUID (FK user_profiles) | `src/database-communication-assignee.sql` |
| `parent_communication_id` | UUID (FK self) | `src/database-communication-tier2.sql` |
| `attachments` | JSONB | `src/database-communication-tier2.sql` |
| `subject` | TEXT | `migrations/089_communication_subject_followup.sql` |
| `follow_up_date` | DATE | `migrations/089_communication_subject_followup.sql` |
| `is_resolved` | BOOLEAN | `migrations/102_add_next_actions_tracking.sql` |
| `next_action_acknowledged_by` | TEXT[] | `migrations/102_add_next_actions_tracking.sql` |
| `is_thread` | BOOLEAN | `sql/client_communication_entries.sql` |
| `entry_count` | INTEGER | `sql/client_communication_entries.sql` |
| `next_appointment_date` | TIMESTAMPTZ | `sql/client_communication_entries.sql` |
| `next_appointment_remarks` | TEXT | `sql/client_communication_entries.sql` |
| `logged_by_role` | TEXT | `migrations/103_quick_lookup.sql` |
| `party_type` | TEXT | *No SQL migration found* |
| `vendor_id` | UUID | *No SQL migration found* |
| `subcontractor_id` | UUID | *No SQL migration found* |
| `lead_id` | UUID | *No SQL migration found* |
| `organisation_id` | UUID | *No SQL migration found* |
| `project_id` | UUID | *No SQL migration found* |

### Existing UI Filtering

`ClientCommunication.tsx` already has a `call_category` dropdown filter (line 951). The filter is a simple equality check. Filtering for "internal ops notes only for this SO" would require:

1. Adding the new category value to `CALL_CATEGORIES`
2. Querying with `.eq('linked_type', 'sales_order').eq('linked_id', soId).eq('call_category', 'ops_note')`

No structural UI changes needed.

### RLS Concerns

**All RLS policies on `client_communication` are wide-open** — `USING (true) WITH CHECK (true)` for all authenticated users. Org-level filtering is done at the application layer. **No new RLS risk** from mixing internal notes with client-facing calls — but this means any user can read any communication record (pre-existing security gap).

### Risk: Mixing Internal vs External

- **Reporting**: Could be addressed by filtering on `call_category` or adding a boolean column `is_internal` if needed.
- **UI assumption**: The existing `ClientCommunication.tsx` treats all records uniformly. An "ops notes for this SO" view would need to filter by `linked_type = 'sales_order'` + `linked_id = <so_id>` + `call_category = 'ops_note'`. This is straightforward with existing query patterns.

---

## 4. EXISTING ACTION-ORIENTED PATTERNS

### Delivery Challan Generation

- **CreateDC component**: `src/pages/CreateDC.tsx` (1926 lines)
- Pre-population from **material intents** exists (reads `?intent_id=` query param, calls `loadIntentData`).
- Pre-population from **sales orders** does **NOT exist**. The FK `delivery_challans.sales_order_id` exists, but no "Create DC from SO" action button exists on SalesOrderDetail.
- **Action button needed**: Navigate to `/dc/create?sales_order_id=<id>` + implement pre-fill logic in CreateDC.

### Payment Reminder

- **WhatsApp payment reminders** exist in the Follow-Up Centre:
  - `src/lib/followup/whatsapp-builder.ts` — `buildInvoiceReminderMessage()` opens `wa.me/` URL
  - `src/hooks/use-whatsapp-share.ts` — `sendInvoiceReminder(invoice)` hook
  - `src/lib/followup/escalation-engine.ts` — 5-tier escalation stages:

| Stage | Days | Label | Recommended Action |
|---|---|---|---|
| 0 | < 0 (pre-due) | Pre-Due | Share payment link, measurement sheets |
| 1 | 0-6 | Due / Tier 1 | Send balance alert with quick payment shortcut |
| 2 | 7-14 | Tier 2 Overdue | Ask if invoice is stuck internally |
| 3 | 15-29 | Tier 3 Overdue | Request explicit expected payment date; escalate via email/SMS |
| 4 | 30+ | Tier 4 Critical | Urgent phone call; warn about hold on future dispatches |

- **No email/SMS reminders are wired** — approval notifications have email/SMS stubs that only `console.log` (`approvals/notifications.ts`).
- **Action button needed**: Reuse `useWhatsappShare().sendInvoiceReminder` with the invoice data fetched from the SO's linked invoices.

### MRP Shortage View

- **MrpRequirementModal**: `src/pages/sales/components/MrpRequirementModal.tsx` (309 lines) — full BOM-based raw material shortfall calculator, shows required vs available per material, with "Generate Purchase Orders" button.
- **StockCheckPanel**: `src/pages/sales/components/StockCheckPanel.tsx` (377 lines) — per-warehouse stock check with reservation UI.
- Both are accessible from SalesOrderDetail but are **modal/panel-based, not standalone routes**.
- **Action button needed**: Open `MrpRequirementModal` or `StockCheckPanel` from the Dispatch Queue row.

### Notifications Table

General-purpose `notifications` table used for routing in-app notifications:

```ts
// src/pages/ClientLookup.tsx:459-468
await supabase.from('notifications').insert({
  user_id: assignedToId,
  organisation_id: organisation?.id,
  title: `Client Call Logged: ${clientName}`,
  body: `Logged by ${userRoleSnapshot}. Action Required: ...`,
  link: '/follow-up'
});
```

---

## 5. ROLE / OWNERSHIP AUDIT

### `sales_orders` Ownership

**No `assigned_to`, `owner`, or `sales_rep` field exists.** Only `created_by` (UUID → `auth.users`).

The `ClientLookup.tsx` page hacks around this (line 359-360):

```ts
} else if (activeSO?.created_by) {
  setAssignedToId(activeSO.created_by);
}
```

### Existing Ownership Patterns Elsewhere

| Domain | Field | Model | File |
|---|---|---|---|
| **Leads** | `owner_user_id` + `owner_name` | Full ownership with round-robin/manual assignment rules | `src/types/leads.ts:77` |
| **Issues** | `assigned_to` + `assigned_to_name` | Simple assignee | `src/issues/types.ts:74` |
| **Client Communications** | `assigned_to` | Simple assignee | `src/pages/ClientCommunication.tsx:254` |
| **Projects** | `created_by` (no owner field) | Creator-based | — |

### Recommendation for Dispatch Queue

The Leads module's `owner_user_id` pattern is the most mature. For Dispatch Queue, you would need to:

1. Add `assigned_to UUID REFERENCES auth.users(id)` to `sales_orders` via migration
2. Add a UI for assigning/claiming SOs in the Dispatch Queue
3. Use the existing `user_profiles` join pattern for displaying the assignee name

---

## 6. COMPLEXITY & GAPS ASSESSMENT

### Is the "Thin Layer, Reuse client_communication" Approach Realistic?

**Yes — with caveats.**

#### What Works Well

- `linked_type = 'sales_order'` is already supported in the schema
- `logged_by_role` column already exists
- `call_category` has no CHECK constraint, so adding "ops_note" is frontend-only
- The `get_dispatch_status()` RPC already computes blocker reasons
- WhatsApp payment reminders and MRP modals already exist

#### What Creates Friction

| Gap | Impact | Mitigation |
|---|---|---|
| **No `assigned_to` on `sales_orders`** | Can't filter/route by owner | Add column via migration; follow Leads `owner_user_id` pattern |
| **No `status_changed_at` on `sales_orders`** | "Days blocked" calculation imprecise | Use `updated_at` as approximation, or add column via migration |
| **No "Create DC from SO" flow** | Dispatch Queue action button has no target | Implement pre-fill in CreateDC from SO data |
| **`shipped_qty` has no trigger** | SO item status won't auto-update when DC is finalized | Add trigger on DC finalization to update `shipped_qty` |
| **Equipment Warranty has no standalone route** | Can't group it under Operations sidebar | Create dedicated `/warranty` route or promote the ProjectList tab |
| **RLS on `client_communication` is wide-open** | Security concern for internal notes (but pre-existing) | Consider org-scoped RLS policy as separate improvement |
| **3 separate permission systems** | Confusion about which to use for `dispatch_queue.access` | Use the primary RBAC system (`src/rbac/`) |

### Items That Would Push Toward a Dedicated Dispatch Queue Schema

- **Aggregate metrics** (avg days blocked, blocker distribution) across all SOs — an RPC or materialized view would be needed (but could still query the existing tables)
- **Notification/assignment workflow** (e.g., auto-assign blocked SOs to dispatch team members) — the `notifications` table + `assigned_to` column would suffice
- **Audit trail of status changes** (e.g., "SO was blocked for stock 3 days, then payment 2 days") — you'd need a `sales_order_status_log` table

**None of these are required for v1.** The thin layer approach holds.

### Existing Pattern to Follow: Follow-Up Centre

The **Follow-Up Centre** (`src/pages/FollowUpCentre.tsx`, 1326 lines) is the closest architectural match for a filterable worklist view:

- Tab-based with per-tab row components
- URL-driven filter state (`useFollowupFilters` hook)
- Priority queue scoring across items
- Assign-to-user functionality
- WhatsApp sharing integration
- Item history drawer

| Component | File |
|---|---|
| Main page | `src/pages/FollowUpCentre.tsx` |
| Tab definitions | `src/components/follow-up/followup-tabs.tsx` |
| Filter bar | `src/components/follow-up/followup-filter-bar.tsx` |
| Filter hook | `src/hooks/use-followup-filters.ts` |
| Data hooks | `src/hooks/use-followup-data.ts` |
| Priority queue | `src/lib/followup/priority-queue.ts` |
| Escalation engine | `src/lib/followup/escalation-engine.ts` |
| Types | `src/types/followup.ts` |
| Row components | `src/components/follow-up/quotation-followup-row.tsx`, `podc-backlog-row.tsx`, `invoice-escalation-card.tsx`, `priority-queue-row.tsx` |

The Dispatch Queue should follow this same pattern: a new tab/page in the Follow-Up Centre cluster, or a standalone page with similar filter/row/action architecture.

---

## Summary of Required Migrations (v1)

| Migration | Purpose |
|---|---|
| Add `assigned_to UUID` to `sales_orders` | Owner/assignee for dispatch routing |
| Add `status_changed_at TIMESTAMPTZ` to `sales_orders` | Accurate "days blocked" calculation (optional — can use `updated_at`) |
| Add "ops_note" to frontend `CALL_CATEGORIES` | Internal ops notes in client_communication |
| Register `dispatch_queue` module in `MODULE_REGISTRY` | Sidebar visibility + enable/disable |
| Add `dispatch_queue.read` to RBAC permission catalog | Access control |

## Summary of Required Code Changes (v1)

| Change | Scope |
|---|---|
| New Dispatch Queue page | `src/pages/DispatchQueue.tsx` (or new tab in FollowUpCentre) |
| SO row component with blocker badge + actions | `src/components/dispatch/DispatchQueueRow.tsx` |
| Filter bar (blocker type, assignee, date range) | Reuse `useFollowupFilters` pattern |
| "Generate DC" action | Pre-fill CreateDC from SO data |
| "Send payment reminder" action | Reuse `useWhatsappShare().sendInvoiceReminder` |
| "View MRP shortage" action | Open `MrpRequirementModal` from queue row |
| "View stock check" action | Open `StockCheckPanel` from queue row |
| Operations sidebar cluster | Restructure Sidebar.tsx `menuData` |
| Equipment Warranty standalone route | Extract from ProjectList or create dedicated page |
