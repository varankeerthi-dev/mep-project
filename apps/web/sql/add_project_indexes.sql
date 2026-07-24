-- ============================================================================
-- Project Module V2 Refactor - Performance Optimization Indexes
-- ============================================================================

-- 1. Index for pagination and sorting by created_at
CREATE INDEX IF NOT EXISTS idx_projects_organisation_created
ON projects(organisation_id, created_at DESC);

-- 2. Index for status-based filtering
CREATE INDEX IF NOT EXISTS idx_projects_organisation_status
ON projects(organisation_id, status);

-- ============================================================================
-- NOTE:
-- idx_projects_organisation_id on projects(organisation_id) is already present.
-- ============================================================================
