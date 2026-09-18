# PRD — Unified Document Creation UI

**Status:** Implementation complete — UI scope verified; repository-wide typecheck remains baseline-blocked  
**Reference UI:** Current original CreateQuotation module (V1)  
**Scope:** Create and edit screens for Quotation, Proforma Invoice, Debit Note, Credit Note, Purchase Order, and Delivery Challan

## Execution Log

- **Baseline — 2026-09-12:** Not green before implementation. The default typecheck exceeded the Node heap limit; the larger-heap retry exposed pre-existing type errors across unrelated modules, including existing Proforma, Credit Note, conversion, approval, project, PDF, and UI files. A parallel production build exhausted Windows process resources; it also reported existing font-resolution and circular-chunk warnings before failing. No application files were changed for this baseline.
- **Implementation unit 1 — 2026-09-12:** Added `DocumentEditorShell` and `DocumentLineItemsSurface` to the existing `document-editor` exports, then composed Purchase Order V2 and Debit Note V2 with those shared surfaces. Existing item handlers, total formulas, validation, save payloads, navigation, and queries were not changed. The targeted esbuild syntax check and `git diff --check` passed. The repository ESLint command was attempted but cannot parse the project’s TypeScript files because its current config treats `.tsx` as plain JavaScript; this is recorded as a tooling limitation, not a passing lint result.
- **Implementation unit 2 — 2026-09-12:** Composed Invoice V2 and Delivery Challan V2 with the same shell and line-item surface. Existing form submission, conversion selectors, stock controls, item handlers, total formulas, save payloads, navigation, and query behavior were not changed. The targeted esbuild syntax check and `git diff --check` passed.
- **Implementation unit 3 — 2026-09-12:** Composed Credit Note V2 and the active Proforma Invoice editor with `DocumentEditorShell`. Credit Note’s existing `CNItemsEditor` remains the sole line-item surface; its error/rate alerts retain their pre-content position through the shell’s presentation-only `beforeContent` slot. Existing React Hook Form state, stock adjustment, conversion, revision, save/print, import, and totals behavior were not changed. The targeted esbuild syntax check and `git diff --check` passed.
- **Implementation unit 4 — 2026-09-12:** Corrected the incomplete Invoice V2 `InvoiceItemsEditor` composition to pass its already-existing field-array/form props. This restores the existing line-item editor without changing calculations, handlers, queries, conversion behavior, or save behavior. The targeted esbuild syntax check and `git diff --check` passed.
- **Implementation unit 5 — 2026-09-12:** Aligned Invoice V2 with the maintained CreateQuotation visual language without removing invoice-specific fields. The three header cards now use the quotation naming (`Client`, `Document`, `Reference & Terms`), the line-item editor uses one quotation-style `Materials List` surface, the existing PDF controls are visible in the action bar, and the existing PO line selector is available beside the line-item action. The invoice item editor’s existing inner header remains available to its other consumers and is hidden only in this composed surface. No calculations, save payloads, query behavior, or invoice-domain handlers were changed. The production build, `git diff --check`, and browser apple-to-apple interaction check passed; existing build warnings remain documented below.
- **Implementation unit 6 — 2026-09-12:** Added the five quotation-style line-item toolbar affordances to Invoice V2. `Add Materials` uses the existing invoice item append behavior; `Add Multiple Items` uses the existing PO line selector when a PO is selected. `Add Section Header`, `Add Sub-total Row`, and `Columns` are visible but disabled because Invoice V2 has no corresponding existing invoice handlers, preserving the no-new-business-logic constraint. No calculations, save payloads, query behavior, or invoice-domain handlers were changed. Browser verification, `git diff --check`, and the production build passed.
- **Implementation unit 7 — 2026-09-12:** Filled the Invoice V2 Client card from its existing client and shipping-address data: GSTIN, contact/email, billing address, shipping-address selector with existing add-address modal, and client state. Corrected the initialization ordering for the derived selected-client data. Browser verification and `git diff --check` passed. The production build reached bundling but failed during gzip reporting with the repository’s existing `insufficient memory` limitation after the prior build had passed.
- **Apple-to-apple verification — 2026-09-12:** Logged into the local test account and compared the maintained original CreateQuotation route against Invoice V2, Credit Note V2, Purchase Order V2, Debit Note V2, Delivery Challan V2, and the active Proforma editor. All seven routes rendered their expected action bar, three-column document header, line-item area, and totals/summary state with no visible error boundary. The final production build passed. Existing build warnings remain for unresolved font assets, circular table exports, an existing material repository export mismatch, CSS minification, and large chunks; these are unrelated to this refactor. The initial repository-wide typecheck baseline remains non-green due pre-existing errors and resource behavior.
- **Implementation status:** Phase 0 baseline captured; Phase 1 complete for the approved UI scope. The maintained original quotation remains untouched; `qUOTEUI.md` was not used as a current source.

