-- ==========================================
-- TOOLS MANAGEMENT SYSTEM - COMPLETE SCHEMA
-- ==========================================
-- This is the definitive, clean schema for the tools management system
-- Created: 2026-05-11
-- Purpose: Replace all fragmented SQL files with one comprehensive schema

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. TOOLS CATALOG TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS tools_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  
  -- Basic tool information
  tool_name VARCHAR(255) NOT NULL,
  make VARCHAR(100),
  model VARCHAR(100),
  category VARCHAR(100),
  
  -- Financial information
  purchase_price DECIMAL(10,2),
  gst_rate DECIMAL(5,2),
  depreciation_rate DECIMAL(5,2),
  hsn_code VARCHAR(20),
  
  -- Technical specifications
  technical_specs TEXT,
  
  -- Custom labels for flexibility
  custom_label_1_name VARCHAR(100),
  custom_label_1_value VARCHAR(255),
  custom_label_2_name VARCHAR(100),
  custom_label_2_value VARCHAR(255),
  custom_label_3_name VARCHAR(100),
  custom_label_3_value VARCHAR(255),
  custom_label_4_name VARCHAR(100),
  custom_label_4_value VARCHAR(255),
  
  -- Stock management
  initial_stock INTEGER DEFAULT 0,
  current_stock INTEGER DEFAULT 0,
  min_stock_level INTEGER DEFAULT 0,
  reorder_point INTEGER DEFAULT 0,
  default_source_location VARCHAR(100) DEFAULT 'Warehouse',
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(organisation_id, tool_name)
);

-- ==========================================
-- 2. TOOL TRANSACTIONS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS tool_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  
  -- Reference and identification
  reference_id VARCHAR(20) NOT NULL UNIQUE,
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('ISSUE', 'RECEIVE', 'TRANSFER', 'SITE_TRANSFER')),
  transaction_date DATE NOT NULL,
  
  -- Client relationships (for different transaction types)
  client_id UUID REFERENCES clients(id),           -- For ISSUE transactions
  from_client_id UUID REFERENCES clients(id),       -- For TRANSFER transactions
  to_client_id UUID REFERENCES clients(id),         -- For TRANSFER transactions
  
  -- Project relationships (for site transfers)
  from_project_id UUID REFERENCES projects(id),      -- For SITE_TRANSFER
  to_project_id UUID REFERENCES projects(id),        -- For SITE_TRANSFER
  
  -- Personnel information
  taken_by VARCHAR(255),
  received_by VARCHAR(255),
  
  -- Additional information
  remarks TEXT,
  status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'RETURNED', 'PARTIAL', 'IN_TRANSIT', 'COMPLETED')),
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 3. TOOL TRANSACTION ITEMS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS tool_transaction_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  
  -- Relationships
  transaction_id UUID NOT NULL REFERENCES tool_transactions(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools_catalog(id) ON DELETE RESTRICT,
  
  -- Quantities
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  returned_quantity INTEGER DEFAULT 0 CHECK (returned_quantity >= 0),
  
  -- Condition tracking
  condition_issued VARCHAR(100),
  condition_returned VARCHAR(100),
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 4. TOOL STOCK MOVEMENTS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS tool_stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  
  -- Relationships
  tool_id UUID NOT NULL REFERENCES tools_catalog(id) ON DELETE RESTRICT,
  transaction_id UUID REFERENCES tool_transactions(id) ON DELETE SET NULL,
  
  -- Movement details
  movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('OUT', 'IN', 'TRANSFER', 'SITE_TRANSFER')),
  location_type VARCHAR(20) NOT NULL CHECK (location_type IN ('WAREHOUSE', 'CLIENT', 'PROJECT')),
  location_id UUID, -- Can reference client_id, project_id, or NULL for warehouse
  
  -- Quantities
  quantity INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  
  -- Reference tracking
  reference_id VARCHAR(20), -- For easy lookup with transaction reference
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 5. SITE TOOL TRANSFERS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS site_tool_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  
  -- Reference and identification
  reference_id VARCHAR(20) UNIQUE NOT NULL,
  transfer_date DATE NOT NULL,
  
  -- Project relationships
  from_project_id UUID REFERENCES projects(id),
  to_project_id UUID REFERENCES projects(id),
  
  -- Personnel and logistics
  transferred_by VARCHAR(255),
  received_by VARCHAR(255),
  reason_for_transfer TEXT,
  vehicle_number VARCHAR(50),
  
  -- Status tracking
  status VARCHAR(20) DEFAULT 'IN_TRANSIT' CHECK (status IN ('IN_TRANSIT', 'COMPLETED', 'CANCELLED')),
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 6. REFERENCE ID SEQUENCE
-- ==========================================
CREATE SEQUENCE IF NOT EXISTS tools_ref_seq START 1;

