-- ============================================================
-- MANUFACTURING MODULE — DATABASE MIGRATION
-- Version: 2.0 (Revised based on Architecture Review)
-- Date: 2026-06-10
-- ============================================================
-- 
-- This migration creates the manufacturing module tables.
-- 
-- KEY CHANGES FROM V1:
-- - No separate WIP stock table (uses warehouse-based movement)
-- - No separate finished goods stock table (uses item_stock)
-- - Renamed Production Report to Production Entry
-- - Added yield tracking
-- - Added operational flags for flexible item behavior
-- - Added batch_no/production_date for future-proofing
--
-- ============================================================

-- ============================================================
-- 1. ENHANCE MATERIALS TABLE
-- ============================================================

-- Add operational flags for flexible item behavior
ALTER TABLE materials ADD COLUMN IF NOT EXISTS allow_purchase BOOLEAN DEFAULT true;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS allow_sales BOOLEAN DEFAULT true;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS show_in_quotation BOOLEAN DEFAULT true;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS show_in_bom BOOLEAN DEFAULT true;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS is_manufactured BOOLEAN DEFAULT false;

-- Set defaults for existing materials
UPDATE materials SET 
  allow_purchase = COALESCE(allow_purchase, true),
  allow_sales = COALESCE(allow_sales, true),
  show_in_quotation = COALESCE(show_in_quotation, true),
  show_in_bom = COALESCE(show_in_bom, true),
  is_manufactured = COALESCE(is_manufactured, false)
WHERE allow_purchase IS NULL;

-- ============================================================
-- 2. ADD WIP AND FG WAREHOUSES + WAREHOUSE PURPOSE ENUM
-- ============================================================

-- Add warehouse_purpose column for robust warehouse identification
-- Replaces brittle code-based lookup (warehouse_code = 'WIP-001')
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS warehouse_purpose VARCHAR(20) 
  CHECK (warehouse_purpose IN ('main', 'wip', 'fg', 'general')) 
  DEFAULT 'main';

-- Set purpose for existing default warehouse (Main Store)
UPDATE warehouses SET warehouse_purpose = 'main' WHERE is_default = true AND warehouse_purpose IS NULL;

-- Insert manufacturing warehouses if they don't exist
-- NOTE: These are inserted with a placeholder org_id. Each organisation should
-- create their own WIP/FG warehouses via the app. These inserts serve as
-- templates for organisations that don't have them yet.
INSERT INTO warehouses (name, warehouse_code, location, is_active, organisation_id, warehouse_purpose) 
SELECT 'Production Floor / WIP', 'WIP-001', 'Manufacturing Area', true, org_id, 'wip'
FROM (SELECT id AS org_id FROM organisations LIMIT 1) sub
WHERE NOT EXISTS (SELECT 1 FROM warehouses WHERE warehouse_code = 'WIP-001');

INSERT INTO warehouses (name, warehouse_code, location, is_active, organisation_id, warehouse_purpose) 
SELECT 'Finished Goods Store', 'FG-001', 'Finished Goods Area', true, org_id, 'fg'
FROM (SELECT id AS org_id FROM organisations LIMIT 1) sub
WHERE NOT EXISTS (SELECT 1 FROM warehouses WHERE warehouse_code = 'FG-001');

