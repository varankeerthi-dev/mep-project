-- ============================================================
-- MANUFACTURING MODULE — BOM PER-ROW QUANTITY BASIS + REVISION RPC FIX
-- Version: 1.0
-- Date: 2026-09-11
-- ============================================================
-- 1. bom_items.qty_basis: per-row basis ('absolute' | 'percent') so a
--    single BOM can mix fixed-qty rows and percent-of-batch rows.
-- 2. create_bom_revision: column lists had drifted — revisions lost
--    specification, qty_basis, percent, and all costing/detail fields
--    (unit_cost, work_center_id, scrap_factor, ...). This patch copies
--    every current column. The source BOM remains untouched.
-- Safe to re-run.
-- ============================================================

ALTER TABLE bom_items
  ADD COLUMN IF NOT EXISTS qty_basis VARCHAR(20) DEFAULT 'absolute';

CREATE OR REPLACE FUNCTION public.create_bom_revision(p_source_bom_id uuid, p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_source RECORD;
  v_new_bom_id UUID;
  v_new_code VARCHAR;
  v_next_rev VARCHAR;
  v_item RECORD;
  v_items_count INT := 0;
BEGIN
  -- 1. Validate tenant membership
  IF NOT EXISTS (
    SELECT 1 FROM user_organisations
    WHERE organisation_id = p_org_id AND user_id = auth.uid() AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not an active member of this organisation');
  END IF;
  -- 2. Lock Source BOM Header FOR UPDATE
  SELECT * INTO v_source
  FROM bom_headers
  WHERE id = p_source_bom_id
  FOR UPDATE;
  IF v_source.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Source BOM not found');
  END IF;
  IF v_source.organisation_id != p_org_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Organisation mismatch');
  END IF;
  -- Calculate next revision string (e.g. 'A' -> 'B', 'B' -> 'C')
  IF v_source.revision ~ '^[A-Y]$' THEN
    v_next_rev := chr(ascii(v_source.revision) + 1);
  ELSE
    v_next_rev := COALESCE(v_source.revision, 'A') || '-REV';
  END IF;
  -- Generate new BOM code with revision suffix
  v_new_code := v_source.bom_code || '-R' || v_next_rev;
  -- Insert new draft BOM header row (leaves source published BOM untouched)
  INSERT INTO bom_headers (
    bom_code, product_name, product_id, output_qty, output_unit,
    description, is_active, organisation_id, revision, approval_status,
    effective_date, parent_bom_id, batch_no, product_code, bom_type,
    product_category, priority, specification, qty_basis,
    custom_attributes, total_estimated_cost, estimated_production_minutes,
    created_by_name, valid_to
  ) VALUES (
    v_new_code,
    v_source.product_name,
    v_source.product_id,
    v_source.output_qty,
    v_source.output_unit,
    v_source.description,
    true,
    p_org_id,
    v_next_rev,
    'draft',
    CURRENT_DATE,
    p_source_bom_id,
    v_source.batch_no,
    v_source.product_code,
    v_source.bom_type,
    v_source.product_category,
    v_source.priority,
    v_source.specification,
    v_source.qty_basis,
    v_source.custom_attributes,
    v_source.total_estimated_cost,
    v_source.estimated_production_minutes,
    v_source.created_by_name,
    v_source.valid_to
  ) RETURNING id INTO v_new_bom_id;
  -- Copy items from source BOM to new draft revision (all current columns)
  FOR v_item IN
    SELECT * FROM bom_items WHERE bom_id = p_source_bom_id
  LOOP
    INSERT INTO bom_items (
      bom_id, material_id, required_qty, unit, wastage_pct,
      is_additional, company_variant_id, make, notes, lead_time_days,
      parent_material_id, unit_cost, sequence_no, work_center_id,
      is_critical, alternate_material_id, drawing_reference,
      inspection_required, shelf_life_days, warehouse_id,
      scrap_factor, yield_pct, custom_attributes, percent, qty_basis
    ) VALUES (
      v_new_bom_id,
      v_item.material_id,
      v_item.required_qty,
      v_item.unit,
      v_item.wastage_pct,
      v_item.is_additional,
      v_item.company_variant_id,
      v_item.make,
      v_item.notes,
      v_item.lead_time_days,
      v_item.parent_material_id,
      v_item.unit_cost,
      v_item.sequence_no,
      v_item.work_center_id,
      v_item.is_critical,
      v_item.alternate_material_id,
      v_item.drawing_reference,
      v_item.inspection_required,
      v_item.shelf_life_days,
      v_item.warehouse_id,
      v_item.scrap_factor,
      v_item.yield_pct,
      v_item.custom_attributes,
      v_item.percent,
      v_item.qty_basis
    );
    v_items_count := v_items_count + 1;
  END LOOP;
  -- Log revision creation activity
  INSERT INTO manufacturing_activity_log (
    entity_type, entity_id, action, action_details, user_id, organisation_id
  ) VALUES (
    'bom', v_new_bom_id, 'created',
    jsonb_build_object(
      'source_bom_id', p_source_bom_id,
      'new_revision', v_next_rev,
      'bom_code', v_new_code
    ),
    auth.uid(), p_org_id
  );
  RETURN jsonb_build_object(
    'ok', true,
    'new_bom_id', v_new_bom_id,
    'new_revision', v_next_rev,
    'bom_code', v_new_code,
    'items_copied', v_items_count
  );
END;
$function$;
