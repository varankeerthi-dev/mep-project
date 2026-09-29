import { useMemo } from 'react';
import type {
  FollowUpActivityLog,
  FollowUpMetrics,
  FollowUpTab,
  InvoiceFollowUp,
  PodcBacklogItem,
  PriorityQueueItem,
  ProcurementFollowUp,
  QuotationFollowUp,
} from '@/types/followup';
import type { Lead } from '@/types/leads';
import { formatCompactCurrency } from '@/lib/followup/currency-format';
import {
  computeInvoiceMetrics,
  computePodcMetrics,
  computeProcurementMetrics,
  computeQuotationMetrics,
} from '@/lib/followup/followup-utils';
import { computeQueueMetrics } from '@/lib/followup/priority-queue';

export interface FollowUpMetricsInput {
  tab: FollowUpTab;
  statusFilter: string;
  priorityQueue: PriorityQueueItem[];
  quotations: QuotationFollowUp[];
  podc: PodcBacklogItem[];
  invoices: InvoiceFollowUp[];
  activity: FollowUpActivityLog[];
  leads: Lead[];
  procurements: ProcurementFollowUp[];
  filteredQuotationCount: number;
  filteredInvoiceCount: number;
  filteredActivityCount: number;
  filteredLeadCount: number;
  filteredProcurementCount: number;
  openLeadCount: number;
}

/**
 * Per-tab header metric cards. Behavior-preserving extraction from
 * FollowUpCentre — calculations are unchanged.
 */
export function useFollowUpMetrics(input: FollowUpMetricsInput): FollowUpMetrics[] {
  const {
    tab,
    statusFilter,
    priorityQueue,
    quotations,
    podc,
    invoices,
    activity,
    leads,
    procurements,
    filteredQuotationCount,
    filteredInvoiceCount,
    filteredActivityCount,
    filteredLeadCount,
    filteredProcurementCount,
    openLeadCount,
  } = input;

  return useMemo(() => {
    switch (tab) {
      case 'queue': {
        const m = computeQueueMetrics(priorityQueue);
        return [
          {
            label: 'Queue items',
            value: m.total,
            sublabel: `${openLeadCount} lead${openLeadCount === 1 ? '' : 's'} · ${quotations.length} quote${quotations.length === 1 ? '' : 's'} · ${podc.length} PO/DC · ${invoices.length} invoice${invoices.length === 1 ? '' : 's'}`,
          },
          {
            label: 'Critical',
            value: m.critical,
            variant: 'danger' as const,
            sublabel: 'Score ≥ 85',
          },
          {
            label: 'High priority',
            value: m.high,
            variant: 'warning' as const,
            sublabel: 'Score 70–84',
          },
          {
            label: 'Exposure',
            value: formatCompactCurrency(m.totalExposure),
            sublabel: `Top focus: ${m.topClient}`,
          },
        ];
      }
      case 'quotation': {
        const m = computeQuotationMetrics(quotations);
        return [
          { label: 'Open quotes', value: m.openCount, sublabel: 'Active pipeline' },
          {
            label: 'Expiring ≤7d',
            value: m.expiringCount,
            variant: 'warning' as const,
            sublabel: 'Needs follow-up',
          },
          {
            label: 'Pipeline value',
            value: formatCompactCurrency(m.totalPipeline),
            sublabel: 'Outstanding quotes',
          },
          {
            label: 'Won',
            value: m.approvedCount,
            variant: 'success' as const,
            sublabel: 'Approved',
          },
          {
            label: 'Lost value',
            value: formatCompactCurrency(m.lostValue),
            variant: 'danger' as const,
            sublabel: `${m.lostCount} lost · ${m.expiredCount} expired`,
          },
          { label: 'Filtered', value: filteredQuotationCount, sublabel: 'Current view' },
        ];
      }
      case 'podc': {
        const m = computePodcMetrics(podc);
        return [
          { label: 'Backlog items', value: m.backlogCount, sublabel: 'PO pending' },
          {
            label: 'Disputed',
            value: m.disputedCount,
            variant: 'danger' as const,
            sublabel: 'Open disputes',
          },
          {
            label: 'Blocked value',
            value: formatCompactCurrency(m.totalBlocked),
            sublabel: 'Cannot invoice',
          },
          { label: 'Avg pending', value: `${m.avgDaysPending}d`, sublabel: 'Days without PO' },
        ];
      }
      case 'invoice': {
        const m = computeInvoiceMetrics(invoices);
        return [
          {
            label: 'Overdue',
            value: m.overdueCount,
            variant: 'warning' as const,
            sublabel: 'Past due date',
          },
          {
            label: 'Critical (T3+)',
            value: m.criticalCount,
            variant: 'danger' as const,
            sublabel: '15+ days overdue',
          },
          {
            label: 'Overdue due',
            value: formatCompactCurrency(m.totalOverdueDue),
            sublabel: 'Collection exposure',
          },
          { label: 'Filtered', value: filteredInvoiceCount, sublabel: 'Current view' },
        ];
      }
      case 'activity':
        return [
          { label: 'Total events', value: activity.length, sublabel: 'All time' },
          { label: 'Filtered', value: filteredActivityCount, sublabel: 'Current view' },
          { label: 'Today', value: '—', sublabel: 'Grouped view' },
          { label: 'Source', value: statusFilter === 'all' ? 'All' : statusFilter, sublabel: 'Tab filter' },
        ];
      case 'lead': {
        const open = leads.filter((l) => l.status === 'New' || l.status === 'Qualified').length;
        const closed = leads.filter((l) => l.status === 'Converted' || l.status === 'Disqualified').length;
        const totalValue = leads.reduce((s, l) => s + (l.estimated_value || 0), 0);
        const overdue = leads.filter((l) => l.next_action_at && new Date(l.next_action_at).getTime() < Date.now() && (l.status === 'New' || l.status === 'Qualified')).length;
        return [
          { label: 'Open leads', value: open, sublabel: 'New + qualified' },
          { label: 'Pipeline value', value: formatCompactCurrency(totalValue), sublabel: 'All open + closed' },
          { label: 'Overdue action', value: overdue, variant: overdue > 0 ? ('warning' as const) : ('default' as const), sublabel: 'Past next-action date' },
          { label: 'Closed', value: closed, sublabel: 'Converted + disqualified' },
          { label: 'Filtered', value: filteredLeadCount, sublabel: 'Current view' },
        ];
      }
      case 'procurement': {
        const m = computeProcurementMetrics(procurements);
        return [
          { label: 'Open POs', value: m.openCount, sublabel: 'Awaiting vendor delivery' },
          {
            label: 'Delayed POs',
            value: m.delayedCount,
            variant: 'danger' as const,
            sublabel: 'Overdue delivery dates',
          },
          {
            label: 'Open PO Value',
            value: formatCompactCurrency(m.totalValue),
            sublabel: 'Procurement commitment',
          },
          { label: 'Avg lead time', value: `${m.avgDaysPending}d`, sublabel: 'Days pending vendor' },
          { label: 'Filtered', value: filteredProcurementCount, sublabel: 'Current view' },
        ];
      }
      default:
        return [];
    }
  }, [
    tab,
    statusFilter,
    priorityQueue,
    quotations,
    podc,
    invoices,
    activity,
    leads,
    procurements,
    filteredQuotationCount,
    filteredInvoiceCount,
    filteredActivityCount,
    filteredLeadCount,
    filteredProcurementCount,
    openLeadCount,
  ]);
}
