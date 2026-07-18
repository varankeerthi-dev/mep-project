# Migration Plan: ItemsTab JSX Extraction

> **Date:** July 17, 2026 (v8 — Final Architecture)
> **Scope:** Extract ~4,000 lines of JSX from `MaterialsList.tsx` ItemsTab into a self-contained feature module
> **Strategy:** Clean layered architecture, every file has a clear home
> **Goal:** `ItemsTab.tsx` becomes a ~200-250 line composition component; Materials feels like its own mini-application

---

## Target Architecture

```
features/materials/
├── page/
│   └── ItemsTab.tsx              # Composition (~200-250 lines) — owns page state
│
├── model/
│   ├── entities/
│   │   ├── Material.ts           # Domain entity (what goes in DB)
│   │   ├── Warehouse.ts
│   │   ├── Vendor.ts
│   │   └── Client.ts
│   ├── aggregates/
│   │   ├── MaterialEditor.ts     # Editor-only types (not in domain)
│   │   ├── MaterialPricing.ts    # Pricing aggregate (sale, purchase, variants)
│   │   ├── WarehouseStock.ts     # Inventory aggregate
│   │   ├── VendorMapping.ts      # Vendor aggregate
│   │   ├── ClientMapping.ts      # Client aggregate
│   │   └── Transaction.ts        # Transaction types
│   ├── schemas/
│   │   ├── MaterialSchema.ts     # Zod schemas + validation logic
│   │   ├── VendorSchema.ts
│   │   ├── WarehouseSchema.ts
│   │   └── index.ts
│   ├── mappers/
│   │   ├── MaterialMapper.ts     # editorToMaterial, materialToEditor, materialToRow, rowToMaterial
│   │   └── index.ts
│   └── index.ts
│
├── components/
│   ├── toolbar/
│   │   ├── ItemsToolbar.tsx      # Pure rendering — no state ownership
│   │   ├── ColumnSettingsDropdown.tsx
│   │   └── index.ts
│   │
│   ├── table/
│   │   ├── ItemsTable.tsx        # Pure rendering — no state ownership
│   │   ├── ItemRow.tsx           # Single row
│   │   ├── Pagination.tsx        # Page controls
│   │   └── index.ts
│   │
│   ├── editor/                   # ItemEditorDialog (Create/Edit/Duplicate)
│   │   ├── ItemEditorDialog.tsx  # Self-contained — calls useMaterialEditor
│   │   ├── BasicInformationSection.tsx   # Max ~250 lines
│   │   ├── TechnicalSection.tsx          # Max ~250 lines
│   │   ├── CommercialSection.tsx         # Max ~250 lines
│   │   ├── InventorySection.tsx          # Max ~250 lines (split if larger)
│   │   ├── VendorSection.tsx             # Max ~250 lines
│   │   ├── ClientSection.tsx             # Max ~250 lines
│   │   ├── VariantPricingSection.tsx     # Max ~250 lines
│   │   └── index.ts
│   │
│   ├── viewer/                   # ItemDetailsDialog (View details)
│   │   ├── ItemDetailsDialog.tsx # Self-contained — calls useItemTransactions
│   │   ├── OverviewTab.tsx
│   │   ├── WarehouseTab.tsx
│   │   ├── AdjustmentsTab.tsx
│   │   ├── TransactionsTab.tsx
│   │   ├── AuditTab.tsx
│   │   └── index.ts
│   │
│   └── dialogs/
│       ├── BulkPriceDialog.tsx
│       ├── MultiItemDialog.tsx
│       ├── ExcelEditorDialog.tsx
│       └── index.ts
│
├── hooks/
│   ├── useMaterialEditor.ts      # ONE public hook — internal helpers are implementation details
│   ├── useItemTransactions.ts    # Transaction history
│   ├── useBulkPriceUpdate.ts     # Bulk price operations
│   ├── useMaterialActions.ts     # deleteMaterial, toggleActive
│   └── index.ts
│
├── repository/                    # Aggregate operations (no interfaces)
│   ├── materialRepository.ts     # saveAggregate, get, delete, duplicate
│   ├── transactionRepository.ts  # Transaction queries
│   └── index.ts
│
├── persistence/                   # Raw Supabase access
│   ├── materialsPersistence.ts   # CRUD + all material-related data
│   ├── transactionPersistence.ts # Transaction queries
│   ├── excelPersistence.ts       # Import/export
│   └── index.ts
│
├── services/                      # Read-only query services
│   └── referenceDataService.ts   # Units, categories, warehouses (React Query cached)
│
├── constants/                     # Feature constants
│   ├── materialDefaults.ts       # DEFAULT_COLUMNS, DEFAULT_PAGE_SIZE, DEFAULT_EDITOR
│   ├── materialColumns.ts        # Column definitions
│   ├── materialStatus.ts         # ITEM_STATUS, MATERIAL_TYPES
│   ├── gstOptions.ts             # GST_OPTIONS
│   └── index.ts
│
├── lib/                           # Pure reusable business logic (optional — add as needed)
│   ├── calculateMargin.ts        # Margin calculations
│   ├── calculateStockValue.ts    # Stock value calculations
│   ├── normalizeMaterial.ts      # Normalize material data
│   ├── generateItemCode.ts       # Generate item codes
│   └── index.ts
│
└── index.ts                       # Public API
```

