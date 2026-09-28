# Materials Item Type Consolidation — Service Items into Items Tab

**Status:** Draft  
**Date:** 2026-09-24  
**Scope:** `src/features/materials` — Item editor, items table, item viewer, MaterialsPage tabs  
**Related:** `MATERIAL_TYPES` constant, `service_rates` table, existing `ServiceTab` / `ServiceRatesTab`

---

## 1) Objective

Reduce context switching and duplicate form logic by folding Service Items into the main Items tab, while preserving Service Rates as a standalone rate-card domain.

Primary outcome:
- Single item creation/edit flow for Product / Service / Kit.
- Type-driven field visibility: services skip inventory, warehouse, variants, vendor/client mapping, warranty, serial tracking.
- Existing `service_rates` CRUD remains untouched under its own tab.

---

## 2) Scope

In scope:
- `item_type` selector in `ItemEditorDialog` (Product / Service / Kit).
- Conditional section rendering/unmounting in editor based on type.
- Service-specific field behavior: auto `SVC-` code on create, SAC label swap, GST defaults.
- `item_type` badge column in items table + side drawer.
- Conditional tabs in `ItemDetailsDialog` by type.
- Removal of `ServiceTab` from `MaterialsPage` after editor supports services.
- Schema/validation adjustments for service items.

Out of scope:
- Moving `ServiceRatesTab` under item viewer.
- Changing `service_rates` data model or CRUD.
- Renaming or removing `ServiceRatesTab` from Materials page tabs.
- Backend table changes (materials table already has `item_type`).

---

## 3) Design Principles

1. Single catalog, single creation flow.
2. Type-driven simplification: hide irrelevant fields by unmounting, not disabling.
3. Always respect existing `item_type` on edit; never overwrite mid-edit.
4. Service Rates stay separate: they are rate cards, not item properties.
5. No breaking changes to existing Product or Kit flows.
6. Item-level `sale_price` for a service can exist as a fallback, but project-specific pricing defaults come from Service Rates.

---

## 4) Users

- Stores / Inventory team creating catalog items.
- Engineers / Estimators selecting services for BOQ / Quotation.
- Accounts / Finance viewing HSN/SAC for tax.
- Procurement team linking vendors to products (not services).

---

## 5) Functional Requirements

### FR-1 Item Type Selector

- Location: top of `ItemEditorDialog`, above Basic Information.
- Options: Product / Service / Kit.
- Default on create: Product.
- On edit: pre-filled from existing `item_type`, locked until user changes.
- When type changes mid-form: reset type-specific fields to safe defaults.

### FR-2 Conditional Editor Sections

When `item_type` is:
- **Product / Kit**: all sections visible (current behavior).
- **Service**: unmount the following sections entirely:
  - Accounting & Item Classification GL overrides
  - Inventory / Warehouse Stock
  - Variant Pricing
  - Vendor Mapping
  - Client Mapping
  - Warranty & Serial Tracking
  - Additional Information (unless needed later)
- Visible sections for Service:
  - Basic Information (Name, Display Name, Code, Category, Unit, HSN/SAC → SAC; Description is the default for transaction lines and is editable per line at transaction time)
  - Technical Attributes (if applicable)
  - Commercial / Pricing (Sale Price, Purchase Price, GST)
  - Discount Category

### FR-3 Service-Specific Field Behavior

- **Service Code**: auto-generate `SVC-` + unique suffix on create only. On edit, preserve existing code.
- **SAC Label**: swap HSN/SAC label to SAC when type is Service. Swap back on Product/Kit.
- **GST Default**: retain existing default (18%) for both types.
- **Unit**: show same unit selector; services typically use Job / Hour / Day but allow any.
- **Active Toggle**: visible for all types.

### FR-4 Form Validation

- When type is Service:
  - Skip validation for inventory, warehouse, variant, vendor/client fields.
  - Ensure SAC field validation (required, numeric format) applies to Service.
  - Ensure HSN field validation applies to Product/Kit.
- Zod/Yup schema must dynamically adjust based on type.

### FR-5 Items Table Badge

- New column: Type (after Project / before Status).
- Badge colors:
  - Product: green (`bg-green-50 text-green-700 border-green-200`)
  - Service: blue (`bg-blue-50 text-blue-700 border-blue-200`)
  - Kit: purple (`bg-purple-50 text-purple-700 border-purple-200`)
- Tooltip on hover: "Product", "Service", "Kit".
- Sorting: optional, not required for v1.

### FR-6 Item Details Dialog Tabs

When `item_type` is:
- **Product**: tabs = Overview, Warehouse, Adjustments, Transactions, Audit.
- **Service**: tabs = Overview, Transactions, Audit.
  - Warehouse and Adjustments hidden.
- **Kit**: tabs = Overview, Warehouse, Transactions, Audit.

Service Rates are not embedded in the Item Details dialog; they remain in the dedicated Service Rates tab.

### FR-7 MaterialsPage Integration

- Remove `ServiceTab` from `MaterialsPage` tab list once editor supports service items.
- Keep `ServiceRatesTab` in tab list as its own entry (label: "Service Rates").
- Existing service items in DB (where `item_type = service`) must load correctly in editor with only service fields visible.

---

## 6) Data Model (High-Level)

No new tables required.

Existing `materials` table already has:
- `item_type` column (values: `product`, `service`, `kit`).
- `item_code`, `name`, `display_name`, `unit`, `sale_price`, `purchase_price`, `hsn_code`, `gst_rate`, `is_active`.

