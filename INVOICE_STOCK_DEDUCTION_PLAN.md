# Invoice Stock Deduction — Implementation Plan

> **Constraint**: Do NOT remove any existing functions. Only extend schemas, add new files, and add UI columns. Stock deduction must be an additive layer on top of existing invoice flow.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  EXISTING (Untouched)                                       │
│  ├─ invoices table                                          │
│  ├─ invoice_items table (meta_json stores warehouse_id)    │
│  ├─ invoice_materials table (add warehouse_id column)      │
│  ├─ loadInvoiceSource() — DC/PO/Quotation/Proforma         │
│  ├─ mapSourceToInvoice()                                   │
│  ├─ createInvoice() / updateInvoice()                      │
│  └─ InvoiceItemsEditor, InvoiceMaterialsEditor              │
│                                                             │
│  NEW (Additive Only)                                      │
│  ├─ invoice_stock_deductions table                         │
│  ├─ deduct_invoice_stock_itemized() RPC                    │
│  ├─ deduct_invoice_stock_lot() RPC                        │
│  ├─ reverse_invoice_stock_deductions() RPC                │
│  ├─ InvoiceItemMetaSchema.warehouse_id                   │
│  ├─ InvoiceEditorSchema.default_warehouse_id              │
│  ├─ InvoiceEditorSchema.deduct_stock_on_finalize        │
│  └─ InvoiceEditorSchema.allow_insufficient_stock        │
└─────────────────────────────────────────────────────────────┘
```

---

## Pre-Phase: Environment Check

**Before any code changes, verify the workspace is clean:**

```bash
git status
# Ensure no uncommitted changes
```

**Checkpoint**: Save current state as `pre-invoice-stock`.

---

## Phase 1: Database Migration

**Goal**: Create the audit table and RPC functions. Add `warehouse_id` to `invoice_materials`.

**File**: `supabase/migrations/add_invoice_stock_deductions.sql`

**Contents**:
1. `ALTER TABLE invoice_materials ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses(id);`
2. `CREATE TABLE invoice_stock_deductions (...)`
3. Indexes on `invoice_id`, `material_id`, `warehouse_id`, `organisation_id`
4. RLS policies (org-based via `user_organisations`)
5. `reverse_invoice_stock_deductions(p_invoice_id UUID)` function
6. `deduct_invoice_stock_itemized(p_invoice_id, p_org_id, p_allow_insufficient)` function
7. `deduct_invoice_stock_lot(p_invoice_id, p_org_id, p_allow_insufficient)` function

**Special Instruction**: No ALTER on `invoices` or `invoice_items` tables. `invoice_items.meta_json` is already JSONB — warehouse info goes there.

**After Phase 1 — Audit Check**:
```bash
# Verify migration syntax
grep -n "CREATE TABLE\|ALTER TABLE\|CREATE OR REPLACE FUNCTION" supabase/migrations/add_invoice_stock_deductions.sql
# Ensure no DROP TABLE or DROP COLUMN on existing tables
grep -n "DROP TABLE invoices\|DROP TABLE invoice_items\|DROP TABLE invoice_materials" supabase/migrations/add_invoice_stock_deductions.sql || echo "OK: No destructive drops"
```

**Checkpoint**: `git add . && git commit -m "Phase 1: Add invoice_stock_deductions migration"`

---

## Phase 2: Extend Schemas & Types

**Goal**: Add warehouse/stock fields to Zod schemas. No existing fields removed.

**Files**:
- `src/invoices/schemas.ts`
- `src/invoices/ui-utils.ts`

**Changes**:

### 2a. `src/invoices/schemas.ts`
Extend `InvoiceItemMetaSchema` (lines 43-58):
```ts
.add({
  material_id: z.string().uuid().optional(),
  warehouse_id: z.string().uuid().optional(),
  variant_id: z.string().uuid().optional(),
  is_service: z.boolean().optional(),
})
```

Extend `InvoiceMaterialSchema` (if exists, or create it):
```ts
warehouse_id: z.string().uuid().nullable().optional()
```

### 2b. `src/invoices/ui-utils.ts`

Extend `InvoiceEditorItemSchema.meta_json` to allow new keys.

Extend `InvoiceEditorSchema` to add:
```ts
default_warehouse_id: z.string().uuid().nullable().optional(),
deduct_stock_on_finalize: z.boolean().optional().default(false),
allow_insufficient_stock: z.boolean().optional().default(false),
```

Update `createEmptyItem()` to include new meta_json keys (with `undefined` defaults).

Update `createEmptyInvoiceFormValues()` to include `default_warehouse_id`, `deduct_stock_on_finalize`, `allow_insufficient_stock`.

Update `invoiceToFormValues()` to pass through `meta_json.material_id`, `warehouse_id`, `variant_id`, `is_service`.

Update `composeInvoiceInput()` to pass through warehouse/material/service fields in `meta_json`.

Update `InvoiceMaterialOption` type to include `item_type: string`.

Update `loadMaterialOptions()` to select `item_type` from `materials`.

**Special Instruction**: Use `.optional()` for all new fields so existing invoices without them still validate. Do not change `.default()` values for existing fields.

**After Phase 2 — Audit Check**:
```bash
# Ensure no existing fields were removed from schemas
grep -n "description\|hsn_code\|qty\|rate\|amount\|meta_json" src/invoices/schemas.ts | head -20
# Ensure all new fields are .optional()
grep -n "warehouse_id\|is_service\|material_id" src/invoices/schemas.ts
# Ensure no compile errors
npm run typecheck 2>&1 | grep -i "error" | head -20 || echo "Typecheck clean"
```

**Checkpoint**: `git add . && git commit -m "Phase 2: Extend schemas with warehouse/stock fields"`

---

## Phase 3: Stock Deduction API Module

**Goal**: Create a new API module for stock operations. No changes to existing `src/invoices/api.ts` yet.

**New File**: `src/invoices/stock-deduction/api.ts`

**Functions**:
```ts
export async function deductInvoiceStock(
  invoiceId: string,
  orgId: string,
  mode: 'itemized' | 'lot',
  allowInsufficient: boolean = false
): Promise<{ material_id: string; warehouse_id: string; requested: number; available: number; deducted: number; status: string }[]>

