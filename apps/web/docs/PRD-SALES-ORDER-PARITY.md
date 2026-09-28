# PRD — Sales Order Competitive Parity (QuickBooks / Zoho Books)

Source of truth: remote Supabase project `rujqejtisqermjyqqgoj` + repo code.
Status: **Phases 1, 2, 4, 5, 6 implemented; Phase 3 SO-side done (invoice-editor side skipped per scope call). Headless verification PASS (see verdict 2026-09-27); human workflow paths pending.**
Parent context: `apps/web/docs/PRD-PROCUREMENT-PO-RELEASE.md` (buying chain),
`.agents/VERIFICATION.md`, `.agents/ENGINEERING-RULES.md`.

## 1. Destination

Sales orders reach competitive parity on billing-completion workflows while keeping
our two moats (manufacturing linkage, channel collaboration). Every phase below ships
independently behind its verification gate; later phases never start on unverified
earlier ones. The map is done when all phases are implemented, verified, and the fog
is empty.

## 2. Notes

- Every session consults: this PRD, the procurement PRD, `.agents/VERIFICATION.md`
  (build, workflow, DB integrity, RLS, regression, failure/retry, performance),
  `.agents/ENGINEERING-RULES.md` (investigate, reuse, smallest change, migrations
  reproducible, observable failures).
- Standing preferences: reuse server RPCs before new code; reuse `src/components/document/`
  shell before new UI; no silent architecture changes; remote verification after each phase.
- Browser-driven QA remains unavailable in this environment; each phase's workflow layer
  specifies the exact click-paths for human or future browser-agent verification.
- Cross-cutting, every phase: RBAC check (list/detail/create gated consistently),
  mobile-equivalent impact note per repo `AGENTS.md`, ASCII-safe edits, esbuild clean.

## 3. Decisions so far

- Reusable document shell is the UI vehicle; engines stay module-specific (locked).
- SO status is driven by fulfillment events, never by conversion (locked; see §5 Phase 3).
- ATP stock source still on HOLD (procurement PRD §10) — Phase 4 reservation math
  reuses whichever source gets locked there; this PRD does not re-decide it.
- `conversion_status` on sales_orders records onward conversion only (locked).

## 4. Against the competition (explicit)

Source features verified from vendor docs, August 2026 or current help pages.

