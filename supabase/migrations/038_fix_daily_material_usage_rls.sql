-- Fix RLS policies for daily_material_usage to match the pattern used in material_consumption_summary
-- The original policy used a SECURITY DEFINER function which could fail silently.
-- This migration switches to the same direct subquery pattern that works for consumption_summary.

-- Drop the old restrictive policies
DROP POLICY IF EXISTS "Users can view daily material usage" ON daily_material_usage;
DROP POLICY IF EXISTS "Users can insert daily material usage" ON daily_material_usage;
DROP POLICY IF EXISTS "Users can update daily material usage" ON daily_material_usage;
DROP POLICY IF EXISTS "Users can delete daily material usage" ON daily_material_usage;

-- Users can view usage logs for their organisations (using direct subquery like material_consumption_summary)
CREATE POLICY "Users can view daily material usage"
  ON daily_material_usage FOR SELECT
  TO authenticated
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_organisations
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Users can insert usage logs for their organisations
CREATE POLICY "Users can insert daily material usage"
  ON daily_material_usage FOR INSERT
  TO authenticated
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM user_organisations
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Users can update usage logs for their organisations
CREATE POLICY "Users can update daily material usage"
  ON daily_material_usage FOR UPDATE
  TO authenticated
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_organisations
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Users can delete usage logs for their organisations
CREATE POLICY "Users can delete daily material usage"
  ON daily_material_usage FOR DELETE
  TO authenticated
  USING (
    organisation_id IN (
      SELECT organisation_id FROM user_organisations
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );