-- =============================================================================
-- 078 — Fix user_profiles RLS: allow org members to read each other's profiles
-- =============================================================================

-- Drop the restrictive self-only policy
DROP POLICY IF EXISTS "users_view_own_profile" ON public.user_profiles;

-- Add org-scoped select policy using the existing user_can_access_org helper
-- This lets any active org member view profiles within their organisation
CREATE POLICY "user_profiles_org_select" ON public.user_profiles
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.org_members m
      WHERE m.user_id = auth.uid()
        AND m.status = 'active'
        AND EXISTS (
          SELECT 1 FROM public.org_members m2
          WHERE m2.user_id = user_profiles.user_id
            AND m2.organisation_id = m.organisation_id
        )
    )
  );

-- Also add a get_org_users helper for direct calls (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_org_users(p_org_id UUID)
RETURNS TABLE (id UUID, full_name TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT up.id, up.full_name
  FROM user_profiles up
  JOIN org_members om ON om.user_id = up.user_id
  WHERE om.organisation_id = p_org_id
    AND om.status = 'active'
  ORDER BY up.full_name;
$$;

GRANT EXECUTE ON FUNCTION public.get_org_users TO authenticated;
