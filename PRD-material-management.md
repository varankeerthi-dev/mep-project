# PRD: Project Material Management — Planned, Supplied & Received Tracking

## Overview
Extend `project_material_list` to track three quantities per material — **Planned** (estimate), **Supply** (ordered/procured), **Received** (warehouse receipt) — with source document proof for client-facing reporting.

---

## Phase 1: Schema & Migration

### Database Changes (`049_material_list_supply_tracking.sql`)

**Table: `project_material_list`**

| Column | Type | Default | Description |
|---|---|---|---|
| `planned_qty` | DECIMAL(15,2) | 0 | Estimate — manual entry, can be imported from BOQ/Quotation |
| `supply_qty` | DECIMAL(15,2) | 0 | Quantity actually ordered/supplied — manual entry keyed to source doc |
| `received_qty` | DECIMAL(15,2) | 0 | Auto-computed via trigger on `material_intents` |
| `source_type` | TEXT | 'manual' | Origin: `'manual'`, `'boq'`, `'quotation'` |
| `source_reference` | UUID | null | FK to `boq_items.id` / `quotation_items.id` (internal, not client-facing) |
| `source_document` | TEXT | null | DC No, Invoice No, PO No — client-facing proof of supply |

Add columns idempotently via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.

### Received Qty Trigger

- On `material_intents` INSERT/UPDATE/DELETE: re-sum `received_qty` for that `(project_id, item_id, variant_id)` from all non-rejected intents.
- Shared PG function so triggers + manual backfill use same logic.
- Backfill: loop existing distinct `(project_id, item_id, variant_id)` combos.

### Migration Strategy
- Drop migration 048 (my earlier draft, superseded by this)
- Use a single clean migration numbered 049

---

## Phase 2: Material List UI

### Add/Edit Modal

Current modal has: Material, Variant, Planned Qty, Unit, Rate, Remarks

**New modal layout:**

```
┌─────────────────────────────────────────────┐
│  Material*     [dropdown]                    │
│  Variant       [dropdown]                    │
│  ─────────────────────────────────────       │
│  Planned Qty*  [input:number]                │
│  Supply Qty*   [input:number]                │
│  Source Doc    [input:text] "DC-001 / INV..."│
│  ─────────────────────────────────────       │
│  Unit*         [input:text]                  │
│  Rate*         [input:number]                │
│  Remarks       [textarea]                    │
│  ─────────────────────────────────────       │
│  Source Type (hidden from UI, set to manual) │
└─────────────────────────────────────────────┘
```

- **Planned Qty**: required, user's estimate
- **Supply Qty**: required, how much was actually ordered
- **Source Doc**: text field, client-facing proof (DC No / Invoice No / PO No)
- `source_type` = `'manual'` when adding manually

### Table Columns

Both BOQ and Non-BOQ sections get two new columns:

| # | Column | Width | Notes |
|---|---|---|---|
| 1 | (expand) | 40px | |
| 2 | Material | 1fr | |
| 3 | Variant | 100px | |
| 4 | **Planned Qty** | 80px | Always visible, editable inline |
| 5 | **Supply Qty** | 80px | New — editable inline |
| 6 | **Received Qty** | 80px | New — read-only, blue color |
| 7 | Source Doc | 120px | New — read-only, text |
| 8 | Unit | 80px | |
| 9 | Rate | 100px | |
| 10 | Cost | 100px | |
| 11 | Remarks | 120px | |
| 12 | Actions | 80px | |

Total grid: `40px 1fr 100px 80px 80px 80px 120px 80px 100px 100px 120px 80px`

### Inline Edit Mode

When editing a row, `supply_qty` gets an input (like planned_qty). `received_qty` remains read-only text. Source Doc gets an input.

### Expandable Details Row

Add to the expanded view:

- Source Type (internal only — useful for debugging)
- Source Reference (internal only)
- Received Qty breakdown (could show intent-wise list, future enhancement)

---

## Phase 3: Smart Auto-Fetch from DC/Invoice

### Fetch Modal

When user selects a material+variant in the Add modal, provide a **"Fetch from Receipts"** button that opens a sub-modal:

```
┌─────────────────────────────────────────────┐
│  Fetch from Receipts — Material: PVC Pipe   │
│                                              │
│  ┌─────┬──────────┬──────────┬───────────┐  │
│  │ #   │ DC No    │ Invoice  │ Qty       │  │
│  ├─────┼──────────┼──────────┼───────────┤  │
│  │ ☑  │ DC-001   │ INV-101  │ 50        │  │
│  │ ☐  │ DC-002   │ INV-102  │ 30        │  │
│  │ ☑  │ DC-005   │ INV-201  │ 20        │  │
│  └─────┴──────────┴──────────┴───────────┘  │
│                                              │
│  Selected: 2 items | Total Qty: 70           │
│                                              │
│         [Cancel]    [Apply to Row]           │
└─────────────────────────────────────────────┘
```

