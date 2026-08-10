# Entry Form Design System

> **Handoff Document** — Copy-paste ready. If you're a junior designer or developer reading this, every value here is what the code actually uses. Don't guess — use these exact tokens.

---

## 1. What Was The CSS Override Issue?

### The Problem
When we set Tailwind padding classes like `py-4` or `py-[16px]` on `<td>` and `<th>` elements inside the Client Mapping table, **the styles didn't apply**. The rows stayed cramped.

### Why It Happened
The project has a global CSS reset in `index.css`:

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  border-radius: 0 !important;
}
```

And global table rules:

```css
.table th,
.table td {
  padding: 12px 16px !important;
  /* ... */
}
```

Even though the Client tables don't use the `.table` class, **other CSS layers** (Tailwind's preflight, shadcn base styles, and the `*` reset) can interfere with how Tailwind utility classes resolve on `<table>` elements. The `<table>` element has special browser defaults for `border-collapse`, `padding`, and `line-height` that Tailwind's preflight tries to normalize — but sometimes the cascade wins.

### The Fix
**Use inline `style` props for table cell padding.** Inline styles have the highest specificity (after `!important`) and bypass all CSS class conflicts:

```tsx
// ❌ Doesn't always work — Tailwind classes can be overridden
<td className="px-4 py-[16px]">

// ✅ Always works — inline style wins over classes
<td className="px-4" style={{ padding: '16px 16px' }}>
```

**Rule of thumb:** For `<table>`, `<th>`, `<td>` padding/height in this project, always use `style` props. For everything else (inputs, buttons, cards), Tailwind classes work fine.

---

## 2. Color Palette

| Token | Hex | Usage |
|---|---|---|
| **Primary (Indigo)** | `#6366F1` | Focus rings, active states, primary buttons |
| **Primary Dark** | `#4F46E5` | Hover state for primary buttons, active tab text |
| **Primary Darkest** | `#4338CA` | Active/pressed state for primary buttons |
| **Danger Red** | `#EF4444` | "Add Row" / "Add Vendor" action links, delete hover |
| **Danger Dark** | `#DC2626` | Hover state for red action links |
| **Text Primary** | `#111827` | Main text, titles, input values |
| **Text Secondary** | `#374151` | Labels (`font-semibold`) |
| **Text Muted** | `#6B7280` | Descriptions, placeholders, helper text, table headers |
| **Text Disabled** | `#94A3B8` | Disabled input text |
| **Border Default** | `#DCE3ED` | Input/select borders (resting) |
| **Border Hover** | `#C7D2FE` | Input/select borders (hover) |
| **Border Focus** | `#6366F1` | Input/select borders (focus) |
| **Border Section** | `#E7EAF1` | Section card borders, table borders |
| **Border Table Row** | `#F1F5F9` | Table row dividers |
| **Background White** | `#FFFFFF` | Cards, inputs, table cells |
| **Background Subtle** | `#F8FAFC` | Table header rows, tab bar background |
| **Background Hover** | `#FAFBFC` | Section header hover |
| **Shadow Default** | `rgba(15,23,42,0.04)` | Section card resting shadow |
| **Shadow Hover** | `rgba(15,23,42,0.06)` | Section card hover shadow |
| **Focus Ring** | `rgba(99,102,241,0.10)` | 4px focus ring around inputs |

---

## 3. Typography

| Element | Size | Weight | Color | Font |
|---|---|---|---|---|
| **Section Title** | `18px` (`text-lg`) | `600` (semibold) | `#111827` | Inter |
| **Section Description** | `13px` | `400` (regular) | `#6B7280` | Inter |
| **Badge (e.g. "Required")** | `10px` | `600` (semibold) | `#6B7280` | Inter |
| **Field Label** | `13px` | `600` (semibold) | `#374151` | Inter |
| **Input Text** | `13px` (compact) / `14px` (default) | `500` (medium) | `#111827` | Inter |
| **Placeholder** | Same as input | `400` (regular) | `#9CA3AF` | Inter |
| **Table Header** | `11px` | `600` (semibold) | `#6B7280` | Inter |
| **Table Body** | `12px` (`text-xs`) | `400` (regular) | `#111827` | Inter |
| **Helper/Muted Text** | `11px` | `400` (regular) | `#6B7280` | Inter |
| **Action Link ("Add Row")** | `13px` | `600` (semibold) | `#EF4444` (red) | Inter |
| **Tab Button** | `15px` | `500` (medium) | `#6B7280` (inactive) / `#4F46E5` (active) | Inter |