## Problem Statement

The application has several document creation screens that perform similar work but do not present or organize that work consistently. Some V2 screens already use the shared document-editor primitives, while other screens still contain their own header layout, line-item table, totals area, save controls, loading state, dirty state, and mutation orchestration.

The result is inconsistent document-entry behavior:

- Users learn a different form layout for each document type.
- Line-item actions, totals presentation, and save feedback vary between screens.
- Shared visual primitives exist, but document pages still duplicate composition and state handling.
- The largest pages remain difficult to review safely because loading, form state, calculations, conversion behavior, side effects, and JSX are interleaved.
- The current V2 work is incomplete: Quotation, Invoice, Credit Note, Purchase Order, Debit Note, and Delivery Challan have partial V2 implementations, while Proforma Invoice still uses its existing editor as the active route.

This PRD defines a reusable refactor of the creation-screen UI only. It does not change business behavior.

## Solution

Use the current original CreateQuotation module (V1) as the visual and interaction reference. The V2 quotation page is not authoritative because it has diverged during the unfinished refactor. Compose every in-scope creation/edit screen to match the maintained CreateQuotation reference while preserving each document's existing business behavior.

Every document screen will expose the same high-level structure:

1. Document action bar with title, status, document actions, cancel, and save actions.
2. Three-column document header section using party, document, and context/details cards.
3. Document-specific line-item editor in the shared table treatment.
4. Existing document-specific supporting panels, drawers, selectors, approvals, terms, warehouse, revision, import, and conversion controls in the appropriate location.
5. Totals and amount-in-words footer using the existing summary treatment where the document supports it.
6. Consistent loading, empty, validation, dirty, saving, saved, and error presentation.

The shared UI will standardize composition and interaction contracts. Each document will retain its own existing state model, data shape, queries, formulas, mutations, permissions, conversion behavior, inventory effects, approvals, numbering, and PDF behavior. The shared layer must not know document-table names or invent document business rules.

## Goals

- Make all six creation/edit experiences visually recognizable as one document-entry family.
- Preserve the current original CreateQuotation layout and interaction structure as the reference.
- Reuse the existing `document-editor` primitives and documented line-item behavior.
- Separate page composition from document-specific state and persistence without introducing a new state-management library or architecture pattern.
- Keep every current function, formula, validation, conversion, approval, stock effect, route, permission, and API contract unchanged.
- Make each page small enough to review and test without creating another large monolithic component.
- Allow document-specific fields and actions without breaking the common three-column shell.

## Non-Goals

- No new business functionality.
- No formula changes, rounding changes, tax-rule changes, discount-rule changes, or total changes.
- No database schema, RPC, RLS, API, numbering, or persistence changes.
- No route renaming, route removal, or replacement of existing deep links.
- No redesign of the CreateQuotation reference UI.
- No conversion-workflow redesign.
- No changes to PDF templates, print output, email output, or document exports.
- No new autosave, presence, approval, inventory, traceability, or revision features beyond preserving behavior that already exists on a given screen.
- No forced migration from local React state to React Hook Form, or from React Hook Form to local React state.
- No new third-party dependencies.
- No unrelated cleanup in the Purchase, Invoice, Credit Note, Quotation, or Warehouse modules.

