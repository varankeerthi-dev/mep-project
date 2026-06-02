# Payment Approval & Accountant Queue — Revised Plan (Confirmed Scope)

## Confirmed behavior
- Affects **both** Purchase Payments and Subcontractor Payments.
- Organisations can **toggle** the approval flow on/off.
- The global `/approvals` tab is the single source of pending approvals.
- After approval, the payment lands in an **Accountant** tab and also remains visible in `/approvals` in an approved state.
- Only users in the **Accountant/Accounts Manager** role can access/release payments from the Accountant tab.
- Accountant marks payment as Done/Released. At release, the system links it into vendor/subcontractor ledgers and reflects on their respective dashboards.
- Admin defines multi-step approval configs in a dedicated Approval Settings page: module + approval type + approver roles + sequence (e.g., Purchase Manager -> Project Manager -> MD). Settings must remain **straightforward**.
- During approval, approvers can expand a **collapsible payment details panel** per row showing: total invoice/subcontractor amount, amount being paid now, prior payments already made, remaining balance, and payment mode breakdown.

## Systems reused (do not reimplement)
- `approvals`, `approval_actions`, `approval_workflows`, `approval_approvers`, `approval_settings`
- `approval_api`, `approval_integration`
- Front-end components/tabs/components pattern in Purchase + Subcontractors
- Sidebar route structure

## Schema updates
Add the following columns to both tables: `purchase_payments` and `subcontractor_payments`
- `approval_status VARCHAR(20) DEFAULT "Not Required"` values: `Not Required|Pending|Approved|Rejected|Released`
- `approval_id UUID` -> `approvals(id)`
- `approved_by UUID`
- `approved_at TIMESTAMPTZ`
- `released_by UUID`
- `released_at TIMESTAMPTZ`
- `released_amount DECIMAL(15,2)`
- `workflow_step VARCHAR(30) DEFAULT "created"` values: `created|pending_approval|approved|accountant_processing|released|rejected`
- `reference_no`, `rejection_reason TEXT` already present for purchase; add to subcontractor if missing.

Add to `approval_workflows` seeds (per-org per-togglable):
- `PURCHASE_PAYMENT`
- `SUBCONTRACTOR_PAYMENT`
Default example routes:
```
Level 1: ACCOUNTS_MANAGER
Level 2: PROJECT_MANAGER
Level 3: GENERAL_MANAGER / MD
```
Use `approver_designation` OR `approver_id` to point to `approval_approvers`.

## Approval settings page (new)
Location: `/approval-settings` or inside `OrganisationSettings` -> `Approval Settings`.
Content:
- On/off master toggle for approval flow on Purchase Payments
- On/off master toggle for approval flow on Subcontractor Payments
- Per-module config block:
  - Module: Purchase Payments | Subcontractor Payments
  - Enable approval (toggle)
  - Levels (ordered): each level has:
    - Role (Project Manager / GM / MD / Accountant / Finance / CEO)
    - Optional `approver_id` from `approval_approvers`
    - Min/max amount range
  - Action buttons: add level, remove level
- Keep UX tidy: use existing form controls (tabs, simple rows, primary/secondary buttons).
Persist in `approval_workflows`. Read via `ApprovalAPI.getApprovalWorkflows()`.

## Front-end: Payments (Purchase)
File to modify: `src/modules/Purchase/components/Payments.tsx`
Behavior:
- If org toggle is OFF, keep existing direct record payment behavior.
- If org toggle is ON:
  1. After user finishes steps 1..3, instead of instantly marking bills paid, call `createPaymentAndRequestApproval()`:
     - Insert `purchase_payments` with `workflow_step='pending_approval'`, `approval_status='Pending'`.
     - Call new integration method `createPaymentApproval(...)` with:
       - `approval_type: 'PURCHASE_PAYMENT'`
       - `reference_type: 'purchase_payments'`
       - `reference_id: payment.id`
  2. Do not call `updateBillPaymentStatus` or vendor balance updates until approval.
  3. Show toast + redirect to Payments page where badges show `Pending Approval`.

Status badges:
- `Not Required` / `Completed`
- `Pending Approval`
- `Approved`
- `Released`

## Front-end: Subcontractor payments
File to modify: `src/pages/Subcontractors.tsx` inside `SubcontractorPayments`
Behavior:
- Same toggleable logic as Purchase.
- Insert `subcontractor_payments` with pending approval state when toggle is ON.
- Create approval record:
  - `approval_type: 'SUBCONTRACTOR_PAYMENT'`
  - `reference_type: 'subcontractor_payments'`

