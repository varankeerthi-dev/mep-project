import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function StockTransfer({ onCancel }) {
  const [transfers, setTransfers] = useState([]);
  const [view, setView] = useState('list');
  const [editingTransfer, setEditingTransfer] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [variants, setVariants] = useState([]);
  const [stock, setStock] = useState([]);
  const [items, setItems] = useState([{ id: 1, item_id: '', variant_id: '', available_qty: 0, quantity: '', valid: false }]);
  const [formData, setFormData] = useState({
    transfer_date: new Date().toISOString().split('T')[0],
    from_warehouse_id: '',
    to_warehouse_id: '',
    vehicle_no: '',
    transporter_name: '',
    status: 'DRAFT',
    remarks: ''
  });
  const [nextId, setNextId] = useState(2);
  const [loading, setLoading] = useState(false);

  const isEditing = !!editingTransfer;
  const isLocked = editingTransfer?.status !== 'DRAFT';

  useEffect(() => {
    if (view === 'form') {
      loadData();
    } else {
      loadTransfers();
    }
  }, [view]);

  const loadTransfers = async () => {
    const { data } = await supabase
      .from('stock_transfers')
      .select('*')
      .order('created_at', { ascending: false });
    setTransfers(data || []);
  };

  const loadData = async () => {
    try {
      const [mat, wh, varData, stockData] = await Promise.all([
        supabase.from('materials').select('id, item_code, display_name, name, unit').eq('is_active', true).order('name'),
        supabase.from('warehouses').select('*').eq('is_active', true).order('warehouse_name'),
        supabase.from('company_variants').select('*').eq('is_active', true).order('variant_name'),
        supabase.from('item_stock').select('*')
      ]);
      
      setMaterials(mat.data || []);
      setWarehouses(wh.data || []);
      setVariants(varData.data || []);
      setStock(stockData.data || []);
    } catch (err) {
      console.error('Error loading data:', err);
    }
  };

  const generateTransferNo = async () => {
    const { count } = await supabase.from('stock_transfers').select('*', { count: 'exact' });
    const num = (count || 0) + 1;
    return `TRF-${String(num).padStart(5, '0')}`;
  };

  const getStatusBadge = (status) => {
    const colors = { DRAFT: '#fff3cd', ON_TRANSIT: '#cce5ff', STOCK_RECEIVED: '#d4edda' };
    return <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '12px', background: colors[status] || colors.DRAFT }}>{status}</span>;
  };

  const getAvailableQty = (itemId, variantId) => {
    if (!formData.from_warehouse_id) return 0;
    const s = stock.find(x => x.item_id === itemId && x.warehouse_id === formData.from_warehouse_id);
    return parseFloat(s?.current_stock) || 0;
  };

  const getMaterial = (id) => materials.find(m => m.id === id);

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
      const transferNo = await generateTransferNo();
      const { data } = await supabase.from('stock_transfers').insert({ ...formData, transfer_no: transferNo }).select().single();
      
      const validItems = items.filter(i => i.valid);
      const itemsToSave = validItems.map(item => ({
        transfer_id: data.id,
        item_id: item.item_id,
        company_variant_id: item.variant_id || null,
        quantity: parseFloat(item.quantity)
      }));
      await supabase.from('stock_transfer_items').insert(itemsToSave);
      alert('Transfer saved!');
      setView('list');
      loadTransfers();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (view === 'list') {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">Stock Transfers</h1>
          <button className="btn btn-primary" onClick={() => { setEditingTransfer(null); setView('form'); }}>+ New Transfer</button>
        </div>
        <div className="card">
          <table className="table">
            <thead><tr><th>Transfer No</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {transfers.length === 0 ? <tr><td colSpan={4}>No transfers</td></tr> : transfers.map(t => (
                <tr key={t.id}>
                  <td><strong>{t.transfer_no}</strong></td>
                  <td>{t.transfer_date}</td>
                  <td>{getStatusBadge(t.status)}</td>
                  <td><button className="btn btn-sm btn-secondary" onClick={() => { setEditingTransfer(t); setView('form'); }}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{isEditing ? 'Edit Transfer' : 'New Stock Transfer'}</h1>
      </div>
      <div className="card" style={{ padding: '0' }}>
        <div style={{ background: '#f8f9fa', padding: '16px', borderBottom: '1px solid #e0e0e0' }}>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div><label className="form-label">Transfer Date *</label><input type="date" className="form-input" value={formData.transfer_date} onChange={e => setFormData({...formData, transfer_date: e.target.value})} /></div>
            <div><label className="form-label">From Warehouse *</label>
              <select className="form-select" value={formData.from_warehouse_id} onChange={e => setFormData({...formData, from_warehouse_id: e.target.value})}>
                <option value="">Select</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.warehouse_name}</option>)}
              </select>
            </div>
            <div><label className="form-label">To Warehouse *</label>
              <select className="form-select" value={formData.to_warehouse_id} onChange={e => setFormData({...formData, to_warehouse_id: e.target.value})}>
                <option value="">Select</option>
                {warehouses.filter(w => w.id !== formData.from_warehouse_id).map(w => <option key={w.id} value={w.id}>{w.warehouse_name}</option>)}
              </select>
            </div>
            <div><label className="form-label">Vehicle No</label><input type="text" className="form-input" value={formData.vehicle_no} onChange={e => setFormData({...formData, vehicle_no: e.target.value})} placeholder="XX-XX-XXXX" /></div>
          </div>
        </div>
        <table className="table">
          <thead><tr><th>#</th><th>Item</th><th>Variant</th><th>Available</th><th>Qty</th><th></th></tr></thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={item.id}>
                <td>{index + 1}</td>
                <td>
                  <select value={item.item_id} onChange={e => updateItem(item.id, 'item_id', e.target.value)} style={{ width: '100%', padding: '6px' }}>
                    <option value="">Select</option>
                    {materials.map(m => <option key={m.id} value={m.id}>{m.display_name || m.name}</option>)}
                  </select>
                </td>
                <td>
                  <select value={item.variant_id || ''} onChange={e => updateItem(item.id, 'variant_id', e.target.value)} style={{ width: '100%', padding: '6px' }}>
                    <option value="">Select</option>
                    {variants.map(v => <option key={v.id} value={v.id}>{v.variant_name}</option>)}
                  </select>
                </td>
                <td style={{ textAlign: 'right' }}>{item.available_qty}</td>
                <td><input type="number" value={item.quantity} onChange={e => updateItem(item.id, 'quantity', e.target.value)} style={{ width: '80px', padding: '6px' }} /></td>
                <td><button onClick={() => removeItem(item.id)} style={{ background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer' }}>×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={addItem} style={{ margin: '12px', padding: '8px 16px', background: '#fff', border: '1px dashed #3498db', borderRadius: '4px', color: '#3498db' }}>+ Add Item</button>
      </div>
      <div style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>{loading ? 'Saving...' : 'Create Transfer'}</button>
        <button className="btn btn-secondary" onClick={() => setView('list')}>Cancel</button>
      </div>
    </div>
  );
}
