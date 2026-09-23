# Chart of Accounts - Comparison Report (Existing vs Reference)

## Executive Summary

**Overall Status:** Partial Implementation — Core GL engine exists but is missing Indian compliance depth, reports, and UX polish.

### Top 5 Critical Gaps
1. **No Schedule III reports** (Balance Sheet / P&L presentation required by Companies Act 2013)
2. **No TDS master + ledgers** (only ad-hoc `subcontractor_tds_payments`; missing 194J/194C sections, thresholds, TDS Receivable/Payable)
3. **No GST return mapping UI** (GSTR-1/GSTR-2B/3B tables exist but no report/mapping screens)
4. **No period locks / approval workflow** (vouchers post without approval; no financial year lock)
5. **No import/export wizards** for CoA, ledgers, or opening balances

### Top 5 Quick Wins
1. Add `schedule_iii_line` display in CoA tree (column already exists in DB)
2. Add CoA import/export using existing CSV infrastructure
3. Build Schedule III BS/P&L report view from existing `accounts` + `journal_entry_lines`
4. Add GST/TDS flag filters in CoA list
5. Add tooltip/help text for non-accountant users

---

## 1. Fonts & Typography (UX Check)

| Check | Current Implementation | Reference Expectation | Status |
|---|---|---|---|
| **Primary font family** | `Inter`, `IBM Plex Sans` via Tailwind config (`tailwind.config.cjs`) | Clean sans-serif suitable for finance data | Match |
| **Mono/numeric font** | `IBM Plex Mono` for account codes, voucher numbers, amounts | Monospace for tabular data | Match |
| **Display font** | `Space Grotesk` | Not specifically required for accounting | Match |
| **Font sizes** | `text-[11px]` headers, `text-[12px]` secondary, `text-[13px]` body, `text-[16px]` page titles | Consistent scale across screens | Match |
| **Font weights** | `font-medium`, `font-semibold`, `font-bold` used for hierarchy | Clear hierarchy | Match |
| **Line height / spacing** | Tailwind default; no custom line-height tokens in config | Consistent spacing | Match |
| **Accounting-specific typography** | No dedicated accounting font stack | Reference doesn't mandate specific fonts | N/A |
| **Mobile responsiveness** | Not verified for accounting screens; LedgerDashboard uses responsive grid | Mobile-friendly for approvals | Partial |
| **Accessibility (contrast)** | Uses standard Tailwind zinc/gray palette; no explicit contrast audits | WCAG considerations mentioned in reference | Partial |

**Font verdict:** Current font system is adequate. Reference doesn't prescribe specific accounting fonts beyond readability. No critical issues.

---

## 2. Requirements Coverage (vs Checklist & Prompt)

