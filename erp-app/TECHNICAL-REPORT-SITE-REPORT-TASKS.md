# Technical Design Report: Site Reports ↔ Project Tasks Integration

**Author:** Junior Engineering Team  
**Date:** 2026-06-14  
**Status:** For Review  
**Audience:** Senior Design Engineering Team  
**Subject:** Current state analysis and feature proposal for unifying Site Reports, Project Tasks, and Work Stoppages in the MEP Project ERP

---

## 1. Executive Summary

The MEP Project application currently operates two major field-to-desk modules — **Site Reports** (daily field documentation) and **Project Tasks** (task lifecycle management) — as **completely independent systems**. There is no data-level or UI-level linkage between them. Work stoppages captured in daily site reports are free-text only, with no structured relationship to task records, blocking parties, or resolution tracking.

This report presents:
1. A full audit of the current UI, data model, and approval logic for both modules.
2. An analysis of existing cross-module links (meetings, issues).
3. Feature proposals to link Site Reports, Tasks, and Work Stoppages into a coherent project execution platform.
4. Scalability considerations supporting 100+ employeeorganisations and multi-company (2+) deployments.

**Key finding:** Integration is architecturally straightforward (both modules already share `organisation_id` and `project_id`), but requires coordinated schema changes, UI additions, and approval workflow alignment.

---

## 2. Module A: Site Reports — Current State

### 2.1 Purpose

Daily field logs capturing manpower, work carried out, progress, equipment, safety, quality, client requirements, and work stoppages. Primary users: site engineers, project managers.

### 2.2 Database Schema

**Main table:** `site_reports` (defined in `site_reports.sql`, `src/database-site-reports.sql`)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `organisation_id` | UUID | Multi-tenant org |
| `client_id` | UUID FK → `clients` | |
| `project_id` | UUID FK → `projects` | |
| `issue_id` | UUID FK → `issues` | Links from issue tracker |
| `report_date` | DATE | |
| `total_manpower`, `skilled_manpower`, `unskilled_manpower` | TEXT | |
| `start_time`, `end_time` | TEXT | |
| `planned_progress`, `actual_progress`, `percent_complete` | TEXT | |
| `equipment_on_site`, `breakdown_issues` | TEXT | |
| `toolbox_meeting`, `ppe_followed` | BOOLEAN | |
| `inspection_status` | TEXT | Enum: Yes/Pending/Not Required |
| `satisfied_percent` | TEXT | |
| `is_rework`, `rework_reason`, `rework_start`, `rework_end`, `rework_material_used`, `rework_total_manpower` | Mixed | |
| `doc_type`, `doc_no`, `received_signature` | TEXT | DC/INVOICE type |
| `quote_to_be_sent`, `mail_received` | BOOLEAN | |
| `pm_status` | TEXT | Draft/Pending/Pending Approval/Approved/Rejected/On Hold/Reported |
| `material_arrangement` | TEXT | |
| `is_filed`, `tools_locked`, `site_pictures_status` | Mixed | |
| `engineer_name`, `signature_date` | TEXT | |
| `created_at` | TIMESTAMPTZ | |

**Child tables (one-to-many from `site_reports.id`):**

| Table | Purpose |
|-------|---------|
| `sub_contractors` | Subcontractor labour rows per report |
| `work_carried_out` | Work items done today |
| `milestones_completed` | Milestones hit |
| `site_report_client_requirements` | Client requirements list |
| `site_report_work_plan_next_day` | Next day plan |
| `site_report_special_instructions` | Special instructions |
| `site_report_issues_faced` | Issues/solutions logged |
| `site_report_work_stoppages` | Phase H stoppage tracker |
| `site_report_photos` | Photo uploads |

**Critical absence:** No `task_id` column anywhere in the site reports schema or child tables.

### 2.3 Frontend — UI Architecture

**Primary file:** `src/pages/SiteReport.tsx` (~2626 lines)

**View modes:**
- `list` — Report list with filters, search, date bucketing (Today/Yesterday/This Week/Earlier), bulk actions, summary stats cards
- `create` / `edit` — Multi-section accordion form
- `view` — Read-only display

**List View UI:**
- Search bar, project filter, engineer filter, date range filter
- Summary cards: Total Reports, This Week, Filed Today, Engineers Active
- Grouped by date buckets with colored badges
- Row actions per report: View Details, Edit Report (locked after approval), Download PDF
- Bulk action bar (sticky top) for multi-select print/cancel
- Status badges with color coding: Approved/Reported (green), Pending Approval/Pending (amber), On Hold (purple), Draft (grey), Rejected (red)
- Lock icon on reports with status `Pending Approval`, `Approved`, or `Reported`

**Create/Edit Form (Accordion Sections):**

| Section | Fields |
|---------|--------|
| Identification | Client (select), Project (select), Date |
| Manpower | Total, Skilled, Unskilled, Start/End time, Subcontractor rows (name, count, start, end, subcontractor_id lookup) |
| Work & Milestones | Dynamic array: work carried out, milestones completed |
| Progress/Equipment/Safety/Quality/Rework | Progress %, equipment on site, toolbox meeting, PPE, inspection status, rework details |
| Logistics | Document type (INVOICE/DC), doc number, received signature |
| Client Requirements | Dynamic array, quote to be sent flag, mail received flag |
| Reporting Status | PM Status enum, material arrangement enum |
| Next Day Plan | Dynamic array |
| Special Instructions | Dynamic array |
| Issues Faced | Issue/solution pair rows |
| Documentation | Filed flag, tools locked flag, site pictures enum |
| Footer | Engineer name, signature date |

**Validation:** Zod schema `siteReportSchema` — required fields enforced on submit; `mode: 'onSubmit'` so no keystroke validation.

**Form State:** `useForm` with `react-hook-form` + `zodResolver`. Dynamic arrays managed via `useFieldArray`.

**Child Data Operations:** In `saveMutation` and `updateMutation`, all child records are **delete-all-then-reinsert** on edit, or parallel `insert` on create. This is a full-replace strategy per report.

### 2.4 Approval Workflow (Phase D)

**Trigger:** User checks "Submit for Approval" before saving.

**Flow (create mutation → onSuccess hook):**
1. Sets `pm_status` to `Pending Approval`.
2. Fetches list of approvable members via `SiteReportApprovalApi.listApprovableMembers(orgId)`.
3. User selects an approver from a dropdown.
4. On save, calls `SiteReportApprovalApi.createApprovalRequest({ reportId, approverId, organisationId, engineerId, engineerName, reportDate, clientName, projectName })`.
5. Approval request is stored separately (via `src/approvals/siteReportApproval.ts`).

**Locking:** Reports with status `Pending Approval`, `Approved`, or `Reported` are locked — edit is blocked with an error toast.

**Selected Approver State:** `selectedApproverId` and `submitForApproval` are local component state, cleared after successful submission.

### 2.5 Photo Upload (Phase G)

- Custom hook: `useSiteReportPhotos` (`src/hooks/useSiteReportPhotos.ts`)
- Upload flow: ensures bucket → uploads blob per pending photo → revokes pending on success/failure.
- Photos are separate from report data; fetched independently via `site_report_photos` table.

### 2.6 PDF Export

- Uses `@react-pdf/renderer` via `generateProGridSiteReportPdf()` (`src/pdf/proGridSiteReportPdf.ts`).
- Portrait A4 format; pulls limited subset of report data (subcontractors, work carried out, milestones, footer; no stoppages/photos currently in PDF).

### 2.7 Gaps in Current Site Reports

| Gap | Impact |
|-----|--------|
| No `task_id` foreign key | Cannot trace work back to scheduled tasks |
| Work stoppages are free-text only | Cannot aggregate or resolve against task delays |
| No task reference in "work carried out" | Cannot verify task completion from field |
| No task status sync | Task status must be updated manually by PM separately |
| PDF doesn't include stoppages | Incomplete field documentation |
| No task-centric dashboard view | Engineers cannot see "my tasks for today" in report context |

