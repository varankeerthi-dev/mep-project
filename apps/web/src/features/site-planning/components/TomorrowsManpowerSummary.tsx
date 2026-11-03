import React, { useMemo } from 'react';
import { 
  Users, CheckCircle2, Clock, AlertTriangle, Send, 
  ChevronRight, Calendar, HardHat, ShieldCheck
} from 'lucide-react';
import { useTomorrowsSummary } from '../hooks/useSitePlans';

interface TomorrowsManpowerSummaryProps {
  onNavigateToPlan?: (dateStr: string) => void;
}

export const TomorrowsManpowerSummary: React.FC<TomorrowsManpowerSummaryProps> = ({ onNavigateToPlan }) => {
  // Tomorrow's date in YYYY-MM-DD (local calendar date, avoids UTC offset drift)
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  const formattedDate = useMemo(() => {
    const d = new Date(tomorrowStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
  }, [tomorrowStr]);

  const { data: summary, isLoading } = useTomorrowsSummary(tomorrowStr);

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-[var(--border)] p-5 shadow-sm animate-pulse">
        <div className="h-4 w-48 bg-slate-200 rounded mb-4" />
        <div className="grid grid-cols-4 gap-4">
          <div className="h-16 bg-slate-100 rounded" />
          <div className="h-16 bg-slate-100 rounded" />
          <div className="h-16 bg-slate-100 rounded" />
          <div className="h-16 bg-slate-100 rounded" />
        </div>
      </div>
    );
  }

  const req = summary?.totalRequired || 0;
  const alloc = summary?.totalAllocated || 0;
  const isFullyAllocated = alloc >= req && req > 0;
  const unallocated = Math.max(0, req - alloc);

  return (
    <div className="bg-white rounded-xl border border-[var(--border)] p-5 shadow-sm hover:border-[var(--brand)] transition-colors">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-[var(--brand-faint)] text-[var(--brand)] flex items-center justify-center font-bold">
            <HardHat className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-[var(--ink)]">Tomorrow’s Manpower & Site Readiness</h3>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-700">
                {formattedDate}
              </span>
            </div>
            <p className="text-xs text-[var(--ink-faint)]">
              Live workforce demand, allocations, and dispatch status across scheduled site plans.
            </p>
          </div>
        </div>

        {onNavigateToPlan && (
          <button
            onClick={() => onNavigateToPlan(tomorrowStr)}
            className="flex items-center gap-1.5 text-xs font-semibold text-[var(--brand)] hover:underline"
          >
            <span>Open Site Plan Workspace</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-4">
        {/* Metric 1: Headcount Demand */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Manpower Heads</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{alloc}</span>
            <span className="text-xs text-slate-500 font-medium">/ {req} Required</span>
          </div>
          <div className="mt-1 text-[11px]">
            {req === 0 ? (
              <span className="text-slate-400 font-medium">No site plans scheduled</span>
            ) : isFullyAllocated ? (
              <span className="text-emerald-700 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Crew Allocated ({alloc}/{req})
              </span>
            ) : (
              <span className="text-amber-700 font-medium flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> {unallocated} Head(s) Unallocated
              </span>
            )}
          </div>
          <p className="mt-1 text-[10px] text-slate-400 italic">
            *Allocated headcount vs required demand. Subject to daily attendance.
          </p>
        </div>

        {/* Metric 2: Client Confirmation */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Client Confirmation</span>
            <ShieldCheck className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-700">
              {summary?.confirmationCounts.confirmed || 0}
            </span>
            <span className="text-xs text-slate-500 font-medium">Confirmed</span>
          </div>
          <div className="mt-1 text-[11px] flex gap-2">
            <span className="text-slate-600 font-medium">
              {summary?.confirmationCounts.notConfirmed || 0} Pending
            </span>
            {(summary?.confirmationCounts.postponementRequested || 0) > 0 && (
              <span className="text-amber-700 font-bold">
                • {summary?.confirmationCounts.postponementRequested} Postponed
              </span>
            )}
          </div>
        </div>

        {/* Metric 3: Execution Dispatch */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Dispatch Readiness</span>
            <Send className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-blue-700">
              {summary?.executionCounts.dispatched || 0}
            </span>
            <span className="text-xs text-slate-500 font-medium">Dispatched</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-600 font-medium">
            {summary?.executionCounts.scheduled || 0} Scheduled in plan
          </div>
        </div>

        {/* Metric 4: Trade Breakdown */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Key Trades</span>
            <Calendar className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1 max-h-[52px] overflow-y-auto">
            {(summary?.trades || []).length > 0 ? (
              summary!.trades.map((t) => (
                <span
                  key={t.trade}
                  className="text-[10px] font-semibold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-800"
                >
                  {t.trade}: {t.allocated}/{t.required}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-400">None scheduled</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
