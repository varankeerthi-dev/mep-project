-- Bridge: expose org_members through the legacy user_organisations interface
-- so existing approval/material/report code keeps working during migration.

DROP TABLE IF EXISTS public.user_organisations;

CREATE OR REPLACE VIEW public.user_organisations AS
SELECT
  om.id,
  om.user_id,
  om.organisation_id,
  om.status,
  om.role
FROM public.org_members om;

ALTER VIEW public.user_organisations OWNER TO postgres;

GRANT SELECT ON public.user_organisations TO authenticated;

NOTIFY pgrst, 'reload schema';
