# PRODUCT REQUIREMENTS DOCUMENT
## Task Management Module — MEP Construction Platform

**Document Version:** 1.0  
**Date:** 2026-05-16  
**Author:** Senior Project Manager / System Design Engineer  
**Status:** DRAFT — For Review  
**Target:** Zoho Projects / MS Project parity

---

## 1. EXECUTIVE SUMMARY

### 1.1 Problem Statement

The current task module is **two disconnected systems** (`project_tasks` and `tasks` tables) with inconsistent schemas, no cross-system linkage, missing critical construction-site features (dependencies, time tracking, comments, attachments), and a UX that falls far below industry standards. Site engineers cannot track task chains across disciplines (HVAC → Electrical → Plumbing), PMs cannot see critical paths, and field staff have no mobile-friendly quick-update flow.

### 1.2 Vision

A **unified, construction-grade task management system** that serves as the single source of truth for all work items across MEP projects — from pre-construction coordination to handover commissioning. Designed for multi-tenant SaaS with granular RBAC, the UX must match Microsoft Project's power with modern web simplicity.

### 1.3 Scope

| In Scope | Out of Scope (v2+) |
|----------|-------------------|
| Unified task data model | Resource leveling algorithms |
| Gantt chart view | Earned Value Management (EVM) |
| Kanban board with drag-drop | BIM model integration |
| Table/list view (MS Project-style) | AI task auto-scheduling |
| Task dependencies (FS/SS/FF/SF) | Mobile native app |
| Subtasks (unlimited depth) | Offline sync |
| Comments & @mentions | Third-party calendar sync |
| File attachments | Baseline comparison |
| Time tracking (log hours) | |
| Custom fields per org | |
| Saved views per user | |
| Bulk operations | |
| Multi-tenant RBAC enforcement | |
| Audit trail | |

---

## 2. CURRENT STATE AUDIT

