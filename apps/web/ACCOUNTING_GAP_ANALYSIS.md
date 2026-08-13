# BillFast Finance & Accounting Module — Gap Analysis Report

**Date:** August 12, 2026
**Scope:** `apps/web` (React 19 + Vite + Supabase, Turborepo monorepo, RLS scoped by `organisation_id`)
**Method:** Schema DDL inventory across all 166 migrations + `src/*.sql` files; runtime code search of the accounting / ledger / GST / TDS / manufacturing / Zoho surfaces; cross-checked against `ERP_AUDIT_REPORT.md` (which independently scores Accounting & Finance 2/10).
**Audit prompt source:** BillFast Finance & Accounting Module gap-analysis prompt (scenario → gap analysis → PRD workflow).

---

## Foundational finding — read this first

**The accounting core is a phantom.** Every table and RPC the accounting UI depends on has **no definition anywhere in the repository**:

| Artifact | Evidence |
|---|---|
| `accounts`, `journal_entries`, `journal_entry_lines` | Referenced in `src/pages/accounting/useAccounting.ts` (lines 14–91) and `DayBook.tsx` / `ChartOfAccounts.tsx`, but **0 `CREATE TABLE` matches for any of them** across every `.sql` file in the repo |
| `post_journal_entry` RPC | **Exactly one match in the entire repo** — the call site `useAccounting.ts:128`. No `CREATE FUNCTION post_journal_entry` exists anywhere |
| Accounting migrations | `20240101000105_accounting_core_v13.sql`, `106_accounting_master_fields`, `108_accounting_posting_engine`, `109_seed_chart_of_accounts`, `110_accounting_rls_policies`, `004_ledger_module`, `024_financial_year_settings`, `041_add_currency_to_organisations` — **all 0 bytes** (`wc -c` verified) |
| Migrations overall | Only **22 of 166** migration files are non-empty; the rest are empty placeholders |
| Even core document tables | `invoices`, `invoice_line_items`, `receipts`, `credit_notes`, `client_opening_balances` are **also absent from repo SQL** — the database cannot be recreated from this repo at all |

`ACCOUNTING_COA_DESIGN.md` ("v13.7 Final Pinnacle Blueprint") describes the intended system in detail (posting rules engine, asset register, GSTR-2B, PDC register, MCA 11(g) audit logs) — but it is a **spec, not an implementation**. The Day Book even renders mock values: a fixed date ("17 Jun 2026") and a static "Day Total: 50,000.00 / 25,000.00" row; `FinancialReports.tsx` shows hardcoded dollar figures ("$2,456,789", "45.2%"); `ComplianceReports.tsx` shows "94.5%" / "Certifications: 12".

---

## 1. Results matrix

Legend: ✅ Implemented · ⚠️ Partial (explained) · ❌ Missing

### Section 1 — Chart of Accounts

| Item | Status | Evidence | Notes |
|---|---|---|---|
| CoA table (Assets/Liabilities/Equity/Income/Expense) | ⚠️ Partial | `useAccounting.ts:14-50`, `ChartOfAccounts.tsx` | UI reads `accounts` with `root_type` (Asset/Liability/Income/Expense — **no Equity**). Table has no DDL in repo; works only if hand-created in the live DB |
| Hierarchical (parent–child) | ⚠️ Partial | `useAccounting.ts:33-47` | Tree built from `parent_id`; fine, but blocked by missing schema |
| Custom ledgers under groups | ⚠️ Partial | `useCreateAccount` → insert into `accounts` | UI supports it; insert fails on a fresh DB |
| Normal balance (Dr/Cr) + account type | ❌ Missing | `ChartOfAccounts.tsx` create-modal | Only `account_code` / `name` / `root_type` / `parent_id` — no `normal_balance`, no `account_type` beyond root type |
| Default India-standard CoA seeded per org | ❌ Missing | `20240101000109_seed_chart_of_accounts.sql` = 0 bytes; `generate_zoho.sql` | `generate_zoho.sql` *does* INSERT TDS Payable/Receivable, Depreciation, Subcontractor ledgers — but into a table no migration creates (script is unrunnable) |

