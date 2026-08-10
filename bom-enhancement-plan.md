# BOM Module — Implementation Plan

**Scope:** `pages/manufacturing/BOMEditor.tsx`, `pages/manufacturing/BOMList.tsx`, `features/manufacturing/` (model, persistence, repository, hooks), `database-manufacturing.sql`, new migration files  
**Approach:** Phased, additive schema changes with full backward compatibility. No existing fields removed or made required.  
**New convention:** All new BOM columns are nullable with safe defaults. Existing queries, forms, and reports continue to work without modification.

---

## Phase 0 — Foundation: cost data and custom attributes

**Goal:** Add the two fields that every other phase depends on or benefits from, without touching the UI.

### Schema

**`database-manufacturing.sql` amendments + new migration `013_bom_enhancements.sql`:**

```sql
-- bom_headers
ALTER TABLE bom_headers ADD COLUMN IF NOT EXISTS custom_attributes JSONB DEFAULT '{}'::jsonb;
ALTER TABLE bom_headers ADD COLUMN IF NOT EXISTS total_estimated_cost DECIMAL(14,2) DEFAULT 0;
ALTER TABLE bom_headers ADD COLUMN IF NOT EXISTS estimated_production_minutes INTEGER DEFAULT 0;

-- bom_items
ALTER TABLE bom_items ADD COLUMN IF NOT EXISTS custom_attributes JSONB DEFAULT '{}'::jsonb;
ALTER TABLE bom_items ADD COLUMN IF NOT EXISTS unit_cost DECIMAL(14,2) DEFAULT 0;
ALTER TABLE bom_items ADD COLUMN IF NOT EXISTS sequence_no INTEGER DEFAULT 0;
ALTER TABLE bom_items ADD COLUMN IF NOT EXISTS work_center_id UUID REFERENCES work_centers(id) ON DELETE SET NULL;
ALTER TABLE bom_items ADD COLUMN IF NOT EXISTS is_critical BOOLEAN DEFAULT false;
ALTER TABLE bom_items ADD COLUMN IF NOT EXISTS alternate_material_id UUID REFERENCES materials(id) ON DELETE SET NULL;
ALTER TABLE bom_items ADD COLUMN IF NOT EXISTS drawing_reference VARCHAR(100);
ALTER TABLE bom_items ADD COLUMN IF NOT EXISTS inspection_required BOOLEAN DEFAULT false;
ALTER TABLE bom_items ADD COLUMN IF NOT EXISTS shelf_life_days INTEGER;
ALTER TABLE bom_items ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL;
```

### Types

`model/types.ts` — extend both interfaces:

```ts
export interface BOMHeader {
  /* existing fields unchanged */
  custom_attributes?: Record<string, any>;
  total_estimated_cost?: number;
  estimated_production_minutes?: number;
  revision?: string;
  effective_date?: string;
  valid_to?: string;
  product_code?: string;
  bom_type?: string;           // 'assembly' | 'repetitive' | 'formula'
  priority?: string;           // 'low' | 'medium' | 'high' | 'critical'
  product_category?: string;   // 'standard' | 'custom' | 'prototype'
  created_by_name?: string;
  approved_by_name?: string;
}

export interface BOMItem {
  /* existing fields unchanged */
  custom_attributes?: Record<string, any>;
  unit_cost?: number;
  sequence_no?: number;
  work_center_id?: string;
  is_critical?: boolean;
  alternate_material_id?: string;
  drawing_reference?: string;
  inspection_required?: boolean;
  shelf_life_days?: number;
  warehouse_id?: string;
  scrap_factor?: number;       // replaces/augments wastage_pct
  yield_pct?: number;          // expected good output %
}
```

### Persistence

No changes needed. `fetchBOMHeaders`, `fetchBOMHeaderById`, `fetchBOMItemsByHeaderId`, `insertBOMHeader`, `updateBOMHeader`, `insertBOMItems` all use `select('*')` or full-object insert/update. The new columns flow through automatically.

