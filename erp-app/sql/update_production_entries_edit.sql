-- Migration: Add status and tracking to production_entries for edit/reversal tracking

ALTER TABLE production_entries
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
ADD COLUMN IF NOT EXISTS superseded_by uuid REFERENCES production_entries(id),
ADD COLUMN IF NOT EXISTS reversal_for uuid REFERENCES production_entries(id);

-- Optional: Index on status for faster querying of active entries
CREATE INDEX IF NOT EXISTS idx_production_entries_status ON production_entries(status);
