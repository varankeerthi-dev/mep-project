-- 081_add_job_cards_missing_columns.sql
-- Adds missing columns to job_cards table to support issuing, completion, and actual qty tracking

ALTER TABLE job_cards 
  ADD COLUMN IF NOT EXISTS actual_qty DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS yield_pct DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS issued_to UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS issued_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
