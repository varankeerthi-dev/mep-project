# GL Wiring Audit (Reverse Engineering)

**Audit Date:** 2026-09-23  
**Auditor:** Antigravity Functional Code Auditor  
**Audit Scope:** Read-only functional reverse-engineering of General Ledger (GL) posting across operational modules (`apps/web`).  
**Baseline Verified:** Database stored procedures (`pg_proc`), baseline migration scripts (`apps/web/supabase/migrations/`), operational tables, and React frontend handlers.

---

## Executive Summary

### Overall Verdict: **Partially Wired (Strong Operational Postings, Missing Periodic & Inventory Accruals)**

The application possesses a **sophisticated, transactional double-entry posting layer** embedded inside PostgreSQL stored procedures (`SECURITY DEFINER` atomic RPCs) that enforce ACID compliance, row locking, and idempotency. However, the system operates as a **hybrid accounting model**:
1. **Control Accounts + Sub-ledger Tagging**: Primary operational modules (Sales, Purchasing, Vendor Payments, Customer Receipts, Subcontractors, Payroll, Advances) post directly into control accounts (`1100 Sundry Debtors`, `2100 Sundry Creditors`) while tagging individual parties via `party_type` and `party_id`.
2. **Missing Inventory & Periodic Accounting**: There is **zero perpetual inventory accounting**. Receiving goods (GRN) or selling items modifies physical warehouse stock quantities, but creates **no GL journal entries** for Inventory Assets (`1300` / `1400`) or Cost of Goods Sold (`4100` COGS).
3. **Operational vs. GL Balance Divergence**: Customer and Vendor statement screens (`PartyLedger`, `LedgerDashboard`, `VendorLedgerDialog`) compute balances and chronological ledgers on the fly from **operational document tables** (`invoices`, `receipts`, `purchase_bills`, `purchase_payments`) rather than aggregating `journal_entry_lines`.

```
Operational Layer                    Atomic Database RPCs                     General Ledger
=================                    ====================                     ==============
[ Sales Invoices ]  -------> [ create_sales_invoice_atomic / ] ------> Dr 1100 Sundry Debtors (Client)
                             [ finalize_sales_invoice        ]         Cr 3100 Sales Revenue
                                                                       Cr 2201/2202 Output GST
                                                                       (Stock deducted, 0 GL COGS)

[ Customer Receipts ] -----> [ record_customer_payment       ] ------> Dr 1200 Bank / 1300 Cash
                                                                       Cr 1100 Sundry Debtors (Client)

[ Purchase Bills ]   ------> [ record_purchase_bill          ] ------> Dr 4100 Purchase Expense (All Capex/Opex)
                                                                       Cr 2100 Sundry Creditors (Vendor)
                                                                       (No Input GST breakdown in GL)

[ Vendor Payments ]  ------> [ record_vendor_payment         ] ------> Dr 2100 Sundry Creditors (Vendor)
                                                                       Cr 1200 Bank / 1300 Cash

[ Payroll Run ]      ------> [ finalize_payroll_run_atomic   ] ------> Dr 5100 Salaries & Wages
                                                                       Cr 2210 PF / 2220 ESI / 2200 TDS
                                                                       Cr 1400 Adv Rec / 2120 Net Payable

[ Subcontractors ]   ------> [ record_subcontractor_bill     ] ------> Dr 4100 Subcontractor Expense
                             [ record_subcontractor_payment  ]         Cr 2150 Retention / 2100 AP
                             [ release_subcontractor_retention]

[ Goods Receipt (GRN)] ----> [ Operational stock update only ] ------> 0 GL Entries (No Inventory Asset)
[ Purchase Orders ]  ------> [ Operational procurement only  ] ------> 0 GL Entries (Non-financial commitment)
```

