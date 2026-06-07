// ============================================
// ProjectReportsRollup — Phase 4.2
// ============================================
// Weekly project reports rollup.
//
// Route: /projects/:projectId/reports/rollup
// Query: ?from=YYYY-MM-DD&to=YYYY-MM-DD
//        (default: current calendar week Mon–Sun)
//
// Layout:
//   - Header with project name, breadcrumb, shareable URL
//   - Date range picker with "Last week" / "This week" quick-picks
//   - 3 view tabs: Detail / Matrix / Blocker
//   - Filter chips: Discipline / Engineer / Has blocker / Overdue
//   - Table:
//       Task title · Engineer · Δ% · Status · Last photo ·
//       Blocker · Days touched
//   - "Export PDF" button (jspdf-autotable)
//   - Empty state: "No updates this week — file one?"
//     with a button to /site-reports
//
// All touch targets 44px (T1).
// ============================================

import { useMemo, useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  FileText,
  ChevronLeft,
  ChevronRight,
  Download,
  List,
  LayoutGrid,
  AlertOctagon,
  Filter,
  Plus,
  X as XIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
  useWeeklyRollup,
  type RollupView,
  type RollupFilters,
  type RollupTaskRow,
} from '@/hooks/useWeeklyRollup';
import { DISCIPLINE_CONFIG } from '@/components/tasks/types';
import { toast } from '@/lib/logger';
import { recordRollupView } from '@/hooks/useDailyReportSoakMetrics';

// ============================================
// DATE UTILS
// ============================================

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfWeek(d: Date): Date {
  // ISO week: Monday = 1
  const day = d.getDay();
  const diff = (day + 6) % 7; // Mon = 0 offset
  const out = new Date(d);
  out.setDate(d.getDate() - diff);
  out.setHours(0, 0, 0, 0);
  return out;
}

function endOfWeek(d: Date): Date {
  const start = startOfWeek(d);
  const out = new Date(start);
  out.setDate(start.getDate() + 6);
  return out;
}

function shiftDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(d.getDate() + n);
  return out;
}

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ============================================
// PROPS
// ============================================

export interface ProjectReportsRollupProps {
  projectId: string;
  onBack?: () => void;
}

// ============================================
// COMPONENT
// ============================================