---

## 3. Module B: Project Tasks — Current State

### 3.1 Purpose

Unified task management for project execution: tasks, subtasks, milestones, dependencies, time logs, comments, attachments, custom fields. Supports Table, Board (Kanban), Gantt, and Calendar views.

### 3.2 Database Schema

**Primary file:** `src/database-unified-tasks.sql`

**Core tables:**

| Table | Key Columns |
|-------|-------------|
| `tasks` | `id`, `organisation_id`, `project_id`, `task_group_id`, `parent_task_id`, `task_no`, `title`, `description`, `task_type`, `status`, `priority`, `start_date`, `due_date`, `completed_date`, `duration_days`, `estimated_hours`, `actual_hours`, `assignee_ids[]`, `subcontractor_ids[]`, `reporter_id`, `approved_by_id`, `completion_percentage`, `tags[]`, `discipline`, `location`, `drawing_ref`, `wbs_code`, `is_following`, `is_archived` |
| `task_groups` | `id`, `organisation_id`, `project_id`, `name`, `description`, `color`, `start_date`, `due_date`, `is_collapsed`, `sort_order` |
| `task_dependencies` | `task_id`, `depends_on_id`, `dependency_type` (FS/SS/FF/SF), `lag_days` |
| `task_comments` | `task_id`, `user_id`, `content`, `mentions[]`, `parent_id` |
| `task_attachments` | `task_id`, `user_id`, `file_name`, `file_type`, `file_size`, `storage_path`, `thumbnail_path` |
| `task_time_logs` | `task_id`, `user_id`, `start_time`, `end_time`, `duration_minutes`, `description`, `billable` |
| `task_activity_log` | `task_id`, `user_id`, `action`, `old_value`, `new_value` |
| `task_custom_fields` | `organisation_id`, `field_name`, `field_type`, `options[]`, `is_required`, `sort_order` |
| `task_custom_field_values` | `task_id`, `custom_field_id`, value columns |

**Indexes on `tasks`:** `idx_tasks_project_id`, `idx_tasks_status`, `idx_tasks_parent_task_id`, `idx_tasks_due_date`, plus per-child table indexes.

**Statuses:** `not_started`, `in_progress`, `under_review`, `on_hold`, `completed`, `cancelled`  
**Priorities:** `low`, `medium`, `high`, `critical`  
**Task types:** `task`, `milestone`, `deliverable`, `inspection`, `rfi`, `ncr`  
**Disciplines:** `mechanical`, `electrical`, `plumbing`, `fire_protection`, `elv`, `civil`, `architectural`, `general`

**Dependency types (FS/SS/FF/SF)** modelled in `task_dependencies` with lag days.

### 3.3 Frontend — UI Architecture

**Primary file:** `src/components/tasks/ProjectTaskListView.tsx` (~1545 lines)

**View Switcher Tab Bar:** Table / Board / Gantt / Calendar (top toolbar, icon buttons).

**Table View (primary):**
- Toolbar: project name badge, status filter dropdown, group-by dropdown (task list / status / priority / none), view switcher, columns toggle, export, add task button
- Search: inline search input (task name, task no.)
- Resizable columns via drag handles on headers
- Drag-and-drop reordering (`@dnd-kit/core`, `closestCenter` collision) — dropping on another task makes it a subtask; dropping on group row changes group
- Group headers with collapse/expand
- Inline "add task" input at bottom of each group
- Subtask rows with indentation and add-subtask button (visible on parent row hover)
- Per-row actions: click opens `TaskEditDrawer`; inline rename; delete confirmation modal
- Sticky table headers

**Board View (`ProjectTaskBoard`):** Kanban columns by status (Not Started, In Progress, Under Review, On Hold, Completed) with drag-and-drop between columns.

**Gantt View (`ProjectTaskGantt`):** Timeline bars by task with date range rendering.

**Calendar View (`ProjectTaskCalendar`):** Date-grid with task indicators.

**Task Create Drawer (`TaskCreateDrawer`):** Slide-out drawer with fields: title, description, task type, status, priority, start/due dates, duration, estimated hours, assignees (user search), tags, discipline, location, drawing ref, WBS code, parent task selector.

**Task Edit Drawer (`TaskEditDrawer`):** Same as create but pre-filled; supports status change, assignee change, group change, deletion.

**Create Group Modal (`GroupCreateModal`):** Name, description, color, start/due dates.

**Mutations:**
- `createTaskMutation` — auto-generates `task_no` (max + 1 in project), inserts all fields
- `updateTaskMutation` — partial update by ID
- `deleteTaskMutation` — soft delete (`deleted_at` timestamp)
- `createGroupMutation` / `updateGroupMutation`

### 3.4 Types and Permissions

**File:** `src/components/tasks/types.ts`

Defines `Task`, `TaskGroup`, `TaskDependency`, `TaskComment`, `TaskAttachment`, `TaskTimeLog`, `TaskActivity`, `TaskCustomField`, `TaskCustomFieldValue`, plus input types, column configs, status/priority/type/discipline configs.

**Permission model (in-file constants, not yet enforced by backend RLS):**

| Role | Permissions |
|------|------------|
| admin | All |
| project_manager | All except delete? (actually includes delete in current config) |
| engineer | Read, create, update, change_status, add_comment, add_attachment, log_time, export, manage_views |
| supervisor | Read, create, update, assign, change_status, add_comment, add_attachment, log_time, bulk_edit, export, manage_views |
| viewer | Read, add_comment, export, manage_views |
| subcontractor | Read, update, change_status, add_comment, add_attachment, log_time, manage_views |

### 3.5 Gaps in Current Project Tasks

| Gap | Impact |
|-----|--------|
| No `site_report_id` column | Cannot see which daily report a task was executed in |
| No link from task to stoppages | Blocked tasks cannot surface known blockers |
| No "planned for date" field beyond `start_date`/`due_date` | Cannot say "this task is on today's site report" |
| No automatic task status update from report submission | Double-entry between report and task |
| No field-level cross-reference in task detail | Engineer can't see "this task was logged in report #123" |

---

## 4. Existing Cross-Module Linkages (What Works)

| From Module | To Module | Mechanism | Strength |
|-------------|----------|-----------|----------|
| Issues → Site Report | `issue_id` on `site_reports` | URL param `?issue_id=xxx&action=create` auto-fills client, project, and issues section | ✅ Working |
| Site Report → Issues | Issue detail page shows linked site reports | Query `site-reports` where `issue_id = current` | ✅ Working |
| Meetings → Tasks | `meeting_action_items.task_id` UUID FK | One meeting minute can generate a task record | ✅ Working |
| Projects → All | `project_id` present in site_reports, tasks, and most records | Project-centric filtering everywhere | ✅ Working |
| Organisations → All | `organisation_id` on every table | Multi-tenant RLS in place | ✅ Working |

**What does NOT exist:**
- Site Reports ↔ Tasks: zero direct linkage
- Work Stoppages ↔ Tasks: zero linkage (stoppages only reference `report_id`)
- Tasks ↔ Site Report Photos: no linkage
- Subcontractor Attendance ↔ Site Report Tasks: attendance is report-scoped only

---

## 5. Approval Flow Analysis

### 5.1 Site Report Approval

- **Initiated by:** Site engineer at time of save (checkbox + approver picker).
- **State transition:** Draft/Pending → `Pending Approval` → `Approved` / `Rejected`.
- **Locking:** Approved/Reported reports are locked against edit.
- **Implementation:** Frontend-only orchestration calling `SiteReportApprovalApi.createApprovalRequest()`. Backend RPC/table for approval requests likely in `src/approvals/siteReportApproval.ts`.
- **Notification:** No explicit notification mechanism visible in SiteReport.tsx (no email/SMS trigger in the save flow). Approval request creation is fire-and-forget with toast feedback.

