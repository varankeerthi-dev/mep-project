import type {
  QuotationFollowUpStatus,
  QuotationResponseOption,
  QuotationTransitionMeta,
} from '../../types/followup';

const TRANSITION_GRAPH: Record<QuotationFollowUpStatus, QuotationResponseOption[]> = {
  sent: ['under_review', 'in_negotiation', 'pending', 'lost_to_competitor', 'cancelled'],
  under_review: ['in_negotiation', 'pending', 'approved', 'lost_to_competitor', 'on_hold', 'cancelled'],
  in_negotiation: ['approved', 'pending', 'under_review', 'lost_to_competitor', 'on_hold', 'cancelled'],
  pending: ['under_review', 'in_negotiation', 'lost_to_competitor', 'on_hold', 'cancelled'],
  approved: [],
  expired: ['under_review', 'in_negotiation', 'pending', 'cancelled'],
  cancelled: ['sent'],
  on_hold: ['under_review', 'in_negotiation', 'pending', 'cancelled'],
};

export const TRANSITION_META: Record<QuotationResponseOption, QuotationTransitionMeta> = {
  under_review: {
    label: 'Under Review',
    description: 'Client is actively reviewing the quotation',
    dbStatus: 'Sent',
    icon: '🔍',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    terminal: false,
  },
  in_negotiation: {
    label: 'In Negotiation',
    description: 'Active commercial negotiations with the client',
    dbStatus: 'Under Negotiation',
    icon: '🤝',
    color: 'bg-amber-100 text-amber-800 border-amber-200',
    terminal: false,
  },
  pending: {
    label: 'Pending',
    description: 'Awaiting client response or internal action needed',
    dbStatus: 'Sent',
    icon: '⏳',
    color: 'bg-zinc-100 text-zinc-700 border-zinc-200',
    terminal: false,
  },
  approved: {
    label: 'Approved',
    description: 'Client approved — ready to convert to work order',
    dbStatus: 'Approved',
    icon: '✅',
    color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    terminal: true,
  },
  on_hold: {
    label: 'On Hold',
    description: 'Temporarily paused — project or client deferred',
    dbStatus: 'Sent',
    icon: '⏸️',
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    terminal: false,
  },
  lost_to_competitor: {
    label: 'Lost to Competitor',
    description: 'Client awarded business to another vendor',
    dbStatus: 'Rejected',
    icon: '❌',
    color: 'bg-red-100 text-red-800 border-red-200',
    terminal: true,
  },
  cancelled: {
    label: 'Cancelled',
    description: 'Quotation withdrawn or no longer required',
    dbStatus: 'Cancelled',
    icon: '🚫',
    color: 'bg-gray-100 text-gray-700 border-gray-300',
    terminal: true,
  },
};

export function getAvailableTransitions(
  currentStatus: QuotationFollowUpStatus
): QuotationResponseOption[] {
  return TRANSITION_GRAPH[currentStatus] ?? [];
}

export function canTransition(
  from: QuotationFollowUpStatus,
  to: QuotationResponseOption
): boolean {
  return (TRANSITION_GRAPH[from] ?? []).includes(to);
}

export function isTerminalStatus(status: QuotationFollowUpStatus): boolean {
  if (status === 'approved' || status === 'lost_to_competitor' || status === 'cancelled') return true;
  return false;
}

export function isActivePipeline(status: QuotationFollowUpStatus): boolean {
  return ['sent', 'under_review', 'in_negotiation', 'pending', 'on_hold'].includes(status);
}

export function getTransitionToStatus(
  response: QuotationResponseOption
): QuotationFollowUpStatus {
  return response as QuotationFollowUpStatus;
}

export function getDbStatus(response: QuotationResponseOption): string {
  return TRANSITION_META[response].dbStatus;
}

export function isExpired(validTill: string): boolean {
  try {
    const till = new Date(validTill);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    till.setHours(0, 0, 0, 0);
    return till < today;
  } catch {
    return false;
  }
}

export function detectEffectiveStatus(
  dbStatus: QuotationFollowUpStatus,
  validTill: string
): QuotationFollowUpStatus {
  if (dbStatus === 'approved' || dbStatus === 'lost_to_competitor' || dbStatus === 'cancelled') {
    return dbStatus;
  }
  if (dbStatus === 'on_hold') return dbStatus;
  if (isExpired(validTill)) return 'expired';
  return dbStatus;
}

export const STATUS_PIPELINE_ORDER: QuotationFollowUpStatus[] = [
  'sent',
  'under_review',
  'in_negotiation',
  'pending',
  'on_hold',
  'expired',
  'approved',
  'lost_to_competitor',
  'cancelled',
];

export const ACTIVE_STATUSES: QuotationFollowUpStatus[] = [
  'sent',
  'under_review',
  'in_negotiation',
  'pending',
  'on_hold',
];

export const CLOSED_STATUSES: QuotationFollowUpStatus[] = [
  'approved',
  'lost_to_competitor',
  'cancelled',
  'expired',
];