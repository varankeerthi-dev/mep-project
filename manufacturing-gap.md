# Manufacturing Module — Gap Analysis & Implementation Plan

> **Perspective**: Industrial Plant Head working with CFT (Cross-Functional Teams)  
> **Date**: July 2026  
> **Current State**: Core production loop exists — BOM → Schedule → Job Card → Issue → Production Entry → FG Warehouse

---

## Current Architecture (What Exists)

```
┌──────────┐    ┌──────────────┐    ┌───────────┐    ┌──────────────┐    ┌──────────────────┐
│   BOM    │───▶│  Schedule    │───▶│ Job Card  │───▶│ Issue        │───▶│ Production Entry │
│ (formula)│    │ (multi-prod) │    │ (work ord)│    │ Materials    │    │ (actuals + FG)   │
└──────────┘    └──────────────┘    └───────────┘    └──────────────┘    └──────────────────┘
     │                 │                  │                  │                     │
     ▼                 ▼                  ▼                  ▼                     ▼
  raw_materials   production_         job_cards        material_outward    production_entries
  bom_headers     schedules           job_card_        material_outward_   production_entry_
  bom_items       production_         materials        items               items
                  schedule_items                       
                                                                                 │
                                                    ┌────────────────────────────┤
                                                    ▼                            ▼
                                              Main Store ──(issue)──▶ WIP    FG Warehouse
                                              (deduct)          (add)       (add finished goods)
```

**Warehouse tiers**: Main Store → WIP → FG Warehouse (auto-detected via `warehouse_purpose`)

---

## Table of Contents

