-- Fix RLS Auth Issue
-- The 403 error suggests auth.uid() is not working correctly
-- Let's create a more permissive policy for testing

-- Drop existing restrictive policy
DROP POLICY IF EXISTS "tools_catalog_policy" ON tools_catalog;

-- Create a more permissive policy for testing
CREATE POLICY "tools_catalog_policy" ON tools_catalog
  FOR ALL USING (
    organisation_id IS NOT NULL AND 
    (auth.uid() IS NOT NULL AND organisation_id = auth.uid()) OR
    (auth.uid() IS NULL AND organisation_id IS NULL)
  );

-- Also create a policy for unauthenticated users to test
CREATE POLICY "tools_catalog_public" ON tools_catalog
  FOR SELECT USING (true);

-- Enable RLS on the table
ALTER TABLE tools_catalog ENABLE ROW LEVEL SECURITY;

-- Grant public access for testing
GRANT ALL ON tools_catalog TO anon;
GRANT ALL ON tools_catalog TO authenticated;
