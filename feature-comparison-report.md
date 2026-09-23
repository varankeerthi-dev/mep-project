# Feature & Logic Comparison Report (vs Reference)

## Executive Summary

- **Overall verdict:** **Mixed (Core Operational Workflows Strong; Formal Statutory Accounting Layer Needs Work)**
- **Quick summary:**
  - **Where code is Superior / Strong:** Operational integration across Sales Invoices, Purchase Bills, Debit/Credit Notes, Subcontractors, Advances, and HR/Payroll is functionally rich. Automated database RPCs (`create_advance_expense_atomic`, `disburse_advance_expense_atomic`, `record_debit_note`, `finalize_payroll_run_atomic`) guarantee atomic GL journal creation and automatic tax/vendor balance updates directly from business operations.
  - **Where code is Lower / Missing:** The formal accounting backbone lacks statutory depth. The Chart of Accounts UI is superficial (`useChartOfAccounts` hardcodes account balance to `0`, search input is unhooked/cosmetic, no Schedule III or GST/TDS mapping, no cycle detection or depth limits). Individual parties (Debtors/Creditors) are NOT auto-provisioned as subledgers in `accounts`. Most critically, there are **no financial statement screens** (Trial Balance, Balance Sheet, Profit & Loss, Schedule III) in the user interface, no automated Fixed Asset depreciation engine, and no compliance adjustment wizards (GST ITC offset or TDS challan adjustment).
- **Top 3 strengths vs reference:**
  1. **Atomic multi-step advance & petty cash engine:** Implemented via stored procedures `create_advance_expense_atomic` and `disburse_advance_expense_atomic` in PostgreSQL, managing real-time posting between Employee Advances (`1400`), Petty Cash Float (`1301`), and Operating Expenses (`4100`) with concurrency locks.
  2. **Integrated operational workflows with automatic tax adjustments:** Purchase returns seamlessly convert to Debit Notes (`purchaseReturnService.ts`), executing backend RPC `record_debit_note` that resolves supplier state vs company state, splits intra/inter-state GST, reverses input tax, and updates vendor balances atomically.
  3. **Comprehensive subcontractor lifecycle & retention management:** Subcontractor work orders (`SubcontractorWorkOrderCreate.tsx`, `ledgerCalculator.ts`) accurately compute retention money deductions, line-item milestone billing, and TDS calculations.
- **Top 3 gaps vs reference:**
  1. **Complete absence of General Ledger financial statements in the UI:** There is no Trial Balance view, no Balance Sheet, no Profit & Loss, and no Schedule III reporting interface. Reports under `/reports` only query project materials rather than accounting ledgers.
  2. **Superficial Chart of Accounts & missing party subledgers:** In `ChartOfAccounts.tsx` and `useAccounting.ts:31`, closing balance is hardcoded to `0`. The search input is unhooked JSX. Customers and vendors do not get auto-created subledger accounts under control accounts `1200` and `2100`.
  3. **Missing compliance adjustments and fixed asset engine:** No automated GST ITC setoff engine (GSTR-3B monthly offset), no TDS monthly adjustment/challan workflow, and no Fixed Asset register with automated straight-line/WDV depreciation.

---

## 1. Custom Account Creation (CoA)

| Area | Reference Expectation | Current Implementation (file:line + evidence) | Verdict (Superior / Equal / Lower / Missing) | What's better in our code | What's missing / weaker | Suggested improvement | Effort |
|---|---|---|---|---|---|---|---|
| **Custom creation flow & fields** | Comprehensive metadata: Code, Name, Parent, Account Type (`Asset`, `Liability`, `Equity`, `Income`, `Expense`), Nature (`Dr`/`Cr`), Schedule III mapping, Is Control Account, Subledger Type (`Debtor`, `Creditor`, `Bank`, `Employee`, `None`), GST Applicable (`Y`/`N`), TDS Applicable & Section (`194C`, `194J`), Default SAC, System Account flag. | `apps/web/src/pages/accounting/ChartOfAccounts.tsx:161-204` & `useAccounting.ts:100-119`. Modal only captures: `account_code`, `name`, `root_type` (`Asset`, `Liability`, `Income`, `Expense`), `parent_id`. | **Lower** | Simple and lightweight UI form without complex jargon for beginners. | Missing Nature (`Dr`/`Cr`), Schedule III classification, Subledger configuration, GST/TDS section links, SAC/HSN codes, and System Account flag. | Add extended metadata tabs/fields to `ChartOfAccounts.tsx` and alter `accounts` schema to store Schedule III, normal balance, and tax rules. | 2 days |
| **Hierarchy & parent-child logic** | Strict tree hierarchy with max depth (4-5 levels), cycle prevention (cannot set a descendant as parent), and prohibition of moving/re-parenting system accounts. | `apps/web/src/pages/accounting/ChartOfAccounts.tsx:39-50` & `useAccounting.ts:20-46`. Client-side tree built using Javascript `Map` matching `parent_id`. | **Lower** | Simple client-side tree flattening and recursive rendering. | Zero validation preventing circular references (e.g., node A -> parent B -> parent A). No depth limit enforcement. | Add Postgres trigger or recursive CTE check to prevent circular loops; limit UI depth to 4 levels (`Group` -> `Sub-group` -> `Control` -> `Ledger`). | 1 day |
| **Numbering scheme** | Suggested and validated numbering scheme per Indian standards (1000-1999 Assets, 2000-2999 Liabilities, 3000-3999 Equity, 4000-4999 Income, 5000-5999 Expenses). Auto-suggest next sequential code. | `ChartOfAccounts.tsx:162-169`. Free-form text input `<input value={formData.account_code} />`. | **Lower** | Allows arbitrary custom codes without restricting users to rigid formats. | No auto-generation, no validation of code format or range matching root type, no conflict warnings until DB insert fails on duplicate key. | Auto-suggest next available 4-digit code based on selected root type and parent group. | 1 day |
| **Pre-built CoA template (Onboarding)** | Pre-seeded Chart of Accounts tailored for Indian IT/Design companies (71 accounts in `CoA_Import_India.csv` covering SAC 998311, TDS 194J, Schedule III groups). | Database seed migration creates basic root accounts; frontend has no template preview, selection wizard, or import CTA. If org starts with empty accounts table, view displays *"No accounts found"*. | **Lower** | Minimal initial footprint. | No interactive template import or software/design industry onboarding wizard. | Add an "Apply Industry Standard Template" button in `ChartOfAccounts.tsx` executing bulk insert of the 71 standard accounts from `CoA_Import_India.csv`. | 2 days |
| **System vs User account protection** | System accounts (`1200 Trade Receivables`, `2100 Trade Payables`, `1100 Cash/Bank`, `2210 Output GST`, etc.) must be locked from deletion, code change, or re-parenting. | `apps/web/src/pages/accounting/ChartOfAccounts.tsx:18-36`. UI only renders an "Add Child" action. No explicit edit/delete actions, but DB schema has no `is_system` protection trigger. | **Lower** | Users cannot accidentally delete accounts from the UI because delete button is omitted. | No programmatic protection in API or database against deleting or altering critical system accounts via direct queries or future API calls. | Add `is_system BOOLEAN DEFAULT false` column in `accounts` table with a PostgreSQL `BEFORE DELETE OR UPDATE` trigger rejecting modifications to system accounts. | 0.5 days |
| **Extensibility & reporting impact** | Adding user-defined account groups or sub-ledgers should dynamically reflect in Trial Balance, Balance Sheet, and P&L under correct Schedule III heads. | User can add groups (`is_group: true`) and ledgers (`is_group: false`), but closing balances are not computed in CoA view (`balance: 0`), and there are no financial reports rendering these accounts. | **Lower** | Infinite dynamic hierarchy can be created by users. | Since financial statement screens are absent, user-created accounts have no downstream reporting impact. | Wire dynamic account tree into a proper Trial Balance and Schedule III financial statement generator. | 3 days |

