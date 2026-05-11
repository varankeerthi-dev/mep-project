-- ==========================================
-- COMPREHENSIVE TOOLS RLS POLICY FIX
-- ==========================================
-- Error: new row violates row-level security policy for table "tools_catalog"
-- Root cause: Policy is too restrictive or auth context issue

-- Step 1: Drop all existing policies completely
DROP POLICY IF EXISTS "Enable access for tools_catalog" ON tools_catalog;
DROP POLICY IF EXISTS "tools_catalog_policy" ON tools_catalog;
DROP POLICY IF EXISTS "Enable read access for own organisation" ON tools_catalog;
DROP POLICY IF EXISTS "Enable insert for own organisation" ON tools_catalog;
DROP POLICY IF EXISTS "Enable update for own organisation" ON tools_catalog;
DROP POLICY IF EXISTS "Enable delete for own organisation" ON tools_catalog;
DROP POLICY IF EXISTS "Enable tools_catalog access" ON tools_catalog;
DROP POLICY IF EXISTS "tools_catalog_select_policy" ON tools_catalog;
DROP POLICY IF EXISTS "tools_catalog_insert_policy" ON tools_catalog;
DROP POLICY IF EXISTS "tools_catalog_update_policy" ON tools_catalog;
DROP POLICY IF EXISTS "tools_catalog_delete_policy" ON tools_catalog;

-- Step 2: Create simple, permissive policies
-- Allow authenticated users to see their own org's data
CREATE POLICY "tools_catalog_select_policy" ON tools_catalog
  FOR SELECT USING (organisation_id = auth.uid());

-- Allow inserts when organisation_id matches user's org
CREATE POLICY "tools_catalog_insert_policy" ON tools_catalog
  FOR INSERT WITH CHECK (organisation_id = auth.uid());

-- Allow updates when organisation_id matches user's org
CREATE POLICY "tools_catalog_update_policy" ON tools_catalog
  FOR UPDATE USING (organisation_id = auth.uid());

-- Allow deletes when organisation_id matches user's org
CREATE POLICY "tools_catalog_delete_policy" ON tools_catalog
  FOR DELETE USING (organisation_id = auth.uid());

-- Step 3: Ensure RLS is enabled
ALTER TABLE tools_catalog ENABLE ROW LEVEL SECURITY;

-- Step 4: Grant proper permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON tools_catalog TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON tools_catalog TO authenticated;

-- Step 5: Test the policy with a simple insert
DO $$
BEGIN
  -- Try to insert a test record (this will be rolled back)
  INSERT INTO tools_catalog (
    organisation_id,
    tool_name,
    current_stock,
    initial_stock
  ) VALUES (
    auth.uid(),
    'Policy Test Tool',
    0,
    0
  );
  
  -- If we get here, policy works
  RAISE NOTICE 'RLS Policy Test: SUCCESS - Insert allowed';
  
EXCEPTION WHEN OTHERS THEN
  -- If policy fails, we'll see why
  RAISE NOTICE 'RLS Policy Test: FAILED - %', SQLERRM;
END $$;
ROLLBACK; -- Rollback the test insert

-- Step 6: Verification query
SELECT 'Tools Catalog RLS Policy Fix Applied' as status;
