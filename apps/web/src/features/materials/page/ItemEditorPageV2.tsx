import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useMaterialsPageData } from '@/hooks/useMaterialsPageData';
import { useUnits } from '@/hooks/useUnits';
import { useMaterialForm } from '../hooks/useMaterialForm';
import { useAttributeDefinitions } from '../hooks/useAttributeDefinitions';
import { ItemEditorDialogV2 } from '../components/editor/ItemEditorDialogV2';
import { CLASSIFICATION_PRESETS, getAccountingTreatmentPreset } from '../model/aggregates';
import { MAIN_CATEGORIES } from '../shared/constants';
import { toast } from 'sonner';
import { generateItemCode } from '../lib/generateItemCode';

export function ItemEditorPageV2() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { organisation } = useAuth();
  const orgId = organisation?.id ?? null;
  const manufacturingEnabled = true;

  const backToItems = useCallback(() => {
    navigate('/store/materials?tab=items');
  }, [navigate]);

  const switchToClassic = useCallback(() => {
    navigate('/store/materials/items/new');
  }, [navigate]);

  // ─── Data ────────────────────────────────────────────────────
  const { data: pageData, isLoading, refetch } = useMaterialsPageData(orgId);
  const categories = pageData?.categories ?? [];
  const variants = pageData?.variants ?? [];
  const warehouses = pageData?.warehouses ?? [];
  const clients = pageData?.clients ?? [];
  const discountCategories = pageData?.discountCategories ?? [];
  const assetCategories = pageData?.assetCategories ?? [];
  const accounts = pageData?.accounts ?? [];
  const categoryOptions = categories.length > 0 ? categories.map((c: any) => c.category_name) : MAIN_CATEGORIES;
  const { data: units = [] } = useUnits();

  const { data: vendors = [] } = useQuery({
    queryKey: ['purchase-vendors', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase.from('purchase_vendors').select('id, company_name, organisation_id').eq('organisation_id', orgId).eq('status', 'Active');
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
  });

  const { data: attributeDefinitions = [] } = useAttributeDefinitions(orgId);

  // ─── Form ─────────────────────────────────────────────────────
  const form = useMaterialForm();
  const [showTechnical, setShowTechnical] = useState(true);

  const refreshMaterials = useCallback(async () => { await refetch(); }, [refetch]);

  useEffect(() => {
    const scrollContainer = document.querySelector('.main-content');
    if (scrollContainer) scrollContainer.scrollTop = 0;
    window.scrollTo(0, 0);
  }, []);

  const updateMaterialsCache = useCallback((updater: any) => {
    queryClient.setQueryData(['materials-page-data', orgId], (old: any) => {
      if (!old) return old;
      const base = Array.isArray(old.materials) ? old.materials : [];
      const next = typeof updater === 'function' ? updater(base) : updater;
      return { ...old, materials: next };
    });
  }, [queryClient, orgId]);

  // ─── Editor Row Handlers ─────────────────────────────────────
  const handleClassificationChange = useCallback((type: string) => {
    const preset = getAccountingTreatmentPreset(type);
    if (preset) {
      form.setFormData((prev: any) => ({
        ...prev,
        accounting_treatment: type,
        gl_classification: preset.gl_classification,
        item_classification: preset.item_classification,
        is_stockable: preset.is_stockable,
        is_depreciable: preset.is_depreciable,
        allow_purchase: preset.allow_purchase,
        allow_sales: preset.allow_sales,
        show_in_bom: preset.show_in_bom,
        is_manufactured: preset.is_manufactured,
      }));
    } else {
      form.setFormData((prev: any) => ({
        ...prev,
        item_classification: type,
        ...(CLASSIFICATION_PRESETS[type] || {}),
      }));
    }
  }, [form]);

  const handleUsesVariantChange = useCallback((checked: boolean) => {
    form.setFormData((prev: any) => ({ ...prev, uses_variant: checked }));
  }, [form]);

  const handleAddVariantRow = useCallback(() => {
    form.setVariantPricing((prev: any[]) => [...prev, { id: Date.now(), company_variant_id: '', make: '', sale_price: '', purchase_price: '' }]);
  }, [form]);

  const handleRemoveVariantRow = useCallback((id: number | string) => {
    form.setVariantPricing((prev: any[]) => prev.filter((p: any) => p.id !== id));
  }, [form]);

  const handleVariantRowChange = useCallback((id: number | string, field: string, value: string) => {
    form.setVariantPricing((prev: any[]) => prev.map((p: any) => p.id === id ? { ...p, [field]: value } : p));
  }, [form]);

  const handleToggleInventory = useCallback((checked: boolean) => {
    form.setFormData((prev: any) => ({ ...prev, track_inventory: checked }));
  }, [form]);

  const handleStockChange = useCallback((key: string, field: 'exclude' | 'current_stock', value: boolean | number) => {
    form.setWarehouseStock((prev: any) => ({
      ...prev,
      [key]: { ...(prev[key] || { exclude: false, current_stock: 0 }), [field]: value }
    }));
  }, [form]);

  const handleAddVendorRow = useCallback(() => {
    form.setVendorMappings((prev: any[]) => [...prev, { id: 'new_' + Date.now(), vendor_id: '', vendor_item_code: '', vendor_rate: '', lead_time_days: '', is_preferred: false }]);
  }, [form]);

  const handleRemoveVendorRow = useCallback((id: string) => {
    form.setVendorMappings((prev: any[]) => prev.filter((v: any) => v.id !== id));
  }, [form]);

  const handleVendorRowChange = useCallback((id: string, field: string, value: any) => {
    form.setVendorMappings((prev: any[]) => prev.map((v: any) => v.id === id ? { ...v, [field]: value } : v));
  }, [form]);

  const handleAddClientRow = useCallback(() => {
    form.setClientMappings((prev: any[]) => [...prev, { id: 'new_' + Date.now(), client_id: '', client_part_no: '', client_description: '' }]);
  }, [form]);

  const handleRemoveClientRow = useCallback((id: string) => {
    form.setClientMappings((prev: any[]) => prev.filter((m: any) => m.id !== id));
  }, [form]);

  const handleClientRowChange = useCallback((id: string, field: string, value: any) => {
    form.setClientMappings((prev: any[]) => prev.map((m: any) => m.id === id ? { ...m, [field]: value } : m));
  }, [form]);

  const handleAddClientPricingRow = useCallback(() => {
    form.setClientPricing((prev: any[]) => [...prev, {
      id: 'new_' + Date.now(), client_id: '', company_variant_id: null,
      pricing_type: 'Fixed ARC', rate: '', valid_from: '', valid_to: '', status: 'active'
    }]);
  }, [form]);

  const handleRemoveClientPricingRow = useCallback((id: string) => {
    form.setClientPricing((prev: any[]) => prev.filter((p: any) => p.id !== id));
  }, [form]);

  const handleClientPricingRowChange = useCallback((id: string, field: string, value: any) => {
    form.setClientPricing((prev: any[]) => prev.map((p: any) => p.id === id ? { ...p, [field]: value } : p));
  }, [form]);

  const handleShowPricingHistory = useCallback(() => {
    if (form.editingMaterial) {
      form.loadPricingHistory(form.editingMaterial.id);
    }
  }, [form]);

  const handleToggleTechnical = useCallback(() => {
    setShowTechnical((prev) => !prev);
  }, []);

  // Standard submit (saves and returns to items list)
  const handleFormSubmit = useCallback((e: any) => {
    form.handleSubmit(e, {
      organisationId: orgId,
      warehouses,
      updateMaterialsCache,
      refreshMaterials,
      loadItemTransactions: async () => {},
      selectedMaterialId: null,
      onSaved: backToItems,
    });
  }, [form, orgId, warehouses, updateMaterialsCache, refreshMaterials, backToItems]);

  // Save & Add Another (saves current item, keeps category & unit, readies form for next)
  const handleSaveAndCreateAnother = useCallback((e: any) => {
    const savedCategory = form.formData.main_category;
    const savedSubCategory = form.formData.sub_category;
    const savedUnit = form.formData.unit;
    const savedGst = form.formData.gst_rate;
    const savedType = form.formData.item_type;

    form.handleSubmit(e, {
      organisationId: orgId,
      warehouses,
      updateMaterialsCache,
      refreshMaterials,
      loadItemTransactions: async () => {},
      selectedMaterialId: null,
      onSaved: () => {
        // Reset form while preserving context
        form.setFormData((prev: any) => ({
          ...prev,
          item_name: '',
          display_name: '',
          item_code: generateItemCode(savedType === 'service' ? 'SVC' : 'ITEM'),
          main_category: savedCategory,
          sub_category: savedSubCategory,
          unit: savedUnit,
          gst_rate: savedGst,
          item_type: savedType,
          sale_price: '',
          purchase_price: '',
          hsn_code: '',
          size: '',
          make: '',
          material: '',
          pressure_class: '',
          end_connection: '',
        }));
        form.setVariantPricing([]);
        form.setVendorMappings([]);
        form.setClientMappings([]);
        form.setClientPricing([]);
        toast.success('Item saved successfully! Form is ready for the next entry.');
      },
    });
  }, [form, orgId, warehouses, updateMaterialsCache, refreshMaterials]);

  useEffect(() => {
    if (!form.saveNotice) return;
    const t = setTimeout(() => form.setSaveNotice(''), 4000);
    return () => clearTimeout(t);
  }, [form.saveNotice]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-sm font-medium text-slate-500">Loading Item Editor V2...</div>
      </div>
    );
  }

  return (
    <ItemEditorDialogV2
      asPage
      open
      onClose={backToItems}
      formData={form.formData}
      onChange={(field, value) => form.setFormData((prev: any) => ({ ...prev, [field]: value }))}
      variantPricing={form.variantPricing}
      warehouseStock={form.warehouseStock}
      vendorMappings={form.vendorMappings}
      clientMappings={form.clientMappings}
      clientPricing={form.clientPricing}
      pricingHistory={form.pricingHistory}
      variants={variants}
      warehouses={warehouses}
      vendors={vendors}
      clients={clients}
      categoryOptions={categoryOptions}
      discountCategories={discountCategories}
      manufacturingEnabled={manufacturingEnabled}
      editingMaterial={form.editingMaterial}
      materialSavePending={form.materialSavePending}
      saveNotice={form.saveNotice}
      showTechnical={showTechnical}
      customAttributes={form.customAttributes}
      attributeDefinitions={attributeDefinitions}
      onCustomAttributesChange={form.setCustomAttributes}
      onToggleTechnical={handleToggleTechnical}
      onUsesVariantChange={handleUsesVariantChange}
      onAddVariantRow={handleAddVariantRow}
      onRemoveVariantRow={handleRemoveVariantRow}
      onVariantRowChange={handleVariantRowChange}
      onToggleInventory={handleToggleInventory}
      onStockChange={handleStockChange}
      onAddVendorRow={handleAddVendorRow}
      onRemoveVendorRow={handleRemoveVendorRow}
      onVendorRowChange={handleVendorRowChange}
      onAddClientRow={handleAddClientRow}
      onRemoveClientRow={handleRemoveClientRow}
      onClientRowChange={handleClientRowChange}
      onAddClientPricingRow={handleAddClientPricingRow}
      onRemoveClientPricingRow={handleRemoveClientPricingRow}
      onClientPricingRowChange={handleClientPricingRowChange}
      onShowPricingHistory={handleShowPricingHistory}
      onClassificationChange={handleClassificationChange}
      onSubmit={handleFormSubmit}
      onSaveAndCreateAnother={handleSaveAndCreateAnother}
      onCategoryCreated={refreshMaterials}
      unitOptions={units}
      onUnitCreated={refreshMaterials}
      assetCategories={assetCategories}
      accounts={accounts}
      onSwitchToClassic={switchToClassic}
    />
  );
}

export default ItemEditorPageV2;
