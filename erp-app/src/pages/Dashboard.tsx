import { useEffect, useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from '../App';
import { useProjects } from '../hooks/useProjects';
// import { format, formatDistanceToNow, isToday, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import {
  RefreshCw,
  Plus,
  Building2,
  AlertTriangle,
  Clock,
  ShieldAlert,
  Wrench,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  Calendar,
  FileText,
  TrendingDown,
  Lock,
  BarChart3,
} from 'lucide-react';
// import {
//   Table,
//   TableHeader,
//   TableBody,
//   TableRow,
//   TableHead,
//   TableCell,
// } from '../components/ui/table';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, StatCard } from '../components/ui/Card';
import { colors, shadows, radii, spacing, transitions } from '../design-system';

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
  const today = new Date().toISOString().split('T')[0];
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

// function StatusBadge({ status }: { status: string }) {
//   const s = (status || '').toLowerCase();
  
//   const variants: Record<string, { bg: string; text: string; border: string }> = {
//     'completed': { bg: colors.success.light, text: colors.success.dark, border: 'transparent' },
//     'approved': { bg: colors.success.light, text: colors.success.dark, border: 'transparent' },
//     'active': { bg: colors.success.light, text: colors.success.dark, border: 'transparent' },
//     'checked_in': { bg: colors.success.light, text: colors.success.dark, border: 'transparent' },
//     'pending': { bg: colors.warning.light, text: colors.warning.dark, border: 'transparent' },
//     'pending approval': { bg: colors.warning.light, text: colors.warning.dark, border: 'transparent' },
//     'scheduled': { bg: colors.info.light, text: colors.info.dark, border: 'transparent' },
//     'draft': { bg: colors.warning.light, text: colors.warning.dark, border: 'transparent' },
//     'cancelled': { bg: colors.error.light, text: colors.error.dark, border: 'transparent' },
//     'rejected': { bg: colors.error.light, text: colors.error.dark, border: 'transparent' },
//     'checked_out': { bg: colors.gray[100], text: colors.gray[600], border: 'transparent' },
//     'absent': { bg: colors.error.light, text: colors.error.dark, border: 'transparent' },
//     'on_leave': { bg: colors.priority.normal.bg, text: colors.priority.normal.text, border: 'transparent' },
//     'not required': { bg: colors.gray[100], text: colors.gray[600], border: 'transparent' },
//     'received': { bg: colors.success.light, text: colors.success.dark, border: 'transparent' },
//     'delivered': { bg: colors.success.light, text: colors.success.dark, border: 'transparent' },
//     'in transit': { bg: colors.info.light, text: colors.info.dark, border: 'transparent' },
//   };

//   const variant = variants[s] || { bg: colors.gray[100], text: colors.gray[600], border: 'transparent' };

//   return (
//     <span style={{
//       display: 'inline-flex',
//       alignItems: 'center',
//       padding: '4px 10px',
//       borderRadius: radii.full,
//       fontSize: '12px',
//       fontWeight: 600,
//       background: variant.bg,
//       color: variant.text,
//       border: `1px solid ${variant.border}`,
//     }}>
//       {status || '-'}
//     </span>
//   );
// }

// ═══════════════════════════════════════════════════════════════════════════════
// LOADING SKELETON
// ═══════════════════════════════════════════════════════════════════════════════

// function CardSkeleton({ rows = 3 }: { rows?: number }) {
//   return (
//     <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
//       {Array.from({ length: rows }).map((_, i) => (
//         <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
//           <div style={{
//             width: '40px',
//             height: '40px',
//             borderRadius: radii.md,
//             background: `linear-gradient(135deg, ${colors.gray[100]}, ${colors.gray[200]})`,
//             animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
//           }} />
//           <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
//             <div style={{
//               height: '14px',
//               borderRadius: '4px',
//               background: `linear-gradient(90deg, ${colors.gray[100]}, ${colors.gray[200]})`,
//               width: '75%',
//               animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
//             }} />
//             <div style={{
//               height: '10px',
//               borderRadius: '4px',
//               background: `linear-gradient(90deg, ${colors.gray[50]}, ${colors.gray[100]})`,
//               width: '50%',
//               animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
//             }} />
//           </div>
//         </div>
//       ))}
//     </div>
//   );
// }

// ═══════════════════════════════════════════════════════════════════════════════
// EMPTY STATE
// ═══════════════════════════════════════════════════════════════════════════════

// function EmptyState({ message, icon: Icon, color = colors.gray[400] }: { 
//   message: string; 
//   icon?: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>; 
//   color?: string;
// }) {
//   return (
//     <div style={{
//       display: 'flex',
//       flexDirection: 'column',
//       alignItems: 'center',
//       justifyContent: 'center',
//       padding: '40px 20px',
//       color: colors.gray[400],
//       textAlign: 'center',
//     }}>
//       {Icon && <Icon size={48} strokeWidth={1.5} color={color} />}
//       <p style={{ marginTop: '12px', fontSize: '14px', fontWeight: 500 }}>{message}</p>
//     </div>
//   );
// }

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD CARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

// interface DashboardCardProps {
//   title: string;
//   icon: React.ReactNode;
//   iconColor: string;
//   children: React.ReactNode;
//   action?: { label: string; onClick: () => void };
// }

// function DashboardCard({ title, icon, iconColor, children, action }: DashboardCardProps) {
//   return (
//     <Card style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
//       <div style={{
//         display: 'flex',
//         alignItems: 'center',
//         justifyContent: 'space-between',
//         padding: '20px',
//         borderBottom: `1px solid ${colors.gray[100]}`,
//       }}>
//         <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
//           <div style={{
//             width: '40px',
//             height: '40px',
//             borderRadius: radii.md,
//             background: `${iconColor}15`,
//             color: iconColor,
//             display: 'flex',
//             alignItems: 'center',
//             justifyContent: 'center',
//           }}>
//             {icon}
//           </div>
//           <CardTitle style={{ fontSize: '16px', margin: 0 }}>{title}</CardTitle>
//         </div>
//         {action && (
//           <button
//             onClick={action.onClick}
//             style={{
//               padding: '6px 12px',
//               borderRadius: radii.sm,
//               border: 'none',
//               background: colors.gray[100],
//               color: colors.gray[600],
//               fontSize: '12px',
//               fontWeight: 500,
//               cursor: 'pointer',
//               transition: transitions.DEFAULT,
//             }}
//             onMouseEnter={(e) => {
//               e.currentTarget.style.background = colors.gray[200];
//             }}
//             onMouseLeave={(e) => {
//               e.currentTarget.style.background = colors.gray[100];
//             }}
//           >
//             {action.label}
//           </button>
//         )}
//       </div>
//       <CardContent style={{ flex: 1, padding: '16px 20px', overflow: 'auto' }}>
//         {children}
//       </CardContent>
//     </Card>
//   );
// }

// ═══════════════════════════════════════════════════════════════════════════════
// STATS OVERVIEW - KPI CARDS
// ═══════════════════════════════════════════════════════════════════════════════

// function StatsOverview() {
//   const today = format(new Date(), 'yyyy-MM-dd');
//   const monthStart = startOfMonth(new Date());
//   const monthEnd = endOfMonth(new Date());

