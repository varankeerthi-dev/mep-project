-- Add sub-total support to quotation_items
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS is_subtotal BOOLEAN DEFAULT false;
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS subtotal_label VARCHAR(255);

-- Create index
CREATE INDEX IF NOT EXISTS idx_quotation_items_subtotal ON quotation_items(is_subtotal);