# UX Micro-Friction Report — Part 2 (Tactical)

> Continuation of `UX-MICRO-FRICTIONS.md`. Same rule: per-component, per-interaction,
> with file + line + exact fix. No strategy. Each item is independently shippable.
> Evidence: `src/pages/CreateQuotation/components/QuotationItemsTable.tsx`,
> `src/features/materials/page/MaterialsPage.tsx`, `src/features/materials/page/ItemsTab.tsx`.
>
> Contrast worth noting: `MaterialsPage.tsx:53-65` already mounts **only** the active
> tab (the correct pattern `WarehouseModule` should copy — see Part 1 §A1).

---

## E. Quotation line-items table

### E1. "Add Row" is hidden until you scroll to empty-state / header
**File:** `src/pages/CreateQuotation/components/QuotationItemsTable.tsx:347-350`
**Friction:** The only "add" affordance is the empty-state message ("Click Add Row or
Add Bulk add") and the header action outside this file. Once rows exist, there is no
**per-row** or **bottom-of-table** add button — to add after row 20 you must scroll
back to the top header or rely on the auto-add-on-focus trick at line 436-438
(`if index === items.length - 1 → addEmptyItemRow()`), which only fires when you
focus the *last* row.

**Fix:** Add a full-width "+ Add line item" row as the **last `<tr>`** of the
virtualized body (or in a `<tfoot>`), always one click from wherever you are. Reuse
`addEmptyItemRow`. This mirrors the invoice fix in Part 1 §B4.

### E2. Make / Variant dropdowns each need a separate click
**File:** `src/pages/CreateQuotation/components/QuotationItemsTable.tsx:35-162`
(`MakeCell`, `VariantCell`)
**Friction:** Both cells render a `position:fixed` dropdown that only opens on click
(line 62, 134). For a row needing make + variant, that's two separate open/select
cycles. Worse, the dropdown is anchored with `openDropdownAtRef` using the input's
`getBoundingClientRect()` at open time — but the table is **virtualized on
`document.documentElement`** (line 253-255). If the user scrolls the page after the
dropdown opens, the fixed dropdown stays put while the row moves → dropdown detaches
from its cell (visual bug).

**Fix:**
- After the material/item is chosen, **auto-open the Variant dropdown** once when the
  item has >1 variant (chain the selection), so make+variant flow in one motion.
- The detachment bug: anchor the dropdown to the scroll container, not the document,
  OR close the dropdown on scroll (the `MakeCell`/`VariantCell` already close on
  `window` scroll via `handleScroll`, line 47-52 — but the *virtualizer* scrolls
  `document.documentElement`, which may not trigger `window` scroll reliably). Make
  the dropdown a child of the cell with `position:absolute` inside a
  `position:relative` cell instead of `position:fixed`, so it travels with the row.

### E3. Virtualizer scrolls the whole document, not the table
**File:** `src/pages/CreateQuotation/components/QuotationItemsTable.tsx:253-255`
**Friction:** `getScrollElement: () => document.documentElement` means the line-item
grid virtualizes against the **page** scroll, not an inner scroll area. On a long
quotation the whole app scrolls (sidebar/header move), and sticky headers / dropdowns
behave unpredictably. Users expect the table body to scroll within the form, keeping
the quotation header and action bar fixed.

**Fix:** Wrap the table in a bounded scroll container (e.g. `max-height: 60vh;
overflow-y:auto`) and point the virtualizer at that element. Keeps the quotation
header + action bar on screen, and fixes the E2 dropdown-detach class of bugs.

### E4. No in-cell validation/required marker on QTY / RATE
**File:** `src/pages/CreateQuotation/components/QuotationItemsTable.tsx:330-342`
**Friction:** QTY, RATE, AMOUNT columns have no visible "required" treatment and no
inline error if QTY is 0 or RATE is blank. A row can be saved with QTY=0 and the user
only finds out at submit. (Ties to `UX-REVIEW.md §7.2`.)

**Fix:** Mark QTY and RATE headers with a required asterisk; if a committed row has
QTY≤0 or empty RATE, show a small red cell-border + a top-of-form summary (reuse the
validation-summary pattern from §7.2).

### E5. Section header & sub-total rows use `×` with no confirm
**File:** `src/pages/CreateQuotation/components/QuotationItemsTable.tsx:380, 420`
**Friction:** Header and sub-total rows delete on a bare `×` button with no undo.
Deleting a section header silently drops every item grouped under it (data loss).

**Fix:** Same undo treatment as Part 1 §B5 — keep the row in local state ~1s with an
"Undo" snackbar, or require confirm only when the header has child rows.

---

## F. Materials module

### F1. 13 tabs in one SubTabsNav — the "Materials" label is a grab-bag
**File:** `src/features/materials/page/MaterialsPage.tsx:29-43`
**Friction:** The single "Materials" page mixes *catalog* tabs (Items, Service,
Category, Unit, Variants, Discount Categories, Warehouses) with *operations* tabs
(Material Inward, Outward, Stock Transfer, Stock Balance, Stock Check, Stock
Adjustment). A user opening "Materials" to find an item must scan 13 tabs; the
operations ones belong in the Supply-chain / Inventory area, not buried under
Materials. This is the same sprawl as the sidebar (Part 1 / `UX-REVIEW.md §2.1`) but
localized.

**Fix (local, no sidebar change needed):** Split into two SubTabsNav groups or add a
section divider: "Catalog" (Items, Service, Category, Unit, Variants, Discount
Categories, Warehouses) vs "Stock operations" (Inward, Outward, Transfer, Balance,
Check, Adjustment). Cheapest: render a non-interactive label row between the two
groups in the tab bar.

### F2. Switching tabs resets the whole page context
**File:** `src/features/materials/page/MaterialsPage.tsx:25-27`
**Friction:** `changeTab` does a full `navigate('/store/materials?tab=...')`, so each
tab switch is a route change that re-mounts the tab component and re-runs its data
queries. Moving Items → Variants → Items re-fetches Items twice. (Contrast: this is
the *good* mount-only-active pattern, but the route churn still refetches.)

**Fix:** Keep tab state in component state (or `useState` synced to the URL once) so
switching tabs doesn't remount already-loaded tabs; or wrap the tab data in
`React Query` with a shared stale time so re-mounts read cache instantly (they
already use Query, so this is mostly about avoiding the remount — lift the tabs out
of the route param or memoize).

### F3. ItemsTab has no skeleton while the materials query loads
**File:** `src/features/materials/page/ItemsTab.tsx:37` (`isLoading` is captured but
not used for a skeleton in the first 90 lines)
**Friction:** `useMaterialsPageData` returns `isLoading`, but the early render path
isn't shown to use a skeleton — if it renders an empty table or flashes, the user
sees a blank grid on first open. (Confirm the render branch; if it shows the table
with `materials=[]`, that's a blank flash, not a skeleton.)

**Fix:** While `isLoading`, render the `PageSkeleton` (exists at `App.tsx:40`) or a
table-shaped skeleton row count, so the grid never flashes empty.

---

## G. Cross-cutting (both modules)

### G1. Two different dropdown anchoring strategies
**Files:** `QuotationItemsTable.tsx:11-27` (`openDropdownAtRef`, `position:fixed` +
`getBoundingClientRect`) vs `InvoiceItemsEditor.tsx:524-563` (also `position:fixed`
but sets `top/left` in an effect). Both manually compute position and both can detach
on scroll. The warehouse/module `MakeCell` (E2) does the same.

**Fix (shared):** Extract one `<CellDropdown>` component (portal + `position:absolute`
inside a `relative` cell, closes on scroll/outside-click) and use it in all three
places. Removes ~120 duplicated lines and the detachment bugs in one move. This is
the highest-leverage small refactor in the UX layer.

### G2. "No items found" / empty messages are inconsistent
**Files:** `InvoiceItemsEditor.tsx:926, 994` ("No materials found"),
`QuotationItemsTable.tsx:349` ("No items added. Click Add Row or Add Bulk add."),
`ItemsTab` (likely its own empty state).
**Friction:** Three different tones/instructions for the same concept (empty list).
Users learn three patterns.

**Fix:** One `EmptyState` component (already proposed in `UX-REVIEW.md §5.2`) with a
consistent message + primary action; use it in all three.

---

## H. Suggested order for Part 2

1. **E3 (bound the table scroll)** — unblocks E2's detachment and improves the whole
   quotation feel; do first.
2. **E1 (bottom Add row)** + **E5 (undo delete)** — stop data loss, keep flow.
3. **G1 (shared CellDropdown)** — kills the duplication + scroll-detach across
   quotation, invoice, warehouse in one component.
4. **F1 (split Materials tabs)** + **F3 (ItemsTab skeleton)** — local list polish.
5. **E4 (required markers)** + **F2 (tab remount)** + **G2 (EmptyState)** — finish.

All items independently testable: open a quotation / the Materials page, perform the
action, confirm the friction is gone. No shared refactor required between items except
G1 (which is itself the cleanup).
