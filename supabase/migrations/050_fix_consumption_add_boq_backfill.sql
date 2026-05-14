-- Migration 050: Fix consumption summary formulas, add is_boq, and backfill missing rows
-- 
-- A. Fixes remaining_qty = GREATEst(received - used, 0) instead of GREATEst(planned, received) - used
-- B. Adds is_boq column with correct default
-- C. Backfills missing consumption rows for all project_material_list entries
--    and recalculates all existing rows with corrected formulas

-- ============================================================
-- Step 1: Add is_boq column to material_consumption_summary
-- ============================================================
ALTER TABLE material_consumption_summary 
ADD COLUMN IF NOT EXISTS is_boq BOOLEAN DEFAULT true;

COMMENT ON COLUMN material_consumption_summary.is_boq IS 'True if material is part of original BOQ, False if added from non-BOQ receipts';

-- ============================================================
-- Step 2: Drop all dependent triggers before replacing functions
-- ============================================================
DROP TRIGGER IF EXISTS trigger_update_consumption_on_usage ON daily_material_usage;
DROP TRIGGER IF EXISTS trigger_update_consumption_on_material_list ON project_material_list;
DROP TRIGGER IF EXISTS trigger_delete_consumption_on_material_list ON project_material_list;
DROP TRIGGER IF EXISTS trigger_update_consumption_on_usage_delete ON daily_material_usage;

-- ============================================================
-- Step 3: Replace the main update function (triggered on INSERT/UPDATE)
-- ============================================================
DROP FUNCTION IF EXISTS update_material_consumption_summary() CASCADE;

CREATE OR REPLACE FUNCTION update_material_consumption_summary()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO material_consumption_summary (
    project_id, organisation_id, item_id, variant_id,
    planned_qty, received_qty, used_qty, remaining_qty, variance_qty,
    unit, rate, planned_cost, actual_cost, cost_variance,
    is_boq, last_updated
  )
  SELECT
    NEW.project_id,
    NEW.organisation_id,
    NEW.item_id,
    NEW.variant_id,
    COALESCE(MAX(pml.planned_qty), 0),
    COALESCE(SUM(mi.received_qty), 0),
    COALESCE(SUM(dmu.quantity_used), 0),
    GREATEST(COALESCE(SUM(mi.received_qty), 0) - COALESCE(SUM(dmu.quantity_used), 0), 0),
    COALESCE(SUM(dmu.quantity_used), 0) - COALESCE(MAX(pml.planned_qty), 0),
    COALESCE(NEW.unit, MAX(pml.unit), 'nos'),
    COALESCE(MAX(pml.rate), 0),
    COALESCE(MAX(pml.planned_qty), 0) * COALESCE(MAX(pml.rate), 0),
    COALESCE(SUM(dmu.quantity_used), 0) * COALESCE(MAX(pml.rate), 0),
    (COALESCE(SUM(dmu.quantity_used), 0) * COALESCE(MAX(pml.rate), 0)) - (COALESCE(MAX(pml.planned_qty), 0) * COALESCE(MAX(pml.rate), 0)),
    COALESCE(bool_or(pml.is_boq), true),
    NOW()
  FROM project_material_list pml
  LEFT JOIN (
    SELECT project_id, item_id, variant_id, SUM(received_qty) as received_qty
    FROM material_intents
    WHERE project_id = NEW.project_id
      AND status IN ('Received', 'Partial')
    GROUP BY project_id, item_id, variant_id
  ) mi ON mi.project_id = NEW.project_id 
       AND mi.item_id = NEW.item_id 
       AND (mi.variant_id = NEW.variant_id OR (mi.variant_id IS NULL AND NEW.variant_id IS NULL))
  LEFT JOIN daily_material_usage dmu ON dmu.project_id = NEW.project_id
    AND dmu.item_id = NEW.item_id
    AND (dmu.variant_id = NEW.variant_id OR (dmu.variant_id IS NULL AND NEW.variant_id IS NULL))
  WHERE pml.project_id = NEW.project_id
    AND pml.item_id = NEW.item_id
    AND (pml.variant_id = NEW.variant_id OR (pml.variant_id IS NULL AND NEW.variant_id IS NULL))
  GROUP BY pml.project_id, pml.item_id, pml.variant_id
  ON CONFLICT (project_id, item_id, variant_id)
  DO UPDATE SET
    planned_qty = EXCLUDED.planned_qty,
    received_qty = EXCLUDED.received_qty,
    used_qty = EXCLUDED.used_qty,
    remaining_qty = EXCLUDED.remaining_qty,
    variance_qty = EXCLUDED.variance_qty,
    unit = EXCLUDED.unit,
    rate = EXCLUDED.rate,
    planned_cost = EXCLUDED.planned_cost,
    actual_cost = EXCLUDED.actual_cost,
    cost_variance = EXCLUDED.cost_variance,
    is_boq = EXCLUDED.is_boq,
    last_updated = EXCLUDED.last_updated;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Step 4: Replace the cleanup-on-delete function
