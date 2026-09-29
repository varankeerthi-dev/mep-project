// src/warehouse/stock-requests/ReleaseAllocationModal.tsx
// Emergency release/reallocation modal.
// Releases undispatched committed stock back into source warehouse available-to-commit pool.

import { useState } from 'react';
import { X, AlertTriangle, Loader2, Undo2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useReleaseAllocation } from './useStockRequests';
import type { StockRequestAllocationRow } from './types';

interface Props {
  allocation: StockRequestAllocationRow;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function ReleaseAllocationModal({ allocation, onClose, onSuccess }: Props) {
  const releaseAllocationMutation = useReleaseAllocation();

  const maxReleasable = Math.max(
    0,
    allocation.allocated_qty - (allocation.dispatched_qty || 0) - (allocation.released_qty || 0),
  );

  const [releaseQty, setReleaseQty] = useState<number>(maxReleasable);
  const [reason, setReason] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleRelease = async () => {
    setError(null);

    if (releaseQty <= 0) {
      setError('Release quantity must be greater than zero.');
      return;
    }

    if (releaseQty > maxReleasable) {
      setError(`Cannot release more than ${maxReleasable} un-dispatched units.`);
      return;
    }

    if (!reason.trim()) {
      setError('A mandatory reason is required for allocation releases.');
      return;
    }

    try {
      await releaseAllocationMutation.mutateAsync({
        allocation_id: allocation.id,
        release_qty: Number(releaseQty),
        reason: reason.trim(),
      });
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Failed to release allocation');
    }
  };

  const isSaving = releaseAllocationMutation.isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
          <div className="flex items-center gap-2 text-amber-600">
            <AlertTriangle size={18} />
            <h3 className="text-sm font-bold text-zinc-900 m-0">Release Committed Stock</h3>
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

        <div className="py-4 space-y-3">
          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-600">
              {error}
            </div>
          )}

          <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-zinc-500">Source Warehouse:</span>
              <span className="font-semibold text-zinc-800">
                {allocation.source_warehouse?.warehouse_name ||
                  allocation.source_warehouse?.name ||
                  'Warehouse'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Total Allocated:</span>
              <span className="font-semibold text-zinc-800">{allocation.allocated_qty}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Already Dispatched:</span>
              <span className="font-semibold text-zinc-800">{allocation.dispatched_qty || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Available to Release:</span>
              <span className="font-bold text-emerald-600">{maxReleasable}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              Quantity to Release <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0.01"
              max={maxReleasable}
              step="any"
              className="w-full text-xs bg-zinc-50 border border-zinc-300 rounded-lg px-3 py-2 text-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={releaseQty || ''}
              onChange={(e) => setReleaseQty(Number(e.target.value))}
              disabled={isSaving}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              Reason for Release <span className="text-red-500">*</span>
            </label>
            <textarea
              className="w-full text-xs bg-zinc-50 border border-zinc-300 rounded-lg px-3 py-2 text-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none h-20"
              placeholder="e.g., Stock diverted to critical breakdown, or inventory audit discrepancy..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isSaving}
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-zinc-200">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>

          <Button
            size="sm"
            onClick={handleRelease}
            disabled={isSaving || maxReleasable <= 0}
            className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold flex items-center gap-1.5"
          >
            {isSaving ? (
              <>
                <Loader2 size={14} className="animate-spin mr-1" /> Releasing...
              </>
            ) : (
              <>
                <Undo2 size={13} /> Confirm Release
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
