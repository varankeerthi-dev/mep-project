-- 20260927000006_warehouse_operations_idempotency_and_variants.sql
-- Drop legacy function signatures to prevent overload ambiguity when called with fewer positional arguments
DROP FUNCTION IF EXISTS public.complete_pick_list(uuid, uuid);
DROP FUNCTION IF EXISTS public.execute_warehouse_dispatch(uuid, text, text, uuid);
DROP FUNCTION IF EXISTS public.execute_warehouse_transfer(uuid, uuid, text, text);
DROP FUNCTION IF EXISTS public.receive_warehouse_stock(uuid, uuid, uuid, numeric, uuid, text, text);
DROP FUNCTION IF EXISTS public.replenish_bin(uuid, uuid, uuid, uuid, numeric, uuid, text);

-- 1. receive_warehouse_stock
CREATE OR REPLACE FUNCTION public.receive_warehouse_stock(
  p_organisation_id uuid, 
  p_bin_id uuid, 
  p_item_id uuid, 
  p_quantity numeric, 
  p_operator_id uuid DEFAULT NULL::uuid, 
  p_device text DEFAULT NULL::text, 
  p_remarks text DEFAULT NULL::text,
  p_idempotency_key text DEFAULT NULL::text,
  p_company_variant_id uuid DEFAULT NULL::uuid
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_max NUMERIC;
  v_cur NUMERIC;
  v_bin_item_id UUID;
  v_eff_var_id UUID := p_company_variant_id;
  v_cached_resp JSONB;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM user_organisations
     WHERE organisation_id = p_organisation_id AND user_id = auth.uid() AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not a member of this organisation');
  END IF;
  IF p_quantity <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Quantity must be positive');
  END IF;

  -- Idempotency check
  IF p_idempotency_key IS NOT NULL AND TRIM(p_idempotency_key) <> '' THEN
    SELECT response INTO v_cached_resp
    FROM domain_idempotency_keys
    WHERE organisation_id = p_organisation_id 
      AND operation = 'receive_warehouse_stock' 
      AND client_request_id = TRIM(p_idempotency_key);
    IF v_cached_resp IS NOT NULL THEN
      RETURN v_cached_resp;
    END IF;
  END IF;

  -- Bin validation
  SELECT max_quantity INTO v_max
    FROM warehouse_bins
   WHERE id = p_bin_id AND organisation_id = p_organisation_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Bin not found in this organisation');
  END IF;
  v_max := COALESCE(v_max, 0);

  SELECT COALESCE(SUM(quantity), 0) INTO v_cur
    FROM warehouse_bin_items
   WHERE bin_id = p_bin_id AND deleted_at IS NULL;
  IF v_max > 0 AND v_cur + p_quantity > v_max THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'Bin capacity exceeded: ' || v_cur || ' + ' || p_quantity || ' > ' || v_max);
  END IF;

  -- Find or insert bin item matching variant
  SELECT id INTO v_bin_item_id
  FROM warehouse_bin_items
  WHERE bin_id = p_bin_id 
    AND item_id = p_item_id
    AND ((v_eff_var_id IS NULL AND item_variant_id IS NULL) OR item_variant_id = v_eff_var_id OR company_variant_id = v_eff_var_id)
    AND deleted_at IS NULL
  FOR UPDATE;

  IF v_bin_item_id IS NOT NULL THEN
    UPDATE warehouse_bin_items
    SET quantity = quantity + p_quantity,
        company_variant_id = COALESCE(company_variant_id, v_eff_var_id),
        item_variant_id = COALESCE(item_variant_id, v_eff_var_id),
        updated_at = now()
    WHERE id = v_bin_item_id;
  ELSE
    INSERT INTO warehouse_bin_items (
      organisation_id, bin_id, item_id, item_variant_id, company_variant_id, quantity, is_primary, created_at, updated_at
    ) VALUES (
      p_organisation_id, p_bin_id, p_item_id, v_eff_var_id, v_eff_var_id, p_quantity, true, now(), now()
    );
  END IF;

  INSERT INTO warehouse_movements (
    organisation_id, movement_type, reference_type, reference_id, item_id, company_variant_id,
    destination_bin_id, quantity, operator_id, device, remarks
  ) VALUES (
    p_organisation_id, 'receive', 'receiving', NULL, p_item_id, v_eff_var_id,
    p_bin_id, p_quantity, p_operator_id, p_device, p_remarks
  );

  v_cached_resp := jsonb_build_object('ok', true, 'bin_id', p_bin_id, 'quantity', p_quantity);

  IF p_idempotency_key IS NOT NULL AND TRIM(p_idempotency_key) <> '' THEN
    INSERT INTO domain_idempotency_keys (organisation_id, operation, client_request_id, actor_id, response)
    VALUES (p_organisation_id, 'receive_warehouse_stock', TRIM(p_idempotency_key), COALESCE(p_operator_id, auth.uid()), v_cached_resp)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_cached_resp;
