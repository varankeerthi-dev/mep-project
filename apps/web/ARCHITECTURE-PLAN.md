# Architecture Blueprint v1.0 — MEP ERP

## Context

This blueprint is the output of an architecture review of `apps/web/src` in the MEP ERP project. It defines the target architecture, the phases to get it there, and the governance to sustain it.

**Review date:** 2026-07-16  
**Version:** 1.0 (Production-grade)

---

## Architectural Evolution

This system is intentionally designed as a **modular monolith**, not a microservices architecture. The feature boundaries, engine contracts, and domain models established in this blueprint are built to enable independent evolution, but remain deployed as a single application.

**Evolution Path:**

- **Today:** Monolith (React + Supabase)
- **2 Years:** Modular Monolith (enforced boundaries, distributed route registries, domain events)
- **5 Years (If warranted):** Extract separate services (Reporting, AI Parsing, Notifications) only when scale or team size demands it.

This document explicitly states: **The target architecture is a modular monolith.** Premature distribution will not be approved.

---

## Architectural Principles

These principles are the standard every engineer follows when making design decisions in this codebase.

### 1. Dependency Rule

Dependencies point inward.

```
Features  →  Domain  →  Platform  →  Shared
```

Never:

```
Quotation → Invoice → CRM
```

Features never import from each other directly. They communicate through shared interfaces in Domain or Platform.

### 2. Single Source of Truth

Every important concept has exactly owner.

| Concept | Owner |
|---------|-------|
| Routes | Route Registry |
| Permissions | Permission Catalog |
| Pricing | Pricing Engine |
| Tax | Tax Engine |
| Templates | Template Registry |

If a second implementation appears, that is technical debt. Delete one.

### 3. Business Logic Lives Outside UI

React components compose UI. They do not calculate business rules.

**Good:**

```
Component → useQuotation() → PricingEngine
```

**Bad:**

```
Component → pricing calculation → discount logic → totals
```

### 4. Separate Platform Core from Business Core

Platform contains infrastructure capabilities: routing, auth, API, query, logging, telemetry.

Domain contains business engines: pricing, tax, printing.

If it knows about GST or HSN codes, it is business. It belongs in `domain/`, not `platform/`.

### 5. Performance Is Architecture

Performance is not an afterthought. It is an architectural constraint.

- Lazy-load features, not individual components.
- Keep bundle boundaries aligned with feature modules.
- Avoid global providers that force unnecessary re-renders.
- Prefer React Query cache over duplicated client state.
- Use virtualization for large tables.
- Measure before optimizing.

### 6. Introduce Abstractions Only Where They Reduce Complexity

The goal is not to add layers. It is to create clear ownership boundaries, eliminate duplication, and make the ERP safer to evolve.

---

## Engineering Principles

Not architecture. Engineering. These govern how code is written, not just how it is organized.

### 1. Prefer Composition Over Inheritance

Never use class inheritance for sharing behavior. Compose small functions and small modules.

### 2. Prefer Pure Functions

Especially in: Pricing, Tax, Ledger, Payroll.

Pure functions are testable, cacheable, and predictable. Side effects belong at the edges.

### 3. Prefer Explicitness

No magic registration. No decorators. No runtime reflection. No auto-discovery.

If a module needs to be wired, wire it explicitly.

### 4. Prefer Type Safety

Avoid `any`. Prefer discriminated unions. Use branded IDs. Use `readonly` types.

```ts
type QuotationId = string & { readonly __brand: 'QuotationId' };
```

### 5. Prefer Incremental Change

No "big bang" rewrites. Every refactor coexists with the old implementation, migrates incrementally, and deletes the old code immediately after migration.

---

## Non-Goals

Do not introduce:

- Repository pattern over Supabase
- Generic CRUD service wrappers around simple `useQuery` hooks
- Factory patterns without multiple implementations
- Base classes for React components
- Generic abstraction layers over Supabase
- Service wrappers around simple `useQuery` hooks

If a `useQuery` hook is already simple and correct, leave it alone.

If a future architecture review suggests any of these, reject it.

---

## Domain Model Layer

