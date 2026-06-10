import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';

type JobCardDetailProps = {
  jobCardId: string;
  onNavigate: (path: string) => void;
};

type WarehouseInfo = {
  id: string;
  name: string;
  warehouse_code: string;
  warehouse_purpose: string;
  is_default: boolean;
};

type JobMaterial = {
  id: string;
  material_id: string;
  planned_qty: number;
  issued_qty: number;
  consumed_qty: number;
  wastage_qty: number;
  return_qty: number;
  status: string;
  warehouse_id: string | null;
  materials: { name: string; unit: string } | null;
};

export default function JobCardDetail({ jobCardId, onNavigate }: JobCardDetailProps) {
  const { organisation, user } = useAuth();
  const queryClient = useQueryClient();
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [issueError, setIssueError] = useState<string | null>(null);
  const [returnError, setReturnError] = useState<string | null>(null);

  const { data: jobCard, isLoading } = useQuery({
    queryKey: ['job-card', jobCardId],
    queryFn: async () => {
      if (!jobCardId) return null;
      const { data, error } = await supabase
        .from('job_cards')
        .select('*')
        .eq('id', jobCardId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!jobCardId
  });

  const { data: materials } = useQuery({
    queryKey: ['job-card-materials', jobCardId],
    queryFn: async () => {
      if (!jobCardId) return [];
      const { data, error } = await supabase
        .from('job_card_materials')
        .select('*, materials(name, unit)')
        .eq('job_card_id', jobCardId);
      if (error) throw error;
      return (data || []) as JobMaterial[];
    },
    enabled: !!jobCardId
  });

  const materialIds = useMemo(() => {
    if (!materials) return [];
    return [...new Set(materials.map(m => m.material_id).filter(Boolean))];
  }, [materials]);

  const { data: stockByMaterial } = useQuery<Record<string, { warehouse_name: string; warehouse_purpose: string; current_stock: number }[]>>({
    queryKey: ['job-card-stock', materialIds, organisation?.id],
    queryFn: async () => {
      if (!organisation?.id || materialIds.length === 0) return {};
      let stockRows: any[] = [];
      // Try with organisation_id first, fallback without
      const { data: withOrg, error: err1 } = await supabase
        .from('item_stock')
        .select('item_id, company_variant_id, current_stock, warehouse_id')
        .eq('organisation_id', organisation.id)
        .in('item_id', materialIds);
      if (err1) {
        const { data: withoutOrg } = await supabase
          .from('item_stock')
          .select('item_id, company_variant_id, current_stock, warehouse_id')
          .in('item_id', materialIds);
        stockRows = withoutOrg || [];
      } else {
        stockRows = withOrg || [];
      }
      // Fetch warehouse names
      const whIds = [...new Set(stockRows.map(r => r.warehouse_id).filter(Boolean))];
      let whMap: Record<string, string> = {};
      if (whIds.length > 0) {
        const { data: whRows } = await supabase.from('warehouses').select('id, name').in('id', whIds);
        for (const w of whRows || []) whMap[w.id] = w.name;
      }
      const map: Record<string, { warehouse_name: string; warehouse_purpose: string; current_stock: number }[]> = {};
      for (const row of stockRows) {
        if (!map[row.item_id]) map[row.item_id] = [];
        map[row.item_id].push({
          warehouse_name: whMap[row.warehouse_id] || 'Store',
          warehouse_purpose: 'general',
          current_stock: row.current_stock || 0,
        });
      }
      return map;
    },
    enabled: !!organisation?.id && materialIds.length > 0
  });

  const totalStockByMaterial = useMemo(() => {
    const map: Record<string, number> = {};
    for (const [matId, entries] of Object.entries(stockByMaterial || {})) {
      map[matId] = entries.reduce((sum, e) => sum + e.current_stock, 0);
    }
    return map;
  }, [stockByMaterial]);

  const { data: productionEntries } = useQuery({
    queryKey: ['production-entries', jobCardId],
    queryFn: async () => {
      if (!jobCardId) return [];
      const { data, error } = await supabase
        .from('production_entries')
        .select('*')
        .eq('job_card_id', jobCardId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!jobCardId
  });

  // Get all three warehouses
  const { data: warehouses } = useQuery({
    queryKey: ['manufacturing-warehouses', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      // Try with warehouse_purpose first, fallback without
      let whData: any[] = [];
      const { data: withPurpose, error: err1 } = await supabase
        .from('warehouses')
        .select('id, name, warehouse_code, warehouse_purpose, is_default')
        .eq('organisation_id', organisation.id)
        .eq('is_active', true);
      if (err1) {
        const { data: withoutPurpose } = await supabase
          .from('warehouses')
          .select('id, name, warehouse_code, is_default')
          .eq('organisation_id', organisation.id)
          .eq('is_active', true);
        whData = (withoutPurpose || []).map((w: any) => ({ ...w, warehouse_purpose: w.is_default ? 'main' : 'general' }));
      } else {
        whData = withPurpose || [];
      }
      return whData as WarehouseInfo[];
    },
    enabled: !!organisation?.id
  });

  const whIds = useMemo(() => {
    if (!warehouses) return null;
    const mainStore = warehouses.find(w => w.warehouse_purpose === 'main' || w.is_default);
    const wip = warehouses.find(w => w.warehouse_purpose === 'wip');
    const fg = warehouses.find(w => w.warehouse_purpose === 'fg');
    // Fallback: if WIP/FG not found, use second/third warehouse
    const fallbackWip = wip || warehouses.find(w => w.id !== mainStore?.id);
    const fallbackFg = fg || warehouses.find(w => w.id !== mainStore?.id && w.id !== fallbackWip?.id);
    return { mainStore, wip: fallbackWip, fg: fallbackFg };
  }, [warehouses]);

  // ─── ISSUE MATERIALS: Main Store → WIP ───────────────────────────
  const issueMaterials = useMutation({
    mutationFn: async () => {
      if (!organisation?.id || !user?.id) throw new Error('Not authenticated');
      if (!whIds?.mainStore || !whIds?.wip) throw new Error('Required warehouses (Main Store / WIP) not found');

      setIssueError(null);

      // 1. Check stock availability for each reserved material (sum across all variants)
      const reservedMaterials = (materials || []).filter(m => m.status === 'reserved');
      if (reservedMaterials.length === 0) throw new Error('No reserved materials to issue');

      for (const mat of reservedMaterials) {
        let stockRows: any[] = [];
        const { data: withOrg, error: err1 } = await supabase
          .from('item_stock')
          .select('current_stock')
          .eq('item_id', mat.material_id)
          .eq('organisation_id', organisation.id);
        if (err1) {
          const { data: withoutOrg } = await supabase
            .from('item_stock')
            .select('current_stock')
            .eq('item_id', mat.material_id);
          stockRows = withoutOrg || [];
        } else {
          stockRows = withOrg || [];
        }

        const available = (stockRows || []).reduce((sum, r) => sum + (r.current_stock || 0), 0);
        if (available < mat.planned_qty) {
          throw new Error(
            `Insufficient stock for ${mat.materials?.name || 'material'}: ` +
            `available ${available} ${mat.materials?.unit || ''}, needed ${mat.planned_qty} ${mat.materials?.unit || ''}`
          );
        }
      }

      // 2. Create a material_outward parent record for audit trail
      const { data: outwardRecord, error: outwardErr } = await supabase
        .from('material_outward')
        .insert({
          outward_date: new Date().toISOString().split('T')[0],
          remarks: `Job Card ${jobCard?.job_card_no} — materials issued to production`,
          organisation_id: organisation.id
        })
        .select()
        .single();
      if (outwardErr) throw outwardErr;

      // 3. For each reserved material: move stock and record
      for (const mat of reservedMaterials) {
        const qty = mat.planned_qty;

        // a. Decrease Main Store stock
        const { data: mainStock } = await supabase
          .from('item_stock')
          .select('id, current_stock')
          .eq('item_id', mat.material_id)
          .eq('warehouse_id', whIds.mainStore.id)
          .eq('organisation_id', organisation.id)
          .maybeSingle();

        if (mainStock) {
          await supabase
            .from('item_stock')
            .update({ current_stock: mainStock.current_stock - qty })
            .eq('id', mainStock.id);
        }

        // b. Increase WIP stock (upsert)
        const { data: wipStock } = await supabase
          .from('item_stock')
          .select('id, current_stock')
          .eq('item_id', mat.material_id)
          .eq('warehouse_id', whIds.wip.id)
          .eq('organisation_id', organisation.id)
          .maybeSingle();

        if (wipStock) {
          await supabase
            .from('item_stock')
            .update({ current_stock: wipStock.current_stock + qty })
            .eq('id', wipStock.id);
        } else {
          await supabase
            .from('item_stock')
            .insert({
              item_id: mat.material_id,
              warehouse_id: whIds.wip.id,
              organisation_id: organisation.id,
              current_stock: qty
            });
        }

        // c. Record in material_outward_items (audit trail)
        await supabase
          .from('material_outward_items')
          .insert({
            outward_id: outwardRecord.id,
            material_name: mat.materials?.name || '',
            quantity: qty,
            unit: mat.materials?.unit || '',
            material_id: mat.material_id,
            warehouse_id: whIds.mainStore.id,
            organisation_id: organisation.id
          });

        // d. Update job_card_materials
        await supabase
          .from('job_card_materials')
          .update({
            issued_qty: qty,
            status: 'issued',
            warehouse_id: whIds.wip.id
          })
          .eq('id', mat.id);
      }

      // 4. Update job card status
      const { error: jcErr } = await supabase
        .from('job_cards')
        .update({ status: 'issued', issued_at: new Date().toISOString() })
        .eq('id', jobCardId);
      if (jcErr) throw jcErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-card', jobCardId] });
      queryClient.invalidateQueries({ queryKey: ['job-card-materials', jobCardId] });
    },
    onError: (err: Error) => {
      setIssueError(err.message);
    }
  });

  // ─── RETURN MATERIALS: WIP → Main Store ──────────────────────────
  const handleReturn = useMutation({
    mutationFn: async () => {
      if (!organisation?.id || !user?.id) throw new Error('Not authenticated');
      if (!whIds?.mainStore || !whIds?.wip) throw new Error('Required warehouses not found');

      setReturnError(null);

      const issuedMaterials = (materials || []).filter(m => m.status === 'issued');
      const returnItems: { material: JobMaterial; returnQty: number }[] = [];

      for (const mat of issuedMaterials) {
        const returnQty = returnQuantities[mat.id] || 0;
        if (returnQty > 0) {
          // Validate: cannot return more than issued
          if (returnQty > (mat.issued_qty || 0)) {
            throw new Error(
              `Cannot return more than issued for ${mat.materials?.name}: ` +
              `issued ${mat.issued_qty}, requested return ${returnQty}`
            );
          }
          returnItems.push({ material: mat, returnQty });
        }
      }

      if (returnItems.length === 0) return;

      // Create a material_inward parent record for audit trail
      const { data: inwardRecord, error: inwardErr } = await supabase
        .from('material_inward')
        .insert({
          inward_date: new Date().toISOString().split('T')[0],
          vendor_name: 'Production Return',
          remarks: `Job Card ${jobCard?.job_card_no} — materials returned from production`,
          organisation_id: organisation.id,
          supply_type: 'WAREHOUSE'
        })
        .select()
        .single();
      if (inwardErr) throw inwardErr;

      for (const { material: mat, returnQty } of returnItems) {
        // a. Decrease WIP stock
        const { data: wipStockForDec } = await supabase
          .from('item_stock')
          .select('id, current_stock')
          .eq('item_id', mat.material_id)
          .eq('warehouse_id', whIds.wip.id)
          .eq('organisation_id', organisation.id)
          .maybeSingle();

        if (wipStockForDec) {
          await supabase
            .from('item_stock')
            .update({ current_stock: wipStockForDec.current_stock - returnQty })
            .eq('id', wipStockForDec.id);
        }

        // b. Increase Main Store stock (upsert)
        const { data: mainStock } = await supabase
          .from('item_stock')
          .select('id, current_stock')
          .eq('item_id', mat.material_id)
          .eq('warehouse_id', whIds.mainStore.id)
          .eq('organisation_id', organisation.id)
          .maybeSingle();

        if (mainStock) {
          await supabase
            .from('item_stock')
            .update({ current_stock: mainStock.current_stock + returnQty })
            .eq('id', mainStock.id);
        } else {
          await supabase
            .from('item_stock')
            .insert({
              item_id: mat.material_id,
              warehouse_id: whIds.mainStore.id,
              organisation_id: organisation.id,
              current_stock: returnQty
            });
        }

        // c. Record in material_inward_items (audit trail)
        await supabase
          .from('material_inward_items')
          .insert({
            inward_id: inwardRecord.id,
            material_name: mat.materials?.name || '',
            quantity: returnQty,
            unit: mat.materials?.unit || '',
            material_id: mat.material_id,
            warehouse_id: whIds.mainStore.id,
            organisation_id: organisation.id
          });

        // d. Update job_card_materials
        await supabase
          .from('job_card_materials')
          .update({
            return_qty: returnQty,
            status: 'returned'
          })
          .eq('id', mat.id);
      }

      setShowReturnModal(false);
      setReturnQuantities({});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-card-materials', jobCardId] });
      queryClient.invalidateQueries({ queryKey: ['job-card', jobCardId] });
    },
    onError: (err: Error) => {
      setReturnError(err.message);
    }
  });

  // Compute return validation for each material
  const returnValidation = useMemo(() => {
    if (!materials) return {};
    const result: Record<string, { valid: boolean; remaining: number }> = {};
    for (const mat of materials) {
      if (mat.status === 'issued' || mat.status === 'returned') {
        const returnQty = returnQuantities[mat.id] || 0;
        const issued = mat.issued_qty || 0;
        const consumed = mat.consumed_qty || 0;
        const wastage = mat.wastage_qty || 0;
        const existingReturn = mat.return_qty || 0;
        const totalReturn = existingReturn + returnQty;
        const remaining = issued - consumed - wastage - totalReturn;
        result[mat.id] = {
          valid: remaining >= 0 && returnQty <= issued,
          remaining: Math.max(0, remaining)
        };
      }
    }
    return result;
  }, [materials, returnQuantities]);

  const statusColors: Record<string, string> = {
    draft: 'bg-zinc-100 text-zinc-600',
    issued: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-yellow-100 text-yellow-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-600'
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-zinc-200 rounded w-1/4 mb-4" />
          <div className="h-64 bg-zinc-100 rounded" />
        </div>
      </div>
    );
  }

  if (!jobCard) {
    return (
      <div className="p-6">
        <div className="text-center text-zinc-500">Job card not found</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">{jobCard.job_card_no}</h1>
          <p className="text-zinc-500 mt-1">{jobCard.product_name}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => onNavigate('/manufacturing/job-cards')}
            className="h-10 px-5 border border-zinc-200 text-zinc-700 rounded-lg font-medium hover:bg-zinc-50 transition-colors"
          >
            Back to List
          </button>
          {jobCard.status === 'draft' && (
            <button
              onClick={() => issueMaterials.mutate()}
              disabled={issueMaterials.isPending}
              className="h-10 px-5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {issueMaterials.isPending ? 'Issuing...' : 'Issue Materials'}
            </button>
          )}
          {jobCard.status === 'issued' && (
            <button
              onClick={() => onNavigate(`/manufacturing/production/create?jobCard=${jobCardId}`)}
              className="h-10 px-5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
            >
              Record Production
            </button>
          )}
        </div>
      </div>

      {issueError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {issueError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-zinc-200 rounded-lg p-6">
            <h2 className="text-lg font-medium text-zinc-900 mb-4">Job Card Details</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-zinc-500">Status</div>
                <div className="mt-1">
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${statusColors[jobCard.status] || 'bg-zinc-100 text-zinc-600'}`}>
                    {jobCard.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-sm text-zinc-500">Planned Qty</div>
                <div className="mt-1 font-medium text-zinc-900">{jobCard.planned_qty} {jobCard.output_unit}</div>
              </div>
              <div>
                <div className="text-sm text-zinc-500">Actual Qty</div>
                <div className="mt-1 font-medium text-zinc-900">{jobCard.actual_qty || '-'} {jobCard.output_unit}</div>
              </div>
              <div>
                <div className="text-sm text-zinc-500">Yield</div>
                <div className="mt-1 font-medium text-zinc-900">{jobCard.yield_pct ? `${jobCard.yield_pct}%` : '-'}</div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-lg p-6">
            <h2 className="text-lg font-medium text-zinc-900 mb-4">Materials</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-200">
                    <th className="text-left px-4 py-3 text-sm font-medium text-zinc-500">Material</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-zinc-500">Planned</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-zinc-500">Issued</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-zinc-500">Consumed</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-zinc-500">Wastage</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-zinc-500">Return</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-zinc-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {materials?.map((mat) => (
                    <tr key={mat.id} className="border-b border-zinc-100">
                      <td className="px-4 py-4">
                        <div className="font-medium text-zinc-900">{mat.materials?.name}</div>
                        {stockByMaterial?.[mat.material_id] && stockByMaterial[mat.material_id].length > 0 && (
                          <div className="text-xs text-zinc-400 mt-0.5">
                            <span className={totalStockByMaterial[mat.material_id] >= mat.planned_qty ? 'text-green-600' : 'text-red-500'}>
                              Total: {totalStockByMaterial[mat.material_id]} {mat.materials?.unit}
                            </span>
                            <span className="mx-1">·</span>
                            {stockByMaterial[mat.material_id].map((s, i) => (
                              <span key={i} className="inline-flex items-center gap-0.5 mr-1">
                                <span className={`inline-block w-1.5 h-1.5 rounded-full ${s.current_stock > 0 ? 'bg-green-500' : 'bg-zinc-300'}`} />
                                {s.warehouse_name}: {s.current_stock}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 text-zinc-700">{mat.planned_qty} {mat.materials?.unit}</td>
                      <td className="px-4 py-4 text-zinc-700">{mat.issued_qty || '-'}</td>
                      <td className="px-4 py-4 text-zinc-700">{mat.consumed_qty || '-'}</td>
                      <td className="px-4 py-4 text-zinc-700">{mat.wastage_qty || '-'}</td>
                      <td className="px-4 py-4 text-zinc-700">{mat.return_qty || '-'}</td>
                      <td className="px-4 py-4">
                        <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-zinc-100 text-zinc-600">
                          {mat.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {productionEntries && productionEntries.length > 0 && (
            <div className="bg-white border border-zinc-200 rounded-lg p-6">
              <h2 className="text-lg font-medium text-zinc-900 mb-4">Production Entries</h2>
              <div className="space-y-3">
                {productionEntries.map((entry) => (
                  <div key={entry.id} className="border border-zinc-100 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-zinc-900">{entry.entry_no}</div>
                        <div className="text-sm text-zinc-500">{new Date(entry.created_at).toLocaleDateString()}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-zinc-900">{entry.actual_qty} {entry.output_unit}</div>
                        <div className="text-sm text-zinc-500">Yield: {entry.yield_pct}%</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white border border-zinc-200 rounded-lg p-6 sticky top-6">
            <h2 className="text-lg font-medium text-zinc-900 mb-4">Actions</h2>
            <div className="space-y-3">
              {jobCard.status === 'issued' && (
                <button
                  onClick={() => setShowReturnModal(true)}
                  className="w-full h-10 px-5 border border-zinc-200 text-zinc-700 rounded-lg font-medium hover:bg-zinc-50 transition-colors"
                >
                  Return Materials
                </button>
              )}
            </div>

            <div className="mt-6 p-4 bg-zinc-50 rounded-lg">
              <h3 className="text-sm font-medium text-zinc-700 mb-2">Status Flow</h3>
              <div className="text-xs text-zinc-500 space-y-1">
                <div>draft → issued → in_progress → completed</div>
                <div className="text-zinc-400">Materials can be returned at any stage</div>
              </div>
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

      {showReturnModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <h3 className="text-lg font-medium text-zinc-900 mb-4">Return Materials to Main Store</h3>

            {returnError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {returnError}
              </div>
            )}

            <div className="space-y-4">
              {materials?.filter(m => m.status === 'issued').map((mat) => {
                const validation = returnValidation[mat.id];
                const maxReturn = validation?.remaining ?? (mat.issued_qty || 0);
                return (
                  <div key={mat.id}>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">
                      {mat.materials?.name}
                    </label>
                    <input
                      type="number"
                      value={returnQuantities[mat.id] || ''}
                      onChange={(e) => setReturnQuantities({ ...returnQuantities, [mat.id]: Number(e.target.value) })}
                      placeholder="Qty to return"
                      max={mat.issued_qty}
                      className="w-full h-10 px-4 border border-zinc-200 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                    <div className="flex justify-between text-xs text-zinc-500 mt-1">
                      <span>Issued: {mat.issued_qty} {mat.materials?.unit}</span>
                      <span>Max return: {maxReturn} {mat.materials?.unit}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowReturnModal(false); setReturnError(null); }}
                className="flex-1 h-10 px-5 border border-zinc-200 text-zinc-700 rounded-lg font-medium hover:bg-zinc-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReturn.mutate()}
                disabled={handleReturn.isPending}
                className="flex-1 h-10 px-5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {handleReturn.isPending ? 'Returning...' : 'Return'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
