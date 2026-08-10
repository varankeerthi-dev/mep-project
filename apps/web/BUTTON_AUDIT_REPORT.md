# Button Component Audit Report

> Generated: August 3, 2026
> Scope: `apps/web/src/`

---

## 1. Button Components

### 1.1 Shared `Button` (Primary)

| Attribute | Value |
|---|---|
| **File Path** | `apps/web/src/components/ui/button.tsx` |
| **Component Name** | `Button` |
| **Total Lines** | 80 |
| **Export Type** | Named export |
| **Props Interface** | `ButtonPrimitive.Props & VariantProps<typeof buttonVariants>` |
| **Base Component** | `@base-ui/react/button` (`ButtonPrimitive`) |
| **Dependencies** | `class-variance-authority`, `@/lib/utils` (cn) |
| **Styling Approach** | CVA (class-variance-authority) + Tailwind CSS |

### 1.2 Shared `IconButton`

| Attribute | Value |
|---|---|
| **File Path** | `apps/web/src/components/ui/button.tsx` |
| **Component Name** | `IconButton` |
| **Total Lines** | 20 |
| **Export Type** | Named export |
| **Props Interface** | `ButtonPrimitive.Props & VariantProps<typeof buttonVariants> & { icon?: React.ReactNode }` |
| **Dependencies** | Same as `Button` |
| **Styling Approach** | CVA + Tailwind CSS |

### 1.3 DocumentActionBar Buttons

| Attribute | Value |
|---|---|
| **File Path** | `apps/web/src/components/document-editor/DocumentActionBar.tsx` |
| **Components** | `PrimaryButton`, `SecondaryButton`, `GhostButton`, `ImportButton` |
| **Total Lines** | ~120 (button helpers) |
| **Export Type** | Named exports |
| **Props Interface** | `BtnProps { onClick, disabled?, children, style?, type? }` |
| **Dependencies** | None (pure React) |
| **Styling Approach** | Inline `React.CSSProperties` with `onMouseEnter`/`onMouseLeave` handlers |

### 1.4 TabButton

| Attribute | Value |
|---|---|
| **File Path** | `apps/web/src/features/materials/shared/TabButton.tsx` |
| **Component Name** | `TabButton` |
| **Total Lines** | 20 |
| **Export Type** | Named export |
| **Props Interface** | `TabButtonProps { active: boolean; onClick: () => void; children: React.ReactNode }` |
| **Dependencies** | `cn` utility |
| **Styling Approach** | Tailwind CSS via `cn()` |

### 1.5 PDFExportButton

| Attribute | Value |
|---|---|
| **File Path** | `apps/web/src/components/reports/PDFExportButton.tsx` |
| **Component Name** | `PDFExportButton` (default export) |
| **Total Lines** | 247 |
| **Export Type** | Default export |
| **Props Interface** | `PDFExportButtonProps { reportData, reportContent?, reportType?, disabled?, className?, size?, variant? }` |
| **Dependencies** | `@heroicons/react`, `usePDFGeneration` hook |
| **Styling Approach** | Template literal Tailwind classes |

### 1.6 ProGridInvoiceButton / ProGridInvoicePreview

| Attribute | Value |
|---|---|
| **File Path** | `apps/web/src/invoices/pro-grid-invoice-button.tsx` |
| **Components** | `ProGridInvoiceButton`, `ProGridInvoicePreview` |
| **Total Lines** | 100 |
| **Export Type** | Named exports |
| **Props Interface** | `ProGridInvoiceButtonProps { invoice, organisation, client, variant?, label?, showLabel? }` |
| **Dependencies** | `@react-pdf/renderer`, shared `Button` |
| **Styling Approach** | Wraps shared `Button` component |

### 1.7 CSS Class-Based Button Styles (Global)

| Attribute | Value |
|---|---|
| **File Path** | `apps/web/src/index.css` |
| **Components** | `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-outline`, `.btn-danger`, `.btn-close`, `.btn-delete`, `.btn-sm` |
| **Total Lines** | ~50 (in CSS) |
| **Styling Approach** | Vanilla CSS |

### 1.8 CSS Utility Button Tokens (Materials Module)

