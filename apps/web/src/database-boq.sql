-- BOQ (Bill of Quantities) Module for MEP/Industrial Piping Projects
-- Run this in Supabase SQL Editor

-- ============================================
-- BOQ HEADER TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS boq_headers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boq_no VARCHAR(50) NOT NULL,
  revision_no INTEGER DEFAULT 1,
  boq_date DATE NOT NULL DEFAULT CURRENT_DATE,
  client_id UUID REFERENCES clients(id),
  project_id UUID REFERENCES projects(id),
  variant_id UUID REFERENCES company_variants(id),
  status VARCHAR(20) DEFAULT 'Draft',
  terms_conditions TEXT,
  preface TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE boq_headers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "boq_headers_all_access" ON boq_headers;
CREATE POLICY "boq_headers_all_access" ON boq_headers FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_boq_headers_client ON boq_headers(client_id);
CREATE INDEX IF NOT EXISTS idx_boq_headers_project ON boq_headers(project_id);

-- ============================================
-- BOQ SHEETS TABLE (Multi-sheet support)
-- ============================================
CREATE TABLE IF NOT EXISTS boq_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boq_header_id UUID REFERENCES boq_headers(id) ON DELETE CASCADE,
  sheet_name VARCHAR(100) NOT NULL,
  sheet_order INTEGER DEFAULT 1,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE boq_sheets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "boq_sheets_all_access" ON boq_sheets;
CREATE POLICY "boq_sheets_all_access" ON boq_sheets FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_boq_sheets_header ON boq_sheets(boq_header_id);

-- ============================================
-- BOQ ITEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS boq_items ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boq_sheet_id UUID REFERENCES boq_sheets(id) ON DELETE CASCADE,
  row_order INTEGER NOT NULL,
  is_header_row BOOLEAN DEFAULT false,
  header_text VARCHAR(255),
  item_id UUID REFERENCES materials(id),
  variant_id UUID REFERENCES company_variants(id),
  make VARCHAR(100),
  quantity DECIMAL(12,3) DEFAULT 0,
  rate DECIMAL(12,2) DEFAULT 0,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  specification TEXT,
  remarks TEXT,
  pressure VARCHAR(50),
  thickness VARCHAR(50),
  schedule VARCHAR(50),
  material VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE boq_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "boq_items_all_access" ON boq_items;
CREATE POLICY "boq_items_all_access" ON boq_items FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_boq_items_sheet ON boq_items(boq_sheet_id);
CREATE INDEX IF NOT EXISTS idx_boq_items_item ON boq_items(item_id);
CREATE INDEX IF NOT EXISTS idx_boq_items_variant ON boq_items(variant_id);

-- ============================================
-- BOQ VARIANT DISCOUNTS TABLE
-- Stores per-BOQ variant discount overrides
-- ============================================
CREATE TABLE IF NOT EXISTS boq_variant_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boq_header_id UUID REFERENCES boq_headers(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES company_variants(id),
  discount_percent DECIMAL(5,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(boq_header_id, variant_id)
);

ALTER TABLE boq_variant_discounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "boq_variant_discounts_all_access" ON boq_variant_discounts;
CREATE POLICY "boq_variant_discounts_all_access" ON boq_variant_discounts FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- BOQ COLUMN VISIBILITY SETTINGS
-- ============================================
CREATE TABLE IF NOT EXISTS boq_column_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boq_header_id UUID REFERENCES boq_headers(id) ON DELETE CASCADE,
  column_name VARCHAR(50) NOT NULL,
  is_visible BOOLEAN DEFAULT true,
  column_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(boq_header_id, column_name)
);

ALTER TABLE boq_column_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "boq_column_settings_all_access" ON boq_column_settings;
CREATE POLICY "boq_column_settings_all_access" ON boq_column_settings FOR ALL USING (true) WITH CHECK (true);

-- Default column settings
INSERT INTO boq_column_settings (column_name, is_visible, column_order) VALUES
  ('variant', true, 1),
  ('make', true, 2),
  ('quantity', true, 3),
  ('rate', true, 4),
  ('discount_percent', true, 5),
  ('specification', true, 6),
  ('remarks', true, 7),
  ('pressure', false, 8),
  ('thickness', false, 9),
  ('schedule', false, 10),
  ('material', false, 11)
ON CONFLICT DO NOTHING;

-- ============================================
-- BOQ NUMBER GENERATION FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION generate_boq_number()
RETURNS VARCHAR AS $$
DECLARE
  v_boq_no VARCHAR;
  v_next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(boq_no FROM '[0-9]+') AS INTEGER)), 0) + 1
  INTO v_next_num
  FROM boq_headers;

  v_boq_no := 'BOQ-' || LPAD(v_next_num::TEXT, 4, '0');
  RETURN v_boq_no;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PRICE LOOKUP FUNCTION
-- Priority: Item + Variant + Make > Item + Variant > Item Base Price
-- ============================================
CREATE OR REPLACE FUNCTION get_boq_price(
  p_item_id UUID,
  p_variant_id UUID DEFAULT NULL,
  p_make VARCHAR DEFAULT NULL
)
RETURNS DECIMAL(12,2) AS $$
DECLARE
  v_price DECIMAL(12,2);
BEGIN
  -- 1. Try: Item + Variant + Make
  IF p_variant_id IS NOT NULL AND p_make IS NOT NULL AND p_make <> '' THEN
    SELECT sale_price INTO v_price
    FROM item_variant_pricing
    WHERE item_id = p_item_id 
      AND company_variant_id = p_variant_id 
      AND make = p_make 
      AND is_active = true
    LIMIT 1;
  END IF;

  -- 2. Try: Item + Variant (any make or no make)
  IF v_price IS NULL AND p_variant_id IS NOT NULL THEN
    SELECT sale_price INTO v_price
    FROM item_variant_pricing
    WHERE item_id = p_item_id 
      AND company_variant_id = p_variant_id 
      AND (make IS NULL OR make = '')
      AND is_active = true
    LIMIT 1;
  END IF;

  -- 3. Fallback: Item Base Price
  IF v_price IS NULL THEN
    SELECT sale_price INTO v_price
    FROM materials
    WHERE id = p_item_id;
  END IF;

  RETURN COALESCE(v_price, 0);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- REVISION NUMBER UPDATE TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_boq_revision()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD IS NOT NULL AND (
    NEW.boq_no != OLD.boq_no OR
    NEW.client_id != OLD.client_id OR
    NEW.project_id != OLD.project_id
  ) THEN
    NEW.revision_no := OLD.revision_no + 1;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_boq_revision ON boq_headers;

CREATE TRIGGER trg_boq_revision
  BEFORE UPDATE ON boq_headers
  FOR EACH ROW
  EXECUTE FUNCTION update_boq_revision();
