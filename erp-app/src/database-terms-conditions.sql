-- Database Schema for Terms & Conditions System
-- ===========================================

-- 1. Master Terms & Conditions Templates
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

-- 2. Terms & Conditions Sections (Headings)
CREATE TABLE IF NOT EXISTS terms_conditions_sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID REFERENCES terms_conditions_templates(id) ON DELETE CASCADE,
    organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    display_order INTEGER DEFAULT 0,
    is_configurable BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Terms & Conditions Items (Content)
CREATE TABLE IF NOT EXISTS terms_conditions_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    section_id UUID REFERENCES terms_conditions_sections(id) ON DELETE CASCADE,
    organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    item_type VARCHAR(20) DEFAULT 'bullet', -- 'bullet', 'number', 'text'
    is_configurable BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Quotation-specific Terms & Conditions (Dynamic overrides)
CREATE TABLE IF NOT EXISTS quotation_terms_conditions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quotation_id UUID REFERENCES quotation_header(id) ON DELETE CASCADE,
    organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
    template_id UUID REFERENCES terms_conditions_templates(id),
    is_custom BOOLEAN DEFAULT false, -- true if completely custom
    custom_content JSONB, -- Store custom structure
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Client-specific Payment Terms
CREATE TABLE IF NOT EXISTS client_payment_terms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
    payment_terms TEXT NOT NULL,
    advance_percentage DECIMAL(5,2) DEFAULT 0,
    payment_schedule JSONB, -- Store payment schedule details
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_terms_templates_org ON terms_conditions_templates(organisation_id);
CREATE INDEX IF NOT EXISTS idx_terms_sections_template ON terms_conditions_sections(template_id);
CREATE INDEX IF NOT EXISTS idx_terms_items_section ON terms_conditions_items(section_id);
CREATE INDEX IF NOT EXISTS idx_quotation_terms_quotation ON quotation_terms_conditions(quotation_id);
CREATE INDEX IF NOT EXISTS idx_client_payment_terms_client ON client_payment_terms(client_id);

-- 7. RLS Policies
ALTER TABLE terms_conditions_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE terms_conditions_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE terms_conditions_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_terms_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_payment_terms ENABLE ROW LEVEL SECURITY;

-- RLS for terms_conditions_templates
CREATE POLICY "terms_templates_organisation_policy" ON terms_conditions_templates FOR ALL 
USING (organisation_id = current_setting('app.current_organisation_id', true)::UUID);

-- RLS for terms_conditions_sections
CREATE POLICY "terms_sections_organisation_policy" ON terms_conditions_sections FOR ALL 
USING (organisation_id = current_setting('app.current_organisation_id', true)::UUID);

-- RLS for terms_conditions_items
CREATE POLICY "terms_items_organisation_policy" ON terms_conditions_items FOR ALL 
USING (organisation_id = current_setting('app.current_organisation_id', true)::UUID);

-- RLS for quotation_terms_conditions
CREATE POLICY "quotation_terms_organisation_policy" ON quotation_terms_conditions FOR ALL 
USING (organisation_id = current_setting('app.current_organisation_id', true)::UUID);

-- RLS for client_payment_terms
CREATE POLICY "client_payment_terms_organisation_policy" ON client_payment_terms FOR ALL 
USING (organisation_id = current_setting('app.current_organisation_id', true)::UUID);

-- 8. Default data will be created by the application when first organisation is set up
-- This avoids foreign key constraint issues with hardcoded organisation IDs
