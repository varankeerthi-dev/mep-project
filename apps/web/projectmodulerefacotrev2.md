# PRD — Project Module Refactor V2 (Non-Breaking)

## Document Version

Version: 2.0

Status: Approved for Implementation

Type: Internal Refactoring

Priority: High

---

# 1. Objective

Refactor the entire Project Module into a maintainable, scalable, feature-based architecture **without changing any user-facing behavior**.

This is **NOT** a redesign.

This is **NOT** a feature release.

The purpose is only to improve maintainability while preserving:

* UI
* UX
* Business rules
* Database schema
* API contracts
* Existing permissions
* Existing routes
* Existing URLs
* Existing Supabase queries
* Existing calculations
* Existing workflows
* Existing keyboard shortcuts
* Existing animations
* Existing validations

The final result must behave **identically** to the current implementation.

---

# 2. Goals

## Primary Goals

Reduce large files into maintainable modules.

Extract reusable business logic.

Extract reusable data hooks.

Improve code readability.

Improve testability.

Improve performance where possible without changing behavior.

Reduce merge conflicts.

Enable future feature development.

---

## Non Goals

Do NOT redesign UI.

Do NOT modernize styling.

Do NOT migrate styling.

Do NOT rename database tables.

Do NOT change API.

Do NOT optimize SQL logic unless absolutely required.

Do NOT introduce new libraries.

Do NOT change permissions.

Do NOT change navigation.

Do NOT change business rules.

Do NOT remove existing functionality.

Do NOT rewrite working code just because it can be rewritten.

---

# 3. Success Criteria

The user should not notice any difference.

Every button behaves exactly the same.

Every modal behaves exactly the same.

Every query returns exactly the same data.

Every export works.

Every print works.

Every dialog works.

Every permission works.

Every calculation returns identical values.

Every existing feature remains available.

No feature regression.

---

# 4. Core Refactoring Principles

## Rule 1

No UI changes.

Pixel identical.

---

## Rule 2

No business logic changes.

Move code only.

Never rewrite working algorithms.

---

## Rule 3

No feature loss.

Every feature must continue working.

Nothing may be silently omitted.

---

## Rule 4

No breaking database schema changes. Additive, backward-compatible performance improvements (such as indexes and non-breaking SQL optimizations) are permitted. Existing tables, columns, relationships, RLS policies, and application behavior must remain unchanged.

---

## Rule 5

No route changes.

Deep links must continue working.

---

## Rule 6

Every phase must compile.

Never leave the project in a broken state.

---

## Rule 7

Prefer extraction over rewriting.

---

# 5. Target Architecture

```
projects/

    pages/

        ProjectListV2.tsx

        CreateProjectV2.tsx

        ProjectsV2.tsx

    features/

        project-list/

        project-detail/

        project-form/

        transactions/

        milestones/

        equipment/

        snag/

        warranty/

        insights/

        meetings/

        materials/

        scope/

        closure/

    hooks/

    services/

    calculators/

    utils/

    constants/

    types/

    components/

    providers/
```

Every feature owns:

* components
* hooks
* types
* utilities
* services

No feature should directly depend on another feature's internal implementation.

---

# 6. Reusable Hooks

The goal is to eliminate hundreds of lines of duplicated state and effects.

## Core Hooks

```
useProjects()

useProject()

useProjectDetails()

useProjectFilters()

useProjectSearch()

useProjectPagination()

useProjectColumns()

useProjectSelection()

useProjectNavigation()
```

---

## Form Hooks

```
useProjectForm()

useProjectDraft()

useProjectValidation()

useProjectTemplates()

useProjectScope()
```

---

## Transaction Hooks

```
useProjectTransactions()

useInvoices()

usePurchaseOrders()

usePayments()

useExpenses()

useTransactionSummary()
```

---

## Milestone Hooks

```
useMilestones()

useMilestoneForm()

useMilestoneTimeline()
```

---

## Equipment Hooks

```
useProjectEquipment()

useWarranty()

useEquipmentForm()
```

---

## Snag Hooks

```
useProjectSnags()

useSnagForm()

useDrawings()
```

---

## Warranty Hooks

```
useWarrantyClaims()

useWarrantyNotifications()

useClaimForm()
```

---

## Insight Hooks

```
useProjectInsights()

useInsightFilters()

useInsightEditor()
```

---

## UI Hooks

```
useDialog()

usePopover()

useContextMenu()

useTabs()

useSidebar()

useExpandableRows()

usePersistedState()
```

---

## Common Hooks

