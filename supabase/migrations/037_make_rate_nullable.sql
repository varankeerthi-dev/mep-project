-- Make rate column nullable to support non-BOQ materials where price may not be known at receipt time
ALTER TABLE project_material_list ALTER COLUMN rate DROP NOT NULL;

-- Update existing 0 rates to NULL for non-BOQ items (optional, helps distinguish unknown vs 0 price)
UPDATE project_material_list 
SET rate = NULL 
WHERE is_boq = false AND rate = 0;

COMMENT ON COLUMN project_material_list.rate IS 'Rate per unit. NULL for non-BOQ items where price is not yet known. 0 means free material.';
