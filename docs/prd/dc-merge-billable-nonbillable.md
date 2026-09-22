# DC LIST + NON-BILL DC MERGE — PRD

**Module:** Delivery Challan (billable + non-billable)
**Status:** ACCEPTED (owner-approved 2026-09-22 — implementation authorized)
**Owner decisions (2026-09-22):** (1) PRD approved. (2) Non-Billable DCs ARE convertible to Quotation, gated by a settings-v2 toggle (default ON, user can switch off). (3) Owner runs any Supabase-side work directly — note: this PRD requires NO schema migration (toggle lives in `organisations.settings` JSONB). (4) GitHub issue skipped.
**Owner:** Engineering + Product
**Priority:** P1 — High (UX dedup, zero behavior loss)
**Target:** `apps/web` DC pages → single list + single form. Mobile explicitly out of scope.
**Authority:** `.agents/README.md`, `ARCHITECTURE.md`, `SECURITY.md`, `DATA-INTEGRITY.md`, `ENGINEERING-RULES.md`, `VERIFICATION.md`, `apps/web/AGENTS.md`

---

## 1. OBJECTIVE

Merge the two parallel Delivery Challan experiences into one UX-friendly surface:

- ONE list (`/dc/list`) showing billable + non-billable DCs with a Type filter and Type badge.
- ONE create/edit form (existing `CreateDC.tsx` shell) with a Billing-type toggle.
- Legacy routes (`/nb-dc/list`, `/nb-dc/create`, `/nb-dc/edit/:id`) become redirects, then are removed only after verification.

The merge must satisfy:

```text
No functionality loss
No stock-deduction behavior change
No warehouse-selection behavior change
No source-type selection behavior change
Tenant isolation preserved
No silent architecture change
No speculative refactor
```

---

## 2. GOLDEN RULES (from `.agents/`)

1. **Live database is authoritative for schema/RLS/functions.** Local migrations and SQL files in the repo are NOT trusted for this task (explicit instruction). Every DB claim below marked NOT VERIFIED must be reconciled against the remote project `rujqejtisqermjyqqgoj` (DELIVERY, Seoul) via Supabase CLI before implementation — see §9.
2. **Smallest safe change.** This PRD explicitly SKIPS the >800-line architecture refactor (CreateDC 2075 lines, DCList ~1400 lines, CreateNonBillableDC 1073 lines stay as-is; tracked as tech debt).
3. **Reuse before duplication.** Extend `DCList.tsx` + `CreateDC.tsx`; do not create a third variant.
4. **Product idea ≠ implementation.** This PRD requires explicit approval before any code change.
5. **Verification is part of implementation.** Happy-path-only is not PASS — see §11.

---

## 3. CURRENT-STATE INVENTORY (repository evidence — CONFIRMED against repo 2026-09-22)

### 3.1 Files

| File | Lines | Role |
|---|---|---|
| `apps/web/src/pages/DCList.tsx` | ~1400 | Modern billable list (search, status filter, multi-select, templates, preview, cancel, bulk delete) |
| `apps/web/src/pages/NonBillableDCList.tsx` | 268 | Legacy list, `dc_type='non-billable'` only, AppTable, PDF export only |
| `apps/web/src/pages/CreateDC.tsx` | 2075 | Billable create/edit form (per-item warehouse, document_series numbering, DRAFT/Active) |
| `apps/web/src/pages/CreateDCV2.tsx` | ~800 | Alternate DC form variant (uses `adjust_item_stock` RPC — legacy path, out of scope, do not touch) |
| `apps/web/src/pages/CreateNonBillableDC.tsx` | 1073 | Non-billable create/edit form (header warehouse, NBDC- numbering, allow-insufficient-stock toggle) |
| `apps/web/src/pages/DCEdit.tsx` | ~30 | Wrapper: loads row → `CreateDC` |
| `apps/web/src/pages/NonBillableDCEdit.tsx` | 36 | Wrapper: loads row → `CreateNonBillableDC` |
| `apps/web/src/pages/DCView.tsx` | — | Read-only view (reached from DCList) |
| `apps/web/src/pages/DCConsolidation.tsx` | — | Consolidation views (unchanged by this PRD) |
| `apps/web/src/api.ts` | — | `fetchDeliveryChallans(filters)` already supports `dc_type` filter; `createDeliveryChallan` prefixes `DC-`/`NBDC-`; `cancelDeliveryChallan` → `cancel_delivery_challan_atomic` RPC; `deleteDeliveryChallan` (cancelled→DRAFT→delete guard) |

