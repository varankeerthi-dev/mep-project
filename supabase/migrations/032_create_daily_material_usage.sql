-- Create daily_material_usage table for tracking daily material consumption
CREATE TABLE IF NOT EXISTS daily_material_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL,
  item_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES company_variants(id) ON DELETE SET NULL,
  quantity_used DECIMAL(15, 2) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL,
  activity TEXT,
  logged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_daily_material_usage_project ON daily_material_usage(project_id);
CREATE INDEX IF NOT EXISTS idx_daily_material_usage_organisation ON daily_material_usage(organisation_id);
CREATE INDEX IF NOT EXISTS idx_daily_material_usage_date ON daily_material_usage(usage_date);
CREATE INDEX IF NOT EXISTS idx_daily_material_usage_item ON daily_material_usage(item_id);
CREATE INDEX IF NOT EXISTS idx_daily_material_usage_project_date ON daily_material_usage(project_id, usage_date);

-- Enable RLS
ALTER TABLE daily_material_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view daily material usage" ON daily_material_usage;
DROP POLICY IF EXISTS "Users can insert daily material usage" ON daily_material_usage;
DROP POLICY IF EXISTS "Users can update daily material usage" ON daily_material_usage;
DROP POLICY IF EXISTS "Users can delete daily material usage" ON daily_material_usage;

-- Users can view usage logs for their organisations
CREATE POLICY "Users can view daily material usage"
  ON daily_material_usage FOR SELECT
  TO authenticated
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_organisations
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Users can insert usage logs for their organisations
CREATE POLICY "Users can insert daily material usage"
  ON daily_material_usage FOR INSERT
  TO authenticated
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM user_organisations
      WHERE user_id = auth.uid() AND status = 'active'
    )
    AND logged_by = auth.uid()
  );

-- Users can update their own usage logs
CREATE POLICY "Users can update daily material usage"
  ON daily_material_usage FOR UPDATE
  TO authenticated
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_organisations
      WHERE user_id = auth.uid() AND status = 'active'
    )
    AND logged_by = auth.uid()
  );

-- Users can delete their own usage logs
CREATE POLICY "Users can delete daily material usage"
  ON daily_material_usage FOR DELETE
  TO authenticated
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_organisations
      WHERE user_id = auth.uid() AND status = 'active'
    )
    AND logged_by = auth.uid()
  );

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_daily_material_usage_updated_at ON daily_material_usage;
CREATE TRIGGER update_daily_material_usage_updated_at
  BEFORE UPDATE ON daily_material_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
