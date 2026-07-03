-- Add created_by and updated_by columns to projects
-- FK references user_profiles.user_id (which itself references auth.users)
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES user_profiles(user_id),
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES user_profiles(user_id);

-- Create audit_log table
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID REFERENCES organisations(id),
  user_id UUID REFERENCES user_profiles(user_id),
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  changes JSONB,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_org ON audit_log(organisation_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);

-- Enable RLS
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- RLS: users can see audit logs for their organisation
CREATE POLICY audit_log_select ON audit_log
  FOR SELECT USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_members WHERE user_id = auth.uid()
    )
  );

-- RLS: authenticated users can insert audit logs
CREATE POLICY audit_log_insert ON audit_log
  FOR INSERT WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM organisation_members WHERE user_id = auth.uid()
    )
  );
