# v1 vs v2 Subcontractor Module — Feature/Workflow Comparison

## Routes

| # | v1 Route | v1 Component | v2 Route | v2 Component | Status |
|---|----------|--------------|----------|--------------|--------|
| 1 | `/subcontractors` | `SubcontractorDashboard` | `/subcontractors-v2` | `DashboardView` | ✅ Covered |
| 2 | `/subcontractors/new` | `CreateSubcontractor` | `/subcontractors-v2/new` | `SubcontractorEdit` | ✅ Covered |
| 3 | `/subcontractors/view?id=` | `SubcontractorView` | `/subcontractors-v2/view?id=` | `SubcontractorView` | ✅ Covered |
| 4 | `/subcontractors/edit?id=` | `SubcontractorEdit` | `/subcontractors-v2/edit?id=` | `SubcontractorEdit` | ✅ Covered |
| 5 | `/subcontractors/attendance` | `ManpowerAttendance` | `/subcontractors-v2/attendance` | `AttendancePage` | ✅ Covered |
| 6 | `/subcontractors/workorders` | `SubcontractorWorkOrders` | `/subcontractors-v2/workorders` | `WorkOrdersPage` | ✅ Covered |
| 7 | `/subcontractors/workorders/create` | `SubcontractorWorkOrderCreate` | `/subcontractors-v2/workorders/create` | `SubcontractorWorkOrderCreate` | ✅ Covered |
| 8 | `/subcontractors/workorders/{id}` | `WorkOrderDetailView` | `/subcontractors-v2/workorders/{id}` | `WorkOrderDetailView` | ✅ Covered |
| 9 | `/subcontractors/workorders/{id}/create-measurement` | `MeasurementSheetWrapper` | `/subcontractors-v2/workorders/{id}/create-measurement` | `MeasurementSheetWrapper` | ✅ Covered |
| 10 | `/subcontractors/payments` | `SubcontractorPayments` | `/subcontractors-v2/payments` | `PaymentsPage` | ✅ Covered |
| 11 | `/subcontractors/invoices` | `SubcontractorInvoices` | `/subcontractors-v2/invoices` | `InvoicesPage` | ✅ Covered |
| 12 | `/subcontractors/documents` | `SubcontractorDocuments` | `/subcontractors-v2/documents` | `DocumentsTab` | ✅ Covered |
| 13 | N/A | N/A | N/A | `ManpowerAttendanceList` | ❌ Missing in v2 |

## Feature Matrix

### Dashboard
| Feature | v1 | v2 | Notes |
|---------|----|----|-------|
| Partner list table | ✅ | ✅ | |
| Status filter (All/Active/Inactive) | ✅ | ✅ | |
| Search | ✅ | ✅ | |
| Add partner action | ✅ | ✅ | |
| Attendance quick link | ✅ | ✅ | |
| Row click → view | ✅ | ✅ | |
| Refresh | ✅ | ✅ | |

### Partner Create/Edit
| Feature | v1 | v2 | Notes |
|---------|----|----|-------|
| Company name | ✅ | ✅ | |
| Contact person | ✅ | ✅ | |
| Phone/Email | ✅ | ✅ | |
| GSTIN | ✅ | ✅ | |
| State | ✅ | ✅ | |
| PIN code | ✅ | ✅ | |
| Address | ✅ | ✅ | |
| PAN card | ✅ | ✅ | |
| Bank details | ✅ | ✅ | |
| Nature of work | ✅ | ✅ | |
| Previous projects | ✅ | ✅ | |
| Status (Active/Inactive) | ✅ | ✅ | |
| NDA/Contract toggles | ✅ | ✅ | |
| Team members | ✅ | ✅ | |
| Document uploads | ✅ | ✅ | |
| Validation | ✅ | ✅ | |

### Partner View Tabs
| Tab | v1 | v2 | Notes |
|-----|----|----|-------|
| Partner Profile | ✅ | ✅ | |
| Work Orders | ✅ | ✅ | |
| Force Count | ✅ | ✅ | |
| Financial Ledger | ✅ | ✅ | |
| Daily Reports | ✅ | ✅ | |
| Payout History | ✅ | ✅ | |
| Communication Log | ✅ | ✅ | |

