-- Migration: 20260923000001_add_item_classification_and_overrides_to_materials.sql
-- Description: Add classification and account override fields to public.materials

BEGIN;

-- 1. Drop old constraints and normalize existing values in item_classification if column exists
ALTER TABLE public.materials DROP CONSTRAINT IF EXISTS materials_item_classification_check;
ALTER TABLE public.materials DROP CONSTRAINT IF EXISTS chk_materials_item_classification;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'materials' AND column_name = 'item_classification'
  ) THEN
    UPDATE public.materials 
    SET item_classification = CASE 
      WHEN LOWER(item_classification) = 'goods_sold' THEN 'STOCK_IN_TRADE'
      WHEN LOWER(item_classification) = 'finished_good' THEN 'FINISHED_GOOD'
      WHEN LOWER(item_classification) = 'raw_material' THEN 'RAW_MATERIAL'
      WHEN LOWER(item_classification) = 'consumable' THEN 'CONSUMABLE'
      ELSE 'STOCK_IN_TRADE'
    END
    WHERE item_classification IS NOT NULL;

    ALTER TABLE public.materials ALTER COLUMN item_classification DROP DEFAULT;
    ALTER TABLE public.materials ALTER COLUMN item_classification TYPE text;
  ELSE
    ALTER TABLE public.materials ADD COLUMN item_classification text NULL;
  END IF;
END $$;

-- 2. Add columns to public.materials
ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS gl_classification text DEFAULT 'EXPENSE',
  ADD COLUMN IF NOT EXISTS is_stockable boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_depreciable boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS useful_life_years numeric(10,2) NULL,
  ADD COLUMN IF NOT EXISTS asset_category_id uuid NULL,
  ADD COLUMN IF NOT EXISTS fixed_asset_account_id uuid NULL REFERENCES public.accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sales_income_account_id uuid NULL REFERENCES public.accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS purchase_account_id uuid NULL REFERENCES public.accounts(id) ON DELETE SET NULL;

-- 3. Constraints
ALTER TABLE public.materials DROP CONSTRAINT IF EXISTS chk_materials_gl_classification;
ALTER TABLE public.materials ADD CONSTRAINT chk_materials_gl_classification 
  CHECK (gl_classification IN ('INVENTORY_ASSET','FIXED_ASSET','EXPENSE'));

ALTER TABLE public.materials DROP CONSTRAINT IF EXISTS chk_materials_item_classification;
ALTER TABLE public.materials ADD CONSTRAINT chk_materials_item_classification 
  CHECK (item_classification IS NULL OR item_classification IN ('STOCK_IN_TRADE','RAW_MATERIAL','WIP','FINISHED_GOOD','CONSUMABLE','TOOL','PLANT_MACHINERY','VEHICLE','SERVICE','OTHER'));

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_materials_gl_classification ON public.materials (gl_classification);
CREATE INDEX IF NOT EXISTS idx_materials_asset_category ON public.materials (asset_category_id);

COMMIT;
