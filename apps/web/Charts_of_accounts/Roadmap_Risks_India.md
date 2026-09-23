# Implementation Roadmap, Risks & Test Cases

## MVP (Phase 1) - Must Have
| Task | Owner | Effort | Dependencies | Acceptance Criteria |
|---|---|---|---|---|
| CoA template finalisation & review with CA | Finance | Low (1–2 days) | Discovery | Approved CoA with Schedule III mapping |
| Data model & migrations | Tech | Medium (3–5 days) | CoA finalised | Tables created, constraints applied |
| Masters (CoA, Ledgers, Banks, Customers, Vendors) | Tech + Finance | Medium (3–5 days) | Data model | CRUD + validations working |
| Core vouchers (Sales, Purchase, Receipt, Payment, Contra, JV) | Tech | High (5–8 days) | Masters | Posting with double-entry, balances correct |
| GST (intra/inter/export, basic ITC) | Tech + Finance | High (3–5 days) | Vouchers | POS logic correct, GSTR-1/3B mapping |
| TDS (194J) | Tech + Finance | Medium (2–3 days) | Vouchers | TDS calculation & ledgers correct |
| Opening balance import | Tech | Low (1–2 days) | Masters | TB imports & validates (Dr=Cr) |
| Basic reports (TB, BS/P&L, Schedule III view, Debtors/Creditors ageing) | Tech + Finance | Medium (3–5 days) | Vouchers | Reports match expected format |
| Audit trail & RBAC | Tech | Medium (2–4 days) | Core flows | Logs captured, roles enforced |

## Phase 2 - Nice to Have
| Task | Effort | Priority |
|---|---|---|
| Project P&L with cost allocation (timesheets, expenses, subcontractors) | High (5–8 days) | High |
| Bank reconciliation (CSV import + auto-match) | Medium (3–4 days) | High |
| Payroll JV automation | Medium (2–4 days) | Medium |
| FX revaluation & realised gain/loss | Medium (2–3 days) | Medium |
| MSME ageing alerts & reporting | Low (1–2 days) | Medium |
| Advanced dashboards | Medium (2–4 days) | Low |

## Key Risks & Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| GST/TDS rule changes (Finance Act) | High | Make tax rates/sections configurable via masters, not hardcoded |
| Complex project costing | High | Start simple (project tag on lines), iterate with delivery team |
| Cutover data quality | High | Parallel run, reconcile TB, sub-ledgers & open items before go-live |
| Non-accountant adoption | Medium | Invest in onboarding wizard, tooltips, business labels & preview |
| Audit scrutiny | High | Enforce audit trail, period locks, approval flows, reason for unpost |

## Key Test Cases
| Test Case | Expected Result |
|---|---|
| Intra-state Sales Invoice (same state) | Debtors Dr, Revenue Cr, CGST Output Cr, SGST Output Cr |
| Inter-state Sales Invoice (different states) | Debtors Dr, Revenue Cr, IGST Output Cr |
| Export of services (LUT) | Debtors Dr, Export Revenue Cr, 0% GST (zero-rated) |
| Purchase Bill with 194J TDS | Expense Dr, Creditors Cr, GST Input Cr, TDS Payable Cr |
| Receipt in FCY | Bank Dr (INR equivalent), Debtors Cr, FX Gain/Loss posted as applicable |
| Project tagging (T&M) | Costs & revenue traceable to Project P&L |
| Unbalanced voucher posting | Blocked with validation error |
| Period lock | Posting to closed period rejected, requires unlock with approval |
| Sub-ledger vs control account | Totals must match (Debtors total = Control account balance) |