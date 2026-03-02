-- STEP 1: Item Master Foundation - Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- COMPANY VARIANTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS company_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES organisations(id),
  variant_name VARCHAR(100) NOT NULL,
  description VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE company_variants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON company_variants;
CREATE POLICY "company_variants_all_access" ON company_variants FOR ALL USING (true) WITH CHECK (true);

-- Insert default variants if table is empty
INSERT INTO company_variants (variant_name, is_active) 
SELECT 'Retail', true
WHERE NOT EXISTS (SELECT 1 FROM company_variants WHERE variant_name = 'Retail');

INSERT INTO company_variants (variant_name, is_active) 
SELECT 'Wholesale', true
WHERE NOT EXISTS (SELECT 1 FROM company_variants WHERE variant_name = 'Wholesale');

INSERT INTO company_variants (variant_name, is_active) 
SELECT 'Special', true
WHERE NOT EXISTS (SELECT 1 FROM company_variants WHERE variant_name = 'Special');

-- ============================================
-- ITEM VARIANT PRICING TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS item_variant_pricing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID REFERENCES materials(id) ON DELETE CASCADE,
  company_variant_id UUID REFERENCES company_variants(id),
  sale_price DECIMAL(12,2),
  purchase_price DECIMAL(12,2),
  tax_rate DECIMAL(5,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(item_id, company_variant_id)
);

ALTER TABLE item_variant_pricing ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON item_variant_pricing;
CREATE POLICY "item_variant_pricing_all_access" ON item_variant_pricing FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- MATERIALS/ITEMS TABLE ENHANCEMENTS
-- ============================================
ALTER TABLE materials ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES organisations(id);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS item_code VARCHAR(50);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS display_name VARCHAR(255);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS uses_variant BOOLEAN DEFAULT false;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS sale_price DECIMAL(12,2);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5,2);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_materials_company ON materials(company_id);
CREATE INDEX IF NOT EXISTS idx_materials_item_code ON materials(item_code);
CREATE INDEX IF NOT EXISTS idx_materials_display_name ON materials(display_name);
CREATE INDEX IF NOT EXISTS idx_materials_uses_variant ON materials(uses_variant);
CREATE INDEX IF NOT EXISTS idx_materials_is_active ON materials(is_active);

-- ============================================
-- ITEM STOCK TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS item_stock (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID REFERENCES materials(id) ON DELETE CASCADE,
  company_variant_id UUID REFERENCES company_variants(id),
  warehouse_id UUID,
  current_stock DECIMAL(12,3) DEFAULT 0,
  low_stock_level DECIMAL(12,3),
  reorder_level DECIMAL(12,3),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE item_stock ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON item_stock;
CREATE POLICY "item_stock_all_access" ON item_stock FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_item_stock_item ON item_stock(item_id);
CREATE INDEX IF NOT EXISTS idx_item_stock_variant ON item_stock(company_variant_id);

-- ============================================
-- ITEM CATEGORIES
-- ============================================
CREATE TABLE IF NOT EXISTS item_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE item_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON item_categories;
CREATE POLICY "item_categories_all_access" ON item_categories FOR ALL USING (true) WITH CHECK (true);

INSERT INTO item_categories (category_name) VALUES 
  ('VALVE'), ('PIPE'), ('FITTING'), ('FLANGE'), ('ELECTRICAL'), ('PLUMBING'), ('HVAC'), ('FIRE PROTECTION'), ('BUILDING MATERIALS'), ('TOOLS'), ('SAFETY'), ('OFFICE'), ('OTHER')
ON CONFLICT (category_name) DO NOTHING;

-- ============================================
-- ITEM UNITS
-- ============================================
CREATE TABLE IF NOT EXISTS item_units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unit_name VARCHAR(50) NOT NULL UNIQUE,
  unit_code VARCHAR(20) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE item_units ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON item_units;
CREATE POLICY "item_units_all_access" ON item_units FOR ALL USING (true) WITH CHECK (true);

INSERT INTO item_units (unit_name, unit_code) VALUES 
  ('Numbers', 'nos'), ('Kilogram', 'kg'), ('Meter', 'mtr'), ('Square Meter', 'sqm'), ('Square Feet', 'sqft'), 
  ('Cubic Feet', 'cuft'), ('Liter', 'ltr'), ('Bags', 'bags'), ('Box', 'box'), ('Pair', 'pair'), ('Set', 'set'), ('Pack', 'pack')
ON CONFLICT (unit_code) DO NOTHING;

-- ============================================
-- WAREHOUSES
-- ============================================
CREATE TABLE IF NOT EXISTS warehouses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse_code VARCHAR(50) UNIQUE,
  warehouse_name VARCHAR(255) NOT NULL,
  location TEXT,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON warehouses;
CREATE POLICY "warehouses_all_access" ON warehouses FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- SERVICES
-- ============================================
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES organisations(id),
  service_code VARCHAR(50) UNIQUE,
  service_name VARCHAR(255) NOT NULL,
  description TEXT,
  unit VARCHAR(50) DEFAULT 'nos',
  sale_price DECIMAL(12,2),
  purchase_price DECIMAL(12,2),
  tax_rate DECIMAL(5,2),
  hsn_code VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON services;
CREATE POLICY "services_all_access" ON services FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- ORGANISATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS organisations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(255),
  gstin VARCHAR(50),
  pan VARCHAR(50),
  tan VARCHAR(50),
  msme_no VARCHAR(100),
  website VARCHAR(255),
  state VARCHAR(100) DEFAULT 'Maharashtra',
  signatures JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON organisations;
CREATE POLICY "organisations_all_access" ON organisations FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- ORG MEMBERS
-- ============================================
CREATE TABLE IF NOT EXISTS org_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'member',
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON org_members;
CREATE POLICY "org_members_all_access" ON org_members FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- FUNCTION: Get Item Price (with variant support)
-- ============================================
CREATE OR REPLACE FUNCTION get_item_price(
  p_item_id UUID,
  p_variant_id UUID DEFAULT NULL,
  p_price_type VARCHAR DEFAULT 'sale'
)
RETURNS DECIMAL(12,2) AS $$
DECLARE
  v_price DECIMAL(12,2);
  v_uses_variant BOOLEAN;
BEGIN
  SELECT uses_variant INTO v_uses_variant FROM materials WHERE id = p_item_id;

  IF p_variant_id IS NOT NULL AND v_uses_variant = true THEN
    IF p_price_type = 'sale' THEN
      SELECT sale_price INTO v_price FROM item_variant_pricing
      WHERE item_id = p_item_id AND company_variant_id = p_variant_id AND is_active = true;
    ELSE
      SELECT purchase_price INTO v_price FROM item_variant_pricing
      WHERE item_id = p_item_id AND company_variant_id = p_variant_id AND is_active = true;
    END IF;
  END IF;

  IF v_price IS NULL THEN
    IF p_price_type = 'sale' THEN
      SELECT sale_price INTO v_price FROM materials WHERE id = p_item_id;
    ELSE
      SELECT purchase_price INTO v_price FROM materials WHERE id = p_item_id;
    END IF;
  END IF;

  RETURN COALESCE(v_price, 0);
END;
$$ LANGUAGE plpgsql;
