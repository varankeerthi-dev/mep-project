# 2. Decoupled Material Returns and Credit Notes

Date: 2026-07-22

## Status

Accepted

## Context

When materials are returned from construction sites (leftovers or project completion surplus), storekeepers or site managers document the physical receipt of goods at the warehouse via a Material Return document. 

Some of these returned materials are associated with invoice items and warrant financial adjustments (billing adjustments via Credit Notes). If the system automatically generates Credit Notes upon completion of a Material Return document:
1. It bypasses authorization checkpoints: storekeepers (who manage logistics and physical count) could unilaterally issue legal financial credits to clients.
2. It reduces operational flexibility: invoice-mapped returns might require verification of pricing, original discounts, and billing terms before credit adjustment.

## Decision

We will decouple the physical material returns process from the financial credit note generation:
1. Completing a Material Return document only processes the physical stock updates (updating `item_stock` and the project consumption report).
2. The creation of Credit Notes remains a manual action. Users with billing/financial authorization (e.g. Administrators or Project Managers) must explicitly click "Generate Credit Note" on the completed Return document or through financial/operational tasks.
3. Decoupling allows deferring the dashboard/operational task assignment for credit note adjustments, which will be integrated post-implementation.

## Consequences

### Positive
* **Financial Control**: Storekeepers cannot unilaterally issue financial credits. Billing and finance teams retain control over the timing and value of Credit Notes.
* **Flexibility**: Accounts for pricing corrections, tax adjustments, and manual review of items before finalizing credit.

### Negative
* **Two-Step Action**: Requires an authorized billing user to manually process the credit note after the physical return is marked complete, rather than it happening automatically.
