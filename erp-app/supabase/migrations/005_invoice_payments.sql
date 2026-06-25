-- Migration 005: Invoice Payment Recording
-- Adds payment mode, reference no, and status columns to receipts table
-- Links receipts to invoices for payment tracking

-- Add columns to receipts table if they don't exist
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS payment_mode TEXT;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS reference_no TEXT;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'paid';
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS notes TEXT;

-- Ensure invoice_id column exists (it should from migration 004)
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_receipts_invoice_id ON receipts(invoice_id);
CREATE INDEX IF NOT EXISTS idx_receipts_status ON receipts(status);
CREATE INDEX IF NOT EXISTS idx_receipts_payment_mode ON receipts(payment_mode);

-- Add paid_amount to invoices to track total payments received
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(15,2) DEFAULT 0;

-- Function to auto-update invoice paid_amount when receipts change
CREATE OR REPLACE FUNCTION fn_update_invoice_paid_amount()
RETURNS TRIGGER AS $$
DECLARE
  target_invoice_id UUID;
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    target_invoice_id := NEW.invoice_id;
  ELSIF TG_OP = 'DELETE' THEN
    target_invoice_id := OLD.invoice_id;
  END IF;

  IF target_invoice_id IS NOT NULL THEN
    UPDATE invoices 
    SET paid_amount = (
      SELECT COALESCE(SUM(amount), 0) 
      FROM receipts 
      WHERE invoice_id = target_invoice_id 
      AND status = 'paid'
    )
    WHERE id = target_invoice_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists and recreate
DROP TRIGGER IF EXISTS trg_update_invoice_paid_amount ON receipts;
CREATE TRIGGER trg_update_invoice_paid_amount
  AFTER INSERT OR UPDATE OR DELETE ON receipts
  FOR EACH ROW EXECUTE FUNCTION fn_update_invoice_paid_amount();

-- Backfill existing invoices with paid_amount from existing receipts
UPDATE invoices i
SET paid_amount = (
  SELECT COALESCE(SUM(r.amount), 0)
  FROM receipts r
  WHERE r.invoice_id = i.id
  AND (r.status = 'paid' OR r.status IS NULL)
);

-- Add RLS policies for the new columns (inherit from existing receipts policies)
-- No additional RLS needed as they're on the same table

COMMENT ON COLUMN receipts.payment_mode IS 'Payment method: bank_transfer, cash, upi, cheque';
COMMENT ON COLUMN receipts.reference_no IS 'Bank reference, UTR, cheque number, etc.';
COMMENT ON COLUMN receipts.status IS 'Payment status: draft (no ledger impact), paid (ledger credit), refunded (reversed)';
COMMENT ON COLUMN receipts.notes IS 'Additional notes about the payment';
COMMENT ON COLUMN receipts.invoice_id IS 'Link to the invoice this payment is for';
COMMENT ON COLUMN invoices.paid_amount IS 'Total amount received against this invoice (auto-calculated)';
