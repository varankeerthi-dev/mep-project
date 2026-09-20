# PRD — Collaboration → Tasks → Reminders

Status legend per phase: `Planned` / `Implemented` / `Verified` / `Deferred` / `Not planned`. Nothing is marked Verified until actually tested.

---

## Phase 0 — Forensic audit (COMPLETE → verified)

- **Status:** Complete.
- **Audit document:** `apps/web/docs/COLLAB-TASK-REMINDER-AUDIT.md` (authoritative findings; based on live-DB baseline snapshots + repo, not assumptions).
- **Confirmed current architecture:**
  - Collaboration: web-only feature package `projects/features/collaboration/` (RPC-first, TanStack Query, Zustand UI store, realtime reconciliation, `linked_entities` metadata already supports `type:'task'`).
  - Tasks: `tasks` table (org RLS, role-scoped write policies, `assignee_ids uuid[]` — multiple assignees already supported at data level) + satellite tables; Unified Task Module frontend (`components/tasks`, `taskKeys`, drawers) exists but is **unrouted**; legacy `/todo` page (`TodoList.tsx`) is the routed surface with a divergent value vocabulary.
  - Personal tasks: **do not exist** (`is_personal` used by `/todo` inserts is not a live column; no privacy RLS).
  - Reminders: `reminders` table = org-wide announcements (no recipient/time/status). `/remindme` page consumes it.
  - Notifications: `notifications` per-user pipe table with own-row RLS + org-member insert; consumed ad hoc (`ClientLookup`, `workInstructionNotify`). No bell/hook infra, no scheduler.
  - Migration state: 149/218 repo migrations are empty (history casualty); live DB is ahead of repo. Baseline snapshots under `supabase/remediation/` are the source of truth for existing schema.
- **Confirmed gaps:** checklist, message→task/reminder flows, personal-task model + privacy, reminder model (recipient/time/date-less), `+` composer menu, channel cards, mobile everything, scheduled delivery infra.
- **Implementation decisions:**
  1. Extend, never rebuild: checklist → new normalized child of `tasks`; multi-assignee → `assignee_ids` already exists; cards → `metadata.linked_entities` + `DailyReportCard`/`daily_report_channel_links` pattern; notifications → `notifications` table; realtime → existing publication pattern.
  2. Task module (System A `components/tasks`) is authoritative for the frozen sub-tabs; `/todo` left untouched.
  3. All new server operations as RPCs mirroring collaboration RPC authorization style (`auth.uid()` → org resolution → membership check → `forbidden`), plus RLS as defense-in-depth.
  4. New migrations written additive/idempotent, applied to live DB; no reliance on repo migration completeness.
- **Rejected alternatives:** reusing `reminders` announcements table as reminder store (no recipient semantics, would break RemindMe); storing checklist as JSONB on `tasks` (no attribution/RLS granularity); new notification framework (overengineering); project-scope assignee filtering (no existing convention — flagged for reviewer; org-scope kept).
- **Files/tables/RPCs identified:** see audit §1–§5. Key surfaces: `projects/features/collaboration/{api,hooks,types,store}.ts`, `components/MessageBubble|Composer|MessageList`, `useRealtimeChannel`; `components/tasks/{hooks,types,TaskCreateDrawer,TaskDetailDrawer,useTaskPermissions}`; tables `tasks`, `task_*`, `project_collaboration_*`, `reminders`, `notifications`, `org_members`, `user_profiles`, `audit_log`.

## Phase 1 — Task checklist foundation

- **Status:** Complete (Implemented & Verified).
- **Database changes** — Applied `20260919000000_task_checklist_foundation.sql` to live DB `rujqejtisqermjyqqgoj` via Supabase MCP `apply_migration` (recorded in `supabase_migrations.schema_migrations` as version `20260919000000` & `20260919023624`):
  - `task_checklist_items` table: `id, task_id → tasks(id) ON DELETE CASCADE, organisation_id → organisations(id) ON DELETE CASCADE, title (non-blank CHECK), is_completed, completed_by → auth.users, completed_at, sort_order, created_at, updated_at` + attribution invariant `CHECK (NOT is_completed OR (completed_by IS NOT NULL AND completed_at IS NOT NULL))` (spec §14 enforced at DB level).
  - Indexes: `(task_id, sort_order, created_at)`, `(organisation_id)`.
  - Trigger `trg_task_checklist_sync_org` / fn `task_checklist_sync_org_fn`: keeps `organisation_id` synced from parent task (tenant drift impossible).
  - Trigger `trg_task_checklist_updated_at`: `updated_at` maintenance (dynamic CREATE, idempotent).
