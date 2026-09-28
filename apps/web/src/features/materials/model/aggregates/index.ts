export type { MaterialEditorFormData, ClassificationOption, AccountingTreatmentOption, ItemTypeConfig } from './MaterialEditor';
export { createDefaultFormData, CLASSIFICATION_OPTIONS, CLASSIFICATION_PRESETS, ACCOUNTING_TREATMENT_OPTIONS, getAccountingTreatmentPreset, normalizeItemClassification, isServiceItem, isProductItem, isKitItem, getItemTypeConfig, getItemTypeLabel, getItemTypeBadgeClasses } from './MaterialEditor';
export type { VariantPricingRow, ClientPricingRow } from './MaterialPricing';
export type { WarehouseStockEntry, WarehouseStockMap, WarehouseStockRow } from './WarehouseStock';
export { buildStockKey, variantStockCombos, NO_VARIANT_KEY } from './WarehouseStock';
export type { VendorMappingRow } from './VendorMapping';
export type { ClientPricingRow } from './ClientMapping';
export type { AttributeDefinition, MaterialCustomAttribute } from '../entities/Material';
export type {
  ItemTransactions,
  AdjustmentRow,
  QuotationTxnRow,
  InvoiceTxnRow,
  PurchaseTxnRow,
  ChallanTxnRow,
  AuditTxnRow,
} from './Transaction';
export { createEmptyItemTransactions } from './Transaction';
export { MATERIAL_TYPES, ITEM_STATUS } from '../../constants';
