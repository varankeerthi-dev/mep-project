# Architecture Review: MaterialsList.tsx

> Generated: July 16, 2026  
> Scope: `apps/web/src/pages/MaterialsList.tsx` and immediate dependencies  
> Vocabulary: [codebase-design](.agents/skills/improve-codebase-architecture/SKILL.md) + CONTEXT.md domain language

---

## Executive Summary

`MaterialsList.tsx` is the largest component in the web app (~4000+ lines). It serves as the **Item Master** — the central registry for all materials, variants, vendor/client mappings, stock levels, and pricing in the MEP ERP system.

The file has accumulated responsibilities that belong to **5+ distinct modules**. Every new feature (ARC pricing, bulk import, audit trail) is added inline rather than extracted, creating a god component with 50+ `useState` hooks and deeply interleaved business logic.

This review identifies **5 deepening opportunities** — refactors that would turn shallow, inline code into deep, testable modules with clear interfaces.

---

## Candidate 1: Item Transaction Data Fetching ⭐ Strong

### Files
- `MaterialsList.tsx` → `loadItemTransactions()` (~150 lines, inline in component)
- `useMaterialsPageData.tsx` (parallel material fetching)

### Problem
`loadItemTransactions` runs **8 parallel + 4 sequential** Supabase queries inline in the component. Understanding what data is fetched for a transaction requires tracing through ~150 lines of ad-hoc query builder code scattered across callback closures.

**No locality**: the queries for quotations, invoices, purchases, delivery challans, and stock adjustments are all built inside one function body with no seam between "which entity type am I querying" and "how am I building the Supabase query."

**No testability**: you cannot test the transaction-fetching logic without rendering the 4000-line component and mocking Supabase at the network level.

### Solution
Extract a **`useItemTransactions(materialId, orgId)`** hook that:
1. Owns all 8+ parallel Supabase queries for transaction data
2. Returns `{ quotations, invoices, purchases, deliveryChallans, stockAdjustments, warehouseReports, auditLogs, isLoading }`
3. Internally uses the same React Query cache key as `useMaterialsPageData` to stay in sync
4. Exposes a `refetch()` function for manual refresh

Each entity-type query (quotations, invoices, etc.) becomes a **private helper function** within the hook module:
```ts
async function fetchQuotationRefs(materialId: string, orgId: string) { ... }
async function fetchInvoiceRefs(materialId: string, orgId: string) { ... }
// etc.
```

### Benefits
| Dimension | Before | After |
|-----------|--------|-------|
| **Locality** | Queries scattered across 150 lines of callback closures | All transaction queries co-located in one module |
| **Testability** | Must render full component + mock Supabase at network level | Test with `renderHook` + mock Supabase client |
| **Leverage** | Only used in ItemsTab | Any module needing material transaction history can import the hook |
| **Deletion test** | Deleting the inline code would break the component | Deleting the hook would leave ItemsTab with no transaction data — concentrates complexity ✓ |

### Before / After

```
BEFORE:
┌─ MaterialsList.tsx ──────────────────────────────┐
│  useState(50+ hooks)                              │
│  loadItemTransactions() {                         │
│    ├─ Supabase.from('quotations')...  (parallel)  │
│    ├─ Supabase.from('invoices')...    (parallel)  │
│    ├─ Supabase.from('purchases')...   (parallel)  │
│    ├─ ... 5 more parallel queries                 │
│    ├─ await → Supabase.from('stock')  (serial)    │
│    ├─ await → Supabase.from('audit')  (serial)    │
│    └─ setState(...)                               │
│  }                                                │
│  handleSubmit() { ... 200 lines ... }             │
│  render() { ... 800 lines ... }                   │
└──────────────────────────────────────────────────┘

AFTER:
┌─ useItemTransactions.ts ─────────┐  ┌─ MaterialsList.tsx ──────┐
│  fetchQuotationRefs()             │  │  const { quotations,      │
│  fetchInvoiceRefs()               │◄─│       invoices, ... } =   │
│  fetchPurchaseRefs()              │  │    useItemTransactions(    │
│  fetchDeliveryChallanRefs()       │  │      materialId, orgId);   │
│  fetchStockAdjustments()          │  │                           │
│  fetchAuditLogs()                 │  │  handleSubmit() { ... }   │
│  → return { quotations, ... }    │  │  render() { ... }         │
└───────────────────────────────────┘  └───────────────────────────┘
```

