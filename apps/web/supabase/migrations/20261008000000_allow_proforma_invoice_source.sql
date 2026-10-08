-- Allow invoices to retain a Proforma source directly. The invoices.proforma_id
-- foreign key remains the canonical relation; source_type/source_id record the
-- selected source consistently with quotation, challan, and PO invoices.
ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_source_type_check;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_source_type_check
  CHECK (source_type = ANY (ARRAY['quotation'::text, 'challan'::text, 'po'::text, 'proforma'::text, 'direct'::text]));
