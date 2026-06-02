-- Site Report Approval Flow (Phase D)
-- Run this in Supabase SQL Editor AFTER Phase A/B/C migrations are applied
--
-- Adds:
--   1. approvals.assigned_approver_id — engineer-picked approver
--   2. CHECK constraint on approval_type including SITE_REPORT_REQUEST
--   3. approvable_members view — list of org members eligible to be picked
--   4. Indexes for the new query patterns

-- ============================================
-- 1. Add assigned_approver_id column
-- ============================================
ALTER TABLE approvals
  ADD COLUMN IF NOT EXISTS assigned_approver_id UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_approvals_assigned_approver
  ON approvals(assigned_approver_id)
  WHERE assigned_approver_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_approvals_reference
  ON approvals(reference_type, reference_id);

-- ============================================
-- 2. Add CHECK constraint on approval_type
--    Use a defensive approach: drop any existing constraint, then add.
--    Includes SITE_REPORT_REQUEST for site report approval flow.
-- ============================================
DO $$
DECLARE
  cname text;
BEGIN
  -- Find existing approval_type CHECK constraint (if any) by name
  SELECT con.conname INTO cname
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'approvals'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) LIKE '%approval_type%';

  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE approvals DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE approvals
  ADD CONSTRAINT approvals_approval_type_check
  CHECK (approval_type IN (
    'PURCHASE_ORDER',
    'WORK_ORDER',
    'QUOTATION',
    'INVOICE',
    'PROFORMA_INVOICE',
    'PAYMENT_REQUEST',
    'MATERIAL_DISPATCH',
    'SITE_VISIT',
    'EXPENSE_CLAIM',
    'SITE_REPORT_REQUEST'
  ));

-- ============================================
-- 3. approvable_members view
--    List org members with role in (MD, PM, Manager, admin)
--    Used by site report form's "Submit for Approval" approver picker.
-- ============================================
CREATE OR REPLACE VIEW approvable_members AS
SELECT
  om.organisation_id,
  om.user_id,
  COALESCE(up.full_name, au.email::text) AS full_name,
  au.email::text AS email,
  om.role
FROM org_members om
JOIN auth.users au ON au.id = om.user_id
LEFT JOIN user_profiles up ON up.user_id = om.user_id
WHERE om.status = 'active'
  AND UPPER(om.role) IN ('MD', 'PM', 'MANAGER', 'ADMIN');

GRANT SELECT ON approvable_members TO authenticated;

-- ============================================
-- 4. Helper RPC: get_approvable_members_for_org
--    Same as the view but parameterised by org_id (RSC-friendly)
-- ============================================
CREATE OR REPLACE FUNCTION get_approvable_members_for_org(p_organisation_id UUID)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  email TEXT,
  role VARCHAR
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    om.user_id,
    COALESCE(up.full_name, au.email::text) AS full_name,
    au.email::text AS email,
    om.role
  FROM org_members om
  JOIN auth.users au ON au.id = om.user_id
  LEFT JOIN user_profiles up ON up.user_id = om.user_id
  WHERE om.organisation_id = p_organisation_id
    AND om.status = 'active'
    AND UPPER(om.role) IN ('MD', 'PM', 'MANAGER', 'ADMIN')
  ORDER BY COALESCE(up.full_name, au.email::text);
END;
$$;

GRANT EXECUTE ON FUNCTION get_approvable_members_for_org(UUID) TO authenticated;
