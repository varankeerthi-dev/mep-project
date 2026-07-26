# Line Items Behaviors: Comparison & Reusable Specification

## 1. Comparison: CreateQuotation vs CreateProforma (ProformaEditorPage)

### 1.1 Header Form Grid (3-Column Cards)

| Feature | CreateQuotation | CreateProforma (Current) | Status |
|---|---|---|---|
| **Layout** | 3-col `cq-card-elevated` grid | `HeaderFormGrid` + `HeaderCard` | ✅ Refactored |
| **Client search** | `clientSearch: string\|null`, onBlur resets to null, value uses `!== null` check | Same pattern now | ✅ Fixed |
| **Date pickers** | Inline `CustomDatePicker` | Shared `CustomDatePicker` | ✅ Shared |
| **Terms & Conditions** | `TermsConditionsDrawer` + textarea | ❌ Missing | Not yet added |

### 1.2 Line Items Table Header

| Feature | CreateQuotation | CreateProforma (Current) | Status |
|---|---|---|---|
| **"Columns" button** | `showCustomLabelEditor` modal with column toggles + label customization | ❌ Missing | Not yet added |
| **"Add Item" button** | ✅ Present | ✅ Present | Same |
| **"Select from Inventory"** | ✅ Present (via `setShowItemPicker`) | ✅ Present (via `ItemSelectorDrawer`) | Same |
| **"Create New Material"** | ✅ Present | ✅ Present (via `ItemCreateDrawer`) | Same |
| **AI Import "Undo" banner** | ✅ Present | ✅ Present | Same |

### 1.3 Table Column Structure

