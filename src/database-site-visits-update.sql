-- Add new columns to site_visits table
ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS visited_by VARCHAR(100);
ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS purpose_of_visit TEXT;
ALTER TABLE site_visits ADD COLUMN IF NOT EXISTS follow_up_date DATE;

-- The site_visit_photos table already exists for photos
-- Create site_visit_documents table for document uploads
CREATE TABLE IF NOT EXISTS site_visit_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_visit_id UUID REFERENCES site_visits(id) ON DELETE CASCADE,
  document_name VARCHAR(255),
  document_url TEXT NOT NULL,
  document_type VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE site_visit_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access" ON site_visit_documents FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_site_visit_documents_visit_id ON site_visit_documents(site_visit_id);
