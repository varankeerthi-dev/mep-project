# ERP Control Audit — Purchase Module (Procure-to-Pay)

**Skill:** `erp-audit-strict` v3.0.0 · **Packs applied:** §2 Universal + §3 UX + §4.1 P2P + §5 Fraud + §6 Anti-patterns
**Date:** 2026-09-29 · **Auditor:** static source + migration review (no live DB access)
**Target:** `apps/web/src/modules/Purchase/` (24 files), `apps/web/src/features/purchase-returns/`, `apps/web/src/database-*purchase*.sql`, `apps/web/supabase/migrations/*purchase*|*ap_security*`

> **Evidence basis:** source code and migration files only. No live-database introspection, no config export, no change-log extract, no user-role matrix, no screenshots were supplied. Findings derived from *deployed DDL as written in migrations*. Where live state could differ, the finding is marked **UNVERIFIED** and, per §1, treated as CRITICAL until disproven.

---

## Verdict

**The Purchase module has a strong database security perimeter and a broken financial control environment inside it.**

`20260817000004_purchase_ap_security_hardening.sql` is genuinely good work — tenant isolation, immutable-posted-document triggers, idempotency, server-side recomputation, `SET search_path` on every `SECURITY DEFINER`. Almost none of the *accounting* controls survive contact with the functions that layer on top of it.

The central defect: **the authoritative payment RPC approves and releases its own payment.** Everything else in the approval chain is cosmetic on top of that.

| Severity | Count | Character |
|---|---|---|
| **CRITICAL** | 6 | Fraud/financial-loss enabler, no compensating control |
| **HIGH** | 9 | Control exists on paper only; bypassable by one user or a default |
| **MEDIUM** | 7 | Control functions; UX/logging gaps reduce reliability |
| **LOW** | 3 | Cosmetic / policy-adjacent |

**Do not close the next period until CRITICAL-1, -2 and -3 are fixed.**

---

## CRITICAL

### CRITICAL-1 — `record_vendor_payment` approves and releases its own payment
**§2.2, §4.1 (Invoice post ↔ Payment run release), §5.7** · Confirmed

`20260817000004_purchase_ap_security_hardening.sql:775-776`
```sql
COALESCE(p_payment_mode, 'Bank Transfer'), 'released', 'Released', auth.uid(), NOW(),
auth.uid(), NOW(), p_amount, v_effective_idempotency_key, NOW()
```
`workflow_step='released'`, `approval_status='Released'`, `approved_by = released_by = auth.uid()`.

The maker is the checker. Any authenticated org member can disburse funds and post the GL (`Dr AP / Cr Bank`, `:855-882`) with no second pair of eyes. This violates the explicit SAP F110 baseline in §2.2 — payment run create and release cannot be the same user. There is no threshold logic anywhere in the function.

The UI calls this RPC directly — `usePurchaseQueries.ts:782` and `:1624` — so this is the production path, not a theoretical one.

**Fix:** the RPC must insert `workflow_step='requested'`, `approval_status='Pending'`. Release must move to a separate `release_vendor_payment()` that hard-fails when `auth.uid() = created_by` and requires a second distinct approver above a configured threshold.

---

### CRITICAL-2 — `purchase_returns` is world-writable, tenant-blind, and its RPCs have no auth check
**§2.2, §2.7, §5.6** · Confirmed

`20260922000000_purchase_returns.sql:24,48`
```sql
CREATE POLICY "Enable all access" ON purchase_returns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access" ON purchase_return_items FOR ALL USING (true) WITH CHECK (true);
```
RLS is enabled, then neutralised. `create_purchase_return` (`:53`) and `convert_purchase_return_to_debit_note` (`:118`, re-declared identically in `20260922000001:4`) contain **no `auth.uid()` and no `user_can_access_org()` call** and are not `SECURITY DEFINER`.

Consequence: any authenticated user can create a return against **any `organisation_id`** and convert it to a `debit_notes` row — a credit against another tenant's AP balance. The creator is also client-supplied: `p_created_by UUID DEFAULT NULL` (`:62`), so the audit field is forgeable by design.

