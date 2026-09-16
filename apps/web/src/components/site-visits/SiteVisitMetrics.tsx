import React from 'react';
import { History, RefreshCcw, Plus } from 'lucide-react';
import { SITE_VISIT_LABELS, VISIT_STATUS_PALETTE } from './siteVisitLabels';

export interface SiteVisitStats {
  total: number;
  scheduled: number;
  in_progress: number;
  completed: number;
  cancelled: number;
  criticalPending?: number;
}

export interface SiteVisitMetricsProps {
  stats: SiteVisitStats;
  onOpenActivityLog: () => void;
  onOpenQuickUpdate: () => void;
  onOpenNewVisit: () => void;
}

/** Top metric ribbon: counter badges with semantic colour dots (reference §2). */
export const SiteVisitMetrics: React.FC<SiteVisitMetricsProps> = ({
  stats,
  onOpenActivityLog,
  onOpenQuickUpdate,
  onOpenNewVisit,
}) => {
  const metrics = [
    { key: 'total', label: SITE_VISIT_LABELS.metrics.total, value: stats.total, dot: '#64748b', text: '#334155' },
    { key: 'scheduled', label: SITE_VISIT_LABELS.metrics.scheduled, value: stats.scheduled, dot: VISIT_STATUS_PALETTE.scheduled.dot, text: VISIT_STATUS_PALETTE.scheduled.text },
    { key: 'in_progress', label: SITE_VISIT_LABELS.metrics.inProgress, value: stats.in_progress, dot: VISIT_STATUS_PALETTE.in_progress.dot, text: VISIT_STATUS_PALETTE.in_progress.text },
    { key: 'critical', label: SITE_VISIT_LABELS.metrics.criticalPending, value: stats.criticalPending ?? 0, dot: VISIT_STATUS_PALETTE.pending.dot, text: VISIT_STATUS_PALETTE.pending.text },
    { key: 'completed', label: SITE_VISIT_LABELS.metrics.completed, value: stats.completed, dot: VISIT_STATUS_PALETTE.completed.dot, text: VISIT_STATUS_PALETTE.completed.text },
    { key: 'cancelled', label: SITE_VISIT_LABELS.metrics.cancelled, value: stats.cancelled, dot: VISIT_STATUS_PALETTE.cancelled.dot, text: VISIT_STATUS_PALETTE.cancelled.text },
  ];

  return (
    <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3.5">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold tracking-[-0.01em] text-slate-900">
          {SITE_VISIT_LABELS.page.title}
        </h1>

        <div className="flex items-center gap-3">
          {metrics.map((m) => (
            <div key={m.key} className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: m.dot }} />
              <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-500">
                {m.label}
              </span>
              <span className="text-[13px] font-semibold tabular-nums" style={{ color: m.text }}>
                {m.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onOpenActivityLog}
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm font-medium text-slate-700 transition-all hover:bg-slate-100 active:scale-[0.98]"
        >
          <History className="mr-1.5 h-4 w-4" />
          {SITE_VISIT_LABELS.metrics.activityLog}
        </button>
        <button
          onClick={onOpenQuickUpdate}
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm font-medium text-slate-700 transition-all hover:bg-slate-100 active:scale-[0.98]"
        >
          <RefreshCcw className="mr-1.5 h-4 w-4 text-blue-500" />
          {SITE_VISIT_LABELS.metrics.quickUpdate}
        </button>
        <button
          onClick={onOpenNewVisit}
          className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-2.5 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-slate-800 active:scale-[0.98]"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          {SITE_VISIT_LABELS.page.newVisit}
        </button>
      </div>
    </div>
  );
};