Between the database and the business logic, there is a domain model layer.

```
Supabase Row (DTO)
  ↓
Mapper
  ↓
Domain Model
  ↓
Business Rules
  ↓
DocumentVM
```

The domain model is a real TypeScript object with behavior and invariants. It is not a Supabase row.

### Why

Today, Supabase rows flow through the application. `quotation.client_name`, `quotation.gst_number` — those are persistence models. If the database schema changes, every consumer breaks.

With a domain model, the database can change without touching business logic. The mapper absorbs the change.

### Scope

Not everywhere. Only for entities with substantial business logic:

- Quotation
- Invoice
- Purchase Order
- Ledger

Simple CRUD entities (clients, items, employees) remain as typed Supabase rows.

### Invariants

Domain models are not typed DTOs. They enforce business rules.

A `Quotation` domain model:
- Cannot contain duplicate line numbers
- Cannot have negative quantity
- Cannot transition from `Approved` back to `Draft`

These invariants are enforced in the model's methods, not in UI components or database constraints alone.

### How

```ts
// domain/quotation/types.ts
export type Quotation = {
  readonly id: QuotationId;
  readonly clientId: ClientId;
  readonly items: readonly QuotationItem[];
  readonly status: QuotationStatus;
  readonly pricing: PricingResult;
};

// domain/quotation/model.ts
export function addItem(quotation: Quotation, item: QuotationItem): Quotation {
  if (quotation.items.some(i => i.lineNumber === item.lineNumber)) {
    throw new Error('Duplicate line number');
  }
  if (item.qty < 0) {
    throw new Error('Quantity cannot be negative');
  }
  return { ...quotation, items: [...quotation.items, item] };
}

export function approve(quotation: Quotation): Quotation {
  if (quotation.status === 'Draft') return { ...quotation, status: 'Approved' };
  throw new Error('Only Draft quotations can be approved');
}
```

The domain model is immutable. Operations return new instances.

---

## Domain vs Engines

`domain/` contains both business concepts and the engines that serve them.

- **Rules** are feature-specific. They live inside the feature's domain folder.
- **Engines** are reusable across features. They live at the root of `domain/`.

```
domain/
├── quotation/      # Quotation business rules, model, mapper
├── invoice/        # Invoice business rules, model, mapper
├── inventory/      # Inventory business rules, model, mapper
├── accounting/     # Ledger business rules, model, mapper
├── pricing/        # Reusable Pricing Engine (shared)
├── tax/            # Reusable Tax Engine (shared)
└── printing/       # Reusable Printing Engine (shared)
```

This prevents `domain/` from becoming a catch-all folder. The `quotation/` folder contains everything related to quotations, including its specific rules. The `pricing/` folder contains the engine reused by Quotation, Invoice, and PO.

---

## Rules vs Engines

- **Rules** are feature-specific business logic.
  - Example: Quotation status transitions. Approval validation.
  - Location: `features/quotation/rules.ts` or `domain/quotation/rules.ts`
- **Engines** are reusable business logic.
  - Example: Pricing, GST, Currency, Printing.
  - Location: `domain/pricing/`, `domain/tax/`, etc.

This keeps responsibilities clear. A feature's rules do not belong in a shared engine.

---

## Feature Module Contract

A feature is a business capability. It owns:

| Owns | Example |
|------|---------|
| Routes | `quotation/routes.ts` |
| UI components | `quotation/components/` |
| Queries | `quotation/queries/` |
| Mutations | `quotation/mutations/` |
| Hooks (UI state) | `quotation/hooks/` |
| Types | `quotation/types.ts` |
| Validators | `quotation/validators.ts` |
| Permissions | `quotation/permissions.ts` |
| Public API | `quotation/index.ts` |

It does **not** own:

- Auth
- RBAC infrastructure
- API client
- Logging
- Cross-cutting infrastructure

Those belong in Platform.

### Public API Boundary

Every feature exposes exactly one public entry point: `index.ts`.

Everything else inside the feature is private.