### Repository

`bomRepository.ts` — add cost rollup calculation inside `saveBOM`, after items are inserted:

```ts
const totalCost = items.reduce((sum, item) => {
  const qty = item.required_qty || 0;
  const cost = item.unit_cost || 0;
  return sum + qty * cost;
}, 0);

const totalMinutes = items.reduce((sum, item) => {
  // pull from work_center data if linked; 0 if not
  return sum + (item.cycle_time_minutes || 0);
}, 0);

await P.updateBOMHeader(bomId, {
  total_estimated_cost: totalCost,
  estimated_production_minutes: totalMinutes,
});
```

### Hooks

No changes needed. `useSaveBOMMutation` payload type is `Partial<BOMHeader>` plus `items: Partial<BOMItem>[]` — new fields pass through automatically.

### QA

- Create BOM → verify `total_estimated_cost` and `estimated_production_minutes` are calculated on save
- Edit BOM → verify cost recalculates when item quantities or unit costs change
- Existing BOMs load correctly with new columns defaulting to `0` / `{}`

---

## Phase 1 — BOM Header: identity and versioning

**Goal:** Add the fields that control which BOM is active, who owns it, and what it is.

### Schema

Already in Phase 0 migration above.

### UI — BOMEditor.tsx

**Card 1 (BOM Details)** gets three new fields:

| Field | Control | Placement |
|---|---|---|
| `product_code` | Text input | Next to `product_name` — paired display |
| `revision` | Text input, default `'A'` for new BOMs | Below `bom_code` |
| `bom_type` | Select: Assembly / Repetitive / Formula | New row in Card 1 |
| `product_category` | Select: Standard / Custom / Prototype | New row in Card 1 |
| `priority` | Select: Low / Medium / High / Critical | New row in Card 1 |

**Effective dates** — new subsection "Validity Period" within Card 1:

| Field | Control |
|---|---|
| `effective_date` | Date input, defaults to today for new BOMs |
| `valid_to` | Date input, optional — leave blank for open-ended |

**Created by / Approved by** — display-only fields in Card 2 (Options), populated from `approval_status` change events and shown as read-only text, not editable inputs. The `created_by_name` is set on first save. `approved_by_name` is set when approval_status moves to `approved`.

### Type updates

Already in Phase 0.

### Repository

`saveBOM` payload now includes the new header fields. No logic change — they pass through to `insertBOMHeader` / `updateBOMHeader`.

### Status workflow clarification

Current `approval_status` values: `draft` | `pending_approval` | `approved` | `obsolete`.

Do **not** change the enum values now. The current four states are sufficient for the near term. If a more granular workflow is needed later (e.g., `under_review`, `released_to_production`), it becomes a separate migration that adds values to the existing enum — no schema break.

### QA

- Create BOM → revision defaults to `A`, effective_date defaults to today
- Edit BOM → revision increments manually (no auto-increment — that is a business rule decision for later)
- BOMList → add `revision` and `bom_type` as optional columns in the table

---

## Phase 2 — BOM Item: operation sequencing and work center linking

**Goal:** Connect each BOM line to a work center and establish processing order. This is the highest-value addition because it connects the BOM to production scheduling and capacity planning.

### Schema

Already in Phase 0 migration (`sequence_no`, `work_center_id`).

### New UI section in BOMEditor

After "Raw Materials" card, add a new card **"4. Operations & Routing"** — visible only when at least one material is selected.

Each row in the raw materials table gains two new columns:

| Column | Control | Behavior |
|---|---|---|
| `sequence_no` | Number input, auto-increments on add | Defaults to current row count + 1; editable |
| `Work Center` | Select dropdown fetched from `work_centers` table | Populated from existing `WorkCenter` data; optional |

The "Add Sub-material" action preserves the parent's `work_center_id` and `sequence_no` gap — sub-assemblies inherit the parent's work center by default but can be overridden.

