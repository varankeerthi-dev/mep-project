-- 20260919010000_collab_tasks_reminders_foundation.sql
-- Foundation for Collaboration → Tasks → Reminders (Phases 3, 4, 5, 7, 8)

-- ============================================================================
-- 1. TASK CHANNEL LINKS (Phase 3 & 8)
-- Links a company task to a collaboration channel card message (idempotency key)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.task_channel_links (
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES public.project_collaboration_channels(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES public.project_collaboration_messages(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, channel_id)
);

CREATE INDEX IF NOT EXISTS idx_task_channel_links_channel ON public.task_channel_links(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_channel_links_project ON public.task_channel_links(project_id);
CREATE INDEX IF NOT EXISTS idx_task_channel_links_org ON public.task_channel_links(organisation_id);

ALTER TABLE public.task_channel_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_channel_links FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'task_channel_links' AND policyname = 'task_channel_links_select') THEN
    CREATE POLICY task_channel_links_select ON public.task_channel_links
      FOR SELECT TO authenticated
      USING (organisation_id IN (SELECT organisation_id FROM public.org_members WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'task_channel_links' AND policyname = 'task_channel_links_insert') THEN
    CREATE POLICY task_channel_links_insert ON public.task_channel_links
      FOR INSERT TO authenticated
      WITH CHECK (organisation_id IN (SELECT organisation_id FROM public.org_members WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'task_channel_links' AND policyname = 'task_channel_links_delete') THEN
    CREATE POLICY task_channel_links_delete ON public.task_channel_links
      FOR DELETE TO authenticated
      USING (organisation_id IN (SELECT organisation_id FROM public.org_members WHERE user_id = auth.uid()));
  END IF;
END $$;

-- RPC: Post Task Channel Card (idempotent, returns message)
CREATE OR REPLACE FUNCTION public.post_task_channel_card(
  p_project_id uuid,
  p_channel_id uuid,
  p_task_id uuid
)
RETURNS public.project_collaboration_messages
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_user_id uuid;
  v_channel public.project_collaboration_channels;
  v_task public.tasks;
  v_msg public.project_collaboration_messages;
  v_existing_msg_id uuid;
  v_metadata jsonb;
  v_task_title text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  -- Check if already linked to this channel
  SELECT message_id INTO v_existing_msg_id
  FROM public.task_channel_links
  WHERE task_id = p_task_id AND channel_id = p_channel_id;

  IF v_existing_msg_id IS NOT NULL THEN
    SELECT * INTO v_msg
    FROM public.project_collaboration_messages
    WHERE id = v_existing_msg_id;
    RETURN v_msg;
  END IF;

  -- Fetch task
  SELECT * INTO v_task
  FROM public.tasks
  WHERE id = p_task_id;

  IF v_task IS NULL THEN RAISE EXCEPTION 'task_not_found'; END IF;

  -- Fetch channel
  SELECT * INTO v_channel
  FROM public.project_collaboration_channels
  WHERE id = p_channel_id;

  IF v_channel IS NULL THEN RAISE EXCEPTION 'channel_not_found'; END IF;

  v_task_title := COALESCE(v_task.title, 'Task');
  v_task_label := CASE 
    WHEN v_task.task_no IS NOT NULL THEN 'TSK-' || lpad(v_task.task_no::text, 4, '0')
    ELSE v_task_title
  END;

  v_metadata := jsonb_build_object(
    'linked_entities', jsonb_build_array(jsonb_build_object(
      'type', 'task',
      'id', v_task.id,
      'label', v_task_label,
      'meta', jsonb_build_object(
        'title', v_task.title,
        'status', v_task.status,
        'priority', v_task.priority,
        'due_date', v_task.due_date,
        'assignee_ids', v_task.assignee_ids
      )
    ))
  );

  INSERT INTO public.project_collaboration_messages (
    organisation_id, channel_id, sender_id, message_type, content, metadata
  )
  VALUES (
    v_channel.organisation_id, v_channel.id, v_user_id,
    'system', 'Created task: ' || v_task_title, v_metadata
  )
  RETURNING * INTO v_msg;

  INSERT INTO public.task_channel_links
    (task_id, organisation_id, project_id, channel_id, message_id)
  VALUES
    (v_task.id, v_channel.organisation_id, p_project_id, v_channel.id, v_msg.id);

  RETURN v_msg;
END;
$$;

REVOKE ALL ON FUNCTION public.post_task_channel_card(uuid, uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.post_task_channel_card(uuid, uuid, uuid) TO authenticated;


-- ============================================================================
-- 2. PERSONAL TASKS (Phase 4 — "Add to my task")
-- Dedicated table ensuring private personal tasks can NEVER be viewed by other org members
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.personal_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(trim(title)) > 0),
  description text,
  is_completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  due_date date,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  source_message_id uuid REFERENCES public.project_collaboration_messages(id) ON DELETE SET NULL,
  source_channel_id uuid REFERENCES public.project_collaboration_channels(id) ON DELETE SET NULL,
  source_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_personal_tasks_user_status ON public.personal_tasks(user_id, is_completed, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_personal_tasks_user_due ON public.personal_tasks(user_id, due_date);

ALTER TABLE public.personal_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_tasks FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'personal_tasks' AND policyname = 'personal_tasks_select_own') THEN
    CREATE POLICY personal_tasks_select_own ON public.personal_tasks
      FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'personal_tasks' AND policyname = 'personal_tasks_insert_own') THEN
    CREATE POLICY personal_tasks_insert_own ON public.personal_tasks
      FOR INSERT TO authenticated
      WITH CHECK (user_id = auth.uid() AND organisation_id IN (SELECT organisation_id FROM public.org_members WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'personal_tasks' AND policyname = 'personal_tasks_update_own') THEN
    CREATE POLICY personal_tasks_update_own ON public.personal_tasks
      FOR UPDATE TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'personal_tasks' AND policyname = 'personal_tasks_delete_own') THEN
    CREATE POLICY personal_tasks_delete_own ON public.personal_tasks
      FOR DELETE TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

-- RPC: Create Personal Task From Message (one-click action)
CREATE OR REPLACE FUNCTION public.create_personal_task_from_message(p_message_id uuid)
RETURNS public.personal_tasks
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_user_id uuid;
  v_msg public.project_collaboration_messages;
  v_task public.personal_tasks;
  v_title text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  -- Fetch message (verifies access via RLS)
  SELECT * INTO v_msg
  FROM public.project_collaboration_messages
  WHERE id = p_message_id;

  IF v_msg IS NULL THEN RAISE EXCEPTION 'message_not_found'; END IF;

  -- Title: first non-empty line or first 100 characters
  v_title := split_part(trim(v_msg.content), E'\n', 1);
  IF length(v_title) > 100 THEN
    v_title := left(v_title, 97) || '…';
  END IF;
  IF length(trim(v_title)) = 0 THEN
    v_title := 'Personal Task from message';
  END IF;

  INSERT INTO public.personal_tasks (
    user_id, organisation_id, title, description,
    source_message_id, source_channel_id,
    source_project_id
  )
  SELECT
    v_user_id, v_msg.organisation_id, v_title, v_msg.content,
    v_msg.id, v_msg.channel_id,
    c.project_id
  FROM public.project_collaboration_channels c
  WHERE c.id = v_msg.channel_id
  RETURNING * INTO v_task;

  RETURN v_task;
END;
$$;

REVOKE ALL ON FUNCTION public.create_personal_task_from_message(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_personal_task_from_message(uuid) TO authenticated;

-- RPC: Toggle Personal Task
CREATE OR REPLACE FUNCTION public.toggle_personal_task(
  p_task_id uuid,
  p_is_completed boolean
)
RETURNS public.personal_tasks
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_user_id uuid;
  v_task public.personal_tasks;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  UPDATE public.personal_tasks
  SET
    is_completed = p_is_completed,
    completed_at = CASE WHEN p_is_completed THEN now() ELSE NULL END,
    updated_at = now()
  WHERE id = p_task_id AND user_id = v_user_id
  RETURNING * INTO v_task;

  IF v_task IS NULL THEN RAISE EXCEPTION 'task_not_found_or_not_authorized'; END IF;

  RETURN v_task;
END;
$$;

REVOKE ALL ON FUNCTION public.toggle_personal_task(uuid, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.toggle_personal_task(uuid, boolean) TO authenticated;


-- ============================================================================
-- 3. TASK REMINDERS (Phases 5, 6, 7 — Reminders Foundation & Sub-tab)
-- Recipient-scoped reminders, nullable remind_at (date-less supported), creator != recipient
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.task_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(trim(title)) > 0),
  notes text,
  remind_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'dismissed')),
  completed_at timestamptz,
  source_message_id uuid REFERENCES public.project_collaboration_messages(id) ON DELETE SET NULL,
  source_channel_id uuid REFERENCES public.project_collaboration_channels(id) ON DELETE SET NULL,
  source_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_reminders_recipient ON public.task_reminders(user_id, status, remind_at);
CREATE INDEX IF NOT EXISTS idx_task_reminders_creator ON public.task_reminders(created_by);
CREATE INDEX IF NOT EXISTS idx_task_reminders_org ON public.task_reminders(organisation_id);

ALTER TABLE public.task_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_reminders FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'task_reminders' AND policyname = 'task_reminders_select') THEN
    CREATE POLICY task_reminders_select ON public.task_reminders
      FOR SELECT TO authenticated
      USING (user_id = auth.uid() OR created_by = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'task_reminders' AND policyname = 'task_reminders_insert') THEN
    CREATE POLICY task_reminders_insert ON public.task_reminders
      FOR INSERT TO authenticated
      WITH CHECK (created_by = auth.uid() AND organisation_id IN (SELECT organisation_id FROM public.org_members WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'task_reminders' AND policyname = 'task_reminders_update') THEN
    CREATE POLICY task_reminders_update ON public.task_reminders
      FOR UPDATE TO authenticated
      USING (user_id = auth.uid() OR created_by = auth.uid())
      WITH CHECK (organisation_id IN (SELECT organisation_id FROM public.org_members WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'task_reminders' AND policyname = 'task_reminders_delete') THEN
    CREATE POLICY task_reminders_delete ON public.task_reminders
      FOR DELETE TO authenticated
      USING (created_by = auth.uid());
  END IF;
END $$;

-- RPC: Create Reminder From Message (Phase 7)
CREATE OR REPLACE FUNCTION public.create_reminder_from_message(
  p_message_id uuid,
  p_recipient_id uuid,
  p_title text,
  p_notes text DEFAULT NULL,
  p_remind_at timestamptz DEFAULT NULL
)
RETURNS public.task_reminders
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_user_id uuid;
  v_msg public.project_collaboration_messages;
  v_reminder public.task_reminders;
  v_recipient_id uuid;
  v_channel public.project_collaboration_channels;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  -- Fetch message
  SELECT * INTO v_msg
  FROM public.project_collaboration_messages
  WHERE id = p_message_id;

  IF v_msg IS NULL THEN RAISE EXCEPTION 'message_not_found'; END IF;

  SELECT * INTO v_channel
  FROM public.project_collaboration_channels
  WHERE id = v_msg.channel_id;

  v_recipient_id := COALESCE(p_recipient_id, v_user_id);

  INSERT INTO public.task_reminders (
    organisation_id, user_id, created_by, title, notes,
    remind_at, status,
    source_message_id, source_channel_id, source_project_id
  )
  VALUES (
    v_msg.organisation_id, v_recipient_id, v_user_id, p_title, p_notes,
    p_remind_at, 'pending',
    v_msg.id, v_msg.channel_id, v_channel.project_id
  )
  RETURNING * INTO v_reminder;

  -- If creator != recipient, insert into notifications table
  IF v_recipient_id <> v_user_id THEN
    INSERT INTO public.notifications (
      user_id, organisation_id, title, body, notification_type, link
    )
    VALUES (
      v_recipient_id, v_msg.organisation_id,
      'New Reminder assigned to you',
      p_title,
      'reminder',
      '/tasks?tab=reminders'
    );
  END IF;

  RETURN v_reminder;
END;
$$;

REVOKE ALL ON FUNCTION public.create_reminder_from_message(uuid, uuid, text, text, timestamptz) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_reminder_from_message(uuid, uuid, text, text, timestamptz) TO authenticated;

-- RPC: Toggle Reminder Status
CREATE OR REPLACE FUNCTION public.toggle_reminder_status(
  p_reminder_id uuid,
  p_status text
)
RETURNS public.task_reminders
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_user_id uuid;
  v_rem public.task_reminders;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  IF p_status NOT IN ('pending', 'completed', 'dismissed') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  UPDATE public.task_reminders
  SET
    status = p_status,
    completed_at = CASE WHEN p_status = 'completed' THEN now() ELSE NULL END,
    updated_at = now()
  WHERE id = p_reminder_id AND (user_id = v_user_id OR created_by = v_user_id)
  RETURNING * INTO v_rem;

  IF v_rem IS NULL THEN RAISE EXCEPTION 'reminder_not_found_or_not_authorized'; END IF;

  RETURN v_rem;
END;
$$;

REVOKE ALL ON FUNCTION public.toggle_reminder_status(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.toggle_reminder_status(uuid, text) TO authenticated;

-- Realtime publication
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.personal_tasks;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.task_reminders;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.task_checklist_items;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