### Section 2 — Double-Entry Core

| Item | Status | Evidence | Notes |
|---|---|---|---|
| Journal/ledger with Dr = Cr enforcement | ❌ Missing | `post_journal_entry` call at `useAccounting.ts:128`; no RPC/table anywhere | Day Book "Post Entry" would throw on any environment built from this repo |
| Sub-modules auto-post (sales, purchase, payroll, manufacturing) | ❌ Missing | `ledger/api.ts`, `usePurchaseQueries.ts`, `wipPersistence.ts` | All modules write document tables only; zero ledger posting |
| Voucher numbering (Sales/Purchase/Payment/Receipt/Journal/Contra) | ⚠️ Partial | `document_series` + `get_next_entry_sequence` RPC + `TransactionNumberSeries.tsx` | Generic document numbering exists; no per-voucher-type journal series |
| Edit/delete post-posting policy / reversal | ❌ Missing | `ledger/api.ts` `updateReceipt` / `deleteReceipt` | Receipts/payments freely editable & deletable; only `reverse_production_entry` (stock, `sql/create_reversal_rpc.sql`) exists |
| Accounting period + period lock | ⚠️ Partial | `financial_year_format` / `financial_year_start_month` (default 4) / `current_financial_year` in `NumberingTab.tsx`, `Organisation.tsx`, `ledger/api.ts:getFyDateRange` | FY config real (though unversioned — migration 024 is empty); **no period close/lock** |

### Section 3 — Trial Balance & Financial Statements

| Item | Status | Evidence | Notes |
|---|---|---|---|
| Trial Balance | ❌ Missing | — | No TB anywhere |
| Balance Sheet | ❌ Missing | — | No BS anywhere |
| P&L from COA | ❌ Missing | `ProfitReport.tsx` | Is a **trading comparison** (PO items vs invoice items; profit = sales − purchases), not a P&L |
| Cash Flow Statement | ❌ Missing | — | — |
| Custom date range / Indian FY | ⚠️ Partial | `ProfitReport.tsx` filters; `ledger/api.ts:getFyDateRange` (Apr–Mar) | Filters exist on document reports; nothing statutory |
| Comparative periods (YoY) | ❌ Missing | — | No comparatives |

### Section 4 — Fixed Assets & Depreciation

| Item | Status | Evidence | Notes |
|---|---|---|---|
| Fixed Asset Register | ❌ Missing | No `asset_register` DDL | `EquipmentTab.tsx` / `machineBoard.ts` registers are *operational* (warranty, location), not financial |
| Auto depreciation (WDV/SLM, Schedule II / IT Act) | ❌ Missing | Design doc only (`ACCOUNTING_COA_DESIGN.md` §6) | Depreciation appears only as a phantom seed ledger in `generate_zoho.sql` |
| Depreciation posts to ledger | ❌ Missing | — | No ledger to post to |
| Disposal / gain-loss | ❌ Missing | — | — |
| Talks to Equipment/Warranty module | ❌ Missing | `warranty_claims`, `WarrantyClaimModal.tsx`, `WarrantyClaimsSLA.tsx` | Warranty tracking is **fully siloed** from finance |

### Section 5 — Liabilities

