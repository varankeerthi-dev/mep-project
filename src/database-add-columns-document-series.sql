-- Add missing columns to document_series table for multi-tenant support
-- Run this in Supabase SQL editor

-- Check if columns exist, if not add them
ALTER TABLE document_series ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES organisations(id);
ALTER TABLE document_series ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_document_series_organisation ON document_series(organisation_id);
CREATE INDEX IF NOT EXISTS idx_document_series_default ON document_series(is_default);

-- Enable RLS
ALTER TABLE document_series ENABLE ROW LEVEL SECURITY;

-- Create policy for organisation-based access
DROP POLICY IF EXISTS "document_series_organisation_policy" ON document_series;
CREATE POLICY "document_series_organisation_policy" ON document_series FOR ALL USING (organisation_id = current_setting('app.current_organisation_id', true)::UUID);

-- Update existing records if needed
-- UPDATE document_series SET is_default = false WHERE is_default IS NULL;