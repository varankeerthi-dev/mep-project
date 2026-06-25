-- Edge cases handling for approvals (re-runnable)

-- 1. Approvals Status Constraint Update
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'approvals_status_check'
      AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    ALTER TABLE approvals DROP CONSTRAINT approvals_status_check;
  END IF;
END $$;

ALTER TABLE approvals ADD CONSTRAINT approvals_status_check CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'HOLD', 'FORWARDED', 'RETURNED'));

-- 2. Update approval_actions action constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'approval_actions_action_check'
      AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    ALTER TABLE approval_actions DROP CONSTRAINT approval_actions_action_check;
  END IF;
END $$;

ALTER TABLE approval_actions ADD CONSTRAINT approval_actions_action_check CHECK (action IN ('APPROVED', 'REJECTED', 'HOLD', 'FORWARDED', 'CANCELLED', 'RETURNED', 'RESUBMITTED'));

-- 3. Add columns to approvals table
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS hold_reason TEXT;
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS is_resubmitted BOOLEAN DEFAULT false;
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS resubmission_notes TEXT;

-- 4. Add amount_approved to payment tables
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS amount_approved DECIMAL(15,2);
ALTER TABLE purchase_payments ADD COLUMN IF NOT EXISTS amount_approved DECIMAL(15,2);
ALTER TABLE subcontractor_payments ADD COLUMN IF NOT EXISTS amount_approved DECIMAL(15,2);
