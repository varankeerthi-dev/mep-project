# Leave Management API

<cite>
**Referenced Files in This Document**
- [useLeaveRequests.ts](file://src/hooks/useLeaveRequests.ts)
- [api.ts](file://src/api.ts)
- [database-complete.sql](file://src/database-complete.sql)
- [database-setup.sql](file://src/database-setup.sql)
- [database-manpower-migration.sql](file://src/database-manpower-migration.sql)
- [attendance_planning.sql](file://sql/attendance_planning.sql)
- [attendance-phase2.sql](file://sql/attendance-phase2.sql)
- [useAttendance.ts](file://src/hooks/useAttendance.ts)
- [useAuditLog.ts](file://src/hooks/useAuditLog.ts)
- [Approvals.tsx](file://src/pages/Approvals.tsx)
- [ApprovalSettings.tsx](file://src/pages/ApprovalSettings.tsx)
- [approvals/api.ts](file://src/approvals/api.ts)
- [approvals/workflow-engine.ts](file://src/approvals/workflow-engine.ts)
- [approvals/integration.ts](file://src/approvals/integration.ts)
- [approvals/settings-api.ts](file://src/approvals/settings-api.ts)
- [approvals/notifications.ts](file://src/approvals/notifications.ts)
- [approvals/siteReportApproval.ts](file://src/approvals/siteReportApproval.ts)
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
This document provides detailed API documentation for leave management endpoints and related workflows, including:
- Leave request creation and lifecycle
- Approval workflows and policy enforcement
- Leave balance calculations and encashment processing
- Holiday calendar management
- Leave reporting, audit trails, and integration with attendance systems
- Examples for approval workflows, balance calculations, and leave history retrieval

The scope covers both client-side hooks and server-side APIs where applicable, as well as database schemas that underpin leave-related features.

## Project Structure
Leave management spans multiple layers:
- Client hooks for data access and UI state (e.g., useLeaveRequests, useAttendance)
- Approvals subsystem for workflow orchestration and notifications
- Database migrations and SQL scripts defining tables and constraints
- Pages and settings for approvals and configuration

```mermaid
graph TB
subgraph "Client"
LR["useLeaveRequests.ts"]
ATT["useAttendance.ts"]
AUD["useAuditLog.ts"]
APPR_PAGE["Approvals.tsx"]
SETTING_PAGE["ApprovalSettings.tsx"]
end
subgraph "Approvals Subsystem"
AAPI["approvals/api.ts"]
WF["approvals/workflow-engine.ts"]
INTG["approvals/integration.ts"]
NOTI["approvals/notifications.ts"]
SETAPI["approvals/settings-api.ts"]
end
subgraph "Data Layer"
DBSET["database-setup.sql"]
DBCOMP["database-complete.sql"]
MGRMIG["database-manpower-migration.sql"]
ATTSQL["sql/attendance_planning.sql"]
ATTPH2["sql/attendance-phase2.sql"]
end
LR --> AAPI
LR --> DBSET
LR --> DBCOMP
ATT --> ATTSQL
ATT --> ATTPH2
APPR_PAGE --> AAPI
SETTING_PAGE --> SETAPI
AAPI --> WF
AAPI --> INTG
AAPI --> NOTI
AUD --> DBSET
```

**Diagram sources**
- [useLeaveRequests.ts](file://src/hooks/useLeaveRequests.ts)
- [useAttendance.ts](file://src/hooks/useAttendance.ts)
- [useAuditLog.ts](file://src/hooks/useAuditLog.ts)
- [Approvals.tsx](file://src/pages/Approvals.tsx)
- [ApprovalSettings.tsx](file://src/pages/ApprovalSettings.tsx)
- [approvals/api.ts](file://src/approvals/api.ts)
- [approvals/workflow-engine.ts](file://src/approvals/workflow-engine.ts)
- [approvals/integration.ts](file://src/approvals/integration.ts)
- [approvals/notifications.ts](file://src/approvals/notifications.ts)
- [approvals/settings-api.ts](file://src/approvals/settings-api.ts)
- [database-setup.sql](file://src/database-setup.sql)
- [database-complete.sql](file://src/database-complete.sql)
- [database-manpower-migration.sql](file://src/database-manpower-migration.sql)
- [attendance_planning.sql](file://sql/attendance_planning.sql)
- [attendance-phase2.sql](file://sql/attendance-phase2.sql)

**Section sources**
- [useLeaveRequests.ts](file://src/hooks/useLeaveRequests.ts)
- [useAttendance.ts](file://src/hooks/useAttendance.ts)
- [useAuditLog.ts](file://src/hooks/useAuditLog.ts)
- [Approvals.tsx](file://src/pages/Approvals.tsx)
- [ApprovalSettings.tsx](file://src/pages/ApprovalSettings.tsx)
- [approvals/api.ts](file://src/approvals/api.ts)
- [approvals/workflow-engine.ts](file://src/approvals/workflow-engine.ts)
- [approvals/integration.ts](file://src/approvals/integration.ts)
- [approvals/notifications.ts](file://src/approvals/notifications.ts)
- [approvals/settings-api.ts](file://src/approvals/settings-api.ts)
- [database-setup.sql](file://src/database-setup.sql)
- [database-complete.sql](file://src/database-complete.sql)
- [database-manpower-migration.sql](file://src/database-manpower-migration.sql)
- [attendance_planning.sql](file://sql/attendance_planning.sql)
- [attendance-phase2.sql](file://sql/attendance-phase2.sql)

## Core Components
- Leave Requests Hook: Provides CRUD operations, filtering, and pagination for leave requests. It encapsulates API calls and local state for the UI.
- Attendance Integration Hook: Bridges leave data with attendance records to ensure consistency across modules.
- Audit Log Hook: Exposes audit trail queries for compliance and reporting.
- Approvals API and Engine: Orchestrates multi-step approvals, enforces policies, and triggers notifications.
- Settings API: Manages approval configurations and policy rules.

Key responsibilities:
- Create, update, approve, reject, and cancel leave requests
- Compute balances based on leave types and policies
- Enforce holiday calendars and blackout dates
- Integrate with attendance planning and phase 2 logic
- Generate reports and exportable summaries
- Maintain audit logs for all actions

**Section sources**
- [useLeaveRequests.ts](file://src/hooks/useLeaveRequests.ts)
- [useAttendance.ts](file://src/hooks/useAttendance.ts)
- [useAuditLog.ts](file://src/hooks/useAuditLog.ts)
- [approvals/api.ts](file://src/approvals/api.ts)
- [approvals/workflow-engine.ts](file://src/approvals/workflow-engine.ts)
- [approvals/settings-api.ts](file://src/approvals/settings-api.ts)

## Architecture Overview
The leave management system follows a layered architecture:
- Presentation layer: React pages and hooks
- Business logic: Approvals engine and integrations
- Data persistence: Relational schema defined by SQL migrations
- External integrations: Notifications and attendance systems

```mermaid
sequenceDiagram
participant UI as "UI (Approvals.tsx)"
participant Hook as "useLeaveRequests.ts"
participant API as "approvals/api.ts"
participant WF as "workflow-engine.ts"
participant INTG as "integration.ts"
participant DB as "Database (SQL)"
participant ATT as "Attendance (hooks/sql)"
participant AUD as "Audit (hooks/sql)"
UI->>Hook : "Create leave request"
Hook->>API : "POST /leave-requests"
API->>WF : "Validate policy and calculate balance"
WF->>DB : "Persist request and policy checks"
API->>INTG : "Trigger notifications"
API-->>Hook : "Request created"
Hook-->>UI : "Render updated list"
UI->>API : "Approve/Reject action"
API->>WF : "Execute workflow step"
WF->>DB : "Update status and audit entry"
API->>ATT : "Sync with attendance planning"
API->>AUD : "Record audit log"
API-->>UI : "Action completed"
```

**Diagram sources**
- [Approvals.tsx](file://src/pages/Approvals.tsx)
- [useLeaveRequests.ts](file://src/hooks/useLeaveRequests.ts)
- [approvals/api.ts](file://src/approvals/api.ts)
- [approvals/workflow-engine.ts](file://src/approvals/workflow-engine.ts)
- [approvals/integration.ts](file://src/approvals/integration.ts)
- [database-setup.sql](file://src/database-setup.sql)
- [database-complete.sql](file://src/database-complete.sql)
- [attendance_planning.sql](file://sql/attendance_planning.sql)
- [useAttendance.ts](file://src/hooks/useAttendance.ts)
- [useAuditLog.ts](file://src/hooks/useAuditLog.ts)

## Detailed Component Analysis

### Leave Request Creation and Lifecycle
- Endpoints and flows are implemented via the approvals API and leave requests hook.
- The lifecycle includes draft, pending, approved, rejected, cancelled, and completed states.
- Policy validation occurs before persisting requests, ensuring eligibility and balance sufficiency.

```mermaid
flowchart TD
Start(["Create Request"]) --> Validate["Validate inputs and policy"]
Validate --> Eligible{"Eligible?"}
Eligible --> |No| Error["Return error with reason"]
Eligible --> |Yes| Persist["Persist request"]
Persist --> Notify["Send notifications"]
Notify --> Pending["Status: Pending"]
Pending --> Decision{"Approve/Reject?"}
Decision --> |Approve| Approved["Status: Approved"]
Decision --> |Reject| Rejected["Status: Rejected"]
Approved --> SyncAtt["Sync with attendance"]
Rejected --> End(["End"])
SyncAtt --> Completed["Status: Completed"]
Completed --> End
```

**Diagram sources**
- [useLeaveRequests.ts](file://src/hooks/useLeaveRequests.ts)
- [approvals/api.ts](file://src/approvals/api.ts)
- [approvals/workflow-engine.ts](file://src/approvals/workflow-engine.ts)
- [approvals/notifications.ts](file://src/approvals/notifications.ts)
- [attendance_planning.sql](file://sql/attendance_planning.sql)

**Section sources**
- [useLeaveRequests.ts](file://src/hooks/useLeaveRequests.ts)
- [approvals/api.ts](file://src/approvals/api.ts)
- [approvals/workflow-engine.ts](file://src/approvals/workflow-engine.ts)
- [approvals/notifications.ts](file://src/approvals/notifications.ts)
- [attendance_planning.sql](file://sql/attendance_planning.sql)

### Approval Workflows and Policy Enforcement
- Multi-step approvals can be configured through settings API.
- Workflow engine evaluates conditions, delegates approvers, and enforces business rules.
- Integrations handle side effects like notifications and attendance updates.

```mermaid
classDiagram
class ApprovalsAPI {
+createRequest(data)
+approve(id, payload)
+reject(id, payload)
+cancel(id)
+list(filters)
}
class WorkflowEngine {
+evaluatePolicy(request)
+computeNextApprovers()
+executeStep(action)
}
class SettingsAPI {
+getApprovalSettings()
+updatePolicy(rule)
}
class Integration {
+notifyStakeholders(event)
+syncAttendance(status)
}
ApprovalsAPI --> WorkflowEngine : "uses"
ApprovalsAPI --> Integration : "calls"
ApprovalsAPI --> SettingsAPI : "reads/writes"
```

**Diagram sources**
- [approvals/api.ts](file://src/approvals/api.ts)
- [approvals/workflow-engine.ts](file://src/approvals/workflow-engine.ts)
- [approvals/settings-api.ts](file://src/approvals/settings-api.ts)
- [approvals/integration.ts](file://src/approvals/integration.ts)

**Section sources**
- [approvals/api.ts](file://src/approvals/api.ts)
- [approvals/workflow-engine.ts](file://src/approvals/workflow-engine.ts)
- [approvals/settings-api.ts](file://src/approvals/settings-api.ts)
- [approvals/integration.ts](file://src/approvals/integration.ts)

### Leave Balance Calculations and Encashment Processing
- Balances are computed based on leave type entitlements, accrual rules, and usage history.
- Encashment is processed when policy allows conversion of unused leave into compensation.
- Calculations consider holidays, partial days, and overlapping requests.

```mermaid
flowchart TD
BStart(["Compute Balance"]) --> FetchEntitlements["Fetch entitlements by type"]
FetchEntitlements --> FetchUsage["Fetch usage history"]
FetchUsage --> ApplyRules["Apply accrual and policy rules"]
ApplyRules --> CheckHolidays["Adjust for holidays/blackouts"]
CheckHolidays --> Result["Balance result"]
Result --> EncashCheck{"Encashment allowed?"}
EncashCheck --> |Yes| ProcessEncash["Process encashment"]
EncashCheck --> |No| Done(["Done"])
ProcessEncash --> Done
```

**Diagram sources**
- [approvals/workflow-engine.ts](file://src/approvals/workflow-engine.ts)
- [database-complete.sql](file://src/database-complete.sql)
- [database-manpower-migration.sql](file://src/database-manpower-migration.sql)

**Section sources**
- [approvals/workflow-engine.ts](file://src/approvals/workflow-engine.ts)
- [database-complete.sql](file://src/database-complete.sql)
- [database-manpower-migration.sql](file://src/database-manpower-migration.sql)

### Holiday Calendar Management
- Holidays and blackout dates affect leave eligibility and balance computations.
- Calendar entries are referenced during policy evaluation and scheduling.

```mermaid
flowchart TD
HStart(["Holiday Calendar"]) --> AddEntry["Add holiday/blackout"]
AddEntry --> ValidateDate["Validate date range"]
ValidateDate --> Persist["Persist calendar entry"]
Persist --> UseInPolicy["Used in policy checks"]
UseInPolicy --> UpdateBalance["Adjust balance/scheduling"]
```

**Diagram sources**
- [database-setup.sql](file://src/database-setup.sql)
- [database-complete.sql](file://src/database-complete.sql)
- [approvals/workflow-engine.ts](file://src/approvals/workflow-engine.ts)

**Section sources**
- [database-setup.sql](file://src/database-setup.sql)
- [database-complete.sql](file://src/database-complete.sql)
- [approvals/workflow-engine.ts](file://src/approvals/workflow-engine.ts)

### Leave Reporting and Audit Trails
- Reports aggregate leave usage, balances, and approvals over time.
- Audit logs capture who performed actions, timestamps, and reasons.

```mermaid
flowchart TD
RStart(["Reporting"]) --> QueryUsage["Query leave usage"]
QueryUsage --> Aggregate["Aggregate by employee/type/month"]
Aggregate --> Export["Export report"]
AStart(["Audit Trail"]) --> RecordAction["Record action"]
RecordAction --> QueryAudit["Query audit entries"]
QueryAudit --> Review["Review compliance"]
```

**Diagram sources**
- [useAuditLog.ts](file://src/hooks/useAuditLog.ts)
- [database-setup.sql](file://src/database-setup.sql)
- [database-complete.sql](file://src/database-complete.sql)

**Section sources**
- [useAuditLog.ts](file://src/hooks/useAuditLog.ts)
- [database-setup.sql](file://src/database-setup.sql)
- [database-complete.sql](file://src/database-complete.sql)

### Integration with Attendance Systems
- Leave approvals sync with attendance planning to mark absence and prevent conflicts.
- Phase 2 attendance logic integrates with leave status changes.

```mermaid
sequenceDiagram
participant LReq as "Leave Request"
participant API as "approvals/api.ts"
participant ATT as "useAttendance.ts"
participant ATTSQL as "attendance_planning.sql"
participant PHASE2 as "attendance-phase2.sql"
LReq->>API : "Approve leave"
API->>ATT : "Mark absence for dates"
ATT->>ATTSQL : "Update attendance plan"
ATT->>PHASE2 : "Apply phase 2 rules"
API-->>LReq : "Sync complete"
```

**Diagram sources**
- [useAttendance.ts](file://src/hooks/useAttendance.ts)
- [attendance_planning.sql](file://sql/attendance_planning.sql)
- [attendance-phase2.sql](file://sql/attendance-phase2.sql)
- [approvals/api.ts](file://src/approvals/api.ts)

**Section sources**
- [useAttendance.ts](file://src/hooks/useAttendance.ts)
- [attendance_planning.sql](file://sql/attendance_planning.sql)
- [attendance-phase2.sql](file://sql/attendance-phase2.sql)
- [approvals/api.ts](file://src/approvals/api.ts)

## Dependency Analysis
- Client hooks depend on the approvals API for CRUD and workflow operations.
- Approvals API depends on the workflow engine for policy evaluation and on integrations for side effects.
- Attendance hooks depend on SQL schemas for planning and phase 2 logic.
- Audit log hook depends on database setup and complete schema definitions.

```mermaid
graph TB
LR["useLeaveRequests.ts"] --> AAPI["approvals/api.ts"]
AAPI --> WF["workflow-engine.ts"]
AAPI --> INTG["integration.ts"]
AAPI --> SETAPI["settings-api.ts"]
ATT["useAttendance.ts"] --> ATTSQL["attendance_planning.sql"]
ATT --> ATTPH2["attendance-phase2.sql"]
AUD["useAuditLog.ts"] --> DBSET["database-setup.sql"]
AUD --> DBCOMP["database-complete.sql"]
```

**Diagram sources**
- [useLeaveRequests.ts](file://src/hooks/useLeaveRequests.ts)
- [approvals/api.ts](file://src/approvals/api.ts)
- [approvals/workflow-engine.ts](file://src/approvals/workflow-engine.ts)
- [approvals/integration.ts](file://src/approvals/integration.ts)
- [approvals/settings-api.ts](file://src/approvals/settings-api.ts)
- [useAttendance.ts](file://src/hooks/useAttendance.ts)
- [attendance_planning.sql](file://sql/attendance_planning.sql)
- [attendance-phase2.sql](file://sql/attendance-phase2.sql)
- [useAuditLog.ts](file://src/hooks/useAuditLog.ts)
- [database-setup.sql](file://src/database-setup.sql)
- [database-complete.sql](file://src/database-complete.sql)

**Section sources**
- [useLeaveRequests.ts](file://src/hooks/useLeaveRequests.ts)
- [approvals/api.ts](file://src/approvals/api.ts)
- [approvals/workflow-engine.ts](file://src/approvals/workflow-engine.ts)
- [approvals/integration.ts](file://src/approvals/integration.ts)
- [approvals/settings-api.ts](file://src/approvals/settings-api.ts)
- [useAttendance.ts](file://src/hooks/useAttendance.ts)
- [attendance_planning.sql](file://sql/attendance_planning.sql)
- [attendance-phase2.sql](file://sql/attendance-phase2.sql)
- [useAuditLog.ts](file://src/hooks/useAuditLog.ts)
- [database-setup.sql](file://src/database-setup.sql)
- [database-complete.sql](file://src/database-complete.sql)

## Performance Considerations
- Batch operations for bulk approvals to reduce round trips.
- Indexes on frequently queried fields (employee_id, request_date, status).
- Caching of holiday calendars and policy rules to minimize repeated computation.
- Pagination and filtering for large leave histories and reports.
- Async notification dispatch to avoid blocking approval flows.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- Validation errors: Ensure leave type eligibility and sufficient balance; review policy rules and holiday adjustments.
- Approval failures: Verify approver assignments and workflow steps; check integration connectivity for notifications and attendance sync.
- Balance discrepancies: Inspect usage history and accrual rules; confirm holiday calendar entries and overlap handling.
- Audit gaps: Confirm audit logging is enabled and persisted; verify user context and timestamps.

**Section sources**
- [approvals/api.ts](file://src/approvals/api.ts)
- [approvals/workflow-engine.ts](file://src/approvals/workflow-engine.ts)
- [approvals/notifications.ts](file://src/approvals/notifications.ts)
- [useAuditLog.ts](file://src/hooks/useAuditLog.ts)
- [database-setup.sql](file://src/database-setup.sql)
- [database-complete.sql](file://src/database-complete.sql)

## Conclusion
The leave management API integrates request lifecycle, policy-driven approvals, balance calculations, holiday calendars, reporting, audit trails, and attendance synchronization. By leveraging the approvals engine and hooks, teams can implement robust leave processes with clear visibility and compliance.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Example: Leave Approval Workflow
- Create a leave request via the leave requests hook.
- Submit for approval; the workflow engine evaluates policy and assigns next approver(s).
- Approve or reject; upon approval, attendance is updated and audit log recorded.

**Section sources**
- [useLeaveRequests.ts](file://src/hooks/useLeaveRequests.ts)
- [approvals/api.ts](file://src/approvals/api.ts)
- [approvals/workflow-engine.ts](file://src/approvals/workflow-engine.ts)
- [useAttendance.ts](file://src/hooks/useAttendance.ts)
- [useAuditLog.ts](file://src/hooks/useAuditLog.ts)

### Example: Leave Balance Calculation
- Fetch entitlements and usage history.
- Apply accrual rules and adjust for holidays.
- Return final balance; if encashment is allowed, process accordingly.

**Section sources**
- [approvals/workflow-engine.ts](file://src/approvals/workflow-engine.ts)
- [database-complete.sql](file://src/database-complete.sql)
- [database-manpower-migration.sql](file://src/database-manpower-migration.sql)

### Example: Leave History Retrieval
- Query leave requests with filters (employee, type, date range, status).
- Paginate results and include audit entries for each action.
- Export or render in UI components.

**Section sources**
- [useLeaveRequests.ts](file://src/hooks/useLeaveRequests.ts)
- [useAuditLog.ts](file://src/hooks/useAuditLog.ts)
- [database-setup.sql](file://src/database-setup.sql)
- [database-complete.sql](file://src/database-complete.sql)