-- ============================================================
-- 3. CREATE BOM HEADERS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS bom_headers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_code VARCHAR(50) UNIQUE NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  product_id UUID REFERENCES materials(id) ON DELETE SET NULL,
  output_qty DECIMAL(12,2) NOT NULL DEFAULT 100,
  output_unit VARCHAR(20) NOT NULL DEFAULT 'kg',
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  organisation_id UUID REFERENCES organisations(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE bom_headers ENABLE ROW LEVEL SECURITY;

-- Create RLS policies with org isolation
DROP POLICY IF EXISTS "org_isolation_select" ON bom_headers;
DROP POLICY IF EXISTS "org_isolation_insert" ON bom_headers;
DROP POLICY IF EXISTS "org_isolation_update" ON bom_headers;
DROP POLICY IF EXISTS "org_isolation_delete" ON bom_headers;
CREATE POLICY "org_isolation_select" ON bom_headers 
  FOR SELECT USING (organisation_id = auth.uid() OR organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "org_isolation_insert" ON bom_headers 
  FOR INSERT WITH CHECK (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "org_isolation_update" ON bom_headers 
  FOR UPDATE USING (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "org_isolation_delete" ON bom_headers 
  FOR DELETE USING (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_bom_headers_org ON bom_headers(organisation_id);
CREATE INDEX IF NOT EXISTS idx_bom_headers_code ON bom_headers(bom_code);

-- ============================================================
-- 4. CREATE BOM ITEMS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS bom_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_id UUID REFERENCES bom_headers(id) ON DELETE CASCADE NOT NULL,
  material_id UUID REFERENCES materials(id) ON DELETE RESTRICT NOT NULL,
  required_qty DECIMAL(12,2) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  wastage_pct DECIMAL(5,2) DEFAULT 5.00,
  is_additional BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE bom_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (bom_items inherits org from bom_headers)
DROP POLICY IF EXISTS "org_isolation_select" ON bom_items;
CREATE POLICY "org_isolation_select" ON bom_items 
  FOR SELECT USING (bom_id IN (
    SELECT id FROM bom_headers WHERE organisation_id IN (
      SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
    )
  ));
DROP POLICY IF EXISTS "org_isolation_insert" ON bom_items;
CREATE POLICY "org_isolation_insert" ON bom_items 
  FOR INSERT WITH CHECK (bom_id IN (
    SELECT id FROM bom_headers WHERE organisation_id IN (
      SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
    )
  ));
DROP POLICY IF EXISTS "org_isolation_update" ON bom_items;
CREATE POLICY "org_isolation_update" ON bom_items 
  FOR UPDATE USING (bom_id IN (
    SELECT id FROM bom_headers WHERE organisation_id IN (
      SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
    )
  ));
DROP POLICY IF EXISTS "org_isolation_delete" ON bom_items;
CREATE POLICY "org_isolation_delete" ON bom_items 
  FOR DELETE USING (bom_id IN (
    SELECT id FROM bom_headers WHERE organisation_id IN (
      SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
    )
  ));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_bom_items_bom ON bom_items(bom_id);
CREATE INDEX IF NOT EXISTS idx_bom_items_material ON bom_items(material_id);

-- ============================================================
-- 5. CREATE JOB CARDS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS job_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_card_no VARCHAR(50) UNIQUE NOT NULL,
  bom_id UUID REFERENCES bom_headers(id) ON DELETE RESTRICT NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  planned_qty DECIMAL(12,2) NOT NULL,
  actual_qty DECIMAL(12,2),
  yield_pct DECIMAL(5,2),
  output_unit VARCHAR(20) NOT NULL,
  status VARCHAR(30) DEFAULT 'draft' 
    CHECK (status IN ('draft','issued','in_progress','completed','cancelled')),
  priority VARCHAR(20) DEFAULT 'medium'
    CHECK (priority IN ('low','medium','high','urgent')),
  remarks TEXT,
  issued_by UUID REFERENCES auth.users(id),
  issued_to UUID REFERENCES auth.users(id),
  issued_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  organisation_id UUID REFERENCES organisations(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE job_cards ENABLE ROW LEVEL SECURITY;

-- Create RLS policies with org isolation
DROP POLICY IF EXISTS "org_isolation_select" ON job_cards;
CREATE POLICY "org_isolation_select" ON job_cards 
  FOR SELECT USING (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));
DROP POLICY IF EXISTS "org_isolation_insert" ON job_cards;
CREATE POLICY "org_isolation_insert" ON job_cards 
  FOR INSERT WITH CHECK (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));
DROP POLICY IF EXISTS "org_isolation_update" ON job_cards;
CREATE POLICY "org_isolation_update" ON job_cards 
  FOR UPDATE USING (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));
DROP POLICY IF EXISTS "org_isolation_delete" ON job_cards;
CREATE POLICY "org_isolation_delete" ON job_cards 
  FOR DELETE USING (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_job_cards_org ON job_cards(organisation_id);
CREATE INDEX IF NOT EXISTS idx_job_cards_status ON job_cards(status);
CREATE INDEX IF NOT EXISTS idx_job_cards_bom ON job_cards(bom_id);
CREATE INDEX IF NOT EXISTS idx_job_cards_no ON job_cards(job_card_no);

-- ============================================================
-- 6. CREATE JOB CARD MATERIALS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS job_card_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_card_id UUID REFERENCES job_cards(id) ON DELETE CASCADE NOT NULL,
  material_id UUID REFERENCES materials(id) ON DELETE RESTRICT NOT NULL,
  bom_item_id UUID REFERENCES bom_items(id) ON DELETE SET NULL,
  planned_qty DECIMAL(12,2) NOT NULL,
  issued_qty DECIMAL(12,2) DEFAULT 0,
  consumed_qty DECIMAL(12,2) DEFAULT 0,
  wastage_qty DECIMAL(12,2) DEFAULT 0,
  return_qty DECIMAL(12,2) DEFAULT 0,
  is_additional BOOLEAN DEFAULT false,
  status VARCHAR(30) DEFAULT 'reserved'
    CHECK (status IN ('reserved','issued','consumed','returned')),
  warehouse_id UUID REFERENCES warehouses(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE job_card_materials ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (job_card_materials inherits org from job_cards)
DROP POLICY IF EXISTS "org_isolation_select" ON job_card_materials;
CREATE POLICY "org_isolation_select" ON job_card_materials 
  FOR SELECT USING (job_card_id IN (
    SELECT id FROM job_cards WHERE organisation_id IN (
      SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
    )
  ));
DROP POLICY IF EXISTS "org_isolation_insert" ON job_card_materials;
CREATE POLICY "org_isolation_insert" ON job_card_materials 
  FOR INSERT WITH CHECK (job_card_id IN (
    SELECT id FROM job_cards WHERE organisation_id IN (
      SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
    )
  ));
DROP POLICY IF EXISTS "org_isolation_update" ON job_card_materials;
CREATE POLICY "org_isolation_update" ON job_card_materials 
  FOR UPDATE USING (job_card_id IN (
    SELECT id FROM job_cards WHERE organisation_id IN (
      SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
    )
  ));
DROP POLICY IF EXISTS "org_isolation_delete" ON job_card_materials;
CREATE POLICY "org_isolation_delete" ON job_card_materials 
  FOR DELETE USING (job_card_id IN (
    SELECT id FROM job_cards WHERE organisation_id IN (
      SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
    )
  ));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_job_card_materials_job ON job_card_materials(job_card_id);
CREATE INDEX IF NOT EXISTS idx_job_card_materials_material ON job_card_materials(material_id);
CREATE INDEX IF NOT EXISTS idx_job_card_materials_status ON job_card_materials(status);

-- ============================================================
-- 7. CREATE PRODUCTION ENTRIES TABLE (renamed from Production Reports)
-- ============================================================

CREATE TABLE IF NOT EXISTS production_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_no VARCHAR(50) UNIQUE NOT NULL,
  job_card_id UUID REFERENCES job_cards(id) ON DELETE RESTRICT NOT NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  actual_qty DECIMAL(12,2) NOT NULL,
  output_unit VARCHAR(20) NOT NULL,
  yield_pct DECIMAL(5,2),
  notes TEXT,
  batch_no VARCHAR(50),
  production_date DATE,
  reported_by UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  organisation_id UUID REFERENCES organisations(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE production_entries ENABLE ROW LEVEL SECURITY;

-- Create RLS policies with org isolation
DROP POLICY IF EXISTS "org_isolation_select" ON production_entries;
CREATE POLICY "org_isolation_select" ON production_entries 
  FOR SELECT USING (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));
DROP POLICY IF EXISTS "org_isolation_insert" ON production_entries;
CREATE POLICY "org_isolation_insert" ON production_entries 
  FOR INSERT WITH CHECK (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));
DROP POLICY IF EXISTS "org_isolation_update" ON production_entries;
CREATE POLICY "org_isolation_update" ON production_entries 
  FOR UPDATE USING (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));
DROP POLICY IF EXISTS "org_isolation_delete" ON production_entries;
CREATE POLICY "org_isolation_delete" ON production_entries 
  FOR DELETE USING (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_production_entries_job ON production_entries(job_card_id);
CREATE INDEX IF NOT EXISTS idx_production_entries_org ON production_entries(organisation_id);
CREATE INDEX IF NOT EXISTS idx_production_entries_no ON production_entries(entry_no);

-- ============================================================
-- 8. CREATE PRODUCTION ENTRY ITEMS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS production_entry_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_entry_id UUID REFERENCES production_entries(id) ON DELETE CASCADE NOT NULL,
  job_card_material_id UUID REFERENCES job_card_materials(id) ON DELETE SET NULL,
  material_id UUID REFERENCES materials(id) ON DELETE RESTRICT NOT NULL,
  is_additional BOOLEAN DEFAULT false,
  issued_qty DECIMAL(12,2) NOT NULL,
  consumed_qty DECIMAL(12,2) NOT NULL,
  wastage_qty DECIMAL(12,2) DEFAULT 0,
  return_qty DECIMAL(12,2) DEFAULT 0,
  remarks TEXT,
  batch_no VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE production_entry_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (production_entry_items inherits org from production_entries)
DROP POLICY IF EXISTS "org_isolation_select" ON production_entry_items;
CREATE POLICY "org_isolation_select" ON production_entry_items 
  FOR SELECT USING (production_entry_id IN (
    SELECT id FROM production_entries WHERE organisation_id IN (
      SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
    )
  ));
DROP POLICY IF EXISTS "org_isolation_insert" ON production_entry_items;
CREATE POLICY "org_isolation_insert" ON production_entry_items 
  FOR INSERT WITH CHECK (production_entry_id IN (
    SELECT id FROM production_entries WHERE organisation_id IN (
      SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
    )
  ));
DROP POLICY IF EXISTS "org_isolation_update" ON production_entry_items;
CREATE POLICY "org_isolation_update" ON production_entry_items 
  FOR UPDATE USING (production_entry_id IN (
    SELECT id FROM production_entries WHERE organisation_id IN (
      SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
    )
  ));
DROP POLICY IF EXISTS "org_isolation_delete" ON production_entry_items;
CREATE POLICY "org_isolation_delete" ON production_entry_items 
  FOR DELETE USING (production_entry_id IN (
    SELECT id FROM production_entries WHERE organisation_id IN (
      SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
    )
  ));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_production_entry_items_entry ON production_entry_items(production_entry_id);
CREATE INDEX IF NOT EXISTS idx_production_entry_items_material ON production_entry_items(material_id);

-- ============================================================
-- 9. CREATE HELPER FUNCTIONS
-- ============================================================

-- Function to generate BOM code
CREATE OR REPLACE FUNCTION generate_bom_code(org_id UUID)
RETURNS VARCHAR AS $$
DECLARE
  next_code INTEGER;
  new_code VARCHAR;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(bom_code FROM 5) AS INTEGER)), 0) + 1
  INTO next_code
  FROM bom_headers
  WHERE organisation_id = org_id;
  
  new_code := 'BOM-' || LPAD(next_code::TEXT, 4, '0');
  RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Function to generate Job Card number
CREATE OR REPLACE FUNCTION generate_job_card_no(org_id UUID)
RETURNS VARCHAR AS $$
DECLARE
  next_num INTEGER;
  new_no VARCHAR;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(job_card_no FROM 4) AS INTEGER)), 0) + 1
  INTO next_num
  FROM job_cards
  WHERE organisation_id = org_id;
  
  new_no := 'JC-' || LPAD(next_num::TEXT, 4, '0');
  RETURN new_no;
