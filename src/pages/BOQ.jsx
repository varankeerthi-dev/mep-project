import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../supabase';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Save, FileDown, Plus, Trash2, Sheet, Table, X, Settings, FileSpreadsheet, Loader2 } from 'lucide-react';
import { saveBOQWithItems } from '../api';

const generateId = () => Math.random().toString(36).substr(2, 9);
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
  { key: 'variant', label: 'Variant', width: 100, visible: true },
  { key: 'make', label: 'Make', width: 100, visible: true },
  { key: 'quantity', label: 'Qty', width: 70, visible: true },
  { key: 'rate', label: 'Rate', width: 100, visible: true },
  { key: 'discountPercent', label: 'Disc %', width: 70, visible: true },
  { key: 'rateAfterDiscount', label: 'Rate After Disc', width: 110, visible: true },
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
  const [loading, setLoading] = useState(false);
  const [materialSearch, setMaterialSearch] = useState({});

  const inputRefs = useRef({});

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (!items[activeSheetId]) {
      setItems(prev => ({ ...prev, [activeSheetId]: [] }));
    }
  }, [activeSheetId]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        supabase.from('clients').select('id, client_name').order('client_name'),
        supabase.from('projects').select('id, project_name').order('project_name'),
        supabase.from('company_variants').select('id, variant_name').order('variant_name'),
        supabase.from('materials').select('id, name, sale_price, make').order('name'),
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
        discountMap[variantId] = { discount, variantName: '' };
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

  const insertRow = useCallback((afterIndex) => {
    const currentItems = items[activeSheetId] || [];
    const newRow = {
      id: generateId(),
      isHeaderRow: false,
      itemId: '',
      variantId: boqData.variantId,
      make: '',
      quantity: '',
      rate: '',
      discountPercent: getVariantDiscount(boqData.variantId),
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

  const updateItem = useCallback((index, field, value) => {
    const currentItems = items[activeSheetId] || [];
    const newItems = [...currentItems];
    newItems[index] = { ...newItems[index], [field]: value };

    if (field === 'itemId' && value) {
      getPrice(value, newItems[index].variantId || boqData.variantId, newItems[index].make)
        .then(price => {
          newItems[index].rate = price;
          setItems(prev => ({ ...prev, [activeSheetId]: [...newItems] }));
        });
    }

    if (field === 'variantId' && !newItems[index].variantId) {
      newItems[index].discountPercent = getVariantDiscount(value);
    }

    setItems(prev => ({ ...prev, [activeSheetId]: newItems }));
  }, [activeSheetId, items, boqData.variantId, getPrice, getVariantDiscount]);

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
  const columnLetters = useMemo(() => visibleColumns.map((_, idx) => getColumnLabel(idx)), [visibleColumns]);

  const getSno = (index, itemsList) => {
    let sno = 0;
    for (let i = 0; i < index; i++) {
      if (itemsList[i] && !itemsList[i].isHeaderRow) sno++;
    }
    return sno + 1;
  };

  const exportToPDF = useCallback(() => {
    const doc = new jsPDF('landscape', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFontSize(18);
    doc.text('BILL OF QUANTITIES', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.text(`BOQ No: ${boqData.boqNo}`, 14, 35);
    doc.text(`Revision: ${boqData.revisionNo}`, 14, 42);
    doc.text(`Date: ${boqData.date}`, 14, 49);
    
    const client = clients.find(c => c.id === boqData.clientId);
    const project = projects.find(p => p.id === boqData.projectId);
    doc.text(`Client: ${client?.client_name || '-'}`, 80, 35);
    doc.text(`Project: ${project?.project_name || '-'}`, 80, 42);

    const tableData = [];
    let sno = 0;
    
    (items[activeSheetId] || []).forEach(item => {
      if (item.isHeaderRow) {
        tableData.push([{ content: item.headerText || 'SECTION', colSpan: visibleColumns.length, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }]);
      } else {
        sno++;
        const { rateAfterDiscount, totalAmount } = calculateRow(item);
        const row = [];
        
        visibleColumns.forEach(col => {
          switch (col.key) {
            case 'sno': row.push(sno); break;
            case 'description': row.push(item.description || ''); break;
            case 'variant': row.push(item.variantName || ''); break;
            case 'make': row.push(item.make || ''); break;
            case 'quantity': row.push(item.quantity || ''); break;
            case 'rate': row.push(item.rate ? `₹${item.rate}` : ''); break;
            case 'discountPercent': row.push(item.discountPercent ? `${item.discountPercent}%` : ''); break;
            case 'rateAfterDiscount': row.push(rateAfterDiscount ? `₹${rateAfterDiscount}` : ''); break;
            case 'totalAmount': row.push(totalAmount ? `₹${totalAmount.toLocaleString()}` : ''); break;
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

    const headers = visibleColumns.map(col => col.label);
    
    doc.autoTable({
      head: [headers],
      body: tableData,
      startY: 55,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });

    doc.text(`Total Qty: ${totals.totalQty}`, 14, doc.lastAutoTable.finalY + 10);
    doc.text(`Total Amount: ₹${totals.totalAmount.toLocaleString()}`, 14, doc.lastAutoTable.finalY + 17);

    doc.save(`${boqData.boqNo}.pdf`);
    setShowExportMenu(false);
  }, [boqData, clients, projects, items, activeSheetId, visibleColumns, calculateRow, totals]);

  const exportToExcel = useCallback(() => {
    const wb = XLSX.utils.book_new();
    
    sheets.forEach(sheet => {
      const sheetData = [];
      let sno = 0;
      
      sheetData.push(['BOQ No', boqData.boqNo, 'Revision', boqData.revisionNo]);
      sheetData.push(['Date', boqData.date]);
      const client = clients.find(c => c.id === boqData.clientId);
      const project = projects.find(p => p.id === boqData.projectId);
      sheetData.push(['Client', client?.client_name || '']);
      sheetData.push(['Project', project?.project_name || '']);
      sheetData.push([]);
      
      const headers = visibleColumns.map(col => col.label);
      sheetData.push(headers);
      
      (items[sheet.id] || []).forEach(item => {
        if (item.isHeaderRow) {
          sheetData.push([item.headerText]);
        } else {
          sno++;
          const { rateAfterDiscount, totalAmount } = calculateRow(item);
          const row = [];
          
          visibleColumns.forEach(col => {
            switch (col.key) {
              case 'sno': row.push(sno); break;
              case 'description': row.push(item.description || ''); break;
              case 'variant': row.push(item.variantName || ''); break;
              case 'make': row.push(item.make || ''); break;
              case 'quantity': row.push(item.quantity || ''); break;
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

    XLSX.writeFile(wb, `${boqData.boqNo}.xlsx`);
    setShowExportMenu(false);
  }, [boqData, clients, projects, sheets, items, visibleColumns, calculateRow]);

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
    if (!materialSearch[activeSheetId]) return materials;
    const search = materialSearch[activeSheetId].toLowerCase();
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Variant:</label>
            <select value={boqData.variantId} onChange={(e) => handleVariantChange(e.target.value)} style={{ ...inputStyle, width: '200px' }}>
              <option value="">Select Variant (Default for all rows)</option>
              {variants.map(v => <option key={v.id} value={v.id}>{v.variant_name}</option>)}
            </select>
          </div>

          {Object.keys(clientDiscounts).length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', paddingTop: '10px', borderTop: '1px solid #ddd' }}>
              <span style={{ fontWeight: '500', color: '#666' }}>Variant Discounts:</span>
              {Object.entries(clientDiscounts).map(([variantId, data]) => (
                <div key={variantId} style={variantDiscountBoxStyle}>
                  <span style={{ fontSize: '13px' }}>{data.variantName || 'Default'}</span>
                  <input
                    type="number"
                    value={boqVariantDiscounts[variantId] ?? data.discount}
                    onChange={(e) => handleVariantDiscountChange(variantId, e.target.value)}
                    style={{ ...inputStyle, width: '60px', padding: '4px' }}
                    step="0.5"
                  />
                  <span style={{ fontSize: '12px', color: '#666' }}>%</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginBottom: '15px', display: 'flex', gap: '10px' }}>
          <button onClick={addHeaderRow} style={{ ...btnStyle, background: '#28a745', color: 'white' }}>
            <Plus size={16} /> Add Header Row
          </button>
          <div style={{ display: 'flex', gap: '5px', marginLeft: 'auto' }}>
            {sheets.map((sheet, idx) => (
              <div key={sheet.id} style={{ display: 'flex', alignItems: 'center' }}>
                <button
                  onClick={() => setActiveSheetId(sheet.id)}
                  style={{
                    ...sheetTabStyle,
                    background: activeSheetId === sheet.id ? '#1976d2' : '#f0f0f0',
                    color: activeSheetId === sheet.id ? 'white' : '#333',
                  }}
                >
                  <Sheet size={14} /> {sheet.name}
                </button>
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

        <div style={excelTableWrapStyle}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
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
                  <th key={col.key} style={{ ...thStyle, width: col.width, minWidth: col.width }}>
                    {col.key === 'rowControl' ? '' : col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentItems.map((item, index) => (
                item.isHeaderRow ? (
                  <tr key={item.id} style={{ background: '#e8e8e8' }}>
                    <td colSpan={visibleColumns.length} style={{ padding: '10px', fontWeight: 'bold', textAlign: 'left' }}>
                      <input
                        type="text"
                        value={item.headerText}
                        onChange={(e) => updateItem(index, 'headerText', e.target.value)}
                        style={{ border: 'none', background: 'transparent', fontWeight: 'bold', width: '100%', fontSize: '14px' }}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={item.id} style={{ background: index % 2 === 0 ? 'white' : '#fafafa' }}>
                    {visibleColumns.map(col => (
                      <td key={col.key} style={{ ...excelCellStyle, ...(col.key === 'rowControl' || col.key === 'sno' ? excelRowHeaderCellStyle : null) }}>
                        {col.key === 'rowControl' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <button onClick={() => deleteRow(index)} style={iconBtnStyle} title="Delete Row">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                        {col.key === 'sno' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span>{getSno(index, currentItems)}</span>
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
                                e.target.select();
                              }}
                              onBlur={() => setTimeout(() => setMaterialSearch(prev => ({ ...prev, [activeSheetId]: '' })), 200)}
                              style={cellInputStyle}
                              ref={(el) => { inputRefs.current[`${activeSheetId}-${index}-itemId`] = el; }}
                              onKeyDown={(e) => handleKeyDown(e, index, 'itemId')}
                            />
                            {materialSearch[activeSheetId] && (
                              <div style={autocompleteStyle}>
                                {filteredMaterials.slice(0, 8).map(m => (
                                  <div
                                    key={m.id}
                                    onClick={() => {
                                      updateItem(index, 'itemId', m.id);
                                      updateItem(index, 'description', m.name);
                                      setMaterialSearch(prev => ({ ...prev, [activeSheetId]: '' }));
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
                        {col.key === 'variant' && (
                          <select
                            value={item.variantId || ''}
                            onChange={(e) => {
                              updateItem(index, 'variantId', e.target.value);
                              const variant = variants.find(v => v.id === e.target.value);
                              updateItem(index, 'variantName', variant?.variant_name || '');
                              updateItem(index, 'discountPercent', getVariantDiscount(e.target.value));
                            }}
                            style={cellInputStyle}
                            ref={(el) => { inputRefs.current[`${activeSheetId}-${index}-variantId`] = el; }}
                            onKeyDown={(e) => handleKeyDown(e, index, 'variantId')}
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
                          />
                        )}
                        {col.key === 'discountPercent' && (
                          <input
                            type="number"
                            value={item.discountPercent || ''}
                            onChange={(e) => updateItem(index, 'discountPercent', e.target.value)}
                            style={cellInputStyle}
                            ref={(el) => { inputRefs.current[`${activeSheetId}-${index}-discountPercent`] = el; }}
                            onKeyDown={(e) => handleKeyDown(e, index, 'discountPercent')}
                          />
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
                          />
                        )}
                        {col.key === 'pressure' && (
                          <input
                            type="text"
                            value={item.pressure || ''}
                            onChange={(e) => updateItem(index, 'pressure', e.target.value)}
                            style={cellInputStyle}
                          />
                        )}
                        {col.key === 'thickness' && (
                          <input
                            type="text"
                            value={item.thickness || ''}
                            onChange={(e) => updateItem(index, 'thickness', e.target.value)}
                            style={cellInputStyle}
                          />
                        )}
                        {col.key === 'schedule' && (
                          <input
                            type="text"
                            value={item.schedule || ''}
                            onChange={(e) => updateItem(index, 'schedule', e.target.value)}
                            style={cellInputStyle}
                          />
                        )}
                        {col.key === 'material' && (
                          <input
                            type="text"
                            value={item.material || ''}
                            onChange={(e) => updateItem(index, 'material', e.target.value)}
                            style={cellInputStyle}
                          />
                        )}
                      </td>
                    ))}
                  </tr>
                )
              ))}
              <tr>
                <td colSpan={visibleColumns.length} style={{ padding: '10px', textAlign: 'center' }}>
                  <button onClick={() => insertRow(currentItems.length - 1)} style={{ ...btnStyle, background: '#28a745', color: 'white' }}>
                    <Plus size={16} /> Add Row
                  </button>
                </td>
              </tr>
            </tbody>
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
  fontSize: '11px',
  fontWeight: '600',
  color: '#4b5563',
  marginBottom: '4px',
};

const inputStyle = {
  width: '100%',
  padding: '6px 8px',
  border: '1px solid #cbd5e1',
  borderRadius: '2px',
  fontSize: '12px',
  boxSizing: 'border-box',
  background: '#fff',
};

const thStyle = {
  padding: '6px 6px',
  textAlign: 'center',
  fontWeight: '700',
  color: '#1f2937',
  borderBottom: '1px solid #cbd5e1',
  fontSize: '11px',
  background: '#f3f4f6',
  textTransform: 'uppercase',
  letterSpacing: '0.02em',
};

const cellInputStyle = {
  width: '100%',
  padding: '4px 6px',
  border: '1px solid #e2e8f0',
  borderRadius: '0',
  fontSize: '12px',
  background: '#fff',
  boxSizing: 'border-box',
  height: '26px',
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
  border: '1px solid #cbd5e1',
  borderRadius: '3px 3px 0 0',
  cursor: 'pointer',
  fontSize: '11px',
  background: '#f8fafc',
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
  zIndex: 100,
};

const autocompleteItemStyle = {
  padding: '8px 12px',
  cursor: 'pointer',
  fontSize: '13px',
  borderBottom: '1px solid #f0f0f0',
};

const excelTableWrapStyle = {
  overflowX: 'auto',
  border: '1px solid #cbd5e1',
  borderRadius: '4px',
  background: '#fff',
  boxShadow: 'inset 0 0 0 1px #e5e7eb',
};

const excelColumnHeaderRowStyle = {
  background: '#e5e7eb',
};

const excelColumnHeaderCellStyle = {
  padding: '4px 6px',
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
  background: '#fff',
};

const excelRowHeaderCellStyle = {
  background: '#f3f4f6',
  borderRight: '1px solid #cbd5e1',
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
