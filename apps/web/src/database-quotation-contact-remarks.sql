-- Quotation contact + remarks migration
-- Run this in Supabase SQL Editor

ALTER TABLE IF EXISTS quotation_header
  ADD COLUMN IF NOT EXISTS contact_no VARCHAR(30);

ALTER TABLE IF EXISTS quotation_header
  ADD COLUMN IF NOT EXISTS remarks TEXT;

-- Optional backfill: move old reference into remarks where remarks is empty
UPDATE quotation_header
SET remarks = reference
WHERE (remarks IS NULL OR trim(remarks) = '')
  AND reference IS NOT NULL;
