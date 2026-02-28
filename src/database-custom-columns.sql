-- Add custom columns to quotation_items for scaling future use
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS custom1 TEXT;
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS custom2 TEXT;