### 2.1 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CURRENT STATE (FRAGMENTED)               │
├──────────────────────────┬──────────────────────────────────┤
│  System A: Project Tasks │  System B: TodoList Tasks        │
│  Table: project_tasks    │  Table: tasks                    │
│  Scope: Per-project      │  Scope: Org-wide / Personal      │
│  Status: 5 MEP-specific  │  Status: 5 generic               │
│  Priority: None/L/M/H    │  Priority: normal/high/urgent    │
│  Has: groups, subtasks*  │  Has: categories, clients        │
│  React Query for data    │  useState only (no cache)        │
│  NO drag-drop            │  HTML5 drag-drop (basic)         │
│  NO comments/attachments │  NO comments/attachments         │
│  NO dependencies         │  NO dependencies                 │
│  NO time tracking        │  NO time tracking                │
└──────────────────────────┴──────────────────────────────────┘
* Schema exists, UI not implemented
```

### 2.2 What Works (Keep)

| Feature | Assessment |
|---------|-----------|
| `task_groups` as phases/milestones | Good concept, maps to WBS phases |
| `parent_task_id` for subtasks | Correct schema, needs UI |
| `task_views` for saved column configs | Good, never implemented |
| RLS via `org_members` check | Correct multi-tenant pattern |
| React Query in ProjectTaskListView | Correct data-fetching approach |
| `@dnd-kit` already installed | Reuse, don't add new lib |
| Status colors (5-state MEP workflow) | Construction-appropriate |

### 2.3 What's Broken (Fix)

| Issue | Severity | Impact |
|-------|----------|--------|
| Two separate task tables with different schemas | CRITICAL | Data silos, inconsistent UX, duplicate code |
| `tasks` table has no React Query caching | HIGH | Stale data, no optimistic updates |
| No task-specific RBAC permissions | HIGH | Cannot restrict who can edit/delete tasks |
| `assignees` stored as JSONB (no FK integrity) | MEDIUM | Orphaned assignees, no cascade deletes |
| `duration` is TEXT (not calculable) | MEDIUM | Cannot auto-calculate end dates |
| Clone task bug (updates existing instead) | MEDIUM | Data corruption risk |
| Export button wired to nothing | LOW | Dead UI element |
| No `organisation_id` FK constraint | MEDIUM | Orphaned records possible |

### 2.4 What's Missing (Build)

| Feature | Priority | MEP Construction Justification |
|---------|----------|-------------------------------|
| Task dependencies (FS/SS/FF/SF) | P0 | HVAC duct install MUST finish before ceiling grid starts |
| Comments with @mentions | P0 | Site engineers need to flag RFIs on tasks |
| File attachments (drawings, photos) | P0 | Site photos, revised drawings, inspection reports |
| Time tracking (log hours) | P0 | Billable hours, productivity tracking |
| Gantt chart view | P0 | Critical path visualization for project schedules |
| Unified task table | P0 | Single source of truth |
| Custom fields | P1 | Org-specific: WBS codes, cost codes, discipline tags |
| Bulk edit / bulk status change | P1 | Update 50 tasks to "Completed" after site walk |
| Audit trail / activity log | P1 | Who changed what and when — dispute resolution |
| Recurring tasks | P2 | Weekly safety inspections, monthly reports |
| Task templates | P2 | Standard commissioning checklists |
| Email/push notifications | P2 | Assignment alerts, due date warnings |

---

## 3. UNIFIED DATA MODEL

### 3.1 Core Schema

```sql
-- ============================================
-- UNIFIED TASKS TABLE (replaces both systems)
-- ============================================
CREATE TABLE tasks (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organisation_id       UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  project_id            UUID REFERENCES projects(id) ON DELETE CASCADE,  -- NULL = org-level task
  task_group_id         UUID REFERENCES task_groups(id) ON DELETE SET NULL,
  parent_task_id        UUID REFERENCES tasks(id) ON DELETE CASCADE,
  task_no               INTEGER NOT NULL DEFAULT 1,

  -- Core fields
  title                 TEXT NOT NULL,
  description           TEXT,
  task_type             TEXT DEFAULT 'task' CHECK (task_type IN ('task', 'milestone', 'deliverable', 'inspection', 'rfi', 'ncr')),

  -- Status & Priority (MEP construction workflow)
  status                TEXT DEFAULT 'not_started' CHECK (status IN (
    'not_started', 'in_progress', 'under_review', 'on_hold', 'completed', 'cancelled'
  )),
  priority              TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),

  -- Dates & Duration
  start_date            DATE,
  due_date              DATE,
  completed_date        TIMESTAMP,  -- Auto-set on status change to 'completed'
  duration_days         INTEGER,    -- Calculated or manual
  estimated_hours       DECIMAL(8,2),
  actual_hours          DECIMAL(8,2),  -- Sum from time_logs

  -- Assignment
  assignee_ids          UUID[] DEFAULT '{}',  -- Array of user IDs (FK-enforced via app layer)
  reporter_id           UUID REFERENCES auth.users(id),  -- Who created the task
  approved_by_id        UUID REFERENCES auth.users(id),  -- For approval workflows

  -- Progress
  completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),

  -- Metadata
  tags                  TEXT[] DEFAULT '{}',
  color                 TEXT,  -- Visual marker
  is_following          BOOLEAN DEFAULT false,
  is_archived           BOOLEAN DEFAULT false,

  -- MEP-specific
  discipline            TEXT CHECK (discipline IN ('mechanical', 'electrical', 'plumbing', 'fire_protection', 'elv', 'civil', 'architectural', 'general')),
  location              TEXT,  -- Floor/zone/room reference
  drawing_ref           TEXT,  -- Drawing number reference
  wbs_code              TEXT,  -- Work Breakdown Structure code

  -- Audit
  created_by            UUID NOT NULL REFERENCES auth.users(id),
  created_at            TIMESTAMP DEFAULT now(),
  updated_at            TIMESTAMP DEFAULT now(),
  deleted_at            TIMESTAMP  -- Soft delete
);
```

### 3.2 Supporting Tables

```sql
-- Task Dependencies (the missing piece)
CREATE TABLE task_dependencies (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_id   UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  dependency_type TEXT DEFAULT 'FS' CHECK (dependency_type IN ('FS', 'SS', 'FF', 'SF')),
  lag_days        INTEGER DEFAULT 0,
  created_at      TIMESTAMP DEFAULT now(),
  UNIQUE(task_id, depends_on_id)
);
-- FS = Finish-to-Start (most common in construction)
-- SS = Start-to-Start
-- FF = Finish-to-Finish
-- SF = Start-to-Finish (rare, used for shift handovers)

-- Task Comments
CREATE TABLE task_comments (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id),
  content     TEXT NOT NULL,
  mentions    UUID[] DEFAULT '{}',  -- @mentioned user IDs
  parent_id   UUID REFERENCES task_comments(id) ON DELETE CASCADE,  -- Threaded replies
  created_at  TIMESTAMP DEFAULT now(),
  updated_at  TIMESTAMP DEFAULT now()
);

-- Task Attachments
CREATE TABLE task_attachments (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id),
  file_name   TEXT NOT NULL,
  file_type   TEXT,  -- MIME type
  file_size   INTEGER,  -- bytes
  storage_path TEXT NOT NULL,  -- Supabase Storage path
  thumbnail_path TEXT,
  created_at  TIMESTAMP DEFAULT now()
);

-- Time Logs
CREATE TABLE task_time_logs (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id),
  start_time  TIMESTAMP NOT NULL,
  end_time    TIMESTAMP,
  duration_minutes INTEGER,  -- Calculated or manual entry
  description TEXT,
  billable    BOOLEAN DEFAULT true,
  created_at  TIMESTAMP DEFAULT now()
);

