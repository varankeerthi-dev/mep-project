-- Site Reports Module SQL - Run this in Supabase SQL Editor
-- Creates tables for daily site reports with all related child tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create site_reports main table
CREATE TABLE IF NOT EXISTS site_reports (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  organization_id UUID,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  project_id UUID,
  report_date DATE NOT NULL,
  total_manpower VARCHAR(50),
  skilled_manpower VARCHAR(50),
  unskilled_manpower VARCHAR(50),
  start_time TIME,
  end_time TIME,
  planned_progress TEXT,
  actual_progress TEXT,
  percent_complete VARCHAR(10),
  equipment_on_site TEXT,
  breakdown_issues TEXT,
  toolbox_meeting BOOLEAN DEFAULT false,
  ppe_followed BOOLEAN DEFAULT false,
  inspection_status VARCHAR(50) DEFAULT 'Pending',
  satisfied_percent VARCHAR(10),
  rework_required_reason TEXT,
  is_rework BOOLEAN DEFAULT false,
  rework_reason TEXT,
  rework_start TIME,
  rework_end TIME,
  rework_material_used TEXT,
  rework_total_manpower VARCHAR(50),
  doc_type VARCHAR(50) DEFAULT 'DC',
  doc_no VARCHAR(100),
  received_signature VARCHAR(50) DEFAULT 'Pending',
  client_req_details TEXT,
  quote_to_be_sent BOOLEAN DEFAULT false,
  mail_received BOOLEAN DEFAULT false,
  pm_status VARCHAR(50) DEFAULT 'Pending',
  material_arrangement VARCHAR(100) DEFAULT 'Pending',
  work_plan_next_day TEXT,
  special_instructions TEXT,
  issues_faced TEXT,
  is_filed BOOLEAN DEFAULT false,
  tools_locked BOOLEAN DEFAULT false,
  site_pictures_status VARCHAR(50) DEFAULT 'Taken',
  engineer_name VARCHAR(255),
  signature_date VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create sub_contractors child table
CREATE TABLE IF NOT EXISTS sub_contractors (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  organization_id UUID,
  report_id UUID REFERENCES site_reports(id) ON DELETE CASCADE,
  name VARCHAR(255),
  count VARCHAR(50),
  start_time TIME,
  end_time TIME,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create work_carried_out child table
CREATE TABLE IF NOT EXISTS work_carried_out (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  organization_id UUID,
  report_id UUID REFERENCES site_reports(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create milestones_completed child table
CREATE TABLE IF NOT EXISTS milestones_completed (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  organization_id UUID,
  report_id UUID REFERENCES site_reports(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create site_report_photos table for uploaded images
CREATE TABLE IF NOT EXISTS site_report_photos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  organization_id UUID,
  report_id UUID REFERENCES site_reports(id) ON DELETE CASCADE,
  file_name VARCHAR(255),
  file_path TEXT,
  file_size INTEGER,
  mime_type VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security on all tables
ALTER TABLE site_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_contractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_carried_out ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones_completed ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_report_photos ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable all access" ON site_reports;
DROP POLICY IF EXISTS "Enable all access" ON sub_contractors;
DROP POLICY IF EXISTS "Enable all access" ON work_carried_out;
DROP POLICY IF EXISTS "Enable all access" ON milestones_completed;
DROP POLICY IF EXISTS "Enable all access" ON site_report_photos;

-- Create simple policies for development (allow all access)
CREATE POLICY "Enable all access" ON site_reports FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access" ON sub_contractors FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access" ON work_carried_out FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access" ON milestones_completed FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access" ON site_report_photos FOR ALL USING (true) WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_site_reports_organization_id ON site_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_site_reports_client_id ON site_reports(client_id);
CREATE INDEX IF NOT EXISTS idx_site_reports_project_id ON site_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_site_reports_report_date ON site_reports(report_date);
CREATE INDEX IF NOT EXISTS idx_sub_contractors_report_id ON sub_contractors(report_id);
CREATE INDEX IF NOT EXISTS idx_work_carried_out_report_id ON work_carried_out(report_id);
CREATE INDEX IF NOT EXISTS idx_milestones_completed_report_id ON milestones_completed(report_id);
CREATE INDEX IF NOT EXISTS idx_site_report_photos_report_id ON site_report_photos(report_id);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for site_reports updated_at
DROP TRIGGER IF EXISTS update_site_reports_updated_at ON site_reports;
CREATE TRIGGER update_site_reports_updated_at
    BEFORE UPDATE ON site_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create storage bucket for site report photos (if using Supabase Storage)
-- Note: This needs to be done in the Supabase Dashboard or via Storage API
-- INSERT INTO storage.buckets (id, name, public) VALUES ('site-report-photos', 'site-report-photos', false);
