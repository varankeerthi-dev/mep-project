import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../../App';
import { PermissionGuard } from '../../../../rbac';
import { useClients } from '../../../../hooks/useClients';
import { useProjects } from '../../../../hooks/useProjects';
import { useMaterials } from '../../../../hooks/useMaterials';
import { useVariants } from '../../../../hooks/useVariants';
import { supabase } from '@/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Save, FileDown, Plus, Trash2, Sheet, Table, X,
  Settings, FileSpreadsheet, Loader2, GripVertical, ArrowLeft,
} from 'lucide-react';
import { openSansRegular, openSansBold } from '../../../../fonts/openSans';
import {
  getBOQWithSections, createBOQ, updateBOQ,
  createSection, replaceSectionItems,
  generateBOQNumber, getPriceMap, getClientDiscountProfile,
  listSections,
} from '../../api/boq';
import type { BOQHeaderInput, BOQSectionInput, BOQItemInput } from '../../model';
import { BOQ_STATUSES } from '../../constants';
import { withTimeout } from '../../../../utils/queryTimeout';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const generateId = () => `temp-${Math.random().toString(36).substr(2, 9)}`;

const calcRow = (rate: any, discountPercent: any, quantity: any) => {
  const r = parseFloat(rate) || 0;
  const d = parseFloat(discountPercent) || 0;
  const q = parseFloat(quantity) || 0;
  const rateAfterDiscount = Math.round(r - (r * d) / 100);
  const totalAmount = rateAfterDiscount * q;
  return { rateAfterDiscount, totalAmount };
};

const getColumnLabel = (index: number) => {
  let label = '';
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
};

const DEFAULT_TERMS = [
  'All prices are inclusive of applicable taxes unless specified otherwise.',
  'Delivery timeline will be confirmed after order acceptance.',
  'Payment terms: 50% advance, balance within 7 days of delivery.',
  'Warranty as per manufacturer standard terms.',
  'Any variation in quantities will be billed as per actuals.',
  'Freight and handling charges are extra unless specified.',
  'Offer valid for 15 days from the BOQ date.',
].map((t, i) => `${i + 1}. ${t}`).join('\n');

// ─── Types ─────────────────────────────────────────────────────────────────────

type LocalItem = {
  id: string;
  description: string;
  specification: string;
  hsn_sac: string;
  unit: string;
  quantity: string;
  rate: string;
  discount_percent: string;
  make: string;
  variant_id: string;
  variant_name: string;
  material_id: string | null;
  pressure: string;
  thickness: string;
  schedule: string;
  material: string;
  remarks: string;
};

type SectionTab = {
  id: string;
  name: string;
  items: LocalItem[];
};

type ColumnSetting = {
  key: string;
  label: string;
  width: number;
  visible: boolean;
};

// ─── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_COLUMNS: ColumnSetting[] = [
  { key: 'rowControl', label: '', width: 40, visible: true },
  { key: 'sno', label: 'S.No', width: 50, visible: true },
  { key: 'hsn_sac', label: 'HSN/SAC', width: 90, visible: true },
  { key: 'description', label: 'Description', width: 250, visible: true },
  { key: 'variant', label: 'Discount Category', width: 100, visible: true },
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

