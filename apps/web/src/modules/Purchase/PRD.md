# Purchase Module Modernization — PRD

**Scope:** BillFast Purchase module (14 components, `usePurchaseQueries.ts` hooks layer, ~9,700 LOC)
**Source:** OpenCode review report + independent diff-based verification against actual source
**Status:** Draft for phased implementation via OpenCode prompts

---

## 0. Why this PRD exists

The original review flagged 6 "critical bugs," a long missing-features list, and UX/architecture debt. Two of those critical-bug claims did not hold up under spot-check against the real files (PO numbering is fine; a CSV export already exists on Availability Inquiry) and one claim was actually *understated* (`updateVendorBalance` race risk, given a fire-and-forget call site at `usePurchaseQueries.ts:1613`). This PRD only includes findings verified against the uploaded source, corrects the two false positives, and reorganizes everything into shippable phases.

**Goal:** Take the Purchase module from "functionally complete, structurally fragile" to a module that scales past a few hundred POs/bills per org, doesn't silently lose data, and has one coherent approval/UX pattern instead of three.

**Non-goals (explicitly out of scope for this PRD):** e-invoice/e-way bill integration, WhatsApp/email integrations, mobile responsive rebuild, dark mode. These are real but are P3/backlog — listed at the end for visibility, not scheduled.

---

