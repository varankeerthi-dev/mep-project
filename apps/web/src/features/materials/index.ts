// ═══════════════════════════════════════════════════════════════
// Materials Feature — Public API
// ═══════════════════════════════════════════════════════════════

// Pages
export { default as MaterialsPage } from './page/MaterialsPage';
export { ItemsTab } from './page/ItemsTab';

// Components
export { ItemsToolbar, ColumnSettingsDropdown } from './components/toolbar';
export { ItemsTable, Pagination } from './components/table';
export { ItemEditorDialog, BasicInformationSection, TechnicalSection, CommercialSection, InventorySection, VendorSection, ClientSection, VariantPricingSection } from './components/editor';
export { ItemDetailsDialog, OverviewTab, WarehouseTab, AdjustmentsTab, TransactionsTab, AuditTab } from './components/viewer';
export { BulkPriceDialog, MultiItemDialog, ExcelEditorDialog } from './components/dialogs';

// Hooks
export { useMaterialForm, useItemTransactions, useBulkPriceUpdate, useMaterialActions } from './hooks';

// Model
export type { Material, Warehouse, Vendor, Client, MaterialUnit, ItemStock } from './model';
export type {
  MaterialEditorFormData,
  ClassificationOption,
  VariantPricingRow,
  ClientPricingRow,
  WarehouseStockEntry,
  WarehouseStockMap,
  VendorMappingRow,
  ClientMappingRow,
  ItemTransactions,
} from './model';
export { createDefaultFormData, CLASSIFICATION_OPTIONS, CLASSIFICATION_PRESETS, createEmptyItemTransactions } from './model';
export { MaterialFormSchema, validateMaterialForm } from './model';
export { editorToMaterial, materialToEditor, buildWarehouseStockMap, variantPricingFromDb } from './model';

// Constants
export { DEFAULT_PAGE_SIZE, DEFAULT_COLUMNS, MANDATORY_ITEM_COLUMNS, ITEM_TABLE_COLUMNS, ITEM_STATUS, MATERIAL_TYPES, GST_OPTIONS } from './constants';
export type { ColumnDef } from './constants';

// Lib
export { calculateMargin, calculateStockValue, generateItemCode, generateWarehouseCode, normalizeMaterial } from './lib';

// Repository
export { saveMaterialAggregate, deleteOrArchiveMaterial, toggleMaterialActive, loadItemTransactionData } from './repository';

// Persistence
export { fetchMaterials, insertMaterial, updateMaterial } from './persistence';

// Services
export { useCategories, useVendors, useDiscountCategories } from './services/referenceDataService';

// Shared (legacy support)
export { formatCurrencyOrDash, generateSelectiveTemplate } from './shared/utils';
export { getLocalAuditTrail, appendLocalAuditEntry, buildItemChangeLog, normalizeAuditChanges } from './shared/audit';
export { MAIN_CATEGORIES, GST_RATES, ITEM_DETAIL_TABS, CLASSIFICATION_OPTIONS as SHARED_CLASSIFICATION_OPTIONS, getMaterialsTabFromSearch } from './shared/constants';
export { TabButton } from './shared/TabButton';

// Settings tabs
export { CategoryTab } from './settings/CategoryTab';
export { UnitTab } from './settings/UnitTab';
export { WarehousesTab } from './settings/WarehouseTab';
export { VariantsTab } from './settings/VariantsTab';
export { DiscountCategoriesTab } from './settings/DiscountCategoriesTab';

// Service tabs
export { ServiceTab } from './service/ServiceTab';
export { ServiceRatesTab } from './service/ServiceRatesTab';
