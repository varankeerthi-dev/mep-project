-- Add variant support to material tables
-- Run this in Supabase SQL Editor

-- Material Inward table
ALTER TABLE material_inward ADD COLUMN IF NOT EXISTS warehouse_id UUID;
ALTER TABLE material_inward ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES company_variants(id);
ALTER TABLE material_inward ADD COLUMN IF NOT EXISTS invoice_date DATE;
ALTER TABLE material_inward ADD COLUMN IF NOT EXISTS received_date DATE;
ALTER TABLE material_inward ADD COLUMN IF NOT EXISTS received_by VARCHAR(255);
ALTER TABLE material_inward ADD COLUMN IF NOT EXISTS acknowledged_by VARCHAR(255);
ALTER TABLE material_inward ADD COLUMN IF NOT EXISTS supply_type VARCHAR(50) DEFAULT 'WAREHOUSE';
ALTER TABLE material_inward ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);

-- Material Inward Items table
ALTER TABLE material_inward_items ADD COLUMN IF NOT EXISTS material_id UUID REFERENCES materials(id);
ALTER TABLE material_inward_items ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES company_variants(id);
ALTER TABLE material_inward_items ADD COLUMN IF NOT EXISTS warehouse_id UUID;
ALTER TABLE material_inward_items ADD COLUMN IF NOT EXISTS supply_type VARCHAR(50) DEFAULT 'WAREHOUSE';
ALTER TABLE material_inward_items ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);

-- Material Outward table
ALTER TABLE material_outward ADD COLUMN IF NOT EXISTS warehouse_id UUID;
ALTER TABLE material_outward ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES company_variants(id);

-- Material Outward Items table
ALTER TABLE material_outward_items ADD COLUMN IF NOT EXISTS material_id UUID REFERENCES materials(id);
ALTER TABLE material_outward_items ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES company_variants(id);

-- ============================================
-- STOCK TRANSFER TABLES
-- ============================================
CREATE TABLE IF NOT EXISTS stock_transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES organisations(id),
  transfer_no VARCHAR(50) UNIQUE NOT NULL,
  transfer_date DATE NOT NULL,
  from_warehouse_id UUID REFERENCES warehouses(id),
  to_warehouse_id UUID REFERENCES warehouses(id),
  vehicle_no VARCHAR(50),
  transporter_name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'DRAFT',
  remarks TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  dispatched_by_user_id UUID REFERENCES auth.users(id),
  dispatched_at TIMESTAMP WITH TIME ZONE,
  received_date DATE,
  received_by_user_id UUID REFERENCES auth.users(id),
  received_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stock_transfers_all_access" ON stock_transfers;
CREATE POLICY "stock_transfers_all_access" ON stock_transfers FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS stock_transfer_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transfer_id UUID REFERENCES stock_transfers(id) ON DELETE CASCADE,
  item_id UUID REFERENCES materials(id),
  company_variant_id UUID REFERENCES company_variants(id),
  quantity DECIMAL(12,3) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE stock_transfer_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stock_transfer_items_all_access" ON stock_transfer_items;
CREATE POLICY "stock_transfer_items_all_access" ON stock_transfer_items FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_stock_transfers_date ON stock_transfers(transfer_date);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_status ON stock_transfers(status);
CREATE INDEX IF NOT EXISTS idx_stock_transfer_items_transfer ON stock_transfer_items(transfer_id);

-- ============================================
-- DELIVERY CHALLAN ENHANCEMENTS
-- ============================================
-- Add source_type to delivery_challans
ALTER TABLE delivery_challans ADD COLUMN IF NOT EXISTS source_type VARCHAR(50) DEFAULT 'WAREHOUSE';
ALTER TABLE delivery_challans ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses(id);

-- Add E-Way Bill fields
ALTER TABLE delivery_challans ADD COLUMN IF NOT EXISTS eway_bill_no VARCHAR(50);
ALTER TABLE delivery_challans ADD COLUMN IF NOT EXISTS eway_bill_date DATE;
ALTER TABLE delivery_challans ADD COLUMN IF NOT EXISTS eway_valid_till DATE;

-- Add Ship To fields
ALTER TABLE delivery_challans ADD COLUMN IF NOT EXISTS ship_to_name VARCHAR(255);
ALTER TABLE delivery_challans ADD COLUMN IF NOT EXISTS ship_to_address_line1 TEXT;
ALTER TABLE delivery_challans ADD COLUMN IF NOT EXISTS ship_to_address_line2 TEXT;
ALTER TABLE delivery_challans ADD COLUMN IF NOT EXISTS ship_to_city VARCHAR(100);
ALTER TABLE delivery_challans ADD COLUMN IF NOT EXISTS ship_to_state VARCHAR(100);
ALTER TABLE delivery_challans ADD COLUMN IF NOT EXISTS ship_to_pincode VARCHAR(20);
ALTER TABLE delivery_challans ADD COLUMN IF NOT EXISTS ship_to_gstin VARCHAR(50);
ALTER TABLE delivery_challans ADD COLUMN IF NOT EXISTS ship_to_contact VARCHAR(100);

-- Add status field
ALTER TABLE delivery_challans ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'DRAFT';

-- Add variant_id to delivery_challan_items
ALTER TABLE delivery_challan_items ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES company_variants(id);
