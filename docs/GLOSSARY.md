# Glossary — Requisitions, Job Cards, and Demand Sources

This document exists because the codebase contains several similarly-named
concepts that are easy to confuse. Read this before touching procurement or
manufacturing code.

## Three different "requisition" concepts

| Concept | Table | Module / screen | Purpose |
|---|---|---|---|
| **Purchase Requisition (PR)** | `purchase_requisitions` + `purchase_requisition_lines` | Purchase module → Requisitions (`/purchase/requisitions`) | *"We need to buy this from a vendor."* Internal buying document. Lines get bucketed on approval into `available_stock_qty` / `store_allocated_qty` / `procure_required_qty` / `open_qty` / `po_qty` / `received_qty`. Approved lines surface on the Sourcing Board. |
| **Material Requisition (store issue)** | `material_requisitions` + `material_requisition_items` | Manufacturing → Stores | *"Production needs raw materials issued from our own Main Store."* Carries `job_card_id` — it is the store-issue slip for a job card. Issuing moves stock Main Store → WIP. |
| **Availability Inquiry (vendor RFQ)** | `availability_inquiries` + `availability_inquiry_lines` + `availability_responses` | Purchase module → Availability Inquiry (`/purchase/inquiries`) | *"Which vendor can supply X qty, by when?"* Created from PR lines with `source_type = 'PROCURE'`. Vendor responses convert to Draft POs; GR receives goods. |

Rule of thumb: **PR = buying from vendors. Material Requisition = issuing
from our own stores for a job. Availability Inquiry = asking vendors what
they can supply.**

When a job card links to a purchase requisition line as a *source*
(`source_type`), the value is `'purchase_requisition_line'` — that refers to
`purchase_requisition_lines` (the buying document), **not** to
`material_requisitions`.

## Job cards — canonical field conventions

The live schema (see `supabase/remediation/baseline_database_types.ts`) and
all Postgres RPCs use **one** set of field names. Writers must match it:

| Canonical | NOT use | Notes |
|---|---|---|
| `job_card_no` | ~~`job_card_number`~~ | NOT NULL + unique. Generate via `generate_job_card_no` (`JC-0001`). Never timestamp-based numbers (`JC-<epoch>` breaks sorting/uniqueness guarantees). |
| `planned_qty` | ~~`target_qty`~~ | NOT NULL. Every RPC (`release_job_card`, variance engine, completion trigger) reads `planned_qty`. Writing `target_qty` fails with PGRST204 or silently skips. |
| `product_name` | — | NOT NULL. Must be supplied on insert. |
| `output_unit` | — | Nullable but expected by downstream UI. Pull from the BOM. |
| `machine_id` | ~~`work_center_id`~~ | Only `machine_id` exists on `job_cards`. |

Job card creation must go through `createJobCardAggregate`
(`features/manufacturing/repository/jobCardRepository.ts`) or must be fixed to
match the above if a screen writes rows directly.

### The guard: `JobCardInsert`

`JobCardInsert` (defined in `features/manufacturing/model/jobCard.ts`,
re-exported from the repository) is the canonical INSERT type for
`job_cards`. **Every direct insert must use `satisfies JobCardInsert`:**

```ts
const jobCard = {
  organisation_id: orgId,
  job_card_no: jcNo,
  product_name: name,      // NOT NULL in DB
  bom_id: bomId,
  planned_qty: qty,        // NOT target_qty
  status: 'draft',
} satisfies JobCardInsert;
```

Supabase-js is structurally permissive about unknown keys, so a wrong column
name otherwise only fails at runtime (PGRST204 / 42703). With `satisfies`,
the mistake fails `tsc` instead. A future screen that skips this typing can
silently reintroduce the bug — code review should reject any
`.from('job_cards').insert(...)` whose payload is not `satisfies JobCardInsert`.

### Verification tooling

- `apps/web/scripts/verify-jobcard-schema.mjs` — read-only runtime probe of
  the live `job_cards` schema (SELECTs known-missing columns, expects PGRST204;
  zero mutation risk). Run it whenever the baseline types snapshot is
  suspected stale, BEFORE fixing writers against it.
- `apps/web/scripts/typecheck-touched.mjs` — targeted typecheck over the
  job-card files' dependency closure (the full-project `tsc` exceeds practical
  time limits on this repo).

## Cross-linking (soft links)

`job_cards` may reference demand sources via:

- `sales_order_item_id` — legacy hard FK, kept for compatibility.
- `source_type` + `source_id` — **soft link, no FK**, added for quotations and
  purchase requisitions so deletions in other modules never orphan/break job cards.

Allowed `source_type` values:

- `'sales_order_item'` → `sales_order_items` (also stamped for uniform querying)
- `'purchase_requisition_line'` → `purchase_requisition_lines`

### Quotations are NOT a job-card source

**Principle: demand commitment follows contract certainty.** A quotation is
an offer — the customer may revise, reject, or never respond. Only a
confirmed sales order is firm demand, and only firm demand may reserve
stock, run MRP shortfall math, create job cards, or create POs. (Matches
standard ERP practice: SAP MTO strategies peg production orders to the sales
order as the sole demand trigger, never to quotations.)

Therefore:

- Quotation stage = **informational availability check only** — display
  current stock so sales can quote realistic lead times. No reservation,
  no MRP, no job card.
- The ONLY path from quotation to job card is **conversion to a sales
  order** (the SO carries `quotation_id`). The SO then drives the existing
  Stock Check → shortfall → MRP → Job Card + PO chain.
- At conversion, **recompute** availability — never inherit quote-stage
  numbers (stock may have moved, prices may have changed).
- No `'quotation_item'` source type exists by design. Traceability runs
  through the existing chain: `job_cards.sales_order_item_id` →
  `sales_order.quotation_id` → quotation.
- If engineer-to-order quoting ever needs quote-stage BOM costing, that is
  a separate cost-estimate artifact — never a job card.
