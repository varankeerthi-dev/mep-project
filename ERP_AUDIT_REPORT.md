# MEP ERP — Complete 14-Phase Audit Report

**Date:** August 12, 2026
**Overall Score:** 6.15 / 10
**Codebase:** `apps/web` (React 19 + Vite + Supabase)
**Purpose:** Construction/facility management ERP for MEP contractors

---

## Executive Summary

The MEP ERP is a purpose-built system for construction/facility management companies doing supply + erection contracts. It has **strong bones** — the estimation, project management, and manufacturing modules are genuinely competitive with commercial solutions. The **accounting and security gaps are the #1 blockers** for production deployment.

### Score at a Glance

| Category | Score |
|----------|-------|
| Sales & CRM | 8/10 |
| Estimation & Quotation | 7/10 |
| Project Management | 8/10 |
| Procurement | 6/10 |
| Inventory & Warehouse | 6/10 |
| Manufacturing | 6/10 |
| HR & Payroll | 4/10 |
| Accounting & Finance | 2/10 |
| Multi-Tenancy & Security | 3/10 |
| Codebase Health | 4/10 |
| **OVERALL** | **6.15/10** |

---

## PHASE 1: System Architecture

### Technology Stack
- **Frontend:** React 19, Vite, TanStack Router, Tailwind CSS
- **Backend:** Supabase (PostgreSQL, Auth, RLS, Storage, Realtime)
- **State:** TanStack Query v5, React Context
- **Build:** pnpm workspaces + Turborepo
- **Deploy:** Vercel (serverless)
- **API Routes:** 4 serverless functions (AI/parsing features)

### Key Architecture Decisions
- **No dedicated backend server** — Supabase is the entire backend
- **120+ database tables** defined across 166 migration files (22 with content, 144 empty placeholders)
- **Module-based architecture** — features organized by domain (materials, manufacturing, estimation, etc.)
- **Dual settings system** — Legacy `Settings.tsx` and newer `SettingsV2Page.tsx` coexist

### File Statistics
- 100+ page components
- 166 database migration files
- ~50+ hooks files
- 174 console.log statements in production code

---

## PHASE 2: Complete Module Inventory

### Registered Modules (30 total)

| Category | Modules |
|----------|---------|
| **Core** | Dashboard, Clients, Quotations, Invoices, Proforma Invoices, Credit Notes, Delivery Challans, Client POs |
| **Sales** | Leads, Follow-Up Centre |
| **Procurement** | Purchase Module, Sub-Contractors |
| **Inventory** | Materials & Inventory, Material Intents, Stock Transfer, Warehouse Management |
| **Projects** | Projects, Site Visits, Site Reports, Daily Updates, Site Expenses, Partner Allocation |
| **HR** | Manpower Attendance |
| **Reports** | Reports & Analytics, Ledger |
| **Other** | Approvals, Meetings, Tools Management, BOQ, Estimation |

### Unregistered but Functional Pages
- HR: EmployeeTab, AttendanceEntry, AttendancePlanning, ManpowerAttendance, SalarySlipDashboard
- Accounting: DayBook, ChartOfAccounts, FinancialReports
- Operations: OperationsDashboard
- Client Communication, Client360, Party360

---

## PHASE 3: Multi-Tenancy Audit

### CRITICAL SECURITY ISSUE

**Most tables use `USING (true) WITH CHECK (true)` RLS policies** — any authenticated user can read/modify any row.

### Tables with Proper Org-Scoped RLS
- Manufacturing: bom_variants, bom_items, grn_checklists, grn_items, grn_records, material_intents
- Estimation: est_boq_headers, est_boq_items, est_boq_sections, est_rate_analysis, est_tenders
- HR: attendance, attendance_planning, employees, leave_requests, overtime_requests
- Projects: project_phases, project_tasks, milestones, material_consumption
- Audit: audit_log
- Follow-Up Centre: follow_up_records, follow_up_escalations

### Tables with `organisation_id` Column BUT Permissive RLS
- All dispatch tables, QC tables, GRN tables, proforma tables
- All purchase tables (orders, bills, payments, debit notes)
- All subcontractor tables
- HR salary tables (loans, fines, OT, payroll)

### Multi-Tenant Readiness: 3/10

---

## PHASE 4: Accounting Audit

### INCOMPLETE SKELETON — 2/10

