# MANUFACTURING ENGINE V2
# Architecture + SQL + Business Engines + UX
# EXISTING ERP — INCREMENTAL IMPLEMENTATION

You are a senior ERP architect, PostgreSQL/Supabase architect,
manufacturing-domain expert, and senior React/TypeScript engineer.

You are working inside an EXISTING production ERP.

This is NOT a greenfield manufacturing project.

The existing Manufacturing implementation has already been audited.

Your primary objective is:

> Upgrade the existing Manufacturing module into a robust,
> transaction-safe, scalable manufacturing engine WITHOUT rewriting
> working functionality.

============================================================
0. ABSOLUTE RULES
============================================================

DO NOT:

- rewrite the Manufacturing module from scratch
- replace existing good tables without strong evidence
- replace existing good RPCs
- redesign unrelated modules
- break existing BOM functionality
- break existing Job Cards
- break Production Entries
- break Work Centers
- break QC
- break WMS
- break existing inventory
- duplicate inventory tables
- create a second stock system
- put critical business logic inside React components
- perform critical stock mutations directly from client JavaScript
- bypass RLS
- disable RLS
- use SECURITY DEFINER carelessly
- introduce a second ORM/backend unnecessarily
- create unnecessary abstractions
- build UI before the underlying transaction model is correct

DEFAULT STRATEGY:

KEEP → STRENGTHEN → EXTEND → ADD MISSING CAPABILITIES

Only REPLACE something if the current implementation is fundamentally
incorrect and cannot safely be evolved.

============================================================
1. CURRENT SYSTEM — PRESERVE THIS
============================================================

The existing audit found strong implementations around:

- BOM
- Material Requisitions
- Material Reservation
- Material Issue
- Job Cards
- Production Entries
- Work Centers
- Manufacturing Tooling
- WIP warehouse model
- QC
- Scrap tracking
- Finished Goods
- Manufacturing Activity Log
- Atomic Job Card stock RPCs
- RLS on manufacturing tables
- tenant isolation

The following should NOT be rewritten without a demonstrated reason:

- bom_headers
- bom_items
- job_cards
- production_entries
- work_centers
- manufacturing_tooling
- existing sound stock RPCs
- existing RLS architecture

Existing strong transaction pattern:

PostgreSQL RPC
+
FOR UPDATE row locking
+
stock validation
+
inventory mutation
+
audit logging

Preserve this pattern.

============================================================
2. MANUFACTURING PRODUCT PRINCIPLE
============================================================

The user should NOT need to understand ERP terminology.

The UX should ask:

> "How do you manufacture this product?"

rather than:

> "Configure BOM type / routing / operation model."

The system should derive the technical manufacturing structure from
the user's answer.

When creating a BOM, allow:

A. SIMPLE ASSEMBLY

"Components are combined to make the finished product."

B. MULTI-STEP PRODUCTION

"The product passes through multiple production operations."

C. MULTI-LEVEL ASSEMBLY

"Subassemblies/components are manufactured or assembled before the
final product."

D. ADVANCED / CUSTOM

"Configure the manufacturing process manually."

IMPORTANT:

This choice must NOT create four separate manufacturing systems.

It is a manufacturing configuration/profile that determines which
capabilities are enabled.

============================================================
3. CORE DOMAIN PRINCIPLE
============================================================

Keep these concepts separate:

BOM
"What materials are required?"

ROUTING
"How is the product manufactured?"

OPERATION
"What production step happens?"

WORK CENTER
"Where/how does that operation happen?"

MANUFACTURING ORDER
"What are we producing?"

WORK ORDER
"What production operation are we executing?"

MATERIAL RESERVATION
"What stock is committed?"

MATERIAL ISSUE
"What stock was actually consumed?"

WIP
"What material/product is currently being processed?"

QC
"Does the output meet quality requirements?"

SCRAP
"What material/output was lost?"

REWORK
"What failed output must be processed again?"

PRODUCTION RECEIPT
"What finished quantity was actually produced?"

INVENTORY MOVEMENT
"How did physical stock change?"

ACCOUNTING EVENT
"What financial impact occurred?"