`20260817000004` hardened the six core AP tables (`:224-270`) but this migration, dated 2026-09-22, reintroduced the exact pattern it removed.

**Fix:** replace with `user_can_access_org(organisation_id)` policies; add `auth.uid()` guards to both functions; drop `p_created_by` from the signature and assign `auth.uid()` server-side.

---

### CRITICAL-3 — PO approval does not exist; "Submit for Approval" is a status label
**§2.1, §2.2, §4.1** · Confirmed

`APPROVAL_STEPS` is declared at `PurchaseOrders.tsx:79` and referenced nowhere else (1 grep hit — the declaration). The only statuses ever written are `'Draft'` (`:317`) and `'Pending Approval'` (`:330`), both client-chosen.

Consequences chain:
- No approver identity exists, so creator≠approver cannot be enforced.
- `poData` (`:1003-1027`) writes **no `created_by` and no `approved_by`** — the maker is unattributable at row level.
- No "changed since draft" diff exists (UX-3).
- `useUpdatePOStatus` (`:754-770`) takes an arbitrary `status` with no prior-state guard, so a submitted PO is editable with no re-approval.
- Requisition-side approval hooks are dead code: `useApprovePurchaseRequisition` / `useProcessPurchaseRequisitionApproval` are instantiated at `Requisitions.tsx:199-200` with **zero call sites**.

The button labelled "Submit for Approval" at `PurchaseOrders.tsx:2098` provides no control over spend today.

**Fix:** build the approval transition server-side; write `created_by`; reject `created_by = approver` in the trigger; re-enter `Pending` on any post-approval edit.

---

### CRITICAL-4 — Vendor master has no maker-checker and no approval state
**§2.6, §4.1, §5.1, §5.7** · Confirmed

`Vendors.tsx:95` — new vendors are born `status: 'Active'`. There is no draft→pending→approved workflow; `purchase_vendors` has no `approved_by` column at all. One user creates an active, payable vendor.

Bank details are edited through the same unguarded path as every other field: `Vendors.tsx:352-357` strips only `re_enter_account_number` and calls `updateVendor.mutateAsync` with the rest. There is no trigger on `purchase_vendors` (`baseline_triggers.json` lists triggers for bills, orders, payments only), so `bank_account_no / bank_ifsc / account_holder_name` are ordinary columns.

Combined with CRITICAL-1: **one user can create a vendor, set its bank account, and release payment to it.** That is the ACFE #1 vendor-bank-change fraud, fully executable.

Compounding: no UNIQUE on `gstin` (`database-purchase-module.sql:14`) and no duplicate detection — supplier-splitting is undetectable.

**Fix:** vendor approval state with maker-checker; a dedicated `change_vendor_bank()` RPC that flags every open bill/payment for re-approval and writes an immutable bank-change row; UNIQUE on `gstin`.

---

### CRITICAL-5 — Three-way match is advisory and never consulted at posting time
**§2.4, §4.1, §5.5, §5.6** · Confirmed

`verify_purchase_bill_3way` computes variance and ends `RETURN v_status;` — no `RAISE`. `record_purchase_bill` (both the `20260817000004` and superseding `20260923000004` versions) contains **zero** references to it.

A bill with no goods receipt at all (`v_received = 0`) plus any `po_id` produces `qty_variance = 100%`, writes a `'FAILED'` row to `purchase_invoice_verifications`, and **posts anyway**. The verification screen (`InvoiceVerification.tsx`) is a read-only dashboard over that advisory table.

Tolerances are real and surfaced (qty 2%, value 2%, date 7d — `InvoiceVerification.tsx:107-109`), so this is not the "blank tolerance = infinite" CRITICAL. It is the adjacent and arguably worse failure: a live tolerance that nothing enforces. Note the module's own PRD lists "tolerance override with approval trail" as a *missing feature* — correct as a control, and it should stay missing.

