-- 1. Add parent_material_id to bom_items table
ALTER TABLE bom_items ADD COLUMN IF NOT EXISTS parent_material_id UUID REFERENCES bom_items(id) ON DELETE CASCADE;

-- 2. Create index on parent_material_id for faster recursive traversal joins
CREATE INDEX IF NOT EXISTS idx_bom_items_parent ON bom_items(parent_material_id);

-- 3. Cleanup obsolete level columns if any exist
ALTER TABLE bom_items DROP COLUMN IF EXISTS level;
ALTER TABLE bom_items DROP COLUMN IF EXISTS bom_level;
