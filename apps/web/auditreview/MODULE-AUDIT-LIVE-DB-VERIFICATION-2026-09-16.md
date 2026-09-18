# MODULE AUDIT — LIVE DATABASE VERIFICATION & CORRECTIONS

**Standard:** `MODULE_REFERENCE_PATTERN.md` (audit-only mode, §36 — no module code or database object was modified).
**Date:** 2026-09-16
**Supersedes the database findings in:** `MODULE-AUDIT-ROLLUP-2026-09-16.md`, `MODULE-AUDIT-COMMUNICATION-LOG-2026-09-16.md`, `MODULE-AUDIT-FOLLOW-UP-CENTRE-2026-09-16.md`, `MODULE-AUDIT-MANUFACTURING-2026-09-16.md`, `MODULE-AUDIT-PURCHASE-2026-09-16.md`.

> **Read this first.** The four module reports were produced from the repository. This checkout's migration history is **not** what production runs — **149 of 205 files in `supabase/migrations/` are 0 bytes**, including the "fix" migrations the earlier reports leaned on. Every database claim in those reports is therefore unreliable, and several central P0s were flatly wrong. This document replaces them with state read from the live project.

---

## 1. Method — what was actually read

| Source | Command | Result |
|---|---|---|
| Live catalog (tables, RLS, policies, functions, constraints, indexes) | `supabase db query --linked "<sql>" --output-format json` | 415 public tables, 13 views, 279 public functions |
| Supabase security/performance advisors | `supabase db advisors --linked --type security\|performance` | 634 security, 720 performance lints |
| Live schema snapshot | `supabase gen types --linked --lang typescript` | 31,654 lines |
| **Runtime truth (what the browser actually gets)** | `curl "$VITE_SUPABASE_URL/rest/v1/<table>?select=*&limit=1" -H "apikey: $VITE_SUPABASE_ANON_KEY"` | PostgREST responses below |

**Project identity was confirmed before any conclusion:** `apps/web/.env.local` → `VITE_SUPABASE_URL=https://rujqejtisqermjyqqgoj.supabase.co`; linked project ref → `rujqejtisqermjyqqgoj`; the only Supabase host anywhere in the repo is the same. The app and this audit read the **same** project, so the drift below is real and not an environment mix-up.

`supabase db dump` requires Docker (not installed here); the catalog was read through SQL and the type generator instead. All probes were read-only.

---

## 2. Corrections: earlier P0s that the live database refutes

| # | Claim in the earlier reports | Repository evidence it came from | **Live reality** | Verdict |
|---|---|---|---|---|
| 1 | `client_communication` has RLS `USING (true)` | `sql/client_communication_fixed.sql` etc. | One `ALL` policy: `user_can_access_org(organisation_id)` | **REFUTED** |
| 2 | `client_communication_entries` lacks `organisation_id`; policy is `auth.role() = 'authenticated'` | `sql/client_communication_entries.sql` | Table **does not exist** in the live project | **REFUTED / moot** |
| 3 | Communication "threads view" lacks `security_invoker` | local view definition | No communication view exists live; only 4 views lack `security_invoker` (`v_party_search`, `v_legacy_clients`, `v_legacy_vendors`, `v_legacy_subcontractors`) | **REFUTED** |
| 4 | `notifications` never has RLS enabled | `src/database-communication-*.sql` | Table **does not exist**; live has `approval_notifications`, `warranty_notifications` | **REFUTED** (but see §3.C — the app writes to it) |
| 5 | `purchase_orders`, `purchase_order_items`, requisitions, availability inquiries, `purchase_audit_log` have **no policy anywhere** | `20260817000004_purchase_ap_security_hardening.sql` covers AP only | `purchase_orders` 4 policies (`app_has_org_permission(organisation_id,'purchase_orders.create/edit/delete')`), `purchase_order_items` 2, `purchase_requisitions` + `_lines` + `purchase_audit_log` org-scoped | **REFUTED** |
| 6 | 12 manufacturing tables ship `FOR ALL USING (true) WITH CHECK (true)` | `20260730_manufacturing_gap_features.sql` | `dispatch_orders/_items/_packing/_count_verification` 4 policies each, `grn_items`, `goods_receipt_notes`, `material_requisitions(_items)` — all `user_can_access_org(organisation_id)`, both `USING` and `WITH CHECK` | **REFUTED** |
| 7 | `user_can_access_org` is referenced 14× and defined **zero** times | its "fix" migration is 0 bytes | Exists: `user_can_access_org(p_org_id uuid)`, `SECURITY DEFINER`, `search_path=public` | **REFUTED** |
| 8 | Follow-Up schema lives only in an ad-hoc script; `follow_up_procurement_tracking` created nowhere; RLS on an undefined function | `src/database-follow-up-centre.sql`; `follow_up_*` migrations 0 bytes | All 5 tables exist with org-scoped RLS and the unique indexes the app's upserts need | **REFUTED** |
| 9 | 23 tables suspected to have no tenant predicate | inference from placeholders | Supabase itself reports **zero** `rls_disabled_in_public` and **zero** `rls_enabled_no_policy`; only **11** public tables have no `org` token in any policy (list in §4) | **REFUTED** |

