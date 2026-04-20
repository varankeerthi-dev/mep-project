-- Add organisation_id to client_purchase_orders and clients tables
-- Run this in Supabase SQL Editor

-- Add organisation_id to client_purchase_orders
ALTER TABLE client_purchase_orders ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE;

-- Add index for organisation_id
CREATE INDEX IF NOT EXISTS idx_client_purchase_orders_organisation_id ON client_purchase_orders(organisation_id);

-- Add organisation_id to clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE;

-- Add index for organisation_id
CREATE INDEX IF NOT EXISTS idx_clients_organisation_id ON clients(organisation_id);

-- Update RLS policies for client_purchase_orders
DROP POLICY IF EXISTS "Enable all access for client_purchase_orders" ON client_purchase_orders;
CREATE POLICY "Enable organisation access for client_purchase_orders" ON client_purchase_orders
  FOR ALL TO authenticated 
  USING (organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid()))
  WITH CHECK (organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid()));

-- Update RLS policies for clients
DROP POLICY IF EXISTS "Enable all access" ON clients;
CREATE POLICY "Enable organisation access for clients" ON clients
  FOR ALL TO authenticated 
  USING (organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid()))
  WITH CHECK (organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid()));

-- Update RLS policies for materials
DROP POLICY IF EXISTS "Enable read for authenticated" ON materials;
DROP POLICY IF EXISTS "Enable insert for authenticated" ON materials;
DROP POLICY IF EXISTS "Enable update for authenticated" ON materials;
DROP POLICY IF EXISTS "Enable delete for authenticated" ON materials;
CREATE POLICY "Enable organisation access for materials" ON materials
  FOR ALL TO authenticated 
  USING (organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid()))
  WITH CHECK (organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid()));
