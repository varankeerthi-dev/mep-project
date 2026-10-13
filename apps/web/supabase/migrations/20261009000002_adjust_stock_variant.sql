-- 20261009000002_adjust_stock_variant.sql
-- adjust_item_stock was variant-blind: credit-note restores (and any caller)
-- matched stock rows on (item, warehouse) only, landing variant stock on the
-- wrong row. Adds optional p_variant_id (backward compatible — existing
-- callers omit it and keep exact legacy behavior) with strict NULL matching.
-- Self-modifying with drift guard. Run in Supabase SQL editor.

DO $$
DECLARE
  src TEXT;
  old_sig TEXT;
  new_sig TEXT;
  old_lock TEXT;
  new_lock TEXT;
  old_ins TEXT;
  new_ins TEXT;
BEGIN
  SELECT pg_get_functiondef(oid) INTO src
  FROM pg_proc
  WHERE proname = 'adjust_item_stock'
    AND pronamespace = 'public'::regnamespace;

  IF src IS NULL THEN
    RAISE EXCEPTION 'adjust_item_stock not found; aborting';
  END IF;

  -- 1. Signature: append optional variant param.
  old_sig := 'p_project_id uuid DEFAULT NULL::uuid)';
  new_sig := 'p_project_id uuid DEFAULT NULL::uuid, p_variant_id uuid DEFAULT NULL)';

  IF position(old_sig IN src) = 0 THEN
    RAISE EXCEPTION 'adjust_item_stock signature changed since audit; aborting variant patch (re-audit first)';
  END IF;
  src := replace(src, old_sig, new_sig);

  -- 2. Lock lookup: strict variant matching (NULL matches NULL only).
  old_lock := '    WHERE item_id = p_item_id AND warehouse_id = p_warehouse_id' || chr(10) || '    FOR UPDATE;';
  new_lock := '    WHERE item_id = p_item_id AND warehouse_id = p_warehouse_id' || chr(10) ||
    '      AND (p_variant_id IS NULL OR company_variant_id = p_variant_id)' || chr(10) ||
    '      AND (p_variant_id IS NOT NULL OR company_variant_id IS NULL)' || chr(10) ||
    '    FOR UPDATE;';

  IF position(old_lock IN src) = 0 THEN
    RAISE EXCEPTION 'adjust_item_stock lock lookup changed since audit; aborting variant patch (re-audit first)';
  END IF;
  src := replace(src, old_lock, new_lock);

  -- 3. Auto-created stock rows carry the variant.
  old_ins := 'INSERT INTO public.item_stock (organisation_id, item_id, warehouse_id, current_stock)';
  new_ins := 'INSERT INTO public.item_stock (organisation_id, item_id, warehouse_id, company_variant_id, current_stock)';

  IF position(old_ins IN src) = 0 THEN
    RAISE EXCEPTION 'adjust_item_stock insert changed since audit; aborting variant patch (re-audit first)';
  END IF;
  src := replace(src, old_ins, new_ins);

  old_ins := 'VALUES (v_org_id, p_item_id, p_warehouse_id, v_new_stock)';
  new_ins := 'VALUES (v_org_id, p_item_id, p_warehouse_id, p_variant_id, v_new_stock)';

  IF position(old_ins IN src) = 0 THEN
    RAISE EXCEPTION 'adjust_item_stock insert values changed since audit; aborting variant patch (re-audit first)';
  END IF;
  src := replace(src, old_ins, new_ins);

  EXECUTE src;

  RAISE NOTICE 'adjust_item_stock patched: variant-aware (backward compatible)';
END
$$;
