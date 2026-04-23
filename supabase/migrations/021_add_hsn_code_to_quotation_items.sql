-- Add hsn_code column to quotation_items table
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(50);
