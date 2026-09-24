# PRD — Procurement to PO Release (Quotation Stock-Check Trackers → Vendor Buying Chain)

Source of truth: remote Supabase project `rujqejtisqermjyqqgoj` (live schema, RPC bodies, row counts).
Code is secondary witness. Status: **planning — no implementation until scope is approved.**

## 1. Destination

A single, trustworthy buying chain: a quotation's stock-check tracker flows into requisitions,
availability inquiries, a real (valued, approved, sent) purchase order, goods receipt, and bill —
with one gap formula, one stock source, event-driven statuses, and no duplicate trackers or phantom
quantities. The map is done when every decision below is locked and the phased plan is approved.

## 2. Notes

- Every session consults: this PRD, `apps/web/docs/PRD-QUOTATION-PROJECT-INTERLINK.md`,
  `.agents/VERIFICATION.md` (esbuild transform check, ASCII-safe edits).
- Standing preferences: smallest safe change; reuse server RPCs before new code; no silent
  architecture changes; verification queries against remote after each phase.
- Key screens: `src/pages/QuotationView.tsx` (availability modal, launch),
  `src/pages/ProcurementDetail.tsx` (tracker), `src/modules/Purchase/components/AvailabilityInquiry.tsx`,
  `src/modules/Purchase/components/PurchaseOrders.tsx`, `src/purchase-requisitions/api.ts`,
  `src/purchase-inquiries/api.ts`.

## 3. Decisions so far

- **Launch duplicates → reuse open tracker.** When Send-to-Procurement runs for a quote that already
  has an open tracker, add only genuinely new lines to it (confirmed 2026-09-24).
- **In-Stock rows → no vendor choice.** Fully covered lines must not offer the vendor dropdown
  (agreed direction from review; implementation awaiting scope approval).
- **Release-rules → seed explicit catch-all.** One level-1 rule (purpose NULL, amount
  -1..999999999, active) seeded in Phase 2 setup with migration notes, making auto-approve
  visible, auditable, reversible. Full purpose/amount/role matrix deferred to Phase 4
  (locked 2026-09-24).
- **Scope → Phase 1 APPROVED (2026-09-24); Phase 2 SKIPPED (not clear).** Phase 1 cover-math
  unification stays parked on the ATP hold — launch keeps gross-cover In-Stock marking until ATP
  is locked. No code beyond Phase 1 until re-approved.
- **Canonical stock source → HOLD (re-confirmed 2026-09-24).** Phase 1 stays blocked until locked.
  Candidates: (a) ATP verbatim from the availability modal — per (item_id, warehouse_id),
  `available_w = max(0, current_stock_w − Σ sales_order_reservations.qty)`, summed across
  warehouses; no org filter client-side (RLS scopes); `item_stock` has no QC/hold columns so no
  hidden filtered set. (b) Gross `Σ(current_stock)` — rejected on substance (reservations exist
  live) but recorded for completeness.

## 4. Current state (remote-verified)

- `purchase_orders` = 0 rows, `goods_receipts` = 0 rows, `purchase_release_rules` = 0 rows.
  The buying chain has never completed. Audit log shows 1 PO CREATE + 3 PO DELETEs.
- `purchase_requisitions` = 9 (4 Pending, 5 Approved), lines = 11, all `available_stock_qty` = 0.
- `availability_inquiries` = 4, responses = 4 (all one vendor), `po_qty` = 50 and 56 against
  `requested` 55 and 55 — including **56 > 55, live proof of double-convert** (responses 36 + 20).
- `procurement_lists` = 6, `procurement_items` = 31. QT0002 launched 3 identical trackers;
  duplicate and zero-qty (`BOQ-0001`, `boq_qty` = 0) rows copied blindly. Exactly 1 list has any
  vendor set. All `po_linked` = false.
- `inventory` table audit (2026-09-24): 6 rows / 6 items / 2 orgs — effectively unpopulated
  against `item_stock` (20 rows). Only 3 readers: `approve_purchase_requisition` RPC (stamps
  `available_stock_qty`, hence all-zeros live), `AvailabilityInquiry.tsx:84` (sourcing overlay),
  `material-intents/api.ts:196`. No views depend on it. Recommendation: retire as a stock source
  (decided with the stock source).

## 5. Business logic (normative rules per stage)

1. **Launch (quotation → tracker).** Copy non-header lines with `boq_qty > 0`, dedupe by
   `(item_id, description)`. Check live cover per line: fully covered → `In Stock`, else `Pending`.
   Reuse the quote's open tracker; never create a second open tracker per quotation.
   Cover math MUST equal the availability screen (reservation handling per stock-source decision).