-- ============================================================
DROP FUNCTION IF EXISTS cleanup_consumption_summary_on_usage_delete() CASCADE;

CREATE OR REPLACE FUNCTION cleanup_consumption_summary_on_usage_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM project_material_list
    WHERE project_id = OLD.project_id
      AND item_id = OLD.item_id
      AND (variant_id = OLD.variant_id OR (variant_id IS NULL AND OLD.variant_id IS NULL))
  ) THEN
    DELETE FROM material_consumption_summary
    WHERE project_id = OLD.project_id
      AND item_id = OLD.item_id
      AND (variant_id = OLD.variant_id OR (variant_id IS NULL AND OLD.variant_id IS NULL));
  ELSE
    INSERT INTO material_consumption_summary (
      project_id, organisation_id, item_id, variant_id,
      planned_qty, received_qty, used_qty, remaining_qty, variance_qty,
      unit, rate, planned_cost, actual_cost, cost_variance,
      is_boq, last_updated
    )
    SELECT
      OLD.project_id,
      OLD.organisation_id,
      OLD.item_id,
      OLD.variant_id,
      COALESCE(MAX(pml.planned_qty), 0),
      COALESCE(SUM(mi.received_qty), 0),
      COALESCE(SUM(dmu.quantity_used), 0),
      GREATEST(COALESCE(SUM(mi.received_qty), 0) - COALESCE(SUM(dmu.quantity_used), 0), 0),
      COALESCE(SUM(dmu.quantity_used), 0) - COALESCE(MAX(pml.planned_qty), 0),
      COALESCE(OLD.unit, MAX(pml.unit), 'nos'),
      COALESCE(MAX(pml.rate), 0),
      COALESCE(MAX(pml.planned_qty), 0) * COALESCE(MAX(pml.rate), 0),
      COALESCE(SUM(dmu.quantity_used), 0) * COALESCE(MAX(pml.rate), 0),
      (COALESCE(SUM(dmu.quantity_used), 0) * COALESCE(MAX(pml.rate), 0)) - (COALESCE(MAX(pml.planned_qty), 0) * COALESCE(MAX(pml.rate), 0)),
      COALESCE(bool_or(pml.is_boq), true),
      NOW()
    FROM project_material_list pml
    LEFT JOIN (
      SELECT project_id, item_id, variant_id, SUM(received_qty) as received_qty
      FROM material_intents
      WHERE project_id = OLD.project_id AND item_id = OLD.item_id
        AND (variant_id = OLD.variant_id OR (variant_id IS NULL AND OLD.variant_id IS NULL))
        AND status IN ('Received', 'Partial')
      GROUP BY project_id, item_id, variant_id
    ) mi ON mi.project_id = OLD.project_id AND mi.item_id = OLD.item_id 
         AND (mi.variant_id = OLD.variant_id OR (mi.variant_id IS NULL AND OLD.variant_id IS NULL))
    LEFT JOIN daily_material_usage dmu ON dmu.project_id = OLD.project_id
      AND dmu.item_id = OLD.item_id
      AND (dmu.variant_id = OLD.variant_id OR (dmu.variant_id IS NULL AND OLD.variant_id IS NULL))
    WHERE pml.project_id = OLD.project_id
      AND pml.item_id = OLD.item_id
      AND (pml.variant_id = OLD.variant_id OR (pml.variant_id IS NULL AND OLD.variant_id IS NULL))
    GROUP BY pml.project_id, pml.item_id, pml.variant_id
    ON CONFLICT (project_id, item_id, variant_id)
    DO UPDATE SET
      planned_qty = EXCLUDED.planned_qty,
      received_qty = EXCLUDED.received_qty,
      used_qty = EXCLUDED.used_qty,
      remaining_qty = EXCLUDED.remaining_qty,
      variance_qty = EXCLUDED.variance_qty,
      unit = EXCLUDED.unit,
      rate = EXCLUDED.rate,
      planned_cost = EXCLUDED.planned_cost,
      actual_cost = EXCLUDED.actual_cost,
      cost_variance = EXCLUDED.cost_variance,
      is_boq = EXCLUDED.is_boq,
      last_updated = EXCLUDED.last_updated;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Step 5: Replace the delete-on-material-list function