### Top 3 Modules that DO Post to GL
1. **Sales & Customer Receivables (`finalize_sales_invoice`, `record_customer_payment`)**: Fully balanced double-entry vouchers with dynamic interstate/intrastate tax jurisdiction detection (CGST+SGST vs. IGST), debiting Sundry Debtors with `party_type = 'client'` and crediting Sales Accounts and Output GST liabilities.
2. **Payroll Accrual Engine (`finalize_payroll_run_atomic`)**: Complete statutory accrual voucher (`PAYROLL-YYYY-MM`) posting Gross Salaries to Expense (`5100`) while splitting statutory deductions across PF Payable (`2210`), ESI Payable (`2220`), TDS Payable (`2200`), Employee Advance Recovery (`1400`), and Net Salaries Payable (`2120`).
3. **Subcontractor Lifecycle (`record_subcontractor_bill`, `record_subcontractor_payment`, `release_subcontractor_retention`)**: Handles Held Retention Payables (`2150`), TDS Section 194C withholding (`2200`), Accounts Payable discharge, and bank disbursements.

### Top 3 Modules that do NOT Post to GL
1. **Goods Receipt (GRN) & Inventory Movements (`goods_received_notes`, `warehouse_stock`)**: Updating goods received or delivery challans mutates operational warehouse quantities in `material_transactions`, but makes **zero entry** into any Inventory Asset account or GRNI (Goods Received Not Invoiced) accrual account.
2. **Cost of Goods Sold (COGS) on Sales Invoices**: Finalizing an invoice deducts stock from warehouse bins via `deduct_invoice_stock`, but does **not** calculate or post Cost of Goods Sold. The system assumes a periodic accounting model where inventory valuation is handled via end-of-year adjustment journals.
3. **Purchase Orders (`purchase_orders`) & Requisitions**: Purchase Orders are purely procurement tracking records and produce no financial commitments or encumbrances in the GL.

---

## 1. Clients, Vendors & Sub-ledgers

| Question | Answer | Evidence (file:line + function/RPC) | Accounts Used | Notes |
|---|---|---|---|---|
| **Client creation creates GL account?** | **No** | `apps/web/src/pages/ClientManagement.tsx:847-851`<br>Table: `public.clients` | None | Inserting into `clients` does not touch `accounts`. Clients are not created as individual nominal ledger accounts. |
| **Vendor creation creates GL account?** | **No** | `apps/web/src/components/QuickAddVendorModal.tsx:38-46`<br>Table: `public.purchase_vendors` | None | Inserting into `purchase_vendors` does not touch `accounts`. No sub-account is generated. |
| **Clients treated as "Assets" in GL?** | **Yes (via Control Account)** | Database stored proc `finalize_sales_invoice`<br>`SELECT ... account_code = '1100'` | `1100 - Sundry Debtors` (`root_type: 'Asset'`) | Clients are subledgered under `1100`. Every journal line includes `party_type = 'client'` and `party_id = client_id`. |
| **Vendors treated as "Liabilities" in GL?** | **Yes (via Control Account)** | Database stored proc `record_purchase_bill`<br>`SELECT ... account_code = '2100'` | `2100 - Sundry Creditors` (`root_type: 'Liability'`) | Vendors are subledgered under `2100`. Every journal line includes `party_type = 'vendor'` and `party_id = vendor_id`. |
| **Products/Items stored as assets in GL?** | **No** | Database table `public.accounts`<br>`public.journal_entry_lines` (0 rows for account `1300`) | Operational tables only (`materials`, `warehouse_stock`) | No perpetual inventory asset account is debited on receipt or credited on sale. Materials exist purely as operational stock quantities. |

---

## 2. Sales & Credit Notes