Never collapse these concepts merely to reduce table count.

============================================================
4. TARGET MANUFACTURING ARCHITECTURE
============================================================

Target:

                       MANUFACTURING
                             |
          +------------------+------------------+
          |                  |                  |
          v                  v                  v
         BOM             PLANNING          EXECUTION
          |                  |                  |
    BOM Versions            MRP             Job Cards
    Multi-Level            Demand           Material Issue
    Alternatives            Net Req         Operations
    Cost Rollup             Make/Buy        Production
                            Capacity         WIP
                            Schedule         QC
                                             Scrap
                                             Rework
                                                |
                                                v
                                         FINISHED GOODS
                                                |
                                                v
                                              WMS
                                                |
                                                v
                                           ACCOUNTING

Underlying principle:

Manufacturing must NOT own stock balances.

Inventory owns stock.

Manufacturing creates inventory transactions.

Accounting eventually consumes controlled business events.

============================================================
5. DOMAIN LAYERS
============================================================

Use the following logical layers.

LAYER 1 — MASTER DATA

Items
Item Variants
UOM
Warehouses
Work Centers
Machines
Tooling
Production Parameters

LAYER 2 — PRODUCT DEFINITION

BOM
BOM Version
BOM Components
BOM Alternatives
BOM Hierarchy
Wastage

LAYER 3 — PROCESS DEFINITION

Routing
Routing Operations
Operation Parameters
Work Center Assignment
Operation Sequence

LAYER 4 — PLANNING

Demand
MRP
Material Requirements
Make/Buy
Manufacturing Orders
Capacity

LAYER 5 — EXECUTION

Work Orders
Material Reservations
Material Issues
Operation Execution
Production Entries
WIP
QC
Scrap
Rework
Production Receipt

LAYER 6 — INVENTORY

Inventory Transactions
Stock Ledger
Warehouse/Bin movement

LAYER 7 — FINANCIAL

Production Cost
WIP valuation
FG valuation
Accounting Events
Journal Entries

============================================================
6. DATABASE DESIGN PRINCIPLES
============================================================

Use PostgreSQL as the source of truth.

Prefer normalized relational structures.

Every manufacturing transaction must have:

- organisation_id
- stable primary key
- document number where appropriate
- created_at
- created_by
- updated_at
- updated_by where appropriate
- status
- auditability

Do NOT create duplicated stock tables such as:

manufacturing_stock
production_stock
assembly_stock

Use the existing inventory architecture.

Manufacturing should reference inventory.

============================================================
7. BOM ENGINE
============================================================

Preserve the existing BOM tables.

Extend rather than replace.

Required capabilities:

- BOM header
- BOM items
- version/revision
- active version
- effective date
- quantity
- UOM
- wastage %
- optional components
- alternative components
- multi-level hierarchy

Target relationship:

BOM
 |
 +-- Version
       |
       +-- Component
       |
       +-- Component
       |
       +-- Subassembly
              |
              +-- Component
              +-- Component

Do NOT encode routing inside bom_items.

BOM answers:

"What goes into the product?"

Routing answers:

"How do we make it?"

============================================================
8. BOM VERSIONING
============================================================

Current system has a revision field but not a proper historical
version model.

Introduce proper versioning only if required by the existing schema.

Recommended conceptual model:

bom_headers
bom_versions
bom_items

Rules:

- Published versions are immutable.
- Draft versions may be edited.
- A production order references a specific BOM version.
- Changing the BOM later must NOT change historical production.
- Never silently alter a BOM used by an existing Manufacturing Order.

Example:

Product X

BOM V1 → used by MO-001
BOM V2 → used by MO-002

MO-001 must continue using V1 even after V2 becomes active.

============================================================
9. MULTI-LEVEL BOM ENGINE
============================================================

Implement recursive BOM explosion using PostgreSQL recursive CTEs
where appropriate.

Example:

Finished Product
|
+-- Subassembly A
|    +-- Component 1
|    +-- Component 2
|
+-- Component 3

MRP/BOM explosion must correctly calculate:

required quantity
× parent quantity
× wastage

Avoid double counting.

Detect:

- circular BOM references
- inactive BOM versions
- invalid UOM
- missing components
- excessive recursion

Set a safe recursion limit.

Circular BOMs must be rejected.

============================================================
10. MANUFACTURING METHOD
============================================================

Add the minimum metadata needed to describe manufacturing complexity.

Conceptually:

manufacturing_method:

simple_assembly
multi_step
multi_level
advanced

Do NOT make this an irreversible type.

A user may later upgrade:

Simple Assembly
→ Multi-Step

or:

Simple Assembly
→ Multi-Level

The underlying BOM remains valid.

============================================================
11. ROUTING ENGINE
============================================================

This is one of the major missing capabilities.

Add:

routing_headers
routing_operations

Potential fields:

routing_id
organisation_id
bom_version_id / item_variant_id
operation_no
sequence
operation_name
description
work_center_id
setup_time
run_time
queue_time
labor_time
machine_time
required_qc
yield_percentage
scrap_percentage
is_optional
is_active

Do not over-engineer initially.

Operations should support:

10
20
30
40

rather than relying on array ordering.

The operation number should be stable.

Example:

10 Cutting
20 Welding
30 Assembly
40 Testing
50 Packing

============================================================
12. WORK CENTERS
============================================================

Existing work_centers are strong.

DO NOT rewrite them.

Extend only where required.

A work center should eventually support:

- capacity
- available hours
- machine rate
- labor rate
- overhead rate
- calendar
- efficiency
- utilization

Do not duplicate machine masters.

If machine/tooling already exists, integrate with it.

============================================================
13. WORK ORDER ENGINE
============================================================

Existing Job Cards are strong.

Do not replace them blindly.

Determine whether Job Card can evolve into / represent operation-level
Work Orders.

Target conceptual relationship:

Manufacturing Order
 |
 +-- Work Order / Operation 10
 |
 +-- Work Order / Operation 20
 |
 +-- Work Order / Operation 30

If the current Job Card schema can support this, extend it.

Do NOT create duplicate:

job_cards
work_orders
production_jobs

unless there is a real domain reason.

============================================================
14. MANUFACTURING ORDER
============================================================

A Manufacturing Order represents the intent to produce.

Fields conceptually:

MO number
product
variant
BOM version
quantity
planned start
planned finish
priority
status
warehouse
routing
source demand

Status should be controlled.

Example:

draft
planned
material_check
released
in_progress
completed
cancelled
on_hold

Do not allow arbitrary status updates from the UI.

============================================================
15. MATERIAL REQUIREMENT ENGINE
============================================================

Material requirement should derive from:

Manufacturing Order
+
BOM version
+
quantity
+
wastage
+
existing supply

Do not simply copy BOM rows into requisitions.

Calculate:

Gross Requirement
- Available Stock
- Reserved Stock
- Expected Supply
= Net Requirement

Later:

Net Requirement
→ Make
OR
→ Buy

============================================================
16. MATERIAL RESERVATION
============================================================

Preserve existing material reservation logic.

Reservation is NOT consumption.

Reservation means:

"This quantity is committed to this manufacturing demand."

Material Issue means:

"This quantity has physically left available inventory."

Never collapse:

reserved_qty

and

issued_qty

into one field.

============================================================
17. MATERIAL ISSUE ENGINE
============================================================

Existing material issue RPC is strong.

Preserve the atomic transaction pattern.

Transaction should:

1. validate authorization
2. validate manufacturing state
3. validate item
4. validate warehouse
5. validate available stock
6. lock stock row
7. create inventory movement
8. reduce available stock
9. update reservation
10. update WIP if applicable
11. create audit event
12. commit

Everything must be atomic.

If one step fails, the entire transaction fails.

============================================================
18. WIP ENGINE
============================================================

Existing WIP warehouse model should be preserved.

Current WIP:

Raw material
→ WIP warehouse
→ Production
→ Finished Goods

Improve later for sequential routing:

Operation 10
→ WIP
→ Operation 20
→ WIP
→ Operation 30
→ WIP
→ FG

Do NOT implement complex operation-level WIP unless Routing exists.

============================================================
19. PRODUCTION ENGINE
============================================================

