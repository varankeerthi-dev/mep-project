-- ============================================
-- Estimation Module: est_ tables for BOQ, Rate Analysis, Tenders & Resource Catalog
-- Timestamp: 2024-01-01
-- ============================================

-- ============================================
-- BOQ HEADERS
-- ============================================
CREATE TABLE IF NOT EXISTS est_boq_headers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  boq_no VARCHAR(50) NOT NULL,
  revision_no INTEGER DEFAULT 1,
  title VARCHAR(255),
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Final', 'Approved', 'Converted')),
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE est_boq_headers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "est_boq_headers_org_access" ON est_boq_headers
  FOR ALL USING (organisation_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE INDEX IF NOT EXISTS idx_est_boq_headers_org ON est_boq_headers(organisation_id);
CREATE INDEX IF NOT EXISTS idx_est_boq_headers_status ON est_boq_headers(status);

-- ============================================
-- BOQ SECTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS est_boq_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boq_id UUID NOT NULL REFERENCES est_boq_headers(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  section_order INTEGER NOT NULL DEFAULT 0,
  description TEXT
);

ALTER TABLE est_boq_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "est_boq_sections_org_access" ON est_boq_sections
  FOR ALL USING (
    EXISTS (SELECT 1 FROM est_boq_headers h WHERE h.id = boq_id AND h.organisation_id = (auth.jwt() ->> 'org_id')::uuid)
  );

CREATE INDEX IF NOT EXISTS idx_est_boq_sections_boq ON est_boq_sections(boq_id);

-- ============================================
-- BOQ ITEMS
-- ============================================
CREATE TABLE IF NOT EXISTS est_boq_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES est_boq_sections(id) ON DELETE CASCADE,
  item_code VARCHAR(50),
  description TEXT NOT NULL,
  specification TEXT,
  unit VARCHAR(20),
  quantity NUMERIC(15,3) NOT NULL DEFAULT 0,
  rate NUMERIC(15,2),
  material_id UUID REFERENCES materials(id) ON DELETE SET NULL,
  notes TEXT,
  item_order INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE est_boq_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "est_boq_items_org_access" ON est_boq_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM est_boq_sections s JOIN est_boq_headers h ON h.id = s.boq_id WHERE s.id = section_id AND h.organisation_id = (auth.jwt() ->> 'org_id')::uuid)
  );

CREATE INDEX IF NOT EXISTS idx_est_boq_items_section ON est_boq_items(section_id);

-- ============================================
-- LABOUR CATALOG
-- ============================================
CREATE TABLE IF NOT EXISTS est_labour_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('skilled', 'semi-skilled', 'unskilled', 'supervisor')),
  default_rate NUMERIC(12,2),
  unit VARCHAR(20) NOT NULL DEFAULT 'day',
  is_active BOOLEAN NOT NULL DEFAULT true
);

ALTER TABLE est_labour_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "est_labour_catalog_org_access" ON est_labour_catalog
  FOR ALL USING (organisation_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE INDEX IF NOT EXISTS idx_est_labour_org ON est_labour_catalog(organisation_id);

-- ============================================
-- EQUIPMENT CATALOG
-- ============================================
CREATE TABLE IF NOT EXISTS est_equipment_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  default_rate NUMERIC(12,2),
  unit VARCHAR(20) NOT NULL DEFAULT 'day',
  is_active BOOLEAN NOT NULL DEFAULT true
);

ALTER TABLE est_equipment_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "est_equipment_catalog_org_access" ON est_equipment_catalog
  FOR ALL USING (organisation_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE INDEX IF NOT EXISTS idx_est_equipment_org ON est_equipment_catalog(organisation_id);

-- ============================================
-- RATE ANALYSIS
-- ============================================
CREATE TABLE IF NOT EXISTS est_rate_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boq_item_id UUID NOT NULL REFERENCES est_boq_items(id) ON DELETE CASCADE,
  total_resource_cost NUMERIC(15,2) DEFAULT 0,
  markup_percent NUMERIC(5,2) DEFAULT 0,
  calculated_rate NUMERIC(15,2) DEFAULT 0,
  variance_from_boq NUMERIC(15,2) DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Locked')),
  notes TEXT,
  UNIQUE(boq_item_id)
);

ALTER TABLE est_rate_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "est_rate_analysis_org_access" ON est_rate_analysis
  FOR ALL USING (
    EXISTS (SELECT 1 FROM est_boq_items i JOIN est_boq_sections s ON s.id = i.section_id JOIN est_boq_headers h ON h.id = s.boq_id WHERE i.id = boq_item_id AND h.organisation_id = (auth.jwt() ->> 'org_id')::uuid)
  );

CREATE INDEX IF NOT EXISTS idx_est_rate_analysis_item ON est_rate_analysis(boq_item_id);

-- ============================================
-- RATE RESOURCES
-- ============================================
CREATE TABLE IF NOT EXISTS est_rate_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_analysis_id UUID NOT NULL REFERENCES est_rate_analysis(id) ON DELETE CASCADE,
  resource_type VARCHAR(20) NOT NULL CHECK (resource_type IN ('labour', 'material', 'equipment', 'overhead', 'subcontract')),
  resource_id UUID,
  description TEXT NOT NULL,
  quantity NUMERIC(12,3) NOT NULL DEFAULT 1,
  unit VARCHAR(20),
  rate_per_unit NUMERIC(12,2) NOT NULL DEFAULT 0,
  remark TEXT
);

