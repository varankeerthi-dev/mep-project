# MANUFACTURING MODULE — DESIGN DOCUMENT

**Version:** 1.1
**Date:** 2026-06-10
**Author:** System Architect
**Status:** Implementation Complete (Phase 1) — Revised per Gemini Review

---

## 1. What I Built and Why

I designed a manufacturing module that lives inside an existing MEP trading platform. The platform already handles procurement, inventory, sales, and projects. Several of our clients — pipe fabricators, sheet metal workshops, cable tray manufacturers — needed basic production workflows but didn't want to buy a separate ERP. So I extended the existing system rather than building a standalone one.

The core insight was this: **manufacturing is just inventory movement with a different name.** Raw materials leave a warehouse, go through a transformation process, and come back as finished goods. If I could model that as warehouse transfers, I wouldn't need a separate WIP stock table or a separate finished goods stock table. Everything would live in the same `item_stock` table that already powers the rest of the platform.

---

## 2. Architecture Decision: Warehouse-Based WIP

I rejected three alternative approaches before settling on warehouse-based WIP tracking:

| Approach | Why I Rejected It |
|----------|-------------------|
| Separate WIP stock table | Creates a second inventory engine. Now I have to reconcile two stock systems. Sales can't see WIP. DC can't deduct from WIP. Every report needs to join two tables. |
| Separate finished goods stock table | Same problem. FG becomes invisible to the existing sales and project modules. |
| In-memory WIP calculation | Fragile. If the app crashes mid-production, I lose track of what's on the floor. No audit trail. |

The warehouse-based model works like this:

```
Main Store (raw materials)
    ↓ materials issued
Production Floor / WIP Warehouse
    ↓ production complete
Finished Goods Store
    ↓ sold or used in project
Client / Site
```

Each arrow is a standard stock transfer. The same `item_stock` table tracks everything. The same `material_inward` / `material_outward` tables record every movement. Sales, DC, and reports all work automatically because they already query `item_stock`.

I identified three warehouses by purpose. Initially I used `warehouse_code` strings (`'WIP-001'`, `'FG-001'`), but Gemini correctly pointed out this is brittle — someone renames the code, or a second org creates conflicting codes. The revised approach adds a `warehouse_purpose` enum column to the `warehouses` table:

```sql
-- Add to warehouses table
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS warehouse_purpose VARCHAR(20) 
  CHECK (warehouse_purpose IN ('main', 'wip', 'fg', 'general')) 
  DEFAULT 'main';
```

The three manufacturing warehouses are now identified by purpose:
- **Main Store**: `warehouse_purpose = 'main'` (also `is_default = true`)
- **WIP Warehouse**: `warehouse_purpose = 'wip'`
- **FG Warehouse**: `warehouse_purpose = 'fg'`

Code-based lookup (`warehouse_code`) is kept as a fallback display field, but all programmatic identification uses `warehouse_purpose`. If any warehouse is missing its purpose assignment, the system throws a clear error naming the warehouse and what purpose it needs.

---

## 3. The Five-Entity Model

I designed five core entities that map to the production lifecycle:

### 3.1 Bill of Materials (BOM)

The BOM is a "recipe" — it defines which raw materials produce one unit of finished product. I kept it simple: a header (`bom_headers`) with product name, standard output quantity, and output unit, plus line items (`bom_items`) with material, required quantity, unit, and wastage percentage.

**Key design decisions:**
- `output_qty` and `output_unit` define the standard production unit. A pipe BOM might say "6 meters" as standard output. A panel BOM might say "10 nos."
- `wastage_pct` is per-material, not per-BOM. Different materials have different waste rates. Welding electrode wastes more than steel plate.
- `is_additional` flag on bom_items lets me distinguish standard BOM materials from ones added during production (consumables, packaging).
- Materials are filtered with `.eq('show_in_bom', true).eq('is_manufactured', false)` — only raw materials appear in BOM selection, never finished goods.

