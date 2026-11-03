# Adjacent Defects Log: Subcontractor & Labour Domain

This document tracks known adjacent defects identified during the codebase audit and live verification. Per Rule R10 and Section 0.10, defects in files not actively touched during attendance workflows are logged here for explicit tracking.

---

### 1. `get_subcontractor_wo_rollup` column reference
- **File**: Database RPC `public.get_subcontractor_wo_rollup`
- **Defect**: The CTE `wo_base` does `SELECT wo.id AS wo_id, COALESCE(wo.contract_value, 0) AS cv FROM public.subcontractor_work_orders wo`. Column `contract_value` does not exist on `subcontractor_work_orders` (the actual column is `total_amount`).
- **Impact**: Any invocation of `get_subcontractor_wo_rollup` fails with Postgres error `42703: column wo.contract_value does not exist`.
- **Remediation**: Patched in Phase 0 schema migration to use `wo.total_amount AS cv`.

### 2. Work Order Rate Mapping Bug
- **File**: `apps/web/src/features/subcontractor-v2/components/WorkOrders/SubcontractorWorkOrderCreate.tsx` (lines 523-527, 545-549)
- **Defect**: Rate mapping assigns `rate: item.unit_price || item.total || 0` instead of `item.rate`.
- **Impact**: Distorts unit rates if total is present and unit_price is 0 or falsy.
- **Remediation**: Correct mapping to `item.rate`.

### 3. Work Order Discarded 35-field Payload
- **File**: `SubcontractorWorkOrderCreate.tsx` (~line 482)
- **Defect**: Rich form state collected in creation flow is partially discarded when creating work order payload.
- **Remediation**: Retain payload structure across submission.

### 4. Hardcoded Retention in Ledger Calculator
- **File**: `apps/web/src/features/subcontractor-v2/utils/ledgerCalculator.ts`
- **Defect**: Retention is hardcoded to 0 in calculations.
- **Impact**: Work order balance summaries disregard retention rules.

### 5. UI Selects on Non-Existent Columns
- **File**: Attendance / Subcontractor screens
- **Defect**: Several UI tables select fields that do not exist in the underlying view/table.

### 6. Site-Report Fallback Bypassing Role-Gated RPC
- **File**: `features/site-reports` / `AttendancePage.tsx`
- **Defect**: When site reports are submitted with attendance, the fallback direct insert path bypasses role permission validation.

### 7. RLS Enabled With Zero Policies
- **Tables**: `parties`, `party_roles`, `party_opening_balances`, `work_order_items`, `work_order_links`, `work_order_parties`, `work_order_requirements`, `work_order_versions`, `work_order_bill_links`, `work_order_audit_events`.
- **Defect**: Row Level Security is turned on (`relrowsecurity = true`), but no policies exist, locking out non-service-role queries.
- **Remediation**: Add explicit tenant policies `TO authenticated` using `user_can_access_org(organisation_id)` for tables used by this feature.

### 8. `invoices` Table Column Schemas
- **Relation**: `public.invoices`
- **Defect**: Code in several places assumed `invoice_number`, but the live column is `invoice_no`. Additionally, multiple financial columns (`template_type`, `mode`, `subtotal`, `cgst`, `sgst`, `igst`, `total`, `round_off`) are defined as `NOT NULL` without database defaults.
- **Remediation**: Standardized on `invoice_no` and provided all non-null default values when attaching labour invoice charges.

### 9. Postgres `FOR UPDATE` with `GROUP BY`
- **Context**: `attach_labour_to_invoice`
- **Defect**: PostgreSQL raises error `42P10: FOR UPDATE cannot be applied to queries with GROUP BY`.
- **Remediation**: De-coupled row-level locking from aggregation by pre-locking candidate rows using `PERFORM id FROM manpower_attendance ... FOR UPDATE` before executing the grouped aggregation.

### 10. `labour_audit_log` Immutability with Cascade Deletions
- **Relation**: `public.labour_audit_log`
- **Defect**: The trigger `trg_prevent_labour_audit_tampering()` rejects all `DELETE` operations. However, `organisations(id)` had `ON DELETE CASCADE` on `labour_audit_log.organisation_id`. When an organisation was deleted, the cascade delete fired the trigger and failed.
- **Remediation**: Test runners must temporarily disable `trg_labour_audit_immutable` during cleanup of test tenants, or organisations must be archived instead of hard-deleted in production.
