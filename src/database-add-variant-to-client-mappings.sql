-- Migration: Add variant support to client mappings and pricing
-- Date: 2026-05-21

-- 1. Add company_variant_id to material_client_mappings
ALTER TABLE material_client_mappings 
ADD COLUMN IF NOT EXISTS company_variant_id UUID REFERENCES company_variants(id) ON DELETE SET NULL;

-- 2. Add company_variant_id to material_client_pricing
ALTER TABLE material_client_pricing 
ADD COLUMN IF NOT EXISTS company_variant_id UUID REFERENCES company_variants(id) ON DELETE SET NULL;

-- 3. Update unique constraint for mappings
-- This allows a material to have different client codes for different variants
ALTER TABLE material_client_mappings 
DROP CONSTRAINT IF EXISTS material_client_mappings_material_id_client_id_key;

-- If the above name was different, let's try a generic approach or just add the new one
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'material_client_mappings_material_id_client_id_key') THEN
        ALTER TABLE material_client_mappings DROP CONSTRAINT material_client_mappings_material_id_client_id_key;
    END IF;
END $$;

ALTER TABLE material_client_mappings 
ADD CONSTRAINT material_client_mappings_variant_client_unique 
UNIQUE(material_id, client_id, company_variant_id);
