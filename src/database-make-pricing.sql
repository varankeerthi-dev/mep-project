-- Migration to include Make in Pricing Structure
-- Run this in Supabase SQL Editor

-- 1. Rename schedule_type to make in materials table safely
DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='materials' AND column_name='schedule_type') 
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='materials' AND column_name='make') THEN
    ALTER TABLE materials RENAME COLUMN schedule_type TO make;
  ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='materials' AND column_name='make') THEN
    ALTER TABLE materials ADD COLUMN make VARCHAR(100);
  END IF;
END $$;

-- 2. Add make column to item_variant_pricing
ALTER TABLE item_variant_pricing ADD COLUMN IF NOT EXISTS make VARCHAR(100);

-- 3. Update Unique Constraint for item_variant_pricing
-- First, identify the existing constraint name (usually item_variant_pricing_item_id_company_variant_id_key)
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'item_variant_pricing'::regclass AND contype = 'u';

    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE item_variant_pricing DROP CONSTRAINT ' || constraint_name;
    END IF;
END $$;

-- Add new unique constraint including make
-- We use COALESCE for make and company_variant_id because UNIQUE constraint treats NULLs as distinct
-- Actually, a better way is to use a unique index with NULL handling or just ensure we use empty strings
-- But for simplicity in SQL, we'll allow multiple NULLs if we don't handle them.
-- The requirement says "Validation to prevent duplicate price entries for same combination"
-- To strictly enforce this even with NULLs, we use a unique index:
CREATE UNIQUE INDEX IF NOT EXISTS idx_item_variant_pricing_unique_comb 
ON item_variant_pricing (item_id, COALESCE(company_variant_id, '00000000-0000-0000-0000-000000000000'), COALESCE(make, ''));

-- 4. Update get_item_price function with fallback logic
CREATE OR REPLACE FUNCTION get_item_price(
  p_item_id UUID,
  p_variant_id UUID DEFAULT NULL,
  p_make VARCHAR DEFAULT NULL,
  p_price_type VARCHAR DEFAULT 'sale'
)
RETURNS DECIMAL(12,2) AS $$
DECLARE
  v_price DECIMAL(12,2);
BEGIN
  -- 1. Try: Name + Variant + Make
  IF p_variant_id IS NOT NULL AND p_make IS NOT NULL AND p_make <> '' THEN
    IF p_price_type = 'sale' THEN
      SELECT sale_price INTO v_price FROM item_variant_pricing
      WHERE item_id = p_item_id AND company_variant_id = p_variant_id AND make = p_make AND is_active = true;
    ELSE
      SELECT purchase_price INTO v_price FROM item_variant_pricing
      WHERE item_id = p_item_id AND company_variant_id = p_variant_id AND make = p_make AND is_active = true;
    END IF;
  END IF;

  -- 2. Try: Name + Make (ignore Variant if not found or empty)
  IF v_price IS NULL AND p_make IS NOT NULL AND p_make <> '' THEN
    IF p_price_type = 'sale' THEN
      -- Try with any variant or no variant but with this make
      SELECT sale_price INTO v_price FROM item_variant_pricing
      WHERE item_id = p_item_id AND make = p_make AND is_active = true
      ORDER BY (company_variant_id = p_variant_id) DESC, created_at DESC LIMIT 1;
    ELSE
      SELECT purchase_price INTO v_price FROM item_variant_pricing
      WHERE item_id = p_item_id AND make = p_make AND is_active = true
      ORDER BY (company_variant_id = p_variant_id) DESC, created_at DESC LIMIT 1;
    END IF;
  END IF;

  -- 3. Try: Name + Variant (if make not found)
  IF v_price IS NULL AND p_variant_id IS NOT NULL THEN
    IF p_price_type = 'sale' THEN
      SELECT sale_price INTO v_price FROM item_variant_pricing
      WHERE item_id = p_item_id AND company_variant_id = p_variant_id AND (make IS NULL OR make = '') AND is_active = true;
    ELSE
      SELECT purchase_price INTO v_price FROM item_variant_pricing
      WHERE item_id = p_item_id AND company_variant_id = p_variant_id AND (make IS NULL OR make = '') AND is_active = true;
    END IF;
  END IF;

  -- 4. Fallback: Name only (backward compatibility)
  IF v_price IS NULL THEN
    IF p_price_type = 'sale' THEN
      SELECT sale_price INTO v_price FROM materials WHERE id = p_item_id;
    ELSE
      SELECT purchase_price INTO v_price FROM materials WHERE id = p_item_id;
    END IF;
  END IF;

  RETURN COALESCE(v_price, 0);
END;
$$ LANGUAGE plpgsql;

-- 5. Add make column to quotation_items for snapshotting
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS make VARCHAR(100);

-- 6. Add make column to delivery_challan_items
ALTER TABLE delivery_challan_items ADD COLUMN IF NOT EXISTS make VARCHAR(100);

-- 7. Add make column to material_inward_items/outward_items (optional but good for consistency)
ALTER TABLE material_inward_items ADD COLUMN IF NOT EXISTS make VARCHAR(100);
ALTER TABLE material_outward_items ADD COLUMN IF NOT EXISTS make VARCHAR(100);