export async function reverseInvoiceStockDeductions(invoiceId: string): Promise<void>

export async function getInvoiceStockDeductions(invoiceId: string): Promise<any[]>

export function validateStockAvailability(
  items: any[],
  stockRows: any[],
  defaultWarehouseId?: string | null
): { materialId: string; warehouseId: string; requested: number; available: number; sufficient: boolean }[]
```

**Internal logic**:
- `deductInvoiceStock` calls `supabase.rpc()` with the correct RPC name based on mode
- `reverseInvoiceStockDeductions` calls `reverse_invoice_stock_deductions` RPC
- `validateStockAvailability` is pure TypeScript for client-side pre-check (no DB call)

**Special Instruction**: This file is **net-new**. It imports from `src/lib/supabase.ts` only. No imports from existing invoice API to avoid circular dependencies.

**After Phase 3 — Audit Check**:
```bash
# Ensure file exists and exports are clean
grep -n "export async function\|export function" src/invoices/stock-deduction/api.ts
# Ensure no compile errors
npm run typecheck 2>&1 | grep -i "error" | head -20 || echo "Typecheck clean"
```

**Checkpoint**: `git add . && git commit -m "Phase 3: Add stock-deduction API module"`

---

## Phase 4: Invoice Editor — Warehouse Panel

**Goal**: Add a compact "Stock & Warehouse" panel to `InvoiceEditorPage.tsx`.

**File**: `src/invoices/pages/InvoiceEditorPage.tsx`

**Location**: Between the header section (client, dates, PO) and the items table.

**UI Elements**:
1. **Default Warehouse** dropdown — uses existing `useWarehouses()` hook
   - `onChange` → sets `form.setValue('default_warehouse_id', value)`
   - Also updates all EXISTING material rows that don't have an explicit warehouse: loop through `items` and set `meta_json.warehouse_id = value` IF `meta_json.material_id` exists and `meta_json.warehouse_id` is not already set

2. **Deduct stock on finalize** toggle — `Switch` or checkbox
   - `form.setValue('deduct_stock_on_finalize', checked)`

3. **Allow insufficient stock** toggle — only visible when deduct toggle is ON
   - `form.setValue('allow_insufficient_stock', checked)`

4. **Stock Summary badge** — live read-only text:
   - "5 material items · 2 service items · 1 description-only"
   - "Stock check: 4 OK · 1 short (Item X: need 10, have 3)"

**Special Instruction**:
- Do NOT remove any existing form fields, handlers, or `useEffect` hooks.
- The warehouse panel should be **collapsible** (default collapsed) to avoid cluttering existing users.
- Use existing `watch()` and `setValue()` patterns — no new state managers.

**After Phase 4 — Audit Check**:
```bash
# Ensure no existing imports were removed
grep -n "import " src/invoices/pages/InvoiceEditorPage.tsx | head -30
# Ensure useWarehouses is imported
grep -n "useWarehouses" src/invoices/pages/InvoiceEditorPage.tsx
# Ensure no compile errors
npm run typecheck 2>&1 | grep -i "error" | head -20 || echo "Typecheck clean"
```

**Checkpoint**: `git add . && git commit -m "Phase 4: Add warehouse panel to InvoiceEditorPage"`

---

## Phase 5: Invoice Items Editor — Per-Row Warehouse & Stock

**Goal**: Add WAREHOUSE and STOCK columns to the itemized items table.

**File**: `src/invoices/components/InvoiceItemsEditor.tsx`

**New Columns** (inserted after UNIT column, before AMOUNT):

| WAREHOUSE | STOCK |
|-----------|-------|
| `<select>` or custom dropdown | `<Badge>` read-only |

**Row Logic** (for each `item` in `items`):

```ts
const materialId = item.meta_json?.material_id;
const isService = item.meta_json?.is_service;
const hasMaterial = !!materialId;

