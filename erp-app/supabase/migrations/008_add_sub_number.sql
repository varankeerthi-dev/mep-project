-- Migration: Add sub_number auto-numbering to subcontractors
-- Created: 2026-04-05

-- Add sub_number column
ALTER TABLE subcontractors
ADD COLUMN IF NOT EXISTS sub_number VARCHAR(50) UNIQUE;

-- Create index for sub_number
CREATE INDEX IF NOT EXISTS idx_subcontractors_sub_number ON subcontractors(sub_number);

-- Function to generate next sub number
CREATE OR REPLACE FUNCTION generate_sub_number(org_id UUID)
RETURNS VARCHAR(50) AS $$
DECLARE
  next_number INTEGER;
  prefix VARCHAR(10) := 'SUB-';
BEGIN
  -- Get the current max number for this organization
  SELECT COALESCE(MAX(CAST(REPLACE(sub_number, prefix, '') AS INTEGER)), 0) + 1
  INTO next_number
  FROM subcontractors
  WHERE organisation_id = org_id
  AND sub_number LIKE prefix || '%';
  
  RETURN prefix || LPAD(next_number::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Trigger function to auto-assign sub_number on insert
CREATE OR REPLACE FUNCTION assign_sub_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sub_number IS NULL OR NEW.sub_number = '' THEN
    NEW.sub_number := generate_sub_number(NEW.organisation_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trg_assign_sub_number ON subcontractors;
CREATE TRIGGER trg_assign_sub_number
  BEFORE INSERT ON subcontractors
  FOR EACH ROW
  EXECUTE FUNCTION assign_sub_number();

COMMENT ON COLUMN subcontractors.sub_number IS 'Auto-generated subcontractor number (e.g., SUB-0001)';
COMMENT ON FUNCTION generate_sub_number IS 'Generates next sequential sub number for an organization';
