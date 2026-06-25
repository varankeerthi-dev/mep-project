-- Run this script in Supabase SQL Editor to fix quotation line items issue
-- This will add all missing columns to the quotation_items table

-- Add missing columns to quotation_items table
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES organisations(id);
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS make VARCHAR(100);
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS base_rate_snapshot DECIMAL(15,2);
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS applied_discount_percent DECIMAL(5,2);
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS is_override BOOLEAN DEFAULT false;
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS final_rate_snapshot DECIMAL(15,2);
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS custom1 TEXT;
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS custom2 TEXT;
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS sac_code VARCHAR(50);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_quotation_items_organisation ON quotation_items(organisation_id);

-- Update existing rows to set organisation_id based on quotation_header relationship
UPDATE quotation_items qi
SET organisation_id = (
  SELECT qh.organisation_id 
  FROM quotation_header qh 
  WHERE qh.id = qi.quotation_id 
  LIMIT 1
)
WHERE qi.organisation_id IS NULL;

-- Enable RLS and add policy
ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quotation_items_organisation_policy" ON quotation_items;
CREATE POLICY "quotation_items_organisation_policy" ON quotation_items FOR ALL USING (organisation_id = current_setting('app.current_organisation_id', true)::UUID);

-- Verify the changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'quotation_items' 
ORDER BY ordinal_position;
