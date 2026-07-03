-- Run this ENTIRE script in Supabase SQL Editor
-- It is idempotent: all objects are CREATE OR REPLACE / DROP IF EXISTS
-- This replaces the need to run 041 and 042 separately

-- ================================================================
-- 1. HELPER FUNCTION: checks membership in EITHER user_organisations OR org_members
-- ================================================================
CREATE OR REPLACE FUNCTION is_org_member(p_user_id UUID, p_organisation_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_organisations
    WHERE user_id = p_user_id AND organisation_id = p_organisation_id AND status = 'active'
  ) OR EXISTS (
    SELECT 1 FROM org_members
    WHERE user_id = p_user_id AND organisation_id = p_organisation_id AND status = 'active'
  );
$$;

GRANT EXECUTE ON FUNCTION is_org_member TO authenticated;

-- ================================================================
-- 2. FIX SECURITY DEFINER FUNCTIONS — use is_org_member
-- ================================================================

CREATE OR REPLACE FUNCTION get_daily_usage_by_project(p_project_id UUID, p_limit INTEGER DEFAULT 1000)
RETURNS SETOF daily_material_usage
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = p_project_id AND is_org_member(auth.uid(), p.organisation_id)
  ) THEN
    RAISE EXCEPTION 'Access denied: project does not belong to your organisation';
  END IF;
  RETURN QUERY SELECT * FROM daily_material_usage
    WHERE project_id = p_project_id
    ORDER BY usage_date DESC, created_at DESC
    LIMIT p_limit;
END;
$$;

CREATE OR REPLACE FUNCTION get_daily_usage_by_date(p_project_id UUID, p_usage_date DATE, p_limit INTEGER DEFAULT 1000)
RETURNS SETOF daily_material_usage
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = p_project_id AND is_org_member(auth.uid(), p.organisation_id)
  ) THEN
    RAISE EXCEPTION 'Access denied: project does not belong to your organisation';
  END IF;
  RETURN QUERY SELECT * FROM daily_material_usage
    WHERE project_id = p_project_id AND usage_date = p_usage_date
    ORDER BY created_at ASC LIMIT p_limit;
END;
$$;

CREATE OR REPLACE FUNCTION log_daily_usage(
  p_project_id UUID, p_organisation_id UUID, p_usage_date DATE,
  p_item_id UUID, p_variant_id UUID, p_quantity_used DECIMAL,
  p_unit TEXT, p_activity TEXT, p_remarks TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_user_id UUID; v_new_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF NOT is_org_member(v_user_id, p_organisation_id) THEN
    RAISE EXCEPTION 'Access denied: you are not a member of this organisation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM projects WHERE id = p_project_id AND organisation_id = p_organisation_id) THEN
    RAISE EXCEPTION 'Access denied: project does not belong to this organisation';
  END IF;
  INSERT INTO daily_material_usage (project_id, organisation_id, usage_date, item_id, variant_id, quantity_used, unit, activity, logged_by, remarks)
  VALUES (p_project_id, p_organisation_id, p_usage_date, p_item_id, p_variant_id, p_quantity_used, p_unit, p_activity, v_user_id, p_remarks)
  RETURNING id INTO v_new_id;
  RETURN v_new_id;
END;
$$;

CREATE OR REPLACE FUNCTION log_daily_usage_batch(
  p_project_id UUID, p_organisation_id UUID, p_usage_date DATE, p_items JSONB
)
RETURNS UUID[]
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_user_id UUID; v_new_ids UUID[]; v_item JSONB; v_new_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF NOT is_org_member(v_user_id, p_organisation_id) THEN
    RAISE EXCEPTION 'Access denied: you are not a member of this organisation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM projects WHERE id = p_project_id AND organisation_id = p_organisation_id) THEN
    RAISE EXCEPTION 'Access denied: project does not belong to this organisation';
  END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO daily_material_usage (project_id, organisation_id, usage_date, item_id, variant_id, quantity_used, unit, activity, logged_by, remarks)
    VALUES (p_project_id, p_organisation_id, p_usage_date,
      (v_item->>'item_id')::UUID,
      CASE WHEN v_item->>'variant_id' IS NOT NULL AND v_item->>'variant_id' != '' THEN (v_item->>'variant_id')::UUID ELSE NULL END,
      (v_item->>'quantity_used')::DECIMAL, v_item->>'unit', v_item->>'activity', v_user_id, v_item->>'remarks')
    RETURNING id INTO v_new_id;
    v_new_ids := array_append(v_new_ids, v_new_id);
  END LOOP;
  RETURN v_new_ids;
END;
$$;

-- ================================================================
-- 3. PROJECTS TABLE RLS — drop existing, recreate with is_org_member
-- ================================================================
DROP POLICY IF EXISTS "Enable all access for projects" ON projects;
DROP POLICY IF EXISTS "Users can view projects in their orgs" ON projects;
DROP POLICY IF EXISTS "Users can insert projects in their orgs" ON projects;
DROP POLICY IF EXISTS "Users can update projects in their orgs" ON projects;
DROP POLICY IF EXISTS "Users can delete projects in their orgs" ON projects;

CREATE POLICY "Users can view projects in their orgs" ON projects FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), organisation_id));
CREATE POLICY "Users can insert projects in their orgs" ON projects FOR INSERT TO authenticated
  WITH CHECK (is_org_member(auth.uid(), organisation_id));
