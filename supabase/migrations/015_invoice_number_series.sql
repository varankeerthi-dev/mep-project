-- Add invoice number, date, and PO fields to invoices table
-- Run this migration to add the new columns

-- 1. Add new columns to invoices table
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_no TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS po_number TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS po_date DATE;

-- 2. Addorganisation_id if not exists (for multi-tenant)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES organisations(id);

-- 3. Update CHECK constraint for source_type to include 'direct'
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_source_type_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_source_type_check 
  CHECK (source_type IN ('quotation', 'challan', 'po', 'direct'));

-- 4. Add unique constraint for invoice_no (optional, can be null for drafts)
-- Only unique where invoice_no is not null
DO $$
BEGIN
  -- Create partial unique index (PostgreSQL specific)
  CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_invoice_no_unique 
  ON invoices(invoice_no) 
  WHERE invoice_no IS NOT NULL;
EXCEPTION
  WHEN duplicate_table THEN
    NULL;
END $$;

-- 5. Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_no ON invoices(invoice_no) WHERE invoice_no IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_po_number ON invoices(po_number) WHERE po_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_organisation ON invoices(organisation_id);

-- 6. Create trigger function to auto-set invoice_date
CREATE OR REPLACE FUNCTION set_invoice_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_date IS NULL THEN
    NEW.invoice_date := CURRENT_DATE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Create trigger
DROP TRIGGER IF EXISTS trigger_set_invoice_date ON invoices;
CREATE TRIGGER trigger_set_invoice_date
  BEFORE INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION set_invoice_date();

-- 8. Backfill existing records with invoice_no from id if null
UPDATE invoices 
SET invoice_no = 'INV-' || TO_CHAR(created_at, 'YY') || '-' || UPPER(LEFT(id::TEXT, 8))
WHERE invoice_no IS NULL;

-- 9. Add index on client_purchase_orders for po_number lookup
CREATE INDEX IF NOT EXISTS idx_client_purchase_orders_po_number ON client_purchase_orders(po_number);
CREATE INDEX IF NOT EXISTS idx_client_purchase_orders_client ON client_purchase_orders(client_id);

-- 10. Update RLS policies to include organisation_id
-- (Assuming RLS is already enabled, this adds organisation filtering)
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoices_organisation_policy" ON invoices;
CREATE POLICY "invoices_organisation_policy" ON invoices
  FOR ALL USING (organisation_id = current_setting('app.current_organisation_id', true)::UUID);