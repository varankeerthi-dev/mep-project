import React from 'react';
import { CalendarDays, Calendar as CalendarIcon, FileText, Search } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  SITE_VISIT_LABELS,
  VISIT_DENSITY,
  type VisitTableDensity,
} from './siteVisitLabels';

export interface SiteVisitFiltersProps {
  activeTab: string;
  viewMode: 'table' | 'calendar' | 'updates';
  onTabChange: (tab: string, mode: 'table' | 'calendar' | 'updates') => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
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
  density,
  onDensityChange,
}) => {
  const tabs = [
    { mode: 'table' as const, active: activeTab === 'all' && viewMode === 'table', icon: CalendarDays, label: SITE_VISIT_LABELS.toolbar.allVisits },
    { mode: 'calendar' as const, active: viewMode === 'calendar', icon: CalendarIcon, label: SITE_VISIT_LABELS.toolbar.calendar },
    { mode: 'updates' as const, active: viewMode === 'updates', icon: FileText, label: SITE_VISIT_LABELS.toolbar.updates },
  ];

  return (
    <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-3.5">
      <div className="flex items-center gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.mode}
              onClick={() => onTabChange('all', tab.mode)}
              className={cn(
                'flex h-[26px] w-[150px] items-center justify-center gap-1.5 rounded-md px-4 text-sm font-medium transition-colors',
                tab.active ? 'bg-blue-600/10 text-blue-600' : 'text-slate-600 hover:bg-slate-100'
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        {/* Density switcher (reference §3) */}
        {density && onDensityChange && viewMode === 'table' && (
          <div className="flex items-center gap-0.5 rounded-md border border-slate-200 bg-white p-0.5">
            {DENSITY_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => onDensityChange(opt.id)}
                title={`${opt.label} · ${VISIT_DENSITY[opt.id].rowMinHeight}px rows`}
                className={cn(
                  'h-[22px] rounded px-2 text-[11px] font-semibold transition-colors',
                  density === opt.id ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={SITE_VISIT_LABELS.toolbar.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-[30px] w-64 rounded-lg border border-slate-200 px-4 pl-8 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Status Dropdown */}
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          aria-label={SITE_VISIT_LABELS.toolbar.allStatuses}
          className="h-[26px] w-[150px] rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="all">{SITE_VISIT_LABELS.toolbar.allStatuses}</option>
          <option value="scheduled">{SITE_VISIT_LABELS.status.scheduled}</option>
          <option value="in_progress">{SITE_VISIT_LABELS.status.inProgress}</option>
          <option value="completed">{SITE_VISIT_LABELS.status.completed}</option>
          <option value="cancelled">{SITE_VISIT_LABELS.status.cancelled}</option>
        </select>
      </div>
    </div>
  );
};
