# Project Handover & Closure

<cite>
**Referenced Files in This Document**
- [database-handover.sql](file://src/database-handover.sql)
- [useHandovers.ts](file://src/hooks/useHandovers.ts)
- [HandoverList.tsx](file://src/pages/HandoverList.tsx)
- [useProjectClosureChecklist.ts](file://src/hooks/useProjectClosureChecklist.ts)
- [ticket-002-closure-checklist.md](file://.wayfinder/ticket-002-closure-checklist.md)
- [useMilestones.ts](file://src/hooks/useMilestones.ts)
- [useProjects.ts](file://src/hooks/useProjects.ts)
- [useAuditLog.ts](file://src/hooks/useAuditLog.ts)
- [database-add-audit-log.sql](file://src/database-add-audit-log.sql)
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
This document provides a comprehensive data model and process guide for project handover and closure. It covers:
- Handover checklists and completion criteria
- Delivery documentation structures
- Relationships between milestones, deliverables, and handover stages
- Asset transfer records, warranty information, and post-completion support tracking
- Examples of handover status queries, completion verification, and closure reporting
- Validation rules, document attachment handling, and audit trail requirements

The goal is to enable smooth project handover and closure with clear data contracts, validation, and traceability.

## Project Structure
The handover and closure capabilities are implemented across database schema definitions, hooks for data access, and UI pages for interaction. The key areas include:
- Database schema for handover entities and audit logs
- Hooks that encapsulate API/data operations for handovers and closure checklists
- UI page listing and managing handovers
- Milestone and project integration points
- Audit log infrastructure for compliance and traceability

```mermaid
graph TB
subgraph "Data Layer"
DB_HO["Handover Schema<br/>database-handover.sql"]
DB_AUDIT["Audit Log Schema<br/>database-add-audit-log.sql"]
end
subgraph "Business Logic (Hooks)"
HO_HOOK["useHandovers.ts"]
CC_HOOK["useProjectClosureChecklist.ts"]
MS_HOOK["useMilestones.ts"]
PRJ_HOOK["useProjects.ts"]
AUDIT_HOOK["useAuditLog.ts"]
end
subgraph "User Interface"
HO_PAGE["HandoverList.tsx"]
end
DB_HO --> HO_HOOK
DB_AUDIT --> AUDIT_HOOK
HO_HOOK --> HO_PAGE
CC_HOOK --> HO_HOOK
MS_HOOK --> HO_HOOK
PRJ_HOOK --> HO_HOOK
AUDIT_HOOK --> HO_PAGE
```

**Diagram sources**
- [database-handover.sql](file://src/database-handover.sql)
- [database-add-audit-log.sql](file://src/database-add-audit-log.sql)
- [useHandovers.ts](file://src/hooks/useHandovers.ts)
- [useProjectClosureChecklist.ts](file://src/hooks/useProjectClosureChecklist.ts)
- [useMilestones.ts](file://src/hooks/useMilestones.ts)
- [useProjects.ts](file://src/hooks/useProjects.ts)
- [useAuditLog.ts](file://src/hooks/useAuditLog.ts)
- [HandoverList.tsx](file://src/pages/HandoverList.tsx)

**Section sources**
- [database-handover.sql](file://src/database-handover.sql)
- [database-add-audit-log.sql](file://src/database-add-audit-log.sql)
- [useHandovers.ts](file://src/hooks/useHandovers.ts)
- [useProjectClosureChecklist.ts](file://src/hooks/useProjectClosureChecklist.ts)
- [useMilestones.ts](file://src/hooks/useMilestones.ts)
- [useProjects.ts](file://src/hooks/useProjects.ts)
- [useAuditLog.ts](file://src/hooks/useAuditLog.ts)
- [HandoverList.tsx](file://src/pages/HandoverList.tsx)

## Core Components
- Handover entity and lifecycle states
  - Represents a formal handover event tied to a project and milestone/deliverable context.
  - Tracks status transitions from draft to completed or cancelled.
  - Includes fields for dates, responsible parties, and notes.
- Handover checklist items
  - Checklist entries associated with a handover record.
  - Each item has a description, owner, due date, and completion status.
- Asset transfer records
  - Records linking assets to a handover, including asset identifiers, quantities, and transfer conditions.
- Warranty and post-completion support
  - Warranty start/end dates, coverage details, and support contacts linked to the handover.
- Delivery documentation attachments
  - Metadata for documents attached to handover records (e.g., type, version, storage reference).
- Audit trail
  - Immutable log entries capturing creation, updates, approvals, and deletions for handover-related entities.

Examples of usage patterns:
- Querying handover status by project and milestone
- Verifying completion via checklist pass rate and required documents
- Generating closure reports aggregating handover outcomes and audit events

**Section sources**
- [database-handover.sql](file://src/database-handover.sql)
- [useHandovers.ts](file://src/hooks/useHandovers.ts)
- [useProjectClosureChecklist.ts](file://src/hooks/useProjectClosureChecklist.ts)
- [useAuditLog.ts](file://src/hooks/useAuditLog.ts)

## Architecture Overview
The system integrates handover management with existing project and milestone data, ensuring consistent state transitions and auditability.

```mermaid
sequenceDiagram
participant User as "User"
participant UI as "HandoverList.tsx"
participant Hook as "useHandovers.ts"
participant DB as "database-handover.sql"
participant Audit as "database-add-audit-log.sql"
User->>UI : Open Handover List
UI->>Hook : Fetch handovers for project/milestone
Hook->>DB : Read handover records
DB-->>Hook : Handover list
Hook-->>UI : Render table and filters
User->>UI : Create/Update Handover
UI->>Hook : Persist changes
Hook->>DB : Insert/Update handover
Hook->>Audit : Write audit entry
Audit-->>Hook : Acknowledged
Hook-->>UI : Success response
```

**Diagram sources**
- [HandoverList.tsx](file://src/pages/HandoverList.tsx)
- [useHandovers.ts](file://src/hooks/useHandovers.ts)
- [database-handover.sql](file://src/database-handover.sql)
- [database-add-audit-log.sql](file://src/database-add-audit-log.sql)

## Detailed Component Analysis

### Handover Data Model
The handover data model centers around a primary handover record and related entities such as checklist items, asset transfers, warranties, and attachments.

```mermaid
erDiagram
HANDOVER {
uuid id PK
uuid project_id FK
uuid milestone_id FK
enum status
datetime created_at
datetime updated_at
text notes
}
HANDOVER_CHECKLIST_ITEM {
uuid id PK
uuid handover_id FK
text description
uuid owner_id FK
datetime due_date
boolean completed
datetime completed_at
}
ASSET_TRANSFER {
uuid id PK
uuid handover_id FK
string asset_ref
int quantity
text condition
datetime transferred_at
}
WARRANTY_INFO {
uuid id PK
uuid handover_id FK
datetime start_date
datetime end_date
text coverage
text support_contact
}
DELIVERY_DOCUMENT {
uuid id PK
uuid handover_id FK
string doc_type
string storage_ref
string version
datetime uploaded_at
}
HANDOVER ||--o{ HANDOVER_CHECKLIST_ITEM : "has many"
HANDOVER ||--o{ ASSET_TRANSFER : "has many"
HANDOVER ||--o{ WARRANTY_INFO : "has one"
HANDOVER ||--o{ DELIVERY_DOCUMENT : "has many"
```

**Diagram sources**
- [database-handover.sql](file://src/database-handover.sql)

**Section sources**
- [database-handover.sql](file://src/database-handover.sql)

### Handover Lifecycle and Status Transitions
Handover records progress through defined statuses. Typical transitions include:
- Draft: Initial creation before review
- In Review: Submitted for stakeholder review
- Approved: Meets completion criteria and approved
- Completed: Finalized with all deliverables and checks passed
- Cancelled: Terminated without completion

```mermaid
stateDiagram-v2
[*] --> Draft
Draft --> InReview : "submit_for_review"
InReview --> Approved : "approve"
InReview --> Draft : "request_changes"
Approved --> Completed : "finalize"
Approved --> Cancelled : "cancel"
Draft --> Cancelled : "cancel"
Completed --> [*]
Cancelled --> [*]
```

**Diagram sources**
- [useHandovers.ts](file://src/hooks/useHandovers.ts)
- [database-handover.sql](file://src/database-handover.sql)

**Section sources**
- [useHandovers.ts](file://src/hooks/useHandovers.ts)
- [database-handover.sql](file://src/database-handover.sql)

### Completion Criteria and Checklists
Completion criteria are enforced via checklist items and validation rules:
- Required checklist items must be marked completed
- Due dates should not be overdue at completion time
- At least one delivery document must be attached
- Asset transfer records must be present if applicable
- Warranty information must be provided when applicable

```mermaid
flowchart TD
Start(["Start Completion Verification"]) --> LoadItems["Load Checklist Items for Handover"]
LoadItems --> CheckRequired{"All Required Items Completed?"}
CheckRequired --> |No| Block["Block Completion"]
CheckRequired --> |Yes| CheckDueDates["Check No Overdue Items"]
CheckDueDates --> DueOK{"No Overdue Items?"}
DueOK --> |No| Block
DueOK --> |Yes| CheckDocs["Check Delivery Documents Attached"]
CheckDocs --> DocsOK{"Documents Present?"}
DocsOK --> |No| Block
DocsOK --> |Yes| CheckAssets["Check Asset Transfer Records"]
CheckAssets --> AssetsOK{"Assets Recorded?"}
AssetsOK --> |No| OptionalAssets{"Assets Optional?"}
AssetsOK --> |Yes| CheckWarranty["Check Warranty Info"]
CheckWarranty --> WarrantyOK{"Warranty Provided?"}
WarrantyOK --> |No| OptionalWarranty{"Warranty Optional?"}
WarrantyOK --> |Yes| Pass["Pass Completion Verification"]
OptionalAssets --> |Yes| CheckWarranty
OptionalAssets --> |No| Block
OptionalWarranty --> |Yes| Pass
OptionalWarranty --> |No| Block
Block --> End(["End"])
Pass --> End
```

**Diagram sources**
- [useProjectClosureChecklist.ts](file://src/hooks/useProjectClosureChecklist.ts)
- [useHandovers.ts](file://src/hooks/useHandovers.ts)
- [database-handover.sql](file://src/database-handover.sql)

**Section sources**
- [useProjectClosureChecklist.ts](file://src/hooks/useProjectClosureChecklist.ts)
- [useHandovers.ts](file://src/hooks/useHandovers.ts)
- [database-handover.sql](file://src/database-handover.sql)

### Milestones, Deliverables, and Handover Stages
Handovers are closely tied to project milestones and deliverables:
- A handover can be initiated per milestone or per set of deliverables
- Milestone completion triggers readiness for handover
- Deliverables map to checklist items and documentation requirements

```mermaid
classDiagram
class Project {
+id
+name
+status
}
class Milestone {
+id
+project_id
+title
+target_date
+status
}
class Deliverable {
+id
+milestone_id
+title
+type
}
class Handover {
+id
+project_id
+milestone_id
+status
}
Project "1" --> "many" Milestone : "contains"
Milestone "1" --> "many" Deliverable : "produces"
Project "1" --> "many" Handover : "initiates"
Milestone "1" --> "many" Handover : "triggers"
```

**Diagram sources**
- [useMilestones.ts](file://src/hooks/useMilestones.ts)
- [useProjects.ts](file://src/hooks/useProjects.ts)
- [useHandovers.ts](file://src/hooks/useHandovers.ts)
- [database-handover.sql](file://src/database-handover.sql)

**Section sources**
- [useMilestones.ts](file://src/hooks/useMilestones.ts)
- [useProjects.ts](file://src/hooks/useProjects.ts)
- [useHandovers.ts](file://src/hooks/useHandovers.ts)
- [database-handover.sql](file://src/database-handover.sql)

### Document Attachment Handling
Delivery documents are attached to handover records with metadata:
- Document type classification
- Version control for revisions
- Storage reference for retrieval
- Upload timestamp for auditability

Validation rules:
- Mandatory document types based on handover category
- Minimum number of documents required for completion
- File size and format constraints enforced at upload

**Section sources**
- [database-handover.sql](file://src/database-handover.sql)
- [useHandovers.ts](file://src/hooks/useHandovers.ts)

### Audit Trail Requirements
Audit logging captures critical actions:
- Creation, update, approval, and deletion events
- Actor identification and timestamps
- Change summaries for compliance

Integration points:
- Handover hook writes audit entries on mutations
- UI surfaces audit history for transparency

**Section sources**
- [useAuditLog.ts](file://src/hooks/useAuditLog.ts)
- [database-add-audit-log.sql](file://src/database-add-audit-log.sql)
- [useHandovers.ts](file://src/hooks/useHandovers.ts)

## Dependency Analysis
The following diagram shows dependencies among core components involved in handover and closure:

```mermaid
graph LR
HO_DB["database-handover.sql"] --> HO_HOOK["useHandovers.ts"]
AUDIT_DB["database-add-audit-log.sql"] --> AUDIT_HOOK["useAuditLog.ts"]
MS_HOOK["useMilestones.ts"] --> HO_HOOK
PRJ_HOOK["useProjects.ts"] --> HO_HOOK
HO_HOOK --> UI["HandoverList.tsx"]
CC_HOOK["useProjectClosureChecklist.ts"] --> HO_HOOK
```

**Diagram sources**
- [database-handover.sql](file://src/database-handover.sql)
- [database-add-audit-log.sql](file://src/database-add-audit-log.sql)
- [useHandovers.ts](file://src/hooks/useHandovers.ts)
- [useProjectClosureChecklist.ts](file://src/hooks/useProjectClosureChecklist.ts)
- [useMilestones.ts](file://src/hooks/useMilestones.ts)
- [useProjects.ts](file://src/hooks/useProjects.ts)
- [useAuditLog.ts](file://src/hooks/useAuditLog.ts)
- [HandoverList.tsx](file://src/pages/HandoverList.tsx)

**Section sources**
- [database-handover.sql](file://src/database-handover.sql)
- [database-add-audit-log.sql](file://src/database-add-audit-log.sql)
- [useHandovers.ts](file://src/hooks/useHandovers.ts)
- [useProjectClosureChecklist.ts](file://src/hooks/useProjectClosureChecklist.ts)
- [useMilestones.ts](file://src/hooks/useMilestones.ts)
- [useProjects.ts](file://src/hooks/useProjects.ts)
- [useAuditLog.ts](file://src/hooks/useAuditLog.ts)
- [HandoverList.tsx](file://src/pages/HandoverList.tsx)

## Performance Considerations
- Use efficient queries to filter handovers by project and milestone
- Paginate large lists of checklist items and attachments
- Cache frequently accessed project and milestone data
- Batch write audit entries where appropriate to reduce overhead
- Avoid unnecessary re-renders in UI by memoizing computed completion status

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- Missing required checklist items
  - Ensure all mandatory items are marked completed before finalization
- Overdue checklist items
  - Update due dates or complete items to avoid blocking completion
- Missing delivery documents
  - Attach required documents and verify metadata completeness
- Audit log gaps
  - Confirm audit hook integration and permissions for writing logs
- Handover status inconsistencies
  - Validate state transitions and ensure proper approval workflow

**Section sources**
- [useProjectClosureChecklist.ts](file://src/hooks/useProjectClosureChecklist.ts)
- [useHandovers.ts](file://src/hooks/useHandovers.ts)
- [useAuditLog.ts](file://src/hooks/useAuditLog.ts)

## Conclusion
The handover and closure system integrates robust data models, validation rules, and audit trails to ensure reliable project transitions. By aligning milestones, deliverables, and handover stages, teams can achieve consistent completion criteria and transparent reporting. Proper document attachment handling and warranty tracking further enhance post-completion support and accountability.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Example Queries and Reports
- Handover status query by project and milestone
  - Filter handovers by project ID and milestone ID; return status, dates, and notes
- Completion verification report
  - Aggregate checklist completion rates, overdue items, and missing documents
- Closure summary report
  - Summarize finalized handovers, asset transfers, warranty periods, and audit events

**Section sources**
- [useHandovers.ts](file://src/hooks/useHandovers.ts)
- [useProjectClosureChecklist.ts](file://src/hooks/useProjectClosureChecklist.ts)
- [useAuditLog.ts](file://src/hooks/useAuditLog.ts)

### Process Documentation Reference
- Closure checklist specification and workflow details

**Section sources**
- [ticket-002-closure-checklist.md](file://.wayfinder/ticket-002-closure-checklist.md)