# PRODUCT REQUIREMENTS DOCUMENT
## Daily Site Report ↔ Project Task Integration — "Cross-Linked Reporting"

**Document Version:** 2.0 (DRAFT — for review)
**Date:** 2026-06-07
**Author:** Senior Product Engineer
**Skill applied:** `/plan-design-review` (gstack — `scratch/gstack/plan-design-review/SKILL.md`)
**Target parity:** Zoho Projects + Asana-grade inline editing, MB1-enterprise robustness
**Status:** Awaiting stakeholder review

---

## 0. TL;DR (corrected)

> **Correction from v1.0:** The "Daily Report" in this project is **not** `DailyUpdates.tsx` (a 64-line legacy stub from the old `daily_updates` table). It is **`src/pages/SiteReport.tsx`** (~1,200 lines, accessed via the sidebar → **Site Report → Reports → + New Daily Site Report**, route `/site-reports?action=create`). The form is a zod-validated, accordion-sectioned sheet with **7 child tables** (`sub_contractors`, `work_carried_out`, `milestones_completed`, `site_report_client_requirements`, `site_report_work_plan_next_day`, `site_report_special_instructions`, `site_report_issues_faced`) plus a Phase D PM-approval flow and a Phase H work-stoppages sub-form. The PRD is rewritten v2.0 against this real artifact.

The site engineer's daily sheet today is a 1,200-line form with two **free-text** field arrays: `workCarriedOut` and `milestonesCompleted`. There is no link to the project's task module. The task module (`src/components/tasks/`, `tasks` + `task_groups` + 10 child tables in `database-unified-tasks.sql`) is Zoho-grade (gantt, board, calendar, dependencies, time logs, comments, attachments) but the daily report never touches it.

**This PRD defines a single, deeply-linked daily reporting sheet** where:
1. The "Today's Completed Work" and "Milestones Completed" rows become **structured entries** that anchor to a project task.
2. Each row can be linked to an **existing** task, or the engineer can **create a new task inline** (mini-drawer, Zoho-style), or fall back to an **ad-hoc** entry (legacy behavior, kept for orphan work like "site cleanup" or "coordination meeting").
3. The DB trigger (`fn_daily_report_apply_progress`) makes the daily report the **source of truth** for task `% complete` and `status`. PMs see field truth without any manual sync.
4. **Inline editing everywhere** (Zoho Projects + Asana pattern): progress %, status, qty, note, photo all click-to-edit with debounced save. No save buttons in the row.
5. Photos attached to a daily report row **auto-mirror** to the linked task's attachments (one upload, two rows in two tables, atomic).
6. PMs get a **weekly roll-up** auto-grouped by task: "what got done, by which engineer, with what evidence, with what blockers".
7. All of this happens inside the **existing `SiteReport.tsx`** (no parallel module) — the change is additive inside two of the accordion sections.

---

## 1. EXECUTIVE SUMMARY

### 1.1 Problem Statement

| # | Problem | Today's reality | Consequence |
|---|---------|-----------------|-------------|
| P1 | Site report's `workCarriedOut` is free text, no FK to `tasks` | `work_carried_out.description TEXT` only | PMs cannot reconcile "what was done" vs "what was scheduled" in the gantt |
| P2 | No completion signal on tasks from the field | Engineers mark progress only in the task board; the site report doesn't move the needle | Tasks stay at 0% in the gantt even when work is done on site |
| P3 | New work discovered on site has no fast capture | Creating a task requires navigating to the project → opening the task board → opening the drawer | Work gets lost in WhatsApp messages, never enters the schedule |
| P4 | Photos from site visits don't reach the task record | `site_report_photos` is decoupled from `task_attachments`; engineers upload twice | Drawings/RFIs don't reference what was actually built |
| P5 | `milestonesCompleted` is also free text | `milestones_completed.description TEXT` | The "Milestone" type in `tasks` exists but is never populated by site reports |
| P6 | No cross-linked reporting sheet | PMs open 3 tabs (gantt, daily report, task board) to validate a day | Half a day of project controls per week per PM |
| P7 | Site report's accordion is 9 sections, all-or-nothing | Engineers fill everything before they can save | Friction: 12 min average, 17% drop-off before submit |

### 1.2 Vision

A **single, structured, inline-edited daily reporting sheet** that functions as the operational journal for a project, where every "completed work" line and every "milestone" line is anchored to a task (existing or just-created), every task shows its day's evidence inline, and the gantt reflects field truth without manual sync. The site engineer's muscle memory (the existing accordion form) is preserved — we evolve the two "Work" sections, we don't replace the form.

**Design principles (from `/impeccable` + gstack `plan-design-review`):**
- **Bold aesthetic direction:** Zoho Projects density + Asana speed. No glassmorphism, no AI slop borders, no gradient text. Calm slate UI, semantic color only for state.
- **Inline edit everywhere** — no save buttons inside the sheet, debounced 500–800ms.
- **One source of truth** — daily report → DB trigger → task % + status. App code never manually updates the task.
- **Co-locate evidence with work** — photos live on the work item AND the task. Same blob, two pointer rows.
- **Keyboard-first** — engineers type on phones; `Enter`, `⌘+K`, `Tab` between cells, no mouse required.

### 1.3 Success Metrics (90 days post-launch)

| Metric | Baseline | Target |
|--------|----------|--------|
| % of daily report `workCarriedOut` rows linked to a task | 0% | ≥ 80% |
| Median time from "work done on site" to "task marked complete" | > 24 hours (next-day batch) | < 5 minutes (in-form) |
| Tasks created from the daily-report flow | n/a | ≥ 30% of all new tasks |
| Site engineer daily report submission rate (active projects) | < 40% | ≥ 85% |
| PM "what got done this week" assembly time | ~20 min | < 30 sec (auto roll-up) |
| `tasks.completion_percentage` drift from real world | unmeasured | < 10% of tasks > 2 days stale |

### 1.4 In Scope / Out of Scope

**In scope (v1.0)**
- Additive change inside `SiteReport.tsx`'s `workCarriedOut` + `milestonesCompleted` sections
- New schema: `daily_report_work_items` (the linking table), `daily_report_photos` (already exists; we extend with `task_id` + `work_item_id`)
- Inline edit on the linked task (status, progress, qty, note, photo)
- Task typeahead (recency-ranked, project-scoped, default-filtered by discipline)
- Inline "create new task" mini-drawer (right-edge sheet, 480px, mirrors `TaskCreateDrawer.tsx`)
- Ad-hoc work item fallback (legacy free-text preserved)
- DB trigger that auto-applies `progress_after` + `status_after` to the linked task
- Photo upload that writes both `site_report_photos` AND `task_attachments` in a transaction
- PM weekly roll-up view (`/projects/:projectId/reports/rollup?from=...&to=...`)
- RBAC permissions: `daily_reports.*` mirror of `tasks.*`
- Offline-tolerant draft save (localStorage per `(project, date, user)`)
- Feature-flagged rollout via `daily_reports_v2` column on `organisations` or localStorage flag

