# PURCHASE — Production Audit Report

> **⚠ CORRECTED 2026-09-16 — see `MODULE-AUDIT-LIVE-DB-VERIFICATION-2026-09-16.md`.**
> The headline finding is **refuted**: live `purchase_orders` (4 policies, `app_has_org_permission(organisation_id,'purchase_orders.create/edit/delete')`), `purchase_order_items`, `purchase_requisitions(_lines)`, `purchase_audit_log` and the vendor/bill/payment tables are all tenant- and permission-scoped. **Confirmed live:** `recalc_vendor_balance` computes the balance and never persists or returns it (the deployed body ends at the assignment), and the payment-request module's five RPCs plus `update_purchase_requisition_header_status` do not exist in production, so those call paths 404 even though the `payment_requests` table does exist. The browser-side read-modify-write stock deduction in `fulfillFromStoreLine` remains a static code finding, not reproduced.

**Standard:** `MODULE_REFERENCE_PATTERN.md` (audit-only mode, §36).
**Date:** 2026-09-16
**Scope:** Purchase module — vendors, purchase orders, requisitions, availability inquiries, goods receipt, bills (AP), debit notes, vendor payments, payment requests, invoice verification.
**Evidence basis:** repository only — **superseded**: the live database was subsequently read (see `MODULE-AUDIT-LIVE-DB-VERIFICATION-2026-09-16.md`).

---

## Executive Status

```text
FAIL
```

Purchase Orders, requisitions and availability inquiries have no tenant-isolation policy anywhere in the repository, and the store-fulfilment path performs inventory deductions with read-modify-write updates issued directly from the browser.

---

## Module Inventory

| Area | Findings |
|---|---|
| Module shell | `modules/Purchase/PurchaseModule.tsx` |
| Components | 13 — Dashboard, Vendors, PurchaseOrders (2,290 lines), PurchaseOrdersV2 (217), Requisitions (1,505), AvailabilityInquiry (803), Bills (803), InvoiceVerification, DebitNotes (953), DebitNoteView (447), DebitNoteViewV2 (203), Payments (1,062), PaymentsHub (1,219), PaymentQueue, AccountantQueue, VendorLedgerDialog |
| Hooks / API | `modules/Purchase/hooks/usePurchaseQueries.ts` (1,750 lines — all queries and mutations), `hooks/useAuth.ts`, `pages/CreatePO.tsx`, `purchase-requisitions/api.ts` (437), `purchase-inquiries/api.ts` (492), `payment-requests/*`, `approvals/*` |
| Utils | `pdfGenerator.ts` (320), `purchasePdfTypes.ts`, `validation.ts` (zod), `vendorLedger.ts` (341) |
| Database tables | `purchase_vendors`, `purchase_orders`, `purchase_order_items`, `purchase_requisitions`, `purchase_requisition_lines`, `purchase_release_rules`, `availability_inquiries`, `availability_inquiry_lines`, `availability_responses`, `purchase_audit_log`, `purchase_bills`, `purchase_bill_items`, `purchase_invoice_verifications`, `purchase_iv_settings`, `debit_notes`, `debit_note_items`, `purchase_payments`, `purchase_payment_bills`, `payment_requests` |
| RPCs | `record_purchase_bill`, `record_vendor_payment`, `record_debit_note`, `verify_purchase_bill_3way`, `recalc_vendor_balance`, `generate_next_purchase_bill_number`, `generate_next_payment_voucher_number`, `post_goods_receipt`, `approve_purchase_requisition`, `submit_purchase_requisition_for_approval`, `process_purchase_requisition_approval`, `update_purchase_requisition_header_status`, `paymentRequestRpc.create/approve`, `approvalTransition` |
| Integrations | Approvals engine, accounting (journal entries, AP 2100, bank 1200 / cash 1300), inventory (`item_stock`), materials/variants, subcontractor payments, PDF generation, mobile purchase screen |
| Exports | PO PDF (`proGridPurchaseOrderPdf.ts`), vendor ledger, bill/payment PDFs |
| Mobile | `apps/mobile/src/screens/PurchaseModule.tsx` (243 lines — read-only PO + requisition list) |
| Migrations | `20260817000004_purchase_ap_security_hardening.sql` (excellent, AP only), `20260817000003` (debit notes), `20260910000000_add_po_authorized_signatory.sql`, `20260912000000_document_number_unique_indexes.sql`; **0-byte placeholders:** `20240101000008_purchase_payment_proforma`, `..._00015_procurement_module`, `..._00075_purchase_requisition_foundation`, `..._00077_phase2`, `..._00078_availability_inquiry_phase3`, `..._00079_phase4_po_gr_linking`, `..._00080_phase5_release_and_audit`, `..._00081_phase6_invoice_verification`, `..._00084_requisition_header_status_trigger` |

