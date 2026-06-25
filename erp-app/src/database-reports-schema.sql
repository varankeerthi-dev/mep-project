-- Reports Module Database Schema
-- Created: May 5, 2026
-- Purpose: Support comprehensive reporting system with filtering, scheduling, and export capabilities

-- ========================================
-- REPORT TEMPLATES AND CONFIGURATION
-- ========================================

-- Report templates store predefined report configurations
CREATE TABLE IF NOT EXISTS report_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL CHECK (category IN ('financial', 'projects', 'inventory', 'compliance')),
    template_config JSONB NOT NULL DEFAULT '{}',
    created_by UUID REFERENCES auth.users(id),
    organisation_id UUID REFERENCES organisations(id),
    is_system_template BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Report parameters store dynamic filter configurations
CREATE TABLE IF NOT EXISTS report_parameters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES report_templates(id) ON DELETE CASCADE,
    parameter_name TEXT NOT NULL,
    parameter_type TEXT NOT NULL CHECK (parameter_type IN ('date-range', 'multi-select', 'single-select', 'text', 'number')),
    parameter_config JSONB NOT NULL DEFAULT '{}',
    default_value JSONB,
    is_required BOOLEAN DEFAULT FALSE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- REPORT EXECUTION AND STORAGE
-- ========================================

