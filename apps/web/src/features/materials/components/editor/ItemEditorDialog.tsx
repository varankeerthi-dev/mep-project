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
import { Boxes, Layers, Wrench, ShoppingCart, Building2, Briefcase, Check, ChevronLeft, Save, FileText, Landmark } from 'lucide-react';
import { Switch } from '../../../../components/ui/switch';
import type { MaterialEditorFormData, VariantPricingRow, WarehouseStockMap, VendorMappingRow, ClientMappingRow, ClientPricingRow, AccountingTreatmentOption } from '../../model/aggregates';
import { variantStockCombos, ACCOUNTING_TREATMENT_OPTIONS } from '../../model/aggregates';
import type { Warehouse, Vendor as VendorType, Client, MaterialCustomAttribute, AttributeDefinition } from '../../model/entities';

const TREATMENT_ICONS: Record<string, any> = {
  INVENTORY_STOCK: ShoppingCart,
  INVENTORY_RAW: Layers,
  INVENTORY_FINISHED: Boxes,
  FIXED_ASSET: Building2,
  EXPENSE_CONSUMABLE: Wrench,
  EXPENSE_SERVICE: Briefcase,
};

const TREATMENT_COLORS: Record<string, { icon: string; bg: string }> = {
  INVENTORY_STOCK: { icon: '#F97316', bg: '#FFF7ED' },
  INVENTORY_RAW: { icon: '#3B82F6', bg: '#EFF6FF' },
  INVENTORY_FINISHED: { icon: '#22C55E', bg: '#F0FDF4' },
  FIXED_ASSET: { icon: '#8B5CF6', bg: '#F5F3FF' },
  EXPENSE_CONSUMABLE: { icon: '#EC4899', bg: '#FDF2F8' },
  EXPENSE_SERVICE: { icon: '#06B6D4', bg: '#ECFEFF' },
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
  assetCategories?: any[];
  accounts?: any[];
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
  assetCategories = [], accounts = [],
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
      {/* 1. Accounting Treatment & Item Classification — full width */}
      <EditorSection
        color="indigo"
        title="Accounting & Item Classification"
        badge="Required"
        description="Select the accounting treatment for this item. This governs balance sheet asset vs. profit & loss expense posting on purchase, inventory stock tracking, and COGS calculation on sale."
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
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {ACCOUNTING_TREATMENT_OPTIONS.map((opt) => {
            const isSelected = (formData.accounting_treatment || 'INVENTORY_STOCK') === opt.value;
            const Icon = TREATMENT_ICONS[opt.value] || Boxes;
            const colors = TREATMENT_COLORS[opt.value] || { icon: '#6B7280', bg: '#F3F4F6' };
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onClassificationChange(opt.value)}
                className={`group relative flex min-h-[90px] items-start gap-3 rounded-xl px-4 py-3.5 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1]/40 focus-visible:ring-offset-1 ${
                  isSelected
                    ? 'border-2 border-[#6366F1] bg-[#EEF2FF] shadow-sm'
                    : 'border border-[#E2E5EB] bg-white hover:border-[#818CF8]/50 hover:bg-[#FAFAFF] hover:shadow-sm'
                }`}
              >
                {/* Icon */}
                <span
                  className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-150"
                  style={{ backgroundColor: colors.bg, color: colors.icon }}
                >
                  <Icon className="h-5 w-5" />
                </span>
                {/* Label + Description */}
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold leading-4 text-[#111827]">
                    {opt.label}
                  </div>
                  <div className="mt-1 text-[11px] leading-4 text-[#6B7280]">
                    {opt.desc}
                  </div>
                </div>
                {/* Radio indicator */}
                <span
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-150 ${
                    isSelected
                      ? 'border-[#6366F1] bg-[#6366F1]'
                      : 'border-[#D1D5DB] bg-white group-hover:border-[#6366F1]/40'
                  }`}
                >
                  {isSelected && (
                    <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {/* General Ledger Account Overrides (Zoho Books pattern) */}
        <div className="mt-6 border-t border-slate-100 pt-5">
          <div className="flex items-center gap-2 mb-3">
            <Landmark className="h-4 w-4 text-indigo-600" />
            <h4 className="text-[13px] font-semibold text-slate-800">Chart of Accounts Mapping & Overrides</h4>
            <span className="text-xs text-slate-500 font-normal">(Zoho Books style per-item GL overrides)</span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Sales Income Account */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Sales Income Account
              </label>
              <select
                className={selectField}
                value={formData.sales_income_account_id || ''}
                onChange={(e) => handleChange('sales_income_account_id', e.target.value || null)}
              >
                <option value="">Default: 3100 Sales Accounts</option>
                {accounts
                  .filter((a: any) => a.root_type === 'Income' || a.account_code?.startsWith('3'))
                  .map((a: any) => (
                    <option key={a.id} value={a.id}>
                      {a.account_code ? `${a.account_code} - ` : ''}{a.name}
                    </option>
                  ))}
              </select>
              <div className="text-[11px] text-slate-500">
                Credited when this item is sold on a Sales Invoice.
              </div>
            </div>

            {/* Purchase Account Override */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Purchase Account Override
              </label>
              <select
                className={selectField}
                value={formData.purchase_account_id || ''}
                onChange={(e) => handleChange('purchase_account_id', e.target.value || null)}
              >
                <option value="">Standard Account (Determined by Treatment)</option>
                {accounts
                  .filter((a: any) => a.root_type === 'Expense' || a.root_type === 'Asset' || a.account_code?.startsWith('4') || a.account_code?.startsWith('1'))
                  .map((a: any) => (
                    <option key={a.id} value={a.id}>
                      {a.account_code ? `${a.account_code} - ` : ''}{a.name} ({a.root_type})
                    </option>
                  ))}
              </select>
              <div className="text-[11px] text-slate-500">
                Default purchase account for bills. If left empty, uses standard classification account.
              </div>
            </div>
          </div>

          {/* Fixed Asset Specific Configuration Block */}
          {(formData.accounting_treatment === 'FIXED_ASSET' || formData.gl_classification === 'FIXED_ASSET') && (
            <div className="mt-4 rounded-xl border border-purple-200 bg-purple-50/40 p-4 space-y-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-4.5 w-4.5 text-purple-700" />
                <span className="text-xs font-bold uppercase tracking-wider text-purple-900">
                  Fixed Asset Register Configuration
                </span>
                <span className="rounded bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-800">
                  Capital Expenditure
                </span>
              </div>
              <p className="text-xs text-purple-700 leading-relaxed">
                When purchased on a Purchase Bill, this item is debited to Fixed Assets (no dynamic CoA accounts created) and auto-registers a tracked asset in the Fixed Asset Register.
              </p>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-purple-900">Asset Category *</label>
                  <select
                    className={selectField}
                    value={formData.asset_category_id || ''}
                    onChange={(e) => {
                      const catId = e.target.value || null;
                      handleChange('asset_category_id', catId);
                      if (catId) {
                        const cat = assetCategories.find((c: any) => c.id === catId);
                        if (cat) {
                          if (cat.gl_account_id) handleChange('fixed_asset_account_id', cat.gl_account_id);
                          if (cat.useful_life_years) handleChange('useful_life_years', String(cat.useful_life_years));
                        }
                      }
                    }}
                  >
                    <option value="">Select Asset Category...</option>
                    {assetCategories.map((cat: any) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-purple-900">Asset Account (GL)</label>
                  <select
                    className={selectField}
                    value={formData.fixed_asset_account_id || ''}
                    onChange={(e) => handleChange('fixed_asset_account_id', e.target.value || null)}
                  >
                    <option value="">Auto from Category / 1610</option>
                    {accounts
                      .filter((a: any) => a.root_type === 'Asset' && (a.account_code?.startsWith('16') || a.name?.toLowerCase().includes('equipment') || a.name?.toLowerCase().includes('machinery') || a.name?.toLowerCase().includes('asset') || a.name?.toLowerCase().includes('furniture') || a.name?.toLowerCase().includes('vehicle')))
                      .map((a: any) => (
                        <option key={a.id} value={a.id}>
                          {a.account_code ? `${a.account_code} - ` : ''}{a.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-purple-900">Useful Life (Years)</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    step="0.5"
                    className={selectField}
                    value={formData.useful_life_years || ''}
                    onChange={(e) => handleChange('useful_life_years', e.target.value)}
                    placeholder="e.g. 5"
                  />
                </div>
              </div>
            </div>
          )}
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

      {/* Row: 5. Commercial / Pricing + 4. Discount Category — two-column */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CommercialSection
          formData={formData}
          onChange={handleChange}
          usesVariant={formData.uses_variant}
        />
        <EditorSection color="blue" title="Discount Category" description="Choose a discount category for this item (used in quotations).">
          <div className="space-y-3">
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
      </div>

      {/* Warranty & Serial Tracking */}
      <EditorSection color="orange" title="Warranty & Serial Tracking" description="Configure warranty and serial number tracking for this item.">
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div>
              <div className="text-sm font-semibold text-slate-900">Has Warranty</div>
              <div className="text-xs text-slate-500 mt-1">Enable warranty tracking for this item</div>
            </div>
            <Switch
              size="default"
              checked={formData.has_warranty}
              onCheckedChange={(checked) => handleChange('has_warranty', checked)}
              className="data-checked:border-[#F97316] data-checked:bg-[#F97316]"
            />
          </div>

          {formData.has_warranty && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 pl-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700">Warranty Period *</label>
                <input
                  type="number"
                  className={selectField}
                  value={formData.warranty_period}
                  onChange={(e) => handleChange('warranty_period', e.target.value)}
                  placeholder="e.g. 12"
                  min="1"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700">Unit</label>
                <select
                  className={selectField}
                  value={formData.warranty_unit}
                  onChange={(e) => handleChange('warranty_unit', e.target.value)}
                >
                  <option value="months">Months</option>
                  <option value="years">Years</option>
                </select>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div>
              <div className="text-sm font-semibold text-slate-900">Has Serial Numbers</div>
              <div className="text-xs text-slate-500 mt-1">Track individual units by serial number</div>
            </div>
            <Switch
              size="default"
              checked={formData.has_serial_number}
              onCheckedChange={(checked) => handleChange('has_serial_number', checked)}
              className="data-checked:border-[#F97316] data-checked:bg-[#F97316]"
            />
          </div>

          {formData.has_serial_number && (
            <div className="space-y-2 pl-2">
              <label className="text-xs font-semibold text-slate-700">Serial Number Format (Optional)</label>
              <input
                type="text"
                className={selectField}
                value={formData.serial_number_format}
                onChange={(e) => handleChange('serial_number_format', e.target.value)}
                placeholder="e.g. SN-{YYYY}-{####}"
              />
              <div className="text-xs text-slate-500">Use {'{YYYY}'} for year, {'{####}'} for sequential number. Leave blank for free-form entry.</div>
            </div>
          )}
        </div>
      </EditorSection>

      {/* Row: 8. Variant Pricing + Inventory — two-column */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <VariantPricingSection
          number={8}
          variantPricing={variantPricing}
          variants={variants}
          usesVariant={formData.uses_variant}
          onToggleVariant={onUsesVariantChange}
          onAddRow={onAddVariantRow}
          onRemoveRow={onRemoveVariantRow}
          onRowChange={onVariantRowChange}
          subtitle="Map this item to preferred vendors and set vendor-specific rates."
        />
        <InventorySection
          color="teal"
          trackInventory={formData.track_inventory}
          warehouseStock={warehouseStock}
          warehouses={warehouses}
          usesVariant={formData.uses_variant}
          stockCombos={variantStockCombos(variantPricing)}
          variantNameById={Object.fromEntries(variants.map(v => [v.id, v.variant_name]))}
          onToggleInventory={onToggleInventory}
          onStockChange={onStockChange}
        />
      </div>

      {/* 9. Purchase & Vendor Mapping */}
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
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#FFFFFF', overflow: 'hidden' }}>
        {/* Top Bar with Breadcrumb + Actions */}
        <div style={{
          flexShrink: 0,
          background: '#FFFFFF',
          borderBottom: '1px solid #E5E7EB',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          zIndex: 2,
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
              <Button variant="default" size="sm" type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366F1', fontSize: '13px', padding: 0, fontFamily: 'inherit' }}>Store</Button>
              <span>/</span>
              <Button variant="default" size="sm" type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366F1', fontSize: '13px', padding: 0, fontFamily: 'inherit' }}>Materials</Button>
              <span>/</span>
              <Button variant="default" size="sm" type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366F1', fontSize: '13px', padding: 0, fontFamily: 'inherit' }}>Items</Button>
              <span>/</span>
              <span style={{ color: '#111827', fontWeight: 600 }}>{editingMaterial ? 'Edit Item' : 'Add New Material'}</span>
            </nav>
            <div style={{ flex: 1 }} />
            {/* Action buttons in top-right */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <Button type="button" variant="outline" className={secondaryButton} onClick={onClose} disabled={materialSavePending}>
                Cancel
              </Button>
              <Button variant="default" size="sm" type="button" onClick={handleSubmit} disabled={materialSavePending} className={secondaryButton} >
                <FileText className="h-4 w-4" />
                Save Draft
              </Button>
              <Button type="button" variant="default" className={primaryButton} onClick={handleSubmit} disabled={materialSavePending}>
                <Save className="h-4 w-4" />
                {saveLabel}
              </Button>
            </div>
          </div>
        </div>

        {/* Page container: max 1450px, centered */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: 1450, width: '100%', margin: '0 auto', padding: '12px 32px 48px', boxSizing: 'border-box' }}>
          {/* Page Title */}
          <div style={{ padding: '8px 0 16px' }}>
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
            <Button variant="default" size="icon-xs" type="button" onClick={onClose} aria-label="Close">
              {'\u00D7'}
            </Button>
          </div>
        </div>

        <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '20px', background: '#F8FAFC' }}>
          {formBody}
        </div>

        <div style={{ position: 'sticky', bottom: 0, zIndex: 10, display: 'flex', gap: '12px', padding: '16px 24px', borderTop: '1px solid #E5E7EB', background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(12px)', flexShrink: 0 }}>
          <Button variant="default" size="sm" type="button" className={secondaryButton} style={{ flex: 1 }} onClick={onClose} disabled={materialSavePending}>
            Cancel
          </Button>
          <Button type="button" variant="default" className={primaryButton} style={{ flex: 1 }} onClick={handleSubmit} disabled={materialSavePending}>
            {saveLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
