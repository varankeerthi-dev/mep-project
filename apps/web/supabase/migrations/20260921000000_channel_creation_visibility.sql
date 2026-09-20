-- Migration: 20260921000000_channel_creation_visibility.sql
-- User-created company channels.
--
-- Adds the metadata needed by the "Create channel" dialog, name uniqueness that
-- ignores separators/case, an e-mail invitation list, and the RPC that creates a
-- channel atomically.
--
-- Visibility model (existing rows default to today's behaviour — nothing changes
-- for channels that already exist):
--   visibility = 'company'        the channel row is listed for every org member
--   visibility = 'private'        the channel row is visible only to its members
--   join_policy = 'all'           every active org member may read and post
--   join_policy = 'invite_only'   only invited people may read and post
-- A private channel is always invite_only (enforced in the RPC).
--
-- Name uniqueness: "Sales Chennai", "sales-chennai" and "Sales_Chennai" all
-- normalize to "saleschennai" and collide.

-- ============================================================================
-- 1. CHANNEL METADATA
-- ============================================================================

ALTER TABLE public.project_collaboration_channels
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'company';

ALTER TABLE public.project_collaboration_channels
  ADD COLUMN IF NOT EXISTS join_policy text NOT NULL DEFAULT 'all';

-- Normalized name, used for uniqueness. Generated so it can never drift.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'project_collaboration_channels'
      AND column_name = 'name_normalized'
  ) THEN
    ALTER TABLE public.project_collaboration_channels
      ADD COLUMN name_normalized text
      GENERATED ALWAYS AS (lower(regexp_replace(name, '[^a-zA-Z0-9]+', '', 'g'))) STORED;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pcc_visibility_check'
  ) THEN
    ALTER TABLE public.project_collaboration_channels
      ADD CONSTRAINT pcc_visibility_check CHECK (visibility IN ('company', 'private'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pcc_join_policy_check'
  ) THEN
    ALTER TABLE public.project_collaboration_channels
      ADD CONSTRAINT pcc_join_policy_check CHECK (join_policy IN ('all', 'invite_only'));
  END IF;
END $$;

-- Fail loudly (instead of a cryptic unique violation) if existing company
-- channels already collide under the normalization rule.
DO $$
DECLARE
  v_dupes int;
BEGIN
  SELECT count(*) INTO v_dupes FROM (
    SELECT organisation_id, name_normalized
    FROM public.project_collaboration_channels
    WHERE project_id IS NULL AND is_archived = false
    GROUP BY organisation_id, name_normalized
    HAVING count(*) > 1
  ) d;

  IF v_dupes > 0 THEN
    RAISE EXCEPTION
      'channel_name_collision: % normalized company-channel name(s) are duplicated within an organisation; rename them before applying',
      v_dupes;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_collab_channels_name_norm
  ON public.project_collaboration_channels (organisation_id, name_normalized)
  WHERE project_id IS NULL AND is_archived = false;

-- ============================================================================
-- 2. CHANNEL INVITATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.channel_invitations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  channel_id      uuid NOT NULL REFERENCES public.project_collaboration_channels(id) ON DELETE CASCADE,
  email           text NOT NULL,
  invited_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  role            text NOT NULL DEFAULT 'member',
  status          text NOT NULL DEFAULT 'pending',
  invited_by      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accepted_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT channel_invitations_role_check CHECK (role IN ('owner', 'admin', 'member', 'guest')),
  CONSTRAINT channel_invitations_status_check CHECK (status IN ('pending', 'accepted', 'revoked')),
  CONSTRAINT channel_invitations_email_check CHECK (email = lower(btrim(email)) AND position('@' in email) > 1)
);

-- One invitation per address per channel.
CREATE UNIQUE INDEX IF NOT EXISTS uq_channel_invitations_channel_email
  ON public.channel_invitations (channel_id, email);

