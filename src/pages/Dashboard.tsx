import { useEffect, useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from '../App';
import { useProjects } from '../hooks/useProjects';
import { format, formatDistanceToNow, isToday, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import {
  MapPin,
  CheckCircle,
  Phone,
  Calendar,
  FileText,
  Receipt,
  Truck,
  RefreshCw,
  User,
  Building2,
  Activity,
  Plus,
  MessageSquare,
  Package,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  Clock,
  Briefcase,
  DollarSign,
  AlertCircle,
} from 'lucide-react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../components/ui/table';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, StatCard } from '../components/ui/Card';
import { colors, shadows, radii, spacing, transitions } from '../design-system';

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
  const today = format(new Date(), 'yyyy-MM-dd');
  const invalidateAll = !options || Object.values(options).every(v => v === undefined || v === true);
  
  const keysToInvalidate = [
    invalidateAll || options?.todaySites ? DASHBOARD_QUERY_KEYS.todaySites(today) : null,
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
// STATUS BADGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function StatusBadge({ status }: { status: string }) {
  const s = (status || '').toLowerCase();
  
  const variants: Record<string, { bg: string; text: string; border: string }> = {
    'completed': { bg: colors.success.light, text: colors.success.dark, border: 'transparent' },
    'approved': { bg: colors.success.light, text: colors.success.dark, border: 'transparent' },
    'active': { bg: colors.success.light, text: colors.success.dark, border: 'transparent' },
    'checked_in': { bg: colors.success.light, text: colors.success.dark, border: 'transparent' },
    'pending': { bg: colors.warning.light, text: colors.warning.dark, border: 'transparent' },
    'pending approval': { bg: colors.warning.light, text: colors.warning.dark, border: 'transparent' },
    'scheduled': { bg: colors.info.light, text: colors.info.dark, border: 'transparent' },
    'draft': { bg: colors.warning.light, text: colors.warning.dark, border: 'transparent' },
    'cancelled': { bg: colors.error.light, text: colors.error.dark, border: 'transparent' },
    'rejected': { bg: colors.error.light, text: colors.error.dark, border: 'transparent' },
    'checked_out': { bg: colors.gray[100], text: colors.gray[600], border: 'transparent' },
    'absent': { bg: colors.error.light, text: colors.error.dark, border: 'transparent' },
    'on_leave': { bg: colors.priority.normal.bg, text: colors.priority.normal.text, border: 'transparent' },
    'not required': { bg: colors.gray[100], text: colors.gray[600], border: 'transparent' },
    'received': { bg: colors.success.light, text: colors.success.dark, border: 'transparent' },
    'delivered': { bg: colors.success.light, text: colors.success.dark, border: 'transparent' },
    'in transit': { bg: colors.info.light, text: colors.info.dark, border: 'transparent' },
  };

  const variant = variants[s] || { bg: colors.gray[100], text: colors.gray[600], border: 'transparent' };

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '4px 10px',
      borderRadius: radii.full,
      fontSize: '12px',
      fontWeight: 600,
      background: variant.bg,
      color: variant.text,
      border: `1px solid ${variant.border}`,
    }}>
      {status || '-'}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOADING SKELETON
// ═══════════════════════════════════════════════════════════════════════════════

function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: radii.md,
            background: `linear-gradient(135deg, ${colors.gray[100]}, ${colors.gray[200]})`,
            animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
          }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{
              height: '14px',
              borderRadius: '4px',
              background: `linear-gradient(90deg, ${colors.gray[100]}, ${colors.gray[200]})`,
              width: '75%',
              animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            }} />
            <div style={{
              height: '10px',
              borderRadius: '4px',
              background: `linear-gradient(90deg, ${colors.gray[50]}, ${colors.gray[100]})`,
              width: '50%',
              animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMPTY STATE
// ═══════════════════════════════════════════════════════════════════════════════

function EmptyState({ message, icon: Icon, color = colors.gray[400] }: { 
  message: string; 
  icon?: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>; 
  color?: string;
}) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      color: colors.gray[400],
      textAlign: 'center',
    }}>
      {Icon && <Icon size={48} strokeWidth={1.5} color={color} />}
      <p style={{ marginTop: '12px', fontSize: '14px', fontWeight: 500 }}>{message}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD CARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface DashboardCardProps {
  title: string;
  icon: React.ReactNode;
  iconColor: string;
  children: React.ReactNode;
  action?: { label: string; onClick: () => void };
}