//   const { data: stats, isLoading } = useQuery({
//     queryKey: DASHBOARD_QUERY_KEYS.stats(),
//     queryFn: async () => {
//       const [
//         todaySitesRes,
//         pendingApprovalsRes,
//         monthInvoicesRes,
//         activeProjectsRes,
//       ] = await Promise.all([
//         supabase
//           .from('site_visits')
//           .select('id', { count: 'exact', head: true })
//           .eq('visit_date', today),
//         supabase
//           .from('quotation_header')
//           .select('id', { count: 'exact', head: true })
//           .in('status', ['Pending Approval', 'Draft']),
//         supabase
//           .from('project_invoices')
//           .select('total_amount')
//           .gte('invoice_date', format(monthStart, 'yyyy-MM-dd'))
//           .lte('invoice_date', format(monthEnd, 'yyyy-MM-dd')),
//         supabase
//           .from('projects')
//           .select('id', { count: 'exact', head: true })
//           .eq('status', 'Active'),
//       ]);

//       const monthRevenue = (monthInvoicesRes.data || []).reduce((sum, inv) => sum + (inv.total_amount || 0), 0);

//       return {
//         todaySites: todaySitesRes.count || 0,
//         pendingApprovals: pendingApprovalsRes.count || 0,
//         monthRevenue,
//         activeProjects: activeProjectsRes.count || 0,
//       };
//     },
//   });

//   if (isLoading) {
//     return (
//       <div style={{
//         display: 'grid',
//         gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
//         gap: spacing.lg,
//         marginBottom: spacing.xl,
//       }}>
//         {Array.from({ length: 4 }).map((_, i) => (
//           <Card key={i} style={{ height: '120px' }}>
//             <CardSkeleton rows={2} />
//           </Card>
//         ))}
//       </div>
//     );
//   }

//   const statItems = [
//     {
//       label: "Today's Sites",
//       value: stats?.todaySites || 0,
//       icon: MapPin,
//       color: 'blue' as const,
//       trend: { value: 12, label: 'vs yesterday' },
//     },
//     {
//       label: 'Pending Approvals',
//       value: stats?.pendingApprovals || 0,
//       icon: CheckCircle,
//       color: 'amber' as const,
//       trend: { value: -5, label: 'vs last week' },
//     },
//     {
//       label: 'Month Revenue',
//       value: `₹${(stats?.monthRevenue || 0).toLocaleString('en-IN')}`,
//       icon: DollarSign,
//       color: 'green' as const,
//       trend: { value: 23, label: 'vs last month' },
//     },
//     {
//       label: 'Active Projects',
//       value: stats?.activeProjects || 0,
//       icon: Briefcase,
//       color: 'gray' as const,
//     },
//   ];

//   return (
//     <div style={{
//       display: 'grid',
//       gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
//       gap: spacing.lg,
//       marginBottom: spacing.xl,
//     }}>
//       {statItems.map((stat, index) => (
//         <StatCard
//           key={index}
//           icon={<stat.icon size={24} />}
//           label={stat.label}
//           value={stat.value}
//           trend={stat.trend}
//           color={stat.color}
//         />
//       ))}
//     </div>
//   );
// }

// ═══════════════════════════════════════════════════════════════════════════════
// INDIVIDUAL CARD COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// function TodaySiteCard() {
//   const today = format(new Date(), 'yyyy-MM-dd');

//   const { data: visits = [], isLoading } = useQuery({
//     queryKey: DASHBOARD_QUERY_KEYS.todaySites(today),
//     queryFn: async () => {
//       const { data, error } = await supabase
//         .from('site_visits')
//         .select('id, status, purpose, visited_by, engineer, in_time, client_id')
//         .eq('visit_date', today)
//         .order('in_time', { ascending: true });
//       if (error) throw error;
//       return data || [];
//     },
//       });

//   if (isLoading) return <CardSkeleton rows={3} />;

//   if (visits.length === 0) {
//     return (
//       <EmptyState
//         message="No site visits scheduled for today"
//         icon={MapPin}
//         color={colors.info.DEFAULT}
//       />
//     );
//   }

//   return (
//     <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
//       {visits.map((v: any) => (
//         <div
//           key={v.id}
//           style={{
//             display: 'flex',
//             alignItems: 'center',
//             gap: '16px',
//             padding: '12px',
//             borderRadius: radii.md,
//             background: colors.gray[50],
//             cursor: 'pointer',
//             transition: transitions.DEFAULT,
//           }}
//           onMouseEnter={(e) => {
//             e.currentTarget.style.background = colors.info.light;
//           }
//           onMouseLeave={(e) => {
//             e.currentTarget.style.background = colors.gray[50];
//           }}
//         >
//           <div style={{
//             width: '10px',
//             height: '10px',
//             borderRadius: '50%',
//             background: colors.info.DEFAULT,
//             flexShrink: 0,
//           }} />
//           <div style={{ flex: 1, minWidth: 0 }}>
//             <p style={{ fontSize: '14px', fontWeight: 600, color: colors.gray[900], margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
//               {v.clients?.client_name || 'Unknown Client'}
//             </p>
//             <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
//               {v.visited_by && (
//                 <span style={{ fontSize: '12px', color: colors.gray[500], display: 'flex', alignItems: 'center', gap: '4px' }}>
//                   <User size={12} /> {v.visited_by}
//                 </span>
//               )}
//               {v.purpose && (
//                 <span style={{ fontSize: '12px', color: colors.gray[400], whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
//                   {v.purpose}
//                 </span>
//               )}
//             </div>
//           </div>
//           <StatusBadge status={v.status} />
//         </div>
//       ))}
//     </div>
//   );
// }

// function ApprovalsCard() {
//   const { data: pendingApprovals = [], isLoading } = useQuery({
//     queryKey: DASHBOARD_QUERY_KEYS.approvals(),
//     queryFn: async () => {
//       const { data, error } = await supabase
//         .from('quotation_header')
//         .select('id, quotation_no, client_id, status, created_at, approval_status')
//         .in('status', ['Pending Approval', 'Draft'])
//         .order('created_at', { ascending: false })
//         .limit(10);
//       if (error) throw error;
//       return data || [];
//     },
//       });

//   if (isLoading) return <CardSkeleton rows={3} />;

//   if (pendingApprovals.length === 0) {
//     return (
//       <EmptyState
//         message="All caught up! No pending approvals"
//         icon={CheckCircle}
//         color={colors.success.DEFAULT}
//       />
//     );
//   }

