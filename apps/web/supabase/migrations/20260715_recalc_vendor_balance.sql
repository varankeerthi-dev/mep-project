CREATE OR REPLACE FUNCTION recalc_vendor_balance(p_vendor_id UUID, p_organisation_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_opening_balance NUMERIC;
  v_total_bills NUMERIC;
  v_total_payments NUMERIC;
  v_total_dn NUMERIC;
  v_current_balance NUMERIC;
BEGIN
  -- Get opening balance
  SELECT COALESCE(opening_balance, 0) INTO v_opening_balance
  FROM purchase_vendors
  WHERE id = p_vendor_id AND organisation_id = p_organisation_id;

  -- Get total bills
  SELECT COALESCE(SUM(total_amount), 0) INTO v_total_bills
  FROM purchase_bills
  WHERE vendor_id = p_vendor_id AND organisation_id = p_organisation_id;

  -- Get total payments
  SELECT COALESCE(SUM(amount), 0) INTO v_total_payments
  FROM purchase_payments
  WHERE vendor_id = p_vendor_id AND organisation_id = p_organisation_id;

  -- Get total approved debit notes
  SELECT COALESCE(SUM(total_amount), 0) INTO v_total_dn
  FROM debit_notes
  WHERE vendor_id = p_vendor_id AND organisation_id = p_organisation_id AND approval_status = 'Approved';

  v_current_balance := v_opening_balance + v_total_bills - v_total_payments - v_total_dn;

  UPDATE purchase_vendors
  SET current_balance = v_current_balance
  WHERE id = p_vendor_id AND organisation_id = p_organisation_id;
END;
$$;
