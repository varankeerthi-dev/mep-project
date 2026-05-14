-- Migration 045: Fix consumption summary calculations
-- remaining_qty should be planned_qty - used_qty (not received - used)
-- variance_qty should be used - planned (positive = over budget)

CREATE OR REPLACE FUNCTION update_material_consumption_summary()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO material_consumption_summary (
    project_id, organisation_id, item_id, variant_id,
    planned_qty, received_qty, used_qty, remaining_qty, variance_qty,
    unit, rate, planned_cost, actual_cost, cost_variance, last_updated
  )
  SELECT
    NEW.project_id,
    NEW.organisation_id,
    NEW.item_id,
    NEW.variant_id,
    COALESCE(pml.planned_qty, 0),
    COALESCE(SUM(mi.received_qty), 0),
    COALESCE(SUM(dmu.quantity_used), 0),
    COALESCE(pml.planned_qty, 0) - COALESCE(SUM(dmu.quantity_used), 0),
    COALESCE(SUM(dmu.quantity_used), 0) - COALESCE(pml.planned_qty, 0),
    COALESCE(NEW.unit, pml.unit, 'nos'),
    COALESCE(pml.rate, 0),
    COALESCE(pml.planned_qty, 0) * COALESCE(pml.rate, 0),
    COALESCE(SUM(dmu.quantity_used), 0) * COALESCE(pml.rate, 0),
    (COALESCE(SUM(dmu.quantity_used), 0) * COALESCE(pml.rate, 0)) - (COALESCE(pml.planned_qty, 0) * COALESCE(pml.rate, 0)),
    NOW()
  FROM project_material_list pml
  LEFT JOIN (
    SELECT project_id, item_id, variant_id, SUM(received_qty) as received_qty
    FROM material_intents
    WHERE project_id = NEW.project_id
      AND status IN ('Received', 'Partial')
    GROUP BY project_id, item_id, variant_id
  ) mi ON mi.project_id = NEW.project_id AND mi.item_id = NEW.item_id AND mi.variant_id = NEW.variant_id
  LEFT JOIN daily_material_usage dmu ON dmu.project_id = NEW.project_id
    AND dmu.item_id = NEW.item_id
    AND (dmu.variant_id = NEW.variant_id OR (dmu.variant_id IS NULL AND NEW.variant_id IS NULL))
  WHERE pml.project_id = NEW.project_id
    AND pml.item_id = NEW.item_id
    AND (pml.variant_id = NEW.variant_id OR (pml.variant_id IS NULL AND NEW.variant_id IS NULL))
  ON CONFLICT (project_id, item_id, variant_id)
  DO UPDATE SET
    planned_qty = EXCLUDED.planned_qty,
    received_qty = EXCLUDED.received_qty,
    used_qty = EXCLUDED.used_qty,
    remaining_qty = EXCLUDED.remaining_qty,
    variance_qty = EXCLUDED.variance_qty,
    actual_cost = EXCLUDED.actual_cost,
    cost_variance = EXCLUDED.cost_variance,
    last_updated = EXCLUDED.last_updated;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also update the 044 cleanup function to use the same correct formula
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
      COALESCE(pml.planned_qty, 0) - COALESCE(SUM(dmu.quantity_used), 0),
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
      planned_qty = EXCLUDED.planned_qty,
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

-- Recalculate all existing consumption summary rows with the corrected formula
UPDATE material_consumption_summary mcs
SET
  remaining_qty = mcs.planned_qty - mcs.used_qty,
  variance_qty = mcs.used_qty - mcs.planned_qty,
  cost_variance = mcs.actual_cost - mcs.planned_cost
WHERE mcs.planned_qty IS NOT NULL;