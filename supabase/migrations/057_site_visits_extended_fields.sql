-- Site Visits Extended Fields
-- Adds new columns for schedule & update data to site_visits table

ALTER TABLE site_visits
  -- Schedule fields (known before visit)
  ADD COLUMN IF NOT EXISTS po_wo_contract TEXT,
  ADD COLUMN IF NOT EXISTS project_manager_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS site_contact_person VARCHAR(255),
  ADD COLUMN IF NOT EXISTS site_contact_phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS site_contact_designation VARCHAR(255),
  ADD COLUMN IF NOT EXISTS visit_type VARCHAR(50) CHECK (visit_type IN ('Survey','Installation','Maintenance','Inspection','Repair','Handover','Consultation','Other')),
  ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'Standard' CHECK (priority IN ('Standard','Urgent','Emergency')),
  ADD COLUMN IF NOT EXISTS ppe_requirements TEXT,
  ADD COLUMN IF NOT EXISTS is_chargeable BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS access_restrictions TEXT,

  -- Update fields (recorded during/after visit)
  ADD COLUMN IF NOT EXISTS attendees JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS equipment_used TEXT,
  ADD COLUMN IF NOT EXISTS travel_time_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS total_man_hours NUMERIC(6,1),
  ADD COLUMN IF NOT EXISTS weather_conditions VARCHAR(100),
  ADD COLUMN IF NOT EXISTS safety_hazards TEXT,
  ADD COLUMN IF NOT EXISTS issues_found JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS recommendations TEXT,
  ADD COLUMN IF NOT EXISTS travel_expense NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS accommodation_expense NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS misc_expense NUMERIC(10,2);

-- Create a site_visit_photos table for attachments
CREATE TABLE IF NOT EXISTS site_visit_photos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  site_visit_id UUID REFERENCES site_visits(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name VARCHAR(255),
  file_type VARCHAR(50),
  caption TEXT,
  uploaded_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for site_visit_photos
ALTER TABLE site_visit_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_access" ON site_visit_photos;
CREATE POLICY "org_access" ON site_visit_photos
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM site_visits sv
      JOIN org_members om ON om.organisation_id = sv.organisation_id
      WHERE sv.id = site_visit_id
      AND om.user_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_site_visits_visit_type ON site_visits(visit_type);
CREATE INDEX IF NOT EXISTS idx_site_visits_priority ON site_visits(priority);
CREATE INDEX IF NOT EXISTS idx_site_visits_project_manager ON site_visits(project_manager_id);
CREATE INDEX IF NOT EXISTS idx_site_visit_photos_visit ON site_visit_photos(site_visit_id);
