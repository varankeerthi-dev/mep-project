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

-- Create policy for organisation-level access
CREATE POLICY "Users can manage document_series" ON document_series
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.organisation_id = (
        SELECT organisation_id FROM org_members
        WHERE user_id = auth.uid()
        LIMIT 1
      )
      AND org_members.user_id = auth.uid()
    )
  );

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_document_series_name ON document_series(series_name);
CREATE INDEX IF NOT EXISTS idx_document_series_default ON document_series(is_default) WHERE is_default = true;

-- Add current_number column if table exists (for migration)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'document_series' AND column_name = 'current_number') THEN
    -- Column already exists
  ELSE
    ALTER TABLE document_series ADD COLUMN current_number INTEGER DEFAULT 1;
  END IF;
END $$;
