-- ============================================================
-- ORG MODULES: Per-organisation module enable/disable system
-- ============================================================
-- This table tracks which modules are enabled for each organisation.
-- The list of available modules is defined client-side in module-registry.ts,
-- so new modules only need a registry entry + this table row.

CREATE TABLE IF NOT EXISTS org_modules (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  module_id     TEXT NOT NULL,
  enabled       BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organisation_id, module_id)
);

-- RLS
ALTER TABLE org_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_read_modules" ON org_modules
  FOR SELECT USING (
    organisation_id IN (
      SELECT organisation_id FROM org_members
      WHERE user_id = auth.uid()
        AND (status = 'active' OR status IS NULL)
    )
  );

CREATE POLICY "org_admin_manage_modules" ON org_modules
  FOR ALL USING (
    organisation_id IN (
      SELECT organisation_id FROM org_members
      WHERE user_id = auth.uid()
        AND role = 'admin'
        AND (status = 'active' OR status IS NULL)
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_org_modules_org ON org_modules(organisation_id);
CREATE INDEX IF NOT EXISTS idx_org_modules_org_module ON org_modules(organisation_id, module_id);

-- RPC: Get all enabled module IDs for an organisation
CREATE OR REPLACE FUNCTION get_org_modules(p_org_id UUID)
RETURNS TABLE(module_id TEXT, enabled BOOLEAN) AS $$
  SELECT om.module_id, om.enabled
  FROM org_modules om
  WHERE om.organisation_id = p_org_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- RPC: Upsert module enabled state
CREATE OR REPLACE FUNCTION set_org_module(
  p_org_id UUID,
  p_module_id TEXT,
  p_enabled BOOLEAN
)
RETURNS VOID AS $$
  INSERT INTO org_modules (organisation_id, module_id, enabled, updated_at)
  VALUES (p_org_id, p_module_id, p_enabled, now())
  ON CONFLICT (organisation_id, module_id)
  DO UPDATE SET enabled = p_enabled, updated_at = now();
$$ LANGUAGE sql SECURITY DEFINER;

-- RPC: Bulk upsert module states
CREATE OR REPLACE FUNCTION set_org_modules_bulk(
  p_org_id UUID,
  p_module_ids TEXT[],
  p_enabled BOOLEAN
)
RETURNS VOID AS $$
  INSERT INTO org_modules (organisation_id, module_id, enabled, updated_at)
  SELECT p_org_id, unnest(p_module_ids), p_enabled, now()
  ON CONFLICT (organisation_id, module_id)
  DO UPDATE SET enabled = p_enabled, updated_at = now();
$$ LANGUAGE sql SECURITY DEFINER;