```ts
// ✅ Good — imports from the public API
import { QuotationForm } from '@/features/quotation';

// ❌ Bad — reaches into internals
import { QuotationForm } from '@/features/quotation/components/QuotationForm';
```

This gives each feature a hard boundary. You can reorganize internals without affecting the rest of the application.

---

## Query Layer Separation

Server state and UI state are separated within each feature:

```
features/quotation/
├── queries/
│   └── quotationQueries.ts      # useQuery hooks (server state)
├── mutations/
│   └── quotationMutations.ts     # useMutation hooks (server writes)
├── hooks/
│   └── useQuotationFilters.ts    # UI state only (filters, pagination, view mode)
```

A query hook fetches data. A UI hook manages local view state. They do not mix.

---

## End-State Architecture Flow

```
                React UI
                    │
             Feature Module
             (index.ts boundary)
                    │
     ┌──────────────┼──────────────┐
     │              │              │
  Queries       Mutations     Business Rules
     │              │              │
     └──────────────┼──────────────┘
                    │
              Domain Models
                    │
              Domain Engines
                    │
             Platform APIs
                    │
                Supabase
```

Responsibilities flow downward. Dependencies point inward. Features never import from each other directly.

---

## Final Target Architecture

```
apps/web
│
├── platform/
│   ├── routing/
│   ├── auth/
│   ├── rbac/
│   ├── api/
│   ├── query/
│   ├── logging/
│   ├── telemetry/
│   ├── audit/
│   └── tracing/
│
├── domain/
│   ├── quotation/
│   ├── invoice/
│   ├── inventory/
│   ├── accounting/
│   ├── pricing/
│   ├── tax/
│   └── printing/
│
├── features/
│   ├── quotation/
│   │   ├── index.ts
│   │   ├── routes.ts
│   │   ├── permissions.ts
│   │   ├── types.ts
│   │   ├── validators.ts
│   │   ├── components/
│   │   ├── pages/
│   │   ├── queries/
│   │   ├── mutations/
│   │   ├── hooks/
│   │   └── print/
│   ...
│
├── shared/
│   ├── ui/
│   ├── hooks/
│   ├── lib/
│   └── types/
│
└── app/
    ├── router/
    └── providers/
```

---

## Architecture Decision Records (ADRs)

Every major architectural decision gets documented as an ADR. Future engineers understand **why** a decision was made, not just **what** was decided.

| ADR | Title | Status |
|-----|-------|--------|
| ADR-001 | Why a Route Registry? | Accepted |
| ADR-002 | Why a Domain Model Layer? | Accepted |
| ADR-003 | Why Feature Modules with `index.ts` boundaries? | Accepted |
| ADR-004 | Why Platform vs Domain separation? | Accepted |
| ADR-005 | Why a Modular Monolith over Microservices? | Accepted |
| ADR-006 | Why in-process Domain Events? | Accepted |
| AADR-007 | Why Architectural Fitness Functions? | Accepted |

ADRs live in `docs/adr/`. Each ADR follows the standard format: Context, Decision, Status, Consequences.

---

## Compatibility Policy

### Internal Modules

Internal modules may change at any time. No guarantee of stability.

### Public APIs

Public APIs (feature `index.ts` exports, Engine contracts, Platform interfaces) require deprecation before removal.

### Deprecation Flow

1. Mark old API as `@deprecated` with JSDoc explaining the replacement.
2. Ship a minor version with the old API still working.
3. Ship a major version with the old API removed.

This keeps large refactors safe.

### Versioning Strategy

Introduce explicit versioned implementations (e.g., `PricingEngineV2`) **only** when you need to support two active contracts simultaneously. Until then, keep a single implementation behind a stable interface. Do not version preemptively.

---

## Feature Lifecycle Checklist

When creating a new feature module, every engineer follows this checklist:

- [ ] `routes.ts` — route definitions registered with the router
- [ ] `permissions.ts` — permission keys for this feature
- [ ] `index.ts` — public API (only exports what consumers need)
- [ ] `queries/` — server state hooks
- [ ] `mutations/` — server write hooks
- [ ] `validators/` — Zod schemas for form validation
- [ ] `types.ts` — domain types and branded IDs
- [ ] `tests/` — unit tests for business rules and mappers
- [ ] `print/` — print templates (if applicable)
- [ ] ADR — if the feature introduces an architectural decision