Editor form shape changes:
- Add `item_type` to `MaterialEditorFormData` if not present.
- Ensure `item_classification` / `accounting_treatment` are optional for Service type.

`service_rates` table remains unchanged:
- Columns: `item_name`, `default_erection_rate`, `unit`, `gst_rate`, `sac_code`, `is_active`.
- CRUD in `ServiceRatesTab` unaffected.

---

## 7) UX Model

### Creation Flow

1. User clicks **Add Item**.
2. `ItemEditorDialog` opens with type selector defaulted to Product.
3. User selects Service.
4. Editor collapses sections, swaps HSN label to SAC, shows compact service fields.
5. Description pre-fills a sensible default (e.g. "Erection charges for [item name]") but this is not client-specific.
6. On save: `SVC-` code auto-generated if empty.

### Edit Flow

1. User clicks existing row.
2. Editor opens with type pre-filled.
3. If Service: only service fields shown.
4. User can switch type mid-edit (with confirmation if dirty).

### Table Scan

1. User views items table.
2. Type badge column immediately distinguishes Product / Service / Kit.
3. Filter by type: optional v2.

### Viewer Flow

1. User clicks row to view details.
2. Tabs adjust by type.
3. Service items skip warehouse/adjustment tabs.

---

## 8) Non-Functional Requirements

- No breaking changes to existing Product/Kit create/edit flows.
- Existing service items in DB must render without errors.
- Form state cleanup: unmounting sections must not leave orphaned react-hook-form fields.
- Service code generation: idempotent, collision-safe.

---

## 9) Phase Plan

### Phase 0: PRD + Baseline (This phase)

Deliverables:
- This PRD committed to repository.
- Baseline file touch list + risk register.

Exit criteria:
- PRD reviewed and approved.
- Git commit exists before coding starts.

### Phase 1: Model & Types

Deliverables:
- `item_type` field in `MaterialEditorFormData` with `MATERIAL_TYPES` values.
- `isServiceItem`, `isProductItem`, `isKitItem` type guards.
- `getItemTypeConfig(type)` util returning visible sections, field overrides, code generation rules.

Exit criteria:
- Types compile.
- Util returns correct config for all three types.

### Phase 2: Editor Core

Deliverables:
- `ItemEditorDialog`: item_type selector near top.
- Conditional section unmounting based on config.
- Service-specific field behavior: SAC label, auto code on create.
- Zod schema dynamic adjustment on type change.

Exit criteria:
- Creating Service hides all irrelevant sections.
- Editing existing Service loads correctly with only service fields.
- Product/Kit unchanged.

### Phase 3: Table & Viewer

Deliverables:
- `ItemsTable`: item_type badge column.
- `ItemDetailsDialog`: conditional tabs by type.

Exit criteria:
- Badge renders with correct color and tooltip.
- Service viewer skips Warehouse/Adjustments.

### Phase 4: Page Integration

Deliverables:
- Remove `ServiceTab` from `MaterialsPage`.
- Keep `ServiceRatesTab` in tab list.
- Smoke test existing DB service items.

Exit criteria:
- Materials page no longer shows Service tab.
- Service Rates tab CRUD intact.
- No console errors on load.

### Phase 5: Polish & Cleanup

Deliverables:
- Remove `@ts-nocheck` from old service components if deleted.
- Audit dead code after ServiceTab removal.
- QA all three types (Product, Service, Kit).

Exit criteria:
- Zero console errors.
- All acceptance criteria met.

---

## 10) Migration Strategy

- No DB migration needed (`item_type` column exists).
- Additive UI change: existing Product/Kit flows untouched.
- Feature flag not required; can toggle via type selector immediately.
- Smoke test with existing service items from DB before removing ServiceTab.

---

## 11) Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Editor form state leaks hidden fields | Unmount sections (conditional render), do not disable/hide with CSS |
| Zod schema rejects service items | Dynamically adjust schema on type change; test all three types |
| Service code collision on create | Use `Date.now()` + `Math.random()` or DB-level unique constraint |
| Existing ServiceTab removal breaks routes | Keep ServiceRatesTab; remove only ServiceTab after editor verified |
| react-hook-form registers unmounted fields | Use `key` + conditional render; clear field array on unmount |
| HSN/SAC label swap confuses users | Show helper text: "SAC for services, HSN for products" |
| Attempting to store client/PO-specific descriptions in catalog | Enforce transaction-line level description override; do not add `client_description` to `materials` table |

---

## 12) Success Metrics

- Single creation flow for all item types.
- Service creation time reduced by ~50% (fewer fields).
- Zero validation errors when switching type mid-form.
- Existing service items in DB load without errors.
- Service Rates CRUD unaffected.
- No regression in Product/Kit create/edit flows.

---

## 13) Acceptance Criteria

- [ ] Creating a new Service hides inventory/warehouse/variants/vendor/client/warranty fields and auto-generates unique `SVC-` code.
- [ ] Editing an existing service item loads correctly with only service fields visible.
- [ ] Products and Kits remain unchanged functionally.
- [ ] Service Rates CRUD remains fully functional under its dedicated tab.
- [ ] No console errors when switching between types mid-form.
- [ ] `item_type` badge renders with correct color in table and viewer.
- [ ] Viewer tabs adjust by type (Service skips Warehouse/Adjustments).

---

## 14) Execution Protocol

1. Commit this PRD first.
2. Implement phase-by-phase only.
3. Do not start next phase without explicit sign-off on exit criteria.
4. Smoke test with real DB service items after Phase 2.
5. Remove ServiceTab only after Phase 4 sign-off.
