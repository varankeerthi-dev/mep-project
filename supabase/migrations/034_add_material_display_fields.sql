-- Add display_name and item_code columns to materials table
-- These fields are used in the project material list UI

ALTER TABLE materials ADD COLUMN IF NOT EXISTS display_name VARCHAR(255);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS item_code VARCHAR(50);

-- Create index for item_code if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_materials_item_code ON materials(item_code);

-- Add comments for documentation
COMMENT ON COLUMN materials.display_name IS 'Display name for the material item (user-friendly name)';
COMMENT ON COLUMN materials.item_code IS 'Unique item code/SKU for the material';
