# Table Design v26 — QuotationList Design Reference

## Container
- `flex flex-col h-full bg-white`
- No max-width constraint, fills parent

## Header
- `flex items-center justify-between px-6 py-4 border-b border-zinc-200`
- Title: `text-base font-medium text-zinc-900`
- Count badge: `inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600`
- Stats inline: `h-4 w-px bg-zinc-200` divider
  - Stat label: `text-[10px] font-bold uppercase tracking-wider mx-1` (colored per status)
  - Stat value: `text-xs font-medium mx-1` (colored per status)
- Total value: `text-xs font-medium text-zinc-500 uppercase tracking-wider mx-1` label + `text-sm font-medium text-zinc-900 mx-1` value

## Search Input
- `px-4 h-[30px] w-64 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent`

## Buttons
- **Create/Column buttons:** `inline-flex items-center justify-center text-sm font-medium` with inline `paddingTop:8px paddingBottom:8px paddingLeft:10px paddingRight:10px`
- Create: `text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm active:scale-[0.98]`
- Column: `text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-100 active:scale-[0.98]`

## Sub-tab row
- `flex items-center justify-between px-6 border-b border-zinc-100 bg-zinc-50/50`
- Inline style: `paddingTop: 15px, paddingBottom: 15px`
- Button: `w-[150px] h-[26px] px-4 text-sm font-medium transition-colors`
  - Active: `bg-blue-600/10 text-blue-600`
  - Inactive: `text-zinc-600 hover:bg-zinc-100`
- Status dropdown same dimensions: `w-[150px] h-[26px]`

## Table
- `w-full border-separate border-spacing-0`
- Header cells: `sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200`
- Sort header: `flex items-center gap-2 hover:text-zinc-900 transition-colors group`
- Sort icons: `w-3 h-3`, inactive `text-zinc-300 group-hover:text-zinc-400`, active `text-indigo-600`
- Checkbox column: `w-[50px]`, `px-4 text-center`
- Action column: `w-[70px]`, `px-6 pl-1 text-center`

## Table Rows
- `py-[26px]` vertical padding on all cells (massive breathing room)
- Alternating: `bg-white` / `bg-zinc-50/30`
- Border: `border-t border-zinc-200/70`
- Hover: `hover:border-blue-600 hover:bg-blue-100/80 hover:shadow-sm`
- Selected: `bg-indigo-50/50 border-l-blue-600`
- Anim: spring motion with `initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}`
- Cells: `px-6 py-[26px] align-middle`
- Text: `text-sm font-medium text-zinc-900` for primary, `text-sm text-zinc-800` for secondary
- Truncation: `max-w-[180px] truncate` / `max-w-[350px] truncate` with `title` attribute
- Numeric cells: `tabular-nums text-right`
- Status: `text-sm font-medium` with inline `getStatusColor().color`

## Action Menu (Dropdown)
- Container: `absolute right-0 z-[100] w-44 rounded-lg border border-zinc-200/60 bg-white p-1 shadow-lg shadow-black/5`
- Positioning: if last 3 rows: `bottom-full mb-1`, else: `top-full mt-1`
- Items: `flex w-full items-center gap-2 rounded-md px-2 text-[12px]` with inline `padding:6px`
  - Default: `text-zinc-600 hover:bg-indigo-50 hover:text-indigo-700`
  - Mark as Sent (blue): `text-blue-600 hover:bg-blue-50 hover:text-blue-800 font-medium`
  - Delete (red): `text-zinc-600 hover:bg-red-50 hover:text-red-600`
  - Active scale: `active:scale-[0.98]`
- Separator: `my-1 border-t border-zinc-100`
- Icon size: `w-3.5 h-3.5`

## Bulk Action Header
- Fixed sticky top: `sticky top-0 z-[120] w-full bg-zinc-900 text-white px-6 py-[12px] flex items-center justify-between shadow-2xl`
- Title: `text-sm font-semibold`
- Subtitle: `text-[10px] text-zinc-400 uppercase tracking-widest font-bold`
- Buttons:
  - Print: `bg-white text-zinc-900 text-xs font-bold uppercase tracking-wider rounded-lg px-4 py-2`
  - Delete: `bg-red-600 text-white text-xs font-bold uppercase tracking-wider rounded-lg px-4 py-2`
- Anim: spring `stiffness:300,damping:30`

## Pagination
- `flex items-center justify-between px-6 py-4 border-t border-zinc-200 bg-zinc-50/50`
- Info text: `text-sm font-medium text-zinc-600`
- Buttons: `h-[32px] min-w-[80px]` for Prev/Next
  - Active: `text-zinc-700 hover:bg-zinc-200 bg-white border border-zinc-200 shadow-sm`
  - Disabled: `text-zinc-400 bg-zinc-50 border border-zinc-100 cursor-not-allowed`
- Page numbers: `h-[32px] min-w-[32px]` with `px-3 py-1 text-sm font-medium rounded-md`
  - Active: `bg-blue-600/10 text-blue-600 border border-blue-600/20 shadow-sm`
  - Inactive: `text-zinc-600 hover:bg-zinc-100 bg-white border border-zinc-200`
- Gap: `gap-1.5` between numbers, `gap-2` between buttons

## Column Customizer (Dropdown)
- `absolute right-0 top-full mt-2 z-[110] w-64 bg-white border border-zinc-200 rounded-xl shadow-2xl p-4`
- Anim: `animate-in fade-in slide-in-from-top-2 duration-200`
- Title: `text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3`
- Items: `flex items-center gap-3 p-2 rounded-lg transition-colors`
  - Checkbox: `w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500`
  - Label: `text-sm font-medium text-zinc-700`
- Footer separator: `pt-4 border-t border-zinc-100`
- Buttons: `flex-1 px-3 py-1.5 text-xs font-medium rounded-lg`

## Empty State
- `px-5 py-16 text-center text-sm text-zinc-500`
- "Loading quotations..." / "No quotations found"

## Card Styles (used in other modules)
- Card: `bg-white border border-zinc-200 rounded-xl overflow-hidden`
- Card header: `border-b border-zinc-200 bg-white`
