-- ============================================================
-- Material attribute metadata and production traceability
-- Apply after sql/material_custom_attributes.sql.
-- Existing rows remain valid: their type defaults to text.
-- ============================================================

ALTER TABLE attribute_definitions
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS data_type TEXT NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS category_scopes TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_printable BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE material_custom_attributes
  ADD COLUMN IF NOT EXISTS attribute_definition_id UUID REFERENCES attribute_definitions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS data_type TEXT NOT NULL DEFAULT 'text';

UPDATE attribute_definitions
SET data_type = 'text'
WHERE data_type IS NULL OR data_type = '';

UPDATE material_custom_attributes
SET data_type = 'text'
WHERE data_type IS NULL OR data_type = '';

ALTER TABLE attribute_definitions
  DROP CONSTRAINT IF EXISTS attribute_definitions_data_type_check;

ALTER TABLE attribute_definitions
  ADD CONSTRAINT attribute_definitions_data_type_check
  CHECK (data_type IN ('text', 'alphanumeric', 'number', 'date', 'boolean'));

ALTER TABLE material_custom_attributes
  DROP CONSTRAINT IF EXISTS material_custom_attributes_data_type_check;

ALTER TABLE material_custom_attributes
  ADD CONSTRAINT material_custom_attributes_data_type_check
  CHECK (data_type IN ('text', 'alphanumeric', 'number', 'date', 'boolean'));

CREATE INDEX IF NOT EXISTS idx_attr_def_category_scopes
  ON attribute_definitions USING GIN (category_scopes);

CREATE INDEX IF NOT EXISTS idx_mca_definition
  ON material_custom_attributes(attribute_definition_id);

-- Production output metadata already has batch_no in the manufacturing schema.
-- Add expiry_date for manufactured medical/chemical goods without changing
-- the existing production-entry contract.
ALTER TABLE production_entries
  ADD COLUMN IF NOT EXISTS expiry_date DATE;

CREATE INDEX IF NOT EXISTS idx_production_entries_batch
  ON production_entries(organisation_id, batch_no)
  WHERE batch_no IS NOT NULL AND batch_no <> '';

-- Generate a stable batch number when the production team leaves it blank.
-- The advisory lock prevents duplicate numbers for the same organisation/date.
CREATE OR REPLACE FUNCTION generate_production_batch_no(p_organisation_id UUID, p_production_date DATE)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_next INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_organisation_id::TEXT, 0));

  SELECT COUNT(*) + 1
    INTO v_next
    FROM production_entries
   WHERE organisation_id = p_organisation_id
     AND production_date = p_production_date;

  RETURN 'FG-' || to_char(p_production_date, 'YYYYMMDD') || '-' || lpad(v_next::TEXT, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION assign_production_batch_no()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.batch_no IS NULL OR btrim(NEW.batch_no) = '' THEN
    NEW.batch_no := generate_production_batch_no(
      NEW.organisation_id,
      COALESCE(NEW.production_date, CURRENT_DATE)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS production_entries_assign_batch_no ON production_entries;

CREATE TRIGGER production_entries_assign_batch_no
BEFORE INSERT ON production_entries
FOR EACH ROW
EXECUTE FUNCTION assign_production_batch_no();

-- Lot-level finished-goods traceability. Existing aggregate item_stock remains
-- the compatibility stock total; new receipts/production can additionally be
-- tracked by lot without changing existing stock records.
CREATE TABLE IF NOT EXISTS inventory_lots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  batch_no TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'production',
  source_id UUID,
  production_entry_id UUID REFERENCES production_entries(id) ON DELETE SET NULL,
  qc_inspection_id UUID,
  manufacture_date DATE,
  expiry_date DATE,
  quantity_received NUMERIC NOT NULL DEFAULT 0 CHECK (quantity_received >= 0),
  quantity_available NUMERIC NOT NULL DEFAULT 0 CHECK (quantity_available >= 0),
  status TEXT NOT NULL DEFAULT 'available',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organisation_id, material_id, warehouse_id, batch_no)
);

CREATE INDEX IF NOT EXISTS idx_inventory_lots_available
  ON inventory_lots(organisation_id, material_id, warehouse_id, expiry_date)
  WHERE quantity_available > 0 AND status = 'available';

ALTER TABLE inventory_lots ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'org_access_inventory_lots' AND tablename = 'inventory_lots') THEN
    CREATE POLICY "org_access_inventory_lots" ON inventory_lots
      FOR ALL USING (organisation_id IN (SELECT organisation_id FROM org_members WHERE user_id = auth.uid()));
  END IF;
END $$;

ALTER TABLE dispatch_items
  ADD COLUMN IF NOT EXISTS inventory_lot_id UUID REFERENCES inventory_lots(id) ON DELETE SET NULL;

-- Consume a selected lot and its aggregate stock atomically at dispatch time.
CREATE OR REPLACE FUNCTION consume_inventory_lot(
  p_lot_id UUID,
  p_quantity NUMERIC,
  p_organisation_id UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lot inventory_lots%ROWTYPE;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_organisations
     WHERE organisation_id = p_organisation_id
       AND user_id = auth.uid()
       AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not a member of this organisation');
  END IF;

  IF p_quantity <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Dispatch quantity must be greater than zero');
  END IF;

  SELECT * INTO v_lot
    FROM inventory_lots
   WHERE id = p_lot_id
     AND organisation_id = p_organisation_id
     AND status = 'available'
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Selected inventory batch was not found or is no longer available');
  END IF;

  IF v_lot.quantity_available < p_quantity THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Selected inventory batch does not have enough quantity');
  END IF;

  UPDATE inventory_lots
     SET quantity_available = quantity_available - p_quantity,
         status = CASE WHEN quantity_available - p_quantity = 0 THEN 'exhausted' ELSE 'available' END,
         updated_at = NOW()
   WHERE id = p_lot_id;

  UPDATE item_stock
     SET current_stock = GREATEST(0, current_stock - p_quantity),
         updated_at = NOW()
   WHERE item_id = v_lot.material_id
     AND warehouse_id = v_lot.warehouse_id
     AND organisation_id = p_organisation_id;

  RETURN jsonb_build_object('ok', true, 'lot_id', p_lot_id, 'batch_no', v_lot.batch_no);
END;
$$;
