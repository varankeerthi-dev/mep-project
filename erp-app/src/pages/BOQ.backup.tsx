import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Save, FileDown, Plus, Trash2, Sheet, Table, X, Settings, FileSpreadsheet, Loader2, GripVertical } from 'lucide-react';
import { openSansRegular, openSansBold } from '../fonts/openSans';
import { saveBOQWithItems, fetchBOQById } from '../api';
import { timedSupabaseQuery, withTimeout } from '../utils/queryTimeout';
import BoqRowComponent, { BoqRowProps } from './BoqRowComponent';
import { 
  BoqFormData, ClientOption, ProjectOption, VariantOption, MaterialOption, 
  DiscountEntry, DiscountMap, BoqSheet, BoqRow, ItemsBySheet, ColumnSetting, 
  PendingDiscountChange, LoadedBoqHeader, BoqInitData, BoqRowProps as BoqRowPropsType 
} from '../types/boq';

const generateId = () => `temp-${Math.random().toString(36).substr(2, 9)}`;
const DEFAULT_TERMS = [
  'All prices are inclusive of applicable taxes unless specified otherwise.',
  'Delivery timeline will be confirmed after order acceptance.',
  'Payment terms: 50% advance, balance within 7 days of delivery.',
  'Warranty as per manufacturer standard terms.',
  'Any variation in quantities will be billed as per actuals.',
  'Freight and handling charges are extra unless specified.',
  'Offer valid for 15 days from the BOQ date.'
].map((t, i) => `${i + 1}. ${t}`).join('\n');
const getColumnLabel = (index) => {
  let label = '';
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
};

const DEFAULT_COLUMNS = [
  { key: 'rowControl', label: '', width: 40, visible: true },
  { key: 'sno', label: 'S.No', width: 50, visible: true },
  { key: 'hsn_sac', label: 'HSN/SAC', width: 90, visible: true },
  { key: 'description', label: 'Description', width: 250, visible: true },
  { key: 'variant', label: 'Variant', width: 100, visible: true },
  { key: 'make', label: 'Make', width: 100, visible: true },
  { key: 'quantity', label: 'Qty', width: 70, visible: true },
  { key: 'unit', label: 'Unit', width: 70, visible: true },
  { key: 'rate', label: 'Price', width: 100, visible: true },
  { key: 'discountPercent', label: 'Disc %', width: 70, visible: true },
  { key: 'rateAfterDiscount', label: 'Rate/Unit', width: 110, visible: true },
  { key: 'totalAmount', label: 'Total Amount', width: 120, visible: true },
  { key: 'specification', label: 'Specification', width: 150, visible: true },
  { key: 'remarks', label: 'Remarks', width: 120, visible: true },
  { key: 'pressure', label: 'Pressure', width: 80, visible: false },
  { key: 'thickness', label: 'Thickness', width: 80, visible: false },
  { key: 'schedule', label: 'Schedule', width: 80, visible: false },
  { key: 'material', label: 'Material', width: 100, visible: false },
];

const DEFAULT_SHEETS = [
  { id: generateId(), name: 'BOQ Sheet 1', isDefault: true },
  { id: generateId(), name: 'Terms', isDefault: false },
  { id: generateId(), name: 'Preface', isDefault: false },
];

type BoqFormData = {
  id: string | null;
  boqNo: string;
  revisionNo: number;
  date: string;
  clientId: string;
  projectId: string;
  variantId: string;
  status: string;
  termsConditions: string;
  preface: string;
};

type ClientOption = {
  id: string;
  client_name: string;
  discount_profile_id?: string | null;
  custom_discounts?: Record<string, number | string> | null;
};

type ProjectOption = {
  id: string;
  project_name?: string | null;
  name?: string | null;
};

type VariantOption = {
  id: string;
  variant_name: string;
};

type MaterialOption = {
  id: string;
  name: string;
  sale_price?: number | string | null;
  make?: string | null;
  hsn_code?: string | null;
  hsn?: string | null;
  hsn_sac?: string | null;
  unit?: string | null;
};

type DiscountEntry = {
  discount: number;
  variantName: string;
};

type DiscountMap = Record<string, DiscountEntry>;

type BoqSheet = {
  id: string;
  name: string;
  isDefault: boolean;
};

type BoqRow = {
  id: string;
  isHeaderRow: boolean;
  headerText?: string;
  itemId?: string;
  variantId?: string;
  variantName?: string;
  make?: string;
  quantity?: string | number;
  rate?: string | number;
  discountPercent?: string | number;
  hsn_sac?: string;
  unit?: string;
  specification?: string;
  remarks?: string;
  pressure?: string;
  thickness?: string;
  schedule?: string;
  material?: string;
  description?: string;
  isDirty?: boolean;  // Track if row has unsaved changes
  originalData?: string;  // Store original for comparison
};

type ItemsBySheet = Record<string, BoqRow[]>;

type ColumnSetting = {
  key: string;
  label: string;
  width: number;
  visible: boolean;
};

type PendingDiscountChange = {
  variantId: string;
  discount: number;
  prevDiscount: number;
} | null;

type LoadedBoqHeader = {
  id: string;
  boq_no?: string | null;
  revision_no?: number | null;
  boq_date?: string | null;
  client_id?: string | null;
  project_id?: string | null;
  variant_id?: string | null;
  status?: string | null;
  terms_conditions?: string | null;
  preface?: string | null;
  sheets?: Array<{
    id: string;
    sheet_name?: string | null;
    is_default?: boolean | null;
    sheet_order?: number | null;
    items?: Array<{
      id: string;
      is_header_row?: boolean | null;
      header_text?: string | null;
      item_id?: string | null;
      variant_id?: string | null;
      make?: string | null;
      quantity?: string | number | null;
      rate?: string | number | null;
      discount_percent?: string | number | null;
      specification?: string | null;
      remarks?: string | null;
      pressure?: string | null;
      thickness?: string | null;
      schedule?: string | null;
      material?: string | null;
      row_order?: number | null;
    }>;
  }>;
};

type BoqInitData = {
  clients: ClientOption[];
  projects: ProjectOption[];
  variants: VariantOption[];
  materials: MaterialOption[];
  header: LoadedBoqHeader | null;
  newBoqNo: string | null;
};

