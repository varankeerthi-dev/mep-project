import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useReactTable, getCoreRowModel } from '@tanstack/react-table';
import { supabase } from '../../../supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { useMaterialsPageData } from '../../../hooks/useMaterialsPageData';
import { useMaterialForm } from '../hooks/useMaterialForm';
import { useItemTransactions } from '../hooks/useItemTransactions';
import { useBulkPriceUpdate } from '../hooks/useBulkPriceUpdate';
import { useMaterialActions } from '../hooks/useMaterialActions';
import { ItemsToolbar } from '../components/toolbar/ItemsToolbar';
import { ColumnSettingsDropdown } from '../components/toolbar/ColumnSettingsDropdown';
import { ItemsTable } from '../components/table/ItemsTable';
import { Pagination } from '../components/table/Pagination';
import { buildColumns } from '../components/table/columns';
import { ItemEditorDialog } from '../components/editor/ItemEditorDialog';
import { ItemDetailsDialog } from '../components/viewer/ItemDetailsDialog';
import { BulkPriceDialog } from '../components/dialogs/BulkPriceDialog';
import { MultiItemDialog, ExcelEditorDialog } from '../components/dialogs';
import { checkVariantRecords } from '../persistence/materialsPersistence';
import { CLASSIFICATION_PRESETS } from '../model/aggregates';
import { ITEM_TABLE_COLUMNS, MANDATORY_ITEM_COLUMNS, DEFAULT_PAGE_SIZE, COLUMNS_STORAGE_KEY } from '../constants';
import { MAIN_CATEGORIES } from '../shared/constants';

