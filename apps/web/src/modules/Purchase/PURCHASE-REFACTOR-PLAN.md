# Purchase Module — Architecture Review, Refactor Plan, Risk Assessment

**Date:** 2026-09-29
**Scope:** `apps/web/src/modules/Purchase/` (17 components, 2 hooks files, 4 utils) + the backend surfaces it depends on (`src/purchase-requisitions/api.ts`, `src/purchase-inquiries/api.ts`, `src/approvals/*`, `src/payment-requests/*`)
**Source of truth for schema:** live Supabase `rujqejtisqermjyqqgoj` (introspected 2026-09-29 — 24 purchase tables, 539 public functions, 349 triggers, 995 policies)
**Authorities applied:** `.agents/ARCHITECTURE.md`, `.agents/SECURITY.md`, `.agents/DATA-INTEGRITY.md`, `.agents/VERIFICATION.md`, `.agents/ENGINEERING-RULES.md`, `.agents/CURRENT-STATE.md`
**Status:** Plan only. No code changed. Awaiting approval.

---

## 0. Executive summary

The Purchase module is **not primarily a code-size problem — it is a boundary problem.** A hardened, correct server-side API already exists in the live database (atomic create/approve/cancel RPCs for PO, bill, payment, debit note, plus server-side balance recalculation). The frontend does not call most of it. Instead it performs direct multi-step browser writes for the four money documents, recomputes authoritative financial values in JavaScript, and in four places depends on mutation hooks that were deliberately converted into unconditional `throw` stubs and never replaced.

Three consequences dominate everything else:

1. **Functional regression.** Release-payment and all three bulk-treasury actions are wired to hooks that throw. "Mark Released" cannot succeed. Any org that enables `PURCHASE_PAYMENT` approval cannot record a payment from the Payments screen.
2. **Migration drift is now a hard blocker.** Seven atomic RPCs exist in the live DB with **no migration file** in `apps/web/supabase/migrations/`. The database cannot be rebuilt from the repository. This violates `.agents/ENGINEERING-RULES.md` §11 and `.agents/ARCHITECTURE.md` ("Database changes must be reproducible").
3. **Financial controls are advisory.** Confirmed live: `record_vendor_payment` still writes `workflow_step='released'` with `approved_by = released_by = auth.uid()` in the same statement; `record_purchase_bill` contains **zero** references to `verify_purchase_bill_3way`.

The refactor is therefore sequenced as: **restore function → adopt the existing server boundary → collapse duplicate implementations → split files.** File splitting is last and mechanical; it is not the work that matters.

---

## 1. Current structure

```
modules/Purchase/
  PurchaseModule.tsx              64    12 route tabs, TabErrorBoundary per tab
  hooks/
    usePurchaseQueries.ts       1627    57 exports, 7 sections, god file
    useAuth.ts                     5    re-export
  components/
    PurchaseOrders.tsx          2198  ← list + form + numbering + totals + PDF + attachments
    Requisitions.tsx            1398  ← form + validation + fulfilment stage + localStorage drafts
    Vendors.tsx                 1184  ← master + code series + docs + client link + bulk status
    PaymentsHub.tsx             1149  ← treasury queue (routed at /finance/payments)
    Payments.tsx                1013  ← payment + payment-request forms
    DebitNotes.tsx               896  ← ORPHANED (see §2.1)
    AvailabilityInquiry.tsx      755  ← sourcing board + RFQ
    Bills.tsx                    761  ← AP entry + conversion
    Tracking.tsx                 451  ← ETA + call log (no hooks at all)
    DebitNoteView.tsx            421  ← read-only DN detail + PDF
    PaymentQueue.tsx             271  ← bills-due buckets
    VendorLedgerDialog.tsx       256  ← browser-computed ledger + PDF
    Dashboard.tsx                203  ← sourcing KPIs only
    PurchaseOrdersV2.tsx         203  ← alternate PO form (raw insert)
    DebitNoteViewV2.tsx          190  ← alternate DN form (raw insert)
    InvoiceVerification.tsx      110  ← cleanest file in the module
    AccountantQueue.tsx          162  ← release queue (broken, see §2.2)
  utils/
    pdfGenerator.ts             343
    vendorLedger.ts             307
    validation.ts               148  ← used by Vendors only; PO re-declares its own
    purchasePdfTypes.ts          44
```

**Data flow (current):**

```
Component ──use*Query/Mutation──▶ usePurchaseQueries.ts ──▶ supabase.rpc (7 RPCs)
    │                                                        └─▶ supabase.from (direct, ~30 sites)
    ├──src/purchase-requisitions/api.ts  ──▶ .from + rpc + client fallbacks
    ├──src/purchase-inquiries/api.ts     ──▶ .from + rpc
    ├──src/approvals/integration.ts      ──▶ .from (direct writes on 15 tables)
    └──src/credit-notes/stock-adjustment ──▶ .from('item_stock').update per item
```

---

## 2. Findings, ranked

Severity key: **P0** = funds/control broken or not reproducible · **P1** = correctness bug reachable in normal use · **P2** = structural/quality · **P3** = hygiene.

---

### 2.1 P0 — `DebitNotes.tsx` (896 lines) is unreachable; there is no routed DN creation path

`PurchaseModule.tsx:11` imports `DebitNoteView`, not `DebitNotes`. `PurchaseModule.tsx:31` routes `/purchase/debit-notes` → `DebitNoteView`. `App.tsx:584` routes `/purchase/debit-notes-v2` → `DebitNoteViewV2`.

Grep for `components/DebitNotes'` across `apps/web/src` returns **zero importers**. `DebitNoteView.tsx` has no create action (delete/preview/print only).

