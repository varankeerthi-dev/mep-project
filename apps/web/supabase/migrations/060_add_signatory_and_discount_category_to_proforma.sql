-- Migration 060: Add authorized_signatory_id to proforma_invoices and discount_category_id to proforma_items

-- Add authorized_signatory_id to proforma_invoices
ALTER TABLE proforma_invoices ADD COLUMN IF NOT EXISTS authorized_signatory_id UUID;

-- Add discount_category_id to proforma_items
ALTER TABLE proforma_items ADD COLUMN IF NOT EXISTS discount_category_id UUID REFERENCES discount_categories(id);

-- Add comments for documentation
COMMENT ON COLUMN proforma_invoices.authorized_signatory_id IS 'References organisation.signatures JSON array';
COMMENT ON COLUMN proforma_items.discount_category_id IS 'References discount_categories(id) for category-based pricing';
