-- Add variant support to material tables
-- Run this in Supabase SQL Editor

-- Material Inward table
ALTER TABLE material_inward ADD COLUMN IF NOT EXISTS warehouse_id UUID;
ALTER TABLE material_inward ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES company_variants(id);
ALTER TABLE material_inward ADD COLUMN IF NOT EXISTS invoice_date DATE;
ALTER TABLE material_inward ADD COLUMN IF NOT EXISTS received_date DATE;
ALTER TABLE material_inward ADD COLUMN IF NOT EXISTS received_by VARCHAR(255);
ALTER TABLE material_inward ADD COLUMN IF NOT EXISTS acknowledged_by VARCHAR(255);
ALTER TABLE material_inward ADD COLUMN IF NOT EXISTS supply_type VARCHAR(50) DEFAULT 'WAREHOUSE';
ALTER TABLE material_inward ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);

-- Material Inward Items table
ALTER TABLE material_inward_items ADD COLUMN IF NOT EXISTS material_id UUID REFERENCES materials(id);
ALTER TABLE material_inward_items ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES company_variants(id);
ALTER TABLE material_inward_items ADD COLUMN IF NOT EXISTS warehouse_id UUID;
ALTER TABLE material_inward_items ADD COLUMN IF NOT EXISTS supply_type VARCHAR(50) DEFAULT 'WAREHOUSE';
ALTER TABLE material_inward_items ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);

-- Material Outward table
ALTER TABLE material_outward ADD COLUMN IF NOT EXISTS warehouse_id UUID;
ALTER TABLE material_outward ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES company_variants(id);

-- Material Outward Items table
ALTER TABLE material_outward_items ADD COLUMN IF NOT EXISTS material_id UUID REFERENCES materials(id);
ALTER TABLE material_outward_items ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES company_variants(id);
