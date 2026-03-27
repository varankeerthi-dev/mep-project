import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { formatDate } from '../utils/formatters';

const VARIANT_FILTERS = ['All', 'Green', 'Blue', 'Non-Variant'];

export default function QuickStockCheck() {
  const navigate = useNavigate();
  const hashPath = window.location.hash.slice(1);
  const query = window.location.search.slice(1) || window.location.hash.split('?')[1] || '';
  const currentPath = `${window.location.pathname}${window.location.search}` || hashPath;
  const editId = new URLSearchParams(query).get('id');
  const viewId = new URLSearchParams(query).get('id');
  const isViewMode = currentPath.includes('/quick-stock-check/view') || hashPath.includes('/quick-stock-check/view');
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [variants, setVariants] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [visibleExportColumns, setVisibleExportColumns] = useState({});
  const previewRef = useRef();

  const [formData, setFormData] = useState({
    client_name: '',
    check_date: new Date().toISOString().split('T')[0],
    variant_filter: 'All'
  });

  const [items, setItems] = useState([]);

  useEffect(() => {
    loadInitialData();
  }, [editId, viewId]);

  useEffect(() => {
    if (warehouses.length > 0) {
      const initialCols = {
        sno: true,
        item: true,
        qty_required: true,
        total_available: true,
        pending_qty: true
      };
      warehouses.forEach(wh => {
        initialCols[`wh_${wh.id}`] = true;
      });
      setVisibleExportColumns(initialCols);
    }
  }, [warehouses]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [warehouseData, materialData, variantData] = await Promise.all([
        supabase.from('warehouses').select('*').eq('is_active', true).order('warehouse_name'),
        supabase.from('materials').select('id, display_name, name, item_code, uses_variant').eq('is_active', true).order('display_name'),
        supabase.from('company_variants').select('*').eq('is_active', true).order('variant_name')
      ]);

      setWarehouses(warehouseData.data || []);
      setMaterials(materialData.data || []);
      setVariants(variantData.data || []);

      if (editId) {
        await loadQuickCheck(editId);
      } else if (viewId) {
        await loadQuickCheck(viewId);
      }
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadQuickCheck = async (id) => {
    const { data, error } = await supabase
      .from('quick_checks')
      .select('*, items:quick_check_items(*, item:materials(id, display_name, name, item_code))')
      .eq('id', id)
      .single();

    if (error) {
      alert('Error loading: ' + error.message);
      return;
    }

    if (data) {
      setFormData({
        client_name: data.client_name || '',
        check_date: data.check_date || '',
        variant_filter: data.variant_filter || 'All',
        check_no: data.check_no
      });

      if (data.items) {
        setItems(data.items.map(item => ({
          ...item,
          id: item.id || Date.now() + Math.random(),
          warehouse_snapshot: typeof item.warehouse_snapshot === 'string' ? JSON.parse(item.warehouse_snapshot) : item.warehouse_snapshot
        })));
      }
    }
  };

  const fetchStockForItem = async (itemId, variantId = null) => {
    try {
      let query = supabase
        .from('item_stock')
        .select('warehouse_id, current_stock, warehouse:warehouses(warehouse_name)')
        .eq('item_id', itemId);

      if (variantId) {
        query = query.eq('company_variant_id', variantId);
      }

      const { data: stockData } = await query;

      const warehouseStock = {};
      let totalAvailable = 0;

      warehouses.forEach(wh => {
        const stock = stockData?.find(s => s.warehouse_id === wh.id);
        const qty = parseFloat(stock?.current_stock) || 0;
        warehouseStock[wh.id] = qty;
        totalAvailable += qty;
      });

      return { warehouseStock, totalAvailable };
    } catch (err) {
      console.error('Error fetching stock:', err);
      return { warehouseStock: {}, totalAvailable: 0 };
    }
  };

  const handleAddItem = async () => {
    const newItem = {
      id: Date.now() + Math.random(),
      item_id: '',
      company_variant_id: null,
      qty_required: 0,
      warehouse_snapshot: {},
      total_available: 0,
      pending_qty: 0
    };
    setItems([...items, newItem]);
  };

  const handleItemChange = async (index, field, value) => {
    const updatedItems = [...items];
    updatedItems[index][field] = value;

    if (field === 'item_id' || field === 'company_variant_id') {
      const itemId = field === 'item_id' ? value : updatedItems[index].item_id;
      const variantId = field === 'company_variant_id' ? value : updatedItems[index].company_variant_id;

      if (itemId) {
        const { warehouseStock, totalAvailable } = await fetchStockForItem(itemId, variantId);
        updatedItems[index].warehouse_snapshot = warehouseStock;
        updatedItems[index].total_available = totalAvailable;
        updatedItems[index].pending_qty = Math.max(0, parseFloat(updatedItems[index].qty_required || 0) - totalAvailable);
      }
    }

    if (field === 'qty_required') {
      updatedItems[index].pending_qty = Math.max(0, parseFloat(value || 0) - updatedItems[index].total_available);
    }

    setItems(updatedItems);
  };

  const handleRemoveItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!formData.client_name.trim()) {
      alert('Please enter client name');
      return;
    }

    setSaving(true);
    try {
      let checkNo = formData.check_no;
      
      if (!editId && !checkNo) {
        const { data: existing } = await supabase
          .from('quick_checks')
          .select('check_no')
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (existing && existing.length > 0) {
          const lastNum = parseInt(existing[0].check_no.replace(/[^0-9]/g, ''));
          checkNo = `QC-${String(lastNum + 1).padStart(4, '0')}`;
        } else {
          checkNo = 'QC-0001';
        }
      }

      const checkData = {
        client_name: formData.client_name,
        check_date: formData.check_date,
        variant_filter: formData.variant_filter
      };

      let quickCheckId = editId;

      if (editId) {
        await supabase.from('quick_checks').update(checkData).eq('id', editId);
      } else {
        const { data, error } = await supabase
          .from('quick_checks')
          .insert({ ...checkData, check_no: checkNo })
          .select()
          .single();
        
        if (error) throw error;
        quickCheckId = data.id;
      }

      await supabase.from('quick_check_items').delete().eq('quick_check_id', quickCheckId);

      const itemsToInsert = items
        .filter(item => item.item_id)
        .map(item => ({
          quick_check_id: quickCheckId,
          item_id: item.item_id,
          company_variant_id: item.company_variant_id || null,
          qty_required: parseFloat(item.qty_required) || 0,
          warehouse_snapshot: JSON.stringify(item.warehouse_snapshot || {}),
          total_available: item.total_available || 0,
          pending_qty: item.pending_qty || 0
        }));

      if (itemsToInsert.length > 0) {
        await supabase.from('quick_check_items').insert(itemsToInsert);
      }

      alert(editId ? 'Stock check updated!' : 'Stock check saved!');
      navigate('/quick-stock-check');
    } catch (err) {
      console.error('Error saving:', err);
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleExportPDF = () => {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });
    const checkNo = formData.check_no || 'QC-XXXX';
    
    doc.setFontSize(14);
    doc.text('QUICK STOCK AVAILABILITY CHECK', 148.5, 15, { align: 'center' });
    
    doc.setFontSize(9);
    doc.text(`Check No: ${checkNo}`, 14, 25);
    doc.text(`Date: ${formatDate(formData.check_date)}`, 14, 30);
    doc.text(`Client: ${formData.client_name}`, 14, 35);
    doc.text(`Variant Filter: ${formData.variant_filter}`, 14, 40);

    const tableHeaders = [];
    if (visibleExportColumns.sno) tableHeaders.push('#');
    if (visibleExportColumns.item) tableHeaders.push('Item');
    if (visibleExportColumns.qty_required) tableHeaders.push('Qty Required');
    
    warehouses.forEach(wh => {
      if (visibleExportColumns[`wh_${wh.id}`]) {
        tableHeaders.push(wh.warehouse_name);
      }
    });
    
    if (visibleExportColumns.total_available) tableHeaders.push('Total Available');
    if (visibleExportColumns.pending_qty) tableHeaders.push('Pending');

    const tableData = items.map((item, index) => {
      const material = materials.find(m => m.id === item.item_id);
      const row = [];
      
      if (visibleExportColumns.sno) row.push(index + 1);
      if (visibleExportColumns.item) row.push(material?.display_name || material?.name || '-');
      if (visibleExportColumns.qty_required) row.push(item.qty_required || 0);
      
      warehouses.forEach(wh => {
        if (visibleExportColumns[`wh_${wh.id}`]) {
          const snapshot = item.warehouse_snapshot || {};
          row.push(snapshot[wh.id] || 0);
        }
      });
      
      if (visibleExportColumns.total_available) row.push(item.total_available || 0);
      if (visibleExportColumns.pending_qty) row.push(item.pending_qty || 0);
      
      return row;
    });

    doc.autoTable({
      startY: 45,
      head: [tableHeaders],
      body: tableData,
      theme: 'grid',
      headStyles: { 
        fillColor: [241, 245, 249], 
        textColor: [51, 65, 85],
        lineColor: [203, 213, 225],
        lineWidth: 0.1,
        fontSize: 8,
        fontStyle: 'bold'
      },
      styles: { 
        fontSize: 7,
        cellPadding: 2,
        lineColor: [203, 213, 225],
        lineWidth: 0.1
      },
      columnStyles: tableHeaders.reduce((acc, header, idx) => {
        if (header !== '#' && header !== 'Item') acc[idx] = { halign: 'right' };
        return acc;
      }, {})
    });

    doc.save(`${checkNo}.pdf`);
  };

  const handleExportImage = async () => {
    if (!previewRef.current) return;
    
    try {
      const canvas = await html2canvas(previewRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true
      });
      
      const link = document.createElement('a');
      link.download = `${formData.check_no || 'QC-XXXX'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Error exporting image:', err);
      alert('Error exporting image');
    }
  };

  const handleSendEmail = async () => {
    if (!emailTo.trim()) {
      alert('Please enter email address');
      return;
    }
    
    alert(`Email would be sent to: ${emailTo}\n\n(PDF attachment feature coming soon)`);
    setShowEmailModal(false);
    setEmailTo('');
  };

  const toggleExportColumn = (key) => {
    setVisibleExportColumns(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const formatCurrency = (num) => {
    return new Intl.NumberFormat('en-IN').format(num || 0);
  };

  const getSelectedMaterial = (itemId) => {
    return materials.find(m => m.id === itemId);
  };

  const getSelectedVariant = (variantId) => {
    return variants.find(v => v.id === variantId);
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>;
  }

  const isReadOnly = isViewMode;

  const excelTableStyle = {
    fontSize: '10px',
    borderCollapse: 'collapse',
    width: '100%',
    border: '1px solid #cbd5e1'
  };

  const excelHeaderStyle = {
    background: '#f1f5f9',
    border: '1px solid #cbd5e1',
    padding: '4px 8px',
    fontWeight: 'bold',
    color: '#334155',
    textAlign: 'left'
  };

  const excelCellStyle = {
    border: '1px solid #cbd5e1',
    padding: '2px 8px',
    height: '24px'
  };

  return (
    <div>
      <div className="page-header" style={{ marginBottom: '8px' }}>
        <h1 className="page-title" style={{ fontSize: '18px' }}>
          {editId ? 'Edit Stock Check' : isViewMode ? 'Stock Check Details' : 'New Stock Check'}
        </h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          {!isReadOnly && (
            <>
              <button className="btn btn-secondary" onClick={() => setShowPreview(true)} style={{ fontSize: '12px', padding: '6px 12px' }}>
                Generate Preview
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ fontSize: '12px', padding: '6px 12px' }}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </>
          )}
          {isViewMode && (
            <>
              <button className="btn btn-secondary" onClick={() => setShowPreview(true)} style={{ fontSize: '12px', padding: '6px 12px' }}>
                Export / Print
              </button>
              <button className="btn btn-secondary" onClick={() => setShowEmailModal(true)} style={{ fontSize: '12px', padding: '6px 12px' }}>
                Send Email
              </button>
            </>
          )}
        </div>
      </div>

      <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '4px', border: '1px solid #e2e8f0', marginBottom: '12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontWeight: 600, fontSize: '10px', marginBottom: '2px' }}>Client Name *</label>
            <input
              type="text"
              className="form-input"
              style={{ height: '28px', fontSize: '11px', padding: '4px 8px' }}
              value={formData.client_name}
              onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
              disabled={isReadOnly}
              placeholder="Enter client name"
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontWeight: 600, fontSize: '10px', marginBottom: '2px' }}>Date</label>
            <input
              type="date"
              className="form-input"
              style={{ height: '28px', fontSize: '11px', padding: '4px 8px' }}
              value={formData.check_date}
              onChange={(e) => setFormData({ ...formData, check_date: e.target.value })}
              disabled={isReadOnly}
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontWeight: 600, fontSize: '10px', marginBottom: '2px' }}>Variant Filter</label>
            <select
              className="form-select"
              style={{ height: '28px', fontSize: '11px', padding: '2px 8px' }}
              value={formData.variant_filter}
              onChange={(e) => setFormData({ ...formData, variant_filter: e.target.value })}
              disabled={isReadOnly}
            >
              {VARIANT_FILTERS.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontWeight: 600, fontSize: '10px', marginBottom: '2px' }}>Check No</label>
            <input
              type="text"
              className="form-input"
              style={{ height: '28px', fontSize: '11px', padding: '4px 8px', background: '#f1f5f9' }}
              value={formData.check_no || 'Auto-generated'}
              disabled
            />
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '8px', padding: '0', overflow: 'hidden', border: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#fff' }}>
          <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 600 }}>Items</h3>
          {!isReadOnly && (
            <button className="btn btn-primary btn-sm" onClick={handleAddItem} style={{ fontSize: '11px', padding: '2px 8px' }}>
              + Add Item
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280', fontSize: '12px', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
            No items added. Click "+ Add Item" to start.
          </div>
        ) : (
          <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
            <table style={excelTableStyle}>
              <thead>
                <tr>
                  <th style={{ ...excelHeaderStyle, width: '40px', textAlign: 'center' }}>#</th>
                  <th style={{ ...excelHeaderStyle, minWidth: '200px' }}>Item Name / Description</th>
                  {formData.variant_filter !== 'Non-Variant' && <th style={{ ...excelHeaderStyle, width: '120px' }}>Variant</th>}
                  <th style={{ ...excelHeaderStyle, width: '100px', textAlign: 'right' }}>Req Qty</th>
                  {warehouses.map(wh => (
                    <th key={wh.id} style={{ ...excelHeaderStyle, width: '90px', textAlign: 'right' }}>{wh.warehouse_name}</th>
                  ))}
                  <th style={{ ...excelHeaderStyle, width: '110px', textAlign: 'right' }}>Total Avail</th>
                  <th style={{ ...excelHeaderStyle, width: '100px', textAlign: 'right' }}>Pending</th>
                  {!isReadOnly && <th style={{ ...excelHeaderStyle, width: '40px', textAlign: 'center' }}></th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={item.id} style={{ background: item.pending_qty > 0 ? '#fff1f2' : '#fff' }}>
                    <td style={{ ...excelCellStyle, textAlign: 'center', color: '#64748b' }}>{index + 1}</td>
                    <td style={{ ...excelCellStyle, padding: '0' }}>
                      <select
                        className="excel-select"
                        style={{ width: '100%', border: 'none', padding: '0 8px', height: '100%', fontSize: '11px', background: 'transparent', outline: 'none' }}
                        value={item.item_id}
                        onChange={(e) => handleItemChange(index, 'item_id', e.target.value)}
                        disabled={isReadOnly}
                      >
                        <option value="">Search or Select Item...</option>
                        {materials.map(m => (
                          <option key={m.id} value={m.id}>{m.display_name || m.name}</option>
                        ))}
                      </select>
                    </td>
                    {formData.variant_filter !== 'Non-Variant' && (
                      <td style={{ ...excelCellStyle, padding: '0' }}>
                        <select
                          className="excel-select"
                          style={{ width: '100%', border: 'none', padding: '0 8px', height: '100%', fontSize: '11px', background: 'transparent', outline: 'none' }}
                          value={item.company_variant_id || ''}
                          onChange={(e) => handleItemChange(index, 'company_variant_id', e.target.value || null)}
                          disabled={isReadOnly}
                        >
                          <option value="">Default</option>
                          {variants.map(v => (
                            <option key={v.id} value={v.id}>{v.variant_name}</option>
                          ))}
                        </select>
                      </td>
                    )}
                    <td style={{ ...excelCellStyle, padding: '0' }}>
                      <input
                        type="number"
                        className="excel-input"
                        style={{ width: '100%', border: 'none', padding: '0 8px', height: '100%', fontSize: '11px', textAlign: 'right', background: 'transparent', outline: 'none' }}
                        value={item.qty_required}
                        onChange={(e) => handleItemChange(index, 'qty_required', e.target.value)}
                        min="0"
                        step="0.01"
                        disabled={isReadOnly}
                      />
                    </td>
                    {warehouses.map(wh => {
                      const snapshot = item.warehouse_snapshot || {};
                      return (
                        <td key={wh.id} style={{ ...excelCellStyle, textAlign: 'right', color: '#475569' }}>
                          {formatCurrency(snapshot[wh.id] || 0)}
                        </td>
                      );
                    })}
                    <td style={{ ...excelCellStyle, textAlign: 'right', fontWeight: 'bold', color: '#0f172a' }}>
                      {formatCurrency(item.total_available || 0)}
                    </td>
                    <td style={{ ...excelCellStyle, textAlign: 'right', fontWeight: 'bold', color: (item.pending_qty || 0) > 0 ? '#be123c' : '#15803d' }}>
                      {formatCurrency(item.pending_qty || 0)}
                    </td>
                    {!isReadOnly && (
                      <td style={{ ...excelCellStyle, textAlign: 'center' }}>
                        <button
                          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '16px' }}
                          onClick={() => handleRemoveItem(index)}
                        >
                          ×
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ marginTop: '16px' }}>
        <button className="btn btn-secondary" onClick={() => navigate('/quick-stock-check')} style={{ fontSize: '12px' }}>
          Back to List
        </button>
      </div>

      {showPreview && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }} onClick={() => setShowPreview(false)}>
          <div style={{
            background: '#fff', borderRadius: '8px', width: '98%', maxWidth: '1400px', maxHeight: '95vh',
            display: 'flex', flexDirection: 'column'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', borderTopLeftRadius: '8px', borderTopRightRadius: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Export Preview & Settings</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-primary" onClick={handleExportPDF} style={{ fontSize: '12px' }}>Export PDF</button>
                <button className="btn btn-secondary" onClick={handleExportImage} style={{ fontSize: '12px' }}>Export Image</button>
                <button onClick={() => setShowPreview(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#64748b', marginLeft: '12px' }}>×</button>
              </div>
            </div>
            
            <div style={{ display: 'flex', overflow: 'hidden', flex: 1 }}>
              {/* Column Selection Sidebar */}
              <div style={{ width: '240px', borderRight: '1px solid #e2e8f0', padding: '16px', background: '#f8fafc', overflowY: 'auto' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '12px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Visible Columns</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={visibleExportColumns.sno} onChange={() => toggleExportColumn('sno')} /> # (S.No)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={visibleExportColumns.item} onChange={() => toggleExportColumn('item')} /> Item Name
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={visibleExportColumns.qty_required} onChange={() => toggleExportColumn('qty_required')} /> Required Qty
                  </label>
                  
                  <div style={{ margin: '8px 0', borderTop: '1px solid #e2e8f0', paddingTop: '8px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8' }}>WAREHOUSES</span>
                  </div>
                  
                  {warehouses.map(wh => (
                    <label key={wh.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={visibleExportColumns[`wh_${wh.id}`]} onChange={() => toggleExportColumn(`wh_${wh.id}`)} /> {wh.warehouse_name}
                    </label>
                  ))}
                  
                  <div style={{ margin: '8px 0', borderTop: '1px solid #e2e8f0', paddingTop: '8px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8' }}>SUMMARY</span>
                  </div>
                  
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={visibleExportColumns.total_available} onChange={() => toggleExportColumn('total_available')} /> Total Available
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={visibleExportColumns.pending_qty} onChange={() => toggleExportColumn('pending_qty')} /> Pending Qty
                  </label>
                </div>
              </div>

              {/* Preview Area */}
              <div style={{ flex: 1, padding: '30px', overflowY: 'auto', background: '#f1f5f9' }}>
                <div ref={previewRef} style={{ background: '#fff', padding: '40px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', minHeight: '100%', width: 'fit-content', margin: '0 auto' }}>
                  <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                    <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#1e293b' }}>QUICK STOCK AVAILABILITY CHECK</h2>
                    <div style={{ height: '2px', width: '60px', background: '#3b82f6', margin: '8px auto' }}></div>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginBottom: '30px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}><span style={{ color: '#64748b', minWidth: '80px' }}>Client:</span> <span style={{ fontWeight: 600 }}>{formData.client_name || '-'}</span></div>
                      <div style={{ display: 'flex', gap: '8px' }}><span style={{ color: '#64748b', minWidth: '80px' }}>Date:</span> <span style={{ fontWeight: 600 }}>{formatDate(formData.check_date)}</span></div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}><span style={{ color: '#64748b', minWidth: '80px' }}>Check No:</span> <span style={{ fontWeight: 600 }}>{formData.check_no || 'QC-XXXX'}</span></div>
                      <div style={{ display: 'flex', gap: '8px' }}><span style={{ color: '#64748b', minWidth: '80px' }}>Variant:</span> <span style={{ fontWeight: 600 }}>{formData.variant_filter}</span></div>
                    </div>
                  </div>

                  <table style={{ ...excelTableStyle, fontSize: '11px' }}>
                    <thead>
                      <tr>
                        {visibleExportColumns.sno && <th style={{ ...excelHeaderStyle, textAlign: 'center' }}>#</th>}
                        {visibleExportColumns.item && <th style={excelHeaderStyle}>Item</th>}
                        {visibleExportColumns.qty_required && <th style={{ ...excelHeaderStyle, textAlign: 'right' }}>Req Qty</th>}
                        {warehouses.map(wh => (
                          visibleExportColumns[`wh_${wh.id}`] && (
                            <th key={wh.id} style={{ ...excelHeaderStyle, textAlign: 'right' }}>{wh.warehouse_name}</th>
                          )
                        ))}
                        {visibleExportColumns.total_available && <th style={{ ...excelHeaderStyle, textAlign: 'right' }}>Total Avail</th>}
                        {visibleExportColumns.pending_qty && <th style={{ ...excelHeaderStyle, textAlign: 'right' }}>Pending</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, index) => {
                        const material = getSelectedMaterial(item.item_id);
                        return (
                          <tr key={item.id} style={{ background: item.pending_qty > 0 ? '#fff1f2' : '#fff' }}>
                            {visibleExportColumns.sno && <td style={{ ...excelCellStyle, textAlign: 'center' }}>{index + 1}</td>}
                            {visibleExportColumns.item && <td style={excelCellStyle}>{material?.display_name || material?.name || '-'}</td>}
                            {visibleExportColumns.qty_required && <td style={{ ...excelCellStyle, textAlign: 'right' }}>{item.qty_required || 0}</td>}
                            {warehouses.map(wh => (
                              visibleExportColumns[`wh_${wh.id}`] && (
                                <td key={wh.id} style={{ ...excelCellStyle, textAlign: 'right' }}>
                                  {formatCurrency(item.warehouse_snapshot?.[wh.id] || 0)}
                                </td>
                              )
                            ))}
                            {visibleExportColumns.total_available && <td style={{ ...excelCellStyle, textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(item.total_available || 0)}</td>}
                            {visibleExportColumns.pending_qty && <td style={{ ...excelCellStyle, textAlign: 'right', fontWeight: 'bold', color: (item.pending_qty || 0) > 0 ? '#be123c' : '#15803d' }}>
                              {formatCurrency(item.pending_qty || 0)}
                            </td>}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  
                  <div style={{ marginTop: '40px', borderTop: '1px solid #e2e8f0', paddingTop: '10px', fontSize: '10px', color: '#94a3b8', textAlign: 'center' }}>
                    This is a computer generated stock availability report.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEmailModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1001
        }} onClick={() => setShowEmailModal(false)}>
          <div style={{
            background: '#fff',
            borderRadius: '8px',
            padding: '24px',
            width: '400px'
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Send Email</h3>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-input"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="Enter email address"
              />
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button className="btn btn-secondary" onClick={() => setShowEmailModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSendEmail}>Send</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

