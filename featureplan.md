# Feature Plan — MEP Project

> ⛔ DO NOT READ UNTIL INSTRUCTED BY THE USER.
> This file is for reference only. Do not act on or implement anything in this file unless explicitly asked.

---

## Source
Feature list derived from Sanjai Gandhi's Field Service Management ERP system.

---

## Legend

| Icon | Meaning |
|------|---------|
| ✅ | Fully implemented |
| 🔶 | Partially implemented |
| ❌ | Not implemented |

---

## 1. Introduction & Access

| Feature | Status | Notes |
|---------|--------|-------|
| System Access & Login | ✅ | Supabase auth |
| User Roles | ✅ | RBAC with permission catalog |
| Navigation — The Sidebar | ✅ | Full sidebar with all routes |

## 2. Service Dashboard

| Feature | Status | Notes |
|---------|--------|-------|
| KPI Cards | ✅ | Main dashboard has KPIs |
| SLA Countdown Widget | ❌ | Not implemented |
| ACMC/AMC Renewal Banner | ❌ | No renewal module |
| Overdue & Due-Soon Alerts | ❌ | No alert engine |
| Recent Complaints Table | 🔶 | Issue tracking exists but no dedicated complaints view |

## 3. Alerts & Reminders

| Feature | Status | Notes |
|---------|--------|-------|
| Alert Levels | ❌ | Not implemented |
| What Alerts Are Generated | ❌ | Not implemented |

## 4. Complaints Module

| Feature | Status | Notes |
|---------|--------|-------|
| Complaint List View | 🔶 | Issue list exists |
| Creating a New Complaint | 🔶 | Issue create exists |
| Complaint Information Panel | 🔶 | Issue detail exists |
| Timeline & History | 🔶 | Partial in issues |
| Next Visit Log | ❌ | Not implemented |
| SLA Pause (Pending Parts) | ❌ | Not implemented |
| Bulk Status Update | ❌ | Not implemented |
| Complaint Statuses Explained | ❌ | No defined complaint lifecycle |

## 5. Installations Module

| Feature | Status | Notes |
|---------|--------|-------|
| Installation List | 🔶 | Part of projects |
| Adding a New Installation | 🔶 | Part of projects |
| Installation Statuses | ❌ | No dedicated installation workflow |
| Installation Report | ❌ | Not implemented |

## 6. Projects & Tenders

| Feature | Status | Notes |
|---------|--------|-------|
| Projects List | ✅ | Full |
| Creating a New Project | ✅ | Full |
| Project Status & Progress | ✅ | Full with daily updates |
| Payment Tracking | ✅ | Via ledger and bills |
| GST & Transport Breakdown | ✅ | In invoices |
| Bill Sync | 🔶 | Zoho Books sync work done |

## 7. Client Directory

| Feature | Status | Notes |
|---------|--------|-------|
| Client List & Filters | ✅ | Full |
| Client Analytics Dashboard | ❌ | Not implemented |
| Adding a New Client | ✅ | Full |
| Client Detail View (Right Panel) | ✅ | 360 view |
| Convert Client to Project | ✅ | Exists |
| Client History | ✅ | Via ledger and activity |
| Client History PDF | 🔶 | Partial |

## 8. Leads & Quotations

| Feature | Status | Notes |
|---------|--------|-------|
| Two View Types | ❌ | Only quotation list view |
| Lead Statuses | ❌ | No lead tracking |
| Adding a Lead or Quote | ✅ | Quotation CRUD |
| Follow-up Log | ✅ | Follow-Up Centre module |
| Convert Lead to Project | ✅ | Quotation to project conversion |

## 9. CEO Dashboard

| Feature | Status | Notes |
|---------|--------|-------|
| FY Target & Achievement Card | ❌ | Not implemented |
| Analyst Metrics Strip | ❌ | Not implemented |
| FY History | ❌ | Not implemented |
| BNS vs BNP Breakdown | ❌ | Not implemented |
| Invoice & Delivery Alerts | ❌ | Not implemented |
| FY Target Management | ❌ | Not implemented |

## 10. Manager Dashboard

| Feature | Status | Notes |
|---------|--------|-------|
| Complaint Summary | ❌ | Not implemented |
| Sales Funnel | ❌ | Not implemented |
| Stalled Leads | ❌ | Not implemented |
| Technician Performance | ❌ | Not implemented |

