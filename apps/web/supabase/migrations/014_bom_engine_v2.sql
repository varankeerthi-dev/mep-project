-- ============================================================
-- MANUFACTURING ENGINE V2 — PHASE 2 FINAL HARDENING
-- Migration: 014_bom_engine_v2.sql
-- Date: August 13, 2026
-- ============================================================
-- Features:
-- 1. Strict DB Immutability Trigger on Published BOM Headers & Items (Zero trigger disabling).
-- 2. Overlapping Revision Publication Prevention in publish_bom().
-- 3. Ambiguity Exception Function `resolve_subassembly_bom()` raising explicit errors if >1 revision matches.
-- 4. High-performance Recursive CTE `explode_bom()` with p_production_date support and item-level path tracking.
-- ============================================================

-- ============================================================
-- 1. DATABASE CONSTRAINTS & HEADER IMMUTABILITY TRIGGER
-- ============================================================

-- Positive quantity constraint on bom_items
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_bom_item_qty_positive') THEN
    ALTER TABLE bom_items ADD CONSTRAINT chk_bom_item_qty_positive CHECK (required_qty > 0);
  END IF;
END $$;

-- Prevent ANY modification to published / approved BOM headers
CREATE OR REPLACE FUNCTION prevent_published_bom_header_mutation()
RETURNS TRIGGER AS $$
BEGIN
  -- Block ALL updates to headers that are already in 'approved' or 'published' status
  IF OLD.approval_status IN ('approved', 'published') THEN
    RAISE EXCEPTION 'Published BOM headers are immutable. Create a new revision (e.g. Revision B) to make modifications.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_prevent_published_bom_header_mutation ON bom_headers;
CREATE TRIGGER trigger_prevent_published_bom_header_mutation
  BEFORE UPDATE ON bom_headers
  FOR EACH ROW
  EXECUTE FUNCTION prevent_published_bom_header_mutation();

-- Prevent inserting, updating, or deleting items on a published BOM
CREATE OR REPLACE FUNCTION prevent_published_bom_item_mutation()
RETURNS TRIGGER AS $$
DECLARE
  v_status VARCHAR;
BEGIN
  SELECT approval_status INTO v_status
  FROM bom_headers
  WHERE id = COALESCE(OLD.bom_id, NEW.bom_id);

  IF v_status IN ('approved', 'published') THEN
    RAISE EXCEPTION 'Cannot insert, update, or delete items on a published BOM. Create a new revision instead.';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_prevent_published_bom_item_mutation ON bom_items;
CREATE TRIGGER trigger_prevent_published_bom_item_mutation
  BEFORE INSERT OR UPDATE OR DELETE ON bom_items
  FOR EACH ROW
  EXECUTE FUNCTION prevent_published_bom_item_mutation();


-- ============================================================
-- 2. SUBASSEMBLY BOM RESOLUTION HELPER (WITH AMBIGUITY DETECTION)
-- ============================================================
CREATE OR REPLACE FUNCTION resolve_subassembly_bom(
  p_material_id UUID,
  p_production_date DATE
) RETURNS UUID
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bom_ids UUID[];
  v_count INT;
  v_mat_name VARCHAR;
BEGIN
  SELECT ARRAY_AGG(id) INTO v_bom_ids
  FROM bom_headers
  WHERE product_id = p_material_id
    AND is_active = true
    AND approval_status IN ('approved', 'published')
    AND (effective_date IS NULL OR effective_date <= p_production_date)
    AND (valid_to IS NULL OR valid_to >= p_production_date);

  v_count := COALESCE(CARDINALITY(v_bom_ids), 0);

  IF v_count = 0 THEN
    RETURN NULL; -- Leaf raw material (no subassembly BOM)
  ELSIF v_count = 1 THEN
    RETURN v_bom_ids[1]; -- Single deterministic active BOM
  ELSE
    SELECT name INTO v_mat_name FROM materials WHERE id = p_material_id;
    RAISE EXCEPTION 'Ambiguous BOM revision: Found % active published BOM revisions for material % (%) on date %',
      v_count, COALESCE(v_mat_name, 'Unknown'), p_material_id, p_production_date;
  END IF;
