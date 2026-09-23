# Chart of Accounts - Implementation & UX Checklist (Indian Software Design Company)

Use this checklist to track progress. Mark as: [ ] To Do, [WIP], [Done], or [NA].

## A. Discovery & Business Analysis
- [ ] Stakeholder interviews (Finance/CA, Founders, Project/Delivery, HR/Payroll, Procurement, IT)
- [ ] Document revenue model (T&M, Fixed-price, Retainers, Milestones, International)
- [ ] Map current processes (Billing, Purchase, Expenses, Reimbursements, Subcontractors, Payroll, Bank, GST/TDS)
- [ ] Identify compliance scope (Company type, GST states, TDS sections, LUT, SEZ)
- [ ] Define reporting needs (Schedule III, Project P&L, Debtors/Creditors ageing, GST, TDS, Cash Flow)
- [ ] Finalise cutover (Opening balances date, TB, outstanding invoices/bills, fixed assets)

## B. Chart of Accounts Design
- [ ] Adopt numbering scheme (Assets, Liabilities, Equity, Income, Expenses)
- [ ] Create core hierarchy with depth limits
- [ ] Mark system vs user accounts
- [ ] Map every account to Schedule III line items
- [ ] Add GST/TDS flags and SAC mapping where applicable
- [ ] Include software/design specific accounts

## C. Ledgers & Sub-ledgers
- [ ] Define control accounts (Debtors, Creditors, Banks, Fixed Assets, Projects)
- [ ] Create customer/vendor/employee/bank/project/fixed asset masters
- [ ] Add PAN, GSTIN, State, MSME, TDS section fields
- [ ] Enable auto-ledger creation on master creation
- [ ] Add validations (PAN/GSTIN formats, duplicates)
- [ ] Configure soft-delete with blocking rules

## D. Bookkeeping & Vouchers
- [ ] Configure all voucher types (Sales, Credit/Debit Note, Purchase, Receipt, Payment, Contra, JV, Expense, Petty Cash, Payroll JV, GST/TDS Adjustments, Opening)
- [ ] Define revenue recognition rules (T&M vs Fixed Price, Retainers)
- [ ] Implement GST logic (POS, IGST vs CGST+SGST, Export/LUT, RCM)
- [ ] Implement TDS logic (194J, thresholds, TDS Receivable/Payable)
- [ ] Enable project tagging on vouchers
- [ ] Configure period close & locks

## E. Implementation & Technical
- [ ] Finalise data model
- [ ] Implement validations & hierarchy rules
- [ ] Build import/export (CoA, Ledgers, Opening Balances)
- [ ] Implement audit trail
- [ ] Configure RBAC & permissions
- [ ] Integrations (Billing, Expenses, Payroll, Bank import, GST/TDS mapping)
- [ ] Unit & integration testing

## F. UX Improvements
- [ ] CoA tree with search & filters
- [ ] Onboarding wizard with recommended template
- [ ] Smart defaults in voucher entry
- [ ] Business-friendly labels & tooltips
- [ ] Import wizard with preview & error log
- [ ] Schedule III report view
- [ ] Project P&L, Debtors/Creditors ageing, GST/TDS summaries
- [ ] Mobile-responsive approvals
- [ ] Accessibility considerations

## G. Go-Live Readiness
- [ ] CoA reviewed & approved by CA
- [ ] Opening balances imported & reconciled
- [ ] UAT completed
- [ ] TB/sub-ledger/GST/TDS reconciliations done
- [ ] User documentation & training complete
- [ ] Parallel run successful
- [ ] Period locked at cutover