Production completion must be transactional.

Conceptually:

recordProduction()

1. authorize
2. validate manufacturing order
3. validate operation
4. validate quantity
5. validate material consumption
6. calculate yield
7. calculate scrap
8. update WIP
9. create FG pending-QC stock
10. record production entry
11. record costs
12. create audit event
13. commit

Do NOT allow production to directly bypass inventory transaction rules.

============================================================
20. QC GATE
============================================================

Current audit identified a dangerous condition:

Production can potentially make FG available before QC approval.

Fix this.

Target:

Production
 ↓
FG Pending QC
 ↓
QC
 ├── PASS → FG Available
 ├── REJECT → Rejection Stock
 └── REWORK → Rework process

Do not allow client UI to bypass this.

The database/server operation must enforce it.

============================================================
21. SCRAP ENGINE
============================================================

Existing scrap tracking is strong.

Preserve the existing defect breakdown.

Support:

- scrap quantity
- reason
- operation
- work center
- production entry
- date
- operator
- destination warehouse
- cost impact

Scrap must create an auditable inventory/production transaction.

Do not simply subtract it from production quantity.

============================================================
22. REWORK ENGINE
============================================================

Current system records rework quantity but does not automatically
create a rework Job Card.

Add later:

QC rejection
→ Rework decision
→ Rework Job Card
→ Operation
→ QC
→ FG / Reject

Do not create rework automatically for every rejection.

The QC workflow should determine whether:

Reject
or
Rework

============================================================
23. PRODUCTION COSTING ENGINE
============================================================

Current production costing is primarily material cost.

Target:

Material
+
Labor
+
Machine
+
Power
+
Overhead
=
Actual Production Cost

Do not hard-code costs.

Work centers should provide configurable rates.

Support eventually:

standard cost
actual cost
variance

Do not mix costing logic into React components.

Cost calculation should be a server-side/domain operation.

============================================================
24. CAPACITY ENGINE
============================================================

Use existing Work Centers.

Calculate:

Available Capacity
- Planned Load
= Remaining Capacity

Eventually:

Available Hours
× Efficiency
× Utilization

Compare:

Required Operation Time
vs
Available Work Center Capacity

Do not build a sophisticated scheduler initially.

First make capacity calculation correct.

============================================================
25. SCHEDULING
============================================================

After Routing + Work Centers + Capacity are stable.

Support:

- planned start
- planned end
- operation sequence
- work center
- priority
- due date

Do not build an AI scheduler initially.

Build deterministic scheduling first.

============================================================
26. MRP ENGINE
============================================================

MRP comes AFTER:

BOM
BOM versions
multi-level explosion
inventory correctness
reservations
manufacturing orders

MRP flow:

Demand
 ↓
BOM Explosion
 ↓
Gross Requirement
 ↓
Available Stock
 ↓
Reserved Stock
 ↓
Open PO
 ↓
Open MO
 ↓
Net Requirement
 ↓
Make / Buy

Initially support deterministic MRP.

Do not add forecasting/AI until the base calculation is correct.

============================================================
27. MAKE VS BUY
============================================================

For each material:

make
buy
both
configured

MRP should be able to recommend:

Create Purchase Order
or
Create Manufacturing Order

Do not automatically create documents without user confirmation
until the workflow is proven.

============================================================
28. INVENTORY ARCHITECTURE
============================================================

CRITICAL RULE:

Manufacturing does not own inventory balances.

Inventory remains the source of truth.

Manufacturing creates business events/transactions.

Example:

Material Issue
→ Inventory Movement
→ Stock Ledger

Production Receipt
→ Inventory Movement
→ FG Stock

Scrap
→ Inventory Movement
→ Scrap Stock

Never do:

UPDATE item_stock
from random React component code.

All critical stock changes must go through trusted server-side
transaction functions/RPCs.

============================================================
29. SQL / RPC DESIGN
============================================================

Use PostgreSQL functions/RPCs for critical state transitions.

Examples:

issue_job_card_materials()
accept_grn()
release_fg_after_qc()
reserve_manufacturing_materials()
release_manufacturing_order()
record_production()
record_scrap()
create_rework_order()
calculate_bom_requirements()
calculate_mrp_requirements()
calculate_production_cost()

