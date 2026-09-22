# COLLAB-TASK-REMINDER-AUDIT.md — PHASE 0 FORENSIC AUDIT

Status: **COMPLETE** · Date: 2026-09-19 · Method: repository + live-DB baseline snapshots only (`apps/web/supabase/remediation/baseline_*.json|ts`). No assumptions.

Repo state at audit time: branch `main`, head `c4cc6e0`, 35 uncommitted files from unrelated work (manufacturing / subcontractor-v2 / collaboration component polish). **None of the uncommitted collaboration diffs implement tasks/reminders** — they are UI polish + `UserAvatar` extraction.

---

## 1. Current Collaboration architecture

### 1.1 Web (the only real implementation)

Package: `apps/web/src/projects/features/collaboration/`

| File | Role |
|---|---|
| `api.ts` (273 L) | RPC + table wrappers. RPCs: `get_or_create_project_channel`, `send_collaboration_message`, `mark_channel_read`, `add_reaction`, `remove_reaction`, `soft_delete_message`, `add_collaboration_attachment`, `search_collaboration_messages`. Cursor pagination (50/page, newest-first roots). `Zod` `SendMessageRpcSchema` enforced **in DEV only** (`import.meta.env.DEV`). |
| `hooks.ts` (256 L) | TanStack Query v5. Query keys are **inline** in a module-local `KEY` object: `['collab','channel',projectId]`, `['collab','messages',channelId]`, `['collab','thread',parentId]`, `['collab','reactions',ids]`, `['collab','read',channelId,userId]`, `['collab','search',channelId,term]`, `['collab','members',channelId]`. `useMessages` = `useInfiniteQuery`. Optimistic send with `optimistic:<clientMsgId>` placeholder ids. |
| `store.ts` | Zustand UI store: composer drafts, `openThreadId`, filter, mobile drawer, pane management (`openProjectIds`, `activeProjectId`). |
| `types.ts` | `Message.metadata` = `{ mentions?: string[], linked_entities?: LinkedEntity[], client_msg_id?, deleted?, ai? }`. `LinkedEntity.type` union **already includes `'task'`** (`task, work_order, issue, daily_report, document, rfi, boq, material, po`) with `{ id, label, snapshot? }`. |
| `useRealtimeChannel.ts` (114 L) | Scoped `postgres_changes` subscription on `project_collaboration_messages` (INSERT/UPDATE/DELETE, `filter: channel_id=eq.X`) → reconciles React Query cache, replaces optimistic rows by `client_msg_id`. Reactions handled separately. |
| `components/` | `CollaborationWorkspace`, `ProjectListRail`, `ProjectPane` (as `ProjectCollaborationTab`), `ChannelHeader`, `MessageList`, `ThreadRail`, `ThreadPane`, `Composer`, `MessageBubble`, `ReactionBar`, `LinkedEntityChips`, `DailyReportCard`, `ThreadSummary`, `UserAvatar`, `AttachmentPreview`. |

Message action surface today (`MessageBubble.tsx`): hover toolbar = **React (emoji) + Delete + (own messages) "Edit (v1: resend)" stub**. **No reply button (threading is entered elsewhere), no Task, no Reminder.** Thread replies are sent via `Composer parentMessageId`.

`+ Add` menu: **does not exist.** Composer has paperclip/camera/mic/emoji/mention only.

Mobile: `apps/mobile/src/modules/collaboration/` **does not exist**. The mobile app (`apps/mobile/src`, 22 screens, no `useAuth` module parity) has zero collaboration references. Spec §1's "mobile target" is aspirational only.

### 1.2 Database

Tables (RLS on, per `baseline_tables.json` / `baseline_database_types.ts`):

- `project_collaboration_channels` — org+project+`channel_type` ('project' default, check allows project/site_coordination/design/procurement/commercial/custom), `name`, `is_archived`, `created_by`.
- `project_collaboration_messages` — `channel_id`, `sender_id`, `parent_message_id` (threading), `message_type` CHECK `('text','photo','file','voice','system','reply')`, `content`, `metadata jsonb`, `client_msg_id` (idempotency), `edited_at`, `deleted_at` (soft delete). No CHECK constraint on `metadata` — extendable without migration.
- `project_collaboration_reactions` — UNIQUE `(message_id, user_id, emoji)`.
- `project_collaboration_read_state` — UNIQUE `(channel_id, user_id)`, `last_read_message_id`.
- `project_collaboration_members` — UNIQUE `(channel_id, user_id)`, `role` ('owner'|'admin'|'member'|'guest'), `last_read_at`.
- `project_collaboration_attachments` — `message_id`, storage bucket/path, `upload_status`, UNIQUE `(message_id, storage_path)`.
- `daily_report_channel_links` — precedent table linking an ERP entity to its channel card message.