| Requirement Area | Reference (file/section) | Implemented? | Evidence in Code | Gaps / Deviations | Suggested Action | Priority |
|---|---|---|---|---|---|---|
| **CoA hierarchy (group/ledger)** | CoA prompt §A, UX checklist §B | Yes | `accounts` table: `parent_id`, `is_group`; `ChartOfAccounts.tsx` tree | Missing depth limit enforcement, circular ref prevention | Add DB constraint + frontend validation | P1 |
| **Account numbering scheme** | CoA prompt §A | Partial | `account_code` varchar exists; auto-numbering not implemented | No standard numbering template (4–6 digit grouped) | Provide default CoA template on org creation | P1 |
| **Root types (Asset/Liability/Income/Expense)** | CoA prompt §A | Yes | `accounts.root_type` column; ChartOfAccounts modal | Equity root type missing from UI dropdown | Add Equity option to create modal | P2 |
| **Account types (Dr/Cr nature)** | CoA prompt §A | Partial | `accounts.normal_balance` exists | Not surfaced in UI; no validation against root_type | Show normal balance in CoA list; enforce Dr/Cr rules | P1 |
| **Schedule III mapping** | CoA prompt §A, UX checklist §B | Partial | `accounts.schedule_iii_line` column exists | No Schedule III report view; column not displayed in UI | Build Schedule III report; add column to CoA edit | P1 |
| **GST applicability flags** | CoA prompt §A | Partial | `accounts.tax_applicable` boolean exists | No GST ledger auto-selection by POS | Add GST ledger mapping + POS logic | P1 |
| **TDS applicability flags** | CoA prompt §A | Partial | `accounts.tax_section` varchar exists | No TDS section dropdown; no TDS Receivable/Payable ledgers | Create TDS master + auto-ledger creation | P1 |
| **Control accounts & sub-ledgers** | CoA prompt §B | Partial | `accounts.account_type` includes 'receivable', 'payable', 'Control Account'; `journal_entry_lines.party_id` enforced in RPC | No sub-ledger master pages (customers, vendors, employees, banks, projects) | Build master CRUD pages with auto-ledger creation | P1 |
| **Ledger master fields (PAN/GSTIN/state/MSME/TDS)** | CoA prompt §B | Partial | `parties` table exists; `gstin` field likely on clients/vendors | No unified party master with all required fields | Add MSME type, TDS section, PAN validation to party form | P1 |
| **Auto-create ledgers on master creation** | CoA prompt §B | Partial | Manufacturing GL auto-creates inventory accounts | No auto-creation for customers/vendors/employees | Hook into client/vendor create to generate ledger accounts | P1 |
| **Voucher types (full matrix)** | CoA prompt §C, UX checklist §D | Partial | `voucher_type` enum: Contra, Credit Note, Debit Note, Journal, Payment, Purchase, Receipt, Sales | DayBook UI only exposes Journal, Receipt, Payment, Contra, Sales, Purchase; missing Credit/Debit Note entry UI | Add all voucher type forms with GST/TDS logic | P1 |
| **Double-entry enforcement** | CoA prompt §C | Yes | `post_double_entry_journal` RPC validates Dr/Cr balance | Balance check exists; no unbalanced voucher prevention in UI | Add real-time balance validation in voucher form | P2 |
| **GST logic (POS/intra/inter/export/RCM/ITC)** | CoA prompt §C | Partial | GST tables exist (`gst_outward_supply`, `gst_inward_supply`, `gst_itc_ledger`, `gst_rcm_liability`); POS column on journal_entries | No GST calculation engine in voucher entry; no POS-based ledger selection | Build GST auto-populate in voucher entry | P1 |
| **TDS logic (194J, thresholds, Receivable/Payable)** | CoA prompt §C | Partial | `subcontractor_tds_payments` exists; `accounts.tax_section` exists | No TDS calculation; no TDS Receivable/Payable ledgers; no threshold checks | Build TDS master + calculation engine | P1 |
| **Project tagging on vouchers** | CoA prompt §C | Yes | `journal_entry_lines.project_id`, `cost_center_id` | Project P&L report missing | Build Project P&L report | P1 |
| **Revenue recognition (T&M vs Fixed Price)** | CoA prompt §C | No | No unbilled revenue / accrued income logic | Missing for software/design company | Add unbilled revenue accounts + WIP tracking | P2 |
| **Opening balance import** | CoA prompt §D, UX checklist §D | Partial | `OpeningBalanceTab` in LedgerDashboard; `party_opening_balances` table | No CoA opening balance import; no validation (Dr=Cr) | Add CoA opening balance import + TB validation | P1 |
| **Audit trail** | CoA prompt §D | Partial | `gst_audit_log` exists; journal entries have `created_by`, `approved_by` | No unified audit trail for all accounting changes | Build audit log viewer with filters | P1 |
| **RBAC & permissions** | CoA prompt §D | Partial | RPC checks roles: admin, owner, accountant, manager | No granular permissions (View/Edit/Create/Delete per module) | Add role-permission matrix + enforcement | P1 |
| **Period close / locks** | CoA prompt §D | No | No period lock mechanism found | Posting to closed periods not blocked | Add financial year lock + unlock-with-approval | P1 |
| **CoA tree with search & filters** | UX checklist §F | Partial | Search input exists but not functional; no GST/TDS filters | Search is placeholder only | Wire search + add type/GST/TDS filters | P2 |
| **Onboarding wizard / recommended template** | UX checklist §F | No | No onboarding wizard | Missing for non-accountants | Build CoA template wizard for software companies | P2 |
| **Smart defaults in voucher entry** | UX checklist §F | No | DayBook modal has basic account selector | No GST auto-select, no TDS auto-calc | Add smart defaults based on voucher type + party | P1 |
| **Import wizard with preview** | UX checklist §F | No | No import UI | Missing | Build CSV import with mapping preview + error log | P1 |
| **Schedule III report view** | UX checklist §F | No | `schedule_iii_line` column exists but no report | Critical compliance gap | Build BS/P&L report using Schedule III mapping | P0 |
| **Project P&L** | UX checklist §F | No | `project_id` on journal lines | No report | Build project-wise P&L from journal entries | P1 |
| **Debtors/Creditors ageing** | UX checklist §F | No | Party ledger exists but no ageing buckets | Missing | Build ageing report from party balances | P1 |
| **GST/TDS summaries** | UX checklist §F | Partial | GST tables exist; no report UI | Data captured but not surfaced | Build GST/TDS summary reports | P1 |
| **Mobile-responsive approvals** | UX checklist §F | No | Not verified; accounting screens not in mobile app | Cross-platform requirement per .agents/AGENTS.md | Port accounting views to mobile | P2 |

