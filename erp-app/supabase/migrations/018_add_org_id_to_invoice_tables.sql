-- Add organisation_id to invoice_items and invoice_materials for proper data isolation

ALTER TABLE invoice_items
ADD COLUMN IF NOT EXISTS organisation_id UUID NOT NULL DEFAULT gen_random_uuid() REFERENCES organisations(id) ON DELETE CASCADE;

ALTER TABLE invoice_materials
ADD COLUMN IF NOT EXISTS organisation_id UUID NOT NULL DEFAULT gen_random_uuid() REFERENCES organisations(id) ON DELETE CASCADE;

-- Update existing records to use the organisation from their parent invoice
UPDATE invoice_items ii
SET organisation_id = i.organisation_id
FROM invoices i
WHERE ii.invoice_id = i.id AND ii.organisation_id IS NULL;

UPDATE invoice_materials im
SET organisation_id = i.organisation_id
FROM invoices i
WHERE im.invoice_id = i.id AND im.organisation_id IS NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_invoice_items_organisation_id ON invoice_items(organisation_id);
CREATE INDEX IF NOT EXISTS idx_invoice_materials_organisation_id ON invoice_materials(organisation_id);
