import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Squares2X2Icon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentTextIcon,
  ClipboardDocumentCheckIcon,
  BellAlertIcon,
  ArrowTrendingUpIcon,
  ArrowRightIcon,
  UserGroupIcon,
  WrenchScrewdriverIcon,
  PauseCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/App';
import { supabase } from '@/lib/supabase';
import { useHandovers } from '@/hooks/useHandovers';
import { HANDOVER_STATUS_CONFIG } from '@/types/handover';
import { useOpenStoppagesByOrg, useResolveStoppage, useReopenStoppage, useDeleteStoppage } from '@/hooks/useStoppages';
import {
  labelForStoppageCategory,
  labelForBlockingParty,
  toneClassForCategory,
  type WorkStoppageWithReport,
} from '@/types/siteReportStoppage';
import { cn } from '@/lib/utils';

type DateWindow = 'today' | 'this_week' | 'this_month';

const DATE_WINDOW_DAYS: Record<DateWindow, number> = {
  today: 1,
  this_week: 7,
  this_month: 30,
};

const DATE_WINDOW_LABEL: Record<DateWindow, string> = {
  today: 'Today',
  this_week: 'This Week',
  this_month: 'This Month',
};

type ProjectRow = {
  id: string;
  name: string;
  project_name: string | null;
  client_name: string | null;
  status: string | null;
  completion_percentage: number | null;
  expected_end_date: string | null;
  start_date: string | null;
};

type SiteReportRow = {
  id: string;
  project_id: string;
  report_date: string;
  engineer_name: string | null;
  pm_status: string | null;
  organisation_id: string;
};

type ApprovalRow = {
  id: string;
  approval_type: string;
  title: string;
  status: string;
  priority: string;
  requested_at: string;
  organisation_id: string;
  reference_id: string | null;
  reference_type: string | null;
};