if (!hasMaterial) {
  // Description-only line (from PO/Quotation with no material match)
  warehouseCell = <span>—</span>;
  stockCell = <span>—</span>;
} else if (isService) {
  // Service item (Erection charges, etc.)
  warehouseCell = <span>—</span>;
  stockCell = <Badge variant="secondary">Service</Badge>;
} else {
  // Material item — show warehouse dropdown
  warehouseCell = (
    <WarehouseDropdown
      value={item.meta_json?.warehouse_id || defaultWarehouseId}
      onChange={(whId) => updateItemField(index, 'meta_json.warehouse_id', whId)}
      options={warehouses}
    />
  );
  
  // Stock badge
  const available = getAvailableStock(materialId, item.meta_json?.warehouse_id, item.meta_json?.variant_id, stockRows);
  const requested = item.qty;
  const isSufficient = available >= requested;
  stockCell = (
    <Badge variant={isSufficient ? 'success' : 'destructive'}>
      {available} avail
    </Badge>
  );
}
```

**Props to add**:
```ts
interface InvoiceItemsEditorProps {
  // ... existing props ...
  warehouses: { id: string; name: string }[];
  stockRows: { item_id: string; warehouse_id: string; company_variant_id: string | null; current_stock: number }[];
  defaultWarehouseId?: string | null;
}
```

**Special Instruction**:
- Do NOT remove any existing columns (DESCRIPTION, HSN, QTY, RATE, AMOUNT, ACTIONS).
- Do NOT change drag-and-drop or row reordering logic.
- The new columns should have `width: auto` and not push existing columns off-screen. Consider a min-width wrapper.

**After Phase 5 — Audit Check**:
```bash
# Ensure existing columns still exist
grep -n "Description\|HSN\|Qty\|Rate\|Amount\|Actions" src/invoices/components/InvoiceItemsEditor.tsx | head -20
# Ensure no compile errors
npm run typecheck 2>&1 | grep -i "error" | head -20 || echo "Typecheck clean"
# Visual check: open InvoiceEditor in browser, verify table renders
```

**Checkpoint**: `git add . && git commit -m "Phase 5: Add warehouse+stock columns to InvoiceItemsEditor"`

---

## Phase 6: Invoice Materials Editor — LOT Mode Warehouse

**Goal**: Add warehouse dropdown to each row in the LOT mode materials table.

**File**: `src/invoices/components/InvoiceMaterialsEditor.tsx`

**New Column** (inserted after Product column, before Qty Used):

| Product | WAREHOUSE | Qty Used |
|---------|-----------|----------|
| `<select>` | `<select>` | `<input type="number">` |

**Row Logic**:
- Every row in `materials[]` represents a real product, so warehouse applies to all
- Default value = `form.default_warehouse_id`
- On change: `register(`materials.${index}.warehouse_id`)`

**Props to add**:
```ts
interface InvoiceMaterialsEditorProps {
  // ... existing props ...
  warehouses: { id: string; name: string }[];
  defaultWarehouseId?: string | null;
}
```

**Special Instruction**:
- Do NOT remove the "Add" button or "Remove" button.
- Do NOT change the "Materials Used" header or container styling.

**After Phase 6 — Audit Check**:
```bash
# Ensure existing columns still exist
grep -n "Product\|Qty Used" src/invoices/components/InvoiceMaterialsEditor.tsx | head -10
# Ensure warehouse column was added
grep -n "warehouse\|Warehouse" src/invoices/components/InvoiceMaterialsEditor.tsx | head -10
# Ensure no compile errors
npm run typecheck 2>&1 | grep -i "error" | head -20 || echo "Typecheck clean"
```

**Checkpoint**: `git add . && git commit -m "Phase 6: Add warehouse column to InvoiceMaterialsEditor"`

---

## Phase 7: Wire Stock Deduction into Save Flow

**Goal**: Call stock deduction when invoice is saved as `final`. Reverse if reverted to `draft`.

**File**: `src/invoices/api.ts`

**Changes** (inside `createInvoice` and `updateInvoice`):

### 7a. `createInvoice` (after successful insert)

After inserting `invoice_items` and `invoice_materials`, check:
```ts
if (validated.status === 'final' && validated.deduct_stock_on_finalize) {
  const mode = validated.mode; // 'itemized' or 'lot'
  const allowInsufficient = validated.allow_insufficient_stock ?? false;
  
  const { data: deductions, error: stockError } = await supabase.rpc(
    mode === 'lot' ? 'deduct_invoice_stock_lot' : 'deduct_invoice_stock_itemized',
    {
      p_invoice_id: invoiceId,
      p_organisation_id: organisationId,
      p_allow_insufficient: allowInsufficient,
    }
  );
  
  if (stockError) throw stockError;
  
  // Check for insufficient items
  const insufficient = deductions?.filter((d: any) => d.status === 'INSUFFICIENT');
  if (insufficient?.length > 0 && !allowInsufficient) {
    // Reverse what was deducted so far
    await supabase.rpc('reverse_invoice_stock_deductions', { p_invoice_id: invoiceId });
    // Throw with item names
    const names = insufficient.map((i: any) => `${i.material_id} (need ${i.requested_qty}, have ${i.available_qty})`).join(', ');
    throw new Error(`Insufficient stock: ${names}`);
  }
}
```

### 7b. `updateInvoice` (after successful update)

Detect status change:
```ts
const oldStatus = /* fetch from DB before update */;
const newStatus = validated.status;