**Multi-level BOM constraint (Phase 1 limitation):** Currently, manufactured items have `show_in_bom = false`, which means a cable tray that uses a manufactured bracket can't reference the bracket's BOM. This is intentional for Phase 1 — sub-assemblies add significant complexity (recursive BOM explosion, sub-component stock tracking). The constraint is documented here so it doesn't get forgotten when a client eventually asks "can my finished product be an input to another BOM?" The answer in Phase 1 is no. The schema already supports it (the `product_id` FK on `bom_headers` can reference any material), but the UI and calculation logic don't yet handle recursive BOMs.

**Scaling formula:** When a user creates a job card for 120 meters from a BOM with 6-meter standard output, the system calculates: `scaling_factor = 120 / 6 = 20x`. Each material quantity is multiplied by 20, then by `(1 + wastage_pct / 100)`.

### 3.2 Production Schedule

The Production Schedule groups multiple products into a single planning unit. In pipe manufacturing, a shift might produce pipes, couplings, and elbows simultaneously — each with its own BOM, but planned together.

I added this because the PRD showed that production managers think in shifts, not individual products. A schedule lets them see aggregated material requirements across all products before committing to production.

### 3.3 Job Card

The Job Card is the core execution entity. It takes a BOM, scales materials to the planned quantity, and creates a material reservation. Status flows through: `draft → issued → in_progress → completed → cancelled`.

**Key design decisions:**
- Job card creation does NOT move stock. It only reserves materials. This is deliberate — planning shouldn't affect inventory.
- Stock moves only when status changes to `issued`. This separates the planning decision from the physical material movement.
- `actual_qty` and `yield_pct` are updated cumulatively as production entries come in. A single job card can have multiple production entries (partial production).
- `is_additional` materials can be added at job card time — things like welding rods, paint, or packaging that weren't in the original BOM.
- **Close job card action**: A job card at 99% completion is still `in_progress` under the current logic (cumulative actual < planned). Production managers need a way to say "material ran out, call it done at 95%." I added a "Close Job Card" action that transitions `in_progress → completed` even when actual < planned. The yield is recorded as-is (e.g., 95%). This avoids forcing managers to either hit 100% or cancel. The action requires confirming the final quantity and is logged to the activity trail.

### 3.4 Production Entry

The Production Entry records what actually happened on the shop floor. It captures actual quantity produced, material consumption per line item, wastage, and returns.

**Key design decisions:**
- Material return validation: `consumed + wastage + return = issued` must balance exactly. This is enforced in the UI and is the single most important validation rule in the system.
- Partial production is supported. A job card for 110 kg can be completed in two entries: 50 kg on Day 1, 60 kg on Day 2. The system tracks cumulative totals.
- Over-production is allowed but flagged. If planned was 100 and actual is 105, the yield shows 105% — which is fine, but the system records it.
- Finished goods are auto-created in the `materials` table with `is_manufactured = true` if they don't exist yet.

### 3.5 Activity Log

Every significant action is logged to `manufacturing_activity_log` with entity type, entity ID, action, JSONB details, user, and timestamp. SQL triggers handle job card status changes, production entry creation, and schedule creation automatically.

---

## 4. Stock Movement Flow — The Complete Picture

This is the heart of the system. Every stock movement follows a strict sequence:

### 4.1 BOM Created → No Stock Impact

Creating a BOM is pure planning. No materials move. No stock changes.

### 4.2 Job Card Created (Draft) → No Stock Impact

Materials are reserved (planned), but nothing leaves the warehouse. The `job_card_materials` table records what *will* be issued.

### 4.3 Job Card Issued → Main Store ↓, WIP ↑

When the user clicks "Issue Materials":

1. **Stock check**: For each reserved material, verify `current_stock >= planned_qty` in Main Store. If any material is short, block the entire issuance with a clear error message naming the material and the shortfall.

2. **Decrease Main Store**: `UPDATE item_stock SET current_stock = current_stock - qty WHERE item_id = ? AND warehouse_id = main_store`