-- Task Activity Log (Audit Trail)
CREATE TABLE task_activity_log (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id),
  action      TEXT NOT NULL,  -- 'created', 'updated', 'status_changed', 'assigned', 'commented', 'attachment_added', 'dependency_added'
  old_value   JSONB,
  new_value   JSONB,
  created_at  TIMESTAMP DEFAULT now()
);

-- Custom Fields (per organisation)
CREATE TABLE task_custom_fields (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  field_name      TEXT NOT NULL,
  field_type      TEXT DEFAULT 'text' CHECK (field_type IN ('text', 'number', 'date', 'select', 'multiselect', 'checkbox')),
  options         TEXT[],  -- For select/multiselect
  is_required     BOOLEAN DEFAULT false,
  sort_order      INTEGER DEFAULT 0,
  created_at      TIMESTAMP DEFAULT now()
);

-- Custom Field Values (per task)
CREATE TABLE task_custom_field_values (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  custom_field_id UUID NOT NULL REFERENCES task_custom_fields(id) ON DELETE CASCADE,
  value_text      TEXT,
  value_number    DECIMAL(18,4),
  value_date      DATE,
  value_boolean   BOOLEAN,
  UNIQUE(task_id, custom_field_id)
);

-- Task Groups (enhanced)
CREATE TABLE task_groups (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  color           TEXT,
  start_date      DATE,
  due_date        DATE,
  is_collapsed    BOOLEAN DEFAULT false,
  sort_order      INTEGER DEFAULT 0,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMP DEFAULT now(),
  updated_at      TIMESTAMP DEFAULT now()
);

-- Saved Views (per user)
CREATE TABLE task_views (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,  -- NULL = org-wide view
  view_name       TEXT NOT NULL,
  view_type       TEXT DEFAULT 'table' CHECK (view_type IN ('table', 'board', 'gantt', 'calendar')),
  filters         JSONB DEFAULT '{}',
  columns         JSONB,  -- { column_key: { visible: bool, width: number, order: number } }
  sort_by         JSONB DEFAULT '[]',  -- [{ field: 'due_date', direction: 'asc' }]
  group_by        TEXT,  -- Field to group by
  is_default      BOOLEAN DEFAULT false,
  is_shared       BOOLEAN DEFAULT false,  -- Share with org
  created_at      TIMESTAMP DEFAULT now(),
  updated_at      TIMESTAMP DEFAULT now()
);
```

### 3.3 RBAC Permission Matrix

```
Permission Key              | Admin | PM  | Engineer | Supervisor | Viewer | Subcontractor
----------------------------|-------|-----|----------|------------|--------|---------------
tasks.read                  |   ✓   |  ✓  |    ✓     |     ✓      |   ✓    |     ✓*
tasks.create                |   ✓   |  ✓  |    ✓     |     ✓      |   ✗    |     ✓*
tasks.update                |   ✓   |  ✓  |    ✓*    |     ✓      |   ✗    |     ✓*
tasks.delete                |   ✓   |  ✓  |    ✗     |     ✗      |   ✗    |     ✗
tasks.assign                |   ✓   |  ✓  |    ✗     |     ✓      |   ✗    |     ✗
tasks.change_status         |   ✓   |  ✓  |    ✓     |     ✓      |   ✗    |     ✓*
tasks.add_comment           |   ✓   |  ✓  |    ✓     |     ✓      |   ✓    |     ✓
tasks.add_attachment        |   ✓   |  ✓  |    ✓     |     ✓      |   ✗    |     ✓
tasks.log_time              |   ✓   |  ✓  |    ✓     |     ✓      |   ✗    |     ✓
tasks.manage_dependencies   |   ✓   |  ✓  |    ✗     |     ✗      |   ✗    |     ✗
tasks.bulk_edit             |   ✓   |  ✓  |    ✗     |     ✓      |   ✗    |     ✗
tasks.export                |   ✓   |  ✓  |    ✓     |     ✓      |   ✓    |     ✗
tasks.manage_views          |   ✓   |  ✓  |    ✓     |     ✓      |   ✓    |     ✗
tasks.manage_custom_fields  |   ✓   |  ✗  |    ✗     |     ✗      |   ✗    |     ✗

