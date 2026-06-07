-- Phase 2: Link sub_contractors to database + auto-create manpower_attendance

-- 1. Add subcontractor_id to sub_contractors table
ALTER TABLE sub_contractors ADD COLUMN IF NOT EXISTS subcontractor_id UUID REFERENCES subcontractors(id);

-- 2. Add source tracking to manpower_attendance
ALTER TABLE manpower_attendance ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'direct';
ALTER TABLE manpower_attendance ADD COLUMN IF NOT EXISTS source_report_id UUID REFERENCES site_reports(id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_manpower_attendance_source ON manpower_attendance(source);
CREATE INDEX IF NOT EXISTS idx_manpower_attendance_source_report ON manpower_attendance(source_report_id);
