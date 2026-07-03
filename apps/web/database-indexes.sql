-- ============================================================================
-- Site Report Module - Essential Database Indexes
-- Run these in Supabase SQL Editor for immediate performance improvement
-- ============================================================================

-- 1. INDEXES for site_reports table (Critical for performance)
-- ============================================================================

-- Primary lookup: organization + date (most common query)
CREATE INDEX IF NOT EXISTS idx_site_reports_org_date 
  ON site_reports(organization_id, report_date DESC);

-- Client-based filtering
CREATE INDEX IF NOT EXISTS idx_site_reports_client 
  ON site_reports(client_id) 
  WHERE client_id IS NOT NULL;

-- Project-based filtering
CREATE INDEX IF NOT EXISTS idx_site_reports_project 
  ON site_reports(project_id) 
  WHERE project_id IS NOT NULL;

-- Status-based filtering (for dashboard views)
CREATE INDEX IF NOT EXISTS idx_site_reports_pm_status 
  ON site_reports(pm_status, organization_id);

-- Composite index for common filter combinations
CREATE INDEX IF NOT EXISTS idx_site_reports_org_client_date 
  ON site_reports(organization_id, client_id, report_date DESC);

-- 2. INDEXES for clients table (multi-tenant)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_clients_org 
  ON clients(org_id);

CREATE INDEX IF NOT EXISTS idx_clients_org_name 
  ON clients(org_id, client_name);

-- 3. INDEXES for projects table (multi-tenant)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_projects_org 
  ON projects(organisation_id);

CREATE INDEX IF NOT EXISTS idx_projects_client 
  ON projects(client_id) 
  WHERE client_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_projects_org_client 
  ON projects(organisation_id, client_id);

-- 4. INDEXES for related tables
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_sub_contractors_report 
  ON sub_contractors(report_id);

CREATE INDEX IF NOT EXISTS idx_work_carried_out_report 
  ON work_carried_out(report_id);

CREATE INDEX IF NOT EXISTS idx_milestones_completed_report 
  ON milestones_completed(report_id);

-- 3. ANALYZE tables for query planner optimization
-- ============================================================================

ANALYZE site_reports;
ANALYZE sub_contractors;
ANALYZE work_carried_out;
ANALYZE milestones_completed;

-- ============================================================================
-- EXPECTED RESULTS:
-- - List view loading: 2-3s -> <500ms
-- - Client/Project dropdowns: 800ms -> <200ms
-- - Report filtering: 1-2s -> <300ms
-- ============================================================================
