-- Tools Management System - Complete Fix
-- This migration handles all issues: missing columns, policies, and permissions

-- Step 1: Ensure tables exist with proper structure
-- tools_catalog table
CREATE TABLE IF NOT EXISTS tools_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  tool_name VARCHAR(255) NOT NULL,
  make VARCHAR(100),
  model VARCHAR(100),
  category VARCHAR(100),
  purchase_price DECIMAL(10,2),
  gst_rate DECIMAL(5,2),
  depreciation_rate DECIMAL(5,2),
  technical_specs TEXT,
  custom_label_1_name VARCHAR(100),
  custom_label_1_value VARCHAR(255),
  custom_label_2_name VARCHAR(100),
  custom_label_2_value VARCHAR(255),
  custom_label_3_name VARCHAR(100),
  custom_label_3_value VARCHAR(255),
  custom_label_4_name VARCHAR(100),
  custom_label_4_value VARCHAR(255),
  initial_stock INTEGER DEFAULT 0,
  current_stock INTEGER DEFAULT 0,
  min_stock_level INTEGER DEFAULT 0,
  reorder_point INTEGER DEFAULT 0,
  default_source_location VARCHAR(100) DEFAULT 'Warehouse',
  hsn_code VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organisation_id, tool_name)
);

-- tool_transactions table
CREATE TABLE IF NOT EXISTS tool_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  reference_id TEXT,
  transaction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  transaction_type VARCHAR(50) NOT NULL,
  source_location VARCHAR(100),
  destination_location VARCHAR(100),
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  taken_by VARCHAR(255),
  received_by VARCHAR(255),
  remarks TEXT,
  status VARCHAR(50) DEFAULT 'PENDING',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- tool_transaction_items table
CREATE TABLE IF NOT EXISTS tool_transaction_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES tool_transactions(id) ON DELETE CASCADE,
  tool_id UUID REFERENCES tools_catalog(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL,
  returned_quantity INTEGER DEFAULT 0,
  condition_issued VARCHAR(100),
  condition_returned VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- tool_stock_movements table
CREATE TABLE IF NOT EXISTS tool_stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  tool_id UUID REFERENCES tools_catalog(id) ON DELETE RESTRICT,
  transaction_id UUID REFERENCES tool_transactions(id) ON DELETE SET NULL,
  movement_type VARCHAR(50) NOT NULL,
  location_type VARCHAR(50) NOT NULL,
  location_id UUID,
  quantity INTEGER NOT NULL,
  reference_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- site_tool_transfers table
CREATE TABLE IF NOT EXISTS site_tool_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  reference_id TEXT,
  transfer_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  from_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  to_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  transferred_by VARCHAR(255),
  received_by VARCHAR(255),
  reason_for_transfer TEXT,
  vehicle_number VARCHAR(100),
  status VARCHAR(50) DEFAULT 'IN_TRANSIT',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Add missing columns safely
DO $$
BEGIN
    -- Add organisation_id to tools_catalog if missing
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tools_catalog') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'tools_catalog' AND column_name = 'organisation_id'
        ) THEN
            ALTER TABLE tools_catalog ADD COLUMN organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- Step 3: Drop all existing policies
DROP POLICY IF EXISTS "Enable read access for own organisation" ON tools_catalog;
DROP POLICY IF EXISTS "Enable insert for own organisation" ON tools_catalog;
DROP POLICY IF EXISTS "Enable update for own organisation" ON tools_catalog;
DROP POLICY IF EXISTS "Enable delete for own organisation" ON tools_catalog;

DROP POLICY IF EXISTS "Enable read access for own organisation" ON tool_transactions;
DROP POLICY IF EXISTS "Enable insert for own organisation" ON tool_transactions;
DROP POLICY IF EXISTS "Enable update for own organisation" ON tool_transactions;
DROP POLICY IF EXISTS "Enable delete for own organisation" ON tool_transactions;

DROP POLICY IF EXISTS "Enable read access for own organisation" ON tool_transaction_items;
DROP POLICY IF EXISTS "Enable insert for own organisation" ON tool_transaction_items;
DROP POLICY IF EXISTS "Enable update for own organisation" ON tool_transaction_items;
DROP POLICY IF EXISTS "Enable delete for own organisation" ON tool_transaction_items;

