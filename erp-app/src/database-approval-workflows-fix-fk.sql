-- Fix approval_workflows.approver_id foreign key so it matches user_profiles.user_id
-- instead of an incompatible id column. Drop any conflicting unique/index first.

BEGIN;

-- Best effort: remove conflicting index that may block the FK change.
DROP INDEX IF EXISTS public.idx_user_profiles_id_unique;

-- Recreate the FK against the correct user id column.
ALTER TABLE public.approval_workflows
  DROP CONSTRAINT IF EXISTS approval_workflows_approver_id_fkey;

ALTER TABLE public.approval_workflows
  ADD CONSTRAINT approval_workflows_approver_id_fkey
  FOREIGN KEY (approver_id)
  REFERENCES public.user_profiles(user_id)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

COMMIT;
