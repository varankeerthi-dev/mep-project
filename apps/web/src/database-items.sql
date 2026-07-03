-- Enhanced Materials/Items Database
-- Run this in Supabase SQL Editor

-- Update materials table with new structure
ALTER TABLE materials ADD COLUMN IF NOT EXISTS display_name VARCHAR(255);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS item_code VARCHAR(50) UNIQUE;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS main_category VARCHAR(50);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS sub_category VARCHAR(100);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS size VARCHAR(50);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS pressure_class VARCHAR(50);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS schedule_type VARCHAR(50);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS material VARCHAR(100);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS end_connection VARCHAR(100);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Rename/keep legacy columns mapping
-- name -> item_name (main identifier)
-- sale_price, purchase_price, gst_rate, hsn_code -> existing
-- track_inventory, low_stock_level -> existing

-- Create services table
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
CREATE POLICY "Enable all access" ON services FOR ALL USING (true) WITH CHECK (true);

-- Create item_categories table
CREATE TABLE IF NOT EXISTS item_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE item_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access" ON item_categories FOR ALL USING (true) WITH CHECK (true);

-- Create item_units table
CREATE TABLE IF NOT EXISTS item_units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unit_name VARCHAR(50) NOT NULL UNIQUE,
  unit_code VARCHAR(20) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE item_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access" ON item_units FOR ALL USING (true) WITH CHECK (true);

-- Insert default categories
INSERT INTO item_categories (category_name) VALUES 
  ('VALVE'), ('PIPE'), ('FITTING'), ('FLANGE'), ('ELECTRICAL'), ('PLUMBING'), ('HVAC'), ('FIRE PROTECTION'), ('BUILDING MATERIALS'), ('TOOLS'), ('SAFETY'), ('OFFICE'), ('OTHER')
ON CONFLICT (category_name) DO NOTHING;

-- Insert default units
INSERT INTO item_units (unit_name, unit_code) VALUES 
  ('Numbers', 'nos'), ('Kilogram', 'kg'), ('Meter', 'mtr'), ('Square Meter', 'sqm'), ('Square Feet', 'sqft'), 
  ('Cubic Feet', 'cuft'), ('Liter', 'ltr'), ('Bags', 'bags'), ('Box', 'box'), ('Pair', 'pair'), ('Set', 'set'), ('Pack', 'pack')
ON CONFLICT (unit_code) DO NOTHING;