**What Exists:**
- Chart of Accounts (tree view, create groups/ledgers)
- Day Book (journal entry creation via RPC)
- Client Ledger / AR dashboard (outstanding, payments, receipts)
- Financial reports page (budget vs actual by project)
- Profit report (purchase vs sales comparison)

**What's Completely Missing:**
- Trial Balance
- Balance Sheet
- P&L Statement (from COA)
- Cash Flow Statement
- General Ledger (account-wise from COA)
- Bank Reconciliation
- AR/AP Aging Reports
- Period Closing
- Journal Entry Reversal
- Fixed Assets Register
- GST Return Filing (GSTR-1, GSTR-3B)
- TDS Return Filing
- E-invoice/E-way Bill Integration
- Cost Center Reporting
- Multi-Currency Invoicing

**Critical Placeholder:**
```typescript
// useAccounting.ts line 31
balance: 0, // Calculate balances in a real system by joining journal_entry_lines
```
Account balances are **hardcoded to 0**.

---

## PHASE 5: Inventory Audit

### TWO SEPARATE SYSTEMS

#### 1. Materials Stock (4/10)
- Simple `current_stock` per (item, warehouse)
- No costing methods (no FIFO, average cost)
- No negative stock prevention at app level
- Basic stock summary with availability checks

#### 2. Warehouse Management (8/10)
- Bin-level tracking with zones, rows, racks, shelves, bins
- Physical vs virtual stock separation
- Stock transfers with approval workflow
- Dispatch orders with QC integration
- Capacity management and utilization tracking
- Cycle counting with variance reporting
- Material inward/outward logging

### Inventory Maturity: 4/10 (materials) / 8/10 (WMS)

---

## PHASE 6: Warehouse Audit

### Warehouse Management System — HIGH MATURITY

**Features:**
- Warehouse designer with visual bin layout
- Stock transfers between warehouses
- Dispatch orders with line items
- Material inward/outward tracking
- Cycle counting
- Capacity management
- Real-time stock levels
- QR code generation for bins

**Missing:**
- No integration with financial accounting
- No cost tracking per warehouse
- No automated reorder points
- No ABC analysis

---

## PHASE 7: Manufacturing Audit

### FUNCTIONAL BUT INCOMPLETE — 6/10

**Strong (7-8/10):**
- BOM (7/10) — Multi-level, alternatives, cost tracking
- QC (8/10) — Checklists, photos, non-conformance
- GRN (8/10) — Full receipt workflow with acceptance/rejection
- Material Requisitions (8/10) — Project-linked, approval workflow
- Dispatch Orders (8/10) — Full dispatch with QC
- Job Cards (8/10) — Assignment, tracking, completion

**Weak (1-5/10):**
- Routing/Operations (1/10) — Doesn't exist
- Capacity Planning (4/10) — Basic load monitoring
- Production Scheduling (4/10) — No Gantt or scheduling
- MRP (5/10) — Manual, no engine
- Scrap (3/10) — No tracking

---

## PHASE 8: Project/EPC Audit

### STRONG — 8/10

**Full Project Management:**
- Gantt charts with task dependencies
- Milestones with health tracking
- BOQ/Estimation integration
- Material consumption tracking
- Subcontractor management
- Snag/warranty tracking
- Drawing uploads with pin locations
- Daily updates and site reports
- Budget vs actual variance analysis

**Missing:**
- No resource leveling
- No critical path analysis
- No project templates

---

## PHASE 9: Performance Audit

### SIGNIFICANT ISSUES

**Large Files (64+ files > 1,000 lines):**
- Subcontractors.tsx: 5,255 lines
- ProjectList.tsx: 4,797 lines
- SiteVisits.tsx: 4,048 lines
- CreateQuotation/index.tsx: 3,394 lines
- CreateQuotationV2/index.tsx: 3,340 lines (near-identical duplicate)

**Query Issues:**
- 490+ `select('*')` overfetching occurrences
- Only 7 out of 100+ list pages use virtualization
- No server-side pagination on most list pages

**Dead Code:**
- 15 TermsConditions variant files (12 are dead code)
- 7 backup files committed to source
- 174 console.log statements in production code

---

## PHASE 10: Codebase Health

### Technical Debt Summary

