import React from 'react';
import { FileText, CalendarDays, CheckCircle2, HardHat } from 'lucide-react';
import type { SiteReportSummaryStats } from './types';
import { cn } from '../../lib/utils';

export interface SiteReportMetricsProps {
  stats: SiteReportSummaryStats;
  loading?: boolean;
  className?: string;
}

export const SiteReportMetrics: React.FC<SiteReportMetricsProps> = ({
  stats,
  loading = false,
  className,
}) => {
  const items = [
    {
      id: 'total',
      label: 'Total Reports',
      value: stats.total,
      icon: FileText,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      border: 'border-slate-200/80',
    },
    {
      id: 'week',
      label: 'This Week',
      value: stats.thisWeek,
      icon: CalendarDays,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      border: 'border-slate-200/80',
    },
    {
      id: 'today',
      label: 'Filed Today',
      value: stats.today,
      icon: CheckCircle2,
      color: 'text-emerald-700',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200/90',
      valueColor: 'text-emerald-700',
      labelColor: 'text-emerald-800',
    },
    {
      id: 'engineers',
      label: 'Active Engineers',
      value: stats.engineersActive,
      icon: HardHat,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-slate-200/80',
    },
  ];

  return (
    <div
      className={cn(
        'grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3',
        className
      )}
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.id}
            className={cn(
              'relative flex flex-col justify-between rounded-2xl border bg-white p-3.5 shadow-2xs transition-all',
              item.border
            )}
          >
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  'text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500',
                  item.labelColor
                )}
              >
                {item.label}
              </span>
              <div
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-xl',
                  item.bg,
                  item.color
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>
            </div>

            <div className="mt-2 flex items-baseline">
              <span
                className={cn(
                  'text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 tabular-nums',
                  item.valueColor
                )}
              >
                {loading ? '—' : item.value}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
