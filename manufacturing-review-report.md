# Manufacturing Feature — Shopfloor Readiness Review

**Date:** 2026-08-10  
**Scope:** `apps/web/src/features/manufacturing`  
**Reviewer:** Production Manager / Engineering Audit  

---

## Executive Summary

The manufacturing feature is functionally complete at the CRUD layer. It is not safe for a live shopfloor environment. The findings below are correctness and risk issues, not style preferences. They will surface under operator pressure on day one.

---

## Findings

### 1. No transaction safety on stock mutations
Every stock-affecting operation issues multiple sequential Supabase calls. If any step fails, inventory is left in an inconsistent state. This is the highest-priority risk.

**Affected:** `jobCardRepository.ts`, `productionEntryRepository.ts`, `storesRepository.ts`, `qcRepository.ts`, `dispatchRepository.ts`

---

### 2. Warehouse resolution logic is duplicated and diverged
The same "find Main Store, find WIP, find FG" block is copy-pasted across at least seven functions. Each copy has slightly different fallback logic. A single warehouse restructure will break one of them silently.

**Affected:** `jobCardRepository.ts`, `productionEntryRepository.ts`, `storesRepository.ts`, `dispatchRepository.ts`, `qcRepository.ts`

---

### 3. No concurrency protection
Two operators can issue the same material simultaneously. Both read the same stock count, both pass validation, both deduct. Stock goes negative with no error. There is no row-level locking or reservation pattern.

**Affected:** All stock-mutating paths

---

### 4. `model/types.ts` is a junk drawer
423 lines containing BOM, JobCard, ProductionEntry, Dispatch, QC, GRN, MaterialRequisition, WorkCenter, ProductionPlan, IPQC, and WIP types. A dispatch operator should not need to import IPQC types. This creates unnecessary coupling and slows navigation.

**Affected:** `model/types.ts`

---

### 5. No input validation layer
Nothing prevents:
- Issuing more material than physically exists
- Creating a production entry with zero consumed quantity
- Deleting a job card that has production history
- Confirming a dispatch with zero items

Validation is currently implicit in optimistic UI, not enforced at the data layer.

**Affected:** All mutation hooks and repositories

---

### 6. `updateProductionEntryAggregate` does not reverse stock movements
`createProductionEntryAggregate` and `deleteProductionEntryAggregate` adjust stock correctly. `updateProductionEntryAggregate` does not calculate the delta between old and new quantities. Editing a production entry from 100 to 50 units leaves inventory overstated.

**Affected:** `productionEntryRepository.ts`

---

### 7. Hardcoded user names in activity logs
Rows contain `user_name: 'System User'`, `user_name: 'Stores Officer'`, `user_name: 'Plant Manager'`. These are fictional values written into the database. Audit trails built on this data are unreliable.

**Affected:** `jobCardRepository.ts`, `productionEntryRepository.ts`, `storesRepository.ts`, `qcRepository.ts`, `dispatchRepository.ts`

---

### 8. `fetchProductionEntries` can return cross-tenant data
When `orgId` is omitted, the query runs without an organisation filter. In a multi-tenant system, this returns every production entry in the database.

**Affected:** `productionEntryPersistence.ts`

---

### 9. `stores/` directory contains procurement logic
`storesRepository.ts` handles Material Requisitions and Goods Receipt Notes. These are procurement and inbound QC functions, not store operations. The directory name is misleading and complicates onboarding.

**Affected:** `repository/storesRepository.ts`, `persistence/storesPersistence.ts`, `hooks/useStores.ts`

---

### 10. Hook layer has high boilerplate, low shared infrastructure
11 hook files follow the same pattern with no shared base. Query key invalidation is manual and inconsistent. Adding a new query key convention requires touching every file.

**Affected:** `hooks/` directory

---

## Recommended Actions

### Immediate (this week)
1. Wrap all multi-table stock mutations in Supabase transactions.
2. Extract warehouse resolution into a single shared function.
3. Fix `updateProductionEntryAggregate` to compute and apply stock deltas.

### This sprint
4. Split `model/types.ts` into domain files.
5. Add a validation layer before mutations.
6. Pass real user objects to activity log calls.

### Before next shopfloor deployment
7. Add stock reservation or row-level locking.
8. Make `orgId` required in `fetchProductionEntries` or throw on missing value.
9. Add a nightly data integrity audit script.
10. Separate procurement into a `procurement/` directory.
