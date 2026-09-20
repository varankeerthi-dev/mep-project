-- Migration: 20260920000000_company_collaboration_channels.sql
-- Enables collaboration channels at the organization level (Company Channels)
-- Allows project_id to be NULL without breaking existing project channels.

-- 1. Allow project_id to be NULL in project_collaboration_channels
ALTER TABLE public.project_collaboration_channels
  ALTER COLUMN project_id DROP NOT NULL;

-- 2. Allow project_id to be NULL in task_channel_links for company-channel tasks
ALTER TABLE public.task_channel_links
  ALTER COLUMN project_id DROP NOT NULL;

-- 3. Extend channel_type CHECK constraint to include 'general' and 'company'
ALTER TABLE public.project_collaboration_channels
  DROP CONSTRAINT IF EXISTS project_collaboration_channels_channel_type_check;

ALTER TABLE public.project_collaboration_channels
  ADD CONSTRAINT project_collaboration_channels_channel_type_check
  CHECK (channel_type = ANY (ARRAY[
    'general'::text,
    'company'::text,
    'project'::text,
    'site_coordination'::text,
    'design'::text,
    'procurement'::text,
    'commercial'::text,
    'custom'::text
  ]));

-- 4. Ensure at most one canonical #general channel per organisation
CREATE UNIQUE INDEX IF NOT EXISTS uq_collab_channels_general
  ON public.project_collaboration_channels (organisation_id)
  WHERE (channel_type = 'general' AND project_id IS NULL);

-- 5. Hardened RPC: get_or_create_company_channel
CREATE OR REPLACE FUNCTION public.get_or_create_company_channel(
  p_organisation_id uuid,
  p_channel_name text DEFAULT 'general'
)
RETURNS public.project_collaboration_channels
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_channel public.project_collaboration_channels;
  v_name text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Verify caller is active member of organisation
  IF NOT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE organisation_id = p_organisation_id
      AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_name := COALESCE(NULLIF(trim(p_channel_name), ''), 'general');

  -- Advisory lock to prevent race conditions during channel creation
  PERFORM pg_advisory_xact_lock(hashtext('collab_org:' || p_organisation_id::text || ':' || lower(v_name)));

  -- Find existing company channel (project_id IS NULL) with matching name
  SELECT * INTO v_channel
  FROM public.project_collaboration_channels
  WHERE organisation_id = p_organisation_id
    AND project_id IS NULL
    AND lower(name) = lower(v_name);

  IF NOT FOUND THEN
    INSERT INTO public.project_collaboration_channels (
      organisation_id,
      project_id,
      channel_type,
      name,
      created_by
    )
    VALUES (
      p_organisation_id,
      NULL,
      'general',
      v_name,
      v_user_id
    )
    RETURNING * INTO v_channel;
  END IF;

  -- Ensure all active org members have access to the company channel
  INSERT INTO public.project_collaboration_members (organisation_id, channel_id, user_id, role)
  SELECT p_organisation_id, v_channel.id, om.user_id, 'member'
  FROM public.org_members om
  WHERE om.organisation_id = p_organisation_id
    AND om.status = 'active'
  ON CONFLICT (channel_id, user_id) DO NOTHING;

  -- Ensure caller specifically has membership
  INSERT INTO public.project_collaboration_members (organisation_id, channel_id, user_id, role)
  VALUES (p_organisation_id, v_channel.id, v_user_id, 'member')
  ON CONFLICT (channel_id, user_id) DO NOTHING;

  RETURN v_channel;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_company_channel(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_company_channel(uuid, text) TO authenticated;

-- 6. Update post_task_channel_card to support nullable project_id
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
  v_task_label text;
  v_eff_proj_id uuid;
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

  v_eff_proj_id := COALESCE(p_project_id, v_channel.project_id);

  INSERT INTO public.task_channel_links
    (task_id, organisation_id, project_id, channel_id, message_id)
  VALUES
    (v_task.id, v_channel.organisation_id, v_eff_proj_id, v_channel.id, v_msg.id);

  RETURN v_msg;
END;
$$;

REVOKE ALL ON FUNCTION public.post_task_channel_card(uuid, uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.post_task_channel_card(uuid, uuid, uuid) TO authenticated;
