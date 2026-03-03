-- ERP Backend Enhancement: Create Quotation from Delivery Challan
-- Implementation with Validation, Consolidation, and Concurrency Protection

-- 1. Ensure Mapping Table exists
CREATE TABLE IF NOT EXISTS quotation_dc_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID NOT NULL,
    dc_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(quotation_id, dc_id)
);

-- 2. Ensure Activity Logs table exists
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_name VARCHAR(50) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(100) NOT NULL,
    old_value JSONB,
    new_value JSONB,
    performed_by UUID,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Stored Procedure for Atomic Consolidation
CREATE OR REPLACE FUNCTION create_quotation_from_dc(
    p_dc_ids UUID[],
    p_created_by UUID
)
RETURNS JSONB AS $$
DECLARE
    v_quotation_id UUID;
    v_quotation_no TEXT;
    v_client_id UUID;
    v_project_id UUID;
    v_dc_count INT;
    v_new_dc_status TEXT := 'IN_QUOTATION';
BEGIN
    -- ---------------------------------------------------------
    -- 1. VALIDATION PHASE
    -- ---------------------------------------------------------

    -- Lock DC rows for update to prevent concurrent modification (Optimistic/Pessimistic hybrid)
    -- This ensures that status/updated_at won't change while we validate
    PERFORM 1 FROM delivery_challans 
    WHERE id = ANY(p_dc_ids) 
    FOR UPDATE;

    -- Verify all DCs exist and get metadata
    SELECT COUNT(*), MIN(client_id), MAX(client_id), MIN(project_id)
    INTO v_dc_count, v_client_id, v_client_id, v_project_id
    FROM delivery_challans
    WHERE id = ANY(p_dc_ids);

    IF v_dc_count != array_length(p_dc_ids, 1) THEN
        RAISE EXCEPTION 'Validation Error: One or more Delivery Challans not found.';
    END IF;

    -- Verify Same Client
    IF (SELECT count(DISTINCT client_id) FROM delivery_challans WHERE id = ANY(p_dc_ids)) > 1 THEN
        RAISE EXCEPTION 'Validation Error: All selected DCs must belong to the same client.';
    END IF;

    -- Verify Status (Must be CONFIRMED, not INVOICED)
    IF EXISTS (
        SELECT 1 FROM delivery_challans 
        WHERE id = ANY(p_dc_ids) 
        AND (status != 'CONFIRMED' OR status = 'INVOICED')
    ) THEN
        RAISE EXCEPTION 'Validation Error: Selected DCs must be in "CONFIRMED" status and not yet "INVOICED".';
    END IF;

    -- Verify No Existing Active Mapping
    IF EXISTS (
        SELECT 1 FROM quotation_dc_mapping WHERE dc_id = ANY(p_dc_ids)
    ) THEN
        RAISE EXCEPTION 'Validation Error: One or more DCs are already mapped to a quotation.';
    END IF;

    -- ---------------------------------------------------------
    -- 2. QUOTATION GENERATION PHASE
    -- ---------------------------------------------------------

    -- Generate Quotation No (Adapt sequence logic as per your system)
    SELECT 'QT-LOT-' || to_char(now(), 'YYYYMMDD') || '-' || LPAD(nextval('quotation_no_seq')::TEXT, 4, '0') INTO v_quotation_no;

    -- Create Quotation Header
    INSERT INTO quotation_header (
        quotation_no,
        client_id,
        project_id,
        quotation_type, -- LOT_BASED
        status,         -- DRAFT
        created_by,
        date,
        updated_at
    ) VALUES (
        v_quotation_no,
        v_client_id,
        v_project_id,
        'LOT_BASED',
        'DRAFT',
        p_created_by,
        CURRENT_DATE,
        NOW()
    ) RETURNING id INTO v_quotation_id;

    -- Create Consolidated Items
    -- Group by item_id, sum qty, aggregate snapshots
    INSERT INTO quotation_items (
        quotation_id,
        item_id,
        description_snapshot,
        qty,
        rate,
        amount,
        quoted_qty,
        invoiced_qty,
        balance_qty
    )
    SELECT 
        v_quotation_id,
        item_id,
        MAX(description_snapshot),
        SUM(qty),
        MAX(rate), -- Assumption: Use highest rate across DCs for the lot
        SUM(amount),
        SUM(qty),
        0,
        SUM(qty)
    FROM dc_items
    WHERE dc_id = ANY(p_dc_ids)
    GROUP BY item_id;

    -- Insert Mapping
    INSERT INTO quotation_dc_mapping (quotation_id, dc_id)
    SELECT v_quotation_id, unnest(p_dc_ids);

    -- ---------------------------------------------------------
    -- 3. DC UPDATE & AUDIT PHASE
    -- ---------------------------------------------------------

    -- Update DC Statuses
    UPDATE delivery_challans
    SET 
        status = v_new_dc_status,
        updated_at = NOW()
    WHERE id = ANY(p_dc_ids);

    -- Activity Log for Quotation
    INSERT INTO activity_logs (module_name, record_id, action, performed_by, new_value)
    VALUES ('QUOTATION', v_quotation_id, 'CREATED_FROM_DC', p_created_by, jsonb_build_object('dc_ids', p_dc_ids));

    -- Activity Log for each DC
    INSERT INTO activity_logs (module_name, record_id, action, performed_by, new_value)
    SELECT 'DC', id, 'ADDED_TO_QUOTATION', p_created_by, jsonb_build_object('quotation_id', v_quotation_id)
    FROM unnest(p_dc_ids) AS id;

    RETURN jsonb_build_object(
        'quotation_id', v_quotation_id,
        'quotation_no', v_quotation_no,
        'message', 'Quotation created successfully from DC'
    );

END;
$$ LANGUAGE plpgsql;
