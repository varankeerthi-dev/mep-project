import { useState, useMemo, useRef, useEffect, lazy, Suspense } from 'react';
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
  PROJECT_STATUS_STATS,
} from '../constants';
import { fmt } from '../utils';
import { useProjects, useProjectStats } from '../hooks/useProjects';
import { Button } from '@/components/ui/button';
import { PageSkeleton } from '@/components/ui/skeleton';

// Lazy-load the heavy detail view subtree on demand
const ProjectDetailView = lazy(() => import('./ProjectDetailView'));

// ─── ProjectList ──────────────────────────────────────────────────────────────

export default function ProjectList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { organisation } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
  const [scrollToMilestones, setScrollToMilestones] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const itemsPerPage = 20;

  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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

  // 3. At-risk milestones count for list row indicator
  const { data: atRiskMilestoneCounts = {} } = useQuery<Record<string, number>>({
    queryKey: ['at-risk-milestones-count', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return {};
      const today = new Date().toISOString().split('T')[0];
      const sevenDaysLater = new Date(new Date().getTime() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('project_milestones')
        .select('project_id')
        .eq('organisation_id', organisation.id)
        .eq('is_completed', false)
        .or(`milestone_date.lt.${today},and(milestone_date.gte.${today},milestone_date.lte.${sevenDaysLater})`);
      
      if (error) throw error;
      
      const counts: Record<string, number> = {};
      (data || []).forEach((m: any) => {
        counts[m.project_id] = (counts[m.project_id] || 0) + 1;
      });
      return counts;
    },
    enabled: !!organisation?.id,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // ─── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    return {
      All: projectStats.All || 0,
      Active: projectStats.Active || 0,
      Draft: projectStats.Draft || 0,
      Closed: projectStats.Closed || 0,
    };
  }, [projectStats]);

  // ─── Pagination ─────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalCount);
  const currentItems = projects;

  const deleteProject = async (id: string) => {
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
    if (!confirm('Are you sure you want to delete this project?')) return;
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) { alert('Error deleting project: ' + error.message); return; }
    setSelectedProject(null);
    queryClient.invalidateQueries({ queryKey: ['projects'] });
  };

  const checkPORequiredWarning = (p: Project) =>
    p.po_required && p.po_status !== 'Received' && p.po_status !== 'Not Required';

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
    <div className="flex flex-col h-full min-h-[400px] max-w-[1400px] mx-auto w-full">
      {/* ── Main Header ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-medium text-zinc-900">Projects</h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600">
              {projects.length}
            </span>
          </div>
          <div className="h-4 w-px bg-zinc-200" />
          <div className="flex items-center gap-4">
            {PROJECT_STATUS_STATS.map(s => (
              <div key={s} className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mx-1">
                  {s === 'Active' ? 'Active' : s === 'Draft' ? 'Draft' : 'Closed'}
                </span>
                <span className={`text-xs font-medium mx-1 ${
                  s === 'Active' ? 'text-emerald-700' : s === 'Draft' ? 'text-zinc-700' : 'text-zinc-700'
                }`}>
                  {stats[s] || 0}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="px-4 h-[30px] w-64 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* ── Filter Row ── */}
      <div className="flex items-center justify-between px-6 border-b border-zinc-100 bg-zinc-50/50"
        style={{ paddingTop: '15px', paddingBottom: '15px' }}>
        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
          {STATUS_FILTER_OPTIONS.map((status) => (
            <button
              key={status}
              onClick={() => { setStatusFilter(status); setCurrentPage(1); }}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-all ${
                statusFilter === status
                  ? 'bg-blue-50 text-blue-600 font-semibold shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
              }`}
            >
              {status === 'All' ? 'All Projects' : status}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-[10px]">
          <PermissionGuard permission="projects.create">
            <button
              onClick={() => navigate('/projects/new')}
              className="inline-flex items-center justify-center text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors active:scale-[0.98]"
              style={{ paddingTop: '8px', paddingBottom: '8px', paddingLeft: '10px', paddingRight: '10px' }}
            >
              New Project
            </button>
          </PermissionGuard>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="flex-1 overflow-auto">
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
                              <span className="text-[11px] font-mono text-zinc-400">{p.project_code}</span>
                            )}
                            {showWarning && (
                              <span className="inline-flex items-center px-1.5 py-0.5 bg-red-50 text-red-600 rounded text-[10px] font-semibold uppercase tracking-wider">
                                ⚠ PO Required
                              </span>
                            )}
                            {atRiskMilestoneCounts[p.id] > 0 && (
                              <span 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  loadProjectDetails(p, true);
                                }}
                                className="inline-flex items-center px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded text-[10px] font-semibold uppercase tracking-wider hover:bg-amber-100 transition-colors cursor-pointer"
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
                              setOpenMenuId(openMenuId === p.id ? null : p.id);
                            }}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-zinc-100 transition-colors text-zinc-500 hover:text-zinc-800"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        {openMenuId === p.id && (
                          <div className={`absolute right-0 z-[100] w-44 rounded-lg border border-zinc-200/60 bg-white p-1 shadow-lg shadow-black/5 ${
                            index >= currentItems.length - 3 && index > 3 ? 'bottom-full mb-1' : 'top-full mt-1'
                          }`}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId(null);
                                loadProjectDetails(p);
                              }}
                              className="flex w-full items-center gap-2 rounded-md px-2 text-[12px] text-zinc-600 transition-all hover:bg-indigo-50 hover:text-indigo-700 active:scale-[0.98]"
                              style={{ padding: '6px' }}
                            >
                              <Folder className="w-3.5 h-3.5" />
                              View Details
                            </button>
                            <PermissionGuard permission="projects.update">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuId(null);
                                  navigate(`/projects/${p.id}/edit`);
                                }}
                                className="flex w-full items-center gap-2 rounded-md px-2 text-[12px] text-zinc-600 transition-all hover:bg-indigo-50 hover:text-indigo-700 active:scale-[0.98]"
                                style={{ padding: '6px' }}
                              >
                                <Edit className="w-3.5 h-3.5" />
                                Edit
                              </button>
                            </PermissionGuard>

                            <div className="my-1 border-t border-zinc-100" />

                            {p.status !== 'Archived' && p.status !== 'Closed' && (
                              <PermissionGuard permission="projects.archive">
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    setOpenMenuId(null);
                                    if (!confirm('Archive this project?')) return;
                                    const { error } = await supabase.from('projects').update({ status: 'Archived' }).eq('id', p.id);
                                    if (error) { alert('Error: ' + error.message); return; }
                                    queryClient.invalidateQueries({ queryKey: ['projects'] });
                                  }}
                                  className="flex w-full items-center gap-2 rounded-md px-2 text-[12px] text-zinc-600 transition-all hover:bg-zinc-50 hover:text-zinc-700 active:scale-[0.98]"
                                  style={{ padding: '6px' }}
                                >
                                  <Archive className="w-3.5 h-3.5" />
                                  Archive
                                </button>
                              </PermissionGuard>
                            )}

                            <div className="my-1 border-t border-zinc-100" />

                            <PermissionGuard permission="projects.delete">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuId(null);
                                  deleteProject(p.id);
                                }}
                                className="flex w-full items-center gap-2 rounded-md px-2 text-[12px] text-zinc-600 transition-all hover:bg-red-50 hover:text-red-600 active:scale-[0.98]"
                                style={{ padding: '6px' }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete
                              </button>
                            </PermissionGuard>
                          </div>
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
      <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-200 bg-zinc-50/50">
        <div className="text-sm font-medium text-zinc-600">
          Showing {totalCount === 0 ? 0 : startIndex + 1} to {endIndex} of {totalCount} projects
        </div>
        <div className="flex items-center gap-2">
          <Button variant="default" size="sm" onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors h-[32px] min-w-[80px] flex items-center justify-center ${
              currentPage > 1
                ? 'text-zinc-700 hover:bg-zinc-200 bg-white border border-zinc-200 shadow-sm'
                : 'text-zinc-400 bg-zinc-50 border border-zinc-100 cursor-not-allowed'
            }`}
          >
            Previous
          </Button>
          <div className="flex items-center gap-1.5">
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
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-colors h-[32px] min-w-[32px] flex items-center justify-center ${
                    currentPage === pageNum
                      ? 'bg-blue-600/10 text-blue-600 border border-blue-600/20 shadow-sm'
                      : 'text-zinc-600 hover:bg-zinc-100 bg-white border border-zinc-200'
                  }`}
                >
                  {pageNum}
                </Button>
              );
            })}
          </div>
          <Button variant="default" size="sm" onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors h-[32px] min-w-[80px] flex items-center justify-center ${
              currentPage < totalPages
                ? 'text-zinc-700 hover:bg-zinc-200 bg-white border border-zinc-200 shadow-sm'
                : 'text-zinc-400 bg-zinc-50 border border-zinc-100 cursor-not-allowed'
            }`}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
