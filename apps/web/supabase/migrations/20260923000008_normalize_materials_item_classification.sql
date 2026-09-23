-- Migration: 20260923000008_normalize_materials_item_classification.sql
-- Description: Automatically normalize item_classification and gl_classification, and expand check constraint to tolerate legacy representations.

BEGIN;

-- 1. Create or replace normalization function for materials
CREATE OR REPLACE FUNCTION public.trg_normalize_material_classification()
RETURNS TRIGGER AS $$
DECLARE
  v_raw TEXT;
BEGIN
  -- Normalize item_classification
  IF NEW.item_classification IS NOT NULL AND TRIM(NEW.item_classification) <> '' THEN
    v_raw := UPPER(TRIM(NEW.item_classification));
    IF v_raw IN ('GOODS_SOLD', 'STOCK-IN-TRADE', 'STOCK_IN_TRADE', 'TRADING') THEN
      NEW.item_classification := 'STOCK_IN_TRADE';
    ELSIF v_raw IN ('FINISHED_GOOD', 'FINISHED_GOODS', 'FG') THEN
      NEW.item_classification := 'FINISHED_GOOD';
    ELSIF v_raw IN ('RAW_MATERIAL', 'RAW_MATERIALS', 'RM') THEN
      NEW.item_classification := 'RAW_MATERIAL';
    ELSIF v_raw IN ('CONSUMABLE', 'CONSUMABLES') THEN
      NEW.item_classification := 'CONSUMABLE';
    ELSIF v_raw IN ('TOOL', 'TOOLS') THEN
      NEW.item_classification := 'TOOL';
    ELSIF v_raw IN ('PLANT_MACHINERY', 'MACHINERY', 'PLANT') THEN
      NEW.item_classification := 'PLANT_MACHINERY';
    ELSIF v_raw IN ('VEHICLE', 'VEHICLES') THEN
      NEW.item_classification := 'VEHICLE';
    ELSIF v_raw IN ('SERVICE', 'SERVICES', 'LABOUR', 'LABOR') THEN
      NEW.item_classification := 'SERVICE';
    ELSIF v_raw = 'WIP' THEN
      NEW.item_classification := 'WIP';
    ELSIF v_raw = 'OTHER' THEN
      NEW.item_classification := 'OTHER';
    ELSE
      NEW.item_classification := v_raw;
    END IF;
  ELSE
    NEW.item_classification := 'STOCK_IN_TRADE';
  END IF;

  -- Normalize gl_classification
  IF NEW.gl_classification IS NOT NULL AND TRIM(NEW.gl_classification) <> '' THEN
    NEW.gl_classification := UPPER(TRIM(NEW.gl_classification));
  ELSE
    IF NEW.item_classification IN ('STOCK_IN_TRADE', 'RAW_MATERIAL', 'WIP', 'FINISHED_GOOD') THEN
      NEW.gl_classification := 'INVENTORY_ASSET';
    ELSIF NEW.item_classification IN ('TOOL', 'PLANT_MACHINERY', 'VEHICLE') THEN
      NEW.gl_classification := 'FIXED_ASSET';
    ELSE
      NEW.gl_classification := 'EXPENSE';
    END IF;
  END IF;

  -- Ensure is_stockable has sensible defaults if null
  IF NEW.is_stockable IS NULL THEN
    NEW.is_stockable := (NEW.gl_classification = 'INVENTORY_ASSET');
  END IF;

  -- Ensure is_depreciable has sensible defaults if null
  IF NEW.is_depreciable IS NULL THEN
    NEW.is_depreciable := (NEW.gl_classification = 'FIXED_ASSET');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Bind trigger BEFORE INSERT OR UPDATE on public.materials
DROP TRIGGER IF EXISTS trg_normalize_materials_classification ON public.materials;
CREATE TRIGGER trg_normalize_materials_classification
BEFORE INSERT OR UPDATE ON public.materials
FOR EACH ROW
EXECUTE FUNCTION public.trg_normalize_material_classification();

-- 3. Update check constraint to accept both uppercase canonical values and legacy values (just in case trigger is ever bypassed)
ALTER TABLE public.materials DROP CONSTRAINT IF EXISTS chk_materials_item_classification;
ALTER TABLE public.materials ADD CONSTRAINT chk_materials_item_classification 
  CHECK (
    item_classification IS NULL 
    OR item_classification IN (
      'STOCK_IN_TRADE','RAW_MATERIAL','WIP','FINISHED_GOOD','CONSUMABLE','TOOL','PLANT_MACHINERY','VEHICLE','SERVICE','OTHER',
      'goods_sold','raw_material','wip','finished_good','consumable','tool','service','other'
    )
  );

-- 4. Clean up any lingering lowercase entries in materials table
UPDATE public.materials
SET item_classification = CASE
  WHEN LOWER(item_classification) = 'goods_sold' THEN 'STOCK_IN_TRADE'
  WHEN LOWER(item_classification) = 'finished_good' THEN 'FINISHED_GOOD'
  WHEN LOWER(item_classification) = 'raw_material' THEN 'RAW_MATERIAL'
  WHEN LOWER(item_classification) = 'consumable' THEN 'CONSUMABLE'
  WHEN LOWER(item_classification) = 'service' THEN 'SERVICE'
  ELSE item_classification
END
WHERE item_classification IS NOT NULL;

COMMIT;