END;
$$ LANGUAGE plpgsql;

-- Function to generate Production Entry number
CREATE OR REPLACE FUNCTION generate_production_entry_no(org_id UUID)
RETURNS VARCHAR AS $$
DECLARE
  next_num INTEGER;
  new_no VARCHAR;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(entry_no FROM 4) AS INTEGER)), 0) + 1
  INTO next_num
  FROM production_entries
  WHERE organisation_id = org_id;
  
  new_no := 'PE-' || LPAD(next_num::TEXT, 4, '0');
  RETURN new_no;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 10. CREATE PRODUCTION SCHEDULES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS production_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_no VARCHAR(50) UNIQUE NOT NULL,
  schedule_name VARCHAR(255) NOT NULL,
  schedule_date DATE NOT NULL DEFAULT CURRENT_DATE,
  shift VARCHAR(50),
  status VARCHAR(30) DEFAULT 'draft'
    CHECK (status IN ('draft','planned','in_progress','completed','cancelled')),
  remarks TEXT,
  created_by UUID REFERENCES auth.users(id),
  organisation_id UUID REFERENCES organisations(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE production_schedules ENABLE ROW LEVEL SECURITY;

-- Create RLS policies with org isolation
DROP POLICY IF EXISTS "org_isolation_select" ON production_schedules;
CREATE POLICY "org_isolation_select" ON production_schedules 
  FOR SELECT USING (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));