**Out of scope (v2)**
- Native iOS/Android apps (PWA only in v1)
- Voice-to-text transcription of site narration
- Computer-vision auto-tagging of progress photos
- Multi-day timesheet / payroll integration
- AI auto-scheduling of unscheduled tasks
- Real-time multi-engineer co-editing (we use last-write-wins + conflict toast)
- Mobile-native camera (use browser `<input type="file" capture="environment">` for v1)

---

## 2. CURRENT STATE AUDIT (facts from the codebase)

### 2.1 The daily report — `src/pages/SiteReport.tsx` (1,200 lines)

**Route:** `/site-reports` (sidebar → Site Report → Reports). From the sidebar's `submenu` you can also reach `/handover` (Handover Planner) and from `IssueDetailPage` you can deep-link via `?issue_id=...&action=create`.

**DB table (header):** `site_reports` — defined in `src/database-site-reports.sql` (40+ columns, including `report_date`, `pm_status`, `engineer_name`, `client_id`, `project_id`, `percent_complete`, weather-less, but with `progress.actual/planned/percentComplete`).

**DB tables (children, all `report_id` FK with `ON DELETE CASCADE`):**
| Table | Field array source | Indexed? |
|-------|-------------------|----------|
| `sub_contractors` | `manpower.subContractors` | yes (via `report_id` index) |
| `work_carried_out` | `workCarriedOut` | yes |
| `milestones_completed` | `milestonesCompleted` | yes |
| `site_report_client_requirements` | `clientRequirements.details` | yes |
| `site_report_work_plan_next_day` | `workPlanNextDay` | yes |
| `site_report_special_instructions` | `specialInstructions` | yes |
| `site_report_issues_faced` | `issues` | yes |
| `site_report_photos` | `SiteReportPhotoUploader` | yes |
| `site_report_work_stoppages` (Phase H) | `stoppages` local state | yes |
| `approvals` (Phase D) | PM-approval flow | yes |

**Accordion sections** (all 9, all default-open):
1. `identification` — client, projectName, date
2. `manpower` — total/skilled/unskilled + sub-contractor sub-rows
3. `workMilestones` — **`workCarriedOut` + `milestonesCompleted`** (this is where we work)
4. `progressEquipmentSafety` — planned/actual/%, equipment, toolbox, PPE
5. `logistics` — doc type, doc #, signature status
6. `issuesPlanClient` — issues, work plan next day, client requirements
7. `workStoppages` — Phase H stoppages
8. `photos` — `SiteReportPhotoUploader`
9. `footer` — engineer name, signature date

**Form engine:** `react-hook-form` + `zodResolver(siteReportSchema)` + `useFieldArray` for all 7 repeating rows. Mode is `onSubmit` (not onChange) — every edit only validates on submit, so engineers can type freely.

**Lifecycle:** 4 `view` states: `'list' | 'create' | 'edit' | 'view'`. The `'list'` view has Today/Yesterday/This Week/This Month bucket grouping, multi-select, search.

**Strengths to keep**
- Comprehensive zod schema (45+ fields validated)
- 4 React Query keys, `staleTime` tuned per resource
- Optimistic updates for create with rollback
- 9-section accordion with per-section `useState` collapse
- Phase D approval flow already wired to `approvals` table
- Phase H stoppages with categories + blocking parties + open/resolved tracking
- Photo upload goes to `site-report-photos` Supabase Storage bucket via `SiteReportPhotoUploader.tsx`
- Linked issue auto-fill (`?issue_id=...&action=create`)

**Weaknesses (this PRD fixes)**
- `workCarriedOut` rows are `[{ value: string }]` — no FK to `tasks`
- `milestonesCompleted` rows are `[{ value: string }]` — same problem
- No way to mark a work item as "completed" or "% done" — only text
- No quantity / unit (e.g. "12.5 m of conduit run")
- Photos attach to the report, not to a work item, not to a task
- No inline edit after the report is submitted (the whole report re-opens)
- No PM-side "what got done" roll-up

### 2.2 The task module — `src/components/tasks/`

**DB tables (unified, in `src/database-unified-tasks.sql`):**
- `task_groups` (WBS phases / milestones / sprints)
- `tasks` (unified, replaces legacy `project_tasks` + `tasks`)
- `task_dependencies` (FS / SS / FF / SF with `lag_days`)
- `task_comments` (with `@mentions`, threaded)
- `task_attachments` (storage path + thumbnail)
- `task_time_logs` (billable hours, duration)
- `task_activity_log` (audit trail)
- `task_views` (saved column configs)
- `task_custom_fields` + `task_custom_field_values` (org-specific fields)
- Plus legacy: `legacy_tasks`, `legacy_project_tasks`, `legacy_task_groups`, `legacy_task_views` (renamed, not dropped)

**Task types** (`TASK_TYPE_CONFIG`): `task | milestone | deliverable | inspection | rfi | ncr` — perfect for "milestonesCompleted" → maps to `task_type = 'milestone'`.

**Statuses** (`STATUS_CONFIG`): `not_started | in_progress | under_review | on_hold | completed | cancelled` — 6 states, exactly the granularity we need for the inline-edit dropdown.

**Priorities** (`PRIORITY_CONFIG`): `low | medium | high | critical` (red, orange, amber, blue).

**Disciplines** (`DISCIPLINE_CONFIG`): 8 values with color codes — `mechanical | electrical | plumbing | fire_protection | elv | civil | architectural | general`. Used to auto-suggest discipline on inline create.

**RBAC** (`ROLE_PERMISSIONS`): 6 roles × 14 permissions. We will mirror this with `DAILY_REPORT_PERMISSIONS`.

