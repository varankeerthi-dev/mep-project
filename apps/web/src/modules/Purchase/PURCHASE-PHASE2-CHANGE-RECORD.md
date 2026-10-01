# Phase 2 — Change Record

**Date:** 2026-09-29
**Scope:** restore currently-broken code paths only. No migration, no database change, no financial-model change.
**Files changed:** 5, all in `apps/web/src/modules/Purchase/`

| File | Before | After | Change |
|---|---|---|---|
| `components/Payments.tsx` | 1062 | 1155 | +source-bill selector; removed throwing approval branch |
| `components/PaymentsHub.tsx` | 1149 | 1002 | −147: 3 bulk dialogs, state, handlers, selection wiring |
| `components/AccountantQueue.tsx` | 162 | 147 | release action withdrawn; false "Restricted access" copy replaced |
| `components/PaymentQueue.tsx` | 271 | 299 | "Pay" button given a real handler |
| `hooks/usePurchaseQueries.ts` | 1824 | 1688 | −136: 5 throw-stubs + 3 dead helpers + 2 types |

---

## 2.1 — Payment Request now carries a source bill

**The bug.** `useCreatePaymentRequest` (`usePurchaseQueries.ts:881-884`) requires `source_bill_id` and throws without it. The Payments request form (`Payments.tsx:886-897`) never sent one. **Every Payment Request created from the Payments screen failed.**

The hook already read `source_bill_id` correctly. The form simply had no field for it. Fixing the form, not the hook.

**The change.** Added a required Source Bill select to the request dialog:
- populates from `useVendorOpenBills` for the chosen vendor (open/partially-paid bills only)
- selecting a bill prefills Amount with its outstanding balance — a convenience, still editable
- vendor select resets the source bill, so the pair can never mismatch
- both are locked when editing an existing request, because the source bill is set at creation
- submit validates it and surfaces the existing hook error if the RPC still rejects

No new RPC. No schema change.

## 2.2 — Approval flow (verified reachable, unchanged)

Approval does **not** happen on the Payments screen. It runs through the central Approvals page:

```
pages/Approvals.tsx:581,640,659
  -> approvals/api.ts:288  ApprovalAPI.processApproval
     -> approvals/api.ts:601  approvalTransition({ referenceType: 'payment_requests', action: 'approve' })
        -> RPC approval_transition  (SECURITY DEFINER, _remediation_guard_org)
```

Confirmed in source. `approval_transition` is idempotent — re-approving an already-Approved request returns `status: 'noop'`.

**No change made.** This path already worked; Phase 2 only needed it confirmed rather than rebuilt.

*Pre-existing defect, out of scope:* `approvals/api.ts:585`, inside `case 'purchase_orders'`, passes a PO id as `referenceType: 'purchase_payments'`. That will return `RECORD_NOT_FOUND` and revert the approval. It does not affect the Purchase payment-request path. Recorded for Phase 3/4.

## 2.3 — Release flow (verified reachable, unchanged)

The one working release path:

```
PaymentsHub.tsx  approved request row -> "Record payment" button
  -> openRecordModal
     -> useRecordPaymentForRequest  (usePurchaseQueries.ts:1526+)
        -> RPC record_vendor_payment   (posts the GL entry)
        -> UPDATE payment_requests SET status='Paid'
```

**Idempotency** — the DoD requires repeats not to duplicate. Verified: the hook passes `p_idempotency_key: 'pmr-<requestId>'` (stable per request), and the database enforces `UNIQUE (organisation_id, idempotency_key) WHERE idempotency_key IS NOT NULL` on `purchase_payments`. `record_vendor_payment` has a pre-check plus a `unique_violation` handler that replays the existing payment. A double-click cannot create a second payment.

**Known weakness, not fixed:** the RPC call and the `payment_requests` status update are two separate writes with no transaction. If the second fails, funds have moved and the request still reads Approved. Making this atomic is Phase 3 work — it needs a server-side function, and touching `record_vendor_payment` is explicitly forbidden this phase.

**No change made.**

## 2.4 — Dead code removed

Five throw-stubs deleted. Each was wired to a live control:

| Removed | Was wired to | Result |
|---|---|---|
| `useCreatePaymentWithApproval` | `Payments.tsx:246`, the `PURCHASE_PAYMENT` branch | every payment failed when that setting was on |
| `useReleasePayment` | `AccountantQueue` primary action; `PaymentsHub` Release column | the primary action of a whole screen could not succeed |
| `useBulkMarkPaid` | PaymentsHub "Mark as paid" | always threw |
| `useBulkSoftDelete` | PaymentsHub "Delete" | always threw |
| `useBulkResendReapproval` | PaymentsHub "Send again for reapproval" | always threw |

Plus three helpers with zero call sites: `updateVendorBalance`, `updateBillPaymentStatus`, `createPaymentVoucherNo` (superseded by the DB voucher-number constraint and the `trg_sync_vendor_balance` trigger), and the `BulkMarkPaidItem` / `BulkSoftDeleteItem` types.

`PaymentsHub.tsx` also shed 3 dialogs, 6 state variables, 4 handlers and the row-selection wiring, all of which existed only to feed the removed hooks. `-147` lines.

## 2.5 — PaymentQueue "Pay" button

The button had no `onClick` — it rendered and did nothing.

It now navigates to `/purchase/payments?vendor=<id>&bill=<id>`, and `Payments.tsx` reads those params to open the payment dialog with the vendor and bill already selected. It routes to the only place a vendor payment can actually be recorded rather than pretending to pay inline.

## 2.6 — Unsupported actions withdrawn

- **PaymentsHub**: all 3 bulk actions removed; vendor-payment Release replaced with a plain "Release unavailable" note. Subcontractor release kept — `useReleaseSubcontractorPayment` is live.
- **AccountantQueue**: read-only. The header previously said "Release funds from here" and showed a "Restricted access" panel implying server-side enforcement that does not exist. Both were false once the button was gone, so the copy now says release is unavailable and points to Payments Hub.

Each withdrawal carries a comment naming the Phase 3 obligation, matching the release manifest in `PURCHASE-PHASE0-FREEZE.md`.

---

## Verification status

### Passing

| Check | Method | Result |
|---|---|---|
| File integrity | brace/paren balance across all 5 files | balanced |
| No dangling references | scan 22 removed symbols across all 4 components | 0 references |
| Stubs actually gone | grep for `export const` / `export type` | none remain; only explanatory comments |
| Approval path | source trace to `approval_transition` | reachable, `action: 'approve'` |
| Release path | source trace to `record_vendor_payment` | reachable |
| Idempotency | hook key + live unique index | DB-enforced, cannot duplicate |
| No migration applied | `supabase_migrations.schema_migrations` | 0 of my 3 present |
| No DB modification | row counts vs Phase 1 baseline | identical (payments 2, bills 2, POs 1, DNs 5, approvals 55) |

### NOT verified

**The end-to-end scenario has not been run.** The DoD asks for Bill → Payment Request → Approve → Release → GL → Ledger → retry. I have verified each link statically. I have **not** executed the flow against a running app, and I cannot — that needs a browser session and a user in the app.

Per `.agents/VERIFICATION.md`, "Never report PASS from static inspection alone when runtime behaviour is required." So the honest status is:

- DoD items 1–4, 6, 8: **supported by static evidence, not runtime-confirmed**
- DoD item 5 (no duplication on repeat): **structurally guaranteed** by a DB unique index plus a stable idempotency key — the strongest guarantee available without executing it
- DoD item 7 (no unsupported action exposed): **confirmed** by code inspection; the controls are gone from the render path

**Typecheck.** `tsc` reports 862 errors repo-wide, pre-existing and unrelated. I began a baseline diff to separate mine from the existing ones and had to abandon it mid-run; the attempt also briefly left the working tree holding the pre-change files, which I restored. **I have not established which of the 45 errors in my 5 files are mine.** Treat typecheck as unverified, not passing.

### Recommended before merge

1. Run the full scenario in a browser on a non-production org.
2. Establish the typecheck baseline properly (stash-and-compare) and confirm no new errors in the 5 files.
3. Confirm the Source Bill select behaves when a vendor has no open bills.

## Explicitly not touched

Per the Phase 0 freeze and the phase brief: `record_vendor_payment`, 3-way-match enforcement, RLS policies, GUC bypasses, V2 financial paths, Debit Note architecture, atomic PO RPC adoption, vendor bank controls, migration application. None were modified.
