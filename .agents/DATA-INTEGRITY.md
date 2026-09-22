# ERP Data Integrity Authority

## Principle

Business state must remain correct under success, failure, retry, concurrency, and unauthorized access.

## Atomic business transitions

When an action changes multiple related records that must remain consistent, use an atomic server-side/database operation.

Avoid client-side loops for critical transitions.

## Inventory

Inventory identity and movement are sensitive business invariants.

Established baseline:

- `item_stock` represents the current balance/snapshot.
- `material_logs` represents the canonical movement ledger.
- inventory identity includes `item_id + company_variant_id + warehouse_id`.

Verify current live schema before extending these rules.

Any inventory mutation must consider:

- item;
- company variant;
- warehouse;
- quantity;
- movement direction;
- source document;
- transactionality;
- concurrency;
- retries;
- duplicate execution;
- auditability.

## Delivery Challan

Established product rule:

- Draft Delivery Challan does not move stock.
- Approval creates Material Outward and the associated stock transition atomically.
- Duplicate/double deduction must be prevented.
- Cancellation/reversal behavior must preserve the inventory invariant.

Do not introduce a second stock-deduction path.

## Material Inward/Outward

Use the established hardened atomic patterns.

Do not recreate the operation as multiple independent client requests.

## Idempotency

Evaluate retries caused by:

- network failures;
- user retry;
- double-click;
- background jobs;
- AI agent retries.

Where duplicate execution can corrupt state, the operation needs an explicit idempotency/duplicate-prevention strategy.

## Concurrency

Evaluate simultaneous updates to:

- stock;
- quotation revisions;
- orders;
- invoices;
- payments/ledger;
- approvals;
- tasks where state transitions matter.

## Database constraints

Use database constraints/transactions/functions when necessary to enforce invariants.

Frontend validation is not a sufficient business-integrity boundary.