export function BOQ() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { organisation } = useAuth();
  const editId = searchParams.get('editId');
  const [boqData, setBoqData] = useState<BoqFormData>({
    id: null,
    boqNo: '',
    revisionNo: 1,
    date: new Date().toISOString().split('T')[0],
    clientId: '',
    projectId: '',
    variantId: '',
    status: 'Draft',
    termsConditions: '',
    preface: '',
  });

  const [boqVariantDiscounts, setBoqVariantDiscounts] = useState<Record<string, number>>({});
  
  const [sheets, setSheets] = useState<BoqSheet[]>(DEFAULT_SHEETS);
  const [activeSheetId, setActiveSheetId] = useState(DEFAULT_SHEETS[0].id);
  
  const [items, setItems] = useState<ItemsBySheet>({});
  const [columnSettings, setColumnSettings] = useState<ColumnSetting[]>(DEFAULT_COLUMNS);
  const [showColumnPanel, setShowColumnPanel] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showExportSettings, setShowExportSettings] = useState(false);
  const [exportColumns, setExportColumns] = useState<Record<string, boolean>>({});
  const [exportSheets, setExportSheets] = useState<Record<string, boolean>>({});
  const [exportOrientation, setExportOrientation] = useState('landscape');
  const [saveError, setSaveError] = useState('');
  const [isSavingLocally, setIsSavingLocally] = useState(false);  // Optimistic UI - shows instantly
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [materialSearch, setMaterialSearch] = useState<Record<string, string>>({});
  const [materialSearchActive, setMaterialSearchActive] = useState<{ sheetId: string; index: number } | null>(null);
  const [dragRowIndex, setDragRowIndex] = useState<number | null>(null);
  const [dragSheetId, setDragSheetId] = useState<string | null>(null);
  const [editingSheetId, setEditingSheetId] = useState<string | null>(null);
  const [editingSheetName, setEditingSheetName] = useState('');
  const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null);
  const [showDiscountApplyModal, setShowDiscountApplyModal] = useState(false);
  const [pendingDiscountChange, setPendingDiscountChange] = useState<PendingDiscountChange>(null);
  const [discountApplyMode, setDiscountApplyMode] = useState('skip');
  
  // Stock Check modal state
  const [showStockCheckModal, setShowStockCheckModal] = useState(false);
  const [selectedSheets, setSelectedSheets] = useState<Record<string, boolean>>({});
  const [launchingStockCheck, setLaunchingStockCheck] = useState(false);

  const inputRefs = useRef<Record<string, HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null>>({});
  const prevDefaultVariantRef = useRef('');
  const undoStackRef = useRef<Record<string, BoqRow[][]>>({});
  const copiedRowRef = useRef<BoqRow | null>(null);
  const hydratedKeyRef = useRef<string | null>(null);

  const generateBoqNumber = useCallback(async () => {
    try {
      const result = await withTimeout(
        supabase.rpc('generate_boq_number'),
        15000,
        'BOQ number',
      );

      if (result.error) {
        throw new Error(result.error.message || 'Unable to generate BOQ number');
      }

      if (result.data) return result.data;
    } catch (error) {
      console.warn('Falling back to BOQ number timestamp.', error);
    }

    return `BOQ-${String(Date.now()).slice(-4)}`;
  }, []);

  const hydrateFromHeader = useCallback((header: LoadedBoqHeader | null) => {
    if (!header) return;

    setBoqData((prev) => ({
      ...prev,
      id: header.id,
      boqNo: header.boq_no || '',
      revisionNo: header.revision_no || 1,
      date: header.boq_date || prev.date,
      clientId: header.client_id || '',
      projectId: header.project_id || '',
      variantId: header.variant_id || '',
      status: header.status || 'Draft',
      termsConditions: header.terms_conditions || prev.termsConditions,
      preface: header.preface || prev.preface,
    }));

    const loadedSheets = (header.sheets || [])
      .slice()
      .sort((a, b) => (a.sheet_order || 0) - (b.sheet_order || 0))
      .map((sheet) => ({
        id: sheet.id,
        name: sheet.sheet_name || 'BOQ Sheet',
        isDefault: !!sheet.is_default,
      }));

    if (loadedSheets.length > 0) {
      setSheets(loadedSheets);
      setActiveSheetId(loadedSheets[0].id);
    }

    const itemsMap: ItemsBySheet = {};
    (header.sheets || []).forEach((sheet) => {
      const rows: BoqRow[] = (sheet.items || [])
        .slice()
        .sort((a, b) => (a.row_order || 0) - (b.row_order || 0))
        .map((item) => ({
          id: item.id,
          isHeaderRow: !!item.is_header_row,
          headerText: item.header_text || 'SECTION',
          itemId: item.item_id || '',
          variantId: item.variant_id || '',
          variantName: '',
          make: item.make || '',
          quantity: item.quantity || '',
          rate: item.rate || '',
          discountPercent: item.discount_percent || '',
          hsn_sac: '',
          unit: '',
          specification: item.specification || '',
          remarks: item.remarks || '',
          pressure: item.pressure || '',
          thickness: item.thickness || '',
          schedule: item.schedule || '',
          material: item.material || '',
          description: item.material || '',
        }));

      itemsMap[sheet.id] = rows;
    });
    setItems(itemsMap);
  }, []);

  const initQuery = useQuery<BoqInitData>({
    queryKey: ['boqInit', editId || 'new'],
    queryFn: async () => {
      const [clientsData, projectsData, variantsData, materialsData, headerOrBoqNo] = await Promise.all([
        timedSupabaseQuery(
          supabase.from('clients').select('id, client_name').order('client_name'),
          'BOQ clients',
        ),
        timedSupabaseQuery(
          supabase.from('projects').select('id, project_name, name').order('project_name'),
          'BOQ projects',
        ),
        timedSupabaseQuery(
          supabase.from('company_variants').select('id, variant_name').order('variant_name'),
          'BOQ variants',
        ),
        timedSupabaseQuery(
          supabase.from('materials').select('id, name, sale_price, make, hsn_code, unit').order('name'),
          'BOQ materials',
        ),
        editId
          ? withTimeout(fetchBOQById(editId), 15000, 'BOQ details')
          : generateBoqNumber(),
      ]);

      return {
        clients: (clientsData || []) as ClientOption[],
        projects: (projectsData || []) as ProjectOption[],
        variants: (variantsData || []) as VariantOption[],
        materials: (materialsData || []) as MaterialOption[],
        header: editId ? (headerOrBoqNo as LoadedBoqHeader) : null,
        newBoqNo: editId ? null : String(headerOrBoqNo || ''),
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  const clients = initQuery.data?.clients || [];
  const projects = initQuery.data?.projects || [];
  const variants = initQuery.data?.variants || [];
  const materials = initQuery.data?.materials || [];
  const makes = useMemo(
    () => [...new Set(materials.map((material) => material.make).filter(Boolean))],
    [materials],
  );

  const clientDiscountsQuery = useQuery<DiscountMap>({
    queryKey: ['boqClientDiscounts', boqData.clientId],
    enabled: !!boqData.clientId,
    queryFn: async () => {
      const client = await timedSupabaseQuery(
        supabase
          .from('clients')
          .select('id, discount_profile_id, custom_discounts')
          .eq('id', boqData.clientId)
          .single(),
        'BOQ client discount profile',
      );

      if (!client) return {};

      if (client.discount_profile_id) {
        const settings = await timedSupabaseQuery(
          supabase
            .from('discount_variant_settings')
            .select('variant_id, max_discount, variant:company_variants(variant_name)')
            .eq('structure_id', client.discount_profile_id),
          'BOQ discount settings',
        );

        const discountMap: DiscountMap = {};
        (settings || []).forEach((setting) => {
          if (!setting.variant_id) return;
          discountMap[setting.variant_id] = {
            discount: setting.max_discount || 0,
            variantName: setting.variant?.variant_name || '',
          };
        });
        return discountMap;
      }

      if (client.custom_discounts && typeof client.custom_discounts === 'object') {
        const discountMap: DiscountMap = {};
        Object.entries(client.custom_discounts).forEach(([variantId, discount]) => {
          const variantName = variants.find((variant) => variant.id === variantId)?.variant_name || '';
          discountMap[variantId] = {
            discount: typeof discount === 'number' ? discount : parseFloat(String(discount)) || 0,
            variantName,
          };
        });
        return discountMap;
      }

      return {};
    },
    staleTime: 5 * 60 * 1000,
  });

  const clientDiscounts = clientDiscountsQuery.data || {};

  useEffect(() => {
    const hydrationKey = editId || 'new';
    if (!initQuery.data || hydratedKeyRef.current === hydrationKey) return;

    if (initQuery.data.header) {
      hydrateFromHeader(initQuery.data.header);
    } else {
      setBoqData((prev) => ({
        ...prev,
        boqNo: prev.boqNo || initQuery.data.newBoqNo || '',
        termsConditions: prev.termsConditions || DEFAULT_TERMS,
      }));
    }

    hydratedKeyRef.current = hydrationKey;
  }, [editId, hydrateFromHeader, initQuery.data]);

  useEffect(() => {
    const key = boqData.boqNo ? `boq_export_${boqData.boqNo}` : null;
    if (!key) return;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed?.columns) setExportColumns(parsed.columns);
        if (parsed?.sheets) setExportSheets(parsed.sheets);
        if (parsed?.orientation) setExportOrientation(parsed.orientation);
      } catch {}
    }
  }, [boqData.boqNo]);

  useEffect(() => {
    const sheetSelection = {};
    sheets.forEach(s => {
      sheetSelection[s.id] = true;
    });
    setExportSheets(sheetSelection);
  }, [sheets]);

  useEffect(() => {
    const colSelection = {};
    columnSettings.forEach(c => {
      colSelection[c.key] = c.visible;
    });
    setExportColumns(colSelection);
  }, [columnSettings]);

  useEffect(() => {
    if (!items[activeSheetId]) {
      setItems(prev => ({ ...prev, [activeSheetId]: [] }));
    }
  }, [activeSheetId]);

  useEffect(() => {
    prevDefaultVariantRef.current = boqData.variantId;
  }, []);

  const handleClientChange = (clientId) => {
    setBoqData(prev => ({ ...prev, clientId }));
  };

  const handleVariantChange = (variantId) => {
    setBoqData(prev => ({ ...prev, variantId }));
  };

  const handleVariantDiscountChange = (variantId, value) => {
    const discount = parseFloat(value) || 0;
    const maxDiscount = clientDiscounts[variantId]?.discount || 100;
    
    if (discount > maxDiscount) {
      alert(`Maximum allowed discount is ${maxDiscount}%`);
      return;
    }

    const prevDiscount = getVariantDiscount(variantId);
    setPendingDiscountChange({ variantId, discount, prevDiscount });
    setDiscountApplyMode('skip');
    setShowDiscountApplyModal(true);
  };

// ─── Virtualizer ───────────────────────────────────────────────────────────
  // This is the magic: only renders ~20 rows at a time regardless of sheet size

  const tableBodyRef = useRef<HTMLDivElement>(null);
  const currentItems = useMemo(() => items[activeSheetId] || [], [items, activeSheetId]);

  const virtualizer = useVirtualizer({
    count: currentItems.length,
    getScrollElement: () => tableBodyRef.current,
    estimateSize: () => 28, // estimated row height in px
    overscan: 10,           // render 10 rows above/below viewport
  });

  // ─── Price Map: load ALL pricing upfront for selected variant ──────────────
  // Zero network calls during row editing — pure in-memory Map lookup

  const priceMapQuery = useQuery<Map<string, number>>({
    queryKey: ['boqPriceMap', boqData.variantId],
    enabled: !!boqData.variantId,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const [variantPrices, makePrices] = await Promise.all([
        timedSupabaseQuery(
          supabase
            .from('item_variant_pricing')
            .select('item_id, sale_price, make')
            .eq('company_variant_id', boqData.variantId)
            .eq('is_active', true),
          'BOQ price map variant',
        ),
        timedSupabaseQuery(
          supabase
            .from('item_variant_pricing')
            .select('item_id, sale_price, make, company_variant_id')
            .eq('is_active', true),
          'BOQ price map all',
        ),
      ]);

      const map = new Map<string, number>();
      // Key format: `${itemId}__${variantId}__${make}`
      (makePrices || []).forEach((p: any) => {
        map.set(`${p.item_id}__${p.company_variant_id}__${p.make || ''}`, parseFloat(p.sale_price) || 0);
      });
      return map;
    },
  });

  const priceMap = priceMapQuery.data || new Map();

  const getPriceFromMap = useCallback((itemId: string, variantId: string, make: string): number => {
    // 1. make-specific
    const withMake = priceMap.get(`${itemId}__${variantId}__${make}`);
    if (withMake) return withMake;
    // 2. variant only (empty make)
    const withVariant = priceMap.get(`${itemId}__${variantId}__`);
    if (withVariant) return withVariant;
    // 3. fallback to base material price
    return 0;
  }, [priceMap]);

  const calculateRow = useCallback((item) => {
    const rate = parseFloat(item.rate) || 0;
    const discountPercent = parseFloat(item.discountPercent) || 0;
    const rateAfterDiscount = Math.round(rate - (rate * discountPercent / 100));
    const totalAmount = rateAfterDiscount * (parseFloat(item.quantity) || 0);
    return { rateAfterDiscount, totalAmount };
  }, []);

  const getVariantDiscount = useCallback((variantId) => {
    if (boqVariantDiscounts[variantId] !== undefined) {
      return boqVariantDiscounts[variantId];
    }
    return clientDiscounts[variantId]?.discount || 0;
  }, [boqVariantDiscounts, clientDiscounts]);

  const applyVariantDiscountToRows = useCallback((variantId, newDiscount, prevDiscount, mode) => {
    setItems(prevItems => {
      const next = { ...prevItems };
      Object.keys(next).forEach(sheetId => {
        const list = next[sheetId] || [];
        next[sheetId] = list.map(row => {
          if (row.isHeaderRow) return row;
          const isTargetVariant = row.variantId
            ? row.variantId === variantId
            : boqData.variantId === variantId;
          if (!isTargetVariant) return row;

          if (mode === 'skip') {
            const current = row.discountPercent;
            const isOverwritten = current !== '' && current !== null && parseFloat(current) !== parseFloat(prevDiscount || 0);
            if (isOverwritten) return row;
          }

          return { ...row, discountPercent: newDiscount };
        });
      });
      return next;
    });
  }, [boqData.variantId]);

  const getVariantNameById = useCallback((variantId) => {
    return variants.find(v => v.id === variantId)?.variant_name || '';
  }, [variants]);

  const isRowEmpty = useCallback((row) => {
    if (!row || row.isHeaderRow) return false;
    const hasValue = row.description || row.itemId || row.quantity || row.rate || row.hsn_sac || row.make || row.specification || row.remarks;
    return !hasValue;
  }, []);

  useEffect(() => {
    const prev = prevDefaultVariantRef.current;
    if (prev === boqData.variantId) return;
    let cancelled = false;
    const priceLookups: Array<{
      sheetId: string;
      rowId: string;
      itemId: string;
      variantId: string;
      make: string;
    }> = [];

    setItems((prevItems) => {
      const next: ItemsBySheet = { ...prevItems };

      Object.keys(next).forEach((sheetId) => {
        const list = next[sheetId] || [];
        next[sheetId] = list.map((row) => {
          if (row.isHeaderRow) return row;

          const usesHeaderVariant = !row.variantId || row.variantId === prev;
          if (!usesHeaderVariant) return row;

          const nextVariantId = boqData.variantId || row.variantId || '';
          const updatedRow = {
            ...row,
            variantId: nextVariantId,
            variantName: getVariantNameById(nextVariantId),
            discountPercent: getVariantDiscount(nextVariantId),
          };

          if (updatedRow.itemId) {
            priceLookups.push({
              sheetId,
              rowId: updatedRow.id,
              itemId: updatedRow.itemId,
              variantId: nextVariantId,
              make: updatedRow.make || '',
            });
          }

          return updatedRow;
        });
      });

      return next;
    });

    prevDefaultVariantRef.current = boqData.variantId;

    if (priceLookups.length === 0) return;

    (async () => {
      const resolvedPrices = await Promise.all(
        priceLookups.map(async (lookup) => ({
          sheetId: lookup.sheetId,
          rowId: lookup.rowId,
          price: await getPrice(lookup.itemId, lookup.variantId, lookup.make),
        })),
      );

      if (cancelled) return;

      setItems((prevItems) => {
        let changed = false;
        const next: ItemsBySheet = { ...prevItems };

        resolvedPrices.forEach(({ sheetId, rowId, price }) => {
          const rows = next[sheetId];
          if (!rows?.length) return;

          const rowIndex = rows.findIndex((row) => row.id === rowId);
          if (rowIndex < 0) return;

          const currentRow = rows[rowIndex];
          if ((currentRow.rate || '') === (price || '')) return;

          const updatedRows = [...rows];
          updatedRows[rowIndex] = { ...currentRow, rate: price || currentRow.rate };
          next[sheetId] = updatedRows;
          changed = true;
        });

        return changed ? next : prevItems;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [boqData.variantId, getVariantDiscount, getVariantNameById, getPrice]);

  const insertRow = useCallback((afterIndex) => {
    const currentItems = items[activeSheetId] || [];
    const newRow = {
      id: generateId(),
      isHeaderRow: false,
      itemId: '',
      variantId: boqData.variantId,
      variantName: getVariantNameById(boqData.variantId),
      make: '',
      quantity: '',
      rate: '',
      discountPercent: getVariantDiscount(boqData.variantId),
      hsn_sac: '',
      unit: '',
      specification: '',
      remarks: '',
      pressure: '',
      thickness: '',
      schedule: '',
      material: '',
    };

    const newItems = [...currentItems];
    newItems.splice(afterIndex + 1, 0, newRow);
    setItems(prev => ({ ...prev, [activeSheetId]: newItems }));

    setTimeout(() => {
      const inputKey = `${activeSheetId}-${afterIndex + 1}-itemId`;
      inputRefs.current[inputKey]?.focus();
    }, 50);
  }, [activeSheetId, items, boqData.variantId, getVariantDiscount]);

  const deleteRow = useCallback((index) => {
    const currentItems = items[activeSheetId] || [];
    const newItems = currentItems.filter((_, i) => i !== index);
    setItems(prev => ({ ...prev, [activeSheetId]: newItems }));
  }, [activeSheetId, items]);

  const addHeaderRow = useCallback(() => {
    const currentItems = items[activeSheetId] || [];
    const newRow = {
      id: generateId(),
      isHeaderRow: true,
      headerText: 'NEW SECTION',
    };
    setItems(prev => ({ ...prev, [activeSheetId]: [...currentItems, newRow] }));
  }, [activeSheetId, items]);

  const pushUndo = useCallback(() => {
    const sheetId = activeSheetId;
    const snapshot = JSON.parse(JSON.stringify(items[sheetId] || []));
    if (!undoStackRef.current[sheetId]) undoStackRef.current[sheetId] = [];
    undoStackRef.current[sheetId].push(snapshot);
    if (undoStackRef.current[sheetId].length > 50) {
      undoStackRef.current[sheetId].shift();
    }
  }, [activeSheetId, items]);

  const updateItem = useCallback((index, field, value) => {
    pushUndo();
    const currentItems = items[activeSheetId] || [];
    const newItems = [...currentItems];
    newItems[index] = { ...newItems[index], [field]: value };

    if (field === 'itemId' && value) {
      if (!newItems[index].variantId && boqData.variantId) {
        newItems[index].variantId = boqData.variantId;
        newItems[index].variantName = getVariantNameById(boqData.variantId);
        newItems[index].discountPercent = getVariantDiscount(boqData.variantId);
      }
      if (!newItems[index].description) {
        const material = materials.find(m => m.id === value);
        if (material?.name) newItems[index].description = material.name;
        if (!newItems[index].hsn_sac && (material?.hsn_code || material?.hsn || material?.hsn_sac)) {
          newItems[index].hsn_sac = material.hsn_code || material.hsn || material.hsn_sac;
        }
        if (!newItems[index].unit && material?.unit) newItems[index].unit = material.unit;
      }
      getPrice(value, newItems[index].variantId || boqData.variantId, newItems[index].make)
        .then(price => {
          newItems[index].rate = price;
          setItems(prev => ({ ...prev, [activeSheetId]: [...newItems] }));
        });
    }

    if (field === 'variantId' && value) {
      newItems[index].discountPercent = getVariantDiscount(value);
      if (newItems[index].itemId) {
        getPrice(newItems[index].itemId, value, newItems[index].make || '')
          .then(price => {
            newItems[index].rate = price;
            setItems(prev => ({ ...prev, [activeSheetId]: [...newItems] }));
          });
      }
    }

    if (field === 'make') {
      const variant = newItems[index].variantId || boqData.variantId;
      if (newItems[index].itemId) {
        getPrice(newItems[index].itemId, variant, value)
          .then(price => {
            newItems[index].rate = price;
            setItems(prev => ({ ...prev, [activeSheetId]: [...newItems] }));
          });
      }
    }

    setItems(prev => ({ ...prev, [activeSheetId]: newItems }));
  }, [activeSheetId, items, boqData.variantId, getPrice, getVariantDiscount, getVariantNameById, materials, pushUndo]);

  const handleMaterialPick = async (index, material) => {
    pushUndo();
    const currentItems = items[activeSheetId] || [];
    const newItems = [...currentItems];
    const row = { ...newItems[index] };
    row.itemId = material.id;
    row.description = material.name || row.description;
    row.hsn_sac = material.hsn_code || material.hsn || material.hsn_sac || row.hsn_sac || '';
    row.unit = material.unit || row.unit || '';
    if (!row.variantId && boqData.variantId) {
      row.variantId = boqData.variantId;
      row.variantName = getVariantNameById(boqData.variantId);
      row.discountPercent = getVariantDiscount(boqData.variantId);
    }
    const price = await getPrice(material.id, row.variantId || boqData.variantId, row.make);
    row.rate = price || material.sale_price || row.rate || '';
    newItems[index] = row;
    setItems(prev => ({ ...prev, [activeSheetId]: newItems }));
  };

  useEffect(() => {
    if (!materials.length) return;
    let changed = false;
    const updated = { ...items };
    Object.keys(updated).forEach(sheetId => {
      const list = updated[sheetId] || [];
      const next = list.map(row => {
        if (!row.isHeaderRow && row.itemId && !row.description) {
          const material = materials.find(m => m.id === row.itemId);
          if (material?.name) {
            changed = true;
            return { ...row, description: material.name };
          }
        }
        return row;
      });
      updated[sheetId] = next;
    });
    if (changed) setItems(updated);
  }, [materials]);

  const toggleColumnVisibility = (columnKey) => {
    setColumnSettings(prev => prev.map(col => 
      col.key === columnKey ? { ...col, visible: !col.visible } : col
    ));
  };

  const addNewSheet = () => {
    const newSheet = {
      id: generateId(),
      name: `BOQ Sheet ${sheets.length + 1}`,
      isDefault: false,
    };
    setSheets(prev => [...prev, newSheet]);
    setActiveSheetId(newSheet.id);
    setItems(prev => ({ ...prev, [newSheet.id]: [] }));
  };

  const deleteSheet = (sheetId) => {
    if (sheets.length <= 1) return;
    const newSheets = sheets.filter(s => s.id !== sheetId);
    setSheets(newSheets);
    if (activeSheetId === sheetId) {
      setActiveSheetId(newSheets[0].id);
    }
    setItems(prev => {
      const newItems = { ...prev };
      delete newItems[sheetId];
      return newItems;
    });
  };

  const handleRowDragStart = (e, index) => {
    const tag = e.target?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea') {
      e.preventDefault();
      return;
    }
    setDragRowIndex(index);
  };

  const handleRowDrop = (index) => {
    if (dragRowIndex === null || dragRowIndex === index) return;
    const currentItems = items[activeSheetId] || [];
    const nextItems = [...currentItems];
    const [moved] = nextItems.splice(dragRowIndex, 1);
    nextItems.splice(index, 0, moved);
    setItems(prev => ({ ...prev, [activeSheetId]: nextItems }));
    setDragRowIndex(null);
  };

  const handleSheetDragStart = (sheetId) => {
    setDragSheetId(sheetId);
  };

  const handleSheetDrop = (sheetId) => {
    if (!dragSheetId || dragSheetId === sheetId) return;
    const current = [...sheets];
    const fromIndex = current.findIndex(s => s.id === dragSheetId);
    const toIndex = current.findIndex(s => s.id === sheetId);
    if (fromIndex < 0 || toIndex < 0) return;
    const [moved] = current.splice(fromIndex, 1);
    current.splice(toIndex, 0, moved);
    setSheets(current);
    setDragSheetId(null);
  };

  const startSheetRename = (sheet) => {
    setEditingSheetId(sheet.id);
    setEditingSheetName(sheet.name || '');
  };

  const commitSheetRename = (sheetId) => {
    const name = editingSheetName.trim();
    if (!name) {
      setEditingSheetId(null);
      setEditingSheetName('');
      return;
    }
    setSheets(prev => prev.map(s => (s.id === sheetId ? { ...s, name } : s)));
    setEditingSheetId(null);
    setEditingSheetName('');
  };

  useEffect(() => {
    const sheetId = activeSheetId;
    if (!sheetId) return;
    const list = items[sheetId] || [];
    if (list.length >= 10) return;
    const toAdd = 10 - list.length;
    const extra = Array.from({ length: toAdd }).map(() => ({
      id: generateId(),
      isHeaderRow: false,
      itemId: '',
      variantId: boqData.variantId,
      variantName: getVariantNameById(boqData.variantId),
      make: '',
      quantity: '',
      rate: '',
      discountPercent: getVariantDiscount(boqData.variantId),
      hsn_sac: '',
      specification: '',
      remarks: '',
      pressure: '',
      thickness: '',
      schedule: '',
      material: '',
    }));
    setItems(prev => ({ ...prev, [sheetId]: [...list, ...extra] }));
  }, [activeSheetId, items, boqData.variantId, getVariantDiscount, getVariantNameById]);

  useEffect(() => {
    const onKeyDown = (e) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      if (!isCtrl) return;

      if (e.key.toLowerCase() === 'z') {
        e.preventDefault();
        const sheetId = activeSheetId;
        const stack = undoStackRef.current[sheetId] || [];
        const last = stack.pop();
        if (last) {
          setItems(prev => ({ ...prev, [sheetId]: last }));
        }
      }

      if (e.key.toLowerCase() === 'c') {
        if (activeRowIndex == null) return;
        const row = (items[activeSheetId] || [])[activeRowIndex];
        if (!row || row.isHeaderRow) return;
        copiedRowRef.current = { ...row };
      }

      if (e.key.toLowerCase() === 'v') {
        if (activeRowIndex == null) return;
        const row = copiedRowRef.current;
        if (!row) return;
        const currentItems = items[activeSheetId] || [];
        const nextItems = [...currentItems];
        const target = nextItems[activeRowIndex];
        if (!target || target.isHeaderRow) return;
        nextItems[activeRowIndex] = { ...row, id: target.id };
        setItems(prev => ({ ...prev, [activeSheetId]: nextItems }));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeSheetId, activeRowIndex, items]);

  const totals = useMemo(() => {
    const currentItems = items[activeSheetId] || [];
    const dataRows = currentItems.filter(item => !item.isHeaderRow);
    
    const totalQty = dataRows.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
    const totalAmount = dataRows.reduce((sum, item) => {
      const { totalAmount: ta } = calculateRow(item);
      return sum + ta;
    }, 0);

    return { totalQty, totalAmount };
  }, [items, activeSheetId, calculateRow]);

  const visibleColumns = columnSettings.filter(col => col.visible);
  const exportColumnList = columnSettings.filter(col => exportColumns[col.key]);
  const exportSheetList = sheets.filter(s => exportSheets[s.id]);
  const columnLetters = useMemo(() => visibleColumns.map((_, idx) => getColumnLabel(idx)), [visibleColumns]);

  const getSno = (index, itemsList) => {
    let sno = 0;
    for (let i = 0; i < index; i++) {
      if (itemsList[i] && !itemsList[i].isHeaderRow && !isRowEmpty(itemsList[i])) sno++;
    }
    return sno + 1;
  };

  const exportToPDF = useCallback(() => {
    const doc = new jsPDF(exportOrientation, 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginX = 10;

    // Ensure Open Sans is used
    if (openSansRegular && openSansBold) {
      try {
        doc.addFileToVFS('OpenSans-Regular.ttf', openSansRegular);
        doc.addFileToVFS('OpenSans-Bold.ttf', openSansBold);
        doc.addFont('OpenSans-Regular.ttf', 'OpenSans', 'normal');
        doc.addFont('OpenSans-Bold.ttf', 'OpenSans', 'bold');
        doc.setFont('OpenSans', 'normal');
      } catch {}
    }

    const orderedColumns = (exportColumnList.length ? exportColumnList : columnSettings).filter(c => c.key !== 'rowControl');

    const colWidths = {
      sno: 12,
      hsn_sac: 18,
      description: 80,
      variant: 20,
      make: 20,
      quantity: 15,
      unit: 18,
      rate: 20,
      discountPercent: 18,
      rateAfterDiscount: 22,
      totalAmount: 22,
      specification: 24,
      remarks: 24,
      pressure: 18,
      thickness: 18,
      schedule: 18,
      material: 22,
    };

    const columns = orderedColumns.map((col) => ({
      key: col.key,
      title: col.label,
      width: colWidths[col.key] || col.width || 20,
      align: col.key === 'description' ? 'left' : 'center'
    }));

    const totalWidth = columns.reduce((sum, c) => sum + c.width, 0) || 1;
    const availableWidth = pageWidth - marginX * 2;
    const scale = availableWidth / totalWidth;

    const columnStyles = {};
    columns.forEach((c, idx) => {
      columnStyles[idx] = { cellWidth: c.width * scale, halign: c.align };
    });

    const renderHeader = (sheetName) => {
      doc.setFont('OpenSans', 'normal');
      doc.setFontSize(12);
      doc.text('BILL OF QUANTITIES', marginX, 12);
      doc.setFont('OpenSans', 'bold');
      doc.text(sheetName, pageWidth / 2, 12, { align: 'center' });
      doc.setFont('OpenSans', 'normal');

      const client = clients.find(c => c.id === boqData.clientId);
      const project = projects.find(p => p.id === boqData.projectId);

      const labelW = 26;
      const valueW = (pageWidth - marginX * 2 - labelW * 2) / 2;
      autoTable(doc, {
        startY: 16,
        theme: 'grid',
        styles: { font: 'OpenSans', fontSize: 9, cellPadding: 1.2, textColor: 20, lineColor: [0, 0, 0], lineWidth: 0.1 },
        head: [],
        body: [
          ['Client:', client?.client_name || '', 'Project:', project?.project_name || ''],
          ['BoQ No:', boqData.boqNo || '', 'Date:', boqData.date || ''],
          ['Revision no:', String(boqData.revisionNo || ''), 'Date:', boqData.date || '']
        ],
        columnStyles: {
          0: { cellWidth: labelW, halign: 'left', fontStyle: 'bold', overflow: 'linebreak' },
          1: { cellWidth: valueW, halign: 'left' },
          2: { cellWidth: labelW, halign: 'left', fontStyle: 'bold', overflow: 'linebreak' },
          3: { cellWidth: valueW, halign: 'left' },
        }
      });
    };

    const renderTable = (sheetItems) => {
      const rows = [];
      let sno = 0;
      const dataRows = sheetItems.filter(i => !i.isHeaderRow);
      const targetRows = Math.max(20, dataRows.length);
      let sheetTotalQty = 0;
      let sheetTotalAmount = 0;

      dataRows.forEach(item => {
        const empty = isRowEmpty(item);
        if (!empty) sno += 1;
        const calc = calculateRow(item);
        sheetTotalQty += parseFloat(item.quantity) || 0;
        sheetTotalAmount += parseFloat(calc.totalAmount) || 0;

        const row = columns.map(c => {
          switch (c.key) {
            case 'sno': return empty ? '' : sno;
            case 'description': return item.description || '';
            case 'hsn_sac': return item.hsn_sac || '';
            case 'variant': return item.variantName || '';
            case 'make': return item.make || '';
            case 'quantity': return item.quantity || '';
            case 'unit': return item.unit || '';
            case 'rate': return item.rate || '';
            case 'discountPercent': return item.discountPercent || '';
            case 'rateAfterDiscount': return calc.rateAfterDiscount || '';
            case 'totalAmount': return calc.totalAmount || '';
            case 'specification': return item.specification || '';
            case 'remarks': return item.remarks || '';
            case 'pressure': return item.pressure || '';
            case 'thickness': return item.thickness || '';
            case 'schedule': return item.schedule || '';
            case 'material': return item.material || '';
            default: return '';
          }
        });
        rows.push(row);
      });

      while (rows.length < targetRows) {
        rows.push(columns.map(() => ''));
      }

      const totalsRow = columns.map(c => {
        if (c.key === 'description') return 'Total';
        if (c.key === 'quantity') return sheetTotalQty || '';
        if (c.key === 'totalAmount') return sheetTotalAmount ? `${sheetTotalAmount.toLocaleString()}` : '';
        return '';
      });
      rows.push(totalsRow);

      autoTable(doc, {
        startY: 38,
        head: [columns.map(c => c.title)],
        body: rows,
        theme: 'grid',
        styles: { font: 'OpenSans', fontSize: 8, cellPadding: 1.2, textColor: 20, lineColor: [0, 0, 0], lineWidth: 0.1 },
        headStyles: { fontStyle: 'bold', fillColor: [245, 245, 245], textColor: 20, lineColor: [0, 0, 0], lineWidth: 0.2, halign: 'center' },
        columnStyles,
        didParseCell: (data) => {
          if (data.section === 'head' && columns[data.column.index]?.key === 'discountPercent') {
            data.cell.styles.fillColor = [255, 244, 194];
          }
          if (data.section === 'body' && data.row.index === rows.length - 1) {
            data.cell.styles.fillColor = [216, 232, 247];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      });
    };

    exportSheetList.forEach((sheet, idx) => {
      if (idx > 0) doc.addPage();
      const name = sheet.name.toLowerCase();
      if (name.includes('terms') || name.includes('preface')) {
        doc.setFont('OpenSans', 'bold');
        doc.setFontSize(14);
        doc.text(name.includes('terms') ? 'Terms' : 'Preface', marginX, 12);
        doc.setFont('OpenSans', 'normal');
        doc.setFontSize(9);
        const content = name.includes('terms') ? (boqData.termsConditions || '') : (boqData.preface || '');
        const lines = doc.splitTextToSize(content, pageWidth - marginX * 2);
        doc.text(lines, marginX, 20);
        return;
      }
      renderHeader(sheet.name);
      renderTable(items[sheet.id] || []);
    });

    doc.save(`${boqData.boqNo}.pdf`);
    setShowExportMenu(false);
  }, [boqData, clients, projects, items, exportColumnList, exportSheetList, calculateRow, exportOrientation, columnSettings, isRowEmpty, openSansRegular, openSansBold]);

const exportToExcel = useCallback(async () => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    
    exportSheetList.forEach(sheet => {
      const lower = sheet.name.toLowerCase();
      if (lower.includes('terms') || lower.includes('preface')) return;
      const sheetData = [];
      let sno = 0;
      
      sheetData.push(['BOQ No', boqData.boqNo, 'Revision', boqData.revisionNo]);
      sheetData.push(['Date', boqData.date]);
      const client = clients.find(c => c.id === boqData.clientId);
      const project = projects.find(p => p.id === boqData.projectId);
      sheetData.push(['Client', client?.client_name || '']);
      sheetData.push(['Project', project?.project_name || '']);
      sheetData.push([]);
      
      const headers = exportColumnList.map(col => col.label);
      sheetData.push(headers);
      
      (items[sheet.id] || []).forEach(item => {
        if (item.isHeaderRow) {
          sheetData.push([item.headerText]);
        } else {
          sno++;
          const { rateAfterDiscount, totalAmount } = calculateRow(item);
          const row = [];
          
          exportColumnList.forEach(col => {
            switch (col.key) {
              case 'sno': row.push(sno); break;
              case 'description': row.push(item.description || ''); break;
              case 'hsn_sac': row.push(item.hsn_sac || ''); break;
              case 'variant': row.push(item.variantName || ''); break;
              case 'make': row.push(item.make || ''); break;
              case 'quantity': row.push(item.quantity || ''); break;
              case 'unit': row.push(item.unit || ''); break;
              case 'rate': row.push(item.rate || ''); break;
              case 'discountPercent': row.push(item.discountPercent || ''); break;
              case 'rateAfterDiscount': row.push(rateAfterDiscount); break;
              case 'totalAmount': row.push(totalAmount); break;
              case 'specification': row.push(item.specification || ''); break;
              case 'remarks': row.push(item.remarks || ''); break;
              case 'pressure': row.push(item.pressure || ''); break;
              case 'thickness': row.push(item.thickness || ''); break;
              case 'schedule': row.push(item.schedule || ''); break;
              case 'material': row.push(item.material || ''); break;
              default: row.push('');
            }
          });
          
          sheetData.push(row);
        }
      });

      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      XLSX.utils.book_append_sheet(wb, ws, sheet.name.substring(0, 31));
    });

    // Add Terms/Preface sheets if selected
    exportSheetList.forEach(sheet => {
      const name = sheet.name.toLowerCase();
      if (name.includes('terms') || name.includes('preface')) {
        const title = name.includes('terms') ? 'Terms' : 'Preface';
        const content = name.includes('terms') ? (boqData.termsConditions || '') : (boqData.preface || '');
        const lines = content.split('\n');
        const ws = XLSX.utils.aoa_to_sheet([[title], ...lines.map(l => [l])]);
        XLSX.utils.book_append_sheet(wb, ws, sheet.name.substring(0, 31));
      }
    });

    XLSX.writeFile(wb, `${boqData.boqNo}.xlsx`);
    setShowExportMenu(false);
  }, [boqData, clients, projects, exportSheetList, items, exportColumnList, calculateRow]);

  const handleKeyDown = (e, index, field) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const nextField = getNextField(field);
      
      if (nextField) {
        const nextKey = `${activeSheetId}-${index}-${nextField}`;
        inputRefs.current[nextKey]?.focus();
      } else if (e.key === 'Enter') {
        insertRow(index);
      }
    } else if (e.key === 'ArrowDown' && e.ctrlKey) {
      e.preventDefault();
      const nextKey = `${activeSheetId}-${index + 1}-${field}`;
      inputRefs.current[nextKey]?.focus();
    } else if (e.key === 'ArrowUp' && e.ctrlKey) {
      e.preventDefault();
      const nextKey = `${activeSheetId}-${index - 1}-${field}`;
      inputRefs.current[nextKey]?.focus();
    }
  };

  const getNextField = (currentField) => {
    const fieldOrder = ['itemId', 'variantId', 'make', 'quantity', 'rate', 'discountPercent', 'specification', 'remarks'];
    const currentIndex = fieldOrder.indexOf(currentField);
    if (currentIndex < fieldOrder.length - 1) {
      return fieldOrder[currentIndex + 1];
    }
    return null;
  };

  const filteredMaterials = useMemo(() => {
    const searchRaw = materialSearch[activeSheetId];
    const search = (searchRaw || '').toLowerCase();
    if (!search) return materials;
    return materials.filter(m => m.name.toLowerCase().includes(search));
  }, [materials, materialSearch, activeSheetId]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const boqSaveData = {
        id: boqData.id,
        boqNo: boqData.boqNo,
        revisionNo: boqData.revisionNo,
        date: boqData.date,
        clientId: boqData.clientId,
        projectId: boqData.projectId,
        variantId: boqData.variantId,
        status: boqData.status,
        termsConditions: boqData.termsConditions,
        preface: boqData.preface
      };

      const savedId = await withTimeout(
        saveBOQWithItems(boqSaveData, sheets, items),
        60000, // Increased to 60 seconds for large BOQs
        'BOQ save',
      );

      const savedHeader = await withTimeout(
        fetchBOQById(savedId),
        30000,
        'BOQ refresh',
      );

      return savedHeader as LoadedBoqHeader;
    },
    onMutate: () => {
      // LEVEL 2: OPTIMISTIC UI - Update UI instantly BEFORE backend saves
      setIsSavingLocally(true);
    },
    onSuccess: (savedHeader) => {
      // Clear dirty flags after successful save
      setItems(prev => {
        const cleaned: ItemsBySheet = {};
        Object.keys(prev).forEach(sheetId => {
          cleaned[sheetId] = prev[sheetId].map(item => ({
            ...item,
            isDirty: false,
            originalData: JSON.stringify({
              description: item.description,
              quantity: item.quantity,
              rate: item.rate,
              discountPercent: item.discountPercent,
            }),
          }));
        });
        return cleaned;
      });
      
      setSaveError('');
      setIsSavingLocally(false);
      setLastSavedAt(new Date());
      hydrateFromHeader(savedHeader);
      queryClient.invalidateQueries({ queryKey: ['boqInit'] });
      alert('BOQ saved successfully!');
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error saving BOQ:', error);
      setIsSavingLocally(false);  // Stop spinner - show error instead
      setSaveError(`Error saving BOQ: ${message}`);
    },
  });

  const handleSave = async () => {
    setSaveError('');
    await saveMutation.mutateAsync();
  };

  // Stock Check handler - launches procurement list from selected sheets
  const handleLaunchStockCheck = async () => {
    const sheetIds = Object.entries(selectedSheets)
      .filter(([, selected]) => selected)
      .map(([id]) => id);

    if (sheetIds.length === 0) {
      alert('Please select at least one sheet.');
      return;
    }

    setLaunchingStockCheck(true);
    try {
      const orgId = organisation?.id;

      const client = clients.find((c) => c.id === boqData.clientId);
      const project = projects.find((p) => p.id === boqData.projectId);

      // Create procurement list header
      const { data: listData, error: listError } = await supabase
        .from('procurement_lists')
        .insert({
          organisation_id: orgId,
          title: `${boqData.boqNo} — Stock Check`,
          source: 'boq',
          boq_id: boqData.id || null,
          boq_no: boqData.boqNo || null,
          client_id: boqData.clientId || null,
          client_name: client?.client_name || null,
          project_id: boqData.projectId || null,
          project_name: project?.project_name || null,
          status: 'Active',
        })
        .select()
        .single();

      if (listError) throw listError;
      const listId = listData.id;

      // Collect items from selected sheets
      const procurementRows: any[] = [];
      let order = 0;

      sheetIds.forEach((sheetId) => {
        const sheetItems = items[sheetId] || [];
        sheetItems.forEach((row) => {
          if (row.isHeaderRow) {
            procurementRows.push({
              list_id: listId,
              organisation_id: orgId,
              is_header_row: true,
              header_text: row.headerText || 'Section',
              item_name: '',
              display_order: order++,
            });
            return;
          }

          // Skip completely empty rows
          if (!row.description && !row.itemId && !row.quantity) return;

          procurementRows.push({
            list_id: listId,
            organisation_id: orgId,
            item_id: row.itemId || null,
            item_name: row.description || '',
            make: row.make || null,
            variant_name: row.variantName || null,
            uom: row.unit || null,
            boq_qty: parseFloat(String(row.quantity)) || 0,
            stock_qty: 0,         // to be filled manually
            local_qty: 0,
            vendor_id: null,
            notes: null,
            status: 'Pending',
            display_order: order++,
            is_header_row: false,
          });
        });
      });

      if (procurementRows.length > 0) {
        const { error: itemsError } = await supabase
          .from('procurement_items')
          .insert(procurementRows);
        if (itemsError) throw itemsError;
      }

      setShowStockCheckModal(false);
      navigate(`/procurement/detail?id=${listId}`);
    } catch (e: any) {
      alert('Error launching stock check: ' + e.message);
    } finally {
      setLaunchingStockCheck(false);
    }
  };

  const hydrationKey = editId || 'new';
  const isHydrated = hydratedKeyRef.current === hydrationKey;

  if ((initQuery.isPending && !initQuery.data) || (initQuery.data && !isHydrated)) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading BOQ...</div>;
  }

  if (initQuery.isError) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ color: '#b91c1c', fontWeight: 600, marginBottom: '12px' }}>
          {(initQuery.error instanceof Error && initQuery.error.message) || 'Unable to load BOQ data.'}
        </div>
        <button type="button" className="btn btn-primary" onClick={() => initQuery.refetch()}>
          Retry
        </button>
      </div>
    );
  }

  const currentItems = items[activeSheetId] || [];
  const activeSheet = sheets.find(s => s.id === activeSheetId);
  const isTermsSheet = activeSheet?.name?.toLowerCase().includes('terms');
  const isPrefaceSheet = activeSheet?.name?.toLowerCase().includes('preface');

  return (
    <div className="page-container" style={{ padding: '18px', background: '#eef1f4', minHeight: '100vh' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <h1 className="page-title" style={{ fontSize: '24px', fontWeight: '600', color: '#1a1a1a' }}>BOQ</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setShowColumnPanel(true)} style={btnStyle}>
            <Settings size={16} /> Columns
          </button>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowExportMenu(!showExportMenu)} style={btnStyle}>
              <FileDown size={16} /> Export
            </button>
            {showExportMenu && (
              <div style={{ position: 'absolute', top: '100%', right: 0, background: 'white', border: '1px solid #ddd', borderRadius: '4px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', zIndex: 100, minWidth: '160px' }}>
                <button onClick={exportToPDF} style={dropdownItemStyle}>
                  <FileSpreadsheet size={16} /> Export to PDF
                </button>
                <button onClick={exportToExcel} style={dropdownItemStyle}>
                  <Table size={16} /> Export to Excel
                </button>
                <button onClick={() => { setShowExportSettings(true); setShowExportMenu(false); }} style={dropdownItemStyle}>
                  <Settings size={16} /> Export Settings
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => {
              // Pre-select all sheets
              const selection: Record<string, boolean> = {};
              sheets.forEach((s) => { selection[s.id] = true; });
              setSelectedSheets(selection);
              setShowStockCheckModal(true);
            }}
            style={{ ...btnStyle, background: '#064e3b', color: '#fff', border: 'none' }}
          >
            📦 Stock Check
          </button>
          <button 
            onClick={handleSave}
            style={{ ...btnStyle, background: isSavingLocally ? '#22c55e' : '#1976d2', color: 'white' }}
            disabled={saveMutation.isPending}
          >
            {isSavingLocally ? (
              <>✓ Saved locally</>
            ) : saveMutation.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )} {isSavingLocally ? '' : 'Save BOQ'}
          </button>
        </div>
      </div>

      {saveError && (
        <div style={{ marginBottom: '12px', padding: '12px 14px', borderRadius: '6px', background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}>
          {saveError}
        </div>
      )}

      {clientDiscountsQuery.isError && (
        <div style={{ marginBottom: '12px', padding: '12px 14px', borderRadius: '6px', background: '#fff7ed', color: '#9a3412', border: '1px solid #fdba74', display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
          <span>{(clientDiscountsQuery.error instanceof Error && clientDiscountsQuery.error.message) || 'Unable to load client discount rules.'}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => clientDiscountsQuery.refetch()}>
            Retry
          </button>
        </div>
      )}

      <div style={cardStyle}>
        <div style={boqHeaderGridStyle}>
          <div style={boqHeaderCardStyle}>
            <div style={boqHeaderTitleStyle}>BOQ Info</div>
            <div style={boqHeaderFieldsStyle}>
              <div>
                <label style={labelStyle}>BOQ No</label>
                <input type="text" value={boqData.boqNo} onChange={(e) => setBoqData(prev => ({ ...prev, boqNo: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Revision No</label>
                <input type="number" value={boqData.revisionNo} onChange={(e) => setBoqData(prev => ({ ...prev, revisionNo: parseInt(e.target.value) || 1 }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Date</label>
                <input type="date" value={boqData.date} onChange={(e) => setBoqData(prev => ({ ...prev, date: e.target.value }))} style={inputStyle} />
              </div>
            </div>
          </div>

          <div style={boqHeaderCardStyle}>
            <div style={boqHeaderTitleStyle}>BOQ Info</div>
            <div style={boqHeaderFieldsStyle}>
              <div>
                <label style={labelStyle}>Client</label>
                <select value={boqData.clientId} onChange={(e) => handleClientChange(e.target.value)} style={inputStyle}>
                  <option value="">Select Client</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.client_name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Project</label>
                <select value={boqData.projectId} onChange={(e) => setBoqData(prev => ({ ...prev, projectId: e.target.value }))} style={inputStyle}>
                  <option value="">Select Project</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div style={boqHeaderCardStyle}>
            <div style={boqHeaderTitleStyle}>Discount Profile</div>
            <div style={boqHeaderFieldsStyle}>
              <div>
                <label style={labelStyle}>Variant Default</label>
                <select value={boqData.variantId} onChange={(e) => handleVariantChange(e.target.value)} style={{ ...inputStyle, width: '100%' }}>
                  <option value="">Select Variant (Default for all rows)</option>
                  {variants.map(v => <option key={v.id} value={v.id}>{v.variant_name}</option>)}
                </select>
              </div>

              {Object.keys(clientDiscounts).length > 0 && (
                <div style={boqHeaderDiscountWrapStyle}>
                  <span style={boqHeaderDiscountLabelStyle}>Variant Discounts (Editable)</span>
                  <div style={boqHeaderDiscountListStyle}>
                    {Object.entries(clientDiscounts).map(([variantId, data]) => (
                      <div key={variantId} style={variantDiscountBoxStyle}>
                        <span style={{ fontSize: '12px' }}>
                          {data.variantName || getVariantNameById(variantId) || '-'}
                        </span>
                        <input
                          type="number"
                          value={boqVariantDiscounts[variantId] ?? data.discount}
                          onChange={(e) => handleVariantDiscountChange(variantId, e.target.value)}
                          style={{ ...inputStyle, width: '60px', padding: '4px' }}
                          step="0.5"
                        />
                        <span style={{ fontSize: '11px', color: '#6b7280' }}>%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '15px', display: 'flex', gap: '10px' }}>
          {!isTermsSheet && !isPrefaceSheet && (
            <button onClick={addHeaderRow} style={{ ...btnStyle, background: '#28a745', color: 'white' }}>
              <Plus size={16} /> Add Header Row
            </button>
          )}
          <div style={{ display: 'flex', gap: '5px', marginLeft: 'auto', padding: '4px', background: '#e5e7eb', border: '1px solid #cbd5e1', borderRadius: '4px' }}>
            {sheets.map((sheet, idx) => (
              <div
                key={sheet.id}
                style={{ display: 'flex', alignItems: 'center' }}
                draggable
                onDragStart={() => handleSheetDragStart(sheet.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleSheetDrop(sheet.id)}
              >
                {editingSheetId === sheet.id ? (
                  <input
                    value={editingSheetName}
                    onChange={(e) => setEditingSheetName(e.target.value)}
                    onBlur={() => commitSheetRename(sheet.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitSheetRename(sheet.id);
                      if (e.key === 'Escape') { setEditingSheetId(null); setEditingSheetName(''); }
                    }}
                    autoFocus
                    style={{ ...inputStyle, width: '140px', height: '26px' }}
                  />
                ) : (
                  <button
                    onClick={() => (activeSheetId === sheet.id ? startSheetRename(sheet) : setActiveSheetId(sheet.id))}
                    style={{
                      ...sheetTabStyle,
                      background: activeSheetId === sheet.id ? '#1976d2' : '#f0f0f0',
                      color: activeSheetId === sheet.id ? 'white' : '#333',
                    }}
                    title="Click to rename"
                  >
                    <GripVertical size={12} /> <Sheet size={14} /> {sheet.name}
                  </button>
                )}
                {sheets.length > 1 && idx > 0 && (
                  <button onClick={() => deleteSheet(sheet.id)} style={sheetCloseBtnStyle}>
                    <X size={12} />
                  </button>
                )}
              </div>
            ))}
            <button onClick={addNewSheet} style={{ ...btnStyle, padding: '6px 12px' }}>
              <Plus size={14} />
            </button>
          </div>
        </div>

        {!isTermsSheet && !isPrefaceSheet ? (
        <div style={excelTableWrapStyle}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <thead>
              <tr style={excelColumnHeaderRowStyle}>
                {visibleColumns.map((col, idx) => (
                  <th
                    key={`${col.key}-letter`}
                    style={{ 
                      ...excelColumnHeaderCellStyle, 
                      width: col.width, 
                      minWidth: col.width,
                      ...(col.key === 'rowControl' ? excelCornerCellStyle : null)
                    }}
                  >
                    {col.key === 'rowControl' ? '' : columnLetters[idx]}
                  </th>
                ))}
              </tr>
              <tr style={excelHeaderRowStyle}>
                {visibleColumns.map(col => (
                  <th
                    key={col.key}
                    style={{
                      ...thStyle,
                      width: col.width,
                      minWidth: col.width,
                      ...(col.key === 'discountPercent' ? discountHeaderCellStyle : null)
                    }}
                  >
                    {col.key === 'rowControl' ? '' : col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentItems.map((item, index) => (
                item.isHeaderRow ? (
                  <tr
                    key={item.id}
                    style={{ background: '#e8e8e8' }}
                    draggable
                    onDragStart={(e) => handleRowDragStart(e, index)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleRowDrop(index)}
                  >
                    <td colSpan={visibleColumns.length} style={{ padding: '6px 8px', fontWeight: 'bold', textAlign: 'left' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span title="Drag row" style={{ cursor: 'grab', color: '#9ca3af' }}>
                          <GripVertical size={14} />
                        </span>
                        <button onClick={() => deleteRow(index)} style={iconBtnStyle} title="Delete Header Row">
                          <Trash2 size={14} />
                        </button>
                        <input
                          type="text"
                          value={item.headerText}
                          onChange={(e) => updateItem(index, 'headerText', e.target.value)}
                          style={{ border: 'none', background: 'transparent', fontWeight: 'bold', width: '100%', fontSize: '13px' }}
                        />
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr
                    key={item.id}
                    style={{ background: '#fff' }}
                    draggable
                    onDragStart={(e) => handleRowDragStart(e, index)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleRowDrop(index)}
                  >
                    {visibleColumns.map(col => (
                      <td key={col.key} style={{ ...excelCellStyle, ...(col.key === 'rowControl' || col.key === 'sno' ? excelRowHeaderCellStyle : null) }}>
                        {col.key === 'rowControl' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span title="Drag row" style={{ cursor: 'grab', color: '#9ca3af' }}>
                              <GripVertical size={14} />
                            </span>
                            <button onClick={() => deleteRow(index)} style={iconBtnStyle} title="Delete Row">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                        {col.key === 'sno' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span>{isRowEmpty(item) ? '' : getSno(index, currentItems)}</span>
                            <button onClick={() => insertRow(index)} style={iconBtnStyle} title="Insert Row Below">
                              <Plus size={12} />
                            </button>
                          </div>
                        )}
                        {col.key === 'description' && (
                          <div style={{ position: 'relative' }}>
                            <input
                              type="text"
                              value={item.description || ''}
                              onChange={(e) => {
                                setMaterialSearch(prev => ({ ...prev, [activeSheetId]: e.target.value }));
                                updateItem(index, 'description', e.target.value);
                              }}
                              onFocus={(e) => {
                                setMaterialSearch(prev => ({ ...prev, [activeSheetId]: e.target.value }));
                                setMaterialSearchActive({ sheetId: activeSheetId, index });
                                setActiveRowIndex(index);
                                e.target.select();
                              }}
                              onBlur={() => setTimeout(() => {
                                const value = (item.description || '').trim();
                                if (!item.itemId && value) {
                                  const match = materials.find(m => m.name?.toLowerCase() === value.toLowerCase());
                                  if (match) {
                                    updateItem(index, 'itemId', match.id);
                                    updateItem(index, 'hsn_sac', match.hsn_code || match.hsn || match.hsn_sac || '');
                                    if (match.unit) updateItem(index, 'unit', match.unit);
                                  }
                                }
                                setMaterialSearch(prev => ({ ...prev, [activeSheetId]: '' }));
                                setMaterialSearchActive(null);
                              }, 200)}
                              style={cellInputStyle}
                              ref={(el) => { inputRefs.current[`${activeSheetId}-${index}-itemId`] = el; }}
                              onKeyDown={(e) => handleKeyDown(e, index, 'itemId')}
                            />
                            {materialSearchActive?.sheetId === activeSheetId && materialSearchActive?.index === index && (
                              <div style={autocompleteStyle}>
                                {filteredMaterials.slice(0, 10).map(m => (
                                  <div
                                    key={m.id}
                                    onClick={() => {
                                      handleMaterialPick(index, m);
                                      setMaterialSearch(prev => ({ ...prev, [activeSheetId]: '' }));
                                      setMaterialSearchActive(null);
                                    }}
                                    style={autocompleteItemStyle}
                                  >
                                    {m.name}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        {col.key === 'hsn_sac' && (
                          <input
                            type="text"
                            value={item.hsn_sac || ''}
                            onChange={(e) => updateItem(index, 'hsn_sac', e.target.value)}
                            style={cellInputStyle}
                            onFocus={() => setActiveRowIndex(index)}
                          />
                        )}
                        {col.key === 'variant' && (
                          <select
                            value={item.variantId || boqData.variantId || ''}
                            onChange={(e) => {
                              updateItem(index, 'variantId', e.target.value);
                              const variant = variants.find(v => v.id === e.target.value);
                              updateItem(index, 'variantName', variant?.variant_name || '');
                              updateItem(index, 'discountPercent', getVariantDiscount(e.target.value));
                            }}
                            style={cellInputStyle}
                            ref={(el) => { inputRefs.current[`${activeSheetId}-${index}-variantId`] = el; }}
                            onKeyDown={(e) => handleKeyDown(e, index, 'variantId')}
                            onFocus={() => setActiveRowIndex(index)}
                          >
                            <option value="">Select</option>
                            {variants.map(v => <option key={v.id} value={v.id}>{v.variant_name}</option>)}
                          </select>
                        )}
                        {col.key === 'make' && (
                          <select
                            value={item.make || ''}
                            onChange={(e) => updateItem(index, 'make', e.target.value)}
                            style={cellInputStyle}
                            ref={(el) => { inputRefs.current[`${activeSheetId}-${index}-make`] = el; }}
                            onKeyDown={(e) => handleKeyDown(e, index, 'make')}
                            onFocus={() => setActiveRowIndex(index)}
                          >
                            <option value="">Select</option>
                            {makes.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                        )}
                        {col.key === 'quantity' && (
                          <input
                            type="number"
                            value={item.quantity || ''}
                            onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                            style={cellInputStyle}
                            ref={(el) => { inputRefs.current[`${activeSheetId}-${index}-quantity`] = el; }}
                            onKeyDown={(e) => handleKeyDown(e, index, 'quantity')}
                            onFocus={() => setActiveRowIndex(index)}
                          />
                        )}
                        {col.key === 'unit' && (
                          <input
                            type="text"
                            value={item.unit || ''}
                            onChange={(e) => updateItem(index, 'unit', e.target.value)}
                            style={cellInputStyle}
                            onFocus={() => setActiveRowIndex(index)}
                          />
                        )}
                        {col.key === 'rate' && (
                          <input
                            type="number"
                            value={item.rate || ''}
                            onChange={(e) => updateItem(index, 'rate', e.target.value)}
                            style={cellInputStyle}
                            ref={(el) => { inputRefs.current[`${activeSheetId}-${index}-rate`] = el; }}
                            onKeyDown={(e) => handleKeyDown(e, index, 'rate')}
                            onFocus={() => setActiveRowIndex(index)}
                          />
                        )}
                        {col.key === 'discountPercent' && (
                          <div style={{ position: 'relative' }}>
                            {(() => {
                              const base = getVariantDiscount(item.variantId || boqData.variantId);
                              const current = parseFloat(item.discountPercent) || 0;
                              const isOverride = item.discountPercent !== '' && item.discountPercent !== null && current !== base;
                              return (
                                <>
                                  <input
                                    type="number"
                                    value={item.discountPercent || ''}
                                    onChange={(e) => updateItem(index, 'discountPercent', e.target.value)}
                                    style={{ 
                                      ...cellInputStyle, 
                                      background: isOverride ? '#fff7cc' : cellInputStyle.background,
                                      borderColor: isOverride ? '#f59e0b' : cellInputStyle.borderColor
                                    }}
                                    ref={(el) => { inputRefs.current[`${activeSheetId}-${index}-discountPercent`] = el; }}
                                    onKeyDown={(e) => handleKeyDown(e, index, 'discountPercent')}
                                    title={isOverride ? `Override (default ${base}%)` : `Default ${base}%`}
                                    onFocus={() => setActiveRowIndex(index)}
                                  />
                                  {isOverride && (
                                    <span style={discountOverrideBadgeStyle}>OVERWRITE</span>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        )}
                        {col.key === 'rateAfterDiscount' && (
                          <span style={{ display: 'block', padding: '6px', color: '#333' }}>
                            {calculateRow(item).rateAfterDiscount ? `₹${calculateRow(item).rateAfterDiscount}` : '-'}
                          </span>
                        )}
                        {col.key === 'totalAmount' && (
                          <span style={{ display: 'block', padding: '6px', fontWeight: '500', color: '#1976d2' }}>
                            {calculateRow(item).totalAmount ? `₹${calculateRow(item).totalAmount.toLocaleString()}` : '-'}
                          </span>
                        )}
                        {col.key === 'specification' && (
                          <input
                            type="text"
                            value={item.specification || ''}
                            onChange={(e) => updateItem(index, 'specification', e.target.value)}
                            style={cellInputStyle}
                            ref={(el) => { inputRefs.current[`${activeSheetId}-${index}-specification`] = el; }}
                            onKeyDown={(e) => handleKeyDown(e, index, 'specification')}
                            onFocus={() => setActiveRowIndex(index)}
                          />
                        )}
                        {col.key === 'remarks' && (
                          <input
                            type="text"
                            value={item.remarks || ''}
                            onChange={(e) => updateItem(index, 'remarks', e.target.value)}
                            style={cellInputStyle}
                            ref={(el) => { inputRefs.current[`${activeSheetId}-${index}-remarks`] = el; }}
                            onKeyDown={(e) => handleKeyDown(e, index, 'remarks')}
                            onFocus={() => setActiveRowIndex(index)}
                          />
                        )}
                        {col.key === 'pressure' && (
                          <input
                            type="text"
                            value={item.pressure || ''}
                            onChange={(e) => updateItem(index, 'pressure', e.target.value)}
                            style={cellInputStyle}
                            onFocus={() => setActiveRowIndex(index)}
                          />
                        )}
                        {col.key === 'thickness' && (
                          <input
                            type="text"
                            value={item.thickness || ''}
                            onChange={(e) => updateItem(index, 'thickness', e.target.value)}
                            style={cellInputStyle}
                            onFocus={() => setActiveRowIndex(index)}
                          />
                        )}
                        {col.key === 'schedule' && (
                          <input
                            type="text"
                            value={item.schedule || ''}
                            onChange={(e) => updateItem(index, 'schedule', e.target.value)}
                            style={cellInputStyle}
                            onFocus={() => setActiveRowIndex(index)}
                          />
                        )}
                        {col.key === 'material' && (
                          <input
                            type="text"
                            value={item.material || ''}
                            onChange={(e) => updateItem(index, 'material', e.target.value)}
                            style={cellInputStyle}
                            onFocus={() => setActiveRowIndex(index)}
                          />
                        )}
                      </td>
                    ))}
                  </tr>
                )
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: '#e8f4fc', fontWeight: '600' }}>
                {visibleColumns.map(col => {
                  if (col.key === 'description') {
                    return <td key={col.key} style={{ padding: '6px', textAlign: 'right' }}>Total</td>;
                  }
                  if (col.key === 'quantity') {
                    return <td key={col.key} style={{ padding: '6px' }}>{totals.totalQty}</td>;
                  }
                  if (col.key === 'totalAmount') {
                    return <td key={col.key} style={{ padding: '6px', color: '#1976d2' }}>Rs. {totals.totalAmount.toLocaleString()}</td>;
                  }
                  return <td key={col.key} style={{ padding: '6px' }}></td>;
                })}
              </tr>
            </tfoot>
            <tfoot>
              <tr style={{ background: '#e8f4fc', fontWeight: '600' }}>
                <td colSpan={4} style={{ padding: '12px', textAlign: 'right' }}>Total</td>
                <td style={{ padding: '12px' }}>{totals.totalQty}</td>
                <td colSpan={2} style={{ padding: '12px' }}></td>
                <td style={{ padding: '12px', color: '#1976d2', fontSize: '15px' }}>₹{totals.totalAmount.toLocaleString()}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
        ) : (
          <div style={a4SheetStyle}>
            <h2 style={{ marginTop: 0, fontSize: '16px' }}>
              {isTermsSheet ? 'Terms' : 'Preface'}
            </h2>
            <textarea
              value={isTermsSheet ? boqData.termsConditions : boqData.preface}
              onChange={(e) => setBoqData(prev => ({
                ...prev,
                ...(isTermsSheet ? { termsConditions: e.target.value } : { preface: e.target.value })
              }))}
              style={a4TextareaStyle}
            />
          </div>
        )}
      </div>

      {showColumnPanel && (
        <div style={modalOverlayStyle} onClick={() => setShowColumnPanel(false)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px' }}>Adjust Columns</h3>
              <button onClick={() => setShowColumnPanel(false)} style={closeBtnStyle}><X size={20} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '400px', overflowY: 'auto' }}>
              {columnSettings.filter(c => !['rowControl', 'sno', 'rateAfterDiscount', 'totalAmount'].includes(c.key)).map(col => (
                <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={col.visible}
                    onChange={() => toggleColumnVisibility(col.key)}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <span>{col.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

        {showExportSettings && (
          <div style={modalOverlayStyle} onClick={() => setShowExportSettings(false)}>
            <div style={{ ...modalStyle, width: '520px', maxHeight: '80vh' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px' }}>Export Settings</h3>
              <button onClick={() => setShowExportSettings(false)} style={closeBtnStyle}><X size={20} /></button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontWeight: 600, marginBottom: '8px' }}>Columns</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
                {columnSettings.filter(c => c.key !== 'rowControl').map(col => (
                  <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                    <input
                      type="checkbox"
                      checked={!!exportColumns[col.key]}
                      onChange={() => setExportColumns(prev => ({ ...prev, [col.key]: !prev[col.key] }))}
                    />
                    <span>{col.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontWeight: 600, marginBottom: '8px' }}>Sheets</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>
                {sheets.map(sheet => (
                  <label key={sheet.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                    <input
                      type="checkbox"
                      checked={!!exportSheets[sheet.id]}
                      onChange={() => setExportSheets(prev => ({ ...prev, [sheet.id]: !prev[sheet.id] }))}
                    />
                    <span>{sheet.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontWeight: 600, marginBottom: '8px' }}>Orientation</div>
              <div style={{ display: 'flex', gap: '14px', fontSize: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="radio"
                    name="boq-export-orientation"
                    checked={exportOrientation === 'portrait'}
                    onChange={() => setExportOrientation('portrait')}
                  />
                  Portrait
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="radio"
                    name="boq-export-orientation"
                    checked={exportOrientation === 'landscape'}
                    onChange={() => setExportOrientation('landscape')}
                  />
                  Landscape
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                className="btn btn-primary"
                onClick={() => {
                  if (boqData.boqNo) {
                    localStorage.setItem(`boq_export_${boqData.boqNo}`, JSON.stringify({
                      columns: exportColumns,
                      sheets: exportSheets,
                      orientation: exportOrientation
                    }));
                  }
                  setShowExportSettings(false);
                }}
              >
                Save As Default
              </button>
              <button className="btn btn-secondary" onClick={() => setShowExportSettings(false)}>Close</button>
              </div>
            </div>
          </div>
        )}

        {showDiscountApplyModal && pendingDiscountChange && (
          <div style={modalOverlayStyle} onClick={() => setShowDiscountApplyModal(false)}>
            <div style={{ ...modalStyle, width: '520px' }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '18px' }}>Apply Discount to Rows</h3>
                <button onClick={() => setShowDiscountApplyModal(false)} style={closeBtnStyle}><X size={20} /></button>
              </div>
              <div style={{ fontSize: '13px', color: '#374151', marginBottom: '10px' }}>
                Do you want to copy the discount % to all rows for this variant?
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                  <input
                    type="radio"
                    name="discount-apply-mode"
                    checked={discountApplyMode === 'all'}
                    onChange={() => setDiscountApplyMode('all')}
                  />
                  Copy to all rows of this variant
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                  <input
                    type="radio"
                    name="discount-apply-mode"
                    checked={discountApplyMode === 'skip'}
                    onChange={() => setDiscountApplyMode('skip')}
                  />
                  Skip overwritten rows (only update non-overwritten)
                </label>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button className="btn btn-secondary" onClick={() => setShowDiscountApplyModal(false)}>Cancel</button>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    const { variantId, discount, prevDiscount } = pendingDiscountChange;
                    setBoqVariantDiscounts(prev => ({ ...prev, [variantId]: discount }));
                    applyVariantDiscountToRows(variantId, discount, prevDiscount, discountApplyMode);
                    setShowDiscountApplyModal(false);
                    setPendingDiscountChange(null);
                  }}
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stock Check Modal */}
        {showStockCheckModal && (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}
            onClick={() => setShowStockCheckModal(false)}
          >
            <div
              style={{ background: '#fff', borderRadius: '10px', padding: '28px', width: '420px', boxShadow: '0 8px 30px rgba(0,0,0,0.2)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 700 }}>Launch Stock Check</h3>
              <p style={{ margin: '0 0 20px', fontSize: '12px', color: '#6b7280' }}>
                Select which BOQ sheets to include in the procurement tracker.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                {sheets.map((sheet) => {
                  const isTerms = sheet.name.toLowerCase().includes('terms');
                  const isPreface = sheet.name.toLowerCase().includes('preface');
                  const itemCount = (items[sheet.id] || []).filter((r) => !r.isHeaderRow && (r.description || r.itemId)).length;

                  return (
                    <label
                      key={sheet.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '10px 14px',
                        border: `1px solid ${selectedSheets[sheet.id] ? '#1d4ed8' : '#e5e7eb'}`,
                        borderRadius: '8px',
                        cursor: isTerms || isPreface ? 'not-allowed' : 'pointer',
                        background: selectedSheets[sheet.id] ? '#eff6ff' : '#fff',
                        opacity: isTerms || isPreface ? 0.4 : 1,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={!!selectedSheets[sheet.id]}
                        disabled={isTerms || isPreface}
                        onChange={(e) =>
                          setSelectedSheets((prev) => ({ ...prev, [sheet.id]: e.target.checked }))
                        }
                        style={{ width: '16px', height: '16px', accentColor: '#1d4ed8' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '13px', color: '#111827' }}>{sheet.name}</div>
                        <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                          {isTerms || isPreface ? 'Not applicable' : `${itemCount} items`}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  onClick={() => setShowStockCheckModal(false)}
                  style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff', fontSize: '13px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleLaunchStockCheck}
                  disabled={launchingStockCheck || Object.values(selectedSheets).every((v) => !v)}
                  style={{
                    padding: '8px 18px', border: 'none', borderRadius: '6px',
                    background: '#064e3b', color: '#fff', fontSize: '13px',
                    fontWeight: 600, cursor: 'pointer',
                    opacity: launchingStockCheck || Object.values(selectedSheets).every((v) => !v) ? 0.5 : 1,
                  }}
                >
                  {launchingStockCheck ? 'Creating...' : '📦 Launch Stock Check'}
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

export default BOQ;

  const cardStyle = {
  background: 'white',
  borderRadius: '4px',
  padding: '16px',
  border: '1px solid #d0d7de',
  boxShadow: '0 1px 2px rgba(16,24,40,0.06)',
};

const btnStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '6px 12px',
  border: '1px solid #cbd5e1',
  borderRadius: '3px',
  background: '#f8fafc',
  cursor: 'pointer',
  fontSize: '12px',
};

const labelStyle = {
  display: 'block',
  fontSize: '10px',
  fontWeight: '600',
  color: '#4b5563',
  marginBottom: '4px',
};

const inputStyle = {
  width: '100%',
  padding: '4px 6px',
  border: '1px solid #cbd5e1',
  borderRadius: '2px',
  fontSize: '11px',
  boxSizing: 'border-box',
  background: '#fff',
};

const thStyle = {
  padding: '4px 4px',
  textAlign: 'center',
  fontWeight: '700',
  color: '#1f2937',
  borderBottom: '1px solid #cbd5e1',
  borderRight: '1px solid #d1d5db',
  fontSize: '11px',
  background: '#f3f4f6',
  textTransform: 'uppercase',
  letterSpacing: '0.02em',
};

const cellInputStyle = {
  width: '100%',
  padding: '2px 4px',
  border: '1px solid #e2e8f0',
  borderRadius: '0',
  fontSize: '11px',
  background: '#fff',
  boxSizing: 'border-box',
  height: '22px',
};

const iconBtnStyle = {
  padding: '2px',
  border: '1px solid transparent',
  background: 'transparent',
  cursor: 'pointer',
  color: '#6b7280',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const sheetTabStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  padding: '6px 10px',
  border: '1px solid #bfc7d1',
  borderRadius: '3px 3px 0 0',
  cursor: 'pointer',
  fontSize: '11px',
  background: '#e5e7eb',
};

const sheetCloseBtnStyle = {
  marginLeft: '2px',
  padding: '4px',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: '#999',
};

const modalOverlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const modalStyle = {
  background: 'white',
  borderRadius: '8px',
  padding: '20px',
  width: '300px',
  maxHeight: '80vh',
  overflow: 'auto',
};

const closeBtnStyle = {
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  padding: '4px',
  color: '#666',
};

const dropdownItemStyle = {
  width: '100%',
  padding: '10px 15px',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  textAlign: 'left',
  fontSize: '13px',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const variantDiscountBoxStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '5px',
  background: 'white',
  padding: '5px 10px',
  borderRadius: '4px',
  border: '1px solid #ddd',
};

const autocompleteStyle = {
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  background: 'white',
  border: '1px solid #ddd',
  borderRadius: '4px',
  boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
  maxHeight: '200px',
  overflowY: 'auto',
  zIndex: 1000,
};

const autocompleteItemStyle = {
  padding: '8px 12px',
  cursor: 'pointer',
  fontSize: '13px',
  borderBottom: '1px solid #f0f0f0',
};

const excelTableWrapStyle = {
  overflowX: 'auto',
  overflowY: 'visible',
  position: 'relative',
  border: '1px solid #cbd5e1',
  borderRadius: '4px',
  background: '#fff',
  boxShadow: 'inset 0 0 0 1px #e5e7eb',
};

const excelColumnHeaderRowStyle = {
  background: '#e5e7eb',
};

const excelColumnHeaderCellStyle = {
  padding: '2px 4px',
  textAlign: 'center',
  fontWeight: '700',
  fontSize: '11px',
  color: '#374151',
  borderBottom: '1px solid #cbd5e1',
  borderRight: '1px solid #d1d5db',
  background: '#e5e7eb',
};

const excelCornerCellStyle = {
  background: '#d9dde3',
  borderRight: '1px solid #cbd5e1',
};

const excelHeaderRowStyle = {
  background: '#f3f4f6',
};

const excelCellStyle = {
  padding: '2px 4px',
  borderBottom: '1px solid #e2e8f0',
  borderRight: '1px solid #e2e8f0',
  borderLeft: '1px solid #e2e8f0',
  background: '#fff',
};

const excelRowHeaderCellStyle = {
  background: '#f3f4f6',
  borderRight: '1px solid #cbd5e1',
};

const discountHeaderCellStyle = {
  background: '#fff4c2',
  borderBottom: '1px solid #f3d27c',
  color: '#8a5a00',
};

const discountOverrideBadgeStyle = {
  position: 'absolute',
  top: '-9px',
  right: '4px',
  background: '#f59e0b',
  color: '#fff',
  fontSize: '9px',
  padding: '1px 4px',
  borderRadius: '3px',
  letterSpacing: '0.02em',
};

const boqHeaderGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: '10px',
  marginBottom: '14px',
  fontFamily: "'Inter', sans-serif",
};

const boqHeaderCardStyle = {
  padding: '10px',
  background: '#ffffff',
  borderRadius: '4px',
  border: '1px solid #d1d5db',
  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
};

const boqHeaderTitleStyle = {
  fontSize: '12px',
  fontWeight: '700',
  color: '#111827',
  marginBottom: '8px',
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
};

const boqHeaderFieldsStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr',
  gap: '8px',
};

const boqHeaderDiscountWrapStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
};

const boqHeaderDiscountLabelStyle = {
  fontWeight: '600',
  color: '#4b5563',
  fontSize: '11px',
};

const boqHeaderDiscountListStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px',
};

const a4SheetStyle = {
  width: '210mm',
  minHeight: '297mm',
  margin: '0 auto',
  background: '#fff',
  border: '1px solid #d1d5db',
  padding: '18mm 16mm',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
};

const a4TextareaStyle = {
  flex: 1,
  width: '100%',
  minHeight: '220mm',
  border: '1px solid #e2e8f0',
  borderRadius: '4px',
  padding: '10px',
  fontSize: '12px',
  lineHeight: 1.5,
  fontFamily: "'Inter', sans-serif",
  resize: 'vertical',
};