---

## Simplified Layering

```
UI → Hooks → Repository → Persistence → Supabase → Database
                ↑
            Services (reference data, read-only)
```

**No utils/ folder.** Every file has a clear home:
- Validation → `model/schemas/`
- Mapping → `model/mappers/`
- Calculations → `lib/`
- Constants → `constants/`

---

## Key Rules

### 1. No utils/ Folder

```typescript
// ❌ Generic utility dumps
utils/
  utils.ts           # What's in here?
  validation.ts      # Overlaps with schemas
  fieldMapping.ts    # Redundant with mapper

// ✅ Every file has a clear home
model/
  schemas/
    MaterialSchema.ts    # Validation lives here
  mappers/
    MaterialMapper.ts    # All mapping lives here

lib/
  calculateMargin.ts    # Business logic
  generateItemCode.ts   # Pure functions

constants/
  materialDefaults.ts   # Constants
  materialStatus.ts     # Enums
```

### 2. Validation With Schemas

```typescript
// ❌ Split between utils/ and model/
utils/validation.ts
model/schemas/MaterialSchema.ts

// ✅ Validation lives with schemas
model/schemas/MaterialSchema.ts

import { z } from 'zod';

export const MaterialSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  item_code: z.string().min(1, 'Item code is required'),
  category: z.string().min(1, 'Category is required'),
  unit: z.string().min(1, 'Unit is required'),
  // ... etc
});

export type MaterialFormData = z.infer<typeof MaterialSchema>;

export function validateMaterial(data: unknown) {
  return MaterialSchema.safeParse(data);
}
```

### 3. Mapper Contains All Mapping

```typescript
// ❌ Split between mapper and fieldMapping
model/mappers/MaterialMapper.ts
utils/fieldMapping.ts

// ✅ Everything mapping-related in mapper
model/mappers/MaterialMapper.ts

export const materialMapper = {
  editorToMaterial(editor) { ... },
  materialToEditor(material) { ... },
  materialToRow(material) { ... },
  rowToMaterial(row) { ... },
  
  // Field mapping also lives here
  mapFormFieldToDomain(field) { ... },
  mapDomainToFormField(domain) { ... },
};
```

### 4. Sections Max 250 Lines

```typescript
// ❌ Section grows to 500+ lines
InventorySection.tsx  # 500 lines — too large

// ✅ Split into sub-components
InventorySection.tsx           # ~150 lines — orchestrator
InventoryGeneral.tsx           # ~100 lines — basic fields
WarehouseStockTable.tsx        # ~120 lines — stock display
StockAdjustmentPanel.tsx       # ~100 lines — adjustments
```

**Rule:** If a section exceeds ~250 lines, split it.

### 5. useMaterialEditor — One Public Hook

```typescript
// ❌ Expose internal helpers
useMaterialEditor() {
  return {
    usePricingLogic(),      // Implementation detail
    useInventoryLogic(),    // Implementation detail
    useVendorLogic(),       // Implementation detail
  };
}

// ✅ One public API, internals hidden
useMaterialEditor(materialId) {
  // Internal composition (implementation details)
  const pricing = usePricingLogic(materialId);
  const inventory = useInventoryLogic(materialId);
  const vendors = useVendorLogic(materialId);
  
  // Public API
  return {
    formData,
    warehouseStock,
    variantPricing,
    vendorMappings,
    clientMappings,
    updateFormData,
    updateWarehouseStock,
    updateVariantPricing,
    updateVendorMappings,
    updateClientMappings,
    save,
    reset,
    isDirty,
    isSaving,
  };
}
```

### 6. ItemsTab 200-250 Lines