---

## P0 Findings

### P0-1 — Purchase Orders, requisitions and availability inquiries have no tenant boundary

The AP half of the module was hardened in `20260817000004_purchase_ap_security_hardening.sql` §6, which replaces permissive policies with:

```sql
CREATE POLICY purchase_bills_tenant_isolation ON public.purchase_bills
  FOR ALL TO authenticated
  USING (public.user_can_access_org(organisation_id))
  WITH CHECK (public.user_can_access_org(organisation_id));
```

…for `purchase_bills`, `purchase_bill_items`, `purchase_vendors`, `purchase_payments`, `purchase_payment_bills`, `payment_requests` — and `20260817000003` does the same for `debit_notes`.

**The rest of the module was never hardened.** The only definitions in the repository are the ad-hoc scripts:

- `apps/web/src/database-purchase-module.sql:86, 123` — `purchase_orders` and `purchase_order_items` get
  `CREATE POLICY "Enable all access" ... FOR ALL USING (true) WITH CHECK (true)`;
- the requisition / availability-inquiry tables (`purchase_requisitions`, `purchase_requisition_lines`, `purchase_release_rules`, `availability_inquiries`, `availability_inquiry_lines`, `availability_responses`, `purchase_audit_log`) are created only by the phase scripts whose migrations (`20240101000075/077/078/079/080/081/084`) are **0 bytes**, and a repository-wide grep finds **no policy and no `ENABLE ROW LEVEL SECURITY`** for any of them.

Consequence: any authenticated user of any tenant can read, create, modify and delete other tenants' purchase orders and order lines, requisitions and lines, vendor quotes (availability responses) and purchase audit logs through PostgREST. The frontend filters by `organisation_id` everywhere, which Rule 1 rejects as the boundary.

### P0-2 — `fulfillFromStoreLine` deducts inventory from the browser

`apps/web/src/purchase-inquiries/api.ts` (`fulfillFromStoreLine`):

```ts
const { data: stockRows } = await supabase.from('item_stock')
  .select('id, warehouse_id, current_stock')
  .eq('item_id', itemId).eq('organisation_id', organisationId).gt('current_stock', 0)
  .order('current_stock', { ascending: false });

for (const row of stockRows || []) {
  const deduct = Math.min(remaining, Number(row.current_stock));
  await supabase.from('item_stock')
    .update({ current_stock: Number(row.current_stock) - deduct, updated_at: ... })
    .eq('id', row.id);         // read-modify-write, no lock, no ledger, no idempotency
  remaining -= deduct;
}
// then updates purchase_requisition_lines and calls update_purchase_requisition_header_status
```

This is the §19 failure mode in its worst form:

- **lost updates** — two concurrent issues read the same `current_stock` and the later write wins, over-issuing stock;
- **no accounting/movement record** — a direct column write bypasses `stock_movements` / `execute_warehouse_transfer` / GL posting;
- **partial application** — if the update fails on the third warehouse row, the earlier deductions are already committed and the requisition line is never updated;
- **no idempotency** — a retried click deducts again.

The Purchasing "source from store" action can therefore corrupt inventory silently. This is the only place in the four modules reviewed where **stock is mutated outside a database function**; the manufacturing and warehouse modules both use RPCs.

---

## P1 Findings