| Question | Answer | Evidence (file:line + function/RPC) | Accounts Used | Notes |
|---|---|---|---|---|
| **Auto-post Sales Invoice?** | **Yes (on Finalize only)** | `create_sales_invoice_atomic`<br>`finalize_sales_invoice` | **Dr:** `1100` (Sundry Debtors)<br>**Cr:** `3100`/`3101` (Sales Accounts)<br>**Cr:** `2201` (CGST Output)<br>**Cr:** `2202` (SGST Output)<br>**Cr:** `2203` (IGST Output) | Draft invoices do **not** post to GL. Posting occurs when `p_auto_finalize = true` or when calling `finalize_sales_invoice` (`status: 'final'`). Reversal occurs via `cancel_sales_invoice_atomic`. |
| **Auto-post Credit Note?** | **Yes (on Approval)** | `record_credit_note`<br>`cancel_credit_note_atomic` | **Dr:** `4100`/`5100`/`4000` (Sales Returns)<br>**Cr:** `1100` (Sundry Debtors) | Credit notes auto-post upon creation/approval. Reversal occurs via `cancel_credit_note_atomic`. **Note:** Credit Note posting lumps total into Sales Returns; it does not split GST into separate debit lines. |
| **Place of Supply (POS) tax jurisdiction?** | **Yes** | `finalize_sales_invoice`<br>`record_credit_note`<br>`record_purchase_bill` | `2201`/`2202` (Intrastate)<br>`2203` (Interstate) | Compares `LOWER(TRIM(client.state)) != LOWER(TRIM(org.state))`. Intrastate splits tax 50/50 between CGST and SGST; interstate applies 100% to IGST. |

---

## 3. Purchases, POs, Inventory & COGS

| Question | Answer | Evidence (file:line + function/RPC) | Accounts Used | Notes |
|---|---|---|---|---|
| **PO creates GL?** | **No** | `apps/web/src/pages/CreatePO.tsx`<br>Table: `public.purchase_orders` | None | Purchase orders represent operational procurement intent, not recognized accounting obligations. |
| **Purchase Bill creates GL?** | **Yes (on Approval)** | Database stored proc `record_purchase_bill`<br>Reversal: `cancel_purchase_bill_atomic` | **Dr:** `4100`/`4101`/`4000` (Purchase Expense)<br>**Cr:** `2100` (Sundry Creditors) | Posts voucher of type `Purchase`. Debits entire grand total to Purchase Expense. **Flaw:** Does not split Input GST (`2204`/`2205`/`2206`) into separate debit lines in GL. |
| **Capex vs Opex classification?** | **Missing** | `record_purchase_bill`<br>Table: `purchase_bill_items` | Hardcoded to `4100`/`4101`/`4000` | Neither `purchase_bills` nor `purchase_bill_items` contains an `is_asset` or `capex_opex` field. Fixed assets cannot be capitalized via bills. |
| **Goods Receipt creates GL?** | **No** | `goods_received_notes`<br>`material_transactions` | None | Physical goods receipt updates quantity in `warehouse_stock` only. No GRNI (Goods Received Not Invoiced) or Inventory Asset entry is created. |
| **COGS on sale?** | **No** | `deduct_invoice_stock`<br>`finalize_sales_invoice` | None | Stock quantities are decremented in `warehouse_stock`, but no Dr COGS / Cr Inventory Asset journal lines are written. |

---

## 4. Payments, Receipts, Advances

| Question | Answer | Evidence (file:line + function/RPC) | Accounts Used | Notes |
|---|---|---|---|---|
| **DayBook Receipt posts GL?** | **Yes** | `apps/web/src/pages/accounting/DayBook.tsx`<br>RPC: `post_journal_entry` | **Dr:** `1200` Bank / `1300` Cash<br>**Cr:** User-selected (e.g. `1100`) | Standard double-entry journal entry with `voucher_type: 'Receipt'`. |
| **Sales Receive Payment posts GL?** | **Yes** | `RecordPaymentDrawer.tsx`<br>`apps/web/src/ledger/api.ts:184`<br>RPC: `record_customer_payment` | **Dr:** `1200` Bank / `1300` Cash<br>**Cr:** `1100` (Sundry Debtors) | Auto-creates `Receipt` voucher in `journal_entries`, updates invoice `paid_amount`, and tags `party_type = 'client'`. |
| **DayBook Payment posts GL?** | **Yes** | `apps/web/src/pages/accounting/DayBook.tsx`<br>RPC: `post_journal_entry` | **Dr:** User-selected (e.g. `2100`)<br>**Cr:** `1200` Bank / `1300` Cash | Standard double-entry journal entry with `voucher_type: 'Payment'`. |
| **Vendor Payment modal posts GL?** | **Yes** | `usePurchaseQueries.ts:782`<br>RPC: `record_vendor_payment` | **Dr:** `2100` (Sundry Creditors)<br>**Cr:** `1200` Bank / `1300` Cash | Auto-creates `Payment` voucher, updates bill balances, and tags `party_type = 'vendor'`. |
| **Advances/Expenses post GL?** | **Yes** | `disburse_advance_expense_atomic`<br>`top_up_petty_cash_float_atomic` | **Dr:** `1400` (Emp Advances) or `4100` (Expense)<br>**Cr:** `1200` (Bank) or `1301` (Petty Cash Float) | Fully wired. Advances disburse to Asset `1400`. Expenses disburse to Expense `4100`. Top-ups debit Petty Cash Float `1301`. |

