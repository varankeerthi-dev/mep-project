# Chart of Accounts (COA) & Accounting Architecture v13.7 (The Final Pinnacle Blueprint)
*(Enterprise-Grade, MCA Rule 11(g) Compliant, Dual Depreciation Engine, MSME 43B(h))*

## 1. Overview
This is the ultimate, frozen accounting platform layer for **DIRECT ERP**. It implements a true double-entry accounting ledger equipped with a multi-line Posting Rules Engine, Bank Reconciliation, GSTR-2B reconciliation, deep Direct Tax compliance, Cross-GSTIN Stock Transfers, robust Post-Dated Cheque (PDC) lifecycle tracking, and native Contra Voucher handling.

---

## 2. The Core Organizational Hierarchy

### A. Legal & Physical Structure
1. **Organisation**
2. **Company** (`company_id`)
3. **Branch** (`branch_id`) 

### B. Reporting Dimensions
1. **Profit Centers**
2. **Cost Centers**

---

## 3. Database Architecture (The Frozen Core)

### 1. `accounts` (The Chart of Accounts)
* `id`, `company_id`, `organisation_id`, `account_code`, `name`, `root_type`, `account_type`
* **`schedule_iii_line` (String/Enum):** Maps the account directly to Indian Companies Act Schedule III.
* **`tax_section` (Enum/String):** Explicitly maps the account to an Income Tax Section (e.g., `194C`, `194J`).
* **`default_hsn_sac` (String):** Crucial for Service Income/Expense ledgers.
* `parent_id`, `is_group`
* **`system_account` (Enum)**

### 2. The Centralized Posting Engine & Stock Transfer Rules
**`posting_rules` (Header)** & **`posting_rule_lines` (Details)**
* **Place of Supply (PoS) Conditional Logic:** Automatically suppresses IGST or CGST/SGST based on inter/intra-state supply.
* **Section 269ST Cash Transaction Block:** Strictly blocks any cash entry >= ₹2,00,000 against a single party.
* **Cross-GSTIN Inter-Branch Stock Transfers:** Generates Tax Invoices and routes via `INTER_BRANCH_REC` and `INTER_BRANCH_PAY`.

### 3. Narration Template Engine
* **`narration_templates`**: `id`, `company_id`, `trigger_event`, `template_string`

### 4. Opening Balances & Tally Migration Support (The Cut-Over Mastery)
**`opening_balance_batches`** & **`tally_import_logs`**
* Trial Balance Verification Step enforces `SUM(debit) == SUM(credit)` before posting. Native Tally XML support.

**Crucial Cut-Over Edge Cases:**
* **PDC Opening Balances:** Uncleared PDCs skip the opening bank ledger and directly seed the `pdc_register` as "Held".
* **TDS Opening Credit Carry-Forward:** Seeds the `TDS_RECEIVABLE` ledger and `form_26as_reconciliations` tracking table for mid-year cutovers.

### 5. The Advanced Tax & Compliance Engines
**Indirect Taxes (GST)**
* **`tax_codes`**: `code`, `tax_rate`, `cess_rate`
* **`gstr2b_reconciliations`**

**Direct Taxes (TDS / TCS)**
* **`tds_sections`**: `code`, `single_limit`, `yearly_limit`.
* **Party / Vendor Master Extensions (TDS & MSME):**
  * `lower_deduction_cert_no` (Form 13), `rate`, `valid_from`, `valid_to`
  * **`tds_cumulative_ytd` (JSON/Table):** A dedicated tracking field explicitly storing the vendor's Year-To-Date (YTD) cumulative spend per FY per TDS Section.
  * **MSME 45-Day Rule (Section 43B(h)):** `is_msme`, `msme_udyam_no`, `msme_type` (`Micro`, `Small`). Drives the MSME Form I reporting.

### 6. Dual Depreciation Engine (Fixed Assets)
Indian law requires two entirely separate depreciation ledgers to be maintained simultaneously.

* **`asset_register`**: The master list of all capitalized assets.
  * `id`, `company_id`, `branch_id`, `asset_name`, `purchase_date`, `put_to_use_date`, `original_cost`
  * `companies_act_useful_life_years`, `companies_act_method` (SLM/WDV)
  * `it_act_block_id` (Link to the Income Tax Block of Assets), `it_act_depreciation_rate`
  * `linked_journal_id` (The capital purchase voucher)
* **`depreciation_schedules`**: The log of depreciation runs executed at FY end.
  * `id`, `asset_id`, `fiscal_year_id`
  * `companies_act_depreciation_amount`, `companies_act_closing_wdv` (This posts to the actual P&L)
  * `it_act_depreciation_amount`, `it_act_closing_wdv` (Shadow ledger for tax filing)
