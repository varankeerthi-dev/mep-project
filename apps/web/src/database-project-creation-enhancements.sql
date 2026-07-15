-- Project Creation Enhancements Migration

-- 1. Create cost_centers table
CREATE TABLE IF NOT EXISTS cost_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  organisation_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for cost_centers
ALTER TABLE cost_centers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON cost_centers;
CREATE POLICY "Enable all access" ON cost_centers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create basic indexes for cost_centers
CREATE INDEX IF NOT EXISTS idx_cost_centers_org_id ON cost_centers(organisation_id);

-- 2. Alter projects table to add new fields
DO $$ 
BEGIN
  -- target_margin_percent
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'target_margin_percent') THEN
    ALTER TABLE projects ADD COLUMN target_margin_percent NUMERIC(5,2);
  END IF;
  
  -- liquidated_damages
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'liquidated_damages') THEN
    ALTER TABLE projects ADD COLUMN liquidated_damages TEXT;
  END IF;

  -- cost_center_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'cost_center_id') THEN
    ALTER TABLE projects ADD COLUMN cost_center_id UUID REFERENCES cost_centers(id);
  END IF;

  -- project_manager_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'project_manager_id') THEN
    ALTER TABLE projects ADD COLUMN project_manager_id UUID REFERENCES employees(id);
  END IF;

  -- site_engineer_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'site_engineer_id') THEN
    ALTER TABLE projects ADD COLUMN site_engineer_id UUID REFERENCES employees(id);
  END IF;

  -- site_address
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'site_address') THEN
    ALTER TABLE projects ADD COLUMN site_address TEXT;
  END IF;
END $$;
