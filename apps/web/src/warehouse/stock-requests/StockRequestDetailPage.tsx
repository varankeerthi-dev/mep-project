// src/warehouse/stock-requests/StockRequestDetailPage.tsx
// Comprehensive Stock Request Detail view with lifecycle status stepper,
// line progress, allocation management, and complete audit trail history.

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Warehouse as WarehouseIcon,
  User,
  Clock,
  CheckCircle2,
  AlertCircle,
  Truck,
  Boxes,
  Send,
  Ban,
  Trash2,
  RefreshCw,
  Undo2,
  FileText,
  Split,
  Plus,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import {
  useStockRequest,
  useStockRequestAllocations,
  useStockRequestActivity,
  useSubmitStockRequest,
  useAcknowledgeStockRequest,
  useCancelStockRequest,
  useDeleteDraftRequest,
} from './useStockRequests';
import {
  STATUS_LABELS,
  STATUS_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  type StockRequestStatus,
  type StockRequestAllocationRow,
} from './types';
import FulfillmentPlannerModal from './FulfillmentPlannerModal';
import ReleaseAllocationModal from './ReleaseAllocationModal';
import CreateTransferOrderModal from './CreateTransferOrderModal';

interface Props {
  requestId?: string;
  onNavigate?: (path: string) => void;
  onBack?: () => void;
}

const LIFECYCLE_STEPS: { key: StockRequestStatus; label: string }[] = [
  { key: 'draft', label: 'Draft' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'under_process', label: 'Under Process' },
  { key: 'allocated', label: 'Allocated' },
  { key: 'awaiting_dispatch', label: 'Awaiting Dispatch' },
  { key: 'in_transit', label: 'In Transit' },
  { key: 'fulfilled', label: 'Fulfilled' },
];