const FIELD_ORDER = ['material_id', 'variant_id', 'make', 'quantity', 'rate', 'discount_percent', 'specification', 'remarks'];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BOQFormPage() {
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');
  const isEdit = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { organisation, user } = useAuth();

  const { data: materials = [] } = useMaterials();
  const { data: clients = [] } = useClients();
  const { data: projects = [] } = useProjects();
  const { data: variants = [] } = useVariants();

  // ─── Form State ─────────────────────────────────────────────────────────────

  const [form, setForm] = useState({
    boq_no: '',
    revision_no: 1,
    title: '',
    client_id: '',
    project_id: '',
    variant_id: '',
    date: new Date().toISOString().split('T')[0],
    status: 'Draft' as string,
    currency: 'INR',
    terms_conditions: '',
    preface: '',
    notes: '',
  });

  const [sections, setSections] = useState<SectionTab[]>([]);
  const [activeSectionId, setActiveSectionId] = useState<string>('');
  const [columnSettings, setColumnSettings] = useState<ColumnSetting[]>(DEFAULT_COLUMNS);
  const [showColumnPanel, setShowColumnPanel] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showExportSettings, setShowExportSettings] = useState(false);
  const [exportColumns, setExportColumns] = useState<Record<string, boolean>>({});
  const [exportSheets, setExportSheets] = useState<Record<string, boolean>>({});
  const [exportOrientation, setExportOrientation] = useState('landscape');
  const [saveError, setSaveError] = useState('');
  const [dragRowIndex, setDragRowIndex] = useState<number | null>(null);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionName, setEditingSectionName] = useState('');
  const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null);
  const [showDiscountApplyModal, setShowDiscountApplyModal] = useState(false);
  const [pendingDiscountChange, setPendingDiscountChange] = useState<{ variantId: string; discount: number; prevDiscount: number } | null>(null);
  const [discountApplyMode, setDiscountApplyMode] = useState('skip');
  const [materialSearchActive, setMaterialSearchActive] = useState<{ sectionId: string; index: number } | null>(null);
  const [dropdownPortal, setDropdownPortal] = useState<{
    sectionId: string; rowIndex: number; items: typeof materials; position: { top: number; left: number; width: number };
  } | null>(null);
  const [boqId, setBoqId] = useState<string | null>(id || null);
  const [isSaving, setIsSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [showStockCheckModal, setShowStockCheckModal] = useState(false);
  const [selectedSheets, setSelectedSheets] = useState<Record<string, boolean>>({});
  const [launchingStockCheck, setLaunchingStockCheck] = useState(false);

  const inputRefs = useRef<Record<string, HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null>>({});
  const prevDefaultVariantRef = useRef('');
  const undoStackRef = useRef<Record<string, LocalItem[][]>>({});
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copiedRowRef = useRef<LocalItem | null>(null);
  const hydratedKeyRef = useRef<string | null>(null);

  // ─── Queries ────────────────────────────────────────────────────────────────

  const priceMapQuery = useQuery({
    queryKey: ['est-boq-price-map', form.variant_id],
    queryFn: () => getPriceMap(form.variant_id || undefined),
    enabled: variants.length > 0,
  });
  const priceMap = priceMapQuery.data || new Map<string, number>();

  const clientDiscountsQuery = useQuery({
    queryKey: ['est-boq-client-discounts', form.client_id],
    queryFn: () => getClientDiscountProfile(form.client_id),
    enabled: !!form.client_id,
  });
  const clientDiscounts = clientDiscountsQuery.data?.discountMap || {};

  const [boqVariantDiscounts, setBoqVariantDiscounts] = useState<Record<string, number>>({});

  const getVariantDiscount = useCallback((variantId: string) => {
    if (boqVariantDiscounts[variantId] !== undefined) return boqVariantDiscounts[variantId];
    return clientDiscounts[variantId]?.discount || 0;
  }, [boqVariantDiscounts, clientDiscounts]);

  const getPriceFromMap = useCallback((materialId: string, variantId: string, make: string): number => {
    const withMake = priceMap.get(`${materialId}__${variantId}__${make}`);
    if (withMake) return withMake;
    const withVariant = priceMap.get(`${materialId}__${variantId}__`);
    if (withVariant) return withVariant;
    return 0;
  }, [priceMap]);

  // ─── Load existing BOQ ──────────────────────────────────────────────────────

  const loadExisting = useCallback(async () => {
    if (!id || !organisation?.id) return;
    try {
      const full = await getBOQWithSections(id);
      setForm({
        boq_no: full.boq_no || '',
        revision_no: full.revision_no || 1,
        title: full.title || '',
        client_id: full.client_id || '',
        project_id: full.project_id || '',
        variant_id: full.variant_id || '',
        date: (full.date || '').split('T')[0],
        status: full.status || 'Draft',
        currency: full.currency || 'INR',
        terms_conditions: full.terms_conditions || '',
        preface: full.preface || '',
        notes: full.notes || '',
      });
      setBoqId(full.id);
      const loadedSections = (full as any).sections || [];
      if (loadedSections.length > 0) {
        const mapped: SectionTab[] = loadedSections.map((s: any) => ({
          id: s.id,
          name: s.name,
          items: (s.items || []).map((item: any) => ({
            id: item.id,
            description: item.description || '',
            specification: item.specification || '',
            hsn_sac: item.hsn_sac || '',
            unit: item.unit || '',
            quantity: String(item.quantity ?? ''),
            rate: String(item.rate ?? ''),
            discount_percent: String(item.discount_percent ?? ''),
            make: item.make || '',
            variant_id: item.variant_id || full.variant_id || '',
            variant_name: '',
            material_id: item.material_id || null,
            pressure: item.pressure || '',
            thickness: item.thickness || '',
            schedule: item.schedule || '',
            material: item.material || '',
            remarks: item.remarks || '',
          })),
        }));
        setSections(mapped);
        setActiveSectionId(mapped[0].id);
      }
      setInitialized(true);
    } catch (err) {
      console.error('Failed to load BOQ:', err);
      setSaveError('Failed to load BOQ');
    }
  }, [id, organisation?.id]);

  useEffect(() => {
    if (!initialized && id) loadExisting();
  }, [id, loadExisting, initialized]);

  // ─── Init new BOQ ───────────────────────────────────────────────────────────

  const initNewBOQ = useCallback(async () => {
    if (initialized || id) return;
    try {
      if (organisation?.id) {
        const num = await generateBOQNumber(organisation.id);
        setForm((prev) => ({ ...prev, boq_no: num, terms_conditions: DEFAULT_TERMS }));
      }
      const defaultSection: SectionTab = {
        id: generateId(),
        name: 'BOQ Sheet 1',
        items: [],
      };
      setSections([defaultSection]);
      setActiveSectionId(defaultSection.id);
      setInitialized(true);
    } catch (err) {
      console.error('Failed to init BOQ:', err);
      const defaultSection: SectionTab = { id: generateId(), name: 'BOQ Sheet 1', items: [] };
      setSections([defaultSection]);
      setActiveSectionId(defaultSection.id);
      setInitialized(true);
    }
  }, [id, organisation?.id, initialized]);

  useEffect(() => {
    if (!initialized && !id) initNewBOQ();
  }, [id, initNewBOQ, initialized]);

  // Auto-fill descriptions from materials
  useEffect(() => {
    if (!materials.length || !sections.length) return;
    let changed = false;
    const next = sections.map((sec) => ({
      ...sec,
      items: sec.items.map((item) => {
        if (item.description || !item.material_id) return item;
        const mat = materials.find((m: any) => m.id === item.material_id);
        if (mat?.display_name || mat?.name) {
          changed = true;
          return { ...item, description: mat.display_name || mat.name || '' };
        }
        return item;
      }),
    }));
    if (changed) setSections(next);
  }, [materials]);

  // ─── Derived State ──────────────────────────────────────────────────────────

  const makes = useMemo(() => [...new Set(materials.map((m: any) => m.make).filter(Boolean))], [materials]);
  const activeSection = sections.find((s) => s.id === activeSectionId);
  const currentItems = activeSection?.items || [];
  const isTermsOrPreface = false;

  const visibleColumns = useMemo(() => columnSettings.filter((c) => c.visible), [columnSettings]);
  const columnWidths = useMemo(() => {
    const w: Record<string, number> = {};
    visibleColumns.forEach((c) => { w[c.key] = c.width; });
    return w;
  }, [visibleColumns]);
  const columnLetters = useMemo(() => visibleColumns.map((_, i) => getColumnLabel(i)), [visibleColumns]);
  const exportColumnList = useMemo(() => columnSettings.filter((c) => exportColumns[c.key]), [columnSettings, exportColumns]);

  // ─── Virtualizer ────────────────────────────────────────────────────────────

  const tableBodyRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: currentItems.length,
    getScrollElement: () => tableBodyRef.current,
    estimateSize: () => 28,
    overscan: 10,
  });

  // ─── Totals ─────────────────────────────────────────────────────────────────

  const totals = useMemo(() => {
    let totalQty = 0, totalAmount = 0;
    currentItems.forEach((item) => {
      totalQty += parseFloat(item.quantity) || 0;
      const { totalAmount: ta } = calcRow(item.rate, item.discount_percent, item.quantity);
      totalAmount += ta;
    });
    return { totalQty, totalAmount };
  }, [currentItems]);

  const snoMap = useMemo(() => {
    const map: Record<number, number> = {};
    let sno = 0;
    currentItems.forEach((item, i) => {
      if (item.description || item.quantity || item.rate) {
        sno++;
        map[i] = sno;
      }
    });
    return map;
  }, [currentItems]);

  // ─── Undo ───────────────────────────────────────────────────────────────────

  const pushUndo = useCallback(() => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => {
      const snapshot = JSON.parse(JSON.stringify(currentItems));
      if (!undoStackRef.current[activeSectionId]) undoStackRef.current[activeSectionId] = [];
      undoStackRef.current[activeSectionId].push(snapshot);
      if (undoStackRef.current[activeSectionId].length > 30) undoStackRef.current[activeSectionId].shift();
    }, 500);
  }, [activeSectionId, currentItems]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      if (!isCtrl) return;
      if (e.key.toLowerCase() === 'z') {
        e.preventDefault();
        const last = (undoStackRef.current[activeSectionId] || []).pop();
        if (last) {
          setSections((prev) => prev.map((s) => s.id === activeSectionId ? { ...s, items: last } : s));
        }
      }
      if (e.key.toLowerCase() === 'c') {
        if (activeRowIndex == null) return;
        const row = currentItems[activeRowIndex];
        if (!row) return;
        copiedRowRef.current = { ...row };
      }
      if (e.key.toLowerCase() === 'v') {
        if (activeRowIndex == null) return;
        const row = copiedRowRef.current;
        if (!row) return;
        const list = [...currentItems];
        const target = list[activeRowIndex];
        if (!target) return;
        list[activeRowIndex] = { ...row, id: target.id };
        setSections((prev) => prev.map((s) => s.id === activeSectionId ? { ...s, items: list } : s));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeSectionId, activeRowIndex, currentItems]);

  // ─── Auto-pad rows ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!sections.length || currentItems.length >= 10) return;
    const extra: LocalItem[] = Array.from({ length: 10 - currentItems.length }).map(() => ({
      id: generateId(), description: '', specification: '', hsn_sac: '', unit: '',
      quantity: '', rate: '', discount_percent: String(getVariantDiscount(form.variant_id)),
      make: '', variant_id: form.variant_id, variant_name: '', material_id: null,
      pressure: '', thickness: '', schedule: '', material: '', remarks: '',
    }));
    setSections((prev) => prev.map((s) => s.id === activeSectionId ? { ...s, items: [...s.items, ...extra] } : s));
  }, [activeSectionId, form.variant_id]);

  // ─── Row mutations ──────────────────────────────────────────────────────────

  const updateItem = useCallback((index: number, field: string, value: any) => {
    pushUndo();
    setSections((prev) => prev.map((sec) => {
      if (sec.id !== activeSectionId) return sec;
      const list = [...sec.items];
      list[index] = { ...list[index], [field]: value };
      if (field === 'variant_id' && value && list[index].material_id) {
        const price = getPriceFromMap(list[index].material_id!, value, list[index].make || '');
        if (price) list[index] = { ...list[index], rate: String(price) };
        list[index] = { ...list[index], discount_percent: String(getVariantDiscount(value)) };
      }
      if (field === 'make' && list[index].material_id) {
        const vid = list[index].variant_id || form.variant_id;
        const price = getPriceFromMap(list[index].material_id!, vid, value);
        if (price) list[index] = { ...list[index], rate: String(price) };
      }
      return { ...sec, items: list };
    }));
  }, [activeSectionId, pushUndo, getPriceFromMap, getVariantDiscount, form.variant_id]);

  const handleMaterialPick = useCallback((index: number, material: any) => {
    pushUndo();
    setSections((prev) => prev.map((sec) => {
      if (sec.id !== activeSectionId) return sec;
      const list = [...sec.items];
      const row = { ...list[index] };
      row.material_id = material.id;
      row.description = material.display_name || material.name || row.description;
      row.hsn_sac = material.hsn_code || material.hsn || material.hsn_sac || row.hsn_sac || '';
      row.unit = material.unit || row.unit || '';
      row.make = material.make || row.make || '';
      if (!row.variant_id && form.variant_id) {
        row.variant_id = form.variant_id;
        row.discount_percent = String(getVariantDiscount(form.variant_id));
      }
      const price = getPriceFromMap(material.id, row.variant_id || form.variant_id, row.make || '');
      row.rate = String(price || material.sale_price || row.rate || '');
      list[index] = row;
      return { ...sec, items: list };
    }));
  }, [activeSectionId, form.variant_id, getVariantDiscount, getPriceFromMap, pushUndo]);

  const insertRow = useCallback((afterIndex: number) => {
    const newRow: LocalItem = {
      id: generateId(), description: '', specification: '', hsn_sac: '', unit: '',
      quantity: '', rate: '', discount_percent: String(getVariantDiscount(form.variant_id)),
      make: '', variant_id: form.variant_id, variant_name: '', material_id: null,
      pressure: '', thickness: '', schedule: '', material: '', remarks: '',
    };
    setSections((prev) => prev.map((sec) => {
      if (sec.id !== activeSectionId) return sec;
      const list = [...sec.items];
      list.splice(afterIndex + 1, 0, newRow);
      return { ...sec, items: list };
    }));
    setTimeout(() => {
      inputRefs.current[`${activeSectionId}-${afterIndex + 1}-material_id`]?.focus();
    }, 50);
  }, [activeSectionId, form.variant_id, getVariantDiscount]);

  const deleteRow = useCallback((index: number) => {
    setSections((prev) => prev.map((sec) => {
      if (sec.id !== activeSectionId) return sec;
      return { ...sec, items: sec.items.filter((_, i) => i !== index) };
    }));
  }, [activeSectionId]);

  const handleRowDragStart = (e: React.DragEvent, index: number) => {
    const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea') { e.preventDefault(); return; }
    setDragRowIndex(index);
  };

  const handleRowDrop = (index: number) => {
    if (dragRowIndex === null || dragRowIndex === index) return;
    setSections((prev) => prev.map((sec) => {
      if (sec.id !== activeSectionId) return sec;
      const list = [...sec.items];
      const [moved] = list.splice(dragRowIndex, 1);
      list.splice(index, 0, moved);
      return { ...sec, items: list };
    }));
    setDragRowIndex(null);
  };

  // ─── Section Management ─────────────────────────────────────────────────────

  const addNewSection = () => {
    const s: SectionTab = { id: generateId(), name: `BOQ Sheet ${sections.length + 1}`, items: [] };
    setSections((prev) => [...prev, s]);
    setActiveSectionId(s.id);
  };

  const deleteSection = (sectionId: string) => {
    if (sections.length <= 1) return;
    setSections((prev) => {
      const next = prev.filter((s) => s.id !== sectionId);
      if (activeSectionId === sectionId) setActiveSectionId(next[0].id);
      return next;
    });
  };

  const [dragSectionId, setDragSectionId] = useState<string | null>(null);

  const handleSectionDrop = (sectionId: string) => {
    if (!dragSectionId || dragSectionId === sectionId) return;
    const current = [...sections];
    const from = current.findIndex((s) => s.id === dragSectionId);
    const to = current.findIndex((s) => s.id === sectionId);
    if (from < 0 || to < 0) return;
    const [moved] = current.splice(from, 1);
    current.splice(to, 0, moved);
    setSections(current);
    setDragSectionId(null);
  };

  // ─── Discount ───────────────────────────────────────────────────────────────

  const handleVariantDiscountChange = (variantId: string, value: string) => {
    const discount = parseFloat(value) || 0;
    const prevDiscount = getVariantDiscount(variantId);
    setPendingDiscountChange({ variantId, discount, prevDiscount });
    setDiscountApplyMode('skip');
    setShowDiscountApplyModal(true);
  };

  const applyVariantDiscountToRows = useCallback((variantId: string, newDiscount: number, mode: string) => {
    setSections((prev) => prev.map((sec) => ({
      ...sec,
      items: sec.items.map((row) => {
        const isTarget = row.variant_id ? row.variant_id === variantId : form.variant_id === variantId;
        if (!isTarget) return row;
        if (mode === 'skip') {
          const current = row.discount_percent;
          const isOverwritten = current !== '' && current !== null && parseFloat(String(current)) !== newDiscount;
          if (isOverwritten) return row;
        }
        return { ...row, discount_percent: String(newDiscount) };
      }),
    })));
  }, [form.variant_id]);

  // ─── Default variant change ──────────────────────────────────────────────────

  useEffect(() => {
    const prev = prevDefaultVariantRef.current;
    if (prev === form.variant_id) return;
    prevDefaultVariantRef.current = form.variant_id;
    setSections((prevSections) => prevSections.map((sec) => ({
      ...sec,
      items: sec.items.map((row) => {
        const usesHeader = !row.variant_id || row.variant_id === prev;
        if (!usesHeader) return row;
        const nextVId = form.variant_id || row.variant_id || '';
        const price = row.material_id ? getPriceFromMap(row.material_id, nextVId, row.make || '') : null;
        return {
          ...row, variant_id: nextVId,
          discount_percent: String(getVariantDiscount(nextVId)),
          ...(price ? { rate: String(price) } : {}),
        };
      }),
    })));
  }, [form.variant_id, getVariantDiscount, getPriceFromMap]);

  // ─── Variant discounts init from client ─────────────────────────────────────

  useEffect(() => {
    if (clientDiscountsQuery.data?.discountMap) {
      const initial: Record<string, number> = {};
      Object.entries(clientDiscountsQuery.data.discountMap).forEach(([k, v]) => {
        initial[k] = v.discount;
      });
      setBoqVariantDiscounts(initial);
    }
  }, [clientDiscountsQuery.data]);

  // ─── Export settings ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!form.boq_no) return;
    const key = `boq_export_${form.boq_no}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const p = JSON.parse(saved);
        if (p?.columns) setExportColumns(p.columns);
        if (p?.sheets) setExportSheets(p.sheets);
        if (p?.orientation) setExportOrientation(p.orientation);
      } catch { }
    }
  }, [form.boq_no]);

  useEffect(() => {
    const sel: Record<string, boolean> = {};
    sections.forEach((s) => { sel[s.id] = true; });
    setExportSheets(sel);
  }, [sections]);

  useEffect(() => {
    const sel: Record<string, boolean> = {};
    columnSettings.forEach((c) => { sel[c.key] = c.visible; });
    setExportColumns(sel);
  }, [columnSettings]);

  const toggleColumnVisibility = (key: string) =>
    setColumnSettings((prev) => prev.map((c) => c.key === key ? { ...c, visible: !c.visible } : c));

  // ─── Save ───────────────────────────────────────────────────────────────────

  const currentClient = clients.find((c: any) => c.id === form.client_id);
  const currentProject = projects.find((p: any) => p.id === form.project_id);

  const handleSave = async () => {
    if (!organisation?.id) return;
    setIsSaving(true);
    setSaveError('');
    try {
      const headerPayload: any = {
        boq_no: form.boq_no || `BOQ-${Date.now()}`,
        revision_no: form.revision_no,
        title: form.title || null,
        project_id: form.project_id || null,
        client_id: form.client_id || null,
        variant_id: form.variant_id || null,
        date: form.date || null,
        status: form.status,
        currency: form.currency,
        terms_conditions: form.terms_conditions || null,
        preface: form.preface || null,
        notes: form.notes || null,
      };

      let headerId = boqId;
      if (!headerId) {
        const created = await createBOQ({ ...headerPayload, organisation_id: organisation.id });
        headerId = created.id!;
        setBoqId(headerId);
      } else {
        await updateBOQ(headerId, headerPayload);
      }

      // Save sections + items
      const updatedSections: SectionTab[] = [];

      for (let si = 0; si < sections.length; si++) {
        const section = sections[si];
        const isTemp = section.id.startsWith('temp-');
        let sectionId = section.id;

        if (isTemp) {
          const created = await createSection({ boq_id: headerId, name: section.name, section_order: si + 1 });
          sectionId = created.id!;
        } else {
          await supabase.from('est_boq_sections').update({ name: section.name, section_order: si + 1 }).eq('id', sectionId);
        }

        const itemInputs = section.items
          .filter((item) => item.description || item.material_id)
          .map((item, i) => ({
            section_id: sectionId,
            description: item.description || '',
            specification: item.specification || null,
            hsn_sac: item.hsn_sac || null,
            unit: item.unit || null,
            quantity: parseFloat(item.quantity) || 0,
            rate: parseFloat(item.rate) || 0,
            discount_percent: parseFloat(item.discount_percent) || 0,
            make: item.make || null,
            variant_id: item.variant_id || null,
            material_id: item.material_id || null,
            pressure: item.pressure || null,
            thickness: item.thickness || null,
            schedule: item.schedule || null,
            material: item.material || null,
            remarks: item.remarks || null,
            item_order: i + 1,
          }));

        await replaceSectionItems(sectionId, itemInputs as any);
        updatedSections.push({ ...section, id: sectionId });
      }

      setSections(updatedSections);
      const activeIdx = sections.findIndex((s) => s.id === activeSectionId);
      if (activeIdx >= 0) setActiveSectionId(updatedSections[activeIdx].id);

      queryClient.invalidateQueries({ queryKey: ['estimation.boqs'] });
      navigate(`/estimation/boq/detail?id=${headerId}`);
    } catch (err: any) {
      setSaveError(`Error saving BOQ: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Export ──────────────────────────────────────────────────────────────────

  const exportToPDF = useCallback(() => {
    const doc = new jsPDF(exportOrientation as any, 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginX = 10;
    if (openSansRegular && openSansBold) {
      try {
        doc.addFileToVFS('OpenSans-Regular.ttf', openSansRegular);
        doc.addFileToVFS('OpenSans-Bold.ttf', openSansBold);
        doc.addFont('OpenSans-Regular.ttf', 'OpenSans', 'normal');
        doc.addFont('OpenSans-Bold.ttf', 'OpenSans', 'bold');
        doc.setFont('OpenSans', 'normal');
      } catch { }
    }

    const orderedColumns = (exportColumnList.length ? exportColumnList : columnSettings).filter((c) => c.key !== 'rowControl');
    const colWidths: Record<string, number> = {
      sno: 12, hsn_sac: 18, description: 80, variant: 20, make: 20,
      quantity: 15, unit: 18, rate: 20, discountPercent: 18, rateAfterDiscount: 22,
      totalAmount: 22, specification: 24, remarks: 24, pressure: 18, thickness: 18, schedule: 18, material: 22,
    };
    const columns = orderedColumns.map((col) => ({
      key: col.key, title: col.label,
      width: colWidths[col.key] || col.width || 20,
      align: col.key === 'description' ? 'left' : 'center',
    }));
    const totalWidth = columns.reduce((s, c) => s + c.width, 0) || 1;
    const scale = (pageWidth - marginX * 2) / totalWidth;
    const columnStyles: Record<number, any> = {};
    columns.forEach((c, i) => { columnStyles[i] = { cellWidth: c.width * scale, halign: c.align }; });

    const renderHeader = (name: string) => {
      doc.setFont('OpenSans', 'normal'); doc.setFontSize(12);
      doc.text('BILL OF QUANTITIES', marginX, 12);
      doc.setFont('OpenSans', 'bold');
      doc.text(name, pageWidth / 2, 12, { align: 'center' });
      const labelW = 26;
      const valueW = (pageWidth - marginX * 2 - labelW * 2) / 2;
      autoTable(doc, {
        startY: 16, theme: 'grid',
        styles: { font: 'OpenSans', fontSize: 9, cellPadding: 1.2, textColor: 20, lineColor: [0, 0, 0], lineWidth: 0.1 },
        head: [],
        body: [
          ['Client:', currentClient?.client_name || '', 'Project:', currentProject?.project_name || ''],
          ['BoQ No:', form.boq_no || '', 'Date:', form.date || ''],
          ['Revision no:', String(form.revision_no || ''), 'Date:', form.date || ''],
        ],
        columnStyles: {
          0: { cellWidth: labelW, halign: 'left', fontStyle: 'bold' },
          1: { cellWidth: valueW, halign: 'left' },
          2: { cellWidth: labelW, halign: 'left', fontStyle: 'bold' },
          3: { cellWidth: valueW, halign: 'left' },
        },
      });
    };

    const renderTable = (items: LocalItem[]) => {
      const rows: any[][] = [];
      let sno = 0, sheetTotalQty = 0, sheetTotalAmount = 0;
      const dataRows = items.filter((i) => i.description || i.quantity || i.rate);
      const targetRows = Math.max(20, dataRows.length);
      dataRows.forEach((item) => {
        const empty = !item.description && !item.quantity && !item.rate;
        if (!empty) sno++;
        const { rateAfterDiscount, totalAmount } = calcRow(item.rate, item.discount_percent, item.quantity);
        sheetTotalQty += parseFloat(item.quantity) || 0;
        sheetTotalAmount += totalAmount;
        rows.push(columns.map((c) => {
          switch (c.key) {
            case 'sno': return empty ? '' : sno;
            case 'description': return item.description || '';
            case 'hsn_sac': return item.hsn_sac || '';
            case 'variant': return '';
            case 'make': return item.make || '';
            case 'quantity': return item.quantity || '';
            case 'unit': return item.unit || '';
            case 'rate': return item.rate || '';
            case 'discountPercent': return item.discount_percent || '';
            case 'rateAfterDiscount': return rateAfterDiscount || '';
            case 'totalAmount': return totalAmount || '';
            case 'specification': return item.specification || '';
            case 'remarks': return item.remarks || '';
            case 'pressure': return item.pressure || '';
            case 'thickness': return item.thickness || '';
            case 'schedule': return item.schedule || '';
            case 'material': return item.material || '';
            default: return '';
          }
        }));
      });
      while (rows.length < targetRows) rows.push(columns.map(() => ''));
      rows.push(columns.map((c) => {
        if (c.key === 'description') return 'Total';
        if (c.key === 'quantity') return sheetTotalQty || '';
        if (c.key === 'totalAmount') return sheetTotalAmount ? sheetTotalAmount.toLocaleString() : '';
        return '';
      }));
      autoTable(doc, {
        startY: 38, head: [columns.map((c) => c.title)], body: rows, theme: 'grid',
        styles: { font: 'OpenSans', fontSize: 8, cellPadding: 1.2, textColor: 20, lineColor: [0, 0, 0], lineWidth: 0.1 },
        headStyles: { fontStyle: 'bold', fillColor: [245, 245, 245], textColor: 20, lineColor: [0, 0, 0], lineWidth: 0.2, halign: 'center' },
        columnStyles,
        didParseCell: (data: any) => {
          if (data.section === 'head' && columns[data.column.index]?.key === 'discountPercent') {
            data.cell.styles.fillColor = [255, 244, 194];
          }
          if (data.section === 'body' && data.row.index === rows.length - 1) {
            data.cell.styles.fillColor = [216, 232, 247];
            data.cell.styles.fontStyle = 'bold';
          }
        },
      });
    };

    sections.forEach((section, idx) => {
      const name = section.name.toLowerCase();
      if (name.includes('terms') || name.includes('preface')) return;
      if (idx > 0) doc.addPage();
      renderHeader(section.name);
      renderTable(section.items);
    });

    // Terms/Preface pages
    if (form.terms_conditions) {
      doc.addPage();
      doc.setFont('OpenSans', 'bold'); doc.setFontSize(14);
      doc.text('Terms', marginX, 12);
      doc.setFont('OpenSans', 'normal'); doc.setFontSize(9);
      doc.text(doc.splitTextToSize(form.terms_conditions, pageWidth - marginX * 2), marginX, 20);
    }
    if (form.preface) {
      doc.addPage();
      doc.setFont('OpenSans', 'bold'); doc.setFontSize(14);
      doc.text('Preface', marginX, 12);
      doc.setFont('OpenSans', 'normal'); doc.setFontSize(9);
      doc.text(doc.splitTextToSize(form.preface, pageWidth - marginX * 2), marginX, 20);
    }

    doc.save(`${form.boq_no || 'BOQ'}.pdf`);
    setShowExportMenu(false);
  }, [form, currentClient, currentProject, sections, exportColumnList, exportOrientation, columnSettings]);

  const exportToExcel = useCallback(async () => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    const orderedColumns = (exportColumnList.length ? exportColumnList : columnSettings).filter((c) => c.key !== 'rowControl');

    sections.forEach((section) => {
      const name = section.name.toLowerCase();
      if (name.includes('terms') || name.includes('preface')) return;
      const sheetData: any[][] = [];
      let sno = 0;
      sheetData.push(['BOQ No', form.boq_no, 'Revision', form.revision_no]);
      sheetData.push(['Date', form.date]);
      sheetData.push(['Client', currentClient?.client_name || '']);
      sheetData.push(['Project', currentProject?.project_name || '']);
      sheetData.push([]);
      sheetData.push(orderedColumns.map((col) => col.label));
      section.items.forEach((item) => {
        sno++;
        const { rateAfterDiscount, totalAmount } = calcRow(item.rate, item.discount_percent, item.quantity);
        sheetData.push(orderedColumns.map((col) => {
          switch (col.key) {
            case 'sno': return sno;
            case 'description': return item.description || '';
            case 'hsn_sac': return item.hsn_sac || '';
            case 'variant': return item.variant_name || '';
            case 'make': return item.make || '';
            case 'quantity': return item.quantity || '';
            case 'unit': return item.unit || '';
            case 'rate': return item.rate || '';
            case 'discountPercent': return item.discount_percent || '';
            case 'rateAfterDiscount': return rateAfterDiscount;
            case 'totalAmount': return totalAmount;
            case 'specification': return item.specification || '';
            case 'remarks': return item.remarks || '';
            case 'pressure': return item.pressure || '';
            case 'thickness': return item.thickness || '';
            case 'schedule': return item.schedule || '';
            case 'material': return item.material || '';
            default: return '';
          }
        }));
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetData), section.name.substring(0, 31));
    });
    XLSX.writeFile(wb, `${form.boq_no || 'BOQ'}.xlsx`);
    setShowExportMenu(false);
  }, [form, currentClient, currentProject, sections, exportColumnList, columnSettings]);

  // ─── Stock Check ────────────────────────────────────────────────────────────

  const handleLaunchStockCheck = async () => {
    const sheetIds = Object.entries(selectedSheets).filter(([, v]) => v).map(([id]) => id);
    if (!sheetIds.length) { alert('Please select at least one sheet.'); return; }
    setLaunchingStockCheck(true);
    try {
      const { data: listData, error: listError } = await supabase.from('procurement_lists').insert({
        organisation_id: organisation?.id,
        title: `${form.boq_no} — Stock Check`,
        source: 'boq',
        boq_id: boqId || null,
        boq_no: form.boq_no || null,
        client_id: form.client_id || null,
        client_name: currentClient?.client_name || null,
        project_id: form.project_id || null,
        project_name: currentProject?.project_name || null,
        status: 'Active',
      }).select().single();
      if (listError) throw listError;
      let order = 0;
      const rows: any[] = [];
      sections.forEach((section) => {
        if (!sheetIds.includes(section.id)) return;
        section.items.forEach((row) => {
          if (!row.description && !row.material_id && !row.quantity) return;
          rows.push({
            list_id: listData.id,
            organisation_id: organisation?.id,
            item_id: row.material_id || null,
            item_name: row.description || '',
            make: row.make || null,
            uom: row.unit || null,
            boq_qty: parseFloat(row.quantity) || 0,
            stock_qty: 0, local_qty: 0, vendor_id: null, notes: null,
            status: 'Pending', display_order: order++, is_header_row: false,
          });
        });
      });
      if (rows.length > 0) {
        const { error } = await supabase.from('procurement_items').insert(rows);
        if (error) throw error;
      }
      setShowStockCheckModal(false);
      navigate(`/procurement/detail?id=${listData.id}`);
    } catch (e: any) {
      alert('Error launching stock check: ' + e.message);
    } finally {
      setLaunchingStockCheck(false);
    }
  };

  // ─── Loading ────────────────────────────────────────────────────────────────

  if (!initialized) {
    return <div className="p-6 text-zinc-500">Loading BOQ...</div>;
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-zinc-100 rounded">
            <ArrowLeft className="h-5 w-5 text-zinc-600" />
          </button>
          <h1 className="text-xl font-semibold text-zinc-800">{isEdit ? 'Edit BOQ' : 'New BOQ'}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowColumnPanel(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-zinc-300 rounded-lg hover:bg-zinc-50">
            <Settings className="h-4 w-4" /> Columns
          </button>
          <div className="relative">
            <button onClick={() => setShowExportMenu(!showExportMenu)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-zinc-300 rounded-lg hover:bg-zinc-50">
              <FileDown className="h-4 w-4" /> Export
            </button>
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-zinc-200 rounded-lg shadow-lg z-50 min-w-[160px]">
                <button onClick={exportToPDF} className="w-full px-4 py-2 text-sm text-left hover:bg-zinc-50 flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" /> Export to PDF
                </button>
                <button onClick={exportToExcel} className="w-full px-4 py-2 text-sm text-left hover:bg-zinc-50 flex items-center gap-2">
                  <Table className="h-4 w-4" /> Export to Excel
                </button>
                <button onClick={() => { setShowExportSettings(true); setShowExportMenu(false); }} className="w-full px-4 py-2 text-sm text-left hover:bg-zinc-50 flex items-center gap-2">
                  <Settings className="h-4 w-4" /> Export Settings
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => { const sel: Record<string, boolean> = {}; sections.forEach((s) => { sel[s.id] = true; }); setSelectedSheets(sel); setShowStockCheckModal(true); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-700 text-white rounded-lg hover:bg-emerald-800"
          >
            Stock Check
          </button>
          <PermissionGuard permission="estimation.boq.update">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </PermissionGuard>
        </div>
      </div>

      {saveError && (
        <div className="mx-6 mt-3 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {saveError}
        </div>
      )}

      <div className="flex-1 overflow-auto p-6">
        {/* Metadata Form */}
        <div className="mb-4 grid grid-cols-3 gap-4">
          <div className="bg-white border border-zinc-200 rounded-lg p-4">
            <h3 className="text-xs font-bold uppercase text-zinc-700 mb-3">BOQ Info</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">BOQ No *</label>
                <input required value={form.boq_no} onChange={(e) => setForm({ ...form, boq_no: e.target.value })}
                  className="w-full px-2 py-1.5 text-sm border border-zinc-300 rounded" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1">Revision</label>
                  <input type="number" value={form.revision_no} onChange={(e) => setForm({ ...form, revision_no: parseInt(e.target.value) || 1 })}
                    className="w-full px-2 py-1.5 text-sm border border-zinc-300 rounded" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1">Date</label>
                  <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full px-2 py-1.5 text-sm border border-zinc-300 rounded" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full px-2 py-1.5 text-sm border border-zinc-300 rounded">
                  {BOQ_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Currency</label>
                <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}
                  className="w-full px-2 py-1.5 text-sm border border-zinc-300 rounded">
                  <option value="INR">INR</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="AED">AED</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-lg p-4">
            <h3 className="text-xs font-bold uppercase text-zinc-700 mb-3">Client & Project</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Client</label>
                <select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                  className="w-full px-2 py-1.5 text-sm border border-zinc-300 rounded">
                  <option value="">Select Client</option>
                  {clients.map((c: any) => <option key={c.id} value={c.id}>{c.client_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Project</label>
                <select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}
                  className="w-full px-2 py-1.5 text-sm border border-zinc-300 rounded">
                  <option value="">Select Project</option>
                  {projects.map((p: any) => <option key={p.id} value={p.id}>{p.project_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Title</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-2 py-1.5 text-sm border border-zinc-300 rounded" />
              </div>
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-lg p-4">
            <h3 className="text-xs font-bold uppercase text-zinc-700 mb-3">Discount Profile</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Default Category</label>
                <select value={form.variant_id} onChange={(e) => setForm({ ...form, variant_id: e.target.value })}
                  className="w-full px-2 py-1.5 text-sm border border-zinc-300 rounded">
                  <option value="">Select Category</option>
                  {variants.map((v: any) => <option key={v.id} value={v.id}>{v.variant_name}</option>)}
                </select>
              </div>
              {Object.keys(clientDiscounts).length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-2">Category Discounts</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(clientDiscounts).map(([vid, data]) => (
                      <div key={vid} className="flex items-center gap-1.5 bg-white border border-zinc-200 rounded px-2 py-1">
                        <span className="text-xs">{data.variantName || ''}</span>
                        <input type="number" value={boqVariantDiscounts[vid] ?? data.discount}
                          onChange={(e) => handleVariantDiscountChange(vid, e.target.value)}
                          className="w-14 px-1 py-0.5 text-xs border border-zinc-300 rounded" step="0.5" />
                        <span className="text-xs text-zinc-500">%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section Tabs */}
        <div className="mb-3 flex items-center gap-2">
          <PermissionGuard permission="estimation.boq.update">
            <button onClick={() => {
              if (activeSection) {
                const list = [...currentItems];
                const newRow: LocalItem = {
                  id: generateId(), description: '', specification: '', hsn_sac: '', unit: '',
                  quantity: '', rate: '', discount_percent: String(getVariantDiscount(form.variant_id)),
                  make: '', variant_id: form.variant_id, variant_name: '', material_id: null,
                  pressure: '', thickness: '', schedule: '', material: '', remarks: '',
                };
                setSections((prev) => prev.map((s) => s.id === activeSectionId ? { ...s, items: [...list, newRow] } : s));
              }
            }} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-zinc-300 rounded hover:bg-zinc-50">
              <Plus className="h-3.5 w-3.5" /> Add Row
            </button>
          </PermissionGuard>
          <div className="flex items-center gap-1 ml-auto bg-zinc-100 border border-zinc-200 rounded p-1">
            {sections.map((section) => (
              <div key={section.id} className="flex items-center"
                draggable onDragStart={() => setDragSectionId(section.id)}
                onDragOver={(e) => e.preventDefault()} onDrop={() => handleSectionDrop(section.id)}
              >
                {editingSectionId === section.id ? (
                  <input value={editingSectionName}
                    onChange={(e) => setEditingSectionName(e.target.value)}
                    onBlur={() => {
                      if (editingSectionName.trim()) setSections((prev) => prev.map((s) => s.id === section.id ? { ...s, name: editingSectionName.trim() } : s));
                      setEditingSectionId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (editingSectionName.trim()) setSections((prev) => prev.map((s) => s.id === section.id ? { ...s, name: editingSectionName.trim() } : s));
                        setEditingSectionId(null);
                      }
                      if (e.key === 'Escape') setEditingSectionId(null);
                    }}
                    autoFocus className="w-28 px-1.5 py-0.5 text-xs border border-zinc-400 rounded" />
                ) : (
                  <button onClick={() => activeSectionId === section.id ? (setEditingSectionId(section.id), setEditingSectionName(section.name)) : setActiveSectionId(section.id)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded ${activeSectionId === section.id ? 'bg-white text-zinc-800 shadow-sm border border-zinc-300' : 'text-zinc-600 hover:text-zinc-800 border border-transparent'}`}
                  >
                    <Sheet className="h-3 w-3" /> {section.name}
                  </button>
                )}
                {sections.length > 1 && (
                  <button onClick={() => deleteSection(section.id)} className="p-0.5 text-zinc-400 hover:text-red-500 ml-0.5">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
            <button onClick={addNewSection} className="p-1 text-zinc-500 hover:text-zinc-700">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Terms / Preface Editor */}
        {activeSection && activeSection.name.toLowerCase().includes('terms') ? (
          <div className="bg-white border border-zinc-200 rounded-lg p-6 min-h-[500px]">
            <h2 className="text-base font-semibold mb-3">Terms & Conditions</h2>
            <textarea value={form.terms_conditions} onChange={(e) => setForm({ ...form, terms_conditions: e.target.value })}
              className="w-full min-h-[400px] border border-zinc-300 rounded p-3 text-sm font-mono" />
          </div>
        ) : activeSection && activeSection.name.toLowerCase().includes('preface') ? (
          <div className="bg-white border border-zinc-200 rounded-lg p-6 min-h-[500px]">
            <h2 className="text-base font-semibold mb-3">Preface</h2>
            <textarea value={form.preface} onChange={(e) => setForm({ ...form, preface: e.target.value })}
              className="w-full min-h-[400px] border border-zinc-300 rounded p-3 text-sm font-mono" />
          </div>
        ) : (
          <>
            {/* Virtualized Grid */}
            <div ref={tableBodyRef} className="border border-zinc-300 rounded overflow-auto" style={{ height: '55vh' }}>
              <table className="w-full border-collapse text-xs">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-zinc-200">
                    {visibleColumns.map((col, idx) => (
                      <th key={`${col.key}-letter`} style={{ width: col.width, minWidth: col.width }}
                        className="px-1 py-0.5 text-center font-bold text-zinc-600 border-r border-zinc-300 text-[10px]">
                        {col.key === 'rowControl' ? '' : columnLetters[idx]}
                      </th>
                    ))}
                  </tr>
                  <tr className="bg-zinc-100">
                    {visibleColumns.map((col) => (
                      <th key={col.key} style={{ width: col.width, minWidth: col.width }}
                        className={`px-1 py-0.5 text-center font-bold text-zinc-700 border-b border-r border-zinc-300 text-[10px] uppercase tracking-wider ${col.key === 'discountPercent' ? 'bg-yellow-50 border-yellow-300' : ''}`}>
                        {col.key === 'rowControl' ? '' : col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
                  {virtualizer.getVirtualItems().map((virtualRow) => {
                    const item = currentItems[virtualRow.index];
                    if (!item) return null;
                    const sno = snoMap[virtualRow.index] || 0;
                    const { rateAfterDiscount, totalAmount } = calcRow(item.rate, item.discount_percent, item.quantity);
                    const isOverride = item.discount_percent !== '' && item.discount_percent !== null &&
                      parseFloat(String(item.discount_percent)) !== getVariantDiscount(item.variant_id || form.variant_id);
                    const isRowEmpty = !item.description && !item.material_id && !item.quantity && !item.rate;

                    return (
                      <tr key={item.id}
                        data-index={virtualRow.index}
                        ref={virtualizer.measureElement}
                        className="hover:bg-blue-50"
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${virtualRow.start}px)`, display: 'table', tableLayout: 'fixed' }}
                        draggable onDragStart={(e) => handleRowDragStart(e, virtualRow.index)}
                        onDragOver={(e) => e.preventDefault()} onDrop={() => handleRowDrop(virtualRow.index)}
                      >
                        {visibleColumns.map((col) => (
                          <td key={col.key} style={{ width: col.width, minWidth: col.width, maxWidth: col.width }}
                            className="px-0.5 py-0 border-b border-r border-zinc-100 align-top">
                            {col.key === 'rowControl' && (
                              <div className="flex items-center gap-0.5">
                                <span className="text-zinc-300 cursor-grab"><GripVertical className="h-3 w-3" /></span>
                                <button onClick={() => deleteRow(virtualRow.index)} className="p-0.5 text-zinc-400 hover:text-red-500"><Trash2 className="h-3 w-3" /></button>
                              </div>
                            )}
                            {col.key === 'sno' && (
                              <div className="flex items-center gap-0.5 px-1">
                                <span className="text-zinc-600">{isRowEmpty ? '' : sno}</span>
                                <button onClick={() => insertRow(virtualRow.index)} className="p-0.5 text-zinc-400 hover:text-blue-500 ml-auto"><Plus className="h-2.5 w-2.5" /></button>
                              </div>
                            )}
                            {col.key === 'description' && (
                              <div className="relative">
                                <input type="text" defaultValue={item.description || ''} key={`${item.id}-desc`}
                                  onFocus={(e) => {
                                    const rect = e.target.getBoundingClientRect();
                                    const filtered = materials.filter((m: any) => !item.description || (m.display_name || m.name || '').toLowerCase().includes(item.description.toLowerCase())).slice(0, 10);
                                    setDropdownPortal({ sectionId: activeSectionId, rowIndex: virtualRow.index, items: filtered, position: { top: rect.bottom, left: rect.left, width: rect.width } });
                                    setActiveRowIndex(virtualRow.index);
                                  }}
                                  onChange={(e) => {
                                    updateItem(virtualRow.index, 'description', e.target.value);
                                    const rect = e.target.getBoundingClientRect();
                                    const search = e.target.value.toLowerCase();
                                    const filtered = materials.filter((m: any) => (m.display_name || m.name || '').toLowerCase().includes(search)).slice(0, 10);
                                    setDropdownPortal({ sectionId: activeSectionId, rowIndex: virtualRow.index, items: filtered, position: { top: rect.bottom, left: rect.left, width: rect.width } });
                                  }}
                                  onBlur={() => setTimeout(() => setDropdownPortal(null), 200)}
                                  ref={(el) => { inputRefs.current[`${activeSectionId}-${virtualRow.index}-material_id`] = el; }}
                                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); const next = FIELD_ORDER[0]; inputRefs.current[`${activeSectionId}-${virtualRow.index}-${next}`]?.focus(); } }}
                                  className="w-full px-1 py-0.5 text-[11px] border border-transparent focus:border-blue-400 rounded-none bg-transparent outline-none" />
                              </div>
                            )}
                            {col.key === 'hsn_sac' && (
                              <input type="text" defaultValue={item.hsn_sac || ''} key={`${item.id}-hsn`}
                                onBlur={(e) => updateItem(virtualRow.index, 'hsn_sac', e.target.value)}
                                className="w-full px-1 py-0.5 text-[11px] border border-transparent focus:border-blue-400 rounded-none bg-transparent outline-none" />
                            )}
                            {col.key === 'variant' && (
                              <select value={item.variant_id || form.variant_id || ''} key={`${item.id}-vid`}
                                onChange={(e) => {
                                  const v = variants.find((vv: any) => vv.id === e.target.value);
                                  updateItem(virtualRow.index, 'variant_id', e.target.value);
                                  updateItem(virtualRow.index, 'variant_name', v?.variant_name || '');
                                  updateItem(virtualRow.index, 'discount_percent', String(getVariantDiscount(e.target.value)));
                                }}
                                ref={(el) => { inputRefs.current[`${activeSectionId}-${virtualRow.index}-variant_id`] = el; }}
                                onFocus={() => setActiveRowIndex(virtualRow.index)}
                                className="w-full px-1 py-0.5 text-[11px] border border-transparent focus:border-blue-400 rounded-none bg-transparent outline-none">
                                <option value="">Select</option>
                                {variants.map((v: any) => <option key={v.id} value={v.id}>{v.variant_name}</option>)}
                              </select>
                            )}
                            {col.key === 'make' && (
                              <select value={item.make || ''} key={`${item.id}-mk`}
                                onChange={(e) => updateItem(virtualRow.index, 'make', e.target.value)}
                                ref={(el) => { inputRefs.current[`${activeSectionId}-${virtualRow.index}-make`] = el; }}
                                onFocus={() => setActiveRowIndex(virtualRow.index)}
                                className="w-full px-1 py-0.5 text-[11px] border border-transparent focus:border-blue-400 rounded-none bg-transparent outline-none">
                                <option value="">Select</option>
                                {makes.map((m) => <option key={m} value={m}>{m}</option>)}
                              </select>
                            )}
                            {col.key === 'quantity' && (
                              <input type="number" defaultValue={item.quantity || ''} key={`${item.id}-qty`}
                                onBlur={(e) => updateItem(virtualRow.index, 'quantity', e.target.value)}
                                ref={(el) => { inputRefs.current[`${activeSectionId}-${virtualRow.index}-quantity`] = el; }}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); const fi = FIELD_ORDER.indexOf('quantity'); if (fi < FIELD_ORDER.length - 1) { inputRefs.current[`${activeSectionId}-${virtualRow.index}-${FIELD_ORDER[fi + 1]}`]?.focus(); } } }}
                                onFocus={() => setActiveRowIndex(virtualRow.index)}
                                className="w-full px-1 py-0.5 text-[11px] border border-transparent focus:border-blue-400 rounded-none bg-transparent outline-none" />
                            )}
                            {col.key === 'unit' && (
                              <input type="text" defaultValue={item.unit || ''} key={`${item.id}-unit`}
                                onBlur={(e) => updateItem(virtualRow.index, 'unit', e.target.value)}
                                className="w-full px-1 py-0.5 text-[11px] border border-transparent focus:border-blue-400 rounded-none bg-transparent outline-none" />
                            )}
                            {col.key === 'rate' && (
                              <input type="number" defaultValue={item.rate || ''} key={`${item.id}-rate`}
                                onBlur={(e) => updateItem(virtualRow.index, 'rate', e.target.value)}
                                ref={(el) => { inputRefs.current[`${activeSectionId}-${virtualRow.index}-rate`] = el; }}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); const fi = FIELD_ORDER.indexOf('rate'); if (fi < FIELD_ORDER.length - 1) { inputRefs.current[`${activeSectionId}-${virtualRow.index}-${FIELD_ORDER[fi + 1]}`]?.focus(); } } }}
                                onFocus={() => setActiveRowIndex(virtualRow.index)}
                                className="w-full px-1 py-0.5 text-[11px] border border-transparent focus:border-blue-400 rounded-none bg-transparent outline-none" />
                            )}
                            {col.key === 'discountPercent' && (
                              <div className="relative">
                                <input type="number" defaultValue={item.discount_percent || ''} key={`${item.id}-disc`}
                                  onBlur={(e) => updateItem(virtualRow.index, 'discount_percent', e.target.value)}
                                  ref={(el) => { inputRefs.current[`${activeSectionId}-${virtualRow.index}-discount_percent`] = el; }}
                                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); const fi = FIELD_ORDER.indexOf('discount_percent'); if (fi < FIELD_ORDER.length - 1) { inputRefs.current[`${activeSectionId}-${virtualRow.index}-${FIELD_ORDER[fi + 1]}`]?.focus(); } } }}
                                  onFocus={() => setActiveRowIndex(virtualRow.index)}
                                  className={`w-full px-1 py-0.5 text-[11px] border border-transparent focus:border-blue-400 rounded-none bg-transparent outline-none ${isOverride ? 'bg-yellow-50' : ''}`}
                                  style={isOverride ? { borderColor: '#f59e0b' } : {}} />
                                {isOverride && <span className="absolute -top-1.5 right-0.5 bg-amber-500 text-white text-[8px] px-1 rounded">OVR</span>}
                              </div>
                            )}
                            {col.key === 'rateAfterDiscount' && (
                              <span className="block px-1 py-0.5 text-[11px] text-zinc-700">{rateAfterDiscount ? `₹${rateAfterDiscount}` : '-'}</span>
                            )}
                            {col.key === 'totalAmount' && (
                              <span className="block px-1 py-0.5 text-[11px] font-medium text-blue-700">{totalAmount ? `₹${totalAmount.toLocaleString()}` : '-'}</span>
                            )}
                            {col.key === 'specification' && (
                              <input type="text" defaultValue={item.specification || ''} key={`${item.id}-spec`}
                                onBlur={(e) => updateItem(virtualRow.index, 'specification', e.target.value)}
                                ref={(el) => { inputRefs.current[`${activeSectionId}-${virtualRow.index}-specification`] = el; }}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); const fi = FIELD_ORDER.indexOf('specification'); if (fi < FIELD_ORDER.length - 1) { inputRefs.current[`${activeSectionId}-${virtualRow.index}-${FIELD_ORDER[fi + 1]}`]?.focus(); } } }}
                                onFocus={() => setActiveRowIndex(virtualRow.index)}
                                className="w-full px-1 py-0.5 text-[11px] border border-transparent focus:border-blue-400 rounded-none bg-transparent outline-none" />
                            )}
                            {col.key === 'remarks' && (
                              <input type="text" defaultValue={item.remarks || ''} key={`${item.id}-rmk`}
                                onBlur={(e) => updateItem(virtualRow.index, 'remarks', e.target.value)}
                                onFocus={() => setActiveRowIndex(virtualRow.index)}
                                className="w-full px-1 py-0.5 text-[11px] border border-transparent focus:border-blue-400 rounded-none bg-transparent outline-none" />
                            )}
                            {col.key === 'pressure' && (
                              <input type="text" defaultValue={item.pressure || ''} onBlur={(e) => updateItem(virtualRow.index, 'pressure', e.target.value)}
                                className="w-full px-1 py-0.5 text-[11px] border border-transparent focus:border-blue-400 rounded-none bg-transparent outline-none" />
                            )}
                            {col.key === 'thickness' && (
                              <input type="text" defaultValue={item.thickness || ''} onBlur={(e) => updateItem(virtualRow.index, 'thickness', e.target.value)}
                                className="w-full px-1 py-0.5 text-[11px] border border-transparent focus:border-blue-400 rounded-none bg-transparent outline-none" />
                            )}
                            {col.key === 'schedule' && (
                              <input type="text" defaultValue={item.schedule || ''} onBlur={(e) => updateItem(virtualRow.index, 'schedule', e.target.value)}
                                className="w-full px-1 py-0.5 text-[11px] border border-transparent focus:border-blue-400 rounded-none bg-transparent outline-none" />
                            )}
                            {col.key === 'material' && (
                              <input type="text" defaultValue={item.material || ''} onBlur={(e) => updateItem(virtualRow.index, 'material', e.target.value)}
                                className="w-full px-1 py-0.5 text-[11px] border border-transparent focus:border-blue-400 rounded-none bg-transparent outline-none" />
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-blue-50 font-semibold">
                    {visibleColumns.map((col) => (
                      <td key={col.key} className="px-1 py-1 text-xs border-t border-zinc-300">
                        {col.key === 'description' && <span className="text-right block">Total</span>}
                        {col.key === 'quantity' && <span>{totals.totalQty}</span>}
                        {col.key === 'totalAmount' && <span className="text-blue-700">₹{totals.totalAmount.toLocaleString()}</span>}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      {showColumnPanel && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowColumnPanel(false)}>
          <div className="bg-white rounded-lg p-5 w-80 max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-semibold">Adjust Columns</h3>
              <button onClick={() => setShowColumnPanel(false)} className="p-1 text-zinc-400 hover:text-zinc-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-2">
              {columnSettings.filter((c) => !['rowControl', 'sno', 'rateAfterDiscount', 'totalAmount'].includes(c.key)).map((col) => (
                <label key={col.key} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="checkbox" checked={col.visible} onChange={() => toggleColumnVisibility(col.key)} className="w-4 h-4" />
                  <span>{col.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {showExportSettings && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowExportSettings(false)}>
          <div className="bg-white rounded-lg p-5 w-[520px] max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-semibold">Export Settings</h3>
              <button onClick={() => setShowExportSettings(false)} className="p-1 text-zinc-400 hover:text-zinc-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="mb-4">
              <div className="font-medium text-sm mb-2">Columns</div>
              <div className="grid grid-cols-2 gap-2 max-h-52 overflow-auto">
                {columnSettings.filter((c) => c.key !== 'rowControl').map((col) => (
                  <label key={col.key} className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input type="checkbox" checked={!!exportColumns[col.key]} onChange={() => setExportColumns((p) => ({ ...p, [col.key]: !p[col.key] }))} />
                    <span>{col.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="mb-4">
              <div className="font-medium text-sm mb-2">Sheets</div>
              {sections.map((section) => (
                <label key={section.id} className="flex items-center gap-1.5 text-xs cursor-pointer mb-1">
                  <input type="checkbox" checked={!!exportSheets[section.id]} onChange={() => setExportSheets((p) => ({ ...p, [section.id]: !p[section.id] }))} />
                  <span>{section.name}</span>
                </label>
              ))}
            </div>
            <div className="mb-4">
              <div className="font-medium text-sm mb-2">Orientation</div>
              <div className="flex gap-3 text-xs">
                {['portrait', 'landscape'].map((o) => (
                  <label key={o} className="flex items-center gap-1 cursor-pointer">
                    <input type="radio" name="export-orientation" checked={exportOrientation === o} onChange={() => setExportOrientation(o)} />
                    {o.charAt(0).toUpperCase() + o.slice(1)}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => {
                if (form.boq_no) localStorage.setItem(`boq_export_${form.boq_no}`, JSON.stringify({ columns: exportColumns, sheets: exportSheets, orientation: exportOrientation }));
                setShowExportSettings(false);
              }} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save As Default</button>
              <button onClick={() => setShowExportSettings(false)} className="px-3 py-1.5 text-sm border border-zinc-300 rounded-lg hover:bg-zinc-50">Close</button>
            </div>
          </div>
        </div>
      )}

      {showDiscountApplyModal && pendingDiscountChange && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowDiscountApplyModal(false)}>
          <div className="bg-white rounded-lg p-5 w-[520px]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold mb-3">Apply Discount to Rows</h3>
            <p className="text-sm text-zinc-600 mb-3">Copy this discount % to all rows for this variant?</p>
            {['all', 'skip'].map((mode) => (
              <label key={mode} className="flex items-center gap-2 text-sm mb-2 cursor-pointer">
                <input type="radio" name="discount-mode" checked={discountApplyMode === mode} onChange={() => setDiscountApplyMode(mode)} />
                {mode === 'all' ? 'Copy to all rows of this variant' : 'Skip overwritten rows (only update non-overwritten)'}
              </label>
            ))}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowDiscountApplyModal(false)} className="px-3 py-1.5 text-sm border border-zinc-300 rounded-lg hover:bg-zinc-50">Cancel</button>
              <button onClick={() => {
                const { variantId, discount, prevDiscount } = pendingDiscountChange;
                setBoqVariantDiscounts((p) => ({ ...p, [variantId]: discount }));
                applyVariantDiscountToRows(variantId, discount, discountApplyMode);
                setShowDiscountApplyModal(false);
                setPendingDiscountChange(null);
              }} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Apply</button>
            </div>
          </div>
        </div>
      )}

      {showStockCheckModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowStockCheckModal(false)}>
          <div className="bg-white rounded-lg p-6 w-[420px]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold mb-1">Launch Stock Check</h3>
            <p className="text-xs text-zinc-500 mb-4">Select BOQ sheets to include in the procurement tracker.</p>
            {sections.map((section) => {
              const itemCount = section.items.filter((r) => r.description || r.material_id).length;
              return (
                <label key={section.id} className={`flex items-center gap-3 p-2.5 mb-2 border rounded-lg cursor-pointer ${selectedSheets[section.id] ? 'border-blue-500 bg-blue-50' : 'border-zinc-200'}`}>
                  <input type="checkbox" checked={!!selectedSheets[section.id]}
                    onChange={(e) => setSelectedSheets((p) => ({ ...p, [section.id]: e.target.checked }))}
                    className="w-4 h-4 accent-blue-600" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{section.name}</div>
                    <div className="text-xs text-zinc-400">{itemCount} items</div>
                  </div>
                </label>
              );
            })}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowStockCheckModal(false)} className="px-3 py-1.5 text-sm border border-zinc-300 rounded-lg hover:bg-zinc-50">Cancel</button>
              <button onClick={handleLaunchStockCheck} disabled={launchingStockCheck || Object.values(selectedSheets).every((v) => !v)}
                className="px-3 py-1.5 text-sm bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 disabled:opacity-50">
                {launchingStockCheck ? 'Creating...' : 'Launch Stock Check'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Material Dropdown Portal */}
      {dropdownPortal && (
        <div className="fixed z-[9999]" style={{ top: dropdownPortal.position.top, left: dropdownPortal.position.left, width: dropdownPortal.position.width }}>
          <div className="bg-white border border-zinc-200 rounded shadow-lg max-h-48 overflow-auto">
            {dropdownPortal.items.length === 0 ? (
              <div className="px-3 py-2 text-xs text-zinc-400">No matches</div>
            ) : (
              dropdownPortal.items.map((m: any) => (
                <div key={m.id} onClick={() => { handleMaterialPick(dropdownPortal.rowIndex, m); setDropdownPortal(null); }}
                  className="px-3 py-1.5 text-xs cursor-pointer hover:bg-blue-50 border-b border-zinc-50 last:border-0">
                  {m.display_name || m.name}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