Now every module starts consistently.

---

## Phase 1 — Navigation Platform

**Goal:** Introduce the metadata layer the ERP has been missing.

### Steps

1. **Define the RouteConfig type**

   ```ts
   interface RouteConfig {
     id: string;
     path: string;
     component: React.LazyExoticComponent<React.ComponentType<any>>;
     module: string;
     permission?: string;
     title: string;
     icon?: LucideIcon;
     showInSidebar?: boolean;
     quickCreate?: boolean;
     searchable?: boolean;
     breadcrumb?: boolean;
   }
   ```

2. **Create the Route Registry**

   - One `.ts` file (not `.tsx`) — pure data.
   - Every route is an entry in the registry.
   - Use `lazy(() => import(...))` at the field level.
   - Group by module in the file for readability.

3. **Build the Router component**

   - Reads the registry.
   - Feeds React Router's `matchRoutes()` / `generatePath()`.
   - Handles Suspense + `PageSkeleton` fallback.
   - Wraps each route in `RouteGuard` (Phase 2).

4. **Derive Sidebar from the registry**

   - Filter routes where `showInSidebar === true`.
   - Group by `module`.
   - Sort by order field.
   - Remove the hardcoded `menuData` array from `Sidebar.tsx`.

5. **Derive Quick Access from the registry**

   - Filter routes where `quickCreate === true`.
   - Remove the hardcoded list from `QuickAccessBar.tsx`.

6. **Derive Breadcrumbs from the registry**

   - Match current path against registry.
   - Build trail from `module` + `title`.
   - Remove inline breadcrumb logic from pages.

7. **Delete the old switch**

   - Remove the 132-case `switch(pathKey)` from `App.tsx`.
   - Remove the parallel `menuData` from `Sidebar.tsx.
   - Remove the parallel list from `QuickAccessBar.tsx`.

8. **Keep React Router**

   - Use `matchRoutes()` and `generatePath()` for dynamic routes.
   - Do not write a custom matcher.

### Migration Rules

- The new registry and the old switch must coexist during migration.
- Migrate routes in batches (by module).
- Delete each old case as its module's routes move to the registry.
- Delete the switch entirely only when 100% of routes are in the registry.
- Never maintain two permanent routing systems.

### Success Metrics

Phase 1 is complete when:

- [ ] `App.tsx` < 150 lines
- [ ] No `switch(pathKey)` statement
- [ ] Sidebar derives 100% from the Route Registry
- [ ] Quick Access derives 100% from the Route Registry
- [ ] Breadcrumbs derive 100% from the Route Registry
- [ ] 100% of routes use the registry
- [ ] No hardcoded route paths in Sidebar or QuickAccessBar

### Testing Strategy

- **Route generation:** Unit test that the registry produces valid React Router routes.
- **Navigation:** Integration test that sidebar clicks navigate to the correct path.
- **Breadcrumb generation:** Unit test that breadcrumbs build correctly from the registry for nested paths.
- **Guard integration:** Test that `RouteGuard` receives the correct `RouteConfig`.

---

## Phase 2 — Access Platform

**Goal:** One decision, one place, every route protected.

### Steps

1. **Define the AccessEvaluator**

   ```ts
   type AccessDecision = {
     allowed: boolean;
     route?: 'no_permission' | 'module_disabled' | 'no_subscription' | 'feature_disabled';
   };

   function evaluateAccess(
     user: User,
     route: RouteConfig,
     context: OrgContext
   ): AccessDecision;
   ```

2. **Make the route model metadata-driven**

   Instead of a single `permission` string, allow richer access metadata:

   ```ts
   interface RouteConfig {
     // ...
     access?: {
       permission?: string;
       requiresModule?: string;
       requiresPlan?: 'free' | 'professional' | 'enterprise';
       featureFlag?: string;
     };
   }
   ```

3. **Implement the evaluator**

   Combine:
   - RBAC permission check (`route.access.permission`)
   - Module enabled check (`org_modules`)
   - Subscription/plan check (`route.access.requiresPlan`)
   - Feature flag check (`route.access.featureFlag`)
   - Organization state check

   Return a single decision with a reason.

4. **Build the RouteGuard component**

   - Wraps every route.
   - Calls `evaluateAccess()`.
   - On deny: redirect or render fallback based on reason.
   - On allow: render children.

5. **Remove scattered checks**

   - Remove inline `useHasPermission` calls from page components.
   - Remove the `AdminRoute` wrapper (folded into `RouteGuard`).
   - Remove the `PermissionGuard` wrapper (folded into `RouteGuard`).
   - Fix the `PermissionGuard` prop bug (`permissions` vs `permission`).

### Migration Rules

- The new `RouteGuard` and old `PermissionGuard`/`AdminRoute` must coexist.
- Migrate routes module by module.
   - Delete each old guard as its routes move to `RouteGuard`.
- Delete old guards entirely only when 100% of routes use `RouteRouteGuard`.

### Success Metrics

Phase 2 is complete when:

- [ ] `RouteGuard` wraps 100% of routes
- [ ] No `PermissionGuard` or `AdminRoute` components in the codebase
- [ ] No inline `useHasPermission` calls in page components
- [ ] `evaluateAccess()` is the single entry point for access decisions
- [ ] Every denied access has a reason
- [ ] Every route access metadata is extensible without changing the evaluator

### Testing Strategy

- **Access matrix:** Unit test `evaluateAccess` against all permission/module/plan/flag combinations.
- **Guard rendering:** Test that `RouteGuard` renders children on allow and fallback on deny.
- **Reason codes:** Test that each deny reason maps to the correct redirect/fallback behavior.

---

## Phase 3 — Document Platform

**Goal:** Separate calculation from rendering so templates can't break tax logic.

### Architecture

```
Quotation
  ↓
