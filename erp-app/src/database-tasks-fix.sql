-- SQL to fix existing tasks and reminders tables
-- Run this if you get "relation already exists" errors

-- First, check if columns exist and add them if missing
DO $$
BEGIN
    -- Add columns to tasks table if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'description') THEN
        ALTER TABLE tasks ADD COLUMN description TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'assigned_to') THEN
        ALTER TABLE tasks ADD COLUMN assigned_to UUID[] DEFAULT '{}';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'is_personal') THEN
        ALTER TABLE tasks ADD COLUMN is_personal BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'category') THEN
        ALTER TABLE tasks ADD COLUMN category TEXT DEFAULT 'task';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'due_date') THEN
        ALTER TABLE tasks ADD COLUMN due_date TIMESTAMP;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'priority') THEN
        ALTER TABLE tasks ADD COLUMN priority TEXT DEFAULT 'normal';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'notes') THEN
        ALTER TABLE tasks ADD COLUMN notes TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'client_name') THEN
        ALTER TABLE tasks ADD COLUMN client_name TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'client_type') THEN
        ALTER TABLE tasks ADD COLUMN client_type TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'organisation_id') THEN
        ALTER TABLE tasks ADD COLUMN organisation_id UUID;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'created_by') THEN
        ALTER TABLE tasks ADD COLUMN created_by UUID;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'updated_at') THEN
        ALTER TABLE tasks ADD COLUMN updated_at TIMESTAMP DEFAULT now();
    END IF;
    
    -- Add columns to reminders table if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reminders' AND column_name = 'content') THEN
        ALTER TABLE reminders ADD COLUMN content TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reminders' AND column_name = 'type') THEN
        ALTER TABLE reminders ADD COLUMN type TEXT DEFAULT 'general';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reminders' AND column_name = 'target_users') THEN
        ALTER TABLE reminders ADD COLUMN target_users UUID[] DEFAULT '{}';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reminders' AND column_name = 'reminder_date') THEN
        ALTER TABLE reminders ADD COLUMN reminder_date TIMESTAMP;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reminders' AND column_name = 'keywords') THEN
        ALTER TABLE reminders ADD COLUMN keywords TEXT[] DEFAULT '{}';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reminders' AND column_name = 'organisation_id') THEN
        ALTER TABLE reminders ADD COLUMN organisation_id UUID;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reminders' AND column_name = 'created_by') THEN
        ALTER TABLE reminders ADD COLUMN created_by UUID;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reminders' AND column_name = 'updated_at') THEN
        ALTER TABLE reminders ADD COLUMN updated_at TIMESTAMP DEFAULT now();
    END IF;
END $$;

-- Enable RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view tasks in their organisation" ON tasks;
DROP POLICY IF EXISTS "Users can create tasks in their organisation" ON tasks;
DROP POLICY IF EXISTS "Users can update tasks in their organisation" ON tasks;
DROP POLICY IF EXISTS "Users can delete tasks in their organisation" ON tasks;
DROP POLICY IF EXISTS "Users can view reminders in their organisation" ON reminders;
DROP POLICY IF EXISTS "Users can create reminders in their organisation" ON reminders;

-- Create simple policies (no org_members dependency for now)
CREATE POLICY "Enable all access" ON tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access" ON reminders FOR ALL USING (true) WITH CHECK (true);

-- Create indexes
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
