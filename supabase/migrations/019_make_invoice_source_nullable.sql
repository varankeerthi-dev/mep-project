-- Make source_id nullable and add 'direct' to source_type check for direct invoices

ALTER TABLE invoices
ALTER COLUMN source_type DROP NOT NULL,
ALTER COLUMN source_id DROP NOT NULL;

-- Add constraint to allow 'direct' as a source type
ALTER TABLE invoices
DROP CONSTRAINT IF EXISTS invoices_source_type_check;

ALTER TABLE invoices
ADD CONSTRAINT invoices_source_type_check
CHECK (source_type IN ('quotation', 'challan', 'po', 'direct'));