export function ProjectReportsRollup({ projectId, onBack }: ProjectReportsRollupProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { organisation, selectedOrganisation, user } = useAuth();
  const resolvedOrgId = organisation?.id ?? selectedOrganisation?.id ?? null;

  // Phase 6.3 — track a rollup view in localStorage so the
  // soak-metrics KPI "rollup adoption" can count unique
  // engineers who visited this page in the soak window.
  useEffect(() => {
    recordRollupView(user?.id ?? null, projectId ?? null);
  }, [projectId, user?.id]);

  // Read query params
  const today = useMemo(() => new Date(), []);
  const thisMonday = useMemo(() => startOfWeek(today), [today]);
  const thisSunday = useMemo(() => endOfWeek(today), [today]);

  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');
  const viewParam = (searchParams.get('view') as RollupView | null) ?? 'detail';

  const [from, setFrom] = useState<string>(fromParam ?? toIsoDate(thisMonday));
  const [to, setTo] = useState<string>(toParam ?? toIsoDate(thisSunday));
  const [view, setView] = useState<RollupView>(viewParam);
  const [filters, setFilters] = useState<RollupFilters>({});

  // Push state to URL on change
  useEffect(() => {
    const next = new URLSearchParams();
    next.set('from', from);
    next.set('to', to);
    if (view !== 'detail') next.set('view', view);
    setSearchParams(next, { replace: true });
  }, [from, to, view, setSearchParams]);

  // Data
  const { data: rows = [], isLoading } = useWeeklyRollup({
    organisationId: resolvedOrgId,
    projectId,
    from,
    to,
    view,
    filters,
    enabled: !!resolvedOrgId && !!projectId,
  });

  // Quick-pick handlers
  const setThisWeek = () => {
    setFrom(toIsoDate(thisMonday));
    setTo(toIsoDate(thisSunday));
  };
  const setLastWeek = () => {
    setFrom(toIsoDate(shiftDays(thisMonday, -7)));
    setTo(toIsoDate(shiftDays(thisSunday, -7)));
  };
  const setPrevWeek = () => {
    setFrom(toIsoDate(shiftDays(new Date(from), -7)));
    setTo(toIsoDate(shiftDays(new Date(to), -7)));
  };
  const setNextWeek = () => {
    setFrom(toIsoDate(shiftDays(new Date(from), 7)));
    setTo(toIsoDate(shiftDays(new Date(to), 7)));
  };

  // Filter helpers
  const toggleFilter = (key: keyof RollupFilters, value?: string | null) => {
    setFilters((prev) => {
      if (key === 'hasBlocker' || key === 'overdue') {
        return { ...prev, [key]: !prev[key] };
      }
      const cur = (prev as any)[key] as string | null | undefined;
      const nextVal = cur === value ? null : value ?? null;
      return { ...prev, [key]: nextVal };
    });
  };

  const handleExport = () => {
    if (rows.length === 0) {
      toast.warning('No rows to export.');
      return;
    }
    void exportPdf(rows, { from, to });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-zinc-500">
        <button
          type="button"
          onClick={() => (onBack ? onBack() : navigate('/projects-overview'))}
          className="inline-flex h-9 items-center gap-1 rounded text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Projects
        </button>
        <span className="text-zinc-300">/</span>
        <span className="font-medium text-zinc-700">Reports rollup</span>
      </div>

      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-zinc-900">
            <FileText className="h-5 w-5 text-blue-600" />
            Weekly reports rollup
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {formatDateShort(from)} – {formatDateShort(to)} ·{' '}
            {rows.length} task{rows.length === 1 ? '' : 's'} touched
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/site-reports')}
            className="inline-flex h-11 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            <Plus className="h-3.5 w-3.5" />
            File a report
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={rows.length === 0}
            className={cn(
              'inline-flex h-11 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-white',
              rows.length > 0
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'cursor-not-allowed bg-zinc-300'
            )}
          >
            <Download className="h-3.5 w-3.5" />
            Export PDF
          </button>
        </div>
      </header>

      {/* Date range + view tabs + filters */}
      <section className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={setPrevWeek}
            className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <label className="flex items-center gap-1 text-xs text-zinc-500">
            <span>From</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-11 rounded-md border border-zinc-200 px-2 text-sm text-zinc-900"
            />
          </label>
          <label className="flex items-center gap-1 text-xs text-zinc-500">
            <span>To</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-11 rounded-md border border-zinc-200 px-2 text-sm text-zinc-900"
            />
          </label>
          <button
            type="button"
            onClick={setNextWeek}
            className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="ml-2 flex items-center gap-1">
            <button
              type="button"
              onClick={setThisWeek}
              className="inline-flex h-11 items-center rounded-md border border-zinc-200 bg-white px-2.5 text-xs text-zinc-700 hover:bg-zinc-50"
            >
              This week
            </button>
            <button
              type="button"
              onClick={setLastWeek}
              className="inline-flex h-11 items-center rounded-md border border-zinc-200 bg-white px-2.5 text-xs text-zinc-700 hover:bg-zinc-50"
            >
              Last week
            </button>
          </div>

          {/* View tabs */}
          <div className="ml-auto flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50/50 p-0.5">
            <ViewTab
              active={view === 'detail'}
              onClick={() => setView('detail')}
              icon={<List className="h-3.5 w-3.5" />}
              label="Detail"
            />
            <ViewTab
              active={view === 'matrix'}
              onClick={() => setView('matrix')}
              icon={<LayoutGrid className="h-3.5 w-3.5" />}
              label="Matrix"
            />
            <ViewTab
              active={view === 'blocker'}
              onClick={() => setView('blocker')}
              icon={<AlertOctagon className="h-3.5 w-3.5" />}
              label="Blocker"
            />
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
            <Filter className="h-3 w-3" />
            Filters
          </span>
          <Chip
            active={!!filters.hasBlocker}
            onClick={() => toggleFilter('hasBlocker')}
            label="Has blocker"
          />
          <Chip
            active={!!filters.overdue}
            onClick={() => toggleFilter('overdue')}
            label="Overdue"
          />
          <span className="mx-1 h-3 w-px bg-zinc-200" />
          {(Object.entries(DISCIPLINE_CONFIG) as [string, { label: string }][]).map(
            ([value, cfg]) => (
              <Chip
                key={value}
                active={filters.discipline === value}
                onClick={() => toggleFilter('discipline', value)}
                label={cfg.label}
              />
            )
          )}
        </div>
      </section>

      {/* Table or empty state */}
      {isLoading ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-12 text-center text-sm text-zinc-500">
          Loading rollup…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-200 bg-white p-12 text-center">
          <p className="text-sm text-zinc-700">No updates this week — file one?</p>
          <p className="mt-1 text-xs text-zinc-500">
            Or pick a wider date range above.
          </p>
          <button
            type="button"
            onClick={() => navigate('/site-reports')}
            className="mt-4 inline-flex h-11 items-center gap-1.5 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-3.5 w-3.5" />
            File a daily report
          </button>
        </div>
      ) : view === 'matrix' ? (
        <MatrixView rows={rows} />
      ) : (
        <DetailTable rows={rows} />
      )}
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

interface ViewTabProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function ViewTab({ active, onClick, icon, label }: ViewTabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-9 items-center gap-1 rounded px-2.5 text-xs font-medium transition-colors',
        active ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'
      )}
    >
      {icon}
      {label}
    </button>
  );
}

