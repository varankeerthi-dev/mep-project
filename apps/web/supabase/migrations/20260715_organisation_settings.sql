ALTER TABLE organisations ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;
