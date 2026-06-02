-- Handover Planner Module
-- Run in Supabase SQL Editor

-- ============================================================
-- project_handovers: project-level handover milestones
-- One row per (project, system/area) the team plans to hand over
-- ============================================================
CREATE TABLE IF NOT EXISTS project_handovers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- What is being handed over. Free text because we have no systems/areas master.
  system_or_area TEXT NOT NULL,

  -- Loose categorisation
  handover_type VARCHAR(30) NOT NULL DEFAULT 'system'
    CHECK (handover_type IN ('system', 'area', 'zone', 'building', 'floor', 'other')),

  -- Timeline
  planned_date DATE NOT NULL,
  actual_date DATE,

  -- Status
  status VARCHAR(30) NOT NULL DEFAULT 'Planning'
    CHECK (status IN ('Planning', 'Ready', 'Snags', 'Signed', 'On Hold')),

  -- Assignment
  responsible_engineer_id UUID,
  responsible_engineer_name TEXT,

  -- Client signoff
  client_signoff_name TEXT,
  client_signoff_date DATE,
  client_signoff_notes TEXT,

  -- Free notes / snag list summary
  notes TEXT,
  snag_count INTEGER NOT NULL DEFAULT 0,

  -- Audit
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_project_handovers_org
  ON project_handovers(organisation_id);

CREATE INDEX IF NOT EXISTS idx_project_handovers_project
  ON project_handovers(project_id);

CREATE INDEX IF NOT EXISTS idx_project_handovers_status
  ON project_handovers(organisation_id, status);

CREATE INDEX IF NOT EXISTS idx_project_handovers_planned
  ON project_handovers(organisation_id, planned_date);

CREATE INDEX IF NOT EXISTS idx_project_handovers_engineer
  ON project_handovers(responsible_engineer_id)
  WHERE responsible_engineer_id IS NOT NULL;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE project_handovers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_handovers_select" ON project_handovers;
DROP POLICY IF EXISTS "project_handovers_insert" ON project_handovers;
DROP POLICY IF EXISTS "project_handovers_update" ON project_handovers;
DROP POLICY IF EXISTS "project_handovers_delete" ON project_handovers;

CREATE POLICY "project_handovers_select" ON project_handovers
  FOR SELECT
  USING (
    organisation_id = (
      SELECT organisation_id FROM org_members
      WHERE user_id = auth.uid()
      ORDER BY created_at DESC LIMIT 1
    )
  );

CREATE POLICY "project_handovers_insert" ON project_handovers
  FOR INSERT
  WITH CHECK (
    organisation_id = (
      SELECT organisation_id FROM org_members
      WHERE user_id = auth.uid()
      ORDER BY created_at DESC LIMIT 1
    )
  );

CREATE POLICY "project_handovers_update" ON project_handovers
  FOR UPDATE
  USING (
    organisation_id = (
      SELECT organisation_id FROM org_members
      WHERE user_id = auth.uid()
      ORDER BY created_at DESC LIMIT 1
    )
  )
  WITH CHECK (
    organisation_id = (
      SELECT organisation_id FROM org_members
      WHERE user_id = auth.uid()
      ORDER BY created_at DESC LIMIT 1
    )
  );

CREATE POLICY "project_handovers_delete" ON project_handovers
  FOR DELETE
  USING (
    organisation_id = (
      SELECT organisation_id FROM org_members
      WHERE user_id = auth.uid()
      ORDER BY created_at DESC LIMIT 1
    )
  );

-- ============================================================
-- updated_at trigger
-- ============================================================
DROP TRIGGER IF EXISTS trg_project_handovers_updated_at ON project_handovers;
CREATE TRIGGER trg_project_handovers_updated_at
  BEFORE UPDATE ON project_handovers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