| Attribute | Value |
|---|---|
| **File Path** | `apps/web/src/features/materials/components/editor/formStyles.ts` |
| **Components** | `addButton`, `addLink`, `secondaryButton`, `ghostButton`, `primaryButton`, `deleteIconButton` |
| **Total Lines** | ~20 |
| **Export Type** | Named exports (string constants) |
| **Styling Approach** | Tailwind CSS class strings |

### 1.9 Module-Specific Inline CSS Button Styles

| Module | CSS Class Prefix | File Location |
|---|---|---|
| Credit Notes (List) | `cnl-*` | `credit-notes/pages/CreditNoteListPage.tsx` (inline `<style>`) |
| Credit Notes (Editor) | `cne-*` | `credit-notes/pages/CreditNoteEditorPage.tsx` (inline `<style>`) |
| Issue Detail | `idp-*` | `issues/pages/IssueDetailPage.tsx` (inline `<style>`) |
| Issue Dashboard | `iss-*` | `issues/pages/IssueDashboard.tsx` (inline `<style>`) |
| Issue Create Modal | `icm-*` | `issues/pages/IssueCreateModal.tsx` (inline `<style>`) |
| Project Task List | `ptl-*` | `components/tasks/ProjectTaskListView.tsx` (inline `<style>`) |
| Projects | `pl-btn*` | `apps/web/src/index.css` (lines 3216-3260) |

---

## 2. Usage Analysis

### 2.1 Shared `Button` Component

**Total Import Count:** ~80 files

**Top 20 Files Using It:**

| # | File | Module |
|---|---|---|
| 1 | `pages/ClientCommunication.tsx` | CRM |
| 2 | `modules/Purchase/components/PaymentsHub.tsx` | Purchase |
| 3 | `modules/Purchase/components/DebitNotes.tsx` | Purchase |
| 4 | `modules/Purchase/components/Bills.tsx` | Purchase |
| 5 | `modules/Purchase/components/PurchaseOrders.tsx` | Purchase |
| 6 | `modules/Purchase/components/PaymentQueue.tsx` | Purchase |
| 7 | `modules/Purchase/components/VendorLedgerDialog.tsx` | Purchase |
| 8 | `modules/Purchase/components/AccountantQueue.tsx` | Purchase |
| 9 | `features/materials/components/toolbar/ItemsToolbar.tsx` | Inventory |
| 10 | `features/materials/settings/UnitTab.tsx` | Inventory |
| 11 | `features/materials/settings/WarehouseTab.tsx` | Inventory |
| 12 | `features/materials/settings/VariantsTab.tsx` | Inventory |
| 13 | `features/materials/settings/CategoryTab.tsx` | Inventory |
| 14 | `features/materials/components/editor/ItemEditorDialog.tsx` | Inventory |
| 15 | `pages/OrganizationManagement.tsx` | Settings |
| 16 | `pages/Approvals.tsx` | Approvals |
| 17 | `pages/FollowUpCentre.tsx` | CRM |
| 18 | `ledger/LedgerDashboard.tsx` | Finance |
| 19 | `components/ui/table/data-table-pagination.tsx` | Shared |
| 20 | `components/ui/dialog.tsx` | Shared |

**Modules Using It:** Quotation, Purchase, Inventory, HR, CRM, Settings, Approvals, Finance, Tasks, Sales, Reports, Manufacturing

### 2.2 DocumentActionBar Buttons

**Total Import Count:** ~5 files

| File | Module |
|---|---|
| `proforma-invoices/pages/ProformaEditorPage.tsx` | Proforma |
| (Used in quotation creation pages) | Quotation |
| (Used in DC creation pages) | DC |
| (Used in invoice creation pages) | Invoice |
| (Used in credit note creation pages) | Credit Notes |

### 2.3 Direct HTML `<button>` Usage

**Total Count:** **175+** raw `<button>` elements found

**Top Offending Files:**

| File | Approx. Count | Module |
|---|---|---|
| `AiDocumentParserModal.tsx` | 12 | Document Parser |
| `AttendancePage.tsx` | 12 | Subcontractor V2 |
| `LedgerDashboard.tsx` | 14 | Finance |
| `SubcontractorWorkOrderCreate.tsx` | 10 | Subcontractor V2 |
| `CreditNoteViewPage.tsx` | 10 | Credit Notes |
| `WorkOrdersTab.tsx` | 9 | Subcontractor V2 |
| `BOQFormPage.tsx` | 12 | Estimation |
| `InvoiceListPage.tsx` | 11 | Invoice |
| `BulkImportModal.tsx` | 9 | Materials |
| `ProjectListV2.tsx` | 10 | Projects |
| `App.tsx` | 5 | Shell |
| `DashboardView.tsx` | 7 | Subcontractor V2 |