-- ============================================================
DROP FUNCTION IF EXISTS delete_consumption_summary_on_material_delete() CASCADE;

CREATE OR REPLACE FUNCTION delete_consumption_summary_on_material_delete()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM material_consumption_summary
  WHERE project_id = OLD.project_id
    AND item_id = OLD.item_id
    AND (variant_id = OLD.variant_id OR (variant_id IS NULL AND OLD.variant_id IS NULL));
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Step 6: Recreate triggers
-- ============================================================
CREATE TRIGGER trigger_update_consumption_on_usage
  AFTER INSERT OR UPDATE ON daily_material_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_material_consumption_summary();

CREATE TRIGGER trigger_update_consumption_on_material_list
  AFTER INSERT OR UPDATE ON project_material_list
  FOR EACH ROW
  EXECUTE FUNCTION update_material_consumption_summary();

CREATE TRIGGER trigger_delete_consumption_on_material_list
  AFTER DELETE ON project_material_list
  FOR EACH ROW
  EXECUTE FUNCTION delete_consumption_summary_on_material_delete();

CREATE TRIGGER trigger_update_consumption_on_usage_delete
  AFTER DELETE ON daily_material_usage
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_consumption_summary_on_usage_delete();

-- ============================================================
-- Step 7: Backfill consumption rows for ALL project_material_list entries
--         that don't yet have a consumption_summary row
-- ============================================================
INSERT INTO material_consumption_summary (
  project_id, organisation_id, item_id, variant_id,
  planned_qty, received_qty, used_qty, remaining_qty, variance_qty,
  unit, rate, planned_cost, actual_cost, cost_variance,
  is_boq, last_updated
)
SELECT
  pml.project_id,
  pml.organisation_id,
  pml.item_id,
  pml.variant_id,
  COALESCE(pml.planned_qty, 0) AS planned_qty,
  COALESCE(mi.received_qty, 0) AS received_qty,
  COALESCE(dmu.used_qty, 0) AS used_qty,
  GREATEST(COALESCE(mi.received_qty, 0) - COALESCE(dmu.used_qty, 0), 0) AS remaining_qty,
  COALESCE(dmu.used_qty, 0) - COALESCE(pml.planned_qty, 0) AS variance_qty,
  COALESCE(pml.unit, 'nos') AS unit,
  COALESCE(pml.rate, 0) AS rate,
  COALESCE(pml.planned_qty, 0) * COALESCE(pml.rate, 0) AS planned_cost,
  COALESCE(dmu.used_qty, 0) * COALESCE(pml.rate, 0) AS actual_cost,
  (COALESCE(dmu.used_qty, 0) * COALESCE(pml.rate, 0)) - (COALESCE(pml.planned_qty, 0) * COALESCE(pml.rate, 0)) AS cost_variance,
  COALESCE(pml.is_boq, true) AS is_boq,
  NOW() AS last_updated
