-- Test frontend fix for tools catalog
-- Run this to verify the frontend issue is resolved

-- Test simple insert with correct data types
INSERT INTO tools_catalog (
  organisation_id,
  tool_name,
  make,
  initial_stock,
  current_stock,
  hsn_code
) VALUES 
  (
    (SELECT id FROM organisations LIMIT 1),
    'Test Tool Frontend',
    'Test Make Frontend',
    10,
    10,
    'HSN123'
  );

-- Verify the insert worked
SELECT * FROM tools_catalog WHERE tool_name = 'Test Tool Frontend';
