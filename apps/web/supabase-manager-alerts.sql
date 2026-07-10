-- Manager Alerts (AI agent notifications for MD / managers)
-- Run in the Supabase SQL editor or via migration tooling.

CREATE TABLE IF NOT EXISTS manager_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  communication_id UUID REFERENCES client_communication(id) ON DELETE CASCADE,
  logged_by UUID,                       -- call_entered_by on the source communication
  logged_by_name TEXT,
  party_type TEXT,
  party_name TEXT,
  summary TEXT NOT NULL,                -- "Employee X logged this ___"
  suggested_options JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'new',   -- new | acknowledged | actioned
  selected_option TEXT,                 -- which suggestion the manager picked
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manager_alerts_org ON manager_alerts(organisation_id);
CREATE INDEX IF NOT EXISTS idx_manager_alerts_status ON manager_alerts(status);
CREATE INDEX IF NOT EXISTS idx_manager_alerts_created ON manager_alerts(created_at DESC);

ALTER TABLE manager_alerts ENABLE ROW LEVEL SECURITY;

-- Dashboard reads happen via the anon client + user session JWT.
-- Org members can read alerts that belong to their organisation.
DROP POLICY IF EXISTS "Org members can view alerts" ON manager_alerts;
CREATE POLICY "Org members can view alerts" ON manager_alerts
  FOR SELECT USING (
    organisation_id IN (
      SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
    )
  );

-- Allow org members (managers/MD) to update status on their org's alerts.
DROP POLICY IF EXISTS "Org members can update alerts" ON manager_alerts;
CREATE POLICY "Org members can update alerts" ON manager_alerts
  FOR UPDATE USING (
    organisation_id IN (
      SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
    )
  );

-- Inserts are performed by the serverless function using the service-role key,
-- which bypasses RLS. This policy is a safety net for the anon key if ever used.
DROP POLICY IF EXISTS "Service role can insert alerts" ON manager_alerts;
CREATE POLICY "Service role can insert alerts" ON manager_alerts
  FOR INSERT WITH CHECK (true);
