import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';

const VARIANT_FILTERS = ['All', 'Green', 'Blue', 'Non-Variant'];

export default function QuickStockCheck() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');
  const viewId = searchParams.get('id');
  const isViewMode = window.location.pathname.includes('/view');
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [variants, setVariants] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailTo, setEmailTo] = useState('');
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
        variant_filter: data.variant_filter || 'All'
      });

      if (data.items) {
        setItems(data.items.map(item => ({
          ...item,
          id: item.id || Date.now() + Math.random()
        })));
      }
    }
  };

  const fetchStockForItem = async (itemId, variantId = null) => {
    try {
      let query = supabase
        .from('item_stock')
        .select('warehouse_id, quantity, warehouse:warehouses(warehouse_name)')
        .eq('item_id', itemId);

      if (variantId) {
        query = query.eq('company_variant_id', variantId);
      }

      const { data: stockData } = await query;

      const warehouseStock = {};
      let totalAvailable = 0;

      warehouses.forEach(wh => {
        const stock = stockData?.find(s => s.warehouse_id === wh.id);
        const qty = parseFloat(stock?.quantity) || 0;
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
      let checkNo = 'QC-0001';
      
      if (!editId) {
        const { data: existing } = await supabase
          .from('quick_checks')
          .select('check_no')
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (existing && existing.length > 0) {
          const lastNum = parseInt(existing[0].check_no.replace(/[^0-9]/g, ''));
          checkNo = `QC-${String(lastNum + 1).padStart(4, '0')}`;
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
    const doc = new jsPDF();
    const checkNo = formData.check_no || 'QC-XXXX';
    
    doc.setFontSize(18);
    doc.text('QUICK STOCK AVAILABILITY CHECK', 105, 20, { align: 'center' });
    
    doc.setFontSize(11);
    doc.text(`Check No: ${checkNo}`, 14, 35);
    doc.text(`Date: ${formatDate(formData.check_date)}`, 14, 42);
    doc.text(`Client: ${formData.client_name}`, 14, 49);
    doc.text(`Variant Filter: ${formData.variant_filter}`, 14, 56);

    const tableHeaders = ['#', 'Item', 'Qty Required', ...warehouses.map(w => w.warehouse_name), 'Total Available', 'Pending'];
    const tableData = items.map((item, index) => {
      const material = materials.find(m => m.id === item.item_id);
      const row = [
        index + 1,
        material?.display_name || material?.name || '-',
        item.qty_required || 0
      ];
      
      warehouses.forEach(wh => {
        const snapshot = item.warehouse_snapshot || {};
        row.push(snapshot[wh.id] || 0);
      });
      
      row.push(item.total_available || 0);
      row.push(item.pending_qty || 0);
      
      return row;
    });

    doc.autoTable({
      startY: 65,
      head: [tableHeaders],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [66, 66, 66] },
      styles: { fontSize: 8 },
      columnStyles: tableHeaders.reduce((acc, _, idx) => {
        if (idx >= 2) acc[idx] = { halign: 'right' };
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
        backgroundColor: '#ffffff'
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

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-IN');
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

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">
          {editId ? 'Edit Stock Check' : isViewMode ? 'Stock Check Details' : 'New Stock Check'}
        </h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          {!isReadOnly && (
            <>
              <button className="btn btn-secondary" onClick={() => setShowPreview(true)}>
                Generate Preview
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </>
          )}
          {isViewMode && (
            <>
              <button className="btn btn-secondary" onClick={handleExportPDF}>
                Export PDF
              </button>
              <button className="btn btn-secondary" onClick={handleExportImage}>
                Export Image
              </button>
              <button className="btn btn-secondary" onClick={() => setShowEmailModal(true)}>
                Send Email
              </button>
            </>
          )}
        </div>
      </div>

      <div style={{ background: '#f8f9fa', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontWeight: 600, fontSize: '11px' }}>Client Name *</label>
            <input
              type="text"
              className="form-input"
              value={formData.client_name}
              onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
              disabled={isReadOnly}
              placeholder="Enter client name"
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontWeight: 600, fontSize: '11px' }}>Date</label>
            <input
              type="date"
              className="form-input"
              value={formData.check_date}
              onChange={(e) => setFormData({ ...formData, check_date: e.target.value })}
              disabled={isReadOnly}
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontWeight: 600, fontSize: '11px' }}>Variant Filter</label>
            <select
              className="form-select"
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
            <label className="form-label" style={{ fontWeight: 600, fontSize: '11px' }}>Check No</label>
            <input
              type="text"
              className="form-input"
              value={formData.check_no || 'Auto-generated'}
              disabled
            />
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0 }}>Items</h3>
          {!isReadOnly && (
            <button className="btn btn-primary" onClick={handleAddItem}>
              + Add Item
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
            No items added. Click "Add Item" to add items for stock check.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ minWidth: '800px' }}>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>#</th>
                  <th>Item</th>
                  {formData.variant_filter !== 'Non-Variant' && <th>Variant</th>}
                  <th style={{ width: '100px' }}>Qty Required</th>
                  {warehouses.map(wh => (
                    <th key={wh.id} style={{ width: '80px', textAlign: 'right' }}>{wh.warehouse_name}</th>
                  ))}
                  <th style={{ width: '100px', textAlign: 'right' }}>Total Available</th>
                  <th style={{ width: '100px', textAlign: 'right' }}>Pending</th>
                  {!isReadOnly && <th style={{ width: '40px' }}></th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={item.id} style={item.pending_qty > 0 ? { background: '#fef2f2' } : {}}>
                    <td>{index + 1}</td>
                    <td>
                      <select
                        className="form-select"
                        style={{ minWidth: '150px' }}
                        value={item.item_id}
                        onChange={(e) => handleItemChange(index, 'item_id', e.target.value)}
                        disabled={isReadOnly}
                      >
                        <option value="">Select Item</option>
                        {materials.map(m => (
                          <option key={m.id} value={m.id}>{m.display_name || m.name}</option>
                        ))}
                      </select>
                    </td>
                    {formData.variant_filter !== 'Non-Variant' && (
                      <td>
                        <select
                          className="form-select"
                          style={{ minWidth: '120px' }}
                          value={item.company_variant_id || ''}
                          onChange={(e) => handleItemChange(index, 'company_variant_id', e.target.value || null)}
                          disabled={isReadOnly}
                        >
                          <option value="">Select Variant</option>
                          {variants.map(v => (
                            <option key={v.id} value={v.id}>{v.variant_name}</option>
                          ))}
                        </select>
                      </td>
                    )}
                    <td>
                      <input
                        type="number"
                        className="form-input"
                        style={{ textAlign: 'right' }}
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
                        <td key={wh.id} style={{ textAlign: 'right' }}>
                          {formatCurrency(snapshot[wh.id] || 0)}
                        </td>
                      );
                    })}
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {formatCurrency(item.total_available || 0)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: (item.pending_qty || 0) > 0 ? '#dc2626' : '#047857' }}>
                      {formatCurrency(item.pending_qty || 0)}
                    </td>
                    {!isReadOnly && (
                      <td>
                        <button
                          className="btn btn-sm"
                          style={{ color: '#dc2626', padding: '4px 8px' }}
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
        <button className="btn btn-secondary" onClick={() => navigate('/quick-stock-check')}>
          Back to List
        </button>
      </div>

      {showPreview && (
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
          zIndex: 1000
        }} onClick={() => setShowPreview(false)}>
          <div style={{
            background: '#fff',
            borderRadius: '8px',
            width: '95%',
            maxWidth: '1200px',
            maxHeight: '90vh',
            overflow: 'auto'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Preview</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-primary" onClick={handleExportPDF}>Export PDF</button>
                <button className="btn btn-secondary" onClick={handleExportImage}>Export Image</button>
                <button className="btn btn-secondary" onClick={() => setShowEmailModal(true)}>Send Email</button>
                <button onClick={() => setShowPreview(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>×</button>
              </div>
            </div>
            <div ref={previewRef} style={{ padding: '24px' }}>
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <h2 style={{ margin: 0 }}>QUICK STOCK AVAILABILITY CHECK</h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div><strong>Check No:</strong> {formData.check_no || 'Auto-generated'}</div>
                <div><strong>Date:</strong> {formatDate(formData.check_date)}</div>
                <div><strong>Client:</strong> {formData.client_name}</div>
                <div><strong>Variant Filter:</strong> {formData.variant_filter}</div>
              </div>
              <table className="table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Item</th>
                    <th style={{ textAlign: 'right' }}>Qty Required</th>
                    {warehouses.map(wh => (
                      <th key={wh.id} style={{ textAlign: 'right' }}>{wh.warehouse_name}</th>
                    ))}
                    <th style={{ textAlign: 'right' }}>Total Available</th>
                    <th style={{ textAlign: 'right' }}>Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    const material = getSelectedMaterial(item.item_id);
                    return (
                      <tr key={item.id} style={item.pending_qty > 0 ? { background: '#fef2f2' } : {}}>
                        <td>{index + 1}</td>
                        <td>{material?.display_name || material?.name || '-'}</td>
                        <td style={{ textAlign: 'right' }}>{item.qty_required || 0}</td>
                        {warehouses.map(wh => {
                          const snapshot = item.warehouse_snapshot || {};
                          return (
                            <td key={wh.id} style={{ textAlign: 'right' }}>
                              {formatCurrency(snapshot[wh.id] || 0)}
                            </td>
                          );
                        })}
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(item.total_available || 0)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: (item.pending_qty || 0) > 0 ? '#dc2626' : '#047857' }}>
                          {formatCurrency(item.pending_qty || 0)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