## In-Scope Documents

| Document | Current V2/active state | Refactor intent |
|---|---|---|
| Quotation | The original CreateQuotation module is the maintained reference; a separate V2 implementation also exists | Treat the original module as the source of truth; compare V2 against it and do not use V2 as the family reference |
| Proforma Invoice | Existing editor is active; it already uses document-editor primitives but remains a large page | Bring its composition into the reference structure without changing its calculations or save/conversion pipeline |
| Debit Note | Debit Note V2 exists and uses the shared header/action/footer primitives | Align line-item and state presentation with the common contract while preserving purchase-side behavior |
| Credit Note | Credit Note V2 exists and uses React Hook Form plus shared primitives | Align its shell and state feedback while preserving conversion, approval, and stock-adjustment behavior |
| Purchase Order | Purchase Order V2 exists and uses shared primitives | Align its line-item editor and save-state presentation while preserving vendor/project and purchase persistence |
| Delivery Challan | Delivery Challan V2 exists and is close to the reference structure | Align its shell and line-item behavior while preserving stock, warehouse, conversion, and delivery behavior |

## User Stories

1. As a quotation user, I want the quotation editor to remain visually unchanged, so that the reference workflow is not disrupted.
2. As a proforma user, I want the same action bar and three-column header structure as quotation, so that I can move between sales documents without relearning the page.
3. As a purchase user, I want vendor-facing documents to use the same document-entry structure with vendor-specific labels, so that the interaction pattern remains familiar.
4. As a warehouse user, I want the delivery challan to use the same document shell, so that I can focus on quantities and warehouse details instead of learning a new layout.
5. As a finance user, I want credit and debit notes to show their document-specific fields inside the same structure, so that approvals and totals are easier to scan.
6. As a user creating a document, I want the title, document number, date, party, and contextual fields grouped into three predictable columns, so that I can find required information quickly.
7. As a user editing a document, I want existing values to load into the same locations as new-document values, so that create and edit do not feel like separate products.
8. As a user, I want document-specific fields to remain available even when the shared shell is used, so that unification does not remove necessary business inputs.
9. As a user, I want document-specific actions such as import, revision, conversion, PDF, terms, warehouse, or approval actions to remain available in their current workflow, so that the refactor does not reduce capability.
10. As a user adding a line item, I want the line-item editor to remain an editable table, so that I can enter multiple items efficiently.
11. As a user, I want line-item columns to remain appropriate for the document type, so that quotation fields are not incorrectly shown on purchase or warehouse documents.
12. As a user, I want the item selector, searchable fields, variant selection, make selection, and warehouse selection to keep their current behavior, so that existing entry speed is preserved.
13. As a user, I want add-row and remove-row actions to work as they do today, so that the refactor does not change item editing.
14. As a user, I want any existing reorder, drag, move-to-serial-number, section, subtotal, and column-customization behavior to remain available on the documents that already support it.
15. As a user editing quantity, I want the current quantity-entry and recalculation timing preserved, so that amounts do not change unexpectedly while I type.
16. As a user, I want the current item-level discount, tax, rate, variant, and make behavior preserved, so that saved values remain commercially correct.
17. As a user, I want totals to remain in the same business meaning and precision as before, so that financial results are unchanged.
18. As a user, I want subtotal, discount, tax, round-off, grand total, and amount-in-words presentation to remain available where the current document supports them.
19. As a user, I want the save action to remain in the document action bar, so that saving is always easy to locate.
20. As a user, I want Save, Save as Draft, Update, Cancel, and any document-specific action to retain its current enabled/disabled rules, so that permissions and workflow controls do not change.
21. As a user saving a document, I want the existing loading indicator and success/error feedback to remain clear, so that I know whether the operation completed.
22. As a user with unsaved edits, I want the current dirty-state and leave-page warning behavior preserved, so that I do not lose work.
23. As a user returning to an invalid or incomplete form, I want existing validation messages and save blocking behavior preserved, so that the refactor does not permit invalid documents.
24. As a user working with a conversion, I want source-document fields and line items to populate exactly as before, so that quotation, invoice, and challan conversions remain trustworthy.
25. As a user completing a conversion, I want source status updates and conversion markers to occur exactly as before, so that document lineage is not affected.
26. As a user creating an approved credit note, I want existing stock-adjustment behavior to remain unchanged, so that inventory stays consistent.
27. As a user creating a delivery challan, I want existing warehouse and stock validation behavior preserved, so that dispatch controls are not weakened.
28. As a user creating a purchase order or debit note, I want vendor and purchase-specific fields and persistence preserved, so that procurement workflows continue unchanged.
29. As an administrator, I want organisation isolation, permissions, and role-based controls unchanged, so that the refactor is safe in a multi-tenant ERP.
30. As a maintainer, I want document pages to use a small shared composition surface, so that future UI changes do not require six independent layout rewrites.
31. As a maintainer, I want domain calculations and save pipelines kept behind document-specific seams, so that a visual refactor cannot silently alter business logic.
32. As a reviewer, I want each document adapter to expose explicit inputs, outputs, and actions, so that I can verify behavior without reading the entire page.
33. As a QA user, I want loading, empty, error, dirty, saving, saved, conversion, approval, and locked states represented consistently, so that edge cases are not hidden by a blank or broken page.
34. As a keyboard user, I want the current keyboard reachability and focus behavior preserved, so that dense document entry remains efficient.
35. As a tablet user, I want line-item overflow and action controls to remain usable, so that the existing field-facing workflow is not degraded.
36. As a user with a large document, I want the refactor not to introduce extra re-renders or slower item editing, so that large documents remain practical.

