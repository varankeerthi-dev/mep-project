-- 049: Add supply tracking columns + received_qty to project_material_list
-- Supersedes 048 (never ran in prod)
-- 
-- New columns:
--   supply_qty       → manual entry by user (qty ordered/procured, keyed to source doc)
--   received_qty     → auto-computed from material_intents.received_qty via trigger
--   source_document  → DC No / Invoice No / PO No (client-facing proof)
--   source_type      → 'manual' | 'boq' | 'quotation' (internal origin tracking)
--   source_reference → FK to boq_items.id / quotation_items.id (future use)

ALTER TABLE project_material_list
  ADD COLUMN IF NOT EXISTS supply_qty DECIMAL(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS received_qty DECIMAL(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source_document TEXT,
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_reference UUID;

-- Drop existing 048 trigger names if any remnants
DROP TRIGGER IF EXISTS trg_intent_qty_on_insert ON material_intents;
DROP TRIGGER IF EXISTS trg_intent_qty_on_update ON material_intents;
DROP TRIGGER IF EXISTS trg_intent_qty_on_delete ON material_intents;
DROP FUNCTION IF EXISTS refresh_material_list_intent_qty;
DROP FUNCTION IF EXISTS trigger_refresh_material_list_intent_qty;

-- ---------------------------------------------------------------
-- Function: refresh_material_list_received_qty
-- Re-sum received_qty for a given (project_id, item_id, variant_id)
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION refresh_material_list_received_qty(
  p_project_id UUID,
  p_item_id UUID,
  p_variant_id UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_received DECIMAL(15,2);
BEGIN
  SELECT COALESCE(SUM(mi.received_qty), 0)
  INTO v_received
  FROM material_intents mi
  WHERE mi.project_id = p_project_id
    AND mi.item_id = p_item_id
    AND (mi.variant_id = p_variant_id OR (mi.variant_id IS NULL AND p_variant_id IS NULL))
    AND mi.status != 'Rejected';

  UPDATE project_material_list
  SET
    received_qty = v_received,
    updated_at = NOW()
  WHERE project_id = p_project_id
    AND item_id = p_item_id
    AND (variant_id = p_variant_id OR (variant_id IS NULL AND p_variant_id IS NULL));
END;
$$;

-- ---------------------------------------------------------------
-- Trigger function: call refresh on intent insert/update/delete
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_refresh_received_qty()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_project_id UUID;
  v_item_id UUID;
  v_variant_id UUID;
BEGIN
  v_project_id := COALESCE(NEW.project_id, OLD.project_id);
  v_item_id := COALESCE(NEW.item_id, OLD.item_id);
  v_variant_id := COALESCE(NEW.variant_id, OLD.variant_id);

  PERFORM refresh_material_list_received_qty(v_project_id, v_item_id, v_variant_id);

  IF TG_OP = 'UPDATE' THEN
    IF (OLD.project_id IS DISTINCT FROM NEW.project_id)
    OR (OLD.item_id IS DISTINCT FROM NEW.item_id)
    OR (OLD.variant_id IS DISTINCT FROM NEW.variant_id) THEN
      PERFORM refresh_material_list_received_qty(OLD.project_id, OLD.item_id, OLD.variant_id);
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_received_qty_on_insert
  AFTER INSERT ON material_intents
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refresh_received_qty();

CREATE TRIGGER trg_received_qty_on_update
  AFTER UPDATE ON material_intents
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refresh_received_qty();

CREATE TRIGGER trg_received_qty_on_delete
  AFTER DELETE ON material_intents
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refresh_received_qty();

-- ---------------------------------------------------------------
-- Backfill received_qty for existing rows
-- ---------------------------------------------------------------
UPDATE project_material_list pml
SET received_qty = COALESCE((
  SELECT SUM(mi.received_qty)
  FROM material_intents mi
  WHERE mi.project_id = pml.project_id
    AND mi.item_id = pml.item_id
    AND (mi.variant_id = pml.variant_id OR (mi.variant_id IS NULL AND pml.variant_id IS NULL))
    AND mi.status != 'Rejected'
), 0);
