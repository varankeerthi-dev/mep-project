-- Migration: Create reverse_production_entry RPC

CREATE OR REPLACE FUNCTION reverse_production_entry(p_entry_id UUID)
RETURNS UUID AS $$
DECLARE
    v_entry RECORD;
    v_mat RECORD;
    v_wh_wip UUID;
    v_wh_main UUID;
    v_wh_fg UUID;
    v_fg_product_id UUID;
    v_reversal_id UUID;
    v_reversal_entry_no TEXT;
    v_job_card RECORD;
BEGIN
    -- 1. Get original entry
    SELECT * INTO v_entry FROM production_entries WHERE id = p_entry_id AND (status IS NULL OR status = 'active');
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active production entry not found';
    END IF;

    -- 2. Get warehouses
    SELECT id INTO v_wh_wip FROM warehouses WHERE organisation_id = v_entry.organisation_id AND warehouse_purpose = 'wip' LIMIT 1;
    SELECT id INTO v_wh_main FROM warehouses WHERE organisation_id = v_entry.organisation_id AND (warehouse_purpose = 'main' OR is_default = true) LIMIT 1;
    SELECT id INTO v_wh_fg FROM warehouses WHERE organisation_id = v_entry.organisation_id AND warehouse_purpose = 'fg' LIMIT 1;

    -- 3. Get job card
    SELECT * INTO v_job_card FROM job_cards WHERE id = v_entry.job_card_id;

    -- 4. Mark original as superseded
    UPDATE production_entries SET status = 'edited' WHERE id = p_entry_id;

    -- 5. Create Reversal Entry
    v_reversal_entry_no := 'REV-' || v_entry.entry_no;
    
    INSERT INTO production_entries (
        job_card_id, entry_no, actual_qty, output_unit, 
        operator_name, machine_name, notes, scrap_byproducts,
        production_start_time, production_end_time, 
        organisation_id, created_by, status, reversal_for
    ) VALUES (
        v_entry.job_card_id, v_reversal_entry_no, -v_entry.actual_qty, v_entry.output_unit,
        v_entry.operator_name, v_entry.machine_name, 'System generated reversal for edit', v_entry.scrap_byproducts,
        v_entry.production_start_time, v_entry.production_end_time,
        v_entry.organisation_id, v_entry.created_by, 'reversal', p_entry_id
    ) RETURNING id INTO v_reversal_id;

    -- 6. Process materials (Reverse the flows)
    FOR v_mat IN SELECT * FROM production_materials WHERE production_entry_id = p_entry_id LOOP
        -- A. Insert Reversal material log
        INSERT INTO production_materials (
            production_entry_id, material_id, material_name,
            issued_qty, consumed_qty, wastage_qty, return_qty,
            job_card_material_id
        ) VALUES (
            v_reversal_id, v_mat.material_id, v_mat.material_name,
            0, -v_mat.consumed_qty, -v_mat.wastage_qty, -v_mat.return_qty,
            v_mat.job_card_material_id
        );

        -- B. Restore WIP stock (Add back consumed + wastage)
        UPDATE item_stock 
        SET current_stock = current_stock + (v_mat.consumed_qty + v_mat.wastage_qty)
        WHERE item_id = v_mat.material_id AND warehouse_id = v_wh_wip AND organisation_id = v_entry.organisation_id;

        -- C. Revert Main Store stock (Deduct returned)
        IF v_mat.return_qty > 0 THEN
            UPDATE item_stock 
            SET current_stock = current_stock - v_mat.return_qty
            WHERE item_id = v_mat.material_id AND warehouse_id = v_wh_main AND organisation_id = v_entry.organisation_id;
        END IF;

        -- D. Revert Job Card Materials cumulative
        IF v_mat.job_card_material_id IS NOT NULL THEN
            UPDATE job_card_materials
            SET consumed_qty = consumed_qty - v_mat.consumed_qty,
                wastage_qty = wastage_qty - v_mat.wastage_qty,
                return_qty = return_qty - v_mat.return_qty
            WHERE id = v_mat.job_card_material_id;
        END IF;
    END LOOP;

    -- 7. Deduct FG stock (Find the product id)
    -- We'll assume the product name matches materials table, or BOM is linked. For simplicity, we just deduct actual_qty if possible.
    -- (If we had product_id on job_cards it would be easier, but we fall back to name)
    SELECT id INTO v_fg_product_id FROM materials WHERE name = v_job_card.product_name AND organisation_id = v_entry.organisation_id LIMIT 1;
    
    IF v_fg_product_id IS NOT NULL AND v_entry.actual_qty > 0 THEN
        UPDATE item_stock
        SET current_stock = current_stock - v_entry.actual_qty
        WHERE item_id = v_fg_product_id AND warehouse_id = v_wh_fg AND organisation_id = v_entry.organisation_id;
    END IF;

    -- 8. Deduct from Job Card actual_qty
    UPDATE job_cards
    SET actual_qty = GREATEST(0, actual_qty - v_entry.actual_qty),
        status = 'in_progress'
    WHERE id = v_entry.job_card_id;

    RETURN v_reversal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
