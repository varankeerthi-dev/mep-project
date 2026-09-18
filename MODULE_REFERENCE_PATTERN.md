# ERP MODULE — PRODUCTION REFERENCE STANDARD

**Purpose:** Reusable production audit and implementation standard for every ERP module.

**Usage:**

> "Use `MODULE_REFERENCE_PATTERN.md` to audit this module."

This document is the **long-term engineering standard for ERP modules**.

It is intentionally independent of any particular module, implementation, page structure, database table, or technology-specific feature.

Individual modules may demonstrate or introduce better patterns over time. When a new pattern is proven and adopted as the ERP standard, **this document should be updated**.

Therefore:

> **The document is the standard. Individual modules are implementations of the standard.**

---

# 1. OBJECTIVE

Every ERP module should progressively meet the following production qualities:

```text
Security
Tenant Isolation
Data Integrity
Correctness
Performance
Cache Safety
Maintainability
Migration Integrity
Runtime Reliability
Mobile Reliability (where applicable)
```

The audit must determine whether the target module satisfies these requirements.

Do not assume that an existing module is correct simply because it has been in production for a long time.

Do not assume a newly created module is correct simply because it follows a newer coding style.

---

# 2. GOLDEN RULES

These rules apply to every module.

### Rule 1 — Database security is authoritative

Frontend filtering is never the primary tenant security boundary.

Before declaring a DB security finding:

Repository schema
       ↓
       NOT ENOUGH
       ↓
Live database
       ↓
Actual policies / functions / constraints
       ↓
Runtime probe where possible
       ↓
THEN classify finding

### Rule 2 — Understand before changing

Discover the module before proposing or implementing changes.

### Rule 3 — Preserve business behavior

Do not change established business rules without evidence.

### Rule 4 — Verify, don't assume

Previous audits, comments, documentation, and implementation reports are not proof.

### Rule 5 — Measure before optimizing

Do not introduce performance changes without identifying the actual problem.

### Rule 6 — Tenant isolation includes cache

Database isolation alone is insufficient if the frontend can display another tenant's cached data.

### Rule 7 — Critical business operations require integrity

Multi-step financial, inventory, approval, and state-transition operations must be appropriately protected against partial execution.

### Rule 8 — Build success is not production verification

Compilation does not prove runtime correctness or security.

### Rule 9 — Do not manufacture abstractions

Use shared patterns where they genuinely improve consistency and safety.

### Rule 10 — The standard evolves

If a better production pattern is proven and adopted, update this document rather than creating a conflicting local standard.

---

# 3. MODULE DISCOVERY

Before auditing or changing a module, identify:

```text
Module
├── Routes
├── Pages / Shell
├── Components
├── Hooks
├── API / Supabase queries
├── RPCs / server functions
├── Validation
├── Database tables
├── Related tables
├── Storage
├── Realtime
├── Background jobs
├── External integrations
├── Reports / exports
└── Mobile implementation
```

Search the entire repository for the module's:

- table names;
- route names;
- component names;
- hooks;
- RPCs;
- API functions;
- business terminology.

Do not audit only the main page.

---

# 4. DATABASE TENANCY STANDARD

For every table used by the module, determine its ownership model.

Every table must clearly be one of:

```text
GLOBAL / SHARED
TENANT-OWNED
CHILD OF TENANT-OWNED RECORD
SYSTEM / INTERNAL
```

Do not assume every table requires `organisation_id`.

However, every tenant-owned data path must have a reliable database-enforced tenant boundary.

---

# 5. ORGANISATION OWNERSHIP

For tenant-owned tables, evaluate:

```text
organisation_id
        ↓
organisations.id
```

Check:

- FK;
- nullability;
- delete behavior;
- indexes;
- data integrity;
- existing NULL records.

Where appropriate, organisation ownership should be structurally enforced.

Do not blindly change nullable columns to NOT NULL without checking existing production data.

---

# 6. RLS STANDARD

For tenant-owned data:

**Row Level Security must be enabled.**

Audit:

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|

Each operation must have appropriate protection.

