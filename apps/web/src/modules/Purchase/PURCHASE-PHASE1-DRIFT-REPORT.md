# Phase 1 — Drift Report: live DB vs repository

**Captured:** 2026-09-29
**Live source:** `rujqejtisqermjyqqgoj` (introspected via MCP)
**Repo source:** `apps/web/supabase/migrations/` (262 files) + `apps/web/src/*.sql`
**Method:** catalog queries against `pg_proc` / `pg_policies` / `information_schema.triggers`, then literal name match against both SQL corpora.

---

## Headline

The audit reported **5** orphaned functions. The actual figure is **24**. Drift is also not limited to functions — it extends to **22 policies** and **5 triggers**. The repository cannot reproduce the live database on any of the three object classes.

| Object class | Live (purchase surface) | Reproducible from repo | **Not reproducible** |
|---|---|---|---|
| Functions | 50 | 26 | **24** |
| Policies | 63 | 41 | **22** |
| Triggers | 30 | 25 | **5** |

Repository status: **not reproducible**. Per `.agents/ARCHITECTURE.md` ("Database changes must have a repository source of truth… reconcile it against the live database") and `.agents/ENGINEERING-RULES.md` §11, this is a blocking defect.

---

## 1. Functions — 24 live-only

No migration file and no `src/*.sql` file mentions any of these. They exist **only** in the live database.

### 1.1 Purchase Order / Debit Note / Stock atomic operations

| Function | Identity args | SecDef | Config | Notes |
|---|---|---|---|---|
| `create_purchase_order_atomic` | `(p_organisation_id, p_vendor_id, p_po_date, p_delivery_date, p_reference_no, p_terms_conditions, p_internal_notes, p_delivery_location, p_currency, p_exchange_rate, p_project_id, p_items, p_idempotency_key)` | yes | `search_path=public`, `row_security=off` | Server-side line + GST recomputation, `generate_po_number` call, `created_by = auth.uid()`, idempotency replay |
| `approve_purchase_order_atomic` | `(p_po_id)` | yes | same | Sets `approval_status`, `approved_by = auth.uid()`, Draft→Open |
| `cancel_purchase_order_atomic` | `(p_po_id, p_reason)` | yes | same | Blocks cancel when received qty > 0 or active bills exist |
| `cancel_debit_note_atomic` | `(p_dn_id, p_reason)` | yes | same | Posts reversing GL, calls `recalc_vendor_balance` |
| `process_debit_note_stock_atomic` | `(p_debit_note_id, p_action, p_items)` | yes | `search_path=public` only | `FOR UPDATE` on `item_stock`, writes `material_logs`, idempotent via `debit_notes.stock_reversed` |

### 1.2 Requisition approval chain

| Function | Identity args | SecDef |
|---|---|---|
| `approve_purchase_requisition` | `(p_requisition_id)` | yes |
| `submit_purchase_requisition_for_approval` | `(p_requisition_id, p_actor_id)` | yes |
| `process_purchase_requisition_approval` | `(p_requisition_id, p_action, p_actor_id, p_comment)` | yes |

All three are called from `src/purchase-requisitions/api.ts`. The client-side fallbacks in that file (`:216-319`) exist precisely because these RPCs were missing from some deployments — a client-side reimplementation of a control that already exists server-side.

### 1.3 Goods receipt and verification

| Function | Identity args | SecDef |
|---|---|---|
| `post_goods_receipt` | `(p_organisation_id, p_po_id, p_po_item_id, p_received_qty, p_created_by)` | yes |
| `verify_purchase_bill_3way` | `(p_organisation_id, p_bill_id)` | yes |

`post_goods_receipt` is called from `src/purchase-inquiries/api.ts:223`.

### 1.4 Trigger support functions

| Function | Notes |
|---|---|
| `fn_prevent_posted_purchase_order_mutation` | Backs `trg_prevent_posted_purchase_order_mutation`. Carries the `app.p0_test_running` GUC bypass. |
| `set_updated_at_purchase_requisitions` | Backs two requisition `updated_at` triggers |
| `fn_prevent_active_inward_deletion` | Backs `trg_prevent_active_inward_deletion` on `material_inward` |

### 1.5 Adjacent (out of Purchase scope, listed for completeness)

`decrement_float_balance`, `get_trial_balance`, `issue_stores_requisition_atomic`, `recalc_subcontractor_balances`, and 7 `run_*_forensic_verification_suite` / `run_agent_03_*` test functions.

