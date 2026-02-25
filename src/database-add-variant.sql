-- Add variant support to material tables
-- Run this in Supabase SQL Editor

-- Material Inward table
ALTER TABLE material_inward ADD COLUMN IF NOT EXISTS warehouse_id UUID;
ALTER TABLE material_inward ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES company_variants(id);

-- Material Inward Items table
ALTER TABLE material_inward_items ADD COLUMN IF NOT EXISTS material_id UUID REFERENCES materials(id);
ALTER TABLE material_inward_items ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES company_variants(id);
ALTER TABLE material_inward_items ADD COLUMN IF NOT EXISTS warehouse_id UUID;

-- Material Outward table
ALTER TABLE material_outward ADD COLUMN IF NOT EXISTS warehouse_id UUID;
ALTER TABLE material_outward ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES company_variants(id);

-- Material Outward Items table
ALTER TABLE material_outward_items ADD COLUMN IF NOT EXISTS material_id UUID REFERENCES materials(id);
ALTER TABLE material_outward_items ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES company_variants(id);
