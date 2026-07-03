-- ============================================
-- 097_site_report_atomic_rpc.sql
-- Atomic create/update RPCs for site reports
-- All child rows are persisted inside a single
-- PostgreSQL transaction. Either everything
-- commits or everything rolls back.
-- ============================================

-- Ensure helper exists (idempotent)
CREATE OR REPLACE FUNCTION to_nullable_uuid(v TEXT)
RETURNS UUID LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(TRIM(BOTH FROM v), '')::UUID;
$$;

-- ============================================================
-- ATOMIC CREATE
-- ============================================================

CREATE OR REPLACE FUNCTION create_complete_site_report(
  p_report       JSONB,
  p_links        JSONB DEFAULT '[]'::JSONB,
  p_children     JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_report_id UUID;
BEGIN
  -- 1. Insert the main site_reports row
  INSERT INTO site_reports (
    organisation_id, client_id, project_id, issue_id, report_date,
    total_manpower, skilled_manpower, unskilled_manpower,
    start_time, end_time,
    planned_progress, actual_progress, percent_complete,
    equipment_on_site, breakdown_issues,
    toolbox_meeting, ppe_followed,
    inspection_status, satisfied_percent, rework_required_reason,
    is_rework, rework_reason, rework_start, rework_end,
    rework_material_used, rework_total_manpower,
    doc_type, doc_no, received_signature,
    quote_to_be_sent, mail_received,
    pm_status, material_arrangement,
    is_filed, tools_locked, site_pictures_status,
    engineer_name, signature_date,
    primary_task_id
  )
  VALUES (
    (p_report->>'organisation_id')::UUID,
    to_nullable_uuid(p_report->>'client_id'),
    to_nullable_uuid(p_report->>'project_id'),
    to_nullable_uuid(p_report->>'issue_id'),
    (p_report->>'report_date')::DATE,
    p_report->>'total_manpower',
    p_report->>'skilled_manpower',
    p_report->>'unskilled_manpower',
    NULLIF(TRIM(BOTH FROM p_report->>'start_time'), '')::TIME,
    NULLIF(TRIM(BOTH FROM p_report->>'end_time'), '')::TIME,
    p_report->>'planned_progress',
    p_report->>'actual_progress',
    p_report->>'percent_complete',
    p_report->>'equipment_on_site',
    p_report->>'breakdown_issues',
    COALESCE((p_report->>'toolbox_meeting')::BOOLEAN, FALSE),
    COALESCE((p_report->>'ppe_followed')::BOOLEAN, FALSE),
    p_report->>'inspection_status',
    p_report->>'satisfied_percent',
    p_report->>'rework_required_reason',
    COALESCE((p_report->>'is_rework')::BOOLEAN, FALSE),
    p_report->>'rework_reason',
    NULLIF(TRIM(BOTH FROM p_report->>'rework_start'), '')::TIME,
    NULLIF(TRIM(BOTH FROM p_report->>'rework_end'), '')::TIME,
    p_report->>'rework_material_used',
    p_report->>'rework_total_manpower',
    p_report->>'doc_type',
    p_report->>'doc_no',
    p_report->>'received_signature',
    COALESCE((p_report->>'quote_to_be_sent')::BOOLEAN, FALSE),
    COALESCE((p_report->>'mail_received')::BOOLEAN, FALSE),
    p_report->>'pm_status',
    p_report->>'material_arrangement',
    COALESCE((p_report->>'is_filed')::BOOLEAN, FALSE),
    COALESCE((p_report->>'tools_locked')::BOOLEAN, FALSE),
    p_report->>'site_pictures_status',
    p_report->>'engineer_name',
    p_report->>'signature_date',
    to_nullable_uuid(p_report->>'primary_task_id')
  )
  RETURNING id INTO v_report_id;

  -- 2. Sub-contractors on site
  IF p_children ? 'subContractors' AND jsonb_array_length(p_children->'subContractors') > 0 THEN
    INSERT INTO sub_contractors (organisation_id, report_id, subcontractor_id, name, count, start_time, end_time)
    SELECT
      (p_report->>'organisation_id')::UUID,
      v_report_id,
      to_nullable_uuid(s->>'subcontractor_id'),
      s->>'name',
      s->>'count',
      NULLIF(TRIM(BOTH FROM s->>'start'), '')::TIME,
      NULLIF(TRIM(BOTH FROM s->>'end'), '')::TIME
    FROM jsonb_array_elements(p_children->'subContractors') AS s
    WHERE NULLIF(TRIM(BOTH FROM s->>'name'), '') IS NOT NULL;
  END IF;

  -- 3. Work carried out
  IF p_children ? 'workCarriedOut' AND jsonb_array_length(p_children->'workCarriedOut') > 0 THEN
    INSERT INTO work_carried_out (organisation_id, report_id, description, trade)
    SELECT
      (p_report->>'organisation_id')::UUID,
      v_report_id,
      NULLIF(TRIM(BOTH FROM w->>'value'), ''),
      COALESCE(NULLIF(TRIM(BOTH FROM w->>'trade'), ''), 'General')
    FROM jsonb_array_elements(p_children->'workCarriedOut') AS w
    WHERE NULLIF(TRIM(BOTH FROM w->>'value'), '') IS NOT NULL;
  END IF;

  -- 4. Milestones completed
  IF p_children ? 'milestonesCompleted' AND jsonb_array_length(p_children->'milestonesCompleted') > 0 THEN
    INSERT INTO milestones_completed (organisation_id, report_id, description)
    SELECT
      (p_report->>'organisation_id')::UUID,
      v_report_id,
      NULLIF(TRIM(BOTH FROM m->>'value'), '')
    FROM jsonb_array_elements(p_children->'milestonesCompleted') AS m
    WHERE NULLIF(TRIM(BOTH FROM m->>'value'), '') IS NOT NULL;
  END IF;

  -- 5. Client requirements
  IF p_children ? 'clientRequirements' AND jsonb_array_length(p_children->'clientRequirements') > 0 THEN
    INSERT INTO site_report_client_requirements (organisation_id, report_id, description, sort_order)
    SELECT
      (p_report->>'organisation_id')::UUID,
      v_report_id,
      NULLIF(TRIM(BOTH FROM c->>'value'), ''),
      ordinality - 1
    FROM jsonb_array_elements(p_children->'clientRequirements') AS c WITH ORDINALITY
    WHERE NULLIF(TRIM(BOTH FROM c->>'value'), '') IS NOT NULL;
  END IF;

  -- 6. Work plan next day
  IF p_children ? 'workPlanNextDay' AND jsonb_array_length(p_children->'workPlanNextDay') > 0 THEN
    INSERT INTO site_report_work_plan_next_day (organisation_id, report_id, description, sort_order)
    SELECT
      (p_report->>'organisation_id')::UUID,
      v_report_id,
      NULLIF(TRIM(BOTH FROM w->>'value'), ''),
      ordinality - 1
    FROM jsonb_array_elements(p_children->'workPlanNextDay') AS w WITH ORDINALITY
    WHERE NULLIF(TRIM(BOTH FROM w->>'value'), '') IS NOT NULL;
  END IF;

  -- 7. Special instructions
  IF p_children ? 'specialInstructions' AND jsonb_array_length(p_children->'specialInstructions') > 0 THEN
    INSERT INTO site_report_special_instructions (organisation_id, report_id, description, sort_order)
    SELECT
      (p_report->>'organisation_id')::UUID,
      v_report_id,
      NULLIF(TRIM(BOTH FROM s->>'value'), ''),
      ordinality - 1
    FROM jsonb_array_elements(p_children->'specialInstructions') AS s WITH ORDINALITY
    WHERE NULLIF(TRIM(BOTH FROM s->>'value'), '') IS NOT NULL;
  END IF;

  -- 8. Issues faced
  IF p_children ? 'issuesFaced' AND jsonb_array_length(p_children->'issuesFaced') > 0 THEN
    INSERT INTO site_report_issues_faced (organisation_id, report_id, issue, solution, sort_order)
    SELECT
      (p_report->>'organisation_id')::UUID,
      v_report_id,
      NULLIF(TRIM(BOTH FROM i->>'issue'), ''),
      COALESCE(NULLIF(TRIM(BOTH FROM i->>'solution'), ''), ''),
      ordinality - 1
    FROM jsonb_array_elements(p_children->'issuesFaced') AS i WITH ORDINALITY
    WHERE NULLIF(TRIM(BOTH FROM i->>'issue'), '') IS NOT NULL;
  END IF;

  -- 9. Report-task links (preserves existing upsert behaviour)
  IF p_links IS NOT NULL AND jsonb_array_length(p_links) > 0 THEN
    INSERT INTO report_task_links (
      organisation_id, report_id, task_id,
      status_during_report, completion_snapshot, is_completed_in_report
    )
    SELECT
      (p_report->>'organisation_id')::UUID,
      v_report_id,
      (l->>'task_id')::UUID,
      l->>'status_during_report',
      (l->>'completion_snapshot')::INT,
      COALESCE((l->>'is_completed_in_report')::BOOLEAN, FALSE)
    FROM jsonb_array_elements(p_links) AS l
    ON CONFLICT (report_id, task_id) DO UPDATE SET
      status_during_report   = EXCLUDED.status_during_report,
      completion_snapshot    = EXCLUDED.completion_snapshot,
      is_completed_in_report = EXCLUDED.is_completed_in_report;

    UPDATE tasks t
    SET last_site_report_id = v_report_id,
        last_report_date    = (p_report->>'report_date')::DATE
    FROM jsonb_array_elements(p_links) AS l
    WHERE t.id = (l->>'task_id')::UUID
      AND t.organisation_id = (p_report->>'organisation_id')::UUID
      AND (t.last_report_date IS NULL OR (p_report->>'report_date')::DATE >= t.last_report_date);
  END IF;

  RETURN v_report_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_complete_site_report(JSONB, JSONB, JSONB) TO authenticated;

-- ============================================================
-- ATOMIC UPDATE
-- ============================================================

CREATE OR REPLACE FUNCTION update_complete_site_report(
  p_report_id   UUID,
  p_report       JSONB,
  p_links        JSONB DEFAULT '[]'::JSONB,
  p_children     JSONB DEFAULT '{}'::JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pm_status TEXT;
BEGIN
  -- 1. Lock check — enforce at the data layer
  SELECT pm_status INTO v_pm_status FROM site_reports WHERE id = p_report_id;
  IF v_pm_status IN ('Pending Approval', 'Approved', 'Reported') THEN
    RAISE EXCEPTION 'Report is locked (status: %). Edit is not allowed after approval or reporting.', v_pm_status;
  END IF;

  -- 2. Update main report row
  UPDATE site_reports SET
    client_id              = to_nullable_uuid(p_report->>'client_id'),
    project_id             = to_nullable_uuid(p_report->>'project_id'),
    issue_id               = to_nullable_uuid(p_report->>'issue_id'),
    report_date            = (p_report->>'report_date')::DATE,
    total_manpower         = p_report->>'total_manpower',
    skilled_manpower       = p_report->>'skilled_manpower',
    unskilled_manpower     = p_report->>'unskilled_manpower',
    start_time             = NULLIF(TRIM(BOTH FROM p_report->>'start_time'), '')::TIME,
    end_time               = NULLIF(TRIM(BOTH FROM p_report->>'end_time'), '')::TIME,
    planned_progress       = p_report->>'planned_progress',
    actual_progress        = p_report->>'actual_progress',
    percent_complete       = p_report->>'percent_complete',
    equipment_on_site      = p_report->>'equipment_on_site',
    breakdown_issues       = p_report->>'breakdown_issues',
    toolbox_meeting        = COALESCE((p_report->>'toolbox_meeting')::BOOLEAN, FALSE),
    ppe_followed           = COALESCE((p_report->>'ppe_followed')::BOOLEAN, FALSE),
    inspection_status      = p_report->>'inspection_status',
    satisfied_percent      = p_report->>'satisfied_percent',
    rework_required_reason = p_report->>'rework_required_reason',
    is_rework              = COALESCE((p_report->>'is_rework')::BOOLEAN, FALSE),
    rework_reason          = p_report->>'rework_reason',
    rework_start           = NULLIF(TRIM(BOTH FROM p_report->>'rework_start'), '')::TIME,
    rework_end             = NULLIF(TRIM(BOTH FROM p_report->>'rework_end'), '')::TIME,
    rework_material_used   = p_report->>'rework_material_used',
    rework_total_manpower  = p_report->>'rework_total_manpower',
    doc_type               = p_report->>'doc_type',
    doc_no                 = p_report->>'doc_no',
    received_signature     = p_report->>'received_signature',
    quote_to_be_sent       = COALESCE((p_report->>'quote_to_be_sent')::BOOLEAN, FALSE),
    mail_received          = COALESCE((p_report->>'mail_received')::BOOLEAN, FALSE),
    pm_status              = p_report->>'pm_status',
    material_arrangement   = p_report->>'material_arrangement',
    is_filed               = COALESCE((p_report->>'is_filed')::BOOLEAN, FALSE),
    tools_locked           = COALESCE((p_report->>'tools_locked')::BOOLEAN, FALSE),
    site_pictures_status   = p_report->>'site_pictures_status',
    engineer_name          = p_report->>'engineer_name',
    signature_date         = p_report->>'signature_date',
    primary_task_id        = to_nullable_uuid(p_report->>'primary_task_id')
  WHERE id = p_report_id;

  -- 3. Replace all child rows (full replace strategy, same as current behaviour)

  -- 3a. Sub-contractors
  DELETE FROM sub_contractors WHERE report_id = p_report_id;
  IF p_children ? 'subContractors' AND jsonb_array_length(p_children->'subContractors') > 0 THEN
    INSERT INTO sub_contractors (organisation_id, report_id, subcontractor_id, name, count, start_time, end_time)
    SELECT
      (p_report->>'organisation_id')::UUID,
      p_report_id,
      to_nullable_uuid(s->>'subcontractor_id'),
      NULLIF(TRIM(BOTH FROM s->>'name'), ''),
      s->>'count',
      NULLIF(TRIM(BOTH FROM s->>'start'), '')::TIME,
      NULLIF(TRIM(BOTH FROM s->>'end'), '')::TIME
    FROM jsonb_array_elements(p_children->'subContractors') AS s
    WHERE NULLIF(TRIM(BOTH FROM s->>'name'), '') IS NOT NULL;
  END IF;

  -- 3b. Work carried out
  DELETE FROM work_carried_out WHERE report_id = p_report_id;
  IF p_children ? 'workCarriedOut' AND jsonb_array_length(p_children->'workCarriedOut') > 0 THEN
    INSERT INTO work_carried_out (organisation_id, report_id, description, trade)
    SELECT
      (p_report->>'organisation_id')::UUID,
      p_report_id,
      NULLIF(TRIM(BOTH FROM w->>'value'), ''),
      COALESCE(NULLIF(TRIM(BOTH FROM w->>'trade'), ''), 'General')
    FROM jsonb_array_elements(p_children->'workCarriedOut') AS w
    WHERE NULLIF(TRIM(BOTH FROM w->>'value'), '') IS NOT NULL;
  END IF;

  -- 3c. Milestones completed
  DELETE FROM milestones_completed WHERE report_id = p_report_id;
  IF p_children ? 'milestonesCompleted' AND jsonb_array_length(p_children->'milestonesCompleted') > 0 THEN
    INSERT INTO milestones_completed (organisation_id, report_id, description)
    SELECT
      (p_report->>'organisation_id')::UUID,
      p_report_id,
      NULLIF(TRIM(BOTH FROM m->>'value'), '')
    FROM jsonb_array_elements(p_children->'milestonesCompleted') AS m
    WHERE NULLIF(TRIM(BOTH FROM m->>'value'), '') IS NOT NULL;
  END IF;

  -- 3d. Client requirements
  DELETE FROM site_report_client_requirements WHERE report_id = p_report_id;
  IF p_children ? 'clientRequirements' AND jsonb_array_length(p_children->'clientRequirements') > 0 THEN
    INSERT INTO site_report_client_requirements (organisation_id, report_id, description, sort_order)
    SELECT
      (p_report->>'organisation_id')::UUID,
      p_report_id,
      NULLIF(TRIM(BOTH FROM c->>'value'), ''),
      ordinality - 1
    FROM jsonb_array_elements(p_children->'clientRequirements') AS c WITH ORDINALITY
    WHERE NULLIF(TRIM(BOTH FROM c->>'value'), '') IS NOT NULL;
  END IF;

  -- 3e. Work plan next day
  DELETE FROM site_report_work_plan_next_day WHERE report_id = p_report_id;
  IF p_children ? 'workPlanNextDay' AND jsonb_array_length(p_children->'workPlanNextDay') > 0 THEN
    INSERT INTO site_report_work_plan_next_day (organisation_id, report_id, description, sort_order)
    SELECT
      (p_report->>'organisation_id')::UUID,
      p_report_id,
      NULLIF(TRIM(BOTH FROM w->>'value'), ''),
      ordinality - 1
    FROM jsonb_array_elements(p_children->'workPlanNextDay') AS w WITH ORDINALITY
    WHERE NULLIF(TRIM(BOTH FROM w->>'value'), '') IS NOT NULL;
  END IF;

  -- 3f. Special instructions
  DELETE FROM site_report_special_instructions WHERE report_id = p_report_id;
  IF p_children ? 'specialInstructions' AND jsonb_array_length(p_children->'specialInstructions') > 0 THEN
    INSERT INTO site_report_special_instructions (organisation_id, report_id, description, sort_order)
    SELECT
      (p_report->>'organisation_id')::UUID,
      p_report_id,
      NULLIF(TRIM(BOTH FROM s->>'value'), ''),
      ordinality - 1
    FROM jsonb_array_elements(p_children->'specialInstructions') AS s WITH ORDINALITY
    WHERE NULLIF(TRIM(BOTH FROM s->>'value'), '') IS NOT NULL;
  END IF;

  -- 3g. Issues faced
  DELETE FROM site_report_issues_faced WHERE report_id = p_report_id;
  IF p_children ? 'issuesFaced' AND jsonb_array_length(p_children->'issuesFaced') > 0 THEN
    INSERT INTO site_report_issues_faced (organisation_id, report_id, issue, solution, sort_order)
    SELECT
      (p_report->>'organisation_id')::UUID,
      p_report_id,
      NULLIF(TRIM(BOTH FROM i->>'issue'), ''),
      COALESCE(NULLIF(TRIM(BOTH FROM i->>'solution'), ''), ''),
      ordinality - 1
    FROM jsonb_array_elements(p_children->'issuesFaced') AS i WITH ORDINALITY
    WHERE NULLIF(TRIM(BOTH FROM i->>'issue'), '') IS NOT NULL;
  END IF;

  -- 4. Report-task links
  DELETE FROM report_task_links WHERE report_id = p_report_id;
  IF p_links IS NOT NULL AND jsonb_array_length(p_links) > 0 THEN
    INSERT INTO report_task_links (
      organisation_id, report_id, task_id,
      status_during_report, completion_snapshot, is_completed_in_report
    )
    SELECT
      (p_report->>'organisation_id')::UUID,
      p_report_id,
      (l->>'task_id')::UUID,
      l->>'status_during_report',
      (l->>'completion_snapshot')::INT,
      COALESCE((l->>'is_completed_in_report')::BOOLEAN, FALSE)
    FROM jsonb_array_elements(p_links) AS l;

    UPDATE tasks t
    SET last_site_report_id = p_report_id,
        last_report_date    = (p_report->>'report_date')::DATE
    FROM jsonb_array_elements(p_links) AS l
    WHERE t.id = (l->>'task_id')::UUID
      AND t.organisation_id = (p_report->>'organisation_id')::UUID
      AND (t.last_report_date IS NULL OR (p_report->>'report_date')::DATE >= t.last_report_date);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION update_complete_site_report(UUID, JSONB, JSONB, JSONB) TO authenticated;
