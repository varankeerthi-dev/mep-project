-- FR2: Assignment
ALTER TABLE client_communication
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES user_profiles(user_id);

CREATE INDEX IF NOT EXISTS idx_comm_assigned_to ON client_communication(assigned_to);

-- FR6: Threading
ALTER TABLE client_communication
  ADD COLUMN IF NOT EXISTS parent_communication_id UUID REFERENCES client_communication(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_comm_parent ON client_communication(parent_communication_id);

-- Cycle protection trigger
CREATE OR REPLACE FUNCTION check_comm_parent_cycle()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_communication_id = NEW.id THEN
    RAISE EXCEPTION 'Communication cannot be its own parent';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_comm_no_self_parent
  BEFORE INSERT OR UPDATE ON client_communication
  FOR EACH ROW
  WHEN (NEW.parent_communication_id IS NOT NULL)
  EXECUTE FUNCTION check_comm_parent_cycle();

-- FR7: Attachments
ALTER TABLE client_communication
  ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;
