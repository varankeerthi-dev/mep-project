-- 080_add_outward_missing_columns.sql
-- Adds missing multi-tenant and warehouse columns to material_outward and material_outward_items

-- 1. Add columns to material_outward
ALTER TABLE material_outward 
  ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE;

-- 2. Add columns to material_outward_items
ALTER TABLE material_outward_items 
  ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL;
