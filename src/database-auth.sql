-- Multi-Organisation & Auth Setup Script
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ORGANISATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS organisations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  logo_url TEXT,
  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(255),
  gstin VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- USER PROFILES TABLE (links to auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name VARCHAR(255),
  phone VARCHAR(50),
  role VARCHAR(50) DEFAULT 'member',
  avatar_url TEXT,
  email_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ORGANISATION MEMBERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS org_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'member',
  status VARCHAR(20) DEFAULT 'active',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organisation_id, user_id)
);

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================
ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Drop existing policies first (to allow re-running)
DROP POLICY IF EXISTS "_org_members_view" ON organisations;
DROP POLICY IF EXISTS "org_admins_manage" ON organisations;
DROP POLICY IF EXISTS "users_view_own_profile" ON user_profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON user_profiles;
DROP POLICY IF EXISTS "users_insert_own_profile" ON user_profiles;
DROP POLICY IF EXISTS "org_members_view_members" ON org_members;
DROP POLICY IF EXISTS "org_members_manage" ON org_members;

-- Organisations - members can view their org
CREATE POLICY "_org_members_view" ON organisations
  FOR SELECT USING (
    id IN (SELECT organisation_id FROM org_members WHERE user_id = auth.uid())
  );

CREATE POLICY "org_admins_manage" ON organisations
  FOR ALL USING (
    id IN (
      SELECT organisation_id FROM org_members 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- User Profiles - users can view/update their own profile
CREATE POLICY "users_view_own_profile" ON user_profiles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "users_update_own_profile" ON user_profiles
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "users_insert_own_profile" ON user_profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Org Members - members can view their org members
CREATE POLICY "org_members_view_members" ON org_members
  FOR SELECT USING (
    organisation_id IN (
      SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "org_members_manage" ON org_members
  FOR ALL USING (
    organisation_id IN (
      SELECT organisation_id FROM org_members 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- TRIGGER TO CREATE USER PROFILE ON SIGNUP
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, full_name, email_verified)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.email_confirmed_at IS NOT NULL
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- FUNCTION TO CREATE ORGANISATION & SET ADMIN
-- ============================================
CREATE OR REPLACE FUNCTION public.create_organisation_with_admin(
  org_name VARCHAR,
  user_id UUID
)
RETURNS UUID AS $$
DECLARE
  org_id UUID;
BEGIN
  -- Create organisation
  INSERT INTO organisations (name)
  VALUES (org_name)
  RETURNING id INTO org_id;

  -- Add user as admin member
  INSERT INTO org_members (organisation_id, user_id, role)
  VALUES (org_id, user_id, 'admin');

  -- Update user profile role
  UPDATE user_profiles SET role = 'admin' WHERE user_id = user_id;

  RETURN org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- INDEXES
-- ============================================
DROP INDEX IF EXISTS idx_org_members_org;
DROP INDEX IF EXISTS idx_org_members_user;
DROP INDEX IF EXISTS idx_user_profiles_email;

CREATE INDEX idx_org_members_org ON org_members(organisation_id);
CREATE INDEX idx_org_members_user ON org_members(user_id);
CREATE INDEX idx_user_profiles_email ON user_profiles(user_id);

-- ============================================
-- STORAGE BUCKET FOR AVATARS
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT DO NOTHING;

-- Drop existing storage policies
DROP POLICY IF EXISTS "Avatar owners can upload" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;

CREATE POLICY "Avatar owners can upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid() = owner);

CREATE POLICY "Anyone can view avatars" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

-- ============================================
-- DEFAULT ADMIN USER (for testing - change email)
-- ============================================
-- NOTE: Create your first admin user via Sign Up in the app
