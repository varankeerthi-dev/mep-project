-- ============================================================
-- Warehouse Purpose Setup (run in Supabase SQL Editor)
-- Adds warehouse_purpose column and tags/creates warehouses
-- ============================================================

-- Add the missing column
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS warehouse_purpose VARCHAR(20) 
  CHECK (warehouse_purpose IN ('main', 'wip', 'fg', 'general')) 
  DEFAULT 'main';

-- Tag default warehouse as main
UPDATE warehouses SET warehouse_purpose = 'main' WHERE is_default = true AND warehouse_purpose IS NULL;

-- Tag remaining untagged warehouses
UPDATE warehouses SET warehouse_purpose = 'main' WHERE warehouse_purpose IS NULL;

-- Create WIP warehouse per org (if missing)
INSERT INTO warehouses (name, warehouse_code, location, is_active, organisation_id, warehouse_purpose)
SELECT o.id || '-WIP', 'WIP', 'Manufacturing Area', true, o.id, 'wip'
FROM organisations o
WHERE NOT EXISTS (
  SELECT 1 FROM warehouses w WHERE w.organisation_id = o.id AND w.warehouse_purpose = 'wip'
);

-- Create FG warehouse per org (if missing)
INSERT INTO warehouses (name, warehouse_code, location, is_active, organisation_id, warehouse_purpose)
SELECT o.id || '-FG', 'FG', 'Finished Goods Area', true, o.id, 'fg'
FROM organisations o
WHERE NOT EXISTS (
  SELECT 1 FROM warehouses w WHERE w.organisation_id = o.id AND w.warehouse_purpose = 'fg'
);
