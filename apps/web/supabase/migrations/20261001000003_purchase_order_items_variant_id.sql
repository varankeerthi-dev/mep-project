-- Fix-forward for 20260929000004: both line-item INSERTs reference variant_id
-- but the column was never added, so every save failed with
-- 'column "variant_id" of relation "purchase_order_items" does not exist'.
-- No variants catalogue table exists live, so this is a plain id, not a FK.
-- Applied live 2026-10-01 as purchase_order_items_variant_id.
ALTER TABLE public.purchase_order_items
  ADD COLUMN IF NOT EXISTS variant_id uuid;
