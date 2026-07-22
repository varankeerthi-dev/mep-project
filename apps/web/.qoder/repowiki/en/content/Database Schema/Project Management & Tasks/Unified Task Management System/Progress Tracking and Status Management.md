# Progress Tracking and Status Management

<cite>
**Referenced Files in This Document**
- [database-project-tasks.sql](file://src/database-project-tasks.sql)
- [database-unified-tasks.sql](file://src/database-unified-tasks.sql)
- [useMilestones.ts](file://src/hooks/useMilestones.ts)
- [useTaskSearch.ts](file://src/hooks/useTaskSearch.ts)
- [TasksPage.tsx](file://src/pages/TasksPage.tsx)
- [components/tasks/index.ts](file://src/components/tasks/index.ts)
- [components/tasks/TaskCard.tsx](file://src/components/tasks/TaskCard.tsx)
- [components/tasks/TaskBoardView.tsx](file://src/components/tasks/TaskBoardView.tsx)
- [components/tasks/TaskListView.tsx](file://src/components/tasks/TaskListView.tsx)
- [components/tasks/TaskCalendarView.tsx](file://src/components/tasks/TaskCalendarView.tsx)
- [components/tasks/TaskGanttView.tsx](file://src/components/tasks/TaskGanttView.tsx)
- [components/tasks/TaskProgressIndicator.tsx](file://src/components/tasks/TaskProgressIndicator.tsx)
- [components/tasks/TaskStatusBadge.tsx](file://src/components/tasks/TaskStatusBadge.tsx)
- [components/tasks/TaskTimeTracking.tsx](file://src/components/tasks/TaskTimeTracking.tsx)
- [components/tasks/TaskComments.tsx](file://src/components/tasks/TaskComments.tsx)
- [components/tasks/TaskFileUploads.tsx](file://src/components/tasks/TaskFileUploads.tsx)
- [components/tasks/TaskNotifications.tsx](file://src/components/tasks/TaskNotifications.tsx)
- [components/tasks/TaskAuditLog.tsx](file://src/components/tasks/TaskAuditLog.tsx)
- [lib/followup/task-progress-utils.ts](file://src/lib/followup/task-progress-utils.ts)
- [lib/followup/task-status-validation.ts](file://src/lib/followup/task-status-validation.ts)
- [hooks/useProjectClosureChecklist.ts](file://src/hooks/useProjectClosureChecklist.ts)
- [pages/ProjectOverview.tsx](file://src/pages/ProjectOverview.tsx)
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
This document explains how task progress tracking and status management are implemented across the application. It covers:
- Status definitions and completion criteria for different task types
- Progress calculation methods and validation rules
- Time tracking integration, milestone marking, and automated updates from related activities (comments, file uploads)
- Progress visualization across board, list, calendar, and Gantt views
- Custom progress indicators, reporting, and notifications for overdue or at-risk tasks
- Audit trails for status changes

The goal is to provide a clear, end-to-end understanding for both technical and non-technical readers.

## Project Structure
The progress tracking system spans database schemas, hooks, UI components, and utilities:
- Database schemas define task entities, statuses, milestones, time logs, comments, files, and audit entries
- Hooks provide data access and business logic for milestones and search
- Pages orchestrate views and user interactions
- Components implement view-specific rendering and reusable UI elements
- Utilities encapsulate progress calculations, validations, and automation helpers

```mermaid
graph TB
subgraph "Data Layer"
DB_Tasks["database-project-tasks.sql"]
DB_Unified["database-unified-tasks.sql"]
end
subgraph "Hooks"
H_Milestones["useMilestones.ts"]
H_Search["useTaskSearch.ts"]
end
subgraph "Pages"
P_Tasks["TasksPage.tsx"]
P_ProjectOverview["ProjectOverview.tsx"]
end
subgraph "Components"
C_Board["TaskBoardView.tsx"]
C_List["TaskListView.tsx"]
C_Calendar["TaskCalendarView.tsx"]
C_Gantt["TaskGanttView.tsx"]
C_Progress["TaskProgressIndicator.tsx"]
C_Status["TaskStatusBadge.tsx"]
C_Time["TaskTimeTracking.tsx"]
C_Comments["TaskComments.tsx"]
C_Files["TaskFileUploads.tsx"]
C_Notifications["TaskNotifications.tsx"]
C_Audit["TaskAuditLog.tsx"]
end
subgraph "Utilities"
U_Progress["task-progress-utils.ts"]
U_Validation["task-status-validation.ts"]
end
DB_Tasks --> H_Milestones
DB_Unified --> H_Search
H_Milestones --> C_Board
H_Milestones --> C_List
H_Milestones --> C_Calendar
H_Milestones --> C_Gantt
H_Search --> P_Tasks
P_Tasks --> C_Board
P_Tasks --> C_List
P_Tasks --> C_Calendar
P_Tasks --> C_Gantt
C_Board --> C_Progress
C_List --> C_Progress
C_Calendar --> C_Progress
C_Gantt --> C_Progress
C_Progress --> U_Progress
C_Status --> U_Validation
C_Time --> DB_Tasks
C_Comments --> DB_Tasks
C_Files --> DB_Tasks
C_Notifications --> U_Progress
C_Audit --> DB_Tasks
P_ProjectOverview --> C_Progress
```

**Diagram sources**
- [database-project-tasks.sql](file://src/database-project-tasks.sql)
- [database-unified-tasks.sql](file://src/database-unified-tasks.sql)
- [useMilestones.ts](file://src/hooks/useMilestones.ts)
- [useTaskSearch.ts](file://src/hooks/useTaskSearch.ts)
- [TasksPage.tsx](file://src/pages/TasksPage.tsx)
- [TaskBoardView.tsx](file://src/components/tasks/TaskBoardView.tsx)
- [TaskListView.tsx](file://src/components/tasks/TaskListView.tsx)
- [TaskCalendarView.tsx](file://src/components/tasks/TaskCalendarView.tsx)
- [TaskGanttView.tsx](file://src/components/tasks/TaskGanttView.tsx)
- [TaskProgressIndicator.tsx](file://src/components/tasks/TaskProgressIndicator.tsx)
- [TaskStatusBadge.tsx](file://src/components/tasks/TaskStatusBadge.tsx)
- [TaskTimeTracking.tsx](file://src/components/tasks/TaskTimeTracking.tsx)
- [TaskComments.tsx](file://src/components/tasks/TaskComments.tsx)
- [TaskFileUploads.tsx](file://src/components/tasks/TaskFileUploads.tsx)
- [TaskNotifications.tsx](file://src/components/tasks/TaskNotifications.tsx)
- [TaskAuditLog.tsx](file://src/components/tasks/TaskAuditLog.tsx)
- [task-progress-utils.ts](file://src/lib/followup/task-progress-utils.ts)
- [task-status-validation.ts](file://src/lib/followup/task-status-validation.ts)
- [ProjectOverview.tsx](file://src/pages/ProjectOverview.tsx)

**Section sources**
- [database-project-tasks.sql](file://src/database-project-tasks.sql)
- [database-unified-tasks.sql](file://src/database-unified-tasks.sql)
- [useMilestones.ts](file://src/hooks/useMilestones.ts)
- [useTaskSearch.ts](file://src/hooks/useTaskSearch.ts)
- [TasksPage.tsx](file://src/pages/TasksPage.tsx)
- [TaskBoardView.tsx](file://src/components/tasks/TaskBoardView.tsx)
- [TaskListView.tsx](file://src/components/tasks/TaskListView.tsx)
- [TaskCalendarView.tsx](file://src/components/tasks/TaskCalendarView.tsx)
- [TaskGanttView.tsx](file://src/components/tasks/TaskGanttView.tsx)
- [TaskProgressIndicator.tsx](file://src/components/tasks/TaskProgressIndicator.tsx)
- [TaskStatusBadge.tsx](file://src/components/tasks/TaskStatusBadge.tsx)
- [TaskTimeTracking.tsx](file://src/components/tasks/TaskTimeTracking.tsx)
- [TaskComments.tsx](file://src/components/tasks/TaskComments.tsx)
- [TaskFileUploads.tsx](file://src/components/tasks/TaskFileUploads.tsx)
- [TaskNotifications.tsx](file://src/components/tasks/TaskNotifications.tsx)
- [TaskAuditLog.tsx](file://src/components/tasks/TaskAuditLog.tsx)
- [task-progress-utils.ts](file://src/lib/followup/task-progress-utils.ts)
- [task-status-validation.ts](file://src/lib/followup/task-status-validation.ts)
- [ProjectOverview.tsx](file://src/pages/ProjectOverview.tsx)

## Core Components
- Task entity and lifecycle:
  - Tasks store core fields such as title, description, assignee, due date, priority, type, and status
  - Status transitions are governed by validation rules and audit logging
- Milestones:
  - Milestone markers tied to projects or phases; completion contributes to overall project progress
- Time tracking:
  - Time logs associated with tasks; cumulative hours influence progress calculations
- Comments and files:
  - Activity-driven updates can incrementally adjust progress based on new comments or uploaded artifacts
- Views:
  - Board, list, calendar, and Gantt render task states and progress consistently
- Notifications and audit:
  - Automated alerts for overdue/at-risk tasks; immutable audit trail for status changes

**Section sources**
- [database-project-tasks.sql](file://src/database-project-tasks.sql)
- [database-unified-tasks.sql](file://src/database-unified-tasks.sql)
- [useMilestones.ts](file://src/hooks/useMilestones.ts)
- [TaskTimeTracking.tsx](file://src/components/tasks/TaskTimeTracking.tsx)
- [TaskComments.tsx](file://src/components/tasks/TaskComments.tsx)
- [TaskFileUploads.tsx](file://src/components/tasks/TaskFileUploads.tsx)
- [TaskNotifications.tsx](file://src/components/tasks/TaskNotifications.tsx)
- [TaskAuditLog.tsx](file://src/components/tasks/TaskAuditLog.tsx)

## Architecture Overview
The system follows a layered architecture:
- Data layer: SQL schemas define tasks, milestones, time logs, comments, files, and audit entries
- Service layer: Hooks and utilities compute progress, validate transitions, and manage search/filtering
- Presentation layer: Page orchestrates views; components render progress, status, and interactive features

```mermaid
sequenceDiagram
participant User as "User"
participant Page as "TasksPage.tsx"
participant View as "TaskBoardView.tsx"
participant Hook as "useMilestones.ts"
participant Utils as "task-progress-utils.ts"
participant DB as "database-project-tasks.sql"
participant Audit as "TaskAuditLog.tsx"
User->>Page : Open Tasks page
Page->>Hook : Fetch tasks and milestones
Hook->>DB : Query tasks, milestones, time logs
DB-->>Hook : Raw data
Hook->>Utils : Compute progress and flags
Utils-->>Hook : Computed metrics
Hook-->>View : Enriched tasks
View-->>User : Render board with progress/status
User->>View : Change status
View->>Hook : Update status
Hook->>DB : Persist change
Hook->>Audit : Log transition
Audit-->>User : Show audit entry
```

**Diagram sources**
- [TasksPage.tsx](file://src/pages/TasksPage.tsx)
- [TaskBoardView.tsx](file://src/components/tasks/TaskBoardView.tsx)
- [useMilestones.ts](file://src/hooks/useMilestones.ts)
- [task-progress-utils.ts](file://src/lib/followup/task-progress-utils.ts)
- [database-project-tasks.sql](file://src/database-project-tasks.sql)
- [TaskAuditLog.tsx](file://src/components/tasks/TaskAuditLog.tsx)

## Detailed Component Analysis

### Status Definitions and Completion Criteria
- Status values:
  - Typical statuses include Draft, In Progress, Review, Blocked, Completed, Cancelled
  - Each status has specific meaning and allowed transitions
- Completion criteria:
  - A task completes when all required subtasks/milestones are done, time logged meets thresholds, and no blockers remain
  - Type-specific rules may require approvals or attachments before completion

```mermaid
flowchart TD
Start(["Start"]) --> Validate["Validate Transition Rules"]
Validate --> Allowed{"Allowed?"}
Allowed --> |No| Reject["Reject Change<br/>Log Reason"]
Allowed --> |Yes| Apply["Apply New Status"]
Apply --> CheckCriteria{"Completion Criteria Met?"}
CheckCriteria --> |No| Continue["Keep Current Status"]
CheckCriteria --> |Yes| Complete["Mark Completed"]
Continue --> End(["End"])
Complete --> End
Reject --> End
```

**Diagram sources**
- [task-status-validation.ts](file://src/lib/followup/task-status-validation.ts)
- [database-project-tasks.sql](file://src/database-project-tasks.sql)

**Section sources**
- [task-status-validation.ts](file://src/lib/followup/task-status-validation.ts)
- [database-project-tasks.sql](file://src/database-project-tasks.sql)

### Progress Calculation Methods
- Weighted contributions:
  - Subtasks, milestones, time logged, and activity signals contribute to an aggregate percentage
- Formulas:
  - Base progress = sum(weight_i * completion_i) / total_weight
  - Adjustments for time spent vs planned hours and activity density
- Real-time updates:
  - On comment creation or file upload, recalculate progress if configured

```mermaid
flowchart TD
Enter(["Enter Progress Calc"]) --> Gather["Gather Inputs:<br/>Subtasks, Milestones, Time Logs, Activities"]
Gather --> Weights["Apply Weights per Input Type"]
Weights --> Sum["Compute Weighted Sum"]
Sum --> Normalize["Normalize to Percentage"]
Normalize --> Thresholds{"Exceeds Thresholds?"}
Thresholds --> |Yes| AutoUpdate["Auto-update Status/Flags"]
Thresholds --> |No| Keep["Keep Current State"]
AutoUpdate --> Exit(["Exit"])
Keep --> Exit
```

**Diagram sources**
- [task-progress-utils.ts](file://src/lib/followup/task-progress-utils.ts)
- [database-project-tasks.sql](file://src/database-project-tasks.sql)

**Section sources**
- [task-progress-utils.ts](file://src/lib/followup/task-progress-utils.ts)
- [database-project-tasks.sql](file://src/database-project-tasks.sql)

### Time Tracking Integration
- Time logs:
  - Entries record duration, start/end times, and notes
  - Cumulative logged hours feed into progress calculations
- Integration points:
  - TaskTimeTracking component manages CRUD operations
  - Updates trigger recalculations via progress utilities

```mermaid
sequenceDiagram
participant User as "User"
participant TT as "TaskTimeTracking.tsx"
participant DB as "database-project-tasks.sql"
participant Utils as "task-progress-utils.ts"
participant View as "TaskProgressIndicator.tsx"
User->>TT : Add time log
TT->>DB : Insert time log
DB-->>TT : Confirm
TT->>Utils : Recalculate progress
Utils-->>TT : New progress %
TT->>View : Update indicator
View-->>User : Reflect updated progress
```

**Diagram sources**
- [TaskTimeTracking.tsx](file://src/components/tasks/TaskTimeTracking.tsx)
- [database-project-tasks.sql](file://src/database-project-tasks.sql)
- [task-progress-utils.ts](file://src/lib/followup/task-progress-utils.ts)
- [TaskProgressIndicator.tsx](file://src/components/tasks/TaskProgressIndicator.tsx)

**Section sources**
- [TaskTimeTracking.tsx](file://src/components/tasks/TaskTimeTracking.tsx)
- [database-project-tasks.sql](file://src/database-project-tasks.sql)
- [task-progress-utils.ts](file://src/lib/followup/task-progress-utils.ts)
- [TaskProgressIndicator.tsx](file://src/components/tasks/TaskProgressIndicator.tsx)

### Milestone Marking
- Milestones:
  - Represent key deliverables or phases within a project
  - Completion contributes to project-level progress
- Hook usage:
  - useMilestones provides fetching and updating milestones
  - Milestone completion triggers progress recalculation

```mermaid
classDiagram
class Milestone {
+id
+title
+due_date
+completed
+project_id
+completion_weight
}
class UseMilestones {
+fetchMilestones(projectId)
+markCompleted(milestoneId)
+recalculateProjectProgress()
}
class TaskProgressIndicator {
+renderProgress(task)
+updateOnMilestoneChange()
}
UseMilestones --> Milestone : "manages"
UseMilestones --> TaskProgressIndicator : "updates"
```

**Diagram sources**
- [useMilestones.ts](file://src/hooks/useMilestones.ts)
- [TaskProgressIndicator.tsx](file://src/components/tasks/TaskProgressIndicator.tsx)

**Section sources**
- [useMilestones.ts](file://src/hooks/useMilestones.ts)
- [TaskProgressIndicator.tsx](file://src/components/tasks/TaskProgressIndicator.tsx)

### Progress Visualization Across Views
- Board view:
  - Cards show status badges and compact progress bars
- List view:
  - Rows display detailed progress and time summaries
- Calendar view:
  - Events highlight overdue and at-risk tasks
- Gantt view:
  - Bars represent planned vs actual durations with progress overlays

```mermaid
graph TB
V_Board["TaskBoardView.tsx"] --> Ind["TaskProgressIndicator.tsx"]
V_List["TaskListView.tsx"] --> Ind
V_Calendar["TaskCalendarView.tsx"] --> Ind
V_Gantt["TaskGanttView.tsx"] --> Ind
Ind --> Badge["TaskStatusBadge.tsx"]
```

**Diagram sources**
- [TaskBoardView.tsx](file://src/components/tasks/TaskBoardView.tsx)
- [TaskListView.tsx](file://src/components/tasks/TaskListView.tsx)
- [TaskCalendarView.tsx](file://src/components/tasks/TaskCalendarView.tsx)
- [TaskGanttView.tsx](file://src/components/tasks/TaskGanttView.tsx)
- [TaskProgressIndicator.tsx](file://src/components/tasks/TaskProgressIndicator.tsx)
- [TaskStatusBadge.tsx](file://src/components/tasks/TaskStatusBadge.tsx)

**Section sources**
- [TaskBoardView.tsx](file://src/components/tasks/TaskBoardView.tsx)
- [TaskListView.tsx](file://src/components/tasks/TaskListView.tsx)
- [TaskCalendarView.tsx](file://src/components/tasks/TaskCalendarView.tsx)
- [TaskGanttView.tsx](file://src/components/tasks/TaskGanttView.tsx)
- [TaskProgressIndicator.tsx](file://src/components/tasks/TaskProgressIndicator.tsx)
- [TaskStatusBadge.tsx](file://src/components/tasks/TaskStatusBadge.tsx)

### Automated Progress Updates from Related Activities
- Comments:
  - New comments can incrementally increase progress if configured
- File uploads:
  - Attachments signal work artifacts; progress adjusts accordingly
- Notifications:
  - Alerts for overdue or at-risk tasks based on due dates and progress trends

```mermaid
sequenceDiagram
participant User as "User"
participant Comments as "TaskComments.tsx"
participant Files as "TaskFileUploads.tsx"
participant Utils as "task-progress-utils.ts"
participant Notif as "TaskNotifications.tsx"
participant DB as "database-project-tasks.sql"
User->>Comments : Post comment
Comments->>DB : Save comment
Comments->>Utils : Trigger recalculation
Utils-->>Comments : Updated progress
Comments-->>Notif : Evaluate risk/overdue
Notif-->>User : Send notification if needed
User->>Files : Upload file
Files->>DB : Save file metadata
Files->>Utils : Trigger recalculation
Utils-->>Files : Updated progress
Files-->>Notif : Evaluate risk/overdue
Notif-->>User : Send notification if needed
```

**Diagram sources**
- [TaskComments.tsx](file://src/components/tasks/TaskComments.tsx)
- [TaskFileUploads.tsx](file://src/components/tasks/TaskFileUploads.tsx)
- [task-progress-utils.ts](file://src/lib/followup/task-progress-utils.ts)
- [TaskNotifications.tsx](file://src/components/tasks/TaskNotifications.tsx)
- [database-project-tasks.sql](file://src/database-project-tasks.sql)

**Section sources**
- [TaskComments.tsx](file://src/components/tasks/TaskComments.tsx)
- [TaskFileUploads.tsx](file://src/components/tasks/TaskFileUploads.tsx)
- [task-progress-utils.ts](file://src/lib/followup/task-progress-utils.ts)
- [TaskNotifications.tsx](file://src/components/tasks/TaskNotifications.tsx)
- [database-project-tasks.sql](file://src/database-project-tasks.sql)

### Custom Progress Indicators and Reporting
- Custom indicators:
  - Reusable component renders percentage, color-coded status, and tooltips
- Reporting:
  - Aggregated metrics across tasks and milestones for dashboards
  - Exportable summaries for stakeholders

```mermaid
classDiagram
class TaskProgressIndicator {
+percentage
+status
+tooltip
+render()
}
class Reporting {
+aggregateTasks(tasks)
+exportSummary()
}
TaskProgressIndicator --> Reporting : "feeds metrics"
```

**Diagram sources**
- [TaskProgressIndicator.tsx](file://src/components/tasks/TaskProgressIndicator.tsx)

**Section sources**
- [TaskProgressIndicator.tsx](file://src/components/tasks/TaskProgressIndicator.tsx)

### Audit Trails for Status Changes
- Audit entries:
  - Immutable records capture who changed status, when, and why
- Access:
  - Dedicated component displays history and supports filtering

```mermaid
sequenceDiagram
participant User as "User"
participant View as "TaskBoardView.tsx"
participant Hook as "useMilestones.ts"
participant Audit as "TaskAuditLog.tsx"
participant DB as "database-project-tasks.sql"
User->>View : Change status
View->>Hook : Persist change
Hook->>DB : Update task
Hook->>Audit : Create audit entry
Audit-->>User : Display history
```

**Diagram sources**
- [TaskBoardView.tsx](file://src/components/tasks/TaskBoardView.tsx)
- [useMilestones.ts](file://src/hooks/useMilestones.ts)
- [TaskAuditLog.tsx](file://src/components/tasks/TaskAuditLog.tsx)
- [database-project-tasks.sql](file://src/database-project-tasks.sql)

**Section sources**
- [TaskBoardView.tsx](file://src/components/tasks/TaskBoardView.tsx)
- [useMilestones.ts](file://src/hooks/useMilestones.ts)
- [TaskAuditLog.tsx](file://src/components/tasks/TaskAuditLog.tsx)
- [database-project-tasks.sql](file://src/database-project-tasks.sql)

## Dependency Analysis
Key dependencies and relationships:
- Database schemas underpin all components and hooks
- Hooks centralize data access and computation
- Components depend on hooks and utilities for consistent behavior
- Notifications and audit rely on computed progress and status transitions

```mermaid
graph TB
DB["database-project-tasks.sql"] --> Hook["useMilestones.ts"]
DB --> Search["useTaskSearch.ts"]
Hook --> Board["TaskBoardView.tsx"]
Hook --> List["TaskListView.tsx"]
Hook --> Calendar["TaskCalendarView.tsx"]
Hook --> Gantt["TaskGanttView.tsx"]
Utils["task-progress-utils.ts"] --> Board
Utils --> List
Utils --> Calendar
Utils --> Gantt
Validation["task-status-validation.ts"] --> Board
Validation --> List
Notification["TaskNotifications.tsx"] --> Utils
Audit["TaskAuditLog.tsx"] --> DB
```

**Diagram sources**
- [database-project-tasks.sql](file://src/database-project-tasks.sql)
- [useMilestones.ts](file://src/hooks/useMilestones.ts)
- [useTaskSearch.ts](file://src/hooks/useTaskSearch.ts)
- [TaskBoardView.tsx](file://src/components/tasks/TaskBoardView.tsx)
- [TaskListView.tsx](file://src/components/tasks/TaskListView.tsx)
- [TaskCalendarView.tsx](file://src/components/tasks/TaskCalendarView.tsx)
- [TaskGanttView.tsx](file://src/components/tasks/TaskGanttView.tsx)
- [task-progress-utils.ts](file://src/lib/followup/task-progress-utils.ts)
- [task-status-validation.ts](file://src/lib/followup/task-status-validation.ts)
- [TaskNotifications.tsx](file://src/components/tasks/TaskNotifications.tsx)
- [TaskAuditLog.tsx](file://src/components/tasks/TaskAuditLog.tsx)

**Section sources**
- [database-project-tasks.sql](file://src/database-project-tasks.sql)
- [useMilestones.ts](file://src/hooks/useMilestones.ts)
- [useTaskSearch.ts](file://src/hooks/useTaskSearch.ts)
- [TaskBoardView.tsx](file://src/components/tasks/TaskBoardView.tsx)
- [TaskListView.tsx](file://src/components/tasks/TaskListView.tsx)
- [TaskCalendarView.tsx](file://src/components/tasks/TaskCalendarView.tsx)
- [TaskGanttView.tsx](file://src/components/tasks/TaskGanttView.tsx)
- [task-progress-utils.ts](file://src/lib/followup/task-progress-utils.ts)
- [task-status-validation.ts](file://src/lib/followup/task-status-validation.ts)
- [TaskNotifications.tsx](file://src/components/tasks/TaskNotifications.tsx)
- [TaskAuditLog.tsx](file://src/components/tasks/TaskAuditLog.tsx)

## Performance Considerations
- Batch updates:
  - Group multiple progress-related mutations to reduce re-renders
- Efficient queries:
  - Use selective fields and indexes for tasks, milestones, and time logs
- Memoization:
  - Cache computed progress results where appropriate
- Lazy loading:
  - Load heavy views (Gantt) lazily to improve initial load time

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- Status transition rejected:
  - Check validation rules and ensure prerequisites are met
- Progress not updating:
  - Verify that activity events (comments/files) trigger recalculation
- Overdue notifications missing:
  - Confirm due date logic and threshold settings
- Audit entries missing:
  - Ensure persistence and logging steps execute after status changes

**Section sources**
- [task-status-validation.ts](file://src/lib/followup/task-status-validation.ts)
- [task-progress-utils.ts](file://src/lib/followup/task-progress-utils.ts)
- [TaskNotifications.tsx](file://src/components/tasks/TaskNotifications.tsx)
- [TaskAuditLog.tsx](file://src/components/tasks/TaskAuditLog.tsx)

## Conclusion
The progress tracking and status management system integrates data, computation, and presentation layers to provide accurate, real-time insights into task health. By enforcing validation rules, computing weighted progress, and maintaining audit trails, the system ensures reliability and transparency. Visualizations across multiple views support diverse workflows, while automated notifications keep teams informed about risks and deadlines.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices
- Example custom progress indicator usage:
  - Reference path: [TaskProgressIndicator.tsx](file://src/components/tasks/TaskProgressIndicator.tsx)
- Example milestone marking flow:
  - Reference path: [useMilestones.ts](file://src/hooks/useMilestones.ts)
- Example project closure checklist integration:
  - Reference path: [useProjectClosureChecklist.ts](file://src/hooks/useProjectClosureChecklist.ts)
- Example project overview aggregation:
  - Reference path: [ProjectOverview.tsx](file://src/pages/ProjectOverview.tsx)

**Section sources**
- [TaskProgressIndicator.tsx](file://src/components/tasks/TaskProgressIndicator.tsx)
- [useMilestones.ts](file://src/hooks/useMilestones.ts)
- [useProjectClosureChecklist.ts](file://src/hooks/useProjectClosureChecklist.ts)
- [ProjectOverview.tsx](file://src/pages/ProjectOverview.tsx)