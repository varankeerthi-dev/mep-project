import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { formatDate, formatCurrency } from '../utils/formatters';

const MAIN_CATEGORIES = ['VALVE', 'PIPE', 'FITTING', 'FLANGE', 'ELECTRICAL', 'PLUMBING', 'HVAC', 'FIRE PROTECTION', 'BUILDING MATERIALS', 'TOOLS', 'SAFETY', 'OFFICE', 'OTHER'];

const GST_RATES = [
  { value: 0, label: '0%' },
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
  { key: 'name', label: 'Name', default: true, locked: true },
  { key: 'code', label: 'Code', default: true, locked: true },
  { key: 'category', label: 'Category', default: true, locked: true },
  { key: 'sub_category', label: 'Sub Category', default: false },
  { key: 'size', label: 'Size', default: false },
  { key: 'pressure_class', label: 'Pressure Class', default: false },
  { key: 'make', label: 'MAKE(Brand name)', default: false },
  { key: 'material', label: 'Material', default: false },
  { key: 'end_connection', label: 'End Connection', default: false },
  { key: 'unit', label: 'Unit', default: true, locked: true },
  { key: 'sale_price', label: 'Sale Price', default: false },
  { key: 'purchase_price', label: 'Purchase Price', default: false },
  { key: 'hsn_code', label: 'HSN/SAC', default: false },
  { key: 'gst_rate', label: 'GST Rate', default: false },
  { key: 'uses_variant', label: 'Uses Variant', default: false },
  { key: 'stock', label: 'Stock', default: true },
  { key: 'status', label: 'Status', default: true },
];

const MANDATORY_ITEM_COLUMNS = ['name', 'code', 'category', 'unit'];

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
    ['item_code', 'Item Code'],
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
    ['uses_variant', 'Uses Variant'],
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

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 20px',
        border: 'none',
        borderBottom: active ? '2px solid #3498db' : '2px solid transparent',
        background: 'none',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: active ? 'bold' : 'normal',
        color: active ? '#3498db' : '#666',
      }}
    >
      {children}
    </button>
  );
}

