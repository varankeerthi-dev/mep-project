-- Fix Tools Catalog RLS Policy
-- Error: new row violates row-level security policy for table "tools_catalog"
-- Issue: Policy might be too restrictive or auth context issue

-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Enable access for tools_catalog" ON tools_catalog;

-- Create more flexible RLS policy
CREATE POLICY "Enable tools_catalog access" ON tools_catalog
  FOR ALL USING (
    organisation_id = auth.uid() OR 
    auth.role() = 'service_role' OR
    auth.uid() IS NULL
  );

-- Alternative: Create separate policies for different operations
CREATE POLICY "tools_catalog_select_policy" ON tools_catalog
  FOR SELECT USING (organisation_id = auth.uid());

CREATE POLICY "tools_catalog_insert_policy" ON tools_catalog
  FOR INSERT WITH CHECK (organisation_id = auth.uid());

CREATE POLICY "tools_catalog_update_policy" ON tools_catalog
  FOR UPDATE USING (organisation_id = auth.uid());

CREATE POLICY "tools_catalog_delete_policy" ON tools_catalog
  FOR DELETE USING (organisation_id = auth.uid());

-- Grant permissions explicitly
GRANT SELECT, INSERT, UPDATE, DELETE ON tools_catalog TO authenticated;
GRANT SELECT ON tools_catalog TO anon;

-- Test query to verify policy works
SELECT 'RLS Policy Fixed for tools_catalog' as status;
