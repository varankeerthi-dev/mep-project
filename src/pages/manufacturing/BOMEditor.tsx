import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useCombinedUnits } from '../../hooks/useCombinedUnits';

type BOMEditorProps = {
  onSuccess: () => void;
  onCancel: () => void;
};

type BOMItem = {
  material_id: string;
  material_name: string;
  required_qty: number;
  unit: string;
  wastage_pct: number;
  notes: string;
  company_variant_id?: string;
  variant_name?: string;
  make?: string;
  lead_time_days: number;
  bom_level: number;
};

export default function BOMEditor({ onSuccess, onCancel }: BOMEditorProps) {
  const { organisation, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const bomId = searchParams.get('id');

  const [formData, setFormData] = useState({
    bom_code: '',
    product_name: '',
    product_id: '',
    output_qty: 1,
    output_unit: 'nos',
    description: '',
    is_active: true,
    batch_no: '',
    approval_status: 'draft'
  });

  const [items, setItems] = useState<BOMItem[]>([
    { material_id: '', material_name: '', required_qty: 0, unit: 'kg', wastage_pct: 5, notes: '', lead_time_days: 0, bom_level: 0 }
  ]);
  const [materialSearchText, setMaterialSearchText] = useState<Record<number, string>>({});
  const [openDropdownIndex, setOpenDropdownIndex] = useState<number>(-1);
  const [productSearchText, setProductSearchText] = useState('');
  const [openProductDropdown, setOpenProductDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const productDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.material-dropdown-container')) {
        setOpenDropdownIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { data: materials } = useQuery({
    queryKey: ['materials-for-bom', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase
        .from('materials')
        .select('id, name, unit, make, uses_variant')
        .eq('organisation_id', organisation.id)
        .eq('item_classification', 'raw_material')
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id
  });

  const { data: variantPricing } = useQuery({
    queryKey: ['bom-variant-pricing', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data: mats } = await supabase
        .from('materials')
        .select('id')
        .eq('organisation_id', organisation.id)
        .eq('item_classification', 'raw_material');
      const ids = (mats || []).map(m => m.id);
      if (!ids.length) return [];
      const { data, error } = await supabase
        .from('item_variant_pricing')
        .select('item_id, company_variant_id')
        .in('item_id', ids);
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id
  });

  const { data: companyVariants } = useQuery({
    queryKey: ['company-variants-bom', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase
        .from('company_variants')
        .select('id, variant_name')
        .eq('organisation_id', organisation.id)
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id
  });

  const getVariantsForMaterial = (materialId: string) =>
    (variantPricing || []).filter(v => v.item_id === materialId);

  const getVariantName = (variantId: string) =>
    companyVariants?.find(v => v.id === variantId)?.variant_name || variantId;

  const { data: finishedGoods } = useQuery({
    queryKey: ['finished-goods', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase
        .from('materials')
        .select('id, name, item_code')
        .eq('organisation_id', organisation.id)
        .eq('item_classification', 'finished_good')
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id
  });

  useEffect(() => {
    const handleClickOutsideProduct = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.product-dropdown-container')) {
        setOpenProductDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutsideProduct);
    return () => document.removeEventListener('mousedown', handleClickOutsideProduct);
  }, []);

  const handleProductSelect = (materialId: string) => {
    const material = finishedGoods?.find(m => m.id === materialId);
    if (!material) return;
    setFormData(prev => ({ ...prev, product_id: materialId, product_name: material.name }));
    setProductSearchText('');
    setOpenProductDropdown(false);
  };

  useEffect(() => {
    if (!bomId) return;
    const load = async () => {
      const { data: bom } = await supabase.from('bom_headers').select('*').eq('id', bomId).single();
      if (!bom) return;
      setFormData({
        bom_code: bom.bom_code,
        product_name: bom.product_name,
        product_id: bom.product_id || '',
        output_qty: bom.output_qty,
        output_unit: bom.output_unit,
        description: bom.description || '',
        is_active: bom.is_active,
        batch_no: bom.batch_no || '',
        approval_status: bom.approval_status || 'draft'
      });
      const { data: bomItems } = await supabase.from('bom_items').select('*, materials(name)').eq('bom_id', bomId);
      if (bomItems?.length) {
        setItems(bomItems.map((item: any) => ({
          material_id: item.material_id,
          material_name: item.materials?.name || '',
          required_qty: item.required_qty,
          unit: item.unit,
          wastage_pct: item.wastage_pct || 5,
          company_variant_id: item.company_variant_id || '',
          variant_name: '',
          make: item.make || '',
          notes: item.notes || '',
          lead_time_days: item.lead_time_days || 0,
          bom_level: item.bom_level || 0
        })));
      }
    };
    load();
  }, [bomId]);

  const generateBomCode = async () => {
    try {
      const { data, error } = await supabase.rpc('generate_bom_code', { org_id: organisation?.id });
      if (error || !data) throw error;
      return data as string;
    } catch {
      const { data } = await supabase
        .from('bom_headers')
        .select('bom_code')
        .eq('organisation_id', organisation?.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const last = data?.bom_code;
      const next = last ? parseInt(last.replace('BOM-', '')) + 1 : 1;
      return `BOM-${String(next).padStart(4, '0')}`;
    }
  };

  const saveBOM = useMutation({
    mutationFn: async () => {
      if (!organisation?.id || !user?.id) throw new Error('Not authenticated');
      const bomCode = formData.bom_code || await generateBomCode();
      const headerData = {
        bom_code: bomCode,
        product_name: formData.product_name,
        product_id: formData.product_id || null,
        output_qty: formData.output_qty,
        output_unit: formData.output_unit,
        description: formData.description,
        is_active: formData.is_active,
        batch_no: formData.batch_no || null,
        approval_status: formData.approval_status || 'draft',
        organisation_id: organisation.id
      };
      const headerResult = bomId
        ? await supabase.from('bom_headers').update(headerData).eq('id', bomId).select().single()
        : await supabase.from('bom_headers').insert(headerData).select().single();
      if (headerResult.error) throw headerResult.error;
      const savedBom = headerResult.data;
      if (bomId) await supabase.from('bom_items').delete().eq('bom_id', bomId);
      const payload = items
        .filter(item => item.material_id && item.required_qty > 0)
        .map(item => ({
          bom_id: savedBom.id,
          material_id: item.material_id,
          required_qty: item.required_qty,
          unit: item.unit,
          wastage_pct: item.wastage_pct,
          company_variant_id: item.company_variant_id || null,
          make: item.make || null,
          notes: item.notes,
          lead_time_days: item.lead_time_days || 0,
          bom_level: item.bom_level || 0
        }));
      if (payload.length) {
        const { error } = await supabase.from('bom_items').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boms'] });
      onSuccess();
    }
  });

  const addItem = () => {
    const newIndex = items.length;
    setItems(prev => [...prev, { material_id: '', material_name: '', required_qty: 0, unit: 'kg', wastage_pct: 5, notes: '', company_variant_id: '', variant_name: '', make: '', lead_time_days: 0, bom_level: 0 }]);
    setMaterialSearchText(prev => ({ ...prev, [newIndex]: '' }));
    setOpenDropdownIndex(newIndex);
  };
  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== index));
    setMaterialSearchText(prev => {
      const next: Record<number, string> = {};
      Object.entries(prev).forEach(([k, v]) => {
        const ki = parseInt(k);
        if (ki < index) next[ki] = v;
        else if (ki > index) next[ki - 1] = v;
      });
      return next;
    });
    setOpenDropdownIndex(-1);
  };
  const updateItem = (index: number, field: keyof BOMItem, value: any) => {
    setItems(prev => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const handleMaterialSelect = (index: number, materialId: string) => {
    const material = materials?.find(m => m.id === materialId);
    updateItem(index, 'material_id', materialId);
    updateItem(index, 'material_name', material?.name || '');
    updateItem(index, 'unit', material?.unit || 'kg');
    updateItem(index, 'make', material?.make || '');
    updateItem(index, 'company_variant_id', '');
    updateItem(index, 'variant_name', '');
  };

  // ─── CreateQuotation-style layout constants ───
  const sectionHeaderStyle: React.CSSProperties = { fontWeight: 600, fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' };
  const headerFieldStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px' };
  const labelColStyle: React.CSSProperties = { minWidth: '90px', maxWidth: '90px', fontWeight: 600, fontSize: '11px', color: '#374151' };
  const fieldColStyle: React.CSSProperties = { flex: 1 };
  const inputStyle: React.CSSProperties = { padding: '4px 8px', fontSize: '12px', width: '100%', height: '28px', border: '1px solid #d1d5db', borderRadius: '4px', background: '#fff', color: '#111827', outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s' };

  const cellInputStyle: React.CSSProperties = { ...inputStyle, border: '1px solid transparent', background: 'transparent', transition: 'border-color 0.15s, box-shadow 0.15s, background 0.15s' };

  const cellStyle: React.CSSProperties = { padding: '4px 6px', borderRadius: '4px', transition: 'background 0.15s, box-shadow 0.15s', cursor: 'default' };

  const handleCellHover = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.background = '#f0f7ff';
  };
  const handleCellLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.background = 'transparent';
  };

  const renderHeaderField = (label: string, field: React.ReactNode, isLast = false) => (
    <div style={{ ...headerFieldStyle, marginBottom: isLast ? 0 : '10px', padding: '4px 6px', borderRadius: '4px', transition: 'background 0.15s' }}
      onMouseEnter={e => e.currentTarget.style.background = '#f0f7ff'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      <span style={labelColStyle}>{label}</span>
      <div style={fieldColStyle}>{field}</div>
    </div>
  );

  const { data: combinedUnits = [] } = useCombinedUnits();
  const fallbackUnits = [{ value: 'kg', label: 'Kg' }, { value: 'mtr', label: 'Mtr' }, { value: 'nos', label: 'Nos' }, { value: 'ft', label: 'Ft' }, { value: 'sqm', label: 'Sqm' }, { value: 'cum', label: 'Cum' }, { value: 'ltr', label: 'Ltr' }, { value: 'pcs', label: 'Pcs' }];
  const unitOptions = combinedUnits.length > 0 ? combinedUnits : fallbackUnits;
  const brandOptions = [...new Set((materials || []).map(m => m.make).filter(Boolean))].sort();

  return (
    <div style={{ minHeight: '100%', background: '#fafafa' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={onCancel} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: '#6b7280', fontSize: '12px', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px' }}
            onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}>
            <ArrowLeft size={14} /> Back
          </button>
          <div style={{ width: '1px', height: '20px', background: '#e5e7eb' }} />
          <h1 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>{bomId ? 'Edit BOM' : 'Create BOM'}</h1>
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>Define raw materials for a finished product</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={onCancel} style={{ padding: '6px 14px', border: '1px solid #d1d5db', background: '#fff', color: '#374151', borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.borderColor = '#9ca3af'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#d1d5db'; }}
            onMouseDown={e => { e.currentTarget.style.background = '#e5e7eb'; }}
            onMouseUp={e => { e.currentTarget.style.background = '#f3f4f6'; }}>Cancel</button>
          <button onClick={() => saveBOM.mutate()} disabled={!formData.product_name || saveBOM.isPending}
            style={{ padding: '6px 14px', background: '#185FA5', border: '1px solid #185FA5', color: '#fff', borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: saveBOM.isPending ? 'not-allowed' : 'pointer', opacity: saveBOM.isPending ? 0.7 : 1, transition: 'all 0.15s' }}
            onMouseEnter={e => { if (!saveBOM.isPending) { e.currentTarget.style.background = '#0C447C'; e.currentTarget.style.borderColor = '#0C447C'; }}}
            onMouseLeave={e => { if (!saveBOM.isPending) { e.currentTarget.style.background = '#185FA5'; e.currentTarget.style.borderColor = '#185FA5'; }}}
            onMouseDown={e => { if (!saveBOM.isPending) { e.currentTarget.style.transform = 'scale(0.98)'; }}}
            onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}>
            {saveBOM.isPending ? 'Saving...' : 'Save BOM'}
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '20px 24px', maxWidth: '960px' }}>

        {/* ─── Document Details (matching CreateQuotation pattern) ─── */}
        <div style={{ background: '#f8f9fa', padding: '12px', marginBottom: '16px', borderRadius: '6px', border: '1px solid #e5e7eb', transition: 'border-color 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.borderColor = '#93c5fd'}
          onMouseLeave={e => e.currentTarget.style.borderColor = '#e5e7eb'}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px' }}>

            {/* Column 1: BOM Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={sectionHeaderStyle}>BOM Details</div>
              {renderHeaderField('BOM Code:', <input type="text" style={inputStyle} value={formData.bom_code} onChange={(e) => setFormData({ ...formData, bom_code: e.target.value })} placeholder="Auto-generated if empty" />)}
              {renderHeaderField('Product:', (
                <div className="product-dropdown-container" style={{ position: 'relative', width: '100%' }}>
                  <input type="text" style={inputStyle} value={openProductDropdown ? productSearchText : formData.product_name}
                    onChange={(e) => { setProductSearchText(e.target.value); setOpenProductDropdown(true); }}
                    onFocus={() => setOpenProductDropdown(true)}
                    placeholder="Search finished good..." />
                  {openProductDropdown && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'white', border: '1px solid #d1d5db', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', maxHeight: '200px', overflowY: 'auto' }}>
                      {(finishedGoods || [])
                        .filter(m => {
                          const q = productSearchText.toLowerCase();
                          return !q || m.name.toLowerCase().includes(q) || (m.item_code || '').toLowerCase().includes(q);
                        })
                        .map(m => (
                          <div key={m.id} style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '12px', borderBottom: '1px solid #f3f4f6' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                            onMouseLeave={e => e.currentTarget.style.background = 'white'}
                            onClick={() => handleProductSelect(m.id)}
                          >
                            <div style={{ fontWeight: 500 }}>{m.name}</div>
                            {m.item_code && <div style={{ fontSize: '10px', color: '#9ca3af' }}>{m.item_code}</div>}
                          </div>
                        ))}
                      {(finishedGoods || []).filter(m => {
                        const q = productSearchText.toLowerCase();
                        return !q || m.name.toLowerCase().includes(q) || (m.item_code || '').toLowerCase().includes(q);
                      }).length === 0 && (
                        <div style={{ padding: '6px 12px', fontSize: '11px', color: '#9ca3af', fontStyle: 'italic', textAlign: 'center' }}>No finished goods found</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {renderHeaderField('Output:', (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input type="number" style={{ ...inputStyle, width: '60px' }} value={formData.output_qty} onChange={(e) => setFormData({ ...formData, output_qty: Number(e.target.value) })} />
                  <select style={{ ...inputStyle, width: '70px' }} value={formData.output_unit} onChange={(e) => setFormData({ ...formData, output_unit: e.target.value })}>
                    {unitOptions.map(u => <option key={u.value} value={u.value}>{u.value}</option>)}
                  </select>
                </div>
              ))}
              {renderHeaderField('Batch No:', <input type="text" style={inputStyle} value={formData.batch_no} onChange={(e) => setFormData({ ...formData, batch_no: e.target.value })} placeholder="Optional batch/lot identifier" />, true)}
            </div>

            {/* Column 2: Status & Description */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={sectionHeaderStyle}>Options</div>
              {renderHeaderField('Status:', (
                <button onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                  style={{ padding: '3px 10px', borderRadius: '10px', border: 'none', fontSize: '11px', fontWeight: 600, cursor: 'pointer', background: formData.is_active ? '#dcfce7' : '#f3f4f6', color: formData.is_active ? '#166534' : '#6b7280', transition: 'all 0.2s' }}>
                  {formData.is_active ? 'Active' : 'Inactive'}
                </button>
              ))}
              {renderHeaderField('Approval:', (
                <select style={{ ...inputStyle, width: '140px' }} value={formData.approval_status} onChange={(e) => setFormData({ ...formData, approval_status: e.target.value })}>
                  <option value="draft">Draft</option>
                  <option value="pending_approval">Pending Approval</option>
                  <option value="approved">Approved</option>
                  <option value="obsolete">Obsolete</option>
                </select>
              ))}
              {renderHeaderField('Description:', <textarea style={{ ...inputStyle, height: '56px', resize: 'vertical', padding: '6px 8px' }} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Optional product description" />, true)}
            </div>
          </div>
        </div>

        {/* ─── Raw Materials Table ─── */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={sectionHeaderStyle}>Raw Materials</div>
            <span style={{ fontSize: '11px', color: '#9ca3af' }}>{items.filter(i => i.material_id).length} material{items.filter(i => i.material_id).length !== 1 ? 's' : ''}</span>
          </div>

          {/* Table Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 40px 60px 100px 80px 60px 60px 60px 1fr 24px', gap: '0', padding: '6px 12px', background: '#fafafa', borderBottom: '1px solid #e5e7eb', fontSize: '10px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <span>Material</span>
            <span style={{ textAlign: 'center' }}>Level</span>
            <span style={{ textAlign: 'right' }}>Qty</span>
            <span>Variant</span>
            <span>Brand</span>
            <span>Unit</span>
            <span style={{ textAlign: 'right' }}>Waste%</span>
            <span style={{ textAlign: 'right' }}>Lead Time</span>
            <span>Notes</span>
            <span></span>
          </div>

          {/* Table Rows */}
          {items.map((item, index) => (
            <div key={index} style={{ display: 'grid', gridTemplateColumns: '1.5fr 40px 60px 100px 80px 60px 60px 60px 1fr 24px', gap: '2px', padding: '6px 10px', borderBottom: index < items.length - 1 ? '1px solid #f3f4f6' : 'none', alignItems: 'center', background: index % 2 === 0 ? '#fff' : '#fafafa' }}>
              <div style={cellStyle} onMouseEnter={handleCellHover} onMouseLeave={handleCellLeave}>
                <div className="material-dropdown-container" style={{ position: 'relative', width: '100%' }}>
                  <input
                    type="text"
                    value={openDropdownIndex === index ? (materialSearchText[index] ?? '') : (item.material_name || '')}
                    onChange={(e) => {
                      setMaterialSearchText(prev => ({ ...prev, [index]: e.target.value }));
                      setOpenDropdownIndex(index);
                    }}
                    onFocus={() => setOpenDropdownIndex(index)}
                    placeholder="Search material..."
                    style={cellInputStyle}
                  />
                  {openDropdownIndex === index && materials && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'white', border: '1px solid #d1d5db', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', maxHeight: '200px', overflowY: 'auto' }}>
                      {(materials || [])
                        .filter(m => {
                          const q = (materialSearchText[index] ?? '').toLowerCase();
                          return !q || m.name.toLowerCase().includes(q) || (m.make || '').toLowerCase().includes(q);
                        })
                        .map(m => (
                          <div key={m.id} style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '12px', borderBottom: '1px solid #f3f4f6' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                            onMouseLeave={e => e.currentTarget.style.background = 'white'}
                            onClick={() => {
                              handleMaterialSelect(index, m.id);
                              setMaterialSearchText(prev => ({ ...prev, [index]: '' }));
                              setOpenDropdownIndex(-1);
                            }}
                          >
                            <div style={{ fontWeight: 500 }}>{m.name}</div>
                            {m.make && <div style={{ fontSize: '10px', color: '#9ca3af' }}>{m.make}</div>}
                          </div>
                        ))}
                      {(materials || []).filter(m => {
                        const q = (materialSearchText[index] ?? '').toLowerCase();
                        return !q || m.name.toLowerCase().includes(q) || (m.make || '').toLowerCase().includes(q);
                      }).length === 0 && (
                        <div style={{ padding: '6px 12px', fontSize: '11px', color: '#9ca3af', fontStyle: 'italic', textAlign: 'center' }}>No materials found</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div style={cellStyle} onMouseEnter={handleCellHover} onMouseLeave={handleCellLeave}>
                <input type="number" min="0" value={item.bom_level} onChange={(e) => updateItem(index, 'bom_level', Math.max(0, parseInt(e.target.value) || 0))} style={{ ...cellInputStyle, textAlign: 'center' }} title="BOM hierarchy level (0 = direct material)" />
              </div>
              <div style={cellStyle} onMouseEnter={handleCellHover} onMouseLeave={handleCellLeave}>
                <input type="number" value={item.required_qty || ''} onChange={(e) => updateItem(index, 'required_qty', Number(e.target.value))} style={{ ...cellInputStyle, textAlign: 'right' }} />
              </div>
              <div style={cellStyle} onMouseEnter={handleCellHover} onMouseLeave={handleCellLeave}>
                {(() => {
                  const variants = getVariantsForMaterial(item.material_id);
                  if (!variants.length) return <span style={{ fontSize: '11px', color: '#9ca3af' }}>—</span>;
                  return (
                    <select value={item.company_variant_id || ''} onChange={(e) => {
                      const vId = e.target.value;
                      const vName = getVariantName(vId);
                      updateItem(index, 'company_variant_id', vId || '');
                      updateItem(index, 'variant_name', vName);
                    }} style={cellInputStyle}>
                      <option value="">No Variant</option>
                      {variants.map(v => (
                        <option key={v.company_variant_id} value={v.company_variant_id}>{getVariantName(v.company_variant_id)}</option>
                      ))}
                    </select>
                  );
                })()}
              </div>
              <div style={cellStyle} onMouseEnter={handleCellHover} onMouseLeave={handleCellLeave}>
                <select value={item.make || ''} onChange={(e) => updateItem(index, 'make', e.target.value)} style={cellInputStyle}>
                  <option value="">—</option>
                  {brandOptions.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div style={cellStyle} onMouseEnter={handleCellHover} onMouseLeave={handleCellLeave}>
                <select value={item.unit} onChange={(e) => updateItem(index, 'unit', e.target.value)} style={cellInputStyle}>
                  {unitOptions.map(u => <option key={u.value} value={u.value}>{u.value}</option>)}
                </select>
              </div>
              <div style={cellStyle} onMouseEnter={handleCellHover} onMouseLeave={handleCellLeave}>
                <input type="number" value={item.wastage_pct || ''} onChange={(e) => updateItem(index, 'wastage_pct', Number(e.target.value))} style={{ ...cellInputStyle, textAlign: 'right' }} />
              </div>
              <div style={cellStyle} onMouseEnter={handleCellHover} onMouseLeave={handleCellLeave}>
                <input type="number" min="0" value={item.lead_time_days} onChange={(e) => updateItem(index, 'lead_time_days', Math.max(0, parseInt(e.target.value) || 0))} style={{ ...cellInputStyle, textAlign: 'right' }} placeholder="Days" title="Procurement/manufacturing lead time in days" />
              </div>
              <div style={cellStyle} onMouseEnter={handleCellHover} onMouseLeave={handleCellLeave}>
                <input type="text" value={item.notes} onChange={(e) => updateItem(index, 'notes', e.target.value)} placeholder="—" style={cellInputStyle} />
              </div>
              <button onClick={() => removeItem(index)} disabled={items.length <= 1}
                style={{ width: '24px', height: '24px', border: 'none', background: 'transparent', color: '#9ca3af', cursor: items.length <= 1 ? 'not-allowed' : 'pointer', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: items.length <= 1 ? 0.3 : 1, transition: 'all 0.15s' }}
                onMouseEnter={e => { if (items.length > 1) { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#ef4444'; }}}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9ca3af'; }}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}

          {/* Add Row */}
          <div style={{ padding: '8px 12px', borderTop: '1px dashed #e5e7eb' }}>
            <button onClick={addItem} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: '#185FA5', fontSize: '12px', fontWeight: 500, cursor: 'pointer', padding: '4px 0' }}
              onMouseEnter={e => e.currentTarget.style.color = '#0C447C'}
              onMouseLeave={e => e.currentTarget.style.color = '#185FA5'}>
              <Plus size={13} /> Add Material
            </button>
          </div>
        </div>

        {/* ─── How it works ─── */}
        <div style={{ marginTop: '16px', background: '#f8f9fa', borderRadius: '6px', padding: '12px 14px' }}>
          <div style={sectionHeaderStyle}>How it works</div>
          <div style={{ fontSize: '11px', color: '#6b7280', lineHeight: '18px', marginTop: '4px' }}>
            <strong style={{ color: '#374151' }}>Output</strong> is your base unit — materials are defined per this quantity.{' '}
            <strong style={{ color: '#374151' }}>Wastage %</strong> is applied per material when creating job cards.{' '}
            Job cards <strong style={{ color: '#374151' }}>scale all quantities</strong> automatically based on planned production.
          </div>
        </div>
      </div>
    </div>
  );
}
