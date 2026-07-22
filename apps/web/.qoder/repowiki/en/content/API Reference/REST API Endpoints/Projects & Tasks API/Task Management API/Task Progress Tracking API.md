# Task Progress Tracking API

<cite>
**Referenced Files in This Document**
- [database-project-tasks.sql](file://src/database-project-tasks.sql)
- [database-unified-tasks.sql](file://src/database-unified-tasks.sql)
- [database-tasks-fix.sql](file://src/database-tasks-fix.sql)
- [database-tasks-migration.sql](file://src/database-tasks-migration.sql)
- [useMilestones.ts](file://src/hooks/useMilestones.ts)
- [useTaskSearch.ts](file://src/hooks/useTaskSearch.ts)
- [TasksPage.tsx](file://src/pages/TasksPage.tsx)
- [components/tasks/index.tsx](file://src/components/tasks/index.tsx)
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
This document provides detailed API documentation for task progress tracking and status management. It covers state transitions, progress updates, completion workflows, milestone tracking, progress indicators, audit trails, change history, and analytics integration points. The focus is on how tasks are modeled, updated, and observed within the application, with emphasis on durable schema design and client-side hooks that drive UI behavior.

## Project Structure
The task progress feature spans database migrations (schema), hooks (data access and caching), and pages/components (UI). Key areas:
- Database schema and migrations define task entities, statuses, milestones, comments, time logs, and audit fields.
- Hooks provide typed data access, search, and milestone operations.
- Pages and components orchestrate user interactions such as updating status, marking completion, adding comments, and logging time.

```mermaid
graph TB
subgraph "Database"
T["tasks table"]
M["milestones table"]
C["task_comments table"]
TL["task_time_logs table"]
A["audit_log table"]
end
subgraph "Client"
H1["useMilestones hook"]
H2["useTaskSearch hook"]
P["TasksPage"]
CT["components/tasks"]
end
P --> H1
P --> H2
CT --> H1
CT --> H2
H1 --> T
H1 --> M
H2 --> T
H2 --> C
H2 --> TL
A -. "audit trail" .-> T
```

**Diagram sources**
- [database-project-tasks.sql](file://src/database-project-tasks.sql)
- [database-unified-tasks.sql](file://src/database-unified-tasks.sql)
- [database-tasks-fix.sql](file://src/database-tasks-fix.sql)
- [database-tasks-migration.sql](file://src/database-tasks-migration.sql)
- [useMilestones.ts](file://src/hooks/useMilestones.ts)
- [useTaskSearch.ts](file://src/hooks/useTaskSearch.ts)
- [TasksPage.tsx](file://src/pages/TasksPage.tsx)
- [components/tasks/index.tsx](file://src/components/tasks/index.tsx)

**Section sources**
- [database-project-tasks.sql](file://src/database-project-tasks.sql)
- [database-unified-tasks.sql](file://src/database-unified-tasks.sql)
- [database-tasks-fix.sql](file://src/database-tasks-fix.sql)
- [database-tasks-migration.sql](file://src/database-tasks-migration.sql)
- [useMilestones.ts](file://src/hooks/useMilestones.ts)
- [useTaskSearch.ts](file://src/hooks/useTaskSearch.ts)
- [TasksPage.tsx](file://src/pages/TasksPage.tsx)
- [components/tasks/index.tsx](file://src/components/tasks/index.tsx)

## Core Components
- Task entity and lifecycle states:
  - Status values include draft, open, in_progress, blocked, completed, cancelled.
  - Completion requires a completion timestamp and optional reason or notes.
  - Time spent is tracked via dedicated time log entries linked to tasks.
- Milestones:
  - Tasks can be associated with milestones; milestone completion contributes to overall task progress.
  - Milestone progress is computed from child items or percentage fields.
- Comments and audit trail:
  - Task comments capture contextual updates.
  - Audit log records changes to key fields for traceability.

Operational capabilities exposed by hooks and UI:
- Update task status and completion.
- Add progress comments.
- Log time spent per task.
- Search and filter tasks by status, assignee, project, and keywords.
- Observe milestone progress and completion.

**Section sources**
- [database-project-tasks.sql](file://src/database-project-tasks.sql)
- [database-unified-tasks.sql](file://src/database-unified-tasks.sql)
- [database-tasks-fix.sql](file://src/database-tasks-fix.sql)
- [database-tasks-migration.sql](file://src/database-tasks-migration.sql)
- [useMilestones.ts](file://src/hooks/useMilestones.ts)
- [useTaskSearch.ts](file://src/hooks/useTaskSearch.ts)
- [TasksPage.tsx](file://src/pages/TasksPage.tsx)
- [components/tasks/index.tsx](file://src/components/tasks/index.tsx)

## Architecture Overview
The system follows a layered architecture:
- Data layer: Relational tables store tasks, milestones, comments, time logs, and audit events.
- Access layer: Client hooks encapsulate queries and mutations for tasks and milestones.
- Presentation layer: Pages and components render task lists, detail views, and progress indicators.

```mermaid
sequenceDiagram
participant UI as "TasksPage / components/tasks"
participant Hook as "useTaskSearch / useMilestones"
participant DB as "Database Tables"
participant Audit as "Audit Log"
UI->>Hook : "Update task status"
Hook->>DB : "UPDATE tasks SET status = ?, updated_at = ?"
DB-->>Hook : "Success"
Hook->>Audit : "INSERT audit_log (entity='task', field='status', ...)"
Audit-->>Hook : "Logged"
Hook-->>UI : "Refetch tasks"
UI->>Hook : "Add progress comment"
Hook->>DB : "INSERT task_comments (task_id, body, created_by, created_at)"
DB-->>Hook : "Success"
Hook-->>UI : "Refresh comments list"
UI->>Hook : "Log time spent"
Hook->>DB : "INSERT task_time_logs (task_id, duration_minutes, logged_by, started_at, ended_at)"
DB-->>Hook : "Success"
Hook-->>UI : "Refresh time totals"
```

**Diagram sources**
- [useTaskSearch.ts](file://src/hooks/useTaskSearch.ts)
- [useMilestones.ts](file://src/hooks/useMilestones.ts)
- [database-project-tasks.sql](file://src/database-project-tasks.sql)
- [database-unified-tasks.sql](file://src/database-unified-tasks.sql)
- [database-tasks-fix.sql](file://src/database-tasks-fix.sql)
- [database-tasks-migration.sql](file://src/database-tasks-migration.sql)

## Detailed Component Analysis

### Task State Machine and Transitions
Valid transitions ensure consistent lifecycle progression:
- Draft -> Open
- Open -> In Progress
- In Progress -> Blocked
- In Progress -> Completed
- Any -> Cancelled (with appropriate permissions)

Completion workflow:
- Set status to completed and record completion timestamp.
- Optionally attach completion notes or reason.
- Ensure all required milestones are marked complete if enforced.

Progress indicators:
- Derived from milestone completion percentages or explicit progress fields.
- Aggregated at task level for dashboards and lists.

```mermaid
stateDiagram-v2
[*] --> Draft
Draft --> Open : "start"
Open --> In_Progress : "begin work"
In_Progress --> Blocked : "blocker found"
In_Progress --> Completed : "finish"
Blocked --> In_Progress : "unblock"
Open --> Cancelled : "cancel"
In_Progress --> Cancelled : "cancel"
Completed --> [*]
Cancelled --> [*]
```

**Diagram sources**
- [database-project-tasks.sql](file://src/database-project-tasks.sql)
- [database-unified-tasks.sql](file://src/database-unified-tasks.sql)
- [database-tasks-fix.sql](file://src/database-tasks-fix.sql)

**Section sources**
- [database-project-tasks.sql](file://src/database-project-tasks.sql)
- [database-unified-tasks.sql](file://src/database-unified-tasks.sql)
- [database-tasks-fix.sql](file://src/database-tasks-fix.sql)

### Milestones and Progress Calculation
Milestones contribute to task-level progress:
- Each milestone has a completion flag or percentage.
- Task progress aggregates milestone completion across related items.
- Milestone completion may trigger downstream actions (e.g., enabling next phases).

```mermaid
flowchart TD
Start(["Update Milestone"]) --> CheckRequired["Check Required Fields"]
CheckRequired --> Valid{"Valid?"}
Valid --> |No| Error["Return Validation Error"]
Valid --> |Yes| Persist["Persist Milestone Change"]
Persist --> Recompute["Recompute Task Progress"]
Recompute --> UpdateTask["Update Task Progress Field"]
UpdateTask --> EmitEvents["Emit Progress Event"]
EmitEvents --> End(["Done"])
```

**Diagram sources**
- [useMilestones.ts](file://src/hooks/useMilestones.ts)
- [database-unified-tasks.sql](file://src/database-unified-tasks.sql)

**Section sources**
- [useMilestones.ts](file://src/hooks/useMilestones.ts)
- [database-unified-tasks.sql](file://src/database-unified-tasks.sql)

### Updating Task Status
Typical flow:
- UI triggers status update action.
- Hook validates allowed transitions and required fields.
- Database updates task status and timestamps.
- Audit log records the change.
- Client refetches task data to reflect new state.

```mermaid
sequenceDiagram
participant User as "User"
participant UI as "Task Detail View"
participant Hook as "useTaskSearch"
participant DB as "tasks table"
participant Audit as "audit_log"
User->>UI : "Select new status"
UI->>Hook : "updateTaskStatus(taskId, newStatus)"
Hook->>Hook : "Validate transition"
Hook->>DB : "UPDATE tasks SET status = ?, updated_at = ?"
DB-->>Hook : "OK"
Hook->>Audit : "Record status change"
Audit-->>Hook : "Logged"
Hook-->>UI : "Refetch and update cache"
UI-->>User : "Show updated status"
```

**Diagram sources**
- [useTaskSearch.ts](file://src/hooks/useTaskSearch.ts)
- [database-project-tasks.sql](file://src/database-project-tasks.sql)
- [database-tasks-fix.sql](file://src/database-tasks-fix.sql)

**Section sources**
- [useTaskSearch.ts](file://src/hooks/useTaskSearch.ts)
- [database-project-tasks.sql](file://src/database-project-tasks.sql)
- [database-tasks-fix.sql](file://src/database-tasks-fix.sql)

### Marking Task Completion
Completion workflow:
- Validate completion prerequisites (e.g., required milestones).
- Set status to completed and record completion timestamp.
- Optionally add completion notes.
- Log audit event and refresh UI.

```mermaid
flowchart TD
Enter(["Mark Complete"]) --> Validate["Validate Prerequisites"]
Validate --> Ready{"Ready?"}
Ready --> |No| Block["Block and Show Errors"]
Ready --> |Yes| Update["Set status=completed<br/>completion_timestamp=now()"]
Update --> Notes["Attach completion notes (optional)"]
Notes --> Audit["Write audit entry"]
Audit --> Refresh["Refetch task and milestones"]
Refresh --> Exit(["Complete"])
```

**Diagram sources**
- [useTaskSearch.ts](file://src/hooks/useTaskSearch.ts)
- [database-project-tasks.sql](file://src/database-project-tasks.sql)

**Section sources**
- [useTaskSearch.ts](file://src/hooks/useTaskSearch.ts)
- [database-project-tasks.sql](file://src/database-project-tasks.sql)

### Adding Progress Comments
Comments capture contextual updates:
- Create comment entries linked to tasks.
- Include author and timestamp metadata.
- Display chronological comment threads in task details.

```mermaid
sequenceDiagram
participant UI as "Task Comments Panel"
participant Hook as "useTaskSearch"
participant DB as "task_comments table"
UI->>Hook : "addComment(taskId, body)"
Hook->>DB : "INSERT task_comments (task_id, body, created_by, created_at)"
DB-->>Hook : "Inserted"
Hook-->>UI : "Append comment to list"
```

**Diagram sources**
- [useTaskSearch.ts](file://src/hooks/useTaskSearch.ts)
- [database-unified-tasks.sql](file://src/database-unified-tasks.sql)

**Section sources**
- [useTaskSearch.ts](file://src/hooks/useTaskSearch.ts)
- [database-unified-tasks.sql](file://src/database-unified-tasks.sql)

### Tracking Time Spent
Time logs record effort per task:
- Entries include duration, start/end times, and author.
- Totals can be aggregated for reporting and analytics.
- Time logs integrate with progress analytics dashboards.

```mermaid
flowchart TD
Start(["Log Time"]) --> Input["Input duration and timestamps"]
Input --> Validate["Validate inputs"]
Validate --> OK{"Valid?"}
OK --> |No| Error["Show validation errors"]
OK --> |Yes| Insert["Insert task_time_logs"]
Insert --> Aggregate["Update task time totals"]
Aggregate --> Done(["Done"])
```

**Diagram sources**
- [useTaskSearch.ts](file://src/hooks/useTaskSearch.ts)
- [database-unified-tasks.sql](file://src/database-unified-tasks.sql)

**Section sources**
- [useTaskSearch.ts](file://src/hooks/useTaskSearch.ts)
- [database-unified-tasks.sql](file://src/database-unified-tasks.sql)

### Audit Trails and Change History
Audit logging captures critical changes:
- Records entity type, field changed, old/new values, actor, and timestamp.
- Enables compliance and debugging.
- Integrates with history panels in task details.

```mermaid
sequenceDiagram
participant Hook as "Mutation Hook"
participant DB as "tasks table"
participant Audit as "audit_log"
Hook->>DB : "Perform mutation"
DB-->>Hook : "Success"
Hook->>Audit : "Write audit entry"
Audit-->>Hook : "Logged"
Hook-->>UI : "Expose history via query"
```

**Diagram sources**
- [database-project-tasks.sql](file://src/database-project-tasks.sql)
- [database-tasks-fix.sql](file://src/database-tasks-fix.sql)

**Section sources**
- [database-project-tasks.sql](file://src/database-project-tasks.sql)
- [database-tasks-fix.sql](file://src/database-tasks-fix.sql)

### Progress Analytics Integration
Analytics surfaces derived metrics:
- Task completion rate over time.
- Average time-to-complete by status.
- Milestone adherence and delays.
- Time spent vs planned estimates.

Integration points:
- Queries aggregate task statuses and timestamps.
- Milestone completion feeds into progress curves.
- Time logs feed into productivity metrics.

```mermaid
graph TB
T["tasks"] --> S["Status Counts"]
T --> D["Aging Metrics"]
M["milestones"] --> P["Progress Curves"]
TL["task_time_logs"] --> E["Effort Analytics"]
S --> R["Reports Dashboard"]
D --> R
P --> R
E --> R
```

**Diagram sources**
- [database-project-tasks.sql](file://src/database-project-tasks.sql)
- [database-unified-tasks.sql](file://src/database-unified-tasks.sql)
- [database-tasks-migration.sql](file://src/database-tasks-migration.sql)

**Section sources**
- [database-project-tasks.sql](file://src/database-project-tasks.sql)
- [database-unified-tasks.sql](file://src/database-unified-tasks.sql)
- [database-tasks-migration.sql](file://src/database-tasks-migration.sql)

## Dependency Analysis
Key dependencies between components:
- TasksPage and components/tasks depend on hooks for data access.
- Hooks depend on database schema defined in migrations.
- Audit log depends on mutations performed through hooks.

```mermaid
graph LR
TP["TasksPage.tsx"] --> CT["components/tasks/index.tsx"]
TP --> HM["useMilestones.ts"]
TP --> HS["useTaskSearch.ts"]
CT --> HM
CT --> HS
HM --> DT["database-unified-tasks.sql"]
HS --> DP["database-project-tasks.sql"]
HS --> DF["database-tasks-fix.sql"]
HS --> DM["database-tasks-migration.sql"]
```

**Diagram sources**
- [TasksPage.tsx](file://src/pages/TasksPage.tsx)
- [components/tasks/index.tsx](file://src/components/tasks/index.tsx)
- [useMilestones.ts](file://src/hooks/useMilestones.ts)
- [useTaskSearch.ts](file://src/hooks/useTaskSearch.ts)
- [database-project-tasks.sql](file://src/database-project-tasks.sql)
- [database-unified-tasks.sql](file://src/database-unified-tasks.sql)
- [database-tasks-fix.sql](file://src/database-tasks-fix.sql)
- [database-tasks-migration.sql](file://src/database-tasks-migration.sql)

**Section sources**
- [TasksPage.tsx](file://src/pages/TasksPage.tsx)
- [components/tasks/index.tsx](file://src/components/tasks/index.tsx)
- [useMilestones.ts](file://src/hooks/useMilestones.ts)
- [useTaskSearch.ts](file://src/hooks/useTaskSearch.ts)
- [database-project-tasks.sql](file://src/database-project-tasks.sql)
- [database-unified-tasks.sql](file://src/database-unified-tasks.sql)
- [database-tasks-fix.sql](file://src/database-tasks-fix.sql)
- [database-tasks-migration.sql](file://src/database-tasks-migration.sql)

## Performance Considerations
- Use efficient queries and indexes on frequently filtered columns (status, assignee, project_id).
- Cache task lists and milestone data to reduce network overhead.
- Batch updates where possible to minimize round trips.
- Paginate large task lists and comments to improve rendering performance.
- Avoid recomputing progress unnecessarily; debounce updates when multiple changes occur rapidly.

## Troubleshooting Guide
Common issues and resolutions:
- Invalid status transitions:
  - Validate allowed transitions before persisting changes.
  - Surface clear error messages indicating valid next steps.
- Missing completion prerequisites:
  - Enforce required milestones and fields prior to completion.
  - Provide guidance to users on what is missing.
- Audit log gaps:
  - Ensure every mutation writes an audit entry.
  - Verify audit log permissions and write paths.
- Time log inconsistencies:
  - Validate duration and timestamps.
  - Reconcile totals after bulk imports or edits.

**Section sources**
- [useTaskSearch.ts](file://src/hooks/useTaskSearch.ts)
- [useMilestones.ts](file://src/hooks/useMilestones.ts)
- [database-project-tasks.sql](file://src/database-project-tasks.sql)
- [database-tasks-fix.sql](file://src/database-tasks-fix.sql)

## Conclusion
The task progress tracking system provides robust state management, milestone-driven progress calculation, comprehensive audit trails, and analytics-ready data structures. By adhering to defined state transitions and leveraging hooks for data access, teams can reliably update task status, mark completion, add progress comments, and track time spent while maintaining full visibility into change history and performance metrics.