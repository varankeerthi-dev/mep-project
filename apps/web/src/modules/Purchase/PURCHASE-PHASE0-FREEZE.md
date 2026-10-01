# Purchase Refactor — Phase 0 Freeze

**Status:** ACTIVE. Applies to Phases 1–3 of the refactor.
**Defined:** 2026-09-29
**Plan of record:** `PURCHASE-REFACTOR-PLAN.md`

---

## Freeze constraints

While Phases 1–3 are in progress, the following are **out of scope**. If a change appears to require one of them, that is a signal to stop and re-plan, not to proceed.

### 1. No UI restructuring
No component extraction, no directory reorganisation, no renaming, no prop reshaping. The 1627-line `usePurchaseQueries.ts` and the 2198-line `PurchaseOrders.tsx` stay as they are until the work they contain has settled.

The only permitted UI changes are the ones in the approved Phase 2 fix list, and only where they make a currently-broken action work or make a currently-throwing action visibly unavailable.

### 2. No deletion of V2 files
`PurchaseOrdersV2.tsx`, `DebitNoteViewV2.tsx`, `DebitNotes.tsx`, and the `/purchase/orders-v2` and `/purchase/debit-notes-v2` routes are retained. Their defects are documented, not remediated, during Phases 1–3.

Wiring a new RPC to a V2 form is **also** out of scope — that is a behavioural change to a live write path and belongs in a later phase with its own verification.

### 3. No financial-model changes
No change to how GST is computed, split, or rounded. No change to line-total or header-total formulas. No change to the vendor ledger's balance derivation. No change to any tolerance, threshold, or variance rule.

Phase 3 may move *where* a calculation happens (browser → server RPC). It may not change *what* is calculated, unless the current calculation is provably wrong — and that proof becomes its own reviewed change with its own evidence, not a side effect of a boundary move.

### 4. No migration cleanup beyond establishing actual live definitions
The only permitted migration work in Phases 1–3 is:

- capturing live function/policy/trigger definitions that the repository does not reproduce, and adding them as `CREATE OR REPLACE` migrations;
- resolving the three zero-byte purchase migration files;
- adding policies/triggers that are live but absent from the tree.

Not permitted: renaming migrations, squashing, re-ordering, editing historical migrations that are already correct, or deleting migrations believed to be superseded. The migration tree is history; we append, we do not rewrite.

---

## What IS permitted

- New migrations that make the repository reproduce the live database.
- Server-side RPCs that move existing business logic behind an authoritative boundary.
- Fixing currently-broken code paths within the approved Phase 2 list.
- Deleting code that is provably unreferenced and has no callers outside the module.
- Adding verification, tests, and evidence.

---

## Enforcement

Any change touching a frozen area must be raised before implementation, not reviewed after. A Phase 3 boundary move that turns out to require a GST change is a **stop**, not a judgement call — the financial-model change gets its own review.

## Phase 3 release manifest

Phase 2 hides four actions rather than fixing them. Phase 3 must, for each, either deliver a working replacement or record a deliberate product decision to withdraw the capability:

| Hidden in Phase 2 | Phase 3 obligation |
|---|---|
| Vendor-payment "Mark Released" (`AccountantQueue`, `PaymentsHub`) | deliver `release_vendor_payment` + `record_vendor_payment` request/release split, **or** withdraw |
| `useBulkMarkPaid` | deliver an audited bulk-posting RPC, **or** withdraw |
| `useBulkSoftDelete` | deliver an audited archival RPC, **or** withdraw |
| `useBulkResendReapproval` | route through `approval_transition` `resubmit`, **or** withdraw |

No action disappears without a matching Phase 3 disposition.
