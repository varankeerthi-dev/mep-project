-- Query to find your Organization ID
-- Run this in Supabase SQL Editor to get your org details

-- Method 1: List all organisations
SELECT id, name, email, created_at 
FROM organisations 
ORDER BY created_at DESC;

-- Method 2: Get organisation by user email (if you know the admin email)
-- Replace 'admin@example.com' with your actual email
-- SELECT o.id, o.name, o.email
-- FROM organisations o
-- JOIN organisation_members om ON o.id = om.organisation_id
-- JOIN auth.users u ON om.user_id = u.id
-- WHERE u.email = 'your-email@example.com';

-- Method 3: Get current user's organisations via function
-- This uses the current authenticated user
CREATE OR REPLACE FUNCTION get_my_organisations()
RETURNS TABLE (
    org_id UUID,
    org_name TEXT,
    role TEXT,
    joined_at TIMESTAMP WITH TIME ZONE
) 
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        o.id as org_id,
        o.name as org_name,
        om.role,
        om.created_at as joined_at
    FROM organisations o
    JOIN organisation_members om ON o.id = om.organisation_id
    WHERE om.user_id = auth.uid()
    ORDER BY om.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- After creating the function above, you can run:
-- SELECT * FROM get_my_organisations();

-- Method 4: Simple lookup if you know part of the org name
-- SELECT id, name 
-- FROM organisations 
-- WHERE name ILIKE '%your-org-name%';
