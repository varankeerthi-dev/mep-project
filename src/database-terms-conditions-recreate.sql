-- Database Schema for Terms & Conditions System
-- ===========================================
-- This script safely drops existing policies and recreates the schema

-- 1. Drop existing RLS policies first
DROP POLICY IF EXISTS "terms_templates_organisation_policy" ON terms_conditions_templates;
DROP POLICY IF EXISTS "terms_sections_organisation_policy" ON terms_conditions_sections;
DROP POLICY IF EXISTS "terms_items_organisation_policy" ON terms_conditions_items;
DROP POLICY IF EXISTS "quotation_terms_organisation_policy" ON quotation_terms_conditions;
DROP POLICY IF EXISTS "client_payment_terms_organisation_policy" ON client_payment_terms;

-- 2. Master Terms & Conditions Templates
CREATE TABLE IF NOT EXISTS terms_conditions_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

-- 3. Terms & Conditions Sections (Headings)
CREATE TABLE IF NOT EXISTS terms_conditions_sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID REFERENCES terms_conditions_templates(id) ON DELETE CASCADE,
    organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    display_order INTEGER DEFAULT 0,
    is_configurable BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Terms & Conditions Items (Content)
CREATE TABLE IF NOT EXISTS terms_conditions_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    section_id UUID REFERENCES terms_conditions_sections(id) ON DELETE CASCADE,
    organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    item_type VARCHAR(20) DEFAULT 'bullet' CHECK (item_type IN ('bullet', 'number', 'text')),
    is_configurable BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Quotation-specific Terms & Conditions (overrides)
CREATE TABLE IF NOT EXISTS quotation_terms_conditions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quotation_id UUID REFERENCES quotation_header(id) ON DELETE CASCADE,
    organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
    template_id UUID REFERENCES terms_conditions_templates(id) ON DELETE SET NULL,
    custom_content JSONB, -- Store custom terms as JSON
    is_custom BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Client Payment Terms
CREATE TABLE IF NOT EXISTS client_payment_terms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
    payment_terms TEXT NOT NULL,
    payment_mode VARCHAR(100),
    credit_days INTEGER DEFAULT 0,
    advance_percentage DECIMAL(5,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Enable Row Level Security
ALTER TABLE terms_conditions_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE terms_conditions_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE terms_conditions_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_terms_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_payment_terms ENABLE ROW LEVEL SECURITY;

-- 8. Create RLS Policies
CREATE POLICY "terms_templates_organisation_policy" ON terms_conditions_templates
    FOR ALL USING (organisation_id = auth.uid()::uuid)
    WITH CHECK (organisation_id = auth.uid()::uuid);

CREATE POLICY "terms_sections_organisation_policy" ON terms_conditions_sections
    FOR ALL USING (organisation_id = auth.uid()::uuid)
    WITH CHECK (organisation_id = auth.uid()::uuid);

CREATE POLICY "terms_items_organisation_policy" ON terms_conditions_items
    FOR ALL USING (organisation_id = auth.uid()::uuid)
    WITH CHECK (organisation_id = auth.uid()::uuid);

CREATE POLICY "quotation_terms_organisation_policy" ON quotation_terms_conditions
    FOR ALL USING (organisation_id = auth.uid()::uuid)
    WITH CHECK (organisation_id = auth.uid()::uuid);

CREATE POLICY "client_payment_terms_organisation_policy" ON client_payment_terms
    FOR ALL USING (organisation_id = auth.uid()::uuid)
    WITH CHECK (organisation_id = auth.uid()::uuid);

-- 9. Create Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_terms_templates_organisation ON terms_conditions_templates(organisation_id);
CREATE INDEX IF NOT EXISTS idx_terms_sections_template ON terms_conditions_sections(template_id);
CREATE INDEX IF NOT EXISTS idx_terms_sections_organisation ON terms_conditions_sections(organisation_id);
CREATE INDEX IF NOT EXISTS idx_terms_items_section ON terms_conditions_items(section_id);
CREATE INDEX IF NOT EXISTS idx_terms_items_organisation ON terms_conditions_items(organisation_id);
CREATE INDEX IF NOT EXISTS idx_quotation_terms_quotation ON quotation_terms_conditions(quotation_id);
CREATE INDEX IF NOT EXISTS idx_quotation_terms_organisation ON quotation_terms_conditions(organisation_id);
CREATE INDEX IF NOT EXISTS idx_client_payment_terms_client ON client_payment_terms(client_id);
CREATE INDEX IF NOT EXISTS idx_client_payment_terms_organisation ON client_payment_terms(organisation_id);

-- 10. Create Triggers for Updated Timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_terms_templates_updated_at BEFORE UPDATE ON terms_conditions_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_terms_sections_updated_at BEFORE UPDATE ON terms_conditions_sections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_terms_items_updated_at BEFORE UPDATE ON terms_conditions_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quotation_terms_updated_at BEFORE UPDATE ON quotation_terms_conditions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_client_payment_terms_updated_at BEFORE UPDATE ON client_payment_terms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 11. Default data will be created by the application when first organisation is set up
-- This avoids foreign key constraint issues with hardcoded organisation IDs