## Approval details panel (new)
Add a **collapsible** sub-details row/panel in both `/approvals` and Accountant queues.
Fields shown:
- Total invoice / contract / PO amount
- Current payment amount
- Prior payments already made
- Remaining balance
- Payment mode / method breakdown (if applicable)
Implementation:
- Query prior related payments for the same `bill_id` (or subcontractor/labour entry id) plus current approval amount.
- Render as an expandable row or inline card under each approval row.
- Keep it lightweight: fetch related sums server-side or via a joined query rather than loading full payment lists.

## Accountant queue (Purchase)
New file: `src/modules/Purchase/components/AccountantQueue.tsx`
Purpose: list of payments in `workflow_step='approved'` or `approval_status='Approved'` for `reference_type='purchase_payments'`.
Features:
- Columns: Voucher, Date, Vendor, Amount, Mode, Approved By, Approved On, Action.
- Action button: `Mark as Released`
- On release:
  - set `workflow_step='released'`, `released_by`, `released_at`, `released_amount`, `approval_status='Released'`
  - Now update bills payment status, vendor balance (reuse existing logic)
  - Invalidate relevant queries.
- Include collapsible details panel (see above).
RBAC guard:
- In component:
  - fetch current user role from org_members / AuthContext
  - if role not in allowed accountant roles set, render empty state or permission banner.

Route mapping:
- `PurchaseModule.tsx`: add `'purchase-payment-accountant': { label: 'Accountant', component: AccountantQueue }`
- `App.tsx`: map case `/purchase/payment-accountant`
- Sidebar: add `{ id: 'purchase-payment-accountant', label: 'Accountant', path: '/purchase/payment-accountant' }`

## Accountant queue (Subcontractor)
Options:
- Preferred: add tabs inside `SubcontractorPayments`:
  `payments` | `accountant-queue`
- Accountant tab renders same logic as purchase AccountantQueue but filters `subcontractor_payments`.
- Include collapsible details panel (see above).
RBAC same mechanism.

## Hooks / data layer
Add to `src/modules/Purchase/hooks/usePurchaseQueries.ts`:
- `usePendingPaymentsForApproval(orgId)` -> `workflow_step='pending_approval'`
- `useApprovedPaymentsForAccountant(orgId)` -> `workflow_step='approved'` and `reference_type='purchase_payments'`
- `useCreatePaymentWithApproval()` -> mutation:
  1. insert payment
  2. call `ApprovalIntegration.createPurchasePaymentApproval(...)`
- `useApprovePayment()` -> sets approval fields, invalidates accountant + approvals queries
- `useReleasePayment()` -> finalizes released state, triggers bill/vendor updates

Add to `src/pages/Subcontractors.tsx` inline or new hook:
- `useSubcontractorPaymentsForAccountant(orgId)`
- `useReleaseSubcontractorPayment()`

## Approval type additions
In `src/types/approvals.ts`:
Add to `ApprovalType`:
- `'PURCHASE_PAYMENT'`
- `'SUBCONTRACTOR_PAYMENT'`
Labels, icons, colors in `APPROVAL_TYPES`.

In `src/database-approvals.sql`:
Add seed rows for these types in `approval_workflows`.

Also extend `triggerPostApprovalActions` in `src/approvals/api.ts`:
- switch case for `'purchase_payments'` -> ensure vendor/bill updates happen only after approval release (not here).
- Actually do not do bill/vendor updates here because accountant still has to release; hold that for release action.

## Role / RBAC assumptions to reuse
- Roles exist in `org_members.role` (string values like `'Project Manager'`, `'Accountant'`, `'General Manager'`, `'MD'`).
- Allowed accountant release roles: `'ACCOUNTS_MANAGER'`, `'ACCOUNTANT'`, `'Finance'`, `'Accounts Manager'` (exact strings mapped to current system enum or raw DB values).
- Filter can be via `approval_approvers` table or direct role check.

## Config toggle for org
In `approval_settings`, add new keys per module:
- `purchase_payments.approval.enabled` -> `'true'|'false'`
- `subcontractor_payments.approval.enabled` -> `'true'|'false'`
Expose via a small hook `useApprovalSettings(orgId)`.

## UX requirements for settings
- Flat structure: Module -> Toggle -> Levels
- Each level rendered as a compact row with:
  - Role dropdown
  - Amount range inputs (min / max / unlimited)
  - Remove button
- "+ Add Level" button at bottom
- Auto-save or Save button. Use small forms with instant feedback.

## Outstanding minor confirmations (no blockers to implementation)
- Exact role strings/constants: I will read current enum from AuthContext/org role definitions during implementation if needed.
- Accountant queue naming: route path `/purchase/payment-accountant`.
