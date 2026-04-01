import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
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
  ArrowUpRight,
  Activity,
  Plus,
  RefreshCw,
  Eye,
  MessageSquare,
  Package,
} from 'lucide-react';

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
  color: string;
  bgGradient: string;
  row: number;
};

const DEFAULT_CARDS: CardConfig[] = [
  { id: 'today-site', title: 'Today Site', icon: <MapPin size={18} />, color: '#3b82f6', bgGradient: 'from-blue-500/10 to-blue-500/5', row: 0 },
  { id: 'approvals', title: 'Approvals', icon: <CheckCircle size={18} />, color: '#10b981', bgGradient: 'from-emerald-500/10 to-emerald-500/5', row: 0 },
  { id: 'client-communication', title: 'Client Communication', icon: <Phone size={18} />, color: '#6366f1', bgGradient: 'from-indigo-500/10 to-indigo-500/5', row: 1 },
  { id: 'site-visit-plan', title: 'Site Visit Plan', icon: <Calendar size={18} />, color: '#f59e0b', bgGradient: 'from-amber-500/10 to-amber-500/5', row: 1 },
  { id: 'quotation-approval', title: 'Quotation Approval', icon: <FileText size={18} />, color: '#8b5cf6', bgGradient: 'from-violet-500/10 to-violet-500/5', row: 2 },
  { id: 'invoice', title: 'Invoice', icon: <Receipt size={18} />, color: '#ec4899', bgGradient: 'from-pink-500/10 to-pink-500/5', row: 2 },
  { id: 'delivery-challan', title: 'Delivery Challan', icon: <Truck size={18} />, color: '#14b8a6', bgGradient: 'from-teal-500/10 to-teal-500/5', row: 2 },
];

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
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto' as any,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col ${isDragging ? 'ring-2 ring-indigo-400/50' : ''}`}
    >
      <div className={`flex items-center justify-between px-5 py-3.5 bg-gradient-to-r ${config.bgGradient} border-b border-slate-100`}>
        <div className="flex items-center gap-3">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 p-0.5 -ml-1 rounded transition-colors"
            title="Drag to reorder"
          >
            <GripVertical size={16} />
          </button>
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: config.color + '18', color: config.color }}
          >
            {config.icon}
          </div>
          <h3 className="text-sm font-bold text-slate-800 tracking-tight">{config.title}</h3>
        </div>
        <button
          onClick={onToggle}
          className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-white/60 transition-all"
        >
          {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
      </div>
      {!collapsed && (
        <div className="flex-1 overflow-auto">{children}</div>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-slate-400">
      <Package size={28} strokeWidth={1.5} className="mb-2 text-slate-300" />
      <p className="text-xs font-medium">{message}</p>
    </div>
  );
}

function TodaySiteCard() {
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: visits = [], isLoading } = useQuery({
    queryKey: ['dashboard-today-sites', today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_visits')
        .select('*, clients(client_name)')
        .eq('visit_date', today)
        .order('in_time', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading) return <CardSkeleton rows={3} />;

  return (
    <div className="px-4 py-3">
      {visits.length === 0 ? (
        <EmptyState message="No site visits today" />
      ) : (
        <div className="space-y-2">
          {visits.map((v: any) => (
            <div key={v.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50/80 hover:bg-blue-50/60 transition-colors group">
              <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{v.clients?.client_name || 'Unknown Client'}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  {v.visited_by && (
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <User size={10} /> {v.visited_by}
                    </span>
                  )}
                  {v.purpose && (
                    <span className="text-xs text-slate-400 truncate">{v.purpose}</span>
                  )}
                </div>
              </div>
              <StatusPill status={v.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ApprovalsCard() {
  const { data: pendingApprovals = [], isLoading } = useQuery({
    queryKey: ['dashboard-approvals'],
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
  });

  if (isLoading) return <CardSkeleton rows={3} />;

  return (
    <div className="px-4 py-3">
      {pendingApprovals.length === 0 ? (
        <EmptyState message="No pending approvals" />
      ) : (
        <div className="space-y-2">
          {pendingApprovals.map((q: any) => (
            <div key={q.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/80 hover:bg-emerald-50/60 transition-colors">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800 truncate">{q.quotation_no}</p>
                <p className="text-xs text-slate-500 truncate">{q.client?.client_name || '—'}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusPill status={q.status} />
                <span className="text-[10px] text-slate-400">{q.created_at ? formatDistanceToNow(parseISO(q.created_at), { addSuffix: true }) : ''}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ClientCommunicationCard() {
  const { data: comms = [], isLoading } = useQuery({
    queryKey: ['dashboard-client-comms'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_communication')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(8);
      if (error) throw error;
      return data || [];
    },
    staleTime: 2 * 60 * 1000,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['dashboard-clients-lookup'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id, client_name').order('client_name');
      if (error) throw error;
      return data || [];
    },
    staleTime: 10 * 60 * 1000,
  });

  const clientMap = useMemo(() => {
    const m = new Map<string, string>();
    clients.forEach((c: any) => m.set(c.id, c.client_name));
    return m;
  }, [clients]);

  if (isLoading) return <CardSkeleton rows={4} />;

  return (
    <div className="px-1 py-2">
      {comms.length === 0 ? (
        <EmptyState message="No recent communications" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-3 py-2 text-[11px] font-bold text-blue-600 uppercase tracking-wider">Created By</th>
                <th className="px-3 py-2 text-[11px] font-bold text-blue-600 uppercase tracking-wider">Client</th>
                <th className="px-3 py-2 text-[11px] font-bold text-blue-600 uppercase tracking-wider">Call Brief</th>
              </tr>
            </thead>
            <tbody>
              {comms.map((c: any) => (
                <tr key={c.id} className="border-b border-slate-50 hover:bg-indigo-50/40 transition-colors">
                  <td className="px-3 py-2.5 text-xs text-slate-600">{c.call_entered_by || c.call_received_by || '—'}</td>
                  <td className="px-3 py-2.5 text-xs font-medium text-slate-800 max-w-[140px] truncate">{clientMap.get(c.client_id) || '—'}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-500 max-w-[200px] truncate">{c.call_brief || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SiteVisitPlanCard() {
  const { data: visits = [], isLoading } = useQuery({
    queryKey: ['dashboard-visit-plan'],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('site_visits')
        .select('*, clients(client_name)')
        .gte('visit_date', today)
        .in('status', ['pending', 'scheduled'])
        .order('visit_date', { ascending: true })
        .limit(8);
      if (error) throw error;
      return data || [];
    },
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading) return <CardSkeleton rows={4} />;

  return (
    <div className="px-1 py-2">
      {visits.length === 0 ? (
        <EmptyState message="No upcoming visits" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-3 py-2 text-[11px] font-bold text-amber-600 uppercase tracking-wider">Date</th>
                <th className="px-3 py-2 text-[11px] font-bold text-amber-600 uppercase tracking-wider">Client</th>
                <th className="px-3 py-2 text-[11px] font-bold text-amber-600 uppercase tracking-wider">Visit By</th>
              </tr>
            </thead>
            <tbody>
              {visits.map((v: any) => (
                <tr key={v.id} className="border-b border-slate-50 hover:bg-amber-50/40 transition-colors">
                  <td className="px-3 py-2.5 text-xs text-slate-600 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 ${isToday(parseISO(v.visit_date)) ? 'text-amber-600 font-semibold' : ''}`}>
                      <Calendar size={10} />
                      {format(parseISO(v.visit_date), 'dd MMM')}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs font-medium text-slate-800 max-w-[140px] truncate">{v.clients?.client_name || '—'}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">{v.visited_by || v.engineer || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function QuotationApprovalCard() {
  const { data: quotations = [], isLoading } = useQuery({
    queryKey: ['dashboard-quotation-approval'],
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
  });

  if (isLoading) return <CardSkeleton rows={3} />;

  return (
    <div className="px-4 py-3">
      {quotations.length === 0 ? (
        <EmptyState message="No quotation approvals" />
      ) : (
        <div className="space-y-2">
          {quotations.map((q: any) => (
            <div key={q.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/80 hover:bg-violet-50/60 transition-colors">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800">{q.quotation_no}</p>
                <p className="text-xs text-slate-500 truncate">{q.client?.client_name || '—'}</p>
              </div>
              <StatusPill status={q.approval_status || q.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InvoiceCard() {
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['dashboard-invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_invoices')
        .select('*, project:project_id(project_name)')
        .order('invoice_date', { ascending: false })
        .limit(8);
      if (error) throw error;
      return data || [];
    },
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading) return <CardSkeleton rows={3} />;

  return (
    <div className="px-4 py-3">
      {invoices.length === 0 ? (
        <EmptyState message="No recent invoices" />
      ) : (
        <div className="space-y-2">
          {invoices.map((inv: any) => (
            <div key={inv.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/80 hover:bg-pink-50/60 transition-colors">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800">{inv.invoice_number || `INV-${inv.id?.slice(0, 6)}`}</p>
                <p className="text-xs text-slate-500 truncate">{inv.project?.project_name || '—'}</p>
              </div>
              <div className="text-right">
                {inv.total_amount && <p className="text-xs font-bold text-slate-800">₹{Number(inv.total_amount).toLocaleString('en-IN')}</p>}
                <p className="text-[10px] text-slate-400">{inv.invoice_date ? format(parseISO(inv.invoice_date), 'dd MMM') : ''}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DeliveryChallanCard() {
  const { data: challans = [], isLoading } = useQuery({
    queryKey: ['dashboard-delivery-challans'],
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
  });

  if (isLoading) return <CardSkeleton rows={3} />;

  return (
    <div className="px-4 py-3">
      {challans.length === 0 ? (
        <EmptyState message="No recent delivery challans" />
      ) : (
        <div className="space-y-2">
          {challans.map((dc: any) => (
            <div key={dc.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/80 hover:bg-teal-50/60 transition-colors">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800">{dc.dc_number}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-slate-500 truncate">{dc.client_name || '—'}</span>
                  {dc.vehicle_number && <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{dc.vehicle_number}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusPill status={dc.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RecentUpdates() {
  const { data: recentItems = [], isLoading } = useQuery({
    queryKey: ['dashboard-recent-updates'],
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
        items.push({ id: d.id, type: 'dc', text: `DC: ${d.dc_number || d.client_name}`, time: d.created_at, icon: <Truck size={14} />, color: '#14b8a6' })
      );
      (quotesRes.data || []).forEach((q: any) =>
        items.push({ id: q.id, type: 'quotation', text: `Quote: ${q.quotation_no}`, time: q.created_at, icon: <FileText size={14} />, color: '#8b5cf6', status: q.status })
      );

      items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      return items.slice(0, 20);
    },
    staleTime: 2 * 60 * 1000,
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm h-full flex flex-col overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center">
            <Activity size={16} className="text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 tracking-tight">Recent Updates</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Activity across all modules</p>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {isLoading ? (
          <CardSkeleton rows={8} />
        ) : recentItems.length === 0 ? (
          <EmptyState message="No recent activity" />
        ) : (
          <div className="relative">
            <div className="absolute left-[15px] top-2 bottom-2 w-px bg-slate-100" />
            <div className="space-y-1">
              {recentItems.map((item: any, i: number) => (
                <div key={`${item.type}-${item.id}-${i}`} className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors relative">
                  <div
                    className="w-[30px] h-[30px] rounded-full flex items-center justify-center flex-shrink-0 z-10"
                    style={{ backgroundColor: item.color + '14', color: item.color }}
                  >
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className="text-xs font-medium text-slate-700 truncate leading-snug">{item.text}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
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

function StatusPill({ status }: { status: string }) {
  const s = (status || '').toLowerCase();
  let bg = 'bg-slate-100';
  let text = 'text-slate-600';

  if (s === 'completed' || s === 'approved' || s === 'active') { bg = 'bg-emerald-50'; text = 'text-emerald-700'; }
  else if (s === 'pending' || s === 'pending approval' || s === 'draft') { bg = 'bg-amber-50'; text = 'text-amber-700'; }
  else if (s === 'scheduled') { bg = 'bg-blue-50'; text = 'text-blue-700'; }
  else if (s === 'cancelled' || s === 'rejected') { bg = 'bg-red-50'; text = 'text-red-700'; }
  else if (s === 'postponed') { bg = 'bg-slate-100'; text = 'text-slate-600'; }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${bg} ${text}`}>
      {status || '—'}
    </span>
  );
}

function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="px-4 py-3 space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-100 animate-pulse" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 bg-slate-100 rounded-md animate-pulse w-3/4" />
            <div className="h-2 bg-slate-50 rounded-md animate-pulse w-1/2" />
          </div>
        </div>
      ))}
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

export default function Dashboard({ onNavigate }: { onNavigate?: (path: string) => void }) {
  const { user, organisation } = useAuth();
  const [cardOrder, setCardOrder] = useState<DashboardCardId[]>(DEFAULT_CARDS.map(c => c.id));
  const [collapsedCards, setCollapsedCards] = useState<Set<DashboardCardId>>(new Set());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setCardOrder(prev => {
      const oldIndex = prev.indexOf(active.id as DashboardCardId);
      const newIndex = prev.indexOf(over.id as DashboardCardId);
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

  const toggleCard = useCallback((id: DashboardCardId) => {
    setCollapsedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const configMap = useMemo(() => {
    const m = new Map<DashboardCardId, CardConfig>();
    DEFAULT_CARDS.forEach(c => m.set(c.id, c));
    return m;
  }, []);

  const row1 = cardOrder.filter(id => configMap.get(id)?.row === 0);
  const row2 = cardOrder.filter(id => configMap.get(id)?.row === 1);
  const row3 = cardOrder.filter(id => configMap.get(id)?.row === 2);

  return (
    <div className="min-h-screen bg-slate-50/50 font-['Inter',system-ui,sans-serif]">
      <div className="px-6 py-5 border-b border-slate-200/60 bg-white/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Dashboard</h1>
            <p className="text-xs text-slate-400 mt-0.5 font-medium">{format(new Date(), 'EEEE, dd MMMM yyyy')}</p>
          </div>
          <div className="flex items-center gap-2">
            {onNavigate && (
              <>
                <button
                  onClick={() => onNavigate('/dc/create')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-500/20 transition-all"
                >
                  <Plus size={14} /> Create DC
                </button>
                <button
                  onClick={() => onNavigate('/clients/new')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all"
                >
                  <Building2 size={14} /> Add Client
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 py-6">
        <div className="flex gap-6">
          <div className="flex-1 min-w-0">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <div className="space-y-5">
                {[row1, row2, row3].map((rowCards, ri) => (
                  <SortableContext key={ri} items={rowCards} strategy={rectSortingStrategy}>
                    <div className={`grid gap-5 ${rowCards.length === 3 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'}`}>
                      {rowCards.map(id => {
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
          </div>

          <div className="w-[320px] flex-shrink-0 hidden lg:block">
            <div className="sticky top-[85px]" style={{ maxHeight: 'calc(100vh - 110px)' }}>
              <RecentUpdates />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
