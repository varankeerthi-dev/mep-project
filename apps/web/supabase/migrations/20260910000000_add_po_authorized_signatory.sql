-- Add Authorized Signatory support to purchase orders
-- Fixes: PGRST204 "Could not find the 'authorized_signatory_id' column of 'purchase_orders' in the schema cache"
-- (The PO form saves/reads this field; the column was previously only added to
--  quotation_header and delivery_challans via src/database-signatory.sql.)

ALTER TABLE public.purchase_orders
ADD COLUMN IF NOT EXISTS authorized_signatory_id UUID;

ALTER TABLE public.client_purchase_orders
ADD COLUMN IF NOT EXISTS authorized_signatory_id UUID;

-- Force PostgREST to pick up the new column immediately
NOTIFY pgrst, 'reload schema';
