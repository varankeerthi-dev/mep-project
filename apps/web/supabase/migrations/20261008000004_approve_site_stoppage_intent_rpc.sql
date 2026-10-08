-- RPC: approve a stoppage intent and create the task in one transaction
-- Date: 2026-10-08
-- Replaces the client's two-step flow (insert into tasks, then update the intent), which was
-- not atomic: a failure between the steps left an orphan task with the intent still pending.
-- Also resolves the visiting engineer (site_visits.employee_id) to an org member so the
-- created task is assigned, and stores the visit FK on the task.

CREATE OR REPLACE FUNCTION public.approve_site_stoppage_intent(p_intent_id UUID)
RETURNS tasks
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_intent site_report_stoppages%ROWTYPE;
  v_visit site_visits%ROWTYPE;
  v_assignee UUID;
  v_task tasks%ROWTYPE;
BEGIN
  SELECT * INTO v_intent FROM site_report_stoppages WHERE id = p_intent_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'intent not found';
  END IF;
  IF v_intent.task_intent_status <> 'pending_pm_approval' THEN
    RAISE EXCEPTION 'intent already processed';
  END IF;
  IF v_intent.organisation_id IS NOT NULL AND NOT user_can_access_org(v_intent.organisation_id) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- Resolve the visiting engineer (employee_id) to an org member user_id for assignment.
  IF v_intent.site_visit_id IS NOT NULL AND v_intent.organisation_id IS NOT NULL THEN
    SELECT sv.* INTO v_visit FROM site_visits sv WHERE sv.id = v_intent.site_visit_id;
    IF FOUND AND v_visit.employee_id IS NOT NULL THEN
      SELECT om.user_id INTO v_assignee
      FROM org_members om
      WHERE om.organisation_id = v_intent.organisation_id
        AND om.employee_id = v_visit.employee_id
      LIMIT 1;
    END IF;
  END IF;

  INSERT INTO tasks (
    organisation_id,
    title,
    description,
    status,
    priority,
    assignee_ids,
    site_visit_id,
    created_by
  ) VALUES (
    v_intent.organisation_id,
    '[Site Stoppage] ' || left(trim(v_intent.description), 80),
    v_intent.description,
    'not_started',
    'high',
    CASE WHEN v_assignee IS NOT NULL THEN ARRAY[v_assignee] ELSE NULL END,
    v_intent.site_visit_id,
    auth.uid()
  )
  RETURNING * INTO v_task;

  UPDATE site_report_stoppages
  SET task_intent_status = 'approved_task_created',
      created_task_id = v_task.id,
      pm_reviewed_by = auth.uid(),
      pm_reviewed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_intent_id;

  RETURN v_task;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_site_stoppage_intent(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_site_stoppage_intent(UUID) TO authenticated;