// Draft → Final: deduct stock
if (oldStatus !== 'final' && newStatus === 'final' && validated.deduct_stock_on_finalize) {
  // Same logic as createInvoice
}

// Final → Draft: reverse stock
if (oldStatus === 'final' && newStatus !== 'final') {
  await supabase.rpc('reverse_invoice_stock_deductions', { p_invoice_id: invoiceId });
}
```

**Note**: To detect `oldStatus`, you may need to fetch the invoice before updating. If this adds a round-trip, consider passing the old status as a parameter or caching it.

**Alternative** (simpler): In `updateInvoice`, the caller (InvoiceEditorPage) already knows the old status. Pass it as `previousStatus` in the input:
```ts
export async function updateInvoice(
  input: InvoiceInput & { organisation_id: string; id: string; previousStatus?: string }
): Promise<InvoiceWithRelations> { ... }
```

**Special Instruction**:
- The stock deduction is a **side effect** that happens AFTER the invoice is saved.
- If stock deduction fails, the invoice should still be saved (or we reverse and throw — user decides). Recommended: **reverse + throw** so user sees the error and can fix warehouses.
- Do NOT remove any existing logic (PO utilized value update, etc.).

**After Phase 7 — Audit Check**:
```bash
# Ensure createInvoice still inserts items and materials
grep -n "invoice_items\|invoice_materials\|insert" src/invoices/api.ts | head -20
# Ensure updateInvoice still updates items and materials
grep -n "update\|delete\|insert" src/invoices/api.ts | grep -A2 -B2 "invoice_items\|invoice_materials" | head -30
# Ensure PO utilized value logic is untouched
grep -n "update_po_utilized_value" src/invoices/api.ts
# Ensure no compile errors
npm run typecheck 2>&1 | grep -i "error" | head -20 || echo "Typecheck clean"
```

**Checkpoint**: `git add . && git commit -m "Phase 7: Wire stock deduction into invoice save flow"`

---

## Phase 8: Pass Props Down — InvoiceEditorPage Wiring

**Goal**: Connect the warehouse panel, items editor, and materials editor with the correct props.

**File**: `src/invoices/pages/InvoiceEditorPage.tsx`

**Changes**:
1. Fetch warehouses via `useWarehouses()` (if not already imported)
2. Fetch `item_stock` rows for the organisation:
   ```ts
   const { data: stockRows } = useQuery({
     queryKey: ['item-stock', organisation?.id],
     queryFn: () => supabase.from('item_stock').select('*').eq('organisation_id', organisation?.id),
     enabled: !!organisation?.id,
   });
   ```
3. Pass `warehouses`, `stockRows`, and `defaultWarehouseId` to:
   - `InvoiceItemsEditor` (as new props)
   - `InvoiceMaterialsEditor` (as new props)
4. Add a `useEffect` that watches `default_warehouse_id` changes and auto-applies to new/existing items:
   ```ts
   useEffect(() => {
     const defaultWh = watch('default_warehouse_id');
     if (!defaultWh) return;
     
     const items = watch('items');
     items.forEach((item, idx) => {
       if (item.meta_json?.material_id && !item.meta_json?.warehouse_id) {
         setValue(`items.${idx}.meta_json.warehouse_id`, defaultWh);
       }
     });
   }, [watch('default_warehouse_id')]);
   ```

**Special Instruction**:
- Do NOT remove any existing `useEffect`, `useQuery`, or handler functions.
- The stock query should use React Query's `enabled` flag to avoid firing when `organisation` is null.

**After Phase 8 — Audit Check**:
```bash
# Ensure InvoiceItemsEditor and InvoiceMaterialsEditor are still rendered
grep -n "InvoiceItemsEditor\|InvoiceMaterialsEditor" src/invoices/pages/InvoiceEditorPage.tsx | head -10
# Ensure existing handlers (handlePOLineItemsApply, etc.) are untouched
grep -n "handlePOLineItemsApply\|handleQuotationItemsApply\|handleChallanItemsApply" src/invoices/pages/InvoiceEditorPage.tsx | head -10
# Ensure no compile errors
npm run typecheck 2>&1 | grep -i "error" | head -20 || echo "Typecheck clean"
```

**Checkpoint**: `git add . && git commit -m "Phase 8: Wire props from InvoiceEditorPage to child editors"`

---

## Phase 9: Final Integration & End-to-End Test

**Goal**: Test the complete flow.

**Test Scenarios**:

| # | Scenario | Expected Result |
|---|----------|----------------|
| 1 | Create itemized invoice with materials, select warehouses, save as final | Stock deducted from selected warehouses |
| 2 | Create itemized invoice with service item (Erection) | No warehouse dropdown, no stock deducted |
| 3 | Create itemized invoice with description-only line (no material match) | No warehouse dropdown, no stock deducted |
| 4 | Create LOT invoice, add materials with warehouses, save as final | Stock deducted from materials table |
| 5 | Convert Quotation → Invoice (mixed: matched material + description-only) | Matched items get warehouse dropdown; unmatched shows "—" |
| 6 | Convert DC → Invoice | Items already have material_id, warehouse dropdown appears |
| 7 | Finalize invoice with insufficient stock, allow_insufficient = false | Error shown, no stock deducted |
| 8 | Finalize invoice with insufficient stock, allow_insufficient = true | Invoice saved, stock deducted up to available qty |
| 9 | Revert final invoice back to draft | Stock restored via reverse function |
| 10 | Edit existing invoice (created before this feature) | No errors, no stock UI shown, behaves exactly as before |

**Audit Check**:
```bash
# Full typecheck
npm run typecheck
# Build check
npm run build
# Test key pages load without runtime errors
# (Manual: open /invoices/new, /invoices/edit/:id)
```

**Final Checkpoint**: `git add . && git commit -m "Phase 9: Invoice stock deduction — complete"`

---

## Rollback Plan

If any phase causes issues:

```bash
# Revert to previous checkpoint
git log --oneline -10
# Find the checkpoint commit hash
git reset --hard <checkpoint-hash>
```

If the migration was already run in Supabase:
```sql
-- Run this in Supabase SQL Editor to clean up
DROP TABLE IF EXISTS invoice_stock_deductions;
ALTER TABLE invoice_materials DROP COLUMN IF EXISTS warehouse_id;
DROP FUNCTION IF EXISTS deduct_invoice_stock_itemized(UUID, UUID, BOOLEAN);
DROP FUNCTION IF EXISTS deduct_invoice_stock_lot(UUID, UUID, BOOLEAN);
DROP FUNCTION IF EXISTS reverse_invoice_stock_deductions(UUID);
```

---

## Summary of Guarantees

| Guarantee | How it's enforced |
|-----------|-----------------|
| No existing tables modified | Only `ALTER TABLE invoice_materials ADD COLUMN` (nullable) |
| No existing functions removed | All changes are `.add()` or new files |
| Existing invoices unaffected | New fields are `.optional()`, defaults are safe |
| Conversion flows untouched | `loadInvoiceSource()` and `mapSourceToInvoice()` are NOT modified |
| Service items bypass stock | Detected via `meta_json.is_service`, skipped in RPC |
| Description-only lines bypass stock | Detected via absence of `meta_json.material_id`, skipped in RPC |
| Stock is reversible | `reverse_invoice_stock_deductions()` restores `item_stock` |
