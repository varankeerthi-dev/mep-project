-- Add variant_id to delivery_challans table to support header-level default variant
ALTER TABLE delivery_challans ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES company_variants(id);

-- Also ensure material_inward has it (it was already there but good to verify if we need it elsewhere)
-- ALTER TABLE material_outward ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES company_variants(id);
