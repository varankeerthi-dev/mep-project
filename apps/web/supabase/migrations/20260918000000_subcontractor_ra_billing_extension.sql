-- RA Billing: extend subcontractor_invoices for full bill lifecycle
-- Adds financial breakdown, cumulative billing controls, and status flow fields.

ALTER TABLE public.subcontractor_invoices
  ADD COLUMN IF NOT EXISTS subtotal numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gross_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_type text DEFAULT 'GST',
  ADD COLUMN IF NOT EXISTS cgst_percent numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sgst_percent numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS igst_percent numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cgst_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sgst_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS igst_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tds_percent numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tds_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retention_percent numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retention_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS advance_percent numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS advance_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billed_qty numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS measured_qty numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cumulative_billed_qty numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_final_bill boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS previous_invoice_id uuid DEFAULT NULL::uuid,
  ADD COLUMN IF NOT EXISTS work_order_version_id uuid DEFAULT NULL::uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz DEFAULT NULL::timestamp with time zone,
  ADD COLUMN IF NOT EXISTS approved_by uuid DEFAULT NULL::uuid,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz DEFAULT NULL::timestamp with time zone,
  ADD COLUMN IF NOT EXISTS payment_id uuid DEFAULT NULL::uuid;

-- Backfill gross_amount/net_amount from amount for existing rows
UPDATE public.subcontractor_invoices
SET gross_amount = COALESCE(amount, 0),
    net_amount = COALESCE(amount, 0)
WHERE gross_amount IS NULL OR net_amount IS NULL;
