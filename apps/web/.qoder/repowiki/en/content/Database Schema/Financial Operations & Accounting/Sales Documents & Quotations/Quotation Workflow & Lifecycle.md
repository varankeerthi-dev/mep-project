# Quotation Workflow & Lifecycle

<cite>
**Referenced Files in This Document**
- [quotation-workflow.ts](file://src/lib/quotation-workflow.ts)
- [CreateQuotation.tsx](file://src/pages/CreateQuotation.tsx)
- [CreateQuotationV2.tsx](file://src/pages/CreateQuotationV2.tsx)
- [QuotationList.tsx](file://src/pages/QuotationList.tsx)
- [QuotationView.tsx](file://src/pages/QuotationView.tsx)
- [api.ts](file://src/features/quotation/api.ts)
- [hooks.ts](file://src/features/quotation/hooks.ts)
- [types.ts](file://src/features/quotation/types.ts)
- [logic.ts](file://src/features/quotation/logic.ts)
- [schemas.ts](file://src/features/quotation/schemas.ts)
- [ui-utils.ts](file://src/features/quotation/ui-utils.ts)
- [database-quotation.sql](file://src/database-quotation.sql)
- [database-quotation-revisions.sql](file://src/database-quotation-revisions.sql)
- [database-quotation-conversions.sql](file://src/database-quotation-conversions.sql)
- [database-add-quotation-revision.sql](file://src/database-add-quotation-revision.sql)
- [api.ts](file://src/conversions/api.ts)
- [hooks.ts](file://src/conversions/hooks.ts)
- [types.ts](file://src/conversions/types.ts)
- [usePresence.ts](file://src/hooks/usePresence.ts)
- [PresenceContext.tsx](file://src/contexts/PresenceContext.tsx)
- [usePresenceAware.ts](file://src/hooks/usePresenceAware.ts)
- [PresenceAwareExample.tsx](file://src/examples/PresenceAwareExample.tsx)
- [Approvals.tsx](file://src/pages/Approvals.tsx)
- [ApprovalDetailDrawer.tsx](file://src/components/ApprovalDetailDrawer.tsx)
- [ApprovalDetailsSidebar.tsx](file://src/components/ApprovalDetailsSidebar.tsx)
- [ApprovalSettings.tsx](file://src/components/ApprovalSettings.tsx)
- [workflow-engine.ts](file://src/approvals/workflow-engine.ts)
- [process-action.ts](file://src/api/approvals/process-action.ts)
- [PODetails.tsx](file://src/pages/PODetails.tsx)
- [POList.tsx](file://src/pages/POList.tsx)
- [CreatePO.tsx](file://src/pages/CreatePO.tsx)
- [DCList.tsx](file://src/pages/DCList.tsx)
- [DCView.tsx](file://src/pages/DCView.tsx)
- [CreateDC.tsx](file://src/pages/CreateDC.tsx)
- [DCEdit.tsx](file://src/pages/DCEdit.tsx)
- [InvoiceList.tsx](file://src/invoices/pages/InvoiceList.tsx)
- [InvoiceView.tsx](file://src/invoices/pages/InvoiceView.tsx)
- [CreateProjectInvoiceModal.tsx](file://src/components/CreateProjectInvoiceModal.tsx)
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
This document explains the end-to-end quotation workflow and lifecycle management, from creation through approval to conversion into purchase orders, delivery challans, and invoices. It covers state transitions, validation rules, business logic at each stage, revision management, collaboration features (presence awareness), and conflict resolution during concurrent editing. Concrete examples are provided for editing quotations, managing revisions, and executing approvals. The conversion pipeline is mapped to downstream documents with clear sequence flows.

## Project Structure
The quotation feature spans UI pages, feature modules, shared libraries, database migrations, and cross-cutting services such as approvals and presence. Key areas:
- Pages: Create, List, View, Approvals
- Feature module: API, hooks, types, schemas, logic, UI utilities
- Shared library: Quotation workflow engine
- Conversions: API, hooks, types for converting quotations to other documents
- Presence: Hooks and context for real-time collaboration
- Database: Schema and migrations for quotations, revisions, and conversions
- Approvals: Workflow engine and action processing

```mermaid
graph TB
subgraph "UI Pages"
P_Create["CreateQuotation.tsx"]
P_List["QuotationList.tsx"]
P_View["QuotationView.tsx"]
P_Approvals["Approvals.tsx"]
end
subgraph "Feature Module"
F_API["features/quotation/api.ts"]
F_Hooks["features/quotation/hooks.ts"]
F_Types["features/quotation/types.ts"]
F_Schema["features/quotation/schemas.ts"]
F_Logic["features/quotation/logic.ts"]
F_UI["features/quotation/ui-utils.ts"]
end
subgraph "Shared Library"
L_Workflow["lib/quotation-workflow.ts"]
end
subgraph "Conversions"
C_API["conversions/api.ts"]
C_Hooks["conversions/hooks.ts"]
C_Types["conversions/types.ts"]
end
subgraph "Presence"
H_Presence["hooks/usePresence.ts"]
Ctx_Presence["contexts/PresenceContext.tsx"]
H_Aware["hooks/usePresenceAware.ts"]
end
subgraph "Database"
DB_Q["database-quotation.sql"]
DB_R["database-quotation-revisions.sql"]
DB_C["database-quotation-conversions.sql"]
end
subgraph "Approvals"
A_Engine["approvals/workflow-engine.ts"]
A_Action["api/approvals/process-action.ts"]
end
P_Create --> F_API
P_Create --> F_Hooks
P_Create --> F_Schema
P_Create --> L_Workflow
P_List --> F_API
P_View --> F_API
P_View --> F_Hooks
P_View --> L_Workflow
P_Approvals --> A_Engine
P_Approvals --> A_Action
F_API --> DB_Q
F_API --> DB_R
F_API --> DB_C
C_API --> DB_C
C_Hooks --> C_API
C_Types --> C_API
H_Presence --> Ctx_Presence
H_Aware --> H_Presence
P_Create --> H_Aware
P_View --> H_Aware
```

**Diagram sources**
- [CreateQuotation.tsx](file://src/pages/CreateQuotation.tsx)
- [QuotationList.tsx](file://src/pages/QuotationList.tsx)
- [QuotationView.tsx](file://src/pages/QuotationView.tsx)
- [api.ts](file://src/features/quotation/api.ts)
- [hooks.ts](file://src/features/quotation/hooks.ts)
- [schemas.ts](file://src/features/quotation/schemas.ts)
- [logic.ts](file://src/features/quotation/logic.ts)
- [ui-utils.ts](file://src/features/quotation/ui-utils.ts)
- [quotation-workflow.ts](file://src/lib/quotation-workflow.ts)
- [api.ts](file://src/conversions/api.ts)
- [hooks.ts](file://src/conversions/hooks.ts)
- [types.ts](file://src/conversions/types.ts)
- [usePresence.ts](file://src/hooks/usePresence.ts)
- [PresenceContext.tsx](file://src/contexts/PresenceContext.tsx)
- [usePresenceAware.ts](file://src/hooks/usePresenceAware.ts)
- [database-quotation.sql](file://src/database-quotation.sql)
- [database-quotation-revisions.sql](file://src/database-quotation-revisions.sql)
- [database-quotation-conversions.sql](file://src/database-quotation-conversions.sql)
- [workflow-engine.ts](file://src/approvals/workflow-engine.ts)
- [process-action.ts](file://src/api/approvals/process-action.ts)

**Section sources**
- [CreateQuotation.tsx](file://src/pages/CreateQuotation.tsx)
- [CreateQuotationV2.tsx](file://src/pages/CreateQuotationV2.tsx)
- [QuotationList.tsx](file://src/pages/QuotationList.tsx)
- [QuotationView.tsx](file://src/pages/QuotationView.tsx)
- [api.ts](file://src/features/quotation/api.ts)
- [hooks.ts](file://src/features/quotation/hooks.ts)
- [types.ts](file://src/features/quotation/types.ts)
- [schemas.ts](file://src/features/quotation/schemas.ts)
- [logic.ts](file://src/features/quotation/logic.ts)
- [ui-utils.ts](file://src/features/quotation/ui-utils.ts)
- [quotation-workflow.ts](file://src/lib/quotation-workflow.ts)
- [api.ts](file://src/conversions/api.ts)
- [hooks.ts](file://src/conversions/hooks.ts)
- [types.ts](file://src/conversions/types.ts)
- [usePresence.ts](file://src/hooks/usePresence.ts)
- [PresenceContext.tsx](file://src/contexts/PresenceContext.tsx)
- [usePresenceAware.ts](file://src/hooks/usePresenceAware.ts)
- [database-quotation.sql](file://src/database-quotation.sql)
- [database-quotation-revisions.sql](file://src/database-quotation-revisions.sql)
- [database-quotation-conversions.sql](file://src/database-quotation-conversions.sql)
- [workflow-engine.ts](file://src/approvals/workflow-engine.ts)
- [process-action.ts](file://src/api/approvals/process-action.ts)

## Core Components
- Quotation Workflow Engine: Centralizes state machine transitions, validation, and business rules for quotations.
- Quotation Feature Module: Encapsulates API calls, data fetching hooks, type definitions, schema validations, domain logic, and UI helpers.
- Conversion Layer: Provides APIs and hooks to convert approved quotations into purchase orders, delivery challans, and invoices.
- Presence System: Real-time presence context and hooks to support collaborative editing and conflict resolution.
- Approval Integration: Connects quotations to the approval workflow engine and action processing endpoints.

Key responsibilities:
- State transitions: Draft → Pending Approval → Approved → Rejected → Converted
- Validation: Required fields, pricing integrity, item completeness, approval gating
- Revisioning: Versioned snapshots on edits before approval
- Collaboration: Presence-aware editing with conflict detection and resolution strategies
- Conversion: One-click or guided conversion to PO/DC/Invoice with audit trails

**Section sources**
- [quotation-workflow.ts](file://src/lib/quotation-workflow.ts)
- [api.ts](file://src/features/quotation/api.ts)
- [hooks.ts](file://src/features/quotation/hooks.ts)
- [types.ts](file://src/features/quotation/types.ts)
- [schemas.ts](file://src/features/quotation/schemas.ts)
- [logic.ts](file://src/features/quotation/logic.ts)
- [ui-utils.ts](file://src/features/quotation/ui-utils.ts)
- [api.ts](file://src/conversions/api.ts)
- [hooks.ts](file://src/conversions/hooks.ts)
- [types.ts](file://src/conversions/types.ts)
- [usePresence.ts](file://src/hooks/usePresence.ts)
- [PresenceContext.tsx](file://src/contexts/PresenceContext.tsx)
- [usePresenceAware.ts](file://src/hooks/usePresenceAware.ts)
- [workflow-engine.ts](file://src/approvals/workflow-engine.ts)
- [process-action.ts](file://src/api/approvals/process-action.ts)

## Architecture Overview
The system follows a layered architecture:
- UI layer: Pages orchestrate user interactions and render views
- Feature layer: Business logic, validation, and API integration
- Shared library: Cross-cutting workflow engine
- Persistence: Database via Supabase migrations
- Cross-cutting: Presence, approvals, conversions

```mermaid
sequenceDiagram
participant User as "User"
participant Page as "QuotationView.tsx"
participant Hook as "features/quotation/hooks.ts"
participant API as "features/quotation/api.ts"
participant WF as "lib/quotation-workflow.ts"
participant ConvAPI as "conversions/api.ts"
participant DB as "Database"
User->>Page : Open Quotation
Page->>Hook : fetchQuotation(id)
Hook->>API : GET /quotations/ : id
API-->>Hook : Quotation payload
Hook-->>Page : Quotation + metadata
Page->>WF : validateAndTransition(state, changes)
WF-->>Page : Validated state + actions
User->>Page : Submit for Approval
Page->>API : PATCH /quotations/ : id {status : "Pending Approval"}
API->>DB : Update status
DB-->>API : Success
API-->>Page : Updated Quotation
Note over Page,DB : Approval workflow triggered by engine
User->>Page : Convert to PO/DC/Invoice
Page->>ConvAPI : createConversion(type, id)
ConvAPI->>DB : Create target document
DB-->>ConvAPI : Created document
ConvAPI-->>Page : Conversion result
```

**Diagram sources**
- [QuotationView.tsx](file://src/pages/QuotationView.tsx)
- [hooks.ts](file://src/features/quotation/hooks.ts)
- [api.ts](file://src/features/quotation/api.ts)
- [quotation-workflow.ts](file://src/lib/quotation-workflow.ts)
- [api.ts](file://src/conversions/api.ts)
- [database-quotation.sql](file://src/database-quotation.sql)
- [database-quotation-conversions.sql](file://src/database-quotation-conversions.sql)

## Detailed Component Analysis

### Quotation State Machine and Transitions
The workflow engine defines allowed transitions and guards:
- Draft → Pending Approval: Requires valid header, items, totals, and approver selection if configured
- Pending Approval → Approved: Requires successful approval action
- Pending Approval → Rejected: Requires rejection reason and optional comments
- Approved → Converted: Only one active conversion per document type; conversion creates linked records
- Any non-final state → Draft: Allowed for rework when not converted

Validation rules enforced by the engine include:
- Mandatory client/project linkage
- Item list completeness and pricing consistency
- Tax calculations and discount application
- Approval policy adherence (thresholds, roles)

```mermaid
stateDiagram-v2
[*] --> Draft
Draft --> PendingApproval : "Submit for Approval"
PendingApproval --> Approved : "Approve"
PendingApproval --> Rejected : "Reject"
Approved --> Converted : "Convert to PO/DC/Invoice"
Rejected --> Draft : "Reopen for Rework"
Converted --> [*]
```

**Diagram sources**
- [quotation-workflow.ts](file://src/lib/quotation-workflow.ts)

**Section sources**
- [quotation-workflow.ts](file://src/lib/quotation-workflow.ts)
- [logic.ts](file://src/features/quotation/logic.ts)
- [schemas.ts](file://src/features/quotation/schemas.ts)

### Creation and Editing Flow
Creation flow:
- Initialize draft with defaults (client, currency, terms)
- Add line items with rates, taxes, discounts
- Validate totals and required fields
- Persist draft and enable revision tracking

Editing flow:
- Load latest version and presence info
- Apply local edits with optimistic updates
- On save, create a new revision snapshot and update current state
- Conflict resolution merges based on timestamps and presence locks

```mermaid
flowchart TD
Start(["Open Create/Edit"]) --> InitDraft["Initialize Draft"]
InitDraft --> AddItems["Add Items and Pricing"]
AddItems --> Validate["Validate Fields and Totals"]
Validate --> |Invalid| ShowErrors["Show Validation Errors"]
Validate --> |Valid| SaveDraft["Save Draft"]
SaveDraft --> EnableRevision["Enable Revision Tracking"]
EnableRevision --> EditLoop{"More Edits?"}
EditLoop --> |Yes| AddItems
EditLoop --> |No| SubmitApproval["Submit for Approval"]
SubmitApproval --> Transition["Transition to Pending Approval"]
Transition --> End(["Await Approval"])
```

**Diagram sources**
- [CreateQuotation.tsx](file://src/pages/CreateQuotation.tsx)
- [CreateQuotationV2.tsx](file://src/pages/CreateQuotationV2.tsx)
- [schemas.ts](file://src/features/quotation/schemas.ts)
- [logic.ts](file://src/features/quotation/logic.ts)
- [database-quotation-revisions.sql](file://src/database-quotation-revisions.sql)

**Section sources**
- [CreateQuotation.tsx](file://src/pages/CreateQuotation.tsx)
- [CreateQuotationV2.tsx](file://src/pages/CreateQuotationV2.tsx)
- [schemas.ts](file://src/features/quotation/schemas.ts)
- [logic.ts](file://src/features/quotation/logic.ts)
- [database-quotation-revisions.sql](file://src/database-quotation-revisions.sql)

### Revision Management
Revisions capture snapshots of quotation content upon significant edits:
- Each revision includes timestamp, author, and change summary
- Users can compare versions and restore previous states
- Revisions are immutable and auditable

```mermaid
classDiagram
class Quotation {
+string id
+string status
+number version
+datetime updatedAt
}
class QuotationRevision {
+string id
+string quotation_id
+jsonb snapshot
+string author_id
+datetime createdAt
}
Quotation "1" --> "many" QuotationRevision : "has revisions"
```

**Diagram sources**
- [database-quotation-revisions.sql](file://src/database-quotation-revisions.sql)
- [database-add-quotation-revision.sql](file://src/database-add-quotation-revision.sql)

**Section sources**
- [database-quotation-revisions.sql](file://src/database-quotation-revisions.sql)
- [database-add-quotation-revision.sql](file://src/database-add-quotation-revision.sql)

### Approval Process
Approval integrates with the central workflow engine:
- Trigger approval submission from Quotation view
- Route to appropriate reviewers based on policies
- Record approval decisions and reasons
- Enforce transition to Approved or Rejected

```mermaid
sequenceDiagram
participant User as "User"
participant View as "QuotationView.tsx"
participant API as "features/quotation/api.ts"
participant Engine as "approvals/workflow-engine.ts"
participant Action as "api/approvals/process-action.ts"
participant DB as "Database"
User->>View : Click "Submit for Approval"
View->>API : POST /quotations/ : id/approve-request
API->>Engine : Evaluate policy and route
Engine->>Action : Create approval task(s)
Action->>DB : Insert approval record
DB-->>Action : Success
Action-->>Engine : Task created
Engine-->>API : Approval initiated
API-->>View : Status updated to Pending Approval
Note over View,DB : Reviewers act via Approvals page
```

**Diagram sources**
- [QuotationView.tsx](file://src/pages/QuotationView.tsx)
- [api.ts](file://src/features/quotation/api.ts)
- [workflow-engine.ts](file://src/approvals/workflow-engine.ts)
- [process-action.ts](file://src/api/approvals/process-action.ts)
- [Approvals.tsx](file://src/pages/Approvals.tsx)

**Section sources**
- [QuotationView.tsx](file://src/pages/QuotationView.tsx)
- [api.ts](file://src/features/quotation/api.ts)
- [workflow-engine.ts](file://src/approvals/workflow-engine.ts)
- [process-action.ts](file://src/api/approvals/process-action.ts)
- [Approvals.tsx](file://src/pages/Approvals.tsx)
- [ApprovalDetailDrawer.tsx](file://src/components/ApprovalDetailDrawer.tsx)
- [ApprovalDetailsSidebar.tsx](file://src/components/ApprovalDetailsSidebar.tsx)
- [ApprovalSettings.tsx](file://src/components/ApprovalSettings.tsx)

### Conversion Pipeline (Quotation → PO/DC/Invoice)
Approved quotations can be converted into:
- Purchase Orders (PO): For procurement against vendor quotes
- Delivery Challans (DC): For goods dispatch tracking
- Invoices: For billing customers

Conversion rules:
- Only Approved quotations are convertible
- Conversion preserves line items, pricing, taxes, and references
- Creates linked records with audit trail and status propagation

```mermaid
sequenceDiagram
participant User as "User"
participant View as "QuotationView.tsx"
participant ConvAPI as "conversions/api.ts"
participant ConvHooks as "conversions/hooks.ts"
participant DB as "Database"
User->>View : Choose "Convert to PO"
View->>ConvAPI : createConversion({type : "purchase_order", sourceId})
ConvAPI->>DB : Insert PO with quoted lines
DB-->>ConvAPI : PO created
ConvAPI-->>View : Return PO details
View->>ConvHooks : refreshConversions()
ConvHooks-->>View : Updated conversion list
User->>View : Choose "Convert to DC"
View->>ConvAPI : createConversion({type : "delivery_challan", sourceId})
ConvAPI->>DB : Insert DC with referenced PO/Quotation
DB-->>ConvAPI : DC created
ConvAPI-->>View : Return DC details
User->>View : Choose "Convert to Invoice"
View->>ConvAPI : createConversion({type : "invoice", sourceId})
ConvAPI->>DB : Insert Invoice with referenced Quotation
DB-->>ConvAPI : Invoice created
ConvAPI-->>View : Return Invoice details
```

**Diagram sources**
- [QuotationView.tsx](file://src/pages/QuotationView.tsx)
- [api.ts](file://src/conversions/api.ts)
- [hooks.ts](file://src/conversions/hooks.ts)
- [types.ts](file://src/conversions/types.ts)
- [database-quotation-conversions.sql](file://src/database-quotation-conversions.sql)

**Section sources**
- [api.ts](file://src/conversions/api.ts)
- [hooks.ts](file://src/conversions/hooks.ts)
- [types.ts](file://src/conversions/types.ts)
- [database-quotation-conversions.sql](file://src/database-quotation-conversions.sql)
- [PODetails.tsx](file://src/pages/PODetails.tsx)
- [POList.tsx](file://src/pages/POList.tsx)
- [CreatePO.tsx](file://src/pages/CreatePO.tsx)
- [DCList.tsx](file://src/pages/DCList.tsx)
- [DCView.tsx](file://src/pages/DCView.tsx)
- [CreateDC.tsx](file://src/pages/CreateDC.tsx)
- [DCEdit.tsx](file://src/pages/DCEdit.tsx)
- [InvoiceList.tsx](file://src/invoices/pages/InvoiceList.tsx)
- [InvoiceView.tsx](file://src/invoices/pages/InvoiceView.tsx)
- [CreateProjectInvoiceModal.tsx](file://src/components/CreateProjectInvoiceModal.tsx)

### Collaboration Features, Presence Awareness, and Conflict Resolution
Presence system enables multi-user editing:
- PresenceContext tracks active users and cursors
- usePresence hook subscribes to presence events
- usePresenceAware provides conflict detection and merge strategies

Conflict resolution strategy:
- Last-write-wins with timestamp checks
- Field-level locking for critical sections
- Merge suggestions for overlapping edits

```mermaid
sequenceDiagram
participant UserA as "User A"
participant UserB as "User B"
participant Page as "QuotationView.tsx"
participant Aware as "usePresenceAware.ts"
participant Presence as "usePresence.ts"
participant Context as "PresenceContext.tsx"
participant API as "features/quotation/api.ts"
UserA->>Page : Edit field X
Page->>Aware : applyLocalEdit(X, value)
Aware->>Presence : emitPresenceUpdate(userId, cursor)
Presence->>Context : broadcast presence
UserB->>Page : Edit same field Y
Page->>Aware : detectConflict(Y)
Aware->>API : submitMergeRequest(Y, value, timestamp)
API-->>Aware : Merge resolved
Aware-->>Page : Optimistic update applied
```

**Diagram sources**
- [QuotationView.tsx](file://src/pages/QuotationView.tsx)
- [usePresenceAware.ts](file://src/hooks/usePresenceAware.ts)
- [usePresence.ts](file://src/hooks/usePresence.ts)
- [PresenceContext.tsx](file://src/contexts/PresenceContext.tsx)
- [api.ts](file://src/features/quotation/api.ts)

**Section sources**
- [usePresence.ts](file://src/hooks/usePresence.ts)
- [PresenceContext.tsx](file://src/contexts/PresenceContext.tsx)
- [usePresenceAware.ts](file://src/hooks/usePresenceAware.ts)
- [PresenceAwareExample.tsx](file://src/examples/PresenceAwareExample.tsx)

## Dependency Analysis
The following diagram shows key dependencies between components involved in the quotation lifecycle:

```mermaid
graph TB
Q_View["QuotationView.tsx"] --> Q_API["features/quotation/api.ts"]
Q_View --> Q_Hooks["features/quotation/hooks.ts"]
Q_View --> Q_WF["lib/quotation-workflow.ts"]
Q_View --> Conv_API["conversions/api.ts"]
Q_View --> Pres_Aware["hooks/usePresenceAware.ts"]
Pres_Aware --> Pres_Hook["hooks/usePresence.ts"]
Pres_Hook --> Pres_Context["contexts/PresenceContext.tsx"]
Q_API --> DB_Q["database-quotation.sql"]
Q_API --> DB_R["database-quotation-revisions.sql"]
Conv_API --> DB_C["database-quotation-conversions.sql"]
Q_View --> Approvals_Page["Approvals.tsx"]
Approvals_Page --> WF_Engine["approvals/workflow-engine.ts"]
WF_Engine --> Action_Process["api/approvals/process-action.ts"]
```

**Diagram sources**
- [QuotationView.tsx](file://src/pages/QuotationView.tsx)
- [api.ts](file://src/features/quotation/api.ts)
- [hooks.ts](file://src/features/quotation/hooks.ts)
- [quotation-workflow.ts](file://src/lib/quotation-workflow.ts)
- [api.ts](file://src/conversions/api.ts)
- [usePresenceAware.ts](file://src/hooks/usePresenceAware.ts)
- [usePresence.ts](file://src/hooks/usePresence.ts)
- [PresenceContext.tsx](file://src/contexts/PresenceContext.tsx)
- [database-quotation.sql](file://src/database-quotation.sql)
- [database-quotation-revisions.sql](file://src/database-quotation-revisions.sql)
- [database-quotation-conversions.sql](file://src/database-quotation-conversions.sql)
- [Approvals.tsx](file://src/pages/Approvals.tsx)
- [workflow-engine.ts](file://src/approvals/workflow-engine.ts)
- [process-action.ts](file://src/api/approvals/process-action.ts)

**Section sources**
- [QuotationView.tsx](file://src/pages/QuotationView.tsx)
- [api.ts](file://src/features/quotation/api.ts)
- [hooks.ts](file://src/features/quotation/hooks.ts)
- [quotation-workflow.ts](file://src/lib/quotation-workflow.ts)
- [api.ts](file://src/conversions/api.ts)
- [usePresenceAware.ts](file://src/hooks/usePresenceAware.ts)
- [usePresence.ts](file://src/hooks/usePresence.ts)
- [PresenceContext.tsx](file://src/contexts/PresenceContext.tsx)
- [database-quotation.sql](file://src/database-quotation.sql)
- [database-quotation-revisions.sql](file://src/database-quotation-revisions.sql)
- [database-quotation-conversions.sql](file://src/database-quotation-conversions.sql)
- [Approvals.tsx](file://src/pages/Approvals.tsx)
- [workflow-engine.ts](file://src/approvals/workflow-engine.ts)
- [process-action.ts](file://src/api/approvals/process-action.ts)

## Performance Considerations
- Use optimistic updates for edits to improve responsiveness
- Debounce heavy computations like tax recalculations
- Paginate lists and lazy-load large item tables
- Cache approval settings and policies to reduce repeated queries
- Minimize network round-trips by batching conversion requests where possible

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- Approval stuck in Pending: Verify workflow engine routing and reviewer assignments; check process-action logs
- Conversion fails after approval: Ensure quotation status is Approved and no prior conversion exists for the same target type
- Presence conflicts: Inspect timestamps and lock fields; revert to last known good revision if necessary
- Validation errors on submit: Check schema constraints and required fields; review error messages from schemas and logic modules

**Section sources**
- [workflow-engine.ts](file://src/approvals/workflow-engine.ts)
- [process-action.ts](file://src/api/approvals/process-action.ts)
- [schemas.ts](file://src/features/quotation/schemas.ts)
- [logic.ts](file://src/features/quotation/logic.ts)

## Conclusion
The quotation workflow integrates creation, validation, revisioning, approvals, and conversion into a cohesive lifecycle. The workflow engine enforces robust state transitions and business rules, while the presence system supports collaborative editing with conflict resolution. The conversion pipeline ensures traceability from quotations to downstream documents, maintaining data integrity and auditability across the system.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Example Scenarios
- Editing a Quotation:
  - Open QuotationView, make changes, save draft, create revision snapshot
  - Reference: [QuotationView.tsx](file://src/pages/QuotationView.tsx), [database-quotation-revisions.sql](file://src/database-quotation-revisions.sql)
- Managing Revisions:
  - Compare versions, restore previous state, maintain immutability
  - Reference: [database-quotation-revisions.sql](file://src/database-quotation-revisions.sql), [database-add-quotation-revision.sql](file://src/database-add-quotation-revision.sql)
- Approval Submission and Actions:
  - Submit for approval, route to reviewers, approve/reject with reasons
  - Reference: [QuotationView.tsx](file://src/pages/QuotationView.tsx), [Approvals.tsx](file://src/pages/Approvals.tsx), [workflow-engine.ts](file://src/approvals/workflow-engine.ts), [process-action.ts](file://src/api/approvals/process-action.ts)
- Converting to PO/DC/Invoice:
  - Select conversion type, create linked document, propagate status
  - Reference: [api.ts](file://src/conversions/api.ts), [hooks.ts](file://src/conversions/hooks.ts), [types.ts](file://src/conversions/types.ts), [database-quotation-conversions.sql](file://src/database-quotation-conversions.sql)

[No sources needed since this section aggregates previously referenced files]