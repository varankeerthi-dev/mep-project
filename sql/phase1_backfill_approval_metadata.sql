-- Phase 1 backfill — populate denormalized columns on existing approval rows.
-- Safe to re-run; uses COALESCE so it never overwrites populated values.
-- Run AFTER phase1_approvals_denorm.sql.

CREATE OR REPLACE FUNCTION public.backfill_approval_denorm(p_org_id UUID)
RETURNS TABLE(
  step TEXT,
  updated_count INTEGER
) AS $$
DECLARE
  v_requesters INTEGER := 0;
  v_projects   INTEGER := 0;
  v_refs       INTEGER := 0;
  r            RECORD;
BEGIN
  -- 1. Requester name + role from user_profiles (+ org_members role if available)
  UPDATE approvals a
  SET
    requester_name = COALESCE(a.requester_name, up.full_name),
    requester_role = COALESCE(a.requester_role, om.role, up.role)
  FROM user_profiles up
  LEFT JOIN org_members om
    ON om.user_id = up.user_id
   AND om.organisation_id = a.organisation_id
  WHERE a.organisation_id = p_org_id
    AND a.requested_by = up.user_id
    AND (a.requester_name IS NULL OR a.requester_role IS NULL);
  GET DIAGNOSTICS v_requesters = ROW_COUNT;

  -- 2. Project name from projects (when project_id is set)
  UPDATE approvals a
  SET project_name = p.name
  FROM projects p
  WHERE a.organisation_id = p_org_id
    AND a.project_id = p.id
    AND a.project_name IS NULL;
  GET DIAGNOSTICS v_projects = ROW_COUNT;

  -- 3. Reference number per source table
  FOR r IN
    SELECT id, reference_type, reference_id
    FROM approvals
    WHERE organisation_id = p_org_id
      AND reference_number IS NULL
  LOOP
    CASE r.reference_type
      WHEN 'payment_requests' THEN
        UPDATE approvals SET reference_number = (
          SELECT request_no FROM payment_requests WHERE id = r.reference_id
        ) WHERE id = r.id;
      WHEN 'purchase_payments' THEN
        UPDATE approvals SET reference_number = (
          SELECT voucher_no FROM purchase_payments WHERE id = r.reference_id
        ) WHERE id = r.id;
      WHEN 'subcontractor_payments' THEN
        UPDATE approvals SET reference_number = (
          SELECT voucher_no FROM subcontractor_payments WHERE id = r.reference_id
        ) WHERE id = r.id;
      WHEN 'purchase_orders' THEN
        UPDATE approvals SET reference_number = (
          SELECT po_number FROM purchase_orders WHERE id = r.reference_id
        ) WHERE id = r.id;
      WHEN 'work_orders' THEN
        UPDATE approvals SET reference_number = (
          SELECT wo_number FROM work_orders WHERE id = r.reference_id
        ) WHERE id = r.id;
      WHEN 'invoices' THEN
        UPDATE approvals SET reference_number = (
          SELECT invoice_number FROM invoices WHERE id = r.reference_id
        ) WHERE id = r.id;
      WHEN 'quotations' THEN
        UPDATE approvals SET reference_number = (
          SELECT quotation_number FROM quotations WHERE id = r.reference_id
        ) WHERE id = r.id;
      WHEN 'material_dispatches' THEN
        UPDATE approvals SET reference_number = (
          SELECT dispatch_number FROM material_dispatches WHERE id = r.reference_id
        ) WHERE id = r.id;
      ELSE
        -- Unknown reference_type, skip
        NULL;
    END CASE;
  END LOOP;
  SELECT COUNT(*) INTO v_refs
  FROM approvals
  WHERE organisation_id = p_org_id
    AND reference_number IS NOT NULL;

  RETURN QUERY
  SELECT 'requester'::TEXT, v_requesters
  UNION ALL SELECT 'project', v_projects
  UNION ALL SELECT 'reference_number_total', v_refs;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.backfill_approval_denorm(UUID) TO authenticated;
