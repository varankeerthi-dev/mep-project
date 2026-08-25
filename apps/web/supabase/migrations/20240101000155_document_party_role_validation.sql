-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration: 20240101000155_document_party_role_validation.sql
-- Description: Add party_id and party_role to document headers with validation triggers
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Document Header Column Updates
ALTER TABLE quotation_header
  ADD COLUMN IF NOT EXISTS party_id UUID REFERENCES parties(id),
  ADD COLUMN IF NOT EXISTS party_role party_role_type DEFAULT 'customer';

ALTER TABLE invoice_header
  ADD COLUMN IF NOT EXISTS party_id UUID REFERENCES parties(id),
  ADD COLUMN IF NOT EXISTS party_role party_role_type DEFAULT 'customer';

ALTER TABLE debit_note_header
  ADD COLUMN IF NOT EXISTS party_id UUID REFERENCES parties(id),
  ADD COLUMN IF NOT EXISTS party_role party_role_type DEFAULT 'vendor';

ALTER TABLE credit_note_header
  ADD COLUMN IF NOT EXISTS party_id UUID REFERENCES parties(id),
  ADD COLUMN IF NOT EXISTS party_role party_role_type DEFAULT 'customer';

ALTER TABLE delivery_challans
  ADD COLUMN IF NOT EXISTS party_id UUID REFERENCES parties(id),
  ADD COLUMN IF NOT EXISTS party_role party_role_type DEFAULT 'customer';

-- 2. Document Role Validation Trigger
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

DROP TRIGGER IF EXISTS trg_quotation_party_role_val ON quotation_header;
CREATE TRIGGER trg_quotation_party_role_val BEFORE INSERT OR UPDATE ON quotation_header
FOR EACH ROW EXECUTE FUNCTION trg_validate_document_party_role_fn();

DROP TRIGGER IF EXISTS trg_invoice_party_role_val ON invoice_header;
CREATE TRIGGER trg_invoice_party_role_val BEFORE INSERT OR UPDATE ON invoice_header
FOR EACH ROW EXECUTE FUNCTION trg_validate_document_party_role_fn();

DROP TRIGGER IF EXISTS trg_debit_note_party_role_val ON debit_note_header;
CREATE TRIGGER trg_debit_note_party_role_val BEFORE INSERT OR UPDATE ON debit_note_header
FOR EACH ROW EXECUTE FUNCTION trg_validate_document_party_role_fn();

DROP TRIGGER IF EXISTS trg_credit_note_party_role_val ON credit_note_header;
CREATE TRIGGER trg_credit_note_party_role_val BEFORE INSERT OR UPDATE ON credit_note_header
FOR EACH ROW EXECUTE FUNCTION trg_validate_document_party_role_fn();
