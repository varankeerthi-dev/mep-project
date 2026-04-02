import { useEffect, useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

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
import { useAuth } from '../App';
import { format, formatDistanceToNow, isToday, parseISO } from 'date-fns';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
  GripVertical,
  Clock,
  User,
  Building2,
  AlertCircle,
  Activity,
  Plus,
  Eye,
  MessageSquare,
  Package,
  FileCheck,
  CreditCard,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../components/ui/table';

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
  { id: 'client-communication', title: 'Client Communication', icon: <Phone size={18} />, iconColor: '#6366f1', row: 1 },
  { id: 'site-visit-plan', title: 'Site Visit Plan', icon: <Calendar size={18} />, iconColor: '#f59e0b', row: 1 },
  { id: 'quotation-approval', title: 'Quotation Approval', icon: <FileText size={18} />, iconColor: '#a855f7', row: 2 },
  { id: 'invoice', title: 'Invoice', icon: <Receipt size={18} />, iconColor: '#ec4899', row: 2 },
  { id: 'delivery-challan', title: 'Delivery Challan', icon: <Truck size={18} />, iconColor: '#06b6d4', row: 2 },
];

function StatusBadge({ status }: { status: string }) {
  const s = (status || '').toLowerCase();
  let variant: 'default' | 'success' | 'warning' | 'error' | 'info' | 'neutral' = 'neutral';

  if (s === 'completed' || s === 'approved' || s === 'active') variant = 'success';
  else if (s === 'pending' || s === 'pending approval' || s === 'draft') variant = 'warning';
  else if (s === 'scheduled') variant = 'info';
  else if (s === 'cancelled' || s === 'rejected') variant = 'error';

  return <Badge variant={variant} size="sm">{status || '-'}</Badge>;
}

function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="p-4 space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="w-8 h-8 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-2 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ message, icon }: { message: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
      {icon || <Package size={48} strokeWidth={1} className="mb-2" />}
      <p className="text-sm">{message}</p>
    </div>
  );
}

