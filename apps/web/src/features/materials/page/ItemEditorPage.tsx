import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '../../../supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { useMaterialsPageData } from '../../../hooks/useMaterialsPageData';
import { useUnits } from '../../../hooks/useUnits';
import { useMaterialForm } from '../hooks/useMaterialForm';
import { ItemEditorDialog } from '../components/editor/ItemEditorDialog';
import { checkVariantRecords } from '../persistence/materialsPersistence';
import { CLASSIFICATION_PRESETS } from '../model/aggregates';
import { MAIN_CATEGORIES } from '../shared/constants';

/**
 * Add Item — full-page variant of the item editor.
 * Reaches here via /store/materials/items/new (Add Item button / quick access).
 */
export function ItemEditorPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { organisation } = useAuth();
  const orgId = organisation?.id ?? null;
  const manufacturingEnabled = true;

  const backToItems = useCallback(() => {
    navigate('/store/materials?tab=items');
  }, [navigate]);

  // ─── Data ────────────────────────────────────────────────────
  const { data: pageData, isLoading, refetch } = useMaterialsPageData(orgId);
  const stock = pageData?.stock ?? [];
  const categories = pageData?.categories ?? [];
  const variants = pageData?.variants ?? [];
  const warehouses = pageData?.warehouses ?? [];
  const clients = pageData?.clients ?? [];
  const discountCategories = pageData?.discountCategories ?? [];
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

  const { data: attributeDefinitions = [] } = useQuery({
    queryKey: ['attribute-definitions', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase.from('attribute_definitions').select('*').eq('organisation_id', orgId).order('label');
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
  });

  // ─── Form ─────────────────────────────────────────────────────
  const form = useMaterialForm();
  const [showTechnical, setShowTechnical] = useState(true);

  const refreshMaterials = useCallback(async () => { await refetch(); }, [refetch]);

  // The app's scroll container (.main-content) persists across route changes,
  // so landing on this page can inherit a stale scroll position (e.g. scrolled
  // to the bottom). Reset it to the top so the form starts at the header.
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
    form.setFormData((prev: any) => ({
      ...prev,
      item_classification: type,
      ...(CLASSIFICATION_PRESETS[type] || {}),
    }));
  }, [form]);

  const handleUsesVariantChange = useCallback(async (checked: boolean) => {
    if (form.editingMaterial && !checked) {
      const records = await checkVariantRecords(form.editingMaterial.id);
      if (records.hasPricing || records.hasStock) {
        let message = 'Cannot disable variant for this item because:';
        if (records.hasPricing) message += '\n- Variant pricing records exist';
        if (records.hasStock) message += '\n- Variant stock records exist';
        message += '\n\nPlease delete these records first or contact support.';
        alert(message);
        return;
      }
    }
    form.setFormData((prev: any) => ({ ...prev, uses_variant: checked }));
    if (checked) {
      form.setVariantPricing((prev: any[]) => [...prev, { id: Date.now() + Math.random(), company_variant_id: '', make: '', sale_price: '', purchase_price: '' }]);
    }
  }, [form]);

  const handleAddVariantRow = useCallback(() => {
    form.setVariantPricing((prev: any[]) => [...prev, { id: Date.now() + Math.random(), company_variant_id: '', make: '', sale_price: '', purchase_price: '' }]);
  }, [form]);

  const handleStockChange = useCallback((key: string, field: 'exclude' | 'current_stock', value: boolean | number) => {
    form.setWarehouseStock((prev: any) => ({ ...prev, [key]: { ...(prev[key] || { exclude: false, current_stock: 0 }), [field]: value } }));
  }, [form]);

  const handleAddVendorRow = useCallback(() => {
    form.setVendorMappings((prev: any[]) => [...prev, { id: `new_${Date.now()}`, variant_id: null, make: '', vendor_id: '', base_rate: 0, discount_percent: 0, is_preferred: false }]);
  }, [form]);

  const handleAddClientRow = useCallback(() => {
    form.setClientMappings((prev: any[]) => [...prev, { id: 'temp-' + Date.now(), client_id: '', company_variant_id: '', client_part_no: '', client_description: '' }]);
  }, [form]);

  const handleAddClientPricingRow = useCallback(() => {
    form.setClientPricing((prev: any[]) => [...prev, { id: 'temp-' + Date.now(), client_id: '', company_variant_id: '', pricing_type: 'Fixed ARC', rate: '', valid_from: '', valid_to: '', status: 'active' }]);
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

  // Toast notice after save (modal-style)
  useEffect(() => {
    if (!form.saveNotice) return;
    const t = setTimeout(() => form.setSaveNotice(''), 4000);
    return () => clearTimeout(t);
    /* eslint-disable-line react-hooks/exhaustive-deps */
  }, [form.saveNotice]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <div className="text-sm text-zinc-400">Loading item editor...</div>
      </div>
    );
  }

  return (
    <>
      <ItemEditorDialog
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
        manufacturingEnabled={manufacturingEnabled}
        editingMaterial={form.editingMaterial}
        materialSavePending={form.materialSavePending}
        saveNotice={form.saveNotice}
        showTechnical={showTechnical}
        customAttributes={form.customAttributes}
        attributeDefinitions={attributeDefinitions}
        onCustomAttributesChange={form.setCustomAttributes}
        onUsesVariantChange={handleUsesVariantChange}
        onAddVariantRow={handleAddVariantRow}
        onRemoveVariantRow={(id) => form.setVariantPricing((prev: any[]) => prev.filter((p: any) => p.id !== id))}
        onVariantRowChange={(id, field, value) => form.setVariantPricing((prev: any[]) => prev.map((p: any) => p.id === id ? { ...p, [field]: value } : p))}
        onToggleInventory={(checked) => form.setFormData((prev: any) => ({ ...prev, track_inventory: checked }))}
        onStockChange={handleStockChange}
        onAddVendorRow={handleAddVendorRow}
        onRemoveVendorRow={(id) => form.setVendorMappings((prev: any[]) => prev.filter((p: any) => p.id !== id))}
        onVendorRowChange={(id, field, value) => form.setVendorMappings((prev: any[]) => prev.map((p: any) => p.id === id ? { ...p, [field]: value } : p))}
        onAddClientRow={handleAddClientRow}
        onRemoveClientRow={(id) => form.setClientMappings((prev: any[]) => prev.filter((p: any) => p.id !== id))}
        onClientRowChange={(id, field, value) => form.setClientMappings((prev: any[]) => prev.map((p: any) => p.id === id ? { ...p, [field]: value } : p))}
        onAddClientPricingRow={handleAddClientPricingRow}
        onRemoveClientPricingRow={handleRemoveClientPricingRow}
        onClientPricingRowChange={handleClientPricingRowChange}
        onShowPricingHistory={handleShowPricingHistory}
        onToggleTechnical={handleToggleTechnical}
        discountCategories={discountCategories}
        onClassificationChange={handleClassificationChange}
        onSubmit={handleFormSubmit}
        onCategoryCreated={() => refetch()}
        unitOptions={units}
        onUnitCreated={() => refetch()}
      />
      {/* Floating save toast */}
      {form.saveNotice && (
        <div className="fixed bottom-6 right-6 bg-green-600 text-white px-4 py-2.5 rounded-lg shadow-lg text-sm z-50">
          {form.saveNotice}
        </div>
      )}
    </>
  );
}

export default ItemEditorPage;