> **Note on the verification suites.** `run_p0_5_purchase_forensic_verification_suite()` and its six siblings exist live but in no migration. `.agents/VERIFICATION.md` requires recorded evidence; a suite that cannot be rebuilt from the repo cannot be run against a fresh environment. These are verification infrastructure that is currently unreproducible — worth their own decision on whether they are maintained or disposable.

---

## 2. Policies — 22 live-only

### 2.1 The RBAC layer the frontend depends on (13) — `src/*.sql` only, not in migrations

These are the `common_purchase_*` policies that `usePurchaseQueries.ts` and the audit depend on:

`common_purchase_orders_read` · `common_purchase_orders_write` · `common_purchase_orders_edit` · `common_purchase_orders_delete` · `common_purchase_vendors_read` · `common_purchase_vendors_write` · `common_purchase_bills_read` · `common_purchase_bill_items_read` · `common_purchase_order_items_read` · `common_purchase_order_items_write` · `common_purchase_payments_read` · `common_purchase_payment_bills_read` · `common_payment_requests_read` · `common_subcontractor_payments_read` · `approval_actions_users_*` · `approval_approvers_*` · `approval_notifications_*` · `approval_settings_*` · `approval_users_create/view_org_approvals` · `approval_workflows_org_auth` · `approval_workflows_users_view_org`

**These exist only in `src/database-*.sql` — a second, non-reproducible SQL path.** A rebuild from `supabase/migrations/` alone would apply **none** of the RBAC policies.

### 2.2 Tenant isolation, live-only (9)

All use `user_can_access_org(organisation_id)`, `PERMISSIVE`, `cmd=ALL` or command-scoped:

| Table | Policy | cmd |
|---|---|---|
| `purchase_requisitions` | `purchase_requisitions_org_access` | ALL |
| `purchase_requisition_lines` | `purchase_requisition_lines_org_access` | ALL |
| `purchase_release_rules` | `purchase_release_rules_org_access` | ALL |
| `purchase_audit_log` | `purchase_audit_log_org_access` | ALL |
| `purchase_iv_settings` | `purchase_iv_org_access` | ALL |
| `purchase_invoice_verifications` | `purchase_iv_org_access` | ALL |
| `availability_inquiries` | `availability_inquiries_org_access` | ALL |
| `availability_inquiry_lines` | `availability_inquiry_lines_org_access` | ALL |
| `availability_responses` | `availability_responses_org_access` | ALL |
| `goods_receipts` | `goods_receipts_org_access` | ALL |
| `debit_notes` | `debit_notes_tenant_access` | ALL |
| `goods_receipt_notes` | `goods_receipt_notes_tenant_isolation` | ALL |
| `material_inward` | `material_inward_tenant_isolation` | ALL |
| `subcontractor_payments` | `subcontractor_payments_tenant_isolation` | ALL |
| `subcontractor_payments` | `subpay_select_org` / `subpay_insert_org` / `subpay_update_org` / `subpay_delete_org` | per-command |
| `approvals` | `approval_users_update_org_approvals` | UPDATE |
| `approvals` | `approval_users_delete_org_approvals` | DELETE |
| `approval_actions` | `Users can create actions…` / `Users can view actions…` | INSERT / SELECT |
| `approval_notifications` | `Users can create notifications…` | INSERT |
| `approval_workflows` | `Users can view workflows…` | SELECT |
| `approvals` | `Users can create approvals…` / `Users can view approvals…` | INSERT / SELECT |

`debit_notes` currently carries **two** equivalent ALL policies (`debit_notes_tenant_access` and `debit_notes_tenant_isolation`) — a duplicate, harmless under OR but worth noting.

---

## 3. Triggers — 5 live-only

| Table | Trigger | Timing / event | Action function |
|---|---|---|---|
| `purchase_orders` | `trg_prevent_posted_purchase_order_mutation` | BEFORE DELETE, UPDATE | `fn_prevent_posted_purchase_order_mutation` (also live-only) |
| `purchase_requisitions` | `trg_purchase_requisitions_updated_at` | BEFORE UPDATE | `set_updated_at_purchase_requisitions` |
| `purchase_requisition_lines` | `trg_purchase_requisition_lines_updated_at` | BEFORE UPDATE | `set_updated_at_purchase_requisitions` |
| `debit_notes` | `trg_debit_notes_updated_at` | BEFORE UPDATE | `fn_update_updated_at` |
| `material_inward` | `trg_prevent_active_inward_deletion` | BEFORE DELETE | `fn_prevent_active_inward_deletion` |