### Work Orders
| Feature | v1 | v2 | Notes |
|---------|----|----|-------|
| List with search/filter | ✅ | ✅ | |
| Status filter | ✅ | ✅ | |
| PDF download per WO | ✅ | ✅ | |
| Create WO form (6 sections) | ✅ | ✅ | |
| Auto WO number | ✅ | ✅ | |
| Vendor holds warning | ✅ | ✅ | |
| Line items | ✅ | ✅ | |
| Tax config (GST/TDS/None) | ✅ | ✅ | |
| Retention settings | ✅ | ✅ | |
| Terms & conditions | ✅ | ✅ | |
| Approval integration | ✅ | ✅ | |
| WO detail view | ✅ | ✅ | |
| Measurements tab | ✅ | ✅ | |
| Payments tab | ✅ | ✅ | |
| Ledger tab | ✅ | ✅ | |
| Final payment modal | ✅ | ✅ | |

### Attendance
| Feature | v1 | v2 | Notes |
|---------|----|----|-------|
| Add attendance form | ✅ | ✅ | |
| Attendance records table | ✅ | ✅ | |
| Labour categories | ✅ | ✅ | |
| Context modifiers | ✅ | ✅ | |
| Rate calculation | ✅ | ✅ | |
| Category manager | ✅ | ✅ | |
| PDF export records | ✅ | ✅ | |
| **Attendance list with edit/approve/delete** | ✅ | ❌ | **Gap** |

### Payments
| Feature | v1 | v2 | Notes |
|---------|----|----|-------|
| Payments tab | ✅ | ✅ | |
| Ledger tab | ✅ | ✅ | |
| Payment Requests tab | ✅ | ✅ | |
| New payment via RPC | ✅ | ✅ | |
| New invoice via RPC | ✅ | ✅ | |
| CSV/PDF export | ✅ | ✅ | |
| Payment request workflow | ✅ | ✅ | |
| Accountant release | ✅ | ✅ | |

### Invoices
| Feature | v1 | v2 | Notes |
|---------|----|----|-------|
| Invoice table | ✅ | ✅ | |
| Enriched data | ✅ | ✅ | |

### Documents
| Feature | v1 | v2 | Notes |
|---------|----|----|-------|
| Partner selection | ✅ | ✅ | |
| Upload to storage | ✅ | ✅ | |
| Document grid | ✅ | ✅ | |

### Daily Logs
| Feature | v1 | v2 | Notes |
|---------|----|----|-------|
| Logs sub-tab | ✅ | ✅ | |
| Attendance sub-tab | ✅ | ✅ | |
| Summary sub-tab | ✅ | ✅ | |

## Data Operations

| Operation | v1 | v2 | Notes |
|-----------|----|----|-------|
| Direct supabase in components | ✅ | ✅ | v2 still has some |
| React Query hooks | ✅ | ✅ | v2 more consistent |
| Service layer | ❌ | ✅ | v2 better |
| RPC for payments | ✅ | ✅ | |
| RPC for invoices | ✅ | ✅ | |
| RPC for work orders | ✅ | ✅ | |
| RPC for partner CRUD | ❌ | ❌ | **Both need RPC** |

## Security Gaps

| Gap | v1 | v2 | Action |
|-----|----|----|--------|
| Partner CRUD via RPC | ❌ | ❌ | Need `record_subcontractor` / `update_subcontractor` RPCs |
| Attendance mutations via RPC | ❌ | ❌ | Need RPC for attendance |
| Document upload RPC | ❌ | ❌ | Need RPC wrapper |
| Direct supabase in forms | ✅ | ✅ | Remove in v2 |

## Missing v2 Features

1. **ManpowerAttendanceList** — separate page for attendance management with edit/approve/delete actions
2. **RPC-only architecture** — convert all mutations to RPCs
3. **Complete cross-link migration** — all `/subcontractors` → `/subcontractors-v2`

## Recommendation

**v2 is architecturally superior** (feature-based structure, service layer, domain calculators, hooks, cleaner components). 

**To make v2 "completely done":**
1. Add `ManpowerAttendanceList` page to v2
2. Convert all v2 mutations to RPC (partner CRUD, attendance, documents)
3. Switch all routes/menus to v2
4. Verify all features work end-to-end
5. Only then delete v1
