-- FR2: Add assigned_to column to client_communication
ALTER TABLE client_communication
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES user_profiles(user_id);

CREATE INDEX IF NOT EXISTS idx_comm_assigned_to ON client_communication(assigned_to);
