-- 20260922000001_purchase_returns_rpc_fix.sql
-- Fix convert_purchase_return_to_debit_note to include return_qty

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
