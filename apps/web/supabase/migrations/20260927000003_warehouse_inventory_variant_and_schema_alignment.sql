-- 20260927000003_warehouse_inventory_variant_and_schema_alignment.sql
-- 1. Variant and linkage columns on variant-blind tables
ALTER TABLE sales_order_reservations ADD COLUMN IF NOT EXISTS company_variant_id uuid REFERENCES company_variants(id);
CREATE INDEX IF NOT EXISTS idx_sor_variant ON sales_order_reservations(company_variant_id);

ALTER TABLE warehouse_transfers ADD COLUMN IF NOT EXISTS company_variant_id uuid REFERENCES company_variants(id);
CREATE INDEX IF NOT EXISTS idx_wh_transfers_variant ON warehouse_transfers(company_variant_id);

ALTER TABLE warehouse_dispatches ADD COLUMN IF NOT EXISTS company_variant_id uuid REFERENCES company_variants(id);
ALTER TABLE warehouse_dispatches ADD COLUMN IF NOT EXISTS transfer_id uuid REFERENCES stock_transfers(id) ON DELETE SET NULL;
ALTER TABLE warehouse_dispatches ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES warehouses(id);
CREATE INDEX IF NOT EXISTS idx_wh_dispatches_variant ON warehouse_dispatches(company_variant_id);
CREATE INDEX IF NOT EXISTS idx_wh_dispatches_transfer ON warehouse_dispatches(transfer_id);
CREATE INDEX IF NOT EXISTS idx_wh_dispatches_warehouse ON warehouse_dispatches(warehouse_id);

ALTER TABLE warehouse_movements ADD COLUMN IF NOT EXISTS company_variant_id uuid REFERENCES company_variants(id);
CREATE INDEX IF NOT EXISTS idx_wh_movements_variant ON warehouse_movements(company_variant_id);

ALTER TABLE warehouse_pick_lists ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES warehouses(id);
ALTER TABLE warehouse_pick_lists ADD COLUMN IF NOT EXISTS transfer_id uuid REFERENCES stock_transfers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_wh_pick_lists_warehouse ON warehouse_pick_lists(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_wh_pick_lists_transfer ON warehouse_pick_lists(transfer_id);

ALTER TABLE warehouse_pick_list_items ADD COLUMN IF NOT EXISTS company_variant_id uuid REFERENCES company_variants(id);
CREATE INDEX IF NOT EXISTS idx_wh_pick_items_variant ON warehouse_pick_list_items(company_variant_id);

ALTER TABLE warehouse_replenishment_rules ADD COLUMN IF NOT EXISTS company_variant_id uuid REFERENCES company_variants(id);
CREATE INDEX IF NOT EXISTS idx_wh_replen_variant ON warehouse_replenishment_rules(company_variant_id);

ALTER TABLE warehouse_cycle_count_items ADD COLUMN IF NOT EXISTS company_variant_id uuid REFERENCES company_variants(id);
CREATE INDEX IF NOT EXISTS idx_wh_cc_variant ON warehouse_cycle_count_items(company_variant_id);

ALTER TABLE warehouse_bin_items ADD COLUMN IF NOT EXISTS company_variant_id uuid REFERENCES company_variants(id);
CREATE INDEX IF NOT EXISTS idx_wh_bin_items_comp_variant ON warehouse_bin_items(company_variant_id);

-- 2. Keep item_variant_id and company_variant_id synced in warehouse_bin_items
CREATE OR REPLACE FUNCTION trg_sync_bin_item_variants()
RETURNS trigger AS $$
BEGIN
  IF NEW.company_variant_id IS NULL AND NEW.item_variant_id IS NOT NULL THEN
    NEW.company_variant_id := NEW.item_variant_id;
  ELSIF NEW.item_variant_id IS NULL AND NEW.company_variant_id IS NOT NULL THEN
    NEW.item_variant_id := NEW.company_variant_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_bin_item_variants ON warehouse_bin_items;
CREATE TRIGGER trg_sync_bin_item_variants
BEFORE INSERT OR UPDATE ON warehouse_bin_items
FOR EACH ROW EXECUTE FUNCTION trg_sync_bin_item_variants();

-- 3. Replace single-item constraint on warehouse_bin_items with variant-aware unique index
DROP INDEX IF EXISTS ux_warehouse_bin_items_bin_item;
CREATE UNIQUE INDEX IF NOT EXISTS ux_warehouse_bin_items_bin_item_variant 
ON warehouse_bin_items (bin_id, item_id, item_variant_id) NULLS NOT DISTINCT 
WHERE deleted_at IS NULL;