export default function StockRequestDetailPage({ requestId: propId, onNavigate, onBack }: Props) {
  const params = useParams<{ id: string }>();
  const routerNavigate = useNavigate();
  const navigate = onNavigate ?? routerNavigate;
  const requestId = propId || params.id || '';

  const { data: request, isLoading, error } = useStockRequest(requestId);
  const { data: allocations = [] } = useStockRequestAllocations(requestId);
  const { data: activityData } = useStockRequestActivity(requestId);

  const submitMutation = useSubmitStockRequest();
  const acknowledgeMutation = useAcknowledgeStockRequest();
  const cancelMutation = useCancelStockRequest();
  const deleteMutation = useDeleteDraftRequest();

  // Modals state
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [releaseTarget, setReleaseTarget] = useState<StockRequestAllocationRow | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'lines' | 'allocations' | 'activity'>('lines');

  if (isLoading) {
    return (
      <div className="p-8 text-center text-xs text-zinc-500">
        Loading stock request details...
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="p-8 text-center text-xs text-red-500">
        Stock Request not found or access denied.
      </div>
    );
  }

  const isDraft = request.status === 'draft';
  const isSubmitted = request.status === 'submitted';
  const isUnderProcess = request.status === 'under_process';
  const isAllocatable = ['under_process', 'partially_allocated', 'allocated'].includes(request.status);
  const isCancellable =
    !['fulfilled', 'cancelled', 'closed'].includes(request.status) &&
    (request.lines || []).every((l) => (l.dispatched_qty || 0) === 0 && (l.received_qty || 0) === 0);

  const canCreateTransfer = allocations.some(
    (a) =>
      a.status === 'confirmed' &&
      !a.transfer_id &&
      a.allocated_qty - (a.dispatched_qty || 0) - (a.released_qty || 0) > 0,
  );

  const handleCancel = async () => {
    if (!cancelReason.trim()) return;
    await cancelMutation.mutateAsync({
      requestId: request.id,
      reason: cancelReason.trim(),
    });
    setCancelModalOpen(false);
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this draft request?')) return;
    await deleteMutation.mutateAsync(request.id);
    if (onBack) onBack();
    else navigate('/warehouse/stock-requests');
  };

  const getStepStatus = (stepKey: StockRequestStatus) => {
    const statusOrder: Record<StockRequestStatus, number> = {
      draft: 0,
      submitted: 1,
      under_process: 2,
      partially_allocated: 3,
      allocated: 3,
      awaiting_dispatch: 4,
      partially_dispatched: 5,
      in_transit: 5,
      partially_received: 6,
      fulfilled: 6,
      cancelled: -1,
      closed: 7,
    };

    const currentIdx = statusOrder[request.status];
    const stepIdx = statusOrder[stepKey];

    if (request.status === 'cancelled') return 'cancelled';
    if (currentIdx > stepIdx) return 'completed';
    if (currentIdx === stepIdx) return 'current';
    return 'upcoming';
  };

  return (
    <div className="min-h-screen bg-[#f8f9fb] pb-12">
      <div className="max-w-[1200px] mx-auto px-4 pt-4">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack ? onBack : () => navigate('/warehouse/stock-requests')}
            className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-900"
          >
            <ArrowLeft size={14} /> Back to Requests
          </Button>

          {/* Action Bar */}
          <div className="flex items-center gap-2">
            {isDraft && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDelete}
                  className="text-xs text-red-600 border-red-200 hover:bg-red-50 flex items-center gap-1"
                >
                  <Trash2 size={13} /> Delete Draft
                </Button>
                <Button
                  size="sm"
                  onClick={() => submitMutation.mutate(request.id)}
                  disabled={submitMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <Send size={13} /> Submit Request
                </Button>
              </>
            )}

            {isSubmitted && (
              <Button
                size="sm"
                onClick={() => acknowledgeMutation.mutate(request.id)}
                disabled={acknowledgeMutation.isPending}
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <Boxes size={13} /> Acknowledge & Process
              </Button>
            )}

            {isAllocatable && (
              <Button
                size="sm"
                onClick={() => setPlannerOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <Split size={13} /> Fulfillment Planner
              </Button>
            )}

            {canCreateTransfer && (
              <Button
                size="sm"
                onClick={() => setTransferModalOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <Truck size={13} /> Create Transfer Order
              </Button>
            )}

            {isCancellable && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCancelModalOpen(true)}
                className="text-xs text-zinc-600 border-zinc-300 hover:bg-red-50 hover:text-red-600 hover:border-red-200 flex items-center gap-1"
              >
                <Ban size={13} /> Cancel
              </Button>
            )}
          </div>
        </div>

        {/* Header Summary Card */}
        <div className="bg-white border border-zinc-200 rounded-xl p-5 mb-5 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-100">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold text-zinc-900 m-0 font-mono">
                  {request.request_number}
                </h1>
                <span
                  className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                    STATUS_COLORS[request.status]
                  }`}
                >
                  {STATUS_LABELS[request.status]}
                </span>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    PRIORITY_COLORS[request.priority]
                  }`}
                >
                  {PRIORITY_LABELS[request.priority]}
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-1 m-0">
                Created on {new Date(request.created_at).toLocaleDateString()}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs text-zinc-600">
              <div className="flex items-center gap-2">
                <WarehouseIcon size={16} className="text-blue-600 shrink-0" />
                <div>
                  <div className="text-[10px] text-zinc-400 uppercase font-semibold">Destination</div>
                  <div className="font-semibold text-zinc-800">
                    {request.destination_warehouse?.warehouse_name ||
                      request.destination_warehouse?.name ||
                      'Warehouse'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-amber-600 shrink-0" />
                <div>
                  <div className="text-[10px] text-zinc-400 uppercase font-semibold">Required Date</div>
                  <div className="font-semibold text-zinc-800">
                    {request.required_date
                      ? new Date(request.required_date).toLocaleDateString()
                      : 'Not specified'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <User size={16} className="text-purple-600 shrink-0" />
                <div>
                  <div className="text-[10px] text-zinc-400 uppercase font-semibold">Requested By</div>
                  <div className="font-semibold text-zinc-800">
                    {request.requester?.full_name || request.requester?.email || 'User'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {request.remarks && (
            <div className="mt-3 pt-3 border-t border-zinc-100 text-xs text-zinc-600">
              <span className="font-semibold text-zinc-700">Remarks:</span> {request.remarks}
            </div>
          )}

          {/* Stepper / Timeline */}
          <div className="mt-5 pt-4 border-t border-zinc-100 overflow-x-auto">
            <div className="flex items-center justify-between min-w-[600px]">
              {LIFECYCLE_STEPS.map((step, idx) => {
                const stepState = getStepStatus(step.key);
                return (
                  <div key={step.key} className="flex-1 flex items-center last:flex-none">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                          stepState === 'completed'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : stepState === 'current'
                            ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                            : stepState === 'cancelled'
                            ? 'bg-red-500 text-white'
                            : 'bg-zinc-100 text-zinc-400 border border-zinc-300'
                        }`}
                      >
                        {stepState === 'completed' ? <CheckCircle2 size={14} /> : idx + 1}
                      </div>
                      <span
                        className={`text-[10px] font-semibold mt-1 whitespace-nowrap ${
                          stepState === 'current'
                            ? 'text-blue-600 font-bold'
                            : stepState === 'completed'
                            ? 'text-emerald-700'
                            : 'text-zinc-400'
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                    {idx < LIFECYCLE_STEPS.length - 1 && (
                      <div
                        className={`flex-1 h-0.5 mx-2 ${
                          stepState === 'completed' ? 'bg-emerald-500' : 'bg-zinc-200'
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 border-b border-zinc-200 mb-4 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('lines')}
            className={`pb-2.5 px-3 border-b-2 transition-all ${
              activeTab === 'lines'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            Requested Items ({(request.lines || []).length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('allocations')}
            className={`pb-2.5 px-3 border-b-2 transition-all ${
              activeTab === 'allocations'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            Fulfillment Allocations ({allocations.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('activity')}
            className={`pb-2.5 px-3 border-b-2 transition-all ${
              activeTab === 'activity'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            Audit Trail & History
          </button>
        </div>

        {/* Tab 1: Line Items */}
        {activeTab === 'lines' && (
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200 text-[11px] font-semibold text-zinc-600">
                  <th className="py-2.5 px-4 w-12 text-center">#</th>
                  <th className="py-2.5 px-4 min-w-[200px]">Item / SKU</th>
                  <th className="py-2.5 px-4">Variant</th>
                  <th className="py-2.5 px-4 text-left">Req Qty</th>
                  <th className="py-2.5 px-4 text-left">Allocated</th>
                  <th className="py-2.5 px-4 text-left">Dispatched</th>
                  <th className="py-2.5 px-4 text-left">Received</th>
                  <th className="py-2.5 px-4 min-w-[140px]">Fulfillment Progress</th>
                  <th className="py-2.5 px-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-xs">
                {(request.lines || []).map((line, idx) => {
                  const reqQty = Number(line.requested_qty) || 1;
                  const allocQty = Number(line.allocated_qty) || 0;
                  const recvQty = Number(line.received_qty) || 0;
                  const pct = Math.min(100, Math.round((recvQty / reqQty) * 100));

                  return (
                    <tr key={line.id} className="hover:bg-zinc-50/50">
                      <td className="py-3 px-4 text-center text-zinc-400 font-mono text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-zinc-800">{line.item?.name || 'Item'}</div>
                        {line.item?.item_code && (
                          <div className="text-[10px] text-zinc-400 font-mono">
                            {line.item.item_code}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-zinc-600">
                        {line.variant?.variant_name || 'Standard'}
                      </td>
                      <td className="py-3 px-4 text-left font-mono font-bold text-zinc-900">
                        {line.requested_qty}
                      </td>
                      <td className="py-3 px-4 text-left font-mono font-semibold text-blue-600">
                        {line.allocated_qty || 0}
                      </td>
                      <td className="py-3 px-4 text-left font-mono text-purple-600">
                        {line.dispatched_qty || 0}
                      </td>
                      <td className="py-3 px-4 text-left font-mono text-emerald-600">
                        {line.received_qty || 0}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                pct === 100 ? 'bg-emerald-500' : 'bg-blue-500'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-mono text-zinc-500 w-8">{pct}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-zinc-500">{line.notes || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Allocations */}
        {activeTab === 'allocations' && (
          <div className="space-y-4">
            {allocations.length === 0 ? (
              <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center text-xs text-zinc-500">
                <Boxes size={24} className="mx-auto text-zinc-400 mb-2" />
                No source stock has been allocated to this request yet.
                {isAllocatable && (
                  <div className="mt-3">
                    <Button
                      size="sm"
                      onClick={() => setPlannerOpen(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                    >
                      <Split size={13} className="mr-1.5" /> Open Fulfillment Planner
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-200 text-[11px] font-semibold text-zinc-600">
                      <th className="py-2.5 px-4">Source Warehouse</th>
                      <th className="py-2.5 px-4 text-left">Allocated Qty</th>
                      <th className="py-2.5 px-4 text-left">Dispatched</th>
                      <th className="py-2.5 px-4 text-left">Received</th>
                      <th className="py-2.5 px-4 text-left">Released</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4">Transfer Ref</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 text-xs">
                    {allocations.map((alloc) => {
                      const releasable =
                        alloc.allocated_qty - (alloc.dispatched_qty || 0) - (alloc.released_qty || 0);

                      return (
                        <tr key={alloc.id} className="hover:bg-zinc-50/50">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-zinc-800">
                              {alloc.source_warehouse?.warehouse_name ||
                                alloc.source_warehouse?.name ||
                                'Warehouse'}
                            </div>
                            <div className="text-[10px] text-zinc-400 font-mono">
                              {alloc.source_warehouse?.warehouse_code || 'WH'}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-left font-mono font-bold text-zinc-900">
                            {alloc.allocated_qty}
                          </td>
                          <td className="py-3 px-4 text-left font-mono text-purple-600">
                            {alloc.dispatched_qty || 0}
                          </td>
                          <td className="py-3 px-4 text-left font-mono text-emerald-600">
                            {alloc.received_qty || 0}
                          </td>
                          <td className="py-3 px-4 text-left font-mono text-zinc-400">
                            {alloc.released_qty || 0}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                                alloc.status === 'received'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : alloc.status === 'dispatched'
                                  ? 'bg-purple-100 text-purple-800'
                                  : alloc.status === 'released'
                                  ? 'bg-zinc-100 text-zinc-600'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {alloc.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-zinc-700">
                            {alloc.transfer ? (
                              <button
                                type="button"
                                onClick={() => navigate(`/store/transfer`)}
                                className="text-blue-600 hover:underline flex items-center gap-1 font-semibold"
                              >
                                <Truck size={12} /> {alloc.transfer.transfer_no}
                              </button>
                            ) : (
                              <span className="text-zinc-400 italic">Pending Transfer</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {releasable > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setReleaseTarget(alloc)}
                                className="text-[11px] h-7 px-2 text-amber-600 hover:bg-amber-50"
                              >
                                <Undo2 size={12} className="mr-1" /> Release
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Activity Log & Audit Trail */}
        {activeTab === 'activity' && (
          <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs">
            <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider mb-4 m-0">
              Audit Event Log
            </h3>
            <div className="space-y-4">
              {(activityData?.data || []).map((log, idx) => (
                <div key={log.id || idx} className="flex items-start gap-3 text-xs">
                  <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Clock size={13} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zinc-800 capitalize">{log.event_type}</span>
                      <span className="text-[11px] text-zinc-400">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                    {log.remarks && <p className="text-zinc-600 mt-0.5 m-0">{log.remarks}</p>}
                    <div className="text-[11px] text-zinc-400 mt-0.5">
                      By: {log.actor?.full_name || 'System'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {plannerOpen && (
        <FulfillmentPlannerModal
          requestId={request.id}
          onClose={() => setPlannerOpen(false)}
        />
      )}

      {transferModalOpen && (
        <CreateTransferOrderModal
          request={request}
          allocations={allocations}
          onClose={() => setTransferModalOpen(false)}
          onSuccess={(transferId) => {
            setTransferModalOpen(false);
            navigate(`/store/transfer`);
          }}
        />
      )}

      {releaseTarget && (
        <ReleaseAllocationModal
          allocation={releaseTarget}
          onClose={() => setReleaseTarget(null)}
        />
      )}

      {cancelModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setCancelModalOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-md p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold text-zinc-900 mb-2">Cancel Stock Request</h3>
            <p className="text-xs text-zinc-500 mb-4">
              Are you sure you want to cancel this request? Any un-dispatched allocations will be
              released automatically.
            </p>
            <textarea
              className="w-full text-xs bg-zinc-50 border border-zinc-300 rounded-lg p-2.5 resize-none h-20 mb-4 text-zinc-800 focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Reason for cancellation..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCancelModalOpen(false)}
              >
                Go Back
              </Button>
              <Button
                size="sm"
                onClick={handleCancel}
                disabled={!cancelReason.trim() || cancelMutation.isPending}
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
              >
                Confirm Cancellation
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