### Recommendation Strength: **Strong**

---

## Candidate 2: Save/Submit Pipeline ⭐ Strong

### Files
- `MaterialsList.tsx` → `handleSubmit()` (~200 lines, 6+ entity types saved sequentially)

### Problem
`handleSubmit` saves material → variants → vendor mappings → client mappings → ARC pricing → stock levels in a **sequential waterfall** with per-step error handling and optimistic cache updates.

**No locality**: adding a new entity type means editing the middle of a 200-line function. The save logic for "vendor mapping" is interleaved with "client mapping" and "ARC pricing."

**No testability**: you cannot test the save pipeline without rendering the full component and mocking the entire React Query cache system.

### Solution
Extract a **`saveMaterialPipeline(material, context)`** orchestrator:
```ts
interface SaveContext {
  supabase: SupabaseClient;
  orgId: string;
  queryClient: QueryClient;
  cacheKey: string[];
}

async function saveMaterialPipeline(material: MaterialFormData, ctx: SaveContext) {
  // 1. Save material core
  const savedMaterial = await saveMaterialCore(material, ctx);
  
  // 2. Save variants (if any)
  if (material.variants?.length) {
    await saveVariants(savedMaterial.id, material.variants, ctx);
  }
  
  // 3. Save vendor mappings
  await saveVendorMappings(savedMaterial.id, material.vendorMappings, ctx);
  
  // 4. Save client mappings / ARC pricing
  await saveClientMappings(savedMaterial.id, material.clientMappings, ctx);
  
  // 5. Save stock levels
  await saveStockLevels(savedMaterial.id, material.stockLevels, ctx);
  
  return savedMaterial;
}
```

Each `save*` function lives in the same module, is independently testable, and owns its own error handling.

### Benefits
| Dimension | Before | After |
|-----------|--------|-------|
| **Locality** | All save logic mixed in 200-line function | Each entity-type save is a focused function |
| **Testability** | Must render full component | Test `saveMaterialCore()` with mock Supabase directly |
| **Leverage** | Only used in ItemsTab | Bulk import and future create-from-template features can reuse the pipeline |
| **Deletion test** | Deleting inline code would break the save flow | Deleting the pipeline would leave ItemsTab unable to save — concentrates complexity ✓ |

### Before / After

```
BEFORE:
handleSubmit() {
  // 1. Validate
  // 2. Save material (40 lines)
  // 3. Save variants (30 lines)
  // 4. Save vendor mappings (25 lines)
  // 5. Save client mappings (25 lines)
  // 6. Save ARC pricing (30 lines)
  // 7. Save stock levels (20 lines)
  // 8. Invalidate cache (20 lines)
  // Total: ~200 lines, all inline
}

AFTER:
saveMaterialPipeline(material, ctx) {
  → saveMaterialCore()     // 15 lines, testable
  → saveVariants()         // 15 lines, testable
  → saveVendorMappings()   // 15 lines, testable
  → saveClientMappings()   // 15 lines, testable
  → saveArcPricing()       // 15 lines, testable
  → saveStockLevels()      // 15 lines, testable
  → invalidateCache()      // 10 lines, testable
}

handleSubmit() {
  const result = await saveMaterialPipeline(formData, saveContext);
  // handle success/failure UI (10 lines)
}
```

### Recommendation Strength: **Strong**

---

## Candidate 3: Bulk Price Update Logic 🔵 Worth exploring

### Files
- `MaterialsList.tsx` → bulk price paste handler, Excel editor integration, batch update logic (~200 lines)

### Problem
Bulk price parsing, validation, and application logic is interleaved with UI state management. The Excel paste handler, field selector, and batch update all live at component scope.

**Key friction**: the paste-parsing algorithm (splitting tab-delimited Excel data, mapping columns to fields, computing discounted rates) is a **pure function** buried inside a `useCallback` with 8 dependencies. It's impossible to unit-test without rendering the component.

