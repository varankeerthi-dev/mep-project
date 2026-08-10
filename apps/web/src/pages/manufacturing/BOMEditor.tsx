import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Save, Trash2, ChevronDown, ChevronRight, MoreHorizontal, FileSpreadsheet, Upload, Search, GripVertical, Box, Percent, BarChart3, Copy, X } from 'lucide-react';
import { EntryContainer } from '../../components/ui/EntryContainer';
import { Button } from '../../components/ui/button';
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
  useFinishedGoodsQuery,
  useWorkCentersQuery,
  useWarehousesQuery
} from '../../features/manufacturing';

type BOMEditorProps = {
  onSuccess: () => void;
  onCancel: () => void;
};

type BOMItem = {
  id: string;
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
  parent_material_id: string | null;
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
    approval_status: 'draft',
    revision: 'A',
    product_code: '',
    bom_type: 'assembly',
    product_category: 'standard',
    priority: 'medium',
    effective_date: new Date().toISOString().split('T')[0],
    valid_to: '',
    created_by_name: '',
    approved_by_name: ''
  });

  const [items, setItems] = useState<BOMItem[]>([
    { id: crypto.randomUUID(), material_id: '', material_name: '', required_qty: 0, unit: 'kg', wastage_pct: 5, notes: '', lead_time_days: 0, bom_level: 0, parent_material_id: null, custom_attributes: {}, unit_cost: 0, sequence_no: 0, is_critical: false, inspection_required: false, shelf_life_days: null, scrap_factor: null, yield_pct: null }
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
  const [productDropdownPos, setProductDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);
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
  const { data: workCenters } = useWorkCentersQuery(organisation?.id);
  const { data: warehouses } = useWarehousesQuery(organisation?.id);
  const { data: bomDetail } = useBomDetailQuery(bomId);

  const getVariantsForMaterial = (materialId: string) =>
    (variantPricing || []).filter(v => v.item_id === materialId);

  const getVariantName = (variantId: string) =>
    companyVariants?.find(v => v.id === variantId)?.variant_name || variantId;

  useEffect(() => {
    const handleClickOutsideProduct = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.product-dropdown-container') && !target.closest('.product-dropdown-portal')) {
        setOpenProductDropdown(false);
      }
    };
    const handleScrollOrResize = () => setOpenProductDropdown(false);
    document.addEventListener('mousedown', handleClickOutsideProduct);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      document.removeEventListener('mousedown', handleClickOutsideProduct);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
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
        approval_status: bomDetail.header.approval_status || 'draft',
        revision: bomDetail.header.revision || 'A',
        product_code: bomDetail.header.product_code || '',
        bom_type: bomDetail.header.bom_type || 'assembly',
        product_category: bomDetail.header.product_category || 'standard',
        priority: bomDetail.header.priority || 'medium',
        effective_date: bomDetail.header.effective_date || '',
        valid_to: bomDetail.header.valid_to || '',
        created_by_name: bomDetail.header.created_by_name || '',
        approved_by_name: bomDetail.header.approved_by_name || ''
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
          parent_material_id: item.parent_material_id || null,
          custom_attributes: item.custom_attributes || {},
          unit_cost: item.unit_cost || 0,
          sequence_no: item.sequence_no || 0,
          work_center_id: item.work_center_id || null,
          is_critical: item.is_critical || false,
          alternate_material_id: item.alternate_material_id || null,
          drawing_reference: item.drawing_reference || '',
          inspection_required: item.inspection_required || false,
          shelf_life_days: item.shelf_life_days || null,
          warehouse_id: item.warehouse_id || null,
          scrap_factor: item.scrap_factor || null,
          yield_pct: item.yield_pct || null
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
      organisation_id: organisation.id,
      revision: formData.revision,
      product_code: formData.product_code || '',
      bom_type: formData.bom_type,
      product_category: formData.product_category,
      priority: formData.priority,
      effective_date: formData.effective_date || null,
      valid_to: formData.valid_to || null,
      created_by_name: formData.created_by_name || user.name || user.email || '',
      approved_by_name: formData.approval_status === 'approved' && !formData.approved_by_name
        ? (user.name || user.email || '')
        : formData.approved_by_name
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
      parent_material_id: null,
      custom_attributes: {},
      unit_cost: 0,
      sequence_no: prev.length,
      is_critical: false,
      inspection_required: false,
      shelf_life_days: null,
      scrap_factor: null,
      yield_pct: null
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
      parent_material_id: parentId,
      custom_attributes: {},
      unit_cost: 0,
      sequence_no: 0,
      is_critical: false,
      inspection_required: false,
      shelf_life_days: null,
      scrap_factor: null,
      yield_pct: null
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
        custom_attributes: source.custom_attributes || {},
        unit_cost: source.unit_cost || 0,
        sequence_no: source.sequence_no || 0,
        is_critical: source.is_critical || false,
        inspection_required: source.inspection_required || false,
        shelf_life_days: source.shelf_life_days || null,
        scrap_factor: source.scrap_factor || null,
        yield_pct: source.yield_pct || null
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

  const inputStyle: React.CSSProperties = {
    width: '100%', height: '40px', padding: '0 12px',
    fontSize: '13px', borderRadius: '5px',
    border: '1px solid #cbd5e1', outline: 'none', background: '#ffffff',
  };

  return (
    <div className="bom-editor-page-container p-6 max-w-[1000px] mx-auto font-['Inter'] space-y-6">
      {/* Ignore Global Button CSS - Use Component Button Styles */}
      <style>{`
        .bom-editor-page-container .inner-container-20px {
          border-radius: 20px !important;
        }
        .bom-editor-page-container .entry-field-container-5px {
          border-radius: 5px !important;
        }
        .bom-editor-page-container .content-body-left-pad-12px {
          padding-left: 12px !important;
        }
        .bom-editor-page-container label {
          margin-bottom: 8px !important;
        }
        .bom-editor-page-container input,
        .bom-editor-page-container select,
        .bom-editor-page-container textarea {
          border-radius: 5px !important;
        }
      `}</style>

      {/* ─── Breadcrumb Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Button variant="link" size="sm" onClick={onCancel} className="h-auto p-0 text-slate-500 hover:text-indigo-600 font-medium">
              BOMs
            </Button>
            <ChevronRight size={12} />
            <span className="text-slate-900 font-semibold">
              {bomId ? 'Edit BOM' : 'Create BOM'}
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900">
            {bomId ? 'Edit BOM' : 'Create BOM'}
          </h1>
          <p className="text-xs text-slate-400 mt-1">Define raw materials for a finished product</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={onCancel}
            leftIcon={<ArrowLeft size={14} />}
          >
            Back
          </Button>
        </div>
      </div>

      {/* Card 1: BOM Details */}
      <div
        className="inner-container-20px content-body-left-pad-12px bg-white border border-slate-200 p-6 shadow-2xs space-y-4"
        style={{ borderRadius: '20px', paddingLeft: '12px' }}
      >
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-indigo-600 border-b border-slate-100 pb-2">
          1. BOM Details
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <EntryContainer label="Product *" className="entry-field-container-5px">
            <div className="product-dropdown-container" style={{ position: 'relative', width: '100%' }}>
              <input type="text" style={inputStyle} value={openProductDropdown ? productSearchText : formData.product_name}
                onChange={(e) => {
                  setProductSearchText(e.target.value);
                  const rect = e.currentTarget.getBoundingClientRect();
                  setProductDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
                  setOpenProductDropdown(true);
                }}
                onFocus={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setProductDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
                  setOpenProductDropdown(true);
                }}
                placeholder="Search finished good..." />
            </div>
          </EntryContainer>

          <EntryContainer label="BOM Code" className="entry-field-container-5px">
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input type="text" style={{ ...inputStyle, flex: 1 }} value={formData.bom_code} onChange={(e) => setFormData({ ...formData, bom_code: e.target.value })} placeholder="Auto-generated if empty" />
              {bomId && formData.revision && (
                <span style={{
                  padding: '4px 10px',
                  borderRadius: '999px',
                  fontSize: '11px',
                  fontWeight: 700,
                  background: '#EEF2FF',
                  color: '#6366F1',
                  border: '1px solid #C7D2FE',
                  whiteSpace: 'nowrap',
                }}>
                  Rev {formData.revision}
                </span>
              )}
            </div>
          </EntryContainer>

          <EntryContainer label="Revision" className="entry-field-container-5px">
            <input type="text" style={inputStyle} value={formData.revision} onChange={(e) => setFormData({ ...formData, revision: e.target.value })} placeholder="A" />
          </EntryContainer>

          <EntryContainer label="Product Code / SKU" className="entry-field-container-5px">
            <input type="text" style={inputStyle} value={formData.product_code} onChange={(e) => setFormData({ ...formData, product_code: e.target.value })} placeholder="Optional part number" />
          </EntryContainer>

          <EntryContainer label="Output" className="entry-field-container-5px">
            <div style={{ display: 'flex', gap: '6px', width: '100%' }}>
              <input type="number" style={{ ...inputStyle, width: '90px' }} value={formData.output_qty} onChange={(e) => setFormData({ ...formData, output_qty: Number(e.target.value) })} />
              <select style={{ ...inputStyle, flex: 1 }} value={formData.output_unit} onChange={(e) => setFormData({ ...formData, output_unit: e.target.value })}>
                {unitOptions.map(u => <option key={u.value} value={u.value}>{u.value}</option>)}
              </select>
            </div>
          </EntryContainer>

          <EntryContainer label="Batch No" className="entry-field-container-5px">
            <input type="text" style={inputStyle} value={formData.batch_no} onChange={(e) => setFormData({ ...formData, batch_no: e.target.value })} placeholder="Optional batch/lot identifier" />
          </EntryContainer>

          <EntryContainer label="BOM Type" className="entry-field-container-5px">
            <select style={inputStyle} value={formData.bom_type} onChange={(e) => setFormData({ ...formData, bom_type: e.target.value })}>
              <option value="assembly">Assembly (MBOM)</option>
              <option value="repetitive">Repetitive</option>
              <option value="formula">Formula / Process</option>
            </select>
          </EntryContainer>

          <EntryContainer label="Product Category" className="entry-field-container-5px">
            <select style={inputStyle} value={formData.product_category} onChange={(e) => setFormData({ ...formData, product_category: e.target.value })}>
              <option value="standard">Standard</option>
              <option value="custom">Custom Order</option>
              <option value="prototype">Prototype</option>
            </select>
          </EntryContainer>

          <EntryContainer label="Priority" className="entry-field-container-5px">
            <select style={inputStyle} value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value })}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </EntryContainer>

          <EntryContainer label="" className="entry-field-container-5px">
            <span style={{ fontSize: '12px', color: '#94A3B8', paddingTop: '8px', display: 'block' }}>&nbsp;</span>
          </EntryContainer>

          <EntryContainer label="Effective Date" className="entry-field-container-5px">
            <input type="date" style={inputStyle} value={formData.effective_date} onChange={(e) => setFormData({ ...formData, effective_date: e.target.value })} />
          </EntryContainer>

          <EntryContainer label="Valid To" className="entry-field-container-5px">
            <input type="date" style={inputStyle} value={formData.valid_to} onChange={(e) => setFormData({ ...formData, valid_to: e.target.value })} />
          </EntryContainer>
        </div>
      </div>

      {/* Product dropdown — portal overlay (escapes field stacking contexts / clipping) */}
      {openProductDropdown && productDropdownPos && createPortal(
        <div className="product-dropdown-portal" style={{
          position: 'fixed',
          top: productDropdownPos.top,
          left: productDropdownPos.left,
          width: productDropdownPos.width,
          zIndex: 9999,
          background: '#fff',
          border: '1px solid #E2E8F0',
          borderRadius: '10px',
          boxShadow: '0 12px 36px rgba(15,23,42,0.12)',
          maxHeight: '220px',
          overflowY: 'auto',
          padding: '4px',
        }}>
          {(finishedGoods || [])
            .filter(m => {
              const q = productSearchText.toLowerCase();
              return !q || m.name.toLowerCase().includes(q) || (m.item_code || '').toLowerCase().includes(q);
            })
            .map(m => (
              <div key={m.id} style={{ padding: '10px 12px', cursor: 'pointer', fontSize: '13px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '2px', transition: 'background 0.1s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#F0F7FF'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                onClick={() => handleProductSelect(m.id)}
              >
                <span style={{ fontWeight: 600, color: '#0F172A' }}>{m.name}</span>
                {m.item_code && <span style={{ fontSize: '11px', color: '#94A3B8' }}>{m.item_code}</span>}
              </div>
            ))}
          {(finishedGoods || []).filter(m => {
            const q = productSearchText.toLowerCase();
            return !q || m.name.toLowerCase().includes(q) || (m.item_code || '').toLowerCase().includes(q);
          }).length === 0 && (
            <div style={{ padding: '12px', fontSize: '12px', color: '#94A3B8', fontStyle: 'italic', textAlign: 'center' }}>No finished goods found</div>
          )}
        </div>,
        document.body
      )}

      {/* Card 2: Options */}
      <div
        className="inner-container-20px content-body-left-pad-12px bg-white border border-slate-200 p-6 shadow-2xs space-y-4"
        style={{ borderRadius: '20px', paddingLeft: '12px' }}
      >
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-indigo-600 border-b border-slate-100 pb-2">
          2. Options
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <EntryContainer label="Status" className="entry-field-container-5px">
            <Button onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
              variant="ghost" size="sm"
              className={`rounded-full px-3.5 text-xs font-semibold ${formData.is_active ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}>
              {formData.is_active ? 'Active' : 'Inactive'}
            </Button>
          </EntryContainer>

          <EntryContainer label="Approval" className="entry-field-container-5px">
            <select style={inputStyle} value={formData.approval_status} onChange={(e) => setFormData({ ...formData, approval_status: e.target.value })}>
              <option value="draft">Draft</option>
              <option value="pending_approval">Pending Approval</option>
              <option value="approved">Approved</option>
              <option value="obsolete">Obsolete</option>
            </select>
          </EntryContainer>

          <EntryContainer label="Created By" className="entry-field-container-5px">
            <input type="text" style={{ ...inputStyle, background: '#F8FAFC', color: '#64748B' }} value={formData.created_by_name} readOnly />
          </EntryContainer>

          <EntryContainer label="Approved By" className="entry-field-container-5px">
            <input type="text" style={{ ...inputStyle, background: '#F8FAFC', color: '#64748B' }} value={formData.approved_by_name} readOnly />
          </EntryContainer>
        </div>
      </div>

        {/* ═══════════════════════════════════════════════════════════════
            RAW MATERIALS — Premium Card
            ═══════════════════════════════════════════════════════════════ */}
        <div
          className="inner-container-20px content-body-left-pad-12px bg-white border border-slate-200 shadow-2xs"
          style={{ borderRadius: '20px', paddingLeft: '12px', overflow: 'hidden' }}
        >
          {/* ─── Card Header ─── */}
          <div style={{
            padding: '20px 28px 16px',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '16px',
            borderBottom: '1px solid #F1F5F9',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-indigo-600" style={{ margin: 0 }}>
                  3. Raw Materials
                </h3>
                <span style={{
                  height: '24px',
                  padding: '0 10px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  background: '#EEF2FF',
                  color: '#6366F1',
                  borderRadius: '999px',
                  fontSize: '11px',
                  fontWeight: 600,
                }}>
                  {materialCount} Material{materialCount !== 1 ? 's' : ''}
                </span>
              </div>
              <p style={{ fontSize: '13px', color: '#64748B', margin: '6px 0 0', fontWeight: 400 }}>
                Used to manufacture one finished product.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexShrink: 0 }}>
              <Button
                type="button"
                onClick={() => setShowImportModal(true)}
                variant="secondary"
                size="sm"
                leftIcon={<Upload size={15} />}
              >
                Import BOQ
              </Button>
              <Button
                type="button"
                onClick={addItem}
                variant="default"
                size="sm"
                leftIcon={<Plus size={15} />}
              >
                Add Material
              </Button>
            </div>
          </div>

          {/* ─── Table ─── */}
          <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                tableLayout: 'fixed',
                minWidth: '1520px',
              }}>
                <thead>
                  <tr style={{ background: '#FAFBFC', borderBottom: '1px solid #F1F5F9' }}>
                    <th style={{ width: '44px', padding: '0 12px', height: '48px', textAlign: 'center' }}></th>
                    <th style={{ width: '56px', padding: '0 8px', height: '48px', textAlign: 'center', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>#</th>
                    <th style={{ width: '200px', padding: '0 16px', height: '48px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Material</th>
                    <th style={{ width: '110px', padding: '0 16px', height: '48px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Quantity</th>
                    <th style={{ width: '80px', padding: '0 16px', height: '48px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Unit Cost</th>
                    <th style={{ width: '70px', padding: '0 16px', height: '48px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Scrap %</th>
                    <th style={{ width: '70px', padding: '0 16px', height: '48px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Yield %</th>
                    <th style={{ width: '100px', padding: '0 16px', height: '48px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Lead Time</th>
                    <th style={{ width: '110px', padding: '0 16px', height: '48px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Work Center</th>
                    <th style={{ width: '60px', padding: '0 8px', height: '48px', textAlign: 'center', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Critical</th>
                    <th style={{ width: '110px', padding: '0 16px', height: '48px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Alternate</th>
                    <th style={{ width: '90px', padding: '0 16px', height: '48px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Drawing Ref</th>
                    <th style={{ width: '50px', padding: '0 8px', height: '48px', textAlign: 'center', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Inspect</th>
                    <th style={{ width: '60px', padding: '0 16px', height: '48px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Shelf Life</th>
                    <th style={{ width: '100px', padding: '0 16px', height: '48px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Warehouse</th>
                    <th style={{ width: '70px', padding: '0 16px', height: '48px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Details</th>
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

                      {/* Sequence */}
                      <td style={{ padding: '0 8px', verticalAlign: 'middle', textAlign: 'center' }}>
                        {hasChildren ? (
                          <span style={{ color: '#CBD5E1', fontSize: '13px' }}>—</span>
                        ) : (
                          <input
                            type="number"
                            min="0"
                            value={item.sequence_no ?? ''}
                            onChange={(e) => updateItemById(item.id!, 'sequence_no', parseInt(e.target.value) || 0)}
                            style={{
                              width: '100%',
                              height: '32px',
                              border: '1px solid #E2E8F0',
                              borderRadius: '6px',
                              padding: '0 6px',
                              fontSize: '12px',
                              textAlign: 'center',
                              outline: 'none',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          />
                        )}
                      </td>

                      {/* Material Cell */}
                      <td style={{ padding: '0 16px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {/* Collapse/Expand Chevron */}
                          {hasChildren ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => setExpandedRowIds(prev => ({ ...prev, [item.id!]: !isExpanded }))}
                              className="text-slate-400 hover:text-slate-600"
                            >
                              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </Button>
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
                           onFocus={e => { e.currentTarget.style.borderColor = '#2563EB'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
                           onBlur={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.boxShadow = 'none'; }}
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

                       {/* Unit Cost */}
                       <td style={{ padding: '0 16px', verticalAlign: 'middle' }}>
                         {hasChildren ? (
                           <div style={{
                             height: '42px',
                             display: 'flex', alignItems: 'center', justifyContent: 'center',
                             color: '#CBD5E1', fontSize: '13px',
                           }}>—</div>
                         ) : (
                           <input
                             type="number"
                             min="0"
                             step="0.01"
                             value={item.unit_cost ?? ''}
                             onChange={(e) => updateItemById(item.id!, 'unit_cost', parseFloat(e.target.value) || 0)}
                             style={{
                               width: '100%',
                               height: '42px',
                               border: '1px solid #E2E8F0',
                               borderRadius: '10px',
                               padding: '0 12px',
                               fontSize: '13px',
                               background: '#F8FAFC',
                               outline: 'none',
                               textAlign: 'right',
                               fontVariantNumeric: 'tabular-nums',
                             }}
                           />
                         )}
                       </td>

                       {/* Scrap % */}
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
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                updateItemById(item.id!, 'wastage_pct', val);
                                updateItemById(item.id!, 'scrap_factor', val);
                                updateItemById(item.id!, 'yield_pct', Math.max(0, 100 - val));
                              }}
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

                       {/* Yield % */}
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
                               value={item.yield_pct ?? ''}
                               onChange={(e) => updateItemById(item.id!, 'yield_pct', Number(e.target.value))}
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
                                 defaultValue="days"
                                 onFocus={(e) => { const p = e.currentTarget.closest('[data-bom-field]'); if (p) { p.style.borderColor = '#2563EB'; p.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; } }}
                                 onBlur={(e) => { const p = e.currentTarget.closest('[data-bom-field]'); if (p) { p.style.borderColor = '#E2E8F0'; p.style.boxShadow = 'none'; } }}
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

                       {/* Work Center */}
                       <td style={{ padding: '0 12px', verticalAlign: 'middle' }}>
                         {hasChildren ? (
                           <span style={{ color: '#CBD5E1', fontSize: '13px' }}>—</span>
                         ) : (
                           <select
                             value={item.work_center_id || ''}
                             onChange={(e) => updateItemById(item.id!, 'work_center_id', e.target.value || null)}
                             style={{
                               width: '100%',
                               height: '36px',
                               border: '1px solid #E2E8F0',
                               borderRadius: '8px',
                               padding: '0 8px',
                               fontSize: '12px',
                               background: '#F8FAFC',
                               outline: 'none',
                               color: '#0F172A',
                             }}
                           >
                             <option value="">—</option>
                             {(workCenters || []).map(wc => (
                               <option key={wc.id} value={wc.id}>{wc.name}</option>
                             ))}
                           </select>
                         )}
                       </td>

                       {/* Critical */}
                       <td style={{ padding: '0 8px', verticalAlign: 'middle', textAlign: 'center' }}>
                         {hasChildren ? (
                           <span style={{ color: '#CBD5E1', fontSize: '13px' }}>—</span>
                         ) : (
                           <button
                             type="button"
                             onClick={() => updateItemById(item.id!, 'is_critical', !item.is_critical)}
                             style={{
                               width: '100%',
                               height: '32px',
                               border: `1px solid ${item.is_critical ? '#F59E0B' : '#E2E8F0'}`,
                               borderRadius: '6px',
                               background: item.is_critical ? '#FFFBEB' : '#F8FAFC',
                               color: item.is_critical ? '#B45309' : '#94A3B8',
                               fontSize: '11px',
                               fontWeight: 600,
                               cursor: 'pointer',
                               transition: 'all 0.15s',
                             }}
                           >
                             {item.is_critical ? 'Yes' : 'No'}
                           </button>
                         )}
                       </td>

                       {/* Alternate Material */}
                       <td style={{ padding: '0 8px', verticalAlign: 'middle' }}>
                         {hasChildren ? (
                           <span style={{ color: '#CBD5E1', fontSize: '13px' }}>—</span>
                         ) : (
                           <select
                             value={item.alternate_material_id || ''}
                             onChange={(e) => updateItemById(item.id!, 'alternate_material_id', e.target.value || null)}
                             style={{
                               width: '100%',
                               height: '36px',
                               border: '1px solid #E2E8F0',
                               borderRadius: '8px',
                               padding: '0 8px',
                               fontSize: '12px',
                               background: '#F8FAFC',
                               outline: 'none',
                               color: '#0F172A',
                             }}
                           >
                             <option value="">None</option>
                             {(materials || [])
                               .filter(m => m.id !== item.material_id)
                               .map(m => (
                               <option key={m.id} value={m.id}>{m.name}</option>
                             ))}
                           </select>
                         )}
                       </td>

                       {/* Drawing Reference */}
                       <td style={{ padding: '0 8px', verticalAlign: 'middle' }}>
                         {hasChildren ? (
                           <span style={{ color: '#CBD5E1', fontSize: '13px' }}>—</span>
                         ) : (
                           <input
                             type="text"
                             value={item.drawing_reference || ''}
                             onChange={(e) => updateItemById(item.id!, 'drawing_reference', e.target.value)}
                             placeholder="e.g. DWG-001"
                             style={{
                               width: '100%',
                               height: '36px',
                               border: '1px solid #E2E8F0',
                               borderRadius: '8px',
                               padding: '0 10px',
                               fontSize: '12px',
                               background: '#F8FAFC',
                               outline: 'none',
                               color: '#0F172A',
                             }}
                           />
                         )}
                       </td>

                       {/* Inspection Required */}
                       <td style={{ padding: '0 8px', verticalAlign: 'middle', textAlign: 'center' }}>
                         {hasChildren ? (
                           <span style={{ color: '#CBD5E1', fontSize: '13px' }}>—</span>
                         ) : (
                           <input
                             type="checkbox"
                             checked={item.inspection_required || false}
                             onChange={(e) => updateItemById(item.id!, 'inspection_required', e.target.checked)}
                             style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                           />
                         )}
                       </td>

                       {/* Shelf Life */}
                       <td style={{ padding: '0 8px', verticalAlign: 'middle' }}>
                         {hasChildren ? (
                           <span style={{ color: '#CBD5E1', fontSize: '13px' }}>—</span>
                         ) : (
                           <input
                             type="number"
                             min="0"
                             value={item.shelf_life_days ?? ''}
                             onChange={(e) => updateItemById(item.id!, 'shelf_life_days', e.target.value ? parseInt(e.target.value) : null)}
                             placeholder="Days"
                             style={{
                               width: '100%',
                               height: '36px',
                               border: '1px solid #E2E8F0',
                               borderRadius: '8px',
                               padding: '0 8px',
                               fontSize: '12px',
                               background: '#F8FAFC',
                               outline: 'none',
                               textAlign: 'right',
                               fontVariantNumeric: 'tabular-nums',
                             }}
                           />
                         )}
                       </td>

                       {/* Warehouse */}
                       <td style={{ padding: '0 8px', verticalAlign: 'middle' }}>
                         {hasChildren ? (
                           <span style={{ color: '#CBD5E1', fontSize: '13px' }}>—</span>
                         ) : (
                           <select
                             value={item.warehouse_id || ''}
                             onChange={(e) => updateItemById(item.id!, 'warehouse_id', e.target.value || null)}
                             style={{
                               width: '100%',
                               height: '36px',
                               border: '1px solid #E2E8F0',
                               borderRadius: '8px',
                               padding: '0 8px',
                               fontSize: '12px',
                               background: '#F8FAFC',
                               outline: 'none',
                               color: '#0F172A',
                             }}
                           >
                             <option value="">—</option>
                             {(warehouses || []).map(w => (
                               <option key={w.id} value={w.id}>{w.warehouse_name || w.name}</option>
                             ))}
                           </select>
                         )}
                       </td>

                       {/* Details — View Details Link */}
                      <td style={{ padding: '0 16px', verticalAlign: 'middle' }}>
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          onClick={() => setActiveDetailRowId(activeDetailRowId === item.id ? null : item.id!)}
                          className="p-0 h-auto text-blue-600 hover:text-blue-700"
                          style={{ textDecoration: activeDetailRowId === item.id ? 'underline' : 'none' }}
                        >
                          {activeDetailRowId === item.id ? 'Hide' : 'View Details'} →
                        </Button>
                      </td>

                      {/* Row Actions — Hover Reveal */}
                      <td style={{ padding: '0 8px', verticalAlign: 'middle', position: 'relative' }}>
                        <div className="action-menu-container" style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setActiveActionMenuRowId(activeActionMenuRowId === item.id ? null : item.id!)}
                            className="text-slate-400 hover:text-slate-600"
                            style={{
                              opacity: isHovered || activeActionMenuRowId === item.id ? 1 : 0,
                              transition: 'all 0.15s',
                            }}
                          >
                            <MoreHorizontal size={16} />
                          </Button>
                          
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
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => { addSubMaterial(item.id!); setActiveActionMenuRowId(null); }}
                                className="w-full justify-start font-medium text-slate-600"
                              >
                                <Plus size={14} /> Add Sub-material
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => { duplicateItem(item.id!); setActiveActionMenuRowId(null); }}
                                className="w-full justify-start font-medium text-slate-600"
                              >
                                <Copy size={14} /> Duplicate
                              </Button>
                              <div style={{ height: '1px', background: '#F1F5F9', margin: '4px 0' }} />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => { removeItem(item.id!); setActiveActionMenuRowId(null); }}
                                disabled={items.length <= 1}
                                className="w-full justify-start font-medium text-red-600 disabled:opacity-40"
                              >
                                <Trash2 size={14} /> Delete
                              </Button>
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

          {/* Cost Rollup Footer */}
          <div style={{
            padding: '16px 28px',
            borderTop: '1px solid #F1F5F9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '24px',
            flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Material Cost </span>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', fontVariantNumeric: 'tabular-nums', marginLeft: '6px' }}>
                  ₹{items.filter(i => i.material_id).reduce((sum, i) => sum + (i.required_qty || 0) * (i.unit_cost || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Est. Production Time </span>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', fontVariantNumeric: 'tabular-nums', marginLeft: '6px' }}>
                  {items.filter(i => i.material_id).reduce((sum, i) => sum + (i.sequence_no || 0), 0)} ops
                </span>
              </div>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Cost per Unit </span>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', fontVariantNumeric: 'tabular-nums', marginLeft: '6px' }}>
                  ₹{formData.output_qty > 0 ? (items.filter(i => i.material_id).reduce((sum, i) => sum + (i.required_qty || 0) * (i.unit_cost || 0), 0) / formData.output_qty).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                </span>
              </div>
            </div>
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
            <Button
              type="button"
              onClick={addItem}
              variant="outline"
              size="lg"
              leftIcon={<Plus size={18} />}
              className="border-dashed h-12 px-6 text-sm font-medium text-zinc-600 hover:border-blue-600 hover:bg-blue-50 hover:text-blue-600"
            >
              Add another material
            </Button>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#0F172A' }}>
              Total Materials: {materialCount}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            INFORMATION PANEL
            ═══════════════════════════════════════════════════════════════ */}
        <div style={{
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

      {/* ─── Action Footer ─── */}
      <div className="flex justify-end gap-3 pt-2">
        {bomId && (
          <Button type="button" variant="destructive" size="default" leftIcon={<Trash2 size={14} />} onClick={() => setShowDeleteModal(true)}>
            Delete
          </Button>
        )}
        <Button type="button" variant="secondary" size="default" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="default"
          size="default"
          leftIcon={<Save size={14} />}
          disabled={!formData.product_name || saveBOM.isPending}
          loading={saveBOM.isPending}
          loadingText="Saving..."
          onClick={handleSave}
        >
          Save BOM
        </Button>
      </div>

      {/* ─── Import BOQ Modal ─── */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowImportModal(false)}>
          <div className="bg-white" style={{ borderRadius: '16px', padding: '28px', maxWidth: '520px', width: '90%', boxShadow: '0 25px 60px rgba(15,23,42,0.2)' }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: 0 }}>Import BOQ from Excel</h3>
              <Button
                type="button"
                variant="secondary"
                size="icon-sm"
                onClick={() => setShowImportModal(false)}
                aria-label="Close"
              >
                <X size={16} />
              </Button>
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
              <Button
                onClick={() => setShowImportModal(false)}
                variant="secondary"
                size="sm"
              >
                Cancel
              </Button>
              <Button
                onClick={handleExcelImport}
                disabled={!importText.trim()}
                variant="default"
                size="sm"
              >
                Import
              </Button>
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
              <Button onClick={() => setShowDeleteModal(false)} disabled={deleteBOM.isPending}
                variant="secondary" size="sm">
                Cancel
              </Button>
              <Button onClick={() => deleteBOM.mutate(bomId!)} disabled={deleteBOM.isPending}
                loading={deleteBOM.isPending} loadingText="Deleting..."
                variant="destructive" size="sm">
                Delete BOM
              </Button>
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
