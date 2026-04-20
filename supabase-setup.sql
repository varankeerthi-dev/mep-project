-- 1. Discount Structures Table
CREATE TABLE IF NOT EXISTS discount_structures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    structure_number INT NOT NULL UNIQUE CHECK (structure_number BETWEEN 1 AND 4),
    structure_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Variant discount settings
CREATE TABLE IF NOT EXISTS discount_variant_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
    structure_id UUID REFERENCES discount_structures(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES company_variants(id) ON DELETE CASCADE,
    default_discount_percent DECIMAL(5,2) DEFAULT 0,
    min_discount_percent DECIMAL(5,2) DEFAULT 0,
    max_discount_percent DECIMAL(5,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    updated_by_user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organisation_id, structure_id, variant_id)
);

-- 3. Insert default structures
INSERT INTO discount_structures (structure_number, structure_name, description) VALUES
(1, 'Standard', 'Default standard discount'),
(2, 'Premium', 'Premium discount for valued clients'),
(3, 'Bulk', 'Bulk order discount'),
(4, 'Special', 'Special discount structure')
ON CONFLICT (structure_number) DO NOTHING;

-- 4. Add column to quotation_header
ALTER TABLE quotation_header ADD COLUMN IF NOT EXISTS discount_structure_id UUID REFERENCES discount_structures(id);

-- 5. Enable RLS on tables
ALTER TABLE discount_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_variant_settings ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for discount_structures
CREATE POLICY "Service can view all discount_structures" ON discount_structures FOR SELECT USING (true);
CREATE POLICY "Service can insert discount_structures" ON discount_structures FOR INSERT WITH CHECK (true);
CREATE POLICY "Service can update discount_structures" ON discount_structures FOR UPDATE USING (true);
CREATE POLICY "Service can delete discount_structures" ON discount_structures FOR DELETE USING (true);

-- 7. RLS Policies for discount_variant_settings
CREATE POLICY "Users can view discount_variant_settings for their organisation" ON discount_variant_settings FOR SELECT USING (organisation_id IN (SELECT organisation_id FROM user_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert discount_variant_settings for their organisation" ON discount_variant_settings FOR INSERT WITH CHECK (organisation_id IN (SELECT organisation_id FROM user_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Users can update discount_variant_settings for their organisation" ON discount_variant_settings FOR UPDATE USING (organisation_id IN (SELECT organisation_id FROM user_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Users can delete discount_variant_settings for their organisation" ON discount_variant_settings FOR DELETE USING (organisation_id IN (SELECT organisation_id FROM user_profiles WHERE user_id = auth.uid()));