-- Add equipment fault toggle columns to site_reports
-- Run this migration to support the "No Equipment Fault" radio toggle

ALTER TABLE site_reports
ADD COLUMN IF NOT EXISTS equipment_no_fault BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS equipment_no_fault_notes TEXT DEFAULT '';
