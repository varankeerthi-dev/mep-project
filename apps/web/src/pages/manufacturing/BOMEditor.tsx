import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, ChevronDown, ChevronRight, MoreHorizontal, FileSpreadsheet, Upload, Search, GripVertical, Box, Percent, BarChart3, Copy, X } from 'lucide-react';
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
  custom_attributes?: Record<string, any>;
  unit_cost?: number;
  sequence_no?: number;
  work_center_id?: string | null;
  is_critical?: boolean;
  alternate_material_id?: string;
  drawing_reference?: string;
  inspection_required?: boolean;
  shelf_life_days?: number | null;
  scrap_factor?: number | null;
  yield_pct?: number | null;
  warehouse_id?: string | null;
  lead_time_unit?: string;
  percent?: number | null;
  qty_basis?: 'absolute' | 'percent';
};

const LEAD_TIME_UNITS = [
  { value: 'hours', label: 'Hours' },
  { value: 'days', label: 'Days' },
  { value: 'weeks', label: 'Weeks' },
];

/* ────────────────────────────────────────────────────────────────
   FormSelect — searchable portal dropdown, same UX as the Product
   dropdown (click to open, type to filter, portal overlay that
   escapes clipping/stacking contexts).
   ──────────────────────────────────────────────────────────────── */

type FormSelectOption = { value: string; label: string };