* = Only tasks assigned to self or within own discipline
* Subcontractor = Limited to tasks explicitly shared with their company
```

---

## 4. UX DESIGN SPECIFICATION

### 4.1 Design Philosophy — Microsoft Project Inspired

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  MS Project DNA → Modern Web Translation                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Ribbon toolbar        →  Sticky command bar with contextual actions        │
│  Gantt chart pane      →  Split-pane: table left, Gantt right (draggable)  │
│  Task entry grid       →  Inline-editable table (Excel-like)               │
│  Resource sheet        →  Team panel (slide-out right)                     │
│  Calendar view         →  Month view with task bars                        │
│  Filter dropdown       →  Saved views + quick filter chips                 │
│  Zoom slider           →  Timeline zoom (day/week/month/quarter)           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Layout Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  [Org Logo]  Tasks  /  Project Name                                          │
├──────────────────────────────────────────────────────────────────────────────┤
│  COMMAND BAR (sticky, bg-white, border-b)                                    │
│  [+ New Task] [Board] [Table] [Gantt] [Calendar]  |  [🔍 Search] [Filter▼]  │
│  [Sort▼] [Group By▼] [Columns▼] [⋮ More]           |  [Save View] [Share]   │
├──────────────────────────────────────────────────────────────────────────────┤
│  FILTER CHIPS (when active)                                                  │
│  [Status: In Progress ×] [Priority: High ×] [Assignee: John ×] [Clear All]  │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  VIEW AREA (fills remaining viewport)                                        │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  TABLE VIEW (default)                                                   │ │
│  │  ┌───┬────────────────────┬─────────┬──────────┬──────────┬──────────┐ │ │
│  │  │☐ │ Task Name          │ Status  │ Priority │ Assignee │ Due Date │ │ │
│  │  ├───┼────────────────────┼─────────┼──────────┼──────────┼──────────┤ │ │
│  │  │▸ │ ▽ Foundation Work  │         │          │          │          │ │ │
│  │  │  │   1.1 Excavation   │ In Prog │    🔴    │ [👤]     │ May 20   │ │ │
│  │  │  │   1.2 PCC          │ Not St  │    🟡    │ [👤]     │ May 22   │ │ │
│  │  │  │   1.3 Footings     │ Not St  │    🔴    │ [👤]     │ May 25   │ │ │
│  │  │▸ │ ▽ MEP Rough-in     │         │          │          │          │ │ │
│  │  │  │   2.1 HVAC Ducts   │ In Prog │    🔴    │ [👤👤]   │ Jun 01   │ │ │
│  │  │  │   2.1.1 Ground Fl  │ In Prog │    🟡    │ [👤]     │ May 28   │ │ │
│  │  │  │   2.1.2 First Fl   │ Not St  │    🟡    │ [👤]     │ Jun 01   │ │ │
│  │  │  │   2.2 Electrical   │ Not St  │    🔴    │ [👤]     │ Jun 05   │ │ │
│  │  │  │   2.3 Plumbing     │ On Hold │    🟠    │ [👤]     │ Jun 03   │ │ │
│  │  └───┴────────────────────┴─────────┴──────────┴──────────┴──────────┘ │ │
│  │                                                                       │ │
│  │  Row height: 40px (compact), 48px (comfortable), 56px (spacious)     │ │
│  │  Font: 13px body, 11px secondary                                     │ │
│  │  Alternating row shades: white / zinc-50                             │ │
│  │  Hover: zinc-100 highlight                                           │ │
│  │  Selected: blue-50 with blue left border                             │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  GANTT VIEW (split pane)                                                │ │
│  │  ┌──────────────────────┬──────────────────────────────────────────────┐│ │
│  │  │  Task List (40%)     │  Timeline (60%) — draggable divider          ││ │
│  │  │                      │                                              ││ │
│  │  │  1.1 Excavation      │  ██████████░░░░░░░░░░░░░░░░░░░░░░░░         ││ │
│  │  │  1.2 PCC             │  ─────────███████████░░░░░░░░░░░░░░░        ││ │
│  │  │  1.3 Footings        │  ───────────────███████████████░░░░░        ││ │
│  │  │                      │                                              ││ │
│  │  │  2.1 HVAC Ducts      │  ─────────────────────███████████████        ││ │
│  │  │    ↳ 2.1.1 Ground    │  ───────────────────██████████░░░░░░░        ││ │
│  │  │    ↳ 2.1.2 First     │  ───────────────────────────█████████        ││ │
│  │  │  2.2 Electrical      │  ────────────────────────────────█████       ││ │
│  │  │                      │                                              ││ │
│  │  │                      │  ────┬────┬────┬────┬────┬────┬────┬────    ││ │
│  │  │                      │  May 15  20   25   30   Jun 5   10   15    ││ │
│  │  └──────────────────────┴──────────────────────────────────────────────┘│ │
│  │                                                                       │ │
│  │  Dependency arrows: ──▶ (FS), ══▶ (SS), etc.                         │ │
│  │  Critical path: red bars                                             │ │
│  │  Today line: vertical red dashed                                     │ │
│  │  Zoom: Day | Week | Month | Quarter                                  │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  KANBAN BOARD VIEW                                                      │ │
│  │  ┌────────────┬────────────┬────────────┬────────────┬────────────┐    │ │
│  │  │ Not Started│ In Progress│ Under Review│ On Hold   │ Completed  │    │ │
│  │  │   (12)     │    (8)     │    (3)      │   (2)     │   (15)     │    │ │
│  │  ├────────────┼────────────┼────────────┼────────────┼────────────┤    │ │
│  │  │ ┌────────┐ │ ┌────────┐ │ ┌────────┐ │ ┌────────┐ │ ┌────────┐ │    │ │
│  │  │ │Task    │ │ │Task    │ │ │Task    │ │ │Task    │ │ │Task    │ │    │ │
│  │  │ │Card    │ │ │Card    │ │ │Card    │ │ │Card    │ │ │Card    │ │    │ │
│  │  │ │        │ │ │        │ │ │        │ │ │        │ │ │        │ │    │ │
│  │  │ └────────┘ │ └────────┘ │ └────────┘ │ └────────┘ │ └────────┘ │    │ │
│  │  │ ┌────────┐ │ ┌────────┐ │            │            │ ┌────────┐ │    │ │
│  │  │ │Task    │ │ │Task    │ │            │            │ │Task    │ │    │ │
│  │  │ └────────┘ │ └────────┘ │            │            │ └────────┘ │    │ │
│  │  │            │            │            │            │            │    │ │
│  │  │ [+ Add]    │ [+ Add]    │            │            │            │    │ │
│  │  └────────────┴────────────┴────────────┴────────────┴────────────┘    │ │
│  │                                                                       │ │
│  │  Cards: drag between columns (dnd-kit sortable)                       │ │
│  │  Card shows: Title, Assignee avatars, Priority dot, Due date, Tags   │ │
│  │  Overdue: red left border                                             │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  CALENDAR VIEW                                                          │ │
│  │  ┌────────────────────────────────────────────────────────────────────┐ │ │
│  │  │  ◀  May 2026  ▶                                                    │ │ │
│  │  ├──────┬──────┬──────┬──────┬──────┬──────┬──────┤                   │ │ │
│  │  │ Sun  │ Mon  │ Tue  │ Wed  │ Thu  │ Fri  │ Sat  │                   │ │ │
│  │  ├──────┼──────┼──────┼──────┼──────┼──────┼──────┤                   │ │ │
│  │  │      │      │      │  1   │  2   │  3   │  4   │                   │ │ │
│  │  │      │      │      │HVAC  │Elec  │      │      │                   │ │ │
│  │  ├──────┼──────┼──────┼──────┼──────┼──────┼──────┤                   │ │ │
│  │  │  5   │  6   │  7   │  8   │  9   │ 10   │ 11   │                   │ │ │
│  │  │Plumb │      │      │Insp  │      │      │      │                   │ │ │
│  │  └──────┴──────┴──────┴──────┴──────┴──────┴──────┘                   │ │ │
│  │                                                                       │ │ │
│  │  Color-coded by discipline or status                                  │ │ │
│  │  Click day → side panel with day's tasks                              │ │ │
│  │  Drag task between days to reschedule                                 │ │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Task Detail Panel (Slide-out Drawer)

```
┌──────────────────────────────────────────────────────────────┐
│  ✕  TASK-1042: HVAC Duct Installation — Ground Floor        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─ DETAILS ───────────────────────────────────────────────┐│
│  │                                                          ││
│  │  Status      [In Progress ▼]    Priority [High ▼]       ││
│  │                                                          ││
│  │  Assignees   [👤 John] [👤 Sarah] [+ Add]               ││
│  │  Reporter    👤 Mike Chen                               ││
│  │                                                          ││
│  │  Start Date  [2026-05-15 ]      Due Date  [2026-06-01 ] ││
│  │  Duration    12 days            Est. Hours  96.0        ││
│  │  Actual Hours  48.5             Progress  ██████░░ 62%  ││
│  │                                                          ││
│  │  Discipline  [Mechanical ▼]     Location  Ground Floor   ││
│  │  Drawing Ref  M-101 Rev.3       WBS Code  2.1.1         ││
│  │                                                          ││
│  │  Tags  [HVAC] [Ductwork] [Zone A] [+ Add]               ││
│  │                                                          ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─ DEPENDENCIES ──────────────────────────────────────────┐│
│  │  ▸ Depends on: TASK-1038 (Excavation) — FS — Completed  ││
│  │  ▸ Blocks: TASK-1045 (Ceiling Grid) — FS — Not Started  ││
│  │  [+ Add Dependency]                                     ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─ SUBTASKS (3) ──────────────────────────────────────────┐│
│  │  ☐ 2.1.1.1 Duct fabrication         Not Started         ││
│  │  ☑ 2.1.1.2 Material delivery        Completed           ││
│  │  ▸ 2.1.1.3 Duct installation        In Progress  60%    ││
│  │  [+ Add Subtask]                                        ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─ TIME LOGS ─────────────────────────────────────────────┐│
│  │  [▶ Start Timer]  [+ Log Time]                          ││
│  │                                                          ││
│  │  May 15  John    8h  Site preparation & marking          ││
│  │  May 16  John    7h  Duct assembly — Zone A              ││
│  │  May 16  Sarah   6h  Hanger installation                 ││
│  │  May 17  John    8h  Duct installation — Zone A          ││
│  │                                                          ││
│  │  Total: 29h logged / 96h estimated                       ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─ ATTACHMENTS (4) ───────────────────────────────────────┐│
│  │  [📎 Upload]                                            ││
│  │                                                          ││
│  │  📄 M-101_Rev3.pdf          2.4 MB   May 14             ││
│  │  🖼️ site_photo_001.jpg      1.1 MB   May 15             ││
│  │  📄 inspection_report.docx  340 KB   May 16             ││
│  │  📄 material_approval.pdf   890 KB   May 17             ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─ ACTIVITY ──────────────────────────────────────────────┐│
│  │  May 17 14:32  John changed status to In Progress       ││
│  │  May 17 14:30  Sarah logged 6h                          ││
│  │  May 16 09:15  Mike added attachment                    ││
│  │  May 15 08:00  Task created by Mike                     ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─ COMMENTS (7) ──────────────────────────────────────────┐│
│  │                                                          ││
│  │  👤 Sarah  May 17 10:30                                 ││
│  │  Duct fabrication is 80% done. Expecting delivery       ││
│  │  by Wednesday. @John please confirm site readiness.     ││
│  │                                                          ││
│  │  👤 John  May 17 11:45                                  ││
│  │  Site is ready. Hangers installed in Zone A.            ││
│  │                                                          ││
│  │  ┌──────────────────────────────────────────────────┐   ││
│  │  │  Write a comment...  [@] [📎]             [Send] │   ││
│  │  └──────────────────────────────────────────────────┘   ││
│  │                                                          ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 4.4 Task Creation — Quick Add Pattern