## Architecture Review

### Source-of-truth decision

`qUOTEUI.md` is not the current source of truth for this refactor. It was created before the latest changes to the quotation implementation and its documented structure no longer reliably describes the maintained screen. It remains historical context only and must not override current code or newer repository instructions.

The source-of-truth order for this PRD is:

1. Current original CreateQuotation module and its rendered behavior.
2. Existing document-editor components already used by that module.
3. Current `DESIGN.md`, `ERP_Design_System.md`, and applicable module PRDs/ADRs.
4. Existing V2 pages only as comparison material and migration targets.
5. `qUOTEUI.md` only as historical context; do not copy its stale details.

### Current seams

The repository already contains the correct visual seam for this work: the shared `document-editor` components used by the current quotation implementation provide the action bar, header grid, header cards, header fields, date picker, buttons, and summary footer. The repository also contains a documented line-item behavior specification, but current CreateQuotation behavior takes precedence wherever the documents differ.

The current V2 implementations are not yet a single reusable editor. They are separate pages that happen to reuse some primitives:

- The original CreateQuotation module is approximately 3,100 lines and remains the maintained behavioral reference. It still owns extensive form state, item state, loading, conversion, pricing, revision, import, dirty state, autosave, presence, save orchestration, and page composition. Its nominal loader and mutation hooks are currently too small to be meaningful seams because much of the logic remains in the page.
- The separate quotation V2 page is approximately 3,000 lines and has diverged slightly from the original module. It is a migration target to reconcile, not the source of truth.
- Quotation V2 line-item components are themselves large, with separate material and erection responsibilities. They should not be copied into other document types.
- The active proforma editor is approximately 2,300 lines, with inline state, calculations, line-item operations, revision behavior, conversion behavior, and save orchestration. Its line-item editor is also large.
- Delivery Challan V2 is approximately 900 lines and still combines data loading, form state, item state, stock/warehouse concerns, calculations, and JSX.
- Invoice V2 is smaller than the large-file threshold but still owns many selectors, conversion options, revision state, warehouse state, pricing state, and totals within one page.
- Credit Note V2 uses React Hook Form and shared shell primitives, but its save callback still combines persistence, source conversion updates, and stock adjustment side effects.
- Purchase Order V2 and Debit Note V2 already have a compact three-column shell, but their line-item tables are bespoke and use hand-written controls rather than the canonical line-item behavior.
- Proforma, Invoice, Credit Note, Purchase Order, Debit Note, and Delivery Challan currently use different item shapes and state models. This is a domain difference that must be preserved, not erased by forcing one database-shaped item type.