`fn_update_updated_at` itself does exist in the migration tree — only the trigger binding is missing.

---

## 4. Defect found during extraction: `verify_purchase_bill_3way` is broken at runtime

**Severity: P1 — latent runtime failure.**

The function reads `v_po.grand_total`. `purchase_orders` has no such column (verified: 0 matching columns; the real column is `total_amount`). Because `v_po` is declared `record`, this **compiles successfully** and only fails when executed.

Empirical confirmation:

```
grand_total FAILED: record "v_po" has no field "grand_total"
```

All other column references in the same function were probed and are valid: `v_bill.total_amount` OK, `purchase_iv_settings.qty_tolerance_percent` OK.

**Impact:** any call to `verify_purchase_bill_3way` where the bill has a `po_id` raises `record "v_po" has no field "grand_total"`. Currently `0` of `2` bills in the database have a `po_id`, which is why it has not surfaced. The function is invoked from the UI (`InvoiceVerification.tsx` → `useVerifyPurchaseBill3Way`), so the failure will hit the first real 3-way verification.

This is also load-bearing for the plan: **W3.6 makes `record_purchase_bill` call this function and `RAISE` on failure.** Shipping that before fixing this would block every bill that has a PO. The fix must land in or before the same change.

Correct reference is `v_po.total_amount` (numeric(15,2), default 0), matching `v_bill.total_amount` on the other side of the comparison.

> This is a **correction to the live function**, not a verbatim capture. Phase 1's rule is to reproduce live definitions exactly — but reproducing a known-broken body verbatim, then wiring it into the posting path in Phase 3, would convert a dormant bug into a production outage. Recommendation: capture verbatim in Phase 1 (so the rebuild is faithful), fix in a clearly-labelled follow-up migration, and record both. Flagging for your decision rather than deciding silently.

---

## 5. `generate_po_number` — two live overloads, neither in migrations

```sql
-- overload A
generate_po_number(p_organisation_id uuid)
  SECURITY DEFINER, search_path=public, row_security=off
  SELECT COUNT(*) + 1 FROM purchase_orders WHERE organisation_id = p_organisation_id;
  → 'PO-' || to_char(CURRENT_DATE,'YYYY') || '-' || LPAD(count,4,'0')

-- overload B
generate_po_number(p_org_id uuid, p_year integer)
  NOT security definer, no config
  SELECT COUNT(*) + 1 ... AND EXTRACT(YEAR FROM po_date) = p_year;
  → 'PO-' || p_year || '-' || LPAD(count,4,'0')
```

Differences beyond the signature:

- A counts **all** POs for the org; B counts **per calendar year**.
- A is `SECURITY DEFINER` with `row_security=off`; B is `SECURITY DEFINER=false` with no `search_path` set.
- A has no year component in its counter, so its own numbering is not year-scoped.

Neither is referenced from `apps/web/src`. A is called only by `create_purchase_order_atomic`.

Both use `COUNT(*)+1`, which is **collision-prone under concurrency**: two concurrent creates in the same org read the same count. The repo does have a partial unique index (`idx_purchase_orders_org_po_number`) and `create_purchase_order_atomic` handles `unique_violation`, so a collision is caught and retried — but it surfaces as an error to the user rather than a self-healing retry.

**Recommendation:** keep overload A (it is what `create_purchase_order_atomic` calls and it has the security config), drop overload B, and record that `COUNT(*)+1` remains a known limitation to be addressed with a sequence in Phase 3 when PO creation moves onto this RPC. Dropping B is safe only because nothing references it.

---

## 6. Zero-byte migrations

| File | Size | Status |
|---|---|---|
| `20240101000008_purchase_payment_proforma.sql` | 0 | Empty |
| `20240101000075_purchase_requisition_foundation.sql` | 0 | Empty |
| `20240101000077_purchase_requisition_phase2.sql` | 0 | Empty |

These are dated `20240101…` — far earlier than every other migration (which run `20260715` → `20260928`). They are placeholders for schema that was evidently applied directly to the live database. Their early timestamps mean they sort **before** everything, so anything they should have created is missing from a rebuild.

Per the Phase 0 freeze, the migration tree is append-only — these will not be deleted. Options: fill them with a documented "superseded by X" note, or leave empty and record the gap here. Recommendation: leave empty, record the gap, because inventing content risks masking the real state.

---

## 7. What this means for the plan

The audit's claim that W1 is a prerequisite is **understated**. It is not five functions; it is 51 objects across three classes, and two of the six "known good" purchase functions in the live DB (`post_goods_receipt`, `verify_purchase_bill_3way`) are live-only — one of them broken.