### 5.2 Task-Related Approval

- **No built-in approval workflow in tasks.** Tasks change status freely based on user permissions.
- `approved_by_id` column exists on `tasks` but is **never populated** in the current codebase.
- No task-level approval UI or state machine.

### 5.3 General Approvals Engine

The application has a broader approvals module (`/approvals` route, `src/pages/Approvals.tsx`) and `database-approval-workflows-fix-fk.sql`, suggesting the approval framework is generic. Site Report approval appears to use this engine but Tasks do not.

---

## 6. Feature Proposal: Full Site Report ↔ Task ↔ Work Stoppage Integration

### 6.1 Goals

1. Engineers can select which tasks are being worked on when filing a daily site report.
2. Work stoppages in site reports are optionally linked to specific tasks.
3. Task status can be updated from the site report context (with approval).
4. Managers can see a unified project execution view: planned tasks vs. actual field execution vs. blockers.
5. Scales to 100+ employee organisations with multi-company (2+) support.

### 6.2 Proposed Schema Changes

#### A. Add `task_id` to `site_reports`

> **Migration example:**
> ```sql
> ALTER TABLE site_reports
>   ADD COLUMN IF NOT EXISTS primary_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL;
> CREATE INDEX IF NOT EXISTS idx_site_reports_primary_task ON site_reports(primary_task_id);
> ```

**Purpose:** The one "primary" task being executed on this report (optional, for quick context). Null allowed for general site reports.

#### B. Add `report_task_links` join table

> ```sql
> CREATE TABLE IF NOT EXISTS report_task_links (
>   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
>   organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
>   report_id UUID NOT NULL REFERENCES site_reports(id) ON DELETE CASCADE,
>   task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
>   status_during_report TEXT, -- snapshot of task status at time of report
>   completion_snapshot INT,    -- snapshot of completion_percentage
>   is_completed_in_report BOOLEAN DEFAULT FALSE,
>   created_at TIMESTAMPTZ DEFAULT NOW(),
>   UNIQUE(report_id, task_id)
> );
> ```

**Purpose:** Many-to-many — a report can cover multiple tasks; a task can appear in multiple reports. Stores execution snapshot for audit.

#### C. Add `task_id` to `site_report_work_stoppages`

> ```sql
> ALTER TABLE site_report_work_stoppages
>   ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES tasks(id) ON DELETE SET NULL;
> CREATE INDEX IF NOT EXISTS idx_sr_stoppages_task ON site_report_work_stoppages(task_id);
> ```

**Purpose:** Optionally link each stoppage to a specific task. Null means general site-level stoppage.

#### D. Add `last_site_report_id` and `last_report_date` to `tasks`

> ```sql
> ALTER TABLE tasks
>   ADD COLUMN IF NOT EXISTS last_site_report_id UUID REFERENCES site_reports(id) ON DELETE SET NULL,
>   ADD COLUMN IF NOT EXISTS last_report_date DATE;
> CREATE INDEX IF NOT EXISTS idx_tasks_last_report ON tasks(last_site_report_id);
> CREATE INDEX IF NOT EXISTS idx_tasks_last_report_date ON tasks(last_report_date);
> ```

**Purpose:** Reverse lookup: open a task and see the most recent report it appeared in. The `last_report_date` column is the primary discriminator for "Reported Today" badges and for preventing stale overwrites (see §6.4 Write-path rule below). `last_site_report_id` is kept as the FK for navigation, but `last_report_date` drives all date comparisons.

#### E. Add `is_site_report_initiated` flag on tasks (optional)

A boolean flag `is_site_report_initiated` on `tasks` to indicate that the task was created from the site report "Add Task" quick action.

### 6.3 Proposed UI Changes

#### 6.3.1 Site Report — Task Selector Section

**Location:** New accordion section in `SiteReport.tsx`, between "Work Carried Out" and "Progress".

**Fields:**
- **Primary Task** (optional): Searchable dropdown of project tasks (`tasks` table filtered by `project_id` and `organisation_id`). Single-select. Shows task no., title, status badge, assignee.
- **Tasks Covered Today** (dynamic multi-select): Same searchable dropdown but multi-select. User picks all tasks that had field work today.
- **Per selected task:** Show current status + completion % (read-only snapshot); allow inline status suggestion (e.g., "Promote to In Progress" — applied on save with `submitForApproval` flow).

**UI Pattern:** Matches existing searchable dropdown pattern from `DESIGN.md` (BOMEditor material dropdown). Use `.dropdown-container` class and click-outside handler.

**State management:**
- `primaryTaskId: string | null`
- `coveredTaskIds: string[]`
- Managed as regular `useState` in `SiteReport.tsx` alongside existing state.
- Saved in `saveMutation` / `updateMutation` after the main report insert/update:
  1. Delete any existing `report_task_links` for this report.
  2. Insert new links for primary + covered tasks.
  3. Set `site_reports.primary_task_id`.
  4. Update `tasks.last_site_report_id` for each covered task.

#### 6.3.2 Site Report — Work Stoppage → Task Link

**Location:** Existing "Work Stoppages" accordion section. Add a new column/field in each stoppage row.

**Field:** "Affected Task" (optional searchable dropdown). Same task selector, single-select per stoppage row.

**Visual indicator:** If a stoppage is linked to a task, show the task title + status badge inline in the stoppage row in the UI.

#### 6.3.3 Task Detail Drawer — Report History Tab

**File:** `src/components/tasks/TaskEditDrawer.tsx` (or a new right-side panel tab).

**New content:** "Site Report History" tab showing:
- Table of all site reports linking to this task (via `report_task_links`).
- Columns: Date, Report ID (short), PM Status, Work done (from work_carried_out child), Stoppages linked (with category, status).
- Latest report snapshot: status, completion % at time of report.
- Click row → navigate to `/site-reports?view=view&report_id=xxx`.

**Implementation:** New query in TaskEditDrawer:

```ts
useQuery({
  queryKey: ['task-site-reports', taskId],
  queryFn: async () => {
    const { data: links } = await supabase
      .from('report_task_links')
      .select(`
        id,
        report_id,
        status_during_report,
        completion_snapshot,
        is_completed_in_report,
        created_at,
        site_reports (
          id,
          report_date,
          pm_status,
          engineer_name
        )
      `)
      .eq('task_id', taskId)
      .order('created_at', { ascending: false })
      .limit(10);
    return links || [];
  }
});
```

**Pagination:** The `limit(10)` + "Load More" button avoids pulling unbounded history for long-lived tasks. The wildcard `site_reports(*)` is replaced with an explicit column list covering only the four visible fields; add `work_carried_out` via a separate batched query only when a row is expanded.

**Archived task display (reply point 4):** When a linked task has `is_archived = true` or `deleted_at IS NOT NULL`, render the row as "Archived task" with a badge. Do not re-join the `tasks` table for archived rows to avoid FK/RLS failures — the link itself carries enough context (status_during_report snapshot, completion_snapshot). The badge makes it clear the task is no longer in the active task list; this also covers tasks archived after being linked to historical reports.

**Cache key:** `['task-site-reports', taskId]`. After the RPC in §6.6 completes, invalidate this key for every `taskId` in `p_links` so the history tab refreshes immediately. The RPC itself does not need to do the invalidation; the calling component handles it alongside the existing `queryClient.invalidateQueries` calls already present in `saveMutation.onSuccess`.

#### 6.3.4 Task List — "Reported Today" Indicator

**In `ProjectTaskListView.tsx` table:**

