-- Material Inward Redesign - Database Schema Updates
-- Run this in Supabase SQL Editor

-- 1. Add uses_variant to materials table
ALTER TABLE materials ADD COLUMN IF NOT EXISTS uses_variant BOOLEAN DEFAULT false;

-- 2. Make company_variant_id nullable in item_stock (should already be nullable)
-- Drop and recreate unique constraint to allow NULL values
ALTER TABLE item_stock DROP CONSTRAINT IF EXISTS item_stock_item_id_company_variant_id_warehouse_id_key;

-- 3. Update item_stock to allow NULL variant_id
ALTER TABLE item_stock ALTER COLUMN company_variant_id DROP NOT NULL;

-- 4. Add unique constraint that handles NULL values properly
-- PostgreSQL treats NULL as distinct, so we need a partial unique index or use a different approach
CREATE UNIQUE INDEX IF NOT EXISTS item_stock_unique_non_variant 
ON item_stock (item_id, warehouse_id) 
WHERE company_variant_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS item_stock_unique_with_variant 
ON item_stock (item_id, company_variant_id, warehouse_id) 
WHERE company_variant_id IS NOT NULL;

-- 5. Ensure item_variant_pricing has proper structure
ALTER TABLE item_variant_pricing ALTER COLUMN company_variant_id DROP NOT NULL;

-- 6. Insert default variant if not exists
INSERT INTO company_variants (variant_name) VALUES 
  ('No Variant')
ON CONFLICT DO NOTHING;

-- 7. Enable RLS on warehouses if not enabled
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON warehouses;
CREATE POLICY "Enable all access" ON warehouses FOR ALL USING (true) WITH CHECK (true);