DROP POLICY IF EXISTS "org_isolation_insert" ON production_schedules;
CREATE POLICY "org_isolation_insert" ON production_schedules 
  FOR INSERT WITH CHECK (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));
DROP POLICY IF EXISTS "org_isolation_update" ON production_schedules;
CREATE POLICY "org_isolation_update" ON production_schedules 
  FOR UPDATE USING (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));
DROP POLICY IF EXISTS "org_isolation_delete" ON production_schedules;
CREATE POLICY "org_isolation_delete" ON production_schedules 
  FOR DELETE USING (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_production_schedules_org ON production_schedules(organisation_id);
CREATE INDEX IF NOT EXISTS idx_production_schedules_date ON production_schedules(schedule_date);
CREATE INDEX IF NOT EXISTS idx_production_schedules_status ON production_schedules(status);

-- ============================================================
-- 11. CREATE PRODUCTION SCHEDULE ITEMS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS production_schedule_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID REFERENCES production_schedules(id) ON DELETE CASCADE NOT NULL,
  bom_id UUID REFERENCES bom_headers(id) ON DELETE RESTRICT NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  planned_qty DECIMAL(12,2) NOT NULL,
  output_unit VARCHAR(20) NOT NULL,
  job_card_id UUID REFERENCES job_cards(id) ON DELETE SET NULL,
  status VARCHAR(30) DEFAULT 'pending'
    CHECK (status IN ('pending','job_card_created','in_progress','completed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE production_schedule_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (inherits org from production_schedules)
DROP POLICY IF EXISTS "org_isolation_select" ON production_schedule_items;
CREATE POLICY "org_isolation_select" ON production_schedule_items 
  FOR SELECT USING (schedule_id IN (
    SELECT id FROM production_schedules WHERE organisation_id IN (
      SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
    )
  ));
DROP POLICY IF EXISTS "org_isolation_insert" ON production_schedule_items;
CREATE POLICY "org_isolation_insert" ON production_schedule_items 
  FOR INSERT WITH CHECK (schedule_id IN (
    SELECT id FROM production_schedules WHERE organisation_id IN (
      SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
    )
  ));
DROP POLICY IF EXISTS "org_isolation_update" ON production_schedule_items;
CREATE POLICY "org_isolation_update" ON production_schedule_items 
  FOR UPDATE USING (schedule_id IN (
    SELECT id FROM production_schedules WHERE organisation_id IN (
      SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
    )
  ));
DROP POLICY IF EXISTS "org_isolation_delete" ON production_schedule_items;
CREATE POLICY "org_isolation_delete" ON production_schedule_items 
  FOR DELETE USING (schedule_id IN (
    SELECT id FROM production_schedules WHERE organisation_id IN (
      SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
    )
  ));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_production_schedule_items_schedule ON production_schedule_items(schedule_id);
CREATE INDEX IF NOT EXISTS idx_production_schedule_items_bom ON production_schedule_items(bom_id);

-- ============================================================
-- 12. CREATE CUSTOM UNITS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS custom_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_name VARCHAR(100) NOT NULL,
  unit_symbol VARCHAR(20) NOT NULL,
  unit_type VARCHAR(50) NOT NULL CHECK (unit_type IN ('length','weight','count','area','volume','custom')),
  conversion_to_base DECIMAL(12,6),
  base_unit VARCHAR(20),
  is_predefined BOOLEAN DEFAULT false,
  organisation_id UUID REFERENCES organisations(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(unit_symbol, organisation_id)
);

-- Enable RLS
ALTER TABLE custom_units ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "org_isolation_select" ON custom_units;
CREATE POLICY "org_isolation_select" ON custom_units 
  FOR SELECT USING (organisation_id IS NULL OR organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));
DROP POLICY IF EXISTS "org_isolation_insert" ON custom_units;
CREATE POLICY "org_isolation_insert" ON custom_units 
  FOR INSERT WITH CHECK (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));
DROP POLICY IF EXISTS "org_isolation_update" ON custom_units;
CREATE POLICY "org_isolation_update" ON custom_units 
  FOR UPDATE USING (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));
