-- Allow authenticated users to use approval_workflows when they belong
-- to the target org through either org_members (new) or user_organisations (legacy).
-- This avoids 42501 insert/select errors during schema migration.

DROP POLICY IF EXISTS approval_workflows_org_auth ON public.approval_workflows;

CREATE POLICY approval_workflows_org_auth
  ON public.approval_workflows
  FOR ALL
  TO authenticated
  USING (
    organisation_id IN (
      SELECT om.organisation_id
      FROM public.org_members om
      WHERE om.user_id::TEXT = auth.uid()::TEXT
        AND om.status = 'active'
      UNION
      SELECT uo.organisation_id
      FROM public.user_organisations uo
      WHERE uo.user_id::TEXT = auth.uid()::TEXT
        AND uo.status = 'active'
    )
  )
  WITH CHECK (
    organisation_id IN (
      SELECT om.organisation_id
      FROM public.org_members om
      WHERE om.user_id::TEXT = auth.uid()::TEXT
        AND om.status = 'active'
      UNION
      SELECT uo.organisation_id
      FROM public.user_organisations uo
      WHERE uo.user_id::TEXT = auth.uid()::TEXT
        AND uo.status = 'active'
    )
  );

ALTER TABLE public.approval_workflows ENABLE ROW LEVEL SECURITY;