-- Generated reports store execution results and metadata
CREATE TABLE IF NOT EXISTS generated_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES report_templates(id),
    report_name TEXT NOT NULL,
    report_type TEXT NOT NULL,
    parameters JSONB NOT NULL DEFAULT '{}',
    data JSONB NOT NULL DEFAULT '{}',
    file_path TEXT,
    file_size BIGINT,
    file_format TEXT CHECK (file_format IN ('pdf', 'excel', 'csv')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
    error_message TEXT,
    generated_by UUID REFERENCES auth.users(id),
    organisation_id UUID REFERENCES organisations(id),
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Report metrics store performance and usage statistics
CREATE TABLE IF NOT EXISTS report_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID REFERENCES generated_reports(id) ON DELETE CASCADE,
    metric_name TEXT NOT NULL,
    metric_value NUMERIC,
    metric_type TEXT CHECK (metric_type IN ('count', 'sum', 'average', 'percentage')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- SCHEDULED REPORTS
-- ========================================

-- Scheduled reports for automated generation
CREATE TABLE IF NOT EXISTS scheduled_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES report_templates(id),
    schedule_name TEXT NOT NULL,
    parameters JSONB NOT NULL DEFAULT '{}',
    schedule_config JSONB NOT NULL DEFAULT '{}',
    recipients JSONB NOT NULL DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    last_run_at TIMESTAMP WITH TIME ZONE,
    next_run_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES auth.users(id),
    organisation_id UUID REFERENCES organisations(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Schedule execution logs
CREATE TABLE IF NOT EXISTS schedule_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID REFERENCES scheduled_reports(id) ON DELETE CASCADE,
    report_id UUID REFERENCES generated_reports(id),
    execution_status TEXT CHECK (execution_status IN ('success', 'failed', 'skipped')),
    execution_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    error_message TEXT,
    duration_ms INTEGER
);

-- ========================================
-- USER PREFERENCES AND SAVED FILTERS
-- ========================================

-- Saved filter sets for quick access
CREATE TABLE IF NOT EXISTS saved_filters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    filter_name TEXT NOT NULL,
    report_category TEXT,
    filter_config JSONB NOT NULL DEFAULT '{}',
    is_default BOOLEAN DEFAULT FALSE,
    organisation_id UUID REFERENCES organisations(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User report preferences
CREATE TABLE IF NOT EXISTS user_report_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    report_category TEXT,
    preference_key TEXT NOT NULL,
    preference_value JSONB NOT NULL,
    organisation_id UUID REFERENCES organisations(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, report_category, preference_key)
);

-- ========================================
-- REPORT ACCESS CONTROL
-- ========================================

-- Report access permissions
CREATE TABLE IF NOT EXISTS report_access_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID REFERENCES generated_reports(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    permission_type TEXT NOT NULL CHECK (permission_type IN ('view', 'edit', 'delete', 'share')),
    granted_by UUID REFERENCES auth.users(id),
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(report_id, user_id, permission_type)
);

-- Category-based access control
CREATE TABLE IF NOT EXISTS category_access_control (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL CHECK (category IN ('financial', 'projects', 'inventory', 'compliance')),
    role_id UUID REFERENCES roles(id),
    can_view BOOLEAN DEFAULT FALSE,
    can_generate BOOLEAN DEFAULT FALSE,
    can_schedule BOOLEAN DEFAULT FALSE,
    can_export BOOLEAN DEFAULT FALSE,
    organisation_id UUID REFERENCES organisations(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(category, role_id, organisation_id)
);

-- ========================================
-- INDEXES FOR PERFORMANCE
-- ========================================

-- Report templates indexes
CREATE INDEX IF NOT EXISTS idx_report_templates_category ON report_templates(category);
CREATE INDEX IF NOT EXISTS idx_report_templates_organisation ON report_templates(organisation_id);
CREATE INDEX IF NOT EXISTS idx_report_templates_system ON report_templates(is_system_template);

-- Generated reports indexes
CREATE INDEX IF NOT EXISTS idx_generated_reports_template ON generated_reports(template_id);
CREATE INDEX IF NOT EXISTS idx_generated_reports_status ON generated_reports(status);
CREATE INDEX IF NOT EXISTS idx_generated_reports_organisation ON generated_reports(organisation_id);
CREATE INDEX IF NOT EXISTS idx_generated_reports_generated_at ON generated_reports(generated_at);
CREATE INDEX IF NOT EXISTS idx_generated_reports_generated_by ON generated_reports(generated_by);

-- Scheduled reports indexes
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_active ON scheduled_reports(is_active);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_next_run ON scheduled_reports(next_run_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_organisation ON scheduled_reports(organisation_id);

-- Saved filters indexes
CREATE INDEX IF NOT EXISTS idx_saved_filters_user ON saved_filters(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_filters_category ON saved_filters(report_category);
CREATE INDEX IF NOT EXISTS idx_saved_filters_organisation ON saved_filters(organisation_id);

-- Report metrics indexes
CREATE INDEX IF NOT EXISTS idx_report_metrics_report ON report_metrics(report_id);
CREATE INDEX IF NOT EXISTS idx_report_metrics_name ON report_metrics(metric_name);

-- ========================================
-- ROW LEVEL SECURITY (RLS)
-- ========================================

-- Enable RLS on all tables
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_filters ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_report_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_access_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_access_control ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Report Templates
CREATE POLICY "Users can view organisation report templates" ON report_templates
    FOR SELECT USING (
        is_system_template = TRUE OR 
        organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can create organisation report templates" ON report_templates
    FOR INSERT WITH CHECK (
        organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can update their organisation report templates" ON report_templates
    FOR UPDATE USING (
        organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid())
    );

-- RLS Policies for Generated Reports
CREATE POLICY "Users can view organisation generated reports" ON generated_reports
    FOR SELECT USING (
        organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can create generated reports" ON generated_reports
    FOR INSERT WITH CHECK (
        organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid())
    );

-- RLS Policies for Saved Filters
CREATE POLICY "Users can view their own saved filters" ON saved_filters
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own saved filters" ON saved_filters
    FOR ALL USING (user_id = auth.uid());

-- RLS Policies for Scheduled Reports
CREATE POLICY "Users can view organisation scheduled reports" ON scheduled_reports
    FOR SELECT USING (
        organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can create scheduled reports" ON scheduled_reports
    FOR INSERT WITH CHECK (
        organisation_id IN (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid())
    );

-- ========================================
-- TRIGGERS AND FUNCTIONS
-- ========================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_report_templates_updated_at BEFORE UPDATE ON report_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_generated_reports_updated_at BEFORE UPDATE ON generated_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scheduled_reports_updated_at BEFORE UPDATE ON scheduled_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_saved_filters_updated_at BEFORE UPDATE ON saved_filters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_report_preferences_updated_at BEFORE UPDATE ON user_report_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up expired reports
CREATE OR REPLACE FUNCTION cleanup_expired_reports()
RETURNS void AS $$
BEGIN
    DELETE FROM generated_reports 
    WHERE expires_at IS NOT NULL AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- INITIAL DATA
-- ========================================

-- Insert default system report templates
INSERT INTO report_templates (name, description, category, template_config, is_system_template) VALUES
('Project Cost Analysis', 'Budget vs Actual costs by project and category', 'financial', 
 '{"columns": ["project_name", "budget_amount", "actual_cost", "variance", "variance_percentage"], "chart_type": "bar"}', TRUE),
('Invoice Summary', 'Aging report, payment status, and revenue recognition', 'financial',
 '{"columns": ["invoice_number", "client_name", "amount", "due_date", "status", "aging_days"], "chart_type": "pie"}', TRUE),
('Project Portfolio', 'Status overview, timeline analysis, and resource allocation', 'projects',
 '{"columns": ["project_name", "status", "start_date", "end_date", "completion_percentage", "budget"], "chart_type": "gantt"}', TRUE),
('Stock Movement', 'In/out tracking, location analysis, and turnover rates', 'inventory',
 '{"columns": ["item_name", "transaction_type", "quantity", "location", "date", "reference"], "chart_type": "line"}', TRUE),
('Audit Trail', 'System activity logs, change history, and access records', 'compliance',
 '{"columns": ["user_name", "action", "table_name", "record_id", "timestamp", "ip_address"], "chart_type": "table"}', TRUE)
ON CONFLICT DO NOTHING;

-- Insert default report parameters for system templates
INSERT INTO report_parameters (template_id, parameter_name, parameter_type, parameter_config, is_required, display_order)
SELECT 
    rt.id,
    unnest(ARRAY['date_range', 'projects', 'status']) as parameter_name,
    unnest(ARRAY['date-range', 'multi-select', 'multi-select']) as parameter_type,
    unnest(ARRAY['{"preset_ranges": ["this-month", "last-month", "this-quarter"]}', '{"allow_select_all": true}', '{"allow_select_all": true}']::jsonb[]) as parameter_config,
    unnest(ARRAY[true, false, false]) as is_required,
    unnest(ARRAY[1, 2, 3]) as display_order
FROM report_templates rt 
WHERE rt.is_system_template = TRUE
ON CONFLICT DO NOTHING;

-- ========================================
-- VIEWS FOR COMMON QUERIES
-- ========================================

-- View for active scheduled reports
CREATE OR REPLACE VIEW active_scheduled_reports AS
SELECT 
    sr.*,
    rt.name as template_name,
    rt.category,
    u.email as created_by_email
FROM scheduled_reports sr
JOIN report_templates rt ON sr.template_id = rt.id
JOIN auth.users u ON sr.created_by = u.id
WHERE sr.is_active = TRUE;

-- View for recent generated reports
CREATE OR REPLACE VIEW recent_generated_reports AS
SELECT 
    gr.*,
    rt.name as template_name,
    rt.category,
    u.email as generated_by_email
FROM generated_reports gr
JOIN report_templates rt ON gr.template_id = rt.id
JOIN auth.users u ON gr.generated_by = u.id
WHERE gr.generated_at >= NOW() - INTERVAL '30 days'
ORDER BY gr.generated_at DESC;

-- View for report usage statistics
CREATE OR REPLACE VIEW report_usage_statistics AS
SELECT 
    rt.category,
    rt.name as template_name,
    COUNT(gr.id) as total_generated,
    COUNT(gr.id) FILTER (WHERE gr.generated_at >= NOW() - INTERVAL '30 days') as generated_last_30_days,
    AVG(EXTRACT(EPOCH FROM (gr.updated_at - gr.created_at)) * 1000) as avg_generation_time_ms
FROM report_templates rt
LEFT JOIN generated_reports gr ON rt.id = gr.template_id
GROUP BY rt.id, rt.category, rt.name
ORDER BY generated_last_30_days DESC;
