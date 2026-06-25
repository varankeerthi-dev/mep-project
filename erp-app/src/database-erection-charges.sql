-- Erection/Installation Charges Feature Database Migration
-- Run this in Supabase SQL Editor
-- This migration adds support for auto-linking erection charges to materials in quotations

-- ============================================================================
-- PHASE 1: Add section column to quotation_items table
-- ============================================================================

-- Add section column to distinguish materials vs erection vs other items
ALTER TABLE quotation_items 
ADD COLUMN IF NOT EXISTS section VARCHAR(20) DEFAULT 'materials';

-- Add check constraint to ensure valid section values
ALTER TABLE quotation_items 
DROP CONSTRAINT IF EXISTS chk_section;

ALTER TABLE quotation_items 
ADD CONSTRAINT chk_section 
CHECK (section IN ('materials', 'erection', 'other'));

-- Set default value for existing records to 'materials'
UPDATE quotation_items 
SET section = 'materials' 
WHERE section IS NULL;

-- Create index for section filtering
CREATE INDEX IF NOT EXISTS idx_quotation_items_section ON quotation_items(section);

-- ============================================================================
-- PHASE 2: Add erection-specific columns to quotation_items
-- ============================================================================

-- Column to link erection items to their parent material
ALTER TABLE quotation_items 
ADD COLUMN IF NOT EXISTS linked_material_id VARCHAR(255);

-- Column to flag if quantity/unit is auto-synced from material (read-only in UI)
ALTER TABLE quotation_items 
ADD COLUMN IF NOT EXISTS is_auto_quantity BOOLEAN DEFAULT false;

-- Column to prevent re-creation if user manually deleted erection
ALTER TABLE quotation_items 
ADD COLUMN IF NOT EXISTS erection_manually_removed BOOLEAN DEFAULT false;

-- Column to flag if user manually edited the rate (prevents auto-update from service master)
ALTER TABLE quotation_items 
ADD COLUMN IF NOT EXISTS rate_manually_edited BOOLEAN DEFAULT false;

-- Create index for linked material lookups
CREATE INDEX IF NOT EXISTS idx_quotation_items_linked_material ON quotation_items(linked_material_id);

-- ============================================================================
-- PHASE 3: Create service_rates table (Service Master)
-- ============================================================================
-- Create service_rates table
CREATE TABLE IF NOT EXISTS service_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name VARCHAR(255) NOT NULL,
  default_erection_rate DECIMAL(10, 2) NOT NULL DEFAULT 0,
  unit VARCHAR(50) NOT NULL DEFAULT 'Mtrs',
  gst_rate DECIMAL(5, 2) NOT NULL DEFAULT 18,
  sac_code VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(item_name, organisation_id)
);

-- Add new columns to existing table (in case table already exists)
ALTER TABLE service_rates
ADD COLUMN IF NOT EXISTS gst_rate DECIMAL(5, 2) NOT NULL DEFAULT 18;

ALTER TABLE service_rates
ADD COLUMN IF NOT EXISTS sac_code VARCHAR(50);

ALTER TABLE service_rates
ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE;

-- Add unique constraint for item_name + organisation_id (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'service_rates_name_org_unique'
    ) THEN
        ALTER TABLE service_rates
        ADD CONSTRAINT service_rates_name_org_unique UNIQUE(item_name, organisation_id);
    END IF;
END $$;

-- Add comment to table
COMMENT ON TABLE service_rates IS 'Service Master: Defines default erection rates for materials. Used to auto-create erection charges in quotations.';

-- Add comments to columns
COMMENT ON COLUMN service_rates.item_name IS 'Material name (must match materials.name or quotation_items.description)';
COMMENT ON COLUMN service_rates.default_erection_rate IS 'Default erection/installation rate per unit';
COMMENT ON COLUMN service_rates.unit IS 'Unit for erection rate (Mtrs, Nos, Kgs, etc.)';
COMMENT ON COLUMN service_rates.gst_rate IS 'GST rate for erection charges';
COMMENT ON COLUMN service_rates.sac_code IS 'SAC code for erection services';
COMMENT ON COLUMN service_rates.is_active IS 'Whether this service rate is currently active';

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_service_rates_item_name ON service_rates(item_name);
CREATE INDEX IF NOT EXISTS idx_service_rates_active ON service_rates(is_active);

-- ============================================================================
-- PHASE 4: Enable RLS (Row Level Security) for service_rates
-- ============================================================================

ALTER TABLE service_rates ENABLE ROW LEVEL SECURITY;

-- Policy to allow access based on organisation
DROP POLICY IF EXISTS "Enable organisation access on service_rates" ON service_rates;
CREATE POLICY "Enable organisation access on service_rates" 
ON service_rates FOR ALL 
USING (organisation_id IN (SELECT id FROM user_organisations WHERE user_id = auth.uid())) 
WITH CHECK (organisation_id IN (SELECT id FROM user_organisations WHERE user_id = auth.uid()));

-- ============================================================================
-- PHASE 5: Insert sample service rates for testing
-- ============================================================================

-- Sample service rates - uncomment and modify based on your actual materials
INSERT INTO service_rates (item_name, default_erection_rate, unit) VALUES
('100NB Pipe', 150.00, 'Mtrs'),
('150NB Pipe', 200.00, 'Mtrs'),
('200NB Pipe', 250.00, 'Mtrs'),
('Gate Valve', 500.00, 'Nos'),
('Butterfly Valve', 750.00, 'Nos'),
('Flange 150NB', 100.00, 'Nos'),
('Flange 200NB', 150.00, 'Nos'),
('Elbow 90 Degree', 50.00, 'Nos')
ON CONFLICT (item_name) DO NOTHING;

-- ============================================================================
-- PHASE 6: Create trigger to auto-update updated_at timestamp
-- ============================================================================

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS update_service_rates_updated_at ON service_rates;

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_service_rates_updated_at
BEFORE UPDATE ON service_rates
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Note: This trigger requires the update_updated_at_column() function
-- If it doesn't exist, create it:
-- CREATE OR REPLACE FUNCTION update_updated_at_column()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   NEW.updated_at = NOW();
--   RETURN NEW;
-- END;
-- $$ language 'plpgsql';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify quotation_items has new columns
-- SELECT column_name, data_type, default_value 
-- FROM information_schema.columns 
-- WHERE table_name = 'quotation_items' 
-- AND column_name IN ('section', 'linked_material_id', 'is_auto_quantity', 'erection_manually_removed', 'rate_manually_edited')
-- ORDER BY ordinal_position;

-- Verify service_rates table exists
-- SELECT table_name, column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'service_rates'
-- ORDER BY ordinal_position;

-- Check existing quotation_items sections
-- SELECT section, COUNT(*) as count 
-- FROM quotation_items 
-- GROUP BY section;
