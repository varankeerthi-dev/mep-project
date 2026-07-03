# Nira Expense — Design System

## 1. Color Tokens (HSL)

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--background` | `150 20% 97%` | `220 25% 8%` | Page background |
| `--foreground` | `220 25% 12%` | `150 10% 95%` | Body text |
| `--card` | `0 0% 100%` | `220 20% 12%` | Card/container bg |
| `--card-foreground` | `220 25% 12%` | `150 10% 95%` | Text on card |
| `--primary` | `162 63% 41%` (teal-green) | same | Primary buttons, active states, links |
| `--primary-foreground` | `0 0% 100%` | `0 0% 100%` | Text on primary bg |
| `--secondary` | `150 15% 93%` | `220 15% 18%` | Tab bg, muted containers |
| `--secondary-foreground` | `220 25% 12%` | `150 10% 95%` | Text on secondary |
| `--muted` | `150 10% 94%` | `220 15% 18%` | Skeleton, disabled, subtle bg |
| `--muted-foreground` | `220 10% 46%` | `220 10% 55%` | Labels, hints, secondary text |
| `--accent` | `38 92% 50%` (amber) | same | Highlights, warnings |
| `--accent-foreground` | `0 0% 100%` | `0 0% 100%` | Text on accent |
| `--destructive` | `0 72% 51%` (red) | `0 62.8% 30.6%` | Delete, errors |
| `--border` | `150 15% 90%` | `220 15% 20%` | Borders, dividers |
| `--ring` | `162 63% 41%` | same | Focus rings |
| `--expense-income` | `152 69% 40%` (green) | same | Income amount color |
| `--expense-outcome` | `0 72% 51%` (red) | same | Expense amount color |
| `--radius` | `1rem` | `1rem` | Base border radius |

### Utility classes from index.css:
```css
.glass-card {
  @apply bg-card/80 backdrop-blur-xl border border-border/50 shadow-sm;
}
.expense-amount-positive { color: hsl(var(--expense-income)); }
.expense-amount-negative { color: hsl(var(--expense-outcome)); }
```

---

## 2. Font

| Property | Value |
|---|---|
| Family | **Inter** (Google Fonts) |
| Weights used | 400, 500, 600, 700, 800 (logo), 900 (logo `font-black`) |
| Fallback | `sans-serif` |

### Typography scale used across app:

| Element | Class/Tailwind | Size |
|---|---|---|
| Page title (h1) | `text-2xl font-bold tracking-tight` | `1.5rem` |
| Section heading | `text-lg font-semibold` | `1.125rem` |
| Card title | `text-base font-semibold` | `1rem` |
| Body text | `text-sm` | `0.875rem` |
| Labels | `text-xs font-medium text-muted-foreground` | `0.75rem` |
| Sub-labels | `text-[10px]` or `text-[11px]` | `0.625rem-0.6875rem` |
| Tiny meta | `text-[9px]` | `0.5625rem` |
| Amount (big) | `text-3xl font-bold tracking-tight` | `1.875rem` |
| Amount (input) | `text-lg font-bold` or `text-2xl font-bold` | `1.125rem-1.5rem` |
| Month label | `text-[11px] font-bold tabular-nums` | `0.6875rem` |
| Badge/pill label | `text-[10px] font-semibold` | `0.625rem` |
| Step indicator | `text-sm font-medium` | `0.875rem` |

---

## 3. Layout & Container Sizes

| Element | Width | Paddings |
|---|---|---|
| **App shell** | `max-w-lg` (`32rem`/512px), centered with `mx-auto` | — |
| **Page content** | — | `px-4 pt-10` to `pt-12`, `pb-24` (bottom nav clearance) |
| **Off-canvas (fullscreen)** | `min-h-screen` | `px-6` |
| **Dialog max-width** | `max-w-sm` (24rem/384px) or `max-w-md` (28rem/448px) | `p-5` or `p-6` |
| **Cards** | `glass-card rounded-2xl p-4` or `p-5` | `p-4` or `p-5` |
| **Small card / stat** | `rounded-2xl p-3` | `p-3` |
| **Bottom nav** | `h-16`, `max-w-lg mx-auto` | `px-2 pb-1` |
| **FAB (add button)** | `h-14 w-14 rounded-full` | — |

### Padding/margin patterns
- Section gap: `space-y-6` (`1.5rem`)
- Item gap: `space-y-3` (`0.75rem`) or `space-y-2` (`0.5rem`)
- Grid gap: `gap-3` (`0.75rem`) or `gap-2` (`0.5rem`)
- Inner card padding: `p-4` (`1rem`) or `p-5` (`1.25rem`)
- Dialog content padding: `p-6` (`1.5rem`)
- Dialog header gap: `space-y-1.5`

---

## 4. Entry Fields & Buttons

### Input
```css
/* shadcn default */
flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base
/* Overridden in app */
rounded-xl h-11  /* most common */
```

| Variant | Height | Radius | Text |
|---|---|---|---|
| Default input | `h-10` | `rounded-md` (0.5rem) | `text-base` |
| **App input** (overridden) | `h-11` (2.75rem) | `rounded-xl` (0.75rem) | `text-sm` |
| Amount input | `h-11` | `rounded-xl` | `text-lg font-bold` |
| Large amount input | `h-14` | `rounded-xl` | `text-2xl font-bold` |
| Small input (inline) | `h-8` | `rounded-lg` | `text-xs` |
| File upload area | `p-4` rounded-xl border-2 dashed | — | `text-xs` |

### Textarea
```css
flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm
/* app overrides */
rounded-xl min-h-[50px] resize-none text-sm
```

### Button
| Variant | Height | Padding | Radius | Text |
|---|---|---|---|---|
| `default` | `h-10` | `px-4 py-2` | `rounded-md` | `text-sm font-medium` |
| `sm` | `h-9` | `px-3` | `rounded-md` | `text-sm font-medium` |
| `lg` | `h-11` | `px-8` | `rounded-md` | `text-sm font-medium` |
| `icon` | `h-10 w-10` | — | `rounded-md` | — |

**App overrides (most common pattern):**
```css
w-full rounded-xl h-11 text-base font-semibold
/* Small buttons */
rounded-xl h-8 text-xs shrink-0
/* Icon buttons */
h-8 w-8 rounded-full
h-10 w-10 rounded-full
/* FAB (bottom nav center) */
h-14 w-14 rounded-full
/* Tab toggle active state */
bg-background text-foreground shadow-sm
```

### Focus ring (all inputs/buttons)
```css
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
/* App variant also uses: */
focus:outline-none focus:ring-2 focus:ring-primary/30
```

### Selection state (category picker, project picker)
```css
border-primary bg-primary/10 ring-1 ring-primary/30   /* selected */
border-border bg-card hover:border-primary/40          /* unselected */
```

---

## 5. Border Radius

| Token | Value | Used for |
|---|---|---|
| `--radius` | `1rem` (16px) | Base |
| `rounded-sm` | `calc(var(--radius) - 4px)` = 12px | — |
| `rounded-md` | `calc(var(--radius) - 2px)` = 14px | — |
| `rounded-lg` | `var(--radius)` = 16px | Cards, dialogs (default shadcn) |
| **`rounded-xl`** | `0.75rem` (12px) | **Most inputs, buttons, containers** |
| `rounded-2xl` | `1rem` (16px) | **Cards, dialogs, containers** |
| `rounded-3xl` | `1.5rem` (24px) | Onboarding dialog |
| `rounded-full` | `9999px` | Avatars, FAB, badges |

> **Key insight**: The app consistently overrides shadcn's `rounded-md` with `rounded-xl` on inputs and `rounded-2xl` on card/dialog containers.

---

## 6. Shadows

| Usage | Shadow |
|---|---|
| Cards | `shadow-sm` |
| Dialog | `shadow-lg` (shadcn default) |
| FAB | `shadow-lg shadow-primary/30` |
| Active tab | `shadow-sm` |
| Dragging item | `shadow-lg ring-2 ring-primary/30` |
| Select dropdown | `shadow-md` |
| Toast | `shadow-lg` |

---

## 7. Icons (lucide-react)

| Context | Icon Size | SVG Props |
|---|---|---|
| **Inline with text** | `h-4 w-4` (16px) | — |
| **Section icons** | `h-5 w-5` (20px) | — |
| **Page header / hero** | `h-8 w-8` (32px) | — |
| **Icon container (24x24)** | `h-6 w-6` (24px) | — |
| **Small icon buttons** | `h-3 w-3` to `h-3.5 w-3.5` | — |
| **Bottom nav** | `h-5 w-5` (active color `#032c2c`) | — |
| **FAB plus** | `h-7 w-7` | `strokeWidth={2.5}` |
| **Stat card icons** | `h-5 w-5 mx-auto mb-1.5` | — |
| **Camera/upload** | `h-10 w-10` | — |
| **Toast X close** | `h-4 w-4` | — |