| Issue | Count | Severity |
|-------|-------|----------|
| Files > 1,000 lines | 64 | HIGH |
| Files > 3,000 lines | 5 | CRITICAL |
| `select('*')` overfetching | 490+ | HIGH |
| console.log in production | 174 | MEDIUM |
| Dead TermsConditions files | 12 | LOW |
| Backup files committed | 7 | LOW |
| Empty migration files | 144 | LOW |
| Near-duplicate quotation files | 2 | HIGH |

### Code Quality Metrics
- **TypeScript Coverage:** ~85% (some `any` types remain)
- **Test Coverage:** Minimal (only 1 test file found: `useActiveWarehouse.test.ts`)
- **Lint Errors:** 2,164 (403 errors, 1,761 warnings)
- **Dead Code:** Significant (15+ TermsConditions variants, backup files)

---

## PHASE 11: TOP 50 MISSING FEATURES

### Accounting & Finance (15 features)

| # | Feature | Impact | Status |
|---|---------|--------|--------|
| 1 | Trial Balance | Cannot verify ledger accuracy | Missing entirely |
| 2 | Balance Sheet | No financial position snapshot | Missing entirely |
| 3 | P&L from COA | ProfitReport is trading report, not true P&L | Missing entirely |
| 4 | Cash Flow Statement | No cash flow visibility | Missing entirely |
| 5 | Bank Reconciliation | No bank statement matching | Missing entirely |
| 6 | Account Balance Computation | Balance hardcoded to 0 | Placeholder |
| 7 | AR Aging Report | No overdue aging buckets | Missing entirely |
| 8 | AP Aging Report | No vendor payment aging | Missing entirely |
| 9 | Period Closing | No month/year end procedures | Missing entirely |
| 10 | Journal Reversal/Void | Cannot correct accounting errors | Missing entirely |
| 11 | GST Return Filing | No GSTR-1/GSTR-3B integration | Missing entirely |
| 12 | TDS Return Filing | No Form 26Q filing | Missing entirely |
| 13 | E-invoice/E-way Bill | No IRN generation | Missing entirely |
| 14 | Fixed Assets Register | No asset tracking or depreciation | Missing entirely |
| 15 | Cost Center Reporting | Cost centers exist but no allocation/reporting | Missing entirely |

### HR & People (10 features)

| # | Feature | Impact | Status |
|---|---------|--------|--------|
| 16 | Employee Self-Service Portal | All HR is admin-facing only | Missing entirely |
| 17 | Training & Development | No training module | Missing entirely |
| 18 | Performance Appraisal | No review system | Missing entirely |
| 19 | Recruitment/ATS | No hiring pipeline | Missing entirely |
| 20 | Employee Onboarding | No joining checklist workflow | Missing entirely |
| 21 | Employee Offboarding | No exit clearance process | Missing entirely |
| 22 | HR Document Templates | No offer/appointment letter generation | Missing entirely |
| 23 | Leave Policy Engine | Leave auto-approves, no policy config | Missing entirely |
| 24 | Payroll History | Past Runs tab is placeholder | Placeholder |
| 25 | Asset Allocation | No IT asset tracking for employees | Missing entirely |

### Procurement (8 features)

| # | Feature | Impact | Status |
|---|---------|--------|--------|
| 26 | PO Approval Workflow UI | Status field exists but no multi-step UI | Missing UI |
| 27 | Vendor Evaluation/Rating | No quality or delivery scoring | Missing entirely |
| 28 | Contract Management | No vendor contracts | Missing entirely |
| 29 | Formal RFQ Documents | Only "Availability Inquiry" exists | Partial |
| 30 | Vendor Performance Tracking | No on-time %, quality rating | Missing entirely |
| 31 | GRN in Purchase Module | GRN only in manufacturing module | Disconnected |
| 32 | Multi-Vendor Comparison UI | Data exists but no comparison grid | Missing UI |
| 33 | Payment Batch Processing | No bulk NEFT/RTGS file generation | Missing entirely |

### Inventory & Warehouse (6 features)

| # | Feature | Impact | Status |
|---|---------|--------|--------|
| 34 | Negative Stock Prevention | App-level stock can go negative | Missing entirely |
| 35 | Costing Methods (FIFO/Avg) | Simple current_stock, no costing | Missing entirely |
| 36 | Stock Valuation Report | No inventory valuation | Missing entirely |
| 37 | Physical Stock Count | No stocktaking workflow | Missing entirely |
| 38 | Material Cost Tracking | No landed cost calculation | Missing entirely |
| 39 | Batch/Serial Tracking | No lot or serial number tracking | Missing entirely |

