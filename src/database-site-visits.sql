-- Site Visits Table
CREATE TABLE IF NOT EXISTS site_visits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id),
  visit_date DATE NOT NULL,
  visit_time VARCHAR(20),
  engineer_name VARCHAR(100),
  site_address TEXT,
  location VARCHAR(255),
  measurements TEXT,
  discussion_points TEXT,
  next_step VARCHAR(100),
  status VARCHAR(50) DEFAULT 'Pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE site_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access" ON site_visits FOR ALL USING (true) WITH CHECK (true);

-- Site Visit Photos Table
CREATE TABLE IF NOT EXISTS site_visit_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_visit_id UUID REFERENCES site_visits(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  description VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE site_visit_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access" ON site_visit_photos FOR ALL USING (true) WITH CHECK (true);

-- Create indexes
CREATE INDEX idx_site_visits_client_id ON site_visits(client_id);
CREATE INDEX idx_site_visits_visit_date ON site_visits(visit_date);
CREATE INDEX idx_site_visit_photos_visit_id ON site_visit_photos(site_visit_id);
