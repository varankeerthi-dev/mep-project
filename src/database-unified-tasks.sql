-- ============================================
-- UNIFIED TASK MANAGEMENT MODULE
-- Phase 1: Database Schema Migration
-- ============================================
-- This migration unifies the two disconnected task systems
-- (project_tasks + tasks) into a single construction-grade schema.
-- 
-- Run in Supabase SQL Editor.
-- Safe to run multiple times (IF NOT EXISTS / DROP IF EXISTS).
-- ============================================

-- ============================================
-- 1. TASK GROUPS (Phases/Milestones/WBS)
-- ============================================
CREATE TABLE IF NOT EXISTS task_groups (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organisation_id UUID NOT NULL,
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

-- ============================================
-- 2. UNIFIED TASKS TABLE
-- Replaces both project_tasks and tasks tables
-- ============================================
CREATE TABLE IF NOT EXISTS tasks (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organisation_id       UUID NOT NULL,
  project_id            UUID REFERENCES projects(id) ON DELETE CASCADE,
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
  completed_date        TIMESTAMP,
  duration_days         INTEGER,
  estimated_hours       DECIMAL(8,2),
  actual_hours          DECIMAL(8,2),

  -- Assignment
  assignee_ids          UUID[] DEFAULT '{}',
  reporter_id           UUID REFERENCES auth.users(id),
  approved_by_id        UUID REFERENCES auth.users(id),

  -- Progress
  completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),

  -- Metadata
  tags                  TEXT[] DEFAULT '{}',
  color                 TEXT,
  is_following          BOOLEAN DEFAULT false,
  is_archived           BOOLEAN DEFAULT false,

  -- MEP-specific
  discipline            TEXT CHECK (discipline IN ('mechanical', 'electrical', 'plumbing', 'fire_protection', 'elv', 'civil', 'architectural', 'general')),
  location              TEXT,
  drawing_ref           TEXT,
  wbs_code              TEXT,

  -- Audit
  created_by            UUID NOT NULL REFERENCES auth.users(id),
  created_at            TIMESTAMP DEFAULT now(),
  updated_at            TIMESTAMP DEFAULT now(),
  deleted_at            TIMESTAMP
);

-- ============================================
-- 3. TASK DEPENDENCIES
-- ============================================
CREATE TABLE IF NOT EXISTS task_dependencies (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_id   UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  dependency_type TEXT DEFAULT 'FS' CHECK (dependency_type IN ('FS', 'SS', 'FF', 'SF')),
  lag_days        INTEGER DEFAULT 0,
  created_at      TIMESTAMP DEFAULT now(),
  CONSTRAINT unique_dependency UNIQUE(task_id, depends_on_id),
  CONSTRAINT no_self_dependency CHECK (task_id != depends_on_id)
);

-- ============================================
-- 4. TASK COMMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS task_comments (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id),
  content     TEXT NOT NULL,
  mentions    UUID[] DEFAULT '{}',
  parent_id   UUID REFERENCES task_comments(id) ON DELETE CASCADE,
  created_at  TIMESTAMP DEFAULT now(),
  updated_at  TIMESTAMP DEFAULT now()
);

-- ============================================
-- 5. TASK ATTACHMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS task_attachments (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id        UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES auth.users(id),
  file_name      TEXT NOT NULL,
  file_type      TEXT,
  file_size      INTEGER,
  storage_path   TEXT NOT NULL,
  thumbnail_path TEXT,
  created_at     TIMESTAMP DEFAULT now()
);

-- ============================================
-- 6. TASK TIME LOGS
-- ============================================
CREATE TABLE IF NOT EXISTS task_time_logs (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id            UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id            UUID NOT NULL REFERENCES auth.users(id),
  start_time         TIMESTAMP NOT NULL,
  end_time           TIMESTAMP,
  duration_minutes   INTEGER,
  description        TEXT,
  billable           BOOLEAN DEFAULT true,
  created_at         TIMESTAMP DEFAULT now()
);