ALTER TABLE est_rate_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "est_rate_resources_org_access" ON est_rate_resources
  FOR ALL USING (
    EXISTS (SELECT 1 FROM est_rate_analysis ra JOIN est_boq_items i ON i.id = ra.boq_item_id JOIN est_boq_sections s ON s.id = i.section_id JOIN est_boq_headers h ON h.id = s.boq_id WHERE ra.id = rate_analysis_id AND h.organisation_id = (auth.jwt() ->> 'org_id')::uuid)
  );

CREATE INDEX IF NOT EXISTS idx_est_rate_resources_analysis ON est_rate_resources(rate_analysis_id);

-- ============================================
-- RATE TEMPLATES
-- ============================================
CREATE TABLE IF NOT EXISTS est_rate_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT true
);

ALTER TABLE est_rate_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "est_rate_templates_org_access" ON est_rate_templates
  FOR ALL USING (organisation_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE INDEX IF NOT EXISTS idx_est_rate_templates_org ON est_rate_templates(organisation_id);

-- ============================================
-- RATE TEMPLATE RESOURCES
-- ============================================
CREATE TABLE IF NOT EXISTS est_rate_template_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES est_rate_templates(id) ON DELETE CASCADE,
  resource_type VARCHAR(20) NOT NULL CHECK (resource_type IN ('labour', 'material', 'equipment', 'overhead', 'subcontract')),
  resource_id UUID,
  description TEXT NOT NULL,
  quantity NUMERIC(12,3) NOT NULL DEFAULT 1,
  unit VARCHAR(20),
  rate_per_unit NUMERIC(12,2) NOT NULL DEFAULT 0,
  remark TEXT
);

ALTER TABLE est_rate_template_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "est_rate_template_resources_org_access" ON est_rate_template_resources
  FOR ALL USING (
    EXISTS (SELECT 1 FROM est_rate_templates t WHERE t.id = template_id AND t.organisation_id = (auth.jwt() ->> 'org_id')::uuid)
  );

CREATE INDEX IF NOT EXISTS idx_est_rate_template_resources ON est_rate_template_resources(template_id);

-- ============================================
-- TENDERS
-- ============================================
CREATE TABLE IF NOT EXISTS est_tenders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  boq_id UUID REFERENCES est_boq_headers(id) ON DELETE SET NULL,
  tender_no VARCHAR(50) NOT NULL,
  title VARCHAR(255),
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  bid_amount NUMERIC(15,2),
  estimated_cost NUMERIC(15,2),
  expected_margin NUMERIC(5,2),
  status VARCHAR(20) NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Submitted', 'Won', 'Lost', 'Cancelled')),
  submission_date DATE,
  decision_date DATE,
  result_notes TEXT,
  win_loss_reason TEXT,
  award_amount NUMERIC(15,2),
  loa_reference VARCHAR(100),
  converted_to_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE est_tenders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "est_tenders_org_access" ON est_tenders
  FOR ALL USING (organisation_id = (auth.jwt() ->> 'org_id')::uuid);

CREATE INDEX IF NOT EXISTS idx_est_tenders_org ON est_tenders(organisation_id);
CREATE INDEX IF NOT EXISTS idx_est_tenders_status ON est_tenders(status);

-- ============================================
-- TENDER DOCUMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS est_tender_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id UUID NOT NULL REFERENCES est_tenders(id) ON DELETE CASCADE,
  document_type VARCHAR(50) CHECK (document_type IN ('technical_bid', 'commercial_bid', 'emd', 'loa', 'other')),
  file_name VARCHAR(255),
  file_url TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE est_tender_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "est_tender_documents_org_access" ON est_tender_documents
  FOR ALL USING (
    EXISTS (SELECT 1 FROM est_tenders t WHERE t.id = tender_id AND t.organisation_id = (auth.jwt() ->> 'org_id')::uuid)
  );

CREATE INDEX IF NOT EXISTS idx_est_tender_documents_tender ON est_tender_documents(tender_id);

-- ============================================
-- ESTIMATION SETTINGS
-- ============================================
CREATE TABLE IF NOT EXISTS est_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  status_workflow VARCHAR(20) NOT NULL DEFAULT 'loose' CHECK (status_workflow IN ('loose', 'gated')),
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  UNIQUE(organisation_id)
);

ALTER TABLE est_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "est_settings_org_access" ON est_settings
  FOR ALL USING (organisation_id = (auth.jwt() ->> 'org_id')::uuid);

-- ============================================
-- BOQ NUMBER GENERATION FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION generate_est_boq_number(p_org_id UUID)
RETURNS VARCHAR AS $$
DECLARE
  v_next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(boq_no, '[^0-9]', '', 'g') AS INTEGER)), 0) + 1
  INTO v_next_num
  FROM est_boq_headers
  WHERE organisation_id = p_org_id;

  RETURN 'BOQ-' || LPAD(v_next_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TENDER NUMBER GENERATION FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION generate_est_tender_number(p_org_id UUID)
RETURNS VARCHAR AS $$
DECLARE
  v_next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(tender_no, '[^0-9]', '', 'g') AS INTEGER)), 0) + 1
  INTO v_next_num
  FROM est_tenders
  WHERE organisation_id = p_org_id;

  RETURN 'TND-' || LPAD(v_next_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_est_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_est_boq_headers_updated_at
  BEFORE UPDATE ON est_boq_headers
  FOR EACH ROW EXECUTE FUNCTION update_est_updated_at();

CREATE TRIGGER trg_est_tenders_updated_at
  BEFORE UPDATE ON est_tenders
  FOR EACH ROW EXECUTE FUNCTION update_est_updated_at();
