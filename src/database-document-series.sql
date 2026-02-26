-- Create document_series table for Transaction Number Series
-- Run this in Supabase SQL Editor

-- Create the table
CREATE TABLE IF NOT EXISTS document_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_name TEXT NOT NULL,
  financial_year TEXT DEFAULT 'auto',
  is_default BOOLEAN DEFAULT false,
  current_number INTEGER DEFAULT 1,
  configs JSONB DEFAULT '{}'::jsonb,
  has_transactions BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE document_series ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can manage document_series" ON document_series;

-- Create a simpler policy - allow all authenticated users (you can tighten this later)
CREATE POLICY "Allow all authenticated" ON document_series
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add index for faster queries
DROP INDEX IF EXISTS idx_document_series_name;
DROP INDEX IF EXISTS idx_document_series_default;
CREATE INDEX idx_document_series_name ON document_series(series_name);
CREATE INDEX idx_document_series_default ON document_series(is_default) WHERE is_default = true;

-- Add current_number column if table exists (for migration)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'document_series' AND column_name = 'current_number') THEN
    ALTER TABLE document_series ADD COLUMN current_number INTEGER DEFAULT 1;
  END IF;
END $$;
