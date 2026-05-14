-- Migration 041: Fix multi-tenancy & RBAC for material usage
-- 1. Fix SECURITY DEFINER functions to validate org membership
-- 2. Fix projects table RLS (replace USING(true) with org-scoped policies)
-- 3. Restore role-aware UPDATE/DELETE policies on daily_material_usage
-- 4. Add material_usage permissions to the permissions table

-- ================================================================
-- 1. FIX SECURITY DEFINER FUNCTIONS — add org membership validation
-- ================================================================

-- get_daily_usage_by_project: validate that the project belongs to user's org
CREATE OR REPLACE FUNCTION get_daily_usage_by_project(p_project_id UUID, p_limit INTEGER DEFAULT 1000)
RETURNS SETOF daily_material_usage
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate: project must belong to an org the user is an active member of
  IF NOT EXISTS (
    SELECT 1 FROM projects p
    INNER JOIN user_organisations uo ON uo.organisation_id = p.organisation_id
    WHERE p.id = p_project_id
      AND uo.user_id = auth.uid()
      AND uo.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Access denied: project does not belong to your organisation';
  END IF;

  RETURN QUERY
  SELECT * FROM daily_material_usage
  WHERE project_id = p_project_id
  ORDER BY usage_date DESC, created_at DESC
  LIMIT p_limit;
END;
$$;

-- get_daily_usage_by_date: same org validation
CREATE OR REPLACE FUNCTION get_daily_usage_by_date(p_project_id UUID, p_usage_date DATE, p_limit INTEGER DEFAULT 1000)
RETURNS SETOF daily_material_usage
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM projects p
    INNER JOIN user_organisations uo ON uo.organisation_id = p.organisation_id
    WHERE p.id = p_project_id
      AND uo.user_id = auth.uid()
      AND uo.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Access denied: project does not belong to your organisation';
  END IF;

  RETURN QUERY
  SELECT * FROM daily_material_usage
  WHERE project_id = p_project_id AND usage_date = p_usage_date
  ORDER BY created_at ASC
  LIMIT p_limit;
END;
$$;

-- log_daily_usage: validate org membership and project-org consistency
CREATE OR REPLACE FUNCTION log_daily_usage(
  p_project_id UUID,
  p_organisation_id UUID,
  p_usage_date DATE,
  p_item_id UUID,
  p_variant_id UUID,
  p_quantity_used DECIMAL,
  p_unit TEXT,
  p_activity TEXT,
  p_remarks TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_new_id UUID;
BEGIN
  v_user_id := auth.uid();

  -- Validate: user must be an active member of the organisation
  IF NOT EXISTS (
    SELECT 1 FROM user_organisations
    WHERE user_id = v_user_id
      AND organisation_id = p_organisation_id
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Access denied: you are not a member of this organisation';
  END IF;

  -- Validate: project must belong to the specified organisation
  IF NOT EXISTS (
    SELECT 1 FROM projects
    WHERE id = p_project_id AND organisation_id = p_organisation_id
  ) THEN
    RAISE EXCEPTION 'Access denied: project does not belong to this organisation';
  END IF;

  INSERT INTO daily_material_usage (
    project_id, organisation_id, usage_date, item_id, variant_id,
    quantity_used, unit, activity, logged_by, remarks
  )
  VALUES (
    p_project_id, p_organisation_id, p_usage_date, p_item_id, p_variant_id,
    p_quantity_used, p_unit, p_activity, v_user_id, p_remarks
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

-- log_daily_usage_batch: same validation for batch inserts
CREATE OR REPLACE FUNCTION log_daily_usage_batch(
  p_project_id UUID,
  p_organisation_id UUID,
  p_usage_date DATE,
  p_items JSONB
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

  -- Validate: user must be an active member of the organisation
  IF NOT EXISTS (
    SELECT 1 FROM user_organisations
    WHERE user_id = v_user_id
      AND organisation_id = p_organisation_id
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Access denied: you are not a member of this organisation';
  END IF;

  -- Validate: project must belong to the specified organisation
  IF NOT EXISTS (
    SELECT 1 FROM projects
    WHERE id = p_project_id AND organisation_id = p_organisation_id
  ) THEN
    RAISE EXCEPTION 'Access denied: project does not belong to this organisation';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO daily_material_usage (
      project_id, organisation_id, usage_date, item_id, variant_id,
      quantity_used, unit, activity, logged_by, remarks
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

-- ================================================================
-- 2. FIX projects TABLE RLS — replace USING(true) with org-scoped policies
-- ================================================================

-- Drop the open policy
DROP POLICY IF EXISTS "Enable all access for projects" ON projects;

-- Org members can view projects in their organisations
CREATE POLICY "Users can view projects in their orgs"
  ON projects FOR SELECT
  TO authenticated
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_organisations
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Org members can insert projects into their own orgs
CREATE POLICY "Users can insert projects in their orgs"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM user_organisations
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Org members can update projects in their orgs
CREATE POLICY "Users can update projects in their orgs"
  ON projects FOR UPDATE
  TO authenticated
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_organisations
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM user_organisations
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Org members can delete projects in their orgs
CREATE POLICY "Users can delete projects in their orgs"
  ON projects FOR DELETE
  TO authenticated
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_organisations
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- ================================================================
-- 3. RESTORE role-aware UPDATE/DELETE policies on daily_material_usage
--    Org admins/managers can update/delete any entry;
--    regular members can only update/delete their own entries
-- ================================================================

DROP POLICY IF EXISTS "Users can update daily material usage" ON daily_material_usage;
DROP POLICY IF EXISTS "Users can delete daily material usage" ON daily_material_usage;

-- UPDATE: org members can update their own; org admins can update any
CREATE POLICY "Users can update daily material usage"
  ON daily_material_usage FOR UPDATE
  TO authenticated
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_organisations
      WHERE user_id = auth.uid() AND status = 'active'
    )
    AND (
      logged_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM org_members om
        INNER JOIN roles r ON r.id = om.role_id
        WHERE om.user_id = auth.uid()
          AND om.organisation_id = daily_material_usage.organisation_id
          AND r.name IN ('admin', 'manager')
      )
    )
  )
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM user_organisations
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- DELETE: org members can delete their own; org admins can delete any
CREATE POLICY "Users can delete daily material usage"
  ON daily_material_usage FOR DELETE
  TO authenticated
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_organisations
      WHERE user_id = auth.uid() AND status = 'active'
    )
    AND (
      logged_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM org_members om
        INNER JOIN roles r ON r.id = om.role_id
        WHERE om.user_id = auth.uid()
          AND om.organisation_id = daily_material_usage.organisation_id
          AND r.name IN ('admin', 'manager')
      )
    )
  );

-- ================================================================
-- 4. ADD material_usage permissions to the permissions table
--    These will be pickable when creating/editing roles in the RBAC UI
-- ================================================================

-- Note: the actual permission_keys used in the app must match these entries.
-- The permissions table (if it exists as a seed/reference) needs these rows.
-- We use INSERT ... ON CONFLICT DO NOTHING to be idempotent.

-- First, ensure the permissions table exists. If your app uses a different
-- mechanism (e.g., the permission-catalog.ts defines the canonical list),
-- these INSERT statements are optional — the frontend catalog is the
-- source of truth. But adding them to a permissions reference table
-- enables admin UI to display them.

INSERT INTO permissions (key, label, module) VALUES
  ('material_usage.read', 'View Usage Logs', 'material_usage'),
  ('material_usage.create', 'Log Usage', 'material_usage'),
  ('material_usage.update', 'Edit Usage Logs', 'material_usage'),
  ('material_usage.delete', 'Delete Usage Logs', 'material_usage')
ON CONFLICT (key) DO NOTHING;