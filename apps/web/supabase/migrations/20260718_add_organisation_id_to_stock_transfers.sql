ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES organisations(id);
ALTER TABLE stock_transfer_items ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES organisations(id);
ALTER TABLE stock_transfer_items ADD COLUMN IF NOT EXISTS received_qty NUMERIC DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_stock_transfers_organisation_id ON stock_transfers(organisation_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfer_items_organisation_id ON stock_transfer_items(organisation_id);
