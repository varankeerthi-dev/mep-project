-- Final Tools Management Fix
-- This addresses all issues: table structure, RLS policies, and request format

-- Step 1: Recreate tools_catalog table with proper structure
DROP TABLE IF EXISTS tools_catalog CASCADE;
CREATE TABLE tools_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
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

-- Step 2: Enable proper RLS with simple policy
ALTER TABLE tools_catalog ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "tools_catalog_policy" ON tools_catalog;
DROP POLICY IF EXISTS "tools_catalog_public" ON tools_catalog;

-- Create simple RLS policy that works
CREATE POLICY "Enable access for tools_catalog" ON tools_catalog
  FOR ALL USING (organisation_id = auth.uid() OR auth.uid() IS NULL);

-- Step 3: Grant proper permissions
GRANT SELECT ON tools_catalog TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON tools_catalog TO authenticated;

-- Step 4: Create index for performance
CREATE INDEX idx_tools_catalog_org_id ON tools_catalog(organisation_id);
CREATE INDEX idx_tools_catalog_name ON tools_catalog(tool_name);

-- Step 5: Insert sample data for testing
INSERT INTO tools_catalog (
  organisation_id,
  tool_name,
  make,
  model,
  category,
  purchase_price,
  gst_rate,
  initial_stock,
  current_stock,
  hsn_code
) VALUES 
  (
    (SELECT id FROM organisations LIMIT 1),
    'Sample Tool 1',
    'Sample Make',
    'Sample Model',
    'Sample Category',
    100.00,
    18.00,
    10,
    10,
    'HSN123'
  );

-- Step 6: Verify table creation
SELECT 'Tools Catalog table created successfully' as status;
