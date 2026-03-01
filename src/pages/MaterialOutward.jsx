import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function MaterialOutward({ onSuccess, onCancel }) {
  const [materials, setMaterials] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [variants, setVariants] = useState([]);
  const [formData, setFormData] = useState({ outward_date: new Date().toISOString().split('T')[0], project_id: '', remarks: '', warehouse_id: '', variant_id: '' });
  const [items, setItems] = useState([{ item_id: '', quantity: '' }]);
  
  const loadData = async () => {
    const [mat, wh, varData] = await Promise.all([
      supabase.from('materials').select('id, display_name, name').eq('is_active', true).order('name'),
      supabase.from('warehouses').select('*'),
      supabase.from('company_variants').select('*').eq('is_active', true).order('variant_name')
    ]);
    setMaterials(mat.data || []);
    setWarehouses(wh.data || []);
    setVariants(varData.data || []);
  };

  useEffect(() => { loadData(); }, []);

  const addItem = () => setItems([...items, { item_id: '', quantity: '' }]);
  const updateItem = (i, field, val) => { const n = [...items]; n[i][field] = val; setItems(n); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.warehouse_id) { alert('Please select a warehouse'); return; }
    if (!formData.variant_id) { alert('Please select a variant'); return; }
    
    const { data: outward } = await supabase.from('material_outward').insert(formData).select().single();
    
    for (const item of items.filter(i => i.item_id)) {
      const qty = parseFloat(item.quantity) || 0;
      
      await supabase.from('material_outward_items').insert({
        outward_id: outward.id,
        material_id: item.item_id,
        variant_id: formData.variant_id,
        warehouse_id: formData.warehouse_id,
        quantity: qty
      });
      
      const { data: existing } = await supabase.from('item_stock').select('*').eq('item_id', item.item_id).eq('company_variant_id', formData.variant_id).eq('warehouse_id', formData.warehouse_id).single();
      
      if (existing) {
        const newStock = Math.max(0, (existing.current_stock || 0) - qty);
        await supabase.from('item_stock').update({ current_stock: newStock, updated_at: new Date().toISOString() }).eq('id', existing.id);
      }
    }
    onSuccess();
  };

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Material Outward</h1></div>
      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Date</label><input type="date" className="form-input" value={formData.outward_date} onChange={e => setFormData({...formData, outward_date: e.target.value})} /></div>
            <div className="form-group"><label className="form-label">Warehouse *</label><select className="form-select" value={formData.warehouse_id} onChange={e => setFormData({...formData, warehouse_id: e.target.value})} required><option value="">Select Warehouse</option>{warehouses.map(w => (<option key={w.id} value={w.id}>{w.warehouse_name || w.name}</option>))}</select></div>
            <div className="form-group"><label className="form-label">Variant *</label><select className="form-select" value={formData.variant_id} onChange={e => setFormData({...formData, variant_id: e.target.value})} required><option value="">Select Variant</option>{variants.map(v => (<option key={v.id} value={v.id}>{v.variant_name}</option>))}</select></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Project</label><select className="form-select" value={formData.project_id} onChange={e => setFormData({...formData, project_id: e.target.value})}><option value="">Select Project</option></select></div>
          </div>
          <div className="form-group">
            <label className="form-label">Items</label>
            <div className="item-list">
              <div className="item-row header"><span>Item</span><span>Qty</span><span></span></div>
              {items.map((item, i) => (
                <div className="item-row" key={i}>
                  <select value={item.item_id} onChange={e => updateItem(i, 'item_id', e.target.value)}><option value="">Select Item</option>{materials.map(m => (<option key={m.id} value={m.id}>{m.display_name || m.name}</option>))}</select>
                  <input type="number" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} placeholder="Qty" />
                  <span className="delete-btn" onClick={() => setItems(items.filter((_, idx) => idx !== i))}>×</span>
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={addItem} style={{marginTop:'12px'}}>+ Add Item</button>
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}><button type="submit" className="btn btn-primary">Submit</button><button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button></div>
        </form>
      </div>
    </div>
  );
}
