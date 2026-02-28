import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

const MAIN_CATEGORIES = ['VALVE', 'PIPE', 'FITTING', 'FLANGE', 'ELECTRICAL', 'PLUMBING', 'HVAC', 'FIRE PROTECTION', 'BUILDING MATERIALS', 'TOOLS', 'SAFETY', 'OFFICE', 'OTHER'];

const GST_RATES = [
  { value: 0, label: '0%' },
  { value: 0.5, label: '0.5%' },
  { value: 5, label: '5%' },
  { value: 12, label: '12%' },
  { value: 18, label: '18%' },
  { value: 28, label: '28%' },
];

const AVAILABLE_COLUMNS = [
  { key: 'display_name', label: 'Display Name', default: true },
  { key: 'item_code', label: 'Item Code', default: true },
  { key: 'main_category', label: 'Category', default: true },
  { key: 'size', label: 'Size', default: true },
  { key: 'pressure_class', label: 'Pressure Class', default: true },
  { key: 'material', label: 'Material', default: true },
  { key: 'unit', label: 'Unit', default: true },
  { key: 'sale_price', label: 'Sale Price', default: true },
  { key: 'purchase_price', label: 'Purchase Price', default: true },
  { key: 'hsn_code', label: 'HSN/SAC', default: true },
  { key: 'gst_rate', label: 'GST Rate', default: true },
  { key: 'uses_variant', label: 'Uses Variant', default: true },
  { key: 'track_inventory', label: 'Track Inv.', default: true },
  { key: 'low_stock_level', label: 'Low Stock', default: true },
  { key: 'current_stock', label: 'Current Stock', default: true },
  { key: 'is_active', label: 'Active', default: true },
];

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 20px',
        border: 'none',
        borderBottom: active ? '2px solid #3498db' : '2px solid transparent',
        background: 'none',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: active ? 'bold' : 'normal',
        color: active ? '#3498db' : '#666',
      }}
    >
      {children}
    </button>
  );
}

