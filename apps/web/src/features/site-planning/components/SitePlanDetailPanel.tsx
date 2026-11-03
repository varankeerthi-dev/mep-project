import React from 'react';
import { 
  X, Calendar, Clock, Users, Building2, Briefcase, 
  Send, History, Edit, UserCheck, ShieldCheck, CheckCircle2, 
  AlertTriangle, HardHat, ExternalLink 
} from 'lucide-react';
import type { SitePlan } from '../types';

interface SitePlanDetailPanelProps {
  plan: SitePlan | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (plan: SitePlan) => void;
  onAllocate: (plan: SitePlan) => void;
  onReschedule: (plan: SitePlan) => void;
  onViewHistory: (plan: SitePlan) => void;
  onDispatch: (plan: SitePlan) => void;
  isDispatching?: boolean;
}

export const SitePlanDetailPanel: React.FC<SitePlanDetailPanelProps> = ({
  plan,
  isOpen,
  onClose,
  onEdit,
  onAllocate,
  onReschedule,
  onViewHistory,
  onDispatch,
  isDispatching,
}) => {
  if (!isOpen || !plan) return null;

  const req = Number(plan.headcount_required) || 1;
  const alloc = Number(plan.allocated_headcount) || 0;
  const isShort = alloc < req;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/30 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Panel Header */}
        <div className="p-5 border-b border-slate-200 bg-slate-50/70 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                {plan.trade || 'General'}
              </span>
              <h2 className="text-base font-bold text-slate-900">{plan.plan_name}</h2>
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Scheduled Date: <strong>{plan.plan_date}</strong></span>
              {(plan.start_time || plan.end_time) && (
                <span>• {plan.start_time?.slice(0, 5)} - {plan.end_time?.slice(0, 5)}</span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Dimension Badges */}
        <div className="p-4 bg-slate-100/60 border-b border-slate-200 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="p-2 rounded bg-white border border-slate-200">
            <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">Plan Status</span>
            <span className="font-semibold text-slate-800">{plan.plan_status}</span>
          </div>
          <div className="p-2 rounded bg-white border border-slate-200">
            <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">Client Conf.</span>
            <span className={`font-semibold ${
              plan.client_confirmation_status === 'confirmed' ? 'text-emerald-700' : 'text-amber-700'
            }`}>
              {plan.client_confirmation_status}
            </span>
          </div>
          <div className="p-2 rounded bg-white border border-slate-200">
            <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">Execution</span>
            <span className="font-semibold text-blue-700">{plan.execution_status}</span>
          </div>
        </div>

        {/* Panel Body */}
        <div className="p-5 flex-1 space-y-6 text-xs text-slate-700">
          {/* Client & Project Info */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider text-slate-500">
              Client & Project Details
            </h3>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Client:</span>
                <span className="font-semibold text-slate-900">{plan.client?.company_name || 'Not assigned'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Project:</span>
                <span className="font-semibold text-slate-900">{plan.project?.title || 'Not assigned'}</span>
              </div>
              {plan.notes && (
                <div className="pt-2 border-t border-slate-200/60 text-slate-600">
                  <span className="text-slate-500 block mb-0.5">Scope & Notes:</span>
                  <p className="text-xs leading-relaxed">{plan.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Manpower Allocation Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider text-slate-500">
                Manpower Allocations
              </h3>
              <button
                onClick={() => onAllocate(plan)}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Manage Crew</span>
              </button>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/80">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-500" />
                  <span className="font-semibold text-slate-900">Allocated Crew:</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className={`text-base font-bold ${isShort ? 'text-amber-700' : 'text-emerald-700'}`}>
                    {alloc}
                  </span>
                  <span className="text-slate-500">/ {req} Heads Required</span>
                </div>
              </div>

              {/* Allocations breakdown */}
              {(!plan.allocations || plan.allocations.length === 0) ? (
                <div className="text-center py-4 text-slate-400">
                  No crew members or subcontractors assigned yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {plan.allocations.map((alloc) => (
                    <div 
                      key={alloc.id} 
                      className="flex items-center justify-between p-2 rounded bg-white border border-slate-200 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <HardHat className="w-3.5 h-3.5 text-slate-400" />
                        <div>
                          <div className="font-semibold text-slate-800">
                            {alloc.allocation_type === 'employee' 
                              ? alloc.employee?.name || 'Unnamed Employee' 
                              : alloc.subcontractor?.vendor_name || 'Unnamed Subcontractor'}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {alloc.allocation_type === 'employee' ? 'Internal Staff' : 'Subcontractor Crew'}
                            {alloc.allocated_trade ? ` • ${alloc.allocated_trade}` : ''}
                          </div>
                        </div>
                      </div>
                      <span className="font-bold text-slate-700">
                        {alloc.headcount} head(s)
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Execution & Dispatch Status */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider text-slate-500">
              Site Execution Linkage
            </h3>
            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/80 space-y-3">
              {plan.site_visit_id ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-emerald-700 font-semibold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Dispatched to Site Visit</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Linked Visit ID: <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-700">{plan.site_visit_id}</code>
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500">
                    This plan is scheduled but not yet dispatched to field execution. Dispatching will create or link the operational Site Visit idempotently.
                  </p>
                  <button
                    onClick={() => onDispatch(plan)}
                    disabled={isDispatching}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    <span>{isDispatching ? 'Dispatching...' : 'Dispatch Execution Visit'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Panel Footer Actions */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onReschedule(plan)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Reschedule</span>
            </button>
            <button
              onClick={() => onViewHistory(plan)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
            >
              <History className="w-3.5 h-3.5" />
              <span>History</span>
            </button>
          </div>

          <button
            onClick={() => onEdit(plan)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-lg transition-colors"
          >
            <Edit className="w-3.5 h-3.5" />
            <span>Edit Plan</span>
          </button>
        </div>
      </div>
    </div>
  );
};
