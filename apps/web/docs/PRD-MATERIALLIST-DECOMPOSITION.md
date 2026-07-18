# PRD: Item Master Component Decomposition

> **Module:** Item Master (`apps/web/src/pages/MaterialsList.tsx`)  
> **Date:** July 16, 2026  
> **Status:** In Progress  
> **Goal:** Transform 5600+ line God Component into modular, feature-based architecture

---

## Objective

The current `MaterialsList.tsx` has grown into a 5600+ line God Component containing 11 components, 50+ useState hooks, and interleaved business logic for 10+ distinct domains.

**The goal is NOT to redesign functionality or UI.**

- No business logic should change
- No database changes
- No UI redesign
- Users should not notice any difference
- Only improve the internal architecture

---

## Current State Analysis

### File Structure
```
MaterialsList.tsx (5605+ lines)
├── Imports & Constants (lines 1-190)
├── TabButton (lines 197-210)
├── ItemsTab (lines 213-4265) ← GOD COMPONENT (~4050 lines)
│   ├── 50+ useState hooks
│   ├── loadItemTransactions() — 8 parallel + 4 sequential Supabase queries
│   ├── handleSubmit() — 200+ lines saving 6+ entity types
│   ├── Bulk price update logic
│   ├── Column settings
│   ├── Audit trail
│   ├── Excel edit mode
│   └── Form state for 20+ fields
├── ServiceTab (lines 4266-4456)
├── ServiceRatesTab (lines 4457-5024)
├── CategoryTab (lines 5025-5125)
├── UnitTab (lines 5126-5256)
├── WarehousesTab (lines 5257-5361)
├── VariantsTab (lines 5362-5442)
├── DiscountCategoriesTab (lines 5443-5542)
├── generateSelectiveTemplate (lines 5543-5604)
└── MaterialsList (lines 5605+) — Main composition component
```

### Key Dependencies
- `useMaterialsPageData` — parallel query hook (already extracted)
- `useMaterials`, `useWarehouses`, `useVariants`, `useUnits` — individual query hooks
- `BulkImportModal`, `ExcelEditor` — feature components
- `AppTable`, `Modal`, `Button`, `Input`, `Badge`, `Card`, `Checkbox` — UI components
- `useAuth` — organization context
- `supabase` — direct database access

---

## Guiding Principles

1. **Feature-based organization** — split by business domain, not file size
2. **Each module owns** — UI, hooks, local state, dialogs, forms, business logic
3. **Parent becomes** — lightweight composition layer (<500 lines)
4. **No shared state** for unrelated features
5. **Services call repositories** — Components → Hooks → Services → Database
6. **Preserve all existing behavior** — zero user-visible changes

---

## Target Folder Structure

```
features/materials/
├── page/
│   └── MaterialsPage.tsx          # Lightweight composition (<500 lines)
├── overview/
│   └── OverviewTab.tsx            # Core item details, category, SKU, units, status
├── pricing/
│   ├── PricingTab.tsx             # Purchase/sales prices, price lists
│   ├── PriceDialogs.tsx           # Price history, price import
│   └── ClientPricingTab.tsx       # Client mapping, ARC pricing
├── inventory/
│   ├── InventoryTab.tsx           # Warehouse stock, opening stock
│   └── WarehouseStockDialog.tsx   # Stock adjustments
├── vendors/
│   └── VendorsTab.tsx             # Preferred vendor, vendor mapping
├── variants/
│   └── VariantsTab.tsx            # Item variants, variant CRUD
├── transactions/
│   └── TransactionsTab.tsx        # Quotation/invoice/purchase/DC references
├── audit/
│   └── AuditTab.tsx               # Audit trail, activity timeline
├── import/
│   └── BulkImportDialog.tsx       # Excel import, bulk paste
├── export/
│   └── ExportDialog.tsx           # Excel/CSV export
├── service/
│   ├── ServiceTab.tsx             # Service items
│   └── ServiceRatesTab.tsx        # Service rate management
├── settings/
│   ├── CategoryTab.tsx            # Item categories
│   ├── UnitTab.tsx                # Item units
│   ├── WarehouseTab.tsx           # Warehouse management
│   └── DiscountCategoriesTab.tsx  # Discount categories
└── shared/
    ├── MaterialHeader.tsx         # Shared header component
    ├── MaterialToolbar.tsx        # Shared toolbar (search, filters, actions)
    ├── MaterialDialogs.tsx        # Shared dialogs (delete confirmation, etc.)
    └── types.ts                   # Shared TypeScript types
```

---

## Feature Responsibilities

### Overview
- Core Item Details (name, code, display name)
- Category, Sub-category
- SKU, Size, Pressure Class
- MAKE, Material, End Connection
- Unit, Alternative Units
- Status (Active/Inactive)
- Item Classification (Finished Good, Raw Material, Consumable, Goods Sold)
- Track Inventory toggle
- Uses Variant toggle
- Dimension, Weight

### Pricing
- Purchase Price
- Sale Price
- GST Rate, HSN/SAC Code
- Discount Category
- Variant Pricing (per-variant sale/purchase prices)
- Price History

### Inventory
- Warehouse Stock (per-warehouse, per-variant)
- Opening Stock
- Stock Adjustments (Inward/Outward)
- Low Stock Level

### Vendors
- Preferred Vendor
- Vendor Mapping (vendor_id, base_rate, discount_percent)
- Vendor Codes

### Clients
- Client Mapping (client_id, part_no, description)
- Client Pricing (ARC — Fixed ARC pricing with validity dates)

### Transactions
- Quotation References
- Purchase References (Inward)
- Invoice References
- Delivery Challan References
- Stock Movements

