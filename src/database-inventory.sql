-- Extended Material Module with Warehouse & Variants
-- Run this in Supabase SQL Editor

-- 1. Update warehouses table - add missing columns
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS warehouse_code VARCHAR(50);
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Rename name to warehouse_name if needed, or add new column
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS warehouse_name VARCHAR(255);
UPDATE warehouses SET warehouse_name = name WHERE warehouse_name IS NULL;

-- 2. Create company_variants table (if not exists)
CREATE TABLE IF NOT EXISTS company_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  variant_name VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Update materials table - remove old stock fields, add default_sale_price
ALTER TABLE materials DROP COLUMN IF EXISTS current_stock;
ALTER TABLE materials DROP COLUMN IF EXISTS low_stock_level;
ALTER TABLE materials DROP COLUMN IF EXISTS track_inventory;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS default_sale_price DECIMAL(12,2);

-- 4. Create item_variant_pricing table
CREATE TABLE IF NOT EXISTS item_variant_pricing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID REFERENCES materials(id) ON DELETE CASCADE,
  company_variant_id UUID REFERENCES company_variants(id) ON DELETE CASCADE,
  sale_price DECIMAL(12,2) NOT NULL,
  purchase_price DECIMAL(12,2),
  tax_rate DECIMAL(5,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(item_id, company_variant_id)
);

-- 5. Create item_stock table
CREATE TABLE IF NOT EXISTS item_stock (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID REFERENCES materials(id) ON DELETE CASCADE,
  company_variant_id UUID REFERENCES company_variants(id) ON DELETE CASCADE,
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
  current_stock DECIMAL(10,2) DEFAULT 0,
  low_stock_level DECIMAL(10,2) DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(item_id, company_variant_id, warehouse_id)
);

-- 6. Drop old material_stock table if exists
DROP TABLE IF EXISTS material_stock;

-- Enable RLS on new tables (if not already enabled)
ALTER TABLE company_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_variant_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_stock ENABLE ROW LEVEL SECURITY;

-- Create policies (drop first if exists)
DROP POLICY IF EXISTS "Enable all access" ON company_variants;
CREATE POLICY "Enable all access" ON company_variants FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access" ON item_variant_pricing;
CREATE POLICY "Enable all access" ON item_variant_pricing FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access" ON item_stock;
CREATE POLICY "Enable all access" ON item_stock FOR ALL USING (true) WITH CHECK (true);

-- Insert default warehouse if none exists (include name column)
INSERT INTO warehouses (name, warehouse_code, warehouse_name, location, is_default, is_active) 
SELECT 'Main Warehouse', 'WH-001', 'Main Warehouse', 'Default Location', true, true
WHERE NOT EXISTS (SELECT 1 FROM warehouses WHERE is_default = true);

-- Insert default variants
INSERT INTO company_variants (variant_name) VALUES 
  ('Default'), ('Retail'), ('Wholesale'), ('Online'), ('Export')
ON CONFLICT DO NOTHING;