---

## 2. Ledgers (Masters)

| Area | Reference Expectation | Current Implementation | Verdict | Better in our code | Missing / weaker | Suggested improvement | Effort |
|---|---|---|---|---|---|---|---|
| **Customer master** | Unified ledger master or customer table linked to Control Account `1200`, with PAN, GSTIN, State Code, MSME, Credit Limit, Payment Terms, Currency, Billing/Shipping address. | `apps/web/src/pages/sales/Clients.tsx` & `ClientCreateModal.tsx`. Captures Name, Email, Phone, GSTIN, PAN, State, Billing & Shipping Address, Payment Terms. | **Equal** | Clean UI, full contact and multi-address management, integrated customer invoice history. | Does not link to a dedicated subledger in `accounts`; no credit limit enforcement logic; currency is locked to INR. | Add Credit Limit field with validation in invoice creation; link client ID to subledger tagging. | 1 day |
| **Vendor master** | Master record linked to Control Account `2100`, capturing PAN, GSTIN, State Code, MSME registration type & Udyam number (for 45-day MSME rule), TDS section (`194C`/`194J`), Bank Account details. | `apps/web/src/pages/purchase/Vendors.tsx`. Captures Vendor Name, GSTIN, PAN, State, Contact, Bank Details (Account, IFSC), MSME registration status. | **Equal** | Captures essential Indian statutory fields (GSTIN, PAN, MSME, Bank IFSC). | Missing MSME Udyam registration number verification and default TDS section tag (`194C` 1%/2% vs `194J` 2%/10%). | Add default TDS Section and Udyam Registration number fields in `Vendors.tsx`. | 1 day |
| **Employee, Bank & Project masters** | - Employee: Linked to `2150 Salaries Payable` & `1400 Advances`.<br>- Bank: Linked to `1110 Bank Accounts` with IFSC, Account No, OD limit.<br>- Project: Linked for analytical cost-center accounting. | - Employees: `apps/web/src/pages/hrms/Employees.tsx`<br>- Bank Accounts: `bank_accounts` table.<br>- Projects: `apps/web/src/pages/projects/` | **Equal** | Full-fledged operational domain models with payroll salary structures and project material tracking. | Separate operational tables; none of these entities are auto-mapped as subledgers in the Chart of Accounts `accounts` table. | Expose GL account mapping directly on Bank Account and Employee profile creation forms. | 2 days |
| **Auto-ledger creation** | Creating a customer/vendor/bank/employee automatically creates a ledger account under the respective control account (e.g. `1200-001 Acme Corp` under `1200 Trade Receivables`). | `apps/web/supabase/migrations/20240101000156_double_entry_gl_engine.sql` has `ensure_gl_account_exists`, but it only auto-provisions generic system accounts (`1200`, `2100`, `1400`, `4100`), NOT individual party subledgers. | **Lower** | Avoids cluttering the Chart of Accounts tree with thousands of individual customer and vendor ledger accounts. | Does not support subledger account numbering; party identification relies entirely on `party_type` + `party_id` metadata on `journal_entry_lines`. | Implement an automated database trigger or service that auto-creates an account record or maintains subledger views under control accounts. | 2 days |
| **Ledger statements** | Comprehensive party ledger view: Opening Balance, chronological Dr/Cr transactions, voucher reference numbers, running balance, date range filter, export to PDF/Excel. | `apps/web/src/pages/sales/PartyLedger.tsx` & `LedgerDashboard.tsx`. Displays invoices, debit notes, and payment receipts for a selected client/vendor. | **Lower** | Good visual timeline of invoices and payment receipts for clients and vendors. | Statement is built by joining operational tables (`invoices`, `purchase_bills`) rather than querying the General Ledger (`journal_entry_lines`). Excludes manual journal vouchers. | Re-target `PartyLedger.tsx` to query `journal_entry_lines WHERE party_id = :id` joined with `journal_entries` to guarantee complete accounting veracity. | 2 days |
| **Custom ledgers** | Ability to create arbitrary ledgers under user-defined groups (e.g. `Staff Welfare`, `Software Licenses - Cloud`, `Legal & Professional Charges`). | `ChartOfAccounts.tsx:125-130`. Users can click "New Ledger", specify an account code, name, root type, and parent group. | **Equal** | Fully flexible custom ledger creation under any selected parent group. | No template suggestion for typical software/design agency expenses; no validation of code uniqueness before submission. | Add code format suggestions and auto-fill parent root type. | 0.5 days |

---

## 3. Assets & Liabilities

