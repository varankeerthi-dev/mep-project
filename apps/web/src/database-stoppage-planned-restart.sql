-- Work Stoppages: Two-Date Model & Calendar Integration
-- Adds planned_restart_date and planned_restart_visit_id to site_report_work_stoppages

ALTER TABLE site_report_work_stoppages
ADD COLUMN IF NOT EXISTS planned_restart_date DATE,
ADD COLUMN IF NOT EXISTS planned_restart_visit_id UUID REFERENCES site_visits(id) ON DELETE SET NULL;

-- Index for dashboard queries filtering by planned restart
CREATE INDEX IF NOT EXISTS idx_sr_stoppages_planned_restart
  ON site_report_work_stoppages(planned_restart_date)
  WHERE is_resolved = FALSE AND planned_restart_date IS NOT NULL;