- Checkboxes: multi-select receipts from `material_logs`
- On Apply: `supply_qty` = sum of selected qty, `source_document` = concatenated DC/Invoice numbers
- **Not a live link** — it's a one-time fetch. Future receipts don't auto-update.

### API

```ts
async function getMaterialReceipts(projectId: string, itemId: string, variantId?: string) {
  return supabase
    .from('material_logs')
    .select('id, dc_number, invoice_number, qty_received, supplier_name, created_at')
    .eq('project_id', projectId)
    .eq('item_id', itemId)
    .eq('type', 'IN')
    .order('created_at', { ascending: false });
}
```

### Edge Cases Handled

| # | Scenario | Resolution |
|---|---|---|
| 1 | Multiple DCs for same material | Multi-select checkboxes, concatenate docs, sum qty |
| 2 | No receipts exist yet | Button disabled, tooltip: "No receipts found for this material" |
| 3 | User re-opens row later | Show previously selected docs in pre-checked state (match by `source_document` containing dc/invoice text) |
| 4 | Material+variant returns nothing | Show empty state, user enters manually |

---

## Phase 4: Trigger Wiring & Backfill

### Trigger Implementation

**Function:** `refresh_material_list_received_qty`

```
For each (project_id, item_id, variant_id):
  SELECT SUM(mi.received_qty) INTO v_received
  FROM material_intents mi
  WHERE mi.project_id = p_project_id
    AND mi.item_id = p_item_id
    AND (mi.variant_id = p_variant_id OR ...)
    AND mi.status != 'Rejected'

  UPDATE project_material_list
  SET received_qty = v_received
  WHERE project_id, item_id, variant_id match
```

Triggers: `AFTER INSERT/UPDATE/DELETE ON material_intents`

### Backfill

```sql
-- For all existing project_material_list rows that have matching intents
UPDATE project_material_list pml
SET received_qty = COALESCE((
  SELECT SUM(mi.received_qty)
  FROM material_intents mi
  WHERE mi.project_id = pml.project_id
    AND mi.item_id = pml.item_id
    AND (mi.variant_id = pml.variant_id OR ...)
    AND mi.status != 'Rejected'
), 0);

-- For rows with no matching intents, received_qty stays 0 (correct default)
```

### Edge Cases

| # | Scenario | Resolution |
|---|---|---|
| 1 | Intent deleted | Trigger re-sums, received_qty decreases. Design intent — not a bug |
| 2 | Intent status changed to Rejected | Trigger filters `status != 'Rejected'`, so it's excluded from sum |
| 3 | Partial receipt on multiple intents | All intents for same (project, item, variant) sum correctly |
| 4 | Over-delivery (received > requested) | Allowed. received_qty can exceed supply_qty, no cap |
| 5 | Trigger fires on unrelated intent column update (e.g. notes) | Trigger only cares about: project_id, item_id, variant_id, received_qty, status. If none changed, function exits early with a no-op check |

---

## Phase 5: BOQ & Quotation Import (Future)

### Architecture

Not implementing now. Schema pre-built for it:

```
source_type = 'boq'       → source_reference = boq_items.id
source_type = 'quotation' → source_reference = quotation_items.id
```

### Planned Import Flow (Future)

```
[Import from BOQ] button in material list header
  → Opens modal: shows BOQ items for this project
  → Checkboxes per item
  → On confirm:
      INSERT INTO project_material_list (
        project_id, item_id, variant_id,
        planned_qty ← boq_item.qty (pre-filled, editable before import)
        supply_qty  ← 0 (user fills later)
        source_type ← 'boq'
        source_reference ← boq_item.id
        unit, rate ← from boq_item
      )
```

Quotation import follows identical pattern. The `source_type` + `source_reference` pair allows tracing every material entry back to its origin document, without the user re-entering data.

### Edge Cases (Future)

| # | Scenario | Resolution |
|---|---|---|
| 1 | BOQ revision changes qty | BOQ item updated; material list NOT auto-synced. Snapshot principle — user sees stale data and re-imports if needed |
| 2 | Re-importing BOQ after changes | Detect duplicates: if `(project_id, item_id, variant_id, source_type, source_reference)` already exists, skip or prompt "Update existing?" |
| 3 | Quotation → BOQ conflict | Same material in both. Fine — they're separate source entries. User can have two rows: one from BOQ (planned/source=boq) and one from quotation (supply/source=quotation) |
| 4 | BOQ item removed from project | No cascade delete. Material list row stays (orphaned reference). User deletes manually |
