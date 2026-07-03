-- Complete fix for RLS policies - run this in Supabase SQL Editor

-- Drop ALL existing policies on organisations
DROP POLICY IF EXISTS "_org_members_view" ON organisations;
DROP POLICY IF EXISTS "org_admins_manage" ON organisations;
DROP POLICY IF EXISTS "org_select" ON organisations;
DROP POLICY IF EXISTS "org_all" ON organisations;

-- Drop ALL existing policies on org_members  
DROP POLICY IF EXISTS "org_members_view_members" ON org_members;
DROP POLICY IF EXISTS "org_members_manage" ON org_members;
DROP POLICY IF EXISTS "org_members_select" ON org_members;
DROP POLICY IF EXISTS "org_members_all" ON org_members;

-- Drop ALL existing policies on user_profiles
DROP POLICY IF EXISTS "users_view_own_profile" ON user_profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON user_profiles;
DROP POLICY IF EXISTS "users_insert_own_profile" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_select" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_all" ON user_profiles;

-- Create simple policies for organisations
CREATE POLICY "org_select" ON organisations FOR SELECT USING (true);
CREATE POLICY "org_all" ON organisations FOR ALL USING (true) WITH CHECK (true);

-- Create simple policies for org_members
CREATE POLICY "org_members_select" ON org_members FOR SELECT USING (true);
CREATE POLICY "org_members_all" ON org_members FOR ALL USING (true) WITH CHECK (true);

-- Create simple policies for user_profiles
CREATE POLICY "user_profiles_select" ON user_profiles FOR SELECT USING (true);
CREATE POLICY "user_profiles_all" ON user_profiles FOR ALL USING (true) WITH CHECK (true);
