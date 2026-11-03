# Live State Audit: Labour & Subcontractor Attendance
**Timestamp**: 2026-11-03T23:00:00+05:30  
**Project Ref**: `rujqejtisqermjyqqgoj` (DELIVERY, ACTIVE_HEALTHY)  
**Postgres Engine**: 17.6  

---

## 1. Executive Summary & Reconciliation

| Item / Finding from Audit | Live DB Reality | Reconciliation Action Needed |
|:---|:---|:---|
| **8 Attendance RPCs** (`record_attendance`, `update_attendance`, `approve_attendance`, `delete_attendance`, `get_labour_categories`, `create_labour_category`, `get_context_modifiers`, `get_rate_cards`) | All 8 exist in `pg_proc` (deployed under migration `20260916170000`). | Functions are physically present, but `record_attendance` trusts client money inputs (no server rate resolution), `update_attendance` does not recompute amounts, and `approve_attendance` does not set `approved_by`. Redefine with server-side computation. |
| **`subcontractor_work_orders.contract_value`** | **DOES NOT EXIST**. Live column is `total_amount`. | Column is missing. `get_subcontractor_wo_rollup` throws `ERROR: 42703: column wo.contract_value does not exist`. Must patch RPC to use `wo.total_amount AS cv`. |
| **`subcontractor_invoices` RA columns** (`subtotal`, `gross_amount`, `net_amount`, `billed_qty`, `measured_qty`, `tds_percent`, `retention_amount`) | **ALL EXIST**. Deployed via migration `20260918000000`. | Already live and verified. Reuse existing columns. |
| **`org_members.employee_id`** | **EXISTS** (`uuid`, nullable). | No change needed; reuse. |
| **Migration status of `20260916170000` & `20260918000000`** | **APPLIED**. Both are recorded in the remote migrations log. | Verified. Baseline is present. |
| **Site Planning Tables** (`site_plans`, `site_plan_allocations`, `site_plan_schedule_history`) | **EXIST** in live DB (migration `20261103000001` applied today). Row count: 0 across all 3 tables. | R1 Additive rule: Retain tables without dropping. Re-point UI to `manpower_attendance` rows in `entry_kind = 'PLANNED'`. |
| **Policies on `labour_categories` & `context_modifiers`** | 4 policies each, role `{public}`, querying legacy `user_organisations`. SELECT allows `organisation_id IS NULL`. 7 global labour categories and 5 global modifiers have `organisation_id IS NULL`. | Tenancy leak confirmed. Must re-home/backfill rows per tenant, tighten policies to `TO authenticated` with `user_can_access_org(organisation_id)`. |
| **Policies on `manpower_attendance`, `manpower_billing`, `rate_cards`** | 4 policies each, role `{public}`, querying `user_organisations`. | Tenancy leak confirmed. Re-create policies `TO authenticated` using `user_can_access_org(organisation_id)`. |
| **`parties` & `party_roles` RLS** | RLS is **ENABLED**, but policy count is **0**. | Unusable by non-superusers. Must define tenant RLS policies `TO authenticated` with `user_can_access_org(organisation_id)`. |
| **RLS-enabled-with-no-policy in Domain** | `parties`, `party_roles`, `party_opening_balances`, `work_order_items`, `work_order_links`, `work_order_parties`, `work_order_requirements`, `work_order_versions`, `work_order_bill_links`, `work_order_audit_events`. | Apply missing RLS policies for domain tables touched. |
| **`manpower_attendance` columns** | `project_id` is missing. 4 rows exist, all with `work_unit_id: null`. | Add `project_id uuid REFERENCES projects(id)`. Backfill count from `work_unit_id` will be 0 unmatched. |
| **`attendance_status_check` on `attendance`** | CHECK allows only `'planned'`, `'checked_in'`, `'absent'`. | Update CHECK to include `'leave'` and `'no_show'`. |

---

## 2. Detailed Findings by Area

### 2.1 The 8 Attendance RPCs
- `record_attendance`: Currently takes 16 parameters including `p_base_rate`, `p_adjusted_rate`, `p_original_amount`, `p_adjusted_amount`. Direct client injection of money values.
- `update_attendance`: Takes `p_workers_count`, `p_hours_worked`, `p_supervisor_name`, `p_remarks`. Does not recalculate rates or amounts.
- `approve_attendance`: Sets `status = 'APPROVED'`, `approved_at = NOW()`, but `approved_by` remains NULL.
- `delete_attendance`: Checks `user_can_access_org` and deletes if status is 'DRAFT'.
- `get_labour_categories`: Returns category records filtered by tenant or global.
- `get_context_modifiers`: Returns modifiers filtered by tenant or global.
- `get_rate_cards`: Returns rate cards for subcontractor.
- `create_labour_category`: Inserts labour category.

### 2.2 Subcontractor Rollup Bug
Executing `SELECT * FROM get_subcontractor_wo_rollup(...)` throws:
```
ERROR: 42703: column wo.contract_value does not exist
```
`subcontractor_work_orders` has `total_amount numeric`. The RPC must reference `wo.total_amount` instead of `wo.contract_value`.

### 2.3 Live Table Row Counts
- `site_plans`: 0
- `site_plan_allocations`: 0
- `site_plan_schedule_history`: 0
- `manpower_attendance`: 4 (2 direct, 2 site_report; all with work_unit_id: null)
- `labour_categories`: 7 (all with organisation_id: null)
- `context_modifiers`: 5 (all with organisation_id: null)
- `rate_cards`: 0
- `manpower_billing`: 0
- `parties`: 31
- `party_roles`: 31

### 2.4 Adjusted Plan for Phase 0
Because `20260916170000` is already applied, Step 0.2 is not deploying from scratch; rather, Steps 0.2 and 0.3 will be combined into a hardening migration that:
1. Re-creates `record_attendance` and `update_attendance` with strict server-side rate resolution:
   - Rate resolution order: (a) `rate_cards` (vendor x trade x project on date) -> (b) `rate_cards` (vendor x trade) -> (c) `labour_categories.base_rate` -> (d) RAISE EXCEPTION if none found.
   - Server-side context modifier multiplication.
   - Ignore client-provided rates/amounts.
2. Fixes `approve_attendance` to set `approved_by = auth.uid()` and `approved_at = NOW()`.
3. Adds `reject_attendance` and `reopen_attendance`.
4. Adds `project_id` to `manpower_attendance` with foreign key to `projects(id)`.
5. Fixes `attendance_status_check` on `attendance` to include `'leave'` and `'no_show'`.
6. Fixes `get_subcontractor_wo_rollup` to use `wo.total_amount`.
7. Re-creates policies on `labour_categories`, `context_modifiers`, `manpower_attendance`, `manpower_billing`, `rate_cards` using `user_can_access_org(organisation_id)` and `TO authenticated`.
8. Seeds tenant copies of global `labour_categories` and `context_modifiers` for existing active organisations so no tenant loses trade definitions.
9. Introduces the RBAC permissions catalog entries and generic audit mechanism (`labour_audit_log` with immutability trigger).
