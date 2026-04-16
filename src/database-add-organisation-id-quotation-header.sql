-- Add organisation_id column to quotation_header for multi-tenant support
ALTER TABLE quotation_header ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES organisations(id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_quotation_header_organisation ON quotation_header(organisation_id);

-- Update existing rows to set organisation_id based on client/project relationship
UPDATE quotation_header qh
SET organisation_id = COALESCE(
  (SELECT c.organisation_id FROM clients c WHERE c.id = qh.client_id LIMIT 1),
  (SELECT p.organisation_id FROM projects p WHERE p.id = qh.project_id LIMIT 1)
)
WHERE qh.organisation_id IS NULL;

-- Enable RLS and add policy
ALTER TABLE quotation_header ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quotation_header_organisation_policy" ON quotation_header;
CREATE POLICY "quotation_header_organisation_policy" ON quotation_header FOR ALL USING (organisation_id = current_setting('app.current_organisation_id', true)::UUID);