### Solution
Extract a **`useBulkPriceUpdate(materials, onApply)`** hook:
- `parseExcelPaste(text: string, fieldMap: FieldMap): BulkPriceRow[]` — pure function, trivially testable
- `computeDiscountedRates(rows, discountCategories): BulkPriceRow[]` — pure function
- `applyBulkUpdate(rows, orgId, supabase): Promise<UpdateResult>` — async, testable with mock

### Benefits
- **Testability**: `parseExcelPaste` and `computeDiscountedRates` become pure functions with no dependencies
- **Leverage**: the parsing logic could be reused for bulk import, purchase order line items, etc.
- **Deletion test**: removing the inline code would break bulk pricing — concentrates complexity ✓

### Recommendation Strength: **Worth exploring**

---

## Candidate 4: Client ARC Pricing Module 🔵 Worth exploring

### Files
- `MaterialsList.tsx` → ARC pricing form state, validation, date logic, save path (~150 lines)

### Problem
Client-specific fixed pricing (ARC) has its own form state, validation (valid-from/valid-till dates), and save path — all embedded in the ItemsTab god component. It's conceptually independent but has no seam.

### Solution
Extract **`useArcPricing(materialId)`** as a self-contained hook:
- Owns form state for ARC pricing entries
- Handles date validation (valid-from < valid-till)
- Provides `saveArcPricing()` mutation with cache invalidation
- Returns `{ arcEntries, addEntry, removeEntry, save, isSaving }`

### Benefits
- **Testability**: date validation and save logic testable without component
- **Leverage**: could be reused on a standalone "Client Pricing" page
- **Deletion test**: removing it would leave ItemsTab without ARC pricing — concentrates complexity ✓

### Recommendation Strength: **Worth exploring**

---

## Candidate 5: Column Settings & Audit Trail 🟡 Speculative

### Files
- `MaterialsList.tsx` → localStorage column config (~80 lines), audit log read/write (~70 lines)

### Problem
Column visibility, ordering, and audit trail persistence are cross-cutting concerns that duplicate patterns found in other list pages (Projects, Quotations, etc.). They add ~150 lines of incidental complexity to the component.

### Solution
- `useColumnSettings(storageKey: string, defaultColumns: Column[])` — reusable across all list pages
- `useAuditTrail(orgId, materialId)` — fetches and appends audit log entries

### Benefits
- **Lower leverage** (simpler logic), but cleans up component scope
- **Leverage**: `useColumnSettings` would be immediately reusable across 5+ list pages
- **Deletion test**: removing would break column customization — concentrates complexity ✓ (moderate)

### Recommendation Strength: **Speculative**

---

## 🏆 Top Recommendation

**Start with Candidate 1 (Transaction Fetching) or Candidate 2 (Save Pipeline).**

Both are **strong** because:
1. They pass the **deletion test** decisively — removing the inline code concentrates complexity into a testable unit
2. They have **high leverage** — other modules (Invoices, Purchase Orders, Delivery Challans) likely face the same fetch/save patterns
3. They improve **testability** dramatically — currently you can't test the save or fetch logic without rendering the entire 4000-line component
4. They establish **architectural precedent** — once one extraction is done, the pattern is clear for subsequent extractions

**Recommended order:**
1. **Candidate 1** first (transaction fetching) — it's the most self-contained, lowest risk
2. **Candidate 2** second (save pipeline) — higher impact but touches more code
3. **Candidate 3** third (bulk pricing) — pure function extraction, easy win
4. **Candidate 4** fourth (ARC pricing) — natural follow-on from save pipeline extraction

---

## Glossary

| Term | Meaning |
|------|---------|
| **Item Master** | The central registry of all materials, variants, and their pricing/stock metadata |
| **Locality** | All code related to one concept lives in one place |
| **Leverage** | A change that benefits multiple modules or features |
| **Deletion test** | Would deleting this code concentrate complexity (good) or just move it (bad)? |
| **Seam** | A boundary where you can swap implementations without touching the rest of the system |
| **Shallow module** | Interface nearly as complex as the implementation — no abstraction benefit |
