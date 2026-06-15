import { useState, useCallback, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Search, X } from 'lucide-react';
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

type Warehouse = { id: string; name: string; warehouse_code: string; is_default?: boolean };
type Material = { id: string; name: string; display_name?: string; unit: string; uses_variant?: boolean };

const emptyRow = (): AdjustmentRow => ({
  id: crypto.randomUUID(), material_id: '', material_name: '', variant_id: null,
  variant_name: '', make: '', warehouse_id: '', warehouse_name: '', current_qty: 0, new_qty: '', unit: '',
});

// ─── DESIGN.md tokens ───
const sectionHeaderStyle: React.CSSProperties = { fontWeight: 600, fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' };
const headerFieldStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px' };
const labelColStyle: React.CSSProperties = { minWidth: '80px', maxWidth: '80px', fontWeight: 600, fontSize: '11px', color: '#374151' };
const fieldColStyle: React.CSSProperties = { flex: 1 };
const inputStyle: React.CSSProperties = { padding: '4px 8px', fontSize: '12px', width: '100%', height: '28px', border: '1px solid #d1d5db', borderRadius: '4px', background: '#fff', color: '#111827', outline: 'none', fontFamily: 'Inter, system-ui, sans-serif' };
const cellInputStyle: React.CSSProperties = { ...inputStyle, border: '1px solid transparent', background: 'transparent' };

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
  const [materialSearchText, setMaterialSearchText] = useState<Record<string, string>>({});
  const [variantSearchText, setVariantSearchText] = useState<Record<string, string>>({});
  const [warehouseSearchText, setWarehouseSearchText] = useState<Record<string, string>>({});
  const [openMaterialIndex, setOpenMaterialIndex] = useState(-1);
  const [openVariantIndex, setOpenVariantIndex] = useState(-1);
  const [openMakeIndex, setOpenMakeIndex] = useState(-1);
  const [openWarehouseIndex, setOpenWarehouseIndex] = useState(-1);
  const [makeSearchText, setMakeSearchText] = useState<Record<string, string>>({});

  // Click-outside for modal
  useEffect(() => {
    if (!showItemModal) return;
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.item-modal')) setShowItemModal(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showItemModal]);

  // Click-outside for dropdowns
  useEffect(() => {
    if (openMaterialIndex === -1 && openVariantIndex === -1 && openMakeIndex === -1 && openWarehouseIndex === -1) return;
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.dropdown-container')) {
        setOpenMaterialIndex(-1);
        setOpenVariantIndex(-1);
        setOpenMakeIndex(-1);
        setOpenWarehouseIndex(-1);
      }
    };
    // Use click instead of mousedown to allow item onClick to fire first
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [openMaterialIndex, openVariantIndex, openMakeIndex, openWarehouseIndex]);

  const { data: warehouses = [] } = useQuery<Warehouse[]>({
    queryKey: ['warehouses-adjust', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data } = await supabase.from('warehouses').select('id, name, warehouse_code, is_default').eq('organisation_id', organisation.id).eq('is_active', true).order('name');
      return data || [];
    },
    enabled: !!organisation?.id,
  });

  const { data: materials = [] } = useQuery<Material[]>({
    queryKey: ['materials-for-adjust', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data } = await supabase.from('materials').select('id, name, display_name, unit, uses_variant').eq('organisation_id', organisation.id).eq('is_active', true).order('name');
      return data || [];
    },
    enabled: !!organisation?.id,
  });

  const { data: variants = [] } = useQuery<any[]>({
    queryKey: ['variants-for-adjust', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      try {
        const { data, error } = await supabase.from('item_variant_pricing').select('id, item_id, company_variant_id, make').eq('organisation_id', organisation.id);
        if (error) throw error;
        // Fetch variant names separately
        const cvIds = [...new Set((data || []).map(v => v.company_variant_id).filter(Boolean))];
        let cvMap: Record<string, string> = {};
        if (cvIds.length > 0) {
          const { data: cvs } = await supabase.from('company_variants').select('id, variant_name').in('id', cvIds);
          for (const cv of cvs || []) cvMap[cv.id] = cv.variant_name;
        }
        return (data || []).map(v => ({ ...v, variant_name: cvMap[v.company_variant_id] || '' }));
      } catch (e) {
        // Fallback: try without make column
        try {
          const { data } = await supabase.from('item_variant_pricing').select('id, item_id, company_variant_id').eq('organisation_id', organisation.id);
          return (data || []).map((v: any) => ({ ...v, make: '', variant_name: '' }));
        } catch {
          const { data } = await supabase.from('item_variant_pricing').select('id, item_id, company_variant_id');
          return (data || []).map((v: any) => ({ ...v, make: '', variant_name: '' }));
        }
      }
    },
    enabled: !!organisation?.id,
  });

  const { data: stockData = [] } = useQuery<any[]>({
    queryKey: ['stock-for-adjust', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase.from('item_stock').select('item_id, company_variant_id, warehouse_id, current_stock');
      if (error) {
        const { data: fb } = await supabase.from('item_stock').select('item_id, company_variant_id, warehouse_id, current_stock');
        return fb || [];
      }
      return data || [];
    },
    enabled: !!organisation?.id,
  });

  // Debug
  useEffect(() => { if (variants.length > 0) console.log('[StockAdj] variants:', variants.length, 'makes:', [...new Set(variants.map((v: any) => v.make).filter(Boolean))]); }, [variants]);

  const getCurrentStock = useCallback((row: AdjustmentRow): number => {
    return stockData
      .filter(s => s.item_id === row.material_id && s.warehouse_id === row.warehouse_id && (row.variant_id ? s.company_variant_id === row.variant_id : !s.company_variant_id))
      .reduce((sum, s) => sum + (s.current_stock || 0), 0);
  }, [stockData]);

  const handleWarehouseFilterChange = (whId: string) => {
    setWarehouseFilter(whId);
    const wh = warehouses.find(w => w.id === whId);
    setRows(prev => prev.map(r => ({ ...r, warehouse_id: whId, warehouse_name: wh?.name || '' })));
  };

  const updateRow = (id: string, updates: Partial<AdjustmentRow>) => {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, ...updates };
      if (updates.material_id && updates.material_id !== r.material_id) {
        const mat = materials.find(m => m.id === updates.material_id);
        updated.material_name = mat?.name || ''; updated.unit = mat?.unit || '';
        updated.variant_id = null; updated.variant_name = ''; updated.make = '';
      }
      if (updates.variant_id !== undefined && updates.variant_id !== r.variant_id) {
        const v = variants.find(v => v.company_variant_id === updates.variant_id && v.item_id === updated.material_id);
        updated.make = v?.make || ''; updated.variant_name = (v?.company_variant as any)?.variant_name || '';
      }
      if (updates.material_id || updates.variant_id !== undefined || updates.warehouse_id) {
        updated.current_qty = getCurrentStock(updated);
      }
      return updated;
    }));
  };

  const removeRow = (id: string) => {
    setRows(prev => prev.length > 1 ? prev.filter(r => r.id !== id) : prev);
    setOpenMaterialIndex(-1); setOpenVariantIndex(-1); setOpenMakeIndex(-1); setOpenWarehouseIndex(-1);
  };

  const addRow = () => {
    setRows(prev => [...prev, emptyRow()]);
    setOpenMaterialIndex(-1); setOpenVariantIndex(-1); setOpenMakeIndex(-1); setOpenWarehouseIndex(-1);
  };

  const handleMaterialSelect = (index: number, materialId: string) => {
    const mat = materials.find(m => m.id === materialId);
    if (mat) updateRow(rows[index].id, { material_id: materialId, material_name: mat.name, unit: mat.unit, variant_id: null, variant_name: '', make: '' });
    // Reset make search for this row
    setMakeSearchText(prev => ({ ...prev, [rows[index]?.id]: '' }));
  };

  const addMultipleItems = () => {
    const newRows: AdjustmentRow[] = [];
    const wh = warehouses.find(w => w.id === warehouseFilter) || warehouses.find(w => w.is_default);
    for (const matId of selectedItems) {
      const mat = materials.find(m => m.id === matId);
      if (!mat) continue;
      if (mat.uses_variant) {
        for (const v of variants.filter(v => v.item_id === matId)) {
          const vid = v.company_variant_id;
          const whId = warehouseFilter || wh?.id || '';
          newRows.push({ id: crypto.randomUUID(), material_id: matId, material_name: mat.name, variant_id: vid, variant_name: (v.company_variant as any)?.variant_name || '', make: '', warehouse_id: whId, warehouse_name: warehouses.find(w => w.id === whId)?.name || '', current_qty: getCurrentStock({ material_id: matId, variant_id: vid, warehouse_id: whId } as AdjustmentRow), new_qty: '', unit: mat.unit });
        }
      } else {
        const whId = warehouseFilter || wh?.id || '';
        newRows.push({ id: crypto.randomUUID(), material_id: matId, material_name: mat.name, variant_id: null, variant_name: '', make: '', warehouse_id: whId, warehouse_name: warehouses.find(w => w.id === whId)?.name || '', current_qty: getCurrentStock({ material_id: matId, variant_id: null, warehouse_id: whId } as AdjustmentRow), new_qty: '', unit: mat.unit });
      }
    }
    setRows(prev => [...prev.filter(r => r.material_id), ...newRows]);
    setShowItemModal(false); setSelectedItems(new Set()); setSearchTerm('');
  };

  const handleAdjust = async () => {
    const validRows = rows.filter(r => r.material_id && r.warehouse_id && r.new_qty !== '');
    if (validRows.length === 0) { toast.error('No valid rows to adjust'); return; }
    setIsSaving(true);
    try {
      for (const row of validRows) {
        const newQty = parseFloat(row.new_qty);
        if (isNaN(newQty)) continue;
        const existing = stockData.find(s => s.item_id === row.material_id && s.warehouse_id === row.warehouse_id && (row.variant_id ? s.company_variant_id === row.variant_id : !s.company_variant_id));
        if (existing) {
          await supabase.from('item_stock').update({ current_stock: newQty, updated_at: new Date().toISOString() }).eq('item_id', row.material_id).eq('warehouse_id', row.warehouse_id).match(row.variant_id ? { company_variant_id: row.variant_id } : { company_variant_id: null });
        } else {
          await supabase.from('item_stock').insert({ item_id: row.material_id, warehouse_id: row.warehouse_id, company_variant_id: row.variant_id || null, current_stock: newQty, organisation_id: organisation?.id });
        }
      }
      toast.success(`Stock adjusted for ${validRows.length} items`);
      queryClient.invalidateQueries({ queryKey: ['stock-for-adjust'] });
      setRows([emptyRow()]);
    } catch (err: any) { toast.error('Failed to adjust stock: ' + (err?.message || 'Unknown error')); }
    finally { setIsSaving(false); }
  };

  const filteredMaterials = useMemo(() => {
    if (!searchTerm) return materials;
    const q = searchTerm.toLowerCase();
    return materials.filter(m => m.name?.toLowerCase().includes(q) || m.display_name?.toLowerCase().includes(q));
  }, [materials, searchTerm]);

  const toggleItemSelection = (id: string) => {
    setSelectedItems(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const cellHoverHandlers = {
    onMouseEnter: (e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.background = '#f0f7ff'; },
    onMouseLeave: (e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.background = 'transparent'; },
  };

  const cellStyle: React.CSSProperties = { padding: '4px 6px', borderRadius: '4px', transition: 'background 0.15s' };

  return (
    <div style={{ minHeight: '100%', background: '#fafafa', fontFamily: 'Inter, system-ui, sans-serif', fontSize: '12px' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => navigate('/store/materials')} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: '#6b7280', fontSize: '12px', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', fontFamily: 'Inter, system-ui, sans-serif' }}
            onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
            <ArrowLeft size={14} /> Back
          </button>
          <div style={{ width: '1px', height: '20px', background: '#e5e7eb' }} />
          <h1 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>Stock Adjustment</h1>
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>Adjust inventory quantities across warehouses</span>
        </div>
        <button onClick={handleAdjust} disabled={isSaving}
          style={{ padding: '6px 14px', background: '#185FA5', border: '1px solid #185FA5', color: '#fff', borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: isSaving ? 'not-allowed' : 'pointer', opacity: isSaving ? 0.7 : 1, fontFamily: 'Inter, system-ui, sans-serif', transition: 'all 0.15s' }}
          onMouseEnter={e => { if (!isSaving) { e.currentTarget.style.background = '#0C447C'; }}}
          onMouseLeave={e => { if (!isSaving) { e.currentTarget.style.background = '#185FA5'; }}}>
          {isSaving ? 'Saving...' : 'Adjust Stock'}
        </button>
      </div>

      <div style={{ padding: '16px 24px', maxWidth: '960px' }}>

        {/* ─── Warehouse Filter (DESIGN.md document section pattern) ─── */}
        <div style={{ background: '#f8f9fa', padding: '10px', marginBottom: '14px', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
          <div style={sectionHeaderStyle}>Filter</div>
          <div style={{ ...headerFieldStyle }}>
            <span style={labelColStyle}>Warehouse:</span>
            <div style={fieldColStyle}>
              <select value={warehouseFilter} onChange={(e) => handleWarehouseFilterChange(e.target.value)} style={inputStyle}>
                <option value="">All Warehouses</option>
                {warehouses.map(wh => <option key={wh.id} value={wh.id}>{wh.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* ─── Adjustment Table ─── */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
          {/* Table Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 80px 1fr 80px 80px 80px 30px', gap: '0', padding: '6px 12px', background: '#fafafa', borderBottom: '1px solid #e5e7eb', fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            <span>Item</span><span>Discount Category</span><span>Make</span><span>Warehouse</span><span style={{ textAlign: 'right' }}>Current</span><span style={{ textAlign: 'right' }}>New Qty</span><span style={{ textAlign: 'right' }}>Diff</span><span></span>
          </div>

          {/* Table Rows */}
          {rows.map((row, index) => {
            const diff = row.new_qty ? parseFloat(row.new_qty) - row.current_qty : 0;
            const hasDiff = row.new_qty !== '' && !isNaN(diff);
            return (
              <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 80px 1fr 80px 80px 80px 30px', gap: '2px', padding: '6px 10px', borderBottom: index < rows.length - 1 ? '1px solid #f3f4f6' : 'none', alignItems: 'center', background: index % 2 === 0 ? '#fff' : '#fafafa' }}>
                {/* Item */}
                <div className="dropdown-container" style={{ ...cellStyle, position: 'relative' }} {...cellHoverHandlers}>
                  <input
                    type="text"
                    value={openMaterialIndex === index ? (materialSearchText[row.id] ?? '') : (row.material_name || '')}
                    onChange={(e) => { setMaterialSearchText(prev => ({ ...prev, [row.id]: e.target.value })); setOpenMaterialIndex(index); }}
                    onFocus={(e) => { e.stopPropagation(); setOpenMaterialIndex(index); }}
                    placeholder="Search item..."
                    style={cellInputStyle}
                  />
                  {openMaterialIndex === index && (
                    <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'white', border: '1px solid #d1d5db', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', maxHeight: '200px', overflowY: 'auto' }}>
                      {materials.filter(m => !(materialSearchText[row.id] || '') || m.name.toLowerCase().includes((materialSearchText[row.id] || '').toLowerCase())).map(m => (
                        <div key={m.id} style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '12px', borderBottom: '1px solid #f3f4f6' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                          onMouseLeave={e => e.currentTarget.style.background = 'white'}
                          onClick={(e) => { e.stopPropagation(); handleMaterialSelect(index, m.id); setMaterialSearchText(prev => ({ ...prev, [row.id]: '' })); setOpenMaterialIndex(-1); }}>
                          {m.name}
                        </div>
                      ))}
                      {materials.filter(m => !(materialSearchText[row.id] || '') || m.name.toLowerCase().includes((materialSearchText[row.id] || '').toLowerCase())).length === 0 && (
                        <div style={{ padding: '6px 12px', fontSize: '11px', color: '#9ca3af', fontStyle: 'italic', textAlign: 'center' }}>No items found</div>
                      )}
                    </div>
                  )}
                </div>
                {/* Variant */}
                <div className="dropdown-container" style={{ ...cellStyle, position: 'relative' }} {...cellHoverHandlers}>
                  <input
                    type="text"
                    value={openVariantIndex === index ? (variantSearchText[row.id] ?? '') : (row.variant_name || '—')}
                    onChange={(e) => { setVariantSearchText(prev => ({ ...prev, [row.id]: e.target.value })); setOpenVariantIndex(index); }}
                    onFocus={(e) => { e.stopPropagation(); if (row.material_id) setOpenVariantIndex(index); }}
                    disabled={!row.material_id}
                    placeholder="—"
                    style={{ ...cellInputStyle, opacity: row.material_id ? 1 : 0.5 }}
                  />
                  {openVariantIndex === index && row.material_id && (
                    <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'white', border: '1px solid #d1d5db', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', maxHeight: '200px', overflowY: 'auto' }}>
                      <div style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '12px', borderBottom: '1px solid #f3f4f6' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                        onMouseLeave={e => e.currentTarget.style.background = 'white'}
                        onClick={(e) => { e.stopPropagation(); updateRow(row.id, { variant_id: null, variant_name: '', make: '' }); setVariantSearchText(prev => ({ ...prev, [row.id]: '' })); setOpenVariantIndex(-1); }}>
                        —
                      </div>
                      {variants.filter(v => v.item_id === row.material_id && (!(variantSearchText[row.id] || '') || (v.variant_name || '').toLowerCase().includes((variantSearchText[row.id] || '').toLowerCase()))).map(v => (
                        <div key={v.company_variant_id || v.id} style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '12px', borderBottom: '1px solid #f3f4f6' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                          onMouseLeave={e => e.currentTarget.style.background = 'white'}
                          onClick={(e) => { e.stopPropagation(); updateRow(row.id, { variant_id: v.company_variant_id, variant_name: v.variant_name || '', make: v.make || row.make }); setVariantSearchText(prev => ({ ...prev, [row.id]: '' })); setOpenVariantIndex(-1); }}>
                          {v.variant_name || 'Category'}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* Make */}
                <div className="dropdown-container" style={{ ...cellStyle, position: 'relative' }} {...cellHoverHandlers}>
                  <input
                    type="text"
                    value={openMakeIndex === index ? (makeSearchText[row.id] ?? '') : (row.make || '')}
                    onChange={(e) => { setMakeSearchText(prev => ({ ...prev, [row.id]: e.target.value })); setOpenMakeIndex(index); }}
                    onFocus={(e) => { e.stopPropagation(); setOpenMakeIndex(index); }}
                    placeholder="—"
                    style={cellInputStyle}
                  />
                  {openMakeIndex === index && (
                    <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'white', border: '1px solid #d1d5db', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', maxHeight: '200px', overflowY: 'auto' }}>
                      {(() => {
                        const makes = [...new Set(variants.filter(v => v.item_id === row.material_id && v.make).map(v => v.make))];
                        const filtered = makes.filter(m => !(makeSearchText[row.id] || '') || m.toLowerCase().includes((makeSearchText[row.id] || '').toLowerCase()));
                        return <>
                          {filtered.map(make => (
                            <div key={make} style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '12px', borderBottom: '1px solid #f3f4f6' }}
                              onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                              onMouseLeave={e => e.currentTarget.style.background = 'white'}
                              onClick={(e) => { e.stopPropagation(); updateRow(row.id, { make }); setMakeSearchText(prev => ({ ...prev, [row.id]: '' })); setOpenMakeIndex(-1); }}>
                              {make}
                            </div>
                          ))}
                          {filtered.length === 0 && (
                            <div style={{ padding: '6px 12px', fontSize: '11px', color: '#9ca3af', fontStyle: 'italic', textAlign: 'center' }}>
                              {(makeSearchText[row.id] || '') ? 'No makes found' : 'No makes available'}
                            </div>
                          )}
                        </>;
                      })()}
                    </div>
                  )}
                </div>
                {/* Warehouse */}
                <div className="dropdown-container" style={{ ...cellStyle, position: 'relative' }} {...cellHoverHandlers}>
                  <input
                    type="text"
                    value={openWarehouseIndex === index ? (warehouseSearchText[row.id] ?? '') : (row.warehouse_name || '')}
                    onChange={(e) => { setWarehouseSearchText(prev => ({ ...prev, [row.id]: e.target.value })); setOpenWarehouseIndex(index); }}
                    onFocus={(e) => { e.stopPropagation(); setOpenWarehouseIndex(index); }}
                    placeholder="Select..."
                    style={cellInputStyle}
                  />
                  {openWarehouseIndex === index && (
                    <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'white', border: '1px solid #d1d5db', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', maxHeight: '200px', overflowY: 'auto' }}>
                      {warehouses.filter(w => !(warehouseSearchText[row.id] || '') || w.name.toLowerCase().includes((warehouseSearchText[row.id] || '').toLowerCase())).map(w => (
                        <div key={w.id} style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '12px', borderBottom: '1px solid #f3f4f6' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                          onMouseLeave={e => e.currentTarget.style.background = 'white'}
                          onClick={(e) => { e.stopPropagation(); updateRow(row.id, { warehouse_id: w.id, warehouse_name: w.name }); setWarehouseSearchText(prev => ({ ...prev, [row.id]: '' })); setOpenWarehouseIndex(-1); }}>
                          {w.name}
                        </div>
                      ))}
                      {warehouses.filter(w => !(warehouseSearchText[row.id] || '') || w.name.toLowerCase().includes((warehouseSearchText[row.id] || '').toLowerCase())).length === 0 && (
                        <div style={{ padding: '6px 12px', fontSize: '11px', color: '#9ca3af', fontStyle: 'italic', textAlign: 'center' }}>No warehouses found</div>
                      )}
                    </div>
                  )}
                </div>
                {/* Current */}
                <div style={{ ...cellStyle, textAlign: 'right', fontFamily: 'monospace', fontSize: '12px', color: '#6b7280' }}>
                  {row.current_qty} {row.unit}
                </div>
                {/* New Qty */}
                <div style={cellStyle} {...cellHoverHandlers}>
                  <input type="number" value={row.new_qty} onChange={(e) => updateRow(row.id, { new_qty: e.target.value })} placeholder="0" style={{ ...cellInputStyle, textAlign: 'right', fontFamily: 'monospace' }} />
                </div>
                {/* Diff */}
                <div style={{ ...cellStyle, textAlign: 'right', fontFamily: 'monospace', fontSize: '12px', fontWeight: 600, color: hasDiff ? (diff > 0 ? '#16a34a' : '#dc2626') : '#9ca3af' }}>
                  {hasDiff ? `${diff > 0 ? '+' : ''}${diff} ${row.unit}` : '—'}
                </div>
                {/* Remove */}
                <button onClick={() => removeRow(row.id)} style={{ width: '24px', height: '24px', border: 'none', background: 'transparent', color: '#9ca3af', cursor: 'pointer', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#ef4444'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9ca3af'; }}>
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}

          {/* Add Row */}
          <div style={{ padding: '8px 12px', borderTop: '1px dashed #e5e7eb', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={addRow} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: '#185FA5', fontSize: '12px', fontWeight: 500, cursor: 'pointer', padding: '4px 0', fontFamily: 'Inter, system-ui, sans-serif' }}
              onMouseEnter={e => e.currentTarget.style.color = '#0C447C'} onMouseLeave={e => e.currentTarget.style.color = '#185FA5'}>
              <Plus size={13} /> Add Row
            </button>
            <button onClick={() => setShowItemModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: '#185FA5', fontSize: '12px', fontWeight: 500, cursor: 'pointer', padding: '4px 0', fontFamily: 'Inter, system-ui, sans-serif' }}
              onMouseEnter={e => e.currentTarget.style.color = '#0C447C'} onMouseLeave={e => e.currentTarget.style.color = '#185FA5'}>
              <Plus size={13} /> Add Multiple Items
            </button>
          </div>
        </div>
      </div>

      {/* ─── Multi-Select Modal (DESIGN.md pattern) ─── */}
      {showItemModal && (
        <div className="item-modal" style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', width: '100%', maxWidth: '480px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>Select Items</span>
              <button onClick={() => setShowItemModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '4px', color: '#6b7280' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <X size={14} />
              </button>
            </div>
            {/* Search */}
            <div style={{ padding: '8px 16px', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ position: 'relative' }}>
                <Search size={13} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                <input type="text" placeholder="Search materials..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} autoFocus
                  style={{ ...inputStyle, paddingLeft: '28px', height: '30px' }} />
              </div>
            </div>
            {/* Items */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
              {filteredMaterials.map(mat => (
                <label key={mat.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '4px', cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <input type="checkbox" checked={selectedItems.has(mat.id)} onChange={() => toggleItemSelection(mat.id)} style={{ width: '14px', height: '14px', accentColor: '#4f46e5' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mat.name}</div>
                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>{mat.unit}{mat.uses_variant ? ' · has variants' : ''}</div>
                  </div>
                </label>
              ))}
            </div>
            {/* Footer */}
            <div style={{ padding: '10px 16px', borderTop: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>{selectedItems.size} selected</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => { setShowItemModal(false); setSelectedItems(new Set()); }}
                  style={{ padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff', color: '#374151', fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}>Cancel</button>
                <button onClick={addMultipleItems} disabled={selectedItems.size === 0}
                  style={{ padding: '6px 12px', border: 'none', borderRadius: '6px', background: '#4f46e5', color: '#fff', fontSize: '12px', fontWeight: 500, cursor: selectedItems.size === 0 ? 'not-allowed' : 'pointer', opacity: selectedItems.size === 0 ? 0.5 : 1, fontFamily: 'Inter, system-ui, sans-serif', transition: 'background 0.15s' }}
                  onMouseEnter={e => { if (selectedItems.size > 0) e.currentTarget.style.background = '#4338ca'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#4f46e5'; }}>
                  Add {selectedItems.size}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
