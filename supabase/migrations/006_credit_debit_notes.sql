-- Migration 006: Credit Notes & Debit Notes (Formalized)
-- Creates credit_notes, credit_note_items tables
-- Formalizes existing debit_notes, debit_note_items tables with missing columns

-- ============================================================
-- CREDIT NOTES (Sales Module)
-- ============================================================

CREATE TABLE IF NOT EXISTS credit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  cn_number TEXT NOT NULL,
  cn_date DATE NOT NULL DEFAULT CURRENT_DATE,
  cn_type TEXT NOT NULL CHECK (cn_type IN ('Sales Return', 'Rate Difference', 'Discount', 'Rejection', 'Other')),
  reason TEXT,
  taxable_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  cgst_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  sgst_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  igst_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  approval_status TEXT NOT NULL DEFAULT 'Pending' CHECK (approval_status IN ('Approved', 'Pending', 'Rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS credit_note_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cn_id UUID NOT NULL REFERENCES credit_notes(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  hsn_code TEXT,
  quantity NUMERIC(15,2) NOT NULL DEFAULT 0,
  rate NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  taxable_value NUMERIC(15,2) NOT NULL DEFAULT 0,
  cgst_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  cgst_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  sgst_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  sgst_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  igst_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  igst_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for Credit Notes
CREATE INDEX IF NOT EXISTS idx_credit_notes_org ON credit_notes(organisation_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_client ON credit_notes(client_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_invoice ON credit_notes(invoice_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_date ON credit_notes(cn_date DESC);
CREATE INDEX IF NOT EXISTS idx_credit_notes_status ON credit_notes(approval_status);
CREATE INDEX IF NOT EXISTS idx_credit_note_items_cn ON credit_note_items(cn_id);
CREATE INDEX IF NOT EXISTS idx_credit_note_items_org ON credit_note_items(organisation_id);

-- RLS for Credit Notes
ALTER TABLE credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_note_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "credit_notes_tenant_access" ON credit_notes;
CREATE POLICY "credit_notes_tenant_access" ON credit_notes
  FOR ALL TO authenticated
  USING (public.user_can_access_org(organisation_id))
  WITH CHECK (public.user_can_access_org(organisation_id));

DROP POLICY IF EXISTS "credit_note_items_tenant_access" ON credit_note_items;
CREATE POLICY "credit_note_items_tenant_access" ON credit_note_items
  FOR ALL TO authenticated
  USING (public.user_can_access_org(organisation_id))
  WITH CHECK (public.user_can_access_org(organisation_id));

-- ============================================================
-- DEBIT NOTES (Purchase Module) - Formalize existing table
-- ============================================================

-- Add missing columns if they don't exist (for existing tables)
ALTER TABLE debit_notes ADD COLUMN IF NOT EXISTS taxable_amount NUMERIC(15,2) NOT NULL DEFAULT 0;
ALTER TABLE debit_notes ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC(15,2) NOT NULL DEFAULT 0;
ALTER TABLE debit_notes ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC(15,2) NOT NULL DEFAULT 0;
ALTER TABLE debit_notes ADD COLUMN IF NOT EXISTS igst_amount NUMERIC(15,2) NOT NULL DEFAULT 0;
ALTER TABLE debit_notes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Ensure debit_note_items has proper structure
ALTER TABLE debit_note_items ADD COLUMN IF NOT EXISTS hsn_code TEXT;
ALTER TABLE debit_note_items ADD COLUMN IF NOT EXISTS quantity NUMERIC(15,2) NOT NULL DEFAULT 0;
ALTER TABLE debit_note_items ADD COLUMN IF NOT EXISTS rate NUMERIC(15,2) NOT NULL DEFAULT 0;
ALTER TABLE debit_note_items ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0;
ALTER TABLE debit_note_items ADD COLUMN IF NOT EXISTS taxable_value NUMERIC(15,2) NOT NULL DEFAULT 0;
ALTER TABLE debit_note_items ADD COLUMN IF NOT EXISTS cgst_percent NUMERIC(5,2) NOT NULL DEFAULT 0;
ALTER TABLE debit_note_items ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC(15,2) NOT NULL DEFAULT 0;
ALTER TABLE debit_note_items ADD COLUMN IF NOT EXISTS sgst_percent NUMERIC(5,2) NOT NULL DEFAULT 0;
ALTER TABLE debit_note_items ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC(15,2) NOT NULL DEFAULT 0;
ALTER TABLE debit_note_items ADD COLUMN IF NOT EXISTS igst_percent NUMERIC(5,2) NOT NULL DEFAULT 0;
ALTER TABLE debit_note_items ADD COLUMN IF NOT EXISTS igst_amount NUMERIC(15,2) NOT NULL DEFAULT 0;
ALTER TABLE debit_note_items ADD COLUMN IF NOT EXISTS total_amount NUMERIC(15,2) NOT NULL DEFAULT 0;
ALTER TABLE debit_note_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Indexes for Debit Notes (if not exists)
CREATE INDEX IF NOT EXISTS idx_debit_notes_org ON debit_notes(organisation_id);
CREATE INDEX IF NOT EXISTS idx_debit_notes_vendor ON debit_notes(vendor_id);
CREATE INDEX IF NOT EXISTS idx_debit_notes_bill ON debit_notes(bill_id);
CREATE INDEX IF NOT EXISTS idx_debit_notes_date ON debit_notes(dn_date DESC);
CREATE INDEX IF NOT EXISTS idx_debit_notes_status ON debit_notes(approval_status);
CREATE INDEX IF NOT EXISTS idx_debit_note_items_dn ON debit_note_items(dn_id);
CREATE INDEX IF NOT EXISTS idx_debit_note_items_org ON debit_note_items(organisation_id);

-- Ensure RLS is enabled for Debit Notes
ALTER TABLE debit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE debit_note_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "debit_notes_tenant_access" ON debit_notes;
CREATE POLICY "debit_notes_tenant_access" ON debit_notes
  FOR ALL TO authenticated
  USING (public.user_can_access_org(organisation_id))
  WITH CHECK (public.user_can_access_org(organisation_id));

DROP POLICY IF EXISTS "debit_note_items_tenant_access" ON debit_note_items;
CREATE POLICY "debit_note_items_tenant_access" ON debit_note_items
  FOR ALL TO authenticated
  USING (public.user_can_access_org(organisation_id))
  WITH CHECK (public.user_can_access_org(organisation_id));

-- ============================================================
-- TRIGGERS: Auto-update updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION fn_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_credit_notes_updated_at ON credit_notes;
CREATE TRIGGER trg_credit_notes_updated_at
  BEFORE UPDATE ON credit_notes
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

DROP TRIGGER IF EXISTS trg_debit_notes_updated_at ON debit_notes;
CREATE TRIGGER trg_debit_notes_updated_at
  BEFORE UPDATE ON debit_notes
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE credit_notes IS 'Credit notes issued to clients (reduces client outstanding)';
COMMENT ON TABLE credit_note_items IS 'Line items for credit notes';
COMMENT ON TABLE debit_notes IS 'Debit notes issued to vendors (reduces vendor payable)';
COMMENT ON TABLE debit_note_items IS 'Line items for debit notes';

COMMENT ON COLUMN credit_notes.cn_type IS 'Reason: Sales Return, Rate Difference, Discount, Rejection, Other';
COMMENT ON COLUMN credit_notes.approval_status IS 'Only Approved CNs affect client ledger';
COMMENT ON COLUMN debit_notes.dn_type IS 'Reason: Purchase Return, Rate Difference, Discount, Rejection, Other';
COMMENT ON COLUMN debit_notes.approval_status IS 'Only Approved DNs affect vendor ledger';