Verify both:

```text
USING
WITH CHECK
```

Do not consider a table secure simply because SELECT is protected.

---

# 7. TENANT AUTHORIZATION STANDARD

Use the ERP's established organisation authorization mechanism.

For example, if the ERP's approved mechanism is:

```text
user_can_access_org(...)
```

then modules should use the established mechanism rather than inventing another one.

The audit must verify:

```text
Authenticated user
        ↓
Active organisation membership
        ↓
Authorised organisation
        ↓
Requested record
```

---

# 8. RLS TAUTOLOGY AUDIT

Explicitly inspect policy SQL for:

- column shadowing;
- variable shadowing;
- unqualified columns;
- incorrect aliases;
- broken subquery correlation;
- tautological expressions.

Dangerous example:

```sql
organisation_id = organisation_id
```

This can unintentionally mean:

```text
row organisation = same row organisation
```

instead of:

```text
row organisation = user's authorised organisation
```

Use explicit table qualification wherever ambiguity is possible.

---

# 9. CHILD RECORD SECURITY

For child tables:

```text
Parent
  ↓
Child
```

verify that a user cannot create, read, update, or delete a child record across tenant boundaries.

Where the child contains `organisation_id`:

```text
child.organisation_id
=
parent.organisation_id
```

must be appropriately enforced.

Where it does not:

```text
child
 ↓
parent
 ↓
organisation
```

must provide the security boundary.

---

# 10. GLOBAL / REFERENCE DATA

Determine whether lookup data is:

### Global

Available to all organisations.

Examples may use:

```text
organisation_id IS NULL
```

### Tenant-specific

Belongs to one organisation.

The audit must verify that:

- global defaults are not accidentally editable by ordinary tenants;
- tenant custom records are isolated;
- tenant A cannot modify tenant B configuration.

Do not force a single model onto every lookup table.

---

# 11. FRONTEND TENANT AWARENESS

Even though the database is authoritative, frontend queries should still be tenant-aware.

Audit:

- organisation filters;
- organisation context;
- user/profile queries;
- related entity queries;
- mutation payloads.

The objective is:

```text
Frontend asks only for relevant tenant data
+
Database prevents anything unauthorized
```

Both layers should be correct.

---

# 12. REACT QUERY / CACHE STANDARD

For tenant-sensitive queries, cache identity must reflect tenant context.

Conceptually:

```ts
["module-data", organisationId]
```

rather than:

```ts
["module-data"]
```

when organisation changes the dataset.

Audit:

- query keys;
- staleTime;
- gcTime;
- enabled conditions;
- mutation invalidation;
- cache updates;
- duplicate hooks.

---

# 13. ORGANISATION SWITCHING TEST

This is mandatory for multi-tenant modules.

Test:

```text
Tenant A
   ↓
Open module
   ↓
Load data
   ↓
Switch to Tenant B
   ↓
Reload/render
```

Verify:

- Tenant A data disappears;
- Tenant B data appears;
- cached Tenant A data is not displayed;
- dropdowns do not retain Tenant A entities;
- mutations use Tenant B;
- related records do not leak across organisations.

---

# 14. CANONICAL DATA HOOKS

Shared datasets should have a canonical data-fetching implementation where practical.

Avoid multiple hooks that independently own:

```text
clients
projects
employees
vendors
users
```

with different:

- query keys;
- projections;
- polling;
- cache behavior.

Audit for duplicate implementations and cache collisions.

Do not create a shared hook solely for stylistic consistency.

---

# 15. QUERY PROJECTION STANDARD

Avoid fetching unnecessary columns.

Prefer:

```text
id
name
status
```

when that is all the UI requires.

Avoid unnecessary:

```text
SELECT *
```

and nested:

```text
related_table(*)
```

when selective projection is possible.

Benefits:

- lower payload;
- lower network cost;
- lower memory usage;
- faster parsing;
- reduced accidental data exposure.

---

# 16. QUERY JOIN STANDARD

Audit:

- unnecessary joins;
- oversized nested joins;
- duplicate joins;
- N+1 requests;
- repeated related-data fetching.

Optimize only when the join is actually unnecessary or measurably expensive.

---

# 17. POLLING STANDARD

Polling must have a reason.

Search for:

```text
refetchInterval
setInterval
setTimeout
polling
```

Do not retain unconditional short-interval full-list polling without a demonstrated business requirement.

Prefer:

```text
React Query cache
+
targeted invalidation
+
explicit refresh
```

Polling may be appropriate when genuinely required.

If used:

- make it conditional;
- avoid unnecessary hidden-tab activity;
- avoid large payloads;
- avoid duplicate polling.

---

# 18. MUTATION STANDARD

Audit every mutation:

```text
Create
Update
Delete
Bulk operations
Approval
Rejection
Status transition
Submission
Cancellation
Closure
Restore
```

Verify:

- validation;
- authorization;
- tenant protection;
- duplicate submission handling;
- error handling;
- cache invalidation;
- business integrity.

---

# 19. ATOMICITY STANDARD

Identify operations involving multiple related mutations.

Example:

```text
Transaction
 ↓
Stock update
 ↓
Ledger entry
 ↓
Balance update
```

Determine whether partial execution could corrupt business state.

If atomicity is required, use an appropriate server/database transaction or RPC.

Do not automatically convert every mutation into an RPC.

---

# 20. RPC / SERVER FUNCTION STANDARD

For every important RPC/server function inspect:

```text
Authorization
Tenant validation
Record ownership
Parameter validation
SECURITY DEFINER
search_path
Schema qualification
Atomicity
```

A function should not rely on the frontend to provide security.

---

# 21. VALIDATION STANDARD

Audit:

```text
Required fields
Types
Ranges
Enums
Dates
Numbers
IDs
Business constraints
```

Frontend validation is useful for UX.

Critical business constraints must also exist at the appropriate backend/database layer.

---

# 22. FOREIGN KEY STANDARD

Where a genuine relationship exists, determine whether database enforcement is appropriate.

Examples:

```text
Record → organisation
Record → client
Record → project
Record → vendor
Record → employee
```

Check:

- FK;
- target;
- nullability;
- delete behavior;
- orphan risk.

Do not create FKs merely because two column names look related.

---

# 23. INDEX STANDARD

Evaluate indexes based on real access patterns.

Inspect fields frequently used in:

```text
WHERE
JOIN
ORDER BY
organisation_id
foreign keys
status
created_at
```

Do not add indexes indiscriminately.

---

# 24. FRONTEND ARCHITECTURE STANDARD

A module should have clear responsibility boundaries.

A typical healthy structure is:

```text
Page / Shell
      ↓
Feature Components
      ↓
Hooks / Data Layer
      ↓
API / RPC
      ↓
Database
```

A large component is not automatically bad.

Flag a component when it combines too many unrelated responsibilities, such as:

```text
UI
+
data fetching
+
business logic
+
forms
+
database mutations
+
exports
+
multiple workflows
```

Refactor by responsibility, not by arbitrary line count.

---

# 25. BUSINESS LOGIC STANDARD

Map critical workflows:

```text
Initial state
 ↓
User action
 ↓
Validation
 ↓
Mutation
 ↓
Side effects
 ↓
Final state
```

Check for:

- invalid transitions;
- missing validation;
- race conditions;
- duplicate submissions;
- partial failures;
- inconsistent state.

Do not change business semantics without evidence.

---

# 26. ERROR HANDLING STANDARD

Audit:

- loading;
- empty;
- error;
- retry;
- authorization failure;
- validation failure;
- network failure;
- mutation failure;
- partial failure.

Look for silently swallowed errors such as:

```ts
catch {}
```

---

# 27. PERFORMANCE STANDARD

Audit three layers.

## Frontend

```text
Bundle
Imports
Lazy loading
Rendering
Component size
Duplicate requests
```

## Network

```text
Request count
Payload size
Latency
Polling
Duplicate requests
```

## Database