```typescript
// ❌ Forced to 100-150 lines — creates unnecessary indirection
ItemsTab.tsx  # 100 lines — too compressed

// ✅ Natural composition — 200-250 lines
ItemsTab.tsx  # 200-250 lines — composition + page state

// Includes:
// - Imports (~20 lines)
// - State declarations (~30 lines)
// - Effects (~20 lines)
// - Handler functions (~30 lines)
// - JSX composition (~100 lines)
```

**Why looser?** Composition components naturally become larger because of imports and dialog wiring. Forcing 100-150 often creates unnecessary indirection.

### 7. Constants Folder

```typescript
// constants/materialDefaults.ts
export const DEFAULT_COLUMNS = ['name', 'category', 'unit', 'stock', 'status'];
export const DEFAULT_PAGE_SIZE = 25;
export const DEFAULT_EDITOR = {
  name: '',
  category: '',
  unit: '',
  // ... etc
};

// constants/materialStatus.ts
export const ITEM_STATUS = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  DRAFT: 'Draft',
} as const;

export const MATERIAL_TYPES = {
  STANDARD: 'Standard',
  SERVICE: 'Service',
  KIT: 'Kit',
} as const;

// constants/gstOptions.ts
export const GST_OPTIONS = [
  { value: '0', label: 'Exempt' },
  { value: '5', label: '5%' },
  { value: '12', label: '12%' },
  { value: '18', label: '18%' },
  { value: '28', label: '28%' },
];
```

### 8. Lib Folder (Pure Business Logic)

```typescript
// lib/calculateMargin.ts
export function calculateMargin(cost: number, sellingPrice: number): number {
  if (cost === 0) return 0;
  return ((sellingPrice - cost) / cost) * 100;
}

// lib/calculateStockValue.ts
export function calculateStockValue(quantity: number, unitPrice: number): number {
  return quantity * unitPrice;
}

// lib/generateItemCode.ts
export function generateItemCode(category: string, sequence: number): string {
  const prefix = category.substring(0, 3).toUpperCase();
  return `${prefix}-${String(sequence).padStart(4, '0')}`;
}

// lib/normalizeMaterial.ts
export function normalizeMaterial(material: Material): Material {
  return {
    ...material,
    name: material.name.trim(),
    display_name: material.display_name?.trim() || material.name.trim(),
    item_code: material.item_code.toUpperCase(),
  };
}
```

---

## Execution Order

| Step | Component | Lines | Risk | Dependencies |
|------|-----------|-------|------|--------------|
| 0 | Model layer (entities, aggregates, schemas, mappers) | ~500 | Low | None |
| 1 | Persistence layer (materialsPersistence, transactionPersistence) | ~400 | Low | Model |
| 2 | Repository layer (materialRepository, transactionRepository) | ~300 | Low | Persistence |
| 3 | Services (referenceDataService) | ~100 | Low | Persistence |
| 4 | Constants (materialDefaults, materialColumns, materialStatus) | ~150 | Low | None |
| 5 | Lib (calculateMargin, calculateStockValue, generateItemCode) | ~150 | Low | None |
| 6 | Services (referenceDataService) | ~100 | Low | Persistence |
| 7 | ItemsToolbar + ColumnSettingsDropdown | ~200 | Low | None |
| 8 | ItemsTable + ItemRow + Pagination | ~350 | Low | Constants |
| 9 | ItemDetailsDialog shell + tabs | ~700 | Medium | Repository |
| 10 | useMaterialEditor hook | ~400 | Medium | Repository |
| 11 | ItemEditorDialog shell | ~200 | Medium | Hook |
| 12 | BasicInformationSection | ~150 | Low | Hook |
| 13 | TechnicalSection | ~150 | Low | Hook |
| 14 | CommercialSection | ~200 | Low | Hook |
| 15 | InventorySection | ~150 | Low | Hook |
| 16 | VendorSection | ~150 | Low | Hook |
| 17 | ClientSection | ~150 | Low | Hook |
| 18 | VariantPricingSection | ~150 | Low | Hook |
| 19 | Dialog components (Bulk, Multi, Excel) | ~1,200 | Medium | Hooks |

---

## Completion Criteria

The migration is complete when:

- [ ] `ItemsTab.tsx` is 200-250 lines (composition + page state)
- [ ] No component over 400-500 lines (guideline)
- [ ] No section over 250 lines (hard rule — split if larger)
- [ ] No hook over 200 lines (guideline)
- [ ] No repository over 200 lines (guideline)
- [ ] `useMaterialEditor` is one public hook (internal helpers hidden)
- [ ] Toolbar and Table are pure rendering (no state ownership)
- [ ] No `utils/` folder — every file has a clear home
- [ ] Validation lives in `model/schemas/`
- [ ] All mapping lives in `model/mappers/`
- [ ] Constants live in `constants/`
- [ ] Pure business logic lives in `lib/`
- [ ] Persistence layer has 3 files
- [ ] Repository layer is focused (2 files only)
- [ ] All components have index.ts for clean imports
- [ ] Sections never see Supabase directly
- [ ] All existing functionality works identically
- [ ] Original `MaterialsList.tsx` ItemsTab code can be deleted