---

## 3. Chart of Accounts Comparison (vs Template)

| Area | Reference (CoA Template) | Current State | Match/Gap | Missing Accounts / Codes | Suggested Changes | Priority |
|---|---|---|---|---|---|---|
| **Account structure & numbering** | 4–6 digit grouped: Assets 1000–1999, Liabilities 2000–2999, Equity 3000–3999, Income 4000–4999, Expenses 5000–5999 | `account_code` varchar exists; no enforced numbering scheme | Gap | No standard template; no code validation | Provide software-company CoA template with standard codes | P1 |
| **Schedule III mapping** | Every account mapped to BS/P&L line items (Revenue from operations, Other income, Employee benefits, etc.) | `schedule_iii_line` column exists on `accounts` | Partial | No Schedule III report; mapping not enforced | Build Schedule III report; add required-field validation | P0 |
| **GST/TDS flags & SAC** | GST ledgers (CGST/SGST/IGST/UTGST Input/Output), TDS sections, SAC codes for services | `tax_applicable`, `tax_section`, `default_hsn_sac` columns exist | Partial | No GST-specific account types; no SAC master | Add GST account type enum; create SAC master table | P1 |
| **Control accounts & sub-ledgers** | Debtors (1100), Creditors (2100), Banks (1200), Fixed Assets (1300), Projects (1400) | `account_type` supports receivable/payable/Control Account | Partial | Sub-ledger masters not built; no auto-creation | Build customer/vendor/bank/project masters with auto-ledger | P1 |
| **Software/design-specific accounts** | Design Services Revenue, Subcontractor Charges, SaaS subscriptions, Cloud infra, Design tools, Amortisation | Generic Expense/Income accounts only | Gap | No design-specific accounts | Add recommended accounts to onboarding template | P2 |
| **System vs user accounts** | System accounts locked from deletion | `system_account` column exists | Partial | No UI indication; no delete protection | Show lock icon in UI; prevent deletion via RPC | P2 |
| **Nature (Dr/Cr)** | Normal balance per account type | `normal_balance` enum exists | Partial | Not surfaced in UI; no validation | Display in CoA list; enforce on voucher posting | P1 |

---

## 4. Vouchers & Bookkeeping (vs Voucher Matrix)

