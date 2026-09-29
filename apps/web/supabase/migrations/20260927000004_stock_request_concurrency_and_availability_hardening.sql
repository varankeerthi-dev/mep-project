-- 20260927000004_stock_request_concurrency_and_availability_hardening.sql
CREATE OR REPLACE FUNCTION public.get_stock_availability(
    p_org_id uuid, 
    p_item_id uuid, 
    p_variant_id uuid, 
    p_warehouse_id uuid
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_on_hand numeric := 0;
    v_so_committed numeric := 0;
    v_sr_committed numeric := 0;
    v_floor_committed numeric := 0;
    v_total_committed numeric := 0;
    v_available_to_commit numeric := 0;
BEGIN
    IF auth.uid() IS NOT NULL AND NOT user_can_access_org(p_org_id) THEN
        RAISE EXCEPTION 'Access denied to organisation';
    END IF;

    -- On-hand stock in source warehouse
    SELECT COALESCE(SUM(current_stock), 0) INTO v_on_hand
    FROM item_stock
    WHERE organisation_id = p_org_id
      AND item_id = p_item_id
      AND warehouse_id = p_warehouse_id
      AND ((p_variant_id IS NULL AND company_variant_id IS NULL) OR company_variant_id = p_variant_id);

    -- Committed by Sales Orders (variant-aware)
    SELECT COALESCE(SUM(qty), 0) INTO v_so_committed
    FROM sales_order_reservations
    WHERE organisation_id = p_org_id
      AND item_id = p_item_id
      AND warehouse_id = p_warehouse_id
      AND ((p_variant_id IS NULL AND company_variant_id IS NULL) OR company_variant_id = p_variant_id);

    -- Committed by Stock Requests (active confirmed or in-process allocations)
    SELECT COALESCE(SUM(allocated_qty - released_qty - dispatched_qty), 0) INTO v_sr_committed
    FROM stock_request_allocations
    WHERE organisation_id = p_org_id
      AND item_id = p_item_id
      AND source_warehouse_id = p_warehouse_id
      AND status IN ('confirmed', 'partially_dispatched')
      AND ((p_variant_id IS NULL AND company_variant_id IS NULL) OR company_variant_id = p_variant_id);

    -- Committed by floor dispatches (active bin reservations not tied to stock requests)
    SELECT COALESCE(SUM(wd.reserved_qty), 0) INTO v_floor_committed
    FROM warehouse_dispatches wd
    JOIN warehouse_bins wb ON wb.id = wd.source_bin_id
    JOIN warehouse_tiers wt ON wt.id = wb.tier_id
    JOIN warehouse_racks wr ON wr.id = wt.rack_id
    JOIN warehouse_layouts wl ON wl.id = wr.layout_id
    JOIN warehouse_zones wz ON wz.id = wl.zone_id
    JOIN warehouse_floors wf ON wf.id = wz.floor_id
    WHERE wd.organisation_id = p_org_id
      AND wd.item_id = p_item_id
      AND wf.warehouse_id = p_warehouse_id
      AND wd.status IN ('reserved', 'picking', 'packing')
      AND ((p_variant_id IS NULL AND wd.company_variant_id IS NULL) OR wd.company_variant_id = p_variant_id)
      AND (wd.transfer_id IS NULL OR NOT EXISTS (
          SELECT 1 FROM stock_request_allocations sra WHERE sra.transfer_id = wd.transfer_id
      ));

    v_total_committed := v_so_committed + v_sr_committed + v_floor_committed;
    v_available_to_commit := GREATEST(0, v_on_hand - v_total_committed);

    RETURN jsonb_build_object(
        'item_id', p_item_id,
        'company_variant_id', p_variant_id,
        'warehouse_id', p_warehouse_id,
        'on_hand', v_on_hand,
        'so_committed', v_so_committed,
        'sr_committed', v_sr_committed,
        'floor_committed', v_floor_committed,
        'total_committed', v_total_committed,
        'available_to_commit', v_available_to_commit
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.allocate_stock_request_atomic(p_allocation jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_alloc_qty numeric;
    v_req_line stock_request_lines%ROWTYPE;
    v_req stock_requests%ROWTYPE;
    v_org_id uuid;
    v_actor_id uuid := COALESCE(auth.uid(), NULLIF(p_allocation->>'allocated_by', '')::uuid);
    v_avail_record jsonb;
    v_avail_to_commit numeric;
    v_alloc_id uuid;
    v_idem text;
    v_source_wh_id uuid;
    v_stock_id uuid;
    v_curr_stock numeric;
BEGIN
    v_alloc_qty := (p_allocation->>'allocated_qty')::numeric;
    IF v_alloc_qty <= 0 THEN RAISE EXCEPTION 'Allocated quantity must be greater than zero'; END IF;

    v_idem := NULLIF(p_allocation->>'idempotency_key', '');
    v_source_wh_id := (p_allocation->>'source_warehouse_id')::uuid;

    SELECT * INTO v_req_line FROM stock_request_lines WHERE id = (p_allocation->>'request_line_id')::uuid FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Request line not found'; END IF;

    v_org_id := v_req_line.organisation_id;

    IF auth.uid() IS NOT NULL AND NOT user_can_access_org(v_org_id) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    IF v_actor_id IS NULL THEN
        SELECT requested_by INTO v_actor_id FROM stock_requests WHERE id = v_req_line.request_id;
    END IF;

    IF v_idem IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM domain_idempotency_keys WHERE organisation_id = v_org_id AND operation = 'allocate_request' AND client_request_id = v_idem) THEN
            SELECT response INTO v_avail_record FROM domain_idempotency_keys WHERE organisation_id = v_org_id AND operation = 'allocate_request' AND client_request_id = v_idem;
            RETURN v_avail_record;
        END IF;
    END IF;

    SELECT * INTO v_req FROM stock_requests WHERE id = v_req_line.request_id FOR UPDATE;
    IF v_req.status NOT IN ('under_process', 'partially_allocated', 'allocated') THEN
        RAISE EXCEPTION 'Cannot allocate in status %', v_req.status;
    END IF;

    IF (v_req_line.allocated_qty + v_alloc_qty) > v_req_line.requested_qty THEN
        RAISE EXCEPTION 'Cannot over-allocate line. Requested: %, Currently Allocated: %, Adding: %',
            v_req_line.requested_qty, v_req_line.allocated_qty, v_alloc_qty;
    END IF;

    -- Concurrency Protection: Lock the item_stock row FOR UPDATE in the source warehouse.
    -- This serializes concurrent allocations of the same item/variant in the source warehouse.
    SELECT id, current_stock INTO v_stock_id, v_curr_stock
    FROM item_stock
    WHERE organisation_id = v_org_id
      AND item_id = v_req_line.item_id
      AND warehouse_id = v_source_wh_id
      AND ((v_req_line.company_variant_id IS NULL AND company_variant_id IS NULL)
           OR company_variant_id = v_req_line.company_variant_id)
    FOR UPDATE;

    -- Concurrency check on source warehouse available stock under row lock
    v_avail_record := get_stock_availability(
        v_org_id, v_req_line.item_id, v_req_line.company_variant_id, v_source_wh_id
    );
    v_avail_to_commit := (v_avail_record->>'available_to_commit')::numeric;

    IF v_alloc_qty > v_avail_to_commit THEN
        RAISE EXCEPTION 'Insufficient stock in source warehouse. Available: %, Requested: %',
            v_avail_to_commit, v_alloc_qty;
    END IF;

    INSERT INTO stock_request_allocations (
        organisation_id, request_line_id, request_id, source_warehouse_id, item_id, company_variant_id,
        allocated_qty, allocated_by, notes, idempotency_key
    ) VALUES (
        v_org_id, v_req_line.id, v_req.id, v_source_wh_id,
        v_req_line.item_id, v_req_line.company_variant_id, v_alloc_qty, v_actor_id,
        p_allocation->>'notes', v_idem
    ) RETURNING id INTO v_alloc_id;

    UPDATE stock_request_lines
    SET allocated_qty = allocated_qty + v_alloc_qty, updated_at = now()
    WHERE id = v_req_line.id;

    -- Update overall request status
    IF EXISTS (
        SELECT 1 FROM stock_request_lines WHERE request_id = v_req.id AND allocated_qty < requested_qty
    ) THEN
        UPDATE stock_requests SET status = 'partially_allocated', updated_at = now() WHERE id = v_req.id;
    ELSE
        UPDATE stock_requests SET status = 'allocated', updated_at = now() WHERE id = v_req.id;
    END IF;

    INSERT INTO stock_request_activity_log (
        organisation_id, request_id, request_line_id, allocation_id, event_type, actor_id,
        source_warehouse_id, item_id, company_variant_id, quantity, remarks
    ) VALUES (
        v_org_id, v_req.id, v_req_line.id, v_alloc_id, 'allocated', v_actor_id,
        v_source_wh_id, v_req_line.item_id, v_req_line.company_variant_id, v_alloc_qty,
        'Allocated ' || v_alloc_qty || ' from warehouse'
    );

    IF v_idem IS NOT NULL THEN
        INSERT INTO domain_idempotency_keys (organisation_id, operation, client_request_id, actor_id, response)
        VALUES (v_org_id, 'allocate_request', v_idem, v_actor_id, jsonb_build_object('id', v_alloc_id, 'status', 'success'))
        ON CONFLICT DO NOTHING;
    END IF;

    RETURN jsonb_build_object('id', v_alloc_id, 'status', 'success', 'allocated_qty', v_alloc_qty);
END;
$function$;
