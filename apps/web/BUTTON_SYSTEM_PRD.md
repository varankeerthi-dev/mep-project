# PRD - Unified Enterprise Button System v2.1 (Final)

**Project:** ERP Design System
**Component:** Button v2.1
**Version:** 2.1 (Final — Frozen)
**Priority:** High
**Risk:** Medium (Incremental Migration)
**Breaking Changes:** None (Backward Compatible)
**Status:** Frozen — No further revisions. Implementation may begin.

---

# 1. Objective

Replace all button implementations across the ERP with a single, reusable, enterprise-grade Button component.

The goal is to establish a consistent design language while maintaining 100% business logic compatibility.

This project does NOT change workflows or functionality.

It only standardizes:

* UI
* Accessibility
* API
* Variants
* Sizes
* Loading behaviour
* Icons
* Focus states
* Design tokens

---

# 2. Existing Problems

Current audit identified:

* Multiple button systems
* Multiple styling approaches
* Duplicate variants
* Duplicate colors
* Duplicate border radius
* Duplicate hover effects
* Raw HTML buttons
* Inline styles
* Poor accessibility in module-specific buttons

The codebase currently contains:

* Shared Button (`components/ui/button.tsx`)
* IconButton (`components/ui/button.tsx`)
* DocumentActionBar buttons (`components/document-editor/DocumentActionBar.tsx`)
* Global CSS buttons (`.btn`, `.btn-primary`, `.btn-secondary`, `.btn-outline`, `.btn-danger`)
* Module-specific buttons (`pl-btn*`, `cnl-*`, `cne-*`, `idp-*`, `iss-*`, `icm-*`, `ptl-*`)
* CSS utility button tokens (`formStyles.ts`: `addButton`, `secondaryButton`, `ghostButton`, `primaryButton`, `deleteIconButton`, `addLink`)
* Hundreds of raw HTML `<button>` elements (175+)

This fragmentation increases maintenance cost and produces inconsistent UX.

---

# 3. Goals

Create ONE enterprise button component used everywhere.

Target:

```
<Button />
```

No other reusable button implementation should exist.

---

# 4. Design Principles

The component must feel:

* Modern
* Minimal
* Enterprise
* Professional
* Calm
* Compact
* Consistent

Avoid consumer-app styling.

Avoid excessive gradients.

Avoid oversized buttons.

---

# 5. Visual Specifications

## Border Radius

6px

```
rounded-md
```

**Critical Note:** The codebase contains a global CSS reset `* { border-radius: 0 !important; }` in `index.css`. Button v2 must include an explicit override:

```css
[data-slot="button"] {
  border-radius: 6px !important;
}
```

This override will be added during Phase 1 implementation.

---

## Height

| Size | Height |
| ---- | ------ |
| xs   | 28px   |
| sm   | 32px   |
| md   | 36px   |
| lg   | 40px   |
| icon | 36px   |

No additional heights allowed.

**Note:** The `xl` (44px) size has been removed. 44px buttons are too large for dense enterprise interfaces and are unlikely to see consistent use.

---

## Typography

Font

```
Inter
```

Weight

```
500
```

Sizes

| Button Size | Font |
| ----------- | ---- |
| xs          | 12   |
| sm          | 13   |
| md          | 14   |
| lg          | 14   |

---

## Horizontal Padding

| Size | Padding |
| ---- | ------- |
| xs   | 10px    |
| sm   | 12px    |
| md   | 16px    |
| lg   | 18px    |

---

## Icon Spacing

```
8px
```

---

## Shadow

Primary

```
shadow-sm
```

Secondary

No shadow

---

## Transition

150ms

Properties

* background
* border
* color
* shadow

---

# 6. Variants

Supported variants

```
primary
secondary
outline
ghost
success
warning
destructive
link
```

---

## Primary

Purpose

Main action

Examples

Save

Create

Submit

Approve

---

## Secondary

Purpose

Alternative action

Examples

Cancel

Back

Close

---

## Outline

Purpose

Utility actions

Examples

Export

Print

Download

Preview

---

## Ghost

Purpose

Toolbar actions

Table actions

Inline actions

---

## Success

Purpose

Approval

Accept

Complete

---

## Warning

Purpose

Retry

Pending

Escalate

---

## Destructive

Purpose

Delete

Reject

Remove

Archive

---

## Link

Purpose

Navigation

---

# 7. Action Hierarchy

Developers must not choose variants arbitrarily. The following UX rules define which variant to use for each action type.

