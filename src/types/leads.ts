// =============================================================================
// Leads, Cadence, Win/Loss — types for the "ambient follow-up" wedge.
// Kept separate from followup.ts to keep blast radius small.
// =============================================================================

export type LeadStatus = 'New' | 'Qualified' | 'Converted' | 'Disqualified' | 'On Hold';

export type LeadSource =
  | 'Referral'
  | 'Trade Show'
  | 'Cold Call'
  | 'Website'
  | 'Existing Client'
  | 'LinkedIn'
  | 'Advertisement'
  | 'Walk-in'
  | 'Other';

export interface Lead {
  id: string;
  organisation_id: string;
  contact_name: string;
  company_name: string;
  contact_phone: string;
  contact_email: string;
  source: LeadSource;
  client_id: string | null;
  status: LeadStatus;
  disqualified_reason: string | null;
  project_name: string;
  requirement_summary: string;
  estimated_value: number;
  expected_close_date: string | null;
  owner_user_id: string | null;
  next_action_at: string | null;
  next_action_label: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  converted_at: string | null;
  converted_to_client_id: string | null;
  converted_to_quotation_id: string | null;

  // Hydrated fields (left-joined server-side or composed client-side)
  client_name?: string | null;
  owner_name?: string | null;
  escalation_stage?: number;
}

export interface NewLeadInput {
  contact_name: string;
  company_name?: string;
  contact_phone?: string;
  contact_email?: string;
  source?: LeadSource;
  client_id?: string | null;
  project_name?: string;
  requirement_summary?: string;
  estimated_value?: number;
  expected_close_date?: string | null;
  owner_user_id?: string | null;
  next_action_at?: string | null;
  next_action_label?: string;
}

export interface LeadUpdateInput extends Partial<NewLeadInput> {
  status?: LeadStatus;
  disqualified_reason?: string | null;
}

// =============================================================================
// Cadence / SLA
// =============================================================================

export type CadenceAppliesTo = 'lead' | 'quotation' | 'podc' | 'invoice' | 'global';

export interface CadenceRule {
  id: string;
  organisation_id: string;
  applies_to: CadenceAppliesTo;
  stage_1_days: number;
  stage_2_days: number;
  stage_3_days: number;
  stage_4_days: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type EscalationStage = 0 | 1 | 2 | 3 | 4;

export const ESCALATION_LABELS: Record<EscalationStage, string> = {
  0: 'On track',
  1: 'Due today',
  2: 'Overdue · gentle',
  3: 'Overdue · T+1',
  4: 'Overdue · critical',
};

export const ESCALATION_VARIANT: Record<EscalationStage, 'default' | 'warning' | 'danger'> = {
  0: 'default',
  1: 'default',
  2: 'warning',
  3: 'warning',
  4: 'danger',
};

// =============================================================================
// Win / Loss reasons
// =============================================================================

export type WinLossCategory = 'win' | 'loss' | 'disqualify';

export interface WinLossReason {
  id: string;
  organisation_id: string;
  category: WinLossCategory;
  label: string;
  is_default: boolean;
  sort_order: number;
  created_at: string;
}

// =============================================================================
// Next Action (ambient chip on client rows)
// =============================================================================

export type NextActionSource = 'lead' | 'quotation' | 'podc' | 'invoice';

export interface NextAction {
  source_type: NextActionSource;
  source_id: string;
  reference_label: string;
  next_action_at: string;
  next_action_label: string;
  escalation_stage: number;
  hours_until_due: number;
}
