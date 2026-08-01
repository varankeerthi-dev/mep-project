import { useState, useEffect } from 'react';
import { Button } from '../../../../components/ui/button';
import { EditorSection } from './EditorSection';
import { BasicInformationSection } from './BasicInformationSection';
import { TechnicalSection } from './TechnicalSection';
import { CommercialSection } from './CommercialSection';
import { VariantPricingSection } from './VariantPricingSection';
import { InventorySection } from './InventorySection';
import { VendorSection } from './VendorSection';
import { ClientSection } from './ClientSection';

import { selectField, primaryButton, secondaryButton } from './formStyles';
import { Boxes, Layers, Wrench, ShoppingCart, Check, ChevronLeft, Save, FileText } from 'lucide-react';
import { Switch } from '../../../../components/ui/switch';
import type { MaterialEditorFormData, VariantPricingRow, WarehouseStockMap, VendorMappingRow, ClientMappingRow, ClientPricingRow } from '../../model/aggregates';
import type { Warehouse, Vendor as VendorType, Client, MaterialCustomAttribute, AttributeDefinition } from '../../model/entities';
import { CLASSIFICATION_OPTIONS } from '../../model/aggregates';

const CLASS_ICONS: Record<string, any> = {
  finished_good: Boxes,
  raw_material: Layers,
  consumable: Wrench,
  goods_sold: ShoppingCart,
};

const CLASS_COLORS: Record<string, { icon: string; bg: string }> = {
  finished_good: { icon: '#22C55E', bg: '#F0FDF4' },
  raw_material: { icon: '#3B82F6', bg: '#EFF6FF' },
  consumable: { icon: '#EF4444', bg: '#FEF2F2' },
  goods_sold: { icon: '#F97316', bg: '#FFF7ED' },
};

interface ItemEditorDialogProps {
  open: boolean;
  onClose: () => void;
  /** When true, renders as a full page with breadcrumb header instead of a modal overlay */
  asPage?: boolean;
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
  customAttributes: MaterialCustomAttribute[];
  attributeDefinitions: AttributeDefinition[];
  onCustomAttributesChange: (attributes: MaterialCustomAttribute[]) => void;
  onToggleTechnical: () => void;
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
  onClassificationChange: (type: string) => void;
  onSubmit: (e: any) => void;
  onCategoryCreated?: (newCategory: string) => void;
  unitOptions: { unit_code: string; unit_name: string }[];
  onUnitCreated?: (newUnit: string) => void;
}

