-- 20261009000000_invoice_lot_stock_atomic.sql
-- Lot-mode invoices never deducted stock: finalize_sales_invoice only invoked
-- the itemised reader (invoice_items.meta_json), while lot materials live in
-- invoice_materials. The lot function existed but had zero callers and was
-- SECURITY INVOKER with no variant support and no row locks.
--
-- Fix design (single chokepoint, atomicity preserved):
--   1. deduct_invoice_stock becomes mode-aware: lot invoices deduct from
--      invoice_materials inside the SAME finalize transaction — no app change,
--      no split transactions, same idempotency/reversal/GRANT posture.
--   2. deduct_invoice_stock_lot is hardened to the same standard (DEFINER,
--      authz, FOR UPDATE, variant-aware) so the named entry point is safe if
--      ever wired directly.
-- Forward-only, idempotent (CREATE OR REPLACE). Run in Supabase SQL editor.

-- ── 1. Mode-aware deduct_invoice_stock (same signature) ──────────────────────
CREATE OR REPLACE FUNCTION public.deduct_invoice_stock(p_invoice_id uuid, p_organisation_id uuid, p_allow_insufficient boolean DEFAULT false)
 RETURNS TABLE(material_id uuid, warehouse_id uuid, requested_qty numeric, available_qty numeric, deducted_qty numeric, status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  item_rec RECORD;
  stock_rec RECORD;
  v_material_id UUID;
  v_warehouse_id UUID;
  v_variant_id UUID;
  v_qty DECIMAL(12,3);
  v_available DECIMAL(12,3);
  v_mode TEXT;
BEGIN
  -- Authenticated user & tenant authorization check
  IF auth.uid() IS NOT NULL AND NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organization access';
  END IF;

  -- Reverse any existing deductions for this invoice
  PERFORM public.reverse_invoice_stock_deductions(p_invoice_id);

  SELECT mode INTO v_mode FROM public.invoices WHERE id = p_invoice_id;

  IF COALESCE(v_mode, '') = 'lot' THEN
    -- Lot mode: materials live in invoice_materials (product_id/warehouse/qty).
    FOR item_rec IN
      SELECT
        im.id AS item_id,
        im.product_id AS material_id,
        im.warehouse_id,
        im.variant_id,
        im.qty_used AS qty
      FROM public.invoice_materials im
      WHERE im.invoice_id = p_invoice_id
        AND im.warehouse_id IS NOT NULL
    LOOP
      v_material_id := item_rec.material_id;
      v_warehouse_id := item_rec.warehouse_id;
      v_variant_id := item_rec.variant_id;
      v_qty := item_rec.qty;

      IF v_material_id IS NULL OR v_qty IS NULL OR v_qty <= 0 THEN
        CONTINUE;
      END IF;

      SELECT * INTO stock_rec
      FROM public.item_stock s
      WHERE s.item_id = v_material_id
        AND s.warehouse_id = v_warehouse_id
        AND (v_variant_id IS NULL OR s.company_variant_id = v_variant_id)
        AND (v_variant_id IS NOT NULL OR s.company_variant_id IS NULL)
      FOR UPDATE;

      IF NOT FOUND THEN
        v_available := 0;
      ELSE
        v_available := stock_rec.current_stock;
      END IF;

      IF v_available < v_qty AND NOT p_allow_insufficient THEN
        material_id := v_material_id;
        warehouse_id := v_warehouse_id;
        requested_qty := v_qty;
        available_qty := v_available;
        deducted_qty := 0;
        status := 'INSUFFICIENT';
        RETURN NEXT;
        CONTINUE;
      END IF;

      IF FOUND THEN
        UPDATE public.item_stock
        SET current_stock = GREATEST(0, current_stock - v_qty),
            updated_at = NOW()
        WHERE id = stock_rec.id;
      END IF;

      INSERT INTO public.invoice_stock_deductions (
        invoice_id, invoice_material_id, material_id, warehouse_id, variant_id,
        qty_deducted, organisation_id
      ) VALUES (
        p_invoice_id, item_rec.item_id, v_material_id, v_warehouse_id, v_variant_id,
        LEAST(v_qty, v_available), p_organisation_id
      );

      material_id := v_material_id;
      warehouse_id := v_warehouse_id;
      requested_qty := v_qty;
      available_qty := v_available;
      deducted_qty := LEAST(v_qty, v_available);
      status := 'DEDUCTED';
      RETURN NEXT;
    END LOOP;
    RETURN;
  END IF;

  -- Itemised mode: unchanged legacy behavior (invoice_items.meta_json).
  FOR item_rec IN
    SELECT
      ii.id AS item_id,
      (ii.meta_json->>'material_id')::UUID AS material_id,
      (ii.meta_json->>'warehouse_id')::UUID AS warehouse_id,
      (ii.meta_json->>'variant_id')::UUID AS variant_id,
      ii.qty
    FROM public.invoice_items ii
    WHERE ii.invoice_id = p_invoice_id
      AND ii.meta_json->>'material_id' IS NOT NULL
      AND (ii.meta_json->>'is_service') IS DISTINCT FROM 'true'
  LOOP
    v_material_id := item_rec.material_id;
    v_warehouse_id := item_rec.warehouse_id;
    v_variant_id := item_rec.variant_id;
    v_qty := item_rec.qty;

    -- Skip if no warehouse assigned
    IF v_warehouse_id IS NULL THEN
      material_id := v_material_id;
      warehouse_id := NULL;
      requested_qty := v_qty;
      available_qty := 0;
      deducted_qty := 0;
      status := 'NO_WAREHOUSE';
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- Look up stock with row lock FOR UPDATE (explicitly qualified to avoid ambiguity with return table params)
    SELECT * INTO stock_rec
    FROM public.item_stock s
    WHERE s.item_id = v_material_id
      AND s.warehouse_id = v_warehouse_id
      AND (v_variant_id IS NULL OR s.company_variant_id = v_variant_id)
    FOR UPDATE;

    IF NOT FOUND THEN
      v_available := 0;
    ELSE
      v_available := stock_rec.current_stock;
    END IF;

    -- Check sufficiency
    IF v_available < v_qty AND NOT p_allow_insufficient THEN
      material_id := v_material_id;
      warehouse_id := v_warehouse_id;
      requested_qty := v_qty;
      available_qty := v_available;
      deducted_qty := 0;
      status := 'INSUFFICIENT';
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- Deduct stock
    IF FOUND THEN
      UPDATE public.item_stock
      SET current_stock = GREATEST(0, current_stock - v_qty),
          updated_at = NOW()
      WHERE id = stock_rec.id;
    END IF;

    -- Record deduction
    INSERT INTO public.invoice_stock_deductions (
      invoice_id, invoice_item_id, material_id, warehouse_id, variant_id,
      qty_deducted, organisation_id
    ) VALUES (
      p_invoice_id, item_rec.item_id, v_material_id, v_warehouse_id, v_variant_id,
      LEAST(v_qty, v_available), p_organisation_id
    );

    material_id := v_material_id;
    warehouse_id := v_warehouse_id;
    requested_qty := v_qty;
    available_qty := v_available;
    deducted_qty := LEAST(v_qty, v_available);
    status := 'DEDUCTED';
    RETURN NEXT;
  END LOOP;

  RETURN;
END;
$function$;

-- ── 2. Harden the named lot entry point to the same standard ─────────────────
CREATE OR REPLACE FUNCTION public.deduct_invoice_stock_lot(p_invoice_id uuid, p_organisation_id uuid, p_allow_insufficient boolean DEFAULT false)
 RETURNS TABLE(material_id uuid, warehouse_id uuid, requested_qty numeric, available_qty numeric, deducted_qty numeric, status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  mat_rec RECORD;
  stock_rec RECORD;
  v_material_id UUID;
  v_warehouse_id UUID;
  v_variant_id UUID;
  v_qty DECIMAL(12,3);
  v_available DECIMAL(12,3);
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.user_can_access_org(p_organisation_id) THEN
    RAISE EXCEPTION 'Unauthorized organization access';
  END IF;

  -- First, reverse any existing deductions for this invoice
  PERFORM public.reverse_invoice_stock_deductions(p_invoice_id);

  -- Iterate over invoice materials that have a warehouse_id
  FOR mat_rec IN
    SELECT
      im.id AS material_row_id,
      im.product_id AS material_id,
      im.warehouse_id,
      im.variant_id,
      im.qty_used
    FROM public.invoice_materials im
    WHERE im.invoice_id = p_invoice_id
      AND im.warehouse_id IS NOT NULL
  LOOP
    v_material_id := mat_rec.material_id;
    v_warehouse_id := mat_rec.warehouse_id;
    v_variant_id := mat_rec.variant_id;
    v_qty := mat_rec.qty_used;

    IF v_material_id IS NULL OR v_qty IS NULL OR v_qty <= 0 THEN
      CONTINUE;
    END IF;

    -- Look up stock with row lock, variant-aware
    SELECT * INTO stock_rec
    FROM public.item_stock
    WHERE item_id = v_material_id
      AND warehouse_id = v_warehouse_id
      AND (v_variant_id IS NULL OR company_variant_id = v_variant_id)
      AND (v_variant_id IS NOT NULL OR company_variant_id IS NULL)
    FOR UPDATE;

    IF NOT FOUND THEN
      v_available := 0;
    ELSE
      v_available := stock_rec.current_stock;
    END IF;

    -- Check sufficiency
    IF v_available < v_qty AND NOT p_allow_insufficient THEN
      material_id := v_material_id;
      warehouse_id := v_warehouse_id;
      requested_qty := v_qty;
      available_qty := v_available;
      deducted_qty := 0;
      status := 'INSUFFICIENT';
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- Deduct stock
    IF FOUND THEN
      UPDATE public.item_stock
      SET current_stock = GREATEST(0, current_stock - v_qty),
          updated_at = NOW()
      WHERE id = stock_rec.id;
    END IF;

    -- Record deduction
    INSERT INTO public.invoice_stock_deductions (
      invoice_id, invoice_material_id, material_id, warehouse_id,
      variant_id, qty_deducted, organisation_id
    ) VALUES (
      p_invoice_id, mat_rec.material_row_id, v_material_id, v_warehouse_id,
      v_variant_id, LEAST(v_qty, v_available), p_organisation_id
    );

    material_id := v_material_id;
    warehouse_id := v_warehouse_id;
    requested_qty := v_qty;
    available_qty := v_available;
    deducted_qty := LEAST(v_qty, v_available);
    status := 'DEDUCTED';
    RETURN NEXT;
  END LOOP;

  RETURN;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.deduct_invoice_stock(UUID, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_invoice_stock_lot(UUID, UUID, BOOLEAN) TO authenticated;