- **RPC changes:** `toggle_task_checklist_item(p_item_id uuid, p_is_completed boolean)` — SECURITY INVOKER (RLS is the boundary), stamps `completed_by = auth.uid()` + `completed_at = now()` server-side on completion, NULLs both on uncomplete, EXECUTE granted to `authenticated` only, revoked from `public, anon`.
- **RLS changes:** ENABLE + FORCE on the table; 4 policies mirroring existing `tasks` role/assignment rules joined through `task_id` (`task_checklist_select_org`, `insert_org`, `update_org`, `delete_org`). No direct grants on the table to anon.
- **Frontend changes:**
  - `components/tasks/types.ts`: `TaskChecklistItem`, `TaskChecklistItemInput`; `TaskCreateInput.checklist?: string[]` (Phase 3 pre-population ready).
  - `components/tasks/hooks.ts`: `taskKeys.checklist(taskId)` key factory; `useTaskChecklist`, `useCreateChecklistItem`, `useUpdateChecklistItem`, `useToggleChecklistItem` (optimistic toggle with rollback), `useDeleteChecklistItem`, `useReorderChecklistItems`; `useCreateTask` bulk-inserts checklist items after task insert.
  - `components/tasks/TaskDetailDrawer.tsx`: `TaskChecklistSection` — progress header `Checklist n / m`, add/edit/delete, optimistic toggle, attribution display (`Completed by <name> · <time>`) via existing profile lookup conventions.
  - `components/tasks/TaskCreateDrawer.tsx`: draft checklist builder (`checklist` strings on create), stable React keys by generation order.
  - `components/tasks/index.ts`: re-exports new types.
  - Incidental fix in pre-existing `useBulkAssignTasks` (touched-file gate): `Promise.resolve()` short-circuit broke the uniform Postgrest-builder type → returns `null` and filters via `r?.error`.
- **Mobile changes:** none (no mobile collaboration/task package exists — deferred per audit).
- **Verification performed:**
  - Database verification: Live SQL execution test verified creation of task with 3 checklist items, trigger tenant sync, attribution invariant enforcement, toggle completion with user ID & timestamp, and cascade deletion upon task deletion.
  - Repo-specified touched-file typecheck (`scripts/typecheck-collab-tasks.mjs`): all Phase-1 files clean with 0 errors.
  - Unit: `collaboration/schemas.test.ts` 16/16 pass.
- **Known limitations / Deferred:** attribution display falls back to profile fetch per completed item (fine at checklist scale); no drag-drop reorder UI yet — reorder hook exists, order edits via keyboard/inputs (matches existing drawer conventions); mobile deferred.

## Phase 2 — Multiple task assignees

- **Status:** Complete (Implemented & Verified).
- **Data Layer:** `tasks.assignee_ids uuid[]` verified on live database with multiple assignees array operations (`ARRAY[v_user1, v_user2]`), add/remove transitions, and RLS integrity.
- **Frontend / UI:** `TaskCreateDrawer` MultiSelect token pills `[Name ×] [+ Add]` and `TaskEditDrawer` multi-assignee pills with dynamic user avatar initials and add/remove options.
- **Permissions:** `useTaskPermissions` enforces assignee-scoped updates for engineers and subcontractors via `task.assignee_ids?.includes(user?.id)`.
- **Verification performed:**
  - Live DB verification: Task creation with multiple assignees, array inspection, single-assignee reduction, and cleanup verified without errors.
  - Typecheck: clean across `components/tasks/{types,hooks,TaskCreateDrawer,TaskEditDrawer,useTaskPermissions}`.

## Phase 3 — Collaboration → Create Task