### Restructuring decision

Restructuring is required before implementation. Per repository instructions, implementation must stop until this PRD is approved.

The refactor should extract reusable composition and document-specific seams. It should not create a global store, rewrite business logic, introduce a new domain framework, or force every document onto one form library.

### Design principles

1. Match the current original CreateQuotation module first; reuse its existing `document-editor` primitives and the current repository design rules.
2. Keep domain state and mutations document-specific.
3. Standardize the visual shell through explicit props and slots.
4. Keep formulas in their existing calculators or page-local logic until a behavior-preserving extraction is verified.
5. Keep database access, conversion side effects, approvals, stock operations, and numbering in the owning document workflow.
6. Prefer extraction and adapters over rewriting.
7. Preserve current routes and provide compatibility wrappers where a page is moved.
8. Keep each extracted component focused and below the repository's 800–1,000 line review threshold; split further where a component still owns unrelated concerns.

## Refactoring Plan

### Phase 0 — Baseline and contract inventory

- Record the current route and entry-point behavior for all six documents.
- Record all create, edit, duplicate, convert, approval, revision, import, print, and save variants.
- Record each document's current header fields, line-item fields, totals, validation rules, and side effects.
- Record calculation outputs for representative fixtures before moving code.
- Confirm applicable PRD/MD rules before each phase.

**Gate:** Inventory reviewed and approved; no code changes beyond the approved plan.

### Phase 1 — Shared composition contract

- Define the common document-screen composition contract around the existing action bar, three-column header grid, line-item region, supporting region, and summary footer.
- Define document-specific slots for header cards, item editor, supporting panels, totals rows, and actions.
- Define common display states: loading, empty, error, dirty, saving, saved, validation failure, and locked/read-only.
- Keep the existing shared primitives as the implementation base.

**Gate:** Quotation V2 renders through the contract with no behavior or visual regression.

### Phase 2 — Quotation reference stabilization

- Reduce the quotation page to composition and document-specific orchestration.
- Extract only the existing quotation responsibilities into focused components/hooks following the already-established quotation V2 direction.
- Preserve quotation-specific item sections, revision, import/undo, autosave, presence, approvals, ARC pricing, discount settings, templates, and conversions.
- Do not change any calculation or mutation implementation during this phase except mechanical relocation.

**Gate:** Quotation create, edit, conversion, revision, autosave, conflict, and save flows pass behavior checks.

### Phase 3 — Sales documents

- Apply the approved shell contract to Proforma Invoice and Invoice.
- Keep their existing item shapes, calculation engines, templates, PO/quotation/proforma selectors, conversions, revisions, pricing, and PDF actions.
- Add compatibility routing only if required to introduce a V2 entry point; do not remove existing routes.

**Gate:** Proforma and Invoice create/edit/convert/save/PDF flows match their pre-refactor behavior.

### Phase 4 — Finance and procurement documents

- Apply the shell contract to Credit Note, Debit Note, and Purchase Order.
- Preserve approval status, vendor/client semantics, purchase persistence, source references, rate alerts, stock adjustment, and existing error handling.
- Use the common visual line-item treatment only where it can receive the existing document-specific item behavior without changing business semantics.

**Gate:** Each document's create/edit/save and document-specific side effects match baseline behavior.

### Phase 5 — Delivery Challan

