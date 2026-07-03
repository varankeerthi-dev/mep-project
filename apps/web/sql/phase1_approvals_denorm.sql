-- Phase 1 — Approval tab refactor: denormalized columns for row density
-- Safe to run on production: all columns are nullable, no data loss, no constraint changes.
-- Existing rows will have nulls and display "—" in the UI; run the Backfill button in
-- Approval Settings to populate them for historical approvals.

ALTER TABLE approvals
  ADD COLUMN IF NOT EXISTS requester_name    TEXT,
  ADD COLUMN IF NOT EXISTS requester_role    TEXT,
  ADD COLUMN IF NOT EXISTS project_id        UUID,
  ADD COLUMN IF NOT EXISTS project_name      TEXT,
  ADD COLUMN IF NOT EXISTS reference_number  TEXT;

-- Indexes for filter bar (Phase 3) and for project-scoped dashboards
CREATE INDEX IF NOT EXISTS idx_approvals_project_id ON approvals(project_id);
CREATE INDEX IF NOT EXISTS idx_approvals_requester ON approvals(requested_by);
CREATE INDEX IF NOT EXISTS idx_approvals_priority  ON approvals(priority);

-- Note: priority already has a CHECK constraint that limits it to LOW/NORMAL/HIGH/URGENT
-- so no need to touch it.
