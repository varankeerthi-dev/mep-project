-- ============================================================
-- Migration: create approval_settings table
-- Run this once in Supabase SQL editor to fix PGRST205 404
-- on /rest/v1/approval_settings
-- ============================================================

CREATE TABLE IF NOT EXISTS approval_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_key VARCHAR(100) NOT NULL,
    setting_value TEXT NOT NULL,
    description TEXT,
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (organisation_id, setting_key)
);

CREATE INDEX IF NOT EXISTS idx_approval_settings_organisation_id
    ON approval_settings(organisation_id);

ALTER TABLE approval_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "approval_settings_users_view_org" ON approval_settings;
CREATE POLICY "approval_settings_users_view_org" ON approval_settings
    FOR SELECT USING (
        organisation_id IN (
            SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "approval_settings_admins_manage_org" ON approval_settings;
CREATE POLICY "approval_settings_admins_manage_org" ON approval_settings
    FOR ALL USING (
        organisation_id IN (
            SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid()
        )
    );

NOTIFY pgrst, 'reload schema';