```
useDebouncedSearch()

useLocalStorage()

usePermissions()

useOrganisation()

useAuditLogger()
```

---

# 7. Services

Business logic must move into services.

Services must never render UI.

Examples:

```
ProjectService

MilestoneService

EquipmentService

WarrantyService

InsightService

ProjectTransactionService

ProjectExportService

ProjectImportService
```

---

# 8. Pure Calculators

Pure functions only.

No React.

No Supabase.

Examples

```
projectBudgetCalculator.ts

projectCompletionCalculator.ts

transactionCalculator.ts

poUtilizationCalculator.ts

invoiceSummaryCalculator.ts

milestoneCalculator.ts

claimCalculator.ts

insightStatisticsCalculator.ts
```

These must be reusable by:

Web

Mobile

Reports

Future APIs

---

# 9. Shared Components

Examples

```
ProjectHeader

ProjectToolbar

ProjectStats

ProjectSearch

ProjectFilters

ProjectTable

ProjectTableRow

ProjectStatusBadge

ProjectSummaryCard

ProjectEmptyState

ProjectLoading

SectionHeader

DetailPanel

TransactionTabs

TabNavigation
```

Components must receive props only.

No database access.

---

# 10. Phased Migration Plan

## Phase 0 — Safety Baseline

Objective

Freeze current implementation.

Tasks

Create:

```
ProjectListV2

ProjectsV2

CreateProjectV2
```

Do not replace existing screens.

Everything runs in parallel.

Acceptance

Current screens remain untouched.

---

## Phase 1 — Types & Constants

Extract

Types

Enums

Status config

Labels

Column definitions

Icons

Colors

Shared constants

Acceptance

Zero behavior change.

---

## Phase 2 — Shared Utilities

Extract

Formatting

Sorting

Filtering

Searching

Pagination

Column persistence

Date helpers

Currency helpers

Acceptance

Output identical.

---

## Phase 3 — Shared Hooks

Extract reusable hooks.

No JSX.

No styling.

No business rule changes.

Acceptance

Pages become thinner.

---

## Phase 4 — Data Layer

Move all Supabase queries.

Create feature-specific query hooks.

React Query logic belongs here.

Examples

```
useProjects()

useProjectDetails()

useProjectTransactions()

useEquipment()

useMilestones()

useWarrantyClaims()
```

Acceptance

Pages contain almost no query logic.

---



Phase 4.5 — Data Access & Performance Optimization

Objective

Improve scalability and database efficiency without changing business logic or user-facing behavior.

Guiding Principles
No UI changes.
No business logic changes.
No schema changes except additive indexes.
No API contract changes.
Query results must remain identical.
1. Consolidate Project Detail Loading

Current issue:

Opening one project executes many independent React Query hooks simultaneously (POs, invoices, expenses, payments, milestones, equipment, snags, warranty, insights, etc.), creating a "query flood."
Refactor

Introduce a data orchestrator.

useProjectDetails()

    ├── useProjectSummary()
    ├── useTransactions()
    ├── useMilestones()
    ├── useEquipment()
    ├── useSnags()
    ├── useWarranty()
    ├── useInsights()

The orchestrator should:

lazy load tabs
fetch only active tab data where appropriate
share cached data
avoid duplicate requests
deduplicate concurrent requests
2. Lazy Tab Loading

Current

Opening a project loads data for tabs the user may never visit.

Target

Summary loads first.

Other tabs fetch only when opened.

Example

Summary

↓

Transactions (on first click)

↓

Equipment

↓

Warranty

↓

Insights

↓

Meetings
3. Query Deduplication

Avoid multiple hooks requesting the same data.

Instead of

EquipmentTab

↓

query equipment

WarrantyTab

↓

query equipment again

Use

useProjectDetails()

↓

shared cache

↓

EquipmentTab

↓

WarrantyTab
4. Shared React Query Keys

Standardize keys.

Example

projects

project

project-summary

project-transactions

project-equipment

project-snags

project-insights

project-meetings

No duplicate cache entries.

5. Server-side Pagination

Replace

.limit(500)

with

.range(start, end)

using page metadata.

Never load hundreds of rows just to display one page. This directly addresses the report's recommendation.

6. Search Optimization

Current

Client-side filtering after fetching many records.

Target

Server-side filtering whenever practical.

Only perform client filtering for:

cached data
small datasets
offline state
7. Tab-level Queries

Each tab owns its own query.

Summary

↓

query summary

Transactions

↓

query transactions

Warranty

↓

query warranty

No unused queries.

8. React Query Optimization

Standardize

