import React, { useState } from 'react';
import {
  Factory,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Gauge,
  Layers,
  Search,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatCeoNumber } from './utils/ceoFormatters';
import type { JobCardWipItem } from './hooks/useCeoDashboardData';

interface CeoManufacturingPulseProps {
  jobCards: JobCardWipItem[];
  onNavigate: (href: string) => void;
}

export const CeoManufacturingPulse: React.FC<CeoManufacturingPulseProps> = ({
  jobCards,
  onNavigate,
}) => {
  const [search, setSearch] = useState('');

  const filtered = jobCards.filter((j) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      j.product_name.toLowerCase().includes(q) ||
      j.job_card_no.toLowerCase().includes(q)
    );
  });

  const totalPlanned = jobCards.reduce((acc, j) => acc + j.planned_qty, 0);
  const totalActual = jobCards.reduce((acc, j) => acc + j.actual_qty, 0);
  const overallYield = totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : 0;

  return (
    <div className="bg-white border border-zinc-200/90 rounded-xl shadow-sm overflow-hidden space-y-4 p-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
            <Factory className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-900 tracking-tight">
              Manufacturing & Factory Throughput
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Live Work-in-Progress (WIP) tracking across production job cards
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-48">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <Input
              type="text"
              placeholder="Search job card..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs bg-zinc-50 border-zinc-200/80 rounded-lg"
            />
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/manufacturing/job-cards')}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
          >
            <span>View All</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* KPI Mini-Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200/70 text-left">
          <span className="text-[11px] font-medium text-zinc-500 block">Total Active Job Cards</span>
          <span className="text-xl font-bold text-zinc-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {formatCeoNumber(jobCards.length)}
          </span>
        </div>
        <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200/70 text-left">
          <span className="text-[11px] font-medium text-zinc-500 block">Production Units Output</span>
          <span className="text-xl font-bold text-zinc-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {formatCeoNumber(totalActual)} / {formatCeoNumber(totalPlanned)}
          </span>
        </div>
        <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200/70 text-left">
          <span className="text-[11px] font-medium text-zinc-500 block">Overall Yield Velocity</span>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xl font-bold text-amber-700" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {overallYield}%
            </span>
            <span className="text-[11px] text-zinc-500">fulfillment</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse font-sans text-xs">
          <thead>
            <tr className="bg-zinc-50/70 border-b border-zinc-200/80 text-zinc-500 font-medium">
              <th className="py-2.5 px-3 font-semibold">Job Card #</th>
              <th className="py-2.5 px-3 font-semibold">Product Name</th>
              <th className="py-2.5 px-3 font-semibold text-left">Planned Qty</th>
              <th className="py-2.5 px-3 font-semibold text-left">Actual Qty</th>
              <th className="py-2.5 px-3 font-semibold">Progress / Yield</th>
              <th className="py-2.5 px-3 font-semibold">Priority</th>
              <th className="py-2.5 px-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-6 text-center text-xs text-zinc-400">
                  No active job cards found in the manufacturing pipeline.
                </td>
              </tr>
            ) : (
              filtered.slice(0, 8).map((j) => {
                const pct = j.planned_qty > 0 ? Math.min(100, Math.round((j.actual_qty / j.planned_qty) * 100)) : 0;
                return (
                  <tr key={j.id} className="hover:bg-zinc-50/60 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-zinc-900">{j.job_card_no}</td>
                    <td className="py-2.5 px-3 font-medium text-zinc-800">{j.product_name}</td>
                    {/* Numbers left-aligned */}
                    <td className="py-2.5 px-3 text-left font-medium text-zinc-700" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatCeoNumber(j.planned_qty)} {j.output_unit}
                    </td>
                    <td className="py-2.5 px-3 text-left font-medium text-zinc-700" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatCeoNumber(j.actual_qty)} {j.output_unit}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-zinc-100 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-amber-600 h-full rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-medium text-zinc-600" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {pct}%
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={cn(
                          'px-1.5 py-0.5 rounded text-[10px] font-semibold',
                          j.priority === 'High' || j.priority === 'Urgent'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-zinc-100 text-zinc-600'
                        )}
                      >
                        {j.priority}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {j.status}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