-- ============================================
-- 7. TASK ACTIVITY LOG (Audit Trail)
-- ============================================
CREATE TABLE IF NOT EXISTS task_activity_log (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id),
  action      TEXT NOT NULL,
  old_value   JSONB,
  new_value   JSONB,
  created_at  TIMESTAMP DEFAULT now()
);

-- ============================================
-- 8. CUSTOM FIELDS (per organisation)
-- ============================================
CREATE TABLE IF NOT EXISTS task_custom_fields (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organisation_id UUID NOT NULL,
  field_name      TEXT NOT NULL,
  field_type      TEXT DEFAULT 'text' CHECK (field_type IN ('text', 'number', 'date', 'select', 'multiselect', 'checkbox')),
  options         TEXT[],
  is_required     BOOLEAN DEFAULT false,
  sort_order      INTEGER DEFAULT 0,
  created_at      TIMESTAMP DEFAULT now()
);

-- ============================================
-- 9. CUSTOM FIELD VALUES (per task)
-- ============================================
CREATE TABLE IF NOT EXISTS task_custom_field_values (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  custom_field_id UUID NOT NULL REFERENCES task_custom_fields(id) ON DELETE CASCADE,
  value_text      TEXT,
  value_number    DECIMAL(18,4),
  value_date      DATE,
  value_boolean   BOOLEAN,
  CONSTRAINT unique_task_custom_field UNIQUE(task_id, custom_field_id)
);

-- ============================================
-- 10. SAVED VIEWS (per user)
-- ============================================
CREATE TABLE IF NOT EXISTS task_views (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL,
  project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
  view_name       TEXT NOT NULL,
  view_type       TEXT DEFAULT 'table' CHECK (view_type IN ('table', 'board', 'gantt', 'calendar')),
  filters         JSONB DEFAULT '{}',
  columns         JSONB,
  sort_by         JSONB DEFAULT '[]',
  group_by        TEXT,
  is_default      BOOLEAN DEFAULT false,
  is_shared       BOOLEAN DEFAULT false,
  created_at      TIMESTAMP DEFAULT now(),
  updated_at      TIMESTAMP DEFAULT now()
);

-- ============================================
-- 11. ENABLE ROW LEVEL SECURITY
-- ============================================
ALTER TABLE task_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_time_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_custom_field_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_views ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 12. DROP EXISTING POLICIES (idempotent)
-- ============================================
-- task_groups
DROP POLICY IF EXISTS "task_groups_select_org" ON task_groups;
DROP POLICY IF EXISTS "task_groups_insert_org" ON task_groups;
DROP POLICY IF EXISTS "task_groups_update_org" ON task_groups;
DROP POLICY IF EXISTS "task_groups_delete_org" ON task_groups;

-- tasks
DROP POLICY IF EXISTS "tasks_select_org" ON tasks;
DROP POLICY IF EXISTS "tasks_insert_org" ON tasks;
DROP POLICY IF EXISTS "tasks_update_org" ON tasks;
DROP POLICY IF EXISTS "tasks_delete_org" ON tasks;

-- task_dependencies
DROP POLICY IF EXISTS "task_dependencies_select_org" ON task_dependencies;
DROP POLICY IF EXISTS "task_dependencies_insert_org" ON task_dependencies;
DROP POLICY IF EXISTS "task_dependencies_update_org" ON task_dependencies;
DROP POLICY IF EXISTS "task_dependencies_delete_org" ON task_dependencies;

-- task_comments
DROP POLICY IF EXISTS "task_comments_select_org" ON task_comments;
DROP POLICY IF EXISTS "task_comments_insert_org" ON task_comments;
DROP POLICY IF EXISTS "task_comments_update_own" ON task_comments;
DROP POLICY IF EXISTS "task_comments_delete_own" ON task_comments;