| Voucher Type | Required? | Implemented? | GST Impact Handled | TDS Impact Handled | Project Tagging | Gaps | Priority |
|---|---|---|---|---|---|---|---|
| **Sales Invoice** | Yes | Partial | Partial (GST tables exist, no auto-post) | No | Yes | No sales invoice voucher entry; billing module posts separately | P1 |
| **Credit Note** | Yes | Partial | Partial | No | Yes | No dedicated credit note voucher entry UI | P1 |
| **Debit Note** | Yes | Partial | Partial | Partial | Yes | No debit note voucher entry UI | P1 |
| **Purchase Bill** | Yes | Partial | Partial | Partial | Yes | No purchase bill voucher entry UI | P1 |
| **Purchase Return** | Yes | Partial | Partial | No | Yes | Just created `purchase_returns` feature; not integrated to GL | P1 |
| **Receipt** | Yes | Partial | No | No | No | LedgerDashboard has receipt recording; no GST/TDS | P2 |
| **Payment** | Yes | Partial | No | Partial | No | Payment recording exists; TDS not handled | P2 |
| **Contra** | Yes | Partial | No | No | No | Listed in DayBook dropdown; no form | P2 |
| **Journal Voucher** | Yes | Yes | No | No | Yes | DayBook modal works; basic double-entry | P2 |
| **Bank Receipt/Payment** | Yes | No | No | No | No | Not implemented | P1 |
| **Expense Voucher** | Yes | No | No | No | Yes | Not implemented | P1 |
| **Petty Cash** | Yes | No | No | No | No | Not implemented | P2 |
| **Payroll JV** | Yes | No | N/A | No | No | Not implemented | P2 |
| **GST Adjustment** | Yes | No | N/A | N/A | No | Not implemented | P1 |
| **TDS Adjustment** | Yes | No | N/A | N/A | No | Not implemented | P1 |
| **Opening Balance** | Yes | Partial | No | No | No | Client opening balances exist; no CoA opening balance | P1 |

---

## 5. Compliance Mapping (GST, TDS, Schedule III)

| Compliance Area | Reference Expectation | Current Implementation | Status | Gaps | Suggested Fix | Priority |
|---|---|---|---|---|---|---|
| **GST (intra/inter/export/LUT/RCM/ITC)** | POS-based GST calculation, GSTR-1/2B/3B mapping, ITC eligibility, RCM liability | Tables exist (`gst_outward_supply`, `gst_inward_supply`, `gst_itc_ledger`, `gst_rcm_liability`, `gst_configurations`); no UI | Partial | No GST calculation engine; no return filing UI; no POS-based ledger selection | Build GST engine + return preparation screens | P0 |
| **TDS (194J, sections, thresholds)** | TDS on professional fees (194J), TDS on contractors (194C), thresholds, TDS Receivable/Payable ledgers | `subcontractor_tds_payments` exists; `accounts.tax_section` exists; no master | Partial | No TDS master; no calculation; no TDS Receivable/Payable ledgers; no 26Q/24Q mapping | Build TDS master + calculation + ledgers | P0 |
| **Schedule III (BS/P&L)** | Balance Sheet: Non-current/Current assets, Equity, Non-current/Current liabilities. P&L: Revenue, Other income, Employee benefits, Finance costs, Depreciation, Other expenses, Tax | `accounts.schedule_iii_line` column exists; no report | Gap | No Schedule III report view; no mapping validation | Build Schedule III report from journal entries + accounts mapping | P0 |
| **GSTR-1/GSTR-2B mapping** | Invoice-level mapping to GSTR-1 tables; 2B matching | `gstr1_documents`, `gstr2b_documents` tables exist | Partial | No UI; no auto-mapping from invoices/bills | Build GST return preparation screens | P1 |
| **TDS Returns (24Q/26Q)** | Form 26Q for non-salaries; deductee-wise challan mapping | `subcontractor_tds_payments` exists | Partial | No Form 26Q generation; no deductee master | Build TDS return preparation | P1 |
| **Debtors/Creditors Ageing** | Ageing buckets (0-30, 31-60, 61-90, 90+) | Party ledger exists; no ageing report | Gap | No ageing buckets; no report | Build ageing from party balances + due dates | P1 |
| **MSME considerations** | MSME type on parties; MSME ageing | No MSME fields found | Gap | No MSME registration tracking | Add MSME type to party master; add ageing alerts | P2 |

---

## 6. Data Model Comparison

