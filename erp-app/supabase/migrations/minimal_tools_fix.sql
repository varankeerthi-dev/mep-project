-- Minimal Tools Catalog Fix
-- Based on debug showing organisations table exists, we need to create tools_catalog with proper structure

-- Create tools_catalog table with all required columns
CREATE TABLE IF NOT EXISTS tools_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  tool_name VARCHAR(255) NOT NULL,
  make VARCHAR(100),
  model VARCHAR(100),
  category VARCHAR(100),
  purchase_price DECIMAL(10,2),
  gst_rate DECIMAL(5,2),
  depreciation_rate DECIMAL(5,2),
  technical_specs TEXT,
  custom_label_1_name VARCHAR(100),
  custom_label_1_value VARCHAR(255),
  custom_label_2_name VARCHAR(100),
  custom_label_2_value VARCHAR(255),
  custom_label_3_name VARCHAR(100),
  custom_label_3_value VARCHAR(255),
  custom_label_4_name VARCHAR(100),
  custom_label_4_value VARCHAR(255),
  initial_stock INTEGER DEFAULT 0,
  current_stock INTEGER DEFAULT 0,
  min_stock_level INTEGER DEFAULT 0,
  reorder_point INTEGER DEFAULT 0,
  default_source_location VARCHAR(100) DEFAULT 'Warehouse',
  hsn_code VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organisation_id, tool_name)
);

-- Enable RLS
ALTER TABLE tools_catalog ENABLE ROW LEVEL SECURITY;

-- Create simple RLS policy
DROP POLICY IF EXISTS "tools_catalog_policy" ON tools_catalog;
CREATE POLICY "tools_catalog_policy" ON tools_catalog
  FOR ALL USING (organisation_id = auth.uid());

-- Create index
CREATE INDEX IF NOT EXISTS idx_tools_catalog_org_id ON tools_catalog(organisation_id);
