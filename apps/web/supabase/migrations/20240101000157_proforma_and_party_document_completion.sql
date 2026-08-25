-- Complete the unified Party migration for documents that were not covered
-- by the initial party-role validation migration.

-- Ensure document validation function exists
CREATE OR REPLACE FUNCTION trg_validate_document_party_role_fn()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.party_id IS NOT NULL THEN
    IF NOT validate_party_role(NEW.organisation_id, NEW.party_id, NEW.party_role) THEN
      RAISE EXCEPTION 'Party % does not possess role % in organisation %', NEW.party_id, NEW.party_role, NEW.organisation_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Proforma invoices are operational/pre-financial documents and still need
-- the same canonical party identity used by quotations and invoices.
ALTER TABLE proforma_invoices
  ADD COLUMN IF NOT EXISTS party_id UUID REFERENCES parties(id),
  ADD COLUMN IF NOT EXISTS party_role party_role_type DEFAULT 'customer';

-- Backfill proforma party identity from the existing client relationship when
-- a matching customer party exists. Legacy client_id remains untouched for
-- compatibility until the UI/API migration is complete.
UPDATE proforma_invoices pi
SET party_id = pi.client_id,
    party_role = 'customer'::party_role_type
WHERE pi.party_id IS NULL
  AND pi.client_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM parties p
    JOIN party_roles pr ON pr.party_id = p.id
    WHERE p.id = pi.client_id
      AND p.organisation_id = pi.organisation_id
      AND pr.role = 'customer'
  );

-- Delivery challan validation trigger
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'delivery_challans') AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'delivery_challans' AND column_name = 'party_id') THEN
    DROP TRIGGER IF EXISTS trg_delivery_challan_party_role_val ON delivery_challans;
    CREATE TRIGGER trg_delivery_challan_party_role_val
    BEFORE INSERT OR UPDATE ON delivery_challans
    FOR EACH ROW EXECUTE FUNCTION trg_validate_document_party_role_fn();
  END IF;
END $$;

-- Proforma role validation trigger
DROP TRIGGER IF EXISTS trg_proforma_party_role_val ON proforma_invoices;
CREATE TRIGGER trg_proforma_party_role_val
BEFORE INSERT OR UPDATE ON proforma_invoices
FOR EACH ROW EXECUTE FUNCTION trg_validate_document_party_role_fn();

-- Useful indexes for canonical party lookups
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotation_header' AND column_name = 'party_id') THEN
    CREATE INDEX IF NOT EXISTS idx_quotation_header_party ON quotation_header (organisation_id, party_id, party_role);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoice_header' AND column_name = 'party_id') THEN
    CREATE INDEX IF NOT EXISTS idx_invoice_header_party ON invoice_header (organisation_id, party_id, party_role);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'party_id') THEN
    CREATE INDEX IF NOT EXISTS idx_invoices_party ON invoices (organisation_id, party_id, party_role);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'proforma_invoices' AND column_name = 'party_id') THEN
    CREATE INDEX IF NOT EXISTS idx_proforma_invoices_party ON proforma_invoices (organisation_id, party_id, party_role);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'credit_note_header' AND column_name = 'party_id') THEN
    CREATE INDEX IF NOT EXISTS idx_credit_note_header_party ON credit_note_header (organisation_id, party_id, party_role);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'debit_note_header' AND column_name = 'party_id') THEN
    CREATE INDEX IF NOT EXISTS idx_debit_note_header_party ON debit_note_header (organisation_id, party_id, party_role);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'delivery_challans' AND column_name = 'party_id') THEN
    CREATE INDEX IF NOT EXISTS idx_delivery_challans_party ON delivery_challans (organisation_id, party_id, party_role);
  END IF;
END $$;
