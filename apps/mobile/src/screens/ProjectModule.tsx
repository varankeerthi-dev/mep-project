import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { ChevronLeft, Plus, ChevronRight } from 'lucide-react';
import { ProjectFormScreen } from './ProjectFormScreen';
import { ProjectDetailScreen } from './ProjectDetailScreen';

interface ProjectModuleProps {
  onBack: () => void;
  isDemo?: boolean;
  onFormDirtyChange?: (dirty: boolean) => void;
}

interface ProjectItem {
  id: string;
  project_name: string;
  name: string;
  project_code: string;
  status?: string;
  client_id?: string;
  project_type?: string;
  project_estimated_value?: number;
  po_required?: boolean;
  po_status?: string;
  po_number?: string;
  po_date?: string;
  start_date?: string;
  expected_end_date?: string;
  actual_end_date?: string;
  completion_percentage?: number;
  remarks?: string;
  contractor_scope?: string;
  client_scope?: string;
  excluded_scope?: string;
  pending_approval?: string;
  site_instructions?: string;
  clients?: { client_name?: string } | null;
  client?: string;
}

type View = 'active' | 'completed' | 'all';

const DEMO_PROJECTS: ProjectItem[] = [
  { id: 'p1', project_name: 'Metro Line Expansion', name: 'Metro Line Expansion', project_code: 'MLE-04', status: 'active', project_type: 'Main', project_estimated_value: 12500000, start_date: '2026-01-15', expected_end_date: '2026-09-30', completion_percentage: 62, clients: { client_name: 'Metro Rail Authority' } },
  { id: 'p2', project_name: 'Commercial Complex B', name: 'Commercial Complex B', project_code: 'CCB-12', status: 'active', project_type: 'Main', project_estimated_value: 8500000, start_date: '2026-03-01', expected_end_date: '2026-12-31', completion_percentage: 35, clients: { client_name: 'BuildIt Infra' } },
  { id: 'p3', project_name: 'Highway Flyover', name: 'Highway Flyover', project_code: 'HF-09', status: 'completed', project_type: 'Service', project_estimated_value: 4200000, start_date: '2025-06-01', actual_end_date: '2026-05-30', completion_percentage: 100, clients: { client_name: 'NHAI' } },
  { id: 'p4', project_name: 'Residential Tower C', name: 'Residential Tower C', project_code: 'RTC-21', status: 'active', project_type: 'Expansion', project_estimated_value: 3200000, start_date: '2026-04-01', expected_end_date: '2026-10-15', completion_percentage: 20, clients: { client_name: 'Prestige Estates' } },
];

const fmtStatus = (s?: string) => {
  const str = (s || '').toLowerCase();
  if (str.includes('complet')) return 'Completed';
  if (str.includes('active') || str.includes('progress') || str.includes('execution')) return 'Active';
  if (str.includes('close')) return 'Closed';
  return s || 'Active';
};

const STATUS_COLORS: Record<string, string> = {
  Active: 'bg-green-500/10 text-green-600',
  Completed: 'bg-blue-500/10 text-blue-600',
  Closed: 'bg-zinc-500/10 text-zinc-500',
};