**Consequence:** the entire RPC-backed DN creation flow — `useCreateDebitNote` → `record_debit_note`, the rate-difference alerts, the stock deduction — has no live entry point. The only working DN creation UI is `DebitNoteViewV2.tsx:108`, which does a **raw `debit_notes` INSERT** with free-text `dn_number`, no stock movement, no audit log, no idempotency key.

> **Correction to `PURCHASE_MODULE_REVIEW.md` and `ERP-AUDIT-PURCHASE-2026-09-29.md`:** the "DN stale closure" (M-6/#1) and "silent stock-deduction failure" (M-6/#4) findings describe `DebitNotes.tsx:108-169` / `:371-377`. That code is dead. The findings are real as code defects but not user-reachable today. They become reachable the moment the file is re-wired — so they must be fixed *before* re-wiring, not after.

### 2.2 P0 — Release-payment and all bulk treasury actions are wired to `throw` stubs

| Hook | Lines | Wired from |
|---|---|---|
| `useReleasePayment` | `usePurchaseQueries.ts:1515-1531` | `AccountantQueue.tsx:36,52` · `PaymentsHub.tsx:118` |
| `useCreatePaymentWithApproval` | `:1476-1488` | `Payments.tsx:94,236` |
| `useBulkMarkPaid` | `:1732-1746` | `PaymentsHub.tsx:121` |
| `useBulkSoftDelete` | `:1754-1767` | `PaymentsHub.tsx:122` |
| `useBulkResendReapproval` | `:1769-1783` | `PaymentsHub.tsx:123` |

All five `mutationFn`s throw a "use the source-specific RPC" message. The replacement RPCs were never wired.

- `AccountantQueue`'s entire purpose is "Mark Released". It cannot succeed.
- `Payments.tsx:103` reads `approvalSettings.PURCHASE_PAYMENT ?? false`; when true, `:235-236` calls the throwing hook → **guaranteed failure**, and the button still shows "Complete Payment".

### 2.3 P0 — Seven hardened atomic RPCs exist live but are called from nowhere

Verified present in `rujqejtisqermjyqqgoj` with `SECURITY DEFINER`, `SET search_path`, `user_can_access_org()` guards, `FOR UPDATE` row locks and idempotency replay:

| RPC | Live? | Referenced in `apps/web/src` | In `supabase/migrations` |
|---|---|---|---|
| `create_purchase_order_atomic` | yes | 0 | **0** |
| `approve_purchase_order_atomic` | yes | 0 | **0** |
| `cancel_purchase_order_atomic` | yes | 0 | **0** |
| `cancel_vendor_payment_atomic` | yes | 0 | 1 |
| `cancel_purchase_bill_atomic` | yes | 0 | 1 |
| `cancel_debit_note_atomic` | yes | 0 | **0** |
| `process_debit_note_stock_atomic` | yes | 0 | **0** |
| `generate_po_number` | yes (2 overloads) | 0 | 1 (schema only) |

`create_purchase_order_atomic` is materially better than what the frontend does today: it recomputes every line server-side, derives intra/inter-state GST from `organisations.state` vs `vendor.state`, calls `generate_po_number`, writes `created_by = auth.uid()`, honours idempotency with `unique_violation` replay, and inserts PO + lines in one transaction.

`record_purchase_bill`, `record_vendor_payment`, `record_debit_note`, `post_goods_receipt`, `recalc_vendor_balance`, `verify_purchase_bill_3way` all exist and **are** called. So the module has one correct path (bills/DN/GR) and one bypassed path (PO create/approve/cancel, payment release).

### 2.4 P0 — Migration source-of-truth drift (blocking)

Five live RPCs have no migration file. `apps/web/supabase/migrations/` holds 261 files ending at `20260928000008`; the last-named purchase migration is `20260923000004`. `.agents/ARCHITECTURE.md` requires every schema/function/policy change to be identified, reproducible and reconciled against live. `.agents/CURRENT-STATE.md`: "migration files not matching changes executed directly in Supabase" is a named historical risk, still open.

**This must be fixed before any refactor commit lands**, because the refactor depends on those functions.

### 2.5 P0 — Payment RPC approves and releases its own payment (live-confirmed)

`record_vendor_payment`, live `prosrc`:

```sql
INSERT INTO public.purchase_payments (... workflow_step, approval_status,
  approved_by, approved_at, released_by, released_at, released_amount ...)
VALUES (..., 'released', 'Released', auth.uid(), NOW(),
  auth.uid(), NOW(), p_amount, ...)
```

Maker = checker. The GL posting (`Dr AP / Cr Bank`) follows in the same function. Called from `usePurchaseQueries.ts:782` (Payments screen) and `:1624` (AccountantQueue "record payment for approved request"). There is no threshold and no separate release function.

Corroborating live: `cancel_vendor_payment_atomic` exists, but no `release_vendor_payment` or `request_vendor_payment` does.

### 2.6 P0 — 3-way match is advisory; `record_purchase_bill` never consults it

Live check: `record_purchase_bill.prosrc ILIKE '%verify_purchase_bill_3way%'` → **false**. `verify_purchase_bill_3way` returns a status string and never raises. A bill with `po_id` and zero goods receipt posts at 100% variance. `InvoiceVerification.tsx` is a read-only dashboard over an advisory table. Tolerances are real (`purchase_iv_settings`, surfaced at `InvoiceVerification.tsx:107-109`) but unenforced.

### 2.7 P1 — RLS `PERMISSIVE` policies OR away the RBAC layer (live-confirmed)

Live `pg_policies` on the money tables:

| Table | Policies | Effective write gate |
|---|---|---|
| `purchase_orders` | `common_purchase_orders_{read,write,edit,delete}` — command-scoped | ✅ permission enforced |
| `purchase_vendors` | `purchase_vendors_tenant_isolation` **ALL** + `common_purchase_vendors_write` **ALL** | ❌ any org member |
| `purchase_bills` | `purchase_bills_tenant_isolation` **ALL** | ❌ any org member |
| `purchase_payments` | `purchase_payments_tenant_isolation` **ALL** | ❌ any org member |
| `purchase_payment_bills` | `purchase_payment_bills_tenant_isolation` **ALL** | ❌ any org member |
| `purchase_order_items` | `common_purchase_order_items_write` **ALL** + no tenant policy | partial |

PostgreSQL ORs `PERMISSIVE` policies. The `purchase_orders` split is the correct pattern and should be the template for the rest. `purchase_orders` proves the guard works.

### 2.8 P1 — Immutability triggers are defeatable by two session GUCs (live-confirmed)

Every guard function opens with a bypass:

- `fn_prevent_posted_purchase_bill_mutation`, `..._bill_item_...`, `..._payment_...`, `fn_prevent_posted_dn_mutation` → `IF current_setting('app.p0_test_running', true) = 'true' THEN RETURN ...`
- `fn_prevent_posted_purchase_order_mutation` → also `current_setting('app.allow_purchase_order_mutation', true) = 'true'`
- `record_debit_note` → the same GUC waives both the `Not authenticated` and `Unauthorized organization access` raises

Any role can `set_config('app.p0_test_running','true',false)` and every immutability trigger and the DN tenant guard silently disable for that session. The RPCs set their own GUCs with `is_local = true`, which is correct — but nothing prevents an external caller setting them first. `.agents/SECURITY.md`: "Never trust a client-supplied value as a security control."

The allow-lists are also incomplete: `fn_prevent_posted_purchase_bill_mutation` does not cover `payment_status`, `paid_amount`, `balance_amount`, `created_by`, `approval_status`; `fn_prevent_posted_purchase_payment_mutation` does not cover `is_deleted`, `workflow_step`, `approval_status`. A posted document can be reversed to an unprotected status and then edited.

### 2.9 P1 — Two alternate write paths bypass every control

`PurchaseOrdersV2.tsx:118` and `DebitNoteViewV2.tsx:108` do raw `.insert()` on `purchase_orders` / `debit_notes`. Both are routed (`App.tsx:586`, `App.tsx:584`).

Consequences for PO: no `purchase_order_items` rows, no audit log, no series increment, no `created_by`, free-text `po_number` with no uniqueness handling, and **client-computed totals that omit CGST/SGST split, discount, rounding and `total_amount_inr` entirely** (`PurchaseOrdersV2.tsx:67-77`).
For DN: no numbering, no stock movement, no idempotency, no approval path.

### 2.10 P1 — Client-computed financial values are persisted as authoritative

| Site | Defect |
|---|---|
| `PurchaseOrders.tsx:531` | `item.total_amount = taxable` — omits GST, while the header `total` at `:524` includes it. Line sums ≠ document total. |
| `Bills.tsx:297` | line `total_amount = taxable + cgst + sgst` — omits IGST, while header at `:311` includes it |
| `Bills.tsx:686-693` | GST select sets `cgst = gst/2`, `sgst = gst/2` **and** `igst = gst` → tax counted twice |
| `DebitNoteViewV2.tsx:59-69` | single-rate tax, no split, no 2dp rounding |
| `vendorLedger.ts:158-165, 186, 243` | closing balance computed entirely in the browser, then printed into a customer-facing PDF. Server `recalc_vendor_balance` exists and disagrees by construction. |
| `usePurchaseQueries.ts:1190-1230` | `updateBillPaymentStatus` — a client-side balance/status recompute with `catch { console.error }`. **Currently unreferenced** (0 call sites) — dead, delete. |
| `usePurchaseQueries.ts:1179-1188` | `updateVendorBalance` wrapper — **currently unreferenced** (0 call sites) — dead, delete. |

`recalc_vendor_balance` *is* trigger-wired (`trg_sync_vendor_balance` on bills/DN/payments, live) and correct. The client duplicates of it are pure liability.

### 2.11 P1 — Multi-step browser writes with no transaction

| Path | Sequence | Failure mode |
|---|---|---|
| `PurchaseOrders.tsx:984-1081` `handleSave` | storage upload → insert PO → insert items → audit log → activity mirror → read series ×2 → write `document_series` → write `document_settings` | 5+ round trips; series can desync from POs on any failure |
| `PurchaseOrders.tsx:653-673` `persistPOSeries` | writes to **two** tables (`document_series` + `document_settings`) | half-written series → duplicate or skipped numbers |
| `Bills.tsx:322-373` `handleSave` | `record_purchase_bill` RPC → then `useUpdatePOStatus` UPDATE, wrapped in a `catch` that only `console.log`s (`:361-363`) | bill posted, PO never marked Billed |
| `DebitNotes.tsx:391-455` | `record_debit_note` → then `adjustCNStock` **per item** (`credit-notes/stock-adjustment.ts:23-51`, a loop of `item_stock` UPDATEs) with `catch { console.error }` (`:439-441`) and `cnId = ''` | DN exists, inventory silently desynced. **Currently unreachable (§2.1).** |
| `Tracking.tsx:163-197` `updateExpected` | item UPDATE → audit INSERT → activity mirror (last two in silent try/catch) | UI says success; audit trail incomplete |
| `Tracking.tsx:226-277` `saveLog` | 4 writes; UI reports success regardless | same |
| `AvailabilityInquiry.tsx:197-217` | `for` loop of N mutations, one per requisition line | partial fulfillment with no rollback |
| `usePurchaseQueries.ts:1609-1671` `useRecordPaymentForRequest` | RPC payment → separate `payment_requests` UPDATE to `'Paid'` | request stuck non-Paid after funds moved |
| `Vendors.tsx:345-425` `handleSave` | code-gen loop re-reads the **same** stale `docSettings.vendor_current_number` on each of up to 10 attempts, then a separate increment write | race; duplicates under concurrency |

`.agents/DATA-INTEGRITY.md`: "Avoid client-side loops for critical transitions. Do not introduce a second stock-deduction path." `adjust_item_stock` is named there as an unsafe legacy pattern; `DebitNotes.tsx` and `credit-notes/stock-adjustment.ts` both use it. The correct primitive — `process_debit_note_stock_atomic` — exists live and is called from nowhere.

### 2.12 P1 — Two competing numbering systems

| Document | Client implementation | Server |
|---|---|---|
| PO | 4-tier fallback chain across `document_series` + `document_settings` (`PurchaseOrders.tsx:565-673`), pre-generated on form open, `max(existing)+1` with gap detection | `generate_po_number` = `COUNT(*)+1`, **two overloads with different signatures**, live |
| Vendor | `document_settings` series, stale re-read loop (`Vendors.tsx:325-411`) | — |
| Requisition | `COUNT(ilike 'PR-YYMM-%') + 1` (`purchase-requisitions/api.ts:194-208`) | `submit_purchase_requisition_for_approval` |
| Inquiry | `COUNT(ilike 'AI-YY-%') + 1` (`purchase-inquiries/api.ts:234-243`); plus a second variant `AI-<timestamp>` at `:373` | — |
| Debit note | "read latest row, regex trailing digits, +1" (`DebitNotes.tsx:312-333`) | — |

`purchase_payments` has `idx_purchase_payments_org_voucher UNIQUE (organisation_id, voucher_no)` — so the DB already guarantees uniqueness and the client's `createPaymentVoucherNo` (`usePurchaseQueries.ts:13-19`) is now **unused** (0 call sites). Delete it.

### 2.13 P2 — Approval workflow is incoherent; PO approval does not exist

- `APPROVAL_STEPS` (`PurchaseOrders.tsx:79`) — 1 grep hit (the declaration). Dead.
- `useUpdatePOStatus` imported at `PurchaseOrders.tsx:66`, **0 uses**. Only statuses ever written are `'Draft'` and `'Pending Approval'`, both client-chosen. No approver identity, no `created_by`, no maker≠checker.
- `useApprovePurchaseRequisition` (`Requisitions.tsx:199`), `useProcessPurchaseRequisitionApproval` (`:200`), `usePurchaseAuditLogs` (`:202`) — assigned, **never called**. No approve/reject UI on requisitions.
- `useOrgApprovalWorkflows` (`AccountantQueue.tsx:37`) — queried, `workflows` never read.
- `purchase-requisitions/api.ts:210-214` `shouldFallbackFromRpcError` — **client-side fallbacks that rewrite `purchase_requisitions` directly when an RPC is missing** (`:216-319`), including computing `required_approval_level` in JS from `purchase_release_rules`. This re-implements the control in the browser.
- Three approval engines coexist: `approvals/api.ts:288 processApproval`, `approvals/workflow-engine.ts:24 processApprovalAction` (**no auth check at all** — `approverId` is a caller parameter, `ip_address` hardcoded `'127.0.0.1'` at `:182`), `approvals/siteReportApproval.ts:174`.
- `approvals/integration.ts:459` and `:506` destructure a boolean from an object (`const approvalNeeded = await this.checkApprovalNeeded(...)`) → always truthy → `createPurchasePaymentApproval` and `createSubcontractorPaymentApproval` always create an approval regardless of threshold.
- `approvals/integration.ts:868, 874, 920-923` — `checkApprovalNeeded` returns `{ needed: false }` on tenant-resolution failure and swallows all errors. **A DB hiccup silently skips the approval gate.**
- `approvals/api.ts:585` — `case 'purchase_orders'` passes a PO id as `referenceType: 'purchase_payments'`.
- `approvals/api.ts:594` — writes `' APPROVED'` (leading space) to `invoices.status`.
- `approvals/api.ts:424` — direct `follow_up_activity_log` INSERT from the browser. `follow-up/api.ts:331-335` explicitly forbids exactly this ("a direct browser insert must never be used as a fallback"). The approval audit trail is therefore forgeable.

Live RLS note: `approvals` **does** have `approval_users_update_org_approvals` (UPDATE) and `approval_users_delete_org_approvals` (DELETE) in the live DB — better than the repo SQL files suggest. The client engines are unauthenticated, not RLS-blocked.

### 2.14 P2 — Cross-tenant reads through unfiltered master-data queries

`document_templates` queried by `document_type` + `is_default` with **no `organisation_id`**:
- `DebitNoteView.tsx:93-98`, `:123-128`, `:148-153` (triplicated)
- `utils/pdfGenerator.ts:101-106` (last-resort fallback)
- `usePurchaseQueries.ts:1793-1797` — `item_variant_pricing` and `company_variants` fetched without org scoping in the variant-pricing join

`Requisitions.tsx:209-211` — `item_variant_pricing` with no `.eq('organisation_id')`.

### 2.15 P2 — Audit log is mutable and client-authored (live-confirmed)

`purchase_audit_log` has a single `purchase_audit_log_org_access` policy, `cmd=ALL` — end users can UPDATE and DELETE it. No append-only trigger. Writers: `usePurchaseQueries.ts:445, 561`, `PurchaseOrders.tsx:499` (`logPOActivity` takes `user_id`/`description` from the client and swallows failures at `:507-509` while the UI still shows success at `:1064`), `Tracking.tsx:70-84`.

### 2.16 P2 — Tenant resolution is client-side and duplicated three ways

`lib/supabase.ts:40-57` `currentOrgId(userId)` — takes `userId` as a parameter, returns the **first** match (no org-selection state, non-deterministic for multi-org users), no status filter, `catch { return null }`, dynamic `import()` inside the function body. Re-implemented in `workflow-engine.ts:9-18` and `settings-api.ts` (×7 call sites, using `user_organisations` only with `.single()`).

### 2.17 P3 — Vendor master has no maker-checker

`purchase_vendors` live: `status` default `'Active'`, **no `approved_by` column**, **no UNIQUE on `gstin`** (confirmed: indexes are `pkey`, `vendor_code` unique, `org`, `status`). `Vendors.tsx:352-357` strips only `re_enter_account_number` and passes the rest — including `bank_account_no` / `bank_ifsc` / `account_holder_name` — through the same unguarded `updateVendor`. No trigger on `purchase_vendors`.

Combined with §2.5: one user can create an active vendor, set its bank account, and release payment to it.

### 2.18 P3 — Hard deletes and unguarded soft deletes

`purchase_orders`, `purchase_bills`, `purchase_vendors`, `debit_notes`, `payment_requests` have **no `is_deleted` / `deleted_at`** (live column check). `useDeletePO` (`usePurchaseQueries.ts:531-595`) does a 5-table linkage check in the browser then hard-deletes — but `fn_prevent_posted_purchase_order_mutation` already blocks DELETE for `approved|open|completed|partially received|cancelled`, so the browser check and the DB rule can disagree. `useDeleteDebitNote` (`:1164-1175`) deletes by id with no status/org guard; only `fn_prevent_posted_dn_mutation` (Approved/posted/Final) stands in the way, and `DebitNoteView.tsx:313` gates it in the UI only. `useDeletePaymentRequest` (`:1005-1023`) hard-deletes.

### 2.19 P3 — Verification is thin and non-reproducible

`.agents/VERIFICATION.md` requires build → real workflow → data-integrity → RLS/tenant → regression → failure/retry. What exists:

- `approvals/rpc.test.ts` — 67 lines, covers only `approvalTransition` input validation. It is the **only** test file in the approvals directory.
- `src/modules/Purchase` — zero tests.
- Live DB has `run_p0_5_purchase_forensic_verification_suite()` (`SECURITY DEFINER`, 0 args) — a database-side purchase suite. It is not referenced from any migration or test harness in the repo.
- DB migration tree: 261 files, plus 4 **zero-byte** purchase files (`20240101000008_purchase_payment_proforma.sql`, `20240101000075_purchase_requisition_foundation.sql`, `20240101000077_purchase_requisition_phase2.sql`).

### 2.20 P3 — Dead code inventory

| Item | Location | Action |
|---|---|---|
| `DebitNotes.tsx` (896 lines) | whole file | orphaned — decide: re-wire after fixes, or delete |
| `useUpdateVendor` … no — `updateVendorBalance` (`:1179`), `updateBillPaymentStatus` (`:1190`), `createPaymentVoucherNo` (`:13`) | hooks | 0 call sites → delete |
| `useReleasePayment`, `useCreatePaymentWithApproval`, `useBulkMarkPaid`, `useBulkSoftDelete`, `useBulkResendReapproval` | hooks | stubs → replace or remove |
| `approveReq`, `processReq`, `auditLogs` | `Requisitions.tsx:199,200,202` | 0 uses |
| `useUpdatePOStatus` | `PurchaseOrders.tsx:66` | 0 uses |
| `APPROVAL_STEPS` | `PurchaseOrders.tsx:79` | 0 uses |
| `APPROVAL_STEPS`-adjacent `variants` state | `PurchaseOrders.tsx:215` | `setVariants` never called |
| 6 zod validators + helpers | `utils/validation.ts` | imported by `PurchaseOrders.tsx:69-76`, unused there; PO re-declares inline zod at `:287-299` |
| `generateBillPDF`, `openPDFPreview` | imported `Bills.tsx:55` | never invoked |
| `withResponses` | `Dashboard.tsx:22-24` | always `false` |
| "Pay" button | `PaymentQueue.tsx:180-188` | no `onClick` |
| `sendPDFByEmail` | `utils/pdfGenerator.ts:357-362` | `console.log` stub |
| `ApprovalWorkflow` type | `AccountantQueue.tsx:9` | unused |

---

## 3. Refactor plan

Six workstreams. **Each is a separate PR, independently verifiable, in this order.** W1 and W2 are prerequisites for everything else.

---

### W1 — Make the database reproducible (P0, blocking, prerequisite)

Nothing else can be trusted until the DB rebuilds from the repo.

1. Dump the live definitions of the five orphaned RPCs (`create_purchase_order_atomic`, `approve_purchase_order_atomic`, `cancel_purchase_order_atomic`, `cancel_debit_note_atomic`, `process_debit_note_stock_atomic`) and the two `generate_po_number` overloads.
2. Resolve the duplicate `generate_po_number(uuid)` vs `generate_po_number(uuid, integer)` — pick one, `DROP` the other. `COUNT(*)+1` is collision-prone under concurrency; prefer a sequence or the `document_series` table the client already maintains.
3. Write `apps/web/supabase/migrations/20260929NNNNN_purchase_atomic_rpc_backfill.sql` containing exactly those definitions, `DROP FUNCTION IF EXISTS` first.
4. Replace the three 0-byte purchase migration files with real content or delete them from the tree.
5. **Verification:** provision a scratch Supabase project, apply all 262 migrations, and diff `pg_proc`/`pg_policies`/`information_schema.triggers` against production. Zero unexplained deltas on purchase objects.

**Do not proceed to W2+ until this passes.**

---

### W2 — Restore function (P0)

Target: every currently-routed button succeeds.

| # | Change | Where |
|---|---|---|
| 2.1 | Wire `useReleasePayment` to a real server path. Two options: (a) call the existing `record_vendor_payment` with an explicit release RPC, or (b) since `record_vendor_payment` already self-releases (§2.5), make `AccountantQueue` call `paymentRequestRpc.release` for the request path and delete the vendor-payment release UI that has no server primitive. **Decision needed** — see §5. | `usePurchaseQueries.ts:1515-1531`, `AccountantQueue.tsx:52`, `PaymentsHub.tsx:118` |
| 2.2 | Remove or replace `useBulkMarkPaid`, `useBulkSoftDelete`, `useBulkResendReapproval`. If the product still wants bulk, each needs its own audited RPC — that is W4, not W2. Until then, hide the actions rather than ship buttons that throw. | `PaymentsHub.tsx:121-123` |
| 2.3 | Fix the `PURCHASE_PAYMENT` branch: when approval is enabled, the path must be `createPaymentRequest` → approve → record. Do not call a throwing hook. | `Payments.tsx:103, 235-241` |
| 2.4 | Fix the hard source-bill requirement: `useCreatePaymentRequest` throws unless `source_bill_id`/`bill_id`/`bill_ids[0]` is present (`usePurchaseQueries.ts:881-884`); `Payments.tsx:886-897` sends none → **every Payment Request created from the Payments screen fails**. Either populate the field or surface the constraint in the UI. | `usePurchaseQueries.ts`, `Payments.tsx` |
| 2.5 | Delete the 5 dead helpers (`updateVendorBalance`, `updateBillPaymentStatus`, `createPaymentVoucherNo`, and the unused imports they force). | `usePurchaseQueries.ts:13,1179,1190` |
| 2.6 | Give the "Pay" button in `PaymentQueue.tsx:180-188` a handler or remove it. | `PaymentQueue.tsx` |

**Verification:** real-accountant scenario — create bill → create payment request → approve → release → confirm `purchase_payments.workflow_step='released'`, `purchase_bills.payment_status` updated, GL entry posted, vendor ledger agrees with `purchase_vendors` balance. Plus a double-click retry confirming idempotency.

---

### W3 — Move the boundary server-side (P0/P1)

Adopt what already exists. No new architectural pattern — `.agents/ARCHITECTURE.md` §"Architecture changes".

| # | Change | Replaces |
|---|---|---|
| 3.1 | PO create/update → `create_purchase_order_atomic`. Delete the client PO-number series, `getPOSeriesNumber`, `resolveNextPONumber`, `persistPOSeries`, and the `document_series`/`document_settings` writes. | `PurchaseOrders.tsx:565-673, 984-1081` |
| 3.2 | PO approve / cancel → `approve_purchase_order_atomic` / `cancel_purchase_order_atomic` with a reason code. Remove `useUpdatePOStatus` (0 uses) and the client role gate. | `PurchaseOrders.tsx:66,79` |
| 3.3 | Bill save → single `record_purchase_bill` call. Move the PO status transition **into the RPC** (it already receives `p_po_id`) and delete the trailing `useUpdatePOStatus` + its swallowing catch. | `Bills.tsx:322-373` |
| 3.4 | Debit note stock → `process_debit_note_stock_atomic(dn_id, 'deduct', items)` inside the DN transaction. Delete the `adjustCNStock` per-item loop and `adjust_item_stock` usage. | `DebitNotes.tsx:438`, `credit-notes/stock-adjustment.ts` |
| 3.5 | Payment release split: `record_vendor_payment` must insert `workflow_step='requested', approval_status='Pending'`; add `release_vendor_payment(p_payment_id)` that hard-fails when `auth.uid() = created_by` and requires a second distinct approver above a configured threshold. | §2.5 |
| 3.6 | Call `verify_purchase_bill_3way` inside `record_purchase_bill`; `RAISE EXCEPTION` on `'FAILED'`. If tolerance override is ever added, it needs a second approver + audit row. | §2.6 |
| 3.7 | Replace the GUC gates with a `REVOKE`-guarded helper only the RPC owner can execute. Remove `app.p0_test_running` from production function bodies entirely. Close the allow-lists to include `payment_status`, `paid_amount`, `balance_amount`, `approval_status`, `workflow_step`, `is_deleted`, `created_by`. | §2.8 |
| 3.8 | Make `purchase_audit_log` append-only via trigger; `REVOKE UPDATE, DELETE`. Force `actor_id = auth.uid()` server-side; stop passing `user_id`/`description` from the browser. Route through `follow_up_log_activity` like the follow-up module does. | §2.15, `approvals/api.ts:424` |
| 3.9 | Vendor bank change → dedicated `change_vendor_bank()` RPC that flags open bills/payments for re-approval and writes an immutable change row. Add `UNIQUE (organisation_id, gstin)`. Add vendor approval state (`approved_by`). | §2.17 |

**Verification:** for each, per `.agents/VERIFICATION.md` — (a) happy path produces correct state; (b) failure produces no partial state; (c) repeat request does not duplicate; (d) concurrent requests preserve invariants; (e) cross-tenant org B cannot read/write org A's rows via forged UUID; (f) a non-permitted role is denied **server-side**, not merely hidden.

---

### W4 — Collapse duplicates (P1)

| # | Change |
|---|---|
| 4.1 | Decide the fate of `PurchaseOrdersV2.tsx` and `DebitNoteViewV2.tsx`. If retained, route their saves through the W3 RPCs. If not, delete them and the `/purchase/orders-v2`, `/purchase/debit-notes-v2` routes. Two live financial write paths with different models is not a survivable state. |
| 4.2 | Decide the fate of `DebitNotes.tsx` (§2.1). Preferred: fix the stale closure at `:204-266` (the `materialOptionsRef` at `:201-202` is declared but the handler at `:244` reads `materialOptions` directly, and the dep array at `:266` lists the ref, which is a no-op), surface the stock-deduction failure instead of `console.error` (`:439-441`), then re-wire `/purchase/debit-notes` to it and delete `DebitNoteViewV2`. |
| 4.3 | Delete the client-side fallbacks in `purchase-requisitions/api.ts:210-319` that recompute `required_approval_level` in JS. If the RPC is missing, that is a deployment defect — fail loudly, as `follow-up/api.ts:331-335` does. |
| 4.4 | Pick one approval engine. Retire `workflow-engine.ts` (no auth check, spoofable `approver_id`, hardcoded `ip_address`, broken import at `:1`) and `siteReportApproval.ts`. Fix the boolean destructure at `approvals/integration.ts:459,506`, the fail-open tenant fallback at `:868,874,920-923`, the reference-type mismatch at `approvals/api.ts:585`, and the `' APPROVED'` literal at `:594`. |
| 4.5 | Add `organisation_id` filters to every `document_templates` query; collapse the triplicated block in `DebitNoteView.tsx:93-153` into one helper. |
| 4.6 | Soft delete: add `is_deleted` / `deleted_at` to vendors, POs, bills, DNs, payment requests. Point deletes at `cancel_*_atomic` with a mandatory reason code. |
| 4.7 | Role checks: replace the duplicated `ACCOUNTANT_ROLES` literals (`AccountantQueue.tsx:24-40`, `PaymentsHub.tsx:51-126`) with the existing `app_has_org_permission(org, permission_key)` / `app_has_org_permission(org,'purchase_orders.delete')` / `'purchase_orders.edit'` / `'purchase_vendors.edit'` helpers — and apply the `purchase_orders` policy shape to `purchase_vendors`, `purchase_bills`, `purchase_payments`, `purchase_payment_bills`. |

---

### W5 — Correct the financial math (P1)

Server-side is the authority; the client only displays.

| # | Change |
|---|---|
| 5.1 | One GST model. Currently duplicated 5× with 5 semantics: `usePurchaseQueries.ts:1234-1306`, `PurchaseOrders.tsx:513-553`, `Bills.tsx:288-320`, `DebitNotes.tsx:77-88`, and the single-rate V2 versions. Extract a shared pure module; make intra/inter-state derivation match `create_purchase_order_atomic` (which reads `organisations.state` vs `vendor.state`). |
| 5.2 | Fix `PurchaseOrders.tsx:531` (line total excludes GST) and `Bills.tsx:297` (line total excludes IGST). |
| 5.3 | Fix `Bills.tsx:686-693` — the GST select triple-counts. |
| 5.4 | Delete `utils/vendorLedger.ts`'s balance computation (`:158-165, 186, 243`) in favour of a server ledger view/RPC; the PDF must print the server's number, not the browser's. |
| 5.5 | Make the vendor ledger closing balance reconcile with `recalc_vendor_balance` — a test, not a code change. |

---

### W6 — Split the files (P2, last, mechanical)

Only after W1–W5 land, so the split does not churn lines that are about to change. Target: no file over ~600 lines.

```
modules/Purchase/
  PurchaseModule.tsx
  hooks/
    index.ts                        barrel (re-export)
    useVendorQueries.ts              useVendors, useCreate/UpdateVendor, useVendorHolds, useVendorLedger
    usePurchaseOrderQueries.ts       list/detail/create/update/delete/approve/cancel
    usePurchaseBillQueries.ts        list/create
    usePaymentQueries.ts             payments, release, record-for-request
    usePaymentRequestQueries.ts      PR create/approve/update/delete/resend
    useRequisitionQueries.ts         requisitions, approval, audit logs
    useInquiryQueries.ts             sourcing board, availability inquiries, GR
    useDebitNoteQueries.ts           DN list/create/delete
    useSharedPurchaseQueries.ts      material options, IV settings/verifications
    shared.ts                        calculateGST, calculateLineTotal, calculatePOTotals, query keys
  components/
    vendors/{Vendors.tsx, VendorForm.tsx, VendorDocuments.tsx, VendorCodeSeries.ts}
    requisitions/{Requisitions.tsx, RequisitionForm.tsx, RequisitionLinesTable.tsx, FulfilmentStage.tsx}
    sourcing/{AvailabilityInquiry.tsx, SourcingBoard.tsx, VendorResponsePanel.tsx, StoreVsPurchaseSplit.tsx}
    orders/{PurchaseOrders.tsx, PurchaseOrderForm.tsx, PurchaseOrderItems.tsx, PurchaseOrderTotals.tsx, PurchaseOrderPdf.tsx}
    bills/{Bills.tsx, BillForm.tsx, BillTotals.tsx}
    verification/InvoiceVerification.tsx
    debit-notes/{DebitNotes.tsx, DebitNoteForm.tsx, DebitNoteView.tsx}
    payments/{Payments.tsx, PaymentForm.tsx, PaymentRequestForm.tsx, PaymentsHub.tsx, AccountantQueue.tsx, PaymentQueue.tsx}
    ledger/VendorLedgerDialog.tsx
    tracking/Tracking.tsx
    dashboard/Dashboard.tsx
  utils/
    validation.ts                    (keep; now actually used by the forms)
    gst.ts                           single GST model (5.1)
    numbering.ts                     server-issued only; delete client series
    pdf/…
```

Extract **forms and dialogs first** — highest churn from W3–W5.

---

### W7 — Verification layer (P1, in parallel with W1–W3)

`.agents/VERIFICATION.md` compliance:

| Layer | Concrete evidence |
|---|---|
| Build/typecheck | `pnpm --filter=web build` clean |
| Real workflow | scripted P2P walkthrough: requisition → approval → sourcing → PO → approve → GRN → bill → 3-way → payment request → approval → release → vendor ledger. Record evidence. |
| Data integrity | per-W3 item: partial failure, double-submit, concurrent submit, cancel-after-post |
| Authorization | live SQL assertions per table: org A user denied on org B; non-permitted role denied by **RPC**, not by UI; forged UUID rejected |
| RLS snapshot | capture `pg_policies` for all 24 purchase tables before/after; diff must be exactly the intended change |
| Migration | scratch-project rebuild diff (W1) |
| Regression | `approvals/rpc.test.ts` stays green; add `usePurchaseQueries` RPC-contract tests |

Add real tests — today only one 67-line test file guards the entire approvals surface.

---

## 4. Risk assessment

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | W3 changes the PO write path and existing POs have client-computed totals that disagree with server totals | **High** | Silent historical variance; PO/bill/GL mismatch | Before switching, run `create_purchase_order_atomic`'s math over all existing non-cancelled POs and diff. Report deltas; do not silently rewrite. Reconcile bills first. |
| R2 | Splitting `record_vendor_payment` into request/release breaks `useRecordPaymentForRequest` (`:1609-1671`), which passes `p_is_advance = true` and empty allocations | **High** | Payments silently stop posting, or post unallocated | Treat 2.5 + 3.5 as one change with a dedicated regression test. Migrate the advance/empty-allocation path explicitly. |
| R3 | Vendor ledger figure changes from browser-computed to server-computed | **High** | Customer-visible PDFs differ; finance distrusts the change | Ship server-side ledger **behind a comparison view first**; show both for one cycle. |
| R4 | RLS tightening on vendors/bills/payments breaks users who have been relying on the permissive OR | **Medium** | Existing users lose write access | Enumerate every org role against `role_permissions` before applying. Roll out per-org. |
| R5 | Removing the GUC bypasses breaks the DB-side verification suites (`run_p0_5_purchase_forensic_verification_suite`) | **Medium** | Suites error instead of passing | Move test-mode into a `REVOKE`-guarded helper only the suite owner can call. Run the suites before and after. |
| R6 | Removing the `purchase-requisitions` client fallbacks surfaces missing RPCs in prod | **Medium** | Requisition approval stops working in orgs that were silently on the JS path | Confirm the RPCs are live in every org's DB (they are per-DB, not per-org) before removing. |
| R7 | Splitting the 1627-line hooks file touches every consumer | **Medium** | Wide blast radius, merge conflicts | Barrel-export from `hooks/index.ts` so no component import changes. Pure move, no logic edits. |
| R8 | Deleting `PurchaseOrdersV2`/`DebitNoteViewV2` breaks users on those routes | **Medium** | 404s; possibly lost unsaved work | Confirm usage (no telemetry available — ask the product owner). If uncertain, keep the routes and route them through W3 RPCs instead. |
| R9 | `DebitNotes.tsx` re-wiring revives a latent bug (the `materialOptionsRef` no-op dep) | **Low** (file is dead) | High once live | Fix `:244` and `:266` **before** re-wiring. |
| R10 | Migration backfill (W1) is applied to production with drifted definitions | **Medium** | Production breakage | Apply W1 to a scratch project, diff, then apply to production in a maintenance window. W1 is additive `CREATE OR REPLACE` — no table changes. |
| R11 | `purchase_orders` `status` free-text means server and client disagree on the lifecycle vocabulary | **Medium** | Cancel/approve races | Before W3, normalise `status` and `approval_status` to a CHECK constraint or enum. |
| R12 | Scope creep — W6 file splitting consumes the release | **High** | W1–W3 slip | W6 is explicitly last and separately scheduled. W1–W3 are the security/integrity work; they are not optional. |

---

## 5. Decisions needed before implementation

1. **W2.1 — what is the release path?** The DB has `record_vendor_payment` (self-releasing) and `cancel_vendor_payment_atomic`, but no `release_vendor_payment`. Options: (a) build `release_vendor_payment` properly (part of W3.5) and wire the UI to it; (b) collapse the vendor-payment release UI and route everything through `payment_request_release`. **(a) is recommended** — it keeps the accountant workflow and is the only option that also closes CRITICAL-1.
2. **4.1 — keep or kill the V2 forms?** Needs the product owner's call. Retaining them means a third financial model.
3. **4.2 — keep or kill `DebitNotes.tsx`?** Same question, lower stakes.
4. **W7 — is a scratch Supabase project available for the W1 rebuild diff?** Without it, W1 cannot be verified and the DB stays non-reproducible.
5. **R4 — is there a user list with roles per org**, so RLS tightening can be staged?

---

## 6. Recommended execution order

```
W1  migrations reproducible        ─┐  blocking prerequisite
W7  verification layer (partial)   ─┘
W2  restore broken functions          P0, restores shipped behaviour
W3  move boundary server-side         P0/P1, uses the W1 functions
W4  collapse duplicates               P1, after W3 so V2s can route to RPCs
W5  financial math                    P1
W6  file splitting                    P2, last
```

W1 → W2 → W3 → W4 → W5 → W6, with W7 running alongside from the start.

**W1 and W2 are not optional and not reorderable.** W1 because five functions the refactor depends on exist only in the live database. W2 because four routed UI actions currently throw.
