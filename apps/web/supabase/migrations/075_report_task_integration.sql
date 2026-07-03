-- ============================================================
-- 075_report_task_integration.sql
-- Site Reports <-> Project Tasks Integration
-- Author: Senior Engineering Team
-- Date: 2026-06-15
-- Idempotent: all statements use IF NOT EXISTS / OR REPLACE
-- ============================================================

-- ─────────────────────────────────────────
-- 0. Helper functions (safe TEXT → UUID / DATE conversion)
-- ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION to_nullable_uuid(v TEXT)
RETURNS UUID LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(TRIM(BOTH FROM v), '')::UUID;
$$;

CREATE OR REPLACE FUNCTION to_nullable_date(v TEXT)
RETURNS DATE LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(TRIM(BOTH FROM v), '')::DATE;
$$;

-- ─────────────────────────────────────────
-- 1. Add primary_task_id to site_reports
-- ─────────────────────────────────────────

ALTER TABLE site_reports
  ADD COLUMN IF NOT EXISTS primary_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_site_reports_primary_task
  ON site_reports(primary_task_id);

-- ─────────────────────────────────────────
-- 2. Create report_task_links join table
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS report_task_links (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id       UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  report_id             UUID NOT NULL REFERENCES site_reports(id) ON DELETE CASCADE,
  task_id               UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  status_during_report  TEXT,       -- snapshot of task status at time of report
  completion_snapshot   INT,        -- snapshot of completion_percentage
  is_completed_in_report BOOLEAN DEFAULT FALSE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(report_id, task_id)
);

CREATE INDEX IF NOT EXISTS idx_report_task_links_report
  ON report_task_links(report_id);

CREATE INDEX IF NOT EXISTS idx_report_task_links_task
  ON report_task_links(task_id);

CREATE INDEX IF NOT EXISTS idx_report_task_links_org
  ON report_task_links(organisation_id);

-- RLS for report_task_links
ALTER TABLE report_task_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "report_task_links_select_org" ON report_task_links;
CREATE POLICY "report_task_links_select_org"
  ON report_task_links FOR SELECT
  USING (organisation_id = current_org_id());

DROP POLICY IF EXISTS "report_task_links_insert_org" ON report_task_links;
CREATE POLICY "report_task_links_insert_org"
  ON report_task_links FOR INSERT
  WITH CHECK (organisation_id = current_org_id());

DROP POLICY IF EXISTS "report_task_links_update_org" ON report_task_links;
CREATE POLICY "report_task_links_update_org"
  ON report_task_links FOR UPDATE
  USING (organisation_id = current_org_id());

DROP POLICY IF EXISTS "report_task_links_delete_org" ON report_task_links;
CREATE POLICY "report_task_links_delete_org"
  ON report_task_links FOR DELETE
  USING (organisation_id = current_org_id());

-- ─────────────────────────────────────────
-- 3. Add task_id to site_report_work_stoppages
-- ─────────────────────────────────────────

ALTER TABLE site_report_work_stoppages
  ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sr_stoppages_task
  ON site_report_work_stoppages(task_id);

