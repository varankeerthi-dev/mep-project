// src/warehouse/stock-requests/FulfillmentPlannerModal.tsx
// Fulfillment Planner & Multi-Warehouse Allocation UX (PRD §2.2, §4.3).
// Displays live availability across all warehouses and allows splitting fulfillment lines.

import { useState, useMemo } from 'react';
import {
  X,
  Layers,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  ArrowRight,
  Boxes,
  Split,
  ShoppingBag,
  Wrench,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useAuth } from '../../contexts/AuthContext';
import { useWarehouses } from '../hooks/useWarehouseData';
import {
  useStockRequest,
  useAllocateStock,
  useStockAvailabilityAllWarehouses,
} from './useStockRequests';
import type { StockRequestLineRow } from './types';

interface Props {
  requestId: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function FulfillmentPlannerModal({ requestId, onClose, onSuccess }: Props) {
  const { organisation } = useAuth();
  const orgId = organisation?.id ?? '';

  const { data: request, isLoading: isLoadingRequest } = useStockRequest(requestId);
  const { data: warehouses = [] } = useWarehouses();
  const allocateStockMutation = useAllocateStock();

  const lines = request?.lines || [];

  // Selected line for focused allocation
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);

  // Active line calculation
  const activeLine = useMemo(() => {
    if (selectedLineId) return lines.find((l) => l.id === selectedLineId) || lines[0];
    return lines.find((l) => (l.allocated_qty || 0) < l.requested_qty) || lines[0];
  }, [lines, selectedLineId]);

  // Fetch availability for the active line across all warehouses
  const { data: availabilities = [], isLoading: isLoadingAvail } =
    useStockAvailabilityAllWarehouses(activeLine?.item_id, activeLine?.company_variant_id || null);

  // Allocation drafts per source warehouse: { [warehouseId]: quantity }
  const [plannedAllocations, setPlannedAllocations] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [isAllocating, setIsAllocating] = useState(false);

  const activeLineRemaining = Math.max(
    0,
    (activeLine?.requested_qty || 0) - (activeLine?.allocated_qty || 0),
  );

  const plannedTotalForActiveLine = useMemo(() => {
    return Object.values(plannedAllocations).reduce((sum, q) => sum + (Number(q) || 0), 0);
  }, [plannedAllocations]);

  const updateAllocationQty = (warehouseId: string, qty: number) => {
    setPlannedAllocations((prev) => ({
      ...prev,
      [warehouseId]: qty,
    }));
  };

  const autoFillMaxAvailable = (warehouseId: string, available: number) => {
    const currentOtherPlanned = Object.entries(plannedAllocations)
      .filter(([id]) => id !== warehouseId)
      .reduce((sum, [, q]) => sum + (Number(q) || 0), 0);
    const needed = Math.max(0, activeLineRemaining - currentOtherPlanned);
    const allocQty = Math.min(needed, available);
    updateAllocationQty(warehouseId, allocQty);
  };

