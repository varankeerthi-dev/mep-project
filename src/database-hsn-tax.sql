-- HSN/SAC + Tax hardening for materials
-- Run in Supabase SQL Editor

ALTER TABLE materials ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(10);
ALTER TABLE materials ADD COLUMN IF NOT EXISTS gst_rate DECIMAL(5,2);

-- Keep existing data valid; enforce numeric-only HSN up to 10 digits
ALTER TABLE materials DROP CONSTRAINT IF EXISTS materials_hsn_code_numeric_chk;
ALTER TABLE materials ADD CONSTRAINT materials_hsn_code_numeric_chk
CHECK (hsn_code IS NULL OR hsn_code ~ '^[0-9]{1,10}$');

-- Reasonable GST range
ALTER TABLE materials DROP CONSTRAINT IF EXISTS materials_gst_rate_range_chk;
ALTER TABLE materials ADD CONSTRAINT materials_gst_rate_range_chk
CHECK (gst_rate IS NULL OR (gst_rate >= 0 AND gst_rate <= 100));

