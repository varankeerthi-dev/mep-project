# Instructions

Don't assume anything. Don't introduce new tech, libraries, or patterns. Every implementation must strictly follow one of the patterns documented in this file. If no matching pattern exists, ask before inventing anything new.

---

# Card Body Padding

Card body internal padding is **24px** on all sides (`SubcontractorWorkOrderCreate.tsx`).

```tsx
cardBody: { padding: '24px' }
```

---

# Form Field Row — Document Section Pattern

Label-value row layout for document header sections (e.g., CreateQuotation, BOMEditor).

## Structure

Each field row is a horizontal flex row:

```
[Label (fixed width)] [gap] [Entry / Input (fills remaining)]
```

Rows stack vertically with 8px gap. Wrapped in a section container with a section header label.

## Tokens

```tsx
// Row container — flex row, centered vertically
headerFieldStyle = { display: 'flex', alignItems: 'center', gap: '8px' }

// Label — fixed width, right-aligned text
labelColStyle   = { minWidth: '70px', maxWidth: '70px', fontWeight: 600, fontSize: '11px', color: '#374151' }

// Entry cell — fills remaining space
fieldColStyle   = { flex: 1 }

// Section group header — uppercase label above a group of rows
sectionHeaderStyle = {
  fontWeight: 600, fontSize: '11px', color: '#6b7280',
  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px'
}

// Input styling inside entry cells
inputStyle = { padding: '4px 8px', fontSize: '12px' }
```

## Render helper

```tsx
const renderHeaderField = (label, field, isLast = false) => (
  <div style={{ ...headerFieldStyle, marginBottom: isLast ? 0 : '8px' }}>
    <span style={labelColStyle}>{label}</span>
    <div style={fieldColStyle}>{field}</div>
  </div>
);
```

## Usage

Sections sit inside a 2-column grid:

```tsx
<div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '6px' }}>
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px' }}>
    {/* Column 1 */}
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={sectionHeaderStyle}>Section Title</div>
      {renderHeaderField('Label:', <input ... />)}
      {renderHeaderField('Another:', <select ... />)}
    </div>
    {/* Column 2 */}
    <div>...</div>
  </div>
</div>
```

## Label width variants

- **CreateQuotation**: 70px — tighter, compact forms
- **BOMEditor**: 90px — wider labels for longer field names

Pick based on label length and available horizontal space.

---

# Searchable Dropdown — Default Pattern

Replace native `<select>` with a searchable text input + dropdown for any list exceeding 5 items.

Used in: `BOMEditor.tsx` (material dropdown), `CreateQuotation.tsx` (client dropdown)

## State

```
searchText: string              // filters list in dropdown
isDropdownOpen: boolean         // toggle visibility
```

## Click-Outside

`useEffect` + `mousedown` listener using a `.dropdown-container` className:

```tsx
useEffect(() => {
  const handler = (e: MouseEvent) => {
    if (!(e.target as HTMLElement).closest('.dropdown-container')) {
      setIsDropdownOpen(false);
    }
  };
  document.addEventListener('mousedown', handler);
  return () => document.removeEventListener('mousedown', handler);
}, []);
```

## Input

Always shows selected value when closed, search text when open:

```tsx
<input
  value={isDropdownOpen ? searchText : (selectedItem?.name || '')}
  onChange={e => { setSearchText(e.target.value); setIsDropdownOpen(true); }}
  onFocus={() => setIsDropdownOpen(true)}
  placeholder="Search..."
/>
```

## Dropdown

Absolute-positioned below input, filtered case-insensitively:

```tsx
{isDropdownOpen && (
  <div style={{
    position: 'absolute', top: '100%', left: 0, right: 0,
    zIndex: 50, background: 'white', border: '1px solid #d1d5db',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
    maxHeight: '200px', overflowY: 'auto'
  }}>
    {items
      .filter(i => !searchText || i.name.toLowerCase().includes(searchText.toLowerCase()))
      .map(i => (
        <div key={i.id} style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '12px', borderBottom: '1px solid #f3f4f6' }}
          onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
          onMouseLeave={e => e.currentTarget.style.background = 'white'}
          onClick={() => { handleSelect(i); setSearchText(''); setIsDropdownOpen(false); }}
        >{i.name}</div>
      ))}
    {filteredCount === 0 && (
      <div style={{ padding: '6px 12px', fontSize: '11px', color: '#9ca3af', fontStyle: 'italic', textAlign: 'center' }}>No items found</div>
    )}
  </div>
)}
```

## Container

Must have `position: 'relative'` and parent with `overflow: 'hidden'` must be removed/avoided to prevent clipping.

### Rendering Above Containers

Dropdowns must always render above sibling elements and not be clipped by parent borders. To achieve this:

1. **Remove `overflow: hidden`** from the parent container that holds the dropdown trigger
2. **Set `zIndex: 50`** on the dropdown panel
3. **Use `position: 'absolute'`** with `top: '100%'` to position below the trigger
4. If the parent has `border-radius`, the dropdown will naturally extend beyond — this is correct behavior

**Common mistake**: Setting `overflow: hidden` on a table/card container to enforce border-radius will clip all dropdowns inside it. Instead, use `overflow: 'visible'` or remove overflow entirely.

**Example**:
```tsx
// ❌ BAD — clips dropdown
<div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden' }}>

// ✅ GOOD — dropdown extends above
<div style={{ border: '1px solid #e5e7eb', borderRadius: '6px' }}>
```

## Per-Row in Tables

When multiple dropdowns exist in a table (e.g., BOM rows), use:

- `searchText: Record<number, string>` — search keyed by row index
- `openIndex: number` — single open tracker (`-1` = none)
- On row add: `setOpenIndex(newIndex)`
- On row remove: rebuild index map