```
┌──────────────────────────────────────────────────────────────┐
│  Quick Add (inline in table)                                 │
│                                                              │
│  ┌───┬────────────────────────────────────────────────────┐ │
│  │ + │ Type task name and press Enter...                  │ │
│  └───┴────────────────────────────────────────────────────┘ │
│                                                              │
│  Pressing Enter creates task with defaults.                  │
│  Pressing Tab moves to next field (name → assignee → due).  │
│  Pressing Esc cancels.                                       │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  Full Create Drawer (slide-out right, 480px wide)            │
│                                                              │
│  ✕  New Task                                                │
│  ─────────────────────────────────────────────────────────── │
│                                                              │
│  Task Name *                                                │
│  [____________________________________________________]      │
│                                                              │
│  Task Type     [Task ▼]    Discipline  [Mechanical ▼]       │
│  Priority      [Medium ▼]  Status      [Not Started ▼]      │
│                                                              │
│  Assignees     [+ Select team members]                      │
│  Group/Phase   [Foundation Work ▼]                          │
│                                                              │
│  Start Date    [2026-05-20 ]   Due Date    [2026-06-01 ]    │
│  Est. Hours    [96.0]          WBS Code    [2.1.1]          │
│  Location      [Ground Floor]  Drawing Ref [M-101 Rev.3]    │
│                                                              │
│  Description                                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                                                      │   │
│  │  Rich text editor (bold, lists, links)               │   │
│  │                                                      │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  Tags        [HVAC] [Ductwork] [+ Add]                      │
│  Color       ○ ○ ○ ○ ● ○ ○ ○                                │
│                                                              │
│  ─────────────────────────────────────────────────────────── │
│  [Cancel]                        [Create Task]               │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 5. DRAG-DROP SPECIFICATION

### 5.1 Implementation: `@dnd-kit` (already installed)

| Interaction | Library | Behavior |
|-------------|---------|----------|
| Board: card → column | `@dnd-kit/core` DndContext | Drop updates `status` field |
| Board: reorder within column | `@dnd-kit/sortable` | Updates `sort_order` |
| Table: reorder rows | `@dnd-kit/sortable` | Updates `sort_order` within group |
| Table: drag group header | `@dnd-kit/sortable` | Reorders task groups |
| Gantt: drag task bar | `@dnd-kit/core` | Updates `start_date` + `due_date` |
| Gantt: drag bar edge | `@dnd-kit/core` | Resizes duration |
| Calendar: drag between days | `@dnd-kit/core` | Updates `due_date` |
| Table: drag to reorder columns | `@dnd-kit/sortable` | Updates column order in view config |

### 5.2 Drag-Drop UX Rules

```
1. Visual feedback:
   - Dragging card: opacity 0.6, slight scale-up (1.02), shadow-lg
   - Drop target: highlight with blue border + bg-blue-50/30
   - Invalid drop: red flash + shake animation

