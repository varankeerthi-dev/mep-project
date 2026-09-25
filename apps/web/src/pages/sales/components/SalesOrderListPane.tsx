import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { formatCurrency } from '../../../utils/formatters';
import { Search as SearchIcon, Loader2 } from 'lucide-react';
import { cn } from '../../../lib/utils';

const PANE_STATUSES = ['All', 'draft', 'waiting_approval', 'open', 'in_production', 'partially_shipped', 'completed', 'cancelled'];

const PANE_STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  draft:            { bg: 'bg-zinc-100', color: 'text-zinc-700', label: 'Draft' },
  waiting_approval: { bg: 'bg-amber-100', color: 'text-amber-700', label: 'Waiting Approval' },
  open:             { bg: 'bg-blue-100', color: 'text-blue-700', label: 'Open / Approved' },
  in_production:    { bg: 'bg-purple-100', color: 'text-purple-700', label: 'In Production' },
  partially_shipped:{ bg: 'bg-orange-100', color: 'text-orange-700', label: 'Partially Shipped' },
  completed:        { bg: 'bg-emerald-100', color: 'text-emerald-700', label: 'Completed' },
  cancelled:        { bg: 'bg-red-100', color: 'text-red-700', label: 'Cancelled' }
};

interface SalesOrderListPaneProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

// SalesOrderListPane - left list pane for the sales order split view,
// mirroring the quotation view list (search, status pills, 70px rows).
export function SalesOrderListPane({ selectedId, onSelect }: SalesOrderListPaneProps) {
  const { organisation } = useAuth();
  const orgId = organisation?.id;
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['sales-order-pane-list', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('sales_orders')
        .select('id, sales_order_no, grand_total, status, order_date, client:clients(client_name)')
        .eq('organisation_id', orgId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (orders || []).filter((so: any) => {
      if (statusFilter !== 'All' && so.status !== statusFilter) return false;
      if (!q) return true;
      return (
        so.sales_order_no?.toLowerCase().includes(q) ||
        so.client?.client_name?.toLowerCase().includes(q)
      );
    });
  }, [orders, search, statusFilter]);

  return (
    <div className="w-[400px] shrink-0 border-r border-zinc-200 bg-white flex flex-col min-h-0">
      <div className="p-3 border-b border-zinc-100 space-y-2">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search orders..."
            className="w-full pl-9 pr-3 h-9 text-[13px] border border-zinc-200 rounded-lg bg-zinc-50 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {PANE_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-2 py-1 rounded-md text-[11px] font-medium border transition-colors',
                statusFilter === s
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
              )}
            >
              {s === 'All' ? 'All' : (PANE_STATUS_COLORS[s]?.label || s)}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-[13px] text-zinc-400">No sales orders found.</div>
        ) : (
          filtered.map((so: any) => {
            const meta = PANE_STATUS_COLORS[so.status] || PANE_STATUS_COLORS.draft;
            const active = selectedId === so.id;
            return (
              <button
                key={so.id}
                onClick={() => onSelect(so.id)}
                className={cn(
                  'w-full text-left px-4 py-3 border-b border-zinc-100 transition-colors min-h-[70px] flex flex-col justify-center gap-0.5',
                  active ? 'bg-[#F0F7FF]' : 'bg-white hover:bg-zinc-50'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-bold text-zinc-900 truncate">{so.sales_order_no}</span>
                  <span className="text-[13px] font-bold text-zinc-900 tabular-nums whitespace-nowrap">{formatCurrency(so.grand_total)}</span>
                </div>
                <div className="text-xs text-zinc-500 truncate">{so.client?.client_name || '-'}</div>
                <div>
                  <span className={cn('inline-flex items-center px-2 py-px rounded-full text-[11px] font-medium', meta.bg, meta.color)}>
                    {meta.label}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
