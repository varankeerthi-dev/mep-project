import { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from '../App';
import { useProjects } from '../hooks/useProjects';
import { useNextActions } from '../hooks/useNextActions';
import { colors, shadows, transitions } from '../design-system';
import {
  DashboardHeader,
  StatsRow,
  NextActionsWidget,
  ModuleCards,
  WarrantyClaimsSLA,
  ContinuousImprovementCenter,
} from '../components/dashboard';

// Dashboard query keys for React Query caching
export const DASHBOARD_QUERY_KEYS = {
  todaySites: (date: string) => ['dashboard-today-sites', date] as const,
  approvals: () => ['dashboard-approvals'] as const,
  clientComms: () => ['dashboard-client-comms'] as const,
  clientsLookup: () => ['dashboard-clients-lookup'] as const,
  visitPlan: () => ['dashboard-visit-plan'] as const,
  quotationApproval: () => ['dashboard-quotation-approval'] as const,
  invoices: () => ['dashboard-invoices'] as const,
  deliveryChallans: () => ['dashboard-delivery-challans'] as const,
  recentUpdates: () => ['dashboard-recent-updates'] as const,
  stats: () => ['dashboard-stats'] as const,
  all: () => ['dashboard'] as const,
} as const;

export function invalidateDashboardQueries(queryClient: ReturnType<typeof useQueryClient>, options?: {
  todaySites?: boolean;
  approvals?: boolean;
  clientComms?: boolean;
  visitPlan?: boolean;
  quotationApproval?: boolean;
  invoices?: boolean;
  deliveryChallans?: boolean;
  recentUpdates?: boolean;
  stats?: boolean;
}) {
  const invalidateAll = !options || Object.values(options).every(v => v === undefined || v === true);
  
  const keysToInvalidate = [
    invalidateAll || options?.todaySites ? DASHBOARD_QUERY_KEYS.todaySites(new Date().toISOString().split('T')[0]) : null,
    invalidateAll || options?.approvals ? DASHBOARD_QUERY_KEYS.approvals() : null,
    invalidateAll || options?.clientComms ? DASHBOARD_QUERY_KEYS.clientComms() : null,
    invalidateAll || options?.visitPlan ? DASHBOARD_QUERY_KEYS.visitPlan() : null,
    invalidateAll || options?.quotationApproval ? DASHBOARD_QUERY_KEYS.quotationApproval() : null,
    invalidateAll || options?.invoices ? DASHBOARD_QUERY_KEYS.invoices() : null,
    invalidateAll || options?.deliveryChallans ? DASHBOARD_QUERY_KEYS.deliveryChallans() : null,
    invalidateAll || options?.recentUpdates ? DASHBOARD_QUERY_KEYS.recentUpdates() : null,
    invalidateAll || options?.stats ? DASHBOARD_QUERY_KEYS.stats() : null,
  ].filter(Boolean);

  queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEYS.all() });
  keysToInvalidate.forEach(key => {
    if (key) queryClient.invalidateQueries({ queryKey: key });
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function Dashboard({ onNavigate }: { onNavigate?: (path: string) => void }) {
  const { user, organisation, organisations } = useAuth();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: projects = [], isLoading: projectsLoading } = useProjects();

  const { data: warrantyClaims = [], isLoading: claimsLoading, refetch: refetchClaims } = useQuery({
    queryKey: ['dashboard-warranty-claims', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase
        .from('warranty_claims')
        .select('*, equipment:project_equipment(*, project:projects(*))')
        .eq('organisation_id', organisation.id)
        .neq('status', 'Resolved')
        .order('sla_due_date', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id,
  });

  const claimsStats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const today = new Date(todayStr);

    let overdueCount = 0;
    let criticalCount = 0;
    let pendingCount = 0;

    const claimsWithDays = warrantyClaims.map((claim: any) => {
      if (!claim.sla_due_date) {
        pendingCount++;
        return { ...claim, daysRemaining: null, slaStatus: 'no_sla' };
      }

      const dueDate = new Date(claim.sla_due_date);
      const diffTime = dueDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let slaStatus = 'safe';
      if (diffDays < 0) {
        slaStatus = 'overdue';
        overdueCount++;
      } else if (diffDays <= 3) {
        slaStatus = 'critical';
        criticalCount++;
      } else {
        pendingCount++;
      }

      return { ...claim, daysRemaining: diffDays, slaStatus };
    });

    return {
      claims: claimsWithDays,
      totalActive: warrantyClaims.length,
      overdueCount,
      criticalCount,
      pendingCount
    };
  }, [warrantyClaims]);

  // Continuous Improvement Center Queries
  const { data: insights = [], isLoading: insightsLoading, refetch: refetchInsights } = useQuery({
    queryKey: ['dashboard-project-insights', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase
        .from('project_insights')
        .select('*')
        .eq('organisation_id', organisation.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['dashboard-user-profiles-v2', organisation?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('user_id, full_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id,
  });

  const userRole = useMemo(() => {
    const currentMember = organisations?.find(o => o.organisation_id === organisation?.id || o.organisation?.id === organisation?.id);
    return currentMember?.role || '';
  }, [organisations, organisation]);

  const isPrivileged = useMemo(() => {
    return ['Project Manager', 'Admin'].includes(userRole);
  }, [userRole]);

  const isManagerOrAdminOrCEO = useMemo(() => {
    return ['Project Manager', 'Admin', 'CEO'].includes(userRole) || 
      userRole.toLowerCase().includes('ceo') || 
      userRole.toLowerCase().includes('manager') || 
      userRole.toLowerCase().includes('admin');
  }, [userRole]);

  const filteredInsights = useMemo(() => {
    return insights.filter((item: any) => {
      if (item.visibility === 'Leadership') {
        return userRole === 'Admin';
      }
      if (item.visibility === 'Managers') {
        return ['Project Manager', 'Admin'].includes(userRole);
      }
      return true;
    });
  }, [insights, userRole]);

  const openOpportunitiesCount = useMemo(() => {
    return filteredInsights.filter((i: any) => i.status !== 'Closed' && i.category === 'Improvement Opportunity').length;
  }, [filteredInsights]);

  const criticalCoordinationCount = useMemo(() => {
    return filteredInsights.filter((i: any) => i.status !== 'Closed' && i.category === 'Coordination Issue' && i.impact_level === 'Critical').length;
  }, [filteredInsights]);

  const bestPracticesCount = useMemo(() => {
    return filteredInsights.filter((i: any) => i.category === 'Best Practice').length;
  }, [filteredInsights]);

  const costSavingsSum = useMemo(() => {
    return filteredInsights
      .filter((i: any) => i.category === 'Cost Saving Idea')
      .reduce((sum: number, i: any) => sum + (parseFloat(i.estimated_loss_amount) || 0), 0);
  }, [filteredInsights]);

  const resolvedThisMonthCount = useMemo(() => {
    return filteredInsights.filter((i: any) => {
      if (i.status !== 'Closed' || !i.resolved_at) return false;
      const resDate = new Date(i.resolved_at);
      const now = new Date();
      return resDate.getMonth() === now.getMonth() && resDate.getFullYear() === now.getFullYear();
    }).length;
  }, [filteredInsights]);

  const topRepeatedIssues = useMemo(() => {
    return filteredInsights
      .filter((i: any) => i.is_repeat_issue)
      .sort((a, b) => (b.repeat_issue_count || 0) - (a.repeat_issue_count || 0))
      .slice(0, 5);
  }, [filteredInsights]);

  const topRootCauses = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredInsights.forEach((i: any) => {
      if (i.root_cause) {
        counts[i.root_cause] = (counts[i.root_cause] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [filteredInsights]);

  const lossByImpactType = useMemo(() => {
    const totals: Record<string, number> = {
      'Cost': 0,
      'Time': 0,
      'Quality': 0,
      'Safety': 0,
      'Customer Satisfaction': 0
    };
    filteredInsights.forEach((i: any) => {
      if (i.impact_type && i.estimated_loss_amount) {
        totals[i.impact_type] = (totals[i.impact_type] || 0) + parseFloat(i.estimated_loss_amount);
      }
    });
    return Object.entries(totals)
      .map(([name, amount]) => ({ name, amount }))
      .filter(item => item.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  }, [filteredInsights]);

  const openActionItems = useMemo(() => {
    return filteredInsights.filter((i: any) => i.status !== 'Closed').slice(0, 10);
  }, [filteredInsights]);

  const projectMap = useMemo(() => {
    const map = new Map<string, string>();
    projects.forEach((p: any) => {
      map.set(p.id, p.project_name || p.name || 'Unnamed Project');
    });
    return map;
  }, [projects]);

  const userMap = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((u: any) => {
      map.set(u.user_id, u.full_name || 'Unassigned');
    });
    return map;
  }, [users]);

  // ═══════════════════════════════════════════════════════════════════════════
  // UNIFIED NEXT ACTIONS HOOK
  // ═══════════════════════════════════════════════════════════════════════════
  const {
    nextActions,
    nextActionsHistory,
    isLoading: nextActionsLoading,
    refetch: refetchNextActions,
    acknowledge,
    isAcknowledging,
    resolve,
    isResolving
  } = useNextActions();

  const overdueCount = useMemo(() => nextActions.filter(a => a.isOverdue).length, [nextActions]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    invalidateDashboardQueries(queryClient);
    refetchClaims();
    refetchInsights();
    refetchNextActions();
    setTimeout(() => setIsRefreshing(false), 500);
  }, [queryClient, refetchClaims, refetchInsights, refetchNextActions]);

  return (
    <div style={{ minHeight: '100vh', background: colors.gray[50] }}>
      <DashboardHeader isRefreshing={isRefreshing} onRefresh={handleRefresh} onNavigate={onNavigate} />

      {/* Main Content */}
      <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Stats Summary Grid */}
        <StatsRow
          projectsLoading={projectsLoading}
          projectsCount={projects.length}
          claimsLoading={claimsLoading}
          claimsStats={claimsStats}
        />

        {/* Next Actions & Follow-ups Widget */}
        <NextActionsWidget
          nextActions={nextActions}
          nextActionsHistory={nextActionsHistory}
          isLoading={nextActionsLoading}
          overdueCount={overdueCount}
          acknowledge={acknowledge}
          isAcknowledging={isAcknowledging}
          resolve={resolve}
          isResolving={isResolving}
          onNavigate={onNavigate}
          userMap={userMap}
        />

        {/* 2-Column Section */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 7fr) minmax(0, 5fr)', gap: '24px', alignItems: 'start' }}>
          
          {/* Left Column: Module Cards */}
          <ModuleCards onNavigate={onNavigate} />

          {/* Right Column: Warranty Claims SLA */}
          <WarrantyClaimsSLA
            claimsLoading={claimsLoading}
            claimsStats={claimsStats}
            onNavigate={onNavigate}
          />

        </div>

        {/* Continuous Improvement Center (role-gated) */}
        {isManagerOrAdminOrCEO && (
          <ContinuousImprovementCenter
            insightsLoading={insightsLoading}
            openOpportunitiesCount={openOpportunitiesCount}
            criticalCoordinationCount={criticalCoordinationCount}
            bestPracticesCount={bestPracticesCount}
            costSavingsSum={costSavingsSum}
            resolvedThisMonthCount={resolvedThisMonthCount}
            topRepeatedIssues={topRepeatedIssues}
            topRootCauses={topRootCauses}
            filteredInsightsCount={filteredInsights.filter((i: any) => i.root_cause).length}
            lossByImpactType={lossByImpactType}
            isPrivileged={isPrivileged}
            openActionItems={openActionItems}
            projectMap={projectMap}
            userMap={userMap}
            onNavigate={onNavigate}
          />
        )}

      </div>
    </div>
  );
}