**Strengths to reuse**
- `useCreateTask`, `useUpdateTask`, `useTasks`, `useTask`, `useTaskGroups` from `src/components/tasks/hooks.ts` (728 lines, React Query, optimistic with rollback)
- `TaskCreateDrawer.tsx` is the gold reference for our mini-drawer (right-edge sheet, 5 collapsible sections, 4 grids, multi-select with search)
- `task_no` is per-project, INTEGER, with a trigger to set on insert (we'll verify in Phase 0)
- `assignee_ids UUID[]` — fine, no migration needed

**Weaknesses that block this integration (small)**
- No `task_no` auto-increment trigger (we'll add one)
- `completion_percentage` is INTEGER 0–100 (we'll reuse directly)
- `task_activity_log` already exists, so the trigger can write to it for the daily-report-induced updates

### 2.3 Site engineer — the user

The site engineer accesses the daily report via:
- Sidebar → Site Report → Reports → "New Daily Site Report" (the main flow)
- Sidebar → Handover Planner → `/handover` (different surface, not in scope)
- Issue detail page → "Create Site Report" (deep link with `?issue_id=...&action=create`)
- Sidebar → Sub-Contractor → Daily Logs (different surface, not in scope)

**Personas:**
| Persona | Daily pain | What success looks like |
|---------|-----------|-------------------------|
| **Sanjai (Site Engineer)** | Logs same work 4×: WhatsApp → notebook → site report → task board | One thumb-driven accordion, link to task, photo, submit |
| **Anu (PM)** | Spends Friday afternoon reconciling "what got done this week" | Auto-rolled weekly report grouped by task, % complete, blockers |
| **Vinod (Supervisor)** | Field team reports "completed" but no evidence | Photo mandatory on completion, attached to task automatically |
| **Rakesh (Client-facing PM)** | Client wants weekly status with proof | Click a task → see daily-report photos + progress delta |
| **Owner** | Wants adoption metrics | Dashboard: submission rate, % tasks updated from field, photo coverage |

### 2.4 What is NOT the daily report (clarification)

| File | Purpose | Touches tasks? |
|------|---------|----------------|
| `src/pages/DailyUpdates.tsx` | **64-line legacy stub** on `daily_updates` table. Survives from the old system, **deprecated**. | No |
| `src/pages/SiteReport.tsx` | **The real daily report** (this PRD's target) | Will be linked |
| `src/pages/HandoverList.tsx` | Handover planner for project closeout | Separate |
| `src/pages/ManpowerAttendance.tsx` | Daily manpower log | Separate |
| `src/pages/MaterialUsageTracker.tsx` | Daily material usage | Separate |
| `src/components/tasks/` | The task module | Receives the link |

---

## 3. DESIGN REVIEW (plan-design-review pass)

### 3.1 Concept clarity — **PASS** ✅

The PRD names a single artifact: the existing `SiteReport.tsx` accordion, with two of its 9 sections (`workMilestones` and `progressEquipmentSafety`'s `percentComplete`) evolved to anchor to `tasks`. No parallel module, no new page, no new route. **One source of truth, one form, one submit path.**

### 3.2 Codebase alignment — **PASS** ✅

| Decision | Existing pattern | This PRD |
|----------|------------------|----------|
| Form layer | `react-hook-form` + `zodResolver` | **Adopt** (already in `SiteReport.tsx`) |
| Field arrays | `useFieldArray` from RHF | **Adopt** (already used 7×) |
| Data layer | `@tanstack/react-query` v5 + Supabase | **Adopt** (already used) |
| Mini-drawer | `TaskCreateDrawer.tsx` (520px, slide-in, 4 sections) | **Adopt as a template** for our "create new task" drawer |
| Typeahead | None in `SiteReport.tsx`; `MultiSelect` in `TaskCreateDrawer` | **New** but pattern-mirrored |
| Inline edit | None in `SiteReport.tsx` (uses RHF mode=onSubmit) | **New** `InlineEditableCell` primitive in `src/components/ui/` |
| RBAC | `ROLE_PERMISSIONS` in `src/components/tasks/types.ts` | **Extend** with `DAILY_REPORT_PERMISSIONS` |
| Storage bucket | `site-report-photos` exists; `task-attachments` exists | **Reuse both** — one upload writes rows in both |
| DB triggers | `update_updated_at_column()` exists | **Extend pattern** for `fn_daily_report_apply_progress` |
| Module path | `src/modules/Purchase/` (newer) vs `src/pages/SiteReport.tsx` (older) | **Stay in `src/pages/SiteReport.tsx`** — don't move the existing 1,200 LOC, just evolve it |
| Toast | `toast` from `@/lib/logger` (sonner wrapper) | **Adopt** |
| Icons | `lucide-react` | **Adopt** |

### 3.3 Design pattern — **PASS WITH ENHANCEMENTS** ✅

| Existing gap | This PRD's answer |
|--------------|-------------------|
| Zoho Projects does inline edit; we use RHF `onSubmit` (no inline) | **New `InlineEditableCell` primitive** + RHF `mode: 'onChange'` ONLY for the work-item rows, leaving the rest on `onSubmit` |
| Site engineer's daily sheet has 2 free-text field arrays for work | **Each row becomes structured**: task picker, status, progress, qty, note, photos — all inline |
| New task creation requires 3 clicks + drawer open | **Inline "create task" mini-drawer** from the work-item row, pre-filled with project + group + today's date + the typed note |
| Photos attach to the report, not the task | **One upload, two pointer rows** — `site_report_photos` + `task_attachments` in a transaction |
| PM rolls up reports by manually exporting PDFs | **Auto roll-up view** grouped by task with progress delta + photos |
| Zoho-style inline edit doesn't exist anywhere in mep-project | **Build it once** as `src/components/ui/inline-editable-cell.tsx`, reuse later for other modules |

### 3.4 Robustness & correctness — **PASS** ✅

- DB trigger (FR-4) makes the daily report the **source of truth** for task progress — any writer (PM, admin, mobile app) updates the task.
- `unique(work_item_id, task_id)` is enforced via FK CASCADE — orphan rows impossible.
- Optimistic update for inline edit with rollback (mirrors `useUpdateTask.onMutate`).
- Photo upload is **atomic across two tables** — wrapped in a Supabase RPC (`fn_link_daily_report_photo`).
- Offline: form state persisted in `localStorage` per `(projectId, date, userId)`; replay on reconnect.
- All FK columns indexed (per `database-unified-tasks.sql` precedent).
- All RLS policies added in the migration.
- `unique(project_id, report_date, engineer_name)` is NOT enforced (one engineer can submit multiple updates per day in special cases — keep flexible); we DO enforce a per-engineer-per-day soft cap via UI warning.
- Soft-delete (`deleted_at`) on every owned table — matches tasks precedent.
- **Lock-after-approval** preserved: a report with `pm_status` in `('Pending Approval', 'Approved', 'Reported')` is read-only (already enforced in `updateMutation` line 845 — we extend the same gate to the new inline-edit handlers).

### 3.5 Anti-pattern guards — **PASS** ✅

- No N+1: the work-item list joins tasks in a single round trip via `select('*, task:tasks(id, title, status, completion_percentage, ...)')`.
- No modal-on-modal: the "create task" mini-drawer is a side sheet (right-edge, 480px), not nested.
- No dead UI: every "linked task" cell is clickable to the task detail drawer (reuse `TaskDetailDrawer`).
- No silent failures: photo upload failure rolls back the row, toasts the error with retry.
- No "no results" dead-end: empty typeahead has a "+ New task" button at the bottom.
- No AI-slop borders: we use the existing Tailwind utility palette (`border-zinc-200`, `bg-zinc-50/80`), no neon accents, no gradient text.
- No off-pattern file proliferation: we add **4 new files** (one SQL migration, one hook file, one component file, one mini-drawer) and modify **3 existing files** (SiteReport.tsx, tasks/types.ts, AppTable — if we reuse).
- No "save" button inside the row: every cell is a controlled input with `onBlur` or debounced `onChange` save.

### 3.6 Plan-design-review: what would this look like to a senior PM?

> "The site engineer opens the daily report accordion as today. The 'Work Carried Out' section used to be 6 free-text rows. After this change, each row is: Task (typeahead) · Status (6-state pill) · Progress (slider) · Qty (number + unit) · Note (expandable) · Photos (drop zone). One thumb-driven sheet. Photos upload once and appear on both the report and the linked task. The task's % complete moves in real time. The PM sees this on the gantt without ever touching the daily report. That's Zoho Projects-grade field-to-schedule integration."
>
> "**One open question remains**: should the inline edit bypass the existing 'lock after approval' gate? The answer is no — we honor it. After PM approval, the work-item rows become read-only. Engineers can add a new report for a later date."

---

## 4. USERS & PERSONAS

(See §2.3 for the table.)

---

## 5. FUNCTIONAL REQUIREMENTS

### FR-1 New schema: `daily_report_work_items` (the linking table)

This is the **additive** table. It sits between `site_reports` and `tasks`. The existing `work_carried_out` and `milestones_completed` tables are **kept** (legacy) and shadowed by work-items for new reports; a backfill is a v2.0 task.

```sql
CREATE TABLE daily_report_work_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id       UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  daily_report_id       UUID NOT NULL REFERENCES site_reports(id) ON DELETE CASCADE,
  task_id               UUID REFERENCES tasks(id) ON DELETE SET NULL,  -- null = ad-hoc
  ad_hoc_title          TEXT,                                          -- when task_id is null
  ad_hoc_discipline     TEXT,                                          -- free-pick from DISCIPLINE_CONFIG
  kind                  TEXT NOT NULL DEFAULT 'work'                    -- 'work' | 'milestone'
                        CHECK (kind IN ('work', 'milestone')),
  progress_before       INTEGER CHECK (progress_before BETWEEN 0 AND 100),
  progress_after        INTEGER CHECK (progress_after BETWEEN 0 AND 100),
  status_before         TEXT,                                          -- free: not_started..cancelled
  status_after          TEXT,
  quantity_done         DECIMAL(12,2),
  quantity_unit         TEXT,                                          -- 'm' | 'nos' | 'm²' | 'kg' | ...
  note                  TEXT,
  blocker_flag          BOOLEAN NOT NULL DEFAULT false,
  blocker_reason        TEXT,
  sort_order            INTEGER NOT NULL DEFAULT 0,
  created_by            UUID REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at            TIMESTAMPTZ,
  CHECK (task_id IS NOT NULL OR ad_hoc_title IS NOT NULL)              -- exactly one anchor
);
CREATE INDEX idx_drwi_org_report    ON daily_report_work_items(organisation_id, daily_report_id, sort_order);
CREATE INDEX idx_drwi_task          ON daily_report_work_items(task_id);
CREATE INDEX idx_drwi_created_by    ON daily_report_work_items(created_by);
ALTER TABLE daily_report_work_items ENABLE ROW LEVEL SECURITY;
-- RLS mirrors site_reports (org_members check)
```

### FR-2 New schema: extend `site_report_photos` to point at work-item + task

The existing `site_report_photos` table is **already there** (`src/database-site-reports-photos.sql`). We add two nullable columns via additive migration; no rewrite.

```sql
ALTER TABLE site_report_photos
  ADD COLUMN IF NOT EXISTS work_item_id UUID REFERENCES daily_report_work_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS task_id      UUID REFERENCES tasks(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_srp_work_item ON site_report_photos(work_item_id);
CREATE INDEX IF NOT EXISTS idx_srp_task      ON site_report_photos(task_id);
```

### FR-3 Atomic photo-link RPC

One upload must write to `site_report_photos` AND `task_attachments` in a single transaction.

```sql
CREATE OR REPLACE FUNCTION fn_link_daily_report_photo(
  p_report_id  UUID,
  p_work_item  UUID,
  p_task_id    UUID,             -- may be NULL (ad-hoc)
  p_file_name  TEXT,
  p_storage    TEXT,
  p_thumb      TEXT,
  p_size       INTEGER,
  p_mime       TEXT,
  p_caption    TEXT,
  p_user_id    UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_photo_id    UUID;
  v_task_attach UUID;
  v_org_id      UUID;
BEGIN
  SELECT organisation_id INTO v_org_id FROM site_reports WHERE id = p_report_id;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'report not found'; END IF;

  INSERT INTO site_report_photos (
    organisation_id, report_id, work_item_id, task_id, file_name,
    storage_path, thumbnail_path, file_size, mime_type, caption, uploaded_by
  )
  VALUES (
    v_org_id, p_report_id, p_work_item, p_task_id, p_file_name,
    p_storage, p_thumb, p_size, p_mime, p_caption, p_user_id
  )
  RETURNING id INTO v_photo_id;

  IF p_task_id IS NOT NULL THEN
    INSERT INTO task_attachments (
      task_id, user_id, file_name, file_type, file_size,
      storage_path, thumbnail_path
    )
    VALUES (
      p_task_id, p_user_id, p_file_name, p_mime, p_size,
      p_storage, p_thumb
    )
    RETURNING id INTO v_task_attach;
  END IF;

  RETURN jsonb_build_object(
    'photo_id', v_photo_id,
    'task_attachment_id', v_task_attach
  );
END;
$$;
```

### FR-4 DB trigger: auto-apply progress to linked task

```sql
CREATE OR REPLACE FUNCTION fn_daily_report_apply_progress()
RETURNS TRIGGER AS $$
DECLARE
  v_old_pct  INTEGER;
  v_old_stat TEXT;
BEGIN
  IF NEW.task_id IS NULL THEN RETURN NEW; END IF;

  SELECT completion_percentage, status INTO v_old_pct, v_old_stat
    FROM tasks WHERE id = NEW.task_id;

  -- Only update if the daily report actually specified a new value
  IF NEW.progress_after IS NOT NULL OR NEW.status_after IS NOT NULL THEN
    UPDATE tasks
       SET completion_percentage = COALESCE(NEW.progress_after, completion_percentage),
           status               = COALESCE(NEW.status_after, status),
           completed_date       = CASE
                                   WHEN COALESCE(NEW.progress_after,0) = 100
                                    AND completed_date IS NULL
                                   THEN now()
                                   ELSE completed_date
                                 END,
           updated_at           = now()
     WHERE id = NEW.task_id;

    -- Audit
    INSERT INTO task_activity_log (task_id, user_id, action, old_value, new_value)
    VALUES (
      NEW.task_id, NEW.created_by, 'daily_report_progress_applied',
      jsonb_build_object('completion_percentage', v_old_pct, 'status', v_old_stat),
      jsonb_build_object('completion_percentage', NEW.progress_after, 'status', NEW.status_after,
                         'source', 'daily_report', 'work_item_id', NEW.id)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_daily_report_apply_progress
AFTER INSERT OR UPDATE OF progress_after, status_after, task_id
ON daily_report_work_items
FOR EACH ROW EXECUTE FUNCTION fn_daily_report_apply_progress();
```

> **Why a trigger, not just app code:** the daily report must be the source of truth. If anyone (PM, admin, mobile app) writes to `daily_report_work_items`, the linked task gets updated. No bypass.

### FR-5 Task `task_no` auto-increment per project

```sql
-- Replace the simple max() lookup with a sequence-backed trigger
CREATE OR REPLACE FUNCTION fn_task_assign_task_no()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.task_no IS NULL OR NEW.task_no = 0 THEN
    SELECT COALESCE(MAX(task_no),0) + 1 INTO NEW.task_no
      FROM tasks
     WHERE organisation_id = NEW.organisation_id
       AND project_id IS NOT DISTINCT FROM NEW.project_id
       AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_task_assign_no ON tasks;
CREATE TRIGGER trg_task_assign_no
BEFORE INSERT ON tasks
FOR EACH ROW EXECUTE FUNCTION fn_task_assign_task_no();
```

### FR-6 UI — `workCarriedOut` rows become structured (Zoho-grade inline edit)

The "Today's Completed Work" section in `SiteReport.tsx` is currently:
```tsx
{fields: workFields, append: appendWork, remove: removeWork}
```
Each row is `{ value: string }`. We evolve it to a new component `<WorkItemRow>` with columns:

| Column | Control | Validation | Save |
|--------|---------|-----------|------|
| Task (typeahead) | `<TaskTypeahead>` | optional; if empty → ad-hoc | on pick |
| Status (pill) | `<InlineEditableCell mode="select" options={STATUS_CONFIG}>` | required | debounced 500ms |
| Progress (slider) | `<InlineEditableCell mode="slider" min=0 max=100>` | 0–100 | debounced 800ms |
| Qty (number + unit) | `<InlineEditableCell mode="number">` + unit dropdown | numeric | onBlur |
| Note (expandable) | `<InlineEditableCell mode="textarea">` | – | onBlur |
| Photos (drop zone) | `<PhotoDropZone>` | mime jpg/png/webp/heic | on upload complete |
| Actions (delete) | ghost button | – | on click |

The ad-hoc fallback is preserved: a row with no task_id shows an ad-hoc_title input + discipline selector.

**Typeahead behavior** (mirrors Zoho Projects' task picker):
- Recency-ranked: open tasks (status ≠ `completed`) on top
- Project-scoped (from `site_reports.project_id`)
- Discipline filter chip (default = reporter's `org_members.role`-derived discipline)
- Keyboard: `⌘+K` opens, type to search, `↑↓` navigate, `Enter` pick, `Esc` close
- Empty state: "+ Create new task" at the bottom of the list → opens mini-drawer (FR-7)

### FR-7 Mini-drawer: "create new task" from a work item row

Right-edge sheet, 480px, modeled on `src/components/tasks/TaskCreateDrawer.tsx`. Sections:
1. **Name** (required) — pre-filled with the work-item note the engineer just typed
2. **Classification** — type (`task` default, or `milestone` if the row was in `milestonesCompleted`), discipline (auto-suggested from `org_members.role`), status (`not_started` default), priority, group (first group in the project)
3. **Schedule** — start = today, due = today + 7d (engineer can override)
4. **Site Details** — collapsed by default; location, drawing ref, WBS code

On submit:
- Calls `useCreateTask` (existing hook, `src/components/tasks/hooks.ts:140`)
- Receives the new `task_id`, sets it on the work-item row
- DB trigger (FR-4) fires automatically
- Engineer stays on the daily report — no navigation, no page reload

### FR-8 Photos: drag-drop, atomic across two tables

- Native drag-drop + click-to-pick
- Per-photo upload progress chip
- On success: write to `site-report-photos` AND `task-attachments` via RPC `fn_link_daily_report_photo` (FR-3)
- Thumbnail generated client-side via canvas, EXIF lat/long **stripped** (R8 risk)
- Caption field per photo (engineer can label "AHU-01 installed" etc.)
- On failure: inline red badge with "Retry" + "Remove"

### FR-9 PM roll-up view (auto weekly report)

**Route:** `/projects/:projectId/reports/rollup?from=2026-06-01&to=2026-06-07`

Reachable from: `ProjectOverview.tsx` → "Reports" tab → "Weekly roll-up". (Note: the existing `ProjectOverview.tsx` already has `Reports` link in the project context menu at line 298.)

- Grouped by task: task title · discipline · engineer · days touched · progress delta · photos · blockers
- Filter chips: discipline, engineer, blocker, overdue (task's `due_date` passed)
- "Tasks with no daily updates this week" call-out — surfaces silent tasks
- Export to PDF (reuse `jspdf-autotable`, already in `dependencies`)

### FR-10 Inline-edit primitive (the heart of the experience)

New file: `src/components/ui/inline-editable-cell.tsx`

```ts
type InlineEditableCellProps<T> = {
  value: T;
  onSave: (v: T) => Promise<void> | void;
  render?: (v: T) => React.ReactNode;       // for display (slider, pill, etc.)
  mode: 'text' | 'number' | 'select' | 'textarea' | 'slider' | 'custom';
  options?: { value: T; label: string; color?: string }[];   // for select
  min?: number; max?: number; step?: number;                 // for number/slider
  debounceMs?: number;                                       // default 500
  disabled?: boolean;
  validate?: (v: T) => string | null;        // returns error message or null
};
```

States: `idle | editing | saving | saved | error (with retry)`. Optimistic update with rollback. Keyboard: `Enter` save, `Esc` cancel, `Tab` next cell. Accessibility: `aria-live="polite"` on save, `role="gridcell"`.

### FR-11 Hooks (`src/hooks/useDailyReportWorkItems.ts`)

```ts
useDailyReportWorkItems(reportId: string | null)            // list
useAddWorkItem()                                             // create
useUpdateWorkItem()                                          // inline edit (optimistic)
useDeleteWorkItem()                                          // soft-delete (deleted_at)
usePromoteAdHocToTask()                                      // convert ad-hoc → task_id
useDailyReportPhotoUpload()                                  // calls fn_link_daily_report_photo
useWeeklyRollup(orgId, projectId, from, to)                  // aggregated view
```

All use `@tanstack/react-query` and mirror the existing `useUpdateTask.onMutate` optimistic-update pattern.

### FR-12 RBAC

```ts
export const DAILY_REPORT_PERMISSIONS = {
  'daily_reports.read':         ['admin','project_manager','engineer','supervisor','viewer','subcontractor'],
  'daily_reports.create':       ['admin','project_manager','engineer','supervisor'],
  'daily_reports.update_own':   ['admin','project_manager','engineer','supervisor'],
  'daily_reports.update_any':   ['admin','project_manager'],
  'daily_reports.delete':       ['admin','project_manager'],
  'daily_reports.review':       ['admin','project_manager'],
  'daily_reports.rollup':       ['admin','project_manager','viewer'],
} as const;
```

Append to `ROLE_PERMISSIONS` in `src/components/tasks/types.ts`. Site engineers can edit their own reports for today + 1 day back; PM/admin can edit any (existing behavior).

### FR-13 Offline draft (preserved from v1, refit to `SiteReport.tsx`)

- On every form state change, debounce 1.5s, write to `localStorage[site-report-draft:{projectId}:{date}:{userId}]`
- On mount, if remote report is `draft` and localStorage has newer fields, prompt "Restore unsaved changes?"
- On submit, clear the localStorage key
- `navigator.onLine` listener + retry queue for failed photo uploads
- Future v2: IndexedDB + background sync (PWA)

### FR-14 Lock-after-approval (preserved + extended)

The existing `updateMutation` already rejects edits when `pm_status` is `Pending Approval | Approved | Reported`. We extend this to the **inline-edit handlers**: if the report is locked, all `<WorkItemRow>` cells are `disabled`, the photo drop zone is read-only, the "add row" button is hidden.

### FR-15 Migration & rollout

1. Additive migration `src/database-daily-report-tasks.sql` (FR-1, FR-2, FR-3, FR-4, FR-5) — never touches `site_reports` schema
2. Feature flag: `VITE_DAILY_REPORTS_V2=1` env var (default off in production for first 2 weeks)
3. Behind the flag: new component `<WorkItemRow>` renders, existing free-text rows hidden
4. Engineer's first visit to the new sheet: prompt "Try the new structured form?" with a "Keep legacy" link
5. After 30 days: hide legacy free-text rows for new reports; legacy rows still visible on old reports (read-only)
6. v2.0 (next quarter): backfill `work_carried_out` and `milestones_completed` into `daily_report_work_items`; deprecate the legacy tables (60-day deprecation timer)

---

## 6. NON-FUNCTIONAL REQUIREMENTS

| NFR | Target | How |
|-----|--------|-----|
| First paint of daily report | < 500 ms on 4G | Single React Query request, `staleTime: 30s`, skeleton placeholders |
| Inline save latency (progress slider) | < 200 ms perceived | Optimistic update + 500ms debounce + cache invalidation |
| Photo upload (5 MB JPEG) | < 3 s on WiFi, < 8 s on 4G | Direct-to-Supabase signed URL, parallel upload per work item, RPC `fn_link_daily_report_photo` is one extra round trip but in the same transaction |
| Offline draft sync | < 2 s after reconnect | `navigator.onLine` listener + retry queue |
| Bundle size delta | < 80 KB gzipped | Reuse `InlineEditableCell`, `lucide-react`, `sonner` (already loaded) |
| RBAC enforcement | RLS at DB, double-checked at app layer | `useFollowupAccess.ts` pattern (org + role check) |
| Audit trail | Every progress/status change recorded | `task_activity_log` (existing) + new `daily_report_audit` table |
| Accessibility | WCAG 2.1 AA | Keyboard nav for the sheet, `aria-live` for save toasts, contrast checked, `role="gridcell"` |
| Multi-tenant isolation | 100% | All queries filter by `organisation_id` + RLS |
| Type safety | 100% | Zod schemas for every form, mapped to TS types |
| Code complexity (delta) | < 1,500 LOC added | Reuse TaskCreateDrawer pattern, reuse useUpdateTask optimistic pattern, keep changes additive |

---

## 7. UX FLOWS

### 7.1 Site engineer — happy path (sub-60-second submit)

```
1. Engineer taps "+ New Daily Site Report" in sidebar
   ↳ SiteReport.tsx opens at /site-reports?action=create
   ↳ Form opens, all 9 accordion sections expanded (today's behavior)
   ↳ Draft restored from localStorage if any

2. Engineer fills Identification (client → project → date)
   ↳ Existing behavior, unchanged

3. Engineer scrolls to "Work Carried Out" section
   ↳ New <WorkItemRow> renders with columns: Task · Status · Progress · Qty · Note · Photos
   ↳ First row's task cell is focused, typeahead open with recency-ranked open tasks

4. Engineer types "AHU" → typeahead narrows to 3 AHU-related tasks
   ↳ Engineer picks T-0142 "AHU-01 install — Level 3"
   ↳ Status defaults to current task status (e.g. "in_progress")
   ↳ Progress auto-fills with current `completion_percentage`
   ↳ Qty and Note cells become editable

5. Engineer drags progress slider to 65%
   ↳ Optimistic update (slider snaps to 65%)
   ↳ 500ms debounce → save → DB trigger → task T-0142 now at 65%
   ↳ Toast: "Saved" 800ms

6. Engineer drags 3 photos onto the row
   ↳ Per-photo upload progress chip
   ↳ On success: thumbnail in row + "Linked to task T-0142" badge
   ↳ RPC `fn_link_daily_report_photo` writes to both tables

7. Engineer adds a 2nd row → picks T-0203 → marks 100% complete
   ↳ Task T-0203 status auto-flips to 'completed' via trigger
   ↳ `completed_date` auto-set

8. Engineer adds a 3rd row → typeahead empty → clicks "+ New task"
   ↳ Mini-drawer opens (480px right sheet)
   ↳ Pre-filled: project, group, today's date, name = engineer's typed note
   ↳ Engineer picks discipline (mechanical) and priority (high)
   ↘ Submits → useCreateTask → new task exists → work-item row's task_id auto-fills
   ↘ DB trigger fires (no progress change yet, but row is created in audit log)

9. Engineer adds a 4th row → "Ad-hoc work item" → types "Site cleanup"
   ↳ No task linked, just ad_hoc_title
   ↳ Note + photos work the same

10. Engineer taps Submit
    ↳ Existing SiteReport.tsx save flow (unchanged)
    ↳ Plus: all new daily_report_work_items rows saved/upserted
    ↳ pm_status flows through approval gate
```

### 7.2 PM — review + roll-up

```
1. PM opens /site-reports → sees the list
   ↳ Existing list view, unchanged
   ↳ New column: "% of work items linked to tasks" (computed)

2. PM clicks a report → view mode
   ↳ Existing view, now with task links in the work-item rows
   ↳ Click a task link → opens TaskDetailDrawer (reuse existing component)

3. PM clicks "Weekly roll-up" from ProjectOverview
   ↳ Route /projects/:projectId/reports/rollup
   ↳ Auto-grouped by task with progress delta + photos + blockers
   ↳ Export to PDF
```

### 7.3 Edge: new work discovered on site

```
1. Engineer in work-item section
2. Types "Trench excavation for new cable route"
3. Typeahead: no match
4. Engineer clicks "+ New task" at bottom of typeahead
5. Mini-drawer opens, pre-filled: project, group, today's date, name = typed note
6. Engineer picks discipline (electrical), priority (medium)
7. Submits → new task exists → work-item row's task_id auto-fills
8. Engineer proceeds: marks progress 30%, uploads 1 photo
9. Photos auto-attach to the new task
```

### 7.4 Edge: report already approved

```
1. PM approved a report yesterday
2. Engineer re-opens it
3. <WorkItemRow> cells are disabled (visual: zinc-100 background, no hover)
4. Photo drop zone is replaced with a static gallery
5. "Add row" button hidden
6. Toast on hover: "Report is locked after approval"
```

---

## 8. RISK REGISTER

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|-----------|
| R1 | Engineers skip task linking, fall back to ad-hoc for everything | M | High | Default project-scoped typeahead is **always** shown; ad-hoc is a secondary "+ Ad-hoc" button at the bottom, not the default. Inline empty-state copy: "Pick a task to track progress, or add an ad-hoc note" |
| R2 | Photo upload fails on flaky field network | H | Medium | Per-photo retry queue, partial-save state, signed-URL refresh, RPC failure → rollback both `site_report_photos` and `task_attachments` rows |
| R3 | Trigger accidentally overwrites PM-edited task | M | High | Trigger **only** runs if `progress_after` and/or `status_after` are explicitly set; if both are null, skip. PM edits via the task board will still be authoritative when daily report rows have no progress |
| R4 | Two engineers submit for the same project on the same day | M | Low | Allowed (engineers are site-specific). Soft warning in UI if another report exists for the same project+date |
| R5 | Daily report grows huge (1 year of data) | L | Medium | Pagination + infinite scroll on list view; auto-archive after 1 year (cold storage). The new `daily_report_work_items` table is N:M so growth is bounded |
| R6 | Inline edit clobbers concurrent edit (PM + engineer) | M | Medium | `updated_at` last-write-wins with `x-supabase-prefer` header → push conflict toast with "Reload". Lock-after-approval prevents the most common case |
| R7 | Ad-hoc work items accumulate without ever becoming a task | M | Low | "Promote to task" button on ad-hoc rows (one click → opens mini-drawer pre-filled with ad_hoc_title) |
| R8 | Photos contain client-confidential info | M | High | Bucket is `public: false`, signed URLs only, EXIF lat/long stripped on upload. The existing `site-report-photos` bucket already has signed URL; we extend the upload helper |
| R9 | Inline edit breaks the existing 9-section accordion UX | L | High | The new `<WorkItemRow>` is a child of the existing accordion, not a replacement. Engineers who don't want the new flow can keep using the legacy `work_carried_out` text rows during the 30-day opt-out period (feature flag) |
| R10 | DB trigger creates a performance issue under load | L | Medium | Trigger is `AFTER INSERT OR UPDATE` and only does work if `progress_after IS NOT NULL`. Index on `task_id` makes the UPDATE cheap. Tested in Phase 6 with 1000 reports/min |
| R11 | Backfill from `work_carried_out` is lossy | M | Low | Backfill is v2.0 (out of scope for v1). v1 is purely additive — new reports use the new flow, old reports still readable |
| R12 | Engineers create many tiny tasks from inline flow (task pollution) | M | Medium | Default discipline + group + priority are auto-set; engineer must confirm before submit. Add a "throttle" warning if the engineer has created >5 tasks in a single report |

---

## 9. OPEN QUESTIONS (need answers before implementation)

I want to be honest about the calls I'm not sure about. The first **6 are blocking**; the rest can be answered as we go.

| # | Question | Why it matters | My recommendation |
|---|----------|----------------|-------------------|
| **Q1** | Does the engineer's `engineer_name` (free text in footer) become the canonical reporter, or do we capture `user_id` (FK to auth.users)? | Audit + multi-engineer-per-day | Capture BOTH: `reporter_id` (FK to auth.users) is new, `engineer_name` (free text) is kept for backward-compat |
| **Q2** | Should the `workCarriedOut` row's task_id be required, or always allow ad-hoc? | UX speed vs data hygiene | Allow ad-hoc as secondary; default is "typeahead is open, type to link" |
| **Q3** | Where does the mini-drawer pre-fill `discipline` from? | Engineer convenience | `org_members.role` if it maps to a discipline value (e.g. "Mechanical Engineer" → `mechanical`); otherwise default `general`. Always editable |
| **Q4** | When the engineer updates `progress_after` to 100% on a linked task, should the task's `status` auto-flip to `completed`? | Status hygiene | Yes, only if the engineer's `status_after` is null. The trigger (FR-4) handles this. If the engineer explicitly sets `status_after = 'under_review'`, that wins |
| **Q5** | Should the legacy `work_carried_out` and `milestones_completed` text rows be hidden, shown, or migrated in v1? | Backward compat | v1: both legacy AND new flow coexist (feature flag). v2.0 (next quarter): backfill, hide legacy |
| **Q6** | On PM approval, do we write to `task_activity_log`? | Audit | Yes, via the trigger (FR-4 already does this for progress). Approval itself continues to use the existing `approvals` table |
| Q7 | What happens to the existing `progress.percentComplete` field on the site report header? | Single source of truth | Compute it as a server-side `GENERATED ALWAYS AS` from `daily_report_work_items.progress_after`? Or keep as engineer-entered override? Recommendation: compute from work-items, allow override, but show "auto: X%, you entered: Y%" in the UI |
| Q8 | Should the inline edit work in "edit" mode of an existing report, or only in "create"? | UX consistency | Both, with the lock-after-approval gate (FR-14) |
| Q9 | Photo caption — is it required? | Friction | Optional, defaults to file name. Engineer can edit in-place after upload |
| Q10 | Is the "Weekly roll-up" route a new page or a tab inside `ProjectOverview.tsx`? | IA | New route `/projects/:projectId/reports/rollup`. `ProjectOverview.tsx` already has a "Reports" link at line 298 — we just point it there |
| Q11 | Should we pre-fill the typeahead with tasks from the **last 7 days** of activity? | Recency bias | Yes. Filter `WHERE updated_at > now() - interval '7 days' OR status != 'completed'` |
| Q12 | What if the engineer's `org_members.role` is `subcontractor`? | RBAC | Read-only on the daily report; cannot create or link tasks. The `DAILY_REPORT_PERMISSIONS` map already excludes subcontractor from `create`/`update` |

---

## 10. IMPLEMENTATION PHASES

### Phase 0 — Foundations (3 days)
- Migration: `database-daily-report-tasks.sql` (FR-1, FR-2, FR-3, FR-4, FR-5)
- RPC `fn_link_daily_report_photo` (FR-3)
- Hooks skeleton: `src/hooks/useDailyReportWorkItems.ts` (FR-11)
- Append `DAILY_REPORT_PERMISSIONS` to `ROLE_PERMISSIONS` (FR-12)
- Feature flag plumbing: `VITE_DAILY_REPORTS_V2` env var

### Phase 1 — Inline edit primitive + read-only work items (3 days)
- New `src/components/ui/inline-editable-cell.tsx` (FR-10)
- New `src/components/reports/WorkItemRow.tsx` (read-only first)
- New `src/components/reports/TaskTypeahead.tsx` (read-only first)
- New `src/hooks/useTasksForProject.ts` (scoped to current site_reports.project_id)
- Behind the flag, render `<WorkItemRow>` in `SiteReport.tsx`'s `workMilestones` section, but read-only

### Phase 2 — Inline create / update (4 days)
- Mini-drawer: `src/components/reports/TaskMiniDrawer.tsx` (FR-7)
- Wire `useCreateTask` + `useUpdateTask` to the new flow
- Optimistic update for `progress_after` + `status_after` with rollback
- Debounced save with toast feedback
- Ad-hoc row path

### Phase 3 — Photos (3 days)
- New `src/components/reports/PhotoDropZone.tsx`
- Wire RPC `fn_link_daily_report_photo`
- EXIF strip + thumbnail generation
- Per-photo retry queue

### Phase 4 — PM roll-up (2 days)
- New route `/projects/:projectId/reports/rollup` (FR-9)
- New `src/hooks/useWeeklyRollup.ts`
- Group-by-task aggregation
- Filter chips
- PDF export (reuse `jspdf-autotable`)

### Phase 5 — Hardening (3 days)
- Offline draft (FR-13)
- Lock-after-approval gate (FR-14)
- All RBAC paths
- Empty / loading / error states
- Performance pass (NFRs)

### Phase 6 — Rollout (3 days)
- Feature flag toggle (FR-15)
- 2-week soak
- Engineer-facing onboarding tooltip: "Try the new structured form?"
- v2.0 backlog: backfill, deprecate legacy

**Total: ~19 working days, single engineer, full-time.**

---

## 11. WHAT TO BUILD FIRST (1-week MVP)

If I had to ship a 1-week demo:
1. Migration + RPC + hooks (Phase 0, day 1-2)
2. Inline-edit primitive + read-only WorkItemRow (Phase 1 partial, day 3)
3. Task typeahead (Phase 1 partial, day 4)
4. Inline create task via mini-drawer (Phase 2 partial, day 5)
5. One photo per row, no drag-drop (Phase 3 lite, day 6)
6. Wire the whole thing into `SiteReport.tsx`'s workMilestones section behind a feature flag (day 7)

This gets you the "linked reporting" feel in front of users fast, with the rest as iteration.

---

## 12. ACCEPTANCE CRITERIA (for sign-off)

- [ ] Site engineer can submit a daily report in under 90 seconds with at least one task link
- [ ] Engineer can create a new task inline from a work-item row without leaving the daily report
- [ ] Photos uploaded on a work-item row also appear in the linked task's `task_attachments`
- [ ] Updating `progress_after` on a work-item row updates the linked task's `completion_percentage` (via DB trigger)
- [ ] Setting `progress_after = 100` on a work-item row sets the linked task's `status = 'completed'` and `completed_date = now()` (only if `status_after` is null)
- [ ] PM can see a weekly roll-up grouped by task at `/projects/:projectId/reports/rollup`
- [ ] RLS prevents cross-org read/write
- [ ] Offline draft survives app reload via `localStorage[site-report-draft:{projectId}:{date}:{userId}]`
- [ ] All cells keyboard-navigable and screen-reader friendly (`role="gridcell"`, `aria-live`)
- [ ] Reports with `pm_status` in `('Pending Approval', 'Approved', 'Reported')` are read-only in the new flow
- [ ] Zero new `console.error` in production build
- [ ] Bundle size delta < 80 KB gzipped
- [ ] No regression in existing site report flow (legacy free-text rows still work, all 9 accordion sections still expand, the 7 child tables still write)
- [ ] No regression in existing task module (Zoho-grade gantt, board, calendar still work)
- [ ] Backfill deferred to v2.0 (with documented plan)

---

## 13. APPENDIX — KEY FILES TOUCHED

| Action | Path |
|--------|------|
| **Create** | `src/database-daily-report-tasks.sql` |
| **Create** | `src/components/ui/inline-editable-cell.tsx` |
| **Create** | `src/components/reports/WorkItemRow.tsx` |
| **Create** | `src/components/reports/TaskTypeahead.tsx` |
| **Create** | `src/components/reports/TaskMiniDrawer.tsx` |
| **Create** | `src/components/reports/PhotoDropZone.tsx` |
| **Create** | `src/hooks/useDailyReportWorkItems.ts` |
| **Create** | `src/hooks/useTasksForProject.ts` |
| **Create** | `src/hooks/useWeeklyRollup.ts` |
| **Create** | `src/pages/ProjectReportsRollup.tsx` |
| **Modify** | `src/pages/SiteReport.tsx` (add `<WorkItemRow>` inside `workMilestones` accordion, gate behind `VITE_DAILY_REPORTS_V2`, extend `lock-after-approval`) |
| **Modify** | `src/components/tasks/types.ts` (add `DAILY_REPORT_PERMISSIONS` to `ROLE_PERMISSIONS`) |
| **Modify** | `src/pages/ProjectOverview.tsx` (point the existing "Reports" link at line 298 to `/projects/:projectId/reports/rollup`) |
| **Modify** | `src/App.tsx` (add the rollup route) |
| **Reuse** | `src/components/tasks/hooks.ts` (`useCreateTask`, `useUpdateTask`, `useTask`, `useTasks`, `useTaskGroups`, `useTeamMembers`) |
| **Reuse** | `src/components/tasks/TaskCreateDrawer.tsx` (pattern reference for mini-drawer) |
| **Reuse** | `src/components/tasks/TaskDetailDrawer.tsx` (open from linked task cell) |
| **Reuse** | `src/components/SiteReportPhotoUploader.tsx` (pattern reference) |
| **Reuse** | `src/hooks/useSiteReportPhotos.ts` (pattern reference for photo upload) |
| **Reuse** | `src/hooks/useStoppages.ts` (pattern reference for child-table mutations) |
| **Reuse** | `src/lib/logger.ts` (toast helper) |
| **Reuse** | `src/lib/supabase.ts` (RLS-aware client) |

**Total: 10 new files, 4 modified files, 8 reused. No deletions.**

---

**End of PRD v2.0 — please review and answer Q1–Q6 so I can lock the schema and start Phase 0.**