## Variant Selection Rules

| Action Type | Variant | Example | Rule |
| --- | --- | --- | --- |
| Primary action | `primary` | Save | Maximum **1 per action group** unless compelling business reason |
| Secondary action | `secondary` | Cancel | Unlimited |
| Utility action | `outline` | Export, Print, Download | Unlimited |
| Inline action | `ghost` | View, Edit, More | Unlimited |
| Dangerous action | `destructive` | Delete, Remove, Archive | Must trigger confirmation |
| Positive action | `success` | Approve, Accept, Complete | Maximum 1 per action group |
| Attention action | `warning` | Retry, Pending, Escalate | Maximum 1 per action group |
| Navigation | `link` | Learn more, View details | Unlimited |

## Single Primary Rule

There should never be more than one Primary button in the same action group unless there is a compelling business reason.

This dramatically improves UX consistency.

### Action Group Definition

An "action group" is any set of buttons that appear together in:

* A modal footer
* A page action bar
* A form footer
* A card footer
* A table row action set
* A toolbar

### Examples

```tsx
// ✅ CORRECT — One primary per group
<ButtonGroup>
  <Button variant="primary">Save</Button>
  <Button variant="secondary">Cancel</Button>
</ButtonGroup>

// ✅ CORRECT — Primary + utility
<ButtonGroup>
  <Button variant="primary">Submit</Button>
  <Button variant="outline">Save as Draft</Button>
  <Button variant="secondary">Cancel</Button>
</ButtonGroup>

// ❌ WRONG — Two primaries
<ButtonGroup>
  <Button variant="primary">Save</Button>
  <Button variant="primary">Submit</Button>
</ButtonGroup>
```

---

# 8. States

Every variant must support

Default

Hover

Active

Focus

Disabled

Loading

---

## Hover

Subtle background adjustment

Never jump

Never scale

---

## Active

Small press animation

```css
transform: translateY(1px);
```

---

## Disabled

Opacity

50%

Pointer events disabled

```css
pointer-events: none;
```

---

## Loading

### Spinner Placement

The spinner replaces the **left icon** position. If no left icon is present, the spinner appears at the start of the button content.

### Loading Text

When `loadingText` is provided, it replaces the `children` content. When `loadingText` is not provided, the original `children` content remains visible.

### Width Preservation

The button must preserve its original width during the loading state to prevent layout shift. Implementation:

```css
min-width: <computed from original content width>;
```

The button calculates its natural width before entering the loading state and applies it as `min-width` during loading.

### Disabled Behaviour

While loading:

* The button is visually disabled (opacity 50%)
* `pointer-events: none` prevents click
* `aria-disabled="true"` is set
* `aria-busy="true"` is set

### Interaction Locking

* Click events are not fired during loading
* Keyboard navigation is blocked (Tab still works, Enter/Space are ignored)
* Focus ring is suppressed during loading

### Icon Replacement Behaviour

| State | Left Icon | Content | Right Icon |
| --- | --- | --- | --- |
| Default | Shows `leftIcon` | Shows `children` | Shows `rightIcon` |
| Loading (with loadingText) | Spinner | Shows `loadingText` | Hidden |
| Loading (without loadingText) | Spinner | Shows `children` | Hidden |

### Loading UX Flow

Buttons should provide consistent feedback through the loading lifecycle:

| State | Display | Example |
| --- | --- | --- |
| Default | Button text | `Save` |
| Clicked (loading begins) | Spinner + loading text | `Saving...` |
| Processing | Spinner + loading text (continues) | `Saving...` |
| Success (optional) | Checkmark + success text | `Saved` |
| Return to default | Button text (after delay) | `Save` |

The success state is optional. If not implemented, the button returns to default state after the async operation completes.

---

# 9. Sizes

```
xs
sm
md
lg
icon
icon-xs    (deprecated)
icon-sm    (deprecated)
icon-lg    (deprecated)
```

## Deprecated Sizes

The following sizes are deprecated but remain supported during the migration period:

| Size | Status | Action |
| --- | --- | --- |
| `icon-xs` | Deprecated | Use `size="icon"` with appropriate className |
| `icon-sm` | Deprecated | Use `size="icon"` with appropriate className |
| `icon-lg` | Deprecated | Use `size="icon"` with appropriate className |

These sizes will be:

* Maintained in code during migration
* Hidden from documentation
* Removed in a future major version (v3)

---

# 10. Icons

Support

Left icon

Right icon

Icon-only