2. Optimistic updates:
   - Update UI immediately on drop
   - Fire Supabase mutation in background
   - On error: revert + toast notification

3. Accessibility:
   - Keyboard reordering: Alt+↑/↓ to move selected row
   - Screen reader announcements: "Task moved to In Progress"

4. Multi-select drag:
   - Ctrl+Click to select multiple tasks
   - Drag any selected task → all move together
   - Bulk status update on drop
```

---

## 6. MULTI-TENANT & RBAC IMPLEMENTATION

### 6.1 Data Isolation

```sql
-- Every query MUST include organisation_id filter
-- RLS policies enforce this at database level

-- Enhanced RLS: role-aware policies
CREATE POLICY "Engineers can update own tasks"
  ON tasks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.organisation_id = tasks.organisation_id
      AND om.user_id = auth.uid()
      AND (
        -- Admin/PM: all tasks
        om.role IN ('admin', 'project_manager')
        OR
        -- Engineer/Supervisor: only assigned tasks
        (om.role IN ('engineer', 'supervisor') AND tasks.assignee_ids @> ARRAY[auth.uid()])
        OR
        -- Subcontractor: only tasks shared with their company
        (om.role = 'subcontractor' AND tasks.assignee_ids @> ARRAY[auth.uid()])
      )
    )
  );
