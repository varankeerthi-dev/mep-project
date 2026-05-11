-- Tools Management System - Fix for existing policies
-- This migration handles the case where policies already exist

-- Drop existing policies if they exist
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

-- Recreate RLS policies for tools_catalog
ALTER TABLE tools_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for own organisation" ON tools_catalog
  FOR SELECT USING (organisation_id = auth.uid());

CREATE POLICY "Enable insert for own organisation" ON tools_catalog
  FOR INSERT WITH CHECK (organisation_id = auth.uid());

CREATE POLICY "Enable update for own organisation" ON tools_catalog
  FOR UPDATE USING (organisation_id = auth.uid());

CREATE POLICY "Enable delete for own organisation" ON tools_catalog
  FOR DELETE USING (organisation_id = auth.uid());

-- Recreate RLS policies for tool_transactions
ALTER TABLE tool_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for own organisation" ON tool_transactions
  FOR SELECT USING (organisation_id = auth.uid());

CREATE POLICY "Enable insert for own organisation" ON tool_transactions
  FOR INSERT WITH CHECK (organisation_id = auth.uid());

CREATE POLICY "Enable update for own organisation" ON tool_transactions
  FOR UPDATE USING (organisation_id = auth.uid());

CREATE POLICY "Enable delete for own organisation" ON tool_transactions
  FOR DELETE USING (organisation_id = auth.uid());

-- Recreate RLS policies for tool_transaction_items
ALTER TABLE tool_transaction_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for own organisation" ON tool_transaction_items
  FOR SELECT USING (organisation_id = auth.uid());

CREATE POLICY "Enable insert for own organisation" ON tool_transaction_items
  FOR INSERT WITH CHECK (organisation_id = auth.uid());

CREATE POLICY "Enable update for own organisation" ON tool_transaction_items
  FOR UPDATE USING (organisation_id = auth.uid());

CREATE POLICY "Enable delete for own organisation" ON tool_transaction_items
  FOR DELETE USING (organisation_id = auth.uid());

-- Recreate RLS policies for tool_stock_movements
ALTER TABLE tool_stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for own organisation" ON tool_stock_movements
  FOR SELECT USING (organisation_id = auth.uid());

CREATE POLICY "Enable insert for own organisation" ON tool_stock_movements
  FOR INSERT WITH CHECK (organisation_id = auth.uid());

CREATE POLICY "Enable update for own organisation" ON tool_stock_movements
  FOR UPDATE USING (organisation_id = auth.uid());

CREATE POLICY "Enable delete for own organisation" ON tool_stock_movements
  FOR DELETE USING (organisation_id = auth.uid());

-- Recreate RLS policies for site_tool_transfers
ALTER TABLE site_tool_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for own organisation" ON site_tool_transfers
  FOR SELECT USING (organisation_id = auth.uid());

CREATE POLICY "Enable insert for own organisation" ON site_tool_transfers
  FOR INSERT WITH CHECK (organisation_id = auth.uid());

CREATE POLICY "Enable update for own organisation" ON site_tool_transfers
  FOR UPDATE USING (organisation_id = auth.uid());

CREATE POLICY "Enable delete for own organisation" ON site_tool_transfers
  FOR DELETE USING (organisation_id = auth.uid());