//   return (
//     <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
//       {pendingApprovals.map((q: any) => (
//         <div
//           key={q.id}
//           style={{
//             display: 'flex',
//             alignItems: 'center',
//             justifyContent: 'space-between',
//             padding: '12px',
//             borderRadius: radii.md,
//             background: colors.gray[50],
//             cursor: 'pointer',
//             transition: transitions.DEFAULT,
//           }}
//           onMouseEnter={(e) => {
//             e.currentTarget.style.background = colors.success.light;
//           }}
//           onMouseLeave={(e) => {
//             e.currentTarget.style.background = colors.gray[50];
//           }}
//         >
//           <div style={{ minWidth: 0, flex: 1 }}>
//             <p style={{ fontSize: '14px', fontWeight: 600, color: colors.gray[900], margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
//               {q.quotation_no}
//             </p>
//             <p style={{ fontSize: '12px', color: colors.gray[500], margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
//               {q.client?.client_name || '-'}
//             </p>
//           </div>
//           <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '8px' }}>
//             <StatusBadge status={q.status} />
//             <span style={{ fontSize: '11px', color: colors.gray[400], whiteSpace: 'nowrap' }}>
//               {q.created_at ? formatDistanceToNow(parseISO(q.created_at), { addSuffix: true }) : ''}
//             </span>
//           </div>
//         </div>
//       ))}
//     </div>
//   );
// }

// function ClientCommunicationCard() {
//   const { data: comms = [], isLoading } = useQuery({
//     queryKey: DASHBOARD_QUERY_KEYS.clientComms(),
//     queryFn: async () => {
//       const { data, error } = await supabase
//         .from('client_communication')
//         .select('id, call_entered_by, call_received_by, call_brief, created_at, client_id')
//         .order('created_at', { ascending: false })
//         .limit(8);
//       if (error) throw error;
//       return data || [];
//     },
//       });

//   const { data: clients = [] } = useQuery({
//     queryKey: DASHBOARD_QUERY_KEYS.clientsLookup(),
//     queryFn: async () => {
//       const { data, error } = await supabase.from('clients').select('id, client_name').order('client_name');
//       if (error) throw error;
//       return data || [];
//     },
//   });

//   const clientMap = useMemo(() => {
//     const m = new Map<string, string>();
//     clients.forEach((c: any) => m.set(c.id, c.client_name));
//     return m;
//   }, [clients]);

//   if (isLoading) return <CardSkeleton rows={4} />;

//   if (comms.length === 0) {
//     return (
//       <EmptyState
//         message="No recent client communications"
//         icon={Phone}
//         color={colors.gray[400]}
//       />
//     );
//   }

//   return (
//     <div style={{ overflowX: 'auto', margin: '-16px -20px' }}>
//       <Table>
//         <TableHeader>
//           <TableRow style={{ borderBottom: `1px solid ${colors.gray[200]}` }}>
//             <TableHead style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: colors.gray[500], fontWeight: 600, padding: '12px 16px', background: colors.gray[50] }}>Created By</TableHead>
//             <TableHead style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: colors.gray[500], fontWeight: 600, padding: '12px 16px', background: colors.gray[50] }}>Client</TableHead>
//             <TableHead style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: colors.gray[500], fontWeight: 600, padding: '12px 16px', background: colors.gray[50] }}>Call Brief</TableHead>
//           </TableRow>
//         </TableHeader>
//         <TableBody>
//           {comms.map((c: any) => (
//             <TableRow 
//               key={c.id} 
//               style={{ 
//                 borderBottom: `1px solid ${colors.gray[100]}`,
//                 cursor: 'pointer',
//                 transition: transitions.DEFAULT,
//               }}
//               onMouseEnter={(e) => {
//                 (e.currentTarget as HTMLElement).style.background = colors.gray[50];
//               }}
//               onMouseLeave={(e) => {
//                 (e.currentTarget as HTMLElement).style.background = 'transparent';
//               }}
//             >
//               <TableCell style={{ fontSize: '13px', color: colors.gray[900], padding: '12px 16px', fontWeight: 500 }}>
//                 {c.call_entered_by || c.call_received_by || '-'}
//               </TableCell>
//               <TableCell style={{ fontSize: '13px', color: colors.primary[600], fontWeight: 600, padding: '12px 16px', maxWidth: '140px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
//                 {clientMap.get(c.client_id) || '-'}
//               </TableCell>
//               <TableCell style={{ fontSize: '13px', color: colors.gray[600], padding: '12px 16px', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
//                 {c.call_brief || '-'}
//               </TableCell>
//             </TableRow>
//           ))}
//         </TableBody>
//       </Table>
//     </div>
//   );
// }

// function SiteVisitPlanCard() {
//   const { data: visits = [], isLoading } = useQuery({
//     queryKey: DASHBOARD_QUERY_KEYS.visitPlan(),
//     queryFn: async () => {
//       const today = format(new Date(), 'yyyy-MM-dd');
//       const { data, error } = await supabase
//         .from('site_visits')
//         .select('id, visit_date, visited_by, engineer, status, client_id')
//         .gte('visit_date', today)
//         .in('status', ['pending', 'scheduled'])
//         .order('visit_date', { ascending: true })
//         .limit(8);
//       if (error) throw error;
//       return data || [];
//     },
//       });

//   if (isLoading) return <CardSkeleton rows={4} />;

//   if (visits.length === 0) {
//     return (
//       <EmptyState
//         message="No upcoming site visits planned"
//         icon={Calendar}
//         color={colors.warning.DEFAULT}
//       />
//     );
//   }

//   return (
//     <div style={{ overflowX: 'auto', margin: '-16px -20px' }}>
//       <Table>
//         <TableHeader>
//           <TableRow style={{ borderBottom: `1px solid ${colors.gray[200]}` }}>
//             <TableHead style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: colors.gray[500], fontWeight: 600, padding: '12px 16px', background: colors.gray[50] }}>Date</TableHead>
//             <TableHead style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: colors.gray[500], fontWeight: 600, padding: '12px 16px', background: colors.gray[50] }}>Client</TableHead>
//             <TableHead style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: colors.gray[500], fontWeight: 600, padding: '12px 16px', background: colors.gray[50] }}>Visit By</TableHead>
//           </TableRow>
//         </TableHeader>
//         <TableBody>
//           {visits.map((v: any) => (
//             <TableRow 
//               key={v.id} 
//               style={{ 
//                 borderBottom: `1px solid ${colors.gray[100]}`,
//                 cursor: 'pointer',
//                 transition: transitions.DEFAULT,
//               }}
//               onMouseEnter={(e) => {
//                 (e.currentTarget as HTMLElement).style.background = colors.warning.light;
//               }}
//               onMouseLeave={(e) => {
//                 (e.currentTarget as HTMLElement).style.background = 'transparent';
//               }}
//             >
//               <TableCell style={{ fontSize: '13px', padding: '12px 16px', whiteSpace: 'nowrap' }}>
//                 <span style={{ 
//                   display: 'flex', 
//                   alignItems: 'center', 
//                   gap: '6px',
//                   color: isToday(parseISO(v.visit_date)) ? colors.warning.dark : colors.gray[600],
//                   fontWeight: isToday(parseISO(v.visit_date)) ? 600 : 400,
//                 }}>
//                   <Calendar size={14} color={isToday(parseISO(v.visit_date)) ? colors.warning.DEFAULT : colors.gray[400]} />
//                   {isToday(parseISO(v.visit_date)) ? 'Today' : format(parseISO(v.visit_date), 'dd MMM yyyy')}
//                 </span>
//               </TableCell>
//               <TableCell style={{ fontSize: '13px', fontWeight: 600, color: colors.gray[900], padding: '12px 16px', maxWidth: '140px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
//                 {v.clients?.client_name || '-'}
//               </TableCell>
//               <TableCell style={{ fontSize: '13px', color: colors.gray[600], padding: '12px 16px' }}>
//                 {v.visited_by || v.engineer || '-'}
//               </TableCell>
//             </TableRow>
//           ))}
//         </TableBody>
//       </Table>
//     </div>
//   );
// }

