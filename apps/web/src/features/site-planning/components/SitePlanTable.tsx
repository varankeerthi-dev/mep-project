import React, { useState, useMemo } from 'react';
import { 
  Users, Calendar, Clock, AlertTriangle, CheckCircle2, 
  Send, History, Edit, UserCheck, MoreHorizontal, Eye,
  Building2, Briefcase, Search, Filter, ShieldCheck, ArrowUpDown
} from 'lucide-react';
import type { SitePlan, SitePlanStatus, ClientConfirmationStatus, ExecutionStatus } from '../types';

interface SitePlanTableProps {
  plans: SitePlan[];
  isLoading?: boolean;
  onSelectPlan: (plan: SitePlan) => void;
  onEditPlan: (plan: SitePlan) => void;
  onAllocate: (plan: SitePlan) => void;
  onReschedule: (plan: SitePlan) => void;
  onViewHistory: (plan: SitePlan) => void;
  onDispatch: (plan: SitePlan) => void;
  isDispatching?: boolean;
}

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
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [tradeFilter, setTradeFilter] = useState('all');
  const [confirmationFilter, setConfirmationFilter] = useState('all');
  const [approvalFilter, setApprovalFilter] = useState('all');
  const [sortField, setSortField] = useState<'plan_date' | 'plan_name' | 'headcount_required'>('plan_date');
  const [sortAsc, setSortAsc] = useState(true);

  // Extract unique trades
  const uniqueTrades = useMemo(() => {
    const set = new Set<string>();
    plans.forEach(p => {
      if (p.trade) set.add(p.trade);
    });
    return Array.from(set);
  }, [plans]);

  // Filter & Sort
  const filteredPlans = useMemo(() => {
    return plans
      .filter(p => {
        const matchesSearch = 
          !searchTerm ||
          p.plan_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.client?.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.project?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.notes?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesTrade = tradeFilter === 'all' || p.trade === tradeFilter;
        const matchesConfirmation = confirmationFilter === 'all' || p.client_confirmation_status === confirmationFilter;
        const matchesApproval = approvalFilter === 'all' || p.plan_status === approvalFilter;

        return matchesSearch && matchesTrade && matchesConfirmation && matchesApproval;
      })
      .sort((a, b) => {
        let valA: any = a[sortField];
        let valB: any = b[sortField];
        if (sortField === 'plan_date') {
          valA = new Date(a.plan_date).getTime();
          valB = new Date(b.plan_date).getTime();
        }
        if (valA < valB) return sortAsc ? -1 : 1;
        if (valA > valB) return sortAsc ? 1 : -1;
        return 0;
      });
  }, [plans, searchTerm, tradeFilter, confirmationFilter, approvalFilter, sortField, sortAsc]);

  const toggleSort = (field: 'plan_date' | 'plan_name' | 'headcount_required') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const getPlanStatusBadge = (status: SitePlanStatus) => {
    switch (status) {
      case 'approved':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Approved</span>;
      case 'pending_approval':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">Pending</span>;
      case 'rejected':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">Rejected</span>;
      case 'cancelled':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">Cancelled</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">Draft</span>;
    }
  };

  const getConfirmationBadge = (status: ClientConfirmationStatus) => {
    switch (status) {
      case 'confirmed':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle2 className="w-3 h-3" /> Confirmed</span>;
      case 'postponement_requested':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200"><Clock className="w-3 h-3" /> Postponed</span>;
      case 'cancelled':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">Cancelled</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">Unconfirmed</span>;
    }
  };

  const getExecutionBadge = (status: ExecutionStatus) => {
    switch (status) {
      case 'dispatched':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200"><Send className="w-3 h-3" /> Dispatched</span>;
      case 'in_progress':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">In Progress</span>;
      case 'completed':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Completed</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">Scheduled</span>;
    }
  };

  const getWorkTypeBadge = (wt?: string) => {
    switch (wt) {
      case 'service_breakdown':
        return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">🚨 Service</span>;
      case 'amc_ppm':
        return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">🛡️ AMC PPM</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">🏗️ EPC</span>;
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
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300" title="4/4 Gates Cleared">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          <span>Ready (4/4)</span>
        </span>
      );
    }
    if (score >= 1) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300" title={`${score}/4 Gates Cleared`}>
          <AlertTriangle className="w-3 h-3 text-amber-600" />
          <span>Gates ({score}/4)</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-300" title="0/4 Gates Cleared">
        <span>Blocked (0/4)</span>
      </span>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Controls Bar */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[260px] max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by plan, client, project..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-900 placeholder-slate-400"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Trade Filter */}
          <select
            value={tradeFilter}
            onChange={(e) => setTradeFilter(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Trades</option>
            {uniqueTrades.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          {/* Client Confirmation Filter */}
          <select
            value={confirmationFilter}
            onChange={(e) => setConfirmationFilter(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Confirmations</option>
            <option value="confirmed">Confirmed</option>
            <option value="not_confirmed">Unconfirmed</option>
            <option value="postponement_requested">Postponed</option>
          </select>

          {/* Plan Approval Filter */}
          <select
            value={approvalFilter}
            onChange={(e) => setApprovalFilter(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Approvals</option>
            <option value="approved">Approved</option>
            <option value="pending_approval">Pending</option>
            <option value="draft">Draft</option>
          </select>

          <span className="text-xs text-slate-500 font-medium pl-2">
            {filteredPlans.length} {filteredPlans.length === 1 ? 'plan' : 'plans'}
          </span>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
            <tr>
              <th className="py-3 px-4 cursor-pointer hover:bg-slate-200/50" onClick={() => toggleSort('plan_name')}>
                <div className="flex items-center gap-1">
                  <span>Plan & Scope</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-3 px-4">Client & Project</th>
              <th className="py-3 px-4">Readiness</th>
              <th className="py-3 px-4 cursor-pointer hover:bg-slate-200/50" onClick={() => toggleSort('plan_date')}>
                <div className="flex items-center gap-1">
                  <span>Date & Window</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-3 px-4 cursor-pointer hover:bg-slate-200/50" onClick={() => toggleSort('headcount_required')}>
                <div className="flex items-center gap-1">
                  <span>Crew Allocation</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-3 px-4">Internal Status</th>
              <th className="py-3 px-4">Client Confirmation</th>
              <th className="py-3 px-4">Execution Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-400">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span>Loading site plans...</span>
                  </div>
                </td>
              </tr>
            ) : filteredPlans.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-400">
                  No site plans found matching your criteria.
                </td>
              </tr>
            ) : (
              filteredPlans.map((plan) => {
                const req = Number(plan.headcount_required) || 1;
                const alloc = Number(plan.allocated_headcount) || 0;
                const isShort = alloc < req;

                return (
                  <tr 
                    key={plan.id}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    onClick={() => onSelectPlan(plan)}
                  >
                    {/* Plan & Scope */}
                    <td className="py-3.5 px-4 font-medium text-slate-900 max-w-[240px]">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {getWorkTypeBadge(plan.work_type)}
                        <span className="truncate font-semibold">{plan.plan_name}</span>
                        {plan.trade && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-medium whitespace-nowrap">
                            {plan.trade}
                          </span>
                        )}
                      </div>
                      {plan.notes && (
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          {plan.notes}
                        </p>
                      )}
                    </td>

                    {/* Client & Project */}
                    <td className="py-3.5 px-4 max-w-[180px]">
                      <div className="truncate font-medium text-slate-800">
                        {plan.client?.company_name || 'No client linked'}
                      </div>
                      {plan.project?.title && (
                        <div className="text-[11px] text-slate-500 truncate flex items-center gap-1 mt-0.5">
                          <Briefcase className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{plan.project.title}</span>
                        </div>
                      )}
                    </td>

                    {/* Site Readiness */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {getReadinessPill(plan)}
                    </td>

                    {/* Date & Window */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 font-medium text-slate-900">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{plan.plan_date}</span>
                      </div>
                      {(plan.start_time || plan.end_time) && (
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>
                            {plan.start_time?.slice(0, 5) || '08:00'} - {plan.end_time?.slice(0, 5) || '17:00'}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Crew Allocation */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${isShort ? 'text-amber-700' : 'text-emerald-700'}`}>
                          {alloc} / {req}
                        </span>
                        <span className="text-[11px] text-slate-400">allocated</span>
                        {isShort && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[10px] font-semibold">
                            +{req - alloc} needed
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Internal Status */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {getPlanStatusBadge(plan.plan_status)}
                    </td>

                    {/* Client Confirmation */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {getConfirmationBadge(plan.client_confirmation_status)}
                    </td>

                    {/* Execution Status */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {getExecutionBadge(plan.execution_status)}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Allocate */}
                        <button
                          onClick={() => onAllocate(plan)}
                          title="Manage Crew Allocation"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <UserCheck className="w-4 h-4" />
                        </button>

                        {/* Reschedule */}
                        <button
                          onClick={() => onReschedule(plan)}
                          title="Reschedule Plan"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                        >
                          <Clock className="w-4 h-4" />
                        </button>

                        {/* Dispatch to Visit */}
                        {plan.execution_status !== 'dispatched' && plan.execution_status !== 'completed' && (
                          <button
                            onClick={() => onDispatch(plan)}
                            disabled={isDispatching}
                            title="Dispatch Execution Visit"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        )}

                        {/* History */}
                        <button
                          onClick={() => onViewHistory(plan)}
                          title="View Schedule History"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                        >
                          <History className="w-4 h-4" />
                        </button>

                        {/* Edit */}
                        <button
                          onClick={() => onEditPlan(plan)}
                          title="Edit Plan"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
