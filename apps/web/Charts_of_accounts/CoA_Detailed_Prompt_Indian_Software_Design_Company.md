You are an expert in Indian accounting, GST, TDS, bookkeeping, and SaaS/product UX design. Your task is to design and specify a robust, scalable, and user-friendly Chart of Accounts (CoA) system for a software design company operating in India.

### Business Context
- Company type: Indian software/design services company (IT services, UI/UX design, product design, branding, consulting, or agency model).
- Compliance requirements: Indian Companies Act 2013 (Schedule III presentation), Income Tax Act (TDS, Section 194J/others as applicable), GST (CGST, SGST, IGST, UTGST), RCM where applicable, SAC codes for services, MSME considerations, and audit readiness.
- Business model: Primarily project-based (fixed-price/time & material), may have retainer contracts, international clients (exports of services - LUT/billing in foreign currency), subcontractors/freelancers, and in-house employees.
- Tooling context: This is to be built inside a modern web-based accounting/ERP module for a software design company (can be integrated with billing, payroll, expenses, projects, timesheets, bank reconciliation, and GST returns).

### Objectives
1. Design a standard, extensible Chart of Accounts suitable for an Indian software design company.
2. Define account hierarchy, ledger structure, sub-ledgers, and mapping to Schedule III (Balance Sheet & P&L).
3. Specify bookkeeping requirements: voucher types, double-entry rules, GST/TDS treatment, project costing, and revenue recognition considerations.
4. Provide a detailed implementation plan (data model, API, validations, roles/permissions, audit trail).
5. Recommend UX improvements to make it easy for non-accountants (founders, project managers) to use while keeping it CA/audit-compliant.

### Requirements to deliver

#### A. Chart of Accounts Structure
- Suggest a complete, ready-to-import CoA (with Account Code, Account Name, Parent Account, Account Type, Nature (Dr/Cr), GST Applicability, TDS Applicability, Schedule III mapping, Is Control Account, Sub-ledger Required, Project/Cost Center applicability, Status).
- Follow a logical numbering scheme (e.g. 4–6 digit) grouped by Assets, Liabilities, Equity, Income, Expenses.
- Include Indian-specific accounts: GST Input (CGST/SGST/IGST/UTGST), GST Output, GST Reverse Charge, GST Suspense, TDS Receivable, TDS Payable (u/s 194J etc.), LUT-related, export of services, SEZ (if any), MSME payables ageing considerations.
- Cover software/design-specific accounts: Design Services Revenue (with SAC), Subcontractor/Freelancer Charges, Software Licenses/Subscriptions (SaaS), Cloud Infrastructure, Design Tools, Salaries & Benefits, PF/ESI/Gratuity provisions, Rent, Internet, Depreciation (Computers, Furniture), Amortisation (Software), Bank Charges, Foreign Exchange Gain/Loss, Bad Debts, Project WIP (if any), Prepaid Expenses, Advances to Vendors/Employees.

#### B. Ledgers & Sub-ledgers
- Define Control Accounts vs Subsidiary Ledgers (Debtors/Customers, Creditors/Vendors, Employees, Projects, Banks, Fixed Assets).
- Specify mandatory ledgers per module (Billing, Purchase, Expenses, Payroll, Bank, GST, TDS).
- Define ledger attributes: PAN, GSTIN, Address, State (for place of supply), Contact, Payment Terms, Credit Limit, Currency (INR + FCY if international), MSME Type (if registered), SAC preferred, TDS Section.
- Suggest how to auto-create ledgers on master creation (customer/vendor/employee/project).

#### C. Bookkeeping & Voucher System
- List all required voucher types with usage, debit/credit rules, mandatory fields, and GST/TDS impact: Sales Invoice, Credit Note, Debit Note, Purchase Bill, Purchase Return, Receipt, Payment, Contra, Journal Voucher, Bank Receipt/Payment, Expense Voucher, Petty Cash, Payroll JV, GST Adjustment, TDS Adjustment, Opening Balance.
- Define revenue recognition logic for software/design services (T&M vs Fixed Price) and how it maps to ledgers (Unbilled Revenue/Accrued Income vs Revenue).
- Specify treatment for: exports of services (zero-rated, LUT), inter-state/intra-state, RCM (e.g. certain imports/services), advance receipts (GST on advances as applicable), credit utilisation, and foreign currency invoices (FX gain/loss).
- Project-wise bookkeeping: ability to tag vouchers to Project/Client/Department/Cost Center with reporting (Project P&L, cost tracking).

#### D. Implementation Details
- Data model: ERD outline for CoA, Ledgers, Sub-ledgers, Vouchers, Voucher Lines, Tax Mappings (GST Slabs by SAC/state), TDS Masters, Audit Trail.
- Hierarchy rules: prevent circular references, enforce account types, lock system accounts, allow soft-delete with history.
- Validations: Dr/Cr balance rules, required tax fields, state-wise GST validation, PAN/GSTIN format checks (Indian formats), voucher posting checks (unbalanced vouchers blocked).
- Integrations: Billing -> Revenue + Debtors + GST, Purchase/Expenses -> Payables + ITC, Payroll -> Employee Cost + Payables, Bank Import (CSV/MT940) -> Bank Ledger + Reconciliation, GST Returns (GSTR-1, GSTR-2B/3B mapping), TDS Returns (Form 24Q/26Q as relevant).
- Permissions & roles: Chart of Accounts (View/Edit/Create/Delete), Post Vouchers, Approve JVs, Reopen Periods, Manage Masters, Audit Access (read-only with logs).
- Opening balances: import template, validation, and cutover strategy.

#### E. UX Improvements
- Information architecture: clean left-nav (Masters > Chart of Accounts), grouped tree with expand/collapse, quick search (by code/name), filters (type, status, GST/TDS relevant).
- Onboarding: suggest a pre-filled CoA template for software/design company with ability to customise, “Recommended accounts” checklist during setup.
- Data entry: smart defaults (e.g. GST ledger auto-selection by place of supply), voucher templates, bulk import/export (CSV/Excel) with mapping preview, inline validation with clear error messages in Indian context.
- Non-accountant friendly: plain-language tooltips (explain "CGST Output", "TDS Payable u/s 194J"), hide technical fields by role, use business terms (e.g. "Client Receivables" instead of only code), and show impact preview before posting.
- Efficiency: favourites, recent ledgers, copy-from-template, multi-select actions, keyboard shortcuts, and undo guidance (soft posting).
- Compliance UX: Schedule III view toggle (Balance Sheet/P&L in Schedule III format), highlight accounts missing GST/TDS mapping, warnings for unmapped SAC/state, audit trail visibility (who/when/what), and period lock indicators.
- Accessibility & responsiveness: mobile-friendly for approvals/expense review, WCAG considerations.

### Deliverables expected
Return the answer with:
1. A final recommended CoA table (Excel-ready) with all columns listed above.
2. A complete ledger master specification.
3. A voucher matrix (all voucher types, effects, validations).
4. A normalized data model (tables, key fields, relationships).
5. A detailed UX wireframe description (key screens: CoA List, CoA Create/Edit, Ledger Master, Voucher Entry, Schedule III Report) with layout suggestions and microcopy.
6. An implementation roadmap (MVP vs Phase 2), effort estimate, risks, and test cases.
7. Indian compliance mapping table (GST/TDS/Schedule III) linking accounts to returns.

Be specific, practical, and use Indian terminology where appropriate. Prioritise audit-readiness, ease of use for a software design company, and clean segregation of duties.