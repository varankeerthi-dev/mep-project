-- Migration 008: Link clients to vendors for dual-role parties

ALTER TABLE clients ADD COLUMN IF NOT EXISTS linked_vendor_id UUID REFERENCES purchase_vendors(id);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS party_type TEXT DEFAULT 'client' CHECK (party_type IN ('client', 'vendor', 'both'));

COMMENT ON COLUMN clients.linked_vendor_id IS 'References purchase_vendors.id when this client is also a vendor';
COMMENT ON COLUMN clients.party_type IS 'Identifies if this is a pure client, vendor, or dual-role party';

-- Add party_type to vendors too for symmetry
ALTER TABLE purchase_vendors ADD COLUMN IF NOT EXISTS linked_client_id UUID REFERENCES clients(id);
ALTER TABLE purchase_vendors ADD COLUMN IF NOT EXISTS party_type TEXT DEFAULT 'vendor' CHECK (party_type IN ('vendor', 'client', 'both'));

COMMENT ON COLUMN purchase_vendors.linked_client_id IS 'References clients.id when this vendor is also a client';
COMMENT ON COLUMN purchase_vendors.party_type IS 'Identifies if this is a pure vendor, client, or dual-role party';
