-- Migration: 20261103000000_repair_client_communication_entries_rls.sql
-- Description: Fix parent-child RLS binding defect on client_communication_entries.
-- The prior policy compared c.id to c.parent_communication_id, causing false-evaluation
-- for all top-level communications. This repair establishes explicit table qualification
-- and an EXISTS clause scoped to the parent communication's organisation.

ALTER TABLE public.client_communication_entries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'client_communication_entries' 
      AND policyname = 'cc_entries_org_all'
  ) THEN
    ALTER POLICY "cc_entries_org_all" ON public.client_communication_entries
      USING (
        EXISTS (
          SELECT 1 FROM public.client_communication c
          WHERE c.id = public.client_communication_entries.parent_communication_id
            AND public.user_can_access_org(c.organisation_id)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.client_communication c
          WHERE c.id = public.client_communication_entries.parent_communication_id
            AND public.user_can_access_org(c.organisation_id)
        )
      );
  ELSE
    CREATE POLICY "cc_entries_org_all" ON public.client_communication_entries
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.client_communication c
          WHERE c.id = public.client_communication_entries.parent_communication_id
            AND public.user_can_access_org(c.organisation_id)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.client_communication c
          WHERE c.id = public.client_communication_entries.parent_communication_id
            AND public.user_can_access_org(c.organisation_id)
        )
      );
  END IF;
END $$;