---

## 5. Payroll, Subcontractors, Assets

| Question | Answer | Evidence (file:line + function/RPC) | Accounts Used | Notes |
|---|---|---|---|---|
| **Payroll posts GL?** | **Yes** | Database stored proc `finalize_payroll_run_atomic`<br>Reversal: `cancel_payroll_run_atomic` | **Dr:** `5100` Salaries & Wages<br>**Cr:** `2210` PF Payable<br>**Cr:** `2220` ESI Payable<br>**Cr:** `2200` TDS Payable (192B)<br>**Cr:** `1400` Employee Advance Recovery<br>**Cr:** `2120` Salaries Payable | Full statutory multi-line balanced accrual voucher generated under voucher number `PAYROLL-YYYY-MM`. |
| **Subcontractor billing posts GL?** | **Yes** | `record_subcontractor_bill`<br>`record_subcontractor_payment`<br>`release_subcontractor_retention` | **Bill:** Dr `4100` Subcontractor Exp, Cr `2150` Retention Payable, Cr `2100` Subcontractor AP.<br>**Payment:** Dr `2100` AP, Cr `1200` Bank, Cr `2200` TDS (194C).<br>**Retention:** Dr `2150` Retention Payable, Cr `1200` Bank. | Subcontractor lifecycle is completely integrated with GL, tracking held retention and withholding TDS. |
| **Maintenance vs Asset Purchase?** | **No distinction in GL** | `apps/web/src/purchase-requisitions/api.ts:3`<br>`record_purchase_bill` | All purchases debit `4100` / `4101` / `4000` | Requisitions support `purpose_type: 'MAINTENANCE' \| 'CAPEX'`, but this metadata is discarded when generating Purchase Bills and never influences GL account selection. |

---

## 6. Code Evidence Log

### A. Sales Invoice GL Posting (`finalize_sales_invoice`)
**File:** Stored Procedure in Database (`apps/web/supabase/remediation/baseline_functions.json`)  
**Trigger:** Triggered when invoice status transitions from `draft` to `final`.

```sql
-- Lines 82-127 of finalize_sales_invoice
SELECT id INTO v_ar_account_id FROM public.accounts 
WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id) AND account_code = '1100' LIMIT 1;
SELECT id INTO v_sales_account_id FROM public.accounts 
WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id) AND account_code IN ('3100', '3101') ORDER BY account_code DESC LIMIT 1;
SELECT id INTO v_cgst_account_id FROM public.accounts WHERE ... AND account_code = '2201' LIMIT 1;
SELECT id INTO v_sgst_account_id FROM public.accounts WHERE ... AND account_code = '2202' LIMIT 1;
SELECT id INTO v_igst_account_id FROM public.accounts WHERE ... AND account_code = '2203' LIMIT 1;

INSERT INTO public.journal_entries (
  company_id, organisation_id, voucher_no, voucher_date, voucher_type, narration, status, created_by
) VALUES (
  p_organisation_id, p_organisation_id, v_invoice.invoice_no, v_invoice.invoice_date, 'Sales',
  'Sales Invoice ' || v_invoice.invoice_no, 'Posted', auth.uid()
) RETURNING id INTO v_journal_id;

-- Debit Accounts Receivable
INSERT INTO public.journal_entry_lines (journal_id, account_id, party_type, party_id, debit, credit, narration)
VALUES (v_journal_id, v_ar_account_id, 'client', v_invoice.client_id, v_total, 0.00, 'Accounts Receivable');

-- Credit Sales Revenue
INSERT INTO public.journal_entry_lines (journal_id, account_id, party_type, party_id, debit, credit, narration)
VALUES (v_journal_id, v_sales_account_id, 'client', v_invoice.client_id, 0.00, v_subtotal, 'Sales Revenue');

-- Credit Output Tax liabilities (CGST/SGST if intrastate, IGST if interstate)
IF v_cgst > 0 THEN
  INSERT INTO public.journal_entry_lines (journal_id, account_id, party_type, party_id, debit, credit, narration)
  VALUES (v_journal_id, v_cgst_account_id, 'client', v_invoice.client_id, 0.00, v_cgst, 'Output CGST Liability');
END IF;
```