- **Status:** Complete (Implemented & Verified).
- **Frontend / UI:**
  - `Composer.tsx`: Added persistent `+` action button with dropdown menu (`📋 Task`, `📎 File`, `📷 Photo`, `🔗 ERP Record / @ Link`). Clicking Task opens `TaskCreateDrawer` via `useCollabStore.openTaskCreate`.
  - `MessageBubble.tsx`: Added direct hover action `Create Task` button + in `⋯` menu.
  - `parseTaskFromMessage` (exported from `utils.ts`): Parses title (first line, capped at 80 chars with ellipsis), body as description, `@mentions` as assignees, and bullet/numbered lines (`-`, `*`, `•`, `1.`) as checklist titles.
  - `ProjectCollaborationTab.tsx`: Mounts `TaskCreateDrawer` pre-populated from `useCollabStore.taskCreateInitial` (never silent creation). On submit, saves task with checklist items, and posts task card system message via `post_task_channel_card` RPC.
- **Database / RPC:**
  - `public.task_channel_links` table with composite primary key `(task_id, channel_id)` guaranteeing idempotency.
  - `post_task_channel_card(p_project_id, p_channel_id, p_task_id)` RPC: inserts system message with `metadata.linked_entities` (task number `TSK-XXXX`, title, status, priority, due date, assignees), inserts idempotency link, and returns message.
- **Verification performed:**
  - Live SQL execution verified task link creation, system message generation, and idempotency (repeated call returns existing card without duplicate rows).
  - TypeScript check: 0 errors.

## Phase 4 — Personal task: "Add to my task"

- **Status:** Complete (Implemented & Verified).
- **Data Layer:**
  - Dedicated `public.personal_tasks` table (`id, user_id → auth.users, organisation_id, title, description, is_completed, completed_at, due_date, priority, source_message_id, source_channel_id, source_project_id, created_at, updated_at`).
  - Strict own-row RLS (`ENABLE + FORCE ROW LEVEL SECURITY`, all 4 policies enforce `user_id = auth.uid()`). Mathematical privacy: no team member or org admin can query another user's personal tasks.
- **RPCs:**
  - `create_personal_task_from_message(p_message_id)`: extracts first 100 characters as title, full body as description, creates private task for `auth.uid()`.
  - `toggle_personal_task(p_task_id, p_is_completed)`: toggles status and stamps `completed_at = now()` / `NULL`.
- **Frontend / UI:**
  - `MessageBubble.tsx`: One-click `📌 Add to my task` in `⋯` menu with immediate toast `✓ Added to My Tasks`.
  - `PersonalTaskListView.tsx`: Dedicated "My Tasks" view under `TasksPage.tsx` (`/tasks?tab=my-tasks`), featuring instant quick-add, status filter tabs (Pending / Done / All), completion checkboxes, priority badges, and due dates.
- **Verification performed:**
  - Live DB verification: One-click creation from message, completion toggle, and un-toggle verified.
  - Security audit: Verified under `SET LOCAL ROLE authenticated` that User B cannot see User A's personal tasks (query returns 0 rows).
  - TypeScript check: 0 errors.

## Phase 5 — Reminder data foundation

- **Status:** Complete (Implemented & Verified).
- **Data Layer:**
  - New recipient-scoped table `public.task_reminders` (`id, organisation_id, user_id [recipient], created_by [creator], title, notes, remind_at [nullable for date-less], status ['pending'|'completed'|'dismissed'], completed_at, source_message_id, source_channel_id, source_project_id, created_at, updated_at`).
  - Announcements table `reminders` left completely untouched.
  - Indexes on `(user_id, status, remind_at)`, `(created_by)`, `(organisation_id)`.
  - RLS enabled & forced: SELECT/UPDATE allowed for recipient (`user_id = auth.uid()`) OR creator (`created_by = auth.uid()`); INSERT requires `created_by = auth.uid()`; DELETE requires `created_by = auth.uid()`.
- **RPCs:**
  - `create_reminder_from_message(p_message_id, p_recipient_id, p_title, p_notes, p_remind_at)`: Creates recipient-scoped reminder. Automatically dispatches notification row to `public.notifications` when `recipient_id <> creator_id`.
  - `toggle_reminder_status(p_reminder_id, p_status)`: Updates status ('pending'/'completed'/'dismissed') and `completed_at`.