### Audit
- Audit Trail (DB + localStorage)
- Activity Timeline
- User Actions (Created, Updated, Bulk Price Update)

### Import
- Excel Import (BulkImportModal)
- Bulk Paste (parse tab-delimited data)
- CSV Import
- Validation

### Export
- Excel Export
- CSV Export
- Selective Template Generation

### Service Items
- Service Item Management
- Service Rate Management

### Settings
- Category Management (CRUD)
- Unit Management (CRUD)
- Warehouse Management (CRUD)
- Discount Categories (CRUD)

---

## State Ownership

### Before (Current)
```tsx
ItemsTab {
  50+ useState() hooks
  ├── Form state (20+ fields)
  ├── Variant pricing state
  ├── Warehouse stock state
  ├── Vendor mappings state
  ├── Client mappings state
  ├── Client pricing state
  ├── Transaction state
  ├── Audit state
  ├── Bulk price state
  ├── Column settings state
  ├── UI state (modals, dropdowns, etc.)
  └── Loading/error state
}
```

### After (Target)
```tsx
MaterialsPage {
  activeTab state
  └── Composes child tabs
}

OverviewTab {
  formData state
  └── Handles core item details
}

PricingTab {
  variantPricing state
  pricingHistory state
  └── Handles all pricing logic
}

InventoryTab {
  warehouseStock state
  └── Handles stock management
}

VendorsTab {
  vendorMappings state
  └── Handles vendor relations
}

ClientsTab {
  clientMappings state
  clientPricing state
  └── Handles client relations
}

TransactionsTab {
  itemTransactions state
  └── Handles transaction loading
}
```

---

## Dialog Ownership

Each feature owns its dialogs:

| Feature | Dialogs |
|---------|---------|
| Pricing | PriceHistoryDialog, BulkPriceDialog, PriceImportDialog |
| Inventory | WarehouseStockDialog, StockAdjustmentDialog |
| Transactions | TransactionViewerDialog |
| Audit | AuditDetailDialog |
| Import | BulkImportDialog, ExcelImportDialog |
| Export | ExportDialog |

---

## Custom Hooks

Each feature exposes hooks:

```typescript
useMaterialOverview(materialId)    // Core item CRUD
useMaterialPricing(materialId)     // Price management
useMaterialInventory(materialId)   // Stock management
useMaterialVendors(materialId)     // Vendor mappings
useMaterialClients(materialId)     // Client mappings + ARC pricing
useMaterialTransactions(materialId) // Transaction history
useMaterialAudit(materialId)       // Audit trail
useMaterialImport(orgId)           // Bulk import logic
useMaterialExport(orgId)           // Export logic
```

---

## Services Layer

Move business logic into service modules:

```typescript
MaterialService        // Core CRUD operations
PricingService         // Price calculations, bulk updates
InventoryService       // Stock management
VendorService          // Vendor mapping operations
ClientService          // Client mapping + ARC pricing
TransactionService     // Transaction loading (8+ parallel queries)
AuditService           // Audit trail (DB + localStorage)
ImportService          // Excel/CSV parsing and validation
ExportService          // Export generation
```

**Flow:** Components → Hooks → Services → Supabase

---

## Implementation Phases

### Phase 1: Foundation
1. Create `features/materials/` folder structure
2. Define shared types in `features/materials/shared/types.ts`
3. Create `MaterialsPage.tsx` as lightweight shell
4. Verify routing works

### Phase 2: Extract Independent Tabs
Extract tabs that don't share state with ItemsTab:
1. `CategoryTab` → `settings/CategoryTab.tsx`
2. `UnitTab` → `settings/UnitTab.tsx`
3. `WarehousesTab` → `settings/WarehouseTab.tsx`
4. `VariantsTab` → `variants/VariantsTab.tsx`
5. `DiscountCategoriesTab` → `settings/DiscountCategoriesTab.tsx`
6. `ServiceTab` → `service/ServiceTab.tsx`
7. `ServiceRatesTab` → `service/ServiceRatesTab.tsx`

### Phase 3: Extract ItemsTab Sub-Features
Break down the god component:
1. Extract `useItemTransactions` hook
2. Extract `useMaterialForm` hook (form state + validation)
3. Extract `OverviewTab` (form fields)
4. Extract `PricingTab` (variant pricing, bulk price)
5. Extract `InventoryTab` (warehouse stock)
6. Extract `VendorsTab` (vendor mappings)
7. Extract `ClientsTab` (client mappings + ARC)
8. Extract `TransactionsTab` (transaction display)
9. Extract `AuditTab` (audit trail)

### Phase 4: Extract Services
1. Create `MaterialService` (core CRUD)
2. Create `TransactionService` (transaction loading)
3. Create `AuditService` (audit trail)
4. Create `ImportService` (bulk import)
5. Create `ExportService` (export)

### Phase 5: Final Assembly
1. Wire up `MaterialsPage` to compose all tabs
2. Update routing in `App.tsx`
3. Verify all features work
4. Remove old `MaterialsList.tsx`

---

## Success Criteria

- [ ] `MaterialsPage` is <500 lines (composition only)
- [ ] Each business domain has a clear owner
- [ ] Features can evolve independently
- [ ] No UI changes visible to users
- [ ] All existing functionality preserved
- [ ] Code is easier to navigate and maintain
- [ ] New features can extend modules without increasing parent complexity

---

## Things to Avoid

1. **Don't split by file size alone** — move code based on business domains
2. **Don't create shared state for unrelated features** — each owns its data
3. **Don't move business logic into parent page** — parent is orchestrator only
4. **Don't duplicate Supabase queries** — shared queries belong in services
5. **Don't introduce unnecessary abstraction** — only extract real business concepts
6. **Don't redesign the UI** — users see exactly the same screens
