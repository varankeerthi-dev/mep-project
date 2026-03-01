-- 1. Create enum type for item_type
DO $$ BEGIN
    CREATE TYPE item_type_enum AS ENUM ('product', 'service');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Add item_type column to materials table
ALTER TABLE materials ADD COLUMN IF NOT EXISTS item_type item_type_enum DEFAULT 'product';

-- 3. Update existing items to 'product'
UPDATE materials SET item_type = 'product' WHERE item_type IS NULL;

-- 4. Migrate data from services to materials
-- Note: Mapping service_name to name, service_code to item_code
INSERT INTO materials (
    name, 
    item_code, 
    unit, 
    sale_price, 
    purchase_price, 
    hsn_code, 
    tax_rate, 
    is_active, 
    item_type,
    created_at,
    updated_at
)
SELECT 
    service_name, 
    service_code, 
    unit, 
    sale_price, 
    purchase_price, 
    hsn_code, 
    tax_rate, 
    is_active, 
    'service'::item_type_enum,
    created_at,
    updated_at
FROM services
ON CONFLICT (item_code) DO NOTHING;

-- 5. Drop services table (After verification, but for this task we assume we do it as part of the move)
-- DROP TABLE services;