| Area | Reference Expectation | Current Implementation | Verdict | Better in our code | Missing / weaker | Suggested improvement | Effort |
|---|---|---|---|---|---|---|---|
| **Fixed Asset master** | Fixed Asset register capturing Asset Category (Computers, Office Equipment, Furniture), Acquisition Date, Original Cost, Accumulated Depreciation, Net Book Value, Serial No, Location. | Static asset accounts exist in CoA (`accounts.root_type = 'Asset'`). No dedicated Fixed Asset master or register table in `apps/web`. | **Missing** | Assets can be created as general ledger accounts in CoA. | No asset register table, no tracking of acquisition dates, serial numbers, warranty, or Net Book Value (NBV). | Create a `fixed_assets` table capturing asset details, original cost, and linking to Asset & Accumulated Depreciation GL accounts. | 3 days |
| **Depreciation logic** | Automated monthly/annual depreciation calculations (Straight-Line Method SLM or Written Down Value WDV) per Companies Act 2013 Schedule II rates (e.g. Computers: 3 years / 63.16% WDV). | No automated depreciation calculation logic or cron/RPC in the codebase. All depreciation must be calculated manually by the accountant and posted via manual JV. | **Missing** | Avoids rigid automated depreciation errors if accountant prefers different tax vs book depreciation rates. | Complete absence of automated depreciation engine or schedule calculator. | Implement an RPC/service to compute monthly straight-line depreciation across active fixed assets and post automated JVs (Dr Depreciation Expense, Cr Accumulated Depreciation). | 3 days |
| **Trade Payables & Receivables** | Sub-ledger accounting for all AP/AR with real-time balance reconciliation against control accounts `2100` and `1200`. Bill-by-bill matching. | Operational tracking via `invoices` and `purchase_bills`. When vouchers are posted, `post_journal_entry` updates `accounts.current_balance` for `1200` and `2100`. | **Equal** | Bill-by-bill status tracking (`draft`, `approved`, `partially_paid`, `paid`) and automated balance updates in `update_account_balance`. | Direct day-book entries to `1200`/`2100` do not require invoice allocation, which can cause GL balance to drift from unpaid invoice totals. | Add bill-by-bill knockoff/allocation modal when posting receipts or payments in DayBook. | 2 days |
| **Advances & deposits** | Separate ledgers and tracking for: Employee Advances (`1400`), Vendor Advances (`1410`), Customer Advances (`2110`), and Security Deposits (`1500`). Proper settlement against final invoices. | `advances_expenses` table with atomic RPCs: `create_advance_expense_atomic` and `disburse_advance_expense_atomic`. Automatically debits `1400 Employee Advances` and credits `1301 Petty Cash Float` / Bank. | **Superior** | Stored procedure handles atomic disbursement, approval status, and GL double-entry in a single transaction with concurrency safety. | Vendor and customer advance settlements against purchase bills and sales invoices are partially manual. | Add an "Apply Advance" toggle in `InvoiceEditorPage.tsx` and `Bills.tsx` to automatically knock off advances. | 2 days |
| **Prepaid expenses & amortisation** | Tracking annual software subscriptions (AWS, GitHub, Figma, Google Workspace) under Prepaid Expenses (`1450`), with automated monthly amortization JVs (Dr Software Expense, Cr Prepaid Expenses). | Static account `1450 Prepaid Expenses` can be created, but all amortization entries must be manually posted via DayBook. | **Lower** | Users can record prepaid expenses and manually amortize. | No recurring expense amortization schedule or automated monthly posting. | Implement a recurring journal entry / amortization schedule module for prepaid SaaS subscriptions. | 2 days |

---

## 4. Features & Voucher Logic

