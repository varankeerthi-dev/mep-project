-- ============================================================
-- ESTIMATION MODULE — BOQ, Rate Analysis, Tenders
-- All tables prefixed est_
-- ============================================================

-- ============================================================
-- 1. BOQ HEADERS
-- ============================================================
CREATE TABLE IF NOT EXISTS est_boq_headers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  boq_no TEXT NOT NULL,
  revision_no INT DEFAULT 1,
  title TEXT,
  project_id UUID REFERENCES projects(id),
  client_id UUID REFERENCES clients(id),
  date DATE,
  status TEXT DEFAULT 'Draft' CHECK (status IN ('Draft', 'Final', 'Approved', 'Converted')),
  currency TEXT DEFAULT 'INR',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_est_boq_headers_org ON est_boq_headers(organisation_id);
CREATE INDEX IF NOT EXISTS idx_est_boq_headers_status ON est_boq_headers(status);

ALTER TABLE est_boq_headers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "est_boq_org_select" ON est_boq_headers;
DROP POLICY IF EXISTS "est_boq_org_insert" ON est_boq_headers;
DROP POLICY IF EXISTS "est_boq_org_update" ON est_boq_headers;
DROP POLICY IF EXISTS "est_boq_org_delete" ON est_boq_headers;

CREATE POLICY "est_boq_org_select" ON est_boq_headers
  FOR SELECT USING (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "est_boq_org_insert" ON est_boq_headers
  FOR INSERT WITH CHECK (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "est_boq_org_update" ON est_boq_headers
  FOR UPDATE USING (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "est_boq_org_delete" ON est_boq_headers
  FOR DELETE USING (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));

-- ============================================================
-- 2. BOQ SECTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS est_boq_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boq_id UUID NOT NULL REFERENCES est_boq_headers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  section_order INT DEFAULT 0,
  description TEXT
);

CREATE INDEX IF NOT EXISTS idx_est_boq_sections_boq ON est_boq_sections(boq_id);

ALTER TABLE est_boq_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "est_boq_sections_org_select" ON est_boq_sections;
DROP POLICY IF EXISTS "est_boq_sections_org_insert" ON est_boq_sections;
DROP POLICY IF EXISTS "est_boq_sections_org_update" ON est_boq_sections;
DROP POLICY IF EXISTS "est_boq_sections_org_delete" ON est_boq_sections;

CREATE POLICY "est_boq_sections_org_select" ON est_boq_sections
  FOR SELECT USING (boq_id IN (SELECT id FROM est_boq_headers WHERE organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  )));
CREATE POLICY "est_boq_sections_org_insert" ON est_boq_sections
  FOR INSERT WITH CHECK (boq_id IN (SELECT id FROM est_boq_headers WHERE organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  )));
CREATE POLICY "est_boq_sections_org_update" ON est_boq_sections
  FOR UPDATE USING (boq_id IN (SELECT id FROM est_boq_headers WHERE organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  )));
CREATE POLICY "est_boq_sections_org_delete" ON est_boq_sections
  FOR DELETE USING (boq_id IN (SELECT id FROM est_boq_headers WHERE organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  )));

-- ============================================================
-- 3. BOQ ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS est_boq_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES est_boq_sections(id) ON DELETE CASCADE,
  item_code TEXT,
  description TEXT NOT NULL,
  specification TEXT,
  unit TEXT,
  quantity NUMERIC(15,4) DEFAULT 0,
  rate NUMERIC(15,2) DEFAULT 0,
  amount NUMERIC(15,2) GENERATED ALWAYS AS (quantity * rate) STORED,
  material_id UUID REFERENCES materials(id),
  notes TEXT,
  item_order INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_est_boq_items_section ON est_boq_items(section_id);

ALTER TABLE est_boq_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "est_boq_items_org_select" ON est_boq_items;
DROP POLICY IF EXISTS "est_boq_items_org_insert" ON est_boq_items;
DROP POLICY IF EXISTS "est_boq_items_org_update" ON est_boq_items;
DROP POLICY IF EXISTS "est_boq_items_org_delete" ON est_boq_items;

