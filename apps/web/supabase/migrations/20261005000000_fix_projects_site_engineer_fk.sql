-- Migration: 20261005000000_fix_projects_site_engineer_fk.sql
-- Description: Align projects.site_engineer_id foreign key constraint to reference employees(id) rather than users(id), matching project_manager_id.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_site_engineer_id_fkey') THEN
    ALTER TABLE public.projects DROP CONSTRAINT projects_site_engineer_id_fkey;
  END IF;
END $$;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_site_engineer_id_fkey
  FOREIGN KEY (site_engineer_id) REFERENCES public.employees(id) ON DELETE SET NULL;
