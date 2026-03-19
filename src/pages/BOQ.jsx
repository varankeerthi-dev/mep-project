import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../supabase';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { 
  Save, FileDown, Plus, Trash2, Sheet, Table, X, Settings, 
  FileSpreadsheet, Loader2, GripVertical, Home, BarChart3,
  Calendar, Percent, Send, AtSign, Paperclip, MessageSquare,
  Edit3, ChevronsLeft, ChevronsRight,
  Search, Filter, ChevronDown, Clock
} from 'lucide-react';
import { openSansRegular, openSansBold } from '../fonts/openSans';
import { saveBOQWithItems, fetchBOQById } from '../api';

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
  { key: 'rowControl', label: '', width: 40, visible: false },
  { key: 'sno', label: 'S.No', width: 50, visible: false },
  { key: 'hsn_sac', label: 'HSN/SAC', width: 90, visible: false },
  { key: 'description', label: 'Description', width: 250, visible: true },
  { key: 'variant', label: 'Variant', width: 100, visible: true },
  { key: 'make', label: 'Make', width: 100, visible: true },
  { key: 'quantity', label: 'Qty', width: 70, visible: true },
  { key: 'unit', label: 'Unit', width: 70, visible: true },
  { key: 'rate', label: 'Price', width: 100, visible: true },
  { key: 'discountPercent', label: 'Disc %', width: 70, visible: true },
  { key: 'rateAfterDiscount', label: 'Rate/Unit', width: 110, visible: true },
  { key: 'totalAmount', label: 'Total Amount', width: 120, visible: true },
  { key: 'specification', label: 'Specification', width: 150, visible: false },
  { key: 'remarks', label: 'Remarks', width: 120, visible: false },
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

