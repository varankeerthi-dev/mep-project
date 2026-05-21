-- Migration: Add Dimensions and Weight fields to materials table
-- Date: 2026-05-21

-- 1. Add dimension and dimension_unit columns
ALTER TABLE materials 
ADD COLUMN IF NOT EXISTS dimension TEXT,
ADD COLUMN IF NOT EXISTS dimension_unit TEXT DEFAULT 'cm' CHECK (dimension_unit IN ('cm', 'in'));

-- 2. Add weight and weight_unit columns
ALTER TABLE materials 
ADD COLUMN IF NOT EXISTS weight NUMERIC,
ADD COLUMN IF NOT EXISTS weight_unit TEXT DEFAULT 'kg' CHECK (weight_unit IN ('kg', 'lb'));

-- 3. Comment for documentation
COMMENT ON COLUMN materials.dimension IS 'Stores LxWxH as text, e.g. 10x10x10';
COMMENT ON COLUMN materials.weight IS 'Stores numeric weight value';
