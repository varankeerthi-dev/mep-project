# PRD: Restore Missing UI Features — Materials Decomposition Follow-Up

> **Module:** Item Master (`apps/web/src/features/materials/`)  
> **Date:** July 18, 2026  
> **Status:** Open  
> **Goal:** Close the gap between the old monolithic `MaterialsList.tsx` and the new decomposed architecture — restore **Client ARC Pricing UI**, **collapsible form sections**, and **consistent section headers** without undoing the decomposition.

---

## Problem Statement

The original `MaterialsList.tsx` (~5640 lines) was decomposed into `features/materials/` for code maintainability. The existing PRD (`PRD-MATERIALLIST-DECOMPOSITION.md`) explicitly states: *"The goal is NOT to redesign functionality or UI. Users should not notice any difference."*

However, three categories of regression exist where the new UI does not match the old:

1. **Client ARC Pricing** — The database persistence layer and form hook fully support ARC pricing, but the UI was never built. Users cannot view or edit client-specific prices.
2. **Collapsible Form Sections** — The old form hid technical attributes behind a click-to-expand toggle. The new form shows all sections flat.
3. **Section Header Styling** — The old code used consistent `.item-form-section-header` / `.item-form-section-title` / `.item-form-section-hint` patterns. The new code uses bare `<fieldset>` / `<legend>` with no hints.

---

## 1. Client ARC Pricing (Highest Priority)

### Background

The `material_client_pricing` table stores per-client negotiated pricing using the ARC model:

| Field | Example |
|-------|---------|
| pricing_type | `Fixed ARC`, `Variable ARC`, `Discount`, `Special Price`, `Lumpsum` |
| rate | `1500.00` |
| valid_from / valid_to | `2026-01-01` / `2026-12-31` |
| status | `active`, `inactive`, `expired` |

Changes are audited via `material_client_pricing_history`.

### Old Code (MaterialsList.tsx)

The editor had a **two-sub-tab panel** under "Client Mapping":

```
┌─────────────────────────────────────────────┐
│  Client Mapping                              │
│  ┌──────────┬────────────┐                   │
│  │ Client   │ ARC/Pricing│  ← sub-tab bar   │
│  │ Code     │            │                   │
│  ├──────────┴────────────┤                   │
│  │                        │                  │
│  │  Tab A: Client Code    │                  │
│  │  ┌──────┬──────┬────┐  │                  │
│  │  │Client│PartNo│Desc│  │                  │
│  │  └──────┴──────┴────┘  │                  │
│  │                        │                  │
│  │  Tab B: ARC/Pricing    │                  │
│  │  ┌──────┬──────┬──────┐│                  │
│  │  │Client│Pricing│Rate ││                  │
│  │  │      │ Type  │     ││                  │
│  │  ├──────┼──────┼──────┤│                  │
│  │  │Valid │Valid │Status││                  │
│  │  │From  │ To   │     ││                  │
│  │  └──────┴──────┴──────┘│                  │
│  │  [Price History] btn   │                  │
│  └────────────────────────┘                  │
└─────────────────────────────────────────────┘
```

- Controlled by `clientMappingTab` state (`'code'` | `'pricing'`)
- Sub-tab bar: inline buttons with `borderBottom`/`color` toggles
- Tab A: `clientMappings[]` — client select, part no, description
- Tab B: `clientPricing[]` — client select, variant select, pricing type (dropdown: Fixed ARC / Variable ARC / Discount / Special Price / Lumpsum), rate, valid from/to dates, status (active/inactive/expired)
- **Price History button** — opens a modal/panel loaded from `material_client_pricing_history`

### New Code (Current State)

| Layer | ARC Pricing Support |
|-------|-------------------|
| **DB Schema** | ✅ `material_client_pricing` table exists with RLS |
| **Persistence** | ✅ `saveClientPricing()`, `fetchClientPricing()`, `fetchPricingHistory()` in `materialsPersistence.ts` |
| **Hook (useMaterialForm)** | ✅ `clientPricing` state, `loadClientPricing()`, `loadPricingHistory()`, ARC save in `handleSubmit()` (lines 314-324) |
| **Model** | ✅ `ClientPricingRow` interface in `model/aggregates/MaterialPricing.ts` |
| **ItemEditorDialog** | ❌ Does NOT receive `clientPricing` props or pass them to `ClientSection` |
| **ClientSection.tsx** | ❌ Only renders "Client Mappings" (part numbers). No sub-tabs. No ARC pricing fields. |

### Requirements

1. **`ItemEditorDialog`** — accept `clientPricing: ClientPricingRow[]` + `pricingHistory: any[]` + `onAddClientPricingRow`, `onRemoveClientPricingRow`, `onClientPricingRowChange`, `onShowPricingHistory` props. Pass all to `ClientSection`.

2. **`ClientSection.tsx`** — add a sub-tab bar:
   - Tab "Client Code" — existing part-number mapping table
   - Tab "ARC/Pricing" — new ARC pricing table with columns:
     - Client (select, required)
     - Variant (select, optional)
     - Pricing Type (select: `Fixed ARC` | `Variable ARC` | `Discount` | `Special Price` | `Lumpsum`)
     - Rate (number input)
     - Valid From (date input)
     - Valid To (date input)
     - Status (select: `active` | `inactive` | `expired`)
     - Actions (remove button)
   - **Price History** button — when clicked, loads history and shows a modal/panel