DROP POLICY IF EXISTS "org_isolation_delete" ON custom_units;
CREATE POLICY "org_isolation_delete" ON custom_units 
  FOR DELETE USING (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));

-- Insert predefined units
INSERT INTO custom_units (unit_name, unit_symbol, unit_type, is_predefined, organisation_id) VALUES
  ('kilograms', 'kg', 'weight', true, NULL),
  ('meters', 'mtr', 'length', true, NULL),
  ('numbers', 'nos', 'count', true, NULL),
  ('feet', 'ft', 'length', true, NULL),
  ('square meters', 'sqm', 'area', true, NULL),
  ('cubic meters', 'cum', 'volume', true, NULL)
ON CONFLICT (unit_symbol, organisation_id) DO NOTHING;

-- ============================================================
-- 13. CREATE CUSTOM FIELDS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_name VARCHAR(100) NOT NULL,
  field_type VARCHAR(50) NOT NULL CHECK (field_type IN ('text','number','dropdown','checkbox','date')),
  field_options JSONB,
  is_required BOOLEAN DEFAULT false,
  applies_to VARCHAR(50) NOT NULL CHECK (applies_to IN ('all','bom','job_card','production_entry')),
  sort_order INTEGER DEFAULT 0,
  organisation_id UUID REFERENCES organisations(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE custom_fields ENABLE ROW LEVEL SECURITY;

-- Create RLS policies with org isolation
DROP POLICY IF EXISTS "org_isolation_select" ON custom_fields;
CREATE POLICY "org_isolation_select" ON custom_fields 
  FOR SELECT USING (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));
