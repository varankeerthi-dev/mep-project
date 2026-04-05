import { useEffect, useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from '../App';
import { format, formatDistanceToNow, isToday, parseISO } from 'date-fns';
import {
  MapPin,
  CheckCircle,
  Phone,
  Calendar,
  FileText,
  Receipt,
  Truck,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  User,
  Building2,
  Activity,
  Plus,
  MessageSquare,
  Package,
} from 'lucide-react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../components/ui/table';

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
  ].filter(Boolean);

  queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEYS.all() });
  keysToInvalidate.forEach(key => {
    if (key) queryClient.invalidateQueries({ queryKey: key });
  });
}

type DashboardCardId =
  | 'today-site'
  | 'approvals'
  | 'client-communication'
  | 'site-visit-plan'
  | 'quotation-approval'
  | 'invoice'
  | 'delivery-challan';

type CardConfig = {
  id: DashboardCardId;
  title: string;
  icon: React.ReactNode;
  iconColor: string;
  row: number;
};

const DEFAULT_CARDS: CardConfig[] = [
  { id: 'today-site', title: 'Today Site', icon: <MapPin size={18} />, iconColor: '#3b82f6', row: 0 },
  { id: 'approvals', title: 'Approvals', icon: <CheckCircle size={18} />, iconColor: '#22c55e', row: 0 },
  { id: 'client-communication', title: 'Client Communication', icon: <Phone size={18} />, iconColor: '#6366f1', row: 0 },
  { id: 'site-visit-plan', title: 'Site Visit Plan', icon: <Calendar size={18} />, iconColor: '#f59e0b', row: 1 },
  { id: 'quotation-approval', title: 'Quotation Approval', icon: <FileText size={18} />, iconColor: '#a855f7', row: 1 },
  { id: 'invoice', title: 'Invoice', icon: <Receipt size={18} />, iconColor: '#ec4899', row: 2 },
  { id: 'delivery-challan', title: 'Delivery Challan', icon: <Truck size={18} />, iconColor: '#06b6d4', row: 2 },
];

