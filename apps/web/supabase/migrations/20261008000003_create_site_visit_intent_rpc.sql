-- RPC: create a stoppage task intent from a site visit checkout
-- Date: 2026-10-08
-- The task-intent page (SiteStoppageTaskIntents) reads source_type='site_visit' rows from
-- site_report_stoppages, but nothing ever wrote them. This SECURITY INVOKER function is the
-- single write path: it validates org access, copies org/project from the visit, and stamps
-- source_type='site_visit'.

CREATE OR REPLACE FUNCTION public.create_site_visit_intent(
  p_visit_id UUID,
  p_description TEXT,
  p_category TEXT DEFAULT 'other',
  p_blocking_party TEXT DEFAULT 'unknown',
  p_impact_hours DECIMAL DEFAULT 0
) RETURNS site_report_stoppages
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_visit site_visits%ROWTYPE;
  v_row site_report_stoppages%ROWTYPE;
BEGIN
  IF p_description IS NULL OR length(trim(p_description)) < 3 THEN
    RAISE EXCEPTION 'description is required';
  END IF;

  SELECT * INTO v_visit FROM site_visits WHERE id = p_visit_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'site visit not found';
  END IF;

  IF v_visit.organisation_id IS NOT NULL AND NOT user_can_access_org(v_visit.organisation_id) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  INSERT INTO site_report_stoppages (
    organisation_id,
    project_id,
    site_visit_id,
    source_type,
    category,
    blocking_party,
    description,
    impact_hours,
    task_intent_status
  ) VALUES (
    v_visit.organisation_id,
    v_visit.project_id,
    v_visit.id,
    'site_visit',
    p_category,
    p_blocking_party,
    trim(p_description),
    coalesce(p_impact_hours, 0),
    'pending_pm_approval'
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.create_site_visit_intent(UUID, TEXT, TEXT, TEXT, DECIMAL) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_site_visit_intent(UUID, TEXT, TEXT, TEXT, DECIMAL) TO authenticated;