Do not create an RPC for every simple SELECT.

Use direct Supabase reads for normal read-only queries where safe.

Use server-side transactional functions for:

- stock movement
- production
- reservation
- approval
- QC release
- costing
- MRP state changes
- other privileged operations

============================================================
30. RPC SECURITY
============================================================

Every mutation RPC must:

- verify authenticated user
- verify organisation membership
- validate organisation_id
- validate document ownership
- validate permissions
- validate state transition
- validate quantities
- validate stock
- perform transaction atomically

Never trust organisation_id supplied by the browser.

Derive/validate tenant membership server-side.

Do not expose arbitrary SECURITY DEFINER functions.

Set search_path explicitly where appropriate.

============================================================
31. SQL TRANSACTION SAFETY
============================================================

For stock-sensitive transactions:

Use:

SELECT ...
FOR UPDATE

where row-level locking is required.

Protect against:

- duplicate issue
- double production
- concurrent stock issue
- duplicate QC release
- duplicate GRN acceptance
- duplicate production submission

Use unique constraints/idempotency where appropriate.

Do not rely only on React button disabling.

A user can have:

two browser tabs
two users
mobile + desktop
network retries

The database must remain correct.

============================================================
32. IDEMPOTENCY
============================================================

Critical commands should be safely retryable.

Example:

recordProduction(document_id)

If the client retries because of network timeout,
the system must NOT create production twice.

Use:

- unique business document identifiers
- transaction identifiers
- unique constraints
- state validation

where appropriate.

============================================================
33. AUDIT LOGGING
============================================================

Preserve manufacturing_activity_log.

Important events:

BOM published
BOM version changed
MO released
Material reserved
Material issued
Production started
Production completed
QC passed
QC rejected
Scrap recorded
Rework created
FG released
MO cancelled

Audit should capture:

who
what
when
document
old state
new state

============================================================
34. STATE MACHINE RULES
============================================================

Never allow arbitrary status changes.

Example:

Manufacturing Order:

draft
→ planned
→ material_check
→ released
→ in_progress
→ completed

Allowed cancellation only where business rules permit.

Example:

QC:

pending
→ passed
→ released

or:

pending
→ rejected

or:

pending
→ rework

Implement transition validation server-side.

============================================================
35. DATABASE CONSTRAINTS
============================================================

Prefer database constraints for invariants.

Examples:

quantity > 0

wastage_pct >= 0

sequence > 0

operation_no unique per routing

document_no unique per organisation

no negative stock where prohibited

no duplicate active BOM version

no circular BOM

Do not rely only on Zod/client validation.

Client validation is UX.

Database validation is integrity.

============================================================
36. RLS
============================================================

Preserve existing manufacturing RLS.

Every manufacturing table must remain tenant isolated.

Every policy must enforce organisation membership.

Never use:

USING (true)

for tenant-sensitive tables.

Verify:

organisation_id

org_members

user_organisations

and role permissions.

============================================================
37. DO NOT CREATE DUPLICATE DOMAINS
============================================================

Before adding a table, search the repository.

Before adding:

work_orders

check Job Cards.

Before adding:

stock_movements

check inventory transactions.

Before adding:

machines

check existing machine/tooling tables.

Before adding:

production_orders

check existing production entries/job cards.

Before adding:

warehouses

use existing WMS.

The rule:

> Extend existing domain objects before creating parallel ones.

============================================================
38. FRONTEND ARCHITECTURE
============================================================

React is NOT the source of truth for manufacturing state.

Frontend responsibilities:

- collect input
- display state
- display validation errors
- invoke domain operation
- invalidate/refetch queries
- show progress
- provide good UX

Frontend must NOT:

- calculate authoritative stock
- perform multi-step stock mutation
- decide whether QC allows FG release
- bypass status transitions
- create accounting entries
- trust client-supplied tenant ownership

Use React Query for server state.

Keep business operations behind service/RPC boundaries.

============================================================
39. UX PHILOSOPHY
============================================================

UI is important.

But UI must expose the domain simply.

Do NOT make users configure:

Routing
Operations
Work Centers
BOM versions
MRP

unless their manufacturing actually needs them.

Start BOM creation with:

"How is this product manufactured?"

Options:

Simple Assembly

Multi-Step Production

Multi-Level Assembly

Advanced

Then progressively configure the required complexity.

============================================================
40. SIMPLE ASSEMBLY UX
============================================================

User:

Product: Pump Assembly

How manufactured?

[ Simple Assembly ]

Then:

Components
+
Quantities
+
Wastage

Done.

Production flow:

BOM
→ Material Reservation
→ Material Issue
→ Production
→ QC
→ FG

Do NOT force Routing.

============================================================
41. MULTI-STEP UX
============================================================

User selects:

[ Multi-Step Production ]

Then offer:

"Define your production steps"

Example:

10 Cutting
20 Welding
30 Assembly
40 Testing
50 Packing

For each operation:

Work Center
Time
QC requirement
Optional parameters

Do not expose unnecessary advanced settings initially.

============================================================
42. MULTI-LEVEL UX
============================================================

User chooses:

[ Multi-Level Assembly ]

Allow:

Finished Product
→ Subassembly
→ Components

Show a visual hierarchy.

The user should understand the product structure.

Technical recursive BOM logic stays underneath.

============================================================
43. ADVANCED MODE
============================================================

Power users can access:

- BOM versions
- alternatives
- routing
- operation dependencies
- capacity
- costing
- MRP parameters
- make/buy
- yield
- scrap

Do not clutter normal workflows with these.

============================================================
44. PROGRESSIVE DISCLOSURE
============================================================

Beginner:

Simple Assembly

Advanced:

Routing
Capacity
MRP
Costing

The ERP should become more powerful as the user's needs grow,
without becoming intimidating.

============================================================
45. UI IMPLEMENTATION ORDER
============================================================

DO NOT redesign all manufacturing screens initially.

After the engine is stable:

1. BOM creation UX
2. Manufacturing Method selection
3. BOM version UX
4. Routing builder
5. Manufacturing Order
6. Material availability
7. Work Order execution
8. Production entry
9. QC gate
10. Scrap/Rework
11. Costing
12. MRP
13. Capacity dashboard
14. Manufacturing dashboard

============================================================
46. UX RULE
============================================================

Do not expose database terminology.

Bad:

"Create routing_headers"

Good:

"How is this product manufactured?"

Bad:

"Select operation sequence"

Good:

"Add production step"

Bad:

"Create manufacturing order"

Good:

"Plan Production"

The system should translate user intent into ERP transactions.

============================================================
47. DO'S
============================================================

DO:

- preserve existing working code
- reuse existing schemas
- reuse existing RPC patterns
- use PostgreSQL transactions
- use row locking where required
- enforce invariants at database level
- enforce tenant isolation
- make critical operations idempotent
- use immutable historical production references
- version BOMs
- separate BOM from Routing
- separate Planning from Execution
- separate Manufacturing from Inventory
- separate Inventory from Accounting
- keep UI thin
- progressively disclose advanced functionality
- test business transactions
- test concurrent transactions
- test cancellation
- test partial quantities
- test retries
- test multi-level BOMs
- test QC rejection/rework
- preserve audit history

============================================================
48. DON'TS
============================================================

DO NOT:

- rewrite working manufacturing tables
- create duplicate stock systems
- update stock from React
- trust browser-supplied organisation_id
- allow arbitrary status updates
- calculate authoritative financial values only in UI
- modify published BOM versions
- mutate historical production records
- silently change BOM used by existing MO
- automatically create PO/MO without controlled confirmation
- create routing for every simple product
- force MRP on simple users
- over-engineer scheduling initially
- introduce microservices
- introduce Spring Boot
- introduce another backend unnecessarily
- create a separate manufacturing database
- build dashboards before transaction correctness
- optimize for demo screenshots over data integrity

============================================================
49. TESTING REQUIREMENTS
============================================================

Before declaring Manufacturing V2 complete, test:

TEST 1 — Simple Assembly

BOM:
A = 2
B = 3

Production:
10 units

