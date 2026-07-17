import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { formatDate, formatCurrency } from '../utils/formatters';
import { timedSupabaseQuery } from '../utils/queryTimeout';
import { useMaterialsPageData } from '../hooks/useMaterialsPageData';
import { useMaterials } from '../hooks/useMaterials';
import { useWarehouses } from '../hooks/useWarehouses';
import { useVariants } from '../hooks/useVariants';
import { useUnits } from '../hooks/useUnits';
import { useAuth } from '../contexts/AuthContext';
import BulkImportModal from '../components/BulkImportModal';
import ExcelEditor, { FieldSelector } from '../components/ExcelEditor';
import { AppTable } from '../components/ui/AppTable';
import { Modal } from '../components/ui/Modal';
import { cn } from '../lib/utils';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Checkbox } from '../components/ui/checkbox';
import {
  Plus,
  Upload,
  Table as TableIcon,
  Search,
  X,
  Edit,
  Trash2,
  Check,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  MoreVertical,
  Settings,
  Tag,
  Ruler,
  Warehouse,
  Filter,
  Package,
  Eye,
  Download,
  Package as InventoryIcon,
  Copy,
  FileSpreadsheet,
} from 'lucide-react';

const MAIN_CATEGORIES = ['VALVE', 'PIPE', 'FITTING', 'FLANGE', 'ELECTRICAL', 'PLUMBING', 'HVAC', 'FIRE PROTECTION', 'BUILDING MATERIALS', 'TOOLS', 'SAFETY', 'OFFICE', 'OTHER'];

const GST_RATES = [
  { value: 0, label: '0% (Exempt)' },
  { value: 0.5, label: '0.5%' },
  { value: 5, label: '5%' },
  { value: 12, label: '12%' },
  { value: 18, label: '18%' },
  { value: 28, label: '28%' },
];

const ITEM_DETAIL_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'warehouse', label: 'Warehouse Report' },
  { key: 'adjustments', label: 'Stock Adjustments' },
  { key: 'quotation', label: 'Quotation' },
  { key: 'invoice', label: 'Invoice' },
  { key: 'purchase', label: 'Purchase Details' },
  { key: 'challan', label: 'Delivery Challan' },
  { key: 'audit', label: 'Audit Trail' },
];

const ITEM_TABLE_COLUMNS = [
  { key: 'name', label: 'Item Name', default: true, locked: true },
  { key: 'category', label: 'Category', default: true, locked: true },
  { key: 'unit', label: 'Unit', default: true, locked: true },
  { key: 'gst_rate', label: 'GST Rate', default: true },
  { key: 'hsn_code', label: 'HSN/SAC', default: true },
  { key: 'uses_variant', label: 'Discount Category', default: true },
  { key: 'stock', label: 'Inventory', default: true },
  { key: 'code', label: 'Code', default: false },
  { key: 'sub_category', label: 'Sub Category', default: false },
  { key: 'size', label: 'Size', default: false },
  { key: 'pressure_class', label: 'Pressure Class', default: false },
  { key: 'make', label: 'MAKE(Brand name)', default: false },
  { key: 'material', label: 'Material', default: false },
  { key: 'end_connection', label: 'End Connection', default: false },
  { key: 'sale_price', label: 'Sale Price', default: false },
  { key: 'purchase_price', label: 'Purchase Price', default: false },
  { key: 'status', label: 'Status', default: true },
  { key: 'actions', label: 'Actions', default: true, locked: true },
];

const MANDATORY_ITEM_COLUMNS = ['name', 'category', 'unit', 'actions'];

const emptyItemTransactions = () => ({
  warehouseRows: [],
  adjustmentRows: [],
  quotationRows: [],
  invoiceRows: [],
  purchaseRows: [],
  challanRows: [],
  auditRows: [],
});

const ITEM_AUDIT_STORAGE_KEY = 'items_audit_trail_v1';

const getLocalAuditTrail = () => {
  try {
    const raw = localStorage.getItem(ITEM_AUDIT_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveLocalAuditTrail = (entries) => {
  try {
    localStorage.setItem(ITEM_AUDIT_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Ignore localStorage errors; detail tab still loads DB records if available.
  }
};

const appendLocalAuditEntry = (entry) => {
  const existing = getLocalAuditTrail();
  const next = [entry, ...existing].slice(0, 400);
  saveLocalAuditTrail(next);
};

const normalizeAuditChanges = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [value];
    } catch {
      return [value];
    }
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).map(([key, val]) => `${key}: ${val}`);
  }
  return [];
};

const formatAuditValue = (value) => {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
};

const buildItemChangeLog = (before, after) => {
  const keys = [
    ['name', 'Item Name'],
    ['display_name', 'Display Name'],
    ['item_code', 'Item Code / SKU'],
    ['main_category', 'Main Category'],
    ['sub_category', 'Sub Category'],
    ['size', 'Size'],
    ['pressure_class', 'Pressure Class'],
    ['make', 'MAKE(Brand name)'],
    ['material', 'Material'],
    ['end_connection', 'End Connection'],
    ['unit', 'Unit'],
    ['purchase_price', 'Purchase Price'],
    ['sale_price', 'Sale Price'],
    ['hsn_code', 'HSN/SAC'],
    ['gst_rate', 'GST Rate'],
    ['is_active', 'Active'],
    ['uses_variant', 'Uses Discount Category'],
  ];

  return keys
    .map(([key, label]) => {
      const oldVal = before?.[key];
      const newVal = after?.[key];
      if (String(oldVal ?? '') === String(newVal ?? '')) return null;
      return `${label}: ${formatAuditValue(oldVal)} -> ${formatAuditValue(newVal)}`;
    })
    .filter(Boolean);
};

const isMissingRelationError = (error) => {
  const code = String(error?.code || '');
  const message = String(error?.message || '');
  return code === '42P01' || /does not exist/i.test(message) || /schema cache/i.test(message);
};

const getMaterialsTabFromSearch = (search = '') => {
  const tab = new URLSearchParams(search || '').get('tab');
  const allowedTabs = new Set(['items', 'service', 'category', 'unit', 'warehouses', 'variants', 'discount-categories']);
  return allowedTabs.has(tab) ? tab : 'items';
};

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "tab-button px-5 text-sm font-medium border-b-2 transition-all",
        active 
          ? "border-indigo-600 text-indigo-700 bg-indigo-50/50" 
          : "border-transparent text-zinc-500 hover:text-indigo-600 hover:bg-zinc-50 hover:border-zinc-300"
      )}
    >
      {children}
    </button>
  );
}

