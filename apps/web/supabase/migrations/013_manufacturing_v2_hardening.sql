-- ============================================================
-- MANUFACTURING ENGINE V2 — PHASE 1: TRANSACTION HARDENING & IDEMPOTENCY
-- Migration: 013_manufacturing_v2_hardening.sql
-- Date: August 13, 2026
-- ============================================================
-- Features:
-- 1. Atomic `accept_grn()` RPC with FOR UPDATE locking, dynamic line-item warehouse resolution, and idempotency protection against retries.
-- 2. Atomic `release_fg_after_qc()` RPC with FOR UPDATE locking, multi-warehouse routing (FG, Rejection, WIP rework), and idempotency protection against retries.
-- ============================================================

-- ============================================================
-- 1. ATOMIC IDEMPOTENT GRN ACCEPTANCE RPC
-- ============================================================
CREATE OR REPLACE FUNCTION accept_grn(
  p_grn_id UUID,
  p_org_id UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grn RECORD;
  v_item RECORD;
  v_main_store_id UUID;
  v_target_wh_id UUID;
  v_stock RECORD;
  v_inward_id UUID;
  v_processed_count INT := 0;
BEGIN
  -- 1. Verify user organisation membership
  IF NOT EXISTS (
    SELECT 1 FROM user_organisations
    WHERE organisation_id = p_org_id AND user_id = auth.uid() AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not an active member of this organisation');
  END IF;

  -- 2. Lock GRN row FOR UPDATE for thread safety & concurrency protection
  SELECT id, grn_no, status, vendor_name, organisation_id INTO v_grn
  FROM goods_receipt_notes
  WHERE id = p_grn_id
  FOR UPDATE;

  IF v_grn.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Goods Receipt Note (GRN) not found');
  END IF;

  IF v_grn.organisation_id != p_org_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Organisation mismatch');
  END IF;

  -- 3. Idempotency Check: if already accepted, return success without re-processing stock
  IF v_grn.status = 'accepted' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_processed', true,
      'message', 'GRN is already accepted and processed.',
      'grn_id', p_grn_id
    );
  END IF;

  -- 4. Fallback Main Store Warehouse resolution (if line item has no warehouse_id)
  SELECT id INTO v_main_store_id
  FROM warehouses
  WHERE organisation_id = p_org_id AND warehouse_purpose = 'main' AND is_active = true
  LIMIT 1;

  IF v_main_store_id IS NULL THEN
    SELECT id INTO v_main_store_id
    FROM warehouses
    WHERE organisation_id = p_org_id AND is_default = true AND is_active = true
    LIMIT 1;
  END IF;

  IF v_main_store_id IS NULL THEN
    SELECT id INTO v_main_store_id
    FROM warehouses
    WHERE organisation_id = p_org_id AND is_active = true
    LIMIT 1;
  END IF;

  IF v_main_store_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No active warehouse found for organisation');
  END IF;

  -- 5. Create Material Inward Header for Audit Trail
  INSERT INTO material_inward (
    inward_date, vendor_name, remarks, organisation_id, supply_type
  ) VALUES (
    CURRENT_DATE,
    COALESCE(v_grn.vendor_name, 'Supplier GRN'),
    'GRN ' || v_grn.grn_no || ' accepted into inventory',
    p_org_id,
    'PURCHASE'
  )
  RETURNING id INTO v_inward_id;

  -- 6. Iterate through GRN Items & update stock dynamically per line-item warehouse
  FOR v_item IN
    SELECT gi.id, gi.material_id, gi.received_qty, gi.accepted_qty, gi.unit, gi.warehouse_id, m.name AS material_name
    FROM grn_items gi
    JOIN materials m ON m.id = gi.material_id
    WHERE gi.grn_id = p_grn_id
  LOOP
    -- Use line item's specified warehouse_id if set; fallback to main store
    v_target_wh_id := COALESCE(v_item.warehouse_id, v_main_store_id);

    -- Quantity to receive: use accepted_qty if > 0, otherwise received_qty
    DECLARE
      v_qty_to_add NUMERIC := COALESCE(NULLIF(v_item.accepted_qty, 0), v_item.received_qty, 0);
    BEGIN
      IF v_qty_to_add > 0 THEN
        -- Lock item_stock row FOR UPDATE
        SELECT id, current_stock INTO v_stock
        FROM item_stock
        WHERE item_id = v_item.material_id
          AND warehouse_id = v_target_wh_id
          AND organisation_id = p_org_id
        FOR UPDATE;

        IF v_stock.id IS NULL THEN
          INSERT INTO item_stock (item_id, warehouse_id, current_stock, organisation_id, is_active)
          VALUES (v_item.material_id, v_target_wh_id, v_qty_to_add, p_org_id, true)
          RETURNING id INTO v_stock.id;
        ELSE
          UPDATE item_stock
          SET current_stock = current_stock + v_qty_to_add,
              updated_at = NOW()
          WHERE id = v_stock.id;
        END IF;

        -- Create Material Inward Item audit row
        INSERT INTO material_inward_items (
          material_inward_id, material_name, quantity, unit, material_id, warehouse_id, organisation_id
        ) VALUES (
          v_inward_id,
          COALESCE(v_item.material_name, ''),
          v_qty_to_add,
          COALESCE(v_item.unit, 'nos'),
          v_item.material_id,
          v_target_wh_id,
          p_org_id
        );

        -- Update line item status
        UPDATE grn_items
        SET status = 'accepted',
            accepted_qty = v_qty_to_add
        WHERE id = v_item.id;

        v_processed_count := v_processed_count + 1;
      END IF;
    END;
  END LOOP;

  -- 7. Mark GRN as accepted
  UPDATE goods_receipt_notes
  SET status = 'accepted',
      updated_at = NOW()
  WHERE id = p_grn_id;

  -- 8. Log manufacturing activity
  INSERT INTO manufacturing_activity_log (
    entity_type, entity_id, action, action_details, user_id, organisation_id
  ) VALUES (
    'grn', p_grn_id, 'accepted',
    jsonb_build_object(
      'grn_no', v_grn.grn_no,
      'items_processed', v_processed_count,
      'inward_id', v_inward_id
    ),
    auth.uid(), p_org_id
  );

  RETURN jsonb_build_object(
    'ok', true,
    'already_processed', false,
    'grn_id', p_grn_id,
    'items_processed', v_processed_count
  );
END;
$$;


-- ============================================================
-- 2. ATOMIC IDEMPOTENT QC RELEASE GATE RPC
-- ============================================================
CREATE OR REPLACE FUNCTION release_fg_after_qc(
  p_inspection_id UUID,
  p_org_id UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qc RECORD;
  v_fg_store_id UUID;
  v_rejection_store_id UUID;
  v_wip_store_id UUID;
  v_stock RECORD;
  v_inward_id UUID;
  v_prod_name TEXT;
  v_prod_unit TEXT;
BEGIN
  -- 1. Verify user organisation membership
  IF NOT EXISTS (
    SELECT 1 FROM user_organisations
    WHERE organisation_id = p_org_id AND user_id = auth.uid() AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not an active member of this organisation');
  END IF;

  -- 2. Lock QC inspection row FOR UPDATE for thread safety
  SELECT id, inspection_no, product_id, inspection_date, inspection_result,
         accepted_qty, rejected_qty, rework_qty, batch_no, organisation_id
  INTO v_qc
  FROM fg_qc_inspections
  WHERE id = p_inspection_id
  FOR UPDATE;

  IF v_qc.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'QC Inspection not found');
  END IF;

  IF v_qc.organisation_id != p_org_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Organisation mismatch');
  END IF;

  -- 3. Idempotency Check: if already released, return success without duplicating stock
  IF v_qc.inspection_result = 'released' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_processed', true,
      'message', 'QC Inspection stock has already been released.',
      'inspection_id', p_inspection_id
    );
  END IF;

  -- Get product name and unit
  SELECT name, unit INTO v_prod_name, v_prod_unit
  FROM materials WHERE id = v_qc.product_id;

  -- 4. Resolve Target Warehouses (FG, Rejection, WIP)
  SELECT id INTO v_fg_store_id
  FROM warehouses
  WHERE organisation_id = p_org_id AND warehouse_purpose = 'fg' AND is_active = true
  LIMIT 1;

  IF v_fg_store_id IS NULL THEN
    SELECT id INTO v_fg_store_id
    FROM warehouses
    WHERE organisation_id = p_org_id AND is_default = true AND is_active = true
    LIMIT 1;
  END IF;

  SELECT id INTO v_rejection_store_id
  FROM warehouses
  WHERE organisation_id = p_org_id AND warehouse_purpose = 'rejection' AND is_active = true
  LIMIT 1;

  SELECT id INTO v_wip_store_id
  FROM warehouses
  WHERE organisation_id = p_org_id AND warehouse_purpose = 'wip' AND is_active = true
  LIMIT 1;

  IF v_fg_store_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Finished Goods (FG) Warehouse not found');
  END IF;

  -- 5. Process Accepted Quantity -> Finished Goods Warehouse
  IF COALESCE(v_qc.accepted_qty, 0) > 0 THEN
    SELECT id, current_stock INTO v_stock
    FROM item_stock
    WHERE item_id = v_qc.product_id
      AND warehouse_id = v_fg_store_id
      AND organisation_id = p_org_id
    FOR UPDATE;

    IF v_stock.id IS NULL THEN
      INSERT INTO item_stock (item_id, warehouse_id, current_stock, organisation_id, is_active)
      VALUES (v_qc.product_id, v_fg_store_id, v_qc.accepted_qty, p_org_id, true)
      RETURNING id INTO v_stock.id;
    ELSE
      UPDATE item_stock
      SET current_stock = current_stock + v_qc.accepted_qty,
          updated_at = NOW()
      WHERE id = v_stock.id;
    END IF;

    -- Audit Log: Material Inward for Accepted FG
    INSERT INTO material_inward (
      inward_date, remarks, organisation_id, supply_type
    ) VALUES (
      COALESCE(v_qc.inspection_date, CURRENT_DATE),
      'QC Inspection ' || v_qc.inspection_no || ' — Finished Goods Accepted',
      p_org_id,
      'MANUFACTURING'
    ) RETURNING id INTO v_inward_id;

    INSERT INTO material_inward_items (
      material_inward_id, material_name, quantity, unit, material_id, warehouse_id, organisation_id
    ) VALUES (
      v_inward_id,
      COALESCE(v_prod_name, ''),
      v_qc.accepted_qty,
      COALESCE(v_prod_unit, 'nos'),
      v_qc.product_id,
      v_fg_store_id,
      p_org_id
    );
  END IF;

  -- 6. Process Rejected Quantity -> Rejection Warehouse
  IF COALESCE(v_qc.rejected_qty, 0) > 0 AND v_rejection_store_id IS NOT NULL THEN
    SELECT id, current_stock INTO v_stock
    FROM item_stock
    WHERE item_id = v_qc.product_id
      AND warehouse_id = v_rejection_store_id
      AND organisation_id = p_org_id
    FOR UPDATE;

    IF v_stock.id IS NULL THEN
      INSERT INTO item_stock (item_id, warehouse_id, current_stock, organisation_id, is_active)
      VALUES (v_qc.product_id, v_rejection_store_id, v_qc.rejected_qty, p_org_id, true)
      RETURNING id INTO v_stock.id;
    ELSE
      UPDATE item_stock
      SET current_stock = current_stock + v_qc.rejected_qty,
          updated_at = NOW()
      WHERE id = v_stock.id;
    END IF;
  END IF;

  -- 7. Process Rework Quantity -> WIP Warehouse
  IF COALESCE(v_qc.rework_qty, 0) > 0 AND v_wip_store_id IS NOT NULL THEN
    SELECT id, current_stock INTO v_stock
    FROM item_stock
    WHERE item_id = v_qc.product_id
      AND warehouse_id = v_wip_store_id
      AND organisation_id = p_org_id
    FOR UPDATE;

    IF v_stock.id IS NULL THEN
      INSERT INTO item_stock (item_id, warehouse_id, current_stock, organisation_id, is_active)
      VALUES (v_qc.product_id, v_wip_store_id, v_qc.rework_qty, p_org_id, true)
      RETURNING id INTO v_stock.id;
    ELSE
      UPDATE item_stock
      SET current_stock = current_stock + v_qc.rework_qty,
          updated_at = NOW()
      WHERE id = v_stock.id;
    END IF;
  END IF;

  -- 8. Update QC inspection status to 'released'
  UPDATE fg_qc_inspections
  SET inspection_result = 'released',
      updated_at = NOW()
  WHERE id = p_inspection_id;

  -- 9. Log manufacturing activity
  INSERT INTO manufacturing_activity_log (
    entity_type, entity_id, action, action_details, user_id, organisation_id
  ) VALUES (
    'fg_qc_inspection', p_inspection_id, 'released',
    jsonb_build_object(
      'inspection_no', v_qc.inspection_no,
      'accepted_qty', v_qc.accepted_qty,
      'rejected_qty', v_qc.rejected_qty,
      'rework_qty', v_qc.rework_qty
    ),
    auth.uid(), p_org_id
  );

  RETURN jsonb_build_object(
    'ok', true,
    'already_processed', false,
    'inspection_id', p_inspection_id,
    'accepted_qty', COALESCE(v_qc.accepted_qty, 0),
    'rejected_qty', COALESCE(v_qc.rejected_qty, 0)
  );
END;
$$;
