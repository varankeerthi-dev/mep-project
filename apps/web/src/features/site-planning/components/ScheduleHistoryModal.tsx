import React from 'react';
import { X, Calendar, Clock, History, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { useScheduleHistory } from '../hooks/useSitePlans';
import type { SitePlan } from '../types';

interface ScheduleHistoryModalProps {
  plan: SitePlan | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ScheduleHistoryModal: React.FC<ScheduleHistoryModalProps> = ({
  plan,
  isOpen,
  onClose,
}) => {
  const { data: history = [], isLoading } = useScheduleHistory(plan?.id || null);

  if (!isOpen || !plan) return null;

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/50 backdrop-blur-xs p-4 sm:p-6 flex justify-center items-start pt-14 pb-14">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[calc(100vh-4.5rem)] animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Schedule History & Audit Log</h2>
              <p className="text-xs text-slate-500">Plan: {plan.plan_name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 min-h-0">
          {isLoading ? (
            <div className="py-8 text-center text-xs text-slate-400">Loading audit history...</div>
          ) : history.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No rescheduling events recorded. This plan is still on its originally scheduled date ({plan.plan_date}).
            </div>
          ) : (
            <div className="relative border-l-2 border-slate-200 ml-3 space-y-6">
              {history.map((h) => (
                <div key={h.id} className="relative pl-6">
                  <span className="absolute -left-1.5 top-1.5 w-3 h-3 rounded-full bg-blue-600 ring-4 ring-white" />
                  <div>
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                      <span className="text-slate-500 line-through">{h.previous_date}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-blue-700">{h.new_date}</span>
                    </div>

                    <p className="text-xs text-slate-600 mt-1 font-medium bg-slate-50 p-2.5 rounded border border-slate-100">
                      {h.reason}
                    </p>

                    <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1.5">
                      <span>{new Date(h.rescheduled_at).toLocaleString('en-GB')}</span>
                      <span>•</span>
                      {h.client_agreed ? (
                        <span className="text-emerald-700 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Client Agreed
                        </span>
                      ) : (
                        <span className="text-amber-700 font-semibold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Pending Client Agreement
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