END;
$function$;

-- 2. execute_warehouse_transfer
CREATE OR REPLACE FUNCTION public.execute_warehouse_transfer(
  p_transfer_id uuid, 
  p_operator_id uuid DEFAULT NULL::uuid, 
  p_device text DEFAULT NULL::text, 
  p_remarks text DEFAULT NULL::text,
  p_idempotency_key text DEFAULT NULL::text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org UUID;
  v_item_id UUID;
  v_variant_id UUID;
  v_qty NUMERIC;
  v_src UUID;
  v_dst UUID;
  v_src_qty NUMERIC;
  v_dst_max NUMERIC;
  v_dst_cur NUMERIC;
  v_ok BOOLEAN;
  v_status TEXT;
  v_dst_item_id UUID;
  v_cached_resp JSONB;
BEGIN
  SELECT organisation_id, item_id, company_variant_id, quantity, source_bin_id, destination_bin_id, status
    INTO v_org, v_item_id, v_variant_id, v_qty, v_src, v_dst, v_status
    FROM warehouse_transfers WHERE id = p_transfer_id;

  IF v_org IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Transfer not found');
  END IF;
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM user_organisations
     WHERE organisation_id = v_org AND user_id = auth.uid() AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not a member of this organisation');
  END IF;

  IF p_idempotency_key IS NOT NULL AND TRIM(p_idempotency_key) <> '' THEN
    SELECT response INTO v_cached_resp
    FROM domain_idempotency_keys
    WHERE organisation_id = v_org 
      AND operation = 'execute_warehouse_transfer' 
      AND client_request_id = TRIM(p_idempotency_key);
    IF v_cached_resp IS NOT NULL THEN
      RETURN v_cached_resp;
    END IF;
  END IF;

  IF v_status NOT IN ('requested','approved','picking','in_transit') THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'Transfer status ' || v_status || ' cannot be executed');
  END IF;

  SELECT COUNT(*) = 2 INTO v_ok
    FROM warehouse_bins
   WHERE id IN (v_src, v_dst) AND organisation_id = v_org AND deleted_at IS NULL;
  IF NOT v_ok THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Source/destination bin not found in this organisation');
  END IF;

  SELECT COALESCE(SUM(bi.quantity), 0) - COALESCE(b.reserved_quantity, 0) INTO v_src_qty
    FROM warehouse_bins b
    LEFT JOIN warehouse_bin_items bi
      ON bi.bin_id = b.id AND bi.item_id IS NOT DISTINCT FROM v_item_id 
         AND ((v_variant_id IS NULL AND (bi.item_variant_id IS NULL OR bi.company_variant_id IS NULL))
              OR bi.company_variant_id = v_variant_id OR bi.item_variant_id = v_variant_id)
         AND bi.deleted_at IS NULL
   WHERE b.id = v_src
   GROUP BY b.id, b.reserved_quantity;

  v_src_qty := COALESCE(v_src_qty, 0);
  IF v_src_qty < v_qty THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'Insufficient unreserved stock in source bin: ' || v_src_qty || ' < ' || v_qty);
  END IF;

  SELECT max_quantity INTO v_dst_max FROM warehouse_bins WHERE id = v_dst;
  IF v_dst_max IS NOT NULL AND v_dst_max > 0 THEN
    SELECT COALESCE(SUM(quantity), 0) INTO v_dst_cur
      FROM warehouse_bin_items WHERE bin_id = v_dst AND deleted_at IS NULL;
    IF v_dst_cur + v_qty > v_dst_max THEN
      RETURN jsonb_build_object('ok', false, 'error',
        'Destination bin capacity exceeded: ' || v_dst_cur || ' + ' || v_qty || ' > ' || v_dst_max);
    END IF;
  END IF;

  UPDATE warehouse_bin_items
     SET quantity = GREATEST(0, quantity - v_qty), updated_at = now()
   WHERE bin_id = v_src AND item_id IS NOT DISTINCT FROM v_item_id 
     AND ((v_variant_id IS NULL AND (item_variant_id IS NULL OR company_variant_id IS NULL))
          OR company_variant_id = v_variant_id OR item_variant_id = v_variant_id)
     AND deleted_at IS NULL;

  UPDATE warehouse_bin_items
     SET deleted_at = now(), quantity = 0, updated_at = now()
   WHERE bin_id = v_src AND item_id IS NOT DISTINCT FROM v_item_id
     AND quantity <= 0 AND deleted_at IS NULL;

  SELECT id INTO v_dst_item_id
  FROM warehouse_bin_items
  WHERE bin_id = v_dst AND item_id = v_item_id
    AND ((v_variant_id IS NULL AND (item_variant_id IS NULL OR company_variant_id IS NULL))
         OR company_variant_id = v_variant_id OR item_variant_id = v_variant_id)
    AND deleted_at IS NULL
  FOR UPDATE;

  IF v_dst_item_id IS NOT NULL THEN
    UPDATE warehouse_bin_items
    SET quantity = quantity + v_qty, updated_at = now()
    WHERE id = v_dst_item_id;
  ELSE
    INSERT INTO warehouse_bin_items (
      organisation_id, bin_id, item_id, item_variant_id, company_variant_id, quantity, is_primary, created_at, updated_at
    ) VALUES (
      v_org, v_dst, v_item_id, v_variant_id, v_variant_id, v_qty, false, now(), now()
    );
  END IF;

  INSERT INTO warehouse_movements (
    organisation_id, movement_type, reference_type, reference_id, item_id, company_variant_id,
    source_bin_id, destination_bin_id, quantity, operator_id, device, remarks
  ) VALUES (
    v_org, 'transfer_out', 'transfer', p_transfer_id::TEXT, v_item_id, v_variant_id,
    v_src, v_dst, -v_qty, p_operator_id, p_device, p_remarks
  ), (
    v_org, 'transfer_in', 'transfer', p_transfer_id::TEXT, v_item_id, v_variant_id,
    v_src, v_dst, v_qty, p_operator_id, p_device, p_remarks
  );

  UPDATE warehouse_transfers
     SET status = 'received',
         received_by = COALESCE(p_operator_id, received_by),
         received_at = now(),
         updated_at = now()
   WHERE id = p_transfer_id;

  v_cached_resp := jsonb_build_object('ok', true, 'transfer_id', p_transfer_id);

  IF p_idempotency_key IS NOT NULL AND TRIM(p_idempotency_key) <> '' THEN
    INSERT INTO domain_idempotency_keys (organisation_id, operation, client_request_id, actor_id, response)
    VALUES (v_org, 'execute_warehouse_transfer', TRIM(p_idempotency_key), COALESCE(p_operator_id, auth.uid()), v_cached_resp)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_cached_resp;
END;
$function$;

-- 3. execute_warehouse_dispatch
CREATE OR REPLACE FUNCTION public.execute_warehouse_dispatch(
  p_dispatch_id uuid, 
  p_vehicle_no text DEFAULT NULL::text, 
  p_driver_name text DEFAULT NULL::text, 
  p_operator_id uuid DEFAULT NULL::uuid,
  p_idempotency_key text DEFAULT NULL::text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org UUID;
  v_item_id UUID;
  v_variant_id UUID;
  v_qty NUMERIC;
  v_src UUID;
  v_status TEXT;
  v_reserved NUMERIC;
  v_bin_reserved NUMERIC;
  v_cached_resp JSONB;
BEGIN
  SELECT organisation_id, item_id, company_variant_id, quantity, source_bin_id, status, reserved_qty
    INTO v_org, v_item_id, v_variant_id, v_qty, v_src, v_status, v_reserved
    FROM warehouse_dispatches WHERE id = p_dispatch_id;

  IF v_org IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Dispatch not found');
  END IF;
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM user_organisations
     WHERE organisation_id = v_org AND user_id = auth.uid() AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not a member of this organisation');
  END IF;

  IF p_idempotency_key IS NOT NULL AND TRIM(p_idempotency_key) <> '' THEN
    SELECT response INTO v_cached_resp
    FROM domain_idempotency_keys
    WHERE organisation_id = v_org 
      AND operation = 'execute_warehouse_dispatch' 
      AND client_request_id = TRIM(p_idempotency_key);
    IF v_cached_resp IS NOT NULL THEN
      RETURN v_cached_resp;
    END IF;
  END IF;

  IF v_status <> 'loaded' THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'Cannot dispatch from status ' || v_status || ' — must be loaded');
  END IF;

  SELECT COALESCE(reserved_quantity, 0) INTO v_bin_reserved
    FROM warehouse_bins WHERE id = v_src AND organisation_id = v_org AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Source bin not found in this organisation');
  END IF;

  UPDATE warehouse_bin_items
     SET quantity = GREATEST(0, quantity - v_qty), updated_at = now()
   WHERE bin_id = v_src AND item_id IS NOT DISTINCT FROM v_item_id 
     AND ((v_variant_id IS NULL AND (item_variant_id IS NULL OR company_variant_id IS NULL))
          OR company_variant_id = v_variant_id OR item_variant_id = v_variant_id)
     AND deleted_at IS NULL;

  UPDATE warehouse_bin_items
     SET deleted_at = now(), quantity = 0, updated_at = now()
   WHERE bin_id = v_src AND item_id IS NOT DISTINCT FROM v_item_id
     AND quantity <= 0 AND deleted_at IS NULL;

  UPDATE warehouse_bins
     SET reserved_quantity = GREATEST(0, COALESCE(reserved_quantity, 0) - COALESCE(v_reserved, 0)),
         updated_at = now()
   WHERE id = v_src;

  INSERT INTO warehouse_movements (
    organisation_id, movement_type, reference_type, reference_id, item_id, company_variant_id,
    source_bin_id, quantity, operator_id, device, remarks
  ) VALUES (
    v_org, 'dispatch', 'dispatch', p_dispatch_id::TEXT, v_item_id, v_variant_id,
    v_src, -v_qty, p_operator_id, 'web',
    'Shipment ' || COALESCE(p_vehicle_no, '') || ' ' || COALESCE(p_driver_name, '')
  );

  UPDATE warehouse_dispatches
     SET status = 'completed',
         completed_at = now(),
         vehicle_no = COALESCE(p_vehicle_no, vehicle_no),
         driver_name = COALESCE(p_driver_name, driver_name),
         updated_at = now()
   WHERE id = p_dispatch_id;

  v_cached_resp := jsonb_build_object('ok', true, 'dispatch_id', p_dispatch_id);

  IF p_idempotency_key IS NOT NULL AND TRIM(p_idempotency_key) <> '' THEN
    INSERT INTO domain_idempotency_keys (organisation_id, operation, client_request_id, actor_id, response)
    VALUES (v_org, 'execute_warehouse_dispatch', TRIM(p_idempotency_key), COALESCE(p_operator_id, auth.uid()), v_cached_resp)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_cached_resp;