END;
$$;


-- ============================================================
-- 3. ATOMIC SERVER-SIDE BOM PUBLICATION RPC
-- ============================================================
CREATE OR REPLACE FUNCTION publish_bom(
  p_bom_id UUID,
  p_org_id UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bom RECORD;
  v_self_count INT;
  v_invalid_qty_count INT;
  v_items_count INT;
  v_overlap_count INT;
BEGIN
  -- 1. Validate user membership in organisation
  IF NOT EXISTS (
    SELECT 1 FROM user_organisations
    WHERE organisation_id = p_org_id AND user_id = auth.uid() AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not an active member of this organisation');
  END IF;

  -- 2. Lock BOM Header FOR UPDATE
  SELECT * INTO v_bom
  FROM bom_headers
  WHERE id = p_bom_id
  FOR UPDATE;

  IF v_bom.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'BOM not found');
  END IF;

  IF v_bom.organisation_id != p_org_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Organisation mismatch');
  END IF;

  -- 3. Idempotency Check: if already approved/published, return success
  IF v_bom.approval_status IN ('approved', 'published') THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_processed', true,
      'message', 'BOM is already published and immutable.',
      'bom_id', p_bom_id
    );
  END IF;

  -- 4. Validate component presence
  SELECT COUNT(*) INTO v_items_count
  FROM bom_items
  WHERE bom_id = p_bom_id;

  IF v_items_count = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cannot publish a BOM with zero components');
  END IF;

  -- 5. Validate non-self-reference (Finished product cannot be listed as its own component)
  SELECT COUNT(*) INTO v_self_count
  FROM bom_items
  WHERE bom_id = p_bom_id AND material_id = v_bom.product_id;

  IF v_self_count > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Finished product cannot be listed as a component of itself');
  END IF;

  -- 6. Validate positive quantities
  SELECT COUNT(*) INTO v_invalid_qty_count
  FROM bom_items
  WHERE bom_id = p_bom_id AND (required_qty IS NULL OR required_qty <= 0);

  IF v_invalid_qty_count > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'All BOM components must have a required quantity greater than 0');
  END IF;

  -- 7. Validate Date Range Effectivity Overlap against existing published revisions for same product
  SELECT COUNT(*) INTO v_overlap_count
  FROM bom_headers
  WHERE organisation_id = p_org_id
    AND product_id = v_bom.product_id
    AND id != p_bom_id
    AND is_active = true
    AND approval_status IN ('approved', 'published')
    AND daterange(
          COALESCE(effective_date, '1970-01-01'::date),
          COALESCE(valid_to, '9999-12-31'::date),
          '[]'
        ) && daterange(
          COALESCE(v_bom.effective_date, '1970-01-01'::date),
          COALESCE(v_bom.valid_to, '9999-12-31'::date),
          '[]'
        );

  IF v_overlap_count > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Overlapping active published BOM revision exists for this product in the specified effective date range');
  END IF;

  -- 8. Update status from 'draft' to 'approved'.
  -- Trigger remains fully active; OLD.approval_status = 'draft' passes check naturally.
  UPDATE bom_headers
  SET approval_status = 'approved',
      updated_at = NOW()
  WHERE id = p_bom_id;

  -- 9. Log activity
  INSERT INTO manufacturing_activity_log (
    entity_type, entity_id, action, action_details, user_id, organisation_id
  ) VALUES (
    'bom', p_bom_id, 'completed',
    jsonb_build_object(
      'bom_code', v_bom.bom_code,
      'revision', v_bom.revision,
      'product_name', v_bom.product_name
    ),
    auth.uid(), p_org_id
  );

  RETURN jsonb_build_object(
    'ok', true,
    'already_processed', false,
    'bom_id', p_bom_id,
    'revision', v_bom.revision
  );
END;
$$;