2. **Tracker.** `Gap = boq_qty - warehouse_total - stock_qty - local_qty` (single formula,
   all surfaces), where `warehouse_total` = cover per the canonical stock source (§10), all
   quantities in the row's UOM (cross-UOM conversion is out of scope; mismatched units surface
   as-is). `stock_qty`/`local_qty` are manual allocations, never auto-written, never cleared by
   jobs. Vendor select disabled on `In Stock` rows. Gap-row vendor is a default carried into the
   inquiry, not a decision. Link-PO enforces vendor match: procurement vendor set + PO vendor
   differs → block with message; procurement vendor unset → allow and stamp the row vendor from
   the PO on save.
3. **Requisition.** Submit reads `purchase_release_rules`; level 1 → auto-approve + source split,
   else multi-level via `process_purchase_requisition_approval` (audited in `purchase_audit_log`).
   Phase 2 setup seeds the decided catch-all level-1 rule with migration notes. Approval stamps
   per-line `available_stock_qty` from the canonical stock source (replaces the current
   `inventory`-table read) and sets `source_type` per line (STORE vs PROCURE split, not
   blanket PROCURE).
4. **Sourcing / inquiry.** Buy path decrements `open_qty` AND consumes `procure_required_qty` so
   sent lines stop reappearing. One open inquiry per requisition (reuse, don't per-click create).
   Responses record vendor + qty + promise date; price field is out of scope for this effort
   (no price column exists; POs are rated at PO-edit time).
5. **Convert → PO.** MUST call `create_purchase_order_atomic` with idempotency key
   `po:ai-line:{availability_inquiry_line_id}` for response converts (canonical once bridged) or
   `po:proc-item:{procurement_item_id}` for any direct procurement-row convert. This gives server
   numbering, GST jurisdiction math, and replay protection (`idempotent_replayed` reported).
   Never the zero-value direct insert. PO opens as Draft, never auto-Approved.
   Double-click Convert → 1 PO is the Phase 3 gate.
6. **PO release.** Explicit Approve (`approve_purchase_order_atomic`) then Send (stamps `sent_date`,
   `email_sent`, `email_sent_to`). Only Sent POs are receivable. Line items of non-Draft POs are
   immutable. Finalized = parent PO `status` not in (`Draft`, `Pending Approval`) — mirrors the
   existing header guard's case-insensitive semantics. New trigger
   `trg_prevent_finalized_po_item_mutation` on `purchase_order_items` BEFORE UPDATE/DELETE raises
   on any write under a finalized parent. Send minimum: stamp the three fields; if `email_sent`
   is true and `sent_date` is not null, Send returns success with no change (idempotent) unless an
   explicit force flag is passed; email transport itself is later (§10).
7. **GRN.** `post_goods_receipt` gains: over-receipt guard (`received ≤ balance`), PO-item
   balance update (`received_qty`/`balance_qty`), real `vendor_id` from the PO. Receipts drive
   procurement status (PO Raised → Received) — no more honor-system dropdown for these transitions.
   Non-regression: the manufacturing GRN world (`record_procurement_grn_atomic`,
   `goods_receipt_notes`) is untouched — separate tables, separate flow, stays separate.
8. **Bill / verify.** Fix bill line total to include IGST consistently with the header; 3-way match
   compares against real PO value (possible only after rule 5 kills zero-value POs).

## 6. Loopholes to close (ranked)

- **P0:** double-convert (idempotency keys); zero-value POs (atomic create); GRN over-receipt +
  stale PO balances; PO line items editable after finalization (trigger gap).
- **P1:** procurement vendor ignored at Link PO (validate vendor match on link); phantom `po_qty`
  with no PO (reconcile on convert/delete); inquiry `status` never reaches Closed; release-rules
  empty (seed decided catch-all in Phase 2 setup).
- **P2:** duplicate/zero-qty launch rows; PO approval engine wrong-entity call
  (`approvals/api.ts` `purchase_orders` case); V2 vendor filter on nonexistent `is_active`;
  racy numbering (PO series, `AI-YY-xxxx`, vendor codes); unwritten sent/acknowledged fields.

## 7. Architecture notes

- Two parallel worlds share no IDs: procurement lists (quote/BOQ origin) vs
  requisitions → inquiries → POs (buying engine), bridged only by manual name-match.
  The bridge becomes ID-based: procurement rows link to requisition lines; inquiry lines link
  back to procurement rows; PO items carry both. Exact columns (all nullable-first, via a
  `supabase migration new` migration when approved): `procurement_items.requisition_line_id`,
  `availability_inquiry_lines.procurement_item_id`, `purchase_order_items.procurement_item_id`
  (`requisition_line_id` and `inquiry_line_id` already exist on PO items). Transition: backfill
  via the current name-match once, then enforce IDs on all new writes; name-match remains a
  read-only fallback during transition. Transition verification: after backfill, sample N
  procurement rows — confirm `requisition_line_id` populated where a unique name-match exists,
  and list ambiguous matches to archive/resolve before enforcing IDs. During transition both
  paths stay live, but every Convert — old or new path — goes through
  `create_purchase_order_atomic` with an idempotency key.
- The safe server core (`create/approve_purchase_order_atomic`, posted-mutation guards,
  `purchase_audit_log`) is adopted, not bypassed. Client direct-inserts on these tables stop.
- Status discipline: free-text columns stay, but every transition is event-driven (server or
  validated action), never a free dropdown jump — except an explicit manual-override with reason,
  audited.

## 8. Phased plan (all phases await approval)

- **Phase 1 — stop the bleeding (procurement + quotation screens only) — BLOCKED on stock source:**
  vendor-disable on In-Stock rows; launch reuse + dedupe + zero-qty skip; unify launch-cover math
  with availability screen; Link-PO vendor-match validation.
- **Phase 2 — bridge the worlds:** catch-all rule seed + migration notes; "Raise requisition" from
  gap rows with back-links; procurement vendor as inquiry default; single gap formula + canonical
  stock source everywhere.
- **Phase 3 — real PO release:** atomic Convert; Approve + Send steps; GRN guards + balance updates;
  event-driven statuses; PO-items mutation trigger.
- **Phase 4 — reconciliation:** clean live anomalies archive-first: duplicate trackers get
  `status = 'Archived'` + `archived_at`, reason prepended to `notes` as
  `[timestamp + actor + reason]` (no `archived_reason` column exists; actor via `purchase_audit_log`
  where the column is absent); phantom `po_qty` reconciled against surviving POs, never silently
  zeroed. Hard-delete only if strictly required and logged. `inventory` fate per §10 decision;
  full release-rules matrix (if ever); bill IGST fix.

## 9. Verification (per phase, against remote)

- Phase 1: launch QT0002 → still 3 lists, 4th launch reuses; In-Stock rows unselectable vendor.
  Cover-equality (one quote item, both surfaces, same `item_id` + org, unit precision as stored;
  cross-UOM lines excluded from the assertion):
  `select s.item_id, sum(greatest(s.current_stock - coalesce(r.reserved_qty, 0), 0)) as atp, sum(s.current_stock) as gross from item_stock s left join (select item_id, warehouse_id, sum(qty) as reserved_qty from sales_order_reservations group by 1, 2) r on r.item_id = s.item_id and r.warehouse_id = s.warehouse_id where s.item_id = '<item>' group by 1;`
  Both surfaces must equal the locked source exactly.
- Phase 2: catch-all rule present and matched; requisition from tracker carries back-link IDs;
  inquiry defaults vendor; one gap number on all screens for a sampled item.
- Phase 3: double-click Convert → 1 PO; GRN over-receipt raises; PO edit after Send raises;
  receipt flips procurement status without manual edit.
- Phase 4: `po_qty ≤ requested` on all lines; zero `pending`-forever sent lines; archive rows carry
  reason + actor; release rule matched per purpose/amount.

## 10. Not yet specified (fog — graduates as scope is approved)

- Canonical stock source — **ON HOLD, Phase 1 blocked.** (a) ATP verbatim from the modal
  (preferred on substance): per (item, warehouse) flooring, summed. (b) Gross — recorded, rejected
  on substance while reservations exist.
- `inventory` fate (audit done §4): retire-and-repoint (recommended) vs populate-and-keep. Decided
  with the stock source; lands in Phase 2 (approval RPC).
- Live cleanup survivor rule: newest open tracker per quote survives, older archive (proposed,
  unconfirmed).
- PO Send transport: stamp-only now vs real email later (fields already exist).

## 11. Out of scope

- Manufacturing GRN world (`record_procurement_grn_atomic`, `goods_receipt_notes`) unification —
  separate effort if ever; this PRD only requires it not regress.
- Vendor price comparison / rate contracts (no price columns exist; out of this destination).
- `PurchaseOrdersV2.tsx` revival or removal (flagged, not this effort).
- CEO dashboard, Stitch quotation UI, channel collaboration (other efforts).
- Cross-UOM conversion (mismatched units surface as-is; excluded from equality assertions).
- PO email transport (Send stamps fields; delivery is later).