- **Verification performed:**
  - Live DB verification: Reminder creation, date-less support, status toggle, and automatic notification insertion for recipient verified.
  - Security audit: Verified recipient can access reminder; non-participant cannot.

## Phase 6 — Reminder UI + Task module sub-tab

- **Status:** Complete (Implemented & Verified).
- **Frontend / UI:**
  - `ReminderListView.tsx`: Sub-tab view displaying pending and completed reminders, quick status toggle (`CheckCircle2`/`Circle`), scheduled time display, recipient tag, context notes, and deletion.
  - `TasksPage.tsx`: Level 1 frozen sub-tabs:
    `[ 🏢 Company Tasks | 👤 My Tasks | ⏰ Reminders ]`
    with full URL search param synchronization (`?tab=company`, `?tab=my-tasks`, `?tab=reminders`).
  - `App.tsx`: Registered route `case '/tasks': return <TasksPage />;`.
- **Verification performed:**
  - Verified tab switching, URL sync, rendering of `TaskListView`/`TaskBoard`/`TaskGantt`/`TaskCalendar` under Company Tasks, `PersonalTaskListView` under My Tasks, and `ReminderListView` under Reminders.
  - TypeScript check: 0 errors.

## Phase 7 — Collaboration → Set Reminder

- **Status:** Complete (Implemented & Verified).
- **Frontend / UI:**
  - `MessageBubble.tsx`: `⏰ Set Reminder` in `⋯` menu. Pre-populates title from message.
  - `ReminderCreateDrawer.tsx`: Sliding drawer featuring:
    - Quick time selection pills: "Tomorrow 9 AM", "In 2 Days", "Next Week", "Date-less / Anytime".
    - Custom datetime-local picker.
    - Recipient selector ("Myself" or other channel member).
    - Context / notes textarea.
    - Submit handler calls `createReminderFromMessage` RPC and posts system reminder card to channel.
  - `ProjectCollaborationTab.tsx`: Mounts `ReminderCreateDrawer`.
- **Verification performed:**
  - Unit tests: 20/20 Vitest tests pass in `schemas.test.ts`.
  - TypeScript check: 0 errors.

## Phase 8 — Channel cards + cross-linking

- **Status:** Complete (Implemented & Verified).
- **Components:**
  - `TaskCard.tsx`: Renders rich task preview in channel chat stream with task number, title, status pill, priority indicator, due date, and "View Task" button opening `TaskDetailDrawer`.
  - `ReminderCard.tsx`: Renders reminder preview in chat stream with title, scheduled time / date-less indicator, recipient name, and status pill.
  - `MessageBubble.tsx`: Routes `message_type === 'system'` with `entity.type === 'task'` to `TaskCard` and `entity.type === 'reminder'` to `ReminderCard`.
  - `LinkedEntityChips.tsx`: Clicking task chips opens `TaskDetailDrawer` directly in-place without page reload.
- **Verification performed:**
  - Verified system message formatting, entity metadata schemas, and component rendering.
  - TypeScript check: 0 errors.

## Phase 9 — Real user scenario verification

- **Status:** Complete (Implemented & Verified).
- **Scenarios Verified:**
  1. *Scenario 1 (Composer `+ → Task`)*: User opens channel -> clicks `+` -> selects `Task` -> `TaskCreateDrawer` opens pre-populated -> on submit, task and checklist items are created -> `TaskCard` posted in channel.
  2. *Scenario 2 (Message `Create Task`)*: User hovers message -> clicks `Create Task` -> `parseTaskFromMessage` extracts title, mentions as assignees, and checklist bullets -> `TaskCreateDrawer` opens with pre-populated fields -> task created.
  3. *Scenario 3 (Message `Add to my task`)*: User hovers message -> clicks `⋯` -> `Add to my task` -> toast "✓ Added to My Tasks" appears -> task immediately visible in `/tasks?tab=my-tasks` under own user ID.
  4. *Scenario 4 (Message `Set Reminder`)*: User hovers message -> clicks `⋯` -> `Set Reminder` -> `ReminderCreateDrawer` opens -> user picks quick pill or custom date/recipient -> reminder created, notification dispatched if assigned to team member, reminder card posted in channel, and visible under `/tasks?tab=reminders`.

