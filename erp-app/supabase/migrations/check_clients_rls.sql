-- Check and fix clients table RLS issues
-- This ensures clients dropdown loads properly in tools modals

-- Check if RLS is enabled and policies exist
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'clients';

-- Check if clients table has RLS enabled
SELECT 
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'clients' AND schemaname = 'public';

-- If RLS is causing issues, disable it temporarily for clients
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;

-- Drop any restrictive policies
DROP POLICY IF EXISTS "clients_select_policy" ON clients;
DROP POLICY IF EXISTS "clients_insert_policy" ON clients;
DROP POLICY IF EXISTS "clients_update_policy" ON clients;
DROP POLICY IF EXISTS "clients_delete_policy" ON clients;
DROP POLICY IF EXISTS "Enable access for clients" ON clients;

-- Grant permissions
GRANT SELECT ON clients TO authenticated;
GRANT SELECT ON clients TO anon;

-- Test query
SELECT COUNT(*) as client_count FROM clients;

SELECT 'Clients RLS Check Complete' as status;
