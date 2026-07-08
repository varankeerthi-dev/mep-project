-- ============================================================
-- UNIFIED NEXT ACTIONS & FOLLOW-UPS TRACKING SCHEMA
-- ============================================================

-- 1. client_communication Table (uses is_resolved for global completion)
ALTER TABLE client_communication 
  ADD COLUMN IF NOT EXISTS is_resolved BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS next_action_acknowledged_by TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_comm_is_resolved ON client_communication(is_resolved);
CREATE INDEX IF NOT EXISTS idx_comm_acknowledged_by ON client_communication USING gin (next_action_acknowledged_by);

-- 2. site_visits Table (uses native completed/cancelled status)
ALTER TABLE site_visits
  ADD COLUMN IF NOT EXISTS next_action_acknowledged_by TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_visits_acknowledged_by ON site_visits USING gin (next_action_acknowledged_by);

-- 3. site_reports Table (informational, uses personal acknowledgment only)
ALTER TABLE site_reports
  ADD COLUMN IF NOT EXISTS next_action_acknowledged_by TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_reports_acknowledged_by ON site_reports USING gin (next_action_acknowledged_by);

-- 4. issues Table (uses native closed/resolved status)
ALTER TABLE issues
  ADD COLUMN IF NOT EXISTS next_action_acknowledged_by TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_issues_acknowledged_by ON issues USING gin (next_action_acknowledged_by);

-- 5. follow_up_quotation_tracking Table (uses native completed/inactive status)
ALTER TABLE follow_up_quotation_tracking
  ADD COLUMN IF NOT EXISTS next_action_acknowledged_by TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_follow_up_quote_ack ON follow_up_quotation_tracking USING gin (next_action_acknowledged_by);

-- 6. follow_up_podc_backlog Table
ALTER TABLE follow_up_podc_backlog
  ADD COLUMN IF NOT EXISTS next_action_acknowledged_by TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_follow_up_podc_ack ON follow_up_podc_backlog USING gin (next_action_acknowledged_by);

-- 7. follow_up_invoice_tracking Table
ALTER TABLE follow_up_invoice_tracking
  ADD COLUMN IF NOT EXISTS next_action_acknowledged_by TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_follow_up_inv_ack ON follow_up_invoice_tracking USING gin (next_action_acknowledged_by);

-- 8. leads Table (uses native converted/lost status)
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS next_action_acknowledged_by TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_leads_acknowledged_by ON leads USING gin (next_action_acknowledged_by);