---

## 4. Spacing & Layout

### Section Cards (EditorSection)
```
┌─────────────────────────────────────────────┐
│  ← 32px →  Title  [Badge] [Add Row]  ← 32px → │  ← Header: pt-6 (24px), px-8 (32px)
│  ← 32px →  Description text           ← 32px → │  ← mt-1 (4px)
│─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│
│  ← 32px →                             ← 32px → │  ← Content: px-8 (32px), py-6 (24px)
│           [Form Content Here]                 │
│  ← 32px →                             ← 32px → │
└─────────────────────────────────────────────┘
  ↑ 1px border: #E7EAF1
  ↑ Border radius: 16px (rounded-2xl)
  ↑ Shadow: 0 2px 10px rgba(15,23,42,0.04)
  ↑ Hover: scale 1.012, shadow lifts
```

### Grid Layout (Two-Column Sections)
```tsx
<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
  <SectionA />
  <SectionB />
</div>
```
- **Gap:** 24px (`gap-6`)
- **Breakpoint:** Two columns at `lg` (1024px+)
- **Single column** on mobile/tablet

### Vendor Mapping Row Cards
```
┌──────────────────────────────────────┐
│  Vendor Mapping              [🗑️]   │  ← Header: flex justify-between
│                                      │
│  Variant    [Select ▼]              │  ← Grid: 140px label + 400px field
│  Make       [Input    ]              │
│  Vendor     [Select ▼]              │
│  Base Rate  [Input    ]              │
│  Discount % [Input    ]              │
│  Preferred  [☐] Set as preferred     │
└──────────────────────────────────────┘
  ↑ Border: 1px #E7EAF1
  ↑ Border radius: 12px (rounded-xl)
  ↑ Background: white
  ↑ Padding: 16px (p-4)
  ↑ Gap between rows: 12px (gap-y-3)
  ↑ Gap between label-field: 16px (gap-x-4)
```

---

## 5. Form Inputs

### Standard Input (Full-Size)
```
Height:     46px
Radius:     10px
Border:     1px #DCE3ED
Padding:    0 16px (horizontal)
Font:       14px, weight 500
Background: white
```

**States:**
| State | Border | Shadow | Background |
|---|---|---|---|
| Resting | `#DCE3ED` | none | `white` |
| Hover | `#C7D2FE` | none | `white` |
| Focus | `#6366F1` | `0 0 0 4px rgba(99,102,241,0.10)` | `white` |
| Disabled | `#DCE3ED` | none | `#F8FAFC` |

### Compact Input (Table/Small — `inputFieldSm`)
```
Height:     36px (h-9)
Radius:     8px (rounded-lg)
Border:     1px #DCE3ED
Padding:    0 12px (horizontal)
Font:       13px, weight 500
Background: white
```

Same state transitions as standard input.

### Select Dropdown
- Same dimensions as the input variant it matches (standard or compact)
- Native `<select>` with `appearance-none`
- Custom chevron icon: `<ChevronDown size={14}>` positioned `absolute right-3 top-1/2 -translate-y-1/2`
- Chevron color: `#6B7280`

### Vendor Mapping Fields
```
Grid:       grid-cols-[140px_400px]
Label:      12px, weight 400, color #6B7280
Field:      Uses inputFieldSm / selectFieldSm (compact variants)
Max width:  400px per field
```

---

## 6. Buttons

### Primary Button
```
Height:     44px (h-11)
Radius:     10px
Background: #6366F1
Text:       14px, weight 500, white
Padding:    0 22px
Shadow:     0 8px 18px rgba(79,70,229,0.18)
```
| State | Background |
|---|---|
| Resting | `#6366F1` |
| Hover | `#4F46E5` |
| Active | `#4338CA` |