function DashboardCardFrame({
  config,
  collapsed,
  onToggle,
  dragHandle,
  children,
}: {
  config: CardConfig;
  collapsed: boolean;
  onToggle: () => void;
  dragHandle?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${config.iconColor}15`, color: config.iconColor }}
          >
            {config.icon}
          </div>
          <CardTitle className="text-base">{config.title}</CardTitle>
          {dragHandle}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="p-1.5"
        >
          <ChevronUp
            size={16}
            className={`transition-transform ${collapsed ? 'rotate-180' : ''}`}
          />
        </Button>
      </CardHeader>
      {!collapsed && <CardContent className="flex-1 overflow-auto pt-0">{children}</CardContent>}
    </Card>
  );
}

function SortableCard({
  id,
  config,
  collapsed,
  onToggle,
  children,
}: {
  id: string;
  config: CardConfig;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({
    id,
    animateLayoutChanges: () => false,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: undefined,
    opacity: isDragging ? 0.65 : 1,
    zIndex: isDragging ? 50 : 'auto',
  };

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? 'ring-2 ring-slate-200 rounded-lg' : undefined}>
      <DashboardCardFrame
        config={config}
        collapsed={collapsed}
        onToggle={onToggle}
        dragHandle={
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 rounded-lg hover:bg-slate-100 transition-colors ml-1"
            title="Drag to reorder"
            type="button"
          >
            <GripVertical size={14} className="text-muted-foreground" />
          </button>
        }
      >
        {children}
      </DashboardCardFrame>
    </div>
  );
}

function StaticCard({
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
    <DashboardCardFrame config={config} collapsed={collapsed} onToggle={onToggle}>
      {children}
    </DashboardCardFrame>
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
        icon={<MapPin size={48} strokeWidth={1} className="text-muted-foreground" />}
      />
    );
  }

  return (
    <div className="space-y-2">
      {visits.map((v: any) => (
        <div
          key={v.id}
          className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100"
        >
          <div className="w-2 h-2 rounded-full bg-slate-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{v.clients?.client_name || 'Unknown Client'}</p>
            <div className="flex items-center gap-3 mt-0.5">
              {v.visited_by && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <User size={10} /> {v.visited_by}
                </span>
              )}
              {v.purpose && (
                <span className="text-xs text-muted-foreground truncate">{v.purpose}</span>
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
        icon={<CheckCircle size={48} strokeWidth={1} className="text-muted-foreground" />}
      />
    );
  }

  return (
    <div className="space-y-2">
      {pendingApprovals.map((q: any) => (
        <div
          key={q.id}
          className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground truncate">{q.quotation_no}</p>
            <p className="text-xs text-muted-foreground truncate">{q.client?.client_name || '-'}</p>
          </div>
          <div className="flex items-center gap-2 ml-2">
            <StatusBadge status={q.status} />
            <span className="text-xs text-muted-foreground whitespace-nowrap">
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
        icon={<Phone size={48} strokeWidth={1} className="text-muted-foreground" />}
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-slate-100">
            <TableHead className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Created By</TableHead>
            <TableHead className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Client</TableHead>
            <TableHead className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Call Brief</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {comms.map((c: any) => (
            <TableRow key={c.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
              <TableCell className="text-sm text-foreground py-3">{c.call_entered_by || c.call_received_by || '-'}</TableCell>
              <TableCell className="text-sm font-medium text-foreground max-w-[140px] truncate py-3">
                {clientMap.get(c.client_id) || '-'}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate py-3">
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
        icon={<Calendar size={48} strokeWidth={1} className="text-muted-foreground" />}
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-slate-100">
            <TableHead className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Date</TableHead>
            <TableHead className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Client</TableHead>
            <TableHead className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Visit By</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visits.map((v: any) => (
            <TableRow key={v.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
              <TableCell className="text-sm text-foreground whitespace-nowrap py-3">
                <span className={`flex items-center gap-1 ${isToday(parseISO(v.visit_date)) ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                  <Calendar size={12} />
                  {format(parseISO(v.visit_date), 'dd MMM')}
                </span>
              </TableCell>
              <TableCell className="text-sm font-medium text-foreground max-w-[140px] truncate py-3">
                {v.clients?.client_name || '-'}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground py-3">
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
        icon={<FileText size={48} strokeWidth={1} className="text-muted-foreground" />}
      />
    );
  }

  return (
    <div className="space-y-2">
      {quotations.map((q: any) => (
        <div
          key={q.id}
          className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">{q.quotation_no}</p>
            <p className="text-xs text-muted-foreground truncate">{q.client?.client_name || '-'}</p>
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
        icon={<Receipt size={48} strokeWidth={1} className="text-muted-foreground" />}
      />
    );
  }

  return (
    <div className="space-y-2">
      {invoices.map((inv: any) => (
        <div
          key={inv.id}
          className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">{inv.invoice_number || `INV-${inv.id?.slice(0, 6)}`}</p>
            <p className="text-xs text-muted-foreground truncate">{inv.project?.project_name || '-'}</p>
          </div>
          <div className="text-right ml-2">
            {inv.total_amount && (
              <p className="text-sm font-semibold text-foreground">₹{Number(inv.total_amount).toLocaleString('en-IN')}</p>
            )}
            <p className="text-xs text-muted-foreground">
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
        icon={<Truck size={48} strokeWidth={1} className="text-muted-foreground" />}
      />
    );
  }

  return (
    <div className="space-y-2">
      {challans.map((dc: any) => (
        <div
          key={dc.id}
          className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">{dc.dc_number}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-muted-foreground truncate">{dc.client_name || '-'}</span>
              {dc.vehicle_number && (
                <span className="text-xs text-muted-foreground bg-slate-100 px-1.5 py-0.5 rounded">
                  {dc.vehicle_number}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 ml-2">
            <StatusBadge status={dc.status} />
          </div>
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
        items.push({ id: c.id, type: 'communication', text: c.call_brief || 'New communication', time: c.created_at, icon: <MessageSquare size={14} />, color: '#6366f1' })
      );
      (visitsRes.data || []).forEach((v: any) =>
        items.push({ id: v.id, type: 'visit', text: `Visit: ${(v as any).clients?.client_name || 'Client'}`, time: v.created_at, icon: <MapPin size={14} />, color: '#3b82f6' })
      );
      (dcRes.data || []).forEach((d: any) =>
        items.push({ id: d.id, type: 'dc', text: `DC: ${d.dc_number || d.client_name}`, time: d.created_at, icon: <Truck size={14} />, color: '#06b6d4' })
      );
      (quotesRes.data || []).forEach((q: any) =>
        items.push({ id: q.id, type: 'quotation', text: `Quote: ${q.quotation_no}`, time: q.created_at, icon: <FileText size={14} />, color: '#a855f7', status: q.status })
      );

      items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      return items.slice(0, 20);
    },
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center">
            <Activity size={18} className="text-white" />
          </div>
          <div>
            <CardTitle className="text-base">Recent Updates</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Activity across all modules</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto pt-0">
        {isLoading ? (
          <CardSkeleton rows={8} />
        ) : recentItems.length === 0 ? (
          <EmptyState message="No recent activity" icon={<Activity size={48} strokeWidth={1} className="text-muted-foreground" />} />
        ) : (
          <div className="relative">
            <div className="absolute left-[19px] top-2 bottom-2 w-px bg-slate-100" />
            <div className="space-y-1">
              {recentItems.map((item: any, i: number) => (
                <div
                  key={`${item.type}-${item.id}-${i}`}
                  className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors relative"
                >
                  <div
                    className="w-[38px] h-[38px] rounded-full flex items-center justify-center flex-shrink-0 z-10"
                    style={{ backgroundColor: `${item.color}15`, color: item.color }}
                  >
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0 pt-1.5">
                    <p className="text-sm font-medium text-foreground truncate leading-snug">{item.text}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.time ? formatDistanceToNow(parseISO(item.time), { addSuffix: true }) : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
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

export default function Dashboard({ onNavigate }: { onNavigate?: (path: string) => void }) {
  const { user, organisation } = useAuth();
  const queryClient = useQueryClient();
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cardOrder, setCardOrder] = useState<DashboardCardId[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_CARDS.map((c) => c.id);

    try {
      const raw = window.localStorage.getItem('dashboard-card-order');
      if (!raw) return DEFAULT_CARDS.map((c) => c.id);
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return DEFAULT_CARDS.map((c) => c.id);

      const allowed = new Set(DEFAULT_CARDS.map((c) => c.id));
      const next = parsed.filter((id) => allowed.has(id)) as DashboardCardId[];
      const missing = DEFAULT_CARDS.map((c) => c.id).filter((id) => !next.includes(id));
      return [...next, ...missing];
    } catch {
      return DEFAULT_CARDS.map((c) => c.id);
    }
  });
  const [collapsedCards, setCollapsedCards] = useState<Set<DashboardCardId>>(new Set());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setCardOrder((prev) => {
      const oldIndex = prev.indexOf(active.id as DashboardCardId);
      const newIndex = prev.indexOf(over.id as DashboardCardId);
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

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

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      window.localStorage.setItem('dashboard-card-order', JSON.stringify(cardOrder));
    } catch {
      // ignore storage failures (quota/private mode)
    }
  }, [cardOrder]);

  const configMap = useMemo(() => {
    const m = new Map<DashboardCardId, CardConfig>();
    DEFAULT_CARDS.forEach((c) => m.set(c.id, c));
    return m;
  }, []);

  const row1 = cardOrder.filter((id) => configMap.get(id)?.row === 0);
  const row2 = cardOrder.filter((id) => configMap.get(id)?.row === 1);
  const row3 = cardOrder.filter((id) => configMap.get(id)?.row === 2);

  return (
    <div className="min-h-screen bg-background">
      <div className="px-6 py-5 border-b border-border bg-card sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {format(new Date(), 'EEEE, dd MMMM yyyy')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRefresh}
              leftIcon={<RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />}
              disabled={isRefreshing}
            >
              Refresh
            </Button>
            <Button
              variant={isReorderMode ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setIsReorderMode((prev) => !prev)}
              leftIcon={<GripVertical size={14} />}
            >
              {isReorderMode ? 'Done' : 'Reorder'}
            </Button>
            {onNavigate && (
              <>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => onNavigate('/dc/create')}
                  leftIcon={<Plus size={14} />}
                >
                  Create DC
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onNavigate('/clients/new')}
                  leftIcon={<Building2 size={14} />}
                >
                  Add Client
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 py-6">
        <div className="flex gap-6">
          <div className="flex-1 min-w-0">
            {isReorderMode ? (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <div className="space-y-6">
                  {[row1, row2, row3].map((rowCards, ri) => (
                    <SortableContext key={ri} items={rowCards} strategy={rectSortingStrategy}>
                      <div className={`grid gap-6 ${rowCards.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
                        {rowCards.map((id) => {
                          const config = configMap.get(id)!;
                          return (
                            <SortableCard
                              key={id}
                              id={id}
                              config={config}
                              collapsed={collapsedCards.has(id)}
                              onToggle={() => toggleCard(id)}
                            >
                              {CARD_CONTENT_MAP[id]()}
                            </SortableCard>
                          );
                        })}
                      </div>
                    </SortableContext>
                  ))}
                </div>
              </DndContext>
            ) : (
              <div className="space-y-6">
                {[row1, row2, row3].map((rowCards, ri) => (
                  <div
                    key={ri}
                    className={`grid gap-6 ${rowCards.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}
                  >
                    {rowCards.map((id) => {
                      const config = configMap.get(id)!;
                      return (
                        <StaticCard
                          key={id}
                          config={config}
                          collapsed={collapsedCards.has(id)}
                          onToggle={() => toggleCard(id)}
                        >
                          {CARD_CONTENT_MAP[id]()}
                        </StaticCard>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="w-[340px] flex-shrink-0 hidden lg:block">
            <div className="sticky top-[89px]" style={{ maxHeight: 'calc(100vh - 110px)' }}>
              <RecentUpdates />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
