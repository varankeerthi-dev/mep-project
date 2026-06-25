-- Invoice Stock Deduction Module
-- Run this in Supabase SQL Editor
-- Adds: invoice_stock_deductions table, RLS, indexes
-- No changes to existing invoices/invoice_items tables (uses meta_json for warehouse_id)

-- ============================================
-- INVOICE STOCK DEDUCTIONS (Audit Trail)
-- ============================================
CREATE TABLE IF NOT EXISTS invoice_stock_deductions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  invoice_item_id UUID REFERENCES invoice_items(id) ON DELETE SET NULL,
  invoice_material_id UUID REFERENCES invoice_materials(id) ON DELETE SET NULL,
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES company_variants(id) ON DELETE SET NULL,
  qty_deducted DECIMAL(12,3) NOT NULL DEFAULT 0,
  deducted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reversed_at TIMESTAMP WITH TIME ZONE,
  is_reversed BOOLEAN DEFAULT false,
  organisation_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_invoice_stock_deductions_invoice_id ON invoice_stock_deductions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_stock_deductions_material_id ON invoice_stock_deductions(material_id);
CREATE INDEX IF NOT EXISTS idx_invoice_stock_deductions_warehouse_id ON invoice_stock_deductions(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_invoice_stock_deductions_org ON invoice_stock_deductions(organisation_id);

-- RLS
ALTER TABLE invoice_stock_deductions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "invoice_stock_deductions_org_access" ON invoice_stock_deductions;
CREATE POLICY "invoice_stock_deductions_org_access" ON invoice_stock_deductions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_organisations uo
      WHERE uo.organisation_id = invoice_stock_deductions.organisation_id
      AND uo.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_organisations uo
      WHERE uo.organisation_id = invoice_stock_deductions.organisation_id
      AND uo.user_id = auth.uid()
    )
  );

-- ============================================
-- FUNCTION: Reverse Invoice Stock Deductions
-- Called when an invoice is deleted or reverted to draft
-- ============================================
CREATE OR REPLACE FUNCTION reverse_invoice_stock_deductions(p_invoice_id UUID)
RETURNS void AS $$
DECLARE
  rec RECORD;
  stock_rec RECORD;
BEGIN
  FOR rec IN
    SELECT id, material_id, warehouse_id, variant_id, qty_deducted
    FROM invoice_stock_deductions
    WHERE invoice_id = p_invoice_id
      AND is_reversed = false
  LOOP
    -- Restore stock to item_stock
    SELECT * INTO stock_rec
    FROM item_stock
    WHERE item_id = rec.material_id
      AND warehouse_id = rec.warehouse_id
      AND (rec.variant_id IS NULL OR company_variant_id = rec.variant_id);

    IF FOUND THEN
      UPDATE item_stock
      SET current_stock = current_stock + rec.qty_deducted,
          updated_at = NOW()
      WHERE id = stock_rec.id;
    END IF;

    -- Mark deduction as reversed
    UPDATE invoice_stock_deductions
    SET is_reversed = true,
        reversed_at = NOW()
    WHERE id = rec.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Deduct Invoice Stock
-- Atomic stock deduction with validation
-- ============================================
CREATE OR REPLACE FUNCTION deduct_invoice_stock(
  p_invoice_id UUID,
  p_organisation_id UUID,
  p_allow_insufficient BOOLEAN DEFAULT false
)
RETURNS TABLE (
  material_id UUID,
  warehouse_id UUID,
  requested_qty DECIMAL(12,3),
  available_qty DECIMAL(12,3),
  deducted_qty DECIMAL(12,3),
  status TEXT
) AS $$
DECLARE
  item_rec RECORD;
  stock_rec RECORD;
  v_material_id UUID;
  v_warehouse_id UUID;
  v_variant_id UUID;
  v_qty DECIMAL(12,3);
  v_available DECIMAL(12,3);
BEGIN
  -- First, reverse any existing deductions for this invoice
  PERFORM reverse_invoice_stock_deductions(p_invoice_id);

  -- Iterate over invoice items that have a material_id in meta_json
  FOR item_rec IN
    SELECT
      ii.id AS item_id,
      (ii.meta_json->>'material_id')::UUID AS material_id,
      (ii.meta_json->>'warehouse_id')::UUID AS warehouse_id,
      (ii.meta_json->>'variant_id')::UUID AS variant_id,
      ii.qty
    FROM invoice_items ii
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

    -- Look up stock
    SELECT * INTO stock_rec
    FROM item_stock
    WHERE item_id = v_material_id
      AND warehouse_id = v_warehouse_id
      AND (v_variant_id IS NULL OR company_variant_id = v_variant_id);

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
$$ LANGUAGE plpgsql;

-- ============================================
-- ADD WAREHOUSE_ID TO INVOICE_MATERIALS
-- ============================================
ALTER TABLE invoice_materials ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses(id);

-- ============================================
-- FUNCTION: Deduct Invoice Stock (LOT Mode)
-- For LOT invoices: deduct from invoice_materials
-- ============================================
CREATE OR REPLACE FUNCTION deduct_invoice_stock_lot(
  p_invoice_id UUID,
  p_organisation_id UUID,
  p_allow_insufficient BOOLEAN DEFAULT false
)
RETURNS TABLE (
  material_id UUID,
  warehouse_id UUID,
  requested_qty DECIMAL(12,3),
  available_qty DECIMAL(12,3),
  deducted_qty DECIMAL(12,3),
  status TEXT
) AS $$
DECLARE
  mat_rec RECORD;
  stock_rec RECORD;
  v_material_id UUID;
  v_warehouse_id UUID;
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
      im.qty_used
    FROM invoice_materials im
    WHERE im.invoice_id = p_invoice_id
      AND im.warehouse_id IS NOT NULL
  LOOP
    v_material_id := mat_rec.material_id;
    v_warehouse_id := mat_rec.warehouse_id;
    v_qty := mat_rec.qty_used;

    -- Look up stock
    SELECT * INTO stock_rec
    FROM item_stock
    WHERE item_id = v_material_id
      AND warehouse_id = v_warehouse_id
      AND company_variant_id IS NULL; -- TODO: support variants if needed

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
      invoice_id, invoice_material_id, material_id, warehouse_id,
      qty_deducted, organisation_id
    ) VALUES (
      p_invoice_id, mat_rec.material_row_id, v_material_id, v_warehouse_id,
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
$$ LANGUAGE plpgsql;
