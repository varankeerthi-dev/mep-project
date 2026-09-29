-- 20260927000005_stock_request_floor_bridge_and_status_sync.sql
CREATE OR REPLACE FUNCTION public.convert_allocations_to_transfer(
    p_request_id uuid, 
    p_allocation_ids uuid[], 
    p_vehicle_no text DEFAULT NULL::text, 
    p_transporter text DEFAULT NULL::text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_req stock_requests%ROWTYPE;
    v_org_id uuid;
    v_actor_id uuid := auth.uid();
    v_source_wh_id uuid;
    v_transfer_id uuid;
    v_transfer_no text;
    v_alloc_id uuid;
    v_alloc stock_request_allocations%ROWTYPE;
    v_transfer_qty numeric;
    v_pick_list_id uuid := NULL;
    v_found_bin_id uuid;
BEGIN
    SELECT * INTO v_req FROM stock_requests WHERE id = p_request_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;

    v_org_id := v_req.organisation_id;
    IF v_actor_id IS NOT NULL AND NOT user_can_access_org(v_org_id) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    IF array_length(p_allocation_ids, 1) = 0 THEN
        RAISE EXCEPTION 'No allocations provided';
    END IF;

    -- Verify all allocations belong to the same source warehouse
    SELECT DISTINCT source_warehouse_id INTO v_source_wh_id
    FROM stock_request_allocations
    WHERE id = ANY(p_allocation_ids) AND request_id = p_request_id;

    IF (SELECT count(DISTINCT source_warehouse_id) FROM stock_request_allocations WHERE id = ANY(p_allocation_ids)) > 1 THEN
        RAISE EXCEPTION 'All selected allocations must share the same source warehouse';
    END IF;

    v_transfer_no := generate_next_transfer_number_locked(v_org_id);

    INSERT INTO stock_transfers (
        organisation_id, company_id, transfer_no, transfer_date,
        from_warehouse_id, to_warehouse_id, vehicle_no, transporter_name,
        status, created_by, remarks
    ) VALUES (
        v_org_id, v_org_id, v_transfer_no, CURRENT_DATE,
        v_source_wh_id, v_req.destination_warehouse_id, p_vehicle_no, p_transporter,
        'DRAFT', v_actor_id, 'Transfer for WSR: ' || v_req.request_number
    ) RETURNING id INTO v_transfer_id;

    -- Create Floor Pick List Header for the source warehouse
    INSERT INTO warehouse_pick_lists (
        organisation_id, pick_no, source_ref, priority, status, warehouse_id, transfer_id, created_by
    ) VALUES (
        v_org_id, 'PK-' || v_transfer_no, 'WSR: ' || v_req.request_number,
        CASE 
          WHEN v_req.priority IN ('low', 'normal', 'high', 'urgent', 'critical') THEN v_req.priority 
          ELSE 'normal' 
        END,
        'queued', v_source_wh_id, v_transfer_id, v_actor_id
    ) RETURNING id INTO v_pick_list_id;

    FOREACH v_alloc_id IN ARRAY p_allocation_ids LOOP
        SELECT * INTO v_alloc FROM stock_request_allocations WHERE id = v_alloc_id FOR UPDATE;
        v_transfer_qty := v_alloc.allocated_qty - v_alloc.dispatched_qty - v_alloc.released_qty;

        IF v_transfer_qty > 0 THEN
            INSERT INTO stock_transfer_items (
                transfer_id, organisation_id, item_id, company_variant_id, quantity, received_qty
            ) VALUES (
                v_transfer_id, v_org_id, v_alloc.item_id, v_alloc.company_variant_id, v_transfer_qty, 0
            );

            UPDATE stock_request_allocations
            SET transfer_id = v_transfer_id, updated_at = now()
            WHERE id = v_alloc_id;

            -- Try to find an eligible bin in source warehouse
            SELECT wb.id INTO v_found_bin_id
            FROM warehouse_bins wb
            JOIN warehouse_tiers wt ON wt.id = wb.tier_id
            JOIN warehouse_racks wr ON wr.id = wt.rack_id
            JOIN warehouse_layouts wl ON wl.id = wr.layout_id
            JOIN warehouse_zones wz ON wz.id = wl.zone_id
            JOIN warehouse_floors wf ON wf.id = wz.floor_id
            LEFT JOIN warehouse_bin_items bi ON bi.bin_id = wb.id 
                 AND bi.item_id = v_alloc.item_id 
                 AND ((v_alloc.company_variant_id IS NULL AND (bi.item_variant_id IS NULL OR bi.company_variant_id IS NULL))
                      OR bi.company_variant_id = v_alloc.company_variant_id
                      OR bi.item_variant_id = v_alloc.company_variant_id)
                 AND bi.deleted_at IS NULL
            WHERE wf.warehouse_id = v_source_wh_id
              AND wb.deleted_at IS NULL
              AND COALESCE(wb.status, 'available') = 'available'
            ORDER BY COALESCE(bi.quantity, 0) DESC, wb.name ASC
            LIMIT 1;

            -- If an eligible source bin exists, create pick list item and dispatch floor task
            IF v_found_bin_id IS NOT NULL AND v_pick_list_id IS NOT NULL THEN
                INSERT INTO warehouse_pick_list_items (
                    pick_list_id, item_id, company_variant_id, source_bin_id,
                    quantity_requested, quantity_picked, status
                ) VALUES (
                    v_pick_list_id, v_alloc.item_id, v_alloc.company_variant_id, v_found_bin_id,
                    v_transfer_qty, 0, 'pending'
                );

                INSERT INTO warehouse_dispatches (
                    organisation_id, dispatch_no, sales_order_ref, item_id, company_variant_id,
                    quantity, reserved_qty, source_bin_id, priority, status,
                    warehouse_id, transfer_id, created_by
                ) VALUES (
                    v_org_id, 'DSP-' || v_transfer_no, 'WSR: ' || v_req.request_number,
                    v_alloc.item_id, v_alloc.company_variant_id,
                    v_transfer_qty, 0, v_found_bin_id,
                    CASE 
                      WHEN v_req.priority IN ('low', 'normal', 'high', 'urgent', 'critical') THEN v_req.priority 
                      ELSE 'normal' 
                    END,
                    'draft', v_source_wh_id, v_transfer_id, v_actor_id
                );
            END IF;
        END IF;
    END LOOP;

    -- If no pick list items were generated (e.g. warehouse has no bins yet), clean up empty pick list header
    IF NOT EXISTS (SELECT 1 FROM warehouse_pick_list_items WHERE pick_list_id = v_pick_list_id) THEN
        DELETE FROM warehouse_pick_lists WHERE id = v_pick_list_id;
        v_pick_list_id := NULL;
    END IF;

    UPDATE stock_requests
    SET status = CASE WHEN status = 'allocated' THEN 'awaiting_dispatch' ELSE status END,
        updated_at = now()
    WHERE id = p_request_id;

    INSERT INTO stock_request_activity_log (
        organisation_id, request_id, event_type, actor_id, reference_type, reference_id, remarks
    ) VALUES (
        v_org_id, p_request_id, 'transfer_created', v_actor_id, 'stock_transfers', v_transfer_id,
        'Created Transfer Order ' || v_transfer_no || CASE WHEN v_pick_list_id IS NOT NULL THEN ' with Floor Pick List' ELSE '' END
    );

    RETURN jsonb_build_object(
        'status', 'success',
        'transfer_id', v_transfer_id,
        'transfer_no', v_transfer_no,
        'pick_list_id', v_pick_list_id,
        'floor_bridged', (v_pick_list_id IS NOT NULL)
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_transfer_to_stock_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    r_alloc RECORD;
    v_req_id UUID;
    v_all_dispatched BOOLEAN;
    v_all_received BOOLEAN;
    v_is_dispatch BOOLEAN;
    v_is_receive BOOLEAN;
    v_old_status TEXT := COALESCE(OLD.status, '');
    v_new_status TEXT := COALESCE(NEW.status, '');
BEGIN
    -- Only trigger on status change
    IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
        RETURN NEW;
    END IF;

    v_is_dispatch := UPPER(v_new_status) IN ('ON_TRANSIT', 'DISPATCHED', 'IN_TRANSIT') 
                     AND UPPER(v_old_status) NOT IN ('ON_TRANSIT', 'DISPATCHED', 'IN_TRANSIT');

    v_is_receive := UPPER(v_new_status) IN ('RECEIVED', 'COMPLETED', 'FULFILLED') 
                    AND UPPER(v_old_status) NOT IN ('RECEIVED', 'COMPLETED', 'FULFILLED');

    -- When transfer is dispatched
    IF v_is_dispatch THEN
        FOR r_alloc IN SELECT * FROM stock_request_allocations WHERE transfer_id = NEW.id LOOP
            UPDATE stock_request_allocations
            SET dispatched_qty = allocated_qty - released_qty,
                status = 'dispatched',
                updated_at = now()
            WHERE id = r_alloc.id;

            UPDATE stock_request_lines
            SET dispatched_qty = (
                SELECT COALESCE(SUM(dispatched_qty), 0) FROM stock_request_allocations WHERE request_line_id = r_alloc.request_line_id
            ), updated_at = now()
            WHERE id = r_alloc.request_line_id;

            v_req_id := r_alloc.request_id;
        END LOOP;

        IF v_req_id IS NOT NULL THEN
            SELECT bool_and(dispatched_qty >= allocated_qty) INTO v_all_dispatched
            FROM stock_request_lines WHERE request_id = v_req_id;

            UPDATE stock_requests
            SET status = CASE WHEN v_all_dispatched THEN 'in_transit' ELSE 'partially_dispatched' END,
                updated_at = now()
            WHERE id = v_req_id;

            INSERT INTO stock_request_activity_log (
                organisation_id, request_id, event_type, actor_id, reference_type, reference_id, remarks
            ) VALUES (
                NEW.organisation_id, v_req_id, 'dispatched', COALESCE(NEW.dispatched_by_user_id, auth.uid()),
                'stock_transfers', NEW.id, 'Transfer ' || COALESCE(NEW.transfer_no, '') || ' dispatched'
            );
        END IF;

        -- Advance linked warehouse dispatches
        UPDATE warehouse_dispatches
        SET status = 'completed',
            completed_at = COALESCE(completed_at, now()),
            updated_at = now()
        WHERE transfer_id = NEW.id AND status NOT IN ('completed', 'cancelled');

        -- Advance linked pick lists
        UPDATE warehouse_pick_lists
        SET status = 'completed',
            completed_at = COALESCE(completed_at, now()),
            updated_at = now()
        WHERE transfer_id = NEW.id AND status NOT IN ('completed', 'cancelled');
    END IF;

    -- When transfer is received
    IF v_is_receive THEN
        FOR r_alloc IN SELECT * FROM stock_request_allocations WHERE transfer_id = NEW.id LOOP
            UPDATE stock_request_allocations
            SET received_qty = dispatched_qty,
                status = 'received',
                updated_at = now()
            WHERE id = r_alloc.id;

            UPDATE stock_request_lines
            SET received_qty = (
                SELECT COALESCE(SUM(received_qty), 0) FROM stock_request_allocations WHERE request_line_id = r_alloc.request_line_id
            ), updated_at = now()
            WHERE id = r_alloc.request_line_id;

            v_req_id := r_alloc.request_id;
        END LOOP;

        IF v_req_id IS NOT NULL THEN
            SELECT bool_and(received_qty >= requested_qty) INTO v_all_received
            FROM stock_request_lines WHERE request_id = v_req_id;

            UPDATE stock_requests
            SET status = CASE WHEN v_all_received THEN 'fulfilled' ELSE 'partially_received' END,
                updated_at = now()
            WHERE id = v_req_id;

            INSERT INTO stock_request_activity_log (
                organisation_id, request_id, event_type, actor_id, reference_type, reference_id, remarks
            ) VALUES (
                NEW.organisation_id, v_req_id, 'received', COALESCE(NEW.received_by_user_id, auth.uid()),
                'stock_transfers', NEW.id, 'Transfer ' || COALESCE(NEW.transfer_no, '') || ' received at destination warehouse'
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;
