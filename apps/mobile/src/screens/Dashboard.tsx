import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Loader2, Folder, ArrowRight, ClipboardList, LogOut,
  Check, CheckCircle2, Bell, ChevronDown, ChevronUp, Phone
} from 'lucide-react';
import { useNextActionsMobile } from '../lib/useNextActionsMobile';

interface DashboardProps {
  onLogout: () => void;
  onNavigateToApprovals: () => void;
  onNavigateToLookup: () => void;
  onOpenModule: (module: 'client' | 'project' | 'purchase') => void;
  isDemo?: boolean;
}

interface Project {
  id: string;
  project_name: string;
  name: string;
  project_code: string;
  status?: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ onLogout, onNavigateToApprovals, onNavigateToLookup, onOpenModule, isDemo = false }) => {
  const {
    nextActions,
    history: nextActionsHistory,
    isLoading: nextActionsLoading,
    refetch: refetchNextActions,
    acknowledge,
    resolve
  } = useNextActionsMobile(isDemo);

  const [loading, setLoading] = useState(true);
  const [orgName, setOrgName] = useState('');
  const [userName, setUserName] = useState('');
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [projectsCount, setProjectsCount] = useState(0);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clientCount, setClientCount] = useState(0);
  const [purchaseCount, setPurchaseCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [nextActionsFilter, setNextActionsFilter] = useState<'all' | 'overdue' | 'communication' | 'visit' | 'issue' | 'lead' | 'history'>('all');
  const [actionComments, setActionComments] = useState<Record<string, string>>({});
  const [isNextActionsCollapsed, setIsNextActionsCollapsed] = useState(true);

  const filteredNextActions = useMemo(() => {
    if (nextActionsFilter === 'history') return nextActionsHistory;
    if (nextActionsFilter === 'all') return nextActions;
    if (nextActionsFilter === 'overdue') return nextActions.filter(a => a.isOverdue);
    return nextActions.filter(a => a.source === nextActionsFilter);
  }, [nextActions, nextActionsHistory, nextActionsFilter]);

  const overdueCount = useMemo(() => nextActions.filter(a => a.isOverdue).length, [nextActions]);

  useEffect(() => {
    if (isDemo) {
      loadDemoData();
    } else {
      fetchDashboardData();
    }
  }, [isDemo]);

  const loadDemoData = () => {
    setUserName('Demo User');
    setOrgName('Demo Corp');
    setPendingApprovalsCount(3);
    setProjectsCount(2);
    setClientCount(5);
    setPurchaseCount(4);
    setProjects([
      { id: 'demo-p1', project_name: 'Metro Line Expansion', name: 'Metro Line Expansion', project_code: 'MLE-04', status: 'active' },
      { id: 'demo-p2', project_name: 'Commercial Complex B', name: 'Commercial Complex B', project_code: 'CCB-12', status: 'active' }
    ]);
    setLoading(false);
  };

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
      const [approvalsRes, projectsRes, clientsRes, purchaseRes] = await Promise.all([
        supabase
          .from('approvals')
          .select('id', { count: 'exact', head: true })
          .eq('organisation_id', userOrgId)
          .eq('status', 'PENDING'),
        supabase
          .from('projects')
          .select('id, project_name, name, project_code, status')
          .eq('organisation_id', userOrgId)
          .order('project_name'),
        supabase
          .from('clients')
          .select('id', { count: 'exact', head: true })
          .eq('organisation_id', userOrgId),
        supabase
          .from('purchase_orders')
          .select('id', { count: 'exact', head: true })
          .eq('organisation_id', userOrgId)
      ]);

      if (approvalsRes.error) throw approvalsRes.error;
      if (projectsRes.error) throw projectsRes.error;

      setPendingApprovalsCount(approvalsRes.count || 0);
      setProjectsCount(projectsRes.data?.length || 0);
      setProjects(projectsRes.data || []);
      setClientCount(clientsRes.count || 0);
      setPurchaseCount(purchaseRes.count || 0);
      refetchNextActions();

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
          <p className="text-xs font-medium text-muted-foreground uppercase">{orgName}</p>
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
          <div className="p-3 text-sm rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-center">
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
            <p className="text-sm font-medium text-muted-foreground">Pending Approvals</p>
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
            <p className="text-sm font-medium text-muted-foreground">Active Projects</p>
            <p className="text-3xl font-bold tracking-tight text-foreground mt-1 tabular-nums">
              {projectsCount}
            </p>
          </div>
        </div>

        {/* Quick Lookup Action Card */}
        <div
          onClick={onNavigateToLookup}
          className="glass-card rounded-2xl p-4 text-left cursor-pointer active:scale-[0.98] transition-all relative overflow-hidden group border border-border flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-600 dark:text-teal-400">
              <Phone className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">Quick Lookup</p>
              <p className="text-xs text-muted-foreground mt-0.5">Verify dispatch status & scope on client calls</p>
            </div>
          </div>
          <div className="text-muted-foreground group-hover:translate-x-1 transition-transform mr-1">
            <ArrowRight className="h-4 w-4" />
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* NEXT ACTIONS & FOLLOW-UPS WIDGET                                 */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="space-y-4">
          <div 
            onClick={() => setIsNextActionsCollapsed(!isNextActionsCollapsed)}
            className="flex items-center justify-between cursor-pointer p-2 rounded-xl active:bg-secondary/40 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
                <Bell className="h-4.5 w-4.5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground flex items-center gap-1.5">
                  Next Actions & Follow-ups
                  {overdueCount > 0 && (
                    <span className="inline-flex items-center bg-destructive/10 text-destructive text-xs font-bold px-2 py-0.5 rounded-full">
                      {overdueCount} Overdue
                    </span>
                  )}
                </h2>
                <p className="text-xs text-muted-foreground">Aggregated follow-ups across your active modules</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground tabular-nums">
                {nextActions.length} Total
              </span>
              <div className="text-muted-foreground">
                {isNextActionsCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </div>
            </div>
          </div>

          {!isNextActionsCollapsed && (
            <>
              {/* Scrollable Filter Tabs - Wrapped to prevent overflow */}
              <div className="flex flex-wrap gap-1.5 pb-1">
                {[
                  { key: 'all' as const, label: 'All', count: nextActions.length },
                  { key: 'overdue' as const, label: 'Overdue', count: overdueCount },
                  { key: 'communication' as const, label: 'Comms', count: nextActions.filter(a => a.source === 'communication').length },
                  { key: 'visit' as const, label: 'Visits', count: nextActions.filter(a => a.source === 'visit').length },
                  { key: 'issue' as const, label: 'Issues', count: nextActions.filter(a => a.source === 'issue').length },
                  { key: 'lead' as const, label: 'Leads', count: nextActions.filter(a => a.source === 'lead').length },
                  { key: 'history' as const, label: 'History', count: nextActionsHistory.length },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setNextActionsFilter(tab.key)}
                    className={`inline-flex items-center gap-1 px-3 py-1 text-sm font-semibold rounded-full border transition-all shrink-0 cursor-pointer ${
                      nextActionsFilter === tab.key
                        ? 'bg-primary border-primary text-white shadow-sm'
                        : 'bg-card border-border text-muted-foreground hover:text-foreground active:bg-secondary'
                    }`}
                  >
                    <span>{tab.label}</span>
                    {tab.count > 0 && (
                      <span className={`inline-flex items-center justify-center min-w-[16px] h-4 rounded-full text-xs font-bold px-1 ${
                        nextActionsFilter === tab.key
                          ? 'bg-white/25 text-white'
                          : 'bg-secondary text-muted-foreground'
                      }`}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Cards List */}
              <div className="space-y-3">
                {nextActionsLoading ? (
                  <div className="glass-card rounded-2xl p-6 flex justify-center items-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : filteredNextActions.length === 0 ? (
                  <div className="glass-card rounded-2xl p-6 text-center text-sm text-muted-foreground border border-dashed border-border">
                    {nextActionsFilter === 'history' 
                      ? 'No recently noted or resolved actions.' 
                      : nextActionsFilter === 'overdue' 
                      ? 'No overdue follow-ups!' 
                      : 'All next actions cleared!'}
                  </div>
                ) : (
                  filteredNextActions.map(item => {
                    const isComm = item.source === 'communication';
                    const raw = item.rawItem;

                    // Color configuration matching web app
                    const SOURCE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
                      communication: { bg: 'bg-blue-50/70 dark:bg-blue-900/10', text: 'text-blue-600 dark:text-blue-400', label: 'Comm Log' },
                      visit: { bg: 'bg-teal-50/70 dark:bg-teal-900/10', text: 'text-teal-600 dark:text-teal-400', label: 'Site Visit' },
                      report: { bg: 'bg-purple-50/70 dark:bg-purple-900/10', text: 'text-purple-600 dark:text-purple-400', label: 'Site Report' },
                      issue: { bg: 'bg-red-50/70 dark:bg-red-900/10', text: 'text-red-600 dark:text-red-400', label: 'Issue' },
                      lead: { bg: 'bg-green-50/70 dark:bg-green-900/10', text: 'text-green-600 dark:text-green-400', label: 'Lead' },
                    };
                    const config = SOURCE_COLORS[item.source] || { bg: 'bg-muted/70', text: 'text-muted-foreground', label: item.source };

                    // Get dynamic category label for communications
                    let displayCategory = config.label;
                    if (isComm && raw) {
                      const parts = ['Comm Log'];
                      if (raw.party_type) {
                        parts.push(raw.party_type.charAt(0).toUpperCase() + raw.party_type.slice(1).toLowerCase());
                      }
                      if (raw.call_category) {
                        parts.push(raw.call_category.charAt(0).toUpperCase() + raw.call_category.slice(1).toLowerCase());
                      }
                      displayCategory = parts.join(' • ');
                    }

                    const creatorText = item.creatorText || '';

                    return (
                      <div 
                        key={item.id} 
                        className="glass-card rounded-2xl p-4 border border-border/50 flex flex-col gap-3 transition-all"
                      >
                        <div className="flex flex-col gap-1.5">
                          {/* Badge Row */}
                          <div>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold tracking-wide uppercase border border-current/15 ${config.text} ${config.bg}`}>
                              {displayCategory}
                            </span>
                          </div>

                          {/* Next Action Title */}
                          <p className="text-base font-normal text-foreground leading-snug">
                            {item.title}
                          </p>

                          {/* Context / Subtitle */}
                          <p className="text-xs text-muted-foreground leading-normal">
                            {item.contextInfo}
                          </p>

                          {/* Metadata Row */}
                          <div className="flex flex-wrap items-center justify-between gap-1.5 pt-0.5">
                            <div className="flex items-center gap-1.5 text-xs">
                              {item.date ? (
                                <span className={item.isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                                  {item.isOverdue ? 'Overdue: ' : 'Due: '}
                                  {new Date(item.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">No due date</span>
                              )}
                              {raw?.created_at && (
                                <span className="text-muted-foreground">
                                  • Entered: {new Date(raw.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                                </span>
                              )}
                            </div>
                            {creatorText && (
                              <span className="text-xs text-muted-foreground/80 italic">
                                {creatorText}
                              </span>
                            )}
                          </div>

                          {/* History / Replies rendering */}
                          {nextActionsFilter === 'history' && raw?.replies && raw.replies.length > 0 && (
                            <div className="mt-2 p-3 bg-secondary/30 rounded-xl border border-border/50 flex flex-col gap-2">
                              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Comments & History</p>
                              <div className="flex flex-col gap-1.5">
                                {raw.replies.map((reply: any) => (
                                  <p key={reply.id} className="text-sm text-foreground/80 leading-normal">
                                    • <span className="font-medium text-foreground">{reply.call_brief}</span>
                                    <span className="text-xs text-muted-foreground ml-1.5">
                                      ({new Date(reply.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })})
                                    </span>
                                  </p>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Reply Comment input (comms active tab only) */}
                          {isComm && nextActionsFilter !== 'history' && (
                            <div className="mt-1 pt-2.5 border-t border-border/40 flex gap-2 items-center">
                              <input
                                type="text"
                                placeholder="Add reply comment note..."
                                value={actionComments[item.id] || ''}
                                onChange={(e) => setActionComments(prev => ({ ...prev, [item.id]: e.target.value }))}
                                className="flex-1 h-8 px-3 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary/50 transition-colors"
                              />
                            </div>
                          )}
                        </div>

                        {/* CTA Buttons (Hidden in History tab) */}
                        {nextActionsFilter !== 'history' && (
                          <div className="flex gap-2 border-t border-border/30 pt-3">
                            <button
                              onClick={() => {
                                acknowledge(item, actionComments[item.id]);
                                setActionComments(prev => ({ ...prev, [item.id]: '' }));
                              }}
                              className="flex-1 h-9 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:text-foreground active:bg-secondary transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              <Check className="h-4 w-4" />
                              <span>Noted</span>
                            </button>
                            {isComm && (
                              <button
                                onClick={() => {
                                  resolve(item.id, item.rawItem, actionComments[item.id]);
                                  setActionComments(prev => ({ ...prev, [item.id]: '' }));
                                }}
                                className="flex-1 h-9 rounded-xl bg-primary/10 border border-primary/20 text-sm font-semibold text-primary flex items-center justify-center gap-1.5 active:bg-primary/20 transition-colors cursor-pointer"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>Resolve</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>

        {/* Projects List */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-semibold text-foreground">Active Projects</h2>
            <span className="text-xs font-semibold bg-secondary px-2.5 py-1 rounded-full text-muted-foreground uppercase">
              {projects.length} Total
            </span>
          </div>

          <div className="space-y-3">
            {projects.length === 0 ? (
              <div className="glass-card rounded-2xl p-6 text-center text-base text-muted-foreground">
                No active projects found.
              </div>
            ) : (
              projects.map((proj) => (
                <div
                  key={proj.id}
                  className="glass-card rounded-xl p-4 flex items-center justify-between border border-border/50 hover:border-primary/30 transition-all"
                >
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-foreground">
                      {proj.project_name || proj.name || 'Unnamed Project'}
                    </p>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
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

        {/* Modules Section */}
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">Modules</h2>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => onOpenModule('client')}
              className="glass-card rounded-2xl p-4 flex flex-col items-center gap-2 text-center border border-border/50 active:scale-[0.98] transition-all cursor-pointer"
            >
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                <Phone className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold text-foreground">Client</p>
              <span className="text-xs font-bold text-muted-foreground tabular-nums">{clientCount} total</span>
            </button>
            <button
              onClick={() => onOpenModule('project')}
              className="glass-card rounded-2xl p-4 flex flex-col items-center gap-2 text-center border border-border/50 active:scale-[0.98] transition-all cursor-pointer"
            >
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Folder className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold text-foreground">Project</p>
              <span className="text-xs font-bold text-muted-foreground tabular-nums">{projectsCount} total</span>
            </button>
            <button
              onClick={() => onOpenModule('purchase')}
              className="glass-card rounded-2xl p-4 flex flex-col items-center gap-2 text-center border border-border/50 active:scale-[0.98] transition-all cursor-pointer"
            >
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                <ClipboardList className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold text-foreground">Purchase</p>
              <span className="text-xs font-bold text-muted-foreground tabular-nums">{purchaseCount} total</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};