// NOTE: Named export consumed by features/materials/page/ItemsTab.tsx re-export stub
export function ItemsTab() {
  const queryClient = useQueryClient();
  const { organisation } = useAuth();
  const organisationId = organisation?.id;
  const location = useLocation();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(() => new URLSearchParams(location.search).get('add') === 'true');
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [showBulkPriceModal, setShowBulkPriceModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [showItemWorkspace, setShowItemWorkspace] = useState(false);
  const [workspaceSearch, setWorkspaceSearch] = useState('');
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showMoreDropdown, setShowMoreDropdown] = useState(false);
  const [hideInactive, setHideInactive] = useState(false);
  const [saveNotice, setSaveNotice] = useState('');
  const [materialSavePending, setMaterialSavePending] = useState(false);

  // Click-outside handler for all dropdowns
  useEffect(() => {
    if (!showColumnSettings && !showCategoryDropdown && !showMoreDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-dropdown="columns"]') && showColumnSettings) setShowColumnSettings(false);
      if (!target.closest('[data-dropdown="category"]') && showCategoryDropdown) setShowCategoryDropdown(false);
      if (!target.closest('[data-dropdown="more"]') && showMoreDropdown) setShowMoreDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside, true);
    return () => document.removeEventListener('mousedown', handleClickOutside, true);
  }, [showColumnSettings, showCategoryDropdown, showMoreDropdown]);
  const [isSavingSequentially, setIsSavingSequentially] = useState(false);
  const [saveProgress, setSaveProgress] = useState({ current: 0, total: 0 });
  const [showMultiItemModal, setShowMultiItemModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [multiItemRows, setMultiItemRows] = useState([]);
  const [bulkPriceText, setBulkPriceText] = useState('');
  const [bulkPreviewRows, setBulkPreviewRows] = useState([]);
  const [bulkParseErrors, setBulkParseErrors] = useState([]);
  const [bulkApplyErrors, setBulkApplyErrors] = useState([]);
  const [bulkInProgress, setBulkInProgress] = useState(false);
  const [selectedMaterialId, setSelectedMaterialId] = useState(null);
  const [activeDetailTab, setActiveDetailTab] = useState('overview');
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteInProgress, setDeleteInProgress] = useState(false);
  const [itemTransactions, setItemTransactions] = useState(emptyItemTransactions);
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('itemsTableColumns');
    const defaultCols = ITEM_TABLE_COLUMNS.filter((col) => col.default).map((col) => col.key);
    if (!saved) return defaultCols;
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return [...new Set([...MANDATORY_ITEM_COLUMNS, ...parsed])];
      }
    } catch {
      // ignore parse errors and use defaults
    }
    return defaultCols;
  });

  const [formData, setFormData] = useState({
    item_code: '', item_name: '', display_name: '', main_category: '', sub_category: '',
    size: '', pressure_class: '', make: '', material: '', end_connection: '',
    unit: 'nos', has_alternative_unit: false, alternative_units: [] as { unit_name: string; conversion_factor: string }[],
    sale_price: '', purchase_price: '', hsn_code: '', gst_rate: 18, is_active: true,
    uses_variant: false, track_inventory: false, discount_category_id: null,
    dimension: '', dimension_unit: 'cm', weight: '', weight_unit: 'kg',
    item_classification: 'goods_sold', allow_purchase: true, allow_sales: true, show_in_bom: true, is_manufactured: false
  });

  const CLASSIFICATION_OPTIONS = [
    { value: 'finished_good', label: 'Finished Good', desc: 'Manufactured and sold', requiresMfg: true },
    { value: 'raw_material', label: 'Raw Material', desc: 'Purchased, consumed in production, appears in BOM', requiresMfg: true },
    { value: 'consumable', label: 'Consumable', desc: 'Purchased, used for operations/maintenance, not in BOM', requiresMfg: false },
    { value: 'goods_sold', label: 'Goods Sold', desc: 'Purchased and resold as-is', requiresMfg: false },
  ];

  const manufacturingEnabled = Boolean((organisation as any)?.manufacturing_enabled);

  const setItemClassification = (type: string) => {
    const presets: Record<string, { allow_purchase: boolean; allow_sales: boolean; show_in_bom: boolean; is_manufactured: boolean }> = {
      finished_good: { allow_purchase: false, allow_sales: true, show_in_bom: false, is_manufactured: true },
      raw_material: { allow_purchase: true, allow_sales: false, show_in_bom: true, is_manufactured: false },
      consumable: { allow_purchase: true, allow_sales: false, show_in_bom: false, is_manufactured: false },
      goods_sold: { allow_purchase: true, allow_sales: true, show_in_bom: false, is_manufactured: false },
    };
    setFormData(prev => ({ ...prev, item_classification: type, ...presets[type] }));
  };

  const [variantPricing, setVariantPricing] = useState([]);
  const [warehouseStock, setWarehouseStock] = useState({});
  const [vendorMappings, setVendorMappings] = useState([]);
  const [clientMappings, setClientMappings] = useState([]);
  const [clientPricing, setClientPricing] = useState([]);
  const [clientMappingTab, setClientMappingTab] = useState('code');
  const [pricingHistory, setPricingHistory] = useState([]);
  const [showPricingHistory, setShowPricingHistory] = useState(false);
  const [showTechnical, setShowTechnical] = useState(false);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  
  const addNewCategory = async () => {
    const name = newCategoryName.trim();
    if (!name || !organisation?.id) return;
    try {
      await supabase.from('item_categories').insert({ category_name: name, is_active: true });
      setNewCategoryName('');
      setShowNewCategory(false);
      queryClient.invalidateQueries({ queryKey: ['materials-page-data', orgId] });
    } catch (err) {
      alert('Error saving category: ' + (err as any).message);
    }
  };
  
  // Excel Edit Mode state
  const [excelEditMode, setExcelEditMode] = useState(false);
  const [showFieldSelector, setShowFieldSelector] = useState(false);
  const [selectedEditFields, setSelectedEditFields] = useState<string[]>(['variant_name', 'sale_price', 'purchase_price']);
  const [showExcelImportFieldSelector, setShowExcelImportFieldSelector] = useState(false);
  const [excelImportFields, setExcelImportFields] = useState<string[]>([]);

  const formatCurrencyOrDash = (value) => {
    if (value === null || value === undefined || value === '' || value === 0) return '-';
    return formatCurrency(value);
  };

  // PARALLEL QUERY: Single hook replaces 6 sequential queries
  // Pass orgId so query is enabled; without it enabled:!!orgId=false and page never loads
  const orgId = organisation?.id ?? null;
  const { data: pageData, isLoading, isError, error, refetch } = useMaterialsPageData(orgId);

  const { data: vendors = [] } = useQuery({
    queryKey: ['purchase-vendors', orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from('purchase_vendors').select('id, company_name').eq('organisation_id', orgId).eq('status', 'Active');
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId
  });


  
  // Extract datasets from parallel query result
  const materials = pageData?.materials ?? [];
  const stock = pageData?.stock ?? [];
  const categories = pageData?.categories ?? [];
  const units = pageData?.units ?? [];
  const variants = pageData?.variants ?? [];
  const warehouses = pageData?.warehouses ?? [];
  const clients = pageData?.clients ?? [];
  const discountCategories = pageData?.discountCategories ?? [];
  
  const categoryOptions = categories.length > 0 ? categories.map((c) => c.category_name) : MAIN_CATEGORIES;
  const materialsError = error instanceof Error ? error.message : '';
  
  // Memoized stock data map for performance
  const stockData = useMemo(() => {
    const stockMap: Record<string, number> = {};
    stock.forEach((s) => {
      if (!stockMap[s.item_id]) stockMap[s.item_id] = 0;
      stockMap[s.item_id] += parseFloat(s.current_stock) || 0;
    });
    return stockMap;
  }, [stock]);

  useEffect(() => {
    if (isError) {
      setSelectedMaterialId(null);
      setShowItemWorkspace(false);
      setItemTransactions(emptyItemTransactions());
      setDetailError('');
    }
  }, [isError]);

  const retryItemDependencies = async () => {
    await refetch();
  };

  useEffect(() => {
    localStorage.setItem('itemsTableColumns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  useEffect(() => {
    if (!saveNotice) return undefined;
    const timer = window.setTimeout(() => setSaveNotice(''), 4000);
    return () => window.clearTimeout(timer);
  }, [saveNotice]);

  const refreshMaterials = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const updateMaterialsCache = useCallback((updater) => {
    // Must use the same queryKey as useMaterialsPageData and update the nested materials array
    queryClient.setQueryData(['materials-page-data', orgId], (old: any) => {
      if (!old) return old;
      const base = Array.isArray(old.materials) ? old.materials : [];
      const next = typeof updater === 'function' ? updater(base) : updater;
      return { ...old, materials: next };
    });
  }, [queryClient, orgId]);

  const loadVendorMappings = useCallback(async (itemId: string) => {
    try {
      const { data, error } = await supabase.from('vendor_material_pricing').select('*').eq('material_id', itemId);
      if (error) throw error;
      setVendorMappings(data || []);
    } catch (err) {
      console.error('Error loading vendor mappings:', err);
      setVendorMappings([]);
    }
  }, []);

  const loadClientMappings = useCallback(async (itemId: string) => {
    if (!itemId) return;
    try {
      const { data } = await supabase.from('material_client_mappings').select('*').eq('material_id', itemId);
      setClientMappings(data || []);
    } catch (error) {
      console.log('client mappings load error', error);
      setClientMappings([]);
    }
  }, []);

  const loadClientPricing = useCallback(async (itemId: string) => {
    if (!itemId) return;
    try {
      const { data } = await supabase.from('material_client_pricing').select('*, clients(client_name)').eq('material_id', itemId).order('created_at', { ascending: true });
      setClientPricing(data || []);
    } catch (error) {
      console.log('client pricing load error', error);
      setClientPricing([]);
    }
  }, []);

  const loadPricingHistory = useCallback(async (itemId: string) => {
    if (!itemId) return;
    try {
      const { data } = await supabase.from('material_client_pricing_history').select('*').eq('material_id', itemId).order('changed_at', { ascending: false }).limit(50);
      setPricingHistory(data || []);
    } catch (error) {
      console.log('pricing history load error', error);
      setPricingHistory([]);
    }
  }, []);

  const loadVariantPricing = useCallback(async (itemId: string) => {
    if (!itemId) return;
    try {
      const data = await timedSupabaseQuery(
        supabase.from('item_variant_pricing').select('*').eq('item_id', itemId),
        'Item variant pricing'
      );
      setVariantPricing(data || []);
    } catch (error) {
      console.log('item_variant_pricing error', error);
      setVariantPricing([]);
    }
  }, []);

  const checkVariantRecords = useCallback(async (itemId: string) => {
    try {
      const [stockRes, pricingRes] = await Promise.all([
        supabase.from('item_stock').select('id').eq('item_id', itemId).not('company_variant_id', 'is', null),
        supabase.from('item_variant_pricing').select('id').eq('item_id', itemId)
      ]);
      return {
        hasStock: (stockRes.data?.length || 0) > 0,
        hasPricing: (pricingRes.data?.length || 0) > 0
      };
    } catch {
      return { hasStock: false, hasPricing: false };
    }
  }, []);

  const toggleColumn = useCallback((columnKey: string) => {
    if (MANDATORY_ITEM_COLUMNS.includes(columnKey)) return;
    setVisibleColumns((prev) => {
      if (prev.includes(columnKey)) {
        const next = prev.filter((col) => col !== columnKey);
        return next.length > 0 ? [...new Set([...MANDATORY_ITEM_COLUMNS, ...next])] : prev;
      }
      return [...new Set([...prev, columnKey, ...MANDATORY_ITEM_COLUMNS])];
    });
  }, []);

  const openBulkPriceModal = useCallback(() => {
    setShowBulkPriceModal(true);
    setBulkPriceText('');
    setBulkPreviewRows([]);
    setBulkParseErrors([]);
    setBulkApplyErrors([]);
  }, []);

  const closeBulkPriceModal = useCallback(() => {
    if (bulkInProgress) return;
    setShowBulkPriceModal(false);
  }, [bulkInProgress]);

  const parseBulkPriceRows = () => {
    const text = bulkPriceText.trim();
    if (!text) {
      setBulkPreviewRows([]);
      setBulkParseErrors(['Paste data first.']);
      return;
    }

    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length === 0) {
      setBulkPreviewRows([]);
      setBulkParseErrors(['No rows found in pasted data.']);
      return;
    }

    const materialByCode = {};
    const materialByName = {};
    materials.forEach((item) => {
      if (item.item_code) {
        materialByCode[item.item_code.toLowerCase().trim()] = item;
      }
      if (item.display_name) {
        materialByName[item.display_name.toLowerCase().trim()] = item;
      }
      if (item.name) {
        materialByName[item.name.toLowerCase().trim()] = item;
      }
    });

    const errors = [];
    const rows = [];
    let startIdx = 0;
    const firstCols = lines[0].split('\t').map((c) => c.trim().toLowerCase());
    const hasHeader = firstCols.some((c) => c.includes('item') || c.includes('code') || c.includes('sale') || c.includes('purchase'));
    if (hasHeader) startIdx = 1;

    for (let idx = startIdx; idx < lines.length; idx += 1) {
      const raw = lines[idx];
      const cols = raw.split('\t').map((c) => c.trim());
      const rowNo = idx + 1;

      if (cols.length < 2) {
        errors.push(`Row ${rowNo}: requires at least 2 columns (Item Code/SKU or Name + Sale Price).`);
        continue;
      }

      const identifier = cols[0];
      const saleRaw = cols[1];
      const purchaseRaw = cols[2] ?? '';

      if (!identifier) {
        errors.push(`Row ${rowNo}: missing item identifier.`);
        continue;
      }

      const salePrice = saleRaw === '' ? null : parseFloat(saleRaw);
      const purchasePrice = purchaseRaw === '' ? null : parseFloat(purchaseRaw);

      if (saleRaw !== '' && Number.isNaN(salePrice)) {
        errors.push(`Row ${rowNo}: invalid sale price "${saleRaw}".`);
        continue;
      }
      if (purchaseRaw !== '' && Number.isNaN(purchasePrice)) {
        errors.push(`Row ${rowNo}: invalid purchase price "${purchaseRaw}".`);
        continue;
      }
      if (salePrice === null && purchasePrice === null) {
        errors.push(`Row ${rowNo}: at least one price (sale/purchase) is required.`);
        continue;
      }

      const key = identifier.toLowerCase().trim();
      const found = materialByCode[key] || materialByName[key];
      if (!found) {
        errors.push(`Row ${rowNo}: item "${identifier}" not found.`);
        continue;
      }

      const nextSale = salePrice === null ? found.sale_price : salePrice;
      const nextPurchase = purchasePrice === null ? found.purchase_price : purchasePrice;
      const hasChange = String(nextSale ?? '') !== String(found.sale_price ?? '') || String(nextPurchase ?? '') !== String(found.purchase_price ?? '');
      if (!hasChange) continue;

      rows.push({
        rowNo,
        identifier,
        item: found,
        nextSale,
        nextPurchase,
      });
    }

    setBulkPreviewRows(rows);
    setBulkParseErrors(errors);
  };

  const applyBulkPriceUpdates = async () => {
    if (bulkInProgress) return;
    if (bulkPreviewRows.length === 0) {
      setBulkApplyErrors(['No valid rows to update. Click "Preview Changes" first.']);
      return;
    }

    setBulkInProgress(true);
    setBulkApplyErrors([]);
    const failures = [];
    let successCount = 0;
    let canWriteDbAudit = true;

    for (const row of bulkPreviewRows) {
      const nowIso = new Date().toISOString();
      const updateData = {
        sale_price: row.nextSale,
        purchase_price: row.nextPurchase,
        updated_at: nowIso,
      };

      try {
        const { error } = await supabase
          .from('materials')
          .update(updateData)
          .eq('id', row.item.id);
        if (error) throw error;

        const auditChanges = buildItemChangeLog(row.item, { ...row.item, ...updateData });
        const auditEntry = {
          id: `local-bulk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          item_id: row.item.id,
          action: 'BULK_PRICE_UPDATE',
          notes: `Bulk price update from Items page (Row ${row.rowNo})`,
          changes: auditChanges,
          created_at: nowIso,
        };
        appendLocalAuditEntry(auditEntry);

        if (canWriteDbAudit) {
          const { error: dbAuditError } = await supabase.from('item_audit_logs').insert({
            item_id: row.item.id,
            action: 'BULK_PRICE_UPDATE',
            notes: auditEntry.notes,
            changes: JSON.stringify(auditChanges),
            created_at: nowIso,
          });
          if (dbAuditError) {
            console.log('item_audit_logs bulk write warning:', dbAuditError.message);
            canWriteDbAudit = false;
          }
        }

        successCount += 1;
      } catch (error) {
        failures.push(`Row ${row.rowNo} (${row.identifier}): ${error.message}`);
      }
    }

    await refreshMaterials();
    if (selectedMaterialId) {
      await loadItemTransactions(selectedMaterialId);
    }

    setBulkApplyErrors(failures);
    setSaveNotice(
      failures.length > 0
        ? `Bulk update finished: ${successCount} updated, ${failures.length} failed.`
        : `Bulk update successful: ${successCount} items updated.`
    );
    if (failures.length === 0) {
      closeBulkPriceModal();
    }
    setBulkInProgress(false);
  };

  const runQuery = async (label, queryBuilder) => {
    try {
      const data = await timedSupabaseQuery(queryBuilder, label, 15000);
      return data || [];
    } catch (err) {
      console.log(`${label} load warning:`, err.message);
      return [];
    }
  };

  const loadItemTransactions = async (itemId) => {
    if (!itemId) return;
    setDetailLoading(true);
    setDetailError('');

    try {
      const [
        warehouseStockRows,
        warehouseMasterRows,
        variantMasterRows,
        inwardItemRows,
        outwardItemRows,
        quotationItemRows,
        challanItemRows,
        auditDbRows,
      ] = await Promise.all([
        runQuery(
          'item_stock',
          supabase
            .from('item_stock')
            .select('id, item_id, company_variant_id, warehouse_id, current_stock, low_stock_level, updated_at')
            .eq('item_id', itemId)
        ),
        runQuery('warehouses', supabase.from('warehouses').select('id, warehouse_name, name, warehouse_code')),
        runQuery('company_variants', supabase.from('company_variants').select('id, variant_name')),
        runQuery(
          'material_inward_items',
          supabase
            .from('material_inward_items')
            .select('id, inward_id, material_id, quantity, unit, rate, amount, created_at')
            .eq('material_id', itemId)
            .order('created_at', { ascending: false })
        ),
        runQuery(
          'material_outward_items',
          supabase
            .from('material_outward_items')
            .select('id, outward_id, material_id, quantity, unit, created_at')
            .eq('material_id', itemId)
            .order('created_at', { ascending: false })
        ),
        runQuery(
          'quotation_items',
          supabase
            .from('quotation_items')
            .select('id, quotation_id, item_id, qty, uom, rate, line_total, created_at')
            .eq('item_id', itemId)
            .order('created_at', { ascending: false })
        ),
        runQuery(
          'delivery_challan_items',
          supabase
            .from('delivery_challan_items')
            .select('id, delivery_challan_id, material_id, quantity, unit, rate, amount, created_at')
            .eq('material_id', itemId)
            .order('created_at', { ascending: false })
        ),
        runQuery(
          'item_audit_logs',
          supabase
            .from('item_audit_logs')
            .select('*')
            .eq('item_id', itemId)
            .order('created_at', { ascending: false })
        ),
      ]);

      const inwardIds = [...new Set(inwardItemRows.map((row) => row.inward_id).filter(Boolean))];
      const outwardIds = [...new Set(outwardItemRows.map((row) => row.outward_id).filter(Boolean))];
      const quotationIds = [...new Set(quotationItemRows.map((row) => row.quotation_id).filter(Boolean))];
      const challanIds = [...new Set(challanItemRows.map((row) => row.delivery_challan_id).filter(Boolean))];

      const inwardRows = inwardIds.length
        ? await runQuery(
            'material_inward',
            supabase
              .from('material_inward')
              .select('id, inward_date, vendor_name, invoice_no, remarks, created_at')
              .in('id', inwardIds)
          )
        : [];

      const outwardRows = outwardIds.length
        ? await runQuery(
            'material_outward',
            supabase
              .from('material_outward')
              .select('id, outward_date, project_id, remarks, created_at')
              .in('id', outwardIds)
          )
        : [];

      const quotationRows = quotationIds.length
        ? await runQuery(
            'quotation_header',
            supabase
              .from('quotation_header')
              .select('id, quotation_no, date, client_id, status, grand_total, created_at')
              .in('id', quotationIds)
          )
        : [];

      const challanRows = challanIds.length
        ? await runQuery(
            'delivery_challans',
            supabase
              .from('delivery_challans')
              .select('id, dc_number, dc_date, status, client_name, created_at')
              .in('id', challanIds)
          )
        : [];

      const clientIds = [...new Set(quotationRows.map((row) => row.client_id).filter(Boolean))];
      const clientRows = clientIds.length
        ? await runQuery('clients', supabase.from('clients').select('id, client_name').in('id', clientIds))
        : [];

      const warehouseMap = {};
      warehouseMasterRows.forEach((row) => {
        warehouseMap[row.id] = row.warehouse_name || row.name || row.warehouse_code || 'Warehouse';
      });

      const variantMap = {};
      variantMasterRows.forEach((row) => {
        variantMap[row.id] = row.variant_name;
      });

      const inwardMap = {};
      inwardRows.forEach((row) => {
        inwardMap[row.id] = row;
      });

      const outwardMap = {};
      outwardRows.forEach((row) => {
        outwardMap[row.id] = row;
      });

      const quotationMap = {};
      quotationRows.forEach((row) => {
        quotationMap[row.id] = row;
      });

      const challanMap = {};
      challanRows.forEach((row) => {
        challanMap[row.id] = row;
      });

      const clientMap = {};
      clientRows.forEach((row) => {
        clientMap[row.id] = row.client_name;
      });

      const normalizedWarehouseRows = warehouseStockRows
        .map((row) => ({
          id: row.id,
          warehouse: warehouseMap[row.warehouse_id] || 'Unassigned',
          variant: variantMap[row.company_variant_id] || 'Default',
          current_stock: parseFloat(row.current_stock) || 0,
          low_stock_level: parseFloat(row.low_stock_level) || 0,
          updated_at: row.updated_at,
        }))
        .sort((a, b) => a.warehouse.localeCompare(b.warehouse));

      const inwardAdjustments = inwardItemRows.map((row) => {
        const header = inwardMap[row.inward_id] || {};
        return {
          id: `in-${row.id}`,
          type: 'Inward',
          source: 'Material Inward',
          doc_no: header.invoice_no || row.inward_id || '-',
          txn_date: header.inward_date || row.created_at,
          party: header.vendor_name || '-',
          qty: parseFloat(row.quantity) || 0,
          unit: row.unit || '-',
          remarks: header.remarks || '-',
        };
      });

      const outwardAdjustments = outwardItemRows.map((row) => {
        const header = outwardMap[row.outward_id] || {};
        return {
          id: `out-${row.id}`,
          type: 'Outward',
          source: 'Material Outward/Rejection',
          doc_no: row.outward_id || '-',
          txn_date: header.outward_date || row.created_at,
          party: header.project_id || '-',
          qty: (parseFloat(row.quantity) || 0) * -1,
          unit: row.unit || '-',
          remarks: header.remarks || '-',
        };
      });

      const normalizedAdjustments = [...inwardAdjustments, ...outwardAdjustments].sort(
        (a, b) => new Date(b.txn_date || 0).getTime() - new Date(a.txn_date || 0).getTime()
      );

      const normalizedQuotationRows = quotationItemRows
        .map((row) => {
          const header = quotationMap[row.quotation_id] || {};
          return {
            id: row.id,
            quotation_no: header.quotation_no || row.quotation_id || '-',
            quote_date: header.date || row.created_at,
            client_name: clientMap[header.client_id] || '-',
            status: header.status || '-',
            qty: parseFloat(row.qty) || 0,
            uom: row.uom || '-',
            rate: parseFloat(row.rate) || 0,
            line_total: parseFloat(row.line_total) || 0,
          };
        })
        .sort((a, b) => new Date(b.quote_date || 0).getTime() - new Date(a.quote_date || 0).getTime());

      const normalizedChallanRows = challanItemRows
        .map((row) => {
          const header = challanMap[row.delivery_challan_id] || {};
          return {
            id: row.id,
            dc_no: header.dc_number || row.delivery_challan_id || '-',
            dc_date: header.dc_date || row.created_at,
            client_name: header.client_name || '-',
            status: header.status || '-',
            qty: parseFloat(row.quantity) || 0,
            unit: row.unit || '-',
            amount: parseFloat(row.amount) || 0,
          };
        })
        .sort((a, b) => new Date(b.dc_date || 0).getTime() - new Date(a.dc_date || 0).getTime());

      const inwardInvoiceRows = inwardItemRows
        .map((row) => {
          const header = inwardMap[row.inward_id] || {};
          return {
            id: `inv-in-${row.id}`,
            type: 'Purchase Invoice',
            doc_no: header.invoice_no || '-',
            doc_date: header.inward_date || row.created_at,
            party: header.vendor_name || '-',
            qty: parseFloat(row.quantity) || 0,
            amount: parseFloat(row.amount) || (parseFloat(row.rate) || 0) * (parseFloat(row.quantity) || 0),
          };
        })
        .filter((row) => row.doc_no && row.doc_no !== '-');

      const challanInvoiceRows = challanItemRows.map((row) => {
        const header = challanMap[row.delivery_challan_id] || {};
        return {
          id: `inv-dc-${row.id}`,
          type: 'Sales Invoice',
          doc_no: header.dc_number || '-',
          doc_date: header.dc_date || row.created_at,
          party: header.client_name || '-',
          qty: parseFloat(row.quantity) || 0,
          amount: parseFloat(row.amount) || 0,
        };
      });

      const noteRows = outwardItemRows
        .map((row) => {
          const header = outwardMap[row.outward_id] || {};
          const remarks = (header.remarks || '').toLowerCase();
          const isCredit = remarks.includes('credit');
          const isDebit = remarks.includes('debit');
          if (!isCredit && !isDebit) return null;
          return {
            id: `note-${row.id}`,
            type: isCredit ? 'Credit Note' : 'Debit Note',
            doc_no: row.outward_id || '-',
            doc_date: header.outward_date || row.created_at,
            party: header.project_id || '-',
            qty: parseFloat(row.quantity) || 0,
            amount: 0,
          };
        })
        .filter(Boolean);

      const normalizedInvoiceRows = [...inwardInvoiceRows, ...challanInvoiceRows, ...noteRows].sort(
        (a, b) => new Date(b.doc_date || 0).getTime() - new Date(a.doc_date || 0).getTime()
      );

      const normalizedPurchaseRows = inwardItemRows
        .map((row) => {
          const header = inwardMap[row.inward_id] || {};
          const qty = parseFloat(row.quantity) || 0;
          const rate = parseFloat(row.rate) || 0;
          return {
            id: `pur-${row.id}`,
            vendor_name: header.vendor_name || '-',
            invoice_no: header.invoice_no || '-',
            purchase_date: header.inward_date || row.created_at,
            qty,
            unit: row.unit || '-',
            rate,
            amount: parseFloat(row.amount) || (qty * rate),
          };
        })
        .sort((a, b) => new Date(b.purchase_date || 0).getTime() - new Date(a.purchase_date || 0).getTime());

      const dbAuditRowsNormalized = auditDbRows.map((row) => ({
        id: row.id || `db-${row.created_at || Date.now()}`,
        action: row.action || row.action_type || row.event_type || 'UPDATED',
        notes: row.notes || row.action_details || row.description || '-',
        created_at: row.created_at || row.updated_at || row.timestamp || new Date().toISOString(),
        changes: normalizeAuditChanges(row.changes || row.changed_fields || row.change_summary),
      }));

      const localAuditRowsNormalized = getLocalAuditTrail()
        .filter((row) => row.item_id === itemId)
        .map((row) => ({
          id: row.id,
          action: row.action || 'UPDATED',
          notes: row.notes || '-',
          created_at: row.created_at || new Date().toISOString(),
          changes: normalizeAuditChanges(row.changes),
        }));

      const normalizedAuditRows = [...dbAuditRowsNormalized, ...localAuditRowsNormalized].sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );

      setItemTransactions({
        warehouseRows: normalizedWarehouseRows,
        adjustmentRows: normalizedAdjustments,
        quotationRows: normalizedQuotationRows,
        invoiceRows: normalizedInvoiceRows,
        purchaseRows: normalizedPurchaseRows,
        challanRows: normalizedChallanRows,
        auditRows: normalizedAuditRows,
      });
    } catch (err) {
      console.error('Item transaction load error:', err);
      setDetailError(err.message || 'Unable to load linked transactions');
      setItemTransactions(emptyItemTransactions());
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedMaterialId) return;
    const exists = materials.some((item) => item.id === selectedMaterialId);
    if (!exists) {
      setSelectedMaterialId(null);
      setItemTransactions(emptyItemTransactions());
    }
  }, [materials, selectedMaterialId]);

  useEffect(() => {
    if (!selectedMaterialId) return;
    loadItemTransactions(selectedMaterialId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMaterialId]);

  const generateItemCode = () => {
    return 'ITEM-' + Date.now().toString(36).toUpperCase();
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();

    if (materialSavePending) return;
    setMaterialSavePending(true);

    if (!editingMaterial) {
      const { data: existing } = await supabase
        .from('materials')
        .select('id, name')
        .eq('organisation_id', organisation?.id)
        .ilike('name', formData.item_name.trim())
        .maybeSingle();
      if (existing) {
        alert(`"${formData.item_name}" already exists. Duplicate names are not allowed.`);
        setMaterialSavePending(false);
        return;
      }
    }

    if (formData.uses_variant && variantPricing.length === 0) {
      alert('Please add at least one variant pricing before saving.');
      setMaterialSavePending(false);
      return;
    }

    if (formData.hsn_code && !/^\d{1,10}$/.test(formData.hsn_code)) {
      alert('HSN/SAC must be numeric and up to 10 digits.');
      setMaterialSavePending(false);
      return;
    }

    const materialData = {
      item_code: formData.item_code || generateItemCode(),
      name: formData.item_name,
      display_name: formData.display_name || formData.item_name,
      main_category: formData.main_category || null,
      sub_category: formData.sub_category || null,
      size: formData.size || null,
      pressure_class: formData.pressure_class || null,
      make: formData.make || null,
      material: formData.material || null,
      end_connection: formData.end_connection || null,
      unit: formData.unit,
      sale_price: formData.sale_price ? parseFloat(formData.sale_price) : null,
      purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : null,
      hsn_code: formData.hsn_code || null,
      gst_rate: formData.gst_rate || null,
      is_active: formData.is_active,
      uses_variant: formData.uses_variant,
      discount_category_id: formData.discount_category_id || null,
      dimension: formData.dimension || null,
      dimension_unit: formData.dimension_unit || 'cm',
      weight: formData.weight ? parseFloat(formData.weight) : null,
      weight_unit: formData.weight_unit || 'kg',
      item_type: 'product',
      item_classification: formData.item_classification,
      allow_purchase: formData.allow_purchase,
      allow_sales: formData.allow_sales,
      show_in_bom: formData.show_in_bom,
      is_manufactured: formData.is_manufactured,
      organisation_id: organisation?.id
    };

    try {
      const isEditing = !!editingMaterial;
      const originalMaterial = editingMaterial;
      const nowIso = new Date().toISOString();
      let itemId;
      let createdMaterial = null;

      if (isEditing) {
        const { error } = await supabase
          .from('materials')
          .update({ ...materialData, updated_at: nowIso })
          .eq('id', editingMaterial.id);
        if (error) throw error;
        itemId = editingMaterial.id;
      } else {
        const { data, error } = await supabase.from('materials').insert(materialData).select().single();
        if (error) throw error;
        itemId = data.id;
        createdMaterial = data;
      }

      if (formData.has_alternative_unit && formData.alternative_units.length > 0) {
        await supabase.from('material_units').delete().eq('material_id', itemId);
        const unitsToInsert = formData.alternative_units.map(u => ({
          material_id: itemId,
          unit_name: u.unit_name,
          conversion_factor: parseFloat(u.conversion_factor)
        })).filter(u => u.unit_name && !isNaN(u.conversion_factor));
        if (unitsToInsert.length > 0) {
          const { error: unitsError } = await supabase.from('material_units').insert(unitsToInsert);
          if (unitsError) throw unitsError;
        }
      } else {
        await supabase.from('material_units').delete().eq('material_id', itemId);
      }

      if (formData.uses_variant && variantPricing.length > 0) {
        // Delete old pricing first to avoid duplicates if make changed
        await supabase.from('item_variant_pricing').delete().eq('item_id', itemId);
        
        const pricingToInsert = variantPricing
          .filter(p => p.sale_price || p.purchase_price)
          .map(p => ({
            item_id: itemId,
            company_variant_id: p.company_variant_id || null,
            make: p.make || '',
            sale_price: p.sale_price ? parseFloat(p.sale_price) : 0,
            purchase_price: p.purchase_price ? parseFloat(p.purchase_price) : null,
            updated_at: nowIso
          }));
          
        if (pricingToInsert.length > 0) {
          const { error: pricingError } = await supabase.from('item_variant_pricing').insert(pricingToInsert);
          if (pricingError) throw pricingError;
        }
      }
      
      if (formData.track_inventory && warehouses) {
        const activeVariantIds = formData.uses_variant 
          ? Array.from(new Set(variantPricing.map(p => p.company_variant_id || 'no_variant')))
          : ['no_variant'];

        const stockInsertions = [];
        for (const vId of activeVariantIds) {
          const dbVariantId = vId === 'no_variant' ? null : vId;
          for (const wh of warehouses) {
             const key = `${wh.id}_${vId}`;
             const ws = warehouseStock[key] || { exclude: false, current_stock: 0 };
             if (ws.exclude) {
                 if (dbVariantId) {
                     await supabase.from('item_stock').delete().eq('item_id', itemId).eq('warehouse_id', wh.id).eq('company_variant_id', dbVariantId);
                 } else {
                     await supabase.from('item_stock').delete().eq('item_id', itemId).eq('warehouse_id', wh.id).is('company_variant_id', null);
                 }
             } else {
                 stockInsertions.push({
                     item_id: itemId,
                     warehouse_id: wh.id,
                     company_variant_id: dbVariantId,
                     current_stock: ws.current_stock || 0,
                     updated_at: nowIso
                 });
             }
          }
        }
        if (stockInsertions.length > 0) {
            const { error: stockError } = await supabase.from('item_stock').upsert(stockInsertions, { onConflict: 'item_id, company_variant_id, warehouse_id' });
            if (stockError) console.error('Error saving warehouse stock:', stockError);
        }
      }

      // Save Vendor Mappings
      const vendorMappingsToInsert = vendorMappings
        .filter(m => m.vendor_id)
        .map(m => ({
          ...(m.id.toString().startsWith('new_') ? {} : { id: m.id }),
          material_id: itemId,
          variant_id: m.variant_id || null,
          make: m.make || null,
          vendor_id: m.vendor_id,
          base_rate: parseFloat(m.base_rate) || 0,
          discount_percent: parseFloat(m.discount_percent) || 0,
          is_preferred: m.is_preferred || false,
          organisation_id: organisation?.id,
          updated_at: new Date().toISOString()
        }));
      
      if (editingMaterial) {
        await supabase.from('vendor_material_pricing').delete().eq('material_id', itemId);
      }
      if (vendorMappingsToInsert.length > 0) {
        const { error: vmError } = await supabase.from('vendor_material_pricing').insert(vendorMappingsToInsert);
        if (vmError) throw vmError;
      }


      // Save Client Mappings
      await supabase.from('material_client_mappings').delete().eq('material_id', itemId);
      const mappingsToInsert = clientMappings
        .filter(m => m.client_id)
        .map(m => ({
          material_id: itemId,
          client_id: m.client_id,
          company_variant_id: m.company_variant_id || null,
          client_part_no: m.client_part_no,
          client_description: m.client_description,
          organisation_id: organisation?.id,
          updated_at: nowIso
        }));
      
      if (mappingsToInsert.length > 0) {
        const { error: mappingError } = await supabase.from('material_client_mappings').insert(mappingsToInsert);
        if (mappingError) throw mappingError;
      }

      // Save Client Pricing (ARC/Pricing)
      await supabase.from('material_client_pricing').delete().eq('material_id', itemId);
      const pricingToInsert = clientPricing
        .filter(p => p.client_id)
        .map(p => ({
          material_id: itemId,
          client_id: p.client_id,
          company_variant_id: p.company_variant_id || null,
          pricing_type: p.pricing_type || 'Fixed ARC',
          rate: p.rate ? parseFloat(p.rate) : null,
          valid_from: p.valid_from || null,
          valid_to: p.valid_to || null,
          status: p.status || 'active',
          organisation_id: organisation?.id,
          updated_at: nowIso
        }));

      if (pricingToInsert.length > 0) {
        const { error: pricingError } = await supabase.from('material_client_pricing').insert(pricingToInsert);
        if (pricingError) throw pricingError;
      }

      const changeLog = isEditing ? buildItemChangeLog(originalMaterial, materialData) : ['Item created'];
      const auditEntry = {
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        item_id: itemId,
        action: isEditing ? 'UPDATED' : 'CREATED',
        notes: isEditing ? `Item updated (${changeLog.length} changes)` : 'Item created',
        changes: changeLog,
        created_at: nowIso,
      };
      appendLocalAuditEntry(auditEntry);

      if (isEditing) {
        const dbAuditPayload = {
          item_id: itemId,
          action: 'UPDATED',
          notes: auditEntry.notes,
          changes: JSON.stringify(changeLog),
          created_at: nowIso,
        };
        const { error: auditError } = await supabase.from('item_audit_logs').insert(dbAuditPayload);
        if (auditError) {
          console.log('item_audit_logs write warning:', auditError.message);
        }
      }

      const nextMaterial = isEditing
        ? { ...originalMaterial, ...materialData, id: itemId }
        : (createdMaterial || { id: itemId, ...materialData });
      updateMaterialsCache((prev) => {
        const next = [...prev.filter((m) => m.id !== itemId), nextMaterial];
        next.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        return next;
      });

      setSaveNotice(isEditing ? 'Item updated successfully.' : 'Item added successfully.');
      setSelectedMaterialId(itemId);
      setActiveDetailTab(isEditing ? 'audit' : 'overview');
      await refreshMaterials();
      queryClient.invalidateQueries({ queryKey: ['materials-for-bom'] });
      if (selectedMaterialId === itemId) {
        await loadItemTransactions(itemId);
      }
      resetForm();
    } catch (err) {
      alert('Error saving: ' + (err?.message || String(err)));
    } finally {
      setMaterialSavePending(false);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingMaterial(null);
    setFormData({
      item_code: '', item_name: '', display_name: '', main_category: '', sub_category: '',
      size: '', pressure_class: '', make: '', material: '', end_connection: '',
      unit: 'nos', sale_price: '', purchase_price: '', hsn_code: '', gst_rate: 18, is_active: true,
      uses_variant: false, track_inventory: false, discount_category_id: null
    });
    setVariantPricing([]);
    setVendorMappings([]);
    
    // Initialize default warehouse stock
    const defaultWStock = {};
    if (warehouses) {
      warehouses.forEach(wh => {
        defaultWStock[`${wh.id}_no_variant`] = { exclude: false, current_stock: 0 };
      });
    }
    setWarehouseStock(defaultWStock);
    setClientMappings([]);
    setClientPricing([]);
  };

  const editMaterial = useCallback(async (material) => {
    setEditingMaterial(material);
    
    // Check if un-varianted stock exists
    let hasStock = false;
    let wStock = {};
    if (warehouses) {
      const itemStockRecords = stock ? stock.filter((s: any) => s.item_id === material.id) : [];
      if (itemStockRecords.length > 0) hasStock = true;
      
      itemStockRecords.forEach(record => {
        const vId = record.company_variant_id || 'no_variant';
        wStock[`${record.warehouse_id}_${vId}`] = {
          exclude: false,
          current_stock: parseFloat(record.current_stock) || 0
        };
      });
    }
    setWarehouseStock(wStock);
    
    setFormData({
      item_code: material.item_code || '',
      item_name: material.name || '',
      display_name: material.display_name || '',
      main_category: material.main_category || '',
      sub_category: material.sub_category || '',
      size: material.size || '',
      pressure_class: material.pressure_class || '',
      make: material.make || '',
      material: material.material || '',
      end_connection: material.end_connection || '',
      unit: material.unit || 'nos',
      has_alternative_unit: material.material_units && material.material_units.length > 0,
      alternative_units: material.material_units ? material.material_units.map((u: any) => ({ unit_name: u.unit_name, conversion_factor: u.conversion_factor.toString() })) : [],
      sale_price: material.sale_price || '',
      purchase_price: material.purchase_price || '',
      hsn_code: material.hsn_code || '',
      gst_rate: material.gst_rate || 18,
      is_active: material.is_active !== false,
      uses_variant: material.uses_variant || false,
      discount_category_id: material.discount_category_id || null,
      track_inventory: hasStock,
      dimension: material.dimension || '',
      dimension_unit: material.dimension_unit || 'cm',
      weight: material.weight || '',
      weight_unit: material.weight_unit || 'kg',
      item_classification: material.item_classification || 'goods_sold',
      allow_purchase: material.allow_purchase !== false,
      allow_sales: material.allow_sales !== false,
      show_in_bom: material.show_in_bom !== false,
      is_manufactured: material.is_manufactured === true
    });
    setShowForm(true);
    loadVariantPricing(material.id);
    loadVendorMappings(material.id);
    loadClientMappings(material.id);
    loadClientPricing(material.id);
  }, [warehouses, stock]);

  const handleUsesVariantChange = async (checked) => {
    if (editingMaterial && !checked && formData.uses_variant === true) {
      const records = await checkVariantRecords(editingMaterial.id);
      if (records.hasPricing || records.hasStock) {
        let message = 'Cannot disable variant for this item because:';
        if (records.hasPricing) message += '\n- Variant pricing records exist';
        if (records.hasStock) message += '\n- Variant stock records exist';
        message += '\n\nPlease delete these records first or contact support.';
        alert(message);
        return;
      }
    }
    setFormData(prev => ({ ...prev, uses_variant: checked, sale_price: checked ? '0' : prev.sale_price }));
    if (checked && variantPricing.length === 0) {
      addVariantPricingRow();
    }
  };

  const addVariantPricingRow = () => {
    setVariantPricing(prev => [
      ...prev,
      { id: Date.now() + Math.random(), company_variant_id: '', make: '', sale_price: '', purchase_price: '' }
    ]);
  };

  const removeVariantPricingRow = (id) => {
    setVariantPricing(prev => prev.filter(p => p.id !== id));
  };

  const handleVariantPricingRowChange = (id, field, value) => {
    setVariantPricing(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const addVendorMappingRow = () => {
    setVendorMappings(prev => [
      ...prev,
      { id: `new_${Date.now()}`, variant_id: null, make: '', vendor_id: '', base_rate: 0, discount_percent: 0, is_preferred: false }
    ]);
  };

  const removeVendorMappingRow = (id) => {
    setVendorMappings(prev => prev.filter(p => p.id !== id));
  };

  const handleVendorMappingChange = (id, field, value) => {
    setVendorMappings(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const addClientMappingRow = () => {
    setClientMappings(prev => [
      ...prev,
      { id: 'temp-' + Date.now(), client_id: '', company_variant_id: '', client_part_no: '', client_description: '' }
    ]);
  };

  const removeClientMappingRow = (id) => {
    setClientMappings(prev => prev.filter(p => p.id !== id));
  };

  const handleClientMappingChange = (id, field, value) => {
    setClientMappings(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const addClientPricingRow = () => {
    setClientPricing(prev => [
      ...prev,
      { id: 'temp-' + Date.now(), client_id: '', company_variant_id: '', pricing_type: 'Fixed ARC', rate: '', valid_from: '', valid_to: '', status: 'active' }
    ]);
  };

  const removeClientPricingRow = (id) => {
    setClientPricing(prev => prev.filter(p => p.id !== id));
  };

  const handleClientPricingChange = (id, field, value) => {
    setClientPricing(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const deleteMaterial = async (id) => {
    setDeleteInProgress(true);
    try {
      const linkedTables: string[] = [];
      
      const checks = await Promise.allSettled([
        { table: 'quotation_items', key: 'item_id', name: 'Quotations' },
        { table: 'delivery_challan_items', key: 'material_id', name: 'Delivery Challans' },
        { table: 'material_inward_items', key: 'material_id', name: 'Material Inward' },
        { table: 'material_outward_items', key: 'material_id', name: 'Material Outward' },
        { table: 'invoice_items', key: 'material_id', name: 'Invoices' },
        { table: 'purchase_order_items', key: 'material_id', name: 'Purchase Orders' },
        { table: 'purchase_bill_items', key: 'material_id', name: 'Purchase Bills' },
        { table: 'stock_transfer_items', key: 'material_id', name: 'Stock Transfers' },
        { table: 'quick_check_items', key: 'item_id', name: 'Quick Check' },
        { table: 'boq_items', key: 'material_id', name: 'BOQ' },
        { table: 'bom_items', key: 'material_id', name: 'Bills of Materials (BOM)' },
      ].map(async ({ table, key, name }) => {
        const { data } = await supabase.from(table).select('id').eq(key, id).limit(1);
        if (data?.length) linkedTables.push(name);
      }));

      if (linkedTables.length === 0) {
        await supabase.from('item_variant_pricing').delete().eq('item_id', id);
        await supabase.from('item_stock').delete().eq('item_id', id);

        const { error } = await supabase.from('materials').delete().eq('id', id);
        if (error) throw error;
        updateMaterialsCache((prev) => prev.filter((m) => m.id !== id));
        if (selectedMaterialId === id) {
          setSelectedMaterialId(null);
          setItemTransactions(emptyItemTransactions());
        }
        queryClient.invalidateQueries({ queryKey: ['itemStock'] });
      } else {
        const { error } = await supabase
          .from('materials')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', id);
        if (error) throw error;
        updateMaterialsCache((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, is_active: false, updated_at: new Date().toISOString() } : item
          )
        );
        alert(`Item is linked with:\n- ${linkedTables.join('\n- ')}\n\nIt has been archived (disabled) instead of hard delete.`);
      }
    } catch (err) {
      console.error('Delete item error:', err);
      alert('Unable to delete item: ' + err.message);
    } finally {
      setDeleteInProgress(false);
    }
  };

  const toggleActive = async (material) => {
    const nowIso = new Date().toISOString();
    await supabase.from('materials').update({ is_active: !material.is_active, updated_at: nowIso }).eq('id', material.id);
    updateMaterialsCache((prev) =>
      prev.map((item) =>
        item.id === material.id ? { ...item, is_active: !material.is_active, updated_at: nowIso } : item
      )
    );
  };

  const filteredMaterials = useMemo(() => {
    return materials.filter(m => {
      const searchTermLower = searchTerm.toLowerCase();
      const matchesSearch = 
        m.name?.toLowerCase().includes(searchTermLower) ||
        m.display_name?.toLowerCase().includes(searchTermLower) ||
        m.item_code?.toLowerCase().includes(searchTermLower) ||
        m.material?.toLowerCase().includes(searchTermLower);
      const matchesCategory = categoryFilter === 'All' || m.main_category === categoryFilter;
      const matchesActive = !hideInactive || m.is_active;
      return matchesSearch && matchesCategory && matchesActive;
    }).sort((a, b) => (a.display_name || a.name || '').localeCompare(b.display_name || b.name || ''));
  }, [materials, searchTerm, categoryFilter, hideInactive]);

  const selectedMaterial = useMemo(() => materials.find((item) => item.id === selectedMaterialId) || null, [materials, selectedMaterialId]);

  const openDeleteModal = useCallback((material) => {
    setDeleteTarget(material);
  }, []);

  const closeDeleteModal = useCallback(() => {
    if (deleteInProgress) return;
    setDeleteTarget(null);
  }, [deleteInProgress]);

  const confirmDeleteMaterial = useCallback(async () => {
    if (!deleteTarget?.id) return;
    await deleteMaterial(deleteTarget.id);
    setDeleteTarget(null);
  }, [deleteTarget]);

  const selectMaterialRow = useCallback((material) => {
    setSelectedMaterialId(material.id);
    setActiveDetailTab('overview');
    setShowItemWorkspace(true);
  }, []);

  const closeItemWorkspace = useCallback(() => {
    setShowItemWorkspace(false);
  }, []);

  const workspaceMaterials = materials
    .filter((item) => {
      if (!workspaceSearch.trim()) return true;
      const s = workspaceSearch.toLowerCase();
      return (
        item.display_name?.toLowerCase().includes(s) ||
        item.name?.toLowerCase().includes(s) ||
        item.item_code?.toLowerCase().includes(s)
      );
    })
    .sort((a, b) => (a.display_name || a.name || '').localeCompare(b.display_name || b.name || ''));

  const formatColumnValue = (material, key) => {
    switch (key) {
      case 'sub_category':
        return material.sub_category || '-';
      case 'size':
        return material.size || '-';
      case 'pressure_class':
        return material.pressure_class || '-';
      case 'make':
        return material.make || '-';
      case 'material':
        return material.material || '-';
      case 'end_connection':
        return material.end_connection || '-';
      case 'sale_price':
        return formatCurrencyOrDash(material.sale_price);
      case 'purchase_price':
        return formatCurrencyOrDash(material.purchase_price);
      case 'hsn_code':
        return material.hsn_code || '-';
      case 'gst_rate':
        return material.gst_rate !== null && material.gst_rate !== undefined ? `${material.gst_rate}%` : '-';
      case 'uses_variant':
        return material.uses_variant ? 'Yes' : 'No';
      default:
        return '-';
    }
  };

  const itemColumns = useMemo(() => {
    const columns: any[] = [];
    
    // Helper to create basic text column
    const textCol = (key: string, label: string, accessor: (m: any) => any) => ({
      id: key,
      header: () => (
        <span className="text-xs font-semibold text-zinc-500">{label}</span>
      ),
      cell: ({ row }: any) => (
        <span className="text-sm text-zinc-700">
          {accessor(row.original) || '—'}
        </span>
      )
    });

    // Helper to create numeric column
    const numberCol = (key: string, label: string, accessor: (m: any) => any) => ({
      id: key,
      header: () => (
        <div className="text-xs font-semibold text-zinc-500">
          {label}
        </div>
      ),
      cell: ({ row }: any) => (
        <div className="text-sm text-zinc-900 tabular-nums">
          {accessor(row.original) ?? '—'}
        </div>
      )
    });

    ITEM_TABLE_COLUMNS.forEach(colConfig => {
      if (!visibleColumns.includes(colConfig.key)) return;

      switch (colConfig.key) {
        case 'name':
          columns.push({
            id: 'name',
            header: () => (
              <span className="text-xs font-semibold text-zinc-500">Item Name</span>
            ),
            cell: ({ row }: any) => {
              const m = row.original;
              return (
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-zinc-900">
                    {m.display_name || m.name}
                  </span>
                  {(m.material || m.size) && (
                    <span className="text-[10px] text-zinc-500">
                      {m.material} {m.size}
                    </span>
                  )}
                </div>
              );
            }
          });
          break;

        case 'category':
          columns.push(textCol('category', 'Category', (m) => m.main_category));
          break;

        case 'code':
          columns.push(textCol('code', 'Code', (m) => m.item_code));
          break;

        case 'unit':
          columns.push(textCol('unit', 'Unit', (m) => m.unit));
          break;

        case 'gst_rate':
          columns.push(numberCol('gst_rate', 'GST Rate', (m) => m.gst_rate !== null ? `${m.gst_rate}%` : '-'));
          break;

        case 'hsn_code':
          columns.push(textCol('hsn_code', 'HSN/SAC', (m) => m.hsn_code));
          break;

        case 'uses_variant':
          columns.push(textCol('uses_variant', 'Discount Category', (m) => m.uses_variant ? 'Yes' : 'No'));
          break;

        case 'stock':
          columns.push({
            id: 'stock',
            header: () => (
              <div className="text-xs font-semibold text-zinc-500">Inventory</div>
            ),
            cell: ({ row }: any) => {
              const m = row.original;
              const stock = stockData[m.id] || 0;
              const isLowStock = stock < (m.low_stock_level || 0);
              return (
                <span className={`text-sm font-semibold ${isLowStock ? 'text-red-600' : 'text-green-600'}`}>
                  {stock}
                </span>
              );
            }
          });
          break;

        case 'status':
          columns.push({
            id: 'status',
            header: () => (
              <span className="text-xs font-semibold text-zinc-500">Status</span>
            ),
            cell: ({ row }: any) => {
              const active = row.original.is_active !== false;
              return (
                <span className={`px-2 py-1 text-[10px] font-medium ${
                  active ? 'bg-green-50 text-green-700' : 'bg-zinc-100 text-zinc-600'
                }`}>
                  {active ? 'Active' : 'Inactive'}
                </span>
              );
            }
          });
          break;

        case 'actions':
          columns.push({
            id: 'actions',
            header: () => (
              <span className="text-xs font-semibold text-zinc-500">Actions</span>
            ),
            cell: ({ row }: any) => {
              const m = row.original;
              return (
                <div className="flex items-center justify-center gap-1">
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); editMaterial(m); }}>
                    <Edit className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600 hover:text-red-700" onClick={(e) => { e.stopPropagation(); openDeleteModal(m); }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              );
            }
          });
          break;

        default:
          columns.push(textCol(colConfig.key, colConfig.label, (m) => formatColumnValue(m, colConfig.key)));
          break;
      }
    });

    return columns;
  }, [visibleColumns, stockData, editMaterial, openDeleteModal]);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;
  
  const totalPages = Math.ceil(filteredMaterials.length / pageSize);
  const visibleMaterials = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredMaterials.slice(start, start + pageSize);
  }, [filteredMaterials, currentPage]);

  const table = useReactTable({
    data: visibleMaterials,
    columns: itemColumns,
    getCoreRowModel: getCoreRowModel()
  });

  const addMultiItemRow = (cloneFrom?: any) => {
    const newId = Date.now() + Math.random();
    if (cloneFrom) {
      setMultiItemRows(prev => {
        const index = prev.findIndex(r => r.id === cloneFrom.id);
        const newRows = [...prev];
        newRows.splice(index + 1, 0, { 
          ...cloneFrom, 
          id: newId, 
          inventory: 0, 
          variant_id: '', 
          sale_price: '', 
          purchase_price: '',
          uses_variant: true 
        });
        return newRows;
      });
    } else {
      setMultiItemRows(prev => [
        ...prev,
        { 
          id: newId, category: '', name: '', unit: 'nos', gst_rate: 18, hsn_code: '', 
          uses_variant: false, inventory: 0, variant_id: '', sale_price: '', purchase_price: '' 
        }
      ]);
    }
  };

  const removeMultiItemRow = (id) => {
    setMultiItemRows(prev => prev.filter(r => r.id !== id));
  };

  const updateMultiItemRow = (id, field, value) => {
    setMultiItemRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const validateMultiItems = () => {
    const invalid = multiItemRows.some(r => {
      const basicInvalid = !r.name || !r.category || !r.unit;
      const variantInvalid = r.uses_variant && (!r.variant_id || !r.sale_price);
      return basicInvalid || variantInvalid;
    });

    if (invalid) {
      alert('Please fill all mandatory fields. If Variant is checked, Variant type and Sale Price are required.');
      return false;
    }
    return true;
  };

  const handleSequentialSave = async () => {
    if (!validateMultiItems()) return;

    setIsSavingSequentially(true);
    setSaveProgress({ current: 0, total: multiItemRows.length });

    const errors = [];
    let successCount = 0;

    // Smart Grouping: Track created materials in this session
    const materialIdCache = new Map();

    for (let i = 0; i < multiItemRows.length; i++) {
      const row = multiItemRows[i];
      setSaveProgress({ current: i + 1, total: multiItemRows.length });

      const groupKey = `${row.name.trim().toLowerCase()}|${row.category}|${row.unit}`;
      let materialId = materialIdCache.get(groupKey);

      try {
        if (!materialId) {
          // Create new base material
          const materialData = {
            item_code: generateItemCode(),
            name: row.name,
            display_name: row.name,
            main_category: row.category,
            unit: row.unit,
            hsn_code: row.hsn_code || null,
            gst_rate: row.gst_rate || 18,
            uses_variant: row.uses_variant,
            item_type: 'product',
            organisation_id: organisation?.id,
            is_active: true,
            allow_purchase: true,
            allow_sales: true,
            show_in_bom: true,
            is_manufactured: false,
            sale_price: row.uses_variant ? 0 : (row.sale_price ? parseFloat(row.sale_price) : 0)
          };

          const { data, error } = await supabase.from('materials').insert(materialData).select().single();
          if (error) throw error;

          materialId = data.id;
          materialIdCache.set(groupKey, materialId);
        }

        // Add Variant Pricing
        if (row.uses_variant) {
          const { error: pricingError } = await supabase.from('item_variant_pricing').insert({
            item_id: materialId,
            company_variant_id: row.variant_id,
            sale_price: parseFloat(row.sale_price),
            purchase_price: row.purchase_price ? parseFloat(row.purchase_price) : 0,
            organisation_id: organisation?.id,
            updated_at: new Date().toISOString()
          });
          if (pricingError) throw pricingError;
        }

        // Add Inventory
        if (row.inventory > 0 && warehouses.length > 0) {
          const defaultWh = warehouses.find(w => w.is_default) || warehouses[0];
          const { error: stockError } = await supabase.from('item_stock').insert({
            item_id: materialId,
            warehouse_id: defaultWh.id,
            company_variant_id: row.uses_variant ? row.variant_id : null,
            current_stock: parseFloat(row.inventory),
            organisation_id: organisation?.id,
            updated_at: new Date().toISOString()
          });
          if (stockError) throw stockError;
        }

        successCount++;
      } catch (err) {
        errors.push(`Row ${i + 1} (${row.name}): ${err.message}`);
      }
    }

    setIsSavingSequentially(false);
    setShowReviewModal(false);
    setShowMultiItemModal(false);
    setMultiItemRows([]);

    if (errors.length > 0) {
      alert(`Save complete with errors:\n${errors.join('\n')}`);
    } else {
      setSaveNotice(`Successfully saved ${successCount} entries for ${materialIdCache.size} unique items.`);
    }
    refreshMaterials();
  };
  const overviewStats = {
    totalStock: itemTransactions.warehouseRows.reduce((sum, row) => sum + (row.current_stock || 0), 0),
    lowStockWarehouses: itemTransactions.warehouseRows.filter(
      (row) => row.low_stock_level > 0 && row.current_stock <= row.low_stock_level
    ).length,
    linkedTransactions:
      itemTransactions.adjustmentRows.length +
      itemTransactions.quotationRows.length +
      itemTransactions.invoiceRows.length +
      itemTransactions.purchaseRows.length +
      itemTransactions.challanRows.length +
      itemTransactions.auditRows.length,
  };

  return (
    <div className="h-full flex flex-col" style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: '12px', lineHeight: '1.5' }}>
      <style>{`
        .items-tab * { fontFamily: 'Inter', system-ui, sans-serif !important; }
        .items-tab table { fontSize: 12px !important; }
        .items-tab th { fontSize: 11px !important; fontWeight: 600 !important; letterSpacing: 0.03em !important; }
        .items-tab td { fontSize: 12px !important; }
        .items-tab input, .items-tab select, .items-tab textarea { fontSize: 12px !important; }
        .items-tab button { fontSize: 12px !important; }
        .items-tab label { fontSize: 12px !important; }
      `}</style>

      <div className="h-full flex flex-col" style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: '12px', lineHeight: '1.5' }}>
      {/* Sequential Saving Progress Overlay */}
      {isSavingSequentially && (
        <div className="modal-overlay open" style={{ zIndex: 10000, background: 'rgba(255,255,255,0.9)' }}>
          <div className="text-center p-8 bg-white border border-zinc-200 shadow-xl">
            <div className="loading-spinner mb-4 mx-auto"></div>
            <h3 className="text-lg font-bold text-zinc-900 mb-1">Saving Items...</h3>
            <p className="text-sm text-zinc-600 mb-4">Processing {saveProgress.current} of {saveProgress.total} items</p>
            <div className="w-64 h-2 bg-zinc-100 rounded-full mx-auto overflow-hidden">
              <div 
                className="h-full bg-indigo-600 transition-all duration-300" 
                style={{ width: `${(saveProgress.current / saveProgress.total) * 100}%` }}
              ></div>
            </div>
            <p className="text-[10px] text-zinc-400 mt-4 italic">Please do not close this window</p>
          </div>
        </div>
      )}

      {/* Category Heading (Collapsible) */}
      <div className="mb-4">
        <button 
          onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: '#111827', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          {showCategoryDropdown ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          Category: {categoryFilter === 'All' ? 'All Materials' : categoryFilter}
        </button>
      </div>

      <div style={{ padding: '8px 10px', marginBottom: '10px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', height: '30px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <InventoryIcon style={{ width: '14px', height: '14px', color: '#4f46e5' }} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#111827' }}>Materials</span>
            <Badge variant="outline" style={{ fontSize: '10px', fontWeight: 500, padding: '1px 6px' }}>{filteredMaterials.length} items</Badge>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {/* Hide Inactive */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '12px', color: '#6b7280', marginRight: '4px' }}>
              <input type="checkbox" checked={hideInactive} onChange={(e) => setHideInactive(e.target.checked)} style={{ width: '13px', height: '13px' }} />
              Hide Inactive
            </label>

            <div style={{ width: '1px', height: '18px', background: '#e5e7eb' }} />

            {/* Category */}
            <div data-dropdown="category" style={{ position: 'relative' }}>
              <button 
                onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                style={{ display: 'flex', alignItems: 'center', gap: '3px', height: '28px', padding: '0 8px', borderRadius: '6px', border: categoryFilter !== 'All' ? '1px solid #6366f1' : '1px solid #d1d5db', background: categoryFilter !== 'All' ? '#4f46e5' : '#fff', color: categoryFilter !== 'All' ? '#fff' : '#374151', fontSize: '12px', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}
              >
                {categoryFilter === 'All' ? 'Category' : categoryFilter}
                <ChevronDown style={{ width: '12px', height: '12px' }} />
              </button>
              {showCategoryDropdown && (
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '4px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: '4px', minWidth: '140px', zIndex: 50 }}>
                  <button
                    style={{ width: '100%', textAlign: 'left', padding: '6px 10px', border: 'none', background: 'transparent', borderRadius: '6px', fontSize: '12px', color: '#374151', cursor: 'pointer' }}
                    onClick={() => { setCategoryFilter('All'); setShowCategoryDropdown(false); }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    All Categories
                  </button>
                  {MAIN_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      style={{ width: '100%', textAlign: 'left', padding: '6px 10px', border: 'none', background: categoryFilter === cat ? '#eef2ff' : 'transparent', borderRadius: '6px', fontSize: '12px', color: categoryFilter === cat ? '#4f46e5' : '#374151', cursor: 'pointer' }}
                      onClick={() => { setCategoryFilter(cat); setShowCategoryDropdown(false); }}
                      onMouseEnter={e => { if (categoryFilter !== cat) e.currentTarget.style.background = '#f9fafb'; }}
                      onMouseLeave={e => { if (categoryFilter !== cat) e.currentTarget.style.background = 'transparent'; }}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Search */}
            <input
              type="text"
              placeholder="Search materials..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ height: '28px', width: '160px', padding: '0 8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '12px', color: '#374151', outline: 'none', background: '#fafafa' }}
            />

            <div style={{ width: '1px', height: '18px', background: '#e5e7eb' }} />

            <button onClick={() => setShowForm(true)} style={{ display: 'flex', alignItems: 'center', gap: '3px', height: '28px', padding: '0 10px', borderRadius: '6px', border: 'none', background: '#4f46e5', color: '#fff', fontSize: '12px', fontWeight: 500, cursor: 'pointer', transition: 'background 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = '#4338ca'}
              onMouseLeave={e => e.currentTarget.style.background = '#4f46e5'}>
              <Plus style={{ width: '12px', height: '12px' }} /> Add Material
            </button>
            <button onClick={() => { setMultiItemRows([{ id: Date.now(), category: '', name: '', unit: 'nos', gst_rate: 18, hsn_code: '', uses_variant: false, inventory: 0 }]); setShowMultiItemModal(true); }}
              style={{ display: 'flex', alignItems: 'center', gap: '3px', height: '28px', padding: '0 10px', borderRadius: '6px', border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: '12px', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.borderColor = '#9ca3af'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#d1d5db'; }}>
              <TableIcon style={{ width: '12px', height: '12px' }} /> Multi-Item
            </button>
            <button onClick={() => navigate('/store/adjust')}
              style={{ display: 'flex', alignItems: 'center', gap: '3px', height: '28px', padding: '0 10px', borderRadius: '6px', border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: '12px', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.borderColor = '#9ca3af'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#d1d5db'; }}>
              Adjust Stock
            </button>

            {/* Columns */}
            <div data-dropdown="columns" style={{ position: 'relative' }}>
              <button
                style={{ display: 'flex', alignItems: 'center', gap: '3px', height: '28px', padding: '0 8px', borderRadius: '6px', border: showColumnSettings ? '1px solid #6366f1' : '1px solid #d1d5db', background: showColumnSettings ? '#eef2ff' : '#fff', color: showColumnSettings ? '#4f46e5' : '#6b7280', fontSize: '12px', cursor: 'pointer', transition: 'all 0.15s' }}
                onClick={() => setShowColumnSettings((prev) => !prev)}
                onMouseEnter={e => { if (!showColumnSettings) { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.borderColor = '#9ca3af'; }}}
                onMouseLeave={e => { if (!showColumnSettings) { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#d1d5db'; }}}
              >
                <Settings style={{ width: '12px', height: '12px' }} /> Columns
              </button>
              {showColumnSettings && (
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '4px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: '8px', minWidth: '320px', zIndex: 50 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', padding: '0 4px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Columns</span>
                    <button
                      onClick={() => { localStorage.setItem('itemsTableColumns', JSON.stringify(visibleColumns)); setShowColumnSettings(false); setSaveNotice('Column layout saved as default'); }}
                      style={{ padding: '3px 8px', border: '1px solid #d1d5db', borderRadius: '4px', background: '#fff', color: '#374151', fontSize: '11px', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#f0fdf4'; e.currentTarget.style.borderColor = '#22c55e'; e.currentTarget.style.color = '#166534'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.color = '#374151'; }}
                    >
                      Save as Default
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px' }}>
                    {ITEM_TABLE_COLUMNS.map((column) => (
                      <label key={column.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', color: '#374151', padding: '4px 6px', borderRadius: '4px', transition: 'background 0.1s' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <input
                          type="checkbox"
                          checked={visibleColumns.includes(column.key)}
                          disabled={column.locked}
                          onChange={() => toggleColumn(column.key)}
                          style={{ width: '13px', height: '13px', accentColor: '#4f46e5' }}
                        />
                        {column.label}{column.locked ? ' *' : ''}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* More */}
            <div data-dropdown="more" style={{ position: 'relative' }}>
              <button
                style={{ display: 'flex', alignItems: 'center', height: '28px', padding: '0 6px', borderRadius: '6px', border: '1px solid #d1d5db', background: '#fff', color: '#6b7280', cursor: 'pointer', transition: 'all 0.15s' }}
                onClick={() => setShowMoreDropdown(!showMoreDropdown)}
                onMouseEnter={e => { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.borderColor = '#9ca3af'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#d1d5db'; }}
              >
                <MoreHorizontal style={{ width: '14px', height: '14px' }} />
              </button>
              {showMoreDropdown && (
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '4px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: '4px', minWidth: '160px', zIndex: 50 }}>
                  <button
                    style={{ width: '100%', textAlign: 'left', padding: '6px 10px', border: 'none', background: 'transparent', borderRadius: '6px', fontSize: '12px', color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                    onClick={() => { openBulkPriceModal(); setShowMoreDropdown(false); }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <Tag className="w-3 h-3" /> Bulk Price Update
                  </button>
                  <button
                    style={{ width: '100%', textAlign: 'left', padding: '6px 10px', border: 'none', background: 'transparent', borderRadius: '6px', fontSize: '12px', color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                    onClick={() => { setShowBulkImportModal(true); setShowMoreDropdown(false); }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <Upload className="w-3 h-3" /> Bulk Import
                  </button>
                  <button
                    style={{ width: '100%', textAlign: 'left', padding: '6px 10px', border: 'none', background: 'transparent', borderRadius: '6px', fontSize: '12px', color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                    onClick={() => { setShowFieldSelector(true); setShowMoreDropdown(false); }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <FileSpreadsheet className="w-3 h-3" /> Excel Edit
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {saveNotice && (
        <div className="alert alert-success">{saveNotice}</div>
      )}

      {isLoading ? (
        <div style={{ padding: '80px', textAlign: 'center' }}>
          <div className="loading-spinner"></div>
          <p style={{ marginTop: '10px', color: '#6b7280', fontSize: '12px' }}>Loading items...</p>
        </div>
      ) : isError ? (
        <div style={{ padding: '80px', textAlign: 'center' }}>
          <p style={{ marginBottom: '12px', color: '#b91c1c', fontWeight: 600, fontSize: '12px' }}>{materialsError || 'Unable to load materials.'}</p>
          <button type="button" className="btn btn-primary" onClick={retryItemDependencies}>
            Retry
          </button>
        </div>
      ) : (
        <>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
            {filteredMaterials.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center', color: '#6b7280' }}><h3 style={{ fontSize: '13px', fontWeight: 600 }}>No Items Found</h3></div>
            ) : (
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead className="bg-zinc-50 sticky top-0 z-10">
                  {table.getHeaderGroups().map(headerGroup => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map(header => (
                        <th 
                          key={header.id} 
                          style={{
                            padding: '8px 12px',
                            borderBottom: '1px solid #e5e7eb',
                            borderRight: '1px solid #f3f4f6',
                            fontSize: '11px',
                            fontWeight: 600,
                            color: '#6b7280',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            textAlign: header.id === 'name' ? 'left' : 'center',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map(row => {
                    const m = row.original;
                    const isActive = m.is_active !== false;
                    const isSelected = selectedMaterialId === m.id;

                    return (
                      <tr
                        key={row.id}
                        onClick={() => selectMaterialRow(m)}
                        style={{
                          cursor: 'pointer',
                          opacity: isActive ? 1 : 0.55,
                          background: isSelected ? '#eff6ff' : 'transparent',
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f9fafb'; }}
                        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                      >
                        {isSelected && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-r" />
                        )}
                        {row.getVisibleCells().map(cell => (
                          <td 
                            key={cell.id} 
                            style={{
                              padding: '8px 12px',
                              borderBottom: '1px solid #f3f4f6',
                              borderRight: '1px solid #f9fafb',
                              fontSize: '12px',
                              color: '#374151',
                              textAlign: cell.column.id === 'name' ? 'left' : 'center',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Pagination Controls */}
            <div style={{ padding: '8px 16px', borderTop: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fafafa', fontSize: '12px' }}>
              <div style={{ color: '#6b7280', fontWeight: 500 }}>
                Showing {visibleMaterials.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to {Math.min(currentPage * pageSize, filteredMaterials.length)} of {filteredMaterials.length} items
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Button 
                  variant="outline" 
                  size="sm" 
                  style={{ height: '28px', padding: '0 10px', fontSize: '12px' }}
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                >
                  First
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  style={{ height: '28px', padding: '0 10px', fontSize: '12px' }}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <span style={{ fontSize: '12px', fontWeight: 500, color: '#4b5563', padding: '0 8px' }}>
                  Page {currentPage} of {totalPages || 1}
                </span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  style={{ height: '28px', padding: '0 10px', fontSize: '12px' }}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage >= totalPages}
                >
                  Next
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  style={{ height: '28px', padding: '0 10px', fontSize: '12px' }}
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage >= totalPages}
                >
                  Last
                </Button>
              </div>
            </div>
          </div>
            )}
          </div>
        </>
      )}

      {showItemWorkspace && selectedMaterial && (
        <div className="modal-overlay open" onClick={closeItemWorkspace}>
          <div className="modal-content item-workspace-modal" onClick={(e) => e.stopPropagation()}>
            <div className="item-workspace-layout">
              <div className="item-workspace-left">
                <div className="item-workspace-left-head">
                  <h3 style={{ margin: 0, fontSize: '14px' }}>All Materials</h3>
                </div>
                <div style={{ padding: '10px' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Search materials..."
                    value={workspaceSearch}
                    onChange={(e) => setWorkspaceSearch(e.target.value)}
                  />
                </div>
                <div className="item-workspace-list">
                  {workspaceMaterials.map((mat) => (
                    <button
                      key={mat.id}
                      type="button"
                      className={`item-workspace-list-row ${selectedMaterialId === mat.id ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedMaterialId(mat.id);
                        setActiveDetailTab('overview');
                      }}
                    >
                      <span>{mat.display_name || mat.name}</span>
                      <strong>{(stockData[mat.id] || 0).toFixed(2)}</strong>
                    </button>
                  ))}
                </div>
              </div>

              <div className="item-workspace-right">
                <div className="item-details-head">
                  <div>
                    <h3 style={{ margin: 0 }}>{selectedMaterial.display_name || selectedMaterial.name}</h3>
                    <div className="item-details-meta">
                      Code: {selectedMaterial.item_code || '-'} | Category: {selectedMaterial.main_category || '-'} | Unit: {selectedMaterial.unit || '-'}
                    </div>
                  </div>
                  <button className="btn btn-secondary" type="button" onClick={closeItemWorkspace}>Close</button>
                </div>

                <div className="item-mini-tabs">
                  {ITEM_DETAIL_TABS.map((tab) => (
                    <button
                      key={tab.key}
                      className={`item-mini-tab ${activeDetailTab === tab.key ? 'active' : ''}`}
                      onClick={() => setActiveDetailTab(tab.key)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="item-detail-content">
                  {detailLoading && <div className="empty-state"><h3>Loading transactions...</h3></div>}
                  {!detailLoading && detailError && (
                    <div className="alert alert-error" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                      <span>{detailError}</span>
                      <button type="button" className="btn btn-secondary" onClick={() => loadItemTransactions(selectedMaterial.id)}>
                        Retry
                      </button>
                    </div>
                  )}

            {!detailLoading && !detailError && activeDetailTab === 'overview' && (
              <div>
                <div className="item-overview-grid">
                  <div className="item-overview-stat">
                    <div className="stat-label">Total Current Stock</div>
                    <div className="stat-value">{overviewStats.totalStock.toFixed(2)}</div>
                  </div>
                  <div className="item-overview-stat">
                    <div className="stat-label">Warehouses at Low Stock</div>
                    <div className="stat-value">{overviewStats.lowStockWarehouses}</div>
                  </div>
                  <div className="item-overview-stat">
                    <div className="stat-label">Linked Transactions</div>
                    <div className="stat-value">{overviewStats.linkedTransactions}</div>
                  </div>
                  <div className="item-overview-stat">
                    <div className="stat-label">Item Status</div>
                    <div className="stat-value">{selectedMaterial.is_active === false ? 'Inactive' : 'Active'}</div>
                  </div>
                </div>
              </div>
            )}

            {!detailLoading && !detailError && activeDetailTab === 'warehouse' && (
              itemTransactions.warehouseRows.length === 0 ? (
                <div className="empty-state"><h3>No warehouse stock records</h3></div>
              ) : (
                <div className="table-container" style={{ overflowX: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Warehouse</th>
                        <th>Variant</th>
                        <th>Current Stock</th>
                        <th>Low Stock Level</th>
                        <th>Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itemTransactions.warehouseRows.map((row) => (
                        <tr key={row.id}>
                          <td>{row.warehouse}</td>
                          <td>{row.variant}</td>
                          <td>{row.current_stock.toFixed(2)}</td>
                          <td>{row.low_stock_level.toFixed(2)}</td>
                          <td>{formatDate(row.updated_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {!detailLoading && !detailError && activeDetailTab === 'adjustments' && (
              itemTransactions.adjustmentRows.length === 0 ? (
                <div className="empty-state"><h3>No inward/rejection adjustments</h3></div>
              ) : (
                <div className="table-container" style={{ overflowX: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Source</th>
                        <th>Doc No</th>
                        <th>Date</th>
                        <th>Party/Project</th>
                        <th>Qty</th>
                        <th>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itemTransactions.adjustmentRows.map((row) => (
                        <tr key={row.id}>
                          <td>{row.type}</td>
                          <td>{row.source}</td>
                          <td>{row.doc_no}</td>
                          <td>{formatDate(row.txn_date)}</td>
                          <td>{row.party}</td>
                          <td style={{ color: row.qty < 0 ? '#b42318' : '#067647', fontWeight: 600 }}>
                            {row.qty.toFixed(2)} {row.unit}
                          </td>
                          <td>{row.remarks}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {!detailLoading && !detailError && activeDetailTab === 'quotation' && (
              itemTransactions.quotationRows.length === 0 ? (
                <div className="empty-state"><h3>No linked quotations</h3></div>
              ) : (
                <div className="table-container" style={{ overflowX: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Quotation No</th>
                        <th>Date</th>
                        <th>Client</th>
                        <th>Status</th>
                        <th>Qty</th>
                        <th>Rate</th>
                        <th>Line Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itemTransactions.quotationRows.map((row) => (
                        <tr key={row.id}>
                          <td>{row.quotation_no}</td>
                          <td>{formatDate(row.quote_date)}</td>
                          <td>{row.client_name}</td>
                          <td>{row.status}</td>
                          <td>{row.qty.toFixed(2)} {row.uom}</td>
                          <td>{formatCurrency(row.rate)}</td>
                          <td>{formatCurrency(row.line_total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {!detailLoading && !detailError && activeDetailTab === 'invoice' && (
              itemTransactions.invoiceRows.length === 0 ? (
                <div className="empty-state"><h3>No invoice/debit/credit links found</h3></div>
              ) : (
                <div className="table-container" style={{ overflowX: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Document No</th>
                        <th>Date</th>
                        <th>Party</th>
                        <th>Qty</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itemTransactions.invoiceRows.map((row) => (
                        <tr key={row.id}>
                          <td>{row.type}</td>
                          <td>{row.doc_no}</td>
                          <td>{formatDate(row.doc_date)}</td>
                          <td>{row.party}</td>
                          <td>{Number(row.qty || 0).toFixed(2)}</td>
                          <td>{formatCurrency(row.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {!detailLoading && !detailError && activeDetailTab === 'purchase' && (
              itemTransactions.purchaseRows.length === 0 ? (
                <div className="empty-state"><h3>No purchase records for this item</h3></div>
              ) : (
                <div className="table-container" style={{ overflowX: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Vendor</th>
                        <th>Invoice No</th>
                        <th>Purchase Date</th>
                        <th>Qty</th>
                        <th>Rate</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itemTransactions.purchaseRows.map((row) => (
                        <tr key={row.id}>
                          <td>{row.vendor_name}</td>
                          <td>{row.invoice_no}</td>
                          <td>{formatDate(row.purchase_date)}</td>
                          <td>{row.qty.toFixed(2)} {row.unit}</td>
                          <td>{formatCurrency(row.rate)}</td>
                          <td>{formatCurrency(row.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {!detailLoading && !detailError && activeDetailTab === 'audit' && (
              itemTransactions.auditRows.length === 0 ? (
                <div className="empty-state"><h3>No audit entries found</h3></div>
              ) : (
                <div className="table-container" style={{ overflowX: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>Action</th>
                        <th>Details</th>
                        <th>Changes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itemTransactions.auditRows.map((row) => (
                        <tr key={row.id}>
                          <td>{formatDate(row.created_at)}</td>
                          <td>{row.action}</td>
                          <td>{row.notes}</td>
                          <td>
                            {row.changes?.length
                              ? row.changes.join(' | ')
                              : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {!detailLoading && !detailError && activeDetailTab === 'challan' && (
              itemTransactions.challanRows.length === 0 ? (
                <div className="empty-state"><h3>No delivery challan records</h3></div>
              ) : (
                <div className="table-container" style={{ overflowX: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>DC No</th>
                        <th>Date</th>
                        <th>Client</th>
                        <th>Status</th>
                        <th>Qty</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itemTransactions.challanRows.map((row) => (
                        <tr key={row.id}>
                          <td>{row.dc_no}</td>
                          <td>{formatDate(row.dc_date)}</td>
                          <td>{row.client_name}</td>
                          <td>{row.status}</td>
                          <td>{row.qty.toFixed(2)} {row.unit}</td>
                          <td>{formatCurrency(row.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showBulkPriceModal && (
        <div className="modal-overlay open" onClick={closeBulkPriceModal}>
          <div
            className="modal-content bulk-price-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '980px', width: '94vw', background: '#fff' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0 }}>Bulk Price Update</h3>
              <button onClick={closeBulkPriceModal} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>×</button>
            </div>

            <div className="alert" style={{ background: '#f8fafc', color: '#344054', border: '1px solid #eaecf0' }}>
              Paste from Excel using tab-separated columns:
              <strong> Item Code/SKU or Name | Sale Price | Purchase Price(optional)</strong>.
              Header row is supported.
            </div>

            <textarea
              className="form-textarea"
              value={bulkPriceText}
              onChange={(e) => setBulkPriceText(e.target.value)}
              placeholder={'item_code\tsale_price\tpurchase_price\nITEM-001\t125.50\t90\nITEM-002\t330\t'}
              style={{ minHeight: '130px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
            />

            <div style={{ display: 'flex', gap: '10px', marginTop: '10px', marginBottom: '12px' }}>
              <button className="btn btn-secondary" type="button" onClick={parseBulkPriceRows} disabled={bulkInProgress}>
                Preview Changes
              </button>
              <button className="btn btn-primary" type="button" onClick={applyBulkPriceUpdates} disabled={bulkInProgress || bulkPreviewRows.length === 0}>
                {bulkInProgress ? 'Applying...' : `Apply ${bulkPreviewRows.length} Updates`}
              </button>
            </div>

            {bulkParseErrors.length > 0 && (
              <div className="alert alert-error" style={{ marginTop: '8px' }}>
                {bulkParseErrors.map((err, idx) => (
                  <div key={`parse-${idx}`}>{err}</div>
                ))}
              </div>
            )}

            {bulkApplyErrors.length > 0 && (
              <div className="alert alert-error" style={{ marginTop: '8px' }}>
                {bulkApplyErrors.map((err, idx) => (
                  <div key={`apply-${idx}`}>{err}</div>
                ))}
              </div>
            )}

            {bulkPreviewRows.length > 0 && (
              <div className="table-container" style={{ overflowX: 'auto', marginTop: '12px' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Item</th>
                      <th>Item Code / SKU</th>
                      <th>Current Sale</th>
                      <th>New Sale</th>
                      <th>Current Purchase</th>
                      <th>New Purchase</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkPreviewRows.map((row) => (
                      <tr key={`bulk-${row.rowNo}-${row.item.id}`}>
                        <td>{row.rowNo}</td>
                        <td>{row.item.display_name || row.item.name}</td>
                        <td>{row.item.item_code || '-'}</td>
                        <td>{formatCurrencyOrDash(row.item.sale_price)}</td>
                        <td>{formatCurrency(row.nextSale)}</td>
                        <td>{formatCurrencyOrDash(row.item.purchase_price)}</td>
                        <td>{formatCurrencyOrDash(row.nextPurchase)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <BulkImportModal
        open={showBulkImportModal}
        onClose={() => setShowBulkImportModal(false)}
        materials={materials}
        warehouses={warehouses}
        onSuccess={() => {
          refreshMaterials();
          setSaveNotice('Bulk import completed successfully');
        }}
      />

      {deleteTarget && (
        <div className="modal-overlay open" onClick={closeDeleteModal}>
          <div className="modal-content item-delete-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, marginBottom: '8px' }}>Delete Item</h3>
            <p style={{ margin: '0 0 16px 0', color: '#475467' }}>
              Are you sure you want to delete <strong>{deleteTarget.display_name || deleteTarget.name}</strong>?
              If this item is already linked with transactions, it will be archived instead of hard delete.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn btn-secondary" type="button" onClick={closeDeleteModal} disabled={deleteInProgress}>Cancel</button>
              <button className="btn btn-primary" type="button" onClick={confirmDeleteMaterial} disabled={deleteInProgress}>
                {deleteInProgress ? 'Processing...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showForm && (
        <div
          className="modal-overlay open"
          onClick={(e) => {
            if (e.target === e.currentTarget) resetForm();
          }}
        >
          <div className="modal-content item-modal" onClick={e => e.stopPropagation()} style={{ width: '92vw', maxWidth: '640px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', background: '#fff' }}>
            <div className="modal-header" style={{ flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <div>
                  <div className="modal-title">{editingMaterial ? 'Edit Item' : 'Add Item'}</div>
                  <div className="item-modal-subtitle">Fast, compact details for quotation, purchase, and inventory.</div>
                </div>
                <button type="button" onClick={resetForm} className="item-modal-close" aria-label="Close">
                  {'\u00D7'}
                </button>
              </div>
            </div>

            <div className="modal-body" style={{ flex: 1, overflowY: 'auto' }}>
            <form id="item-form" onSubmit={handleSubmit}>
              <div className="item-form-section">
                <div className="item-form-section-header">
                  <h4 className="item-form-section-title">Basic Information</h4>
                  <span className="item-form-section-hint">Required</span>
                </div>
                <div className="mb-4">
                  <label className="form-label mb-2">Item Classification</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {CLASSIFICATION_OPTIONS.map((opt) => {
                      const isSelected = formData.item_classification === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setItemClassification(opt.value)}
                          className={`min-w-0 rounded-md border px-2.5 py-2 text-left transition-all duration-200 group ${
                            isSelected
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                              : 'border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className={`text-[10px] leading-4 transition-all duration-200 ${isSelected ? 'font-semibold' : 'font-medium'}`}>
                                {opt.label}
                              </div>
                              <div className="mt-0.5 text-[8px] leading-3 transition-all duration-200">
                                <span className={isSelected ? 'text-emerald-600' : 'text-zinc-400 group-hover:text-zinc-500'}>
                                  {opt.desc}
                                </span>
                              </div>
                            </div>
                            <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all duration-200 ${
                              isSelected
                                ? 'border-emerald-500 bg-emerald-50 text-emerald-600'
                                : 'border-zinc-300 bg-white text-zinc-400'
                            }`}>
                              {isSelected && (
                                <svg className="h-2 w-2" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="M4 10l3.5 3.5L16 5" />
                                </svg>
                              )}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Item Name *</label>
                    <input type="text" className="form-input" value={formData.item_name} onChange={e => setFormData({...formData, item_name: e.target.value, display_name: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Display Name (for Quotation)</label>
                    <input type="text" className="form-input" value={formData.display_name} onChange={e => setFormData({...formData, display_name: e.target.value})} placeholder="Name shown in quotations" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Item Code / SKU</label>
                    <input type="text" className="form-input" value={formData.item_code} onChange={e => setFormData({...formData, item_code: e.target.value})} placeholder="Auto-generated if empty" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Main Category</label>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <select className="form-select" value={formData.main_category} onChange={e => setFormData({...formData, main_category: e.target.value})}
                        style={{ flex: 1 }}>
                        <option value="">Select Category</option>
                        {categoryOptions.map((categoryName) => (
                          <option key={categoryName} value={categoryName}>{categoryName}</option>
                        ))}
                      </select>
                      {showNewCategory ? (
                        <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                          <input type="text" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)}
                            placeholder="Category name" autoFocus
                            style={{ width: '110px', padding: '6px 8px', fontSize: '11px', border: '1px solid #d1d5db', borderRadius: '6px', outline: 'none' }}
                            onKeyDown={e => { if (e.key === 'Enter') addNewCategory(); if (e.key === 'Escape') { setShowNewCategory(false); setNewCategoryName(''); }}}
                          />
                          <button type="button" onClick={addNewCategory} title="Save"
                            style={{ width: '26px', height: '26px', border: 'none', background: '#185FA5', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            ✓
                          </button>
                          <button type="button" onClick={() => { setShowNewCategory(false); setNewCategoryName(''); }} title="Cancel"
                            style={{ width: '26px', height: '26px', border: '1px solid #d1d5db', background: '#fff', color: '#6b7280', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setShowNewCategory(true)} title="Add new category"
                          style={{ width: '26px', height: '26px', border: '1px dashed #d1d5db', background: '#fff', color: '#9ca3af', borderRadius: '6px', cursor: 'pointer', fontSize: '16px', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = '#185FA5'; e.currentTarget.style.color = '#185FA5'; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.color = '#9ca3af'; }}>
                          +
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="item-form-section">
                <div className="item-form-section-header" onClick={() => setShowTechnical(!showTechnical)} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  <h4 className="item-form-section-title">{showTechnical ? '▾' : '▸'} Technical Attributes</h4>
                  <span className="item-form-section-hint">Internal use</span>
                </div>
                {showTechnical && (
                <>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Dimensions (L × W × H)</label>
                    <div className="flex gap-1 items-center">
                      <input 
                        type="text" 
                        className="form-input" 
                        value={formData.dimension} 
                        onChange={e => setFormData({...formData, dimension: e.target.value})} 
                        placeholder="10x10x10" 
                      />
                      <select 
                        className="form-select" 
                        value={formData.dimension_unit} 
                        onChange={e => setFormData({...formData, dimension_unit: e.target.value})}
                        style={{ width: 'auto', minWidth: '60px' }}
                      >
                        <option value="cm">cm</option>
                        <option value="in">in</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Weight</label>
                    <div className="flex gap-1 items-center">
                      <input 
                        type="number" 
                        className="form-input" 
                        value={formData.weight} 
                        onChange={e => setFormData({...formData, weight: e.target.value})} 
                        placeholder="0.0"
                        step="0.1" 
                      />
                      <select 
                        className="form-select" 
                        value={formData.weight_unit} 
                        onChange={e => setFormData({...formData, weight_unit: e.target.value})}
                        style={{ width: 'auto', minWidth: '60px' }}
                      >
                        <option value="kg">kg</option>
                        <option value="lb">lb</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Size</label>
                    <input type="text" className="form-input" value={formData.size} onChange={e => setFormData({...formData, size: e.target.value})} placeholder="e.g., 25mm, 1 inch" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Pressure Class</label>
                    <input type="text" className="form-input" value={formData.pressure_class} onChange={e => setFormData({...formData, pressure_class: e.target.value})} placeholder="e.g., PN16, Class 150" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Brand (Make)</label>
                    <input type="text" className="form-input" value={formData.make} onChange={e => setFormData({...formData, make: e.target.value})} placeholder="e.g. Kirloskar, Siemens" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Material of Construction</label>
                    <input type="text" className="form-input" value={formData.material} onChange={e => setFormData({...formData, material: e.target.value})} placeholder="e.g., SS304, CI, PVC" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">End Connection</label>
                    <input type="text" className="form-input" value={formData.end_connection} onChange={e => setFormData({...formData, end_connection: e.target.value})} placeholder="e.g., Threaded, Flanged, Solder" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Sub Category</label>
                    <input type="text" className="form-input" value={formData.sub_category} onChange={e => setFormData({...formData, sub_category: e.target.value})} placeholder="e.g., Ball Valve, Gate Valve" />
                  </div>
                </div>
                </>
                )}
              </div>

              <div className="item-form-section">
                <div className="item-form-section-header">
                  <h4 className="item-form-section-title">Commercial</h4>
                  <span className="item-form-section-hint">Pricing + GST</span>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Unit</label>
                    <select className="form-select" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})}>
                      {units.length > 0 ? units.map(u => (<option key={u.unit_code} value={u.unit_code}>{u.unit_name} ({u.unit_code})</option>)) : <option value="nos">Nos</option>}
                    </select>
                    
                    <div className="mt-4 p-4 border border-zinc-200 rounded-lg bg-zinc-50/50">
                      <label className="flex items-center space-x-2 text-sm font-medium text-zinc-900 cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                          checked={formData.has_alternative_unit}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setFormData({
                              ...formData,
                              has_alternative_unit: checked,
                              alternative_units: checked && formData.alternative_units.length === 0 
                                ? [{ unit_name: '', conversion_factor: '' }] 
                                : formData.alternative_units
                            });
                          }}
                        />
                        <span>Add alternative units</span>
                      </label>
                      
                      {formData.has_alternative_unit && (
                        <div className="mt-3 space-y-3">
                          {formData.alternative_units.map((altUnit, idx) => (
                            <div key={idx} className="flex items-center space-x-2">
                              <span className="text-sm text-zinc-500 whitespace-nowrap">1 {formData.unit} =</span>
                              <input
                                type="number"
                                step="0.0001"
                                placeholder="Qty"
                                className="form-input w-24 text-sm"
                                value={altUnit.conversion_factor}
                                onChange={(e) => {
                                  const newUnits = [...formData.alternative_units];
                                  newUnits[idx].conversion_factor = e.target.value;
                                  setFormData({ ...formData, alternative_units: newUnits });
                                }}
                              />
                              <select
                                className="form-select w-32 text-sm"
                                value={altUnit.unit_name}
                                onChange={(e) => {
                                  const newUnits = [...formData.alternative_units];
                                  newUnits[idx].unit_name = e.target.value;
                                  setFormData({ ...formData, alternative_units: newUnits });
                                }}
                              >
                                <option value="">Select Unit</option>
                                {units.map(u => (
                                  <option key={u.unit_code} value={u.unit_code}>{u.unit_name} ({u.unit_code})</option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => {
                                  const newUnits = formData.alternative_units.filter((_, i) => i !== idx);
                                  setFormData({ ...formData, alternative_units: newUnits });
                                }}
                                className="p-2 text-red-500 hover:bg-red-50 rounded"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              setFormData({
                                ...formData,
                                alternative_units: [...formData.alternative_units, { unit_name: '', conversion_factor: '' }]
                              });
                            }}
                            className="text-xs text-indigo-600 font-medium hover:text-indigo-700 flex items-center"
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Add another unit
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">HSN/SAC Code</label>
                    <input
                      type="text"
                      className="form-input"
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="Numeric only (max 10 digits)"
                      value={formData.hsn_code}
                      onChange={e => setFormData({...formData, hsn_code: e.target.value.replace(/\D/g, '').slice(0, 10)})}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">GST Rate (%)</label>
                    <select className="form-select" value={formData.gst_rate} onChange={e => setFormData({...formData, gst_rate: parseFloat(e.target.value)})}>
                      {GST_RATES.map(rate => (<option key={rate.value} value={rate.value}>{rate.label}</option>))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Sale Price</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      value={formData.uses_variant ? '0' : formData.sale_price} 
                      onChange={e => setFormData({...formData, sale_price: e.target.value})} 
                      step="0.01" 
                      disabled={formData.uses_variant}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Purchase Price</label>
                    <input type="number" className="form-input" value={formData.purchase_price} onChange={e => setFormData({...formData, purchase_price: e.target.value})} step="0.01" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Discount Category</label>
                    <select className="form-select" value={formData.discount_category_id || ''} onChange={e => setFormData({...formData, discount_category_id: e.target.value || null})}>
                      <option value="">No Discount Category</option>
                      {discountCategories.map(dc => (
                        <option key={dc.id} value={dc.id}>{dc.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="item-form-section-footer" style={{ display: 'flex', gap: '24px', padding: '8px 0 0 0', borderTop: '1px solid #e5e7eb', marginTop: '12px' }}>
                <label className="item-checkbox-row" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                  />
                  Active
                </label>

                <label className="item-checkbox-row" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.uses_variant}
                    onChange={e => {
                      const checked = e.target.checked;
                      if (editingMaterial) {
                        handleUsesVariantChange(checked);
                      } else {
                        setFormData({
                          ...formData,
                          uses_variant: checked,
                          sale_price: checked ? '0' : formData.sale_price
                        });
                        if (checked && variantPricing.length === 0) {
                          addVariantPricingRow();
                        }
                      }
                    }}
                  />
                  This item uses Variant Pricing
                </label>
              </div>

              {formData.uses_variant && (
                <div className="item-form-section">
                  <div className="item-form-section-header">
                    <div>
                      <h4 className="item-form-section-title">Variant Pricing</h4>
                      <div className="item-form-section-hint">By category &amp; make (brand)</div>
                    </div>
                    <button type="button" className="btn btn-sm btn-primary" onClick={addVariantPricingRow}>+ Add Row</button>
                  </div>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Variant</th>
                        <th>MAKE (Brand)</th>
                        <th>Sale Price</th>
                        <th>Purchase Price</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {variantPricing.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <select 
                              className="form-select" 
                              value={row.company_variant_id || ''} 
                              onChange={e => handleVariantPricingRowChange(row.id, 'company_variant_id', e.target.value)}
                            >
                              <option value="">No Category</option>
                              {variants.filter(v => v.variant_name !== 'No Variant').map(v => (
                                <option key={v.id} value={v.id}>{v.variant_name}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input 
                              type="text" 
                              className="form-input"
                              value={row.make || ''}
                              onChange={e => handleVariantPricingRowChange(row.id, 'make', e.target.value)}
                              placeholder="e.g. Brand A"
                            />
                          </td>
                          <td>
                            <input 
                              type="number" 
                              className="form-input"
                              value={row.sale_price || ''}
                              onChange={e => handleVariantPricingRowChange(row.id, 'sale_price', e.target.value)}
                              placeholder="0.00"
                              step="0.01"
                            />
                          </td>
                          <td>
                            <input 
                              type="number" 
                              className="form-input"
                              value={row.purchase_price || ''}
                              onChange={e => handleVariantPricingRowChange(row.id, 'purchase_price', e.target.value)}
                              placeholder="0.00"
                              step="0.01"
                            />
                          </td>
                          <td>
                            <button type="button" className="btn btn-sm btn-secondary" onClick={() => removeVariantPricingRow(row.id)}>Remove</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {variantPricing.length === 0 && (
                    <p style={{ color: '#dc3545', fontSize: '12px', marginTop: '8px' }}>At least one pricing row is required when using variants.</p>
                  )}
                </div>
              )}

              <div className="item-form-section">
                <div className="item-form-section-header">
                  <h4 className="item-form-section-title">Inventory Tracking</h4>
                  <span className="item-form-section-hint">Optional</span>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={formData.track_inventory} onChange={e => setFormData({...formData, track_inventory: e.target.checked})} />
                      Track Inventory (Warehouse Specific)
                    </label>
                  </div>
                </div>
                {formData.track_inventory && (
                  <div style={{ marginTop: '10px' }}>
                    {(() => {
                      const activeVariantIds = formData.uses_variant 
                        ? Array.from(new Set(variantPricing.map(p => p.company_variant_id || 'no_variant')))
                        : ['no_variant'];
                      
                      return activeVariantIds.map(vId => {
                        const vName = vId === 'no_variant' ? (formData.uses_variant ? 'No Category' : 'Standard Inventory') : variants.find(v => v.id === vId)?.variant_name || 'Unknown Category';
                        return (
                          <div key={vId} style={{ marginBottom: '12px' }}>
                            {formData.uses_variant && <h5 style={{ color: '#555', marginBottom: '6px' }}>{vName} Integration</h5>}
                            <table className="table" style={{ background: '#fff', fontSize: '13px' }}>
                              <thead>
                                <tr>
                                  <th>Warehouse</th>
                                  <th>"Not in this warehouse"</th>
                                  <th>Opening Stock</th>
                                </tr>
                              </thead>
                              <tbody>
                                {warehouses.map(wh => {
                                  const key = `${wh.id}_${vId}`;
                                  // For a new entry row, state might be undefined, fallback exclude to false so they can submit stock. However, during edit if we fetched records and didn't find one, we implicitly excluded it.
                                  const ws = warehouseStock[key] || { exclude: !!editingMaterial, current_stock: 0 };
                                  return (
                                    <tr key={wh.id} style={{ opacity: ws.exclude ? 0.6 : 1 }}>
                                      <td>{wh.warehouse_name || wh.name || wh.warehouse_code}</td>
                                      <td>
                                        <input 
                                          type="checkbox" 
                                          checked={ws.exclude} 
                                          onChange={e => setWarehouseStock({...warehouseStock, [key]: { ...ws, exclude: e.target.checked }})}
                                        />
                                      </td>
                                      <td>
                                        <input 
                                          type="number" 
                                          className="form-input" 
                                          style={{ padding: '4px 8px', height: 'auto' }}
                                          value={ws.current_stock}
                                          onChange={e => setWarehouseStock({...warehouseStock, [key]: { ...ws, current_stock: parseFloat(e.target.value) || 0 }})}
                                          disabled={ws.exclude}
                                          step="0.01"
                                        />
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>

                            <div className="item-form-section">
                <div className="item-form-section-header">
                  <div>
                    <h4 className="item-form-section-title">Purchase & Vendor Mapping</h4>
                    <div className="item-form-section-hint">Map preferred vendors and base rates</div>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                  <button type="button" className="btn btn-sm btn-secondary" onClick={addVendorMappingRow}>+ Add Row</button>
                </div>
                {vendorMappings.length > 0 && (
                  <table className="table" style={{ fontSize: '12px', marginBottom: '16px' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '15%' }}>Variant</th>
                        <th style={{ width: '15%' }}>Make</th>
                        <th style={{ width: '20%' }}>Vendor</th>
                        <th style={{ width: '15%' }}>Base Rate</th>
                        <th style={{ width: '10%' }}>Discount %</th>
                        <th style={{ width: '10%', textAlign: 'center' }}>Preferred</th>
                        <th style={{ width: '15%' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vendorMappings.map((mapping) => (
                        <tr key={mapping.id}>
                          <td>
                            <select
                              className="form-select"
                              value={mapping.variant_id || ''}
                              onChange={(e) => handleVendorMappingChange(mapping.id, 'variant_id', e.target.value)}
                              style={{ padding: '4px 8px', height: '32px' }}
                            >
                              <option value="">No Category</option>
                              {Array.from(new Set(variantPricing.map(p => p.company_variant_id).filter(Boolean))).map(vId => {
                                const v = variants.find(v => v.id === vId);
                                if (!v) return null;
                                return <option key={v.id} value={v.id}>{v.variant_name}</option>;
                              })}
                            </select>
                          </td>
                          <td>
                            <input
                              type="text"
                              className="form-input"
                              value={mapping.make || ''}
                              onChange={(e) => handleVendorMappingChange(mapping.id, 'make', e.target.value)}
                              placeholder="e.g. Brand A"
                              style={{ padding: '4px 8px', height: '32px' }}
                            />
                          </td>
                          <td>
                            <select
                              className="form-select"
                              value={mapping.vendor_id}
                              onChange={(e) => handleVendorMappingChange(mapping.id, 'vendor_id', e.target.value)}
                              style={{ padding: '4px 8px', height: '32px' }}
                            >
                              <option value="">Select Vendor</option>
                              {vendors.map(v => (
                                <option key={v.id} value={v.id}>{v.company_name}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              type="number"
                              className="form-input"
                              value={mapping.base_rate}
                              onChange={(e) => handleVendorMappingChange(mapping.id, 'base_rate', e.target.value)}
                              placeholder="0.00"
                              step="0.01"
                              style={{ padding: '4px 8px', height: '32px' }}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="form-input"
                              value={mapping.discount_percent}
                              onChange={(e) => handleVendorMappingChange(mapping.id, 'discount_percent', e.target.value)}
                              placeholder="0"
                              step="0.1"
                              style={{ padding: '4px 8px', height: '32px' }}
                            />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={mapping.is_preferred}
                              onChange={(e) => handleVendorMappingChange(mapping.id, 'is_preferred', e.target.checked)}
                              style={{ cursor: 'pointer', width: '16px', height: '16px', margin: '0 auto', display: 'block' }}
                            />
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-sm btn-secondary"
                              onClick={() => removeVendorMappingRow(mapping.id)}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {vendorMappings.length === 0 && (
                  <div style={{ padding: '12px', textAlign: 'center', background: '#f9fafb', borderRadius: '8px', border: '1px dashed #d1d5db', color: '#6b7280', fontSize: '12px', marginBottom: '16px' }}>
                    No vendor mapping added. Click "+ Add Row" to set purchase rates for preferred vendors.
                  </div>
                )}
              </div>

<div className="item-form-section">
                <div className="item-form-section-header">
                  <div>
                    <h4 className="item-form-section-title">Client Mapping</h4>
                    <div className="item-form-section-hint">Map client codes & pricing</div>
                  </div>
                </div>
                {/* Sub-tabs */}
                <div style={{ display: 'flex', gap: '0', marginBottom: '16px', borderBottom: '2px solid #e5e7eb' }}>
                  <button
                    type="button"
                    onClick={() => setClientMappingTab('code')}
                    style={{
                      padding: '8px 20px',
                      fontSize: '13px',
                      fontWeight: clientMappingTab === 'code' ? 600 : 400,
                      color: clientMappingTab === 'code' ? '#2563eb' : '#6b7280',
                      background: clientMappingTab === 'code' ? '#fff' : 'transparent',
                      border: 'none',
                      borderBottom: clientMappingTab === 'code' ? '2px solid #2563eb' : '2px solid transparent',
                      cursor: 'pointer',
                      marginBottom: '-2px',
                    }}
                  >
                    Client Code
                  </button>
                  <button
                    type="button"
                    onClick={() => setClientMappingTab('pricing')}
                    style={{
                      padding: '8px 20px',
                      fontSize: '13px',
                      fontWeight: clientMappingTab === 'pricing' ? 600 : 400,
                      color: clientMappingTab === 'pricing' ? '#2563eb' : '#6b7280',
                      background: clientMappingTab === 'pricing' ? '#fff' : 'transparent',
                      border: 'none',
                      borderBottom: clientMappingTab === 'pricing' ? '2px solid #2563eb' : '2px solid transparent',
                      cursor: 'pointer',
                      marginBottom: '-2px',
                    }}
                  >
                    ARC/Pricing
                  </button>
                </div>

                {/* Client Code Tab */}
                {clientMappingTab === 'code' && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                      <button type="button" className="btn btn-sm btn-secondary" onClick={addClientMappingRow}>+ Add Row</button>
                    </div>
                    {clientMappings.length > 0 && (
                      <table className="table" style={{ fontSize: '12px' }}>
                        <thead>
                          <tr>
                            <th style={{ width: '20%' }}>Variant</th>
                            <th style={{ width: '20%' }}>Client</th>
                            <th style={{ width: '20%' }}>Client Part No</th>
                            <th style={{ width: '30%' }}>Client Description</th>
                            <th style={{ width: '10%' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {clientMappings.map((mapping) => (
                            <tr key={mapping.id}>
                              <td>
                                <select
                                  className="form-select"
                                  value={mapping.company_variant_id || ''}
                                  onChange={(e) => handleClientMappingChange(mapping.id, 'company_variant_id', e.target.value)}
                                  style={{ padding: '4px 8px', height: '32px' }}
                                >
                                  <option value="">No Category</option>
                                  {variants.filter(v => v.variant_name !== 'No Variant').map(v => (
                                    <option key={v.id} value={v.id}>{v.variant_name}</option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <select
                                  className="form-select"
                                  value={mapping.client_id}
                                  onChange={(e) => handleClientMappingChange(mapping.id, 'client_id', e.target.value)}
                                  style={{ padding: '4px 8px', height: '32px' }}
                                >
                                  <option value="">Select Client</option>
                                  {clients.map(c => (
                                    <option key={c.id} value={c.id}>{c.client_name}</option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <input
                                  type="text"
                                  className="form-input"
                                  value={mapping.client_part_no}
                                  onChange={(e) => handleClientMappingChange(mapping.id, 'client_part_no', e.target.value)}
                                  placeholder="e.g. PART-001"
                                  style={{ padding: '4px 8px', height: '32px' }}
                                />
                              </td>
                              <td>
                                <input
                                  type="text"
                                  className="form-input"
                                  value={mapping.client_description}
                                  onChange={(e) => handleClientMappingChange(mapping.id, 'client_description', e.target.value)}
                                  placeholder="e.g. Specialized Valve for XYZ"
                                  style={{ padding: '4px 8px', height: '32px' }}
                                />
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-secondary"
                                  onClick={() => removeClientMappingRow(mapping.id)}
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    {clientMappings.length === 0 && (
                      <div style={{ padding: '12px', textAlign: 'center', background: '#f9fafb', borderRadius: '8px', border: '1px dashed #d1d5db', color: '#6b7280', fontSize: '12px' }}>
                        No client codes added. Click "+ Add Row" to map this item to a client's part number.
                      </div>
                    )}
                  </>
                )}

                {/* ARC/Pricing Tab */}
                {clientMappingTab === 'pricing' && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px', gap: '8px' }}>
                      {editingMaterial && (
                        <button type="button" className="btn btn-sm btn-secondary" onClick={() => { loadPricingHistory(editingMaterial.id); setShowPricingHistory(!showPricingHistory); }} style={{ fontSize: '12px' }}>
                          {showPricingHistory ? 'Hide History' : 'Price History'}
                        </button>
                      )}
                      <button type="button" className="btn btn-sm btn-secondary" onClick={addClientPricingRow}>+ Add Row</button>
                    </div>
                    {clientPricing.length > 0 && (
                      <table className="table" style={{ fontSize: '12px' }}>
                        <thead>
                          <tr>
                            <th style={{ width: '15%' }}>Variant</th>
                            <th style={{ width: '15%' }}>Client</th>
                            <th style={{ width: '15%' }}>Pricing Type</th>
                            <th style={{ width: '10%' }}>Rate</th>
                            <th style={{ width: '13%' }}>Valid From</th>
                            <th style={{ width: '13%' }}>Valid To</th>
                            <th style={{ width: '11%' }}>Status</th>
                            <th style={{ width: '8%' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {clientPricing.map((row) => (
                            <tr key={row.id}>
                              <td>
                                <select
                                  className="form-select"
                                  value={row.company_variant_id || ''}
                                  onChange={(e) => handleClientPricingChange(row.id, 'company_variant_id', e.target.value)}
                                  style={{ padding: '4px 8px', height: '32px', fontSize: '12px' }}
                                >
                                  <option value="">No Category</option>
                                  {variants.filter(v => v.variant_name !== 'No Variant').map(v => (
                                    <option key={v.id} value={v.id}>{v.variant_name}</option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <select
                                  className="form-select"
                                  value={row.client_id || ''}
                                  onChange={(e) => handleClientPricingChange(row.id, 'client_id', e.target.value)}
                                  style={{ padding: '4px 8px', height: '32px', fontSize: '12px' }}
                                >
                                  <option value="">Select Client</option>
                                  {clients.map(c => (
                                    <option key={c.id} value={c.id}>{c.client_name}</option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <select
                                  className="form-select"
                                  value={row.pricing_type || 'Fixed ARC'}
                                  onChange={(e) => handleClientPricingChange(row.id, 'pricing_type', e.target.value)}
                                  style={{ padding: '4px 8px', height: '32px', fontSize: '12px' }}
                                >
                                  <option value="Fixed ARC">Fixed ARC</option>
                                  <option value="Variable ARC">Variable ARC</option>
                                  <option value="Discount">Discount</option>
                                  <option value="Special Price">Special Price</option>
                                  <option value="Lumpsum">Lumpsum</option>
                                </select>
                              </td>
                              <td>
                                <input
                                  type="number"
                                  className="form-input"
                                  value={row.rate ?? ''}
                                  onChange={(e) => handleClientPricingChange(row.id, 'rate', e.target.value)}
                                  placeholder="0.00"
                                  step="0.01"
                                  style={{ padding: '4px 8px', height: '32px', fontSize: '12px' }}
                                />
                              </td>
                              <td>
                                <input
                                  type="date"
                                  className="form-input"
                                  value={row.valid_from || ''}
                                  onChange={(e) => handleClientPricingChange(row.id, 'valid_from', e.target.value)}
                                  style={{ padding: '4px 8px', height: '32px', fontSize: '12px' }}
                                />
                              </td>
                              <td>
                                <input
                                  type="date"
                                  className="form-input"
                                  value={row.valid_to || ''}
                                  onChange={(e) => handleClientPricingChange(row.id, 'valid_to', e.target.value)}
                                  style={{ padding: '4px 8px', height: '32px', fontSize: '12px' }}
                                />
                              </td>
                              <td>
                                <select
                                  className="form-select"
                                  value={row.status || 'active'}
                                  onChange={(e) => handleClientPricingChange(row.id, 'status', e.target.value)}
                                  style={{ padding: '4px 8px', height: '32px', fontSize: '12px' }}
                                >
                                  <option value="active">Active</option>
                                  <option value="inactive">Inactive</option>
                                  <option value="expired">Expired</option>
                                </select>
                              </td>
                              <td>
                                <button type="button" className="btn btn-sm btn-secondary" onClick={() => removeClientPricingRow(row.id)} style={{ fontSize: '11px' }}>
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    {clientPricing.length === 0 && (
                      <div style={{ padding: '12px', textAlign: 'center', background: '#f9fafb', borderRadius: '8px', border: '1px dashed #d1d5db', color: '#6b7280', fontSize: '12px' }}>
                        No ARC/pricing entries. Click "+ Add Row" to set client-specific pricing.
                      </div>
                    )}
                    {/* Price History */}
                    {showPricingHistory && pricingHistory.length > 0 && (
                      <div style={{ marginTop: '16px' }}>
                        <h5 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#374151' }}>Price Change History</h5>
                        <table className="table" style={{ fontSize: '11px' }}>
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Type</th>
                              <th>Old Rate</th>
                              <th>New Rate</th>
                              <th>Valid From</th>
                              <th>Valid To</th>
                              <th>Status</th>
                              <th>Change</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pricingHistory.map((h) => {
                              const changeType = h.change_type || 'created';
                              const changeColor = changeType === 'created' ? '#22c55e' : changeType === 'updated' ? '#f59e0b' : '#ef4444';
                              return (
                                <tr key={h.id}>
                                  <td>{h.changed_at ? new Date(h.changed_at).toLocaleDateString() : '—'}</td>
                                  <td>{h.pricing_type || '—'}</td>
                                  <td>{h.old_rate != null ? `₹${Number(h.old_rate).toLocaleString()}` : '—'}</td>
                                  <td style={{ fontWeight: 600 }}>{h.new_rate != null ? `₹${Number(h.new_rate).toLocaleString()}` : '—'}</td>
                                  <td>{h.valid_from || '—'}</td>
                                  <td>{h.valid_to || '—'}</td>
                                  <td>{h.status || '—'}</td>
                                  <td><span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 600, color: changeColor, background: changeColor + '15' }}>{changeType.toUpperCase()}</span></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>

            </form>
            </div>
            <div style={{ position: 'sticky', bottom: 0, zIndex: 10, display: 'flex', gap: '12px', padding: '16px 24px', borderTop: '1px solid #e5e7eb', background: '#fff', boxShadow: '0 -2px 8px rgba(0,0,0,0.06)', flexShrink: 0 }}>
              <button type="button" className="btn btn-primary" style={{ flex: 1 }} disabled={materialSavePending} onClick={handleSubmit}>
                {materialSavePending ? 'Saving...' : (editingMaterial ? 'Update Item' : 'Save Item')}
              </button>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={resetForm} disabled={materialSavePending}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Item Modal */}
      {showMultiItemModal && (
        <div className="modal-overlay open" onClick={() => !isSavingSequentially && setShowMultiItemModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '95vw', width: '95vw', height: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header border-b">
              <div className="flex justify-between items-center w-full">
                <h3 className="text-lg font-bold">Bulk Item Addition</h3>
                <div className="flex gap-2">
                  <Button size="sm" onClick={addMultiItemRow}>+ Add Row</Button>
                  <button type="button" onClick={() => setShowMultiItemModal(false)} className="text-2xl">&times;</button>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-zinc-50">
              <table className="w-full border-collapse bg-white shadow-sm border border-zinc-200" style={{ tableLayout: 'fixed' }}>
                <thead className="bg-zinc-100 sticky top-0 z-20">
                  <tr>
                    <th className="px-1 py-2 border border-zinc-200 text-[10px] font-semibold text-zinc-600 w-[25px]">#</th>
                    <th className="px-1 py-2 border border-zinc-200 text-[10px] font-semibold text-zinc-600 w-[50px]">Cat</th>
                    <th className="px-3 py-2 border border-zinc-200 text-xs font-semibold text-zinc-600 w-[200px]">Item Name *</th>
                    <th className="px-3 py-2 border border-zinc-200 text-xs font-semibold text-zinc-600 w-[80px]">Unit *</th>
                    <th className="px-3 py-2 border border-zinc-200 text-xs font-semibold text-zinc-600 w-[40px]">V?</th>
                    <th className="px-3 py-2 border border-zinc-200 text-xs font-semibold text-zinc-600 w-[120px]">Variant Type</th>
                    <th className="px-3 py-2 border border-zinc-200 text-xs font-semibold text-zinc-600 w-[90px]">Sale Rate</th>
                    <th className="px-3 py-2 border border-zinc-200 text-xs font-semibold text-zinc-600 w-[90px]">Pur. Rate</th>
                    <th className="px-3 py-2 border border-zinc-200 text-xs font-semibold text-zinc-600 w-[60px]">GST %</th>
                    <th className="px-3 py-2 border border-zinc-200 text-xs font-semibold text-zinc-600 w-[100px]">HSN</th>
                    <th className="px-3 py-2 border border-zinc-200 text-xs font-semibold text-zinc-600 w-[80px]">Inventory</th>
                    <th className="px-3 py-2 border border-zinc-200 text-xs font-semibold text-zinc-600 w-[40px]">Del</th>
                  </tr>
                </thead>
                <tbody>
                  {multiItemRows.map((row, idx) => {
                    const prevRow = idx > 0 ? multiItemRows[idx - 1] : null;
                    const isDuplicateName = prevRow && 
                      prevRow.name.trim().toLowerCase() === row.name.trim().toLowerCase() &&
                      prevRow.category === row.category &&
                      prevRow.unit === row.unit;

                    return (
                      <tr key={row.id} className={isDuplicateName ? "bg-zinc-50/30" : ""}>
                        <td className="px-1 py-1 border border-zinc-200 text-center text-[10px] text-zinc-400">{idx + 1}</td>
                        <td className="px-0 py-1 border border-zinc-200 w-[50px]">
                          <select 
                            className={cn(
                              "w-[50px] h-8 text-[10px] border-none focus:ring-0 p-0 appearance-none bg-transparent text-center",
                              isDuplicateName && "opacity-20"
                            )}
                            value={row.category}
                            onChange={(e) => updateMultiItemRow(row.id, 'category', e.target.value)}
                          >
                            <option value="">-</option>
                            {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1 border border-zinc-200">
                          <input 
                            type="text" 
                            className={cn(
                              "w-full h-8 text-xs border-none focus:ring-0 font-medium",
                              isDuplicateName ? "text-zinc-300" : "text-zinc-900"
                            )}
                            value={row.name}
                            onChange={(e) => updateMultiItemRow(row.id, 'name', e.target.value)}
                            placeholder={isDuplicateName ? "(Same as above)" : "Enter item name..."}
                          />
                        </td>
                        <td className="px-2 py-1 border border-zinc-200">
                          <select 
                            className={cn(
                              "w-full h-8 text-xs border-none focus:ring-0",
                              isDuplicateName && "opacity-20"
                            )}
                            value={row.unit}
                            onChange={(e) => updateMultiItemRow(row.id, 'unit', e.target.value)}
                          >
                            {units.map(u => <option key={u.unit_code} value={u.unit_code}>{u.unit_code}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1 border border-zinc-200 text-center">
                          <input 
                            type="checkbox" 
                            checked={row.uses_variant}
                            onChange={(e) => updateMultiItemRow(row.id, 'uses_variant', e.target.checked)}
                          />
                        </td>
                        <td className="px-2 py-1 border border-zinc-200">
                          {row.uses_variant && (
                            <select 
                              className="w-full h-8 text-xs border-none focus:ring-0 bg-blue-50/30"
                              value={row.variant_id}
                              onChange={(e) => updateMultiItemRow(row.id, 'variant_id', e.target.value)}
                            >
                              <option value="">Select Variant</option>
                              {variants.map(v => <option key={v.id} value={v.id}>{v.variant_name}</option>)}
                            </select>
                          )}
                        </td>
                        <td className="px-2 py-1 border border-zinc-200">
                          <input 
                            type="number" 
                            className={cn("w-full h-8 text-xs border-none focus:ring-0 text-right", row.uses_variant && "bg-blue-50/30")}
                            value={row.sale_price}
                            onChange={(e) => updateMultiItemRow(row.id, 'sale_price', e.target.value)}
                            placeholder="0.00"
                          />
                        </td>
                        <td className="px-2 py-1 border border-zinc-200">
                          <input 
                            type="number" 
                            className={cn("w-full h-8 text-xs border-none focus:ring-0 text-right", row.uses_variant && "bg-blue-50/30")}
                            value={row.purchase_price}
                            onChange={(e) => updateMultiItemRow(row.id, 'purchase_price', e.target.value)}
                            placeholder="0.00"
                          />
                        </td>
                        <td className="px-2 py-1 border border-zinc-200">
                          <select 
                            className="w-full h-8 text-xs border-none focus:ring-0"
                            value={row.gst_rate}
                            onChange={(e) => updateMultiItemRow(row.id, 'gst_rate', parseFloat(e.target.value))}
                          >
                            {GST_RATES.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1 border border-zinc-200">
                          <input 
                            type="text" 
                            className="w-full h-8 text-xs border-none focus:ring-0"
                            value={row.hsn_code}
                            onChange={(e) => updateMultiItemRow(row.id, 'hsn_code', e.target.value)}
                            placeholder="HSN..."
                          />
                        </td>
                        <td className="px-2 py-1 border border-zinc-200">
                          <input 
                            type="number" 
                            className="w-full h-8 text-xs border-none focus:ring-0 text-center font-semibold"
                            value={row.inventory}
                            onChange={(e) => updateMultiItemRow(row.id, 'inventory', e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-1 border border-zinc-200 text-center">
                          <div className="flex items-center gap-1 justify-center">
                            <button onClick={() => addMultiItemRow(row)} className="text-blue-500 hover:text-blue-700" title="Add Variant (Clone)">
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => removeMultiItemRow(row.id)} className="text-zinc-400 hover:text-red-600" title="Remove Row">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="mt-4">
                <Button variant="ghost" size="sm" onClick={addMultiItemRow} className="text-indigo-600 hover:bg-indigo-50">
                  + Add Another Row
                </Button>
              </div>
            </div>
            {/* Sticky Footer */}
            <div className="p-4 border-t bg-white flex justify-end gap-3 sticky bottom-0 z-30">
              <Button variant="outline" onClick={() => setShowMultiItemModal(false)}>Cancel</Button>
              <Button onClick={() => setShowReviewModal(true)} disabled={multiItemRows.length === 0}>
                Review & Save ({multiItemRows.length})
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {showReviewModal && (
        <div className="modal-overlay open" style={{ zIndex: 9000 }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <h3 className="text-lg font-bold mb-2">Review Items</h3>
            <p className="text-sm text-zinc-600 mb-4">You are about to save {multiItemRows.length} items. Please verify the details before proceeding.</p>
            <div className="max-h-[300px] overflow-auto border border-zinc-200 rounded-lg mb-6">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-zinc-50 border-b">
                  <tr>
                    <th className="px-3 py-2">Item Name</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {multiItemRows.map(r => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="px-3 py-2 font-medium">{r.name || '(Empty Name)'}</td>
                      <td className="px-3 py-2">{r.category || '-'}</td>
                      <td className="px-3 py-2 text-right">{r.inventory}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowReviewModal(false)}>Back to Edit</Button>
              <Button onClick={handleSequentialSave} className="bg-indigo-600 text-white">
                Proceed to Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Excel Edit Mode - Field Selector Dialog */}
      {showFieldSelector && (
        <div className="modal-overlay open" onClick={() => setShowFieldSelector(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '900px', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0 }}>Select Fields to Edit</h2>
              <button onClick={() => setShowFieldSelector(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>×</button>
            </div>
            <FieldSelector 
              warehouses={warehouses}
              selectedFields={selectedEditFields}
              onChange={setSelectedEditFields}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
              <button className="btn btn-secondary" onClick={() => setShowFieldSelector(false)}>Cancel</button>
              <button 
                className="btn btn-primary" 
                onClick={() => {
                  setShowFieldSelector(false);
                  setExcelEditMode(true);
                }}
                disabled={selectedEditFields.length === 0}
              >
                Start Excel Edit Mode
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Excel Editor Mode */}
      {excelEditMode && (
        <div className="modal-overlay open" style={{ alignItems: 'flex-start', paddingTop: '20px' }}>
          <div 
            className="modal-content" 
            onClick={e => e.stopPropagation()} 
            style={{ 
              maxWidth: '98vw', 
              width: '98vw', 
              maxHeight: '95vh', 
              height: '95vh',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <ExcelEditor
              materials={materials}
              warehouses={warehouses}
              selectedFields={selectedEditFields}
              variants={variants}
              units={units}
              onSave={async (changes, newItems, deletedItems) => {
                const nowIso = new Date().toISOString();

                // Handle new items first
                for (const newItem of newItems || []) {
                  if (!newItem.name || !newItem.main_category || !newItem.unit || !newItem.gst_rate) {
                    alert(`Skipping new item with missing required fields. Name: ${newItem.name || 'missing'}, Category: ${newItem.main_category || 'missing'}, Unit: ${newItem.unit || 'missing'}, GST Rate: ${newItem.gst_rate || 'missing'}`);
                    continue;
                  }

                  const { data: createdItem, error: createError } = await supabase
                    .from('materials')
                    .insert({
                      item_code: newItem.item_code,
                      name: newItem.name,
                      display_name: newItem.display_name || newItem.name,
                      main_category: newItem.main_category,
                      sub_category: newItem.sub_category || null,
                      size: newItem.size || null,
                      size_lwh: newItem.size_lwh || null,
                      pressure_class: newItem.pressure_class || null,
                      make: newItem.make || null,
                      material: newItem.material || null,
                      end_connection: newItem.end_connection || null,
                      unit: newItem.unit,
                      sale_price: newItem.sale_price ? parseFloat(newItem.sale_price) : null,
                      purchase_price: newItem.purchase_price ? parseFloat(newItem.purchase_price) : null,
                      hsn_code: newItem.hsn_code || null,
                      gst_rate: newItem.gst_rate ? parseFloat(newItem.gst_rate) : null,
                      part_number: newItem.part_number || null,
                      taxable: newItem.taxable !== undefined ? newItem.taxable : true,
                      weight: newItem.weight ? parseFloat(newItem.weight) : null,
                      upc: newItem.upc || null,
                      mpn: newItem.mpn || null,
                      ean: newItem.ean || null,
                      inventory_account: newItem.inventory_account || null,
                      is_active: newItem.is_active !== undefined ? newItem.is_active : true,
                      uses_variant: newItem.uses_variant !== undefined ? newItem.uses_variant : false,
                      low_stock_level: newItem.low_stock_level ? parseFloat(newItem.low_stock_level) : null,
                      organisation_id: organisationId,
                      created_at: nowIso,
                      updated_at: nowIso,
                    })
                    .select('id')
                    .single();

                  if (createError) {
                    alert(`Failed to create item ${newItem.item_code}: ${createError.message}`);
                    continue;
                  }

                  // Handle stock for new items
                  for (const wh of warehouses) {
                    const stockKey = `stock_${wh.id}`;
                    const stockValue = newItem[stockKey];
                    if (stockValue && parseFloat(stockValue) > 0) {
                      await supabase.from('item_stock').insert({
                        item_id: createdItem.id,
                        warehouse_id: wh.id,
                        current_stock: parseFloat(stockValue),
                        organisation_id: organisationId,
                        created_at: nowIso,
                        updated_at: nowIso,
                      });
                    }
                  }

                  await supabase.from('item_audit_logs').insert({
                    item_id: createdItem.id,
                    action: 'EXCEL_CREATE',
                    notes: `Item created via Excel Edit Mode`,
                    changes: JSON.stringify({ created: true }),
                    created_at: nowIso,
                  });
                }

                // Handle existing item changes
                for (const change of changes) {
                  const fieldMapping = {
                    'Sale Price': 'sale_price',
                    'Purchase Price': 'purchase_price',
                    'Display Name': 'display_name',
                    'Category': 'main_category',
                    'Sub Category': 'sub_category',
                    'Size': 'size',
                    'L×W×H': 'size_lwh',
                    'Pressure': 'pressure_class',
                    'Make': 'make',
                    'Material': 'material',
                    'Connection': 'end_connection',
                    'Unit': 'unit',
                    'HSN': 'hsn_code',
                    'GST%': 'gst_rate',
                    'Part #': 'part_number',
                    'Taxable': 'taxable',
                    'Weight': 'weight',
                    'UPC': 'upc',
                    'MPN': 'mpn',
                    'EAN': 'ean',
                    'Inv Account': 'inventory_account',
                    'Active': 'is_active',
                    'Uses Discount Category': 'uses_variant',
                    'Low Stock': 'low_stock_level',
                  };

                  // Check if this is a variant row (itemId contains '_variant_')
                  const isVariantRow = change.itemId.includes('_variant_');
                  const baseItemId = isVariantRow ? change.itemId.split('_variant_')[0] : change.itemId;
                  const variantId = isVariantRow ? change.itemId.split('_variant_')[1] : null;

                  if (change.field.startsWith('Stock:')) {
                    const whName = change.field.replace('Stock: ', '');
                    const warehouse = warehouses.find(w => (w.warehouse_name || w.name) === whName);
                    if (warehouse) {
                      const { data: existingStock } = await supabase
                        .from('item_stock')
                        .select('id')
                        .eq('item_id', baseItemId)
                        .eq('warehouse_id', warehouse.id)
                        .maybeSingle();

                      if (existingStock) {
                        await supabase.from('item_stock').update({ current_stock: change.newValue, updated_at: nowIso }).eq('id', existingStock.id);
                      } else {
                        await supabase.from('item_stock').insert({ item_id: baseItemId, warehouse_id: warehouse.id, current_stock: change.newValue, organisation_id: organisationId, created_at: nowIso, updated_at: nowIso });
                      }
                    }
                  } else if (isVariantRow && (change.field === 'Sale Price' || change.field === 'Purchase Price')) {
                    // Update variant pricing table
                    const dbField = fieldMapping[change.field];
                    if (dbField && variantId) {
                      const { data: existingVariantPricing } = await supabase
                        .from('item_variant_pricing')
                        .select('id')
                        .eq('item_id', baseItemId)
                        .eq('company_variant_id', variantId)
                        .maybeSingle();

                      if (existingVariantPricing) {
                        await supabase.from('item_variant_pricing').update({ [dbField]: change.newValue, updated_at: nowIso }).eq('id', existingVariantPricing.id);
                      } else {
                        await supabase.from('item_variant_pricing').insert({
                          item_id: baseItemId,
                          company_variant_id: variantId,
                          [dbField]: change.newValue,
                          created_at: nowIso,
                          updated_at: nowIso,
                        });
                      }
                    }
                  } else {
                    // Update materials table (base item fields)
                    const dbField = fieldMapping[change.field];
                    if (dbField) {
                      await supabase.from('materials').update({ [dbField]: change.newValue, updated_at: nowIso }).eq('id', baseItemId);
                    }
                  }

                  await supabase.from('item_audit_logs').insert({
                    item_id: baseItemId,
                    action: isVariantRow ? 'VARIANT_EXCEL_UPDATE' : 'BULK_EXCEL_UPDATE',
                    notes: `Field "${change.field}" changed from "${change.oldValue}" to "${change.newValue}" via Excel Edit Mode${isVariantRow ? ` (Variant: ${variantId})` : ''}`,
                    changes: JSON.stringify([{ field: change.field, old_value: change.oldValue, new_value: change.newValue, variant_id: variantId }]),
                    created_at: nowIso,
                  });
                }

                // Handle deleted items
                for (const deletedItemId of deletedItems || []) {
                  const baseItemId = deletedItemId.includes('_variant_') ? deletedItemId.split('_variant_')[0] : deletedItemId;

                  // Check if item is used in any past transactions
                  const { data: invoiceItems } = await supabase
                    .from('invoice_items')
                    .select('id')
                    .eq('material_id', baseItemId)
                    .limit(1);

                  const { data: quotationItems } = await supabase
                    .from('quotation_items')
                    .select('id')
                    .eq('material_id', baseItemId)
                    .limit(1);

                  const { data: proformaItems } = await supabase
                    .from('proforma_items')
                    .select('id')
                    .eq('material_id', baseItemId)
                    .limit(1);

                  const { data: dcItems } = await supabase
                    .from('dc_items')
                    .select('id')
                    .eq('material_id', baseItemId)
                    .limit(1);

                  const { data: bomItems } = await supabase
                    .from('bom_items')
                    .select('id')
                    .eq('material_id', baseItemId)
                    .limit(1);

                  const hasTransactions = (invoiceItems?.length || 0) > 0 ||
                    (quotationItems?.length || 0) > 0 ||
                    (proformaItems?.length || 0) > 0 ||
                    (dcItems?.length || 0) > 0 ||
                    (bomItems?.length || 0) > 0;

                  if (hasTransactions) {
                    // Mark as inactive instead of deleting
                    await supabase.from('materials').update({
                      is_active: false,
                      updated_at: nowIso,
                    }).eq('id', baseItemId);

                    await supabase.from('item_audit_logs').insert({
                      item_id: baseItemId,
                      action: 'MARK_INACTIVE',
                      notes: `Item marked as inactive via Excel Edit Mode due to existing transactions`,
                      changes: JSON.stringify({ is_active: false, reason: 'has_transactions' }),
                      created_at: nowIso,
                    });
                  } else {
                    // Safe to delete
                    await supabase.from('materials').delete().eq('id', baseItemId);

                    await supabase.from('item_audit_logs').insert({
                      item_id: baseItemId,
                      action: 'DELETE',
                      notes: `Item deleted via Excel Edit Mode`,
                      changes: JSON.stringify({ deleted: true }),
                      created_at: nowIso,
                    });
                  }
                }

                await queryClient.invalidateQueries({ queryKey: ['materials'] });
              }}
              onCancel={() => setExcelEditMode(false)}
            />
          </div>
        </div>
      )}

      {/* Excel Import Field Selector */}
      {showExcelImportFieldSelector && (
        <div className="modal-overlay open" onClick={() => setShowExcelImportFieldSelector(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '900px', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0 }}>Select Fields for Import Template</h2>
              <button onClick={() => setShowExcelImportFieldSelector(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>×</button>
            </div>
            <div className="bg-blue-50 text-blue-700 p-3 rounded-md mb-2">
              Select the fields you want to edit. Only selected fields will be included in the download template and editable during upload.
            </div>
            <FieldSelector 
              warehouses={warehouses}
              selectedFields={excelImportFields}
              onChange={setExcelImportFields}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
              <Button variant="outline" onClick={() => setShowExcelImportFieldSelector(false)}>Cancel</Button>
              <Button 
                onClick={() => {
                  generateSelectiveTemplate(excelImportFields);
                  setShowExcelImportFieldSelector(false);
                }}
                disabled={excelImportFields.length === 0}
              >
                Download Template
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}

// NOTE: Named export consumed by features/materials/service/ServiceTab.tsx re-export stub
export function ServiceTab() {
  const { data: allMaterials = [], isLoading: loading } = useMaterials();
  const services = useMemo(() => allMaterials.filter(m => m.item_type === 'service'), [allMaterials]);
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSubTab, setActiveSubTab] = useState('items');

  const [formData, setFormData] = useState({
    service_code: '', service_name: '', description: '', unit: 'nos',
    sale_price: '', purchase_price: '', hsn_code: '', tax_rate: 18, is_active: true
  });

  const generateServiceCode = () => 'SVC-' + Date.now().toString(36).toUpperCase();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = {
      item_code: formData.service_code || generateServiceCode(),
      name: formData.service_name,
      display_name: formData.service_name,
      description: formData.description || null,
      unit: formData.unit,
      sale_price: formData.sale_price ? parseFloat(formData.sale_price) : null,
      purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : null,
      hsn_code: formData.hsn_code || null,
      gst_rate: formData.tax_rate ? parseFloat(formData.tax_rate) : null,
      is_active: formData.is_active,
      item_type: 'service',
      uses_variant: false
    };
    try {
      if (editingService) {
        const { error } = await supabase.from('materials').update({ ...data, updated_at: new Date().toISOString() }).eq('id', editingService.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('materials').insert(data);
        if (error) throw error;
      }
      resetForm();
    } catch (err) {
      alert('Error saving service: ' + err.message);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingService(null);
    setFormData({ service_code: '', service_name: '', description: '', unit: 'nos', sale_price: '', purchase_price: '', hsn_code: '', tax_rate: 18, is_active: true });
  };

  const editService = (service) => {
    setEditingService(service);
    setFormData({
      service_code: service.item_code || '',
      service_name: service.name || '',
      description: service.description || '',
      unit: service.unit || 'nos',
      sale_price: service.sale_price || '',
      purchase_price: service.purchase_price || '',
      hsn_code: service.hsn_code || '',
      tax_rate: service.gst_rate || 18,
      is_active: service.is_active !== false
    });
    setShowForm(true);
  };

  const deleteService = async (id) => {
    if (confirm('Delete this service?')) {
      await supabase.from('materials').delete().eq('id', id);
    }
  };

  const filteredServices = services.filter(s => s.name?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Services</h1>
      </div>

      {/* Sub-tab Navigation */}
      <div className="bg-white border border-gray-200 p-1 flex flex-wrap gap-[20px] shadow-sm mb-6">
        <button
          className={cn(
            "tab-button px-4 text-sm font-medium border-b-2 transition-colors",
            activeSubTab === 'items'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'
          )}
          onClick={() => setActiveSubTab('items')}
        >
          Service Items
        </button>
        <button
          className={cn(
            "tab-button px-4 text-sm font-medium border-b-2 transition-colors",
            activeSubTab === 'rates'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'
          )}
          onClick={() => setActiveSubTab('rates')}
        >
          Service Rates (Erection)
        </button>
      </div>

      {activeSubTab === 'items' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <input type="text" className="form-input" placeholder="Search services..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ maxWidth: '300px' }} />
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add Service</button>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 sticky top-0 z-10">
                  <tr>
                    <th className="h-10 pl-4 pr-3 text-left align-middle text-xs font-medium text-zinc-500">Service Code</th>
                    <th className="h-10 px-3 text-left align-middle text-xs font-medium text-zinc-500">Service Name</th>
                    <th className="h-10 px-3 text-left align-middle text-xs font-medium text-zinc-500">Unit</th>
                    <th className="h-10 px-3 text-right align-middle text-xs font-medium text-zinc-500">Sale Price</th>
                    <th className="h-10 px-3 text-left align-middle text-xs font-medium text-zinc-500">HSN/SAC</th>
                    <th className="h-10 px-3 text-center align-middle text-xs font-medium text-zinc-500">Active</th>
                    <th className="h-10 pl-3 pr-3 text-right align-middle text-xs font-medium text-zinc-500 min-w-[100px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                  {filteredServices.map(s => (
                    <tr key={s.id} className="border-b border-zinc-200 hover:bg-zinc-50/80" style={{ opacity: s.is_active === false ? 0.5 : 1 }}>
                      <td className="pl-3 py-3 align-middle whitespace-nowrap text-xs font-medium text-zinc-600">{s.item_code || '-'}</td>
                      <td className="px-3 py-3 align-middle whitespace-nowrap text-xs font-semibold text-zinc-700">{s.name}</td>
                      <td className="px-3 py-3 align-middle whitespace-nowrap text-xs font-medium text-zinc-600">{s.unit}</td>
                      <td className="pr-3 py-3 text-right align-middle text-xs font-medium text-zinc-600">₹{s.sale_price || '-'}</td>
                      <td className="px-3 py-3 align-middle whitespace-nowrap text-xs font-medium text-zinc-600">{s.hsn_code || '-'}</td>
                      <td className="px-3 py-3 text-center align-middle">
                        {s.is_active ? (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">Active</span>
                        ) : (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-zinc-100 text-zinc-500">Inactive</span>
                        )}
                      </td>
                      <td className="pr-3 py-3 text-right align-middle">
                        <div className="flex items-center justify-end gap-[15px]">
                          <button className="btn btn-sm btn-secondary" onClick={() => editService(s)}>Edit</button>
                          <button className="btn btn-sm btn-secondary" onClick={() => deleteService(s.id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {showForm && (
            <div className="modal-overlay open" onClick={resetForm}>
              <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h2>{editingService ? 'Edit Service' : 'Add Service'}</h2>
                  <button onClick={resetForm} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>×</button>
                </div>
                <form onSubmit={handleSubmit}>
                  <div className="form-row">
                    <div className="form-group"><label className="form-label">Service Name *</label><input type="text" className="form-input" value={formData.service_name} onChange={e => setFormData({...formData, service_name: e.target.value})} required /></div>
                    <div className="form-group"><label className="form-label">Service Code</label><input type="text" className="form-input" value={formData.service_code} onChange={e => setFormData({...formData, service_code: e.target.value})} /></div>
                  </div>
                  <div className="form-row">
                    <div className="form-group"><label className="form-label">Unit</label><input type="text" className="form-input" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} /></div>
                    <div className="form-group"><label className="form-label">HSN/SAC</label><input type="text" className="form-input" value={formData.hsn_code} onChange={e => setFormData({...formData, hsn_code: e.target.value})} /></div>
                  </div>
                  <div className="form-row">
                    <div className="form-group"><label className="form-label">Sale Price</label><input type="number" className="form-input" value={formData.sale_price} onChange={e => setFormData({...formData, sale_price: e.target.value})} step="0.01" /></div>
                    <div className="form-group"><label className="form-label">Purchase Price</label><input type="number" className="form-input" value={formData.purchase_price} onChange={e => setFormData({...formData, purchase_price: e.target.value})} step="0.01" /></div>
                  </div>
                  <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
                  <div className="form-group"><label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} /> Active</label></div>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}><button type="submit" className="btn btn-primary">{editingService ? 'Update' : 'Save'}</button><button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel</button></div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'rates' && <ServiceRatesTab />}
    </div>
  );
}

// NOTE: Named export consumed by features/materials/service/ServiceRatesTab.tsx re-export stub
export function ServiceRatesTab() {
  const [serviceRates, setServiceRates] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRate, setEditingRate] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [materialSearch, setMaterialSearch] = useState('');
  const [showMaterialDropdown, setShowMaterialDropdown] = useState(false);

  const [formData, setFormData] = useState({
    item_name: '',
    default_erection_rate: '',
    unit: 'Mtrs',
    gst_rate: 18,
    sac_code: '',
    is_active: true
  });

  const UNIT_OPTIONS = ['Mtrs', 'Nos', 'Kgs', 'Sqft', 'Cum', 'Ltr', 'Pcs'];
  const GST_OPTIONS = [0, 5, 12, 18, 28];

  useEffect(() => {
    loadServiceRates();
    loadMaterials();
  }, []);

  const loadServiceRates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('service_rates')
        .select('*')
        .order('item_name');
      if (error) throw error;
      setServiceRates(data || []);
    } catch (err) {
      console.error('Error loading service rates:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMaterials = async () => {
    try {
      const { data, error } = await supabase
        .from('materials')
        .select('id, name, hsn_code, gst_rate, unit')
        .order('name')
        .limit(100);
      if (error) throw error;
      setMaterials(data || []);
    } catch (err) {
      console.error('Error loading materials:', err);
    }
  };

  const filteredMaterials = materials.filter(m =>
    m.name?.toLowerCase().includes(materialSearch.toLowerCase())
  );

  const handleMaterialSelect = (material) => {
    setFormData(prev => ({
      ...prev,
      item_name: material.name,
      unit: material.unit || 'Mtrs',
      gst_rate: material.gst_rate || 18,
      sac_code: material.hsn_code || ''
    }));
    setShowMaterialDropdown(false);
    setMaterialSearch('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = {
      item_name: formData.item_name.trim(),
      default_erection_rate: parseFloat(formData.default_erection_rate) || 0,
      unit: formData.unit,
      gst_rate: parseFloat(formData.gst_rate) || 18,
      sac_code: formData.sac_code || null,
      is_active: formData.is_active
    };
    try {
      if (editingRate) {
        const { error } = await supabase
          .from('service_rates')
          .update({ ...data, updated_at: new Date().toISOString() })
          .eq('id', editingRate.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('service_rates')
          .insert(data);
        if (error) throw error;
      }
      resetForm();
      loadServiceRates();
    } catch (err) {
      alert('Error saving service rate: ' + err.message);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingRate(null);
    setFormData({ item_name: '', default_erection_rate: '', unit: 'Mtrs', gst_rate: 18, sac_code: '', is_active: true });
    setMaterialSearch('');
    setShowMaterialDropdown(false);
  };

  const editRate = (rate) => {
    setEditingRate(rate);
    setFormData({
      item_name: rate.item_name || '',
      default_erection_rate: rate.default_erection_rate || '',
      unit: rate.unit || 'Mtrs',
      gst_rate: rate.gst_rate || 18,
      sac_code: rate.sac_code || '',
      is_active: rate.is_active !== false
    });
    setShowForm(true);
  };

  const deleteRate = async (id) => {
    if (confirm('Delete this service rate?')) {
      try {
        const { error } = await supabase.from('service_rates').delete().eq('id', id);
        if (error) throw error;
        loadServiceRates();
      } catch (err) {
        alert('Error deleting service rate: ' + err.message);
      }
    }
  };

  const filteredRates = serviceRates.filter(r =>
    r.item_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div>Loading service rates...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <input
          type="text"
          className="form-input"
          placeholder="Search by material name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ maxWidth: '300px' }}
        />
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + Add Service Rate
        </button>
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 sticky top-0 z-10">
              <tr>
                <th className="h-10 pl-4 pr-3 text-left align-middle text-xs font-medium text-zinc-500">
                  Material Name
                </th>
                <th className="h-10 px-3 text-right align-middle text-xs font-medium text-zinc-500">
                  Erection Rate
                </th>
                <th className="h-10 px-3 text-left align-middle text-xs font-medium text-zinc-500">
                  Unit
                </th>
                <th className="h-10 px-3 text-right align-middle text-xs font-medium text-zinc-500">
                  GST %
                </th>
                <th className="h-10 px-3 text-left align-middle text-xs font-medium text-zinc-500">
                  SAC Code
                </th>
                <th className="h-10 px-3 text-center align-middle text-xs font-medium text-zinc-500">
                  Active
                </th>
                <th className="h-10 pl-3 pr-3 text-right align-middle text-xs font-medium text-zinc-500 min-w-[100px]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {filteredRates.map(r => (
                <tr
                  key={r.id}
                  className="border-b border-zinc-200 hover:bg-zinc-50/80"
                  style={{ opacity: r.is_active === false ? 0.5 : 1 }}
                >
                  <td className="pl-3 py-3 align-middle whitespace-nowrap text-xs font-semibold text-zinc-700">
                    {r.item_name}
                  </td>
                  <td className="px-3 py-3 text-right align-middle text-xs font-medium text-zinc-600">
                    ₹{r.default_erection_rate?.toFixed(2) || '-'}
                  </td>
                  <td className="px-3 py-3 align-middle whitespace-nowrap text-xs font-medium text-zinc-600">
                    {r.unit}
                  </td>
                  <td className="px-3 py-3 text-right align-middle text-xs font-medium text-zinc-600">
                    {r.gst_rate || 18}%
                  </td>
                  <td className="px-3 py-3 align-middle whitespace-nowrap text-xs font-medium text-zinc-600">
                    {r.sac_code || '-'}
                  </td>
                  <td className="px-3 py-3 text-center align-middle">
                    {r.is_active ? (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-zinc-100 text-zinc-500">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="pr-3 py-3 text-right align-middle">
                    <div className="flex items-center justify-end gap-[15px]">
                      <button className="btn btn-sm btn-secondary" onClick={() => editRate(r)}>
                        Edit
                      </button>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => deleteRate(r.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
        }} onClick={resetForm}>
          <div style={{
            background: '#fff',
            borderRadius: '8px',
            width: '90%',
            maxWidth: '500px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid #e5e5e5',
            }}>
              <h3 style={{
                fontSize: '16px',
                fontWeight: 600,
                color: '#171717',
                margin: 0,
              }}>
                {editingRate ? 'Edit Service Rate' : 'Add Service Rate'}
              </h3>
              <button
                type="button"
                onClick={resetForm}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px',
                  border: 'none',
                  background: 'transparent',
                  color: '#525252',
                  cursor: 'pointer',
                  borderRadius: '4px',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#525252',
                  }}>
                    Select from Materials
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      value={materialSearch}
                      onChange={e => {
                        setMaterialSearch(e.target.value);
                        setShowMaterialDropdown(true);
                      }}
                      onFocus={() => setShowMaterialDropdown(true)}
                      placeholder="Search material or type manually..."
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #d4d4d4',
                        borderRadius: '4px',
                        fontSize: '14px',
                        color: '#171717',
                        width: '100%',
                      }}
                    />
                    {showMaterialDropdown && filteredMaterials.length > 0 && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        background: '#fff',
                        border: '1px solid #d4d4d4',
                        borderRadius: '4px',
                        marginTop: '4px',
                        maxHeight: '200px',
                        overflowY: 'auto',
                        zIndex: 10,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      }}>
                        {filteredMaterials.map(m => (
                          <div
                            key={m.id}
                            onClick={() => handleMaterialSelect(m)}
                            style={{
                              padding: '8px 12px',
                              cursor: 'pointer',
                              fontSize: '13px',
                              color: '#171717',
                              borderBottom: '1px solid #f5f5f5',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                            onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                          >
                            <div style={{ fontWeight: 500 }}>{m.name}</div>
                            <div style={{ fontSize: '11px', color: '#737373' }}>
                              Unit: {m.unit || 'N/A'} | GST: {m.gst_rate || 0}%
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#525252',
                  }}>
                    Material Name *
                  </label>
                  <input
                    type="text"
                    value={formData.item_name}
                    onChange={e => setFormData({ ...formData, item_name: e.target.value })}
                    placeholder="e.g., 100NB Pipe, Gate Valve"
                    required
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #d4d4d4',
                      borderRadius: '4px',
                      fontSize: '14px',
                      color: '#171717',
                    }}
                  />
                  <p style={{ fontSize: '11px', color: '#737373', marginTop: '2px' }}>
                    Must match material name exactly for auto-linking
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#525252',
                    }}>
                      Erection Rate *
                    </label>
                    <input
                      type="number"
                      value={formData.default_erection_rate}
                      onChange={e => setFormData({ ...formData, default_erection_rate: e.target.value })}
                      step="0.01"
                      required
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #d4d4d4',
                        borderRadius: '4px',
                        fontSize: '14px',
                        color: '#171717',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#525252',
                    }}>
                      Unit *
                    </label>
                    <select
                      value={formData.unit}
                      onChange={e => setFormData({ ...formData, unit: e.target.value })}
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #d4d4d4',
                        borderRadius: '4px',
                        fontSize: '14px',
                        color: '#171717',
                      }}
                    >
                      {UNIT_OPTIONS.map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#525252',
                    }}>
                      GST % *
                    </label>
                    <select
                      value={formData.gst_rate}
                      onChange={e => setFormData({ ...formData, gst_rate: parseFloat(e.target.value) })}
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #d4d4d4',
                        borderRadius: '4px',
                        fontSize: '14px',
                        color: '#171717',
                      }}
                    >
                      {GST_OPTIONS.map(g => (
                        <option key={g} value={g}>{g}%</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#525252',
                  }}>
                    SAC Code
                  </label>
                  <input
                    type="text"
                    value={formData.sac_code}
                    onChange={e => setFormData({ ...formData, sac_code: e.target.value })}
                    placeholder="e.g., 9954, 9988"
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #d4d4d4',
                      borderRadius: '4px',
                      fontSize: '14px',
                      color: '#171717',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                    style={{
                      width: '16px',
                      height: '16px',
                      cursor: 'pointer',
                    }}
                  />
                  <label htmlFor="is_active" style={{
                    fontSize: '13px',
                    color: '#525252',
                    cursor: 'pointer',
                  }}>
                    Active (auto-create erection charges)
                  </label>
                </div>
              </div>

              <div style={{
                display: 'flex',
                gap: '12px',
                marginTop: '24px',
                paddingTop: '16px',
                borderTop: '1px solid #e5e5e5',
              }}>
                <button
                  type="button"
                  onClick={resetForm}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    border: '1px solid #d4d4d4',
                    borderRadius: '4px',
                    background: '#fff',
                    color: '#525252',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    border: 'none',
                    borderRadius: '4px',
                    background: '#171717',
                    color: '#fff',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#262626'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#171717'}
                >
                  {editingRate ? 'Update' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryTab() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({ category_name: '', description: '', is_active: true });

  useEffect(() => { loadCategories(); }, []);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('item_categories').select('*').order('category_name');
      setCategories(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCategory) {
        const { error } = await supabase.from('item_categories').update(formData).eq('id', editingCategory.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('item_categories').insert(formData);
        if (error) throw error;
      }
      resetForm();
      loadCategories();
    } catch (err) {
      alert('Error saving category: ' + err.message);
    }
  };

  const resetForm = () => { setShowForm(false); setEditingCategory(null); setFormData({ category_name: '', description: '', is_active: true }); };

  const editCategory = (cat) => { setEditingCategory(cat); setFormData({ category_name: cat.category_name, description: cat.description || '', is_active: cat.is_active !== false }); setShowForm(true); };
  const deleteCategory = async (id) => { if (confirm('Delete this category?')) { await supabase.from('item_categories').delete().eq('id', id); loadCategories(); }};

  const filteredCategories = categories.filter(c => c.category_name?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Categories</h1><button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add Category</button></div>
      <div className="card" style={{ marginBottom: '16px' }}><input type="text" className="form-input" placeholder="Search categories..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ maxWidth: '300px' }} /></div>
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 sticky top-0 z-10">
              <tr>
                <th className="h-10 pl-4 pr-3 text-left align-middle text-xs font-semibold text-zinc-500">Category Name</th>
                <th className="h-10 px-3 text-left align-middle text-xs font-semibold text-zinc-500">Description</th>
                <th className="h-10 px-3 text-center align-middle text-xs font-semibold text-zinc-500">Active</th>
                <th className="h-10 pl-3 pr-3 text-right align-middle text-xs font-semibold text-zinc-500 min-w-[100px]">Actions</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {filteredCategories.map(c => (
                <tr key={c.id} className="border-b border-zinc-200 hover:bg-zinc-50 transition-colors" style={{ opacity: c.is_active === false ? 0.5 : 1 }}>
                  <td className="pl-4 py-3 align-middle whitespace-nowrap text-sm font-semibold text-zinc-700">{c.category_name}</td>
                  <td className="px-3 py-3 align-middle whitespace-nowrap text-sm font-medium text-zinc-600">{c.description || '-'}</td>
                  <td className="px-3 py-3 text-center align-middle">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${c.is_active ? 'bg-green-50 text-green-700' : 'bg-zinc-100 text-zinc-600'}`}>
                      {c.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="pr-3 py-3 text-right align-middle">
                    <div className="flex items-center justify-end gap-[15px]">
                      <Button size="sm" variant="outline" onClick={() => editCategory(c)} className="text-xs">Edit</Button>
                      <Button size="sm" variant="outline" onClick={() => deleteCategory(c.id)} className="text-xs">Delete</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {showForm && (
        <div className="modal-overlay open" onClick={resetForm}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}><h2>{editingCategory ? 'Edit Category' : 'Add Category'}</h2><button onClick={resetForm} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>×</button></div>
            <form onSubmit={handleSubmit}>
              <div className="form-group"><label className="form-label">Category Name *</label><input type="text" className="form-input" value={formData.category_name} onChange={e => setFormData({...formData, category_name: e.target.value})} required /></div>
              <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
              <div className="form-group"><label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} /> Active</label></div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}><button type="submit" className="btn btn-primary">{editingCategory ? 'Update' : 'Save'}</button><button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function UnitTab() {
  const { data: units = [], isLoading: loading } = useUnits();
  const { organisation } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingUnit, setEditingUnit] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({ unit_name: '', unit_code: '', description: '', is_active: true });

  const saveMutation = useMutation({
    mutationFn: async (dataToSave: any) => {
      if (editingUnit) {
        const { error } = await supabase.from('item_units').update(dataToSave).eq('id', editingUnit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('item_units').insert(dataToSave);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units', organisation?.id] });
      resetForm();
    },
    onError: (err: any) => {
      alert('Error saving unit: ' + err.message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('item_units').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units', organisation?.id] });
    },
    onError: (err: any) => {
      alert('Error deleting unit: ' + err.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dataToSave = { ...formData, organisation_id: organisation?.id };
    saveMutation.mutate(dataToSave);
  };

  const resetForm = () => { setShowForm(false); setEditingUnit(null); setFormData({ unit_name: '', unit_code: '', description: '', is_active: true }); };

  const editUnit = (unit: any) => { setEditingUnit(unit); setFormData({ unit_name: unit.unit_name, unit_code: unit.unit_code, description: unit.description || '', is_active: unit.is_active !== false }); setShowForm(true); };
  const deleteUnit = (id: string) => { if (confirm('Delete this unit?')) { deleteMutation.mutate(id); }};

  const filteredUnits = units.filter((u: any) => u.unit_name?.toLowerCase().includes(searchTerm.toLowerCase()) || u.unit_code?.toLowerCase().includes(searchTerm.toLowerCase()));

  // Render helpers for DESIGN.md Pattern
  const headerFieldStyle = { display: 'flex', alignItems: 'center', gap: '8px' };
  const labelColStyle = { minWidth: '80px', maxWidth: '80px', fontWeight: 600, fontSize: '11px', color: '#374151' };
  const fieldColStyle = { flex: 1 };
  
  const renderHeaderField = (label: string, field: React.ReactNode, isLast = false) => (
    <div style={{ ...headerFieldStyle, marginBottom: isLast ? 0 : '8px' }}>
      <span style={labelColStyle}>{label}</span>
      <div style={fieldColStyle}>{field}</div>
    </div>
  );

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Units</h1><Button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add Unit</Button></div>
      <div className="card" style={{ marginBottom: '16px' }}><Input type="text" className="form-input" placeholder="Search units..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ maxWidth: '300px' }} /></div>
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 sticky top-0 z-10">
              <tr>
                <th className="h-10 pl-4 pr-3 text-left align-middle text-xs font-semibold text-zinc-500">Unit Name</th>
                <th className="h-10 px-3 text-left align-middle text-xs font-semibold text-zinc-500">Unit</th>
                <th className="h-10 px-3 text-left align-middle text-xs font-semibold text-zinc-500">Description</th>
                <th className="h-10 px-3 text-center align-middle text-xs font-semibold text-zinc-500">Active</th>
                <th className="h-10 pl-3 pr-3 text-right align-middle text-xs font-semibold text-zinc-500 min-w-[100px]">Actions</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {filteredUnits.map((u: any) => (
                <tr key={u.id} className="border-b border-zinc-200 hover:bg-zinc-50 transition-colors" style={{ opacity: u.is_active === false ? 0.5 : 1 }}>
                  <td className="pl-4 py-3 align-middle whitespace-nowrap text-sm font-semibold text-zinc-700">{u.unit_name}</td>
                  <td className="px-3 py-3 align-middle whitespace-nowrap text-sm font-medium text-zinc-600">{u.unit_code}</td>
                  <td className="px-3 py-3 align-middle whitespace-nowrap text-sm font-medium text-zinc-600">{u.description || '-'}</td>
                  <td className="px-3 py-3 text-center align-middle">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${u.is_active ? 'bg-green-50 text-green-700' : 'bg-zinc-100 text-zinc-600'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="pr-3 py-3 text-right align-middle">
                    <div className="flex items-center justify-end gap-[15px]">
                      <Button size="sm" variant="outline" onClick={() => editUnit(u)} className="text-xs">Edit</Button>
                      <Button size="sm" variant="outline" onClick={() => deleteUnit(u.id)} className="text-xs">Delete</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Modal 
        isOpen={showForm} 
        onClose={resetForm} 
        title={editingUnit ? 'Edit Unit' : 'Add Unit'} 
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={resetForm} style={{ padding: '7px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 500 }}>Cancel</Button>
            <Button variant="primary" onClick={handleSubmit} disabled={saveMutation.isPending} style={{ padding: '7px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, background: '#185FA5', border: '1px solid #185FA5', color: '#fff' }}>{editingUnit ? 'Update' : 'Save'}</Button>
          </>
        }
      >
        <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '6px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {renderHeaderField('Unit Name *', <Input value={formData.unit_name} onChange={e => setFormData({...formData, unit_name: e.target.value})} required style={{ padding: '4px 8px', fontSize: '12px' }} />)}
            {renderHeaderField('Unit *', <Input value={formData.unit_code} onChange={e => setFormData({...formData, unit_code: e.target.value})} required style={{ padding: '4px 8px', fontSize: '12px' }} />)}
            {renderHeaderField('Description', <Input value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} style={{ padding: '4px 8px', fontSize: '12px' }} />)}
            {renderHeaderField('Status', <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}><Checkbox checked={formData.is_active} onCheckedChange={(checked: boolean) => setFormData({...formData, is_active: checked})} /> Active</label>, true)}
          </div>
        </div>
      </Modal>
    </div>
  );
}

function WarehousesTab() {
  const { data: warehouses = [], isLoading: loading } = useWarehouses();
  const [showForm, setShowForm] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({ warehouse_code: '', warehouse_name: '', location: '', is_default: false, is_active: true });

  const generateWarehouseCode = () => 'WH-' + Date.now().toString(36).toUpperCase();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = {
      warehouse_code: formData.warehouse_code || generateWarehouseCode(),
      warehouse_name: formData.warehouse_name,
      location: formData.location || null,
      is_default: formData.is_default,
      is_active: formData.is_active,
    };
    
    if (formData.is_default) {
      await supabase.from('warehouses').update({ is_default: false }).eq('is_default', true);
    }
    
    if (editingWarehouse) {
      await supabase.from('warehouses').update({ ...data, updated_at: new Date().toISOString() }).eq('id', editingWarehouse.id);
    } else {
      await supabase.from('warehouses').insert(data);
    }
    resetForm();
  };

  const resetForm = () => { setShowForm(false); setEditingWarehouse(null); setFormData({ warehouse_code: '', warehouse_name: '', location: '', is_default: false, is_active: true }); };

  const editWarehouse = (w) => { setEditingWarehouse(w); setFormData({ warehouse_code: w.warehouse_code || '', warehouse_name: w.warehouse_name, location: w.location || '', is_default: w.is_default || false, is_active: w.is_active !== false }); setShowForm(true); };
  const deleteWarehouse = async (id) => { if (confirm('Delete this warehouse?')) { await supabase.from('warehouses').delete().eq('id', id); }};

  const filteredWarehouses = warehouses.filter(w => w.warehouse_name?.toLowerCase().includes(searchTerm.toLowerCase()) || w.warehouse_code?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Warehouses</h1><button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add Warehouse</button></div>
      <div className="card" style={{ marginBottom: '16px' }}><input type="text" className="form-input" placeholder="Search warehouses..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ maxWidth: '300px' }} /></div>
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 sticky top-0 z-10">
              <tr>
                <th className="h-10 pl-4 pr-3 text-left align-middle text-xs font-semibold text-zinc-500">Warehouse Code</th>
                <th className="h-10 px-3 text-left align-middle text-xs font-semibold text-zinc-500">Warehouse Name</th>
                <th className="h-10 px-3 text-left align-middle text-xs font-semibold text-zinc-500">Location</th>
                <th className="h-10 px-3 text-center align-middle text-xs font-semibold text-zinc-500">Default</th>
                <th className="h-10 px-3 text-center align-middle text-xs font-semibold text-zinc-500">Active</th>
                <th className="h-10 pl-3 pr-3 text-right align-middle text-xs font-semibold text-zinc-500 min-w-[100px]">Actions</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {filteredWarehouses.map(w => (
                <tr key={w.id} className="border-b border-zinc-200 hover:bg-zinc-50 transition-colors" style={{ opacity: w.is_active === false ? 0.5 : 1 }}>
                  <td className="pl-4 py-3 align-middle whitespace-nowrap text-sm font-medium text-zinc-600">{w.warehouse_code}</td>
                  <td className="px-3 py-3 align-middle whitespace-nowrap text-sm font-semibold text-zinc-700">{w.warehouse_name || w.name}</td>
                  <td className="px-3 py-3 align-middle whitespace-nowrap text-sm font-medium text-zinc-600">{w.location || '-'}</td>
                  <td className="px-3 py-3 text-center align-middle">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${w.is_default ? 'bg-blue-50 text-blue-700' : 'bg-zinc-100 text-zinc-400'}`}>
                      {w.is_default ? 'Default' : '-'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center align-middle">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${w.is_active ? 'bg-green-50 text-green-700' : 'bg-zinc-100 text-zinc-600'}`}>
                      {w.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="pr-3 py-3 text-right align-middle">
                    <div className="flex items-center justify-end gap-[15px]">
                      <Button size="sm" variant="outline" onClick={() => editWarehouse(w)} className="text-xs">Edit</Button>
                      <Button size="sm" variant="outline" onClick={() => deleteWarehouse(w.id)} className="text-xs">Delete</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {showForm && (
        <div className="modal-overlay open" onClick={resetForm}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}><h2>{editingWarehouse ? 'Edit Warehouse' : 'Add Warehouse'}</h2><button onClick={resetForm} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>×</button></div>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Warehouse Name *</label><input type="text" className="form-input" value={formData.warehouse_name} onChange={e => setFormData({...formData, warehouse_name: e.target.value})} required /></div>
                <div className="form-group"><label className="form-label">Warehouse Code</label><input type="text" className="form-input" value={formData.warehouse_code} onChange={e => setFormData({...formData, warehouse_code: e.target.value})} placeholder="Auto-generated if empty" /></div>
              </div>
              <div className="form-group"><label className="form-label">Location</label><input type="text" className="form-input" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} /></div>
              <div className="form-group"><label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={formData.is_default} onChange={e => setFormData({...formData, is_default: e.target.checked})} /> Set as Default Warehouse</label></div>
              <div className="form-group"><label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} /> Active</label></div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}><button type="submit" className="btn btn-primary">{editingWarehouse ? 'Update' : 'Save'}</button><button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function VariantsTab() {
  const { data: variants = [], isLoading: loading } = useVariants();
  const [showForm, setShowForm] = useState(false);
  const [editingVariant, setEditingVariant] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({ variant_name: '', is_active: true });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingVariant) {
      await supabase.from('company_variants').update({ ...formData, updated_at: new Date().toISOString() }).eq('id', editingVariant.id);
    } else {
      await supabase.from('company_variants').insert(formData);
    }
    resetForm();
  };

  const resetForm = () => { setShowForm(false); setEditingVariant(null); setFormData({ variant_name: '', is_active: true }); };

  const editVariant = (v) => { setEditingVariant(v); setFormData({ variant_name: v.variant_name, is_active: v.is_active !== false }); setShowForm(true); };
  const deleteVariant = async (id) => { if (confirm('Delete this category? This may affect existing pricing.')) { await supabase.from('company_variants').delete().eq('id', id); }};

  const filteredVariants = variants.filter(v => v.variant_name?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Discount Categories</h1><button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add Category</button></div>
      <div className="card" style={{ marginBottom: '16px' }}>
        <p style={{ color: '#666', marginBottom: '10px' }}>Discount Categories group your items for tiered pricing (e.g., Pipe, Hardware, Electrical). Each item can have different sale/purchase prices per category, and quotations can apply category-specific discounts.</p>
        <input type="text" className="form-input" placeholder="Search categories..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ maxWidth: '300px' }} />
      </div>
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 sticky top-0 z-10">
              <tr>
                <th className="h-10 pl-4 pr-3 text-left align-middle text-xs font-semibold text-zinc-500">Category Name</th>
                <th className="h-10 px-3 text-center align-middle text-xs font-semibold text-zinc-500">Active</th>
                <th className="h-10 px-3 text-left align-middle text-xs font-semibold text-zinc-500">Created</th>
                <th className="h-10 pl-3 pr-3 text-right align-middle text-xs font-semibold text-zinc-500 min-w-[100px]">Actions</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {filteredVariants.map(v => (
                <tr key={v.id} className="border-b border-zinc-200 hover:bg-zinc-50 transition-colors" style={{ opacity: v.is_active === false ? 0.5 : 1 }}>
                  <td className="pl-4 py-3 align-middle whitespace-nowrap text-sm font-semibold text-zinc-700">{v.variant_name}</td>
                  <td className="px-3 py-3 text-center align-middle">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${v.is_active ? 'bg-green-50 text-green-700' : 'bg-zinc-100 text-zinc-600'}`}>
                      {v.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-3 py-3 align-middle whitespace-nowrap text-sm font-medium text-zinc-600">{v.created_at ? new Date(v.created_at).toLocaleDateString() : '-'}</td>
                  <td className="pr-3 py-3 text-right align-middle">
                    <div className="flex items-center justify-end gap-[15px]">
                      <Button size="sm" variant="outline" onClick={() => editVariant(v)} className="text-xs">Edit</Button>
                      <Button size="sm" variant="outline" onClick={() => deleteVariant(v.id)} className="text-xs">Delete</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {showForm && (
        <div className="modal-overlay open" onClick={resetForm}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}><h2>{editingVariant ? 'Edit Category' : 'Add Category'}</h2><button onClick={resetForm} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>×</button></div>
            <form onSubmit={handleSubmit}>
              <div className="form-group"><label className="form-label">Category Name *</label><input type="text" className="form-input" value={formData.variant_name} onChange={e => setFormData({...formData, variant_name: e.target.value})} placeholder="e.g., Retail, Wholesale, Export" required /></div>
              <div className="form-group"><label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} /> Active</label></div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}><button type="submit" className="btn btn-primary">{editingVariant ? 'Update' : 'Save'}</button><button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function DiscountCategoriesTab() {
  const { organisation } = useAuth();
  const queryClient = useQueryClient();
  const { data: discountCategories = [], isLoading } = useQuery({
    queryKey: ['discountCategories', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase.from('discount_categories').select('*').or(`organisation_id.eq.${organisation.id},organisation_id.is.null`).order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id,
  });
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({ name: '', default_discount_percent: 0, min_discount_percent: 0, max_discount_percent: 100, is_active: true });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editing) {
      await supabase.from('discount_categories').update({ ...formData, updated_at: new Date().toISOString() }).eq('id', editing.id);
    } else {
      await supabase.from('discount_categories').insert({ ...formData, organisation_id: organisation?.id });
    }
    resetForm();
    queryClient.invalidateQueries({ queryKey: ['discountCategories'] });
  };

  const resetForm = () => { setShowForm(false); setEditing(null); setFormData({ name: '', default_discount_percent: 0, min_discount_percent: 0, max_discount_percent: 100, is_active: true }); };

  const editItem = (item) => { setEditing(item); setFormData({ name: item.name, default_discount_percent: item.default_discount_percent ?? 0, min_discount_percent: item.min_discount_percent ?? 0, max_discount_percent: item.max_discount_percent ?? 100, is_active: item.is_active !== false }); setShowForm(true); };
  const deleteItem = async (id) => { if (confirm('Delete this discount category?')) { await supabase.from('discount_categories').delete().eq('id', id); queryClient.invalidateQueries({ queryKey: ['discountCategories'] }); }};

  const filtered = discountCategories.filter(c => c.name?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Discount Categories</h1><button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add Discount Category</button></div>
      <div className="card" style={{ marginBottom: '16px' }}>
        <p style={{ color: '#666', marginBottom: '10px' }}>Discount categories group items for bulk discounting in quotations. Each category has configurable min/max discount limits.</p>
        <input type="text" className="form-input" placeholder="Search discount categories..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ maxWidth: '300px' }} />
      </div>
      <div className="bg-white border border-zinc-200 rounded-xl" style={{ padding: '24px' }}>
        <div className="overflow-x-auto">
          <table className="w-full" style={{ fontSize: '12px' }}>
            <thead>
              <tr>
                <th style={{ padding: '12px 24px', textAlign: 'left', fontWeight: 600, fontSize: '11px', color: '#6b7280' }}>Name</th>
                <th style={{ padding: '12px 24px', textAlign: 'center', fontWeight: 600, fontSize: '11px', color: '#6b7280' }}>Default Disc %</th>
                <th style={{ padding: '12px 24px', textAlign: 'center', fontWeight: 600, fontSize: '11px', color: '#6b7280' }}>Min Disc %</th>
                <th style={{ padding: '12px 24px', textAlign: 'center', fontWeight: 600, fontSize: '11px', color: '#6b7280' }}>Max Disc %</th>
                <th style={{ padding: '12px 24px', textAlign: 'center', fontWeight: 600, fontSize: '11px', color: '#6b7280' }}>Active</th>
                <th style={{ padding: '12px 24px', textAlign: 'right', fontWeight: 600, fontSize: '11px', color: '#6b7280', minWidth: '100px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b border-zinc-200 hover:bg-zinc-50 transition-colors" style={{ opacity: c.is_active === false ? 0.5 : 1 }}>
                  <td style={{ padding: '12px 24px', textAlign: 'left', fontWeight: 600, fontSize: '12px', color: '#374151', whiteSpace: 'nowrap' }}>{c.name}</td>
                  <td style={{ padding: '12px 24px', textAlign: 'center', fontWeight: 500, fontSize: '12px', color: '#6b7280' }}>{c.default_discount_percent ?? '-'}%</td>
                  <td style={{ padding: '12px 24px', textAlign: 'center', fontWeight: 500, fontSize: '12px', color: '#6b7280' }}>{c.min_discount_percent ?? '-'}%</td>
                  <td style={{ padding: '12px 24px', textAlign: 'center', fontWeight: 500, fontSize: '12px', color: '#6b7280' }}>{c.max_discount_percent ?? '-'}%</td>
                  <td style={{ padding: '12px 24px', textAlign: 'center' }}>
                    <span style={{ padding: '4px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600, background: c.is_active ? '#f0fdf4' : '#f4f4f5', color: c.is_active ? '#166534' : '#52525b' }}>
                      {c.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 24px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '15px' }}>
                      <Button size="sm" variant="outline" onClick={() => editItem(c)} style={{ fontSize: '11px' }}>Edit</Button>
                      <Button size="sm" variant="outline" onClick={() => deleteItem(c.id)} style={{ fontSize: '11px' }}>Delete</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {showForm && (
        <div className="modal-overlay open" onClick={resetForm}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}><h2>{editing ? 'Edit Discount Category' : 'Add Discount Category'}</h2><button onClick={resetForm} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>×</button></div>
            <form onSubmit={handleSubmit}>
              <div className="form-group"><label className="form-label">Name *</label><input type="text" className="form-input" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g., Pipe Discount, Hardware Discount" required /></div>
              <div className="form-group"><label className="form-label">Default Discount %</label><input type="number" className="form-input" value={formData.default_discount_percent} onChange={e => setFormData({...formData, default_discount_percent: parseFloat(e.target.value) || 0})} step="0.01" min="0" max="100" /></div>
              <div className="form-group"><label className="form-label">Min Discount %</label><input type="number" className="form-input" value={formData.min_discount_percent} onChange={e => setFormData({...formData, min_discount_percent: parseFloat(e.target.value) || 0})} step="0.01" min="0" max="100" /></div>
              <div className="form-group"><label className="form-label">Max Discount %</label><input type="number" className="form-input" value={formData.max_discount_percent} onChange={e => setFormData({...formData, max_discount_percent: parseFloat(e.target.value) || 0})} step="0.01" min="0" max="100" /></div>
              <div className="form-group"><label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} /> Active</label></div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}><button type="submit" className="btn btn-primary">{editing ? 'Update' : 'Save'}</button><button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function to generate template with selected fields
function generateSelectiveTemplate(selectedFields: string[]) {
  const columns = [
    { key: 'item_code', label: 'Item Code / SKU' },
    { key: 'name', label: 'Item Name' },
    ...selectedFields.map(field => {
      if (field.startsWith('stock_')) {
        return { key: field, label: field };
      }
      const colDef = [
        { key: 'display_name', label: 'Display Name' },
        { key: 'main_category', label: 'Main Category' },
        { key: 'sub_category', label: 'Sub Category' },
        { key: 'size', label: 'Size' },
        { key: 'size_lwh', label: 'Size (L x W x H)' },
        { key: 'pressure_class', label: 'Pressure Class' },
        { key: 'make', label: 'Make/Brand' },
        { key: 'material', label: 'Material' },
        { key: 'end_connection', label: 'End Connection' },
        { key: 'unit', label: 'Unit' },
        { key: 'sale_price', label: 'Sale Price' },
        { key: 'purchase_price', label: 'Purchase Price' },
        { key: 'hsn_code', label: 'HSN/SAC Code' },
        { key: 'gst_rate', label: 'GST Rate (%)' },
        { key: 'part_number', label: 'Part Number' },
        { key: 'taxable', label: 'Taxable Status' },
        { key: 'weight', label: 'Weight' },
        { key: 'upc', label: 'UPC' },
        { key: 'mpn', label: 'MPN' },
        { key: 'ean', label: 'EAN' },
        { key: 'inventory_account', label: 'Inventory Account' },
        { key: 'is_active', label: 'Is Active' },
        { key: 'low_stock_level', label: 'Low Stock Level' },
      ].find(c => c.key === field);
      return colDef || { key: field, label: field };
    }),
  ].filter(Boolean);
  
  const headers = columns.map(c => c.label);
  const sampleRow = columns.map(c => {
    switch (c.key) {
      case 'item_code': return 'ITEM-001';
      case 'name': return 'Sample Item';
      case 'display_name': return 'Sample Display Name';
      case 'main_category': return 'VALVE';
      case 'sale_price': return '1250.00';
      case 'purchase_price': return '980.00';
      case 'gst_rate': return '18';
      case 'is_active': return 'true';
      default: return '';
    }
  });
  
  const content = [headers.join('\t'), sampleRow.join('\t')].join('\n');
  const blob = new Blob([content], { type: 'text/tab-separated-values' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'selective_item_template.txt';
  a.click();
  URL.revokeObjectURL(url);
}

export default function MaterialsList() {
  const location = useLocation();
  const navigate = useNavigate();
  const locationSearch = location.search;
  const activeTab = useMemo(() => getMaterialsTabFromSearch(locationSearch), [locationSearch]);

  const changeTab = (tab) => {
    navigate(`/store/materials?tab=${tab}`);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 p-1 flex flex-wrap gap-[20px] shadow-sm">
        <TabButton active={activeTab === 'items'} onClick={() => changeTab('items')}>Items</TabButton>
        <TabButton active={activeTab === 'service'} onClick={() => changeTab('service')}>Service</TabButton>
        <TabButton active={activeTab === 'category'} onClick={() => changeTab('category')}>Category</TabButton>
        <TabButton active={activeTab === 'unit'} onClick={() => changeTab('unit')}>Unit</TabButton>
        <TabButton active={activeTab === 'warehouses'} onClick={() => changeTab('warehouses')}>Warehouses</TabButton>
        <TabButton active={activeTab === 'variants'} onClick={() => changeTab('variants')}>Variants</TabButton>
        <TabButton active={activeTab === 'discount-categories'} onClick={() => changeTab('discount-categories')}>Discount Categories</TabButton>
      </div>

      {activeTab === 'items' && <ItemsTab />}
      {activeTab === 'service' && <ServiceTab />}
      {activeTab === 'category' && <CategoryTab />}
      {activeTab === 'unit' && <UnitTab />}
      {activeTab === 'warehouses' && <WarehousesTab />}
      {activeTab === 'variants' && <VariantsTab />}
      {activeTab === 'discount-categories' && <DiscountCategoriesTab />}
    </div>
  );
}

