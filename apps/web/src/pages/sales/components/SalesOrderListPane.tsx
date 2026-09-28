import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { formatDate, formatCurrency } from '../../../utils/formatters';
import { Search, ChevronDown } from 'lucide-react';
import { useSalesOrderSummaries } from '../hooks';

const SO_LIST_TABS = ['All', 'Draft', 'Waiting Approval', 'Open', 'Completed', 'Cancelled'];

const SO_LIST_TAB_STATUS: Record<string, string | null> = {
  All: null,
  Draft: 'draft',
  'Waiting Approval': 'waiting_approval',
  Open: 'open',
  Completed: 'completed',
  Cancelled: 'cancelled',
};

const SO_LIST_STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  draft:            { bg: '#f3f4f6', color: '#6b7280', label: 'Draft' },
  waiting_approval: { bg: '#fef3c7', color: '#b45309', label: 'Waiting Approval' },
  open:             { bg: '#d1fae5', color: '#047857', label: 'Open' },
  in_production:    { bg: '#f5f3ff', color: '#6d28d9', label: 'In Production' },
  partially_shipped:{ bg: '#ffedd5', color: '#c2410c', label: 'Partially Shipped' },
  completed:        { bg: '#d1fae5', color: '#065f46', label: 'Completed' },
  cancelled:        { bg: '#fee2e2', color: '#991b1b', label: 'Cancelled' },
};

interface SalesOrderListPaneProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

// SalesOrderListPane - left list pane for the sales order split view.
// Mirrors the QuotationView sidebar list markup exactly; only the data source,
// tab set, and destination route differ.
export function SalesOrderListPane({ selectedId, onSelect }: SalesOrderListPaneProps) {
  const navigate = useNavigate();
  const { organisation } = useAuth();
  const orgId = organisation?.id;
  const [listSearch, setListSearch] = useState('');
  const [listStatusTab, setListStatusTab] = useState('All');
  const [listSortAsc, setListSortAsc] = useState(false);

  const { data: orders = [], isPending } = useSalesOrderSummaries(orgId);

  const listStatusCounts = useMemo(() => {
    const counts: Record<string, number> = { All: (orders || []).length };
    (orders || []).forEach((so: any) => {
      const tab = Object.keys(SO_LIST_TAB_STATUS).find(
        (t) => SO_LIST_TAB_STATUS[t] === so.status
      );
      if (tab) counts[tab] = (counts[tab] || 0) + 1;
    });
    return counts;
  }, [orders]);

  const visibleOrders = useMemo(() => {
    const s = listSearch.trim().toLowerCase();
    const filtered = (orders || []).filter((so: any) => {
      if (listStatusTab !== 'All' && so.status !== SO_LIST_TAB_STATUS[listStatusTab]) return false;
      if (!s) return true;
      return (
        so.sales_order_no?.toLowerCase().includes(s) ||
        so.client?.client_name?.toLowerCase().includes(s)
      );
    });
    return [...filtered].sort((a: any, b: any) => {
      const da = new Date(a.created_at || a.order_date).getTime() || 0;
      const db = new Date(b.created_at || b.order_date).getTime() || 0;
      return listSortAsc ? da - db : db - da;
    });
  }, [orders, listSearch, listStatusTab, listSortAsc]);

  return (
    <>
      <div className="px-4 pt-4 pb-3 border-b border-[#EEF0F3]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-baseline gap-2 min-w-0">
            <h2 className="text-[21px] font-semibold text-zinc-900 leading-none">Sales Orders</h2>
            <span className="text-xs text-zinc-400 whitespace-nowrap">{orders.length} {orders.length === 1 ? 'order' : 'orders'}</span>
          </div>
          <button
            onClick={() => navigate('/sales-orders/create')}
            className="h-8 px-3 rounded-md bg-[#2563EB] text-white text-[13px] font-semibold hover:bg-[#1D4ED8] transition-colors whitespace-nowrap"
          >
            + New
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
          <input
            value={listSearch}
            onChange={(e) => setListSearch(e.target.value)}
            placeholder="Search sales orders..."
            className="w-full h-9 pl-9 pr-3 text-[13px] text-zinc-900 rounded-lg border border-[#E5E7EB] placeholder:text-zinc-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE]"
          />
        </div>
      </div>
      <div className="flex items-center gap-5 px-4 border-b border-[#EEF0F3] overflow-x-auto">
        {SO_LIST_TABS.map((tab) => {
          const active = listStatusTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setListStatusTab(tab)}
              className={`py-1.5 text-[13px] border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0 ${active ? 'text-[#2563EB] font-medium border-[#2563EB]' : 'text-zinc-500 border-transparent hover:text-zinc-800'}`}
            >
              {tab} <span className={active ? '' : 'text-zinc-400'}>{listStatusCounts[tab] ?? 0}</span>
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between px-4" style={{ height: 32 }}>
        <button onClick={() => setListSortAsc((v) => !v)} className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 transition-colors">
          {listSortAsc ? 'Oldest first' : 'Newest first'}
          <ChevronDown className="w-3 h-3" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {isPending ? (
          <div className="p-8 text-center text-zinc-400 text-sm">Loading orders...</div>
        ) : visibleOrders.length === 0 ? (
          <div className="p-8 text-center text-zinc-400 text-sm">{orders.length === 0 ? 'No sales orders found' : 'No sales orders match'}</div>
        ) : (
          <div>
            {visibleOrders.map((so: any) => {
              const selected = selectedId === so.id;
              const st = SO_LIST_STATUS_STYLE[so.status] || SO_LIST_STATUS_STYLE.draft;
              return (
                <div
                  key={so.id}
                  onClick={() => onSelect(so.id)}
                  className="px-4 cursor-pointer border-b border-[#EEF0F3] hover:bg-[#F8FAFC]"
                  style={{
                    minHeight: 70,
                    paddingTop: 12,
                    paddingBottom: 12,
                    background: selected ? '#F0F7FF' : undefined,
                    boxShadow: selected ? 'inset 0 0 0 1px #BFDBFE' : undefined,
                  }}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-semibold text-zinc-900 truncate">{so.client?.client_name || 'Walk-in Client'}</span>
                    <span className="text-sm font-semibold text-zinc-900 tabular-nums whitespace-nowrap">{formatCurrency(so.grand_total)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 mt-0.5">
                    <div className="flex items-center gap-1.5 min-w-0 text-xs">
                      <span className="font-medium text-zinc-600 whitespace-nowrap">{so.sales_order_no}</span>
                      <span className="text-zinc-300">&middot;</span>
                      <span className="text-zinc-400 whitespace-nowrap">{formatDate(so.order_date)}</span>
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full whitespace-nowrap" style={{ backgroundColor: st.bg, color: st.color }}>
                      {st.label || so.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
