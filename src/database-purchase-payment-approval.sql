-- Approval flow columns for purchase_payments
ALTER TABLE purchase_payments
  ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'Not Required',
  ADD COLUMN IF NOT EXISTS approval_id UUID,
  ADD COLUMN IF NOT EXISTS approved_by UUID,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS released_by UUID,
  ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS released_amount DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS workflow_step VARCHAR(30) DEFAULT 'created',
  ADD COLUMN IF NOT EXISTS reference_no VARCHAR(100),
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

ALTER TABLE purchase_payments
  ADD CONSTRAINT fk_purchase_payments_approval
    FOREIGN KEY (approval_id) REFERENCES approvals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_purchase_payments_approval_status
  ON purchase_payments(organisation_id, approval_status, workflow_step);
