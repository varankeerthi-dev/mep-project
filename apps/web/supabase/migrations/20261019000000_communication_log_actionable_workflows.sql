-- Migration: 20261019000000_communication_log_actionable_workflows.sql
-- Description: Adds action intent, approval hierarchy, manpower/site-visit requests, and rollover alerting to client_communication.

ALTER TABLE public.client_communication
  ADD COLUMN IF NOT EXISTS action_intent VARCHAR(50) DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS requested_discount_percent NUMERIC(5,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS requested_discount_amount NUMERIC(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS target_quotation_id UUID REFERENCES public.quotation_header(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS variation_type VARCHAR(50) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS estimated_variation_cost NUMERIC(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS escalation_type VARCHAR(50) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS escalation_severity VARCHAR(20) DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS md_intervention_notes TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS manpower_count INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS manpower_trade VARCHAR(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS requested_date DATE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS required_approver_role VARCHAR(50) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS approval_status VARCHAR(30) DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS approval_notes TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS needs_discussion BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS discussion_notes TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS rolled_over_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_comm_action_intent ON public.client_communication(action_intent);
CREATE INDEX IF NOT EXISTS idx_comm_approval_status ON public.client_communication(approval_status);
CREATE INDEX IF NOT EXISTS idx_comm_needs_discussion ON public.client_communication(needs_discussion);
CREATE INDEX IF NOT EXISTS idx_comm_requested_date ON public.client_communication(requested_date);