```

### 6.2 Frontend RBAC Hook

```typescript
// hooks/useTaskPermissions.ts
export function useTaskPermissions() {
  const { userRole, organisation } = useAuth();

  const can = useCallback((permission: TaskPermission, task?: ProjectTask) => {
    const rolePermissions = ROLE_PERMISSION_MAP[userRole];
    if (!rolePermissions[permission]) return false;

    // Scoped permissions (e.g., only own tasks)
    if (permission === 'tasks.update' && task) {
      if (userRole === 'engineer' || userRole === 'subcontractor') {
        return task.assignee_ids.includes(user.id);
      }
    }

    return true;
  }, [userRole]);

  return { can };
}
```

### 6.3 Tenant Isolation Checklist

- [ ] All Supabase queries include `organisation_id` filter
- [ ] RLS policies prevent cross-org data access
- [ ] File storage paths include `{orgId}/tasks/` prefix
- [ ] Custom fields are org-scoped (not global)
- [ ] Saved views are user+org scoped
- [ ] Notifications only go to users within same org
- [ ] Export data is filtered by org membership

---

## 7. IMPLEMENTATION PLAN

### Phase 1: Foundation (Weeks 1-3)

| Sprint | Deliverable | Effort |
|--------|------------|--------|
| 1.1 | Database migration: unified `tasks` table + supporting tables | 3 days |
| 1.2 | RLS policies with RBAC-aware rules | 2 days |
| 1.3 | Data migration script: `project_tasks` → `tasks`, `tasks` → `tasks` | 2 days |
| 1.4 | TypeScript types + hooks layer | 2 days |
| 1.5 | React Query setup with proper cache keys | 1 day |

### Phase 2: Core UI (Weeks 4-6)

| Sprint | Deliverable | Effort |
|--------|------------|--------|
| 2.1 | Table view (MS Project-style inline editing) | 4 days |
| 2.2 | Kanban board with dnd-kit drag-drop | 3 days |
| 2.3 | Task detail drawer (full panel) | 3 days |
| 2.4 | Quick-add inline creation | 1 day |
| 2.5 | Task create/edit forms | 2 days |
| 2.6 | Command bar + saved views | 2 days |

### Phase 3: Advanced Features (Weeks 7-9)

| Sprint | Deliverable | Effort |
|--------|------------|--------|
| 3.1 | Task dependencies (CRUD + UI) | 3 days |
| 3.2 | Comments with @mentions | 2 days |
| 3.3 | File attachments (Supabase Storage) | 2 days |
| 3.4 | Time tracking (timer + manual log) | 2 days |
| 3.5 | Gantt chart view (basic) | 4 days |
| 3.6 | Audit trail / activity log | 2 days |

### Phase 4: Polish & Scale (Weeks 10-12)

| Sprint | Deliverable | Effort |
|--------|------------|--------|
| 4.1 | Custom fields per org | 3 days |
| 4.2 | Bulk operations (select + edit) | 2 days |
| 4.3 | Calendar view | 2 days |
| 4.4 | Export (CSV, PDF) | 2 days |
| 4.5 | Performance optimization (virtual scrolling) | 2 days |
| 4.6 | Accessibility audit + fixes | 2 days |
| 4.7 | E2E testing | 3 days |

---

## 8. PERFORMANCE REQUIREMENTS

| Metric | Target | Justification |
|--------|--------|---------------|
| Initial load (< 500 tasks) | < 1.5s | Site engineers on 4G connections |
| Table render (1000 rows) | < 200ms | Virtual scrolling required |
| Drag-drop response | < 100ms | Must feel instant |
| Search/filter response | < 300ms | Indexed queries |
| Attachment upload (10MB) | < 5s | Supabase Storage with CDN |
| Concurrent users per org | 50+ | Large MEP contractors |
| Tasks per project | 10,000+ | Multi-year projects |

### 8.1 Optimization Strategies

```
1. Virtual scrolling: @tanstack/react-virtual for table rows
2. Pagination: Cursor-based for > 500 tasks
3. Optimistic updates: React Query optimistic mutations
4. Debounced search: 300ms delay before query
5. Selective column fetching: Only fetch visible columns
6. WebSocket for real-time: Supabase Realtime for live updates
7. Image thumbnails: Generate on upload, cache in Storage
```

---

## 9. MEP CONSTRUCTION-SPECIFIC FEATURES

### 9.1 Discipline-Based Filtering

MEP projects have distinct disciplines that often work in parallel but with dependencies:

```
Mechanical → HVAC ducts, chillers, AHUs, pumps, BMS
Electrical → HT/LT panels, cable trays, lighting, ELV
Plumbing → Water supply, drainage, storm water, PHE
Fire Protection → Sprinklers, hydrants, fire alarm, FM200
Civil      → Foundations, structure, finishes
```

The task system must support:
- Discipline tag on every task
- Discipline-based views ("Show me all Mechanical tasks")
- Cross-discipline dependencies ("Electrical cable tray must wait for HVAC duct")
- Discipline-specific custom fields (e.g., Mechanical needs "CFM rating", Electrical needs "Cable size")

### 9.2 Location/Zone Tracking

Construction sites are divided into zones, floors, and rooms:

```
Location format: [Building]-[Floor]-[Zone]-[Room]
Example: "Tower A - Level 3 - Zone B - Room 305"