**Fix:** call `verify_purchase_bill_3way` inside `record_purchase_bill`; `RAISE EXCEPTION` on `'FAILED'`. If a tolerance override is ever added, it requires a second approver and writes to the audit log.

---

### CRITICAL-6 — Immutability triggers are defeatable by a session GUC
**§2.1, §2.3, §2.4** · Reasoned from source — UNVERIFIED against live DB

`20260817000004:79, 100, 173` all gate on:
```sql
IF current_setting('app.allow_posted_purchase_bill_creation', true) IS DISTINCT FROM 'true' THEN
```
PostgreSQL permits any role to `set_config` an unregistered namespaced GUC, and a session-level call persists. The RPCs set it with `is_local = true` (`:494, 761`), but nothing prevents an external `set_config(..., false)` beforehand. There is no `REVOKE`-guarded helper, no locality enforcement, and no override row written to the audit log.

The trigger's entire value is that a posted document cannot be altered outside the RPC. As written, that property rests on a caller-controlled string.

**Fix:** replace the GUC with a `REVOKE`-guarded helper function that only the RPC owner can execute, and have the trigger require a matching entry in a transaction-local temp table that only the RPC populates.

---

## HIGH

### H-1 — `purchase_audit_log` is mutable by end users and written from the browser
**§2.3** · Confirmed
`purchase_audit_log_org_access` is `cmd=ALL`, so end users can UPDATE and DELETE the audit trail. Worse, it has **no trigger** — every write is a client insert (`usePurchaseQueries.ts:445, 561`). `logPOActivity` (`PurchaseOrders.tsx:496-510`) takes `user_id` and `description` **from the client** and swallows failures at `:507-509` while still showing success at `:1064`. The actor is therefore forgeable and the log is not append-only. SAP baseline is `CDHDR`/`CDPOS`; the equivalent here is advisory only.

### H-2 — Permissive `FOR ALL` policies OR away the RBAC permission layer
**§2.5**
`purchase_vendors` carries both `purchase_vendors_tenant_isolation FOR ALL` (org membership only) **and** `common_purchase_vendors_write FOR ALL` (permission-gated). PostgreSQL ORs permissive policies, so any org member writes regardless of the permission check. Same on `purchase_bills`, `purchase_payments`, `purchase_payment_bills`. Only `purchase_orders` uses command-scoped policies (`common_purchase_orders_write` is `cmd=INSERT`), which is the sole reason the RBAC guard at `20260928000004_rbac_v1_module_guards.sql:50-53` has any effect.

### H-3 — Immutability field allow-lists omit the control-carrying columns
**§2.3** · `20260817000004:127-140` protects bill amounts, tax, vendor, org, bill number, po_id — but not `approval_status`, `payment_status`, `paid_amount`, `balance_amount`, `created_by`. `:204-208` protects payment amount/vendor/org/voucher — but not `is_deleted`, `workflow_step`, `approval_status`. Reverse a posted document to a non-protected status, then edit freely.

### H-4 — Payment approval defaults to off in the UI
**§2.1, §2.4** · `Payments.tsx:103` — `const paymentApprovalEnabled = approvalSettings?.PURCHASE_PAYMENT ?? false;`
A financial control that ships disabled. Even with CRITICAL-1 fixed, any org that never enables this setting has no payment approval at all, with no warning.

### H-5 — "Release funds" is gated by a client-side role check only
**§2.1, UX-1** · `AccountantQueue.tsx:40` — `const canRelease = ACCOUNTANT_ROLES.has(role);`
Hides the button; enforces nothing server-side. A non-accountant can invoke the release mutation directly. The queue's "Restricted access" panel (`:156-160`) implies an enforcement that does not exist.

### H-6 — Advance payment with no bill, no match, no second approver
**§2.4, §4.1, §5.6** · `Payments.tsx:679` — "Advance Payment (Without Bill)" (`isAdvance`, default `false` — correctly not pre-checked). When set, `billAllocations = []` (`:227`) and the full three-way match is skipped, with no extra approval tier. `record_vendor_payment` accepts `p_is_advance BOOLEAN DEFAULT FALSE` (`:639`) without challenge. A user with no invoice can move cash to any vendor.

