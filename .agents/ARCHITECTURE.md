# ERP Architecture Authority

## Status

**DECISION:** Preserve the established architecture unless an explicit architectural decision changes it.

## Application architecture

- React 19 + Vite
- TypeScript
- Modular ERP frontend
- TanStack Query for server-state fetching/caching
- TanStack Table where tabular data is appropriate
- shadcn/ui + Tailwind for UI
- Vercel for web deployment

## Backend architecture

- Supabase PostgreSQL
- Supabase Auth
- PostgreSQL RLS
- Supabase RPC/functions for server-side business operations where atomicity/authorization requires them

## Client/server responsibility

Simple CRUD may use established Supabase access patterns when security and integrity are sufficient.

Critical business transitions must be evaluated for server-side enforcement.

A business transition should move behind a server-side/RPC boundary when it requires:

- multiple dependent mutations;
- transactionality;
- atomicity;
- authoritative authorization;
- concurrency control;
- idempotency;
- protection from partial client failure.

## Module boundaries

Before adding a feature:

1. Find the existing module responsible for the concept.
2. Search for existing components/hooks/services/RPCs.
3. Extend an existing sound boundary where possible.
4. Avoid duplicate business concepts.

## Performance architecture

Evaluate:

- route-level/code splitting;
- lazy loading;
- static import cost;
- query waterfalls;
- unnecessary refetching;
- TanStack Query cache configuration;
- unnecessary component mounting;
- Supabase network latency.

Use measurement rather than intuition.

## Database/migration architecture

Database changes must have a repository source of truth.

For every schema/function/policy/trigger/index change:

- identify the migration;
- ensure it is reproducible;
- reconcile it against the live database;
- understand rollback/recovery implications.

## Architecture changes

A new feature must not silently create a second architecture.

If the existing architecture is insufficient:

- document the limitation;
- propose the smallest safe architectural change;
- identify security/data/performance impact;
- require an explicit decision before treating it as the new standard.
