-- 1. Create Standard Discount Price Lists Table
CREATE TABLE IF NOT EXISTS standard_discount_pricelists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pricelist_name VARCHAR(100) NOT NULL UNIQUE,
    discount_percent DECIMAL(5,2) DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Discount Type Enum
DO $$ BEGIN
    CREATE TYPE discount_type_enum AS ENUM ('Standard', 'Premium', 'Bulk', 'Special');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Update Clients Table with Discount Portfolio fields
ALTER TABLE clients ADD COLUMN IF NOT EXISTS discount_type discount_type_enum DEFAULT 'Special';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS standard_pricelist_id UUID REFERENCES standard_discount_pricelists(id);

-- 4. Default all existing clients to 'Special' (already handled by DEFAULT, but explicit for clarity)
UPDATE clients SET discount_type = 'Special' WHERE discount_type IS NULL;

-- 5. Add default 'Standard Price List' row for initial setup
INSERT INTO standard_discount_pricelists (pricelist_name, discount_percent) 
VALUES ('Standard List 1', 5.00)
ON CONFLICT (pricelist_name) DO NOTHING;

-- 6. Add mapping column to quotations for persistence
ALTER TABLE quotation_header ADD COLUMN IF NOT EXISTS applied_discount_type VARCHAR(20);
ALTER TABLE quotation_header ADD COLUMN IF NOT EXISTS applied_pricelist_id UUID REFERENCES standard_discount_pricelists(id);
