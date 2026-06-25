-- Enhanced Materials Table
-- Run this in Supabase SQL Editor

-- Add new columns to materials table
ALTER TABLE materials ADD COLUMN IF NOT EXISTS part_number VARCHAR(100);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS make VARCHAR(255);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(20);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS gst_rate DECIMAL(5,2);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS sale_price DECIMAL(12,2);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS purchase_price DECIMAL(12,2);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS track_inventory BOOLEAN DEFAULT false;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS low_stock_level DECIMAL(10,2);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS category VARCHAR(100);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS description TEXT;

-- Create warehouses table
CREATE TABLE IF NOT EXISTS warehouses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  location TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access" ON warehouses FOR ALL USING (true) WITH CHECK (true);

-- Create material_stock table for tracking inventory per warehouse
CREATE TABLE IF NOT EXISTS material_stock (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  material_id UUID REFERENCES materials(id) ON DELETE CASCADE,
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
  quantity DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(material_id, warehouse_id)
);

ALTER TABLE material_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access" ON material_stock FOR ALL USING (true) WITH CHECK (true);

-- Insert default warehouse if not exists
INSERT INTO warehouses (name, location) VALUES 
  ('Main Warehouse', 'Default'),
  ('Site Store', 'Site')
ON CONFLICT DO NOTHING;
