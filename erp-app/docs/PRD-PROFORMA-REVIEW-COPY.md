# PRD: Proforma → Tax Invoice Preview

**To:** Engineering
**From:** Product
**Date:** 2026-06-26
**Status:** Approved (revised 2026-06-26)

---

## Problem Statement

After a quotation is accepted, the office frequently needs to send a near-final Tax Invoice to the customer for commercial review before issuing the official document. Customers check item descriptions, GST details, quantities, address, PO reference, and wording. This review takes 2–3 days.

During those days, other invoices are issued to other customers. If we generate a real Invoice before customer confirmation, the invoice number sequence gets gaps (e.g., Invoice #101 sent for review, but #102–#104 go to other customers, making the real invoice #105 — customer confusion).

We need a way to show the customer exactly what the final Tax Invoice will look like **without** consuming an invoice number, creating an accounting entry, or requiring a new document type.

---

## Solution

Reuse the existing **Proforma Invoice** module. Add two toggles grouped under an "Invoice Preview" heading:

```
Invoice Preview
────────────────────
☑ Render as Tax Invoice
    ☑ Show "DRAFT" Watermark
```

The watermark checkbox is indented — visually subordinate to the render toggle, auto-enabled when render is turned on, but independently toggleable.

Only `render_as_tax_invoice` is persisted in the database. `showWatermark` is a print-time preference only (optional localStorage for convenience).

---

## Scope

| Area | In Scope | Out of Scope |
|------|----------|-------------|
| Proforma Editor UI | Two toggles in right sidebar | Touch Invoice module |
| PDF (React-PDF) | Conditional headers, labels, watermark | New PDF layout |
| PDF (Classic/Vertical templates) | Same conditional logic | New template types |
| Database | One boolean column `render_as_tax_invoice` on `proforma_invoices` | New tables, new document types |
| Watermark persistence | localStorage only (print-time preference) | Store in database |
| List page | "Invoice Preview" badge when `render_as_tax_invoice` is true | New workflow stages |
| Download filename | Derives from `render_as_tax_invoice` flag (no extra state) | Change save logic |
| Email subject | Derives from `render_as_tax_invoice` flag (no extra state) | New email infrastructure |

---

## What Changed vs Existing

| Aspect | Before | After |
|--------|--------|-------|
| Proforma header | `PROFORMA INVOICE` | `TAX INVOICE` when toggle ON |
| Subtitle | `Preliminary Invoice` | `(REVIEW COPY)` when toggle ON |
| Number label | `PI No:` | `Invoice No:` when toggle ON |
| Date label | `Date:` | `Invoice Date:` when toggle ON |
| Number value | Proforma number | Blank when toggle ON |
| Date value | Created date | Blank when toggle ON |
| Watermark | None | Diagonal `DRAFT` when watermark toggle ON |
| DB schema | `proforma_invoices` table | +1 column `render_as_tax_invoice boolean` |
| Download filename | `Proforma-{num}.pdf` | `Tax-Invoice-Preview-{num}.pdf` (derived from flag, no extra state) |
| List page | No indicator | "Invoice Preview" badge when flag is true |

---

## Toggle Behavior

### Toggle 1: "Render as Tax Invoice"

| State | Header | Subtitle | Number Label | Date Label | Number/Date Value | Watermark Default |
|-------|--------|----------|-------------|-----------|-------------------|------------------|
| OFF | PROFORMA INVOICE | Preliminary Invoice | PI No: | Date: | Populated | OFF |
| ON | TAX INVOICE | (REVIEW COPY) | Invoice No: | Invoice Date: | **Blank (empty)** | ON |

Invoice Number and Invoice Date values are **always empty** when ON — literally nothing after the colon. Not "—", not "Pending". Just blank. This signals "to be assigned" and avoids confusion with real issued invoices.

### Toggle 2: "Show DRAFT Watermark" (Print-time only)

Completely independent. **Not persisted to database.** Defaults to `true` when Toggle 1 is ON, `false` otherwise. User can override at print/preview time. Optionally remembered in `localStorage` per user (not per document).

| Toggle 1 (Review Copy) | Toggle 2 (Watermark) | Result |
|------------------------|----------------------|--------|
| OFF | OFF | Normal Proforma as today |
| OFF | ON | Proforma with DRAFT watermark |
| ON | OFF | Tax Invoice layout, no watermark |
| ON | ON | Tax Invoice layout with DRAFT watermark |

---

## Database Changes

```sql
ALTER TABLE proforma_invoices 
ADD COLUMN render_as_tax_invoice boolean DEFAULT false;
```

**`showWatermark` is NOT stored in the database.** It is a print-time preference only, optionally persisted in `localStorage` per user. This avoids document-level toggle conflicts when multiple users process the same proforma.

**No other schema changes.** No new tables. No new indexes.

---

## Files Changed

### Proforma Editor (`src/proforma-invoices/pages/ProformaEditorPage.tsx`)
- Add `renderAsTaxInvoice` state (boolean, default false)
- Add `showWatermark` state (boolean, default follows `renderAsTaxInvoice` — ON when render is ON)
- Add grouped UI in the Adjustments & Summary card:
  ```
  Invoice Preview
  ────────────────────
  ☐ Render as Tax Invoice
      ☐ Show "DRAFT" Watermark
  ```
  Watermark checkbox indented ~16px, auto-enabled when render is ON, but independently toggleable
- Load/save `render_as_tax_invoice` from DB on existing proforma
- Pass flags to PDF generation on Save & Print
- `showWatermark` optionally read/written to `localStorage` key `proforma_watermark_default` (not per-document)

### PDF Types (`src/proforma-invoices/pdf-types.ts`)
- Add `renderAsTaxInvoice?: boolean` to `ProformaPdfData` / `ProformaPdfOptions`
- Add `showWatermark?: boolean` to `ProformaPdfData` / `ProformaPdfOptions`

### PDF Generator (`src/proforma-invoices/pdf.tsx`)
- Accept `renderAsTaxInvoice` and `showWatermark` in options (derived from DB flag + UI state — no extra persistence)
- Pass through to `buildProformaPdfData`
- Conditional download filename: `Tax-Invoice-Preview-{num}.pdf` vs `Proforma-{num}.pdf` (derived, not stored)

### PDF Document (`src/proforma-invoices/pdf-document.tsx`)
- Conditionally render title: `TAX INVOICE` vs `PROFORMA INVOICE`
- Conditionally render subtitle: `(REVIEW COPY)` vs `Preliminary Invoice`
- Conditionally render field labels: `Invoice No:` vs `PI No:`, `Invoice Date:` vs `Date:`
- Conditionally blank out number and date values
- Conditionally render DRAFT watermark:
  ```tsx
  {showWatermark && (
    <Text style={{
      position: 'absolute',
      top: '30%',
      left: '10%',
      fontSize: 180,
      color: '#000',
      opacity: 0.1,
      transform: 'rotate(-45deg)',
      fontFamily: 'Helvetica-Bold',
    }}>
      DRAFT
    </Text>
  )}
   ```

### Classic/ProGrid Template (`src/pdf/proGridProformaPdf.ts`)
- Accept `renderAsTaxInvoice` and `showWatermark` params
- Same conditional header/label/watermark logic using jsPDF

### Vertical Template (`src/templates/VerticalTemplate.tsx`)
- Accept `renderAsTaxInvoice` and `showWatermark` params
- CSS-based watermark: `position: fixed; transform: rotate(-45deg); opacity: 0.1; font-size: 180px; pointer-events: none;`

### API (`src/proforma-invoices/api.ts`)
- Read/write `render_as_tax_invoice` column in `buildProformaPayload` and `parseProformaRecord`
- Ensure `getProformaById` returns the flag

### List Page (`src/proforma-invoices/pages/ProformaListPage.tsx`)
- Show small outlined `Invoice Preview` badge next to items with `render_as_tax_invoice = true`
- Badge styled: outlined border, muted color, `font-size: 10px` — visible but not distracting
- Intent: users scanning the list immediately identify which proformas were sent as invoice previews

### Email (`src/proforma-invoices/pdf.tsx` — `emailProformaInvoice`)
- Conditional subject line: derived from `renderAsTaxInvoice` flag (no separate state)
- When ON: `"Tax Invoice Preview - {num}"`
- When OFF: `"Proforma Invoice - {num}"`

---

## What Stays Identical

| Aspect | Reason |
|--------|--------|
| Customer details block | No change needed |
| Company details block | No change needed |
| Item table rows | Same data, same columns |
| GST calculations (CGST/SGST/IGST) | Same document, same numbers |
| Totals and subtotals | Same numbers |
| Amount in words | Same |
| Bank details | Same |
| Terms & conditions | Same |
| Notes | Same |
| Signature area | Same |
| Authorized signatory | Same |
| Layout and column widths | Same |
| All DB columns except `render_as_tax_invoice` | Schema stability |
| Invoice module | Untouched |

---

## Edge Cases

| Edge Case | Handling |
|-----------|----------|
| User creates proforma with toggle ON, later edits it | `render_as_tax_invoice` persisted in DB — toggle state restored on re-open |
| User converts review-copy proforma to Invoice | The Invoice module always produces a real invoice. Toggle flag is irrelevant at conversion. The proforma's `converted_invoice_id` is set as normal. |
| User prints/emails with toggle ON | Filename and email subject use "Tax Invoice Preview" naming (derived from flag, no separate state) |
| User prints/emails with toggle ON + watermark ON | Both applied — watermarked Tax Invoice preview |
| User prints/emails with toggle ON + watermark OFF | Clean Tax Invoice preview, no watermark |
| `pi_number` is empty | Normal proforma shows `PI-00045`; Review Copy shows **blank** after `Invoice No:` |
| Template not found | Falls back to default Proforma PDF logic — toggle still applies |
| Classic template (ProGrid) | Same conditional logic via jsPDF |
| Vertical template | Same conditional logic via CSS |

---

## Non-Goals

- No new "Draft Invoice" document type
- No new workflow stage or approval state
- No popups on print
- No footer banners or disclaimers (beyond the DRAFT watermark)
- No changes to the Invoice module
- No stock deduction
- No accounting entry generation
- No invoice number consumption

---

## Implementation Order

| Step | File | Changes | Risk |
|------|------|---------|------|
| 1 | `src/proforma-invoices/pdf-types.ts` | Add `renderAsTaxInvoice`, `showWatermark` fields | Low |
| 2 | `src/proforma-invoices/api.ts` | Read/write `render_as_tax_invoice` column | Low |
| 3 | `src/proforma-invoices/pdf-document.tsx` | Conditional title, labels, watermark | Medium |
| 4 | `src/proforma-invoices/pdf.tsx` | Thread flags, conditional filename, email subject | Low |
| 5 | `src/proforma-invoices/pages/ProformaEditorPage.tsx` | Two toggles in sidebar, load/save from DB, localStorage for watermark | Medium |
| 6 | `src/pdf/proGridProformaPdf.ts` | Conditional classic template rendering | Medium |
| 7 | `src/templates/VerticalTemplate.tsx` | Conditional vertical template rendering | Medium |
| 8 | `src/proforma-invoices/pages/ProformaListPage.tsx` | `Invoice Preview` outlined badge | Low |

## Rollback

`git revert` the PR commit. Zero data loss — `render_as_tax_invoice` column is merely ignored by older code.

## Validation

```bash
# Verify no invoice number is consumed when proforma with toggle ON is saved
grep -n "generateInvoiceNumber\|incrementInvoiceNumber" src/proforma-invoices/

# Verify toggle never appears in invoice module
grep -rn "render_as_tax_invoice" src/invoices/

# Verify showWatermark is NOT in the database
grep -rn "show_watermark" src/proforma-invoices/api.ts

# Visual: open proforma, toggle ON → PDF preview → verify header/labels/watermark
# Visual: toggle OFF → PDF preview → verify normal proforma
# Visual: watermark only, review copy only, both, neither — all 4 combinations
```

## Branch

`feat/proforma-review-copy` → single commit → PR.
