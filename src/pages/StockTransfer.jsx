import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function StockTransfer({ onCancel }) {
  const [transfers, setTransfers] = useState([]);
  const [view, setView] = useState('list');
  const [editingTransfer, setEditingTransfer] = useState(null);
  
  useEffect(() => {
    loadTransfers();
  }, []);

  const loadTransfers = async () => {
    const { data } = await supabase
      .from('stock_transfers')
      .select('*, from_warehouse:warehouses!from_warehouse_id(warehouse_name, name), to_warehouse:warehouses!to_warehouse_id(warehouse_name, name)')
      .order('created_at', { ascending: false });
    setTransfers(data || []);
  };

  const generateTransferNo = async () => {
    const { count } = await supabase.from('stock_transfers').select('*', { count: 'exact' });
    const num = (count || 0) + 1;
    return `TRF-${String(num).padStart(5, '0')}`;
  };

  if (view === 'form') {
    return (
      <TransferForm 
        transfer={editingTransfer} 
        onSave={() => { setView('list'); loadTransfers(); }}
        onCancel={() => setView('list')}
      />
    );
  }

  const getStatusBadge = (status) => {
    const colors = {
      DRAFT: { bg: '#fff3cd', color: '#856404' },
      ON_TRANSIT: { bg: '#cce5ff', color: '#004085' },
      STOCK_RECEIVED: { bg: '#d4edda', color: '#155724' }
    };
    const style = colors[status] || colors.DRAFT;
    return (
      <span style={{ 
        padding: '4px 12px', 
        borderRadius: '12px', 
        fontSize: '12px',
        background: style.bg,
        color: style.color
      }}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Stock Transfers</h1>
        <button className="btn btn-primary" onClick={() => { setEditingTransfer(null); setView('form'); }}>
          + New Transfer
        </button>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Transfer No</th>
              <th>Date</th>
              <th>From</th>
              <th>To</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {transfers.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: '#666' }}>No transfers found</td></tr>
            ) : transfers.map(t => (
              <tr key={t.id}>
                <td><strong>{t.transfer_no}</strong></td>
                <td>{t.transfer_date}</td>
                <td>{t.from_warehouse?.warehouse_name || t.from_warehouse?.name || '-'}</td>
                <td>{t.to_warehouse?.warehouse_name || t.to_warehouse?.name || '-'}</td>
                <td>{getStatusBadge(t.status)}</td>
                <td>
                  <button className="btn btn-sm btn-secondary" onClick={() => { setEditingTransfer(t); setView('form'); }}>Edit</button>
                  {(t.status === 'ON_TRANSIT' || t.status === 'STOCK_RECEIVED') && (
                    <button className="btn btn-sm btn-secondary" style={{ marginLeft: '4px' }} onClick={() => generatePDF(t)}>PDF</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TransferForm({ transfer, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    transfer_date: new Date().toISOString().split('T')[0],
    from_warehouse_id: '',
    to_warehouse_id: '',
    vehicle_no: '',
    transporter_name: '',
    status: 'DRAFT',
    remarks: ''
  });
  const [items, setItems] = useState([
    { id: 1, item_id: '', variant_id: '', available_qty: 0, quantity: '', valid: false }
  ]);
  const [materials, setMaterials] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [variants, setVariants] = useState([]);
  const [stock, setStock] = useState([]);
  const [nextId, setNextId] = useState(2);
  const [loading, setLoading] = useState(false);

  const isEditing = !!transfer;
  const isLocked = transfer?.status !== 'DRAFT';

  useEffect(() => { loadData(); }, []);
  
  useEffect(() => {
    if (transfer) {
      setFormData({
        transfer_date: transfer.transfer_date,
        from_warehouse_id: transfer.from_warehouse_id,
        to_warehouse_id: transfer.to_warehouse_id,
        vehicle_no: transfer.vehicle_no || '',
        transporter_name: transfer.transporter_name || '',
        status: transfer.status,
        remarks: transfer.remarks || ''
      });
      loadTransferItems(transfer.id);
    }
  }, [transfer]);

  const loadData = async () => {
    console.log('Loading stock transfer data...');
    const [mat, wh, varData, stockData] = await Promise.all([
      supabase.from('materials').select('id, display_name, name, unit').eq('is_active', true).order('name'),
      supabase.from('warehouses').select('*').order('warehouse_name'),
      supabase.from('company_variants').select('*').eq('is_active', true).order('variant_name'),
      supabase.from('item_stock').select('*')
    ]);
    console.log('Warehouses:', wh.data);
    setMaterials(mat.data || []);
    setWarehouses(wh.data || []);
    setVariants(varData.data || []);
    setStock(stockData.data || []);
  };

  const loadTransferItems = async (transferId) => {
    const { data } = await supabase
      .from('stock_transfer_items')
      .select('*')
      .eq('transfer_id', transferId);
    
    if (data) {
      const loadedItems = data.map((item, idx) => ({
        id: idx + 1,
        item_id: item.item_id,
        variant_id: item.company_variant_id,
        quantity: item.quantity,
        available_qty: getAvailableQty(item.item_id, item.company_variant_id),
        valid: true
      }));
      setItems(loadedItems);
      setNextId(loadedItems.length + 1);
    }
  };

  const getAvailableQty = (itemId, variantId) => {
    if (!formData.from_warehouse_id) return 0;
    const s = stock.find(x => 
      x.item_id === itemId && 
      x.warehouse_id === formData.from_warehouse_id &&
      (variantId ? x.company_variant_id === variantId : !x.company_variant_id)
    );
    return parseFloat(s?.current_stock) || 0;
  };

  const getMaterial = (id) => materials.find(m => m.id === id);
  const getWarehouse = (id) => {
    const w = warehouses.find(x => x.id === id);
    return w ? (w.warehouse_name || w.name || 'Warehouse') : '-';
  };

  const addItem = () => {
    setItems([...items, { id: nextId, item_id: '', variant_id: '', available_qty: 0, quantity: '', valid: false }]);
    setNextId(nextId + 1);
  };

  const removeItem = (id) => {
    if (isLocked) return;
    setItems(items.filter(i => i.id !== id));
  };

  const updateItem = (id, field, value) => {
    if (isLocked) return;
    
    setItems(items.map(item => {
      if (item.id !== id) return item;
      
      const updates = { [field]: value };
      
      if (field === 'item_id' && value) {
        updates.available_qty = getAvailableQty(value, item.variant_id);
      }
      if (field === 'variant_id' && item.item_id) {
        updates.available_qty = getAvailableQty(item.item_id, value);
      }
      
      const qty = parseFloat(updates.quantity !== undefined ? updates.quantity : item.quantity) || 0;
      const avail = updates.available_qty !== undefined ? updates.available_qty : item.available_qty;
      updates.valid = !!(item.item_id || updates.item_id) && qty > 0 && qty <= avail;
      
      return { ...item, ...updates };
    }));
  };

  const handleWarehouseChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
    if (field === 'from_warehouse_id') {
      setItems(items.map(item => ({
        ...item,
        available_qty: item.item_id ? getAvailableQty(item.item_id, item.variant_id) : 0
      })));
    }
  };

  const validateForm = () => {
    if (!formData.transfer_date) { alert('Select transfer date'); return false; }
    if (!formData.from_warehouse_id) { alert('Select from warehouse'); return false; }
    if (!formData.to_warehouse_id) { alert('Select to warehouse'); return false; }
    if (formData.from_warehouse_id === formData.to_warehouse_id) { alert('From and To warehouses must be different'); return false; }
    
    const validItems = items.filter(i => i.valid);
    if (validItems.length === 0) { alert('Add at least one valid item'); return false; }
    
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    setLoading(true);
    try {
      let transferId;
      
      if (isEditing) {
        await supabase.from('stock_transfers').update({
          ...formData,
          updated_at: new Date().toISOString()
        }).eq('id', transfer.id);
        transferId = transfer.id;
        await supabase.from('stock_transfer_items').delete().eq('transfer_id', transferId);
      } else {
        const transferNo = await generateTransferNo();
        const { data } = await supabase.from('stock_transfers').insert({
          ...formData,
          transfer_no: transferNo
        }).select().single();
        transferId = data.id;
      }

      const validItems = items.filter(i => i.valid);
      const itemsToSave = validItems.map(item => ({
        transfer_id: transferId,
        item_id: item.item_id,
        company_variant_id: item.variant_id || null,
        quantity: parseFloat(item.quantity)
      }));
      
      await supabase.from('stock_transfer_items').insert(itemsToSave);
      
      alert('Transfer saved successfully!');
      onSave();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (!transfer) return;
    
    if (newStatus === 'ON_TRANSIT') {
      if (!formData.vehicle_no) { alert('Enter vehicle number'); return; }
      
      const validItems = items.filter(i => i.valid);
      for (const item of validItems) {
        const avail = getAvailableQty(item.item_id, item.variant_id);
        if (parseFloat(item.quantity) > avail) {
          alert(`Insufficient stock for ${getMaterial(item.item_id)?.display_name || getMaterial(item.item_id)?.name}`);
          return;
        }
      }
      
      try {
        setLoading(true);
        
        for (const item of validItems) {
          const { data: existing } = await supabase.from('item_stock')
            .select('*')
            .eq('item_id', item.item_id)
            .eq('company_variant_id', item.variant_id || null)
            .eq('warehouse_id', formData.from_warehouse_id)
            .single();
          
          if (existing) {
            await supabase.from('item_stock')
              .update({ current_stock: (parseFloat(existing.current_stock) || 0) - parseFloat(item.quantity) })
              .eq('id', existing.id);
          }
        }
        
        await supabase.from('stock_transfers').update({
          status: 'ON_TRANSIT',
          dispatched_at: new Date().toISOString()
        }).eq('id', transfer.id);
        
        alert('Stock deducted and transfer initiated!');
        onSave();
      } catch (err) {
        alert('Error: ' + err.message);
      } finally {
        setLoading(false);
      }
    }
    
    if (newStatus === 'STOCK_RECEIVED') {
      if (!formData.received_date) { alert('Enter received date'); return; }
      
      try {
        setLoading(true);
        
        const validItems = items.filter(i => i.valid);
        for (const item of validItems) {
          const { data: existing } = await supabase.from('item_stock')
            .select('*')
            .eq('item_id', item.item_id)
            .eq('company_variant_id', item.variant_id || null)
            .eq('warehouse_id', formData.to_warehouse_id)
            .single();
          
          if (existing) {
            await supabase.from('item_stock')
              .update({ 
                current_stock: (parseFloat(existing.current_stock) || 0) + parseFloat(item.quantity),
                updated_at: new Date().toISOString()
              })
              .eq('id', existing.id);
          } else {
            await supabase.from('item_stock').insert({
              item_id: item.item_id,
              company_variant_id: item.variant_id || null,
              warehouse_id: formData.to_warehouse_id,
              current_stock: parseFloat(item.quantity)
            });
          }
        }
        
        await supabase.from('stock_transfers').update({
          status: 'STOCK_RECEIVED',
          received_date: formData.received_date,
          received_at: new Date().toISOString()
        }).eq('id', transfer.id);
        
        alert('Stock received and added to destination warehouse!');
        onSave();
      } catch (err) {
        alert('Error: ' + err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const generateTransferNo = async () => {
    const { count } = await supabase.from('stock_transfers').select('*', { count: 'exact' });
    const num = (count || 0) + 1;
    return `TRF-${String(num).padStart(5, '0')}`;
  };

  const generatePDF = async (t) => {
    const doc = new jsPDF();
    const tf = t || transfer;
    
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('STOCK TRANSFER NOTE', 105, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Transfer No: ${tf.transfer_no}`, 14, 35);
    doc.text(`Date: ${tf.transfer_date}`, 14, 42);
    doc.text(`Status: ${tf.status}`, 14, 49);
    
    doc.text('From Warehouse:', 14, 60);
    doc.setFont('helvetica', 'bold');
    doc.text(getWarehouse(tf.from_warehouse_id)?.warehouse_name || '-', 50, 60);
    
    doc.setFont('helvetica', 'normal');
    doc.text('To Warehouse:', 14, 67);
    doc.setFont('helvetica', 'bold');
    doc.text(getWarehouse(tf.to_warehouse_id)?.warehouse_name || '-', 50, 67);
    
    doc.setFont('helvetica', 'normal');
    doc.text(`Vehicle No: ${tf.vehicle_no || '-'}`, 14, 77);
    doc.text(`Transporter: ${tf.transporter_name || '-'}`, 80, 77);
    
    const { data: transferItems } = await supabase
      .from('stock_transfer_items')
      .select('*, item:materials(display_name, name), variant:company_variants(variant_name)')
      .eq('transfer_id', tf.id);
    
    const tableData = (transferItems || []).map((item, idx) => [
      idx + 1,
      item.item?.display_name || item.item?.name || '-',
      item.variant?.variant_name || '-',
      item.quantity
    ]);
    
    doc.autoTable({
      startY: 85,
      head: [['#', 'Item', 'Variant', 'Quantity']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [26, 26, 26] }
    });
    
    const finalY = doc.lastAutoTable.finalY + 20;
    doc.text('Dispatched By:', 14, finalY);
    doc.text('_____________________', 14, finalY + 10);
    doc.text('Date: _____________', 14, finalY + 20);
    
    doc.text('Received By:', 120, finalY);
    doc.text('_____________________', 120, finalY + 10);
    doc.text('Date: _____________', 120, finalY + 20);
    
    doc.save(`${tf.transfer_no}.pdf`);
  };

  const activeVariants = variants.filter(v => v.variant_name !== 'No Variant');
  const validItems = items.filter(i => i.valid);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{isEditing ? 'Edit Transfer' : 'New Stock Transfer'}</h1>
      </div>

      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ background: '#f8f9fa', padding: '16px 20px', borderBottom: '1px solid #e0e0e0' }}>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ margin: 0, minWidth: '130px' }}>
              <label className="form-label">Transfer Date *</label>
              <input type="date" className="form-input" value={formData.transfer_date} onChange={e => setFormData({...formData, transfer_date: e.target.value})} disabled={isLocked} />
            </div>
            <div className="form-group" style={{ margin: 0, minWidth: '150px' }}>
              <label className="form-label">From Warehouse *</label>
              <select className="form-select" value={formData.from_warehouse_id} onChange={e => handleWarehouseChange('from_warehouse_id', e.target.value)} disabled={isLocked}>
                <option value="">Select</option>
                {warehouses.map(w => (<option key={w.id} value={w.id}>{w.warehouse_name || w.name || 'Warehouse'}</option>))}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0, minWidth: '150px' }}>
              <label className="form-label">To Warehouse *</label>
              <select className="form-select" value={formData.to_warehouse_id} onChange={e => setFormData({...formData, to_warehouse_id: e.target.value})} disabled={isLocked}>
                <option value="">Select</option>
                {warehouses.filter(w => w.id !== formData.from_warehouse_id).map(w => (<option key={w.id} value={w.id}>{w.warehouse_name || w.name || 'Warehouse'}</option>))}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0, minWidth: '120px' }}>
              <label className="form-label">Vehicle No</label>
              <input type="text" className="form-input" value={formData.vehicle_no} onChange={e => setFormData({...formData, vehicle_no: e.target.value})} placeholder="XX-XX-XXXX" disabled={isLocked && formData.status !== 'DRAFT'} />
            </div>
            <div className="form-group" style={{ margin: 0, minWidth: '140px' }}>
              <label className="form-label">Transporter</label>
              <input type="text" className="form-input" value={formData.transporter_name} onChange={e => setFormData({...formData, transporter_name: e.target.value})} placeholder="Name" disabled={isLocked} />
            </div>
          </div>
        </div>

        {!isEditing && (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>#</th>
                  <th style={{ minWidth: '250px' }}>Item</th>
                  <th style={{ width: '150px' }}>Variant</th>
                  <th style={{ width: '100px' }}>Available</th>
                  <th style={{ width: '100px' }}>Transfer Qty</th>
                  <th style={{ width: '40px' }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={item.id}>
                    <td style={{ textAlign: 'center' }}>{index + 1}</td>
                    <td>
                      <select value={item.item_id} onChange={e => updateItem(item.id, 'item_id', e.target.value)} disabled={isLocked} style={{ width: '100%', padding: '6px' }}>
                        <option value="">Select Item</option>
                        {materials.map(m => (<option key={m.id} value={m.id}>{m.display_name || m.name}</option>))}
                      </select>
                    </td>
                    <td>
                      <select value={item.variant_id || ''} onChange={e => updateItem(item.id, 'variant_id', e.target.value)} disabled={isLocked} style={{ width: '100%', padding: '6px' }}>
                        <option value="">Select</option>
                        {activeVariants.map(v => (<option key={v.id} value={v.id}>{v.variant_name}</option>))}
                      </select>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: '600', color: item.quantity > item.available_qty ? '#dc3545' : '#28a745' }}>
                      {item.available_qty.toFixed(2)}
                    </td>
                    <td>
                      <input type="number" value={item.quantity} onChange={e => updateItem(item.id, 'quantity', e.target.value)} disabled={isLocked} placeholder="0" style={{ width: '100%', padding: '6px', textAlign: 'right' }} />
                    </td>
                    <td>
                      {!isLocked && items.length > 1 && (
                        <button onClick={() => removeItem(item.id)} style={{ background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer', fontSize: '18px' }}>×</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {isEditing && (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>#</th>
                  <th>Item</th>
                  <th>Variant</th>
                  <th>Quantity</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={item.id}>
                    <td>{idx + 1}</td>
                    <td>{getMaterial(item.item_id)?.display_name || getMaterial(item.item_id)?.name}</td>
                    <td>{activeVariants.find(v => v.id === item.variant_id)?.variant_name || '-'}</td>
                    <td>{item.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!isEditing && (
          <button onClick={addItem} style={{ margin: '12px 20px', padding: '8px 16px', background: '#fff', border: '1px dashed #3498db', borderRadius: '4px', color: '#3498db', cursor: 'pointer' }}>
            + Add Item
          </button>
        )}

        <div style={{ background: '#f8f9fa', padding: '16px 20px', borderTop: '1px solid #e0e0e0' }}>
          <div className="form-group">
            <label className="form-label">Remarks</label>
            <textarea className="form-textarea" value={formData.remarks} onChange={e => setFormData({...formData, remarks: e.target.value})} disabled={isLocked} rows={2} />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
        {!isEditing && <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>{loading ? 'Saving...' : 'Create Transfer'}</button>}
        
        {isEditing && formData.status === 'DRAFT' && (
          <button className="btn btn-primary" onClick={() => handleStatusChange('ON_TRANSIT')} disabled={loading}>
            Dispatch (On Transit)
          </button>
        )}
        
        {isEditing && formData.status === 'ON_TRANSIT' && (
          <>
            <div className="form-group" style={{ margin: 0 }}>
              <input type="date" className="form-input" value={formData.received_date || ''} onChange={e => setFormData({...formData, received_date: e.target.value})} />
            </div>
            <button className="btn btn-primary" onClick={() => handleStatusChange('STOCK_RECEIVED')} disabled={loading}>
              Mark Received
            </button>
          </>
        )}
        
        {(isEditing && (formData.status === 'ON_TRANSIT' || formData.status === 'STOCK_RECEIVED')) && (
          <button className="btn btn-secondary" onClick={() => generatePDF(transfer)}>Download PDF</button>
        )}
        
        <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
