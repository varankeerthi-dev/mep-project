-- Update approve_purchase_requisition to only calculate availability without forcing allocation
-- This allows manual source determination in the UI

CREATE OR REPLACE FUNCTION public.approve_purchase_requisition(p_requisition_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org_id uuid;
  v_line record;
  v_available numeric;
BEGIN
  SELECT organisation_id INTO v_org_id
  FROM public.purchase_requisitions
  WHERE id = p_requisition_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Requisition not found';
  END IF;

  FOR v_line IN
    SELECT id, item_id, requested_qty
    FROM public.purchase_requisition_lines
    WHERE requisition_id = p_requisition_id
    ORDER BY line_no
  LOOP
    -- Just check availability
    SELECT COALESCE(i.quantity, 0) INTO v_available
    FROM public.inventory i
    WHERE i.organisation_id = v_org_id
      AND i.item_id = v_line.item_id
    LIMIT 1;

    -- Update line with current availability but don't force the source yet
    -- We'll initialize them with the automatic logic as a starting point for the user
    UPDATE public.purchase_requisition_lines
    SET
      available_stock_qty = COALESCE(v_available, 0),
      store_allocated_qty = 0, -- Set to 0, let user decide
      procure_required_qty = COALESCE(v_line.requested_qty, 0), -- Default to procure
      source_type = 'PROCURE', -- Default to procure
      open_qty = COALESCE(v_line.requested_qty, 0),
      status = 'Open'
    WHERE id = v_line.id;
  END LOOP;

  UPDATE public.purchase_requisitions
  SET status = 'Approved'
  WHERE id = p_requisition_id;
END;
$$;
