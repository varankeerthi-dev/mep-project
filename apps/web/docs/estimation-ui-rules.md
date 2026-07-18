# Estimation Module — UI Rules

**Scope:** `src/features/estimation/` only. Overrides DESIGN.md. Based on shadcn/ui (BaseUI Nova).

---

## 1. Spacing System

| Context | Token | Value |
|---|---|---|
| Page padding | `p-6 md:p-8` | 24–32px |
| Section gap | `gap-6` | 24px |
| Card/surface padding | `p-4` | 16px |
| Table cell padding | `px-3 py-1.5` | 12px / 6px |
| Drawer padding | `p-5` | 20px |
| Between label + field | `gap-1.5` | 6px |
| Toolbar height | `h-10` | 40px |
| Stacked form rows | `space-y-4` | 16px |

Concentric border radius: outer surface `rounded-lg` (8px) → inner table/card `rounded-md` (6px) → innermost input/button `rounded` (4px).

---

## 2. What to Avoid

| # | Anti-pattern | Why |
|---|---|---|
| 1 | **Floating action buttons** (FABs) | BOQ is document-editing, not a feed. Actions live in the toolbar. |
| 2 | **Card-based item layouts** | BOQ items are rows in a sheet, not cards. Cards waste vertical space and break scannability. |
| 3 | **Heavy shadows / gradients** | Financial data needs a clean, neutral surface. `shadow-sm` max. |
| 4 | **Gradients on data surfaces** | Distracts from numbers. Only use on brand elements (logo, primary button). |
| 5 | **Nested modals** | Modal-on-modal traps the user. Use drawers for secondary content. |
| 6 | **Modal for primary editing** | BOQ item editing, rate analysis — use drawers, not modals. Modals are for confirmations only. |
| 7 | **Ornamental borders / decorative flourishes** | Every pixel should carry information. No decorative rules, no corner ornaments. |
| 8 | **Hover-only actions** | Critical actions (delete, approve) must always be visible. Hover-only is for secondary metadata. |
| 9 | **Unformatted numbers** | Every monetary value: thousands separator, 2 decimal places, ₹ prefix. Every quantity: configurable precision. |
| 10 | **Ambiguous empty states** | Never just "No data". Always show: "No items yet — click Add Item" with action button. |
| 11 | **Inline success toasts** | Auto-save shows inline indicator ("Saving…" / "Saved"). Toast is for errors only. |
| 12 | **Right-aligned labels** | Labels left-align for vertical scanability. Only amounts/numbers right-align. |
| 13 | **Scrollable modals** | If content overflows, use a drawer instead. Modals should fit the viewport. |
| 14 | **Disabled buttons without explanation** | If a user can't act, tell them why (tooltip: "Approve locked — not a Contracts Manager"). |
| 15 | **Over-eager auto-save** | Don't save on every keystroke. 3s debounce. Show indicator. Never save invalid data. |

---

## 3. Typography

| Element | Size | Weight | Face |
|---|---|---|---|
| Section headers | `text-xs` (12px) | `font-semibold` | System (Geist) |
| Item descriptions | `text-sm` (13px) | `font-normal` | System |
| Amounts / rates | `text-sm` (13px) | `font-medium` | Monospace (`font-mono`) |
| Quantities | `text-sm` (13px) | `font-normal` | Monospace |
| Totals / subtotals | `text-sm` (13px) | `font-semibold` | Monospace |
| BOQ title | `text-lg` (18px) | `font-semibold` | System |
| Table headers | `text-xs` (12px) | `font-medium` | System (uppercase) |

All numbers use **tabular figures** (via `font-mono` or `font-variant-numeric: tabular-nums`) to prevent layout shift when values change.

---

## 4. Colour

Two categories: **semantic data colours** (margin, variance — carry meaning independent of theme) and **UI shell colours** (buttons, surfaces, cards — use shadcn CSS variables).

### UI Shell (shadcn tokens)
| Usage | Token |
|---|---|
| Primary actions | `bg-primary text-primary-foreground` |
| Surface / cards | `bg-card text-card-foreground` |
| Table stripes | `even:bg-muted/50` |
| Input borders | `border-input` |
| Destructive actions | `bg-destructive text-destructive-foreground` |

### Semantic data colours (Tailwind utility)
| Usage | Token | Meaning |
|---|---|---|
| Positive margin (≥15%) | `text-green-600` / `bg-green-50` | Healthy |
| Warning margin (5–15%) | `text-amber-600` / `bg-amber-50` | Caution |
| Critical margin (<5%) | `text-red-600` / `bg-red-50` | At risk |
| Variance under | `text-green-600` | Estimated < Bid (good) |
| Variance over | `text-red-600` | Estimated > Bid (bad) |

No custom hex codes. No custom colour palette. UI shell derives from shadcn neutral theme.

---

## 5. Component Conventions

### Tables
- TanStack Table for all tabular data
- Sticky header
- Row striping: `even:bg-muted/50`
- Amount columns right-aligned (`text-right font-mono`)
- Description columns left-aligned
- No vertical cell borders — use horizontal rules and spacing
- Empty row count: `min-h-[200px]` with centred "No items" state

### Drawers
- Width: `max-w-xl` (576px) for rate analysis, `max-w-lg` (512px) for item edit
- Padding: `p-5`
- Header: title + close button, sticky
- Footer: action buttons (sticky), only if needed

### Forms
- `react-hook-form` + `@hookform/resolvers/zod`
- Inline validation errors below the field (`text-xs text-destructive`)
- No popup validation — show as-you-type after blur

### Auto-Save Indicator
- Position: top-right of the editor toolbar
- States: "Saving…" (muted, pulsing) → "Saved" (green, fades after 2s) → error (red, persists until dismissed)
- Size: `text-xs`

### MarginBadge
- Pill-shaped (`rounded-full`)
- Size: `px-2 py-0.5 text-xs font-medium`
- Colours per section 4 above
- Shows percentage (e.g. "+12.5%")

---

## 6. Responsive Behaviour

- **Desktop-first** (1280px+ is the primary target for estimators)
- **Tablet** (768px): tables horizontal-scroll with sticky first column
- **Mobile** (< 768px): stacked card view for items, toolbar collapses to icon-only
- Breakpoints match Tailwind defaults (sm: 640, md: 768, lg: 1024, xl: 1280)
- Tables never wrap cells at any breakpoint — horizontal scroll instead

---

## 7. Motion

- Button press: `active:scale-[0.96] transition-transform`
- Drawer enter: slide from right, 200ms ease-out
- Drawer exit: slide to right, 150ms ease-in
- Auto-save indicator: fade in/out, 300ms
- Staggered list enter: 50ms per item (only on initial load)
- No page-level transitions
- `motion` / `framer-motion` for enter/exit animations, with `initial={false}` to skip on mount