export function ItemsTab() {
  const queryClient = useQueryClient();
  const { organisation } = useAuth();
  const orgId = organisation?.id ?? null;
  const manufacturingEnabled = Boolean((organisation as any)?.manufacturing_enabled);

  // ─── Data ────────────────────────────────────────────────────
  const { data: pageData, isLoading, refetch } = useMaterialsPageData(orgId);
  const materials = pageData?.materials ?? [];
  const stock = pageData?.stock ?? [];
  const categories = pageData?.categories ?? [];
  const variants = pageData?.variants ?? [];
  const warehouses = pageData?.warehouses ?? [];
  const clients = pageData?.clients ?? [];
  const discountCategories = pageData?.discountCategories ?? [];
  const categoryOptions = categories.length > 0 ? categories.map((c: any) => c.category_name) : MAIN_CATEGORIES;

  // Vendors (separate query)
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

  const discountCategoryMap = useMemo(() => {
    const map: Record<string, string> = {};
    discountCategories.forEach((dc: any) => { map[dc.id] = dc.name; });
    return map;
  }, [discountCategories]);

  const stockData: Record<string, number> = useMemo(() => {
    const map: Record<string, number> = {};
    stock.forEach((s: any) => {
      if (!map[s.item_id]) map[s.item_id] = 0;
      map[s.item_id] += parseFloat(s.current_stock) || 0;
    });
    return map;
  }, [stock]);

  const refreshMaterials = useCallback(async () => { await refetch(); }, [refetch]);
  const updateMaterialsCache = useCallback((updater: any) => {
    queryClient.setQueryData(['materials-page-data', orgId], (old: any) => {
      if (!old) return old;
      const base = Array.isArray(old.materials) ? old.materials : [];
      const next = typeof updater === 'function' ? updater(base) : updater;
      return { ...old, materials: next };
    });
  }, [queryClient, orgId]);

  // ─── Hooks ───────────────────────────────────────────────────
  const form = useMaterialForm();
  const transactions = useItemTransactions();
  const bulk = useBulkPriceUpdate(materials);
  const actions = useMaterialActions(orgId, updateMaterialsCache);

  // ─── UI State ────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [showTechnical, setShowTechnical] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [hideInactive, setHideInactive] = useState(false);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState('overview');
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem(COLUMNS_STORAGE_KEY);
    const defaultCols = ITEM_TABLE_COLUMNS.filter((col) => col.default).map((col) => col.key);
    if (!saved) return defaultCols;
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return [...new Set([...MANDATORY_ITEM_COLUMNS, ...parsed])];
    } catch { /* ignore */ }
    return defaultCols;
  });

  // ─── Dialog State ────────────────────────────────────────────
  const [showMultiItemModal, setShowMultiItemModal] = useState(false);
  const [showExcelEditor, setShowExcelEditor] = useState(false);
  const [multiItemRows, setMultiItemRows] = useState<any[]>([]);
  const [isSavingSequentially, setIsSavingSequentially] = useState(false);
  const [saveProgress, setSaveProgress] = useState({ current: 0, total: 0 });

  useEffect(() => { localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(visibleColumns)); }, [visibleColumns]);

  // ─── Filtering & Pagination ──────────────────────────────────
  const filteredMaterials = useMemo(() => {
    return materials.filter((m: any) => {
      if (hideInactive && !m.is_active) return false;
      if (categoryFilter !== 'All' && m.main_category !== categoryFilter) return false;
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (m.name?.toLowerCase().includes(term) ||
              m.display_name?.toLowerCase().includes(term) ||
              m.item_code?.toLowerCase().includes(term) ||
              m.main_category?.toLowerCase().includes(term) ||
              m.hsn_code?.toLowerCase().includes(term));
    });
  }, [materials, searchTerm, categoryFilter, hideInactive]);

  const totalPages = Math.max(1, Math.ceil(filteredMaterials.length / DEFAULT_PAGE_SIZE));
  const paginatedMaterials = useMemo(() => {
    const start = (currentPage - 1) * DEFAULT_PAGE_SIZE;
    return filteredMaterials.slice(start, start + DEFAULT_PAGE_SIZE);
  }, [filteredMaterials, currentPage]);
  useEffect(() => { setCurrentPage(1); }, [searchTerm, categoryFilter, hideInactive]);

  // ─── Table Columns ───────────────────────────────────────────
  const handleView = useCallback((material: any) => {
    setSelectedMaterialId(material.id);
    setActiveDetailTab('overview');
    setShowDetailsDialog(true);
    transactions.loadItemTransactions(material.id);
  }, [transactions]);

  const columns = useMemo(() => buildColumns(
    visibleColumns, stockData, discountCategoryMap,
    handleView,
    (material) => form.editMaterial(material, warehouses, stock),
    (material) => actions.deleteMaterial(material),
  ), [visibleColumns, stockData, discountCategoryMap, handleView, form, warehouses, stock, actions]);

  const table = useReactTable({ data: paginatedMaterials, columns, getCoreRowModel: getCoreRowModel() });

  // ─── Handlers ────────────────────────────────────────────────
  const openForm = useCallback(() => { form.resetForm(); form.setShowForm(true); }, [form]);
  const handleFormSubmit = useCallback((e: any) => {
    form.handleSubmit(e, { organisationId: orgId, warehouses, updateMaterialsCache, refreshMaterials, loadItemTransactions: transactions.loadItemTransactions, selectedMaterialId });
  }, [form, orgId, warehouses, updateMaterialsCache, refreshMaterials, transactions, selectedMaterialId]);

  const toggleColumn = useCallback((key: string) => {
    if (MANDATORY_ITEM_COLUMNS.includes(key)) return;
    setVisibleColumns((prev) => {
      if (prev.includes(key)) return [...new Set([...MANDATORY_ITEM_COLUMNS, ...prev.filter((c) => c !== key)])];
      return [...new Set([...prev, key])];
    });
  }, []);

  const handleClassificationChange = useCallback((type: string) => {
    form.setFormData((prev: any) => ({
      ...prev,
      item_classification: type,
      ...(CLASSIFICATION_PRESETS[type] || {}),
    }));
  }, [form]);

  // ─── Editor Row Handlers ────────────────────────────────────
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

  // ─── Multi-Item Handlers ─────────────────────────────────────
  const handleMultiItemSave = useCallback(async () => {
    if (isSavingSequentially || !orgId || multiItemRows.length === 0) return;
    setIsSavingSequentially(true);
    setSaveProgress({ current: 0, total: multiItemRows.length });

    let saved = 0;
    let failed = 0;
    for (let i = 0; i < multiItemRows.length; i++) {
      const row = multiItemRows[i];
      try {
        const materialData = {
          name: row.name.trim(),
          display_name: row.name.trim(),
          item_code: 'ITEM-' + Date.now().toString(36).toUpperCase() + '-' + i,
          unit: row.unit || 'nos',
          sale_price: row.sale_price ? parseFloat(row.sale_price) : null,
          purchase_price: row.purchase_price ? parseFloat(row.purchase_price) : null,
          gst_rate: row.gst_rate ?? 18,
          is_active: true,
          item_type: 'product',
          organisation_id: orgId,
        };
        const { error } = await supabase.from('materials').insert(materialData);
        if (error) throw error;
        saved++;
      } catch (err: any) {
        console.error(`Failed to save row ${i + 1}:`, err);
        failed++;
      }
      setSaveProgress({ current: i + 1, total: multiItemRows.length });
    }

    setIsSavingSequentially(false);
    setShowMultiItemModal(false);
    setMultiItemRows([]);
    await refreshMaterials();

    const msg = failed > 0
      ? `${saved} item(s) saved, ${failed} failed.`
      : `${saved} item(s) saved successfully.`;
    form.setSaveNotice(msg);
  }, [isSavingSequentially, orgId, multiItemRows, refreshMaterials, form]);

  // ─── Render ──────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <ItemsToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onAddItem={openForm}
        onBulkImport={() => { setMultiItemRows([]); setShowMultiItemModal(true); }}
        onBulkPrice={bulk.openBulkPriceModal}
        onColumnSettings={() => setShowColumnSettings(!showColumnSettings)}
        onExport={() => setShowExcelEditor(true)}
        categoryFilter={categoryFilter}
        categoryOptions={categoryOptions}
        onCategoryChange={(cat) => { setCategoryFilter(cat); setShowCategoryDropdown(false); }}
        showCategoryDropdown={showCategoryDropdown}
        onToggleCategoryDropdown={() => setShowCategoryDropdown(!showCategoryDropdown)}
        hideInactive={hideInactive}
        onToggleHideInactive={() => setHideInactive(!hideInactive)}
      />

      <div className="relative bg-white border border-zinc-200 rounded-xl shadow-sm">
        {showColumnSettings && (
          <ColumnSettingsDropdown columns={ITEM_TABLE_COLUMNS} visibleColumns={visibleColumns} onToggleColumn={toggleColumn} />
        )}
        {isLoading ? (
          <div className="p-12 text-center text-sm text-zinc-400">Loading items...</div>
        ) : (
          <ItemsTable table={table} onRowClick={handleView} selectedMaterialId={selectedMaterialId} />
        )}
        <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={filteredMaterials.length} onPageChange={setCurrentPage} />
      </div>

      {/* Notification */}
      {form.saveNotice && (
        <div className="fixed bottom-6 right-6 bg-green-600 text-white px-4 py-2.5 rounded-lg shadow-lg text-sm z-50">
          {form.saveNotice}
        </div>
      )}

      {/* Editor Dialog */}
      <ItemEditorDialog
        open={form.showForm}
        onClose={form.resetForm}
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
      />

      {/* Details Dialog */}
      <ItemDetailsDialog
        open={showDetailsDialog}
        onClose={() => setShowDetailsDialog(false)}
        material={materials.find((m: any) => m.id === selectedMaterialId) || null}
        activeTab={activeDetailTab}
        onTabChange={setActiveDetailTab}
        transactions={transactions.itemTransactions}
        loading={transactions.detailLoading}
      />

      {/* Multi-Item Quick Add Dialog */}
      <MultiItemDialog
        open={showMultiItemModal}
        onClose={() => { if (!isSavingSequentially) { setShowMultiItemModal(false); setMultiItemRows([]); } }}
        rows={multiItemRows}
        onRowsChange={setMultiItemRows}
        onSave={handleMultiItemSave}
        isSaving={isSavingSequentially}
        saveProgress={saveProgress}
      />

      {/* Excel Editor Dialog */}
      <ExcelEditorDialog
        open={showExcelEditor}
        onClose={() => setShowExcelEditor(false)}
      />

      {/* Bulk Price Dialog */}
      <BulkPriceDialog
        open={bulk.showBulkPriceModal}
        onClose={bulk.closeBulkPriceModal}
        priceText={bulk.bulkPriceText}
        onPriceTextChange={bulk.setBulkPriceText}
        previewRows={bulk.bulkPreviewRows}
        parseErrors={bulk.bulkParseErrors}
        applyErrors={bulk.bulkApplyErrors}
        inProgress={bulk.bulkInProgress}
        onPreview={bulk.parseBulkPriceRows}
        onApply={() => bulk.applyBulkPriceUpdates(refreshMaterials, transactions.loadItemTransactions, selectedMaterialId)}
      />
    </div>
  );
}