CREATE POLICY "est_boq_items_org_select" ON est_boq_items
  FOR SELECT USING (section_id IN (SELECT s.id FROM est_boq_sections s JOIN est_boq_headers h ON h.id = s.boq_id WHERE h.organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  )));
CREATE POLICY "est_boq_items_org_insert" ON est_boq_items
  FOR INSERT WITH CHECK (section_id IN (SELECT s.id FROM est_boq_sections s JOIN est_boq_headers h ON h.id = s.boq_id WHERE h.organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  )));
CREATE POLICY "est_boq_items_org_update" ON est_boq_items
  FOR UPDATE USING (section_id IN (SELECT s.id FROM est_boq_sections s JOIN est_boq_headers h ON h.id = s.boq_id WHERE h.organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  )));
CREATE POLICY "est_boq_items_org_delete" ON est_boq_items
  FOR DELETE USING (section_id IN (SELECT s.id FROM est_boq_sections s JOIN est_boq_headers h ON h.id = s.boq_id WHERE h.organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  )));

-- ============================================================
-- 4. RATE ANALYSIS
-- ============================================================
CREATE TABLE IF NOT EXISTS est_rate_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boq_item_id UUID NOT NULL REFERENCES est_boq_items(id) ON DELETE CASCADE,
  total_resource_cost NUMERIC(15,2) DEFAULT 0,
  markup_percent NUMERIC(5,2) DEFAULT 0,
  calculated_rate NUMERIC(15,2) DEFAULT 0,
  variance_from_boq NUMERIC(15,2) DEFAULT 0,
  status TEXT DEFAULT 'Draft' CHECK (status IN ('Draft', 'Locked')),
  notes TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_est_rate_analysis_item ON est_rate_analysis(boq_item_id);

ALTER TABLE est_rate_analysis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "est_rate_analysis_org_select" ON est_rate_analysis;
DROP POLICY IF EXISTS "est_rate_analysis_org_insert" ON est_rate_analysis;
DROP POLICY IF EXISTS "est_rate_analysis_org_update" ON est_rate_analysis;
DROP POLICY IF EXISTS "est_rate_analysis_org_delete" ON est_rate_analysis;

CREATE POLICY "est_rate_analysis_org_select" ON est_rate_analysis
  FOR SELECT USING (boq_item_id IN (SELECT i.id FROM est_boq_items i JOIN est_boq_sections s ON s.id = i.section_id JOIN est_boq_headers h ON h.id = s.boq_id WHERE h.organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  )));
CREATE POLICY "est_rate_analysis_org_insert" ON est_rate_analysis
  FOR INSERT WITH CHECK (boq_item_id IN (SELECT i.id FROM est_boq_items i JOIN est_boq_sections s ON s.id = i.section_id JOIN est_boq_headers h ON h.id = s.boq_id WHERE h.organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  )));
CREATE POLICY "est_rate_analysis_org_update" ON est_rate_analysis
  FOR UPDATE USING (boq_item_id IN (SELECT i.id FROM est_boq_items i JOIN est_boq_sections s ON s.id = i.section_id JOIN est_boq_headers h ON h.id = s.boq_id WHERE h.organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  )));
CREATE POLICY "est_rate_analysis_org_delete" ON est_rate_analysis
  FOR DELETE USING (boq_item_id IN (SELECT i.id FROM est_boq_items i JOIN est_boq_sections s ON s.id = i.section_id JOIN est_boq_headers h ON h.id = s.boq_id WHERE h.organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  )));

