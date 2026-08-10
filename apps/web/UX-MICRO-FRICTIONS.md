# UX Micro-Friction Report (Tactical) — MEP Project ERP

> Companion to `UX-REVIEW.md`. This document is the **per-component, per-interaction**
> level: the "this button makes the user click twice — move it here" fixes. No
> strategy, no missing features. Every item names the file, the line, the exact
> friction, and the concrete fix. Read top-to-bottom; each is independently shippable.
>
> Evidence files: `src/warehouse/WarehouseModule.tsx`,
> `src/invoices/components/InvoiceItemsEditor.tsx`,
> `src/components/QuickAccessBar.tsx`, `src/components/Sidebar.tsx`, `src/App.tsx`.

---

## A. Warehouse module

### A1. All 7 tab panels mount at once — double the work, slower load
**File:** `src/warehouse/WarehouseModule.tsx:57-77`
**Friction:** Every tab panel (`WarehouseDashboardPage`, `WarehouseDesignerPage`,
`WarehouseViewerPage`, `InventoryPage`, `OperationsPage`, `WarehouseReportsPage`,
`WarehouseListPage`) is rendered into the DOM on every visit and shown/hidden with
`display:none`. Consequences for the user:
- All 7 pages' data queries fire on entry even though 6 are hidden → slower first
  paint, wasted bandwidth, and the Viewer canvas / Designer keep running in the
  background while you're on Dashboard.
- Interactive state (scroll position, filters, selected bin in Viewer) is lost only
  when you leave the module, but memory/CPU stay busy the whole time.

**Fix:** Mount only the active tab. Keep a single `activeTabId` in state
(`useState`) instead of `display:none`, and render `<ActivePage />` conditionally:
```tsx
const PAGES: Record<string, React.ComponentType> = {
  dashboard: WarehouseDashboardPage,
  designer: WarehouseDesignerPage,
  viewer: WarehouseViewerPage,
  inventory: InventoryPage,
  operations: OperationsPage,
  reports: WarehouseReportsPage,
  warehouses: WarehouseListPage,
};
const ActivePage = PAGES[activeTab.id];
return (<div>{ActivePage && <ActivePage />}</div>);
```
Optionally keep the previous panel mounted during the fade-out if you want transition
preservation, but default to unmounting. This alone removes the "feels sluggish /
two loads" complaint.

### A2. Global search bar on the Viewer competes with the canvas
**File:** `src/warehouse/WarehouseModule.tsx:52-55`
**Friction:** `GlobalSearchBar` is rendered above the tabs on **every** screen,
including the Viewer (a full-screen spatial canvas where the user is clicking bins).
The search bar takes vertical space and a top-attention slot the Viewer doesn't need,
pushing the canvas down and diluting focus.

**Fix:** Render `GlobalSearchBar` only on Dashboard / Inventory / Operations / Reports
(tabular/list screens). Hide it on `viewer` and `designer` (spatial screens) where it
adds friction, or move it into a collapsible header triggered by `/` or a magnifier
icon.

### A3. No "new warehouse" entry point from the Warehouses tab
**File:** `src/warehouse/WarehouseModule.tsx` (Tabs + pages)
**Friction:** The `warehouses` tab lands on `WarehouseListPage`, but there is no
visible primary "Add warehouse" action in the module shell — users must know to go
through the Designer or a settings route. (Confirm in `WarehouseListPage.tsx`.)

**Fix:** Add a primary "New warehouse" button to the `warehouses` tab header,
matching the `InvoiceItemsEditor` "Add" pattern (top-right of the panel header).

---

## B. Invoice line-items editor

### B1. 18-column table forces horizontal scroll on a normal screen
**File:** `src/invoices/components/InvoiceItemsEditor.tsx:604-605`
**Friction:** The line-item table has ~18 columns (drag, #, material, HSN, item,
make, variant, warehouse, stock, qty, unit, rate, disc%, rate-after-disc, ARC, GST%,
custom, amount, delete) at 10–11px font inside `<div style={{ overflowX:'auto' }}>`.
On a 1366px laptop the row is wider than the viewport, so the user **must scroll
right to reach QTY / RATE / AMOUNT** — the fields they edit most. This is the
"line item takes the user to a wider screen, move that" issue.

**Fix (pick one, in order of preference):**
1. **Group into a card-per-row on narrow widths.** Below `lg`, render each item as a
   compact card (material + qty + rate + amount stacked) instead of an 18-col grid.
   Reuse `InvoiceItemsEditor` but switch container at a breakpoint.
2. **Freeze the action columns.** Keep MATERIAL / ITEM / QTY / RATE / AMOUNT visible
   and move HSN, MAKE, VARIANT, WAREHOUSE, STOCK, DISC% into a **per-row "details"
   expander** (chevron on the left) that reveals the secondary columns inline. Most
   invoices don't need make/variant/warehouse on every row.
3. **Sticky the right-most columns.** Make QTY, RATE, AMOUNT, and the delete button
   `position: sticky; right: 0` with a white background so they stay in view during
   horizontal scroll. Cheapest fix; do this even if you do #1/#2 later.