Assembler          (fetches data, maps DTO → Domain Model)
  ↓
Pricing Engine     (pure functions, versioned contract)
  ↓
Tax Engine         (pure functions, versioned contract)
  ↓
DocumentVM         (immutable, typed presentation model)
  ↓
Template           (layout only, no calculations)
  ↓
Renderer           (jsPDF or react-pdf → Blob)
  ↓
PDF
```

The Assembler computes everything. The DocumentVM is a pure presentation model. The Template only renders it. The Template never calls a Pricing Engine or Tax Engine.

### Steps

1. **Define the DocumentVM type**

   - Typed presentation model with all fields a template needs.
   - No raw domain objects — only pre-computed values.
   - **Immutable.** Once the Assembler produces a DocumentVM, nothing mutates it. This guarantees that Template A, Template B, and the Renderer all see identical data.

2. **Build the Pricing Engine**

   - Discount application, rate-after-discount, taxable amount, totals, margin, currency formatting.
   - Pure functions. No Supabase calls.
   - Versioned contract: `PricingEngine.calculate()` is the public API. Internals can change; consumers don't.

3. **Build the Tax Engine**

   - CGST/SGST/IGST split, interstate determination, HSN-wise tax summary, tax breakdown.
   - Pure functions. No Supabase calls.
   - Versioned contract: `TaxEngine.calculate()` is the public API.

4. **4. Build the Assembler**

   - Fetches all data (quotation, company, client, template config, source, materials).
   - Maps Supabase DTOs to Domain Models.
   - Runs Pricing Engine and Tax Engine.
   - Produces an immutable DocumentVM.

5. **5. Build the Template Registry**

   - Maps `printStyle` → template component.
   - Each template only reads from `DocumentVM`. No calculations.

6. **6. Build the Renderer**

   - Takes a template + `DocumentVM` → `Blob`.
   - Handles jsPDF, react-pdf, and pdf-lib output.

7. **Migrate templates one at a time**

   - Start with `grid_minimal` (already uses ViewModel pattern).
   - Then `proGrid` (8 files).
   - Then `enterprise`, `sakthi`, `vertical`.
   - Delete each old generator after migration.

### Migration Rules

- New and old paths coexist during migration.
- Migrate one template at a time.
- Delete each old generator file immediately after its template is migrated.
- Never maintain two permanent document generation systems.

### Success Rules

Phase 3 is complete when:

- [ ] No template contains calculation logic
- [ ] The Pricing Engine has one implementation
- [ ] The Tax Engine has one implementation
- [ ] The DocumentVM is the single contract between assembler and template
- [ ] The DocumentVM is immutable — no mutations after assembly
- [ ] The Template never calls an Engine
- [ ] No `formatCurrency` or `numberToWords` duplication (one shared utility)

### Testing Strategy

- **Pricing Engine:** Unit tests for discount application, rounding, margin calculation.
- **Tax Engine:** Golden tests for GST calculations (CGST/SGST/IGST split, HSN summary).
- **DocumentVM:** Snapshot tests for assembled view models.
- **Template:** Visual regression tests on rendered PDFs.

---

## Phase 4 — Feature Architecture

**Goal:** Reorganize the application by business capability.

**Why before Phase 5:** Domain services should live inside feature boundaries. If you build services first, you'll move them later — unnecessary churn. By reorganizing into features first, services have a home from day one.

### Steps

1. **Create the `features/` directory**
2. **Move each module into its feature folder**

   ```
   features/quotation/
   ├── index.ts
   ├── routes.ts
   ├── permissions.ts
   ├── types.ts
   ├── validators.ts
   ├── components/
   ├── pages/
   ├── queries/
   ├── mutations/
   ├── hooks/
   └── print/
   ```

3. **Enforce the feature contract**

   - A feature owns its routes, UI, queries, mutations, hooks, types, validation, business rules, permissions, and print templates.
   - A feature does not own auth, RBAC, API, logging.
   - Features do not import from each other directly.

4. **Distribute the Route Registry**

   Instead of one giant `RouteRegistry.ts`, each feature owns its routes:

   ```ts
   // features/quotation/routes.ts
   export const quotationRoutes: RouteConfig[] = [
     { id: 'quotation.list', path: '/quotation', ... },
     { id: 'quotation.create', path: '/quotation/create', ... },
     { id: 'quotation.edit', path: '/quotation/edit', ... },
   ];
   ```

   The app router combines them:

   ```ts
   // app/router/index.ts
   import { quotationRoutes } from '@/features/quotation';
   import { inventoryRoutes } from '@/features/inventory';
   // ...

   export const routeRegistry = [
     ...quotationRoutes,
     ...inventoryRoutes,
     // ...
   ];
   ```

   This preserves the single source of truth while avoiding a monolithic registry file.

5. **Create `platform/` for infrastructure capabilities**

   ```
   platform/
   ├── routing/
   ├── auth/
   ├── rbac/
   ├── api/
   ├── query/
   ├── logging/
   ├── telemetry/
   ├── audit/
   └── tracing/
   ```

6. **Create `domain/` for business engines**

   ```
   domain/
   ├── quotation/
   ├── invoice/
   ├── inventory/
   ├── accounting/
   ├── pricing/
   ├── tax/
   └── printing/
   ```

7. **Create `shared/` for generic, non-domain utilities**

   ```
   shared/
   ├── ui/
   ├── hooks/
   ├── lib/
   └── types/
   ```

8. **Create `app/` for the application shell**

   ```
   app/
   ├── router/
   └── providers/
   ```

### Migration Rules

- Move one feature at a time.
- The old paths and new paths coexist during migration.
- Update imports incrementally.
- Delete old paths only after all imports point to the new location.
- Never maintain two permanent directory structures.

### Success Metrics

Phase 4 is complete when:

- [ ] No imports from `features/quotation` to `features/inventory`
- [ ] No imports from `features/*` to `app/`
- [ ] No imports from `platform/*` to `features/*`
- [ ] No imports from `domain/*` to `features/*`
- [ ] No imports from `shared/*` to `features/*`
- [ ] Each feature has its own `routes.ts`, `permissions.ts`, `types.ts`, `index.ts`
- [ ] The Route Registry is distributed across feature modules

### Testing Strategy

- **Feature isolation:** Each feature module can be built in isolation.
- **Import boundaries:** ESLint boundary rules pass with zero violations.
- **Route generation:** Combined route registry produces valid React Router routes.

---

## Phase 5 — Business Engines

**Goal:** Extract only genuinely complex business logic. Leave CRUD alone.

### What to extract

| Domain | Reason | Service |
|--------|--------|---------|
| Ledger | 4-table fan-in, running balance, accounting rules | `LedgerService` |
| Payroll | 8-table assembly, salary slab resolution, OT calculation | `PayrollService` |
| Approvals | Workflow state machine, multi-step transitions | `ApprovalWorkflowService` |
| Pricing | Discount application, margin calculation, currency | `PricingService` (shared in Domain) |
| Tax | GST split, HSN summary, interstate determination | `TaxService` (shared in Domain) |
| Reporting | Multi-table aggregation, cross-domain joins | `ReportingService` |
| Dashboard | Aggregation across modules | `DashboardAggregator` |
| AI document parsing | External API calls, rate limits, caching | `DocumentParserService` |

### What to leave alone

- `useProjects()` — simple list query, already good.
- `useClients()` — simple list query, already removed.
- `useItems()` — simple list query, already good.
- `useEmployees()` — simple list query, already good.

### Steps

1. **Extract one engine at a time.**
2. **Define a stable interface (contract).** Do not version it preemptively. Keep a single implementation behind a stable interface.
3. **Migrate callers to the engine.**
4. **Delete the old hook's business logic.** Keep the hook as a thin React Query binding to the engine.

### Migration Rules

- The engine coexists with the old hook during migration.
- Callers migrate to the engine one at a time.
- Delete the old hook's business logic after all callers migrate.
- Keep the hook as a thin React Query binding to the engine.
- Never maintain two permanent engine implementations.

### Success Metrics

Phase 5 is complete when:

- [ ] Each extracted engine has one implementation
- [ ] No business logic in hooks for extracted domains
- [ ] Hooks for extracted domains are thin React Query bindings
- [ ] Each engine has unit tests for its business rules
- [ ] Engines are not preemptively versioned

### Testing Strategy

- **Business rules:** Unit tests for each engine's pure functions.
- **Integration:** Test hooks binding to engines with mocked Supabase.
- **Regression:** Existing behavior preserved across migration.

---

## Phase 6 — Workflow Orchestration

**Goal:** Decouple workflow steps so modules respond independently to business events.

### Why

The ERP is not CRUD. It is workflow:

```
Quotation Approved
  → Create Sales Order
  → Reserve Inventory
  → Notify Manager
  → Update Dashboard
  → Audit Log
```

Today these are probably chained together in a single mutation. Instead, each step should respond independently to the `QuotationApproved` event.

### Architecture

```
QuotationApproved (event)
  ↓
Event Bus
  ↓
Subscribers:
  ├── Sales module      → create sales order
  ├── Inventory module  → reserve stock
  ├── Notification      → notify manager
  ├── Analytics         → update dashboard
  ├── Audit             → write audit log
  └── Compensation      → trigger rollback if critical
```

### Transaction Guidance

Only publish a domain event **after** the originating database transaction commits successfully.

Classify subscribers as either:
- **Critical:** Must succeed or trigger a compensating action (e.g., inventory reservation, accounting entry).
- **Best-effort:** Can fail independently without blocking the workflow (e.g., audit logging, analytics, notifications).

This prevents partial state updates where an event is published but the origin transaction rolls back.

### Rule: Events for workflows only, not CRUD

Use domain events **only for business workflows that span multiple modules**.

Do not create events for:
- Client Created
- Client Updated
- Inventory Viewed

Do create events for:
- Quotation Approved
- Invoice Posted
- Payroll Closed
- Sales Order Created
- Purchase Order Approved

This prevents event explosion.

### Rule: Stay in-process

Keep the event bus in-process. Do not introduce Kafka, RabbitMQ, or any distributed messaging system.

For years, keep it simple:
- In-memory typed event bus
- No external message queue
- No distributed tracing
- No eventual consistency across services

Only introduce distributed messaging if you genuinely need cross-service communication — which this ERP does not.

### Steps

1. **Define domain event types**

   ```ts
   type DomainEvent =
     | { type: 'QuotationApproved'; quotationId: string; userId: string }
     | { type: 'InvoicePosted'; invoiceId: string; amount: number }
     | { type: 'PayrollClosed'; period: string; totalAmount: number }
     ...
   ```

2. **2. Build a lightweight event bus**

   - Pub/sub in memory.
   - Typed end-to-end.
   - Each subscriber handles its own errors.
   - No external dependencies.

3. **3. Identify workflows and convert to events**

   - Start with the quotation → sales order → inventory chain.
   - Then approval workflows.
   - Then payroll → accounting.

4. **4. Define critical vs best-effort subscribers**

   - Critical subscribers must succeed or trigger compensating actions.
   - Best-effort subscribers can fail independently (logging, analytics, notifications).

### Migration Rules

- Events coexist with direct calls during migration.
- Convert one workflow chain at a time.
- Delete direct calls after the event-driven path is proven.
- Never maintain two permanent orchestration systems.

### Success Metrics

Phase 6 is complete when:

- [ ] At least 3 workflow chains are event-driven
- [ ] Events are only published after the origin transaction commits
- [ ] Critical vs best-effort subscribers are explicitly classified
- [ ] No mutation directly calls another module's mutation
- [ ] The event bus is typed end-to-end
- [ ] The event bus is in-process (no external message queue)

### Testing Strategy

- **Event dispatch:** Integration test that events trigger all subscribers.
- **Transaction safety:** Test that events are not published if the origin transaction fails.
- **Error isolation:** Test that one best-effort subscriber failing does not block others.
- **Compensation:** Test that critical subscriber failures trigger compensating actions.

---

## Continuous Architecture Governance

### Architecture Ownership

Architecture governance requires explicit ownership. Without ownership, governance erodes over time.

**Rule:** Any change affecting `platform/`, `domain/`, `feature` boundaries, routing, engine contracts, or dependency rules requires an architecture review before merging.

### Migration Policy

1. **Never stop feature development.** Refactors coexist with feature work.
2. **Every refactor must coexist with the old implementation** during migration.
3. **Migrate incrementally** — one module, one route, one feature at a time.
4. **Delete the old implementation immediately** after migration.
5. **Never maintain two permanent systems.**

### Compatibility Policy

**Internal Modules:** Internal modules may change at any time. No guarantee of stability.

**Public APIs:** Public APIs (feature `index.ts` exports, Engine contracts, Platform interfaces) require deprecation before removal.

**Deprecation Flow:**
1. Mark old API as `@deprecated` with JSCdoc explaining the replacement.
2. Ship a minor version with the old API still working.
3. Ship a major version with the old API removed.

**Versioning Strategy:** Introduce explicit versioned implementations (e.g., `PricingEngineV2`) **only** when you need to support two active contracts simultaneously. Until then, keep a single implementation behind a stable interface. Do not version preemptively.

### Architectural Fitness Functions

Architecture is measurable. These checks run in CI:

| Check | Metric | Threshold |
|-------|--------|-----------|
| Max dependency depth | Import chain depth | < 5 |
| Max circular imports | Count | 0 |
| Max bundle size | kB per route | < 200 |
| Forbidden imports | Boundary violations | 0 |
| Max route count per registry file | Routes per file | < 50 |
| Max dependency count per module | Import count | < 15 |

Note: We intentionally do not enforce a maximum file line count. Some components legitimately exceed 300 lines because they orchestrate rich UI. Focus on cognitive complexity, dependency count, and responsibility count instead.

### ADRs

Every major architectural decision gets documented as an ADR in `docs/adr/`. Future engineers understand **why** a decision was made, not just **what** was decided.

---

## Guiding Principle

> Introduce abstractions only where they reduce complexity. The target architecture is a modular monolith. The goal is not to add layers, but to create clear ownership boundaries, eliminate duplication, and make the ERP easier to evolve over the next several years.
