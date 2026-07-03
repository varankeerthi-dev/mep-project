// =============================================================================
// Leads, Cadence, Win/Loss — Lead Module (Zoho-style CRM).
// =============================================================================

export type LeadSource =
  | 'Referral'
  | 'Trade Show'
  | 'Cold Call'
  | 'Website'
  | 'Existing Client'
  | 'Existing Client Ex-Employee'
  | 'LinkedIn'
  | 'Advertisement'
  | 'Walk-in'
  | 'IndiaMART'
  | 'JustDial'
  | 'Other';

export interface LeadStatus {
  id: string;
  organisation_id: string;
  name: string;
  color: string;
  sort_order: number;
  is_default: boolean;
  category: 'open' | 'won' | 'lost' | 'junk';
  created_at: string;
}

export interface LeadIndustry {
  id: string;
  organisation_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface LeadHistory {
  id: string;
  lead_id: string;
  organisation_id: string;
  action: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  performed_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface LeadAssignmentRule {
  id: string;
  organisation_id: string;
  method: 'round_robin' | 'manual';
  user_ids: string[];
  is_active: boolean;
  last_assigned_index: number;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  organisation_id: string;
  contact_name: string;
  company_name: string;
  contact_phone: string;
  contact_email: string;
  source: LeadSource;
  client_id: string | null;
  status: string;
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

  // Address fields
  city: string;
  state: string;
  pin: string;

  // New fields
  industry_id: string | null;
  referred_by: string;
  remarks: string;
  lead_status_id: string | null;

  // Hydrated fields
  client_name?: string | null;
  owner_name?: string | null;
  escalation_stage?: number;
  lead_status?: LeadStatus | null;
  industry?: LeadIndustry | null;
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
  city?: string;
  state?: string;
  pin?: string;
  lead_status_id?: string | null;
  industry_id?: string | null;
  referred_by?: string;
  remarks?: string;
}

export interface LeadUpdateInput extends Partial<NewLeadInput> {
  status?: string;
  disqualified_reason?: string | null;
  lead_status_id?: string | null;
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