**RLS policy style (collaboration)**: org-membership bound — `EXISTS (SELECT 1 FROM org_members om WHERE om.organisation_id = <table>.organisation_id AND om.user_id = auth.uid())`. Insert policies additionally require `sender_id = auth.uid()` / `user_id = auth.uid()`.

**RPC authorization style (collaboration)**: every RPC does `auth.uid()` null-check → resolves `organisation_id` from the target row → org-membership `EXISTS` check → `RAISE EXCEPTION 'forbidden'` → business logic → best-effort `audit_log` insert (`BEGIN … EXCEPTION WHEN OTHERS THEN NULL; END`). `get_or_create_project_channel` uses `pg_advisory_xact_lock(hashtext('collab:' || project_id))`.

**Realtime**: `send_collaboration_message` contains an `ALTER PUBLICATION supabase_realtime`-equivalent? — Not verified in migrations; the frontend subscription works today, so the table is assumed in the `supabase_realtime` publication. Any new table that needs realtime must be added explicitly.

**⚠️ Migration drift (critical finding):** there are **no collaboration/DDL migration files in the repo** for the collaboration tables, `tasks`, `task_*` satellite tables, `org_members`, or `user_can_access_org` — **149 of 218 migration files are 0 bytes** (repo-history casualty), and none of the 69 non-empty files contain `project_collaboration` / `tasks` DDL. However, `baseline_functions.json` contains full RPC bodies (`send_collaboration_message`, `get_or_create_project_channel`, `add_collaboration_attachment`, etc.) proving they exist live. The live DB is ahead of the repo. **Every new schema change must ship as a repo migration file even though the baseline is incomplete**; treat `remediation/baseline_*` as the source of truth for "what exists".

---

## 2. Current Task architecture — two parallel systems exist

### 2.1 System A — ERP "Unified Task Module" (production, project-scoped)

- Table: `tasks` (RLS on, 4 policies). Columns of note: `id`, `organisation_id NOT NULL`, `project_id` **nullable** (FK projects CASCADE), `title NOT NULL`, `status CHECK ('not_started','in_progress','under_review','on_hold','completed','cancelled')`, `priority CHECK ('low','medium','high','critical')`, `task_type CHECK ('task','milestone','deliverable','inspection','rfi','ncr')`, `**assignee_ids uuid[]**` (array!), `subcontractor_ids uuid[]` (per TS types; nullable in baseline), `created_by NOT NULL`, `reporter_id`, `due_date` (date), `completion_percentage`, `parent_task_id` (FK self CASCADE), `task_group_id`, `milestone_id`, `deleted_at`, `is_archived`, `tags uuid[]`? (string[] per types), `discipline`, `wbs_code`.
- Triggers: `trg_task_assign_no` (BEFORE INSERT → `fn_task_assign_task_no`), `set_task_completed_date`, `log_task_activity` (AFTER INSERT/UPDATE), `update_tasks_updated_at`.
- Indexes: project_id, due_date, priority, task_type, discipline, parent_task_id, milestone_id, task_group_id, deleted_at partial. No index on `assignee_ids` (GIN would be needed if queried often; frontend filters with `.overlaps('assignee_ids', …)`).
- Satellites: `task_groups`, `task_comments` (content, parent_id, mentions uuid[], user_id), `task_attachments`, `task_time_logs`, `task_dependencies`, `task_activity_log`, `task_custom_fields`(+values), `task_views`, plus `legacy_tasks`/`legacy_task_groups`/`legacy_project_tasks` (deprecated mirrors).
- RLS (verbatim from `baseline_policies.json`):
  - `tasks_select_org`: org member → SELECT.
  - `tasks_insert_org`: org member with role ∈ ('admin','project_manager','engineer','supervisor') → INSERT.
  - `tasks_update_org`: admin/PM always; engineer/supervisor if assignee or creator; subcontractor only if assignee.
  - DELETE policy: **absent from the four listed policies** — hard delete only via service role; the app soft-deletes (`useDeleteTask` sets `deleted_at` via UPDATE).
