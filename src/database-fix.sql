-- Run this in Supabase SQL Editor to fix existing setup

-- Drop existing policies
DROP POLICY IF EXISTS "_org_members_view" ON organisations;
DROP POLICY IF EXISTS "org_admins_manage" ON organisations;
DROP POLICY IF EXISTS "users_view_own_profile" ON user_profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON user_profiles;
DROP POLICY IF EXISTS "users_insert_own_profile" ON user_profiles;
DROP POLICY IF EXISTS "org_members_view_members" ON org_members;
DROP POLICY IF EXISTS "org_members_manage" ON org_members;

-- Create policies (will work if tables exist)
CREATE POLICY "_org_members_view" ON organisations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "org_admins_manage" ON organisations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "users_view_own_profile" ON user_profiles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "users_update_own_profile" ON user_profiles
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "users_insert_own_profile" ON user_profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "org_members_view_members" ON org_members
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "org_members_manage" ON org_members
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create or replace the function
DROP FUNCTION IF EXISTS public.create_organisation_with_admin(VARCHAR, UUID);
CREATE OR REPLACE FUNCTION public.create_organisation_with_admin(
  org_name VARCHAR,
  p_user_id UUID
)
RETURNS UUID AS $$
DECLARE
  org_id UUID;
BEGIN
  INSERT INTO organisations (name)
  VALUES (org_name)
  RETURNING id INTO org_id;

  INSERT INTO org_members (organisation_id, user_id, role)
  VALUES (org_id, p_user_id, 'admin');

  UPDATE user_profiles SET role = 'admin' WHERE user_id = p_user_id;

  RETURN org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
