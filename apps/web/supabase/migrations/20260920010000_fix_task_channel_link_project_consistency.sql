-- Migration: 20260920010000_fix_task_channel_link_project_consistency.sql
-- Fix FAIL-TCL-01: Enforce task/channel project consistency in post_task_channel_card
--
-- Invariants enforced:
-- 1. Organisation boundary: v_task.organisation_id = v_channel.organisation_id
-- 2. Client parameter guard: if p_project_id is provided, it cannot contradict v_channel.project_id
-- 3. Project boundary: v_task.project_id IS NOT DISTINCT FROM v_channel.project_id
--    - Company channel (channel.project_id IS NULL) -> task.project_id MUST be NULL
--    - Project channel (channel.project_id = X) -> task.project_id MUST be X
-- 4. Authoritative link insert: task_channel_links.project_id = v_channel.project_id (never untrusted client input)

CREATE OR REPLACE FUNCTION public.post_task_channel_card(
  p_project_id uuid,
  p_channel_id uuid,
  p_task_id uuid
)
RETURNS public.project_collaboration_messages
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
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
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- 1. Fetch task
  SELECT * INTO v_task
  FROM public.tasks
  WHERE id = p_task_id;

  IF v_task IS NULL THEN
    RAISE EXCEPTION 'task_not_found';
  END IF;

  -- 2. Fetch channel
  SELECT * INTO v_channel
  FROM public.project_collaboration_channels
  WHERE id = p_channel_id;

  IF v_channel IS NULL THEN
    RAISE EXCEPTION 'channel_not_found';
  END IF;

  -- 3. Validate organization consistency
  IF v_task.organisation_id <> v_channel.organisation_id THEN
    RAISE EXCEPTION 'cross_org_mismatch';
  END IF;

  -- 4. Validate client p_project_id parameter manipulation guard
  -- If client passes p_project_id, it must not contradict the authoritative channel project
  IF p_project_id IS NOT NULL AND p_project_id IS DISTINCT FROM v_channel.project_id THEN
    RAISE EXCEPTION 'cross_project_mismatch';
  END IF;

  -- 5. Validate task and channel project context consistency
  IF v_task.project_id IS DISTINCT FROM v_channel.project_id THEN
    IF v_channel.project_id IS NULL THEN
      RAISE EXCEPTION 'company_channel_project_task_mismatch';
    ELSE
      RAISE EXCEPTION 'cross_project_mismatch';
    END IF;
  END IF;

  -- 6. Check if already linked to this channel (idempotency)
  SELECT message_id INTO v_existing_msg_id
  FROM public.task_channel_links
  WHERE task_id = p_task_id AND channel_id = p_channel_id;

  IF v_existing_msg_id IS NOT NULL THEN
    SELECT * INTO v_msg
    FROM public.project_collaboration_messages
    WHERE id = v_existing_msg_id;
    RETURN v_msg;
  END IF;

  -- 7. Build card metadata
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

  -- 8. Insert authoritative system message
  INSERT INTO public.project_collaboration_messages (
    organisation_id, channel_id, sender_id, message_type, content, metadata
  )
  VALUES (
    v_channel.organisation_id, v_channel.id, v_user_id,
    'system', 'Created task: ' || v_task_title, v_metadata
  )
  RETURNING * INTO v_msg;

  -- 9. Insert link using authoritative channel project context
  INSERT INTO public.task_channel_links
    (task_id, organisation_id, project_id, channel_id, message_id)
  VALUES
    (v_task.id, v_channel.organisation_id, v_channel.project_id, v_channel.id, v_msg.id);

  RETURN v_msg;
END;
$$;

REVOKE ALL ON FUNCTION public.post_task_channel_card(uuid, uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.post_task_channel_card(uuid, uuid, uuid) TO authenticated;
