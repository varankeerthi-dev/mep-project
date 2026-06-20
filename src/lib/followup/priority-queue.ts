import { getReminderStage } from './escalation-engine';
import { daysUntil, isValidityExpiringSoon } from './date-format';
import { matchesAssigneeFilter } from './followup-utils';
import { ACTIVE_STATUSES } from './quotation-workflow';
import type { Lead } from '../../types/leads';
import type {
  InvoiceFollowUp,
  PodcBacklogItem,
  PriorityQueueItem,
  QuotationFollowUp,
  ProcurementFollowUp,
} from '../../types/followup';

function valueScore(amount: number): number {
  if (amount >= 5_000_000) return 25;
  if (amount >= 2_000_000) return 20;
  if (amount >= 1_000_000) return 15;
  if (amount >= 500_000) return 10;
  if (amount >= 100_000) return 5;
  return 2;
}

function scoreQuotation(q: QuotationFollowUp): { score: number; reason: string } {
  let score = 40;
  const reasons: string[] = [];

  if (isValidityExpiringSoon(q.valid_till)) {
    score += 28;
    reasons.push('Validity expiring');
  }
  score += valueScore(q.total_value);
  if (q.total_value >= 1_000_000) reasons.push('High value');

  if (!q.last_follow_up_at) {
    score += 12;
    reasons.push('No follow-up logged');
  }

  if (q.status === 'in_negotiation') {
    score += 8;
    reasons.push('In negotiation');
  }

  return { score, reason: reasons.slice(0, 2).join(' · ') || 'Outstanding quotation' };
}

function scorePodc(p: PodcBacklogItem): { score: number; reason: string } {
  let score = 45;
  const reasons: string[] = [];

  score += Math.min(p.days_pending_po * 1.5, 30);
  if (p.days_pending_po >= 14) reasons.push(`${p.days_pending_po}d without PO`);
  score += valueScore(p.estimated_value);

  if (p.dispute_status === 'open' || p.issue_flag) {
    score += 22;
    reasons.push(p.issue_flag ? 'Issue flagged' : 'Dispute open');
  }
  if (p.delivery_proof_status === 'missing') {
    score += 10;
    reasons.push('Proof missing');
  }

  return { score, reason: reasons.slice(0, 2).join(' · ') || 'PO pending after DC' };
}

function scoreInvoice(inv: InvoiceFollowUp): { score: number; reason: string } {
  const stage = getReminderStage(inv.days_overdue);
  let score = 50 + stage * 12;
  const reasons: string[] = [];

  if (stage >= 4) reasons.push('Critical overdue');
  else if (stage >= 2) reasons.push(`Tier ${stage} escalation`);
  else if (inv.days_overdue > 0) reasons.push(`${inv.days_overdue}d overdue`);
  else reasons.push('Due soon');

  score += valueScore(inv.balance_due);
  if (inv.collection_risk === 'critical') score += 15;
  if (inv.collection_risk === 'high') score += 8;

  return { score, reason: reasons.slice(0, 2).join(' · ') || 'Payment follow-up' };
}

function scoreLead(lead: Lead): { score: number; reason: string } {
  let score = 35;
  const reasons: string[] = [];

  if (lead.next_action_at) {
    const ageMs = Date.now() - new Date(lead.next_action_at).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    if (ageDays >= 0) {
      score += Math.min(ageDays * 3, 30);
      if (ageDays >= 7) reasons.push(`${Math.round(ageDays)}d no contact`);
      else if (ageDays >= 1) reasons.push('Action overdue');
    }
  } else {
    score += 8;
    reasons.push('No next action set');
  }

  if (lead.expected_close_date) {
    const closeMs = new Date(lead.expected_close_date).getTime() - Date.now();
    const closeDays = closeMs / (1000 * 60 * 60 * 24);
    if (closeDays >= 0 && closeDays <= 14) {
      score += 12;
      reasons.push(`Closes in ${Math.round(closeDays)}d`);
    }
  }

  score += valueScore(lead.estimated_value);
  return { score, reason: reasons.slice(0, 2).join(' · ') || 'Open lead' };
}

function scoreProcurement(po: ProcurementFollowUp): { score: number; reason: string } {
  let score = 40;
  const reasons: string[] = [];

  score += Math.min(po.days_pending_vendor * 1.5, 30);
  if (po.days_pending_vendor >= 7) reasons.push(`${po.days_pending_vendor}d pending vendor`);

  score += valueScore(po.total_value);
  if (po.status === 'delayed') {
    score += 15;
    reasons.push('Delivery delayed');
  }

  return { score, reason: reasons.slice(0, 2).join(' · ') || 'Pending procurement' };
}

function priorityBand(score: number): PriorityQueueItem['priority_band'] {
  if (score >= 85) return 'critical';
  if (score >= 70) return 'high';
  if (score >= 55) return 'medium';
  return 'low';
}

