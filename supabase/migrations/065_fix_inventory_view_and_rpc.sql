-- Fix for undefined 'inventory' table in approve_purchase_requisition RPC
-- Creates a compatibility view mapping public.inventory to public.item_stock aggregation

-- 1. Create the inventory view
CREATE OR REPLACE VIEW public.inventory AS
SELECT 
  organisation_id,
  item_id,
  SUM(current_stock) as quantity
FROM public.item_stock
GROUP BY organisation_id, item_id;

-- 2. Grant permissions
GRANT SELECT ON public.inventory TO authenticated;
GRANT SELECT ON public.inventory TO service_role;

-- 3. Re-define the approval RPC to ensure it uses the view correctly
CREATE OR REPLACE FUNCTION public.approve_purchase_requisition(p_requisition_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org_id uuid;
  v_line record;
  v_available numeric;
  v_store_alloc numeric;
  v_procure numeric;
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
    -- Query the inventory view (aggregates item_stock)
    SELECT COALESCE(i.quantity, 0) INTO v_available
    FROM public.inventory i
    WHERE i.organisation_id = v_org_id
      AND i.item_id = v_line.item_id
    LIMIT 1;

    v_store_alloc := LEAST(COALESCE(v_available, 0), COALESCE(v_line.requested_qty, 0));
    v_procure := GREATEST(COALESCE(v_line.requested_qty, 0) - v_store_alloc, 0);

    UPDATE public.purchase_requisition_lines
    SET
      available_stock_qty = COALESCE(v_available, 0),
      store_allocated_qty = v_store_alloc,
      procure_required_qty = v_procure,
      source_type = CASE WHEN v_procure > 0 THEN 'PROCURE' else 'FULFILL_FROM_STORE' END,
      open_qty = COALESCE(v_line.requested_qty, 0),
      status = 'Open'
    WHERE id = v_line.id;
  END LOOP;

  UPDATE public.purchase_requisitions
  SET status = 'Approved'
  WHERE id = p_requisition_id;
END;
$$;
