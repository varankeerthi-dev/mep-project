-- Discount Settings Module
-- Creates discount structure with 4 customizable discount profiles

-- 1. Discount Structure Names Table (4 profiles)
CREATE TABLE IF NOT EXISTS discount_structures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    structure_number INT NOT NULL UNIQUE CHECK (structure_number BETWEEN 1 AND 4),
    structure_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Variant-specific discount settings (per structure)
CREATE TABLE IF NOT EXISTS discount_variant_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    structure_id UUID REFERENCES discount_structures(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES company_variants(id) ON DELETE CASCADE,
    default_discount_percent DECIMAL(5,2) DEFAULT 0,
    min_discount_percent DECIMAL(5,2) DEFAULT 0,
    max_discount_percent DECIMAL(5,2) DEFAULT 0,
    updated_by_user_id UUID,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(structure_id, variant_id)
);

-- 3. Add current structure to quotation_header
ALTER TABLE quotation_header ADD COLUMN IF NOT EXISTS discount_structure_id UUID REFERENCES discount_structures(id);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_discount_variant_settings_structure ON discount_variant_settings(structure_id);
CREATE INDEX IF NOT EXISTS idx_discount_variant_settings_variant ON discount_variant_settings(variant_id);

-- 5. Insert default 4 structures
INSERT INTO discount_structures (structure_number, structure_name, description) VALUES
(1, 'Standard', 'Default standard discount structure'),
(2, 'Premium', 'Premium discount structure for valued clients'),
(3, 'Bulk', 'Bulk order discount structure'),
(4, 'Special', 'Special discount structure for specific deals')
ON CONFLICT (structure_number) DO NOTHING;

-- 6. Function to auto-create variant settings when new variant is added
CREATE OR REPLACE FUNCTION handle_new_variant_discount_settings()
RETURNS TRIGGER AS $$
DECLARE
    structure RECORD;
BEGIN
    -- Create discount settings for each active structure
    FOR structure IN SELECT id FROM discount_structures WHERE is_active = true LOOP
        INSERT INTO discount_variant_settings (structure_id, variant_id, default_discount_percent, min_discount_percent, max_discount_percent)
        VALUES (structure.id, NEW.id, 0, 0, 0)
        ON CONFLICT (structure_id, variant_id) DO NOTHING;
    END LOOP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Trigger to auto-create settings for new variants
DROP TRIGGER IF EXISTS trigger_new_variant_discount_settings ON company_variants;
CREATE TRIGGER trigger_new_variant_discount_settings
AFTER INSERT ON company_variants
FOR EACH ROW
EXECUTE FUNCTION handle_new_variant_discount_settings();

-- 8. Comments
COMMENT ON TABLE discount_structures IS 'Stores 4 discount structure profiles (Standard, Premium, Bulk, Special)';
COMMENT ON TABLE discount_variant_settings IS 'Per-variant discount limits per structure';
