-- Migration: 20260921010000_channel_management_rpcs.sql
-- Channel management RPCs with RBAC checks
--
-- 1. clear_channel_messages - Delete all messages in a channel (admin/owner only)
-- 2. leave_channel - Remove current user from channel members
-- 3. archive_channel - Soft delete/archive a channel (owner only)

-- ============================================================================
-- 1. CLEAR CHANNEL MESSAGES
-- ============================================================================
-- Deletes all messages in a channel. Only channel admins/owners can do this.
-- This is a destructive action that cannot be undone.

CREATE OR REPLACE FUNCTION public.clear_channel_messages(p_channel_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Must be channel admin or owner
  IF NOT public.user_is_channel_admin(p_channel_id) THEN
    RAISE EXCEPTION 'forbidden: only channel admins can clear messages';
  END IF;

  -- Delete all messages in the channel
  DELETE FROM public.project_collaboration_messages
  WHERE channel_id = p_channel_id;

  -- Delete all reactions on those messages
  DELETE FROM public.project_collaboration_reactions
  WHERE message_id IN (
    SELECT id FROM public.project_collaboration_messages
    WHERE channel_id = p_channel_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.clear_channel_messages(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.clear_channel_messages(uuid) TO authenticated;

-- ============================================================================
-- 2. LEAVE CHANNEL
-- ============================================================================
-- Removes the current user from a channel. Cannot leave if you're the only owner.

CREATE OR REPLACE FUNCTION public.leave_channel(p_channel_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_member_role text;
  v_owner_count int;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Check if user is a member
  SELECT role INTO v_member_role
  FROM public.project_collaboration_members
  WHERE channel_id = p_channel_id AND user_id = v_user_id;

  IF v_member_role IS NULL THEN
    RAISE EXCEPTION 'not_a_member';
  END IF;

  -- If user is owner, check if there are other owners
  IF v_member_role = 'owner' THEN
    SELECT count(*) INTO v_owner_count
    FROM public.project_collaboration_members
    WHERE channel_id = p_channel_id AND role = 'owner';

    IF v_owner_count <= 1 THEN
      RAISE EXCEPTION 'cannot_leave: you are the only owner. Transfer ownership or delete the channel.';
    END IF;
  END IF;

  -- Remove the user from the channel
  DELETE FROM public.project_collaboration_members
  WHERE channel_id = p_channel_id AND user_id = v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.leave_channel(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.leave_channel(uuid) TO authenticated;

-- ============================================================================
-- 3. ARCHIVE CHANNEL
-- ============================================================================
-- Soft deletes/archives a channel. Only the channel owner can do this.

CREATE OR REPLACE FUNCTION public.archive_channel(p_channel_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_member_role text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Check if user is the owner
  SELECT role INTO v_member_role
  FROM public.project_collaboration_members
  WHERE channel_id = p_channel_id AND user_id = v_user_id;

  IF v_member_role IS NULL OR v_member_role != 'owner' THEN
    RAISE EXCEPTION 'forbidden: only the channel owner can delete the channel';
  END IF;

  -- Archive the channel (soft delete)
  UPDATE public.project_collaboration_channels
  SET is_archived = true, updated_at = now()
  WHERE id = p_channel_id;
END;
$$;

REVOKE ALL ON FUNCTION public.archive_channel(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.archive_channel(uuid) TO authenticated;
