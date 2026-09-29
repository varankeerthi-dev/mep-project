-- Migration: Warehouse Stock Requests & Fulfillment Core RPCs & Automation
-- File: apps/web/supabase/migrations/20260927000002_stock_request_rpcs.sql

-- 1. Number Generation
CREATE OR REPLACE FUNCTION public.generate_wsr_number(p_org_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_next_number bigint;
    v_series_key text := 'WSR';
    v_prefix text := 'WSR-';
    v_padding int := 5;
    v_result text;
BEGIN
    IF auth.uid() IS NOT NULL AND NOT user_can_access_org(p_org_id) THEN
        RAISE EXCEPTION 'Access denied to organisation';
    END IF;

    -- Lock and increment
    SELECT next_number INTO v_next_number
    FROM domain_number_series
    WHERE organisation_id = p_org_id AND series_key = v_series_key
    FOR UPDATE;

    IF v_next_number IS NULL THEN
        INSERT INTO domain_number_series (organisation_id, series_key, prefix, padding, next_number, active)
        VALUES (p_org_id, v_series_key, v_prefix, v_padding, 2, true)
        ON CONFLICT (organisation_id, series_key) DO UPDATE
            SET next_number = domain_number_series.next_number + 1
        RETURNING next_number - 1 INTO v_next_number;
    ELSE
        UPDATE domain_number_series
        SET next_number = next_number + 1, updated_at = now()
        WHERE organisation_id = p_org_id AND series_key = v_series_key;
    END IF;

    v_result := v_prefix || lpad(v_next_number::text, v_padding, '0');
    RETURN v_result;
END;
$$;

-- 2. Stock Availability Calculation
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
AS $$
DECLARE
    v_on_hand numeric := 0;
    v_so_committed numeric := 0;
    v_sr_committed numeric := 0;
    v_total_committed numeric := 0;
    v_available_to_commit numeric := 0;
BEGIN
    IF auth.uid() IS NOT NULL AND NOT user_can_access_org(p_org_id) THEN
        RAISE EXCEPTION 'Access denied to organisation';
    END IF;

    -- On Hand Stock
    SELECT COALESCE(SUM(current_stock), 0) INTO v_on_hand
    FROM item_stock
    WHERE organisation_id = p_org_id
      AND item_id = p_item_id
      AND (p_variant_id IS NULL OR company_variant_id = p_variant_id)
      AND warehouse_id = p_warehouse_id;

    -- Sales Order Commitments
    SELECT COALESCE(SUM(qty), 0) INTO v_so_committed
    FROM sales_order_reservations
    WHERE organisation_id = p_org_id
      AND item_id = p_item_id
      AND warehouse_id = p_warehouse_id;

    -- Stock Request Commitments (allocated - released - dispatched)
    SELECT COALESCE(SUM(allocated_qty - released_qty - dispatched_qty), 0) INTO v_sr_committed
    FROM stock_request_allocations
    WHERE organisation_id = p_org_id
      AND item_id = p_item_id
      AND (p_variant_id IS NULL OR company_variant_id = p_variant_id)
      AND source_warehouse_id = p_warehouse_id
      AND status IN ('confirmed', 'partially_dispatched');

    v_total_committed := v_so_committed + v_sr_committed;
    v_available_to_commit := GREATEST(0, v_on_hand - v_total_committed);

    RETURN jsonb_build_object(
        'item_id', p_item_id,
        'company_variant_id', p_variant_id,
        'warehouse_id', p_warehouse_id,
        'on_hand', v_on_hand,
        'so_committed', v_so_committed,
        'sr_committed', v_sr_committed,
        'total_committed', v_total_committed,
        'available_to_commit', v_available_to_commit
    );
END;
$$;

-- 3. Atomic Request Creation
CREATE OR REPLACE FUNCTION public.create_stock_request_atomic(
    p_request jsonb,
    p_lines jsonb,
    p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_org_id uuid;
    v_req_id uuid;
    v_req_num text;
    v_req_record record;
    v_line jsonb;
    v_actor_id uuid := COALESCE(auth.uid(), NULLIF(p_request->>'requested_by', '')::uuid);
    v_line_number int := 1;
BEGIN
    v_org_id := (p_request->>'organisation_id')::uuid;

    IF auth.uid() IS NOT NULL AND NOT user_can_access_org(v_org_id) THEN
        RAISE EXCEPTION 'Access denied to organisation';
    END IF;

    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Missing requested_by actor';
    END IF;

    IF p_idempotency_key IS NOT NULL AND p_idempotency_key != '' THEN
        IF EXISTS (SELECT 1 FROM domain_idempotency_keys WHERE organisation_id = v_org_id AND operation = 'create_stock_request' AND client_request_id = p_idempotency_key) THEN
            SELECT response INTO v_req_record FROM domain_idempotency_keys WHERE organisation_id = v_org_id AND operation = 'create_stock_request' AND client_request_id = p_idempotency_key;
            RETURN v_req_record.response;
        END IF;
    END IF;

    v_req_num := generate_wsr_number(v_org_id);

    INSERT INTO stock_requests (
        organisation_id, request_number, destination_warehouse_id, requested_by,
        required_date, priority, remarks, idempotency_key
    ) VALUES (
        v_org_id, v_req_num, (p_request->>'destination_warehouse_id')::uuid, v_actor_id,
        NULLIF(p_request->>'required_date', '')::date, COALESCE(NULLIF(p_request->>'priority', ''), 'normal'),
        p_request->>'remarks', p_idempotency_key
    ) RETURNING * INTO v_req_record;

    v_req_id := v_req_record.id;

    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
        INSERT INTO stock_request_lines (
            organisation_id, request_id, item_id, company_variant_id, requested_qty, notes, line_number
        ) VALUES (
            v_org_id, v_req_id, (v_line->>'item_id')::uuid, NULLIF(v_line->>'company_variant_id', '')::uuid,
            (v_line->>'requested_qty')::numeric, v_line->>'notes', v_line_number
        );
        v_line_number := v_line_number + 1;
    END LOOP;

    INSERT INTO stock_request_activity_log (
        organisation_id, request_id, event_type, actor_id, destination_warehouse_id, remarks
    ) VALUES (
        v_org_id, v_req_id, 'created', v_actor_id, (p_request->>'destination_warehouse_id')::uuid, 'Stock request created'
    );

    IF p_idempotency_key IS NOT NULL AND p_idempotency_key != '' THEN
        INSERT INTO domain_idempotency_keys (organisation_id, operation, client_request_id, actor_id, response)
        VALUES (v_org_id, 'create_stock_request', p_idempotency_key, v_actor_id, row_to_json(v_req_record)::jsonb)
        ON CONFLICT DO NOTHING;
    END IF;

    RETURN row_to_json(v_req_record)::jsonb;
END;
$$;

-- 4. Submit Stock Request
CREATE OR REPLACE FUNCTION public.submit_stock_request(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_req_record record;
    v_actor_id uuid := auth.uid();
BEGIN
    SELECT * INTO v_req_record FROM stock_requests WHERE id = p_request_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;

    IF v_actor_id IS NOT NULL AND NOT user_can_access_org(v_req_record.organisation_id) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    IF v_req_record.status != 'draft' THEN
        RAISE EXCEPTION 'Can only submit draft requests. Current status: %', v_req_record.status;
    END IF;

    v_actor_id := COALESCE(v_actor_id, v_req_record.requested_by);

    UPDATE stock_requests
    SET status = 'submitted', submitted_at = now(), updated_at = now()
    WHERE id = p_request_id
    RETURNING * INTO v_req_record;

    INSERT INTO stock_request_activity_log (
        organisation_id, request_id, event_type, actor_id, before_status, after_status, remarks
    ) VALUES (
        v_req_record.organisation_id, p_request_id, 'submitted', v_actor_id, 'draft', 'submitted', 'Request submitted for processing'
    );

    RETURN row_to_json(v_req_record)::jsonb;
END;
$$;

-- 5. Acknowledge Stock Request
CREATE OR REPLACE FUNCTION public.acknowledge_stock_request(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_req_record record;
    v_actor_id uuid := auth.uid();
BEGIN
    SELECT * INTO v_req_record FROM stock_requests WHERE id = p_request_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;

    IF v_actor_id IS NOT NULL AND NOT user_can_access_org(v_req_record.organisation_id) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    IF v_req_record.status != 'submitted' THEN
        RAISE EXCEPTION 'Can only acknowledge submitted requests. Current status: %', v_req_record.status;
    END IF;

    v_actor_id := COALESCE(v_actor_id, v_req_record.requested_by);

    UPDATE stock_requests
    SET status = 'under_process', updated_at = now()
    WHERE id = p_request_id
    RETURNING * INTO v_req_record;

    INSERT INTO stock_request_activity_log (
        organisation_id, request_id, event_type, actor_id, before_status, after_status, remarks
    ) VALUES (
        v_req_record.organisation_id, p_request_id, 'acknowledged', v_actor_id, 'submitted', 'under_process', 'Request acknowledged and placed under process'
    );

    RETURN row_to_json(v_req_record)::jsonb;
END;
$$;

-- 6. Allocate Stock Request Atomic
CREATE OR REPLACE FUNCTION public.allocate_stock_request_atomic(p_allocation jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

    -- Concurrency check on source warehouse available stock
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
$$;

-- 7. Release Stock Request Allocation
CREATE OR REPLACE FUNCTION public.release_stock_request_allocation(
    p_allocation_id uuid,
    p_release_qty numeric,
    p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_alloc stock_request_allocations%ROWTYPE;
    v_actor_id uuid := auth.uid();
    v_remaining_available numeric;
BEGIN
    SELECT * INTO v_alloc FROM stock_request_allocations WHERE id = p_allocation_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Allocation not found'; END IF;

    IF v_actor_id IS NOT NULL AND NOT user_can_access_org(v_alloc.organisation_id) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    v_remaining_available := v_alloc.allocated_qty - v_alloc.dispatched_qty - v_alloc.released_qty;
    IF p_release_qty <= 0 OR p_release_qty > v_remaining_available THEN
        RAISE EXCEPTION 'Cannot release % units. Available un-dispatched: %', p_release_qty, v_remaining_available;
    END IF;

    IF v_actor_id IS NULL THEN
        SELECT requested_by INTO v_actor_id FROM stock_requests WHERE id = v_alloc.request_id;
    END IF;

    UPDATE stock_request_allocations
    SET released_qty = released_qty + p_release_qty,
        status = CASE WHEN (released_qty + p_release_qty) >= (allocated_qty - dispatched_qty) AND dispatched_qty = 0 THEN 'released' ELSE status END,
        updated_at = now()
    WHERE id = p_allocation_id;

    UPDATE stock_request_lines
    SET allocated_qty = GREATEST(0, allocated_qty - p_release_qty), updated_at = now()
    WHERE id = v_alloc.request_line_id;

    UPDATE stock_requests
    SET status = 'partially_allocated', updated_at = now()
    WHERE id = v_alloc.request_id AND status = 'allocated';

    INSERT INTO stock_request_activity_log (
        organisation_id, request_id, request_line_id, allocation_id, event_type, actor_id,
        quantity, remarks
    ) VALUES (
        v_alloc.organisation_id, v_alloc.request_id, v_alloc.request_line_id, p_allocation_id,
        'released', v_actor_id, p_release_qty, COALESCE(p_reason, 'Emergency allocation release')
    );

    RETURN jsonb_build_object('id', p_allocation_id, 'status', 'success', 'released_qty', p_release_qty);
END;
$$;

-- 8. Cancel Stock Request
CREATE OR REPLACE FUNCTION public.cancel_stock_request(p_request_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_req stock_requests%ROWTYPE;
    v_alloc stock_request_allocations%ROWTYPE;
    v_actor_id uuid := auth.uid();
BEGIN
    SELECT * INTO v_req FROM stock_requests WHERE id = p_request_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;

    IF v_actor_id IS NOT NULL AND NOT user_can_access_org(v_req.organisation_id) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    IF EXISTS (
        SELECT 1 FROM stock_request_lines
        WHERE request_id = p_request_id AND (dispatched_qty > 0 OR received_qty > 0)
    ) THEN
        RAISE EXCEPTION 'Cannot cancel request with dispatched or received items';
    END IF;

    v_actor_id := COALESCE(v_actor_id, v_req.requested_by);

    -- Release all remaining allocated quantities
    FOR v_alloc IN SELECT * FROM stock_request_allocations WHERE request_id = p_request_id AND status NOT IN ('released', 'cancelled') FOR UPDATE LOOP
        PERFORM release_stock_request_allocation(
            v_alloc.id,
            v_alloc.allocated_qty - v_alloc.dispatched_qty - v_alloc.released_qty,
            'Request cancellation: ' || COALESCE(p_reason, '')
        );
    END LOOP;

    UPDATE stock_requests
    SET status = 'cancelled', cancelled_at = now(), cancelled_by = v_actor_id,
        cancellation_reason = p_reason, updated_at = now()
    WHERE id = p_request_id;

    INSERT INTO stock_request_activity_log (
        organisation_id, request_id, event_type, actor_id, remarks
    ) VALUES (
        v_req.organisation_id, p_request_id, 'cancelled', v_actor_id, 'Cancelled: ' || COALESCE(p_reason, '')
    );

    RETURN jsonb_build_object('id', p_request_id, 'status', 'cancelled');
END;
$$;

-- 9. Trigger on Stock Transfers to Sync Dispatch & Receipts to Stock Request
CREATE OR REPLACE FUNCTION public.sync_transfer_to_stock_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_alloc record;
    v_req_id uuid;
    v_new_status text;
BEGIN
    -- Check if this transfer is tied to any stock request allocations
    FOR v_alloc IN SELECT DISTINCT request_id FROM stock_request_allocations WHERE transfer_id = NEW.id LOOP
        v_req_id := v_alloc.request_id;

        IF NEW.status = 'dispatched' AND (OLD.status IS NULL OR OLD.status != 'dispatched') THEN
            -- Mark associated allocations as dispatched
            UPDATE stock_request_allocations
            SET dispatched_qty = allocated_qty - released_qty,
                status = 'dispatched',
                updated_at = now()
            WHERE transfer_id = NEW.id AND status = 'confirmed';

            -- Update lines dispatched quantity
            UPDATE stock_request_lines l
            SET dispatched_qty = (
                SELECT COALESCE(SUM(dispatched_qty), 0)
                FROM stock_request_allocations
                WHERE request_line_id = l.id
            ), updated_at = now()
            WHERE l.request_id = v_req_id;

            -- Update stock request status
            UPDATE stock_requests
            SET status = 'in_transit', updated_at = now()
            WHERE id = v_req_id;

            INSERT INTO stock_request_activity_log (
                organisation_id, request_id, event_type, actor_id, reference_type, reference_id, remarks
            ) VALUES (
                NEW.organisation_id, v_req_id, 'dispatched', COALESCE(NEW.dispatched_by_user_id, auth.uid()), 'stock_transfers', NEW.id, 'Transfer ' || COALESCE(NEW.transfer_no, '') || ' dispatched'
            );

        ELSIF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
            -- Mark associated allocations as received
            UPDATE stock_request_allocations
            SET received_qty = dispatched_qty,
                status = 'received',
                updated_at = now()
            WHERE transfer_id = NEW.id;

            -- Update lines received quantity
            UPDATE stock_request_lines l
            SET received_qty = (
                SELECT COALESCE(SUM(received_qty), 0)
                FROM stock_request_allocations
                WHERE request_line_id = l.id
            ), updated_at = now()
            WHERE l.request_id = v_req_id;

            -- Determine if fully fulfilled or partially received
            IF EXISTS (
                SELECT 1 FROM stock_request_lines WHERE request_id = v_req_id AND received_qty < requested_qty
            ) THEN
                v_new_status := 'partially_received';
            ELSE
                v_new_status := 'fulfilled';
            END IF;

            UPDATE stock_requests
            SET status = v_new_status, updated_at = now()
            WHERE id = v_req_id;

            INSERT INTO stock_request_activity_log (
                organisation_id, request_id, event_type, actor_id, reference_type, reference_id, remarks
            ) VALUES (
                NEW.organisation_id, v_req_id, 'received', COALESCE(NEW.received_by_user_id, auth.uid()), 'stock_transfers', NEW.id, 'Transfer ' || COALESCE(NEW.transfer_no, '') || ' received'
            );
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_transfer_to_stock_request ON stock_transfers;
CREATE TRIGGER trg_sync_transfer_to_stock_request
    AFTER INSERT OR UPDATE OF status ON stock_transfers
    FOR EACH ROW
    EXECUTE FUNCTION sync_transfer_to_stock_request();
