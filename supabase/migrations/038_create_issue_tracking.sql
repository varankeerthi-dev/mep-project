-- ============================================================
-- ENTERPRISE ISSUE TRACKING MODULE
-- Run this in Supabase SQL editor
-- Supports: Issue tracking, QA/QC, Punch list, NCR
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- MAIN ISSUES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  subcontractor_id UUID REFERENCES subcontractors(id) ON DELETE SET NULL,
  
  -- Core fields
  issue_no TEXT UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  
  -- Classification
  issue_type TEXT NOT NULL DEFAULT 'installation' CHECK (issue_type IN (
    'installation', 'quality', 'design', 'safety', 'breakdown', 'punchlist', 'ncr'
  )),
  system TEXT CHECK (system IN (
    'hvac', 'electrical', 'plumbing', 'firefighting', ' BMS', 'other'
  )),
  subsystem TEXT,
  
  -- Severity & Priority
  severity TEXT NOT NULL DEFAULT 'minor' CHECK (severity IN ('critical', 'major', 'minor')),
  priority TEXT CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  
  -- Status workflow
  status TEXT DEFAULT 'open' CHECK (status IN (
    'open', 'assigned', 'in_progress', 'waiting_inspection', 'verified', 'closed', 'reopened'
  )),
  
  -- Location tracking
  location_block TEXT,
  location_floor TEXT,
  location_room TEXT,
  location_zone TEXT,
  location_path JSONB DEFAULT '{"block": null, "floor": null, "room": null, "zone": null}',
  
  -- References
  equipment_tag TEXT,
  drawing_ref TEXT,
  boq_ref TEXT,
  
  -- Assignment
  reported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reported_by_name TEXT,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to_name TEXT,
  due_date DATE,
  
  -- Closure tracking
  closed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_by_name TEXT,
  closed_at TIMESTAMPTZ,
  closed_remark TEXT,
  reopen_remark TEXT,
  reopened_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ISSUE ATTACHMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS issue_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  issue_id UUID REFERENCES issues(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT CHECK (file_type IN ('image', 'video', 'document', 'drawing')),
  file_size INTEGER,
  caption TEXT,
  is_before BOOLEAN DEFAULT false,
  is_after BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ISSUE ACTIVITY LOGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS issue_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  issue_id UUID REFERENCES issues(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN (
    'created', 'assigned', 'unassigned', 'status_changed', 'comment_added',
    'attachment_added', 'closed', 'reopened', 'updated'
  )),
  old_value JSONB,
  new_value JSONB,
  done_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  done_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ISSUE COMMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS issue_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  issue_id UUID REFERENCES issues(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AUTO-GENERATE ISSUE NUMBER
-- ============================================================
CREATE OR REPLACE FUNCTION generate_issue_number(org_id UUID, proj_id UUID)
RETURNS TEXT AS $$
DECLARE
  year_code TEXT;
  seq_num INTEGER;
  proj_code TEXT;
  issue_num TEXT;
BEGIN
  year_code := EXTRACT(YEAR FROM NOW())::TEXT;
  seq_num := COALESCE(
    (SELECT COUNT(*) FROM issues WHERE organisation_id = org_id AND project_id = proj_id),
    0
  ) + 1;
  proj_code := COALESCE(
    (SELECT LEFT(project_code, 3) FROM projects WHERE id = proj_id),
    'PRJ'
  );
  issue_num := 'ISS-' || proj_code || '-' || year_code || '-' || LPAD(seq_num::TEXT, 4, '0');
  RETURN issue_num;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TRIGGER TO AUTO-SET ISSUE NUMBER
-- ============================================================
CREATE OR REPLACE FUNCTION set_issue_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.issue_no IS NULL OR NEW.issue_no = '' THEN
    NEW.issue_no := generate_issue_number(NEW.organisation_id, NEW.project_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS issue_number_trigger ON issues;
CREATE TRIGGER issue_number_trigger
  BEFORE INSERT ON issues
  FOR EACH ROW EXECUTE FUNCTION set_issue_number();

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_issues_org ON issues(organisation_id);
CREATE INDEX IF NOT EXISTS idx_issues_project ON issues(project_id);
CREATE INDEX IF NOT EXISTS idx_issues_client ON issues(client_id);
CREATE INDEX IF NOT EXISTS idx_issues_subcontractor ON issues(subcontractor_id);
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_severity ON issues(severity);
CREATE INDEX IF NOT EXISTS idx_issues_issue_type ON issues(issue_type);
CREATE INDEX IF NOT EXISTS idx_issues_system ON issues(system);
CREATE INDEX IF NOT EXISTS idx_issues_assigned_to ON issues(assigned_to);
CREATE INDEX IF NOT EXISTS idx_issues_reported_by ON issues(reported_by);
CREATE INDEX IF NOT EXISTS idx_issues_created_at ON issues(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_issues_due_date ON issues(due_date);
CREATE INDEX IF NOT EXISTS idx_issues_issue_no ON issues(issue_no);

CREATE INDEX IF NOT EXISTS idx_issue_attachments_issue ON issue_attachments(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_activity_logs_issue ON issue_activity_logs(issue_id DESC);
CREATE INDEX IF NOT EXISTS idx_issue_comments_issue ON issue_comments(issue_id);

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_comments ENABLE ROW LEVEL SECURITY;

-- Issues policy
DROP POLICY IF EXISTS "issues_org_policy" ON issues;
CREATE POLICY "issues_org_policy" ON issues FOR ALL
  USING (organisation_id = (SELECT organisation_id FROM user_profiles WHERE user_id = auth.uid()))
  WITH CHECK (organisation_id = (SELECT organisation_id FROM user_profiles WHERE user_id = auth.uid()));

-- Issue attachments policy
DROP POLICY IF EXISTS "issue_attachments_org_policy" ON issue_attachments;
CREATE POLICY "issue_attachments_org_policy" ON issue_attachments FOR ALL
  USING (organisation_id = (SELECT organisation_id FROM user_profiles WHERE user_id = auth.uid()))
  WITH CHECK (organisation_id = (SELECT organisation_id FROM user_profiles WHERE user_id = auth.uid()));

-- Issue activity logs policy
DROP POLICY IF EXISTS "issue_activity_logs_org_policy" ON issue_activity_logs;
CREATE POLICY "issue_activity_logs_org_policy" ON issue_activity_logs FOR ALL
  USING (organisation_id = (SELECT organisation_id FROM user_profiles WHERE user_id = auth.uid()))
  WITH CHECK (organisation_id = (SELECT organisation_id FROM user_profiles WHERE user_id = auth.uid()));

-- Issue comments policy
DROP POLICY IF EXISTS "issue_comments_org_policy" ON issue_comments;
CREATE POLICY "issue_comments_org_policy" ON issue_comments FOR ALL
  USING (organisation_id = (SELECT organisation_id FROM user_profiles WHERE user_id = auth.uid()))
  WITH CHECK (organisation_id = (SELECT organisation_id FROM user_profiles WHERE user_id = auth.uid()));

-- ============================================================
-- COMPLETE
-- ============================================================
SELECT 'Issue Tracking Module Created Successfully' AS result;