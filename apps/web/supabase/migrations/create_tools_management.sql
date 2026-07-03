-- Tools Management System - Complete Database Schema
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TOOLS CATALOG TABLE
CREATE TABLE IF NOT EXISTS tools_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
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

-- Enable RLS for tools_catalog
ALTER TABLE tools_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for own organisation" ON tools_catalog FOR SELECT USING (organisation_id = auth.uid());
CREATE POLICY "Enable insert for own organisation" ON tools_catalog FOR INSERT WITH CHECK (organisation_id = auth.uid());
CREATE POLICY "Enable update for own organisation" ON tools_catalog FOR UPDATE USING (organisation_id = auth.uid());
CREATE POLICY "Enable delete for own organisation" ON tools_catalog FOR DELETE USING (organisation_id = auth.uid());

-- Indexes for tools_catalog
CREATE INDEX IF NOT EXISTS idx_tools_catalog_org ON tools_catalog(organisation_id);
CREATE INDEX IF NOT EXISTS idx_tools_catalog_name ON tools_catalog(tool_name);
CREATE INDEX IF NOT EXISTS idx_tools_catalog_category ON tools_catalog(category);
CREATE INDEX IF NOT EXISTS idx_tools_catalog_stock ON tools_catalog(current_stock);

-- 2. TOOL TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS tool_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  reference_id VARCHAR(20) NOT NULL UNIQUE,
  transaction_type VARCHAR(20) NOT NULL, -- 'ISSUE', 'RECEIVE', 'TRANSFER', 'SITE_TRANSFER'
  transaction_date DATE NOT NULL,
  client_id UUID REFERENCES clients(id),
  from_client_id UUID REFERENCES clients(id), -- for transfers
  to_client_id UUID REFERENCES clients(id),   -- for transfers
  taken_by VARCHAR(255),
  received_by VARCHAR(255),
  remarks TEXT,
  status VARCHAR(20) DEFAULT 'ACTIVE', -- 'ACTIVE', 'RETURNED', 'PARTIAL', 'IN_TRANSIT'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for tool_transactions
ALTER TABLE tool_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for own organisation" ON tool_transactions FOR SELECT USING (organisation_id = auth.uid());
CREATE POLICY "Enable insert for own organisation" ON tool_transactions FOR INSERT WITH CHECK (organisation_id = auth.uid());
CREATE POLICY "Enable update for own organisation" ON tool_transactions FOR UPDATE USING (organisation_id = auth.uid());
CREATE POLICY "Enable delete for own organisation" ON tool_transactions FOR DELETE USING (organisation_id = auth.uid());

-- Indexes for tool_transactions
CREATE INDEX IF NOT EXISTS idx_tool_transactions_org ON tool_transactions(organisation_id);
CREATE INDEX IF NOT EXISTS idx_tool_transactions_ref ON tool_transactions(reference_id);
CREATE INDEX IF NOT EXISTS idx_tool_transactions_type ON tool_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_tool_transactions_date ON tool_transactions(transaction_date);

-- 3. TOOL TRANSACTION ITEMS TABLE
CREATE TABLE IF NOT EXISTS tool_transaction_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES tool_transactions(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools_catalog(id),
  quantity INTEGER NOT NULL,
  returned_quantity INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for tool_transaction_items
ALTER TABLE tool_transaction_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for own organisation" ON tool_transaction_items FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM tool_transactions tt 
    WHERE tt.id = tool_transaction_items.transaction_id 
    AND tt.organisation_id = auth.uid()
  )
);
CREATE POLICY "Enable insert for own organisation" ON tool_transaction_items FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM tool_transactions tt 
    WHERE tt.id = tool_transaction_items.transaction_id 
    AND tt.organisation_id = auth.uid()
  )
);

-- Indexes for tool_transaction_items
CREATE INDEX IF NOT EXISTS idx_tool_transaction_items_transaction ON tool_transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_tool_transaction_items_tool ON tool_transaction_items(tool_id);

-- 4. TOOL STOCK MOVEMENTS TABLE
CREATE TABLE IF NOT EXISTS tool_stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools_catalog(id),
  transaction_id UUID REFERENCES tool_transactions(id),
  movement_type VARCHAR(20) NOT NULL, -- 'OUT', 'IN', 'TRANSFER', 'SITE_TRANSFER'
  quantity INTEGER NOT NULL,
  location_type VARCHAR(20) NOT NULL, -- 'WAREHOUSE', 'CLIENT', 'PROJECT'
  location_id UUID, -- client_id or project_id or NULL for warehouse
  balance_after INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for tool_stock_movements
ALTER TABLE tool_stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for own organisation" ON tool_stock_movements FOR SELECT USING (organisation_id = auth.uid());
CREATE POLICY "Enable insert for own organisation" ON tool_stock_movements FOR INSERT WITH CHECK (organisation_id = auth.uid());

