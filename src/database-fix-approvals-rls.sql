-- Fix approvals RLS: replace user_organisations (legacy/empty) with org_members
-- Run in Supabase SQL Editor
-- Idempotent: safe to re-run

-- ------------------------------------------------------------
-- 0. Helper: current_org_id() (idempotent)
-- Uses the canonical org_members table. Defined here as a
-- safety net — already exists if database-site-report-photos.sql
-- was run, this CREATE OR REPLACE just refreshes the body.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT organisation_id FROM public.org_members
  WHERE user_id = auth.uid()
    AND (status = 'active' OR status = 'Active' OR status IS NULL)
  ORDER BY joined_at DESC
  LIMIT 1
$$;

-- ------------------------------------------------------------
-- 1. approvals
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "approval_users_view_org_approvals" ON approvals;
DROP POLICY IF EXISTS "approval_users_create_org_approvals" ON approvals;

CREATE POLICY "approval_users_view_org_approvals" ON approvals
  FOR SELECT USING (organisation_id = public.current_org_id());

CREATE POLICY "approval_users_create_org_approvals" ON approvals
  FOR INSERT WITH CHECK (organisation_id = public.current_org_id());

-- ------------------------------------------------------------
-- 2. approval_actions
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "approval_actions_users_view_org_approvals" ON approval_actions;
DROP POLICY IF EXISTS "approval_actions_users_create_org_approvals" ON approval_actions;

CREATE POLICY "approval_actions_users_view_org_approvals" ON approval_actions
  FOR SELECT USING (organisation_id = public.current_org_id());

CREATE POLICY "approval_actions_users_create_org_approvals" ON approval_actions
  FOR INSERT WITH CHECK (organisation_id = public.current_org_id());

-- ------------------------------------------------------------
-- 3. approval_workflows
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "approval_workflows_users_view_org" ON approval_workflows;

CREATE POLICY "approval_workflows_users_view_org" ON approval_workflows
  FOR SELECT USING (organisation_id = public.current_org_id());

-- ------------------------------------------------------------
-- 4. approval_notifications
--    The 'own view' policy (user_id = auth.uid()) is left as-is
--    — it was already correct. Only the INSERT policy was broken.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "approval_notifications_users_create_org" ON approval_notifications;

CREATE POLICY "approval_notifications_users_create_org" ON approval_notifications
  FOR INSERT WITH CHECK (organisation_id = public.current_org_id());

-- ------------------------------------------------------------
-- 5. approval_approvers
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "approval_approvers_users_view_org" ON approval_approvers;
DROP POLICY IF EXISTS "approval_approvers_admins_manage_org" ON approval_approvers;

CREATE POLICY "approval_approvers_users_view_org" ON approval_approvers
  FOR SELECT USING (organisation_id = public.current_org_id());

CREATE POLICY "approval_approvers_admins_manage_org" ON approval_approvers
  FOR ALL USING (organisation_id = public.current_org_id())
  WITH CHECK (organisation_id = public.current_org_id());

-- ------------------------------------------------------------
-- 6. approval_settings
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "approval_settings_users_view_org" ON approval_settings;
DROP POLICY IF EXISTS "approval_settings_admins_manage_org" ON approval_settings;

CREATE POLICY "approval_settings_users_view_org" ON approval_settings
  FOR SELECT USING (organisation_id = public.current_org_id());

CREATE POLICY "approval_settings_admins_manage_org" ON approval_settings
  FOR ALL USING (organisation_id = public.current_org_id())
  WITH CHECK (organisation_id = public.current_org_id());
