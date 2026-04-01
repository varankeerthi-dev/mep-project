-- Fix missing columns for "Client -> Create New" functionality
-- Run this script in your Supabase SQL Editor

ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS organisation_id UUID,
ADD COLUMN IF NOT EXISTS about_client TEXT,
ADD COLUMN IF NOT EXISTS contacts JSONB DEFAULT '[]'::jsonb;