* **`asset_disposal_entries`**: Handles the sale, scrapping, or write-off of an asset.
  * `id`, `asset_id`, `disposal_date`, `sale_value`, `profit_loss_amount`
  * Triggers the Posting Engine to hit `Asset Disposal Gain/Loss`.

### 7. MCA Rule 11(g) Audit Trail Compliance
Indian law strictly dictates that accounting software must have an audit trail that **cannot be disabled**.
* **`journal_audit_logs`**: `id`, `journal_id`, `user_id`, `action`, `timestamp`, `previous_state`, `new_state`. 
* **Immutable State Capture:** Explicitly mapped as **MCA Rule 11(g) compliant** and locked at the database level to prevent tampering.

### 8. `journal_entries` & `journal_entry_lines`
* Includes `currency_code`, `exchange_rate`, `place_of_supply_state`
* Polymorphic Party Link (`party_type`, `party_id`)
* **`voucher_type`:** Core types include: `Sales`, `Purchase`, `Receipt`, `Payment`, `Journal`, `Credit Note`, `Debit Note`, and **`Contra`**.

### 9. Banking & PDC Architecture
**`pdc_register` (Post-Dated Cheques)**
* `id`, `company_id`, `cheque_no`, `cheque_date`, `bank_name` 
* `party_type`, `party_id`, `amount`, `presentation_date`, `linked_journal_id`
* `status`: `Held`, `Presented`, `Cleared`, `Bounced`, `Cancelled`.
* **Cheque Bounce Accounting Rule:** Auto-reverses the receipt voucher and auto-generates a Debit Note hitting `Bank Charges Expense` against the Customer.

**`bank_reconciliations`**
* natively supports parsing **CSV, Excel, OFX, and MT940** files.

---

## 4. Standardized GST-Ready Chart of Accounts Hierarchy

**1. Assets**
* Current Assets (Cash, Bank, AR, Inventory, ITC Receivables, CESS Input, GST TDS Receivable, TDS Receivable, TCS Receivable, GST Refund Receivable, Inter-Branch Receivable)
* Fixed Assets

**2. Liabilities**
* Current Liabilities (AP, Output GST, Output CESS, RCM GST, GST TDS Payable, TDS Payable, TCS Payable, GST Interest/Penalty, Short-term loans, Inter-Branch Payable)

**3. Revenue (Income)**
* Direct Income & Indirect Income
* FX Gain

**4. Expenses**
* Direct Expenses & Indirect Expenses
* Manufacturing Variance
* FX Loss
* Bank Charges 

---

## 5. UI / UX Strategy for DIRECT ERP

### A. The Consolidated vs Single Branch Toggle
* **Global Branch Selector:** Placed persistently at the top navigation bar.

### B. Sidebar Navigation (SME Optimized)
* Accounting
  * Dashboard
  * Day Book 
  * Receivables
  * Payables 
  * Post-Dated Cheques (PDC Tracker)
  * Tax Compliance
  * Reports
  * Journal Vouchers
  * Bank Reconciliation 
  * Fixed Assets
  * Tally Migration

### C. Screen Designs
1. **Financial Dashboard:** Show Bank Balance, Receivables, Payables, PDC Holdings, Tax Liabilities.
2. **Day Book Screen:** Pure chronological feed of EVERY voucher.
3. **Contra Voucher Entry Screen:** A stripped-down, lightning-fast UI for Cash/Bank.

---

## 6. Manufacturing Specific Implementation
* **Posting Trigger:** Accounting is strictly triggered exclusively on **Production Completion**. This prevents massive ledger bloat from partial or edited production runs.
* **Manufacturing Variance:** When Production is completed, if Actual Consumption deviates from Standard BOM Costs, the difference hits the `MANUFACTURING_VARIANCE` system account.

---

## 7. UI Design Tokens (Day Book & Ledger Grids)
The following strict design tokens must be used for the Accounting Day Book grid implementation to ensure extremely high data-density and Tally-like readability.

### Layout & Spacing
* **Page/container padding:** `0px` — full bleed table, screen-edge to edge
* **Top bar height:** `52px` (14px top + 14px bottom padding)
* **Filter bar height:** `44px` (10px top + 10px bottom padding)
* **Summary bar height:** `56px` (10px top + 10px bottom padding)
* **Table header height:** `32px` (7px top + 7px bottom padding, 11px text)
* **Data row height:** `56px` (10px top + 10px bottom padding)
* **Day total row height:** `32px` (6px top + 6px bottom padding)
* **Cell horizontal padding:** `12px left` + `12px right`
* **Border weight:** `0.5px` — all dividers, column borders, card borders
* **Border radius (Cards):** `12px` (--border-radius-lg)
* **Border radius (Chips/Badges):** `20px` (hard-coded pill)
* **Border radius (Buttons):** `8px` (--border-radius-md)

