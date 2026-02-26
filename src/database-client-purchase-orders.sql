-- Client Purchase Orders Module
-- Run this in Supabase SQL Editor

-- Create client_purchase_orders table
CREATE TABLE IF NOT EXISTS client_purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE RESTRICT NOT NULL,
  po_number VARCHAR(50) NOT NULL,
  po_date DATE NOT NULL,
  po_expiry_date DATE,
  po_total_value DECIMAL(15,2) NOT NULL,
  po_utilized_value DECIMAL(15,2) DEFAULT 0,
  po_available_value DECIMAL(15,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'Open' CHECK (status IN ('Open', 'Partially Billed', 'Closed')),
  remarks TEXT,
  attachment_url TEXT,
  attachment_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE client_purchase_orders ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Enable all access for client_purchase_orders" ON client_purchase_orders;

-- Create policy - allow all authenticated users (you can tighten this later)
CREATE POLICY "Enable all access for client_purchase_orders" ON client_purchase_orders
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_client_purchase_orders_client_id ON client_purchase_orders(client_id);
CREATE INDEX IF NOT EXISTS idx_client_purchase_orders_po_number ON client_purchase_orders(po_number);
CREATE INDEX IF NOT EXISTS idx_client_purchase_orders_status ON client_purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_client_purchase_orders_po_date ON client_purchase_orders(po_date);

-- Create function to auto-update available value and status
CREATE OR REPLACE FUNCTION update_po_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate available value
  NEW.po_available_value := NEW.po_total_value - COALESCE(NEW.po_utilized_value, 0);
  
  -- Prevent negative available value
  IF NEW.po_available_value < 0 THEN
    RAISE EXCEPTION 'Available value cannot be negative';
  END IF;
  
  -- Auto-update status based on utilization
  IF NEW.po_utilized_value = 0 OR NEW.po_utilized_value IS NULL THEN
    NEW.status := 'Open';
  ELSIF NEW.po_available_value > 0 THEN
    NEW.status := 'Partially Billed';
  ELSE
    NEW.status := 'Closed';
  END IF;
  
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update status
DROP TRIGGER IF EXISTS trigger_update_po_status ON client_purchase_orders;
CREATE TRIGGER trigger_update_po_status
  BEFORE INSERT OR UPDATE ON client_purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_po_status();

-- Add unique constraint for po_number per client
ALTER TABLE client_purchase_orders ADD CONSTRAINT unique_po_number_per_client UNIQUE (client_id, po_number);
