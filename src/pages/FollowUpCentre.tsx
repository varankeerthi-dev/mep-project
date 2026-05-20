import { useCallback, useMemo, useState } from 'react';
import { useAuth } from '../App';
import { FollowupTabs } from '@/components/follow-up/followup-tabs';
import { MetricsCards } from '@/components/follow-up/metrics-cards';
import { FollowupSearch } from '@/components/follow-up/followup-search';
import { FollowupFilterBar } from '@/components/follow-up/followup-filter-bar';
import { VirtualizedTableShell } from '@/components/follow-up/virtualized-table-shell';
import {
  QuotationFollowupRow,
  quotationTableHeader,
} from '@/components/follow-up/quotation-followup-row';
import { PodcBacklogRow, podcTableHeader } from '@/components/follow-up/podc-backlog-row';
import {
  InvoiceEscalationCard,
  invoiceTableHeader,
} from '@/components/follow-up/invoice-escalation-card';
import { ActivityLogItem, activityTableHeader } from '@/components/follow-up/activity-log-item';
import {
  PriorityQueueRow,
  priorityQueueTableHeader,
} from '@/components/follow-up/priority-queue-row';
import { InvoiceDetailPanel } from '@/components/follow-up/reminder-action-sheet';
import { ItemHistoryDrawer } from '@/components/follow-up/item-history-drawer';
import { useFollowupFilters } from '@/hooks/use-followup-filters';
import { useFollowupSearch } from '@/hooks/use-followup-search';
import { useWhatsappShare } from '@/hooks/use-whatsapp-share';
import {
  useFollowupQuotations,
  useFollowupPodc,
  useFollowupInvoices,
  useFollowupActivity,
  useLogQuotationResponse,
  useFlagPodcIssue,
  useRecordReminder,
  useFollowUpDataSource,
  useAssignFollowUp,
} from '@/hooks/use-followup-data';
import {
  useFollowupAssignees,
  resolveAssigneeLabel,
} from '@/hooks/use-followup-assignees';
import {
  filterQuotations,
  filterPodcBacklog,
  filterInvoices,
  filterActivityLogs,
  computeQuotationMetrics,
  computePodcMetrics,
  computeInvoiceMetrics,
} from '@/lib/followup/followup-utils';
import { formatCompactCurrency } from '@/lib/followup/currency-format';
import {
  buildPriorityQueue,
  filterPriorityQueue,
  computeQueueMetrics,
} from '@/lib/followup/priority-queue';
import type {
  FollowUpTab,
  InvoiceFollowUp,
  PriorityQueueItem,
  QuotationFollowUp,
  LinkedItemType,
} from '@/types/followup';
import { Skeleton } from '@/components/ui/skeleton';
import { useFollowupAccess } from '@/hooks/use-followup-access';

const ROW_HEIGHT = 40;