interface ChipProps {
  active: boolean;
  onClick: () => void;
  label: string;
}

function Chip({ active, onClick, label }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-9 items-center gap-1 rounded-full border px-3 text-xs font-medium transition-colors',
        active
          ? 'border-blue-300 bg-blue-50 text-blue-800'
          : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900'
      )}
    >
      {label}
      {active && <XIcon className="h-3 w-3" />}
    </button>
  );
}

function DetailTable({ rows }: { rows: RollupTaskRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50/60 text-left text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            <th className="px-3 py-2.5">Task</th>
            <th className="px-3 py-2.5">Engineer</th>
            <th className="px-3 py-2.5 text-right">Δ%</th>
            <th className="px-3 py-2.5">Status</th>
            <th className="px-3 py-2.5">Last photo</th>
            <th className="px-3 py-2.5 text-center">Blocker</th>
            <th className="px-3 py-2.5 text-right">Days</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.task_id}
              className="border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50/40"
            >
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-1.5">
                  {r.task_no != null && (
                    <span className="font-mono text-[10px] text-zinc-400">#{r.task_no}</span>
                  )}
                  <span
                    className={cn(
                      'truncate font-medium',
                      r.status === 'completed' && 'text-zinc-400 line-through'
                    )}
                    title={r.title}
                  >
                    {r.title}
                  </span>
                  {r.discipline && (
                    <span
                      className="ml-1 inline-flex h-4 items-center rounded px-1 text-[9px] font-medium"
                      style={{
                        backgroundColor: DISCIPLINE_CONFIG[r.discipline as keyof typeof DISCIPLINE_CONFIG]?.color
                          ? `${DISCIPLINE_CONFIG[r.discipline as keyof typeof DISCIPLINE_CONFIG].color}15`
                          : undefined,
                        color: DISCIPLINE_CONFIG[r.discipline as keyof typeof DISCIPLINE_CONFIG]?.color,
                      }}
                    >
                      {DISCIPLINE_CONFIG[r.discipline as keyof typeof DISCIPLINE_CONFIG]?.label ?? r.discipline}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-3 py-2.5 text-zinc-700">
                {r.engineer_name ?? <span className="text-zinc-400">Unassigned</span>}
              </td>
              <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                <span
                  className={cn(
                    r.progress_delta > 0 && 'text-emerald-700',
                    r.progress_delta < 0 && 'text-red-700',
                    r.progress_delta === 0 && 'text-zinc-500'
                  )}
                >
                  {r.progress_delta > 0 ? '+' : ''}
                  {r.progress_delta}
                </span>
              </td>
              <td className="px-3 py-2.5 text-zinc-700">{r.status ?? '—'}</td>
              <td className="px-3 py-2.5 text-xs text-zinc-500">
                {r.last_photo_at
                  ? new Date(r.last_photo_at).toLocaleDateString()
                  : <span className="text-zinc-400">—</span>}
              </td>
              <td className="px-3 py-2.5 text-center">
                {r.blocker_raised ? (
                  <span className="inline-flex h-5 items-center rounded-full bg-red-100 px-2 text-[10px] font-medium text-red-700">
                    Yes
                  </span>
                ) : (
                  <span className="text-zinc-300">—</span>
                )}
              </td>
              <td className="px-3 py-2.5 text-right font-mono tabular-nums text-zinc-700">
                {r.days_touched}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MatrixView({ rows }: { rows: RollupTaskRow[] }) {
  // Group by task title (row) and discipline (column).
  const disciplineKeys = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.discipline && set.add(r.discipline));
    return Array.from(set);
  }, [rows]);

  const matrix = useMemo(() => {
    const m: Record<string, Record<string, RollupTaskRow[]>> = {};
    for (const r of rows) {
      const key = r.task_id;
      m[key] ??= {};
      const dk = r.discipline ?? '—';
      m[key][dk] = [...(m[key][dk] ?? []), r];
    }
    return m;
  }, [rows]);

  if (disciplineKeys.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-200 bg-white p-12 text-center text-sm text-zinc-500">
        No disciplines in this week&apos;s updates.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50/60 text-left text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            <th className="px-3 py-2.5">Task</th>
            {disciplineKeys.map((d) => (
              <th key={d} className="px-3 py-2.5 text-right">
                {DISCIPLINE_CONFIG[d as keyof typeof DISCIPLINE_CONFIG]?.label ?? d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.task_id} className="border-b border-zinc-100 last:border-b-0">
              <td className="px-3 py-2.5 font-medium text-zinc-900">{r.title}</td>
              {disciplineKeys.map((d) => {
                const cell = matrix[r.task_id]?.[d];
                const delta = cell?.reduce((s, x) => s + x.progress_delta, 0) ?? 0;
                return (
                  <td
                    key={d}
                    className={cn(
                      'px-3 py-2.5 text-right font-mono tabular-nums',
                      delta > 0 && 'bg-emerald-50 text-emerald-700',
                      delta < 0 && 'bg-red-50 text-red-700',
                      delta === 0 && 'text-zinc-400'
                    )}
                  >
                    {cell ? (delta > 0 ? '+' : '') + delta : '—'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================
// PDF EXPORT (Phase 4.3)
// ============================================

async function exportPdf(
  rows: RollupTaskRow[],
  meta: { from: string; to: string }
) {
  try {
    const jsPDF = (await import('jspdf')).default;
    const autoTable = (await import('jspdf-autotable')).default;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    doc.setFontSize(14);
    doc.text('Weekly Reports Rollup', 40, 40);
    doc.setFontSize(10);
    doc.text(`${meta.from} – ${meta.to} · ${rows.length} tasks`, 40, 58);

    autoTable(doc, {
      startY: 80,
      head: [['Task', 'Engineer', 'Δ%', 'Status', 'Blocker', 'Days']],
      body: rows.map((r) => [
        r.task_no != null ? `#${r.task_no} ${r.title}` : r.title,
        r.engineer_name ?? 'Unassigned',
        r.progress_delta > 0 ? `+${r.progress_delta}` : `${r.progress_delta}`,
        r.status ?? '—',
        r.blocker_raised ? 'Yes' : '—',
        `${r.days_touched}`,
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [37, 99, 235] },
    });

    doc.save(`rollup-${meta.from}-to-${meta.to}.pdf`);
    toast.success('PDF exported.');
  } catch (e: any) {
    toast.error(`PDF export failed: ${e?.message ?? 'unknown'}`);
  }
}

export default ProjectReportsRollup;
