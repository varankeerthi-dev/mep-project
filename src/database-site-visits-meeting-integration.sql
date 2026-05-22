-- Add meeting integration columns to site_visits table
-- Run this in Supabase SQL Editor

-- Add column to mark site visit as a client meeting
ALTER TABLE site_visits 
ADD COLUMN IF NOT EXISTS is_client_meeting BOOLEAN DEFAULT false;

-- Add column to link to the created meeting
ALTER TABLE site_visits 
ADD COLUMN IF NOT EXISTS meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL;

-- Create index for meeting_id
CREATE INDEX IF NOT EXISTS idx_site_visits_meeting_id ON site_visits(meeting_id);
