import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../App';
import { useMaterials } from '../hooks/useMaterials';
import { useProjects } from '../hooks/useProjects';
import { useWarehouses } from '../hooks/useWarehouses';
import { useVariants } from '../hooks/useVariants';
import { useUnits } from '../hooks/useUnits';
import { useClients } from '../hooks/useClients';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { createDeliveryChallan } from '../api';

export default function CreateNonBillableDC({ onSuccess, onCancel, editDC }) {
  const { data: materials = [] } = useMaterials();
  const { data: projects = [] } = useProjects();
  const { data: warehouses = [] } = useWarehouses();
  const { data: variants = [] } = useVariants();
  const { data: units = [] } = useUnits();
  const { data: clients = [] } = useClients();
  
  const { organisation } = useAuth();
  const [loading, setLoading] = useState(false);
  const [stock, setStock] = useState([]);
  const [pricing, setPricing] = useState({});
  const [variantPricingMap, setVariantPricingMap] = useState({});
  
  // Multiple Item Picker State
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  const [pickerItems, setPickerItems] = useState([]);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 768 : false);
  
  // DC Settings - Allow insufficient stock
  const [allowInsufficientStock, setAllowInsufficientStock] = useState(() => {
    const saved = localStorage.getItem('nb_dc_allow_insufficient_stock');
    return saved === 'true';
  });
  
  // Shipping address state
  const [shippingAddresses, setShippingAddresses] = useState([]);
  const [selectedShippingIndex, setSelectedShippingIndex] = useState(-1);
  const [showShippingDropdown, setShowShippingDropdown] = useState(false);
  const [showAddShippingModal, setShowAddShippingModal] = useState(false);
  const [newShippingAddress, setNewShippingAddress] = useState({
    address_name: '', address_line1: '', address_line2: '', city: '', state: '', pincode: '', gstin: '', contact: ''
  });
  const shippingDropdownRef = useRef(null);
  
  const isEditing = !!editDC;
  const isLocked = editDC?.status === 'APPROVED';

  const [formData, setFormData] = useState({
    project_id: '',
    dc_number: '',
    variant_id: '',
    dc_date: new Date().toISOString().split('T')[0],
    client_name: '',
    source_type: 'WAREHOUSE',
    warehouse_id: '',
    vehicle_number: '',
    driver_name: '',
    eway_bill_no: '',
    eway_bill_date: '',
    po_no: '',
    po_date: '',
    remarks: '',
    ship_to_name: '',
    ship_to_address_line1: '',
    ship_to_address_line2: '',
    ship_to_city: '',
    ship_to_state: '',
    ship_to_pincode: '',
    ship_to_gstin: '',
    ship_to_contact: '',
    status: 'active',
    dc_type: 'non-billable',
    authorized_signatory_id: '',
    // organisation_id: organisation?.id || null
  });

  const [items, setItems] = useState([
    { id: 1, material_id: '', variant_id: '', material_name: '', unit: 'nos', quantity: '', rate: '', amount: 0, uses_variant: false, available_qty: 0, valid: false, is_service: false }
  ]);
  const [isDirty, setIsDirty] = useState(false);
  const [draggingItemId, setDraggingItemId] = useState(null);

  const handleDragStart = (e, id) => {
    setDraggingItemId(id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropOnRow = (e, targetId) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain');
    if (draggedId == targetId) return;

    const newItems = [...items];
    const draggedIdx = newItems.findIndex(i => i.id == draggedId);
    const targetIdx = newItems.findIndex(i => i.id == targetId);

    if (draggedIdx !== -1 && targetIdx !== -1) {
      const [draggedItem] = newItems.splice(draggedIdx, 1);
      newItems.splice(targetIdx, 0, draggedItem);
      setItems(newItems);
    }
  };

  const handleDragEnd = () => {
    setDraggingItemId(null);
  };

  useEffect(() => {
    if (!loading) setIsDirty(true);
  }, [formData, items]);

  // Prevent browser close/refresh
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty && !loading) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, loading]);

  useEffect(() => { loadData(); }, []);
  
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (shippingDropdownRef.current && !shippingDropdownRef.current.contains(event.target)) {
        setShowShippingDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  useEffect(() => {
    if (editDC) {
      setFormData({
        ...editDC,
        dc_number: editDC.dc_number || '',
        variant_id: editDC.variant_id || '',
        eway_bill_date: editDC.eway_bill_date || '',
        eway_valid_till: editDC.eway_valid_till || ''
      });
      loadExistingItems(editDC.id);
    }
  }, [editDC]);

  const loadData = async () => {
    try {
      const [stockData, variantPricingData] = await Promise.all([
        supabase.from('item_stock').select('item_id, warehouse_id, company_variant_id, current_stock'),
        supabase.from('item_variant_pricing').select('item_id, company_variant_id')
      ]);
      
      setStock(stockData.data || []);
      
      const vpm = {};
      variantPricingData.data?.forEach(row => {
        if (!vpm[row.item_id]) vpm[row.item_id] = {};
        vpm[row.item_id][row.company_variant_id] = true;
      });
      setVariantPricingMap(vpm);
      
      // Generate NB-DC No if new record
      if (!editDC) {
        const dcNumber = await generateNBDCNo();
        setFormData(prev => ({ ...prev, dc_number: dcNumber }));
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

  const loadShippingAddresses = async (clientId) => {
    const { data } = await supabase
      .from('client_shipping_addresses')
      .select('id, address_name, address_line1, address_line2, city, state, pincode, gstin, contact, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: true });
    setShippingAddresses(data || []);
    setSelectedShippingIndex(-1);
  };

  const handleSelectShippingAddress = (index) => {
    setSelectedShippingIndex(index);
    setShowShippingDropdown(false);
    if (index >= 0 && shippingAddresses[index]) {
      const addr = shippingAddresses[index];
      setFormData(prev => ({
        ...prev,
        ship_to_name: addr.address_name || prev.client_name,
        ship_to_address_line1: addr.address_line1 || '',
        ship_to_address_line2: addr.address_line2 || '',
        ship_to_city: addr.city || '',
        ship_to_state: addr.state || '',
        ship_to_pincode: addr.pincode || '',
        ship_to_gstin: addr.gstin || '',
        ship_to_contact: addr.contact || ''
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        ship_to_name: '',
        ship_to_address_line1: '',
        ship_to_address_line2: '',
        ship_to_city: '',
        ship_to_state: '',
        ship_to_pincode: '',
        ship_to_gstin: '',
        ship_to_contact: ''
      }));
    }
  };

  const handleAddShippingAddress = async () => {
    const client = clients.find(c => c.client_name === formData.client_name);
    if (!client) {
      alert('Please select a client first');
      return;
    }
    const { error } = await supabase.from('client_shipping_addresses').insert({
      client_id: client.id,
      ...newShippingAddress
    });
    if (error) {
      alert('Error adding address: ' + error.message);
    } else {
      setShowAddShippingModal(false);
      setNewShippingAddress({ address_name: '', address_line1: '', address_line2: '', city: '', state: '', pincode: '', gstin: '', contact: '' });
      await loadShippingAddresses(client.id);
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
      const { data: proj } = await supabase
        .from('projects')
        .select('id, client_name, site_address')
        .eq('id', projectId)
        .single();
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

  const handleWarehouseChange = (warehouseId) => {
    setFormData(prev => ({ ...prev, warehouse_id: warehouseId }));
    setItems(items.map(item => ({
      ...item,
      available_qty: getAvailableQty(item.material_id, item.variant_id)
    })));
  };

  const handlePickerQtyChange = (itemId, delta) => {
    setPickerItems(pickerItems.map(i => {
      if (i.item_id === itemId) {
        const newQty = Math.max(1, i.qty + delta);
        return { ...i, qty: newQty };
      }
      return i;
    }));
  };

  const handleRemoveFromPicker = (itemId) => {
    setPickerItems(pickerItems.filter(i => i.item_id !== itemId));
  };

  const handleAddItemsToDC = () => {
    const currentItems = items.filter(i => i.material_id); // keep only non-empty rows
    const headerVariantId = formData.variant_id || '';

    const newItems = pickerItems.map((p, idx) => {
      const mat = p.material;
      const variantId = p.variant_id || headerVariantId;
      const rate = getRate(p.item_id, variantId);
      const avail = formData.source_type === 'WAREHOUSE' ? getAvailableQty(p.item_id, variantId) : 0;
      const qty = p.qty;
      const amount = qty * rate;
      
      const usesVar = mat?.uses_variant || false;
      const hasVariantMissing = usesVar && !variantId;
      
      let isValid = !!p.item_id && qty > 0 && !hasVariantMissing;
      if (isValid && formData.source_type === 'WAREHOUSE' && qty > avail && !allowInsufficientStock) {
        isValid = false;
      }

      return {
        id: Date.now() + idx,
        material_id: p.item_id,
        variant_id: variantId,
        material_name: mat?.display_name || mat?.name || '',
        unit: mat?.unit || 'Nos',
        quantity: qty,
        rate: rate,
        amount: amount,
        uses_variant: usesVar,
        available_qty: avail,
        valid: isValid,
        stock_warning: (formData.source_type === 'WAREHOUSE' && qty > avail)
      };
    });

    setItems([...currentItems, ...newItems]);
    setPickerItems([]);
    setShowItemPicker(false);
    setItemSearch('');
  };

  const filteredMaterials = (materials || []).filter(m => {
    if (!itemSearch) return true;
    const s = itemSearch.toLowerCase();
    return (m.display_name?.toLowerCase().includes(s) || m.name?.toLowerCase().includes(s) || m.item_code?.toLowerCase().includes(s));
  });

  const handleAddItemToPicker = (material) => {
    const existing = pickerItems.find(i => i.item_id === material.id);
    if (existing) {
      handlePickerQtyChange(material.id, 1);
    } else {
      setPickerItems([...pickerItems, {
        item_id: material.id,
        material: material,
        variant_id: formData.variant_id || '',
        qty: 1,
        rate: getRate(material.id, formData.variant_id || '')
      }]);
    }
  };

  const handleHeaderVariantChange = (variantId) => {
    setFormData(prev => ({ ...prev, variant_id: variantId }));

    // Update all existing items that support variants
    setItems(items.map(item => {
      if (item.is_service || !item.uses_variant) return item;

      // Update variant_id and recalculate rate/stock
      const mat = materials.find(m => m.id === item.material_id);
      if (!mat) return item;

      const newRate = getRate(item.material_id, variantId);
      const newAvail = (formData.source_type === 'WAREHOUSE') ? getAvailableQty(item.material_id, variantId) : 0;
      const qty = parseFloat(item.quantity) || 0;

      let isValid = !!item.material_id && qty > 0 && !!variantId;
      if (isValid && formData.source_type === 'WAREHOUSE' && qty > newAvail && !allowInsufficientStock) {
        isValid = false;
      }

      return { 
        ...item, 
        variant_id: variantId, 
        rate: newRate, 
        amount: qty * newRate,
        available_qty: newAvail,
        valid: isValid,
        stock_warning: (formData.source_type === 'WAREHOUSE' && qty > newAvail)
      };
    }));
  };

  const handleSourceTypeChange = (sourceType) => {
    setFormData(prev => ({ 
      ...prev, 
      source_type: sourceType,
      warehouse_id: sourceType === 'DIRECT_SUPPLY' ? '' : prev.warehouse_id
    }));
    
    // Refresh stock for all items
    setItems(items.map(item => {
      if (item.is_service) return item;
      const avail = (sourceType === 'WAREHOUSE' && item.material_id) ? getAvailableQty(item.material_id, item.variant_id) : 0;
      const qty = parseFloat(item.quantity) || 0;
      return { 
        ...item, 
        available_qty: avail,
        valid: !!item.material_id && qty > 0 && (sourceType !== 'WAREHOUSE' || qty <= avail || allowInsufficientStock),
        stock_warning: (sourceType === 'WAREHOUSE' && qty > avail)
      };
    }));
  };

  const addItem = () => {
    setItems([...items, { 
      id: items.length + 1, 
      material_id: '', 
      variant_id: formData.variant_id || '', 
      material_name: '', 
      unit: 'Nos', 
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
        updates.unit = mat?.unit || 'Nos';
        updates.is_service = mat?.item_type === 'service';
        updates.uses_variant = mat?.item_type === 'service' ? false : (mat?.uses_variant || false);
        
        // Default to header variant if item supports variants
        const defaultVarId = updates.uses_variant ? (formData.variant_id || '') : '';
        updates.variant_id = defaultVarId;
        updates.rate = getRate(value, defaultVarId);
        
        updates.available_qty = (formData.source_type === 'WAREHOUSE' && mat?.item_type !== 'service') ? getAvailableQty(value, defaultVarId) : 0;
      }
      
      if (field === 'variant_id' && item.material_id) {
        updates.rate = getRate(item.material_id, value);
        updates.available_qty = (formData.source_type === 'WAREHOUSE' && !item.is_service) ? getAvailableQty(item.material_id, value) : 0;
      }
      
      if (field === 'quantity' || field === 'rate') {
        const qty = field === 'quantity' ? parseFloat(value) || 0 : parseFloat(item.quantity) || 0;
        const rate = field === 'rate' ? parseFloat(value) || 0 : parseFloat(item.rate) || 0;
        updates.amount = qty * rate;
      }
      
      const qty = parseFloat(updates.quantity !== undefined ? updates.quantity : item.quantity) || 0;
      const avail = updates.available_qty !== undefined ? updates.available_qty : item.available_qty;
      const usesVar = updates.uses_variant !== undefined ? updates.uses_variant : item.uses_variant;
      const isServ = updates.is_service !== undefined ? updates.is_service : item.is_service;
      const hasVariantMissing = usesVar && !item.variant_id && !updates.variant_id;
      
      let isValid = !!(item.material_id || updates.material_id) && qty > 0 && !hasVariantMissing;
      
      // If allow insufficient stock is enabled, mark as valid even with low stock. Skip for services.
      if (isValid && !isServ && formData.source_type === 'WAREHOUSE' && qty > avail && !allowInsufficientStock) {
        isValid = false;
      }
      
      updates.valid = isValid;
      updates.stock_warning = (!isServ && formData.source_type === 'WAREHOUSE' && qty > avail);
      
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
      if (!item.is_service && formData.source_type === 'WAREHOUSE' && parseFloat(item.quantity) > item.available_qty && !allowInsufficientStock) {
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
      const validItems = items.filter(i => i.valid && i.material_id);
      if (validItems.length === 0) {
        alert('Please add at least one valid item to the Non-Billable Delivery Challan.');
        setLoading(false);
        return;
      }

      const dcData = {
        ...formData,
        warehouse_id: formData.source_type === 'WAREHOUSE' ? formData.warehouse_id : null,
        variant_id: formData.variant_id || null,
        eway_bill_date: formData.eway_bill_date || null,
        eway_valid_till: formData.eway_valid_till || null,
        po_date: formData.po_date || null,
        project_id: formData.project_id || null,
        status: 'active',
        dc_type: 'non-billable'
      };
      
      let dcId;
      
      if (isEditing) {
        await supabase.from('delivery_challans').update(dcData).eq('id', editDC.id);
        dcId = editDC.id;
        await supabase.from('delivery_challan_items').delete().eq('delivery_challan_id', dcId);
      } else {
        const result = await createDeliveryChallan(dcData);
        dcId = result.id;
      }
      
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
          if (item.is_service) continue;
          
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
      
      alert(isEditing ? 'NB-DC Updated!' : 'NB-DC Created!');
      setIsDirty(false);
      if (onSuccess) onSuccess();
      
    } catch (error) {
      console.error('Error:', error);
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const generateNBDCNo = async () => {
    const { data: existingDCs } = await supabase
      .from('delivery_challans')
      .select('dc_number')
      .eq('dc_type', 'non-billable')
      .order('dc_number', { ascending: false })
      .limit(1);
    
    // Get padding from series config if possible, else default 4
    const { data: series } = await supabase
      .from('document_series')
      .select('configs')
      .eq('is_default', true)
      .single();
    const padding = parseInt(series?.configs?.dc?.padding) || 4;

    let num = 1;
    if (existingDCs && existingDCs.length > 0) {
      const lastNumStr = existingDCs[0].dc_number.replace('NBDC-', '');
      const lastNum = parseInt(lastNumStr);
      if (!isNaN(lastNum)) num = lastNum + 1;
    }
    const paddedNum = String(num).padStart(padding, '0');
    return `NBDC-${paddedNum}`;
  };

  const activeVariants = variants.filter(v => v.variant_name !== 'No Variant');
  const validItems = items.filter(i => i.valid);
  const totalQty = validItems.reduce((sum, i) => sum + (parseFloat(i.quantity) || 0), 0);
  const totalAmount = validItems.reduce((sum, i) => sum + (i.amount || 0), 0);

  return (
    <div className="card">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <h2 className="card-title">{isEditing ? 'Edit Non-Billable DC' : 'Create Non-Billable DC'}</h2>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#374151' }}>
          <input
            type="checkbox"
            checked={allowInsufficientStock}
            onChange={(e) => {
              setAllowInsufficientStock(e.target.checked);
              localStorage.setItem('nb_dc_allow_insufficient_stock', e.target.checked);
            }}
            style={{ width: '16px', height: '16px' }}
          />
          Allow NB-DC with insufficient stock
        </label>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div style={{ background: '#f8f9fa', padding: '12px', marginBottom: '12px', borderRadius: '6px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '11px', marginBottom: '2px' }}>NB-DC No *</label>
              <input type="text" className="form-input" style={{ padding: '6px 8px', fontSize: '13px' }} value={formData.dc_number} disabled />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '11px', marginBottom: '2px' }}>DC Date *</label>
              <input type="date" name="dc_date" className="form-input" style={{ padding: '6px 8px', fontSize: '13px' }} value={formData.dc_date} onChange={handleInputChange} disabled={isLocked} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '11px', marginBottom: '2px' }}>Client *</label>
              <select 
                name="client_name"
                className="form-select"
                style={{ padding: '6px 8px', fontSize: '13px' }}
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
                  if (client) loadShippingAddresses(client.id);
                }}
                disabled={isLocked}
              >
                <option value="">Select</option>
                {clients.map(c => <option key={c.id} value={c.client_name}>{c.client_name}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '11px', marginBottom: '2px' }}>Project</label>
              <select name="project_id" className="form-select" style={{ padding: '6px 8px', fontSize: '13px' }} value={formData.project_id} onChange={(e) => handleProjectChange(e.target.value)} disabled={isLocked}>
                <option value="">Select</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.project_name || p.name}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '11px', marginBottom: '2px' }}>Variant</label>
              <select name="variant_id" className="form-select" style={{ padding: '6px 8px', fontSize: '13px' }} value={formData.variant_id} onChange={(e) => handleHeaderVariantChange(e.target.value)} disabled={isLocked}>
                <option value="">Select</option>
                {activeVariants.map(v => <option key={v.id} value={v.id}>{v.variant_name}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '11px', marginBottom: '2px' }}>Source Type *</label>
              <select name="source_type" className="form-select" style={{ padding: '6px 8px', fontSize: '13px' }} value={formData.source_type} onChange={(e) => handleSourceTypeChange(e.target.value)} disabled={isLocked}>
                <option value="WAREHOUSE">Warehouse</option>
                <option value="DIRECT_SUPPLY">Direct</option>
              </select>
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '10px', marginTop: '12px' }}>
            {formData.source_type === 'WAREHOUSE' && (
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '11px', marginBottom: '2px' }}>Warehouse *</label>
                <select name="warehouse_id" className="form-select" style={{ padding: '6px 8px', fontSize: '13px' }} value={formData.warehouse_id} onChange={(e) => handleWarehouseChange(e.target.value)} disabled={isLocked}>
                  <option value="">Select</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.warehouse_name || w.name}</option>)}
                </select>
              </div>
            )}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '11px', marginBottom: '2px' }}>Vehicle No</label>
              <input type="text" name="vehicle_number" className="form-input" style={{ padding: '6px 8px', fontSize: '13px' }} value={formData.vehicle_number} onChange={handleInputChange} disabled={isLocked} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '11px', marginBottom: '2px' }}>Driver</label>
              <input type="text" name="driver_name" className="form-input" style={{ padding: '6px 8px', fontSize: '13px' }} value={formData.driver_name} onChange={handleInputChange} disabled={isLocked} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '11px', marginBottom: '2px' }}>Remarks</label>
              <input type="text" name="remarks" className="form-input" style={{ padding: '6px 8px', fontSize: '13px' }} value={formData.remarks || ''} onChange={handleInputChange} disabled={isLocked} placeholder="Add remarks..." />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '11px', marginBottom: '2px' }}>Authorized Signatory</label>
              <select 
                name="authorized_signatory_id"
                className="form-select" 
                style={{ padding: '6px 8px', fontSize: '13px' }} 
                value={formData.authorized_signatory_id || ''} 
                onChange={handleInputChange} 
                disabled={isLocked}
              >
                <option value="">Select Signatory</option>
                {(organisation?.signatures || []).map(sig => (
                  <option key={sig.id} value={sig.id}>{sig.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        
        <div className="form-group" style={{ marginTop: '20px' }}>
          <div className="grid-table-container">
            <table className="grid-table">
              <thead>
                <tr>
                  <th className="col-shrink">#</th>
                  <th className="col-item">ITEM</th>
                  <th className="col-variant">VARIANT</th>
                  {formData.source_type === 'WAREHOUSE' && <th className="col-avail">AVAIL</th>}
                  <th className="col-qty">QTY</th>
                  <th className="col-unit">UNIT</th>
                  <th className="col-rate">RATE</th>
                  <th className="col-amount">AMOUNT</th>
                  <th className="col-shrink"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr 
                    key={item.id} 
                    className={!item.valid && item.material_id ? 'invalid-row' : draggingItemId === item.id ? 'row-dragging' : ''}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDropOnRow(e, item.id)}
                  >
                    <td 
                      className="text-center cell-static col-shrink row-drag-handle" 
                      title="Drag to reorder"
                      draggable={!isLocked}
                      onDragStart={(e) => handleDragStart(e, item.id)}
                      onDragEnd={handleDragEnd}
                    >
                      {index + 1}
                    </td>
                    <td className="col-item">
                      <select 
                        className="cell-select"
                        value={item.material_id} 
                        onChange={(e) => handleItemChange(item.id, 'material_id', e.target.value)}
                        disabled={isLocked}
                      >
                        <option value="">Select Item</option>
                        {materials.map(m => (
                          <option key={m.id} value={m.id}>{m.display_name || m.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="col-shrink">
                      {!item.is_service ? (
                        <select 
                          className="cell-select"
                          value={item.variant_id || ''} 
                          onChange={(e) => handleItemChange(item.id, 'variant_id', e.target.value)}
                          disabled={!item.uses_variant || isLocked}
                        >
                          <option value="">{item.uses_variant ? 'Select' : 'N/A'}</option>
                          {activeVariants
                            .filter(v => {
                              if (!item.material_id) return true;
                              return variantPricingMap[item.material_id]?.[v.id];
                            })
                            .map(v => (
                              <option key={v.id} value={v.id}>{v.variant_name}</option>
                            ))
                          }
                        </select>
                      ) : (
                        <span className="cell-static text-center" style={{ color: '#94a3b8' }}>N/A</span>
                      )}
                    </td>
                    {formData.source_type === 'WAREHOUSE' && (
                      <td className="col-shrink text-right cell-static avail-value">
                        {!item.is_service ? item.available_qty.toFixed(2) : '-'}
                      </td>
                    )}
                    <td className="col-shrink">
                      <input 
                        type="number"
                        className="cell-input text-right"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                        disabled={isLocked}
                        placeholder="0"
                      />
                    </td>
                    <td className="col-shrink">
                      <select 
                        className="cell-select text-center"
                        value={item.unit}
                        onChange={(e) => handleItemChange(item.id, 'unit', e.target.value)}
                        disabled={isLocked}
                      >
                        <option value="">Unit</option>
                        {units.map(u => (
                          <option key={u.id} value={u.unit_code}>{u.unit_name || u.unit_code}</option>
                        ))}
                        {!units.some(u => u.unit_code === item.unit) && item.unit && (
                          <option value={item.unit}>{item.unit}</option>
                        )}
                      </select>
                    </td>
                    <td className="col-rate">
                      <input 
                        type="number"
                        className="cell-input text-right"
                        value={item.rate}
                        onChange={(e) => handleItemChange(item.id, 'rate', e.target.value)}
                        disabled={isLocked}
                        placeholder="0"
                        step="0.01"
                      />
                    </td>
                    <td className="col-amount cell-static text-right amount-value">
                      {item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="delete-cell col-shrink">
                      {!isLocked && items.length > 1 && (
                        <button type="button" className="btn-delete" onClick={() => removeItem(item.id)}>×</button>
                      )}
                    </td>
                  </tr>
                ))}
                
                {/* Total Row mirroring Vyapar Screenshot */}
                <tr className="total-row">
                  <td colSpan={formData.source_type === 'WAREHOUSE' ? 4 : 3} className="total-label">TOTAL</td>
                  <td className="text-right cell-static" style={{ fontWeight: 'bold', textAlign: 'right', paddingRight: '14px' }}>{totalQty.toFixed(2)}</td>
                  <td></td>
                  <td></td>
                  <td className="total-value">
                    {totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
          
          {!isLocked && (
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button type="button" className="btn btn-secondary" onClick={addItem} style={{ borderRadius: '8px', fontWeight: 500 }}>
                + Add Item
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setShowItemPicker(true)} style={{ borderRadius: '8px', fontWeight: 500 }}>
                + Add Multiple Items
              </button>
            </div>
          )}
        </div>
        
        <div style={{ background: '#f0f7ff', padding: '6px 16px', marginTop: '12px', borderRadius: '6px', display: 'flex', justifyContent: 'flex-end', gap: '30px', fontSize: '11px' }}>
          <div>Total Qty: <strong>{totalQty.toFixed(2)}</strong></div>
          <div>Total Amount: <strong>₹{totalAmount.toFixed(2)}</strong></div>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={loading || isLocked}>{loading ? 'Saving...' : isEditing ? 'Update NB-DC' : 'Create NB-DC'}</button>
        </div>
      </form>
    </div>
  );
}

