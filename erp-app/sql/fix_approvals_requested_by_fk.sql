-- ============================================================
-- Migration: re-point approvals.requested_by FK to auth.users
-- Existing code stores supabase auth.user.id; original schema
-- pointed at public.users(id) causing FK violations.
-- ============================================================

ALTER TABLE approvals
  DROP CONSTRAINT IF EXISTS approvals_requested_by_fkey;

ALTER TABLE approvals
  ADD CONSTRAINT approvals_requested_by_fkey
  FOREIGN KEY (requested_by)
  REFERENCES auth.users(id)
  ON DELETE SET NULL;

-- Also fix approval_actions if it has the same mismatch
ALTER TABLE approval_actions
  DROP CONSTRAINT IF EXISTS approval_actions_approver_id_fkey;

ALTER TABLE approval_actions
  ADD CONSTRAINT approval_actions_approver_id_fkey
  FOREIGN KEY (approver_id)
  REFERENCES auth.users(id)
  ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';
