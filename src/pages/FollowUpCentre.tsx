import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../App';
import { FollowupTabs, FollowupTabsMobile } from '@/components/follow-up/followup-tabs';
import { FollowupSearch } from '@/components/follow-up/followup-search';
import { FollowupFilterBar } from '@/components/follow-up/followup-filter-bar';
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
import { useLeads, useCreateLead, useUpdateLead, useConvertLead, useDisqualifyLead } from '@/hooks/use-leads';
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
import { LeadCaptureModal } from '@/components/leads/lead-capture-modal';
import { LeadRow, leadTableHeader } from '@/components/follow-up/lead-row';
import { WinLossModal } from '@/components/leads/win-loss-modal';
import { Button } from '@/components/ui/button';
import { UserPlus } from 'lucide-react';
import { toast } from 'sonner';

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
  const { data: leads = [], isLoading: loadingL } = useLeads();

  const logResponse = useLogQuotationResponse();
  const flagIssue = useFlagPodcIssue();
  const recordReminder = useRecordReminder();
  const assignFollowUp = useAssignFollowUp();
  const createLead = useCreateLead();
  const updateLead = useUpdateLead();
  const convertLead = useConvertLead();
  const disqualifyLead = useDisqualifyLead();
  const { data: assignees = [] } = useFollowupAssignees();
  const { sendQuotationReminder, sharePodcPack, sendInvoiceReminder } = useWhatsappShare();

  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [winLossTarget, setWinLossTarget] = useState<{ id: string; category: 'win' | 'loss' | 'disqualify' } | null>(null);

  const currentUserId = user?.id ?? null;

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [queuePage, setQueuePage] = useState(1);
  const [quotationPage, setQuotationPage] = useState(1);
  const [podcPage, setPodcPage] = useState(1);
  const [invoicePage, setInvoicePage] = useState(1);
  const [activityPage, setActivityPage] = useState(1);
  const [leadPage, setLeadPage] = useState(1);
  const itemsPerPage = 20;

  const [drawerItem, setDrawerItem] = useState<{
    linkedType: LinkedItemType;
    linkedId: string;
    itemLabel: string;
    clientName: string;
    followUpStatus?: string;
  } | null>(null);

  const [mobileTabsOpen, setMobileTabsOpen] = useState(false);

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

  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (filters.status !== 'all' && l.status !== filters.status) return false;
      if (!q) return true;
      return (
        l.contact_name.toLowerCase().includes(q) ||
        l.company_name.toLowerCase().includes(q) ||
        l.project_name.toLowerCase().includes(q) ||
        l.contact_email.toLowerCase().includes(q) ||
        l.contact_phone.toLowerCase().includes(q)
      );
    });
  }, [leads, filters.status, search]);

  const priorityQueue = useMemo(
    () => buildPriorityQueue(quotations, podc, invoices, leads),
    [quotations, podc, invoices, leads]
  );

  const openLeadCount = useMemo(
    () => leads.filter((l) => l.status === 'New' || l.status === 'Qualified').length,
    [leads]
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

  const queuePagination = useMemo(() => {
    const totalItems = filteredQueue.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (queuePage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return { totalItems, totalPages, startIndex, endIndex, currentItems: filteredQueue.slice(startIndex, endIndex), hasNextPage: queuePage < totalPages, hasPrevPage: queuePage > 1 };
  }, [filteredQueue, queuePage, itemsPerPage]);

  const quotationPagination = useMemo(() => {
    const totalItems = filteredQuotations.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (quotationPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return { totalItems, totalPages, startIndex, endIndex, currentItems: filteredQuotations.slice(startIndex, endIndex), hasNextPage: quotationPage < totalPages, hasPrevPage: quotationPage > 1 };
  }, [filteredQuotations, quotationPage, itemsPerPage]);

  const podcPagination = useMemo(() => {
    const totalItems = filteredPodc.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (podcPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return { totalItems, totalPages, startIndex, endIndex, currentItems: filteredPodc.slice(startIndex, endIndex), hasNextPage: podcPage < totalPages, hasPrevPage: podcPage > 1 };
  }, [filteredPodc, podcPage, itemsPerPage]);

  const invoicePagination = useMemo(() => {
    const totalItems = filteredInvoices.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (invoicePage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return { totalItems, totalPages, startIndex, endIndex, currentItems: filteredInvoices.slice(startIndex, endIndex), hasNextPage: invoicePage < totalPages, hasPrevPage: invoicePage > 1 };
  }, [filteredInvoices, invoicePage, itemsPerPage]);

  const activityPagination = useMemo(() => {
    const totalItems = filteredActivity.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (activityPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return { totalItems, totalPages, startIndex, endIndex, currentItems: filteredActivity.slice(startIndex, endIndex), hasNextPage: activityPage < totalPages, hasPrevPage: activityPage > 1 };
  }, [filteredActivity, activityPage, itemsPerPage]);

  const leadPagination = useMemo(() => {
    const totalItems = filteredLeads.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (leadPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return { totalItems, totalPages, startIndex, endIndex, currentItems: filteredLeads.slice(startIndex, endIndex), hasNextPage: leadPage < totalPages, hasPrevPage: leadPage > 1 };
  }, [filteredLeads, leadPage, itemsPerPage]);

  useEffect(() => { setQueuePage(1); }, [filters, search]);
  useEffect(() => { setQuotationPage(1); }, [filters, search]);
  useEffect(() => { setPodcPage(1); }, [filters, search]);
  useEffect(() => { setInvoicePage(1); }, [filters, search]);
  useEffect(() => { setActivityPage(1); }, [filters, search]);
  useEffect(() => { setLeadPage(1); }, [filters, search]);

  // Reset stale status filter when switching to Leads tab so prior-tab
  // filters (e.g. 'sent', 'disputed') don't silently hide new leads.
  useEffect(() => {
    if (filters.tab === 'lead' && filters.status !== 'all') {
      setFilters({ status: 'all' });
    }
  }, [filters.tab, filters.status, setFilters]);

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
          { label: 'Filtered', value: filteredLeads.length, sublabel: 'Current view' },
        ];
      }
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
    openLeadCount,
    filteredLeads.length,
  ]);

  const tabCounts = useMemo(
    () => ({
      queue: priorityQueue.length,
      quotation: quotations.length,
      podc: podc.length,
      invoice: invoices.length,
      activity: activity.length,
      lead: leads.length,
    }),
    [
      priorityQueue.length,
      quotations.length,
      podc.length,
      invoices.length,
      activity.length,
      leads.length,
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
      // Leads are not a tab in the Follow-Up Centre — they live in the queue.
      // Open the lead capture context inline (here: scroll to the lead's row
      // in the queue or future leads tab). For now, set the search filter so
      // the user can find it in the priority queue.
      if (item.source_tab === 'lead') {
        setFilters({ q: item.reference_label });
        return;
      }
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
      if (item.source_tab === 'lead') {
        // No outbound action wired yet — open the lead context (queue search).
        handleQueueOpen(item);
        return;
      }
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
      handleQueueOpen,
    ]
  );

  const isLoading =
    (filters.tab === 'queue' && (loadingQ || loadingP || loadingI)) ||
    (filters.tab === 'quotation' && loadingQ) ||
    (filters.tab === 'podc' && loadingP) ||
    (filters.tab === 'invoice' && loadingI) ||
    (filters.tab === 'activity' && loadingA) ||
    (filters.tab === 'lead' && loadingL);

  const PaginationFooter = useCallback(
    ({ page, setPage, pagination }: { page: number; setPage: (p: number) => void; pagination: { totalItems: number; totalPages: number; startIndex: number; endIndex: number; hasNextPage: boolean; hasPrevPage: boolean } }) => {
      return (
        <div className="flex items-center justify-between border-t border-zinc-200 bg-zinc-50/50 px-6 py-4">
          <div className="text-sm font-medium text-zinc-600">
            Showing {pagination.totalItems === 0 ? 0 : pagination.startIndex + 1} to{' '}
            {Math.min(pagination.endIndex, pagination.totalItems)} of {pagination.totalItems} items
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={!pagination.hasPrevPage}
              className={`flex h-[32px] min-w-[80px] items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                pagination.hasPrevPage
                  ? 'border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-200'
                  : 'cursor-not-allowed border border-zinc-100 bg-zinc-50 text-zinc-400'
              }`}
            >
              Previous
            </button>
            <div className="flex items-center gap-1.5">
              {Array.from({ length: Math.max(1, Math.min(5, pagination.totalPages)) }, (_, i) => {
                const pageNum =
                  pagination.totalPages <= 5
                    ? i + 1
                    : page <= 3
                      ? i + 1
                      : page >= pagination.totalPages - 2
                        ? pagination.totalPages - 4 + i
                        : page - 2 + i;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`flex h-[32px] min-w-[32px] items-center justify-center rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                      page === pageNum
                        ? 'border border-blue-600/20 bg-blue-600/10 text-blue-600 shadow-sm'
                        : 'border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setPage(page + 1)}
              disabled={!pagination.hasNextPage}
              className={`flex h-[32px] min-w-[80px] items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                pagination.hasNextPage
                  ? 'border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-200'
                  : 'cursor-not-allowed border border-zinc-100 bg-zinc-50 text-zinc-400'
              }`}
            >
              Next
            </button>
          </div>
        </div>
      );
    },
    []
  );

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
          <div className="flex h-full flex-col rounded-xl border border-zinc-200 bg-white overflow-hidden">
            <div className="sticky top-0 z-30 border-b border-zinc-200 bg-zinc-50/95 backdrop-blur-sm">
              {priorityQueueTableHeader}
            </div>
            <div className="flex-1 overflow-auto">
              {queuePagination.currentItems.length === 0 ? (
                <p className="px-4 py-12 text-center text-sm text-zinc-500">
                  No follow-up items in the queue. Check other tabs or relax filters.
                </p>
              ) : (
                queuePagination.currentItems.map((item, index) => (
                  <PriorityQueueRow
                    key={item.id}
                    item={item}
                    rank={queuePagination.startIndex + index + 1}
                    assignees={assignees}
                    disabled={isReadOnly}
                    onOpenSource={handleQueueOpen}
                    onQuickAction={handleQueueQuickAction}
                  />
                ))
              )}
            </div>
            <PaginationFooter page={queuePage} setPage={setQueuePage} pagination={queuePagination} />
          </div>
        );
      case 'quotation':
        return (
          <div className="flex h-full flex-col rounded-xl border border-zinc-200 bg-white overflow-hidden">
            <div className="sticky top-0 z-30 border-b border-zinc-200 bg-zinc-50/95 backdrop-blur-sm">
              {quotationTableHeader}
            </div>
            <div className="flex-1 overflow-auto">
              {quotationPagination.currentItems.length === 0 ? (
                <p className="px-4 py-12 text-center text-sm text-zinc-500">No quotations match your filters.</p>
              ) : (
                quotationPagination.currentItems.map((item) => (
                  <QuotationFollowupRow
                    key={item.id}
                    item={item}
                    assignees={assignees}
                    disabled={isReadOnly}
                    onReminder={handleQuotationReminder}
                    onSelect={() =>
                      handleOpenHistory('quotation', item.id, item.quotation_no, item.client_name, item.status)
                    }
                    onAssigneeChange={(id, userId) => handleAssigneeChange('quotation', id, userId)}
                    onLogResponse={(id, response) =>
                      logResponse.mutate({ id, response, quotation_no: item.quotation_no, client_name: item.client_name, previousStatus: item.status })
                    }
                  />
                ))
              )}
            </div>
            <PaginationFooter page={quotationPage} setPage={setQuotationPage} pagination={quotationPagination} />
          </div>
        );
      case 'podc':
        return (
          <div className="flex h-full flex-col rounded-xl border border-zinc-200 bg-white overflow-hidden">
            <div className="sticky top-0 z-30 border-b border-zinc-200 bg-zinc-50/95 backdrop-blur-sm">
              {podcTableHeader}
            </div>
            <div className="flex-1 overflow-auto">
              {podcPagination.currentItems.length === 0 ? (
                <p className="px-4 py-12 text-center text-sm text-zinc-500">No PO/DC backlog items match your filters.</p>
              ) : (
                podcPagination.currentItems.map((item) => (
                  <PodcBacklogRow
                    key={item.id}
                    item={item}
                    assignees={assignees}
                    disabled={isReadOnly}
                    onSharePack={handlePodcShare}
                    onSelect={() => handleOpenHistory('podc', item.id, item.dc_wo_number, item.client_name)}
                    onAssigneeChange={(id, userId) => handleAssigneeChange('podc', id, userId)}
                    onFlagIssue={(id, issue) => flagIssue.mutate({ id, issue, dc_wo_number: item.dc_wo_number })}
                  />
                ))
              )}
            </div>
            <PaginationFooter page={podcPage} setPage={setPodcPage} pagination={podcPagination} />
          </div>
        );
      case 'invoice':
        return (
          <div className="flex min-h-0 flex-1 gap-3">
            <div className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white overflow-hidden flex flex-col">
              <div className="sticky top-0 z-30 border-b border-zinc-200 bg-zinc-50/95">
                {invoiceTableHeader}
              </div>
              <div className="flex-1 overflow-auto">
                {invoicePagination.currentItems.length === 0 ? (
                  <p className="px-4 py-12 text-center text-sm text-zinc-500">No invoices match your filters.</p>
                ) : (
                  invoicePagination.currentItems.map((inv) => (
                    <InvoiceEscalationCard
                      key={inv.id}
                      invoice={inv}
                      assignees={assignees}
                      disabled={isReadOnly}
                      selected={selectedInvoiceId === inv.id}
                      onSelect={() => {
                        setSelectedInvoiceId(inv.id);
                        handleOpenHistory('invoice', inv.id, inv.invoice_no, inv.client_name, inv.collection_risk);
                      }}
                      onReminder={() => handleInvoiceReminder(inv)}
                      onAssigneeChange={(id, userId) => handleAssigneeChange('invoice', id, userId)}
                    />
                  ))
                )}
              </div>
              <PaginationFooter page={invoicePage} setPage={setInvoicePage} pagination={invoicePagination} />
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
          <div className="flex h-full flex-col rounded-xl border border-zinc-200 bg-white overflow-hidden">
            <div className="sticky top-0 z-30 border-b border-zinc-200 bg-zinc-50/95 backdrop-blur-sm">
              {activityTableHeader}
            </div>
            <div className="flex-1 overflow-auto">
              {activityPagination.currentItems.length === 0 ? (
                <p className="px-4 py-12 text-center text-sm text-zinc-500">No activity logs match your filters.</p>
              ) : (
                activityPagination.currentItems.map((item) => (
                  <ActivityLogItem key={item.id} log={item} />
                ))
              )}
            </div>
            <PaginationFooter page={activityPage} setPage={setActivityPage} pagination={activityPagination} />
          </div>
        );
      case 'lead':
        return (
          <div className="flex h-full flex-col rounded-xl border border-zinc-200 bg-white overflow-hidden">
            <div className="sticky top-0 z-30 border-b border-zinc-200 bg-zinc-50/95 backdrop-blur-sm">
              {leadTableHeader}
            </div>
            <div className="flex-1 overflow-auto">
              {leadPagination.currentItems.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center px-4 py-12 text-center">
                  <p className="text-sm font-medium text-zinc-700">No leads match your filters.</p>
                  <p className="mt-1 text-xs text-zinc-500">Capture your first lead with the “New lead” button above.</p>
                </div>
              ) : (
                leadPagination.currentItems.map((item) => (
                  <LeadRow
                    key={item.id}
                    item={item}
                    disabled={isReadOnly}
                    onSelect={() => handleOpenHistory('quotation', item.id, item.company_name || item.contact_name, item.client_name || item.contact_name)}
                    onConvert={() => setWinLossTarget({ id: item.id, category: 'win' })}
                    onDisqualify={() => setWinLossTarget({ id: item.id, category: 'disqualify' })}
                    onSetNextAction={(id, at, label) =>
                      updateLead.mutate({ id, patch: { next_action_at: at, next_action_label: label } })
                    }
                  />
                ))
              )}
            </div>
            <PaginationFooter page={leadPage} setPage={setLeadPage} pagination={leadPagination} />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-50/80">
      <header className="shrink-0 border-b border-zinc-200 bg-white px-4 py-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileTabsOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-zinc-100 text-zinc-600"
              aria-label="Open tabs"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 9h6v6H9z" />
              </svg>
            </button>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-zinc-900">Follow-Up Centre</h1>
              <p className="text-xs text-zinc-500">
                Operational follow-up for quotations, PO/DC gaps, and invoice collections
                {organisation?.name ? ` · ${organisation.name}` : ''}
                {role ? ` · ${role}` : ''}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Button
              type="button"
              variant="primary"
              size="sm"
              leftIcon={<UserPlus className="h-3.5 w-3.5" />}
              onClick={() => setLeadModalOpen(true)}
              disabled={!canManage}
              title={canManage ? 'Capture a new lead' : 'Manager/admin only'}
            >
              New lead
            </Button>
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

      <FollowupTabsMobile
        activeTab={filters.tab}
        onTabChange={setTab}
        counts={tabCounts}
        onClose={() => setMobileTabsOpen(false)}
      />

      <div className="hidden lg:flex h-full min-h-0 flex-col">
        <FollowupTabs
          activeTab={filters.tab}
          onTabChange={setTab}
          counts={tabCounts}
          orientation="horizontal"
        />
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-hidden px-4 pb-5 pt-5">
          <section className="sticky top-0 z-20 shrink-0">
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-[10px] shadow-sm">
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
      </div>

      <div className="lg:hidden flex min-h-0 flex-1 flex-col gap-5 overflow-hidden px-4 pb-5 pt-5">
        <section className="sticky top-0 z-20 shrink-0">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-[10px] shadow-sm">
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

      <LeadCaptureModal
        open={leadModalOpen}
        onOpenChange={setLeadModalOpen}
        defaultOwnerUserId={currentUserId}
      />

      <WinLossModal
        open={!!winLossTarget}
        onOpenChange={(o) => !o && setWinLossTarget(null)}
        category={winLossTarget?.category ?? 'win'}
        referenceLabel={
          winLossTarget
            ? leads.find((l) => l.id === winLossTarget.id)?.company_name ||
              leads.find((l) => l.id === winLossTarget.id)?.contact_name
            : undefined
        }
        onConfirm={({ reasonId, notes }) => {
          if (!winLossTarget) return;
          const targetId = winLossTarget.id;
          if (winLossTarget.category === 'win') {
            convertLead.mutate(
              { id: targetId },
              {
                onSuccess: () =>
                  toast.success('Lead converted', {
                    description: 'Next: open the lead to link a client/quotation.',
                  }),
                onError: (err: unknown) =>
                  toast.error('Could not convert lead', { description: err instanceof Error ? err.message : 'Unknown' }),
              }
            );
          } else if (winLossTarget.category === 'disqualify') {
            disqualifyLead.mutate(
              { id: targetId, reason: notes || 'No reason given' },
              {
                onSuccess: () => toast.success('Lead disqualified'),
                onError: (err: unknown) =>
                  toast.error('Could not disqualify lead', { description: err instanceof Error ? err.message : 'Unknown' }),
              }
            );
          } else {
            // loss — not directly used for leads, but kept for shape parity
            updateLead.mutate({ id: targetId, patch: { status: 'On Hold' } });
          }
          // reason/notes are captured for future use; lead model doesn't have reason columns yet
          void reasonId;
          setWinLossTarget(null);
        }}
      />
    </div>
  );
}