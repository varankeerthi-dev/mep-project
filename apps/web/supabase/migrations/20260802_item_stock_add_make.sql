-- Item stock granularity: add `make` so the same variant can hold separate
-- stock per make/brand (e.g. "Blue" in two different makes).
--
-- Previously stock was unique per (item_id, company_variant_id, warehouse_id),
-- which collapsed all makes of a variant into a single stock slot and made it
-- impossible to track per-make inventory.

ALTER TABLE public.item_stock
  ADD COLUMN IF NOT EXISTS make text;

-- Replace the old unique constraint. We drop any pre-existing unique
-- constraints (the legacy one was UNIQUE(item_id, company_variant_id, warehouse_id))
-- because it would reject two stock rows for the same (item, variant, warehouse)
-- that differ only by make.
DO $$
DECLARE
  con record;
BEGIN
  FOR con IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.item_stock'::regclass
      AND contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE public.item_stock DROP CONSTRAINT %I', con.conname);
  END LOOP;
END $$;

-- NULLS NOT DISTINCT makes the "no variant" / "no make" rows behave as one
-- slot instead of allowing unlimited duplicate default rows (PG 15+).
ALTER TABLE public.item_stock
  ADD CONSTRAINT item_stock_item_variant_make_warehouse_key
  UNIQUE NULLS NOT DISTINCT (item_id, company_variant_id, make, warehouse_id);

-- Keep lookups on the common filter fast.
CREATE INDEX IF NOT EXISTS item_stock_item_warehouse_idx
  ON public.item_stock (item_id, warehouse_id);