function FormSelect({
  value,
  onChange,
  options,
  placeholder = 'Select...',
}: {
  value: string;
  onChange: (value: string) => void;
  options: FormSelectOption[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const selectedLabel = options.find(o => o.value === value)?.label ?? value;

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.bom-form-select-container') && !target.closest('.bom-form-select-portal')) {
        setOpen(false);
      }
    };
    const handleScrollOrResize = (e?: Event) => {
      // Ignore scrolls coming from inside the dropdown portal itself,
      // otherwise scrolling the option list closes the dropdown.
      if (e && e.target instanceof Element && e.target.closest('.bom-form-select-portal')) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [open]);

  const filtered = options.filter(o =>
    !search || o.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="bom-form-select-container" style={{ position: 'relative', width: '100%' }}>
        <input
          type="text"
          className="form-input"
          style={{ cursor: 'pointer' }}
          value={open ? search : selectedLabel}
          onChange={(e) => {
            setSearch(e.target.value);
            const rect = e.currentTarget.getBoundingClientRect();
            setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
            setOpen(true);
          }}
          onFocus={(e) => {
            setSearch('');
            const rect = e.currentTarget.getBoundingClientRect();
            setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
            setOpen(true);
          }}
          placeholder={placeholder}
          readOnly={false}
        />
        <ChevronDown size={14} style={{
          position: 'absolute',
          right: 10,
          top: '50%',
          transform: 'translateY(-50%)',
          pointerEvents: 'none',
          color: '#64748B',
        }} />
      </div>
      {open && pos && createPortal(
        <div className="bom-form-select-portal" style={{
          position: 'fixed',
          top: pos.top,
          left: pos.left,
          width: pos.width,
          zIndex: 9999,
          background: '#fff',
          border: '1px solid #E2E8F0',
          borderRadius: '10px',
          boxShadow: '0 12px 36px rgba(15,23,42,0.12)',
          maxHeight: '220px',
          overflowY: 'auto',
          padding: '4px',
        }}>
          {filtered.map(o => (
            <div key={o.value}
              style={{
                padding: '10px 12px',
                cursor: 'pointer',
                fontSize: '13px',
                borderRadius: '8px',
                fontWeight: o.value === value ? 600 : 400,
                color: o.value === value ? '#0F172A' : '#334155',
                background: o.value === value ? '#F0F7FF' : 'transparent',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#F0F7FF'}
              onMouseLeave={e => e.currentTarget.style.background = o.value === value ? '#F0F7FF' : 'transparent'}
              onClick={() => { onChange(o.value); setOpen(false); setSearch(''); }}
            >
              {o.label}
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: '12px', fontSize: '12px', color: '#94A3B8', fontStyle: 'italic', textAlign: 'center' }}>No options found</div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}

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
    specification: '',
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
    { id: crypto.randomUUID(), material_id: '', material_name: '', required_qty: 0, unit: 'kg', wastage_pct: 5, notes: '', lead_time_days: 0, bom_level: 0, parent_material_id: null, custom_attributes: {}, unit_cost: 0, sequence_no: 0, is_critical: false, inspection_required: false, shelf_life_days: null, scrap_factor: null, yield_pct: null, percent: null, qty_basis: 'absolute' }
  ]);
  const [expandedRowIds, setExpandedRowIds] = useState<Record<string, boolean>>({});
  const [activeDetailRowId, setActiveDetailRowId] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [activeActionMenuRowId, setActiveActionMenuRowId] = useState<string | null>(null);
  const [actionMenuPos, setActionMenuPos] = useState<{ top: number; left: number } | null>(null);

  const [materialSearchText, setMaterialSearchText] = useState<Record<number, string>>({});
  const [openDropdownIndex, setOpenDropdownIndex] = useState<number>(-1);
  const [materialDropdownPos, setMaterialDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [productSearchText, setProductSearchText] = useState('');
  const [openProductDropdown, setOpenProductDropdown] = useState(false);
  const [productDropdownPos, setProductDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);

  const materialSearchRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.material-dropdown-container') && !target.closest('.material-dropdown-portal')) {
        setOpenDropdownIndex(-1);
      }
      if (!target.closest('.action-menu-container') && !target.closest('.action-menu-portal')) {
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
    const handleScrollOrResize = (e?: Event) => {
      if (e && e.target instanceof Element && e.target.closest('.product-dropdown-portal')) return;
      setOpenProductDropdown(false);
    };
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
        specification: bomDetail.header.specification || '',
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
          percent: item.percent ?? null,
          qty_basis: item.qty_basis || 'absolute',
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
    if (!formData.product_id) {
      toast.error('Product is required');
      return;
    }
    if (!formData.output_qty || formData.output_qty <= 0) {
      toast.error('Output quantity is required');
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
      specification: formData.specification?.trim() || null,
      product_code: formData.product_code || '',
      bom_type: formData.bom_type,
      product_category: formData.product_category,
      priority: formData.priority,
      effective_date: formData.effective_date || null,
      valid_to: formData.valid_to || null,
      created_by_name: formData.created_by_name || (user as any)?.name || user.email || '',
      approved_by_name: formData.approval_status === 'approved' && !formData.approved_by_name
        ? ((user as any)?.name || user.email || '')
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
      bom_level: 0,
      custom_attributes: {},
      unit_cost: 0,
      sequence_no: prev.length,
      is_critical: false,
      inspection_required: false,
      shelf_life_days: null,
      scrap_factor: null,
      yield_pct: null,
      percent: null,
      qty_basis: 'absolute'
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
      bom_level: (prev.find(i => i.id === parentId)?.bom_level ?? 0) + 1,
      custom_attributes: {},
      unit_cost: 0,
      sequence_no: 0,
      is_critical: false,
      inspection_required: false,
      shelf_life_days: null,
      scrap_factor: null,
      yield_pct: null,
      percent: null,
      qty_basis: 'absolute'
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
        yield_pct: source.yield_pct || null,
        percent: source.percent ?? null
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

  const toggleRowBasis = (item: BOMItem) => {
    if (item.qty_basis === 'percent') {
      updateItemById(item.id!, 'qty_basis', 'absolute');
    } else {
      const oq = formData.output_qty || 0;
      updateItemById(item.id!, 'qty_basis', 'percent');
      updateItemById(item.id!, 'percent', oq > 0 ? Math.round(((item.required_qty || 0) / oq) * 10000) / 100 : 0);
    }
  };

  const handleMaterialSelect = (id: string, materialId: string) => {
    if (items.some(i => i.id !== id && i.material_id === materialId)) {
      toast.error('This material is already in the BOM. Edit its quantity on the existing row instead.');
      return;
    }
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
          parent_material_id: null,
          bom_level: 0
        });
      }
    });
    
    if (importedItems.length > 0) {
      const existingIds = new Set(items.map(i => i.material_id).filter(Boolean));
      const seenIds = new Set<string>();
      const uniqueItems = importedItems.filter(it => {
        if (!it.material_id || existingIds.has(it.material_id) || seenIds.has(it.material_id)) return false;
        seenIds.add(it.material_id);
        return true;
      });
      const skipped = importedItems.length - uniqueItems.length;
      const additions = uniqueItems.length;
      if (additions > 0) {
        setItems(prev => {
          if (prev.length === 1 && !prev[0].material_id && prev[0].required_qty === 0) {
            return uniqueItems;
          }
          return [...prev, ...uniqueItems];
        });
      }
      if (skipped > 0) {
        toast.warning(`${additions} material${additions !== 1 ? 's' : ''} imported, ${skipped} duplicate${skipped !== 1 ? 's' : ''} skipped.`);
      } else {
        toast.success(`Successfully imported ${additions} material${additions !== 1 ? 's' : ''}.`);
      }
    } else {
      toast.error('No valid materials parsed. Verify format: Name [tab] Qty');
    }
    
    setImportText('');
    setShowImportModal(false);
  };

  const materialCount = items.filter(i => i.material_id).length;

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
        .bom-editor-page-container .entry-field-container-5px label {
          margin-bottom: 8px !important;
        }
        .bom-editor-page-container input:not(.form-input):not(.form-select),
        .bom-editor-page-container select:not(.form-input):not(.form-select),
        .bom-editor-page-container textarea:not(.form-input):not(.form-select) {
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
      <div className="form-card">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-slate-600 border-b border-slate-100 pb-2 pt-4 px-5">
          1. BOM Details
        </h3>
        <div className="p-4 pt-5">
          <div className="form-row">
            <div className="form-group md:col-span-6">
              <label className="form-label">Product <span style={{ color: '#DC2626' }}>*</span></label>
              <div className="product-dropdown-container" style={{ position: 'relative', width: '100%' }}>
                <input type="text" className="form-input" style={{ cursor: 'pointer' }} value={openProductDropdown ? productSearchText : formData.product_name}
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
            </div>

            <div className="form-group md:col-span-6">
              <label className="form-label">BOM Code</label>
              <div className="flex items-center gap-2">
                <input type="text" className="form-input flex-1 min-w-0" value={formData.bom_code} onChange={(e) => setFormData({ ...formData, bom_code: e.target.value })} placeholder="Auto-generated if empty" />
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
            </div>

            <div className="form-group md:col-span-3">
              <label className="form-label">Revision</label>
              <input type="text" className="form-input" value={formData.revision} onChange={(e) => setFormData({ ...formData, revision: e.target.value })} placeholder="A" />
            </div>

            <div className="form-group md:col-span-3">
              <label className="form-label">Product Code / SKU</label>
              <input type="text" className="form-input" value={formData.product_code} onChange={(e) => setFormData({ ...formData, product_code: e.target.value })} placeholder="Optional part number" />
            </div>

            <div className="form-group md:col-span-3">
              <label className="form-label">Specification</label>
              <input type="text" className="form-input" value={formData.specification} onChange={(e) => setFormData({ ...formData, specification: e.target.value })} placeholder="e.g. Heavy-duty, Food-grade" />
            </div>

            <div className="form-group md:col-span-6">
              <label className="form-label">Output <span style={{ color: '#DC2626' }}>*</span></label>
              <div className="form-split-fields">
                <input type="number" className="form-input" value={formData.output_qty} onChange={(e) => {
                  const v = Number(e.target.value);
                  setFormData({ ...formData, output_qty: v });
                  setItems(prev => prev.map(it => it.qty_basis === 'percent'
                    ? { ...it, required_qty: Math.round(((it.percent || 0) / 100) * v * 10000) / 10000 }
                    : it
                  ));
                }} />
                <FormSelect
                  value={formData.output_unit}
                  onChange={(v) => setFormData({ ...formData, output_unit: v })}
                  options={unitOptions}
                  placeholder="Unit..."
                />
              </div>
            </div>

            <div className="form-group md:col-span-4">
              <label className="form-label">Batch No</label>
              <input type="text" className="form-input" value={formData.batch_no} onChange={(e) => setFormData({ ...formData, batch_no: e.target.value })} placeholder="Optional batch/lot identifier" />
            </div>

            <div className="form-group md:col-span-4">
              <label className="form-label">BOM Type <span style={{ color: '#DC2626' }}>*</span></label>
              <FormSelect
                value={formData.bom_type}
                onChange={(v) => setFormData({ ...formData, bom_type: v })}
                options={[
                  { value: 'assembly', label: 'Assembly (MBOM)' },
                  { value: 'repetitive', label: 'Repetitive' },
                  { value: 'formula', label: 'Formula / Process' },
                ]}
                placeholder="Select type..."
              />
            </div>

            <div className="form-group md:col-span-4">
              <label className="form-label">Product Category <span style={{ color: '#DC2626' }}>*</span></label>
              <FormSelect
                value={formData.product_category}
                onChange={(v) => setFormData({ ...formData, product_category: v })}
                options={[
                  { value: 'standard', label: 'Standard' },
                  { value: 'custom', label: 'Custom Order' },
                  { value: 'prototype', label: 'Prototype' },
                ]}
                placeholder="Select category..."
              />
            </div>

            <div className="form-group md:col-span-4">
              <label className="form-label">Priority <span style={{ color: '#DC2626' }}>*</span></label>
              <FormSelect
                value={formData.priority}
                onChange={(v) => setFormData({ ...formData, priority: v })}
                options={[
                  { value: 'low', label: 'Low' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'high', label: 'High' },
                  { value: 'critical', label: 'Critical' },
                ]}
                placeholder="Select priority..."
              />
            </div>

            <div className="form-group md:col-span-4">
              <label className="form-label">Effective Date</label>
              <input type="date" className="form-input" value={formData.effective_date} onChange={(e) => setFormData({ ...formData, effective_date: e.target.value })} />
            </div>

            <div className="form-group md:col-span-4">
              <label className="form-label">Valid To</label>
              <input type="date" className="form-input" value={formData.valid_to} onChange={(e) => setFormData({ ...formData, valid_to: e.target.value })} />
            </div>
          </div>
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
      <div className="form-card">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-slate-600 border-b border-slate-100 pb-2 pt-4 px-5">
          2. Options
        </h3>
        <div className="p-4 pt-5">
          <div className="form-row">
            <div className="form-group md:col-span-3">
              <label className="form-label">Status</label>
              <Button onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                variant="ghost" size="sm"
                className={`rounded-full px-3.5 text-xs font-semibold ${formData.is_active ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}>
                {formData.is_active ? 'Active' : 'Inactive'}
              </Button>
            </div>

            <div className="form-group md:col-span-3">
              <label className="form-label">Approval <span style={{ color: '#DC2626' }}>*</span></label>
              <FormSelect
                value={formData.approval_status}
                onChange={(v) => setFormData({ ...formData, approval_status: v })}
                options={[
                  { value: 'draft', label: 'Draft' },
                  { value: 'pending_approval', label: 'Pending Approval' },
                  { value: 'approved', label: 'Approved' },
                  { value: 'obsolete', label: 'Obsolete' },
                ]}
                placeholder="Select status..."
              />
            </div>

            <div className="form-group md:col-span-3">
              <label className="form-label">Created By</label>
              <input type="text" className="form-input form-input-muted" value={formData.created_by_name} readOnly />
            </div>

            <div className="form-group md:col-span-3">
              <label className="form-label">Approved By</label>
              <input type="text" className="form-input form-input-muted" value={formData.approved_by_name} readOnly />
            </div>
          </div>
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
                  3. Materials
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
                Define materials needed. Click "Costing" to set prices, scrap & supply details.
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
                minWidth: '620px',
              }}> 
                <thead>
                  <tr style={{ background: '#FAFBFC', borderBottom: '1px solid #F1F5F9' }}>
                    <th style={{ width: '36px', padding: '0 8px', height: '40px', textAlign: 'center' }}></th>
                    <th style={{ padding: '0 16px', height: '40px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Item</th>
                    <th style={{ width: '100px', padding: '0 12px', height: '40px', textAlign: 'right', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Material</th>
                    <th style={{ width: '64px', padding: '0 6px', height: '40px', textAlign: 'center', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Basis</th>
                    <th style={{ width: '90px', padding: '0 8px', height: '40px', textAlign: 'right', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Qty</th>
                    <th style={{ width: '80px', padding: '0 12px', height: '40px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Unit</th>
                    <th style={{ width: '64px', padding: '0 8px', height: '40px' }}></th>
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
                        height: '52px',
                        transition: 'background 150ms ease',
                        background: isHovered ? '#F8FAFC' : 'transparent',
                        animation: `fadeInRow 200ms ease-out ${idx * 30}ms both`,
                      }}
                    >
                      

                      {/* Material Cell */}
                      <td colSpan={3} style={{ padding: '0 8px', verticalAlign: 'middle' }}>
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

                          {/* Search / Name Display */}
                            <div className="material-dropdown-container" style={{ flex: 1, minWidth: 0, position: 'relative' }}>
                              <input
                                ref={el => { materialSearchRefs.current[item.id!] = el; }}
                                type="text"
                                value={openDropdownIndex === items.findIndex(i => i.id === item.id) ? (materialSearchText[items.findIndex(i => i.id === item.id)] ?? '') : (item.material_name || '')}
                                onChange={(e) => {
                                  const idx = items.findIndex(i => i.id === item.id);
                                  setMaterialSearchText(prev => ({ ...prev, [idx]: e.target.value }));
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setMaterialDropdownPos({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 260) });
                                  setOpenDropdownIndex(idx);
                                }}
                                onFocus={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setMaterialDropdownPos({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 260) });
                                  setOpenDropdownIndex(items.findIndex(i => i.id === item.id));
                                }}                                  placeholder="Search material..."
                                style={{
                                  width: '100%',
                                  height: '34px',
                                  padding: '0 12px',
                                  fontSize: '13px',
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

                              {/* Dropdown — portal overlay so it escapes the table's overflow clipping */}
                              {openDropdownIndex === items.findIndex(i => i.id === item.id) && materialDropdownPos && materials && createPortal(
                                <div className="material-dropdown-portal" style={{
                                  position: 'fixed',
                                  top: materialDropdownPos.top,
                                  left: materialDropdownPos.left,
                                  width: materialDropdownPos.width,
                                  zIndex: 9999, background: '#fff',
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
                                          padding: '8px 12px',
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
                                </div>,
                                document.body
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
                      </td>
                      {/* Basis — Qty vs % of batch */}
                      <td style={{ padding: '0 6px', verticalAlign: 'middle' }}>
                        <button
                          type="button"
                          onClick={() => toggleRowBasis(item)}
                          title={item.qty_basis === 'percent' ? '% of batch — click to use fixed quantity' : 'Fixed quantity — click to use % of batch'}
                          style={{
                            width: '100%', padding: '7px 4px',
                            fontSize: '11px', fontWeight: 600,
                            borderRadius: '6px', cursor: 'pointer',
                            border: item.qty_basis === 'percent' ? '1px solid #BFDBFE' : '1px solid #E2E8F0',
                            background: item.qty_basis === 'percent' ? '#EFF6FF' : '#F8FAFC',
                            color: item.qty_basis === 'percent' ? '#2563EB' : '#475569',
                            transition: 'all 0.15s',
                          }}
                        >
                          {item.qty_basis === 'percent' ? '%' : 'Qty'}
                        </button>
                      </td>
                      {/* Quantity */}
                      <td style={{ padding: '0 8px', verticalAlign: 'middle' }}>
                        {item.qty_basis === 'percent' ? (
                          <div>
                            <input
                              type="number"
                              value={item.percent ?? ''}
                              onChange={(e) => {
                                const p = Number(e.target.value);
                                updateItemById(item.id!, 'percent', p);
                                updateItemById(item.id!, 'required_qty', Math.round((p / 100) * (formData.output_qty || 0) * 10000) / 10000);
                              }}
                              placeholder="0"
                              style={{
                                width: '60px', height: '34px', padding: '0 6px',
                                fontSize: '13px', fontWeight: 500, color: '#0F172A',
                                background: '#F8FAFC', border: '1px solid #E2E8F0',
                                borderRadius: '6px', textAlign: 'right', outline: 'none',
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            />
                            <div style={{ fontSize: '9px', color: '#94A3B8', marginTop: '2px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                              = {item.required_qty || 0} {item.unit}
                            </div>
                          </div>
                        ) : (
                          <input
                            type="number"
                            value={item.required_qty || ''}
                            onChange={(e) => updateItemById(item.id!, 'required_qty', Number(e.target.value))}
                            placeholder="0"
                            style={{
                              width: '60px', height: '34px', padding: '0 6px',
                              fontSize: '13px', fontWeight: 500, color: '#0F172A',
                              background: '#F8FAFC', border: '1px solid #E2E8F0',
                              borderRadius: '6px', textAlign: 'right', outline: 'none',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          />
                        )}
                      </td>
                      {/* Unit */}
                      <td style={{ padding: '0 8px', verticalAlign: 'middle' }}>
                        <div>
                          <FormSelect
                            value={item.unit}
                            onChange={(v) => updateItemById(item.id!, 'unit', v)}
                            options={unitOptions}
                            placeholder="Unit"
                          />
                          {item.qty_basis === 'percent' && item.unit !== formData.output_unit && (
                            <div style={{ fontSize: '9px', color: '#D97706', marginTop: '2px', whiteSpace: 'nowrap' }}>
                              ≠ batch unit ({formData.output_unit})
                            </div>
                          )}
                        </div>
                      </td>


                       
{/* Actions — 3-dot menu + Delete on hover */}
                      <td style={{ padding: '0 8px', verticalAlign: 'middle', position: 'relative' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', opacity: isHovered || activeActionMenuRowId === item.id ? 1 : 0, transition: 'opacity 0.15s' }}>
                          {/* 3-Dot Menu */}
                          <div className="action-menu-container" style={{ position: 'relative' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setActionMenuPos({ top: rect.bottom + 4, left: rect.right });
                                setActiveActionMenuRowId(activeActionMenuRowId === item.id ? null : item.id!);
                              }}
                              style={{
                                width: '28px', height: '28px', borderRadius: '6px',
                                border: 'none', background: activeActionMenuRowId === item.id ? '#F1F5F9' : 'transparent',
                                color: '#94A3B8',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.15s',
                              }}
                              title="More actions"
                            >
                              <MoreHorizontal size={16} />
                            </button>
                            {activeActionMenuRowId === item.id && actionMenuPos && createPortal(
                              <div className="action-menu-portal" style={{
                                position: 'fixed', top: actionMenuPos.top, left: actionMenuPos.left,
                                transform: 'translateX(-100%)',
                                zIndex: 999, background: '#fff', border: '1px solid #E2E8F0',
                                borderRadius: '10px', boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
                                padding: '4px', minWidth: '180px', animation: 'scaleIn 150ms ease-out',
                              }}>
                                <button type="button" onClick={() => { setActiveDetailRowId(activeDetailRowId === item.id ? null : item.id!); setActiveActionMenuRowId(null); }}
                                  style={{ width: '100%', padding: '6px 10px', fontSize: '12px', fontWeight: 500, color: '#2563EB', background: activeDetailRowId === item.id ? '#EFF6FF' : 'none', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left' }}
                                  onMouseEnter={e => { if (activeDetailRowId !== item.id) e.currentTarget.style.background = '#F3F4F6'; }}
                                  onMouseLeave={e => { if (activeDetailRowId !== item.id) e.currentTarget.style.background = 'none'; }}>
                                  <BarChart3 size={13} /> Costing & Details
                                </button>
                                <div style={{ height: '1px', background: '#F1F5F9', margin: '3px 6px' }} />
                                <button type="button" onClick={() => { addSubMaterial(item.id!); setActiveActionMenuRowId(null); }}
                                  style={{ width: '100%', padding: '6px 10px', fontSize: '12px', fontWeight: 500, color: '#374151', background: 'none', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left' }}
                                  onMouseEnter={e => e.currentTarget.style.background = '#F3F4F6'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                                  <Plus size={13} /> Add Sub-material
                                </button>
                                <button type="button" onClick={() => { duplicateItem(item.id!); setActiveActionMenuRowId(null); }}
                                  style={{ width: '100%', padding: '6px 10px', fontSize: '12px', fontWeight: 500, color: '#374151', background: 'none', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left' }}
                                  onMouseEnter={e => e.currentTarget.style.background = '#F3F4F6'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                                  <Copy size={13} /> Duplicate
                                </button>
                                <div style={{ height: '1px', background: '#F1F5F9', margin: '3px 6px' }} />
                                <button type="button" onClick={() => { removeItem(item.id!); setActiveActionMenuRowId(null); }}
                                  disabled={items.length <= 1}
                                  style={{ width: '100%', padding: '6px 10px', fontSize: '12px', fontWeight: 500, color: '#EF4444', background: 'none', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left', opacity: items.length <= 1 ? 0.4 : 1 }}
                                  onMouseEnter={e => e.currentTarget.style.background = '#FEF2F2'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                                  <Trash2 size={13} /> Delete
                                 </button>
                              </div>,
                              document.body
                            )}
                          </div>
                          {/* Delete X */}
                          <button
                            type="button"
                            onClick={() => removeItem(item.id!)}
                            disabled={items.length <= 1}
                            style={{
                              width: '24px', height: '24px', borderRadius: '50%',
                              border: 'none', background: 'transparent',
                              color: '#CBD5E1', cursor: 'pointer', display: 'flex',
                              alignItems: 'center', justifyContent: 'center',
                              transition: 'all 0.15s', opacity: isHovered ? 1 : 0,
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#FEE2E2'; e.currentTarget.style.color = '#EF4444'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#CBD5E1'; }}
                            title="Remove material"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </td>                    </tr>
                  );
                })}
                
                {items.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{
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
              {items.some(i => i.qty_basis === 'percent') && (() => {
                const totalPct = items.filter(i => i.qty_basis === 'percent').reduce((s, i) => s + (i.percent || 0), 0);
                const balanced = Math.abs(totalPct - 100) < 0.01;
                return (
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Σ Percent </span>
                    <span style={{ fontSize: '15px', fontWeight: 700, color: balanced ? '#059669' : '#D97706', fontVariantNumeric: 'tabular-nums', marginLeft: '6px' }}>
                      {Math.round(totalPct * 100) / 100}%{balanced ? '' : ' · target 100%'}
                    </span>
                  </div>
                );
              })()}
            </div>
          </div>

                    {/* ─── Detail Tray (Costing & Details — Expanded Row) ─── */}
          {getFlattenedTree().map((item) => {
            if (activeDetailRowId !== item.id) return null;
            return (
              <div key={`detail-${item.id}`} style={{
                background: '#F8FBFF',
                borderTop: '1px solid #F1F5F9',
                padding: '16px 28px 16px 84px',
                animation: 'slideDown 200ms ease-out',
              }}>
                {/* Section Title */}
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#2563EB', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2563EB' }} />
                  Costing & Details — {item.material_name || 'Material'}
                </div>

                {/* Row 1: Unit Cost, Scrap %, Yield %, Lead Time */}
                <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '140px', maxWidth: '180px' }}>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>Unit Cost (₹)</label>
                    <input type="number" min="0" step="0.01"
                      value={item.unit_cost ?? ''}
                      onChange={(e) => updateItemById(item.id!, 'unit_cost', parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      style={{ width: '100%', height: '36px', padding: '0 10px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '12px', color: '#0F172A', outline: 'none', transition: 'border-color 0.15s', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: '120px', maxWidth: '150px' }}>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>Scrap %</label>
                    <input type="number" min="0" max="100"
                      value={item.wastage_pct || ''}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        updateItemById(item.id!, 'wastage_pct', val);
                        updateItemById(item.id!, 'scrap_factor', val);
                        updateItemById(item.id!, 'yield_pct', Math.max(0, 100 - val));
                      }}
                      placeholder="5"
                      style={{ width: '100%', height: '36px', padding: '0 10px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '12px', color: '#0F172A', outline: 'none', transition: 'border-color 0.15s', textAlign: 'center' }}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: '120px', maxWidth: '150px' }}>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>Yield %</label>
                    <input type="number" min="0" max="100"
                      value={item.yield_pct ?? ''}
                      onChange={(e) => updateItemById(item.id!, 'yield_pct', Number(e.target.value))}
                      placeholder="95"
                      style={{ width: '100%', height: '36px', padding: '0 10px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '12px', color: '#0F172A', outline: 'none', transition: 'border-color 0.15s', textAlign: 'center' }}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: '160px', maxWidth: '220px' }}>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>Lead Time</label>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <input type="number" min="0"
                        value={item.lead_time_days || ''}
                        onChange={(e) => updateItemById(item.id!, 'lead_time_days', Math.max(0, parseInt(e.target.value) || 0))}
                        placeholder="0"
                        style={{ ...{ width: '100%', height: '36px', padding: '0 10px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '12px', color: '#0F172A', outline: 'none', transition: 'border-color 0.15s' }, flex: 1 }}
                      />
                      <FormSelect
                        value={item.lead_time_unit || 'days'}
                        onChange={(v) => updateItemById(item.id!, 'lead_time_unit', v)}
                        options={LEAD_TIME_UNITS}
                        placeholder="—"
                      />
                    </div>
                  </div>
                </div>

                {/* Row 2: Work Center, Critical, Alternate, Warehouse */}
                <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '160px', maxWidth: '200px' }}>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>Work Center</label>
                    <FormSelect
                      value={item.work_center_id || ''}
                      onChange={(v) => updateItemById(item.id!, 'work_center_id', v || null)}
                      options={[{ value: '', label: '—' }, ...(workCenters || []).map(wc => ({ value: wc.id, label: wc.name }))]}
                      placeholder="—"
                    />
                  </div>
                  <div style={{ minWidth: '100px', maxWidth: '120px' }}>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>Critical?</label>
                    <button type="button"
                      onClick={() => updateItemById(item.id!, 'is_critical', !item.is_critical)}
                      style={{
                        width: '100%', height: '36px',
                        border: '1px solid ' + (item.is_critical ? '#F59E0B' : '#E2E8F0'),
                        borderRadius: '8px',
                        background: item.is_critical ? '#FFFBEB' : '#F8FAFC',
                        color: item.is_critical ? '#B45309' : '#94A3B8',
                        fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      {item.is_critical ? 'Yes' : 'No'}
                    </button>
                  </div>
                  <div style={{ flex: 1, minWidth: '160px', maxWidth: '220px' }}>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>Alternate Material</label>
                    <FormSelect
                      value={item.alternate_material_id || ''}
                      onChange={(v) => updateItemById(item.id!, 'alternate_material_id', v || null)}
                      options={[{ value: '', label: 'None' }, ...(materials || []).filter(m => m.id !== item.material_id).map(m => ({ value: m.id, label: m.name }))]}
                      placeholder="None"
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: '160px', maxWidth: '200px' }}>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>Warehouse</label>
                    <FormSelect
                      value={item.warehouse_id || ''}
                      onChange={(v) => updateItemById(item.id!, 'warehouse_id', v || null)}
                      options={[{ value: '', label: '—' }, ...(warehouses || []).map(w => ({ value: w.id, label: w.name }))]}
                      placeholder="—"
                    />
                  </div>
                </div>

                {/* Row 3: Drawing Ref, Inspect, Shelf Life, Discount Category, Brand */}
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '140px', maxWidth: '180px' }}>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>Drawing Ref</label>
                    <input type="text"
                      value={item.drawing_reference || ''}
                      onChange={(e) => updateItemById(item.id!, 'drawing_reference', e.target.value)}
                      placeholder="e.g. DWG-001"
                      style={{ width: '100%', height: '36px', padding: '0 10px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '12px', color: '#0F172A', outline: 'none', transition: 'border-color 0.15s' }}
                    />
                  </div>
                  <div style={{ minWidth: '90px', maxWidth: '110px' }}>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>Inspect?</label>
                    <div style={{ height: '36px', display: 'flex', alignItems: 'center', paddingLeft: '4px' }}>
                      <input type="checkbox"
                        checked={item.inspection_required || false}
                        onChange={(e) => updateItemById(item.id!, 'inspection_required', e.target.checked)}
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '11px', color: '#64748B', marginLeft: '6px' }}>Required</span>
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: '120px', maxWidth: '150px' }}>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>Shelf Life (days)</label>
                    <input type="number" min="0"
                      value={item.shelf_life_days ?? ''}
                      onChange={(e) => updateItemById(item.id!, 'shelf_life_days', e.target.value ? parseInt(e.target.value) : null)}
                      placeholder="—"
                      style={{ width: '100%', height: '36px', padding: '0 10px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '12px', color: '#0F172A', outline: 'none', transition: 'border-color 0.15s', textAlign: 'right' }}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: '160px', maxWidth: '200px' }}>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>Discount Category</label>
                    {(() => {
                      const variants = getVariantsForMaterial(item.material_id);
                      if (!variants.length) {
                        return <div style={{ fontSize: '12px', color: '#94A3B8', padding: '8px 0' }}>—</div>;
                      }
                      return (
                        <FormSelect
                          value={item.company_variant_id || ''}
                          onChange={(vId) => {
                            const vName = vId ? getVariantName(vId) : '';
                            updateItemById(item.id!, 'company_variant_id', vId || '');
                            updateItemById(item.id!, 'variant_name', vName);
                          }}
                          options={[{ value: '', label: 'No Category' }, ...variants.map(v => ({ value: v.company_variant_id, label: getVariantName(v.company_variant_id) }))]}
                          placeholder="No Category"
                        />
                      );
                    })()}
                  </div>
                  <div style={{ flex: 1, minWidth: '140px', maxWidth: '180px' }}>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>Brand</label>
                    <FormSelect
                      value={item.make || ''}
                      onChange={(v) => updateItemById(item.id!, 'make', v)}
                      options={[{ value: '', label: '—' }, ...brandOptions.map(b => ({ value: b, label: b }))]}
                      placeholder="—"
                    />
                  </div>
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
      <div className="form-footer">
        <div className="form-btn-group">
          {bomId && (
            <button type="button" className="form-btn form-btn-secondary" onClick={() => setShowDeleteModal(true)}>
              Delete
            </button>
          )}
          <button type="button" className="form-btn form-btn-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="form-btn form-btn-primary"
            disabled={!formData.product_name || saveBOM.isPending}
            onClick={handleSave}
          >
            {saveBOM.isPending ? 'Saving...' : 'Save BOM'}
          </button>
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