### B2. MATERIAL column is declared twice
**File:** `src/invoices/components/InvoiceItemsEditor.tsx:630-657`
**Friction:** Two near-identical `<th>MATERIAL</th>` blocks (`mode === 'itemized'` and
`mode !== 'itemized'`) both render the same `minWidth:150px` column, and the body
repeats the input twice (lines 865-1000). This is dead duplication — both branches
produce the identical column, so the `if/else` is pointless and doubles maintenance.

**Fix:** Collapse to a single MATERIAL column + single input block. Delete the
`mode === 'itemized'` / `mode !== 'itemized'` split since both render the same thing.

### B3. Make / Variant / Warehouse each need a separate click to open
**File:** `src/invoices/components/InvoiceItemsEditor.tsx:1045-1166`
**Friction:** MAKE (1045), VARIANT (1139), and WAREHOUSE each open their **own**
`position:fixed` dropdown, and you must click into each field to open it. For a row
that needs make + variant + warehouse, that's 3 separate open/click/close cycles per
row. The material dropdown already auto-selects the first variant+make on pick
(`handleMaterialSelect`, lines 338-345), but the user still has to manually open the
other two to confirm/change.

**Fix:**
- After picking a material, **auto-open the Variant dropdown** once if the material
  has >1 variant (chain: material select → variant dropdown opens), so the common
  variant-choice flows in one motion.
- Make/warehouse: pre-fill from the material's defaults (already done in
  `handleMaterialChange`) and only show the dropdown affordance on focus, not as a
  required extra click. If make has only one value, skip the dropdown entirely and
  show it as read-only text.

### B4. Inline add button is far from the row you're editing
**File:** `src/invoices/components/InvoiceItemsEditor.tsx:579-598`
**Friction:** "Add" lives only in the header. When you're on row 12 of a long
scrollable table, you must scroll back to the top to add a row (or the table scrolls
the new row out of view).

**Fix:** Also show a slim "+ Add line item" row at the **bottom** of the table body
(inside `<tfoot>` or as the last `<tr>`), so adding is always one click from where
you are. Reuse `append(createEmptyItem())`.

### B5. Deleting a row has no confirmation and is easy to misclick
**File:** `src/invoices/components/InvoiceItemsEditor.tsx` (delete `<td>` at end of
row, ~line 843 placeholder)
**Friction:** The remove control is a small `X` next to the drag handle with no
confirmation. On a dense 11px table a misclick deletes a filled line item and its
data (qty/rate/amount) is lost.

**Fix:** On delete, keep the row in local state for ~1s with an "Undo" affordance
(snackbar or inline) instead of instant removal; or require a confirm only when the
row has data. Mirrors the autosave/undo expectation from `UX-REVIEW.md §7.1`.

---

## C. Cross-component quick wins

### C1. Quick Create menu duplicates the sidebar (two paths, different sets)
**File:** `src/components/QuickAccessBar.tsx:71-77` vs `src/components/Sidebar.tsx`
**Friction:** The top "Create" menu lists Quotation/DC/Client/Invoice/PO; the sidebar
Sales section lists those plus BOQ, Sales Orders, Credit Notes. A user learning the
Create menu never discovers the others, and vice-versa. Picking where to start is
arbitrary.

**Fix:** Make the Create menu the **single** quick-create surface and include every
create-able document type (add BOQ, Sales Order, Credit Note, Proforma). Sidebar
items should navigate to **list** pages only, not duplicate create actions. (Ties to
`UX-REVIEW.md §6.1`.)

### C2. Global search only goes to clients (dead-end)
**File:** `src/components/QuickAccessBar.tsx:84-91`
**Friction:** Placeholder says "clients, projects, materials" but Enter navigates
only to `/clients?search=`. Type a project name → lands on clients list, blank.

**Fix (minimal, ships now):** Until a real global search exists, change the
placeholder to "Search clients…" so it does not over-promise. (Full fix in
`UX-REVIEW.md §5`.)

### C3. Sidebar collapse is not remembered
**File:** `src/App.tsx:286`, `src/components/Sidebar.tsx`
**Friction:** `sidebarCollapsed` resets to `false` every login; a user who collapsed
it must re-collapse each session.

**Fix:** Persist `sidebarCollapsed` (and any favorited items) in `localStorage` on
toggle and read it as the initial state.

---

## D. Suggested implementation order

1. **B1 (sticky right columns)** — smallest change, removes the most daily pain.
2. **A1 (mount only active tab)** — removes the "loads twice / sluggish" feeling.
3. **B2 (de-duplicate MATERIAL column)** — pure cleanup, low risk.
4. **B4 (bottom Add row)** + **B5 (undo delete)** — stops data loss, keeps flow.
5. **C3 (remember collapse)** + **C2 (honest placeholder)** — cheap polish.
6. **A2 / A3 / B3 / C1** — the larger reshaping; do after the quick wins land.

Each item is independently testable: open the invoice editor / warehouse module,
perform the described action, confirm the friction is gone. No shared refactor
required between items.