export function ItemEditorDialog({
  open, onClose, asPage = false, formData, onChange, variantPricing, warehouseStock,
  vendorMappings, clientMappings, clientPricing, pricingHistory,
  variants, warehouses, vendors, clients, categoryOptions, discountCategories,
  manufacturingEnabled, editingMaterial, materialSavePending, saveNotice,
  showTechnical, customAttributes, attributeDefinitions, onCustomAttributesChange,
  onUsesVariantChange, onAddVariantRow, onRemoveVariantRow,
  onVariantRowChange, onToggleInventory, onStockChange, onAddVendorRow,
  onRemoveVendorRow, onVendorRowChange, onAddClientRow, onRemoveClientRow,
  onClientRowChange, onAddClientPricingRow, onRemoveClientPricingRow,
  onClientPricingRowChange, onShowPricingHistory, onToggleTechnical,
  onClassificationChange, onSubmit, onCategoryCreated,
  unitOptions, onUnitCreated,
}: ItemEditorDialogProps) {
  if (!open) return null;

  const [dirty, setDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  useEffect(() => {
    if (saveNotice) {
      setDirty(false);
      setLastSaved(new Date().toLocaleTimeString());
    }
  }, [saveNotice]);
  const handleChange = (field: string, value: any) => {
    setDirty(true);
    onChange(field, value);
  };

  const handleSubmit = (e: any) => {
    e.preventDefault();
    if (!formData.item_classification) {
      alert('Please select an Item Type before saving.');
      return;
    }
    onSubmit(e);
  };

  // ── Shared form body ─────────────────────────────────────────────────────
  const formBody = (
    <form id="item-form" onSubmit={handleSubmit} className="space-y-6">
      {/* Item Classification — full width */}
      <EditorSection
        color="indigo"
        title="Item Type"
        badge="Required"
        description="Choose the classification that best describes this item."
        headerActions={
          <div className="flex items-center gap-2">
            <Switch
              size="default"
              checked={formData.is_active}
              onCheckedChange={(checked) => handleChange('is_active', checked)}
              className="data-checked:border-[#22C55E] data-checked:bg-[#22C55E]"
            />
            <span className="text-xs font-medium text-[#6B7280]">Active</span>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CLASSIFICATION_OPTIONS.filter(o => !o.requiresMfg || manufacturingEnabled).map((opt) => {
            const isSelected = formData.item_classification === opt.value;
            const Icon = CLASS_ICONS[opt.value] || Boxes;
            const colors = CLASS_COLORS[opt.value] || { icon: '#6B7280', bg: '#F3F4F6' };
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onClassificationChange(opt.value)}
                className={`group relative flex h-[100px] items-center gap-4 p-8 text-left transition-all duration-180 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1]/40 focus-visible:ring-offset-1 classification-card ${
                  isSelected
                    ? 'border-2 border-[#6366F1] bg-[#EEF2FF]'
                    : 'border border-[#E7EAF1] bg-white hover:border-[#818CF8] hover:bg-[#FAFAFF]'
                }`}
              >
                {/* Icon */}
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center transition-colors duration-180 icon-circle"
                  style={{ backgroundColor: colors.bg, color: colors.icon }}
                >
                  <Icon className="h-5 w-5" />
                </span>
                {/* Label + Description */}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold leading-5 text-[#111827]">
                    {opt.label}
                  </div>
                  <div className="mt-0.5 text-xs leading-4 text-[#6B7280]">
                    {opt.desc}
                  </div>
                </div>
                {/* Radio indicator */}
                <span
                  className={`radio-indicator flex h-5 w-5 shrink-0 items-center justify-center border-2 transition-all duration-180 ${
                    isSelected
                      ? 'border-[#6366F1] bg-[#6366F1]'
                      : 'border-[#D1D5DB] bg-white group-hover:border-[#6366F1]/40'
                  }`}
                >
                  {isSelected && (
                    <Check className="h-3 w-3 text-white" strokeWidth={3} />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </EditorSection>

      {/* Row: 2. Basic Information + 3. Technical Attributes — two-column */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <BasicInformationSection
          color="green"
          formData={formData}
          categoryOptions={categoryOptions}
          unitOptions={unitOptions}
          onChange={handleChange}
          onCategoryCreated={onCategoryCreated}
          onUnitCreated={onUnitCreated}
        />
        <TechnicalSection
          color="purple"
          customAttributes={customAttributes}
          attributeDefinitions={attributeDefinitions}
          onCustomAttributesChange={onCustomAttributesChange}
          showTechnical={showTechnical}
          onToggleTechnical={onToggleTechnical}
        />
      </div>

      {/* Row: 4. Discount Category + 5. Commercial / Pricing — two-column */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <EditorSection color="blue" title="Discount Category" description="Choose a discount category for this item (used in quotations).">
          <div className="space-y-2">
            <label className="text-[13px] font-semibold text-[#374151]">Discount Category</label>
            <div className="relative">
              <select
                className={selectField}
                value={formData.discount_category_id || ''}
                onChange={(e) => handleChange('discount_category_id', e.target.value || null)}
              >
                <option value="">No Discount Category</option>
                {discountCategories.map((dc: any) => (
                  <option key={dc.id} value={dc.id}>{dc.name}</option>
                ))}
              </select>
            </div>
          </div>
        </EditorSection>
        <CommercialSection
          formData={formData}
          onChange={handleChange}
        />
      </div>

      {/* Inventory — full width */}
      <InventorySection
        color="teal"
        trackInventory={formData.track_inventory}
        warehouseStock={warehouseStock}
        warehouses={warehouses}
        usesVariant={formData.uses_variant}
        variantNames={variantPricing.map(p => p.company_variant_id).filter(Boolean)}
        onToggleInventory={onToggleInventory}
        onStockChange={onStockChange}
      />

      {/* 8. Variant Pricing — collapsed */}
      <VariantPricingSection
        number={8}
        variantPricing={variantPricing}
        variants={variants}
        usesVariant={formData.uses_variant}
        onToggleVariant={onUsesVariantChange}
        onAddRow={onAddVariantRow}
        onRemoveRow={onRemoveVariantRow}
        onRowChange={onVariantRowChange}
      />

      {/* 9. Purchase & Vendor Mapping — collapsed */}
      <VendorSection
        number={9}
        vendorMappings={vendorMappings}
        vendors={vendors}
        variants={variants}
        variantPricing={variantPricing}
        onAddRow={onAddVendorRow}
        onRemoveRow={onRemoveVendorRow}
        onRowChange={onVendorRowChange}
      />

      {/* 10. Client Mapping — collapsed */}
      <ClientSection
        number={10}
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

      {/* 11. Additional Information — collapsed */}
      <EditorSection color="slate" title="Additional Information" description="Barcodes, documents, notes and other custom fields." expanded={false}>
        <p className="text-sm text-[#6B7280]">Additional fields will appear here once configured.</p>
      </EditorSection>
    </form>
  );

  const saveLabel = materialSavePending
    ? 'Saving...'
    : (editingMaterial ? 'Update Item' : 'Save Item');

  // ── Page variant: full page with breadcrumb header ──────────────────────
  if (asPage) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', background: '#FFFFFF' }}>
        {/* Sticky Top Bar with Breadcrumb + Actions */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 20,
          background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(12px)',
          borderBottom: '1px solid #E5E7EB',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 32px', maxWidth: 1450, margin: '0 auto', width: '100%' }}>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onClose}
              aria-label="Back"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <nav aria-label="Breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#9ca3af' }}>
              <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366F1', fontSize: '13px', padding: 0, fontFamily: 'inherit' }}>Store</button>
              <span>/</span>
              <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366F1', fontSize: '13px', padding: 0, fontFamily: 'inherit' }}>Materials</button>
              <span>/</span>
              <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366F1', fontSize: '13px', padding: 0, fontFamily: 'inherit' }}>Items</button>
              <span>/</span>
              <span style={{ color: '#111827', fontWeight: 600 }}>{editingMaterial ? 'Edit Item' : 'Add New Material'}</span>
            </nav>
            <div style={{ flex: 1 }} />
            {/* Action buttons in top-right */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <Button type="button" variant="outline" className={secondaryButton} onClick={onClose} disabled={materialSavePending}>
                Cancel
              </Button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={materialSavePending}
                className={secondaryButton}
              >
                <FileText className="h-4 w-4" />
                Save Draft
              </button>
              <Button type="button" variant="default" className={primaryButton} onClick={handleSubmit} disabled={materialSavePending}>
                <Save className="h-4 w-4" />
                {saveLabel}
              </Button>
            </div>
          </div>
        </div>

        {/* Page container: max 1450px, centered */}
        <div style={{ maxWidth: 1450, width: '100%', margin: '0 auto', padding: '24px 32px 48px', boxSizing: 'border-box' }}>
          {/* Page Title */}
          <div style={{ padding: '16px 0 24px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.01em', color: '#111827', margin: 0 }}>
              {editingMaterial ? 'Edit Item' : 'Add New Material'}
            </h1>
          </div>

          {/* Body */}
          <div style={{ width: '100%' }}>
            {formBody}
          </div>
        </div>
      </div>
    );
  }

  // ── Modal variant (default) ──────────────────────────────────────────────
  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="modal-content item-modal"
        onClick={e => e.stopPropagation()}
        style={{ width: '94vw', maxWidth: '760px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', background: '#FFFFFF' }}
      >
        <div className="modal-header" style={{ flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <div>
              <div className="modal-title">{editingMaterial ? 'Edit Item' : 'Add New Material'}</div>
            </div>
            <button type="button" onClick={onClose} className="item-modal-close" aria-label="Close">
              {'\u00D7'}
            </button>
          </div>
        </div>

        <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '20px', background: '#F8FAFC' }}>
          {formBody}
        </div>

        <div style={{ position: 'sticky', bottom: 0, zIndex: 10, display: 'flex', gap: '12px', padding: '16px 24px', borderTop: '1px solid #E5E7EB', background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(12px)', flexShrink: 0 }}>
          <button type="button" className={secondaryButton} style={{ flex: 1 }} onClick={onClose} disabled={materialSavePending}>
            Cancel
          </button>
          <Button type="button" variant="default" className={primaryButton} style={{ flex: 1 }} onClick={handleSubmit} disabled={materialSavePending}>
            {saveLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
