import type {
  ActivityEventType,
  PodcDeliveryProofStatus,
  PodcDisputeStatus,
  PodcIssueFlag,
  QuotationFollowUpStatus,
} from '../../types/followup';

export function formatQuotationStatus(status: QuotationFollowUpStatus): string {
  const map: Record<QuotationFollowUpStatus, string> = {
    sent: 'Sent',
    under_review: 'Under Review',
    in_negotiation: 'In Negotiation',
    pending: 'Pending',
    lost_to_competitor: 'Lost to Competitor',
    approved: 'Approved',
    expired: 'Expired',
    cancelled: 'Cancelled',
    on_hold: 'On Hold',
  };
  return map[status] ?? status;
}

export function formatDeliveryProofStatus(status: PodcDeliveryProofStatus): string {
  const map: Record<PodcDeliveryProofStatus, string> = {
    verified: 'Verified',
    partial: 'Partial',
    pending: 'Pending',
    missing: 'Missing',
  };
  return map[status] ?? status;
}

export function formatDisputeStatus(status: PodcDisputeStatus): string {
  const map: Record<PodcDisputeStatus, string> = {
    none: 'None',
    open: 'Open',
    resolved: 'Resolved',
  };
  return map[status] ?? status;
}

export function formatIssueFlag(flag: PodcIssueFlag): string {
  const map: Record<PodcIssueFlag, string> = {
    quantity_mismatch: 'Qty mismatch',
    damaged_material: 'Damaged material',
    incomplete_delivery: 'Incomplete delivery',
    disputed_execution: 'Disputed execution',
  };
  return map[flag] ?? flag;
}

export function getActivityEventLabel(type: ActivityEventType): string {
  const map: Record<ActivityEventType, string> = {
    quotation_reminder_sent: 'Quote reminder',
    quotation_response_logged: 'Quote response',
    quotation_status_changed: 'Status changed',
    quotation_expired: 'Quote expired',
    podc_pack_shared: 'DC pack shared',
    podc_issue_flagged: 'Issue flagged',
    invoice_reminder_sent: 'Invoice reminder',
    invoice_escalation_changed: 'Escalation change',
  };
  return map[type] ?? type;
}

export function quotationStatusColor(status: QuotationFollowUpStatus): string {
  switch (status) {
    case 'sent':
      return 'bg-sky-100 text-sky-800';
    case 'under_review':
      return 'bg-blue-100 text-blue-800';
    case 'in_negotiation':
      return 'bg-amber-100 text-amber-800';
    case 'pending':
      return 'bg-zinc-100 text-zinc-700';
    case 'approved':
      return 'bg-emerald-100 text-emerald-800';
    case 'lost_to_competitor':
      return 'bg-red-100 text-red-800';
    case 'expired':
      return 'bg-purple-100 text-purple-800';
    case 'cancelled':
      return 'bg-gray-200 text-gray-600';
    case 'on_hold':
      return 'bg-orange-100 text-orange-800';
    default:
      return 'bg-zinc-100 text-zinc-700';
  }
}

export function deliveryProofColor(status: PodcDeliveryProofStatus): string {
  switch (status) {
    case 'verified':
      return 'bg-emerald-100 text-emerald-800';
    case 'partial':
      return 'bg-amber-100 text-amber-800';
    case 'missing':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-zinc-100 text-zinc-600';
  }
}

export function disputeColor(status: PodcDisputeStatus): string {
  switch (status) {
    case 'open':
      return 'bg-red-100 text-red-800';
    case 'resolved':
      return 'bg-emerald-100 text-emerald-800';
    default:
      return 'bg-zinc-100 text-zinc-500';
  }
}
