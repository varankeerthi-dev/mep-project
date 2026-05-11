-- Test simple insert to isolate the data type issue
-- This will help identify what's causing the "invalid input syntax for type numeric" error

-- Test with explicit data types
INSERT INTO tools_catalog (
  organisation_id,
  tool_name,
  make,
  initial_stock,
  current_stock,
  hsn_code
) VALUES 
  (
    '550e8400-e29b-41d4-a716-4476c6d975d',  -- organisation_id as string
    'Test Tool Simple',
    'Test Make',
    10,
    10,
    'HSN123'
  );

-- Test with explicit numeric casting
INSERT INTO tools_catalog (
  organisation_id,
  tool_name,
  make,
  initial_stock,
  current_stock,
  hsn_code
) VALUES 
  (
    '550e8400-e29b-41d4-a716-4476c6d975d'::uuid,  -- organisation_id as UUID
    'Test Tool UUID',
    'Test Make UUID',
    10,
    10,
    'HSN123'
  );