```text
Queries
Joins
Indexes
Projection
RLS cost
Unbounded queries
N+1 patterns
```

Prioritize measurable problems.

---

# 28. MIGRATION STANDARD

Compare:

```text
Production database
        ↕
Repository migrations
        ↕
Ad-hoc SQL
```

Look for:

- empty migrations;
- placeholder migrations;
- duplicate migrations;
- production changes absent from migrations;
- ad-hoc changes not represented in repository history;
- migration ordering problems.

Do not blindly delete old SQL.

The objective is:

> **Repository migration history should accurately represent production database evolution.**

---

# 29. STALE FILE STANDARD

Identify:

```text
*.backup
*.backup2
*.old
*.tmp
copy files
debug files
```

Flag them.

Do not automatically delete them.

---

# 30. EXPORT / REPORT STANDARD

If the module generates:

- PDF;
- Excel;
- CSV;
- print;
- calendar;
- reports;

verify:

- tenant isolation;
- correct calculations;
- correct source data;
- formatting;
- stale-data risks;
- mobile compatibility where applicable.

---

# 31. MOBILE STANDARD

If the module exists in the mobile application, verify:

```text
Build
Capacitor
Routes
Responsive UI
Touch interactions
Modals
Camera/scanner
Signature
Offline assumptions
```

Desktop build success does not prove mobile functionality.

---

# 32. RUNTIME STANDARD

Where runtime access is available, test the actual application.

Minimum:

```text
Open
 ↓
List
 ↓
Search
 ↓
Filter
 ↓
Create
 ↓
Edit
 ↓
Detail
 ↓
Primary workflow
 ↓
Secondary workflow
 ↓
Delete / Cancel
 ↓
Export
 ↓
Organisation switch
```

Observe:

```text
Console
Network
Database errors
RLS errors
React errors
Duplicate requests
Stale data
```

Only mark a test PASS if it was actually executed.

---

# 33. MULTI-TENANT SECURITY TEST

Where test tenants are available:

```text
Tenant A
Tenant B
```

Verify:

| Operation | A → A | A → B |
|---|---|---|
| SELECT | PASS | BLOCKED |
| INSERT | PASS | BLOCKED |
| UPDATE | PASS | BLOCKED |
| DELETE | PASS | BLOCKED |

For child records:

```text
A child → A parent = allowed
A child → B parent = blocked
```

Do not claim success based solely on policy inspection.

---

# 34. BUILD VERIFICATION

Run applicable:

```text
TypeScript
Lint
Production web build
Tests
Mobile build
Capacitor sync
```

Report the actual result.

Never reuse an old build result as current verification.

---

# 35. SEVERITY STANDARD

Use:

### P0 — Critical

Examples:

- cross-tenant exposure;
- authorization bypass;
- severe data corruption;
- unsafe destructive operation.

### P1 — High

Examples:

- serious integrity problem;
- critical workflow failure;
- significant security weakness;
- major production performance issue.

### P2 — Medium

Examples:

- moderate performance issue;
- maintainability problem;
- missing non-critical validation;
- architectural weakness.

### P3 — Low

Examples:

- cleanup;
- minor duplication;
- documentation;
- non-critical technical debt.

---

# 36. AUDIT-ONLY MODE

When instructed:

> "Use MODULE_REFERENCE_PATTERN.md to audit [MODULE]."

The LLM must:

- inspect;
- analyze;
- test where possible;
- report.

It must **NOT modify the module**.

It must **NOT fix findings**.

It must **NOT refactor**.

It must **NOT start auditing another module**.

---

# 37. IMPLEMENTATION MODE

When instructed:

> "Audit and fix [MODULE] using MODULE_REFERENCE_PATTERN.md."

Use:

```text
DISCOVER
   ↓
AUDIT
   ↓
CLASSIFY FINDINGS
   ↓
IMPLEMENT FIXES
   ↓
BUILD
   ↓
SECURITY TEST
   ↓
RUNTIME TEST
   ↓
RE-AUDIT
   ↓
FINAL REPORT
```

After fixes, verify the original findings again.

