import { Modal } from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui/button';
import { BasicInformationSection } from './BasicInformationSection';
import { TechnicalSection } from './TechnicalSection';
import { CommercialSection } from './CommercialSection';
import { VariantPricingSection } from './VariantPricingSection';
import { InventorySection } from './InventorySection';
import { VendorSection } from './VendorSection';
import { ClientSection } from './ClientSection';
import type { MaterialEditorFormData, VariantPricingRow, WarehouseStockMap, VendorMappingRow, ClientMappingRow } from '../../model/aggregates';
import type { Warehouse, Vendor as VendorType, Client } from '../../model/entities';
import { CLASSIFICATION_OPTIONS, CLASSIFICATION_PRESETS } from '../../model/aggregates';

interface ItemEditorDialogProps {
  open: boolean;
  onClose: () => void;
  formData: MaterialEditorFormData;
  onChange: (field: string, value: any) => void;
  variantPricing: VariantPricingRow[];
  warehouseStock: WarehouseStockMap;
  vendorMappings: VendorMappingRow[];
  clientMappings: ClientMappingRow[];
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
  onClassificationChange: (type: string) => void;
  onSubmit: (e: any) => void;
}

export function ItemEditorDialog({
  open,
  onClose,
  formData,
  onChange,
  variantPricing,
  warehouseStock,
  vendorMappings,
  clientMappings,
  variants,
  warehouses,
  vendors,
  clients,
  categoryOptions,
  discountCategories,
  manufacturingEnabled,
  editingMaterial,
  materialSavePending,
  saveNotice,
  onUsesVariantChange,
  onAddVariantRow,
  onRemoveVariantRow,
  onVariantRowChange,
  onToggleInventory,
  onStockChange,
  onAddVendorRow,
  onRemoveVendorRow,
  onVendorRowChange,
  onAddClientRow,
  onRemoveClientRow,
  onClientRowChange,
  onClassificationChange,
  onSubmit,
}: ItemEditorDialogProps) {
  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={editingMaterial ? `Edit: ${editingMaterial.name}` : 'Add New Item'}
      size="full"
      footer={
        <>
          {saveNotice && <span className="text-sm text-green-600 mr-auto">{saveNotice}</span>}
          <Button variant="secondary" onClick={onClose} className="text-xs">Cancel</Button>
          <Button
            variant="default"
            onClick={onSubmit}
            disabled={materialSavePending}
            className="text-xs"
          >
            {materialSavePending ? 'Saving...' : editingMaterial ? 'Update Item' : 'Save Item'}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
        {/* Classification */}
        <fieldset className="border border-zinc-200 rounded-lg p-4 space-y-3">
          <legend className="text-sm font-semibold text-zinc-700 px-2">Item Classification</legend>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {CLASSIFICATION_OPTIONS.filter(o => !o.requiresMfg || manufacturingEnabled).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onClassificationChange(opt.value)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  formData.item_classification === opt.value
                    ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500'
                    : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
                }`}
              >
                <div className="text-xs font-semibold text-zinc-800">{opt.label}</div>
                <div className="text-[10px] text-zinc-500 mt-0.5">{opt.desc}</div>
              </button>
            ))}
          </div>
        </fieldset>

        <BasicInformationSection formData={formData} categoryOptions={categoryOptions} onChange={onChange} />
        <TechnicalSection formData={formData} onChange={onChange} />
        {/* Discount Category */}
        <fieldset className="border border-zinc-200 rounded-lg p-4 space-y-3">
          <legend className="text-sm font-semibold text-zinc-700 px-2">Discount Category</legend>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-600">Discount Category</label>
            <select
              value={formData.discount_category_id || ''}
              onChange={(e) => onChange('discount_category_id', e.target.value || null)}
              className="h-9 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">No Discount Category</option>
              {discountCategories.map((dc: any) => (
                <option key={dc.id} value={dc.id}>{dc.name}</option>
              ))}
            </select>
            <p className="text-[10px] text-zinc-400">Discount categories group items for bulk discounting in quotations. Each category has configurable min/max discount limits.</p>
          </div>
        </fieldset>

        <CommercialSection formData={formData} onChange={onChange} />
        <VariantPricingSection
          variantPricing={variantPricing}
          variants={variants}
          usesVariant={formData.uses_variant}
          onToggleVariant={onUsesVariantChange}
          onAddRow={onAddVariantRow}
          onRemoveRow={onRemoveVariantRow}
          onRowChange={onVariantRowChange}
        />
        <InventorySection
          trackInventory={formData.track_inventory}
          warehouseStock={warehouseStock}
          warehouses={warehouses}
          usesVariant={formData.uses_variant}
          variantNames={variantPricing.map(p => p.company_variant_id).filter(Boolean)}
          onToggleInventory={onToggleInventory}
          onStockChange={onStockChange}
        />
        <VendorSection
          vendorMappings={vendorMappings}
          vendors={vendors}
          onAddRow={onAddVendorRow}
          onRemoveRow={onRemoveVendorRow}
          onRowChange={onVendorRowChange}
        />
        <ClientSection
          clientMappings={clientMappings}
          clients={clients}
          onAddRow={onAddClientRow}
          onRemoveRow={onRemoveClientRow}
          onRowChange={onClientRowChange}
        />
      </form>
    </Modal>
  );
}