// function QuotationApprovalCard() {
//   const { data: quotations = [], isLoading } = useQuery({
//     queryKey: DASHBOARD_QUERY_KEYS.quotationApproval(),
//     queryFn: async () => {
//       const { data, error } = await supabase
//         .from('quotation_header')
//         .select('id, quotation_no, status, client_id, created_at, approval_status')
//         .in('status', ['Pending Approval', 'Approved', 'Rejected'])
//         .order('created_at', { ascending: false })
//         .limit(8);
//       if (error) throw error;
//       return data || [];
//     },
//       });

//   if (isLoading) return <CardSkeleton rows={3} />;

//   if (quotations.length === 0) {
//     return (
//       <EmptyState
//         message="No quotation approvals pending"
//         icon={FileText}
//         color={colors.gray[400]}
//       />
//     );
//   }

//   return (
//     <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
//       {quotations.map((q: any) => (
//         <div
//           key={q.id}
//           style={{
//             display: 'flex',
//             alignItems: 'center',
//             justifyContent: 'space-between',
//             padding: '12px',
//             borderRadius: radii.md,
//             background: colors.gray[50],
//             cursor: 'pointer',
//             transition: transitions.DEFAULT,
//           }}
//           onMouseEnter={(e) => {
//             e.currentTarget.style.background = colors.primary[50];
//           }}
//           onMouseLeave={(e) => {
//             e.currentTarget.style.background = colors.gray[50];
//           }}
//         >
//           <div style={{ minWidth: 0, flex: 1 }}>
//             <p style={{ fontSize: '14px', fontWeight: 600, color: colors.gray[900], margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
//               {q.quotation_no}
//             </p>
//             <p style={{ fontSize: '12px', color: colors.gray[500], margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
//               {q.client?.client_name || '-'}
//             </p>
//           </div>
//           <StatusBadge status={q.approval_status || q.status} />
//         </div>
//       ))}
//     </div>
//   );
// }

// function InvoiceCard() {
//   const { data: invoices = [], isLoading } = useQuery({
//     queryKey: DASHBOARD_QUERY_KEYS.invoices(),
//     queryFn: async () => {
//       const { data, error } = await supabase
//         .from('project_invoices')
//         .select('id, invoice_number, total_amount, invoice_date, project:project_id(project_name)')
//         .order('invoice_date', { ascending: false })
//         .limit(8);
//       if (error) throw error;
//       return data || [];
//     },
//       });

//   if (isLoading) return <CardSkeleton rows={3} />;

//   if (invoices.length === 0) {
//     return (
//       <EmptyState
//         message="No recent invoices"
//         icon={Receipt}
//         color={colors.gray[400]}
//       />
//     );
//   }

//   return (
//     <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
//       {invoices.map((inv: any) => (
//         <div
//           key={inv.id}
//           style={{
//             display: 'flex',
//             alignItems: 'center',
//             justifyContent: 'space-between',
//             padding: '12px',
//             borderRadius: radii.md,
//             background: colors.gray[50],
//             cursor: 'pointer',
//             transition: transitions.DEFAULT,
//           }}
//           onMouseEnter={(e) => {
//             e.currentTarget.style.background = colors.primary[50];
//           }}
//           onMouseLeave={(e) => {
//             e.currentTarget.style.background = colors.gray[50];
//           }}
//         >
//           <div style={{ minWidth: 0, flex: 1 }}>
//             <p style={{ fontSize: '14px', fontWeight: 600, color: colors.gray[900], margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
//               {inv.invoice_number || `INV-${inv.id?.slice(0, 6)}`}
//             </p>
//             <p style={{ fontSize: '12px', color: colors.gray[500], margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
//               {inv.project?.project_name || '-'}
//             </p>
//           </div>
//           <div style={{ textAlign: 'right', marginLeft: '12px' }}>
//             {inv.total_amount && (
//               <p style={{ fontSize: '14px', fontWeight: 700, color: colors.gray[900], margin: 0 }}>
//                 ₹{Number(inv.total_amount).toLocaleString('en-IN')}
//               </p>
//             )}
//             <p style={{ fontSize: '11px', color: colors.gray[400], margin: 0 }}>
//               {inv.invoice_date ? format(parseISO(inv.invoice_date), 'dd MMM yyyy') : ''}
//             </p>
//           </div>
//         </div>
//       ))}
//     </div>
//   );
// }

// function DeliveryChallanCard() {
//   // ...
// }

// function RecentUpdates() {
//   // ...
// }

// ═══════════════════════════════════════════════════════════════════════════════
// RECENT ACTIVITY (RIGHT SIDEBAR)
// ═══════════════════════════════════════════════════════════════════════════════

// function RecentUpdates() {
//   const { data: recentItems = [], isLoading } = useQuery({
//     queryKey: DASHBOARD_QUERY_KEYS.recentUpdates(),
//     queryFn: async () => {
//       const [commsRes, visitsRes, dcRes, quotesRes] = await Promise.all([
//         supabase
//           .from('client_communication')
//           .select('id, call_brief, call_category, created_at, client_id')
//           .order('created_at', { ascending: false })
//           .limit(5),
//         supabase
//           .from('site_visits')
//           .select('id, visit_date, visited_by, status, created_at, client_id')
//           .order('created_at', { ascending: false })
//           .limit(5),
//         supabase
//           .from('delivery_challans')
//           .select('id, dc_number, client_name, status, created_at')
//           .order('created_at', { ascending: false })
//           .limit(5),
//         supabase
//           .from('quotation_header')
//           .select('id, quotation_no, status, created_at, client_id')
//           .order('created_at', { ascending: false })
//           .limit(5),
//       ]);

//       const items: any[] = [];

//       (commsRes.data || []).forEach((c: any) =>
//         items.push({ id: c.id, type: 'communication', text: c.call_brief || 'New communication', time: c.created_at, icon: MessageSquare, color: colors.primary[500], bgColor: colors.primary[50] })
//       );
//       (visitsRes.data || []).forEach((v: any) =>
//         items.push({ id: v.id, type: 'visit', text: `Visit: ${(v as any).clients?.client_name || 'Client'}`, time: v.created_at, icon: MapPin, color: colors.info.DEFAULT, bgColor: colors.info.light })
//       );
//       (dcRes.data || []).forEach((d: any) =>
//         items.push({ id: d.id, type: 'dc', text: `DC: ${d.dc_number || d.client_name}`, time: d.created_at, icon: Truck, color: colors.info.DEFAULT, bgColor: colors.info.light })
//       );
//       (quotesRes.data || []).forEach((q: any) =>
//         items.push({ id: q.id, type: 'quotation', text: `Quote: ${q.quotation_no}`, time: q.created_at, icon: FileText, color: colors.primary[500], bgColor: colors.primary[50], status: q.status })
//       );

//       items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
//       return items.slice(0, 20);
//     },
//       });