-- ============================================================
-- 4. ATOMIC SERVER-SIDE CREATE BOM REVISION RPC
-- ============================================================
CREATE OR REPLACE FUNCTION create_bom_revision(
  p_source_bom_id UUID,
  p_org_id UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
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
    product_category, priority
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
    v_source.priority
  ) RETURNING id INTO v_new_bom_id;

  -- Copy items from source BOM to new draft revision
  FOR v_item IN
    SELECT * FROM bom_items WHERE bom_id = p_source_bom_id
  LOOP
    INSERT INTO bom_items (
      bom_id, material_id, required_qty, unit, wastage_pct,
      is_additional, company_variant_id, make, notes, lead_time_days,
      parent_material_id
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
      v_item.parent_material_id
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
$$;


-- ============================================================
-- 5. RECURSIVE BOM EXPLOSION ENGINE (WITH AMBIGUITY FAULTING)
-- ============================================================
CREATE OR REPLACE FUNCTION explode_bom(
  p_bom_id UUID,
  p_production_qty NUMERIC DEFAULT 1,
  p_production_date DATE DEFAULT CURRENT_DATE
) RETURNS TABLE (
  level INT,
  bom_id UUID,
  bom_code VARCHAR,
  parent_material_id UUID,
  material_id UUID,
  material_name VARCHAR,
  material_unit VARCHAR,
  required_qty NUMERIC,
  wastage_pct NUMERIC,
  effective_req_qty NUMERIC,
  path TEXT[]
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE bom_tree AS (
    -- Anchor member: Level 1 direct components of root BOM
    -- Path initializes with [root_product_material_id, level1_component_material_id]
    SELECT
      1 AS level,
      bh.id AS bom_id,
      bh.bom_code,
      bi.parent_material_id,
      bi.material_id,
      m.name AS material_name,
      bi.unit AS material_unit,
      bi.required_qty,
      COALESCE(bi.wastage_pct, 0) AS wastage_pct,
      ((p_production_qty / NULLIF(bh.output_qty, 0)) * bi.required_qty * (1.0 + (COALESCE(bi.wastage_pct, 0) / 100.0))) AS effective_req_qty,
      ARRAY[bh.product_id::text, bi.material_id::text] AS path
    FROM bom_headers bh
    JOIN bom_items bi ON bi.bom_id = bh.id
    JOIN materials m ON m.id = bi.material_id
    WHERE bh.id = p_bom_id

    UNION ALL

    -- Recursive member: Subassembly component explosion
    -- resolve_subassembly_bom() returns exact single subassembly BOM or raises ambiguity exception
    SELECT
      bt.level + 1 AS level,
      sub_bh.id AS bom_id,
      sub_bh.bom_code,
      sub_bi.parent_material_id,
      sub_bi.material_id,
      m.name AS material_name,
      sub_bi.unit AS material_unit,
      sub_bi.required_qty,
      COALESCE(sub_bi.wastage_pct, 0) AS wastage_pct,
      ((bt.effective_req_qty / NULLIF(sub_bh.output_qty, 0)) * sub_bi.required_qty * (1.0 + (COALESCE(sub_bi.wastage_pct, 0) / 100.0))) AS effective_req_qty,
      bt.path || sub_bi.material_id::text AS path
    FROM bom_tree bt
    JOIN bom_headers sub_bh ON sub_bh.id = resolve_subassembly_bom(bt.material_id, p_production_date)
    JOIN bom_items sub_bi ON sub_bi.bom_id = sub_bh.id
    JOIN materials m ON m.id = sub_bi.material_id
    -- Defensive checks: max 20 levels and strict item-level cycle detection
    WHERE bt.level < 20
      AND NOT (sub_bi.material_id::text = ANY(bt.path))
  )
  SELECT
    bt.level,
    bt.bom_id,
    bt.bom_code,
    bt.parent_material_id,
    bt.material_id,
    bt.material_name,
    bt.material_unit,
    ROUND(bt.required_qty, 4) AS required_qty,
    ROUND(bt.wastage_pct, 2) AS wastage_pct,
    ROUND(bt.effective_req_qty, 4) AS effective_req_qty,
    bt.path
  FROM bom_tree bt
  ORDER BY bt.level ASC, bt.material_name ASC;
END;
$$;
