import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { useWarehouses } from '../hooks/useWarehouses';
import { useVariants } from '../hooks/useVariants';
import { useUnits } from '../hooks/useUnits';
import { X, Plus, Trash2, Warehouse } from 'lucide-react';

const MAIN_CATEGORIES = ['VALVE', 'PIPE', 'FITTING', 'FLANGE', 'ELECTRICAL', 'PLUMBING', 'HVAC', 'FIRE PROTECTION', 'BUILDING MATERIALS', 'TOOLS', 'SAFETY', 'OFFICE', 'OTHER'];

const GST_RATES = [
  { value: 0, label: '0%' },
  { value: 0.5, label: '0.5%' },
  { value: 5, label: '5%' },
  { value: 12, label: '12%' },
  { value: 18, label: '18%' },
  { value: 28, label: '28%' },
];

interface ItemCreateDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newItem: any) => void;
}

export default function ItemCreateDrawer({ isOpen, onClose, onSuccess }: ItemCreateDrawerProps) {
  const queryClient = useQueryClient();
  const { organisation } = useAuth();
  const { data: warehouses = [] } = useWarehouses();
  const { data: variants = [] } = useVariants();
  const { data: units = [] } = useUnits();

  const [materialSavePending, setMaterialSavePending] = useState(false);
  const [formData, setFormData] = useState({
    item_code: '', item_name: '', display_name: '', main_category: '', sub_category: '',
    size: '', pressure_class: '', make: '', material: '', end_connection: '',
    unit: 'nos', sale_price: '', purchase_price: '', hsn_code: '', gst_rate: 18, is_active: true,
    uses_variant: false, track_inventory: false
  });
  const [variantPricing, setVariantPricing] = useState([]);
  const [warehouseStock, setWarehouseStock] = useState({});

  const generateItemCode = () => {
    return 'ITEM-' + Date.now().toString(36).toUpperCase();
  };

  const resetForm = useCallback(() => {
    setFormData({
      item_code: '', item_name: '', display_name: '', main_category: '', sub_category: '',
      size: '', pressure_class: '', make: '', material: '', end_connection: '',
      unit: 'nos', sale_price: '', purchase_price: '', hsn_code: '', gst_rate: 18, is_active: true,
      uses_variant: false, track_inventory: false
    });
    setVariantPricing([]);
    
    // Initialize default warehouse stock
    const defaultWStock = {};
    if (warehouses) {
      warehouses.forEach(wh => {
        defaultWStock[`${wh.id}_no_variant`] = { exclude: false, current_stock: 0 };
      });
    }
    setWarehouseStock(defaultWStock);
  }, [warehouses]);

  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen, resetForm]);

  const addVariantPricingRow = () => {
    setVariantPricing(prev => [
      ...prev,
      { id: Date.now() + Math.random(), company_variant_id: '', make: '', sale_price: '', purchase_price: '' }
    ]);
  };

  const removeVariantPricingRow = (id) => {
    setVariantPricing(prev => prev.filter(p => p.id !== id));
  };

  const handleVariantPricingRowChange = (id, field, value) => {
    setVariantPricing(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const handleUsesVariantChange = (checked) => {
    setFormData({ ...formData, uses_variant: checked, sale_price: checked ? '0' : formData.sale_price });
    if (checked && variantPricing.length === 0) {
      addVariantPricingRow();
    }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();

    if (materialSavePending) return;
    setMaterialSavePending(true);
    
    if (formData.uses_variant && variantPricing.length === 0) {
      alert('Please add at least one variant pricing before saving.');
      setMaterialSavePending(false);
      return;
    }

    if (formData.hsn_code && !/^\d{1,10}$/.test(formData.hsn_code)) {
      alert('HSN/SAC must be numeric and up to 10 digits.');
      setMaterialSavePending(false);
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
      make: formData.make || null,
      material: formData.material || null,
      end_connection: formData.end_connection || null,
      unit: formData.unit,
      sale_price: formData.sale_price ? parseFloat(formData.sale_price) : null,
      purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : null,
      hsn_code: formData.hsn_code || null,
      gst_rate: formData.gst_rate || null,
      is_active: formData.is_active,
      uses_variant: formData.uses_variant,
      item_type: 'product',
      organisation_id: organisation?.id
    };

    try {
      const nowIso = new Date().toISOString();
      let itemId;
      let createdMaterial = null;

      // Create new material
      const { data, error } = await supabase.from('materials').insert(materialData).select().single();
      if (error) throw error;
      itemId = data.id;
      createdMaterial = data;

      // Handle variant pricing
      if (formData.uses_variant) {
        const pricingToInsert = variantPricing
          .filter(p => p.sale_price || p.purchase_price)
          .map(p => ({
            item_id: itemId,
            company_variant_id: p.company_variant_id || null,
            make: p.make || '',
            sale_price: p.sale_price ? parseFloat(p.sale_price) : 0,
            purchase_price: p.purchase_price ? parseFloat(p.purchase_price) : null,
            updated_at: nowIso
          }));
          
        if (pricingToInsert.length > 0) {
          const { error: pricingError } = await supabase.from('item_variant_pricing').insert(pricingToInsert);
          if (pricingError) throw pricingError;
        }
      }
      
      // Handle warehouse stock
      if (formData.track_inventory && warehouses) {
        const activeVariantIds = formData.uses_variant 
          ? Array.from(new Set(variantPricing.map(p => p.company_variant_id || 'no_variant')))
          : ['no_variant'];

        const stockInsertions = [];
        for (const vId of activeVariantIds) {
          const dbVariantId = vId === 'no_variant' ? null : vId;
          for (const wh of warehouses) {
             const key = `${wh.id}_${vId}`;
             const ws = warehouseStock[key] || { exclude: false, current_stock: 0 };
             if (!ws.exclude) {
                 stockInsertions.push({
                     item_id: itemId,
                     warehouse_id: wh.id,
                     company_variant_id: dbVariantId,
                     current_stock: ws.current_stock || 0,
                     updated_at: nowIso
                 });
             }
          }
        }
        if (stockInsertions.length > 0) {
            const { error: stockError } = await supabase.from('item_stock').upsert(stockInsertions, { onConflict: 'item_id, company_variant_id, warehouse_id' });
            if (stockError) console.error('Error saving warehouse stock:', stockError);
        }
      }

      // Invalidate queries to refresh data across the app
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      queryClient.invalidateQueries({ queryKey: ['itemStock'] });
      queryClient.invalidateQueries({ queryKey: ['itemVariantPricing'] });

      // Call success callback
      onSuccess(createdMaterial);
      
      // Close drawer
      onClose();
      
    } catch (err) {
      alert('Error saving: ' + (err?.message || String(err)));
    } finally {
      setMaterialSavePending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl flex flex-col transform transition-transform duration-300" style={{ marginLeft: '8px' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '24px 30px',
          borderBottom: '1px solid #e5e5e5',
          background: '#fff',
        }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#171717', margin: 0 }}>Add New Material</h3>
            <p style={{ fontSize: '12px', color: '#737373', margin: '4px 0 0 0' }}>Quickly create items for quotations and inventory.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px',
              border: 'none',
              background: 'transparent',
              color: '#525252',
              cursor: 'pointer',
              borderRadius: '4px',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <X size={22} />
          </button>
        </div>

        {/* Form Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '30px' }}>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              
              {/* Basic Information */}
              <section>
                <h4 style={{ fontSize: '12px', fontWeight: 800, color: '#171717', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Basic Information</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#525252' }}>Item Name *</label>
                    <input
                      type="text"
                      style={{ padding: '10px 14px', border: '1px solid #d4d4d4', borderRadius: '4px', fontSize: '14px', color: '#171717', outline: 'none' }}
                      value={formData.item_name}
                      onChange={e => setFormData({...formData, item_name: e.target.value, display_name: e.target.value})}
                      required
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#525252' }}>Display Name</label>
                    <input
                      type="text"
                      style={{ padding: '10px 14px', border: '1px solid #d4d4d4', borderRadius: '4px', fontSize: '14px', color: '#171717', outline: 'none' }}
                      value={formData.display_name}
                      onChange={e => setFormData({...formData, display_name: e.target.value})}
                      placeholder="Shown in quotations"
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: '#525252' }}>Item Code</label>
                      <input
                        type="text"
                        style={{ padding: '10px 14px', border: '1px solid #d4d4d4', borderRadius: '4px', fontSize: '14px', color: '#171717', outline: 'none' }}
                        value={formData.item_code}
                        onChange={e => setFormData({...formData, item_code: e.target.value})}
                        placeholder="Auto-generated if empty"
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: '#525252' }}>Main Category</label>
                      <select
                        style={{ padding: '10px 14px', border: '1px solid #d4d4d4', borderRadius: '4px', fontSize: '14px', color: '#171717', outline: 'none', background: '#fff' }}
                        value={formData.main_category}
                        onChange={e => setFormData({...formData, main_category: e.target.value})}
                      >
                        <option value="">Select Category</option>
                        {MAIN_CATEGORIES.map((categoryName) => (
                          <option key={categoryName} value={categoryName}>{categoryName}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </section>

              {/* Commercial */}
              <section>
                <h4 style={{ fontSize: '12px', fontWeight: 800, color: '#171717', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Commercial & Pricing</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#525252' }}>Unit</label>
                    <select
                      style={{ padding: '10px 14px', border: '1px solid #d4d4d4', borderRadius: '4px', fontSize: '14px', color: '#171717', outline: 'none', background: '#fff' }}
                      value={formData.unit}
                      onChange={e => setFormData({...formData, unit: e.target.value})}
                    >
                      {units.length > 0 ? units.map(u => (
                        <option key={u.unit_code} value={u.unit_code}>{u.unit_code}</option>
                      )) : <option value="nos">Nos</option>}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#525252' }}>HSN Code</label>
                    <input
                      type="text"
                      style={{ padding: '10px 14px', border: '1px solid #d4d4d4', borderRadius: '4px', fontSize: '14px', color: '#171717', outline: 'none' }}
                      value={formData.hsn_code}
                      onChange={e => setFormData({...formData, hsn_code: e.target.value.replace(/\D/g, '').slice(0, 10)})}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#525252' }}>GST %</label>
                    <select
                      style={{ padding: '10px 14px', border: '1px solid #d4d4d4', borderRadius: '4px', fontSize: '14px', color: '#171717', outline: 'none', background: '#fff' }}
                      value={formData.gst_rate}
                      onChange={e => setFormData({...formData, gst_rate: parseFloat(e.target.value)})}
                    >
                      {GST_RATES.map(rate => (
                        <option key={rate.value} value={rate.value}>{rate.label}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#525252' }}>Base Sale Price</label>
                    <input
                      type="number"
                      style={{ padding: '10px 14px', border: '1px solid #d4d4d4', borderRadius: '4px', fontSize: '14px', color: '#171717', outline: 'none' }}
                      value={formData.uses_variant ? '0' : formData.sale_price}
                      onChange={e => setFormData({...formData, sale_price: e.target.value})}
                      step="0.01"
                      disabled={formData.uses_variant}
                    />
                  </div>
                </div>
              </section>

              {/* Variants */}
              <section>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h4 style={{ fontSize: '12px', fontWeight: 800, color: '#171717', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Variant Configuration</h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      id="uses_variant"
                      checked={formData.uses_variant}
                      onChange={e => handleUsesVariantChange(e.target.checked)}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <label htmlFor="uses_variant" style={{ fontSize: '13px', color: '#525252', cursor: 'pointer' }}>Multi-Variant Pricing</label>
                  </div>
                </div>

                {formData.uses_variant && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {variantPricing.map((row) => (
                      <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.8fr 40px', gap: '10px', alignItems: 'center', padding: '12px', border: '1px solid #e5e5e5', borderRadius: '4px', background: '#fafafa' }}>
                        <select
                          style={{ padding: '8px 10px', border: '1px solid #d4d4d4', borderRadius: '4px', fontSize: '13px', color: '#171717', outline: 'none', background: '#fff' }}
                          value={row.company_variant_id}
                          onChange={e => handleVariantPricingRowChange(row.id, 'company_variant_id', e.target.value)}
                        >
                          <option value="">Variant</option>
                          {variants.map(v => (
                            <option key={v.id} value={v.id}>{v.variant_name}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          style={{ padding: '8px 10px', border: '1px solid #d4d4d4', borderRadius: '4px', fontSize: '13px', color: '#171717', outline: 'none' }}
                          placeholder="Make"
                          value={row.make}
                          onChange={e => handleVariantPricingRowChange(row.id, 'make', e.target.value)}
                        />
                        <input
                          type="number"
                          style={{ padding: '8px 10px', border: '1px solid #d4d4d4', borderRadius: '4px', fontSize: '13px', color: '#171717', outline: 'none' }}
                          placeholder="Rate"
                          value={row.sale_price}
                          onChange={e => handleVariantPricingRowChange(row.id, 'sale_price', e.target.value)}
                          step="0.01"
                        />
                        <button
                          type="button"
                          onClick={() => removeVariantPricingRow(row.id)}
                          style={{ border: 'none', background: 'transparent', color: '#dc2626', cursor: 'pointer', padding: '4px', display: 'flex', justifyContent: 'center' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addVariantPricingRow}
                      style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: '#fff', border: '1px solid #d4d4d4', borderRadius: '4px', fontSize: '12px', fontWeight: 600, color: '#171717', cursor: 'pointer', transition: 'all 0.15s' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                      onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                    >
                      <Plus size={14} /> Add Variant Option
                    </button>
                  </div>
                )}
              </section>

              {/* Inventory */}
              <section style={{ padding: '20px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="checkbox"
                    id="track_inventory"
                    checked={formData.track_inventory}
                    onChange={e => setFormData({...formData, track_inventory: e.target.checked})}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <div>
                    <label htmlFor="track_inventory" style={{ fontSize: '14px', fontWeight: 700, color: '#171717', cursor: 'pointer', display: 'block' }}>Track Inventory</label>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Enable warehouse-specific stock management for this item.</span>
                  </div>
                </div>

                {formData.track_inventory && (
                  <div style={{ marginTop: '20px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
                    {(() => {
                      const activeVariantIds = formData.uses_variant 
                        ? Array.from(new Set(variantPricing.map(p => p.company_variant_id).filter(Boolean)))
                        : ['no_variant'];
                      
                      return activeVariantIds.map(vId => {
                        const vName = vId === 'no_variant' ? (formData.uses_variant ? 'No Variant' : 'Standard Inventory') : variants.find(v => v.id === vId)?.variant_name || 'Unknown Variant';
                        return (
                          <div key={vId} style={{ marginBottom: '20px' }}>
                            {formData.uses_variant && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                <Warehouse size={14} className="text-sky-600" />
                                <h5 style={{ fontSize: '11px', fontWeight: 800, color: '#171717', textTransform: 'uppercase', margin: 0, letterSpacing: '0.02em' }}>{vName} Stock</h5>
                              </div>
                            )}
                            <div style={{ border: '1px solid #e5e5e5', borderRadius: '4px', overflow: 'hidden' }}>
                              <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse', background: '#fff' }}>
                                <thead style={{ background: '#fafafa' }}>
                                  <tr>
                                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#525252', borderBottom: '1px solid #e5e5e5' }}>Warehouse</th>
                                    <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: '#525252', borderBottom: '1px solid #e5e5e5' }}>Exclude</th>
                                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#525252', borderBottom: '1px solid #e5e5e5' }}>Opening Stock</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {warehouses.map(wh => {
                                    const key = `${wh.id}_${vId}`;
                                    const ws = warehouseStock[key] || { exclude: false, current_stock: 0 };
                                    return (
                                      <tr key={wh.id} style={{ opacity: ws.exclude ? 0.5 : 1, transition: 'opacity 0.2s' }}>
                                        <td style={{ padding: '10px 12px', borderBottom: '1px solid #f5f5f5', color: '#171717', fontWeight: 500 }}>{wh.warehouse_name || wh.name || wh.warehouse_code}</td>
                                        <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid #f5f5f5' }}>
                                          <input 
                                            type="checkbox" 
                                            checked={ws.exclude} 
                                            onChange={e => setWarehouseStock({...warehouseStock, [key]: { ...ws, exclude: e.target.checked }})}
                                            style={{ width: '14px', height: '14px', cursor: 'pointer' }}
                                          />
                                        </td>
                                        <td style={{ padding: '10px 12px', textAlign: 'right', borderBottom: '1px solid #f5f5f5' }}>
                                          <input 
                                            type="number" 
                                            style={{ 
                                              width: '100px', 
                                              padding: '6px 10px', 
                                              border: '1px solid #d4d4d4', 
                                              borderRadius: '4px', 
                                              textAlign: 'right',
                                              fontSize: '12px',
                                              background: ws.exclude ? '#f5f5f5' : '#fff',
                                              color: '#171717',
                                              outline: 'none'
                                            }}
                                            value={ws.current_stock}
                                            onChange={e => setWarehouseStock({...warehouseStock, [key]: { ...ws, current_stock: parseFloat(e.target.value) || 0 }})}
                                            disabled={ws.exclude}
                                            step="0.01"
                                          />
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </section>
            </div>
          </form>
        </div>

        {/* Footer Actions */}
        <div style={{
          display: 'flex',
          gap: '12px',
          padding: '24px 30px',
          borderTop: '1px solid #e5e5e5',
          background: '#fff',
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              padding: '12px 16px',
              border: '1px solid #d4d4d4',
              borderRadius: '4px',
              background: '#fff',
              color: '#525252',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={materialSavePending}
            style={{
              flex: 1,
              padding: '12px 16px',
              border: 'none',
              borderRadius: '4px',
              background: '#171717',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 600,
              cursor: materialSavePending ? 'not-allowed' : 'pointer',
              opacity: materialSavePending ? 0.6 : 1,
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => !materialSavePending && (e.currentTarget.style.background = '#262626')}
            onMouseLeave={(e) => e.currentTarget.style.background = '#171717'}
          >
            {materialSavePending ? 'Saving...' : 'Save Item'}
          </button>
        </div>
      </div>
    </div>
  );
}
