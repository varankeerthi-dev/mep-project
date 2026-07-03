# Advance & Expense Module PRD — Employee Advances & Expense Claims

## 1) Objective

Build a full Advance & Expense module that lets employees request cash advances and submit expense claims against them — with cross-linked audit trails (project, employee, category), configurable approval workflows, and financial reporting.

Primary outcome:
- Employees request advances (cash given before travel/purchase) and submit expense claims (reimbursement for spent money) — or submit reimbursement-only claims without an advance.
- All entries link to a **Project**, an **Employee** (org member), and an **Expense Category** (from the Chart of Accounts).
- Every entry logs `created_by`, `created_at`, `created_by_name` for full audit.
- All entries go through the **existing Approvals system** using the `EXPENSE_CLAIM` type.
- Summary KPIs, Reports with filters, and export capability.
- Petty cash float tracking — fixed cash floats assigned to employees (site engineers, office staff), with expense claims drawn against the float balance and periodic top-ups.

## 2) Scope

In scope:
- Database: `advances_expenses` table (unified model covering both advance and expense records) with polymorphic linking
- Expense Categories sourced dynamically from `accounts WHERE root_type = 'Expense' AND is_group = false` (Tally-style COA)
- Employee selection from `user_profiles` + `org_members` (org users)
- Approval integration via existing `EXPENSE_CLAIM` approval type and workflows
- Remarks/comments on each entry
- Soft delete with optional restore window
- Auto-generated transaction numbers (`AE-YYMMDD-RRRR`)
- Duplicate detection on submission
- Petty cash float tracking — assign a fixed float amount to an employee; expenses drawn against it reduce the balance; top-ups restore it
- Advance-to-expense settlement (expense claims can be linked to an advance)
- Summary KPIs (Advances Total, Expenses Total, Awaiting Payment, Paid Out, Accrued, Float Balances)
- Reports module with date range, employee filter, category filter
- Two request types: Reimbursement (already spent) and Pre-Approval (need money first)
- Payout methods: Immediate and With Salary
- RBAC: `advances_expenses.read`, `advances_expenses.manage`, `advances_expenses.approve`, `advances_expenses.settings`
- Sidebar entry under Sales & Finance or a new Finance category

Out of scope (Phase 2):
- Automated journal entry posting to accounting
- Multi-currency support
- Corporate card reconciliation
- Receipt image attachment (text description only for v1)
- Bulk import/export
- PDF/screenshot export

## 3) Design Principles