export function BOQ() {
  const editId = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('editId');
  }, []);

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
  const [exportOrientation, setExportOrientation] = useState('landscape');
  const [loading, setLoading] = useState(false);
  const [materialSearch, setMaterialSearch] = useState({});
  const [materialSearchActive, setMaterialSearchActive] = useState(null);
  const [dragRowIndex, setDragRowIndex] = useState(null);
  const [dragSheetId, setDragSheetId] = useState(null);
  const [editingSheetId, setEditingSheetId] = useState(null);
  const [editingSheetName, setEditingSheetName] = useState('');
  const [activeRowIndex, setActiveRowIndex] = useState(null);
  const [showDiscountApplyModal, setShowDiscountApplyModal] = useState(false);
  const [pendingDiscountChange, setPendingDiscountChange] = useState(null);
  const [discountApplyMode, setDiscountApplyMode] = useState('skip');
  const [showActivityPanel, setShowActivityPanel] = useState(true);

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

      if (editId) {
        const header = await fetchBOQById(editId);
        if (header) {
          setBoqData(prev => ({
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
            preface: header.preface || prev.preface
          }));

          const loadedSheets = (header.sheets || [])
            .slice()
            .sort((a, b) => (a.sheet_order || 0) - (b.sheet_order || 0))
            .map(s => ({
              id: s.id,
              name: s.sheet_name,
              isDefault: !!s.is_default
            }));
          if (loadedSheets.length > 0) {
            setSheets(loadedSheets);
            setActiveSheetId(loadedSheets[0].id);
          }

          const itemsMap = {};
          (header.sheets || []).forEach(sheet => {
            const rows = (sheet.items || [])
              .slice()
              .sort((a, b) => (a.row_order || 0) - (b.row_order || 0))
              .map(item => ({
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
                description: item.material || ''
              }));
            itemsMap[sheet.id] = rows;
          });
          setItems(itemsMap);
        }
      } else {
        const newBoqNo = await generateBoqNumber();
        setBoqData(prev => ({ ...prev, boqNo: newBoqNo }));
      }
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

  // [PRESERVE ALL EXISTING FUNCTIONS - keeping them exactly as they are]
  // I'll include all the helper functions, handlers, and calculations from the original BOQ.jsx
  
  const fetchClientDiscounts = useCallback(async (clientId) => {
    if (!clientId) return;
    try {
      const { data } = await supabase
        .from('client_discounts')
        .select('discount_type, discount_value')
        .eq('client_id', clientId);
      
      if (data) {
        const discMap = {};
        data.forEach(d => {
          discMap[d.discount_type] = parseFloat(d.discount_value) || 0;
        });
        setClientDiscounts(discMap);
      }
    } catch (error) {
      console.error('Error fetching client discounts:', error);
    }
  }, []);

  const fetchBoqVariantDiscounts = useCallback(async (variantId) => {
    if (!variantId) {
      setBoqVariantDiscounts({});
      return;
    }
    try {
      const { data } = await supabase
        .from('variant_discounts')
        .select('discount_type, discount_value')
        .eq('variant_id', variantId);
      
      if (data) {
        const discMap = {};
        data.forEach(d => {
          discMap[d.discount_type] = parseFloat(d.discount_value) || 0;
        });
        setBoqVariantDiscounts(discMap);
      }
    } catch (error) {
      console.error('Error fetching variant discounts:', error);
    }
  }, []);

  useEffect(() => {
    if (boqData.clientId) {
      fetchClientDiscounts(boqData.clientId);
    }
  }, [boqData.clientId, fetchClientDiscounts]);

  useEffect(() => {
    if (boqData.variantId) {
      fetchBoqVariantDiscounts(boqData.variantId);
    } else {
      setBoqVariantDiscounts({});
    }
  }, [boqData.variantId, fetchBoqVariantDiscounts]);

  const computeEffectiveDiscount = useCallback((row) => {
    if (row.isHeaderRow) return 0;
    if (row.discountPercent !== '' && row.discountPercent !== null && row.discountPercent !== undefined) {
      return parseFloat(row.discountPercent) || 0;
    }

    const mat = materials.find(m => m.id === row.itemId);
    if (!mat) return 0;

    let variantDisc = 0;
    if (row.variantId && variants.length > 0) {
      const vari = variants.find(v => v.id === row.variantId);
      if (vari) {
        const discKey = vari.variant_name;
        variantDisc = boqVariantDiscounts[discKey] || 0;
      }
    } else if (!row.variantId && boqData.variantId && variants.length > 0) {
      const defaultVar = variants.find(v => v.id === boqData.variantId);
      if (defaultVar) {
        const discKey = defaultVar.variant_name;
        variantDisc = boqVariantDiscounts[discKey] || 0;
      }
    }

    const makeDisc = clientDiscounts[row.make] || 0;
    return variantDisc + makeDisc;
  }, [materials, variants, boqVariantDiscounts, clientDiscounts, boqData.variantId]);

  const addBlankRow = useCallback(() => {
    setItems(prev => {
      const currentItems = prev[activeSheetId] || [];
      return {
        ...prev,
        [activeSheetId]: [
          ...currentItems,
          {
            id: generateId(),
            isHeaderRow: false,
            itemId: '',
            variantId: '',
            variantName: '',
            make: '',
            quantity: '',
            rate: '',
            discountPercent: '',
            hsn_sac: '',
            unit: '',
            specification: '',
            remarks: '',
            pressure: '',
            thickness: '',
            schedule: '',
            material: '',
            description: ''
          }
        ]
      };
    });
  }, [activeSheetId]);

  const addHeaderRow = useCallback(() => {
    setItems(prev => {
      const currentItems = prev[activeSheetId] || [];
      return {
        ...prev,
        [activeSheetId]: [
          ...currentItems,
          {
            id: generateId(),
            isHeaderRow: true,
            headerText: 'SECTION HEADER'
          }
        ]
      };
    });
  }, [activeSheetId]);

  const deleteRow = useCallback((index) => {
    setItems(prev => {
      const currentItems = prev[activeSheetId] || [];
      return {
        ...prev,
        [activeSheetId]: currentItems.filter((_, i) => i !== index)
      };
    });
  }, [activeSheetId]);

  const updateRow = useCallback((index, field, value) => {
    setItems(prev => {
      const currentItems = [...(prev[activeSheetId] || [])];
      if (!currentItems[index]) return prev;
      
      currentItems[index] = {
        ...currentItems[index],
        [field]: value
      };

      if (field === 'itemId') {
        const mat = materials.find(m => m.id === value);
        if (mat) {
          currentItems[index] = {
            ...currentItems[index],
            description: mat.name || '',
            material: mat.name || '',
            unit: mat.unit || '',
            hsn_sac: mat.hsn_code || '',
            rate: mat.sale_price || '',
            variantId: '',
            variantName: ''
          };
        }
      }

      return {
        ...prev,
        [activeSheetId]: currentItems
      };
    });
  }, [activeSheetId, materials]);

  const handleVariantChange = useCallback((index, newVariantId) => {
    const currentItems = items[activeSheetId] || [];
    const row = currentItems[index];
    
    if (row.discountPercent !== '' && row.discountPercent !== null && row.discountPercent !== undefined) {
      setPendingDiscountChange({ index, newVariantId });
      setShowDiscountApplyModal(true);
    } else {
      updateRow(index, 'variantId', newVariantId);
    }
  }, [items, activeSheetId, updateRow]);

  const applyDiscountDecision = useCallback(() => {
    if (!pendingDiscountChange) return;
    
    const { index, newVariantId } = pendingDiscountChange;
    
    if (discountApplyMode === 'override') {
      updateRow(index, 'variantId', newVariantId);
      updateRow(index, 'discountPercent', '');
    } else {
      updateRow(index, 'variantId', newVariantId);
    }
    
    setShowDiscountApplyModal(false);
    setPendingDiscountChange(null);
    setDiscountApplyMode('skip');
  }, [pendingDiscountChange, discountApplyMode, updateRow]);

  const handleDefaultVariantChange = useCallback((newVariantId) => {
    const currentItems = items[activeSheetId] || [];
    const hasOverrides = currentItems.some(r => 
      !r.isHeaderRow && r.discountPercent !== '' && r.discountPercent !== null && r.discountPercent !== undefined
    );

    if (hasOverrides) {
      const shouldProceed = window.confirm(
        'Some items have custom discount overrides. Changing the default variant will not affect these items. Continue?'
      );
      if (!shouldProceed) return;
    }

    setBoqData(prev => ({ ...prev, variantId: newVariantId }));
  }, [items, activeSheetId]);

  const handleSave = async () => {
    if (!boqData.boqNo) {
      alert('Please enter BOQ Number');
      return;
    }

    setLoading(true);
    try {
      const allSheetItems = sheets.map((sheet, sheetIdx) => ({
        sheetId: sheet.id.startsWith('temp-') ? null : sheet.id,
        sheetName: sheet.name,
        sheetOrder: sheetIdx,
        isDefault: sheet.isDefault,
        items: (items[sheet.id] || []).map((row, rowIdx) => ({
          itemId: row.id?.startsWith('temp-') ? null : row.id,
          rowOrder: rowIdx,
          isHeaderRow: row.isHeaderRow || false,
          headerText: row.isHeaderRow ? row.headerText : null,
          item_id: row.isHeaderRow ? null : row.itemId || null,
          variant_id: row.isHeaderRow ? null : row.variantId || null,
          make: row.isHeaderRow ? null : row.make || null,
          quantity: row.isHeaderRow ? null : parseFloat(row.quantity) || 0,
          rate: row.isHeaderRow ? null : parseFloat(row.rate) || 0,
          discount_percent: row.isHeaderRow ? null : 
            (row.discountPercent !== '' && row.discountPercent !== null && row.discountPercent !== undefined 
              ? parseFloat(row.discountPercent) 
              : null),
          specification: row.isHeaderRow ? null : row.specification || null,
          remarks: row.isHeaderRow ? null : row.remarks || null,
          pressure: row.isHeaderRow ? null : row.pressure || null,
          thickness: row.isHeaderRow ? null : row.thickness || null,
          schedule: row.isHeaderRow ? null : row.schedule || null,
          material: row.isHeaderRow ? null : row.material || null,
        }))
      }));

      const result = await saveBOQWithItems({
        boqId: boqData.id?.startsWith?.('temp-') ? null : boqData.id,
        boq_no: boqData.boqNo,
        revision_no: boqData.revisionNo || 1,
        boq_date: boqData.date,
        client_id: boqData.clientId || null,
        project_id: boqData.projectId || null,
        variant_id: boqData.variantId || null,
        status: boqData.status,
        terms_conditions: boqData.termsConditions || null,
        preface: boqData.preface || null,
        sheets: allSheetItems
      });

      if (result.success) {
        alert('BOQ saved successfully!');
        if (result.data?.id) {
          setBoqData(prev => ({ ...prev, id: result.data.id }));
        }
      } else {
        alert('Error saving BOQ: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('Error saving BOQ');
    }
    setLoading(false);
  };

  const exportToPDF = () => {
    const doc = new jsPDF({
      orientation: exportOrientation,
      unit: 'mm',
      format: 'a4'
    });

    doc.addFileToVFS('OpenSans-Regular.ttf', openSansRegular);
    doc.addFileToVFS('OpenSans-Bold.ttf', openSansBold);
    doc.addFont('OpenSans-Regular.ttf', 'OpenSans', 'normal');
    doc.addFont('OpenSans-Bold.ttf', 'OpenSans', 'bold');
    doc.setFont('OpenSans');

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginLeft = 10;
    const marginTop = 15;

    const addCompanyHeader = () => {
      doc.setFontSize(16);
      doc.setFont('OpenSans', 'bold');
      doc.text('ExcelCollab BOQ', marginLeft, marginTop);
      
      doc.setFontSize(9);
      doc.setFont('OpenSans', 'normal');
      let yPos = marginTop + 6;
      
      if (boqData.boqNo) {
        doc.text(`BOQ No: ${boqData.boqNo}`, marginLeft, yPos);
        yPos += 4;
      }
      if (boqData.revisionNo) {
        doc.text(`Rev: ${boqData.revisionNo}`, marginLeft, yPos);
        yPos += 4;
      }
      if (boqData.date) {
        doc.text(`Date: ${boqData.date}`, marginLeft, yPos);
        yPos += 4;
      }
      
      const clientName = clients.find(c => c.id === boqData.clientId)?.client_name;
      if (clientName) {
        doc.text(`Client: ${clientName}`, marginLeft, yPos);
        yPos += 4;
      }
      
      const projectName = projects.find(p => p.id === boqData.projectId)?.project_name;
      if (projectName) {
        doc.text(`Project: ${projectName}`, marginLeft, yPos);
        yPos += 4;
      }

      return yPos + 3;
    };

    let isFirstPage = true;
    sheets.forEach((sheet, sheetIndex) => {
      if (!exportSheets[sheet.id]) return;

      const sheetItems = items[sheet.id] || [];
      if (sheetItems.length === 0 && sheet.isDefault) return;

      if (isFirstPage) {
        isFirstPage = false;
      } else {
        doc.addPage();
      }

      const startY = addCompanyHeader();

      doc.setFontSize(12);
      doc.setFont('OpenSans', 'bold');
      doc.text(sheet.name, marginLeft, startY + 2);

      if (sheet.name === 'Terms' && boqData.termsConditions) {
        doc.setFontSize(9);
        doc.setFont('OpenSans', 'normal');
        const lines = doc.splitTextToSize(boqData.termsConditions, pageWidth - 2 * marginLeft);
        doc.text(lines, marginLeft, startY + 8);
        return;
      }

      if (sheet.name === 'Preface' && boqData.preface) {
        doc.setFontSize(9);
        doc.setFont('OpenSans', 'normal');
        const lines = doc.splitTextToSize(boqData.preface, pageWidth - 2 * marginLeft);
        doc.text(lines, marginLeft, startY + 8);
        return;
      }

      if (!sheet.isDefault || sheetItems.length === 0) return;

      const visibleCols = columnSettings.filter(c => 
        c.visible && 
        exportColumns[c.key] && 
        c.key !== 'rowControl'
      );

      const tableData = [];
      let snoCounter = 1;

      sheetItems.forEach(row => {
        if (row.isHeaderRow) {
          const headerRow = visibleCols.map(col => 
            col.key === 'description' ? row.headerText : ''
          );
          tableData.push(headerRow);
        } else {
          const dataRow = visibleCols.map(col => {
            if (col.key === 'sno') return String(snoCounter++);
            if (col.key === 'description') return row.description || '';
            if (col.key === 'variant') return row.variantName || '';
            if (col.key === 'make') return row.make || '';
            if (col.key === 'quantity') return row.quantity || '';
            if (col.key === 'unit') return row.unit || '';
            if (col.key === 'rate') return row.rate || '';
            if (col.key === 'hsn_sac') return row.hsn_sac || '';
            if (col.key === 'discountPercent') {
              const eff = computeEffectiveDiscount(row);
              return eff ? `${eff.toFixed(2)}%` : '';
            }
            if (col.key === 'rateAfterDiscount') {
              const r = parseFloat(row.rate) || 0;
              const disc = computeEffectiveDiscount(row);
              return r > 0 ? (r * (1 - disc / 100)).toFixed(2) : '';
            }
            if (col.key === 'totalAmount') {
              const q = parseFloat(row.quantity) || 0;
              const r = parseFloat(row.rate) || 0;
              const disc = computeEffectiveDiscount(row);
              return (q * r * (1 - disc / 100)).toFixed(2);
            }
            if (col.key === 'specification') return row.specification || '';
            if (col.key === 'remarks') return row.remarks || '';
            if (col.key === 'pressure') return row.pressure || '';
            if (col.key === 'thickness') return row.thickness || '';
            if (col.key === 'schedule') return row.schedule || '';
            if (col.key === 'material') return row.material || '';
            return '';
          });
          tableData.push(dataRow);
        }
      });

      autoTable(doc, {
        head: [visibleCols.map(c => c.label)],
        body: tableData,
        startY: startY + 6,
        styles: {
          font: 'OpenSans',
          fontSize: 8,
          cellPadding: 2,
        },
        headStyles: {
          fillColor: [33, 115, 70],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245],
        },
        margin: { left: marginLeft, right: marginLeft },
      });
    });

    doc.save(`${boqData.boqNo || 'BOQ'}.pdf`);
  };

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    sheets.forEach(sheet => {
      if (!exportSheets[sheet.id]) return;

      const sheetItems = items[sheet.id] || [];

      if (sheet.name === 'Terms' && boqData.termsConditions) {
        const ws = XLSX.utils.aoa_to_sheet([[boqData.termsConditions]]);
        XLSX.utils.book_append_sheet(wb, ws, sheet.name);
        return;
      }

      if (sheet.name === 'Preface' && boqData.preface) {
        const ws = XLSX.utils.aoa_to_sheet([[boqData.preface]]);
        XLSX.utils.book_append_sheet(wb, ws, sheet.name);
        return;
      }

      if (!sheet.isDefault || sheetItems.length === 0) return;

      const visibleCols = columnSettings.filter(c => 
        c.visible && 
        exportColumns[c.key] && 
        c.key !== 'rowControl'
      );

      const headers = visibleCols.map(c => c.label);
      const data = [headers];

      let snoCounter = 1;

      sheetItems.forEach(row => {
        if (row.isHeaderRow) {
          const headerRow = visibleCols.map(col => 
            col.key === 'description' ? row.headerText : ''
          );
          data.push(headerRow);
        } else {
          const dataRow = visibleCols.map(col => {
            if (col.key === 'sno') return snoCounter++;
            if (col.key === 'description') return row.description || '';
            if (col.key === 'variant') return row.variantName || '';
            if (col.key === 'make') return row.make || '';
            if (col.key === 'quantity') return row.quantity || '';
            if (col.key === 'unit') return row.unit || '';
            if (col.key === 'rate') return row.rate || '';
            if (col.key === 'hsn_sac') return row.hsn_sac || '';
            if (col.key === 'discountPercent') {
              const eff = computeEffectiveDiscount(row);
              return eff || '';
            }
            if (col.key === 'rateAfterDiscount') {
              const r = parseFloat(row.rate) || 0;
              const disc = computeEffectiveDiscount(row);
              return r > 0 ? (r * (1 - disc / 100)).toFixed(2) : '';
            }
            if (col.key === 'totalAmount') {
              const q = parseFloat(row.quantity) || 0;
              const r = parseFloat(row.rate) || 0;
              const disc = computeEffectiveDiscount(row);
              return (q * r * (1 - disc / 100)).toFixed(2);
            }
            if (col.key === 'specification') return row.specification || '';
            if (col.key === 'remarks') return row.remarks || '';
            if (col.key === 'pressure') return row.pressure || '';
            if (col.key === 'thickness') return row.thickness || '';
            if (col.key === 'schedule') return row.schedule || '';
            if (col.key === 'material') return row.material || '';
            return '';
          });
          data.push(dataRow);
        }
      });

      const ws = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, sheet.name);
    });

    XLSX.writeFile(wb, `${boqData.boqNo || 'BOQ'}.xlsx`);
  };

  const toggleColumnVisibility = (key) => {
    setColumnSettings(prev => 
      prev.map(c => c.key === key ? { ...c, visible: !c.visible } : c)
    );
  };

  const addNewSheet = () => {
    const newSheet = {
      id: generateId(),
      name: `Sheet ${sheets.length + 1}`,
      isDefault: false
    };
    setSheets(prev => [...prev, newSheet]);
    setActiveSheetId(newSheet.id);
  };

  const deleteSheet = (sheetId) => {
    if (sheets.length === 1) {
      alert('Cannot delete the last sheet');
      return;
    }
    const confirmed = window.confirm('Are you sure you want to delete this sheet?');
    if (!confirmed) return;

    setSheets(prev => prev.filter(s => s.id !== sheetId));
    setItems(prev => {
      const updated = { ...prev };
      delete updated[sheetId];
      return updated;
    });

    if (activeSheetId === sheetId) {
      const remaining = sheets.filter(s => s.id !== sheetId);
      if (remaining.length > 0) {
        setActiveSheetId(remaining[0].id);
      }
    }
  };

  const renameSheet = (sheetId, newName) => {
    setSheets(prev => 
      prev.map(s => s.id === sheetId ? { ...s, name: newName } : s)
    );
  };

  const handleSheetDragStart = (e, sheetId) => {
    setDragSheetId(sheetId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleSheetDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleSheetDrop = (e, targetSheetId) => {
    e.preventDefault();
    if (!dragSheetId || dragSheetId === targetSheetId) return;

    setSheets(prev => {
      const dragIndex = prev.findIndex(s => s.id === dragSheetId);
      const targetIndex = prev.findIndex(s => s.id === targetSheetId);
      if (dragIndex === -1 || targetIndex === -1) return prev;

      const newSheets = [...prev];
      const [draggedSheet] = newSheets.splice(dragIndex, 1);
      newSheets.splice(targetIndex, 0, draggedSheet);
      return newSheets;
    });

    setDragSheetId(null);
  };

  const handleRowDragStart = (e, index) => {
    setDragRowIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleRowDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleRowDrop = (e, targetIndex) => {
    e.preventDefault();
    if (dragRowIndex === null || dragRowIndex === targetIndex) return;

    setItems(prev => {
      const currentItems = [...(prev[activeSheetId] || [])];
      const [draggedRow] = currentItems.splice(dragRowIndex, 1);
      currentItems.splice(targetIndex, 0, draggedRow);

      return {
        ...prev,
        [activeSheetId]: currentItems
      };
    });

    setDragRowIndex(null);
  };

  const handleMaterialSearch = (index, searchTerm) => {
    setMaterialSearch(prev => ({
      ...prev,
      [index]: searchTerm
    }));
    setMaterialSearchActive(index);

    if (!searchTerm) {
      setMaterialSearchActive(null);
    }
  };

  const selectMaterial = (index, material) => {
    updateRow(index, 'itemId', material.id);
    setMaterialSearch(prev => {
      const updated = { ...prev };
      delete updated[index];
      return updated;
    });
    setMaterialSearchActive(null);
  };

  const filteredMaterials = (index) => {
    const searchTerm = materialSearch[index] || '';
    if (!searchTerm) return [];
    
    return materials.filter(m =>
      m.name?.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 10);
  };

  const handleKeyDown = (e, rowIndex, colKey) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const currentItems = items[activeSheetId] || [];
      if (rowIndex === currentItems.length - 1) {
        addBlankRow();
      }
    }
  };

  const currentSheetItems = items[activeSheetId] || [];
  const activeSheet = sheets.find(s => s.id === activeSheetId);
  
  const subtotal = currentSheetItems.reduce((sum, row) => {
    if (row.isHeaderRow) return sum;
    const q = parseFloat(row.quantity) || 0;
    const r = parseFloat(row.rate) || 0;
    const disc = computeEffectiveDiscount(row);
    return sum + (q * r * (1 - disc / 100));
  }, 0);

  const tax = subtotal * 0.10;
  const grandTotal = subtotal + tax;

  const selectedClientName = clients.find(c => c.id === boqData.clientId)?.client_name || '';
  const selectedProjectName = projects.find(p => p.id === boqData.projectId)?.project_name || '';
  const selectedVariantName = variants.find(v => v.id === boqData.variantId)?.variant_name || '';

  // Discount types for display
  const discountTypes = ['Erection', 'Blue', 'Orange', 'Yellow', 'Pink'];
  const visibleColumns = useMemo(
    () => columnSettings.filter(c => c.visible && c.key !== 'rowControl' && c.key !== 'sno'),
    [columnSettings]
  );
  const discountEntries = useMemo(() => {
    const entries = Object.entries(boqVariantDiscounts || {});
    if (entries.length > 0) return entries;
    return discountTypes.map(type => [type, 0]);
  }, [boqVariantDiscounts, discountTypes]);

  const getHeaderClass = (key) => {
    switch (key) {
      case 'description': return 'text-left px-3';
      case 'variant': return 'w-32 text-left px-3';
      case 'make': return 'w-32 text-left px-3';
      case 'quantity': return 'w-20 text-center px-3';
      case 'unit': return 'w-20 text-center px-3';
      case 'rate': return 'w-28 text-right px-3';
      case 'discountPercent': return 'w-20 text-right px-3';
      case 'rateAfterDiscount': return 'w-28 text-right px-3 bg-blue-50/50';
      case 'totalAmount': return 'w-32 text-right px-3';
      default: return 'text-left px-3';
    }
  };

  const getCellClass = (key) => {
    switch (key) {
      case 'quantity': return 'text-center';
      case 'unit': return 'text-center uppercase';
      case 'rate': return 'text-right';
      case 'discountPercent': return 'text-right';
      case 'rateAfterDiscount': return 'text-right bg-blue-50/30 italic text-slate-500';
      case 'totalAmount': return 'text-right bg-slate-50/50 text-slate-900 font-medium';
      default: return 'text-left';
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="bg-slate-100 text-slate-900 h-screen overflow-hidden flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-12 bg-slate-50 border-r border-slate-200 flex flex-col items-center py-4 space-y-6 flex-shrink-0">
          <Home className="w-5 h-5 text-slate-400 cursor-pointer hover:text-slate-600" />
          <Table className="w-5 h-5 text-slate-400 cursor-pointer hover:text-slate-600" />
          <BarChart3 className="w-5 h-5 text-slate-400 cursor-pointer hover:text-slate-600" />
          <div className="flex-1"></div>
          <Settings className="w-5 h-5 text-slate-400 cursor-pointer hover:text-slate-600" onClick={() => setShowColumnPanel(!showColumnPanel)} />
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 bg-white">
          {/* Header Section */}
          <div className="px-4 py-2 bg-white border-b border-slate-200 flex-shrink-0">
            <div className="flex flex-col space-y-2">
              {/* Row 1: Key Project Info */}
              <div className="flex items-end space-x-4">
                <div className="flex flex-col space-y-0.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">BOQ No</label>
                  <input
                    className="text-xs border-slate-300 rounded focus:ring-green-500 focus:border-green-500 py-1 w-28"
                    type="text"
                    maxLength={10}
                    value={boqData.boqNo}
                    onChange={(e) => setBoqData(prev => ({ ...prev, boqNo: e.target.value }))}
                  />
                </div>

                <div className="flex flex-col space-y-0.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Rev</label>
                  <input
                    className="text-xs border-slate-300 rounded focus:ring-green-500 focus:border-green-500 py-1 w-12 text-center"
                    type="text"
                    maxLength={3}
                    value={boqData.revisionNo}
                    onChange={(e) => setBoqData(prev => ({ ...prev, revisionNo: e.target.value }))}
                  />
                </div>

                <div className="flex flex-col space-y-0.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Date</label>
                  <div className="relative w-32">
                    <input
                      className="text-xs border-slate-300 rounded focus:ring-green-500 focus:border-green-500 py-1 w-full pr-7"
                      type="date"
                      value={boqData.date}
                      onChange={(e) => setBoqData(prev => ({ ...prev, date: e.target.value }))}
                    />
                    <Calendar className="absolute right-1.5 top-1.5 text-slate-400 w-4 h-4 pointer-events-none" />
                  </div>
                </div>

                <div className="flex flex-col space-y-0.5 flex-1 min-w-0">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Client</label>
                  <select
                    className="text-xs border-slate-300 rounded focus:ring-green-500 focus:border-green-500 py-1 w-full"
                    value={boqData.clientId}
                    onChange={(e) => setBoqData(prev => ({ ...prev, clientId: e.target.value }))}
                  >
                    <option value="">Select Client</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>{client.client_name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col space-y-0.5 flex-1 min-w-0">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Project</label>
                  <select
                    className="text-xs border-slate-300 rounded focus:ring-green-500 focus:border-green-500 py-1 w-full"
                    value={boqData.projectId}
                    onChange={(e) => setBoqData(prev => ({ ...prev, projectId: e.target.value }))}
                  >
                    <option value="">Select Project</option>
                    {projects.map(project => (
                      <option key={project.id} value={project.id}>{project.project_name}</option>
                    ))}
                  </select>
                </div>

              </div>

              {/* Row 2: Discount Profile */}
              <div className="flex items-center space-x-4 bg-slate-50/80 p-1.5 rounded border border-slate-100">
                <div className="flex items-center space-x-2 border-r border-slate-200 pr-4">
                  <Percent className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">Profile</span>
                </div>

                <div className="flex flex-col space-y-0.5">
                  <select
                    className="text-xs border-slate-300 bg-white rounded focus:ring-green-500 focus:border-green-500 py-0.5"
                    value={boqData.variantId}
                    onChange={(e) => handleDefaultVariantChange(e.target.value)}
                  >
                    <option value="">Select Variant</option>
                    {variants.map(variant => (
                      <option key={variant.id} value={variant.id}>{variant.variant_name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex-1 flex items-center space-x-2 overflow-x-auto">
                  {discountEntries.map(([type, value]) => (
                    <div key={type} className="flex items-center bg-white border border-slate-200 rounded px-1.5 py-0.5 space-x-1 shadow-sm">
                      <span className="text-[10px] font-medium text-slate-600">{type}</span>
                      <input
                        className="w-8 text-[10px] border-slate-300 rounded p-0 text-center focus:ring-green-500 focus:border-green-500"
                        type="text"
                        value={value ?? '0'}
                        readOnly
                      />
                      <span className="text-[9px] text-slate-400">%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Sheet Tabs Bar */}
          <div className="h-8 bg-slate-50 border-b border-slate-200 flex items-center flex-shrink-0">
            <div className="flex h-full border-r border-slate-200">
              {sheets.map(sheet => (
                <div
                  key={sheet.id}
                  draggable
                  onDragStart={(e) => handleSheetDragStart(e, sheet.id)}
                  onDragOver={handleSheetDragOver}
                  onDrop={(e) => handleSheetDrop(e, sheet.id)}
                  className={`group flex items-center px-3 py-1 text-[11px] font-medium cursor-pointer border-r border-slate-200 hover:bg-slate-100 transition relative ${
                    activeSheetId === sheet.id ? 'bg-white text-green-700 font-bold border-b-2 border-b-green-600' : ''
                  }`}
                  onClick={() => setActiveSheetId(sheet.id)}
                >
                  <GripVertical className="w-3 h-3 opacity-0 group-hover:opacity-40 mr-1" />
                  {editingSheetId === sheet.id ? (
                    <input
                      type="text"
                      value={editingSheetName}
                      onChange={(e) => setEditingSheetName(e.target.value)}
                      onBlur={() => {
                        renameSheet(sheet.id, editingSheetName);
                        setEditingSheetId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          renameSheet(sheet.id, editingSheetName);
                          setEditingSheetId(null);
                        }
                      }}
                      className="text-[11px] px-1 py-0 border border-green-500 rounded"
                      autoFocus
                    />
                  ) : (
                    <span
                      onDoubleClick={() => {
                        setEditingSheetId(sheet.id);
                        setEditingSheetName(sheet.name);
                      }}
                    >
                      {sheet.name}
                    </span>
                  )}
                  {sheets.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSheet(sheet.id);
                      }}
                      className="ml-2 p-1 opacity-0 group-hover:opacity-100 hover:bg-red-100 rounded"
                    >
                      <X className="w-3 h-3 text-red-600" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={addNewSheet}
              className="px-2 hover:bg-slate-200 h-full transition flex items-center justify-center"
              title="Add new sheet"
            >
              <Plus className="w-4 h-4 text-slate-500" />
            </button>
          </div>

          {/* Toolbar Row */}
          <div className="h-10 border-b border-slate-200 flex items-center px-4 bg-slate-50 space-x-4 flex-shrink-0">
            <div className="flex items-center space-x-2 border-r border-slate-300 pr-4">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                className="bg-transparent border-none text-xs focus:ring-0 w-48"
                placeholder="Find in sheet..."
                type="text"
              />
            </div>
            <div className="flex items-center space-x-3">
              <button className="flex items-center space-x-1 text-slate-600 hover:text-slate-900 text-xs font-medium">
                <Filter className="w-4 h-4" />
                <span>Filters</span>
              </button>
              <button
                onClick={addBlankRow}
                className="flex items-center space-x-1 text-slate-600 hover:text-slate-900 text-xs font-medium"
              >
                <Plus className="w-4 h-4" />
                <span>New Row</span>
              </button>
              <button className="flex items-center space-x-1 text-slate-600 hover:text-slate-900 text-xs font-medium">
                <Clock className="w-4 h-4" />
                <span>History</span>
              </button>
            </div>
            <div className="flex-1"></div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowColumnPanel(true)}
                className="p-1.5 text-slate-500 hover:bg-slate-200 rounded transition"
                title="Columns"
              >
                <Settings className="w-4 h-4" />
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="flex items-center space-x-1.5 px-3 py-1 border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  <FileDown className="w-4 h-4" />
                  <span>Export</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-md shadow-lg py-1 z-30">
                    <button
                      onClick={() => { exportToPDF(); setShowExportMenu(false); }}
                      className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>Export PDF</span>
                    </button>
                    <button
                      onClick={() => { exportToExcel(); setShowExportMenu(false); }}
                      className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2"
                    >
                      <Sheet className="w-4 h-4" />
                      <span>Export Excel</span>
                    </button>
                    <div className="border-t border-slate-100 my-1"></div>
                    <button
                      onClick={() => { setShowExportSettings(true); setShowExportMenu(false); }}
                      className="w-full text-left px-4 py-2 text-xs text-slate-500 hover:bg-slate-50 flex items-center space-x-2"
                    >
                      <Settings className="w-4 h-4" />
                      <span>Export Settings...</span>
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={handleSave}
                className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-semibold flex items-center space-x-1 hover:bg-blue-700 transition"
                disabled={loading}
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save BOQ</span>
              </button>
            </div>
          </div>

          {/* Excel Grid */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-[13px] border-collapse min-w-[1200px]">
              <thead className="sticky top-0 z-20">
                <tr className="h-9">
                  <th className="w-10 text-center text-[10px] uppercase bg-slate-100 text-slate-500 border border-slate-200">No.</th>
                  {visibleColumns.map(col => (
                    <th
                      key={col.key}
                      className={`border border-slate-200 bg-slate-100 text-slate-600 font-medium ${getHeaderClass(col.key)}`}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {currentSheetItems.map((row, rowIndex) => {
                  if (row.isHeaderRow) {
                    return (
                      <tr
                        key={row.id}
                        className="h-10 bg-blue-50/20"
                        draggable
                        onDragStart={(e) => handleRowDragStart(e, rowIndex)}
                        onDragOver={handleRowDragOver}
                        onDrop={(e) => handleRowDrop(e, rowIndex)}
                      >
                        <td className="text-center text-slate-400 bg-slate-50 font-mono text-[11px] border border-slate-200">
                          {rowIndex + 1}
                        </td>
                        <td
                          colSpan={visibleColumns.length}
                          className="border border-slate-200 bg-blue-50/30 px-3"
                        >
                          <input
                            type="text"
                            value={row.headerText}
                            onChange={(e) => updateRow(rowIndex, 'headerText', e.target.value)}
                            className="w-full bg-transparent border-none focus:ring-1 focus:ring-green-600 text-[13px] font-semibold text-slate-700"
                            placeholder="Section Header"
                          />
                        </td>
                      </tr>
                    );
                  }

                  const effectiveDisc = computeEffectiveDiscount(row);
                  const rateNum = parseFloat(row.rate) || 0;
                  const qtyNum = parseFloat(row.quantity) || 0;
                  const rateAfterDisc = rateNum * (1 - effectiveDisc / 100);
                  const totalAmt = qtyNum * rateAfterDisc;
                  const hasOverride = row.discountPercent !== '' && row.discountPercent !== null && row.discountPercent !== undefined;
                  const hasComment = !!row.remarks;

                  return (
                    <tr
                      key={row.id}
                      className="h-10 hover:bg-slate-50 group"
                      draggable
                      onDragStart={(e) => handleRowDragStart(e, rowIndex)}
                      onDragOver={handleRowDragOver}
                      onDrop={(e) => handleRowDrop(e, rowIndex)}
                    >
                      <td className="text-center text-slate-400 bg-slate-50 font-mono text-[11px] border border-slate-200">
                        <div className="flex items-center justify-center space-x-1">
                          <GripVertical className="w-3 h-3 opacity-0 group-hover:opacity-40" />
                          <span>{rowIndex + 1}</span>
                          <button
                            onClick={() => deleteRow(rowIndex)}
                            className="ml-1 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>

                      {visibleColumns.map(col => {
                        const cellClass = `px-2 border border-slate-200 ${getCellClass(col.key)}`;

                        if (col.key === 'description') {
                          return (
                            <td key={col.key} className={`${cellClass} relative`}>
                              {hasComment && (
                                <span
                                  className="absolute top-0 right-0 w-0 h-0"
                                  style={{
                                    borderStyle: 'solid',
                                    borderWidth: '0 8px 8px 0',
                                    borderColor: 'transparent #ef4444 transparent transparent',
                                  }}
                                />
                              )}
                              <input
                                type="text"
                                value={row.description || ''}
                                onChange={(e) => {
                                  handleMaterialSearch(rowIndex, e.target.value);
                                  updateRow(rowIndex, 'description', e.target.value);
                                }}
                                onKeyDown={(e) => handleKeyDown(e, rowIndex, col.key)}
                                className="w-full bg-transparent border-none focus:ring-1 focus:ring-green-600 text-[13px]"
                                placeholder="Enter item description..."
                              />
                              {materialSearchActive === rowIndex && filteredMaterials(rowIndex).length > 0 && (
                                <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded shadow-lg max-h-52 overflow-y-auto z-30">
                                  {filteredMaterials(rowIndex).map(mat => (
                                    <div
                                      key={mat.id}
                                      onClick={() => selectMaterial(rowIndex, mat)}
                                      className="px-3 py-2 text-[13px] cursor-pointer hover:bg-slate-50 border-b border-slate-100"
                                    >
                                      {mat.name}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          );
                        }

                        if (col.key === 'variant') {
                          return (
                            <td key={col.key} className={cellClass}>
                              <select
                                value={row.variantId || ''}
                                onChange={(e) => handleVariantChange(rowIndex, e.target.value)}
                                className="w-full bg-transparent border-none focus:ring-1 focus:ring-green-600 text-[13px] py-0"
                              >
                                <option value="">-</option>
                                {variants.map(v => (
                                  <option key={v.id} value={v.id}>{v.variant_name}</option>
                                ))}
                              </select>
                            </td>
                          );
                        }

                        if (col.key === 'make') {
                          return (
                            <td key={col.key} className={cellClass}>
                              <select
                                value={row.make || ''}
                                onChange={(e) => updateRow(rowIndex, 'make', e.target.value)}
                                className="w-full bg-transparent border-none focus:ring-1 focus:ring-green-600 text-[13px] py-0"
                              >
                                <option value="">Select Make</option>
                                {makes.map(make => (
                                  <option key={make} value={make}>{make}</option>
                                ))}
                              </select>
                            </td>
                          );
                        }

                        if (col.key === 'quantity') {
                          return (
                            <td key={col.key} className={cellClass}>
                              <input
                                type="number"
                                value={row.quantity || ''}
                                onChange={(e) => updateRow(rowIndex, 'quantity', e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, rowIndex, col.key)}
                                className="w-full bg-transparent border-none focus:ring-1 focus:ring-green-600 text-[13px] text-center"
                              />
                            </td>
                          );
                        }

                        if (col.key === 'unit') {
                          return (
                            <td key={col.key} className={cellClass}>
                              <input
                                type="text"
                                value={row.unit || ''}
                                onChange={(e) => updateRow(rowIndex, 'unit', e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, rowIndex, col.key)}
                                className="w-full bg-transparent border-none focus:ring-1 focus:ring-green-600 text-[13px] text-center uppercase"
                              />
                            </td>
                          );
                        }

                        if (col.key === 'rate') {
                          return (
                            <td key={col.key} className={cellClass}>
                              <input
                                type="number"
                                value={row.rate || ''}
                                onChange={(e) => updateRow(rowIndex, 'rate', e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, rowIndex, col.key)}
                                className="w-full bg-transparent border-none focus:ring-1 focus:ring-green-600 text-[13px] text-right"
                              />
                            </td>
                          );
                        }

                        if (col.key === 'discountPercent') {
                          return (
                            <td key={col.key} className={`${cellClass} relative`}>
                              {hasOverride && (
                                <span
                                  className="absolute top-0 right-0 w-0 h-0"
                                  style={{
                                    borderStyle: 'solid',
                                    borderWidth: '0 8px 8px 0',
                                    borderColor: 'transparent #f59e0b transparent transparent',
                                  }}
                                />
                              )}
                              <input
                                type="number"
                                value={row.discountPercent || ''}
                                onChange={(e) => updateRow(rowIndex, 'discountPercent', e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, rowIndex, col.key)}
                                className="w-full bg-transparent border-none focus:ring-1 focus:ring-green-600 text-[13px] text-right"
                              />
                            </td>
                          );
                        }

                        if (col.key === 'rateAfterDiscount') {
                          return (
                            <td key={col.key} className={cellClass}>
                              {rateAfterDisc ? rateAfterDisc.toFixed(2) : ''}
                            </td>
                          );
                        }

                        if (col.key === 'totalAmount') {
                          return (
                            <td key={col.key} className={cellClass}>
                              {totalAmt ? totalAmt.toFixed(2) : ''}
                            </td>
                          );
                        }

                        if (col.key === 'hsn_sac') {
                          return (
                            <td key={col.key} className={cellClass}>
                              <input
                                type="text"
                                value={row.hsn_sac || ''}
                                onChange={(e) => updateRow(rowIndex, 'hsn_sac', e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, rowIndex, col.key)}
                                className="w-full bg-transparent border-none focus:ring-1 focus:ring-green-600 text-[13px]"
                              />
                            </td>
                          );
                        }

                        if (col.key === 'specification') {
                          return (
                            <td key={col.key} className={cellClass}>
                              <input
                                type="text"
                                value={row.specification || ''}
                                onChange={(e) => updateRow(rowIndex, 'specification', e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, rowIndex, col.key)}
                                className="w-full bg-transparent border-none focus:ring-1 focus:ring-green-600 text-[13px]"
                              />
                            </td>
                          );
                        }

                        if (col.key === 'remarks') {
                          return (
                            <td key={col.key} className={cellClass}>
                              <input
                                type="text"
                                value={row.remarks || ''}
                                onChange={(e) => updateRow(rowIndex, 'remarks', e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, rowIndex, col.key)}
                                className="w-full bg-transparent border-none focus:ring-1 focus:ring-green-600 text-[13px]"
                              />
                            </td>
                          );
                        }

                        if (col.key === 'pressure') {
                          return (
                            <td key={col.key} className={cellClass}>
                              <input
                                type="text"
                                value={row.pressure || ''}
                                onChange={(e) => updateRow(rowIndex, 'pressure', e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, rowIndex, col.key)}
                                className="w-full bg-transparent border-none focus:ring-1 focus:ring-green-600 text-[13px]"
                              />
                            </td>
                          );
                        }

                        if (col.key === 'thickness') {
                          return (
                            <td key={col.key} className={cellClass}>
                              <input
                                type="text"
                                value={row.thickness || ''}
                                onChange={(e) => updateRow(rowIndex, 'thickness', e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, rowIndex, col.key)}
                                className="w-full bg-transparent border-none focus:ring-1 focus:ring-green-600 text-[13px]"
                              />
                            </td>
                          );
                        }

                        if (col.key === 'schedule') {
                          return (
                            <td key={col.key} className={cellClass}>
                              <input
                                type="text"
                                value={row.schedule || ''}
                                onChange={(e) => updateRow(rowIndex, 'schedule', e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, rowIndex, col.key)}
                                className="w-full bg-transparent border-none focus:ring-1 focus:ring-green-600 text-[13px]"
                              />
                            </td>
                          );
                        }

                        if (col.key === 'material') {
                          return (
                            <td key={col.key} className={cellClass}>
                              <input
                                type="text"
                                value={row.material || ''}
                                onChange={(e) => updateRow(rowIndex, 'material', e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, rowIndex, col.key)}
                                className="w-full bg-transparent border-none focus:ring-1 focus:ring-green-600 text-[13px]"
                              />
                            </td>
                          );
                        }

                        return <td key={col.key} className={cellClass}></td>;
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Footer with Totals */}
          <footer className="h-12 bg-slate-50 border-t border-slate-200 flex items-center justify-between px-4 text-xs flex-shrink-0">
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-1 text-slate-500">
                <span className="text-slate-400 text-[10px] font-bold">i</span>
                <span>1-{currentSheetItems.length} of {currentSheetItems.length} rows</span>
              </div>
              <div className="flex items-center space-x-1">
                <button className="p-1 hover:bg-slate-200 rounded text-slate-400">
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button className="p-1 hover:bg-slate-200 rounded text-slate-600 font-bold">1</button>
                <button className="p-1 hover:bg-slate-200 rounded text-slate-400">2</button>
                <button className="p-1 hover:bg-slate-200 rounded text-slate-400">3</button>
                <button className="p-1 hover:bg-slate-200 rounded text-slate-400">
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-6 font-semibold">
              <div className="flex items-center space-x-2">
                <span className="text-slate-400 uppercase text-[10px]">Subtotal:</span>
                <span className="text-slate-700">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-slate-400 uppercase text-[10px]">Tax (10%):</span>
                <span className="text-slate-700">${tax.toFixed(2)}</span>
              </div>
              <div className="flex items-center space-x-2 bg-green-50 px-3 py-1.5 rounded-md border border-green-200">
                <span className="text-green-700 uppercase text-[10px]">Grand Total:</span>
                <span className="text-green-800 text-sm font-bold">${grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </footer>
        </main>

        {/* Right Activity Panel */}
        {showActivityPanel && (
          <aside className="w-80 bg-white border-l border-slate-200 flex flex-col flex-shrink-0 relative">
            <div className="h-10 px-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 flex-shrink-0">
              <div className="flex items-center space-x-2">
                <MessageSquare className="w-4 h-4 text-slate-500" />
                <span className="font-bold text-[11px] uppercase tracking-wider text-slate-600">Activity & Comments</span>
              </div>
              <button
                onClick={() => setShowActivityPanel(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded-r-md">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-blue-800">Sarah Miller</span>
                  <span className="text-[10px] text-blue-500">2m ago</span>
                </div>
                <p className="text-xs text-blue-900 leading-relaxed">
                  Check row <span className="font-bold">#1</span> rate. Market price increased to $135.00.
                </p>
                <div className="mt-2 flex items-center space-x-2">
                  <button className="text-[10px] font-semibold text-blue-700 hover:underline uppercase">Reply</button>
                  <button className="text-[10px] font-semibold text-blue-700 hover:underline uppercase">Resolve</button>
                </div>
              </div>

              <div className="flex space-x-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                  <Edit3 className="w-4 h-4 text-orange-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-900">
                    <span className="font-bold">John Doe</span> updated <span className="bg-slate-100 px-1 rounded font-mono">Row #2</span>
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Changed Quantity from 0 to 2 units</p>
                  <span className="text-[10px] text-slate-400 mt-1 block">15m ago</span>
                </div>
              </div>

              <div className="bg-amber-50 border-l-4 border-amber-400 p-3 rounded-r-md">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-amber-800">Alex Lee</span>
                  <span className="text-[10px] text-amber-500">1h ago</span>
                </div>
                <p className="text-xs text-amber-900 leading-relaxed">
                  Still waiting for the supplier quote on the reinforcement bars (Row #2). Mark as pending for now.
                </p>
                <div className="mt-2 text-[10px] bg-white/50 inline-block px-1 rounded border border-amber-200">
                  Linked to: Column "Disc %"
                </div>
              </div>

              <div className="flex space-x-3 opacity-60">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                  <Save className="w-4 h-4 text-slate-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-900">
                    <span className="font-bold">System</span> auto-saved version v2.4
                  </p>
                  <span className="text-[10px] text-slate-400 mt-1 block">2h ago</span>
                </div>
              </div>
            </div>

            <div className="p-3 border-t border-slate-200 bg-white">
              <div className="relative">
                <textarea
                  className="w-full text-xs rounded-md border-slate-300 focus:ring-green-500 focus:border-green-500 pr-10"
                  placeholder="Write a comment..."
                  rows={2}
                />
                <button className="absolute right-2 bottom-2 text-green-600 hover:text-green-700">
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center justify-between mt-2">
                <button className="text-[10px] text-slate-400 flex items-center space-x-1 hover:text-slate-600">
                  <AtSign className="w-4 h-4" />
                  <span>Tag user</span>
                </button>
                <button className="text-[10px] text-slate-400 flex items-center space-x-1 hover:text-slate-600">
                  <Paperclip className="w-4 h-4" />
                  <span>Attach</span>
                </button>
              </div>
            </div>
          </aside>
        )}

        {!showActivityPanel && (
          <button
            onClick={() => setShowActivityPanel(true)}
            className="fixed right-0 top-1/2 transform -translate-y-1/2 bg-white border border-slate-200 rounded-l-lg p-2 shadow-md hover:bg-slate-50"
          >
            <MessageSquare className="w-5 h-5 text-slate-600" />
          </button>
        )}
      </div>

      {/* Column Settings Modal */}
      {showColumnPanel && (
        <div
          style={{
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
          }}
          onClick={() => setShowColumnPanel(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '8px',
              padding: '20px',
              width: '400px',
              maxHeight: '80vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Column Settings</h3>
              <button onClick={() => setShowColumnPanel(false)} className="text-slate-500 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              {columnSettings.map(col => {
                if (col.key === 'rowControl' || col.key === 'sno') return null;
                return (
                  <label key={col.key} className="flex items-center space-x-2 p-2 hover:bg-slate-50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={col.visible}
                      onChange={() => toggleColumnVisibility(col.key)}
                      className="rounded text-green-600 focus:ring-green-500"
                    />
                    <span className="text-sm">{col.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Export Settings Modal */}
      {showExportSettings && (
        <div
          style={{
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
          }}
          onClick={() => setShowExportSettings(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '8px',
              padding: '20px',
              width: '500px',
              maxHeight: '80vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Export Settings</h3>
              <button onClick={() => setShowExportSettings(false)} className="text-slate-500 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Orientation</h4>
                <div className="flex space-x-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="orientation"
                      value="landscape"
                      checked={exportOrientation === 'landscape'}
                      onChange={(e) => setExportOrientation(e.target.value)}
                      className="text-green-600 focus:ring-green-500"
                    />
                    <span className="text-sm">Landscape</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="orientation"
                      value="portrait"
                      checked={exportOrientation === 'portrait'}
                      onChange={(e) => setExportOrientation(e.target.value)}
                      className="text-green-600 focus:ring-green-500"
                    />
                    <span className="text-sm">Portrait</span>
                  </label>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Columns to Export</h4>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {columnSettings.filter(c => c.key !== 'rowControl').map(col => (
                    <label key={col.key} className="flex items-center space-x-2 p-1 hover:bg-slate-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={exportColumns[col.key] || false}
                        onChange={(e) => setExportColumns(prev => ({ ...prev, [col.key]: e.target.checked }))}
                        className="rounded text-green-600 focus:ring-green-500"
                      />
                      <span className="text-sm">{col.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Sheets to Export</h4>
                <div className="space-y-1">
                  {sheets.map(sheet => (
                    <label key={sheet.id} className="flex items-center space-x-2 p-1 hover:bg-slate-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={exportSheets[sheet.id] || false}
                        onChange={(e) => setExportSheets(prev => ({ ...prev, [sheet.id]: e.target.checked }))}
                        className="rounded text-green-600 focus:ring-green-500"
                      />
                      <span className="text-sm">{sheet.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowExportSettings(false)}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-medium"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discount Apply Modal */}
      {showDiscountApplyModal && (
        <div
          style={{
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
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '8px',
              padding: '20px',
              width: '400px',
            }}
          >
            <h3 className="text-lg font-bold mb-4">Discount Override Detected</h3>
            <p className="text-sm text-slate-600 mb-4">
              This item has a custom discount override. How would you like to proceed?
            </p>

            <div className="space-y-2 mb-4">
              <label className="flex items-center space-x-2 p-2 border rounded cursor-pointer hover:bg-slate-50">
                <input
                  type="radio"
                  name="discountMode"
                  value="skip"
                  checked={discountApplyMode === 'skip'}
                  onChange={(e) => setDiscountApplyMode(e.target.value)}
                  className="text-green-600 focus:ring-green-500"
                />
                <span className="text-sm">Keep custom discount (skip variant discount)</span>
              </label>

              <label className="flex items-center space-x-2 p-2 border rounded cursor-pointer hover:bg-slate-50">
                <input
                  type="radio"
                  name="discountMode"
                  value="override"
                  checked={discountApplyMode === 'override'}
                  onChange={(e) => setDiscountApplyMode(e.target.value)}
                  className="text-green-600 focus:ring-green-500"
                />
                <span className="text-sm">Replace with variant discount</span>
              </label>
            </div>

            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowDiscountApplyModal(false);
                  setPendingDiscountChange(null);
                  setDiscountApplyMode('skip');
                }}
                className="px-4 py-2 border border-slate-300 rounded hover:bg-slate-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={applyDiscountDecision}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-medium"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BOQ;
