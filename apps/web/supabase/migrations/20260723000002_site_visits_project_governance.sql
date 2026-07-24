-- Site Visits & Project Module Governance Migration
-- Date: 2026-07-23

-- ----------------------------------------------------------------------------
-- 1. Site Visit Geofencing & Extended Verification Columns
-- ----------------------------------------------------------------------------
ALTER TABLE site_visits 
  ADD COLUMN IF NOT EXISTS geo_latitude DECIMAL(10, 8),
  ADD COLUMN IF NOT EXISTS geo_longitude DECIMAL(11, 8),
  ADD COLUMN IF NOT EXISTS check_in_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS check_out_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS requires_pm_escalation BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS verification_status VARCHAR(50) DEFAULT 'verified';

-- ----------------------------------------------------------------------------
-- 2. Site Report & Visit Stoppage Task Intent Linkage Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS site_report_stoppages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID,
    project_id UUID,
    site_report_id UUID,
    site_visit_id UUID,
    source_type VARCHAR(50) NOT NULL DEFAULT 'daily_report',
    category VARCHAR(50) NOT NULL DEFAULT 'other',
    blocking_party VARCHAR(50) NOT NULL DEFAULT 'internal',
    description TEXT NOT NULL,
    impact_hours DECIMAL(5, 2) DEFAULT 0.00,
    photo_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
    task_intent_status VARCHAR(50) DEFAULT 'pending_pm_approval',
    created_task_id UUID,
    pm_reviewed_by UUID,
    pm_reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for site_report_stoppages
ALTER TABLE site_report_stoppages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for authenticated users in org" ON site_report_stoppages
    FOR ALL USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- ----------------------------------------------------------------------------
-- 3. PM Schedule Baselines & Empirical Progress Variance Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_schedule_baselines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID,
    project_id UUID,
    milestone_name TEXT NOT NULL,
    boq_item_id UUID,
    planned_start_date DATE NOT NULL,
    planned_finish_date DATE NOT NULL,
    baseline_version INT DEFAULT 1,
    pm_approved_progress_percent DECIMAL(5, 2) DEFAULT 0.00,
    empirical_calculated_percent DECIMAL(5, 2) DEFAULT 0.00,
    last_adjusted_by UUID,
    last_adjusted_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for project_schedule_baselines
ALTER TABLE project_schedule_baselines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for authenticated users in org" ON project_schedule_baselines
    FOR ALL USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');
