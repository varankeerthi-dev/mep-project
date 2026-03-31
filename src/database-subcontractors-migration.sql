ALTER TABLE subcontractors ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE;
ALTER TABLE subcontractor_payments ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE;
ALTER TABLE subcontractor_attendance ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE;
ALTER TABLE subcontractor_work_orders ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE;
ALTER TABLE subcontractor_daily_logs ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE;
ALTER TABLE subcontractor_invoices ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE;
ALTER TABLE subcontractor_issues ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE;
ALTER TABLE subcontractor_documents ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_subcontractors_organisation ON subcontractors(organisation_id);
CREATE INDEX IF NOT EXISTS idx_subcontractor_payments_org ON subcontractor_payments(organisation_id);
CREATE INDEX IF NOT EXISTS idx_subcontractor_attendance_org ON subcontractor_attendance(organisation_id);
CREATE INDEX IF NOT EXISTS idx_subcontractor_work_orders_org ON subcontractor_work_orders(organisation_id);
CREATE INDEX IF NOT EXISTS idx_subcontractor_daily_logs_org ON subcontractor_daily_logs(organisation_id);
CREATE INDEX IF NOT EXISTS idx_subcontractor_invoices_org ON subcontractor_invoices(organisation_id);
CREATE INDEX IF NOT EXISTS idx_subcontractor_issues_org ON subcontractor_issues(organisation_id);
CREATE INDEX IF NOT EXISTS idx_subcontractor_documents_org ON subcontractor_documents(organisation_id);