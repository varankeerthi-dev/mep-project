-- Migration 044: Clean up consumption summary when material is deleted from project list
-- Also fix RLS on material_consumption_summary to allow authenticated org members

-- 1. Add a trigger function that deletes the consumption summary row
--    when a material is removed from the project_material_list
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

DROP TRIGGER IF EXISTS trigger_delete_consumption_on_material_list ON project_material_list;
CREATE TRIGGER trigger_delete_consumption_on_material_list
  AFTER DELETE ON project_material_list
  FOR EACH ROW
  EXECUTE FUNCTION delete_consumption_summary_on_material_delete();

-- 2. Also delete consumption summary rows when ALL daily_usage entries for
--    that item are deleted (no usage left and no material list entry)
CREATE OR REPLACE FUNCTION cleanup_consumption_summary_on_usage_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if any material_list entry still exists for this item
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
    -- Recalculate since usage changed
    INSERT INTO material_consumption_summary (
      project_id, organisation_id, item_id, variant_id,
      planned_qty, received_qty, used_qty, remaining_qty, variance_qty,
      unit, rate, planned_cost, actual_cost, cost_variance, last_updated
    )
    SELECT
      OLD.project_id,
      OLD.organisation_id,
      OLD.item_id,
      OLD.variant_id,
      COALESCE(pml.planned_qty, 0),
      COALESCE(SUM(mi.received_qty), 0),
      COALESCE(SUM(dmu.quantity_used), 0),
      COALESCE(SUM(mi.received_qty), 0) - COALESCE(SUM(dmu.quantity_used), 0),
      COALESCE(SUM(dmu.quantity_used), 0) - COALESCE(pml.planned_qty, 0),
      COALESCE(OLD.unit, pml.unit, 'nos'),
      COALESCE(pml.rate, 0),
      COALESCE(pml.planned_qty, 0) * COALESCE(pml.rate, 0),
      COALESCE(SUM(dmu.quantity_used), 0) * COALESCE(pml.rate, 0),
      (COALESCE(SUM(dmu.quantity_used), 0) * COALESCE(pml.rate, 0)) - (COALESCE(pml.planned_qty, 0) * COALESCE(pml.rate, 0)),
      NOW()
    FROM project_material_list pml
    LEFT JOIN (
      SELECT project_id, item_id, variant_id, SUM(received_qty) as received_qty
      FROM material_intents
      WHERE project_id = OLD.project_id AND item_id = OLD.item_id
        AND (variant_id = OLD.variant_id OR (variant_id IS NULL AND OLD.variant_id IS NULL))
        AND status IN ('Received', 'Partial')
      GROUP BY project_id, item_id, variant_id
    ) mi ON mi.project_id = OLD.project_id AND mi.item_id = OLD.item_id AND mi.variant_id = OLD.variant_id
    LEFT JOIN daily_material_usage dmu ON dmu.project_id = OLD.project_id
      AND dmu.item_id = OLD.item_id
      AND (dmu.variant_id = OLD.variant_id OR (dmu.variant_id IS NULL AND OLD.variant_id IS NULL))
    WHERE pml.project_id = OLD.project_id
      AND pml.item_id = OLD.item_id
      AND (pml.variant_id = OLD.variant_id OR (pml.variant_id IS NULL AND OLD.variant_id IS NULL))
    ON CONFLICT (project_id, item_id, variant_id)
    DO UPDATE SET
      received_qty = EXCLUDED.received_qty,
      used_qty = EXCLUDED.used_qty,
      remaining_qty = EXCLUDED.remaining_qty,
      variance_qty = EXCLUDED.variance_qty,
      actual_cost = EXCLUDED.actual_cost,
      cost_variance = EXCLUDED.cost_variance,
      last_updated = EXCLUDED.last_updated;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Replace the existing DELETE trigger on daily_material_usage
DROP TRIGGER IF EXISTS trigger_update_consumption_on_usage_delete ON daily_material_usage;
CREATE TRIGGER trigger_update_consumption_on_usage_delete
  AFTER DELETE ON daily_material_usage
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_consumption_summary_on_usage_delete();

-- 3. Fix RLS on material_consumption_summary to use is_org_member
DROP POLICY IF EXISTS "Users can view material consumption summary" ON material_consumption_summary;

CREATE POLICY "Users can view material consumption summary"
  ON material_consumption_summary FOR SELECT
  TO authenticated
  USING (is_org_member(auth.uid(), organisation_id));