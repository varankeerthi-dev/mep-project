export type { Material, MaterialUnit, ItemStock } from './entities';
export type { Warehouse } from './entities';
export type { Vendor } from './entities';
export type { Client } from './entities';

export type {
  MaterialEditorFormData,
  ClassificationOption,
  VariantPricingRow,
  ClientPricingRow,
  WarehouseStockEntry,
  WarehouseStockMap,
  WarehouseStockRow,
  VendorMappingRow,
  ClientMappingRow,
  ItemTransactions,
  AdjustmentRow,
  QuotationTxnRow,
  InvoiceTxnRow,
  PurchaseTxnRow,
  ChallanTxnRow,
  AuditTxnRow,
} from './aggregates';
export {
  createDefaultFormData,
  CLASSIFICATION_OPTIONS,
  CLASSIFICATION_PRESETS,
  createEmptyItemTransactions,
} from './aggregates';

export {
  MaterialFormSchema,
  validateMaterialForm,
  VendorMappingSchema,
  WarehouseSchema,
} from './schemas';
export type { MaterialFormValidation } from './schemas';

export { editorToMaterial, materialToEditor, buildWarehouseStockMap, variantPricingFromDb } from './mappers';