function StatusBadge({ status }: { status: string }) {
  const s = (status || '').toLowerCase();
  
  const variants: Record<string, { bg: string; text: string; border: string }> = {
    'completed': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    'approved': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    'active': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    'checked_in': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    'pending': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    'pending approval': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    'scheduled': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    'draft': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
    'cancelled': { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
    'rejected': { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
    'checked_out': { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' },
    'absent': { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
    'on_leave': { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  };

  const variant = variants[s] || { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${variant.bg} ${variant.text} ${variant.border}`}>
      {status || '-'}
    </span>
  );
}

function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="p-5 space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-gradient-to-r from-gray-100 to-gray-200 rounded animate-pulse w-3/4" />
            <div className="h-2.5 bg-gradient-to-r from-gray-50 to-gray-100 rounded animate-pulse w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ message, icon, color = '#94a3b8' }: { message: string; icon?: React.ReactNode; color?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-gray-400">
      {icon || <Package size={48} strokeWidth={1.5} className="mb-3" style={{ color }} />}
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}

function DashboardCard({
  config,
  collapsed,
  onToggle,
  children,
}: {
  config: CardConfig;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div 
      className="bg-white border border-gray-200 rounded-2xl shadow-sm flex flex-col min-h-[280px] overflow-hidden transition-all duration-200 hover:shadow-md"
      style={{ borderLeftWidth: '4px', borderLeftColor: config.iconColor }}
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-transform duration-200"
            style={{ backgroundColor: `${config.iconColor}15`, color: config.iconColor }}
          >
            {config.icon}
          </div>
          <h3 className="text-base font-bold text-gray-900 tracking-tight">{config.title}</h3>
        </div>
        <button
          onClick={onToggle}
          className="p-2 rounded-xl hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-200"
          type="button"
          aria-label={collapsed ? 'Expand card' : 'Collapse card'}
        >
          <ChevronUp
            size={16}
            className={`text-gray-500 transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`}
          />
        </button>
      </div>
      {!collapsed && <div className="p-5 flex-1 flex flex-col">{children}</div>}
    </div>
  );
}

function TodaySiteCard() {
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: visits = [], isLoading } = useQuery({
    queryKey: DASHBOARD_QUERY_KEYS.todaySites(today),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_visits')
        .select('id, status, purpose, visited_by, engineer, in_time, clients(client_name)')
        .eq('visit_date', today)
        .order('in_time', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (isLoading) return <CardSkeleton rows={3} />;

  if (visits.length === 0) {
    return (
      <EmptyState
        message="No site visits today"
        icon={<MapPin size={48} strokeWidth={1.5} className="text-blue-400" />}
        color="#60a5fa"
      />
    );
  }

  return (
    <div className="space-y-2 flex-1">
      {visits.map((v: any) => (
        <div
          key={v.id}
          className="flex items-center gap-4 p-3 rounded-xl bg-gray-50/50 hover:bg-blue-50/50 transition-colors duration-200 group cursor-pointer"
        >
          <div className="w-2.5 h-2.5 rounded-full bg-blue-400 flex-shrink-0 group-hover:scale-110 transition-transform" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{v.clients?.client_name || 'Unknown Client'}</p>
            <div className="flex items-center gap-3 mt-1">
              {v.visited_by && (
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <User size={12} /> {v.visited_by}
                </span>
              )}
              {v.purpose && (
                <span className="text-xs text-gray-400 truncate">{v.purpose}</span>
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
        .select('id, quotation_no, client:clients(client_name), status, created_at, approval_status')
        .in('status', ['Pending Approval', 'Draft'])
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (isLoading) return <CardSkeleton rows={3} />;

  if (pendingApprovals.length === 0) {
    return (
      <EmptyState
        message="No pending approvals"
        icon={<CheckCircle size={48} strokeWidth={1.5} className="text-emerald-400" />}
        color="#34d399"
      />
    );
  }

  return (
    <div className="space-y-2 flex-1">
      {pendingApprovals.map((q: any) => (
        <div
          key={q.id}
          className="flex items-center justify-between p-3 rounded-xl bg-gray-50/50 hover:bg-emerald-50/30 transition-colors duration-200 cursor-pointer group"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-emerald-700 transition-colors">{q.quotation_no}</p>
            <p className="text-xs text-gray-500 truncate">{q.client?.client_name || '-'}</p>
          </div>
          <div className="flex items-center gap-2 ml-2">
            <StatusBadge status={q.status} />
            <span className="text-xs text-gray-400 whitespace-nowrap">
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
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: clients = [] } = useQuery({
    queryKey: DASHBOARD_QUERY_KEYS.clientsLookup(),
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id, client_name').order('client_name');
      if (error) throw error;
      return data || [];
    },
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
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
        message="No recent communications"
        icon={<Phone size={48} strokeWidth={1.5} className="text-indigo-400" />}
        color="#818cf8"
      />
    );
  }

  return (
    <div className="overflow-x-auto flex-1 -mx-1">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-gray-200">
            <TableHead className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold bg-gray-50/50 py-3">Created By</TableHead>
            <TableHead className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold bg-gray-50/50 py-3">Client</TableHead>
            <TableHead className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold bg-gray-50/50 py-3">Call Brief</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {comms.map((c: any) => (
            <TableRow key={c.id} className="border-b border-gray-100 hover:bg-indigo-50/30 transition-colors cursor-pointer">
              <TableCell className="text-sm text-gray-900 py-3.5 font-medium">{c.call_entered_by || c.call_received_by || '-'}</TableCell>
              <TableCell className="text-sm font-semibold text-indigo-600 max-w-[140px] truncate py-3.5">
                {clientMap.get(c.client_id) || '-'}
              </TableCell>
              <TableCell className="text-sm text-gray-600 max-w-[200px] truncate py-3.5">
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
        .select('id, visit_date, visited_by, engineer, status, clients(client_name)')
        .gte('visit_date', today)
        .in('status', ['pending', 'scheduled'])
        .order('visit_date', { ascending: true })
        .limit(8);
      if (error) throw error;
      return data || [];
    },
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (isLoading) return <CardSkeleton rows={4} />;

  if (visits.length === 0) {
    return (
      <EmptyState
        message="No upcoming visits"
        icon={<Calendar size={48} strokeWidth={1.5} className="text-amber-400" />}
        color="#fbbf24"
      />
    );
  }

  return (
    <div className="overflow-x-auto flex-1 -mx-1">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-gray-200">
            <TableHead className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold bg-gray-50/50 py-3">Date</TableHead>
            <TableHead className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold bg-gray-50/50 py-3">Client</TableHead>
            <TableHead className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold bg-gray-50/50 py-3">Visit By</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visits.map((v: any) => (
            <TableRow key={v.id} className="border-b border-gray-100 hover:bg-amber-50/30 transition-colors cursor-pointer">
              <TableCell className="text-sm py-3.5 whitespace-nowrap">
                <span className={`flex items-center gap-1.5 ${isToday(parseISO(v.visit_date)) ? 'font-bold text-amber-700' : 'text-gray-600'}`}>
                  <Calendar size={14} className={isToday(parseISO(v.visit_date)) ? 'text-amber-500' : 'text-gray-400'} />
                  {isToday(parseISO(v.visit_date)) ? 'Today' : format(parseISO(v.visit_date), 'dd MMM')}
                </span>
              </TableCell>
              <TableCell className="text-sm font-semibold text-gray-900 max-w-[140px] truncate py-3.5">
                {v.clients?.client_name || '-'}
              </TableCell>
              <TableCell className="text-sm text-gray-600 py-3.5">
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
        .select('id, quotation_no, status, client:clients(client_name), created_at, approval_status')
        .in('status', ['Pending Approval', 'Approved', 'Rejected'])
        .order('created_at', { ascending: false })
        .limit(8);
      if (error) throw error;
      return data || [];
    },
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (isLoading) return <CardSkeleton rows={3} />;

  if (quotations.length === 0) {
    return (
      <EmptyState
        message="No quotation approvals"
        icon={<FileText size={48} strokeWidth={1.5} className="text-purple-400" />}
        color="#a78bfa"
      />
    );
  }

  return (
    <div className="space-y-2 flex-1">
      {quotations.map((q: any) => (
        <div
          key={q.id}
          className="flex items-center justify-between p-3 rounded-xl bg-gray-50/50 hover:bg-purple-50/30 transition-colors duration-200 cursor-pointer group"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-purple-700 transition-colors">{q.quotation_no}</p>
            <p className="text-xs text-gray-500 truncate">{q.client?.client_name || '-'}</p>
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
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (isLoading) return <CardSkeleton rows={3} />;

  if (invoices.length === 0) {
    return (
      <EmptyState
        message="No recent invoices"
        icon={<Receipt size={48} strokeWidth={1.5} className="text-pink-400" />}
        color="#f472b6"
      />
    );
  }

  return (
    <div className="space-y-2 flex-1">
      {invoices.map((inv: any) => (
        <div
          key={inv.id}
          className="flex items-center justify-between p-3 rounded-xl bg-gray-50/50 hover:bg-pink-50/30 transition-colors duration-200 cursor-pointer group"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-pink-700 transition-colors">{inv.invoice_number || `INV-${inv.id?.slice(0, 6)}`}</p>
            <p className="text-xs text-gray-500 truncate">{inv.project?.project_name || '-'}</p>
          </div>
          <div className="text-right ml-2">
            {inv.total_amount && (
              <p className="text-sm font-bold text-gray-900">₹{Number(inv.total_amount).toLocaleString('en-IN')}</p>
            )}
            <p className="text-xs text-gray-400">
              {inv.invoice_date ? format(parseISO(inv.invoice_date), 'dd MMM') : ''}
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
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (isLoading) return <CardSkeleton rows={3} />;

  if (challans.length === 0) {
    return (
      <EmptyState
        message="No recent delivery challans"
        icon={<Truck size={48} strokeWidth={1.5} className="text-cyan-400" />}
        color="#22d3ee"
      />
    );
  }

  return (
    <div className="space-y-2 flex-1">
      {challans.map((dc: any) => (
        <div
          key={dc.id}
          className="flex items-center justify-between p-3 rounded-xl bg-gray-50/50 hover:bg-cyan-50/30 transition-colors duration-200 cursor-pointer group"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-cyan-700 transition-colors">{dc.dc_number}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-gray-500 truncate">{dc.client_name || '-'}</span>
              {dc.vehicle_number && (
                <span className="text-xs text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded-full font-medium border border-cyan-200">
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
          .select('id, visit_date, visited_by, status, created_at, clients(client_name)')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('delivery_challans')
          .select('id, dc_number, client_name, status, created_at')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('quotation_header')
          .select('id, quotation_no, status, created_at, client:clients(client_name)')
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      const items: any[] = [];

      (commsRes.data || []).forEach((c: any) =>
        items.push({ id: c.id, type: 'communication', text: c.call_brief || 'New communication', time: c.created_at, icon: <MessageSquare size={14} />, color: '#6366f1', bgColor: '#eef2ff' })
      );
      (visitsRes.data || []).forEach((v: any) =>
        items.push({ id: v.id, type: 'visit', text: `Visit: ${(v as any).clients?.client_name || 'Client'}`, time: v.created_at, icon: <MapPin size={14} />, color: '#3b82f6', bgColor: '#eff6ff' })
      );
      (dcRes.data || []).forEach((d: any) =>
        items.push({ id: d.id, type: 'dc', text: `DC: ${d.dc_number || d.client_name}`, time: d.created_at, icon: <Truck size={14} />, color: '#06b6d4', bgColor: '#ecfeff' })
      );
      (quotesRes.data || []).forEach((q: any) =>
        items.push({ id: q.id, type: 'quotation', text: `Quote: ${q.quotation_no}`, time: q.created_at, icon: <FileText size={14} />, color: '#a855f7', bgColor: '#faf5ff', status: q.status })
      );

      items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      return items.slice(0, 20);
    },
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm h-full flex flex-col overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center shadow-sm">
            <Activity size={18} className="text-white" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900 tracking-tight">Recent Updates</h3>
            <p className="text-xs text-gray-500">Activity across all modules</p>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto max-h-[420px] p-5">
        {isLoading ? (
          <CardSkeleton rows={8} />
        ) : recentItems.length === 0 ? (
          <EmptyState message="No recent activity" icon={<Activity size={48} strokeWidth={1.5} className="text-gray-400" />} color="#9ca3af" />
        ) : (
          <div className="relative">
            <div className="absolute left-[21px] top-3 bottom-3 w-0.5 bg-gradient-to-b from-gray-200 via-gray-300 to-gray-200 rounded-full" />
            <div className="space-y-1">
              {recentItems.map((item: any, i: number) => (
                <div
                  key={`${item.type}-${item.id}-${i}`}
                  className="flex items-start gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors duration-200 cursor-pointer relative group"
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 z-10 border-2 border-white shadow-sm transition-transform duration-200 group-hover:scale-105"
                    style={{ backgroundColor: item.bgColor, color: item.color }}
                  >
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0 pt-1.5">
                    <p className="text-sm font-semibold text-gray-900 truncate leading-snug group-hover:text-gray-700 transition-colors">{item.text}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {item.time ? formatDistanceToNow(parseISO(item.time), { addSuffix: true }) : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const CARD_CONTENT_MAP: Record<DashboardCardId, () => React.ReactNode> = {
  'today-site': () => <TodaySiteCard />,
  'approvals': () => <ApprovalsCard />,
  'client-communication': () => <ClientCommunicationCard />,
  'site-visit-plan': () => <SiteVisitPlanCard />,
  'quotation-approval': () => <QuotationApprovalCard />,
  'invoice': () => <InvoiceCard />,
  'delivery-challan': () => <DeliveryChallanCard />,
};

const CARD_CONFIG_MAP: Record<DashboardCardId, CardConfig> = DEFAULT_CARDS.reduce((acc, card) => {
  acc[card.id] = card;
  return acc;
}, {} as Record<DashboardCardId, CardConfig>);

export default function Dashboard({ onNavigate }: { onNavigate?: (path: string) => void }) {
  const { user, organisation } = useAuth();
  const queryClient = useQueryClient();
  const [collapsedCards, setCollapsedCards] = useState<Set<DashboardCardId>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const toggleCard = useCallback((id: DashboardCardId) => {
    setCollapsedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    invalidateDashboardQueries(queryClient);
    setTimeout(() => setIsRefreshing(false), 500);
  }, [queryClient]);

  const row1Cards = DEFAULT_CARDS.filter(c => c.row === 0);
  const row2Cards = DEFAULT_CARDS.filter(c => c.row === 1);
  const row3Cards = DEFAULT_CARDS.filter(c => c.row === 2);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-slate-100">
      <div className="px-6 py-5 border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-30 shadow-sm">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1 font-medium">
              {format(new Date(), 'EEEE, dd MMMM yyyy')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-full hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
            >
              <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
            {onNavigate && (
              <>
                <button
                  onClick={() => onNavigate('/dc/create')}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-full transition-all duration-200 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                >
                  <Plus size={16} />
                  Create DC
                </button>
                <button
                  onClick={() => onNavigate('/clients/new')}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-slate-700 bg-white border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-slate-200"
                >
                  <Building2 size={16} />
                  Add Client
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 py-8">
        <div className="flex gap-6">
          <div className="flex-1 min-w-0 space-y-6">
            <div className="grid gap-5 lg:grid-cols-3 items-stretch">
              {row1Cards.map((card) => (
                <DashboardCard
                  key={card.id}
                  config={card}
                  collapsed={collapsedCards.has(card.id)}
                  onToggle={() => toggleCard(card.id)}
                >
                  {CARD_CONTENT_MAP[card.id]()}
                </DashboardCard>
              ))}
            </div>

            <div className="grid gap-5 lg:grid-cols-2 items-stretch">
              {row2Cards.map((card) => (
                <DashboardCard
                  key={card.id}
                  config={card}
                  collapsed={collapsedCards.has(card.id)}
                  onToggle={() => toggleCard(card.id)}
                >
                  {CARD_CONTENT_MAP[card.id]()}
                </DashboardCard>
              ))}
            </div>

            <div className="grid gap-5 lg:grid-cols-2 items-stretch">
              {row3Cards.map((card) => (
                <DashboardCard
                  key={card.id}
                  config={card}
                  collapsed={collapsedCards.has(card.id)}
                  onToggle={() => toggleCard(card.id)}
                >
                  {CARD_CONTENT_MAP[card.id]()}
                </DashboardCard>
              ))}
            </div>
          </div>

          <div className="w-[360px] flex-shrink-0 hidden lg:block">
            <div className="sticky top-[100px]">
              <RecentUpdates />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
