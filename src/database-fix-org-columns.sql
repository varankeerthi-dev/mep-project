-- Fix for missing columns in organisations table
-- Run this in Supabase SQL Editor

ALTER TABLE organisations 
ADD COLUMN IF NOT EXISTS gstin VARCHAR(50),
ADD COLUMN IF NOT EXISTS pan VARCHAR(50),
ADD COLUMN IF NOT EXISTS tan VARCHAR(50),
ADD COLUMN IF NOT EXISTS msme_no VARCHAR(100),
ADD COLUMN IF NOT EXISTS website VARCHAR(255),
ADD COLUMN IF NOT EXISTS state VARCHAR(100) DEFAULT 'Maharashtra';

-- Refresh the schema cache if needed
-- (Usually automatic in Supabase, but you can also try toggling a policy or restarting the API)
