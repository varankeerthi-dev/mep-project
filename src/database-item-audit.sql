-- Item audit trail table for update documentation/history
-- Run this in Supabase SQL editor

CREATE TABLE IF NOT EXISTS item_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID REFERENCES materials(id) ON DELETE CASCADE,
  action VARCHAR(80) NOT NULL,
  notes TEXT,
  changes JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_item_audit_logs_item_id ON item_audit_logs(item_id);
CREATE INDEX IF NOT EXISTS idx_item_audit_logs_created_at ON item_audit_logs(created_at DESC);

ALTER TABLE item_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON item_audit_logs;
CREATE POLICY "Enable all access" ON item_audit_logs FOR ALL USING (true) WITH CHECK (true);