### Grid Column Layout (Fixed Layout, 680px minimum container)
* **Time:** `64px` fixed, HH:MM, 12px secondary
* **Voucher no.:** `130px` fixed, monospace 12px, secondary color
* **Type:** `96px` fixed, badge pill centered
* **Party / account:** `1fr` (flex fill) — party name 13px/500 + narration 12px secondary below
* **Debit (₹):** `100px` fixed, right-aligned, tabular-nums, danger color
* **Credit (₹):** `100px` fixed, right-aligned, tabular-nums, success color
* **Status:** `64px` fixed, center-aligned, 6px dot + 11px label

### Typography Scale
* **Page title:** 16px / 500 / `--color-text-primary`
* **Column header:** 11px / 500 / `--color-text-tertiary` / uppercase / 0.04em tracking
* **Party name:** 13px / 500 / `--color-text-primary`
* **Narration:** 12px / 400 / `--color-text-secondary` / margin-top 2px
* **Voucher number:** 12px / 400 / `--font-mono` / `--color-text-secondary`
* **Amount (debit):** 13px / 400 / tabular-nums / `--color-text-danger`
* **Amount (credit):** 13px / 400 / tabular-nums / `--color-text-success`
* **Amount (nil / dash):** 13px / 400 / `--color-text-primary` / content "—"
* **Time column:** 12px / 400 / `--color-text-tertiary`
* **Status label:** 11px / 400 / `--color-text-secondary`
* **Summary bar label:** 11px / 400 / `--color-text-tertiary` / margin-bottom 3px
* **Summary bar value:** 15px / 500 / `--color-text-primary` (or semantic color)
* **Filter chip / badge:** 12px / 400 inactive · 500 active / `--color-text-secondary`
* **Type badge text:** 11px / 500 / ramp-specific color
* **Day total row:** 12px / 500 / `--color-text-secondary`
* **Button label:** 13px / 400 / `--color-text-primary`
* **Search placeholder:** 13px / 400 / `--color-text-tertiary`
* **Date display:** 13px / 500 / `--color-text-primary` / min-width 120px / center-aligned

### Controls & Interactive Elements
* **Primary action button (New entry):** height `32px` · padding `6px 14px` · border-radius `8px` · icon `16px` + gap `6px`
* **Icon-only button (Export, nav arrows):** height `32px` · padding `6px 8px` · border-radius `8px` · icon `16px`
* **Date nav prev/next:** height `28px` · padding `5px 8px` · border-radius `8px`
* **Filter chip:** height `28px` · padding `4px 12px` · border-radius `20px` (pill)
* **Branch pill:** height `24px` · padding `3px 10px` · border-radius `20px` · icon `14px`
* **Search input:** height `32px` · width `180px` · padding `5px 10px 5px 28px` (icon offset) · border-radius `8px`
* **Search icon:** `14px` · absolute left `8px` · `--color-text-tertiary`

### Voucher Type Badge Colors
* **Sales:** bg `#E1F5EE` · text `#085041`
* **Purchase:** bg `#FAEEDA` · text `#633806`
* **Receipt:** bg `#E6F1FB` · text `#0C447C`
* **Payment:** bg `#FCEBEB` · text `#791F1F`
* **Journal:** bg `#F1EFE8` · text `#444441`
* **Contra:** bg `#EEEDFE` · text `#3C3489`
* **Credit note:** bg `#FBEAF0` · text `#72243E`
* **Debit note:** bg `#FAECE7` · text `#712B13`

### Surface & Status Colors
* **Top bar bg:** `--color-background-primary`
* **Filter bar bg:** `--color-background-secondary` (subtle surface)
* **Summary bar bg:** `--color-background-primary` · separated by 1px bg-tertiary grid gap
* **Table header bg:** `--color-background-secondary`
* **Data row (default):** `transparent`
* **Data row (hover):** `--color-background-secondary` · transition `0.1s`
* **Day total row:** `--color-background-secondary`
* **Branch pill bg:** `--color-background-info`
* **Filter chip (active):** `--color-background-primary` · `border-color-primary`
* **Filter chip (inactive):** `--color-background-primary` · `border-color-secondary`
* **Status dot (Posted):** `#1D9E75` (teal-400)
* **Status dot (Draft):** `#BA7517` (amber-600)
