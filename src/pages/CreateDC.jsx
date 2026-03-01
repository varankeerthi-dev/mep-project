import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function CreateDC({ onSuccess, onCancel, editDC }) {
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [variants, setVariants] = useState([]);
  const [units, setUnits] = useState([]);
  const [stock, setStock] = useState([]);
  const [pricing, setPricing] = useState({});
  const [clients, setClients] = useState([]);
  
  // Multiple Item Picker State
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  const [pickerItems, setPickerItems] = useState([]);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 768 : false);
  
  // DC Settings - Allow insufficient stock
  const [allowInsufficientStock, setAllowInsufficientStock] = useState(() => {
    const saved = localStorage.getItem('dc_allow_insufficient_stock');
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
    status: 'active'
  });

  const [items, setItems] = useState([
    { id: 1, material_id: '', variant_id: '', material_name: '', unit: 'nos', quantity: '', rate: '', amount: 0, uses_variant: false, available_qty: 0, valid: false, is_service: false }
  ]);
  const [dcSettings, setDcSettings] = useState({ prefix: 'DC', suffix: '', padding: '5' });

  useEffect(() => { loadData(); }, []);
  
  // Close dropdown when clicking outside
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
      const [projData, matData, whData, varData, stockData, clientData, unitsData] = await Promise.all([
        supabase.from('projects').select('*').order('name'),
        supabase.from('materials').select('id, display_name, name, unit, uses_variant, sale_price, item_type').order('name'),
        supabase.from('warehouses').select('*'),
        supabase.from('company_variants').select('*').eq('is_active', true).order('variant_name'),
        supabase.from('item_stock').select('*'),
        supabase.from('clients').select('*').order('client_name'),
        supabase.from('item_units').select('*').order('unit_name')
      ]);
      
      setProjects(projData.data || []);
      setMaterials(matData.data || []);
      setWarehouses(whData.data || []);
      setVariants(varData.data || []);
      setUnits(unitsData.data || []);
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
      
      // Generate DC No if new record
      if (!editDC) {
        const dcNumber = await generateDCNo();
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
      .select('*')
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
        unit: mat?.unit || 'nos',
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
      const validItems = items.filter(i => i.valid);
      
      const dcData = {
        ...formData,
        warehouse_id: formData.source_type === 'WAREHOUSE' ? formData.warehouse_id : null,
        variant_id: formData.variant_id || null,
        eway_bill_date: formData.eway_bill_date || null,
        eway_valid_till: formData.eway_valid_till || null,
        project_id: formData.project_id || null,
        status: 'active'
      };
      
      let dcId;
      
      console.log('Saving DC with data:', dcData);
      
      if (isEditing) {
        await supabase.from('delivery_challans').update(dcData).eq('id', editDC.id);
        dcId = editDC.id;
        await supabase.from('delivery_challan_items').delete().eq('delivery_challan_id', dcId);
      } else {
        const { data, error } = await supabase.from('delivery_challans').insert(dcData).select().single();
        
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
          if (item.is_service) continue; // Skip stock movement for services
          
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
    // First try to get from new document_series table
    const { data: seriesData } = await supabase
      .from('document_series')
      .select('configs, current_number')
      .eq('is_default', true)
      .single();
    
    if (seriesData?.configs?.dc?.enabled) {
      const config = seriesData.configs.dc;
      const currentNum = (seriesData.current_number || config.start_number || 1);
      const paddedNum = String(currentNum).padStart(4, '0');
      
      // Update current number for next time
      await supabase.from('document_series').update({ 
        current_number: currentNum + 1 
      }).eq('is_default', true);
      
      // Get FY prefix if auto
      let prefix = config.prefix || '';
      if (prefix.includes('{FY}')) {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const fy = month < 3 ? `${year - 1}-${year.toString().slice(-2)}` : `${year}-${(year + 1).toString().slice(-2)}`;
        prefix = prefix.replace('{FY}', fy);
      }
      
      return `${prefix}${paddedNum}${config.suffix || ''}`;
    }
    
    // Fallback to old settings
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
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <h2 className="card-title">{isEditing ? 'Edit Delivery Challan' : 'Create Delivery Challan'}</h2>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#374151' }}>
          <input
            type="checkbox"
            checked={allowInsufficientStock}
            onChange={(e) => {
              setAllowInsufficientStock(e.target.checked);
              localStorage.setItem('dc_allow_insufficient_stock', e.target.checked);
            }}
            style={{ width: '16px', height: '16px' }}
          />
          Allow DC with insufficient stock
        </label>
      </div>
      
      {clients.length === 0 && (
        <div style={{ padding: '10px', background: '#ffcccc', margin: '10px' }}>
          No clients found. Please create clients in database.
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        {/* Ultra Compact Top Row */}
        <div style={{ background: '#f8f9fa', padding: '12px', marginBottom: '12px', borderRadius: '6px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '11px', marginBottom: '2px' }}>DC No *</label>
              <input 
                type="text" 
                name="dc_number"
                className="form-input"
                style={{ padding: '6px 8px', fontSize: '13px' }}
                value={formData.dc_number}
                onChange={handleInputChange}
                placeholder="Auto"
                disabled={isLocked}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '11px', marginBottom: '2px' }}>DC Date *</label>
              <input 
                type="date" 
                name="dc_date"
                className="form-input"
                style={{ padding: '6px 8px', fontSize: '13px' }}
                value={formData.dc_date}
                onChange={handleInputChange}
                disabled={isLocked}
              />
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
                  if (client) {
                    loadShippingAddresses(client.id);
                  } else {
                    setShippingAddresses([]);
                    setSelectedShippingIndex(-1);
                  }
                }}
                disabled={isLocked}
              >
                <option value="">Select</option>
                {clients.map(c => (
                  <option key={c.id} value={c.client_name}>{c.client_name}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '11px', marginBottom: '2px' }}>Project</label>
              <select 
                name="project_id" 
                className="form-select"
                style={{ padding: '6px 8px', fontSize: '13px' }}
                value={formData.project_id}
                onChange={(e) => handleProjectChange(e.target.value)}
                disabled={isLocked}
              >
                <option value="">Select</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '11px', marginBottom: '2px' }}>Variant</label>
              <select 
                name="variant_id" 
                className="form-select"
                style={{ padding: '6px 8px', fontSize: '13px' }}
                value={formData.variant_id}
                onChange={(e) => handleHeaderVariantChange(e.target.value)}
                disabled={isLocked}
              >
                <option value="">Select Variant</option>
                {activeVariants.map(v => (
                  <option key={v.id} value={v.id}>{v.variant_name}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '11px', marginBottom: '2px' }}>Source Type *</label>
              <select 
                name="source_type" 
                className="form-select"
                style={{ padding: '6px 8px', fontSize: '13px' }}
                value={formData.source_type}
                onChange={(e) => handleSourceTypeChange(e.target.value)}
                disabled={isLocked}
              >
                <option value="WAREHOUSE">Warehouse</option>
                <option value="DIRECT_SUPPLY">Direct</option>
              </select>
            </div>
          </div>
          
          {/* Ultra Compact Logistics Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '10px', marginBottom: '12px' }}>
            {formData.source_type === 'WAREHOUSE' && (
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '11px', marginBottom: '2px' }}>Warehouse *</label>
                <select 
                  name="warehouse_id" 
                  className="form-select"
                  style={{ padding: '6px 8px', fontSize: '13px' }}
                  value={formData.warehouse_id}
                  onChange={(e) => handleWarehouseChange(e.target.value)}
                  disabled={isLocked}
                >
                  <option value="">Select</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.warehouse_name || w.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '11px', marginBottom: '2px' }}>Vehicle No</label>
              <input type="text" name="vehicle_number" className="form-input" style={{ padding: '6px 8px', fontSize: '13px' }} maxLength={20} value={formData.vehicle_number} onChange={handleInputChange} disabled={isLocked} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '11px', marginBottom: '2px' }}>Driver</label>
              <input type="text" name="driver_name" className="form-input" style={{ padding: '6px 8px', fontSize: '13px' }} value={formData.driver_name} onChange={handleInputChange} disabled={isLocked} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '11px', marginBottom: '2px' }}>PO No</label>
              <input type="text" name="po_no" className="form-input" style={{ padding: '6px 8px', fontSize: '13px' }} value={formData.po_no || ''} onChange={handleInputChange} disabled={isLocked} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '11px', marginBottom: '2px' }}>PO Date</label>
              <input type="date" name="po_date" className="form-input" style={{ padding: '6px 8px', fontSize: '13px' }} value={formData.po_date || ''} onChange={handleInputChange} disabled={isLocked} />
            </div>
          </div>
          
          {/* Remarks Row */}
          <div style={{ marginBottom: '12px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '11px', marginBottom: '2px' }}>Remarks</label>
              <input type="text" name="remarks" className="form-input" style={{ padding: '6px 8px', fontSize: '13px' }} value={formData.remarks || ''} onChange={handleInputChange} disabled={isLocked} placeholder="Add remarks..." />
            </div>
          </div>
        </div>
        
        {/* Compact Billing & Shipping Address Section */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          {/* Billing Address */}
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '10px', minHeight: '130px' }}>
            <div style={{ fontWeight: 600, fontSize: '12px', marginBottom: '6px', color: '#374151' }}>Billing Address</div>
            {formData.client_name ? (
              <div style={{ fontSize: '12px', color: '#4b5563', whiteSpace: 'pre-line', lineHeight: '1.4' }}>
                {formData.client_name}
                {formData.client_name && '\n'}{formData.ship_to_address_line1 || formData.ship_to_address_line1}{formData.ship_to_address_line1 && '\n'}{formData.ship_to_address_line2}
                {(formData.ship_to_city || formData.ship_to_pincode) && '\n'}{formData.ship_to_city}{formData.ship_to_city && formData.ship_to_pincode && ' - '}{formData.ship_to_pincode}
                {formData.ship_to_state && '\n'}{formData.ship_to_state}
                {formData.ship_to_gstin && '\n'}GSTIN: {formData.ship_to_gstin}
                {formData.ship_to_contact && '\n'}Contact: {formData.ship_to_contact}
              </div>
            ) : (
              <div style={{ fontSize: '13px', color: '#9ca3af', fontStyle: 'italic' }}>Select a client</div>
            )}
          </div>

          {/* Shipping Address */}
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px', minHeight: '160px', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <div style={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>Shipping Address</div>
              {shippingAddresses.length > 0 && (
                <div style={{ position: 'relative' }} ref={shippingDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setShowShippingDropdown(!showShippingDropdown)}
                    style={{ background: '#fff', border: '1px solid #d1d5db', borderRadius: '4px', padding: '3px 6px', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    {selectedShippingIndex >= 0 ? `Addr ${selectedShippingIndex + 1}` : 'Select'}
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                  {showShippingDropdown && (
                    <div style={{ position: 'absolute', top: '100%', right: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', zIndex: 100, minWidth: '180px', marginTop: '4px' }}>
                      <div
                        onClick={() => handleSelectShippingAddress(-1)}
                        style={{ padding: '6px 10px', cursor: 'pointer', fontSize: '12px', borderBottom: '1px solid #f3f4f6', background: selectedShippingIndex === -1 ? '#eff6ff' : 'transparent' }}
                      >
                        None
                      </div>
                      {shippingAddresses.map((addr, idx) => (
                        <div
                          key={addr.id}
                          onClick={() => handleSelectShippingAddress(idx)}
                          style={{ padding: '6px 10px', cursor: 'pointer', fontSize: '12px', borderBottom: '1px solid #f3f4f6', background: selectedShippingIndex === idx ? '#eff6ff' : 'transparent' }}
                        >
                          <div style={{ fontWeight: 500 }}>{addr.address_name || `Address ${idx + 1}`}</div>
                          <div style={{ fontSize: '10px', color: '#6b7280' }}>{addr.address_line1}, {addr.city}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {(selectedShippingIndex >= 0 && shippingAddresses[selectedShippingIndex]) ? (
              <div style={{ fontSize: '12px', color: '#4b5563', whiteSpace: 'pre-line', lineHeight: '1.4' }}>
                {shippingAddresses[selectedShippingIndex].address_name || shippingAddresses[selectedShippingIndex].address_name}
                {shippingAddresses[selectedShippingIndex].address_name && '\n'}{shippingAddresses[selectedShippingIndex].address_line1}
                {shippingAddresses[selectedShippingIndex].address_line1 && '\n'}{shippingAddresses[selectedShippingIndex].address_line2}
                {(shippingAddresses[selectedShippingIndex].city || shippingAddresses[selectedShippingIndex].pincode) && '\n'}{shippingAddresses[selectedShippingIndex].city}{shippingAddresses[selectedShippingIndex].city && shippingAddresses[selectedShippingIndex].pincode && ' - '}{shippingAddresses[selectedShippingIndex].pincode}
                {shippingAddresses[selectedShippingIndex].state && '\n'}{shippingAddresses[selectedShippingIndex].state}
                {shippingAddresses[selectedShippingIndex].gstin && '\n'}GSTIN: {shippingAddresses[selectedShippingIndex].gstin}
                {shippingAddresses[selectedShippingIndex].contact && '\n'}Contact: {shippingAddresses[selectedShippingIndex].contact}
              </div>
            ) : formData.client_name ? (
              <div>
                {shippingAddresses.length === 0 ? (
                  <div style={{ fontSize: '12px', color: '#9ca3af', fontStyle: 'italic' }}>No shipping address</div>
                ) : (
                  <div style={{ fontSize: '12px', color: '#9ca3af', fontStyle: 'italic' }}>No address selected</div>
                )}
                {formData.client_name && (
                  <button
                    type="button"
                    onClick={() => setShowAddShippingModal(true)}
                    style={{ marginTop: '6px', background: '#fff', border: '1px solid #d1d5db', borderRadius: '4px', padding: '3px 8px', fontSize: '11px', cursor: 'pointer' }}
                  >
                    + Add
                  </button>
                )}
              </div>
            ) : (
              <div style={{ fontSize: '12px', color: '#9ca3af', fontStyle: 'italic' }}>Select a client</div>
            )}
          </div>
        </div>
        
        {/* Add Shipping Address Modal */}
        {showAddShippingModal && (
          <div className="modal-overlay open" onClick={() => setShowAddShippingModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
              <div className="modal-header">
                <h2 className="modal-title">Add Shipping Address</h2>
                <button onClick={() => setShowAddShippingModal(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }}>&times;</button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Address Name</label>
                  <input type="text" className="form-input" value={newShippingAddress.address_name} onChange={(e) => setNewShippingAddress({...newShippingAddress, address_name: e.target.value})} placeholder="e.g. Main Office" />
                </div>
                <div className="form-group">
                  <label className="form-label">Address Line 1</label>
                  <input type="text" className="form-input" value={newShippingAddress.address_line1} onChange={(e) => setNewShippingAddress({...newShippingAddress, address_line1: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Address Line 2</label>
                  <input type="text" className="form-input" value={newShippingAddress.address_line2} onChange={(e) => setNewShippingAddress({...newShippingAddress, address_line2: e.target.value})} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">City</label>
                    <input type="text" className="form-input" value={newShippingAddress.city} onChange={(e) => setNewShippingAddress({...newShippingAddress, city: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">State</label>
                    <input type="text" className="form-input" value={newShippingAddress.state} onChange={(e) => setNewShippingAddress({...newShippingAddress, state: e.target.value})} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Pincode</label>
                    <input type="text" className="form-input" value={newShippingAddress.pincode} onChange={(e) => setNewShippingAddress({...newShippingAddress, pincode: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">GSTIN</label>
                    <input type="text" className="form-input" value={newShippingAddress.gstin} onChange={(e) => setNewShippingAddress({...newShippingAddress, gstin: e.target.value})} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Contact</label>
                  <input type="text" className="form-input" value={newShippingAddress.contact} onChange={(e) => setNewShippingAddress({...newShippingAddress, contact: e.target.value})} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddShippingModal(false)}>Cancel</button>
                <button type="button" className="btn btn-primary" onClick={handleAddShippingAddress}>Save Address</button>
              </div>
            </div>
          </div>
        )}
        
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
                  {!item.is_service ? (
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
                  ) : (
                    <span style={{ fontSize: '12px', color: '#6b7280', padding: '6px', display: 'block' }}>N/A</span>
                  )}
                </span>
                {formData.source_type === 'WAREHOUSE' && (
                  <span style={{ width: '80px', textAlign: 'right', color: (item.quantity > item.available_qty && !allowInsufficientStock) ? '#dc3545' : (item.quantity > item.available_qty ? '#f59e0b' : '#28a745') }}>
                    {!item.is_service ? item.available_qty.toFixed(2) : '-'}
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
                    <option value="">Unit</option>
                    {units.map(u => (
                      <option key={u.id} value={u.unit_code}>{u.unit_name || u.unit_code}</option>
                    ))}
                    {!units.some(u => u.unit_code === item.unit) && item.unit && (
                      <option value={item.unit}>{item.unit}</option>
                    )}
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
            <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={addItem}>
                + Add Item
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowItemPicker(true)}>
                + Add Multiple Items
              </button>
            </div>
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

      {/* Multiple Item Picker Modal */}
      {showItemPicker && (
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
        }} onClick={() => setShowItemPicker(false)}>
          <div style={{
            background: '#fff',
            borderRadius: '8px',
            width: '94%',
            maxWidth: '1200px',
            height: '84vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Add Multiple Items</h3>
              <button onClick={() => setShowItemPicker(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>x</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div style={{ borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
                <div style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>
                  <input
                    type='text'
                    className='form-input'
                    placeholder='Search items...'
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    autoFocus
                  />
                </div>
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '6px', scrollBehavior: 'smooth' }}>
                  {filteredMaterials.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        padding: '8px',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        marginBottom: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                      onClick={() => handleAddItemToPicker(m)}
                    >
                      <div>
                        <div style={{ fontWeight: 500, fontSize: '12px', lineHeight: 1.2 }}>{m.display_name || m.name}</div>
                        <div style={{ fontSize: '11px', color: '#6b7280' }}>{m.item_code} | {m.unit} | Rs {m.sale_price || 0}</div>
                      </div>
                      <button style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', padding: '3px 10px', cursor: 'pointer', fontSize: '12px' }}>+</button>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
                <div style={{ padding: '12px', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>
                  Selected Items ({pickerItems.length})
                </div>
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '12px', scrollBehavior: 'smooth' }}>
                  {pickerItems.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#6b7280', padding: '40px' }}>
                      Click items from left panel to add here
                    </div>
                  ) : (
                    pickerItems.map((p) => (
                      <div key={p.item_id} style={{ padding: '10px', border: '1px solid #e5e7eb', borderRadius: '6px', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontWeight: 500, fontSize: '12px', lineHeight: 1.2 }}>{p.material?.display_name || p.material?.name}</span>
                          <button onClick={() => handleRemoveFromPicker(p.item_id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}>x</button>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
                          <button onClick={() => handlePickerQtyChange(p.item_id, -1)} style={{ width: '28px', height: '28px', border: '1px solid #e5e7eb', borderRadius: '4px', background: '#fff', cursor: 'pointer' }}>-</button>
                          <span style={{ width: '30px', textAlign: 'center' }}>{p.qty}</span>
                          <button onClick={() => handlePickerQtyChange(p.item_id, 1)} style={{ width: '28px', height: '28px', border: '1px solid #e5e7eb', borderRadius: '4px', background: '#fff', cursor: 'pointer' }}>+</button>
                          <span style={{ marginLeft: 'auto', fontWeight: 500 }}>₹{((parseFloat(p.qty) || 0) * (parseFloat(p.rate) || 0)).toFixed(2)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div style={{ padding: '12px', borderTop: '1px solid #e5e7eb', background: '#fafafa', position: 'sticky', bottom: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontWeight: 600 }}>
                    <span>Selected Total</span>
                    <span>₹{pickerItems.reduce((sum, p) => sum + ((parseFloat(p.qty) || 0) * (parseFloat(p.rate) || 0)), 0).toFixed(2)}</span>
                  </div>
                  <button
                    type="button"
                    className='btn btn-primary'
                    style={{ width: '100%' }}
                    onClick={handleAddItemsToDC}
                    disabled={pickerItems.length === 0}
                  >
                    Submit & Add {pickerItems.length} Item{pickerItems.length !== 1 ? 's' : ''} to Delivery Challan
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