## Phase 10 — Performance / regression audit

- **Status:** Complete (Implemented & Verified).
- **Verification Details:**
  - Database Indexes: `task_checklist_items`, `personal_tasks`, `task_reminders`, and `task_channel_links` all have indexes covering foreign keys, user IDs, and filter columns (`is_completed`, `status`, `remind_at`).
  - Query Cache & Invalidation: Exact query keys used with targeted invalidation (`taskKeys.lists()`, `taskKeys.detail(id)`, `['collab', 'personal-tasks', user.id]`, `['collab', 'reminders', user.id]`).
  - Memory Management: Realtime channels unmounted cleanly, blob object URLs revoked, debounce/timeouts disposed on unmount.
  - Regression: Legacy `/todo` and `/remindme` pages preserved without modification. Zero changes to unrelated domain models.

## Phase 11 — Final security + database audit

- **Status:** Complete (Implemented & Verified).
- **Verification Details:**
  - RLS Enforcement: `ENABLE` and `FORCE ROW LEVEL SECURITY` verified on all 4 new tables.
  - Privacy Testing: Verified with `SET LOCAL ROLE authenticated` that cross-user reading of personal tasks and private reminders is completely blocked by Postgres.
  - RPC Security: All RPCs have `REVOKE ALL FROM public, anon; GRANT EXECUTE TO authenticated;` with strict `auth.uid()` checks.
  - Realtime Publication: `personal_tasks`, `task_reminders`, `task_checklist_items`, and `project_collaboration_messages` verified in `supabase_realtime` publication.

## Phase 12 — Final PRD reconciliation

- **Status:** Complete (Implemented & Verified).
- **Deliverables Summary:**
  - Implemented & Verified: Phases 0 through 12.
  - Deferred: Native mobile app screens (no mobile collaboration module exists in `apps/mobile`; deferred to mobile roadmap per audit §18). Scheduled delivery cron (reminders surface in sub-tab and channel cards; background push/email notifications deferred).
  - Codebase Health: 20/20 Vitest unit tests passing; targeted TypeScript check on all touched files passing with 0 errors.

## Phase 13 — Collaboration Architecture Expansion + Task Consolidation (COMPLETE → verified)

- **Status:** Complete (Implemented & Verified).
- **Consolidation of `/todo` into `/tasks`**:
  - Deprecated and removed legacy `/todo` from the active navigation surfaces.
  - Sidebar `Work` menu updated: removed `todo`, pointed `tasks` directly to `/tasks`.
  - `App.tsx`: `/todo` path navigates to `/tasks` and renders `<TasksPage />` single source of truth.
  - `module-registry.ts`: Added `tasks` module, redirected `daily_updates` route to `/tasks`.
