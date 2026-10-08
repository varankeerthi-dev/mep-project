import React from 'react';
import { CalendarCheck, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VisitMetrics } from './hooks/useCeoDashboardData';

interface CeoVisitsCardProps {
  visitMetrics: VisitMetrics;
  onNavigate: (href: string) => void;
}

const CHIPS: { key: keyof Omit<VisitMetrics, 'total'>; label: string; dot: string }[] = [
  { key: 'scheduled', label: 'Scheduled', dot: 'bg-indigo-500' },
  { key: 'inProgress', label: 'In Progress', dot: 'bg-amber-500' },
  { key: 'completed', label: 'Completed', dot: 'bg-emerald-500' },
  { key: 'cancelled', label: 'Cancelled', dot: 'bg-rose-500' },
  { key: 'postponed', label: 'Postponed', dot: 'bg-zinc-400' },
  { key: 'pending', label: 'Pending', dot: 'bg-sky-500' },
];

export const CeoVisitsCard: React.FC<CeoVisitsCardProps> = ({ visitMetrics, onNavigate }) => {
  return (
    <div className="w-full bg-white border border-zinc-200/90 rounded-xl shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <CalendarCheck className="w-4 h-4" />
          </div>
          <span className="text-sm font-semibold text-zinc-800">Site Visits</span>
          <span className="text-[11px] text-zinc-400">&bull; within selected horizon</span>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('/site-visits')}
          className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 cursor-pointer"
        >
          View all <ArrowRight className="w-3 h-3" />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3.5">
        <div className="flex items-baseline gap-2 pr-5 border-r border-zinc-100">
          <span
            className="text-2xl font-bold tracking-tight text-zinc-900"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {visitMetrics.total}
          </span>
          <span className="text-xs text-zinc-500">total</span>
        </div>
        {CHIPS.map((chip) => (
          <div key={chip.key} className="flex items-center gap-1.5">
            <span className={cn('w-1.5 h-1.5 rounded-full', chip.dot)} />
            <span className="text-[13px] text-zinc-600">{chip.label}</span>
            <span
              className="text-[13px] font-semibold text-zinc-900"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {visitMetrics[chip.key]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