0. All pages must follow `DESIGN.md` — card body padding (24px), form field row pattern (70px labels, 8px gap, 11px label font, 12px input font), button system (primary #185FA5, secondary white, destructive black-text + red confirmation modal), compact typography, uppercase section headers (11px/600/0.05em), and searchable dropdown pattern for all selects.
1. Cross-linked audit — every entry ties to project + employee + expense category + created_by info.
2. Approvals-first — every submission goes through the existing `EXPENSE_CLAIM` approval workflow. No manual status bypass.
3. Categories from COA — expense categories are live-read from the `accounts` table, not hardcoded.
4. Additive migration — no breaking changes to existing tables.
5. Follow existing patterns — mirror PurchaseModule or proforma-invoices module architecture (module directory, entry point, sub-components).

## 4) Users

- **Employees** (all org members) — request advances, submit expense claims, view own history
- **MEP Managers** — first-level approval for their team's/project's expenses
- **CEO** — second-level (final) approval for all expense claims
- **Finance/Accounts** — process payments, mark as paid, run reports, reconcile
- **Org Admins** — configure approval workflows for `EXPENSE_CLAIM` type

## 5) Functional Requirements

### FR-1 Unified Data Model (`advances_expenses`)

Single table with a `type` discriminator:

| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| type | VARCHAR | `ADVANCE` or `EXPENSE` or `REIMBURSEMENT` |
| request_type | VARCHAR | `REIMBURSEMENT` (already spent) or `PRE_APPROVAL` (need money) |
| transaction_no | VARCHAR | Auto-generated: `AE-YYMMDD-RRRR` |
| employee_id | UUID FK → user_profiles.id | Who this advance/expense is for |
| employee_name | VARCHAR | Denormalized for display |
| project_id | UUID FK → projects.id | Linked project |
| project_name | VARCHAR | Denormalized |
| category_id | UUID FK → accounts.id | COA ledger account (root_type = 'Expense') |
| category_name | VARCHAR | Denormalized |
| amount | DECIMAL(15,2) | Requested amount |
| narration | TEXT | Purpose/description |
| remarks | TEXT | Additional notes |
| advance_id | UUID FK → advances_expenses.id (self-ref) | If this expense settles an advance |
| float_id | UUID FK → petty_cash_floats.id | If this expense is drawn against a petty cash float |
| payout_method | VARCHAR | `IMMEDIATE` or `WITH_SALARY` |
| status | VARCHAR | `DRAFT`, `PENDING`, `APPROVED`, `REJECTED`, `PAID`, `CANCELLED` |
| approval_id | UUID FK → approvals.id | Link to approval record |
| is_deleted | BOOLEAN | Soft delete flag |
| deleted_at | TIMESTAMPTZ | When soft-deleted |
| created_by | UUID | Who entered this record |
| created_by_name | VARCHAR | Denormalized |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |
| organisation_id | UUID | Org scope |

Indexes: `(organisation_id, type)`, `(employee_id)`, `(project_id)`, `(category_id)`, `(status)`, `(transaction_no)`, `(created_by)`.

### FR-2 Expense Categories from Chart of Accounts

- On load, fetch `accounts WHERE root_type = 'Expense' AND is_group = false AND organisation_id = ?`
- Display in a searchable dropdown per DESIGN.md pattern
- Category name stored denormalized on the record for fast display
- No separate `expense_categories` table — the COA is the source of truth

### FR-3 Employee Selection

- Employees = org members (`org_members` joined with `user_profiles`)
- Searchable dropdown with employee name + email/phone
- Employee name denormalized onto the record

### FR-4 Approval Integration (2-Level Chain: Manager → CEO)

- Approval chain is configured via the existing `approval_workflows` system:
  - **Level 1**: MEP Manager — reviews and approves/rejects claims for their team/project
  - **Level 2**: CEO — final approval after manager clears
  - Workflow config: create an `EXPENSE_CLAIM` workflow with `max_levels = 2`, each level mapping to the appropriate approver role
- On submission (when status changes from DRAFT to PENDING):
  1. Check `approval_settings` if `EXPENSE_CLAIM` approval is enabled
  2. Check `approval_workflows` for matching workflow by amount range
  3. If approval needed: call `ApprovalAPI.createApprovalRequest()` with:
     - `approval_type: 'EXPENSE_CLAIM'`
     - `reference_id: advances_expenses.id`
     - `reference_type: 'advances_expenses'`
     - `title: "Advance/Expense - {employee_name} - {category_name}"`
     - `amount: requested amount`
     - `project_id`, `project_name` from the record
  4. Update `advances_expenses.approval_id` with the returned approval ID
  5. Set `workflow_step: 'pending_approval'`, `approval_status: 'Pending'`
  6. If no approval needed (below threshold or workflow not configured): auto-approve
- On approval at any level: `current_level` advances
- On final approval (all levels passed): update `status` to `APPROVED`
- On rejection at any level: update `status` to `REJECTED`, store reason from approval action log
- Register `advances_expenses` in `REFERENCE_DENORM_MAP` in `src/approvals/api.ts`
- Add handler in `handleApprovalCompletion` / `triggerPostApprovalActions` in `src/approvals/integration.ts`

### FR-5 Advance-to-Expense Settlement

- When creating an expense claim, optionally link to an existing advance (`advance_id`)
- The linked advance's status updates to reflect partial/full settlement
- Show remaining advance balance when selecting an advance
- An advance can be settled by multiple expense claims (partial settlement)

### FR-6 Petty Cash Float Tracking

- A petty cash float is a fixed cash amount assigned to an employee (e.g. site engineer gets ₹5000 float for site expenses)
- `petty_cash_floats` table:
  | Field | Type | Notes |
  |---|---|---|
  | id | UUID PK | |
  | organisation_id | UUID | Org scope |
  | holder_id | UUID FK → user_profiles.id | Employee holding the float |
  | holder_name | VARCHAR | Denormalized |
  | project_id | UUID FK → projects.id | Project the float belongs to |
  | project_name | VARCHAR | Denormalized |
  | float_amount | DECIMAL(15,2) | Total float assigned |
  | current_balance | DECIMAL(15,2) | Remaining unspent balance |
  | status | VARCHAR | `ACTIVE`, `FROZEN`, `CLOSED` |
  | created_by | UUID | |
  | created_at | TIMESTAMPTZ | |
  | updated_at | TIMESTAMPTZ | |
- When an expense claim is created against a float (`advances_expenses.float_id`), the `current_balance` decreases by the claimed amount
- When a top-up is processed, `current_balance` increases
- UI shows current balance prominently when selecting a float
- Float holders can only claim up to the available balance
- Top-ups go through the same approval chain (Manager → CEO)

### FR-7 Transaction Number Generation

- Format: `AE-YYMMDD-RRRR` where RRRR is a random 4-digit number
- Must be unique within the organisation
- Generated on first save (when status changes from DRAFT)

### FR-8 Duplicate Detection

- On submission, check for existing records within the last 30 days with:
  - Same `employee_id`, `category_id`, `project_id`, and similar `amount` (within 10%)
- Show warning if potential duplicate found, allow override

### FR-9 Soft Delete

- `is_deleted = true` with `deleted_at` timestamp
- 30-day restore window (UI option to restore)
- After 30 days, records are hidden from default views

### FR-10 UI Pages

#### a) List View (`/advances-expenses`)
- Filterable table: type (All/Advance/Expense), status, date range, employee, project, category
- Columns: Transaction No., Date, Type, Employee, Project, Category, Amount, Status, Actions
- Quick-action buttons: New Advance, New Expense
- Tab switcher: All | Advances | Expenses | Reimbursements | Petty Cash
- KPI summary cards at top (Advances Total, Expenses Total, Awaiting Payment, Paid Out, Accrued, Float Balances)

#### b) Add/Edit Form (slide-over drawer)
- Form field rows following DESIGN.md:
  - Type: dropdown (Advance / Expense / Reimbursement)
  - Request Type: Reimbursement / Pre-Approval
  - Employee: searchable dropdown
  - Project: searchable dropdown
  - Category: searchable dropdown (from COA)
  - Amount: number input
  - Payout Method: Immediate / With Salary
  - Link to Advance (if type=Expense): optional, searchable dropdown
  - Narration: textarea
  - Remarks: textarea
- Save as Draft / Submit for Approval buttons

#### c) Detail View
- All fields displayed in a read-only layout
- Linked approval status and action history
- Edit button (if in DRAFT status)
- Cancel/Delete button (with confirmation modal per DESIGN.md)

#### d) Petty Cash Management (`/advances-expenses/petty-cash`)
- List all petty cash floats with holder name, project, float amount, current balance, status
- Create float: assign to employee, set amount, link project
- Top-up float: increase balance (goes through approval if above threshold)
- Freeze/close float
- Transaction history per float: all expense claims drawn against it + top-ups
- Balance indicator: green (healthy), yellow (< 25% remaining), red (exhausted)

#### e) CEO Dashboard (`/advances-expenses/ceo-view`)
- Aggregated view of all pending approvals grouped by project
- Total pending amount across all claims
- Quick-action: approve/reject from the dashboard (drills into approval modal)
- Summary by MEP Manager: who has the most pending claims, oldest pending
- CEO sees individual approvals only if needed — bulk view reduces noise

#### f) Reports (`/advances-expenses/reports`)
- Filters: date range, employee, project, category, type
- Summary table grouped by category or employee
- KPI cards: total advances, total expenses, balance, awaiting payment, paid out
- Simple export (CSV)

#### e) Approvals Integration
- Expense claims appear in the existing `/approvals` page automatically
- Approvers process via the existing approval UI
- Status syncs back to the `advances_expenses` record

### FR-11 RBAC

| Permission | Actions |
|---|---|
| `advances_expenses.read` | View list, detail, reports |
| `advances_expenses.manage` | Create, edit, delete own entries |
| `advances_expenses.approve` | Mark as paid, manage others' entries (admin/finance) |
| `advances_expenses.settings` | Configure defaults |

Add to `PERMISSION_MODULES` in `src/rbac/permission-catalog.ts`.

### FR-12 Module Registration

Register in `src/config/module-registry.ts`:
```typescript
{
  id: 'advances_expenses',
  label: 'Advances & Expenses',
  description: 'Employee advances, expense claims, and reimbursements.',
  icon: 'ReceiptRefundIcon',  // or 'Wallet', 'Banknote'
  category: 'sales',           // or new 'finance' category if needed
  route: '/advances-expenses',
}
```

## 6) Data Model

### New Table: `petty_cash_floats`

```sql
CREATE TABLE petty_cash_floats (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id   UUID NOT NULL REFERENCES organisations(id),
  holder_id         UUID NOT NULL REFERENCES user_profiles(id),
  holder_name       VARCHAR(255),
  project_id        UUID REFERENCES projects(id),
  project_name      VARCHAR(255),
  float_amount      DECIMAL(15,2) NOT NULL,
  current_balance   DECIMAL(15,2) NOT NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                      CHECK (status IN ('ACTIVE', 'FROZEN', 'CLOSED')),
  created_by        UUID NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pcf_org ON petty_cash_floats(organisation_id);
CREATE INDEX idx_pcf_holder ON petty_cash_floats(holder_id);
CREATE INDEX idx_pcf_project ON petty_cash_floats(project_id);
```

### New Table: `advances_expenses`

```sql
CREATE TABLE advances_expenses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  type            VARCHAR(20) NOT NULL CHECK (type IN ('ADVANCE', 'EXPENSE', 'REIMBURSEMENT')),
  request_type    VARCHAR(20) CHECK (request_type IN ('REIMBURSEMENT', 'PRE_APPROVAL')),
  transaction_no  VARCHAR(30),
  employee_id     UUID NOT NULL REFERENCES user_profiles(id),
  employee_name   VARCHAR(255),
  project_id      UUID REFERENCES projects(id),
  project_name    VARCHAR(255),
  category_id     UUID REFERENCES accounts(id),
  category_name   VARCHAR(255),
  amount          DECIMAL(15,2) NOT NULL,
  narration       TEXT,
  remarks         TEXT,
  advance_id      UUID REFERENCES advances_expenses(id),
  payout_method   VARCHAR(20) DEFAULT 'IMMEDIATE' CHECK (payout_method IN ('IMMEDIATE', 'WITH_SALARY')),
  status          VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
                    CHECK (status IN ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'PAID', 'CANCELLED')),
  approval_id     UUID REFERENCES approvals(id) ON DELETE SET NULL,
  workflow_step   VARCHAR(30) DEFAULT 'created',
  approval_status VARCHAR(20) DEFAULT 'Not Required',
  is_deleted      BOOLEAN DEFAULT FALSE,
  deleted_at      TIMESTAMPTZ,
  created_by      UUID NOT NULL,
  created_by_name VARCHAR(255),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ae_org_type ON advances_expenses(organisation_id, type);
CREATE INDEX idx_ae_employee ON advances_expenses(employee_id);
CREATE INDEX idx_ae_project ON advances_expenses(project_id);
CREATE INDEX idx_ae_category ON advances_expenses(category_id);
CREATE INDEX idx_ae_status ON advances_expenses(status);
CREATE INDEX idx_ae_transaction ON advances_expenses(transaction_no);
CREATE INDEX idx_ae_created_by ON advances_expenses(created_by);
CREATE INDEX idx_ae_advance ON advances_expenses(advance_id);
```

### Approval Reference Registration

Add to `REFERENCE_DENORM_MAP` in `src/approvals/api.ts`:
```typescript
advances_expenses: {
  table: 'advances_expenses',
  select: 'id, transaction_no, employee_name, project_id, project_name, category_name, amount, narration',
  numberField: 'transaction_no',
},
```

## 7) Directory Structure

```
src/modules/AdvanceExpense/
  AdvanceExpenseModule.tsx       -- Entry point / route component
  components/
    AdvanceExpenseList.tsx       -- List view with filters & KPIs
    AdvanceExpenseForm.tsx       -- Add/Edit slide-over form
    AdvanceExpenseDetail.tsx     -- Detail view
    AdvanceExpenseReports.tsx    -- Reports page
    PettyCashManagement.tsx      -- Petty cash float list & management
    PettyCashDetail.tsx          -- Float detail with transaction history
    CeoDashboard.tsx             -- CEO aggregated approval view
    ExpenseCategoryDropdown.tsx  -- COA-based category selector
    EmployeeDropdown.tsx         -- Org member selector
    KpiCards.tsx                 -- Summary KPI cards
    StatusBadge.tsx              -- Status display component
    DuplicateWarning.tsx         -- Duplicate detection warning
  hooks/
    useAdvanceExpense.ts         -- React Query hooks
  utils/
    transactionNo.ts             -- TN generation
    validation.ts                -- Form validation
    constants.ts                 -- Type/status constants
```

## 8) Approvals Integration Summary

| Step | Action | Where |
|---|---|---|
| 1 | Add `EXPENSE_CLAIM` already exists | `src/types/approvals.ts` |
| 2 | Add `advances_expenses` to `REFERENCE_DENORM_MAP` | `src/approvals/api.ts` |
| 3 | Add post-approval handler | `src/approvals/integration.ts` |
| 4 | Migration: create `petty_cash_floats` table + indexes | `supabase/migrations/NNN_advances_expenses.sql` |
| 5 | Migration: create `advances_expenses` table + indexes | Same migration |
| 6 | Update RBAC permissions catalog | `src/rbac/permission-catalog.ts` |
| 7 | Register module | `src/config/module-registry.ts` |
| 8 | Add route | `src/App.tsx` |
