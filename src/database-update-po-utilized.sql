-- Function to update PO utilized value when invoice is created
CREATE OR REPLACE FUNCTION update_po_utilized_value(
  p_po_id UUID,
  p_invoice_amount DECIMAL
)
RETURNS VOID AS $$
DECLARE
  current_utilized DECIMAL;
  new_utilized DECIMAL;
BEGIN
  -- Get current utilized value
  SELECT COALESCE(po_utilized_value, 0) INTO current_utilized
  FROM client_purchase_orders
  WHERE id = p_po_id;
  
  -- Calculate new utilized value
  new_utilized := current_utilized + p_invoice_amount;
  
  -- Update PO with new utilized value and recalculate available value
  UPDATE client_purchase_orders
  SET 
    po_utilized_value = new_utilized,
    po_available_value = po_total_value - new_utilized,
    updated_at = NOW()
  WHERE id = p_po_id;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION update_po_utilized_value TO authenticated, anon;