Loading icon

SVG

Heroicons

Lucide

---

Icon spacing must remain identical across all sizes.

---

## Standard Icons

To create visual consistency, the following icons are the approved set for button actions. Developers should use these before introducing custom icons.

| Action | Icon | Source |
| --- | --- | --- |
| Save | `Save` | Lucide |
| Add / Create | `Plus` | Lucide |
| Delete / Remove | `Trash2` | Lucide |
| Edit | `Pencil` | Lucide |
| Download | `Download` | Lucide |
| Upload | `Upload` | Lucide |
| Search | `Search` | Lucide |
| Filter | `Filter` | Lucide |
| Settings | `Settings` | Lucide |
| Refresh | `RefreshCw` | Lucide |
| Print | `Printer` | Lucide |
| PDF | `FileText` | Lucide |
| Excel | `FileSpreadsheet` | Lucide |
| Chevron (directional) | `ChevronDown`, `ChevronUp`, `ChevronLeft`, `ChevronRight` | Lucide |
| Arrow (directional) | `ArrowLeft`, `ArrowRight` | Lucide |
| Check / Confirm | `Check` | Lucide |
| Close / Cancel | `X` | Lucide |
| Eye / View | `Eye` | Lucide |
| Copy | `Copy` | Lucide |
| Send | `Send` | Lucide |
| Mail / Email | `Mail` | Lucide |

### Rules

* Use Lucide icons as the primary icon library
* Only deviate from this list with team lead approval
* Icon size within buttons is always 16px (matching `size-4`)
* Icon-only buttons must have `aria-label`

---

# 11. Long Text Behaviour

Enterprise applications have long action labels (e.g., "Generate Client Purchase Order") rather than short labels (e.g., "OK").

## Text Wrapping Policy

| Property | Value |
| --- | --- |
| White space | `nowrap` |
| Text overflow | `ellipsis` |
| Wrapping | None — single line only |
| Minimum width | Set by size padding (10px–18px per side) |
| Maximum width | None by default; constrained by parent container |

## Rules

* Button text never wraps to multiple lines
* If text overflows the button width, it is truncated with ellipsis
* The full text is accessible via the `title` attribute (native browser tooltip)
* Developers must not manually truncate text — the button handles it

## Examples

```tsx
// Text fits — no truncation
<Button>Save</Button>

// Text is long — truncated with ellipsis
<Button>Generate Client Purchase Order</Button>
// Renders as: "Generate Client Purchase Ord..."

// Full text accessible via hover
// <button title="Generate Client Purchase Order">
```

---

# 12. API

```typescript
interface ButtonProps {
  // Variant
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'success' | 'warning' | 'destructive' | 'link';

  // Size
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'icon' | 'icon-xs' | 'icon-sm' | 'icon-lg';

  // Loading
  loading?: boolean;
  loadingText?: string;

  // Icons
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;

  // Layout
  fullWidth?: boolean;

  // Accessibility
  'aria-label'?: string;
  'aria-disabled'?: boolean;
  'aria-busy'?: boolean;

  // HTML
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;

  // Composition
  asChild?: boolean;

  // Analytics
  analyticsId?: string;
}
```

### Prohibited

* No `style` prop (use `className`)
* No inline style overrides
* No tooltip prop (use composition — see Section 20)
* No `selected` state (use ToggleButton component in future)

---

# 13. Accessibility

Support

Keyboard navigation

Tab

Enter

Space

Focus-visible ring

Disabled

aria-label

aria-disabled

aria-busy

Icon-only buttons must require aria-label.

---

## Focus-visible Ring

```css
:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}
```

---

## Screen Reader Support

| Prop | Screen Reader Behaviour |
| --- | --- |
| `aria-label` | Announces button purpose |
| `aria-disabled="true"` | Announces "disabled" |
| `aria-busy="true"` | Announces "busy, please wait" |
| `loading` (auto) | Sets `aria-busy="true"` automatically |
| `disabled` (auto) | Sets `aria-disabled="true"` automatically |

---

# 14. Design Tokens

Button v2 must use the existing Shadcn/CVA semantic token system.

No new token system is introduced.

### Token Mapping

