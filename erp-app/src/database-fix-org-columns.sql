-- Complete fix for missing columns in organisations table
-- Run this in Supabase SQL Editor

ALTER TABLE organisations 
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS email VARCHAR(255),
ADD COLUMN IF NOT EXISTS gstin VARCHAR(50),
ADD COLUMN IF NOT EXISTS pan VARCHAR(50),
ADD COLUMN IF NOT EXISTS tan VARCHAR(50),
ADD COLUMN IF NOT EXISTS msme_no VARCHAR(100),
ADD COLUMN IF NOT EXISTS website VARCHAR(255),
ADD COLUMN IF NOT EXISTS state VARCHAR(100) DEFAULT 'Maharashtra',
ADD COLUMN IF NOT EXISTS signatures JSONB DEFAULT '[]'::jsonb;

-- Ensure RLS is enabled and policies are correct
ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;

-- Refresh the schema cache if needed
-- (Usually automatic in Supabase, but you can also try toggling a policy or restarting the API)
