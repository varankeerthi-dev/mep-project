-- ============================================
-- DAILY REPORT ↔ PROJECT TASK INTEGRATION
-- Phase 0: Schema Migration
-- ============================================
-- Run this in Supabase SQL Editor.
-- Additive only — does NOT modify any existing table.
--
-- Idempotent (safe to run multiple times):
--   - CREATE TABLE IF NOT EXISTS
--   - CREATE OR REPLACE FUNCTION
--   - DROP TRIGGER IF EXISTS
--   - ALTER TABLE ... ADD COLUMN IF NOT EXISTS
-- ============================================

-- ============================================
-- 1. NEW TABLE: daily_report_work_items
-- Sits between site_reports and tasks.
-- Each row = one "completed work" or "milestone completed" entry
-- in the daily site report, optionally anchored to a project task.
-- ============================================
CREATE TABLE IF NOT EXISTS daily_report_work_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id       UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  daily_report_id       UUID NOT NULL REFERENCES site_reports(id) ON DELETE CASCADE,
  task_id               UUID REFERENCES tasks(id) ON DELETE SET NULL,
  ad_hoc_title          TEXT,
  ad_hoc_discipline     TEXT,
  kind                  TEXT NOT NULL DEFAULT 'work'
                        CHECK (kind IN ('work', 'milestone')),
  progress_before       INTEGER CHECK (progress_before BETWEEN 0 AND 100),
  progress_after        INTEGER CHECK (progress_after BETWEEN 0 AND 100),
  status_before         TEXT,
  status_after          TEXT,
  quantity_done         DECIMAL(12,2),
  quantity_unit         TEXT,
  note                  TEXT,
  blocker_flag          BOOLEAN NOT NULL DEFAULT false,
  blocker_reason        TEXT,
  sort_order            INTEGER NOT NULL DEFAULT 0,
  created_by            UUID REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at            TIMESTAMPTZ,
  CONSTRAINT drwi_anchor_xor
    CHECK ((task_id IS NOT NULL) OR (ad_hoc_title IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_drwi_org_report
  ON daily_report_work_items(organisation_id, daily_report_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_drwi_task
  ON daily_report_work_items(task_id);
CREATE INDEX IF NOT EXISTS idx_drwi_created_by
  ON daily_report_work_items(created_by);

ALTER TABLE daily_report_work_items ENABLE ROW LEVEL SECURITY;

-- RLS: org-scoped read/write (mirrors site_reports pattern)
DROP POLICY IF EXISTS "drwi_select_org" ON daily_report_work_items;
CREATE POLICY "drwi_select_org"
  ON daily_report_work_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.organisation_id = daily_report_work_items.organisation_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "drwi_insert_org" ON daily_report_work_items;
CREATE POLICY "drwi_insert_org"
  ON daily_report_work_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.organisation_id = daily_report_work_items.organisation_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "drwi_update_org" ON daily_report_work_items;
CREATE POLICY "drwi_update_org"
  ON daily_report_work_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.organisation_id = daily_report_work_items.organisation_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "drwi_delete_org" ON daily_report_work_items;
CREATE POLICY "drwi_delete_org"
  ON daily_report_work_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.organisation_id = daily_report_work_items.organisation_id
        AND om.user_id = auth.uid()
    )
  );

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_drwi_updated_at ON daily_report_work_items;
CREATE TRIGGER trg_drwi_updated_at
  BEFORE UPDATE ON daily_report_work_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 2. EXTEND: site_report_photos
-- Add two nullable columns to point at work-item + task.
-- The existing site_report_photos table is already created by
-- src/database-site-reports-photos.sql — we only ADD columns.
-- ============================================
ALTER TABLE site_report_photos
  ADD COLUMN IF NOT EXISTS work_item_id UUID
    REFERENCES daily_report_work_items(id) ON DELETE SET NULL;
ALTER TABLE site_report_photos
  ADD COLUMN IF NOT EXISTS task_id UUID
    REFERENCES tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_srp_work_item
  ON site_report_photos(work_item_id);
CREATE INDEX IF NOT EXISTS idx_srp_task
  ON site_report_photos(task_id);

-- ============================================
-- 3. RPC: fn_link_daily_report_photo
-- Atomic write to site_report_photos AND task_attachments.
-- One upload = one row in each table, in one transaction.
-- ============================================
CREATE OR REPLACE FUNCTION fn_link_daily_report_photo(
  p_report_id  UUID,
  p_work_item  UUID,
  p_task_id    UUID,
  p_file_name  TEXT,
  p_storage    TEXT,
  p_thumb      TEXT,
  p_size       INTEGER,
  p_mime       TEXT,
  p_caption    TEXT,
  p_user_id    UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_photo_id    UUID;
  v_task_attach UUID;
  v_org_id      UUID;
BEGIN
  SELECT organisation_id INTO v_org_id
    FROM site_reports WHERE id = p_report_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'site_report % not found', p_report_id;
  END IF;

  INSERT INTO site_report_photos (
    organisation_id, report_id, work_item_id, task_id,
    file_name, storage_path, thumbnail_path, file_size,
    mime_type, caption, uploaded_by
  )
  VALUES (
    v_org_id, p_report_id, p_work_item, p_task_id,
    p_file_name, p_storage, p_thumb, p_size,
    p_mime, p_caption, p_user_id
  )
  RETURNING id INTO v_photo_id;

  IF p_task_id IS NOT NULL THEN
    INSERT INTO task_attachments (
      task_id, user_id, file_name, file_type, file_size,
      storage_path, thumbnail_path
    )
    VALUES (
      p_task_id, p_user_id, p_file_name, p_mime, p_size,
      p_storage, p_thumb
    )
    RETURNING id INTO v_task_attach;
  END IF;

  RETURN jsonb_build_object(
    'photo_id',          v_photo_id,
    'task_attachment_id', v_task_attach
  );
END;
$$;

-- ============================================
-- 4. TRIGGER: fn_daily_report_apply_progress
-- Auto-apply progress_after / status_after to the linked task.
-- Only runs if the daily report explicitly set a value
-- (progress_after IS NOT NULL OR status_after IS NOT NULL).
-- Writes to task_activity_log for audit.
-- ============================================
CREATE OR REPLACE FUNCTION fn_daily_report_apply_progress()
RETURNS TRIGGER AS $$
DECLARE
  v_old_pct  INTEGER;
  v_old_stat TEXT;
BEGIN
  IF NEW.task_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT completion_percentage, status
    INTO v_old_pct, v_old_stat
    FROM tasks
   WHERE id = NEW.task_id;

  IF NEW.progress_after IS NOT NULL OR NEW.status_after IS NOT NULL THEN
    UPDATE tasks
       SET completion_percentage = COALESCE(NEW.progress_after, completion_percentage),
           status               = COALESCE(NEW.status_after, status),
           completed_date       = CASE
                                   WHEN COALESCE(NEW.progress_after, 0) = 100
                                    AND completed_date IS NULL
                                   THEN now()
                                   ELSE completed_date
                                 END,
           updated_at           = now()
     WHERE id = NEW.task_id;

    INSERT INTO task_activity_log (
      task_id, user_id, action, old_value, new_value
    )
    VALUES (
      NEW.task_id, NEW.created_by, 'daily_report_progress_applied',
      jsonb_build_object(
        'completion_percentage', v_old_pct,
        'status', v_old_stat
      ),
      jsonb_build_object(
        'completion_percentage', NEW.progress_after,
        'status', NEW.status_after,
        'source', 'daily_report',
        'work_item_id', NEW.id,
        'daily_report_id', NEW.daily_report_id
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_daily_report_apply_progress
  ON daily_report_work_items;
CREATE TRIGGER trg_daily_report_apply_progress
  AFTER INSERT OR UPDATE OF progress_after, status_after, task_id
  ON daily_report_work_items
  FOR EACH ROW EXECUTE FUNCTION fn_daily_report_apply_progress();

-- ============================================
-- 5. TRIGGER: fn_task_assign_task_no
-- Auto-increment per (organisation_id, project_id) on insert.
-- Replaces the assumption that callers pass task_no manually.
-- The existing tasks table may already have a similar trigger;
-- this one is idempotent and safe to (re)create.
-- ============================================
CREATE OR REPLACE FUNCTION fn_task_assign_task_no()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.task_no IS NULL OR NEW.task_no = 0 THEN
    SELECT COALESCE(MAX(task_no), 0) + 1
      INTO NEW.task_no
      FROM tasks
     WHERE organisation_id = NEW.organisation_id
       AND project_id IS NOT DISTINCT FROM NEW.project_id
       AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_task_assign_no ON tasks;
CREATE TRIGGER trg_task_assign_no
  BEFORE INSERT ON tasks
  FOR EACH ROW EXECUTE FUNCTION fn_task_assign_task_no();

-- ============================================
-- 6. AUDIT TABLE: daily_report_audit
-- Captures who changed what and when on work-item rows.
-- Optional in v1; written by app code, not triggers,
-- to keep the trigger surface narrow.
-- ============================================
CREATE TABLE IF NOT EXISTS daily_report_audit (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  work_item_id    UUID REFERENCES daily_report_work_items(id) ON DELETE SET NULL,
  daily_report_id UUID REFERENCES site_reports(id) ON DELETE SET NULL,
  actor_user_id   UUID REFERENCES auth.users(id),
  action          TEXT NOT NULL,
  old_value       JSONB,
  new_value       JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dra_org
  ON daily_report_audit(organisation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dra_work_item
  ON daily_report_audit(work_item_id);
CREATE INDEX IF NOT EXISTS idx_dra_actor
  ON daily_report_audit(actor_user_id);

ALTER TABLE daily_report_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dra_select_org" ON daily_report_audit;
CREATE POLICY "dra_select_org"
  ON daily_report_audit FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.organisation_id = daily_report_audit.organisation_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "dra_insert_org" ON daily_report_audit;
CREATE POLICY "dra_insert_org"
  ON daily_report_audit FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.organisation_id = daily_report_audit.organisation_id
        AND om.user_id = auth.uid()
    )
  );

-- ============================================
-- End of migration. No existing table was modified.
-- ============================================