### P1-1 — `recalc_vendor_balance` no longer writes anything

`20260715_recalc_vendor_balance.sql` (the earlier definition) computed the balance **and persisted it**:

```sql
UPDATE purchase_vendors SET current_balance = v_current_balance WHERE id = p_vendor_id AND organisation_id = p_organisation_id;
```

`20260817000004_purchase_ap_security_hardening.sql:273-315` re-defines the same function — and since it is the later migration, it wins:

```sql
v_balance := v_total_bills - v_total_debits - v_total_paid;
RETURN;                      -- v_balance is never written anywhere
```

Both `record_purchase_bill` (line 616) and `record_vendor_payment` (line 885) call `PERFORM public.recalc_vendor_balance(...)` and discard the result. `usePurchaseQueries.ts:1103-1111` (`updateVendorBalance`) also calls the RPC.

Net effect: the authoritative vendor-outstanding figure is computed and thrown away, so `purchase_vendors.current_balance` stops tracking bills/payments/debit notes. Vendor ledgers derived from the column (or from a stale value) silently drift. This is a regression introduced by a security migration and it is invisible in logs.

### P1-2 — Multi-level approval is implemented in the browser, with a fallback that triggers on authorization errors

`apps/web/src/purchase-requisitions/api.ts`:

```ts
function shouldFallbackFromRpcError(error: any) {
  const code = String(error?.code || '');
  const msg = String(error?.message || '').toLowerCase();
  return code === '42P01' || code === '42883' || msg.includes('not found') || msg.includes('could not find');
}
```

`processPurchaseRequisitionApproval`, `submitPurchaseRequisitionForApproval` and `approvePurchaseRequisition` each call their RPC and, when the error matches, fall back to client-side implementations:

- `processPurchaseRequisitionApprovalFallback` — reads `current_approval_level` / `required_approval_level` and **directly updates** `approval_status`, `status`, `current_approval_level`, `approved_by`, `approved_at`;
- `submitPurchaseRequisitionFallback` — resolves the release rule and sets `approval_status: 'Approved'` / `approved_by` itself;
- `approvePurchaseRequisitionFallback` — recomputes per-line sourcing (`source_type: 'PROCURE'`, `open_qty`, `status`) line by line, then sets the header to `Approved`.

Two problems:

1. **Authorization**: approval of a purchasing commitment is decided by browser code that only needs `UPDATE` permission on the row. Nothing validates that the caller is the approver for the current level; the multi-level rule engine is re-implemented client-side from `purchase_release_rules`.
2. **The trigger condition**: `msg.includes('not found')` also matches legitimate server-side rejections ("Requisition not found", "release rule not found", "… could not find the function"), converting a server denial into a client-side write path (§7/§18/§20).

If the RPCs are absent in production (all seven requisition migrations are 0 bytes, so their functions are not provably deployed), this is the **live** path.

### P1-3 — `useUpdatePurchaseOrder` rewrites an order non-atomically and without a status guard

`usePurchaseQueries.ts`:

```text
1. UPDATE purchase_orders
2. DELETE FROM purchase_order_items WHERE po_id = id      // all lines
3. INSERT purchase_order_items (new lines)
```

- No transaction: a failure between steps leaves an approved PO **with zero lines** while `po_total`/`utilized` triggers fire against an empty set.
- No status guard: an order that has GRNs/bills/DC links can be fully re-written, invalidating three-way match (`verify_purchase_bill_3way`) and `update_po_utilized_value`.
- Receipts already recorded against deleted lines are orphaned (`purchase_bill_items.po_id`, `grn_items.po_item_id`).

`useDeletePO` has the same shape in the worst order: it deletes the items first, then the PO — if the PO delete fails (permissions/FK), the lines are gone permanently.

### P1-4 — `useRecordPaymentForRequest`: subcontractor payments have no idempotency key

```text
vendor path:        record_vendor_payment({ ..., p_idempotency_key: `pmr-${requestId}` })  → then UPDATE payment_requests SET status='Paid'
subcontractor path: record_subcontractor_payment({ ... })                                  → then UPDATE payment_requests SET status='Paid'
```

