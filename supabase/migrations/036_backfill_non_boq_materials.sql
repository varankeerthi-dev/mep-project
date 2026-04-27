-- Backfill non-BOQ materials from existing material_logs
-- This script checks all received materials and adds them as non-BOQ items if they're not in the BOQ

-- First, ensure is_boq column exists (in case migration 035 wasn't run)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'project_material_list' AND column_name = 'is_boq'
  ) THEN
    ALTER TABLE project_material_list ADD COLUMN is_boq BOOLEAN DEFAULT true;
    CREATE INDEX idx_project_material_list_is_boq ON project_material_list(is_boq);
  END IF;
END $$;

-- Backfill non-BOQ materials from material_logs
-- This inserts materials that were received but are not in the BOQ
INSERT INTO project_material_list (
  id,
  project_id,
  organisation_id,
  item_id,
  variant_id,
  planned_qty,
  unit,
  rate,
  remarks,
  is_boq,
  created_at,
  updated_at
)
SELECT 
  gen_random_uuid() as id,
  ml.project_id,
  ml.organisation_id,
  ml.item_id,
  ml.variant_id,
  0 as planned_qty,  -- Non-BOQ items have 0 planned qty
  COALESCE(m.unit, 'nos') as unit,
  COALESCE(ml.purchase_price, 0) as rate,
  'Backfilled from material receipt - ' || COALESCE(ml.dc_number, 'N/A') as remarks,
  false as is_boq,
  ml.created_at,
  NOW() as updated_at
FROM material_logs ml
LEFT JOIN materials m ON m.id = ml.item_id
WHERE ml.type = 'IN'  -- Only incoming materials
  AND ml.qty_received > 0
  AND NOT EXISTS (
    -- Check if this material+variant already exists in BOQ for this project
    SELECT 1 FROM project_material_list pml
    WHERE pml.project_id = ml.project_id
      AND pml.item_id = ml.item_id
      AND (pml.variant_id = ml.variant_id OR (pml.variant_id IS NULL AND ml.variant_id IS NULL))
      AND pml.is_boq = true
  )
  AND NOT EXISTS (
    -- Avoid duplicates - check if already added as non-BOQ
    SELECT 1 FROM project_material_list pml
    WHERE pml.project_id = ml.project_id
      AND pml.item_id = ml.item_id
      AND (pml.variant_id = ml.variant_id OR (pml.variant_id IS NULL AND ml.variant_id IS NULL))
      AND pml.is_boq = false
  )
ON CONFLICT DO NOTHING;

-- Log the number of backfilled materials
DO $$
DECLARE
  backfill_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO backfill_count 
  FROM project_material_list 
  WHERE is_boq = false 
    AND remarks LIKE 'Backfilled from material receipt%';
  
  RAISE NOTICE 'Backfilled % non-BOQ materials from existing receipts', backfill_count;
END $$;