Do not consider an implementation complete until the relevant verification has been repeated.

---

# 38. FINAL AUDIT REPORT

Produce:

# [MODULE] — Production Audit Report

## Executive Status

One of:

```text
PASS
PASS WITH WARNINGS
FAIL
```

---

## Module Inventory

| Area | Findings |
|---|---|
| Pages | |
| Components | |
| Hooks | |
| Database tables | |
| RPCs | |
| Integrations | |
| Exports | |
| Mobile | |

---

## P0 Findings

---

## P1 Findings

---

## P2 Findings

---

## P3 Findings

---

## Database & Security

Include:

- tenancy;
- RLS;
- policy matrix;
- FKs;
- child-table security;
- authorization;
- RPC security.

---

## Query & Cache

Include:

- query keys;
- projections;
- joins;
- polling;
- duplicate hooks;
- invalidation;
- organisation switching.

---

## Frontend Architecture

Include:

- major components;
- oversized components;
- duplicated logic;
- data-fetching boundaries;
- maintainability findings.

---

## Business Integrity

List critical workflows and findings.

---

## Migration Integrity

Compare:

```text
Production
Repository migrations
Ad-hoc SQL
```

---

## Runtime Verification

| Test | Result |
|---|---|
| Load | PASS/FAIL/NOT VERIFIED |
| Search | PASS/FAIL/NOT VERIFIED |
| Filter | PASS/FAIL/NOT VERIFIED |
| Create | PASS/FAIL/NOT VERIFIED |
| Edit | PASS/FAIL/NOT VERIFIED |
| Primary workflow | PASS/FAIL/NOT VERIFIED |
| Delete | PASS/FAIL/NOT VERIFIED |
| Export | PASS/FAIL/NOT VERIFIED |
| Organisation switch | PASS/FAIL/NOT VERIFIED |

---

## Build Verification

```text
TypeScript: PASS/FAIL/NOT RUN
Lint: PASS/FAIL/NOT RUN
Web build: PASS/FAIL/NOT RUN
Tests: PASS/FAIL/NOT RUN
Mobile build: PASS/FAIL/N/A
Capacitor sync: PASS/FAIL/N/A
```

---

## Remaining Issues

Separate:

```text
Blocking
Non-blocking
```

---

## Final Status

### PASS

No blocking production issues found.

### PASS WITH WARNINGS

No blocking issues found, but non-blocking findings remain.

### FAIL

One or more P0/P1 issues remain.

---

# 39. STANDARD EVOLUTION

This document is a **living ERP engineering standard**.

When a future module introduces a demonstrably better production pattern:

1. Validate the pattern.
2. Confirm that it improves security, correctness, performance, maintainability, or reliability.
3. Adopt it as an ERP-wide standard if appropriate.
4. Update this document.
5. Future module audits then use the updated standard.

Do not permanently anchor this standard to:

- SiteVisit;
- any individual module;
- any developer;
- any particular date;
- any particular component naming scheme.

The purpose is to preserve the **engineering principles**, while allowing the implementation standard to improve over time.

---

# 40. THE ERP PRODUCTION STANDARD

Ultimately, every module should converge toward:

```text
                ERP MODULE
                     │
                     ▼
              Secure Database
                     │
                     ▼
             DB-Enforced Tenancy
                     │
                     ▼
              Correct RLS
                     │
                     ▼
          Tenant-Aware Data Layer
                     │
                     ▼
          Tenant-Safe Cache Keys
                     │
                     ▼
          Efficient Data Queries
                     │
                     ▼
        No Unnecessary Background Work
                     │
                     ▼
        Modular Frontend Architecture
                     │
                     ▼
       Protected Business Operations
                     │
                     ▼
            Migration Integrity
                     │
                     ▼
          Runtime Verification
                     │
                     ▼
            Production Ready
```

This is the **reference standard**.


Never create a missing database object solely because repository code references it. First determine whether the object was renamed, replaced, intentionally removed, dead code, or genuinely missing

Individual modules may implement these principles differently.

The standard should evolve when better proven patterns emerge.