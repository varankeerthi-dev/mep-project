import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { FollowupTabs, FollowupTabsMobile } from '@/components/follow-up/followup-tabs';
import { FollowupSearch } from '@/components/follow-up/followup-search';
import { FollowupFilterBar } from '@/components/follow-up/followup-filter-bar';
import type {
  KanbanGroupBy,
} from '@/components/follow-up/priority-queue-board';
import {
  KanbanViewSwitcher,
  KanbanGroupBySelect,
  type KanbanGroupByOption,
} from '@/components/ui/kanban';
import {
  EnterpriseTabNavigation,
  type TabItem,
} from '@/components/ui/EnterpriseTabNavigation';
import { ActivityTab } from '@/components/follow-up/tabs/ActivityTab';
import { LeadTab } from '@/components/follow-up/tabs/LeadTab';
import { QuotationTab } from '@/components/follow-up/tabs/QuotationTab';
import { PodcTab } from '@/components/follow-up/tabs/PodcTab';
import { ProcurementTab } from '@/components/follow-up/tabs/ProcurementTab';
import { InvoiceTab } from '@/components/follow-up/tabs/InvoiceTab';
import { QueueTab } from '@/components/follow-up/tabs/QueueTab';
import { ItemHistoryDrawer } from '@/components/follow-up/item-history-drawer';
import { useFollowupFilters } from '@/hooks/use-followup-filters';
import { useFollowupSearch } from '@/hooks/use-followup-search';
import { usePagination } from '@/hooks/use-followup-pagination';
import { useQueueFocus, type QuickFilter } from '@/hooks/use-queue-focus';
import { useWhatsappShare } from '@/hooks/use-whatsapp-share';
import {
  useFollowupQuotations,
  useFollowupPodc,
  useFollowupInvoices,
  useFollowupActivity,
  useLogQuotationResponse,
  useFlagPodcIssue,
  useRecordReminder,
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
  filterProcurement,
} from '@/lib/followup/followup-utils';
import {
  buildPriorityQueue,
  filterPriorityQueue,
} from '@/lib/followup/priority-queue';
import { useFollowUpMetrics } from '@/hooks/use-followup-metrics';
import {
  DEFAULT_FOLLOWUP_FILTERS,
} from '@/types/followup';