function DashboardCard({ title, icon, iconColor, children, action }: DashboardCardProps) {
  return (
    <Card style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '20px',
        borderBottom: `1px solid ${colors.gray[100]}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: radii.md,
            background: `${iconColor}15`,
            color: iconColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {icon}
          </div>
          <CardTitle style={{ fontSize: '16px', margin: 0 }}>{title}</CardTitle>
        </div>
        {action && (
          <button
            onClick={action.onClick}
            style={{
              padding: '6px 12px',
              borderRadius: radii.sm,
              border: 'none',
              background: colors.gray[100],
              color: colors.gray[600],
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: transitions.DEFAULT,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = colors.gray[200];
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = colors.gray[100];
            }}
          >
            {action.label}
          </button>
        )}
      </div>
      <CardContent style={{ flex: 1, padding: '16px 20px', overflow: 'auto' }}>
        {children}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATS OVERVIEW - KPI CARDS
// ═══════════════════════════════════════════════════════════════════════════════

function StatsOverview() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());

  const { data: stats, isLoading } = useQuery({
    queryKey: DASHBOARD_QUERY_KEYS.stats(),
    queryFn: async () => {
      const [
        todaySitesRes,
        pendingApprovalsRes,
        monthInvoicesRes,
        activeProjectsRes,
      ] = await Promise.all([
        supabase
          .from('site_visits')
          .select('id', { count: 'exact', head: true })
          .eq('visit_date', today),
        supabase
          .from('quotation_header')
          .select('id', { count: 'exact', head: true })
          .in('status', ['Pending Approval', 'Draft']),
        supabase
          .from('project_invoices')
          .select('total_amount')
          .gte('invoice_date', format(monthStart, 'yyyy-MM-dd'))
          .lte('invoice_date', format(monthEnd, 'yyyy-MM-dd')),
        supabase
          .from('projects')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'Active'),
      ]);

      const monthRevenue = (monthInvoicesRes.data || []).reduce((sum, inv) => sum + (inv.total_amount || 0), 0);

      return {
        todaySites: todaySitesRes.count || 0,
        pendingApprovals: pendingApprovalsRes.count || 0,
        monthRevenue,
        activeProjects: activeProjectsRes.count || 0,
      };
    },
  });

  if (isLoading) {
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: spacing.lg,
        marginBottom: spacing.xl,
      }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} style={{ height: '120px' }}>
            <CardSkeleton rows={2} />
          </Card>
        ))}
      </div>
    );
  }

  const statItems = [
    {
      label: "Today's Sites",
      value: stats?.todaySites || 0,
      icon: MapPin,
      color: 'blue' as const,
      trend: { value: 12, label: 'vs yesterday' },
    },
    {
      label: 'Pending Approvals',
      value: stats?.pendingApprovals || 0,
      icon: CheckCircle,
      color: 'amber' as const,
      trend: { value: -5, label: 'vs last week' },
    },
    {
      label: 'Month Revenue',
      value: `₹${(stats?.monthRevenue || 0).toLocaleString('en-IN')}`,
      icon: DollarSign,
      color: 'green' as const,
      trend: { value: 23, label: 'vs last month' },
    },
    {
      label: 'Active Projects',
      value: stats?.activeProjects || 0,
      icon: Briefcase,
      color: 'gray' as const,
    },
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
      gap: spacing.lg,
      marginBottom: spacing.xl,
    }}>
      {statItems.map((stat, index) => (
        <StatCard
          key={index}
          icon={<stat.icon size={24} />}
          label={stat.label}
          value={stat.value}
          trend={stat.trend}
          color={stat.color}
        />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// INDIVIDUAL CARD COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function TodaySiteCard() {
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: visits = [], isLoading } = useQuery({
    queryKey: DASHBOARD_QUERY_KEYS.todaySites(today),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_visits')
        .select('id, status, purpose, visited_by, engineer, in_time, client_id')
        .eq('visit_date', today)
        .order('in_time', { ascending: true });
      if (error) throw error;
      return data || [];
    },
      });

  if (isLoading) return <CardSkeleton rows={3} />;

  if (visits.length === 0) {
    return (
      <EmptyState
        message="No site visits scheduled for today"
        icon={MapPin}
        color={colors.info.DEFAULT}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {visits.map((v: any) => (
        <div
          key={v.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            padding: '12px',
            borderRadius: radii.md,
            background: colors.gray[50],
            cursor: 'pointer',
            transition: transitions.DEFAULT,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = colors.info.light;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = colors.gray[50];
          }}
        >
          <div style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: colors.info.DEFAULT,
            flexShrink: 0,
          }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '14px', fontWeight: 600, color: colors.gray[900], margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {v.clients?.client_name || 'Unknown Client'}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
              {v.visited_by && (
                <span style={{ fontSize: '12px', color: colors.gray[500], display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <User size={12} /> {v.visited_by}
                </span>
              )}
              {v.purpose && (
                <span style={{ fontSize: '12px', color: colors.gray[400], whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {v.purpose}
                </span>
              )}
            </div>
          </div>
          <StatusBadge status={v.status} />
        </div>
      ))}
    </div>
  );
}

function ApprovalsCard() {
  const { data: pendingApprovals = [], isLoading } = useQuery({
    queryKey: DASHBOARD_QUERY_KEYS.approvals(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotation_header')
        .select('id, quotation_no, client_id, status, created_at, approval_status')
        .in('status', ['Pending Approval', 'Draft'])
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
      });

  if (isLoading) return <CardSkeleton rows={3} />;

  if (pendingApprovals.length === 0) {
    return (
      <EmptyState
        message="All caught up! No pending approvals"
        icon={CheckCircle}
        color={colors.success.DEFAULT}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {pendingApprovals.map((q: any) => (
        <div
          key={q.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px',
            borderRadius: radii.md,
            background: colors.gray[50],
            cursor: 'pointer',
            transition: transitions.DEFAULT,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = colors.success.light;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = colors.gray[50];
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ fontSize: '14px', fontWeight: 600, color: colors.gray[900], margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {q.quotation_no}
            </p>
            <p style={{ fontSize: '12px', color: colors.gray[500], margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {q.client?.client_name || '-'}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '8px' }}>
            <StatusBadge status={q.status} />
            <span style={{ fontSize: '11px', color: colors.gray[400], whiteSpace: 'nowrap' }}>
              {q.created_at ? formatDistanceToNow(parseISO(q.created_at), { addSuffix: true }) : ''}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ClientCommunicationCard() {
  const { data: comms = [], isLoading } = useQuery({
    queryKey: DASHBOARD_QUERY_KEYS.clientComms(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_communication')
        .select('id, call_entered_by, call_received_by, call_brief, created_at, client_id')
        .order('created_at', { ascending: false })
        .limit(8);
      if (error) throw error;
      return data || [];
    },
      });

  const { data: clients = [] } = useQuery({
    queryKey: DASHBOARD_QUERY_KEYS.clientsLookup(),
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id, client_name').order('client_name');
      if (error) throw error;
      return data || [];
    },
  });

  const clientMap = useMemo(() => {
    const m = new Map<string, string>();
    clients.forEach((c: any) => m.set(c.id, c.client_name));
    return m;
  }, [clients]);

  if (isLoading) return <CardSkeleton rows={4} />;

  if (comms.length === 0) {
    return (
      <EmptyState
        message="No recent client communications"
        icon={Phone}
        color={colors.gray[400]}
      />
    );
  }

  return (
    <div style={{ overflowX: 'auto', margin: '-16px -20px' }}>
      <Table>
        <TableHeader>
          <TableRow style={{ borderBottom: `1px solid ${colors.gray[200]}` }}>
            <TableHead style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: colors.gray[500], fontWeight: 600, padding: '12px 16px', background: colors.gray[50] }}>Created By</TableHead>
            <TableHead style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: colors.gray[500], fontWeight: 600, padding: '12px 16px', background: colors.gray[50] }}>Client</TableHead>
            <TableHead style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: colors.gray[500], fontWeight: 600, padding: '12px 16px', background: colors.gray[50] }}>Call Brief</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {comms.map((c: any) => (
            <TableRow 
              key={c.id} 
              style={{ 
                borderBottom: `1px solid ${colors.gray[100]}`,
                cursor: 'pointer',
                transition: transitions.DEFAULT,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = colors.gray[50];
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              <TableCell style={{ fontSize: '13px', color: colors.gray[900], padding: '12px 16px', fontWeight: 500 }}>
                {c.call_entered_by || c.call_received_by || '-'}
              </TableCell>
              <TableCell style={{ fontSize: '13px', color: colors.primary[600], fontWeight: 600, padding: '12px 16px', maxWidth: '140px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {clientMap.get(c.client_id) || '-'}
              </TableCell>
              <TableCell style={{ fontSize: '13px', color: colors.gray[600], padding: '12px 16px', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {c.call_brief || '-'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function SiteVisitPlanCard() {
  const { data: visits = [], isLoading } = useQuery({
    queryKey: DASHBOARD_QUERY_KEYS.visitPlan(),
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('site_visits')
        .select('id, visit_date, visited_by, engineer, status, client_id')
        .gte('visit_date', today)
        .in('status', ['pending', 'scheduled'])
        .order('visit_date', { ascending: true })
        .limit(8);
      if (error) throw error;
      return data || [];
    },
      });

  if (isLoading) return <CardSkeleton rows={4} />;

  if (visits.length === 0) {
    return (
      <EmptyState
        message="No upcoming site visits planned"
        icon={Calendar}
        color={colors.warning.DEFAULT}
      />
    );
  }

  return (
    <div style={{ overflowX: 'auto', margin: '-16px -20px' }}>
      <Table>
        <TableHeader>
          <TableRow style={{ borderBottom: `1px solid ${colors.gray[200]}` }}>
            <TableHead style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: colors.gray[500], fontWeight: 600, padding: '12px 16px', background: colors.gray[50] }}>Date</TableHead>
            <TableHead style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: colors.gray[500], fontWeight: 600, padding: '12px 16px', background: colors.gray[50] }}>Client</TableHead>
            <TableHead style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: colors.gray[500], fontWeight: 600, padding: '12px 16px', background: colors.gray[50] }}>Visit By</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visits.map((v: any) => (
            <TableRow 
              key={v.id} 
              style={{ 
                borderBottom: `1px solid ${colors.gray[100]}`,
                cursor: 'pointer',
                transition: transitions.DEFAULT,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = colors.warning.light;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              <TableCell style={{ fontSize: '13px', padding: '12px 16px', whiteSpace: 'nowrap' }}>
                <span style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px',
                  color: isToday(parseISO(v.visit_date)) ? colors.warning.dark : colors.gray[600],
                  fontWeight: isToday(parseISO(v.visit_date)) ? 600 : 400,
                }}>
                  <Calendar size={14} color={isToday(parseISO(v.visit_date)) ? colors.warning.DEFAULT : colors.gray[400]} />
                  {isToday(parseISO(v.visit_date)) ? 'Today' : format(parseISO(v.visit_date), 'dd MMM yyyy')}
                </span>
              </TableCell>
              <TableCell style={{ fontSize: '13px', fontWeight: 600, color: colors.gray[900], padding: '12px 16px', maxWidth: '140px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {v.clients?.client_name || '-'}
              </TableCell>
              <TableCell style={{ fontSize: '13px', color: colors.gray[600], padding: '12px 16px' }}>
                {v.visited_by || v.engineer || '-'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function QuotationApprovalCard() {
  const { data: quotations = [], isLoading } = useQuery({
    queryKey: DASHBOARD_QUERY_KEYS.quotationApproval(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotation_header')
        .select('id, quotation_no, status, client_id, created_at, approval_status')
        .in('status', ['Pending Approval', 'Approved', 'Rejected'])
        .order('created_at', { ascending: false })
        .limit(8);
      if (error) throw error;
      return data || [];
    },
      });

  if (isLoading) return <CardSkeleton rows={3} />;

  if (quotations.length === 0) {
    return (
      <EmptyState
        message="No quotation approvals pending"
        icon={FileText}
        color={colors.gray[400]}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {quotations.map((q: any) => (
        <div
          key={q.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px',
            borderRadius: radii.md,
            background: colors.gray[50],
            cursor: 'pointer',
            transition: transitions.DEFAULT,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = colors.primary[50];
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = colors.gray[50];
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ fontSize: '14px', fontWeight: 600, color: colors.gray[900], margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {q.quotation_no}
            </p>
            <p style={{ fontSize: '12px', color: colors.gray[500], margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {q.client?.client_name || '-'}
            </p>
          </div>
          <StatusBadge status={q.approval_status || q.status} />
        </div>
      ))}
    </div>
  );
}

function InvoiceCard() {
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: DASHBOARD_QUERY_KEYS.invoices(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_invoices')
        .select('id, invoice_number, total_amount, invoice_date, project:project_id(project_name)')
        .order('invoice_date', { ascending: false })
        .limit(8);
      if (error) throw error;
      return data || [];
    },
      });

  if (isLoading) return <CardSkeleton rows={3} />;

  if (invoices.length === 0) {
    return (
      <EmptyState
        message="No recent invoices"
        icon={Receipt}
        color={colors.gray[400]}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {invoices.map((inv: any) => (
        <div
          key={inv.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px',
            borderRadius: radii.md,
            background: colors.gray[50],
            cursor: 'pointer',
            transition: transitions.DEFAULT,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = colors.primary[50];
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = colors.gray[50];
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ fontSize: '14px', fontWeight: 600, color: colors.gray[900], margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {inv.invoice_number || `INV-${inv.id?.slice(0, 6)}`}
            </p>
            <p style={{ fontSize: '12px', color: colors.gray[500], margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {inv.project?.project_name || '-'}
            </p>
          </div>
          <div style={{ textAlign: 'right', marginLeft: '12px' }}>
            {inv.total_amount && (
              <p style={{ fontSize: '14px', fontWeight: 700, color: colors.gray[900], margin: 0 }}>
                ₹{Number(inv.total_amount).toLocaleString('en-IN')}
              </p>
            )}
            <p style={{ fontSize: '11px', color: colors.gray[400], margin: 0 }}>
              {inv.invoice_date ? format(parseISO(inv.invoice_date), 'dd MMM yyyy') : ''}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function DeliveryChallanCard() {
  const { data: challans = [], isLoading } = useQuery({
    queryKey: DASHBOARD_QUERY_KEYS.deliveryChallans(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_challans')
        .select('id, dc_number, dc_date, client_name, status, vehicle_number, created_at')
        .order('created_at', { ascending: false })
        .limit(8);
      if (error) throw error;
      return data || [];
    },
      });

  if (isLoading) return <CardSkeleton rows={3} />;

  if (challans.length === 0) {
    return (
      <EmptyState
        message="No recent delivery challans"
        icon={Truck}
        color={colors.gray[400]}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {challans.map((dc: any) => (
        <div
          key={dc.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px',
            borderRadius: radii.md,
            background: colors.gray[50],
            cursor: 'pointer',
            transition: transitions.DEFAULT,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = colors.info.light;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = colors.gray[50];
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ fontSize: '14px', fontWeight: 600, color: colors.gray[900], margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {dc.dc_number}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <span style={{ fontSize: '12px', color: colors.gray[500], whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {dc.client_name || '-'}
              </span>
              {dc.vehicle_number && (
                <span style={{ fontSize: '11px', color: colors.info.DEFAULT, background: colors.info.light, padding: '2px 8px', borderRadius: radii.full, fontWeight: 500 }}>
                  {dc.vehicle_number}
                </span>
              )}
            </div>
          </div>
          <StatusBadge status={dc.status} />
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RECENT ACTIVITY (RIGHT SIDEBAR)
// ═══════════════════════════════════════════════════════════════════════════════

function RecentUpdates() {
  const { data: recentItems = [], isLoading } = useQuery({
    queryKey: DASHBOARD_QUERY_KEYS.recentUpdates(),
    queryFn: async () => {
      const [commsRes, visitsRes, dcRes, quotesRes] = await Promise.all([
        supabase
          .from('client_communication')
          .select('id, call_brief, call_category, created_at, client_id')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('site_visits')
          .select('id, visit_date, visited_by, status, created_at, client_id')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('delivery_challans')
          .select('id, dc_number, client_name, status, created_at')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('quotation_header')
          .select('id, quotation_no, status, created_at, client_id')
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      const items: any[] = [];

      (commsRes.data || []).forEach((c: any) =>
        items.push({ id: c.id, type: 'communication', text: c.call_brief || 'New communication', time: c.created_at, icon: MessageSquare, color: colors.primary[500], bgColor: colors.primary[50] })
      );
      (visitsRes.data || []).forEach((v: any) =>
        items.push({ id: v.id, type: 'visit', text: `Visit: ${(v as any).clients?.client_name || 'Client'}`, time: v.created_at, icon: MapPin, color: colors.info.DEFAULT, bgColor: colors.info.light })
      );
      (dcRes.data || []).forEach((d: any) =>
        items.push({ id: d.id, type: 'dc', text: `DC: ${d.dc_number || d.client_name}`, time: d.created_at, icon: Truck, color: colors.info.DEFAULT, bgColor: colors.info.light })
      );
      (quotesRes.data || []).forEach((q: any) =>
        items.push({ id: q.id, type: 'quotation', text: `Quote: ${q.quotation_no}`, time: q.created_at, icon: FileText, color: colors.primary[500], bgColor: colors.primary[50], status: q.status })
      );

      items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      return items.slice(0, 20);
    },
      });

  return (
    <Card style={{ height: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column' }}>
      <CardHeader style={{ borderBottom: `1px solid ${colors.gray[100]}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: radii.md,
            background: `linear-gradient(135deg, ${colors.gray[700]}, ${colors.gray[900]})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Activity size={20} color="white" />
          </div>
          <div>
            <CardTitle style={{ fontSize: '16px', margin: 0 }}>Recent Activity</CardTitle>
            <CardDescription style={{ fontSize: '12px', margin: 0 }}>Activity across all modules</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {isLoading ? (
          <CardSkeleton rows={8} />
        ) : recentItems.length === 0 ? (
          <EmptyState message="No recent activity" icon={Activity} color={colors.gray[400]} />
        ) : (
          <div style={{ position: 'relative' }}>
            <div style={{
              position: 'absolute',
              left: '20px',
              top: '12px',
              bottom: '12px',
              width: '2px',
              background: `linear-gradient(to bottom, ${colors.gray[200]}, ${colors.gray[300]}, ${colors.gray[200]})`,
              borderRadius: '1px',
            }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {recentItems.map((item: any, i: number) => {
                const Icon = item.icon;
                return (
                  <div
                    key={`${item.type}-${item.id}-${i}`}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '16px',
                      padding: '12px',
                      borderRadius: radii.md,
                      cursor: 'pointer',
                      transition: transitions.DEFAULT,
                      position: 'relative',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = colors.gray[50];
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: radii.md,
                      background: item.bgColor,
                      color: item.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      zIndex: 1,
                      border: `2px solid white`,
                      boxShadow: shadows.sm,
                    }}>
                      <Icon size={18} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0, paddingTop: '4px' }}>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: colors.gray[900], margin: 0, lineHeight: 1.4 }}>
                        {item.text}
                      </p>
                      <p style={{ fontSize: '11px', color: colors.gray[400], margin: '4px 0 0' }}>
                        {item.time ? formatDistanceToNow(parseISO(item.time), { addSuffix: true }) : ''}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function Dashboard({ onNavigate }: { onNavigate?: (path: string) => void }) {
  const { user, organisation } = useAuth();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    invalidateDashboardQueries(queryClient);
    setTimeout(() => setIsRefreshing(false), 500);
  }, [queryClient]);

  return (
    <div style={{ minHeight: '100vh', background: colors.gray[50] }}>
      {/* Header */}
      <div style={{
        background: 'white',
        borderBottom: `1px solid ${colors.gray[200]}`,
        position: 'sticky',
        top: 0,
        zIndex: 30,
        boxShadow: shadows.sm,
      }}>
        <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: 700, color: colors.gray[900], margin: 0, letterSpacing: '-0.02em' }}>
                Dashboard
              </h1>
              <p style={{ fontSize: '14px', color: colors.gray[500], margin: '4px 0 0', fontWeight: 500 }}>
                {format(new Date(), 'EEEE, dd MMMM yyyy')}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: colors.gray[700],
                  background: 'white',
                  border: `1px solid ${colors.gray[300]}`,
                  borderRadius: radii.md,
                  cursor: isRefreshing ? 'not-allowed' : 'pointer',
                  transition: transitions.DEFAULT,
                  opacity: isRefreshing ? 0.5 : 1,
                  boxShadow: shadows.sm,
                }}
                onMouseEnter={(e) => {
                  if (!isRefreshing) {
                    e.currentTarget.style.background = colors.gray[50];
                    e.currentTarget.style.borderColor = colors.gray[400];
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'white';
                  e.currentTarget.style.borderColor = colors.gray[300];
                }}
              >
                <RefreshCw size={16} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
                Refresh
              </button>
              {onNavigate && (
                <>
                  <button
                    onClick={() => onNavigate('/dc/create')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 18px',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: 'white',
                      background: colors.gray[900],
                      border: 'none',
                      borderRadius: radii.md,
                      cursor: 'pointer',
                      transition: transitions.DEFAULT,
                      boxShadow: shadows.md,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = colors.gray[800];
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = colors.gray[900];
                    }}
                  >
                    <Plus size={16} />
                    Create DC
                  </button>
                  <button
                    onClick={() => onNavigate('/clients/new')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 18px',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: colors.gray[700],
                      background: 'white',
                      border: `2px solid ${colors.gray[200]}`,
                      borderRadius: radii.md,
                      cursor: 'pointer',
                      transition: transitions.DEFAULT,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = colors.gray[300];
                      e.currentTarget.style.background = colors.gray[50];
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = colors.gray[200];
                      e.currentTarget.style.background = 'white';
                    }}
                  >
                    <Building2 size={16} />
                    Add Client
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '24px' }}>
        {/* Stats Overview */}
        <StatsOverview />

        {/* Dashboard Grid */}
        <div style={{ display: 'flex', gap: '24px' }}>
          {/* Left Column - Main Cards */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '20px',
            }}>
              {/* Row 1: Today's Site, Approvals, Client Communication */}
              <DashboardCard
                title="Today's Sites"
                icon={<MapPin size={20} />}
                iconColor={colors.info.DEFAULT}
                action={{ label: 'View All', onClick: () => onNavigate?.('/site-visits') }}
              >
                <TodaySiteCard />
              </DashboardCard>

              <DashboardCard
                title="Pending Approvals"
                icon={<CheckCircle size={20} />}
                iconColor={colors.success.DEFAULT}
                action={{ label: 'Review', onClick: () => onNavigate?.('/approvals') }}
              >
                <ApprovalsCard />
              </DashboardCard>

              <DashboardCard
                title="Client Communication"
                icon={<Phone size={20} />}
                iconColor={colors.primary[500]}
              >
                <ClientCommunicationCard />
              </DashboardCard>

              {/* Row 2: Site Visit Plan, Quotation Approval */}
              <DashboardCard
                title="Site Visit Plan"
                icon={<Calendar size={20} />}
                iconColor={colors.warning.DEFAULT}
              >
                <SiteVisitPlanCard />
              </DashboardCard>

              <DashboardCard
                title="Quotation Approvals"
                icon={<FileText size={20} />}
                iconColor={colors.primary[500]}
              >
                <QuotationApprovalCard />
              </DashboardCard>

              {/* Row 3: Invoices, Delivery Challans */}
              <DashboardCard
                title="Recent Invoices"
                icon={<Receipt size={20} />}
                iconColor={colors.primary[500]}
              >
                <InvoiceCard />
              </DashboardCard>

              <DashboardCard
                title="Delivery Challans"
                icon={<Truck size={20} />}
                iconColor={colors.info.DEFAULT}
              >
                <DeliveryChallanCard />
              </DashboardCard>
            </div>
          </div>

          {/* Right Column - Activity Feed */}
          <div style={{ width: '360px', flexShrink: 0, display: 'none' }} className="show-on-lg">
            <div style={{ position: 'sticky', top: '100px' }}>
              <RecentUpdates />
            </div>
          </div>
        </div>

        {/* Mobile Activity Feed */}
        <div style={{ marginTop: '24px' }} className="hide-on-lg">
          <RecentUpdates />
        </div>
      </div>
    </div>
  );
}