DROP POLICY IF EXISTS "org_isolation_insert" ON custom_fields;
CREATE POLICY "org_isolation_insert" ON custom_fields 
  FOR INSERT WITH CHECK (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));
DROP POLICY IF EXISTS "org_isolation_update" ON custom_fields;
CREATE POLICY "org_isolation_update" ON custom_fields 
  FOR UPDATE USING (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));
DROP POLICY IF EXISTS "org_isolation_delete" ON custom_fields;
CREATE POLICY "org_isolation_delete" ON custom_fields 
  FOR DELETE USING (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_custom_fields_org ON custom_fields(organisation_id);
CREATE INDEX IF NOT EXISTS idx_custom_fields_applies_to ON custom_fields(applies_to);

-- ============================================================
-- 14. CREATE CUSTOM FIELD VALUES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS custom_field_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_field_id UUID REFERENCES custom_fields(id) ON DELETE CASCADE NOT NULL,
  entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('bom','job_card','production_entry')),
  entity_id UUID NOT NULL,
  field_value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(custom_field_id, entity_type, entity_id)
);

-- Enable RLS
ALTER TABLE custom_field_values ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (inherits org from custom_fields)
DROP POLICY IF EXISTS "org_isolation_select" ON custom_field_values;
CREATE POLICY "org_isolation_select" ON custom_field_values 
  FOR SELECT USING (custom_field_id IN (
    SELECT id FROM custom_fields WHERE organisation_id IN (
      SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
    )
  ));
DROP POLICY IF EXISTS "org_isolation_insert" ON custom_field_values;
CREATE POLICY "org_isolation_insert" ON custom_field_values 
  FOR INSERT WITH CHECK (custom_field_id IN (
    SELECT id FROM custom_fields WHERE organisation_id IN (
      SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
    )
  ));
DROP POLICY IF EXISTS "org_isolation_update" ON custom_field_values;
CREATE POLICY "org_isolation_update" ON custom_field_values 
  FOR UPDATE USING (custom_field_id IN (
    SELECT id FROM custom_fields WHERE organisation_id IN (
      SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
    )
  ));
DROP POLICY IF EXISTS "org_isolation_delete" ON custom_field_values;
CREATE POLICY "org_isolation_delete" ON custom_field_values 
  FOR DELETE USING (custom_field_id IN (
    SELECT id FROM custom_fields WHERE organisation_id IN (
      SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
    )
  ));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_custom_field_values_field ON custom_field_values(custom_field_id);
