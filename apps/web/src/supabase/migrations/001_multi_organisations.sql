-- Multi-Organization Support Migration
-- Add support for users to belong to multiple organizations
-- Add invitation system and enhanced RBAC

-- Create invitations table for organization invites
CREATE TABLE IF NOT EXISTS invitations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    invited_by_user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
    accepted_at TIMESTAMP WITH TIME ZONE,
    accepted_by_user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE
);

-- Create user_organisations junction table for multi-org support
CREATE TABLE IF NOT EXISTS user_organisations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'manager', 'member', 'viewer')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by_user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    is_default BOOLEAN DEFAULT false,
    trial_ends_at TIMESTAMP WITH TIME ZONE
);

-- Update organisations table with trial management
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS trial_period_days INTEGER DEFAULT 30;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS is_trial BOOLEAN DEFAULT false;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS max_users INTEGER DEFAULT 10;

-- Update org_members table with enhanced status
ALTER TABLE org_members ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}';
ALTER TABLE org_members ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations(status);
CREATE INDEX IF NOT EXISTS idx_user_organisations_user_id ON user_organisations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_organisations_org_id ON user_organisations(organisation_id);
CREATE INDEX IF NOT EXISTS idx_user_organisations_status ON user_organisations(status);

-- Security definer function to check if user is admin (bypasses RLS)
CREATE OR REPLACE FUNCTION is_org_admin(user_id UUID, organisation_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM user_organisations 
        WHERE user_organisations.user_id = is_org_admin.user_id
        AND user_organisations.organisation_id = is_org_admin.organisation_id
        AND user_organisations.role = 'admin'
        AND user_organisations.status = 'active'
    );
$$ LANGUAGE SQL SECURITY DEFINER;

-- Row Level Security (RLS) Policies
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own invitations" ON invitations;
DROP POLICY IF EXISTS "Users can view own organisations" ON user_organisations;
DROP POLICY IF EXISTS "Admins can manage invitations" ON invitations;
DROP POLICY IF EXISTS "Admins can manage memberships" ON user_organisations;

-- Users can only see their own invitations
CREATE POLICY "Users can view own invitations" ON invitations
    FOR SELECT USING (auth.uid() = invited_by_user_id);

-- Users can only see their own organization memberships
CREATE POLICY "Users can view own organisations" ON user_organisations
    FOR SELECT USING (auth.uid() = user_id);

-- Organization admins can manage invitations
CREATE POLICY "Admins can manage invitations" ON invitations
    FOR ALL USING (
        is_org_admin(auth.uid(), invitations.organisation_id)
    );

-- Organization admins can manage memberships
CREATE POLICY "Admins can manage memberships" ON user_organisations
    FOR ALL USING (
        is_org_admin(auth.uid(), user_organisations.organisation_id)
    );
