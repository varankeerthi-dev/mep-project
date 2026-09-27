# ADR-001: Atomic Delivery Challan lifecycle (server-side stock enforcement)

- **Status:** ACCEPTED
- **Date:** 2026-09-22
- **Context:**
  - Delivery Challan creation deducts stock via client-side read-modify-write loops on `item_stock` (`CreateDC.tsx`, `CreateNonBillableDC.tsx`, merged form).
  - Live verification 2026-09-22 proved: (a) real roles get `42501 permission denied` on `item_stock` UPDATE, so creates silently skip deduction; (b) `cancel_delivery_challan_atomic` unconditionally restores item quantities, so every cancel inflates stock (observed 120 → 123 on test rows).
  - The cancel RPC source is LIVE-ONLY (not in repo migrations) and cannot be audited; its blind-restore behavior is CONFIRMED by observation.
  - `.agents/DATA-INTEGRITY.md` requires atomic server-side transitions with duplicate-prevention; the current DC path is non-compliant.
- **Decision:**
  1. Add `create_dc_atomic` RPC: single transaction for numbering + header + items + stock deduction + movement ledger, with per-call idempotency key and insufficient-stock policy flag. `SECURITY DEFINER`, gated by `user_can_access_org`.
  2. Add `cancel_dc_atomic` RPC: row-locked, org-scoped cancel that restores stock exactly once; double-cancel raises instead of re-restoring. Supersedes (does not replace) the legacy cancel RPC.
  3. Extend `material_logs` with nullable movement columns (`warehouse_id`, `company_variant_id`, `movement_type`, `reference_id`, `quantity_change`) so DC deductions/reversals are auditable in the canonical ledger. Additive only, no backfill.
  4. App migrates `saveDC`/`cancelDeliveryChallan` call sites to the new RPCs; client-side stock loops are deleted, not kept as fallback.
  5. Stricter-than-legacy rule (explicit, intended): WAREHOUSE-source deductions with no stock row or insufficient qty FAIL LOUD (exception) unless the caller passes `p_allow_insufficient = true`. The legacy silent skip is classified as a defect, not behavior to preserve.
- **Alternatives considered:**
  - *Grant scoped UPDATE on item_stock to warehouse roles, keep client loops.* Rejected: preserves read-modify-write races, double-submit duplication, and partial-failure corruption; grants cannot fix atomicity.
  - *Replace the legacy cancel RPC in place.* Rejected: its source is unknown (LIVE-ONLY); in-place replacement risks breaking unknown dependents. Supersede + switch call sites instead.
  - *Fit DC movements into material_logs' existing site-receipt columns.* Rejected: wrong grain (no warehouse/variant movement fields live); nullable extension is cleaner.
- **Consequences:**
  - Stock can no longer silently skip deduction; failures surface as errors (may increase visible error rate initially — this is intended observability).
  - Double-submit/double-cancel cannot duplicate transitions (idempotency key + cancelled-state guard).
  - Client no longer needs UPDATE on `item_stock` (least privilege improves).
  - Numbering moves server-side (series reservation under row lock; NB max+1 under per-org advisory lock) — eliminates the NB race.
  - Requires owner-run migration (`20260922000002_dc_atomic_lifecycle.sql`); app wiring follows in a second change after live function verification.
- **Evidence/verification:**
  - Live probes 2026-09-22 (scripts `Temp/opencode/dc-verify-*.cjs`): 42501 on client UPDATE; blind restore +3 on cancel; column inventory for header/items/ledger tables.
  - **PART6 PASS 2026-09-22** (`dc-verify-6.cjs`, PPR PIPE PN16 110MM @ Chennai, SAKTHI org): billable create delta exactly 2 + ledger row; double-submit same key → duplicate, no re-deduction; NB create (`NBDC-0001`) delta exactly 1; insufficient strict raises with clear message, zero movement; forged org denied; 2× parallel creates → unique numbers, exact total delta; cancel ×4 → stock restored exactly (100→100) with 4 reversal rows; double-cancel raises, zero movement; all VERIFY docs deleted, stock unchanged start-to-finish.
  - Incidents during verification (all resolved, no residue): test target material deleted mid-session by owner activity (re-picked live target); ledger insert needed legacy `type` OUT/IN (migration fixed + pushed); one `DC00002` series gap from the aborted FK run (count-fallback numbering; series-enabled orgs use the row-locked path).
  - **PART8 PASS 2026-09-22** (`dc-verify-8.cjs`, draft semantics on amended RPCs): DRAFT create reserves number, stores docs, moves zero stock, writes zero ledger rows; draft cancel → CANCELLED with zero restore and zero reversal rows; test doc deleted, stock 100 start-to-finish.
  - **App wiring complete** (commit `1086f403`): merged-form create path calls `create_dc_atomic` (per-submit idempotency key, duplicate retries skip intent/conversion side-effects); client stock loop deleted; cancel path calls `cancel_dc_atomic`; edit path unchanged; build green, zero new typecheck errors vs baseline.
- **Supersedes/superseded-by:** none. Related: PRD `docs/prd/dc-merge-billable-nonbillable.md` §8 (NB-cancel scoping now resolved: NB cancels through the guarded RPC).