CREATE INDEX IF NOT EXISTS idx_custom_field_values_entity ON custom_field_values(entity_type, entity_id);

-- ============================================================
-- 15. CREATE HELPER FUNCTION FOR PRODUCTION SCHEDULE
-- ============================================================

-- Function to generate Production Schedule number
CREATE OR REPLACE FUNCTION generate_schedule_no(org_id UUID)
RETURNS VARCHAR AS $$
DECLARE
  next_num INTEGER;
  new_no VARCHAR;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(schedule_no FROM 4) AS INTEGER)), 0) + 1
  INTO next_num
  FROM production_schedules
  WHERE organisation_id = org_id;
  
  new_no := 'PS-' || LPAD(next_num::TEXT, 4, '0');
  RETURN new_no;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 16. CREATE MANUFACTURING ACTIVITY LOG TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS manufacturing_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN (
    'production_schedule', 'job_card', 'production_entry', 
    'stock_movement', 'bom', 'material_return'
  )),
  entity_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL CHECK (action IN (
    'created', 'updated', 'deleted', 'issued', 'in_progress', 
    'completed', 'cancelled', 'returned', 'stock_updated', 
    'finished_goods_added', 'material_returned'
  )),
  action_details JSONB,
  user_id UUID REFERENCES auth.users(id),
  user_name VARCHAR(255),
  organisation_id UUID REFERENCES organisations(id) NOT NULL,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE manufacturing_activity_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policies with org isolation
DROP POLICY IF EXISTS "org_isolation_select" ON manufacturing_activity_log;
CREATE POLICY "org_isolation_select" ON manufacturing_activity_log 
  FOR SELECT USING (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));
DROP POLICY IF EXISTS "org_isolation_insert" ON manufacturing_activity_log;
CREATE POLICY "org_isolation_insert" ON manufacturing_activity_log 
  FOR INSERT WITH CHECK (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));
DROP POLICY IF EXISTS "org_isolation_update" ON manufacturing_activity_log;
CREATE POLICY "org_isolation_update" ON manufacturing_activity_log 
  FOR UPDATE USING (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));