| Button Usage | Token |
| --- | --- |
| Primary background | `bg-primary` |
| Primary text | `text-primary-foreground` |
| Primary hover | `hover:bg-primary/80` |
| Secondary background | `bg-secondary` |
| Secondary text | `text-secondary-foreground` |
| Secondary hover | `hover:bg-secondary/80` |
| Border | `border-border` |
| Muted background | `bg-muted` |
| Muted text | `text-muted-foreground` |
| Foreground text | `text-foreground` |
| Destructive background | `bg-destructive` |
| Destructive text | `text-destructive-foreground` |
| Focus ring | `ring-ring` |
| Focus ring offset | `ring-offset-background` |

### Hardcoded Colors

No hardcoded colors are allowed in the Button component.

All colors must reference CSS custom properties or Tailwind semantic tokens.

### Dark Mode

Button v2 inherits dark mode support from the existing token system.

No dark mode redesign is required.

Dark mode tokens are defined in `:root` and `.dark` selectors in `index.css`.

Button v2 will automatically support dark mode through:

* `dark:` Tailwind variants on base classes
* CSS custom property inheritance
* Existing `--primary`, `--secondary`, `--destructive` token system

---

# 15. Mobile Behaviour

The ERP has a mobile application. Button v2 must handle mobile layouts predictably.

## Toolbar Buttons

On mobile, toolbar buttons collapse into icon-only buttons.

| Desktop | Mobile |
| --- | --- |
| `<Button leftIcon={<Download />}>Export</Button>` | `<Button size="icon" aria-label="Export"><Download /></Button>` |

## Footer Actions

On mobile, footer action bars stack vertically with full-width buttons.

| Desktop | Mobile |
| --- | --- |
| Horizontal `ButtonGroup` | Vertical stack, each button `fullWidth` |

```css
@media (max-width: 640px) {
  .button-group-footer {
    flex-direction: column;
    width: 100%;
  }
  .button-group-footer > button {
    width: 100%;
  }
}
```

## ButtonGroup

On mobile, `ButtonGroup` switches to vertical layout.

| Desktop | Mobile |
| --- | --- |
| Horizontal row | Vertical column |

```css
@media (max-width: 640px) {
  .button-group {
    flex-direction: column;
    width: 100%;
  }
}
```

## Rules

* Every developer must not invent custom mobile button layouts
* The `ButtonGroup` component handles responsive stacking automatically
* Footer action bars must use `ButtonGroup` with `responsive="stack"`
* Icon-only buttons on mobile must always have `aria-label`

---

# 16. Permission Behaviour

This is ERP-specific. Users may lack permission for certain actions.

## Rule

If an action is unavailable due to permissions:

| Behaviour | Implementation |
| --- | --- |
| Button stays visible | ✅ Always |
| Button is disabled | ✅ Always |
| Tooltip explains why | ✅ Always |
| Button disappears | ❌ Never |

**Never silently hide buttons.** Disabled buttons with explanatory tooltips improve discoverability.

## Implementation Pattern

```tsx
<Button
  variant="primary"
  disabled={!hasPermission('projects:write')}
  title={!hasPermission('projects:write') ? 'You need write permission to save projects' : undefined}
>
  Save
</Button>
```

## Rules

* Buttons are disabled, not hidden, when permission is lacking
* The `title` attribute provides a tooltip explaining the reason
* Screen readers announce "disabled" via `aria-disabled="true"`
* This applies to all variants, not just primary

---

# 17. Async Safety

Buttons must prevent duplicate API calls when users click rapidly.

## Rules

* Ignore duplicate clicks while `loading` is true
* Prevent multiple simultaneous API calls from a single button
* The `loading` prop must be set by the consumer — Button does not manage async state internally

## Implementation Pattern

```tsx
const [saving, setSaving] = useState(false);

const handleSave = async () => {
  if (saving) return; // Guard against duplicate calls
  setSaving(true);
  try {
    await saveProject(data);
  } finally {
    setSaving(false);
  }
};

<Button
  variant="primary"
  loading={saving}
  loadingText="Saving..."
  onClick={handleSave}
>
  Save
</Button>
```

## Button-Level Guarantee

Even if the consumer does not implement the guard, Button's `loading` state prevents additional clicks via:

* `pointer-events: none`
* `aria-disabled="true"`
* Click handler is not fired while `loading` is true

---

# 18. Destructive Confirmation

Destructive buttons must always open a confirmation dialog unless explicitly waived.

## Rule

| Action | Behaviour |
| --- | --- |
| Destructive button clicked | Open confirmation dialog |
| Confirmation confirmed | Execute action |
| Confirmation cancelled | Do nothing |
| Waiver required | Explicit `data-confirm-waived` attribute or team lead approval |

## Standard Confirmation Pattern