Tasks should be filterable by:
- Floor (all tasks on Level 3)
- Zone (all tasks in Zone B)
- Room (specific room tasks)
```

### 9.3 Drawing Reference

Every construction task ties back to a drawing:

```
Drawing Ref format: [Discipline]-[Number] [Revision]
Example: "M-101 Rev.3", "E-205 Rev.1", "P-302 Rev.2"

Tasks should link to:
- Drawing number
- Revision status
- Attached drawing PDF
```

### 9.4 Inspection & Commissioning Tasks

MEP projects require formal inspections:

```
Task types beyond standard 'task':
- inspection: Pre-pour, pre-close, pressure test
- rfi: Request for Information
- ncr: Non-Conformance Report
- milestone: Key project milestone
- deliverable: Handover document/submission

Each type has different workflow:
inspection: Scheduled → Conducted → Passed/Failed → Rectified → Closed
rfi: Raised → Submitted → Responded → Implemented → Closed
ncr: Raised → Investigated → Corrective Action → Verified → Closed
```

---

## 10. RISK ASSESSMENT

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Data migration loses task history | HIGH | Medium | Backup tables, dry-run migration, user verification |
| RLS policies too restrictive | HIGH | Medium | Staged rollout, admin override, audit logs |
| Gantt chart performance with 10K+ tasks | MEDIUM | High | Virtual rendering, server-side aggregation |
| dnd-kit conflicts with existing usage | LOW | Low | Isolate task DnD context, test thoroughly |
| Subcontractor access too broad | HIGH | Medium | Explicit task sharing model, not org-wide |
| Custom fields bloat the UI | MEDIUM | Medium | Progressive disclosure, field grouping |
| Mobile responsiveness suffers | MEDIUM | High | Mobile-first design for table, simplified views |

---

## 11. SUCCESS METRICS

| Metric | Baseline | Target (90 days) |
|--------|----------|-----------------|
| Task creation time | 45s (modal) | < 5s (inline) |
| Status update time | 3 clicks | 1 drag |
| Tasks with dependencies | 0% | > 30% |
| Tasks with time logs | 0% | > 50% |
| Tasks with comments | 0% | > 40% |
| User satisfaction (NPS) | N/A | > 40 |
| Daily active users (task module) | N/A | > 60% of org members |

---

## 12. APPENDIX

### A. Glossary

| Term | Definition |
|------|-----------|
| WBS | Work Breakdown Structure — hierarchical decomposition of project scope |
| FS/SS/FF/SF | Dependency types: Finish-to-Start, Start-to-Start, Finish-to-Finish, Start-to-Finish |
| RFI | Request for Information — formal query from contractor to consultant |
| NCR | Non-Conformance Report — documents work that doesn't meet specifications |
| Critical Path | Longest sequence of dependent tasks that determines project duration |
| RLS | Row Level Security — Supabase's row-level access control |
| RBAC | Role-Based Access Control — permissions tied to user roles |

### B. References

- Microsoft Project UI patterns: https://support.microsoft.com/en-us/project
- Zoho Projects task management: https://www.zoho.com/projects/
- @dnd-kit documentation: https://docs.dndkit.com/
- Supabase RLS best practices: https://supabase.com/docs/guides/auth/row-level-security

### C. Open Questions

1. Should we keep the `tasks` (TodoList) table for personal tasks, or merge everything into `tasks` with `project_id = NULL`?
2. Do we need task approval workflows (task must be approved by PM before marked complete)?
3. Should Gantt chart use a third-party library (e.g., `gantt-task-react`) or build custom?
4. How do we handle task notifications — in-app only, or email/SMS as well?
5. Should we support task recurrence patterns (daily, weekly, monthly inspections)?

---

**END OF PRD**

*This document is the implementation blueprint. No code changes should be made until this PRD is reviewed, approved, and phased into sprints.*
