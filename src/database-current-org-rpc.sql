CREATE OR REPLACE FUNCTION public.current_organisation_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT om.organisation_id::UUID
    FROM public.org_members om
    WHERE om.user_id::TEXT = auth.uid()::TEXT
      AND om.status = 'active'
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path TO public;

GRANT EXECUTE ON FUNCTION public.current_organisation_id() TO authenticated;