-- task_attachments
DROP POLICY IF EXISTS "task_attachments_select_org" ON task_attachments;
DROP POLICY IF EXISTS "task_attachments_insert_org" ON task_attachments;
DROP POLICY IF EXISTS "task_attachments_delete_own" ON task_attachments;

-- task_time_logs
DROP POLICY IF EXISTS "task_time_logs_select_org" ON task_time_logs;
DROP POLICY IF EXISTS "task_time_logs_insert_org" ON task_time_logs;
DROP POLICY IF EXISTS "task_time_logs_update_own" ON task_time_logs;
DROP POLICY IF EXISTS "task_time_logs_delete_own" ON task_time_logs;

-- task_activity_log
DROP POLICY IF EXISTS "task_activity_log_select_org" ON task_activity_log;

-- task_custom_fields
DROP POLICY IF EXISTS "task_custom_fields_select_org" ON task_custom_fields;
DROP POLICY IF EXISTS "task_custom_fields_insert_admin" ON task_custom_fields;
DROP POLICY IF EXISTS "task_custom_fields_update_admin" ON task_custom_fields;
DROP POLICY IF EXISTS "task_custom_fields_delete_admin" ON task_custom_fields;

-- task_custom_field_values
DROP POLICY IF EXISTS "task_custom_field_values_select_org" ON task_custom_field_values;
DROP POLICY IF EXISTS "task_custom_field_values_insert_org" ON task_custom_field_values;
DROP POLICY IF EXISTS "task_custom_field_values_update_org" ON task_custom_field_values;
DROP POLICY IF EXISTS "task_custom_field_values_delete_org" ON task_custom_field_values;

-- task_views
DROP POLICY IF EXISTS "task_views_select_own" ON task_views;
DROP POLICY IF EXISTS "task_views_insert_own" ON task_views;
DROP POLICY IF EXISTS "task_views_update_own" ON task_views;
DROP POLICY IF EXISTS "task_views_delete_own" ON task_views;

-- ============================================
-- 13. RLS POLICIES: TASK GROUPS
-- ============================================
CREATE POLICY "task_groups_select_org"
  ON task_groups FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.organisation_id = task_groups.organisation_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "task_groups_insert_org"
  ON task_groups FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.organisation_id = task_groups.organisation_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "task_groups_update_org"
  ON task_groups FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.organisation_id = task_groups.organisation_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "task_groups_delete_org"
  ON task_groups FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.organisation_id = task_groups.organisation_id
      AND om.user_id = auth.uid()
    )
  );

-- ============================================
-- 14. RLS POLICIES: TASKS (role-aware)
-- ============================================
CREATE POLICY "tasks_select_org"
  ON tasks FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.organisation_id = tasks.organisation_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "tasks_insert_org"
  ON tasks FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.organisation_id = tasks.organisation_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin', 'project_manager', 'engineer', 'supervisor')
    )
  );

-- Update: Admin/PM = all tasks. Engineer/Supervisor = assigned or created. Subcontractor = assigned only.
CREATE POLICY "tasks_update_org"
  ON tasks FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.organisation_id = tasks.organisation_id
      AND om.user_id = auth.uid()
      AND (
        om.role IN ('admin', 'project_manager')
        OR (om.role IN ('engineer', 'supervisor') AND (tasks.assignee_ids @> ARRAY[auth.uid()] OR tasks.created_by = auth.uid()))
        OR (om.role = 'subcontractor' AND tasks.assignee_ids @> ARRAY[auth.uid()])
      )
    )
  );

-- Delete: Admin/PM only
CREATE POLICY "tasks_delete_org"
  ON tasks FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.organisation_id = tasks.organisation_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin', 'project_manager')
    )
  );

