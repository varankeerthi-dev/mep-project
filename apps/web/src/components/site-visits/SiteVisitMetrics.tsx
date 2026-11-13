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
    <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3.5 sm:px-6 py-2.5 sm:py-3.5 gap-2">
      <h1 className="text-base sm:text-xl font-bold tracking-tight text-slate-900 shrink-0">
        {SITE_VISIT_LABELS.page.title}
      </h1>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <button
          onClick={onOpenActivityLog}
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-2 sm:px-2.5 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-slate-700 transition-all hover:bg-slate-100 active:scale-[0.96]"
          title="Activity Log"
        >
          <History className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-1.5" />
          <span className="hidden sm:inline">{SITE_VISIT_LABELS.metrics.activityLog}</span>
          <span className="sm:hidden ml-1 text-xs">Log</span>
        </button>
        <button
          onClick={onOpenQuickUpdate}
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-2 sm:px-2.5 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-slate-700 transition-all hover:bg-slate-100 active:scale-[0.96]"
          title="Quick Update"
        >
          <RefreshCcw className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-500 sm:mr-1.5" />
          <span className="hidden sm:inline">{SITE_VISIT_LABELS.metrics.quickUpdate}</span>
          <span className="sm:hidden ml-1 text-xs">Update</span>
        </button>
        <button
          onClick={onOpenNewVisit}
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 sm:bg-slate-900 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white shadow-xs transition-all hover:opacity-90 active:scale-[0.96]"
        >
          <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
          <span>New Visit</span>
        </button>
      </div>
    </div>
  );
};
