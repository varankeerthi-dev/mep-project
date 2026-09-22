# COLLABORATION-TASK-ARCHITECTURE-AUDIT.md — PHASE 0 FORENSIC AUDIT

Date: 2026-09-20  
Database: Live PostgreSQL (`rujqejtisqermjyqqgoj`)  
Status: **COMPLETE — NO BLOCKING CONTRADICTIONS** (Proceeding to Phase 1)

---

## 1. Confirmed Current State

### 1.1 Collaboration Database Schema
- Table `project_collaboration_channels`:
  - `id`: uuid PK
  - `organisation_id`: uuid NOT NULL FK organisations(id)
  - `project_id`: uuid NOT NULL FK projects(id) (**Hard constraint preventing company-level channels**)
  - `channel_type`: text NOT NULL, CHECK: `channel_type = ANY (ARRAY['project','site_coordination','design','procurement','commercial','custom'])`. Default `'project'`.
  - `name`: text NOT NULL
  - `is_archived`: boolean NOT NULL DEFAULT false
  - `created_by`: uuid NOT NULL FK user_profiles(user_id)
  - Unique index `uq_collab_channels_primary`: `(organisation_id, project_id) WHERE channel_type = 'project'`
  - Index `idx_collab_channels_project`: `(organisation_id, project_id)`

### 1.2 Collaboration RPCs
- `get_or_create_project_channel(p_project_id)`:
  - Takes `p_project_id`, gets `organisation_id` from `projects`, checks `org_members`.
  - Strictly requires `p_project_id` to exist in `projects`.
  - Does NOT support organisation-level channels without projects.

### 1.3 Collaboration RLS Policies
- `project_collaboration_channels`:
  - SELECT/INSERT/UPDATE: Org-level check: `organisation_id IN (SELECT org_members.organisation_id FROM org_members WHERE org_members.user_id = auth.uid())`
  - DELETE: Admin only in org_members.
- `project_collaboration_messages`:
  - SELECT: Org-level check: `organisation_id IN (SELECT org_members.organisation_id FROM org_members WHERE org_members.user_id = auth.uid())`
  - INSERT: Sender is auth user + caller in org + channel is not archived.
- Note: Channel tenancy is already tied to `organisation_id`, which makes supporting `project_id IS NULL` completely safe and natural.

### 1.4 Tasks vs. `/todo` State
- Live DB `tasks` table:
  - Total records: 16 tasks (13 `not_started`, 1 `on_hold`, 2 `completed`).
  - ZERO tasks have legacy status strings (`'To Do'`, `'In Progress'`, etc.).
  - Columns `assigned_to`, `is_personal`, `category`, `client_name`, `client_type` **DO NOT EXIST** in the live `tasks` table.
- Table `reminders`: 0 rows (empty legacy announcement table).
- Table `personal_tasks`: 1 row (active private task with user RLS).
- Table `task_reminders`: 1 row (active reminder with recipient scoping).
- `/todo` (`TodoList.tsx`):
  - 1,057 lines of monolithic legacy code writing non-existent columns (`assigned_to`, `is_personal`).
  - Only imported in `App.tsx` (line 130 and 437) and registered in `module-registry.ts` under `'daily_updates'`.
  - Not referenced by any mobile screen or other component.

---

## 2. Confirmed Conflicts

1. **Collaboration Channel Constraint**: `project_collaboration_channels.project_id` is `NOT NULL`. An organisation with 0 projects cannot create or access any channels.
2. **Channel Type Check Constraint**: `channel_type_check` only allows `['project', 'site_coordination', 'design', 'procurement', 'commercial', 'custom']`. It rejects `'general'` or `'company'`.
3. **RPC Deficiency**: No RPC exists to get or create a company-wide channel (`#general`) for an organisation.
4. **Collaboration Rail**: `ProjectListRail.tsx` exclusively fetches and renders `projects`. If 0 projects exist, the rail is empty with no way to chat.
5. **Two Task Entrypoints**: Sidebar has both `Tasks` and `To do` (`/todo`). `/todo` creates invalid/unsupported data and confuses users.

---

## 3. Database Objects Affected

