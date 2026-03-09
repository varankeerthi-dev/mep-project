import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../supabase';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Save, FileDown, Plus, Trash2, Sheet, Table, X, Settings, FileSpreadsheet, Loader2, GripVertical } from 'lucide-react';
import { saveBOQWithItems } from '../api';

const generateId = () => Math.random().toString(36).substr(2, 9);
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
  { key: 'description', label: 'Description', width: 250, visible: true },
  { key: 'hsn_sac', label: 'HSN/SAC', width: 90, visible: true },
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
  { id: generateId(), name: 'Terms & Conditions', isDefault: false },
  { id: generateId(), name: 'Preface', isDefault: false },
];

export function BOQ() {
  const [boqData, setBoqData] = useState({
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

  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [variants, setVariants] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [makes, setMakes] = useState([]);
  const [clientDiscounts, setClientDiscounts] = useState({});
  const [boqVariantDiscounts, setBoqVariantDiscounts] = useState({});
  
  const [sheets, setSheets] = useState(DEFAULT_SHEETS);
  const [activeSheetId, setActiveSheetId] = useState(DEFAULT_SHEETS[0].id);
  
  const [items, setItems] = useState({});
  const [columnSettings, setColumnSettings] = useState(DEFAULT_COLUMNS);
  const [showColumnPanel, setShowColumnPanel] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showExportSettings, setShowExportSettings] = useState(false);
  const [exportColumns, setExportColumns] = useState({});
  const [exportSheets, setExportSheets] = useState({});
  const [loading, setLoading] = useState(false);
  const [materialSearch, setMaterialSearch] = useState({});
  const [materialSearchActive, setMaterialSearchActive] = useState(null);
  const [dragRowIndex, setDragRowIndex] = useState(null);
  const [dragSheetId, setDragSheetId] = useState(null);
  const [editingSheetId, setEditingSheetId] = useState(null);
  const [editingSheetName, setEditingSheetName] = useState('');
  const [activeRowIndex, setActiveRowIndex] = useState(null);

  const inputRefs = useRef({});
  const prevDefaultVariantRef = useRef('');
  const undoStackRef = useRef({});
  const copiedRowRef = useRef(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (!boqData.termsConditions) {
      setBoqData(prev => ({ ...prev, termsConditions: DEFAULT_TERMS }));
    }
  }, []);

  useEffect(() => {
    const key = boqData.boqNo ? `boq_export_${boqData.boqNo}` : null;
    if (!key) return;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed?.columns) setExportColumns(parsed.columns);
        if (parsed?.sheets) setExportSheets(parsed.sheets);
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

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        supabase.from('clients').select('id, client_name').order('client_name'),
        supabase.from('projects').select('id, project_name').order('project_name'),
        supabase.from('company_variants').select('id, variant_name').order('variant_name'),
        supabase.from('materials').select('id, name, sale_price, make, hsn_code, unit').order('name'),
        supabase.from('materials').select('make').not('make', 'is', null).neq('make', '').order('make'),
      ]);

      if (results[0].status === 'fulfilled' && results[0].value.data) setClients(results[0].value.data);
      if (results[1].status === 'fulfilled' && results[1].value.data) setProjects(results[1].value.data);
      if (results[2].status === 'fulfilled' && results[2].value.data) setVariants(results[2].value.data);
      if (results[3].status === 'fulfilled' && results[3].value.data) setMaterials(results[3].value.data);
      
      const makesResult = results[4];
      if (makesResult.status === 'fulfilled' && makesResult.value.data) {
        const uniqueMakes = [...new Set(makesResult.value.data.map(m => m.make).filter(Boolean))];
        setMakes(uniqueMakes);
      }

      const newBoqNo = await generateBoqNumber();
      setBoqData(prev => ({ ...prev, boqNo: newBoqNo }));
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  const generateBoqNumber = async () => {
    try {
      const { data } = await supabase.rpc('generate_boq_number');
      if (data) return data;
    } catch {
      console.log('RPC not available, using fallback');
    }
    return `BOQ-${String(Date.now()).slice(-4)}`;
  };

  const loadClientDiscounts = async (clientId) => {
    if (!clientId) {
      setClientDiscounts({});
      return;
    }

    const { data: client } = await supabase
      .from('clients')
      .select('*, discount_profile_id')
      .eq('id', clientId)
      .single();

    if (client?.discount_profile_id) {
      const { data: settings } = await supabase
        .from('discount_variant_settings')
        .select('*, variant:company_variants(variant_name)')
        .eq('structure_id', client.discount_profile_id);

      const discountMap = {};
      settings?.forEach(s => {
        if (s.variant_id) {
          discountMap[s.variant_id] = {
            discount: s.max_discount || 0,
            variantName: s.variant?.variant_name || ''
          };
        }
      });
      setClientDiscounts(discountMap);
    } else if (client?.custom_discounts) {
      const discountMap = {};
      Object.entries(client.custom_discounts).forEach(([variantId, discount]) => {
        const variantName = variants.find(v => v.id === variantId)?.variant_name || '';
        discountMap[variantId] = { discount, variantName };
      });
      setClientDiscounts(discountMap);
    }
  };

  const handleClientChange = (clientId) => {
    setBoqData(prev => ({ ...prev, clientId }));
    loadClientDiscounts(clientId);
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
    
    setBoqVariantDiscounts(prev => ({ ...prev, [variantId]: discount }));
  };

  const getPrice = useCallback(async (itemId, variantId, make) => {
    if (!itemId) return 0;

    if (variantId && make) {
      const { data: price1 } = await supabase
        .from('item_variant_pricing')
        .select('sale_price')
        .eq('item_id', itemId)
        .eq('company_variant_id', variantId)
        .eq('make', make)
        .eq('is_active', true)
        .single();
      if (price1?.sale_price) return price1.sale_price;
    }

    if (variantId) {
      const { data: price2 } = await supabase
        .from('item_variant_pricing')
        .select('sale_price')
        .eq('item_id', itemId)
        .eq('company_variant_id', variantId)
        .eq('make', '')
        .eq('is_active', true)
        .single();
      if (price2?.sale_price) return price2.sale_price;
    }

    const material = materials.find(m => m.id === itemId);
    return material?.sale_price || 0;
  }, [materials]);

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
    setItems(prevItems => {
      const next = { ...prevItems };
      Object.keys(next).forEach(sheetId => {
        const list = next[sheetId] || [];
        next[sheetId] = list.map(row => {
          if (row.isHeaderRow) return row;
          if (!row.variantId || row.variantId === prev) {
            return {
              ...row,
              variantId: boqData.variantId || row.variantId,
              variantName: getVariantNameById(boqData.variantId || row.variantId),
              discountPercent: getVariantDiscount(boqData.variantId || row.variantId)
            };
          }
          return row;
        });
      });
      return next;
    });
    prevDefaultVariantRef.current = boqData.variantId;
  }, [boqData.variantId, getVariantDiscount]);

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
    newItems[index] = row;
    setItems(prev => ({ ...prev, [activeSheetId]: newItems }));
    const price = await getPrice(material.id, row.variantId || boqData.variantId, row.make);
    setItems(prev => {
      const next = [...(prev[activeSheetId] || [])];
      next[index] = { ...next[index], rate: price || material.sale_price || next[index].rate };
      return { ...prev, [activeSheetId]: next };
    });
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
    const doc = new jsPDF('landscape', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();

    const renderHeader = (title) => {
      doc.setFontSize(18);
      doc.text('BILL OF QUANTITIES', pageWidth / 2, 20, { align: 'center' });
      if (title) {
        doc.setFontSize(11);
        doc.text(title, pageWidth / 2, 28, { align: 'center' });
      }
      doc.setFontSize(10);
      doc.text(`BOQ No: ${boqData.boqNo}`, 14, 35);
      doc.text(`Revision: ${boqData.revisionNo}`, 14, 42);
      doc.text(`Date: ${boqData.date}`, 14, 49);
      const client = clients.find(c => c.id === boqData.clientId);
      const project = projects.find(p => p.id === boqData.projectId);
      doc.text(`Client: ${client?.client_name || '-'}`, 80, 35);
      doc.text(`Project: ${project?.project_name || '-'}`, 80, 42);
    };

    const contentWidth = pageWidth - 28;
    const totalColWidth = exportColumnList.reduce((sum, c) => sum + (c.width || 100), 0) || 1;
    const columnStyles = {};
    exportColumnList.forEach((col, idx) => {
      const width = ((col.width || 100) / totalColWidth) * contentWidth;
      const isNumber = ['quantity', 'rate', 'discountPercent', 'rateAfterDiscount', 'totalAmount'].includes(col.key);
      columnStyles[idx] = { cellWidth: width, halign: isNumber ? 'right' : 'left' };
    });

    exportSheetList.forEach((sheet, sheetIdx) => {
      const name = sheet.name.toLowerCase();
      if (name.includes('terms') || name.includes('preface')) {
        if (sheetIdx > 0) doc.addPage();
        const title = name.includes('terms') ? 'Terms & Conditions' : 'Preface';
        doc.setFontSize(16);
        doc.text(title, 14, 20);
        doc.setFontSize(10);
        const content = name.includes('terms') ? (boqData.termsConditions || '') : (boqData.preface || '');
        const lines = doc.splitTextToSize(content, pageWidth - 28);
        doc.text(lines, 14, 30);
        return;
      }

      if (sheetIdx > 0) doc.addPage();
      renderHeader(sheet.name);

      const tableData = [];
      let sno = 0;
      const sheetItems = items[sheet.id] || [];
      let sheetTotalQty = 0;
      let sheetTotalAmount = 0;

      sheetItems.forEach(item => {
        if (item.isHeaderRow) {
          tableData.push([{ content: item.headerText || 'SECTION', colSpan: exportColumnList.length, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }]);
        } else {
          sno++;
          const { rateAfterDiscount, totalAmount } = calculateRow(item);
          sheetTotalQty += parseFloat(item.quantity) || 0;
          sheetTotalAmount += totalAmount || 0;
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
              case 'rate': row.push(item.rate ? `Rs. ${item.rate}` : ''); break;
              case 'discountPercent': row.push(item.discountPercent ? `${item.discountPercent}%` : ''); break;
              case 'rateAfterDiscount': row.push(rateAfterDiscount ? `Rs. ${rateAfterDiscount}` : ''); break;
              case 'totalAmount': row.push(totalAmount ? `Rs. ${totalAmount.toLocaleString()}` : ''); break;
              case 'specification': row.push(item.specification || ''); break;
              case 'remarks': row.push(item.remarks || ''); break;
              case 'pressure': row.push(item.pressure || ''); break;
              case 'thickness': row.push(item.thickness || ''); break;
              case 'schedule': row.push(item.schedule || ''); break;
              case 'material': row.push(item.material || ''); break;
              default: row.push('');
            }
          });
          tableData.push(row);
        }
      });

      const totalsRow = exportColumnList.map(col => {
        if (col.key === 'description') return 'Total';
        if (col.key === 'quantity') return sheetTotalQty || '';
        if (col.key === 'totalAmount') return `Rs. ${sheetTotalAmount.toLocaleString()}`;
        return '';
      });
      tableData.push(totalsRow);

      const headers = exportColumnList.map(col => col.label);
      autoTable(doc, {
        head: [headers],
        body: tableData,
        startY: 55,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 1.5, textColor: 20 },
        headStyles: { fillColor: [230, 232, 235], textColor: 20, fontStyle: 'bold' },
        bodyStyles: { fontStyle: 'normal' },
        alternateRowStyles: { fillColor: [255, 255, 255] },
        columnStyles,
      });

      // Totals are included as the last row to match Excel layout
    });

    doc.save(`${boqData.boqNo}.pdf`);
    setShowExportMenu(false);
  }, [boqData, clients, projects, items, exportColumnList, exportSheetList, calculateRow, totals]);

  const exportToExcel = useCallback(() => {
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
        const title = name.includes('terms') ? 'Terms & Conditions' : 'Preface';
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

  const handleSave = async () => {
    setLoading(true);
    try {
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
      const savedId = await saveBOQWithItems(boqSaveData, sheets, items);
      setBoqData(prev => ({ ...prev, id: savedId }));
      alert('BOQ saved successfully!');
    } catch (error) {
      console.error('Error saving BOQ:', error);
      alert('Error saving BOQ: ' + error.message);
    }
    setLoading(false);
  };

  if (loading && !clients.length) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading BOQ...</div>;
  }

  const currentItems = items[activeSheetId] || [];
  const activeSheet = sheets.find(s => s.id === activeSheetId);
  const isTermsSheet = activeSheet?.name?.toLowerCase().includes('terms');
  const isPrefaceSheet = activeSheet?.name?.toLowerCase().includes('preface');

  return (
    <div className="page-container" style={{ padding: '18px', background: '#eef1f4', minHeight: '100vh', fontFamily: "'Open Sans', sans-serif" }}>
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
            onClick={handleSave}
            style={{ ...btnStyle, background: '#1976d2', color: 'white' }}
            disabled={loading}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save BOQ
          </button>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={excelMetaGridStyle}>
          <div>
            <label style={labelStyle}>Date</label>
            <input type="date" value={boqData.date} onChange={(e) => setBoqData(prev => ({ ...prev, date: e.target.value }))} style={inputStyle} />
          </div>
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
          <div>
            <label style={labelStyle}>BOQ No</label>
            <input type="text" value={boqData.boqNo} onChange={(e) => setBoqData(prev => ({ ...prev, boqNo: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Revision No</label>
            <input type="number" value={boqData.revisionNo} onChange={(e) => setBoqData(prev => ({ ...prev, revisionNo: parseInt(e.target.value) || 1 }))} style={inputStyle} />
          </div>
        </div>

        <div style={excelMetaBoxStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Variant:</label>
            <select value={boqData.variantId} onChange={(e) => handleVariantChange(e.target.value)} style={{ ...inputStyle, width: '220px' }}>
              <option value="">Select Variant (Default for all rows)</option>
              {variants.map(v => <option key={v.id} value={v.id}>{v.variant_name}</option>)}
            </select>

            {Object.keys(clientDiscounts).length > 0 && (
              <>
                <span style={{ fontWeight: '600', color: '#4b5563', fontSize: '12px' }}>Variant Discounts:</span>
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
              </>
            )}
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
              {isTermsSheet ? 'Terms & Conditions' : 'Preface'}
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

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                className="btn btn-primary"
                onClick={() => {
                  if (boqData.boqNo) {
                    localStorage.setItem(`boq_export_${boqData.boqNo}`, JSON.stringify({
                      columns: exportColumns,
                      sheets: exportSheets
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

const excelMetaGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(5, 1fr)',
  gap: '12px',
  marginBottom: '14px',
  padding: '12px',
  background: '#ffffff',
  borderRadius: '4px',
  border: '1px solid #d1d5db',
};

const excelMetaBoxStyle = {
  marginBottom: '14px',
  padding: '12px',
  background: '#ffffff',
  borderRadius: '4px',
  border: '1px solid #d1d5db',
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
  fontFamily: "'Open Sans', sans-serif",
  resize: 'vertical',
};
