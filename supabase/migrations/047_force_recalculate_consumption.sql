-- Migration 047: Force recalculate all consumption summary rows
-- This manually recalculates used_qty and remaining_qty for all materials

UPDATE material_consumption_summary mcs
SET 
  used_qty = sub.used_qty,
  remaining_qty = GREATEST(COALESCE(mcs.planned_qty, 0), COALESCE(mcs.received_qty, 0)) - COALESCE(sub.used_qty, 0),
  variance_qty = COALESCE(sub.used_qty, 0) - GREATEST(COALESCE(mcs.planned_qty, 0), COALESCE(mcs.received_qty, 0)),
  actual_cost = COALESCE(sub.used_qty, 0) * COALESCE(mcs.rate, 0),
  cost_variance = (COALESCE(sub.used_qty, 0) * COALESCE(mcs.rate, 0)) - mcs.planned_cost,
  last_updated = NOW()
FROM (
  SELECT 
    dmu.project_id,
    dmu.item_id,
    dmu.variant_id,
    SUM(dmu.quantity_used) as used_qty
  FROM daily_material_usage dmu
  GROUP BY dmu.project_id, dmu.item_id, dmu.variant_id
) sub
WHERE mcs.project_id = sub.project_id
  AND mcs.item_id = sub.item_id
  AND (mcs.variant_id = sub.variant_id OR (mcs.variant_id IS NULL AND sub.variant_id IS NULL));