### Work center query

`useWorkCentersQuery` already exists in `hooks/useWorkCenters.ts`. Import it into `BOMEditor.tsx` and use it to populate the work center select.

### Display

The BOMList does not need to show work center data. The BOMEditor is the primary consumer. If a summary view is needed later, it can be added as a column.

### QA

- Add 3 materials → sequence numbers are 1, 2, 3
- Delete row 2 → re-sequence remaining rows
- Assign work center to row 1 → save → reload → work center persists
- Sub-assembly inherits parent work center by default

---

## Phase 3 — BOM Item: procurement resilience and traceability

**Goal:** Add fields that protect production when materials are unavailable and give operators/QC the references they need to verify correctness.

### Schema

Already in Phase 0 migration (`is_critical`, `alternate_material_id`, `drawing_reference`, `inspection_required`, `shelf_life_days`, `warehouse_id`).

### UI — new columns in raw materials table

| Column | Control | Placement in table |
|---|---|---|
| `is_critical` | Toggle badge (Critical / Normal) | New column, after Lead Time |
| `Alternate` | Material search dropdown, same style as material select | New column, after Critical |
| `Drawing Ref` | Text input | New column, after Alternate |
| `Inspect` | Checkbox toggle | New column, after Drawing Ref |
| `Shelf Life` | Number input (days) | New column, after Inspect |
| `Warehouse` | Select from `useWarehousesQuery` | New column, after Shelf Life |

For sub-assembly rows, all new columns show `—` (same convention as Waste % and Lead Time currently use).

### Alternate material behavior

The alternate material dropdown uses the same `useRawMaterialsQuery` data as the main material select. It filters out the current row's own material_id so you cannot set Material A as its own alternate.

### Inspection required linkage

When `inspection_required = true`, the item is flagged for QC. The `createJobCardAggregate` RPC (Phase 1 of the earlier fix) will later check this flag and create `IPQCCheckpoint` records automatically. That wiring is Phase 4 work — this phase only stores the flag.

### QA

- Toggle `is_critical` on a row → save → reload → flag persists
- Select alternate material → save → reload → alternate persists
- Enter drawing reference → save → reload → persists
- Check inspection required → save → reload → persists
- Sub-assembly rows show `—` for all new columns

---

## Phase 4 — BOM Item: scrap/yield split and cost display

**Goal:** Separate the concept of "material lost in process" from "expected good output", and make unit cost and total cost visible in the editor.

### Schema

Already in Phase 0 migration (`scrap_factor`, `yield_pct`). `wastage_pct` remains as a backward-compatible alias that defaults to `scrap_factor` when not explicitly set. The save logic maps:

```ts
if (item.wastage_pct && !item.scrap_factor) {
  item.scrap_factor = item.wastage_pct;
}
```

This preserves existing data without a migration script.

### UI changes

**Waste % column** in the raw materials table becomes **"Scrap %"** with the same input. A new column **"Yield %"** appears next to it, defaulting to `100 - scrap_factor`.

When `scrap_factor` changes, `yield_pct` auto-adjusts to maintain `scrap + yield = 100`. The user can override yield independently after that.

**Unit cost column** — new column in the raw materials table, populated from the material master's `current_cost` or `unit_cost` field (whichever exists in the `materials` table). Editable — users can override the master cost for this specific BOM if the negotiated price differs.

**Cost rollup** — at the bottom of the raw materials card, add a summary row:

```
Total Material Cost: ₹ X,XXX.XX  |  Est. Production Time: X hrs  |  Est. Cost per Unit: ₹ XX.XX
```

This recalculates live as items are added/removed/edited, using the same calculation as Phase 0's repository logic.

### QA

- Change scrap % → yield % auto-adjusts to 100 - scrap
- Override yield % independently → scrap stays, yield changes
- Enter unit cost → cost rollup at bottom updates live
- Existing BOMs with `wastage_pct` but no `scrap_factor` → scrap_factor backfills from wastage_pct on first edit

