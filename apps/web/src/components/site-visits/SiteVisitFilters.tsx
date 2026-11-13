import React from 'react';
import { CalendarDays, Calendar as CalendarIcon, FileText, Search } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  SITE_VISIT_LABELS,
  VISIT_DENSITY,
  type VisitTableDensity,
} from './siteVisitLabels';
import { STATUS_FILTER_OPTIONS } from './types';

export type SiteVisitTimeFilter = 'all' | 'upcoming' | 'today' | 'tomorrow' | 'this_week';

export interface SiteVisitFiltersProps {
  activeTab: string;
  viewMode: 'table' | 'calendar' | 'updates';
  onTabChange: (tab: string, mode: 'table' | 'calendar' | 'updates') => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  timeFilter?: SiteVisitTimeFilter;
  onTimeFilterChange?: (timeFilter: SiteVisitTimeFilter) => void;
  timeFilterCounts?: {
    all: number;
    upcoming: number;
    today: number;
    tomorrow: number;
    this_week: number;
  };
  /** Current table density (reference §3). Optional — omitted for calendar/updates views. */
  density?: VisitTableDensity;
  onDensityChange?: (density: VisitTableDensity) => void;
}

const DENSITY_OPTIONS: { id: VisitTableDensity; label: string }[] = [
  { id: 'compact', label: SITE_VISIT_LABELS.toolbar.densityCompact },
  { id: 'default', label: SITE_VISIT_LABELS.toolbar.densityDefault },
  { id: 'expanded', label: SITE_VISIT_LABELS.toolbar.densityExpanded },
];

export const SiteVisitFilters: React.FC<SiteVisitFiltersProps> = ({
  activeTab,
  viewMode,
  onTabChange,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  timeFilter,
  onTimeFilterChange,
  timeFilterCounts,
  density,
  onDensityChange,
}) => {
  const tabs = [
    { mode: 'table' as const, active: activeTab === 'all' && viewMode === 'table', icon: CalendarDays, label: SITE_VISIT_LABELS.toolbar.allVisits },
    { mode: 'calendar' as const, active: viewMode === 'calendar', icon: CalendarIcon, label: SITE_VISIT_LABELS.toolbar.calendar },
    { mode: 'updates' as const, active: viewMode === 'updates', icon: FileText, label: SITE_VISIT_LABELS.toolbar.updates },
  ];

  return (
    <div className="flex flex-col gap-2.5 border-b border-slate-200/80 bg-slate-50/70 p-3 sm:px-4 md:px-6 md:py-3">
      {/* Top Row: Tabs on left, Search & Status on right */}
      <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
        {/* View Mode Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto rounded-xl bg-slate-200/60 p-1 md:bg-transparent md:p-0 md:rounded-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.mode}
                onClick={() => onTabChange('all', tab.mode)}
                className={cn(
                  'flex h-8 md:h-[26px] flex-1 md:flex-initial md:w-[130px] lg:w-[150px] items-center justify-center gap-1.5 rounded-lg md:rounded-md px-2.5 md:px-4 text-xs md:text-sm font-semibold md:font-medium transition-all active:scale-[0.96] whitespace-nowrap',
                  tab.active
                    ? 'bg-white text-blue-600 shadow-sm md:bg-blue-600/10 md:shadow-none'
                    : 'text-slate-600 hover:bg-slate-200/50 md:hover:bg-slate-100'
                )}
              >
                <Icon className="h-3.5 w-3.5 md:h-4 md:w-4 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search, Status & Density */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Search Input */}
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={SITE_VISIT_LABELS.toolbar.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-8 md:h-[30px] w-full rounded-lg border border-slate-200 bg-white px-3 pl-8 text-xs md:text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Status Dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            aria-label={SITE_VISIT_LABELS.toolbar.allStatuses}
            className="h-8 md:h-[26px] w-32 sm:w-36 md:w-[140px] shrink-0 rounded-lg md:rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">{SITE_VISIT_LABELS.toolbar.allStatuses}</option>
            {STATUS_FILTER_OPTIONS.filter((o) => o.id !== 'all').map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>

          {/* Density switcher (desktop only) */}
          {density && onDensityChange && viewMode === 'table' && (
            <div className="hidden md:flex items-center gap-0.5 rounded-md border border-slate-200 bg-white p-0.5 shrink-0">
              {DENSITY_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => onDensityChange(opt.id)}
                  title={`${opt.label} · ${VISIT_DENSITY[opt.id].rowMinHeight}px rows`}
                  className={cn(
                    'h-[22px] rounded px-2 text-[11px] font-semibold transition-colors active:scale-[0.96]',
                    density === opt.id ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Time Filter Chips (Upcoming, Today, Tomorrow, This Week, All) */}
      {timeFilter && onTimeFilterChange && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 w-full">
          {[
            { id: 'all' as const, label: 'All' },
            { id: 'upcoming' as const, label: 'Upcoming' },
            { id: 'today' as const, label: 'Today' },
            { id: 'tomorrow' as const, label: 'Tomorrow' },
            { id: 'this_week' as const, label: 'This Week' },
          ].map((tf) => {
            const count = timeFilterCounts ? timeFilterCounts[tf.id] : undefined;
            const isActive = timeFilter === tf.id;
            return (
              <button
                key={tf.id}
                type="button"
                onClick={() => onTimeFilterChange(tf.id)}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold shrink-0 transition-all active:scale-95',
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100/70'
                )}
              >
                <span>{tf.label}</span>
                {count !== undefined && (
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.2 text-[10px] tabular-nums font-bold leading-none',
                      isActive ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600'
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