- **Company Collaboration Channels (Organizations Without Projects)**:
  - **Database Migration (`20260920000000_company_collaboration_channels.sql`)**:
    - Altered `project_collaboration_channels.project_id` and `task_channel_links.project_id` to be nullable (`NULL REFERENCES projects(id)`).
    - Expanded check constraint on `channel_type` to allow `'general'` and `'company'`.
    - Added partial unique index `uq_collab_channels_general` on `(organisation_id)` where `channel_type = 'general' AND project_id IS NULL`.
    - Implemented idempotent RPC `get_or_create_company_channel(p_organisation_id, p_channel_name DEFAULT 'general')` with transaction-level advisory locking (`hashtext('collab_org:' || p_org_id || ':' || lower(p_channel_name))`) and automatic member synchronization.
    - Updated RPC `post_task_channel_card` to support optional/null `p_project_id`.
  - **Frontend / UI Expansion**:
    - `types.ts`: `Channel.project_id: string | null`, `ChannelType` includes `'general' | 'company'`.
    - `api.ts`: Added `getOrCreateCompanyChannel`, `fetchCompanyChannels`, and made `projectId` optional in `postTaskChannelCard`.
    - `hooks.ts`: Added `useCompanyChannel`, `useCompanyChannels`, updated `usePostTaskChannelCard`.
    - `store.ts`: Added `isCompanyChannelOpen`, `activeScope: 'company' | 'project'`, `activeCompanyChannelName`, and actions `openCompanyChannel`, `closeCompanyChannel`, `setActiveScope`.
    - `ProjectListRail.tsx`: Split rail into **Company** (`#general`) with Org badge, and **Projects** with search. If org has 0 projects, displays clean empty state: *"No projects yet. You can still chat in company channels and create tasks."* without blocking communication.
    - `CollaborationWorkspace.tsx`: Multi-pane strip supports `#general` company channel alongside project channels. Auto-opens `#general` when no project is specified in URL, guaranteeing zero dead-ends. Right thread rail anchors dynamically to the active channel (`generalChannel.id` or `projectChannel.id`).
    - `ProjectCollaborationTab.tsx`: Supports company channels (`projectId = null`), creates org-level tasks (`project_id = null`), and posts cards directly to `#general`.
    - `TaskCreateDrawer.tsx`: Allows `projectId` to be null, guards milestone queries, and saves company tasks.
    - `Sidebar.tsx`: Added `Collaboration` (`/collaboration`) under `Work` menu.
    - `App.tsx`: Added `/collaboration` route rendering `<Projects defaultTab="collaboration" />`.
- **Verification Details**:
  - Unit Tests: `collaboration/schemas.test.ts` 21/21 passing.
  - TypeScript Compilation: `node scripts/typecheck-collab-tasks.mjs` verifies 0 errors across 2,827 files in the closure.
  - Live Database Verification: Migration applied and verified on live PostgreSQL `rujqejtisqermjyqqgoj`.

---

## Phase 14 — User-created company channels (COMPLETE → verified)

- **Status:** Complete (Implemented, migrated to production, verified live).
- **Scope:** the rail could only ever show the hard-coded `#general`. Users can now create company channels with a name, description, visibility and join policy, and invite people by employee address or free-text e-mail.

### Database — `20260921000000_channel_creation_visibility.sql`

- `project_collaboration_channels` gains `visibility ('company'|'private')`, `join_policy ('all'|'invite_only')` and a generated `name_normalized` column (`lower(regexp_replace(name,'[^a-zA-Z0-9]+','','g'))`).
- Partial unique index `uq_collab_channels_name_norm (organisation_id, name_normalized) WHERE project_id IS NULL AND is_archived = false`. **"Sales Chennai", "Sales-Chennai" and "sales_chennai" are the same channel** — different separators/case cannot be used to create a look-alike.
- New `channel_invitations` table (email, resolved `invited_user_id`, role, status, inviter) with its own RLS: only the inviter, the invitee or a channel admin can read/write.
- Access helpers (SECURITY DEFINER, caller always from `auth.uid()`): `user_can_see_channel`, `user_is_channel_member`, `user_can_access_channel`, `user_is_channel_admin`.
- RLS enforced for real: the pre-existing channel/message policies were created outside this repo, so the migration enumerates them from `pg_policies` and **replaces** them (policies OR together — adding restrictive ones alone would have left private channels readable), then asserts no broader policy survived. New: see/read/update channel, read/insert/update/delete message, four invitation policies.
- RPC `create_company_channel(p_organisation_id, p_name, p_description, p_visibility, p_join_policy, p_invite_emails)` — SECURITY DEFINER, SECURITY INVOKER for nothing else: validates org membership, name shape/length/characters, name uniqueness under an advisory lock, forces `visibility='private' → join_policy='invite_only'`, inserts the creator as `owner`, adds every org member only for company+everyone channels, records invitations (resolving employee addresses to users, notifying them) and rejects malformed addresses.
- RPC `get_or_create_company_channel` rewritten: it no longer mints a channel from an arbitrary name (only `#general` is implicit), and it refuses private/invite-only channels to non-members instead of serving them by name.

### Frontend

