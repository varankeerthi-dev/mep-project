-- Migration: Add organisation_id to delivery_challans table
-- Created: 2026-04-05
-- Purpose: Fix missing organisation_id column causing DC creation errors

-- Add organisation_id column to delivery_challans table
ALTER TABLE delivery_challans 
ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE;

-- Add organisation_id column to delivery_challan_items table (for consistency)
ALTER TABLE delivery_challan_items 
ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_delivery_challans_organisation_id ON delivery_challans(organisation_id);
CREATE INDEX IF NOT EXISTS idx_delivery_challan_items_organisation_id ON delivery_challan_items(organisation_id);

-- Update RLS policies to include organisation_id checks (if RLS is enabled)
-- Note: The existing policies in 001_create_sites_attendance.sql should cover this

-- Backfill existing records with organisation_id from related projects (if possible)
-- This is optional and should be run manually if needed:
-- UPDATE delivery_challans dc 
-- SET organisation_id = p.organisation_id 
-- FROM projects p 
-- WHERE dc.project_id = p.id 
-- AND dc.organisation_id IS NULL;

COMMENT ON COLUMN delivery_challans.organisation_id IS 'Organization ID for multi-tenant support';
COMMENT ON COLUMN delivery_challan_items.organisation_id IS 'Organization ID for multi-tenant support';