3. **`ItemsTab.tsx`** — pass `clientPricing`, `pricingHistory`, handlers through to `ItemEditorDialog`

4. **`useMaterialForm`** — expose `clientPricing`, `pricingHistory`, `setClientPricing`, `setPricingHistory`, `loadPricingHistory` (already done, just needs UI wiring)

---

## 2. Collapsible Form Sections

### Old Code

The Technical Attributes section was collapsible via a `showTechnical` boolean state:

```
┌──────────────────────────────────────┐
│ ▾ Technical Attributes     Internal  │  ← clickable header
│                         use         │
├──────────────────────────────────────┤
│  Size: [____]  Pressure: [____]      │
│  Make: [____]   Material: [____]     │
│  ...                                 │
└──────────────────────────────────────┘
```

Clicking the header toggled `showTechnical`. Only this section was collapsible. Other sections (Basic Information, Commercial, Variant Pricing, Inventory, Vendor Mapping, Client Mapping) were always visible.

### New Code

All sections are `<fieldset>` with `<legend>` — always expanded. No collapsible state, no click-to-toggle.

### Requirements

- Add `showTechnical` state (or similar) to `ItemEditorDialog` (or lift to `useMaterialForm`)
- **TechnicalSection** header should become clickable with a ▸/▾ chevron to expand/collapse
- All other sections remain always-visible (no change)

---

## 3. Consistent Section Header Style

### Old Code

Every section used this pattern:

```html
<div class="item-form-section">
  <div class="item-form-section-header">
    <h4 class="item-form-section-title">Section Name</h4>
    <span class="item-form-section-hint">Optional hint text</span>
  </div>
  <!-- fields -->
</div>
```

Examples:
| Section | Hint |
|---------|------|
| Basic Information | *(no hint)* |
| Technical Attributes | `Internal use` |
| Commercial / Pricing | *(no hint)* |
| Variant Pricing | `Leave blank to use default prices` |
| Inventory Tracking | `Track stock levels per warehouse` |
| Purchase & Vendor Mapping | `Map vendor-specific pricing` |
| Client Mapping | `Map client-specific part numbers and pricing` |

### New Code

Uses `<fieldset>` / `<legend>` tags — no hint text, no consistent styling:

```html
<fieldset class="border border-zinc-200 rounded-lg p-4 space-y-4">
  <legend class="text-sm font-semibold text-zinc-700 px-2">Basic Information</legend>
  <!-- fields -->
</fieldset>
```

### Requirements

- Replace bare `<fieldset>` / `<legend>` in every section component with the old header pattern
- Each section header should have:
  - A **title** (bold, consistent font)
  - An optional **hint** text (lighter color, smaller)
- For collapsible sections: the header should be clickable with a chevron indicator
- Visual style (borders, padding, background) should match the old `.item-form-section` pattern

Old CSS classes for reference (from `MaterialsList(2).tsx`):
| Class | Purpose |
|-------|---------|
| `.item-form-section` | Outer container with border, rounded corners, padding |
| `.item-form-section-header` | Flex container for title + hint, optional cursor pointer |
| `.item-form-section-title` | Bold section title |
| `.item-form-section-hint` | Smaller muted-text hint |

---

## 4. Additional UI Polish

Beyond the three main gaps, the old code had these UI characteristics that should be restored:

| Detail | Old Code | New Code | Action |
|--------|----------|----------|--------|
| Classification card color | Emerald/Green theme | Indigo theme | Restore green accent for classification cards |
| "Save Material" button text | "Save Material" | "Save Item" / "Update Item" | Restore "Save Material" / "Update Material" |
| Grid layout for classification | `grid-cols-4` (fixed) | `grid-cols-2 sm:grid-cols-4` (responsive) | Keep responsive approach but verify 4-column at desktop matches behavior |

---

## Files to Modify

| File | Changes |
|------|---------|
| `components/editor/ClientSection.tsx` | Major rewrite: add sub-tab bar, ARC pricing table, Price History |
| `components/editor/ItemEditorDialog.tsx` | Add `clientPricing` + `pricingHistory` props + handlers; pass to ClientSection; add `showTechnical` state; update section headers |
| `components/editor/TechnicalSection.tsx` | Make collapsible via `showTechnical` prop |
| `components/editor/BasicInformationSection.tsx` | Update to section header pattern |
| `components/editor/CommercialSection.tsx` | Update to section header pattern |
| `components/editor/VariantPricingSection.tsx` | Update to section header pattern |
| `components/editor/InventorySection.tsx` | Update to section header pattern |
| `components/editor/VendorSection.tsx` | Update to section header pattern |
| `page/ItemsTab.tsx` | Wire `clientPricing` state + handlers through to dialog |

---

## Non-Goals

- No DB schema changes — all tables already exist
- No persistence changes — save/load already works
- No restructuring of the module — files stay in their current locations
- No new features beyond restoring old behavior

---

## Acceptance Criteria

1. A user editing a material can:
   - See all 4 item classifications (when manufacturing is enabled)
   - Toggle Technical Attributes open/closed
   - See hint text under every section header matching old content
   - Switch between "Client Code" and "ARC/Pricing" sub-tabs
   - Add/edit/remove ARC pricing rows with all fields (pricing type, rate, dates, status)
   - Click "Price History" to view pricing audit trail
2. Save correctly persists client pricing to `material_client_pricing`
3. Edit correctly loads existing client pricing from DB
