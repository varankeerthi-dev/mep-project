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

All buttons MUST use the shared component `src/components/ui/button.tsx` (`<Button>`). Do not hand-roll button styles or colors anywhere. The component is token-driven and renders the single, app-wide button language.

Usage:

  import { Button } from '@/components/ui/button';
  <Button variant="default">Save</Button>       // Primary - brand blue #185FA5
  <Button variant="secondary">Cancel</Button>   // Supporting
  <Button variant="destructive">Delete</Button>  // Danger
  <Button variant="success">Approve</Button>     // Positive
  <Button variant="ghost">More</Button>          // Inline / toolbar
  <Button size="sm|default|lg|icon" />
  <Button loading loadingText="Saving">Save</Button>

Variants (intent levels):

| Variant | Use | Color |
| `default` | Primary action | brand blue `#185FA5` (hover `#0C447C`) |
| `secondary` | Supporting action | white / zinc border |
| `outline` | Utility action | white / zinc border |
| `ghost` | Inline / toolbar | transparent |
| `destructive` | Danger | red |
| `success` | Positive | emerald |
| `warning` | Attention | amber |

The primary color is defined by the `--primary` CSS token (set to `#185FA5` in `src/index.css`). Changing it there updates every primary button across the app.

Deprecated patterns (DO NOT USE):

- Paper 2.0 inline buttons (`bg-[#0A0A0A]`, `bg-white border-[#E5E5E5]` hand-rolled classes) - replaced by `<Button variant="default|secondary">`.
- Hardcoded inline `style={{ background: '#185FA5' }}` buttons - replaced by `<Button variant="default">`.

---

# Sub-Tabs Navigation Bar Pattern

Top-level sub-module navigation bar pattern based on Paper Design System (Paper 2.0).

Used in: `PurchaseModule.tsx`, `SubTabsNav.tsx`, and top-level module views.

## UI Specifications & Design Tokens

| Property | Active State | Inactive State |
|---|---|---|
| Font Family | `"Inter", system-ui, sans-serif` | `"Inter", system-ui, sans-serif` |
| Font Size / Weight | `14px` / `600` | `14px` / `500` |
| Line Height | `142.857%` (`20px`) | `142.857%` (`20px`) |
| Text Color | `#16A34A` (Green) | `#0A0A0A99` (60% opacity black) |
| Active Underline | `#16A34A` (`height: 2px`, `position: absolute`, `bottom: -5px`, `left: 0`, `right: 0`, `width: 100%`) | Hidden |
| Button Border Radius | `8px` | `8px` |
| Button Border | `0.888889px solid #00000000` | `0.888889px solid #00000000` |
| Button Padding | `2px` (block) / `10px` (inline) | `2px` (block) / `10px` (inline) |
| Tab Gap | `8px` | `8px` |
| Nav Bar Container | Height: `36px`, `display: flex`, `alignItems: center`, `overflowX: auto`, `borderBottom: 1px solid #E5E7EB` |

## Reusable React Component

Component file location: [SubTabsNav.tsx](file:///c:/Users/admin/mep-project/apps/web/src/components/ui/SubTabsNav.tsx)

```tsx
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export interface SubTabItem {
  id: string;
  label: string;
  path: string;
}

export interface SubTabsNavProps {
  tabs: SubTabItem[];
  activeTabId?: string;
  onTabChange?: (tab: SubTabItem) => void;
  className?: string;
}

export const SubTabsNav: React.FC<SubTabsNavProps> = ({
  tabs,
  activeTabId,
  onTabChange,
  className = '',
}) => {
  const location = useLocation();
  const navigate = useNavigate();

  const currentTabId =
    activeTabId ||
    tabs.find((t) => location.pathname === t.path || location.pathname.startsWith(t.path))?.id ||
    tabs[0]?.id;

  return (
    <div
      style={{
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        fontSynthesis: 'none',
        gap: '8px',
        MozOsxFontSmoothing: 'grayscale',
        WebkitFontSmoothing: 'antialiased',
        width: '100%',
        borderBottom: '1px solid #E5E7EB',
        marginBottom: '16px',
        paddingBottom: '4px',
      }}
      className={className}
    >
      <div
        style={{
          alignItems: 'center',
          boxSizing: 'border-box',
          display: 'flex',
          flexShrink: '0',
          gap: '8px',
          height: '36px',
          justifyContent: 'flex-start',
          padding: '3px',
          width: '100%',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {tabs.map((tab) => {
          const isActive = currentTabId === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                if (onTabChange) {
                  onTabChange(tab);
                } else {
                  navigate(tab.path);
                }
              }}
              style={{
                alignItems: 'center',
                borderColor: '#00000000',
                borderRadius: '8px',
                borderStyle: 'solid',
                borderWidth: '0.888889px',
                boxSizing: 'border-box',
                display: 'flex',
                flexShrink: 0,
                gap: '6px',
                height: 'calc(100% - 1px)',
                justifyContent: 'center',
                paddingBlock: '2px',
                paddingInline: '10px',
                position: 'relative',
                background: 'transparent',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <div
                style={{
                  boxSizing: 'border-box',
                  color: isActive ? '#16A34A' : '#0A0A0A99',
                  display: 'flex',
                  flexShrink: '0',
                  fontFamily: '"Inter", system-ui, sans-serif',
                  fontSize: '14px',
                  fontWeight: isActive ? 600 : 500,
                  lineHeight: '142.857%',
                  textAlign: 'center',
                  width: 'max-content',
                  transition: 'color 0.15s ease',
                }}
              >
                {tab.label}
              </div>
              {isActive && (
                <div
                  style={{
                    backgroundColor: '#16A34A',
                    bottom: '-5px',
                    boxSizing: 'border-box',
                    height: '2px',
                    left: '0px',
                    position: 'absolute',
                    right: '0px',
                    width: '100%',
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
```

## Usage Instructions

1. **Routing Integration**:
   - Provide an array of tabs where each tab has `{ id, label, path }`.
   - Embed `<SubTabsNav tabs={MY_MODULE_TABS} />` at the top of the module container.
   - Routing works out-of-the-box via React Router (`useNavigate` and `useLocation`).

2. **Responsive Overflow**:
   - The tab bar sets `overflowX: 'auto'` and `scrollbarWidth: 'none'` to preserve clean scrolling across dense sub-tabs on mobile or narrow viewports.
   - Buttons use `flexShrink: 0` and `whiteSpace: 'nowrap'` so text remains crisp and unclipped.