- Frontend: `apps/web/src/components/tasks/` (26 files) — `hooks.ts` (913 L, TanStack Query, `taskKeys` factory: `all/lists/list(filters,projectId)/details/detail(id)/groups/dependencies/comments/attachments/timeLogs/activity/views/customFields/assignees`), `types.ts`, `TaskListView`, `TaskBoard`, `TaskGantt`, `TaskCalendar`, `TaskDetailDrawer`, `TaskEditDrawer`, `TaskCreateDrawer`/`TaskCreateModal`, `useTaskPermissions`, `useTaskDnD`, `BulkAssignModal`, time tracking.
- Page: `apps/web/src/pages/TasksPage.tsx` (view switcher Table/Board/Gantt/Calendar + `TaskDetailDrawer`). **Not routed** — `App.tsx` has no `/tasks` case; the component is orphaned but current.
- Assignee picker convention: `supabase.from('org_members').select('user_id, role, user_profiles(full_name, email)')` filtered client-side by `organisationId`. RLS on `org_members` restricts rows to your own org, so org scoping is DB-enforced; **project-scope filtering is not applied by the Task module** (org members are all eligible today).
- Task creation = direct table insert via `useCreateTask` (no RPC). Status/priority enums are lowercase `not_started`/`medium` — **differs from TodoList's `To Do`/`normal` strings**.

### 2.2 System B — Legacy "To do" page (`/todo`, `pages/TodoList.tsx`)

- Same `tasks` table but with a **legacy value vocabulary**: `status ∈ {To Do, In Progress, On Hold, Review, Completed}`, `priority ∈ {normal, high, urgent}`, `is_personal` boolean, `category ∈ {task, idea}`, `client_name`/`client_type`.
- ⚠️ **No `is_personal` column exists in the live `tasks` schema** (verified in `baseline_database_types.ts`). TodoList's personal/idea tabs are silently broken today (inserts reject the column / filters never match). Any personal-task work must decide: add columns to `tasks` (extends System A) or a separate private table.
- Tabs: Team / Personal / Idea / **Reminders** (reads the `reminders` table).
- Sidebar label: "To do" (`/todo`). This is the user-facing page; `TasksPage` (System A UI) is not reachable.

### 2.3 Personal tasks today

`is_personal: boolean` on inserts from TodoList only. Given the column doesn't exist in the DB snapshot, **personal-task privacy is currently NOT implemented at the data layer**, and there are **no RLS policies scoped to `is_personal` or `created_by`** on `tasks` — org members see all org tasks. Spec §18/§19 requires real privacy; this is a genuine gap (Phase 4 will need either a new column + RLS or a personal-task table).

---

## 3. Reminder / To-do / Notification architecture

- `reminders` table — **exists but is org-wide announcements**, not personal reminders: columns `id, organisation_id, title, remind_date date, description, created_by, created_at`; RLS `reminders_org_all` FOR ALL via `user_can_access_org`. Consumers: `pages/RemindMe.tsx` (CRUD org reminders) and TodoList "Reminders" tab (read-only). **No recipient concept, no time-of-day, no status, no per-user privacy.** Spec-compliant reminders need a new recipient-scoped model; do not shoehorn this table (but keep `RemindMe`/announcements working).
- `todos` table — dead legacy: `id, title, status, created_at` only, policies are odd `created_at IS NOT NULL` stubs. Ignore.
- `notifications` table (created by `20260916123000_remediation_missing_404_tables.sql`): `id, user_id NOT NULL, organisation_id NOT NULL, title, body, link, notification_type, read_at, created_at`; RLS: SELECT/UPDATE own row, INSERT by any org member (`user_can_access_org`), index `(user_id, read_at NULLS FIRST, created_at DESC)`. Consumers today: `ClientLookup.tsx` (assignment notice), `lib/workInstructionNotify.ts`. **This is the notification pipe to reuse** — there is no central hook/bell UI; each consumer reads/writes directly.
- Other notification-ish surfaces: `approval_notifications` (approvals module only), `manager_alerts` (MD alerts), `warranty_notifications`. Domain-specific; not general.
- No push/email infra in repo; no cron/pg_cron scheduler. **Scheduled reminder delivery (fire at remind_at) has no existing mechanism** — Phase 5 must scope delivery to "visible in Reminders sub-tab + card"; actual push dispatch would be new infrastructure (defer unless a cron exists).

