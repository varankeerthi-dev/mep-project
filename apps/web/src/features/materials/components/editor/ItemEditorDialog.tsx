import { BasicInformationSection } from './BasicInformationSection';
import { TechnicalSection } from './TechnicalSection';
import { CommercialSection } from './CommercialSection';
import { VariantPricingSection } from './VariantPricingSection';
import { InventorySection } from './InventorySection';
import { VendorSection } from './VendorSection';
import { ClientSection } from './ClientSection';
import type { MaterialEditorFormData, VariantPricingRow, WarehouseStockMap, VendorMappingRow, ClientMappingRow, ClientPricingRow } from '../../model/aggregates';
import type { Warehouse, Vendor as VendorType, Client } from '../../model/entities';
import { CLASSIFICATION_OPTIONS } from '../../model/aggregates';

interface ItemEditorDialogProps {
  open: boolean;
  onClose: () => void;
  formData: MaterialEditorFormData;
  onChange: (field: string, value: any) => void;
  variantPricing: VariantPricingRow[];
  warehouseStock: WarehouseStockMap;
  vendorMappings: VendorMappingRow[];
  clientMappings: ClientMappingRow[];
  clientPricing: ClientPricingRow[];
  pricingHistory: any[];
  variants: { id: string; variant_name: string }[];
  warehouses: Warehouse[];
  vendors: VendorType[];
  clients: Client[];
  categoryOptions: string[];
  discountCategories: { id: string; name: string }[];
  manufacturingEnabled: boolean;
  editingMaterial: any;
  materialSavePending: boolean;
  saveNotice: string;
  showTechnical: boolean;
  onUsesVariantChange: (checked: boolean) => void;
  onAddVariantRow: () => void;
  onRemoveVariantRow: (id: number | string) => void;
  onVariantRowChange: (id: number | string, field: string, value: string) => void;
  onToggleInventory: (checked: boolean) => void;
  onStockChange: (key: string, field: 'exclude' | 'current_stock', value: boolean | number) => void;
  onAddVendorRow: () => void;
  onRemoveVendorRow: (id: string) => void;
  onVendorRowChange: (id: string, field: string, value: any) => void;
  onAddClientRow: () => void;
  onRemoveClientRow: (id: string) => void;
  onClientRowChange: (id: string, field: string, value: any) => void;
  onAddClientPricingRow: () => void;
  onRemoveClientPricingRow: (id: string) => void;
  onClientPricingRowChange: (id: string, field: string, value: any) => void;
  onShowPricingHistory: () => void;
  onToggleTechnical: () => void;
  onClassificationChange: (type: string) => void;
  onSubmit: (e: any) => void;
}

