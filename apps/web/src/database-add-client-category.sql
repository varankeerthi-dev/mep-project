-- Add category column to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'Active';

-- Update existing clients to have 'Active' category if not set
UPDATE clients SET category = 'Active' WHERE category IS NULL;

-- Enable RLS on the new column