-- ─────────────────────────────────────────
-- 4. Add last_site_report_id and last_report_date to tasks
-- ─────────────────────────────────────────

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS last_site_report_id UUID REFERENCES site_reports(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_report_date DATE;

CREATE INDEX IF NOT EXISTS idx_tasks_last_report
  ON tasks(last_site_report_id);

CREATE INDEX IF NOT EXISTS idx_tasks_last_report_date
  ON tasks(last_report_date);

-- ─────────────────────────────────────────
-- 5. RPC 1: create_site_report_with_tasks
--    Atomic create: report + links + conditional task pointer update
-- ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION create_site_report_with_tasks(
  p_report JSONB,
  p_links  JSONB   -- [{task_id, status_during_report, completion_snapshot, is_completed_in_report}]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_report_id   UUID;
  v_report_date DATE;
  v_org_id      UUID;
  v_caller_id   UUID;
  v_caller_role TEXT;
BEGIN
  -- Auth check: caller must be an active org member with a permitted role
  SELECT om.user_id, om.role
    INTO v_caller_id, v_caller_role
    FROM org_members om
   WHERE om.user_id = auth.uid()
     AND om.organisation_id = (p_report->>'organisation_id')::UUID
     AND (om.status = 'active' OR om.status = 'Active' OR om.status IS NULL)
   ORDER BY om.joined_at DESC
   LIMIT 1;

  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated or not an active member of this organisation';
  END IF;

  IF v_caller_role NOT IN ('admin', 'project_manager', 'engineer', 'supervisor') THEN
    RAISE EXCEPTION 'Role % is not permitted to create site reports', v_caller_role;
  END IF;

  v_org_id      := (p_report->>'organisation_id')::UUID;
  v_report_date := (p_report->>'report_date')::DATE;

  -- Insert the site report
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
    v_org_id,
    to_nullable_uuid(p_report->>'client_id'),
    to_nullable_uuid(p_report->>'project_id'),
    to_nullable_uuid(p_report->>'issue_id'),
    v_report_date,
    p_report->>'total_manpower',
    p_report->>'skilled_manpower',
    p_report->>'unskilled_manpower',
    (p_report->>'start_time')::TIME,
    (p_report->>'end_time')::TIME,
    p_report->>'planned_progress',
    p_report->>'actual_progress',
    p_report->>'percent_complete',
    p_report->>'equipment_on_site',
    p_report->>'breakdown_issues',
    (p_report->>'toolbox_meeting')::BOOLEAN,
    (p_report->>'ppe_followed')::BOOLEAN,
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

  -- Insert report_task_links (skip if p_links is empty or null)
  IF p_links IS NOT NULL AND jsonb_array_length(p_links) > 0 THEN
    INSERT INTO report_task_links (
      organisation_id, report_id, task_id,
      status_during_report, completion_snapshot, is_completed_in_report
    )
    SELECT
      v_org_id,
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

    -- Conditional task pointer update: only advance, never regress
    UPDATE tasks
    SET
      last_site_report_id = v_report_id,
      last_report_date    = v_report_date
    WHERE id IN (
        SELECT (l->>'task_id')::UUID FROM jsonb_array_elements(p_links) AS l
      )
      AND organisation_id = v_org_id
      AND (
        last_report_date IS NULL
        OR v_report_date >= last_report_date
      );
  END IF;

  RETURN v_report_id;
END;
$$;

-- Grant execute to authenticated users (SECURITY DEFINER handles the rest)
GRANT EXECUTE ON FUNCTION create_site_report_with_tasks(JSONB, JSONB) TO authenticated;

-- ─────────────────────────────────────────
-- 6. RPC 2: update_site_report_with_tasks
--    Normal edit path for unlocked reports
-- ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_site_report_with_tasks(
  p_report_id UUID,
  p_report    JSONB,
  p_links     JSONB   -- [{task_id, status_during_report, completion_snapshot, is_completed_in_report}]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_report_date DATE;
  v_caller_id   UUID;
  v_caller_role TEXT;
  v_pm_status   TEXT;
  v_org_id      UUID;
BEGIN
  -- Auth check
  SELECT om.user_id, om.role
    INTO v_caller_id, v_caller_role
    FROM org_members om
   WHERE om.user_id = auth.uid()
     AND om.organisation_id = (SELECT organisation_id FROM site_reports WHERE id = p_report_id)
     AND (om.status = 'active' OR om.status = 'Active' OR om.status IS NULL)
   ORDER BY om.joined_at DESC
   LIMIT 1;

  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated or not an active member of this organisation';
  END IF;

  IF v_caller_role NOT IN ('admin', 'project_manager', 'engineer', 'supervisor') THEN
    RAISE EXCEPTION 'Role % is not permitted to update site reports', v_caller_role;
  END IF;

  SELECT pm_status, organisation_id
    INTO v_pm_status, v_org_id
    FROM site_reports
   WHERE id = p_report_id;

  IF v_pm_status IN ('Pending Approval', 'Approved', 'Reported') THEN
    RAISE EXCEPTION 'Report is locked (status: %). Use the link-correction RPC instead.', v_pm_status;
  END IF;

  v_report_date := (p_report->>'report_date')::DATE;

  UPDATE site_reports SET
    client_id              = to_nullable_uuid(p_report->>'client_id'),
    project_id             = to_nullable_uuid(p_report->>'project_id'),
    issue_id               = to_nullable_uuid(p_report->>'issue_id'),
    report_date            = v_report_date,
    total_manpower         = p_report->>'total_manpower',
    skilled_manpower       = p_report->>'skilled_manpower',
    unskilled_manpower     = p_report->>'unskilled_manpower',
    start_time             = (p_report->>'start_time')::TIME,
    end_time               = (p_report->>'end_time')::TIME,
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

  -- Replace links (matching full-replace child strategy)
  DELETE FROM report_task_links WHERE report_id = p_report_id;

  IF p_links IS NOT NULL AND jsonb_array_length(p_links) > 0 THEN
    INSERT INTO report_task_links (
      organisation_id, report_id, task_id,
      status_during_report, completion_snapshot, is_completed_in_report
    )
    SELECT
      v_org_id,
      p_report_id,
      (l->>'task_id')::UUID,
      l->>'status_during_report',
      (l->>'completion_snapshot')::INT,
      COALESCE((l->>'is_completed_in_report')::BOOLEAN, FALSE)
    FROM jsonb_array_elements(p_links) AS l;

    -- Conditional task pointer update: only advance, never regress
    UPDATE tasks
    SET
      last_site_report_id = p_report_id,
      last_report_date    = v_report_date
    WHERE id IN (
        SELECT (l->>'task_id')::UUID FROM jsonb_array_elements(p_links) AS l
      )
      AND organisation_id = v_org_id
      AND (
        last_report_date IS NULL
        OR v_report_date >= last_report_date
      );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION update_site_report_with_tasks(UUID, JSONB, JSONB) TO authenticated;

-- ─────────────────────────────────────────
-- 7. RPC 3: update_report_task_links
--    Locked-report link-correction carve-out (PM/admin only)
-- ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_report_task_links(
  p_report_id        UUID,
  p_links            JSONB,   -- [{task_id, status_during_report, completion_snapshot, is_completed_in_report}]
  p_stoppage_updates JSONB    -- [{stoppage_id, task_id}] — can be null or empty
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org_id       UUID;
  v_report_date  DATE;
  v_caller_id    UUID;
  v_caller_role  TEXT;
  v_old_task_ids UUID[];
  v_new_task_ids UUID[];
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT organisation_id, report_date
    INTO v_org_id, v_report_date
    FROM site_reports
   WHERE id = p_report_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Report not found';
  END IF;

  -- Verify caller is active member of the report's org
  IF NOT EXISTS (
    SELECT 1 FROM org_members
     WHERE user_id = v_caller_id
       AND organisation_id = v_org_id
       AND (status = 'active' OR status = 'Active' OR status IS NULL)
  ) THEN
    RAISE EXCEPTION 'Caller is not a member of the report organisation';
  END IF;

  -- Only admin/PM can correct links on locked reports
  SELECT role INTO v_caller_role
    FROM org_members
   WHERE user_id = v_caller_id
     AND organisation_id = v_org_id
     AND (status = 'active' OR status = 'Active' OR status IS NULL)
   ORDER BY joined_at DESC
   LIMIT 1;

  IF v_caller_role NOT IN ('admin', 'project_manager') THEN
    RAISE EXCEPTION 'Only admin or project_manager can correct links on locked reports';
  END IF;

  -- Capture old set for audit diff
  SELECT COALESCE(array_agg(task_id), '{}'::UUID[])
    INTO v_old_task_ids
    FROM report_task_links
   WHERE report_id = p_report_id;

  -- Replace links
  DELETE FROM report_task_links WHERE report_id = p_report_id;

  IF p_links IS NOT NULL AND jsonb_array_length(p_links) > 0 THEN
    INSERT INTO report_task_links (
      organisation_id, report_id, task_id,
      status_during_report, completion_snapshot, is_completed_in_report
    )
    SELECT
      v_org_id,
      p_report_id,
      (l->>'task_id')::UUID,
      l->>'status_during_report',
      (l->>'completion_snapshot')::INT,
      COALESCE((l->>'is_completed_in_report')::BOOLEAN, FALSE)
    FROM jsonb_array_elements(p_links) AS l;
  END IF;

  -- Build new set for diffing
  SELECT COALESCE(
      array_agg((l->>'task_id')::UUID),
      '{}'::UUID[]
    )
    INTO v_new_task_ids
    FROM jsonb_array_elements(COALESCE(p_links, '[]'::JSONB)) AS l;

  -- Audit log: removed tasks
  INSERT INTO task_activity_log (task_id, user_id, action, old_value, new_value, created_at)
  SELECT
    tid,
    v_caller_id,
    'link_removed',
    jsonb_build_object('report_id', p_report_id::TEXT),
    jsonb_build_object('report_id', p_report_id::TEXT),
    NOW()
  FROM (
    SELECT unnest(v_old_task_ids) AS tid
    EXCEPT
    SELECT unnest(v_new_task_ids)
  ) AS removed;

  -- Audit log: added tasks
  INSERT INTO task_activity_log (task_id, user_id, action, old_value, new_value, created_at)
  SELECT
    tid,
    v_caller_id,
    'link_added',
    jsonb_build_object('report_id', p_report_id::TEXT),
    jsonb_build_object('report_id', p_report_id::TEXT),
    NOW()
  FROM (
    SELECT unnest(v_new_task_ids) AS tid
    EXCEPT
    SELECT unnest(v_old_task_ids)
  ) AS added;

  -- Apply stoppage → task links
  IF p_stoppage_updates IS NOT NULL AND jsonb_array_length(p_stoppage_updates) > 0 THEN
    UPDATE site_report_work_stoppages s
    SET task_id = to_nullable_uuid(u->>'task_id')
    FROM jsonb_array_elements(p_stoppage_updates) AS u
    WHERE s.id = (u->>'stoppage_id')::UUID
      AND s.report_id = p_report_id;
  END IF;

  -- Conditional task pointer update: only advance, never regress
  IF v_new_task_ids IS NOT NULL AND array_length(v_new_task_ids, 1) > 0 THEN
    UPDATE tasks
    SET
      last_site_report_id = p_report_id,
      last_report_date    = v_report_date
    WHERE id = ANY(v_new_task_ids)
      AND organisation_id = v_org_id
      AND (
        last_report_date IS NULL
        OR v_report_date >= last_report_date
      );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION update_report_task_links(UUID, JSONB, JSONB) TO authenticated;

-- ─────────────────────────────────────────
-- Done
-- ─────────────────────────────────────────