- New column (optional in column toggle): "Last Report" — shows date of most recent linked site report.
- Row badge/highlight: if `last_report_date` equals today's date (compared in org-local timezone / IST, not UTC), show a green dot or "Today" badge. The `last_report_date` column (§6.2D) is the sole source of truth here — no join or second query needed.
- Click badge → navigate to the report.

**Implementation (reply point 2):** The query in `ProjectTaskListView.tsx` already fetches all task fields. Add `last_report_date` to the select alongside `last_site_report_id`. Compute the badge inline with a direct string comparison (no Date-object parsing):

```ts
const d = new Date();
const todayISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const isToday = last_report_date && last_report_date === todayISO;
```

**Why this over `isSameDay`:** `last_report_date` is a Postgres `DATE` column — it carries no timezone information. The previous fix used `new Date().toISOString().split('T')[0]`, but `toISOString()` converts to UTC first, so between midnight and 05:29 AM IST it returns *yesterday's* date — the exact failure mode this change was meant to prevent. Using `getFullYear()` / `getMonth()` / `getDate()` reads the browser's local calendar date directly, so both sides of the comparison are in the same timezone. For an org operating uniformly in IST, both strings will match on the same calendar day with no UTC-edge-case risk.

#### 6.3.5 Site Report PDF — Include Tasks & Stoppages

**In `src/pdf/proGridSiteReportPdf.ts`:**

- Add section "Tasks Covered Today" listing primary task + covered tasks with status at time of report.
- Expand stoppages section to show task link if present.

### 6.4 Workflow Changes

#### A. Creating a Report from a Task (Contextual Entry)

**New URL pattern:** `/site-reports?task_id=xxx&action=create`

**Behavior:**
1. Navigation from Task Edit Drawer: new button "Create Daily Report for This Task".
2. `SiteReport.tsx` reads `task_id` URL param.
3. Pre-fills:
   - `project_id` from task
   - `primaryTaskId` from task
   - Adds task to `coveredTaskIds`
   - Optionally pre-fills `workCarriedOut` with task title
4. Remaining form fields blank for engineer to fill.

**Code change in `SiteReport.tsx` (`useEffect` near `issueIdParam`):**
```ts
const taskIdParam = searchParams.get('task_id');
// Similar to linked issue handling:
useEffect(() => {
  if (taskIdParam && view === 'create') {
    // Fetch task to get project_id, title
    // Set primaryTaskId, coveredTaskIds
    // Optionally set projectName in form
  }
}, [taskIdParam, view]);
```

#### B. Submitting a Report with Task Status Update

**Toggle:** In create/edit form, optional checkbox "Update task status from this report".

**Behavior when checked:**
- On save, after report is inserted:
  - For each covered task where `is_completed_in_report = true`, set `status = 'completed'`, `completed_date = report_date`.
  - For primary task, if `completion_percentage` was entered in report, update task's `completion_percentage`.
  - All updates go through existing `updateTaskMutation` or a new RPC batch update (to avoid N+1).

**Approval consideration:** Status updates requiring approval should follow the existing approval flow. Suggested: if `submitForApproval` is true AND "Update task status" is checked, require a separate approval step or include task status change as part of the site report approval request.

**Write-path rule (reply point 1):** The RPC must conditionally update `last_site_report_id` / `last_report_date` — never overwrite with a stale report. Pseudocode inside the RPC:
```sql
UPDATE tasks
SET
  last_site_report_id = v_report_id,
  last_report_date = p_report_date
WHERE id = l.task_id
  AND (
    last_report_date IS NULL
    OR p_report_date >= last_report_date
  );
```
This single `WHERE` clause guarantees that a backfilled or late-edited report (e.g., a report from last week edited today) cannot overwrite a task's `last_report_date` that already reflects a more recent submission. Engineers editing old reports post-facto will not break "Reported Today" badges for currently-active tasks.

### 6.5 Report Lock Carve-Out for Link Corrections

**Current behavior:** Reports with `pm_status` in (`Pending Approval`, `Approved`, `Reported`) are fully locked — the edit form is disabled and throws an error toast.

**Required addition (reply point 5):** Even locked reports must allow a narrowly-scoped correction to task and stoppage links, because PMs regularly discover post-approval that a task was mislinked or a stoppage was attributed to the wrong activity. Unlocking the full report for this is disproportionate.

**Proposed solution:**

1. **New RPC:** `update_report_task_links(p_report_id, p_links JSONB, p_stoppage_updates JSONB)`
   - Permitted to callers with `admin` or `project_manager` role regardless of `pm_status`.
   - Performs the same delete-then-insert logic on `report_task_links` and updates `task_id` on `site_report_work_stoppages`, but does **not** touch any other column on `site_reports` (so the lock record itself is never opened).
   - Writes an entry to `task_activity_log` per affected task: `action = 'link_corrected'`, `old_value`/`new_value` recording which tasks were added/removed from the report.

2. **UI entry point:** In the Task Edit Drawer's "Site Report History" tab, add a small "Correct links" button visible only to PM/admin roles. Opens a mini-editor (multi-select for covered tasks, per-stoppage dropdown) that calls `update_report_task_links` directly. The main report form remains inaccessible for locked reports.

3. **Audit trail:** Every call to `update_report_task_links` logs to `task_activity_log` with `action = 'link_corrected'`. This ensures the correction itself is visible in the report history and in the task's activity stream without re-opening the approval.

4. **RLS:** The RPC uses `SECURITY DEFINER` and checks the caller's role via `auth.uid()` joined to `org_members.role`, so it cannot be bypassed by a regular engineer.

### 6.6 Server-Side Task Picker Search + Shared `TaskLinkSelector` Component

**Problem (reply point 6):** The BOMEditor-style searchable dropdown (`DESIGN.md` pattern) loads the full list client-side and filters in-browser. For the task picker, projects can accumulate 100+ tasks over their lifecycle, making client-side filtering sluggish and making it impossible to filter by `is_archived` / `deleted_at` at the data layer.

**Solution:**

Replace the in-browser filter with a debounced server-side search. The picker calls a new helper:

```ts
// src/hooks/useTaskSearch.ts
const { data: taskOptions } = useQuery({
  queryKey: ['task-search', organisationId, projectId, searchTerm],
  queryFn: async () => {
    if (!searchTerm || searchTerm.length < 2) return [];
    const { data } = await supabase
      .from('tasks')
      .select('id, task_no, title, status, completion_percentage, is_archived, deleted_at')
      .eq('organisation_id', organisationId)
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .eq('is_archived', false)
      .or(`title.ilike.%${searchTerm}%,task_no.ilike.%${searchTerm}%`)
      .order('task_no', { ascending: true })
      .limit(20);
    return data || [];
  },
  enabled: searchTerm.length >= 2,
});
```

Key design decisions:
- **Minimum 2 characters** before firing the query (reduces noise).
- **`is_archived = false AND deleted_at IS NULL`** filter at the data layer — guarantees archived/removed tasks never surface in any picker (reply point 4).
- **Result cap 20** — enough for autocomplete UX without DOM bloat.
- **Debounce 200ms** on the input `onChange` handler before setting `searchTerm`.

**Shared `TaskLinkSelector` component (reply point 7):**

All three picker instances — Primary Task (single-select), Tasks Covered Today (multi-select), and per-stoppage "Affected Task" (single-select) — share the same UI shape (search input + dropdown list). Extract into:

```
src/components/tasks/TaskLinkSelector.tsx
```

Props:
| Prop | Type | Purpose |
|------|------|---------|
| `organisationId` | `string` | RLS + filter |
| `projectId` | `string` | Filter to project |
| `value` | `string \| string[]` | Current selection |
| `onChange` | `(val) => void` | Selection callback |
| `mode` | `'single' \| 'multi'` | Single or multi-select |
| `placeholder` | `string` | Label |
| `disabled` | `boolean` | Disable for locked reports |

