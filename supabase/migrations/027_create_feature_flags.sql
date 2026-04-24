-- Feature Flags Table
-- Stores individual features/modules that can be enabled/disabled per plan
CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- e.g., 'projects', 'inventory', 'sales', 'reports'
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users
CREATE POLICY "Anyone can view feature flags"
  ON feature_flags FOR SELECT
  TO authenticated
  USING (true);

-- Allow service role to manage feature flags
CREATE POLICY "Service role can manage feature flags"
  ON feature_flags FOR ALL
  TO service_role
  USING (true);

-- Insert default feature flags based on app modules
INSERT INTO feature_flags (key, name, description, category) VALUES
  -- Projects
  ('projects.limit', 'Project Limit', 'Maximum number of projects allowed', 'projects'),
  ('projects.unlimited', 'Unlimited Projects', 'No limit on number of projects', 'projects'),
  
  -- Tasks
  ('tasks.basic', 'Basic Tasks', 'Basic task management', 'tasks'),
  ('tasks.approvals', 'Task Approvals', 'Task approval workflow', 'tasks'),
  
  -- Clients
  ('clients.limit', 'Client Limit', 'Maximum number of clients allowed', 'clients'),
  ('clients.unlimited', 'Unlimited Clients', 'No limit on number of clients', 'clients'),
  ('clients.meetings', 'Client Meetings', 'Meeting management', 'clients'),
  ('clients.communication', 'Client Communication', 'Communication tracking', 'clients'),
  
  -- Site Visits
  ('site_visits', 'Site Visits', 'Site visit management and reporting', 'site_visits'),
  ('site_reports', 'Site Reports', 'Site report generation', 'site_visits'),
  
  -- Subcontractors
  ('subcontractors', 'Subcontractor Management', 'Subcontractor management', 'subcontractors'),
  ('subcontractors.work_orders', 'Work Orders', 'Work order management', 'subcontractors'),
  ('subcontractors.attendance', 'Attendance', 'Attendance tracking', 'subcontractors'),
  ('subcontractors.daily_logs', 'Daily Logs', 'Daily log management', 'subcontractors'),
  ('subcontractors.payments', 'Payments', 'Payment management', 'subcontractors'),
  ('subcontractors.invoices', 'Invoices', 'Invoice management', 'subcontractors'),
  ('subcontractors.documents', 'Documents', 'Document management', 'subcontractors'),
  
  -- Sales
  ('quotations.limit', 'Quotation Limit', 'Monthly quotation limit', 'sales'),
  ('quotations.unlimited', 'Unlimited Quotations', 'No limit on quotations', 'sales'),
  ('invoices.limit', 'Invoice Limit', 'Monthly invoice limit', 'sales'),
  ('invoices.unlimited', 'Unlimited Invoices', 'No limit on invoices', 'sales'),
  ('proforma_invoices', 'Proforma Invoices', 'Proforma invoice management', 'sales'),
  ('ledger', 'Ledger', 'Ledger management', 'sales'),
  ('boq', 'BOQ', 'BOQ management', 'sales'),
  ('issue', 'Issue Tracking', 'Issue tracking', 'sales'),
  
  -- Inventory
  ('inventory.basic', 'Basic Inventory', 'Basic inventory management', 'inventory'),
  ('inventory.full', 'Full Inventory', 'Full inventory management', 'inventory'),
  ('inventory.material_inward', 'Material Inward', 'Material inward management', 'inventory'),
  ('inventory.material_outward', 'Material Outward', 'Material outward management', 'inventory'),
  ('inventory.stock_transfer', 'Stock Transfer', 'Stock transfer management', 'inventory'),
  ('inventory.warehouses', 'Warehouses', 'Warehouse management', 'inventory'),
  ('inventory.stock_check', 'Stock Check', 'Stock check functionality', 'inventory'),
  
  -- Purchase
  ('purchase', 'Purchase', 'Purchase order management', 'purchase'),
  
  -- Delivery Challan
  ('dc.basic', 'Basic DC', 'Basic delivery challan', 'dc'),
  ('dc.nb_dc', 'Non-Billable DC', 'Non-billable delivery challan', 'dc'),
  ('dc.consolidation', 'DC Consolidation', 'DC consolidation', 'dc'),
  
  -- Reports
  ('reports.stock', 'Stock Reports', 'Stock reporting', 'reports'),
  ('reports.purchase', 'Purchase Reports', 'Purchase reporting', 'reports'),
  ('reports.sales', 'Sales Reports', 'Sales reporting', 'reports'),
  
  -- Settings
  ('settings.print', 'Print Settings', 'Print settings configuration', 'settings'),
  ('settings.document', 'Document Settings', 'Document settings configuration', 'settings'),
  ('settings.template', 'Template Settings', 'Template settings configuration', 'settings'),
  ('settings.quick_quote', 'Quick Quote', 'Quick quote configuration', 'settings'),
  ('settings.organisation', 'Organisation Settings', 'Organisation settings', 'settings'),
  ('settings.access_control', 'Access Control', 'Access control management', 'settings'),
  ('settings.discounts', 'Discount Settings', 'Discount settings configuration', 'settings')
ON CONFLICT (key) DO NOTHING;

-- Index for lookups
CREATE INDEX idx_feature_flags_key ON feature_flags(key);
CREATE INDEX idx_feature_flags_category ON feature_flags(category);
CREATE INDEX idx_feature_flags_active ON feature_flags(is_active) WHERE is_active = true;