---

## Phase 5 — Version history and BOM clone

**Goal:** Enable traceability across BOM revisions and reduce the effort of creating new BOMs from existing ones.

### Schema

```sql
ALTER TABLE bom_headers ADD COLUMN IF NOT EXISTS revision_history JSONB DEFAULT '[]'::jsonb;
ALTER TABLE bom_headers ADD COLUMN IF NOT EXISTS parent_bom_id UUID REFERENCES bom_headers(id) ON DELETE SET NULL;
```

`revision_history` stores snapshots of previous header + items as JSONB. `parent_bom_id` links derived BOMs to their source for clone traceability.

### BOMList — clone action

Add a fourth row action: **"Clone BOM"**.

When clicked:
1. Fetches the source BOM header + items
2. Creates a new BOM with `bom_code` = auto-generated, `revision` = `'A'`, `parent_bom_id` = source BOM id
3. Copies all items with new UUIDs, `required_qty` = source values, all other fields blank/defaulted
4. Navigates to the BOM editor with the new BOM open for editing

The clone action does **not** copy: `bom_code`, `revision`, `approval_status`, `created_by_name`, `approved_by_name`, `total_estimated_cost`, `estimated_production_minutes`. It does copy: `product_name`, `product_id`, `output_qty`, `output_unit`, `description`, `bom_type`, `product_category`, `priority`, and all item fields including `custom_attributes`.

### BOMEditor — revision display

When editing an existing BOM, show the current revision as a non-editable badge near the `bom_code` field. The revision field itself is editable — changing it creates a new revision entry in `revision_history` on save.

### Version comparison (future, not this phase)

`revision_history` stores the snapshots now. A "Compare Revisions" UI is a future phase that reads `revision_history` and diffs two snapshots side by side. The schema and storage for it is laid down here.

### QA

- Clone BOM → new BOM appears in list with auto-generated code, revision A
- New BOM has all items copied from source with correct quantities
- New BOM has `parent_bom_id` pointing to source
- Edit cloned BOM → save → revision field shows current revision

---

## Phase 6 — Warehouse pick location and cost display in BOMList

**Goal:** Surface warehouse assignment and cost data in the list view for planners.

### BOMList — new columns

| Column | Data source | Placement |
|---|---|---|
| `total_cost` | `bom_headers.total_estimated_cost` | After Output column |
| `bom_type` | `bom_headers.bom_type` | After Status column |

Both are optional columns — shown by default but can be hidden via the existing column visibility mechanism if the table component supports it.

### Cost formatting

Use the same currency formatting pattern used elsewhere in the app (`₹` prefix, two decimal places, tabular nums).

### QA

- BOMList shows total cost for each BOM
- BOMList shows BOM type badge
- Sorting/filtering on cost column works

---

## Migration execution order

| Order | Migration file | What it does |
|---|---|---|
| 1 | `013_bom_enhancements.sql` | All Phase 0 schema additions — new columns on `bom_headers` and `bom_items` |
| 2 | `014_bom_revision_history.sql` | Phase 5 schema — `revision_history` JSONB and `parent_bom_id` |

Both use `ADD COLUMN IF NOT EXISTS` with safe defaults. Re-running either migration is harmless.

---

## Files changed, by phase

| File | Phase 0 | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 | Phase 6 |
|---|---|---|---|---|---|---|---|
| `database-manufacturing.sql` | amend | — | — | — | — | — | — |
| `013_bom_enhancements.sql` | new | — | — | — | — | — | — |
| `014_bom_revision_history.sql` | — | — | — | — | new | new | — |
| `model/types.ts` | edit | — | — | — | — | — | — |
| `persistence/bomPersistence.ts` | — | — | — | — | — | — | — |
| `repository/bomRepository.ts` | edit | — | — | — | — | edit | — |
| `hooks/useBoms.ts` | — | — | — | — | — | — | — |
| `pages/manufacturing/BOMEditor.tsx` | — | edit | edit | edit | edit | edit | — |
| `pages/manufacturing/BOMList.tsx` | — | edit | — | — | — | edit | edit |
| `pages/manufacturing-v0/BOMEditor.tsx` | — | — | — | — | — | — | — |

