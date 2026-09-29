// src/warehouse/stock-requests/StockRequestListPage.tsx
// Destination warehouse Stock Request listing page with search, filters,
// KPI summary cards, and quick actions.

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList,
  Plus,
  Search,
  Filter,
  Warehouse,
  Clock,
  CheckCircle2,
  Truck,
  Eye,
  Send,
  Boxes,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useAuth } from '../../contexts/AuthContext';
import { useWarehouses } from '../hooks/useWarehouseData';
import { useStockRequests, useSubmitStockRequest } from './useStockRequests';
import {
  STATUS_LABELS,
  STATUS_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  type StockRequestStatus,
  type StockRequestPriority,
} from './types';
import CreateStockRequestModal from './CreateStockRequestModal';

interface Props {
  onNavigate?: (path: string) => void;
  onOpenDetail?: (requestId: string) => void;
}

export default function StockRequestListPage({ onNavigate, onOpenDetail }: Props) {
  const routerNavigate = useNavigate();
  const navigate = onNavigate ?? routerNavigate;

  const { data: warehouses = [] } = useWarehouses();
  const submitRequest = useSubmitStockRequest();

  // Filters state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [warehouseFilter, setWarehouseFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const queryFilters = useMemo(() => {
    const f: any = {};
    if (statusFilter !== 'all') f.status = statusFilter as StockRequestStatus;
    if (warehouseFilter !== 'all') f.destination_warehouse_id = warehouseFilter;
    if (priorityFilter !== 'all') f.priority = priorityFilter as StockRequestPriority;
    if (search.trim()) f.search = search.trim();
    return f;
  }, [statusFilter, warehouseFilter, priorityFilter, search]);

  const { data, isLoading } = useStockRequests(queryFilters);
  const requests = data?.data || [];

  // Summary counts
  const totalCount = data?.count || 0;
  const pendingCount = requests.filter((r) =>
    ['submitted', 'under_process'].includes(r.status),
  ).length;
  const inTransitCount = requests.filter((r) =>
    ['partially_dispatched', 'in_transit'].includes(r.status),
  ).length;
  const fulfilledCount = requests.filter((r) => r.status === 'fulfilled').length;

  const handleRowClick = (requestId: string) => {
    if (onOpenDetail) onOpenDetail(requestId);
    else navigate(`/warehouse/stock-requests/${requestId}`);
  };

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      <div className="max-w-[1200px] mx-auto px-4 pt-4 pb-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-lg font-bold text-zinc-900 m-0 flex items-center gap-2">
              <ClipboardList size={20} className="text-blue-600" />
              Stock Requests
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              Request stock for warehouses and track multi-source fulfillment
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs"
          >
            <Plus size={14} /> New Stock Request
          </Button>
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <div className="bg-white border border-zinc-200 rounded-xl p-3.5 shadow-xs flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <ClipboardList size={18} />
            </div>
            <div>
              <div className="text-[11px] text-zinc-500 font-medium">Total Requests</div>
              <div className="text-base font-bold text-zinc-900">{totalCount}</div>
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl p-3.5 shadow-xs flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Clock size={18} />
            </div>
            <div>
              <div className="text-[11px] text-zinc-500 font-medium">Pending Allocation</div>
              <div className="text-base font-bold text-zinc-900">{pendingCount}</div>
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl p-3.5 shadow-xs flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <Truck size={18} />
            </div>
            <div>
              <div className="text-[11px] text-zinc-500 font-medium">In Transit</div>
              <div className="text-base font-bold text-zinc-900">{inTransitCount}</div>
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl p-3.5 shadow-xs flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 size={18} />
            </div>
            <div>
              <div className="text-[11px] text-zinc-500 font-medium">Fulfilled</div>
              <div className="text-base font-bold text-zinc-900">{fulfilledCount}</div>
            </div>
          </div>
        </div>

        {/* Filter Strip */}
        <div className="bg-white border border-zinc-200 rounded-xl p-3.5 mb-4 shadow-xs flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-2.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Search by Request Number..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Destination Warehouse Filter */}
          <select
            className="text-xs bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1.5 text-zinc-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value)}
          >
            <option value="all">All Destinations</option>
            {warehouses.map((wh) => (
              <option key={wh.id} value={wh.id}>
                {wh.warehouse_name || wh.name}
              </option>
            ))}
          </select>

          {/* Priority Filter */}
          <select
            className="text-xs bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1.5 text-zinc-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <option value="all">All Priorities</option>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
            <option value="critical">Critical</option>
          </select>

          {/* Status Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto">
            {['all', 'draft', 'submitted', 'under_process', 'allocated', 'in_transit', 'fulfilled'].map(
              (st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-md transition-all capitalize ${
                    statusFilter === st
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-zinc-600 hover:bg-zinc-100'
                  }`}
                >
                  {st === 'all' ? 'All Status' : st.replace('_', ' ')}
                </button>
              ),
            )}
          </div>
        </div>

        {/* Main Requests Table */}
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-zinc-500">
              Loading warehouse stock requests...
            </div>
          ) : requests.length === 0 ? (
            <div className="p-12 text-center text-xs text-zinc-500">
              <Boxes size={28} className="mx-auto text-zinc-300 mb-2" />
              No stock requests found matching your filters.
              <div className="mt-3">
                <Button
                  size="sm"
                  onClick={() => setCreateModalOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                >
                  <Plus size={13} className="mr-1" /> Create First Request
                </Button>
              </div>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200 text-[11px] font-semibold text-zinc-600">
                  <th className="py-2.5 px-4 min-w-[130px]">Request #</th>
                  <th className="py-2.5 px-4 min-w-[180px]">Destination Warehouse</th>
                  <th className="py-2.5 px-4">Requested By</th>
                  <th className="py-2.5 px-4">Requested Date</th>
                  <th className="py-2.5 px-4">Required Date</th>
                  <th className="py-2.5 px-4">Priority</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-xs">
                {requests.map((req) => (
                  <tr
                    key={req.id}
                    onClick={() => handleRowClick(req.id)}
                    className="hover:bg-blue-50/30 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-blue-600 hover:underline">
                      {req.request_number}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-zinc-800">
                        {req.destination_warehouse?.warehouse_name ||
                          req.destination_warehouse?.name ||
                          'Warehouse'}
                      </div>
                      <div className="text-[10px] text-zinc-400 font-mono">
                        {req.destination_warehouse?.warehouse_code || 'WH'}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-zinc-600">
                      {req.requester?.full_name || req.requester?.email || 'User'}
                    </td>
                    <td className="py-3 px-4 text-zinc-600">
                      {new Date(req.requested_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-zinc-600">
                      {req.required_date
                        ? new Date(req.required_date).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          PRIORITY_COLORS[req.priority]
                        }`}
                      >
                        {PRIORITY_LABELS[req.priority]}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          STATUS_COLORS[req.status]
                        }`}
                      >
                        {STATUS_LABELS[req.status]}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {req.status === 'draft' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => submitRequest.mutate(req.id)}
                            disabled={submitRequest.isPending}
                            className="text-[11px] h-7 px-2 text-blue-600 border-blue-200 hover:bg-blue-50"
                          >
                            <Send size={11} className="mr-1" /> Submit
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRowClick(req.id)}
                          className="text-[11px] h-7 px-2 text-zinc-600 hover:text-zinc-900"
                        >
                          <Eye size={12} className="mr-1" /> View
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {createModalOpen && (
        <CreateStockRequestModal
          onClose={() => setCreateModalOpen(false)}
          onSuccess={(reqId) => {
            setCreateModalOpen(false);
            handleRowClick(reqId);
          }}
        />
      )}
    </div>
  );
}