Behavior:
- Single mode: renders one selected pill + search input. Dropdown shows up to 20 results.
- Multi mode: renders selected pills + search input. Dropdown shows unselected matching tasks with a "+" affordance.
- Both modes use the same `useTaskSearch` hook internally; callers don't need to manage the query themselves.
- All three call sites (§6.3.1, §6.3.2) become `<TaskLinkSelector />` instances — single source of truth for the archived-task filter and server-side search pattern.

**Pre-selected values — label resolution (reply point 4):**

When `value` contains task IDs already stored from a prior save (e.g., editing an existing report), those IDs must render as pills even if the task has since been archived. `useTaskSearch` filters out archived tasks, so a separate resolution query is required:

```ts
// Inside TaskLinkSelector.tsx
const selectedIds = useMemo(() => {
  const arr = Array.isArray(value) ? value : (value ? [value] : []);
  return arr.filter((id): id is string => Boolean(id));
}, [value]);

const { data: selectedTasks = [] } = useQuery({
  queryKey: ['task-link-labels', organisationId, selectedIds],
  queryFn: async () => {
    if (selectedIds.length === 0) return [];
    const { data } = await supabase
      .from('tasks')
      .select('id, task_no, title, is_archived, deleted_at')
      .eq('organisation_id', organisationId)
      .in('id', selectedIds);
    return data || [];
  },
  // No is_archived / deleted_at filter here — we WANT these rows to resolve labels
  enabled: selectedIds.length > 0,
});
```

Render logic for each pill:
```tsx
{selectedTasks.map(t => {
  const isArchived = t.is_archived || t.deleted_at;
  return (
    <span key={t.id} className={isArchived ? 'pill-archived' : 'pill-active'}>
      {t.task_no} — {t.title}
      {isArchived && <Badge variant="secondary">Archived</Badge>}
    </span>
  );
})}
```

`isArchived` pills use a muted style (grey background, "Archived" badge) to match the "Archived" badge convention in §6.3.3. The search dropdown still uses `useTaskSearch` (which filters archived tasks), so archived tasks never appear as new options but remain visible as pre-existing selections. This is consistent with how task history tabs render archived links.

### 6.7 Cache Invalidation Strategy

**Problem (reply point 8):** After `create_site_report_with_tasks` succeeds, the new link is not visible in any already-open Task Drawer or task list until the react-query stale time expires (2–5 minutes as currently configured).

**Required invalidation in `saveMutation.onSuccess`:**
```ts
// After the RPC call succeeds and report is returned:
const linkedTaskIds = (coveredTaskIds || []).filter(Boolean);
linkedTaskIds.forEach(taskId => {
  queryClient.invalidateQueries({ queryKey: ['task-site-reports', taskId] });
  // Invalidate project task list for each unique project of linked tasks
  queryClient.invalidateQueries({ queryKey: ['project-tasks', projectIdOf(taskId)] });
});
```

For the `update_report_task_links` carve-out RPC (§6.5), the same invalidation pattern applies in its caller (the mini-editor in the Task Edit Drawer). The RPC itself does not call `invalidateQueries` (it is a plain SQL function), but the React component invoking it must.

**Summary of query keys to invalidate on link mutations:**
| Key pattern | When |
|------------|------|
| `['task-site-reports', taskId]` | Any time a link is added/removed for that task — invalidates the Report History tab |
| `['project-tasks', projectId]` | Any time covered tasks change — invalidates the task list so the "Last Report" column refreshes |
| `['site-reports', orgId]` | Already done in current `saveMutation.onSuccess` — keep |

---

---

### 6.10 RLS and Multi-Tenant Considerations for 100+ Employees

| Consideration | Current State | Required Change |
|--------------|---------------|-----------------|
| `organisation_id` on all tables | ✅ Present on both modules | None needed — new tables inherit same pattern |
| RLS policies | ✅ `current_org_id()` helper used | Replicate same pattern for `report_task_links` and `site_report_work_stoppages.task_id` changes |
| Query performance at scale | site_reports has indexes on org, project, client, date | Add index on `report_task_links(report_id)`, `report_task_links(task_id)`, `site_report_work_stoppages(task_id)` |
| Concurrent approval writes | No optimistic locking on site_reports | Consider `version` column on site_reports for concurrent edit detection (currently not present) |
| Multi-company (2+) | `organisations` table already supports this | No change needed; users switch org via `SelectOrganisation` in App.tsx. Ensure all new queries filter by `organisation?.id`. |
| Employee lookup for assignees | `user_profiles` joined in task queries | For 100+ employees, consider `assignee_ids[]` lookup performance — Supabase array operations are efficient but add an index on `tasks(assignee_ids)` if needed |

---

### 6.8 Backend / RPC Recommendations

Three RPCs are needed: `create_site_report_with_tasks` (create path), `update_site_report_with_tasks` (normal edit path for unlocked reports), and `update_report_task_links` (locked-report link-correction carve-out).

---

#### RPC 1 — `create_site_report_with_tasks`

Atomic create: report + links + task pointer updates in one call. The task pointer update uses the date-comparison rule from §6.4 to prevent stale overwrites:

```sql
CREATE OR REPLACE FUNCTION create_site_report_with_tasks(
  p_report JSONB,
  p_links JSONB           -- [{task_id, status_during_report, completion_snapshot, is_completed_in_report}]
  -- Note: stoppage→task links are set by the caller in the same transaction
  -- that inserts site_report_work_stoppages child rows (via the existing
  -- saveMutation child-insert path), passing task_id directly on each stoppage row.
  -- No separate stoppage_id-based UPDATE is needed here because on create the
  -- stoppage IDs do not yet exist.
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_report_id UUID;
  v_report_date DATE;
  v_org_id UUID;
  v_caller_id UUID;
  v_caller_role TEXT;
BEGIN
  SELECT user_id, role INTO v_caller_id, v_caller_role
  FROM org_members
  WHERE user_id = auth.uid()
    AND organisation_id = (p_report->>'organisation_id')::UUID
    AND (status = 'active' OR status = 'Active' OR status IS NULL)
  ORDER BY joined_at DESC LIMIT 1;

  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated or not an active member of this organisation';
  END IF;

  IF v_caller_role NOT IN ('admin', 'project_manager', 'engineer', 'supervisor') THEN
    RAISE EXCEPTION 'Role % is not permitted to create site reports', v_caller_role;
  END IF;

  v_org_id := (p_report->>'organisation_id')::UUID;
  v_report_date := (p_report->>'report_date')::DATE;

  INSERT INTO site_reports (
    organisation_id, client_id, project_id, issue_id, report_date,
    total_manpower, skilled_manpower, unskilled_manpower,
    start_time, end_time,
    planned_progress, actual_progress, percent_complete,
    equipment_on_site, breakdown_issues,
    toolbox_meeting, ppe_followed,
    inspection_status, satisfied_percent, rework_required_reason,
    is_rework, rework_reason, rework_start, rework_end,
    rework_material_used, rework_total_manpower,
    doc_type, doc_no, received_signature,
    quote_to_be_sent, mail_received,
    pm_status, material_arrangement,
    is_filed, tools_locked, site_pictures_status,
    engineer_name, signature_date,
    primary_task_id
  )
  VALUES (
    v_org_id,
    to_nullable_uuid(p_report->>'client_id'),
    to_nullable_uuid(p_report->>'project_id'),
    to_nullable_uuid(p_report->>'issue_id'),
    v_report_date,
    p_report->>'total_manpower', p_report->>'skilled_manpower', p_report->>'unskilled_manpower',
    p_report->>'start_time', p_report->>'end_time',
    p_report->>'planned_progress', p_report->>'actual_progress', p_report->>'percent_complete',
    p_report->>'equipment_on_site', p_report->>'breakdown_issues',
    (p_report->>'toolbox_meeting')::BOOLEAN, (p_report->>'ppe_followed')::BOOLEAN,
    p_report->>'inspection_status', p_report->>'satisfied_percent', p_report->>'rework_required_reason',
    (p_report->>'is_rework')::BOOLEAN, p_report->>'rework_reason',
    to_nullable_date(p_report->>'rework_start'), to_nullable_date(p_report->>'rework_end'),
    p_report->>'rework_material_used', p_report->>'rework_total_manpower',
    p_report->>'doc_type', p_report->>'doc_no', p_report->>'received_signature',
    (p_report->>'quote_to_be_sent')::BOOLEAN, (p_report->>'mail_received')::BOOLEAN,
    p_report->>'pm_status', p_report->>'material_arrangement',
    (p_report->>'is_filed')::BOOLEAN, (p_report->>'tools_locked')::BOOLEAN, p_report->>'site_pictures_status',
    p_report->>'engineer_name', p_report->>'signature_date',
    to_nullable_uuid(p_report->>'primary_task_id')
  )
  RETURNING id INTO v_report_id;

  -- Insert links; conditional task pointer update avoids stale overwrite
  INSERT INTO report_task_links (organisation_id, report_id, task_id, status_during_report, completion_snapshot, is_completed_in_report)
  SELECT
    v_org_id,
    v_report_id,
    (l->>'task_id')::UUID,
    l->>'status_during_report',
    (l->>'completion_snapshot')::INT,
    (l->>'is_completed_in_report')::BOOLEAN
  FROM jsonb_array_elements(p_links) AS l
  ON CONFLICT (report_id, task_id) DO UPDATE SET
    status_during_report = EXCLUDED.status_during_report,
    completion_snapshot  = EXCLUDED.completion_snapshot,
    is_completed_in_report = EXCLUDED.is_completed_in_report;

  UPDATE tasks
  SET
    last_site_report_id = v_report_id,
    last_report_date    = v_report_date
  WHERE id IN (SELECT (l->>'task_id')::UUID FROM jsonb_array_elements(p_links) AS l)
    AND organisation_id = v_org_id
    AND (
      last_report_date IS NULL
      OR v_report_date >= last_report_date
    );

  RETURN v_report_id;
END;
$$;
```