| # | Capability | QuickBooks Online Plus/Advanced | Zoho Books | This app today |
|---|---|---|---|---|
| 1 | SO as non-posting commitment | Yes — reserves stock, books untouched | Yes — draft/open states | Partial — reservations exist but manual-only |
| 2 | Quote → SO → Invoice chain | Estimate → SO → Invoice | Accepted quote → SO → Invoice | Quote → SO built; SO → Invoice framework-only (editors don't prefill) |
| 3 | Partial invoicing | Yes — many invoices per SO, statuses Invoiced/Paid | Yes — signature feature, per-line selection | No — no invoice linkage at all |
| 4 | SO → Purchase Order | Yes, incl. auto at reorder threshold | Yes, one click to vendor | No — shortfall dead-ends at job cards |
| 5 | Reserve on confirm | Automatic on order | Automatic | Manual panel only |
| 6 | Close / mark shipped | Mark shipped, Close order | Custom statuses (delivered/dispatched/invoiced) | Statuses exist, no transitions wired |
| 7 | Billing on shipment | Invoice on ship flow | Ship stock, partial invoice | No ship event in SO lifecycle |
| 8 | Templates / branding | Custom templates + fields, bundles, attachments | Full branding, logo/colors, clones | 1 SO template row, zero consumers |
| 9 | PDF print/download | Yes | Yes | Dead button → browser print fallback |
| 10 | Approval workflows | Basic approvals | Full automated multi-level | Submit flow exists, reviewer side thin |
| 11 | Email / send / portal | Email, print, share link | Email, portal, clones | Fields exist (`email_sent`), nothing writes them |
| 12 | Attachments | Yes | Yes | Empty-state tab only |
| 13 | Import | Bulk transactions | CSV/TSV/XLS + auto-number option | No |
| 14 | Multi-currency | Yes (irreversible once on) | Yes | No |
| 15 | Recurring documents | Recurring invoices/payments | Recurring invoices | No |
| 16 | Reports / insights | BI suite, margins, WIP | Real-time sales reports | None for sales |
| 17 | Manufacturing linkage | No (separate SKUs) | No | **Yes — job cards, MRP, production auto-reserve. Moat 1.** |
| 18 | Project collaboration | No | Comments only | **Yes — channel cards, decisions, threads. Moat 2.** |

Reading: rows 1–2 are foundations (done or half-done); 3–7 are the billing-completion gap
(phases 2–4); 8–9 printability (Phase 1); 10–12 communication (Phase 5); 13–16 scale
features (Phase 6, fog for multi-currency/recurring); 17–18 are defended, not touched.

## 5. Phased plan

### Phase 1 — SO PDF engine (printability)

Instruction: the live `Sales Order` template row becomes consumable. Mirror the
quotation PDF pattern (template fetch → renderer → preview/download/share), scoped to
SO fields (header, lines with HSN/make/variant, totals incl. extra discount + GST split,
terms, signatory, prepared-by). No new template schema; renderers live beside the
quotation PDF modules.
Implementation:
1. `src/pdf/` (or `src/pages/sales/pdf/`): SO renderer consuming `document_templates`
   rows with `document_type = 'Sales Order'`; default falls back to the `is_default` row.
2. Detail Print button → preview modal (same chrome as the quotation PDF modal:
   toolbar with Edit/Share/close, iframe viewer) + Download; list row menu gains
   Download PDF (eye becomes preview where the shell supports it).
3. `template_id` selection made in Detail drives renderer choice (already persisted).
Verification (per `.agents/VERIFICATION.md`):
- Build: esbuild clean on touched files; ASCII sweep.
- Workflow: create SO → Detail → Print → preview renders with correct totals/terms/
  signatory; Download saves a readable PDF; switch template → output changes.
- DB integrity: no writes except reads; repeat preview produces identical bytes modulo timestamps.
- RLS: template rows readable under existing policies; no new grants.
- Regression: quotation PDF paths untouched (byte-compare oneExisting template output).
- Failure: missing template row → clean "No template" message, no blank modal.

### Phase 2 — SO → Purchase Order convert (close the chain gap)

Instruction: shortfall lines convert to a real vendor PO through `create_purchase_order_atomic`
(idempotent, GST-correct, server-numbered) — never the zero-value direct insert. Vendor
comes from the inquiry/response flow where present, else manual vendor pick at convert
time. PO links back (`purchase_order_items` carry the SO line reference; new nullable
`sales_order_item_id` column via `supabase migration new`).
Implementation:
1. Migration: `purchase_order_items.sales_order_item_id` nullable + index.
2. Convert action (SO Detail Convert submenu + list row menu): prefill vendor/qty-rate
   from SO lines (base rate × (1 − disc%)), call atomic RPC with key
   `po:so-line:{sales_order_item_id}`.
3. PO Raised status flows back to the SO traceability panel (already reads linked POs).
Verification:
- Build + ASCII as Phase 1.
- Workflow: convert twice → 1 PO (`idempotent_replayed`); vendor/rate/GST correct on PO.
- DB integrity: double-click safe; failed convert leaves no orphan PO or `po_qty` drift.
- RLS: atomic RPC's org check exercised (member vs non-member).
- Regression: existing inquiry→PO path untouched; procurement link dialog unaffected.
- Failure: zero-qty/fully-stocked lines excluded with a note, not silent skip.

### Phase 3 — Partial invoicing + invoice linkage (billing completion)

Instruction: an SO can be billed across many invoices; each invoice line optionally
references its SO line; SO Detail shows an Invoices tab/section with per-line billed vs
remaining. SO workflow status still driven ONLY by fulfillment (locked decision §3).
Implementation:
1. Migration: `invoice_items.sales_order_item_id` nullable + index (verify table/columns first).
2. Invoice editor: accept `sales-order` source (picker option + prefill from ConversionResult).
3. SO Detail: Invoices section (linked invoice numbers, amounts, per-line billed/remaining).
4. Convert menu item carries line selection forward (partial = subset of lines).
Verification:
- Workflow: convert subset → invoice holds only those lines; second convert bills the rest;
  linkage section matches on both ends.
- DB integrity: deleting an invoice does not orphan SO linkage display (null-safe reads);
  billed qty never exceeds ordered (guard at convert + at save).
- RLS/regression/failure per Phase 1 pattern; quotation invoice paths re-tested.

### Phase 4 — Event-driven reservations (correctness debt)

Instruction: reservations follow lifecycle events, no manual-only model. On SO approval/
open: auto-reserve available stock (capped, per-warehouse, same ATP expression as the
availability modal). On dispatch/ship: consume reservations into shipped quantities so ATP
recovers. Cancel path already releases (live trigger) — extend the same guarantee to ship.
Implementation:
1. Approval/Open hook calls a guarded reserve routine (server-side, reusing the
   over-reserve trigger as the backstop).
2. Dispatch/ship completion deletes or decrements matching reservation rows (trigger or
   RPC, mirroring the cancel-cleanup pattern).
3. Panel Release remains as the manual override; show reservation provenance (auto vs manual).
Verification:
- Workflow: approve → reserved appears without panel; ship → ATP recovers the shipped qty.
- DB integrity: concurrent approve + manual reserve cannot over-reserve (trigger is the
  arbiter — live-proven); cancel and ship both converge to zero open reservations.
- RLS: routines run with invoker rights under existing policies (pre-checked pattern).
- Regression: quotation availability numbers unchanged; manufacturing GRN world untouched.
- Failure: shortfall reserves partially with a visible remaining figure, never silent.

### Phase 5 — Email / Send / Attachments (communication)

Instruction: `email_sent*` fields become real. Send action emails the SO PDF (Phase 1
output) to the client contact, stamps `email_sent/email_sent_to/email_sent_at`
idempotently (re-Send is a no-op unless forced — same contract as the planned PO Send).
Attachments tab backed by storage with org-scoped RLS.
Implementation:
1. Send button + idempotency guard + failure toast with retry (observable failures only).
2. Storage bucket + policies + Attachments tab upload/list/delete.
Verification: send twice → one email record; failed send surfaces + retries; attachment
visible only to org members (second-org negative test); regression on Print/PDF.

### Phase 6 — Editor prefill on arrival + Import (scale)

Instruction: invoice/DC editors consume `ConversionResult` payloads generically so any
present or future `*-to-*` type prefills items (fixes the parity gap where even
quotation converts open un-prefilled editors). Import: CSV bulk SO create with
auto-number option and field mapping, modeled on Zoho's flow.
Implementation:
1. Editor apply-effects keyed off `ConversionResult.data` shape, not source type.
2. Import wizard (upload → map → validate → create), reusing create mutation + activity log.
Verification per `.agents/VERIFICATION.md` all layers, plus: malformed CSV fails with
row-level errors and creates nothing (atomicity); prefill byte-matches source lines.

## 6. Not yet specified (fog)

- Multi-currency (QB-style irreversibility makes this a one-way door — needs its own design).
- Recurring SOs/invoices.
- Reports/analytics for sales (top customers, margins on SOs).
- Customer portal / share links.
- Which SO statuses gate Convert/Edit/Delete (draft-only edit exists; convert/delete gates undefined).
- Mobile equivalents per repo `AGENTS.md` (required per feature, unscoped).

## 7. Out of scope

- Manufacturing GRN unification; inventory-vs-item_stock resolution (procurement PRD fog).
- Vendor price comparison / rate contracts (no price columns).
- Cross-UOM conversion; PO email transport (separate efforts).
- Rebuilding quotation flows touched only as regression surface.
