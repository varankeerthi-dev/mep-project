# CFO-UX-Consultant: Proforma Invoice & CreateQuotation Review

**Date:** 25-Jul-2026  
**Attendees:** CFO, UX Engineer, Accounting Consultant  
**Scope:** Proforma Invoice & CreateQuotation modules  

---

## Points Discussed (20 Total)

| # | Topic | Priority | Action |
|---|---|---|---|
| 1 | Document Lifecycle — Status State Machine | P0 | ✅ Implement |
| 2 | Multi-Currency Support (INR/USD/AED/EUR) | P2 | ✅ Implement |
| 3 | Line Item: Free-Form vs Catalog Hybrid | P0 | ✅ Implement (partial) |
| 4 | Discount Chain — Application Order | P0 | ⏸️ Deferred |
| 5 | TCS / TDS Withholding | P2 | ✅ Implement |
| 6 | Revision Management | P1 | ✅ Implement |
| 7 | PO Matching Validation | P0 | ✅ Implement (done) |
| 8 | Rounding — Strategic Policy | P2 | ✅ Implement |
| 9 | PDF Output — Multiple Flavors | P1 | ✅ Implement |
| 10 | Document Conversion — Tracking Chain | P0 | ✅ Implement |
| 11 | Payment Terms — Smart Defaults | P2 | ⏸️ Deferred |
| 12 | Email Integration — Send from Within | P2 | ✅ Implement |
| 13 | Attachments at Line-Item Level | P3 | ⏸️ Deferred |
| 14 | Approval Workflow Integration | P1 | ✅ Implement |
| 15 | Smart Defaults Based on Client History | P2 | ✅ Implement |
| 16 | Retention / Warranty Holdback | P3 | ✅ Implement |
| 17 | Profitability Preview | P3 | ✅ Implement |
| 18 | Batch Operations | P0 | ⏸️ Deferred |
| 19 | Test / Sandbox Mode | P4 | ✅ Implement |
| 20 | Unified Line Item Engine | P0 | ⏸️ Deferred |

---

## Deferred Items (Phase 2)

| # | Rationale |
|---|---|
| 4 (Discount Chain) | Current implementation works; waterfall visualization is UX polish |
| 11 (Payment Terms) | Free-text works; dropdown standardization is low urgency |
| 13 (Attachments) | Requires storage integration; separate feature |
| 18 (Batch Operations) | Requires list page refactor; separate track |
| 20 (Unified Line Item Engine) | Architectural decision; needs dedicated planning |

---

## Detailed Point Summaries

### 1. Document Lifecycle States
**Problem:** Status only has `draft → sent → accepted`. No `expired`, `partially_invoiced`, `revised` states.
**Solution:** State machine with proper transitions. Quotations older than 6 months auto-expire. Conversions update source status to `converted` and lock editing.
**Files affected:** `App.tsx`, all editor pages (quotation, proforma, invoice)

### 2. Multi-Currency Support
**Problem:** System assumes INR. Export clients need USD/AED/EUR.
**Solution:** Currency selector per document with locked exchange rate at creation time. Display both foreign + INR equivalent. Export invoices flagged for GST treatment.
**New DB fields:** `currency`, `exchange_rate`, `foreign_total` on document tables.

### 3. Free-Form vs Catalog Hybrid
**Problem:** PO-imported items have free-form descriptions but no material lookup. Users can't see the description.
**Solution:** InlineDescriptionCell now shows for free-form items (item_id=null + description exists). SearchableItemSelect always available for optional material linking.
**Status:** ✅ Partially implemented (proforma). Needs application to quotation/invoice.

### 5. TCS / TDS Withholding
**Problem:** Government/PSU clients require TDS deduction at source. Not handled.
**Solution:** Configurable TDS section (194C, 194J) per client. Auto-apply on document creation. TDS shown as separate line in breakdown. Audit trail for deduction.

### 6. Revision Management
**Problem:** Editing a document loses the original. No version history.
**Solution:** Revision numbering (`PRO-001 Rev 01`). Preserve original on edit. Comparison view between revisions. "Reason for revision" field (mandatory).

### 7. PO Matching Validation
**Status:** ✅ Largely implemented (over-billing warnings, reason capture, billed_qty tracking).
**Remaining:** Per-line-item remaining qty display in header card.

### 8. Rounding Strategy
**Problem:** Rounding policy is hidden. Impact at scale.
**Solution:** Round-off toggle in header (visible). Show pre-round and post-round values. Consistent per-invoice (not per-line-item) rounding.

### 9. PDF Output Flavors
**Problem:** Users confused about which format to use.
**Solution:** Clear PDF mode selection: Review Copy (watermark), Final Copy (clean), Tax Invoice (GSTIN + IRN + HSN summary), Proforma (simple). Mode shown in document header.

### 10. Document Conversion Tracking
**Problem:** Can't trace Quotation → Proforma → Invoice chain.
**Solution:** Breadcrumb component at top: `QTN-001 → PRO-001 → INV-001`. Each link opens the source document. Status auto-updates on conversion. Source locked after conversion.

### 12. Email Integration
**Problem:** "Send" only marks status. User must manually email PDF.
**Solution:** Send dialog with recipient selection, optional message, inline PDF preview. Track opens/bounces. Legal proof of delivery stored.

### 14. Approval Workflow
**Problem:** No spending threshold enforcement.
**Solution:** Configurable approval thresholds per organisation (e.g., >₹5L requires approval). Lock icon with "Pending Approval" status. Approval notification to manager. Audit trail: who approved, when, conditions.

### 15. Smart Defaults from Client History
**Problem:** Every new document starts blank. High data entry.
**Solution:** On client selection, auto-fill: template, payment terms, discount categories, authorized signatory from most recent document for that client.

### 16. Retention / Warranty Holdback
**Problem:** MEP contracts withhold 5-10% as retention. Not tracked.
**Solution:** Retention % field in header. Document shows Gross, Retention, Net Payable. Retention tracked as balance sheet asset (Receivable).

### 17. Profitability Preview
**Problem:** No visibility into profit margin before sending.
**Solution:** Optional "Profitability" toggle. Shows estimated cost (from purchase rate/cost matrix), selling price, margin % per line item and overall. Visible only to finance-role users.

### 19. Sandbox Mode
**Problem:** New users fear making mistakes in real data.
**Solution:** "🟡 SANDBOX" banner on test documents. "(TEST)" prefix on doc numbers. Documents can be discarded without trace. No effect on real numbering sequences.

---

## CFO's Priority Recommendation

| Phase | Items | Rationale |
|---|---|---|
| **Phase 1 (Now)** | 1, 3, 7, 10, 14 | Core structural improvements, highest compliance impact |
| **Phase 2 (Next Sprint)** | 6, 9, 15, 16 | UX and reporting improvements |
| **Phase 3 (Backlog)** | 2, 5, 8, 12, 17, 19 | Value-add features, lower urgency |

---

## Key Decisions

1. **Rounding**: Apply on invoice total, not per-line-item. Compliant with GST rules.
2. **Retention**: Track as asset (Receivable), not discount. Released after defect liability period.
3. **Over-billing**: Soft warnings + structured reason capture. Not hard blocks.
4. **Currency**: Exchange rate locked at document creation. Not live/market rate.
5. **Sandbox**: Documents prefixed with "(TEST)", no effect on series numbering.

---

*Saved by: Buffy (AI Agent) on 25-Jul-2026*
