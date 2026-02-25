-- Add uses_variant column to materials table
-- Run this in Supabase SQL Editor

ALTER TABLE materials ADD COLUMN IF NOT EXISTS uses_variant BOOLEAN DEFAULT false;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_materials_uses_variant ON materials(uses_variant) WHERE uses_variant = true;