DROP POLICY IF EXISTS "Enable read access for own organisation" ON tool_stock_movements;
DROP POLICY IF EXISTS "Enable insert for own organisation" ON tool_stock_movements;
DROP POLICY IF EXISTS "Enable update for own organisation" ON tool_stock_movements;
DROP POLICY IF EXISTS "Enable delete for own organisation" ON tool_stock_movements;

DROP POLICY IF EXISTS "Enable read access for own organisation" ON site_tool_transfers;
DROP POLICY IF EXISTS "Enable insert for own organisation" ON site_tool_transfers;
DROP POLICY IF EXISTS "Enable update for own organisation" ON site_tool_transfers;
DROP POLICY IF EXISTS "Enable delete for own organisation" ON site_tool_transfers;

-- Step 4: Enable RLS and create policies
ALTER TABLE tools_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for own organisation" ON tools_catalog
  FOR SELECT USING (organisation_id = auth.uid());
CREATE POLICY "Enable insert for own organisation" ON tools_catalog
  FOR INSERT WITH CHECK (organisation_id = auth.uid());
CREATE POLICY "Enable update for own organisation" ON tools_catalog
  FOR UPDATE USING (organisation_id = auth.uid());
CREATE POLICY "Enable delete for own organisation" ON tools_catalog
  FOR DELETE USING (organisation_id = auth.uid());

ALTER TABLE tool_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for own organisation" ON tool_transactions
  FOR SELECT USING (organisation_id = auth.uid());
CREATE POLICY "Enable insert for own organisation" ON tool_transactions
  FOR INSERT WITH CHECK (organisation_id = auth.uid());
CREATE POLICY "Enable update for own organisation" ON tool_transactions
  FOR UPDATE USING (organisation_id = auth.uid());
CREATE POLICY "Enable delete for own organisation" ON tool_transactions
  FOR DELETE USING (organisation_id = auth.uid());

ALTER TABLE tool_transaction_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for own organisation" ON tool_transaction_items
  FOR SELECT USING (organisation_id = auth.uid());
CREATE POLICY "Enable insert for own organisation" ON tool_transaction_items
  FOR INSERT WITH CHECK (organisation_id = auth.uid());
CREATE POLICY "Enable update for own organisation" ON tool_transaction_items
  FOR UPDATE USING (organisation_id = auth.uid());
CREATE POLICY "Enable delete for own organisation" ON tool_transaction_items
  FOR DELETE USING (organisation_id = auth.uid());

ALTER TABLE tool_stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for own organisation" ON tool_stock_movements
  FOR SELECT USING (organisation_id = auth.uid());
CREATE POLICY "Enable insert for own organisation" ON tool_stock_movements
  FOR INSERT WITH CHECK (organisation_id = auth.uid());
CREATE POLICY "Enable update for own organisation" ON tool_stock_movements
  FOR UPDATE USING (organisation_id = auth.uid());
CREATE POLICY "Enable delete for own organisation" ON tool_stock_movements
  FOR DELETE USING (organisation_id = auth.uid());

ALTER TABLE site_tool_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for own organisation" ON site_tool_transfers
  FOR SELECT USING (organisation_id = auth.uid());
CREATE POLICY "Enable insert for own organisation" ON site_tool_transfers
  FOR INSERT WITH CHECK (organisation_id = auth.uid());
CREATE POLICY "Enable update for own organisation" ON site_tool_transfers
  FOR UPDATE USING (organisation_id = auth.uid());
CREATE POLICY "Enable delete for own organisation" ON site_tool_transfers
  FOR DELETE USING (organisation_id = auth.uid());

-- Step 5: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tools_catalog_org_id ON tools_catalog(organisation_id);
CREATE INDEX IF NOT EXISTS idx_tools_catalog_name ON tools_catalog(tool_name);
CREATE INDEX IF NOT EXISTS idx_tool_transactions_org_id ON tool_transactions(organisation_id);
CREATE INDEX IF NOT EXISTS idx_tool_transaction_items_org_id ON tool_transaction_items(organisation_id);
CREATE INDEX IF NOT EXISTS idx_tool_stock_movements_org_id ON tool_stock_movements(organisation_id);
CREATE INDEX IF NOT EXISTS idx_site_tool_transfers_org_id ON site_tool_transfers(organisation_id);
