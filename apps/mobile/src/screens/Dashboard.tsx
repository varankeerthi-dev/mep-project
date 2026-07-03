import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, Folder, ArrowRight, ClipboardList, LogOut } from 'lucide-react';

interface DashboardProps {
  onLogout: () => void;
  onNavigateToApprovals: () => void;
}

interface Project {
  id: string;
  project_name: string;
  name: string;
  project_code: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ onLogout, onNavigateToApprovals }) => {
  const [loading, setLoading] = useState(true);
  const [orgName, setOrgName] = useState('');
  const [userName, setUserName] = useState('');
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [projectsCount, setProjectsCount] = useState(0);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        onLogout();
        return;
      }

      // Set user's metadata name
      setUserName(user.user_metadata?.full_name || user.email?.split('@')[0] || 'User');

      // 2. Resolve organisation_id
      const { data: memberData, error: memberError } = await supabase
        .from('org_members')
        .select('organisation_id, organisation:organisations(name)')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (memberError) throw memberError;

      const userOrgId = memberData?.organisation_id;
      if (!userOrgId) {
        setError('No organization associated with this account');
        setLoading(false);
        return;
      }

      setOrgName((memberData.organisation as any)?.name || 'My Organization');

      // 3. Fetch counts and projects in parallel
      const [approvalsRes, projectsRes] = await Promise.all([
        supabase
          .from('approvals')
          .select('id', { count: 'exact', head: true })
          .eq('organisation_id', userOrgId)
          .eq('status', 'PENDING'),
        supabase
          .from('projects')
          .select('id, project_name, name, project_code')
          .eq('organisation_id', userOrgId)
          .order('project_name')
      ]);

      if (approvalsRes.error) throw approvalsRes.error;
      if (projectsRes.error) throw projectsRes.error;

      setPendingApprovalsCount(approvalsRes.count || 0);
      setProjectsCount(projectsRes.data?.length || 0);
      setProjects(projectsRes.data || []);

    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      setError(err?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    onLogout();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background max-w-lg mx-auto flex flex-col pb-24">
      {/* Header */}
      <header className="px-4 pt-10 pb-4 flex justify-between items-center border-b border-border bg-card">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Welcome, {userName}!</h1>
          <p className="text-[10px] font-medium text-muted-foreground uppercase">{orgName}</p>
        </div>
        <button
          onClick={handleSignOut}
          className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center text-muted-foreground active:scale-95 transition-all cursor-pointer"
          title="Sign Out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </header>

      {/* Main Content */}
      <main className="px-4 pt-6 space-y-6 flex-1 overflow-y-auto">
        {error && (
          <div className="p-3 text-xs rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-center">
            {error}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Pending Approvals Card */}
          <div
            onClick={onNavigateToApprovals}
            className="glass-card rounded-2xl p-5 text-left cursor-pointer active:scale-[0.98] transition-all relative overflow-hidden group border border-border"
          >
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 mb-4">
              <ClipboardList className="h-5 w-5" />
            </div>
            <p className="text-xs font-medium text-muted-foreground">Pending Approvals</p>
            <p className="text-3xl font-bold tracking-tight text-foreground mt-1 tabular-nums">
              {pendingApprovalsCount}
            </p>
            <div className="absolute right-4 bottom-4 text-muted-foreground group-hover:translate-x-1 transition-transform">
              <ArrowRight className="h-4 w-4" />
            </div>
          </div>

          {/* Active Projects Card */}
          <div className="glass-card rounded-2xl p-5 text-left border border-border">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4">
              <Folder className="h-5 w-5" />
            </div>
            <p className="text-xs font-medium text-muted-foreground">Active Projects</p>
            <p className="text-3xl font-bold tracking-tight text-foreground mt-1 tabular-nums">
              {projectsCount}
            </p>
          </div>
        </div>

        {/* Projects List */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-semibold text-foreground">Active Projects</h2>
            <span className="text-[10px] font-semibold bg-secondary px-2.5 py-1 rounded-full text-muted-foreground uppercase">
              {projects.length} Total
            </span>
          </div>

          <div className="space-y-3">
            {projects.length === 0 ? (
              <div className="glass-card rounded-2xl p-6 text-center text-sm text-muted-foreground">
                No active projects found.
              </div>
            ) : (
              projects.map((proj) => (
                <div
                  key={proj.id}
                  className="glass-card rounded-xl p-4 flex items-center justify-between border border-border/50 hover:border-primary/30 transition-all"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">
                      {proj.project_name || proj.name || 'Unnamed Project'}
                    </p>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      Code: {proj.project_code || 'N/A'}
                    </p>
                  </div>
                  <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-primary">
                    <Folder className="h-4 w-4" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