| Feature / Voucher Type | Reference Expectation | Current Implementation (trace) | Verdict | Better in our code | Missing / weaker | Suggested improvement | Effort |
|---|---|---|---|---|---|---|---|
| **1. Sales Invoice (`TAX_INV`)** | Bill customer for design/software services (SAC 998311). Dr Debtor (`1200`), Cr Revenue (`4000`), Cr Output CGST (`2210`), Cr Output SGST (`2211`) or Cr Output IGST (`2212`). | `apps/web/src/pages/sales/InvoiceEditorPage.tsx` -> saves to `invoices` table and line items. Generates PDF, tracks status. | **Equal** | Rich invoice editor with line-item discounts, GST tax calculation, PDF generation, and payment link generation. | Invoices do not automatically call `post_journal_entry` upon approval; GL posting is triggered asynchronously or through separate hooks. | Add automated `post_journal_entry` trigger on invoice status change to `approved` or `paid`. | 1 day |
| **2. Credit Note (`CRN`)** | Sales return or price reduction with GST credit adjustment under Section 34. Dr Sales Return (`4010`), Dr Output CGST/SGST/IGST, Cr Debtor (`1200`). | `apps/web/src/pages/sales/CreditNoteEditorPageV2.tsx` -> saves to `credit_notes` table, calculates tax split based on customer state vs company state. | **Equal** | Comprehensive UI capturing original invoice reference, reason code, and state-based tax reversal. | Does not automatically verify that credit note date is within statutory GST annual deadline (30th November following FY end). | Add GST statutory deadline validation warning on credit note submission. | 0.5 days |
| **3. Debit Note (`DBN`)** | Purchase return or supplier price correction under Section 34. Dr Vendor (`2100`), Cr Purchase Return / Expense (`5010`), Cr Input CGST/SGST/IGST (`1310`/`1311`/`1312`). | `apps/web/src/pages/purchase/DebitNotes.tsx` -> calls PostgreSQL RPC `record_debit_note`. Automates GL posting, tax reversal, and vendor balance adjustment. | **Superior** | Executed via hardened atomic database RPC `record_debit_note`, verifying state comparison, reversing input tax, and checking period lock. | None. This flow is rock-solid and verified. | None needed. | Completed |
| **4. Purchase Bill (`BILL`)** | Record vendor expense/materials. Dr Expense/Inventory (`5000`), Dr Input CGST/SGST/IGST (`1310-1312`), Cr Vendor (`2100`). | `apps/web/src/pages/purchase/Bills.tsx` -> saves to `purchase_bills`. Computes intra/inter-state GST and tracks payment status. | **Equal** | Supports item-level HSN/SAC codes, tax rates, vendor bill attachments, and multi-currency notes. | TDS deduction on bill creation is not unified into the bill form (handled separately in Subcontractor work orders). | Embed TDS deduction line (`194C`/`194J`) directly into `Bills.tsx`. | 2 days |
| **5. Purchase Return (`PR`)** | Physical return or rejection of materials to vendor, triggering debit note. | `apps/web/src/services/purchaseReturnService.ts` -> function `convert_purchase_return_to_debit_note` invokes `record_debit_note` RPC. | **Equal** | Clean programmatic bridge connecting material return workflow directly to financial debit note. | None. | None needed. | Completed |
| **6. Receipt Voucher (`RCPT`)** | Receive funds from customer. Dr Bank (`1110`) / Cash (`1100`), Cr Debtor (`1200`). | Supported in `DayBook.tsx` (`voucher_type = 'Receipt'`) and `apps/web/src/pages/sales/PaymentReceiveModal.tsx`. | **Equal** | Allows direct customer invoice payment recording as well as unallocated general ledger receipt vouchers. | DayBook receipt entry does not provide a party picker or invoice knock-off selector. | Add customer and invoice knock-off selector to `DayBook.tsx` when voucher type is `Receipt`. | 1 day |
| **7. Payment Voucher (`PYMT`)** | Pay vendor, employee, or operating expense. Dr Vendor (`2100`) / Expense, Cr Bank (`1110`) / Cash (`1100`). | Supported in `DayBook.tsx` (`voucher_type = 'Payment'`) and `VendorPaymentModal.tsx`. | **Equal** | Dual-path: operational vendor payment modal with bill allocation + generic payment voucher in DayBook. | DayBook payment modal lacks bank balance check before posting. | Add live bank balance warning in DayBook payment lines. | 0.5 days |
| **8. Contra Voucher (`CNTR`)** | Transfer between cash and bank accounts (e.g. Cash withdrawal, Cash deposit, Bank-to-Bank transfer). Dr Bank A, Cr Bank B. No income/expense involvement. | Supported in `DayBook.tsx` (`voucher_type = 'Contra'`). | **Equal** | Properly calls `post_journal_entry` enforcing balanced Dr and Cr. | Does not restrict account selection in UI to only Cash/Bank asset accounts. A non-accountant could pick an expense account. | Restrict account dropdown in `DayBook.tsx` to `root_type = 'Asset'` and `is_group = false` when voucher type is `Contra`. | 0.5 days |
| **9. Journal Voucher (`JV`)** | Non-cash accounting adjustments, year-end accruals, depreciation, rectification. | Supported in `DayBook.tsx` (`voucher_type = 'Journal'`). | **Equal** | Allows multi-line journal vouchers with individual debit and credit amounts. | UI lacks client-side Dr = Cr validation before calling the RPC; throws Postgres error if unbalanced. | Add real-time difference badge (`Total Dr - Total Cr`) disabling the "Post Entry" button until difference is `0.00`. | 0.5 days |
| **10. Expense Voucher (`EXP`)** | Direct out-of-pocket operating expenses. Dr Expense (`5100`), Cr Bank (`1110`) / Cash (`1100`). | `apps/web/src/pages/finance/Expenses.tsx` + `advances_expenses` RPC. | **Equal** | Integrated with receipt upload, expense categorization, and approval status. | None. | None needed. | Completed |
| **11. Petty Cash Voucher (`PC`)** | Petty cash float replenishment and petty expense claims. Dr Petty Cash Float (`1301`), Cr Bank (`1110`). | Handled via `disburse_advance_expense_atomic` in `advances_expenses` workflow. | **Superior** | Atomic stored procedure specifically handles petty cash float disbursement with double-entry GL automation. | None. | None needed. | Completed |
| **12. Payroll JV (`PAYROLL`)** | Monthly salary accrual. Dr Gross Salary (`5100`), Cr PF Payable (`2160`), Cr ESI Payable (`2161`), Cr TDS Payable u/s 194J/192 (`2220`), Cr Net Salary Payable (`2150`). | Implemented in `apps/web/src/pages/hrms/` and database RPC `finalize_payroll_run_atomic`. | **Superior** | Stored procedure atomically locks payroll run, calculates component breakdowns, and generates the exact multi-line balanced GL entry. | None. Fully automated and compliant with Indian payroll structure. | None needed. | Completed |
| **13. GST Adjustment JV (`GST_ADJ`)** | Monthly offset of Input CGST/SGST/IGST against Output CGST/SGST/IGST per Section 49 order of utilization; record GST liability payable via Challan PMT-06. | No dedicated GST adjustment flow or screen. Must be entered as a manual multi-line Journal Voucher in DayBook. | **Missing** | Experienced accountants can construct the manual JV. | No automated GSTR-3B tax offset calculator or guided wizard following statutory rules (IGST input first against IGST output, then CGST/SGST). | Create a "GST Monthly Return & Offset Wizard" calculating available ITC and generating the offset JV automatically. | 3 days |
| **14. TDS Adjustment JV (`TDS_ADJ`)** | Record monthly payment of TDS liability via Challan ITNS-281 (due 7th of next month). Dr TDS Payable u/s 194J/194C (`2220`), Cr Bank (`1110`). | No dedicated TDS challan payment workflow. Handled only as a generic payment voucher. | **Missing** | Can be posted via Payment Voucher in DayBook. | No tracking of BSR code, Challan CIN number, or TDS section-wise liability clearance required for Form 26Q filing. | Add a dedicated "TDS Challan Payment" modal capturing BSR Code, Challan No, and auto-knocking off section-wise TDS liabilities. | 2 days |
| **15. Opening Balance JV / Import** | One-time migration of previous year closing trial balance. Validates total Dr = total Cr, or posts imbalance to Suspense Account (`3999`). | `accounts.opening_balance` column exists in DB, but there is no Opening Balance entry screen or CSV import wizard. | **Missing** | DB schema has `opening_balance` and `opening_balance_type` (`Dr`/`Cr`). | No UI wizard to upload or enter opening balances with trial balance proof validation. | Build an Opening Balance Wizard validating $\sum Dr = \sum Cr$ and executing a single balanced opening journal entry. | 2 days |
| **Revenue Recognition** | Indian AS 115 / Ind AS 115 revenue recognition for software/design services: Unbilled Revenue (Accrued Income) for T&M and Fixed-Price milestones. | Invoices are booked strictly upon creation date. No milestone percentage-of-completion or unbilled revenue engine. | **Lower** | Simple and predictable for cash/invoice-basis accounting. | Does not support WIP / Unbilled revenue accruals for software projects spanning multiple billing cycles. | Add Milestone Billing & Unbilled Revenue accrual option on project contracts. | 4 days |
| **Project Costing** | Analytical cost-center tracking: Tagging income and expenses with `project_id` to generate Project P&L statements. | `project_id` exists on `journal_entry_lines`, `invoices`, and `purchase_bills`. | **Lower** | Schema cleanly captures `project_id` across all transactional lines. | No Project P&L or project profitability report exists in the reporting module (reports only show project material quantities). | Add a Project Profitability / P&L tab in `FinancialReports.tsx` aggregating lines where `project_id = :id`. | 2 days |
| **Subcontractor Charges & TDS** | Subcontractor work orders, retention deduction, and Section 194C / 194J TDS deduction. | `SubcontractorWorkOrderCreate.tsx` and `ledgerCalculator.ts` calculate milestone billings, retention amounts, and TDS deduction. | **Superior** | Industry-tailored subcontractor management with retention money handling and TDS deduction math. | TDS rate is manually selected by user rather than automatically inferred from PAN (individual vs corporate). | Auto-populate TDS rate (1% for individuals, 2% for companies) based on subcontractor PAN 4th character. | 1 day |
| **Multi-currency & FX** | Foreign currency invoices (USD, EUR, GBP) for software export services with INR conversion rate, FIRC tracking, and FX gain/loss on payment. | All accounting screens and database calculations assume a single currency (INR). Currency code is static. | **Lower** | Eliminates FX complexity and dual-currency balancing discrepancies. | Missing export invoice zero-rating with LUT/Bond tracking, multi-currency invoicing, and realization gain/loss postings. | Add Currency and Exchange Rate fields to invoices; auto-post exchange gain/loss on receipt reconciliation. | 3 days |