| Table/Entity | Reference Fields | Present in Code | Missing Fields | Type Mismatches | Notes | Priority |
|---|---|---|---|---|---|---|
| **ChartOfAccounts / accounts** | id, code, name, parent_id, type, root_type, nature(Dr/Cr), GST applicable, TDS applicable, Schedule III mapping, control_account, sub_ledger_required, project/cost_center applicable, status | Yes (remote verified) | `is_control_account` (has `account_type` instead), `sub_ledger_required` flag, `project_applicable` | `root_type` is varchar not enum | Core structure solid; needs Schedule III validation | P1 |
| **Ledgers / sub-ledgers** | Customer, Vendor, Employee, Bank, Project, Fixed Asset masters with PAN/GSTIN/State/MSME/TDS | Partial | Unified `party_master` with all fields | Multiple tables (`clients`, `vendors`, `employees`, `banks`) instead of unified | Need master CRUD pages | P1 |
| **Vouchers / journal_entries** | id, voucher_no, date, type, narration, status, approved_by, approved_at, financial_year, document_id, document_type, place_of_supply | Yes (remote verified) | `place_of_supply_state` exists but not used in UI | `voucher_type` is enum (good) | Solid foundation | P2 |
| **VoucherLines / journal_entry_lines** | id, journal_id, account_id, party_id, party_role, debit, credit, narration, cost_center_id, project_id | Yes (remote verified) | None critical | `party_role` is custom enum (good) | Supports project tagging and control accounts | P2 |
| **GST Outward Supply** | customer_id, invoice_number, date, type, place_of_supply, reverse_charge, taxable_value, IGST/CGST/SGST/cess, total_value, source_record_id | Yes | `period_month`, `period_year` exist | Good | Need UI for GST return prep | P1 |
| **GST Inward Supply** | supplier_id, invoice_number, date, type, taxable_value, IGST/CGST/SGST/cess, ITC eligible/blocked, reconciliation_status | Yes | Good | Good | Need UI | P1 |
| **GST ITC Ledger** | period, type, opening, credit_available/utilized/blocked/lapsed, closing | Yes | Good | Good | Need report | P1 |
| **TDS Payments** | vendor_id, amount, tds_section, tds_amount, challan_no, date | Partial (`subcontractor_tds_payments`) | Missing deductee details, PAN, certificate_no | Partial | Need master + full ledger | P1 |
| **Opening Balances** | party_id, role, financial_year, amount, balance_type, as_of_date | Yes (`party_opening_balances`) | Missing CoA opening balances | Good | Need CoA opening balance import | P1 |
| **Audit Trail** | table_name, record_id, action, old_data, new_data, changed_by, changed_at, ip_address | Partial (`gst_audit_log`) | Not unified across all tables | Partial | Build unified audit log | P1 |
| **Period Lock** | financial_year, locked_by, locked_at, status | No | Missing entirely | N/A | Critical for compliance | P0 |

---

## 7. RBAC, Audit Trail & Period Control

| Item | Reference Requirement | Current State | Status | Gaps | Suggested Fix | Priority |
|---|---|---|---|---|---|---|
| **Roles & permissions** | CoA View/Edit/Create/Delete, Post Vouchers, Approve JVs, Reopen Periods, Manage Masters, Audit Access | RPC checks admin/owner/accountant/manager | Partial | No granular per-module permissions; no UI for role management | Add role-permission matrix + admin UI | P1 |
| **Audit trail** | Who/when/what for all accounting changes | `gst_audit_log` only; journal entries have `created_by`/`approved_by` | Partial | No unified audit log; no viewer UI | Build audit log table + viewer | P1 |
| **Period close / locks** | Block posting to closed periods; unlock with approval | Not implemented | Gap | No financial year lock mechanism | Add period lock table + RPC guard | P0 |

---

## 8. Imports, Reports & UX

