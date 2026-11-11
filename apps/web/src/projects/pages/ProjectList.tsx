import { useState, useMemo, useRef, useEffect, lazy, Suspense, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { supabase } from '../../supabase';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  MoreHorizontal,
  Folder,
  Edit,
  Trash2,
  Archive,
} from 'lucide-react';
import { useAuth } from '../../App';
import { PermissionGuard } from '../../rbac';
import { Project } from '../types';
import {
  STATUS_CONFIG,
  PO_STATUS_CONFIG,
  STATUS_FILTER_OPTIONS,
} from '../constants';
import { fmt } from '../utils';
import { useProjects, useProjectStats } from '../hooks/useProjects';
import { Button } from '@/components/ui/button';
import { PageSkeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// Lazy-load the heavy detail view subtree on demand
const ProjectDetailView = lazy(() => import('./ProjectDetailView'));

// ─── ProjectList ──────────────────────────────────────────────────────────────

export default function ProjectList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { organisation } = useAuth();

  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
  const [scrollToMilestones, setScrollToMilestones] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const itemsPerPage = 20;

  const menuRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLElement | null>(null);

  // Debounce search input (~300ms) so typing does not fire a DB query per keystroke
  useEffect(() => {
    const t = setTimeout(() => {
      setSearchTerm(searchInput);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Close on outside press. pointerdown covers touch, pen and mouse; a
  // mousedown listener never fires a dismissal on iOS.
  useEffect(() => {
    const handler = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, []);

  // Escape dismisses the open menu and returns focus to its trigger.
  useEffect(() => {
    if (!openMenuId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpenMenuId(null);
      menuTriggerRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [openMenuId]);

  // 1. Projects List Query with server-side pagination & filtering
  const { data: projectsData, isLoading } = useProjects({
    organisationId: organisation?.id || '',
    page: currentPage,
    limit: itemsPerPage,
    search: searchTerm,
    status: statusFilter,
  });
  const projects = projectsData?.data ?? [];
  const totalCount = projectsData?.count ?? 0;

  // 2. Lightweight project status stats
  const { data: projectStats = {} } = useProjectStats(organisation?.id || '');

  // 3. At-risk milestone counts, scoped to the rows on this page. An
  //    org-wide query is silently cut at PostgREST's 1000-row default cap,
  //    so late pages would lose their indicators.
  const pageProjectIds = useMemo(() => projects.map((p) => p.id).join(','), [projects]);
  const { data: atRiskMilestoneCounts = {} } = useQuery<Record<string, number>>({
    queryKey: ['at-risk-milestones-count', organisation?.id, pageProjectIds],
    queryFn: async () => {
      if (!organisation?.id || !pageProjectIds) return {};
      const today = new Date().toISOString().split('T')[0];
      const sevenDaysLater = new Date(new Date().getTime() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('project_milestones')
        .select('project_id')
        .eq('organisation_id', organisation.id)
        .eq('is_completed', false)
        .in('project_id', pageProjectIds.split(','))
        .or(`milestone_date.lt.${today},and(milestone_date.gte.${today},milestone_date.lte.${sevenDaysLater})`);
      
      if (error) throw error;
      
      const counts: Record<string, number> = {};
      (data || []).forEach((m: any) => {
        counts[m.project_id] = (counts[m.project_id] || 0) + 1;
      });
      return counts;
    },
    enabled: !!organisation?.id && pageProjectIds.length > 0,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // ─── Stats ──────────────────────────────────────────────────────────────────
  // Keyed by the filter options so each pill can carry its own count.
  const stats = useMemo(() => {
    return STATUS_FILTER_OPTIONS.reduce<Record<string, number>>((acc, s) => {
      acc[s] = projectStats[s] || 0;
      return acc;
    }, {});
  }, [projectStats]);

  // ─── Pagination ─────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalCount);
  const currentItems = projects;

  const loadProjectDetails = (project: Project, scrollToMilestonesFlag = false) => {
    setSelectedProject(project);
    setScrollToMilestones(scrollToMilestonesFlag);
    setViewMode('detail');
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // DETAIL VIEW (Lazy-Loaded Component)
  // ═══════════════════════════════════════════════════════════════════════════════
  if (viewMode === 'detail' && selectedProject) {
    return (
      <Suspense fallback={<PageSkeleton variant="list" rows={8} />}>
        <ProjectDetailView
          selectedProject={selectedProject}
          onBack={() => {
            setViewMode('list');
            setSelectedProject(null);
            setScrollToMilestones(false);
          }}
          initialScrollToMilestones={scrollToMilestones}
        />
      </Suspense>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // LOADING STATE
  // ═══════════════════════════════════════════════════════════════════════════════
  if (isLoading) return <PageSkeleton variant="list" rows={8} />;

  // ═══════════════════════════════════════════════════════════════════════════════
  // LIST VIEW
  // ═══════════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col h-full min-h-[400px] max-w-[1400px] mx-auto w-full overflow-y-auto md:min-h-0 md:overflow-y-visible">
      {/* ── Main Header ── */}
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-3 py-2 md:px-6 md:py-4">
        <div className="flex shrink-0 items-center gap-2">
          <h1 className="text-base font-medium text-zinc-900">Projects</h1>
          <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 tabular-nums">
            {totalCount}
          </span>
        </div>
        <div className="relative min-w-0 flex-1 md:w-64 md:flex-none">
          <input
            type="text"
            placeholder="Search projects..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="h-11 w-full rounded-lg border border-zinc-200 px-3 text-[1rem] focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/25 md:h-[30px] md:px-4 md:text-sm"
          />
        </div>
      </div>

      {/* ── Filter Row ── */}
      <div className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-zinc-100 bg-zinc-50 px-3 py-2 md:static md:px-6 md:py-3">
        <div className="pl-rail -mx-1 min-w-0 flex-1 px-1">
          {STATUS_FILTER_OPTIONS.map((status) => (
            <button
              key={status}
              onClick={() => { setStatusFilter(status); setCurrentPage(1); }}
              aria-pressed={statusFilter === status}
              className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3.5 text-xs font-medium transition-colors duration-150 ease-out active:scale-[0.96] md:min-h-0 md:py-2 ${
                statusFilter === status
                  ? 'bg-blue-50 font-semibold text-blue-700 shadow-xs'
                  : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
              }`}
            >
              {status === 'All' ? 'All Projects' : status}
              <span className="tabular-nums opacity-90">{stats[status] || 0}</span>
            </button>
          ))}
        </div>
        <PermissionGuard permission="projects.create">
          <button
            onClick={() => navigate('/projects/new')}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-sm font-medium text-white shadow-sm transition-[background-color,scale] duration-150 ease-out hover:bg-blue-700 active:scale-[0.96] md:min-h-10"
          >
            <span className="hidden sm:inline">New Project</span>
            <span className="sm:hidden">New</span>
          </button>
        </PermissionGuard>
      </div>

      {/* ── Mobile card list ── */}
      <div className="px-3 py-3 md:hidden">
        {currentItems.length === 0 ? (
          <div className="py-16 text-center text-sm text-zinc-500">No projects found</div>
        ) : (
          <div className="pl-stagger flex flex-col gap-2.5">
            {currentItems.map((p, index) => {
              const statusCfg = STATUS_CONFIG[p.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.Draft;
              const poStatusCfg = PO_STATUS_CONFIG[p.po_status as keyof typeof PO_STATUS_CONFIG] || PO_STATUS_CONFIG.Pending;
              const showWarning = checkPORequiredWarning(p);
              const atRisk = atRiskMilestoneCounts[p.id] || 0;
              const poTotal = p.pos && p.pos.length > 0
                ? p.pos.reduce((sum, po) => sum + (po.po_total_value || 0), 0)
                : null;
              const pct = p.completion_percentage || 0;

              return (
                // The card opens on any tap, but the accessible control is the
                // title button, so the values below stay selectable.
                <article
                  key={p.id}
                  className="pl-pcard relative cursor-pointer rounded-2xl bg-white p-3.5"
                  style={{ ['--pl-i' as string]: String(index) }}
                  onClick={() => loadProjectDetails(p)}
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <h2 className="min-w-0">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); loadProjectDetails(p); }}
                          aria-label={`Open ${p.project_name || 'project'} details`}
                          className="pl-pcard-open block w-full truncate py-1 text-left text-[0.9375rem] font-semibold leading-snug text-zinc-900"
                        >
                          {p.project_name || 'Unnamed Project'}
                        </button>
                      </h2>
                      <div className="mt-0.5 flex items-center gap-2">
                        {p.project_code && (
                          <p className="min-w-0 truncate font-mono text-[0.6875rem] text-zinc-600">{p.project_code}</p>
                        )}
                        <div
                          className="h-1.5 min-w-6 flex-1 overflow-hidden rounded-full bg-zinc-100"
                          role="progressbar"
                          aria-label="Completion"
                          aria-valuenow={pct}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          <div
                            className="h-full rounded-full bg-blue-500 transition-[width] duration-500 ease-out"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="shrink-0 font-mono text-[0.75rem] font-medium tabular-nums text-zinc-600">
                          {pct}%
                        </span>
                      </div>
                    </div>
                    <div className="relative shrink-0" ref={openMenuId === p.id ? menuRef : null}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          menuTriggerRef.current = e.currentTarget;
                          setOpenMenuId(openMenuId === p.id ? null : p.id);
                        }}
                        aria-label={`Actions for ${p.project_name || 'project'}`}
                        aria-haspopup="menu"
                        aria-expanded={openMenuId === p.id}
                        className="relative inline-flex size-8 items-center justify-center rounded-lg text-zinc-500 transition-[background-color,color,scale] duration-150 ease-out after:absolute after:top-1/2 after:left-1/2 after:size-11 after:-translate-1/2 hover:bg-zinc-100 hover:text-zinc-800 active:scale-[0.96] focus:outline-none focus-visible:bg-zinc-100"
                      >
                        <MoreHorizontal className="pointer-events-none size-4" />
                      </button>
                      {openMenuId === p.id && (
                        <ProjectActionMenu
                          p={p}
                          dropUp={index >= currentItems.length - 3 && index > 3}
                          onClose={() => setOpenMenuId(null)}
                          onView={() => loadProjectDetails(p)}
                          onDeleted={() => { setSelectedProject(null); queryClient.invalidateQueries({ queryKey: ['projects'] }); }}
                        />
                      )}
                    </div>
                  </div>

                  {/* mt-3 keeps this row's 44px hit expanders clear of the
                      title button above them. */}
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600">
                      <span className="size-2 shrink-0 rounded-full" style={{ background: statusCfg.dot }} />
                      {statusCfg.label}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600">
                      <span className="size-2 shrink-0 rounded-full" style={{ background: poStatusCfg.dot }} />
                      PO {poStatusCfg.label}
                    </span>
                    {showWarning && (
                      <span className="inline-flex items-center rounded bg-red-50 px-1.5 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-red-700">
                        PO Required
                      </span>
                    )}
                    {atRisk > 0 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); loadProjectDetails(p, true); }}
                        className="relative inline-flex items-center rounded bg-amber-50 px-1.5 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-amber-700 transition-colors duration-150 ease-out hover:bg-amber-100 hover:text-amber-800 active:scale-[0.96] after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2"
                      >
                        {atRisk} {atRisk === 1 ? 'Milestone' : 'Milestones'} At Risk
                      </button>
                    )}
                  </div>

                  <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-zinc-100 pt-2.5">
                    <div className="flex min-w-0 items-baseline gap-1.5">
                      <dt className="shrink-0 text-[0.6875rem] uppercase tracking-wide text-zinc-500">Client</dt>
                      <dd className="truncate text-xs font-medium text-zinc-800">{p.client?.client_name || '-'}</dd>
                    </div>
                    <div className="flex min-w-0 items-baseline gap-1.5">
                      <dt className="shrink-0 text-[0.6875rem] uppercase tracking-wide text-zinc-500">Type</dt>
                      <dd className="truncate text-xs font-medium text-zinc-800">{p.project_type || '-'}</dd>
                    </div>
                    <div className="flex min-w-0 items-baseline gap-1.5">
                      <dt className="shrink-0 text-[0.6875rem] uppercase tracking-wide text-zinc-500">Est.</dt>
                      <dd className="truncate font-mono text-[0.8125rem] font-medium tabular-nums text-zinc-900">
                        {p.project_estimated_value ? fmt(p.project_estimated_value) : '-'}
                      </dd>
                    </div>
                    <div className="flex min-w-0 items-baseline gap-1.5">
                      <dt className="shrink-0 text-[0.6875rem] uppercase tracking-wide text-zinc-500">PO</dt>
                      <dd className="truncate font-mono text-[0.8125rem] font-medium tabular-nums text-zinc-900">
                        {poTotal !== null ? fmt(poTotal) : '-'}
                      </dd>
                    </div>
                  </dl>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Table ── */}
      <div className="hidden flex-1 overflow-auto md:block">
        <div className="min-w-full">
          <table className="w-full border-separate border-spacing-0">
            <thead className="z-10">
              <tr>
                <th className="sticky top-0 z-10 h-[36px] pl-4 align-middle text-left text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200 min-w-[240px]">
                  Project
                </th>
                <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-left text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200 min-w-[150px]">
                  Client
                </th>
                <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-left text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200 w-[100px]">
                  Type
                </th>
                <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-left text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200 w-[130px]">
                  Est. Value
                </th>
                <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-left text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200 w-[130px]">
                  PO Value
                </th>
                <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-left text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200 w-[120px]">
                  PO Status
                </th>
                <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-left text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200 w-[100px]">
                  Status
                </th>
                <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-left text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200 min-w-[150px]">
                  Completion
                </th>
                <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-left text-[13px] font-semibold text-zinc-700 tracking-tight w-[70px] bg-white border-b border-zinc-200">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {currentItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-16 text-center text-sm text-zinc-500">
                    No projects found
                  </td>
                </tr>
              ) : (
                currentItems.map((p, index) => {
                  const statusCfg = STATUS_CONFIG[p.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.Draft;
                  const poStatusCfg = PO_STATUS_CONFIG[p.po_status as keyof typeof PO_STATUS_CONFIG] || PO_STATUS_CONFIG.Pending;
                  const showWarning = checkPORequiredWarning(p);

                  return (
                    <tr
                      key={p.id}
                      className={`cursor-pointer transition-colors duration-150 border-l-2 border-transparent hover:border-blue-600 hover:bg-blue-50/80 group relative ${
                        openMenuId === p.id ? 'z-50' : 'z-0'
                      } ${
                        index % 2 === 0 ? 'bg-white' : 'bg-zinc-50/30'
                      }`}
                      onClick={() => loadProjectDetails(p)}
                    >
                      {/* Project */}
                      <td className="pl-4 py-3 align-middle border-t border-zinc-200/70">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-semibold text-zinc-900 hover:text-blue-600 transition-colors">
                            {p.project_name || 'Unnamed Project'}
                          </span>
                          <div className="flex items-center gap-2 flex-wrap">
                            {p.project_code && (
                              <span className="text-[0.6875rem] font-mono text-zinc-600">{p.project_code}</span>
                            )}
                            {showWarning && (
                              <span className="inline-flex items-center px-1.5 py-0.5 bg-red-50 text-red-700 rounded text-[0.6875rem] font-semibold uppercase tracking-wider">
                                ⚠ PO Required
                              </span>
                            )}
                            {atRiskMilestoneCounts[p.id] > 0 && (
                              <span 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  loadProjectDetails(p, true);
                                }}
                                className="inline-flex items-center px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded text-[0.6875rem] font-semibold uppercase tracking-wider hover:bg-amber-100 hover:text-amber-800 transition-colors cursor-pointer"
                                title="Click to view at risk milestones"
                              >
                                ⚠ {atRiskMilestoneCounts[p.id]} {atRiskMilestoneCounts[p.id] === 1 ? 'Milestone' : 'Milestones'} At Risk
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      {/* Client */}
                      <td className="px-6 py-3 align-middle text-sm text-zinc-800 border-t border-zinc-200/70">
                        <div className="max-w-[200px] truncate" title={p.client?.client_name || '-'}>
                          {p.client?.client_name || '-'}
                        </div>
                      </td>
                      {/* Type */}
                      <td className="px-6 py-3 align-middle text-sm text-zinc-800 border-t border-zinc-200/70">
                        {p.project_type || '-'}
                      </td>
                      {/* Est. Value */}
                      <td className="px-6 py-3 align-middle text-sm font-mono font-medium text-zinc-900 text-left border-t border-zinc-200/70">
                        {p.project_estimated_value ? fmt(p.project_estimated_value) : '-'}
                      </td>
                      {/* PO Value */}
                      <td className="px-6 py-3 align-middle text-sm font-mono font-medium text-zinc-900 text-left border-t border-zinc-200/70">
                        {p.pos && p.pos.length > 0 ? fmt(p.pos.reduce((sum, po) => sum + (po.po_total_value || 0), 0)) : '-'}
                      </td>
                      {/* PO Status */}
                      <td className="px-6 py-3 align-middle border-t border-zinc-200/70">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600">
                          <span className="w-2 h-2 rounded-full" style={{ background: poStatusCfg.dot }} />
                          {poStatusCfg.label}
                        </span>
                      </td>
                      {/* Status */}
                      <td className="px-6 py-3 align-middle border-t border-zinc-200/70">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600">
                          <span className="w-2 h-2 rounded-full" style={{ background: statusCfg.dot }} />
                          {statusCfg.label}
                        </span>
                      </td>
                      {/* Completion */}
                      <td className="px-6 py-3 align-middle border-t border-zinc-200/70">
                        <div className="flex items-center gap-2.5">
                          <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-blue-500 transition-all duration-500"
                              style={{ width: `${p.completion_percentage || 0}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-zinc-500 font-mono min-w-[36px] text-left">
                            {p.completion_percentage || 0}%
                          </span>
                        </div>
                      </td>
                      {/* Actions */}
                      <td className="px-5 pl-1 py-3 align-middle text-left border-t border-zinc-200/70">
                        <div className="relative inline-block" ref={openMenuId === p.id ? menuRef : null}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              menuTriggerRef.current = e.currentTarget;
                              setOpenMenuId(openMenuId === p.id ? null : p.id);
                            }}
                            aria-label={`Actions for ${p.project_name || 'project'}`}
                            aria-haspopup="menu"
                            aria-expanded={openMenuId === p.id}
                            className="relative inline-flex w-8 h-8 items-center justify-center rounded-md hover:bg-zinc-100 transition-[background-color,color,scale] duration-150 ease-out text-zinc-500 hover:text-zinc-800 active:scale-[0.96]"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                          {openMenuId === p.id && (
                            <ProjectActionMenu
                              p={p}
                              dropUp={index >= currentItems.length - 3 && index > 3}
                              onClose={() => setOpenMenuId(null)}
                              onView={() => loadProjectDetails(p)}
                              onDeleted={() => { setSelectedProject(null); queryClient.invalidateQueries({ queryKey: ['projects'] }); }}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pagination ── */}
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-zinc-200 bg-zinc-50/50 px-3 py-2 md:px-6 md:py-4">
        <div className="text-xs font-medium text-zinc-600 tabular-nums md:text-sm">
          {totalCount === 0 ? 'No projects' : `${startIndex + 1}–${endIndex} of ${totalCount}`}
          <span className="hidden md:inline"> projects</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="default" size="sm" onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            className={`flex h-11 items-center justify-center rounded-md px-3 text-sm font-medium transition-[background-color,scale] duration-150 ease-out md:h-[32px] md:min-w-[80px] md:px-4 ${
              currentPage > 1
                ? 'bg-white text-zinc-700 shadow-sm hover:bg-zinc-200 active:scale-[0.96]'
                : 'bg-zinc-50 text-zinc-400'
            }`}
          >
            Previous
          </Button>
          <div className="hidden items-center gap-1.5 sm:flex">
            {Array.from({ length: Math.max(1, Math.min(5, totalPages)) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              return (
                <Button variant="default" size="sm" key={pageNum} onClick={() => setCurrentPage(pageNum)}
                  className={`flex h-[32px] min-w-[32px] items-center justify-center rounded-md px-3 text-sm font-medium transition-[background-color,scale] duration-150 ease-out ${
                    currentPage === pageNum
                      ? 'bg-blue-600/10 text-blue-600 active:scale-[0.96]'
                      : 'bg-white text-zinc-600 hover:bg-zinc-100 active:scale-[0.96]'
                  }`}
                >
                  {pageNum}
                </Button>
              );
            })}
          </div>
          <span className="text-xs font-medium text-zinc-500 tabular-nums sm:hidden">
            {currentPage} / {totalPages}
          </span>
          <Button variant="default" size="sm" onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
            className={`flex h-11 items-center justify-center rounded-md px-3 text-sm font-medium transition-[background-color,scale] duration-150 ease-out md:h-[32px] md:min-w-[80px] md:px-4 ${
              currentPage < totalPages
                ? 'bg-white text-zinc-700 shadow-sm hover:bg-zinc-200 active:scale-[0.96]'
                : 'bg-zinc-50 text-zinc-400'
            }`}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

const checkPORequiredWarning = (p: Project) =>
  p.po_required && p.po_status !== 'Received' && p.po_status !== 'Not Required';

/**
 * Row actions, used by both the desktop table and the mobile card list.
 * Concentric radii: 12px panel = 8px items + 4px panel padding.
 */
function ProjectActionMenu({
  p,
  dropUp,
  onClose,
  onView,
  onDeleted,
}: {
  p: Project;
  dropUp: boolean;
  onClose: () => void;
  onView: () => void;
  onDeleted: () => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const deleteProject = async (id: string) => {
    // Preferred: single server-side existence check via the existing
    // can_delete_project RPC (same business rule: no POs/invoices/expenses/payments).
    const { data: canDelete, error: rpcError } = await supabase.rpc('can_delete_project', { p_id: id });
    if (rpcError) {
      // Fallback: original per-table existence checks (keeps current behaviour
      // if the RPC is unavailable).
      const [posRes, invoicesRes, expensesRes, paymentsRes] = await Promise.all([
        supabase.from('client_purchase_orders').select('id').eq('project_id', id),
        supabase.from('project_invoices').select('id').eq('project_id', id),
        supabase.from('project_expenses').select('id').eq('project_id', id),
        supabase.from('project_payments').select('id').eq('project_id', id),
      ]);
      if (
        (posRes.data?.length ?? 0) > 0 ||
        (invoicesRes.data?.length ?? 0) > 0 ||
        (expensesRes.data?.length ?? 0) > 0 ||
        (paymentsRes.data?.length ?? 0) > 0
      ) {
        alert('Cannot delete project: Related records exist');
        return;
      }
    } else if (canDelete === false) {
      alert('Cannot delete project: Related records exist');
      return;
    }
    if (!confirm('Are you sure you want to delete this project?')) return;
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) { alert('Error deleting project: ' + error.message); return; }
    queryClient.invalidateQueries({ queryKey: ['projects'] });
    onDeleted();
  };

  const itemCls =
    'flex w-full items-center gap-2 rounded-lg px-2 text-[0.8125rem] text-zinc-600 transition-[background-color,color,scale] duration-150 ease-out active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600';

  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, []);

  // Roving focus inside the menu: Tab moves out of the page, arrows move
  // between actions.
  const onMenuKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const list = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    const at = list.indexOf(document.activeElement as HTMLElement);
    const next = e.key === 'ArrowDown' ? (at + 1) % list.length : (at - 1 + list.length) % list.length;
    list[next]?.focus();
  };

  return (
    <div
      ref={panelRef}
      role="menu"
      aria-label={`Actions for ${p.project_name || 'project'}`}
      onKeyDown={onMenuKeyDown}
      className={cn(
        'absolute right-0 z-[100] w-44 animate-in fade-in-0 zoom-in-95 duration-150 rounded-xl bg-white p-1',
        dropUp ? 'bottom-full mb-1 origin-bottom-right' : 'top-full mt-1 origin-top-right'
      )}
      style={{
        boxShadow:
          '0px 0px 0px 1px oklch(0 0 0 / 0.06), 0px 4px 12px -2px oklch(0 0 0 / 0.12), 0px 12px 28px -6px oklch(0 0 0 / 0.10)',
      }}
    >
      <button
        role="menuitem"
        tabIndex={-1}
        onClick={(e) => { e.stopPropagation(); onClose(); onView(); }}
        className={cn(itemCls, 'min-h-11 hover:bg-blue-50 hover:text-blue-700')}
      >
        <Folder className="size-3.5 shrink-0" />
        View Details
      </button>
      <PermissionGuard permission="projects.update">
        <button
          role="menuitem"
          tabIndex={-1}
          onClick={(e) => { e.stopPropagation(); onClose(); navigate(`/projects/${p.id}/edit`); }}
          className={cn(itemCls, 'min-h-11 hover:bg-blue-50 hover:text-blue-700')}
        >
          <Edit className="size-3.5 shrink-0" />
          Edit
        </button>
      </PermissionGuard>

      {p.status !== 'Archived' && p.status !== 'Closed' && (
        <>
          <div className="my-1 border-t border-zinc-100" />
          <PermissionGuard permission="projects.archive">
            <button
              role="menuitem"
              tabIndex={-1}
              onClick={async (e) => {
                e.stopPropagation();
                onClose();
                if (!confirm('Archive this project?')) return;
                const { error } = await supabase.from('projects').update({ status: 'Archived' }).eq('id', p.id);
                if (error) { alert('Error: ' + error.message); return; }
                queryClient.invalidateQueries({ queryKey: ['projects'] });
              }}
              className={cn(itemCls, 'min-h-11 hover:bg-zinc-50 hover:text-zinc-700')}
            >
              <Archive className="size-3.5 shrink-0" />
              Archive
            </button>
          </PermissionGuard>
        </>
      )}

      <div className="my-1 border-t border-zinc-100" />
      <PermissionGuard permission="projects.delete">
        <button
          role="menuitem"
          tabIndex={-1}
          onClick={(e) => { e.stopPropagation(); onClose(); deleteProject(p.id); }}
          className={cn(itemCls, 'min-h-11 hover:bg-red-50 hover:text-red-700')}
        >
          <Trash2 className="size-3.5 shrink-0" />
          Delete
        </button>
      </PermissionGuard>
    </div>
  );
}
