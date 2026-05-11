-- Verify tools_catalog table functionality
-- Run this to verify the table works correctly

-- Test basic insert
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
    'Test Tool',
    'Test Make',
    10,
    10,
    'HSN123'
  );

-- Test basic select
SELECT * FROM tools_catalog WHERE tool_name = 'Test Tool';

-- Verify table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tools_catalog' 
ORDER BY ordinal_position;
