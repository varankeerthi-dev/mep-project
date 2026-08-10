-- 011 — Add missing org-scoped RLS policy for work_centers
-- ---------------------------------------------------------------------------
-- work_centers has RLS ENABLED but shipped with ZERO policies, so every
-- insert/update/select/delete from the API is denied ("new row violates
-- row-level security policy"). This mirrors the exact org-isolation policy
-- already present on its sibling tables (job_cards, manufacturing_tooling,
-- machine_downtime): any member of an org may read/write that org's rows.
-- ---------------------------------------------------------------------------

ALTER TABLE work_centers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS work_centers_org_isolation ON work_centers;

CREATE POLICY work_centers_org_isolation ON work_centers
  FOR ALL
  USING (
    organisation_id IN (
      SELECT organisation_id FROM org_members
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM org_members
      WHERE user_id = auth.uid()
    )
  );