---

## File Reference

### Target files (post-migration):
```
features/materials/
├── page/
│   └── ItemsTab.tsx
│
├── model/
│   ├── entities/
│   │   ├── Material.ts
│   │   ├── Warehouse.ts
│   │   ├── Vendor.ts
│   │   ├── Client.ts
│   │   └── index.ts
│   ├── aggregates/
│   │   ├── MaterialEditor.ts
│   │   ├── MaterialPricing.ts
│   │   ├── WarehouseStock.ts
│   │   ├── VendorMapping.ts
│   │   ├── ClientMapping.ts
│   │   ├── Transaction.ts
│   │   └── index.ts
│   ├── schemas/
│   │   ├── MaterialSchema.ts
│   │   ├── VendorSchema.ts
│   │   ├── WarehouseSchema.ts
│   │   └── index.ts
│   ├── mappers/
│   │   ├── MaterialMapper.ts
│   │   └── index.ts
│   └── index.ts
│
├── components/
│   ├── toolbar/
│   │   ├── ItemsToolbar.tsx
│   │   ├── ColumnSettingsDropdown.tsx
│   │   └── index.ts
│   ├── table/
│   │   ├── ItemsTable.tsx
│   │   ├── ItemRow.tsx
│   │   ├── Pagination.tsx
│   │   └── index.ts
│   ├── editor/
│   │   ├── ItemEditorDialog.tsx
│   │   ├── BasicInformationSection.tsx
│   │   ├── TechnicalSection.tsx
│   │   ├── CommercialSection.tsx
│   │   ├── InventorySection.tsx
│   │   ├── VendorSection.tsx
│   │   ├── ClientSection.tsx
│   │   ├── VariantPricingSection.tsx
│   │   └── index.ts
│   ├── viewer/
│   │   ├── ItemDetailsDialog.tsx
│   │   ├── OverviewTab.tsx
│   │   ├── WarehouseTab.tsx
│   │   ├── AdjustmentsTab.tsx
│   │   ├── TransactionsTab.tsx
│   │   ├── AuditTab.tsx
│   │   └── index.ts
│   └── dialogs/
│       ├── BulkPriceDialog.tsx
│       ├── MultiItemDialog.tsx
│       ├── ExcelEditorDialog.tsx
│       └── index.ts
│
├── hooks/
│   ├── useMaterialEditor.ts
│   ├── useItemTransactions.ts
│   ├── useBulkPriceUpdate.ts
│   ├── useMaterialActions.ts
│   └── index.ts
│
├── repository/
│   ├── materialRepository.ts
│   ├── transactionRepository.ts
│   └── index.ts
│
├── persistence/
│   ├── materialsPersistence.ts
│   ├── transactionPersistence.ts
│   ├── excelPersistence.ts
│   └── index.ts
│
├── services/
│   └── referenceDataService.ts
│
├── constants/
│   ├── materialDefaults.ts
│   ├── materialColumns.ts
│   ├── materialStatus.ts
│   ├── gstOptions.ts
│   └── index.ts
│
├── lib/
│   ├── calculateMargin.ts
│   ├── calculateStockValue.ts
│   ├── generateItemCode.ts
│   ├── normalizeMaterial.ts
│   └── index.ts
│
└── index.ts
```

---

## Future Extensibility

**When editor/ grows to dozens of sections:**
```
editor/
  sections/
    identity/        # BasicInformation, Technical
    commercial/      # Commercial, Pricing
    inventory/       # Inventory, Warehouse
    vendors/         # VendorSection
    customers/       # ClientSection
    pricing/         # VariantPricing
    manufacturing/   # (future)
    media/           # (future: images, attachments)
```

**When repository grows too large:**
- Split `materialRepository.ts` into `materialReadRepository.ts` and `materialWriteRepository.ts`
- Only split when a file exceeds ~300 lines

---

## Things NOT to Introduce

- ❌ Repository interfaces (one implementation today)
- ❌ Commands layer (2 commands don't justify a layer)
- ❌ utils/ folder (everything has a clear home)
- ❌ CQRS, Event Bus, Domain Events
- ❌ Plugin registries
- ❌ testing/ folder in production code