---

## 5. Calculations (Math Verification)

| Calculation | Reference Formula | Actual Implementation (code path + formula) | Verdict | Better in our code | Missing / weaker | Suggested improvement | Effort |
|---|---|---|---|---|---|---|---|
| **GST (Intra-State)** | Intra-state where Supplier State == Place of Supply:<br>- $CGST = \text{Taxable} \times \frac{\text{Rate}}{200}$<br>- $SGST = \text{Taxable} \times \frac{\text{Rate}}{200}$ | `apps/web/src/pages/sales/CreditNoteEditorPageV2.tsx:194`, `apps/web/src/pages/purchase/Bills.tsx:294-306`, and backend RPC `record_debit_note:662-675`.<br>Formula:<br>`cgst = Math.round((taxable * rate / 200) * 100) / 100`<br>`sgst = Math.round((taxable * rate / 200) * 100) / 100` | **Equal** | Exact mathematical match. Both frontend and backend calculate CGST and SGST by halving the GST slab rate. | Fallback defaults to `18%` (9% + 9%) if item rate is undefined or zero. | Validate that tax rate is explicitly selected from standard slabs (0%, 5%, 12%, 18%, 28%). | 0.5 days |
| **GST (Inter-State)** | Inter-state where Supplier State $\ne$ Place of Supply:<br>- $IGST = \text{Taxable} \times \frac{\text{Rate}}{100}$ | Implemented in `CreditNoteEditorPageV2.tsx`, `Bills.tsx`, and `record_debit_note`.<br>Formula:<br>`igst = Math.round((taxable * rate / 100) * 100) / 100` | **Equal** | Correctly detects state differences between organization and counterparty and applies full rate to IGST. | Export invoices do not prompt for LUT (Letter of Undertaking) number to validate 0% zero-rated IGST export. | Add LUT Number input and validate 0% IGST with LUT for export clients. | 1 day |
| **TDS Calculation** | $TDS = \text{Base Amount} \times \frac{\text{TDS Rate}}{100}$<br>Subject to annual threshold checks (e.g. ₹30,000 for Section 194J; ₹1,00,000 aggregate for Section 194C). | `apps/web/src/pages/subcontractors/ledgerCalculator.ts:18` & `SubcontractorWorkOrderCreate.tsx`.<br>Formula:<br>`tds_amount = (gross_amount * tds_percentage) / 100` | **Equal** | Accurate mathematical multiplication and line-item deduction from vendor net payable. | Rate is user-selected without automated threshold tracking or higher rate (20% u/s 206AA) enforcement for missing PAN. | Implement cumulative vendor payment tracking to auto-trigger TDS once the ₹30,000 / ₹1,00,000 threshold is breached. | 2 days |
| **Totals & Rounding** | Subtotal = $\sum \text{Line Taxable}$<br>Tax = $\sum \text{Line Taxes}$<br>Grand Total = $\text{Subtotal} + \text{Tax} + \text{Round-off}$ | Implemented across `Bills.tsx`, `InvoiceEditorPage.tsx`, and `CreditNoteEditorPageV2.tsx`.<br>Formula:<br>`grandTotal = Math.round((subtotal + totalTax) * 100) / 100`<br>Round-off: `roundOff = Math.round(grandTotal) - grandTotal` | **Equal** | Clean decimal rounding prevents JavaScript floating-point artifacts (e.g. `0.000000000004`). | Round-off ledger (`5999 Rounding Adjustment`) is not always explicitly credited/debited in journal lines. | Ensure round-off difference is posted to dedicated Rounding Off ledger in GL. | 0.5 days |
| **Account & Party Balances** | Dual-track balance maintenance:<br>1. Incremental stored balance on `accounts.current_balance`<br>2. On-the-fly recomputation from $\sum Dr - \sum Cr$ across `journal_entry_lines`. | - Backend: `update_account_balance` RPC updates stored balance; `get_trial_balance` RPC recomputes on-the-fly.<br>- Frontend: `useAccounting.ts:31` hardcodes `balance: 0`. | **Lower** | Backend has both incremental and on-the-fly recomputation RPCs. | Frontend completely fails to display either balance in `ChartOfAccounts.tsx` (`balance: 0`). | Update `useChartOfAccounts` to query `accounts.current_balance` or call `get_trial_balance` so live balances display. | 0.5 days |
| **Ageing (Debtors / Creditors)** | Overdue aging calculated from Invoice Due Date into standard Indian credit buckets: `0-30 days`, `31-60 days`, `61-90 days`, `90+ days` (or MSME `45-day` statutory bucket). | `apps/web/src/pages/sales/` and `DebtorsAgeing.tsx`. Compares `current_date - due_date` and sorts into 30-day interval buckets. | **Equal** | Correctly segments overdue receivables and payables by time intervals. | Lacks dedicated 45-day statutory MSME overdue warning bucket required under Section 15 of MSMED Act. | Add a distinct "MSME 45-Day Overdue" indicator in Creditors Ageing to highlight statutory interest risk (3x RBI bank rate). | 1 day |
| **Depreciation Math** | Straight Line: $\frac{\text{Cost} - \text{Salvage}}{\text{Useful Life}}$<br>WDV: $\text{Book Value} \times \text{Depreciation Rate}$ | Missing in code. No formula or calculation function exists. | **Missing** | None. | No depreciation math implemented in codebase. | Implement Schedule II depreciation rate calculator utility. | 1.5 days |