`manufacturing-v0/BOMEditor.tsx` is not touched. It is a legacy version that will be retired separately.

---

## What is explicitly out of scope for this plan

- Percentage-based `quantity_mode` — deferred per earlier analysis. The schema does not include it.
- Auto-incrementing revision numbers — manual entry only in this plan
- Cost rollup including work center labor rates — only material cost is calculated in Phase 0; labor is a future addition when `BomWorkCenter` rate data exists
- Revision comparison UI — snapshots are stored in Phase 5, comparison UI is a future phase
- Deleting or renaming any existing field — all changes are additive

---

## Architecture system — non-negotiable rules for this module

These are not suggestions. Every phase above is implemented within these constraints.

### 1. No monolithic files. Feature boundaries are hard.

The manufacturing feature already has a clean internal structure: `model/`, `persistence/`, `repository/`, `hooks/`. That structure is preserved and enforced.

- **`model/types.ts`** is split into domain files before Phase 0 starts. One file per aggregate: `bom.ts`, `jobCard.ts`, `production.ts`, `dispatch.ts`, `qc.ts`, `stores.ts`, `plan.ts`, `ipqc.ts`, `wip.ts`. Types are re-exported from the original path so no import site breaks during the transition.
- **No page-level logic bleeds into the feature layer.** `BOMEditor.tsx` and `BOMList.tsx` live in `pages/manufacturing/`. They call hooks. They do not call persistence directly. They do not import from other features' internals.
- **No cross-feature imports through the back door.** If `planRepository.ts` needs BOM data, it imports from `features/manufacturing`'s public surface (hooks or repository), not from `features/manufacturing/model/bom.ts` directly. The model split exists to make this enforceable.

### 2. Zod at every boundary where data enters or leaves the system

Zod is the validation layer. It sits between the outside world and your clean internal types. There is no `any` cast that bypasses it.

**At the persistence boundary** — every Supabase response is parsed through Zod before it touches the rest of the codebase:

```ts
// features/manufacturing/validation/bomSchemas.ts
import { z } from 'zod';

const BOMItemSchema = z.object({
  id: z.string().uuid().optional(),
  bom_id: z.string().uuid().optional(),
  material_id: z.string().uuid(),
  required_qty: z.number().positive(),
  unit: z.string(),
  wastage_pct: z.number().min(0).max(100).default(5),
  notes: z.string().optional(),
  company_variant_id: z.string().uuid().optional(),
  variant_name: z.string().optional(),
  make: z.string().optional(),
  lead_time_days: z.number().int().nonnegative().default(0),
  bom_level: z.number().int().nonnegative().default(0),
  parent_material_id: z.string().uuid().nullable().optional(),
  // Phase 0 additions
  custom_attributes: z.record(z.string(), z.any()).default({}),
  unit_cost: z.number().nonnegative().default(0).optional(),
  sequence_no: z.number().int().nonnegative().default(0).optional(),
  work_center_id: z.string().uuid().nullable().optional(),
  is_critical: z.boolean().default(false).optional(),
  alternate_material_id: z.string().uuid().nullable().optional(),
  drawing_reference: z.string().optional(),
  inspection_required: z.boolean().default(false).optional(),
  shelf_life_days: z.number().int().positive().nullable().optional(),
  warehouse_id: z.string().uuid().nullable().optional(),
  scrap_factor: z.number().min(0).max(100).optional(),
  yield_pct: z.number().min(0).max(100).optional(),
});

const BOMHeaderSchema = z.object({
  id: z.string().uuid().optional(),
  bom_code: z.string(),
  product_name: z.string(),
  product_id: z.string().uuid().nullable().optional(),
  output_qty: z.number().positive(),
  output_unit: z.string(),
  description: z.string().optional(),
  is_active: z.boolean().default(true),
  batch_no: z.string().optional(),
  approval_status: z.string().default('draft'),
  organisation_id: z.string().uuid(),
  // Phase 0 additions
  custom_attributes: z.record(z.string(), z.any()).default({}),
  total_estimated_cost: z.number().nonnegative().default(0).optional(),
  estimated_production_minutes: z.number().int().nonnegative().default(0).optional(),
  // Phase 1 additions
  revision: z.string().optional(),
  effective_date: z.string().optional(),
  valid_to: z.string().optional(),
  product_code: z.string().optional(),
  bom_type: z.enum(['assembly', 'repetitive', 'formula']).default('assembly').optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  product_category: z.enum(['standard', 'custom', 'prototype']).optional(),
  created_by_name: z.string().optional(),
  approved_by_name: z.string().optional(),
});

export type BOMHeader = z.infer<typeof BOMHeaderSchema>;
export type BOMItem = z.infer<typeof BOMItemSchema>;
```

