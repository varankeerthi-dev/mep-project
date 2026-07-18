# ERP Capability Assessment — BillFast MEP vs. Industry Standard EPC ERP

**To:** CEO
**From:** Engineering
**Date:** July 17, 2026
**Subject:** Feature gap analysis — BillFast MEP against industry EPC ERP benchmarks

---

## 1. Why We Did This

We are building BillFast as an ERP for engineering & EPC project management. Before
prioritising the next development phase, we needed to know: **where do we stand
compared to an industry-standard EPC ERP?**

We mapped every module in the codebase against 12 capability areas that define a
production-grade EPC ERP — project management, tendering, cost control, resource
management, financial reporting, and others. For each area we scored coverage
(0–10) and identified specific gaps.

---

## 2. What We Compared

We laid out the current application side-by-side against these 12 feature pillars,
using SAP Business One / Oracle JDE / MS Dynamics as the industry reference:

| # | Capability | What it means |
|---|-----------|---------------|
| 1 | **Project Management (WBS)** | Hierarchical work breakdown, activity-level scheduling, cost/progress rollup |
| 2 | **Tendering & Estimation** | BOQ with rate analysis, Excel upload, pre-tender profitability |
| 3 | **Cost Control** | Real-time cost tracking, milestone invoicing, budget vs actual |
| 4 | **Performance Monitoring** | Dashboards, project health, schedule vs actual progress |
| 5 | **Integration & Automation** | MS Project sync, auto-PRs, attendance recording |
| 6 | **Reporting & Analytics** | Tender history, project reports, global-standard compliance |
| 7 | **Collaboration** | Tasks, contract verification, bill booking, meetings, issues |
| 8 | **Resource Management** | Equipment maintenance, downtime tracking, alerts |
| 9 | **Financial Management** | Project profitability, milestone invoicing, inter-dependency tracking |
| 10 | **Workforce Management** | Timesheets, contract management, manpower allocation |
| 11 | **Project Visibility** | Gantt charts, activity progress, cost profiles (3Ms), EVM |
| 12 | **Financial Reporting** | Project GL, trial balance, P&L, budget vs actual, daily expenditure |

---

## 3. The Results — Overall Score: 5.3 / 10

```
Score by area:

Collaboration           ██████████░░  9/10  ← strongest
Performance Monitoring  ████████░░░░  8/10
Workforce Management    ███████░░░░░  7/10
Reporting & Analytics   ██████░░░░░░  6/10
Project Visibility      █████░░░░░░░  5/10
Resource Management     █████░░░░░░░  5/10
Project Management      █████░░░░░░░  5/10
Financial Management    ████░░░░░░░░  4/10
Tendering & Estimation  ████░░░░░░░░  4/10
Cost Control            ████░░░░░░░░  4/10
Integration & Auto      ████░░░░░░░░  4/10
Financial Reporting     ███░░░░░░░░░  3/10  ← weakest
                        ─── ─── ─── ───
                         5.3 / 10 overall
```

### What this tells us

**The operational layer is solid.** Transactions — purchase, sales, inventory, HR,
attendance, subcontractors, invoicing — all work. The app can run a construction
company day-to-day.

**The analytical/financial layer is where we fall short.** We track costs but
don't aggregate them into project profitability. We have a day book but no trial
balance, no project P&L, no budget variance. These are the features that turn a
"project management tool" into an "ERP."

---

## 4. Gap Detail — What's Missing

### Critical gaps (blocking EPC ERP readiness)

| Gap | Impact | Current State |
|-----|--------|---------------|
| **Project Profitability** | Cannot answer "Is this project making money?" | Individual costs exist (bills, expenses, payroll), but no revenue-vs-cost aggregation per project |
| **Work Breakdown Structure** | No hierarchical cost/progress rollup | Tasks are flat under projects; no WBS levels, no earned value |
| **Rate Analysis** | Cannot estimate tender pricing scientifically | BOQ exists but rates are entered manually — no resource-based costing (labour × hours + material × qty + equipment × hours) |
| **Project P&L / Financial Reporting** | No project-wise financial statements | Day book and chart of accounts exist, but no trial balance, no P&L by project, no budget vs actual |
| **Earned Value Management** | Cannot measure true project performance | No planned value, earned value, or actual cost tracking against schedule |

### Important gaps (should address within 2 phases)

| Gap | Impact |
|-----|--------|
| **MS Project Integration** | Clients/consultants send schedules in MS Project XML; we cannot import them |
| **Auto Purchase Requisitions** | PRs still created manually even though project material needs are known |
| **Equipment Maintenance Scheduling** | Tools are tracked but no preventive maintenance calendar or downtime analytics |
| **Tender/Bid History** | No repository of past tenders for reference pricing |
| **Cost Profiles (3Ms)** | No breakdown of project cost by manpower vs machinery vs materials |

### Minor gaps (nice-to-have)

- AI-driven cost intelligence (ML predictions, anomaly detection)
- Pre-tender what-if profitability analysis
- Global standard report compliance (IFRS, GAAP)

---

## 5. What Must Be Solved — Priority Order for Next PO

These are the gaps I recommend we close, in priority order. Each is sized roughly.

### P0 — Project Profitability Dashboard (2–3 weeks)
Build a project-level Profit & Loss view that pulls revenue (invoices, sales orders)
and cost (purchase bills, site expenses, subcontractor payments, attendance-based
labour cost) into a single screen. This is the single most visible gap — every EPC
ERP has it, and every project manager asks for it daily.

### P0 — Work Breakdown Structure (3–4 weeks)
Add a hierarchical WBS tree to projects. Each WBS node gets a budget and a
progress percentage. Tasks roll up into WBS nodes. This enables earned value
calculations and structured progress reporting.

### P1 — Rate Analysis Engine (2–3 weeks)
Add a rate analysis screen inside the BOQ module where each BOQ line item can be
broken down into resources (labour category × hours × rate + material × qty × rate
+ equipment × hours × rate). This is essential for tendering — without it, every
bid price is a guess.

### P1 — Project Financial Reports (3–4 weeks)
Build project-scoped trial balance, P&L, and budget vs actual reports. The day book
and chart of accounts already exist — this is wiring them together with a project
dimension filter.

### P2 — Auto PR from Project Materials (1–2 weeks)
When a project's material requirements are defined (BOQ or material take-off),
generate purchase requisitions automatically. This closes the loop between
engineering/estimation and procurement.

### P2 — MS Project Import (1 week)
Accept MSPDI (MS Project XML) files and convert them into project tasks with
dates, dependencies, and assignments.

---

## 6. Summary

**BillFast is a strong operational platform that handles the transaction layer of a
construction business well.** The gap to a full EPC ERP is in the analytical and
financial layers — we track everything but don't summarise it into answers
executives need: "Is this project profitable?" "How did we estimate vs actual?"
"What's our earned value?"

Closing the **P0 gaps** (Project Profitability + WBS) will eliminate the two most
embarrassing demo questions. Adding **P1** (Rate Analysis + Financial Reports)
gets us to a credible EPC ERP story.

I recommend we scope the next PO around the two P0 items and one P1, with the
remaining P1/P2 items in the following phase.

---

*Full technical gap detail available on request (per-module codebase audit with
line-level references).*
