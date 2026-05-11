-- Simple test to verify tools_catalog table works
-- Insert a simple test record
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

-- Test select to verify it works
SELECT * FROM tools_catalog WHERE tool_name = 'Test Tool';