## 11. KPI Command Center

| Feature | Status | Notes |
|---------|--------|-------|
| Money KPIs | ❌ | Not implemented |
| Petty Cash & Expenses | ❌ | Not implemented |
| Sales Pipeline | ❌ | Not implemented |
| Service KPIs | ❌ | Not implemented |
| Operations | ❌ | Not implemented |
| WhatsApp Snapshot | ❌ | Not implemented |

## 12. Daily Tasks

| Feature | Status | Notes |
|---------|--------|-------|
| Adding a Task | ✅ | Full (todo + project tasks) |
| Task Statuses | ✅ | Full |
| Morning Planner | ❌ | Not implemented |
| Task Reports | 🔶 | Partial |

## 13. Payments

| Feature | Status | Notes |
|---------|--------|-------|
| Bill List | ✅ | Full |
| Adding a Bill | ✅ | Full |
| Zoho Books Sync | 🔶 | Partial |
| Recording a Payment | ✅ | Full |

## 14. Daily Expenses & Petty Cash

| Feature | Status | Notes |
|---------|--------|-------|
| Daily Expenses | ❌ | Not implemented |
| Petty Cash | ❌ | Not implemented |
| Export Options | ❌ | Not implemented |

## 15. Staff Financials

| Feature | Status | Notes |
|---------|--------|-------|
| Overview | 🔶 | Subcontractor ledger exists |
| Staff-Level Drilldown | ❌ | Not implemented |
| Filter by Date Range | 🔶 | Partial |

## 16. Technicians Hub — Admin Command Center

### 16.1 Global Controls

| Feature | Status | Notes |
|---------|--------|-------|
| Command Bar | ❌ | Not implemented |

### 16.2 KPI Strip

| Feature | Status | Notes |
|---------|--------|-------|
| Real-Time Metrics | ❌ | Not implemented |

### 16.3 Tab Row 1 — People Tabs

| Feature | Status | Notes |
|---------|--------|-------|
| Overview Tab | ❌ | Not implemented |
| Technicians Tab | ❌ | Not implemented |
| Scorecard Tab | ❌ | Not implemented |
| Work Done Tab | ❌ | Not implemented |

### 16.4 Tab Row 2 — Operations Tabs

| Feature | Status | Notes |
|---------|--------|-------|
| Attendance Tab | ❌ | Only subcontractor attendance |
| Overtime Tab | ❌ | Not implemented |
| Approvals Tab | 🔶 | Approvals engine exists but not tech-specific |
| Requests Tab | ❌ | Not implemented |
| Expenses Tab | ❌ | Not implemented |
| Balances Tab | ❌ | Not implemented |
| Travel Tab | ❌ | Not implemented |
| Jobs Tab | ❌ | Not implemented |
| GPS Tab | ❌ | Not implemented |
| Flags Tab | ❌ | Not implemented |
| GPS Map Tab | ❌ | Not implemented |

## 17. Technician Portal — Mobile App

| Feature | Status | Notes |
|---------|--------|-------|
| Logging In | ❌ | Not implemented |
| Home Screen / Dashboard | ❌ | Not implemented |
| Job Detail Screen | ❌ | Not implemented |
| Expense Submission | ❌ | Not implemented |
| Advance Request | ❌ | Not implemented |
| Leave Request | ❌ | Not implemented |
| Sunday Work Request | ❌ | Not implemented |
| Material Request | ❌ | Not implemented |
| Installation Completion | ❌ | Not implemented |
| GPS Field Check-In | ❌ | Not implemented |
| My Work Summary | ❌ | Not implemented |
| My Profile | ❌ | Not implemented |
| Notifications | ❌ | Not implemented |
| AI Assistants | ❌ | Not implemented |
| Job Approvals (Admin) | ❌ | Not implemented |

## 18. Staff Attendance Management

| Feature | Status | Notes |
|---------|--------|-------|
| Attendance Statuses | ❌ | Not implemented |
| Recording Attendance | ❌ | Not implemented |
| Leave Requests | ❌ | Not implemented |
| Payroll Integration | ❌ | Not implemented |

## 19. ACMC Renewal Management

| Feature | Status | Notes |
|---------|--------|-------|
| Renewal List | ❌ | Not implemented |
| Recording a Renewal | ❌ | Not implemented |
| Renewal History | ❌ | Not implemented |

