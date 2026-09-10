-- Numbering integrity: prevent duplicate document numbers per organisation.
--
-- Background (2026-09 audit): the `prevent_duplicate_numbers` setting stored in
-- the `settings` table was never read by any generator, and most document number
-- columns had no org-scoped uniqueness, so duplicate PO/invoice/DC numbers could
-- be persisted silently. This migration mirrors the convention introduced in
-- 20260817000005 (quotation_header, subcontractor_invoices): drop any legacy
-- global unique constraint, then add a partial unique index scoped to
-- organisation_id.
--
-- Note: the purchase_orders table also needs the authorized_signatory_id column
-- from migration 20260910000000 applied first if it is not yet present.

-- purchase_orders.po_number
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_orders_po_number_key') THEN
    ALTER TABLE public.purchase_orders DROP CONSTRAINT purchase_orders_po_number_key;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_orders_org_po_number
  ON public.purchase_orders (organisation_id, po_number)
  WHERE po_number IS NOT NULL;

-- delivery_challans.dc_number
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'delivery_challans_dc_number_key') THEN
    ALTER TABLE public.delivery_challans DROP CONSTRAINT delivery_challans_dc_number_key;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_challans_org_dc_number
  ON public.delivery_challans (organisation_id, dc_number)
  WHERE dc_number IS NOT NULL;

-- invoices.invoice_no
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_org_invoice_no
  ON public.invoices (organisation_id, invoice_no)
  WHERE invoice_no IS NOT NULL;

-- credit_notes.cn_number
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_notes_org_cn_number
  ON public.credit_notes (organisation_id, cn_number)
  WHERE cn_number IS NOT NULL;
