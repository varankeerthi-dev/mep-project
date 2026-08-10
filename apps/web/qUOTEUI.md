# QuoteUI Design System — Unified Document Entry Forms

> **Source of truth for all document creation/editing screens.**
> Based on analysis of `CreateQuotation` and `CreateProforma` reference implementations.
> Every document creation page must follow this system unless explicitly overridden.

---

## 1. Design Philosophy

### Core Principles

1. **Dense data entry over marketing aesthetics.** ERP users enter hundreds of records daily. Every pixel must earn its space.
2. **Three-tier visual hierarchy.** The eye must flow: Section Title → Description → Primary Action → Data Grid.
3. **Consistent patterns, swappable labels.** The structure is identical across documents. Only labels, fields, and document-specific controls change.
4. **Inline over modal.** Edit where you see. Avoid popup fatigue.
5. **Blue is the only accent.** Primary actions, active states, and interactive highlights use blue (`#185FA5` / `#2563eb`). Red is reserved for destructive confirmation modals only.
6. **8px spacing grid.** All spacing snaps to `4, 8, 12, 16, 20, 24, 32` pixels. No orphan values.
7. **No unnecessary chrome.** Borders, shadows, and background tints are minimal. Whitespace does the grouping.

### What NOT to Do

- Do not make the UI look like a marketing website.
- Do not use excessive gradients, animations, or decorative effects.
- Do not assume a new pattern exists — check this document first.
- Do not introduce new tech, libraries, or patterns without asking.
- Do not change business logic, formulas, or data flow.

---

## 2. Unified Page Structure

Every document creation page follows this identical layout:

