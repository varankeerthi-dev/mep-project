-- Fix for missing msme_no column in organisations table
-- Run this in Supabase SQL Editor

ALTER TABLE organisations 
ADD COLUMN IF NOT EXISTS msme_no VARCHAR(100);

-- Refresh the schema cache
-- (Usually automatic in Supabase, but you can also try toggling a policy or restarting the API)
