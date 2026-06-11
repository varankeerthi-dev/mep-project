import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';

type ProductionEntryFormProps = {
  onNavigate: (path: string) => void;
};

type MaterialEntry = {
  job_card_material_id: string;
  material_id: string;
  material_name: string;
  issued_qty: number;
  consumed_qty: number;
  wastage_qty: number;
  return_qty: number;
};

type WarehouseInfo = {
  id: string;
  name: string;
  warehouse_code: string;
  warehouse_purpose: string;
  is_default: boolean;
};

export default function ProductionEntryForm({ onNavigate }: ProductionEntryFormProps) {
  const { organisation, user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const jobCardId = searchParams.get('jobCard');

  const [formData, setFormData] = useState({
    job_card_id: jobCardId || '',
    actual_qty: 0,
    output_unit: 'nos',
    notes: ''
  });

  const [materialEntries, setMaterialEntries] = useState<MaterialEntry[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ─── QUERIES ─────────────────────────────────────────────────────

  const { data: jobCards } = useQuery({
    queryKey: ['job-cards-for-entry', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase
        .from('job_cards')
        .select('*')
        .eq('organisation_id', organisation.id)
        .in('status', ['issued', 'in_progress']);
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id && !jobCardId
  });

  const { data: selectedJobCard } = useQuery({
    queryKey: ['selected-job-card', formData.job_card_id],
    queryFn: async () => {
      if (!formData.job_card_id) return null;
      const { data, error } = await supabase
        .from('job_cards')
        .select('*, bom_headers!inner(product_id)')
        .eq('id', formData.job_card_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!formData.job_card_id
  });

  const { data: jobMaterials } = useQuery({
    queryKey: ['job-materials-for-entry', formData.job_card_id],
    queryFn: async () => {
      if (!formData.job_card_id) return [];
      const { data, error } = await supabase
        .from('job_card_materials')
        .select('*, materials(name, unit, id)')
        .eq('job_card_id', formData.job_card_id)
        .in('status', ['issued', 'consumed']);
      if (error) throw error;
      return data || [];
    },
    enabled: !!formData.job_card_id
  });

  // Get existing production entries for this job card (for partial production)
  const { data: existingEntries } = useQuery({
    queryKey: ['existing-entries', formData.job_card_id],
    queryFn: async () => {
      if (!formData.job_card_id) return [];
      const { data, error } = await supabase
        .from('production_entries')
        .select('*, production_entry_items(*)')
        .eq('job_card_id', formData.job_card_id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!formData.job_card_id
  });

  const { data: warehouses } = useQuery({
    queryKey: ['manufacturing-warehouses', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase
        .from('warehouses')
        .select('id, name, warehouse_code, warehouse_purpose, is_default')
        .eq('organisation_id', organisation.id)
        .eq('is_active', true);
      if (error) throw error;
      return (data || []) as WarehouseInfo[];
    },
    enabled: !!organisation?.id
  });

  const whIds = useMemo(() => {
    if (!warehouses) return null;
    const mainStore = warehouses.find(w => w.warehouse_purpose === 'main' || w.is_default);
    const wip = warehouses.find(w => w.warehouse_purpose === 'wip');
    const fg = warehouses.find(w => w.warehouse_purpose === 'fg');
    return { mainStore, wip, fg };
  }, [warehouses]);

  // Compute cumulative actual qty from existing entries
  const cumulativeActualQty = useMemo(() => {
    if (!existingEntries) return 0;
    return existingEntries.reduce((sum, e) => sum + (e.actual_qty || 0), 0);
  }, [existingEntries]);

  // Compute cumulative material consumption from existing entries
  const cumulativeConsumption = useMemo(() => {
    if (!existingEntries) return {} as Record<string, { consumed: number; wastage: number; returned: number }>;
    const result: Record<string, { consumed: number; wastage: number; returned: number }> = {};
    for (const entry of existingEntries) {
      for (const item of entry.production_entry_items || []) {
        if (!result[item.material_id]) {
          result[item.material_id] = { consumed: 0, wastage: 0, returned: 0 };
        }
        result[item.material_id].consumed += item.consumed_qty || 0;
        result[item.material_id].wastage += item.wastage_qty || 0;
        result[item.material_id].returned += item.return_qty || 0;
      }
    }
    return result;
  }, [existingEntries]);

  // ─── RETURN VALIDATION ───────────────────────────────────────────

  const returnValidation = useMemo(() => {
    const result: Record<string, { valid: boolean; remaining: number; error?: string }> = {};
    for (const mat of materialEntries) {
      const issued = mat.issued_qty;
      const consumed = mat.consumed_qty;
      const wastage = mat.wastage_qty;
      const returnQty = mat.return_qty;
      const total = consumed + wastage + returnQty;
      const remaining = issued - consumed - wastage - returnQty;

      let error: string | undefined;
      if (total > issued) {
        error = `Consumed (${consumed}) + Wastage (${wastage}) + Return (${returnQty}) = ${total} exceeds issued (${issued})`;
      } else if (returnQty < 0) {
        error = 'Return quantity cannot be negative';
      } else if (consumed < 0) {
        error = 'Consumed quantity cannot be negative';
      } else if (wastage < 0) {
        error = 'Wastage quantity cannot be negative';
      }

      result[mat.material_id] = {
        valid: !error && total <= issued,
        remaining: Math.max(0, remaining),
        error
      };
    }
    return result;
  }, [materialEntries]);

  const allValid = useMemo(() => {
    return Object.values(returnValidation).every(v => v.valid);
  }, [returnValidation]);

  // ─── HANDLERS ────────────────────────────────────────────────────

  const handleJobCardSelect = (jobCardId: string) => {
    const jc = jobCards?.find(j => j.id === jobCardId);
    setFormData({ ...formData, job_card_id: jobCardId, output_unit: jc?.output_unit || 'nos' });

    // Initialize material entries from job_card_materials
    if (jobMaterials) {
      setMaterialEntries(jobMaterials.map(mat => ({
        job_card_material_id: mat.id,
        material_id: mat.material_id,
        material_name: mat.materials?.name || '',
        issued_qty: mat.issued_qty || 0,
        consumed_qty: 0,
        wastage_qty: 0,
        return_qty: 0
      })));
    }
  };

  const updateMaterialEntry = (index: number, field: keyof MaterialEntry, value: number) => {
    const newEntries = [...materialEntries];
    newEntries[index] = { ...newEntries[index], [field]: value };
    setMaterialEntries(newEntries);
  };

  // ─── SUBMIT: Production Entry with Stock Transfers ────────────────

  const saveEntry = useMutation({
    mutationFn: async () => {
      if (!organisation?.id || !user?.id || !formData.job_card_id) throw new Error('Missing required data');
      if (!formData.actual_qty || formData.actual_qty <= 0) throw new Error('Actual quantity must be greater than 0');
      if (!allValid) throw new Error('Material quantities are invalid — consumed + wastage + return must equal issued');

      setSubmitError(null);

      const wh = whIds;
      if (!wh?.wip || !wh?.fg || !wh?.mainStore) {
        throw new Error('Required warehouses (WIP / FG / Main Store) not found');
      }

      const yieldPct = selectedJobCard?.planned_qty
        ? (formData.actual_qty / selectedJobCard.planned_qty) * 100
        : 0;

      // 1. Create production entry
      const { data: entry, error: entryError } = await supabase
        .from('production_entries')
        .insert({
          job_card_id: formData.job_card_id,
          actual_qty: formData.actual_qty,
          output_unit: formData.output_unit || selectedJobCard?.output_unit,
          yield_pct: yieldPct,
          notes: formData.notes,
          created_by: user.id,
          organisation_id: organisation.id
        })
        .select()
        .single();
      if (entryError) throw entryError;

      // 2. Create material_outward parent for WIP→consumption audit trail
      const { data: outwardRecord, error: outwardErr } = await supabase
        .from('material_outward')
        .insert({
          outward_date: new Date().toISOString().split('T')[0],
          remarks: `Production Entry ${entry.entry_no} — materials consumed from WIP`,
          organisation_id: organisation.id
        })
        .select()
        .single();
      if (outwardErr) throw outwardErr;

      // 3. Create material_inward parent for returns audit trail
      let inwardRecord: { id: string } | null = null;
      const hasReturns = materialEntries.some(m => m.return_qty > 0);
      if (hasReturns) {
        const { data: ir, error: irErr } = await supabase
          .from('material_inward')
          .insert({
            inward_date: new Date().toISOString().split('T')[0],
            vendor_name: 'Production Return',
            remarks: `Production Entry ${entry.entry_no} — unused materials returned to Main Store`,
            organisation_id: organisation.id,
            supply_type: 'WAREHOUSE'
          })
          .select()
          .single();
        if (irErr) throw irErr;
        inwardRecord = ir;
      }

      // 4. Process each material
      for (const mat of materialEntries) {
        // a. Save production_entry_items
        const { error: itemError } = await supabase
          .from('production_entry_items')
          .insert({
            production_entry_id: entry.id,
            job_card_material_id: mat.job_card_material_id,
            material_id: mat.material_id,
            issued_qty: mat.issued_qty,
            consumed_qty: mat.consumed_qty,
            wastage_qty: mat.wastage_qty,
            return_qty: mat.return_qty
          });
        if (itemError) throw itemError;

        const totalDeductFromWip = mat.consumed_qty + mat.wastage_qty;

        // b. Decrease WIP stock (consumed + wastage)
        if (totalDeductFromWip > 0) {
          const { data: wipStock } = await supabase
            .from('item_stock')
            .select('id, current_stock')
            .eq('item_id', mat.material_id)
            .eq('warehouse_id', wh.wip.id)
            .eq('organisation_id', organisation.id)
            .maybeSingle();

          if (wipStock) {
            await supabase
              .from('item_stock')
              .update({ current_stock: wipStock.current_stock - totalDeductFromWip })
              .eq('id', wipStock.id);
          }

          // Record in material_outward_items
          await supabase
            .from('material_outward_items')
            .insert({
              outward_id: outwardRecord.id,
              material_name: mat.material_name,
              quantity: totalDeductFromWip,
              unit: jobMaterials?.find(m => m.material_id === mat.material_id)?.materials?.unit || '',
              material_id: mat.material_id,
              warehouse_id: wh.wip.id,
              organisation_id: organisation.id
            });
        }

        // c. Return unused materials: WIP ↓, Main Store ↑
        if (mat.return_qty > 0 && inwardRecord) {
          const { data: wipStockForReturn } = await supabase
            .from('item_stock')
            .select('id, current_stock')
            .eq('item_id', mat.material_id)
            .eq('warehouse_id', wh.wip.id)
            .eq('organisation_id', organisation.id)
            .maybeSingle();

          if (wipStockForReturn) {
            await supabase
              .from('item_stock')
              .update({ current_stock: wipStockForReturn.current_stock - mat.return_qty })
              .eq('id', wipStockForReturn.id);
          }

          // Increase Main Store
          const { data: mainStock } = await supabase
            .from('item_stock')
            .select('id, current_stock')
            .eq('item_id', mat.material_id)
            .eq('warehouse_id', wh.mainStore.id)
            .eq('organisation_id', organisation.id)
            .maybeSingle();

          if (mainStock) {
            await supabase
              .from('item_stock')
              .update({ current_stock: mainStock.current_stock + mat.return_qty })
              .eq('id', mainStock.id);
          } else {
            await supabase
              .from('item_stock')
              .insert({
                item_id: mat.material_id,
                warehouse_id: wh.mainStore.id,
                organisation_id: organisation.id,
                current_stock: mat.return_qty
              });
          }

          // Record return in material_inward_items
          await supabase
            .from('material_inward_items')
            .insert({
              inward_id: inwardRecord.id,
              material_name: mat.material_name,
              quantity: mat.return_qty,
              unit: jobMaterials?.find(m => m.material_id === mat.material_id)?.materials?.unit || '',
              material_id: mat.material_id,
              warehouse_id: wh.mainStore.id,
              organisation_id: organisation.id
            });
        }

        // d. Update job_card_materials (consumed/return quantities)
        if (mat.job_card_material_id) {
          const cumulative = cumulativeConsumption[mat.material_id] || { consumed: 0, wastage: 0, returned: 0 };
          await supabase
            .from('job_card_materials')
            .update({
              consumed_qty: cumulative.consumed + mat.consumed_qty,
              wastage_qty: cumulative.wastage + mat.wastage_qty,
              return_qty: cumulative.returned + mat.return_qty,
              status: 'consumed'
            })
            .eq('id', mat.job_card_material_id);
        }
      }

      // 5. Look up finished product — prefer product_id FK from BOM, fall back to name match
      const bomProductId = (selectedJobCard as any)?.bom_headers?.product_id;
      const productName = selectedJobCard?.product_name;
      let finishedProductId: string | null = null;

      if (bomProductId) {
        finishedProductId = bomProductId;
      } else if (productName) {
        const { data: existingProduct } = await supabase
          .from('materials')
          .select('id')
          .eq('name', productName)
          .eq('organisation_id', organisation.id)
          .maybeSingle();

        if (existingProduct) {
          finishedProductId = existingProduct.id;
        } else {
          const { data: newProduct, error: prodErr } = await supabase
            .from('materials')
            .insert({
              name: productName,
              unit: formData.output_unit || selectedJobCard?.output_unit || 'nos',
              organisation_id: organisation.id,
              item_classification: 'finished_good',
              allow_purchase: false,
              allow_sales: true,
              show_in_bom: false,
              is_manufactured: true
            })
            .select('id')
            .single();
          if (prodErr) throw prodErr;
          finishedProductId = newProduct.id;
        }
      }

      // 6. Add finished goods to FG Warehouse
      if (finishedProductId && formData.actual_qty > 0) {
        const { data: fgStock } = await supabase
          .from('item_stock')
          .select('id, current_stock')
          .eq('item_id', finishedProductId)
          .eq('warehouse_id', wh.fg.id)
          .eq('organisation_id', organisation.id)
          .maybeSingle();

        if (fgStock) {
          await supabase
            .from('item_stock')
            .update({ current_stock: fgStock.current_stock + formData.actual_qty })
            .eq('id', fgStock.id);
        } else {
          await supabase
            .from('item_stock')
            .insert({
              item_id: finishedProductId,
              warehouse_id: wh.fg.id,
              organisation_id: organisation.id,
              current_stock: formData.actual_qty
            });
        }

        // Record finished goods inward
        let fgInwardRecord = inwardRecord;
        if (!fgInwardRecord) {
          const { data: fgIr, error: fgIrErr } = await supabase
            .from('material_inward')
            .insert({
              inward_date: new Date().toISOString().split('T')[0],
              vendor_name: 'Manufacturing',
              remarks: `Production Entry ${entry.entry_no} — finished goods added to FG Warehouse`,
              organisation_id: organisation.id,
              supply_type: 'WAREHOUSE'
            })
            .select()
            .single();
          if (!fgIrErr) fgInwardRecord = fgIr;
        }

        if (fgInwardRecord) {
          await supabase
            .from('material_inward_items')
            .insert({
              inward_id: fgInwardRecord.id,
              material_name: productName || '',
              quantity: formData.actual_qty,
              unit: formData.output_unit || selectedJobCard?.output_unit || '',
              material_id: finishedProductId,
              warehouse_id: wh.fg.id,
              organisation_id: organisation.id
            });
        }
      }

      // 7. Update job card: actual_qty, yield, status
      // For partial production: accumulate actual_qty
      const totalActual = cumulativeActualQty + formData.actual_qty;
      const totalYield = selectedJobCard?.planned_qty
        ? (totalActual / selectedJobCard.planned_qty) * 100
        : 0;

      // Determine if job card is complete (actual >= planned)
      const isComplete = totalActual >= (selectedJobCard?.planned_qty || 0);
      const newStatus = isComplete ? 'completed' : 'in_progress';

      const { error: jcError } = await supabase
        .from('job_cards')
        .update({
          actual_qty: totalActual,
          yield_pct: totalYield,
          status: newStatus,
          completed_at: isComplete ? new Date().toISOString() : null
        })
        .eq('id', formData.job_card_id);
      if (jcError) throw jcError;

      return entry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-cards'] });
      queryClient.invalidateQueries({ queryKey: ['job-card', formData.job_card_id] });
      queryClient.invalidateQueries({ queryKey: ['job-card-materials', formData.job_card_id] });
      queryClient.invalidateQueries({ queryKey: ['production-entries', formData.job_card_id] });
      onNavigate('/manufacturing/job-cards');
    },
    onError: (err: Error) => {
      setSubmitError(err.message);
    }
  });

  // ─── RENDER ───────────────────────────────────────────────────────

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Record Production Entry</h1>
          <p className="text-zinc-500 mt-1">Log actual consumption and output</p>
          {cumulativeActualQty > 0 && (
            <p className="text-sm text-blue-600 mt-1">
              Previous entries produced: {cumulativeActualQty} {selectedJobCard?.output_unit}
            </p>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => onNavigate('/manufacturing/job-cards')}
            className="h-10 px-5 border border-zinc-200 text-zinc-700 rounded-lg font-medium hover:bg-zinc-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => saveEntry.mutate()}
            disabled={!formData.job_card_id || !formData.actual_qty || saveEntry.isPending || !allValid}
            className="h-10 px-5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saveEntry.isPending ? 'Saving...' : 'Save Entry'}
          </button>
        </div>
      </div>

      {submitError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {submitError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-zinc-200 rounded-lg p-6">
            <h2 className="text-lg font-medium text-zinc-900 mb-4">Job Card Selection</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">Job Card *</label>
                <select
                  value={formData.job_card_id}
                  onChange={(e) => handleJobCardSelect(e.target.value)}
                  disabled={!!jobCardId}
                  className="w-full h-10 px-4 border border-zinc-200 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-zinc-50"
                >
                  <option value="">Select job card</option>
                  {jobCards?.map((jc) => (
                    <option key={jc.id} value={jc.id}>
                      {jc.job_card_no} - {jc.product_name} ({jc.planned_qty} {jc.output_unit})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedJobCard && (
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-zinc-50 rounded-lg">
                <div>
                  <div className="text-sm text-zinc-500">Product</div>
                  <div className="font-medium text-zinc-900">{selectedJobCard.product_name}</div>
                </div>
                <div>
                  <div className="text-sm text-zinc-500">Planned Qty</div>
                  <div className="font-medium text-zinc-900">{selectedJobCard.planned_qty} {selectedJobCard.output_unit}</div>
                </div>
                <div>
                  <div className="text-sm text-zinc-500">Cumulative Actual</div>
                  <div className="font-medium text-zinc-900">{cumulativeActualQty + (formData.actual_qty || 0)} {selectedJobCard.output_unit}</div>
                </div>
                <div>
                  <div className="text-sm text-zinc-500">Yield</div>
                  <div className="font-medium text-zinc-900">
                    {(cumulativeActualQty + formData.actual_qty) > 0 && selectedJobCard?.planned_qty
                      ? `${(((cumulativeActualQty + formData.actual_qty) / selectedJobCard.planned_qty) * 100).toFixed(1)}%`
                      : '-'}
                  </div>
                </div>
              </div>
            )}
          </div>

          {formData.job_card_id && (
            <div className="bg-white border border-zinc-200 rounded-lg p-6">
              <h2 className="text-lg font-medium text-zinc-900 mb-4">Production Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">Actual Qty Produced *</label>
                  <input
                    type="number"
                    value={formData.actual_qty || ''}
                    onChange={(e) => setFormData({ ...formData, actual_qty: Number(e.target.value) })}
                    className="w-full h-10 px-4 border border-zinc-200 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">Notes</label>
                  <input
                    type="text"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Optional notes"
                    className="w-full h-10 px-4 border border-zinc-200 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {materialEntries.length > 0 && (
            <div className="bg-white border border-zinc-200 rounded-lg p-6">
              <h2 className="text-lg font-medium text-zinc-900 mb-4">Material Consumption</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-200">
                      <th className="text-left px-4 py-3 text-sm font-medium text-zinc-500">Material</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-zinc-500">Issued</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-zinc-500">Consumed</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-zinc-500">Wastage</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-zinc-500">Return</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-zinc-500">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materialEntries.map((mat, index) => {
                      const validation = returnValidation[mat.material_id];
                      return (
                        <tr key={mat.material_id} className="border-b border-zinc-100">
                          <td className="px-4 py-4 font-medium text-zinc-900">{mat.material_name}</td>
                          <td className="px-4 py-4 text-zinc-700">{mat.issued_qty}</td>
                          <td className="px-4 py-4">
                            <input
                              type="number"
                              value={mat.consumed_qty || ''}
                              onChange={(e) => updateMaterialEntry(index, 'consumed_qty', Number(e.target.value))}
                              className="w-20 h-8 px-2 border border-zinc-200 rounded focus:outline-none focus:border-blue-500"
                            />
                          </td>
                          <td className="px-4 py-4">
                            <input
                              type="number"
                              value={mat.wastage_qty || ''}
                              onChange={(e) => updateMaterialEntry(index, 'wastage_qty', Number(e.target.value))}
                              className="w-20 h-8 px-2 border border-zinc-200 rounded focus:outline-none focus:border-blue-500"
                            />
                          </td>
                          <td className="px-4 py-4">
                            <input
                              type="number"
                              value={mat.return_qty || ''}
                              onChange={(e) => updateMaterialEntry(index, 'return_qty', Number(e.target.value))}
                              className="w-20 h-8 px-2 border border-zinc-200 rounded focus:outline-none focus:border-blue-500"
                            />
                          </td>
                          <td className="px-4 py-4">
                            <span className={`text-sm font-medium ${validation?.remaining === 0 ? 'text-green-600' : validation?.remaining && validation.remaining > 0 ? 'text-zinc-700' : 'text-red-600'}`}>
                              {validation?.remaining ?? '-'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Validation errors */}
              {Object.entries(returnValidation).map(([matId, v]) => (
                v.error && (
                  <div key={matId} className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
                    {v.error}
                  </div>
                )
              ))}

              <div className="mt-4 p-3 bg-zinc-50 rounded-lg text-xs text-zinc-500">
                Validation rule: Consumed + Wastage + Return = Issued (must balance)
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white border border-zinc-200 rounded-lg p-6 sticky top-6">
            <h2 className="text-lg font-medium text-zinc-900 mb-4">Summary</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Job Card</span>
                <span className="font-medium text-zinc-900">{selectedJobCard?.job_card_no || '-'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Planned Qty</span>
                <span className="font-medium text-zinc-900">{selectedJobCard?.planned_qty || '-'} {selectedJobCard?.output_unit}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Previous Entries</span>
                <span className="font-medium text-zinc-900">{cumulativeActualQty} {selectedJobCard?.output_unit}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">This Entry</span>
                <span className="font-medium text-zinc-900">{formData.actual_qty || 0} {formData.output_unit}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-zinc-200 pt-3">
                <span className="text-zinc-500">Total Actual</span>
                <span className="font-medium text-zinc-900">{cumulativeActualQty + (formData.actual_qty || 0)} {selectedJobCard?.output_unit}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Yield</span>
                <span className="font-medium text-zinc-900">
                  {(cumulativeActualQty + formData.actual_qty) > 0 && selectedJobCard?.planned_qty
                    ? `${(((cumulativeActualQty + formData.actual_qty) / selectedJobCard.planned_qty) * 100).toFixed(1)}%`
                    : '-'}
                </span>
              </div>
            </div>

            <div className="mt-6 p-4 bg-zinc-50 rounded-lg">
              <h3 className="text-sm font-medium text-zinc-700 mb-2">What happens on save</h3>
              <ul className="text-xs text-zinc-500 space-y-1">
                <li>• WIP stock decreases (consumed + wastage)</li>
                <li>• Unused materials return to Main Store</li>
                <li>• Finished goods added to FG Warehouse</li>
                <li>• Auto-created product in materials (if new)</li>
                <li>• Audit trail recorded (inward/outward)</li>
              </ul>
            </div>

            {whIds && (
              <div className="mt-4 p-4 bg-zinc-50 rounded-lg">
                <h3 className="text-sm font-medium text-zinc-700 mb-2">Warehouses</h3>
                <div className="text-xs text-zinc-500 space-y-1">
                  <div>Main Store: {whIds.mainStore?.name || 'Not found'}</div>
                  <div>WIP: {whIds.wip?.name || 'Not found'}</div>
                  <div>FG: {whIds.fg?.name || 'Not found'}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
