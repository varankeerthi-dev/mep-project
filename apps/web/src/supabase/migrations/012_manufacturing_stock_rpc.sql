-- ============================================================
-- MANUFACTURING MODULE — STOCK MUTATION RPCs
-- Version: 1.0
-- Date: 2026-08-10
-- ============================================================
-- Wraps four stock-mutating operations in atomic Postgres
-- transactions with row-level locking.
-- Conventions match existing warehouse RPCs:
--   SECURITY DEFINER, SET search_path = public,
--   returns JSONB {ok, error, ...},
--   org check via user_organisations.
-- ============================================================

-- ============================================================
-- Helper: recalculate job card status from production entries
-- ============================================================
CREATE OR REPLACE FUNCTION recalculate_job_card_status(
  p_job_card_id UUID,
  p_org_id UUID
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining_qty NUMERIC;
  v_planned_qty NUMERIC;
BEGIN
  SELECT COALESCE(SUM(actual_qty), 0) INTO v_remaining_qty
  FROM production_entries
  WHERE job_card_id = p_job_card_id;

  SELECT planned_qty INTO v_planned_qty
  FROM job_cards
  WHERE id = p_job_card_id;

  IF v_remaining_qty >= v_planned_qty THEN
    UPDATE job_cards
    SET status = 'completed', completed_at = NOW(), updated_at = NOW()
    WHERE id = p_job_card_id;
  ELSIF v_remaining_qty > 0 THEN
    UPDATE job_cards
    SET status = 'in_progress', completed_at = NULL, updated_at = NOW()
    WHERE id = p_job_card_id;
  END IF;
END;
$$;

-- ============================================================
-- 1. ISSUE JOB CARD MATERIALS
-- ============================================================
CREATE OR REPLACE FUNCTION issue_job_card_materials(
  p_job_card_id UUID,
  p_org_id UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_card RECORD;
  v_main_store_id UUID;
  v_wip_store_id UUID;
  v_mat RECORD;
  v_main_stock RECORD;
  v_wip_stock RECORD;
  v_outward_id UUID;
  v_reserved_count INT;
BEGIN
  SELECT id, status, organisation_id INTO v_job_card
  FROM job_cards WHERE id = p_job_card_id;

  IF v_job_card.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Job card not found');
  END IF;

  IF v_job_card.organisation_id != p_org_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Organisation mismatch');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM user_organisations
    WHERE organisation_id = p_org_id AND user_id = auth.uid() AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not a member of this organisation');
  END IF;

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

  SELECT id INTO v_wip_store_id
  FROM warehouses
  WHERE organisation_id = p_org_id AND warehouse_purpose = 'wip' AND is_active = true
  LIMIT 1;

  IF v_wip_store_id IS NULL THEN
    SELECT id INTO v_wip_store_id
    FROM warehouses
    WHERE organisation_id = p_org_id AND is_active = true AND id != v_main_store_id
    LIMIT 1;
  END IF;

  IF v_main_store_id IS NULL OR v_wip_store_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Required warehouses (Main Store / WIP) not found');
  END IF;

  SELECT COUNT(*) INTO v_reserved_count
  FROM job_card_materials
  WHERE job_card_id = p_job_card_id AND status = 'reserved';

  IF v_reserved_count = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No reserved materials to issue');
  END IF;

  INSERT INTO material_outward (outward_date, remarks, organisation_id)
  VALUES (CURRENT_DATE, 'Job Card - materials issued to production', p_org_id)
  RETURNING id INTO v_outward_id;

  FOR v_mat IN
    SELECT jcm.id, jcm.material_id, jcm.planned_qty, m.name, m.unit
    FROM job_card_materials jcm
    JOIN materials m ON m.id = jcm.material_id
    WHERE jcm.job_card_id = p_job_card_id AND jcm.status = 'reserved'
  LOOP
    SELECT id, current_stock INTO v_main_stock
    FROM item_stock
    WHERE item_id = v_mat.material_id
      AND warehouse_id = v_main_store_id
      AND organisation_id = p_org_id
    FOR UPDATE;

    IF v_main_stock.id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error',
        'No stock record for material ' || COALESCE(v_mat.name, v_mat.material_id::text));
    END IF;

    IF v_main_stock.current_stock < v_mat.planned_qty THEN
      RETURN jsonb_build_object('ok', false, 'error',
        'Insufficient stock in Main Store for ' || COALESCE(v_mat.name, v_mat.material_id::text) ||
        ': available ' || v_main_stock.current_stock || ', needed ' || v_mat.planned_qty);
    END IF;

    UPDATE item_stock
    SET current_stock = GREATEST(0, current_stock - v_mat.planned_qty),
        updated_at = NOW()
    WHERE id = v_main_stock.id;

    SELECT id, current_stock INTO v_wip_stock
    FROM item_stock
    WHERE item_id = v_mat.material_id
      AND warehouse_id = v_wip_store_id
      AND organisation_id = p_org_id
    FOR UPDATE;

    IF v_wip_stock.id IS NULL THEN
      INSERT INTO item_stock (item_id, warehouse_id, current_stock, organisation_id, is_active)
      VALUES (v_mat.material_id, v_wip_store_id, v_mat.planned_qty, p_org_id, true)
      RETURNING id INTO v_wip_stock.id;
    ELSE
      UPDATE item_stock
      SET current_stock = current_stock + v_mat.planned_qty,
          updated_at = NOW()
      WHERE id = v_wip_stock.id;
    END IF;

    INSERT INTO material_outward_items (
      material_outward_id, material_name, quantity, unit, material_id, warehouse_id, organisation_id
    ) VALUES (
      v_outward_id,
      COALESCE(v_mat.name, ''),
      v_mat.planned_qty,
      COALESCE(v_mat.unit, ''),
      v_mat.material_id,
      v_main_store_id,
      p_org_id
    );

    UPDATE job_card_materials
    SET status = 'issued',
        issued_qty = v_mat.planned_qty,
        warehouse_id = v_wip_store_id,
        updated_at = NOW()
    WHERE id = v_mat.id;
  END LOOP;

  UPDATE job_cards
  SET status = 'issued', completed_at = NULL, updated_at = NOW()
  WHERE id = p_job_card_id;

  RETURN jsonb_build_object('ok', true, 'job_card_id', p_job_card_id);
END;
$$;

-- ============================================================
-- 2. RETURN JOB CARD MATERIALS
-- ============================================================
CREATE OR REPLACE FUNCTION return_job_card_materials(
  p_job_card_id UUID,
  p_org_id UUID,
  p_return_quantities JSONB
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_card RECORD;
  v_main_store_id UUID;
  v_wip_store_id UUID;
  v_mat_id UUID;
  v_return_qty NUMERIC;
  v_mat RECORD;
  v_wip_stock RECORD;
  v_main_stock RECORD;
  v_inward_id UUID;
BEGIN
  SELECT id, status, organisation_id INTO v_job_card
  FROM job_cards WHERE id = p_job_card_id;

  IF v_job_card.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Job card not found');
  END IF;

  IF v_job_card.organisation_id != p_org_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Organisation mismatch');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM user_organisations
    WHERE organisation_id = p_org_id AND user_id = auth.uid() AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not a member of this organisation');
  END IF;

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

  SELECT id INTO v_wip_store_id
  FROM warehouses
  WHERE organisation_id = p_org_id AND warehouse_purpose = 'wip' AND is_active = true
  LIMIT 1;

  IF v_wip_store_id IS NULL THEN
    SELECT id INTO v_wip_store_id
    FROM warehouses
    WHERE organisation_id = p_org_id AND is_active = true AND id != v_main_store_id
    LIMIT 1;
  END IF;

  IF v_main_store_id IS NULL OR v_wip_store_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Required warehouses (Main Store / WIP) not found');
  END IF;

  INSERT INTO material_inward (inward_date, vendor_name, remarks, organisation_id, supply_type)
  VALUES (CURRENT_DATE, 'Production Return', 'Job Card - materials returned from production', p_org_id, 'WAREHOUSE')
  RETURNING id INTO v_inward_id;

  FOR v_mat_id, v_return_qty IN
    SELECT key, value::NUMERIC
    FROM jsonb_each(p_return_quantities)
  LOOP
    IF v_return_qty IS NULL OR v_return_qty <= 0 THEN
      CONTINUE;
    END IF;

    SELECT id, name, unit INTO v_mat
    FROM materials WHERE id = v_mat_id;

    SELECT id, current_stock INTO v_wip_stock
    FROM item_stock
    WHERE item_id = v_mat_id
      AND warehouse_id = v_wip_store_id
      AND organisation_id = p_org_id
    FOR UPDATE;

    IF v_wip_stock.id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error',
        'No WIP stock for material ' || COALESCE(v_mat.name, v_mat_id::text));
    END IF;

    IF v_wip_stock.current_stock < v_return_qty THEN
      RETURN jsonb_build_object('ok', false, 'error',
        'Insufficient stock in WIP for ' || COALESCE(v_mat.name, v_mat_id::text) ||
        ': available ' || v_wip_stock.current_stock || ', attempting to return ' || v_return_qty);
    END IF;

    UPDATE item_stock
    SET current_stock = GREATEST(0, current_stock - v_return_qty),
        updated_at = NOW()
    WHERE id = v_wip_stock.id;

    SELECT id, current_stock INTO v_main_stock
    FROM item_stock
    WHERE item_id = v_mat_id
      AND warehouse_id = v_main_store_id
      AND organisation_id = p_org_id
    FOR UPDATE;

    IF v_main_stock.id IS NULL THEN
      INSERT INTO item_stock (item_id, warehouse_id, current_stock, organisation_id, is_active)
      VALUES (v_mat_id, v_main_store_id, v_return_qty, p_org_id, true)
      RETURNING id INTO v_main_stock.id;
    ELSE
      UPDATE item_stock
      SET current_stock = current_stock + v_return_qty,
          updated_at = NOW()
      WHERE id = v_main_stock.id;
    END IF;

    INSERT INTO material_inward_items (
      material_inward_id, material_name, quantity, unit, material_id, warehouse_id, organisation_id
    ) VALUES (
      v_inward_id,
      COALESCE(v_mat.name, ''),
      v_return_qty,
      COALESCE(v_mat.unit, ''),
      v_mat_id,
      v_main_store_id,
      p_org_id
    );

    UPDATE job_card_materials
    SET return_qty = COALESCE(return_qty, 0) + v_return_qty,
        status = 'returned',
        updated_at = NOW()
    WHERE job_card_id = p_job_card_id AND material_id = v_mat_id;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'job_card_id', p_job_card_id);