### 2.4 Module-Specific CSS Button Usages

| CSS Pattern | Approx. Usage Count | Module |
|---|---|---|
| `.btn .btn-primary` / `.btn .btn-secondary` | ~60+ | Global / Materials |
| `.pl-btn` / `.pl-btn-primary` | ~40+ | Projects |
| `.cnl-*` | ~8 | Credit Notes (List) |
| `.cne-*` | ~3 | Credit Notes (Editor) |
| `.idp-*` | ~10 | Issues (Detail) |
| `.iss-*` | ~4 | Issues (Dashboard) |
| `.icm-*` | ~2 | Issues (Create Modal) |
| `.ptl-*` | ~8 | Tasks (Project Task List) |
| `.quick-tool-btn` | ~7 | Quick Access Bar |

---

## 3. Variant Analysis

### 3.1 Shared `Button` (CVA)

| Variant | Background | Text | Border | Hover | Active | Focus |
|---|---|---|---|---|---|---|
| `default` | `bg-primary` (oklch) | `text-primary-foreground` | transparent | `bg-primary/80` | `translate-y-px` | `ring-ring/30` |
| `outline` | `bg-background` | `text-foreground` | `border-border` | `bg-muted` | `translate-y-px` | `ring-ring/30` |
| `secondary` | `bg-secondary` | `text-secondary-foreground` | transparent | `color-mix(secondary, foreground, 5%)` | `translate-y-px` | `ring-ring/30` |
| `ghost` | transparent | inherited | transparent | `bg-muted` | `translate-y-px` | `ring-ring/30` |
| `destructive` | `bg-destructive/10` | `text-destructive` | transparent | `bg-destructive/20` | `translate-y-px` | `ring-destructive/20` |
| `link` | transparent | `text-primary` | none | `underline` | — | `ring-ring/30` |

### 3.2 DocumentActionBar Buttons

| Variant | Background | Text | Border | Hover | Active |
|---|---|---|---|---|---|
| `PrimaryButton` | `#185FA5` | `#fff` | `#185FA5` | `#0C447C` | — |
| `SecondaryButton` | `#fff` | `#525252` | `#d4d4d4` | `#f5f5f5` | — |
| `GhostButton` | transparent | `#525252` | none | `#18181b` | — |
| `ImportButton` | `#eef2ff` | `#4338ca` | `#c7d2fe` | `#e0e7ff` | — |

### 3.3 Global CSS `.btn-*`