---

## 6. UX Improvements

| UX Area | Reference Expectation | Current Implementation | Verdict | Better in our code | Missing / weaker | Suggested improvement | Effort |
|---|---|---|---|---|---|---|---|
| **CoA tree & search** | Expandable/collapsible interactive tree, live search by account code/name, filters by Root Type (`Asset`, `Liability`, etc.), GST/TDS tags, and active status. | `apps/web/src/pages/accounting/ChartOfAccounts.tsx:110-116`.<br>Search input is rendered: `<input placeholder="Search accounts..." />` with NO `onChange` or `value` prop. | **Lower** | Clean collapsible folder/chevron UI hierarchy. | The search box is completely non-functional dummy JSX. There are no filters for account types, GST/TDS, or control accounts. | Bind search input to state and filter `coaTree` recursively; add filter pills for `Asset`, `Liability`, `Income`, `Expense`. | 0.5 days |
| **Voucher entry (DayBook)** | Intuitive voucher entry for non-accountants: Clear Dr/Cr labels, smart defaults, partner/party dropdowns, auto-calculating GST ledgers based on place of supply, inline balance indicator. | `apps/web/src/pages/accounting/DayBook.tsx:200-310`. Simple modal with date, type dropdown, narration, and dynamic line items with `account_id`, `debit`, `credit`. | **Lower** | Minimalist 2-line journal entry grid; easy for accountants. | No party picker on lines; no auto-splitting of taxes; no client-side Dr = Cr validation before calling RPC (crashes with unhandled error if unbalanced). | Add live Dr/Cr balance validator, party selector dropdown, and an auto-GST toggle. | 1.5 days |
| **Masters forms** | Simplified single-page masters with Indian compliance fields (PAN verification, GSTIN auto-fill, MSME category, Bank IFSC validation). | `ClientCreateModal.tsx`, `Vendors.tsx`. Modal forms with clean input styling, multi-tab layouts, and field validation. | **Equal** | Modern design system aesthetic, responsive modal layouts, and organized field groupings. | Masters do not show which General Ledger control account the party will post to. | Add an expandable "Accounting Configuration" accordion displaying the mapped control account. | 0.5 days |
| **Import flows** | CSV/Excel import wizard with column mapping, preview table, pre-validation checks (duplicate codes, valid root types, Dr=Cr balance proof), and downloadable error logs. | No import UI exists for Chart of Accounts, Ledgers, or Vouchers in `apps/web`. | **Missing** | Avoids corrupted bulk data uploads without validation. | Users cannot bulk-import the 71-account Indian software CoA template or previous year trial balance from CSV. | Build an Import Modal using `papaparse` with column mapping and dry-run validation against `accounts`. | 2 days |
| **Reports readability** | Clear, printable financial statements: Schedule III Balance Sheet (Vertical format), Profit & Loss Statement, Trial Balance with search and level expansion, export to PDF/Excel. | `apps/web/src/pages/reports/FinancialReports.tsx` and `ComplianceReports.tsx`. UI exists but only displays project materials and costs; no GL financial statements. | **Missing** | Reports dashboard has good charts, date filters, and PDF export infrastructure. | No accounting financial statements (TB, BS, P&L) exist in the navigation or pages. | Build `TrialBalance.tsx` and `FinancialStatements.tsx` utilizing `get_trial_balance` RPC and Schedule III grouping. | 3 days |
| **Tooltips & guidance** | Contextual help icons explaining Indian accounting terms (e.g. *Input Tax Credit eligibility*, *RCM under Section 9(3)*, *TDS under Section 194J vs 194C*). | Labels are plain text (e.g., "Account Code", "Root Type", "Debit", "Credit") without tooltips or help icons. | **Lower** | Uncluttered, clean interface. | Non-accountant operators have no guidance on whether an account is an Asset or Liability, or what normal balance applies. | Add tooltip badges with brief statutory explanations next to technical fields. | 0.5 days |
| **Mobile responsiveness** | Touch-friendly layouts, card-based views on mobile, horizontal scroll on tables, action buttons accessible on mobile screens. | Monorepo has dedicated `apps/mobile` Capacitor application following `Mobile_app_design.md`. Accounting views in `apps/web` have responsive flex wrappers. | **Equal** | Dual-app architecture: full-screen desktop web app paired with touch-optimized native mobile app. | DayBook and CoA are primarily desktop web views; mobile app currently focuses on approvals, project status, and purchase orders. | Ensure mobile app provides quick DayBook voucher lookup and party ledger summary cards. | 2 days |

---

## 7. Feature Gap Matrix (Prioritised)

| Feature | Reference | Current Status | Verdict | Impact | Effort | Priority |
|---|---|---|---|---|---|---|
| **Trial Balance & Schedule III Statements** | Full Trial Balance, Balance Sheet, and P&L reports in vertical Schedule III format. | Backend RPC `get_trial_balance` exists in DB, but ZERO financial report screens exist in the UI. | **Missing** | **Critical** (Users cannot see company financial health or file tax returns) | 3 days | **P0** |
| **CoA Real Balances & Working Search** | Dynamic live balance per account and functional search in Chart of Accounts tree. | `useAccounting.ts:31` hardcodes `balance: 0`. Search input in `ChartOfAccounts.tsx:112` has no event handler. | **Lower** | **High** (CoA view shows `₹0.00` closing balance for all accounts; search fails) | 1 day | **P0** |
| **DayBook Party Selector & Dr=Cr Validation** | DayBook entry lines must allow selecting a party (Debtor/Creditor) and validate Dr = Cr before submit. | UI has no party selector in lines (`party_id` omitted) and submits unbalanced entries to DB, throwing raw SQL error. | **Lower** | **High** (Prevents posting subledger entries and causes poor user experience on error) | 1 day | **P0** |
| **Automated Onboarding Template Seeding** | Seed the 71-account Indian Software/Design CoA (`CoA_Import_India.csv`) on org setup. | Org starts with blank/minimal accounts unless manually seeded via SQL. No UI button to apply template. | **Missing** | **High** (New users face an empty slate and must create 70+ accounts manually) | 2 days | **P1** |
| **Party Subledger Mapping & True GL Statement** | Party creation auto-links to control accounts; party ledger statement queries GL lines. | Parties are isolated in separate tables; `PartyLedger.tsx` queries invoices instead of General Ledger. | **Lower** | **Medium** (Manual JVs for parties do not reflect in party ledger statement) | 2 days | **P1** |
| **GST Monthly ITC Offset & Return Wizard** | Wizard to offset Input CGST/SGST/IGST against Output GST per Section 49 rules. | Must be manually calculated and posted as a manual journal voucher. | **Missing** | **Medium** (Monthly GST filing is error-prone without automated offset logic) | 3 days | **P1** |
| **TDS Threshold Tracking & Challan JV** | Auto-track ₹30k / ₹1L thresholds and generate Challan 281 payment vouchers with BSR/CIN. | Rate is manually chosen; no threshold checks; no dedicated challan payment workflow. | **Lower** | **Medium** (Risk of statutory non-compliance if thresholds are missed) | 2 days | **P2** |
| **Fixed Asset Register & Depreciation Engine** | Asset register with acquisition date, cost, and automated monthly SLM/WDV depreciation. | No asset register or depreciation calculation engine. Treated purely as static accounts. | **Missing** | **Medium** (Depreciation must be calculated in external spreadsheets) | 3 days | **P2** |
| **CSV Import Wizard for CoA & Opening Balances** | Multi-column CSV import with preview, error highlighting, and opening TB zero-proof validation. | No import wizard exists. | **Missing** | **Medium** (Data migration from Tally/Zoho requires direct database scripting) | 2 days | **P2** |
| **Multi-currency & Export Invoicing (LUT)** | Foreign currency invoices (USD) with conversion rate, LUT tracking, and FX gain/loss. | Static single-currency (INR) across the entire accounting module. | **Lower** | **Low** (Only impacts software design agencies billing foreign clients in USD) | 3 days | **P2** |

