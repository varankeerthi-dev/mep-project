# Milestone & Delay Tracking — Detailed Plan

## 1. Objective
Enable project managers and site engineers to track subcontractor work progress against committed milestones, detect delays early, and calculate penalties or incentives automatically.

---

## 2. Database Schema

### 2.1 `subcontractor_milestones` table
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | PK |
| organisation_id | uuid | Tenant |
| work_order_id | uuid | Linked WO |
| milestone_no | int | Sequential within WO |
| name | text | Milestone name (e.g. "Civil Foundation") |
| description | text | Detailed scope |
| planned_start_date | date | |
| planned_end_date | date | |
| actual_start_date | date | |
| actual_end_date | date | |
| weightage_percent | numeric | % of WO value (default 100) |
| amount | numeric | Milestone value |
| status | text | Pending / InProgress / Completed / Delayed / Cancelled |
| delay_days | int | Auto-calculated |
| penalty_percent | numeric | Penalty % for delay |
| penalty_amount | numeric | Calculated penalty |
| completion_certificate_url | text | Uploaded certificate |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| created_by | uuid | |
| approved_by | uuid | |
| approved_at | timestamptz | |

### 2.2 `subcontractor_delay_penalties` table
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | PK |
| organisation_id | uuid | Tenant |
| milestone_id | uuid | Linked milestone |
| work_order_id | uuid | Linked WO |
| subcontractor_id | uuid | Linked subcontractor |
| delay_days | int | Number of days delayed |
| penalty_percent | numeric | Penalty % per day / total |
| penalty_amount | numeric | Calculated amount |
| reason | text | Reason for delay |
| is_waived | boolean | |
| waived_by | uuid | |
| waived_at | timestamptz | |
| created_at | timestamptz | |

---

## 3. Business Rules

### 3.1 Milestone Creation
- Milestones are created against a work order.
- At least one milestone required per WO (can be 100% single milestone).
- Weightage must sum to 100% across all milestones for a WO.
- Milestone dates must fall within WO start_date and end_date.

### 3.2 Status Flow
```
Pending → InProgress → Completed
                ↓
             Delayed → Completed
```

### 3.3 Delay Detection
- **Auto-delay**: If `actual_end_date` > `planned_end_date` and status != Completed → mark as Delayed.
- **Delay calculation**: `delay_days = actual_end_date - planned_end_date`.
- **Penalty calculation**: `penalty_amount = milestone_amount * (delay_days * penalty_percent / 100)`.

### 3.4 Penalty Application
- Penalty can be:
  - **Auto-applied**: Based on milestone delay rules.
  - **Manually waived**: By authorized user with reason.
- Penalty amount is deducted from:
  - Next RA bill, OR
  - Final payment, OR
  - Retention release.

---

## 4. UI Components

### 4.1 Milestone List (in Work Order Detail)
- Gantt-style timeline view
- Status badges with color coding
- Delay warning indicators
- Progress bar (% complete)

### 4.2 Milestone Create/Edit Form
- Name, description, dates, weightage, amount
- Validation: weightage sum = 100%
- Validation: dates within WO range

### 4.3 Delay Penalty Dashboard
- Table of all delayed milestones
- Filter by subcontractor, WO, date range
- Waive penalty action with reason
- Export to PDF/Excel

### 4.4 Notifications
- Alert 7 days before milestone due date
- Alert on milestone delay
- Alert on penalty waiver

---

## 5. RPCs Required

| RPC | Purpose |
|-----|---------|
| `create_milestone` | Create milestone with validation |
| `update_milestone` | Update milestone status/dates |
| `delete_milestone` | Delete pending milestone only |
| `calculate_delay_penalties` | Auto-calculate penalties for delayed milestones |
| `waive_penalty` | Waive penalty with reason |
| `get_milestone_progress` | Get milestone progress for a WO |
| `get_delayed_milestones` | Get all delayed milestones for org |

---

## 6. Integration Points

### 6.1 Work Order Flow
- Milestones created after WO is issued.
- Milestone completion triggers measurement sheet creation.
- Milestone completion triggers RA bill generation.

### 6.2 Payment Flow
- Delay penalties deducted from payments.
- Penalty deduction shown in payment breakdown.
- Penalty history visible in ledger.

### 6.3 Notification Flow
- 7 days before due date → reminder notification
- On delay → alert notification
- On penalty waiver → confirmation notification

---

## 7. Implementation Phases

### Phase 1: Core (Week 1)
- Create `subcontractor_milestones` table
- Implement CRUD RPCs
- Add milestone list to WO detail view

### Phase 2: Delay Detection (Week 2)
- Auto-delay detection logic
- Penalty calculation RPC
- Delay notifications

### Phase 3: Penalty Management (Week 3)
- Penalty waiver workflow
- Integration with payment flow
- Penalty dashboard

### Phase 4: Reporting (Week 4)
- Milestone progress reports
- Delay analysis reports
- Export to PDF/Excel

---

## 8. Success Metrics

| Metric | Target |
|--------|--------|
| Milestone creation time | < 2 minutes |
| Delay detection accuracy | 100% (auto) |
| Penalty calculation accuracy | 100% |
| Notification delivery | < 1 minute |
| Report generation | < 5 seconds |

---

## 9. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Milestone weightage doesn't sum to 100% | Enforce validation in RPC |
| Delay calculation timezone issues | Use UTC + organisation timezone offset |
| Penalty disputes | Maintain audit log with all changes |
| Performance with many milestones | Pagination + caching |

---

## 10. Open Questions

1. Should penalty be per-day or flat for delay?
2. Who can waive penalties? (Project manager? Admin?)
3. Should milestones be mandatory for all WOs?
4. Should delay affect subcontractor rating/performance score?