1. Table: `project_collaboration_channels`:
   - Drop `NOT NULL` constraint on `project_id` (make `project_id uuid NULL REFERENCES projects(id)`).
   - Update `CHECK (channel_type = ANY (...))` to include `'general'` and `'company'`.
   - Add partial unique index: `CREATE UNIQUE INDEX uq_collab_channels_general ON project_collaboration_channels (organisation_id) WHERE (channel_type = 'general' AND project_id IS NULL);`
2. Functions / RPCs:
   - Create `get_or_create_company_channel(p_organisation_id uuid, p_channel_name text DEFAULT 'general')` RETURNS `project_collaboration_channels`.
   - Update `post_task_channel_card` to support `p_project_id uuid NULL`.
3. Existing RLS policies:
   - Already check `organisation_id IN (SELECT org_members.organisation_id WHERE user_id = auth.uid())`, so company channels are already tenant-isolated by RLS.

---

## 4. Files Affected

### Tasks Consolidation:
- `apps/web/src/App.tsx`: Replace `/todo` route with redirect `<Navigate to="/tasks" replace />`.
- `apps/web/src/components/Sidebar.tsx`: Remove `todo` from `menuData`. Ensure `tasks` is in `SIDEBAR_MODULE_MAP`.
- `apps/web/src/config/module-registry.ts`: Update `daily_updates` or add `tasks` registration.
- `apps/web/src/pages/TodoList.tsx`: Safe deprecation/cleanup.

### Collaboration Domain & UI:
- `apps/web/supabase/migrations/20260920000000_company_collaboration_channels.sql`: DDL migration.
- `apps/web/src/projects/features/collaboration/types.ts`: Update `ChannelType` to include `'general' | 'company'`, make `project_id: string | null`.
- `apps/web/src/projects/features/collaboration/api.ts`: Add `getOrCreateCompanyChannel()`, update `postTaskChannelCard()` for optional `projectId`.
- `apps/web/src/projects/features/collaboration/hooks.ts`: Add `useCompanyChannel()`, `useCompanyChannels()`.
- `apps/web/src/projects/features/collaboration/store.ts`: Extend to support `activeScope: 'company' | 'project'` and active company channel ID.
- `apps/web/src/projects/features/collaboration/components/CollaborationWorkspace.tsx`: Support opening company channel alongside project channels.
- `apps/web/src/projects/features/collaboration/components/ProjectListRail.tsx`: Split rail into **Company Channels** (`#general`) and **Project Channels** with clean empty states.
- `apps/web/src/projects/features/collaboration/components/ProjectCollaborationTab.tsx`: Allow rendering company channel when `projectId` is null.
- `apps/web/src/projects/features/collaboration/components/ChannelHeader.tsx`: Display `#general` / company channel header properly.

---

## 5. Migration Risks & Mitigation

| Risk | Likelihood | Mitigation |
|---|---|---|
| Existing project channels break | None | `project_id` foreign key and indexes for projects remain 100% intact. Only `NOT NULL` is dropped. |
| Company channels leak to other orgs | None | RLS on `project_collaboration_channels` strictly enforces `organisation_id IN (SELECT org_members.organisation_id WHERE user_id = auth.uid())`. |
| Concurrent #general channel creation | None | Advisory transaction lock `hashtext('collab_org:' || p_org_id::text)` + partial unique index `uq_collab_channels_general`. |
| User work lost from `/todo` | None | All 16 live tasks in DB already use canonical lowercase status. Zero rows in legacy `reminders`. |

---

## 6. Implementation Order

1. **Phase 1**: `/todo` → `/tasks` Consolidation (Redirect `/todo`, remove from sidebar, update module registry).
2. **Phase 2 & 3**: Migration `20260920000000_company_collaboration_channels.sql` (schema, constraints, indexes, and `get_or_create_company_channel` RPC).
3. **Phase 4 & 5**: Collaboration UI Rail refactor (Company section with `#general`, Projects section, Zustand store updates, routing sync).
4. **Phase 6**: Task integration from Company Channels (`project_id = null`) and Project Channels (`project_id = channel.project_id`).
5. **Phase 7–12**: Regression testing, real scenario verification, performance check, mobile check, and PRD update.