-- ============================================================
-- 5. RATE RESOURCES
-- ============================================================
CREATE TABLE IF NOT EXISTS est_rate_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_analysis_id UUID NOT NULL REFERENCES est_rate_analysis(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('labour', 'material', 'equipment', 'overhead', 'subcontract')),
  resource_id UUID,
  description TEXT NOT NULL,
  quantity NUMERIC(15,4) DEFAULT 1,
  unit TEXT,
  rate_per_unit NUMERIC(15,2) DEFAULT 0,
  total_amount NUMERIC(15,2) GENERATED ALWAYS AS (quantity * rate_per_unit) STORED,
  remark TEXT
);

CREATE INDEX IF NOT EXISTS idx_est_rate_resources_analysis ON est_rate_resources(rate_analysis_id);

ALTER TABLE est_rate_resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "est_rate_resources_org_select" ON est_rate_resources;
DROP POLICY IF EXISTS "est_rate_resources_org_insert" ON est_rate_resources;
DROP POLICY IF EXISTS "est_rate_resources_org_update" ON est_rate_resources;
DROP POLICY IF EXISTS "est_rate_resources_org_delete" ON est_rate_resources;

CREATE POLICY "est_rate_resources_org_select" ON est_rate_resources
  FOR SELECT USING (rate_analysis_id IN (SELECT ra.id FROM est_rate_analysis ra JOIN est_boq_items i ON i.id = ra.boq_item_id JOIN est_boq_sections s ON s.id = i.section_id JOIN est_boq_headers h ON h.id = s.boq_id WHERE h.organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  )));
CREATE POLICY "est_rate_resources_org_insert" ON est_rate_resources
  FOR INSERT WITH CHECK (rate_analysis_id IN (SELECT ra.id FROM est_rate_analysis ra JOIN est_boq_items i ON i.id = ra.boq_item_id JOIN est_boq_sections s ON s.id = i.section_id JOIN est_boq_headers h ON h.id = s.boq_id WHERE h.organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  )));
CREATE POLICY "est_rate_resources_org_update" ON est_rate_resources
  FOR UPDATE USING (rate_analysis_id IN (SELECT ra.id FROM est_rate_analysis ra JOIN est_boq_items i ON i.id = ra.boq_item_id JOIN est_boq_sections s ON s.id = i.section_id JOIN est_boq_headers h ON h.id = s.boq_id WHERE h.organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  )));
CREATE POLICY "est_rate_resources_org_delete" ON est_rate_resources
  FOR DELETE USING (rate_analysis_id IN (SELECT ra.id FROM est_rate_analysis ra JOIN est_boq_items i ON i.id = ra.boq_item_id JOIN est_boq_sections s ON s.id = i.section_id JOIN est_boq_headers h ON h.id = s.boq_id WHERE h.organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  )));

-- ============================================================
-- 6. LABOUR CATALOG
-- ============================================================
CREATE TABLE IF NOT EXISTS est_labour_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('skilled', 'semi-skilled', 'unskilled', 'supervisor')),
  default_rate NUMERIC(15,2),
  unit TEXT DEFAULT 'day',
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_est_labour_catalog_org ON est_labour_catalog(organisation_id);

ALTER TABLE est_labour_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "est_labour_org_select" ON est_labour_catalog;
DROP POLICY IF EXISTS "est_labour_org_insert" ON est_labour_catalog;
DROP POLICY IF EXISTS "est_labour_org_update" ON est_labour_catalog;
DROP POLICY IF EXISTS "est_labour_org_delete" ON est_labour_catalog;

