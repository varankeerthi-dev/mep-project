-- Revision Management Migration
-- Adds revision support to proforma_invoices and invoices tables
-- Run this in Supabase SQL Editor

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. proforma_invoices
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE proforma_invoices ADD COLUMN IF NOT EXISTS revision_no INTEGER DEFAULT 1;
ALTER TABLE proforma_invoices ADD COLUMN IF NOT EXISTS revision_history JSONB DEFAULT '[]'::jsonb;
ALTER TABLE proforma_invoices ADD COLUMN IF NOT EXISTS revision_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_proforma_invoices_revision ON proforma_invoices(revision_no);

COMMENT ON COLUMN proforma_invoices.revision_no IS 'Revision number (1, 2, 3, etc.). Bumped on each explicit save of an existing document.';
COMMENT ON COLUMN proforma_invoices.revision_history IS 'JSON array of previous revision snapshots for reference / comparison';
COMMENT ON COLUMN proforma_invoices.revision_reason IS 'Mandatory reason for the latest revision (required when revision_no > 1)';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. invoices
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS revision_no INTEGER DEFAULT 1;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS revision_history JSONB DEFAULT '[]'::jsonb;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS revision_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_invoices_revision ON invoices(revision_no);

COMMENT ON COLUMN invoices.revision_no IS 'Revision number (1, 2, 3, etc.). Bumped on each explicit save of an existing document.';
COMMENT ON COLUMN invoices.revision_history IS 'JSON array of previous revision snapshots for reference / comparison';
COMMENT ON COLUMN invoices.revision_reason IS 'Mandatory reason for the latest revision (required when revision_no > 1)';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. Backfill existing documents with revision_no = 1
-- ═══════════════════════════════════════════════════════════════════════════════
UPDATE proforma_invoices SET revision_no = 1 WHERE revision_no IS NULL;
UPDATE invoices SET revision_no = 1 WHERE revision_no IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. Verify
-- ═══════════════════════════════════════════════════════════════════════════════
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name IN ('proforma_invoices', 'invoices')
  AND column_name IN ('revision_no', 'revision_history', 'revision_reason')
ORDER BY table_name, column_name;
