-- Migration: 20240101000074_site_visit_activity_log.sql
-- Description: Create site_visit_activity_log table for tracking Site Visit events

CREATE TABLE IF NOT EXISTS site_visit_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    site_visit_id UUID NOT NULL REFERENCES site_visits(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_name VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_site_visit_activity_log_lookup 
ON site_visit_activity_log(organisation_id, site_visit_id, created_at DESC);

ALTER TABLE site_visit_activity_log ENABLE ROW LEVEL SECURITY;