| Item | Status | Evidence | Notes |
|---|---|---|---|
| AP vendor outstanding, bill-wise | ⚠️ Partial | `recalc_vendor_balance` RPC; `VendorLedgerDialog.tsx`; `usePurchaseQueries.ts` | Vendor balances computed client-side from bills/payments — not a ledger |
| AP ageing (0-30/30-60/60-90/90+) | ❌ Missing | `operations/api/mockData.ts` only | Ageing cards are **mocked**; no real AP ageing report |
| Loans/borrowings register + EMI | ❌ Missing | `loans` table | Is HR salary loans — not borrowings; no schedule/EMI |
| Statutory liabilities (GST payable, TDS payable, PF/ESI) as reconcilable ledgers | ❌ Missing | `subcontractor_tds_payments` + `TDSPaymentPanel.tsx` | TDS payable is a *field/tracker* on payments, not a ledger; no GST/PF/ESI payable ledgers, no reconciliation vs returns |
| Provisions (expense/warranty) | ❌ Missing | — | — |

### Section 6 — Accounts Receivable

| Item | Status | Evidence | Notes |
|---|---|---|---|
| Customer outstanding & ledger | ⚠️ Partial | `LedgerDashboard.tsx` + `ledger/api.ts` | Computed as invoices − receipts + `client_opening_balances` + `credit_notes` — document-level, not double-entry |
| Customer ageing | ⚠️ Partial | `follow-up/invoice-escalation-card.tsx` (`days_overdue`), `useOperationsQueries.ts` buckets | Real overdue labels exist in Follow-Up/Operations; `ReportsDashboard.tsx` "Invoice Aging Report" row is **mock data**; nothing reconciled to a ledger |
| Follow-Up Centre reconciles to ledger AR | ❌ Missing | `follow_up_invoice_tracking`, `follow_up_quotation_tracking` | Separate un-reconciled tracker |
| Credit/debit notes for AR adjustments | ⚠️ Partial | `src/credit-notes/` (approval workflow), `debit_notes` (purchase) | Applied to the AR tracker; not posted to any ledger |

### Section 7 — GST Core

| Item | Status | Evidence | Notes |
|---|---|---|---|
| GSTIN storage (org, customer, vendor) | ✅ Implemented | `organisations.gstin`, `clients.gstin`, `purchase_vendors.gstin`, `subcontractors.gstin` + unique index | Present everywhere |
| GSTIN validation | ⚠️ Partial | `utils/subcontractorValidation.ts:6-11` | Regex format check only — **no checksum validation** |
| HSN/SAC on item master + AI parser alignment | ✅ Implemented | `materials.hsn_code` (numeric CHECK in `database-hsn-tax.sql`); `api/parse-document.ts`; `aiMatcher.ts:168` | **Single source of truth** — quotations/invoices/parser all pull from `materials.hsn_code`; good |
| CGST/SGST/IGST auto-split at posting stage | ⚠️ Partial | `CreateQuotation/index.tsx` (`isInterState`), `proforma-invoices/logic.ts:72-88`, invoice editor | Split logic is real **at the document/PDF layer** — but there is no ledger to post it to |
| RCM handling | ⚠️ Partial | `database-purchase-module.sql:164` `reverse_charge` boolean on purchase bills | Flag exists; no RCM ledger/ITC mechanics |
| Place of Supply determination | ⚠️ Partial | state-based inter/intra at document level | No formal PoS engine for goods vs services |
| E-invoicing / IRN | ❌ Missing | — | The "three-phase GST API plan" is **not implemented in any phase** — no code, no IRN |
| E-way bill | ❌ Missing | `TemplatesTab.tsx` `eway_bill: false` | Only a PDF-template column toggle; no generation/tracking |

### Section 8 — GSTR Reports

| Item | Status | Evidence | Notes |
|---|---|---|---|
| GSTR-1 (auto from sales) | ❌ Missing | Closest: HSN summary in `reports/invoiceApi.ts` (`HSNData` grouping) | Internal summary only — **not GSTN-format JSON/Excel** |
| GSTR-3B | ❌ Missing | — | — |
| GSTR-2B/2A reconciliation | ❌ Missing | `gstr2b_reconciliations` is design-doc-only | Requires GSTN API; out of scope today |
| GSTR-9 / 9C groundwork | ❌ Missing | — | — |
| ITC ledger (eligible/ineligible/reversed) | ❌ Missing | — | — |
| Composition-scheme handling | ⚠️ Partial | `gst_treatment` field on vendors/clients | Field exists; no differing billing logic |