> **Note:** The helper functions `to_nullable_uuid` and `to_nullable_date` must exist (add them idempotently in the same migration) to safely translate empty strings to NULL from JSONB:
> ```sql
> CREATE OR REPLACE FUNCTION to_nullable_uuid(v TEXT)
> RETURNS UUID LANGUAGE sql IMMUTABLE AS $$
>   SELECT NULLIF(TRIM(BOTH FROM v), '');
> $$;
> CREATE OR REPLACE FUNCTION to_nullable_date(v TEXT)
> RETURNS DATE LANGUAGE sql IMMUTABLE AS $$
>   SELECT NULLIF(TRIM(BOTH FROM v), '');
> $$;
> ```

**Benefit:** Atomic — report + links + task pointer updates succeed or fail together. The date-comparison guard makes "most recent report" correct regardless of write order.

---

#### RPC 2 — `update_site_report_with_tasks`

Covers the normal edit path for non-locked reports (`Draft`, `Pending`, `Rejected`, `On Hold`). This is the counterpart to `create_site_report_with_tasks` for the `updateMutation` in `SiteReport.tsx`. It mirrors the create RPC's link insert and conditional task-pointer update, but as an UPDATE on `site_reports`. This directly resolves Risk #1 in §9 ("full-replace child data on edit drops link data").

```sql
CREATE OR REPLACE FUNCTION update_site_report_with_tasks(
  p_report_id UUID,
  p_report JSONB,
  p_links JSONB           -- [{task_id, status_during_report, completion_snapshot, is_completed_in_report}]
  -- Note: stoppage→task links are set by the caller in the same transaction
  -- that re-inserts site_report_work_stoppages child rows (per the existing
  -- full-replace child strategy in updateMutation), passing task_id directly
  -- on each stoppage row. No stoppage_id-based UPDATE is needed here because
  -- on edit the stoppage IDs are regenerated.
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_report_date DATE;
  v_caller_id UUID;
  v_caller_role TEXT;
  v_pm_status TEXT;
  v_org_id UUID;
BEGIN
  SELECT user_id, role INTO v_caller_id, v_caller_role
  FROM org_members
  WHERE user_id = auth.uid()
    AND organisation_id = (SELECT organisation_id FROM site_reports WHERE id = p_report_id)
    AND (status = 'active' OR status = 'Active' OR status IS NULL)
  ORDER BY joined_at DESC LIMIT 1;

  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated or not an active member of this organisation';
  END IF;

  IF v_caller_role NOT IN ('admin', 'project_manager', 'engineer', 'supervisor') THEN
    RAISE EXCEPTION 'Role % is not permitted to update site reports', v_caller_role;
  END IF;

  v_org_id := (SELECT organisation_id FROM site_reports WHERE id = p_report_id);
  v_report_date := (p_report->>'report_date')::DATE;

  SELECT pm_status INTO v_pm_status FROM site_reports WHERE id = p_report_id;

  IF v_pm_status IN ('Pending Approval', 'Approved', 'Reported') THEN
    RAISE EXCEPTION 'Report is locked (status: %). Use the link-correction tool instead.', v_pm_status;
  END IF;

  UPDATE site_reports SET
    client_id              = to_nullable_uuid(p_report->>'client_id'),
    project_id             = to_nullable_uuid(p_report->>'project_id'),
    issue_id               = to_nullable_uuid(p_report->>'issue_id'),
    report_date            = v_report_date,
    total_manpower         = p_report->>'total_manpower',
    skilled_manpower       = p_report->>'skilled_manpower',
    unskilled_manpower     = p_report->>'unskilled_manpower',
    start_time             = p_report->>'start_time',
    end_time               = p_report->>'end_time',
    planned_progress       = p_report->>'planned_progress',
    actual_progress        = p_report->>'actual_progress',
    percent_complete       = p_report->>'percent_complete',
    equipment_on_site      = p_report->>'equipment_on_site',
    breakdown_issues       = p_report->>'breakdown_issues',
    toolbox_meeting        = (p_report->>'toolbox_meeting')::BOOLEAN,
    ppe_followed           = (p_report->>'ppe_followed')::BOOLEAN,
    inspection_status      = p_report->>'inspection_status',
    satisfied_percent      = p_report->>'satisfied_percent',
    rework_required_reason = p_report->>'rework_required_reason',
    is_rework              = (p_report->>'is_rework')::BOOLEAN,
    rework_reason          = p_report->>'rework_reason',
    rework_start           = to_nullable_date(p_report->>'rework_start'),
    rework_end             = to_nullable_date(p_report->>'rework_end'),
    rework_material_used   = p_report->>'rework_material_used',
    rework_total_manpower  = p_report->>'rework_total_manpower',
    doc_type               = p_report->>'doc_type',
    doc_no                 = p_report->>'doc_no',
    received_signature     = p_report->>'received_signature',
    quote_to_be_sent       = (p_report->>'quote_to_be_sent')::BOOLEAN,
    mail_received          = (p_report->>'mail_received')::BOOLEAN,
    pm_status              = p_report->>'pm_status',
    material_arrangement   = p_report->>'material_arrangement',
    is_filed               = (p_report->>'is_filed')::BOOLEAN,
    tools_locked           = (p_report->>'tools_locked')::BOOLEAN,
    site_pictures_status   = p_report->>'site_pictures_status',
    engineer_name          = p_report->>'engineer_name',
    signature_date         = p_report->>'signature_date',
    primary_task_id        = to_nullable_uuid(p_report->>'primary_task_id')
  WHERE id = p_report_id;

  -- Replace links (matching current delete-then-reinsert child table strategy)
  DELETE FROM report_task_links WHERE report_id = p_report_id;

  INSERT INTO report_task_links (organisation_id, report_id, task_id, status_during_report, completion_snapshot, is_completed_in_report)
  SELECT
    v_org_id,
    p_report_id,
    (l->>'task_id')::UUID,
    l->>'status_during_report',
    (l->>'completion_snapshot')::INT,
    (l->>'is_completed_in_report')::BOOLEAN
  FROM jsonb_array_elements(p_links) AS l;

  -- Conditional task pointer update: only advance, never regress
  -- organisation_id filter prevents cross-tenant pointer writes
  UPDATE tasks
  SET
    last_site_report_id = p_report_id,
    last_report_date    = v_report_date
  WHERE id IN (SELECT (l->>'task_id')::UUID FROM jsonb_array_elements(p_links) AS l)
    AND organisation_id = v_org_id
    AND (
      last_report_date IS NULL
      OR v_report_date >= last_report_date
    );
END;
$$;
```