END;
$function$;

-- 4. complete_pick_list
CREATE OR REPLACE FUNCTION public.complete_pick_list(
  p_pick_list_id uuid, 
  p_operator_id uuid DEFAULT NULL::uuid,
  p_idempotency_key text DEFAULT NULL::text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org UUID;
  v_status TEXT;
  v_row RECORD;
  v_available NUMERIC;
  v_picked INTEGER := 0;
  v_skipped INTEGER := 0;
  v_cached_resp JSONB;
BEGIN
  SELECT organisation_id, status INTO v_org, v_status
    FROM warehouse_pick_lists WHERE id = p_pick_list_id;

  IF v_org IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Pick list not found');
  END IF;
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM user_organisations
     WHERE organisation_id = v_org AND user_id = auth.uid() AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not a member of this organisation');
  END IF;

  IF p_idempotency_key IS NOT NULL AND TRIM(p_idempotency_key) <> '' THEN
    SELECT response INTO v_cached_resp
    FROM domain_idempotency_keys
    WHERE organisation_id = v_org 
      AND operation = 'complete_pick_list' 
      AND client_request_id = TRIM(p_idempotency_key);
    IF v_cached_resp IS NOT NULL THEN
      RETURN v_cached_resp;
    END IF;
  END IF;

  IF v_status NOT IN ('queued','picking') THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'Cannot complete a pick list in status ' || v_status);
  END IF;

  FOR v_row IN
    SELECT i.id, i.item_id, i.company_variant_id, i.source_bin_id, i.quantity_requested, i.quantity_picked, i.status
      FROM warehouse_pick_list_items i
     WHERE i.pick_list_id = p_pick_list_id
  LOOP
    IF v_row.status = 'picked' THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    IF COALESCE(v_row.quantity_picked, 0) <= 0 THEN
      RETURN jsonb_build_object('ok', false, 'error',
        'Line ' || v_row.id || ' has no picked quantity — set quantity_picked before completing');
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM warehouse_bins
       WHERE id = v_row.source_bin_id AND organisation_id = v_org AND deleted_at IS NULL
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Source bin not found in this organisation');
    END IF;

    SELECT COALESCE(SUM(bi.quantity), 0) - COALESCE(b.reserved_quantity, 0) INTO v_available
      FROM warehouse_bins b
      LEFT JOIN warehouse_bin_items bi
        ON bi.bin_id = b.id AND bi.item_id IS NOT DISTINCT FROM v_row.item_id 
           AND ((v_row.company_variant_id IS NULL AND (bi.item_variant_id IS NULL OR bi.company_variant_id IS NULL))
                OR bi.company_variant_id = v_row.company_variant_id OR bi.item_variant_id = v_row.company_variant_id)
           AND bi.deleted_at IS NULL
     WHERE b.id = v_row.source_bin_id
     GROUP BY b.id, b.reserved_quantity;

    v_available := COALESCE(v_available, 0);
    IF v_available < v_row.quantity_picked THEN
      RETURN jsonb_build_object('ok', false, 'error',
        'Insufficient unreserved stock for line ' || v_row.id || ': ' ||
        v_available || ' < ' || v_row.quantity_picked);
    END IF;

    UPDATE warehouse_bin_items
       SET quantity = GREATEST(0, quantity - v_row.quantity_picked), updated_at = now()
     WHERE bin_id = v_row.source_bin_id AND item_id IS NOT DISTINCT FROM v_row.item_id 
       AND ((v_row.company_variant_id IS NULL AND (item_variant_id IS NULL OR company_variant_id IS NULL))
            OR company_variant_id = v_row.company_variant_id OR item_variant_id = v_row.company_variant_id)
       AND deleted_at IS NULL;

    UPDATE warehouse_bin_items
       SET deleted_at = now(), quantity = 0, updated_at = now()
     WHERE bin_id = v_row.source_bin_id AND item_id IS NOT DISTINCT FROM v_row.item_id
       AND quantity <= 0 AND deleted_at IS NULL;

    INSERT INTO warehouse_movements (
      organisation_id, movement_type, reference_type, reference_id, item_id, company_variant_id,
      source_bin_id, quantity, operator_id, device, remarks
    ) VALUES (
      v_org, 'pick', 'picking', p_pick_list_id::TEXT, v_row.item_id, v_row.company_variant_id,
      v_row.source_bin_id, -v_row.quantity_picked, p_operator_id, 'web',
      'Picking task ' || p_pick_list_id
    );

    UPDATE warehouse_pick_list_items
       SET status = 'picked', picked_by = p_operator_id, picked_at = now(), updated_at = now()
     WHERE id = v_row.id;
    v_picked := v_picked + 1;
  END LOOP;

  UPDATE warehouse_pick_lists
     SET status = 'completed', completed_at = now(), updated_at = now()
   WHERE id = p_pick_list_id;

  v_cached_resp := jsonb_build_object('ok', true, 'pick_list_id', p_pick_list_id,
                                      'picked', v_picked, 'skipped', v_skipped);

  IF p_idempotency_key IS NOT NULL AND TRIM(p_idempotency_key) <> '' THEN
    INSERT INTO domain_idempotency_keys (organisation_id, operation, client_request_id, actor_id, response)
    VALUES (v_org, 'complete_pick_list', TRIM(p_idempotency_key), COALESCE(p_operator_id, auth.uid()), v_cached_resp)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_cached_resp;