## Container class

`.dropdown-container` is added to the wrapper `div` for click-outside detection.

---

# Buttons

The button system has three intent levels: **primary**, **secondary**, and **destructive**. All buttons share the same core geometry; only color tokens differ.

## Core tokens (shared by every button)

| Token | Value |
|---|---|
| Padding (vertical / horizontal) | `6px` / `12px` (header) — `7px 16px` (modal) |
| Border | `1px solid <intent-border>` |
| Border-radius | `6px` (header) — `8px / rounded-lg` (modal) |
| Font size / weight | `12px` / `500` (header) — `12px` / `600` (modal primary) |
| Cursor | `pointer` — `not-allowed` when disabled |
| Disabled opacity | `0.6` |
| Transition | `all 0.15s` |
| Layout | `display: 'flex', alignItems: 'center', gap: '4px'` |

## Primary (Save / Confirm)

Used for the main action in a screen or modal.

```tsx
{
  padding: '6px 14px',
  background: '#185FA5',      // brand blue
  border: '1px solid #185FA5',
  color: '#fff',
}
onMouseEnter: background → '#0C447C', borderColor → '#0C447C'
onMouseLeave: revert
```

## Secondary (Cancel / Close)

Used for the dismiss action next to a primary button.

```tsx
{
  padding: '6px 14px',
  border: '1px solid #d1d5db',
  background: '#fff',
  color: '#374151',           // zinc-700
}
onMouseEnter: background → '#f3f4f6', borderColor → '#9ca3af'
onMouseLeave: revert
```

## Destructive (Delete)

Used for delete actions in headers, action menus, and confirmation modals. **Icon and text color are black** (neutral, not red) — the danger signal is carried by the *action it triggers* (confirmation modal) and the *icon shape* (`Trash2`), not by red text.

```tsx
// Header delete button (e.g. BOMEditor)
{
  display: 'flex',
  alignItems: 'center',
  gap: '4px',                // icon ↔ text
  padding: '6px 12px',
  border: '1px solid #d1d5db',   // neutral border (NOT red)
  background: '#fff',
  color: '#000000',              // black text + black icon (NOT red)
  borderRadius: '6px',
  fontSize: '12px',
  fontWeight: 500,
}
onMouseEnter: background → '#f3f4f6', borderColor → '#9ca3af'
onMouseLeave: revert
```

```tsx
<button>
  <Trash2 size={13} /> Delete
</button>
```

| Token | Value |
|---|---|
| Icon | `lucide-react` `Trash2`, **13px** |
| Gap icon ↔ text | **4px** |
| Padding | **6px / 12px** |
| Border | `1px solid #d1d5db` (zinc-300) |
| Border-radius | **6px** |
| Text + icon color | `#000000` (black) |
| Background | `#fff` → `#f3f4f6` on hover |
| Hover border | `#9ca3af` |

## Action-menu delete item (BOMList row menu)

The delete item inside a dropdown action menu follows the same neutral color rule. It is separated from non-destructive items by a thin divider.

```tsx
<button
  className="
    flex w-full items-center gap-2
    rounded-lg px-3 py-2
    text-sm text-zinc-700
    hover:text-zinc-900 hover:bg-zinc-50
    transition-all
  "
>
  <Trash2 className="w-3.5 h-3.5" /> Delete BOM
</button>
```

| Token | Value |
|---|---|
| Icon | `Trash2`, **14×14px** |
| Gap icon ↔ text | **8px** |
| Padding | **8px / 12px** |
| Border-radius | **8px** |
| Text + icon color | `#3f3f46` (zinc-700) — NOT red |
| Hover bg | `#fafafa` (zinc-50) |
| Divider above | `my-1 border-t border-zinc-100` |

## Confirmation modal

A destructive action always opens a confirmation modal. The modal itself uses **red** for the danger icon badge and the confirm button — this is where the danger signal lives, not on the trigger button.

| Element | Token |
|---|---|
| Backdrop | `bg-black/40` |
| Card | `bg-white`, `rounded-2xl` (16px), `p-6` (24px), `max-w-[420px]`, `shadow-2xl` |
| Icon badge | `w-10 h-10`, `rounded-xl` (12px), `bg-rose-50` |
| Icon | `Trash2`, `w-5 h-5` (20×20), `text-rose-600` |
| Title | `text-[15px] font-semibold text-zinc-900` |
| Title row gap | `gap-3` (12px) — badge ↔ title |
| Title ↔ body | `mb-3` (12px) |
| Body line-height | `leading-[18px]` |
| Body ↔ buttons | `mb-5` (20px) |
| Buttons row gap | `gap-2` (8px), `justify-end` |
| Button height | `h-9` (36px) |
| Button h-padding | `px-4` (16px) |
| Cancel button | white, `border-zinc-200`, `text-zinc-600`, `rounded-lg` |
| Confirm button | `bg-rose-600`, `text-white`, `rounded-lg`, `font-semibold`, hover `bg-rose-700` |
| Icon in confirm button (while pending) | `Loader2 w-3.5 h-3.5 animate-spin`, gap `1.5` (6px) |

## Rules

1. **Trigger buttons (header / menu) use black text** for destructive actions — no red text on the trigger itself.
2. **The confirmation modal is the only place that uses red** (icon badge + confirm button).
3. The danger icon is always `Trash2` from `lucide-react` — never an alternative icon.
4. Destructive trigger buttons in action menus are separated from non-destructive items with a `border-t border-zinc-100` divider and 4px vertical margin.
5. Disabled state during in-flight mutation: `opacity: 0.6`, `cursor: 'not-allowed'`, hover handlers guarded.
