-- 20260922000000_purchase_returns.sql
-- Purchase Returns (operational/logistics layer before Debit Note)

CREATE TABLE IF NOT EXISTS purchase_returns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  return_number VARCHAR(50) UNIQUE NOT NULL,
  vendor_id UUID NOT NULL REFERENCES purchase_vendors(id) ON DELETE RESTRICT,
  grn_id UUID REFERENCES goods_receipt_notes(id) ON DELETE SET NULL,
  return_date DATE NOT NULL,
  reason TEXT NOT NULL,
  return_type VARCHAR(30) DEFAULT 'credit_note', -- credit_note | delivery_challan
  status VARCHAR(30) DEFAULT 'Draft', -- Draft | Approved | Rejected | Converted
  debit_note_id UUID, -- populated when converted to debit note
  notes TEXT,
  created_by UUID,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE purchase_returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access" ON purchase_returns FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_org ON purchase_returns(organisation_id);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_vendor ON purchase_returns(vendor_id);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_grn ON purchase_returns(grn_id);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_status ON purchase_returns(status);

-- Purchase Return Items
CREATE TABLE IF NOT EXISTS purchase_return_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  purchase_return_id UUID NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
  material_id UUID NOT NULL,
  grn_item_id UUID,
  serial_number VARCHAR(100),
  quantity DECIMAL(12,3) NOT NULL,
  unit VARCHAR(20) NOT NULL DEFAULT 'Nos',
  batch_no VARCHAR(50),
  warranty_start_date DATE,
  warranty_end_date DATE,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE purchase_return_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access" ON purchase_return_items FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_purchase_return_items_org ON purchase_return_items(organisation_id);
CREATE INDEX IF NOT EXISTS idx_purchase_return_items_return ON purchase_return_items(purchase_return_id);

-- RPC: Create Purchase Return
CREATE OR REPLACE FUNCTION create_purchase_return(
  p_organisation_id UUID,
  p_vendor_id UUID,
  p_grn_id UUID DEFAULT NULL,
  p_return_number VARCHAR DEFAULT NULL,
  p_return_date DATE DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_return_type VARCHAR DEFAULT 'credit_note',
  p_items JSONB DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_return_id UUID;
  v_return_number VARCHAR(50);
  v_seq INTEGER;
BEGIN
  IF p_return_number IS NULL THEN
    SELECT COALESCE(MAX(CAST(SUBSTRING(return_number FROM 'PR-(\d+)') AS INTEGER)), 0) + 1
    INTO v_seq
    FROM purchase_returns
    WHERE organisation_id = p_organisation_id
      AND return_number LIKE 'PR-%';
    v_return_number := 'PR-' || LPAD(v_seq::TEXT, 4, '0');
  ELSE
    v_return_number := p_return_number;
  END IF;

  INSERT INTO purchase_returns (
    organisation_id, vendor_id, grn_id, return_number, return_date, reason, return_type, created_by
  )
  VALUES (
    p_organisation_id, p_vendor_id, p_grn_id, v_return_number,
    COALESCE(p_return_date, CURRENT_DATE),
    p_reason, p_return_type, p_created_by
  )
  RETURNING id INTO v_return_id;

  IF p_items IS NOT NULL THEN
    INSERT INTO purchase_return_items (
      organisation_id, purchase_return_id, material_id, grn_item_id,
      serial_number, quantity, unit, batch_no, warranty_start_date, warranty_end_date, reason
    )
    SELECT
      p_organisation_id,
      v_return_id,
      (item->>'material_id')::UUID,
      NULLIF(item->>'grn_item_id', '')::UUID,
      item->>'serial_number',
      (item->>'quantity')::DECIMAL,
      COALESCE(NULLIF(item->>'unit', ''), 'Nos'),
      NULLIF(item->>'batch_no', ''),
      NULLIF(item->>'warranty_start_date', '')::DATE,
      NULLIF(item->>'warranty_end_date', '')::DATE,
      item->>'reason'
    FROM jsonb_array_elements(p_items) AS item;
  END IF;

  RETURN v_return_id;
END;
$$;

-- RPC: Convert Purchase Return to Debit Note
CREATE OR REPLACE FUNCTION convert_purchase_return_to_debit_note(
  p_purchase_return_id UUID,
  p_organisation_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_return RECORD;
  v_bill_id UUID := NULL;
  v_debit_note_id UUID;
  v_debit_note_number VARCHAR(50);
  v_seq INTEGER;
BEGIN
  SELECT * INTO v_return FROM purchase_returns WHERE id = p_purchase_return_id AND organisation_id = p_organisation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase return not found';
  END IF;
  IF v_return.status = 'Converted' THEN
    RAISE EXCEPTION 'Purchase return already converted to debit note';
  END IF;

  SELECT COALESCE(MAX(CAST(SUBSTRING(dn_number FROM 'DN-(\d+)') AS INTEGER)), 0) + 1
  INTO v_seq
  FROM debit_notes
  WHERE organisation_id = p_organisation_id
    AND dn_number LIKE 'DN-%';
  v_debit_note_number := 'DN-' || LPAD(v_seq::TEXT, 4, '0');

  INSERT INTO debit_notes (
    organisation_id, vendor_id, bill_id, dn_number, dn_date, dn_type, reason,
    created_by, approval_status
  )
  VALUES (
    p_organisation_id,
    v_return.vendor_id,
    v_bill_id,
    v_debit_note_number,
    v_return.return_date,
    'Purchase Return',
    v_return.reason,
    v_return.created_by,
    'Draft'
  )
  RETURNING id INTO v_debit_note_id;

  INSERT INTO debit_note_items (
    organisation_id, dn_id, item_name, return_qty, quantity, unit, rate, reason
  )
  SELECT
    p_organisation_id,
    v_debit_note_id,
    COALESCE(m.name, 'Unknown Item'),
    pri.quantity,
    pri.quantity,
    pri.unit,
    0,
    pri.reason
  FROM purchase_return_items pri
  LEFT JOIN materials m ON m.id = pri.material_id
  WHERE pri.purchase_return_id = p_purchase_return_id;

  UPDATE purchase_returns
  SET status = 'Converted', debit_note_id = v_debit_note_id, updated_at = NOW()
  WHERE id = p_purchase_return_id;

  RETURN v_debit_note_id;
END;
$$;