1. [P0 — Dispatch Module (Pick / Pack / Count / Forward)](#p0--dispatch-module)
2. [P1 — FG QC Acceptance](#p1--fg-qc-acceptance)
3. [P1 — Stores Independent Console (GRN + Gate Pass)](#p1--stores-independent-console)
4. [P2 — Sales Order → Production Demand Linkage](#p2--sales-order--production-demand-linkage)
5. [P2 — Capacity Scheduling (Machine / Line Allocation)](#p2--capacity-scheduling)
6. [P3 — In-Process QC + WIP Valuation](#p3--in-process-qc--wip-valuation)
7. [P3 — Team-Specific Dashboards](#p3--team-specific-dashboards)
8. [Implementation Roadmap](#implementation-roadmap)

---

## P0 — Dispatch Module

### What's Missing

The Dispatch team (packing, counting, forwarding) has **zero presence** in the system. Finished goods accumulate in FG Warehouse with no mechanism to:

- Pick items against sales orders
- Record packing details (carton count, weight)
- Verify counts before dispatch
- Generate forwarding documentation
- Deduct FG stock on shipment

### Database Schema

```sql
-- Dispatch Order (links sales order to dispatch)
CREATE TABLE dispatch_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_no TEXT NOT NULL,               -- auto-generated: "DO-0001"
  sales_order_id UUID REFERENCES sales_orders(id),
  customer_name TEXT NOT NULL,
  customer_address TEXT,
  planned_dispatch_date DATE,
  actual_dispatch_date DATE,
  status TEXT DEFAULT 'draft',             -- draft | picking | packed | verified | dispatched | cancelled
  transport_mode TEXT,                     -- road/rail/air/sea
  vehicle_number TEXT,
  driver_name TEXT,
  driver_contact TEXT,
  freight_charges NUMERIC(12,2) DEFAULT 0,
  tracking_number TEXT,                    -- AWB / LR number
  estimated_delivery_date DATE,
  remarks TEXT,
  created_by UUID REFERENCES auth.users(id),
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Dispatch Items (what to pick from FG Warehouse)
CREATE TABLE dispatch_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_order_id UUID NOT NULL REFERENCES dispatch_orders(id) ON DELETE CASCADE,
  sales_order_item_id UUID REFERENCES sales_order_items(id), -- link to original order line
  material_id UUID NOT NULL REFERENCES materials(id),        -- finished good
  ordered_qty NUMERIC(12,3) NOT NULL,
  picked_qty NUMERIC(12,3) DEFAULT 0,
  packed_qty NUMERIC(12,3) DEFAULT 0,
  dispatched_qty NUMERIC(12,3) DEFAULT 0,
  unit TEXT NOT NULL,
  batch_no TEXT,                             -- FG batch/lot number
  warehouse_id UUID REFERENCES warehouses(id),
  status TEXT DEFAULT 'pending',             -- pending | picking | packed | dispatched
  organisation_id UUID NOT NULL REFERENCES organisations(id)
);

-- Packing Details
CREATE TABLE dispatch_packing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_order_id UUID NOT NULL REFERENCES dispatch_orders(id) ON DELETE CASCADE,
  carton_number INTEGER NOT NULL,           -- sequential box number
  carton_type TEXT,                         -- box / pallet / crate
  length_cm NUMERIC(8,2),
  width_cm NUMERIC(8,2),
  height_cm NUMERIC(8,2),
  gross_weight_kg NUMERIC(10,3),
  net_weight_kg NUMERIC(10,3),
  contents JSONB,                           -- [{material_id, qty, batch_no}]
  handling_instructions TEXT,               -- "Fragile", "This Side Up"
  organisation_id UUID NOT NULL REFERENCES organisations(id)
);

-- Count Verification (blind count sheet)
CREATE TABLE dispatch_count_verification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_order_id UUID NOT NULL REFERENCES dispatch_orders(id) ON DELETE CASCADE,
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  material_id UUID NOT NULL REFERENCES materials(id),
  system_qty NUMERIC(12,3) NOT NULL,         -- what system says
  counted_qty NUMERIC(12,3),                 -- what was physically counted
  variance_qty NUMERIC(12,3) GENERATED ALWAYS AS (counted_qty - system_qty) STORED,
  variance_reason TEXT,                      -- reason for discrepancy
  status TEXT DEFAULT 'pending',             -- pending | matched | discrepancy | resolved
  organisation_id UUID NOT NULL REFERENCES organisations(id)
);
```

### UI Pages (new directory: `apps/web/src/pages/manufacturing/dispatch/`)

| Page | Route | Purpose |
|---|---|---|
| `DispatchList.tsx` | `/manufacturing/dispatch` | List all dispatch orders with status filters |
| `DispatchCreate.tsx` | `/manufacturing/dispatch/create` | Create dispatch from sales order; shows available FG stock |
| `DispatchDetail.tsx` | `/manufacturing/dispatch/:id` | Full dispatch lifecycle view |
| `PackingSheet.tsx` | `/manufacturing/dispatch/:id/packing` | Carton-wise packing entry |
| `CountVerification.tsx` | `/manufacturing/dispatch/:id/verify` | Blind count sheet for dispatch verification |
| `DispatchDashboard.tsx` | `/manufacturing/dispatch/dashboard` | Dispatch team KPI dashboard |

### Workflow & Logic

```
Sales Order ──▶ Dispatch Order (draft)
                    │
                    ▼
              Picking (picking)
              ├── System shows FG stock by warehouse/batch
              ├── User enters picked_qty per line item
              ├── Optional: print picking list PDF
                    │
                    ▼
              Packing (packed)
              ├── Create cartons, assign items to cartons
              ├── Record weights & dimensions
              ├── Generate packing slip PDF
                    │
                    ▼
              Count Verification (verified)
              ├── Blind count: counter enters counted_qty without seeing system_qty
              ├── System flags discrepancies automatically
              ├── Resolve variances before proceeding
                    │
                    ▼
              Dispatch (dispatched)
              ├── Deduct FG Warehouse stock by dispatched_qty
              ├── Create material_outward record for audit
              ├── Update sales order fulfillment status
              ├── Generate dispatch note / delivery challan
```

**Key Business Rules:**
- `picked_qty` ≤ `ordered_qty` ≤ FG available stock
- `dispatched_qty` must match `counted_qty` after verification
- Dispatch cannot proceed to "dispatched" unless count verification is "matched"
- FG stock deduction happens only on final dispatch confirmation
- Each dispatch creates a `material_outward` record tagged with `dispatch_order_id`

### Shell Integration

Add to `ManufacturingShell.tsx` TABS array:
```tsx
{ id: 'dispatch', label: 'Dispatch', path: '/manufacturing/dispatch', matchPrefix: '/manufacturing/dispatch' },
```

---

## P1 — FG QC Acceptance

### What's Missing

Finished goods from production go directly into FG Warehouse with no quality inspection. Defective products enter sellable inventory silently.

### Database Schema

```sql
-- FG QC Inspection
CREATE TABLE fg_qc_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_no TEXT NOT NULL,               -- auto: "FQC-0001"
  production_entry_id UUID REFERENCES production_entries(id),
  job_card_id UUID REFERENCES job_cards(id),
  product_id UUID NOT NULL REFERENCES materials(id),
  batch_no TEXT NOT NULL,
  produced_qty NUMERIC(12,3) NOT NULL,       -- qty presented for inspection
  sample_size NUMERIC(12,3),                 -- AQL sample size
  accepted_qty NUMERIC(12,3) DEFAULT 0,
  rejected_qty NUMERIC(12,3) DEFAULT 0,
  rework_qty NUMERIC(12,3) DEFAULT 0,        -- needs rework before accept
  inspection_date DATE NOT NULL DEFAULT CURRENT_DATE,
  inspector_id UUID REFERENCES auth.users(id),
  inspection_result TEXT DEFAULT 'pending',  -- pending | accepted | partially_accepted | rejected
  defect_categories JSONB,                   -- [{category, count, severity}]
  remarks TEXT,
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- QC Parameters (per product / BOM)
CREATE TABLE qc_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_id UUID REFERENCES bom_headers(id),
  product_id UUID REFERENCES materials(id),
  parameter_name TEXT NOT NULL,               -- "Dimension", "Weight", "Color", "Tensile Strength"
  specification TEXT NOT NULL,                -- "10 ± 0.5 cm"
  measurement_unit TEXT,
  test_method TEXT,
  aql_level TEXT DEFAULT 'II',               -- AQL inspection level
  severity TEXT DEFAULT 'major',             -- critical | major | minor
  is_active BOOLEAN DEFAULT true,
  organisation_id UUID NOT NULL REFERENCES organisations(id)
);

-- QC Parameter Results
CREATE TABLE qc_parameter_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES fg_qc_inspections(id) ON DELETE CASCADE,
  parameter_id UUID NOT NULL REFERENCES qc_parameters(id),
  measured_value TEXT,                        -- actual measurement
  is_pass BOOLEAN,
  remarks TEXT
);
```

### UI Pages

| Page | Route | Purpose |
|---|---|---|
| `QCInspectionList.tsx` | `/manufacturing/qc` | List all QC inspections |
| `QCInspectionCreate.tsx` | `/manufacturing/qc/create?entry=:id` | Initiate QC from production entry |
| `QCInspectionDetail.tsx` | `/manufacturing/qc/:id` | Record parameter results, accept/reject |
| `QCParameters.tsx` | `/manufacturing/qc/parameters` | Define QC parameters per product |

### Workflow & Logic

```
Production Entry complete
        │
        ▼
  QC Inspection (pending)
  ├── Auto-loads produced_qty, product, batch from production entry
  ├── Loads qc_parameters defined for this product/BOM
  ├── Inspector records measurements per parameter
        │
        ▼
  Inspection Result
  ├── accepted: all accepted_qty → FG Warehouse (existing flow)
  ├── partially_accepted: accepted → FG Warehouse, rejected → rejection store, rework → WIP
  ├── rejected: all qty → rejection store
        │
        ▼
  FG Stock Update (only accepted_qty)
```

**Key Business Rules:**
- Production entry completion triggers QC requirement (configurable per product: mandatory/optional)
- Only `accepted_qty` flows to FG Warehouse stock
- `rejected_qty` goes to a **Rejection Store** warehouse (new `warehouse_purpose = 'rejection'`)
- `rework_qty` goes back to WIP with a rework job card
- QC inspection is a gate: FG cannot be dispatched without passing QC

### Change to Existing ProductionEntryForm.tsx

After production entry save, redirect to `/manufacturing/qc/create?entry={entryId}` instead of `/manufacturing/production`. Make QC skippable via a config per organisation (for low-risk products).

---

## P1 — Stores Independent Console

### What's Missing

The Stores team has no dedicated operational interface. Currently:
- Material issuance ("Issue Materials") is done by the Production user
- There is no GRN (Goods Receipt Note) flow for incoming raw materials
- There is no material requisition → gate pass workflow

### Database Schema

```sql
-- Material Requisition (Production → Stores request)
CREATE TABLE material_requisitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_no TEXT NOT NULL,              -- auto: "MR-0001"
  job_card_id UUID REFERENCES job_cards(id),
  requested_by UUID REFERENCES auth.users(id),
  requested_date DATE NOT NULL DEFAULT CURRENT_DATE,
  required_date DATE,                        -- when materials are needed on shop floor
  status TEXT DEFAULT 'draft',              -- draft | submitted | approved | partially_issued | issued | rejected
  remarks TEXT,
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE material_requisition_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id UUID NOT NULL REFERENCES material_requisitions(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materials(id),
  required_qty NUMERIC(12,3) NOT NULL,
  issued_qty NUMERIC(12,3) DEFAULT 0,
  unit TEXT NOT NULL,
  stock_available NUMERIC(12,3),             -- snapshot at request time
  warehouse_id UUID REFERENCES warehouses(id),
  status TEXT DEFAULT 'pending'              -- pending | issued | short_supplied
);

-- Goods Receipt Note (GRN) — Inward from Purchase Order
CREATE TABLE goods_receipt_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_no TEXT NOT NULL,                      -- auto: "GRN-0001"
  purchase_order_id UUID REFERENCES purchase_orders(id),
  vendor_name TEXT NOT NULL,
  invoice_number TEXT,
  invoice_date DATE,
  receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
  received_by UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'draft',              -- draft | qc_pending | qc_passed | qc_failed | accepted | rejected
  vehicle_number TEXT,
  challan_number TEXT,
  remarks TEXT,
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE grn_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_id UUID NOT NULL REFERENCES goods_receipt_notes(id) ON DELETE CASCADE,
  purchase_order_item_id UUID REFERENCES purchase_order_items(id),
  material_id UUID NOT NULL REFERENCES materials(id),
  ordered_qty NUMERIC(12,3) NOT NULL,
  received_qty NUMERIC(12,3) NOT NULL,       -- physically received
  accepted_qty NUMERIC(12,3) DEFAULT 0,       -- after QC
  rejected_qty NUMERIC(12,3) DEFAULT 0,
  unit TEXT NOT NULL,
  batch_no TEXT,
  expiry_date DATE,
  warehouse_id UUID REFERENCES warehouses(id),
  status TEXT DEFAULT 'pending',             -- pending | qc_passed | qc_failed | accepted
  organisation_id UUID NOT NULL REFERENCES organisations(id)
);

-- RM QC Inspection (for incoming raw materials)
CREATE TABLE rm_qc_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_id UUID NOT NULL REFERENCES goods_receipt_notes(id),
  inspection_no TEXT NOT NULL,               -- auto: "RMQC-0001"
  inspector_id UUID REFERENCES auth.users(id),
  inspection_date DATE NOT NULL DEFAULT CURRENT_DATE,
  result TEXT DEFAULT 'pending',             -- pending | passed | failed | conditional
  remarks TEXT,
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### UI Pages (new directory: `apps/web/src/pages/manufacturing/stores/`)

| Page | Route | Purpose |
|---|---|---|
| `StoresDashboard.tsx` | `/manufacturing/stores` | Pending GRNs, pending requisitions, low stock alerts |
| `GRNList.tsx` | `/manufacturing/stores/grn` | All goods receipt notes |
| `GRNCreate.tsx` | `/manufacturing/stores/grn/create?po=:id` | Create GRN from purchase order |
| `GRNDetail.tsx` | `/manufacturing/stores/grn/:id` | Record QC results, accept qty → Main Store |
| `RequisitionList.tsx` | `/manufacturing/stores/requisitions` | All material requisitions from Production |
| `RequisitionDetail.tsx` | `/manufacturing/stores/requisitions/:id` | Issue materials, print gate pass |

### Workflow & Logic

**GRN Flow (Inward):**
```
Purchase Order delivered
        │
        ▼
  GRN Created (draft)
  ├── Auto-populate from PO: vendor, items, ordered_qty
  ├── Stores enters received_qty (physical count), batch_no, expiry
        │
        ▼
  RM QC Inspection (qc_pending → qc_passed/qc_failed)
  ├── Inspector records QC results per item
  ├── accepted_qty = passed items; rejected_qty = failed items
        │
        ▼
  GRN Acceptance (accepted)
  ├── accepted_qty → Main Store stock (item_stock INSERT/UPDATE)
  ├── rejected_qty → Rejection Store or return to vendor
  ├── Create material_inward record for audit
  ├── Update PO received_qty
```

**Material Requisition Flow (Outward):**
```
Job Card Created / Issued
        │
        ▼
  Requisition Created (draft → submitted)
  ├── Auto-generated from job_card_materials
  ├── Shows stock_available snapshot in Main Store
        │
        ▼
  Stores Reviews & Issues (partially_issued / issued)
  ├── Stores enters issued_qty per line item
  ├── If issued_qty < required_qty → partially_issued (short supply)
  ├── On issuance:
  │   ├── Main Store stock ↓
  │   ├── WIP stock ↑
  │   ├── Create material_outward record
  │   └── Update job_card_materials.issued_qty, status = 'issued'
  ├── Print gate pass (PDF)
```

### Change to Existing JobCardDetail.tsx

Replace the "Issue Materials" button logic. Instead of Production user directly issuing, the button should:
1. Auto-create a `material_requisition` from the job card
2. Navigate to `/manufacturing/stores/requisitions/:id`
3. Stores team completes the issuance there

Or keep the existing direct-issue as a "Quick Issue" option for smaller plants.

---

## P2 — Sales Order → Production Demand Linkage

### What's Missing

Production scheduling is completely independent of customer orders. There's no way to:
- See which production orders fulfill which sales orders
- Prioritize production based on order due dates
- Calculate net production requirements (orders − FG stock = what to produce)

### Database Schema

```sql
-- Production Plan (aggregates demand from sales orders)
CREATE TABLE production_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_no TEXT NOT NULL,                     -- auto: "PP-0001"
  plan_period_start DATE NOT NULL,           -- planning horizon start
  plan_period_end DATE NOT NULL,             -- planning horizon end
  status TEXT DEFAULT 'draft',              -- draft | approved | in_progress | completed
  remarks TEXT,
  created_by UUID REFERENCES auth.users(id),
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Production Plan Items (what to produce, derived from demand)
CREATE TABLE production_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES production_plans(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES materials(id),
  product_name TEXT NOT NULL,
  bom_id UUID REFERENCES bom_headers(id),
  demand_qty NUMERIC(12,3) NOT NULL,         -- total ordered by customers
  current_fg_stock NUMERIC(12,3) NOT NULL,    -- what's already in FG Warehouse
  wip_qty NUMERIC(12,3) DEFAULT 0,           -- already in production
  net_to_produce NUMERIC(12,3) NOT NULL,      -- demand - stock - wip (computed)
  planned_qty NUMERIC(12,3) DEFAULT 0,        -- what we plan to schedule
  linked_sales_orders JSONB,                 -- [{order_id, order_no, qty, due_date}]
  linked_schedule_id UUID REFERENCES production_schedules(id),
  linked_job_card_ids UUID[] DEFAULT '{}',
  status TEXT DEFAULT 'pending',             -- pending | scheduled | in_production | fulfilled
  organisation_id UUID NOT NULL REFERENCES organisations(id)
);

-- Link Sales Order Items → Job Cards (traceability)
CREATE TABLE sales_order_production_link (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_item_id UUID NOT NULL REFERENCES sales_order_items(id),
  job_card_id UUID REFERENCES job_cards(id),
  allocated_qty NUMERIC(12,3) NOT NULL,
  organisation_id UUID NOT NULL REFERENCES organisations(id)
);
```

### UI Pages

| Page | Route | Purpose |
|---|---|---|
| `ProductionPlanList.tsx` | `/manufacturing/plans` | List production plans |
| `ProductionPlanCreate.tsx` | `/manufacturing/plans/create` | MRP-style: aggregate open SOs, show net requirements |
| `ProductionPlanDetail.tsx` | `/manufacturing/plans/:id` | Convert plan items to schedules/job cards |

### Workflow & Logic

```
Open Sales Orders (unfulfilled)
        │
        ▼
  Production Plan (MRP netting)
  ├── For each FG product with open SO demand:
  │   net_to_produce = SUM(ordered_qty) - current_fg_stock - wip_qty
  │   (if net_to_produce ≤ 0 → demand is covered, don't plan)
  ├── Sort by delivery date priority
  ├── Show raw material requirements (explode through BOM)
        │
        ▼
  Convert to Execution
  ├── "Create Schedule" → batch-create production_schedule with all plan items
  │   OR
  ├── "Create Job Cards" → directly create job cards per product
  ├── Each job card links back to plan_item and sales_order
        │
        ▼
  Fulfillment Tracking
  ├── When job card completes (status = 'completed'):
  │   └── sales_order_production_link updated
  ├── Sales order fulfillment % updated
```

**Key Business Rules:**
- `net_to_produce` is computed, not manually entered
- Production plan items can be batched into one schedule or individual job cards
- Sales order delivery date drives production priority
- Full traceability: Sales Order → Plan → Schedule → Job Card → Dispatch → Delivery

---

## P2 — Capacity Scheduling (Machine / Line Allocation)

### What's Missing

Current production schedule only has date + shift (day/night/custom). There's no:
- Machine/work center definition
- Machine capacity (units/hour or hours/day)
- Allocation of schedule items to specific machines
- Capacity overload detection

### Database Schema

```sql
-- Work Centers / Machines
CREATE TABLE work_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL,                        -- "MCH-01", "LINE-A"
  work_center_type TEXT DEFAULT 'machine',   -- machine | assembly_line | workstation
  capacity_per_hour NUMERIC(10,3),           -- nominal capacity
  capacity_uom TEXT,                         -- "nos", "kg", "mtr"
  hours_per_shift NUMERIC(5,2) DEFAULT 8,
  shifts_per_day INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  remarks TEXT,
  organisation_id UUID NOT NULL REFERENCES organisations(id)
);

-- BOM → Work Center mapping (which machines can produce this product)
CREATE TABLE bom_work_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_id UUID NOT NULL REFERENCES bom_headers(id),
  work_center_id UUID NOT NULL REFERENCES work_centers(id),
  setup_time_minutes INTEGER DEFAULT 0,     -- changeover time
  cycle_time_minutes NUMERIC(8,2),           -- time per unit
  is_preferred BOOLEAN DEFAULT false,
  organisation_id UUID NOT NULL REFERENCES organisations(id)
);

-- Schedule Item → Machine Allocation
ALTER TABLE production_schedule_items
  ADD COLUMN work_center_id UUID REFERENCES work_centers(id),
  ADD COLUMN estimated_start_time TIMESTAMPTZ,
  ADD COLUMN estimated_end_time TIMESTAMPTZ,
  ADD COLUMN allocated_hours NUMERIC(6,2);   -- planned production hours
```

### UI Pages

| Page | Route | Purpose |
|---|---|---|
| `WorkCenterList.tsx` | `/manufacturing/work-centers` | Define machines/lines with capacity |
| Enhance `ProductionScheduleEditor.tsx` | `/manufacturing/schedules/create` | Add machine selection per item, show capacity load |

### Workflow & Logic

```
Create Schedule
        │
        ▼
  Select product → system suggests compatible work_centers
  ├── Shows: available capacity for selected date/shift
  ├── Calculates: allocated_hours = planned_qty / capacity_per_hour
  ├── Flags overload: if Σ allocated_hours > hours_per_shift
  ├── Auto-calculates: estimated_start_time, estimated_end_time
        │
        ▼
  Capacity View
  ├── Gantt-style view of all work centers by date
  ├── Color-coded: green (available), yellow (partial), red (overloaded)
```

---

## P3 — In-Process QC + WIP Valuation

### What's Missing

**In-Process QC**: No quality checks during production runs. Defects only discovered at FG stage (or not at all).
**WIP Valuation**: WIP tracks quantity only — no rupee value, no aging analysis.

### Database Schema (In-Process QC)

```sql
-- IPQC Checkpoints (defined per BOM / routing)
CREATE TABLE ipqc_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_id UUID NOT NULL REFERENCES bom_headers(id),
  sequence INTEGER NOT NULL,                 -- order in production process
  checkpoint_name TEXT NOT NULL,             -- "After Mixing", "Post Welding", "Pre Coating"
  checkpoint_type TEXT DEFAULT 'mandatory',  -- mandatory | optional
  parameter_definitions JSONB,               -- [{name, spec, unit, severity}]
  organisation_id UUID NOT NULL REFERENCES organisations(id)
);

-- IPQC Inspection Records
CREATE TABLE ipqc_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_card_id UUID NOT NULL REFERENCES job_cards(id),
  checkpoint_id UUID NOT NULL REFERENCES ipqc_checkpoints(id),
  inspector_id UUID REFERENCES auth.users(id),
  inspection_date TIMESTAMPTZ DEFAULT now(),
  result TEXT DEFAULT 'pending',             -- pending | passed | failed | conditional
  parameter_results JSONB,                   -- [{name, measured_value, is_pass}]
  sampled_qty NUMERIC(12,3),
  total_batch_qty NUMERIC(12,3),
  remarks TEXT,
  organisation_id UUID NOT NULL REFERENCES organisations(id)
);
```

### Database Schema (WIP Valuation)

```sql
-- WIP Valuation Snapshot (periodic — e.g., end of day/week)
CREATE TABLE wip_valuation_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL,
  job_card_id UUID NOT NULL REFERENCES job_cards(id),
  material_id UUID NOT NULL REFERENCES materials(id),
  wip_qty NUMERIC(12,3) NOT NULL,
  unit_cost NUMERIC(15,4),                   -- from material master / last PO price
  total_value NUMERIC(15,2) GENERATED ALWAYS AS (wip_qty * COALESCE(unit_cost, 0)) STORED,
  days_in_wip INTEGER,                        -- days since issue
  organisation_id UUID NOT NULL REFERENCES organisations(id)
);
```

### Workflow & Logic

**In-Process QC:**
```
Job Card in_progress
        │
        ▼
  IPQC Checkpoint triggered (by sequence)
  ├── Inspector records measurements at each checkpoint
  ├── failed → production halted for that batch until resolved
  ├── conditional → continue with caution, note in job card
  ├── passed → next production step unlocked
        │
        ▼
  All checkpoints passed → FG QC can begin
```

**WIP Valuation:**
- Scheduled job (cron) runs daily: for each job_card in `issued` or `in_progress`, compute:
  - `wip_qty` = `issued_qty` − `consumed_qty` − `wastage_qty` − `return_qty`
  - `unit_cost` from material master or last purchase price
  - `total_value` = `wip_qty × unit_cost`
- Dashboard: WIP aging report (items stuck > 7 days, > 30 days)

---

## P3 — Team-Specific Dashboards

### What's Missing

A single dashboard (`ManufacturingDashboard.tsx`) shows BOM/Job Card counts for everyone. Each CFT team needs their own KPI view.

### Implementation

**Stores Dashboard** (`/manufacturing/stores`):
- Pending GRNs count
- Pending material requisitions
- Low stock alerts (stock < production demand)
- Today's issues (material_outward for today)
- Raw material inventory value

**Production Dashboard** (enhance existing, add filters):
- Job cards by status (today's targets)
- Production vs plan (scheduled vs actual)
- Machine utilization %
- Yield by product (planned vs actual)
- Operator efficiency

**QC Dashboard** (`/manufacturing/qc/dashboard`):
- Pending QC inspections (RM + IPQC + FG)
- Pass rate % (this month)
- Top defect categories (Pareto)
- Rejection rate by product

**Dispatch Dashboard** (`/manufacturing/dispatch/dashboard`):
- Pending dispatches by due date
- Today's planned dispatches
- Delayed dispatches
- FG inventory ready-to-ship value

**Plant Head Dashboard** (enhance existing):
- OEE (Overall Equipment Effectiveness)
- Order fulfillment rate
- Production cost variance
- Inventory turns
- Dispatch on-time %

---

## Implementation Roadmap

```
Phase 1 (Week 1–2): Foundation
├── Database migrations for all new tables
├── Warehouse: add "rejection" purpose support
├── ManufacturingShell: add Dispatch, Stores, QC tabs
└── New route definitions

Phase 2 (Week 3–5): P0 — Dispatch Module
├── dispatch_orders + dispatch_items + dispatch_packing tables
├── DispatchList + DispatchCreate + DispatchDetail pages
├── PackingSheet + CountVerification pages
├── FG stock deduction on dispatch
└── Dispatch note PDF generation

Phase 3 (Week 6–7): P1 — FG QC Acceptance
├── fg_qc_inspections + qc_parameters + qc_parameter_results tables
├── QCInspectionList + QCInspectionCreate + QCInspectionDetail pages
├── QCParameters management page
├── Modify ProductionEntryForm: QC gate after production
├── Rejection store handling

Phase 4 (Week 8–10): P1 — Stores Console
├── material_requisitions + goods_receipt_notes + rm_qc_inspections tables
├── StoresDashboard
├── GRNList + GRNCreate + GRNDetail (with QC)
├── RequisitionList + RequisitionDetail (with gate pass)
├── Modify JobCardDetail: route issuance through stores

Phase 5 (Week 11–12): P2 — Sales Order Linkage
├── production_plans + production_plan_items + sales_order_production_link tables
├── ProductionPlanList + ProductionPlanCreate (MRP netting)
├── ProductionPlanDetail (convert to schedules/job cards)
├── Sales order fulfillment tracking

Phase 6 (Week 13–14): P2 — Capacity Scheduling
├── work_centers + bom_work_centers tables
├── WorkCenterList management page
├── Enhance ProductionScheduleEditor with machine allocation
├── Capacity load view (Gantt)

Phase 7 (Week 15–16): P3 — QC + WIP + Dashboards
├── ipqc_checkpoints + ipqc_inspections tables
├── IPQC integration in production flow
├── wip_valuation_snapshots + cron job
├── Team-specific dashboards (Stores, QC, Dispatch, Plant Head)
└── WIP aging report
```

---

## Summary of Changes to Existing Files

| File | Change |
|---|---|
| `ManufacturingShell.tsx` | Add Dispatch, Stores, QC tabs + routes |
| `JobCardDetail.tsx` | Route "Issue Materials" through Stores requisition (or keep both flows) |
| `ProductionEntryForm.tsx` | Post-save redirect to FG QC instead of production list |
| `ProductionScheduleEditor.tsx` | Add work center selection per item, capacity validation |
| `InventoryReport.tsx` | Add Rejection Store tab, WIP value column |

## New Pages to Create

```
apps/web/src/pages/manufacturing/
├── dispatch/
│   ├── DispatchList.tsx
│   ├── DispatchCreate.tsx
│   ├── DispatchDetail.tsx
│   ├── PackingSheet.tsx
│   ├── CountVerification.tsx
│   └── DispatchDashboard.tsx
├── stores/
│   ├── StoresDashboard.tsx
│   ├── GRNList.tsx
│   ├── GRNCreate.tsx
│   ├── GRNDetail.tsx
│   ├── RequisitionList.tsx
│   └── RequisitionDetail.tsx
├── qc/
│   ├── QCInspectionList.tsx
│   ├── QCInspectionCreate.tsx
│   ├── QCInspectionDetail.tsx
│   ├── QCParameters.tsx
│   └── QCDashboard.tsx
├── plans/
│   ├── ProductionPlanList.tsx
│   ├── ProductionPlanCreate.tsx
│   └── ProductionPlanDetail.tsx
└── work-centers/
    └── WorkCenterList.tsx
```

**Total: ~19 new page components, ~12 new database tables**
