import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, ChevronDown, ChevronRight, MoreHorizontal, FileSpreadsheet, Upload, Search, GripVertical, Box, Percent, BarChart3, Copy } from 'lucide-react';
import { useCombinedUnits } from '../../hooks/useCombinedUnits';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from '../../lib/logger';
import {
  useBomDetailQuery,
  useSaveBOMMutation,
  useDeleteBOMMutation,
  useRawMaterialsQuery,
  useItemVariantPricingQuery,
  useCompanyVariantsQuery,
  useFinishedGoodsQuery
} from '../../features/manufacturing';

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

const LEAD_TIME_UNITS = [
  { value: 'hours', label: 'Hours' },
  { value: 'days', label: 'Days' },
  { value: 'weeks', label: 'Weeks' },
];

export default function BOMEditor({ onSuccess, onCancel }: BOMEditorProps) {
  const { organisation, user } = useAuth();
  const navigate = useNavigate();
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
    { id: crypto.randomUUID(), material_id: '', material_name: '', required_qty: 0, unit: 'kg', wastage_pct: 5, notes: '', lead_time_days: 0, bom_level: 0, parent_material_id: null }
  ]);
  const [expandedRowIds, setExpandedRowIds] = useState<Record<string, boolean>>({});
  const [activeDetailRowId, setActiveDetailRowId] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [activeActionMenuRowId, setActiveActionMenuRowId] = useState<string | null>(null);

  const [materialSearchText, setMaterialSearchText] = useState<Record<number, string>>({});
  const [openDropdownIndex, setOpenDropdownIndex] = useState<number>(-1);
  const [productSearchText, setProductSearchText] = useState('');
  const [openProductDropdown, setOpenProductDropdown] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);

  const materialSearchRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.material-dropdown-container')) {
        setOpenDropdownIndex(-1);
      }
      if (!target.closest('.action-menu-container')) {
        setActiveActionMenuRowId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { data: materials } = useRawMaterialsQuery(organisation?.id);
  const { data: variantPricing } = useItemVariantPricingQuery(organisation?.id);
  const { data: companyVariants } = useCompanyVariantsQuery(organisation?.id);
  const { data: finishedGoods } = useFinishedGoodsQuery(organisation?.id);
  const { data: bomDetail } = useBomDetailQuery(bomId);

  const getVariantsForMaterial = (materialId: string) =>
    (variantPricing || []).filter(v => v.item_id === materialId);

  const getVariantName = (variantId: string) =>
    companyVariants?.find(v => v.id === variantId)?.variant_name || variantId;

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
    if (bomDetail) {
      setFormData({
        bom_code: bomDetail.header.bom_code,
        product_name: bomDetail.header.product_name,
        product_id: bomDetail.header.product_id || '',
        output_qty: bomDetail.header.output_qty,
        output_unit: bomDetail.header.output_unit,
        description: bomDetail.header.description || '',
        is_active: bomDetail.header.is_active,
        batch_no: bomDetail.header.batch_no || '',
        approval_status: bomDetail.header.approval_status || 'draft'
      });
      if (bomDetail.items?.length) {
        setItems(bomDetail.items.map((item: any) => ({
          id: item.id,
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
          bom_level: 0,
          parent_material_id: item.parent_material_id || null
        })));
      }
    }
  }, [bomDetail]);

  const saveBOM = useSaveBOMMutation(() => {
    onSuccess();
  });

  const deleteBOM = useDeleteBOMMutation(() => {
    onCancel();
  });

  const handleSave = () => {
    if (!organisation?.id || !user?.id) {
      toast.error('Not authenticated');
      return;
    }
    const headerData = {
      id: bomId || undefined,
      bom_code: formData.bom_code,
      product_name: formData.product_name,
      product_id: formData.product_id || '',
      output_qty: formData.output_qty,
      output_unit: formData.output_unit,
      description: formData.description,
      is_active: formData.is_active,
      batch_no: formData.batch_no || '',
      approval_status: formData.approval_status || 'draft',
      organisation_id: organisation.id
    };
    saveBOM.mutate({ header: headerData, items });
  };

  const addItem = useCallback(() => {
    const newId = crypto.randomUUID();
    setItems(prev => [...prev, {
      id: newId,
      material_id: '',
      material_name: '',
      required_qty: 0,
      unit: 'nos',
      wastage_pct: 5,
      notes: '',
      company_variant_id: '',
      variant_name: '',
      make: '',
      lead_time_days: 0,
      parent_material_id: null
    }]);
    setTimeout(() => {
      materialSearchRefs.current[newId]?.focus();
    }, 50);
  }, []);

  const addSubMaterial = (parentId: string) => {
    const parentItem = items.find(i => i.id === parentId);
    if (!parentItem) return;
    
    let depth = 0;
    let current = parentItem;
    while (current.parent_material_id) {
      const parent = items.find(i => i.id === current.parent_material_id);
      if (!parent || parent.id === current.id) break;
      depth++;
      current = parent;
    }
    
    if (depth >= 2) {
      toast.error('Nesting is limited to 3 levels (Sub-assemblies cannot contain further sub-assemblies).');
      return;
    }

    const newId = crypto.randomUUID();
    setItems(prev => [...prev, {
      id: newId,
      material_id: '',
      material_name: '',
      required_qty: 0,
      unit: 'nos',
      wastage_pct: 5,
      notes: '',
      company_variant_id: '',
      variant_name: '',
      make: '',
      lead_time_days: 0,
      parent_material_id: parentId
    }]);
    setExpandedRowIds(prev => ({ ...prev, [parentId]: true }));
    setTimeout(() => {
      materialSearchRefs.current[newId]?.focus();
    }, 50);
  };

  const duplicateItem = (itemId: string) => {
    const source = items.find(i => i.id === itemId);
    if (!source) return;
    const newId = crypto.randomUUID();
    setItems(prev => {
      const idx = prev.findIndex(i => i.id === itemId);
      const newItem = {
        ...source,
        id: newId,
        material_id: source.material_id,
        material_name: source.material_name,
        required_qty: source.required_qty,
        unit: source.unit,
        wastage_pct: source.wastage_pct,
        notes: source.notes,
        lead_time_days: source.lead_time_days,
        parent_material_id: source.parent_material_id,
      };
      const next = [...prev];
      next.splice(idx + 1, 0, newItem);
      return next;
    });
  };

  const removeItem = (itemId: string) => {
    if (items.length <= 1) return;
    
    const getChildIds = (id: string): string[] => {
      const children = items.filter(i => i.parent_material_id === id);
      return [id, ...children.flatMap(c => getChildIds(c.id!))];
    };
    
    const idsToDelete = getChildIds(itemId);
    setItems(prev => prev.filter(i => !idsToDelete.includes(i.id!)));
  };

  const updateItemById = (id: string, field: keyof BOMItem, value: any) => {
    setItems(prev => prev.map(item => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const handleMaterialSelect = (id: string, materialId: string) => {
    const material = materials?.find(m => m.id === materialId);
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          material_id: materialId,
          material_name: material?.name || '',
          unit: material?.unit || 'nos',
          make: material?.make || '',
          company_variant_id: '',
          variant_name: ''
        };
      }
      return item;
    }));
  };

  const { data: combinedUnits = [] } = useCombinedUnits();
  const fallbackUnits = [{ value: 'kg', label: 'Kg' }, { value: 'mtr', label: 'Mtr' }, { value: 'nos', label: 'Nos' }, { value: 'ft', label: 'Ft' }, { value: 'sqm', label: 'Sqm' }, { value: 'cum', label: 'Cum' }, { value: 'ltr', label: 'Ltr' }, { value: 'pcs', label: 'Pcs' }];
  const unitOptions = combinedUnits.length > 0 ? combinedUnits : fallbackUnits;
  const brandOptions = [...new Set((materials || []).map(m => m.make).filter(Boolean))].sort();

  const getFlattenedTree = () => {
    interface RenderableBOMItem extends BOMItem {
      depth: number;
      hasChildren: boolean;
      isExpanded: boolean;
    }
    const flattened: RenderableBOMItem[] = [];
    
    const buildNode = (item: BOMItem, depth: number) => {
      const children = items.filter(i => i.parent_material_id === item.id);
      const hasChildren = children.length > 0;
      const isExpanded = expandedRowIds[item.id!] ?? true;
      
      flattened.push({
        ...item,
        depth,
        hasChildren,
        isExpanded
      });
      
      if (hasChildren && isExpanded) {
        children.forEach(child => buildNode(child, depth + 1));
      }
    };
    
    const topLevel = items.filter(i => !i.parent_material_id);
    topLevel.forEach(item => buildNode(item, 0));
    
    return flattened;
  };

  const handleExcelImport = () => {
    if (!importText.trim()) return;
    const lines = importText.split('\n');
    const importedItems: BOMItem[] = [];
    
    lines.forEach(line => {
      if (!line.trim()) return;
      const parts = line.split('\t');
      const name = parts[0]?.trim();
      const qty = parseFloat(parts[1]?.trim() || '0') || 0;
      
      if (name) {
        const match = materials?.find(m => m.name.toLowerCase() === name.toLowerCase());
        importedItems.push({
          id: crypto.randomUUID(),
          material_id: match ? match.id : '',
          material_name: match ? match.name : name,
          required_qty: qty,
          unit: match?.unit || 'nos',
          wastage_pct: 5,
          notes: parts[2]?.trim() || '',
          make: match?.make || '',
          lead_time_days: 0,
          parent_material_id: null
        });
      }
    });
    
    if (importedItems.length > 0) {
      setItems(prev => {
        if (prev.length === 1 && !prev[0].material_id && prev[0].required_qty === 0) {
          return importedItems;
        }
        return [...prev, ...importedItems];
      });
      toast.success(`Successfully imported ${importedItems.length} materials.`);
    } else {
      toast.error('No valid materials parsed. Verify format: Name [tab] Qty');
    }
    
    setImportText('');
    setShowImportModal(false);
  };

  const materialCount = items.filter(i => i.material_id).length;

  const sectionHeaderStyle: React.CSSProperties = { fontWeight: 600, fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' };
  const headerFieldStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px' };
  const labelColStyle: React.CSSProperties = { minWidth: '90px', maxWidth: '90px', fontWeight: 600, fontSize: '11px', color: '#374151' };
  const fieldColStyle: React.CSSProperties = { flex: 1 };
  const inputStyle: React.CSSProperties = { padding: '4px 8px', fontSize: '12px', width: '100%', height: '28px', border: '1px solid #d1d5db', borderRadius: '4px', background: '#fff', color: '#111827', outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s' };

  const renderHeaderField = (label: string, field: React.ReactNode, isLast = false) => (
    <div style={{ ...headerFieldStyle, marginBottom: isLast ? 0 : '10px', padding: '4px 6px', borderRadius: '4px', transition: 'background 0.15s' }}
      onMouseEnter={e => e.currentTarget.style.background = '#f0f7ff'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      <span style={labelColStyle}>{label}</span>
      <div style={fieldColStyle}>{field}</div>
    </div>
  );

  return (
    <div style={{ minHeight: '100%', background: '#F8FAFC' }}>
      {/* ─── Top Navigation Bar ─── */}
      <div style={{
        background: '#fff',
        borderBottom: '1px solid #E5E7EB',
        padding: '12px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 40,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={onCancel} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'none', border: 'none', color: '#64748B',
            fontSize: '13px', fontWeight: 500, cursor: 'pointer',
            padding: '6px 10px', borderRadius: '8px', transition: 'all 0.15s'
          }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#0F172A'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#64748B'; }}>
            <ArrowLeft size={15} /> Back
          </button>
          <div style={{ width: '1px', height: '24px', background: '#E5E7EB' }} />
          <h1 style={{ fontSize: '15px', fontWeight: 600, color: '#0F172A', margin: 0 }}>
            {bomId ? 'Edit BOM' : 'Create BOM'}
          </h1>
          <span style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 400 }}>
            Define raw materials for a finished product
          </span>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {bomId && (
            <button onClick={() => setShowDeleteModal(true)} disabled={deleteBOM.isPending}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '7px 14px', border: '1px solid #E2E8F0', background: '#fff',
                color: '#475569', borderRadius: '8px', fontSize: '13px', fontWeight: 500,
                cursor: deleteBOM.isPending ? 'not-allowed' : 'pointer',
                opacity: deleteBOM.isPending ? 0.6 : 1, transition: 'all 0.15s'
              }}
              onMouseEnter={e => { if (!deleteBOM.isPending) { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.borderColor = '#CBD5E1'; }}}
              onMouseLeave={e => { if (!deleteBOM.isPending) { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#E2E8F0'; }}}>
              <Trash2 size={14} /> Delete
            </button>
          )}
          <button onClick={onCancel} style={{
            padding: '7px 16px', border: '1px solid #E2E8F0', background: '#fff',
            color: '#475569', borderRadius: '8px', fontSize: '13px', fontWeight: 500,
            cursor: 'pointer', transition: 'all 0.15s'
          }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.borderColor = '#CBD5E1'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#E2E8F0'; }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={!formData.product_name || saveBOM.isPending}
            style={{
              padding: '7px 20px', background: '#2563EB', border: '1px solid #2563EB',
              color: '#fff', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
              cursor: saveBOM.isPending ? 'not-allowed' : 'pointer',
              opacity: saveBOM.isPending ? 0.7 : 1, transition: 'all 0.15s',
              boxShadow: '0 1px 2px rgba(37,99,235,0.2)',
            }}
            onMouseEnter={e => { if (!saveBOM.isPending) { e.currentTarget.style.background = '#1D4ED8'; e.currentTarget.style.borderColor = '#1D4ED8'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(37,99,235,0.3)'; }}}
            onMouseLeave={e => { if (!saveBOM.isPending) { e.currentTarget.style.background = '#2563EB'; e.currentTarget.style.borderColor = '#2563EB'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(37,99,235,0.2)'; }}}>
            {saveBOM.isPending ? 'Saving...' : 'Save BOM'}
          </button>
        </div>
      </div>

      {/* ─── Body ─── */}
      <div style={{ padding: '28px 32px', maxWidth: '1040px', margin: '0 auto' }}>

        {/* ─── Document Details Card ─── */}
        <div style={{
          background: '#fff',
          padding: '20px 24px',
          marginBottom: '24px',
          borderRadius: '12px',
          border: '1px solid #E5E7EB',
          boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 28px' }}>
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
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'white', border: '1px solid #E2E8F0', borderRadius: '10px', boxShadow: '0 12px 36px rgba(15,23,42,0.12)', maxHeight: '220px', overflowY: 'auto', marginTop: '4px' }}>
                      {(finishedGoods || [])
                        .filter(m => {
                          const q = productSearchText.toLowerCase();
                          return !q || m.name.toLowerCase().includes(q) || (m.item_code || '').toLowerCase().includes(q);
                        })
                        .map(m => (
                          <div key={m.id} style={{ padding: '10px 14px', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid #F1F5F9', transition: 'background 0.1s' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#F0F7FF'}
                            onMouseLeave={e => e.currentTarget.style.background = 'white'}
                            onClick={() => handleProductSelect(m.id)}
                          >
                            <div style={{ fontWeight: 600, color: '#0F172A' }}>{m.name}</div>
                            {m.item_code && <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>{m.item_code}</div>}
                          </div>
                        ))}
                      {(finishedGoods || []).filter(m => {
                        const q = productSearchText.toLowerCase();
                        return !q || m.name.toLowerCase().includes(q) || (m.item_code || '').toLowerCase().includes(q);
                      }).length === 0 && (
                        <div style={{ padding: '12px', fontSize: '12px', color: '#94A3B8', fontStyle: 'italic', textAlign: 'center' }}>No finished goods found</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {renderHeaderField('Output:', (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input type="number" style={{ ...inputStyle, width: '64px' }} value={formData.output_qty} onChange={(e) => setFormData({ ...formData, output_qty: Number(e.target.value) })} />
                  <select style={{ ...inputStyle, width: '72px' }} value={formData.output_unit} onChange={(e) => setFormData({ ...formData, output_unit: e.target.value })}>
                    {unitOptions.map(u => <option key={u.value} value={u.value}>{u.value}</option>)}
                  </select>
                </div>
              ))}
              {renderHeaderField('Batch No:', <input type="text" style={inputStyle} value={formData.batch_no} onChange={(e) => setFormData({ ...formData, batch_no: e.target.value })} placeholder="Optional batch/lot identifier" />, true)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={sectionHeaderStyle}>Options</div>
              {renderHeaderField('Status:', (
                <button onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                  style={{
                    padding: '4px 14px', borderRadius: '999px', border: 'none', fontSize: '12px',
                    fontWeight: 600, cursor: 'pointer',
                    background: formData.is_active ? '#DCFCE7' : '#F1F5F9',
                    color: formData.is_active ? '#166534' : '#64748B',
                    transition: 'all 0.2s'
                  }}>
                  {formData.is_active ? 'Active' : 'Inactive'}
                </button>
              ))}
              {renderHeaderField('Approval:', (
                <select style={{ ...inputStyle, width: '150px' }} value={formData.approval_status} onChange={(e) => setFormData({ ...formData, approval_status: e.target.value })}>
                  <option value="draft">Draft</option>
                  <option value="pending_approval">Pending Approval</option>
                  <option value="approved">Approved</option>
                  <option value="obsolete">Obsolete</option>
                </select>
              ))}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            RAW MATERIALS — Premium Card
            ═══════════════════════════════════════════════════════════════ */}
        <div style={{
          background: '#fff',
          border: '1px solid #E5E7EB',
          borderRadius: '16px',
          boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
          overflow: 'hidden',
        }}>
          {/* ─── Card Header ─── */}
          <div style={{
            padding: '24px 28px 20px',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                  Raw Materials
                </h2>
                <span style={{
                  height: '28px',
                  padding: '0 12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  background: '#F1F5F9',
                  color: '#475569',
                  borderRadius: '999px',
                  fontSize: '12px',
                  fontWeight: 500,
                }}>
                  {materialCount} Material{materialCount !== 1 ? 's' : ''}
                </span>
              </div>
              <p style={{ fontSize: '13px', color: '#64748B', margin: '4px 0 0', fontWeight: 400 }}>
                Used to manufacture one finished product.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setShowImportModal(true)}
                style={{
                  height: '36px',
                  padding: '0 16px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#fff',
                  border: '1px solid #CBD5E1',
                  color: '#475569',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.borderColor = '#94A3B8'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#CBD5E1'; }}
              >
                <Upload size={15} /> Import BOQ
              </button>
              <button
                type="button"
                onClick={addItem}
                style={{
                  height: '36px',
                  padding: '0 16px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#2563EB',
                  border: '1px solid #2563EB',
                  color: '#fff',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  boxShadow: '0 1px 2px rgba(37,99,235,0.2)',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#1D4ED8'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(37,99,235,0.3)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#2563EB'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(37,99,235,0.2)'; }}
              >
                <Plus size={15} /> Add Material
              </button>
            </div>
          </div>

          {/* ─── Table ─── */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              tableLayout: 'fixed',
              minWidth: '860px',
            }}>
              <thead>
                <tr style={{ background: '#FAFBFC', borderBottom: '1px solid #F1F5F9' }}>
                  <th style={{ width: '44px', padding: '0 12px', height: '48px', textAlign: 'center' }}></th>
                  <th style={{ width: '280px', padding: '0 16px', height: '48px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Material
                  </th>
                  <th style={{ width: '150px', padding: '0 16px', height: '48px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Quantity
                  </th>
                  <th style={{ width: '100px', padding: '0 16px', height: '48px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Waste %
                  </th>
                  <th style={{ width: '130px', padding: '0 16px', height: '48px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Lead Time
                  </th>
                  <th style={{ width: '100px', padding: '0 16px', height: '48px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Details
                  </th>
                  <th style={{ width: '44px', padding: '0 8px', height: '48px' }}></th>
                </tr>
              </thead>
              <tbody>
                {getFlattenedTree().map((item, idx) => {
                  const depth = item.depth;
                  const isExpanded = item.isExpanded;
                  const hasChildren = item.hasChildren;
                  const isHovered = hoveredRowId === item.id;
                  const isMaterialSelected = !!item.material_id;
                  
                  return (
                    <tr
                      key={item.id}
                      onMouseEnter={() => setHoveredRowId(item.id!)}
                      onMouseLeave={() => setHoveredRowId(null)}
                      style={{
                        borderBottom: '1px solid #F1F5F9',
                        height: '72px',
                        transition: 'background 150ms ease',
                        background: isHovered ? '#F8FAFC' : 'transparent',
                        animation: `fadeInRow 200ms ease-out ${idx * 30}ms both`,
                      }}
                    >
                      {/* Drag Handle / Depth Indicator */}
                      <td style={{
                        padding: '0 8px',
                        textAlign: 'center',
                        verticalAlign: 'middle',
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '2px',
                        }}>
                          {depth > 0 && (
                            <span style={{
                              display: 'inline-block',
                              width: `${depth * 12}px`,
                            }} />
                          )}
                          <GripVertical size={14} style={{ color: '#CBD5E1', opacity: isHovered ? 1 : 0.4, transition: 'opacity 0.15s' }} />
                        </div>
                      </td>

                      {/* Material Cell */}
                      <td style={{ padding: '0 16px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {/* Collapse/Expand Chevron */}
                          {hasChildren ? (
                            <button
                              type="button"
                              onClick={() => setExpandedRowIds(prev => ({ ...prev, [item.id!]: !isExpanded }))}
                              style={{
                                width: '24px', height: '24px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: 'none', border: 'none',
                                color: '#94A3B8', cursor: 'pointer',
                                borderRadius: '6px', transition: 'all 0.15s',
                                flexShrink: 0,
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#475569'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#94A3B8'; }}
                            >
                              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                          ) : (
                            <div style={{ width: '24px', flexShrink: 0 }} />
                          )}

                          {/* Material Icon + Search */}
                          <div className="material-dropdown-container" style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {/* Icon Container */}
                            {isMaterialSelected ? (
                              <div style={{
                                width: '40px', height: '40px', borderRadius: '10px',
                                background: '#EFF6FF',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0,
                              }}>
                                <Box size={18} style={{ color: '#2563EB' }} />
                              </div>
                            ) : (
                              <div style={{
                                width: '40px', height: '40px', borderRadius: '10px',
                                background: '#F8FAFC',
                                border: '1px dashed #E2E8F0',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0,
                              }}>
                                <Search size={16} style={{ color: '#CBD5E1' }} />
                              </div>
                            )}

                            {/* Search / Name Display */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <input
                                ref={el => { materialSearchRefs.current[item.id!] = el; }}
                                type="text"
                                value={openDropdownIndex === items.findIndex(i => i.id === item.id) ? (materialSearchText[items.findIndex(i => i.id === item.id)] ?? '') : (item.material_name || '')}
                                onChange={(e) => {
                                  const idx = items.findIndex(i => i.id === item.id);
                                  setMaterialSearchText(prev => ({ ...prev, [idx]: e.target.value }));
                                  setOpenDropdownIndex(idx);
                                }}
                                onFocus={() => setOpenDropdownIndex(items.findIndex(i => i.id === item.id))}
                                placeholder="Search material..."
                                style={{
                                  width: '100%',
                                  height: '42px',
                                  padding: '0 14px',
                                  fontSize: '14px',
                                  fontWeight: isMaterialSelected ? 600 : 400,
                                  color: '#0F172A',
                                  background: '#F8FAFC',
                                  border: '1px solid #E2E8F0',
                                  borderRadius: '10px',
                                  outline: 'none',
                                  transition: 'all 0.15s',
                                }}
                                onFocusCapture={(e) => {
                                  e.currentTarget.style.borderColor = '#2563EB';
                                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)';
                                  e.currentTarget.style.background = '#fff';
                                }}
                                onBlurCapture={(e) => {
                                  e.currentTarget.style.borderColor = '#E2E8F0';
                                  e.currentTarget.style.boxShadow = 'none';
                                  e.currentTarget.style.background = '#F8FAFC';
                                }}
                              />
                              {/* Subtitle under search when material is selected */}
                              {isMaterialSelected && openDropdownIndex !== items.findIndex(i => i.id === item.id) && (
                                <div style={{ fontSize: '12px', color: '#64748B', marginTop: '1px', paddingLeft: '14px' }}>
                                  Raw Material
                                </div>
                              )}

                              {/* Dropdown */}
                              {openDropdownIndex === items.findIndex(i => i.id === item.id) && materials && (
                                <div style={{
                                  position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                                  zIndex: 50, background: '#fff',
                                  border: '1px solid #E2E8F0',
                                  borderRadius: '12px',
                                  boxShadow: '0 12px 36px rgba(15,23,42,0.12)',
                                  maxHeight: '220px', overflowY: 'auto',
                                  padding: '4px',
                                }}>
                                  {(materials || [])
                                    .filter(m => {
                                      const idx = items.findIndex(i => i.id === item.id);
                                      const q = (materialSearchText[idx] ?? '').toLowerCase();
                                      return !q || m.name.toLowerCase().includes(q) || (m.make || '').toLowerCase().includes(q);
                                    })
                                    .map(m => (
                                      <div
                                        key={m.id}
                                        style={{
                                          padding: '10px 12px',
                                          cursor: 'pointer',
                                          fontSize: '13px',
                                          borderRadius: '8px',
                                          transition: 'background 0.1s',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '10px',
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = '#F0F7FF'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        onClick={() => {
                                          handleMaterialSelect(item.id!, m.id);
                                          const idx = items.findIndex(i => i.id === item.id);
                                          setMaterialSearchText(prev => ({ ...prev, [idx]: '' }));
                                          setOpenDropdownIndex(-1);
                                        }}
                                      >
                                        <div style={{
                                          width: '32px', height: '32px', borderRadius: '8px',
                                          background: '#EFF6FF',
                                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                                          flexShrink: 0,
                                        }}>
                                          <Box size={14} style={{ color: '#2563EB' }} />
                                        </div>
                                        <div>
                                          <div style={{ fontWeight: 600, color: '#0F172A' }}>{m.name}</div>
                                          {m.make && <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '1px' }}>{m.make}</div>}
                                        </div>
                                      </div>
                                    ))}
                                  {(materials || []).filter(m => {
                                    const idx = items.findIndex(i => i.id === item.id);
                                    const q = (materialSearchText[idx] ?? '').toLowerCase();
                                    return !q || m.name.toLowerCase().includes(q) || (m.make || '').toLowerCase().includes(q);
                                  }).length === 0 && (
                                    <div style={{ padding: '16px', textAlign: 'center', color: '#94A3B8', fontSize: '12px', fontStyle: 'italic' }}>
                                      No materials found
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Sub-assembly Badge */}
                            {hasChildren && (
                              <span style={{
                                padding: '2px 8px',
                                fontSize: '10px',
                                fontWeight: 700,
                                color: '#2563EB',
                                background: '#EFF6FF',
                                border: '1px solid #DBEAFE',
                                borderRadius: '999px',
                                flexShrink: 0,
                                letterSpacing: '0.02em',
                              }}>
                                Sub-assembly
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Quantity + Unit — Grouped Control */}
                      <td style={{ padding: '0 16px', verticalAlign: 'middle' }}>
                        <div style={{
                          display: 'flex',
                          height: '42px',
                          border: '1px solid #E2E8F0',
                          borderRadius: '10px',
                          overflow: 'hidden',
                          transition: 'border-color 0.15s',
                        }}
                          onFocusWithin={e => { e.currentTarget.style.borderColor = '#2563EB'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
                          onBlurWithin={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.boxShadow = 'none'; }}
                        >
                          <input
                            type="number"
                            value={item.required_qty || ''}
                            onChange={(e) => updateItemById(item.id!, 'required_qty', Number(e.target.value))}
                            style={{
                              flex: 1,
                              border: 'none',
                              padding: '0 12px',
                              fontSize: '13px',
                              fontWeight: 500,
                              color: '#0F172A',
                              background: '#F8FAFC',
                              textAlign: 'right',
                              outline: 'none',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          />
                          <div style={{
                            width: '56px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: '#F1F5F9',
                            borderLeft: '1px solid #E2E8F0',
                          }}>
                            <select
                              value={item.unit}
                              onChange={(e) => updateItemById(item.id!, 'unit', e.target.value)}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                fontSize: '12px',
                                fontWeight: 500,
                                color: '#475569',
                                cursor: 'pointer',
                                outline: 'none',
                                padding: '0 2px',
                                textAlign: 'center',
                              }}
                            >
                              {unitOptions.map(u => <option key={u.value} value={u.value}>{u.value}</option>)}
                            </select>
                          </div>
                        </div>
                      </td>

                      {/* Waste % — Grouped Control */}
                      <td style={{ padding: '0 16px', verticalAlign: 'middle' }}>
                        {hasChildren ? (
                          <div style={{
                            height: '42px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#CBD5E1', fontSize: '13px',
                          }}>—</div>
                        ) : (
                          <div style={{
                            display: 'flex',
                            height: '42px',
                            border: '1px solid #E2E8F0',
                            borderRadius: '10px',
                            overflow: 'hidden',
                            transition: 'border-color 0.15s',
                          }}
                            onFocusWithin={e => { e.currentTarget.style.borderColor = '#2563EB'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
                            onBlurWithin={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.boxShadow = 'none'; }}
                          >
                            <input
                              type="number"
                              value={item.wastage_pct || ''}
                              onChange={(e) => updateItemById(item.id!, 'wastage_pct', Number(e.target.value))}
                              style={{
                                flex: 1,
                                border: 'none',
                                padding: '0 12px',
                                fontSize: '13px',
                                fontWeight: 500,
                                color: '#0F172A',
                                background: '#F8FAFC',
                                textAlign: 'center',
                                outline: 'none',
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            />
                            <div style={{
                              width: '36px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: '#F1F5F9',
                              borderLeft: '1px solid #E2E8F0',
                              fontSize: '12px',
                              fontWeight: 500,
                              color: '#94A3B8',
                            }}>%</div>
                          </div>
                        )}
                      </td>

                      {/* Lead Time — Combined Control */}
                      <td style={{ padding: '0 16px', verticalAlign: 'middle' }}>
                        {hasChildren ? (
                          <div style={{
                            height: '42px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#CBD5E1', fontSize: '13px',
                          }}>—</div>
                        ) : (
                          <div style={{
                            display: 'flex',
                            height: '42px',
                            border: '1px solid #E2E8F0',
                            borderRadius: '10px',
                            overflow: 'hidden',
                            transition: 'border-color 0.15s',
                          }}
                            onFocusWithin={e => { e.currentTarget.style.borderColor = '#2563EB'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
                            onBlurWithin={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.boxShadow = 'none'; }}
                          >
                            <input
                              type="number"
                              min="0"
                              value={item.lead_time_days || ''}
                              onChange={(e) => updateItemById(item.id!, 'lead_time_days', Math.max(0, parseInt(e.target.value) || 0))}
                              style={{
                                flex: 1,
                                border: 'none',
                                padding: '0 12px',
                                fontSize: '13px',
                                fontWeight: 500,
                                color: '#0F172A',
                                background: '#F8FAFC',
                                textAlign: 'right',
                                outline: 'none',
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            />
                            <div style={{
                              width: '64px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: '#F1F5F9',
                              borderLeft: '1px solid #E2E8F0',
                            }}>
                              <select
                                value="days"
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  fontSize: '11px',
                                  fontWeight: 500,
                                  color: '#475569',
                                  cursor: 'pointer',
                                  outline: 'none',
                                  padding: '0 2px',
                                  textAlign: 'center',
                                }}
                              >
                                {LEAD_TIME_UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                              </select>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Details — View Details Link */}
                      <td style={{ padding: '0 16px', verticalAlign: 'middle' }}>
                        <button
                          type="button"
                          onClick={() => setActiveDetailRowId(activeDetailRowId === item.id ? null : item.id!)}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: '0',
                            fontSize: '13px',
                            fontWeight: 500,
                            color: '#2563EB',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'all 0.15s',
                            textDecoration: activeDetailRowId === item.id ? 'underline' : 'none',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.color = '#1D4ED8'; e.currentTarget.style.textDecoration = 'underline'; }}
                          onMouseLeave={e => { e.currentTarget.style.color = '#2563EB'; e.currentTarget.style.textDecoration = activeDetailRowId === item.id ? 'underline' : 'none'; }}
                        >
                          {activeDetailRowId === item.id ? 'Hide' : 'View Details'} →
                        </button>
                      </td>

                      {/* Row Actions — Hover Reveal */}
                      <td style={{ padding: '0 8px', verticalAlign: 'middle', position: 'relative' }}>
                        <div className="action-menu-container" style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
                          <button
                            type="button"
                            onClick={() => setActiveActionMenuRowId(activeActionMenuRowId === item.id ? null : item.id!)}
                            style={{
                              width: '32px', height: '32px',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: 'none', border: 'none',
                              borderRadius: '8px',
                              color: '#94A3B8',
                              cursor: 'pointer',
                              opacity: isHovered || activeActionMenuRowId === item.id ? 1 : 0,
                              transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#475569'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#94A3B8'; }}
                          >
                            <MoreHorizontal size={16} />
                          </button>
                          
                          {activeActionMenuRowId === item.id && (
                            <div style={{
                              position: 'absolute',
                              right: 0,
                              top: '100%',
                              marginTop: '4px',
                              zIndex: 999,
                              background: '#fff',
                              border: '1px solid #E2E8F0',
                              borderRadius: '12px',
                              boxShadow: '0 12px 36px rgba(15,23,42,0.12)',
                              padding: '4px',
                              minWidth: '160px',
                              animation: 'scaleIn 150ms ease-out',
                            }}>
                              <button
                                type="button"
                                onClick={() => { addSubMaterial(item.id!); setActiveActionMenuRowId(null); }}
                                style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  fontSize: '13px',
                                  fontWeight: 500,
                                  color: '#475569',
                                  background: 'transparent',
                                  border: 'none',
                                  borderRadius: '8px',
                                  textAlign: 'left',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  transition: 'background 0.1s',
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                              >
                                <Plus size={14} /> Add Sub-material
                              </button>
                              <button
                                type="button"
                                onClick={() => { duplicateItem(item.id!); setActiveActionMenuRowId(null); }}
                                style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  fontSize: '13px',
                                  fontWeight: 500,
                                  color: '#475569',
                                  background: 'transparent',
                                  border: 'none',
                                  borderRadius: '8px',
                                  textAlign: 'left',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  transition: 'background 0.1s',
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                              >
                                <Copy size={14} /> Duplicate
                              </button>
                              <div style={{ height: '1px', background: '#F1F5F9', margin: '4px 0' }} />
                              <button
                                type="button"
                                onClick={() => { removeItem(item.id!); setActiveActionMenuRowId(null); }}
                                disabled={items.length <= 1}
                                style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  fontSize: '13px',
                                  fontWeight: 500,
                                  color: '#DC2626',
                                  background: 'transparent',
                                  border: 'none',
                                  borderRadius: '8px',
                                  textAlign: 'left',
                                  cursor: items.length <= 1 ? 'not-allowed' : 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  opacity: items.length <= 1 ? 0.4 : 1,
                                  transition: 'background 0.1s',
                                }}
                                onMouseEnter={e => { if (items.length > 1) e.currentTarget.style.background = '#FEF2F2'; }}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                              >
                                <Trash2 size={14} /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                
                {items.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{
                      padding: '60px 24px',
                      textAlign: 'center',
                    }}>
                      <div style={{
                        width: '56px', height: '56px', borderRadius: '14px',
                        background: '#F1F5F9',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 16px',
                      }}>
                        <FileSpreadsheet size={24} style={{ color: '#94A3B8' }} />
                      </div>
                      <p style={{ fontSize: '14px', fontWeight: 600, color: '#475569', margin: '0 0 4px' }}>No materials added yet</p>
                      <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0 }}>Click "Add Material" to start building your BOM</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ─── Detail Tray (Expanded Row) ─── */}
          {getFlattenedTree().map((item) => {
            if (activeDetailRowId !== item.id) return null;
            return (
              <div key={`detail-${item.id}`} style={{
                background: '#F8FBFF',
                borderTop: '1px solid #F1F5F9',
                padding: '20px 28px 20px 84px',
                display: 'flex',
                gap: '24px',
                animation: 'slideDown 200ms ease-out',
              }}>
                <div style={{ flex: 1, maxWidth: '220px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
                    Discount Category
                  </label>
                  {(() => {
                    const variants = getVariantsForMaterial(item.material_id);
                    if (!variants.length) {
                      return <div style={{ fontSize: '13px', color: '#94A3B8', padding: '10px 0' }}>—</div>;
                    }
                    return (
                      <select
                        value={item.company_variant_id || ''}
                        onChange={(e) => {
                          const vId = e.target.value;
                          const vName = getVariantName(vId);
                          updateItemById(item.id!, 'company_variant_id', vId || '');
                          updateItemById(item.id!, 'variant_name', vName);
                        }}
                        style={{
                          width: '100%',
                          height: '40px',
                          padding: '0 12px',
                          background: '#fff',
                          border: '1px solid #E2E8F0',
                          borderRadius: '10px',
                          fontSize: '13px',
                          color: '#0F172A',
                          outline: 'none',
                          transition: 'border-color 0.15s',
                        }}
                        onFocus={e => { e.currentTarget.style.borderColor = '#2563EB'; }}
                        onBlur={e => { e.currentTarget.style.borderColor = '#E2E8F0'; }}
                      >
                        <option value="">No Category</option>
                        {variants.map(v => (
                          <option key={v.company_variant_id} value={v.company_variant_id}>
                            {getVariantName(v.company_variant_id)}
                          </option>
                        ))}
                      </select>
                    );
                  })()}
                </div>
                
                <div style={{ flex: 1, maxWidth: '220px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
                    Brand
                  </label>
                  <select
                    value={item.make || ''}
                    onChange={(e) => updateItemById(item.id!, 'make', e.target.value)}
                    style={{
                      width: '100%',
                      height: '40px',
                      padding: '0 12px',
                      background: '#fff',
                      border: '1px solid #E2E8F0',
                      borderRadius: '10px',
                      fontSize: '13px',
                      color: '#0F172A',
                      outline: 'none',
                      transition: 'border-color 0.15s',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#2563EB'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#E2E8F0'; }}
                  >
                    <option value="">—</option>
                    {brandOptions.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                
                <div style={{ flex: 1, maxWidth: '400px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
                    Notes / Remarks
                  </label>
                  <input
                    type="text"
                    value={item.notes || ''}
                    onChange={(e) => updateItemById(item.id!, 'notes', e.target.value)}
                    placeholder="Enter notes..."
                    style={{
                      width: '100%',
                      height: '40px',
                      padding: '0 14px',
                      background: '#fff',
                      border: '1px solid #E2E8F0',
                      borderRadius: '10px',
                      fontSize: '13px',
                      color: '#0F172A',
                      outline: 'none',
                      transition: 'border-color 0.15s',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#2563EB'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#E2E8F0'; }}
                  />
                </div>
              </div>
            );
          })}

          {/* ─── Add Material Dashed Button ─── */}
          <div style={{
            padding: '16px 28px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <button
              type="button"
              onClick={addItem}
              style={{
                height: '48px',
                padding: '0 24px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: 'transparent',
                border: '2px dashed #CBD5E1',
                color: '#64748B',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#2563EB';
                e.currentTarget.style.background = '#EFF6FF';
                e.currentTarget.style.color = '#2563EB';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = '#CBD5E1';
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#64748B';
              }}
            >
              <Plus size={18} /> Add another material
            </button>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#0F172A' }}>
              Total Materials: {materialCount}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            INFORMATION PANEL
            ═══════════════════════════════════════════════════════════════ */}
        <div style={{
          marginTop: '24px',
          background: '#F8FBFF',
          border: '1px solid #E2E8F0',
          borderLeft: '4px solid #2563EB',
          borderRadius: '14px',
          padding: '24px 28px',
        }}>
          <h3 style={{
            fontSize: '16px',
            fontWeight: 700,
            color: '#0F172A',
            margin: '0 0 20px',
          }}>
            How Material Calculation Works
          </h3>
          <div style={{ display: 'flex', gap: '24px' }}>
            {/* Block 1 */}
            <div style={{ flex: 1, display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '14px',
                background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Box size={22} style={{ color: '#2563EB' }} />
              </div>
              <div>
                <p style={{ fontSize: '15px', fontWeight: 500, color: '#0F172A', margin: '0 0 4px', lineHeight: '22px' }}>
                  Output Quantity is your production quantity.
                </p>
                <p style={{ fontSize: '13px', color: '#64748B', margin: 0, lineHeight: '20px' }}>
                  All material quantities are defined per this base output unit.
                </p>
              </div>
            </div>

            {/* Block 2 */}
            <div style={{ flex: 1, display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '14px',
                background: 'linear-gradient(135deg, #FFF7ED, #FFEDD5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Percent size={22} style={{ color: '#EA580C' }} />
              </div>
              <div>
                <p style={{ fontSize: '15px', fontWeight: 500, color: '#0F172A', margin: '0 0 4px', lineHeight: '22px' }}>
                  Waste % is applied during Job Card generation.
                </p>
                <p style={{ fontSize: '13px', color: '#64748B', margin: 0, lineHeight: '20px' }}>
                  Automatically adds buffer quantity when creating production orders.
                </p>
              </div>
            </div>

            {/* Block 3 */}
            <div style={{ flex: 1, display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '14px',
                background: 'linear-gradient(135deg, #F0FDF4, #DCFCE7)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <BarChart3 size={22} style={{ color: '#16A34A' }} />
              </div>
              <div>
                <p style={{ fontSize: '15px', fontWeight: 500, color: '#0F172A', margin: '0 0 4px', lineHeight: '22px' }}>
                  Material quantities automatically scale with production quantity.
                </p>
                <p style={{ fontSize: '13px', color: '#64748B', margin: 0, lineHeight: '20px' }}>
                  Scale up or down — all calculations update in real-time.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Import BOQ Modal ─── */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowImportModal(false)}>
          <div className="bg-white" style={{ borderRadius: '16px', padding: '28px', maxWidth: '520px', width: '90%', boxShadow: '0 25px 60px rgba(15,23,42,0.2)' }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: 0 }}>Import BOQ from Excel</h3>
              <button onClick={() => setShowImportModal(false)} style={{
                width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: '#F1F5F9', border: 'none', borderRadius: '8px', color: '#64748B', cursor: 'pointer',
                fontSize: '16px', transition: 'all 0.15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = '#E2E8F0'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#F1F5F9'; }}>
                ×
              </button>
            </div>
            <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '16px', lineHeight: '20px' }}>
              Copy columns directly from your spreadsheet and paste them below.{' '}
              Format: <strong style={{ color: '#475569' }}>Material Name [Tab] Quantity [Tab] Notes</strong>.{' '}
              Make sure to match material names exactly with the Raw Materials catalog.
            </p>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={"Ball Valve\t120\tMain line connection\nMS Pipe\t350\tSchedule 40"}
              style={{
                width: '100%',
                height: '160px',
                padding: '14px',
                fontFamily: 'monospace',
                fontSize: '13px',
                border: '1px solid #E2E8F0',
                borderRadius: '12px',
                resize: 'vertical',
                outline: 'none',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = '#2563EB'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.boxShadow = 'none'; }}
            />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                onClick={() => setShowImportModal(false)}
                style={{
                  height: '40px', padding: '0 20px',
                  border: '1px solid #E2E8F0', background: '#fff',
                  color: '#475569', borderRadius: '8px',
                  fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#F8FAFC'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
              >
                Cancel
              </button>
              <button
                onClick={handleExcelImport}
                disabled={!importText.trim()}
                style={{
                  height: '40px', padding: '0 20px',
                  background: '#2563EB', border: '1px solid #2563EB',
                  color: '#fff', borderRadius: '8px',
                  fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  transition: 'all 0.15s',
                  opacity: importText.trim() ? 1 : 0.5,
                }}
                onMouseEnter={e => { if (importText.trim()) e.currentTarget.style.background = '#1D4ED8'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#2563EB'; }}
              >
                Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete Confirmation Modal ─── */}
      {showDeleteModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={() => !deleteBOM.isPending && setShowDeleteModal(false)}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '28px', maxWidth: '440px', width: '90%', boxShadow: '0 25px 60px rgba(15,23,42,0.2)' }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={20} color="#DC2626" />
              </div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>Delete this BOM?</h3>
            </div>
            <p style={{ margin: '0 0 4px', fontSize: '14px', color: '#475569', lineHeight: '22px' }}>
              <strong>{formData.bom_code || 'This BOM'}</strong> · {formData.product_name || 'Unnamed product'}
            </p>
            <p style={{ margin: '0 0 24px', fontSize: '13px', color: '#94A3B8', lineHeight: '20px' }}>
              This will permanently remove the BOM and all its material rows. Job cards or production schedules that reference this BOM will block the delete. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowDeleteModal(false)} disabled={deleteBOM.isPending}
                style={{
                  height: '40px', padding: '0 20px',
                  border: '1px solid #E2E8F0', background: '#fff',
                  color: '#475569', borderRadius: '8px',
                  fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (!deleteBOM.isPending) e.currentTarget.style.background = '#F8FAFC'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}>
                Cancel
              </button>
              <button onClick={() => deleteBOM.mutate(bomId!)} disabled={deleteBOM.isPending}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  height: '40px', padding: '0 20px',
                  border: 'none', background: '#DC2626', color: '#fff',
                  borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                  cursor: deleteBOM.isPending ? 'not-allowed' : 'pointer',
                  opacity: deleteBOM.isPending ? 0.6 : 1,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (!deleteBOM.isPending) e.currentTarget.style.background = '#B91C1C'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#DC2626'; }}>
                {deleteBOM.isPending ? 'Deleting...' : 'Delete BOM'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── CSS Animations ─── */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeInRow {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideDown {
          from { opacity: 0; max-height: 0; }
          to { opacity: 1; max-height: 300px; }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}} />
    </div>
  );
}
