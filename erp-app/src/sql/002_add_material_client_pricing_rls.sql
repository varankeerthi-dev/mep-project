-- Migration: Add RLS policies for material_client_pricing
-- Multi-tenant with org_members
-- Date: 2026-05-21

-- 1. Add organisation_id column if not exists
ALTER TABLE material_client_pricing 
ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE;

-- 2. Drop existing policies
DROP POLICY IF EXISTS "material_client_pricing_org_access" ON material_client_pricing;
DROP POLICY IF EXISTS "material_client_pricing_all_access" ON material_client_pricing;
DROP POLICY IF EXISTS "Users can manage client pricing" ON material_client_pricing;

-- 3. Create RLS policy using org_members
CREATE POLICY "material_client_pricing_org_access"
ON material_client_pricing
FOR ALL
USING (
  organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
  )
);

-- 4. Grant table permissions (not USAGE for tables)
GRANT SELECT, INSERT, UPDATE, DELETE ON material_client_pricing TO authenticated;

-- 5. Backfill organisation_id from materials table for existing records
UPDATE material_client_pricing mcp
SET organisation_id = m.organisation_id
FROM materials m
WHERE mcp.material_id = m.id
AND mcp.organisation_id IS NULL;

-- 6. Add NOT NULL constraint if all records have organisation_id
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM material_client_pricing WHERE organisation_id IS NULL) THEN
    ALTER TABLE material_client_pricing ALTER COLUMN organisation_id SET NOT NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not set NOT NULL: %', SQLERRM;
END $$;