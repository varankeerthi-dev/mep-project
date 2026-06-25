-- Add revision support to quotation_header
-- Run this in Supabase SQL Editor

-- Add revision_no column (if not exists)
ALTER TABLE quotation_header ADD COLUMN IF NOT EXISTS revision_no INTEGER DEFAULT 1;

-- Add revision_history JSONB column to store previous revision snapshots
ALTER TABLE quotation_header ADD COLUMN IF NOT EXISTS revision_history JSONB DEFAULT '[]'::jsonb;

-- Add index for revision_no
CREATE INDEX IF NOT EXISTS idx_quotation_header_revision ON quotation_header(revision_no);

COMMENT ON COLUMN quotation_header.revision_no IS 'Revision number of the quotation (1, 2, 3, etc.)';
COMMENT ON COLUMN quotation_header.revision_history IS 'JSON array storing previous revision snapshots for reference';