### Section 9 — TDS

| Item | Status | Evidence | Notes |
|---|---|---|---|
| Deduction on eligible categories (194C/194J etc.) | ⚠️ Partial | `subcontractor_payments.tds_percent/tds_amount` (`subcontractor_ledger_complete.sql`); `purchase_bills.tds_deducted` | Works for subcontractor/bill payments, but **no section codes, no limits** |
| Form 16A data + 26Q/24Q prep | ❌ Missing | — | — |
| TDS receivable (from customers) | ❌ Missing | phantom 'TDS Receivable' ledger in `generate_zoho.sql` only | No table, no 26AS tracking |

### Section 10 — Bank & Cash

| Item | Status | Evidence | Notes |
|---|---|---|---|
| Bank ledger + reconciliation | ❌ Missing | no `bank_accounts` / `bank_reconciliations` DDL | Design-doc only |
| Multiple bank accounts | ❌ Missing | vendor `bank_account_no`, payment `bank_account_id` | Free-text fields only |
| Cash in hand / petty cash | ⚠️ Partial | `petty_cash_floats` in `modules/AdvanceExpense/` | Petty cash floats exist; no cash ledger |
| PDC lifecycle | ⚠️ Partial | `cheque_no` / `cheque_date` / `cheque_due_date` + upcoming-cheques view in `PaymentsHub.tsx` | Due-date tracking only; no Held/Presented/Cleared/Bounced register |

### Section 11 — Integration Coherence

| Item | Status | Evidence | Notes |
|---|---|---|---|
| Zoho Books as system of record | ❌ Missing | `subscriptions/webhook.ts` = **Stripe/Razorpay billing**; "Zoho" in code = PDF templates (`QTN_ZOHO` / `INV_ZOHO` / `DC_ZOHO`) + `generate_zoho.sql` | **No Zoho Books API integration exists in the repo.** No org flag distinguishes native vs Zoho accounting |
| Manufacturing posts WIP/COGS/stock valuation | ❌ Missing | `wipPersistence.ts` computes WIP valuation on-the-fly from stock; `reverse_production_entry` reverses stock only | Purely operational; no financial mirror |
| BOQ → Quotation → Invoice → ledger posting | ❌ Missing | `DocumentConversionChain.tsx`, `InvoiceEditorPage.tsx` | Dead-ends as document generator + AR tracker |

### Section 12 — Reporting & Controls

| Item | Status | Evidence | Notes |
|---|---|---|---|
| Multi-currency | ❌ Missing | `20240101000041_add_currency_to_organisations.sql` = 0 bytes | Only purchase module carries currency fields (per prior audit) |
| Role-based finance access | ⚠️ Partial | `rbac/permission-catalog.ts`, `org_members`, `is_org_admin` | App-level permissions + org membership exist; no granular finance roles; prior audit found most legacy tables on permissive RLS |
| Financial audit log (who/when/what) | ⚠️ Partial | generic `audit_log` + activity logs | No finance-specific trail; MCA Rule 11(g) `journal_audit_logs` is design-doc-only |

---

## 2. Prioritized gap list

### 🔴 P0 — blocks statutory compliance / books correctness
1. **Accounting schema + posting engine do not exist in-repo** — `accounts`, `journal_entries`, `journal_entry_lines`, `post_journal_entry` (Dr=Cr validated) must be created as real migrations. Nothing else builds.
2. **Repo cannot recreate the DB** — 144/166 empty migrations, including core `invoices` / `receipts` / `credit_notes`. Any fresh environment (CI, new tenant DB, disaster recovery) is broken.
3. **Trial Balance, Balance Sheet, P&L from ledger balances** — the three statements that make books auditable; account balance is currently hardcoded to `0` (`useAccounting.ts:31`).
4. **Bank ledger + reconciliation** — without it the Balance Sheet's cash figure cannot be trusted.
5. **GSTR-1/3B data export** — the HSN grouping groundwork already exists in `reports/invoiceApi.ts`; needs GSTN-format output + ITC ledger to make GST filing possible.

