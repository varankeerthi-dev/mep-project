// src/warehouse/stock-requests/CreateTransferOrderModal.tsx
// Converts confirmed allocations from a single source warehouse into a physical Transfer Order.

import { useState, useMemo } from 'react';
import { X, Truck, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useConvertAllocationsToTransfer } from './useStockRequests';
import type { StockRequestAllocationRow, StockRequestRow } from './types';

interface Props {
  request: StockRequestRow;
  allocations: StockRequestAllocationRow[];
  onClose: () => void;
  onSuccess?: (transferId: string) => void;
}

export default function CreateTransferOrderModal({
  request,
  allocations,
  onClose,
  onSuccess,
}: Props) {
  const convertMutation = useConvertAllocationsToTransfer();

  // Find allocations eligible for transfer (confirmed, without existing transfer_id, and un-dispatched)
  const eligibleAllocations = useMemo(
    () =>
      allocations.filter(
        (a) =>
          a.status === 'confirmed' &&
          !a.transfer_id &&
          a.allocated_qty - (a.dispatched_qty || 0) - (a.released_qty || 0) > 0,
      ),
    [allocations],
  );

  // Group by source warehouse
  const warehouseGroups = useMemo(() => {
    const map = new Map<string, { warehouseName: string; allocations: StockRequestAllocationRow[] }>();
    for (const alloc of eligibleAllocations) {
      const whId = alloc.source_warehouse_id;
      const whName =
        alloc.source_warehouse?.warehouse_name ||
        alloc.source_warehouse?.name ||
        'Source Warehouse';
      if (!map.has(whId)) {
        map.set(whId, { warehouseName: whName, allocations: [] });
      }
      map.get(whId)!.allocations.push(alloc);
    }
    return Array.from(map.entries()).map(([whId, data]) => ({
      warehouseId: whId,
      warehouseName: data.warehouseName,
      allocations: data.allocations,
    }));
  }, [eligibleAllocations]);

  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(
    warehouseGroups[0]?.warehouseId || '',
  );
  const [vehicleNo, setVehicleNo] = useState<string>('');
  const [transporter, setTransporter] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const currentGroup = warehouseGroups.find((g) => g.warehouseId === selectedWarehouseId);

  const handleConvert = async () => {
    setError(null);

    if (!selectedWarehouseId || !currentGroup || currentGroup.allocations.length === 0) {
      setError('Please select a valid source warehouse group.');
      return;
    }

    try {
      const allocIds = currentGroup.allocations.map((a) => a.id);
      const res = await convertMutation.mutateAsync({
        requestId: request.id,
        allocationIds: allocIds,
        vehicleNo: vehicleNo.trim() || undefined,
        transporter: transporter.trim() || undefined,
      });

      onClose();
      if (onSuccess && res?.transfer_id) {
        onSuccess(res.transfer_id);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to create transfer order');
    }
  };

  const isSaving = convertMutation.isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
          <div className="flex items-center gap-2 text-blue-600">
            <Truck size={18} />
            <h3 className="text-sm font-bold text-zinc-900 m-0">Create Transfer Order</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-zinc-600"
          >
            <X size={16} />
          </Button>
        </div>

        <div className="py-4 space-y-4">
          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-600">
              {error}
            </div>
          )}

          {warehouseGroups.length === 0 ? (
            <div className="text-center py-6 text-xs text-zinc-500">
              No eligible allocations available for transfer creation.
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Source Warehouse Group
                </label>
                <select
                  className="w-full text-xs bg-zinc-50 border border-zinc-300 rounded-lg px-3 py-2 text-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={selectedWarehouseId}
                  onChange={(e) => setSelectedWarehouseId(e.target.value)}
                  disabled={isSaving}
                >
                  {warehouseGroups.map((g) => (
                    <option key={g.warehouseId} value={g.warehouseId}>
                      {g.warehouseName} ({g.allocations.length} line items)
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Transfers are partitioned per originating source warehouse.
                </p>
              </div>

              {/* Items Summary in this Transfer */}
              {currentGroup && (
                <div className="border border-zinc-200 rounded-lg p-3 bg-zinc-50/75 space-y-2">
                  <h4 className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider m-0">
                    Allocated Items in this Transfer ({currentGroup.allocations.length})
                  </h4>
                  <div className="space-y-1 max-h-36 overflow-y-auto">
                    {currentGroup.allocations.map((a) => {
                      const transferQty =
                        a.allocated_qty - (a.dispatched_qty || 0) - (a.released_qty || 0);
                      return (
                        <div
                          key={a.id}
                          className="flex items-center justify-between text-xs py-1 border-b border-zinc-200/60 last:border-0"
                        >
                          <span className="text-zinc-700 truncate max-w-[240px]">
                            Item ID: {a.item_id.slice(0, 8)}...
                          </span>
                          <span className="font-semibold text-zinc-900 text-left">
                            Qty: {transferQty}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Vehicle Number (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., MH-04-AB-1234"
                    className="w-full text-xs bg-zinc-50 border border-zinc-300 rounded-lg px-3 py-2 text-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={vehicleNo}
                    onChange={(e) => setVehicleNo(e.target.value)}
                    disabled={isSaving}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Transporter Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., BlueDart Logistics"
                    className="w-full text-xs bg-zinc-50 border border-zinc-300 rounded-lg px-3 py-2 text-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={transporter}
                    onChange={(e) => setTransporter(e.target.value)}
                    disabled={isSaving}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-zinc-200">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>

          <Button
            size="sm"
            onClick={handleConvert}
            disabled={isSaving || warehouseGroups.length === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5"
          >
            {isSaving ? (
              <>
                <Loader2 size={14} className="animate-spin mr-1" /> Generating...
              </>
            ) : (
              <>
                Generate Transfer Order <ArrowRight size={13} />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
