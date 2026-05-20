import type {
  FollowUpActivityLog,
  FollowUpFiltersState,
  InvoiceFollowUp,
  PodcBacklogItem,
  QuotationFollowUp,
} from '../../types/followup';
import { getReminderStage } from './escalation-engine';
import { isValidityExpiringSoon, isFollowUpExpired } from './date-format';
import { ACTIVE_STATUSES } from './quotation-workflow';

export function matchesAssigneeFilter(
  assigneeUserId: string | null | undefined,
  filter: string,
  currentUserId?: string | null
): boolean {
  if (!filter || filter === 'all') return true;
  if (filter === 'unassigned') return !assigneeUserId;
  if (filter === 'me') return !!currentUserId && assigneeUserId === currentUserId;
  return assigneeUserId === filter;
}

export function filterQuotations(
  items: QuotationFollowUp[],
  filters: FollowUpFiltersState,
  searchQ: string,
  currentUserId?: string | null
): QuotationFollowUp[] {
  let result = [...items];

  if (searchQ.trim()) {
    const q = searchQ.toLowerCase();
    result = result.filter(
      (r) =>
        r.client_name.toLowerCase().includes(q) ||
        r.project_name.toLowerCase().includes(q) ||
        r.quotation_no.toLowerCase().includes(q)
    );
  }

  if (filters.status !== 'all') {
    result = result.filter((r) => r.status === filters.status);
  }

  if (filters.expiringSoon) {
    result = result.filter((r) => isValidityExpiringSoon(r.valid_till));
  }

  if (filters.dateFrom) {
    result = result.filter((r) => r.submitted_date >= filters.dateFrom);
  }
  if (filters.dateTo) {
    result = result.filter((r) => r.submitted_date <= filters.dateTo);
  }

  result = result.filter((r) =>
    matchesAssigneeFilter(r.assignee_user_id, filters.assignee, currentUserId)
  );

  return sortQuotations(result, filters.sort);
}

export function sortQuotations(items: QuotationFollowUp[], sort: string): QuotationFollowUp[] {
  const copy = [...items];
  switch (sort) {
    case 'value_desc':
      return copy.sort((a, b) => b.total_value - a.total_value);
    case 'value_asc':
      return copy.sort((a, b) => a.total_value - b.total_value);
    case 'validity_asc':
      return copy.sort((a, b) => a.valid_till.localeCompare(b.valid_till));
    case 'submitted_desc':
      return copy.sort((a, b) => b.submitted_date.localeCompare(a.submitted_date));
    default:
      return copy;
  }
}

export function filterPodcBacklog(
  items: PodcBacklogItem[],
  filters: FollowUpFiltersState,
  searchQ: string,
  currentUserId?: string | null
): PodcBacklogItem[] {
  let result = [...items];

  if (searchQ.trim()) {
    const q = searchQ.toLowerCase();
    result = result.filter(
      (r) =>
        r.client_name.toLowerCase().includes(q) ||
        r.project_name.toLowerCase().includes(q) ||
        r.dc_wo_number.toLowerCase().includes(q) ||
        r.site_engineer.toLowerCase().includes(q)
    );
  }

  if (filters.status === 'disputed') {
    result = result.filter((r) => r.dispute_status === 'open');
  } else if (filters.status === 'flagged') {
    result = result.filter((r) => !!r.issue_flag);
  }

  result = result.filter((r) =>
    matchesAssigneeFilter(r.assignee_user_id, filters.assignee, currentUserId)
  );

  switch (filters.sort) {
    case 'days_desc':
      result.sort((a, b) => b.days_pending_po - a.days_pending_po);
      break;
    case 'value_desc':
      result.sort((a, b) => b.estimated_value - a.estimated_value);
      break;
    default:
      result.sort((a, b) => b.days_pending_po - a.days_pending_po);
  }

  return result;
}

export function filterInvoices(
  items: InvoiceFollowUp[],
  filters: FollowUpFiltersState,
  searchQ: string,
  currentUserId?: string | null
): InvoiceFollowUp[] {
  let result = [...items];

  if (searchQ.trim()) {
    const q = searchQ.toLowerCase();
    result = result.filter(
      (r) =>
        r.client_name.toLowerCase().includes(q) ||
        r.project_name.toLowerCase().includes(q) ||
        r.invoice_no.toLowerCase().includes(q)
    );
  }

  if (filters.escalationStage !== 'all') {
    const stage = Number(filters.escalationStage);
    result = result.filter((r) => getReminderStage(r.days_overdue) === stage);
  }

  result = result.filter((r) =>
    matchesAssigneeFilter(r.assignee_user_id, filters.assignee, currentUserId)
  );

  switch (filters.sort) {
    case 'overdue_desc':
      result.sort((a, b) => b.days_overdue - a.days_overdue);
      break;
    case 'balance_desc':
      result.sort((a, b) => b.balance_due - a.balance_due);
      break;
    case 'due_asc':
      result.sort((a, b) => a.due_date.localeCompare(b.due_date));
      break;
    default:
      result.sort((a, b) => b.days_overdue - a.days_overdue);
  }

  return result;
}

export function filterActivityLogs(
  items: FollowUpActivityLog[],
  filters: FollowUpFiltersState,
  searchQ: string
): FollowUpActivityLog[] {
  let result = [...items].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  if (searchQ.trim()) {
    const q = searchQ.toLowerCase();
    result = result.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.reference_label.toLowerCase().includes(q) ||
        r.actor_name.toLowerCase().includes(q)
    );
  }

  if (filters.status !== 'all') {
    result = result.filter((r) => r.tab_source === filters.status);
  }

  return result;
}

export function computeQuotationMetrics(items: QuotationFollowUp[]) {
  const active = items.filter((i) => ACTIVE_STATUSES.includes(i.status));
  const expiring = active.filter((i) => isValidityExpiringSoon(i.valid_till));
  const expired = items.filter((i) => i.status === 'expired');
  const lost = items.filter((i) => i.status === 'lost_to_competitor');
  const approved = items.filter((i) => i.status === 'approved');
  const totalValue = active.reduce((s, i) => s + i.total_value, 0);
  const lostValue = lost.reduce((s, i) => s + i.total_value, 0);
  return {
    openCount: active.length,
    expiringCount: expiring.length,
    expiredCount: expired.length,
    lostCount: lost.length,
    approvedCount: approved.length,
    totalPipeline: totalValue,
    lostValue,
  };
}

export function computePodcMetrics(items: PodcBacklogItem[]) {
  const disputed = items.filter((i) => i.dispute_status === 'open');
  const totalBlocked = items.reduce((s, i) => s + i.estimated_value, 0);
  const avgDays =
    items.length > 0
      ? Math.round(items.reduce((s, i) => s + i.days_pending_po, 0) / items.length)
      : 0;
  return {
    backlogCount: items.length,
    disputedCount: disputed.length,
    totalBlocked,
    avgDaysPending: avgDays,
  };
}

export function computeInvoiceMetrics(items: InvoiceFollowUp[]) {
  const overdue = items.filter((i) => i.days_overdue > 0);
  const critical = items.filter((i) => getReminderStage(i.days_overdue) >= 3);
  const totalDue = overdue.reduce((s, i) => s + i.balance_due, 0);
  return {
    overdueCount: overdue.length,
    criticalCount: critical.length,
    totalOverdueDue: totalDue,
  };
}
