-- Add conversion tracking columns to quotation_header
ALTER TABLE quotation_header
ADD COLUMN IF NOT EXISTS converted_to_id UUID,
ADD COLUMN IF NOT EXISTS converted_to_type VARCHAR(50);

-- Add conversion tracking columns to delivery_challans
ALTER TABLE delivery_challans
ADD COLUMN IF NOT EXISTS converted_to_id UUID,
ADD COLUMN IF NOT EXISTS converted_to_type VARCHAR(50);

-- Note: proforma_invoices already has converted_invoice_id column
-- We'll add converted_to_type for consistency
ALTER TABLE proforma_invoices
ADD COLUMN IF NOT EXISTS converted_to_type VARCHAR(50);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_quotation_header_converted_to ON quotation_header(converted_to_id);
CREATE INDEX IF NOT EXISTS idx_delivery_challans_converted_to ON delivery_challans(converted_to_id);
CREATE INDEX IF NOT EXISTS idx_proforma_invoices_converted_to ON proforma_invoices(converted_invoice_id);