function ItemsTab() {
  const [materials, setMaterials] = useState([]);
  const [stockData, setStockData] = useState({});
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [variants, setVariants] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('materialColumns');
    return saved ? JSON.parse(saved) : AVAILABLE_COLUMNS.filter(c => c.default).map(c => c.key);
  });

  const [formData, setFormData] = useState({
    item_code: '', item_name: '', display_name: '', main_category: '', sub_category: '',
    size: '', pressure_class: '', schedule_type: '', material: '', end_connection: '',
    unit: 'nos', sale_price: '', purchase_price: '', hsn_code: '', gst_rate: 18, is_active: true,
    uses_variant: false
  });

  const [variantPricing, setVariantPricing] = useState({});

  useEffect(() => {
    loadMaterials();
    loadCategories();
    loadUnits();
    loadVariants();
  }, []);

  const loadMaterials = async () => {
    try {
      const { data } = await supabase.from('materials').select('*').order('name');
      setMaterials(data || []);
      
      // Load stock from item_stock table
      try {
        const { data: stock } = await supabase.from('item_stock').select('*');
        const stockMap = {};
        stock?.forEach(s => {
          if (!stockMap[s.item_id]) stockMap[s.item_id] = 0;
          stockMap[s.item_id] += parseFloat(s.current_stock) || 0;
        });
        setStockData(stockMap);
      } catch (e) {
        console.log('item_stock table not found');
      }
    } catch (e) {
      console.log('materials table error', e);
    }
  };

  const loadCategories = async () => {
    try {
      const { data } = await supabase.from('item_categories').select('*').eq('is_active', true).order('category_name');
      setCategories(data || []);
    } catch (e) {
      console.log('item_categories table not found, using defaults');
      setCategories([]);
    }
  };

  const loadUnits = async () => {
    try {
      const { data } = await supabase.from('item_units').select('*').eq('is_active', true).order('unit_name');
      setUnits(data || []);
    } catch (e) {
      console.log('item_units table not found, using defaults');
      setUnits([{ unit_code: 'nos', unit_name: 'Numbers' }]);
    }
  };

  const loadVariants = async () => {
    try {
      const { data } = await supabase.from('company_variants').select('*').eq('is_active', true).order('variant_name');
      setVariants(data || []);
    } catch (e) {
      console.log('company_variants table not found');
      setVariants([]);
    }
  };

  const loadVariantPricing = async (itemId) => {
    if (!itemId) return;
    try {
      const { data } = await supabase.from('item_variant_pricing').select('*').eq('item_id', itemId);
      const pricingMap = {};
      data?.forEach(p => {
        pricingMap[p.company_variant_id] = { sale_price: p.sale_price, purchase_price: p.purchase_price };
      });
      setVariantPricing(pricingMap);
    } catch (e) {
      console.log('item_variant_pricing error', e);
      setVariantPricing({});
    }
  };

  const checkVariantRecords = async (itemId) => {
    try {
      const [stockRes, pricingRes] = await Promise.all([
        supabase.from('item_stock').select('id').eq('item_id', itemId).not('company_variant_id', 'is', null),
        supabase.from('item_variant_pricing').select('id').eq('item_id', itemId)
      ]);
      return {
        hasStock: (stockRes.data?.length || 0) > 0,
        hasPricing: (pricingRes.data?.length || 0) > 0
      };
    } catch (e) {
      return { hasStock: false, hasPricing: false };
    }
  };

  const toggleColumn = (key) => {
    setVisibleColumns(prev => 
      prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key]
    );
  };

  useEffect(() => {
    localStorage.setItem('materialColumns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  const generateItemCode = () => {
    return 'ITEM-' + Date.now().toString(36).toUpperCase();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.uses_variant && Object.keys(variantPricing).length === 0) {
      alert('Please add at least one variant pricing before saving.');
      return;
    }

    if (formData.hsn_code && !/^\d{1,10}$/.test(formData.hsn_code)) {
      alert('HSN/SAC must be numeric and up to 10 digits.');
      return;
    }

    const materialData = {
      item_code: formData.item_code || generateItemCode(),
      name: formData.item_name,
      display_name: formData.display_name || formData.item_name,
      main_category: formData.main_category || null,
      sub_category: formData.sub_category || null,
      size: formData.size || null,
      pressure_class: formData.pressure_class || null,
      schedule_type: formData.schedule_type || null,
      material: formData.material || null,
      end_connection: formData.end_connection || null,
      unit: formData.unit,
      sale_price: formData.sale_price ? parseFloat(formData.sale_price) : null,
      purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : null,
      hsn_code: formData.hsn_code || null,
      gst_rate: formData.gst_rate || null,
      is_active: formData.is_active,
      uses_variant: formData.uses_variant,
    };

    try {
      let itemId;
      if (editingMaterial) {
        await supabase.from('materials').update({ ...materialData, updated_at: new Date().toISOString() }).eq('id', editingMaterial.id);
        itemId = editingMaterial.id;
      } else {
        const { data, error } = await supabase.from('materials').insert(materialData).select().single();
        if (error) throw error;
        itemId = data.id;
      }

      if (formData.uses_variant) {
        for (const [variantId, prices] of Object.entries(variantPricing)) {
          if (prices.sale_price || prices.purchase_price) {
            const { error: pricingError } = await supabase.from('item_variant_pricing').upsert({
              item_id: itemId,
              company_variant_id: variantId,
              sale_price: prices.sale_price ? parseFloat(prices.sale_price) : 0,
              purchase_price: prices.purchase_price ? parseFloat(prices.purchase_price) : null,
              updated_at: new Date().toISOString()
            }, { onConflict: 'item_id,company_variant_id' });
            if (pricingError) throw pricingError;
          }
        }
      }

      resetForm();
      loadMaterials();
    } catch (err) {
      alert('Error saving: ' + err.message);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingMaterial(null);
    setFormData({
      item_code: '', item_name: '', display_name: '', main_category: '', sub_category: '',
      size: '', pressure_class: '', schedule_type: '', material: '', end_connection: '',
      unit: 'nos', sale_price: '', purchase_price: '', hsn_code: '', gst_rate: 18, is_active: true,
      uses_variant: false
    });
    setVariantPricing({});
  };

  const editMaterial = async (material) => {
    setEditingMaterial(material);
    setFormData({
      item_code: material.item_code || '',
      item_name: material.name || '',
      display_name: material.display_name || '',
      main_category: material.main_category || '',
      sub_category: material.sub_category || '',
      size: material.size || '',
      pressure_class: material.pressure_class || '',
      schedule_type: material.schedule_type || '',
      material: material.material || '',
      end_connection: material.end_connection || '',
      unit: material.unit || 'nos',
      sale_price: material.sale_price || '',
      purchase_price: material.purchase_price || '',
      hsn_code: material.hsn_code || '',
      gst_rate: material.gst_rate || 18,
      is_active: material.is_active !== false,
      uses_variant: material.uses_variant || false
    });
    setShowForm(true);
    loadVariantPricing(material.id);
  };

  const handleUsesVariantChange = async (checked) => {
    if (editingMaterial && !checked && formData.uses_variant === true) {
      const records = await checkVariantRecords(editingMaterial.id);
      if (records.hasPricing || records.hasStock) {
        let message = 'Cannot disable variant for this item because:';
        if (records.hasPricing) message += '\n- Variant pricing records exist';
        if (records.hasStock) message += '\n- Variant stock records exist';
        message += '\n\nPlease delete these records first or contact support.';
        alert(message);
        return;
      }
    }
    setFormData({ ...formData, uses_variant: checked });
  };

  const handleVariantPricingChange = (variantId, field, value) => {
    setVariantPricing(prev => ({
      ...prev,
      [variantId]: {
        ...(prev[variantId] || {}),
        [field]: value
      }
    }));
  };

  const deleteMaterial = async (id) => {
    if (!confirm('Delete this item?')) return;

    try {
      const checks = await Promise.allSettled([
        supabase.from('quotation_items').select('id').eq('item_id', id).limit(1),
        supabase.from('delivery_challan_items').select('id').eq('material_id', id).limit(1),
        supabase.from('material_inward_items').select('id').eq('material_id', id).limit(1),
        supabase.from('quick_check_items').select('id').eq('item_id', id).limit(1),
      ]);

      const hasLinkedRecords = checks.some((r) => r.status === 'fulfilled' && (r.value.data?.length || 0) > 0);

      if (!hasLinkedRecords) {
        await supabase.from('item_variant_pricing').delete().eq('item_id', id);
        await supabase.from('item_stock').delete().eq('item_id', id);

        const { error } = await supabase.from('materials').delete().eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('materials')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', id);
        if (error) throw error;
        alert('Item is linked with transactions, so it was archived (disabled) instead of hard delete.');
      }

      setMaterials((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      console.error('Delete item error:', err);
      alert('Unable to delete item: ' + err.message);
    }
  };

  const toggleActive = async (material) => {
    await supabase.from('materials').update({ is_active: !material.is_active, updated_at: new Date().toISOString() }).eq('id', material.id);
    loadMaterials();
  };

  const [hideInactive, setHideInactive] = useState(false);

  const filteredMaterials = materials.filter(m => {
    const matchesSearch = 
      m.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.item_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.material?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || m.main_category === categoryFilter;
    const matchesActive = !hideInactive || m.is_active;
    return matchesSearch && matchesCategory && matchesActive;
  });

  const categoryList = ['All', ...categories.map(c => c.category_name)];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Items</h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-secondary" onClick={() => setShowColumnSettings(!showColumnSettings)}>
            ⚙ Columns
          </button>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            + Add Item
          </button>
        </div>
      </div>

      {showColumnSettings && (
        <div className="card" style={{ marginBottom: '16px' }}>
          <h3 className="card-title">Customize Columns</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
            {AVAILABLE_COLUMNS.map(col => (
              <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={visibleColumns.includes(col.key)} onChange={() => toggleColumn(col.key)} />
                {col.label}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="text" className="form-input" placeholder="Search items..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ maxWidth: '300px' }} />
          <select className="form-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ maxWidth: '200px' }}>
            {categoryList.map(cat => (<option key={cat} value={cat}>{cat === 'All' ? 'All Categories' : cat}</option>))}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input type="checkbox" checked={hideInactive} onChange={(e) => setHideInactive(e.target.checked)} />
            Hide Inactive
          </label>
          <span style={{ marginLeft: 'auto', color: '#666' }}>{filteredMaterials.length} items</span>
        </div>
      </div>

      <div className="card">
        {filteredMaterials.length === 0 ? (
          <div className="empty-state"><h3>No Items</h3></div>
        ) : (
          <div className="table-container" style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  {visibleColumns.includes('display_name') && <th>Display Name</th>}
                  {visibleColumns.includes('item_code') && <th>Item Code</th>}
                  {visibleColumns.includes('main_category') && <th>Category</th>}
                  {visibleColumns.includes('size') && <th>Size</th>}
                  {visibleColumns.includes('pressure_class') && <th>Pressure</th>}
                  {visibleColumns.includes('material') && <th>Material</th>}
                  {visibleColumns.includes('unit') && <th>Unit</th>}
                  {visibleColumns.includes('sale_price') && <th>Sale Price</th>}
                  {visibleColumns.includes('purchase_price') && <th>Purchase Price</th>}
                  {visibleColumns.includes('hsn_code') && <th>HSN/SAC</th>}
                  {visibleColumns.includes('gst_rate') && <th>GST</th>}
                  {visibleColumns.includes('uses_variant') && <th>Variant</th>}
                  {visibleColumns.includes('track_inventory') && <th>Track</th>}
                  {visibleColumns.includes('low_stock_level') && <th>Low Stock</th>}
                  {visibleColumns.includes('current_stock') && <th>Stock</th>}
                  {visibleColumns.includes('is_active') && <th>Active</th>}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMaterials.map(m => (
                  <tr key={m.id} style={{ opacity: m.is_active === false ? 0.5 : 1, cursor: 'pointer' }} onClick={() => editMaterial(m)}>
                    {visibleColumns.includes('display_name') && <td><strong>{m.display_name || m.name}</strong></td>}
                    {visibleColumns.includes('item_code') && <td>{m.item_code || '-'}</td>}
                    {visibleColumns.includes('main_category') && <td>{m.main_category || '-'}</td>}
                    {visibleColumns.includes('size') && <td>{m.size || '-'}</td>}
                    {visibleColumns.includes('pressure_class') && <td>{m.pressure_class || '-'}</td>}
                    {visibleColumns.includes('material') && <td>{m.material || '-'}</td>}
                    {visibleColumns.includes('unit') && <td>{m.unit}</td>}
                    {visibleColumns.includes('sale_price') && <td>₹{m.sale_price || '-'}</td>}
                    {visibleColumns.includes('purchase_price') && <td>₹{m.purchase_price || '-'}</td>}
                    {visibleColumns.includes('hsn_code') && <td>{m.hsn_code || '-'}</td>}
                    {visibleColumns.includes('gst_rate') && <td>{m.gst_rate || '-'}%</td>}
                    {visibleColumns.includes('uses_variant') && (
                      <td>
                        {m.uses_variant ? (
                          <span style={{ 
                            padding: '2px 8px', 
                            borderRadius: '4px', 
                            fontSize: '11px',
                            background: '#e3f2fd', 
                            color: '#1976d2',
                            fontWeight: '500'
                          }}>
                            Yes
                          </span>
                        ) : '-'}
                      </td>
                    )}
                    {visibleColumns.includes('track_inventory') && <td>{m.track_inventory ? '✓' : '-'}</td>}
                    {visibleColumns.includes('low_stock_level') && <td>{m.low_stock_level || '-'}</td>}
                    {visibleColumns.includes('current_stock') && (
                      <td style={{ color: (stockData[m.id] || 0) < (m.low_stock_level || 0) ? '#dc3545' : '#28a745', fontWeight: 'bold' }}>
                        {stockData[m.id] || 0}
                      </td>
                    )}
                    {visibleColumns.includes('is_active') && <td>{m.is_active ? '✓' : '✗'}</td>}
                    <td>
                      <button className="btn btn-sm btn-secondary" onClick={(e) => { e.stopPropagation(); editMaterial(m); }}>Edit</button>
                      <button className="btn btn-sm btn-secondary" style={{ marginLeft: '4px' }} onClick={(e) => { e.stopPropagation(); toggleActive(m); }}>{m.is_active ? 'Disable' : 'Enable'}</button>
                      <button className="btn btn-sm btn-secondary" style={{ marginLeft: '4px' }} onClick={(e) => { e.stopPropagation(); deleteMaterial(m.id); }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="modal-overlay open" onClick={resetForm}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: '92vw', maxWidth: '1100px', maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>{editingMaterial ? 'Edit Item' : 'Add Item'}</h2>
              <button onClick={resetForm} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>×</button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                <h4 style={{ marginBottom: '15px', color: '#3498db' }}>Basic Information</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Item Name *</label>
                    <input type="text" className="form-input" value={formData.item_name} onChange={e => setFormData({...formData, item_name: e.target.value, display_name: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Display Name (for Quotation)</label>
                    <input type="text" className="form-input" value={formData.display_name} onChange={e => setFormData({...formData, display_name: e.target.value})} placeholder="Name shown in quotations" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Item Code</label>
                    <input type="text" className="form-input" value={formData.item_code} onChange={e => setFormData({...formData, item_code: e.target.value})} placeholder="Auto-generated if empty" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Main Category</label>
                    <select className="form-select" value={formData.main_category} onChange={e => setFormData({...formData, main_category: e.target.value})}>
                      <option value="">Select Category</option>
                      {categories.map(cat => (<option key={cat.id} value={cat.category_name}>{cat.category_name}</option>))}
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ background: '#e8f4f8', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                <h4 style={{ marginBottom: '15px', color: '#3498db' }}>Technical Attributes (Internal Use Only)</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Size</label>
                    <input type="text" className="form-input" value={formData.size} onChange={e => setFormData({...formData, size: e.target.value})} placeholder="e.g., 25mm, 1 inch" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Pressure Class</label>
                    <input type="text" className="form-input" value={formData.pressure_class} onChange={e => setFormData({...formData, pressure_class: e.target.value})} placeholder="e.g., PN16, Class 150" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Schedule</label>
                    <input type="text" className="form-input" value={formData.schedule_type} onChange={e => setFormData({...formData, schedule_type: e.target.value})} placeholder="e.g., SCH40, S10" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Material</label>
                    <input type="text" className="form-input" value={formData.material} onChange={e => setFormData({...formData, material: e.target.value})} placeholder="e.g., SS304, CI, PVC" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">End Connection</label>
                    <input type="text" className="form-input" value={formData.end_connection} onChange={e => setFormData({...formData, end_connection: e.target.value})} placeholder="e.g., Threaded, Flanged, Solder" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Sub Category</label>
                    <input type="text" className="form-input" value={formData.sub_category} onChange={e => setFormData({...formData, sub_category: e.target.value})} />
                  </div>
                </div>
              </div>

              <div style={{ background: '#e8f8e8', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                <h4 style={{ marginBottom: '15px', color: '#28a745' }}>Commercial</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Unit</label>
                    <select className="form-select" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})}>
                      {units.length > 0 ? units.map(u => (<option key={u.unit_code} value={u.unit_code}>{u.unit_name} ({u.unit_code})</option>)) : <option value="nos">Nos</option>}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">HSN/SAC Code</label>
                    <input
                      type="text"
                      className="form-input"
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="Numeric only (max 10 digits)"
                      value={formData.hsn_code}
                      onChange={e => setFormData({...formData, hsn_code: e.target.value.replace(/\D/g, '').slice(0, 10)})}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">GST Rate (%)</label>
                    <select className="form-select" value={formData.gst_rate} onChange={e => setFormData({...formData, gst_rate: parseFloat(e.target.value)})}>
                      {GST_RATES.map(rate => (<option key={rate.value} value={rate.value}>{rate.label}</option>))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Sale Price</label>
                    <input type="number" className="form-input" value={formData.sale_price} onChange={e => setFormData({...formData, sale_price: e.target.value})} step="0.01" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Purchase Price</label>
                    <input type="number" className="form-input" value={formData.purchase_price} onChange={e => setFormData({...formData, purchase_price: e.target.value})} step="0.01" />
                  </div>
                </div>
              </div>

              <div style={{ background: '#fff3e0', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                <h4 style={{ marginBottom: '15px', color: '#f39c12' }}>Inventory</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={formData.track_inventory} onChange={e => setFormData({...formData, track_inventory: e.target.checked})} />
                      Track Inventory
                    </label>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Current Stock</label>
                    <input type="number" className="form-input" value={formData.current_stock} onChange={e => setFormData({...formData, current_stock: e.target.value})} step="0.01" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Low Stock Level</label>
                    <input type="number" className="form-input" value={formData.low_stock_level} onChange={e => setFormData({...formData, low_stock_level: e.target.value})} step="0.01" />
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} />
                  Active
                </label>
              </div>

              <div style={{ background: formData.uses_variant ? '#e8f4f8' : '#f8f9fa', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '500' }}>
                  <input 
                    type="checkbox" 
                    checked={formData.uses_variant} 
                    onChange={e => editingMaterial ? handleUsesVariantChange(e.target.checked) : setFormData({...formData, uses_variant: e.target.checked})}
                  />
                  This item uses Variant
                </label>
                <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                  {formData.uses_variant 
                    ? 'Prices will be set per variant below. At least one variant price is required before saving.'
                    : 'Enable to set different prices for different variants (Retail, Wholesale, Special, etc.)'}
                </p>
              </div>

              {formData.uses_variant && (
                <div style={{ background: '#f0f7ff', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                  <h4 style={{ marginBottom: '15px', color: '#1976d2' }}>Variant Pricing</h4>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Variant</th>
                        <th>Sale Price</th>
                        <th>Purchase Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {variants.filter(v => v.variant_name !== 'No Variant').map(variant => (
                        <tr key={variant.id}>
                          <td>{variant.variant_name}</td>
                          <td>
                            <input 
                              type="number" 
                              className="form-input"
                              value={variantPricing[variant.id]?.sale_price || ''}
                              onChange={e => handleVariantPricingChange(variant.id, 'sale_price', e.target.value)}
                              placeholder="0.00"
                              step="0.01"
                            />
                          </td>
                          <td>
                            <input 
                              type="number" 
                              className="form-input"
                              value={variantPricing[variant.id]?.purchase_price || ''}
                              onChange={e => handleVariantPricingChange(variant.id, 'purchase_price', e.target.value)}
                              placeholder="0.00"
                              step="0.01"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {Object.keys(variantPricing).length === 0 && (
                    <p style={{ color: '#dc3545', fontSize: '12px', marginTop: '8px' }}>At least one variant price is required</p>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button type="submit" className="btn btn-primary">{editingMaterial ? 'Update Item' : 'Save Item'}</button>
                <button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ServiceTab() {
  const [services, setServices] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    service_code: '', service_name: '', description: '', unit: 'nos',
    sale_price: '', purchase_price: '', hsn_code: '', tax_rate: 18, is_active: true
  });

  useEffect(() => { loadServices(); }, []);

  const loadServices = async () => {
    const { data } = await supabase.from('services').select('*').order('service_name');
    setServices(data || []);
  };

  const generateServiceCode = () => 'SVC-' + Date.now().toString(36).toUpperCase();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = {
      service_code: formData.service_code || generateServiceCode(),
      service_name: formData.service_name,
      description: formData.description || null,
      unit: formData.unit,
      sale_price: formData.sale_price ? parseFloat(formData.sale_price) : null,
      purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : null,
      hsn_code: formData.hsn_code || null,
      tax_rate: formData.tax_rate ? parseFloat(formData.tax_rate) : null,
      is_active: formData.is_active,
    };
    try {
      if (editingService) {
        const { error } = await supabase.from('services').update({ ...data, updated_at: new Date().toISOString() }).eq('id', editingService.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('services').insert(data);
        if (error) throw error;
      }
      resetForm();
      loadServices();
    } catch (err) {
      alert('Error saving service: ' + err.message);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingService(null);
    setFormData({ service_code: '', service_name: '', description: '', unit: 'nos', sale_price: '', purchase_price: '', hsn_code: '', tax_rate: 18, is_active: true });
  };

  const editService = (service) => {
    setEditingService(service);
    setFormData({
      service_code: service.service_code || '',
      service_name: service.service_name || '',
      description: service.description || '',
      unit: service.unit || 'nos',
      sale_price: service.sale_price || '',
      purchase_price: service.purchase_price || '',
      hsn_code: service.hsn_code || '',
      tax_rate: service.tax_rate || 18,
      is_active: service.is_active !== false
    });
    setShowForm(true);
  };

  const deleteService = async (id) => {
    if (confirm('Delete this service?')) {
      await supabase.from('services').delete().eq('id', id);
      loadServices();
    }
  };

  const filteredServices = services.filter(s => s.service_name?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Services</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add Service</button>
      </div>

      <div className="card" style={{ marginBottom: '16px' }}>
        <input type="text" className="form-input" placeholder="Search services..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ maxWidth: '300px' }} />
      </div>

      <div className="card">
        {filteredServices.length === 0 ? <div className="empty-state"><h3>No Services</h3></div> : (
          <table className="table">
            <thead><tr><th>Service Code</th><th>Service Name</th><th>Unit</th><th>Sale Price</th><th>HSN/SAC</th><th>Active</th><th>Actions</th></tr></thead>
            <tbody>
              {filteredServices.map(s => (
                <tr key={s.id} style={{ opacity: s.is_active === false ? 0.5 : 1 }}>
                  <td>{s.service_code}</td><td><strong>{s.service_name}</strong></td><td>{s.unit}</td><td>₹{s.sale_price || '-'}</td><td>{s.hsn_code || '-'}</td><td>{s.is_active ? '✓' : '✗'}</td>
                  <td><button className="btn btn-sm btn-secondary" onClick={() => editService(s)}>Edit</button><button className="btn btn-sm btn-secondary" style={{ marginLeft: '4px' }} onClick={() => deleteService(s.id)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div className="modal-overlay open" onClick={resetForm}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>{editingService ? 'Edit Service' : 'Add Service'}</h2>
              <button onClick={resetForm} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Service Name *</label><input type="text" className="form-input" value={formData.service_name} onChange={e => setFormData({...formData, service_name: e.target.value})} required /></div>
                <div className="form-group"><label className="form-label">Service Code</label><input type="text" className="form-input" value={formData.service_code} onChange={e => setFormData({...formData, service_code: e.target.value})} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Unit</label><input type="text" className="form-input" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} /></div>
                <div className="form-group"><label className="form-label">HSN/SAC</label><input type="text" className="form-input" value={formData.hsn_code} onChange={e => setFormData({...formData, hsn_code: e.target.value})} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Sale Price</label><input type="number" className="form-input" value={formData.sale_price} onChange={e => setFormData({...formData, sale_price: e.target.value})} step="0.01" /></div>
                <div className="form-group"><label className="form-label">Purchase Price</label><input type="number" className="form-input" value={formData.purchase_price} onChange={e => setFormData({...formData, purchase_price: e.target.value})} step="0.01" /></div>
              </div>
              <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
              <div className="form-group"><label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} /> Active</label></div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}><button type="submit" className="btn btn-primary">{editingService ? 'Update' : 'Save'}</button><button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryTab() {
  const [categories, setCategories] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({ category_name: '', description: '', is_active: true });

  useEffect(() => { loadCategories(); }, []);

  const loadCategories = async () => {
    const { data } = await supabase.from('item_categories').select('*').order('category_name');
    setCategories(data || []);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCategory) {
        const { error } = await supabase.from('item_categories').update(formData).eq('id', editingCategory.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('item_categories').insert(formData);
        if (error) throw error;
      }
      resetForm();
      loadCategories();
    } catch (err) {
      alert('Error saving category: ' + err.message);
    }
  };

  const resetForm = () => { setShowForm(false); setEditingCategory(null); setFormData({ category_name: '', description: '', is_active: true }); };

  const editCategory = (cat) => { setEditingCategory(cat); setFormData({ category_name: cat.category_name, description: cat.description || '', is_active: cat.is_active !== false }); setShowForm(true); };
  const deleteCategory = async (id) => { if (confirm('Delete this category?')) { await supabase.from('item_categories').delete().eq('id', id); loadCategories(); }};

  const filteredCategories = categories.filter(c => c.category_name?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Categories</h1><button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add Category</button></div>
      <div className="card" style={{ marginBottom: '16px' }}><input type="text" className="form-input" placeholder="Search categories..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ maxWidth: '300px' }} /></div>
      <div className="card">
        {filteredCategories.length === 0 ? <div className="empty-state"><h3>No Categories</h3></div> : (
          <table className="table">
            <thead><tr><th>Category Name</th><th>Description</th><th>Active</th><th>Actions</th></tr></thead>
            <tbody>{filteredCategories.map(c => (<tr key={c.id} style={{ opacity: c.is_active === false ? 0.5 : 1 }}><td><strong>{c.category_name}</strong></td><td>{c.description || '-'}</td><td>{c.is_active ? '✓' : '✗'}</td><td><button className="btn btn-sm btn-secondary" onClick={() => editCategory(c)}>Edit</button><button className="btn btn-sm btn-secondary" style={{ marginLeft: '4px' }} onClick={() => deleteCategory(c.id)}>Delete</button></td></tr>))}</tbody>
          </table>
        )}
      </div>
      {showForm && (
        <div className="modal-overlay open" onClick={resetForm}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}><h2>{editingCategory ? 'Edit Category' : 'Add Category'}</h2><button onClick={resetForm} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>×</button></div>
            <form onSubmit={handleSubmit}>
              <div className="form-group"><label className="form-label">Category Name *</label><input type="text" className="form-input" value={formData.category_name} onChange={e => setFormData({...formData, category_name: e.target.value})} required /></div>
              <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
              <div className="form-group"><label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} /> Active</label></div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}><button type="submit" className="btn btn-primary">{editingCategory ? 'Update' : 'Save'}</button><button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function UnitTab() {
  const [units, setUnits] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({ unit_name: '', unit_code: '', description: '', is_active: true });

  useEffect(() => { loadUnits(); }, []);

  const loadUnits = async () => {
    const { data } = await supabase.from('item_units').select('*').order('unit_name');
    setUnits(data || []);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingUnit) {
        const { error } = await supabase.from('item_units').update(formData).eq('id', editingUnit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('item_units').insert(formData);
        if (error) throw error;
      }
      resetForm();
      loadUnits();
    } catch (err) {
      alert('Error saving unit: ' + err.message);
    }
  };

  const resetForm = () => { setShowForm(false); setEditingUnit(null); setFormData({ unit_name: '', unit_code: '', description: '', is_active: true }); };

  const editUnit = (unit) => { setEditingUnit(unit); setFormData({ unit_name: unit.unit_name, unit_code: unit.unit_code, description: unit.description || '', is_active: unit.is_active !== false }); setShowForm(true); };
  const deleteUnit = async (id) => { if (confirm('Delete this unit?')) { await supabase.from('item_units').delete().eq('id', id); loadUnits(); }};

  const filteredUnits = units.filter(u => u.unit_name?.toLowerCase().includes(searchTerm.toLowerCase()) || u.unit_code?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Units</h1><button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add Unit</button></div>
      <div className="card" style={{ marginBottom: '16px' }}><input type="text" className="form-input" placeholder="Search units..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ maxWidth: '300px' }} /></div>
      <div className="card">
        {filteredUnits.length === 0 ? <div className="empty-state"><h3>No Units</h3></div> : (
          <table className="table">
            <thead><tr><th>Unit Name</th><th>Unit Code</th><th>Description</th><th>Active</th><th>Actions</th></tr></thead>
            <tbody>{filteredUnits.map(u => (<tr key={u.id} style={{ opacity: u.is_active === false ? 0.5 : 1 }}><td><strong>{u.unit_name}</strong></td><td>{u.unit_code}</td><td>{u.description || '-'}</td><td>{u.is_active ? '✓' : '✗'}</td><td><button className="btn btn-sm btn-secondary" onClick={() => editUnit(u)}>Edit</button><button className="btn btn-sm btn-secondary" style={{ marginLeft: '4px' }} onClick={() => deleteUnit(u.id)}>Delete</button></td></tr>))}</tbody>
          </table>
        )}
      </div>
      {showForm && (
        <div className="modal-overlay open" onClick={resetForm}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}><h2>{editingUnit ? 'Edit Unit' : 'Add Unit'}</h2><button onClick={resetForm} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>×</button></div>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Unit Name *</label><input type="text" className="form-input" value={formData.unit_name} onChange={e => setFormData({...formData, unit_name: e.target.value})} required /></div>
                <div className="form-group"><label className="form-label">Unit Code *</label><input type="text" className="form-input" value={formData.unit_code} onChange={e => setFormData({...formData, unit_code: e.target.value})} required /></div>
              </div>
              <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
              <div className="form-group"><label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} /> Active</label></div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}><button type="submit" className="btn btn-primary">{editingUnit ? 'Update' : 'Save'}</button><button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function WarehousesTab() {
  const [warehouses, setWarehouses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({ warehouse_code: '', warehouse_name: '', location: '', is_default: false, is_active: true });

  useEffect(() => { loadWarehouses(); }, []);

  const loadWarehouses = async () => {
    const { data } = await supabase.from('warehouses').select('*').order('warehouse_name');
    setWarehouses(data || []);
  };

  const generateWarehouseCode = () => 'WH-' + Date.now().toString(36).toUpperCase();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = {
      warehouse_code: formData.warehouse_code || generateWarehouseCode(),
      warehouse_name: formData.warehouse_name,
      location: formData.location || null,
      is_default: formData.is_default,
      is_active: formData.is_active,
    };
    
    if (formData.is_default) {
      await supabase.from('warehouses').update({ is_default: false }).eq('is_default', true);
    }
    
    if (editingWarehouse) {
      await supabase.from('warehouses').update({ ...data, updated_at: new Date().toISOString() }).eq('id', editingWarehouse.id);
    } else {
      await supabase.from('warehouses').insert(data);
    }
    resetForm();
    loadWarehouses();
  };

  const resetForm = () => { setShowForm(false); setEditingWarehouse(null); setFormData({ warehouse_code: '', warehouse_name: '', location: '', is_default: false, is_active: true }); };

  const editWarehouse = (w) => { setEditingWarehouse(w); setFormData({ warehouse_code: w.warehouse_code || '', warehouse_name: w.warehouse_name, location: w.location || '', is_default: w.is_default || false, is_active: w.is_active !== false }); setShowForm(true); };
  const deleteWarehouse = async (id) => { if (confirm('Delete this warehouse?')) { await supabase.from('warehouses').delete().eq('id', id); loadWarehouses(); }};

  const filteredWarehouses = warehouses.filter(w => w.warehouse_name?.toLowerCase().includes(searchTerm.toLowerCase()) || w.warehouse_code?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Warehouses</h1><button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add Warehouse</button></div>
      <div className="card" style={{ marginBottom: '16px' }}><input type="text" className="form-input" placeholder="Search warehouses..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ maxWidth: '300px' }} /></div>
      <div className="card">
        {filteredWarehouses.length === 0 ? <div className="empty-state"><h3>No Warehouses</h3></div> : (
          <table className="table">
            <thead><tr><th>Warehouse Code</th><th>Warehouse Name</th><th>Location</th><th>Default</th><th>Active</th><th>Actions</th></tr></thead>
            <tbody>{filteredWarehouses.map(w => (<tr key={w.id} style={{ opacity: w.is_active === false ? 0.5 : 1 }}><td>{w.warehouse_code}</td><td><strong>{w.warehouse_name || w.name}</strong></td><td>{w.location || '-'}</td><td>{w.is_default ? '✓' : '-'}</td><td>{w.is_active ? '✓' : '✗'}</td><td><button className="btn btn-sm btn-secondary" onClick={() => editWarehouse(w)}>Edit</button><button className="btn btn-sm btn-secondary" style={{ marginLeft: '4px' }} onClick={() => deleteWarehouse(w.id)}>Delete</button></td></tr>))}</tbody>
          </table>
        )}
      </div>
      {showForm && (
        <div className="modal-overlay open" onClick={resetForm}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}><h2>{editingWarehouse ? 'Edit Warehouse' : 'Add Warehouse'}</h2><button onClick={resetForm} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>×</button></div>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Warehouse Name *</label><input type="text" className="form-input" value={formData.warehouse_name} onChange={e => setFormData({...formData, warehouse_name: e.target.value})} required /></div>
                <div className="form-group"><label className="form-label">Warehouse Code</label><input type="text" className="form-input" value={formData.warehouse_code} onChange={e => setFormData({...formData, warehouse_code: e.target.value})} placeholder="Auto-generated if empty" /></div>
              </div>
              <div className="form-group"><label className="form-label">Location</label><input type="text" className="form-input" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} /></div>
              <div className="form-group"><label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={formData.is_default} onChange={e => setFormData({...formData, is_default: e.target.checked})} /> Set as Default Warehouse</label></div>
              <div className="form-group"><label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} /> Active</label></div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}><button type="submit" className="btn btn-primary">{editingWarehouse ? 'Update' : 'Save'}</button><button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function VariantsTab() {
  const [variants, setVariants] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingVariant, setEditingVariant] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({ variant_name: '', is_active: true });

  useEffect(() => { loadVariants(); }, []);

  const loadVariants = async () => {
    const { data } = await supabase.from('company_variants').select('*').order('variant_name');
    setVariants(data || []);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingVariant) {
      await supabase.from('company_variants').update({ ...formData, updated_at: new Date().toISOString() }).eq('id', editingVariant.id);
    } else {
      await supabase.from('company_variants').insert(formData);
    }
    resetForm();
    loadVariants();
  };

  const resetForm = () => { setShowForm(false); setEditingVariant(null); setFormData({ variant_name: '', is_active: true }); };

  const editVariant = (v) => { setEditingVariant(v); setFormData({ variant_name: v.variant_name, is_active: v.is_active !== false }); setShowForm(true); };
  const deleteVariant = async (id) => { if (confirm('Delete this variant? This may affect existing pricing.')) { await supabase.from('company_variants').delete().eq('id', id); loadVariants(); }};

  const filteredVariants = variants.filter(v => v.variant_name?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Inventory Variants</h1><button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add Variant</button></div>
      <div className="card" style={{ marginBottom: '16px' }}>
        <p style={{ color: '#666', marginBottom: '10px' }}>Variants represent different commercial contexts (e.g., Retail, Wholesale, Export). Each item can have different pricing per variant.</p>
        <input type="text" className="form-input" placeholder="Search variants..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ maxWidth: '300px' }} />
      </div>
      <div className="card">
        {filteredVariants.length === 0 ? <div className="empty-state"><h3>No Variants</h3></div> : (
          <table className="table">
            <thead><tr><th>Variant Name</th><th>Active</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>{filteredVariants.map(v => (<tr key={v.id} style={{ opacity: v.is_active === false ? 0.5 : 1 }}><td><strong>{v.variant_name}</strong></td><td>{v.is_active ? '✓' : '✗'}</td><td>{v.created_at ? new Date(v.created_at).toLocaleDateString() : '-'}</td><td><button className="btn btn-sm btn-secondary" onClick={() => editVariant(v)}>Edit</button><button className="btn btn-sm btn-secondary" style={{ marginLeft: '4px' }} onClick={() => deleteVariant(v.id)}>Delete</button></td></tr>))}</tbody>
          </table>
        )}
      </div>
      {showForm && (
        <div className="modal-overlay open" onClick={resetForm}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}><h2>{editingVariant ? 'Edit Variant' : 'Add Variant'}</h2><button onClick={resetForm} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>×</button></div>
            <form onSubmit={handleSubmit}>
              <div className="form-group"><label className="form-label">Variant Name *</label><input type="text" className="form-input" value={formData.variant_name} onChange={e => setFormData({...formData, variant_name: e.target.value})} placeholder="e.g., Retail, Wholesale, Export" required /></div>
              <div className="form-group"><label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} /> Active</label></div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}><button type="submit" className="btn btn-primary">{editingVariant ? 'Update' : 'Save'}</button><button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MaterialsList() {
  const getTabFromUrl = () => {
    const hashQuery = window.location.hash.split('?')[1] || '';
    const query = window.location.search.slice(1) || hashQuery;
    const tab = new URLSearchParams(query).get('tab');
    const allowedTabs = new Set(['items', 'service', 'category', 'unit', 'warehouses', 'variants']);
    return allowedTabs.has(tab) ? tab : 'items';
  };

  const [activeTab, setActiveTab] = useState(getTabFromUrl);

  useEffect(() => {
    const syncTabFromUrl = () => {
      setActiveTab(getTabFromUrl());
    };
    window.addEventListener('hashchange', syncTabFromUrl);
    window.addEventListener('popstate', syncTabFromUrl);
    return () => {
      window.removeEventListener('hashchange', syncTabFromUrl);
      window.removeEventListener('popstate', syncTabFromUrl);
    };
  }, []);

  const changeTab = (tab) => {
    setActiveTab(tab);
    const nextPath = `/store/materials?tab=${tab}`;
    window.history.pushState({}, '', nextPath);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <div>
      <div style={{ borderBottom: '1px solid #ddd', marginBottom: '20px', display: 'flex', gap: '0px' }}>
        <TabButton active={activeTab === 'items'} onClick={() => changeTab('items')}>Items</TabButton>
        <TabButton active={activeTab === 'service'} onClick={() => changeTab('service')}>Service</TabButton>
        <TabButton active={activeTab === 'category'} onClick={() => changeTab('category')}>Category</TabButton>
        <TabButton active={activeTab === 'unit'} onClick={() => changeTab('unit')}>Unit</TabButton>
        <TabButton active={activeTab === 'warehouses'} onClick={() => changeTab('warehouses')}>Warehouses</TabButton>
        <TabButton active={activeTab === 'variants'} onClick={() => changeTab('variants')}>Inventory Variants</TabButton>
      </div>

      {activeTab === 'items' && <ItemsTab />}
      {activeTab === 'service' && <ServiceTab />}
      {activeTab === 'category' && <CategoryTab />}
      {activeTab === 'unit' && <UnitTab />}
      {activeTab === 'warehouses' && <WarehousesTab />}
      {activeTab === 'variants' && <VariantsTab />}
    </div>
  );
}
