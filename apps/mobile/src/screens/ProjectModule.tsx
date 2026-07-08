import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { ChevronLeft, Folder, ChevronDown, MapPin } from 'lucide-react';

interface ProjectModuleProps {
  onBack: () => void;
  isDemo?: boolean;
}

interface ProjectItem {
  id: string;
  project_name: string;
  name: string;
  project_code: string;
  status?: string;
}

const TABS = [
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'all', label: 'All' },
] as const;

type TabKey = typeof TABS[number]['key'];

const DEMO_PROJECTS: ProjectItem[] = [
  { id: 'p1', project_name: 'Metro Line Expansion', name: 'Metro Line Expansion', project_code: 'MLE-04', status: 'active' },
  { id: 'p2', project_name: 'Commercial Complex B', name: 'Commercial Complex B', project_code: 'CCB-12', status: 'active' },
  { id: 'p3', project_name: 'Highway Flyover', name: 'Highway Flyover', project_code: 'HF-09', status: 'completed' },
  { id: 'p4', project_name: 'Residential Tower C', name: 'Residential Tower C', project_code: 'RTC-21', status: 'active' },
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

export const ProjectModule: React.FC<ProjectModuleProps> = ({ onBack, isDemo = false }) => {
  const [activeTab, setActiveTab] = useState<TabKey>('active');
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        .select('id, project_name, name, project_code, status')
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = projects;
    if (activeTab === 'active') list = list.filter(p => fmtStatus(p.status) === 'Active');
    else if (activeTab === 'completed') list = list.filter(p => fmtStatus(p.status) === 'Completed');
    if (q) list = list.filter(p => p.project_name.toLowerCase().includes(q) || (p.project_code || '').toLowerCase().includes(q));
    return list;
  }, [projects, activeTab, search]);

  return (
    <div className="min-h-screen bg-background max-w-lg mx-auto flex flex-col pb-24">
      <motion.header
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="px-4 pt-10 pb-4 flex items-center gap-3 border-b border-border bg-card sticky top-0 z-10"
      >
        <button onClick={onBack} className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center text-muted-foreground active:scale-95 transition-all cursor-pointer">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Project</h1>
          <p className="text-[10px] font-medium text-muted-foreground uppercase">Module</p>
        </div>
      </motion.header>

      <main className="px-4 pt-6 space-y-5 flex-1 overflow-y-auto">
        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-secondary">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === t.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              <Folder className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Search projects by name or code…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-11 px-3 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary/50 transition-colors"
        />

        {loading ? (
          <div className="glass-card rounded-2xl p-6 flex justify-center items-center">
            <span className="text-sm text-muted-foreground">Loading…</span>
          </div>
        ) : error ? (
          <div className="p-3 text-xs rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-center">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="glass-card rounded-2xl p-6 text-center text-sm text-muted-foreground">No projects found.</div>
        ) : (
          <div className="space-y-3">
            {filtered.map(p => {
              const status = fmtStatus(p.status);
              const color = STATUS_COLORS[status] || 'bg-secondary text-muted-foreground';
              return (
                <div key={p.id} className="glass-card rounded-xl border border-border/50 overflow-hidden">
                  <button
                    onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                    className="w-full p-4 flex items-center justify-between text-left active:bg-secondary/40 transition-colors"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">{p.project_name || p.name || 'Unnamed Project'}</p>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Code: {p.project_code || 'N/A'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${color}`}>{status}</span>
                      <div className={`h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-primary transition-transform ${expanded === p.id ? 'rotate-180' : ''}`}>
                        <ChevronDown className="h-4 w-4" />
                      </div>
                    </div>
                  </button>
                  {expanded === p.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="px-4 pb-4 pt-1 border-t border-border/40 space-y-1.5 text-xs"
                    >
                      <p className="text-muted-foreground flex items-center gap-1.5"><MapPin className="h-3 w-3" /> Code: {p.project_code || 'N/A'}</p>
                      <p className="text-muted-foreground">Status: <span className="font-medium text-foreground">{status}</span></p>
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};