### Manufacturing (6 features)

| # | Feature | Impact | Status |
|---|---------|--------|--------|
| 40 | Routing/Operations | No production routing | Missing entirely |
| 41 | Capacity Planning | No resource capacity management | Missing entirely |
| 42 | Production Scheduling | No Gantt or scheduling | Missing entirely |
| 43 | MRP | Basic manual, no MRP engine | Missing entirely |
| 44 | Scrap Management | No scrap tracking/reporting | Missing entirely |
| 45 | Work-in-Progress Tracking | No WIP valuation | Missing entirely |

### Cross-Module (5 features)

| # | Feature | Impact | Status |
|---|---------|--------|--------|
| 46 | Mobile Responsive Design | Most pages desktop-only | Missing entirely |
| 47 | Offline Mode | No PWA or offline capability | Missing entirely |
| 48 | Audit Trail Viewer | Audit logs captured but no UI to view | Missing UI |
| 49 | Bulk Import Wizard | Limited import, no guided wizard | Partial |
| 50 | Multi-Currency Invoicing | Only purchase module has currency | Missing entirely |

---

## PHASE 12: BUSINESS READINESS ASSESSMENT

### Company Type: MEP Contractor

The ERP is purpose-built for construction/facility management companies doing:
- Supply + Erection contracts (BOQ-based)
- Subcontractor management (labor + material)
- Project-based costing with site expenses
- Procurement with GST/TDS compliance

### Business Readiness by Function

| Function | Ready? | Blockers |
|----------|--------|----------|
| Client Management | YES | Lead conversion works, CRM is strong |
| Quotation/Estimation | YES | V2 with 3-column layout, BOQ, rate analysis |
| Project Management | YES | Gantt, tasks, milestones, material consumption |
| Site Operations | YES | Check-ins, daily updates, attendance, site reports |
| Procurement | PARTIAL | PR/PO workflows work, approval UI missing |
| Inventory | YES | Materials stock, warehouse, stock transfer |
| Manufacturing | PARTIAL | BOM, GRN, QC work; no routing, capacity, MRP |
| Invoicing | YES | Full create/edit, credit notes, proforma |
| Client Payments | YES | Ledger, receipts, credit notes |
| Vendor Payments | PARTIAL | Payment queue exists, no batch processing |
| HR/Payroll | PARTIAL | Attendance strong, salary engine works, history missing |
| Accounting | NO | Only CoA + Day Book. No TB, BS, P&L |
| GST Compliance | NO | No GSTR-1, GSTR-3B, e-invoice |
| TDS Compliance | PARTIAL | Calculation exists, no filing |
| Multi-tenancy | NO | RLS policies are permissive |
| Mobile Access | NO | No responsive design |
| Reporting | PARTIAL | Financial reports exist but incomplete |

### Go-Live Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| RLS Security | CRITICAL | Most tables readable by any authenticated user |
| No Accounting Backbone | HIGH | Trial Balance/Balance Sheet/P&L required for CA compliance |
| GST Filing | HIGH | Cannot file returns without GSTR integration |
| No Negative Stock Check | MEDIUM | Stock can go negative causing data corruption |
| Vendor Balance Race Condition | MEDIUM | Client-side balance calculation is race-prone |
| Console.log in Production | LOW | 174 debug statements in production code |

---

## PHASE 13: WHAT TO BUILD NEXT (TOP 25 ROI FEATURES)

### Tier 1: CRITICAL (Must-have for go-live, Weeks 1-4)

| Priority | Feature | Why | Effort | Impact |
|----------|---------|-----|--------|--------|
| P0 | Fix RLS Policies | Current policies `USING (true)` expose all data to all users | 2 weeks | CRITICAL |
| P0 | Account Balance Computation | Balances hardcoded to 0 in useAccounting.ts | 1 week | HIGH |
| P0 | Trial Balance | Foundation for all financial reporting | 2 weeks | HIGH |
| P0 | Balance Sheet | Required for statutory compliance | 2 weeks | HIGH |
| P0 | P&L Statement from COA | Current ProfitReport is trading report, not proper P&L | 2 weeks | HIGH |
| P1 | Negative Stock Prevention | Stock can go negative causing data corruption | 3 days | HIGH |
| P1 | GST Return Filing Data | GSTR-1/GSTR-3B data extraction from invoices | 2 weeks | HIGH |
| P1 | AR Aging Report | Current/30/60/90/120+ day buckets for client receivables | 1 week | HIGH |