```
┌─────────────────────────────────────────────────────────────┐
│  FIXED TOP ACTION BAR                                        │
│  [Document Title]  [Status]  [Actions...]  [Save] [Cancel]  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  3-COLUMN HEADER CARDS                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │  Card 1   │  │  Card 2   │  │  Card 3   │                  │
│  │  Party    │  │ Document  │  │ Project/  │                  │
│  │  Details  │  │ Details   │  │ Pricing   │                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
│                                                              │
│  LINE ITEM EDITOR TABLE                                      │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Toolbar: [Add Row] [Add Material] [Add Section] ...   │ │
│  │  ┌───┬────┬─────┬──────┬─────┬──────┬───────┬────┐    │ │
│  │  │ # │Item│Make │Varian│ Qty │ Rate │Disc % │Amt │    │ │
│  │  ├───┼────┼─────┼──────┼─────┼──────┼───────┼────┤    │ │
│  │  │ 1 │... │ ... │ ...  │ ... │ ...  │ ...   │... │    │ │
│  │  └───┴────┴─────┴──────┴─────┴──────┴───────┴────┘    │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  BOTTOM PANELS (Notes, Terms, Adjustments, Signatory)        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │  Notes    │  │ Terms &  │  │Adjustments│                  │
│  │  & Remarks│  │Conditions│  │& Signatory│                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
│                                                              │
│  SUMMARY FOOTER (Subtotal, Tax, Discounts, Grand Total)     │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Fixed Top Action Bar

**Position:** `fixed` at top, below the app's main navbar (`top: 32px`).
**Background:** `white` with `border-b border-zinc-200`.
**Z-index:** 50.
**Height:** Auto (content-driven, ~48-56px).

### Layout

```
[Left: Title + Status Badge]  [Right: Action Buttons]
```

### Title

```tsx
fontSize: '16px' | '18px'
fontWeight: 700 | 'bold'
color: '#0a0a0a' | '#111827'
margin: 0
```

### Status Badge

Inline badge showing document status (Draft, Active, Final, etc.).
Placed immediately after the title.

### Action Buttons (Right Side)

Arranged horizontally with `gap: 6px`.

| Button | Style | When |
|---|---|---|
| **Import PDF/Image** | Indigo ghost: `bg-indigo-50 border-indigo-200 text-indigo-600` | Always (if supported) |
| **Preview PDF** | Icon button: `w-8 h-8 border border-zinc-300 rounded bg-white text-zinc-600` | Only when editing existing |
| **Download PDF** | Same icon button style | Only when editing existing |
| **Print** | Same icon button style | Only when editing existing |
| **Email** | Same icon button style | Only when editing existing |
| **Cancel** | Secondary: `border border-zinc-300 bg-white text-zinc-600 text-xs font-bold px-10 h-9 rounded` | Always |
| **Save as Draft** | Secondary: same style as Cancel | Always |
| **Save / Update** | Primary: `bg-[#185FA5] border-[#185FA5] text-white text-xs font-bold px-10 h-9 rounded` | Always |

### Icon Button Pattern

All icon buttons in the action bar share this geometry:

```tsx
{
  width: '32px',
  height: '32px',
  border: '1px solid #d4d4d4',
  borderRadius: '4px',
  background: '#fff',
  color: '#525252',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}
// hover: color → '#111827'
// disabled: opacity 0.5, cursor 'not-allowed'
```

---

## 4. 3-Column Header Cards

**Grid:** `grid-template-columns: repeat(3, 1fr)` with `gap: 16px`.
**Margin bottom:** `16px`.
**Each card:** `cq-card-elevated` class or equivalent white card.

### Card Structure

```tsx
<div className="cq-card-elevated" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
  {/* Card Header */}
  <div style={{
    display: 'flex', alignItems: 'center', gap: '8px',
    fontSize: '12px', fontWeight: 700,
    color: '#1e3a8a',           // dark blue
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid #f3f4f6',
    paddingBottom: '8px',
    marginBottom: '4px'
  }}>
    <Icon size={14} style={{ color: '#2563eb' }} />
    {Card Title}
  </div>

  {/* Field Rows */}
  {renderHeaderField('Label:', <input ... />)}
</div>
```

### Card 1 — Party Details

**Icon:** `User` from lucide-react.
**Title:** "Client" (or "Vendor" for purchase orders).

| Field | Type | Required |
|---|---|---|
| Client * | Searchable dropdown | Yes |
| Contact | Text input | No |
| Address | Read-only div (auto-populated) | Auto |
| Shipping | Select + textarea (if client has addresses) | No |
| GSTIN | Text input (auto-populated) | Auto |
| Default variant | Select | No |

### Card 2 — Document Details

**Icon:** `FileText` from lucide-react.
**Title:** "Document".

| Field | Type | Required |
|---|---|---|
| Doc No | Read-only div (auto-generating) | Auto |
| Date | Custom date picker | Yes |
| Valid Till / Due Date | Custom date picker (document-specific) | Depends |
| Prepared By | Read-only div | Auto |
| Reference | Text input | No |
| Payment Terms | Text input | No |

### Card 3 — Project / Pricing Details

**Icon:** `Briefcase` from lucide-react.
**Title:** "Project" (or document-specific).

| Field | Type | Notes |
|---|---|---|
| Project | Select (filtered by client) | No |
| Pricing | ARC toggle + status badge | Quotation/Invoice only |
| Discount Categories | List with % inputs | Quotation/Invoice only |

**If a document type doesn't need one of these cards, replace with the closest equivalent rather than removing the column.** The 3-column grid must stay balanced.

---

## 5. Form Field Row Pattern

### Document Section Pattern

```tsx
const headerFieldStyle = { display: 'flex', alignItems: 'center', gap: '8px' };
const labelColStyle = { minWidth: '95px', maxWidth: '95px', fontWeight: 600, fontSize: '11px', color: '#374151' };
const fieldColStyle = { flex: 1 };
const inputStyle = { minHeight: '36px', padding: '4px 8px', fontSize: '12px' };

const renderHeaderField = (label, field, hasMargin = true) => (
  <div style={{ ...headerFieldStyle, marginBottom: hasMargin ? '8px' : '0' }}>
    <span style={labelColStyle}>{label}</span>
    <div style={fieldColStyle}>{field}</div>
  </div>
);
```

### Label Width Variants

- **70px** — Compact forms with short labels (CreateQuotation minimal mode)
- **90-95px** — Standard forms (CreateQuotation, CreateDC, Proforma)
- **120px** — Forms with longer labels (Purchase Orders)

Pick based on the longest label in the card.

### Spacing Between Fields

- **8px** vertical gap between field rows.
- Fields stack vertically within a card column.

---

## 6. Custom Date Picker

**Shared component** used across all document screens. Reuse the existing `CustomDatePicker` from `QuotationHeaderForm.tsx`.

### Behavior

- Display selected dates as `dd MMM yyyy`.
- Save values as `yyyy-MM-dd`.
- Open compact calendar popover on click.
- Support previous/next month navigation.
- Close on outside click.
- Use `.cq-datepicker-input` class for trigger styling.
- Disabled documents should prevent opening the picker.

### Visual Tokens

```tsx
{
  position: 'absolute', top: '100%', left: 0,
  marginTop: '4px', zIndex: 100,
  background: 'white',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
  padding: '12px',
  width: '250px'
}
```

### Trigger Input

```tsx
{
  minHeight: '36px', padding: '4px 8px', fontSize: '12px',
  background: 'white', border: '1px solid #d1d5db', borderRadius: '4px',
  cursor: 'pointer', display: 'flex', alignItems: 'center'
}
```

---

## 7. Searchable Dropdowns

**Replace native `<select>`** with searchable text input + dropdown for any list exceeding 5 items.

### Used For

- Client/party selection (all document headers)
- Material/item selection (line item grid)

### Client/Party Dropdown Behavior

- Text input shows selected party name when closed.
- Typing filters dropdown case-insensitively.
- Clicking/focusing opens the dropdown.
- Selecting a party updates dependent fields (address, contact, shipping, GSTIN).
- Outside click closes the dropdown.
- Empty states show `No clients found` (or matching party label).

### Container Class

`.client-dropdown-container` for click-outside detection.

### Dropdown Visual Tokens

```tsx
{
  position: 'absolute', top: '100%', left: 0, right: 0,
  zIndex: 50, background: 'white',
  border: '1px solid #d1d5db',
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
  maxHeight: '200px', overflowY: 'auto'
}

// Item:
{ padding: '6px 12px', cursor: 'pointer', fontSize: '12px', borderBottom: '1px solid #f3f4f6' }
// hover: background → '#eff6ff'
```

### Item/Material Dropdown (Line Items)

Use `SearchableItemSelect` component with fixed-position rendering to avoid clipping by table containers.

---

## 8. Line Item Editor Table

### Container

```tsx
<div className="bg-white rounded-none border border-zinc-200 shadow-sm mb-6 mt-8">
  <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100 bg-zinc-50/50">
    {/* Title + Toolbar */}
  </div>
  <div className="grid-table-container">
    <table className="grid-table cq-editable">
      <thead className="grid-table-header-dark">
        {/* Columns */}
      </thead>
    </table>
  </div>
</div>
```

### Toolbar

Located above the table header. Contains:

| Action | Style | Notes |
|---|---|---|
| Add Row | Ghost button (icon + text) | Adds empty row |
| Add Material | Ghost button | Opens material picker |
| Add Section | Ghost button | Adds section header row |
| Add Subtotal | Ghost button | Adds subtotal row |
| Bulk Add | Ghost button | Opens bulk picker |
| Column Visibility | Dropdown | Toggle columns on/off |
| AI Import | Indigo ghost | Opens parser modal |

### Table Header

```tsx
// Dark header row
thead.className = "grid-table-header-dark"

// Background: '#1e3a8a' (dark blue)
// Text: white, fontSize '11px', fontWeight 700
// Uppercase labels
```

### Standard Columns

| Column | Width | Type | Notes |
|---|---|---|---|
| ☐ | checkbox | Checkbox | Bulk select |
| # | auto | Static | Serial number / drag handle |
| HSN | 80px | Read-only input | Auto from material |
| Item | flexible | SearchableItemSelect | + InlineDescriptionCell below |
| Make | 100px | MakeCell dropdown | |
| Variant | 120px | VariantCell dropdown | |
| Discount Category | auto | Static text | |
| Qty | 80px | Editable input | Draft pattern for safe editing |
| Unit | 80px | UnitDropdownSelect | |
| Rate | 100px | Editable input | |
| Disc % | 70px | Editable input | |
| Rate After Disc | auto | Read-only | Calculated |
| GST % | 70px | Editable input | |
| Amount | auto | Read-only | Calculated |
| Actions | 40px | Delete button | |

### Cell Styling

```tsx
// Editable cell:
{ padding: '4px 8px', fontSize: '11px', minHeight: '28px', background: '#fff', border: '1px solid transparent' }
// hover: borderColor → '#3b82f6'

// Read-only cell:
{ padding: '4px 8px', fontSize: '11px', background: '#f8fafc' }

// Item description (below item select):
{ fontSize: '11px', color: '#737373' | '#64748b' }
```

### Special Row Types

| Row Type | Background | Behavior |
|---|---|---|
| **Section Header** | `#f8fafc` | Full-width editable text input, bold |
| **Subtotal** | `#fef9c3` (yellow tint) | Label + group amount, `borderTop: '2px solid #eab308'` |
| **Material** | White | Standard editable row |
| **Erection** | White | Material-linked service row |

### Drag & Drop

- Each row has a drag handle (`#` column).
- `draggable` + `onDragStart/Over/Drop/End` handlers.
- Visual feedback: `.row-dragging` class.

### Empty State

```tsx
<td colSpan={N} style={{ padding: '48px', color: '#94a3b8', fontSize: '14px', textAlign: 'center' }}>
  No items added. Click "Add Row" or "Add Material".
</td>
```

---

## 9. Searchable Item Select (Line Items)

**Component:** `SearchableItemSelect` (already exists in codebase).

### Behavior

- Input shows selected material name when closed.
- Typing filters materials by name, code, or display name.
- Dropdown renders with `position: fixed` to avoid clipping.
- Selecting updates the row with material details (HSN, UOM, rate, tax, variant info).
- Clear button (×) appears on hover, allowing replacement.

### Dropdown Positioning

```tsx
// Fixed positioning to escape table container
{
  position: 'fixed',
  top: `${rect.bottom + 4}px`,
  left: `${rect.left}px`,
  width: `${rect.width}px`,
  zIndex: 9999,
  background: '#fff',
  border: '1px solid #d4d4d4',
  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  maxHeight: '200px',
  overflowY: 'auto'
}
```

---

## 10. Bottom Panels & Footer

### Grid Layout

```tsx
<div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_300px] gap-4">
  {/* Column 1: Notes & Remarks */}
  {/* Column 2: Terms & Conditions */}
  {/* Column 3: Adjustments & Signatory */}
</div>
```

### Column 1 — Notes & Remarks

- Auto-growing `textarea` to avoid scrollbars.
- Header: `13px font-semibold text-[#374151]`.
- Textarea: `13px` font.

### Column 2 — Terms & Conditions

- "Add/Edit" button opening `TermsConditionsDrawer`.
- Auto-growing `textarea` displaying plain text.
- Same styling as Notes.

### Column 3 — Adjustments & Signatory

- Fixed `300px` width.
- Numerical adjustment inputs (Extra Discount %, Extra Discount Amt, Round Off toggle).
- Grand Total: `15px font-semibold`.
- **Authorized Signatory** picker — dropdown opens **upwards** (`position: absolute, bottom: '100%'`).
- Signature preview card: `max-h-7 max-w-[120px] object-contain`.

---

## 11. Summary Footer

Below the bottom panels, showing calculated totals.

| Row | Font Size | Weight | Color |
|---|---|---|---|
| Subtotals | 13px | normal | #374151 |
| Taxes (CGST/SGST/IGST) | 13px | normal | #374151 |
| Discounts | 13px | normal | #374151 |
| **Grand Total** | **15px** | **700** | **#111827** |
| Amount in Words | 12px | 600, italic | #374151 |

---

## 12. Typography & Font Sizes

| Element | Size | Weight | Color | Notes |
|---|---|---|---|---|
| Page Title | 16-18px | 700 | #0a0a0a / #111827 | Action bar |
| Card Header | 12px | 700 | #1e3a8a | Uppercase, 0.05em tracking |
| Section Header | 11px | 600 | #6b7280 | Uppercase, 0.05em tracking |
| Metadata Label | 11px | 600 | #374151 | Right-aligned in field row |
| Metadata Input | 12px | 400 | #1f2937 | Compact, 36px height |
| Table Header | 11px | 700 | white on #1e3a8a | Uppercase |
| Line Item Cell | 11-12px | 400 | #1e293b | Editable |
| Description (below item) | 11px | 400 | #737373 / #64748b | Muted |
| Make/Variant Cell | 11px | 500 | #0f172a (set) / #94a3b8 (unset) | |
| Qty/UOM/Rate Input | 12px | 400 | #1f2937 | |
| Section Header Row | 12px | 700 | #1e293b | Uppercase |
| Subtotal Row | 13px | 700 | #b45309 | |
| Bottom Panel Header | 13px | 600 | #374151 | |
| Textarea | 13px | 400 | #1f2937 | |
| Grand Total | 15px | 700 | #111827 | |
| Amount in Words | 12px | 600, italic | #374151 | |
| Helper/Signatory Label | 9-10px | uppercase | #a1a1aa | Tracked |

---

## 13. Button System

### Primary (Save / Confirm)

```tsx
{
  height: '36px',
  padding: '0 40px',
  minWidth: '100px',
  background: '#185FA5',
  border: '1px solid #185FA5',
  color: '#fff',
  borderRadius: '6px',
  fontSize: '12px',
  fontWeight: 500,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer',
  transition: 'all 0.15s'
}
// hover: background → '#0C447C', borderColor → '#0C447C'
// disabled: opacity 0.6, cursor 'not-allowed'
```

### Secondary (Cancel / Close)

```tsx
{
  height: '36px',
  padding: '0 40px',
  minWidth: '100px',
  border: '1px solid #d4d4d4',
  background: '#fff',
  color: '#374151',
  borderRadius: '6px',
  fontSize: '12px',
  fontWeight: 500
}
// hover: background → '#f3f4f6', color → '#111827'
```

### Ghost (Toolbar Actions)

```tsx
{
  padding: '6px 12px',
  border: '1px solid transparent',
  background: 'transparent',
  color: '#374151',
  borderRadius: '6px',
  fontSize: '12px',
  fontWeight: 500,
  display: 'flex', alignItems: 'center', gap: '4px'
}
// hover: background → '#f3f4f6'
```

### Destructive (Delete in Headers)

**Icon and text are BLACK (neutral).** The danger signal comes from the confirmation modal, not the button color.

```tsx
{
  padding: '6px 12px',
  border: '1px solid #d1d5db',
  background: '#fff',
  color: '#000000',
  borderRadius: '6px',
  fontSize: '12px',
  fontWeight: 500
}
// hover: background → '#f3f4f6', borderColor → '#9ca3af'
// Icon: Trash2, 13px
```

---

## 14. Confirmation Modal (Destructive Actions)

The only place that uses **red** for danger:

| Element | Token |
|---|---|
| Backdrop | `bg-black/40` |
| Card | `bg-white rounded-2xl p-6 max-w-[420px] shadow-2xl` |
| Icon badge | `w-10 h-10 rounded-xl bg-rose-50` |
| Icon | `Trash2 w-5 h-5 text-rose-600` |
| Title | `text-[15px] font-semibold text-zinc-900` |
| Title ↔ body gap | `12px` |
| Body ↔ buttons gap | `20px` |
| Cancel button | White, `border-zinc-200 text-zinc-600 rounded-lg` |
| Confirm button | `bg-rose-600 text-white rounded-lg font-semibold`, hover `bg-rose-700` |
| Button height | `h-9` (36px) |

---

## 15. Swappable Document Labels

The structure is identical. Only labels change:

| Document Type | Card 1 Title | Card 2 Doc No Label | Card 2 Date Label | Card 2 Extra Date | Card 3 Title |
|---|---|---|---|---|---|
| **Quotation** | Client | Quote No | Date | Valid Till | Project |
| **Proforma** | Client | Proforma No | Date | Valid Till | Project |
| **Invoice** | Client | Invoice No | Invoice Date | Due Date | Project |
| **DC** | Client | DC No | DC Date | — | Project |
| **Credit Note** | Client | CN No | CN Date | — | Project |
| **Debit Note** | Vendor | DN No | DN Date | — | — |
| **Purchase Order** | Vendor | PO No | PO Date | Delivery Date | Project |
| **Work Order** | Vendor/Sub | WO No | WO Date | Due Date | Project |
| **Sales Order** | Client | SO No | SO Date | Delivery Date | Project |

---

## 16. Document-Specific Overrides

### Quotation

- May use **negotiation mode** (tracks override flags on discount/rate changes).
- May use **revision history** tied to quote editing.
- May use **ARC pricing** toggle.
- May use **DC allocation** when converting from multiple DCs.
- May use **erection charges** section.
- May use **discount categories** with header-level % inputs.

### Proforma

- Reuses quotation-style header and item grid.
- Relabels document metadata to proforma terms.
- Uses `ProformaItemsEditor` with drag-and-drop.
- May use **ARC pricing**.

### Invoice

- May use **payment status**, **due date**, **tax/invoice-specific fields**.
- Supports **multiple source types** (direct, quotation, challan, PO).
- May use **revision management** (revision_no, revision_history).
- May use **ARC pricing**.
- May use **lot mode** (single-item invoice for PO billing).
- May use **PO line item selection** (POLineItemsSelector).
- May use **quotation/proforma line item selection**.
- Uses **react-hook-form** with `useFieldArray`.

### Delivery Challan (DC)

- May use **dispatch and transport details** (vehicle number, driver, e-way bill).
- May use **warehouse selection** and **stock tracking**.
- May use **rate source** selector (base/project/ARC/manual).
- May use **allow insufficient stock** toggle.
- Should **not** show quotation-specific pricing rules unless required.
- Uses **manual state management** (not react-hook-form).

### Credit Note

- May use **adjustment reason**, **reversal values**, and **reference-to-original-doc** fields.
- May use **stock adjustment** for returned items.
- Should **not** show quotation-only conversion helpers unless needed.
- Uses **react-hook-form**.

### Debit Note

- May use **adjustment reason**, **surcharge values**, and **reference-to-original-doc** fields.
- Party card changes from "Client" to "Vendor".

### Purchase Order

- Party card changes from "Client" to **"Vendor"**.
- May use **PO-specific approval** and **delivery fields**.
- May use **delivery schedule**.
- Uses the Purchase module's existing patterns.

### Work Order (Subcontractor)

- Party card shows **Subcontractor/Vendor**.
- May use **work scope**, **milestone tracking**, **amendment support**.
- Uses `SubcontractorWorkOrderCreate` patterns.

### Sales Order

- Party card shows **Client**.
- May use **MRP requirements**, **stock check panel**.
- Uses `SalesOrderCreate` patterns.

---

## 17. Do Not Copy Blindly

Do **NOT** copy quotation-only controls into another document type unless explicitly required:

- Negotiation mode
- Revision history tied to quote editing
- Quotation-specific approval hooks
- DC allocation inside quotation creation
- ARC pricing toggle (only if target document supports it)
- Erection charges (quotation-specific)
- Discount categories with header-level inputs (quotation/invoice specific)

---

## 18. Reuse Rule

This document is the source of truth when:

1. **Creating a new document type** — follow this structure exactly.
2. **Refactoring an existing page** — align to this system.
3. **Cloning a UI for a new document** — swap labels per §15, keep structure identical.

If a future screen says "follow `quoteui`," it should:

- Reuse the same visual composition.
- Swap labels and document-specific fields.
- Keep the same compact editing style.
- Remove quotation-only behavior that doesn't belong.

---

## 19. Shared Component APIs (document-editor module)

All shared components live in `src/components/document-editor/`.

### DocumentActionBar

```tsx
import { DocumentActionBar, PrimaryButton, SecondaryButton, GhostButton, ImportButton } from '../document-editor';

<DocumentActionBar
  title="Create Invoice"
  subtitle="Auto-generating..."
  statusBadge={<StatusBadge status="draft" />}
  fixed={{ top: 32, left: 220 }}  // fixed to viewport
  isDirty={isDirty}
  leftActions={<ImportButton onClick={openParser} />}
  rightActions={
    <>
      <SecondaryButton onClick={onCancel}>Cancel</SecondaryButton>
      <SecondaryButton onClick={onSaveDraft}>Save as Draft</SecondaryButton>
      <PrimaryButton onClick={onSave}>Save</PrimaryButton>
    </>
  }
/>
```

### HeaderFormGrid + HeaderCard + HeaderField

```tsx
import { HeaderFormGrid, HeaderCard, HeaderField, sharedStyles } from '../document-editor';

<HeaderFormGrid columns={3}>
  {/* Column 1: Party */}
  <HeaderCard icon={<User size={14} style={{ color: '#2563eb' }} />} title="Client">
    <HeaderField label="Client" required labelWidth="95px">
      <SearchableDropdown ... />
    </HeaderField>
    <HeaderField label="Contact">
      <input className="form-input" style={sharedStyles.inputStyle} />
    </HeaderField>
    <HeaderField label="Address" last>
      <div style={sharedStyles.staticMultilineStyle}>{address}</div>
    </HeaderField>
  </HeaderCard>

  {/* Column 2: Document */}
  <HeaderCard icon={<FileText size={14} style={{ color: '#2563eb' }} />} title="Document">
    <HeaderField label="Invoice No">
      <div style={sharedStyles.staticFieldStyle}>{invoiceNo}</div>
    </HeaderField>
    <HeaderField label="Date">
      <CustomDatePicker value={date} onChange={setDate} inputStyle={sharedStyles.inputStyle} />
    </HeaderField>
  </HeaderCard>

  {/* Column 3: Project */}
  <HeaderCard icon={<Briefcase size={14} style={{ color: '#2563eb' }} />} title="Project">
    <HeaderField label="Project">
      <select className="form-select" style={sharedStyles.inputStyle}>...</select>
    </HeaderField>
  </HeaderCard>
</HeaderFormGrid>
```

### CustomDatePicker

```tsx
import { CustomDatePicker } from '../document-editor';

<CustomDatePicker
  value={formData.date}
  onChange={(val) => setFormData({ ...formData, date: val })}
  inputStyle={sharedStyles.inputStyle}
  minDate={formData.date}  // optional: prevent selecting before this date
  disabled={isLocked}      // optional: disable the picker
/>
```

### SummaryFooter

```tsx
import { SummaryFooter } from '../document-editor';

<SummaryFooter
  rows={[
    { label: 'Subtotal', value: subtotal },
    { label: 'CGST (9%)', value: cgst, indent: true },
    { label: 'SGST (9%)', value: sgst, indent: true },
    { label: 'Discount', value: -discount, highlight: true },
  ]}
  grandTotal={{ label: 'Grand Total', amount: grandTotal }}
  amountInWords="Rupees Fifty Thousand Only"
/>
```

### Key Files Reference

| Pattern | File |
|---|---|
| Shared components | `src/components/document-editor/` |
| Action bar + buttons | `document-editor/DocumentActionBar.tsx` |
| Header card grid | `document-editor/HeaderFormGrid.tsx` |
| Header card | `document-editor/HeaderCard.tsx` |
| Field row | `document-editor/HeaderField.tsx` |
| Date picker | `document-editor/CustomDatePicker.tsx` |
| Summary footer | `document-editor/SummaryFooter.tsx` |
| Searchable item select | `components/SearchableItemSelect.tsx` |
| Inline description | `components/InlineDescriptionCell.tsx` |
| Unit dropdown | `components/UnitDropdownSelect.tsx` |
| Terms drawer | `components/TermsConditionsDrawer.tsx` |
| Confirmation dialog | `components/ConfirmDialog.tsx` |
| Document status badge | `components/DocumentStatusBadge.tsx` |

---

## 20. Template Contract (Clone Checklist)

When creating a new document page from this system:

- [ ] Fixed top action bar with title + status + actions
- [ ] 3-column header card grid (Client/Vendor, Document, Project/Pricing)
- [ ] Each card has icon + uppercase header + field rows
- [ ] Searchable client/vendor dropdown
- [ ] Custom date picker for document dates
- [ ] Auto-generating document number
- [ ] Line item editor table with toolbar
- [ ] Add Row / Add Material / Add Section buttons
- [ ] Drag-and-drop row reordering
- [ ] Inline editing for all fields
- [ ] SearchableItemSelect for material selection
- [ ] Bottom panels (Notes, Terms, Adjustments)
- [ ] Summary footer with totals
- [ ] Save as Draft + Save (Primary) + Cancel buttons
- [ ] Empty state messaging
- [ ] Document-specific controls only (no cross-document pollution)