### H-7 — Split-PO enabler, with no detection
**§4.1, §5.3** · `handleDuplicatePO` (`PurchaseOrders.tsx:863-884`) clones vendor, currency, rate, terms and all priced lines in one click, with no link back to the source PO. No requisition link exists (grep `requisition` in `PurchaseOrders.tsx` → 0 hits), so POs are free-entry. No split/threshold detection anywhere in SQL (grep `split_po|approval_threshold|amount_threshold` → 0 hits). Nothing distinguishes a ₹1 PO from a ₹1 Cr PO (`threshol` → 0 hits).

### H-8 — Backdating unrestricted
**§4.1** · `PurchaseOrders.tsx:1312-1317` — bare `<Input type="date">`, no min/max; `validateForm` checks only non-empty (`:277`, `:289`). No comparison to today or to the invoice date; `deliveryDate` has no `≥ poDate` check. (The dead `PurchaseOrdersV2.tsx:161` does set `minDate={poDate}` — the routed component does not; `PurchaseModule.tsx:27` imports `PurchaseOrders`.)

### H-9 — No role gating on any PO or vendor action
**§2.5** · grep `can(|usePermission|hasPermission|permission|role ===|isAdmin` across `PurchaseOrders*.tsx` and `Requisitions.tsx` → **no matches**. Every authenticated user sees Create PO (`:2159`), Duplicate (`:1178`), Delete PO (`:1194`).

---

## MEDIUM

- **M-1 — Vendors, POs and bills are hard-deletable.** No `is_deleted`/`deleted_at` (`database-purchase-module.sql:6, 47, 128`); soft delete exists on payments only (`20260802:15`). The bill DELETE guard (`:121-125`) only blocks already-approved bills — a `Pending` bill is destructively deletable. §2.6.
- **M-2 — No reason codes on destructive actions.** Confirmation dialog exists (`PurchaseOrders.tsx:2219-2240`) but no reason code and no status gate; Delete is offered for every status. §6, UX-2.
- **M-3 — Audit/filter coverage is thin on POs.** `usePurchaseOrders` supports `{status, vendor_id, search}` (`usePurchaseQueries.ts:356-361`) but only `search` and `page` are passed. No date/amount/status filter, no export, no created-by column. §3 UX-7.
- **M-4 — Client-side balance aggregation races.** `updateVendorBalance` (`usePurchaseQueries.ts:1077-1123`) reads all bills/payments/DNs, reduces in JS, writes back — no lock, no transaction; one call site is fire-and-forget at `:1613`. (Server-side `recalc_vendor_balance` now exists and is trigger-wired — `20260916120000:87-92` — but the client path remains.) §2.3.
- **M-5 — Voucher numbers have no uniqueness guarantee.** `createPaymentVoucherNo` (`usePurchaseQueries.ts:9-14`) is timestamp + 4-char random, no DB constraint on the client path. (PO numbering is fine — `buildPONumber` uses a proper series.) §2.3.
- **M-6 — Silent stock-deduction failure on debit notes.** `DebitNotes.tsx:371-377` swallows the error; the DN saves while inventory silently desynchronises. §2.3.
- **M-7 — Debit notes have `approval_status` but no approve/reject UI.** `DebitNoteView.tsx:311` renders Delete only when Pending; no approval action exists. A credit instrument with no four-eyes. §2.2.

---

## LOW

- **L-1** — Payment voucher creation has no rate limit; §5.15 "urgent bypass" is unreviewable because no urgent/emergency PO flag exists to rate-limit.
- **L-2** — Field labels drift from ERP convention (e.g. "Proforma Invoice" vs "Vendor Invoice"); §6 last row.
- **L-3** — Catch-all handlers surface raw Postgres/RLS text via `err.message` (`PurchaseOrders.tsx:1077`); poor error specificity, §3 UX-5.

---

