import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { ChevronLeft, ShoppingCart, FileText, ClipboardList } from 'lucide-react';

interface PurchaseModuleProps {
  onBack: () => void;
  isDemo?: boolean;
}

interface POItem {
  id: string;
  po_no?: string;
  vendor_name?: string;
  total_amount?: number;
  status?: string;
  order_date?: string;
}

interface RequisitionItem {
  id: string;
  requisition_no?: string;
  title?: string;
  status?: string;
  created_at?: string;
}

type View = 'orders' | 'requisitions' | 'pending';

const DEMO_ORDERS: POItem[] = [
  { id: 'o1', po_no: 'PO-2026-011', vendor_name: 'Steel Mart Pvt Ltd', total_amount: 850000, status: 'APPROVED', order_date: '2026-06-28' },
  { id: 'o2', po_no: 'PO-2026-012', vendor_name: 'Cement Co', total_amount: 430000, status: 'PENDING', order_date: '2026-07-03' },
  { id: 'o3', po_no: 'PO-2026-013', vendor_name: 'Pipe Suppliers', total_amount: 210000, status: 'APPROVED', order_date: '2026-07-06' },
];

const DEMO_REQS: RequisitionItem[] = [
  { id: 'r1', requisition_no: 'PR-2026-007', title: 'Rebar 12mm - 5T', status: 'PENDING', created_at: '2026-07-04' },
  { id: 'r2', requisition_no: 'PR-2026-008', title: 'MS Angle 50x50', status: 'APPROVED', created_at: '2026-07-02' },
  { id: 'r3', requisition_no: 'PR-2026-009', title: 'PVC Pipes 110mm', status: 'PENDING', created_at: '2026-07-07' },
];

const fmtDate = (d?: string) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const STATUS_COLORS: Record<string, string> = {
  approved: 'bg-green-500/10 text-green-600',
  pending: 'bg-amber-500/10 text-amber-600',
  rejected: 'bg-red-500/10 text-red-600',
  cancelled: 'bg-red-500/10 text-red-600',
  draft: 'bg-zinc-500/10 text-zinc-500',
  completed: 'bg-green-500/10 text-green-600',
};

const statusPill = (s?: string) => {
  const key = (s || '').toLowerCase();
  const cls = STATUS_COLORS[key] || 'bg-secondary text-muted-foreground';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {s || 'N/A'}
    </span>
  );
};

const formatCurrency = (n?: number) => {
  if (n == null) return '—';
  return '₹' + Number(n).toLocaleString('en-IN');
};

const isPending = (s?: string) => {
  const str = (s || '').toLowerCase();
  return str.includes('pending') || str.includes('await') || str.includes('submitted');
};

const TABS: { key: View; label: string; count: number; Icon: any }[] = [
  { key: 'orders', label: 'Orders', count: 0, Icon: ShoppingCart },
  { key: 'requisitions', label: 'Requisitions', count: 0, Icon: FileText },
  { key: 'pending', label: 'Pending Approval', count: 0, Icon: ClipboardList },
];

export const PurchaseModule: React.FC<PurchaseModuleProps> = ({ onBack, isDemo = false }) => {
  const [view, setView] = useState<View>('orders');
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<POItem[]>([]);
  const [requisitions, setRequisitions] = useState<RequisitionItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isDemo) {
      setOrders(DEMO_ORDERS);
      setRequisitions(DEMO_REQS);
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

      const [poRes, reqRes] = await Promise.all([
        supabase.from('purchase_orders').select('id, po_no, vendor_name, total_amount, status, order_date').eq('organisation_id', orgId).order('order_date', { ascending: false }),
        supabase.from('purchase_requisitions').select('id, requisition_no, title, status, created_at').eq('organisation_id', orgId).order('created_at', { ascending: false }),
      ]);

      setOrders((poRes.data as POItem[]) || []);
      setRequisitions((reqRes.data as RequisitionItem[]) || []);
    } catch (err: any) {
      console.error('Purchase module load error:', err);
      setError(err?.message || 'Failed to load purchase data');
    } finally {
      setLoading(false);
    }
  };

  const pendingRequisitions = useMemo(() => requisitions.filter(r => isPending(r.status)), [requisitions]);
  const pendingOrders = useMemo(() => orders.filter(o => isPending(o.status)), [orders]);
  const pendingCount = pendingRequisitions.length + pendingOrders.length;

  const counts = useMemo(() => ({
    orders: orders.length,
    requisitions: requisitions.length,
    pending: pendingCount,
  }), [orders, requisitions, pendingCount]);

  const renderOrders = (list: POItem[]) => list.length === 0 ? (
    <div className="glass-card rounded-2xl p-6 text-center text-base text-muted-foreground">No purchase orders found.</div>
  ) : (
    <div className="space-y-3">
      {list.map(o => (
        <div key={o.id} className="glass-card rounded-xl p-4 flex items-center justify-between border border-border/50">
          <div className="space-y-1 min-w-0">
            <p className="text-base font-semibold text-foreground truncate">{o.po_no || 'PO'}</p>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider truncate">{o.vendor_name || '—'}</p>
          </div>
          <div className="text-right space-y-1">
            <p className="text-base font-bold text-foreground tabular-nums">{formatCurrency(o.total_amount)}</p>
            {statusPill(o.status)}
          </div>
        </div>
      ))}
    </div>
  );

  const renderReqs = (list: RequisitionItem[]) => list.length === 0 ? (
    <div className="glass-card rounded-2xl p-6 text-center text-base text-muted-foreground">No requisitions found.</div>
  ) : (
    <div className="space-y-3">
      {list.map(r => (
        <div key={r.id} className="glass-card rounded-xl p-4 flex items-center justify-between border border-border/50">
          <div className="space-y-1 min-w-0">
            <p className="text-base font-semibold text-foreground truncate">{r.requisition_no || 'PR'}</p>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider truncate">{r.title || '—'}</p>
          </div>
          <div className="text-right space-y-1">
            <p className="text-sm font-medium text-foreground tabular-nums">{fmtDate(r.created_at)}</p>
            {statusPill(r.status)}
          </div>
        </div>
      ))}
    </div>
  );

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
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Purchase</h1>
        </div>
      </motion.header>

      {/* Sub-tabs */}
      <div className="flex px-4 pt-3 pb-0 bg-card border-b border-border">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
              view === key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{label}</span>
            <span className="text-xs text-muted-foreground/70">({counts[key]})</span>
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
            {view === 'orders' && renderOrders(orders)}
            {view === 'requisitions' && renderReqs(requisitions)}
            {view === 'pending' && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Pending Requisitions ({pendingRequisitions.length})</p>
                  {renderReqs(pendingRequisitions)}
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Pending Orders ({pendingOrders.length})</p>
                  {renderOrders(pendingOrders)}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};
