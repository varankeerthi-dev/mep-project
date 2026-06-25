-- Batch insert function for daily material usage (replaces sequential single-row inserts)
-- This triggers material_consumption_summary update only once via the existing trigger
CREATE OR REPLACE FUNCTION log_daily_usage_batch(
  p_project_id UUID,
  p_organisation_id UUID,
  p_usage_date DATE,
  p_items JSONB -- Array of {item_id, variant_id, quantity_used, unit, activity, remarks}
)
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_new_ids UUID[];
  v_item JSONB;
  v_new_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO daily_material_usage (
      project_id,
      organisation_id,
      usage_date,
      item_id,
      variant_id,
      quantity_used,
      unit,
      activity,
      logged_by,
      remarks
    )
    VALUES (
      p_project_id,
      p_organisation_id,
      p_usage_date,
      (v_item->>'item_id')::UUID,
      CASE WHEN v_item->>'variant_id' IS NOT NULL AND v_item->>'variant_id' != '' 
           THEN (v_item->>'variant_id')::UUID 
           ELSE NULL END,
      (v_item->>'quantity_used')::DECIMAL,
      v_item->>'unit',
      v_item->>'activity',
      v_user_id,
      v_item->>'remarks'
    )
    RETURNING id INTO v_new_id;
    
    v_new_ids := array_append(v_new_ids, v_new_id);
  END LOOP;
  
  RETURN v_new_ids;
END;
$$;

GRANT EXECUTE ON FUNCTION log_daily_usage_batch TO authenticated;