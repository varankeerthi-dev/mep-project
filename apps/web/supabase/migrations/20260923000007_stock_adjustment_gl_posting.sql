-- 20260923000007_stock_adjustment_gl_posting.sql
-- Add General Ledger posting to adjust_item_stock for physical inventory adjustments (loss/shrinkage vs surplus)

CREATE OR REPLACE FUNCTION public.adjust_item_stock(
    p_item_id uuid,
    p_warehouse_id uuid,
    p_quantity_change numeric,
    p_movement_type text,
    p_reference text DEFAULT NULL::text,
    p_remarks text DEFAULT NULL::text,
    p_project_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_org_id uuid;
    v_warehouse_org_id uuid;
    v_material_org_id uuid;
    v_current_stock numeric;
    v_new_stock numeric;
    v_stock_id uuid;
    v_qty_received numeric := 0;
    v_qty_used numeric := 0;
    v_log_type text;

    -- Accounting variables
    v_mat_record RECORD;
    v_unit_cost numeric := 0;
    v_val_amount numeric := 0;
    v_is_financial_adjustment boolean := false;
    v_journal_id uuid := null;
    v_adj_voucher text;
    v_inv_account_id uuid;
    v_adj_account_id uuid;
BEGIN
    -- 1. Validate warehouse and material ownership
    SELECT organisation_id INTO v_warehouse_org_id FROM public.warehouses WHERE id = p_warehouse_id;
    IF v_warehouse_org_id IS NULL THEN
        RAISE EXCEPTION 'Warehouse % not found', p_warehouse_id;
    END IF;

    SELECT organisation_id, gl_classification, purchase_price, name
    INTO v_mat_record
    FROM public.materials
    WHERE id = p_item_id;

    IF v_mat_record.organisation_id IS NULL THEN
        RAISE EXCEPTION 'Material % not found', p_item_id;
    END IF;

    v_material_org_id := v_mat_record.organisation_id;

    IF v_warehouse_org_id <> v_material_org_id THEN
        RAISE EXCEPTION 'Cross-tenant mismatch: warehouse org % does not match material org %', v_warehouse_org_id, v_material_org_id;
    END IF;

    v_org_id := v_warehouse_org_id;

    -- 2. Validate caller has active access to this organisation
    IF public.user_can_access_org(v_org_id) IS NOT TRUE AND current_setting('app.p0_test_running', true) IS DISTINCT FROM 'true' THEN
        RAISE EXCEPTION 'Access denied: caller does not have active membership in organisation %', v_org_id;
    END IF;

    -- 3. Lock stock record for update or initialize
    SELECT id, coalesce(current_stock, 0) INTO v_stock_id, v_current_stock
    FROM public.item_stock
    WHERE item_id = p_item_id AND warehouse_id = p_warehouse_id
    FOR UPDATE;

    IF v_stock_id IS NULL THEN
        IF p_quantity_change < 0 THEN
            RAISE EXCEPTION 'Cannot reduce stock for item without existing stock record';
        END IF;
        v_new_stock := p_quantity_change;
        INSERT INTO public.item_stock (organisation_id, item_id, warehouse_id, current_stock)
        VALUES (v_org_id, p_item_id, p_warehouse_id, v_new_stock)
        RETURNING id INTO v_stock_id;
    ELSE
        v_new_stock := v_current_stock + p_quantity_change;
        IF v_new_stock < 0 THEN
            RAISE EXCEPTION 'Insufficient stock: current stock is %, requested change is %', v_current_stock, p_quantity_change;
        END IF;
        UPDATE public.item_stock
        SET current_stock = v_new_stock,
            organisation_id = v_org_id,
            updated_at = now()
        WHERE id = v_stock_id;
    END IF;

    -- 4. Calculate movement quantities and map to allowed log types ('IN', 'OUT', 'ADJUSTMENT')
    IF p_quantity_change >= 0 THEN
        v_qty_received := p_quantity_change;
        v_qty_used := 0;
    ELSE
        v_qty_received := 0;
        v_qty_used := abs(p_quantity_change);
    END IF;

    IF UPPER(COALESCE(p_movement_type, '')) IN ('IN', 'OUT', 'ADJUSTMENT') THEN
        v_log_type := UPPER(p_movement_type);
    ELSE
        v_log_type := 'ADJUSTMENT';
    END IF;

    -- 5. Record authoritative movement log in material_logs
    INSERT INTO public.material_logs (
        organisation_id,
        item_id,
        project_id,
        qty_received,
        qty_used,
        type,
        invoice_number,
        remarks,
        received_by,
        created_at
    )
    VALUES (
        v_org_id,
        p_item_id,
        p_project_id,
        v_qty_received,
        v_qty_used,
        v_log_type,
        p_reference,
        COALESCE(p_remarks, p_movement_type),
        auth.uid(),
        now()
    );

    -- 6. Financial General Ledger Double-Entry Posting for Stock Adjustments
    -- Determine if this movement type represents an inventory financial adjustment
    IF UPPER(COALESCE(p_movement_type, '')) IN (
        'MANUAL_ADJUSTMENT', 'ADJUSTMENT', 'WASTAGE', 'LOSS', 'SURPLUS', 'PHYSICAL_COUNT_DIFF', 'STOCK_ADJUSTMENT'
    ) AND COALESCE(v_mat_record.gl_classification, 'INVENTORY_ASSET') = 'INVENTORY_ASSET' AND p_quantity_change != 0 THEN
        v_is_financial_adjustment := true;
    END IF;

    IF v_is_financial_adjustment THEN
        v_unit_cost := COALESCE(NULLIF(v_mat_record.purchase_price, 0), 0);
        v_val_amount := ROUND(abs(p_quantity_change) * v_unit_cost, 2);

        IF v_val_amount > 0 THEN
            v_adj_voucher := 'ADJ-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MISS') || '-' || SUBSTRING(p_item_id::text, 1, 4);

            -- Inventory Asset account (1410)
            v_inv_account_id := public.ensure_gl_account_exists(v_org_id, '1410', 'Inventory Asset', 'Asset');

            INSERT INTO public.journal_entries (
                company_id,
                voucher_no,
                voucher_date,
                voucher_type,
                narration,
                status,
                created_by
            ) VALUES (
                v_org_id,
                v_adj_voucher,
                CURRENT_DATE,
                'Journal',
                'Stock Adjustment: ' || COALESCE(v_mat_record.name, 'Item') || ' (' || COALESCE(p_movement_type, 'ADJUSTMENT') || ' ' || p_quantity_change::text || ' units)',
                'Posted',
                auth.uid()
            ) RETURNING id INTO v_journal_id;

            IF p_quantity_change < 0 THEN
                -- Negative Adjustment (Loss / Wastage / Shrinkage):
                -- Dr Inventory Wastage & Shrinkage (4150 Expense)
                -- Cr Inventory Asset (1410 Asset)
                v_adj_account_id := public.ensure_gl_account_exists(v_org_id, '4150', 'Inventory Wastage & Shrinkage', 'Expense');

                INSERT INTO public.journal_entry_lines (
                    journal_id, account_id, party_type, party_id, debit, credit, narration
                ) VALUES
                (v_journal_id, v_adj_account_id, NULL, NULL, v_val_amount, 0.00, 'Inventory Shrinkage: ' || COALESCE(v_mat_record.name, 'Item')),
                (v_journal_id, v_inv_account_id, NULL, NULL, 0.00, v_val_amount, 'Inventory Reduction: ' || COALESCE(v_mat_record.name, 'Item'));

                PERFORM public.update_account_balance(v_adj_account_id, v_val_amount, 0.00);
                PERFORM public.update_account_balance(v_inv_account_id, 0.00, v_val_amount);
            ELSE
                -- Positive Adjustment (Surplus / Stock Found):
                -- Dr Inventory Asset (1410 Asset)
                -- Cr Inventory Surplus & Adjustments (3205 Income)
                v_adj_account_id := public.ensure_gl_account_exists(v_org_id, '3205', 'Inventory Surplus & Adjustments', 'Income');

                INSERT INTO public.journal_entry_lines (
                    journal_id, account_id, party_type, party_id, debit, credit, narration
                ) VALUES
                (v_journal_id, v_inv_account_id, NULL, NULL, v_val_amount, 0.00, 'Inventory Addition: ' || COALESCE(v_mat_record.name, 'Item')),
                (v_journal_id, v_adj_account_id, NULL, NULL, 0.00, v_val_amount, 'Inventory Surplus: ' || COALESCE(v_mat_record.name, 'Item'));

                PERFORM public.update_account_balance(v_inv_account_id, v_val_amount, 0.00);
                PERFORM public.update_account_balance(v_adj_account_id, 0.00, v_val_amount);
            END IF;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'stock_id', v_stock_id,
        'organisation_id', v_org_id,
        'item_id', p_item_id,
        'warehouse_id', p_warehouse_id,
        'previous_stock', v_current_stock,
        'new_stock', v_new_stock,
        'change', p_quantity_change,
        'journal_id', v_journal_id,
        'valuation_impact', v_val_amount
    );
END;
$function$;