---

### B. Purchase Bill Posting (`record_purchase_bill`)
**File:** Stored Procedure in Database (`apps/web/supabase/remediation/baseline_functions.json`)  
**Finding:** Debits entire grand total to `4100` Purchase Expense without carving out Input GST or distinguishing Capex from Opex.

```sql
-- Lines 188-217 of record_purchase_bill
SELECT id INTO v_purchase_account_id
FROM public.accounts
WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id)
  AND (account_code IN ('4100', '4101', '4000') OR name ILIKE '%Purchase%' OR name ILIKE '%Direct Expense%')
LIMIT 1;

SELECT id INTO v_ap_account_id
FROM public.accounts
WHERE (organisation_id = p_organisation_id OR company_id = p_organisation_id)
  AND account_code = '2100'
LIMIT 1;

IF v_purchase_account_id IS NOT NULL AND v_ap_account_id IS NOT NULL THEN
  INSERT INTO public.journal_entries (
    company_id, voucher_no, voucher_date, voucher_type, narration, status, created_by
  ) VALUES (
    p_organisation_id, v_bill_number, COALESCE(p_bill_date, CURRENT_DATE), 'Purchase',
    'Purchase Bill - ' || v_bill_number || ' (' || v_vendor.company_name || ')', 'Posted', auth.uid()
  ) RETURNING id INTO v_journal_id;

  -- Dr Purchase Account (Total bill amount including GST)
  INSERT INTO public.journal_entry_lines (journal_id, account_id, party_type, party_id, debit, credit, narration)
  VALUES (v_journal_id, v_purchase_account_id, 'vendor', p_vendor_id, v_grand_total, 0.00, 'Purchase Expense / Inward Supply');

  -- Cr Accounts Payable (Sundry Creditors)
  INSERT INTO public.journal_entry_lines (journal_id, account_id, party_type, party_id, debit, credit, narration)
  VALUES (v_journal_id, v_ap_account_id, 'vendor', p_vendor_id, 0.00, v_grand_total, 'Accounts Payable Accrual');
END IF;
```

---

### C. Customer Receipt Posting (`record_customer_payment`)
**File:** Stored Procedure in Database (`apps/web/supabase/remediation/baseline_functions.json`)  
**Frontend Caller:** `apps/web/src/invoices/components/RecordPaymentDrawer.tsx` via `createReceipt` in `apps/web/src/ledger/api.ts:184`.

```sql
-- Lines 120-149 of record_customer_payment
SELECT id INTO v_bank_account_id FROM public.accounts WHERE account_code = CASE WHEN p_payment_mode = 'cash' THEN '1300' ELSE '1200' END;
SELECT id INTO v_ar_account_id FROM public.accounts WHERE account_code = '1100';

INSERT INTO public.journal_entries (
  company_id, voucher_no, voucher_date, voucher_type, narration, status, created_by
) VALUES (
  p_organisation_id, v_receipt_no, CURRENT_DATE, 'Receipt',
  'Customer Payment Received - ' || v_receipt_no, 'Posted', auth.uid()
) RETURNING id INTO v_journal_id;

-- Dr Bank / Cash
INSERT INTO public.journal_entry_lines (journal_id, account_id, party_type, party_id, debit, credit, narration)
VALUES (v_journal_id, v_bank_account_id, 'client', p_client_id, p_amount, 0.00, 'Bank/Cash Received');

-- Cr Accounts Receivable (Sundry Debtors)
INSERT INTO public.journal_entry_lines (journal_id, account_id, party_type, party_id, debit, credit, narration)
VALUES (v_journal_id, v_ar_account_id, 'client', p_client_id, 0.00, p_amount, 'Accounts Receivable Settlement');
```

