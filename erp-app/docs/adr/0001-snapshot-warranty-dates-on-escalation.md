# 1. Snapshot Warranty Dates on Claim Escalation

Date: 2026-06-22

## Status

Accepted

## Context

In the MEP/piping project management system, users can correct or update an equipment's commissioning date (`warranty_start_date`) after a warranty claim has already been formally generated and escalated to a vendor. 

If the system calculates warranty start and end dates dynamically via the equipment foreign key relation, any subsequent change to the commissioning date would retroactively alter the historical warranty window on old claim records. This creates a data integrity issue: the database record would no longer match the physical details printed on the PDF claim letter sent to the vendor, making audits and dispute tracking unreliable.

## Decision

We will snapshot and copy the equipment's current `warranty_start_date` and `warranty_end_date` into dedicated columns (`escalated_warranty_start` and `escalated_warranty_end`) on the `warranty_claims` table. 

This snapshot action will occur exactly when the claim's status transitions from `Draft` to `Pending Response` (i.e., when the claim is marked as sent to the vendor).

## Consequences

### Positive
* **Audit Integrity**: The claim record represents an immutable snapshot of the warranty window that was officially claimed and communicated to the vendor.
* **Resilience**: Changes to equipment commissioning dates will not retroactively break or alter historical claim audit trails.

### Negative
* **Data Duplication**: Replicates date fields from the `project_equipment` table, requiring slight database write overhead during status transitions.
