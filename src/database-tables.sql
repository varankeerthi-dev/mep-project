-- Run this in Supabase SQL Editor

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Clients table
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id VARCHAR(50) UNIQUE NOT NULL,
  client_name VARCHAR(255) NOT NULL,
  address1 TEXT,
  address2 TEXT,
  state VARCHAR(100),
  gstin VARCHAR(50),
  contact VARCHAR(50),
  email VARCHAR(255),
  vendor_no VARCHAR(100),
  shipping_address TEXT,
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON clients;
CREATE POLICY "Enable all access" ON clients FOR ALL USING (true) WITH CHECK (true);

-- Todos table
CREATE TABLE IF NOT EXISTS todos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON todos;
CREATE POLICY "Enable all access" ON todos FOR ALL USING (true) WITH CHECK (true);

-- Reminders table
CREATE TABLE IF NOT EXISTS reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  remind_date DATE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON reminders;
CREATE POLICY "Enable all access" ON reminders FOR ALL USING (true) WITH CHECK (true);

-- Daily Updates table
CREATE TABLE IF NOT EXISTS daily_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id),
  update_date DATE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE daily_updates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON daily_updates;
CREATE POLICY "Enable all access" ON daily_updates FOR ALL USING (true) WITH CHECK (true);

-- Users table (for user access rights)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  emp_id VARCHAR(50) UNIQUE NOT NULL,
  emp_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(50) DEFAULT 'Assistant',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON users;
CREATE POLICY "Enable all access" ON users FOR ALL USING (true) WITH CHECK (true);

-- Material Inward table
CREATE TABLE IF NOT EXISTS material_inward (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inward_date DATE NOT NULL,
  vendor_name VARCHAR(255),
  invoice_no VARCHAR(100),
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Material Inward Items table
CREATE TABLE IF NOT EXISTS material_inward_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inward_id UUID REFERENCES material_inward(id) ON DELETE CASCADE,
  material_name VARCHAR(255) NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  rate DECIMAL(10,2),
  amount DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Material Outward table
CREATE TABLE IF NOT EXISTS material_outward (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  outward_date DATE NOT NULL,
  project_id UUID REFERENCES projects(id),
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Material Outward Items table
CREATE TABLE IF NOT EXISTS material_outward_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  outward_id UUID REFERENCES material_outward(id) ON DELETE CASCADE,
  material_name VARCHAR(255) NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE material_inward ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_inward_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_outward ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_outward_items ENABLE ROW LEVEL SECURITY;

-- Create policies (drop first if exists)
DROP POLICY IF EXISTS "Enable all access" ON material_inward;
DROP POLICY IF EXISTS "Enable all access" ON material_inward_items;
DROP POLICY IF EXISTS "Enable all access" ON material_outward;
DROP POLICY IF EXISTS "Enable all access" ON material_outward_items;

CREATE POLICY "Enable all access" ON material_inward FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access" ON material_inward_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access" ON material_outward FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access" ON material_outward_items FOR ALL USING (true) WITH CHECK (true);

-- Create indexes (drop first if exist)
DROP INDEX IF EXISTS idx_material_inward_date;
DROP INDEX IF EXISTS idx_material_outward_date;

CREATE INDEX idx_material_inward_date ON material_inward(inward_date);
CREATE INDEX idx_material_outward_date ON material_outward(outward_date);

-- Add contact person columns to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contact_person VARCHAR(100);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contact_designation VARCHAR(100);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contact_person_2 VARCHAR(100);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contact_designation_2 VARCHAR(100);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS purchase_person VARCHAR(100);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS purchase_designation VARCHAR(100);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS purchase_contact VARCHAR(100);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS pincode VARCHAR(20);