---

### D. Vendor Payment Posting (`record_vendor_payment`)
**File:** Stored Procedure in Database (`apps/web/supabase/remediation/baseline_functions.json`)  
**Frontend Caller:** `apps/web/src/modules/Purchase/hooks/usePurchaseQueries.ts:782`

```sql
-- Lines 150-180 of record_vendor_payment
SELECT id INTO v_ap_account_id FROM public.accounts WHERE account_code = '2100';
SELECT id INTO v_bank_account_id FROM public.accounts WHERE account_code = CASE WHEN p_payment_mode = 'cash' THEN '1300' ELSE '1200' END;

INSERT INTO public.journal_entries (
  company_id, voucher_no, voucher_date, voucher_type, narration, status, created_by
) VALUES (
  p_organisation_id, v_voucher_no, CURRENT_DATE, 'Payment',
  'Vendor Payment - ' || v_voucher_no || ' (' || v_vendor.company_name || ')', 'Posted', auth.uid()
) RETURNING id INTO v_journal_id;

-- Dr Accounts Payable (Sundry Creditors)
INSERT INTO public.journal_entry_lines (journal_id, account_id, party_type, party_id, debit, credit, narration)
VALUES (v_journal_id, v_ap_account_id, 'vendor', p_vendor_id, p_amount, 0.00, 'Accounts Payable Settlement');

-- Cr Bank / Cash
INSERT INTO public.journal_entry_lines (journal_id, account_id, party_type, party_id, debit, credit, narration)
VALUES (v_journal_id, v_bank_account_id, 'vendor', p_vendor_id, 0.00, p_amount, 'Bank/Cash Disbursement');
```

---

### E. Payroll Accrual Posting (`finalize_payroll_run_atomic`)
**File:** Stored Procedure in Database (`apps/web/supabase/remediation/baseline_functions.json`)

```sql
-- Lines 68-112 of finalize_payroll_run_atomic
v_salary_exp_id     := public.ensure_gl_account_exists(p_organisation_id, '5100', 'Salaries & Wages', 'Expense');
v_pf_payable_id     := public.ensure_gl_account_exists(p_organisation_id, '2210', 'Provident Fund Payable', 'Liability');
v_esi_payable_id    := public.ensure_gl_account_exists(p_organisation_id, '2220', 'ESI Payable', 'Liability');
v_tds_payable_id    := public.ensure_gl_account_exists(p_organisation_id, '2200', 'TDS Payable (192B)', 'Liability');
v_adv_recovery_id   := public.ensure_gl_account_exists(p_organisation_id, '1400', 'Employee Advance Recovery', 'Asset');
v_salary_payable_id := public.ensure_gl_account_exists(p_organisation_id, '2120', 'Salaries Payable', 'Liability');

INSERT INTO public.journal_entries (
  company_id, voucher_no, voucher_date, voucher_type, narration, status, created_by
) VALUES (
  p_organisation_id, 'PAYROLL-' || p_month, CURRENT_DATE, 'Journal',
  'Monthly Payroll Accrual for ' || p_month, 'Posted', v_creator_id
) RETURNING id INTO v_journal_id;

-- Debit Gross Salaries
INSERT INTO public.journal_entry_lines VALUES (v_journal_id, v_salary_exp_id, p_gross_salary, 0.00, 'Gross Salaries & Wages Expense');

-- Credits for Deductions & Net Salary
IF p_total_pf > 0 THEN
  INSERT INTO public.journal_entry_lines VALUES (v_journal_id, v_pf_payable_id, 0.00, p_total_pf, 'Employee PF Deduction Payable');
END IF;
IF p_total_esi > 0 THEN
  INSERT INTO public.journal_entry_lines VALUES (v_journal_id, v_esi_payable_id, 0.00, p_total_esi, 'Employee ESI Deduction Payable');
END IF;
IF p_total_tds > 0 THEN
  INSERT INTO public.journal_entry_lines VALUES (v_journal_id, v_tds_payable_id, 0.00, p_total_tds, 'Employee TDS Deduction Payable');
END IF;
IF p_total_advances > 0 THEN
  INSERT INTO public.journal_entry_lines VALUES (v_journal_id, v_adv_recovery_id, 0.00, p_total_advances, 'Recovery of Employee Salary Advances');
END IF;
IF v_computed_net > 0 THEN
  INSERT INTO public.journal_entry_lines VALUES (v_journal_id, v_salary_payable_id, 0.00, v_computed_net, 'Net Salaries Payable to Employees');
END IF;
```