Expected:
A consumed = 20
B consumed = 30
FG = 10

TEST 2 — Insufficient Stock

Attempt issue > available stock.

Expected:
transaction fails completely.

TEST 3 — Concurrent Material Issue

Two users issue same stock simultaneously.

Expected:
no negative/corrupted stock.

TEST 4 — Duplicate Production

Retry same production request.

Expected:
no duplicate FG.

TEST 5 — Multi-Level BOM

FG
→ Subassembly
→ Components

Expected correct explosion.

TEST 6 — Routing

Operation 10
→ Operation 20
→ Operation 30

Expected sequence enforced.

TEST 7 — QC

Production
→ QC pending

Expected:
FG not available.

TEST 8 — QC rejection

Expected:
rejection/rework path.

TEST 9 — Scrap

Production:
100
Good:
95
Scrap:
5

Expected:
100 accounted for.

TEST 10 — BOM Version

MO uses V1.

Publish V2.

Expected:
existing MO still uses V1.

TEST 11 — Tenant Isolation

Organisation A attempts to access Organisation B manufacturing data.

Expected:
denied.

TEST 12 — Retry

Network timeout causes client retry.

Expected:
transaction remains idempotent.

============================================================
50. IMPLEMENTATION ORDER
============================================================

Do not implement everything in one giant change.

Phase 0:
Codebase inventory and dependency map.

Phase 1:
Harden existing stock mutations.

- GRN acceptance RPC
- FG QC release RPC
- verify all manufacturing stock paths

Phase 2:
BOM foundation.

- proper versioning
- multi-level explosion
- validation
- cost rollup

Phase 3:
Production costing.

- work center machine rate
- labor rate
- overhead
- actual vs standard

Phase 4:
Routing.

- routing headers
- operations
- work center assignment
- sequence
- operation execution

Phase 5:
WIP.

- operation-level WIP
- operation transitions
- partial quantities

Phase 6:
Capacity.

- available capacity
- planned load
- utilization
- overload detection

Phase 7:
MRP.

- demand
- BOM explosion
- stock
- reservation
- open PO
- open MO
- net requirement
- make/buy recommendation

Phase 8:
Rework.

- QC decision
- rework order/job card
- reinspection

Phase 9:
UX/UI.

Only now redesign and polish the Manufacturing experience.

============================================================
51. DEFINITION OF DONE
============================================================

Manufacturing V2 is NOT complete because:

- screens look good
- dashboards exist
- forms work
- tables exist

Manufacturing V2 is complete when:

A user can define a product.

Choose how it is manufactured.

Create a valid BOM.

Version it.

Plan production.

Calculate material requirements.

Reserve material.

Issue material atomically.

Execute operations if required.

Track WIP.

Record production.

Record scrap/rework.

Run QC.

Release good FG to inventory.

Calculate production cost.

Maintain an audit trail.

And every critical transaction remains correct under:

- concurrency
- retries
- partial execution
- cancellation
- multi-user access
- tenant isolation

============================================================
52. FINAL IMPLEMENTATION INSTRUCTION
============================================================

Before changing code:

1. Inspect existing implementation.
2. Map dependencies.
3. Identify reusable tables/functions.
4. Identify exact files to modify.
5. Identify migrations required.
6. Identify RPCs required.
7. Identify tests required.
8. Present the implementation plan.

DO NOT start by rewriting.

DO NOT modify files until the plan has been reviewed.

After the plan is approved, implement incrementally.

For every change report:

- files changed
- SQL migrations
- RPCs added/changed
- business rule added
- existing behavior preserved
- tests added
- risks

The goal is:

> Build a serious general-purpose Manufacturing Engine,
> inspired by the strongest capabilities of mature manufacturing ERP,
> while preserving our existing strong implementation and providing
> a much simpler, more intuitive user experience.

Manufacturing must remain a standalone module.

Do NOT couple Manufacturing architecture to Projects/EPC.

It must work equally well for:

- assembly manufacturers
- process manufacturers
- component manufacturers
- injection moulding
- fabrication
- general SME manufacturing

Projects may integrate with Manufacturing later,
but Manufacturing must NOT depend on Projects.