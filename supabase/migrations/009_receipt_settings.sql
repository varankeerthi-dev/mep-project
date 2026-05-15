-- Migration 009: Add receipt number settings to document_settings

ALTER TABLE document_settings
  ADD COLUMN IF NOT EXISTS receipt_prefix VARCHAR(20) DEFAULT 'REC',
  ADD COLUMN IF NOT EXISTS receipt_start_number INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS receipt_suffix VARCHAR(20) DEFAULT '',
  ADD COLUMN IF NOT EXISTS receipt_padding INTEGER DEFAULT 4,
  ADD COLUMN IF NOT EXISTS receipt_current_number INTEGER DEFAULT 1;
