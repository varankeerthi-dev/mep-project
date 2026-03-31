-- Migration: Create sites and attendance tables for geofencing HR module
-- Created: 2026-03-31

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Sites table for geofencing
CREATE TABLE IF NOT EXISTS sites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_name TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    radius_meters INTEGER NOT NULL DEFAULT 100,
    address TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Attendance table with translated remarks
CREATE TABLE IF NOT EXISTS attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    check_in_time TIMESTAMPTZ,
    check_out_time TIMESTAMPTZ,
    site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('checked_in', 'checked_out', 'absent', 'on_leave')),
    remarks TEXT, -- Optimized for storing English strings (translated from voice input)
    check_in_latitude DOUBLE PRECISION,
    check_in_longitude DOUBLE PRECISION,
    check_out_latitude DOUBLE PRECISION,
    check_out_longitude DOUBLE PRECISION,
    recorded_at DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries on employee attendance
CREATE INDEX IF NOT EXISTS idx_attendance_employee_id ON attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_recorded_at ON attendance(recorded_at);
CREATE INDEX IF NOT EXISTS idx_attendance_site_id ON attendance(site_id);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status);

-- Index for geofencing queries
CREATE INDEX IF NOT EXISTS idx_sites_coordinates ON sites(latitude, longitude);

-- Enable RLS
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Sites policies
CREATE POLICY "Allow authenticated users to view sites" ON sites
    FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "Allow admins to manage sites" ON sites
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM organisation_members
        WHERE user_id = auth.uid() AND role = 'admin'
    ));

-- Attendance policies
CREATE POLICY "Allow employees to insert their own attendance" ON attendance
    FOR INSERT TO authenticated WITH CHECK (employee_id = auth.uid());

CREATE POLICY "Allow employees to view their own attendance" ON attendance
    FOR SELECT TO authenticated USING (employee_id = auth.uid());

CREATE POLICY "Allow employees to update their own attendance (check-out)" ON attendance
    FOR UPDATE TO authenticated USING (employee_id = auth.uid());

CREATE POLICY "Allow admins to view all attendance" ON attendance
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM organisation_members
        WHERE user_id = auth.uid() AND role IN ('admin', 'hr')
    ));

CREATE POLICY "Allow admins to update all attendance" ON attendance
    FOR UPDATE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM organisation_members
        WHERE user_id = auth.uid() AND role IN ('admin', 'hr')
    ));

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sites_updated_at
    BEFORE UPDATE ON sites
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attendance_updated_at
    BEFORE UPDATE ON attendance
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add organization_id to sites for multi-tenant support
ALTER TABLE sites ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organisations(id) ON DELETE CASCADE;

-- Add organization_id index
CREATE INDEX IF NOT EXISTS idx_sites_organization_id ON sites(organization_id);

-- Update RLS policies for organization scoping
DROP POLICY IF EXISTS "Allow org members to view org sites" ON sites;
CREATE POLICY "Allow org members to view org sites" ON sites
    FOR SELECT TO authenticated
    USING (organization_id IN (
        SELECT organization_id FROM organisation_members WHERE user_id = auth.uid()
    ));