- Apply the same shell contract to Delivery Challan.
- Preserve warehouse selection, insufficient-stock behavior, shipping information, material intent loading, conversion behavior, stock effects, and edit behavior.
- Keep delivery-specific fields in the appropriate header card or supporting panel.

**Gate:** Delivery Challan create/edit/convert/stock validation/save flows match baseline behavior.

### Phase 6 — Cross-document consistency and cleanup

- Compare all six screens against the CreateQuotation reference structure.
- Remove only duplication made obsolete by the approved extraction.
- Confirm no page or extracted component exceeds the agreed review threshold.
- Confirm all routes, imports, lazy loading, and compatibility wrappers remain valid.

**Gate:** Cross-document visual and behavioral review signed off; no unrelated cleanup included.

## Implementation Decisions

### Shared UI contract

The reusable layer is a composition layer, not a business engine. It may own:

- action-bar placement and common action affordance slots;
- three-column header-card placement;
- common field-row presentation;
- line-item surface framing and empty state presentation;
- summary-footer framing;
- common save-state indicator presentation;
- responsive overflow and spacing consistent with QuoteUI.

The reusable layer must not own:

- Supabase table names or queries;
- document numbering;
- tax, discount, round-off, or amount formulas;
- conversion status updates;
- approval creation or transitions;
- stock deduction or restoration;
- warehouse validation rules;
- PDF or email generation;
- permission decisions;
- document-specific validation.

### Document adapters

Each document keeps a document-specific adapter/orchestrator that supplies the shared shell with:

- document title and status;
- header-card content;
- line-item editor and item actions;
- supporting panels;
- totals rows and amount-in-words content;
- current save state;
- existing save, draft, update, cancel, conversion, and document actions.

The adapter may continue to use the page's current local state or React Hook Form. The refactor must not change the form library solely for visual consistency.

### Line-item behavior

The canonical behavior document is the existing line-item behavior specification. A document must retain only the behaviors it already supports; the refactor must not silently add capabilities. Where a shared line-item surface is used, its contract must support document-specific columns and actions.

Fixed or expected behaviors are determined per document from the baseline inventory. They include, where already present:

- add, edit, and remove rows;
- material or vendor item selection;
- quantity entry and current commit timing;
- rate, tax, discount, make, variant, unit, and HSN handling;
- row reorder or drag-and-drop;
- move-to-serial-number;
- section and subtotal rows;
- column visibility and labels;
- terms and conditions drawer;
- row selection and bulk actions;
- warehouse or stock metadata.

### State management

State is standardized at the UI contract level, not by introducing one global state solution.

- Document state remains owned by its document page or extracted document hook.
- Reference data remains loaded through the existing hooks and React Query patterns.
- Form state remains in the existing local state or React Hook Form implementation.
- Derived totals remain produced by the existing formula/calculation path.
- UI-only state such as open panels, selected rows, and dropdown visibility may be extracted with the component that owns the interaction.
- Save lifecycle state must be exposed to the action bar using the existing page semantics.
- Dirty state must be set and cleared exactly as before.

### Layout rules

- The current original CreateQuotation module is the visual and interaction reference.
- Use the existing three-column header grid and card treatment.
- Keep labels, spacing, colors, controls, and button primitives aligned with QuoteUI, DESIGN.md, and ERP_Design_System.md.
- Keep document-specific fields in balanced cards; do not remove a column just because a document has fewer fields.
- Keep line items in a table/sheet treatment, not a card list.
- Keep primary document actions in the action bar.
- Keep secondary workflows in existing drawers or panels; do not introduce nested modal flows.

### Compatibility

- Existing URLs remain valid.
- Existing V2 URLs remain valid.
- Existing non-V2 URLs remain valid until a separately approved migration changes them.
- Existing query parameters for edit, duplicate, conversion, source, and multi-document flows remain valid.
- Existing exported component contracts used by routes or module shells remain valid, or receive a thin compatibility wrapper.

### No data-model changes

This PRD does not authorize migrations, new columns, new RPCs, RLS changes, or persistence rewrites. Existing document contracts are the source of truth.