export default function ProjectOverview() {
  const navigate = useNavigate();
  const { organisation } = useAuth();
  const orgId: string | undefined = organisation?.id ?? undefined;
  const [window, setWindow] = useState<DateWindow>('this_week');

  // ------------------------------------------------------------
  // Data
  // ------------------------------------------------------------
  const projectsQuery = useQuery({
    queryKey: ['overview-projects', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, project_name, client_name, status, completion_percentage, expected_end_date, start_date')
        .eq('organisation_id', orgId as string)
        .order('name', { ascending: true });
      if (error) throw error;
      return (data || []) as ProjectRow[];
    },
  });

  const handoversQuery = useHandovers(orgId);

  const reportsQuery = useQuery({
    queryKey: ['overview-reports', orgId, window],
    enabled: !!orgId,
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - DATE_WINDOW_DAYS[window]);
      const sinceIso = since.toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from('site_reports')
        .select('id, project_id, report_date, engineer_name, pm_status, organisation_id')
        .eq('organisation_id', orgId as string)
        .gte('report_date', sinceIso)
        .order('report_date', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as SiteReportRow[];
    },
  });

  const approvalsQuery = useQuery({
    queryKey: ['overview-approvals', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('approvals')
        .select('id, approval_type, title, status, priority, requested_at, organisation_id, reference_id, reference_type')
        .eq('organisation_id', orgId as string)
        .eq('status', 'PENDING')
        .order('requested_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as ApprovalRow[];
    },
  });

  // Phase H: open work stoppages across the org
  const openStoppagesQuery = useOpenStoppagesByOrg(orgId);
  const resolveStoppage = useResolveStoppage(orgId);
  const reopenStoppage = useReopenStoppage(orgId);
  const deleteStoppage = useDeleteStoppage(orgId);

  // Resolve dialog state (Phase H)
  const [resolving, setResolving] = useState<WorkStoppageWithReport | null>(null);
  const [resolveDate, setResolveDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [resolveNotes, setResolveNotes] = useState<string>('');
  const openResolveDialog = (s: WorkStoppageWithReport) => {
    setResolving(s);
    setResolveDate(new Date().toISOString().slice(0, 10));
    setResolveNotes('');
  };
  const closeResolveDialog = () => { setResolving(null); setResolveNotes(''); };
  const submitResolve = () => {
    if (!resolving) return;
    if (!resolveDate) { return; }
    resolveStoppage.mutate(
      { id: resolving.id, actual_resolution_date: resolveDate, resolution_notes: resolveNotes },
      { onSuccess: () => { closeResolveDialog(); } },
    );
  };

  const projects = projectsQuery.data ?? [];
  const handovers = handoversQuery.data ?? [];
  const reports = reportsQuery.data ?? [];
  const approvals = approvalsQuery.data ?? [];
  const openStoppages = openStoppagesQuery.data ?? [];

  // ------------------------------------------------------------
  // Aggregations
  // ------------------------------------------------------------
  const projectById = useMemo(() => {
    const m = new Map<string, ProjectRow>();
    projects.forEach((p) => m.set(p.id, p));
    return m;
  }, [projects]);

  const activeProjects = useMemo(
    () => projects.filter((p) => p.status === 'Active' || p.status === null).length,
    [projects],
  );

  const reportsByProject = useMemo(() => {
    const m = new Map<string, SiteReportRow[]>();
    reports.forEach((r) => {
      const list = m.get(r.project_id) ?? [];
      list.push(r);
      m.set(r.project_id, list);
    });
    return m;
  }, [reports]);

  const openHandovers = useMemo(
    () => handovers.filter((h) => h.status !== 'Signed'),
    [handovers],
  );

  const overdueHandovers = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return handovers
      .filter((h) => h.status !== 'Signed' && h.planned_date < today)
      .sort((a, b) => a.planned_date.localeCompare(b.planned_date));
  }, [handovers]);

  const rejectedReports = useMemo(
    () => reports.filter((r) => r.pm_status === 'Rejected'),
    [reports],
  );

  const pendingApprovalsCount = approvals.length;

  // Stoppage aggregations (Phase H)
  const today = new Date().toISOString().slice(0, 10);
  const overdueStoppages = useMemo(
    () => openStoppages.filter((s) => s.expected_resolution_date && s.expected_resolution_date < today),
    [openStoppages, today],
  );
  const unknownDateStoppages = useMemo(
    () => openStoppages.filter((s) => !s.expected_resolution_date),
    [openStoppages],
  );
  const stoppagesByProject = useMemo(() => {
    const m = new Map<string, number>();
    openStoppages.forEach((s) => {
      const report = Array.isArray(s.report) ? s.report[0] : s.report;
      if (!report) return;
      m.set(report.project_id, (m.get(report.project_id) ?? 0) + 1);
    });
    return m;
  }, [openStoppages]);

  // ------------------------------------------------------------
  // Attention feed (capped at 8 items)
  // ------------------------------------------------------------
  type AttentionItem = {
    id: string;
    kind: 'overdue_handover' | 'pending_approval' | 'rejected_report' | 'overdue_stoppage';
    title: string;
    subtitle: string;
    ageLabel: string;
    ageTone: 'overdue' | 'recent' | 'normal';
    href: string;
  };

  const attentionFeed = useMemo<AttentionItem[]>(() => {
    const items: AttentionItem[] = [];

    overdueHandovers.forEach((h) => {
      const proj = projectById.get(h.project_id);
      const projectName = proj?.project_name || proj?.name || '—';
      const days = daysBetween(h.planned_date, new Date().toISOString().slice(0, 10));
      items.push({
        id: `h-${h.id}`,
        kind: 'overdue_handover',
        title: `${projectName} — ${h.system_or_area}`,
        subtitle: `Handover planned ${formatDate(h.planned_date)} • ${h.responsible_engineer_name || 'Unassigned'}`,
        ageLabel: `${Math.abs(days)}d overdue`,
        ageTone: 'overdue',
        href: '/handover',
      });
    });

    approvals.slice(0, 20).forEach((a) => {
      const days = daysBetween(a.requested_at.slice(0, 10), new Date().toISOString().slice(0, 10));
      items.push({
        id: `a-${a.id}`,
        kind: 'pending_approval',
        title: a.title,
        subtitle: `${labelForApprovalType(a.approval_type)} • ${a.priority}`,
        ageLabel: days === 0 ? 'today' : `${days}d pending`,
        ageTone: days >= 3 ? 'overdue' : 'recent',
        href: '/approvals',
      });
    });

    rejectedReports.slice(0, 10).forEach((r) => {
      const proj = projectById.get(r.project_id);
      const projectName = proj?.project_name || proj?.name || '—';
      items.push({
        id: `r-${r.id}`,
        kind: 'rejected_report',
        title: `${projectName} — ${formatDate(r.report_date)}`,
        subtitle: `Report rejected • ${r.engineer_name || 'Unknown engineer'}`,
        ageLabel: daysBetween(r.report_date, new Date().toISOString().slice(0, 10)) === 0 ? 'today' : 'recent',
        ageTone: 'recent',
        href: '/site-reports',
      });
    });

    overdueStoppages.slice(0, 8).forEach((s) => {
      const report = Array.isArray(s.report) ? s.report[0] : s.report;
      const proj = report ? projectById.get(report.project_id) : undefined;
      const projectName = proj?.project_name || proj?.name || '—';
      const days = daysBetween(s.expected_resolution_date as string, new Date().toISOString().slice(0, 10));
      items.push({
        id: `s-${s.id}`,
        kind: 'overdue_stoppage',
        title: `${projectName} — ${labelForStoppageCategory(s.category)}`,
        subtitle: s.affected_work || s.reason_detail || '—',
        ageLabel: `${Math.abs(days)}d overdue`,
        ageTone: 'overdue',
        href: '/projects-overview',
      });
    });

    return items.slice(0, 8);
  }, [overdueHandovers, approvals, rejectedReports, overdueStoppages, projectById]);

  // ------------------------------------------------------------
  // Loading state
  // ------------------------------------------------------------
  const isLoading =
    projectsQuery.isLoading ||
    handoversQuery.isLoading ||
    reportsQuery.isLoading ||
    approvalsQuery.isLoading ||
    openStoppagesQuery.isLoading;

  // ------------------------------------------------------------
  // Render
  // ------------------------------------------------------------
  return (
    <div className="p-6 space-y-6 bg-zinc-50 min-h-screen">
      {/* Header */}
      <div className="bg-white border border-zinc-200 rounded-lg py-5">
        <div className="px-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 flex items-center gap-2">
              <Squares2X2Icon className="w-7 h-7 text-blue-600" />
              Projects Overview
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Cross-project signals — what needs attention, where things stand.
            </p>
          </div>
          <div className="flex items-center gap-1.5 bg-zinc-100 rounded-lg p-1">
            {(Object.keys(DATE_WINDOW_LABEL) as DateWindow[]).map((w) => (
              <button
                key={w}
                onClick={() => setWindow(w)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                  window === w
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'text-zinc-600 hover:text-zinc-900',
                )}
              >
                {DATE_WINDOW_LABEL[w]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard
          label="Active Projects"
          value={activeProjects}
          total={projects.length}
          icon={<WrenchScrewdriverIcon className="w-4 h-4" />}
          tone="blue"
          onClick={() => navigate('/projects')}
        />
        <KpiCard
          label={`Reports (${DATE_WINDOW_LABEL[window]})`}
          value={reports.length}
          icon={<DocumentTextIcon className="w-4 h-4" />}
          tone="zinc"
          onClick={() => navigate('/site-reports')}
        />
        <KpiCard
          label="Open Handovers"
          value={openHandovers.length}
          sub={overdueHandovers.length > 0 ? `${overdueHandovers.length} overdue` : null}
          subTone="overdue"
          icon={<ClipboardDocumentCheckIcon className="w-4 h-4" />}
          tone="amber"
          onClick={() => navigate('/handover')}
        />
        <KpiCard
          label="Open Stoppages"
          value={openStoppages.length}
          sub={overdueStoppages.length > 0 ? `${overdueStoppages.length} overdue` : unknownDateStoppages.length > 0 ? `${unknownDateStoppages.length} no date` : null}
          subTone="overdue"
          icon={<PauseCircleIcon className="w-4 h-4" />}
          tone="red"
          onClick={() => {
            const el = document.getElementById('work-stoppages-section');
            el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        />
        <KpiCard
          label="Pending Approvals"
          value={pendingApprovalsCount}
          icon={<BellAlertIcon className="w-4 h-4" />}
          tone="purple"
          onClick={() => navigate('/approvals')}
        />
      </div>

      {/* Attention feed */}
      <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
            <ExclamationTriangleIcon className="w-4 h-4 text-amber-500" />
            Needs Attention
          </h2>
          <span className="text-xs text-zinc-500">{attentionFeed.length} item{attentionFeed.length === 1 ? '' : 's'}</span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-sm text-zinc-500">Loading signals…</div>
        ) : attentionFeed.length === 0 ? (
          <div className="p-10 text-center">
            <CheckCircleIcon className="w-10 h-10 mx-auto text-emerald-400 mb-2" />
            <h3 className="text-sm font-medium text-zinc-700">All clear</h3>
            <p className="text-xs text-zinc-500 mt-1">
              No overdue handovers, pending approvals, or rejected reports right now.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {attentionFeed.map((item) => (
              <button
                key={item.id}
                onClick={() => navigate(item.href)}
                className="w-full px-5 py-3 flex items-center gap-4 hover:bg-zinc-50/60 text-left transition-colors group"
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                    item.kind === 'overdue_handover' && 'bg-red-100 text-red-600',
                    item.kind === 'pending_approval' && 'bg-purple-100 text-purple-600',
                    item.kind === 'rejected_report' && 'bg-amber-100 text-amber-600',
                    item.kind === 'overdue_stoppage' && 'bg-red-100 text-red-600',
                  )}
                >
                  {item.kind === 'overdue_handover' && <ClockIcon className="w-4 h-4" />}
                  {item.kind === 'pending_approval' && <BellAlertIcon className="w-4 h-4" />}
                  {item.kind === 'rejected_report' && <ExclamationTriangleIcon className="w-4 h-4" />}
                  {item.kind === 'overdue_stoppage' && <PauseCircleIcon className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-zinc-900 truncate">{item.title}</div>
                  <div className="text-xs text-zinc-500 mt-0.5 truncate">{item.subtitle}</div>
                </div>
                <div
                  className={cn(
                    'text-xs font-medium px-2 py-0.5 rounded-full shrink-0',
                    item.ageTone === 'overdue' && 'bg-red-100 text-red-700',
                    item.ageTone === 'recent' && 'bg-amber-100 text-amber-700',
                    item.ageTone === 'normal' && 'bg-zinc-100 text-zinc-600',
                  )}
                >
                  {item.ageLabel}
                </div>
                <ArrowRightIcon className="w-4 h-4 text-zinc-300 group-hover:text-zinc-500 transition-colors shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Open Work Stoppages (Phase H) — resolve from here */}
      <div id="work-stoppages-section" className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
            <PauseCircleIcon className="w-4 h-4 text-red-500" />
            Open Work Stoppages
          </h2>
          <span className="text-xs text-zinc-500">
            {openStoppages.length} open • {overdueStoppages.length} overdue
            {unknownDateStoppages.length > 0 ? ` • ${unknownDateStoppages.length} no date` : ''}
          </span>
        </div>

        {openStoppagesQuery.isLoading ? (
          <div className="p-8 text-center text-sm text-zinc-500">Loading stoppages…</div>
        ) : openStoppages.length === 0 ? (
          <div className="p-10 text-center">
            <CheckCircleIcon className="w-10 h-10 mx-auto text-emerald-400 mb-2" />
            <h3 className="text-sm font-medium text-zinc-700">No open stoppages</h3>
            <p className="text-xs text-zinc-500 mt-1">All work is unblocked right now.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {openStoppages.slice(0, 8).map((s) => {
              const report = Array.isArray(s.report) ? s.report[0] : s.report;
              const proj = report ? projectById.get(report.project_id) : undefined;
              const projectName = proj?.project_name || proj?.name || '—';
              const tone = toneClassForCategory(s.category);
              const isOverdue = s.expected_resolution_date && s.expected_resolution_date < today;
              return (
                <div
                  key={s.id}
                  className="px-5 py-3 flex items-start gap-4 hover:bg-zinc-50/60 transition-colors group"
                >
                  <div className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0', tone.bg)}>
                    <PauseCircleIcon className={cn('w-4 h-4', tone.text)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-zinc-900 truncate">{projectName}</span>
                      <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', tone.bg, tone.text)}>
                        {labelForStoppageCategory(s.category)}
                      </span>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">
                        {labelForBlockingParty(s.blocking_party)}
                      </span>
                      {isOverdue && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                          overdue
                        </span>
                      )}
                      {!s.expected_resolution_date && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                          no date
                        </span>
                      )}
                    </div>
                    {(s.affected_work || s.reason_detail) && (
                      <div className="text-xs text-zinc-600 mt-1 line-clamp-2">
                        <span className="font-medium">{s.affected_work}</span>
                        {s.affected_work && s.reason_detail ? ' — ' : ''}
                        {s.reason_detail}
                      </div>
                    )}
                    <div className="text-[10px] text-zinc-400 mt-1">
                      Logged on report {report ? formatDate(report.report_date) : '—'}
                      {s.expected_resolution_date && (
                        <> • expected restart {formatDate(s.expected_resolution_date)}</>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => openResolveDialog(s)}
                      className="h-7 text-[11px]"
                    >
                      <CheckCircleIcon className="w-3.5 h-3.5 mr-1" />
                      Mark Resolved
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (globalThis.confirm('Delete this stoppage? This cannot be undone.')) {
                          deleteStoppage.mutate(s.id);
                        }
                      }}
                      className="h-7 w-7 p-0 text-zinc-400 hover:text-red-600"
                      title="Delete stoppage"
                    >
                      <XCircleIcon className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
            {openStoppages.length > 8 && (
              <div className="px-5 py-2 text-center text-[11px] text-zinc-500 bg-zinc-50">
                + {openStoppages.length - 8} more open stoppage{openStoppages.length - 8 === 1 ? '' : 's'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Resolve dialog (Phase H) */}
      <Dialog open={!!resolving} onOpenChange={(o) => { if (!o) closeResolveDialog(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircleIcon className="w-5 h-5 text-emerald-600" />
              Mark Stoppage Resolved
            </DialogTitle>
            <DialogDescription>
              Record when work actually resumed. Once resolved, this stoppage is closed.
            </DialogDescription>
          </DialogHeader>
          {resolving && (
            <div className="space-y-3 py-2">
              <div className="bg-zinc-50 border border-zinc-200 rounded-md p-3 text-xs">
                <div className="font-semibold text-zinc-800 mb-1">
                  {(() => {
                    const report = Array.isArray(resolving.report) ? resolving.report[0] : resolving.report;
                    const proj = report ? projectById.get(report.project_id) : undefined;
                    return proj?.project_name || proj?.name || '—';
                  })()}
                </div>
                <div className="text-zinc-600 line-clamp-2">
                  <span className="font-medium">{resolving.affected_work || '—'}</span>
                  {resolving.affected_work && resolving.reason_detail ? ' — ' : ''}
                  {resolving.reason_detail}
                </div>
                {resolving.expected_resolution_date && (
                  <div className="text-zinc-500 mt-1">
                    Expected restart: {formatDate(resolving.expected_resolution_date)}
                  </div>
                )}
              </div>
              <div>
                <label className="text-[11px] font-semibold text-zinc-700 uppercase tracking-wide">
                  Actual restart date <span className="text-red-600">*</span>
                </label>
                <Input
                  type="date"
                  className="h-9 text-sm mt-1"
                  value={resolveDate}
                  onChange={(e) => setResolveDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-zinc-700 uppercase tracking-wide">
                  Resolution notes
                </label>
                <Textarea
                  className="text-sm mt-1 min-h-[72px]"
                  value={resolveNotes}
                  onChange={(e) => setResolveNotes(e.target.value)}
                  placeholder="What unblocked it? E.g. client released payment on 12 Jun, materials arrived on 14 Jun"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={closeResolveDialog}
              disabled={resolveStoppage.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={submitResolve}
              disabled={!resolveDate || resolveStoppage.isPending}
            >
              {resolveStoppage.isPending ? 'Saving…' : 'Mark Resolved'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Project grid */}
      <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
            <UserGroupIcon className="w-4 h-4 text-blue-500" />
            Projects
          </h2>
          <button
            onClick={() => navigate('/projects')}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
          >
            View all
            <ArrowRightIcon className="w-3 h-3" />
          </button>
        </div>

        {projectsQuery.isLoading ? (
          <div className="p-8 text-center text-sm text-zinc-500">Loading projects…</div>
        ) : projects.length === 0 ? (
          <div className="p-10 text-center">
            <Squares2X2Icon className="w-10 h-10 mx-auto text-zinc-300 mb-2" />
            <h3 className="text-sm font-medium text-zinc-700">No projects yet</h3>
            <p className="text-xs text-zinc-500 mt-1">Create a project to start tracking signals.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-px bg-zinc-100">
            {projects.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                reportCount={reportsByProject.get(p.id)?.length ?? 0}
                openHandoverCount={openHandovers.filter((h) => h.project_id === p.id).length}
                openStoppageCount={stoppagesByProject.get(p.id) ?? 0}
                onClick={() => navigate(`/projects/edit?id=${p.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// KPI card
// ------------------------------------------------------------
function KpiCard({
  label,
  value,
  total,
  sub,
  subTone,
  icon,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  total?: number;
  sub?: string | null;
  subTone?: 'overdue' | 'normal';
  icon: React.ReactNode;
  tone: 'zinc' | 'blue' | 'amber' | 'purple' | 'emerald' | 'red';
  onClick?: () => void;
}) {
  const toneClasses: Record<typeof tone, string> = {
    zinc:    'bg-zinc-100 text-zinc-600',
    blue:    'bg-blue-100 text-blue-600',
    amber:   'bg-amber-100 text-amber-600',
    emerald: 'bg-emerald-100 text-emerald-600',
    purple:  'bg-purple-100 text-purple-600',
    red:     'bg-red-100 text-red-600',
  };
  return (
    <button
      onClick={onClick}
      className="bg-white border border-zinc-200 rounded-lg p-4 text-left hover:border-zinc-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <span className={cn('w-6 h-6 rounded-full flex items-center justify-center', toneClasses[tone])}>
          {icon}
        </span>
        <span className="font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <div className="text-2xl font-semibold text-zinc-900">{value}</div>
        {typeof total === 'number' && (
          <div className="text-xs text-zinc-400">/ {total} total</div>
        )}
      </div>
      {sub && (
        <div
          className={cn(
            'text-xs mt-1',
            subTone === 'overdue' ? 'text-red-600 font-medium' : 'text-zinc-500',
          )}
        >
          {sub}
        </div>
      )}
    </button>
  );
}

// ------------------------------------------------------------
// Project card
// ------------------------------------------------------------
function ProjectCard({
  project,
  reportCount,
  openHandoverCount,
  openStoppageCount,
  onClick,
}: {
  project: ProjectRow;
  reportCount: number;
  openHandoverCount: number;
  openStoppageCount: number;
  onClick: () => void;
}) {
  const displayName = project.project_name || project.name;
  const completion = project.completion_percentage ?? 0;
  const statusTone = project.status === 'Active' ? 'bg-emerald-100 text-emerald-700' :
                     project.status === 'Closed' || project.status === 'Financially Closed' ? 'bg-zinc-100 text-zinc-600' :
                     'bg-blue-100 text-blue-700';

  // Time-to-deadline
  let deadline: { label: string; tone: 'normal' | 'overdue' | 'muted' } = { label: '—', tone: 'muted' };
  if (project.expected_end_date) {
    const days = daysBetween(project.expected_end_date, new Date().toISOString().slice(0, 10));
    if (days < 0) {
      deadline = { label: `${Math.abs(days)}d overdue`, tone: 'overdue' };
    } else if (days === 0) {
      deadline = { label: 'due today', tone: 'overdue' };
    } else if (days <= 30) {
      deadline = { label: `due in ${days}d`, tone: 'normal' };
    } else {
      deadline = { label: `due in ${days}d`, tone: 'muted' };
    }
  }

  return (
    <button
      onClick={onClick}
      className="bg-white p-4 text-left hover:bg-zinc-50 transition-colors group"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-zinc-900 truncate">{displayName}</div>
          {project.client_name && (
            <div className="text-xs text-zinc-500 truncate mt-0.5">{project.client_name}</div>
          )}
        </div>
        <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0', statusTone)}>
          {project.status || '—'}
        </span>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
          <span>Completion</span>
          <span className="font-medium text-zinc-700">{Math.round(completion)}%</span>
        </div>
        <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full',
              completion >= 80 ? 'bg-emerald-500' :
              completion >= 40 ? 'bg-blue-500' :
              'bg-amber-500',
            )}
            style={{ width: `${Math.min(100, Math.max(0, completion))}%` }}
          />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div className="bg-zinc-50 rounded px-2 py-1.5">
          <div className="text-zinc-500">Reports</div>
          <div className="font-semibold text-zinc-900">{reportCount}</div>
        </div>
        <div className="bg-zinc-50 rounded px-2 py-1.5">
          <div className="text-zinc-500">Handovers</div>
          <div className={cn('font-semibold', openHandoverCount > 0 ? 'text-amber-600' : 'text-zinc-900')}>
            {openHandoverCount}
          </div>
        </div>
        <div className="bg-zinc-50 rounded px-2 py-1.5">
          <div className="text-zinc-500">Stoppages</div>
          <div className={cn('font-semibold', openStoppageCount > 0 ? 'text-red-600' : 'text-zinc-900')}>
            {openStoppageCount}
          </div>
        </div>
      </div>

      <div
        className={cn(
          'mt-3 text-xs flex items-center gap-1',
          deadline.tone === 'overdue' && 'text-red-600 font-medium',
          deadline.tone === 'normal' && 'text-amber-600',
          deadline.tone === 'muted' && 'text-zinc-400',
        )}
      >
        <ArrowTrendingUpIcon className="w-3 h-3" />
        {deadline.label}
      </div>
    </button>
  );
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------
function daysBetween(from: string, to: string): number {
  const a = new Date(from);
  const b = new Date(to);
  return Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function labelForApprovalType(t: string): string {
  if (t === 'SITE_REPORT_REQUEST') return 'Site Report';
  if (t === 'PO') return 'Purchase Order';
  if (t === 'WO') return 'Work Order';
  if (t === 'QUOTE') return 'Quotation';
  if (t === 'INVOICE') return 'Invoice';
  return t;
}