export function ItemEditorDialog({
  open, onClose, formData, onChange, variantPricing, warehouseStock,
  vendorMappings, clientMappings, clientPricing, pricingHistory,
  variants, warehouses, vendors, clients, categoryOptions, discountCategories,
  manufacturingEnabled, editingMaterial, materialSavePending, saveNotice,
  showTechnical, onUsesVariantChange, onAddVariantRow, onRemoveVariantRow,
  onVariantRowChange, onToggleInventory, onStockChange, onAddVendorRow,
  onRemoveVendorRow, onVendorRowChange, onAddClientRow, onRemoveClientRow,
  onClientRowChange, onAddClientPricingRow, onRemoveClientPricingRow,
  onClientPricingRowChange, onShowPricingHistory, onToggleTechnical,
  onClassificationChange, onSubmit,
}: ItemEditorDialogProps) {
  if (!open) return null;

  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="modal-content item-modal"
        onClick={e => e.stopPropagation()}
        style={{ width: '92vw', maxWidth: '640px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', background: '#fff' }}
      >
        {/* Header */}
        <div className="modal-header" style={{ flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <div>
              <div className="modal-title">{editingMaterial ? 'Edit Item' : 'Add Item'}</div>
              <div className="item-modal-subtitle">Fast, compact details for quotation, purchase, and inventory.</div>
            </div>
            <button type="button" onClick={onClose} className="item-modal-close" aria-label="Close">
              {'\u00D7'}
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ flex: 1, overflowY: 'auto' }}>
          <form id="item-form" onSubmit={onSubmit} className="space-y-2">

            {/* Classification */}
            <div className="border-t border-b border-zinc-200 py-10">
              <div className="item-form-section">
                <div className="item-form-section-header">
                  <h4 className="item-form-section-title">Item Classification</h4>
                  <span className="item-form-section-hint">Required</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {CLASSIFICATION_OPTIONS.filter(o => !o.requiresMfg || manufacturingEnabled).map((opt) => {
                    const isSelected = formData.item_classification === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => onClassificationChange(opt.value)}
                        className={`min-w-0 rounded-md border px-2.5 py-2 text-left transition-all duration-200 group ${
                          isSelected
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                            : 'border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className={`text-[10px] leading-4 transition-all duration-200 ${isSelected ? 'font-semibold' : 'font-medium'}`}>
                              {opt.label}
                            </div>
                            <div className="mt-0.5 text-[8px] leading-3 transition-all duration-200">
                              <span className={isSelected ? 'text-emerald-600' : 'text-zinc-400 group-hover:text-zinc-500'}>
                                {opt.desc}
                              </span>
                            </div>
                          </div>
                          <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all duration-200 ${
                            isSelected
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-600'
                              : 'border-zinc-300 bg-white text-zinc-400'
                          }`}>
                            {isSelected && (
                              <svg className="h-2 w-2" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M4 10l3.5 3.5L16 5" />
                              </svg>
                            )}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Basic Information */}
            <div className="border-t border-b border-zinc-200 py-10">
              <BasicInformationSection formData={formData} categoryOptions={categoryOptions} onChange={onChange} />
            </div>

            {/* Technical Attributes */}
            <div className="border-t border-b border-zinc-200 py-10">
              <TechnicalSection formData={formData} onChange={onChange} showTechnical={showTechnical} onToggleTechnical={onToggleTechnical} />
            </div>

            {/* Discount Category */}
            <div className="border-t border-b border-zinc-200 py-10">
              <div className="item-form-section">
                <div className="item-form-section-header">
                  <h4 className="item-form-section-title">Discount Category</h4>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Discount Category</label>
                    <select
                      className="form-select"
                      value={formData.discount_category_id || ''}
                      onChange={(e) => onChange('discount_category_id', e.target.value || null)}
                    >
                      <option value="">No Discount Category</option>
                      {discountCategories.map((dc: any) => (
                        <option key={dc.id} value={dc.id}>{dc.name}</option>
                      ))}
                    </select>
                    <p className="mt-1 text-[10px] text-zinc-400">Discount categories group items for bulk discounting in quotations.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Commercial */}
            <div className="border-t border-b border-zinc-200 py-10">
              <CommercialSection formData={formData} onChange={onChange} />
            </div>

            {/* Variant Pricing */}
            <div className="border-t border-b border-zinc-200 py-10">
              <VariantPricingSection
                variantPricing={variantPricing}
                variants={variants}
                usesVariant={formData.uses_variant}
                onToggleVariant={onUsesVariantChange}
                onAddRow={onAddVariantRow}
                onRemoveRow={onRemoveVariantRow}
                onRowChange={onVariantRowChange}
              />
            </div>

            {/* Inventory */}
            <div className="border-t border-b border-zinc-200 py-10">
              <InventorySection
                trackInventory={formData.track_inventory}
                warehouseStock={warehouseStock}
                warehouses={warehouses}
                usesVariant={formData.uses_variant}
                variantNames={variantPricing.map(p => p.company_variant_id).filter(Boolean)}
                onToggleInventory={onToggleInventory}
                onStockChange={onStockChange}
              />
            </div>

            {/* Vendor */}
            <div className="border-t border-b border-zinc-200 py-10">
              <VendorSection
                vendorMappings={vendorMappings}
                vendors={vendors}
                variants={variants}
                variantPricing={variantPricing}
                onAddRow={onAddVendorRow}
                onRemoveRow={onRemoveVendorRow}
                onRowChange={onVendorRowChange}
              />
            </div>

            {/* Client */}
            <div className="border-t border-b border-zinc-200 py-10">
              <ClientSection
                clientMappings={clientMappings}
                clientPricing={clientPricing}
                clients={clients}
                variants={variants}
                pricingHistory={pricingHistory}
                editingMaterial={editingMaterial}
                onAddRow={onAddClientRow}
                onRemoveRow={onRemoveClientRow}
                onRowChange={onClientRowChange}
                onAddClientPricingRow={onAddClientPricingRow}
                onRemoveClientPricingRow={onRemoveClientPricingRow}
                onClientPricingRowChange={onClientPricingRowChange}
                onShowPricingHistory={onShowPricingHistory}
              />
            </div>

          </form>
        </div>

        {/* Sticky Footer */}
        <div style={{ position: 'sticky', bottom: 0, zIndex: 10, display: 'flex', gap: '12px', padding: '16px 24px', borderTop: '1px solid #e5e7eb', background: '#fff', boxShadow: '0 -2px 8px rgba(0,0,0,0.06)', flexShrink: 0 }}>
          {saveNotice && <span className="text-sm text-green-600 mr-auto">{saveNotice}</span>}
          <button type="button" className="btn btn-primary" style={{ flex: 1 }} disabled={materialSavePending} onClick={onSubmit}>
            {materialSavePending ? 'Saving...' : (editingMaterial ? 'Update Item' : 'Save Item')}
          </button>
          <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose} disabled={materialSavePending}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