export default function FollowUpCentre() {
  const { user, organisation } = useAuth();
  const { canManage, isReadOnly, role } = useFollowupAccess();
  const dataSource = useFollowUpDataSource();
  const { filters, setFilters, setTab } = useFollowupFilters();
  const { search, setSearch } = useFollowupSearch(filters.q, (q) => setFilters({ q }));

  const { data: quotations = [], isLoading: loadingQ } = useFollowupQuotations();
  const { data: podc = [], isLoading: loadingP } = useFollowupPodc();
  const { data: invoices = [], isLoading: loadingI } = useFollowupInvoices();
  const { data: activity = [], isLoading: loadingA } = useFollowupActivity();

  const logResponse = useLogQuotationResponse();
  const flagIssue = useFlagPodcIssue();
  const recordReminder = useRecordReminder();
  const assignFollowUp = useAssignFollowUp();
  const { data: assignees = [] } = useFollowupAssignees();
  const { sendQuotationReminder, sharePodcPack, sendInvoiceReminder } = useWhatsappShare();

  const currentUserId = user?.id ?? null;

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

  const [drawerItem, setDrawerItem] = useState<{
    linkedType: LinkedItemType;
    linkedId: string;
    itemLabel: string;
    clientName: string;
    followUpStatus?: string;
  } | null>(null);

  const handleOpenHistory = useCallback(
    (
      linkedType: LinkedItemType,
      linkedId: string,
      itemLabel: string,
      clientName: string,
      followUpStatus?: string
    ) => {
      setDrawerItem({ linkedType, linkedId, itemLabel, clientName, followUpStatus });
    },
    []
  );

  const handleLogCommunication = useCallback(() => {
    if (!drawerItem) return;
    const params = new URLSearchParams();
    if (drawerItem.linkedType === 'quotation') params.set('linkedType', 'quotation');
    if (drawerItem.linkedType === 'invoice') params.set('linkedType', 'invoice');
    if (drawerItem.linkedType === 'podc') params.set('linkedType', 'podc');
    params.set('linkedId', drawerItem.linkedId);
    params.set('itemLabel', drawerItem.itemLabel);
    params.set('clientName', drawerItem.clientName);
    window.open(`/client-communication?${params.toString()}`, '_blank');
  }, [drawerItem]);

  const withAssigneeLabels = useCallback(
    <T extends { assignee_user_id?: string | null; assignee_name?: string | null }>(items: T[]) =>
      items.map((item) => ({
        ...item,
        assignee_name: resolveAssigneeLabel(
          assignees,
          item.assignee_user_id,
          item.assignee_name
        ),
      })),
    [assignees]
  );

  const filteredQuotations = useMemo(
    () => withAssigneeLabels(filterQuotations(quotations, filters, search, currentUserId)),
    [quotations, filters, search, currentUserId, withAssigneeLabels]
  );
  const filteredPodc = useMemo(
    () => withAssigneeLabels(filterPodcBacklog(podc, filters, search, currentUserId)),
    [podc, filters, search, currentUserId, withAssigneeLabels]
  );
  const filteredInvoices = useMemo(
    () => withAssigneeLabels(filterInvoices(invoices, filters, search, currentUserId)),
    [invoices, filters, search, currentUserId, withAssigneeLabels]
  );
  const filteredActivity = useMemo(
    () => filterActivityLogs(activity, filters, search),
    [activity, filters, search]
  );

  const priorityQueue = useMemo(
    () => buildPriorityQueue(quotations, podc, invoices),
    [quotations, podc, invoices]
  );

  const filteredQueue = useMemo(
    () =>
      filterPriorityQueue(
        priorityQueue,
        search,
        filters.status,
        filters.sort,
        filters.assignee,
        currentUserId
      ),
    [priorityQueue, search, filters.status, filters.sort, filters.assignee, currentUserId]
  );

  const handleAssigneeChange = useCallback(
    (source: 'quotation' | 'podc' | 'invoice', sourceId: string, userId: string | null) => {
      if (!canManage) return;
      assignFollowUp.mutate({ source, sourceId, assigneeUserId: userId });
    },
    [canManage, assignFollowUp]
  );

  const selectedInvoice = useMemo(
    () => filteredInvoices.find((i) => i.id === selectedInvoiceId) ?? null,
    [filteredInvoices, selectedInvoiceId]
  );

  const metrics = useMemo(() => {
    switch (filters.tab) {
      case 'queue': {
        const m = computeQueueMetrics(priorityQueue);
        return [
          {
            label: 'Queue items',
            value: m.total,
            sublabel: 'Ranked across all types',
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
          { label: 'Filtered', value: filteredQuotations.length, sublabel: 'Current view' },
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
          { label: 'Filtered', value: filteredInvoices.length, sublabel: 'Current view' },
        ];
      }
      case 'activity':
        return [
          { label: 'Total events', value: activity.length, sublabel: 'All time (mock)' },
          { label: 'Filtered', value: filteredActivity.length, sublabel: 'Current view' },
          { label: 'Today', value: '—', sublabel: 'Grouped view' },
          { label: 'Source', value: filters.status === 'all' ? 'All' : filters.status, sublabel: 'Tab filter' },
        ];
      default:
        return [];
    }
  }, [
    filters.tab,
    filters.status,
    priorityQueue,
    quotations,
    podc,
    invoices,
    activity,
    filteredQuotations.length,
    filteredInvoices.length,
    filteredActivity.length,
  ]);

  const tabCounts = useMemo(
    () => ({
      queue: priorityQueue.length,
      quotation: quotations.length,
      podc: podc.length,
      invoice: invoices.length,
      activity: activity.length,
    }),
    [
      priorityQueue.length,
      quotations.length,
      podc.length,
      invoices.length,
      activity.length,
    ]
  );

  const resolveSourceRecords = useCallback(
    (item: PriorityQueueItem) => {
      const quote = quotations.find((q) => q.id === item.source_id);
      const backlog = podc.find((p) => p.id === item.source_id);
      const invoice = invoices.find((i) => i.id === item.source_id);
      return { quote, backlog, invoice };
    },
    [quotations, podc, invoices]
  );

  const handleQueueOpen = useCallback(
    (item: PriorityQueueItem) => {
      setTab(item.source_tab);
      setFilters({ q: item.reference_label });
      if (item.source_tab === 'invoice') {
        setSelectedInvoiceId(item.source_id);
      }
    },
    [setTab, setFilters]
  );

  const handleQuotationReminder = useCallback(
    (item: QuotationFollowUp) => {
      if (!canManage) return;
      sendQuotationReminder(item);
      recordReminder.mutate({
        type: 'quotation',
        id: item.id,
        label: item.quotation_no,
        client: item.client_name,
      });
    },
    [canManage, sendQuotationReminder, recordReminder]
  );

  const handlePodcShare = useCallback(
    (item: (typeof podc)[0]) => {
      if (!canManage) return;
      sharePodcPack(item);
      recordReminder.mutate({
        type: 'podc',
        id: item.id,
        label: item.dc_wo_number,
        client: item.client_name,
      });
    },
    [canManage, sharePodcPack, recordReminder]
  );

  const handleInvoiceReminder = useCallback(
    (item: InvoiceFollowUp) => {
      if (!canManage) return;
      sendInvoiceReminder(item);
      recordReminder.mutate({
        type: 'invoice',
        id: item.id,
        label: item.invoice_no,
        client: item.client_name,
      });
    },
    [canManage, sendInvoiceReminder, recordReminder]
  );

  const handleQueueQuickAction = useCallback(
    (item: PriorityQueueItem) => {
      if (!canManage) return;
      const { quote, backlog, invoice } = resolveSourceRecords(item);
      if (item.source_tab === 'quotation' && quote) handleQuotationReminder(quote);
      if (item.source_tab === 'podc' && backlog) handlePodcShare(backlog);
      if (item.source_tab === 'invoice' && invoice) handleInvoiceReminder(invoice);
    },
    [
      canManage,
      resolveSourceRecords,
      handleQuotationReminder,
      handlePodcShare,
      handleInvoiceReminder,
    ]
  );

  const isLoading =
    (filters.tab === 'queue' && (loadingQ || loadingP || loadingI)) ||
    (filters.tab === 'quotation' && loadingQ) ||
    (filters.tab === 'podc' && loadingP) ||
    (filters.tab === 'invoice' && loadingI) ||
    (filters.tab === 'activity' && loadingA);

  const renderTabContent = (tab: FollowUpTab) => {
    if (isLoading) {
      return (
        <div className="space-y-2 p-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-lg" />
          ))}
        </div>
      );
    }

    switch (tab) {
      case 'queue':
        return (
          <VirtualizedTableShell
            items={filteredQueue}
            rowHeight={44}
            header={priorityQueueTableHeader}
            renderRow={(item, index) => (
              <PriorityQueueRow
                item={item}
                rank={index + 1}
                assignees={assignees}
                disabled={isReadOnly}
                onOpenSource={handleQueueOpen}
                onQuickAction={handleQueueQuickAction}
              />
            )}
            emptyMessage="No follow-up items in the queue. Check other tabs or relax filters."
          />
        );
      case 'quotation':
        return (
          <VirtualizedTableShell
            items={filteredQuotations}
            rowHeight={ROW_HEIGHT}
            header={quotationTableHeader}
            renderRow={(item) => (
              <QuotationFollowupRow
                item={item}
                assignees={assignees}
                disabled={isReadOnly}
                onReminder={handleQuotationReminder}
                onSelect={() =>
                  handleOpenHistory(
                    'quotation',
                    item.id,
                    item.quotation_no,
                    item.client_name,
                    item.status
                  )
                }
                onAssigneeChange={(id, userId) => handleAssigneeChange('quotation', id, userId)}
                onLogResponse={(id, response) =>
                  logResponse.mutate({
                    id,
                    response,
                    quotation_no: item.quotation_no,
                    client_name: item.client_name,
                    previousStatus: item.status,
                  })
                }
              />
            )}
            emptyMessage="No quotations match your filters."
          />
        );
      case 'podc':
        return (
          <VirtualizedTableShell
            items={filteredPodc}
            rowHeight={ROW_HEIGHT}
            header={podcTableHeader}
            renderRow={(item) => (
              <PodcBacklogRow
                item={item}
                assignees={assignees}
                disabled={isReadOnly}
                onSharePack={handlePodcShare}
                onSelect={() =>
                  handleOpenHistory(
                    'podc',
                    item.id,
                    item.dc_wo_number,
                    item.client_name
                  )
                }
                onAssigneeChange={(id, userId) => handleAssigneeChange('podc', id, userId)}
                onFlagIssue={(id, issue) =>
                  flagIssue.mutate({ id, issue, dc_wo_number: item.dc_wo_number })
                }
              />
            )}
            emptyMessage="No PO/DC backlog items match your filters."
            maxHeight="calc(100vh - 280px)"
          />
        );
      case 'invoice':
        return (
          <div className="flex min-h-0 flex-1 gap-3">
            <div className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white overflow-hidden">
              <div className="sticky top-0 z-10 border-b border-zinc-200 bg-zinc-50/95">
                {invoiceTableHeader}
              </div>
              <div className="max-h-[calc(100vh-280px)] overflow-auto">
                {filteredInvoices.length === 0 ? (
                  <p className="px-4 py-12 text-center text-sm text-zinc-500">
                    No invoices match your filters.
                  </p>
                ) : (
                  filteredInvoices.map((inv) => (
                    <InvoiceEscalationCard
                      key={inv.id}
                      invoice={inv}
                      assignees={assignees}
                      disabled={isReadOnly}
                      selected={selectedInvoiceId === inv.id}
                      onSelect={() => {
                        setSelectedInvoiceId(inv.id);
                        handleOpenHistory(
                          'invoice',
                          inv.id,
                          inv.invoice_no,
                          inv.client_name,
                          inv.collection_risk
                        );
                      }}
                      onReminder={() => handleInvoiceReminder(inv)}
                      onAssigneeChange={(id, userId) => handleAssigneeChange('invoice', id, userId)}
                    />
                  ))
                )}
              </div>
            </div>
            <InvoiceDetailPanel
              invoice={selectedInvoice}
              canManage={canManage}
              onClose={() => setSelectedInvoiceId(null)}
              onSendReminder={() => selectedInvoice && handleInvoiceReminder(selectedInvoice)}
            />
          </div>
        );
      case 'activity':
        return (
          <VirtualizedTableShell
            items={filteredActivity}
            rowHeight={52}
            header={activityTableHeader}
            renderRow={(item) => <ActivityLogItem log={item} />}
            emptyMessage="No activity logs match your filters."
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-50/80">
      <header className="shrink-0 border-b border-zinc-200 bg-white px-4 py-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-zinc-900">Follow-Up Centre</h1>
            <p className="text-xs text-zinc-500">
              Operational follow-up for quotations, PO/DC gaps, and invoice collections
              {organisation?.name ? ` · ${organisation.name}` : ''}
              {role ? ` · ${role}` : ''}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            {dataSource === 'mock' && (
              <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-900">
                Demo data — run <code className="font-mono">051_follow_up_centre.sql</code> in Supabase
              </span>
            )}
            {isReadOnly && (
              <span className="text-[11px] text-zinc-500">Read-only (manager/admin required to act)</span>
            )}
          </div>
        </div>
      </header>

      <FollowupTabs
        activeTab={filters.tab}
        onTabChange={setTab}
        counts={tabCounts}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-hidden px-4 pb-5 pt-5">
        <section className="shrink-0">
          <MetricsCards metrics={metrics} />
        </section>

        <section className="sticky top-0 z-20 shrink-0">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
            <FollowupSearch value={search} onChange={setSearch} />
            <FollowupFilterBar
            tab={filters.tab}
            filters={filters}
            assignees={assignees}
            onChange={setFilters}
          />
          </div>
        </section>

        <section className="min-h-0 flex-1 overflow-hidden pt-1">
          {renderTabContent(filters.tab)}
        </section>
      </div>

      <ItemHistoryDrawer
        open={!!drawerItem}
        onClose={() => setDrawerItem(null)}
        organisationId={organisation?.id}
        linkedType={drawerItem?.linkedType}
        linkedId={drawerItem?.linkedId}
        itemLabel={drawerItem?.itemLabel || ''}
        clientName={drawerItem?.clientName || ''}
        followUpStatus={drawerItem?.followUpStatus}
        onLogCommunication={handleLogCommunication}
      />
    </div>
  );
}
