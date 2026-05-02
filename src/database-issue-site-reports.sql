-- Migration to link Site Reports to Issues (Phase 2)
ALTER TABLE site_reports
ADD COLUMN IF NOT EXISTS issue_id UUID REFERENCES issues(id);

-- Optional: Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_site_reports_issue_id ON site_reports(issue_id);
