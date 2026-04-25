-- Create project_material_list table for manual material tracking per project
CREATE TABLE IF NOT EXISTS project_material_list (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES company_variants(id) ON DELETE SET NULL,
  planned_qty DECIMAL(15, 2) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL,
  rate DECIMAL(15, 2) NOT NULL DEFAULT 0,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_project_material_list_project ON project_material_list(project_id);
CREATE INDEX idx_project_material_list_organisation ON project_material_list(organisation_id);
CREATE INDEX idx_project_material_list_item ON project_material_list(item_id);

-- Enable RLS
ALTER TABLE project_material_list ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view material list for their organisations
CREATE POLICY "Users can view project material list"
  ON project_material_list FOR SELECT
  TO authenticated
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_organisations
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Users can insert material list for their organisations
CREATE POLICY "Users can insert project material list"
  ON project_material_list FOR INSERT
  TO authenticated
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM user_organisations
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Users can update material list for their organisations
CREATE POLICY "Users can update project material list"
  ON project_material_list FOR UPDATE
  TO authenticated
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_organisations
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Users can delete material list for their organisations
CREATE POLICY "Users can delete project material list"
  ON project_material_list FOR DELETE
  TO authenticated
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_organisations
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_project_material_list_updated_at
  BEFORE UPDATE ON project_material_list
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
