-- Migration 007: Add authorized_signatory_id to Credit Notes & Debit Notes

ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS authorized_signatory_id UUID;
ALTER TABLE debit_notes ADD COLUMN IF NOT EXISTS authorized_signatory_id UUID;

COMMENT ON COLUMN credit_notes.authorized_signatory_id IS 'References organisation.signatures JSON array';
COMMENT ON COLUMN debit_notes.authorized_signatory_id IS 'References organisation.signatures JSON array';
