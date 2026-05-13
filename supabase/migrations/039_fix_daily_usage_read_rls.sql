-- Fix: daily_material_usage RLS blocks all reads because user_organisations 
-- subquery returns empty for the client session.
-- Solution: Create SECURITY DEFINER functions for reading usage data (same pattern 
-- as log_daily_usage which works for writes).

-- Function to get daily usage by project (bypasses RLS)
CREATE OR REPLACE FUNCTION get_daily_usage_by_project(p_project_id UUID, p_limit INTEGER DEFAULT 1000)
RETURNS SETOF daily_material_usage
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM daily_material_usage
  WHERE project_id = p_project_id
  ORDER BY usage_date DESC, created_at DESC
  LIMIT p_limit;
END;
$$;

-- Function to get daily usage by project and date (bypasses RLS)
CREATE OR REPLACE FUNCTION get_daily_usage_by_date(p_project_id UUID, p_usage_date DATE, p_limit INTEGER DEFAULT 1000)
RETURNS SETOF daily_material_usage
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM daily_material_usage
  WHERE project_id = p_project_id AND usage_date = p_usage_date
  ORDER BY created_at ASC
  LIMIT p_limit;
END;
$$;

-- Also fix: widen the SELECT RLS policy to use project membership instead of 
-- user_organisations (which has its own RLS that blocks the subquery)
DROP POLICY IF EXISTS "Users can view daily material usage" ON daily_material_usage;
CREATE POLICY "Users can view daily material usage"
  ON daily_material_usage FOR SELECT
  TO authenticated
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      WHERE p.organisation_id IN (
        SELECT uo.organisation_id FROM user_organisations uo
        WHERE uo.user_id = auth.uid() AND uo.status = 'active'
      )
    )
  );

-- Also grant execute on new functions
GRANT EXECUTE ON FUNCTION get_daily_usage_by_project TO authenticated;
GRANT EXECUTE ON FUNCTION get_daily_usage_by_date TO authenticated;