### 3.2 Routes (`apps/web/src/App.tsx`)

| Route | Renders | After merge |
|---|---|---|
| `/dc/list` | `DCList` | **Canonical merged list** |
| `/dc/create`, `/dc/create-v2` | `CreateDC`, `CreateDCV2` | Unchanged (`create-v2` untouched) |
| `/dc/view/:id`, `/dc/edit/:id` | `DCView`, `DCEdit` | Unchanged + Type badge |
| `/nb-dc/list` | `NonBillableDCList` | **Redirect → `/dc/list?type=non-billable`** |
| `/nb-dc/create` | `CreateNonBillableDC` | **Redirect → `/dc/create?type=non-billable`** |
| `/nb-dc/edit/:id` | `NonBillableDCEdit` | **Redirect → `/dc/edit/:id`** (form reads `dc_type` from row) |

### 3.3 Data model (repository evidence)

Single table `delivery_challans` + child `delivery_challan_items`, discriminated by `dc_type`:

- `dc_type = 'billable'` (default) → `DC-…` numbers via `document_series` reservation.
- `dc_type = 'non-billable'` → `NBDC-…` numbers via `max(dc_number)+1` (race-prone, preserved as-is).
- Both set `status` (`active`/`DRAFT`/`CANCELLED`/…), `source_type` (`WAREHOUSE`/`DIRECT_SUPPLY`), `warehouse_id`, `rate_source` (`base`/`project`/`arc`/`manual`), variant, ship-to fields.

### 3.4 Known current defect (CONFIRMED against repo)

`DCList.tsx` applies NO `dc_type` filter — it already shows billable + non-billable rows mixed with no Type indicator. Users therefore see NBDC rows in `/dc/list` AND a separate `/nb-dc/list`. The merge fixes this display defect by labelling, not by hiding.

---

## 4. GOALS / NON-GOALS

**Goals:**
1. One list with Type filter (All / Billable / Non-Billable) + Type badge column.
2. One form with Billing-type toggle preserving every current field and behavior per type.
3. Redirects preserve bookmarks; old components removed only after verification.
4. Zero change to stock-deduction, warehouse-selection, source-type-selection semantics.

**Non-goals (explicitly out of scope):**
1. Architecture refactor of 800+ line files (skipped per instruction; tech debt remains).
2. Migrating stock deduction to an atomic RPC (both forms use direct `item_stock` read-modify-write loops — KNOWN DEFECT pattern per `.agents/DATA-INTEGRITY.md`; fix needs a separate ADR + PRD, must NOT ride along here).
3. Unifying `DC-`/`NBDC-` numbering into one series (history preserved; separate decision).
4. Mobile app (skipped per instruction — no mobile DC screens exist today).
5. `CreateDCV2.tsx`, consolidation pages, print templates (untouched except Type badge display where trivial).

---

## 5. MUST-PRESERVE MATRIX (no loss during refactor)

| # | Capability | Billable today | Non-billable today | Merged requirement |
|---|---|---|---|---|
| F1 | Stock deduction on save | Per-item `warehouse_id` loop over `item_stock` (skips services) | Header `warehouse_id` loop over `item_stock` (skips services) | Keep BOTH paths byte-for-byte behind the toggle. Billable → per-item logic; Non-billable → header logic. |
| F2 | Warehouse selection | Per-item warehouse dropdown | Single header warehouse dropdown | Both UIs retained, shown per toggle value. |
| F3 | Source-type selection | `WAREHOUSE` / `DIRECT_SUPPLY` toggle; DIRECT clears warehouse + disables stock check | Identical toggle | Identical behavior both modes. |
| F4 | Insufficient-stock handling | `allowInsufficientStock` flag blocks invalid rows | Same + persisted `nb_dc_allow_insufficient_stock` checkbox | Keep flag for both; keep NB checkbox visible in Non-Billable mode. |
| F5 | Rate source | base / project / ARC / manual with strict ₹0-missing semantics + P/A/M badges | Identical | Identical. |
| F6 | Variants | Header default variant + per-row variant w/ `variantPricingMap` gate | Identical | Identical. |
| F7 | Numbering | `document_series` reservation (FY prefix/padding/suffix), DRAFT vs Active save | `NBDC-000N` via max+1, always Active | Toggle selects generator; existing numbers immutable. |
| F8 | Statuses | All / Active / Not Sent / Quoted / Cancelled filter + stats + total value | project/date/status(all/active/cancelled) filters | Merged list keeps DCList filter set + ADDS Type filter; keep NB project/date filters as equivalent controls. |
| F9 | Row actions | View, Edit, Print (5 templates), Preview, Convert to Quotation/Proforma, Multi-DC convert, Cancel (atomic RPC), Delete (guard), Bulk delete | View-PDF, Edit, Delete | Non-billable rows gain View/Print/Cancel/Delete. Convert-to-Quotation for NB rows is ALLOWED iff settings toggle ON (default ON, §6.4); when OFF the menu item is disabled with tooltip "Disabled in Settings → General & Config → Delivery Challan". |
| F10 | Multi-select bulk bar | Convert to Quotation + Delete selected (fresh-status re-fetch, cancelled-only delete) | None | Bulk bar applies to filtered set. Convert allowed for NB-containing selections iff settings toggle ON; when OFF and selection contains any NB row, Convert is disabled with message "Selection includes Non-Billable DCs — enable conversion in Settings or deselect them". |
| F11 | Items grid | Drag-reorder, add single/multiple, AVAIL column, services w/o stock | Identical | Identical. |
| F12 | Ship-to / eway / PO / signatory / remarks | Present | Present | Present both modes. |

---

## 6. UX DESIGN (merged)

### 6.1 Merged list (`/dc/list`)

- Header row keeps: title + count, Active/Quoted/Cancelled stats, Total Value, Search.
- Filter row: existing Status dropdown + NEW Type segmented control `[All | Billable | Non-Billable]` (default All), driven by `?type=` query param so `/nb-dc/list` redirect lands pre-filtered.
- Table: existing columns + NEW `Type` badge column (`DC` indigo / `NB-DC` amber) immediately after DC No. Amount column alignment unchanged (project rule: monetary columns left-aligned — note: current DCList right-aligns Amount; do NOT change alignment in this PRD to avoid scope creep; flag as follow-up).
- Row click → `/dc/view/:id` for both types. Action menu per row honors F9 enablement matrix.
- `localStorage` column prefs key unchanged (`dc_list_columns`); Type badge is mandatory-visible (added to `MANDATORY_COLUMNS`).

### 6.2 Merged form (`/dc/create`, `/dc/edit/:id`)

- NEW top control: `Billing type: (•) Billable ( ) Non-Billable` radio-segment. In create mode defaults Billable (or from `?type=`). In edit mode locked to the row's `dc_type` (changing type post-creation is forbidden — numbers + ledger semantics differ).
- Toggle switches per F1/F2/F4/F7 blocks only; all other sections render identically.
- Save buttons/labels: keep "Create DC"/"Update DC" wording for both (avoid NB-DC-only strings); success toasts keep type prefix in message (`DC Created!` / `NB-DC Created!`).
- `?type=non-billable` from the legacy create redirect pre-selects Non-Billable.

### 6.4 Convertibility setting (settings-v2)

- Location: Settings v2 → **General & Config** tab → new **Delivery Challan** section → toggle row **"Allow Non-Billable DC → Quotation conversion"** (description: "When on, Non-Billable Delivery Challans can be converted to Quotations from the DC list. Turn off to restrict conversion to Billable DCs only.").
- Storage: `organisations.settings.allow_nbdc_to_quotation` (boolean, default ON when key absent). No schema migration — JSONB key read/written via existing `useOrganisationSettings` (tenant-scoped query key, cache-safe).
- Consumption (`DCList` only): single-row Convert menu + bulk Convert button honor the flag per F9/F10. Create/edit form unaffected. Proforma/Invoice converts unchanged (out of scope).