//   return (
//     <Card style={{ height: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column' }}>
//       <CardHeader style={{ borderBottom: `1px solid ${colors.gray[100]}` }}>
//         <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
//           <div style={{
//             width: '40px',
//             height: '40px',
//             borderRadius: radii.md,
//             background: `linear-gradient(135deg, ${colors.gray[700]}, ${colors.gray[900]})`,
//             display: 'flex',
//             alignItems: 'center',
//             justifyContent: 'center',
//           }}>
//             <Activity size={20} color="white" />
//           </div>
//           <div>
//             <CardTitle style={{ fontSize: '16px', margin: 0 }}>Recent Activity</CardTitle>
//             <CardDescription style={{ fontSize: '12px', margin: 0 }}>Activity across all modules</CardDescription>
//           </div>
//         </div>
//       </CardHeader>
//       <CardContent style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
//         {isLoading ? (
//           <CardSkeleton rows={8} />
//         ) : recentItems.length === 0 ? (
//           <EmptyState message="No recent activity" icon={Activity} color={colors.gray[400]} />
//         ) : (
//           <div style={{ position: 'relative' }}>
//             <div style={{
//               position: 'absolute',
//               left: '20px',
//               top: '12px',
//               bottom: '12px',
//               width: '2px',
//               background: `linear-gradient(to bottom, ${colors.gray[200]}, ${colors.gray[300]}, ${colors.gray[200]})`,
//               borderRadius: '1px',
//             }} />
//             <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
//               {recentItems.map((item: any, i: number) => {
//                 const Icon = item.icon;
//                 return (
//                   <div
//                     key={`${item.type}-${item.id}-${i}`}
//                     style={{
//                       display: 'flex',
//                       alignItems: 'flex-start',
//                       gap: '16px',
//                       padding: '12px',
//                       borderRadius: radii.md,
//                       cursor: 'pointer',
//                       transition: transitions.DEFAULT,
//                       position: 'relative',
//                     }}
//                     onMouseEnter={(e) => {
//                       e.currentTarget.style.background = colors.gray[50];
//                     }}
//                     onMouseLeave={(e) => {
//                       e.currentTarget.style.background = 'transparent';
//                     }}
//                   >
//                     <div style={{
//                       width: '40px',
//                       height: '40px',
//                       borderRadius: radii.md,
//                       background: item.bgColor,
//                       color: item.color,
//                       display: 'flex',
//                       alignItems: 'center',
//                       justifyContent: 'center',
//                       flexShrink: 0,
//                       zIndex: 1,
//                       border: `2px solid white`,
//                       boxShadow: shadows.sm,
//                     }}>
//                       <Icon size={18} />
//                     </div>
//                     <div style={{ flex: 1, minWidth: 0, paddingTop: '4px' }}>
//                       <p style={{ fontSize: '13px', fontWeight: 600, color: colors.gray[900], margin: 0, lineHeight: 1.4 }}>
//                         {item.text}
//                       </p>
//                       <p style={{ fontSize: '11px', color: colors.gray[400], margin: '4px 0 0' }}>
//                         {item.time ? formatDistanceToNow(parseISO(item.time), { addSuffix: true }) : ''}
//                       </p>
//                     </div>
//                   </div>
//                 );
//               })}
//             </div>
//           </div>
//         )}
//       </CardContent>
//     </Card>
//   );
// }

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
    queryKey: ['dashboard-user-profiles', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase
        .from('user_profiles')
        .select('user_id, full_name')
        .eq('organisation_id', organisation.id);
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

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    invalidateDashboardQueries(queryClient);
    refetchClaims();
    refetchInsights();
    setTimeout(() => setIsRefreshing(false), 500);
  }, [queryClient, refetchClaims, refetchInsights]);

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
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
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

      {/* Main Content - Premium Dashboard */}
      <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Stats Summary Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          
          {/* Stat 1: Active Projects */}
          <div style={{
            background: 'white',
            borderRadius: radii.md,
            padding: '20px',
            border: `1px solid ${colors.gray[200]}`,
            boxShadow: shadows.sm,
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}>
            <div style={{ background: colors.primary[50], color: colors.primary[600], padding: '12px', borderRadius: radii.DEFAULT }}>
              <Building2 size={24} />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: colors.gray[500], textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Projects</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: colors.gray[900], marginTop: '4px' }}>
                {projectsLoading ? '...' : projects.length}
              </div>
            </div>
          </div>

          {/* Stat 2: Active Warranty Claims */}
          <div style={{
            background: 'white',
            borderRadius: radii.md,
            padding: '20px',
            border: `1px solid ${colors.gray[200]}`,
            boxShadow: shadows.sm,
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}>
            <div style={{ background: colors.info.light, color: colors.info.dark, padding: '12px', borderRadius: radii.DEFAULT }}>
              <Wrench size={24} />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: colors.gray[500], textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Claims</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: colors.gray[900], marginTop: '4px' }}>
                {claimsLoading ? '...' : claimsStats.totalActive}
              </div>
            </div>
          </div>

          {/* Stat 3: Overdue SLA Claims */}
          <div style={{
            background: claimsStats.overdueCount > 0 ? '#fff5f5' : 'white',
            borderRadius: radii.md,
            padding: '20px',
            border: `1px solid ${claimsStats.overdueCount > 0 ? '#feb2b2' : colors.gray[200]}`,
            boxShadow: shadows.sm,
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}>
            <div style={{
              background: claimsStats.overdueCount > 0 ? colors.error.light : colors.gray[100],
              color: claimsStats.overdueCount > 0 ? colors.error.dark : colors.gray[500],
              padding: '12px',
              borderRadius: radii.DEFAULT
            }}>
              <AlertTriangle size={24} />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: colors.gray[500], textTransform: 'uppercase', letterSpacing: '0.05em' }}>Overdue SLA</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: claimsStats.overdueCount > 0 ? colors.error.dark : colors.gray[900], marginTop: '4px' }}>
                {claimsLoading ? '...' : claimsStats.overdueCount}
              </div>
            </div>
          </div>

          {/* Stat 4: Critical SLA (<= 3 Days) */}
          <div style={{
            background: claimsStats.criticalCount > 0 ? '#fffdf5' : 'white',
            borderRadius: radii.md,
            padding: '20px',
            border: `1px solid ${claimsStats.criticalCount > 0 ? '#fef3c7' : colors.gray[200]}`,
            boxShadow: shadows.sm,
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}>
            <div style={{
              background: claimsStats.criticalCount > 0 ? colors.warning.light : colors.gray[100],
              color: claimsStats.criticalCount > 0 ? colors.warning.dark : colors.gray[500],
              padding: '12px',
              borderRadius: radii.DEFAULT
            }}>
              <Clock size={24} />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: colors.gray[500], textTransform: 'uppercase', letterSpacing: '0.05em' }}>Critical SLA</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: claimsStats.criticalCount > 0 ? colors.warning.dark : colors.gray[900], marginTop: '4px' }}>
                {claimsLoading ? '...' : claimsStats.criticalCount}
              </div>
            </div>
          </div>

        </div>

        {/* 2-Column Section */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 7fr) minmax(0, 5fr)', gap: '24px', alignItems: 'start' }}>
          
          {/* Left Column: Modules & Quick Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ background: 'white', borderRadius: radii.md, padding: '24px', border: `1px solid ${colors.gray[200]}`, boxShadow: shadows.sm }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: colors.gray[900], margin: '0 0 8px 0' }}>MEP Project Management Suite</h2>
              <p style={{ fontSize: '14px', color: colors.gray[500], margin: '0 0 20px 0' }}>Select a module below to manage field operations, visual layouts, and administrative reviews.</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* Module 1: Site Visits */}
                <div 
                  onClick={() => onNavigate?.('/site-visits')}
                  style={{
                    padding: '18px',
                    borderRadius: radii.md,
                    border: `1px solid ${colors.gray[200]}`,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    background: '#fafafa',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = colors.primary[300];
                    e.currentTarget.style.background = '#f0f7ff';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = colors.gray[200];
                    e.currentTarget.style.background = '#fafafa';
                  }}
                >
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <div style={{ background: colors.primary[100], color: colors.primary[700], padding: '10px', borderRadius: radii.DEFAULT }}>
                      <Building2 size={20} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: colors.gray[900] }}>Site Visits & Field Engineering</h4>
                      <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: colors.gray[500] }}>
                        Log check-ins, record geotags, compile checklists, and verify Joint Measurement Sheets (JMS).
                      </p>
                    </div>
                  </div>
                  <ArrowRight size={18} style={{ color: colors.gray[400] }} />
                </div>

                {/* Module 2: Project Registry */}
                <div 
                  onClick={() => onNavigate?.('/projects')}
                  style={{
                    padding: '18px',
                    borderRadius: radii.md,
                    border: `1px solid ${colors.gray[200]}`,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    background: '#fafafa',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = colors.primary[300];
                    e.currentTarget.style.background = '#f0f7ff';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = colors.gray[200];
                    e.currentTarget.style.background = '#fafafa';
                  }}
                >
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <div style={{ background: '#dcfce7', color: '#15803d', padding: '10px', borderRadius: radii.DEFAULT }}>
                      <Wrench size={20} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: colors.gray[900] }}>Project Drawings & Visual Snags</h4>
                      <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: colors.gray[500] }}>
                        Overlay status pins on blueprints, audit material variances (BOQ vs Installed), and manage equipment commissionings.
                      </p>
                    </div>
                  </div>
                  <ArrowRight size={18} style={{ color: colors.gray[400] }} />
                </div>

                {/* Module 3: Approvals */}
                <div 
                  onClick={() => onNavigate?.('/approvals')}
                  style={{
                    padding: '18px',
                    borderRadius: radii.md,
                    border: `1px solid ${colors.gray[200]}`,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    background: '#fafafa',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = colors.primary[300];
                    e.currentTarget.style.background = '#f0f7ff';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = colors.gray[200];
                    e.currentTarget.style.background = '#fafafa';
                  }}
                >
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <div style={{ background: '#fef3c7', color: '#b45309', padding: '10px', borderRadius: radii.DEFAULT }}>
                      <FileText size={20} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: colors.gray[900] }}>Approvals & Administrative Sign-off</h4>
                      <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: colors.gray[500] }}>
                        Review subcontractor worksheets, approve purchase orders, and audit billing documentation.
                      </p>
                    </div>
                  </div>
                  <ArrowRight size={18} style={{ color: colors.gray[400] }} />
                </div>

              </div>
            </div>
          </div>

          {/* Right Column: Warranty Claims SLA Alerts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ background: 'white', borderRadius: radii.md, padding: '24px', border: `1px solid ${colors.gray[200]}`, boxShadow: shadows.sm }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <ShieldAlert size={20} style={{ color: claimsStats.overdueCount > 0 ? colors.error.DEFAULT : colors.info.DEFAULT }} />
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: colors.gray[900], margin: 0 }}>Warranty Claims SLA</h2>
              </div>
              <p style={{ fontSize: '14px', color: colors.gray[500], margin: '0 0 20px 0' }}>
                Active notifications and response-time tracking for vendor replacement claims.
              </p>

              {claimsLoading ? (
                <div style={{ textAlign: 'center', padding: '24px', color: colors.gray[400], fontSize: '14px' }}>
                  Loading active claims...
                </div>
              ) : claimsStats.claims.length === 0 ? (
                <div style={{
                  padding: '32px 16px',
                  textAlign: 'center',
                  borderRadius: radii.md,
                  border: `2px dashed ${colors.gray[200]}`,
                  background: '#fafafa',
                  color: colors.gray[500],
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <CheckCircle2 size={32} style={{ color: colors.success.DEFAULT }} />
                  <div style={{ fontSize: '15px', fontWeight: 600 }}>All Claims Cleared</div>
                  <div style={{ fontSize: '13px', color: colors.gray[400] }}>No active warranty claims pending vendor resolution.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
                  {claimsStats.claims.map((claim: any) => {
                    let cardBorder = `1px solid ${colors.gray[200]}`;
                    let leftStripColor = colors.gray[300];
                    let badgeBg = colors.gray[100];
                    let badgeText = colors.gray[700];
                    let BadgeIcon = Calendar;
                    let label = 'Active';

                    if (claim.slaStatus === 'overdue') {
                      cardBorder = `1px solid #fec5c5`;
                      leftStripColor = colors.error.DEFAULT;
                      badgeBg = colors.error.light;
                      badgeText = colors.error.dark;
                      BadgeIcon = AlertTriangle;
                      label = `Overdue by ${Math.abs(claim.daysRemaining)}d`;
                    } else if (claim.slaStatus === 'critical') {
                      cardBorder = `1px solid #fef3c7`;
                      leftStripColor = colors.warning.DEFAULT;
                      badgeBg = colors.warning.light;
                      badgeText = colors.warning.dark;
                      BadgeIcon = Clock;
                      label = `${claim.daysRemaining} days left`;
                    } else if (claim.daysRemaining !== null) {
                      leftStripColor = colors.primary.DEFAULT;
                      badgeBg = colors.primary.light;
                      badgeText = colors.primary.dark;
                      BadgeIcon = Calendar;
                      label = `${claim.daysRemaining} days left`;
                    } else {
                      label = 'Awaiting SLA';
                    }

                    return (
                      <div 
                        key={claim.id}
                        onClick={() => onNavigate?.('/projects')}
                        style={{
                          background: 'white',
                          borderRadius: radii.DEFAULT,
                          border: cardBorder,
                          boxShadow: shadows.sm,
                          padding: '14px 16px',
                          position: 'relative',
                          overflow: 'hidden',
                          paddingLeft: '22px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.transform = 'translateY(-1px)';
                          e.currentTarget.style.boxShadow = shadows.DEFAULT;
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.transform = 'none';
                          e.currentTarget.style.boxShadow = shadows.sm;
                        }}
                      >
                        {/* Status Left Strip */}
                        <div style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: '5px',
                          background: leftStripColor
                        }} />

                        {/* Card Header Row */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                          <div style={{ minWidth: 0 }}>
                            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: colors.gray[900], whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {claim.equipment?.equipment_name || 'Equipment Claim'}
                            </h4>
                            <div style={{ fontSize: '12px', color: colors.gray[500], marginTop: '2px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              Project: {claim.equipment?.project?.project_name || 'MEP Project'}
                            </div>
                          </div>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '9999px',
                            fontSize: '11px',
                            fontWeight: 700,
                            background: badgeBg,
                            color: badgeText,
                            whiteSpace: 'nowrap'
                          }}>
                            <BadgeIcon size={12} />
                            {label}
                          </span>
                        </div>

                        {/* Claim Sub-details */}
                        <div style={{ fontSize: '12px', color: colors.gray[500], display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${colors.gray[100]}`, paddingTop: '6px' }}>
                          <div>
                            Vendor: <span style={{ fontWeight: 600, color: colors.gray[700] }}>{claim.vendor_name}</span>
                          </div>
                          <div>
                            Status: <span style={{
                              fontWeight: 700,
                              color: claim.status === 'Resolved' ? colors.success.dark :
                                     claim.status === 'Pending Response' ? colors.warning.dark :
                                     claim.status === 'Draft' ? colors.gray[700] : colors.error.dark
                            }}>{claim.status}</span>
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Continuous Improvement Center Rollup (gated to isManagerOrAdminOrCEO) */}
        {isManagerOrAdminOrCEO && (
          <div style={{
            background: 'white',
            borderRadius: radii.md,
            padding: '24px',
            border: `1px solid ${colors.gray[200]}`,
            boxShadow: shadows.sm,
            marginTop: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
          }}>
            {/* Section Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${colors.gray[100]}`, paddingBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: '#f5f3ff', color: '#7c3aed', padding: '10px', borderRadius: radii.DEFAULT }}>
                  <TrendingDown size={24} />
                </div>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: 700, color: colors.gray[900], margin: 0 }}>Continuous Improvement Center</h2>
                  <p style={{ fontSize: '14px', color: colors.gray[500], margin: '4px 0 0 0' }}>Operational learning, repeated issue tracking, and cross-project action items</p>
                </div>
              </div>
              {onNavigate && (
                <button
                  onClick={() => onNavigate('/projects')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#7c3aed',
                    background: '#f5f3ff',
                    border: 'none',
                    borderRadius: radii.DEFAULT,
                    cursor: 'pointer',
                    transition: transitions.DEFAULT,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#ede9fe'}
                  onMouseLeave={e => e.currentTarget.style.background = '#f5f3ff'}
                >
                  Manage Log <ExternalLink size={14} />
                </button>
              )}
            </div>

            {/* Summary KPIs Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              {/* Open Opportunities */}
              <div style={{ borderLeft: '4px solid #ef4444', padding: '16px', background: '#fafafa', borderRadius: radii.DEFAULT, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '11px', color: colors.gray[500], fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Open Opportunities</span>
                <span style={{ fontSize: '24px', fontWeight: 800, color: colors.gray[900] }}>
                  {insightsLoading ? '...' : openOpportunitiesCount}
                </span>
              </div>

              {/* Critical Coordination Issues */}
              <div style={{ borderLeft: '4px solid #f59e0b', padding: '16px', background: '#fafafa', borderRadius: radii.DEFAULT, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '11px', color: colors.gray[500], fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Critical Coordination</span>
                <span style={{ fontSize: '24px', fontWeight: 800, color: '#f59e0b' }}>
                  {insightsLoading ? '...' : criticalCoordinationCount}
                </span>
              </div>

              {/* Best Practices Logged */}
              <div style={{ borderLeft: '4px solid #10b981', padding: '16px', background: '#fafafa', borderRadius: radii.DEFAULT, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '11px', color: colors.gray[500], fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Best Practices Logged</span>
                <span style={{ fontSize: '24px', fontWeight: 800, color: '#10b981' }}>
                  {insightsLoading ? '...' : bestPracticesCount}
                </span>
              </div>

              {/* Cost Savings Identified */}
              <div style={{ borderLeft: '4px solid #6366f1', padding: '16px', background: '#fafafa', borderRadius: radii.DEFAULT, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '11px', color: colors.gray[500], fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cost Savings Identified</span>
                <span style={{ fontSize: '24px', fontWeight: 800, color: '#6366f1' }}>
                  {insightsLoading ? '...' : isPrivileged ? `₹${costSavingsSum.toLocaleString('en-IN')}` : '🔒 Restricted'}
                </span>
              </div>

              {/* Resolved This Month */}
              <div style={{ borderLeft: '4px solid #3b82f6', padding: '16px', background: '#fafafa', borderRadius: radii.DEFAULT, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '11px', color: colors.gray[500], fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Resolved This Month</span>
                <span style={{ fontSize: '24px', fontWeight: 800, color: '#3b82f6' }}>
                  {insightsLoading ? '...' : resolvedThisMonthCount}
                </span>
              </div>
            </div>

            {/* Executive Analysis Panels (2-Column Grid) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '24px' }}>
              {/* Column 1: Top Repeated Issues & Top Root Causes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Top Repeated Issues */}
                <div style={{ border: `1px solid ${colors.gray[200]}`, borderRadius: radii.DEFAULT, padding: '20px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: colors.gray[900], margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={18} style={{ color: '#ef4444' }} /> Top Repeated Issues
                  </h3>
                  {insightsLoading ? (
                    <div style={{ color: colors.gray[400], fontSize: '13px', padding: '12px 0' }}>Loading repeated issues...</div>
                  ) : topRepeatedIssues.length === 0 ? (
                    <div style={{ color: colors.gray[500], fontSize: '13px', padding: '16px 0', textAlign: 'center', background: '#fafafa', borderRadius: radii.DEFAULT, border: `1px dashed ${colors.gray[200]}` }}>
                      No repeated issues flagged yet.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {topRepeatedIssues.map((issue: any) => (
                        <div key={issue.id} style={{ display: 'flex', alignItems: 'center', justifycontent: 'space-between', padding: '10px 12px', background: '#fafafa', borderRadius: radii.DEFAULT }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: colors.gray[900], overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{issue.title}</div>
                            <div style={{ fontSize: '11px', color: colors.gray[500], marginTop: '2px' }}>
                              {projectMap.get(issue.project_id) || 'Unknown Project'} · <span style={{ color: '#ef4444', fontWeight: 600 }}>{issue.category}</span>
                            </div>
                          </div>
                          <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '9999px', background: '#fee2e2', color: '#ef4444', marginLeft: '12px', whiteSpace: 'nowrap' }}>
                            Repeated {issue.repeat_issue_count}x
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Top Root Causes */}
                <div style={{ border: `1px solid ${colors.gray[200]}`, borderRadius: radii.DEFAULT, padding: '20px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: colors.gray[900], margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <BarChart3 size={18} style={{ color: '#3b82f6' }} /> Top Root Causes
                  </h3>
                  {insightsLoading ? (
                    <div style={{ color: colors.gray[400], fontSize: '13px', padding: '12px 0' }}>Loading root causes...</div>
                  ) : topRootCauses.length === 0 ? (
                    <div style={{ color: colors.gray[500], fontSize: '13px', padding: '16px 0', textAlign: 'center', background: '#fafafa', borderRadius: radii.DEFAULT, border: `1px dashed ${colors.gray[200]}` }}>
                      No root cause data available.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {topRootCauses.map((rc: any) => {
                        // Calculate percentage
                        const totalWithRootCause = filteredInsights.filter((i: any) => i.root_cause).length || 1;
                        const percentage = Math.round((rc.count / totalWithRootCause) * 100);
                        return (
                          <div key={rc.name} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                              <span style={{ fontWeight: 600, color: colors.gray[800] }}>{rc.name}</span>
                              <span style={{ fontWeight: 700, color: colors.gray[500] }}>{rc.count} logs ({percentage}%)</span>
                            </div>
                            <div style={{ height: '6px', background: '#e5e7eb', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${percentage}%`, height: '100%', background: '#3b82f6', borderRadius: '3px' }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Column 2: Top Cost Loss Categories (gated/restricted fallback) */}
              <div style={{ border: `1px solid ${colors.gray[200]}`, borderRadius: radii.DEFAULT, padding: '20px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: colors.gray[900], margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <TrendingDown size={18} style={{ color: '#6366f1' }} /> Top Cost Loss Categories
                </h3>
                {!isPrivileged ? (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '80%',
                    gap: '12px',
                    textAlign: 'center',
                    padding: '24px',
                    color: colors.gray[500],
                    background: '#fafafa',
                    borderRadius: radii.DEFAULT,
                    border: `1px dashed ${colors.gray[200]}`
                  }}>
                    <Lock size={32} style={{ color: colors.gray[400] }} />
                    <div style={{ fontSize: '15px', fontWeight: 600, color: colors.gray[700] }}>Financial View Restricted</div>
                    <p style={{ fontSize: '13px', color: colors.gray[400], margin: 0 }}>Estimated loss amounts and category leakages are only visible to Project Managers and Administrators.</p>
                  </div>
                ) : insightsLoading ? (
                  <div style={{ color: colors.gray[400], fontSize: '13px', padding: '12px 0' }}>Loading financial leaks...</div>
                ) : lossByImpactType.length === 0 ? (
                  <div style={{ color: colors.gray[500], fontSize: '13px', padding: '16px 0', textAlign: 'center', background: '#fafafa', borderRadius: radii.DEFAULT, border: `1px dashed ${colors.gray[200]}` }}>
                    No cost leakages recorded.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {lossByImpactType.map((item: any) => {
                      const maxLoss = Math.max(...lossByImpactType.map(i => i.amount)) || 1;
                      const barWidth = Math.round((item.amount / maxLoss) * 100);
                      return (
                        <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <div style={{ width: '120px', fontSize: '13px', fontWeight: 600, color: colors.gray[700], whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.name}
                          </div>
                          <div style={{ flex: 1, height: '16px', background: '#e5e7eb', borderRadius: radii.sm, overflow: 'hidden', position: 'relative' }}>
                            <div style={{ width: `${barWidth}%`, height: '100%', background: '#6366f1', borderRadius: radii.sm }} />
                          </div>
                          <div style={{ width: '100px', textAlign: 'right', fontSize: '13px', fontWeight: 700, color: '#ef4444' }}>
                            ₹{item.amount.toLocaleString('en-IN')}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Open Action Items Grid (Full Width Table) */}
            <div style={{ border: `1px solid ${colors.gray[200]}`, borderRadius: radii.DEFAULT, padding: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: colors.gray[900], margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={18} style={{ color: '#10b981' }} /> Cross-Project Action Items
              </h3>
              {insightsLoading ? (
                <div style={{ color: colors.gray[400], fontSize: '13px', padding: '12px 0' }}>Loading action items...</div>
              ) : openActionItems.length === 0 ? (
                <div style={{ color: colors.gray[500], fontSize: '13px', padding: '24px 0', textAlign: 'center', background: '#fafafa', borderRadius: radii.DEFAULT, border: `1px dashed ${colors.gray[200]}` }}>
                  No open action items pending.
                </div>
              ) : (
                <div style={{ overflowX: 'auto', margin: '0 -20px -20px -20px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#fafafa', borderBottom: `1px solid ${colors.gray[200]}` }}>
                        <th style={{ padding: '12px 20px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: colors.gray[500] }}>Project</th>
                        <th style={{ padding: '12px 20px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: colors.gray[500] }}>Category</th>
                        <th style={{ padding: '12px 20px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: colors.gray[500] }}>Title</th>
                        <th style={{ padding: '12px 20px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: colors.gray[500] }}>Assigned To</th>
                        <th style={{ padding: '12px 20px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: colors.gray[500] }}>Target Date</th>
                        <th style={{ padding: '12px 20px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: colors.gray[500] }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {openActionItems.map((item: any) => (
                        <tr key={item.id} style={{ borderBottom: `1px solid ${colors.gray[100]}`, fontSize: '13px' }}>
                          <td style={{ padding: '12px 20px', fontWeight: 600, color: colors.gray[700] }}>
                            {projectMap.get(item.project_id) || 'Unknown Project'}
                          </td>
                          <td style={{ padding: '12px 20px' }}>
                            <span style={{
                              display: 'inline-flex',
                              padding: '2px 8px',
                              borderRadius: '9999px',
                              fontSize: '11px',
                              fontWeight: 600,
                              background: item.category === 'Improvement Opportunity' ? '#fee2e2' :
                                          item.category === 'Best Practice' ? '#dcfce7' :
                                          item.category === 'Coordination Issue' ? '#ffedd5' :
                                          item.category === 'Client Feedback' ? '#eff6ff' :
                                          item.category === 'Safety Observation' ? '#fef3c7' :
                                          item.category === 'Cost Saving Idea' ? '#ccfbf1' : '#f4f4f5',
                              color: item.category === 'Improvement Opportunity' ? '#b91c1c' :
                                     item.category === 'Best Practice' ? '#15803d' :
                                     item.category === 'Coordination Issue' ? '#c2410c' :
                                     item.category === 'Client Feedback' ? '#1d4ed8' :
                                     item.category === 'Safety Observation' ? '#b45309' :
                                     item.category === 'Cost Saving Idea' ? '#0f766e' : '#3f3f46'
                            }}>
                              {item.category}
                            </span>
                          </td>
                          <td style={{ padding: '12px 20px', color: colors.gray[900], fontWeight: 500 }}>
                            {item.title}
                          </td>
                          <td style={{ padding: '12px 20px', color: colors.gray[600] }}>
                            {userMap.get(item.assigned_to) || 'Unassigned'}
                          </td>
                          <td style={{ padding: '12px 20px', color: colors.gray[500] }}>
                            {item.target_date ? new Date(item.target_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                          </td>
                          <td style={{ padding: '12px 20px' }}>
                            <span style={{
                              display: 'inline-flex',
                              padding: '2px 8px',
                              borderRadius: '9999px',
                              fontSize: '11px',
                              fontWeight: 700,
                              background: item.status === 'Closed' ? '#d1fae5' :
                                          item.status === 'In Progress' ? '#fef3c7' : '#fee2e2',
                              color: item.status === 'Closed' ? '#065f46' :
                                     item.status === 'In Progress' ? '#92400e' : '#991b1b'
                            }}>
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