---

## 8. Where Our Code is Superior

The actual implementation demonstrates several advanced operational and architectural patterns that exceed the static baseline envisioned in the reference templates:

### 1. Atomic Multi-Step Advance & Expense Disbursements
- **File / Code Path:** `apps/web/supabase/migrations/` (RPCs `create_advance_expense_atomic` and `disburse_advance_expense_atomic`).
- **Evidence:** Rather than requiring an accountant to manually post multiple separate journal entries for employee expense claims and petty cash advances, the application implements an atomic database transaction. When an advance is disbursed, the RPC atomically locks the record, validates funds, creates a journal entry debiting `1400 Employee Advances` and crediting `1301 Petty Cash Float`, updates account balances, and stamps the audit trail in a single database round-trip.

### 2. Automated Purchase Return to Debit Note Pipeline
- **File / Code Path:** `apps/web/src/services/purchaseReturnService.ts` and `record_debit_note` RPC.
- **Evidence:** When materials or software services are rejected, `convert_purchase_return_to_debit_note` automatically invokes the hardened `record_debit_note` procedure. The backend RPC:
  - Compares `organisations.state` against `purchase_vendors.state`.
  - Automatically determines whether to reverse Intra-State GST (`1310 Input CGST` + `1311 Input SGST`) or Inter-State GST (`1312 Input IGST`).
  - Auto-provisions the GL accounts if missing.
  - Updates the vendor's outstanding balance atomically.
  - Enforces period lock protection.

### 3. Integrated Subcontractor Retention & Milestone Calculations
- **File / Code Path:** `apps/web/src/pages/subcontractors/SubcontractorWorkOrderCreate.tsx` and `ledgerCalculator.ts`.
- **Evidence:** The reference spreadsheet provides only generic journal entry templates for subcontractors. The codebase features a domain-specific calculation engine that handles milestone-based work orders, deducts retention money (held until project sign-off), computes Section 194C / 194J TDS deductions on net billable amounts, and produces structured payment schedules.

### 4. Automated Payroll Accrual with Component Breakdown
- **File / Code Path:** `apps/web/src/pages/hrms/` and database RPC `finalize_payroll_run_atomic`.
- **Evidence:** While the reference document expects manual preparation of a "Payroll JV" spreadsheet each month, the application generates this balanced multi-line double-entry voucher automatically upon completing a payroll run. The RPC atomically splits Gross Salary into Employee PF, Employer PF, ESI, Professional Tax, TDS u/s 192, Salary Advances recovery, and Net Salary Payable.

---

## 9. Where Our Code is Lower / Missing

### 1. Absence of Financial Statements (Trial Balance, P&L, Balance Sheet)
- **Reference:** `Implementation_UX_Checklist_India.md` Section 5 and `Compliance_Mapping_India.csv` mandate real-time Trial Balance, Profit & Loss Statement, and Schedule III Balance Sheet reporting.
- **Codebase Reality:** There are **zero** financial statement views in `apps/web/src/pages/accounting/`. The only two pages are `ChartOfAccounts.tsx` and `DayBook.tsx`. The reports in `apps/web/src/pages/reports/FinancialReports.tsx` only aggregate raw project materials and contractor bill totals from the operational tables, completely disconnected from the General Ledger double-entry system.

### 2. Cosmetic Search and Zero Balances in Chart of Accounts
- **Reference:** `UX_Wireframes_Spec_CoA_India.xlsx` expects an interactive Chart of Accounts tree displaying live closing balances per ledger, aggregated group balances, and instant filtering by code, name, or type.
- **Codebase Reality:**
  - `apps/web/src/pages/accounting/ChartOfAccounts.tsx:112-116`: The search input `<input placeholder="Search accounts..." />` has no `onChange`, `value`, or filtering logic. Typing in it does nothing.
  - `apps/web/src/pages/accounting/useAccounting.ts:31`: The closing balance is explicitly stubbed as:
    ```typescript
    balance: 0, // Calculate balances in a real system by joining journal_entry_lines
    ```
    Every single account in the Chart of Accounts tree permanently displays `₹0.00`.

### 3. Party Masters Disconnected from CoA Subledgers
- **Reference:** `Data_Model_CoA_Ledgers_Vouchers_India.xlsx` and `Ledger_Master_Templates_India.xlsx` define a unified ledger model where every Customer, Vendor, Employee, and Bank account is mapped to a specific control account with an individual subledger code.
- **Codebase Reality:** Customers (`clients`), Vendors (`purchase_vendors`), and Employees (`employees`) exist in isolated tables. When a customer or vendor is created, no corresponding ledger account is created in `accounts`. In `DayBook.tsx:242-290`, the voucher line modal does not even provide a `party_id` dropdown, preventing users from tagging journal entries with specific party subledger identifiers.