## 20. Inventory & Materials

| Feature | Status | Notes |
|---------|--------|-------|
| Materials List | ✅ | Full with variants |
| Adding/Editing a Material | ✅ | Full |
| Bill of Materials (BOM) | 🔶 | Partial |
| Setting BOM for a Model | 🔶 | Partial |
| Resin Details | ❌ | Not relevant? |
| Low Stock Alerts | ❌ | Not implemented |

## 21. Credit Scoring

| Feature | Status | Notes |
|---------|--------|-------|
| How Scoring Works | ❌ | Not implemented |
| Grade Bands | ❌ | Not implemented |
| Manual Override | ❌ | Not implemented |
| Rebuilding Scores | ❌ | Not implemented |

## 22. Audit Trail

| Feature | Status | Notes |
|---------|--------|-------|
| What Is Logged | 🔶 | Partial in some modules |
| Reading the Audit Trail | ❌ | No dedicated audit view |

## 23. Holiday Calendar

| Feature | Status | Notes |
|---------|--------|-------|
| Adding a Holiday | ❌ | Not implemented |
| Recurring Annual Holidays | ❌ | Not implemented |

## 24. Settings

| Feature | Status | Notes |
|---------|--------|-------|
| Branding Tab | ✅ | Full |
| Appearance Tab | ❌ | Not implemented |
| Company Info Tab | ✅ | Organisation settings |
| Email / SMTP Tab | ✅ | Resend integration |
| System Tab | 🔶 | Partial |

## 25. Dropdown Manager

| Feature | Status | Notes |
|---------|--------|-------|
| Available Dropdown Categories | ✅ | In settings |
| Adding a New Dropdown Option | ✅ | In settings |

## 26. User Management

| Feature | Status | Notes |
|---------|--------|-------|
| Creating a New User | ✅ | Via access control |
| User Roles | ✅ | RBAC roles |
| Deactivating a User | ✅ | Via access control |

## 27. Client Portal

| Feature | Status | Notes |
|---------|--------|-------|
| How Clients Access It | ❌ | Not implemented |
| CSAT Feedback | ❌ | Not implemented |

## 28. AI Briefings

| Feature | Status | Notes |
|---------|--------|-------|
| What Is in a Briefing | ❌ | Not implemented |
| Generating a Briefing | ❌ | Not implemented |
| Scheduled Auto-Briefings | ❌ | Not implemented |
| Briefing History | ❌ | Not implemented |

## 29. Backup & Restore

| Feature | Status | Notes |
|---------|--------|-------|
| Manual Backup | 🔶 | SQL scripts exist |
| Google Drive Auto-Backup | ❌ | Not implemented |
| Restore | ❌ | Not implemented |

## 30. Financial Hardening Console

| Feature | Status | Notes |
|---------|--------|-------|
| All Features | ❌ | Not implemented |

## 31. Revenue Analytics

| Feature | Status | Notes |
|---------|--------|-------|
| Revenue Breakdown | ❌ | Not implemented |
| Collections vs Billings | ❌ | Not implemented |

---

## Summary

| Category | Count |
|----------|-------|
| **Total Features Listed** | ~120+ |
| **✅ Fully Implemented** | ~35 |
| **🔶 Partially Implemented** | ~15 |
| **❌ Not Implemented** | ~70+ |

### Top 10 Gaps (Highest Impact)

1. **Technician Portal (Mobile App)** — GPS job actions, day start/end, expense/material/leave requests
2. **Technicians Hub (Admin)** — Attendance, GPS map, scorecard, approvals inbox, travel, flags
3. **KPI Command Center** — Money KPIs, petty cash, sales pipeline, service KPIs, WhatsApp snapshot
4. **Daily Expenses & Petty Cash** — Simple, high-frequency module
5. **ACMC/AMC Renewal Management** — Critical for service businesses
6. **Alerts & Reminders Engine** — Cross-cutting enhancement
7. **CEO Dashboard** — FY targets, BNS vs BNP, analyst metrics
8. **Manager Dashboard** — Sales funnel, technician performance, stalled leads
9. **Staff Attendance** — Employee attendance, leave, payroll integration
10. **Client Portal** — Client login, CSAT feedback
