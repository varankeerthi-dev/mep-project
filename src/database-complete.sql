-- ============================================
-- MEP PROJECT - COMPLETE DATABASE SETUP
-- Run this entire script in Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. AUTH & ORGANISATION TABLES
-- ============================================

-- Organisations table
CREATE TABLE IF NOT EXISTS organisations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  logo_url TEXT,
  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(255),
  gstin VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User profiles table (links to auth.users)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name VARCHAR(255),
  phone VARCHAR(50),
  role VARCHAR(50) DEFAULT 'member',
  avatar_url TEXT,
  email_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Organisation members table
CREATE TABLE IF NOT EXISTS org_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'member',
  status VARCHAR(20) DEFAULT 'active',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organisation_id, user_id)
);

-- ============================================
-- 2. CORE BUSINESS TABLES
-- ============================================

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  client_name VARCHAR(255),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

-- Materials table
CREATE TABLE IF NOT EXISTS materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  default_rate DECIMAL(10,2),
  size VARCHAR(100),
  min_qty DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 3. DELIVERY CHALLAN TABLES
-- ============================================

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

-- ============================================
-- 4. STORE/INVENTORY TABLES
-- ============================================

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

-- ============================================
-- 5. UTILITY TABLES
-- ============================================

-- Todos table
CREATE TABLE IF NOT EXISTS todos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reminders table
CREATE TABLE IF NOT EXISTS reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  remind_date DATE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Daily Updates table
CREATE TABLE IF NOT EXISTS daily_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id),
  update_date DATE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users table (for user access rights in settings)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  emp_id VARCHAR(50) UNIQUE NOT NULL,
  emp_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(50) DEFAULT 'Assistant',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 6. ENABLE ROW LEVEL SECURITY (DISABLED FOR NOW)
-- ============================================

ALTER TABLE organisations DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE org_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE materials DISABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_challans DISABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_challan_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE material_inward DISABLE ROW LEVEL SECURITY;
ALTER TABLE material_inward_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE material_outward DISABLE ROW LEVEL SECURITY;
ALTER TABLE material_outward_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE todos DISABLE ROW LEVEL SECURITY;
ALTER TABLE reminders DISABLE ROW LEVEL SECURITY;
ALTER TABLE daily_updates DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- ============================================
-- 7. INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_org_members_org ON org_members(organisation_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_delivery_challans_dc_date ON delivery_challans(dc_date);
CREATE INDEX IF NOT EXISTS idx_delivery_challans_project_id ON delivery_challans(project_id);
CREATE INDEX IF NOT EXISTS idx_delivery_challan_items_challan_id ON delivery_challan_items(delivery_challan_id);
CREATE INDEX IF NOT EXISTS idx_delivery_challan_items_material ON delivery_challan_items(material_name);
CREATE INDEX IF NOT EXISTS idx_material_inward_date ON material_inward(inward_date);
CREATE INDEX IF NOT EXISTS idx_material_outward_date ON material_outward(outward_date);

-- ============================================
-- 8. AUTH TRIGGER - Auto create user profile
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, full_name, email_verified)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.email_confirmed_at IS NOT NULL
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 9. SAMPLE DATA (Optional)
-- ============================================

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

-- ============================================
-- DONE! All tables created successfully.
-- ============================================
