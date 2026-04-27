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

-- Security definer function to check if user belongs to organisation (bypasses RLS)
CREATE OR REPLACE FUNCTION user_belongs_to_organisation(p_user_id UUID, p_organisation_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM user_organisations 
        WHERE user_organisations.user_id = user_belongs_to_organisation.p_user_id
        AND user_organisations.organisation_id = user_belongs_to_organisation.p_organisation_id
        AND user_organisations.status = 'active'
    );
$$ LANGUAGE SQL SECURITY DEFINER;

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
    user_belongs_to_organisation(auth.uid(), organisation_id)
  );

-- Users can insert usage logs (simplified to avoid recursion)
CREATE POLICY "Users can insert daily material usage"
  ON daily_material_usage FOR INSERT
  TO authenticated
  WITH CHECK (
    user_belongs_to_organisation(auth.uid(), organisation_id)
    AND logged_by = auth.uid()
  );

-- Users can update their own usage logs
CREATE POLICY "Users can update daily material usage"
  ON daily_material_usage FOR UPDATE
  TO authenticated
  USING (
    user_belongs_to_organisation(auth.uid(), organisation_id)
    AND logged_by = auth.uid()
  );

-- Users can delete their own usage logs
CREATE POLICY "Users can delete daily material usage"
  ON daily_material_usage FOR DELETE
  TO authenticated
  USING (
    user_belongs_to_organisation(auth.uid(), organisation_id)
    AND logged_by = auth.uid()
  );

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_daily_material_usage_updated_at ON daily_material_usage;
CREATE TRIGGER update_daily_material_usage_updated_at
  BEFORE UPDATE ON daily_material_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to log daily material usage (bypasses RLS issues)
CREATE OR REPLACE FUNCTION log_daily_usage(
  p_project_id UUID,
  p_organisation_id UUID,
  p_usage_date DATE,
  p_item_id UUID,
  p_variant_id UUID,
  p_quantity_used DECIMAL,
  p_unit TEXT,
  p_activity TEXT,
  p_remarks TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_new_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  INSERT INTO daily_material_usage (
    project_id,
    organisation_id,
    usage_date,
    item_id,
    variant_id,
    quantity_used,
    unit,
    activity,
    logged_by,
    remarks
  )
  VALUES (
    p_project_id,
    p_organisation_id,
    p_usage_date,
    p_item_id,
    p_variant_id,
    p_quantity_used,
    p_unit,
    p_activity,
    v_user_id,
    p_remarks
  )
  RETURNING id INTO v_new_id;
  
  RETURN v_new_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION log_daily_usage TO authenticated;
