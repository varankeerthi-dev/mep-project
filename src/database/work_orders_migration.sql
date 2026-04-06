-- Professional Work Order System - Database Migration
-- Run this in Supabase SQL Editor

-- Create the work orders table with professional features
CREATE TABLE IF NOT EXISTS subcontractor_work_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE NOT NULL,
  subcontractor_id UUID REFERENCES subcontractors(id) ON DELETE CASCADE NOT NULL,
  
  -- Header Information
  work_order_no VARCHAR(50) NOT NULL UNIQUE,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  status VARCHAR(50) DEFAULT 'Draft',
  
  -- Work Details
  work_description TEXT,
  site_location TEXT,
  start_date DATE,
  end_date DATE,
  
  -- Line Items (JSONB for flexibility)
  line_items JSONB DEFAULT '[]'::jsonb,
  -- Structure: [{ id, description, quantity, unit, rate, amount }]
  
  -- Financial Summary
  subtotal DECIMAL(15,2) DEFAULT 0,
  
  -- Tax Details
  cgst_percent DECIMAL(5,2) DEFAULT 0,
  sgst_percent DECIMAL(5,2) DEFAULT 0,
  igst_percent DECIMAL(5,2) DEFAULT 0,
  cgst_amount DECIMAL(15,2) DEFAULT 0,
  sgst_amount DECIMAL(15,2) DEFAULT 0,
  igst_amount DECIMAL(15,2) DEFAULT 0,
  
  -- Total
  total_amount DECIMAL(15,2) DEFAULT 0,
  
  -- Advance Payment
  advance_percent DECIMAL(5,2) DEFAULT 0,
  advance_amount DECIMAL(15,2) DEFAULT 0,
  
  -- Terms
  payment_terms TEXT,
  delivery_terms TEXT,
  
  -- Terms & Conditions (JSONB for ordering)
  terms_conditions JSONB DEFAULT '[]'::jsonb,
  -- Structure: [{ id, text, order }]
  
  -- Additional Info
  remarks TEXT,
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

-- Enable RLS
ALTER TABLE subcontractor_work_orders ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON subcontractor_work_orders;

-- Create policy
CREATE POLICY "Enable all access for authenticated users" 
ON subcontractor_work_orders 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_work_orders_org ON subcontractor_work_orders(organisation_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_sub ON subcontractor_work_orders(subcontractor_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_no ON subcontractor_work_orders(work_order_no);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON subcontractor_work_orders(status);
CREATE INDEX IF NOT EXISTS idx_work_orders_dates ON subcontractor_work_orders(issue_date, start_date, end_date);

-- Create a function to auto-update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_work_order_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS update_work_order_timestamp ON subcontractor_work_orders;
CREATE TRIGGER update_work_order_timestamp
BEFORE UPDATE ON subcontractor_work_orders
FOR EACH ROW
EXECUTE FUNCTION update_work_order_timestamp();

-- Add comments
COMMENT ON TABLE subcontractor_work_orders IS 'Professional work orders with line items, tax calculations, and PDF generation';
COMMENT ON COLUMN subcontractor_work_orders.line_items IS 'Array of line items: [{"id": "item-1", "description": "Civil Work", "quantity": 100, "unit": "Sq.ft", "rate": 50.00, "amount": 5000.00}]';
COMMENT ON COLUMN subcontractor_work_orders.terms_conditions IS 'Array of terms: [{"id": "term-1", "text": "Payment within 30 days", "order": 0}]';

-- Success message
SELECT 'Work Order table created successfully!' as result;