## Testing Decisions

Tests must verify external behavior, not component arrangement or implementation details. A component can be moved or renamed without changing a test if the user-visible behavior and persisted payload remain the same.

### Highest-value test seams

1. Pure existing calculation functions or calculation hooks, using representative line-item fixtures per document.
2. Document adapter behavior at the page boundary, with mocked existing repositories/hooks and assertions on rendered states and action calls.
3. Save payload and side-effect boundaries, verifying the same data and same calls are made as before.
4. Route-level smoke checks for create, edit, and conversion entry points.

### Required behavior coverage

- Three-column header renders for every document type with the correct document-specific fields.
- Loading, empty, validation-error, dirty, saving, saved, and save-error states render correctly.
- Add/edit/remove line items preserve the existing item shape and calculated values.
- Quantity, rate, discount, tax, round-off, and amount-in-words outputs match baseline fixtures.
- Create and edit payloads are unchanged.
- Conversion prefill and source status updates are unchanged.
- Credit Note stock restoration and Delivery Challan stock/warehouse behavior are unchanged.
- Purchase Order and Debit Note vendor/purchase persistence is unchanged.
- Existing approval, revision, import/undo, autosave, presence, PDF, print, and email actions remain connected where they currently exist.
- Existing routes and query parameters resolve to the correct page.
- Keyboard and overflow behavior remain usable.

### Prior art

The repository currently has limited UI test coverage, with focused tests around approval RPC behavior and domain utilities. New tests should follow those existing Vitest conventions and begin at pure calculations and the document boundary. Full live Supabase, RLS, RPC, and end-to-end workflow verification remains a separate environment concern and must not be claimed from a typecheck or build alone.

### Validation commands

At the code level, each phase should run the narrowest relevant tests first, then `npm run typecheck`, then `npm run build`. A build passing does not prove live conversion, stock, approval, RLS, or RPC behavior; those require explicit environment verification.

## Acceptance Criteria

- All six document types use the current original CreateQuotation reference composition: action bar, three-column header, line items, supporting content, totals, and save state.
- The resulting screens use the existing shared document-editor primitives and current repository design rules; stale `qUOTEUI.md` details are not treated as requirements.
- No existing function, formula, query, mutation, route, permission, or document side effect changes.
- No database, RPC, RLS, API, or dependency changes are introduced.
- Document-specific controls remain available and correctly placed.
- Existing create, edit, duplicate, conversion, approval, revision, import, inventory, PDF, print, email, and cancel behavior remains unchanged.
- Each extracted file has one clear responsibility and remains within the agreed size threshold, or has an explicit reason and approved follow-up split.
- Cross-document behavior and visual review passes before any old screen is retired or any route becomes V2-only.

## Risk Assessment

| Risk | Impact | Mitigation |
|---|---|---|
| Formula drift during extraction | Incorrect financial totals | Capture baseline fixtures; keep calculation code unchanged; compare outputs before/after per document |
| Save payload drift | Missing or altered persisted data | Snapshot/compare payloads at the existing mutation boundary |
| Conversion side-effect drift | Broken document lineage or status | Test every supported conversion path and source status update |
| Stock or warehouse behavior drift | Inventory inconsistency | Preserve the existing side-effect call order and verify Delivery Challan/Credit Note workflows separately |
| State-model mismatch | Dirty or saving state becomes misleading | Keep local/RHF ownership per document and expose only a small shared UI state contract |
| Shared component overreach | Document-specific behavior gets lost | Use slots/adapters; do not place domain rules in shared presentation components |
| Route regression | Existing links stop working | Preserve all current paths and query parameters; use compatibility wrappers where needed |
| Large extracted components | Refactor becomes cosmetic | Apply the 800–1,000 line review threshold and split unrelated responsibilities |
| Visual regression | Users lose the known reference layout | Compare every screen to CreateQuotation V2 and review at desktop/tablet widths |
| Scope expansion | Unrelated behavior changes enter the refactor | Enforce the non-goals list and keep commits phase-sized |
| Live backend assumptions | False confidence from local checks | Separate code-level verification from live Supabase/RLS/RPC and end-to-end verification |

