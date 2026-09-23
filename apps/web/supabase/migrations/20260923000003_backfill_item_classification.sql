-- Migration: 20260923000003_backfill_item_classification.sql
-- Description: Backfill item classification, stockable, and depreciable flags from existing category names and descriptions.

BEGIN;

DO $$
DECLARE
  r_mat RECORD;
  v_category_name TEXT;
  v_gl_class TEXT;
  v_item_class TEXT;
  v_stockable BOOLEAN;
  v_depreciable BOOLEAN;
  v_useful_life NUMERIC(10,2);
  v_cat_id UUID;
BEGIN
  FOR r_mat IN 
    SELECT m.id, m.organisation_id, m.name, m.main_category, m.category, m.item_classification
    FROM public.materials m
  LOOP
    -- Consolidate text to search
    v_category_name := LOWER(COALESCE(r_mat.category, '') || ' ' || COALESCE(r_mat.main_category, '') || ' ' || COALESCE(r_mat.item_classification, '') || ' ' || r_mat.name);
    
    v_useful_life := NULL;
    v_cat_id := NULL;

    IF v_category_name ~* '(raw material|\brm\b)' THEN
      v_gl_class := 'INVENTORY_ASSET';
      v_item_class := 'RAW_MATERIAL';
      v_stockable := true;
      v_depreciable := false;
    ELSIF v_category_name ~* '(finished good|\bfg\b)' THEN
      v_gl_class := 'INVENTORY_ASSET';
      v_item_class := 'FINISHED_GOOD';
      v_stockable := true;
      v_depreciable := false;
    ELSIF v_category_name ~* '(stock-in-trade|trading|goods sold|goods_sold|pipe|coupling|valve|flange|fitting)' THEN
      v_gl_class := 'INVENTORY_ASSET';
      v_item_class := 'STOCK_IN_TRADE';
      v_stockable := true;
      v_depreciable := false;
    ELSIF v_category_name ~* '(wip|work-in-progress)' THEN
      v_gl_class := 'INVENTORY_ASSET';
      v_item_class := 'WIP';
      v_stockable := true;
      v_depreciable := false;
    ELSIF v_category_name ~* 'consumable' THEN
      v_gl_class := 'EXPENSE';
      v_item_class := 'CONSUMABLE';
      v_stockable := false;
      v_depreciable := false;
    ELSIF v_category_name ~* '(tool|tools)' THEN
      v_gl_class := 'FIXED_ASSET';
      v_item_class := 'TOOL';
      v_stockable := false;
      v_depreciable := true;
      v_useful_life := 5.00;
      SELECT id INTO v_cat_id FROM public.asset_categories WHERE organisation_id = r_mat.organisation_id AND name ILIKE '%Tool%' LIMIT 1;
    ELSIF v_category_name ~* '(machinery|plant)' THEN
      v_gl_class := 'FIXED_ASSET';
      v_item_class := 'PLANT_MACHINERY';
      v_stockable := false;
      v_depreciable := true;
      v_useful_life := 15.00;
      SELECT id INTO v_cat_id FROM public.asset_categories WHERE organisation_id = r_mat.organisation_id AND name ILIKE '%Plant%' LIMIT 1;
    ELSIF v_category_name ~* '(vehicle|vehicles|car|truck)' THEN
      v_gl_class := 'FIXED_ASSET';
      v_item_class := 'VEHICLE';
      v_stockable := false;
      v_depreciable := true;
      v_useful_life := 8.00;
      SELECT id INTO v_cat_id FROM public.asset_categories WHERE organisation_id = r_mat.organisation_id AND name ILIKE '%Vehicle%' LIMIT 1;
    ELSIF v_category_name ~* '(service|services|labour|labor)' THEN
      v_gl_class := 'EXPENSE';
      v_item_class := 'SERVICE';
      v_stockable := false;
      v_depreciable := false;
    ELSE
      -- Default to EXPENSE
      v_gl_class := 'EXPENSE';
      v_item_class := 'CONSUMABLE';
      v_stockable := false;
      v_depreciable := false;
    END IF;

    UPDATE public.materials
    SET gl_classification = v_gl_class,
        item_classification = v_item_class,
        is_stockable = v_stockable,
        is_depreciable = v_depreciable,
        useful_life_years = v_useful_life,
        asset_category_id = v_cat_id
    WHERE id = r_mat.id;
  END LOOP;
END $$;

COMMIT;
