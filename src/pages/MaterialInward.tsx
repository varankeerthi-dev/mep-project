import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function MaterialInward({ onCancel }) {
  const [materials, setMaterials] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [variants, setVariants] = useState([]);
  const [projects, setProjects] = useState([]);
  const [pricing, setPricing] = useState({});
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteData, setPasteData] = useState('');
  const [formData, setFormData] = useState({ 
    invoice_date: '',
    inward_date: new Date().toISOString().split('T')[0],
    received_date: new Date().toISOString().split('T')[0], 
    vendor_name: '', 
    invoice_no: '', 
    warehouse_id: '', 
    default_variant_id: '',
    received_by: '',
    acknowledged_by: '',
    remarks: '',
    supply_type: 'WAREHOUSE',
    project_id: ''
  });
  const [items, setItems] = useState([
    { id: 1, item_id: '', variant_id: '', quantity: '', rate: '', amount: 0, uses_variant: false, supply_type: 'WAREHOUSE', project_id: '', valid: false, is_service: false }
  ]);
  const [nextId, setNextId] = useState(2);
  
  useEffect(() => { loadData(); }, []);
  
  const loadData = async () => {
    const [mat, wh, varData, priceData, projData] = await Promise.all([
      supabase.from('materials').select('id, item_code, display_name, name, unit, uses_variant, sale_price, item_type').order('name'),
      supabase.from('warehouses').select('*'),
      supabase.from('company_variants').select('*').order('variant_name'),
      supabase.from('item_variant_pricing').select('item_id, company_variant_id, sale_price'),
      supabase.from('projects').select('id, name').order('name')
    ]);
    setMaterials(mat.data || []);
    setWarehouses(wh.data || []);
    setVariants(varData.data || []);
    setProjects(projData.data || []);
    
    const priceMap = {};
    priceData?.forEach(p => {
      if (!priceMap[p.item_id]) priceMap[p.item_id] = {};
      priceMap[p.item_id][p.company_variant_id] = p.sale_price;
    });
    setPricing(priceMap);
  };

  const getMaterial = (id) => materials.find(m => m.id === id);
  
  const getRate = (itemId, variantId) => {
    if (variantId && pricing[itemId]?.[variantId]) {
      return pricing[itemId][variantId];
    }
    const mat = getMaterial(itemId);
    return mat?.sale_price || 0;
  };

  const addItem = () => {
    setItems([...items, { id: nextId, item_id: '', variant_id: '', quantity: '', rate: '', amount: 0, uses_variant: false, supply_type: 'WAREHOUSE', project_id: '', valid: false }]);
    setNextId(nextId + 1);
  };

  const removeItem = (id) => {
    setItems(items.filter(i => i.id !== id));
  };

  const updateItem = (id, field, value) => {
    setItems(items.map(item => {
      if (item.id !== id) return item;
      
      const updates = { [field]: value };
      
      if (field === 'item_id' && value) {
        const mat = getMaterial(value);
        updates.is_service = mat?.item_type === 'service';
        updates.uses_variant = mat?.item_type === 'service' ? false : (mat?.uses_variant || false);
        const effectiveVariantId = updates.uses_variant ? (formData.default_variant_id || '') : '';
        updates.variant_id = effectiveVariantId;
        updates.rate = getRate(value, effectiveVariantId || null);
      }
      
      if (field === 'variant_id' && item.item_id) {
        updates.rate = getRate(item.item_id, value || null);
      }
      
      if (field === 'supply_type') {
        updates.project_id = value === 'DIRECT_SUPPLY' ? item.project_id : '';
      }
      
      if ((field === 'quantity' || field === 'rate') || (field === 'variant_id' && item.item_id)) {
        const qty = field === 'quantity' ? parseFloat(value) || 0 : parseFloat(item.quantity) || 0;
        const rate = field === 'rate' ? parseFloat(value) || 0 : parseFloat(item.rate) || 0;
        updates.amount = qty * rate;
      }
      
      const qty = parseFloat(updates.quantity !== undefined ? updates.quantity : item.quantity) || 0;
      const variantId = updates.variant_id !== undefined ? updates.variant_id : item.variant_id;
      const usesVar = updates.uses_variant !== undefined ? updates.uses_variant : item.uses_variant;
      const supplyType = updates.supply_type !== undefined ? updates.supply_type : item.supply_type;
      const projId = updates.project_id !== undefined ? updates.project_id : item.project_id;
      const hasVariantMissing = usesVar && !variantId;
      const hasProjectMissing = supplyType === 'DIRECT_SUPPLY' && !projId;
      updates.valid = !!(item.item_id || updates.item_id) && qty > 0 && !hasVariantMissing && !hasProjectMissing;
      
      return { ...item, ...updates };
    }));
  };

  const handleDefaultVariantChange = (variantId) => {
    setFormData({ ...formData, default_variant_id: variantId });
    setItems(items.map(item => {
      if (!item.item_id) return item;
      if (!item.uses_variant) return item;
      return { ...item, variant_id: variantId, rate: getRate(item.item_id, variantId || null) };
    }));
  };

  const validateForm = () => {
    if (!formData.received_date) {
      alert('Please enter Received Date');
      return false;
    }
    if (!formData.vendor_name) {
      alert('Please enter Vendor');
      return false;
    }
    if (!formData.invoice_no) {
      alert('Please enter Invoice No');
      return false;
    }
    if (!formData.received_by) {
      alert('Please enter Received By');
      return false;
    }
    
    for (const item of items) {
      if (!item.item_id) continue;
      
      const itemSupplyType = item.supply_type || formData.supply_type;
      
      if (itemSupplyType === 'WAREHOUSE' && !formData.warehouse_id) {
        alert('Please select Warehouse for WAREHOUSE supply type');
        return false;
      }
      if (itemSupplyType === 'DIRECT_SUPPLY' && !item.project_id) {
        alert(`Project is required for DIRECT SUPPLY item: ${getMaterial(item.item_id)?.display_name || getMaterial(item.item_id)?.name}`);
        return false;
      }
      if (item.uses_variant && !item.variant_id) {
        alert(`Variant is required for item: ${getMaterial(item.item_id)?.display_name || getMaterial(item.item_id)?.name}`);
        return false;
      }
      if (!item.quantity || parseFloat(item.quantity) <= 0) {
        alert(`Invalid quantity for item: ${getMaterial(item.item_id)?.display_name || getMaterial(item.item_id)?.name}`);
        return false;
      }
    }
    
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    const validItems = items.filter(i => i.valid);
    if (validItems.length === 0) {
      alert('Please add at least one valid item');
      return;
    }

    try {
      const { data: inward, error } = await supabase.from('material_inward').insert({
        invoice_date: formData.invoice_date || null,
        inward_date: formData.inward_date || null,
        received_date: formData.received_date,
        vendor_name: formData.vendor_name,
        invoice_no: formData.invoice_no,
        warehouse_id: formData.warehouse_id || null,
        variant_id: formData.default_variant_id || null,
        received_by: formData.received_by,
        acknowledged_by: formData.acknowledged_by || null,
        remarks: formData.remarks || null,
        supply_type: formData.supply_type,
        project_id: formData.project_id || null
      }).select().single();
      
      if (error) throw error;

      for (const item of validItems) {
        const mat = getMaterial(item.item_id);
        if (!mat) continue;
        
        const itemSupplyType = item.supply_type || formData.supply_type;
        const itemWarehouseId = itemSupplyType === 'WAREHOUSE' ? formData.warehouse_id : null;
        const itemProjectId = itemSupplyType === 'DIRECT_SUPPLY' ? item.project_id : null;
        const itemVariantId = item.uses_variant && item.variant_id ? item.variant_id : null;
        const qty = parseFloat(item.quantity);
        const rate = parseFloat(item.rate);
        const materialName = mat.display_name || mat.name || 'Unknown Item';

        const insertData = {
          inward_id: inward.id,
          material_id: item.item_id,
          material_name: materialName,
          unit: mat.unit || 'nos',
          quantity: qty,
          rate: rate,
          amount: qty * rate,
          warehouse_id: itemWarehouseId,
          variant_id: itemVariantId,
          supply_type: itemSupplyType,
          project_id: itemProjectId
        };

        const { error: itemError } = await supabase.from('material_inward_items').insert(insertData);
        if (itemError) throw itemError;

        if (!item.is_service && itemSupplyType === 'WAREHOUSE' && itemWarehouseId) {
          const { data: existing } = await supabase.from('item_stock')
            .select('*')
            .eq('item_id', item.item_id)
            .eq('company_variant_id', itemVariantId)
            .eq('warehouse_id', itemWarehouseId)
            .single();

          if (existing) {
            await supabase.from('item_stock')
              .update({ current_stock: (parseFloat(existing.current_stock) || 0) + qty, updated_at: new Date().toISOString() })
              .eq('id', existing.id);
          } else {
            await supabase.from('item_stock').insert({
              item_id: item.item_id,
              company_variant_id: itemVariantId,
              warehouse_id: itemWarehouseId,
              current_stock: qty
            });
          }
        }
      }

      alert('Material inward submitted successfully!');
      setItems([{ id: 1, item_id: '', variant_id: '', quantity: '', rate: '', amount: 0, uses_variant: false, supply_type: 'WAREHOUSE', project_id: '', valid: false }]);
      setFormData({ 
        invoice_date: '', 
        received_date: new Date().toISOString().split('T')[0], 
        vendor_name: '', 
        invoice_no: '', 
        warehouse_id: '', 
        default_variant_id: '',
        received_by: '',
        acknowledged_by: '',
        remarks: '',
        supply_type: 'WAREHOUSE',
        project_id: ''
      });
    } catch (err) {
      alert('Error saving: ' + err.message);
    }
  };

  const totalQty = items.filter(i => i.valid).reduce((sum, i) => sum + (parseFloat(i.quantity) || 0), 0);
  const totalAmount = items.filter(i => i.valid).reduce((sum, i) => sum + (i.amount || 0), 0);

  const activeVariants = variants.filter(v => v.variant_name !== 'No Variant');

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Material Inward</h1>
        <button className="btn btn-secondary" onClick={() => setShowPasteModal(true)}>📋 Paste From Excel</button>
      </div>

      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ 
          background: '#f8f9fa', 
          padding: '16px 20px', 
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          gap: '16px',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          position: 'sticky',
          top: 0,
          zIndex: 10
        }}>
          <div className="form-group" style={{ margin: 0, minWidth: '140px' }}>
            <label className="form-label">Invoice Date</label>
            <input type="date" className="form-input" value={formData.invoice_date} onChange={e => setFormData({...formData, invoice_date: e.target.value})} />
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: '140px' }}>
            <label className="form-label">Inward Date *</label>
            <input type="date" className="form-input" value={formData.inward_date} onChange={e => setFormData({...formData, inward_date: e.target.value})} />
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: '140px' }}>
            <label className="form-label">Received Date *</label>
            <input type="date" className="form-input" value={formData.received_date} onChange={e => setFormData({...formData, received_date: e.target.value})} />
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: '160px' }}>
            <label className="form-label">Vendor *</label>
            <input type="text" className="form-input" value={formData.vendor_name} onChange={e => setFormData({...formData, vendor_name: e.target.value})} placeholder="Vendor name" />
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: '140px' }}>
            <label className="form-label">Invoice No *</label>
            <input type="text" className="form-input" value={formData.invoice_no} onChange={e => setFormData({...formData, invoice_no: e.target.value})} placeholder="Invoice #" />
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: '150px' }}>
            <label className="form-label">Warehouse *</label>
            <select className="form-select" value={formData.warehouse_id} onChange={e => setFormData({...formData, warehouse_id: e.target.value})}>
              <option value="">Select</option>
              {warehouses.map(w => (<option key={w.id} value={w.id}>{w.warehouse_name || w.name}</option>))}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: '140px' }}>
            <label className="form-label">Default Variant</label>
            <select className="form-select" value={formData.default_variant_id} onChange={e => handleDefaultVariantChange(e.target.value)}>
              <option value="">Select</option>
              {activeVariants.map(v => (<option key={v.id} value={v.id}>{v.variant_name}</option>))}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: '130px' }}>
            <label className="form-label">Received By *</label>
            <input type="text" className="form-input" value={formData.received_by} onChange={e => setFormData({...formData, received_by: e.target.value})} placeholder="Name" />
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: '130px' }}>
            <label className="form-label">Acknowledged By</label>
            <input type="text" className="form-input" value={formData.acknowledged_by} onChange={e => setFormData({...formData, acknowledged_by: e.target.value})} placeholder="Name" />
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th style={{ width: '40px' }}>#</th>
                <th style={{ minWidth: '180px' }}>Item</th>
                <th style={{ width: '90px' }}>Type</th>
                <th style={{ width: '120px' }}>Variant</th>
                <th style={{ width: '150px' }}>Project</th>
                <th style={{ width: '70px' }}>Qty</th>
                <th style={{ width: '80px' }}>Rate</th>
                <th style={{ width: '90px' }}>Amount</th>
                <th style={{ width: '40px' }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const mat = getMaterial(item.item_id);
                const itemSupplyType = item.supply_type || formData.supply_type;
                return (
                  <tr key={item.id} style={{ background: !item.valid && item.item_id ? '#fff3cd' : 'transparent' }}>
                    <td style={{ textAlign: 'center', color: '#666' }}>{index + 1}</td>
                    <td>
                      <select 
                        value={item.item_id} 
                        onChange={e => updateItem(item.id, 'item_id', e.target.value)}
                        style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ddd' }}
                      >
                        <option value="">Select Item</option>
                        {materials.map(m => (
                          <option key={m.id} value={m.id}>{m.display_name || m.name}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select 
                        value={item.supply_type || formData.supply_type} 
                        onChange={e => updateItem(item.id, 'supply_type', e.target.value)}
                        style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '12px' }}
                      >
                        <option value="WAREHOUSE">Warehouse</option>
                        <option value="DIRECT_SUPPLY">Direct</option>
                      </select>
                    </td>
                    <td>
                      <select 
                        value={item.variant_id || ''} 
                        onChange={e => updateItem(item.id, 'variant_id', e.target.value)}
                        disabled={!item.uses_variant}
                        style={{ 
                          width: '100%', 
                          padding: '6px', 
                          borderRadius: '4px', 
                          border: '1px solid #ddd',
                          background: item.uses_variant ? '#fff' : '#f5f5f5',
                          fontSize: '12px'
                        }}
                      >
                        <option value="">{item.uses_variant ? 'Select' : 'N/A'}</option>
                        {activeVariants.map(v => (<option key={v.id} value={v.id}>{v.variant_name}</option>))}
                      </select>
                    </td>
                    <td>
                      <select 
                        value={item.project_id || ''} 
                        onChange={e => updateItem(item.id, 'project_id', e.target.value)}
                        disabled={itemSupplyType !== 'DIRECT_SUPPLY'}
                        style={{ 
                          width: '100%', 
                          padding: '6px', 
                          borderRadius: '4px', 
                          border: '1px solid #ddd',
                          background: itemSupplyType === 'DIRECT_SUPPLY' ? '#fff' : '#f5f5f5',
                          fontSize: '12px'
                        }}
                      >
                        <option value="">{itemSupplyType === 'DIRECT_SUPPLY' ? 'Select Project' : 'N/A'}</option>
                        {projects.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
                      </select>
                    </td>
                    <td>
                      <input 
                        type="number" 
                        value={item.quantity} 
                        onChange={e => updateItem(item.id, 'quantity', e.target.value)}
                        placeholder="0" 
                        style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ddd', textAlign: 'right', fontSize: '12px' }}
                      />
                    </td>
                    <td>
                      <input 
                        type="number" 
                        value={item.rate} 
                        onChange={e => updateItem(item.id, 'rate', e.target.value)}
                        placeholder="0" 
                        step="0.01"
                        style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ddd', textAlign: 'right', fontSize: '12px' }}
                      />
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: '600', padding: '6px', fontSize: '12px' }}>
                      ₹{item.amount.toFixed(2)}
                    </td>
                    <td>
                      {items.length > 1 && (
                        <button 
                          type="button"
                          onClick={() => removeItem(item.id)}
                          style={{ background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer', fontSize: '18px' }}
                        >
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <button 
          type="button"
          onClick={addItem}
          style={{ 
            margin: '12px 20px', 
            padding: '8px 16px', 
            background: '#fff', 
            border: '1px dashed #3498db', 
            borderRadius: '4px', 
            color: '#3498db',
            cursor: 'pointer'
          }}
        >
          + Add Row
        </button>

        <div style={{ 
          background: '#f0f7ff', 
          padding: '12px 20px', 
          borderTop: '2px solid #3498db',
          display: 'flex',
          gap: '40px',
          justifyContent: 'flex-end',
          position: 'sticky',
          bottom: 0
        }}>
          <div>
            <span style={{ color: '#666', marginRight: '8px' }}>Total Qty:</span>
            <strong style={{ fontSize: '18px', color: '#333' }}>{totalQty.toFixed(2)}</strong>
          </div>
          <div>
            <span style={{ color: '#666', marginRight: '8px' }}>Total Amount:</span>
            <strong style={{ fontSize: '18px', color: '#333' }}>₹{totalAmount.toFixed(2)}</strong>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
        <button type="button" className="btn btn-primary" onClick={handleSubmit}>Submit Inward</button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
      </div>

      {showPasteModal && (
        <div className="modal-overlay open" onClick={() => setShowPasteModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2>Paste From Excel</h2>
              <button onClick={() => setShowPasteModal(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>×</button>
            </div>
            <p style={{ color: '#666', marginBottom: '12px' }}>
              Format: <strong>Item Name | Quantity | Rate (optional)</strong>
            </p>
            <textarea 
              value={pasteData}
              onChange={e => setPasteData(e.target.value)}
              placeholder="Item Name&#9;Quantity&#9;Rate&#10;Ball Valve&#9;100&#9;250"
              style={{ width: '100%', height: '200px', padding: '12px', fontFamily: 'monospace', border: '1px solid #ddd', borderRadius: '4px' }}
            />
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button className="btn btn-primary" onClick={() => setShowPasteModal(false)}>Import</button>
              <button className="btn btn-secondary" onClick={() => setShowPasteModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

