-- 077_fix_user_can_access_org.sql
-- Drop and recreate user_can_access_org with the correct signature.
-- The prior function existed with a different parameter name (p_org_id).
-- DROP + CREATE is required to change parameter names in PL/pgSQL.

DROP FUNCTION IF EXISTS public.user_can_access_org(uuid);

CREATE OR REPLACE FUNCTION public.user_can_access_org(p_organisation_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_is_member BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.org_members om
    WHERE om.organisation_id = p_organisation_id
      AND om.user_id = v_user_id
      AND COALESCE(om.status, 'active') IN ('active', 'Active')
  ) INTO v_is_member;

  RETURN v_is_member;
END;
$$;

GRANT EXECUTE ON FUNCTION public.user_can_access_org TO authenticated;

-- Also make sure RLS on the new tables uses the right grantee.
GRANT ALL ON public.leads TO anon, authenticated;
GRANT ALL ON public.cadence_rules TO anon, authenticated;
GRANT ALL ON public.win_loss_reasons TO anon, authenticated;
GRANT ALL ON public.next_action_index TO anon, authenticated;