-- Indexes for tool_stock_movements
CREATE INDEX IF NOT EXISTS idx_tool_stock_movements_org ON tool_stock_movements(organisation_id);
CREATE INDEX IF NOT EXISTS idx_tool_stock_movements_tool ON tool_stock_movements(tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_stock_movements_type ON tool_stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_tool_stock_movements_date ON tool_stock_movements(created_at);

-- 5. SITE TOOL TRANSFERS TABLE
CREATE TABLE IF NOT EXISTS site_tool_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  reference_id VARCHAR(20) UNIQUE NOT NULL,
  transfer_date DATE NOT NULL,
  from_project_id UUID REFERENCES projects(id),
  to_project_id UUID REFERENCES projects(id),
  transferred_by VARCHAR(255),
  received_by VARCHAR(255),
  reason_for_transfer TEXT,
  vehicle_number VARCHAR(50),
  status VARCHAR(20) DEFAULT 'IN_TRANSIT',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for site_tool_transfers
ALTER TABLE site_tool_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for own organisation" ON site_tool_transfers FOR SELECT USING (organisation_id = auth.uid());
CREATE POLICY "Enable insert for own organisation" ON site_tool_transfers FOR INSERT WITH CHECK (organisation_id = auth.uid());
CREATE POLICY "Enable update for own organisation" ON site_tool_transfers FOR UPDATE USING (organisation_id = auth.uid());

-- Indexes for site_tool_transfers
CREATE INDEX IF NOT EXISTS idx_site_tool_transfers_org ON site_tool_transfers(organisation_id);
CREATE INDEX IF NOT EXISTS idx_site_tool_transfers_ref ON site_tool_transfers(reference_id);
CREATE INDEX IF NOT EXISTS idx_site_tool_transfers_from ON site_tool_transfers(from_project_id);
CREATE INDEX IF NOT EXISTS idx_site_tool_transfers_to ON site_tool_transfers(to_project_id);
CREATE INDEX IF NOT EXISTS idx_site_tool_transfers_date ON site_tool_transfers(transfer_date);

-- 6. REFERENCE ID SEQUENCE
CREATE SEQUENCE IF NOT EXISTS tools_ref_seq START 1;

-- 7. FUNCTIONS AND TRIGGERS

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

-- Function to update stock levels on transaction
CREATE OR REPLACE FUNCTION update_tool_stock_on_transaction()
RETURNS TRIGGER AS $$
BEGIN
  -- Update stock based on transaction type
  IF NEW.transaction_type = 'ISSUE' THEN
    -- Decrease warehouse stock, increase client stock
    UPDATE tools_catalog SET current_stock = current_stock - (
      SELECT COALESCE(SUM(tti.quantity), 0) 
      FROM tool_transaction_items tti 
      WHERE tti.transaction_id = NEW.id
    ) WHERE id IN (
      SELECT tool_id FROM tool_transaction_items WHERE transaction_id = NEW.id
    );
    
  ELSIF NEW.transaction_type = 'RECEIVE' THEN
    -- Increase warehouse stock, decrease client stock
    UPDATE tools_catalog SET current_stock = current_stock + (
      SELECT COALESCE(SUM(tti.quantity - tti.returned_quantity), 0) 
      FROM tool_transaction_items tti 
      WHERE tti.transaction_id = NEW.id
    ) WHERE id IN (
      SELECT tool_id FROM tool_transaction_items WHERE transaction_id = NEW.id
    );
    
  ELSIF NEW.transaction_type = 'TRANSFER' THEN
    -- Transfer between clients (no warehouse impact)
    -- Stock movements handled in separate function
    
  ELSIF NEW.transaction_type = 'SITE_TRANSFER' THEN
    -- Transfer between projects (no warehouse impact)
    -- Stock movements handled in separate function
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for stock updates
CREATE TRIGGER update_tool_stock_on_transaction_trigger
  AFTER INSERT ON tool_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_tool_stock_on_transaction();

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
    balance_after
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
    END
  FROM tool_transaction_items tti
  JOIN tool_transactions tt ON tt.id = tti.transaction_id
  JOIN tools_catalog tc ON tc.id = tti.tool_id
  WHERE tti.transaction_id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for stock movements
CREATE TRIGGER create_tool_stock_movement_trigger
  AFTER INSERT ON tool_transactions
  FOR EACH ROW
  EXECUTE FUNCTION create_tool_stock_movement();

-- Insert default source locations
INSERT INTO tools_catalog (tool_name, default_source_location, organisation_id, current_stock, initial_stock)
SELECT 
  'Default Tool',
  'Warehouse',
  o.id,
  0,
  0
FROM organisations o 
WHERE NOT EXISTS (
  SELECT 1 FROM tools_catalog tc WHERE tc.organisation_id = o.id LIMIT 1
);

-- Add comments for documentation
COMMENT ON TABLE tools_catalog IS 'Master catalog of all tools with specifications and stock levels';
COMMENT ON TABLE tool_transactions IS 'Records all tool movements (issue, receive, transfer, site transfer)';
COMMENT ON TABLE tool_transaction_items IS 'Individual tool items within each transaction';
COMMENT ON TABLE tool_stock_movements IS 'Complete audit trail of all stock movements';
COMMENT ON TABLE site_tool_transfers IS 'Direct transfers between project sites without warehouse involvement';