```tsx
const handleDelete = () => {
  // Open confirmation dialog, not execute directly
  setConfirmDialog({ type: 'delete', itemId: item.id });
};

<Button
  variant="destructive"
  leftIcon={<Trash2 />}
  onClick={handleDelete}
>
  Delete
</Button>
```

## Rules

* Destructive buttons never execute immediately
* The confirmation dialog must clearly state what will be deleted
* The confirmation button within the dialog uses `variant="destructive"`
* The cancel button within the dialog uses `variant="secondary"`
* This prevents accidental data loss in enterprise environments

---

# 19. Analytics Hook

Button v2 supports an `analyticsId` prop for future analytics integration.

## Purpose

Future-proof the button system for analytics tools (Mixpanel, PostHog, Google Analytics, etc.) without requiring refactoring.

## API

```tsx
<Button
  variant="primary"
  analyticsId="save-project"
  onClick={handleSave}
>
  Save
</Button>
```

## Implementation

* `analyticsId` is passed as a `data-analytics-id` attribute to the underlying `<button>` element
* No analytics library is bundled with Button v2
* Analytics integration is handled at the application layer via event delegation or a custom hook
* This ensures no refactoring is required when analytics tools change

## Rules

* Every interactive button should have an `analyticsId`
* Format: `{action}-{entity}` (e.g., `save-project`, `delete-client`, `export-invoice`)
* The `analyticsId` prop is optional — buttons without it still function normally

---

# 20. Composition Patterns

## Tooltip

Do NOT place tooltip functionality inside Button.

Use composition:

```tsx
<Tooltip content="Save document">
  <Button variant="primary" leftIcon={<SaveIcon />}>
    Save
  </Button>
</Tooltip>
```

The Tooltip component wraps the Button. Button remains unaware of tooltips.

---

## ButtonGroup

### Purpose

ButtonGroup provides a standard layout mechanism for grouping related buttons.

### Use Cases

* Save / Cancel
* Approve / Reject
* Export / Print / PDF
* Horizontal action bars
* Vertical button stacks
* Toolbar actions

### API

```typescript
interface ButtonGroupProps {
  // Layout direction
  direction?: 'horizontal' | 'vertical';

  // Responsive behaviour
  responsive?: 'stack' | 'wrap' | 'none';

  // Equal width
  equalWidth?: boolean;

  // Spacing
  gap?: 'none' | 'xs' | 'sm' | 'md';

  // Children
  children: React.ReactNode;

  // Styling
  className?: string;
}
```

### Visual Spec

| Property | Value |
| --- | --- |
| Gap (horizontal) | 0px (borders merge) |
| Gap (vertical) | 0px (borders merge) |
| Border | Shared border between adjacent buttons |
| Border radius | Only on first/last button |
| Overflow | `hidden` on group container |

### First/Last Border Radius

```
First button:  border-radius: 6px 0 0 6px
Middle button: border-radius: 0
Last button:   border-radius: 0 6px 6px 0
```

Vertical:

```
First button:  border-radius: 6px 6px 0 0
Middle button: border-radius: 0
Last button:   border-radius: 0 0 6px 6px
```

### Responsive Stacking

When `responsive="stack"`:

```css
@media (max-width: 640px) {
  flex-direction: column;
  width: 100%;
}
```

### Examples

```tsx
// Horizontal group
<ButtonGroup>
  <Button variant="primary">Save</Button>
  <Button variant="secondary">Cancel</Button>
</ButtonGroup>

// Approve/Reject
<ButtonGroup>
  <Button variant="success" leftIcon={<CheckIcon />}>Approve</Button>
  <Button variant="destructive" leftIcon={<XIcon />}>Reject</Button>
</ButtonGroup>

// Export toolbar
<ButtonGroup gap="sm">
  <Button variant="outline" leftIcon={<DownloadIcon />}>Export</Button>
  <Button variant="outline" leftIcon={<PrinterIcon />}>Print</Button>
  <Button variant="outline" leftIcon={<FileIcon />}>PDF</Button>
</ButtonGroup>

// Equal width responsive
<ButtonGroup equalWidth responsive="stack">
  <Button variant="primary">Save</Button>
  <Button variant="secondary">Cancel</Button>
</ButtonGroup>
```

---

# 21. Design Documentation

Every variant, state, and size must be documented in a component showcase (Storybook or equivalent).

## Required Pages