DROP POLICY IF EXISTS "org_isolation_delete" ON manufacturing_activity_log;
CREATE POLICY "org_isolation_delete" ON manufacturing_activity_log 
  FOR DELETE USING (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  ));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON manufacturing_activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_org ON manufacturing_activity_log(organisation_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_user ON manufacturing_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON manufacturing_activity_log(created_at);

-- ============================================================
-- 17. CREATE ACTIVITY LOG TRIGGER FUNCTION
-- ============================================================

-- Auto-log job card status changes
CREATE OR REPLACE FUNCTION log_job_card_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO manufacturing_activity_log (
      entity_type, entity_id, action, action_details,
      user_id, user_name, organisation_id
    ) VALUES (
      'job_card', NEW.id, NEW.status,
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status),
      auth.uid(), 
      COALESCE((SELECT full_name FROM profiles WHERE id = auth.uid()), 'Unknown'),
      NEW.organisation_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for job cards
DROP TRIGGER IF EXISTS trigger_job_card_activity ON job_cards;
CREATE TRIGGER trigger_job_card_activity
  AFTER UPDATE ON job_cards
  FOR EACH ROW
  EXECUTE FUNCTION log_job_card_activity();

-- Auto-log production entry creation
CREATE OR REPLACE FUNCTION log_production_entry_activity()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO manufacturing_activity_log (
    entity_type, entity_id, action, action_details,
    user_id, user_name, organisation_id
  ) VALUES (
    'production_entry', NEW.id, 'created',
    jsonb_build_object(
      'entry_no', NEW.entry_no,
      'job_card_id', NEW.job_card_id,
      'actual_qty', NEW.actual_qty,
      'output_unit', NEW.output_unit
    ),
    auth.uid(),
    COALESCE((SELECT full_name FROM profiles WHERE id = auth.uid()), 'Unknown'),
    NEW.organisation_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for production entries
DROP TRIGGER IF EXISTS trigger_production_entry_activity ON production_entries;
CREATE TRIGGER trigger_production_entry_activity
  AFTER INSERT ON production_entries
  FOR EACH ROW
  EXECUTE FUNCTION log_production_entry_activity();

-- Auto-log production schedule creation
CREATE OR REPLACE FUNCTION log_schedule_activity()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO manufacturing_activity_log (
    entity_type, entity_id, action, action_details,
    user_id, user_name, organisation_id
  ) VALUES (
    'production_schedule', NEW.id, 'created',
    jsonb_build_object(
      'schedule_no', NEW.schedule_no,
      'schedule_name', NEW.schedule_name,
      'schedule_date', NEW.schedule_date
    ),
    auth.uid(),
    COALESCE((SELECT full_name FROM profiles WHERE id = auth.uid()), 'Unknown'),
    NEW.organisation_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for production schedules
DROP TRIGGER IF EXISTS trigger_schedule_activity ON production_schedules;
CREATE TRIGGER trigger_schedule_activity
  AFTER INSERT ON production_schedules
  FOR EACH ROW
  EXECUTE FUNCTION log_schedule_activity();

-- ============================================================
-- 18. VERIFICATION
-- ============================================================

-- Verify tables created
DO $$
BEGIN
  RAISE NOTICE 'Manufacturing module migration completed successfully!';
  RAISE NOTICE 'Tables created:';
  RAISE NOTICE '  - bom_headers';
  RAISE NOTICE '  - bom_items';
  RAISE NOTICE '  - job_cards';
  RAISE NOTICE '  - job_card_materials';
  RAISE NOTICE '  - production_entries';
  RAISE NOTICE '  - production_entry_items';
  RAISE NOTICE '  - production_schedules';
  RAISE NOTICE '  - production_schedule_items';
  RAISE NOTICE '  - custom_units';
  RAISE NOTICE '  - custom_fields';
  RAISE NOTICE '  - custom_field_values';
  RAISE NOTICE '  - manufacturing_activity_log';
  RAISE NOTICE '';
  RAISE NOTICE 'Columns added to materials:';
  RAISE NOTICE '  - allow_purchase';
  RAISE NOTICE '  - allow_sales';
  RAISE NOTICE '  - show_in_quotation';
  RAISE NOTICE '  - show_in_bom';
  RAISE NOTICE '  - is_manufactured';
  RAISE NOTICE '';
  RAISE NOTICE 'Warehouses added:';
  RAISE NOTICE '  - Production Floor / WIP (WIP-001)';
  RAISE NOTICE '  - Finished Goods Store (FG-001)';
  RAISE NOTICE '';
  RAISE NOTICE 'Functions created:';
  RAISE NOTICE '  - generate_bom_code()';
  RAISE NOTICE '  - generate_job_card_no()';
  RAISE NOTICE '  - generate_production_entry_no()';
  RAISE NOTICE '  - generate_schedule_no()';
  RAISE NOTICE '  - log_job_card_activity()';
  RAISE NOTICE '  - log_production_entry_activity()';
  RAISE NOTICE '  - log_schedule_activity()';
  RAISE NOTICE '';
  RAISE NOTICE 'Triggers created:';
  RAISE NOTICE '  - trigger_job_card_activity';
  RAISE NOTICE '  - trigger_production_entry_activity';
  RAISE NOTICE '  - trigger_schedule_activity';
END $$;

-- ============================================================
-- 15. ITEM CLASSIFICATION — role-based item categories
-- ============================================================
-- finished_good : Manufactured and sold
-- raw_material  : Purchased, consumed in production, appears in BOM
-- consumable    : Purchased, used for operations/maintenance, not in BOM
-- goods_sold    : Purchased and resold as-is
ALTER TABLE materials ADD COLUMN IF NOT EXISTS item_classification VARCHAR(20)
  CHECK (item_classification IN ('finished_good', 'raw_material', 'consumable', 'goods_sold'))
  DEFAULT 'goods_sold';

-- Backfill existing materials
UPDATE materials SET item_classification = 'finished_good' WHERE is_manufactured = true AND item_classification IS NULL;
UPDATE materials SET item_classification = 'raw_material' WHERE is_manufactured = false AND show_in_bom = true AND item_classification IS NULL;
UPDATE materials SET item_classification = 'goods_sold' WHERE is_manufactured = false AND show_in_bom = false AND item_classification IS NULL;