- The vendor path is idempotent (good) but the **second call is separate**: if the status update fails, the payment exists and the request stays `Approved`, so it can be paid again from the queue.
- The subcontractor path passes **no idempotency key** at all, so a retry (double click, network timeout, or re-opening an approved request) posts a second payment.

### P1-5 — `useReleaseSubcontractorPayment` bypasses the release control the vendor side enforces

```ts
await supabase.from('subcontractor_payments')
  .update({ workflow_step: 'released', approval_status: 'Released', released_by, released_at })
  .eq('id', paymentId);
```

Meanwhile the vendor equivalents are deliberately disabled with the message *"Direct browser payment release is disabled. Use the source-specific payment posting RPC after Payment Request approval."* (`useReleasePayment`) and `useCreatePaymentWithApproval`, `useBulkMarkPaid`, `useBulkSoftDelete`, `useBulkResendReapproval` all throw unconditionally. The subcontractor release therefore remains a plain browser `UPDATE` of the approval/release state — an inconsistent, unaudited control on a payment path (§18/§25).

---

## P2 Findings

1. **Disabled-but-rendered actions.** `useCreatePaymentWithApproval` (Payments.tsx:94), `useReleasePayment` (AccountantQueue.tsx:36, PaymentsHub.tsx:118) and the three bulk hooks (PaymentsHub.tsx:121-123) always throw. The buttons are still wired to them, so users get error dialogs for features that look available. Either remove the UI or route to the supported RPC.
2. **Document numbering.**
   - `generateRequisitionNumber` (`purchase-requisitions/api.ts`) fetches all `PR-YYMM-%` rows and returns `length + 1` → duplicates after any deletion, and races;
   - `generateInquiryNumber` (`purchase-inquiries/api.ts`) counts `AI-YY-%` rows → same;
   - `sendToPurchaseLine` uses `AI-${Date.now().slice(-8)}` → collision-prone, non-sequential, unreadable;
   - `convertAvailabilityResponseToPO` creates POs numbered `PO-AI-<epoch ms>` → bypasses the tenant PO series entirely; `20260912000000_document_number_unique_indexes.sql` now enforces `(organisation_id, po_number)` uniqueness, so these paths will surface raw `23505` errors rather than clean failures.
3. **`convertAvailabilityResponseToPO` writes four objects without a transaction** (PO → PO item → requisition line `po_qty` → header status), creating a **zero-value PO** (all amounts 0, `rate: 0`, `status: 'Draft'`). No validation of quantity/rate; the server RPC `record_purchase_bill`-style validation is not applied to POs at all.
4. **Requisition create/update are multi-write.** `createPurchaseRequisition` writes header then lines then calls approval integration inside a `try/catch` that only `console.warn`s (approval may be missing while the requisition says `Pending`). `updatePurchaseRequisition` deletes and re-inserts all lines regardless of approval state, so an approved requisition can be re-priced after approval.
5. **`deletePurchaseRequisition` deletes by id with no organisation filter and no state check** — an approved requisition that already generated POs/PR lines can be deleted from the browser (RLS is the only gate).
6. **Validation exists but is barely applied.** `modules/Purchase/utils/validation.ts` (zod: vendor schema, GSTIN/PAN/PIN/email/quantity helpers) is imported only by `PurchaseOrders.tsx` and `Vendors.tsx`. Requisitions, inquiries, GRN, bills, payments and debit notes have no client-side schema validation, and the repository contains no CHECK constraints for them; the server-side RPCs cover only bills, payments and debit notes.
7. **Projection/joins.** `usePurchaseOrder` selects `*, items:purchase_order_items(*), vendor:purchase_vendors(*)`; bills/POs/payments lists select `*` plus embedded vendor; `useVendorOpenBills` selects `*`. Search implementations first run an unfiltered `ilike` over `purchase_vendors` (no org filter) to obtain ids (§11/§15/§16).
8. **`useMaterialOptions` reads `item_variant_pricing` with no organisation filter** (relies on RLS only).
9. **Route-level RBAC missing.** `/purchase*` routes are not wrapped in `PermissionGuard` (contrast `/warehouse`, `/work-completion` in `App.tsx`), and no `purchase.*` permission is consulted, although the module drives payments and approvals.
10. **No pagination on several lists.** `usePayments`, `useReleasedPayments`, `useApprovedPaymentsForAccountant`, `usePaymentRequests`, `useVendorLedger` and `useMaterialOptions` are unbounded; `usePurchaseOrders`/`usePurchaseBills`/`useDebitNotes` paginate (good).
11. **Client-side derived state.** `calculateGST`, `calculatePOTotals`, `calculateLineTotal` and `vendorLedger.ts` compute tax and ledger figures in the browser for totals that are also computed server-side by `record_purchase_bill`; two implementations of GST split logic (intra/inter state) must now be kept in sync.
12. **Dead helpers.** `updateVendorBalance` and `updateBillPaymentStatus` (usePurchaseQueries.ts:1103, 1116) are unreferenced; `updateBillPaymentStatus` duplicates `record_vendor_payment`'s allocation logic with its own `netAmount` formula (total − TDS), which does not match the RPC's `total_amount` basis.