export const ProjectModule: React.FC<ProjectModuleProps> = ({ onBack, isDemo = false, onFormDirtyChange }) => {
  const [view, setView] = useState<View>('active');
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Navigation state
  const [selectedProject, setSelectedProject] = useState<ProjectItem | null>(null);
  const [showForm, setShowForm] = useState<'new' | 'edit' | null>(null);

  useEffect(() => {
    if (isDemo) {
      setProjects(DEMO_PROJECTS);
      setLoading(false);
      return;
    }
    loadData();
  }, [isDemo]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: memberData } = await supabase
        .from('org_members')
        .select('organisation_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      const orgId = memberData?.organisation_id;
      if (!orgId) return;

      const { data, error: projErr } = await supabase
        .from('projects')
        .select('id, project_name, name, project_code, status, client_id, project_type, project_estimated_value, po_required, po_status, po_number, po_date, start_date, expected_end_date, actual_end_date, completion_percentage, remarks, contractor_scope, client_scope, excluded_scope, pending_approval, site_instructions, clients(client_name)')
        .eq('organisation_id', orgId)
        .order('project_name');

      if (projErr) throw projErr;
      setProjects((data as ProjectItem[]) || []);
    } catch (err: any) {
      console.error('Project module load error:', err);
      setError(err?.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const refreshData = () => {
    if (isDemo) return;
    loadData();
  };

  const counts = useMemo(() => ({
    active: projects.filter(p => fmtStatus(p.status) === 'Active').length,
    completed: projects.filter(p => fmtStatus(p.status) === 'Completed').length,
    all: projects.length,
  }), [projects]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = projects;
    if (view === 'active') list = list.filter(p => fmtStatus(p.status) === 'Active');
    else if (view === 'completed') list = list.filter(p => fmtStatus(p.status) === 'Completed');
    if (q) list = list.filter(p => p.project_name.toLowerCase().includes(q) || (p.project_code || '').toLowerCase().includes(q));
    return list;
  }, [projects, view, search]);

  const switchTab = (tab: View) => {
    setSearch('');
    setView(tab);
  };

  const TABS = [
    { key: 'active' as const, label: 'Active', count: counts.active },
    { key: 'completed' as const, label: 'Completed', count: counts.completed },
    { key: 'all' as const, label: 'All', count: counts.all },
  ];

  const handleFormBack = () => {
    setShowForm(null);
    refreshData();
  };

  const handleDetailBack = () => {
    setSelectedProject(null);
    refreshData();
  };

  const handleEditFromDetail = () => {
    setShowForm('edit');
  };

  // Show form
  if (showForm) {
    return (
      <ProjectFormScreen
        onBack={handleFormBack}
        projectData={showForm === 'edit' ? selectedProject : null}
        isDemo={isDemo}
        onFormDirtyChange={onFormDirtyChange}
      />
    );
  }

  // Show detail
  if (selectedProject && showForm === null) {
    return (
      <ProjectDetailScreen
        project={selectedProject}
        onBack={handleDetailBack}
        onEdit={handleEditFromDetail}
        isDemo={isDemo}
      />
    );
  }

  // Show list
  return (
    <div className="min-h-screen bg-background max-w-lg mx-auto flex flex-col">
      <motion.header
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="px-4 pt-10 pb-4 flex items-center gap-3 border-b border-border bg-card"
      >
        <button onClick={onBack} className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center text-muted-foreground active:scale-95 transition-all cursor-pointer">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold tracking-tight text-foreground">Project</h1>
        </div>
        <button
          onClick={() => setShowForm('new')}
          className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-white active:scale-95 transition-all cursor-pointer"
          title="Add Project"
        >
          <Plus className="h-5 w-5" />
        </button>
      </motion.header>

      {/* Sub-tabs */}
      <div className="flex px-4 pt-3 pb-0 bg-card border-b border-border">
        {TABS.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => switchTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
              view === key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>{label}</span>
            <span className="text-xs text-muted-foreground/70">({count})</span>
          </button>
        ))}
      </div>

      <main className="px-4 pt-5 space-y-5 flex-1 overflow-y-auto">
        {loading ? (
          <div className="glass-card rounded-2xl p-6 flex justify-center items-center">
            <span className="text-base text-muted-foreground">Loading…</span>
          </div>
        ) : error ? (
          <div className="p-3 text-sm rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-center">{error}</div>
        ) : (
          <>
            <input
              type="text"
              placeholder="Search projects by name or code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-border bg-background text-base text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary/50 transition-colors"
            />
            {filtered.length === 0 ? (
              <div className="glass-card rounded-2xl p-6 text-center text-base text-muted-foreground">No projects found.</div>
            ) : (
              <div className="space-y-2">
                {filtered.map(p => {
                  const status = fmtStatus(p.status);
                  const color = STATUS_COLORS[status] || 'bg-secondary text-muted-foreground';
                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedProject(p)}
                      className="glass-card rounded-xl p-4 flex items-center justify-between border border-border/50 active:scale-[0.99] transition-all cursor-pointer"
                    >
                      <div className="space-y-1 flex-1 min-w-0">
                        <p className="text-base font-semibold text-foreground truncate">{p.project_name || p.name || 'Unnamed Project'}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-2">
                          <span className="uppercase tracking-wider">{p.project_code || 'N/A'}</span>
                          {p.clients?.client_name && <><span>·</span><span>{p.clients.client_name}</span></>}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>{status}</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};