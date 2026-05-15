-- Migration 011: Add description column to all document item tables

ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE dc_items ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE credit_note_items ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE debit_note_items ADD COLUMN IF NOT EXISTS description TEXT;

COMMENT ON COLUMN invoice_items.description IS 'Manual per-item description, document-specific';
COMMENT ON COLUMN quotation_items.description IS 'Manual per-item description, document-specific';
COMMENT ON COLUMN dc_items.description IS 'Manual per-item description, document-specific';
COMMENT ON COLUMN credit_note_items.description IS 'Manual per-item description, document-specific';
COMMENT ON COLUMN debit_note_items.description IS 'Manual per-item description, document-specific';
