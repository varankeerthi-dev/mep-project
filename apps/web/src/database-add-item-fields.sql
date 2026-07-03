-- Add new item fields to materials table
-- Run this in Supabase SQL Editor

-- Taxable status (dropdown values: taxable, non-taxable, non-gst supply)
ALTER TABLE materials ADD COLUMN IF NOT EXISTS taxable VARCHAR(20) DEFAULT 'taxable';

-- Size dimensions (L x W x H format)
ALTER TABLE materials ADD COLUMN IF NOT EXISTS size_lwh VARCHAR(100);

-- Weight
ALTER TABLE materials ADD COLUMN IF NOT EXISTS weight DECIMAL(10,3);

-- Universal Product Code
ALTER TABLE materials ADD COLUMN IF NOT EXISTS upc VARCHAR(50);

-- Manufacturer Part Number
ALTER TABLE materials ADD COLUMN IF NOT EXISTS mpn VARCHAR(50);

-- European Article Number
ALTER TABLE materials ADD COLUMN IF NOT EXISTS ean VARCHAR(50);

-- Inventory Account (dropdown values: finished goods, inventory asset, work in progress)
ALTER TABLE materials ADD COLUMN IF NOT EXISTS inventory_account VARCHAR(30) DEFAULT 'inventory asset';

-- Add comments for field documentation
COMMENT ON COLUMN materials.taxable IS 'Tax status: taxable, non-taxable, non-gst supply';
COMMENT ON COLUMN materials.size_lwh IS 'Dimensions in L x W x H format';
COMMENT ON COLUMN materials.weight IS 'Item weight';
COMMENT ON COLUMN materials.upc IS 'Universal Product Code';
COMMENT ON COLUMN materials.mpn IS 'Manufacturer Part Number';
COMMENT ON COLUMN materials.ean IS 'European Article Number';
COMMENT ON COLUMN materials.inventory_account IS 'Inventory accounting category: finished goods, inventory asset, work in progress';

-- Note: All fields are nullable (default behavior) and not mandatory
-- Default values set for dropdown fields for convenience