---

## 4. Existing reusable components & conventions (Phase 1–8 must reuse)

| Need | Reuse |
|---|---|
| Task drawer UI | `TaskCreateDrawer.tsx` (right-side drawer, MultiSelect pills+search assignee picker, checklist-style sections, `TaskGroup` select, priority/status enums from `types.ts`) — extend with Checklist + Source-context rather than building new drawer. |
| Query keys | `taskKeys` in `components/tasks/hooks.ts`; collaboration keys inline `KEY` in `collaboration/hooks.ts`. Add `taskKeys.checklist(taskId)` etc. and `['collab','tasks'|'reminders',…]` following the same shape. |
| Assignee/member sources | `org_members ⋈ user_profiles` (task module); `project_collaboration_members` (channel members, `fetchChannelMembers` returns `MemberSummary[]`). |
| Message → entity card precedent | `DailyReportCard` + `daily_report_channel_links` + `get_or_create_daily_report_message` RPC (system message with `metadata.linked_entities`, idempotent `client_msg_id` like `'dr:<id>'::uuid`). Task/Reminder cards should follow this exact pattern. |
| Optimistic UI + realtime | `collaboration/hooks.ts` optimistic send + `useRealtimeChannel` reconciliation. |
| Drawer primitives | `components/ui/*` (ShadCN: `Button`, `Sheet`-style drawers used across ERP; TaskCreateDrawer is bespoke but consistent). |
| Zod validation | `collaboration/schemas.ts` (+ `schemas.test.ts` vitest) — DEV-only parsing convention. |
| Audit trail | `audit_log` best-effort inserts inside RPCs (collab convention). |

## 5. Gaps (truth vs. spec)

1. **Checklist** — nothing exists for tasks (`task_checklist*` absent everywhere). New normalized table + RLS + hooks + UI required. Phase 1.
2. **Message → Create Task** — no menu items, no Task Drawer integration, no `TaskCard`. `LinkedEntity.type='task'` + `LinkedEntityChips` already render task links, so cards can extend `LinkedEntityChips`/`DailyReportCard` pattern. Phase 3/8.
3. **Add to my task (one-click)** — no personal-task data model (`is_personal` broken). Phase 4.
4. **Reminders (recipient, time, date-less)** — existing `reminders` is announcements-only. New model required. Phase 5–7.
5. **`+ Add` composer menu** — absent. Phase 3 (Task entry only; File/ERP Record already have affordances — File = paperclip; ERP Record = `linked_entities`).
6. **Reminder card in channel** — absent. Phase 8.
7. **Personal task privacy RLS** — absent. Phase 4.
8. **Mobile collaboration** — does not exist; all frozen mobile interactions are deferred until that module exists.
9. **Scheduled reminder delivery** — no cron/scheduler infra. Phase 5 must not promise dispatch.
10. **Routing** — `TasksPage` (System A UI) unrouted; TodoList (System B) is the live page with legacy enums. Phases 1/6 must pick the authoritative page. Recommendation: System A is the ERP source of truth; surface the frozen sub-tabs (`Company Tasks | My Tasks | Reminders`) there, leave `/todo` untouched during implementation.

## 6. Risks

- **Migration drift**: baseline DB ≠ repo migrations. Applying a fresh `supabase db reset` would fail. New migrations must be written to be additive/idempotent and applied against the live DB, never assuming repo completeness.
- **Two task vocabularies** (`not_started/medium` vs `To Do/normal`) share one table; naive UI work could corrupt semantics.
- **`send_collaboration_message` allows any org member to post** — task/reminder card messages must be created via new RPCs following the same org-membership checks (do not widen permissions).
- Realtime publication membership for new tables must be set in the same transaction as DDL (see manager_alerts precedent: `ALTER PUBLICATION supabase_realtime ADD TABLE … EXCEPTION WHEN duplicate_object THEN NULL`).
- 35 files are modified by other work; implementation must not touch or stage unrelated files.

## 7. Recommended implementation points (Phase 1 plan)

**Phase 1 — Task checklist foundation**