### Secondary Button
```
Height:     44px (h-11)
Radius:     10px
Background: white
Border:     1px #D1D5DB
Text:       14px, weight 500, #111827
Padding:    0 22px
```
| State | Background |
|---|---|
| Resting | `white` |
| Hover | `#F9FAFB` |

### Action Link ("Add Row" / "Add Vendor")
```
Font:       13px, weight 600 (semibold)
Color:      #EF4444 (red)
Icon:       Plus (size 14)
Gap:        6px between icon and text
Position:   Next to section title (via headerActions prop)
```
| State | Color |
|---|---|
| Resting | `#EF4444` |
| Hover | `#DC2626` |

### Delete Button (Table Row)
```
Size:       24x24px (p-1.5)
Radius:     8px (rounded-lg)
Color:      #6B7280
Icon:       Trash2 (size 12x12)
```
| State | Background | Color |
|---|---|---|
| Resting | transparent | `#6B7280` |
| Hover | `rgba(239,68,68,0.10)` | `#EF4444` |

---

## 7. Tables

### Table Container
```
Border:     1px #E7EAF1
Radius:     12px (rounded-xl)
Background: white
Overflow:   horizontal scroll on mobile
```

### Table Header Row (`<thead > <tr>`)
```
Background: #F8FAFC
Border-bottom: 1px #F1F5F9
```

### Table Header Cell (`<th>`)
```
Padding:    16px 16px (inline style — NOT Tailwind class!)
Font:       11px, weight 600 (semibold)
Transform:  uppercase
Letter-spacing: 0.05em (tracking-wide)
Color:      #6B7280
Text-align: left
```

### Table Body Cell (`<td>`)
```
Padding:    16px 16px (inline style — NOT Tailwind class!)
Font:       12px (text-xs)
Border-bottom: 1px #F1F5F9
```

### Table Row (`<tr>` in tbody)
```
Border-bottom: 1px #F1F5F9 (except last row)
```
| State | Background |
|---|---|
| Resting | transparent |
| Hover | `rgba(248,250,252,0.6)` |

### ⚠️ Critical: Table Cell Padding
**Always use inline `style` for `<th>` and `<td>` padding in this project.**

```tsx
// ✅ Correct
const thStyle: React.CSSProperties = { padding: '16px 16px' };
const tdStyle: React.CSSProperties = { padding: '16px 16px' };

<th style={thStyle}>Header</th>
<td style={tdStyle}>Content</td>

// ❌ May not work — Tailwind classes can be overridden by global CSS
<th className="py-[16px]">Header</th>
```

---

## 8. Tab Bars (Sub-Navigation)

### Tab Container
```
Display:    inline-flex
Gap:        4px (gap-1)
Radius:     12px (rounded-xl)
Border:     1px #E7EAF1
Background: #F8FAFC
Padding:    4px (p-1)
```

### Tab Button
```
Radius:     8px (rounded-lg)
Padding:    12px 24px (px-6 py-3)
Font:       15px, weight 500 (medium)
```

| State | Background | Text Color | Shadow |
|---|---|---|---|
| Active | `white` | `#4F46E5` | `0 1px 3px rgba(0,0,0,0.08)` |
| Inactive | transparent | `#6B7280` | none |
| Inactive Hover | transparent | `#111827` | none |

---

## 9. Section Headers

### Layout
```
┌─────────────────────────────────────────────────┐
│ [Number] Title Text  [Badge] [Add Action]  [▼]  │
│ Description text (optional, smaller font)        │
└─────────────────────────────────────────────────┘
```

- **Header padding:** `24px 32px` (top + horizontal)
- **Title:** `18px`, weight 600, color `#111827`
- **Badge:** `10px`, weight 600, uppercase, `#6B7280` text on `#F3F4F6` background, rounded-full
- **Description:** `13px`, weight 400, color `#6B7280`, `mt-1` (4px below title)
- **Action buttons (headerActions):** Rendered right after the title, inside the left flex group
- **Chevron (collapse):** `16x16px`, color `#6B7280`, rotates -90° when collapsed

### Collapsible Behavior
- Click anywhere on the header to toggle
- Smooth `transition-transform 200ms` on the chevron
- Content area has `px-8 py-6` (32px horizontal, 24px vertical) padding

