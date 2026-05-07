-- Approval System Database Schema
-- Created: May 5, 2026
-- Purpose: Enterprise-level approval workflow system for Indian MEP/Construction

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Approvals Master Table
CREATE TABLE IF NOT EXISTS approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    approval_type VARCHAR(50) NOT NULL, -- PO, WO, QUOTE, INVOICE, PAYMENT_REQUEST, MATERIAL_DISPATCH, SITE_VISIT
    reference_id UUID NOT NULL, -- Reference to original document
    reference_type VARCHAR(50) NOT NULL, -- Table name of reference (purchase_orders, work_orders, etc.)
    title TEXT NOT NULL,
    description TEXT,
    amount DECIMAL(15,2),
    currency VARCHAR(3) DEFAULT 'INR',
    requested_by UUID NOT NULL REFERENCES users(id),
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    current_level INTEGER DEFAULT 1,
    max_levels INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'HOLD', 'FORWARDED')),
    priority VARCHAR(10) DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
    organisation_id UUID NOT NULL REFERENCES organisations(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Approval Workflow Levels
CREATE TABLE IF NOT EXISTS approval_workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    approval_type VARCHAR(50) NOT NULL,
    level INTEGER NOT NULL,
    min_amount DECIMAL(15,2) DEFAULT 0,
    max_amount DECIMAL(15,2),
    approver_role VARCHAR(50) NOT NULL,
    approver_id UUID REFERENCES users(id), -- Specific approver if fixed
    is_active BOOLEAN DEFAULT true,
    organisation_id UUID NOT NULL REFERENCES organisations(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Approval Actions Log
CREATE TABLE IF NOT EXISTS approval_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    approval_id UUID NOT NULL REFERENCES approvals(id) ON DELETE CASCADE,
    action VARCHAR(20) NOT NULL CHECK (action IN ('APPROVED', 'REJECTED', 'HOLD', 'FORWARDED', 'CANCELLED')),
    approver_id UUID REFERENCES users(id),
    approver_role VARCHAR(50),
    comments TEXT,
    action_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    organisation_id UUID NOT NULL REFERENCES organisations(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Approval Notifications
CREATE TABLE IF NOT EXISTS approval_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    approval_id UUID NOT NULL REFERENCES approvals(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    notification_type VARCHAR(20) NOT NULL CHECK (notification_type IN ('EMAIL', 'SMS', 'IN_APP')),
    sent_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    organisation_id UUID NOT NULL REFERENCES organisations(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
CREATE INDEX IF NOT EXISTS idx_approvals_type ON approvals(approval_type);
CREATE INDEX IF NOT EXISTS idx_approvals_requested_by ON approvals(requested_by);
CREATE INDEX IF NOT EXISTS idx_approvals_organisation ON approvals(organisation_id);
CREATE INDEX IF NOT EXISTS idx_approvals_created_at ON approvals(created_at);
CREATE INDEX IF NOT EXISTS idx_approval_actions_approval_id ON approval_actions(approval_id);
CREATE INDEX IF NOT EXISTS idx_approval_workflows_type_amount ON approval_workflows(approval_type, min_amount, max_amount);
CREATE INDEX IF NOT EXISTS idx_approval_notifications_user_id ON approval_notifications(user_id);

-- Row Level Security (RLS) Policies
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for approvals table
CREATE POLICY "approval_users_view_org_approvals" ON approvals
    FOR SELECT USING (
        organisation_id IN (
            SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "approval_users_create_org_approvals" ON approvals
    FOR INSERT WITH CHECK (
        organisation_id IN (
            SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid()
        )
    );

-- RLS Policies for approval_actions table
CREATE POLICY "approval_actions_users_view_org_approvals" ON approval_actions
    FOR SELECT USING (
        organisation_id IN (
            SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "approval_actions_users_create_org_approvals" ON approval_actions
    FOR INSERT WITH CHECK (
        organisation_id IN (
            SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid()
        )
    );

-- RLS Policies for approval_workflows table
CREATE POLICY "approval_workflows_users_view_org" ON approval_workflows
    FOR SELECT USING (
        organisation_id IN (
            SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid()
        )
    );

-- RLS Policies for approval_notifications table
CREATE POLICY "approval_notifications_users_own_view" ON approval_notifications
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "approval_notifications_users_create_org" ON approval_notifications
    FOR INSERT WITH CHECK (
        organisation_id IN (
            SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid()
        )
    );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_approvals_updated_at BEFORE UPDATE ON approvals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_approval_workflows_updated_at BEFORE UPDATE ON approval_workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default approval workflows for demo purposes
-- These should be configured per organisation in production
INSERT INTO approval_workflows (approval_type, level, min_amount, max_amount, approver_role, organisation_id) VALUES
('PURCHASE_ORDER', 1, 0, 50000, 'PROJECT_MANAGER', (SELECT id FROM organisations LIMIT 1)),
('PURCHASE_ORDER', 2, 50001, 200000, 'GENERAL_MANAGER', (SELECT id FROM organisations LIMIT 1)),
('PURCHASE_ORDER', 3, 200001, NULL, 'DIRECTOR', (SELECT id FROM organisations LIMIT 1)),
('WORK_ORDER', 1, 0, 100000, 'PROJECT_MANAGER', (SELECT id FROM organisations LIMIT 1)),
('WORK_ORDER', 2, 100001, NULL, 'GENERAL_MANAGER', (SELECT id FROM organisations LIMIT 1)),
('INVOICE', 1, 0, 100000, 'ACCOUNTS_MANAGER', (SELECT id FROM organisations LIMIT 1)),
('INVOICE', 2, 100001, NULL, 'GENERAL_MANAGER', (SELECT id FROM organisations LIMIT 1)),
('PAYMENT_REQUEST', 1, 0, 50000, 'ACCOUNTS_MANAGER', (SELECT id FROM organisations LIMIT 1)),
('PAYMENT_REQUEST', 2, 50001, 200000, 'GENERAL_MANAGER', (SELECT id FROM organisations LIMIT 1)),
('PAYMENT_REQUEST', 3, 200001, NULL, 'DIRECTOR', (SELECT id FROM organisations LIMIT 1))
ON CONFLICT DO NOTHING;

-- Approval Approvers Table (for settings)
CREATE TABLE IF NOT EXISTS approval_approvers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    designation VARCHAR(100) NOT NULL, -- Project Manager, General Manager, Director, etc.
    department VARCHAR(100),
    email_address VARCHAR(255),
    phone_number VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    approval_types TEXT[], -- Array of approval types this user can approve
    max_approval_amount DECIMAL(15,2), -- Maximum amount this user can approve
    organisation_id UUID NOT NULL REFERENCES organisations(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Approval Settings Table
CREATE TABLE IF NOT EXISTS approval_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT NOT NULL,
    description TEXT,
    organisation_id UUID NOT NULL REFERENCES organisations(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for approval settings tables
CREATE INDEX IF NOT EXISTS idx_approval_approvers_user_id ON approval_approvers(user_id);
CREATE INDEX IF NOT EXISTS idx_approval_approvers_organisation_id ON approval_approvers(organisation_id);
CREATE INDEX IF NOT EXISTS idx_approval_approvers_designation ON approval_approvers(designation);
CREATE INDEX IF NOT EXISTS idx_approval_settings_organisation_id ON approval_settings(organisation_id);

-- RLS Policies for approval settings tables
ALTER TABLE approval_approvers ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for approval_approvers table
CREATE POLICY "approval_approvers_users_view_org" ON approval_approvers
    FOR SELECT USING (
        organisation_id IN (
            SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "approval_approvers_admins_manage_org" ON approval_approvers
    FOR ALL USING (
        organisation_id IN (
            SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid()
        )
    );

-- RLS Policies for approval_settings table
CREATE POLICY "approval_settings_users_view_org" ON approval_settings
    FOR SELECT USING (
        organisation_id IN (
            SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "approval_settings_admins_manage_org" ON approval_settings
    FOR ALL USING (
        organisation_id IN (
            SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid()
        )
    );

-- Insert default approval settings
INSERT INTO approval_settings (setting_key, setting_value, description, organisation_id) VALUES
('approval_enabled', 'true', 'Enable approval system', (SELECT id FROM organisations LIMIT 1)),
('email_notifications', 'true', 'Enable email notifications', (SELECT id FROM organisations LIMIT 1)),
('sms_notifications', 'false', 'Enable SMS notifications', (SELECT id FROM organisations LIMIT 1)),
('auto_escalation_hours', '24', 'Auto escalation hours for urgent approvals', (SELECT id FROM organisations LIMIT 1)),
('approval_timeout_hours', '72', 'Approval timeout in hours', (SELECT id FROM organisations LIMIT 1))
ON CONFLICT DO NOTHING;

-- Update workflow table to use approvers from approval_approvers
ALTER TABLE approval_workflows ADD COLUMN IF NOT EXISTS approver_designation VARCHAR(100);
ALTER TABLE approval_workflows ADD COLUMN IF NOT EXISTS approver_id UUID REFERENCES approval_approvers(id);

-- Create view for approval statistics
CREATE OR REPLACE VIEW approval_stats AS
SELECT 
    organisation_id,
    COUNT(*) as total_approvals,
    COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_approvals,
    COUNT(CASE WHEN status = 'APPROVED' THEN 1 END) as approved_approvals,
    COUNT(CASE WHEN status = 'REJECTED' THEN 1 END) as rejected_approvals,
    COUNT(CASE WHEN status = 'HOLD' THEN 1 END) as hold_approvals,
    COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as today_approvals,
    COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as week_approvals,
    AVG(EXTRACT(EPOCH FROM (updated_at - requested_at))/3600) as avg_approval_hours
FROM approvals
GROUP BY organisation_id;

-- Create view for approvers with user details
CREATE OR REPLACE VIEW approvers_details AS
SELECT 
    aa.*,
    u.name as user_name,
    u.email as user_email,
    u.avatar_url as user_avatar
FROM approval_approvers aa
JOIN users u ON aa.user_id = u.id
WHERE aa.is_active = true;
