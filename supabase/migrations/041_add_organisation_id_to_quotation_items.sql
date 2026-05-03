-- Add organisation_id column to quotation_items table for multi-tenant support
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES organisations(id);

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