**At the hook/mutation boundary** — every `mutationFn` validates its payload before sending it to the repository:

```ts
// features/manufacturing/hooks/useBoms.ts
const payloadSchema = z.object({
  header: BOMHeaderSchema.partial(),
  items: z.array(BOMItemSchema),
});

const mutationFn = async (raw: unknown) => {
  const payload = payloadSchema.parse(raw); // throws ZodError if invalid
  return R.saveBOM(payload);
};
```

**At the form boundary** — `BOMEditor.tsx` form state is validated on save before any network call. This catches typos and missing required fields at the UI layer, not after a round-trip.

```ts
const handleSave = () => {
  const result = SavePayloadSchema.safeParse(headerData);
  if (!result.success) {
    toast.error(result.error.issues[0]?.message || 'Invalid data');
    return;
  }
  saveBOM.mutate(result.data);
};
```

**What this means in practice:**

- `model/types.ts` still exists but becomes a re-export barrel: `export type { BOMHeader } from './bom'`. The actual types live alongside their Zod schemas in `model/bom.ts`, `model/jobCard.ts`, etc. The Zod schema is the single source of truth. The TypeScript type is derived from it via `z.infer`. They cannot drift apart.
- Any `as any` cast that bypasses Zod parsing is a lint violation. No exceptions.
- The existing `as any` casts in the codebase (there are dozens) are technical debt to be removed independently. They are not a license to skip Zod in the manufacturing feature.

### 3. Zustand for all client-side state that survives unmounts or is shared

Zustand is used for three things in this module. Everything else stays in React Query or local `useState`.

**What goes in Zustand:**

| Store | Shape | Used by |
|---|---|---|
| `useBomEditorStore` | `{ items: BOMItem[]; revisionHistory: BOMRevision[]; addItem(); removeItem(); updateItem(); setHeader(); reset(); }` | `BOMEditor.tsx` — the flat `items` array is currently 70+ lines of `useState` boilerplate. Zustand collapses it into a single store with action methods. Sub-assembly tree state (`expandedRowIds`) also lives here. |
| `useWorkCenterStore` | `{ workCenters: WorkCenter[]; selectedId: string | null; setSelected(); }` | Shared between `BOMEditor.tsx` and any future production scheduling view that needs to know which work centers a BOM uses. |
| `useBomCostStore` | `{ totalMaterialCost: number; totalProductionMinutes: number; recalculate(items, workCenters); }` | Derived state — recalculates when items or work center data changes. Read by `BOMEditor.tsx` for the live cost rollup footer, and by `BOMList.tsx` for the cost column. |

**What stays in React Query:**

- All server state: BOM list, BOM detail, work centers list, raw materials, warehouses. These are cached, stale-while-revalidate, and invalidated on mutations. React Query is already used correctly here — no change.
- Mutation state: `useSaveBOMMutation`, `useDeleteBOMMutation`. Loading, error, and success states stay in the hook.

