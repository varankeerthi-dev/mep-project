-- Migration: Project Module Gaps (Tickets 002, 003, 005)
-- Covers: closure checklist, structured scope, archiving

-- ── Ticket 005: Add Archived status to project lifecycle ──
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_status') THEN
    ALTER TABLE projects DROP CONSTRAINT chk_status;
  END IF;
END $$;

ALTER TABLE projects ADD CONSTRAINT chk_status
  CHECK (status IN ('Draft', 'Active', 'Execution Completed', 'Financially Closed', 'Closed', 'Archived'));

-- ── Ticket 003: Structured scope items with versioning ──
CREATE TABLE IF NOT EXISTS project_scope_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scope_type VARCHAR(50) NOT NULL CHECK (scope_type IN (
    'contractor_scope', 'client_scope', 'excluded_scope', 'pending_approval', 'site_instructions'
  )),
  description TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  version INT NOT NULL DEFAULT 1,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  superseded_at TIMESTAMPTZ,
  superseded_by UUID REFERENCES project_scope_items(id)
);

CREATE INDEX IF NOT EXISTS idx_project_scope_items_project ON project_scope_items(project_id);
CREATE INDEX IF NOT EXISTS idx_project_scope_items_type ON project_scope_items(project_id, scope_type);

-- Scope item versions (audit trail)
CREATE TABLE IF NOT EXISTS project_scope_item_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scope_item_id UUID NOT NULL REFERENCES project_scope_items(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scope_type VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  version INT NOT NULL,
  change_summary TEXT,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scope_versions_item ON project_scope_item_versions(scope_item_id);
CREATE INDEX IF NOT EXISTS idx_scope_versions_project ON project_scope_item_versions(project_id);

-- ── Ticket 002: Closure checklist (configurable gates) ──
-- Admin-defined closure templates per org
CREATE TABLE IF NOT EXISTS project_closure_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_closure_templates_org ON project_closure_templates(organisation_id);

-- Individual gates within a template
CREATE TABLE IF NOT EXISTS project_closure_gates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES project_closure_templates(id) ON DELETE CASCADE,
  gate_key VARCHAR(100) NOT NULL,
  label VARCHAR(255) NOT NULL,
  description TEXT,
  sort_order INT DEFAULT 0,
  is_required BOOLEAN DEFAULT true,
  gate_type VARCHAR(50) DEFAULT 'manual' CHECK (gate_type IN ('manual', 'auto_invoices', 'auto_material', 'auto_handover', 'auto_warranty')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_closure_gates_template ON project_closure_gates(template_id);

-- Per-project closure checklist instance
CREATE TABLE IF NOT EXISTS project_closure_checklists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  gate_id UUID NOT NULL REFERENCES project_closure_gates(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'passed', 'failed', 'skipped')),
  notes TEXT,
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, gate_id)
);

CREATE INDEX IF NOT EXISTS idx_closure_checklist_project ON project_closure_checklists(project_id);

-- RLS: org-scoped access
ALTER TABLE project_closure_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_closure_gates ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_closure_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_scope_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_scope_item_versions ENABLE ROW LEVEL SECURITY;

-- Closure templates: org-scoped via organisation_id
CREATE POLICY closure_templates_org ON project_closure_templates
  USING (organisation_id = (SELECT organisation_id FROM users WHERE id = auth.uid()));

-- Closure gates: inherit from template
CREATE POLICY closure_gates_inherit ON project_closure_gates
  USING (template_id IN (SELECT id FROM project_closure_templates WHERE organisation_id = (SELECT organisation_id FROM users WHERE id = auth.uid())));

-- Closure checklists: project-scoped via project org
CREATE POLICY closure_checklists_project ON project_closure_checklists
  USING (project_id IN (SELECT id FROM projects WHERE organisation_id = (SELECT organisation_id FROM users WHERE id = auth.uid())));

-- Scope items: project-scoped
CREATE POLICY scope_items_project ON project_scope_items
  USING (project_id IN (SELECT id FROM projects WHERE organisation_id = (SELECT organisation_id FROM users WHERE id = auth.uid())));

CREATE POLICY scope_versions_project ON project_scope_item_versions
  USING (project_id IN (SELECT id FROM projects WHERE organisation_id = (SELECT organisation_id FROM users WHERE id = auth.uid())));
