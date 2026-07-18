import { Modal } from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui/button';
import { Label } from '../../../../components/ui/label';
import { Select } from '../../../../components/ui/select';
import { cn } from '../../../../lib/utils';
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
  open,
  onClose,
  formData,
  onChange,
  variantPricing,
  warehouseStock,
  vendorMappings,
  clientMappings,
  clientPricing,
  pricingHistory,
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
  showTechnical,
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
  onAddClientPricingRow,
  onRemoveClientPricingRow,
  onClientPricingRowChange,
  onShowPricingHistory,
  onToggleTechnical,
  onClassificationChange,
  onSubmit,
}: ItemEditorDialogProps) {
  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={editingMaterial ? `Edit: ${editingMaterial.name}` : 'Add New Item'}
      size="xl"
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
            {materialSavePending ? 'Saving...' : editingMaterial ? 'Update Material' : 'Save Material'}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
        {/* Classification */}
        <div className="rounded-lg shadow-[0px_0px_0px_1px_oklch(0_0_0_/_0.06),0px_1px_2px_-1px_oklch(0_0_0_/_0.06),0px_2px_4px_0px_oklch(0_0_0_/_0.04)] p-4 space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h4 className="text-sm font-semibold text-zinc-700">Item Classification</h4>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {CLASSIFICATION_OPTIONS.filter(o => !o.requiresMfg || manufacturingEnabled).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onClassificationChange(opt.value)}
                className={cn(
                  'p-3 rounded-lg border text-left transition-[color,background-color,border-color,box-shadow] active:scale-[0.96]',
                  formData.item_classification === opt.value
                    ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500'
                    : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
                )}
              >
                <div className="text-xs font-semibold text-zinc-800">{opt.label}</div>
                <div className="text-[10px] text-zinc-500 mt-0.5">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <BasicInformationSection formData={formData} categoryOptions={categoryOptions} onChange={onChange} />
        <TechnicalSection formData={formData} onChange={onChange} showTechnical={showTechnical} onToggleTechnical={onToggleTechnical} />

        {/* Discount Category */}
        <div className="rounded-lg shadow-[0px_0px_0px_1px_oklch(0_0_0_/_0.06),0px_1px_2px_-1px_oklch(0_0_0_/_0.06),0px_2px_4px_0px_oklch(0_0_0_/_0.04)] p-4 space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h4 className="text-sm font-semibold text-zinc-700">Discount Category</h4>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Discount Category</Label>
            <Select
              value={formData.discount_category_id || ''}
              onValueChange={(v) => onChange('discount_category_id', v || null)}
              options={[
                {value: '', label: 'No Discount Category'},
                ...discountCategories.map((dc: any) => ({value: dc.id, label: dc.name}))
              ]}
            />
            <p className="text-[10px] text-zinc-400">Discount categories group items for bulk discounting in quotations. Each category has configurable min/max discount limits.</p>
          </div>
        </div>

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
      </form>
    </Modal>
  );
}