---

## P3 Findings

1. `PurchaseOrders.tsx` (2,290) and `Requisitions.tsx` (1,505) are the largest components in the module; `PaymentsHub.tsx` (1,219) and `Payments.tsx` (1,062) overlap heavily.
2. Two parallel implementations for the same screens: `PurchaseOrders.tsx` + `PurchaseOrdersV2.tsx`, `DebitNoteView.tsx` + `DebitNoteViewV2.tsx`, routed at `/purchase/orders-v2` and `/purchase/debit-notes-v2`.
3. `src/database-purchase-module.sql`, `database-purchase-enhancements-v2.sql`, `database-purchase-payment-approval.sql` and the phase scripts are all ad-hoc, mutually overlapping, and non-idempotent (`CREATE POLICY` without `DROP POLICY IF EXISTS`).
4. Mobile `PurchaseModule.tsx` reads `purchase_orders` with `select('id, po_no, vendor_name, total_amount, status, order_date')` — note the projected column names (`po_no`, `order_date`) differ from the web model (`po_number`, `po_date`), so one of the two is wrong for the live schema.

---

## Database & Security

| Table | Policy in repo | Tenant predicate | Verdict |
|---|---|---|---|
| `purchase_bills`, `purchase_bill_items`, `purchase_vendors`, `purchase_payments`, `purchase_payment_bills`, `payment_requests` | `_tenant_isolation` (ALL, `TO authenticated`, USING + WITH CHECK) | `user_can_access_org(organisation_id)` | Good — subject to the undefined-helper caveat below |
| `debit_notes`, `debit_note_items` | hardened by `20260817000003` | `user_can_access_org` | Good |
| `purchase_orders`, `purchase_order_items` | `"Enable all access"` `FOR ALL USING (true) WITH CHECK (true)` (ad-hoc script only) | none | **P0** |
| `purchase_requisitions`, `purchase_requisition_lines`, `purchase_release_rules`, `availability_inquiries`, `availability_inquiry_lines`, `availability_responses`, `purchase_audit_log` | **none found** | none | **P0** |

Additional checks:

- **`user_can_access_org` is undefined in the repository** (0-byte `20240101000094_fix_user_can_access_org.sql`). The AP policies' tenant predicate therefore cannot be reviewed by inspection either — same project-wide defect recorded in the Follow-Up Centre report.
- **Immutability/anti-tamper on AP is good:** `purchase_bills`, `purchase_bill_items` and `purchase_payments` have BEFORE INSERT guards blocking REST creation of approved/posted rows, plus BEFORE UPDATE/DELETE immutability triggers for financial fields (`20260817000004` §4-5), and `record_purchase_bill` / `record_vendor_payment` are `SECURITY DEFINER`, `SET search_path = public`, with `auth.uid()` and `user_can_access_org` checks, vendor↔org validation, server-side line-item arithmetic, `FOR UPDATE` bill locking and idempotency keys. **This is the reference implementation the rest of the module should follow.**
- **FK/orphan risk:** `purchase_order_items` is deleted directly by the client; nothing prevents orphaned `grn_items`/`purchase_bill_items` references (`po_id` is a bare UUID in several paths). `purchase_requisitions.project_id/site_id/cost_center_id/work_order_id` are written as nullable UUIDs with no FK visible in the repo.
- **Idempotency:** `purchase_bills`/`purchase_payments` have partial unique indexes on `(organisation_id, idempotency_key)` — good; `purchase_payment_bills`, `debit_notes` and subcontractor payments rely on client-generated keys that some callers fabricate per click.
- **Indexes:** `20260912000000_document_number_unique_indexes.sql` adds tenant-scoped unique indexes for document numbers (good); access-path indexes for `organisation_id,status,created_at` exist for AP tables, unverifiable for requisition/inquiry tables (no migration).

---

## Query & Cache

| Check | Result |
|---|---|
| Query keys tenant-scoped | Mostly **PASS** (`['purchase-orders', organisationId, filters]`, `['purchase-bills', organisationId, …]`, `['debit-notes', organisationId, …]`, `['purchase-payments', organisationId]`, …) — includes `filters` objects, which are re-created on each render but structurally equal |
| Exception | `['purchase-order', poId]` omits the organisation (UUIDs are globally unique, so practical leakage is low) |
| `staleTime` / `gcTime` | 15–60 s stale / 3–10 min gc — sane |
| Invalidation | Precise per-org invalidation on success (good); `useCreateDebitNote` invalidates by prefix only |
| Polling | **None** — PASS on §17 |
| Organisation switching | Query keys change with the org; mutations read `organisation_id` from the payload rather than from state, so a stale form could target the previous tenant — the AP RPCs re-validate against the DB, the requisition/inquiry paths do not |
| Projection | `SELECT *` prevalent; no N+1 loops found in the list hooks |

---

## Frontend Architecture

`usePurchaseQueries.ts` is a 1,750-line single file owning every query, every mutation, PDF-triggering side effects and payment-request approval orchestration. Combined with components of 1,000–2,300 lines that each own tables, forms and modals, the module violates §24 at both levels. The business logic that matters most (approval rules, sourcing decisions, payment-posting orchestration) is the part currently in the browser.

Recommended split for the fix pass (not performed here): `purchase/api/{vendors,orders,requisitions,inquiries,bills,debitNotes,payments}.ts`, `purchase/hooks/*`, and one component per surface with the workflows extracted to services.

---

## Business Integrity

| Workflow | Finding |
|---|---|
| Create requisition | Non-atomic; count-based numbering; approval creation failure swallowed |
| Submit / approve requisition | Approval state machine implemented in the browser with a fallback that matches authorization errors (P1-2) |
| Update requisition | Delete-and-reinsert lines with no approval-state guard |
| Delete requisition | No org filter, no state guard |
| Availability inquiry → vendor response → PO | Number `AI-<epoch>` / `PO-AI-<epoch>`; four writes without a transaction; zero-rate PO |
| Source from store | **Client-side stock deduction** (P0-2) |
| Create PO / edit PO / delete PO | Non-atomic; edit and delete can destroy lines of an order that already has receipts |
| Goods receipt | `post_goods_receipt` RPC — correct |
| Record bill | `record_purchase_bill` RPC — correct (server arithmetic, GL posting, idempotency) |
| Record vendor payment | `record_vendor_payment` RPC — correct |
| Record subcontractor payment from a payment request | No idempotency key; status update in a second call (P1-4) |
| Release subcontractor payment | Client-side state transition (P1-5) |
| Debit note | RPC correct; client fabricates a fresh idempotency key per click |
| Vendor balance | Recomputed but never persisted (P1-1) |

---

## Migration Integrity

