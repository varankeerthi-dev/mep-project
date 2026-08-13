-- Client Contacts (CFT) — unlimited additional contacts per client
-- and linkage to client_communication so we can record who we spoke with.

-- 1. client_contacts table
CREATE TABLE IF NOT EXISTS client_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  organisation_id UUID REFERENCES organisations(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  designation TEXT,
  phone_code TEXT DEFAULT '+91',
  phone TEXT,
  email TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_contacts_client_id ON client_contacts(client_id);
CREATE INDEX IF NOT EXISTS idx_client_contacts_org_id ON client_contacts(organisation_id);

-- 2. Link communication log to the specific contact spoken with
ALTER TABLE client_communication
  ADD COLUMN IF NOT EXISTS contacted_contact_id UUID REFERENCES client_contacts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_client_communication_contacted
  ON client_communication(contacted_contact_id);

-- 3. RLS
ALTER TABLE client_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_contacts_org_access" ON client_contacts;
CREATE POLICY "client_contacts_org_access" ON client_contacts
  FOR ALL USING (organisation_id IN (SELECT get_user_organisations()));

-- 4. updated_at trigger
CREATE OR REPLACE FUNCTION update_client_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_client_contacts_updated_at ON client_contacts;
CREATE TRIGGER set_client_contacts_updated_at
  BEFORE UPDATE ON client_contacts
  FOR EACH ROW EXECUTE FUNCTION update_client_contacts_updated_at();