END;
$$;

-- ============================================================
-- 3. CREATE PRODUCTION ENTRY
-- ============================================================
CREATE OR REPLACE FUNCTION create_production_entry(
  p_entry JSONB,
  p_items JSONB,
  p_org_id UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry_id UUID;
  v_item JSONB;
  v_main_store_id UUID;
  v_wip_store_id UUID;
  v_fg_store_id UUID;
  v_stock RECORD;
  v_job_card_id UUID;
  v_consumed_wastage NUMERIC;
  v_return_qty NUMERIC;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_organisations
    WHERE organisation_id = p_org_id AND user_id = auth.uid() AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not a member of this organisation');
  END IF;

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

  SELECT id INTO v_wip_store_id
  FROM warehouses
  WHERE organisation_id = p_org_id AND warehouse_purpose = 'wip' AND is_active = true
  LIMIT 1;

  IF v_wip_store_id IS NULL THEN
    SELECT id INTO v_wip_store_id
    FROM warehouses
    WHERE organisation_id = p_org_id AND is_active = true AND id != v_main_store_id
    LIMIT 1;
  END IF;

  SELECT id INTO v_fg_store_id
  FROM warehouses
  WHERE organisation_id = p_org_id AND warehouse_purpose = 'fg' AND is_active = true
  LIMIT 1;

  IF v_fg_store_id IS NULL THEN
    SELECT id INTO v_fg_store_id
    FROM warehouses
    WHERE organisation_id = p_org_id AND is_active = true
      AND id != v_main_store_id AND id != v_wip_store_id
    LIMIT 1;
  END IF;

  IF v_main_store_id IS NULL OR v_wip_store_id IS NULL OR v_fg_store_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Required warehouses (Main Store / WIP / FG Store) not found');
  END IF;

  INSERT INTO production_entries (
    entry_no, job_card_id, actual_qty, output_unit, yield_pct, notes,
    batch_no, production_date, reported_by, created_by, organisation_id
  ) VALUES (
    COALESCE(p_entry->>'entry_no', generate_production_entry_no(p_org_id)),
    (p_entry->>'job_card_id')::UUID,
    COALESCE((p_entry->>'actual_qty')::NUMERIC, 0),
    COALESCE(p_entry->>'output_unit', 'Nos'),
    COALESCE((p_entry->>'yield_pct')::NUMERIC, NULL),
    p_entry->>'notes',
    p_entry->>'batch_no',
    COALESCE((p_entry->>'production_date')::DATE, CURRENT_DATE),
    COALESCE((p_entry->>'reported_by')::UUID, NULL),
    COALESCE((p_entry->>'created_by')::UUID, NULL),
    p_org_id
  )
  RETURNING id, job_card_id INTO v_entry_id, v_job_card_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO production_entry_items (
      production_entry_id, job_card_material_id, material_id,
      issued_qty, consumed_qty, wastage_qty, return_qty, remarks, batch_no
    ) VALUES (
      v_entry_id,
      (v_item->>'job_card_material_id')::UUID,
      (v_item->>'material_id')::UUID,
      COALESCE((v_item->>'issued_qty')::NUMERIC, 0),
      COALESCE((v_item->>'consumed_qty')::NUMERIC, 0),
      COALESCE((v_item->>'wastage_qty')::NUMERIC, 0),
      COALESCE((v_item->>'return_qty')::NUMERIC, 0),
      v_item->>'remarks',
      v_item->>'batch_no'
    );

    v_consumed_wastage := COALESCE((v_item->>'consumed_qty')::NUMERIC, 0)
                        + COALESCE((v_item->>'wastage_qty')::NUMERIC, 0);

    IF v_consumed_wastage > 0 THEN
      SELECT id, current_stock INTO v_stock
      FROM item_stock
      WHERE item_id = (v_item->>'material_id')::UUID
        AND warehouse_id = v_wip_store_id
        AND organisation_id = p_org_id
      FOR UPDATE;

      IF v_stock.id IS NOT NULL THEN
        UPDATE item_stock
        SET current_stock = GREATEST(0, current_stock - v_consumed_wastage),
            updated_at = NOW()
        WHERE id = v_stock.id;
      END IF;
    END IF;

    v_return_qty := COALESCE((v_item->>'return_qty')::NUMERIC, 0);

    IF v_return_qty > 0 THEN
      SELECT id, current_stock INTO v_stock
      FROM item_stock
      WHERE item_id = (v_item->>'material_id')::UUID
        AND warehouse_id = v_main_store_id
        AND organisation_id = p_org_id
      FOR UPDATE;

      IF v_stock.id IS NULL THEN
        INSERT INTO item_stock (item_id, warehouse_id, current_stock, organisation_id, is_active)
        VALUES ((v_item->>'material_id')::UUID, v_main_store_id, v_return_qty, p_org_id, true)
        RETURNING id INTO v_stock.id;
      ELSE
        UPDATE item_stock
        SET current_stock = current_stock + v_return_qty,
            updated_at = NOW()
        WHERE id = v_stock.id;
      END IF;
    END IF;

    UPDATE job_card_materials
    SET consumed_qty = COALESCE(consumed_qty, 0) + COALESCE((v_item->>'consumed_qty')::NUMERIC, 0),
        wastage_qty = COALESCE(wastage_qty, 0) + COALESCE((v_item->>'wastage_qty')::NUMERIC, 0),
        return_qty = COALESCE(return_qty, 0) + COALESCE((v_item->>'return_qty')::NUMERIC, 0),
        updated_at = NOW()
    WHERE id = (v_item->>'job_card_material_id')::UUID;
  END LOOP;

  PERFORM recalculate_job_card_status(v_job_card_id, p_org_id);

  RETURN jsonb_build_object('ok', true, 'entry_id', v_entry_id);
END;
$$;

-- ============================================================
-- 4. DELETE PRODUCTION ENTRY
-- ============================================================
CREATE OR REPLACE FUNCTION delete_production_entry(
  p_entry_id UUID,
  p_org_id UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry RECORD;
  v_entry_item RECORD;
  v_main_store_id UUID;
  v_wip_store_id UUID;
  v_fg_store_id UUID;
  v_stock RECORD;
  v_job_card_id UUID;
  v_product_id UUID;
  v_consumed_wastage NUMERIC;
  v_remaining_qty NUMERIC;
  v_planned_qty NUMERIC;
BEGIN
  SELECT * INTO v_entry
  FROM production_entries
  WHERE id = p_entry_id;

  IF v_entry.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Entry not found');
  END IF;

  IF v_entry.organisation_id != p_org_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Organisation mismatch');
  END IF;

  v_job_card_id := v_entry.job_card_id;

  IF NOT EXISTS (
    SELECT 1 FROM user_organisations
    WHERE organisation_id = p_org_id AND user_id = auth.uid() AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not a member of this organisation');
  END IF;

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

  SELECT id INTO v_wip_store_id
  FROM warehouses
  WHERE organisation_id = p_org_id AND warehouse_purpose = 'wip' AND is_active = true
  LIMIT 1;

  IF v_wip_store_id IS NULL THEN
    SELECT id INTO v_wip_store_id
    FROM warehouses
    WHERE organisation_id = p_org_id AND is_active = true AND id != v_main_store_id
    LIMIT 1;
  END IF;

  SELECT id INTO v_fg_store_id
  FROM warehouses
  WHERE organisation_id = p_org_id AND warehouse_purpose = 'fg' AND is_active = true
  LIMIT 1;

  IF v_fg_store_id IS NULL THEN
    SELECT id INTO v_fg_store_id
    FROM warehouses
    WHERE organisation_id = p_org_id AND is_active = true
      AND id != v_main_store_id AND id != v_wip_store_id
    LIMIT 1;
  END IF;

  IF v_main_store_id IS NULL OR v_wip_store_id IS NULL OR v_fg_store_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Required warehouses (Main Store / WIP / FG Store) not found');
  END IF;

  IF v_entry.actual_qty > 0 THEN
    SELECT bom_headers.product_id INTO v_product_id
    FROM job_cards
    JOIN bom_headers ON bom_headers.id = job_cards.bom_id
    WHERE job_cards.id = v_job_card_id;

    IF v_product_id IS NOT NULL THEN
      SELECT id, current_stock INTO v_stock
      FROM item_stock
      WHERE item_id = v_product_id
        AND warehouse_id = v_fg_store_id
        AND organisation_id = p_org_id
      FOR UPDATE;

      IF v_stock.id IS NOT NULL THEN
        UPDATE item_stock
        SET current_stock = GREATEST(0, current_stock - v_entry.actual_qty),
            updated_at = NOW()
        WHERE id = v_stock.id;
      END IF;
    END IF;
  END IF;

  FOR v_entry_item IN
    SELECT * FROM production_entry_items
    WHERE production_entry_id = p_entry_id
  LOOP
    v_consumed_wastage := COALESCE(v_entry_item.consumed_qty, 0) + COALESCE(v_entry_item.wastage_qty, 0);

    IF v_consumed_wastage > 0 THEN
      SELECT id, current_stock INTO v_stock
      FROM item_stock
      WHERE item_id = v_entry_item.material_id
        AND warehouse_id = v_wip_store_id
        AND organisation_id = p_org_id
      FOR UPDATE;

      IF v_stock.id IS NOT NULL THEN
        UPDATE item_stock
        SET current_stock = current_stock + v_consumed_wastage,
            updated_at = NOW()
        WHERE id = v_stock.id;
      END IF;
    END IF;

    IF COALESCE(v_entry_item.return_qty, 0) > 0 THEN
      SELECT id, current_stock INTO v_stock
      FROM item_stock
      WHERE item_id = v_entry_item.material_id
        AND warehouse_id = v_main_store_id
        AND organisation_id = p_org_id
      FOR UPDATE;

      IF v_stock.id IS NOT NULL THEN
        UPDATE item_stock
        SET current_stock = GREATEST(0, current_stock - v_entry_item.return_qty),
            updated_at = NOW()
        WHERE id = v_stock.id;
      END IF;
    END IF;

    UPDATE job_card_materials
    SET consumed_qty = GREATEST(0, COALESCE(consumed_qty, 0) - COALESCE(v_entry_item.consumed_qty, 0)),
        wastage_qty = GREATEST(0, COALESCE(wastage_qty, 0) - COALESCE(v_entry_item.wastage_qty, 0)),
        return_qty = GREATEST(0, COALESCE(return_qty, 0) - COALESCE(v_entry_item.return_qty, 0)),
        updated_at = NOW()
    WHERE id = v_entry_item.job_card_material_id;
  END LOOP;

  DELETE FROM production_entry_items WHERE production_entry_id = p_entry_id;
  DELETE FROM production_entries WHERE id = p_entry_id;

  SELECT COALESCE(SUM(actual_qty), 0) INTO v_remaining_qty
  FROM production_entries
  WHERE job_card_id = v_job_card_id;

  SELECT planned_qty INTO v_planned_qty
  FROM job_cards
  WHERE id = v_job_card_id;

  IF v_remaining_qty >= v_planned_qty THEN
    UPDATE job_cards SET status = 'completed', completed_at = NOW(), updated_at = NOW()
    WHERE id = v_job_card_id;
  ELSIF v_remaining_qty > 0 THEN
    UPDATE job_cards SET status = 'in_progress', completed_at = NULL, updated_at = NOW()
    WHERE id = v_job_card_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'entry_id', p_entry_id);
END;
$$;
