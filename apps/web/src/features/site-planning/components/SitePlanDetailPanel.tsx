import React, { useState } from 'react';
import { 
  X, Calendar, Clock, Users, Building2, Briefcase, 
  Send, History, Edit, UserCheck, ShieldCheck, CheckCircle2, 
  AlertTriangle, HardHat, ExternalLink, Share2, Check, Flame, Wrench, Shield
} from 'lucide-react';
import { useUpdateSitePlan } from '../hooks/useSitePlans';
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
  const [copiedBriefing, setCopiedBriefing] = useState(false);
  const updatePlan = useUpdateSitePlan();

  if (!isOpen || !plan) return null;

  const req = Number(plan.headcount_required) || 1;
  const alloc = Number(plan.allocated_headcount) || 0;
  const isShort = alloc < req;

  const handleCopyWhatsAppBriefing = () => {
    if (!plan) return;
    const clientName = plan.client?.company_name || 'Client Site';
    const projName = plan.project?.title || 'General MEP';
    const shift = (plan.start_time || plan.end_time) ? `${plan.start_time?.slice(0, 5) || ''} - ${plan.end_time?.slice(0, 5) || ''}` : 'General Shift';
    const trade = plan.trade || 'MEP';
    const workTypeTitle = plan.work_type === 'service_breakdown' ? 'EMERGENCY SERVICE BREAKDOWN' :
      plan.work_type === 'amc_ppm' ? 'AMC PREVENTIVE MAINTENANCE' : 'EPC ERECTION PROJECT';

    const ptw = plan.permits_approved ? (plan.ptw_notes || 'Approved') : 'Pending / Not cleared';
    const tools = plan.tools_required || 'Standard Toolset';

    const crewLines = (plan.allocations || []).map((a) => {
      if (a.allocation_type === 'employee') {
        return `  • ${a.employee?.name || 'Staff'} (${a.employee?.designation || trade})`;
      } else {
        const subName = a.subcontractor?.company_name || a.notes?.replace('Crew: ', '') || 'Subcontractor';
        return `  • [Subcontractor] ${subName}: ${a.headcount} Head(s)`;
      }
    });

    const text = [
      `🏗️ *SITE DISPATCH BRIEFING*`,
      `*Type:* ${workTypeTitle}`,
      `*Plan:* ${plan.plan_name}`,
      `*Client:* ${clientName}`,
      `*Project:* ${projName}`,
      `*Date:* ${plan.plan_date} (${shift})`,
      `*Trade:* ${trade} | *Required:* ${plan.headcount_required} Head(s)`,
      ``,
      `📋 *Permits (PTW):* ${ptw}`,
      `🛠️ *Tools/Plant:* ${tools}`,
      ``,
      `👷 *Allocated Crew (${plan.allocated_headcount || 0}/${plan.headcount_required}):*`,
      crewLines.length > 0 ? crewLines.join('\n') : '  (No crew assigned yet)',
      ``,
      `⚠️ *PPE Mandatory:* Helmets, Safety Boots, High-Vis Vest.`,
    ].join('\n');

    navigator.clipboard.writeText(text);
    setCopiedBriefing(true);
    setTimeout(() => setCopiedBriefing(false), 2500);
  };

  const handleToggleReadiness = async (field: 'site_access_cleared' | 'permits_approved' | 'materials_staged' | 'tools_dispatched') => {
    if (!plan) return;
    try {
      await updatePlan.mutateAsync({
        id: plan.id,
        updates: {
          [field]: !plan[field],
        },
      });
    } catch (err: any) {
      alert(err?.message || 'Failed to update readiness status');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/30 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Panel Header */}
        <div className="p-5 border-b border-slate-200 bg-slate-50/70 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                plan.work_type === 'service_breakdown' ? 'bg-red-100 text-red-800 border border-red-200' :
                plan.work_type === 'amc_ppm' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                'bg-blue-100 text-blue-800 border border-blue-200'
              }`}>
                {plan.work_type === 'service_breakdown' ? '🚨 Emergency Service' :
                 plan.work_type === 'amc_ppm' ? '🛡️ AMC PPM' : '🏗️ EPC Erection'}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                {plan.trade || 'General'}
              </span>
            </div>
            <h2 className="text-base font-bold text-slate-900">{plan.plan_name}</h2>
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

        {plan.work_type === 'service_breakdown' && plan.emergency_sla_deadline && (
          <div className="px-5 py-2.5 bg-red-50 border-b border-red-200 flex items-center justify-between text-xs text-red-900">
            <div className="flex items-center gap-1.5 font-bold">
              <Flame className="w-4 h-4 text-red-600 animate-pulse" />
              <span>SLA Target: {new Date(plan.emergency_sla_deadline).toLocaleString()}</span>
            </div>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-200/80 text-red-800">
              High Priority
            </span>
          </div>
        )}

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

          {/* 1-Click WhatsApp Dispatch Briefing */}
          <div>
            <button
              type="button"
              onClick={handleCopyWhatsAppBriefing}
              className={`w-full py-2.5 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                copiedBriefing
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300 shadow-xs'
              }`}
            >
              {copiedBriefing ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Copied Briefing to Clipboard!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4 text-emerald-600" />
                  <span>Copy WhatsApp Crew Briefing</span>
                </>
              )}
            </button>
          </div>

          {/* 4-Point Site Readiness Card */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Site Readiness Clearance</span>
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700">
                {[plan.site_access_cleared, plan.permits_approved, plan.materials_staged, plan.tools_dispatched].filter(Boolean).length}/4 Gates Cleared
              </span>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/80 space-y-2.5">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => handleToggleReadiness('site_access_cleared')}
                  className={`p-2 rounded-lg border text-left flex items-start justify-between gap-1.5 transition-colors ${
                    plan.site_access_cleared ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <div>
                    <span className="font-bold block text-[11px]">Site Access</span>
                    <span className="text-[10px] text-slate-500">Security Gate Pass</span>
                  </div>
                  {plan.site_access_cleared ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" /> : <div className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0 mt-0.5" />}
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleReadiness('permits_approved')}
                  className={`p-2 rounded-lg border text-left flex items-start justify-between gap-1.5 transition-colors ${
                    plan.permits_approved ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <div>
                    <span className="font-bold block text-[11px]">PTW Permits</span>
                    <span className="text-[10px] text-slate-500">Hot Work / Height</span>
                  </div>
                  {plan.permits_approved ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" /> : <div className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0 mt-0.5" />}
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleReadiness('materials_staged')}
                  className={`p-2 rounded-lg border text-left flex items-start justify-between gap-1.5 transition-colors ${
                    plan.materials_staged ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <div>
                    <span className="font-bold block text-[11px]">Materials Staged</span>
                    <span className="text-[10px] text-slate-500">Delivered on Site</span>
                  </div>
                  {plan.materials_staged ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" /> : <div className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0 mt-0.5" />}
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleReadiness('tools_dispatched')}
                  className={`p-2 rounded-lg border text-left flex items-start justify-between gap-1.5 transition-colors ${
                    plan.tools_dispatched ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <div>
                    <span className="font-bold block text-[11px]">Tools & Plant</span>
                    <span className="text-[10px] text-slate-500">Machinery Ready</span>
                  </div>
                  {plan.tools_dispatched ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" /> : <div className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0 mt-0.5" />}
                </button>
              </div>

              {(plan.ptw_notes || plan.tools_required) && (
                <div className="pt-2 border-t border-slate-200/60 space-y-1 text-[11px] text-slate-600">
                  {plan.ptw_notes && (
                    <div><strong className="text-slate-700">Permit Info:</strong> {plan.ptw_notes}</div>
                  )}
                  {plan.tools_required && (
                    <div><strong className="text-slate-700">Tools:</strong> {plan.tools_required}</div>
                  )}
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