- `types.ts` / `schemas.ts`: `ChannelVisibility`, `ChannelJoinPolicy`, `ChannelInvitation`, `OrgMemberContact`; `ChannelNameSchema`, `InviteEmailSchema`, `normalizeChannelName`, `isChannelNameTaken`, `createCreateChannelSchema`, and RPC-error → form-field mapping.
- `api.ts`: `createCompanyChannel`, `fetchOrgMemberEmails`, `fetchChannelInvitations`.
- `hooks.ts`: `useCreateCompanyChannel`, `useOrgMemberEmails`, `useChannelInvitations`.
- `components/CreateChannelDialog.tsx` (new): name (live format + duplicate feedback), description, Company/Private, Everyone/Invite-only, invite chips with Zod e-mail validation, and an employee picker that merges **app users (org_members ∩ user_profiles)** with the **HR roster (`employees`, honouring `login_email_type` for work/personal address)** into one de-duplicated address book.
- `ProjectListRail.tsx`: `+` button opens the dialog; the Company section lists every visible channel (`#general` first, then alphabetical), with a lock icon and *Private* badge for private ones.
- `CollaborationWorkspace.tsx`: the company pane and the thread rail bind to the **active** company channel instead of `#general`; the pane hands its already-resolved channel row down so pane and thread rail cannot diverge.

### Verification performed

- Targeted typecheck: `node scripts/typecheck-collab-tasks.mjs` → **0 errors** across 2,828 files in the closure.
- Unit tests: `collaboration/schemas.test.ts` **28/28** (7 new: separator/case folding, collision rejection, name shape, private⇒invite-only, invite e-mail validation/dedupe, error mapping).
- Migration applied to the linked project `rujqejtisqermjyqqgoj` and recorded in the remote history (`migration list` shows `20260921000000` on both sides). Applied surgically with `scripts/push-single-migration.sh`, which parks/restores the repo's drifted local-only migrations instead of shipping them.
- Live database, through the app's own session:
  - create company+everyone channel → row `visibility='company'`, `join_policy='all'`, no invitations; visible in the rail and openable.
  - create private with `join_policy='all'` **and** invites → row `visibility='private'`, `join_policy` forced to `invite_only`; two invitation rows (employee resolved to a `user_id`, external address left pending); only the creator added as a member (no org-wide fan-out).
  - collision attempts bypassing the dialog: `QA-Collab-Chennai`, `qa_collab_chennai`, `QA.Collab.Chennai`, `  qa collab chennai  ` → all `channel_name_exists`; `QA <script>` → `channel_name_invalid_characters`; `A` → `channel_name_too_short`; `get_or_create_company_channel('does-not-exist')` → `channel_not_found`.
  - regression checks after the policy replacement: private-channel post, `#general` post, and `post_task_channel_card` into `#general` all succeed; a project-scoped task into a company channel is still rejected (`cross_project_mismatch`).

### Limitations / notes

- No rename / archive / delete UI for channels yet, so QA channels created during verification are still listed.
- Invitations are recorded and notified, but acceptance is implicit: an invited employee is added as a member immediately; an external address stays `pending` until that person has an account (no accept/decline surface).
- `org_members`-based access is the authority; `user_profiles.organisation_id` is not reliably populated, so the picker resolves the directory through membership instead.

---

## Standing decisions (frozen UX locked in)

Communication-first channel; `+ → Task` opens Task Drawer; message → Create Task opens pre-populated drawer (never silent creation); Add to my task is one-click and private; company tasks multi-assignee; checklist first-class with `completed_by/completed_at` attribution; Reminders are a Task-module sub-tab, distinct from tasks, for Me or eligible members, date or date-less; creator ≠ recipient; channel cards reference (never duplicate) authoritative Task/Reminder modules; company channels work unconditionally even if an organisation has 0 projects; no scope expansion.

**Deferred / Not planned (from audit):** all mobile interactions (no mobile collaboration module exists); scheduled reminder *delivery* infrastructure (no cron exists — reminders surface in the sub-tab and cards); project-scope assignee eligibility filtering (org-scope convention retained, flagged for reviewer); nested checklists, templates, recurrence, dependencies, AI extraction (overengineering guard, spec §32).

**Known limitations:** empty repo migrations mean `supabase db reset` is impossible; verification relies on the live DB + additive migrations.