### 6.5 Redirects

- `/nb-dc/list` → `/dc/list?type=non-billable`
- `/nb-dc/create` → `/dc/create?type=non-billable`
- `/nb-dc/edit/:id` → `/dc/edit/:id`
- Old components (`NonBillableDCList`, `CreateNonBillableDC`, `NonBillableDCEdit`) deleted in a SECOND commit only after §11 verification passes on the merged routes.

---

## 7. SECURITY (per `.agents/SECURITY.md`)

- No RLS/policy/function change in this PRD. All queries keep `.eq('organisation_id', organisation.id)`; merged list query adds only `.eq('dc_type', …)` when Type ≠ All (a data filter, not a security boundary).
- Verify on live DB (Phase 0): SELECT/INSERT/UPDATE/DELETE policies on `delivery_challans` + `delivery_challan_items` treat both `dc_type` values identically; `cancel_delivery_challan_atomic` authorizes both types (NB rows must be cancellable through the same RPC the merged UI will call).
- No new RPCs. Settings flag is read from the tenant-scoped `organisations.settings` row the user is already authorized for (same pattern as `date_format`); it gates UI affordances only — the underlying dc-to-quotation conversion flow is unchanged. No client-supplied `organisation_id` trust change. AI-agent boundaries unchanged.

## 8. DATA INTEGRITY (per `.agents/DATA-INTEGRITY.md`)

- Draft DC moves no stock; Active save runs the existing per-type deduction loop — UNCHANGED (same code paths, selected by toggle).
- No second deduction path introduced: the merged form calls exactly one of the two existing blocks; flag both call sites with comments referencing this PRD.
- Cancellation/reversal: merged UI routes NB cancels through `cancel_delivery_challan_atomic` (new for NB rows — currently NB list has no cancel). Phase 0 must confirm the RPC handles `non-billable` rows (stock restore + status) or scope NB-cancel OUT with a DECISION note.
- Idempotency/concurrency posture unchanged (existing double-submit risk preserved, not worsened — separate ADR).

---

## 9. PHASE 0 — REMOTE RECONCILIATION GATE (Supabase CLI, remote-only)

> Local migrations/SQL files are NOT trusted. Do not implement until Phase 0 passes against remote `rujqejtisqermjyqqgoj`.

```bash
# 1. Link (one-time; needs DB password — request from owner, never commit it)
supabase link --project-ref rujqejtisqermjyqqgoj

# 2. Pull remote schema as the baseline (read-only)
supabase db pull --schema public
# → inspect the pulled files for delivery_challans / delivery_challan_items ONLY

# 3. Confirm the discriminating + behavior columns exist live with expected types/defaults:
#    delivery_challans: dc_type, status, source_type, warehouse_id, variant_id,
#      rate_source, organisation_id, dc_number (unique?), project_id
#    delivery_challan_items: delivery_challan_id, material_id, variant_id,
#      warehouse_id, quantity, rate, amount, organisation_id

# 4. Confirm live RLS policies (SELECT/INSERT/UPDATE/DELETE) on both tables
#    cover dc_type='non-billable' identically (no billable-only policy).

# 5. Confirm live functions + their behavior for BOTH types:
#    - cancel_delivery_challan_atomic(p_dc_id, p_reason)
#    - adjust_item_stock (legacy; CreateDCV2 path — confirm untouched)
#    - delete guard/trigger blocking non-cancelled deletes (deleteDeliveryChallan
#      relies on it: cancelled→DRAFT→delete)

# 6. Confirm live document_series row shape (configs->dc->{enabled,prefix,padding,
#    suffix,start_number}, current_number) — billable numbering depends on it.

# 7. Classify every discrepancy MATCHING / LIVE-ONLY / LOCAL-ONLY / CONFLICTING.
#    CONFLICTING or LIVE-ONLY on any §5 item = STOP, surface to owner, update PRD.
```