---

## 10. Empty States

```
Border:     1px dashed #D6DAE6
Radius:     12px (rounded-xl)
Background: white
Padding:    16px horizontal, 12-16px vertical
Text:       12px, italic, color #6B7280
Alignment:  Center (for tables) or Left (for vendor rows)
```

Example:
```
┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐
  No vendor mappings. Click "Add Vendor" to add one.
└ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘
```

---

## 11. Hover & Interaction Patterns

| Element | Hover Effect |
|---|---|
| **Section Card** | `scale(1.012)`, shadow lifts to `0 8px 24px`, `z-index: 10` |
| **Section Header** | Background → `#FAFBFC` |
| **Input/Select** | Border → `#C7D2FE` |
| **Input/Select (focus)** | Border → `#6366F1`, ring → `0 0 0 4px rgba(99,102,241,0.10)` |
| **Primary Button** | Background → `#4F46E5` |
| **Secondary Button** | Background → `#F9FAFB` |
| **Action Link** | Color → `#DC2626` (darker red) |
| **Delete Icon** | Background → `rgba(239,68,68,0.10)`, Color → `#EF4444` |
| **Table Row** | Background → `rgba(248,250,252,0.6)` |
| **Tab Button (inactive)** | Text → `#111827` |

### Transitions
- **Inputs:** `transition: border-color 0.18s ease, box-shadow 0.18s ease`
- **Buttons:** `transition: background-color 0.2s ease`
- **Section cards:** `transition: box-shadow 0.15s ease, transform 0.15s ease`
- **Chevron:** `transition: transform 0.2s ease`

---

## 12. Quick Reference: Copy-Paste Classes

### Input (Standard)
```
h-[46px] w-full min-w-0 !rounded-[10px] !border !border-[#DCE3ED] bg-white !px-4 !py-0 text-sm font-medium text-[#111827] transition-[border-color,box-shadow] outline-none placeholder:text-[#9CA3AF] hover:border-[#C7D2FE] focus-visible:border-[#6366F1] focus-visible:shadow-[0_0_0_4px_rgba(99,102,241,0.10)]
```

### Input (Compact / Table)
```
h-9 w-full min-w-0 !rounded-lg !border !border-[#DCE3ED] bg-white !px-3 !py-0 text-[13px] font-medium text-[#111827] transition-[border-color,box-shadow] outline-none placeholder:text-[#9CA3AF] hover:border-[#C7D2FE] focus-visible:border-[#6366F1] focus-visible:shadow-[0_0_0_4px_rgba(99,102,241,0.10)]
```

### Section Card
```
overflow-hidden rounded-2xl border border-[#E7EAF1] bg-white shadow-[0_2px_10px_rgba(15,23,42,0.04)] transition-[box-shadow,transform] duration-150 hover:z-10 hover:scale-[1.012] hover:shadow-[0_8px_24px_rgba(15,23,42,0.06)]
```

### Action Link (Red)
```
inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#EF4444] transition-colors hover:text-[#DC2626]
```

### Tab Button (Active)
```
relative rounded-lg px-6 py-3 text-[15px] font-medium bg-white text-[#4F46E5] shadow-sm
```

### Tab Button (Inactive)
```
relative rounded-lg px-6 py-3 text-[15px] font-medium text-[#6B7280] hover:text-[#111827]
```

---

## 13. File Locations

| File | Purpose |
|---|---|
| `features/materials/components/editor/formStyles.ts` | All reusable style tokens (inputField, selectField, buttons, etc.) |
| `features/materials/components/editor/EditorSection.tsx` | Section card wrapper (title, description, collapsible) |
| `features/materials/components/editor/VendorSection.tsx` | Vendor mapping form (label + field grid layout) |
| `features/materials/components/editor/ClientSection.tsx` | Client mapping form (tabs + table layout) |
| `features/materials/components/editor/ItemEditorDialog.tsx` | Main form layout (grid arrangement of all sections) |
| `src/index.css` | Global CSS resets and overrides (⚠️ source of cascade conflicts) |

---

*Last updated: August 2026*
*Project: MEP ERP — Item Editor Module*