Practical consequences:

1. A rebuild from `supabase/migrations/` today produces a database with **no RBAC policies** on any purchase table, and **no atomic PO/DN/GR operations**. The application would not function.
2. Phase 3 cannot begin until these exist as migrations, because Phase 3's whole premise is "adopt the server functions that already exist."
3. The scratch-rebuild parity diff (Phase 1.7) is the only way to catch drift in **tables and columns**, which this name-matching pass does not cover. Expect further findings there.

## 8. Migrations written

Three files added to `apps/web/supabase/migrations/`. Append-only, per the Phase 0 freeze. No existing migration was modified.

| File | Contents |
|---|---|
| `20260929000001_purchase_phase1_backfill_functions.sql` | 15 `CREATE OR REPLACE FUNCTION` — the 13 purchase functions plus the 2 trigger-support functions. Includes an explicit `DROP FUNCTION IF EXISTS public.generate_po_number(uuid, integer)` for the dropped overload (1e-bis). |
| `20260929000002_purchase_phase1_backfill_policies.sql` | 31 policies (39 `CREATE POLICY` + 39 matching `DROP POLICY IF EXISTS` — the count difference is the carried-forward annotation text). Each preceded by a drop, so the file is idempotent. |
| `20260929000003_purchase_phase1_backfill_triggers.sql` | 5 triggers, each `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER`, binding the functions from file 1. |

Every captured body is **verbatim** from `pg_proc.prosrc` / `pg_policies` / `pg_trigger`. Where a captured definition carries a known defect, the file says so in a header comment naming the defect and the phase that owns the fix. Nothing was silently corrected.

### Validation performed (read-only, no DDL executed against production)

| Check | Method | Result |
|---|---|---|
| Column references in backfilled functions | 24 explicit `(fn, table, column)` probes against `information_schema.columns` | **24/24 resolve** |
| Policy target tables | join `pol` CTE to `pg_class` | **0 missing tables** |
| Policy fidelity | compare each policy in the migration to live `pg_policies` | **31/31 match live** (name, cmd, roles) |
| Trigger target tables | join to `pg_class` | **5/5 exist** |
| Trigger action functions | `pg_proc` with `prorettype = 'trigger'` | **5/5 exist** |
| Trigger live-state | `information_schema.triggers` | **5/5 present live** |
| Policy counts | aggregation | 5 of 31 are `cmd=ALL TO authenticated` — the permissive pattern flagged in §2.1, reproduced not fixed |

The one known-broken reference (`v_po.grand_total`) was found by this method, which is why it was run. It is the only one found; the other 24 all resolve.

### Deliberately NOT done

- **`verify_purchase_bill_3way` was captured broken, not fixed.** It is reproduced verbatim in `20260929000001` so the Phase 1.11 rebuild reproduces production exactly. The fix is a one-line change (`grand_total` → `total_amount`) but it needs explicit approval — a Phase 1 migration that silently improves on production would make the parity diff meaningless and would hide the defect from whoever reads the diff.
- **No table, column, index or constraint changes.** Only functions, policies and triggers.
- **Zero-byte migrations left empty**, per the Phase 0 freeze (migration tree is append-only, and inventing content risks masking the real state).
- **The 7 `run_*_forensic_verification_suite` functions and 4 adjacent functions were not backfilled.** They are outside the Purchase module boundary. They are live-only and unreproducible — that is a real gap, listed in §1.5, but it belongs to whatever owns verification infrastructure, not to a Purchase migration.

---

## 9. Verification still outstanding

- [x] Function-level name diff (50 live / 24 not reproducible)
- [x] Policy-level name diff (63 live / 22 not reproducible)
- [x] Trigger-level name diff (30 live / 5 not reproducible)
- [x] Column-reference validation of captured bodies (24 checked; 1 defect found)
- [x] Migrations written and validated read-only (3 files)
- [ ] **Table + column diff — NOT DONE.** Requires scratch rebuild.
- [ ] **Index + constraint diff — NOT DONE.** Requires scratch rebuild.
- [ ] **Scratch rebuild and full parity diff — BLOCKED, needs cost approval.**
- [ ] **`verify_purchase_bill_3way` fix — awaiting approval.**
- [ ] Grant/ACL diff (`proacl`) — captured for the 5 purchase atomics, not diffed across the board.
- [ ] The 7 live-only verification suites are still unreproducible (§1.5).
