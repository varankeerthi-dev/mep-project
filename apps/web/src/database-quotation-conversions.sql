-- Database migration for Quotation to Invoice/Proforma/Delivery Challan conversions
-- Run this in Supabase SQL Editor

-- Add proforma_id to invoices table
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS proforma_id UUID REFERENCES proforma_invoices(id);

-- Add quotation_id to invoices table (explicit tracking, though source_type/source_id already exists)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS quotation_id UUID REFERENCES quotation_header(id);

-- Add proforma_id to delivery_challans table
ALTER TABLE delivery_challans ADD COLUMN IF NOT EXISTS proforma_id UUID REFERENCES proforma_invoices(id);

-- Add quotation_id to delivery_challans table
ALTER TABLE delivery_challans ADD COLUMN IF NOT EXISTS quotation_id UUID REFERENCES quotation_header(id);

-- Add quotation_id to proforma_invoices table
ALTER TABLE proforma_invoices ADD COLUMN IF NOT EXISTS quotation_id UUID REFERENCES quotation_header(id);

-- Add status column to quotation_header if not exists (for tracking conversion status)
ALTER TABLE quotation_header ADD COLUMN IF NOT EXISTS conversion_status VARCHAR(50) DEFAULT 'pending';

-- Add status column to proforma_invoices if not exists (for tracking billing status)
ALTER TABLE proforma_invoices ADD COLUMN IF NOT EXISTS billing_status VARCHAR(50) DEFAULT 'pending';

-- Add comments for documentation
COMMENT ON COLUMN invoices.proforma_id IS 'Reference to proforma invoice if converted from proforma';
COMMENT ON COLUMN invoices.quotation_id IS 'Reference to quotation if converted from quotation';
COMMENT ON COLUMN delivery_challans.proforma_id IS 'Reference to proforma invoice if converted from proforma';
COMMENT ON COLUMN delivery_challans.quotation_id IS 'Reference to quotation if converted from quotation';
COMMENT ON COLUMN proforma_invoices.quotation_id IS 'Reference to quotation if converted from quotation';
COMMENT ON COLUMN quotation_header.conversion_status IS 'Status: pending, converted, partially_converted';
COMMENT ON COLUMN proforma_invoices.billing_status IS 'Status: pending, partially_billed, fully_billed';
