-- Migration: 20260915000001_site_visits_production_hardening.sql
-- Description: Enforce foreign key referential integrity and strict tenant isolation for SiteVisits and child tables.

-- 1. Foreign Key Constraints for site_visits and site_report_stoppages
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_site_visits_organisation' 
          AND table_name = 'site_visits'
    ) THEN
        ALTER TABLE site_visits 
        ADD CONSTRAINT fk_site_visits_organisation 
        FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_site_report_stoppages_organisation' 
          AND table_name = 'site_report_stoppages'
    ) THEN
        ALTER TABLE site_report_stoppages 
        ADD CONSTRAINT fk_site_report_stoppages_organisation 
        FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 2. Create site_visit_activity_log table if not exists
CREATE TABLE IF NOT EXISTS site_visit_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    site_visit_id UUID NOT NULL REFERENCES site_visits(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_name VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for activity log lookups
CREATE INDEX IF NOT EXISTS idx_site_visit_activity_log_lookup 
ON site_visit_activity_log(organisation_id, site_visit_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_site_visit_activity_log_org 
ON site_visit_activity_log(organisation_id, created_at DESC);

-- 3. RLS for site_visit_activity_log
ALTER TABLE site_visit_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_visit_activity_log_tenant_isolation" ON site_visit_activity_log;
DROP POLICY IF EXISTS "site_visit_activity_log_select" ON site_visit_activity_log;
DROP POLICY IF EXISTS "site_visit_activity_log_insert" ON site_visit_activity_log;
DROP POLICY IF EXISTS "site_visit_activity_log_update" ON site_visit_activity_log;
DROP POLICY IF EXISTS "site_visit_activity_log_delete" ON site_visit_activity_log;

CREATE POLICY "site_visit_activity_log_tenant_isolation" ON site_visit_activity_log
    FOR ALL
    TO authenticated
    USING (user_can_access_org(organisation_id))
    WITH CHECK (
        user_can_access_org(organisation_id) AND
        EXISTS (
            SELECT 1 FROM site_visits sv 
            WHERE sv.id = site_visit_activity_log.site_visit_id 
              AND sv.organisation_id = site_visit_activity_log.organisation_id
        )
    );

-- 4. Harden site_visits RLS
ALTER TABLE site_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access" ON site_visits;
DROP POLICY IF EXISTS "site_visits_tenant_isolation" ON site_visits;

CREATE POLICY "site_visits_tenant_isolation" ON site_visits
    FOR ALL
    TO authenticated
    USING (user_can_access_org(organisation_id))
    WITH CHECK (user_can_access_org(organisation_id));

-- 5. Harden site_report_stoppages RLS
ALTER TABLE site_report_stoppages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for authenticated users in org" ON site_report_stoppages;
DROP POLICY IF EXISTS "site_report_stoppages_tenant_isolation" ON site_report_stoppages;

CREATE POLICY "site_report_stoppages_tenant_isolation" ON site_report_stoppages
    FOR ALL
    TO authenticated
    USING (user_can_access_org(organisation_id))
    WITH CHECK (
        user_can_access_org(organisation_id) AND
        (site_visit_id IS NULL OR EXISTS (
            SELECT 1 FROM site_visits sv 
            WHERE sv.id = site_report_stoppages.site_visit_id 
              AND sv.organisation_id = site_report_stoppages.organisation_id
        ))
    );

-- 6. Standardize visit_purposes RLS
ALTER TABLE visit_purposes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access" ON visit_purposes;
DROP POLICY IF EXISTS "org_scoped_policy" ON visit_purposes;
DROP POLICY IF EXISTS "visit_purposes_select" ON visit_purposes;
DROP POLICY IF EXISTS "visit_purposes_modify" ON visit_purposes;

CREATE POLICY "visit_purposes_select" ON visit_purposes
    FOR SELECT
    TO authenticated
    USING (organisation_id IS NULL OR user_can_access_org(organisation_id));

CREATE POLICY "visit_purposes_modify" ON visit_purposes
    FOR ALL
    TO authenticated
    USING (organisation_id IS NOT NULL AND user_can_access_org(organisation_id))
    WITH CHECK (organisation_id IS NOT NULL AND user_can_access_org(organisation_id));

-- 7. Harden visit_checklist_responses RLS
ALTER TABLE visit_checklist_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "visit_checklist_responses_tenant_isolation" ON visit_checklist_responses;

CREATE POLICY "visit_checklist_responses_tenant_isolation" ON visit_checklist_responses
    FOR ALL
    TO authenticated
    USING (user_can_access_org(organisation_id))
    WITH CHECK (
        user_can_access_org(organisation_id) AND
        (site_visit_id IS NULL OR EXISTS (
            SELECT 1 FROM site_visits sv 
            WHERE sv.id = visit_checklist_responses.site_visit_id 
              AND sv.organisation_id = visit_checklist_responses.organisation_id
        ))
    );

-- 8. Harden tc_protocols RLS
ALTER TABLE tc_protocols ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_scoped_select_tc_protocols" ON tc_protocols;
DROP POLICY IF EXISTS "org_scoped_insert_tc_protocols" ON tc_protocols;
DROP POLICY IF EXISTS "org_scoped_update_tc_protocols" ON tc_protocols;
DROP POLICY IF EXISTS "org_scoped_delete_tc_protocols" ON tc_protocols;
DROP POLICY IF EXISTS "tc_protocols_tenant_isolation" ON tc_protocols;

CREATE POLICY "tc_protocols_tenant_isolation" ON tc_protocols
    FOR ALL
    TO authenticated
    USING (user_can_access_org(organisation_id))
    WITH CHECK (
        user_can_access_org(organisation_id) AND
        (site_visit_id IS NULL OR EXISTS (
            SELECT 1 FROM site_visits sv 
            WHERE sv.id = tc_protocols.site_visit_id 
              AND sv.organisation_id = tc_protocols.organisation_id
        ))
    );

-- 9. Harden joint_measurements RLS
ALTER TABLE joint_measurements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_scoped_select_joint_measurements" ON joint_measurements;
DROP POLICY IF EXISTS "org_scoped_insert_joint_measurements" ON joint_measurements;
DROP POLICY IF EXISTS "org_scoped_update_joint_measurements" ON joint_measurements;
DROP POLICY IF EXISTS "org_scoped_delete_joint_measurements" ON joint_measurements;
DROP POLICY IF EXISTS "joint_measurements_tenant_isolation" ON joint_measurements;

CREATE POLICY "joint_measurements_tenant_isolation" ON joint_measurements
    FOR ALL
    TO authenticated
    USING (user_can_access_org(organisation_id))
    WITH CHECK (
        user_can_access_org(organisation_id) AND
        (site_visit_id IS NULL OR EXISTS (
            SELECT 1 FROM site_visits sv 
            WHERE sv.id = joint_measurements.site_visit_id 
              AND sv.organisation_id = joint_measurements.organisation_id
        ))
    );
