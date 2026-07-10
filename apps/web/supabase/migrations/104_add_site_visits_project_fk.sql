-- Migration: Add foreign key constraint to site_visits project_id referencing projects(id)
-- Created at: 2026-07-09

-- Update any orphaned project_ids to NULL to prevent constraint validation failure
UPDATE site_visits 
SET project_id = NULL 
WHERE project_id IS NOT NULL 
  AND project_id NOT IN (SELECT id FROM projects);

-- Add the foreign key constraint if it doesn't already exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND tc.table_name = 'site_visits'
          AND kcu.column_name = 'project_id'
    ) THEN
        ALTER TABLE site_visits 
        ADD CONSTRAINT fk_site_visits_projects 
        FOREIGN KEY (project_id) 
        REFERENCES projects(id) 
        ON DELETE SET NULL;
    END IF;
END $$;
