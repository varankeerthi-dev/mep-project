// Follow-Up Centre — unified types

export type FollowUpTab = 'queue' | 'quotation' | 'podc' | 'invoice' | 'activity' | 'lead';

export type PriorityBand = 'critical' | 'high' | 'medium' | 'low';

export type QueueSourceTab = Exclude<FollowUpTab, 'activity' | 'queue'> | 'lead';

export interface PriorityQueueItem {
  id: string;
  source_tab: QueueSourceTab;
  source_id: string;
  reference_label: string;
  client_name: string;
  project_name: string;
  amount: number;
  priority_score: number;
  priority_band: PriorityBand;
  urgency_label: string;
  reason: string;
  assignee_user_id?: string | null;
  assignee_name?: string | null;
}

export type QuotationFollowUpStatus =
  | 'sent'
  | 'under_review'
  | 'in_negotiation'
  | 'pending'
  | 'lost_to_competitor'
  | 'approved'
  | 'expired'
  | 'cancelled'
  | 'on_hold';

export type QuotationResponseOption =
  | 'under_review'
  | 'in_negotiation'
  | 'lost_to_competitor'
  | 'pending'
  | 'approved'
  | 'on_hold'
  | 'cancelled';

export type QuotationTransitionMeta = {
  label: string;
  description: string;
  dbStatus: string;
  icon: string;
  color: string;
  terminal: boolean;
};

export type QuotationTransitionRule = {
  from: QuotationFollowUpStatus;
  to: QuotationResponseOption;
};

export type PodcDeliveryProofStatus = 'verified' | 'partial' | 'pending' | 'missing';

export type PodcDisputeStatus = 'none' | 'open' | 'resolved';

export type PodcIssueFlag =
  | 'quantity_mismatch'
  | 'damaged_material'
  | 'incomplete_delivery'
  | 'disputed_execution';

export type ActivityEventType =
  | 'quotation_reminder_sent'
  | 'quotation_response_logged'
  | 'quotation_status_changed'
  | 'quotation_expired'
  | 'podc_pack_shared'
  | 'podc_issue_flagged'
  | 'invoice_reminder_sent'
  | 'invoice_escalation_changed'
  | 'invoice_edited'
  | 'invoice_finalized';

export type EscalationStage = 0 | 1 | 2 | 3 | 4;

export interface QuotationFollowUp {
  id: string;
  quotation_no: string;
  client_name: string;
  project_name: string;
  total_value: number;
  status: QuotationFollowUpStatus;
  previous_status?: QuotationFollowUpStatus | null;
  submitted_date: string;
  valid_till: string;
  pdf_url: string;
  contact_phone?: string;
  last_follow_up_at?: string | null;
  assignee_user_id?: string | null;
  assignee_name?: string | null;
  status_changed_at?: string | null;
  status_changed_by?: string | null;
  notes?: string | null;
}

export interface PodcBacklogItem {
  id: string;
  dc_wo_number: string;
  client_name: string;
  project_name: string;
  estimated_value: number;
  days_pending_po: number;
  site_engineer: string;
  client_coordinator: string;
  delivery_proof_status: PodcDeliveryProofStatus;
  dispute_status: PodcDisputeStatus;
  signed_dc_url: string;
  delivery_photo_urls: string[];
  completion_photo_urls: string[];
  contact_phone?: string;
  issue_flag?: PodcIssueFlag | null;
  assignee_user_id?: string | null;
  assignee_name?: string | null;
}

export interface InvoiceFollowUp {
  id: string;
  invoice_no: string;
  client_name: string;
  project_name: string;
  balance_due: number;
  total_amount: number;
  due_date: string;
  days_overdue: number;
  payment_link?: string;
  contact_phone?: string;
  collection_risk: 'low' | 'medium' | 'high' | 'critical';
  last_reminder_at?: string | null;
  assignee_user_id?: string | null;
  assignee_name?: string | null;
}

export interface FollowUpActivityLog {
  id: string;
  event_type: ActivityEventType;
  tab_source: FollowUpTab;
  title: string;
  description: string;
  actor_name: string;
  reference_id: string;
  reference_label: string;
  created_at: string;
  metadata?: Record<string, string>;
}

export type LinkedItemType = 'quotation' | 'invoice' | 'podc' | 'lead';

export interface UnifiedTimelineEntry {
  id: string;
  source: 'follow_up' | 'client_communication';
  title: string;
  description: string;
  actor_name: string;
  created_at: string;
  event_type?: ActivityEventType;
  linked_type?: LinkedItemType;
  linked_id?: string;
  metadata?: Record<string, string>;
}

export interface FollowUpMetrics {
  label: string;
  value: string | number;
  sublabel?: string;
  trend?: 'up' | 'down' | 'neutral';
  variant?: 'default' | 'warning' | 'danger' | 'success';
}

export interface FollowUpFiltersState {
  tab: FollowUpTab;
  q: string;
  status: string;
  expiringSoon: boolean;
  sort: string;
  dateFrom: string;
  dateTo: string;
  escalationStage: string;
  assignee: string;
}

export const DEFAULT_FOLLOWUP_FILTERS: FollowUpFiltersState = {
  tab: 'queue',
  q: '',
  status: 'all',
  expiringSoon: false,
  sort: 'priority_desc',
  dateFrom: '',
  dateTo: '',
  escalationStage: 'all',
  assignee: 'all',
};

export const QUOTATION_RESPONSE_OPTIONS: { value: QuotationResponseOption; label: string; description: string }[] = [
  { value: 'under_review', label: 'Under Review', description: 'Client is reviewing the quotation' },
  { value: 'in_negotiation', label: 'In Negotiation', description: 'Active commercial negotiations underway' },
  { value: 'pending', label: 'Pending', description: 'Awaiting client response or internal action' },
  { value: 'approved', label: 'Approved', description: 'Client has approved — convert to work order' },
  { value: 'on_hold', label: 'On Hold', description: 'Temporarily paused — project/client deferred' },
  { value: 'lost_to_competitor', label: 'Lost to Competitor', description: 'Client awarded to another vendor' },
  { value: 'cancelled', label: 'Cancelled', description: 'Quotation withdrawn or no longer required' },
];

export const PODC_ISSUE_OPTIONS: { value: PodcIssueFlag; label: string }[] = [
  { value: 'quantity_mismatch', label: 'Quantity mismatch' },
  { value: 'damaged_material', label: 'Damaged material' },
  { value: 'incomplete_delivery', label: 'Incomplete delivery' },
  { value: 'disputed_execution', label: 'Disputed execution' },
];
