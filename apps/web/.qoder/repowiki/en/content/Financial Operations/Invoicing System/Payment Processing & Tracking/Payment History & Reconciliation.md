# Payment History & Reconciliation

<cite>
**Referenced Files in This Document**
- [FinalPaymentModal.tsx](file://src/components/FinalPaymentModal.tsx)
- [SubcontractorLedger.tsx](file://src/components/SubcontractorLedger.tsx)
- [TDSPaymentPanel.tsx](file://src/components/TDSPaymentPanel.tsx)
- [useProjectTransactions.ts](file://src/hooks/useProjectTransactions.ts)
- [api.ts (invoices)](file://src/invoices/api.ts)
- [hooks.ts (invoices)](file://src/invoices/hooks.ts)
- [types.ts (invoices)](file://src/invoices/types.ts)
- [logic.ts (invoices)](file://src/invoices/logic.ts)
- [ui-utils.ts (invoices)](file://src/invoices/ui-utils.ts)
- [LedgerDashboard.tsx](file://src/ledger/LedgerDashboard.tsx)
- [LedgerModal.tsx](file://src/ledger/LedgerModal.tsx)
- [OpeningBalanceTab.tsx](file://src/ledger/OpeningBalanceTab.tsx)
- [api.ts (ledger)](file://src/ledger/api.ts)
- [hooks.ts (ledger)](file://src/ledger/hooks.ts)
- [schemas.ts (ledger)](file://src/ledger/schemas.ts)
- [utils.ts (ledger)](file://src/ledger/utils.ts)
- [database-complete.sql](file://src/database-complete.sql)
- [supabase/tabledesign26.md](file://tabledesign26.md)
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
This document explains the Payment History and Reconciliation features implemented across the application. It focuses on:
- Viewing complete payment records via a dedicated drawer-like interface
- Filtering by date ranges and searching specific transactions
- Reconciling payments to invoices, including handling overpayments and underpayments
- Generating reconciliation reports and exporting payment history for accounting
- Tracking payment status and maintaining audit trails for modifications
- Applying automated reconciliation rules where applicable

The content is grounded in the repository’s components, hooks, API layers, and database schema references.

## Project Structure
Payment-related UI and logic are primarily located under:
- src/components: FinalPaymentModal.tsx, SubcontractorLedger.tsx, TDSPaymentPanel.tsx
- src/hooks: useProjectTransactions.ts
- src/invoices: api.ts, hooks.ts, types.ts, logic.ts, ui-utils.ts
- src/ledger: LedgerDashboard.tsx, LedgerModal.tsx, OpeningBalanceTab.tsx, api.ts, hooks.ts, schemas.ts, utils.ts
- Database schema references: src/database-complete.sql, tabledesign26.md

```mermaid
graph TB
subgraph "UI"
FPM["FinalPaymentModal.tsx"]
SL["SubcontractorLedger.tsx"]
TDP["TDSPaymentPanel.tsx"]
LD["LedgerDashboard.tsx"]
LM["LedgerModal.tsx"]
OBT["OpeningBalanceTab.tsx"]
end
subgraph "Hooks"
UPT["useProjectTransactions.ts"]
end
subgraph "Invoices Module"
INV_API["invoices/api.ts"]
INV_HOOKS["invoices/hooks.ts"]
INV_TYPES["invoices/types.ts"]
INV_LOGIC["invoices/logic.ts"]
INV_UI["invoices/ui-utils.ts"]
end
subgraph "Ledger Module"
LED_API["ledger/api.ts"]
LED_HOOKS["ledger/hooks.ts"]
LED_SCHEMAS["ledger/schemas.ts"]
LED_UTILS["ledger/utils.ts"]
end
subgraph "Data Layer"
DB["database-complete.sql"]
TABLEDESIGN["tabledesign26.md"]
end
FPM --> INV_API
FPM --> INV_HOOKS
FPM --> INV_TYPES
FPM --> INV_LOGIC
FPM --> INV_UI
SL --> INV_API
SL --> INV_HOOKS
SL --> INV_TYPES
SL --> INV_LOGIC
SL --> INV_UI
TDP --> INV_API
TDP --> INV_HOOKS
TDP --> INV_TYPES
TDP --> INV_LOGIC
TDP --> INV_UI
LD --> LED_API
LD --> LED_HOOKS
LD --> LED_SCHEMAS
LD --> LED_UTILS
LM --> LED_API
LM --> LED_HOOKS
LM --> LED_SCHEMAS
LM --> LED_UTILS
OBT --> LED_API
OBT --> LED_HOOKS
OBT --> LED_SCHEMAS
OBT --> LED_UTILS
UPT --> INV_API
UPT --> INV_HOOKS
UPT --> INV_TYPES
INV_API --> DB
LED_API --> DB
TABLEDESIGN --> DB
```

**Diagram sources**
- [FinalPaymentModal.tsx](file://src/components/FinalPaymentModal.tsx)
- [SubcontractorLedger.tsx](file://src/components/SubcontractorLedger.tsx)
- [TDSPaymentPanel.tsx](file://src/components/TDSPaymentPanel.tsx)
- [useProjectTransactions.ts](file://src/hooks/useProjectTransactions.ts)
- [api.ts (invoices)](file://src/invoices/api.ts)
- [hooks.ts (invoices)](file://src/invoices/hooks.ts)
- [types.ts (invoices)](file://src/invoices/types.ts)
- [logic.ts (invoices)](file://src/invoices/logic.ts)
- [ui-utils.ts (invoices)](file://src/invoices/ui-utils.ts)
- [LedgerDashboard.tsx](file://src/ledger/LedgerDashboard.tsx)
- [LedgerModal.tsx](file://src/ledger/LedgerModal.tsx)
- [OpeningBalanceTab.tsx](file://src/ledger/OpeningBalanceTab.tsx)
- [api.ts (ledger)](file://src/ledger/api.ts)
- [hooks.ts (ledger)](file://src/ledger/hooks.ts)
- [schemas.ts (ledger)](file://src/ledger/schemas.ts)
- [utils.ts (ledger)](file://src/ledger/utils.ts)
- [database-complete.sql](file://src/database-complete.sql)
- [tabledesign26.md](file://tabledesign26.md)

**Section sources**
- [FinalPaymentModal.tsx](file://src/components/FinalPaymentModal.tsx)
- [SubcontractorLedger.tsx](file://src/components/SubcontractorLedger.tsx)
- [TDSPaymentPanel.tsx](file://src/components/TDSPaymentPanel.tsx)
- [useProjectTransactions.ts](file://src/hooks/useProjectTransactions.ts)
- [api.ts (invoices)](file://src/invoices/api.ts)
- [hooks.ts (invoices)](file://src/invoices/hooks.ts)
- [types.ts (invoices)](file://src/invoices/types.ts)
- [logic.ts (invoices)](file://src/invoices/logic.ts)
- [ui-utils.ts (invoices)](file://src/invoices/ui-utils.ts)
- [LedgerDashboard.tsx](file://src/ledger/LedgerDashboard.tsx)
- [LedgerModal.tsx](file://src/ledger/LedgerModal.tsx)
- [OpeningBalanceTab.tsx](file://src/ledger/OpeningBalanceTab.tsx)
- [api.ts (ledger)](file://src/ledger/api.ts)
- [hooks.ts (ledger)](file://src/ledger/hooks.ts)
- [schemas.ts (ledger)](file://src/ledger/schemas.ts)
- [utils.ts (ledger)](file://src/ledger/utils.ts)
- [database-complete.sql](file://src/database-complete.sql)
- [tabledesign26.md](file://tabledesign26.md)

## Core Components
- FinalPaymentModal.tsx: Orchestrates finalizing payments against invoices, applying partials, and updating statuses. Integrates with invoice APIs and hooks for data fetching and mutations.
- SubcontractorLedger.tsx: Presents ledger-style views for subcontractor payments, enabling filtering and search across transactions.
- TDSPaymentPanel.tsx: Handles TDS-specific payment adjustments and reporting within the payment flow.
- useProjectTransactions.ts: Provides project-scoped transaction queries and helpers used by payment flows.
- Invoices module (api.ts, hooks.ts, types.ts, logic.ts, ui-utils.ts): Encapsulates invoice retrieval, mutation, validation, and UI utilities relevant to payment matching and reconciliation.
- Ledger module (LedgerDashboard.tsx, LedgerModal.tsx, OpeningBalanceTab.tsx, api.ts, hooks.ts, schemas.ts, utils.ts): Centralizes ledger operations, including opening balances, modal interactions, and utility functions for calculations and formatting.

Key responsibilities:
- Data access: Fetching invoices, payments, and ledger entries
- Business logic: Matching payments to invoices, computing remaining balances, handling over/underpayments
- UI orchestration: Presenting filtered lists, search, and export capabilities
- Audit and status tracking: Recording changes and reflecting updated statuses

**Section sources**
- [FinalPaymentModal.tsx](file://src/components/FinalPaymentModal.tsx)
- [SubcontractorLedger.tsx](file://src/components/SubcontractorLedger.tsx)
- [TDSPaymentPanel.tsx](file://src/components/TDSPaymentPanel.tsx)
- [useProjectTransactions.ts](file://src/hooks/useProjectTransactions.ts)
- [api.ts (invoices)](file://src/invoices/api.ts)
- [hooks.ts (invoices)](file://src/invoices/hooks.ts)
- [types.ts (invoices)](file://src/invoices/types.ts)
- [logic.ts (invoices)](file://src/invoices/logic.ts)
- [ui-utils.ts (invoices)](file://src/invoices/ui-utils.ts)
- [LedgerDashboard.tsx](file://src/ledger/LedgerDashboard.tsx)
- [LedgerModal.tsx](file://src/ledger/LedgerModal.tsx)
- [OpeningBalanceTab.tsx](file://src/ledger/OpeningBalanceTab.tsx)
- [api.ts (ledger)](file://src/ledger/api.ts)
- [hooks.ts (ledger)](file://src/ledger/hooks.ts)
- [schemas.ts (ledger)](file://src/ledger/schemas.ts)
- [utils.ts (ledger)](file://src/ledger/utils.ts)

## Architecture Overview
The payment and reconciliation architecture follows a layered approach:
- UI layer: Modal/drawer components orchestrate user workflows
- Hooks layer: React Query or similar patterns manage data fetching and caching
- API layer: HTTP/RPC calls to backend services
- Data layer: Database tables and migrations define entities and relationships

```mermaid
sequenceDiagram
participant User as "User"
participant UI as "FinalPaymentModal.tsx"
participant Hook as "invoices/hooks.ts"
participant API as "invoices/api.ts"
participant LedgerAPI as "ledger/api.ts"
participant DB as "Database"
User->>UI : Open payment workflow
UI->>Hook : Fetch invoices/payments
Hook->>API : GET invoices, payments
API-->>Hook : Invoice/payment list
Hook-->>UI : Data + loading states
User->>UI : Select invoice(s), enter amount
UI->>API : POST reconcile payment
API->>DB : Insert/update payment, update invoice status
API-->>UI : Success response
UI->>LedgerAPI : Update ledger entries
LedgerAPI->>DB : Write ledger rows
LedgerAPI-->>UI : Confirmation
UI-->>User : Show summary and audit trail
```

**Diagram sources**
- [FinalPaymentModal.tsx](file://src/components/FinalPaymentModal.tsx)
- [hooks.ts (invoices)](file://src/invoices/hooks.ts)
- [api.ts (invoices)](file://src/invoices/api.ts)
- [api.ts (ledger)](file://src/ledger/api.ts)
- [database-complete.sql](file://src/database-complete.sql)

## Detailed Component Analysis

### PaymentHistoryDrawer Conceptual Model
Although there is no file explicitly named PaymentHistoryDrawer, the functionality described aligns with the ledger and invoice modules’ presentation layers. The conceptual model below shows how a “drawer” would integrate with existing components and data flows.

```mermaid
classDiagram
class PaymentHistoryDrawer {
+open()
+close()
+filterByDateRange(start,end)
+search(query)
+exportCSV()
}
class SubcontractorLedger {
+renderTable()
+applyFilters()
+handleSearch()
}
class LedgerDashboard {
+renderOverview()
+navigateToDetail()
}
class LedgerModal {
+showEntry(entry)
+editEntry(entry)
}
PaymentHistoryDrawer --> SubcontractorLedger : "embeds"
PaymentHistoryDrawer --> LedgerDashboard : "links to"
PaymentHistoryDrawer --> LedgerModal : "opens detail"
```

[No sources needed since this diagram shows conceptual workflow, not actual code structure]

### FinalPaymentModal Workflow
This component coordinates the end-to-end process of applying payments to invoices, including partial payments and status updates.

```mermaid
sequenceDiagram
participant User as "User"
participant FPM as "FinalPaymentModal.tsx"
participant InvHooks as "invoices/hooks.ts"
participant InvAPI as "invoices/api.ts"
participant LedgerAPI as "ledger/api.ts"
participant DB as "Database"
User->>FPM : Initiate payment
FPM->>InvHooks : Load invoices and outstanding balances
InvHooks->>InvAPI : Fetch invoices
InvAPI-->>InvHooks : Invoice data
InvHooks-->>FPM : Ready state
User->>FPM : Choose invoice(s), input amount
FPM->>InvAPI : Submit payment/reconciliation
InvAPI->>DB : Create payment record, adjust invoice balance
InvAPI-->>FPM : Result
FPM->>LedgerAPI : Post ledger entry
LedgerAPI->>DB : Record ledger row
LedgerAPI-->>FPM : Acknowledgement
FPM-->>User : Display success and audit trail
```

**Diagram sources**
- [FinalPaymentModal.tsx](file://src/components/FinalPaymentModal.tsx)
- [hooks.ts (invoices)](file://src/invoices/hooks.ts)
- [api.ts (invoices)](file://src/invoices/api.ts)
- [api.ts (ledger)](file://src/ledger/api.ts)
- [database-complete.sql](file://src/database-complete.sql)

**Section sources**
- [FinalPaymentModal.tsx](file://src/components/FinalPaymentModal.tsx)
- [hooks.ts (invoices)](file://src/invoices/hooks.ts)
- [api.ts (invoices)](file://src/invoices/api.ts)
- [api.ts (ledger)](file://src/ledger/api.ts)
- [database-complete.sql](file://src/database-complete.sql)

### Reconciliation Logic Flow
Reconciliation involves matching payments to invoices, handling overpayments and underpayments, and generating summaries.

```mermaid
flowchart TD
Start(["Start Reconciliation"]) --> LoadInvoices["Load Outstanding Invoices"]
LoadInvoices --> SelectInvoice{"Select Invoice(s)"}
SelectInvoice --> |Yes| EnterAmount["Enter Payment Amount"]
SelectInvoice --> |No| Cancel["Cancel"]
EnterAmount --> ValidateAmount["Validate Amount vs Outstanding"]
ValidateAmount --> AmountOK{"Amount Valid?"}
AmountOK --> |No| ShowError["Show Validation Error"]
AmountOK --> |Yes| ComputeRemainder["Compute Remaining Balance"]
ComputeRemainder --> OverUnder{"Overpayment or Underpayment?"}
OverUnder --> |Overpayment| HandleOver["Create Credit Note / Carry Forward"]
OverUnder --> |Underpayment| HandleUnder["Mark Partially Paid"]
OverUnder --> |Exact| MarkPaid["Mark Fully Paid"]
HandleOver --> PostLedger["Post Ledger Entry"]
HandleUnder --> PostLedger
MarkPaid --> PostLedger
PostLedger --> GenerateSummary["Generate Summary"]
GenerateSummary --> Export["Export CSV/PDF"]
Export --> End(["End"])
ShowError --> End
Cancel --> End
```

**Diagram sources**
- [logic.ts (invoices)](file://src/invoices/logic.ts)
- [ui-utils.ts (invoices)](file://src/invoices/ui-utils.ts)
- [api.ts (ledger)](file://src/ledger/api.ts)
- [database-complete.sql](file://src/database-complete.sql)

**Section sources**
- [logic.ts (invoices)](file://src/invoices/logic.ts)
- [ui-utils.ts (invoices)](file://src/invoices/ui-utils.ts)
- [api.ts (ledger)](file://src/ledger/api.ts)
- [database-complete.sql](file://src/database-complete.sql)

### SubcontractorLedger Filtering and Search
The SubcontractorLedger component provides ledger-style views with filtering and search capabilities.

```mermaid
flowchart TD
LStart(["Open SubcontractorLedger"]) --> FetchEntries["Fetch Ledger Entries"]
FetchEntries --> ApplyFilters["Apply Date Range Filters"]
ApplyFilters --> ApplySearch["Apply Text Search"]
ApplySearch --> RenderTable["Render Filtered Table"]
RenderTable --> UserAction{"User Action"}
UserAction --> |Edit| OpenModal["Open LedgerModal"]
UserAction --> |Export| ExportCSV["Export CSV"]
UserAction --> |Close| LEnd(["Close"])
OpenModal --> EditFlow["Edit Entry Flow"]
EditFlow --> RenderTable
ExportCSV --> LEnd
```

**Diagram sources**
- [SubcontractorLedger.tsx](file://src/components/SubcontractorLedger.tsx)
- [LedgerModal.tsx](file://src/ledger/LedgerModal.tsx)
- [api.ts (ledger)](file://src/ledger/api.ts)
- [hooks.ts (ledger)](file://src/ledger/hooks.ts)

**Section sources**
- [SubcontractorLedger.tsx](file://src/components/SubcontractorLedger.tsx)
- [LedgerModal.tsx](file://src/ledger/LedgerModal.tsx)
- [api.ts (ledger)](file://src/ledger/api.ts)
- [hooks.ts (ledger)](file://src/ledger/hooks.ts)

### TDS Payment Adjustments
TDSPaymentPanel handles TDS-specific adjustments during payment processing.

```mermaid
sequenceDiagram
participant User as "User"
participant TDP as "TDSPaymentPanel.tsx"
participant InvHooks as "invoices/hooks.ts"
participant InvAPI as "invoices/api.ts"
participant LedgerAPI as "ledger/api.ts"
participant DB as "Database"
User->>TDP : Configure TDS settings
TDP->>InvHooks : Load invoice totals
InvHooks-->>TDP : Totals
User->>TDP : Apply TDS deduction
TDP->>InvAPI : Submit adjusted payment
InvAPI->>DB : Record payment with TDS
InvAPI-->>TDP : Confirmation
TDP->>LedgerAPI : Post TDS ledger entry
LedgerAPI->>DB : Record TDS ledger row
LedgerAPI-->>TDP : Acknowledgement
TDP-->>User : Show TDS-adjusted summary
```

**Diagram sources**
- [TDSPaymentPanel.tsx](file://src/components/TDSPaymentPanel.tsx)
- [hooks.ts (invoices)](file://src/invoices/hooks.ts)
- [api.ts (invoices)](file://src/invoices/api.ts)
- [api.ts (ledger)](file://src/ledger/api.ts)
- [database-complete.sql](file://src/database-complete.sql)

**Section sources**
- [TDSPaymentPanel.tsx](file://src/components/TDSPaymentPanel.tsx)
- [hooks.ts (invoices)](file://src/invoices/hooks.ts)
- [api.ts (invoices)](file://src/invoices/api.ts)
- [api.ts (ledger)](file://src/ledger/api.ts)
- [database-complete.sql](file://src/database-complete.sql)

### Project Transactions Integration
useProjectTransactions provides project-scoped transaction data used by payment flows.

```mermaid
sequenceDiagram
participant UI as "FinalPaymentModal.tsx"
participant UPT as "useProjectTransactions.ts"
participant InvAPI as "invoices/api.ts"
participant DB as "Database"
UI->>UPT : Request project transactions
UPT->>InvAPI : Fetch project-related invoices/payments
InvAPI->>DB : Query transactions
DB-->>InvAPI : Transaction results
InvAPI-->>UPT : Aggregated data
UPT-->>UI : Project transaction view
```

**Diagram sources**
- [useProjectTransactions.ts](file://src/hooks/useProjectTransactions.ts)
- [api.ts (invoices)](file://src/invoices/api.ts)
- [database-complete.sql](file://src/database-complete.sql)

**Section sources**
- [useProjectTransactions.ts](file://src/hooks/useProjectTransactions.ts)
- [api.ts (invoices)](file://src/invoices/api.ts)
- [database-complete.sql](file://src/database-complete.sql)

## Dependency Analysis
The following diagram maps key dependencies between UI components, hooks, API layers, and the database schema.

```mermaid
graph TB
FPM["FinalPaymentModal.tsx"] --> INV_API["invoices/api.ts"]
FPM --> INV_HOOKS["invoices/hooks.ts"]
FPM --> INV_TYPES["invoices/types.ts"]
FPM --> INV_LOGIC["invoices/logic.ts"]
FPM --> INV_UI["invoices/ui-utils.ts"]
SL["SubcontractorLedger.tsx"] --> INV_API
SL --> INV_HOOKS
SL --> INV_TYPES
SL --> INV_LOGIC
SL --> INV_UI
TDP["TDSPaymentPanel.tsx"] --> INV_API
TDP --> INV_HOOKS
TDP --> INV_TYPES
TDP --> INV_LOGIC
TDP --> INV_UI
UPT["useProjectTransactions.ts"] --> INV_API
UPT --> INV_HOOKS
UPT --> INV_TYPES
LD["LedgerDashboard.tsx"] --> LED_API["ledger/api.ts"]
LD --> LED_HOOKS["ledger/hooks.ts"]
LD --> LED_SCHEMAS["ledger/schemas.ts"]
LD --> LED_UTILS["ledger/utils.ts"]
LM["LedgerModal.tsx"] --> LED_API
LM --> LED_HOOKS
LM --> LED_SCHEMAS
LM --> LED_UTILS
OBT["OpeningBalanceTab.tsx"] --> LED_API
OBT --> LED_HOOKS
OBT --> LED_SCHEMAS
OBT --> LED_UTILS
INV_API --> DB["database-complete.sql"]
LED_API --> DB
TABLEDESIGN["tabledesign26.md"] --> DB
```

**Diagram sources**
- [FinalPaymentModal.tsx](file://src/components/FinalPaymentModal.tsx)
- [SubcontractorLedger.tsx](file://src/components/SubcontractorLedger.tsx)
- [TDSPaymentPanel.tsx](file://src/components/TDSPaymentPanel.tsx)
- [useProjectTransactions.ts](file://src/hooks/useProjectTransactions.ts)
- [api.ts (invoices)](file://src/invoices/api.ts)
- [hooks.ts (invoices)](file://src/invoices/hooks.ts)
- [types.ts (invoices)](file://src/invoices/types.ts)
- [logic.ts (invoices)](file://src/invoices/logic.ts)
- [ui-utils.ts (invoices)](file://src/invoices/ui-utils.ts)
- [LedgerDashboard.tsx](file://src/ledger/LedgerDashboard.tsx)
- [LedgerModal.tsx](file://src/ledger/LedgerModal.tsx)
- [OpeningBalanceTab.tsx](file://src/ledger/OpeningBalanceTab.tsx)
- [api.ts (ledger)](file://src/ledger/api.ts)
- [hooks.ts (ledger)](file://src/ledger/hooks.ts)
- [schemas.ts (ledger)](file://src/ledger/schemas.ts)
- [utils.ts (ledger)](file://src/ledger/utils.ts)
- [database-complete.sql](file://src/database-complete.sql)
- [tabledesign26.md](file://tabledesign26.md)

**Section sources**
- [FinalPaymentModal.tsx](file://src/components/FinalPaymentModal.tsx)
- [SubcontractorLedger.tsx](file://src/components/SubcontractorLedger.tsx)
- [TDSPaymentPanel.tsx](file://src/components/TDSPaymentPanel.tsx)
- [useProjectTransactions.ts](file://src/hooks/useProjectTransactions.ts)
- [api.ts (invoices)](file://src/invoices/api.ts)
- [hooks.ts (invoices)](file://src/invoices/hooks.ts)
- [types.ts (invoices)](file://src/invoices/types.ts)
- [logic.ts (invoices)](file://src/invoices/logic.ts)
- [ui-utils.ts (invoices)](file://src/invoices/ui-utils.ts)
- [LedgerDashboard.tsx](file://src/ledger/LedgerDashboard.tsx)
- [LedgerModal.tsx](file://src/ledger/LedgerModal.tsx)
- [OpeningBalanceTab.tsx](file://src/ledger/OpeningBalanceTab.tsx)
- [api.ts (ledger)](file://src/ledger/api.ts)
- [hooks.ts (ledger)](file://src/ledger/hooks.ts)
- [schemas.ts (ledger)](file://src/ledger/schemas.ts)
- [utils.ts (ledger)](file://src/ledger/utils.ts)
- [database-complete.sql](file://src/database-complete.sql)
- [tabledesign26.md](file://tabledesign26.md)

## Performance Considerations
- Use pagination and virtualization for large transaction lists in ledger views
- Debounce search inputs to reduce API calls
- Cache invoice and payment data using hooks to avoid redundant fetches
- Batch ledger updates when reconciling multiple invoices
- Optimize database queries with appropriate indexes on date fields and foreign keys

## Troubleshooting Guide
Common issues and resolutions:
- Payment mismatch errors: Validate amounts against outstanding balances before submission; check invoice status transitions
- Missing ledger entries: Ensure post-payment ledger API calls succeed; verify schema constraints
- Audit trail gaps: Confirm that all payment modifications trigger audit logging; review error paths
- Export failures: Validate CSV generation logic and ensure required fields are present

**Section sources**
- [logic.ts (invoices)](file://src/invoices/logic.ts)
- [ui-utils.ts (invoices)](file://src/invoices/ui-utils.ts)
- [api.ts (ledger)](file://src/ledger/api.ts)
- [schemas.ts (ledger)](file://src/ledger/schemas.ts)
- [utils.ts (ledger)](file://src/ledger/utils.ts)

## Conclusion
The Payment History and Reconciliation features are implemented through a cohesive set of components, hooks, and API layers. They provide robust support for viewing payment records, filtering and searching transactions, reconciling payments to invoices, handling over/underpayments, and generating summaries and exports. The ledger module centralizes financial entries, while invoice utilities encapsulate business logic and UI helpers. Proper audit trails and status tracking ensure transparency and accountability throughout the payment lifecycle.

## Appendices

### Example Workflows

#### Resolving Payment Discrepancies
- Identify discrepancies by comparing invoice outstanding balances with recorded payments
- Adjust amounts and apply TDS if applicable
- Post corrected ledger entries and regenerate summaries

#### Generating Payment Summaries
- Aggregate paid, partially paid, and unpaid invoices within selected date ranges
- Include TDS deductions and net payable amounts
- Export summaries for accounting review

#### Exporting Payment History
- Filter transactions by date range and search terms
- Generate CSV/PDF exports with standardized columns
- Ensure audit trail metadata is included for traceability

[No sources needed since this section provides general guidance]