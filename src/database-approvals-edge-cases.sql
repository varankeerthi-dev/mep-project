-- Edge cases handling for approvals

-- 1. Approvals Status Constraint Update
-- Drop the existing constraint if it exists (Supabase might have auto-named it or it might be named something specific, so we will handle it safely by dropping all check constraints on 'status' and recreating, or just altering the type if it was a domain. Since it's a CHECK constraint on VARCHAR, we can drop and recreate).
DO $$
DECLARE
    conname text;
BEGIN
    SELECT constraint_name INTO conname
    FROM information_schema.table_constraints
    WHERE table_name = 'approvals' AND constraint_type = 'CHECK' AND constraint_name LIKE '%status%';
    
    IF conname IS NOT NULL THEN
        EXECUTE 'ALTER TABLE approvals DROP CONSTRAINT ' || quote_ident(conname);
    END IF;
END $$;

ALTER TABLE approvals ADD CONSTRAINT approvals_status_check CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'HOLD', 'FORWARDED', 'RETURNED'));

-- Update approval_actions action constraint
DO $$
DECLARE
    conname text;
BEGIN
    SELECT constraint_name INTO conname
    FROM information_schema.table_constraints
    WHERE table_name = 'approval_actions' AND constraint_type = 'CHECK' AND constraint_name LIKE '%action%';
    
    IF conname IS NOT NULL THEN
        EXECUTE 'ALTER TABLE approval_actions DROP CONSTRAINT ' || quote_ident(conname);
    END IF;
END $$;

ALTER TABLE approval_actions ADD CONSTRAINT approval_actions_action_check CHECK (action IN ('APPROVED', 'REJECTED', 'HOLD', 'FORWARDED', 'CANCELLED', 'RETURNED', 'RESUBMITTED'));

-- 2. Add columns to approvals table
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS hold_reason TEXT;
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS is_resubmitted BOOLEAN DEFAULT false;
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS resubmission_notes TEXT;

-- 3. Add amount_approved to payment tables
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS amount_approved DECIMAL(15,2);
ALTER TABLE purchase_payments ADD COLUMN IF NOT EXISTS amount_approved DECIMAL(15,2);
ALTER TABLE subcontractor_payments ADD COLUMN IF NOT EXISTS amount_approved DECIMAL(15,2);
