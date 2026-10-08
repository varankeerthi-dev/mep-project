-- RPC: visit_overview — single read path for the Operations dashboard site-visit widgets
-- Date: 2026-10-08
-- Replaces four raw site_visits selects (LiveNow V1/V2 site check-ins + Upcoming V1/V2).
-- Returns jsonb { today_visits: [...], upcoming_visits: [...] }, each row = full visit
-- row plus resolved client_name and user_name (employee_id -> employees.name,
-- else created_by -> user_profiles.full_name, else free-text engineer).

CREATE OR REPLACE FUNCTION public.visit_overview(
  p_org_id UUID,
  p_from DATE,
  p_to DATE DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_today JSONB;
  v_upcoming JSONB;
BEGIN
  IF p_org_id IS NULL OR NOT public.user_can_access_org(p_org_id) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb)
  INTO v_today
  FROM (
    SELECT to_jsonb(v) || jsonb_build_object(
             'client_name', c.client_name,
             'user_name', COALESCE(
               e.name,
               (SELECT up.full_name
                  FROM user_profiles up
                 WHERE up.user_id = v.created_by
                 ORDER BY (up.organisation_id = v.organisation_id) DESC
                 LIMIT 1),
               v.engineer
             )
           ) AS row_json
    FROM site_visits v
    LEFT JOIN clients c ON c.id = v.client_id
    LEFT JOIN employees e ON e.id = v.employee_id
    WHERE v.organisation_id = p_org_id
      AND v.visit_date >= p_from
      AND (p_to IS NULL OR v.visit_date <= p_to)
    ORDER BY v.visit_date ASC, v.created_at ASC
    LIMIT 10
  ) t;

  SELECT COALESCE(jsonb_agg(row_json), '[]'::jsonb)
  INTO v_upcoming
  FROM (
    SELECT to_jsonb(v) || jsonb_build_object(
             'client_name', c.client_name,
             'user_name', COALESCE(
               e.name,
               (SELECT up.full_name
                  FROM user_profiles up
                 WHERE up.user_id = v.created_by
                 ORDER BY (up.organisation_id = v.organisation_id) DESC
                 LIMIT 1),
               v.engineer
             )
           ) AS row_json
    FROM site_visits v
    LEFT JOIN clients c ON c.id = v.client_id
    LEFT JOIN employees e ON e.id = v.employee_id
    WHERE v.organisation_id = p_org_id
      AND v.visit_date > p_from
      AND (p_to IS NULL OR v.visit_date <= p_to)
    ORDER BY v.visit_date ASC, v.created_at ASC
    LIMIT 5
  ) t;

  RETURN jsonb_build_object(
    'today_visits', v_today,
    'upcoming_visits', v_upcoming
  );
END;
$$;

REVOKE ALL ON FUNCTION public.visit_overview(UUID, DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.visit_overview(UUID, DATE, DATE) TO authenticated;