-- ============================================
-- 15. RLS POLICIES: TASK DEPENDENCIES
-- ============================================
CREATE POLICY "task_dependencies_select_org"
  ON task_dependencies FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN org_members om ON om.organisation_id = t.organisation_id
      WHERE t.id = task_dependencies.task_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "task_dependencies_insert_org"
  ON task_dependencies FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN org_members om ON om.organisation_id = t.organisation_id
      WHERE t.id = task_dependencies.task_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin', 'project_manager')
    )
  );

CREATE POLICY "task_dependencies_update_org"
  ON task_dependencies FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN org_members om ON om.organisation_id = t.organisation_id
      WHERE t.id = task_dependencies.task_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin', 'project_manager')
    )
  );

CREATE POLICY "task_dependencies_delete_org"
  ON task_dependencies FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN org_members om ON om.organisation_id = t.organisation_id
      WHERE t.id = task_dependencies.task_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin', 'project_manager')
    )
  );

-- ============================================
-- 16. RLS POLICIES: TASK COMMENTS
-- ============================================
CREATE POLICY "task_comments_select_org"
  ON task_comments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN org_members om ON om.organisation_id = t.organisation_id
      WHERE t.id = task_comments.task_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "task_comments_insert_org"
  ON task_comments FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN org_members om ON om.organisation_id = t.organisation_id
      WHERE t.id = task_comments.task_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "task_comments_update_own"
  ON task_comments FOR UPDATE TO authenticated
  USING (task_comments.user_id = auth.uid());

CREATE POLICY "task_comments_delete_own"
  ON task_comments FOR DELETE TO authenticated
  USING (task_comments.user_id = auth.uid());

-- ============================================
-- 17. RLS POLICIES: TASK ATTACHMENTS
-- ============================================
CREATE POLICY "task_attachments_select_org"
  ON task_attachments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN org_members om ON om.organisation_id = t.organisation_id
      WHERE t.id = task_attachments.task_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "task_attachments_insert_org"
  ON task_attachments FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN org_members om ON om.organisation_id = t.organisation_id
      WHERE t.id = task_attachments.task_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "task_attachments_delete_own"
  ON task_attachments FOR DELETE TO authenticated
  USING (
    task_attachments.user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM org_members om
      JOIN tasks t ON t.organisation_id = om.organisation_id
      WHERE om.user_id = auth.uid()
      AND t.id = task_attachments.task_id
      AND om.role IN ('admin', 'project_manager')
    )
  );

-- ============================================
-- 18. RLS POLICIES: TASK TIME LOGS
-- ============================================
CREATE POLICY "task_time_logs_select_org"
  ON task_time_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN org_members om ON om.organisation_id = t.organisation_id
      WHERE t.id = task_time_logs.task_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "task_time_logs_insert_org"
  ON task_time_logs FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN org_members om ON om.organisation_id = t.organisation_id
      WHERE t.id = task_time_logs.task_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "task_time_logs_update_own"
  ON task_time_logs FOR UPDATE TO authenticated
  USING (task_time_logs.user_id = auth.uid());

CREATE POLICY "task_time_logs_delete_own"
  ON task_time_logs FOR DELETE TO authenticated
  USING (task_time_logs.user_id = auth.uid());

-- ============================================
-- 19. RLS POLICIES: TASK ACTIVITY LOG (read-only)
-- ============================================
CREATE POLICY "task_activity_log_select_org"
  ON task_activity_log FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN org_members om ON om.organisation_id = t.organisation_id
      WHERE t.id = task_activity_log.task_id
      AND om.user_id = auth.uid()
    )
  );

-- ============================================
-- 20. RLS POLICIES: CUSTOM FIELDS
-- ============================================
CREATE POLICY "task_custom_fields_select_org"
  ON task_custom_fields FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.organisation_id = task_custom_fields.organisation_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "task_custom_fields_insert_admin"
  ON task_custom_fields FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.organisation_id = task_custom_fields.organisation_id
      AND om.user_id = auth.uid()
      AND om.role = 'admin'
    )
  );