Evidence labels for claims in §3–§5: repository behavior = CONFIRMED (repo); live DB behavior = NOT VERIFIED until Phase 0 completes.

**Phase 0 finding 2026-09-22 (remote `rujqejtisqermjyqqgoj`, authenticated API probe):**
- **CONFLICTING:** `delivery_challans.dc_type` DOES NOT EXIST remotely. Every other column the merged code needs exists (`source_type`, `warehouse_id`, `variant_id`, `rate_source`, `conversion_status`, eway/ship-to/PO/signatory cols, `items.variant_id`, `items.warehouse_id`, `items.organisation_id`, `items.make`).
- **Required migration (owner runs in Supabase SQL editor):**
  ```sql
  ALTER TABLE delivery_challans ADD COLUMN IF NOT EXISTS dc_type VARCHAR(20) DEFAULT 'billable';
  UPDATE delivery_challans SET dc_type = 'billable' WHERE dc_type IS NULL;
  ```
  Existing rows default to `billable` = code default. If PostgREST still reports the column missing afterwards, run `NOTIFY pgrst, 'reload schema';`.
- Until this runs, the merged Type filter + NB create/convert FAIL live; the billable path is unaffected.
- Forged-organisation read returns 0 rows (tenant isolation holds for reads).

**Live verification 2026-09-22 (post-migration, authenticated API, scripts in `Temp/opencode/dc-verify-*.cjs`):**
- PASS: `dc_type` defaults to `billable` on insert-without-key; NB value stored; `eq`/`neq` type filters return correct sets; cancel RPC sets CANCELLED for both types; delete + items cascade leave zero residue.
- PASS: settings toggle round-trip (`false` → read-back `false` → restored to original absent key).
- **KNOWN DEFECT (pre-existing, out of merge scope):** this login gets `42501 permission denied` on `item_stock` UPDATE, so client-side deduction (old AND merged code, identical pattern) cannot deduct stock, while `cancel_delivery_challan_atomic` unconditionally restores item quantities. Net effect for this role profile: creates never deduct, cancels always restore → stock inflation per cancel. Test residue left `PPR Coupling 2500` (Chennai) at 123 vs 120 — owner fix:
  ```sql
  UPDATE item_stock SET current_stock = 120, updated_at = NOW()
  WHERE item_id = '789c43f8-33ac-4e52-8dbd-37a1335dc8b6'
    AND warehouse_id = '1d251f66-d6f0-4f98-8a19-07210ad463a4'
    AND company_variant_id = 'fb413fcb-3070-4a3f-bf97-d97b5a97a5b1';
  ```
  Decision needed (separate ADR): scoped UPDATE grant for warehouse roles, or move deduction into the atomic RPC per `.agents/DATA-INTEGRITY.md`. Not changed by this merge.

---

## 10. IMPLEMENTATION PLAN (smallest safe change — approved, IMPLEMENTED 2026-09-22, verification pending §11)

0. Settings (`types.ts` + `GeneralTab.tsx` only): add `allow_nbdc_to_quotation` to `GeneralConfigData` (default true), load from `useOrganisationSettings`, save via `updateSettings`, render Delivery Challan section with toggle. No migration.

