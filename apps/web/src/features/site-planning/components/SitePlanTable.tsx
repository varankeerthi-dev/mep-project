import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Calendar, Clock, AlertTriangle, CheckCircle2, 
  Send, History, Edit, UserCheck, Eye,
  Briefcase, Plus, RefreshCw, Table as TableIcon, Calendar as CalendarIcon,
  Filter as FilterIcon, X as ClearIcon
} from 'lucide-react';
import { DocumentListShell, type ShellColumn, type ShellMenuItem } from '../../../components/document/DocumentListShell';
import { formatDateTable } from '../../../utils/formatters';
import { Popover, PopoverContent, PopoverTrigger } from '../../../components/ui/popover';
import type { SitePlan, SitePlanStatus, ClientConfirmationStatus, ExecutionStatus } from '../types';

export interface SitePlanTableProps {
  plans: SitePlan[];
  isLoading?: boolean;
  onSelectPlan: (plan: SitePlan) => void;
  onEditPlan: (plan: SitePlan) => void;
  onAllocate: (plan: SitePlan) => void;
  onReschedule: (plan: SitePlan) => void;
  onViewHistory: (plan: SitePlan) => void;
  onDispatch: (plan: SitePlan) => void;
  isDispatching?: boolean;
  // Workspace controls integration
  onCreatePlan?: () => void;
  datePreset?: string;
  onDatePresetChange?: (preset: 'all' | 'tomorrow' | 'next7days' | 'this_month') => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  viewMode?: 'table' | 'calendar';
  onViewModeChange?: (mode: 'table' | 'calendar') => void;
}

const STATUS_FILTER_OPTIONS = ['All', 'Approved', 'Pending Approval', 'Draft', 'Rejected', 'Cancelled'];

const ALL_COLUMNS: ShellColumn[] = [
  { id: 'plan_name', label: 'Plan & Scope', width: '250px', sortable: true, mandatory: true },
  { id: 'client', label: 'Client', width: '200px', mandatory: true },
  { id: 'project', label: 'Project', width: '180px' },
  { id: 'readiness', label: 'Readiness', width: '130px' },
  { id: 'plan_date', label: 'Date & Window', width: '150px', sortable: true, mandatory: true },
  { id: 'headcount', label: 'Crew Allocation', width: '150px', sortable: true, align: 'left' },
  { id: 'plan_status', label: 'Internal Status', width: '130px', tdClass: 'whitespace-nowrap' },
  { id: 'confirmation', label: 'Client Confirmation', width: '150px', tdClass: 'whitespace-nowrap' },
  { id: 'execution_status', label: 'Execution', width: '130px', tdClass: 'whitespace-nowrap' },
];