CREATE POLICY "task_custom_fields_update_admin"
  ON task_custom_fields FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.organisation_id = task_custom_fields.organisation_id
      AND om.user_id = auth.uid()
      AND om.role = 'admin'
    )
  );

CREATE POLICY "task_custom_fields_delete_admin"
  ON task_custom_fields FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.organisation_id = task_custom_fields.organisation_id
      AND om.user_id = auth.uid()
      AND om.role = 'admin'
    )
  );

-- ============================================
-- 21. RLS POLICIES: CUSTOM FIELD VALUES
-- ============================================
CREATE POLICY "task_custom_field_values_select_org"
  ON task_custom_field_values FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN org_members om ON om.organisation_id = t.organisation_id
      WHERE t.id = task_custom_field_values.task_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "task_custom_field_values_insert_org"
  ON task_custom_field_values FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN org_members om ON om.organisation_id = t.organisation_id
      WHERE t.id = task_custom_field_values.task_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "task_custom_field_values_update_org"
  ON task_custom_field_values FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN org_members om ON om.organisation_id = t.organisation_id
      WHERE t.id = task_custom_field_values.task_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "task_custom_field_values_delete_org"
  ON task_custom_field_values FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN org_members om ON om.organisation_id = t.organisation_id
      WHERE t.id = task_custom_field_values.task_id
      AND om.user_id = auth.uid()
    )
  );

-- ============================================
-- 22. RLS POLICIES: TASK VIEWS
-- ============================================
CREATE POLICY "task_views_select_own"
  ON task_views FOR SELECT TO authenticated
  USING (
    task_views.user_id = auth.uid()
    OR
    (task_views.is_shared = true AND EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.organisation_id = task_views.organisation_id
      AND om.user_id = auth.uid()
    ))
  );

CREATE POLICY "task_views_insert_own"
  ON task_views FOR INSERT TO authenticated
  WITH CHECK (task_views.user_id = auth.uid());

CREATE POLICY "task_views_update_own"
  ON task_views FOR UPDATE TO authenticated
  USING (task_views.user_id = auth.uid());

CREATE POLICY "task_views_delete_own"
  ON task_views FOR DELETE TO authenticated
  USING (task_views.user_id = auth.uid());

-- ============================================
-- 23. INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_task_groups_organisation_id ON task_groups(organisation_id);
CREATE INDEX IF NOT EXISTS idx_task_groups_project_id ON task_groups(project_id);
CREATE INDEX IF NOT EXISTS idx_task_groups_sort_order ON task_groups(sort_order);

