import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Squares2X2Icon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  BellAlertIcon,
  ArrowTrendingUpIcon,
  ArrowRightIcon,
  UserGroupIcon,
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
import { useOpenStoppagesByOrg, useResolveStoppage, useReopenStoppage, useDeleteStoppage } from '@/hooks/useStoppages';
import {
  labelForStoppageCategory,
  labelForBlockingParty,
  toneClassForCategory,
  type WorkStoppageWithReport,
} from '@/types/siteReportStoppage';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

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

function daysBetween(from: string, to: string): number {
  const a = new Date(from);
  const b = new Date(to);
  return Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(iso: string): string {
  if (!iso) return '\u2014';
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

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.08 },
  },
};

const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const } },
};

export default function ProjectOverview() {
  const navigate = useNavigate();
  const { organisation } = useAuth();
  const orgId: string | undefined = organisation?.id ?? undefined;
  const [window, setWindow] = useState<DateWindow>('this_week');

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

  const openStoppagesQuery = useOpenStoppagesByOrg(orgId);
  const resolveStoppage = useResolveStoppage(orgId);
  const reopenStoppage = useReopenStoppage(orgId);
  const deleteStoppage = useDeleteStoppage(orgId);

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
    if (!resolveDate) return;
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
      const projectName = proj?.project_name || proj?.name || '\u2014';
      const days = daysBetween(h.planned_date, new Date().toISOString().slice(0, 10));
      items.push({
        id: `h-${h.id}`,
        kind: 'overdue_handover',
        title: `${projectName} \u2014 ${h.system_or_area}`,
        subtitle: `Handover planned ${formatDate(h.planned_date)} \u2022 ${h.responsible_engineer_name || 'Unassigned'}`,
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
        subtitle: `${labelForApprovalType(a.approval_type)} \u2022 ${a.priority}`,
        ageLabel: days === 0 ? 'today' : `${days}d pending`,
        ageTone: days >= 3 ? 'overdue' : 'recent',
        href: '/approvals',
      });
    });

    rejectedReports.slice(0, 10).forEach((r) => {
      const proj = projectById.get(r.project_id);
      const projectName = proj?.project_name || proj?.name || '\u2014';
      items.push({
        id: `r-${r.id}`,
        kind: 'rejected_report',
        title: `${projectName} \u2014 ${formatDate(r.report_date)}`,
        subtitle: `Report rejected \u2022 ${r.engineer_name || 'Unknown engineer'}`,
        ageLabel: daysBetween(r.report_date, new Date().toISOString().slice(0, 10)) === 0 ? 'today' : 'recent',
        ageTone: 'recent',
        href: '/site-reports',
      });
    });

    overdueStoppages.slice(0, 8).forEach((s) => {
      const report = Array.isArray(s.report) ? s.report[0] : s.report;
      const proj = report ? projectById.get(report.project_id) : undefined;
      const projectName = proj?.project_name || proj?.name || '\u2014';
      const days = daysBetween(s.expected_resolution_date as string, new Date().toISOString().slice(0, 10));
      items.push({
        id: `s-${s.id}`,
        kind: 'overdue_stoppage',
        title: `${projectName} \u2014 ${labelForStoppageCategory(s.category)}`,
        subtitle: s.affected_work || s.reason_detail || '\u2014',
        ageLabel: `${Math.abs(days)}d overdue`,
        ageTone: 'overdue',
        href: '/projects-overview',
      });
    });

    return items.slice(0, 8);
  }, [overdueHandovers, approvals, rejectedReports, overdueStoppages, projectById]);

  const isLoading =
    projectsQuery.isLoading ||
    handoversQuery.isLoading ||
    reportsQuery.isLoading ||
    approvalsQuery.isLoading ||
    openStoppagesQuery.isLoading;

  return (
    <motion.div
      className="min-h-screen"
      style={{ backgroundColor: '#f6f5f2' }}
      initial="hidden"
      animate="show"
      variants={container}
    >
      <header
        className="border-b bg-white sticky top-0 z-10"
        style={{ borderColor: 'rgba(0,0,0,0.05)' }}
      >
        <div className="max-w-[1440px] mx-auto p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'rgba(13, 124, 107, 0.1)' }}
            >
              <Squares2X2Icon className="w-5 h-5" style={{ color: '#0d7c6b' }} />
            </div>
            <div>
              <h1 className="text-lg font-medium tracking-tight" style={{ color: '#1c1917' }}>
                CEO Dashboard
              </h1>
              <p className="text-xs mt-0.5" style={{ color: '#78716c' }}>
                Cross-project signals &mdash; what needs attention, where things stand
              </p>
            </div>
          </div>
          <div
            className="flex items-center gap-1 p-0.5 rounded-lg"
            style={{ backgroundColor: '#f0efeb' }}
          >
            {(Object.keys(DATE_WINDOW_LABEL) as DateWindow[]).map((w) => (
              <button
                key={w}
                onClick={() => setWindow(w)}
                className={cn(
                  'px-3.5 py-1.5 text-xs font-medium rounded-md transition-all duration-300',
                  window === w
                    ? 'bg-white shadow-sm'
                    : 'hover:text-[#1c1917]',
                )}
                style={{
                  color: window === w ? '#1c1917' : '#a8a29e',
                  boxShadow: window === w ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                  transitionTimingFunction: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                }}
              >
                {DATE_WINDOW_LABEL[w]}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto px-6 py-8 space-y-8">
        {/* Attention + Stoppages side by side */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Attention Feed */}
          <motion.div variants={item}>
            <div className="bg-white rounded-xl" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.03)' }}>
              <div className="p-6 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#1c1917' }}>
                  <ExclamationTriangleIcon className="w-4 h-4" style={{ color: '#d97706' }} />
                  Needs Attention
                </h2>
                <span className="text-[11px] font-medium" style={{ color: '#a8a29e' }}>
                  {attentionFeed.length} item{attentionFeed.length === 1 ? '' : 's'}
                </span>
              </div>

              {isLoading ? (
                <div className="py-12 text-center">
                  <div className="text-xs" style={{ color: '#a8a29e' }}>Loading signals&hellip;</div>
                </div>
              ) : attentionFeed.length === 0 ? (
                <div className="py-12 text-center">
                  <CheckCircleIcon className="w-8 h-8 mx-auto mb-2" style={{ color: '#a7f3d0' }} />
                  <h3 className="text-sm font-medium" style={{ color: '#44403c' }}>All clear</h3>
                  <p className="text-xs mt-1" style={{ color: '#a8a29e' }}>
                    No overdue handovers, pending approvals, or rejected reports.
                  </p>
                </div>
              ) : (
                <div>
                  {attentionFeed.map((item, i) => (
                    <button
                      key={item.id}
                      onClick={() => navigate(item.href)}
                      className="w-full flex items-start gap-4 p-6 text-left transition-all duration-200 hover:bg-[#fafaf9] group"
                      style={{
                        borderBottom: i < attentionFeed.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                      }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full mt-[7px] shrink-0"
                        style={{
                          backgroundColor:
                            item.kind === 'overdue_handover' || item.kind === 'overdue_stoppage'
                              ? '#dc2626'
                              : item.kind === 'rejected_report'
                              ? '#d97706'
                              : '#7c3aed',
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate" style={{ color: '#1c1917' }}>
                          {item.title}
                        </div>
                        <div className="text-xs mt-0.5 truncate" style={{ color: '#a8a29e' }}>
                          {item.subtitle}
                        </div>
                      </div>
                      <span
                        className="text-[11px] font-medium px-2.5 py-0.5 rounded-full shrink-0 mt-0.5"
                        style={{
                          backgroundColor:
                            item.ageTone === 'overdue' ? '#fef2f2' : item.ageTone === 'recent' ? '#fffbeb' : '#f5f5f4',
                          color:
                            item.ageTone === 'overdue' ? '#dc2626' : item.ageTone === 'recent' ? '#d97706' : '#a8a29e',
                        }}
                      >
                        {item.ageLabel}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>

          {/* Open Stoppages */}
          <motion.div variants={item} id="work-stoppages-section">
            <div className="bg-white rounded-xl" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.03)' }}>
              <div className="p-6 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#1c1917' }}>
                  <PauseCircleIcon className="w-4 h-4" style={{ color: '#dc2626' }} />
                  Open Work Stoppages
                </h2>
                <span className="text-[11px] font-medium" style={{ color: '#a8a29e' }}>
                  {openStoppages.length} open
                  {overdueStoppages.length > 0 ? ` \u2022 ${overdueStoppages.length} overdue` : ''}
                  {unknownDateStoppages.length > 0 ? ` \u2022 ${unknownDateStoppages.length} no date` : ''}
                </span>
              </div>

              {openStoppagesQuery.isLoading ? (
                <div className="py-12 text-center">
                  <div className="text-xs" style={{ color: '#a8a29e' }}>Loading stoppages&hellip;</div>
                </div>
              ) : openStoppages.length === 0 ? (
                <div className="py-12 text-center">
                  <CheckCircleIcon className="w-8 h-8 mx-auto mb-2" style={{ color: '#a7f3d0' }} />
                  <h3 className="text-sm font-medium" style={{ color: '#44403c' }}>No open stoppages</h3>
                  <p className="text-xs mt-1" style={{ color: '#a8a29e' }}>All work is unblocked right now.</p>
                </div>
              ) : (
                <div>
                  {openStoppages.slice(0, 8).map((s, i) => {
                    const report = Array.isArray(s.report) ? s.report[0] : s.report;
                    const proj = report ? projectById.get(report.project_id) : undefined;
                    const projectName = proj?.project_name || proj?.name || '\u2014';
                    const tone = toneClassForCategory(s.category);
                    const isOverdue = s.expected_resolution_date && s.expected_resolution_date < today;
                    const isPastPlanned = s.planned_restart_date && s.planned_restart_date < today && !isOverdue;

                    return (
                      <div
                        key={s.id}
                        className="flex items-start gap-4 p-6 transition-all duration-200 hover:bg-[#fafaf9]"
                        style={{
                          borderBottom: i < Math.min(openStoppages.length, 8) - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                        }}
                      >
                        <div
                          className="w-1.5 h-1.5 rounded-full mt-[7px] shrink-0"
                          style={{
                            backgroundColor: isOverdue ? '#dc2626' : isPastPlanned ? '#ea580c' : '#d97706',
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium truncate" style={{ color: '#1c1917' }}>
                              {projectName}
                            </span>
                            <span
                              className={cn(
                                'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                                tone.bg,
                                tone.text,
                              )}
                            >
                              {labelForStoppageCategory(s.category)}
                            </span>
                            <span
                              className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: '#f0efeb', color: '#78716c' }}
                            >
                              {labelForBlockingParty(s.blocking_party)}
                            </span>
                            {isOverdue && (
                              <span
                                className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}
                              >
                                overdue
                              </span>
                            )}
                            {isPastPlanned && (
                              <span
                                className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                style={{ backgroundColor: '#fff7ed', color: '#ea580c' }}
                              >
                                past planned
                              </span>
                            )}
                            {s.planned_restart_date && !isPastPlanned && (
                              <span
                                className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                                style={{ backgroundColor: '#ecfdf5', color: '#059669' }}
                              >
                                planned restart {formatDate(s.planned_restart_date)}
                              </span>
                            )}
                            {!s.expected_resolution_date && !s.planned_restart_date && (
                              <span
                                className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                                style={{ backgroundColor: '#fffbeb', color: '#d97706' }}
                              >
                                no date
                              </span>
                            )}
                          </div>
                          {(s.affected_work || s.reason_detail) && (
                            <div className="text-xs mt-0.5 line-clamp-2" style={{ color: '#57534e' }}>
                              <span className="font-medium">{s.affected_work}</span>
                              {s.affected_work && s.reason_detail ? ' \u2014 ' : ''}
                              {s.reason_detail}
                            </div>
                          )}
                          <div className="text-[11px] mt-1" style={{ color: '#a8a29e' }}>
                            Logged on report {report ? formatDate(report.report_date) : '\u2014'}
                            {s.expected_resolution_date && (
                              <> &middot; expected restart {formatDate(s.expected_resolution_date)}</>
                            )}
                            {s.planned_restart_visit_id && (
                              <> &middot; <a href="/site-visits" className="underline hover:text-stone-600" target="_blank" rel="noreferrer">view site visit</a></>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 mt-0.5">
                          <button
                            onClick={() => openResolveDialog(s)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '6px 12px',
                              border: '1px solid #d1d5db',
                              background: '#fff',
                              color: '#374151',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 500,
                              cursor: 'pointer',
                              transition: 'all 0.15s',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#f3f4f6';
                              e.currentTarget.style.borderColor = '#9ca3af';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = '#fff';
                              e.currentTarget.style.borderColor = '#d1d5db';
                            }}
                          >
                            <CheckCircleIcon className="w-3.5 h-3.5" style={{ color: '#185FA5' }} />
                            Resolve
                          </button>
                          <button
                            onClick={() => {
                              if (globalThis.confirm('Delete this stoppage? This cannot be undone.')) {
                                deleteStoppage.mutate(s.id);
                              }
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '6px',
                              border: '1px solid #d1d5db',
                              background: '#fff',
                              color: '#000000',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              transition: 'all 0.15s',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#f3f4f6';
                              e.currentTarget.style.borderColor = '#9ca3af';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = '#fff';
                              e.currentTarget.style.borderColor = '#d1d5db';
                            }}
                            title="Delete stoppage"
                          >
                            <XCircleIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {openStoppages.length > 8 && (
                    <div className="p-6 text-center text-[11px]" style={{ backgroundColor: '#fafaf9', color: '#a8a29e' }}>
                      + {openStoppages.length - 8} more open stoppage{openStoppages.length - 8 === 1 ? '' : 's'}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </section>

        {/* Projects grid */}
        <motion.section variants={item}>
          <div className="bg-white rounded-xl" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.03)' }}>
            <div className="p-6 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
              <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#1c1917' }}>
                <UserGroupIcon className="w-4 h-4" style={{ color: '#0d7c6b' }} />
                Projects
              </h2>
              <button
                onClick={() => navigate('/projects')}
                className="text-xs font-medium flex items-center gap-1 transition-colors duration-200 hover:underline"
                style={{ color: '#0d7c6b' }}
              >
                View all
                <ArrowRightIcon className="w-3 h-3" />
              </button>
            </div>

            {projectsQuery.isLoading ? (
              <div className="py-16 text-center">
                <div className="text-xs" style={{ color: '#a8a29e' }}>Loading projects&hellip;</div>
              </div>
            ) : projects.length === 0 ? (
              <div className="py-16 text-center">
                <Squares2X2Icon className="w-8 h-8 mx-auto mb-2" style={{ color: '#d6d3d1' }} />
                <h3 className="text-sm font-medium" style={{ color: '#44403c' }}>No projects yet</h3>
                <p className="text-xs mt-1" style={{ color: '#a8a29e' }}>Create a project to start tracking signals.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {projects.map((p, i) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    reportCount={reportsByProject.get(p.id)?.length ?? 0}
                    openHandoverCount={openHandovers.filter((h) => h.project_id === p.id).length}
                    openStoppageCount={stoppagesByProject.get(p.id) ?? 0}
                    onClick={() => navigate(`/projects/edit?id=${p.id}`)}
                    className={i < projects.length - 1 ? 'border-r border-b border-[rgba(0,0,0,0.04)]' : 'border-b border-[rgba(0,0,0,0.04)]'}
                  />
                ))}
              </div>
            )}
          </div>
        </motion.section>
      </main>

      {/* Resolve dialog */}
      <Dialog open={!!resolving} onOpenChange={(o) => { if (!o) closeResolveDialog(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircleIcon className="w-5 h-5" style={{ color: '#059669' }} />
              Mark Stoppage Resolved
            </DialogTitle>
            <DialogDescription>
              Record when work actually resumed. Once resolved, this stoppage is closed.
            </DialogDescription>
          </DialogHeader>
          {resolving && (
            <div className="space-y-3 py-2">
              <div className="text-xs p-3 rounded-lg" style={{ backgroundColor: '#fafaf9', border: '1px solid rgba(0,0,0,0.06)' }}>
                <div className="font-semibold mb-1" style={{ color: '#292524' }}>
                  {(() => {
                    const report = Array.isArray(resolving.report) ? resolving.report[0] : resolving.report;
                    const proj = report ? projectById.get(report.project_id) : undefined;
                    return proj?.project_name || proj?.name || '\u2014';
                  })()}
                </div>
                <div style={{ color: '#57534e' }}>
                  <span className="font-medium">{resolving.affected_work || '\u2014'}</span>
                  {resolving.affected_work && resolving.reason_detail ? ' \u2014 ' : ''}
                  {resolving.reason_detail}
                </div>
                {resolving.expected_resolution_date && (
                  <div className="mt-1" style={{ color: '#a8a29e' }}>
                    Expected restart: {formatDate(resolving.expected_resolution_date)}
                  </div>
                )}
                {resolving.planned_restart_date && (
                  <div className="mt-1" style={{ color: '#059669' }}>
                    Planned restart: {formatDate(resolving.planned_restart_date)}
                    {resolving.planned_restart_visit_id && (
                      <a href="/site-visits" className="underline ml-2" target="_blank" rel="noreferrer">view site visit</a>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#57534e' }}>
                  Actual restart date <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <Input
                  type="date"
                  className="h-9 text-sm mt-1"
                  value={resolveDate}
                  onChange={(e) => setResolveDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#57534e' }}>
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
              {resolveStoppage.isPending ? 'Saving\u2026' : 'Mark Resolved'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Project Card                                                      */
/* ------------------------------------------------------------------ */
function ProjectCard({
  project,
  reportCount,
  openHandoverCount,
  openStoppageCount,
  onClick,
  className,
}: {
  project: ProjectRow;
  reportCount: number;
  openHandoverCount: number;
  openStoppageCount: number;
  onClick: () => void;
  className?: string;
}) {
  const displayName = project.project_name || project.name;
  const completion = project.completion_percentage ?? 0;

  const statusColor =
    project.status === 'Active'
      ? '#059669'
      : project.status === 'Closed' || project.status === 'Financially Closed'
      ? '#a8a29e'
      : '#0d7c6b';

  const statusBg =
    project.status === 'Active'
      ? '#ecfdf5'
      : project.status === 'Closed' || project.status === 'Financially Closed'
      ? '#f5f5f4'
      : '#f0fdf9';

  let deadline: { label: string; tone: 'overdue' | 'normal' | 'muted' } = { label: '\u2014', tone: 'muted' };
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

  const barColor =
    completion >= 80 ? '#059669' :
    completion >= 40 ? '#0d7c6b' :
    '#d97706';

  return (
    <button
      onClick={onClick}
      className={cn(
        'p-6 text-left transition-all duration-200 hover:bg-[#fafaf9] group',
        className,
      )}
      style={{
        transitionTimingFunction: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate" style={{ color: '#1c1917' }}>
            {displayName}
          </div>
          {project.client_name && (
            <div className="text-xs truncate mt-0.5" style={{ color: '#a8a29e' }}>
              {project.client_name}
            </div>
          )}
        </div>
        <span
          className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0"
          style={{ backgroundColor: statusBg, color: statusColor }}
        >
          {project.status || '\u2014'}
        </span>
      </div>

      <div className="mt-3.5">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span style={{ color: '#a8a29e' }}>Completion</span>
          <span className="font-medium" style={{ color: '#57534e', fontVariantNumeric: 'tabular-nums' }}>
            {Math.round(completion)}%
          </span>
        </div>
        <div
          className="h-1.5 rounded-full overflow-hidden"
          style={{ backgroundColor: '#f0efeb' }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(100, Math.max(0, completion))}%`,
              backgroundColor: barColor,
              transitionTimingFunction: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            }}
          />
        </div>
      </div>

      <div className="mt-3.5 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-lg px-2.5 py-1.5" style={{ backgroundColor: '#fafaf9' }}>
          <div style={{ color: '#a8a29e' }}>Reports</div>
          <div className="font-semibold" style={{ color: '#1c1917', fontVariantNumeric: 'tabular-nums' }}>
            {reportCount}
          </div>
        </div>
        <div className="rounded-lg px-2.5 py-1.5" style={{ backgroundColor: '#fafaf9' }}>
          <div style={{ color: '#a8a29e' }}>Handovers</div>
          <div
            className="font-semibold"
            style={{
              color: openHandoverCount > 0 ? '#d97706' : '#1c1917',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {openHandoverCount}
          </div>
        </div>
        <div className="rounded-lg px-2.5 py-1.5" style={{ backgroundColor: '#fafaf9' }}>
          <div style={{ color: '#a8a29e' }}>Stoppages</div>
          <div
            className="font-semibold"
            style={{
              color: openStoppageCount > 0 ? '#dc2626' : '#1c1917',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {openStoppageCount}
          </div>
        </div>
      </div>

      <div
        className="mt-3 text-xs flex items-center gap-1.5"
        style={{
          color:
            deadline.tone === 'overdue' ? '#dc2626' :
            deadline.tone === 'normal' ? '#d97706' :
            '#d6d3d1',
        }}
      >
        <ArrowTrendingUpIcon className="w-3 h-3" />
        {deadline.label}
      </div>
    </button>
  );
}
