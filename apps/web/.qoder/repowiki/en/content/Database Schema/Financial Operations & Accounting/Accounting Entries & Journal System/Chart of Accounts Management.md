# Chart of Accounts Management

<cite>
**Referenced Files in This Document**
- [ACCOUNTING_COA_DESIGN.md](file://ACCOUNTING_COA_DESIGN.md)
- [src/pages/accounting/index.tsx](file://src/pages/accounting/index.tsx)
- [src/ledger/LedgerDashboard.tsx](file://src/ledger/LedgerDashboard.tsx)
- [src/ledger/api.ts](file://src/ledger/api.ts)
- [src/ledger/hooks.ts](file://src/ledger/hooks.ts)
- [src/ledger/schemas.ts](file://src/ledger/schemas.ts)
- [src/ledger/utils.ts](file://src/ledger/utils.ts)
- [src/database-add-audit-log.sql](file://src/database-add-audit-log.sql)
- [supabase/migrations/20240101000000_create_accounts_table.sql](file://supabase/migrations/20240101000000_create_accounts_table.sql)
- [supabase/migrations/20240101000001_add_account_hierarchy.sql](file://supabase/migrations/20240101000001_add_account_hierarchy.sql)
- [supabase/migrations/20240101000002_add_account_types.sql](file://supabase/migrations/20240101000002_add_account_types.sql)
- [supabase/migrations/20240101000003_add_account_validation.sql](file://supabase/migrations/20240101000003_add_account_validation.sql)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)

## Introduction
This document explains the Chart of Accounts (CoA) system, including hierarchy structure, account types, categorization rules, creation/modification/deletion workflows, numbering conventions, balance calculations, validation rules, audit trails, and compliance considerations. It also provides examples of common CoA structures for different business types and maps these concepts to the actual implementation files in the repository.

## Project Structure
The Chart of Accounts is implemented across UI pages, hooks, API clients, schema definitions, utilities, database migrations, and design documentation:

- Design and planning: ACCOUNTING_COA_DESIGN.md
- UI entry points: src/pages/accounting/index.tsx
- Ledger integration: src/ledger/* (dashboard, API, hooks, schemas, utils)
- Database schema and constraints: supabase/migrations/*
- Audit logging: src/database-add-audit-log.sql

```mermaid
graph TB
subgraph "UI Layer"
A["Accounting Page<br/>src/pages/accounting/index.tsx"]
B["Ledger Dashboard<br/>src/ledger/LedgerDashboard.tsx"]
end
subgraph "Business Logic"
C["Hooks<br/>src/ledger/hooks.ts"]
D["Schemas & Validation<br/>src/ledger/schemas.ts"]
E["Utilities<br/>src/ledger/utils.ts"]
end
subgraph "Data Access"
F["API Client<br/>src/ledger/api.ts"]
G["Supabase Migrations<br/>supabase/migrations/*.sql"]
end
subgraph "Documentation"
H["Design Doc<br/>ACCOUNTING_COA_DESIGN.md"]
end
A --> C
B --> C
C --> F
F --> G
D --> C
E --> C
A -.-> H
B -.-> H
```

**Diagram sources**
- [src/pages/accounting/index.tsx](file://src/pages/accounting/index.tsx)
- [src/ledger/LedgerDashboard.tsx](file://src/ledger/LedgerDashboard.tsx)
- [src/ledger/hooks.ts](file://src/ledger/hooks.ts)
- [src/ledger/schemas.ts](file://src/ledger/schemas.ts)
- [src/ledger/utils.ts](file://src/ledger/utils.ts)
- [src/ledger/api.ts](file://src/ledger/api.ts)
- [supabase/migrations/20240101000000_create_accounts_table.sql](file://supabase/migrations/20240101000000_create_accounts_table.sql)
- [ACCOUNTING_COA_DESIGN.md](file://ACCOUNTING_COA_DESIGN.md)

**Section sources**
- [ACCOUNTING_COA_DESIGN.md](file://ACCOUNTING_COA_DESIGN.md)
- [src/pages/accounting/index.tsx](file://src/pages/accounting/index.tsx)
- [src/ledger/LedgerDashboard.tsx](file://src/ledger/LedgerDashboard.tsx)
- [src/ledger/hooks.ts](file://src/ledger/hooks.ts)
- [src/ledger/schemas.ts](file://src/ledger/schemas.ts)
- [src/ledger/utils.ts](file://src/ledger/utils.ts)
- [src/ledger/api.ts](file://src/ledger/api.ts)
- [supabase/migrations/20240101000000_create_accounts_table.sql](file://supabase/migrations/20240101000000_create_accounts_table.sql)

## Core Components
- Account model and hierarchy: parent-child relationships, account codes, and type classification are defined by migrations and enforced via schema validations.
- UI flows: The accounting page and ledger dashboard provide interfaces for browsing, creating, editing, and deleting accounts.
- Hooks and API: Data fetching, mutations, and caching are handled through hooks and an API client that calls Supabase-backed endpoints.
- Utilities: Helpers for formatting, validation, and balance computations.

Key responsibilities:
- Define account types and allowed transitions.
- Enforce numbering and hierarchy constraints.
- Provide CRUD operations with validation and audit logging.
- Compute balances from transactions and postings.

**Section sources**
- [src/ledger/schemas.ts](file://src/ledger/schemas.ts)
- [src/ledger/hooks.ts](file://src/ledger/hooks.ts)
- [src/ledger/api.ts](file://src/ledger/api.ts)
- [src/ledger/utils.ts](file://src/ledger/utils.ts)
- [supabase/migrations/20240101000000_create_accounts_table.sql](file://supabase/migrations/20240101000000_create_accounts_table.sql)
- [supabase/migrations/20240101000001_add_account_hierarchy.sql](file://supabase/migrations/20240101000001_add_account_hierarchy.sql)
- [supabase/migrations/20240101000002_add_account_types.sql](file://supabase/migrations/20240101000002_add_account_types.sql)
- [supabase/migrations/20240101000003_add_account_validation.sql](file://supabase/migrations/20240101000003_add_account_validation.sql)

## Architecture Overview
The CoA architecture follows a layered approach:
- Presentation layer: Accounting page and ledger dashboard render lists, forms, and actions.
- Business logic layer: Hooks orchestrate data flow, perform local validations, and call API functions.
- Data access layer: API client interacts with Supabase tables created by migrations.
- Persistence layer: Relational tables enforce constraints, hierarchy, and types; audit logs record changes.

```mermaid
sequenceDiagram
participant User as "User"
participant UI as "Accounting Page / Ledger Dashboard"
participant Hook as "useAccounts / useLedger"
participant API as "api.ts"
participant DB as "Supabase Tables (Migrations)"
participant Audit as "Audit Log"
User->>UI : "Create/Edit/Delete Account"
UI->>Hook : "Call mutation/hook"
Hook->>Hook : "Validate input (schemas.ts)"
Hook->>API : "POST/PUT/DELETE /accounts"
API->>DB : "Insert/Update/Delete row"
DB-->>API : "Success/Failure"
API-->>Hook : "Result"
Hook-->>UI : "Update cache/state"
Note over DB,Audit : "Audit trail recorded on change"
```

**Diagram sources**
- [src/pages/accounting/index.tsx](file://src/pages/accounting/index.tsx)
- [src/ledger/LedgerDashboard.tsx](file://src/ledger/LedgerDashboard.tsx)
- [src/ledger/hooks.ts](file://src/ledger/hooks.ts)
- [src/ledger/api.ts](file://src/ledger/api.ts)
- [supabase/migrations/20240101000000_create_accounts_table.sql](file://supabase/migrations/20240101000000_create_accounts_table.sql)
- [src/database-add-audit-log.sql](file://src/database-add-audit-log.sql)

## Detailed Component Analysis

### Account Model and Hierarchy
- Account types: Assets, Liabilities, Equity, Income, Expenses.
- Hierarchy: Parent-child relationships enable grouping and roll-up reporting.
- Numbering convention: Hierarchical numeric or alphanumeric codes reflect depth and category.
- Balance calculation: Leaf accounts hold transactional balances; parent accounts aggregate child balances.

```mermaid
classDiagram
class Account {
+id
+code
+name
+type
+parent_id
+is_leaf
+status
+created_at
+updated_at
}
class Hierarchy {
+path
+depth
+ancestors()
+descendants()
}
class Balance {
+account_id
+debit
+credit
+net()
}
Account --> Hierarchy : "uses"
Account --> Balance : "has many"
```

**Diagram sources**
- [supabase/migrations/20240101000000_create_accounts_table.sql](file://supabase/migrations/20240101000000_create_accounts_table.sql)
- [supabase/migrations/20240101000001_add_account_hierarchy.sql](file://supabase/migrations/20240101000001_add_account_hierarchy.sql)
- [supabase/migrations/20240101000002_add_account_types.sql](file://supabase/migrations/20240101000002_add_account_types.sql)

**Section sources**
- [supabase/migrations/20240101000000_create_accounts_table.sql](file://supabase/migrations/20240101000000_create_accounts_table.sql)
- [supabase/migrations/20240101000001_add_account_hierarchy.sql](file://supabase/migrations/20240101000001_add_account_hierarchy.sql)
- [supabase/migrations/20240101000002_add_account_types.sql](file://supabase/migrations/20240101000002_add_account_types.sql)

### Account Creation Workflow
- Input validation: Type must be one of the allowed categories; code uniqueness and prefix rules enforced; parent must exist and be compatible with child type.
- Mutation: Create account via API; update cache; log audit event.
- Post-create: Optionally initialize opening balances if supported.

```mermaid
flowchart TD
Start(["Create Account"]) --> Validate["Validate inputs<br/>type, code, parent"]
Validate --> Valid{"Valid?"}
Valid --> |No| ShowErrors["Show validation errors"]
Valid --> |Yes| Mutate["Call API create"]
Mutate --> Persist{"Persisted?"}
Persist --> |No| HandleError["Handle error"]
Persist --> |Yes| CacheUpdate["Update UI cache"]
CacheUpdate --> Audit["Record audit log"]
Audit --> End(["Done"])
HandleError --> End
ShowErrors --> End
```

**Diagram sources**
- [src/ledger/schemas.ts](file://src/ledger/schemas.ts)
- [src/ledger/hooks.ts](file://src/ledger/hooks.ts)
- [src/ledger/api.ts](file://src/ledger/api.ts)
- [src/database-add-audit-log.sql](file://src/database-add-audit-log.sql)

**Section sources**
- [src/ledger/schemas.ts](file://src/ledger/schemas.ts)
- [src/ledger/hooks.ts](file://src/ledger/hooks.ts)
- [src/ledger/api.ts](file://src/ledger/api.ts)
- [src/database-add-audit-log.sql](file://src/database-add-audit-log.sql)

### Account Modification Workflow
- Constraints: Prevent changing immutable fields (e.g., code) after first posting; restrict type changes based on usage.
- Validation: Re-run all creation-time validations plus usage checks.
- Audit: Record before/after snapshots.

```mermaid
sequenceDiagram
participant UI as "UI Form"
participant Hook as "Mutation Hook"
participant Schema as "Validation Schema"
participant API as "API Client"
participant DB as "Database"
participant Audit as "Audit Log"
UI->>Hook : "Submit edited account"
Hook->>Schema : "Validate new values"
Schema-->>Hook : "Pass/Fail"
Hook->>API : "PUT /accounts/ : id"
API->>DB : "Update row"
DB-->>API : "OK"
API-->>Hook : "Result"
Hook->>Audit : "Log change"
Hook-->>UI : "Refresh list/detail"
```

**Diagram sources**
- [src/ledger/schemas.ts](file://src/ledger/schemas.ts)
- [src/ledger/hooks.ts](file://src/ledger/hooks.ts)
- [src/ledger/api.ts](file://src/ledger/api.ts)
- [src/database-add-audit-log.sql](file://src/database-add-audit-log.sql)

**Section sources**
- [src/ledger/schemas.ts](file://src/ledger/schemas.ts)
- [src/ledger/hooks.ts](file://src/ledger/hooks.ts)
- [src/ledger/api.ts](file://src/ledger/api.ts)
- [src/database-add-audit-log.sql](file://src/database-add-audit-log.sql)

### Account Deletion Workflow
- Pre-checks: Ensure no transactions reference the account; ensure it has no active children.
- Soft delete vs hard delete: Prefer soft delete/archival to preserve audit integrity.
- Cascade behavior: Disable or archive dependent references rather than deleting them.

```mermaid
flowchart TD
Start(["Delete Account"]) --> CheckRefs["Check references<br/>transactions, children"]
CheckRefs --> Clean{"Clean?"}
Clean --> |No| Block["Block deletion<br/>show guidance"]
Clean --> |Yes| Mutate["Call API delete/archive"]
Mutate --> Persist{"Persisted?"}
Persist --> |No| HandleError["Handle error"]
Persist --> |Yes| Audit["Record audit log"]
Audit --> End(["Done"])
HandleError --> End
Block --> End
```

**Diagram sources**
- [src/ledger/hooks.ts](file://src/ledger/hooks.ts)
- [src/ledger/api.ts](file://src/ledger/api.ts)
- [src/database-add-audit-log.sql](file://src/database-add-audit-log.sql)

**Section sources**
- [src/ledger/hooks.ts](file://src/ledger/hooks.ts)
- [src/ledger/api.ts](file://src/ledger/api.ts)
- [src/database-add-audit-log.sql](file://src/database-add-audit-log.sql)

### Balance Calculations
- Leaf accounts: Sum debits and credits from postings to compute net balance.
- Parent accounts: Aggregate balances from direct children; recursive roll-up supports multi-level hierarchies.
- Periodic filters: Support date range and currency normalization.

```mermaid
flowchart TD
Start(["Compute Balance"]) --> Fetch["Fetch postings for account/date range"]
Fetch --> SumLeaf["Sum debit/credit per leaf"]
SumLeaf --> RollUp["Roll up to parents recursively"]
RollUp --> Normalize["Normalize by currency"]
Normalize --> Return(["Return balances"])
```

**Diagram sources**
- [src/ledger/utils.ts](file://src/ledger/utils.ts)
- [supabase/migrations/20240101000001_add_account_hierarchy.sql](file://supabase/migrations/20240101000001_add_account_hierarchy.sql)

**Section sources**
- [src/ledger/utils.ts](file://src/ledger/utils.ts)
- [supabase/migrations/20240101000001_add_account_hierarchy.sql](file://supabase/migrations/20240101000001_add_account_hierarchy.sql)

### Account Categorization Rules
- Allowed types: Assets, Liabilities, Equity, Income, Expenses.
- Parent-child compatibility: Certain types may only have specific child types (e.g., Asset group can contain Cash, Receivables).
- Code prefixes: Optional mapping between code segments and account types for readability and automation.

```mermaid
flowchart TD
Start(["Categorize Account"]) --> ChooseType["Select account type"]
ChooseType --> SetPrefix["Set code prefix (optional)"]
SetPrefix --> ValidateParent["Validate parent compatibility"]
ValidateParent --> Save["Save account"]
```

**Diagram sources**
- [supabase/migrations/20240101000002_add_account_types.sql](file://supabase/migrations/20240101000002_add_account_types.sql)
- [supabase/migrations/20240101000003_add_account_validation.sql](file://supabase/migrations/20240101000003_add_account_validation.sql)

**Section sources**
- [supabase/migrations/20240101000002_add_account_types.sql](file://supabase/migrations/20240101000002_add_account_types.sql)
- [supabase/migrations/20240101000003_add_account_validation.sql](file://supabase/migrations/20240101000003_add_account_validation.sql)

### Examples of Common Account Structures
- Service-based business:
  - Assets: Current Assets > Cash and Bank; Non-Current Assets > Equipment
  - Liabilities: Current Liabilities > Payables; Non-Current Liabilities > Loans
  - Equity: Owner’s Capital, Retained Earnings
  - Income: Service Revenue
  - Expenses: Rent, Salaries, Professional Fees
- Manufacturing business:
  - Assets: Inventory > Raw Materials, WIP, Finished Goods
  - Expenses: Cost of Goods Sold, Factory Overheads
- Retail/e-commerce:
  - Assets: Inventory by Category
  - Income: Sales Revenue, Shipping Income
  - Expenses: COGS, Marketing, Platform Fees

These patterns align with the hierarchical and typed nature of the CoA and can be modeled using parent-child relationships and consistent numbering.

[No sources needed since this section doesn't analyze specific files]

### Validation Rules
- Uniqueness: Account code must be unique within the organization.
- Type constraints: Only permitted types allowed; type cannot be changed if account has postings.
- Hierarchy constraints: Parent must exist; circular references prevented; leaf vs header semantics enforced.
- Formatting: Code format validated against configured pattern.

```mermaid
flowchart TD
Start(["Validate Account"]) --> Unique["Check code uniqueness"]
Unique --> TypeOk{"Type allowed?"}
TypeOk --> |No| ErrorType["Reject invalid type"]
TypeOk --> |Yes| ParentOk{"Parent valid?"}
ParentOk --> |No| ErrorParent["Reject invalid parent"]
ParentOk --> |Yes| FormatOk{"Code format OK?"}
FormatOk --> |No| ErrorFormat["Reject bad format"]
FormatOk --> |Yes| Pass["Accept"]
```

**Diagram sources**
- [src/ledger/schemas.ts](file://src/ledger/schemas.ts)
- [supabase/migrations/20240101000003_add_account_validation.sql](file://supabase/migrations/20240101000003_add_account_validation.sql)

**Section sources**
- [src/ledger/schemas.ts](file://src/ledger/schemas.ts)
- [supabase/migrations/20240101000003_add_account_validation.sql](file://supabase/migrations/20240101000003_add_account_validation.sql)

### Audit Trails and Compliance
- Audit logging: All create/update/delete operations are logged with timestamps and actor identity.
- Immutability: Once posted, critical attributes (e.g., code, type) should not be altered; prefer archiving and reclassification via journal entries.
- Compliance: Maintain full history for audits; support export and review workflows.

```mermaid
sequenceDiagram
participant Actor as "Actor"
participant UI as "UI"
participant API as "API"
participant DB as "Accounts Table"
participant AUDIT as "Audit Log"
Actor->>UI : "Modify Account"
UI->>API : "Submit change"
API->>DB : "Update row"
API->>AUDIT : "Write audit entry"
AUDIT-->>API : "Logged"
API-->>UI : "Success"
```

**Diagram sources**
- [src/database-add-audit-log.sql](file://src/database-add-audit-log.sql)
- [src/ledger/api.ts](file://src/ledger/api.ts)

**Section sources**
- [src/database-add-audit-log.sql](file://src/database-add-audit-log.sql)
- [src/ledger/api.ts](file://src/ledger/api.ts)

## Dependency Analysis
The following diagram shows how UI components depend on hooks, which rely on the API client and schema validations, ultimately interacting with the database schema defined by migrations.

```mermaid
graph LR
UI_Accounting["Accounting Page<br/>index.tsx"] --> Hooks["Hooks<br/>hooks.ts"]
UI_Ledger["Ledger Dashboard<br/>LedgerDashboard.tsx"] --> Hooks
Hooks --> Schemas["Schemas<br/>schemas.ts"]
Hooks --> Utils["Utils<br/>utils.ts"]
Hooks --> API["API Client<br/>api.ts"]
API --> Migrations["Migrations<br/>*.sql"]
```

**Diagram sources**
- [src/pages/accounting/index.tsx](file://src/pages/accounting/index.tsx)
- [src/ledger/LedgerDashboard.tsx](file://src/ledger/LedgerDashboard.tsx)
- [src/ledger/hooks.ts](file://src/ledger/hooks.ts)
- [src/ledger/schemas.ts](file://src/ledger/schemas.ts)
- [src/ledger/utils.ts](file://src/ledger/utils.ts)
- [src/ledger/api.ts](file://src/ledger/api.ts)
- [supabase/migrations/20240101000000_create_accounts_table.sql](file://supabase/migrations/20240101000000_create_accounts_table.sql)

**Section sources**
- [src/pages/accounting/index.tsx](file://src/pages/accounting/index.tsx)
- [src/ledger/LedgerDashboard.tsx](file://src/ledger/LedgerDashboard.tsx)
- [src/ledger/hooks.ts](file://src/ledger/hooks.ts)
- [src/ledger/schemas.ts](file://src/ledger/schemas.ts)
- [src/ledger/utils.ts](file://src/ledger/utils.ts)
- [src/ledger/api.ts](file://src/ledger/api.ts)
- [supabase/migrations/20240101000000_create_accounts_table.sql](file://supabase/migrations/20240101000000_create_accounts_table.sql)

## Performance Considerations
- Use pagination and filtering when listing large account trees.
- Cache account metadata and computed balances where appropriate.
- Avoid deep recursive queries; leverage hierarchical helpers and precomputed paths if available.
- Batch updates and minimize round trips during bulk operations.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
- Validation failures: Review schema constraints and error messages returned by the API.
- Hierarchy issues: Check parent existence, circular references, and leaf/header semantics.
- Balance discrepancies: Verify postings for the selected period and currency normalization.
- Audit gaps: Confirm audit log writes and permissions for audit table access.

**Section sources**
- [src/ledger/schemas.ts](file://src/ledger/schemas.ts)
- [src/ledger/utils.ts](file://src/ledger/utils.ts)
- [src/database-add-audit-log.sql](file://src/database-add-audit-log.sql)

## Conclusion
The Chart of Accounts system provides a robust, hierarchical, and auditable foundation for financial reporting. By enforcing strict validation, clear numbering conventions, and comprehensive audit trails, it supports accurate balance calculations and compliance requirements across diverse business models.

[No sources needed since this section summarizes without analyzing specific files]