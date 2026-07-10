-- Work Instruction Module (v1)
-- Run in the Supabase SQL editor (after the existing migrations).

-- ============================================================
-- 1. work_instructions  (one per site/team per day)
-- ============================================================
CREATE TABLE IF NOT EXISTS work_instructions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL,
  date DATE NOT NULL,
  client_name TEXT,                              -- e.g. "Voltas HO" (text only, no FK)
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published')),
  created_by UUID,                                 -- manager (user_profiles.user_id)
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_work_instructions_org_date
  ON work_instructions(organisation_id, date);

-- ============================================================
-- 2. work_items  (child rows — one per line item)
-- ============================================================
CREATE TABLE IF NOT EXISTS work_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_instruction_id UUID NOT NULL
    REFERENCES work_instructions(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  assignees UUID[] DEFAULT '{}',                    -- user_profiles.user_id[]
  project_id UUID REFERENCES projects(id),
  project_activity_id UUID REFERENCES project_activities(id),  -- optional link (v1: stored only)
  status TEXT NOT NULL DEFAULT 'suggested'
    CHECK (status IN ('suggested', 'pending', 'completed', 'postponed')),
  postpone_reason TEXT,
  blocked_by_note TEXT,
  carried_forward_from UUID REFERENCES work_items(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'manager'
    CHECK (source IN ('manager', 'engineer_suggested')),
  closed_by UUID,
  closed_at TIMESTAMPTZ,
  reassigned_at TIMESTAMPTZ,
  -- Engineer proposal (set in field; manager confirms in close-out)
  proposed_status TEXT
    CHECK (proposed_status IS NULL OR proposed_status IN ('completed', 'postponed')),
  proposed_reason TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enforce postpone_reason at the DB level (covers direct-write paths)
ALTER TABLE work_items
  DROP CONSTRAINT IF EXISTS postpone_reason_required;
ALTER TABLE work_items
  ADD CONSTRAINT postpone_reason_required
    CHECK (status <> 'postponed' OR postpone_reason IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_work_items_instruction
  ON work_items(work_instruction_id);
CREATE INDEX IF NOT EXISTS idx_work_items_project
  ON work_items(project_id);
CREATE INDEX IF NOT EXISTS idx_work_items_status
  ON work_items(status);
CREATE INDEX IF NOT EXISTS idx_work_items_carried
  ON work_items(carried_forward_from);
CREATE INDEX IF NOT EXISTS idx_work_items_assignees
  ON work_items USING gin (assignees);

-- ============================================================
-- 3. project_activities  (new concept; link target only in v1)
-- ============================================================
CREATE TABLE IF NOT EXISTS project_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL,
  project_id UUID REFERENCES projects(id),
  title TEXT,
  activity_date DATE,
  status TEXT NOT NULL DEFAULT 'open',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_activities_org
  ON project_activities(organisation_id);

-- ============================================================
-- 4. Daily Report link  (PRD §7)
-- ============================================================
ALTER TABLE site_reports
  DROP COLUMN IF EXISTS work_instruction_id;
ALTER TABLE site_reports
  ADD COLUMN work_instruction_id UUID REFERENCES work_instructions(id);

-- ============================================================
-- 5. Manager Alerts — alert_type  (separation from comm-log cards)
-- ============================================================
ALTER TABLE manager_alerts
  DROP COLUMN IF EXISTS alert_type;
ALTER TABLE manager_alerts
  ADD COLUMN alert_type TEXT NOT NULL DEFAULT 'communication'
    CHECK (alert_type IN ('communication', 'work_instruction'));

CREATE INDEX IF NOT EXISTS idx_manager_alerts_type
  ON manager_alerts(organisation_id, alert_type);

-- ============================================================
-- 6. notifications — notification_type  (assignee alerts)
-- ============================================================
ALTER TABLE notifications
  DROP COLUMN IF EXISTS notification_type;
ALTER TABLE notifications
  ADD COLUMN notification_type TEXT NOT NULL DEFAULT 'general';

CREATE INDEX IF NOT EXISTS idx_notifications_type
  ON notifications(user_id, notification_type, read);

-- ============================================================
-- 7. RLS
-- ============================================================
ALTER TABLE work_instructions ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_activities ENABLE ROW LEVEL SECURITY;

-- work_instructions: org members see/modify their org's drafts
DROP POLICY IF EXISTS "WI instructions org members" ON work_instructions;
CREATE POLICY "WI instructions org members" ON work_instructions
  FOR ALL USING (
    organisation_id IN (SELECT organisation_id FROM org_members WHERE user_id = auth.uid())
  ) WITH CHECK (
    organisation_id IN (SELECT organisation_id FROM org_members WHERE user_id = auth.uid())
  );

-- work_items: reachable via parent instruction's org
DROP POLICY IF EXISTS "WI items org members" ON work_items;
CREATE POLICY "WI items org members" ON work_items
  FOR ALL USING (
    work_instruction_id IN (
      SELECT id FROM work_instructions
      WHERE organisation_id IN (SELECT organisation_id FROM org_members WHERE user_id = auth.uid())
    )
  ) WITH CHECK (
    work_instruction_id IN (
      SELECT id FROM work_instructions
      WHERE organisation_id IN (SELECT organisation_id FROM org_members WHERE user_id = auth.uid())
    )
  );

-- project_activities: org members
DROP POLICY IF EXISTS "WI activities org members" ON project_activities;
CREATE POLICY "WI activities org members" ON project_activities
  FOR ALL USING (
    organisation_id IN (SELECT organisation_id FROM org_members WHERE user_id = auth.uid())
  ) WITH CHECK (
    organisation_id IN (SELECT organisation_id FROM org_members WHERE user_id = auth.uid())
  );

-- manager_alerts: org members SELECT; org members can INSERT (publish/close-out push cards)
DROP POLICY IF EXISTS "WI alerts org insert" ON manager_alerts;
CREATE POLICY "WI alerts org insert" ON manager_alerts
  FOR INSERT WITH CHECK (
    organisation_id IN (SELECT organisation_id FROM org_members WHERE user_id = auth.uid())
  );