3. **Increase WIP**: `UPDATE item_stock SET current_stock = current_stock + qty WHERE item_id = ? AND warehouse_id = wip_warehouse` (upsert — create the row if it doesn't exist)

4. **Record audit trail**: Insert into `material_outward` (parent) and `material_outward_items` (child) with material name, quantity, unit, warehouse.

5. **Update job_card_materials**: Set `issued_qty`, `status = 'issued'`, `warehouse_id = wip_warehouse`.

6. **Update job_cards**: Set `status = 'issued'`, `issued_at = now()`.

### 4.4 Materials Returned → WIP ↓, Main Store ↑

Before production completes, or anytime during production, unused materials can be returned:

1. **Decrease WIP**: `current_stock -= return_qty`
2. **Increase Main Store**: `current_stock += return_qty` (upsert)
3. **Record audit trail**: Insert into `material_inward` (parent) and `material_inward_items` (child) with `vendor_name = 'Production Return'`.
4. **Update job_card_materials**: Set `return_qty`, `status = 'returned'`.

### 4.5 Production Entry Submitted → WIP ↓, FG ↑

When the user submits a production entry:

1. **Decrease WIP** (consumed + wastage): `current_stock -= (consumed_qty + wastage_qty)`. Record in `material_outward_items`.

2. **Return unused** (if any): WIP ↓, Main Store ↑. Same as step 4.4.

3. **Add finished goods to FG Warehouse**:
   - Check if the product exists in `materials` table. If not, auto-create with `is_manufactured = true`, `allow_purchase = false`, `show_in_bom = false`.
   - Check if FG Warehouse has a stock row for this product. If yes, increment. If no, insert.
   - Record in `material_inward_items` with `vendor_name = 'Manufacturing'`.

4. **Update job card**: Set `actual_qty` (cumulative), `yield_pct`, `status` (completed if actual ≥ planned).

---

## 5. Edge Cases I Solved

### 5.1 Insufficient Stock at Issuance

If any material has insufficient stock in Main Store, the entire issuance is blocked. I check each material individually before starting any stock movements. The error message names the specific material and shows available vs. needed quantities.

### 5.2 Material Return Validation

The rule `consumed + wastage + return = issued` is enforced at two levels:
- **UI level**: The production entry form shows a "Balance" column that updates in real-time. If the balance goes negative, the row turns red and the submit button is disabled.
- **Business logic level**: Before submission, the system validates `allValid` — all materials must have non-negative balances.

If a user enters consumed=820, wastage=18.95, and return=0, the balance is 0 — perfectly balanced. If they want to return 10 kg instead, they must reduce wastage to 8.95 to keep the balance at 0.

### 5.3 Partial Production

A job card for 110 kg can be completed across multiple entries. The system:
- Shows "Previous entries produced: 50 kg" when creating Entry #2
- Computes cumulative actual_qty across all entries
- Updates `job_cards.actual_qty` and `yield_pct` after each entry
- Keeps status as `in_progress` until cumulative actual ≥ planned
- Transitions to `completed` automatically when the threshold is met

**Close Job Card (below 100%):** Sometimes production stops before hitting the planned quantity — material ran out, machine broke, order cancelled at 95%. The "Close Job Card" action lets a manager finalize at any percentage. The flow:
1. Manager clicks "Close Job Card" on an `in_progress` job card
2. System shows current cumulative actual vs. planned, current yield
3. Manager confirms final quantity (can adjust if needed)
4. Status transitions to `completed`, yield recorded as `(final_actual / planned) × 100`
5. Remaining WIP materials must be returned before closing (same validation as cancellation)
6. Activity log records the close action with reason

This is distinct from "Cancel" — close means "we produced what we could, mark it done." Cancel means "we're abandoning this entirely."

### 5.4 Over-Production

If cumulative entries exceed planned quantity (e.g., planned 100, actual 105), the system allows it. The yield shows 105%. The job card status becomes `completed`. No blocking — over-production is a valid business scenario (e.g., extra units produced to use up material).

### 5.5 Auto-Creation of Finished Goods

When a production entry is submitted, the system checks if the finished product exists in the `materials` table. If not, it auto-creates it with:
- `name`: from the job card's `product_name`
- `unit`: from the job card's `output_unit`
- `allow_purchase = false` (you don't buy what you manufacture)
- `allow_sales = true` (you sell finished goods)
- `show_in_bom = false` (finished goods don't go into other BOMs — Phase 1 limitation, see Section 3.1)
- `is_manufactured = true`

### 5.6 Warehouse Identification

Three warehouses are identified by the `warehouse_purpose` enum (revised from code-based lookup per Gemini review):
- **Main Store**: `warehouse_purpose = 'main'` (also `is_default = true`)
- **WIP Warehouse**: `warehouse_purpose = 'wip'`
- **FG Warehouse**: `warehouse_purpose = 'fg'`

The SQL migration adds the `warehouse_purpose` column with a CHECK constraint. The application code queries by purpose, not by `warehouse_code`. If any warehouse is missing its purpose assignment, the system throws an error naming the warehouse and what purpose it needs.

### 5.7 Same Material in Multiple Job Cards

If PP Granules are used in Job Card A and Job Card B simultaneously, each job card tracks its own `issued_qty`, `consumed_qty`, `wastage_qty`, and `return_qty` in `job_card_materials`. The warehouse stock is shared, but the per-job-card tracking is independent. The stock check at issuance time ensures total issued across all job cards doesn't exceed available stock.

### 5.8 BOM Modified After Job Card Created

The job card snapshots BOM data at creation time. Changes to the BOM after job card creation don't affect existing job cards. The `job_card_materials` table stores the actual quantities that were planned, independent of the current BOM state.

### 5.9 Cancelled Job Card with WIP Materials — One-Click Return + Cancel

This was flagged as a real operational problem in the Gemini review. The old design required users to manually return all materials one by one before cancelling — which means shop floor supervisors delay cancellations, creating drudgery and stale WIP stock.

**Revised design — one-click "Return All & Cancel":**

1. User clicks "Cancel Job Card" on a draft, issued, or in_progress card
2. System checks if any materials are in WIP (status = 'issued')
3. If WIP materials exist, show a confirmation modal:
   ```
   Cancel Job Card JC-2026-001?
   
   The following materials will be returned to Main Store:
   • PP Granules: 838.95 kg
   • Masterbatch: 27.40 kg
   • UV Stabilizer: 16.96 kg
   
   [Return & Cancel]  [Keep Job Card]
   ```
4. On confirm, the system atomically:
   a. For each issued material: WIP ↓, Main Store ↑ (upsert)
   b. Records material_inward + material_inward_items (vendor_name = 'Production Return — Cancelled')
   c. Updates job_card_materials: return_qty = issued_qty - consumed_qty - wastage_qty, status = 'returned'
   d. Updates job_cards: status = 'cancelled'
   e. Logs cancellation to manufacturing_activity_log with full material return details
5. If materials were already partially consumed, the return is for the remaining balance only (issued - consumed - wastage - existing_return)

This eliminates the manual drudgery. One click, all materials return, job card cancelled, audit trail complete.

### 5.10 Custom Units

The `custom_units` table lets users define units beyond the standard kg/mtr/nos/ft/sqm/cum. Predefined units have `organisation_id = NULL` (global). User-created units have `organisation_id` set. The UI filters units by type (length, weight, count, area, volume, custom).

### 5.11 Custom Fields

The `custom_fields` table lets users add metadata to BOMs, job cards, or production entries. A pipe manufacturer might add "Pressure Rating" (dropdown: PN10, PN16, PN20) or "UV Stabilized" (checkbox: Yes/No). Values are stored in `custom_field_values` using a polymorphic pattern: `entity_type` + `entity_id`.

---

## 6. Data Model Decisions

### 6.1 Why `item_stock` Instead of Separate Tables

The `item_stock` table already has `item_id`, `warehouse_id`, `variant_id`, `current_stock`, and `organisation_id`. It's the single source of truth for all inventory. By using warehouses for WIP and FG, I get:
- Automatic integration with sales (DCs can sell finished goods from FG Warehouse)
- Automatic integration with purchase (new raw materials go to Main Store)
- Stock reports that include WIP and FG without any extra code
- Transfer logic that's already proven and tested

### 6.2 Why `material_inward` / `material_outward` for Audit Trail

Rather than creating a separate audit table for manufacturing, I reused the existing `material_inward` and `material_outward` tables. Every stock movement — issuance, return, finished goods addition — creates a parent record and child items. This means:
- The existing warehouse reports automatically include manufacturing movements
- The existing audit trail UI shows manufacturing activity alongside purchase and sales activity
- No duplicate audit infrastructure

### 6.3 Operational Flags vs. Rigid Item Types

I added `allow_purchase`, `allow_sales`, `show_in_quotation`, `show_in_bom`, and `is_manufactured` flags to the `materials` table instead of a rigid `item_type` enum. This allows:
- A welding rod to be purchased, used in BOM, and sold to a sister concern
- A finished pipe to be manufactured and sold, but not purchased
- A raw material to be used in BOM but not shown in quotations

### 6.4 Activity Log as JSONB

The `action_details` column uses JSONB so different entity types can store different detail structures. Job card logs store old/new status. Production entry logs store entry_no, job_card_id, actual_qty. This flexibility means I don't need separate log tables for each entity type.

---

## 7. UI Design Principles

### 7.1 Button Standards

All buttons use `h-10 px-5` (40px height, 20px horizontal padding). Primary actions use `bg-blue-600 text-white`. Secondary actions use `border border-zinc-200 text-zinc-700`. All buttons have `rounded-lg font-medium hover:transition-colors`.

### 7.2 Table Standards

Tables use `px-6 py-4` for cell padding (24px horizontal, 16px vertical). Headers use `text-sm font-medium text-zinc-500`. Rows have `border-b border-zinc-100` with `hover:bg-zinc-50 cursor-pointer` for interactive rows. Every table has left-aligned text.

### 7.3 Three-Dot Menus

Every list view has a three-dot menu (`⋮`) in the rightmost column. The menu uses `relative inline-block` positioning with a floating dropdown (`absolute right-0 mt-1 w-48 bg-white border border-zinc-200 rounded-lg shadow-lg z-10`). Click outside closes the menu via a `mousedown` event listener on `document`.

### 7.4 Pagination

Pagination sits at the bottom of every table inside the same card container. It shows "Showing X–Y of Z" on the left and page buttons on the right. Page buttons use `h-8 w-8 rounded text-sm font-medium` with `bg-blue-600 text-white` for the active page.

### 7.5 Container Spacing

All cards and containers use `p-6` (24px padding). Sections within a page are separated by `space-y-6` or `gap-6`. The page itself uses `p-6` for outer padding.

### 7.6 Form Layout

Forms use a two-column layout on large screens: `grid grid-cols-1 lg:grid-cols-3 gap-6` with the main content taking `lg:col-span-2` and a sticky summary sidebar taking `lg:col-span-1`. Inputs use `h-10 px-4 border border-zinc-200 rounded-lg focus:outline-none focus:border-blue-500`.

---

## 8. File Inventory

### Created

| File | Lines | Purpose |
|------|-------|---------|
| `src/database-manufacturing.sql` | 900 | Complete SQL migration: tables, RLS, triggers, functions |
| `src/pages/manufacturing/ManufacturingDashboard.tsx` | — | Manufacturing overview dashboard |
| `src/pages/manufacturing/BOMList.tsx` | 216 | BOM list with search, filter, three-dot menus, pagination |
| `src/pages/manufacturing/BOMEditor.tsx` | 403 | BOM create/edit with material selection |
| `src/pages/manufacturing/ProductionScheduleList.tsx` | — | Production schedule list |
| `src/pages/manufacturing/ProductionScheduleEditor.tsx` | — | Production schedule create/edit |
| `src/pages/manufacturing/JobCardList.tsx` | — | Job card list with three-dot menus, pagination |
| `src/pages/manufacturing/JobCardCreate.tsx` | 376 | Job card creation from BOM with material scaling |
| `src/pages/manufacturing/JobCardDetail.tsx` | 621 | Job card detail with Issue/Return stock transfers |
| `src/pages/manufacturing/ProductionEntryForm.tsx` | 775 | Production entry with WIP↓, FG↑, material return validation |
| `src/pages/manufacturing/CustomUnits.tsx` | — | Custom units CRUD |
| `src/pages/manufacturing/CustomFields.tsx` | — | Custom fields CRUD |
| `src/pages/manufacturing/ActivityLog.tsx` | — | Read-only activity log viewer |

### Modified

| File | Change |
|------|--------|
| `src/App.tsx` | Lazy imports + routes for all 12 manufacturing pages |
| `src/components/Sidebar.tsx` | Manufacturing section with 8 submenu items |
| `src/pages/MaterialsList.tsx` | Manufacturing Flags section (4 toggles) |

---

## 9. What's Not Yet Built

| Feature | Priority | Why It Matters |
|---------|----------|----------------|
| Refactored hooks | **P0** | All data fetching is inline in page components. `JobCardDetail.tsx` is 621 lines, `ProductionEntryForm.tsx` is 775 lines — both with interleaved query logic. Extracting `useBOMs`, `useJobCards`, `useProductionEntries`, `useManufacturingWarehouses` pays compound interest: dashboard enhancements, analytics, and every new feature become trivial to bolt on. Without this, each new page复制s the same 40-line query block. |
| One-click return + cancel | **P0** | Operational pain point. Supervisors delay cancellations without this. Design in Section 5.9. |
| Close job card action | **P0** | Production managers need to finalize below 100%. Design in Section 3.3 and 5.3. |
| Warehouse purpose enum | **P0** | Replace brittle code-based warehouse lookup. SQL in Section 2. |
| Dashboard enhancements | P1 | Currently basic. Needs avg yield, wastage %, WIP value, FG stock, active job cards table |
| Wastage variance analytics | P1 | Planned vs actual comparison per material |
| Additional materials on job card | P2 | Add materials not in BOM during production (`is_additional = true`) |
| Schedule-level job card creation | P2 | Create all job cards from a production schedule at once |
| Custom field values rendering | P2 | Display custom field values on BOM/Job Card/Production Entry forms |
| Over-production flagging | P2 | Allow but flag when actual > planned |
| Batch number tracking | P3 | Schema supports it, UI doesn't yet |
| Multi-level BOMs | P3 | Schema ready, UI/calculation logic not built. See Section 3.1 constraint. |

---

## 10. Testing Strategy

The full flow should be tested end-to-end:

1. **Create a BOM** with 3 materials, each with different wastage %
2. **Create a Production Schedule** grouping 2 products
3. **Create a Job Card** from the BOM, verify material scaling
4. **Issue Materials** — verify Main Store decreases, WIP increases, audit trail recorded
5. **Return partial materials** — verify WIP decreases, Main Store increases
6. **Submit Production Entry** — verify WIP decreases (consumed+wastage), returns go back, finished goods appear in FG Warehouse
7. **Verify yield calculation** — actual / planned × 100
8. **Verify material balance** — consumed + wastage + return = issued for every material
9. **Check activity log** — all actions recorded with user and timestamp
10. **Check stock reports** — WIP warehouse shows current production materials, FG warehouse shows finished goods

---

**Document prepared by:** System Architect
**Date:** 2026-06-10
**Status:** Phase 1 Complete — Revised per Gemini Review (v1.1)
**Changes from v1.0:** warehouse_purpose enum, one-click return+cancel, close job card action, multi-level BOM constraint documented, refactored hooks promoted to P0
