-- Migration to link Procurement and Work Orders to Issues (Phase 3)
ALTER TABLE purchase_orders
ADD COLUMN IF NOT EXISTS issue_id UUID REFERENCES issues(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_purchase_orders_issue_id ON purchase_orders(issue_id);

ALTER TABLE subcontractor_work_orders
ADD COLUMN IF NOT EXISTS issue_id UUID REFERENCES issues(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_subcontractor_work_orders_issue_id ON subcontractor_work_orders(issue_id);
