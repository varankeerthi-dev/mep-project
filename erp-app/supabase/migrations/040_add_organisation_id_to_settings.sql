-- Add organisation_id column to settings table to support multi-tenant configurations
ALTER TABLE settings ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE;

-- Drop the old primary unique constraint that forces global only keys
ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_key_key;

-- Create a new composite unique constraint so each organisation can have its own settings keys
ALTER TABLE settings ADD CONSTRAINT settings_key_organisation_id_key UNIQUE (key, organisation_id);
