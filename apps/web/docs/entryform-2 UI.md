# EntryForm-2 — UI Rules (Machine / Work Center Entry Form)

**Reference implementation:** `src/pages/manufacturing/machine-board/AddMachinePage.tsx` (+ `AddMachineModal.tsx`, `DowntimeModal.tsx`)
**Purpose:** Canonical "entry form" design language for manufacturing create/edit screens. UI-only contract — no workflow / business-logic changes.

---

## 1. Page Shell

| Token | Value |
|---|---|
| Font | `font-['Inter']` |
| Page padding | `p-6` (24px) |
| Max width | `max-w-[1000px] mx-auto` |
| Section gap | `space-y-6` (24px) |
| Background | inherits page (`#fafafa` / `#F8FAFC`) |

Root wrapper carries a scoped `<style>` block that re-asserts the form's radii against any global button CSS:

```css
.form-root .inner-container-20px         { border-radius: 20px !important; }
.form-root .entry-field-container-5px    { border-radius: 5px !important; }
.form-root .content-body-left-pad-12px   { padding-left: 12px !important; }
.form-root label                         { margin-bottom: 8px !important; }
.form-root input, select, textarea       { border-radius: 5px !important; }
```

---

## 2. Header / Breadcrumb

| Part | Style |
|---|---|
| Row | `flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200` |
| Breadcrumb | `flex items-center gap-2 text-xs text-slate-500` — `Button variant="link"` + `ChevronRight size={12}` + current `span text-slate-900 font-semibold` |
| Title | `h1 text-xl font-bold text-slate-900` |
| Header action | `Button variant="secondary" size="sm"` + `leftIcon={<ArrowLeft size={14}/>}` ("Back…") |

---

## 3. Section Cards

### 3.1 Static numbered section
```jsx
<div className="inner-container-20px content-body-left-pad-12px bg-white border border-slate-200 p-6 shadow-2xs space-y-4"
     style={{ borderRadius: '20px', paddingLeft: '12px' }}>
  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-indigo-600 border-b border-slate-100 pb-2">
    1. Section Title
  </h3>
  ...fields...
</div>
```

### 3.2 Collapsible section
Header is a full-width ghost `Button`:
```jsx
<Button type="button" fullWidth variant="ghost" onClick={toggle}
  className="justify-between px-6 py-2 bg-slate-50 hover:bg-slate-100/80 text-sm font-bold text-slate-800 rounded-none"
  style={{ height: 'auto', lineHeight: 'normal' }}>
  <span className="flex items-center gap-2">
    <span className="text-indigo-600 font-mono">2.</span> Section Title
  </span>
  {open ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
</Button>
```
Body: `content-body-left-pad-12px p-6 space-y-4 border-t border-slate-200`.

---

## 4. Fields

| Part | Value |
|---|---|
| Field wrapper | `EntryContainer` with `className="entry-field-container-5px"` |
| Label | `text-[14px] font-medium`, `margin-bottom: 8px` |
| Input height | `40px` |
| Input font | `13px` |
| Input radius | `5px` |
| Input border | `1px solid #cbd5e1` |
| Input padding | `0 12px` |

Shared input style object:
```ts
const inputStyle: React.CSSProperties = {
  width: '100%', height: '40px', padding: '0 12px',
  fontSize: '13px', borderRadius: '5px',
  border: '1px solid #cbd5e1', outline: 'none', background: '#ffffff',
};
```

Grids: `grid grid-cols-1 md:grid-cols-2 gap-4` (pairs) / `md:grid-cols-3` (triplets).

---

## 5. Inline Builder Rows (dynamic list)

| Part | Value |
|---|---|
| Builder header strip | `flex justify-between items-center bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 mb-2` |
| Add button | `Button variant="default" size="xs" leftIcon={<Plus size={14}/>}` |
| Row | `bg-slate-50 p-3.5 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-12 gap-3 items-center` (inline `borderRadius: '5px'`) |
| Row sub-label | `block text-xs font-semibold text-slate-700 mb-1` |
| Delete | `Button variant="ghost" size="icon-sm" className="text-rose-500 hover:text-rose-700 hover:bg-rose-50"` |

---

## 6. Buttons

| Role | Variant / Size |
|---|---|
| Back (header) | `secondary` / `sm` + `ArrowLeft` |
| Cancel | `secondary` / `default` |
| Save / Primary | `default` / `default` + `leftIcon={<Save size={14}/>}` + `loading` / `loadingText` |
| Small inline action | `default` / `xs` + icon |
| Danger / destructive | `destructive` (+ `success` for resolve actions) |
| Close icon (modals/drawers) | `ghost` / `icon-sm` `text-slate-400 hover:text-slate-600` |
| Table delete icon | `ghost` / `icon-xs` `text-red-500 hover:text-red-600` |

Footer always right-aligned: `flex justify-end gap-3 pt-2`.

---

## 7. Apply to New Screens

To port this language to another entry form (e.g. Create BOM):

1. Root: `p-6 max-w-[1000px] mx-auto font-['Inter'] space-y-6` + the scoped `<style>` block (prefix with a screen-specific root class).
2. Breadcrumb header + title + `Back` button.
3. Group inputs into numbered section cards (20px radius, 12px left pad, uppercase indigo heading). Collapsible where long.
4. Replace ad-hoc input styles with the shared `inputStyle` (40px / 13px / 5px / `#cbd5e1`).
5. Use the shared `Button` for all actions with the variant/size table above.
6. Preserve all state, handlers, queries, and save logic — **UI only**.