### Emoji as icons
Categories use large emojis as icon replacements (set in `text-lg` or `text-2xl`), displayed inside `h-10 w-10 rounded-xl bg-secondary` boxes.

---

## 8. Animations (Framer Motion)

| Pattern | Props | Used where |
|---|---|---|
| **Page entry** | `initial={{ opacity: 0, y: 20 }}` `animate={{ opacity: 1, y: 0 }}` | Most page content |
| **List stagger** | `transition={{ delay: i * 0.05 }}` or `0.08` | Lists, cards |
| **Dialog entry** | `initial={{ opacity: 0, scale: 0.9, y: 20 }}` `transition={{ type: "spring", duration: 0.5 }}` | Onboarding |
| **Slide left/right** | `x: -20` / `x: 20` exit | Multi-step flows |
| **Height expand** | `initial={{ opacity: 0, height: 0 }}` `animate={{ opacity: 1, height: "auto" }}` | Collapsible sections |
| **Exit** | `exit={{ opacity: 0, x: -200 }}` | SMS list items |
| **Layout animate** | `layout` prop | Reorder lists |
| **Scale on press** | `active:scale-[0.98]` or `active:scale-95` | Buttons, cards (CSS) |
| **Nav indicator** | `layoutId="nav-indicator"` with spring transition | Bottom nav active pill |