| Object | Repository migration | Ad-hoc script |
|---|---|---|
| `purchase_vendors`, `purchase_orders`, `purchase_order_items`, `purchase_bills`, `purchase_bill_items`, `debit_notes`, `debit_note_items`, `purchase_payments`, `purchase_payment_bills`, `payment_requests` | none (placeholder `00008`, `00015` are 0 bytes) | `src/database-purchase-module.sql` (+ hardening migration for the AP subset) |
| Requisitions / release rules / availability inquiry / audit log | placeholders `00075`, `00077`, `00078`, `00079`, `00080`, `00081`, `00084` — **all 0 bytes** | phase scripts |
| Invoice verification | `00081` (0 bytes) | — |
| AP security hardening | `20260817000004` (substantive) | — |
| Debit-note hardening | `20260817000003` (substantive) | — |

Nine 0-byte purchase migrations mean the module's schema evolution is not represented at all; the only trustworthy artefacts are the two August hardening migrations and two September index migrations.

---

## Runtime Verification

| Test | Result |
|---|---|
| Load | NOT VERIFIED |
| Search | NOT VERIFIED |
| Filter | NOT VERIFIED |
| Create (requisition / PO / bill) | NOT VERIFIED |
| Edit | NOT VERIFIED |
| Primary workflow (requisition → inquiry → PO → GRN → bill → payment) | NOT VERIFIED |
| Secondary workflow (debit note, vendor ledger) | NOT VERIFIED |
| Delete / cancel | NOT VERIFIED |
| Export (PO PDF, ledger) | NOT VERIFIED |
| Organisation switch | NOT VERIFIED |

No credentials or test tenants were available. The §33 matrix must be executed against the seven unprotected tables (P0-1) first, then the stock-fulfilment path with two concurrent sessions (P0-2).

---

## Build Verification

```text
TypeScript:  NOT RUN (full `tsc --noEmit` exceeded 10 minutes in this environment; no code changes made)
Lint:        NOT RUN
Web build:   NOT RUN
Tests:       NOT RUN — no test files exist for this module
Mobile build: NOT RUN
Capacitor sync: NOT RUN
```

---

## Remaining Issues

**Blocking**

- P0-1 (no tenant boundary on POs/order lines/requisitions/inquiries/audit log).
- P0-2 (client-side inventory deduction).
- P1-1 (`recalc_vendor_balance` is a no-op — AP outstanding figures are wrong).
- P1-2 (client-side approval path reachable on common error strings).

**Non-blocking**

- P1-3 … P1-5 and all P2/P3 items.

---

## Final Status

```text
FAIL
```

The AP sub-module (bills, payments, debit notes) is the strongest defensive work in the codebase and should be treated as the reference pattern. The procurement half — orders, requisitions, inquiries, sourcing — has no database-level tenant isolation, mutates inventory from the browser, and keeps its approval logic in client code, so the module as a whole cannot be certified.

---

## Suggested Remediation Order (for the follow-up "audit and fix" pass — not performed here)

1. One forward migration: `ENABLE ROW LEVEL SECURITY` + `DROP POLICY IF EXISTS` + `_tenant_isolation` policies (`user_can_access_org`, `TO authenticated`, USING + WITH CHECK) for `purchase_orders`, `purchase_order_items`, `purchase_requisitions`, `purchase_requisition_lines`, `purchase_release_rules`, `availability_inquiries`, `availability_inquiry_lines`, `availability_responses`, `purchase_audit_log`.
2. Replace `fulfillFromStoreLine` with a `SECURITY DEFINER` RPC that locks stock rows, writes a movement/ledger entry and updates the requisition line in one transaction (the warehouse engine already provides the primitives).
3. Fix `recalc_vendor_balance` to persist `current_balance` (and add a regression test), then backfill.
4. Delete the client-side approval fallbacks and make RPC absence a hard, visible failure; remove `msg.includes('not found')` from the fallback predicate.
5. Wrap PO update/delete, requisition update/delete, and availability→PO conversion in RPCs with state guards; add idempotency to `record_subcontractor_payment` calls; make release follow one audited path for vendor and subcontractor payments.
6. Route `/purchase/*` and `/purchase` behind `PermissionGuard` and enforce `purchase.*` permissions server-side.
