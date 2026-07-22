# Customer Payments & Invoicing

<cite>
**Referenced Files in This Document**
- [src/invoices/types.ts](file://src/invoices/types.ts)
- [src/invoices/schemas.ts](file://src/invoices/schemas.ts)
- [src/invoices/logic.ts](file://src/invoices/logic.ts)
- [src/invoices/api.ts](file://src/invoices/api.ts)
- [src/invoices/hooks.ts](file://src/invoices/hooks.ts)
- [src/invoices/components/CreateProjectInvoiceModal.tsx](file://src/components/CreateProjectInvoiceModal.tsx)
- [src/invoices/components/FinalPaymentModal.tsx](file://src/components/FinalPaymentModal.tsx)
- [src/ledger/LedgerModal.tsx](file://src/ledger/LedgerModal.tsx)
- [src/ledger/LedgerDashboard.tsx](file://src/ledger/LedgerDashboard.tsx)
- [src/ledger/api.ts](file://src/ledger/api.ts)
- [src/ledger/hooks.ts](file://src/ledger/hooks.ts)
- [src/ledger/schemas.ts](file://src/ledger/schemas.ts)
- [src/ledger/utils.ts](file://src/ledger/utils.ts)
- [src/pages/accounting/index.tsx](file://src/pages/accounting/index.tsx)
- [src/pages/accounting/PaymentEntryPage.tsx](file://src/pages/accounting/PaymentEntryPage.tsx)
- [src/pages/accounting/InvoiceListPage.tsx](file://src/pages/accounting/InvoiceListPage.tsx)
- [src/pages/accounting/PaymentHistoryPage.tsx](file://src/pages/accounting/PaymentHistoryPage.tsx)
- [src/app/routing/registry.ts](file://src/app/routing/registry.ts)
- [src/app/routing/types.ts](file://src/app/routing/types.ts)
- [src/lib/currency.ts](file://src/lib/currency.ts)
- [src/lib/logger.tsx](file://src/lib/logger.tsx)
- [supabase/migrations/20240101_create_invoices.sql](file://supabase/migrations/20240101_create_invoices.sql)
- [supabase/migrations/20240102_create_payments.sql](file://supabase/migrations/20240102_create_payments.sql)
- [supabase/migrations/20240103_create_payment_allocations.sql](file://supabase/migrations/20240103_create_payment_allocations.sql)
- [supabase/migrations/20240104_create_ledger_entries.sql](file://supabase/migrations/20240104_create_ledger_entries.sql)
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
10. [Appendices](#appendices)

## Introduction
This document explains customer payment processing and invoice management across the application. It covers:
- Payment recording workflows and validation rules
- Payment history tracking and reconciliation
- Invoice status management and lifecycle
- Partial payments, advance payments, and allocation to multiple invoices
- Payment entry forms and user flows
- Automated payment reminders (conceptual)
- Error handling strategies
- Integration points with accounting systems

The goal is to provide both a high-level understanding and detailed technical guidance for developers and product users.

## Project Structure
The relevant code spans UI pages, components, hooks, API clients, business logic, types, schemas, utilities, and database migrations. The structure follows feature-based organization with shared ledger functionality used by invoicing and payments.

```mermaid
graph TB
subgraph "UI Pages"
A["accounting/PaymentEntryPage.tsx"]
B["accounting/InvoiceListPage.tsx"]
C["accounting/PaymentHistoryPage.tsx"]
end
subgraph "Components"
D["components/CreateProjectInvoiceModal.tsx"]
E["components/FinalPaymentModal.tsx"]
F["ledger/LedgerModal.tsx"]
G["ledger/LedgerDashboard.tsx"]
end
subgraph "Hooks & API"
H["invoices/hooks.ts"]
I["invoices/api.ts"]
J["ledger/hooks.ts"]
K["ledger/api.ts"]
end
subgraph "Business Logic"
L["invoices/logic.ts"]
M["invoices/schemas.ts"]
N["invoices/types.ts"]
O["ledger/utils.ts"]
P["ledger/schemas.ts"]
end
subgraph "Routing"
Q["app/routing/registry.ts"]
R["app/routing/types.ts"]
end
subgraph "Database"
S["migrations/..._create_invoices.sql"]
T["migrations/..._create_payments.sql"]
U["migrations/..._create_payment_allocations.sql"]
V["migrations/..._create_ledger_entries.sql"]
end
A --> H
A --> J
B --> H
C --> J
D --> H
E --> J
F --> J
G --> J
H --> I
J --> K
H --> L
J --> O
L --> M
L --> N
O --> P
I --> S
I --> T
I --> U
K --> V
Q --> A
Q --> B
Q --> C
Q --> D
Q --> E
Q --> F
Q --> G
```

**Diagram sources**
- [src/pages/accounting/PaymentEntryPage.tsx](file://src/pages/accounting/PaymentEntryPage.tsx)
- [src/pages/accounting/InvoiceListPage.tsx](file://src/pages/accounting/InvoiceListPage.tsx)
- [src/pages/accounting/PaymentHistoryPage.tsx](file://src/pages/accounting/PaymentHistoryPage.tsx)
- [src/components/CreateProjectInvoiceModal.tsx](file://src/components/CreateProjectInvoiceModal.tsx)
- [src/components/FinalPaymentModal.tsx](file://src/components/FinalPaymentModal.tsx)
- [src/ledger/LedgerModal.tsx](file://src/ledger/LedgerModal.tsx)
- [src/ledger/LedgerDashboard.tsx](file://src/ledger/LedgerDashboard.tsx)
- [src/invoices/hooks.ts](file://src/invoices/hooks.ts)
- [src/invoices/api.ts](file://src/invoices/api.ts)
- [src/ledger/hooks.ts](file://src/ledger/hooks.ts)
- [src/ledger/api.ts](file://src/ledger/api.ts)
- [src/invoices/logic.ts](file://src/invoices/logic.ts)
- [src/invoices/schemas.ts](file://src/invoices/schemas.ts)
- [src/invoices/types.ts](file://src/invoices/types.ts)
- [src/ledger/utils.ts](file://src/ledger/utils.ts)
- [src/ledger/schemas.ts](file://src/ledger/schemas.ts)
- [src/app/routing/registry.ts](file://src/app/routing/registry.ts)
- [src/app/routing/types.ts](file://src/app/routing/types.ts)
- [supabase/migrations/20240101_create_invoices.sql](file://supabase/migrations/20240101_create_invoices.sql)
- [supabase/migrations/20240102_create_payments.sql](file://supabase/migrations/20240102_create_payments.sql)
- [supabase/migrations/20240103_create_payment_allocations.sql](file://supabase/migrations/20240103_create_payment_allocations.sql)
- [supabase/migrations/20240104_create_ledger_entries.sql](file://supabase/migrations/20240104_create_ledger_entries.sql)

**Section sources**
- [src/app/routing/registry.ts](file://src/app/routing/registry.ts)
- [src/app/routing/types.ts](file://src/app/routing/types.ts)

## Core Components
- Invoicing domain: types, schemas, business logic, hooks, and API client orchestrate invoice creation, updates, and status transitions.
- Ledger domain: provides generic double-entry style ledger entries, reconciliations, and dashboards consumed by payments and invoices.
- UI pages and modals: PaymentEntryPage, InvoiceListPage, PaymentHistoryPage, CreateProjectInvoiceModal, FinalPaymentModal, LedgerModal, LedgerDashboard.

Key responsibilities:
- Validate inputs using Zod-like schemas before persisting.
- Enforce business rules such as partial and advance payments, multi-invoice allocation, and idempotency.
- Emit ledger entries on successful transactions.
- Provide consistent error handling and logging.

**Section sources**
- [src/invoices/types.ts](file://src/invoices/types.ts)
- [src/invoices/schemas.ts](file://src/invoices/schemas.ts)
- [src/invoices/logic.ts](file://src/invoices/logic.ts)
- [src/invoices/hooks.ts](file://src/invoices/hooks.ts)
- [src/invoices/api.ts](file://src/invoices/api.ts)
- [src/ledger/utils.ts](file://src/ledger/utils.ts)
- [src/ledger/schemas.ts](file://src/ledger/schemas.ts)
- [src/ledger/hooks.ts](file://src/ledger/hooks.ts)
- [src/ledger/api.ts](file://src/ledger/api.ts)

## Architecture Overview
The system separates concerns into UI, hooks/API, business logic, and persistence layers. Business logic validates and transforms data; hooks manage state and side effects; API clients call backend endpoints; database migrations define schema.

```mermaid
sequenceDiagram
participant User as "User"
participant Page as "PaymentEntryPage"
participant Hook as "invoices/hooks.ts"
participant Logic as "invoices/logic.ts"
participant API as "invoices/api.ts"
participant DB as "Supabase Tables"
participant LedgerHook as "ledger/hooks.ts"
participant LedgerAPI as "ledger/api.ts"
User->>Page : Enter payment details
Page->>Hook : Submit payment form
Hook->>Logic : Validate and compute allocations
Logic-->>Hook : Validated payload + allocations
Hook->>API : Persist payment(s) and allocations
API->>DB : INSERT invoices/payments/allocations
Hook->>LedgerHook : Create ledger entries
LedgerHook->>LedgerAPI : Post debit/credit entries
LedgerAPI->>DB : INSERT ledger_entries
Hook-->>Page : Success or error feedback
```

**Diagram sources**
- [src/pages/accounting/PaymentEntryPage.tsx](file://src/pages/accounting/PaymentEntryPage.tsx)
- [src/invoices/hooks.ts](file://src/invoices/hooks.ts)
- [src/invoices/logic.ts](file://src/invoices/logic.ts)
- [src/invoices/api.ts](file://src/invoices/api.ts)
- [src/ledger/hooks.ts](file://src/ledger/hooks.ts)
- [src/ledger/api.ts](file://src/ledger/api.ts)
- [supabase/migrations/20240101_create_invoices.sql](file://supabase/migrations/20240101_create_invoices.sql)
- [supabase/migrations/20240102_create_payments.sql](file://supabase/migrations/20240102_create_payments.sql)
- [supabase/migrations/20240103_create_payment_allocations.sql](file://supabase/migrations/20240103_create_payment_allocations.sql)
- [supabase/migrations/20240104_create_ledger_entries.sql](file://supabase/migrations/20240104_create_ledger_entries.sql)

## Detailed Component Analysis

### Payment Recording Workflow
End-to-end flow from user input to persisted records and ledger entries.

```mermaid
flowchart TD
Start(["Start Payment Entry"]) --> Validate["Validate Form Inputs<br/>and Amounts"]
Validate --> Valid{"Valid?"}
Valid --> |No| ShowErrors["Show Validation Errors"]
Valid --> |Yes| ComputeAlloc["Compute Allocations<br/>Partial/Advance/Multi-Invoice"]
ComputeAlloc --> Idempotency["Check Idempotency Key"]
Idempotency --> PersistPay["Persist Payment Record"]
PersistPay --> PersistAlloc["Persist Allocation Records"]
PersistAlloc --> CreateLedger["Create Ledger Entries"]
CreateLedger --> UpdateInvoices["Update Invoice Statuses"]
UpdateInvoices --> Success(["Success Feedback"])
ShowErrors --> End(["End"])
Success --> End
```

**Diagram sources**
- [src/pages/accounting/PaymentEntryPage.tsx](file://src/pages/accounting/PaymentEntryPage.tsx)
- [src/invoices/schemas.ts](file://src/invoices/schemas.ts)
- [src/invoices/logic.ts](file://src/invoices/logic.ts)
- [src/invoices/api.ts](file://src/invoices/api.ts)
- [src/ledger/utils.ts](file://src/ledger/utils.ts)
- [src/ledger/api.ts](file://src/ledger/api.ts)
- [supabase/migrations/20240102_create_payments.sql](file://supabase/migrations/20240102_create_payments.sql)
- [supabase/migrations/20240103_create_payment_allocations.sql](file://supabase/migrations/20240103_create_payment_allocations.sql)
- [supabase/migrations/20240104_create_ledger_entries.sql](file://supabase/migrations/20240104_create_ledger_entries.sql)

**Section sources**
- [src/pages/accounting/PaymentEntryPage.tsx](file://src/pages/accounting/PaymentEntryPage.tsx)
- [src/invoices/schemas.ts](file://src/invoices/schemas.ts)
- [src/invoices/logic.ts](file://src/invoices/logic.ts)
- [src/invoices/api.ts](file://src/invoices/api.ts)
- [src/ledger/utils.ts](file://src/ledger/utils.ts)
- [src/ledger/api.ts](file://src/ledger/api.ts)

### Payment History Tracking
Tracks all payments and their allocations for auditability and reconciliation.

```mermaid
classDiagram
class Payment {
+id
+invoice_ids[]
+amount
+currency
+method
+reference
+status
+created_at
}
class PaymentAllocation {
+id
+payment_id
+invoice_id
+allocated_amount
}
class LedgerEntry {
+id
+entity_type
+entity_id
+debit_account
+credit_account
+amount
+currency
+posted_at
}
Payment "1" --> "many" PaymentAllocation : "has many"
Payment "1" --> "many" LedgerEntry : "generates"
PaymentAllocation --> LedgerEntry : "references"
```

**Diagram sources**
- [supabase/migrations/20240102_create_payments.sql](file://supabase/migrations/20240102_create_payments.sql)
- [supabase/migrations/20240103_create_payment_allocations.sql](file://supabase/migrations/20240103_create_payment_allocations.sql)
- [supabase/migrations/20240104_create_ledger_entries.sql](file://supabase/migrations/20240104_create_ledger_entries.sql)
- [src/ledger/hooks.ts](file://src/ledger/hooks.ts)
- [src/ledger/api.ts](file://src/ledger/api.ts)

**Section sources**
- [src/ledger/LedgerModal.tsx](file://src/ledger/LedgerModal.tsx)
- [src/ledger/LedgerDashboard.tsx](file://src/ledger/LedgerDashboard.tsx)
- [src/ledger/hooks.ts](file://src/ledger/hooks.ts)
- [src/ledger/api.ts](file://src/ledger/api.ts)

### Invoice Status Management
Invoices transition through statuses based on cumulative allocated payments.

```mermaid
stateDiagram-v2
[*] --> Draft
Draft --> Issued : "publish"
Issued --> PartiallyPaid : "allocate_payment"
PartiallyPaid --> FullyPaid : "allocate_remaining"
PartiallyPaid --> Issued : "revert_allocation"
FullyPaid --> [*]
```

**Diagram sources**
- [src/invoices/types.ts](file://src/invoices/types.ts)
- [src/invoices/logic.ts](file://src/invoices/logic.ts)
- [supabase/migrations/20240101_create_invoices.sql](file://supabase/migrations/20240101_create_invoices.sql)

**Section sources**
- [src/invoices/types.ts](file://src/invoices/types.ts)
- [src/invoices/logic.ts](file://src/invoices/logic.ts)

### Partial Payments, Advance Payments, and Multi-Invoice Allocation
- Partial payments: allocate less than outstanding balance; invoice remains partially paid.
- Advance payments: allocate against future invoices via reference or pre-allocation flags.
- Multi-invoice allocation: split a single payment across multiple invoices proportionally or by explicit amounts.

Validation and computation are centralized in business logic and enforced by schemas.

**Section sources**
- [src/invoices/logic.ts](file://src/invoices/logic.ts)
- [src/invoices/schemas.ts](file://src/invoices/schemas.ts)
- [src/invoices/types.ts](file://src/invoices/types.ts)

### Payment Entry Forms
Forms capture:
- Customer selection
- Payment method and reference
- Amount and currency
- Target invoices and allocation amounts
- Optional remarks and attachments

UX patterns include inline validation, real-time remaining balances, and confirmation dialogs.

**Section sources**
- [src/pages/accounting/PaymentEntryPage.tsx](file://src/pages/accounting/PaymentEntryPage.tsx)
- [src/components/CreateProjectInvoiceModal.tsx](file://src/components/CreateProjectInvoiceModal.tsx)
- [src/components/FinalPaymentModal.tsx](file://src/components/FinalPaymentModal.tsx)

### Payment Reconciliation Processes
Reconciliation compares:
- Bank statements or external receipts
- Internal payment records and allocations
- Ledger debits and credits

Discrepancies are flagged and resolved via adjustments or reversals.

**Section sources**
- [src/ledger/LedgerDashboard.tsx](file://src/ledger/LedgerDashboard.tsx)
- [src/ledger/LedgerModal.tsx](file://src/ledger/LedgerModal.tsx)
- [src/ledger/utils.ts](file://src/ledger/utils.ts)

### Automated Payment Reminders (Conceptual)
Reminders can be scheduled based on:
- Overdue thresholds
- Aging buckets
- Client preferences

Implementation typically uses background jobs that query unpaid invoices and send notifications.

[No sources needed since this section doesn't analyze specific files]

### Payment Validation Rules
Common rules include:
- Non-negative amounts
- Currency consistency
- Sum of allocations equals payment amount
- Cannot overpay an invoice beyond outstanding balance
- Idempotency key uniqueness
- Required fields per payment method

These are enforced at schema and logic layers.

**Section sources**
- [src/invoices/schemas.ts](file://src/invoices/schemas.ts)
- [src/invoices/logic.ts](file://src/invoices/logic.ts)

### Error Handling
Strategies:
- Client-side validation errors surfaced immediately
- Server-side errors mapped to user-friendly messages
- Transaction rollback on partial failures
- Audit logging for failed attempts

**Section sources**
- [src/lib/logger.tsx](file://src/lib/logger.tsx)
- [src/invoices/api.ts](file://src/invoices/api.ts)
- [src/ledger/api.ts](file://src/ledger/api.ts)

### Integration with Accounting Systems
Integration points:
- Export ledger entries to external accounting APIs
- Map internal accounts to chart of accounts
- Sync invoice and payment references

Ensure idempotent sync and robust retry policies.

**Section sources**
- [src/ledger/utils.ts](file://src/ledger/utils.ts)
- [src/ledger/api.ts](file://src/ledger/api.ts)

## Dependency Analysis
High-level dependencies between modules and layers.

```mermaid
graph LR
Pages["Pages"] --> Hooks["Hooks"]
Hooks --> Logic["Business Logic"]
Hooks --> API["API Clients"]
API --> DB["Database Migrations"]
LedgerHooks["Ledger Hooks"] --> LedgerAPI["Ledger API"]
LedgerAPI --> DB
Utils["Utils/Schemas"] --> Logic
Utils --> LedgerHooks
```

**Diagram sources**
- [src/pages/accounting/PaymentEntryPage.tsx](file://src/pages/accounting/PaymentEntryPage.tsx)
- [src/invoices/hooks.ts](file://src/invoices/hooks.ts)
- [src/invoices/logic.ts](file://src/invoices/logic.ts)
- [src/invoices/api.ts](file://src/invoices/api.ts)
- [src/ledger/hooks.ts](file://src/ledger/hooks.ts)
- [src/ledger/api.ts](file://src/ledger/api.ts)
- [src/invoices/schemas.ts](file://src/invoices/schemas.ts)
- [src/ledger/schemas.ts](file://src/ledger/schemas.ts)

**Section sources**
- [src/invoices/hooks.ts](file://src/invoices/hooks.ts)
- [src/invoices/api.ts](file://src/invoices/api.ts)
- [src/ledger/hooks.ts](file://src/ledger/hooks.ts)
- [src/ledger/api.ts](file://src/ledger/api.ts)

## Performance Considerations
- Batch operations for multi-invoice allocations to reduce round trips.
- Use optimistic UI updates with rollback on failure.
- Index frequently queried columns (e.g., invoice_id, payment_id).
- Paginate large histories and use server-side filters.
- Avoid redundant recalculations by caching outstanding balances.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- Validation failures: check required fields, currency, and allocation sums.
- Duplicate payments: verify idempotency keys and unique constraints.
- Status mismatches: recompute invoice totals from allocations and refresh.
- Ledger imbalance: inspect generated entries and adjust if necessary.
- Logging: review logs for stack traces and context.

**Section sources**
- [src/lib/logger.tsx](file://src/lib/logger.tsx)
- [src/ledger/LedgerModal.tsx](file://src/ledger/LedgerModal.tsx)
- [src/ledger/LedgerDashboard.tsx](file://src/ledger/LedgerDashboard.tsx)

## Conclusion
The payment and invoicing subsystem combines robust validation, clear state transitions, and comprehensive ledger integration. By centralizing business logic and enforcing schemas, it supports partial and advance payments, multi-invoice allocations, and reliable reconciliation. Proper error handling and logging ensure maintainability and operational visibility.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Data Models Overview
```mermaid
erDiagram
INVOICES {
uuid id PK
string number
uuid client_id FK
decimal total_amount
decimal paid_amount
enum status
timestamp created_at
timestamp updated_at
}
PAYMENTS {
uuid id PK
string reference
decimal amount
string currency
string method
enum status
timestamp created_at
}
PAYMENT_ALLOCATIONS {
uuid id PK
uuid payment_id FK
uuid invoice_id FK
decimal allocated_amount
}
LEDGER_ENTRIES {
uuid id PK
string entity_type
uuid entity_id
string debit_account
string credit_account
decimal amount
string currency
timestamp posted_at
}
INVOICES ||--o{ PAYMENT_ALLOCATIONS : "receives"
PAYMENTS ||--o{ PAYMENT_ALLOCATIONS : "allocates_to"
PAYMENTS ||--o{ LEDGER_ENTRIES : "generates"
PAYMENT_ALLOCATIONS ||--o{ LEDGER_ENTRIES : "references"
```

**Diagram sources**
- [supabase/migrations/20240101_create_invoices.sql](file://supabase/migrations/20240101_create_invoices.sql)
- [supabase/migrations/20240102_create_payments.sql](file://supabase/migrations/20240102_create_payments.sql)
- [supabase/migrations/20240103_create_payment_allocations.sql](file://supabase/migrations/20240103_create_payment_allocations.sql)
- [supabase/migrations/20240104_create_ledger_entries.sql](file://supabase/migrations/20240104_create_ledger_entries.sql)