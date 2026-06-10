import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save, CheckCircle, Search, X, Package } from 'lucide-react';
import { toast } from 'sonner';

type AdjustmentRow = {
  id: string;
  material_id: string;
  material_name: string;
  variant_id: string | null;
  variant_name: string;
  make: string;
  warehouse_id: string;
  warehouse_name: string;
  current_qty: number;
  new_qty: string;
  unit: string;
};

type Warehouse = {
  id: string;
  name: string;
  warehouse_code: string;
  is_default?: boolean;
};

type Material = {
  id: string;
  name: string;
  display_name?: string;
  unit: string;
  uses_variant?: boolean;
};

const emptyRow = (): AdjustmentRow => ({
  id: crypto.randomUUID(),
  material_id: '',
  material_name: '',
  variant_id: null,
  variant_name: '',
  make: '',
  warehouse_id: '',
  warehouse_name: '',
  current_qty: 0,
  new_qty: '',
  unit: '',
});

export default function StockAdjustment() {
  const { organisation } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<AdjustmentRow[]>([emptyRow()]);
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [showItemModal, setShowItemModal] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Fetch warehouses
  const { data: warehouses = [] } = useQuery<Warehouse[]>({
    queryKey: ['warehouses-adjust', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data } = await supabase
        .from('warehouses')
        .select('id, name, warehouse_code, is_default')
        .eq('organisation_id', organisation.id)
        .eq('is_active', true)
        .order('name');
      return data || [];
    },
    enabled: !!organisation?.id,
  });

  // Fetch materials
  const { data: materials = [] } = useQuery<Material[]>({
    queryKey: ['materials-for-adjust', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data } = await supabase
        .from('materials')
        .select('id, name, display_name, unit, uses_variant')
        .eq('organisation_id', organisation.id)
        .eq('is_active', true)
        .order('name');
      return data || [];
    },
    enabled: !!organisation?.id,
  });

  // Fetch variants
  const { data: variants = [] } = useQuery<any[]>({
    queryKey: ['variants-for-adjust', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data } = await supabase
        .from('item_variant_pricing')
        .select('id, item_id, variant_id, make, company_variant:company_variants(id, variant_name)')
        .eq('organisation_id', organisation.id);
      return data || [];
    },
    enabled: !!organisation?.id,
  });

  // Fetch current stock for all materials
  const { data: stockData = [] } = useQuery<any[]>({
    queryKey: ['stock-for-adjust', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      let query = supabase
        .from('item_stock')
        .select('item_id, company_variant_id, warehouse_id, current_stock');
      const { data, error } = await query;
      if (error) {
        // Fallback without organisation_id
        const { data: fallback } = await supabase
          .from('item_stock')
          .select('item_id, company_variant_id, warehouse_id, current_stock');
        return fallback || [];
      }
      return data || [];
    },
    enabled: !!organisation?.id,
  });

  // Fetch company variants for names
  const { data: companyVariants = [] } = useQuery<any[]>({
    queryKey: ['company-variants-adjust', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data } = await supabase
        .from('company_variants')
        .select('id, variant_name');
      return data || [];
    },
    enabled: !!organisation?.id,
  });

  // Lookup current stock for a row
  const getCurrentStock = useCallback((row: AdjustmentRow): number => {
    const filtered = stockData.filter(s =>
      s.item_id === row.material_id &&
      s.warehouse_id === row.warehouse_id &&
      (row.variant_id ? s.company_variant_id === row.variant_id : !s.company_variant_id)
    );
    return filtered.reduce((sum, s) => sum + (s.current_stock || 0), 0);
  }, [stockData]);

  // Apply warehouse filter to all rows
  const handleWarehouseFilterChange = (whId: string) => {
    setWarehouseFilter(whId);
    const wh = warehouses.find(w => w.id === whId);
    setRows(prev => prev.map(r => ({
      ...r,
      warehouse_id: whId,
      warehouse_name: wh?.name || '',
    })));
  };

  // Update a row
  const updateRow = (id: string, updates: Partial<AdjustmentRow>) => {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, ...updates };
      // When material changes, reset variant/make and update unit
      if (updates.material_id && updates.material_id !== r.material_id) {
        const mat = materials.find(m => m.id === updates.material_id);
        updated.material_name = mat?.name || '';
        updated.unit = mat?.unit || '';
        updated.variant_id = null;
        updated.variant_name = '';
        updated.make = '';
      }
      // When variant changes, update make
      if (updates.variant_id !== undefined && updates.variant_id !== r.variant_id) {
        const v = variants.find(v => v.variant_id === updates.variant_id && v.item_id === updated.material_id);
        updated.make = v?.make || '';
        updated.variant_name = (v?.company_variant as any)?.variant_name || '';
      }
      // Fetch current stock when material/variant/warehouse changes
      if (updates.material_id || updates.variant_id !== undefined || updates.warehouse_id) {
        updated.current_qty = getCurrentStock(updated);
      }
      return updated;
    }));
  };

  // Remove a row
  const removeRow = (id: string) => {
    setRows(prev => prev.length > 1 ? prev.filter(r => r.id !== id) : prev);
  };

  // Add single row
  const addRow = () => setRows(prev => [...prev, emptyRow()]);

  // Add multiple items from modal
  const addMultipleItems = () => {
    const newRows: AdjustmentRow[] = [];
    const wh = warehouses.find(w => w.id === warehouseFilter) || warehouses.find(w => w.is_default);

    for (const matId of selectedItems) {
      const mat = materials.find(m => m.id === matId);
      if (!mat) continue;

      if (mat.uses_variant) {
        const matVariants = variants.filter(v => v.item_id === matId);
        for (const v of matVariants) {
          const vid = v.variant_id || v.id;
          const whId = warehouseFilter || wh?.id || '';
          const current = getCurrentStock({ material_id: matId, variant_id: vid, warehouse_id: whId } as AdjustmentRow);
          newRows.push({
            id: crypto.randomUUID(),
            material_id: matId,
            material_name: mat.name,
            variant_id: vid,
            variant_name: (v.company_variant as any)?.variant_name || '',
            make: v.make || '',
            warehouse_id: whId,
            warehouse_name: warehouses.find(w => w.id === whId)?.name || '',
            current_qty: current,
            new_qty: '',
            unit: mat.unit,
          });
        }
      } else {
        const whId = warehouseFilter || wh?.id || '';
        const current = getCurrentStock({ material_id: matId, variant_id: null, warehouse_id: whId } as AdjustmentRow);
        newRows.push({
          id: crypto.randomUUID(),
          material_id: matId,
          material_name: mat.name,
          variant_id: null,
          variant_name: '',
          make: '',
          warehouse_id: whId,
          warehouse_name: warehouses.find(w => w.id === whId)?.name || '',
          current_qty: current,
          new_qty: '',
          unit: mat.unit,
        });
      }
    }
    setRows(prev => [...prev.filter(r => r.material_id), ...newRows]);
    setShowItemModal(false);
    setSelectedItems(new Set());
    setSearchTerm('');
  };

  // Save/Adjust stock
  const handleAdjust = async () => {
    const validRows = rows.filter(r => r.material_id && r.warehouse_id && r.new_qty !== '');
    if (validRows.length === 0) {
      toast.error('No valid rows to adjust');
      return;
    }

    setIsSaving(true);
    try {
      for (const row of validRows) {
        const newQty = parseFloat(row.new_qty);
        if (isNaN(newQty)) continue;

        const existing = stockData.find(s =>
          s.item_id === row.material_id &&
          s.warehouse_id === row.warehouse_id &&
          (row.variant_id ? s.company_variant_id === row.variant_id : !s.company_variant_id)
        );

        if (existing) {
          await supabase
            .from('item_stock')
            .update({ current_stock: newQty, updated_at: new Date().toISOString() })
            .eq('item_id', row.material_id)
            .eq('warehouse_id', row.warehouse_id)
            .match(row.variant_id ? { company_variant_id: row.variant_id } : { company_variant_id: null });
        } else {
          await supabase
            .from('item_stock')
            .insert({
              item_id: row.material_id,
              warehouse_id: row.warehouse_id,
              company_variant_id: row.variant_id || null,
              current_stock: newQty,
              organisation_id: organisation?.id,
            });
        }
      }

      toast.success(`Stock adjusted for ${validRows.length} items`);
      queryClient.invalidateQueries({ queryKey: ['stock-for-adjust'] });
      setRows([emptyRow()]);
    } catch (err: any) {
      toast.error('Failed to adjust stock: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  // Filter materials for modal
  const filteredMaterials = useMemo(() => {
    if (!searchTerm) return materials;
    const q = searchTerm.toLowerCase();
    return materials.filter(m =>
      m.name?.toLowerCase().includes(q) ||
      m.display_name?.toLowerCase().includes(q)
    );
  }, [materials, searchTerm]);

  const toggleItemSelection = (id: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200 px-6 py-4">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/store/materials')}
              className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              <ArrowLeft size={16} />
              Back to Materials
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleAdjust}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              <CheckCircle size={16} />
              {isSaving ? 'Saving...' : 'Adjust Stock'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Title + Warehouse Filter */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 flex items-center gap-2">
              <Package size={20} />
              Stock Adjustment
            </h1>
            <p className="text-sm text-zinc-500 mt-1">Adjust inventory quantities across warehouses</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-zinc-600">Warehouse:</label>
            <select
              value={warehouseFilter}
              onChange={(e) => handleWarehouseFilterChange(e.target.value)}
              className="h-9 px-3 text-sm border border-zinc-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none min-w-[180px]"
            >
              <option value="">All Warehouses</option>
              {warehouses.map(wh => (
                <option key={wh.id} value={wh.id}>{wh.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Adjustment Table */}
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Item</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Variant</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Make</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Warehouse</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Current Qty</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">New Qty</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Difference</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const diff = row.new_qty ? parseFloat(row.new_qty) - row.current_qty : 0;
                const hasDiff = row.new_qty !== '' && !isNaN(diff);
                return (
                  <tr key={row.id} className="border-b border-zinc-100 hover:bg-zinc-50/50">
                    <td className="px-4 py-2">
                      <select
                        value={row.material_id}
                        onChange={(e) => updateRow(row.id, { material_id: e.target.value })}
                        className="w-full h-9 px-2 text-sm border border-zinc-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      >
                        <option value="">Select item...</option>
                        {materials.map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={row.variant_id || ''}
                        onChange={(e) => updateRow(row.id, { variant_id: e.target.value || null })}
                        disabled={!row.material_id}
                        className="w-full h-9 px-2 text-sm border border-zinc-200 rounded-lg bg-white disabled:bg-zinc-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                      >
                        <option value="">—</option>
                        {variants
                          .filter(v => v.item_id === row.material_id)
                          .map(v => (
                            <option key={v.variant_id || v.id} value={v.variant_id || v.id}>
                              {(v.company_variant as any)?.variant_name || 'Variant'}
                            </option>
                          ))}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={row.make}
                        onChange={(e) => updateRow(row.id, { make: e.target.value })}
                        placeholder="—"
                        className="w-full h-9 px-2 text-sm border border-zinc-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={row.warehouse_id}
                        onChange={(e) => updateRow(row.id, { warehouse_id: e.target.value, warehouse_name: warehouses.find(w => w.id === e.target.value)?.name || '' })}
                        className="w-full h-9 px-2 text-sm border border-zinc-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      >
                        <option value="">Select...</option>
                        {warehouses.map(wh => (
                          <option key={wh.id} value={wh.id}>{wh.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <span className="text-sm font-mono text-zinc-600">
                        {row.current_qty} {row.unit}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        value={row.new_qty}
                        onChange={(e) => updateRow(row.id, { new_qty: e.target.value })}
                        placeholder="0"
                        className="w-full h-9 px-2 text-sm text-right border border-zinc-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      {hasDiff && (
                        <span className={`text-sm font-mono font-medium ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-zinc-400'}`}>
                          {diff > 0 ? '+' : ''}{diff} {row.unit}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => removeRow(row.id)}
                        className="p-1 text-zinc-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Add Row / Add Multiple */}
          <div className="px-4 py-3 border-t border-zinc-100 bg-zinc-50 flex items-center gap-3">
            <button
              onClick={addRow}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            >
              <Plus size={14} />
              Add Row
            </button>
            <button
              onClick={() => setShowItemModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            >
              <Package size={14} />
              Add Multiple Items
            </button>
          </div>
        </div>
      </div>

      {/* Multi-Select Modal */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowItemModal(false)}>
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200">
              <h3 className="text-lg font-semibold text-zinc-900">Select Items</h3>
              <button onClick={() => setShowItemModal(false)} className="p-1 hover:bg-zinc-100 rounded-lg">
                <X size={18} />
              </button>
            </div>
            <div className="px-5 py-3 border-b border-zinc-100">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search materials..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-9 pl-8 pr-3 text-sm border border-zinc-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-2">
              {filteredMaterials.map(mat => (
                <label
                  key={mat.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedItems.has(mat.id)}
                    onChange={() => toggleItemSelection(mat.id)}
                    className="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-zinc-900 truncate">{mat.name}</div>
                    <div className="text-xs text-zinc-500">{mat.unit}{mat.uses_variant ? ' · has variants' : ''}</div>
                  </div>
                </label>
              ))}
            </div>
            <div className="px-5 py-4 border-t border-zinc-200 flex items-center justify-between">
              <span className="text-sm text-zinc-500">{selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setShowItemModal(false); setSelectedItems(new Set()); }}
                  className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={addMultipleItems}
                  disabled={selectedItems.size === 0}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition-colors"
                >
                  Add {selectedItems.size} Item{selectedItems.size !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
