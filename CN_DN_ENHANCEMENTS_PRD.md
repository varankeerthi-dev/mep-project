# PRD: Credit/Debit Notes — Signature, Split View, Action Buttons

## Overview
Upgrade Credit Notes and Debit Notes modules to match Invoice module's UX: split-column list/detail view, action button toolbar, signature selection, and PDF template support.

## Features

### 1. DB Migration — `authorized_signatory_id`
- Add `authorized_signatory_id UUID` column to `credit_notes` and `debit_notes` tables
- Reference: `organisations.signatures` JSON array (already exists)

### 2. Split-Column View (CreditNoteViewPage + DebitNoteViewPage)
- **Left panel** (300px fixed): List of all CNs/DNs with search, active item highlighted
- **Right panel** (flex-1): Detail view of selected CN/DN
- Pattern: `flex h-[calc(100vh-48px)] bg-zinc-100 overflow-hidden gap-[20px]`
- Independent scrolling per panel

### 3. Action Buttons Toolbar (in detail view)
- **Edit** → navigate to editor page
- **Print Template** dropdown → Preview PDF / Download PDF / Print PDF / Choose Template
- **Delete** → confirmation dialog (only for Pending status)
- Pattern: `flex flex-wrap items-center gap-2 mb-6`

### 4. Signature Selection (in editor pages)
- Dropdown: `<select>` populated from `organisation.signatures`
- Preview card showing selected signature image
- Stored as `authorized_signatory_id` in form state
- Included in PDF generation

### 5. PDF Signature Rendering
- Add signature image + name to `proGridAdjustmentNotePdf` generator
- Pattern from `QuotationView.tsx`: `doc.addImage(sigUrl, 'PNG', x, y, w, h)`

## Files to Create/Modify

### New Files
- `supabase/migrations/007_cn_dn_signatory.sql`
- `src/credit-notes/pages/CreditNoteViewPage.tsx`
- `src/debit-notes/pages/DebitNoteViewPage.tsx`

### Modified Files
- `src/credit-notes/types.ts` — add `authorized_signatory_id`
- `src/credit-notes/schemas.ts` — add field to Zod schema
- `src/credit-notes/api.ts` — include field in insert/update
- `src/credit-notes/hooks.ts` — update query types
- `src/credit-notes/pages/CreditNoteEditorPage.tsx` — add signature selector
- `src/credit-notes/pages/CreditNoteEditorPage.tsx` — add `authorized_signatory_id` to form
- `src/credit-notes/pages/CreditNoteListPage.tsx` — add route to view page instead of edit
- `src/modules/Purchase/components/DebitNotes.tsx` — add signature selector + view page
- `src/pdf/proGridAdjustmentNotePdf.ts` — add signature rendering

### Routing
- `/credit-notes` → CreditNoteListPage (existing)
- `/credit-notes/view?id=...` → CreditNoteViewPage (new)
- `/credit-notes/edit?id=...` → CreditNoteEditorPage (existing)
- `/credit-notes/create` → CreditNoteEditorPage (existing)
- `/debit-notes/view?id=...` → DebitNoteViewPage (new)