## What is genuinely well-implemented

Recorded so it is not re-flagged or regressed:

- All ten `SECURITY DEFINER` functions set `search_path` — `:36, 55, 75, 96, 118, 156, 194, 277, 330, 646`; the superseding bill RPC uses `public, pg_temp` (`20260923000004:25`). No search-path escalation.
- Strict tenant RLS genuinely replacing `USING (true)` on the six core AP tables — `:224-270`.
- Idempotency keys + partial unique indexes (`:16-24`) with race-safe `unique_violation` replay (`:514-533, 778-797`).
- `record_purchase_bill` recomputes **all** line amounts server-side from `p_items` (`:444-484`) and ignores client-supplied totals; the 2026-09-23 version adds a **GL balance assertion** that aborts the transaction — `IF ABS(v_total_debit - v_total_credit) > 0.01 THEN RAISE EXCEPTION` (`:457-459`).
- Over-payment is blocked with `FOR UPDATE` row locks (`:737, 747-750`).
- Vendor balance persistence is fixed and trigger-wired across all three source tables (`20260916120000:87-92, 137-153`).
- The RBAC audit-forgery guard is a real control — `AND (action NOT LIKE 'rbac.%')` (`20260928000007:16`).
- **The org's canonical pre-checked-checkbox failure mode is absent from the Purchase module.** `isAdvance` defaults `false`, `roundOff` defaults `false`, no `useState(true)` or `defaultChecked` on any consent control, no `terms_accepted`/`vendor_verified` attestation field exists. The controls that are missing here are missing entirely rather than pre-armed.
- PO save is not optimistic — `toast.success` (`:1064`) strictly follows the awaited mutation.
- Server-side delete blocking when bills/GRNs reference a PO, with an actionable message listing blockers (`usePurchaseQueries.ts:558-560`).
- Real server-side pagination via `.range()` + `count:'exact'` (`:379`); PO-number collision handling auto-draws the next free number (`:1067-1075`).
- Unsaved-changes protection (`isDirtyRef` + `beforeunload`, `:243-271`).
- 3-way match tolerances are explicit, non-null and surfaced to the user (`InvoiceVerification.tsx:107-109`) — not the "blank = infinite tolerance" CRITICAL.

---

## Fraud-library coverage (§5, P2P subset)

| # | Pattern | Status | Where it fails |
|---|---|---|---|
| 1 | Fake vendor | **IGNORED → CRITICAL** | No approval state, no duplicate detection, no gstin UNIQUE (CRITICAL-4) |
| 2 | Duplicate invoice | **IGNORED** | No duplicate detection on vendor+amount+date; only idempotency on the payment path |
| 3 | Split PO | **IGNORED → HIGH** | One-click duplicate, no threshold, no detection (H-7) |
| 4 | Kickback pricing | **PARTIAL** | One-click copy carries stale prices forward; no competitive-bid record |
| 5 | GR without delivery | **IGNORED → CRITICAL** | 3-way match advisory, never blocks posting (CRITICAL-5) |
| 6 | Invoice without GR | **IGNORED → CRITICAL** | Same; a bill with zero receipt posts at 100% variance (CRITICAL-5) |
| 7 | Vendor bank change | **IGNORED → CRITICAL** | No maker-checker, no re-approval, directly exploitable with CRITICAL-1 (CRITICAL-4) |

**4 of 7 P2P fraud patterns are entirely ignored. The skill's rule is explicit: ignore = CRITICAL.**

---

## UX scoring (§3, screens rated)

