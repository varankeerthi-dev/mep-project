-- ═══════════════════════════════════════════════════════════════════════════════
-- Document Lifecycle Statuses Migration
-- Adds new status values for state machine consistency
-- ═══════════════════════════════════════════════════════════════════════════════

-- 0. Preparatory: Fix any NULL or unexpected status values before adding constraints
UPDATE proforma_invoices SET status = 'draft' WHERE status IS NULL OR status = '';
UPDATE invoices SET status = 'draft' WHERE status IS NULL OR status = '';
UPDATE quotation_header SET status = 'Draft' WHERE status IS NULL OR status = '';

-- 1. Proforma Invoices: Drop old check constraint and add updated one
ALTER TABLE proforma_invoices
  DROP CONSTRAINT IF EXISTS proforma_invoices_status_check;
ALTER TABLE proforma_invoices
  ADD CONSTRAINT proforma_invoices_status_check
  CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'converted', 'expired'));

-- 2. Update existing proformas that have been converted but still show 'accepted'
UPDATE proforma_invoices
SET status = 'converted'
WHERE converted_invoice_id IS NOT NULL
  AND status NOT IN ('converted', 'expired');

-- 3. Invoices: Drop old check constraint and add updated one
ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE invoices
  ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('draft', 'final', 'converted', 'sent', 'paid', 'overdue', 'cancelled', 'partially_paid'));

-- 4. Update existing invoices that have been converted to credit notes or other docs
UPDATE invoices
SET status = 'converted'
WHERE converted_to_id IS NOT NULL
  AND status = 'final';

-- 5. Backfill: Mark quotations as Expired if valid_till is past (one-time migration)
UPDATE quotation_header
SET status = 'Expired'
WHERE valid_till IS NOT NULL
  AND valid_till < CURRENT_DATE
  AND status NOT IN ('Converted', 'Cancelled', 'Expired', 'Approved');

COMMENT ON TABLE proforma_invoices IS 'Proforma invoices with lifecycle states: draft -> sent -> accepted -> converted/expired';
COMMENT ON TABLE invoices IS 'Invoices with lifecycle states: draft -> final/sent -> paid/overdue/cancelled -> converted';
COMMENT ON TABLE quotation_header IS 'Quotations with lifecycle states: Draft -> Sent -> Approved/Converted/Expired/Cancelled';