| Area | Reference | Current | Status | Gaps | Suggested Fix | Priority |
|---|---|---|---|---|---|---|
| **CoA import** | CSV/Excel import with mapping preview | No | Missing | No import wizard | Build CSV import with preview + error log | P1 |
| **Ledger import** | Customer/vendor/employee/bank import | No | Missing | No import | Build party master import | P1 |
| **Opening balance import** | TB import, validate Dr=Cr | Partial (client OB only) | Missing CoA OB | No CoA opening balance import | Add CoA OB import + TB validation | P1 |
| **Schedule III report** | BS/P&L in Schedule III format | No | Missing | Critical compliance gap | Build report from `accounts.schedule_iii_line` + journal lines | P0 |
| **Trial Balance** | TB with Dr/Cr balances | No | Missing | Basic report needed | Build TB from accounts balances | P1 |
| **Debtors/Creditors ageing** | Ageing buckets | No | Missing | Standard report | Build from party balances + invoice dates | P1 |
| **GST summary reports** | GSTR-1/3B ready data | Partial (tables exist) | No UI | Missing report screens | Build GST return preparation screens | P1 |
| **TDS summary reports** | Form 26Q/24Q | Partial (data exists) | No UI | Missing | Build TDS return screens | P1 |
| **Project P&L** | Project-wise revenue, cost, margin | No | Missing | Project tagging exists but no report | Build project P&L from tagged journal entries | P1 |
| **UX flows** | Onboarding wizard, smart defaults, tooltips, business-friendly labels | Basic modals, minimal help text | Partial | No onboarding; no tooltips; technical terms not explained | Add onboarding wizard + tooltips + business labels | P2 |

---

## 9. Missing Features List (Prioritised)

| Feature | Source (reference file) | Why needed (compliance/UX) | Suggested Implementation (high-level) | Effort | Priority |
|---|---|---|---|---|---|
| **Schedule III BS/P&L Report** | CoA prompt §A, UX checklist §F | Companies Act 2013 compliance | SQL aggregation by `schedule_iii_line` + report page | High | P0 |
| **Period Lock Mechanism** | CoA prompt §D, Roadmap | Prevent back-dated entries; audit readiness | `financial_year_locks` table + RPC guard on posting | Medium | P0 |
| **TDS Master + Ledgers** | CoA prompt §A/B, GST_TDS_Masters | 194J/194C compliance | TDS sections table + TDS Receivable/Payable auto-creation | High | P0 |
| **GST Return Preparation UI** | Compliance_Mapping | GSTR-1/3B filing | Screens to review `gst_outward_supply`/`gst_inward_supply` + JSON export | High | P0 |
| **CoA Import/Export** | UX checklist §F, Import_India.csv | Easy setup + cutover | CSV wizard with mapping preview + validation | Medium | P1 |
| **Sub-ledger Masters (Customer/Vendor/Employee/Bank/Project)** | CoA prompt §B | Auto-create ledgers; control accounts | CRUD pages with PAN/GSTIN/MSME/TDS fields + auto-ledger hook | High | P1 |
| **Trial Balance Report** | Roadmap | Basic financial statement | Aggregate `current_balance` by root_type + account | Low | P1 |
| **Debtors/Creditors Ageing** | UX checklist §F | Collection management | Bucket outstanding by days + report | Medium | P1 |
| **Project P&L Report** | CoA prompt §C | Project profitability | Filter journal entries by `project_id` + P&L aggregation | Medium | P1 |
| **Opening Balance Import (CoA)** | CoA prompt §D | Cutover readiness | CSV import + TB validation (Dr=Cr) | Medium | P1 |
| **Audit Trail Viewer** | CoA prompt §D | Audit readiness | Unified audit log table + filter UI | Medium | P1 |
| **Voucher Approval Workflow** | CoA prompt §D | Segregation of duties | `approved_by`/`approved_at` enforcement + UI | High | P1 |
| **Revenue Recognition (T&M/Fixed Price)** | CoA prompt §C | SaaS/design company needs | Unbilled Revenue + Accrued Income accounts + auto-JV | High | P2 |
| **Onboarding Wizard** | UX checklist §F | Non-accountant adoption | Multi-step wizard with recommended CoA template | Medium | P2 |
| **Bank Reconciliation** | Roadmap | Bank matching | CSV import + auto-match against journal entries | Medium | P2 |
| **FX Revaluation** | Roadmap | International clients | Period-end FX gain/loss JV | Medium | P2 |

---

