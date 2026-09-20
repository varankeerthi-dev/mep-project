-- ============================================================================
-- PHASE 1 — TASK CHECKLIST FOUNDATION (Collaboration → Tasks → Reminders)
--
-- Adds first-class checklists to the existing Task module:
--   * task_checklist_items — normalized child of tasks with completion
--     attribution (completed_by / completed_at).
--   * RLS mirrors the existing `tasks` policies exactly:
--       SELECT  → any org member of the parent task (mirrors tasks_select_org)
--       INSERT/UPDATE/DELETE → admin/PM always; engineer/supervisor when
--         assignee or creator; subcontractor when assignee (mirrors
--         tasks_update_org) — joined through task_id.
--   * toggle_task_checklist_item(p_item_id, p_is_completed) — SECURITY INVOKER
--     RPC that stamps completed_by = auth.uid(), completed_at = now()
--     atomically server-side (spec §14). RLS remains the boundary.
--
-- Conventions followed (see COLLAB-TASK-REMINDER-AUDIT.md):
--   uuid PKs via gen_random_uuid(), organisation_id FK to organisations,
--   ON DELETE CASCADE to the parent, created_at/updated_at timestamptz,
--   updated_at maintained by the shared update_updated_at_column() trigger.
-- Forward-only and idempotent. Applied against the live DB (repo migrations
-- are incomplete by design — see audit §1.2).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.task_checklist_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  title           text NOT NULL CHECK (length(btrim(title)) > 0),
  is_completed    boolean NOT NULL DEFAULT false,
  completed_by    uuid REFERENCES auth.users(id),
  completed_at    timestamptz,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  -- Attribution invariant: a completed item always records who and when.
  CONSTRAINT task_checklist_items_completion_attribution
    CHECK ((is_completed = false) OR (completed_by IS NOT NULL AND completed_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_task_checklist_items_task
  ON public.task_checklist_items (task_id, sort_order, created_at);
CREATE INDEX IF NOT EXISTS idx_task_checklist_items_org
  ON public.task_checklist_items (organisation_id);

-- ---------------------------------------------------------------------------
-- 2. Trigger: keep organisation_id in sync with the parent task so a checklist
--    row can never drift into another tenant.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.task_checklist_sync_org_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_org uuid;
BEGIN
  SELECT t.organisation_id INTO v_org
  FROM public.tasks t
  WHERE t.id = NEW.task_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'task_not_found';
  END IF;

  NEW.organisation_id := v_org;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_task_checklist_sync_org ON public.task_checklist_items;
CREATE TRIGGER trg_task_checklist_sync_org
  BEFORE INSERT OR UPDATE OF task_id ON public.task_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.task_checklist_sync_org_fn();

-- ---------------------------------------------------------------------------
-- 3. updated_at trigger (reuse the shared function if present)
-- ---------------------------------------------------------------------------
DO $fn$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'update_updated_at_column'
  ) THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_task_checklist_updated_at ON public.task_checklist_items';
    EXECUTE 'CREATE TRIGGER trg_task_checklist_updated_at
               BEFORE UPDATE ON public.task_checklist_items
               FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()';
  ELSE
    RAISE NOTICE 'update_updated_at_column() not found; skipping updated_at trigger';
  END IF;
END;
$fn$;

-- ---------------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.task_checklist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "task_checklist_select_org" ON public.task_checklist_items;
CREATE POLICY "task_checklist_select_org"
  ON public.task_checklist_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tasks t
      JOIN public.org_members om ON om.organisation_id = t.organisation_id
      WHERE t.id = task_checklist_items.task_id
        AND om.user_id = auth.uid()
    )
  );

-- Write rule mirrors tasks_update_org (admin/PM; engineer/supervisor when
-- assignee-or-creator; subcontractor when assignee), plus org match.
DROP POLICY IF EXISTS "task_checklist_insert_org" ON public.task_checklist_items;
CREATE POLICY "task_checklist_insert_org"
  ON public.task_checklist_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.tasks t
      JOIN public.org_members om ON om.organisation_id = t.organisation_id
      WHERE t.id = task_checklist_items.task_id
        AND t.organisation_id = task_checklist_items.organisation_id
        AND om.user_id = auth.uid()
        AND (
          om.role IN ('admin', 'project_manager')
          OR (
            om.role IN ('engineer', 'supervisor')
            AND (t.assignee_ids @> ARRAY[auth.uid()] OR t.created_by = auth.uid())
          )
          OR (om.role = 'subcontractor' AND t.assignee_ids @> ARRAY[auth.uid()])
        )
    )
  );

DROP POLICY IF EXISTS "task_checklist_update_org" ON public.task_checklist_items;
CREATE POLICY "task_checklist_update_org"
  ON public.task_checklist_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tasks t
      JOIN public.org_members om ON om.organisation_id = t.organisation_id
      WHERE t.id = task_checklist_items.task_id
        AND om.user_id = auth.uid()
        AND (
          om.role IN ('admin', 'project_manager')
          OR (
            om.role IN ('engineer', 'supervisor')
            AND (t.assignee_ids @> ARRAY[auth.uid()] OR t.created_by = auth.uid())
          )
          OR (om.role = 'subcontractor' AND t.assignee_ids @> ARRAY[auth.uid()])
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.tasks t
      JOIN public.org_members om ON om.organisation_id = t.organisation_id
      WHERE t.id = task_checklist_items.task_id
        AND t.organisation_id = task_checklist_items.organisation_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "task_checklist_delete_org" ON public.task_checklist_items;
CREATE POLICY "task_checklist_delete_org"
  ON public.task_checklist_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tasks t
      JOIN public.org_members om ON om.organisation_id = t.organisation_id
      WHERE t.id = task_checklist_items.task_id
        AND om.user_id = auth.uid()
        AND (
          om.role IN ('admin', 'project_manager')
          OR (
            om.role IN ('engineer', 'supervisor')
            AND (t.assignee_ids @> ARRAY[auth.uid()] OR t.created_by = auth.uid())
          )
          OR (om.role = 'subcontractor' AND t.assignee_ids @> ARRAY[auth.uid()])
        )
    )
  );

-- ---------------------------------------------------------------------------
-- 5. Toggle RPC — stamps completed_by / completed_at server-side (spec §14)
--    SECURITY INVOKER: RLS above is the authorization boundary. The RPC exists
--    so attribution cannot be skipped by a careless client.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.toggle_task_checklist_item(
  p_item_id      uuid,
  p_is_completed boolean
)
RETURNS public.task_checklist_items
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_user_id uuid;
  v_item    public.task_checklist_items;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  UPDATE public.task_checklist_items
     SET is_completed  = p_is_completed,
         completed_by  = CASE WHEN p_is_completed THEN v_user_id ELSE NULL END,
         completed_at  = CASE WHEN p_is_completed THEN now() ELSE NULL END
   WHERE id = p_item_id
  RETURNING * INTO v_item;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'checklist_item_not_found';
  END IF;

  RETURN v_item;
END;
$fn$;

REVOKE ALL ON FUNCTION public.toggle_task_checklist_item(uuid, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.toggle_task_checklist_item(uuid, boolean) TO authenticated;