-- ==========================================
-- 7. INDEXES FOR PERFORMANCE
-- ==========================================
-- Tools catalog indexes
CREATE INDEX IF NOT EXISTS idx_tools_catalog_org_id ON tools_catalog(organisation_id);
CREATE INDEX IF NOT EXISTS idx_tools_catalog_name ON tools_catalog(tool_name);
CREATE INDEX IF NOT EXISTS idx_tools_catalog_category ON tools_catalog(category);
CREATE INDEX IF NOT EXISTS idx_tools_catalog_stock ON tools_catalog(current_stock);
CREATE INDEX IF NOT EXISTS idx_tools_catalog_min_stock ON tools_catalog(min_stock_level);

-- Tool transactions indexes
CREATE INDEX IF NOT EXISTS idx_tool_transactions_org_id ON tool_transactions(organisation_id);
CREATE INDEX IF NOT EXISTS idx_tool_transactions_ref ON tool_transactions(reference_id);
CREATE INDEX IF NOT EXISTS idx_tool_transactions_type ON tool_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_tool_transactions_date ON tool_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_tool_transactions_status ON tool_transactions(status);
CREATE INDEX IF NOT EXISTS idx_tool_transactions_client ON tool_transactions(client_id);

-- Tool transaction items indexes
CREATE INDEX IF NOT EXISTS idx_tool_transaction_items_transaction ON tool_transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_tool_transaction_items_tool ON tool_transaction_items(tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_transaction_items_org ON tool_transaction_items(organisation_id);

-- Stock movements indexes
CREATE INDEX IF NOT EXISTS idx_tool_stock_movements_org ON tool_stock_movements(organisation_id);
CREATE INDEX IF NOT EXISTS idx_tool_stock_movements_tool ON tool_stock_movements(tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_stock_movements_type ON tool_stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_tool_stock_movements_date ON tool_stock_movements(created_at);

-- Site transfers indexes
CREATE INDEX IF NOT EXISTS idx_site_tool_transfers_org ON site_tool_transfers(organisation_id);
CREATE INDEX IF NOT EXISTS idx_site_tool_transfers_ref ON site_tool_transfers(reference_id);
CREATE INDEX IF NOT EXISTS idx_site_tool_transfers_from ON site_tool_transfers(from_project_id);
CREATE INDEX IF NOT EXISTS idx_site_tool_transfers_to ON site_tool_transfers(to_project_id);
CREATE INDEX IF NOT EXISTS idx_site_tool_transfers_date ON site_tool_transfers(transfer_date);

-- ==========================================
-- 8. ROW LEVEL SECURITY POLICIES
-- ==========================================

-- Tools catalog RLS
ALTER TABLE tools_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable access for tools_catalog" ON tools_catalog;
DROP POLICY IF EXISTS "tools_catalog_policy" ON tools_catalog;
DROP POLICY IF EXISTS "Enable read access for own organisation" ON tools_catalog;
DROP POLICY IF EXISTS "Enable insert for own organisation" ON tools_catalog;
DROP POLICY IF EXISTS "Enable update for own organisation" ON tools_catalog;
DROP POLICY IF EXISTS "Enable delete for own organisation" ON tools_catalog;
CREATE POLICY "Enable access for tools_catalog" ON tools_catalog
  FOR ALL USING (organisation_id = auth.uid());

-- Tool transactions RLS
ALTER TABLE tool_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable access for tool_transactions" ON tool_transactions;
DROP POLICY IF EXISTS "tool_transactions_policy" ON tool_transactions;
DROP POLICY IF EXISTS "Enable read access for own organisation" ON tool_transactions;
DROP POLICY IF EXISTS "Enable insert for own organisation" ON tool_transactions;
DROP POLICY IF EXISTS "Enable update for own organisation" ON tool_transactions;
DROP POLICY IF EXISTS "Enable delete for own organisation" ON tool_transactions;
CREATE POLICY "Enable access for tool_transactions" ON tool_transactions
  FOR ALL USING (organisation_id = auth.uid());

-- Tool transaction items RLS
ALTER TABLE tool_transaction_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable access for tool_transaction_items" ON tool_transaction_items;
DROP POLICY IF EXISTS "tool_transaction_items_policy" ON tool_transaction_items;
DROP POLICY IF EXISTS "Enable read access for own organisation" ON tool_transaction_items;
DROP POLICY IF EXISTS "Enable insert for own organisation" ON tool_transaction_items;
DROP POLICY IF EXISTS "Enable update for own organisation" ON tool_transaction_items;
DROP POLICY IF EXISTS "Enable delete for own organisation" ON tool_transaction_items;
CREATE POLICY "Enable access for tool_transaction_items" ON tool_transaction_items
  FOR ALL USING (organisation_id = auth.uid());

-- Stock movements RLS
ALTER TABLE tool_stock_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable access for tool_stock_movements" ON tool_stock_movements;
DROP POLICY IF EXISTS "tool_stock_movements_policy" ON tool_stock_movements;
DROP POLICY IF EXISTS "Enable read access for own organisation" ON tool_stock_movements;
DROP POLICY IF EXISTS "Enable insert for own organisation" ON tool_stock_movements;
DROP POLICY IF EXISTS "Enable update for own organisation" ON tool_stock_movements;
DROP POLICY IF EXISTS "Enable delete for own organisation" ON tool_stock_movements;
CREATE POLICY "Enable access for tool_stock_movements" ON tool_stock_movements
  FOR ALL USING (organisation_id = auth.uid());

-- Site transfers RLS
ALTER TABLE site_tool_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable access for site_tool_transfers" ON site_tool_transfers;
DROP POLICY IF EXISTS "site_tool_transfers_policy" ON site_tool_transfers;
DROP POLICY IF EXISTS "Enable read access for own organisation" ON site_tool_transfers;
DROP POLICY IF EXISTS "Enable insert for own organisation" ON site_tool_transfers;
DROP POLICY IF EXISTS "Enable update for own organisation" ON site_tool_transfers;
DROP POLICY IF EXISTS "Enable delete for own organisation" ON site_tool_transfers;
CREATE POLICY "Enable access for site_tool_transfers" ON site_tool_transfers
  FOR ALL USING (organisation_id = auth.uid());

-- ==========================================
-- 9. FUNCTIONS AND TRIGGERS
-- ==========================================

-- Function to generate reference ID
CREATE OR REPLACE FUNCTION generate_tools_reference_id(p_org_id UUID)
RETURNS TEXT AS $$
DECLARE
  org_code TEXT;
  next_number INTEGER;
BEGIN
  -- Get organisation code (first 3 letters of org name)
  SELECT UPPER(SUBSTRING(o.name, 1, 3)) INTO org_code
  FROM organisations o WHERE o.id = p_org_id;
  
  -- Get next sequence number
  SELECT nextval('tools_ref_seq') INTO next_number;
  
  -- Format: ORG12345 (3 letters + 5 digits)
  RETURN COALESCE(org_code, 'ORG') || LPAD(next_number::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- Function to create stock movement records
CREATE OR REPLACE FUNCTION create_tool_stock_movement()
RETURNS TRIGGER AS $$
BEGIN
  -- Create stock movement record for each tool item
  INSERT INTO tool_stock_movements (
    organisation_id,
    tool_id,
    transaction_id,
    movement_type,
    quantity,
    location_type,
    location_id,
    balance_after,
    reference_id
  )
  SELECT 
    tt.organisation_id,
    tti.tool_id,
    NEW.id,
    CASE NEW.transaction_type
      WHEN 'ISSUE' THEN 'OUT'
      WHEN 'RECEIVE' THEN 'IN'
      WHEN 'TRANSFER' THEN 'TRANSFER'
      WHEN 'SITE_TRANSFER' THEN 'SITE_TRANSFER'
    END,
    tti.quantity,
    CASE NEW.transaction_type
      WHEN 'ISSUE' THEN 'CLIENT'
      WHEN 'RECEIVE' THEN 'WAREHOUSE'
      WHEN 'TRANSFER' THEN 'CLIENT'
      WHEN 'SITE_TRANSFER' THEN 'PROJECT'
    END,
    CASE NEW.transaction_type
      WHEN 'ISSUE' THEN NEW.client_id
      WHEN 'RECEIVE' THEN NULL
      WHEN 'TRANSFER' THEN NEW.to_client_id
      WHEN 'SITE_TRANSFER' THEN NEW.to_project_id
    END,
    tc.current_stock + CASE NEW.transaction_type
      WHEN 'ISSUE' THEN -tti.quantity
      WHEN 'RECEIVE' THEN tti.quantity
      ELSE 0
    END,
    NEW.reference_id
  FROM tool_transaction_items tti
  JOIN tool_transactions tt ON tt.id = tti.transaction_id
  JOIN tools_catalog tc ON tc.id = tti.tool_id
  WHERE tti.transaction_id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for stock movements
DROP TRIGGER IF EXISTS create_tool_stock_movement_trigger ON tool_transactions;
CREATE TRIGGER create_tool_stock_movement_trigger
  AFTER INSERT ON tool_transactions
  FOR EACH ROW
  EXECUTE FUNCTION create_tool_stock_movement();

-- ==========================================
-- 10. PERMISSIONS
-- ==========================================
GRANT SELECT ON tools_catalog TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON tools_catalog TO authenticated;

GRANT SELECT ON tool_transactions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON tool_transactions TO authenticated;

GRANT SELECT ON tool_transaction_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON tool_transaction_items TO authenticated;

GRANT SELECT ON tool_stock_movements TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON tool_stock_movements TO authenticated;

GRANT SELECT ON site_tool_transfers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON site_tool_transfers TO authenticated;

-- Grant execute permission for the function
GRANT EXECUTE ON FUNCTION generate_tools_reference_id TO authenticated;

-- ==========================================
-- 11. TABLE COMMENTS FOR DOCUMENTATION
-- ==========================================
COMMENT ON TABLE tools_catalog IS 'Master catalog of all tools with specifications, stock levels, and custom labels';
COMMENT ON TABLE tool_transactions IS 'Records all tool movements including issue, receive, transfer, and site transfer operations';
COMMENT ON TABLE tool_transaction_items IS 'Individual tool items within each transaction with quantity and condition tracking';
COMMENT ON TABLE tool_stock_movements IS 'Complete audit trail of all stock movements across different locations';
COMMENT ON TABLE site_tool_transfers IS 'Direct transfers between project sites without warehouse involvement';

-- ==========================================
-- 12. VERIFICATION
-- ==========================================
SELECT 'Tools Management System - Complete Schema Created Successfully' as status;
