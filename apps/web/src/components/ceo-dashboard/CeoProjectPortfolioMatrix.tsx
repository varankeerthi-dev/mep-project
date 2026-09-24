import React, { useState, useMemo } from 'react';
import {
  FolderKanban,
  Search,
  ExternalLink,
  ChevronRight,
  Clock,
  ArrowUpDown,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  formatCeoCurrency,
  formatCeoDate,
  getHealthBadgeTone,
} from './utils/ceoFormatters';
import type { ProjectPortfolioItem } from './hooks/useCeoDashboardData';

interface CeoProjectPortfolioMatrixProps {
  projects: ProjectPortfolioItem[];
  onNavigate: (href: string) => void;
}

export const CeoProjectPortfolioMatrix: React.FC<CeoProjectPortfolioMatrixProps> = ({
  projects,
  onNavigate,
}) => {
  const [search, setSearch] = useState('');
  const [filterHealth, setFilterHealth] = useState<'ALL' | 'On Track' | 'At Risk' | 'Critical Delayed'>('ALL');
  const [sortField, setSortField] = useState<'value' | 'completion' | 'name'>('value');
  const [sortAsc, setSortAsc] = useState(false);

  const filteredProjects = useMemo(() => {
    return projects
      .filter((p) => {
        if (filterHealth !== 'ALL' && p.health !== filterHealth) return false;
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
          p.project_name.toLowerCase().includes(q) ||
          p.client_name.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortField === 'value') {
          diff = a.project_estimated_value - b.project_estimated_value;
        } else if (sortField === 'completion') {
          diff = a.completion_percentage - b.completion_percentage;
        } else {
          diff = a.project_name.localeCompare(b.project_name);
        }
        return sortAsc ? diff : -diff;
      });
  }, [projects, filterHealth, search, sortField, sortAsc]);

  const toggleSort = (field: 'value' | 'completion' | 'name') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="bg-white border border-zinc-200/90 rounded-xl shadow-sm overflow-hidden">
      {/* Table Header Bar */}
      <div className="p-4 sm:p-5 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-zinc-100 text-zinc-700 flex items-center justify-center shrink-0">
            <FolderKanban className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-900 tracking-tight">
              Project Portfolio Health Matrix
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Executive overview of contract values, schedule variances, and completion velocity
            </p>
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex items-center gap-2.5">
          <div className="relative w-48 sm:w-60">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <Input
              type="text"
              placeholder="Search project or client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs bg-zinc-50 border-zinc-200/80 rounded-lg"
            />
          </div>

          <div className="inline-flex items-center p-0.5 rounded-lg bg-zinc-100 border border-zinc-200/80 text-[11px]">
            {(['ALL', 'On Track', 'At Risk', 'Critical Delayed'] as const).map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setFilterHealth(h)}
                className={cn(
                  'px-2 py-1 rounded-md font-medium transition-all duration-150',
                  filterHealth === h
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'text-zinc-600 hover:text-zinc-900'
                )}
              >
                {h === 'Critical Delayed' ? 'Delayed' : h}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse font-sans text-xs">
          <thead>
            <tr className="bg-zinc-50/70 border-b border-zinc-200/80 text-zinc-500 font-medium">
              <th
                className="py-3 px-4 text-left font-semibold cursor-pointer hover:text-zinc-900"
                onClick={() => toggleSort('name')}
              >
                <div className="flex items-center gap-1.5">
                  <span>Project & Client</span>
                  <ArrowUpDown className="w-3 h-3 text-zinc-400" />
                </div>
              </th>
              {/* Monetary amount left-aligned per workspace rule */}
              <th
                className="py-3 px-4 text-left font-semibold cursor-pointer hover:text-zinc-900"
                onClick={() => toggleSort('value')}
              >
                <div className="flex items-center gap-1.5">
                  <span>Contract Value</span>
                  <ArrowUpDown className="w-3 h-3 text-zinc-400" />
                </div>
              </th>
              {/* Budget left-aligned per workspace rule */}
              <th className="py-3 px-4 text-left font-semibold">Budget</th>
              <th
                className="py-3 px-4 text-left font-semibold cursor-pointer hover:text-zinc-900"
                onClick={() => toggleSort('completion')}
              >
                <div className="flex items-center gap-1.5">
                  <span>Completion</span>
                  <ArrowUpDown className="w-3 h-3 text-zinc-400" />
                </div>
              </th>
              <th className="py-3 px-4 text-left font-semibold">Timeline & Variance</th>
              <th className="py-3 px-4 text-left font-semibold">Executive Health</th>
              <th className="py-3 px-4 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {filteredProjects.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-xs text-zinc-400">
                  No projects match the selected filters.
                </td>
              </tr>
            ) : (
              filteredProjects.map((p) => {
                const tone = getHealthBadgeTone(p.health);
                return (
                  <tr
                    key={p.id}
                    className="hover:bg-zinc-50/60 transition-colors group cursor-pointer"
                    onClick={() => onNavigate(`/projects`)}
                  >
                    {/* Project & Client */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-zinc-900 group-hover:text-indigo-600 transition-colors">
                        {p.project_name}
                      </div>
                      <div className="text-[11px] text-zinc-500">{p.client_name}</div>
                    </td>

                    {/* Contract Value - strictly left aligned */}
                    <td
                      className="py-3 px-4 text-left font-semibold text-zinc-900"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {formatCeoCurrency(p.project_estimated_value)}
                    </td>

                    {/* Budget - strictly left aligned */}
                    <td
                      className="py-3 px-4 text-left text-zinc-600"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {formatCeoCurrency(p.budget)}
                    </td>

                    {/* Completion */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-zinc-100 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full',
                              p.completion_percentage >= 100
                                ? 'bg-emerald-500'
                                : p.health === 'Critical Delayed'
                                ? 'bg-rose-500'
                                : 'bg-indigo-600'
                            )}
                            style={{ width: `${Math.min(100, p.completion_percentage)}%` }}
                          />
                        </div>
                        <span
                          className="font-medium text-zinc-700 text-[11px]"
                          style={{ fontVariantNumeric: 'tabular-nums' }}
                        >
                          {p.completion_percentage}%
                        </span>
                      </div>
                    </td>

                    {/* Timeline & Variance */}
                    <td className="py-3 px-4">
                      <div className="text-[11px] text-zinc-600 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-zinc-400" />
                        <span>Target: {formatCeoDate(p.expected_end_date)}</span>
                      </div>
                      {p.expected_end_date && (
                        <div
                          className={cn(
                            'text-[10px] font-medium mt-0.5',
                            p.daysVariance < 0
                              ? 'text-rose-600 font-semibold'
                              : p.daysVariance <= 14
                              ? 'text-amber-600'
                              : 'text-zinc-400'
                          )}
                        >
                          {p.daysVariance < 0
                            ? `${Math.abs(p.daysVariance)} days delayed`
                            : `${p.daysVariance} days remaining`}
                        </div>
                      )}
                    </td>

                    {/* Executive Health */}
                    <td className="py-3 px-4">
                      <span
                        className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border',
                          tone.bg,
                          tone.text,
                          tone.border
                        )}
                      >
                        {p.health}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigate(`/projects`);
                        }}
                        className="p-1 rounded hover:bg-zinc-200/60 text-zinc-400 hover:text-zinc-700"
                        title="Open Project"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
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