**Caller contract:** `updateMutation` in `SiteReport.tsx` calls this RPC for the report row and `report_task_links`. Stoppage rows are still inserted by the existing child-insert path in `updateMutation`; each `site_report_work_stoppages` row should include `task_id` directly in its INSERT payload (no separate stoppage_id-based UPDATE needed). `updateMutation.onSuccess` keeps its existing `queryClient.invalidateQueries` calls.

---

#### RPC 3 — `update_report_task_links`

Locked-report carve-out (§6.5): allows PM/admin to correct task/stoppage links on a `Pending Approval` / `Approved` / `Reported` report without reopening the full form. Writes to `task_activity_log` for audit.

```sql
CREATE OR REPLACE FUNCTION update_report_task_links(
  p_report_id UUID,
  p_links JSONB,           -- [{task_id, status_during_report, completion_snapshot, is_completed_in_report}]
  p_stoppage_updates JSONB -- [{stoppage_id, task_id}]
  -- caller identity checked via auth.uid() -> org_members.role inside the function
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org_id UUID;
  v_report_date DATE;
  v_caller_id UUID;
  v_caller_role TEXT;
  v_old_task_ids UUID[];
  v_new_task_ids UUID[];
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM org_members
    WHERE user_id = v_caller_id
      AND organisation_id = (
        SELECT organisation_id FROM site_reports WHERE id = p_report_id
      )
      AND (status = 'active' OR status = 'Active' OR status IS NULL)
  ) THEN
    RAISE EXCEPTION 'Caller is not a member of the report organisation';
  END IF;

  SELECT role INTO v_caller_role
  FROM org_members
  WHERE user_id = v_caller_id
    AND organisation_id = (
      SELECT organisation_id FROM site_reports WHERE id = p_report_id
    )
    AND (status = 'active' OR status = 'Active' OR status IS NULL)
  ORDER BY joined_at DESC LIMIT 1;

  IF v_caller_role NOT IN ('admin', 'project_manager') THEN
    RAISE EXCEPTION 'Only admin or project_manager can correct links on locked reports';
  END IF;

  SELECT organisation_id, report_date INTO v_org_id, v_report_date
  FROM site_reports WHERE id = p_report_id;

  -- Capture old set before deletion for audit diff
  SELECT coalesce(array_agg(task_id), '{}'::UUID[]) INTO v_old_task_ids
  FROM report_task_links
  WHERE report_id = p_report_id;

  -- Replace links
  DELETE FROM report_task_links WHERE report_id = p_report_id;

  INSERT INTO report_task_links (organisation_id, report_id, task_id, status_during_report, completion_snapshot, is_completed_in_report)
  SELECT
    v_org_id,
    p_report_id,
    (l->>'task_id')::UUID,
    l->>'status_during_report',
    (l->>'completion_snapshot')::INT,
    (l->>'is_completed_in_report')::BOOLEAN
  FROM jsonb_array_elements(p_links) AS l;

  -- Build new set for diffing
  SELECT coalesce(array_agg((l->>'task_id')::UUID), '{}'::UUID[]) INTO v_new_task_ids
  FROM jsonb_array_elements(p_links) AS l;

  -- Audit log only for tasks that actually changed:
  --   removed = in old set but not in new set
  --   added   = in new set but not in old set
  INSERT INTO task_activity_log (task_id, user_id, action, old_value, new_value, created_at)
  SELECT
    tid,
    v_caller_id,
    'link_removed',
    jsonb_build_object('report_id', p_report_id::TEXT),
    jsonb_build_object('report_id', p_report_id::TEXT),
    NOW()
  FROM (
    SELECT unnest(v_old_task_ids) AS tid
    EXCEPT
    SELECT unnest(v_new_task_ids)
  ) AS removed;

  INSERT INTO task_activity_log (task_id, user_id, action, old_value, new_value, created_at)
  SELECT
    tid,
    v_caller_id,
    'link_added',
    jsonb_build_object('report_id', p_report_id::TEXT),
    jsonb_build_object('report_id', p_report_id::TEXT),
    NOW()
  FROM (
    SELECT unnest(v_new_task_ids) AS tid
    EXCEPT
    SELECT unnest(v_old_task_ids)
  ) AS added;

  -- Apply stoppage→task links
  IF p_stoppage_updates IS NOT NULL AND jsonb_array_length(p_stoppage_updates) > 0 THEN
    UPDATE site_report_work_stoppages s
    SET task_id = (u->>'task_id')::UUID
    FROM jsonb_array_elements(p_stoppage_updates) AS u
    WHERE s.id = (u->>'stoppage_id')::UUID
      AND s.report_id = p_report_id;
  END IF;

  -- Conditional task pointer update: only advance, never regress
  -- organisation_id filter prevents cross-tenant pointer writes
  UPDATE tasks
  SET
    last_site_report_id = p_report_id,
    last_report_date    = v_report_date
  WHERE id IN (SELECT (l->>'task_id')::UUID FROM jsonb_array_elements(p_links) AS l)
    AND organisation_id = v_org_id
    AND (
      last_report_date IS NULL
      OR v_report_date >= last_report_date
    );
END;
$$;
```

**Caller contract:** The frontend calls this RPC directly (not through the `saveMutation` path). The RPC enforces role-based access server-side; the UI merely hides/shows the "Correct links" button based on the user's role.

---

### 6.9 Notification / Visibility

**New opportunities:**
- When a stoppage is linked to a task, the task assignee gets a notification (use existing notification system if present, or add a `task_notifications` table).
- When a report is submitted for approval, PM gets a notification highlighting covered tasks + pending stoppages.
- "My Tasks Today" dashboard widget: for logged-in engineer, show tasks where `last_site_report_id` is today's report, grouped by project.

---

## 7. Additional Observations

### 7.1 Code Quality Notes

| Area | Observation |
|------|-------------|
| **Soft-delete** | Tasks use `deleted_at`; Site Reports do not. Consistent soft-delete policy recommended. |
| **Derived state** | `summaryStats` and `groupedReports` in SiteReport are well-structured `useMemo`. Task list uses similar patterns in `filteredTasks`/`displayGroups`. |
| **Optimistic updates** | Site report list uses `onMutate` to prepend temp report. Tasks use simple invalidation. Consistent pattern possible. |
| **Zod validation** | Tasks module has no Zod schema (validation is implicit in DB + UI). Site Reports has full Zod. Bringing Zod to task create/update would tighten the contract. |
| **URL state** | Site Report supports `?issue_id=&action=` for deep linking. Task module does not use URL params for selected task. Adding `?taskId=` would improve shareability. |
| **PDF** | `proGridSiteReportPdf.ts` uses `@react-pdf/renderer`. Task PDF export would follow same library. |
| **Migration scripts** | 75+ SQL files in `supabase/migrations/`. New feature should follow `NNN_descriptive_name.sql` numbering convention (next: `075_` onwards). |
| **Feature plan tracking** | `featureplan.md` tracks 120+ features. The proposed integration touches: #12 Daily Tasks, #4 Complaints (issue linking), #6 Projects & Tenders. |

