import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { useWarehouses } from '../hooks/useWarehouses';
import { useVariants } from '../hooks/useVariants';
import { useUnits } from '../hooks/useUnits';
import { X, Plus, Trash2 } from 'lucide-react';

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
      {/* Backdrop with blur effect */}
      <div 
        className="absolute inset-0 backdrop-blur-sm bg-black bg-opacity-30 transition-all duration-300 ease-in-out"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="absolute right-0 top-0 h-full w-full max-w-4xl bg-white shadow-xl transform transition-transform duration-300 ease-in-out">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Add New Item</h2>
              <p className="text-sm text-gray-500 mt-1">Fast, compact details for quotation, purchase, and inventory</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <div className="flex-1 overflow-y-auto p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Item Name *</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={formData.item_name}
                      onChange={e => setFormData({...formData, item_name: e.target.value, display_name: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Display Name (for Quotation)</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={formData.display_name}
                      onChange={e => setFormData({...formData, display_name: e.target.value})}
                      placeholder="Name shown in quotations"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Item Code</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={formData.item_code}
                      onChange={e => setFormData({...formData, item_code: e.target.value})}
                      placeholder="Auto-generated if empty"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Main Category</label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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

              {/* Commercial */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Commercial</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={formData.unit}
                      onChange={e => setFormData({...formData, unit: e.target.value})}
                    >
                      {units.length > 0 ? units.map(u => (
                        <option key={u.unit_code} value={u.unit_code}>{u.unit_name} ({u.unit_code})</option>
                      )) : <option value="nos">Nos</option>}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">HSN/SAC Code</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="Numeric only (max 10 digits)"
                      value={formData.hsn_code}
                      onChange={e => setFormData({...formData, hsn_code: e.target.value.replace(/\D/g, '').slice(0, 10)})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">GST Rate (%)</label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={formData.gst_rate}
                      onChange={e => setFormData({...formData, gst_rate: parseFloat(e.target.value)})}
                    >
                      {GST_RATES.map(rate => (
                        <option key={rate.value} value={rate.value}>{rate.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sale Price</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={formData.uses_variant ? '0' : formData.sale_price}
                      onChange={e => setFormData({...formData, sale_price: e.target.value})}
                      step="0.01"
                      disabled={formData.uses_variant}
                    />
                  </div>
                </div>
              </div>

              {/* Variant Settings */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Variant Settings</h3>
                <div className="space-y-4">
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={formData.uses_variant}
                      onChange={e => handleUsesVariantChange(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Use Variant Pricing</span>
                  </label>

                  {formData.uses_variant && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-gray-700">Variant Pricing</h4>
                        <button
                          type="button"
                          onClick={addVariantPricingRow}
                          className="flex items-center space-x-1 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Add Variant</span>
                        </button>
                      </div>
                      
                      {variantPricing.map((row) => (
                        <div key={row.id} className="flex items-center space-x-2 p-3 border border-gray-200 rounded">
                          <select
                            className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                            value={row.company_variant_id}
                            onChange={e => handleVariantPricingRowChange(row.id, 'company_variant_id', e.target.value)}
                          >
                            <option value="">Select Variant</option>
                            {variants.map(v => (
                              <option key={v.id} value={v.id}>{v.variant_name}</option>
                            ))}
                          </select>
                          <input
                            type="text"
                            className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                            placeholder="Make"
                            value={row.make}
                            onChange={e => handleVariantPricingRowChange(row.id, 'make', e.target.value)}
                          />
                          <input
                            type="number"
                            className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                            placeholder="Sale Price"
                            value={row.sale_price}
                            onChange={e => handleVariantPricingRowChange(row.id, 'sale_price', e.target.value)}
                            step="0.01"
                          />
                          <button
                            type="button"
                            onClick={() => removeVariantPricingRow(row.id)}
                            className="p-1 text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Inventory Tracking */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Inventory Tracking</h3>
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={formData.track_inventory}
                    onChange={e => setFormData({...formData, track_inventory: e.target.checked})}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Track Inventory (Warehouse Specific)</span>
                </label>
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={materialSavePending}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {materialSavePending ? 'Saving...' : 'Save Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
