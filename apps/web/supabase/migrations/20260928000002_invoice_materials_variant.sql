-- Lot material variant support, applied directly to the live database
-- via Supabase MCP on 2026-09-28. Idempotent, safe to re-apply.
--
-- 1. invoice_materials.variant_id (nullable; old rows stay NULL = generic stock)
-- 2. deduct_invoice_stock_lot(): variant-aware stock matching
--    (NULL variant still matches generic stock rows)

-- ── 1. variant column ───────────────────────────────────────────────
ALTER TABLE public.invoice_materials
  ADD COLUMN IF NOT EXISTS variant_id uuid NULL REFERENCES public.company_variants(id);

-- ── 2. variant-aware lot deduction ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.deduct_invoice_stock_lot(p_invoice_id uuid, p_organisation_id uuid, p_allow_insufficient boolean DEFAULT false)
 RETURNS TABLE(material_id uuid, warehouse_id uuid, requested_qty numeric, available_qty numeric, deducted_qty numeric, status text)
 LANGUAGE plpgsql
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
  -- First, reverse any existing deductions for this invoice
  PERFORM reverse_invoice_stock_deductions(p_invoice_id);

  -- Iterate over invoice materials that have a warehouse_id
  FOR mat_rec IN
    SELECT
      im.id AS material_row_id,
      im.product_id AS material_id,
      im.warehouse_id,
      im.variant_id,
      im.qty_used
    FROM invoice_materials im
    WHERE im.invoice_id = p_invoice_id
      AND im.warehouse_id IS NOT NULL
  LOOP
    v_material_id := mat_rec.material_id;
    v_warehouse_id := mat_rec.warehouse_id;
    v_variant_id := mat_rec.variant_id;
    v_qty := mat_rec.qty_used;

    -- Look up stock (variant-aware; NULL variant matches generic stock)
    SELECT * INTO stock_rec
    FROM item_stock
    WHERE item_id = v_material_id
      AND warehouse_id = v_warehouse_id
      AND company_variant_id IS NOT DISTINCT FROM v_variant_id;

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
      UPDATE item_stock
      SET current_stock = GREATEST(0, current_stock - v_qty),
          updated_at = NOW()
      WHERE id = stock_rec.id;
    END IF;

    -- Record deduction
    INSERT INTO invoice_stock_deductions (
      invoice_id, invoice_material_id, material_id, warehouse_id, variant_id,
      qty_deducted, organisation_id
    ) VALUES (
      p_invoice_id, mat_rec.material_row_id, v_material_id, v_warehouse_id, v_variant_id,
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