### Tier 2: HIGH VALUE (Significant ROI, Weeks 5-10)

| Priority | Feature | Why | Effort | Impact |
|----------|---------|-----|--------|--------|
| P1 | PO Approval Workflow UI | Status field exists but no multi-step approval UI | 2 weeks | HIGH |
| P1 | Vendor Evaluation/Rating | No quality or delivery scoring | 2 weeks | HIGH |
| P1 | AP Aging Report | Vendor payment aging visibility | 1 week | HIGH |
| P1 | Payroll History/Past Runs | Salary slip history tab is placeholder | 1 week | HIGH |
| P2 | Bank Reconciliation | Match bank statements to journal entries | 2 weeks | MEDIUM |
| P2 | Cost Center Reporting | Cost centers exist but no allocation/reporting | 2 weeks | MEDIUM |
| P2 | Multi-Vendor Comparison UI | Data exists but no comparison grid | 1 week | MEDIUM |
| P2 | GRN in Purchase Module | GRN only accessible from manufacturing module | 1 week | MEDIUM |

### Tier 3: MEDIUM VALUE (Competitive advantage, Weeks 11-16)

| Priority | Feature | Why | Effort | Impact |
|----------|---------|-----|--------|--------|
| P2 | Employee Self-Service Portal | All HR is admin-facing | 3 weeks | MEDIUM |
| P2 | Contract Management | No vendor contracts | 3 weeks | MEDIUM |
| P2 | Vendor Performance Tracking | On-time %, quality rating | 2 weeks | MEDIUM |
| P2 | Employee Onboarding/Offboarding | No joining checklist or exit clearance | 2 weeks | MEDIUM |
| P2 | Mobile Responsive Design | Most pages desktop-only | 4 weeks | HIGH |
| P2 | Estimation vs Actual Tracking | No comparison between estimated and actual costs | 2 weeks | MEDIUM |
| P3 | Multi-Currency Invoicing | Only purchase module has currency | 2 weeks | LOW |
| P3 | Audit Trail Viewer | Audit logs captured but no UI | 1 week | LOW |
| P3 | Period Closing | No month/year end procedures | 2 weeks | MEDIUM |
| P3 | Training & Development | No training module at all | 4 weeks | LOW |

---

## PHASE 14: FINAL SCORECARD

### Overall ERP Maturity Score: 6.15 / 10

| Category | Score | Weight | Weighted | Notes |
|----------|-------|--------|----------|-------|
| Sales & CRM | 8/10 | 15% | 1.20 | Leads pipeline, Kanban, conversion, follow-ups |
| Estimation & Quotation | 7/10 | 15% | 1.05 | BOQ, rate analysis (backend), V2 3-column UI |
| Project Management | 8/10 | 10% | 0.80 | Gantt, tasks, milestones, BOQ, material consumption |
| Procurement | 6/10 | 10% | 0.60 | PR/PO workflows, vendor management; missing approval UI |
| Inventory & Warehouse | 6/10 | 10% | 0.60 | Materials stock strong, WMS sophisticated |
| Manufacturing | 6/10 | 10% | 0.60 | BOM, GRN, QC strong; no routing, capacity, MRP |
| HR & Payroll | 4/10 | 10% | 0.40 | Attendance strong; no self-service, no history |
| Accounting & Finance | 2/10 | 10% | 0.20 | Only CoA + Day Book. No TB, BS, P&L |
| Multi-Tenancy & Security | 3/10 | 10% | 0.30 | Most RLS policies permissive |
| Codebase Health | 4/10 | 10% | 0.40 | 64+ files >1K lines, 174 console.logs |
| **TOTAL** | | **100%** | **6.15** | |

### Benchmark Against Commercial ERPs

