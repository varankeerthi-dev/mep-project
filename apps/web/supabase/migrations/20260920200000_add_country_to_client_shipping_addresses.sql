-- Add country column to client_shipping_addresses
-- Supports capturing the country of a client's shipping address
-- (defaults to India for existing rows and new inserts).

ALTER TABLE public.client_shipping_addresses
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'India';

-- Backfill existing rows with the default country
UPDATE public.client_shipping_addresses
SET country = 'India'
WHERE country IS NULL;