CREATE INDEX IF NOT EXISTS idx_channel_invitations_channel
  ON public.channel_invitations (channel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_channel_invitations_invitee
  ON public.channel_invitations (invited_user_id)
  WHERE invited_user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.touch_channel_invitations_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_channel_invitations_updated_at ON public.channel_invitations;
CREATE TRIGGER trg_channel_invitations_updated_at
  BEFORE UPDATE ON public.channel_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_channel_invitations_updated_at();

-- ============================================================================
-- 3. ACCESS HELPERS
-- ============================================================================
-- SECURITY DEFINER so policies can consult membership without recursing into
-- the RLS of the tables they read. They take the caller from auth.uid(), never
-- from an argument, so they cannot be used to probe another user's access.

-- Can the caller see that the channel exists?
CREATE OR REPLACE FUNCTION public.user_can_see_channel(p_channel_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_collaboration_channels c
    WHERE c.id = p_channel_id
      AND c.organisation_id IN (
        SELECT om.organisation_id FROM public.org_members om
        WHERE om.user_id = auth.uid()
      )
      AND (
        c.visibility = 'company'
        OR EXISTS (
          SELECT 1 FROM public.project_collaboration_members m
          WHERE m.channel_id = c.id AND m.user_id = auth.uid()
        )
      )
  );
$$;

-- Is the caller a member of this channel?
CREATE OR REPLACE FUNCTION public.user_is_channel_member(p_channel_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_collaboration_members m
    WHERE m.channel_id = p_channel_id AND m.user_id = auth.uid()
  );
$$;

-- May the caller read and post messages in this channel?
CREATE OR REPLACE FUNCTION public.user_can_access_channel(p_channel_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_collaboration_channels c
    WHERE c.id = p_channel_id
      AND public.user_can_see_channel(c.id)
      AND (
        (c.visibility = 'company' AND c.join_policy = 'all')
        OR public.user_is_channel_member(c.id)
      )
  );
$$;

-- Owner/admin of this channel (may invite, rename, archive).
CREATE OR REPLACE FUNCTION public.user_is_channel_admin(p_channel_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_collaboration_members m
    WHERE m.channel_id = p_channel_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'admin')
  );
$$;