| Variant | Background | Text | Border | Hover |
|---|---|---|---|---|
| `.btn-primary` | `var(--primary)` (oklch) | `#fff` | none | `var(--primary-dark)` (#4338ca) |
| `.btn-secondary` | `var(--gray-100)` | `var(--gray-700)` | `var(--gray-200)` | `var(--gray-200)` |
| `.btn-outline` | transparent | `var(--gray-700)` | `var(--gray-300)` | `var(--gray-100)` |
| `.btn-danger` | `var(--danger)` | `#fff` | none | `#dc2626` |

### 3.4 Module-Specific Variants

All module-specific buttons (cnl, cne, idp, iss, icm, ptl, pl) follow a common pattern:
- **Primary:** Blue background (`#2563eb` or similar), white text, no border
- **Secondary:** White background, gray text (`#525252`), gray border (`#d4d4d4`)
- **Ghost/Action:** Transparent background, gray icon color, hover background

---

## 4. Size Analysis

### 4.1 Shared `Button` Sizes

| Size | Height | Padding | Font Size | Border Radius | Icon Size |
|---|---|---|---|---|---|
| `default` | `h-9` (36px) | `px-3` (12px) | `text-sm` (14px) | `rounded-4xl` | `size-4` (16px) |
| `xs` | `h-6` (24px) | `px-2.5` (10px) | `text-xs` (12px) | `rounded-4xl` | `size-3` (12px) |
| `sm` | `h-8` (32px) | `px-3` (12px) | `text-sm` (14px) | `rounded-4xl` | `size-4` (16px) |
| `lg` | `h-10` (40px) | `px-4` (16px) | `text-sm` (14px) | `rounded-4xl` | `size-4` (16px) |
| `icon` | `size-9` (36px) | — | — | `rounded-4xl` | `size-4` (16px) |
| `icon-xs` | `size-6` (24px) | — | — | `rounded-4xl` | `size-3` (12px) |
| `icon-sm` | `size-8` (32px) | — | — | `rounded-4xl` | `size-4` (16px) |
| `icon-lg` | `size-10` (40px) | — | — | `rounded-4xl` | `size-4` (16px) |

### 4.2 DocumentActionBar Buttons

| Size | Height | Padding | Font Size | Border Radius |
|---|---|---|---|---|
| Default (all) | 36px | `0 16px` | 12px | 6px |

### 4.3 Global CSS `.btn`

| Size | Height | Padding | Font Size | Border Radius |
|---|---|---|---|---|
| Default | auto (content) | `10px 18px` | 14px | 8px |
| `.btn-sm` | auto (content) | `6px 12px` | 12px | 6px |

### 4.4 CSS Token Buttons (formStyles.ts)

| Token | Height | Padding | Font Size | Border Radius |
|---|---|---|---|---|
| `addButton` | 42px | — | — | 10px |
| `addLink` | 44px | `0 16px` | 13px | 10px |
| `secondaryButton` | 44px | `0 22px` | 14px | 10px |
| `ghostButton` | 44px | `0 22px` | 14px | 10px |
| `primaryButton` | 44px | `0 22px` | 14px | 10px |
| `deleteIconButton` | 36px | — | — | 8px |

---

## 5. Props Analysis

### 5.1 Shared `Button` Props

| Prop | Required | Type | Notes |
|---|---|---|---|
| `variant` | Optional | `'default' \| 'outline' \| 'secondary' \| 'ghost' \| 'destructive' \| 'link'` | Default: `'default'` |
| `size` | Optional | `'default' \| 'xs' \| 'sm' \| 'lg' \| 'icon' \| 'icon-xs' \| 'icon-sm' \| 'icon-lg'` | Default: `'default'` |
| `className` | Optional | `string` | Merged via `cn()` |
| `disabled` | Optional | `boolean` | Standard HTML attribute |
| `onClick` | Optional | `.MouseEventHandler` | Standard HTML attribute |
| `children` | Optional | `ReactNode` | Standard HTML attribute |
| `type` | Optional | `'button' \| 'submit' \| 'reset'` | Standard HTML attribute |
| `data-icon` | Optional | `'inline-start' \| 'inline-end'` | Used for icon padding adjustment via CSS `has-data-[icon]` |

**Deprecated:** None
**Unused:** None (all props are functional)

### 5.2 DocumentActionBar Button Props

| Prop | Required | Type | Notes |
|---|---|---|---|
| `onClick` | **Required** | `() => void` | |
| `disabled` | Optional | `boolean` | |
| `children` | **Required** | `ReactNode` | |
| `style` | Optional | `React.CSSProperties` | Override inline styles |
| `type` | Optional | `'button' \| 'submit'` | Default: `'button'` |

**Missing:** `loading`, `icon`, `tooltip`, `className`, `aria-label`

### 5.3 PDFExportButton Props

| Prop | Required | Type | Notes |
|---|---|---|---|
| `reportData` | **Required** | `GeneratedReport` | |
| `reportContent` | Optional | `any` | |
| `reportType` | Optional | `'general' \| 'financial' \| 'project'` | Default: `'general'` |
| `disabled` | Optional | `boolean` | |
| `className` | Optional | `string` | |
| `size` | Optional | `'sm' \| 'md' \| 'lg'` | Default: `'md'` |
| `variant` | Optional | `'primary' \| 'secondary' \| 'outline'` | Default: `'primary'` |

---

## 6. Styling Analysis

### 6.1 Styling Approaches Used

| Approach | Where | Count |
|---|---|---|
| **CVA + Tailwind** | `ui/button.tsx` | 1 system |
| **Inline CSS (React.CSSProperties)** | `DocumentActionBar.tsx` | 4 components |
| **CSS class strings (Tailwind)** | `formStyles.ts` | 6 tokens |
| **Global CSS classes** | `index.css` | 7 classes |
| **Inline `<style>` blocks** | 6+ page files | 6+ modules |
| **Template literal Tailwind** | `PDFExportButton.tsx` | 1 component |
| **Mixed inline + Tailwind** | 175+ raw `<button>` | Pervasive |

### 6.2 Color Token Inconsistencies

| Color Purpose | Shared Button | DocActionBar | Global CSS | Module CSS |
|---|---|---|---|---|
| **Primary Blue** | `oklch(0.59 0.20 277.12)` | `#185FA5` | `oklch(0.59 0.20 277.12)` | `#2563eb` / `#3b82f6` |
| **Primary Hover** | `primary/80` | `#0C447C` | `#4338ca` | `#1d4ed8` |
| **Secondary BG** | `oklch(0.93 0.01 264.53)` | `#fff` | `var(--gray-100)` | `#fff` |
| **Secondary Border** | transparent | `#d4d4d4` | `var(--gray-200)` | `#d4d4d4` / `#cbd5e1` |
| **Secondary Text** | `oklch(0.37 0.03 259.73)` | `#525252` | `var(--gray-700)` | `#525252` |
| **Danger/Destructive** | `oklch(0.64 0.21 25.33)` | — | `var(--danger)` (#ef4444) | `#dc2626` |

### 6.3 Border Radius Inconsistencies

| Component | Border Radius |
|---|---|
| Shared `Button` | `rounded-4xl` (~24px) |
| DocumentActionBar | 6px |
| Global `.btn` | 8px |
| formStyles tokens | 10px (buttons), 4px (icon) |
| Module CSS buttons | 6px |
| Inline `<button>` | 4px, 6px, 8px, 10px, 12px, 14px, rounded-full |

### 6.4 Hardcoded Colors

**Critical Finding:** The `DocumentActionBar` buttons use **hardcoded hex colors** in inline styles (`#185FA5`, `#0C447C`, `#fff`, `#525252`, `#d4d4d4`, `#f5f5f5`) with **no CSS variable references**, making them immune to theme changes.

Module-specific inline `<style>` blocks also use hardcoded colors (`#2563eb`, `#1d4ed8`, `#525252`, `#d4d4d4`).

### 6.5 Duplicate Styles

| Pattern | Instances | Files |
|---|---|---|
| "Primary blue button" | 7+ different definitions | `ui/button.tsx`, `DocumentActionBar.tsx`, `index.css`, `formStyles.ts`, 3+ inline `<style>` blocks |
| "Secondary white button" | 7+ different definitions | Same set |
| "Ghost/transparent button" | 5+ different definitions | Same set |
| "Delete icon button" | 3+ different definitions | `formStyles.ts`, `index.css`, inline styles |

---

## 7. Accessibility Audit

### 7.1 Shared `Button` (Best)

| Feature | Status |
|---|---|
| `focus-visible` ring | ✅ `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30` |
| `disabled` state | ✅ `disabled:pointer-events-none disabled:opacity-50` |
| `aria-invalid` support | ✅ `aria-invalid:border-destructive aria-invalid:ring-3` |
| `aria-expanded` support | ✅ Variants handle `aria-expanded` state |
| Keyboard navigation | ✅ Native `<button>` via Base UI primitive |
| Screen reader | ✅ Native button semantics |
| `aria-label` | ⚠️ Not provided by component — depends on consumer |
| `aria-disabled` | ⚠️ Not explicitly set |
| Loading state | ❌ No built-in `isLoading` / loading indicator |
| Icon-only button labeling | ⚠️ `IconButton` accepts `icon` but no `aria-label` enforcement |

### 7.2 DocumentActionBar Buttons

| Feature | Status |
|---|---|
| `focus-visible` | ❌ No focus ring defined |
| `disabled` state | ⚠️ Basic opacity + cursor only |
| `aria-label` | ❌ Not supported |
| `aria-disabled` | ❌ Not set |
| Keyboard navigation | ✅ Native `<button>` element |
| Screen reader | ✅ Native button semantics (but no aria-label prop) |
| Loading state | ❌ Not supported |

### 7.3 Global CSS `.btn` Buttons

| Feature | Status |
|---|---|
| `focus-visible` | ❌ No focus ring |
| `disabled` state | ❌ No disabled styles defined |
| `aria-label` | ❌ Not supported |
| Keyboard navigation | ✅ Native `<button>` |
| Loading state | ❌ Not supported |

### 7.4 Module-Specific CSS Buttons

| Feature | Status |
|---|---|
| `focus-visible` | ❌ Not defined in any module CSS |
| `disabled` state | ⚠️ Only some modules (cne-*) define `:disabled` |
| `aria-label` | ❌ Not used |
| Keyboard navigation | ✅ Native `<button>` |
| Loading state | ❌ Not supported |

### 7.5 Inline `<button>` Elements (Worst)

| Feature | Status |
|---|---|
| `focus-visible` | ❌ Almost never defined |
| `disabled` state | ⚠️ Sometimes via inline `style` |
| `aria-label` | ❌ Rarely used (icon buttons without labels) |
| Keyboard navigation | ✅ Native element |
| Loading state | ❌ Not supported |

### 7.6 Accessibility Summary

| Score | Assessment |
|---|---|
| Shared `Button` | 8/10 — Good accessibility, missing loading state |
| DocumentActionBar | 4/10 — Basic disabled, no focus ring, no aria |
| Global CSS | 3/10 — No focus, no disabled, no aria |
| Module CSS | 2/10 — Ad hoc, no consistency |
| Inline buttons | 1/10 — No accessibility features |

---

## 8. Design Consistency

### 8.1 Height Inconsistencies

| Component/System | Height |
|---|---|
| Shared `Button` default | 36px |
| Shared `Button` xs | 24px |
| Shared `Button` sm | 32px |
| Shared `Button` lg | 40px |
| DocumentActionBar | 36px |
| formStyles buttons | 42-44px |
| Global `.btn` | ~40px (padding-driven) |
| Global `.btn-sm` | ~32px (padding-driven) |
| Module CSS primary | ~34-36px (padding-driven) |
| Inline buttons | 28px – 56px (varies) |

**Finding:** At least **8 different height values** across the codebase.

### 8.2 Border Radius Inconsistencies

| Component/System | Radius |
|---|---|
| Shared `Button` | `rounded-4xl` (~24px — pill shape) |
| DocumentActionBar | 6px |
| Global `.btn` | 8px |
| formStyles | 10px |
| Module CSS | 6px |
| Inline buttons | 4px, 6px, 8px, 10px, 12px, 14px, rounded-full |

**Finding:** **7+ different border radius values** for buttons.

### 8.3 Typography Inconsistencies

| Component/System | Font Size | Font Weight |
|---|---|---|
| Shared `Button` | 14px (text-sm) | 500 (medium) |
| DocumentActionBar | 12px | 500 |
| Global `.btn` | 14px | 500 |
| formStyles | 13-14px | 500-600 |
| Module CSS | 12-13px | 500-600 |
| Inline buttons | 11-16px | 400-700 |

### 8.4 Shadow Inconsistencies

| Component/System | Shadow |
|---|---|
| Shared `Button` | None (uses ring on focus) |
| formStyles `primaryButton` | `shadow-[0_8px_18px_rgba(79,70,229,0.18)]` |
| Global CSS | None |
| Module CSS | None |
| Inline buttons | Occasional ad-hoc shadows |

### 8.5 Hover Animation Inconsistencies

| Component/System | Hover Effect |
|---|---|
| Shared `Button` | Background color change + `translate-y-px` on active |
| DocumentActionBar | `transition: all 0.15s` + JS-driven color swap |
| Global CSS | `transition: all 0.2s` |
| formStyles | `transition-colors duration-180` or `duration-200` |
| Module CSS | `transition: all 0.15s` |
| Inline buttons | Various: `transition-all`, `transition-colors`, no transition |

---

## 9. Technical Debt

### 9.1 Duplicate Button Components

| Duplication | Count | Impact |
|---|---|---|
| "Primary blue button" implementations | **7+** | High — 7 different hover colors, 4 different radii |
| "Secondary white button" implementations | **7+** | High — inconsistent borders, text colors |
| "Ghost button" implementations | **5+** | Medium |
| "Delete icon button" implementations | **3+** | Medium |
| "Outline button" implementations | **4+** | Medium |

### 9.2 Dead Code / Unused Variants

| Item | Status |
|---|---|
| `.btn-danger` (global CSS) | ⚠️ Rarely used — most danger buttons use inline styles |
| `link` variant (shared Button) | ⚠️ Minimal usage |
| `icon-xs` / `icon-lg` sizes | ⚠️ Minimal usage |
| `ImportButton` (DocumentActionBar) | ⚠️ Used in few document pages only |

### 9.3 Module-Specific Button Styles (Should Not Exist)

| Module | CSS Prefix | Lines of CSS | Recommendation |
|---|---|---|---|
| Credit Notes List | `cnl-*` | ~25 | Migrate to shared `Button` |
| Credit Notes Editor | `cne-*` | ~15 | Migrate to shared `Button` |
| Issue Detail | `idp-*` | ~40 | Migrate to shared `Button` |
| Issue Dashboard | `iss-*` | ~30 | Migrate to shared `Button` |
| Issue Create Modal | `icm-*` | ~35 | Migrate to shared `Button` |
| Project Task List | `ptl-*` | ~100 | Migrate to shared `Button` |
| Projects | `pl-btn*` | ~40 | Migrate to shared `Button` |

**Total:** ~285 lines of module-specific button CSS that duplicate the shared system.

### 9.4 Inline Style Button Abuse

| Pattern | Count | Example |
|---|---|---|
| Full inline button styles | ~50+ | `<button style={{ padding: '8px 16px', border: '1px solid #d4d4d4', ... }}>` |
| Mixed className + inline style | ~30+ | `<button className="btn" style={{ marginTop: '12px' }}>` |
| Ad-hoc className patterns | ~100+ | `<button className="bg-blue-600 text-white hover:bg-blue-700 rounded-lg ...">` |

### 9.5 Inline `<style>` Blocks in Components

**6+ components** define button CSS in `<style>` blocks inside `.tsx` files:
- `CreditNoteListPage.tsx`
- `CreditNoteEditorPage.tsx`
- `IssueDetailPage.tsx`
- `IssueDashboard.tsx`
- `IssueCreateModal.tsx`
- `ProjectTaskListView.tsx`

These are impossible to maintain, override, or theme consistently.

---

## 10. Migration Risk

### 10.1 Scope Assessment

| Metric | Value |
|---|---|
| **Files with direct `<button>` usage** | 175+ |
| **Files importing shared `Button`** | ~80 |
| **Files with module-specific CSS buttons** | ~12 |
| **Files with inline style buttons** | ~50+ |
| **Total files affected** | **~220+** |

### 10.2 Breaking Changes

| Risk | Description |
|---|---|
| **HIGH** | Removing `DocumentActionBar` buttons (`PrimaryButton`, etc.) would break all document creation pages |
| **HIGH** | Changing shared `Button` border radius from `rounded-4xl` to a smaller radius would visually change ~80 files |
| **MEDIUM** | Removing global `.btn` classes would break ~60+ usages |
| **MEDIUM** | Module CSS removal requires per-module migration |
| **LOW** | Adding new props to shared `Button` is backward-compatible |

### 10.3 Safe Migration Strategy

| Phase | Action | Risk |
|---|---|---|
| **Phase 1** | Deprecate `DocumentActionBar` buttons; add `isLoading`, `leftIcon`, `rightIcon` props to shared `Button` | Low |
| **Phase 2** | Migrate `formStyles.ts` button tokens to use shared `Button` | Low |
| **Phase 3** | Migrate module-specific CSS buttons (cnl, cne, idp, iss, icm, ptl, pl) to shared `Button` | Medium |
| **Phase 4** | Replace global `.btn` class usages with shared `Button` | Medium |
| **Phase 5** | Replace inline `<button>` elements with shared `Button` | High (most files) |
| **Phase 6** | Remove global `.btn` CSS, module-specific CSS, inline `<style>` blocks | Low (after migration) |

### 10.4 Compatibility Concerns

| Concern | Detail |
|---|---|
| `border-radius: 0 !important` | Global CSS reset forces `border-radius: 0` on all elements — shared `Button` uses `rounded-4xl` which may be overridden |
| CSS specificity | Module `<style>` blocks may override shared button styles |
| `@base-ui/react/button` | Shared Button depends on Base UI — ensure compatibility during upgrades |
| `class-variance-authority` | CVA is a runtime dependency — acceptable but adds bundle size |

---

## 11. Improvement Recommendations

### 11.1 Variants to Keep

| Variant | Reason |
|---|---|
| `default` (primary) | Core action button — well-defined |
| `secondary` | Most-used alternative |
| `ghost` | Essential for icon buttons, toolbar actions |
| `destructive` | Important for delete/confirm flows |
| `outline` | Useful for form actions |
| `link` | Low priority but harmless |

### 11.2 Variants to Remove / Consolidate

| Variant | Action |
|---|---|
| `DocumentActionBar.PrimaryButton` | Replace with shared `Button variant="default"` |
| `DocumentActionBar.SecondaryButton` | Replace with shared `Button variant="secondary"` |
| `DocumentActionBar.GhostButton` | Replace with shared `Button variant="ghost"` |
| `DocumentActionBar.ImportButton` | Add as custom variant or use `variant="outline"` with indigo colors |
| All module-specific CSS buttons | Replace with shared `Button` |
| All global `.btn-*` classes | Replace with shared `Button` |

### 11.3 Props to Add

| Prop | Type | Purpose |
|---|---|---|
| `isLoading` | `boolean` | Show spinner + disable when loading |
| `leftIcon` | `ReactNode` | Icon before children |
| `rightIcon` | `ReactNode` | Icon after children |
| `tooltip` | `string` | Accessible tooltip |
| `fullWidth` | `boolean` | Full-width button |
| `asChild` | `boolean` | Render as child element (Radix pattern) |

### 11.4 Props to Remove

| Prop | Reason |
|---|---|
| `style` (DocumentActionBar buttons) | Replace with `className` for consistency |

### 11.5 Design System Improvements

| Improvement | Priority | Impact |
|---|---|---|
| **Standardize primary color** | High | Pick ONE blue token and use everywhere |
| **Standardize border radius** | High | Use `rounded-lg` (8px) or `rounded-xl` (12px) for all buttons |
| **Add loading state** | High | Every button should support `isLoading` |
| **Add focus-visible to all buttons** | High | Critical for accessibility |
| **Remove all module-specific button CSS** | Medium | ~285 lines of dead CSS eliminated |
| **Remove all inline `<style>` button blocks** | Medium | ~6+ component files cleaned up |
| **Remove global `.btn` classes** | Medium | Consolidate into shared component |
| **Enforce `aria-label` on icon buttons** | Medium | Accessibility requirement |
| **Add `data-loading` attribute** | Low | For CSS-based loading animations |

### 11.6 API Simplification

**Current state:** 7+ different ways to render a "primary blue button."

**Target state:** 1 way.

```tsx
// Before (7 different ways):
<Button variant="default" />                           // Shared
<PrimaryButton onClick={...} />                        // DocumentActionBar
<button className="btn btn-primary" />                 // Global CSS
<button className="pl-btn pl-btn-primary" />           // Projects
<button className="cnl-btn-primary" />                 // Credit Notes
<button style={{ background: '#2563eb', ... }} />      // Inline
primaryButton                                          // formStyles token

// After (1 way):
<Button />                                            // Default variant = primary
```

---

## Summary

| Category | Rating | Key Finding |
|---|---|---|
| **Component Count** | 🔴 Critical | 7+ overlapping button implementations |
| **Usage Consistency** | 🔴 Critical | 175+ raw `<button>` elements bypass shared component |
| **Variant Consistency** | 🟡 Moderate | 4+ different "primary" definitions with different colors |
| **Size Consistency** | 🟡 Moderate | 8+ different height values |
| **Styling Approach** | 🔴 Critical | 6 different styling methods (CVA, CSS, inline, tokens, etc.) |
| **Color Consistency** | 🔴 Critical | 4+ different primary blue values (#185FA5, #2563eb, #3b82f6, oklch) |
| **Accessibility** | 🟡 Moderate | Shared Button is good (8/10), everything else is poor (2-4/10) |
| **Technical Debt** | 🔴 Critical | ~285 lines of module CSS + 6 inline `<style>` blocks + 50+ inline-styled buttons |
| **Migration Effort** | 🟠 High | ~220+ files affected, but can be done incrementally over 6 phases |