function ItemsTab() {
  const [materials, setMaterials] = useState([]);
  const [stockData, setStockData] = useState({});
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [variants, setVariants] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [showBulkPriceModal, setShowBulkPriceModal] = useState(false);
  const [showItemWorkspace, setShowItemWorkspace] = useState(false);
  const [workspaceSearch, setWorkspaceSearch] = useState('');
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [hideInactive, setHideInactive] = useState(false);
  const [saveNotice, setSaveNotice] = useState('');
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
    unit: 'nos', sale_price: '', purchase_price: '', hsn_code: '', gst_rate: 18, is_active: true,
    uses_variant: false
  });

  const [variantPricing, setVariantPricing] = useState([]);

  const formatCurrencyOrDash = (value) => {
    if (value === null || value === undefined || value === '' || value === 0) return '-';
    return formatCurrency(value);
  };

  useEffect(() => {
  const safeLoad = async () => {
    try {
      await Promise.all([
        loadMaterials(),
        loadCategories(),
        loadUnits(),
        loadVariants()
      ]);
    } catch (err) {
      console.error("Initial load error:", err);
    }
  };

  safeLoad();
}, []);

  useEffect(() => {
    localStorage.setItem('itemsTableColumns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  useEffect(() => {
    if (!saveNotice) return undefined;
    const timer = window.setTimeout(() => setSaveNotice(''), 4000);
    return () => window.clearTimeout(timer);
  }, [saveNotice]);

  const loadMaterials = async () => {
    try {
      const { data, error } = await supabase
        .from('materials')
        .select('*')
        .eq('item_type', 'product')
        .order('name');

      if (error) throw error;
      setMaterials(data || []);
      
      // Load stock from item_stock table
      try {
        const { data: stock } = await supabase.from('item_stock').select('*');
        const stockMap = {};
        stock?.forEach(s => {
          if (!stockMap[s.item_id]) stockMap[s.item_id] = 0;
          stockMap[s.item_id] += parseFloat(s.current_stock) || 0;
        });
        setStockData(stockMap);
      } catch {
        console.log('item_stock table not found');
      }
    } catch (error) {
      console.log('materials table error', error);
    }
  };

  const loadCategories = async () => {
    try {
      const { data } = await supabase.from('item_categories').select('*').eq('is_active', true).order('category_name');
      setCategories(data || []);
    } catch {
      console.log('item_categories table not found, using defaults');
      setCategories([]);
    }
  };

  const loadUnits = async () => {
    try {
      const { data } = await supabase.from('item_units').select('*').eq('is_active', true).order('unit_name');
      setUnits(data || []);
    } catch {
      console.log('item_units table not found, using defaults');
      setUnits([{ unit_code: 'nos', unit_name: 'Numbers' }]);
    }
  };

  const loadVariants = async () => {
    try {
      const { data } = await supabase.from('company_variants').select('*').eq('is_active', true).order('variant_name');
      setVariants(data || []);
    } catch {
      console.log('company_variants table not found');
      setVariants([]);
    }
  };

  const loadVariantPricing = async (itemId) => {
    if (!itemId) return;
    try {
      const { data } = await supabase.from('item_variant_pricing').select('*').eq('item_id', itemId);
      setVariantPricing(data || []);
    } catch (error) {
      console.log('item_variant_pricing error', error);
      setVariantPricing([]);
    }
  };

  const checkVariantRecords = async (itemId) => {
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
  };

  const toggleColumn = (columnKey) => {
    if (MANDATORY_ITEM_COLUMNS.includes(columnKey)) return;
    setVisibleColumns((prev) => {
      if (prev.includes(columnKey)) {
        const next = prev.filter((col) => col !== columnKey);
        return next.length > 0 ? [...new Set([...MANDATORY_ITEM_COLUMNS, ...next])] : prev;
      }
      return [...new Set([...prev, columnKey, ...MANDATORY_ITEM_COLUMNS])];
    });
  };

  const openBulkPriceModal = () => {
    setShowBulkPriceModal(true);
    setBulkPriceText('');
    setBulkPreviewRows([]);
    setBulkParseErrors([]);
    setBulkApplyErrors([]);
  };

  const closeBulkPriceModal = () => {
    if (bulkInProgress) return;
    setShowBulkPriceModal(false);
  };

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
        errors.push(`Row ${rowNo}: requires at least 2 columns (Item Code/Name + Sale Price).`);
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

    await loadMaterials();
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
      const { data, error } = await queryBuilder;
      if (error) throw error;
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
    e.preventDefault();
    
    if (formData.uses_variant && Object.keys(variantPricing).length === 0) {
      alert('Please add at least one variant pricing before saving.');
      return;
    }

    if (formData.hsn_code && !/^\d{1,10}$/.test(formData.hsn_code)) {
      alert('HSN/SAC must be numeric and up to 10 digits.');
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
      item_type: 'product'
    };

    try {
      const isEditing = !!editingMaterial;
      const originalMaterial = editingMaterial;
      const nowIso = new Date().toISOString();
      let itemId;

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
      }

      if (formData.uses_variant) {
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

      setSaveNotice(isEditing ? 'Item updated successfully.' : 'Item added successfully.');
      setSelectedMaterialId(itemId);
      setActiveDetailTab(isEditing ? 'audit' : 'overview');
      await loadMaterials();
      if (selectedMaterialId === itemId) {
        await loadItemTransactions(itemId);
      }
      resetForm();
    } catch (err) {
      alert('Error saving: ' + err.message);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingMaterial(null);
    setFormData({
      item_code: '', item_name: '', display_name: '', main_category: '', sub_category: '',
      size: '', pressure_class: '', make: '', material: '', end_connection: '',
      unit: 'nos', sale_price: '', purchase_price: '', hsn_code: '', gst_rate: 18, is_active: true,
      uses_variant: false
    });
    setVariantPricing({});
  };

  const editMaterial = async (material) => {
    setEditingMaterial(material);
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
      sale_price: material.sale_price || '',
      purchase_price: material.purchase_price || '',
      hsn_code: material.hsn_code || '',
      gst_rate: material.gst_rate || 18,
      is_active: material.is_active !== false,
      uses_variant: material.uses_variant || false
    });
    setShowForm(true);
    loadVariantPricing(material.id);
  };

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
    setFormData({ ...formData, uses_variant: checked, sale_price: checked ? '0' : formData.sale_price });
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

  const deleteMaterial = async (id) => {
    setDeleteInProgress(true);
    try {
      const checks = await Promise.allSettled([
        supabase.from('quotation_items').select('id').eq('item_id', id).limit(1),
        supabase.from('delivery_challan_items').select('id').eq('material_id', id).limit(1),
        supabase.from('material_inward_items').select('id').eq('material_id', id).limit(1),
        supabase.from('quick_check_items').select('id').eq('item_id', id).limit(1),
      ]);

      const hasLinkedRecords = checks.some((r) => r.status === 'fulfilled' && (r.value.data?.length || 0) > 0);

      if (!hasLinkedRecords) {
        await supabase.from('item_variant_pricing').delete().eq('item_id', id);
        await supabase.from('item_stock').delete().eq('item_id', id);

        const { error } = await supabase.from('materials').delete().eq('id', id);
        if (error) throw error;
        setMaterials((prev) => prev.filter((m) => m.id !== id));
        if (selectedMaterialId === id) {
          setSelectedMaterialId(null);
          setItemTransactions(emptyItemTransactions());
        }
      } else {
        const { error } = await supabase
          .from('materials')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', id);
        if (error) throw error;
        setMaterials((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, is_active: false, updated_at: new Date().toISOString() } : item
          )
        );
        alert('Item is linked with transactions, so it was archived (disabled) instead of hard delete.');
      }
    } catch (err) {
      console.error('Delete item error:', err);
      alert('Unable to delete item: ' + err.message);
    } finally {
      setDeleteInProgress(false);
    }
  };

  const toggleActive = async (material) => {
    await supabase.from('materials').update({ is_active: !material.is_active, updated_at: new Date().toISOString() }).eq('id', material.id);
    loadMaterials();
  };

  const filteredMaterials = materials.filter(m => {
    const matchesSearch = 
      m.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.item_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.material?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || m.main_category === categoryFilter;
    const matchesActive = !hideInactive || m.is_active;
    return matchesSearch && matchesCategory && matchesActive;
  });

  const selectedMaterial = materials.find((item) => item.id === selectedMaterialId) || null;

  const openDeleteModal = (material) => {
    setDeleteTarget(material);
  };

  const closeDeleteModal = () => {
    if (deleteInProgress) return;
    setDeleteTarget(null);
  };

  const confirmDeleteMaterial = async () => {
    if (!deleteTarget?.id) return;
    await deleteMaterial(deleteTarget.id);
    setDeleteTarget(null);
  };

  const selectMaterialRow = (material) => {
    setSelectedMaterialId(material.id);
    setActiveDetailTab('overview');
    setShowItemWorkspace(true);
  };

  const closeItemWorkspace = () => {
    setShowItemWorkspace(false);
  };

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

  const categoryList = ['All', ...categories.map(c => c.category_name)];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Items</h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-secondary" onClick={() => setShowColumnSettings((prev) => !prev)}>
            Columns
          </button>
          <button className="btn btn-secondary" onClick={openBulkPriceModal}>
            Bulk Price Update
          </button>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            + Add Item
          </button>
        </div>
      </div>

      {saveNotice && (
        <div className="alert alert-success">{saveNotice}</div>
      )}

      {showColumnSettings && (
        <div className="card" style={{ marginBottom: '16px' }}>
          <h3 className="card-title">Select Visible Columns</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
            {ITEM_TABLE_COLUMNS.map((column) => (
              <label key={column.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={visibleColumns.includes(column.key)}
                  disabled={column.locked}
                  onChange={() => toggleColumn(column.key)}
                />
                {column.label}{column.locked ? ' (Default)' : ''}
              </label>
            ))}
            </div>
          </div>
      )}

      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="text" className="form-input" placeholder="Search items..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ maxWidth: '300px' }} />
          <select className="form-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ maxWidth: '200px' }}>
            {categoryList.map(cat => (<option key={cat} value={cat}>{cat === 'All' ? 'All Categories' : cat}</option>))}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input type="checkbox" checked={hideInactive} onChange={(e) => setHideInactive(e.target.checked)} />
            Hide Inactive
          </label>
          <span style={{ marginLeft: 'auto', color: '#666' }}>{filteredMaterials.length} items</span>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {filteredMaterials.length === 0 ? (
          <div className="empty-state"><h3>No Items</h3></div>
        ) : (
          <div className="table-container" style={{ overflowX: 'auto' }}>
            <table className="table items-reference-table">
              <thead>
                <tr>
                  {visibleColumns.includes('name') && <th>Name</th>}
                  {visibleColumns.includes('code') && <th>Code</th>}
                  {visibleColumns.includes('category') && <th>Category</th>}
                  {visibleColumns.includes('sub_category') && <th>Sub Category</th>}
                  {visibleColumns.includes('size') && <th>Size</th>}
                  {visibleColumns.includes('make') && <th>MAKE(Brand name)</th>}
                  {visibleColumns.includes('material') && <th>Material</th>}
                  {visibleColumns.includes('end_connection') && <th>End Connection</th>}
                  {visibleColumns.includes('unit') && <th>Unit</th>}
                  {visibleColumns.includes('sale_price') && <th>Sale Price</th>}
                  {visibleColumns.includes('purchase_price') && <th>Purchase Price</th>}
                  {visibleColumns.includes('hsn_code') && <th>HSN/SAC</th>}
                  {visibleColumns.includes('gst_rate') && <th>GST Rate</th>}
                  {visibleColumns.includes('uses_variant') && <th>Variant</th>}
                  {visibleColumns.includes('stock') && <th>Stock</th>}
                  {visibleColumns.includes('status') && <th>Status</th>}
                  <th style={{ width: '190px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredMaterials.map((m) => {
                  const isActive = m.is_active !== false;
                  const isSelected = selectedMaterialId === m.id;
                  const stock = stockData[m.id] || 0;
                  return (
                    <tr
                      key={m.id}
                      className={`item-click-row ${isSelected ? 'selected' : ''}`}
                      style={{ opacity: isActive ? 1 : 0.55 }}
                    >
                      {visibleColumns.includes('name') && (
                        <td>
                          <div className="item-main-cell">
                            <div className="item-avatar">{(m.display_name || m.name || '?').slice(0, 1).toUpperCase()}</div>
                            <div>
                              <button type="button" className="item-name-link" onClick={() => selectMaterialRow(m)}>
                                {m.display_name || m.name}
                              </button>
                              <div className="item-main-sub">{m.material || m.size || 'Item'}</div>
                            </div>
                          </div>
                        </td>
                      )}
                      {visibleColumns.includes('code') && <td>{m.item_code || '-'}</td>}
                      {visibleColumns.includes('category') && <td>{m.main_category || '-'}</td>}
                      {visibleColumns.includes('sub_category') && <td>{formatColumnValue(m, 'sub_category')}</td>}
                      {visibleColumns.includes('size') && <td>{formatColumnValue(m, 'size')}</td>}
                      {visibleColumns.includes('pressure_class') && <td>{formatColumnValue(m, 'pressure_class')}</td>}
                      {visibleColumns.includes('make') && <td>{formatColumnValue(m, 'make')}</td>}
                      {visibleColumns.includes('material') && <td>{formatColumnValue(m, 'material')}</td>}
                      {visibleColumns.includes('end_connection') && <td>{formatColumnValue(m, 'end_connection')}</td>}
                      {visibleColumns.includes('unit') && <td>{m.unit || '-'}</td>}
                      {visibleColumns.includes('sale_price') && <td>{formatColumnValue(m, 'sale_price')}</td>}
                      {visibleColumns.includes('purchase_price') && <td>{formatColumnValue(m, 'purchase_price')}</td>}
                      {visibleColumns.includes('hsn_code') && <td>{formatColumnValue(m, 'hsn_code')}</td>}
                      {visibleColumns.includes('gst_rate') && <td>{formatColumnValue(m, 'gst_rate')}</td>}
                      {visibleColumns.includes('uses_variant') && <td>{formatColumnValue(m, 'uses_variant')}</td>}
                      {visibleColumns.includes('stock') && (
                        <td style={{ color: stock < (m.low_stock_level || 0) ? '#b42318' : '#067647', fontWeight: 600 }}>
                          {stock}
                        </td>
                      )}
                      {visibleColumns.includes('status') && (
                        <td>
                          <span className={`status-chip ${isActive ? 'active' : 'inactive'}`}>{isActive ? 'Active' : 'Inactive'}</span>
                        </td>
                      )}
                      <td>
                        <div className="item-actions-cell">
                          <button className="btn btn-sm btn-secondary" onClick={() => editMaterial(m)}>Edit</button>
                          <button className="btn btn-sm btn-secondary" onClick={() => toggleActive(m)}>
                            {m.is_active ? 'Disable' : 'Enable'}
                          </button>
                          <button className="btn btn-sm btn-secondary" onClick={() => openDeleteModal(m)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
                  {!detailLoading && detailError && <div className="alert alert-error">{detailError}</div>}

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
              <strong> Item Code/Name | Sale Price | Purchase Price(optional)</strong>.
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
                      <th>Item Code</th>
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
        <div className="modal-overlay open" onClick={resetForm}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: '92vw', maxWidth: '1100px', maxHeight: '92vh', overflowY: 'auto', background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>{editingMaterial ? 'Edit Item' : 'Add Item'}</h2>
              <button onClick={resetForm} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>×</button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                <h4 style={{ marginBottom: '15px', color: '#3498db' }}>Basic Information</h4>
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
                    <label className="form-label">Item Code</label>
                    <input type="text" className="form-input" value={formData.item_code} onChange={e => setFormData({...formData, item_code: e.target.value})} placeholder="Auto-generated if empty" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Main Category</label>
                    <select className="form-select" value={formData.main_category} onChange={e => setFormData({...formData, main_category: e.target.value})}>
                      <option value="">Select Category</option>
                      {categories.map(cat => (<option key={cat.id} value={cat.category_name}>{cat.category_name}</option>))}
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ background: '#e8f4f8', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                <h4 style={{ marginBottom: '15px', color: '#3498db' }}>Technical Attributes (Internal Use Only)</h4>
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
                    <label className="form-label">MAKE(Brand name)</label>
                    <input type="text" className="form-input" value={formData.make} onChange={e => setFormData({...formData, make: e.target.value})} placeholder="Brand name" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Material</label>
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
                    <input type="text" className="form-input" value={formData.sub_category} onChange={e => setFormData({...formData, sub_category: e.target.value})} />
                  </div>
                </div>
              </div>

              <div style={{ background: '#e8f8e8', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                <h4 style={{ marginBottom: '15px', color: '#28a745' }}>Commercial</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Unit</label>
                    <select className="form-select" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})}>
                      {units.length > 0 ? units.map(u => (<option key={u.unit_code} value={u.unit_code}>{u.unit_name} ({u.unit_code})</option>)) : <option value="nos">Nos</option>}
                    </select>
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
              </div>

              <div style={{ background: '#fff3e0', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                <h4 style={{ marginBottom: '15px', color: '#f39c12' }}>Inventory</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={formData.track_inventory} onChange={e => setFormData({...formData, track_inventory: e.target.checked})} />
                      Track Inventory
                    </label>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Current Stock</label>
                    <input type="number" className="form-input" value={formData.current_stock} onChange={e => setFormData({...formData, current_stock: e.target.value})} step="0.01" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Low Stock Level</label>
                    <input type="number" className="form-input" value={formData.low_stock_level} onChange={e => setFormData({...formData, low_stock_level: e.target.value})} step="0.01" />
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} />
                  Active
                </label>
              </div>

              <div style={{ background: formData.uses_variant ? '#e8f4f8' : '#f8f9fa', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '500' }}>
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
                      }
                    }}
                  />
                  This item uses Variant
                </label>
                <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                  {formData.uses_variant 
                    ? 'Prices will be set per variant below. At least one variant price is required before saving.'
                    : 'Enable to set different prices for different variants (Retail, Wholesale, Special, etc.)'}
                </p>
              </div>

              {formData.uses_variant && (
                <div style={{ background: '#f0f7ff', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h4 style={{ margin: 0, color: '#1976d2' }}>Variant Pricing (by Variant & Make)</h4>
                    <button type="button" className="btn btn-sm btn-primary" onClick={addVariantPricingRow}>+ Add Pricing Row</button>
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
                              <option value="">No Variant</option>
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

              <div className="item-form-footer">
                <button type="submit" className="btn btn-primary">{editingMaterial ? 'Update Item' : 'Save Item'}</button>
                <button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ServiceTab() {
  const [services, setServices] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    service_code: '', service_name: '', description: '', unit: 'nos',
    sale_price: '', purchase_price: '', hsn_code: '', tax_rate: 18, is_active: true
  });

  useEffect(() => { loadServices(); }, []);

  const loadServices = async () => {
    const { data } = await supabase.from('materials').select('*').eq('item_type', 'service').order('name');
    setServices(data || []);
  };

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
      loadServices();
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
      loadServices();
    }
  };

  const filteredServices = services.filter(s => s.name?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Services</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add Service</button>
      </div>

      <div className="card" style={{ marginBottom: '16px' }}>
        <input type="text" className="form-input" placeholder="Search services..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ maxWidth: '300px' }} />
      </div>

      <div className="card">
        {filteredServices.length === 0 ? <div className="empty-state"><h3>No Services</h3></div> : (
          <table className="table">
            <thead><tr><th>Service Code</th><th>Service Name</th><th>Unit</th><th>Sale Price</th><th>HSN/SAC</th><th>Active</th><th>Actions</th></tr></thead>
            <tbody>
              {filteredServices.map(s => (
                <tr key={s.id} style={{ opacity: s.is_active === false ? 0.5 : 1 }}>
                  <td>{s.item_code}</td><td><strong>{s.name}</strong></td><td>{s.unit}</td><td>â‚¹{s.sale_price || '-'}</td><td>{s.hsn_code || '-'}</td><td>{s.is_active ? '✓' : '✗'}</td>
                  <td><button className="btn btn-sm btn-secondary" onClick={() => editService(s)}>Edit</button><button className="btn btn-sm btn-secondary" style={{ marginLeft: '4px' }} onClick={() => deleteService(s.id)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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
  );
}

function CategoryTab() {
  const [categories, setCategories] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({ category_name: '', description: '', is_active: true });

  useEffect(() => { loadCategories(); }, []);

  const loadCategories = async () => {
    const { data } = await supabase.from('item_categories').select('*').order('category_name');
    setCategories(data || []);
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
      <div className="card">
        {filteredCategories.length === 0 ? <div className="empty-state"><h3>No Categories</h3></div> : (
          <table className="table">
            <thead><tr><th>Category Name</th><th>Description</th><th>Active</th><th>Actions</th></tr></thead>
            <tbody>{filteredCategories.map(c => (<tr key={c.id} style={{ opacity: c.is_active === false ? 0.5 : 1 }}><td><strong>{c.category_name}</strong></td><td>{c.description || '-'}</td><td>{c.is_active ? '✓' : '✗'}</td><td><button className="btn btn-sm btn-secondary" onClick={() => editCategory(c)}>Edit</button><button className="btn btn-sm btn-secondary" style={{ marginLeft: '4px' }} onClick={() => deleteCategory(c.id)}>Delete</button></td></tr>))}</tbody>
          </table>
        )}
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
  const [units, setUnits] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({ unit_name: '', unit_code: '', description: '', is_active: true });

  useEffect(() => { loadUnits(); }, []);

  const loadUnits = async () => {
    const { data } = await supabase.from('item_units').select('*').order('unit_name');
    setUnits(data || []);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingUnit) {
        const { error } = await supabase.from('item_units').update(formData).eq('id', editingUnit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('item_units').insert(formData);
        if (error) throw error;
      }
      resetForm();
      loadUnits();
    } catch (err) {
      alert('Error saving unit: ' + err.message);
    }
  };

  const resetForm = () => { setShowForm(false); setEditingUnit(null); setFormData({ unit_name: '', unit_code: '', description: '', is_active: true }); };

  const editUnit = (unit) => { setEditingUnit(unit); setFormData({ unit_name: unit.unit_name, unit_code: unit.unit_code, description: unit.description || '', is_active: unit.is_active !== false }); setShowForm(true); };
  const deleteUnit = async (id) => { if (confirm('Delete this unit?')) { await supabase.from('item_units').delete().eq('id', id); loadUnits(); }};

  const filteredUnits = units.filter(u => u.unit_name?.toLowerCase().includes(searchTerm.toLowerCase()) || u.unit_code?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Units</h1><button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add Unit</button></div>
      <div className="card" style={{ marginBottom: '16px' }}><input type="text" className="form-input" placeholder="Search units..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ maxWidth: '300px' }} /></div>
      <div className="card">
        {filteredUnits.length === 0 ? <div className="empty-state"><h3>No Units</h3></div> : (
          <table className="table">
            <thead><tr><th>Unit Name</th><th>Unit Code</th><th>Description</th><th>Active</th><th>Actions</th></tr></thead>
            <tbody>{filteredUnits.map(u => (<tr key={u.id} style={{ opacity: u.is_active === false ? 0.5 : 1 }}><td><strong>{u.unit_name}</strong></td><td>{u.unit_code}</td><td>{u.description || '-'}</td><td>{u.is_active ? '✓' : '✗'}</td><td><button className="btn btn-sm btn-secondary" onClick={() => editUnit(u)}>Edit</button><button className="btn btn-sm btn-secondary" style={{ marginLeft: '4px' }} onClick={() => deleteUnit(u.id)}>Delete</button></td></tr>))}</tbody>
          </table>
        )}
      </div>
      {showForm && (
        <div className="modal-overlay open" onClick={resetForm}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}><h2>{editingUnit ? 'Edit Unit' : 'Add Unit'}</h2><button onClick={resetForm} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>×</button></div>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Unit Name *</label><input type="text" className="form-input" value={formData.unit_name} onChange={e => setFormData({...formData, unit_name: e.target.value})} required /></div>
                <div className="form-group"><label className="form-label">Unit Code *</label><input type="text" className="form-input" value={formData.unit_code} onChange={e => setFormData({...formData, unit_code: e.target.value})} required /></div>
              </div>
              <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
              <div className="form-group"><label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} /> Active</label></div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}><button type="submit" className="btn btn-primary">{editingUnit ? 'Update' : 'Save'}</button><button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function WarehousesTab() {
  const [warehouses, setWarehouses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({ warehouse_code: '', warehouse_name: '', location: '', is_default: false, is_active: true });

  useEffect(() => { loadWarehouses(); }, []);

  const loadWarehouses = async () => {
    const { data } = await supabase.from('warehouses').select('*').order('warehouse_name');
    setWarehouses(data || []);
  };

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
    loadWarehouses();
  };

  const resetForm = () => { setShowForm(false); setEditingWarehouse(null); setFormData({ warehouse_code: '', warehouse_name: '', location: '', is_default: false, is_active: true }); };

  const editWarehouse = (w) => { setEditingWarehouse(w); setFormData({ warehouse_code: w.warehouse_code || '', warehouse_name: w.warehouse_name, location: w.location || '', is_default: w.is_default || false, is_active: w.is_active !== false }); setShowForm(true); };
  const deleteWarehouse = async (id) => { if (confirm('Delete this warehouse?')) { await supabase.from('warehouses').delete().eq('id', id); loadWarehouses(); }};

  const filteredWarehouses = warehouses.filter(w => w.warehouse_name?.toLowerCase().includes(searchTerm.toLowerCase()) || w.warehouse_code?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Warehouses</h1><button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add Warehouse</button></div>
      <div className="card" style={{ marginBottom: '16px' }}><input type="text" className="form-input" placeholder="Search warehouses..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ maxWidth: '300px' }} /></div>
      <div className="card">
        {filteredWarehouses.length === 0 ? <div className="empty-state"><h3>No Warehouses</h3></div> : (
          <table className="table">
            <thead><tr><th>Warehouse Code</th><th>Warehouse Name</th><th>Location</th><th>Default</th><th>Active</th><th>Actions</th></tr></thead>
            <tbody>{filteredWarehouses.map(w => (<tr key={w.id} style={{ opacity: w.is_active === false ? 0.5 : 1 }}><td>{w.warehouse_code}</td><td><strong>{w.warehouse_name || w.name}</strong></td><td>{w.location || '-'}</td><td>{w.is_default ? '✓' : '-'}</td><td>{w.is_active ? '✓' : '✗'}</td><td><button className="btn btn-sm btn-secondary" onClick={() => editWarehouse(w)}>Edit</button><button className="btn btn-sm btn-secondary" style={{ marginLeft: '4px' }} onClick={() => deleteWarehouse(w.id)}>Delete</button></td></tr>))}</tbody>
          </table>
        )}
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
  const [variants, setVariants] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingVariant, setEditingVariant] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({ variant_name: '', is_active: true });

  useEffect(() => { loadVariants(); }, []);

  const loadVariants = async () => {
    const { data } = await supabase.from('company_variants').select('*').order('variant_name');
    setVariants(data || []);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingVariant) {
      await supabase.from('company_variants').update({ ...formData, updated_at: new Date().toISOString() }).eq('id', editingVariant.id);
    } else {
      await supabase.from('company_variants').insert(formData);
    }
    resetForm();
    loadVariants();
  };

  const resetForm = () => { setShowForm(false); setEditingVariant(null); setFormData({ variant_name: '', is_active: true }); };

  const editVariant = (v) => { setEditingVariant(v); setFormData({ variant_name: v.variant_name, is_active: v.is_active !== false }); setShowForm(true); };
  const deleteVariant = async (id) => { if (confirm('Delete this variant? This may affect existing pricing.')) { await supabase.from('company_variants').delete().eq('id', id); loadVariants(); }};

  const filteredVariants = variants.filter(v => v.variant_name?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Inventory Variants</h1><button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add Variant</button></div>
      <div className="card" style={{ marginBottom: '16px' }}>
        <p style={{ color: '#666', marginBottom: '10px' }}>Variants represent different commercial contexts (e.g., Retail, Wholesale, Export). Each item can have different pricing per variant.</p>
        <input type="text" className="form-input" placeholder="Search variants..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ maxWidth: '300px' }} />
      </div>
      <div className="card">
        {filteredVariants.length === 0 ? <div className="empty-state"><h3>No Variants</h3></div> : (
          <table className="table">
            <thead><tr><th>Variant Name</th><th>Active</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>{filteredVariants.map(v => (<tr key={v.id} style={{ opacity: v.is_active === false ? 0.5 : 1 }}><td><strong>{v.variant_name}</strong></td><td>{v.is_active ? '✓' : '✗'}</td><td>{v.created_at ? new Date(v.created_at).toLocaleDateString() : '-'}</td><td><button className="btn btn-sm btn-secondary" onClick={() => editVariant(v)}>Edit</button><button className="btn btn-sm btn-secondary" style={{ marginLeft: '4px' }} onClick={() => deleteVariant(v.id)}>Delete</button></td></tr>))}</tbody>
          </table>
        )}
      </div>
      {showForm && (
        <div className="modal-overlay open" onClick={resetForm}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}><h2>{editingVariant ? 'Edit Variant' : 'Add Variant'}</h2><button onClick={resetForm} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>×</button></div>
            <form onSubmit={handleSubmit}>
              <div className="form-group"><label className="form-label">Variant Name *</label><input type="text" className="form-input" value={formData.variant_name} onChange={e => setFormData({...formData, variant_name: e.target.value})} placeholder="e.g., Retail, Wholesale, Export" required /></div>
              <div className="form-group"><label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} /> Active</label></div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}><button type="submit" className="btn btn-primary">{editingVariant ? 'Update' : 'Save'}</button><button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MaterialsList() {
  const getTabFromUrl = () => {
    const hashQuery = window.location.hash.split('?')[1] || '';
    const query = window.location.search.slice(1) || hashQuery;
    const tab = new URLSearchParams(query).get('tab');
    const allowedTabs = new Set(['items', 'service', 'category', 'unit', 'warehouses', 'variants']);
    return allowedTabs.has(tab) ? tab : 'items';
  };

  const [activeTab, setActiveTab] = useState(getTabFromUrl);

  useEffect(() => {
    const syncTabFromUrl = () => {
      setActiveTab(getTabFromUrl());
    };
    window.addEventListener('hashchange', syncTabFromUrl);
    window.addEventListener('popstate', syncTabFromUrl);
    return () => {
      window.removeEventListener('hashchange', syncTabFromUrl);
      window.removeEventListener('popstate', syncTabFromUrl);
    };
  }, []);

  const changeTab = (tab) => {
    setActiveTab(tab);
    const nextPath = `/store/materials?tab=${tab}`;
    window.history.pushState({}, '', nextPath);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <div>
      <div style={{ borderBottom: '1px solid #ddd', marginBottom: '20px', display: 'flex', gap: '0px' }}>
        <TabButton active={activeTab === 'items'} onClick={() => changeTab('items')}>Items</TabButton>
        <TabButton active={activeTab === 'service'} onClick={() => changeTab('service')}>Service</TabButton>
        <TabButton active={activeTab === 'category'} onClick={() => changeTab('category')}>Category</TabButton>
        <TabButton active={activeTab === 'unit'} onClick={() => changeTab('unit')}>Unit</TabButton>
        <TabButton active={activeTab === 'warehouses'} onClick={() => changeTab('warehouses')}>Warehouses</TabButton>
        <TabButton active={activeTab === 'variants'} onClick={() => changeTab('variants')}>Inventory Variants</TabButton>
      </div>

      {activeTab === 'items' && <ItemsTab />}
      {activeTab === 'service' && <ServiceTab />}
      {activeTab === 'category' && <CategoryTab />}
      {activeTab === 'unit' && <UnitTab />}
      {activeTab === 'warehouses' && <WarehousesTab />}
      {activeTab === 'variants' && <VariantsTab />}
    </div>
  );
}


