-- Client shipping addresses table
-- Allows multiple shipping addresses per client for invoices

CREATE TABLE IF NOT EXISTS client_shipping_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  pincode TEXT NOT NULL,
  contact_person TEXT,
  contact_phone TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_shipping_addresses_client_id ON client_shipping_addresses(client_id);
CREATE INDEX IF NOT EXISTS idx_client_shipping_addresses_organisation_id ON client_shipping_addresses(organisation_id);

ALTER TABLE client_shipping_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_shipping_addresses_all_access" ON client_shipping_addresses;

CREATE POLICY "client_shipping_addresses_all_access" ON client_shipping_addresses
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add shipping_address_id to invoices table
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS shipping_address_id UUID REFERENCES client_shipping_addresses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_shipping_address_id ON invoices(shipping_address_id);
