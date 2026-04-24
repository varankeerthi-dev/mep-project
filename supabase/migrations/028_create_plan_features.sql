-- Plan Features Junction Table
-- Links pricing plans to feature flags with configuration
CREATE TABLE IF NOT EXISTS plan_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES pricing_plans(id) ON DELETE CASCADE,
  feature_id UUID NOT NULL REFERENCES feature_flags(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT true,
  limits JSONB DEFAULT '{}', -- e.g., {"max_projects": 3, "max_clients": 5}
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plan_id, feature_id)
);

-- Enable RLS
ALTER TABLE plan_features ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users
CREATE POLICY "Anyone can view plan features"
  ON plan_features FOR SELECT
  TO authenticated
  USING (true);

-- Allow service role to manage plan features
CREATE POLICY "Service role can manage plan features"
  ON plan_features FOR ALL
  TO service_role
  USING (true);

-- Insert plan-feature mappings for Free plan
INSERT INTO plan_features (plan_id, feature_id, enabled, limits)
SELECT 
  (SELECT id FROM pricing_plans WHERE slug = 'free'),
  id,
  true,
  CASE key
    WHEN 'projects.limit' THEN '{"max_projects": 3}'::jsonb
    WHEN 'clients.limit' THEN '{"max_clients": 5}'::jsonb
    WHEN 'quotations.limit' THEN '{"max_per_month": 5}'::jsonb
    WHEN 'invoices.limit' THEN '{"max_per_month": 5}'::jsonb
    ELSE '{}'::jsonb
  END
FROM feature_flags
WHERE key IN (
  'projects.limit',
  'tasks.basic',
  'clients.limit',
  'clients.meetings',
  'quotations.limit',
  'invoices.limit',
  'inventory.basic',
  'inventory.stock_check',
  'reports.stock',
  'reports.purchase',
  'reports.sales'
)
ON CONFLICT (plan_id, feature_id) DO NOTHING;

-- Insert plan-feature mappings for Premium plan
INSERT INTO plan_features (plan_id, feature_id, enabled, limits)
SELECT 
  (SELECT id FROM pricing_plans WHERE slug = 'premium'),
  id,
  true,
  CASE key
    WHEN 'projects.limit' THEN '{"max_projects": 999999}'::jsonb
    WHEN 'clients.limit' THEN '{"max_clients": 999999}'::jsonb
    WHEN 'quotations.limit' THEN '{"max_per_month": 999999}'::jsonb
    WHEN 'invoices.limit' THEN '{"max_per_month": 999999}'::jsonb
    ELSE '{}'::jsonb
  END
FROM feature_flags
WHERE key IN (
  'projects.limit',
  'projects.unlimited',
  'tasks.basic',
  'tasks.approvals',
  'clients.limit',
  'clients.unlimited',
  'clients.meetings',
  'clients.communication',
  'site_visits',
  'site_reports',
  'quotations.limit',
  'quotations.unlimited',
  'invoices.limit',
  'invoices.unlimited',
  'proforma_invoices',
  'ledger',
  'boq',
  'issue',
  'inventory.full',
  'inventory.material_inward',
  'inventory.material_outward',
  'inventory.stock_transfer',
  'inventory.warehouses',
  'inventory.stock_check',
  'purchase',
  'dc.basic',
  'reports.stock',
  'reports.purchase',
  'reports.sales',
  'settings.print',
  'settings.document'
)
ON CONFLICT (plan_id, feature_id) DO NOTHING;

-- Insert plan-feature mappings for Elite plan
INSERT INTO plan_features (plan_id, feature_id, enabled, limits)
SELECT 
  (SELECT id FROM pricing_plans WHERE slug = 'elite'),
  id,
  true,
  CASE key
    WHEN 'projects.limit' THEN '{"max_projects": 999999}'::jsonb
    WHEN 'clients.limit' THEN '{"max_clients": 999999}'::jsonb
    WHEN 'quotations.limit' THEN '{"max_per_month": 999999}'::jsonb
    WHEN 'invoices.limit' THEN '{"max_per_month": 999999}'::jsonb
    ELSE '{}'::jsonb
  END
FROM feature_flags
WHERE key IN (
  'projects.limit',
  'projects.unlimited',
  'tasks.basic',
  'tasks.approvals',
  'clients.limit',
  'clients.unlimited',
  'clients.meetings',
  'clients.communication',
  'site_visits',
  'site_reports',
  'subcontractors',
  'subcontractors.work_orders',
  'subcontractors.attendance',
  'subcontractors.daily_logs',
  'subcontractors.payments',
  'subcontractors.invoices',
  'subcontractors.documents',
  'quotations.limit',
  'quotations.unlimited',
  'invoices.limit',
  'invoices.unlimited',
  'proforma_invoices',
  'ledger',
  'boq',
  'issue',
  'inventory.full',
  'inventory.material_inward',
  'inventory.material_outward',
  'inventory.stock_transfer',
  'inventory.warehouses',
  'inventory.stock_check',
  'purchase',
  'dc.basic',
  'dc.nb_dc',
  'dc.consolidation',
  'reports.stock',
  'reports.purchase',
  'reports.sales',
  'settings.print',
  'settings.document',
  'settings.template',
  'settings.quick_quote',
  'settings.organisation',
  'settings.access_control',
  'settings.discounts'
)
ON CONFLICT (plan_id, feature_id) DO NOTHING;

-- Insert plan-feature mappings for Enterprise plan (all features)
INSERT INTO plan_features (plan_id, feature_id, enabled, limits)
SELECT 
  (SELECT id FROM pricing_plans WHERE slug = 'enterprise'),
  id,
  true,
  '{}'::jsonb
FROM feature_flags
ON CONFLICT (plan_id, feature_id) DO NOTHING;

-- Indexes
CREATE INDEX idx_plan_features_plan_id ON plan_features(plan_id);
CREATE INDEX idx_plan_features_feature_id ON plan_features(feature_id);
CREATE INDEX idx_plan_features_enabled ON plan_features(enabled) WHERE enabled = true;
