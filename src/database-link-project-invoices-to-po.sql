-- =============================================================================
-- Link project_invoices to client_purchase_orders (po_id)
-- Add automatic sync of client_purchase_orders.po_utilized_value /
-- po_available_value from project_invoices (in addition to the existing
-- update_po_utilized_value RPC used by the sales-invoices module).
--
-- This enables per-PO utilization in the Project Detail → Transactions tab
-- and prevents over-invoicing.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Add po_id column to project_invoices
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_invoices' AND column_name = 'po_id'
  ) THEN
    ALTER TABLE project_invoices
      ADD COLUMN po_id UUID REFERENCES client_purchase_orders(id) ON DELETE SET NULL;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. Index for fast per-PO lookups
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_project_invoices_po_id
  ON project_invoices(po_id);

-- -----------------------------------------------------------------------------
-- 3. Re-compute a PO's utilized value from project_invoices (excluding
--    cancelled invoices). Used by the trigger and as a public RPC.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION recompute_po_utilized_from_project_invoices(p_po_id UUID)
RETURNS VOID AS $$
DECLARE
  v_utilized DECIMAL(15,2);
  v_total    DECIMAL(15,2);
BEGIN
  SELECT COALESCE(po_total_value, 0) INTO v_total
  FROM client_purchase_orders
  WHERE id = p_po_id;

  IF v_total IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(total_amount), 0) INTO v_utilized
  FROM project_invoices
  WHERE po_id = p_po_id
    AND status <> 'Cancelled';

  -- Clamp at the PO total so we never show negative available value from
  -- a bad data entry.
  IF v_utilized < 0 THEN
    v_utilized := 0;
  ELSIF v_utilized > v_total THEN
    v_utilized := v_total;
  END IF;

  UPDATE client_purchase_orders
  SET
    po_utilized_value = v_utilized,
    po_available_value = v_total - v_utilized,
    updated_at = NOW()
  WHERE id = p_po_id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION recompute_po_utilized_from_project_invoices TO authenticated, anon;

-- -----------------------------------------------------------------------------
-- 4. Trigger to keep utilization in sync whenever project_invoices change
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_project_invoices_sync_po_utilization()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.po_id IS NOT NULL THEN
      PERFORM recompute_po_utilized_from_project_invoices(OLD.po_id);
    END IF;
    RETURN OLD;
  END IF;

  -- INSERT / UPDATE: recompute for the new (or both old + new) PO ids.
  IF NEW.po_id IS NOT NULL THEN
    PERFORM recompute_po_utilized_from_project_invoices(NEW.po_id);
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.po_id IS NOT NULL
     AND (OLD.po_id IS DISTINCT FROM NEW.po_id) THEN
    PERFORM recompute_po_utilized_from_project_invoices(OLD.po_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_project_invoices_sync_po ON project_invoices;
CREATE TRIGGER trg_project_invoices_sync_po_utilization
  AFTER INSERT OR UPDATE OR DELETE ON project_invoices
  FOR EACH ROW
  EXECUTE FUNCTION trg_project_invoices_sync_po_utilization();

-- -----------------------------------------------------------------------------
-- 5. Public RPC: recompute utilization for a single PO (callable from the
--    UI as a manual "recalculate" safety net).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION recompute_project_po_utilization(p_po_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_utilized DECIMAL(15,2);
BEGIN
  PERFORM recompute_po_utilized_from_project_invoices(p_po_id);

  SELECT po_utilized_value INTO v_utilized
  FROM client_purchase_orders
  WHERE id = p_po_id;

  RETURN COALESCE(v_utilized, 0);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION recompute_project_po_utilization TO authenticated, anon;