staleTime
gcTime
enabled
placeholderData
select
keepPreviousData
retry policies

Remove inconsistent configurations.

9. Prevent Query Waterfalls

Where data truly is independent:

Promise.all()

Where dependencies exist:

summary

↓

transactions

↓

derived calculations

Avoid unnecessary sequential loading.

10. Database Index Review

Add a migration containing:

CREATE INDEX IF NOT EXISTS idx_projects_organisation_id
ON projects(organisation_id);

CREATE INDEX IF NOT EXISTS idx_projects_organisation_created
ON projects(organisation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_projects_organisation_status
ON projects(organisation_id, status);

Also review indexes for other heavily queried tables (e.g., project_milestones, project_equipment, project_snags, project_invoices, project_payments) based on actual query patterns before adding them.

11. Query Instrumentation

During development log:

query count
duplicate queries
average query time
slow queries (>500 ms)
cache hit ratio

Remove instrumentation before production.

12. Performance Acceptance Criteria

The refactor is complete only if:

No feature changes.
No business logic changes.
Opening a project no longer triggers unnecessary queries.
Inactive tabs perform zero network requests.
Duplicate requests are eliminated.
Server-side pagination replaces .limit(500) for project lists.
Existing React Query caching behavior is preserved or improved.
Database indexes are reviewed and applied where justified.
Performance is equal to or better than the current implementation.

---------

## Phase 5 — Business Logic

Move calculations into calculators/services.

Examples

Budget

Completion

PO utilization

Invoice summary

Insight statistics

Warranty calculations

Acceptance

No business logic inside components.

---

## Phase 6 — UI Extraction

Extract visual sections only.

Examples

Project table

Filters

Header

Toolbar

Stats

Summary

Equipment

Milestones

Transactions

Insights

Warranty

Scope

Closure

Site expenses

Related records

Meetings

Acceptance

Main page becomes a composition file.

---

## Phase 7 — Modal Extraction

Move every modal.

Examples

Create Invoice

Equipment

Snag

Claim

Milestone

Insight

Delete

Confirmation

Drawing

Acceptance

Each modal owns its own state.

---

## Phase 8 — Create Project Refactor

Split CreateProject into:

Identity

Commercial

Timeline

Scope

Assignments

Status

Attachments

PO

Draft

Validation

Acceptance

Form behaves identically.

---

## Phase 9 — Projects Container

Refactor routing.

Extract

Tab management

Material tabs

Project selection

Meeting tabs

Navigation

Acceptance

Projects.tsx becomes a lightweight router/composer.

---

## Phase 10 — Cleanup

Remove dead code.

Remove duplicate helpers.

Remove duplicate queries.

Consolidate imports.

Standardize folder names.

No behavior changes.

---

# 11. Feature Preservation Checklist

The following functionality **must remain fully operational** after refactoring:

* Project list
* Search
* Status filters
* Pagination
* Column customization
* Project detail
* Summary tab
* Transactions
* Purchase Orders
* Invoices
* Payments
* Expenses
* Reconciliation
* Equipment
* Warranty
* Snag tracking
* Drawings
* Warranty claims
* Milestones
* Continuous Improvement / Insights
* Scope editor
* Closure checklist
* Site expenses
* Meetings
* Tasks
* Material Management
* Material Intents
* Receive Material
* Material Dashboard
* Material List
* Usage Tracking
* Consumption Report
* Project creation
* Project editing
* Draft saving
* Client creation
* PO linking
* Export
* Print
* Permissions
* Audit logging
* React Query caching
* URL deep linking
* Lazy loading
* Existing keyboard interactions
* Existing animations
* Existing validation

No feature may be removed, disabled, simplified, or deferred.

---

# 12. Testing Requirements

Each phase must verify:

* TypeScript compiles
* ESLint passes
* Build succeeds
* No console errors
* No runtime errors
* React Query cache unchanged
* Navigation unchanged
* Permissions unchanged
* Forms unchanged
* Modals unchanged
* API requests unchanged
* Database writes unchanged

Regression testing is mandatory after every phase.

---

# 13. Definition of Done

The refactor is complete only when:

* Every existing feature is preserved.
* UI is visually identical.
* Business logic is unchanged.
* Main pages are reduced to composition/orchestration components.
* Business logic exists only in services/calculators/hooks.
* Components are small, focused, and reusable.
* Feature folders are isolated with minimal coupling.
* Hooks are reusable across Web and future Mobile implementations.
* No duplicated logic remains.
* No regression bugs are introduced.
* The original implementation can be safely retired only after V2 reaches feature parity and passes full regression testing.
