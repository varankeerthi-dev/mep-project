// src/warehouse/stock-requests/CreateStockRequestModal.tsx
// Modal dialog to create a new Warehouse Stock Request.
// Destination warehouse in-charge specifies WHAT is needed and WHERE (destination).

import { useState, useMemo } from 'react';
import { X, Plus, Trash2, Loader2, ArrowRight, ClipboardList, Warehouse as WarehouseIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useWarehouses } from '../hooks/useWarehouseData';
import { useCreateStockRequest, useSubmitStockRequest } from './useStockRequests';
import type { StockRequestPriority, CreateStockRequestLineInput } from './types';
import { Button } from '../../components/ui/button';

interface Props {
  onClose: () => void;
  onSuccess?: (requestId: string) => void;
}

interface LineItemDraft extends CreateStockRequestLineInput {
  tempId: string;
}

export default function CreateStockRequestModal({ onClose, onSuccess }: Props) {
  const { organisation } = useAuth();
  const orgId = organisation?.id ?? '';

  const { data: warehouses = [], isLoading: isLoadingWarehouses } = useWarehouses();
  const createRequest = useCreateStockRequest();
  const submitRequest = useSubmitStockRequest();

  // Fetch materials for SKU selector
  const { data: materials = [], isLoading: isLoadingMaterials } = useQuery({
    queryKey: ['materials', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('materials')
        .select('id, name, item_code, unit')
        .eq('organisation_id', orgId)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId,
  });

  // Fetch company variants
  const { data: variants = [] } = useQuery({
    queryKey: ['company_variants', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_variants')
        .select('id, item_id, variant_name')
        .eq('organisation_id', orgId)
        .eq('is_active', true);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId,
  });

  // Form State
  const [destinationWarehouseId, setDestinationWarehouseId] = useState<string>('');
  const [requiredDate, setRequiredDate] = useState<string>('');
  const [priority, setPriority] = useState<StockRequestPriority>('normal');
  const [remarks, setRemarks] = useState<string>('');
  const [lines, setLines] = useState<LineItemDraft[]>([
    { tempId: crypto.randomUUID(), item_id: '', requested_qty: 1, notes: '' },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [submittingDirectly, setSubmittingDirectly] = useState(false);

  const activeWarehouses = useMemo(
    () => warehouses.filter((w) => w.is_active !== false),
    [warehouses],
  );

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      { tempId: crypto.randomUUID(), item_id: '', requested_qty: 1, notes: '' },
    ]);
  };

  const removeLine = (tempId: string) => {
    if (lines.length === 1) return;
    setLines((prev) => prev.filter((l) => l.tempId !== tempId));
  };

  const updateLine = (tempId: string, updates: Partial<LineItemDraft>) => {
    setLines((prev) =>
      prev.map((line) => (line.tempId === tempId ? { ...line, ...updates } : line)),
    );
  };

  const handleSave = async (submitNow = false) => {
    setError(null);

    if (!destinationWarehouseId) {
      setError('Please select a destination warehouse.');
      return;
    }

    if (lines.length === 0) {
      setError('At least one item line is required.');
      return;
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.item_id) {
        setError(`Please select an item for row ${i + 1}.`);
        return;
      }
      if (!line.requested_qty || line.requested_qty <= 0) {
        setError(`Requested quantity must be greater than zero for row ${i + 1}.`);
        return;
      }
    }

    try {
      if (submitNow) setSubmittingDirectly(true);

      const created = await createRequest.mutateAsync({
        destination_warehouse_id: destinationWarehouseId,
        required_date: requiredDate || undefined,
        priority,
        remarks: remarks.trim() || undefined,
        lines: lines.map((l) => ({
          item_id: l.item_id,
          company_variant_id: l.company_variant_id || undefined,
          requested_qty: Number(l.requested_qty),
          notes: l.notes?.trim() || undefined,
        })),
      });

      const reqId = (created as any)?.id;

      if (submitNow && reqId) {
        await submitRequest.mutateAsync(reqId);
      }

      onClose();
      if (onSuccess && reqId) {
        onSuccess(reqId);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to create stock request');
    } finally {
      setSubmittingDirectly(false);
    }
  };

  const isSaving = createRequest.isPending || submitRequest.isPending || submittingDirectly;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-3xl p-6 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-200">
          <div className="flex items-center gap-2">
            <ClipboardList className="text-blue-600" size={20} />
            <div>
              <h2 className="text-base font-bold text-zinc-900 m-0">New Stock Request</h2>
              <p className="text-xs text-zinc-500 m-0">
                Request inventory for your destination warehouse
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"
          >
            <X size={18} />
          </Button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
              {error}
            </div>
          )}

          {/* Form Meta Fields */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Destination Warehouse <span className="text-red-500">*</span>
              </label>
              <select
                className="w-full text-xs bg-zinc-50 border border-zinc-300 rounded-lg px-3 py-2 text-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={destinationWarehouseId}
                onChange={(e) => setDestinationWarehouseId(e.target.value)}
                disabled={isLoadingWarehouses || isSaving}
              >
                <option value="">Select Destination...</option>
                {activeWarehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.warehouse_name || wh.name} ({wh.warehouse_code || 'WH'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Required By Date
              </label>
              <input
                type="date"
                className="w-full text-xs bg-zinc-50 border border-zinc-300 rounded-lg px-3 py-2 text-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={requiredDate}
                onChange={(e) => setRequiredDate(e.target.value)}
                disabled={isSaving}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Priority</label>
              <select
                className="w-full text-xs bg-zinc-50 border border-zinc-300 rounded-lg px-3 py-2 text-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={priority}
                onChange={(e) => setPriority(e.target.value as StockRequestPriority)}
                disabled={isSaving}
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              Purpose / Remarks
            </label>
            <textarea
              className="w-full text-xs bg-zinc-50 border border-zinc-300 rounded-lg px-3 py-2 text-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none h-16"
              placeholder="e.g., Weekly stock replenishment for project site delivery..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              disabled={isSaving}
            />
          </div>

          {/* Line Items Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider m-0">
                Requested Items ({lines.length})
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={addLine}
                disabled={isSaving}
                className="flex items-center gap-1.5 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
              >
                <Plus size={13} /> Add Item
              </Button>
            </div>

            <div className="border border-zinc-200 rounded-lg overflow-hidden bg-white shadow-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-100/75 border-b border-zinc-200 text-[11px] font-semibold text-zinc-600">
                    <th className="py-2 px-3 w-10 text-center">#</th>
                    <th className="py-2 px-3 min-w-[200px]">Item / SKU</th>
                    <th className="py-2 px-3 w-[150px]">Variant</th>
                    <th className="py-2 px-3 w-[120px] text-left">Req Qty</th>
                    <th className="py-2 px-3">Notes</th>
                    <th className="py-2 px-2 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-xs">
                  {lines.map((line, idx) => {
                    const availableVariants = variants.filter(
                      (v) => (v as any).item_id === line.item_id,
                    );
                    const selectedMaterial = materials.find((m) => m.id === line.item_id);

                    return (
                      <tr key={line.tempId} className="hover:bg-zinc-50/50">
                        <td className="py-2 px-3 text-center text-zinc-400 font-mono text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-3">
                          <select
                            className="w-full text-xs bg-white border border-zinc-300 rounded px-2 py-1 text-zinc-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={line.item_id}
                            onChange={(e) =>
                              updateLine(line.tempId, {
                                item_id: e.target.value,
                                company_variant_id: undefined,
                              })
                            }
                            disabled={isLoadingMaterials || isSaving}
                          >
                            <option value="">Select Item SKU...</option>
                            {materials.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name} {m.item_code ? `(${m.item_code})` : ''}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 px-3">
                          <select
                            className="w-full text-xs bg-white border border-zinc-300 rounded px-2 py-1 text-zinc-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={line.company_variant_id || ''}
                            onChange={(e) =>
                              updateLine(line.tempId, {
                                company_variant_id: e.target.value || undefined,
                              })
                            }
                            disabled={!line.item_id || isSaving}
                          >
                            <option value="">Standard (No Variant)</option>
                            {availableVariants.map((v: any) => (
                              <option key={v.id} value={v.id}>
                                {v.variant_name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 px-3 text-left">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="0.01"
                              step="any"
                              className="w-20 text-xs bg-white border border-zinc-300 rounded px-2 py-1 text-zinc-800 text-left focus:outline-none focus:ring-1 focus:ring-blue-500"
                              value={line.requested_qty || ''}
                              onChange={(e) =>
                                updateLine(line.tempId, {
                                  requested_qty: Number(e.target.value),
                                })
                              }
                              disabled={isSaving}
                            />
                            <span className="text-[11px] text-zinc-500 truncate">
                              {selectedMaterial?.unit || 'Units'}
                            </span>
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            placeholder="Optional notes..."
                            className="w-full text-xs bg-white border border-zinc-300 rounded px-2 py-1 text-zinc-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={line.notes || ''}
                            onChange={(e) => updateLine(line.tempId, { notes: e.target.value })}
                            disabled={isSaving}
                          />
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeLine(line.tempId)}
                            disabled={lines.length === 1 || isSaving}
                            className={`p-1 rounded text-zinc-400 hover:text-red-600 transition-colors ${
                              lines.length === 1 ? 'opacity-30 cursor-not-allowed' : ''
                            }`}
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-zinc-200">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSave(false)}
              disabled={isSaving}
              className="text-xs text-zinc-700"
            >
              {isSaving && !submittingDirectly ? (
                <>
                  <Loader2 size={14} className="animate-spin mr-1.5" /> Saving...
                </>
              ) : (
                'Save as Draft'
              )}
            </Button>

            <Button
              size="sm"
              onClick={() => handleSave(true)}
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5"
            >
              {submittingDirectly ? (
                <>
                  <Loader2 size={14} className="animate-spin mr-1.5" /> Submitting...
                </>
              ) : (
                <>
                  Submit Request <ArrowRight size={13} />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
