-- Fix SQL for Site Visits - Adds missing columns if they don't exist
-- Run this if you get "column does not exist" errors

-- Check and add organisation_id column to site_visits if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'site_visits' 
        AND column_name = 'organisation_id'
    ) THEN
        ALTER TABLE site_visits ADD COLUMN organisation_id UUID;
    END IF;
END $$;

-- Check and add postponed_reason column if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'site_visits' 
        AND column_name = 'postponed_reason'
    ) THEN
        ALTER TABLE site_visits ADD COLUMN postponed_reason TEXT;
    END IF;
END $$;

-- Check and add created_by column if missing  
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'site_visits' 
        AND column_name = 'created_by'
    ) THEN
        ALTER TABLE site_visits ADD COLUMN created_by VARCHAR(255);
    END IF;
END $$;

-- Check and add project_id column if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'site_visits' 
        AND column_name = 'project_id'
    ) THEN
        ALTER TABLE site_visits ADD COLUMN project_id UUID;
    END IF;
END $$;

-- Check and add updated_at column if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'site_visits' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE site_visits ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for site_visits updated_at
DROP TRIGGER IF EXISTS update_site_visits_updated_at ON site_visits;
CREATE TRIGGER update_site_visits_updated_at
    BEFORE UPDATE ON site_visits
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add any missing indexes
CREATE INDEX IF NOT EXISTS idx_site_visits_organisation_id ON site_visits(organisation_id);
CREATE INDEX IF NOT EXISTS idx_site_visits_client_id ON site_visits(client_id);
CREATE INDEX IF NOT EXISTS idx_site_visits_visit_date ON site_visits(visit_date);
CREATE INDEX IF NOT EXISTS idx_site_visits_status ON site_visits(status);

-- Insert default visit purposes if visit_purposes table is empty
INSERT INTO visit_purposes (name) 
SELECT * FROM (VALUES 
    ('Measurement'),
    ('Complaint'),
    ('Friendly Call'),
    ('Bill Submission'),
    ('Meeting'),
    ('Site Survey'),
    ('Installation Check'),
    ('Maintenance Visit')
) AS v(name)
WHERE NOT EXISTS (SELECT 1 FROM visit_purposes LIMIT 1);