**Why the local read misled:** production was built by an out-of-band path and the repo's migration directory is a placeholder shell. Local SQL files are not evidence about production and must not be used as such again — this is the single most important lesson in the report, and it is now recorded as a process finding (§5.D).

---

## 3. Live defects confirmed against production

### A. P0 — `recalc_vendor_balance` is a no-op (confirmed by reading the deployed function body)

```sql
v_balance := v_opening_bal + v_total_bills - v_total_debits - v_total_paid;
END;
```

The deployed function (`SECURITY DEFINER`, `search_path=public`) computes the balance and **returns without persisting or returning it** — there is no `UPDATE purchase_vendors SET balance = …` and no `RETURN`. Vendor outstanding balances therefore never update; anything reading a stored balance is reading a stale value. The earlier report flagged this from the repo; the live body confirms it is deployed, not merely committed.

### B. P1 — the Follow-Up activity log rejects its own vocabulary (confirmed constraint vs. confirmed call sites)

Deployed constraints:

```
follow_up_activity_log_event_type_check  CHECK (event_type = ANY (ARRAY[
    'quotation_reminder_sent','quotation_response_logged','podc_pack_shared',
    'podc_issue_flagged','invoice_reminder_sent','invoice_escalation_changed']))
follow_up_activity_log_tab_source_check  CHECK (tab_source = ANY (ARRAY[
    'quotation','podc','invoice','activity']))
```

The RPC the app calls, `follow_up_log_activity` (live, `SECURITY DEFINER`), performs a plain `INSERT INTO public.follow_up_activity_log (… event_type, tab_source …)` — so the CHECKs apply. The app writes values that are **not** in either list:

| Call site | Value written | Allowed? |
|---|---|---|
| `follow-up/api.ts:372` | `event_type: 'quotation_status_changed'` | ✗ |
| `follow-up/api.ts:508` `recordProcurementReminder` | `event_type: 'procurement_reminder_sent'`, `tab_source: 'procurement'` | ✗ ✗ |
| `invoices/pages/InvoiceEditorPage.tsx:1325` | `event_type: 'invoice_edited'` | ✗ |
| `approvals/api.ts:393` | `event_type: 'approval_status_changed'` | ✗ |

`logActivity` calls the RPC, and on error **falls back to a direct insert that breaks the same constraint**, then throws. So the sequence upsert-tracking → log-activity leaves the tracking row written and then surfaces an error to the user.

**Corroborating design evidence that the CHECK is stale, not the code:** the live partial index `idx_follow_up_quotation_next_action` excludes `follow_up_status <> ALL (ARRAY['approved','lost_to_competitor','cancelled','expired'])`, while `follow_up_quotation_tracking_follow_up_status_check` permits only `('sent','under_review','in_negotiation','pending','lost_to_competitor')`. The index anticipates `approved`, `cancelled` and `expired` states that the CHECK makes unstorable — the constraint was written before the workflow and never migrated.

`InvoiceEditorPage`'s drawer also filters on `'invoice_finalized'`, which no constraint permits and no migration adds.

### C. P0 — routed pages call objects that do not exist in production (runtime-proven)

PostgREST, queried with the app's own anon key — this is exactly what the browser sees:

| Endpoint | Result |
|---|---|
| `client_communication` (control) | **200** `[]` |
| `payment_requests` | **200** `[]` |
| `follow_up_activity_log` | **200** `[]` |
| `notifications` | **404 `PGRST205`** — "Perhaps you meant the table 'public.warranty_notifications'" |
| `client_communication_entries` | **404 `PGRST205`** |
| `manager_alerts` | **404 `PGRST205`** |
| `reminders` | **404 `PGRST205`** |

Confirmed in routed, entrypoint-reachable code:

- **`/client-lookup`** (`App.tsx:513`, behind `quick_lookup.read`) → `ClientLookup.tsx:401` inserts into `client_communication_entries`, `:412` into `notifications`. Both 404. The client-call logging + assignment-notification path cannot complete.
- **Manager Alerts page** → `manager_alerts` select/update **and** a realtime channel on it; 404.
- **Remind Me / Todo List** → `reminders` select/insert/update; 404.

Full drift set (1196 files parsed; import graph walked from `App.tsx`/`main.tsx` → 937 reachable files). **35 of 47** missing objects are referenced from reachable code; the other 12 are unreferenced (dead code):

- **Reachable tables missing live:** `boms`, `client_communication_entries`, `expense_claims`, `inventory_lots`, `invoice_line_items`, `manager_alerts`, `notifications`, `project_closure_checklists`, `project_closure_gates`, `project_closure_templates`, `project_tasks`, `quotation_headers`, `quotation_variant_discounts`, `quotations`, `reminders`, `salary_increments`, `subcontractor_attendance`
- **Reachable RPCs missing live:** `approval_transition`, `backfill_approval_denorm`, `calculate_job_card_variances`, `create_complete_site_report`, `execute_standard_cost_rollup_run`, `increment_measurement_count`, `payment_request_create/approve/release/bind_approval`, `payment_requests_list`, `release_job_card`, `rollup_item_standard_cost`, `update_complete_site_report`, `update_purchase_requisition_header_status`, `work_order_approve`
- **No reachable references (dead):** `feature_flags`, `plan_features`, `pricing_plans`, `project_comments`, `project_scope_items`, `project_scope_item_versions`, `subscription_events`, `subscriptions`, `work_instructions`, `work_items`, `ensure_site_report_photos_bucket`
- **False positives removed:** `attachments` and `avatars` are **storage buckets** (`supabase.storage.from('attachments')`), not tables.

Note the *shape* of the drift: several are renames the code never followed — live has `bom_headers`/`bom_items` (not `boms`), `quotation_header` (not `quotations`/`quotation_headers`), `tasks`/`legacy_project_tasks` (not `project_tasks`), `audit_log` + `item_audit_logs` (not `audit_logs`); and for payment requests the **table exists but the five RPCs the module calls do not**, so the fix there is the function layer, not a table.

### D. P1 — the repository cannot reproduce production

205 files in `apps/web/supabase/migrations/`, **149 of them 0 bytes**, including every "fix" migration the earlier reports depended on (`20240101000094_fix_user_can_access_org.sql` and the three `follow_up_*` files). Production has objects (e.g. `user_can_access_org`, the five `follow_up_*` tables, all dispatch policies) that no file in this repo creates. Until the migration history is reconciled with the live schema, any repo-derived review of database behaviour is fiction.

### E. Live advisor surface (634 security / 720 performance)

| Lint | Level | Count |
|---|---|---|
| `anon_security_definer_function_executable` | WARN | **229** |
| `authenticated_security_definer_function_executable` | WARN | 262 |
| `function_search_path_mutable` | WARN | 137 |
| `security_definer_view` | **ERROR** | 4 (`v_party_search`, `v_legacy_clients`, `v_legacy_vendors`, `v_legacy_subcontractors` — and these are precisely the 4 views missing `security_invoker`) |
| `auth_leaked_password_protection` | WARN | 1 (disabled) |
| `extension_in_public` | WARN | 1 (`pg_trgm`) |
| `auth_rls_initplan` | WARN | 386 |
| `multiple_permissive_policies` | WARN | 306 |
| `duplicate_index` | WARN | 28 |

The **229 anon-executable `SECURITY DEFINER` functions** are a larger cross-tenant surface than anything in the original reports — an anon-callable definer function that omits an internal org check bypasses RLS by construction. `deduct_stock` is one of them (`SECURITY DEFINER`, no `search_path` pinned) and it does **not** carry an inline `user_can_access_org` check the way `recalc_vendor_balance` and `follow_up_log_activity` do. This is now the top item requiring per-function review (§6, query 3).

