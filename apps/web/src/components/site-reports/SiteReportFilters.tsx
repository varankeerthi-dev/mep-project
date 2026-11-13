import React from 'react';
import { Search, X, Filter, RotateCcw } from 'lucide-react';
import type { SiteReportDateRange, DateBucketCounts } from './types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';
import { cn } from '../../lib/utils';

export interface SiteReportFiltersProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  dateRange: SiteReportDateRange;
  onDateRangeChange: (val: SiteReportDateRange) => void;
  projectFilter: string;
  onProjectFilterChange: (val: string) => void;
  engineerFilter: string;
  onEngineerFilterChange: (val: string) => void;
  groupByDate: boolean;
  onGroupByDateChange: (val: boolean) => void;
  projects: Array<{ id: string; name: string }>;
  engineers: string[];
  counts: DateBucketCounts;
  totalFiltered: number;
  totalAll: number;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
}

export const SiteReportFilters: React.FC<SiteReportFiltersProps> = ({
  searchQuery,
  onSearchChange,
  dateRange,
  onDateRangeChange,
  projectFilter,
  onProjectFilterChange,
  engineerFilter,
  onEngineerFilterChange,
  groupByDate,
  onGroupByDateChange,
  projects,
  engineers,
  counts,
  totalFiltered,
  totalAll,
  onClearFilters,
  hasActiveFilters,
}) => {
  const timeChips: Array<{ key: SiteReportDateRange; label: string; count: number }> = [
    { key: 'all', label: 'All', count: counts.all },
    { key: 'today', label: 'Today', count: counts.today },
    { key: 'yesterday', label: 'Yesterday', count: counts.yesterday },
    { key: 'this_week', label: 'This Week', count: counts.this_week },
    { key: 'this_month', label: 'This Month', count: counts.this_month },
  ];

  return (
    <div className="space-y-3">
      {/* Search and Dropdowns Row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by client, project, engineer..."
            className="w-full h-11 pl-9 pr-9 text-sm rounded-xl border border-slate-200 bg-white placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Project & Engineer Selects */}
        <div className="grid grid-cols-2 sm:flex items-center gap-2">
          <Select value={projectFilter} onValueChange={onProjectFilterChange}>
            <SelectTrigger className="h-11 w-full sm:w-[170px] text-xs font-semibold rounded-xl bg-white border-slate-200 shadow-2xs">
              <SelectValue placeholder="All projects" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-slate-200 shadow-xl max-h-72">
              <SelectItem value="">All projects</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-xs">
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={engineerFilter} onValueChange={onEngineerFilterChange}>
            <SelectTrigger className="h-11 w-full sm:w-[160px] text-xs font-semibold rounded-xl bg-white border-slate-200 shadow-2xs">
              <SelectValue placeholder="All engineers" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-slate-200 shadow-xl max-h-72">
              <SelectItem value="">All engineers</SelectItem>
              {engineers.map((e) => (
                <SelectItem key={e} value={e} className="text-xs">
                  {e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Quick Time Filter Chips & Group Toggle */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 pt-0.5 no-scrollbar">
        <div className="flex items-center gap-1.5 shrink-0">
          {timeChips.map((chip) => {
            const isActive = dateRange === chip.key;
            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => onDateRangeChange(chip.key)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 shrink-0',
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200/90 hover:bg-slate-50'
                )}
              >
                <span>{chip.label}</span>
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.2 text-[10px] font-bold tabular-nums',
                    isActive
                      ? 'bg-blue-500/80 text-white'
                      : 'bg-slate-100 text-slate-600'
                  )}
                >
                  {chip.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Group by Date Switch */}
        <div className="flex items-center gap-2 shrink-0 pl-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 hidden sm:inline">
            Group by Date
          </span>
          <button
            type="button"
            onClick={() => onGroupByDateChange(!groupByDate)}
            className={cn(
              'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2',
              groupByDate ? 'bg-blue-600' : 'bg-slate-200'
            )}
            role="switch"
            aria-checked={groupByDate}
            title="Toggle group by date"
          >
            <span
              className={cn(
                'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out',
                groupByDate ? 'translate-x-5' : 'translate-x-0'
              )}
            />
          </button>
        </div>
      </div>

      {/* Active filters pill & summary */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 text-xs pt-0.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Active filters:
          </span>
          {searchQuery && (
            <span className="rounded-lg bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
              "{searchQuery}"
            </span>
          )}
          {projectFilter && (
            <span className="rounded-lg bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
              Project: {projects.find((p) => p.id === projectFilter)?.name}
            </span>
          )}
          {engineerFilter && (
            <span className="rounded-lg bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
              Engineer: {engineerFilter}
            </span>
          )}
          {dateRange !== 'all' && (
            <span className="rounded-lg bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
              Range: {timeChips.find((c) => c.key === dateRange)?.label}
            </span>
          )}
          <button
            type="button"
            onClick={onClearFilters}
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 active:scale-95 transition-all ml-auto"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Clear</span>
          </button>
        </div>
      )}
    </div>
  );
};
