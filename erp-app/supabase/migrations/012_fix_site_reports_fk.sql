-- Fix orphaned site_reports and add FK constraint to projects

-- Step 1: Set project_id to NULL for records that reference non-existent projects
UPDATE site_reports
SET project_id = NULL
WHERE project_id IS NOT NULL
AND project_id NOT IN (SELECT id FROM projects WHERE id IS NOT NULL);

-- Step 2: Now add the foreign key constraint (it should work now)
ALTER TABLE site_reports 
  ADD CONSTRAINT fk_site_reports_project 
  FOREIGN KEY (project_id) 
  REFERENCES projects(id) 
  ON DELETE SET NULL;
