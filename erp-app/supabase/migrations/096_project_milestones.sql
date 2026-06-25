-- ============================================================
-- 096_project_milestones.sql
-- Project Milestones Schema and Task Linking
-- Date: 2026-06-24
-- ============================================================

-- 1. Create milestone type enum if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'milestone_type') THEN
        CREATE TYPE milestone_type AS ENUM ('equipment_testing', 'inspection', 'handover', 'other');
    END IF;
END $$;

-- 2. Create project_milestones table
CREATE TABLE IF NOT EXISTS project_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    milestone_date DATE NOT NULL,
    type milestone_type NOT NULL,
    notes TEXT,
    is_completed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES auth.users(id)
);

-- 3. Add milestone_id to tasks table (due_date already exists)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS milestone_id UUID REFERENCES project_milestones(id) ON DELETE SET NULL;

-- 4. Add indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_project_milestones_project_date 
    ON project_milestones(project_id, milestone_date);

CREATE INDEX IF NOT EXISTS idx_tasks_due_date 
    ON tasks(due_date);

CREATE INDEX IF NOT EXISTS idx_tasks_milestone_id 
    ON tasks(milestone_id);

-- 5. Enable Row Level Security (RLS) on milestones
ALTER TABLE project_milestones ENABLE ROW LEVEL SECURITY;

-- 6. Add RLS Policies matching is_org_member check
DROP POLICY IF EXISTS "Users can select milestones in their orgs" ON project_milestones;
CREATE POLICY "Users can select milestones in their orgs" ON project_milestones
    FOR SELECT TO authenticated 
    USING (is_org_member(auth.uid(), organisation_id));

DROP POLICY IF EXISTS "Users can insert milestones in their orgs" ON project_milestones;
CREATE POLICY "Users can insert milestones in their orgs" ON project_milestones
    FOR INSERT TO authenticated 
    WITH CHECK (is_org_member(auth.uid(), organisation_id));

DROP POLICY IF EXISTS "Users can update milestones in their orgs" ON project_milestones;
CREATE POLICY "Users can update milestones in their orgs" ON project_milestones
    FOR UPDATE TO authenticated 
    USING (is_org_member(auth.uid(), organisation_id)) 
    WITH CHECK (is_org_member(auth.uid(), organisation_id));

DROP POLICY IF EXISTS "Users can delete milestones in their orgs" ON project_milestones;
CREATE POLICY "Users can delete milestones in their orgs" ON project_milestones
    FOR DELETE TO authenticated 
    USING (is_org_member(auth.uid(), organisation_id));