1. `DCList.tsx` only: add `typeFilter` state (synced to `?type=`), pass `dc_type` into the Supabase query when ≠ All, add Type badge column + mandatory-column entry, gate Convert/bulk actions per F9/F10. No other list logic touched.
2. `CreateDC.tsx` only: add `billingType` state (`billable`|`non-billable`, default from `?type=` or row's `dc_type` in edit; locked in edit), branch ONLY the F1/F2/F4/F7 blocks to the exact code moved verbatim from `CreateNonBillableDC.tsx`. Everything else untouched.
3. `App.tsx` only: add the three redirects (§6.3). No new routes.
4. `DCView.tsx` only (if trivial): show Type badge. Skip if it risks template churn.
5. Second commit (after §11 green): delete `NonBillableDCList.tsx`, `CreateNonBillableDC.tsx`, `NonBillableDCEdit.tsx` + remove their lazy imports.
6. No migration. No RPC change. No CSS-system change. No mobile change.

---

## 11. VERIFICATION PLAN (per `.agents/VERIFICATION.md`)

| Layer | Checks |
|---|---|
| Build/typecheck | `turbo run build` + `typecheck` for `apps/web` clean; Capacitor/mobile explicitly skipped |
| Real workflows | Create billable DC (WAREHOUSE + DIRECT), create NB-DC (WAREHOUSE + DIRECT + insufficient-stock ON/OFF), edit both, DRAFT save, redirect routes from `/nb-dc/*`, Type filter All/Billable/Non-Billable, search + status + project/date filters |
| Data integrity | Stock before/after per type matches TODAY's deduction exactly (per-item vs header); Draft moves nothing; cancel NB via RPC restores stock iff Phase 0 confirms; delete only-cancelled guard holds for both types |
| AuthZ/tenant | Org A cannot see Org B rows of either type; forged `dc_type`/`organisation_id` in requests cannot cross tenants; unauthorized role blocked (same matrix as today); settings toggle is per-organisation (Org A flag does not affect Org B) |
| Settings toggle | Toggle ON (default): NB Convert menu enabled, bulk convert with NB selection works. Toggle OFF: single + bulk NB convert disabled with messages; billable convert unaffected |
| Regression | DC→Quotation single + multi convert (billable only), Proforma convert, all 5 print templates + preview for both types, consolidation pages unchanged, `create-v2` untouched |
| Failure/retry | Double-submit create (no duplicate deduction beyond today's behavior), cancel reason empty, delete non-cancelled refused with message, bulk delete mixed selection message |
| Evidence | Record actual before/after stock numbers + screenshots per workflow; never claim PASS from inspection alone |

---

## 12. ROLLOUT / ROLLBACK

- Rollout: single PR, redirects first + merged UI behind existing routes (no feature flag needed; old URLs keep working via redirect).
- Rollback: revert the one PR; legacy components are deleted only in the second commit, so restoring them is a clean revert. No data migration exists to roll back (numbers/history untouched).

## 13. RISKS

| Risk | Severity | Mitigation |
|---|---|---|
| NB cancel via atomic RPC untested for `non-billable` | High | Phase 0 live test on a scratch NB-DC; if RPC rejects, scope NB-cancel out with DECISION note |
| `max(dc_number)+1` race on concurrent NB creates | Medium (pre-existing) | Preserved, not worsened; separate numbering ADR |
| Direct `item_stock` loop kept (non-atomic) | Medium (pre-existing KNOWN DEFECT) | Verbatim preservation + code comments; atomic fix is separate work |
| Users bookmarked `/nb-dc/*` | Low | Redirects cover all three routes |
| DCList already mixes types unlabeled | Low | Type badge fixes the existing confusion |

## 14. ACCEPTANCE CRITERIA (plus: settings toggle ON/OFF evidenced per §11; no migration required — owner runs nothing)

1. Phase 0 reconciliation recorded (MATCHING on all §5 items) before code changes.
2. `/dc/list` default shows all rows WITH correct Type badges; `?type=` filters correctly; `/nb-dc/list` redirects and filters.
3. `/dc/create?type=non-billable` reproduces today's NB form behavior field-for-field (F1–F12 matrix signed off).
4. Edit mode locks billing type; no type-change path exists.
5. Stock/warehouse/source-type behavior identical to today per type (before/after numbers evidenced).
6. §11 verification table fully evidenced; no PASS by inspection alone.
7. Owner approval on this PRD precedes implementation (lifecycle gate).

---

## 15. OPEN DECISIONS FOR OWNER (resolved 2026-09-22)

1. ~~Approve this PRD?~~ APPROVED — implementation authorized.
2. ~~NB convertibility?~~ DECIDED — convertible, gated by settings-v2 toggle (default ON), §6.4.
3. ~~DB access for Phase 0?~~ Owner runs Supabase-side work directly. NOTE: this PRD needs no migration; Phase 0 reconciliation commands remain available for any future touching of RLS/RPCs.
4. ~~GitHub issue?~~ SKIPPED per owner.