## 1. Verified issue ledger

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | DebitNotes stale closure drops rate alerts | ✅ Confirmed | `DebitNotes.tsx:108-169` (effect, deps `[]`) reads `materialOptions` (state declared line 202, populated by separate effect line 212) |
| 2 | No server-side pagination | ✅ Confirmed | No `.range()` on any list query; only isolated `.limit(1)`/`.limit(50)` lookups |
| 3 | `updateVendorBalance()` client-side aggregation, race-prone | ✅ Confirmed, **worse than reported** | `usePurchaseQueries.ts:1077-1123` — 3 sequential queries + JS reduce + write-back, no lock/transaction. Line 1613 calls it via `void updateVendorBalance(...)` — fire-and-forget, no await, no error surfaced at call site |
| 4 | Stock deduction errors silently swallowed | ✅ Confirmed | `DebitNotes.tsx:371-377` — `catch { console.error(...) }`, no user-facing error, DN still saves |
| 5 | Same closure bug re-cited | ✅ Confirmed (duplicate of #1) | — |
| 6a | PO numbers use `Math.random()`, collision-prone | ❌ **False** | `PurchaseOrders.tsx:572` `buildPONumber()` uses a proper prefix/FY/padding series via `getPOSeriesNumber()`. The only `Math.random()` in that file (line 848) is a file-attachment filename suffix — harmless |
| 6b | Payment voucher numbers use `Math.random()` | ✅ Confirmed | `usePurchaseQueries.ts:9-14` `createPaymentVoucherNo()` — ms-timestamp + 4-char random suffix, no DB uniqueness constraint. Practical collision odds are low (ms-precision), but there's no guarantee — reframe as "no uniqueness guarantee" not "collision-prone" |
| 7 | No DN approval UI despite `approval_status` field | ✅ Confirmed | `DebitNoteView.tsx:311` only renders Delete when Pending; no approve/reject action anywhere |
| 8 | No Excel/CSV export on any module (PDF only) | ❌ **False** | `AvailabilityInquiry.tsx:~220-241` has a working CSV export (`sourcing-board-<date>.csv`) on the sourcing board. Correct framing: export coverage is *inconsistent*, not absent |
| 9 | No `staleTime` on any query | ✅ Confirmed | 0 of 23 `useQuery` calls in `usePurchaseQueries.ts` set `staleTime`/`gcTime` |
| 10 | No debounced search inputs | ✅ Confirmed | No `debounce`/`useDebounce` reference anywhere in the 14 components |

Unverified (file not reviewed): PO amendment/versioning, budget checks, TDS handling, e-invoice fields — treated as-is from the report since they're presence/absence-of-feature claims, not code-behavior claims.

---

## Phase 1 — Data integrity & silent-failure fixes
**Objective:** Stop the module from losing or misrepresenting data. No UI redesign in this phase — surgical fixes only.
**Est. effort:** 3-5 days solo / 1 sprint with OpenCode-assisted implementation

| Task | File(s) | Fix |
|---|---|---|
| 1.1 Fix DN rate-alert stale closure | `DebitNotes.tsx:108-169` | Add `materialOptions` to effect deps, **or** move the `convert-to-dn` handler logic out of a raw `useEffect`/`window.addEventListener` pattern into a stable `useCallback` that reads current state via a ref, **or** migrate `materialOptions` fetch into React Query so it's available synchronously via `queryClient.getQueryData` |
| 1.2 Surface stock deduction failures | `DebitNotes.tsx:371-377` | Replace silent `console.error` with a toast + a non-blocking "Stock not adjusted — review inventory for [items]" banner; do not let this block DN save, but the user must see it |
| 1.3 Move `updateVendorBalance` to a DB function | `usePurchaseQueries.ts:1077-1123` | Write a Postgres function (`recalc_vendor_balance(vendor_id, org_id)`) that does the aggregation server-side in one transaction; replace all 5 call sites (`566`, `719`, `1050`, `1477`, `1613`) with an RPC call. Fixes both the race condition and the round-trip cost |
| 1.4 Fix fire-and-forget balance update | `usePurchaseQueries.ts:1613` | Once 1.3 lands, `await` the RPC call and surface failure via the existing mutation's `onError` |
| 1.5 Add uniqueness guarantee to payment vouchers | `usePurchaseQueries.ts:9-14` | Either add a DB unique constraint on `voucher_no` with retry-on-conflict, or switch to a DB sequence like PO numbers already use (`buildPONumber` pattern is the template — reuse it) |

**Acceptance criteria:** Every write path that can partially fail (DN save + stock, balance update) either fully succeeds or clearly tells the user what didn't. No client-side balance math survives outside of display formatting.

---

## Phase 2 — Performance foundations
**Objective:** Module stays usable past a few hundred rows per table. No visible UX change to the user beyond "feels faster."
**Est. effort:** 1 sprint

| Task | Scope |
|---|---|
| 2.1 Server-side pagination | Add `.range()` + `count` to list queries for `purchase_orders`, `purchase_bills`, `debit_notes`, `payment_requests`, `purchase_vendors`. Wire into `AppTable`'s existing pagination UI instead of client-side truncation |
| 2.2 `staleTime`/`gcTime` on all `useQuery` calls | `usePurchaseQueries.ts` — 30-60s `staleTime` as a blanket default, per-query overrides where data is more volatile (payment queue) or more static (vendor list) |
| 2.3 Debounced search | Add a shared `useDebounce` hook (300ms), apply to every search input across the 14 components — currently every keystroke re-renders/re-filters |
| 2.4 Move materials/variants fetch into React Query | `DebitNotes.tsx:212-230` — the raw `Promise.all` becomes a proper `useQuery`, which also structurally fixes part of 1.1 (materials become available via cache regardless of mount order) |

**Acceptance criteria:** A vendor with 1,000+ bills loads the Bills list in the same perceived time as one with 10. Search inputs don't visibly lag on fast typing.

---

## Phase 3 — Workflow unification
**Objective:** One approval pattern, not three. Close the DN approval gap. Consistent export coverage.
**Est. effort:** 1-1.5 sprints

| Task | Scope |
|---|---|
| 3.1 Build DN approve/reject UI | `DebitNoteView.tsx` — hook into the existing `approval_status` field and whatever approval-workflow pattern `payment_requests` already uses (reuse, don't reinvent — check `useOrgApprovalWorkflows` usage in `AccountantQueue.tsx` as the reference pattern) |
| 3.2 Unify PR / Payment / DN approval into one mechanism | Currently: PRs use one path, payments use `payment_requests` + a separate `purchase_payments` workflow, DNs have none. Consolidate onto a single `ApprovalIntegration`/`ApprovalAPI` flow (already imported in `usePurchaseQueries.ts`) |
| 3.3 Extend CSV export to Bills, POs, Payments, Vendors | Reuse the pattern already proven in `AvailabilityInquiry.tsx` (blob + download, no library needed) rather than introducing a new export mechanism |
| 3.4 Rate-alert forced acknowledgement | DN creation currently allows rate alerts to be silently dismissed — require explicit acknowledgement before save, now that 1.1 makes the alerts actually fire reliably |

**Acceptance criteria:** A user can approve or reject a DN without leaving the module. Every list view has the same export affordance in the same place.

---

## Phase 4 — Dashboard & visibility rebuild
**Objective:** The 195-line Dashboard becomes an actual operating view instead of a sourcing-board shortcut.
**Est. effort:** 1 sprint

- Payment aging buckets (30/60/90+ days) — data already exists via `purchase_bills.due_date` + `balance_amount`, same fields `PaymentQueue.tsx` already uses for its overdue tabs
- Vendor concentration (top-N vendors by spend / total spend %)
- PR→PO cycle time (needs `created_at` diff between requisition and resulting PO — check if PO retains a `requisition_id` link)
- Cash flow forecast — sum of `balance_amount` grouped by `due_date` week, reusing `PaymentQueue`'s date-bucket logic
- Pending approvals count — one query against whatever Phase 3.2 unifies onto

**Acceptance criteria:** Dashboard answers "what needs my attention today" without clicking into Sourcing Board first.

---

## Phase 5 — Component decomposition & code health
**Objective:** Make future changes safe. This is enabling work for everything above, not user-visible.
**Est. effort:** ongoing, interleave with Phases 1-4 rather than doing it standalone

- Split `PurchaseOrders.tsx` (2,151 lines), `Payments.tsx` (1,033), `AvailabilityInquiry.tsx` (801), `Requisitions.tsx` (977), `DebitNotes.tsx` (844) — extract form/dialog sub-components first since those are the highest-churn areas from Phases 1-4
- Split `usePurchaseQueries.ts` (1,711 lines) by domain: `useVendorQueries`, `usePOQueries`, `useBillQueries`, `usePaymentQueries`, `useDNQueries`
- Add error boundaries per tab so one component crash doesn't take down the whole module
- Standardize on `AppTable` everywhere (currently mixed with raw `<table>` elements) — do this incrementally, one file per PR, not a big-bang rewrite

**Acceptance criteria:** No single file grows during Phases 1-4; ideally each touched file shrinks.

---

## Backlog (P3 — not scheduled)

Vendor documents/contacts/blacklist, PO amendment + versioning, budget checks, TDS tracking, RCM handling, e-invoice/e-way bill fields, bulk operations, keyboard shortcuts, saved filters, dark mode, mobile responsive layout, WhatsApp/email integration, Supabase Realtime for approval/payment status.

---

## Suggested execution order for OpenCode prompts

Each phase above should become its own OpenCode implementation prompt, run and verified independently — per your existing verification standard (diff-based spot-check, not trusting "0 TypeScript errors" as proof of correctness). Recommended order: **1 → 2 → 5 (interleaved) → 3 → 4**, since Phase 1 fixes are the ones with actual data-loss/data-corruption risk and Phase 2's `staleTime` work is cheap and low-risk to bank early.

For Phase 1 in particular, given the DN closure bug and the balance-update race both touch money/inventory correctness, I'd manually spot-check those two diffs line-by-line rather than relying on OpenCode's own summary — same standard you used on the `CreateQuotation.tsx` module split.