CREATE POLICY "est_labour_org_select" ON est_labour_catalog
  FOR SELECT USING (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "est_labour_org_insert" ON est_labour_catalog
  FOR INSERT WITH CHECK (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "est_labour_org_update" ON est_labour_catalog
  FOR UPDATE USING (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "est_labour_org_delete" ON est_labour_catalog
  FOR DELETE USING (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));

-- ============================================================
-- 7. EQUIPMENT CATALOG
-- ============================================================
CREATE TABLE IF NOT EXISTS est_equipment_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  name TEXT NOT NULL,
  category TEXT,
  default_rate NUMERIC(15,2),
  unit TEXT DEFAULT 'day',
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_est_equipment_catalog_org ON est_equipment_catalog(organisation_id);

ALTER TABLE est_equipment_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "est_equipment_org_select" ON est_equipment_catalog;
DROP POLICY IF EXISTS "est_equipment_org_insert" ON est_equipment_catalog;
DROP POLICY IF EXISTS "est_equipment_org_update" ON est_equipment_catalog;
DROP POLICY IF EXISTS "est_equipment_org_delete" ON est_equipment_catalog;

CREATE POLICY "est_equipment_org_select" ON est_equipment_catalog
  FOR SELECT USING (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "est_equipment_org_insert" ON est_equipment_catalog
  FOR INSERT WITH CHECK (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "est_equipment_org_update" ON est_equipment_catalog
  FOR UPDATE USING (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "est_equipment_org_delete" ON est_equipment_catalog
  FOR DELETE USING (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));

-- ============================================================
-- 8. RATE TEMPLATES
-- ============================================================
CREATE TABLE IF NOT EXISTS est_rate_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_est_rate_templates_org ON est_rate_templates(organisation_id);

ALTER TABLE est_rate_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "est_rate_templates_org_select" ON est_rate_templates;
DROP POLICY IF EXISTS "est_rate_templates_org_insert" ON est_rate_templates;
DROP POLICY IF EXISTS "est_rate_templates_org_update" ON est_rate_templates;
DROP POLICY IF EXISTS "est_rate_templates_org_delete" ON est_rate_templates;

CREATE POLICY "est_rate_templates_org_select" ON est_rate_templates
  FOR SELECT USING (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "est_rate_templates_org_insert" ON est_rate_templates
  FOR INSERT WITH CHECK (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "est_rate_templates_org_update" ON est_rate_templates
  FOR UPDATE USING (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "est_rate_templates_org_delete" ON est_rate_templates
  FOR DELETE USING (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));

-- ============================================================
-- 9. RATE TEMPLATE RESOURCES
-- ============================================================
CREATE TABLE IF NOT EXISTS est_rate_template_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES est_rate_templates(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('labour', 'material', 'equipment', 'overhead', 'subcontract')),
  resource_id UUID,
  description TEXT NOT NULL,
  quantity NUMERIC(15,4) DEFAULT 1,
  unit TEXT,
  rate_per_unit NUMERIC(15,2) DEFAULT 0,
  remark TEXT
);

CREATE INDEX IF NOT EXISTS idx_est_rate_template_resources_tpl ON est_rate_template_resources(template_id);

ALTER TABLE est_rate_template_resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "est_rate_tpl_res_org_select" ON est_rate_template_resources;
DROP POLICY IF EXISTS "est_rate_tpl_res_org_insert" ON est_rate_template_resources;
DROP POLICY IF EXISTS "est_rate_tpl_res_org_update" ON est_rate_template_resources;
DROP POLICY IF EXISTS "est_rate_tpl_res_org_delete" ON est_rate_template_resources;

CREATE POLICY "est_rate_tpl_res_org_select" ON est_rate_template_resources
  FOR SELECT USING (template_id IN (SELECT id FROM est_rate_templates WHERE organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  )));
CREATE POLICY "est_rate_tpl_res_org_insert" ON est_rate_template_resources
  FOR INSERT WITH CHECK (template_id IN (SELECT id FROM est_rate_templates WHERE organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  )));
CREATE POLICY "est_rate_tpl_res_org_update" ON est_rate_template_resources
  FOR UPDATE USING (template_id IN (SELECT id FROM est_rate_templates WHERE organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  )));
CREATE POLICY "est_rate_tpl_res_org_delete" ON est_rate_template_resources
  FOR DELETE USING (template_id IN (SELECT id FROM est_rate_templates WHERE organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  )));

-- ============================================================
-- 10. TENDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS est_tenders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  boq_id UUID REFERENCES est_boq_headers(id),
  tender_no TEXT NOT NULL,
  title TEXT,
  client_id UUID REFERENCES clients(id),
  project_id UUID REFERENCES projects(id),
  bid_amount NUMERIC(15,2),
  estimated_cost NUMERIC(15,2),
  expected_margin NUMERIC(5,2),
  status TEXT DEFAULT 'Draft' CHECK (status IN ('Draft', 'Submitted', 'Won', 'Lost', 'Cancelled')),
  submission_date DATE,
  decision_date DATE,
  result_notes TEXT,
  win_loss_reason TEXT,
  award_amount NUMERIC(15,2),
  loa_reference TEXT,
  converted_to_project_id UUID REFERENCES projects(id),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_est_tenders_org ON est_tenders(organisation_id);
CREATE INDEX IF NOT EXISTS idx_est_tenders_status ON est_tenders(status);

ALTER TABLE est_tenders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "est_tenders_org_select" ON est_tenders;
DROP POLICY IF EXISTS "est_tenders_org_insert" ON est_tenders;
DROP POLICY IF EXISTS "est_tenders_org_update" ON est_tenders;
DROP POLICY IF EXISTS "est_tenders_org_delete" ON est_tenders;

CREATE POLICY "est_tenders_org_select" ON est_tenders
  FOR SELECT USING (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "est_tenders_org_insert" ON est_tenders
  FOR INSERT WITH CHECK (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "est_tenders_org_update" ON est_tenders
  FOR UPDATE USING (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "est_tenders_org_delete" ON est_tenders
  FOR DELETE USING (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));

-- ============================================================
-- 11. TENDER DOCUMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS est_tender_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id UUID NOT NULL REFERENCES est_tenders(id) ON DELETE CASCADE,
  document_type TEXT CHECK (document_type IN ('technical_bid', 'commercial_bid', 'emd', 'loa', 'other')),
  file_name TEXT,
  file_url TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_est_tender_docs_tender ON est_tender_documents(tender_id);

ALTER TABLE est_tender_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "est_tender_docs_org_select" ON est_tender_documents;
DROP POLICY IF EXISTS "est_tender_docs_org_insert" ON est_tender_documents;
DROP POLICY IF EXISTS "est_tender_docs_org_update" ON est_tender_documents;
DROP POLICY IF EXISTS "est_tender_docs_org_delete" ON est_tender_documents;

CREATE POLICY "est_tender_docs_org_select" ON est_tender_documents
  FOR SELECT USING (tender_id IN (SELECT id FROM est_tenders WHERE organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  )));
CREATE POLICY "est_tender_docs_org_insert" ON est_tender_documents
  FOR INSERT WITH CHECK (tender_id IN (SELECT id FROM est_tenders WHERE organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  )));
CREATE POLICY "est_tender_docs_org_update" ON est_tender_documents
  FOR UPDATE USING (tender_id IN (SELECT id FROM est_tenders WHERE organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  )));
CREATE POLICY "est_tender_docs_org_delete" ON est_tender_documents
  FOR DELETE USING (tender_id IN (SELECT id FROM est_tenders WHERE organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  )));

-- ============================================================
-- 12. ESTIMATION SETTINGS (per-org config)
-- ============================================================
CREATE TABLE IF NOT EXISTS est_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) UNIQUE,
  status_workflow TEXT DEFAULT 'loose' CHECK (status_workflow IN ('loose', 'gated')),
  currency TEXT DEFAULT 'INR',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE est_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "est_settings_org_select" ON est_settings;
DROP POLICY IF EXISTS "est_settings_org_insert" ON est_settings;
DROP POLICY IF EXISTS "est_settings_org_update" ON est_settings;

CREATE POLICY "est_settings_org_select" ON est_settings
  FOR SELECT USING (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "est_settings_org_insert" ON est_settings
  FOR INSERT WITH CHECK (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "est_settings_org_update" ON est_settings
  FOR UPDATE USING (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));