export const SitePlanTable: React.FC<SitePlanTableProps> = ({
  plans,
  isLoading,
  onSelectPlan,
  onEditPlan,
  onAllocate,
  onReschedule,
  onViewHistory,
  onDispatch,
  isDispatching,
  onCreatePlan,
  datePreset = 'all',
  onDatePresetChange,
  onRefresh,
  isRefreshing,
  viewMode,
  onViewModeChange,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [tradeFilter, setTradeFilter] = useState('all');
  const [confirmationFilter, setConfirmationFilter] = useState('all');
  const [executionFilter, setExecutionFilter] = useState('all');
  const [sortField, setSortField] = useState<'plan_date' | 'plan_name' | 'headcount'>('plan_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);

  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('site_plan_list_columns');
      return saved ? JSON.parse(saved) : ALL_COLUMNS.map(c => c.id);
    } catch {
      return ALL_COLUMNS.map(c => c.id);
    }
  });

  // Extract unique trades
  const uniqueTrades = useMemo(() => {
    const set = new Set<string>();
    plans.forEach(p => {
      if (p.trade) set.add(p.trade);
    });
    return Array.from(set);
  }, [plans]);

  const hasExtraFilters = tradeFilter !== 'all' || confirmationFilter !== 'all' || executionFilter !== 'all';

  const clearExtraFilters = () => {
    setTradeFilter('all');
    setConfirmationFilter('all');
    setExecutionFilter('all');
  };

  // Filter & Sort
  const filteredPlans = useMemo(() => {
    return plans
      .filter(p => {
        const matchesSearch = 
          !searchTerm ||
          p.plan_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.client?.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.project?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.trade?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.notes?.toLowerCase().includes(searchTerm.toLowerCase());

        let matchesStatus = true;
        if (statusFilter !== 'All') {
          const map: Record<string, SitePlanStatus> = {
            'Approved': 'approved',
            'Pending Approval': 'pending_approval',
            'Draft': 'draft',
            'Rejected': 'rejected',
            'Cancelled': 'cancelled',
          };
          matchesStatus = p.plan_status === map[statusFilter];
        }

        const matchesTrade = tradeFilter === 'all' || p.trade === tradeFilter;
        const matchesConfirmation = confirmationFilter === 'all' || p.client_confirmation_status === confirmationFilter;
        const matchesExecution = executionFilter === 'all' || p.execution_status === executionFilter;

        return matchesSearch && matchesStatus && matchesTrade && matchesConfirmation && matchesExecution;
      })
      .sort((a, b) => {
        if (!sortOrder) return 0;
        let valA: any = a.plan_date;
        let valB: any = b.plan_date;

        if (sortField === 'plan_date') {
          valA = new Date(a.plan_date).getTime();
          valB = new Date(b.plan_date).getTime();
        } else if (sortField === 'plan_name') {
          valA = (a.plan_name || '').toLowerCase();
          valB = (b.plan_name || '').toLowerCase();
        } else if (sortField === 'headcount') {
          valA = Number(a.headcount_required) || 0;
          valB = Number(b.headcount_required) || 0;
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [plans, searchTerm, statusFilter, tradeFilter, confirmationFilter, executionFilter, sortField, sortOrder]);

  // Reset to page 1 on filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, tradeFilter, confirmationFilter, executionFilter]);

  // Pagination calculation
  const paginationData = useMemo(() => {
    const totalItems = filteredPlans.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
    const safePage = Math.min(currentPage, totalPages);
    const startIndex = (safePage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentItems = filteredPlans.slice(startIndex, endIndex);

    return {
      totalItems,
      totalPages,
      startIndex,
      endIndex,
      currentItems,
      hasNextPage: safePage < totalPages,
      hasPrevPage: safePage > 1,
    };
  }, [filteredPlans, currentPage, itemsPerPage]);

  const toggleSort = () => {
    if (sortOrder === null) setSortOrder('asc');
    else if (sortOrder === 'asc') setSortOrder('desc');
    else setSortOrder(null);
  };

  const getPlanStatusBadge = (status: SitePlanStatus) => {
    switch (status) {
      case 'approved':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Approved</span>;
      case 'pending_approval':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">Pending Approval</span>;
      case 'rejected':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">Rejected</span>;
      case 'cancelled':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-500 border border-zinc-200">Cancelled</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-700 border border-zinc-200">Draft</span>;
    }
  };

  const getConfirmationBadge = (status: ClientConfirmationStatus) => {
    switch (status) {
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Confirmed
          </span>
        );
      case 'postponement_requested':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" /> Postponed
          </span>
        );
      case 'cancelled':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">Cancelled</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-600 border border-zinc-200">Unconfirmed</span>;
    }
  };

  const getExecutionBadge = (status: ExecutionStatus) => {
    switch (status) {
      case 'dispatched':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Send className="w-3 h-3 text-blue-600" /> Dispatched
          </span>
        );
      case 'in_progress':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">In Progress</span>;
      case 'completed':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Completed</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-600 border border-zinc-200">Scheduled</span>;
    }
  };

  const getWorkTypeBadge = (wt?: string) => {
    switch (wt) {
      case 'service_breakdown':
        return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">🚨 Service</span>;
      case 'amc_ppm':
        return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">🛡️ AMC PPM</span>;
      default:
        return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">🏗️ EPC</span>;
    }
  };

  const getReadinessPill = (plan: SitePlan) => {
    const score = [
      plan.site_access_cleared,
      plan.permits_approved,
      plan.materials_staged,
      plan.tools_dispatched,
    ].filter(Boolean).length;

    if (score === 4) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200" title="4/4 Gates Cleared">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          <span>Ready (4/4)</span>
        </span>
      );
    }
    if (score >= 1) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200" title={`${score}/4 Gates Cleared`}>
          <AlertTriangle className="w-3 h-3 text-amber-600" />
          <span>Gates ({score}/4)</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200" title="0/4 Gates Cleared">
        <span>Blocked (0/4)</span>
      </span>
    );
  };

  const renderSitePlanCell = (col: ShellColumn, plan: SitePlan) => {
    if (col.id === 'plan_name') {
      return (
        <div className="flex flex-col gap-0.5 max-w-[250px]">
          <div className="flex items-center gap-1.5 flex-wrap">
            {getWorkTypeBadge(plan.work_type)}
            <span className="font-semibold text-zinc-900 truncate">{plan.plan_name}</span>
            {plan.trade && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 font-medium whitespace-nowrap">
                {plan.trade}
              </span>
            )}
          </div>
          {plan.notes && (
            <p className="text-[11px] text-zinc-400 truncate max-w-[250px]">
              {plan.notes}
            </p>
          )}
        </div>
      );
    }

    if (col.id === 'client') {
      return (
        <div className="max-w-[200px] truncate font-medium text-zinc-800" title={plan.client?.company_name || 'No client linked'}>
          {plan.client?.company_name || 'No client linked'}
        </div>
      );
    }

    if (col.id === 'project') {
      return (
        <div className="max-w-[180px] truncate text-zinc-600 flex items-center gap-1.5" title={plan.project?.title || '-'}>
          <Briefcase className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <span className="truncate">{plan.project?.title || '-'}</span>
        </div>
      );
    }

    if (col.id === 'readiness') {
      return <div className="whitespace-nowrap">{getReadinessPill(plan)}</div>;
    }

    if (col.id === 'plan_date') {
      return (
        <div className="flex flex-col gap-0.5 whitespace-nowrap">
          <div className="flex items-center gap-1.5 font-medium text-zinc-900 text-xs">
            <Calendar className="w-3.5 h-3.5 text-zinc-400" />
            <span>{formatDateTable(plan.plan_date)}</span>
          </div>
          {(plan.start_time || plan.end_time) && (
            <div className="text-[11px] text-zinc-500 flex items-center gap-1">
              <Clock className="w-3 h-3 text-zinc-400" />
              <span>
                {plan.start_time?.slice(0, 5) || '08:00'} - {plan.end_time?.slice(0, 5) || '17:00'}
              </span>
            </div>
          )}
        </div>
      );
    }

    if (col.id === 'headcount') {
      const req = Number(plan.headcount_required) || 1;
      const alloc = Number(plan.allocated_headcount) || 0;
      const isShort = alloc < req;
      return (
        <div className="flex items-center gap-2 text-left whitespace-nowrap">
          <span className={`font-bold text-xs ${isShort ? 'text-amber-700' : 'text-emerald-700'}`}>
            {alloc} / {req}
          </span>
          <span className="text-[11px] text-zinc-400">allocated</span>
          {isShort && (
            <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 text-[10px] font-semibold border border-amber-200">
              +{req - alloc} needed
            </span>
          )}
        </div>
      );
    }

    if (col.id === 'plan_status') {
      return <div className="whitespace-nowrap">{getPlanStatusBadge(plan.plan_status)}</div>;
    }

    if (col.id === 'confirmation') {
      return <div className="whitespace-nowrap">{getConfirmationBadge(plan.client_confirmation_status)}</div>;
    }

    if (col.id === 'execution_status') {
      return <div className="whitespace-nowrap">{getExecutionBadge(plan.execution_status)}</div>;
    }

    return null;
  };

  const sitePlanRowMenuItems = (plan: SitePlan): ShellMenuItem[] => {
    const items: ShellMenuItem[] = [
      {
        label: 'View Details',
        icon: Eye,
        onClick: () => onSelectPlan(plan),
      },
      {
        label: 'Manage Crew Allocation',
        icon: UserCheck,
        tone: 'blue',
        onClick: () => onAllocate(plan),
      },
      {
        label: 'Reschedule Plan',
        icon: Clock,
        tone: 'amber',
        onClick: () => onReschedule(plan),
      },
    ];

    if (plan.execution_status !== 'dispatched' && plan.execution_status !== 'completed') {
      items.push({
        label: isDispatching ? 'Dispatching...' : 'Dispatch Execution Visit',
        icon: Send,
        tone: 'indigo',
        onClick: () => onDispatch(plan),
      });
    }

    items.push(
      {
        label: 'Schedule History',
        icon: History,
        onClick: () => onViewHistory(plan),
      },
      {
        label: 'Edit Plan',
        icon: Edit,
        dividerBefore: true,
        onClick: () => onEditPlan(plan),
      }
    );

    return items;
  };

  // Date presets + Filter popover trigger
  const filterExtraContent = (
    <div className="flex items-center gap-2">
      {/* Date preset selector */}
      {onDatePresetChange && (
        <div className="flex items-center bg-zinc-100 p-0.5 rounded-lg border border-zinc-200 text-xs">
          <button
            onClick={() => onDatePresetChange('all')}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              datePreset === 'all' ? 'bg-white text-blue-600 font-semibold shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            All
          </button>
          <button
            onClick={() => onDatePresetChange('tomorrow')}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              datePreset === 'tomorrow' ? 'bg-white text-blue-600 font-semibold shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            Tomorrow
          </button>
          <button
            onClick={() => onDatePresetChange('next7days')}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              datePreset === 'next7days' ? 'bg-white text-blue-600 font-semibold shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            7 Days
          </button>
          <button
            onClick={() => onDatePresetChange('this_month')}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              datePreset === 'this_month' ? 'bg-white text-blue-600 font-semibold shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            Month
          </button>
        </div>
      )}

      {/* Filter Popover for Trade, Confirmation, Execution */}
      <Popover open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            title={hasExtraFilters ? 'Filters active — click to edit' : 'Filter by trade, confirmation, or execution'}
            className={`relative h-[30px] px-2.5 flex items-center gap-1.5 text-xs font-medium rounded-lg border transition-colors ${
              hasExtraFilters 
                ? 'text-blue-600 bg-blue-50 border-blue-200' 
                : 'text-zinc-600 bg-white border-zinc-200 hover:bg-zinc-50'
            }`}
          >
            <FilterIcon className="w-3.5 h-3.5" />
            <span>Filters</span>
            {hasExtraFilters && <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3 bg-white border border-zinc-200 rounded-xl shadow-xl z-[120]" align="start">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Filter Plans</span>
              {hasExtraFilters && (
                <button
                  type="button"
                  onClick={clearExtraFilters}
                  className="flex items-center gap-1 text-[11px] text-blue-600 hover:underline font-medium"
                >
                  <ClearIcon className="w-3 h-3" />
                  Clear all
                </button>
              )}
            </div>

            {/* Trade Filter */}
            <div>
              <label className="block text-[11px] font-semibold text-zinc-600 mb-1">Trade</label>
              <select
                value={tradeFilter}
                onChange={(e) => setTradeFilter(e.target.value)}
                className="w-full text-xs bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 text-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Trades</option>
                {uniqueTrades.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Confirmation Filter */}
            <div>
              <label className="block text-[11px] font-semibold text-zinc-600 mb-1">Client Confirmation</label>
              <select
                value={confirmationFilter}
                onChange={(e) => setConfirmationFilter(e.target.value)}
                className="w-full text-xs bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 text-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Confirmations</option>
                <option value="confirmed">Confirmed</option>
                <option value="not_confirmed">Unconfirmed</option>
                <option value="postponement_requested">Postponed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {/* Execution Filter */}
            <div>
              <label className="block text-[11px] font-semibold text-zinc-600 mb-1">Execution Status</label>
              <select
                value={executionFilter}
                onChange={(e) => setExecutionFilter(e.target.value)}
                className="w-full text-xs bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 text-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Execution</option>
                <option value="scheduled">Scheduled</option>
                <option value="dispatched">Dispatched</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );

  const rightActionsContent = (
    <div className="flex items-center gap-2">
      {/* View Mode Toggle if provided */}
      {viewMode && onViewModeChange && (
        <div className="flex items-center bg-zinc-100 p-0.5 rounded-lg border border-zinc-200">
          <button
            onClick={() => onViewModeChange('table')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
              viewMode === 'table' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>Table</span>
          </button>
          <button
            onClick={() => onViewModeChange('calendar')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
              viewMode === 'calendar' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>Calendar</span>
          </button>
        </div>
      )}

      {/* Refresh Button */}
      {onRefresh && (
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="p-1.5 text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors border border-zinc-200 h-[32px] w-[32px] flex items-center justify-center"
          title="Refresh Site Plans"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
        </button>
      )}

      {/* Create Plan Button */}
      {onCreatePlan && (
        <button
          onClick={onCreatePlan}
          className="inline-flex items-center gap-1.5 justify-center text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-xs transition-colors active:scale-[0.98] px-3.5 py-2 h-[32px]"
        >
          <Plus className="w-4 h-4" />
          <span>New Site Plan</span>
        </button>
      )}
    </div>
  );

  return (
    <div className="bg-white rounded-xl border border-zinc-200 shadow-xs overflow-hidden">
      <DocumentListShell
        title="Site Plans"
        count={paginationData.totalItems}
        actionsInHeader
        rowDensity="compact"
        hideSelection
        search={searchTerm}
        onSearch={setSearchTerm}
        searchPlaceholder="Search site plans..."
        statusOptions={STATUS_FILTER_OPTIONS}
        statusFilter={statusFilter}
        onStatusFilter={setStatusFilter}
        sort={{ value: sortOrder, onToggle: toggleSort, columnId: sortField }}
        columns={ALL_COLUMNS}
        visibleIds={visibleColumns}
        onVisibleChange={(ids) => {
          setVisibleColumns(ids);
          try {
            localStorage.setItem('site_plan_list_columns', JSON.stringify(ids));
          } catch {
            /* ignore */
          }
        }}
        filterExtra={filterExtraContent}
        createButton={rightActionsContent}
        rows={paginationData.currentItems}
        getRowId={(p: SitePlan) => p.id}
        selectedIds={new Set()}
        onToggleSelect={() => {}}
        onToggleSelectAll={() => {}}
        onRowClick={(p: SitePlan) => onSelectPlan(p)}
        renderCell={renderSitePlanCell}
        eyeButton={(p: SitePlan) => ({
          onPreview: () => onSelectPlan(p),
          loading: false,
        })}
        rowMenuItems={sitePlanRowMenuItems}
        loading={isLoading}
        loadingText="Loading site plans..."
        emptyTitle="No site plans found"
        emptyHint="Create a new site plan or adjust your filters above."
        paginationRender={(
          <div className="flex items-center justify-between px-6 py-3 border-t border-zinc-200 bg-zinc-50/50">
            <div className="text-xs font-medium text-zinc-600">
              Showing {paginationData.totalItems === 0 ? 0 : paginationData.startIndex + 1} to {Math.min(paginationData.endIndex, paginationData.totalItems)} of {paginationData.totalItems} plans
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={!paginationData.hasPrevPage}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors h-[30px] min-w-[70px] flex items-center justify-center ${
                  paginationData.hasPrevPage
                    ? 'bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-50 shadow-xs'
                    : 'bg-zinc-100 text-zinc-400 border border-zinc-200 cursor-not-allowed'
                }`}
              >
                Previous
              </button>
              <div className="text-xs font-medium text-zinc-600 px-2">
                Page {currentPage} of {paginationData.totalPages}
              </div>
              <button
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={!paginationData.hasNextPage}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors h-[30px] min-w-[70px] flex items-center justify-center ${
                  paginationData.hasNextPage
                    ? 'bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-50 shadow-xs'
                    : 'bg-zinc-100 text-zinc-400 border border-zinc-200 cursor-not-allowed'
                }`}
              >
                Next
              </button>
            </div>
          </div>
        )}
      />
    </div>
  );
};