| Page | Content |
| --- | --- |
| Primary | All sizes, all states |
| Secondary | All sizes, all states |
| Outline | All sizes, all states |
| Ghost | All sizes, all states |
| Success | All sizes, all states |
| Warning | All sizes, all states |
| Destructive | All sizes, all states |
| Link | All sizes |
| Disabled | All variants |
| Loading | All variants, with and without `loadingText` |
| Icon | Left icon, right icon, icon-only |
| ButtonGroup | Horizontal, vertical, responsive, equal-width |
| Toolbar | Grouped toolbar actions |
| Overflow | Long text truncation |
| Mobile | Responsive stacking |
| Dark | Dark mode rendering |

## Purpose

* Every screenshot becomes documentation
* Visual regression baseline
* Design review reference
* Onboarding resource for new developers

---

# 22. Migration Strategy

## Phase 0: Global CSS Reset Investigation

Before any implementation begins, investigate the global CSS reset:

```css
* {
  border-radius: 0 !important;
}
```

### Investigation Tasks

1. **Why does it exist?**
   - Search git history for the commit that introduced this rule
   - Identify the original problem it solved
   - Document the rationale

2. **What depends on it?**
   - Identify all components that rely on `border-radius: 0`
   - Test removing the rule in a development branch
   - Catalogue visual regressions

3. **Can it be removed safely?**
   - If removing causes < 5 regressions, remove it entirely
   - If removing causes 5-20 regressions, convert to scoped overrides
   - If removing causes > 20 regressions, keep it and add explicit overrides

4. **Scoped override strategy**
   - Add `[data-slot="button"] { border-radius: 6px !important; }` to `index.css`
   - Add similar overrides for other components as needed during their migration
   - Document the override pattern for future component migrations

### Deliverable

A written decision: remove, keep with overrides, or partial removal.

This decision must be recorded before Phase 1 begins.

---

## Phase 1: Upgrade Existing Shared Button Component

Upgrade the existing shared Button component in `components/ui/button.tsx`.

Do not replace it.

Maintain compatibility.

### Actions

* Update CVA variants to match v2.1 visual spec
* Update size tokens to match v2.1 height/padding spec
* Add `loading`, `loadingText`, `leftIcon`, `rightIcon`, `fullWidth` props
* Add `aria-busy`, `aria-disabled` auto-assignment
* Add `min-width` preservation during loading
* Add `[data-slot="button"]` border-radius override to `index.css`
* Update `buttonVariants` to use `rounded-md` instead of `rounded-4xl`
* Keep existing `Button` and `IconButton` exports

### Backward Compatibility

* All existing `<Button />` usages continue to work
* Default variant remains `default` (maps to `primary`)
* Default size remains `default` (maps to `md`)
* No prop renames or removals

---

## Phase 2: Add New Props and Variants

Add the following to the upgraded Button:

* `success` variant
* `warning` variant
* `loadingText` prop
* `leftIcon` prop
* `rightIcon` prop
* `fullWidth` prop
* `asChild` prop (implementation-agnostic)
* `analyticsId` prop

---

## Phase 3: Convert DocumentActionBar Buttons

Convert `DocumentActionBar` buttons into wrappers around Button.

### Mapping

| Old Component | New Usage |
| --- | --- |
| `PrimaryButton` | `<Button variant="primary">` |
| `SecondaryButton` | `<Button variant="secondary">` |
| `GhostButton` | `<Button variant="ghost">` |
| `ImportButton` | `<Button variant="outline" leftIcon={<Upload />}>` |

### Backward Compatibility

* `PrimaryButton`, `SecondaryButton`, `GhostButton`, `ImportButton` become thin wrappers
* They remain exported for existing consumers
* No breaking changes
* Wrappers are marked `@deprecated` in JSDoc

---

## Phase 4: Replace Global CSS Buttons

Replace global `.btn` class usages with Button component.

### Files Affected

~60 files using `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-outline`, `.btn-danger`

### Actions

* Replace `<button className="btn btn-primary">` with `<Button variant="primary">`
* Replace `<button className="btn btn-secondary">` with `<Button variant="secondary">`
* Replace `<button className="btn btn-outline">` with `<Button variant="outline">`
* Replace `<button className="btn btn-danger">` with `<Button variant="destructive">`
* Replace `<button className="btn btn-sm">` with `<Button size="sm">`
* Remove `.btn-*` classes from `index.css` after all replacements

---

## Phase 5: Replace Module-Specific Buttons

Replace module-specific CSS buttons with Button component.

### Modules

