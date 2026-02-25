-- Database Setup Script for MEP Project App
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  client_name VARCHAR(255),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Materials table
CREATE TABLE IF NOT EXISTS materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  default_rate DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Delivery Challans table
CREATE TABLE IF NOT EXISTS delivery_challans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dc_number VARCHAR(50) UNIQUE NOT NULL,
  project_id UUID REFERENCES projects(id),
  dc_date DATE NOT NULL,
  client_name VARCHAR(255),
  site_address TEXT,
  vehicle_number VARCHAR(50),
  driver_name VARCHAR(100),
  remarks TEXT,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Delivery Challan Items table
CREATE TABLE IF NOT EXISTS delivery_challan_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_challan_id UUID REFERENCES delivery_challans(id) ON DELETE CASCADE,
  material_id UUID REFERENCES materials(id),
  material_name VARCHAR(255) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  size VARCHAR(100),
  quantity DECIMAL(10,2) NOT NULL,
  rate DECIMAL(10,2),
  amount DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_challans ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_challan_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to allow re-running the script)
DROP POLICY IF EXISTS "Enable all access for projects" ON projects;
DROP POLICY IF EXISTS "Enable all access for materials" ON materials;
DROP POLICY IF EXISTS "Enable all access for delivery_challans" ON delivery_challans;
DROP POLICY IF EXISTS "Enable all access for delivery_challan_items" ON delivery_challan_items;

-- Create policies for public access (adjust as needed)
CREATE POLICY "Enable all access for projects" ON projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for materials" ON materials FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for delivery_challans" ON delivery_challans FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for delivery_challan_items" ON delivery_challan_items FOR ALL USING (true) WITH CHECK (true);

-- Create indexes for better performance (drop first if exists to allow re-running)
DROP INDEX IF EXISTS idx_delivery_challans_dc_date;
DROP INDEX IF EXISTS idx_delivery_challans_project_id;
DROP INDEX IF EXISTS idx_delivery_challan_items_challan_id;
DROP INDEX IF EXISTS idx_delivery_challan_items_material;

CREATE INDEX idx_delivery_challans_dc_date ON delivery_challans(dc_date);
CREATE INDEX idx_delivery_challans_project_id ON delivery_challans(project_id);
CREATE INDEX idx_delivery_challan_items_challan_id ON delivery_challan_items(delivery_challan_id);
CREATE INDEX idx_delivery_challan_items_material ON delivery_challan_items(material_name);

-- Insert sample materials
INSERT INTO materials (name, unit, default_rate) VALUES
  ('Cement', 'bags', 350),
  ('Sand', 'cuft', 45),
  ('Aggregate', 'cuft', 65),
  ('Steel Bars', 'kg', 65),
  ('Bricks', 'nos', 8),
  ('Concrete Mix', 'cuft', 120),
  ('Plywood', 'sqft', 45),
  ('PVC Pipes', 'm', 85),
  ('Electrical Wire', 'm', 15),
  ('Switch Board', 'nos', 120)
ON CONFLICT DO NOTHING;

-- Insert sample project
INSERT INTO projects (name, client_name, description) VALUES
  ('Sample Project', 'ABC Construction', 'Sample MEP Project')
ON CONFLICT DO NOTHING;
