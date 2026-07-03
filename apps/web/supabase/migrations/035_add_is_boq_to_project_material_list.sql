-- Add is_boq column to project_material_list to distinguish BOQ vs non-BOQ materials
ALTER TABLE project_material_list ADD COLUMN IF NOT EXISTS is_boq BOOLEAN DEFAULT true;

-- Add index for filtering by is_boq
CREATE INDEX IF NOT EXISTS idx_project_material_list_is_boq ON project_material_list(is_boq);

-- Update comment
COMMENT ON COLUMN project_material_list.is_boq IS 'True if material is part of original BOQ, False if added from non-BOQ receipts';