---

### F. Subcontractor Billing, TDS & Retention (`record_subcontractor_bill`)
**File:** Stored Procedure in Database (`apps/web/supabase/remediation/baseline_functions.json`)

```sql
-- Lines 48-78 of record_subcontractor_bill
-- Dr Subcontractor Expense (4100)
INSERT INTO public.journal_entry_lines (journal_id, account_id, party_type, party_id, debit, credit, narration)
VALUES (v_journal_id, v_expense_account_id, 'vendor', p_subcontractor_id, p_amount, 0.00, 'Subcontractor Expense');

-- Cr Accounts Payable Net of Retention (2100)
IF v_payable_amt > 0 THEN
  INSERT INTO public.journal_entry_lines (journal_id, account_id, party_type, party_id, debit, credit, narration)
  VALUES (v_journal_id, v_ap_account_id, 'vendor', p_subcontractor_id, 0.00, v_payable_amt, 'Accounts Payable - Subcontractor');
END IF;

-- Cr Held Retention Payable (2150)
IF v_retention_amt > 0 THEN
  INSERT INTO public.journal_entry_lines (journal_id, account_id, party_type, party_id, debit, credit, narration)
  VALUES (v_journal_id, v_retention_account_id, 'vendor', p_subcontractor_id, 0.00, v_retention_amt, 'Retention Payable');
END IF;
```

---

### G. Operational vs. GL Balance Calculation (`vendorLedger.ts`)
**File:** `apps/web/src/modules/Purchase/utils/vendorLedger.ts:107-151`  
**Finding:** Party balances are derived by manually joining operational tables rather than reading `journal_entry_lines`.

```typescript
// Vendor statement built on the fly from operational records:
const rawEntries = [
  ...bills.map((bill) => ({
    type: 'Bill',
    reference: bill.bill_number,
    debit: toNumber(bill.total_amount),
    credit: 0,
  })),
  ...payments.map((payment) => ({
    type: 'Payment',
    reference: payment.voucher_no,
    debit: 0,
    credit: toNumber(payment.amount),
  })),
  ...debitNotes.map((debitNote) => ({
    type: 'Debit Note',
    reference: debitNote.dn_number,
    debit: 0,
    credit: toNumber(debitNote.total_amount),
  })),
];
```
Similar operational derivation exists for clients in `apps/web/src/ledger/utils.ts:112-130` (`buildLedgerStatementRows`).
There is **no automated reconciliation screen or check** between GL control account totals and the sum of operational balances.

---

## Summary of Findings & Next Steps

1. **The application's transactional core is strong and ACID-protected**: Sales Invoices, Receipts, Purchase Bills, Vendor Payments, Payroll, Subcontractors, and Petty Cash Floats all write balanced double-entry vouchers to `journal_entries` and `journal_entry_lines`.
2. **Key Accounting Gaps for Production Compliance**:
   - **Input GST on Purchase Bills**: Currently, `record_purchase_bill` dumps total tax into Purchase Expense rather than debiting Input CGST (`2204`), SGST (`2205`), or IGST (`2206`).
   - **Fixed Asset Purchases (Capex vs Opex)**: Purchase bill line items need an `is_asset` flag to debit Fixed Assets (`1600`) instead of Operational Expense (`4100`).
   - **Perpetual Inventory / COGS**: Physical material receipt and sales invoice stock deductions do not create financial inventory asset entries.
   - **Ledger Statements from GL**: Front-end party ledgers should query `journal_entry_lines WHERE party_id = :id` so manual DayBook vouchers are reflected in client/vendor statements.