---

## 4. The 11 public tables with no org predicate in any policy

`activity_logs`, `benchmark_runs`, `bom_cost_lines`, `bom_routing_operations`, `item_standard_costs`, `permissions`, `project_collaboration_read_state`, `saved_filters`, `standard_cost_calculation_runs`, `todos`, `warehouse_storage_roles`

Several are legitimately global (`permissions`) or per-user (`saved_filters` → `user_id = auth.uid()`, `activity_logs` → `performed_by = auth.uid()`). But **`bom_cost_lines`, `bom_routing_operations`, `item_standard_costs`, `standard_cost_calculation_runs`, `benchmark_runs` are manufacturing cost data whose live policies contain no org token at all** — RLS never traverses to a parent row, so a parent-scoped intent does not protect them. This is the one place where the original manufacturing concern survives, in a different and narrower form than reported. `todos` also needs a look: its live policies use `created_at IS NOT NULL`, which is not a tenant or owner predicate.

---

## 5. Corrected module verdicts

| Module | Earlier verdict | **Corrected verdict** | Basis |
|---|---|---|---|
| Communication Log | FAIL — "two P0 cross-tenant exposures" | **FAIL (runtime), isolation not the cause** | `client_communication` RLS is correct, but the routed `/client-lookup` write path targets two nonexistent tables and fails 404 |
| Follow-Up Centre | FAIL — "undefined function, missing table, rejected vocabulary" | **FAIL** | Only the third claim holds, and it is confirmed: the activity-log CHECK rejects the module's own event types and the `procurement` tab |
| Manufacturing | FAIL — "12 tables with `USING (true)`" | **FAIL, tenant isolation on dispatch/GRN/requisition/QC is sound** | Refuted for those tables; real issues are the org-less cost tables (§4) and 5 manufacturing RPCs/tables absent from production (§3.C) |
| Purchase | FAIL — "no policy anywhere; browser-side stock deduction" | **FAIL, isolation on audited tables is sound** | Purchase RLS is org- and permission-scoped; remaining confirmed items are the `recalc_vendor_balance` no-op (§3.A) and the missing payment-request / requisition-header RPCs (§3.C) |

---

## 6. Still open, and the queries that close them

**Unverified — no user session was available.** The anon key can only list rows RLS permits (`[]` everywhere), so §32 runtime and §33 multi-tenant tests remain **NOT VERIFIED**; they require two real tenants and a signed-in user. `tsc --noEmit` for `apps/web` still exceeds 10 minutes here and is **NOT RUN**.

1. **Which anon-executable definer functions lack an internal org check** (the real exposure):
```sql
select p.proname, pg_get_function_identity_arguments(p.oid) as args,
       coalesce(array_to_string(p.proconfig,','),'-') as cfg
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prosecdef
  and has_function_privilege('anon', p.oid, 'EXECUTE')
  and pg_get_functiondef(p.oid) not ilike '%user_can_access_org%'
order by 1;
```
2. **Any remaining tenant-boundary gap in policies:**
```sql
select tablename, cmd, qual, with_check from pg_policies
where schemaname='public'
  and coalesce(qual,'') not ilike '%org%' and coalesce(with_check,'') not ilike '%org%'
order by 1;
```
3. **Confirm the activity-log rejection live** (expect a CHECK violation):
```sql
select follow_up_log_activity(
  p_organisation_id => '<org-uuid>', p_event_type => 'procurement_reminder_sent',
  p_tab_source => 'procurement', p_title => 'probe');
```
4. **Decide the intent for the org-less cost tables** in §4 — either add the org predicate or document them as intentionally global.

---

## 7. Reproduce this audit

```bash
cd apps/web                       # CLI 2.113.0, linked to rujqejtisqermjyqqgoj
supabase db advisors --linked --type security
supabase db advisors --linked --type performance
supabase db query --linked "select ..." --output-format json
supabase gen types --linked --lang typescript > /tmp/mep-live-types.ts
# runtime view of what the browser sees:
curl "$VITE_SUPABASE_URL/rest/v1/<table>?select=*&limit=1" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY"
```

**Rule going forward:** production state comes from the linked project (`db query` / `advisors` / `gen types`), never from `supabase/migrations/` or `sql/` in this checkout.
