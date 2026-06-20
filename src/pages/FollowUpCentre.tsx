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
import {
  ProcurementFollowupRow,
  procurementTableHeader,
} from '@/components/follow-up/procurement-followup-row';
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
  useFollowupProcurement,
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
  filterProcurement,
  computeProcurementMetrics,
} from '@/lib/followup/followup-utils';
import { formatCompactCurrency } from '@/lib/followup/currency-format';
import {
  buildPriorityQueue,
  filterPriorityQueue,
  computeQueueMetrics,
} from '@/lib/followup/priority-queue';
import {
  DEFAULT_FOLLOWUP_FILTERS,
} from '@/types/followup';
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
import { 
  UserPlus, 
  MessageSquare,
  Calendar,
  Clock,
  User,
  Hourglass,
  UserMinus,
  RotateCcw,
  CheckSquare,
  Square
} from 'lucide-react';
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
  const { data: procurements = [], isLoading: loadingPR } = useFollowupProcurement();

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
  
  // Selection checkbox states
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());

  // Quick Filter selections
  const [quickFilter, setQuickFilter] = useState<'all' | 'due_today' | 'overdue' | 'waiting' | 'upcoming' | 'unassigned'>('all');
  const [focusMode, setFocusMode] = useState<boolean>(false);

  const [queuePage, setQueuePage] = useState(1);
  const [quotationPage, setQuotationPage] = useState(1);
  const [podcPage, setPodcPage] = useState(1);
  const [invoicePage, setInvoicePage] = useState(1);
  const [activityPage, setActivityPage] = useState(1);
  const [leadPage, setLeadPage] = useState(1);
  const [procurementPage, setProcurementPage] = useState(1);
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

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback((items: PriorityQueueItem[]) => {
    setSelectedRowIds((prev) => {
      const allSelected = items.length > 0 && items.every((i) => prev.has(i.id));
      const next = new Set(prev);
      if (allSelected) {
        items.forEach((i) => next.delete(i.id));
      } else {
        items.forEach((i) => next.add(i.id));
      }
      return next;
    });
  }, []);


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
  const filteredProcurement = useMemo(
    () => withAssigneeLabels(filterProcurement(procurements, filters, search, currentUserId)),
    [procurements, filters, search, currentUserId, withAssigneeLabels]
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
    () => buildPriorityQueue(quotations, podc, invoices, leads, procurements),
    [quotations, podc, invoices, leads, procurements]
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

  const queueWithFocus = useMemo(() => {
    let items = filteredQueue;
    
    // Focus mode: show only essentials (critical and high bands)
    if (focusMode) {
      items = items.filter((i) => i.priority_band === 'critical' || i.priority_band === 'high');
    }
    
    // Quick filter selection
    if (quickFilter === 'due_today') {
      items = items.filter((i) => i.urgency_label.toLowerCase().includes('today') || i.urgency_label.toLowerCase().includes('due tomorrow') || i.urgency_label.toLowerCase().includes('tomorrow'));
    } else if (quickFilter === 'overdue') {
      items = items.filter((i) => i.urgency_label.toLowerCase().includes('overdue') || i.urgency_label.toLowerCase().includes('delayed') || i.urgency_label.toLowerCase().includes('days'));
    } else if (quickFilter === 'waiting') {
      items = items.filter((i) => i.reason.toLowerCase().includes('negotiation') || i.reason.toLowerCase().includes('sent') || i.urgency_label.toLowerCase().includes('validity'));
    } else if (quickFilter === 'upcoming') {
      items = items.filter((i) => i.urgency_label.toLowerCase().includes('upcoming') || i.urgency_label.toLowerCase().includes('close') || i.urgency_label.toLowerCase().includes('due'));
    } else if (quickFilter === 'unassigned') {
      items = items.filter((i) => !i.assignee_user_id);
    }
    
    return items;
  }, [filteredQueue, focusMode, quickFilter]);

  const quickFilterCounts = useMemo(() => {
    const due_today = priorityQueue.filter((i) => i.urgency_label.toLowerCase().includes('today') || i.urgency_label.toLowerCase().includes('due tomorrow') || i.urgency_label.toLowerCase().includes('tomorrow')).length;
    const overdue = priorityQueue.filter((i) => i.urgency_label.toLowerCase().includes('overdue') || i.urgency_label.toLowerCase().includes('delayed') || i.urgency_label.toLowerCase().includes('days')).length;
    const waiting = priorityQueue.filter((i) => i.reason.toLowerCase().includes('negotiation') || i.reason.toLowerCase().includes('sent') || i.urgency_label.toLowerCase().includes('validity')).length;
    const upcoming = priorityQueue.filter((i) => i.urgency_label.toLowerCase().includes('upcoming') || i.urgency_label.toLowerCase().includes('close') || i.urgency_label.toLowerCase().includes('due')).length;
    const unassigned = priorityQueue.filter((i) => !i.assignee_user_id).length;

    return { due_today, overdue, waiting, upcoming, unassigned };
  }, [priorityQueue]);

  const queuePagination = useMemo(() => {
    const totalItems = queueWithFocus.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (queuePage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return { totalItems, totalPages, startIndex, endIndex, currentItems: queueWithFocus.slice(startIndex, endIndex), hasNextPage: queuePage < totalPages, hasPrevPage: queuePage > 1 };
  }, [queueWithFocus, queuePage, itemsPerPage]);

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

  const procurementPagination = useMemo(() => {
    const totalItems = filteredProcurement.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (procurementPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return { totalItems, totalPages, startIndex, endIndex, currentItems: filteredProcurement.slice(startIndex, endIndex), hasNextPage: procurementPage < totalPages, hasPrevPage: procurementPage > 1 };
  }, [filteredProcurement, procurementPage, itemsPerPage]);

  useEffect(() => { setQueuePage(1); }, [filters, search, quickFilter, focusMode]);
  useEffect(() => { setQuotationPage(1); }, [filters, search]);
  useEffect(() => { setPodcPage(1); }, [filters, search]);
  useEffect(() => { setInvoicePage(1); }, [filters, search]);
  useEffect(() => { setActivityPage(1); }, [filters, search]);
  useEffect(() => { setLeadPage(1); }, [filters, search]);
  useEffect(() => { setProcurementPage(1); }, [filters, search]);

  // Reset stale status filter when switching to Leads tab so prior-tab
  // filters (e.g. 'sent', 'disputed') don't silently hide new leads.
  useEffect(() => {
    if (filters.tab === 'lead' && filters.status !== 'all') {
      setFilters({ status: 'all' });
    }
  }, [filters.tab, filters.status, setFilters]);

  // Clear row selections when switching tabs
  useEffect(() => {
    setSelectedRowIds(new Set());
  }, [filters.tab]);

  const handleAssigneeChange = useCallback(
    (source: 'quotation' | 'podc' | 'invoice' | 'procurement', sourceId: string, userId: string | null) => {
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
          { label: 'Filtered', value: filteredProcurement.length, sublabel: 'Current view' },
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
    procurements,
    filteredProcurement.length,
  ]);

  const tabCounts = useMemo(
    () => ({
      queue: priorityQueue.length,
      quotation: quotations.length,
      podc: podc.length,
      invoice: invoices.length,
      activity: activity.length,
      lead: leads.length,
      procurement: procurements.length,
    }),
    [
      priorityQueue.length,
      quotations.length,
      podc.length,
      invoices.length,
      activity.length,
      leads.length,
      procurements.length,
    ]
  );

  const resolveSourceRecords = useCallback(
    (item: PriorityQueueItem) => {
      const quote = quotations.find((q) => q.id === item.source_id);
      const backlog = podc.find((p) => p.id === item.source_id);
      const invoice = invoices.find((i) => i.id === item.source_id);
      const po = procurements.find((pr) => pr.id === item.source_id);
      return { quote, backlog, invoice, po };
    },
    [quotations, podc, invoices, procurements]
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
      const { quote, backlog, invoice, po } = resolveSourceRecords(item);
      if (item.source_tab === 'quotation' && quote) handleQuotationReminder(quote);
      if (item.source_tab === 'podc' && backlog) handlePodcShare(backlog);
      if (item.source_tab === 'invoice' && invoice) handleInvoiceReminder(invoice);
      if (item.source_tab === 'procurement' && po) {
        toast.success(`WhatsApp reminder prepared for ${po.vendor_name}`, {
          description: `Templated message for ${po.po_no} ready.`
        });
      }
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
    (filters.tab === 'queue' && (loadingQ || loadingP || loadingI || loadingPR || loadingL)) ||
    (filters.tab === 'quotation' && loadingQ) ||
    (filters.tab === 'podc' && loadingP) ||
    (filters.tab === 'invoice' && loadingI) ||
    (filters.tab === 'activity' && loadingA) ||
    (filters.tab === 'lead' && loadingL) ||
    (filters.tab === 'procurement' && loadingPR);

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
      case 'queue': {
        const isAllSelected = queuePagination.currentItems.length > 0 && queuePagination.currentItems.every(i => selectedRowIds.has(i.id));
        return (
          <div className="flex h-full flex-col rounded-xl border border-zinc-200 bg-white overflow-hidden">
            <div className="sticky top-0 z-30 border-b border-zinc-200 bg-zinc-50/95 backdrop-blur-sm">
              <div className="flex h-[38px] items-center px-4 text-xs font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-200 bg-zinc-50">
                <div className="w-[40px] shrink-0 flex items-center justify-center">
                  <button 
                    type="button" 
                    onClick={() => handleSelectAll(queuePagination.currentItems)} 
                    className="text-zinc-400 hover:text-zinc-600 transition-colors"
                  >
                    {isAllSelected ? (
                      <CheckSquare className="h-[18px] w-[18px] text-blue-600 fill-blue-50/10" />
                    ) : (
                      <Square className="h-[18px] w-[18px]" />
                    )}
                  </button>
                </div>
                <span className="w-[100px] shrink-0 px-2 text-left">Priority</span>
                <span className="w-[160px] shrink-0 px-2 text-left">Entity / Reference</span>
                <span className="w-[240px] shrink-0 px-2 text-left">Client / Project</span>
                <span className="w-[260px] shrink-0 px-2 text-left">Next Action & Status</span>
                <span className="w-[130px] shrink-0 px-2 text-right">Amount</span>
                <span className="w-[120px] shrink-0 px-2 text-center">Timeline</span>
                <span className="w-[150px] shrink-0 px-2 text-left">Owner</span>
                <span className="w-[140px] shrink-0 px-2 text-left">Last Activity</span>
                <span className="w-[120px] shrink-0 text-center">Action</span>
              </div>
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
                    selected={selectedRowIds.has(item.id)}
                    onToggleSelect={handleToggleSelect}
                  />
                ))
              )}
            </div>
            <PaginationFooter page={queuePage} setPage={setQueuePage} pagination={queuePagination} />
          </div>
        );
      }
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
                    onSelect={() => handleOpenHistory('lead', item.id, item.company_name || item.contact_name, item.client_name || item.contact_name)}
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
      case 'procurement':
        return (
          <div className="flex h-full flex-col rounded-xl border border-zinc-200 bg-white overflow-hidden">
            <div className="sticky top-0 z-30 border-b border-zinc-200 bg-zinc-50/95 backdrop-blur-sm">
              {procurementTableHeader}
            </div>
            <div className="flex-1 overflow-auto">
              {procurementPagination.currentItems.length === 0 ? (
                <p className="px-4 py-12 text-center text-sm text-zinc-500">No procurement items match your filters.</p>
              ) : (
                procurementPagination.currentItems.map((item) => (
                  <ProcurementFollowupRow
                    key={item.id}
                    item={item}
                    assignees={assignees}
                    disabled={isReadOnly}
                    onReminder={(po) => {
                      toast.success(`WhatsApp reminder prepared for ${po.vendor_name}`, {
                        description: `Templated message for ${po.po_no} ready.`
                      });
                      recordReminder.mutate({
                        type: 'procurement',
                        id: po.id,
                        label: po.po_no,
                        client: po.vendor_name,
                      });
                    }}
                    onSelect={() => handleOpenHistory('procurement', item.id, item.po_no, item.vendor_name, item.status)}
                    onAssigneeChange={(id, userId) => handleAssigneeChange('procurement', id, userId)}
                  />
                ))
              )}
            </div>
            <PaginationFooter page={procurementPage} setPage={setProcurementPage} pagination={procurementPagination} />
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
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                leftIcon={<MessageSquare className="h-3.5 w-3.5" />}
                onClick={() => window.open('/client-communication', '_blank')}
                title="Go to Client Communication page"
              >
                Communication Log
              </Button>
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
            </div>
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
            {filters.tab === 'queue' && (
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mr-1">Quick Filters:</span>
                  {[
                    { value: 'all', label: 'All Items', count: filteredQueue.length },
                    { value: 'due_today', label: 'Due Today/Tomorrow', count: quickFilterCounts.due_today },
                    { value: 'overdue', label: 'Overdue/Delayed', count: quickFilterCounts.overdue },
                    { value: 'waiting', label: 'Waiting on Customer', count: quickFilterCounts.waiting },
                    { value: 'upcoming', label: 'Upcoming / Close', count: quickFilterCounts.upcoming },
                    { value: 'unassigned', label: 'Unassigned', count: quickFilterCounts.unassigned },
                  ].map((pill) => (
                    <button
                      key={pill.value}
                      type="button"
                      onClick={() => setQuickFilter(pill.value as any)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-all ${
                        quickFilter === pill.value
                          ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-700/20'
                          : 'bg-zinc-50 text-zinc-600 border border-zinc-200 hover:bg-zinc-100 hover:text-zinc-900'
                      }`}
                    >
                      <span>{pill.label}</span>
                      <span className={`inline-flex items-center justify-center rounded-full px-1.5 py-0.25 text-[9px] font-bold ${
                        quickFilter === pill.value
                          ? 'bg-blue-600 text-white'
                          : 'bg-zinc-200 text-zinc-600'
                      }`}>
                        {pill.count}
                      </span>
                    </button>
                  ))}
                  {quickFilter !== 'all' && (
                    <button
                      type="button"
                      onClick={() => setQuickFilter('all')}
                      className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-600 transition-colors ml-1 font-medium"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Reset
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={focusMode}
                      onChange={(e) => setFocusMode(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
                    <span className="ml-2 text-xs font-semibold text-zinc-700 flex items-center gap-1">
                      Focus Mode
                      <span className="text-[10px] font-normal text-zinc-400">(Critical/High)</span>
                    </span>
                  </label>
                </div>
              </div>
            )}
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
          {filters.tab === 'queue' && (
            <div className="mt-2 flex flex-col gap-2.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 shadow-sm">
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { value: 'all', label: 'All', count: filteredQueue.length },
                  { value: 'due_today', label: 'Due', count: quickFilterCounts.due_today },
                  { value: 'overdue', label: 'Overdue', count: quickFilterCounts.overdue },
                  { value: 'waiting', label: 'Waiting', count: quickFilterCounts.waiting },
                  { value: 'unassigned', label: 'Unassigned', count: quickFilterCounts.unassigned },
                ].map((pill) => (
                  <button
                    key={pill.value}
                    type="button"
                    onClick={() => setQuickFilter(pill.value as any)}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-all ${
                      quickFilter === pill.value
                        ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-700/20'
                        : 'bg-zinc-50 text-zinc-500 border border-zinc-200'
                    }`}
                  >
                    <span>{pill.label}</span>
                    <span className="text-[9px] font-bold text-zinc-400">
                      ({pill.count})
                    </span>
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-zinc-100 pt-2">
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={focusMode}
                    onChange={(e) => setFocusMode(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
                  <span className="ml-2 text-xs font-semibold text-zinc-700">
                    Focus Mode
                  </span>
                </label>
                {quickFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setQuickFilter('all')}
                    className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-600"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset
                  </button>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="min-h-0 flex-1 overflow-hidden pt-1">
          {renderTabContent(filters.tab)}
        </section>
      </div>

      <ItemHistoryDrawer
        open={!!drawerItem}
        onClose={() => setDrawerItem(null)}
        organisationId={organisation?.id || undefined}
        linkedType={drawerItem?.linkedType}
        linkedId={drawerItem?.linkedId}
        itemLabel={drawerItem?.itemLabel || ''}
        clientName={drawerItem?.clientName || ''}
        followUpStatus={drawerItem?.followUpStatus}
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

      {/* Floating Bulk Actions Bar */}
      {selectedRowIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-xl border border-zinc-200 bg-zinc-900 px-6 py-3.5 shadow-2xl transition-all animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-2 border-r border-zinc-700 pr-4">
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-500 px-1 text-[11px] font-bold text-white">
              {selectedRowIds.size}
            </span>
            <span className="text-xs font-semibold text-zinc-100">
              items selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isReadOnly}
              onClick={() => {
                toast.success('Bulk reassignment initialized', {
                  description: `Reassigning ${selectedRowIds.size} items...`
                });
              }}
              className="inline-flex h-8 items-center justify-center rounded-lg bg-zinc-800 border border-zinc-700 px-3 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 transition-colors disabled:opacity-50"
            >
              Bulk Reassign
            </button>
            <button
              type="button"
              disabled={isReadOnly}
              onClick={() => {
                toast.success('WhatsApp batch template prepared', {
                  description: `Preparing templates for ${selectedRowIds.size} clients...`
                });
              }}
              className="inline-flex h-8 items-center justify-center rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
            >
              WhatsApp Batch
            </button>
            <button
              type="button"
              onClick={() => setSelectedRowIds(new Set())}
              className="inline-flex h-8 items-center justify-center rounded-lg border border-transparent px-3 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}