import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { useRequisitionLinesForSourcing } from '../hooks/usePurchaseQueries';
import {
  ShoppingCart, Warehouse, AlertTriangle, CheckCircle,
  Clock, ArrowRight, AlertCircle, RefreshCw, FileText, Building2
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { organisation } = useAuth();
  const { data: lines = [], isLoading } = useRequisitionLinesForSourcing(organisation?.id);
  const navigate = useNavigate();

  const stats = useMemo(() => {
    const total = lines.length;
    const totalRemaining = lines.reduce((s, l) => s + Number(l.open_qty || 0), 0);
    const overdue = lines.filter(l => {
      const d = l.required_date || l.requisition?.required_date;
      return d && new Date(d) < new Date();
    });
    const withResponses = lines.filter(l => {
      return false; // computed below
    });
    return { total, totalRemaining, overdue, overdueCount: overdue.length, totalReqQty: lines.reduce((s, l) => s + Number(l.requested_qty || 0), 0) };
  }, [lines]);

  const priorityBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    lines.forEach(l => {
      const p = l.requisition?.priority || 'Normal';
      map[p] = (map[p] || 0) + 1;
    });
    return map;
  }, [lines]);

  const cards = [
    {
      label: 'Lines to Source',
      value: stats.total,
      detail: `${stats.totalRemaining} qty remaining`,
      icon: ShoppingCart,
      color: 'text-blue-700',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      onClick: () => navigate('/purchase/inquiries'),
    },
    {
      label: 'Overdue',
      value: stats.overdueCount,
      detail: 'past required date',
      icon: AlertCircle,
      color: 'text-red-700',
      bg: 'bg-red-50',
      border: 'border-red-200',
      onClick: () => navigate('/purchase/inquiries'),
      urgent: true,
    },
    {
      label: 'Emergency Priority',
      value: priorityBreakdown['Emergency'] || 0,
      detail: 'lines',
      icon: AlertTriangle,
      color: 'text-rose-700',
      bg: 'bg-rose-50',
      border: 'border-rose-200',
      onClick: () => navigate('/purchase/inquiries'),
    },
    {
      label: 'Total Requested',
      value: stats.totalReqQty,
      detail: 'across all items',
      icon: FileText,
      color: 'text-zinc-700',
      bg: 'bg-zinc-50',
      border: 'border-zinc-200',
      onClick: () => navigate('/purchase/inquiries'),
    },
  ];

  const quickLinks = [
    { label: 'Sourcing Board', path: '/purchase/inquiries', icon: ShoppingCart, desc: 'Source items from store or send to purchase' },
    { label: 'Vendor Inquiries', path: '/purchase/inquiries', icon: Building2, desc: 'Manage vendor responses & convert to PO' },
    { label: 'Requisitions', path: '/purchase/requisitions', icon: FileText, desc: 'View & manage purchase requisitions' },
    { label: 'Purchase Orders', path: '/purchase/orders', icon: FileText, desc: 'Create & manage purchase orders' },
  ];

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-zinc-100 rounded w-48" />
          <div className="grid grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="h-24 bg-zinc-100 rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-zinc-900">Purchase Dashboard</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            {stats.total} lines need sourcing · {stats.overdueCount} overdue
          </p>
        </div>
        <button
          onClick={() => navigate('/purchase/inquiries')}
          className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          Go to Sourcing Board
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((card) => (
          <button
            key={card.label}
            onClick={card.onClick}
            className={`relative flex flex-col items-start p-4 rounded-xl border ${card.border} ${card.bg} hover:shadow-md transition-all text-left ${card.urgent && stats.overdueCount > 0 ? 'animate-pulse' : ''}`}
          >
            <div className={`flex items-center gap-2 mb-2 ${card.color}`}>
              <card.icon className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-widest">{card.label}</span>
            </div>
            <span className="text-2xl font-black text-zinc-900 tabular-nums">{card.value}</span>
            <span className="text-[10px] text-zinc-500 mt-0.5">{card.detail}</span>
            {card.urgent && stats.overdueCount > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 animate-ping" />
            )}
          </button>
        ))}
      </div>

      {/* Priority & urgency bar */}
      <div className="border border-zinc-200 rounded-xl bg-white p-4">
        <h2 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3">Priority Breakdown</h2>
        <div className="flex items-center gap-4">
          {['Emergency', 'High', 'Normal', 'Low'].map(p => {
            const count = priorityBreakdown[p] || 0;
            const total = stats.total || 1;
            const pct = Math.round((count / total) * 100);
            const colors: Record<string, string> = {
              Emergency: 'bg-red-500',
              High: 'bg-amber-500',
              Normal: 'bg-blue-500',
              Low: 'bg-zinc-300',
            };
            return (
              <div key={p} className="flex-1">
                <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-1">
                  <span className="font-bold">{p}</span>
                  <span className="font-semibold">{count}</span>
                </div>
                <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${colors[p]}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3">Quick Links</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {quickLinks.map((link) => (
            <button
              key={link.label}
              onClick={() => navigate(link.path)}
              className="flex items-center gap-3 p-3 rounded-xl border border-zinc-200 bg-white hover:border-blue-200 hover:shadow-sm transition-all text-left group"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <link.icon className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-zinc-900 group-hover:text-blue-700 transition-colors">{link.label}</div>
                <div className="text-[9px] text-zinc-400 truncate">{link.desc}</div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-zinc-300 group-hover:text-blue-500 transition-colors shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