| # | Heuristic | Score | Note |
|---|---|---|---|
| UX-1 | Affordance honesty | **1/5** | "Release funds" and "Restricted access" imply server enforcement that does not exist (H-5) |
| UX-2 | Destructive-action friction | 3/5 | Confirmation present, no reason code, no status gate (M-2) |
| UX-3 | Approval visibility | **0/5** | No approval step exists (CRITICAL-3) |
| UX-4 | Field-level help | 2/5 | Payment terms, tax code, cost center unexplained inline |
| UX-5 | Error specificity | 3/5 | Per-field Zod messages good; catch-all leaks raw SQL (L-3) |
| UX-6 | Default-danger | **5/5** | No pre-checked safety control found anywhere |
| UX-7 | Search & filter | 2/5 | Single free-text box; no actor column, no export (M-3) |
| UX-8 | Mobile approval ergonomics | 0/5 | No approval action bound to any surface |
| UX-9 | Bulk actions | 1/5 | No selection state in PO table; no bulk preview |
| UX-10 | Latency honesty | **5/5** | No ghost POs; success strictly after server confirm |

Per §3, any score ≤2 is a finding. UX-1, UX-3, UX-4, UX-7, UX-8, UX-9 are findings; UX-1 and UX-3 are control defects, not cosmetic ones.

---

## Remediation order

1. **CRITICAL-1** — split `record_vendor_payment` into request/release; enforce `auth.uid() <> created_by`; threshold-gate. *This one fix closes fraud patterns 5, 6 and 7.*
2. **CRITICAL-2** — RLS + auth guards on `purchase_returns`; drop client-supplied `p_created_by`.
3. **CRITICAL-3** — real server-side PO approval; write `created_by`; re-enter Pending on edit.
4. **CRITICAL-5** — make 3-way match blocking inside `record_purchase_bill`.
5. **CRITICAL-4** — vendor approval state + `change_vendor_bank()` with pending-payment re-approval.
6. **CRITICAL-6** — replace GUC gates with a `REVOKE`-guarded helper.
7. **H-1/H-2/H-3** — make `purchase_audit_log` append-only via trigger; drop the permissive `FOR ALL` policies; close the immutability allow-lists.
8. **H-4/H-5** — default `PURCHASE_PAYMENT` to on; enforce release role server-side.

The module's own remediation plans (`PRD.md`, `PURCHASE_MODULE_REVIEW.md`) are performance, data-integrity and code-health work. **None of them touch CRITICAL-1 through CRITICAL-6** — the existing backlog would not surface a single finding in this report.

---

## Method notes and limits

- The `erp-audit-strict` skill file supplied at `.agents/erp-audittools/erp-audit-strict.md` is **truncated at §7** ("Every audit produces this structure:" — the template body is missing) and has no §8 severity table, §9 tool contracts, §10 reference map or §11 guardrails. Severity here follows the §8 table recovered from the prior `skill_moduleaudit.md` (CRITICAL = fraud/financial-loss enabler with no compensating control; HIGH = paper control bypassable by one user or a default; MEDIUM = control works, reliability reduced; LOW = cosmetic). This report uses that structure as §7's template.
- The skill's `tools/*.py` (extract_config, diff_change_log, sod_matrix, screenshot_ocr) require CSV/Parquet exports and images. **No such inputs were supplied, so no tool was run.** Findings are from manual source and DDL review. Consequences:
  - **SoD could not be tested with a user×transaction matrix** (§2.2) — findings here rest on the absence of any creator/approver guard in code, not on a rendered conflict matrix.
  - **No change-log analysis** — split-PO, off-hours editing, rapid-change and round-number heuristics were assessed structurally only.
  - Per §11, no screenshot was accepted as evidence; none was needed, since source and DDL are primary.
- **Live database state was not inspected.** The migration tree and `baseline_*.json` snapshots partially conflict. Most importantly, `src/database-purchase-module.sql:86` still contains `CREATE POLICY "Enable all access" ON purchase_orders FOR ALL USING (true) WITH CHECK (true)`, and the guard migration `20260928000004_rbac_v1_module_guards.sql` protects `purchase_bills` INSERT but **not** `purchase_orders`. If the permissive policy is live for `purchase_orders`, H-2 escalates to CRITICAL: any authenticated user in any org could read and write POs. **Run `SELECT * FROM pg_policies WHERE tablename LIKE 'purchase%'` first.**
- This is a source review of a development repository, not a production instance. Deployed schema may diverge from the migration tree in either direction.
