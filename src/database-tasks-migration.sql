-- Run this in Supabase SQL Editor to migrate for TodoList tasks functionality

-- First, backup and migrate existing reminders data (optional)
-- If you want to keep existing reminders data, uncomment these lines:
-- CREATE TABLE reminders_backup AS SELECT * FROM reminders;

-- Drop the old reminders table structure and recreate with new schema
DROP TABLE IF EXISTS reminders CASCADE;

-- Create new reminders table with proper structure
CREATE TABLE reminders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  type TEXT DEFAULT 'general' CHECK (type IN ('general', 'targeted', 'announcement')),
  target_users UUID[] DEFAULT '{}',
  reminder_date TIMESTAMP,
  keywords TEXT[] DEFAULT '{}',
  organisation_id UUID,
  created_by UUID,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'To Do' CHECK (status IN ('To Do', 'In Progress', 'On Hold', 'Review', 'Completed')),
  assigned_to UUID[] DEFAULT '{}',
  is_personal BOOLEAN DEFAULT false,
  category TEXT DEFAULT 'task' CHECK (category IN ('task', 'idea')),
  due_date TIMESTAMP,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('normal', 'high', 'urgent')),
  notes TEXT,
  client_name TEXT,
  client_type TEXT CHECK (client_type IN ('order', 'complaint', 'followup')),
  organisation_id UUID,
  created_by UUID,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Enable RLS on tasks
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Enable RLS on reminders
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view tasks in their organisation" ON tasks;
DROP POLICY IF EXISTS "Users can create tasks in their organisation" ON tasks;
DROP POLICY IF EXISTS "Users can update tasks in their organisation" ON tasks;
DROP POLICY IF EXISTS "Users can delete tasks in their organisation" ON tasks;
DROP POLICY IF EXISTS "Users can view reminders in their organisation" ON reminders;
DROP POLICY IF EXISTS "Users can create reminders in their organisation" ON reminders;

-- RLS Policy for tasks: Users can view tasks in their organisation
CREATE POLICY "Users can view tasks in their organisation"
  ON tasks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.organisation_id = tasks.organisation_id
      AND om.user_id = auth.uid()
    )
  );

-- RLS Policy for tasks: Users can create tasks in their organisation
CREATE POLICY "Users can create tasks in their organisation"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.organisation_id = tasks.organisation_id
      AND om.user_id = auth.uid()
    )
  );

-- RLS Policy for tasks: Users can update tasks in their organisation
CREATE POLICY "Users can update tasks in their organisation"
  ON tasks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.organisation_id = tasks.organisation_id
      AND om.user_id = auth.uid()
    )
  );

-- RLS Policy for tasks: Users can delete tasks in their organisation
CREATE POLICY "Users can delete tasks in their organisation"
  ON tasks FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.organisation_id = tasks.organisation_id
      AND om.user_id = auth.uid()
    )
  );

-- RLS Policy for reminders: Users can view reminders in their organisation
CREATE POLICY "Users can view reminders in their organisation"
  ON reminders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.organisation_id = reminders.organisation_id
      AND om.user_id = auth.uid()
    )
  );

-- RLS Policy for reminders: Users can create reminders in their organisation
CREATE POLICY "Users can create reminders in their organisation"
  ON reminders FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.organisation_id = reminders.organisation_id
      AND om.user_id = auth.uid()
    )
  );

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tasks_organisation_id ON tasks(organisation_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_reminders_organisation_id ON reminders(organisation_id);
CREATE INDEX IF NOT EXISTS idx_reminders_type ON reminders(type);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_reminders_updated_at ON reminders;
CREATE TRIGGER update_reminders_updated_at
    BEFORE UPDATE ON reminders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