const KANBAN_GROUP_OPTIONS: KanbanGroupByOption<KanbanGroupBy>[] = [
  { key: 'priority', label: 'Priority' },
  { key: 'category', label: 'Category' },
  { key: 'party_type', label: 'Party Type' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'assignee', label: 'Assignee' },
];
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
import { WinLossModal } from '@/components/leads/win-loss-modal';
import { Button } from '@/components/ui/button';
import {
  UserPlus,
  MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';

export default function FollowUpCentre() {
  const { user, organisation } = useAuth();
  const { canManage, isReadOnly, role } = useFollowupAccess();
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
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [focusMode, setFocusMode] = useState<boolean>(false);

  // Pagination state lives in usePagination per list (page size 20, unchanged).

  const [viewMode, setViewMode] = useState<'table' | 'board'>(() => {
    try {
      return (localStorage.getItem('followup_queue_view_mode') as 'table' | 'board') || 'table';
    } catch {
      return 'table';
    }
  });

  const [kanbanGroupBy, setKanbanGroupBy] = useState<KanbanGroupBy>(() => {
    try {
      return (localStorage.getItem('followup_queue_group_by') as KanbanGroupBy) || 'priority';
    } catch {
      return 'priority';
    }
  });

  const handleViewModeChange = useCallback((mode: 'table' | 'board') => {
    setViewMode(mode);
    try {
      localStorage.setItem('followup_queue_view_mode', mode);
    } catch {}
  }, []);

  const handleKanbanGroupByChange = useCallback((group: KanbanGroupBy) => {
    setKanbanGroupBy(group);
    try {
      localStorage.setItem('followup_queue_group_by', group);
    } catch {}
  }, []);

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

  const { items: queueWithFocus, counts: quickFilterCounts } = useQueueFocus(
    filteredQueue,
    priorityQueue,
    focusMode,
    quickFilter
  );

  const queuePagination = usePagination(queueWithFocus, 20, [filters, search, quickFilter, focusMode]);

  const quotationPagination = usePagination(filteredQuotations, 20, [filters, search]);

  const podcPagination = usePagination(filteredPodc, 20, [filters, search]);

  const invoicePagination = usePagination(filteredInvoices, 20, [filters, search]);

  const activityPagination = usePagination(filteredActivity, 20, [filters, search]);

  const leadPagination = usePagination(filteredLeads, 20, [filters, search]);

  const procurementPagination = usePagination(filteredProcurement, 20, [filters, search]);

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

  const metrics = useFollowUpMetrics({
    tab: filters.tab,
    statusFilter: filters.status,
    priorityQueue,
    quotations,
    podc,
    invoices,
    activity,
    leads,
    procurements,
    filteredQuotationCount: filteredQuotations.length,
    filteredInvoiceCount: filteredInvoices.length,
    filteredActivityCount: filteredActivity.length,
    filteredLeadCount: filteredLeads.length,
    filteredProcurementCount: filteredProcurement.length,
    openLeadCount,
  });

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

  const tabItems: TabItem[] = useMemo(
    () => [
      {
        id: 'queue',
        label: 'Priority Queue',
        count: priorityQueue.length > 0 ? priorityQueue.length : undefined,
        badgeVariant: 'primary',
      },
      { id: 'lead', label: 'Leads', count: leads.length > 0 ? leads.length : undefined },
      { id: 'quotation', label: 'Quotations', count: quotations.length > 0 ? quotations.length : undefined },
      { id: 'podc', label: 'PO/DC Backlog', count: podc.length > 0 ? podc.length : undefined },
      {
        id: 'invoice',
        label: 'Invoices',
        count: invoices.length > 0 ? invoices.length : undefined,
        badgeVariant: invoices.length > 0 ? 'urgent' : 'neutral',
      },
      { id: 'procurement', label: 'Procurement', count: procurements.length > 0 ? procurements.length : undefined },
      { id: 'activity', label: 'Activity', count: activity.length > 0 ? activity.length : undefined },
    ],
    [
      priorityQueue.length,
      leads.length,
      quotations.length,
      podc.length,
      invoices.length,
      procurements.length,
      activity.length,
    ]
  );

  const recordMaps = useMemo(
    () => ({
      quotation: new Map(quotations.map((q) => [q.id, q] as const)),
      podc: new Map(podc.map((p) => [p.id, p] as const)),
      invoice: new Map(invoices.map((i) => [i.id, i] as const)),
      procurement: new Map(procurements.map((pr) => [pr.id, pr] as const)),
    }),
    [quotations, podc, invoices, procurements]
  );

  const resolveSourceRecords = useCallback(
    (item: PriorityQueueItem) => ({
      quote: recordMaps.quotation.get(item.source_id),
      backlog: recordMaps.podc.get(item.source_id),
      invoice: recordMaps.invoice.get(item.source_id),
      po: recordMaps.procurement.get(item.source_id),
    }),
    [recordMaps]
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

  // Industry standard React Query caching:
  // Only display skeleton on true initial load when there is no cached data yet.
  // When cached data is present, display rows immediately with zero delay while background revalidation occurs.
  const hasQueueData = quotations.length > 0 || podc.length > 0 || invoices.length > 0 || procurements.length > 0 || leads.length > 0;
  const isLoading =
    (filters.tab === 'queue' && !hasQueueData && (loadingQ || loadingP || loadingI || loadingPR || loadingL)) ||
    (filters.tab === 'quotation' && quotations.length === 0 && loadingQ) ||
    (filters.tab === 'podc' && podc.length === 0 && loadingP) ||
    (filters.tab === 'invoice' && invoices.length === 0 && loadingI) ||
    (filters.tab === 'activity' && activity.length === 0 && loadingA) ||
    (filters.tab === 'lead' && leads.length === 0 && loadingL) ||
    (filters.tab === 'procurement' && procurements.length === 0 && loadingPR);

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
        return (
          <QueueTab
            pagination={queuePagination}
            focusedItems={queueWithFocus}
            viewMode={viewMode}
            kanbanGroupBy={kanbanGroupBy}
            assignees={assignees}
            disabled={isReadOnly}
            selectedRowIds={selectedRowIds}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAll}
            onClearSelection={() => setSelectedRowIds(new Set())}
            onOpenSource={handleQueueOpen}
            onQuickAction={handleQueueQuickAction}
          />
        );
      }
      case 'quotation':
        return (
          <QuotationTab
            pagination={quotationPagination}
            assignees={assignees}
            disabled={isReadOnly}
            onReminder={handleQuotationReminder}
            onOpenHistory={(item) =>
              handleOpenHistory('quotation', item.id, item.quotation_no, item.client_name, item.status)
            }
            onAssigneeChange={(id, userId) => handleAssigneeChange('quotation', id, userId)}
            onLogResponse={(item, response) =>
              logResponse.mutate({ id: item.id, response, quotation_no: item.quotation_no, client_name: item.client_name, previousStatus: item.status })
            }
          />
        );
      case 'podc':
        return (
          <PodcTab
            pagination={podcPagination}
            assignees={assignees}
            disabled={isReadOnly}
            onSharePack={handlePodcShare}
            onOpenHistory={(item) => handleOpenHistory('podc', item.id, item.dc_wo_number, item.client_name)}
            onAssigneeChange={(id, userId) => handleAssigneeChange('podc', id, userId)}
            onFlagIssue={(item, issue) => flagIssue.mutate({ id: item.id, issue, dc_wo_number: item.dc_wo_number })}
          />
        );
      case 'invoice':
        return (
          <InvoiceTab
            pagination={invoicePagination}
            invoices={filteredInvoices}
            assignees={assignees}
            disabled={isReadOnly}
            canManage={canManage}
            selectedInvoiceId={selectedInvoiceId}
            onSelectInvoice={(inv) => {
              setSelectedInvoiceId(inv.id);
              handleOpenHistory('invoice', inv.id, inv.invoice_no, inv.client_name, inv.collection_risk);
            }}
            onReminder={handleInvoiceReminder}
            onAssigneeChange={(id, userId) => handleAssigneeChange('invoice', id, userId)}
            onClosePanel={() => setSelectedInvoiceId(null)}
          />
        );
      case 'activity':
        return <ActivityTab pagination={activityPagination} />;
      case 'lead':
        return (
          <LeadTab
            pagination={leadPagination}
            disabled={isReadOnly}
            onOpenHistory={(item) =>
              handleOpenHistory('lead', item.id, item.company_name || item.contact_name, item.client_name || item.contact_name)
            }
            onConvert={(id) => setWinLossTarget({ id, category: 'win' })}
            onDisqualify={(id) => setWinLossTarget({ id, category: 'disqualify' })}
            onSetNextAction={(id, at, label) =>
              updateLead.mutate({ id, patch: { next_action_at: at, next_action_label: label } })
            }
          />
        );
      case 'procurement':
        return (
          <ProcurementTab
            pagination={procurementPagination}
            assignees={assignees}
            disabled={isReadOnly}
            onReminder={(item) => {
              toast.success(`WhatsApp reminder prepared for ${item.vendor_name}`, {
                description: `Templated message for ${item.po_no} ready.`
              });
              recordReminder.mutate({
                type: 'procurement',
                id: item.id,
                label: item.po_no,
                client: item.vendor_name,
              });
            }}
            onOpenHistory={(item) => handleOpenHistory('procurement', item.id, item.po_no, item.vendor_name, item.status)}
            onAssigneeChange={(id, userId) => handleAssigneeChange('procurement', id, userId)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <header className="shrink-0 border-b border-slate-200 bg-white/90 backdrop-blur sticky top-0 z-30 px-6 py-4">
        <div className="max-w-[1680px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileTabsOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-600"
              aria-label="Open tabs"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 9h6v6H9z" />
              </svg>
            </button>
            <div className="flex items-baseline gap-3">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">Follow-Up Centre</h1>
              <p className="text-xs text-slate-500 hidden sm:inline">
                Operational follow-up for quotations, PO/DC gaps, and invoice collections
                {organisation?.name ? ` · ${organisation.name}` : ''}
                {role ? ` · ${role}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                leftIcon={<MessageSquare className="h-3.5 w-3.5 text-slate-500" />}
                onClick={() => window.open('/client-communication', '_blank')}
                title="Go to Client Communication page"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 hover:text-slate-900 border border-slate-300 rounded-md shadow-sm transition duration-150"
              >
                Communication Log
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                leftIcon={<UserPlus className="h-3.5 w-3.5" />}
                onClick={() => setLeadModalOpen(true)}
                disabled={!canManage}
                title={canManage ? 'Capture a new lead' : 'Manager/admin only'}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm shadow-blue-500/20 transition duration-150 active:scale-[0.98]"
              >
                New lead
              </Button>
            {isReadOnly && (
              <span className="text-[11px] text-slate-500">Read-only (manager/admin required to act)</span>
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
        <EnterpriseTabNavigation
          tabs={tabItems}
          activeTabId={filters.tab}
          onTabChange={(tabId) => setTab(tabId as FollowUpTab)}
        />
        <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-hidden px-6 pt-3.5 pb-4 bg-white">
          <section className="sticky top-0 z-20 shrink-0 flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-3 py-0 min-w-0">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-nowrap min-w-0 flex-1">
                <FollowupSearch value={search} onChange={setSearch} />
                <FollowupFilterBar
                  tab={filters.tab}
                  filters={filters}
                  assignees={assignees}
                  onChange={setFilters}
                  quickFilter={quickFilter}
                  onQuickFilterChange={setQuickFilter}
                  quickFilterCounts={quickFilterCounts}
                  queueTotalCount={filteredQueue.length}
                />
              </div>

              {/* Right: ALWAYS PINNED Table / Board toggle + Group by + Focus switch */}
              {filters.tab === 'queue' && (
                <div className="flex items-center gap-2.5 shrink-0 border-l border-slate-200/90 pl-3">
                  {viewMode === 'board' && (
                    <KanbanGroupBySelect<KanbanGroupBy>
                      value={kanbanGroupBy}
                      onChange={handleKanbanGroupByChange}
                      options={KANBAN_GROUP_OPTIONS}
                    />
                  )}

                  <KanbanViewSwitcher
                    viewMode={viewMode}
                    onViewModeChange={handleViewModeChange}
                  />

                  <label className="relative inline-flex items-center cursor-pointer select-none gap-2 ml-0.5">
                    <span className="text-xs font-semibold text-slate-600">Focus</span>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={focusMode}
                        onChange={(e) => setFocusMode(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-transform after:duration-200 after:ease-out peer-checked:bg-blue-600"></div>
                    </div>
                  </label>
                </div>
              )}
            </div>
          </section>

          <section className="min-h-0 flex-1 overflow-hidden">
            {renderTabContent(filters.tab)}
          </section>
        </div>
      </div>

      <div className="lg:hidden flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-4 pt-3 pb-3">
        <section className="sticky top-0 z-20 shrink-0">
          <div className="flex items-center justify-between gap-2 py-0 min-w-0">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-nowrap min-w-0 flex-1">
              <FollowupSearch value={search} onChange={setSearch} />
              <FollowupFilterBar
                tab={filters.tab}
                filters={filters}
                assignees={assignees}
                onChange={setFilters}
                quickFilter={quickFilter}
                onQuickFilterChange={setQuickFilter}
                quickFilterCounts={quickFilterCounts}
                queueTotalCount={filteredQueue.length}
              />
            </div>

            {/* Right: Pinned View Switcher for mobile */}
            {filters.tab === 'queue' && (
              <div className="flex items-center gap-1 shrink-0">
                <KanbanViewSwitcher
                  viewMode={viewMode}
                  onViewModeChange={handleViewModeChange}
                />
              </div>
            )}
          </div>
        </section>

        <section className="min-h-0 flex-1 overflow-hidden">
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
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-lg border border-slate-200 bg-slate-900 px-6 py-3.5 shadow-2xl transition-opacity duration-300 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-2 border-r border-slate-700 pr-4">
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-500 px-1 text-[11px] font-bold text-white">
              {selectedRowIds.size}
            </span>
            <span className="text-xs font-semibold text-slate-100">
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
              className="inline-flex h-8 items-center justify-center rounded-lg bg-slate-800 border border-slate-700 px-3 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors disabled:opacity-50"
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
              className="inline-flex h-8 items-center justify-center rounded-lg bg-green-600 px-3 text-xs font-semibold text-white hover:bg-green-500 transition-colors disabled:opacity-50"
            >
              WhatsApp Batch
            </button>
            <button
              type="button"
              onClick={() => setSelectedRowIds(new Set())}
              className="inline-flex h-8 items-center justify-center rounded-lg border border-transparent px-3 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}