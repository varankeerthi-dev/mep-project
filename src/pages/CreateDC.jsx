import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function CreateDC({ onSuccess, onCancel, editDC }) {
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [variants, setVariants] = useState([]);
  const [stock, setStock] = useState([]);
  const [pricing, setPricing] = useState({});
  const [clients, setClients] = useState([]);
  
  const isEditing = !!editDC;
  const isLocked = editDC?.status === 'APPROVED';

  const [formData, setFormData] = useState({
    project_id: '',
    dc_date: new Date().toISOString().split('T')[0],
    client_name: '',
    source_type: 'WAREHOUSE',
    warehouse_id: '',
    vehicle_number: '',
    driver_name: '',
    eway_bill_no: '',
    eway_bill_date: '',
    eway_valid_till: '',
    remarks: '',
    ship_to_name: '',
    ship_to_address_line1: '',
    ship_to_address_line2: '',
    ship_to_city: '',
    ship_to_state: '',
    ship_to_pincode: '',
    ship_to_gstin: '',
    ship_to_contact: '',
    status: 'DRAFT'
  });

  const [items, setItems] = useState([
    { id: 1, material_id: '', variant_id: '', material_name: '', unit: 'nos', quantity: '', rate: '', amount: 0, uses_variant: false, available_qty: 0, valid: false }
  ]);
  const [dcSettings, setDcSettings] = useState({ prefix: 'DC', suffix: '', padding: '5' });

  useEffect(() => { loadData(); }, []);
  
  useEffect(() => {
    if (editDC) {
      setFormData({
        ...editDC,
        eway_bill_date: editDC.eway_bill_date || '',
        eway_valid_till: editDC.eway_valid_till || ''
      });
      loadExistingItems(editDC.id);
    }
  }, [editDC]);

  const loadData = async () => {
    try {
      const [projData, matData, whData, varData, stockData, clientData] = await Promise.all([
        supabase.from('projects').select('*').order('name'),
        supabase.from('materials').select('id, display_name, name, unit, uses_variant, sale_price').order('name'),
        supabase.from('warehouses').select('*').order('name'),
        supabase.from('company_variants').select('*').order('variant_name'),
        supabase.from('item_stock').select('*'),
        supabase.from('clients').select('*').order('client_name')
      ]);
      
      setProjects(projData.data || []);
      setMaterials(matData.data || []);
      setWarehouses(whData.data || []);
      setVariants(varData.data || []);
      setStock(stockData.data || []);
      setClients(clientData.data || []);
      console.log('Clients loaded:', clientData.data?.length);
      
      // Load DC settings
      const { data: settingsData } = await supabase.from('settings').select('key, value');
      if (settingsData) {
        const settings = {};
        settingsData.forEach(s => { settings[s.key] = s.value; });
        setDcSettings({
          prefix: settings.dc_prefix || 'DC',
          suffix: settings.dc_suffix || '',
          padding: settings.dc_padding || '5'
        });
      }
      
      const priceMap = {};
      stockData.data?.forEach(s => {
        if (!priceMap[s.item_id]) priceMap[s.item_id] = {};
        priceMap[s.item_id][s.company_variant_id] = s.current_stock || 0;
      });
      setPricing(priceMap);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const loadExistingItems = async (dcId) => {
    const { data } = await supabase.from('delivery_challan_items').select('*').eq('delivery_challan_id', dcId);
    if (data) {
      const loaded = data.map((item, idx) => {
        const mat = materials.find(m => m.id === item.material_id);
        return {
          id: idx + 1,
          material_id: item.material_id,
          variant_id: item.variant_id,
          material_name: item.material_name,
          unit: item.unit,
          quantity: item.quantity,
          rate: item.rate,
          amount: item.amount,
          uses_variant: mat?.uses_variant || false,
          available_qty: 0,
          valid: true
        };
      });
      setItems(loaded);
    }
  };

  const getMaterial = (id) => materials.find(m => m.id === id);
  
  const getAvailableQty = (itemId, variantId) => {
    if (formData.source_type !== 'WAREHOUSE') return 0;
    if (!formData.warehouse_id) return 0;
    const s = stock.find(x => 
      x.item_id === itemId && 
      x.warehouse_id === formData.warehouse_id &&
      (variantId ? x.company_variant_id === variantId : !x.company_variant_id)
    );
    return parseFloat(s?.current_stock) || 0;
  };

  const getRate = (itemId, variantId) => {
    if (variantId && pricing[itemId]?.[variantId]) {
      return pricing[itemId][variantId];
    }
    const mat = getMaterial(itemId);
    return mat?.sale_price || 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleProjectChange = async (projectId) => {
    let shipData = { project_id: projectId };
    
    if (projectId) {
      const { data: proj } = await supabase.from('projects').select('*').eq('id', projectId).single();
      if (proj) {
        shipData = {
          ...shipData,
          client_name: proj.client_name || '',
          ship_to_name: proj.client_name || '',
          ship_to_address_line1: proj.site_address || '',
          ship_to_city: '',
          ship_to_state: '',
          ship_to_pincode: ''
        };
      }
    }
    
    setFormData(prev => ({ ...prev, ...shipData }));
  };

  const handleSourceTypeChange = (value) => {
    setFormData(prev => ({ ...prev, source_type: value }));
    if (value === 'DIRECT_SUPPLY') {
      setItems(items.map(item => ({ ...item, available_qty: 0 })));
    } else {
      setItems(items.map(item => ({
        ...item,
        available_qty: getAvailableQty(item.material_id, item.variant_id)
      })));
    }
  };

  const handleWarehouseChange = (warehouseId) => {
    setFormData(prev => ({ ...prev, warehouse_id: warehouseId }));
    setItems(items.map(item => ({
      ...item,
      available_qty: getAvailableQty(item.material_id, item.variant_id)
    })));
  };

  const addItem = () => {
    setItems([...items, { 
      id: items.length + 1, 
      material_id: '', 
      variant_id: '', 
      material_name: '', 
      unit: 'nos', 
      quantity: '', 
      rate: '', 
      amount: 0, 
      uses_variant: false, 
      available_qty: 0, 
      valid: false 
    }]);
  };

  const removeItem = (id) => {
    if (isLocked) return;
    setItems(items.filter(i => i.id !== id));
  };

  const handleItemChange = (id, field, value) => {
    setItems(items.map(item => {
      if (item.id !== id) return item;
      
      const updates = { [field]: value };
      
      if (field === 'material_id' && value) {
        const mat = getMaterial(value);
        updates.material_name = mat?.display_name || mat?.name || '';
        updates.unit = mat?.unit || 'nos';
        updates.uses_variant = mat?.uses_variant || false;
        updates.rate = getRate(value, item.variant_id);
        updates.variant_id = '';
        updates.available_qty = formData.source_type === 'WAREHOUSE' ? getAvailableQty(value, null) : 0;
      }
      
      if (field === 'variant_id' && item.material_id) {
        updates.rate = getRate(item.material_id, value);
        updates.available_qty = formData.source_type === 'WAREHOUSE' ? getAvailableQty(item.material_id, value) : 0;
      }
      
      if (field === 'quantity' || field === 'rate') {
        const qty = field === 'quantity' ? parseFloat(value) || 0 : parseFloat(item.quantity) || 0;
        const rate = field === 'rate' ? parseFloat(value) || 0 : parseFloat(item.rate) || 0;
        updates.amount = qty * rate;
      }
      
      const qty = parseFloat(updates.quantity !== undefined ? updates.quantity : item.quantity) || 0;
      const avail = updates.available_qty !== undefined ? updates.available_qty : item.available_qty;
      const usesVar = updates.uses_variant !== undefined ? updates.uses_variant : item.uses_variant;
      const hasVariantMissing = usesVar && !item.variant_id && !updates.variant_id;
      
      let isValid = !!(item.material_id || updates.material_id) && qty > 0 && !hasVariantMissing;
      
      if (isValid && formData.source_type === 'WAREHOUSE' && qty > avail) {
        isValid = false;
      }
      
      updates.valid = isValid;
      
      return { ...item, ...updates };
    }));
  };

  const validateForm = () => {
    if (!formData.client_name) { alert('Please select Client'); return false; }
    if (!formData.dc_date) { alert('Please select DC Date'); return false; }
    
    if (formData.source_type === 'WAREHOUSE' && !formData.warehouse_id) {
      alert('Please select Warehouse');
      return false;
    }
    
    for (const item of items) {
      if (!item.material_id) continue;
      if (item.uses_variant && !item.variant_id) {
        alert(`Variant required for: ${item.material_name}`);
        return false;
      }
      if (!item.quantity || parseFloat(item.quantity) <= 0) {
        alert(`Invalid quantity for: ${item.material_name}`);
        return false;
      }
      if (formData.source_type === 'WAREHOUSE' && parseFloat(item.quantity) > item.available_qty) {
        alert(`Insufficient stock for: ${item.material_name}`);
        return false;
      }
    }
    
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    setLoading(true);
    
    try {
      const validItems = items.filter(i => i.valid);
      
      const dcData = {
        ...formData,
        warehouse_id: formData.source_type === 'WAREHOUSE' ? formData.warehouse_id : null,
        eway_bill_date: formData.eway_bill_date || null,
        eway_valid_till: formData.eway_valid_till || null,
        project_id: formData.project_id || null
      };
      
      let dcId;
      
      console.log('Saving DC with data:', dcData);
      
      if (isEditing) {
        await supabase.from('delivery_challans').update(dcData).eq('id', editDC.id);
        dcId = editDC.id;
        await supabase.from('delivery_challan_items').delete().eq('delivery_challan_id', dcId);
      } else {
        const dcNo = await generateDCNo();
        console.log('Generated DC No:', dcNo);
        const { data, error } = await supabase.from('delivery_challans').insert({
          ...dcData,
          dc_number: dcNo
        }).select().single();
        
        if (error) {
          console.error('Error creating DC:', error);
          alert('Error creating DC: ' + error.message);
          setLoading(false);
          return;
        }
        
        dcId = data.id;
      }
      
      console.log('DC saved, ID:', dcId);
      console.log('Saving items:', validItems);
      
      const itemsToSave = validItems.map(item => ({
        delivery_challan_id: dcId,
        material_id: item.material_id,
        variant_id: item.uses_variant && item.variant_id ? item.variant_id : null,
        material_name: item.material_name,
        unit: item.unit,
        quantity: parseFloat(item.quantity),
        rate: parseFloat(item.rate) || 0,
        amount: item.amount
      }));
      
      await supabase.from('delivery_challan_items').insert(itemsToSave);
      
      if (formData.source_type === 'WAREHOUSE' && formData.warehouse_id) {
        for (const item of validItems) {
          const { data: existing } = await supabase.from('item_stock')
            .select('*')
            .eq('item_id', item.material_id)
            .eq('company_variant_id', item.uses_variant ? item.variant_id : null)
            .eq('warehouse_id', formData.warehouse_id)
            .single();
          
          if (existing) {
            await supabase.from('item_stock')
              .update({ 
                current_stock: Math.max(0, (parseFloat(existing.current_stock) || 0) - parseFloat(item.quantity)),
                updated_at: new Date().toISOString()
              })
              .eq('id', existing.id);
          }
        }
      }
      
      alert(isEditing ? 'DC Updated!' : 'DC Created!');
      if (onSuccess) onSuccess();
      
    } catch (error) {
      console.error('Error:', error);
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const generateDCNo = async () => {
    const { count } = await supabase.from('delivery_challans').select('*', { count: 'exact' });
    const num = (count || 0) + 1;
    const paddedNum = String(num).padStart(parseInt(dcSettings.padding) || 5, '0');
    return `${dcSettings.prefix || ''}${paddedNum}${dcSettings.suffix || ''}`;
  };

  const generatePDF = async (dc) => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('DELIVERY CHALLAN', 105, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    doc.text('DC No:', 14, 35);
    doc.setFont('helvetica', 'bold');
    doc.text(dc.dc_number || '-', 35, 35);
    
    doc.setFont('helvetica', 'normal');
    doc.text('Date:', 14, 42);
    doc.text(dc.dc_date || '-', 35, 42);
    
    doc.text('Source:', 100, 35);
    doc.text(dc.source_type || '-', 120, 35);
    
    if (dc.warehouse_id) {
      doc.text('Warehouse:', 100, 42);
      const wh = warehouses.find(w => w.id === dc.warehouse_id);
      doc.text(wh?.warehouse_name || '-', 120, 42);
    }
    
    if (dc.eway_bill_no) {
      doc.text('E-Way Bill:', 14, 49);
      doc.text(dc.eway_bill_no, 35, 49);
    }
    
    if (dc.vehicle_number) {
      doc.text('Vehicle:', 100, 49);
      doc.text(dc.vehicle_number, 120, 49);
    }
    
    doc.setLineWidth(0.5);
    doc.line(14, 55, 196, 55);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Bill To:', 14, 65);
    doc.text('Ship To:', 110, 65);
    
    doc.setFont('helvetica', 'normal');
    doc.text(dc.client_name || '-', 14, 72);
    doc.text(dc.ship_to_name || '-', 110, 72);
    
    const billAddr = [dc.site_address || ''].filter(Boolean).join(', ');
    const shipAddr = [dc.ship_to_address_line1, dc.ship_to_address_line2, dc.ship_to_city, dc.ship_to_state, dc.ship_to_pincode].filter(Boolean).join(', ');
    
    doc.text(billAddr || '-', 14, 79);
    doc.text(shipAddr || '-', 110, 79);
    
    if (dc.ship_to_gstin) {
      doc.text('GSTIN:', 110, 86);
      doc.text(dc.ship_to_gstin, 125, 86);
    }
    
    const { data: dcItems } = await supabase
      .from('delivery_challan_items')
      .select('*, variant:company_variants(variant_name)')
      .eq('delivery_challan_id', dc.id);
    
    const tableData = (dcItems || []).map((item, idx) => [
      idx + 1,
      item.material_name,
      item.variant?.variant_name || '-',
      item.unit,
      item.quantity,
      item.rate ? `₹${parseFloat(item.rate).toFixed(2)}` : '-',
      item.amount ? `₹${parseFloat(item.amount).toFixed(2)}` : '-'
    ]);
    
    doc.autoTable({
      startY: 95,
      head: [['S.No', 'Item Description', 'Variant', 'Unit', 'Qty', 'Rate', 'Amount']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [26, 26, 26] },
      columnStyles: {
        0: { halign: 'center' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' }
      }
    });
    
    const finalY = doc.lastAutoTable.finalY + 15;
    const totalQty = (dcItems || []).reduce((sum, i) => sum + (parseFloat(i.quantity) || 0), 0);
    const totalAmount = (dcItems || []).reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);
    
    doc.setFont('helvetica', 'normal');
    doc.text('Total Quantity:', 140, finalY);
    doc.setFont('helvetica', 'bold');
    doc.text(totalQty.toFixed(2), 175, finalY, { align: 'right' });
    
    doc.setFont('helvetica', 'normal');
    doc.text('Grand Total:', 140, finalY + 8);
    doc.setFont('helvetica', 'bold');
    doc.text(`₹${totalAmount.toFixed(2)}`, 175, finalY + 8, { align: 'right' });
    
    doc.line(14, finalY + 20, 80, finalY + 20);
    doc.line(120, finalY + 20, 186, finalY + 20);
    doc.setFontSize(8);
    doc.text('Prepared By', 14, finalY + 28);
    doc.text('Received By', 120, finalY + 28);
    
    doc.save(`${dc.dc_number}.pdf`);
  };

  const activeVariants = variants.filter(v => v.variant_name !== 'No Variant');
  const validItems = items.filter(i => i.valid);
  const totalQty = validItems.reduce((sum, i) => sum + (parseFloat(i.quantity) || 0), 0);
  const totalAmount = validItems.reduce((sum, i) => sum + (i.amount || 0), 0);

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">{isEditing ? 'Edit Delivery Challan' : 'Create Delivery Challan'}</h2>
      </div>
      
      {clients.length === 0 && (
        <div style={{ padding: '10px', background: '#ffcccc', margin: '10px' }}>
          No clients found. Please create clients in database.
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div style={{ background: '#f8f9fa', padding: '16px', marginBottom: '16px', borderRadius: '8px' }}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Client *</label>
              <select 
                name="client_name"
                className="form-select"
                value={formData.client_name}
                onChange={(e) => {
                  const client = clients.find(c => c.client_name === e.target.value);
                  setFormData(prev => ({
                    ...prev,
                    client_name: e.target.value,
                    ship_to_name: client?.client_name || '',
                    ship_to_address_line1: client?.address1 || client?.shipping_address || '',
                    ship_to_address_line2: client?.address2 || '',
                    ship_to_city: client?.city || '',
                    ship_to_state: client?.state || '',
                    ship_to_gstin: client?.gstin || '',
                    ship_to_contact: client?.contact || ''
                  }));
                }}
                disabled={isLocked}
              >
                <option value="">Select Client</option>
                {clients.map(c => (
                  <option key={c.id} value={c.client_name}>{c.client_name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Project</label>
              <select 
                name="project_id" 
                className="form-select"
                value={formData.project_id}
                onChange={(e) => handleProjectChange(e.target.value)}
                disabled={isLocked}
              >
                <option value="">Select Project</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Source Type *</label>
              <select 
                name="source_type" 
                className="form-select"
                value={formData.source_type}
                onChange={(e) => handleSourceTypeChange(e.target.value)}
                disabled={isLocked}
              >
                <option value="WAREHOUSE">Warehouse</option>
                <option value="DIRECT_SUPPLY">Direct Supply</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">DC Date *</label>
              <input 
                type="date" 
                name="dc_date"
                className="form-input"
                value={formData.dc_date}
                onChange={handleInputChange}
                disabled={isLocked}
              />
            </div>
          </div>
          
          <div className="form-row">
            {formData.source_type === 'WAREHOUSE' && (
              <div className="form-group">
                <label className="form-label">Warehouse *</label>
                <select 
                  name="warehouse_id" 
                  className="form-select"
                  value={formData.warehouse_id}
                  onChange={(e) => handleWarehouseChange(e.target.value)}
                  disabled={isLocked}
                >
                  <option value="">Select</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Vehicle No</label>
              <input type="text" name="vehicle_number" className="form-input" value={formData.vehicle_number} onChange={handleInputChange} disabled={isLocked} />
            </div>
            <div className="form-group">
              <label className="form-label">Driver Name</label>
              <input type="text" name="driver_name" className="form-input" value={formData.driver_name} onChange={handleInputChange} disabled={isLocked} />
            </div>
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">E-Way Bill No</label>
              <input type="text" name="eway_bill_no" className="form-input" value={formData.eway_bill_no} onChange={handleInputChange} disabled={isLocked} />
            </div>
            <div className="form-group">
              <label className="form-label">E-Way Bill Date</label>
              <input type="date" name="eway_bill_date" className="form-input" value={formData.eway_bill_date} onChange={handleInputChange} disabled={isLocked} />
            </div>
            <div className="form-group">
              <label className="form-label">E-Way Valid Till</label>
              <input type="date" name="eway_valid_till" className="form-input" value={formData.eway_valid_till} onChange={handleInputChange} disabled={isLocked} />
            </div>
          </div>
        </div>
        
        <div style={{ background: '#fff3cd', padding: '16px', marginBottom: '16px', borderRadius: '8px' }}>
          <h4 style={{ margin: '0 0 12px 0' }}>Ship To</h4>
          <div className="form-row">
            <div className="form-group" style={{ flex: 2 }}>
              <label className="form-label">Name</label>
              <input type="text" name="ship_to_name" className="form-input" value={formData.ship_to_name} onChange={handleInputChange} disabled={isLocked} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">City</label>
              <input type="text" name="ship_to_city" className="form-input" value={formData.ship_to_city} onChange={handleInputChange} disabled={isLocked} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">State</label>
              <input type="text" name="ship_to_state" className="form-input" value={formData.ship_to_state} onChange={handleInputChange} disabled={isLocked} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Address Line 1</label>
              <input type="text" name="ship_to_address_line1" className="form-input" value={formData.ship_to_address_line1} onChange={handleInputChange} disabled={isLocked} />
            </div>
            <div className="form-group">
              <label className="form-label">Address Line 2</label>
              <input type="text" name="ship_to_address_line2" className="form-input" value={formData.ship_to_address_line2} onChange={handleInputChange} disabled={isLocked} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Pincode</label>
              <input type="text" name="ship_to_pincode" className="form-input" value={formData.ship_to_pincode} onChange={handleInputChange} disabled={isLocked} />
            </div>
            <div className="form-group">
              <label className="form-label">GSTIN</label>
              <input type="text" name="ship_to_gstin" className="form-input" value={formData.ship_to_gstin} onChange={handleInputChange} disabled={isLocked} />
            </div>
            <div className="form-group">
              <label className="form-label">Contact</label>
              <input type="text" name="ship_to_contact" className="form-input" value={formData.ship_to_contact} onChange={handleInputChange} disabled={isLocked} />
            </div>
          </div>
        </div>
        
        <div className="form-group">
          <label className="form-label">Items</label>
          <div className="item-list">
            <div className="item-row header">
              <span style={{ width: '40px' }}>#</span>
              <span style={{ flex: 2 }}>Item</span>
              <span style={{ width: '120px' }}>Variant</span>
              {formData.source_type === 'WAREHOUSE' && <span style={{ width: '80px' }}>Avail</span>}
              <span style={{ width: '60px' }}>Qty</span>
              <span style={{ width: '60px' }}>Unit</span>
              <span style={{ width: '80px' }}>Rate</span>
              <span style={{ width: '90px' }}>Amount</span>
              <span style={{ width: '30px' }}></span>
            </div>
            
            {items.map((item, index) => (
              <div className="item-row" key={item.id} style={{ background: !item.valid && item.material_id ? '#fff3cd' : 'transparent' }}>
                <span style={{ width: '40px', textAlign: 'center' }}>{index + 1}</span>
                <span style={{ flex: 2 }}>
                  <select 
                    value={item.material_id} 
                    onChange={(e) => handleItemChange(item.id, 'material_id', e.target.value)}
                    disabled={isLocked}
                    style={{ width: '100%', padding: '6px' }}
                  >
                    <option value="">Select</option>
                    {materials.map(m => (
                      <option key={m.id} value={m.id}>{m.display_name || m.name}</option>
                    ))}
                  </select>
                </span>
                <span style={{ width: '120px' }}>
                  <select 
                    value={item.variant_id || ''} 
                    onChange={(e) => handleItemChange(item.id, 'variant_id', e.target.value)}
                    disabled={!item.uses_variant || isLocked}
                    style={{ width: '100%', padding: '6px', background: item.uses_variant ? '#fff' : '#f5f5f5' }}
                  >
                    <option value="">{item.uses_variant ? 'Select' : 'N/A'}</option>
                    {activeVariants.map(v => (
                      <option key={v.id} value={v.id}>{v.variant_name}</option>
                    ))}
                  </select>
                </span>
                {formData.source_type === 'WAREHOUSE' && (
                  <span style={{ width: '80px', textAlign: 'right', color: item.quantity > item.available_qty ? '#dc3545' : '#28a745' }}>
                    {item.available_qty.toFixed(2)}
                  </span>
                )}
                <span style={{ width: '60px' }}>
                  <input 
                    type="number"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                    disabled={isLocked}
                    placeholder="0"
                    style={{ width: '100%', padding: '6px', textAlign: 'right' }}
                  />
                </span>
                <span style={{ width: '60px' }}>
                  <select 
                    value={item.unit}
                    onChange={(e) => handleItemChange(item.id, 'unit', e.target.value)}
                    disabled={isLocked}
                    style={{ width: '100%', padding: '6px' }}
                  >
                    <option value="nos">Nos</option>
                    <option value="kg">Kg</option>
                    <option value="m">Mtr</option>
                    <option value="sqft">Sqft</option>
                    <option value="sqm">Sqm</option>
                    <option value="ft">Ft</option>
                    <option value="liters">Ltr</option>
                    <option value="bags">Bags</option>
                  </select>
                </span>
                <span style={{ width: '80px' }}>
                  <input 
                    type="number"
                    value={item.rate}
                    onChange={(e) => handleItemChange(item.id, 'rate', e.target.value)}
                    disabled={isLocked}
                    placeholder="0"
                    step="0.01"
                    style={{ width: '100%', padding: '6px', textAlign: 'right' }}
                  />
                </span>
                <span style={{ width: '90px', textAlign: 'right', fontWeight: '600' }}>
                  ₹{item.amount.toFixed(2)}
                </span>
                <span style={{ width: '30px' }}>
                  {!isLocked && items.length > 1 && (
                    <span className="delete-btn" onClick={() => removeItem(item.id)}>×</span>
                  )}
                </span>
              </div>
            ))}
          </div>
          
          {!isLocked && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={addItem} style={{ marginTop: '12px' }}>
              + Add Item
            </button>
          )}
        </div>
        
        <div style={{ background: '#f0f7ff', padding: '12px 20px', marginTop: '16px', borderRadius: '8px', display: 'flex', justifyContent: 'flex-end', gap: '40px' }}>
          <div>
            <span style={{ color: '#666' }}>Total Qty:</span>
            <strong style={{ marginLeft: '8px' }}>{totalQty.toFixed(2)}</strong>
          </div>
          <div>
            <span style={{ color: '#666' }}>Total Amount:</span>
            <strong style={{ marginLeft: '8px' }}>₹{totalAmount.toFixed(2)}</strong>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading || isLocked}>
            {loading ? 'Saving...' : isEditing ? 'Update DC' : 'Create DC'}
          </button>
        </div>
      </form>
    </div>
  );
}
