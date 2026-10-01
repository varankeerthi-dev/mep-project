import React from 'react';
import { History, RefreshCcw, Plus } from 'lucide-react';
import { SITE_VISIT_LABELS } from './siteVisitLabels';

export interface SiteVisitMetricsProps {
  onOpenActivityLog: () => void;
  onOpenQuickUpdate: () => void;
  onOpenNewVisit: () => void;
}

export const SiteVisitMetrics: React.FC<SiteVisitMetricsProps> = ({
  onOpenActivityLog,
  onOpenQuickUpdate,
  onOpenNewVisit,
}) => {
  return (
    <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3.5">
      <h1 className="text-xl font-semibold tracking-[-0.01em] text-slate-900">
        {SITE_VISIT_LABELS.page.title}
      </h1>

      <div className="flex items-center gap-2">
        <button
          onClick={onOpenActivityLog}
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm font-medium text-slate-700 transition-all hover:bg-slate-100 active:scale-[0.96]"
        >
          <History className="mr-1.5 h-4 w-4" />
          {SITE_VISIT_LABELS.metrics.activityLog}
        </button>
        <button
          onClick={onOpenQuickUpdate}
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm font-medium text-slate-700 transition-all hover:bg-slate-100 active:scale-[0.96]"
        >
          <RefreshCcw className="mr-1.5 h-4 w-4 text-blue-500" />
          {SITE_VISIT_LABELS.metrics.quickUpdate}
        </button>
        <button
          onClick={onOpenNewVisit}
          className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-2.5 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-slate-800 active:scale-[0.96]"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          {SITE_VISIT_LABELS.page.newVisit}
        </button>
      </div>
    </div>
  );
};
