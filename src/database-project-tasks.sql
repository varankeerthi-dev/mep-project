-- Project Tasks Module Migration
-- Run this in Supabase SQL Editor

-- ============================================
-- TASK GROUPS TABLE (Phases/Milestones)
-- ============================================
CREATE TABLE IF NOT EXISTS task_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE,
  due_date DATE,
  is_collapsed BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  organisation_id UUID,
  created_by UUID,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- ============================================
-- PROJECT TASKS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS project_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  task_group_id UUID REFERENCES task_groups(id) ON DELETE SET NULL,
  parent_task_id UUID REFERENCES project_tasks(id) ON DELETE CASCADE,
  task_no INTEGER DEFAULT 1,
  name TEXT NOT NULL,
  description TEXT,
  assignees JSONB DEFAULT '[]',  -- [{id: uuid, name: string, avatar: string}]
  status TEXT DEFAULT 'Not Started' CHECK (status IN ('Not Started', 'In Progress', 'Possible Delay', 'On Hold', 'Completed')),
  tags TEXT[] DEFAULT '{}',
  start_date DATE,
  due_date DATE,
  duration TEXT,
  priority TEXT DEFAULT 'None' CHECK (priority IN ('None', 'Low', 'Medium', 'High')),
  completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
  color TEXT,  -- Hex color code for visual tagging
  is_following BOOLEAN DEFAULT false,
  organisation_id UUID,
  created_by UUID,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- ============================================
-- TASK VIEWS TABLE (Custom Column Views)
-- ============================================
CREATE TABLE IF NOT EXISTS task_views (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  view_name TEXT NOT NULL,
  columns JSONB DEFAULT '{"task_no":true,"name":true,"assignees":true,"status":true,"start_date":true,"due_date":true,"duration":true,"priority":true,"completion_percentage":true}',
  sort_order TEXT[],  -- Column display order
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- ============================================
-- ENABLE RLS
-- ============================================
ALTER TABLE task_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_views ENABLE ROW LEVEL SECURITY;

-- ============================================
-- DROP EXISTING POLICIES
-- ============================================
DROP POLICY IF EXISTS "Users can view task_groups in their organisation" ON task_groups;
DROP POLICY IF EXISTS "Users can create task_groups in their organisation" ON task_groups;
DROP POLICY IF EXISTS "Users can update task_groups in their organisation" ON task_groups;
DROP POLICY IF EXISTS "Users can delete task_groups in their organisation" ON task_groups;

DROP POLICY IF EXISTS "Users can view project_tasks in their organisation" ON project_tasks;
DROP POLICY IF EXISTS "Users can create project_tasks in their organisation" ON project_tasks;
DROP POLICY IF EXISTS "Users can update project_tasks in their organisation" ON project_tasks;
DROP POLICY IF EXISTS "Users can delete project_tasks in their organisation" ON project_tasks;

DROP POLICY IF EXISTS "Users can view task_views for their projects" ON task_views;
DROP POLICY IF EXISTS "Users can create task_views for their projects" ON task_views;
DROP POLICY IF EXISTS "Users can update task_views for their projects" ON task_views;
DROP POLICY IF EXISTS "Users can delete task_views for their projects" ON task_views;

-- ============================================
-- RLS POLICIES: TASK GROUPS
-- ============================================
CREATE POLICY "Users can view task_groups in their organisation"
  ON task_groups FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.organisation_id = task_groups.organisation_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create task_groups in their organisation"
  ON task_groups FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.organisation_id = task_groups.organisation_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update task_groups in their organisation"
  ON task_groups FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.organisation_id = task_groups.organisation_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete task_groups in their organisation"
  ON task_groups FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.organisation_id = task_groups.organisation_id
      AND om.user_id = auth.uid()
    )
  );

-- ============================================
-- RLS POLICIES: PROJECT TASKS
-- ============================================
CREATE POLICY "Users can view project_tasks in their organisation"
  ON project_tasks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.organisation_id = project_tasks.organisation_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create project_tasks in their organisation"
  ON project_tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.organisation_id = project_tasks.organisation_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update project_tasks in their organisation"
  ON project_tasks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.organisation_id = project_tasks.organisation_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete project_tasks in their organisation"
  ON project_tasks FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.organisation_id = project_tasks.organisation_id
      AND om.user_id = auth.uid()
    )
  );

-- ============================================
-- RLS POLICIES: TASK VIEWS
-- ============================================
CREATE POLICY "Users can view task_views for their projects"
  ON task_views FOR SELECT
  TO authenticated
  USING (
    task_views.user_id = auth.uid()
  );

CREATE POLICY "Users can create task_views for their projects"
  ON task_views FOR INSERT
  TO authenticated
  WITH CHECK (
    task_views.user_id = auth.uid()
  );

CREATE POLICY "Users can update task_views for their projects"
  ON task_views FOR UPDATE
  TO authenticated
  USING (
    task_views.user_id = auth.uid()
  );

CREATE POLICY "Users can delete task_views for their projects"
  ON task_views FOR DELETE
  TO authenticated
  USING (
    task_views.user_id = auth.uid()
  );

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_task_groups_project_id ON task_groups(project_id);
CREATE INDEX IF NOT EXISTS idx_task_groups_organisation_id ON task_groups(organisation_id);
CREATE INDEX IF NOT EXISTS idx_task_groups_sort_order ON task_groups(sort_order);

CREATE INDEX IF NOT EXISTS idx_project_tasks_project_id ON project_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_task_group_id ON project_tasks(task_group_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_parent_task_id ON project_tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_status ON project_tasks(status);
CREATE INDEX IF NOT EXISTS idx_project_tasks_priority ON project_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_project_tasks_organisation_id ON project_tasks(organisation_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_task_no ON project_tasks(task_no);

CREATE INDEX IF NOT EXISTS idx_task_views_user_id ON task_views(user_id);
CREATE INDEX IF NOT EXISTS idx_task_views_project_id ON task_views(project_id);
CREATE INDEX IF NOT EXISTS idx_task_views_is_default ON task_views(is_default);

-- ============================================
-- TRIGGER: Update updated_at
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

DROP TRIGGER IF EXISTS update_project_tasks_updated_at ON project_tasks;
CREATE TRIGGER update_project_tasks_updated_at
    BEFORE UPDATE ON project_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_task_views_updated_at ON task_views;
CREATE TRIGGER update_task_views_updated_at
    BEFORE UPDATE ON task_views
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- DEFAULT TASK VIEW TEMPLATE
-- ============================================
-- Users can have their own default views per project
