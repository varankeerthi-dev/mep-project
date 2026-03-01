-- MEP PROJECT - MATERIAL MODULE ENHANCEMENT
-- This script consolidates 'materials' and 'services' into a single 'materials' table with 'item_type'

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

-- 4. Migrate data from services to materials if services table exists
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'services') THEN
        INSERT INTO materials (
            name, 
            item_code, 
            unit, 
            sale_price, 
            purchase_price, 
            hsn_code, 
            gst_rate, 
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
        
        -- Optional: Rename old services table instead of dropping it immediately for safety
        -- ALTER TABLE services RENAME TO services_old;
    END IF;
END $$;