### Page header pattern
```tsx
<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
```

---

## 9. Login Page

| Element | Style |
|---|---|
| **Container** | `min-h-screen flex flex-col items-center justify-center px-6 bg-background` |
| **Card width** | `max-w-sm` |
| **Logo box** | `h-16 w-16 rounded-2xl bg-primary flex items-center justify-center` |
| **App name** | `text-2xl font-bold tracking-tight` |
| **OAuth buttons** | `w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-border bg-card font-semibold text-sm` |
| **Apple button** | same, but `bg-foreground text-background` |
| **Divider** | `flex items-center gap-3` with `h-px bg-border` |
| **Email input** | `w-full py-3 px-4 rounded-xl border bg-card text-sm` |
| **Submit button** | `w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm` |
| **Back link** | `flex items-center gap-1 text-sm text-muted-foreground` |
| **Password strength bar** | `h-1 flex-1 rounded-full` (5 segments, gradient: red→orange→yellow→emerald) |
| **Password validation list** | `text-[11px] text-muted-foreground`, checked items turn `text-emerald-500` |

### View states
Main → Login / Signup / Forgot password. Uses a `view` state machine (`"main" | "login" | "signup" | "forgot"`). Each view is a separate `motion.div` with `key={view}` for enter/exit animation.

---

## 10. Bottom Navigation

```tsx
<nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-xl border-t border-border safe-area-bottom">
  <div className="flex items-end justify-around h-16 max-w-lg mx-auto px-2 pb-1">
```

- **4 nav items**: Home, "That money?" (Notes), Transactions, SMS
- **Center FAB**: Links to `/expenses`, `h-14 w-14 rounded-full`, color `#032c2c`
- **Active indicator**: Spring-animated pill (`h-0.5 rounded-full`) above active link
- **Active color**: `#032c2c` (hardcoded dark teal)
- **Icon size**: `h-5 w-5`, label `text-[9px] font-medium`
- **Safe area**: `safe-area-bottom` class
- **Nav clearance**: Page `pb-24` to avoid overlap

---

## 11. Tab Switcher Pattern (Used Everywhere)

The same tab pattern is used in Expenses, Transactions, Notes, Home dashboard:

```tsx
<div className="flex items-center gap-1 p-1 rounded-xl bg-secondary">
  <button
    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${
      active === "expense"
        ? "bg-background text-foreground shadow-sm"
        : "text-muted-foreground"
    }`}
  >
    <Icon className="h-4 w-4" />
    Label
  </button>
  ...
</div>
```

---

## 12. Dialog Pattern

```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent className="max-w-sm mx-auto rounded-2xl max-h-[85vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2">...</DialogTitle>
    </DialogHeader>
    ...
  </DialogContent>
</Dialog>
```

- **DialogContent**: `max-w-sm` (384px), `rounded-2xl`, `p-5` or `p-6`
- **Max height**: `max-h-[85vh]` or `max-h-[90vh]` with `overflow-y-auto`
- **Custom picker inside dialog**: `w-[90vw] max-w-md rounded-2xl p-5 max-h-[70vh] overflow-y-auto`

### Edit/Delete Dialog Pattern
- Edit: Dialog with prefilled form fields
- Delete: AlertDialog triggered from a `Trash2` icon button (`h-8 w-8 text-destructive`)
- Delete confirmation: `AlertDialogContent max-w-xs rounded-2xl`

---

## 13. Card Patterns

| Variant | Classes |
|---|---|
| **Glass card** | `glass-card rounded-2xl p-4` (or `p-5`) |
| **Stat card** | `glass-card rounded-2xl p-3 text-center` |
| **Transaction row** | `glass-card rounded-xl p-3 flex items-center gap-3` |
| **Project card** | `glass-card rounded-2xl p-4 min-w-[150px] flex-shrink-0` |
| **Summary card row** | `rounded-xl border border-border min-w-[72px] p-2` (colored bg via `bg-red-500/10` etc.) |

---

## 14. Utility Classes Reference

```css
/* Tailwind config extended colors */
bg-background, text-foreground, bg-primary, bg-card,
border-border, text-muted-foreground, text-primary

