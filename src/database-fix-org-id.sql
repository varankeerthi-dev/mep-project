-- Migration: Add organisation_id to inventory related tables for multi-tenancy
-- Date: 2026-05-21

-- 1. Add organisation_id to item_variant_pricing
ALTER TABLE item_variant_pricing 
ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE;

-- 2. Add organisation_id to item_stock
ALTER TABLE item_stock 
ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE;

-- 3. Add organisation_id to materials (if missing)
ALTER TABLE materials 
ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE;

-- 4. Enable RLS and add basic policies (Update to use your specific RLS logic if different)
ALTER TABLE item_variant_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_stock ENABLE ROW LEVEL SECURITY;

-- Simple policy example (Adjust based on your project's security model)
DROP POLICY IF EXISTS "Enable all access for org members" ON item_variant_pricing;
CREATE POLICY "Enable all access for org members" ON item_variant_pricing
FOR ALL USING (organisation_id IN (SELECT id FROM organisations));

DROP POLICY IF EXISTS "Enable all access for org members" ON item_stock;
CREATE POLICY "Enable all access for org members" ON item_stock
FOR ALL USING (organisation_id IN (SELECT id FROM organisations));