### 4. Missing GST ITC Offset & TDS Settlement Wizards
- **Reference:** `Voucher_Matrix_India.csv` vouchers 13 (`GST_ADJ`) and 14 (`TDS_ADJ`) define standard month-end workflows for setting off Input GST against Output GST and paying monthly TDS liabilities via Challan 281.
- **Codebase Reality:** There is no GST offset engine or TDS liability clearance wizard. Users are forced to calculate their tax liabilities in external spreadsheets and post raw manual journal vouchers, introducing high risk of statutory non-compliance.

### 5. Missing Fixed Asset Register & Depreciation Engine
- **Reference:** `MAI_CoA_Detailed_Prompt_Indian_Software_Design_Company.txt` Section 3 mandates tracking Fixed Assets (Computers, Office Equipment, Furniture) with acquisition cost, accumulated depreciation, and automated straight-line / WDV depreciation per Schedule II.
- **Codebase Reality:** No fixed asset table, capitalization workflow, or depreciation calculation engine exists. Fixed assets exist only as static accounts in the Chart of Accounts.

---

## 10. Appendix: Evidence

### 1. Reference Files Examined
The baseline comparison was conducted against all reference files in `apps/web/Charts_of_accounts`:
1. `01_Prompt_&_Checklist/MAI_CoA_Detailed_Prompt_Indian_Software_Design_Company.txt` (Complete Indian IT/Design agency accounting specification).
2. `01_Prompt_&_Checklist/CoA_Implementation_UX_Checklist_Indian_Software_Design_Company.xlsx` (10-point UX/Functional checklist).
3. `01_Prompt_&_Checklist/CoA_Implementation_Roadmap_Risks_TestCases_India.xlsx` (Implementation risks and test scenarios).
4. `02_CoA_&_Masters/CoA_Template_Indian_Software_Design_Company.xlsx` & `CoA_Import_India.csv` (71 pre-built accounts with SAC/GST/TDS/Schedule III tags).
5. `02_CoA_&_Masters/Ledger_Master_Templates_India.xlsx` & `Ledger_Import_Template_India.csv` (Unified party master specification).
6. `02_CoA_&_Masters/Opening_Balance_Import_Template_India.xlsx` (Opening trial balance format).
7. `03_Bookkeeping_&_Compliance/Voucher_Matrix_Indian_Software_Design_Company.xlsx` & `Voucher_Matrix_India.csv` (15 standard voucher types).
8. `03_Bookkeeping_&_Compliance/Compliance_Mapping_GST_TDS_Schedule_III_India.xlsx` & `Compliance_Mapping_India.csv` (Statutory tax and Schedule III mapping).
9. `03_Bookkeeping_&_Compliance/GST_TDS_Masters_Reference_India.xlsx` & `GST_TDS_Masters_India.csv` (SAC codes 998311-998313, TDS rates).
10. `04_Technical_&_UX/Data_Model_CoA_Ledgers_Vouchers_India.xlsx` & `New Microsoft Excel Worksheet.csv` (Entity relationship model).
11. `04_Technical_&_UX/UX_Wireframes_Spec_CoA_India.xlsx` (UI wireframe specs).
12. `04_Technical_&_UX/RBAC_Audit_Trail_Permissions_Matrix_India.xlsx` (Role-based access matrix).

---

### 2. Key Code Evidence Snippets

#### A. Chart of Accounts Closing Balance Hardcoded to Zero
`apps/web/src/pages/accounting/useAccounting.ts:25-34`:
```typescript
data.forEach((acc: any) => {
  accountMap.set(acc.id, {
    id: acc.id,
    code: acc.account_code,
    name: acc.name,
    type: acc.is_group ? 'Group' : 'Ledger',
    rootType: acc.root_type,
    balance: 0, // Calculate balances in a real system by joining journal_entry_lines
    children: []
  });
});
```

#### B. Search Input Unhooked / Cosmetic in CoA
`apps/web/src/pages/accounting/ChartOfAccounts.tsx:110-116`:
```tsx
<div className="relative">
  <Search className="w-[14px] h-[14px] absolute left-[8px] top-1/2 -translate-y-1/2 text-tertiary" />
  <input 
    type="text" 
    placeholder="Search accounts..." 
    className="h-[32px] w-[220px] pl-[28px] pr-[10px] py-[5px] rounded-[8px] border text-[13px] border-gray-200"
  />
</div>
```

#### C. DayBook Line Items Lack Party Selector
`apps/web/src/pages/accounting/DayBook.tsx:242-260`:
```tsx
{formData.lines.map((line, index) => (
  <div key={index} className="flex gap-2 mb-2 items-center">
    <select
      className="flex-1 border rounded p-2 text-sm bg-white"
      value={line.account_id}
      onChange={e => {
        const newLines = [...formData.lines];
        newLines[index].account_id = e.target.value;
        setFormData({ ...formData, lines: newLines });
      }}
    >
      <option value="">Select Account...</option>
      {ledgerOptions.map(l => (
        <option key={l.id} value={l.id}>{l.code} - {l.name}</option>
      ))}
    </select>
    {/* Line only has debit and credit inputs; party_id and party_type are omitted */}
```

#### D. Verified State-Based GST Calculation in Backend RPC
`apps/web/supabase/migrations/20260923000000_accounting_coa_audit_fixes.sql:662-675`:
```sql
-- Determine Tax Splitting (Intra-state vs Inter-state)
IF v_vendor_state IS NOT NULL AND v_org_state IS NOT NULL AND LOWER(TRIM(v_vendor_state)) = LOWER(TRIM(v_org_state)) THEN
  -- Intra-state: Split equally between CGST and SGST
  v_cgst_amount := ROUND((v_tax_amount / 2.0), 2);
  v_sgst_amount := v_tax_amount - v_cgst_amount;
  v_igst_amount := 0;
ELSE
  -- Inter-state: All to IGST
  v_cgst_amount := 0;
  v_sgst_amount := 0;
  v_igst_amount := v_tax_amount;
END IF;
```

#### E. Verified Subcontractor Retention & TDS Deduction
`apps/web/src/pages/subcontractors/ledgerCalculator.ts:15-26`:
```typescript
const retentionAmount = (grossAmount * retentionPercent) / 100;
const taxableAmount = grossAmount - retentionAmount;
const tdsAmount = (taxableAmount * tdsPercent) / 100;
const netPayable = taxableAmount - tdsAmount;

return {
  grossAmount,
  retentionAmount,
  taxableAmount,
  tdsAmount,
  netPayable
};
```