**What stays in local useState:**

- Form field focus state (`openDropdownIndex`, `materialSearchText`, `activeDetailRowId`)
- Transient UI state that does not need to survive a page navigation or be shared across components

**Zustand store structure example:**

```ts
// features/manufacturing/stores/useBomEditorStore.ts
import { create } from 'zustand';
import type { BOMItem } from '../model/bom';

interface BomEditorState {
  items: BOMItem[];
  expandedRowIds: Record<string, boolean>;
  addItem: (item: BOMItem) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, field: keyof BOMItem, value: any) => void;
  setExpanded: (id: string, expanded: boolean) => void;
  reset: () => void;
}

const initialState = {
  items: [{ id: crypto.randomUUID(), material_id: '', required_qty: 0, unit: 'nos', wastage_pct: 5, notes: '', lead_time_days: 0, bom_level: 0, parent_material_id: null, custom_attributes: {} }],
  expandedRowIds: {},
};

export const useBomEditorStore = create<BomEditorState>((set) => ({
  ...initialState,
  addItem: (item) => set((s) => ({ items: [...s.items, item] })),
  removeItem: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
  updateItem: (id, field, value) => set((s) => ({
    items: s.items.map((i) => i.id === id ? { ...i, [field]: value } : i),
  })),
  setExpanded: (id, expanded) => set((s) => ({
    expandedRowIds: { ...s.expandedRowIds, [id]: expanded },
  })),
  reset: () => set(initialState),
}));
```

This replaces the current `useState` blocks for `items` (line 65), `expandedRowIds` (line 68), `activeDetailRowId` (line 69), and `hoveredRowId` (line 80) in `BOMEditor.tsx` — about 80 lines of state management collapsed into a store with named actions.

### 4. Repository layer owns all Supabase calls. Hooks own all React Query wiring. Pages own zero data logic.

This is already the pattern. It is preserved and enforced.

```
BOMEditor.tsx  →  useSaveBOMMutation (hook)  →  bomRepository.saveBOM()  →  persistence.insertBOMHeader()
                                                                                   persistence.insertBOMItems()
                                                                                   persistence.updateBOMHeader()  // cost rollup
```

No step is skipped. No page calls persistence directly. No hook calls another hook's internals.

### 5. Migration files are the source of truth for schema

All schema changes are in SQL migration files, not in TypeScript. The TypeScript types and Zod schemas are derived from the agreed column list and validated against the migration at review time. There is no auto-sync tool — the developer running the migration is responsible for updating the Zod schema and the types in the same commit.

**Migration naming convention:** `013_bom_enhancements.sql`, `014_bom_revision_history.sql`. Numbered sequentially. Each file is self-contained with a header comment stating which phases it covers.

### 6. Validation failure surfaces to the operator as a single actionable message

Zod `safeParse` is used at the form boundary. On failure, the first issue's message is shown via the existing `toast.error()` call. No raw Zod error objects reach the UI. The error messages are:

- `"Required field: product_name"` — not `"Expected string, received undefined"`
- `"Quantity must be positive"` — not `"Number must be greater than 0"`

This means the Zod error map is wrapped once at the form layer, not everywhere Zod is called.

---

## Summary: what changes, what doesn't

| Aspect | Current state | After implementation |
|---|---|---|
| File structure | Already feature-split | `model/` split into domain files, re-export barrel |
| Validation | None — optimistic UI only | Zod at form boundary + persistence boundary |
| State management | `useState` in page components | Zustand for shared/editor state; `useState` only for transient UI |
| Schema changes | Ad-hoc ALTER TABLE scattered across files | Numbered migration files, additive, self-documented |
| Type safety | Hand-written interfaces | Zod schema is source of truth, types derived via `z.infer` |
| Data flow | Already correct | Unchanged — page → hook → repository → persistence |