/* Custom utilities */
.glass-card                    /* frosted glass container */
.expense-amount-positive       /* green text for income */
.expense-amount-negative       /* red text for expenses */
.safe-area-bottom              /* safe area inset for mobile */
.scrollbar-hide / .no-scrollbar  /* hide scrollbar */
.font-currency                 /* Inter for currency display */
.tabular-nums                  /* monospaced numbers for amounts */

/* Focus patterns */
focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all

/* Selection pattern */
border-primary bg-primary/10 ring-1 ring-primary/30
```

---

## 15. File Upload Area

```css
/* Empty state */
flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed border-border
hover:border-primary/40 cursor-pointer transition-colors

/* With file */
flex items-center gap-2 p-2 rounded-xl bg-secondary border border-border
```

---

## 16. Skeleton Loading

```tsx
<Skeleton className="h-9 w-40 bg-primary-foreground/20 rounded-lg" />
```

```css
/* Skeleton base */
animate-pulse rounded-md bg-muted
```

Common skeleton patterns:
- Text line: `h-4 w-32 rounded`
- Amount: `h-6 w-20 rounded`
- Icon box: `h-10 w-10 rounded-xl`
- Card: full `glass-card rounded-2xl p-4` with skeleton children

---

## 17. Dark Mode

All tokens defined under `.dark` in `index.css`. Toggled via `next-themes` with `class` strategy. Sonner (toast) reads theme from `next-themes`.

---

## Quick Start: Copy these to your `index.css`

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 150 20% 97%;
    --foreground: 220 25% 12%;
    --card: 0 0% 100%;
    --card-foreground: 220 25% 12%;
    --popover: 0 0% 100%;
    --popover-foreground: 220 25% 12%;
    --primary: 162 63% 41%;
    --primary-foreground: 0 0% 100%;
    --secondary: 150 15% 93%;
    --secondary-foreground: 220 25% 12%;
    --muted: 150 10% 94%;
    --muted-foreground: 220 10% 46%;
    --accent: 38 92% 50%;
    --accent-foreground: 0 0% 100%;
    --destructive: 0 72% 51%;
    --destructive-foreground: 0 0% 100%;
    --border: 150 15% 90%;
    --input: 150 15% 90%;
    --ring: 162 63% 41%;
    --radius: 1rem;
    --success: 152 69% 40%;
    --success-foreground: 0 0% 100%;
    --warning: 38 92% 50%;
    --warning-foreground: 0 0% 100%;
    --expense-income: 152 69% 40%;
    --expense-outcome: 0 72% 51%;
    font-family: 'Inter', sans-serif;
  }
  .dark {
    --background: 220 25% 8%;
    --foreground: 150 10% 95%;
    --card: 220 20% 12%;
    --card-foreground: 150 10% 95%;
    --popover: 220 20% 12%;
    --popover-foreground: 150 10% 95%;
    --primary: 162 63% 41%;
    --primary-foreground: 0 0% 100%;
    --secondary: 220 15% 18%;
    --secondary-foreground: 150 10% 95%;
    --muted: 220 15% 18%;
    --muted-foreground: 220 10% 55%;
    --accent: 38 92% 50%;
    --accent-foreground: 0 0% 100%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 0 0% 100%;
    --border: 220 15% 20%;
    --input: 220 15% 20%;
    --ring: 162 63% 41%;
    --sidebar-background: 240 5.9% 10%;
    --sidebar-foreground: 240 4.8% 95.9%;
    --sidebar-primary: 224.3 76.3% 48%;
    --sidebar-primary-foreground: 0 0% 100%;
    --sidebar-accent: 240 3.7% 15.9%;
    --sidebar-accent-foreground: 240 4.8% 95.9%;
    --sidebar-border: 240 3.7% 15.9%;
    --sidebar-ring: 217.2 91.2% 59.8%;
  }
}

@layer base {
  * { @apply border-border; }
  body { @apply bg-background text-foreground antialiased; }
}

@layer utilities {
  .glass-card {
    @apply bg-card/80 backdrop-blur-xl border border-border/50 shadow-sm;
  }
  .expense-amount-positive {
    color: hsl(var(--expense-income));
  }
  .expense-amount-negative {
    color: hsl(var(--expense-outcome));
  }
  .font-currency {
    font-family: 'Inter', sans-serif;
  }
}
```

And your `tailwind.config.ts` should add the `Inter` font family and the `colors` section with all those HSL variables (see the original `tailwind.config.ts`).
