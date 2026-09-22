# ERP Current State

This document records the currently known state from the architecture/security baseline and prior audits.

**Important:** historical findings must be rechecked when the current repository/live DB may have changed.

## Stack

### Application
- React 19
- Vite
- TypeScript
- TanStack React Query 5
- TanStack Table
- shadcn/ui
- Tailwind CSS
- Lucide
- Framer Motion where already used

### Backend/data
- Supabase PostgreSQL
- Supabase Auth
- PostgreSQL RLS
- Supabase RPC/functions
- Vercel hosting

### Data access
The application uses Supabase/PostgREST and RPCs.

Historical baseline identified approximately 175 distinct RPC functions/references. Treat the exact current count as **NOT VERIFIED** until regenerated from the current repository/live database.

## Multi-tenancy

**CONFIRMED baseline:** organization-scoped tenancy is a core security boundary.

The application historically used `organization_id` filters together with RLS.

**Rule:** client-side organization filters are not sufficient security. RLS/server-side authorization must enforce the boundary.

## Critical inventory/data-integrity baseline

**DECISION / VERIFIED IN PRIOR AUDIT:**

- `item_stock` is a balance snapshot.
- `material_logs` is the canonical inventory movement ledger.
- Inventory identity includes:
  - `item_id`
  - `company_variant_id`
  - `warehouse_id`
- Delivery Challan approval atomically creates Material Outward and performs the associated stock transition.
- Draft Delivery Challans do not move stock.
- Duplicate/double deduction must be prevented.
- `adjust_item_stock` was identified as an unsafe legacy pattern and is not the preferred critical mutation path.

Before relying on these statements for a new implementation, reconcile them against the current live DB and repository.

## Hardened critical operations

Prior security remediation hardened atomic paths for:

- Delivery Challan;
- Material Inward;
- Material Outward.

These should be treated as established patterns, not bypassed with new client-side loops.

## Known historical risk patterns

The audits identified these categories as requiring scrutiny:

- direct client writes to `item_stock`;
- client-side loops for stock mutation;
- incomplete variant awareness;
- non-atomic multi-step business transitions;
- migration files not matching changes executed directly in Supabase.

Do not assume every instance remains present. Re-audit the current state.

## Performance baseline

Historical audits found:

- project module cold-load/runtime cost was significant;
- some modules had many static imports;
- Manufacturing shell had many statically imported sub-pages;
- lazy loading/code splitting was used or recommended;
- TanStack Query caching is part of the architecture.

Exact current performance numbers are **NOT VERIFIED** unless measured against the current build/runtime.

## Verification

The ERP has an intended verification model that combines:

- build/typecheck/test;
- real user workflows;
- security;
- tenant isolation;
- data integrity;
- regression;
- failure/retry scenarios.

The current verification implementation itself must remain aligned with `.agents/VERIFICATION.md`.

## Deployment/migrations

Supabase + Vercel are the deployment baseline.

Migration source-of-truth consistency is a critical concern.

Do not declare database migration completeness without reconciling repository migrations against the live DB.