export function buildPriorityQueue(
  quotations: QuotationFollowUp[],
  podc: PodcBacklogItem[],
  invoices: InvoiceFollowUp[],
  leads: Lead[] = [],
  procurements: ProcurementFollowUp[] = []
): PriorityQueueItem[] {
  const items: PriorityQueueItem[] = [];

  for (const lead of leads) {
    if (!['New', 'Qualified'].includes(lead.status)) continue;
    const { score, reason } = scoreLead(lead);
    items.push({
      id: `l-${lead.id}`,
      source_tab: 'lead',
      source_id: lead.id,
      reference_label: lead.company_name || lead.contact_name,
      client_name: lead.client_name || lead.contact_name,
      project_name: lead.project_name,
      amount: lead.estimated_value,
      priority_score: Math.round(score),
      priority_band: priorityBand(score),
      urgency_label: lead.next_action_label || 'No next action',
      reason,
      assignee_user_id: lead.owner_user_id,
      assignee_name: lead.owner_name ?? null,
      last_activity: lead.updated_at || lead.created_at || null,
    });
  }

  for (const q of quotations) {
    if (!ACTIVE_STATUSES.includes(q.status)) continue;
    const { score, reason } = scoreQuotation(q);
    const days = daysUntil(q.valid_till);
    items.push({
      id: `q-${q.id}`,
      source_tab: 'quotation',
      source_id: q.id,
      reference_label: q.quotation_no,
      client_name: q.client_name,
      project_name: q.project_name,
      amount: q.total_value,
      priority_score: Math.round(score),
      priority_band: priorityBand(score),
      urgency_label: days >= 0 && days <= 7 ? `${days}d to validity` : reason,
      reason,
      assignee_user_id: q.assignee_user_id,
      assignee_name: q.assignee_name,
      last_activity: q.status_changed_at || q.last_follow_up_at || q.submitted_date || null,
    });
  }

  for (const p of podc) {
    const { score, reason } = scorePodc(p);
    items.push({
      id: `p-${p.id}`,
      source_tab: 'podc',
      source_id: p.id,
      reference_label: p.dc_wo_number,
      client_name: p.client_name,
      project_name: p.project_name,
      amount: p.estimated_value,
      priority_score: Math.round(score),
      priority_band: priorityBand(score),
      urgency_label: `${p.days_pending_po}d pending PO`,
      reason,
      assignee_user_id: p.assignee_user_id,
      assignee_name: p.assignee_name,
      last_activity: new Date(Date.now() - p.days_pending_po * 24 * 3600 * 1000).toISOString(),
    });
  }

  for (const inv of invoices) {
    if (inv.balance_due <= 0) continue;
    const { score, reason } = scoreInvoice(inv);
    items.push({
      id: `i-${inv.id}`,
      source_tab: 'invoice',
      source_id: inv.id,
      reference_label: inv.invoice_no,
      client_name: inv.client_name,
      project_name: inv.project_name,
      amount: inv.balance_due,
      priority_score: Math.round(score),
      priority_band: priorityBand(score),
      urgency_label:
        inv.days_overdue > 0 ? `${inv.days_overdue}d overdue` : `Due ${inv.due_date}`,
      reason,
      assignee_user_id: inv.assignee_user_id,
      assignee_name: inv.assignee_name,
      last_activity: inv.last_reminder_at || inv.due_date || null,
    });
  }

  for (const po of procurements) {
    if (po.status === 'completed') continue;
    const { score, reason } = scoreProcurement(po);
    items.push({
      id: `pr-${po.id}`,
      source_tab: 'procurement',
      source_id: po.id,
      reference_label: po.po_no,
      client_name: po.vendor_name,
      project_name: po.project_name,
      amount: po.total_value,
      priority_score: Math.round(score),
      priority_band: priorityBand(score),
      urgency_label: po.status === 'delayed' ? 'Delayed delivery' : `${po.days_pending_vendor}d pending vendor`,
      reason,
      assignee_user_id: po.assignee_user_id,
      assignee_name: po.assignee_name,
      last_activity: po.last_follow_up_at || po.submitted_date || null,
    });
  }

  return items.sort((a, b) => b.priority_score - a.priority_score);
}

export function filterPriorityQueue(
  items: PriorityQueueItem[],
  searchQ: string,
  typeFilter: string,
  sort: string,
  assigneeFilter = 'all',
  currentUserId?: string | null
): PriorityQueueItem[] {
  let result = [...items];

  if (typeFilter !== 'all') {
    result = result.filter((i) => i.source_tab === typeFilter);
  }

  result = result.filter((i) =>
    matchesAssigneeFilter(i.assignee_user_id, assigneeFilter, currentUserId)
  );

  if (searchQ.trim()) {
    const q = searchQ.toLowerCase();
    result = result.filter(
      (i) =>
        i.client_name.toLowerCase().includes(q) ||
        i.project_name.toLowerCase().includes(q) ||
        i.reference_label.toLowerCase().includes(q) ||
        i.reason.toLowerCase().includes(q)
    );
  }

  switch (sort) {
    case 'value_desc':
      return result.sort((a, b) => b.amount - a.amount);
    case 'client_asc':
      return result.sort((a, b) => a.client_name.localeCompare(b.client_name));
    default:
      return result.sort((a, b) => b.priority_score - a.priority_score);
  }
}

export function computeQueueMetrics(items: PriorityQueueItem[]) {
  const critical = items.filter((i) => i.priority_band === 'critical').length;
  const high = items.filter((i) => i.priority_band === 'high').length;
  const totalExposure = items.reduce((s, i) => s + i.amount, 0);
  const topClient =
    items.length > 0
      ? items.reduce(
          (best, i) => (i.priority_score > best.score ? { name: i.client_name, score: i.priority_score } : best),
          { name: items[0].client_name, score: items[0].priority_score }
        ).name
      : '—';

  return { total: items.length, critical, high, totalExposure, topClient };
}

export const SOURCE_TAB_LABELS: Record<PriorityQueueItem['source_tab'], string> = {
  quotation: 'Quotation',
  podc: 'PO/DC',
  invoice: 'Invoice',
  lead: 'Lead',
  procurement: 'Procurement',
};