## 10. Code Suggestions & Quick Fixes

### P0 — Critical
1. **Add Schedule III report page** (`src/pages/accounting/ScheduleIIIReport.tsx`): query `accounts` joined with `journal_entry_lines`, group by `schedule_iii_line`, render BS/P&L sections.
2. **Add period lock RPC + guard**: `lock_financial_year(org_id, fy)` + modify `post_double_entry_journal` to reject locked periods.
3. **Build TDS section master** + TDS Receivable/Payable auto-ledger creation.

### P1 — High
4. **CoA Create/Edit form** (`ChartOfAccounts.tsx`): add fields for `account_type`, `normal_balance`, `schedule_iii_line`, `tax_applicable`, `tax_section`, `system_account`, `reconciliation_required`.
5. **Add GST/TDS filter chips** to CoA list.
6. **Build CoA import wizard** using existing CSV infrastructure.
7. **Add sub-ledger master pages** for clients, vendors, employees, banks, projects with auto-ledger creation on save.
8. **Build Trial Balance report** from `accounts.current_balance`.
9. **Build Debtors/Creditors ageing report** from party balances + invoice due dates.
10. **Add real-time balance validation** in DayBook voucher entry modal.

### P2 — Medium
11. **Add onboarding wizard** with pre-filled CoA template for software/design companies.
12. **Add tooltips** explaining CGST Output, TDS Payable u/s 194J, etc.
13. **Build Project P&L report** using `journal_entry_lines.project_id`.
14. **Add bank reconciliation screen** with CSV import + match logic.

---

## 11. Appendix

### File Paths Analyzed (Key Files)
- `apps/web/src/pages/accounting/ChartOfAccounts.tsx` — CoA tree UI
- `apps/web/src/pages/accounting/DayBook.tsx` — Voucher entry UI
- `apps/web/src/pages/accounting/useAccounting.ts` — Accounting hooks
- `apps/web/src/ledger/LedgerDashboard.tsx` — Client ledger dashboard
- `apps/web/src/ledger/api.ts` — Ledger API functions
- `apps/web/src/ledger/utils.ts` — Ledger utility functions
- `apps/web/tailwind.config.cjs` — Font configuration
- `apps/web/supabase/migrations/20240101000156_double_entry_gl_engine.sql` — Core GL engine
- `apps/web/supabase/migrations/20260722000000_material_returns_module.sql` — Material returns
- `apps/web/Charts_of_accounts/CoA_Detailed_Prompt_Indian_Software_Design_Company.md` — Reference spec
- `apps/web/Charts_of_accounts/Implementation_UX_Checklist_India.md` — UX checklist
- `apps/web/Charts_of_accounts/Roadmap_Risks_India.md` — Roadmap

### Assumptions Made
- CSV reference files (`Voucher_Matrix_India.csv`, `Compliance_Mapping_India.csv`, `GST_TDS_Masters_India.csv`, `Import_India.csv`, `opening_Balance_Import_India.csv`) are binary/XLSX despite `.csv` extension and could not be parsed; analysis based on markdown reference files only.
- `root_type` is stored as `varchar` not enum in the remote database.
- `accounts` table exists in production but no local migration file was found creating it (likely created via Supabase Studio or legacy migration).
- Mobile app (`apps/mobile`) has no accounting screens; cross-platform parity requirement from `.agents/AGENTS.md` is unmet.

### Commands Run
```bash
# Database schema verification
supabase db query --linked "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'accounts'"
supabase db query --linked "SELECT column_name, data_type FROM information_schema.columns WHERE table_name IN ('journal_entries', 'journal_entry_lines')"
supabase db query --linked "SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'voucher_type')"
supabase db query --linked "SELECT table_name FROM information_schema.tables WHERE table_name LIKE '%gst%' OR table_name LIKE '%tds%'"

# File discovery
Get-ChildItem -Recurse "Charts_of_accounts"
Get-ChildItem -Recurse -Filter "ChartOfAccounts*"
Get-ChildItem -Recurse -Filter "DayBook*"
Get-ChildItem -Recurse -Filter "LedgerDashboard*"
```