  const handleCommitAllocations = async () => {
    if (!activeLine) return;
    setError(null);

    const validEntries = Object.entries(plannedAllocations).filter(([, qty]) => qty > 0);
    if (validEntries.length === 0) {
      setError('Please allocate a quantity from at least one source warehouse.');
      return;
    }

    if (plannedTotalForActiveLine > activeLineRemaining) {
      setError(
        `Planned total (${plannedTotalForActiveLine}) exceeds open required quantity (${activeLineRemaining}).`,
      );
      return;
    }

    try {
      setIsAllocating(true);

      // Execute each warehouse allocation atomically
      for (const [sourceWhId, qty] of validEntries) {
        await allocateStockMutation.mutateAsync({
          request_line_id: activeLine.id,
          source_warehouse_id: sourceWhId,
          item_id: activeLine.item_id,
          company_variant_id: activeLine.company_variant_id || undefined,
          allocated_qty: Number(qty),
          notes: 'Multi-source planned allocation',
        });
      }

      setPlannedAllocations({});

      // Check if there are other unallocated lines
      const remainingUnallocated = lines.filter(
        (l) => l.id !== activeLine.id && (l.allocated_qty || 0) < l.requested_qty,
      );

      if (remainingUnallocated.length > 0) {
        setSelectedLineId(remainingUnallocated[0].id);
      } else {
        onClose();
        if (onSuccess) onSuccess();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to commit allocations');
    } finally {
      setIsAllocating(false);
    }
  };

  if (isLoadingRequest || !request) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-xl p-8 flex items-center gap-3">
          <Loader2 className="animate-spin text-blue-600" size={20} />
          <span className="text-sm font-semibold text-zinc-700">Loading fulfillment planner...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-4xl p-6 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-200">
          <div className="flex items-center gap-2 text-blue-600">
            <Boxes size={22} />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-zinc-900 m-0">Fulfillment Planner</h2>
                <span className="text-xs bg-blue-100 text-blue-800 font-mono px-2 py-0.5 rounded">
                  {request.request_number}
                </span>
              </div>
              <p className="text-xs text-zinc-500 m-0">
                Allocate inventory to {request.destination_warehouse?.warehouse_name || 'Destination'}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-zinc-600"
          >
            <X size={18} />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
              {error}
            </div>
          )}

          {/* Line Selector Strip */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-600 uppercase tracking-wider mb-1.5">
              Select Request Line Item to Plan ({lines.length})
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {lines.map((line) => {
                const openQty = Math.max(0, line.requested_qty - (line.allocated_qty || 0));
                const isSelected = activeLine?.id === line.id;
                const isComplete = openQty === 0;

                return (
                  <button
                    key={line.id}
                    type="button"
                    onClick={() => {
                      setSelectedLineId(line.id);
                      setPlannedAllocations({});
                      setError(null);
                    }}
                    className={`text-left p-3 rounded-lg border transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/60 ring-2 ring-blue-500/20'
                        : isComplete
                        ? 'border-emerald-200 bg-emerald-50/30 hover:bg-emerald-50/50'
                        : 'border-zinc-200 bg-white hover:bg-zinc-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-zinc-800 truncate max-w-[160px]">
                        {line.item?.name || 'Item'}
                      </span>
                      {isComplete ? (
                        <CheckCircle2 size={14} className="text-emerald-600" />
                      ) : (
                        <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded">
                          {openQty} open
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-1 flex justify-between">
                      <span>Req: {line.requested_qty}</span>
                      <span>Alloc: {line.allocated_qty || 0}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Source Availability & Allocation Grid for Active Line */}
          {activeLine && (
            <div className="border border-zinc-200 rounded-xl overflow-hidden bg-white shadow-xs">
              <div className="bg-zinc-100/80 px-4 py-3 border-b border-zinc-200 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-zinc-900 m-0 flex items-center gap-1.5">
                    <Split size={14} className="text-blue-600" />
                    Source Availability for: {activeLine.item?.name}
                  </h3>
                  <p className="text-[11px] text-zinc-500 m-0">
                    Remaining to Allocate: <span className="font-bold text-zinc-800">{activeLineRemaining}</span> units
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold text-zinc-600">
                    Currently Planned:{' '}
                    <span
                      className={`font-bold ${
                        plannedTotalForActiveLine > activeLineRemaining
                          ? 'text-red-600'
                          : plannedTotalForActiveLine === activeLineRemaining
                          ? 'text-emerald-600'
                          : 'text-blue-600'
                      }`}
                    >
                      {plannedTotalForActiveLine}
                    </span>{' '}
                    / {activeLineRemaining}
                  </span>
                </div>
              </div>

              {isLoadingAvail ? (
                <div className="p-8 text-center text-xs text-zinc-500 flex items-center justify-center gap-2">
                  <Loader2 className="animate-spin text-blue-600" size={16} />
                  Checking real-time stock availability across warehouses...
                </div>
              ) : availabilities.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-500">
                  <AlertCircle size={20} className="mx-auto text-amber-500 mb-1.5" />
                  No stock currently available in any warehouse for this SKU.
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-200 text-[11px] font-semibold text-zinc-600">
                      <th className="py-2.5 px-3 min-w-[180px]">Source Warehouse</th>
                      <th className="py-2.5 px-3 text-left">On Hand</th>
                      <th className="py-2.5 px-3 text-left">Committed</th>
                      <th className="py-2.5 px-3 text-left">Avail to Commit</th>
                      <th className="py-2.5 px-3 text-left w-[180px]">Allocate Qty</th>
                      <th className="py-2.5 px-3 text-center w-28">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 text-xs">
                    {availabilities.map((avail) => {
                      const wh = warehouses.find((w) => w.id === avail.warehouse_id);
                      const isDestination = avail.warehouse_id === request.destination_warehouse_id;
                      const plannedQty = plannedAllocations[avail.warehouse_id] || 0;
                      const hasStock = avail.available_to_commit > 0;

                      return (
                        <tr
                          key={avail.warehouse_id}
                          className={`hover:bg-zinc-50/50 ${
                            isDestination ? 'bg-amber-50/20' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-zinc-800">
                              {wh?.warehouse_name || wh?.name || 'Warehouse'}
                            </div>
                            <div className="text-[10px] text-zinc-400">
                              {wh?.warehouse_code || 'WH'} {isDestination && '• (Destination WH)'}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-left font-mono text-zinc-700">
                            {avail.on_hand}
                          </td>
                          <td className="py-2.5 px-3 text-left font-mono text-zinc-500">
                            {avail.total_committed}
                          </td>
                          <td className="py-2.5 px-3 text-left">
                            <span
                              className={`font-bold font-mono ${
                                avail.available_to_commit > 0
                                  ? 'text-emerald-600'
                                  : 'text-zinc-400'
                              }`}
                            >
                              {avail.available_to_commit}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-left">
                            <input
                              type="number"
                              min="0"
                              max={avail.available_to_commit}
                              step="any"
                              className={`w-28 text-xs border rounded px-2 py-1 text-left font-semibold ${
                                plannedQty > avail.available_to_commit
                                  ? 'border-red-500 bg-red-50 text-red-700'
                                  : 'border-zinc-300 bg-white text-zinc-800 focus:ring-1 focus:ring-blue-500'
                              }`}
                              value={plannedQty || ''}
                              onChange={(e) =>
                                updateAllocationQty(avail.warehouse_id, Number(e.target.value))
                              }
                              disabled={!hasStock || isAllocating}
                              placeholder="0"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <Button
                              variant="outline"
                              size="sm"
                              type="button"
                              onClick={() =>
                                autoFillMaxAvailable(avail.warehouse_id, avail.available_to_commit)
                              }
                              disabled={!hasStock || activeLineRemaining === 0 || isAllocating}
                              className="text-[11px] h-7 px-2 text-blue-600 border-blue-200 hover:bg-blue-50"
                            >
                              Fill Max
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {/* Shortfall & Fallback Decision Box (WEL-29) */}
              {activeLineRemaining > 0 && Math.max(0, activeLineRemaining - plannedTotalForActiveLine) > 0 && (
                <div className="mt-4 p-3.5 bg-amber-50/80 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="text-amber-600 mt-0.5 shrink-0" size={16} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-900">
                          Fulfillment Shortfall: {Math.max(0, activeLineRemaining - plannedTotalForActiveLine)} units unallocated
                        </span>
                        <span className="text-[10px] text-amber-700 bg-amber-100/90 px-2 py-0.5 rounded font-medium">
                          Explicit Decision
                        </span>
                      </div>
                      <p className="text-[11px] text-amber-800 mt-0.5 mb-2.5">
                        Warehouse inventory is insufficient to satisfy requested quantity. Choose an explicit action (the system does not auto-order):
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href="/purchase-requests"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-white border border-amber-300 text-amber-900 rounded hover:bg-amber-100/80 transition shadow-xs"
                        >
                          <ShoppingBag size={12} className="text-amber-700" /> Create Purchase Indent / PO <ExternalLink size={10} className="text-amber-500" />
                        </a>
                        <a
                          href="/manufacturing"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-white border border-amber-300 text-amber-900 rounded hover:bg-amber-100/80 transition shadow-xs"
                        >
                          <Wrench size={12} className="text-amber-700" /> Issue Job Card <ExternalLink size={10} className="text-amber-500" />
                        </a>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-white/70 border border-zinc-200 text-zinc-600 rounded">
                          <Clock size={12} className="text-zinc-500" /> Keep Open as Shortfall
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-zinc-200">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isAllocating}>
            Close
          </Button>

          <Button
            size="sm"
            onClick={handleCommitAllocations}
            disabled={isAllocating || plannedTotalForActiveLine === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5"
          >
            {isAllocating ? (
              <>
                <Loader2 size={14} className="animate-spin mr-1" /> Allocating...
              </>
            ) : (
              <>
                Commit Allocation ({plannedTotalForActiveLine} units) <ArrowRight size={13} />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