### 7.2 Scalability Notes

| Concern | Assessment |
|---------|------------|
| **100 employee org** | Supabase with proper indexes handles this comfortably. The main bottleneck is query fan-out: fetching tasks + profiles + links in parallel (current code already uses `Promise.all` for child fetches). |
| **2+ company org** | Multi-org already supported via `organisation_id`. New tables follow same pattern. No structural change needed. Just ensure all new UI components use `organisation?.id` from `useAuth()`. |
| **Query complexity** | Adding `report_task_links` introduces join queries. Use Supabase `.select('*, site_reports(*)')` on joins, and cache with `@tanstack/react-query` (already in use). Stale times: 2-5 min as currently configured. |
| **Concurrent edits** | If two engineers submit reports for the same task simultaneously, last-write-wins applies to `last_site_report_id`. Consider a task-level lock or optimistic version column for high-contention scenarios. |

---

## 8. Implementation Roadmap (Suggested)

### Phase 1: Schema Foundation
1. Create `report_task_links` table.
2. Add `primary_task_id` to `site_reports`.
3. Add `task_id` to `site_report_work_stoppages`.
4. Add `last_site_report_id` and `last_report_date` (DATE) to `tasks`.
5. Create indexes and RLS policies for all new tables.
6. Extract shared `TaskLinkSelector` component (single + multi mode) with `useTaskSearch` hook.
7. Write three RPCs in `supabase/migrations/075_report_task_integration.sql`:
   - `create_site_report_with_tasks` — atomic create + link insert + conditional task pointer (with date guard)
   - `update_site_report_with_tasks` — same logic for normal edit path (Draft/Pending/Rejected/On Hold)
   - `update_report_task_links` — SECURITY DEFINER carve-out for PM/admin on locked reports, with role check and `task_activity_log` audit
   Each RPC includes `auth.uid()` org-membership validation and `organisation_id` filters on every cross-table write.
8. Write idempotent migration script `supabase/migrations/075_report_task_integration.sql`.

### Phase 2: Site Report UI — Task Linking
1. Add Task Selector accordion section in `SiteReport.tsx` using `<TaskLinkSelector mode="single" />` (Primary Task) and `<TaskLinkSelector mode="multi" />` (Tasks Covered Today). Pass pre-selected values from `?task_id=` URL param.
2. Add stoppage→task dropdown in each stoppage row using `<TaskLinkSelector mode="single" />`.
3. Wire `saveMutation` to call `create_site_report_with_tasks` RPC; wire `updateMutation` to call `update_site_report_with_tasks` RPC. Pass `coveredTaskIds`, `primaryTaskId`, and stoppage `task_id` selections as `p_links` / `p_stoppage_updates`.
4. Add `?task_id=` URL param handling for contextual entry from the Task Edit Drawer.
5. Add `?task_id=` → fetch task, pre-fill `primaryTaskId`, `coveredTaskIds`, and `project_id`.

### Phase 3: Task UI — Report Visibility
1. Add "Last Report" column to `ProjectTaskListView.tsx` (toggleable) — reads `last_report_date` directly, no join needed.
2. "Today" badge compares `last_report_date` to a local-time `todayISO` string (not `toISOString()`).
3. Add "Site Report History" tab in `TaskEditDrawer` using scoped query (`report_date, pm_status, engineer_name` from `site_reports`, `limit(10)` + "Load More"). Render archived-tasks with "Archived" badge.
4. Add "Create Daily Report" button in `TaskEditDrawer` → navigates to `/site-reports?task_id=xxx&action=create`.
5. Add "Correct links" button in Report History tab (PM/admin only) → calls `update_report_task_links` for locked reports.

### Phase 4: PDF + Dashboard
1. Update `proGridSiteReportPdf.ts` to include tasks and stoppage links.
2. Add "My Tasks Today" widget to Dashboard.
3. Add "Stoppages by Task" aggregation in reports module.

### Phase 5: Approval + Notification Polish
1. Wire `update_report_task_links` carve-out into the UI for PM/admin link corrections on locked reports.
2. Add notification triggers when task-linked stoppages are created.
3. Add known-limit note: if an engineer removes a task from coveredTaskIds on edit, that task's `last_site_report_id`/`last_report_date` is not recomputed backward. Document as acceptable for v1; recompute step can be added if a task is found pointing at a report that no longer links to it.

---

## 9. Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|-----------|
| Cross-tenant data leak via SECURITY DEFINER RPCs | **High** (security) | Each RPC validates `auth.uid()` membership in `v_org_id` via `org_members`; every cross-table write includes `AND organisation_id = v_org_id`. Review required before merge — see §6.8 tenant-isolation note. |
| Full-replace child data on edit drops link data | **Resolved** | `update_site_report_with_tasks` RPC (RPC2) handles `report_task_links` delete/insert atomically alongside report UPDATE |
| Stale `last_report_date` overwrite from backfilled reports | **Resolved** | Conditional `WHERE last_report_date IS NULL OR v_report_date >= last_report_date` in all three RPCs |
| N+1 query on task list for `last_report_date` at 100+ employees | **Resolved** | `last_report_date` is a denormalized DATE column on `tasks`; "Today" badge reads it directly with index `idx_tasks_last_report_date` — zero join needed |
| Approval flow complexity if task status update is gated | Low-Medium | Keep task status update separate from site report approval by default; add opt-in toggle |
| Soft-delete inconsistency (tasks use `deleted_at`, reports don't) | Low | Add `deleted_at` to `site_reports` in same migration, or document as intentional |
| RLS policy gaps on new tables | Medium | Replicate policy pattern from `site_report_work_stoppages` exactly for `report_task_links` |
| Cross-tenant task pointer from edited report (pre-fix) | **Fixed** | `organisation_id = v_org_id` filter added to `UPDATE tasks` block in all three RPCs |
| "Today" badge UTC edge-case near midnight | **Fixed** | Local-time `todayISO` via `getFullYear()/getMonth()/getDate()` — no `toISOString()` |
| Link pointer not recomputed when task removed from report on edit | Low (v1 acceptable) | Documented known limitation in Phase 5. Recompute job can be added later if needed |

---

## 10. Appendix: File Reference

| File | Role |
|------|------|
| `src/pages/SiteReport.tsx` | Main site report page (~2626 lines) |
| `src/database-site-reports.sql` | Site reports base schema |
| `src/database-site-report-stoppages.sql` | Work stoppages schema + RLS |
| `src/database-site-report-children.sql` | Child tables DDL |
| `site_reports.sql` | Alternate site reports schema |
| `src/components/tasks/ProjectTaskListView.tsx` | Task table/board/gantt/calendar view (~1545 lines) |
| `src/components/tasks/types.ts` | Task types, permissions, constants |
| `src/components/tasks/TaskEditDrawer.tsx` | Task edit detail panel |
| `src/components/tasks/TaskCreateDrawer.tsx` | Task create drawer |
| `src/database-unified-tasks.sql` | Full task module schema |
| `src/approvals/siteReportApproval.ts` | Site report approval API |
| `src/pdf/proGridSiteReportPdf.ts` | PDF generation |
| `src/hooks/useSiteReportPhotos.ts` | Photo upload hooks |
| `src/components/SiteReportPhotoUploader.tsx` | Photo uploader component |
| `DESIGN.md` | UI design tokens and patterns |
| `featureplan.md` | Feature status tracking |
| `src/config/module-registry.ts` | Module navigation registry |

---

*End of Report — Ready for Senior Design Engineering Review*
