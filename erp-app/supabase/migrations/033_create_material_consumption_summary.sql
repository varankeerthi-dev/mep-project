-- Create material_consumption_summary table for aggregated consumption data
CREATE TABLE IF NOT EXISTS material_consumption_summary (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES company_variants(id) ON DELETE SET NULL,
  planned_qty DECIMAL(15, 2) NOT NULL DEFAULT 0,
  received_qty DECIMAL(15, 2) NOT NULL DEFAULT 0,
  used_qty DECIMAL(15, 2) NOT NULL DEFAULT 0,
  remaining_qty DECIMAL(15, 2) NOT NULL DEFAULT 0,
  variance_qty DECIMAL(15, 2) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL,
  rate DECIMAL(15, 2) NOT NULL DEFAULT 0,
  planned_cost DECIMAL(15, 2) NOT NULL DEFAULT 0,
  actual_cost DECIMAL(15, 2) NOT NULL DEFAULT 0,
  cost_variance DECIMAL(15, 2) NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_material_consumption_summary_project ON material_consumption_summary(project_id);
CREATE INDEX IF NOT EXISTS idx_material_consumption_summary_organisation ON material_consumption_summary(organisation_id);
CREATE INDEX IF NOT EXISTS idx_material_consumption_summary_item ON material_consumption_summary(item_id);

-- Add unique constraint for ON CONFLICT support
ALTER TABLE material_consumption_summary 
ADD CONSTRAINT material_consumption_summary_unique_item 
UNIQUE (project_id, item_id, variant_id);

-- Enable RLS
ALTER TABLE material_consumption_summary ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view material consumption summary" ON material_consumption_summary;
DROP POLICY IF EXISTS "Service role can manage material consumption summary" ON material_consumption_summary;

-- Users can view consumption summary for their organisations
CREATE POLICY "Users can view material consumption summary"
  ON material_consumption_summary FOR SELECT
  TO authenticated
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_organisations
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Service role can manage consumption summary (updated via triggers/functions)
CREATE POLICY "Service role can manage material consumption summary"
  ON material_consumption_summary FOR ALL
  TO service_role
  USING (true);

-- Function to update consumption summary
DROP FUNCTION IF EXISTS update_material_consumption_summary() CASCADE;
CREATE OR REPLACE FUNCTION update_material_consumption_summary()
RETURNS TRIGGER AS $$
BEGIN
  -- Update or insert consumption summary when daily usage is added/updated
  INSERT INTO material_consumption_summary (
    project_id,
    organisation_id,
    item_id,
    variant_id,
    planned_qty,
    received_qty,
    used_qty,
    remaining_qty,
    variance_qty,
    unit,
    rate,
    planned_cost,
    actual_cost,
    cost_variance,
    last_updated
  )
  SELECT
    NEW.project_id,
    NEW.organisation_id,
    NEW.item_id,
    NEW.variant_id,
    COALESCE(pml.planned_qty, 0),
    COALESCE(SUM(mi.received_qty), 0),
    COALESCE(SUM(dmu.quantity_used), 0),
    COALESCE(SUM(mi.received_qty), 0) - COALESCE(SUM(dmu.quantity_used), 0),
    COALESCE(SUM(dmu.quantity_used), 0) - COALESCE(pml.planned_qty, 0),
    NEW.unit,
    COALESCE(pml.rate, 0),
    COALESCE(pml.planned_qty, 0) * COALESCE(pml.rate, 0),
    COALESCE(SUM(dmu.quantity_used), 0) * COALESCE(pml.rate, 0),
    (COALESCE(SUM(dmu.quantity_used), 0) * COALESCE(pml.rate, 0)) - (COALESCE(pml.planned_qty, 0) * COALESCE(pml.rate, 0)),
    NOW()
  FROM project_material_list pml
  LEFT JOIN (
    SELECT 
      project_id, 
      item_id, 
      variant_id, 
      SUM(received_qty) as received_qty
    FROM material_intents
    WHERE project_id = NEW.project_id
      AND status IN ('Received', 'Partial')
    GROUP BY project_id, item_id, variant_id
  ) mi ON mi.project_id = NEW.project_id AND mi.item_id = NEW.item_id AND mi.variant_id = NEW.variant_id
  LEFT JOIN daily_material_usage dmu ON dmu.project_id = NEW.project_id 
    AND dmu.item_id = NEW.item_id 
    AND dmu.variant_id = NEW.variant_id
  WHERE pml.project_id = NEW.project_id
    AND pml.item_id = NEW.item_id
    AND (pml.variant_id = NEW.variant_id OR (pml.variant_id IS NULL AND NEW.variant_id IS NULL))
  ON CONFLICT (project_id, item_id, variant_id) 
  DO UPDATE SET
    received_qty = EXCLUDED.received_qty,
    used_qty = EXCLUDED.used_qty,
    remaining_qty = EXCLUDED.remaining_qty,
    variance_qty = EXCLUDED.variance_qty,
    actual_cost = EXCLUDED.actual_cost,
    cost_variance = EXCLUDED.cost_variance,
    last_updated = EXCLUDED.last_updated;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update consumption summary on daily usage insert/update
DROP TRIGGER IF EXISTS trigger_update_consumption_on_usage ON daily_material_usage;
CREATE TRIGGER trigger_update_consumption_on_usage
  AFTER INSERT OR UPDATE ON daily_material_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_material_consumption_summary();

-- Trigger to update consumption summary on project material list update
DROP TRIGGER IF EXISTS trigger_update_consumption_on_material_list ON project_material_list;
CREATE TRIGGER trigger_update_consumption_on_material_list
  AFTER INSERT OR UPDATE ON project_material_list
  FOR EACH ROW
  EXECUTE FUNCTION update_material_consumption_summary();