| Feature | MEP ERP | Tally | Zoho ERP | SAP Business One |
|---------|---------|-------|----------|------------------|
| Chart of Accounts | YES | YES | YES | YES |
| Trial Balance | NO | YES | YES | YES |
| Balance Sheet | NO | YES | YES | YES |
| P&L | NO | YES | YES | YES |
| Bank Reconciliation | NO | YES | YES | YES |
| GST Filing | NO | YES | YES | YES |
| Inventory | YES | YES | YES | YES |
| Multi-warehouse | YES | NO | YES | YES |
| Manufacturing BOM | YES | NO | YES | YES |
| QC/GRN | YES | NO | NO | YES |
| Projects | YES | NO | YES | YES |
| HR/Payroll | PARTIAL | YES | YES | YES |
| Mobile App | NO | YES | YES | YES |
| **Score** | **55%** | **75%** | **90%** | **100%** |

### Key Strengths (What You Have That Others Don't)

1. **Best-in-class BOQ editor** — Undo, copy/paste, column customization, price maps
2. **Sophisticated WMS** — Bin-level tracking, cycle counting, dispatch orders
3. **Full manufacturing pipeline** — BOM → GRN → QC → Job Cards → Material Requisitions
4. **Deep estimation module** — BOQ, rate analysis (backend complete), tender management
5. **Construction-specific** — Site check-ins, daily updates, material consumption tracking

### Key Weaknesses (What You're Missing)

1. **No accounting backbone** — Cannot replace Tally without TB/BS/P&L
2. **Security is permissive** — Multi-tenancy is not enforced at DB level
3. **HR is admin-only** — No employee self-service
4. **No GST compliance** — Cannot file returns
5. **Desktop-only** — No mobile access for field staff

### Recommended 6-Month Roadmap

| Month | Focus | Deliverables |
|-------|-------|-------------|
| Month 1 | Security + Foundation | Fix RLS policies, compute account balances, Trial Balance |
| Month 2 | Financial Reporting | Balance Sheet, P&L, AR/AP Aging, Period Closing |
| Month 3 | GST Compliance | GSTR-1, GSTR-3B data, e-invoice readiness, TDS filing |
| Month 4 | Procurement Maturity | PO approval workflow, vendor evaluation, GRN in purchase |
| Month 5 | HR Self-Service | Employee portal, payslip history, leave policy engine |
| Month 6 | Mobile + Polish | Responsive design, offline mode, audit trail viewer |

### Final Verdict

This ERP has **strong bones** for a construction/MEP contractor. The estimation, project management, and manufacturing modules are genuinely competitive with commercial solutions. The **accounting and security gaps are the #1 blockers** for production deployment. Fix those in Month 1-2, and the ERP becomes a viable Tally replacement for mid-sized MEP contractors.

---

## APPENDIX: Key Files Referenced

### Architecture
- `apps/web/src/App.tsx` — Root component with providers
- `apps/web/src/config/module-registry.ts` — 30 module definitions
- `apps/web/src/rbac/permission-catalog.ts` — RBAC permissions

### Accounting
- `apps/web/src/pages/accounting/useAccounting.ts` — CoA hooks (balance hardcoded to 0)
- `apps/web/src/pages/accounting/DayBook.tsx` — Journal entry UI
- `apps/web/src/pages/accounting/ChartOfAccounts.tsx` — CoA tree view

### Security
- `apps/web/supabase/migrations/` — 166 migration files
- `apps/web/src/contexts/AuthContext.tsx` — Auth context

### Manufacturing
- `apps/web/src/features/manufacturing/` — Full manufacturing module
- `apps/web/src/pages/manufacturing/stores/GRNCreate.tsx` — GRN workflow

### Warehouse
- `apps/web/src/warehouse/` — Full WMS (types, services, viewer, designer)

### HR
- `apps/web/src/pages/hr/` — Employee directory, attendance, salary slips
- `apps/web/src/utils/payrollCalculations.ts` — Payroll engine

### Procurement
- `apps/web/src/modules/Purchase/` — Full purchase module
- `apps/web/src/purchase-inquiries/` — Availability inquiry/sourcing board

### Estimation
- `apps/web/src/features/estimation/` — BOQ, tenders, rate analysis

### Performance Issues
- `apps/web/src/pages/Subcontractors.tsx` — 5,255 lines (largest file)
- `apps/web/src/pages/CreateQuotation/index.tsx` — 3,394 lines
- `apps/web/src/pages/CreateQuotationV2/index.tsx` — 3,340 lines (duplicate)

---

*Report generated on August 12, 2026*
*Auditor: opencode (mimo-v2-free)*