CREATE POLICY "Users can update projects in their orgs" ON projects FOR UPDATE TO authenticated
  USING (is_org_member(auth.uid(), organisation_id))
  WITH CHECK (is_org_member(auth.uid(), organisation_id));
CREATE POLICY "Users can delete projects in their orgs" ON projects FOR DELETE TO authenticated
  USING (is_org_member(auth.uid(), organisation_id));

-- ================================================================
-- 4. DAILY_MATERIAL_USAGE RLS — drop existing, recreate with is_org_member
-- ================================================================
DROP POLICY IF EXISTS "Users can view daily material usage" ON daily_material_usage;
DROP POLICY IF EXISTS "Users can insert daily material usage" ON daily_material_usage;
DROP POLICY IF EXISTS "Users can update daily material usage" ON daily_material_usage;
DROP POLICY IF EXISTS "Users can delete daily material usage" ON daily_material_usage;

CREATE POLICY "Users can view daily material usage" ON daily_material_usage FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), organisation_id));
CREATE POLICY "Users can insert daily material usage" ON daily_material_usage FOR INSERT TO authenticated
  WITH CHECK (is_org_member(auth.uid(), organisation_id));
CREATE POLICY "Users can update daily material usage" ON daily_material_usage FOR UPDATE TO authenticated
  USING (
    is_org_member(auth.uid(), organisation_id)
    AND (logged_by = auth.uid() OR EXISTS (
      SELECT 1 FROM org_members om INNER JOIN roles r ON r.id = om.role_id
      WHERE om.user_id = auth.uid() AND om.organisation_id = daily_material_usage.organisation_id AND r.name IN ('admin', 'manager')
    ))
  )
  WITH CHECK (is_org_member(auth.uid(), organisation_id));
CREATE POLICY "Users can delete daily material usage" ON daily_material_usage FOR DELETE TO authenticated
  USING (
    is_org_member(auth.uid(), organisation_id)
    AND (logged_by = auth.uid() OR EXISTS (
      SELECT 1 FROM org_members om INNER JOIN roles r ON r.id = om.role_id
      WHERE om.user_id = auth.uid() AND om.organisation_id = daily_material_usage.organisation_id AND r.name IN ('admin', 'manager')
    ))
  );

-- ================================================================
-- 5. ADD material_usage permissions (idempotent)
-- ================================================================
INSERT INTO permissions (key, description) VALUES
  ('material_usage.read', 'View material usage logs'),
  ('material_usage.create', 'Log material usage'),
  ('material_usage.update', 'Edit material usage logs'),
  ('material_usage.delete', 'Delete material usage logs')
ON CONFLICT (key) DO NOTHING;