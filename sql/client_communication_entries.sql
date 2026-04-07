-- Client Communication Entries Table (Thread/Log Support)
-- Run this in Supabase SQL Editor
-- This adds time-based nested entries to group multiple calls/emails in a single daily communication record

-- 1. Create entries table for nested communication logs
CREATE TABLE IF NOT EXISTS client_communication_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_communication_id UUID NOT NULL REFERENCES client_communication(id) ON DELETE CASCADE,

  -- Entry sequencing and timing
  entry_sequence INTEGER NOT NULL DEFAULT 1,
  entry_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Communication type (finer grain than parent)
  entry_type VARCHAR(20) NOT NULL CHECK (entry_type IN ('call', 'email', 'whatsapp', 'meeting', 'note', 'sms')),

  -- Entry content
  brief TEXT NOT NULL,
  duration_minutes INTEGER,

  -- Who made this entry
  entered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  entered_by_name TEXT, -- Denormalized for display

  -- Optional: Call outcome per entry
  outcome VARCHAR(50), -- 'discussed', 'approved', 'pending', 'escalated', 'follow_up_required'

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Unique constraint: one sequence per parent
  UNIQUE(parent_communication_id, entry_sequence)
);

-- 2. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_entries_parent ON client_communication_entries(parent_communication_id);
CREATE INDEX IF NOT EXISTS idx_entries_timestamp ON client_communication_entries(entry_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_entries_created ON client_communication_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entries_entered_by ON client_communication_entries(entered_by);

-- 3. Function to auto-increment sequence per parent
CREATE OR REPLACE FUNCTION get_next_entry_sequence(p_parent_id UUID)
RETURNS INTEGER AS $$
DECLARE
  next_seq INTEGER;
BEGIN
  SELECT COALESCE(MAX(entry_sequence), 0) + 1
  INTO next_seq
  FROM client_communication_entries
  WHERE parent_communication_id = p_parent_id;

  RETURN next_seq;
END;
$$ LANGUAGE plpgsql;

-- 4. Function to auto-set entered_by_name from user profile
CREATE OR REPLACE FUNCTION set_entry_user_name()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.entered_by IS NOT NULL AND NEW.entered_by_name IS NULL THEN
    SELECT full_name INTO NEW.entered_by_name
    FROM user_profiles
    WHERE user_id = NEW.entered_by;

    -- Fallback to email if full_name not found
    IF NEW.entered_by_name IS NULL THEN
      SELECT email INTO NEW.entered_by_name
      FROM auth.users
      WHERE id = NEW.entered_by;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_entry_user_name
  BEFORE INSERT ON client_communication_entries
  FOR EACH ROW
  EXECUTE FUNCTION set_entry_user_name();

-- 5. RLS policies
ALTER TABLE client_communication_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON client_communication_entries;
CREATE POLICY "Enable all access for authenticated users"
  ON client_communication_entries FOR ALL
  USING (auth.role() = 'authenticated');

-- 6. View for easy querying with parent details
CREATE OR REPLACE VIEW view_client_communication_threads AS
SELECT
  cc.id as parent_id,
  cc.client_id,
  c.client_name,
  cc.call_regarding,
  cc.status as parent_status,
  cc.priority,
  cc.created_at as thread_start_date,
  COUNT(e.id) as entry_count,
  MAX(e.entry_timestamp) as latest_activity,
  MIN(e.entry_timestamp) as first_activity,
  jsonb_agg(
    jsonb_build_object(
      'id', e.id,
      'sequence', e.entry_sequence,
      'timestamp', e.entry_timestamp,
      'type', e.entry_type,
      'brief', e.brief,
      'duration', e.duration_minutes,
      'entered_by', e.entered_by_name,
      'outcome', e.outcome
    ) ORDER BY e.entry_sequence
  ) FILTER (WHERE e.id IS NOT NULL) as entries
FROM client_communication cc
LEFT JOIN clients c ON c.id = cc.client_id
LEFT JOIN client_communication_entries e ON e.parent_communication_id = cc.id
GROUP BY cc.id, cc.client_id, c.client_name, cc.call_regarding, cc.status, cc.priority, cc.created_at;

-- 7. Function to check if client has active thread today
CREATE OR REPLACE FUNCTION get_client_active_thread_today(p_client_id UUID)
RETURNS TABLE (
  thread_id UUID,
  client_name TEXT,
  entry_count INTEGER,
  latest_activity TIMESTAMP WITH TIME ZONE,
  parent_status VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cc.id as thread_id,
    c.client_name,
    COUNT(e.id)::INTEGER as entry_count,
    MAX(e.entry_timestamp) as latest_activity,
    cc.status
  FROM client_communication cc
  JOIN clients c ON c.id = cc.client_id
  LEFT JOIN client_communication_entries e ON e.parent_communication_id = cc.id
  WHERE cc.client_id = p_client_id
    AND DATE(cc.created_at) = CURRENT_DATE
    AND cc.status NOT IN ('Closed', 'Resolved')
  GROUP BY cc.id, c.client_name, cc.status
  ORDER BY latest_activity DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- 8. Update existing client_communication table - add thread_mode flag and appointment fields
ALTER TABLE client_communication ADD COLUMN IF NOT EXISTS is_thread BOOLEAN DEFAULT FALSE;
ALTER TABLE client_communication ADD COLUMN IF NOT EXISTS entry_count INTEGER DEFAULT 0;
ALTER TABLE client_communication ADD COLUMN IF NOT EXISTS next_appointment_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE client_communication ADD COLUMN IF NOT EXISTS next_appointment_remarks TEXT;

-- 9. Function to auto-update entry_count on parent
CREATE OR REPLACE FUNCTION update_parent_entry_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Update entry count on parent
  UPDATE client_communication
  SET entry_count = (
    SELECT COUNT(*) FROM client_communication_entries WHERE parent_communication_id = NEW.parent_communication_id
  ),
  is_thread = TRUE,
  updated_at = NOW()
  WHERE id = NEW.parent_communication_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_parent_count
  AFTER INSERT OR DELETE ON client_communication_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_parent_entry_count();

-- 10. Sample data (optional, for testing)
-- Uncomment to add test data:
/*
INSERT INTO client_communication_entries (parent_communication_id, entry_sequence, entry_timestamp, entry_type, brief, duration_minutes, entered_by_name)
SELECT
  cc.id,
  1,
  NOW() - INTERVAL '4 hours',
  'call',
  'Initial discussion about project requirements',
  15,
  'Manager'
FROM client_communication cc
WHERE cc.created_at > NOW() - INTERVAL '1 day'
LIMIT 1;
*/