REVOKE ALL ON FUNCTION public.user_can_see_channel(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.user_is_channel_member(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.user_can_access_channel(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.user_is_channel_admin(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.user_can_see_channel(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_channel_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_access_channel(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_channel_admin(uuid) TO authenticated;

-- ============================================================================
-- 4. RLS — channels and messages respect the visibility model
-- ============================================================================
-- The policies on these two tables were created outside this repository, so
-- their names are not knowable here. Postgres OR-s policies together, so simply
-- adding restrictive ones would leave any broader pre-existing policy in force —
-- a private channel would still be readable by everyone. The read/write policies
-- are therefore enumerated from the catalogue and replaced. Policies that exist
-- only for service_role are left alone (that role bypasses RLS anyway).
--
-- Every pre-existing channel is visibility='company', join_policy='all', so for
-- existing data these policies evaluate exactly as the previous organisation-
-- wide ones did.

DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'project_collaboration_channels'
      AND cmd IN ('SELECT', 'ALL')
      AND NOT (roles = ARRAY['service_role']::name[])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.project_collaboration_channels', p.policyname);
  END LOOP;

  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'project_collaboration_messages'
      AND cmd IN ('SELECT', 'INSERT', 'ALL')
      AND NOT (roles = ARRAY['service_role']::name[])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.project_collaboration_messages', p.policyname);
  END LOOP;
END $$;

ALTER TABLE public.project_collaboration_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_collaboration_messages ENABLE ROW LEVEL SECURITY;

-- See it / read it: the row is listed only if the caller may see the channel.
DROP POLICY IF EXISTS p_collab_channels_sel ON public.project_collaboration_channels;
CREATE POLICY p_collab_channels_sel ON public.project_collaboration_channels
  FOR SELECT TO authenticated
  USING (public.user_can_see_channel(id));

-- Rename / archive stays with the channel owner or admins.
DROP POLICY IF EXISTS p_collab_channels_upd ON public.project_collaboration_channels;
CREATE POLICY p_collab_channels_upd ON public.project_collaboration_channels
  FOR UPDATE TO authenticated
  USING (public.user_is_channel_admin(id))
  WITH CHECK (public.user_is_channel_admin(id));

-- Read and post both require access to the channel. The insert rule keeps the
-- direct-insert path honest (post_task_channel_card() is SECURITY INVOKER and
-- writes sender_id = auth.uid()).
DROP POLICY IF EXISTS p_collab_messages_sel ON public.project_collaboration_messages;
CREATE POLICY p_collab_messages_sel ON public.project_collaboration_messages
  FOR SELECT TO authenticated
  USING (public.user_can_access_channel(channel_id));

DROP POLICY IF EXISTS p_collab_messages_ins ON public.project_collaboration_messages;
CREATE POLICY p_collab_messages_ins ON public.project_collaboration_messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.user_can_access_channel(channel_id));

DROP POLICY IF EXISTS p_collab_messages_upd ON public.project_collaboration_messages;
CREATE POLICY p_collab_messages_upd ON public.project_collaboration_messages
  FOR UPDATE TO authenticated
  USING (sender_id = auth.uid() AND public.user_can_access_channel(channel_id))
  WITH CHECK (sender_id = auth.uid() AND public.user_can_access_channel(channel_id));

DROP POLICY IF EXISTS p_collab_messages_del ON public.project_collaboration_messages;
CREATE POLICY p_collab_messages_del ON public.project_collaboration_messages
  FOR DELETE TO authenticated
  USING (sender_id = auth.uid() AND public.user_can_access_channel(channel_id));

-- Nothing broader may have survived the sweep.
DO $$
DECLARE
  v_left int;
BEGIN
  SELECT count(*) INTO v_left FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'project_collaboration_channels'
    AND cmd IN ('SELECT', 'ALL')
    AND NOT (roles = ARRAY['service_role']::name[])
    AND policyname NOT IN ('p_collab_channels_sel', 'p_collab_channels_upd');
  IF v_left > 0 THEN
    RAISE EXCEPTION 'channel_policy_leftover: % unexpected SELECT policy/policies remain on project_collaboration_channels', v_left;
  END IF;

  SELECT count(*) INTO v_left FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'project_collaboration_messages'
    AND cmd IN ('SELECT', 'INSERT', 'ALL')
    AND NOT (roles = ARRAY['service_role']::name[])
    AND policyname NOT IN ('p_collab_messages_sel', 'p_collab_messages_ins', 'p_collab_messages_upd', 'p_collab_messages_del');
  IF v_left > 0 THEN
    RAISE EXCEPTION 'message_policy_leftover: % unexpected SELECT/INSERT policy/policies remain on project_collaboration_messages', v_left;
  END IF;
END $$;

ALTER TABLE public.channel_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS channel_invitations_select ON public.channel_invitations;
CREATE POLICY channel_invitations_select ON public.channel_invitations
  FOR SELECT TO authenticated
  USING (
    invited_by = auth.uid()
    OR invited_user_id = auth.uid()
    OR public.user_is_channel_admin(channel_id)
  );

DROP POLICY IF EXISTS channel_invitations_insert ON public.channel_invitations;
CREATE POLICY channel_invitations_insert ON public.channel_invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    invited_by = auth.uid()
    AND organisation_id IN (
      SELECT om.organisation_id FROM public.org_members om WHERE om.user_id = auth.uid()
    )
    AND public.user_is_channel_admin(channel_id)
  );

DROP POLICY IF EXISTS channel_invitations_update ON public.channel_invitations;
CREATE POLICY channel_invitations_update ON public.channel_invitations
  FOR UPDATE TO authenticated
  USING (invited_by = auth.uid() OR public.user_is_channel_admin(channel_id))
  WITH CHECK (invited_by = auth.uid() OR public.user_is_channel_admin(channel_id));

DROP POLICY IF EXISTS channel_invitations_delete ON public.channel_invitations;
CREATE POLICY channel_invitations_delete ON public.channel_invitations
  FOR DELETE TO authenticated
  USING (invited_by = auth.uid() OR public.user_is_channel_admin(channel_id));

-- ============================================================================
-- 5. CREATE CHANNEL RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_company_channel(
  p_organisation_id uuid,
  p_name text,
  p_description text DEFAULT NULL,
  p_visibility text DEFAULT 'company',
  p_join_policy text DEFAULT 'all',
  p_invite_emails text[] DEFAULT '{}'::text[]
)
RETURNS public.project_collaboration_channels
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id      uuid := auth.uid();
  v_name         text;
  v_norm         text;
  v_visibility   text;
  v_join_policy  text;
  v_channel      public.project_collaboration_channels;
  v_email        text;
  v_invitee      uuid;
  v_invited      int := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE organisation_id = p_organisation_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- ---- name ------------------------------------------------------------
  v_name := btrim(COALESCE(p_name, ''));
  IF char_length(v_name) < 2 THEN
    RAISE EXCEPTION 'channel_name_too_short';
  END IF;
  IF char_length(v_name) > 80 THEN
    RAISE EXCEPTION 'channel_name_too_long';
  END IF;
  IF v_name ~ '[^A-Za-z0-9 ._-]' THEN
    RAISE EXCEPTION 'channel_name_invalid_characters';
  END IF;

  v_norm := regexp_replace(lower(v_name), '[^a-z0-9]+', '', 'g');
  IF v_norm = '' THEN
    RAISE EXCEPTION 'channel_name_invalid';
  END IF;

  -- ---- visibility ------------------------------------------------------
  v_visibility := lower(COALESCE(NULLIF(btrim(p_visibility), ''), 'company'));
  IF v_visibility NOT IN ('company', 'private') THEN
    RAISE EXCEPTION 'invalid_visibility';
  END IF;

  v_join_policy := lower(COALESCE(NULLIF(btrim(p_join_policy), ''), 'all'));
  IF v_join_policy NOT IN ('all', 'invite_only') THEN
    RAISE EXCEPTION 'invalid_join_policy';
  END IF;

  -- A private channel is invite-only by definition.
  IF v_visibility = 'private' THEN
    v_join_policy := 'invite_only';
  END IF;

  -- ---- uniqueness (serialised per org+normalized name) -----------------
  PERFORM pg_advisory_xact_lock(
    hashtext('collab_org:' || p_organisation_id::text || ':' || v_norm)
  );

  IF EXISTS (
    SELECT 1 FROM public.project_collaboration_channels c
    WHERE c.organisation_id = p_organisation_id
      AND c.project_id IS NULL
      AND c.name_normalized = v_norm
  ) THEN
    RAISE EXCEPTION 'channel_name_exists';
  END IF;

  -- ---- create ----------------------------------------------------------
  INSERT INTO public.project_collaboration_channels (
    organisation_id, project_id, channel_type, name, description,
    visibility, join_policy, created_by
  )
  VALUES (
    p_organisation_id,
    NULL,
    CASE WHEN v_visibility = 'company' THEN 'company' ELSE 'custom' END,
    v_name,
    NULLIF(btrim(COALESCE(p_description, '')), ''),
    v_visibility,
    v_join_policy,
    v_user_id
  )
  RETURNING * INTO v_channel;

  -- Creator owns the channel.
  INSERT INTO public.project_collaboration_members (organisation_id, channel_id, user_id, role)
  VALUES (p_organisation_id, v_channel.id, v_user_id, 'owner')
  ON CONFLICT (channel_id, user_id) DO UPDATE SET role = 'owner';

  -- Company + all -> everyone in the organisation is a member.
  IF v_visibility = 'company' AND v_join_policy = 'all' THEN
    INSERT INTO public.project_collaboration_members (organisation_id, channel_id, user_id, role)
    SELECT p_organisation_id, v_channel.id, om.user_id, 'member'
    FROM public.org_members om
    WHERE om.organisation_id = p_organisation_id
    ON CONFLICT (channel_id, user_id) DO NOTHING;
  END IF;

  -- ---- invitations -----------------------------------------------------
  IF p_invite_emails IS NOT NULL THEN
    FOR v_email IN
      SELECT DISTINCT lower(btrim(e))
      FROM unnest(p_invite_emails) AS e
      WHERE btrim(e) <> ''
    LOOP
      IF v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
        RAISE EXCEPTION 'invalid_invite_email: %', v_email;
      END IF;

      -- Employees of this organisation resolve to a user; any other address is
      -- kept as a pending external invitation.
      SELECT up.user_id INTO v_invitee
      FROM public.user_profiles up
      JOIN public.org_members om
        ON om.user_id = up.user_id
       AND om.organisation_id = p_organisation_id
      WHERE lower(up.email) = v_email
      LIMIT 1;

      INSERT INTO public.channel_invitations (
        organisation_id, channel_id, email, invited_user_id, invited_by
      )
      VALUES (
        p_organisation_id, v_channel.id, v_email, v_invitee, v_user_id
      )
      ON CONFLICT (channel_id, email) DO NOTHING;

      v_invited := v_invited + 1;

      IF v_invitee IS NOT NULL THEN
        INSERT INTO public.project_collaboration_members (organisation_id, channel_id, user_id, role)
        VALUES (p_organisation_id, v_channel.id, v_invitee, 'member')
        ON CONFLICT (channel_id, user_id) DO NOTHING;

        INSERT INTO public.notifications (user_id, organisation_id, title, body, link)
        VALUES (
          v_invitee,
          p_organisation_id,
          'Added to #' || v_channel.name,
          COALESCE(v_channel.description, 'You were added to a collaboration channel.'),
          '/collaboration?tab=collaboration&channel=' || v_channel.name
        );
      END IF;
    END LOOP;
  END IF;

  RETURN v_channel;
END;
$$;

REVOKE ALL ON FUNCTION public.create_company_channel(uuid, text, text, text, text, text[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_company_channel(uuid, text, text, text, text, text[]) TO authenticated;

-- ============================================================================
-- 6. get_or_create_company_channel — normalized lookup, correct type
-- ============================================================================
-- The rail resolves a channel by name on every render. It must not be able to
-- mint a second row that violates uq_collab_channels_general, so only the literal
-- name "general" keeps the 'general' type; anything else resolves/creates as a
-- 'company' channel using the same normalization as create_company_channel.

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
  v_name    text;
  v_norm    text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE organisation_id = p_organisation_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_name := COALESCE(NULLIF(btrim(p_channel_name), ''), 'general');
  v_norm := regexp_replace(lower(v_name), '[^a-z0-9]+', '', 'g');
  IF v_norm = '' THEN
    v_norm := 'general';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext('collab_org:' || p_organisation_id::text || ':' || v_norm)
  );

  SELECT * INTO v_channel
  FROM public.project_collaboration_channels
  WHERE organisation_id = p_organisation_id
    AND project_id IS NULL
    AND name_normalized = v_norm;

  IF NOT FOUND THEN
    -- Only the canonical #general channel is minted implicitly. Every other
    -- channel comes from create_company_channel, so a channel name arriving
    -- from the URL (or anywhere else) cannot invent a channel.
    IF v_norm <> 'general' THEN
      RAISE EXCEPTION 'channel_not_found';
    END IF;

    INSERT INTO public.project_collaboration_channels (
      organisation_id, project_id, channel_type, name,
      visibility, join_policy, created_by
    )
    VALUES (
      p_organisation_id,
      NULL,
      'general',
      v_name,
      'company',
      'all',
      v_user_id
    )
    RETURNING * INTO v_channel;
  END IF;

  -- Private and invite-only channels are not self-service: resolving one you
  -- are not a member of must fail, otherwise this SECURITY DEFINER lookup would
  -- be a way into any private channel by name.
  IF NOT (v_channel.visibility = 'company' AND v_channel.join_policy = 'all') THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.project_collaboration_members m
      WHERE m.channel_id = v_channel.id AND m.user_id = v_user_id
    ) THEN
      RAISE EXCEPTION 'forbidden';
    END IF;

    RETURN v_channel;
  END IF;

  -- Company + all: ensure every active org member, and the caller, are members.
  INSERT INTO public.project_collaboration_members (organisation_id, channel_id, user_id, role)
  SELECT p_organisation_id, v_channel.id, om.user_id, 'member'
  FROM public.org_members om
  WHERE om.organisation_id = p_organisation_id
  ON CONFLICT (channel_id, user_id) DO NOTHING;

  INSERT INTO public.project_collaboration_members (organisation_id, channel_id, user_id, role)
  VALUES (p_organisation_id, v_channel.id, v_user_id, 'member')
  ON CONFLICT (channel_id, user_id) DO NOTHING;

  RETURN v_channel;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_company_channel(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_company_channel(uuid, text) TO authenticated;
