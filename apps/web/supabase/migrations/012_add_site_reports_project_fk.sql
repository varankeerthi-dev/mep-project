-- Add missing foreign key constraint between site_reports and projects

-- First, add the foreign key constraint (this will fail if data is inconsistent, which we'll handle)
DO $$
BEGIN
  -- Try to add the foreign key
  ALTER TABLE site_reports 
    ADD CONSTRAINT fk_site_reports_project 
    FOREIGN KEY (project_id) 
    REFERENCES projects(id) 
    ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'Foreign key constraint already exists';
  WHEN others THEN
    RAISE NOTICE 'Could not add foreign key: %', SQLERRM;
END $$;

-- Verify the constraint was added
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_site_reports_project' 
    AND table_name = 'site_reports'
  ) THEN
    RAISE NOTICE 'Foreign key fk_site_reports_project created successfully';
  ELSE
    RAISE NOTICE 'Warning: Foreign key was not created. Check data consistency.';
  END IF;
END $$;
