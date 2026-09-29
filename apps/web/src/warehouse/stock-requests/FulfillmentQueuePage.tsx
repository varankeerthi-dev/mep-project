// src/warehouse/stock-requests/FulfillmentQueuePage.tsx
// Dedicated Fulfillment Control Queue for central warehouse managers & dispatch planners.
// Prioritizes open requests requiring allocation, transfer, and dispatch attention.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Boxes,
  Split,
  Truck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useFulfillmentQueue } from './useStockRequests';
import {
  STATUS_LABELS,
  STATUS_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
} from './types';
import FulfillmentPlannerModal from './FulfillmentPlannerModal';

interface Props {
  onNavigate?: (path: string) => void;
  onOpenDetail?: (requestId: string) => void;
}

export default function FulfillmentQueuePage({ onNavigate, onOpenDetail }: Props) {
  const routerNavigate = useNavigate();
  const navigate = onNavigate ?? routerNavigate;

  const { data, isLoading } = useFulfillmentQueue();
  const requests = data?.data || [];

  const [activeTab, setActiveTab] = useState<'allocation' | 'dispatch' | 'transit'>('allocation');
  const [plannerRequestId, setPlannerRequestId] = useState<string | null>(null);

  // Categorize queues
  const allocationQueue = requests.filter((r) =>
    ['submitted', 'under_process', 'partially_allocated'].includes(r.status),
  );
  const dispatchQueue = requests.filter((r) =>
    ['allocated', 'awaiting_dispatch'].includes(r.status),
  );
  const transitQueue = requests.filter((r) =>
    ['partially_dispatched', 'in_transit', 'partially_received'].includes(r.status),
  );

  const currentList =
    activeTab === 'allocation'
      ? allocationQueue
      : activeTab === 'dispatch'
      ? dispatchQueue
      : transitQueue;

  const handleOpenRequest = (requestId: string) => {
    if (onOpenDetail) onOpenDetail(requestId);
    else navigate(`/warehouse/stock-requests/${requestId}`);
  };

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      <div className="max-w-[1200px] mx-auto px-4 pt-4 pb-8">
        {/* Header */}
        <div className="mb-5">
          <h1 className="text-lg font-bold text-zinc-900 m-0 flex items-center gap-2">
            <Boxes size={20} className="text-blue-600" />
            Fulfillment Queue
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Manage multi-source stock allocations, transfer orders, and fulfillment dispatches
          </p>
        </div>

        {/* Queue Metric Strips */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          <button
            type="button"
            onClick={() => setActiveTab('allocation')}
            className={`p-4 rounded-xl border text-left transition-all ${
              activeTab === 'allocation'
                ? 'bg-blue-50/70 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                : 'bg-white border-zinc-200 hover:bg-zinc-50'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-zinc-600">Needs Allocation</span>
              <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                <Clock size={16} />
              </span>
            </div>
            <div className="text-2xl font-bold text-zinc-900">{allocationQueue.length}</div>
            <p className="text-[11px] text-zinc-500 mt-1 m-0">
              Submitted or under process awaiting source warehouse commitment
            </p>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('dispatch')}
            className={`p-4 rounded-xl border text-left transition-all ${
              activeTab === 'dispatch'
                ? 'bg-blue-50/70 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                : 'bg-white border-zinc-200 hover:bg-zinc-50'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-zinc-600">Ready for Dispatch</span>
              <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                <Truck size={16} />
              </span>
            </div>
            <div className="text-2xl font-bold text-zinc-900">{dispatchQueue.length}</div>
            <p className="text-[11px] text-zinc-500 mt-1 m-0">
              Allocations confirmed — pending transfer creation and staging
            </p>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('transit')}
            className={`p-4 rounded-xl border text-left transition-all ${
              activeTab === 'transit'
                ? 'bg-blue-50/70 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                : 'bg-white border-zinc-200 hover:bg-zinc-50'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-zinc-600">In Transit & Receiving</span>
              <span className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
                <CheckCircle2 size={16} />
              </span>
            </div>
            <div className="text-2xl font-bold text-zinc-900">{transitQueue.length}</div>
            <p className="text-[11px] text-zinc-500 mt-1 m-0">
              Dispatched transfers awaiting receiving at destination warehouse
            </p>
          </button>
        </div>

        {/* Queue Table */}
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-zinc-500">
              Loading fulfillment queue...
            </div>
          ) : currentList.length === 0 ? (
            <div className="p-12 text-center text-xs text-zinc-500">
              <CheckCircle2 size={28} className="mx-auto text-emerald-500 mb-2" />
              All requests in this queue have been processed!
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200 text-[11px] font-semibold text-zinc-600">
                  <th className="py-2.5 px-4 min-w-[130px]">Request #</th>
                  <th className="py-2.5 px-4 min-w-[180px]">Destination Warehouse</th>
                  <th className="py-2.5 px-4">Requested By</th>
                  <th className="py-2.5 px-4">Required By</th>
                  <th className="py-2.5 px-4">Priority</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-xs">
                {currentList.map((req) => (
                  <tr
                    key={req.id}
                    onClick={() => handleOpenRequest(req.id)}
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
                      {req.required_date
                        ? new Date(req.required_date).toLocaleDateString()
                        : 'Immediate'}
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
                      <div className="flex items-center justify-end gap-1.5">
                        {activeTab === 'allocation' && (
                          <Button
                            size="sm"
                            onClick={() => setPlannerRequestId(req.id)}
                            className="text-[11px] h-7 px-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-1"
                          >
                            <Split size={12} /> Plan Allocation
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenRequest(req.id)}
                          className="text-[11px] h-7 px-2 text-zinc-600 hover:text-zinc-900"
                        >
                          View <ArrowRight size={12} className="ml-1" />
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

      {plannerRequestId && (
        <FulfillmentPlannerModal
          requestId={plannerRequestId}
          onClose={() => setPlannerRequestId(null)}
          onSuccess={() => setPlannerRequestId(null)}
        />
      )}
    </div>
  );
}