CREATE INDEX IF NOT EXISTS idx_tasks_organisation_id ON tasks(organisation_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_task_group_id ON tasks(task_group_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_ids ON tasks USING GIN(assignee_ids);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_discipline ON tasks(discipline);
CREATE INDEX IF NOT EXISTS idx_tasks_task_type ON tasks(task_type);
CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON tasks(deleted_at) WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_task_dependencies_task_id ON task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_depends_on_id ON task_dependencies(depends_on_id);

CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_user_id ON task_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_parent_id ON task_comments(parent_id);

CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON task_attachments(task_id);

CREATE INDEX IF NOT EXISTS idx_task_time_logs_task_id ON task_time_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_task_time_logs_user_id ON task_time_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_task_activity_log_task_id ON task_activity_log(task_id);
CREATE INDEX IF NOT EXISTS idx_task_activity_log_created_at ON task_activity_log(created_at);

CREATE INDEX IF NOT EXISTS idx_task_custom_fields_organisation_id ON task_custom_fields(organisation_id);

CREATE INDEX IF NOT EXISTS idx_task_custom_field_values_task_id ON task_custom_field_values(task_id);
CREATE INDEX IF NOT EXISTS idx_task_custom_field_values_field_id ON task_custom_field_values(custom_field_id);

CREATE INDEX IF NOT EXISTS idx_task_views_user_id ON task_views(user_id);
CREATE INDEX IF NOT EXISTS idx_task_views_organisation_id ON task_views(organisation_id);
CREATE INDEX IF NOT EXISTS idx_task_views_project_id ON task_views(project_id);

-- ============================================
-- 24. TRIGGERS: updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_task_groups_updated_at ON task_groups;
CREATE TRIGGER update_task_groups_updated_at
    BEFORE UPDATE ON task_groups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_task_comments_updated_at ON task_comments;
CREATE TRIGGER update_task_comments_updated_at
    BEFORE UPDATE ON task_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_task_views_updated_at ON task_views;
CREATE TRIGGER update_task_views_updated_at
    BEFORE UPDATE ON task_views
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 25. TRIGGER: auto-set completed_date
-- ============================================
CREATE OR REPLACE FUNCTION set_task_completed_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_date = now();
  ELSIF NEW.status != 'completed' AND OLD.status = 'completed' THEN
    NEW.completed_date = NULL;
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS set_task_completed_date ON tasks;
CREATE TRIGGER set_task_completed_date
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION set_task_completed_date();

-- ============================================
-- 26. TRIGGER: auto-update actual_hours from time_logs
-- ============================================
CREATE OR REPLACE FUNCTION update_task_actual_hours()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE tasks
  SET actual_hours = (
    SELECT COALESCE(SUM(duration_minutes) / 60.0, 0)
    FROM task_time_logs
    WHERE task_id = COALESCE(NEW.task_id, OLD.task_id)
  )
  WHERE id = COALESCE(NEW.task_id, OLD.task_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_task_actual_hours_on_insert ON task_time_logs;
CREATE TRIGGER update_task_actual_hours_on_insert
    AFTER INSERT ON task_time_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_task_actual_hours();

DROP TRIGGER IF EXISTS update_task_actual_hours_on_update ON task_time_logs;
CREATE TRIGGER update_task_actual_hours_on_update
    AFTER UPDATE ON task_time_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_task_actual_hours();

DROP TRIGGER IF EXISTS update_task_actual_hours_on_delete ON task_time_logs;
CREATE TRIGGER update_task_actual_hours_on_delete
    AFTER DELETE ON task_time_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_task_actual_hours();

-- ============================================
-- 27. FUNCTION: log task activity
-- ============================================
CREATE OR REPLACE FUNCTION log_task_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO task_activity_log (task_id, user_id, action, new_value)
    VALUES (NEW.id, auth.uid(), 'created', to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO task_activity_log (task_id, user_id, action, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'updated', to_jsonb(OLD), to_jsonb(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO task_activity_log (task_id, user_id, action, old_value)
    VALUES (OLD.id, auth.uid(), 'deleted', to_jsonb(OLD));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS log_task_activity_trigger ON tasks;
CREATE TRIGGER log_task_activity_trigger
    AFTER INSERT OR UPDATE OR DELETE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION log_task_activity();

-- ============================================
-- 28. SUPABASE STORAGE BUCKET: task-attachments
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-attachments', 'task-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: only org members can access their org's files
DROP POLICY IF EXISTS "task_attachments_storage_select" ON storage.objects;
CREATE POLICY "task_attachments_storage_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'task-attachments'
    AND EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.user_id = auth.uid()
      AND (storage.objects.name LIKE om.organisation_id::text || '/%')
    )
  );

DROP POLICY IF EXISTS "task_attachments_storage_insert" ON storage.objects;
CREATE POLICY "task_attachments_storage_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'task-attachments'
    AND EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.user_id = auth.uid()
      AND (storage.objects.name LIKE om.organisation_id::text || '/%')
    )
  );

DROP POLICY IF EXISTS "task_attachments_storage_delete" ON storage.objects;
CREATE POLICY "task_attachments_storage_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'task-attachments'
    AND EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.user_id = auth.uid()
      AND (storage.objects.name LIKE om.organisation_id::text || '/%')
    )
  );

-- ============================================
-- DONE
-- ============================================