| Module | CSS Prefix | Files Affected |
| --- | --- | --- |
| Projects | `pl-btn*` | ~40 usages |
| Credit Notes (List) | `cnl-*` | ~8 usages |
| Credit Notes (Editor) | `cne-*` | ~3 usages |
| Issue Detail | `idp-*` | ~10 usages |
| Issue Dashboard | `iss-*` | ~4 usages |
| Issue Create Modal | `icm-*` | ~2 usages |
| Project Task List | `ptl-*` | ~8 usages |
| Materials (formStyles) | `addButton`, `secondaryButton`, etc. | ~10 usages |

### Actions

* Replace each module-specific button with `<Button>` using appropriate variant/size
* Remove inline `<style>` blocks defining button CSS
* Remove `formStyles.ts` button token exports
* Update imports in each file

---

## Phase 6: Replace Raw HTML Buttons

Replace raw HTML `<button>` elements with Button component.

### Scope

~175+ raw `<button>` elements across the codebase.

### Priority Order

1. User-facing pages (highest visibility)
2. Modal/dialog buttons
3. Table action buttons
4. Form submit buttons
5. Utility/icon buttons

### Rules

* Every new button must use `<Button>`
* No `<button>` element should be added without justification
* Exceptions: form elements that must be native `<button type="submit">` for HTML semantics — these should still use `<Button type="submit">`

---

## Phase 7: Delete Dead Code

Delete all redundant button implementations.

### Delete

* Global `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-outline`, `.btn-danger` CSS classes
* Module-specific button CSS (`pl-btn*`, `cnl-*`, `cne-*`, `idp-*`, `iss-*`, `icm-*`, `ptl-*`)
* Inline button `<style>` blocks in component files
* `formStyles.ts` button token exports (`addButton`, `secondaryButton`, `ghostButton`, `primaryButton`, `deleteIconButton`, `addLink`)
* `DocumentActionBar` button helper components (after Phase 3 wrappers are stable)

### Do NOT Delete Yet

* `IconButton` export (deprecated, kept for backward compatibility)
* `icon-xs`, `icon-sm`, `icon-lg` sizes (deprecated, kept during migration)

---

# 23. IconButton Migration

## Current State

`IconButton` is a separate component in `components/ui/button.tsx` that wraps `Button` with icon-first rendering.

## Target State

`IconButton` becomes a **compatibility wrapper** around `Button`.

```typescript
// IconButton becomes:
function IconButton({ icon, children, ...props }) {
  return <Button size="icon" {...props}>{icon}{children}</Button>;
}
```

## Migration

| Step | Action |
| --- | --- |
| Phase 1 | Update `IconButton` to delegate to `Button` internally |
| Phase 2 | Mark `IconButton` as `@deprecated` |
| Phase 3 | Update all `IconButton` usages to use `<Button size="icon">` |
| Phase 4 | Remove `IconButton` export (future major version) |

## Rules

* Do not remove `IconButton` immediately
* Do not break existing `IconButton` consumers
* All new code must use `<Button size="icon">` instead of `<IconButton>`

---

# 24. Engineering Rules

DO NOT

Create another button component.

Use inline styles.

Hardcode colors.

Hardcode heights.

Create module-specific variants.

Create page-specific buttons.

Duplicate hover styles.

Choose variant arbitrarily (follow Action Hierarchy).

DO

Use `<Button>` for all button needs.

Use semantic tokens only.

Use `className` for customization.

Use composition for complex patterns.

Follow the Action Hierarchy rules.

---

# 25. Testing Strategy

## Storybook Stories

Create Storybook stories covering:

* All 8 variants × 8 sizes = 64 combinations
* All states (default, hover, active, focus, disabled, loading)
* Icon positions (left, right, icon-only)
* Loading with and without `loadingText`
* `fullWidth` mode
* `asChild` rendering
* ButtonGroup (horizontal, vertical, responsive, equal-width)
* Mobile responsive behaviour
* Dark mode rendering

## Accessibility Testing

* Run axe-core audit on every variant
* Verify focus-visible ring on all variants
* Verify `aria-disabled` and `aria-busy` propagation
* Verify screen reader announcements for loading state
* Verify keyboard navigation (Tab, Enter, Space)
* Verify icon-only buttons have `aria-label`

## Visual Regression Testing

* Capture screenshots of all variant × size × state combinations
* Store as baseline in visual regression tool (Chromatic, Percy, or similar)
* Run on every PR to detect unintended visual changes

## Unit Tests

