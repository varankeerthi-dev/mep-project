-- Site Visits Module SQL - Run this in Supabase SQL Editor
-- This SQL creates tables only if they don't exist

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create site_visits table
CREATE TABLE IF NOT EXISTS site_visits (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  project_id UUID,
  visit_date DATE NOT NULL,
  in_time TIME,
  out_time TIME,
  visited_by VARCHAR(255),
  engineer VARCHAR(255),
  site_address TEXT,
  measurements TEXT,
  purpose VARCHAR(255),
  discussion TEXT,
  next_step VARCHAR(255),
  follow_up_date DATE,
  location_url TEXT,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'completed', 'cancelled', 'postponed')),
  postponed_reason TEXT,
  created_by VARCHAR(255),
  organisation_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create visit_purposes lookup table
CREATE TABLE IF NOT EXISTS visit_purposes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default visit purposes if table is empty
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM visit_purposes LIMIT 1) THEN
    INSERT INTO visit_purposes (name) VALUES 
      ('Measurement'),
      ('Complaint'),
      ('Friendly Call'),
      ('Bill Submission'),
      ('Meeting'),
      ('Site Survey'),
      ('Installation Check'),
      ('Maintenance Visit');
  END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE site_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_purposes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid errors on re-run)
DROP POLICY IF EXISTS "Enable all access" ON site_visits;
DROP POLICY IF EXISTS "Enable all access" ON visit_purposes;

-- Create simple policies for development
CREATE POLICY "Enable all access" ON site_visits FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access" ON visit_purposes FOR ALL USING (true) WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_site_visits_client_id ON site_visits(client_id);
CREATE INDEX IF NOT EXISTS idx_site_visits_visit_date ON site_visits(visit_date);
CREATE INDEX IF NOT EXISTS idx_site_visits_status ON site_visits(status);
CREATE INDEX IF NOT EXISTS idx_site_visits_organisation_id ON site_visits(organisation_id);
CREATE INDEX IF NOT EXISTS idx_visit_purposes_name ON visit_purposes(name);

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