### 🟠 P1 — needed for a credible ERP
6. **Schema-as-code for legacy document tables** (invoices, receipts, opening balances) so finance data is versioned and reproducible.
7. **AR/AP ageing reports** reconciling to the new ledger (Follow-Up labels are close but un-reconciled; AP ageing is mocked).
8. **Posting policy: reversal-only, per-voucher-type numbering, period lock** using the FY settings that already exist.
9. **Fixed assets + automatic depreciation** (dual WDV/SLM per design doc §6), wired to the Equipment/Warranty register.
10. **TDS maturity** — section codes (194C/194J), Form 16A data, quarterly return prep, TDS receivable.
11. **GSTIN checksum validation + RCM/ITC mechanics** (fields already exist on purchase bills).
12. **Manufacturing → WIP/COGS ledger postings** on production completion (as the design doc's §6 mandates).
13. **Finance RBAC + finance audit log** (MCA 11(g) readiness).

### 🟡 P2 — nice-to-have
14. Cash flow statement, comparative periods.
15. Multi-currency (needs the empty migration 041 filled + exchange-rate handling in the posting engine).
16. Petty cash → ledger, full PDC lifecycle, loan/borrowings register with EMI schedules.
17. Provisions (warranty/expense) and composition-scheme billing.
18. E-invoice/IRN + e-way bill integration (the "three-phase GST API plan") — only sensible once GSTR-1/3B data is real.

---

## 3. Verdict: connected ledger, or disconnected trackers?

**This is unambiguously a collection of disconnected trackers — there is no ledger anywhere in the system.** "Ledger" in BillFast means one of three independent, mutually unreconciled client-side computations: (1) **AR** = `invoices − receipts + opening balances + credit notes` summed in `LedgerDashboard.tsx`; (2) **AP** = `purchase_vendors.balance` maintained by the `recalc_vendor_balance` RPC over bills/payments; (3) **Follow-Up Centre** = its own `follow_up_invoice_tracking` amount tags that never reconcile to either. Manufacturing keeps a WIP *valuation* derived from stock movements, the PDF quotation/invoice generators compute CGST/SGST/IGST for print, and subcontractor TDS is tracked in its own payment table — **none of it resolves into double-entry books**. The only component that was *meant* to be the ledger (Day Book → `post_journal_entry`) targets tables and an RPC that exist nowhere in the repository, so the accounting module is a UI shell pointing at a database that was never built. Every P0 in this report is a prerequisite for the same single structural fix: **stand up the real ledger and make every document module post to it** — until then, no Trial Balance, Balance Sheet, P&L, GST return, or audit trail can exist, and BillFast cannot replace Tally or a Zoho Books subscription.

---

## 4. Claims in the audit prompt that could not be verified (or are false in the current repo)

- **Zoho Books integration** — not present. `subscriptions/webhook.ts` handles Stripe/Razorpay subscription billing; "Zoho" in code refers only to PDF templates (`QTN_ZOHO`, `INV_ZOHO`, `DC_ZOHO`) and the unrunnable `generate_zoho.sql`.
- **Three-phase GST API integration plan** — unimplemented at every phase (no GSTIN API, no IRN, no e-way bill code).
- **Equipment Warranty tracking talking to Finance** — confirmed siloed (operational tables only).
- **AiDocumentParser HSN-first matching** — confirmed true, and correctly centralized on `materials.hsn_code`; keep this as the single source of truth.

*Report generated August 12, 2026 · Companion docs: `ACCOUNTING_COA_DESIGN.md` (spec), `ERP_AUDIT_REPORT.md` (module-wide audit).*