* Test variant rendering (correct classes applied)
* Test size rendering (correct height/padding)
* Test loading state (spinner appears, interaction locked)
* Test `loadingText` replacement
* Test `min-width` preservation during loading
* Test `asChild` rendering
* Test `leftIcon` / `rightIcon` placement
* Test `fullWidth` behaviour
* Test disabled state (no click fired)
* Test `aria-*` attribute propagation
* Test `analyticsId` attribute rendering
* Test long text truncation (ellipsis)

## Snapshot Tests

* Snapshot all variant × size combinations
* Update snapshots only when visual changes are intentional

## Migration Verification Checklist

After each migration phase:

| Check | Status |
| --- | --- |
| All tests pass | |
| No TypeScript errors | |
| No console warnings | |
| Visual regression baseline matches | |
| Accessibility audit passes | |
| All existing functionality preserved | |
| No new inline styles introduced | |
| No new hardcoded colors | |
| Documentation updated | |

---

# 26. Success Criteria

After migration

There should be

ONE

Button component.

All ERP modules must use it.

Every button must look visually consistent.

Every interaction must feel identical.

Every button must support accessibility.

Every future feature must extend Button instead of creating a new implementation.

This Button component becomes the foundation of the ERP Design System and is the only approved button implementation for the project.

---

# Appendix A: Migration File Count Summary

| Phase | Files Affected | Estimated Effort |
| --- | --- | --- |
| Phase 0 | 0 (investigation only) | 2-4 hours |
| Phase 1 | 2 | 3-4 hours |
| Phase 2 | 1 | 2-3 hours |
| Phase 3 | 3-5 | 2-3 hours |
| Phase 4 | ~60 | 1-2 days |
| Phase 5 | ~12 | 2-3 days |
| Phase 6 | ~175 | 5-7 days |
| Phase 7 | ~10 | 1 day |
| **Total** | **~220+** | **~2-3 weeks** |

---

# Appendix B: Backward Compatibility Checklist

| Component/Export | Status | Action |
| --- | --- | --- |
| `Button` | Maintained | Upgraded in-place |
| `IconButton` | Deprecated | Wrapper around Button, removed in v3 |
| `buttonVariants` | Maintained | Updated CVA config |
| `PrimaryButton` | Deprecated | Becomes `<Button variant="primary">` |
| `SecondaryButton` | Deprecated | Becomes `<Button variant="secondary">` |
| `GhostButton` | Deprecated | Becomes `<Button variant="ghost">` |
| `ImportButton` | Deprecated | Becomes `<Button variant="outline">` |
| `TabButton` | Separate | Not part of this migration (tab component) |
| `PDFExportButton` | Separate | Not part of this migration (report component) |
| `ProGridInvoiceButton` | Separate | Not part of this migration (invoice component) |
| `.btn` CSS class | Removed | Phase 7 |
| `.btn-primary` CSS class | Removed | Phase 7 |
| `.btn-secondary` CSS class | Removed | Phase 7 |
| `.btn-outline` CSS class | Removed | Phase 7 |
| `.btn-danger` CSS class | Removed | Phase 7 |
| `icon-xs` size | Deprecated | Removed in v3 |
| `icon-sm` size | Deprecated | Removed in v3 |
| `icon-lg` size | Deprecated | Removed in v3 |

---

# Appendix C: Recommended Component Build Order

After Button is complete, build the foundation layer in this order:

1. **Button** ← Current
2. **Input**
3. **Select / Combobox**
4. **Table**
5. **Dialog**
6. **Badge**
7. **Card**
8. **Tabs**
9. **Form Field**
10. **Toolbar**

These ten components will cover the vast majority of the ERP's UI, making every module — from Quotations and Inventory to HR and Projects — feel like one cohesive enterprise application.

---

# Appendix D: Glossary

| Term | Definition |
| --- | --- |
| CVA | Class Variance Authority — library for managing variant-based styling |
| Semantic Token | A CSS custom property that represents a design meaning (e.g., `--primary`) rather than a raw value |
| asChild | A pattern where a component renders its behavior onto a child element instead of its own element |
| ButtonGroup | A layout component that groups related buttons with shared borders and spacing |
| Loading State | A button state where the button is processing an action and should not be interacted with |
| Action Hierarchy | A set of UX rules that define which variant to use for each action type |
| Async Safety | Guards against duplicate API calls from rapid button clicks |
| Analytics Hook | A prop-based pattern for integrating analytics without bundling analytics libraries |