## Target File Tree After Refactor

The exact names may be adjusted during Phase 0 if the existing exports or route wrappers require it. The responsibilities must remain equivalent to this tree.

```text
src/
├── components/
│   └── document-editor/
│       ├── DocumentActionBar.tsx
│       ├── HeaderCard.tsx
│       ├── HeaderField.tsx
│       ├── HeaderFormGrid.tsx
│       ├── CustomDatePicker.tsx
│       ├── SummaryFooter.tsx
│       ├── SaveStateIndicator.tsx
│       ├── DocumentEditorShell.tsx
│       ├── DocumentLineItemsSurface.tsx
│       └── index.ts
├── features/
│   └── document-creation/
│       ├── types.ts
│       ├── document-shell-contract.ts
│       ├── state-display.ts
│       └── index.ts
├── pages/
│   ├── CreateQuotationV2/
│   │   ├── index.tsx
│   │   ├── hooks/
│   │   ├── components/
│   │   └── utils/
│   └── CreateDCV2/
│       ├── index.tsx
│       ├── hooks/
│       └── components/
├── proforma-invoices/
│   ├── pages/
│   │   └── ProformaEditorPage.tsx
│   ├── components/
│   ├── hooks.ts
│   ├── logic.ts
│   └── types.ts
├── invoices/
│   ├── pages/
│   │   └── InvoiceEditorPageV2.tsx
│   ├── components/
│   └── hooks.ts
├── credit-notes/
│   ├── pages/
│   │   └── CreditNoteEditorPageV2.tsx
│   ├── components/
│   ├── hooks.ts
│   └── stock-adjustment.ts
└── modules/
    └── Purchase/
        ├── components/
        │   ├── PurchaseOrdersV2.tsx
        │   └── DebitNoteViewV2.tsx
        ├── hooks/
        └── utils/
```

The tree intentionally keeps document-specific folders and domain modules. The shared layer provides presentation and contracts only; it does not absorb quotation, invoice, purchase, warehouse, or finance business logic.

## Out of Scope

- Implementing this refactor before PRD approval.
- Changing the active route for any document.
- Retiring the legacy screens as part of this PRD.
- Introducing a new global store or replacing existing state libraries.
- Consolidating document database models.
- Consolidating formulas into one universal calculation engine.
- Adding automatic dispatch/challan-to-invoice metadata inheritance.
- Changing manufacturing lot ownership or traceability behavior.
- Changing invoice presentation of batch, expiry, or serial metadata.
- Fixing unrelated Purchase module data-integrity issues.
- Fixing unrelated pre-existing lint, font, SQL, or test-environment failures.

## Further Notes

- The current original CreateQuotation module is the visual and interaction source of truth for the unified entry form. Its current behavior must be inspected at implementation time.
- `qUOTEUI.md` is stale historical context for this work and is intentionally not used as an authority.
- `src/components/document-editor/LINE_ITEMS_BEHAVIOR.md` is a behavior reference, but current CreateQuotation behavior takes precedence where the documents differ.
- `DESIGN.md` and `ERP_Design_System.md` remain binding for field rows, buttons, spacing, and document-section presentation.
- Existing module PRDs and ADRs remain authoritative for business behavior. This PRD only standardizes composition and preserves those contracts.
- Implementation must stop at the end of each phase for review. A phase that changes behavior is not a successful refactor, even if the visual result is correct.
- The first implementation PR should be limited to reconciling the current original CreateQuotation reference with the shared contract. Subsequent documents should copy the reference composition and interaction treatment one document family at a time, while retaining their own state, formulas, queries, and mutations.
- “Copy CreateQuotation” means copy the current UI composition and interaction treatment, not quotation-specific business logic, fields, persistence, or calculations.
