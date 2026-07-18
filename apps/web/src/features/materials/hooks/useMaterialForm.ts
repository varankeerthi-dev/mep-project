// @ts-nocheck
import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../supabase';
import { timedSupabaseQuery } from '../../../utils/queryTimeout';
import { buildItemChangeLog, appendLocalAuditEntry } from '../shared/audit';
import { generateItemCode } from '../shared/utils';

const defaultFormData = {
  item_code: '', item_name: '', display_name: '', main_category: '', sub_category: '',
  size: '', pressure_class: '', make: '', material: '', end_connection: '',
  unit: 'nos', has_alternative_unit: false, alternative_units: [] as { unit_name: string; conversion_factor: string }[],
  sale_price: '', purchase_price: '', hsn_code: '', gst_rate: 18, is_active: true,
  uses_variant: false, track_inventory: false, discount_category_id: null,
  dimension: '', dimension_unit: 'cm', weight: '', weight_unit: 'kg',
  item_classification: 'goods_sold', allow_purchase: true, allow_sales: true, show_in_bom: true, is_manufactured: false
};

export function useMaterialForm() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<any>(null);
  const [formData, setFormData] = useState(defaultFormData);
  const [variantPricing, setVariantPricing] = useState<any[]>([]);
  const [warehouseStock, setWarehouseStock] = useState<Record<string, any>>({});
  const [vendorMappings, setVendorMappings] = useState<any[]>([]);
  const [clientMappings, setClientMappings] = useState<any[]>([]);
  const [clientPricing, setClientPricing] = useState<any[]>([]);
  const [pricingHistory, setPricingHistory] = useState<any[]>([]);
  const [materialSavePending, setMaterialSavePending] = useState(false);
  const [saveNotice, setSaveNotice] = useState('');

  const resetForm = useCallback(() => {
    setShowForm(false);
    setEditingMaterial(null);
    setFormData(defaultFormData);
    setVariantPricing([]);
    setVendorMappings([]);
    setWarehouseStock({});
    setClientMappings([]);
    setClientPricing([]);
  }, []);

  const loadVendorMappings = useCallback(async (itemId: string) => {
    try {
      const { data, error } = await supabase.from('vendor_material_pricing').select('*').eq('material_id', itemId);
      if (error) throw error;
      setVendorMappings(data || []);
    } catch (err) {
      console.error('Error loading vendor mappings:', err);
      setVendorMappings([]);
    }
  }, []);

  const loadClientMappings = useCallback(async (itemId: string) => {
    if (!itemId) return;
    try {
      const { data } = await supabase.from('material_client_mappings').select('*').eq('material_id', itemId);
      setClientMappings(data || []);
    } catch (error) {
      console.log('client mappings load error', error);
      setClientMappings([]);
    }
  }, []);

  const loadClientPricing = useCallback(async (itemId: string) => {
    if (!itemId) return;
    try {
      const { data } = await supabase.from('material_client_pricing').select('*, clients(client_name)').eq('material_id', itemId).order('created_at', { ascending: true });
      setClientPricing(data || []);
    } catch (error) {
      console.log('client pricing load error', error);
      setClientPricing([]);
    }
  }, []);

  const loadPricingHistory = useCallback(async (itemId: string) => {
    if (!itemId) return;
    try {
      const { data } = await supabase.from('material_client_pricing_history').select('*').eq('material_id', itemId).order('changed_at', { ascending: false }).limit(50);
      setPricingHistory(data || []);
    } catch (error) {
      console.log('pricing history load error', error);
      setPricingHistory([]);
    }
  }, []);

  const editMaterial = useCallback(async (material: any, warehouses: any[], stock: any[]) => {
    setEditingMaterial(material);

    let hasStock = false;
    let wStock: Record<string, any> = {};
    if (warehouses) {
      const itemStockRecords = stock ? stock.filter((s: any) => s.item_id === material.id) : [];
      if (itemStockRecords.length > 0) hasStock = true;
      itemStockRecords.forEach((record: any) => {
        const vId = record.company_variant_id || 'no_variant';
        wStock[`${record.warehouse_id}_${vId}`] = { exclude: false, current_stock: parseFloat(record.current_stock) || 0 };
      });
    }
    setWarehouseStock(wStock);

    setFormData({
      item_code: material.item_code || '',
      item_name: material.name || '',
      display_name: material.display_name || '',
      main_category: material.main_category || '',
      sub_category: material.sub_category || '',
      size: material.size || '',
      pressure_class: material.pressure_class || '',
      make: material.make || '',
      material: material.material || '',
      end_connection: material.end_connection || '',
      unit: material.unit || 'nos',
      has_alternative_unit: material.material_units && material.material_units.length > 0,
      alternative_units: material.material_units ? material.material_units.map((u: any) => ({ unit_name: u.unit_name, conversion_factor: u.conversion_factor.toString() })) : [],
      sale_price: material.sale_price || '',
      purchase_price: material.purchase_price || '',
      hsn_code: material.hsn_code || '',
      gst_rate: material.gst_rate || 18,
      is_active: material.is_active !== false,
      uses_variant: material.uses_variant || false,
      discount_category_id: material.discount_category_id || null,
      track_inventory: hasStock,
      dimension: material.dimension || '',
      dimension_unit: material.dimension_unit || 'cm',
      weight: material.weight || '',
      weight_unit: material.weight_unit || 'kg',
      item_classification: material.item_classification || 'goods_sold',
      allow_purchase: material.allow_purchase !== false,
      allow_sales: material.allow_sales !== false,
      show_in_bom: material.show_in_bom !== false,
      is_manufactured: material.is_manufactured === true
    });
    setShowForm(true);

    // Load related data
    try {
      const data = await timedSupabaseQuery(supabase.from('item_variant_pricing').select('*').eq('item_id', material.id), 'Item variant pricing');
      setVariantPricing(data || []);
    } catch { setVariantPricing([]); }

    loadVendorMappings(material.id);
    loadClientMappings(material.id);
    loadClientPricing(material.id);
  }, [loadVendorMappings, loadClientMappings, loadClientPricing]);

  const handleSubmit = async (e: any, config: {
    organisationId: string;
    warehouses: any[];
    updateMaterialsCache: (updater: any) => void;
    refreshMaterials: () => Promise<void>;
    loadItemTransactions: (id: string) => Promise<void>;
    selectedMaterialId: string | null;
  }) => {
    const { organisationId, warehouses, updateMaterialsCache, refreshMaterials, loadItemTransactions, selectedMaterialId } = config;
    e?.preventDefault?.();
    if (materialSavePending) return;
    setMaterialSavePending(true);

    if (!editingMaterial) {
      const { data: existing } = await supabase.from('materials').select('id, name').eq('organisation_id', organisationId).ilike('name', formData.item_name.trim()).maybeSingle();
      if (existing) {
        alert(`"${formData.item_name}" already exists. Duplicate names are not allowed.`);
        setMaterialSavePending(false);
        return;
      }
    }

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
      sale_price: formData.sale_price ? parseFloat(formData.sale_price as string) : null,
      purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price as string) : null,
      hsn_code: formData.hsn_code || null,
      gst_rate: formData.gst_rate || null,
      is_active: formData.is_active,
      uses_variant: formData.uses_variant,
      discount_category_id: formData.discount_category_id || null,
      dimension: formData.dimension || null,
      dimension_unit: formData.dimension_unit || 'cm',
      weight: formData.weight ? parseFloat(formData.weight as string) : null,
      weight_unit: formData.weight_unit || 'kg',
      item_type: 'product',
      item_classification: formData.item_classification,
      allow_purchase: formData.allow_purchase,
      allow_sales: formData.allow_sales,
      show_in_bom: formData.show_in_bom,
      is_manufactured: formData.is_manufactured,
      organisation_id: organisationId
    };

    try {
      const isEditing = !!editingMaterial;
      const originalMaterial = editingMaterial;
      const nowIso = new Date().toISOString();
      let itemId: string;
      let createdMaterial: any = null;

      if (isEditing) {
        const { error } = await supabase.from('materials').update({ ...materialData, updated_at: nowIso }).eq('id', editingMaterial.id);
        if (error) throw error;
        itemId = editingMaterial.id;
      } else {
        const { data, error } = await supabase.from('materials').insert(materialData).select().single();
        if (error) throw error;
        itemId = data.id;
        createdMaterial = data;
      }

      // Save alternative units
      if (formData.has_alternative_unit && formData.alternative_units.length > 0) {
        await supabase.from('material_units').delete().eq('material_id', itemId);
        const unitsToInsert = formData.alternative_units.map(u => ({ material_id: itemId, unit_name: u.unit_name, conversion_factor: parseFloat(u.conversion_factor) })).filter(u => u.unit_name && !isNaN(u.conversion_factor));
        if (unitsToInsert.length > 0) {
          const { error: unitsError } = await supabase.from('material_units').insert(unitsToInsert);
          if (unitsError) throw unitsError;
        }
      } else {
        await supabase.from('material_units').delete().eq('material_id', itemId);
      }

      // Save variant pricing
      if (formData.uses_variant && variantPricing.length > 0) {
        await supabase.from('item_variant_pricing').delete().eq('item_id', itemId);
        const pricingToInsert = variantPricing.filter(p => p.sale_price || p.purchase_price).map(p => ({
          item_id: itemId, company_variant_id: p.company_variant_id || null, make: p.make || '',
          sale_price: p.sale_price ? parseFloat(p.sale_price) : 0, purchase_price: p.purchase_price ? parseFloat(p.purchase_price) : null, updated_at: nowIso
        }));
        if (pricingToInsert.length > 0) {
          const { error: pricingError } = await supabase.from('item_variant_pricing').insert(pricingToInsert);
          if (pricingError) throw pricingError;
        }
      }

      // Save warehouse stock
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
            if (ws.exclude) {
              if (dbVariantId) {
                await supabase.from('item_stock').delete().eq('item_id', itemId).eq('warehouse_id', wh.id).eq('company_variant_id', dbVariantId);
              } else {
                await supabase.from('item_stock').delete().eq('item_id', itemId).eq('warehouse_id', wh.id).is('company_variant_id', null);
              }
            } else {
              stockInsertions.push({ item_id: itemId, warehouse_id: wh.id, company_variant_id: dbVariantId, current_stock: ws.current_stock || 0, updated_at: nowIso });
            }
          }
        }
        if (stockInsertions.length > 0) {
          const { error: stockError } = await supabase.from('item_stock').upsert(stockInsertions, { onConflict: 'item_id, company_variant_id, warehouse_id' });
          if (stockError) console.error('Error saving warehouse stock:', stockError);
        }
      }

      // Save vendor mappings
      const vendorMappingsToInsert = vendorMappings.filter(m => m.vendor_id).map(m => ({
        ...(m.id.toString().startsWith('new_') ? {} : { id: m.id }),
        material_id: itemId, variant_id: m.variant_id || null, make: m.make || null,
        vendor_id: m.vendor_id, base_rate: parseFloat(m.base_rate) || 0,
        discount_percent: parseFloat(m.discount_percent) || 0, is_preferred: m.is_preferred || false,
        organisation_id: organisationId, updated_at: new Date().toISOString()
      }));
      if (editingMaterial) {
        await supabase.from('vendor_material_pricing').delete().eq('material_id', itemId);
      }
      if (vendorMappingsToInsert.length > 0) {
        const { error: vmError } = await supabase.from('vendor_material_pricing').insert(vendorMappingsToInsert);
        if (vmError) throw vmError;
      }

      // Save client mappings
      await supabase.from('material_client_mappings').delete().eq('material_id', itemId);
      const mappingsToInsert = clientMappings.filter(m => m.client_id).map(m => ({
        material_id: itemId, client_id: m.client_id, company_variant_id: m.company_variant_id || null,
        client_part_no: m.client_part_no, client_description: m.client_description,
        organisation_id: organisationId, updated_at: nowIso
      }));
      if (mappingsToInsert.length > 0) {
        const { error: mappingError } = await supabase.from('material_client_mappings').insert(mappingsToInsert);
        if (mappingError) throw mappingError;
      }

      // Save client pricing (ARC)
      await supabase.from('material_client_pricing').delete().eq('material_id', itemId);
      const pricingToInsertArc = clientPricing.filter(p => p.client_id).map(p => ({
        material_id: itemId, client_id: p.client_id, company_variant_id: p.company_variant_id || null,
        pricing_type: p.pricing_type || 'Fixed ARC', rate: p.rate ? parseFloat(p.rate) : null,
        valid_from: p.valid_from || null, valid_to: p.valid_to || null, status: p.status || 'active',
        organisation_id: organisationId, updated_at: nowIso
      }));
      if (pricingToInsertArc.length > 0) {
        const { error: pricingError } = await supabase.from('material_client_pricing').insert(pricingToInsertArc);
        if (pricingError) throw pricingError;
      }

      // Audit logging
      const changeLog = isEditing ? buildItemChangeLog(originalMaterial, materialData) : ['Item created'];
      const auditEntry = {
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        item_id: itemId, action: isEditing ? 'UPDATED' : 'CREATED',
        notes: isEditing ? `Item updated (${changeLog.length} changes)` : 'Item created',
        changes: changeLog, created_at: nowIso,
      };
      appendLocalAuditEntry(auditEntry);

      if (isEditing) {
        const { error: auditError } = await supabase.from('item_audit_logs').insert({
          item_id: itemId, action: 'UPDATED', notes: auditEntry.notes,
          changes: JSON.stringify(changeLog), created_at: nowIso,
        });
        if (auditError) console.log('item_audit_logs write warning:', auditError.message);
      }

      // Update cache
      const nextMaterial = isEditing ? { ...originalMaterial, ...materialData, id: itemId } : (createdMaterial || { id: itemId, ...materialData });
      updateMaterialsCache((prev: any[]) => {
        const next = [...prev.filter((m: any) => m.id !== itemId), nextMaterial];
        next.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
        return next;
      });

      setSaveNotice(isEditing ? 'Item updated successfully.' : 'Item added successfully.');
      await refreshMaterials();
      queryClient.invalidateQueries({ queryKey: ['materials-for-bom'] });
      if (selectedMaterialId === itemId) {
        await loadItemTransactions(itemId);
      }
      resetForm();
    } catch (err: any) {
      alert('Error saving: ' + (err?.message || String(err)));
    } finally {
      setMaterialSavePending(false);
    }
  };

  return {
    showForm, setShowForm,
    editingMaterial, setEditingMaterial,
    formData, setFormData,
    variantPricing, setVariantPricing,
    warehouseStock, setWarehouseStock,
    vendorMappings, setVendorMappings,
    clientMappings, setClientMappings,
    clientPricing, setClientPricing,
    pricingHistory, setPricingHistory,
    materialSavePending, saveNotice, setSaveNotice,
    resetForm, editMaterial, handleSubmit,
    loadVendorMappings, loadClientMappings, loadClientPricing, loadPricingHistory,
  };
}