FROM project_material_list pml
LEFT JOIN (
  SELECT project_id, item_id, variant_id, SUM(received_qty) AS received_qty
  FROM material_intents
  WHERE status IN ('Received', 'Partial')
  GROUP BY project_id, item_id, variant_id
) mi ON mi.project_id = pml.project_id 
     AND mi.item_id = pml.item_id 
     AND (mi.variant_id = pml.variant_id OR (mi.variant_id IS NULL AND pml.variant_id IS NULL))
LEFT JOIN (
  SELECT project_id, item_id, variant_id, SUM(quantity_used) AS used_qty
  FROM daily_material_usage
  GROUP BY project_id, item_id, variant_id
) dmu ON dmu.project_id = pml.project_id 
     AND dmu.item_id = pml.item_id 
     AND (dmu.variant_id = pml.variant_id OR (dmu.variant_id IS NULL AND pml.variant_id IS NULL))
WHERE NOT EXISTS (
  SELECT 1 FROM material_consumption_summary mcs
  WHERE mcs.project_id = pml.project_id
    AND mcs.item_id = pml.item_id
    AND (mcs.variant_id = pml.variant_id OR (mcs.variant_id IS NULL AND pml.variant_id IS NULL))
)
ON CONFLICT (project_id, item_id, variant_id) DO NOTHING;

-- ============================================================
-- Step 8: Recalculate ALL existing consumption summary rows
--         with the corrected formulas + backfill is_boq
-- ============================================================
UPDATE material_consumption_summary mcs
SET
  planned_qty = COALESCE(sub.planned_qty, mcs.planned_qty),
  received_qty = COALESCE(sub.received_qty, mcs.received_qty),
  used_qty = COALESCE(sub.used_qty, mcs.used_qty),
  remaining_qty = GREATEST(COALESCE(sub.received_qty, mcs.received_qty) - COALESCE(sub.used_qty, mcs.used_qty), 0),
  variance_qty = COALESCE(sub.used_qty, mcs.used_qty) - COALESCE(sub.planned_qty, mcs.planned_qty),
  planned_cost = COALESCE(sub.planned_qty, mcs.planned_qty) * COALESCE(mcs.rate, 0),
  actual_cost = COALESCE(sub.used_qty, mcs.used_qty) * COALESCE(mcs.rate, 0),
  cost_variance = (COALESCE(sub.used_qty, mcs.used_qty) * COALESCE(mcs.rate, 0)) - (COALESCE(sub.planned_qty, mcs.planned_qty) * COALESCE(mcs.rate, 0)),
  is_boq = COALESCE(sub.is_boq, mcs.is_boq, true),
  last_updated = NOW()
FROM (
  SELECT
    pml.project_id,
    pml.item_id,
    pml.variant_id,
    MAX(pml.planned_qty) AS planned_qty,
    SUM(mi.received_qty) AS received_qty,
    SUM(dmu.quantity_used) AS used_qty,
    bool_or(pml.is_boq) AS is_boq
  FROM project_material_list pml
  LEFT JOIN material_intents mi ON mi.project_id = pml.project_id
    AND mi.item_id = pml.item_id
    AND (mi.variant_id = pml.variant_id OR (mi.variant_id IS NULL AND pml.variant_id IS NULL))
    AND mi.status IN ('Received', 'Partial')
  LEFT JOIN daily_material_usage dmu ON dmu.project_id = pml.project_id
    AND dmu.item_id = pml.item_id
    AND (dmu.variant_id = pml.variant_id OR (dmu.variant_id IS NULL AND pml.variant_id IS NULL))
  GROUP BY pml.project_id, pml.item_id, pml.variant_id
) sub
WHERE mcs.project_id = sub.project_id
  AND mcs.item_id = sub.item_id
  AND (mcs.variant_id = sub.variant_id OR (mcs.variant_id IS NULL AND sub.variant_id IS NULL));