END;
$function$;

-- 5. replenish_bin
CREATE OR REPLACE FUNCTION public.replenish_bin(
  p_organisation_id uuid, 
  p_source_bin_id uuid, 
  p_destination_bin_id uuid, 
  p_item_id uuid, 
  p_quantity numeric, 
  p_operator_id uuid DEFAULT NULL::uuid, 
  p_device text DEFAULT NULL::text,
  p_idempotency_key text DEFAULT NULL::text,
  p_company_variant_id uuid DEFAULT NULL::uuid
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_src_qty NUMERIC;
  v_ok BOOLEAN;
  v_variant_id UUID := p_company_variant_id;
  v_dst_item_id UUID;
  v_cached_resp JSONB;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM user_organisations
     WHERE organisation_id = p_organisation_id AND user_id = auth.uid() AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not a member of this organisation');
  END IF;
  IF p_quantity <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Quantity must be positive');
  END IF;

  IF p_idempotency_key IS NOT NULL AND TRIM(p_idempotency_key) <> '' THEN
    SELECT response INTO v_cached_resp
    FROM domain_idempotency_keys
    WHERE organisation_id = p_organisation_id 
      AND operation = 'replenish_bin' 
      AND client_request_id = TRIM(p_idempotency_key);
    IF v_cached_resp IS NOT NULL THEN
      RETURN v_cached_resp;
    END IF;
  END IF;

  SELECT COUNT(*) = 2 INTO v_ok
    FROM warehouse_bins
   WHERE id IN (p_source_bin_id, p_destination_bin_id)
     AND organisation_id = p_organisation_id AND deleted_at IS NULL;
  IF NOT v_ok THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Source/destination bin not found in this organisation');
  END IF;

  SELECT COALESCE(SUM(bi.quantity), 0) - COALESCE(b.reserved_quantity, 0) INTO v_src_qty
    FROM warehouse_bins b
    LEFT JOIN warehouse_bin_items bi
      ON bi.bin_id = b.id AND bi.item_id IS NOT DISTINCT FROM p_item_id 
         AND ((v_variant_id IS NULL AND (bi.item_variant_id IS NULL OR bi.company_variant_id IS NULL))
              OR bi.company_variant_id = v_variant_id OR bi.item_variant_id = v_variant_id)
         AND bi.deleted_at IS NULL
   WHERE b.id = p_source_bin_id
   GROUP BY b.id, b.reserved_quantity;

  v_src_qty := COALESCE(v_src_qty, 0);
  IF v_src_qty < p_quantity THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'Insufficient unreserved bulk stock: ' || v_src_qty || ' < ' || p_quantity);
  END IF;

  UPDATE warehouse_bin_items
     SET quantity = GREATEST(0, quantity - p_quantity), updated_at = now()
   WHERE bin_id = p_source_bin_id AND item_id IS NOT DISTINCT FROM p_item_id 
     AND ((v_variant_id IS NULL AND (item_variant_id IS NULL OR company_variant_id IS NULL))
          OR company_variant_id = v_variant_id OR item_variant_id = v_variant_id)
     AND deleted_at IS NULL;

  UPDATE warehouse_bin_items
     SET deleted_at = now(), quantity = 0, updated_at = now()
   WHERE bin_id = p_source_bin_id AND item_id IS NOT DISTINCT FROM p_item_id
     AND quantity <= 0 AND deleted_at IS NULL;

  SELECT id INTO v_dst_item_id
  FROM warehouse_bin_items
  WHERE bin_id = p_destination_bin_id AND item_id = p_item_id
    AND ((v_variant_id IS NULL AND (item_variant_id IS NULL OR company_variant_id IS NULL))
         OR company_variant_id = v_variant_id OR item_variant_id = v_variant_id)
    AND deleted_at IS NULL
  FOR UPDATE;

  IF v_dst_item_id IS NOT NULL THEN
    UPDATE warehouse_bin_items
    SET quantity = quantity + p_quantity, updated_at = now()
    WHERE id = v_dst_item_id;
  ELSE
    INSERT INTO warehouse_bin_items (
      organisation_id, bin_id, item_id, item_variant_id, company_variant_id, quantity, is_primary, created_at, updated_at
    ) VALUES (
      p_organisation_id, p_destination_bin_id, p_item_id, v_variant_id, v_variant_id, p_quantity, false, now(), now()
    );
  END IF;

  INSERT INTO warehouse_movements (
    organisation_id, movement_type, reference_type, reference_id, item_id, company_variant_id,
    source_bin_id, destination_bin_id, quantity, operator_id, device, remarks
  ) VALUES (
    p_organisation_id, 'replenish', 'replenishment', NULL, p_item_id, v_variant_id,
    p_source_bin_id, p_destination_bin_id, p_quantity, p_operator_id, p_device,
    'Bulk → Picking replenishment'
  );

  v_cached_resp := jsonb_build_object('ok', true);

  IF p_idempotency_key IS NOT NULL AND TRIM(p_idempotency_key) <> '' THEN
    INSERT INTO domain_idempotency_keys (organisation_id, operation, client_request_id, actor_id, response)
    VALUES (p_organisation_id, 'replenish_bin', TRIM(p_idempotency_key), COALESCE(p_operator_id, auth.uid()), v_cached_resp)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_cached_resp;
END;
$function$;