| Column | CreateQuotation | CreateProforma (Current) | Status |
|---|---|---|---|
| **Checkbox (multi-select)** | ✅ `col-check` with checkbox, `selectedItemIds` state | ❌ Missing | Not ported yet |
| **S.No (#)** | ✅ Draggable handle (`row-drag-handle`) with `draggable`, `onDragStart` | ❌ Static / Missing | Not ported yet |
| **HSN Code** | ✅ `col-hsn`, read-only from material | ✅ `col-hsn` | Same |
| **Description/Item** | ✅ `SearchableItemSelect` + `InlineDescriptionCell` | ✅ `SearchableItemSelect` | Same |
| **Make** | ✅ `MakeCell` popover picker | ❌ Missing | Not ported yet |
| **Variant** | ✅ `VariantCell` popover picker | ✅ `VariantCell` (local) | Same pattern |
| **Discount Category** | ✅ Display only, from material | ❌ Missing | Not ported yet |
| **Qty** | ✅ `qtyDrafts` pattern: string input, onBlur commits, only recalculates after complete typing | ❌ Direct `onChange` commit (recalculates on every keystroke) | Different behavior |
| **Unit** | ✅ Editable | ✅ Editable | Same |
| **Rate** | ✅ Number input | ✅ Number input | Same |
| **Discount %** | ✅ Number input; shows override indicator dot | ✅ Number input | Same |
| **Rate After Disc** | ✅ Computed, display only | ✅ Computed, display only | Same |
| **GST %** | ✅ Number input | ✅ Number input | Same |
| **Custom 1 / 2** | ✅ Conditional from templateSettings | ✅ Conditional from templateSettings | Same |
| **Amount** | ✅ Computed (qty × rate) | ✅ Computed (qty × rate_after_discount) | Slightly different formula |
| **Delete** | ✅ × button | ✅ × button | Same |
| **Move To (↑↓)** | ✅ `ArrowUpDown` button with popover dialog | ❌ Missing | Not ported yet |

### 1.4 Interactions & Behaviors

| Behavior | CreateQuotation | CreateProforma (Current) | Status |
|---|---|---|---|
| **Qty input** | String draft (`qtyDrafts`), validates `/^\d*\.?\d*$/`, commits on blur/Enter, Escape resets | Direct number input, commits on every keystroke | ❌ Different |
| **Drag & drop reorder** | ✅ `handleDragStart`, `handleDragOver`, `handleDropOnRow`, `handleDragEnd` on `<tr>` | ❌ Missing | Not ported yet |
| **Move To S.No** | ✅ `ArrowUpDown` button → popover with S.No input → `moveToSerialNo` | ❌ Missing | Not ported yet |
| **Row selection (checkbox)** | ✅ `selectedItemIds` state, select-all checkbox in header | ❌ Missing | Not ported yet |
| **Bulk actions** | ✅ Bulk delete, bulk set discount, bulk set make | ❌ Missing | Not ported yet |
| **Auto-add row on focus** | ✅ When focused on last row, adds new blank row | ❌ Missing | Not ported yet |
| **Hover actions** | ✅ Hover shows ×-to-clear button on item cell | ❌ Partially | Has ghost delete button |
| **Virtual scrolling** | ✅ `@tanstack/react-virtual` (`useVirtualizer`) | ❌ Standard table | Not ported yet |
| **Override tracking** | ✅ `is_override` flag, yellow dot indicator on discount cell | ❌ Missing | Not ported yet |
| **Section headers** | ✅ `is_header` rows (section dividers) | ❌ Missing | Not ported yet |
| **Subtotal rows** | ✅ `is_subtotal` rows with group calculations | ❌ Missing | Not ported yet |
| **Erection charges** | ✅ `erection` section with toggle + discount | ❌ Missing | Not ported yet |

### 1.5 Calculations

| Aspect | CreateQuotation | CreateProforma (Current) |
|---|---|---|
| **Amount formula** | `qty × rate` + `tax_amount = taxable × tax_percent / 100` → `line_total = taxable + tax_amount` | `qty × rate_after_discount` (no tax in amount) |
| **Subtotal** | Sum of `line_total` | Sum of `qty × rate_after_discount` |
| **GST** | `cgst/sgst/igst` derived from tax_total | Same |
| **Extra discount** | Separate `extra_discount_percent` + `extra_discount_amount` | `discountPercent` + `discountAmount` (same concept) |
| **Round off** | `round_off_enabled` toggle → `Math.round()` | `roundOff` boolean → `Math.round()` |
| **Amount in words** | `numberToWords()` | `numberToWords()` (same function) |
| **Calculation hook** | `useQuotationCalculations` (external hook) | Inline `calculateTotals()` + `useMemo` |

### 1.6 Features Not Yet Added to Proforma

| Priority | Feature | Why It Matters |
|---|---|---|
| 🔴 High | **Qty draft + blur commit** | Prevents amount flickering while typing qty — amount only recalculates after user finishes typing |
| 🔴 High | **Drag & drop reorder** | Users expect to drag rows to reorder; standard UX |
| 🔴 High | **Move To S.No** | Allows jumping a row to a specific position by number |
| 🔴 High | **Columns button + modal** | Lets users toggle visible columns + customize labels per template |
| 🟡 Medium | **Terms & Conditions drawer** | Required for professional documents; reuses existing `TermsConditionsDrawer` component |
| 🟡 Medium | **Zod validation** | Client-side validation before submit (date ranges, required fields) |
| 🟡 Medium | **Row selection (checkbox)** | Enables bulk operations; aligns with Quotation UX |
| 🟡 Medium | **Bulk delete / bulk set discount** | Power-user feature for editing multiple rows at once |
| 🟢 Low | **Virtual scrolling** | Performance for 50+ line items |
| 🟢 Low | **Section headers / subtotals** | For grouped line items with subtotal calculations |

---

## 2. Reusable Line Items Behavior Specification

Below is the **canonical specification** for line items behavior that all document editors should implement. This should be used as a checklist when refactoring: Invoice, Credit Note, Purchase Order, Debit Note, etc.

### 2.1 Shared State Variables

Each document editor should declare these state variables:

```typescript
// --- State shared across all document editors ---

// Item IDs for tracking
type ItemId = string | number;

// Items array — each item has at minimum:
// id, item_id, description, qty, rate, amount, discount_percent, tax_percent
const [items, setItems] = useState<LineItem[]>([]);

// Qty draft: string input that doesn't trigger recalculation until committed
const [qtyDrafts, setQtyDrafts] = useState<Record<string, string>>({});

// Drag & drop
const [draggingItemId, setDraggingItemId] = useState<ItemId | null>(null);

// Move To dialog
const [moveToDialog, setMoveToDialog] = useState<{
  open: boolean;
  itemId: ItemId | null;
  currentSNo: number;
  value: string;
  error: string;
} | null>(null);

// Row selection
const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

// Column customization
const [showCustomLabelEditor, setShowCustomLabelEditor] = useState(false);
const [templateSettings, setTemplateSettings] = useState<any>(null);

// Terms & Conditions
const [showTermsDrawer, setShowTermsDrawer] = useState(false);
const [termsText, setTermsText] = useState('');
```

### 2.2 Qty Input Pattern (Critical)

The qty input **MUST NOT** recalculate amounts on every keystroke. Use this pattern:

```typescript
// 1. Store draft string in qtyDrafts state
// 2. Only commit (parse + recalculate) on blur or Enter
// 3. Escape cancels the draft and reverts to original value

// Input value logic:
value={item.id in qtyDrafts ? qtyDrafts[item.id] : (item.qty === null ? '' : item.qty)}

// onChange — only update the draft string, validate number format:
onChange={(e) => {
  const raw = e.target.value;
  if (/^\d*\.?\d*$/.test(raw)) {
    setQtyDrafts((prev) => ({ ...prev, [item.id]: raw }));
  }
}}

// onBlur — commit the draft:
onBlur={() => commitQtyInput(item.id)}

// commitQtyInput function:
const commitQtyInput = (itemId: ItemId) => {
  setQtyDrafts((prev) => {
    if (!(itemId in prev)) return prev;
    const rawValue = prev[itemId].trim();
    const parsedQty = rawValue === '' ? 0 : Math.max(0, parseFloat(rawValue) || 0);
    updateItem(itemId, 'qty', parsedQty); // the updateItem triggers recalculation
    const next = { ...prev };
    delete next[itemId];
    return next;
  });
};

// onKeyDown:
onKeyDown={(e) => {
  if (e.key === 'Enter') commitQtyInput(item.id);
  if (e.key === 'Escape') resetQtyInput(item.id);
}}
```

### 2.3 Drag & Drop Pattern

```typescript
const handleDragStart = useCallback((e: React.DragEvent, itemId: ItemId) => {
  setDraggingItemId(itemId);
  e.dataTransfer.effectAllowed = 'move';
}, []);

const handleDragOver = useCallback((e: React.DragEvent) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}, []);

const handleDropOnRow = useCallback((e: React.DragEvent, targetId: ItemId) => {
  e.preventDefault();
  if (!draggingItemId || draggingItemId === targetId) return;
  setItems((prev) => {
    const fromIndex = prev.findIndex((r) => r.id === draggingItemId);
    const toIndex = prev.findIndex((r) => r.id === targetId);
    if (fromIndex < 0 || toIndex < 0) return prev;
    const updated = [...prev];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    return updated;
  });
  setDraggingItemId(null);
}, [draggingItemId]);

const handleDragEnd = useCallback(() => {
  setDraggingItemId(null);
}, []);

// On each <tr>:
<tr
  onDragOver={handleDragOver}
  onDrop={(e) => handleDropOnRow(e, item.id)}
  className={draggingItemId === item.id ? 'row-dragging' : ''}
>
  {/* S.No cell with drag handle */}
  <td 
    className="row-drag-handle"
    draggable
    onDragStart={(e) => handleDragStart(e, item.id)}
    onDragEnd={handleDragEnd}
  >
    {index + 1}
  </td>
</tr>
```

### 2.4 Move To Pattern

```typescript
const openMoveToDialog = useCallback((itemId: ItemId, currentSNo: number) => {
  setMoveToDialog({ open: true, itemId, currentSNo, value: '', error: '' });
}, []);

const confirmMoveTo = useCallback(() => {
  if (!moveToDialog || !moveToDialog.itemId) return;
  const targetSNo = parseInt(moveToDialog.value);
  if (isNaN(targetSNo) || targetSNo <= 0) {
    setMoveToDialog(prev => prev ? { ...prev, error: 'Enter a valid serial number' } : null);
    return;
  }
  const maxSNo = items.filter(i => !i.is_header && !i.is_subtotal).length;
  if (targetSNo > maxSNo) {
    setMoveToDialog(prev => prev ? { ...prev, error: `S.No cannot exceed ${maxSNo}` } : null);
    return;
  }
  moveToSerialNo(moveToDialog.itemId, targetSNo);
  setMoveToDialog(null);
}, [moveToDialog, items]);

const moveToSerialNo = useCallback((itemId: ItemId, targetSNo: number) => {
  setItems((prev) => {
    const fromIndex = prev.findIndex((item) => item.id === itemId);
    if (fromIndex < 0) return prev;
    let regularCount = 0;
    let targetIndex = -1;
    for (let i = 0; i < prev.length; i++) {
      if (prev[i].is_header || prev[i].is_subtotal) continue;
      regularCount++;
      if (regularCount === targetSNo) { targetIndex = i; break; }
    }
    const updated = [...prev];
    const [movedItem] = updated.splice(fromIndex, 1);
    const insertIndex = targetIndex >= 0 ? targetIndex : updated.length;
    updated.splice(insertIndex, 0, movedItem);
    return updated;
  });
}, []);

// Render: ArrowUpDown button per row + popover dialog
<button onClick={() => openMoveToDialog(item.id, sno)} title="Move to S.No">
  <ArrowUpDown size={12} />
</button>

// Popover (positioned above the button):
{moveToDialog?.itemId === item.id && (
  <div style={{ position: 'absolute', bottom: '100%', right: 0, /* ... */ }}>
    <div>Move above S.No:</div>
    <input type="number" value={moveToDialog.value} onChange={...} onKeyDown={...} />
    <button onClick={confirmMoveTo}>Go</button>
  </div>
)}
```

### 2.5 Columns Customization Pattern

```typescript
// Button in table header:
<button onClick={() => setShowCustomLabelEditor(true)}>
  <Plus size={12} /> Columns
</button>

// Modal with toggles for each column:
{showCustomLabelEditor && (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999, ... }}>
    <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', maxWidth: '420px', ... }}>
      <h3>Column Settings</h3>
      <p>Toggle columns to show/hide. Customize labels.</p>
      {columnConfigs.map(col => (
        <div key={col.key}>
          <input type="checkbox" checked={col.visible} onChange={...} />
          <span>{col.label}</span>
          <input type="text" value={col.customLabel} onChange={...} placeholder={col.defaultLabel} />
        </div>
      ))}
      <button onClick={() => setShowCustomLabelEditor(false)}>Done</button>
    </div>
  </div>
)}
```

### 2.6 Row Selection & Bulk Actions Pattern

```typescript
// Checkbox in header (select all):
<th className="col-check">
  <input
    type="checkbox"
    checked={items.filter(i => !i.is_header).every(item => selectedItemIds.includes(String(item.id)))}
    onChange={(e) => {
      if (e.target.checked) {
        setSelectedItemIds(items.filter(i => !i.is_header).map(item => String(item.id)));
      } else {
        setSelectedItemIds([]);
      }
    }}
  />
</th>

// Checkbox per row:
<td>
  <input
    type="checkbox"
    checked={selectedItemIds.includes(String(item.id))}
    onChange={(e) => {
      const id = String(item.id);
      if (e.target.checked) {
        setSelectedItemIds(prev => [...prev, id]);
      } else {
        setSelectedItemIds(prev => prev.filter(sid => sid !== id));
      }
    }}
  />
</td>
```

### 2.7 Client Search Pattern (Reusable)

```typescript
// State: use null (NOT empty string) to distinguish "not searching" from "searched and empty"
const [clientSearch, setClientSearch] = useState<string | null>(null);
const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);

// Input field:
<input
  value={clientSearch !== null ? clientSearch : (selectedClientName || '')}
  onChange={(e) => { setClientSearch(e.target.value); setIsClientDropdownOpen(true); }}
  onFocus={() => setIsClientDropdownOpen(true)}
  onBlur={() => { setTimeout(() => setClientSearch(null), 200); }}
/>

// On selecting a client from dropdown:
onClick={() => {
  setClientId(c.id);
  setIsClientDropdownOpen(false);
  setClientSearch(null); // ← null, not ''
}}
```

### 2.8 Standard Column Structure

Every document editor's line items table should support these columns (toggleable via templateSettings):

```
[#] [HSN] [Description] [Make] [Variant] [Disc.Cat] [Qty] [Unit] [Rate] [Disc%] [RateAfterDisc] [GST%] [Amount] [Actions]
```

**Fixed columns** (always present):
- Checkbox (for multi-select)
- S.No (#) — acts as drag handle
- Description/Item
- Qty
- Amount
- Delete button + Move To button

**Toggleable columns** (controlled by templateSettings):
- HSN Code
- Make
- Variant
- Discount Category
- Unit
- Rate
- Discount %
- Rate After Discount
- GST %
- Custom 1 / Custom 2

### 2.9 Priority Implementation Order for New Modules

When adding line items to a new module (Invoice, Credit Note, etc.), implement in this order:

1. **Items array + CRUD** — add/remove/edit items, amount calculation
2. **Qty draft pattern** — onBlur commit, no flickering
3. **Drag & drop reorder** — row dragging
4. **Move To S.No** — ArrowUpDown button + popover
5. **Columns button + modal** — column visibility + label customization
6. **Row selection + bulk actions** — checkboxes, bulk delete
7. **Terms & Conditions drawer** — reuse `TermsConditionsDrawer`
8. **Zod validation** — client-side schema validation
9. **Virtual scrolling** — performance for 50+ items (use `@tanstack/react-virtual`)