1. Migration `apps/web/supabase/migrations/<next-dated>_task_checklist_foundation.sql`:
   - `CREATE TABLE task_checklist_items (id uuid PK default gen_random_uuid(), task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE, title text NOT NULL, is_completed boolean NOT NULL DEFAULT false, completed_by uuid, completed_at timestamptz, sort_order integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());`
   - Indexes `(task_id, sort_order)`, `(organisation_id)`; RLS enable; policies:
     - SELECT: org member AND (task visible per `tasks_select_org` semantics);
     - INSERT/UPDATE/DELETE: org member with the same role/assignment rules as `tasks_update_org` (mirror the existing policy SQL, joined through `task_checklist_items.task_id`), `WITH CHECK` including organisation match — so a user can never write a checklist row into a task of another org.
   - Trigger: `set_task_checklist_updated_at` (reuse `update_updated_at_column()`).
2. Types + hooks: `components/tasks/types.ts` (`TaskChecklistItem`), `hooks.ts` (`taskKeys.checklist(taskId)`, `useTaskChecklist`, `useCreateChecklistItem`, `useUpdateChecklistItem` with `completed_by/completed_at` set client-of-RPC? → prefer new RPC `toggle_task_checklist_item(p_item_id, p_is_completed)` enforcing the same authorization server-side and stamping `completed_by = auth.uid(), completed_at = now()`), `useDeleteChecklistItem`, `useReorderChecklistItems`. Optimistic updates mirroring `useUpdateTask`.
3. UI: extend `TaskCreateDrawer` (local draft items on create) and `TaskDetailDrawer` (live items, toggle, reorder, attribution "Completed by X · time", progress "Checklist 2 / 3"). Progress derived, not stored (no second status system).
4. Update `useCreateTask` to insert items after task insert (best-effort transactional: create task → bulk insert items; on item failure delete orphan task or surface error).
5. Verification: vitest for new schemas/helpers; manual scenarios 1–11 (create w/o items, create w/ 3, edit, reorder, complete/uncomplete, `completed_by/at` attribution, progress, org isolation, personal isolation once Phase 4 lands); typecheck `pnpm --filter mep-project typecheck`.

**Later phases (summary)**: Phase 2 multi-assignee = already supported by `assignee_ids`; work is UI + validation + `useTaskPermissions` + tests. Phase 3 `+` menu + hover `Task` action + drawer pre-population + `create_task_from_message` RPC (writes `tasks` + card message with `metadata.linked_entities=[{type:'task',id,label}]`, idempotent via `client_msg_id='task:<taskNo>'`). Phase 4 personal-task model decision (add `is_personal`/`created_by`-scoped RLS vs separate `personal_tasks` table — needs explicit design review). Phase 5 new `task_reminders` table (creator ≠ recipients, `remind_at` nullable, `status`, source message refs) + RPCs. Phase 6 sub-tab UI. Phase 7 message → Set Reminder drawer + `create_reminder_from_message` RPC. Phase 8 cards via `DailyReportCard` pattern.

## 8. Spec vs. reality contradictions (must be resolved before coding)

| # | Spec says | Reality | Resolution proposal |
|---|---|---|---|
| 1 | §1 mobile target `apps/mobile/src/modules/collaboration/` | Does not exist | All mobile frozen UX deferred; note in PRD as "not planned until mobile collab module exists". |
| 2 | §18/§19 personal tasks exist | `is_personal` column missing; org-wide RLS only | Phase 4 must introduce the data model. Personal tasks cannot be "preserved" — they must be created. |
| 3 | §20 Reminders as new sub-tab | `reminders` table exists (org announcements) + RemindMe page | New recipient-scoped reminder entity; keep `reminders` announcements untouched. |
| 4 | §11 assignee eligibility via org/project membership | Task assignees are org-wide today; no project-member restriction exists anywhere | Follow existing convention (org members eligible); do not invent project-scope filtering silently — flag for reviewer. |
| 5 | §6 `+ → ERP Record` menu | Composer has attachment + mentions + `linked_entities` on send but no menu | Implement menu with `Task` only initially; map File→existing paperclip affordance if desired. |
| 6 | §29 "existing mobile task screens" | None | Deferred with mobile. |
| 7 | §34 "Existing tests pass" | Only 20 unit test files (pure functions/schemas); no component/e2e tests; full `pnpm test` cannot be run in this sandbox within timeout limits | Verify with targeted vitest + `tsc --noEmit`; document. |
