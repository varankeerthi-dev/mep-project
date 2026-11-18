import React, { useState, useEffect, useRef } from 'react';
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
import { 
  Boxes, Layers, Wrench, ShoppingCart, Building2, Briefcase, Check, 
  ChevronLeft, Save, FileText, Landmark, Zap, Settings, Plus, Sparkles,
  ArrowRight, ShieldCheck, Tag, Package, HelpCircle
} from 'lucide-react';
import { Switch } from '../../../../components/ui/switch';
import type { 
  MaterialEditorFormData, VariantPricingRow, WarehouseStockMap, 
  VendorMappingRow, ClientMappingRow, ClientPricingRow, ItemTypeConfig 
} from '../../model/aggregates';
import { 
  variantStockCombos, ACCOUNTING_TREATMENT_OPTIONS, getItemTypeConfig, 
  MATERIAL_TYPES 
} from '../../model/aggregates';
import type { Warehouse, Vendor as VendorType, Client, MaterialCustomAttribute, AttributeDefinition } from '../../model/entities';
import { generateItemCode } from '../../lib/generateItemCode';

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

export interface ItemEditorDialogV2Props {
  open: boolean;
  onClose: () => void;
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
  onSaveAndCreateAnother?: (e: any) => void;
  onCategoryCreated?: (newCategory: string) => void;
  unitOptions: { unit_code: string; unit_name: string }[];
  onUnitCreated?: (newUnit: string) => void;
  assetCategories?: any[];
  accounts?: any[];
  onSwitchToClassic?: () => void;
}

export function ItemEditorDialogV2({
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
  onClassificationChange, onSubmit, onSaveAndCreateAnother, onCategoryCreated,
  unitOptions, onUnitCreated,
  assetCategories = [], accounts = [],
  onSwitchToClassic,
}: ItemEditorDialogV2Props) {
  // Mode: 'quick' (simple 4-card path for beginners) vs 'full' (all deep ERP fields for power users)
  const [editorMode, setEditorMode] = useState<'quick' | 'full'>(editingMaterial ? 'full' : 'quick');
  const [activeSection, setActiveSection] = useState<string>('basic');
  const [showAdvancedInQuick, setShowAdvancedInQuick] = useState(false);

  const basicRef = useRef<HTMLDivElement>(null);
  const pricingRef = useRef<HTMLDivElement>(null);
  const inventoryRef = useRef<HTMLDivElement>(null);
  const accountingRef = useRef<HTMLDivElement>(null);
  const technicalRef = useRef<HTMLDivElement>(null);
  const warrantyRef = useRef<HTMLDivElement>(null);
  const clientVendorRef = useRef<HTMLDivElement>(null);

  const scrollTo = (ref: React.RefObject<HTMLDivElement | null>, key: string) => {
    setActiveSection(key);
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const currentType = (formData.item_type as string) === 'standard' ? 'product' : (formData.item_type || 'product');
  const typeConfig = getItemTypeConfig(currentType);

  const handleItemTypeChange = (newType: 'product' | 'service' | 'kit') => {
    const resolvedType = (newType as string) === 'standard' ? 'product' : newType;
    const config = getItemTypeConfig(resolvedType);
    onChange('item_type', resolvedType);

    if (resolvedType === 'service') {
      const needsCodeReset = !formData.item_code || formData.item_code === '' || formData.item_code.startsWith('ITEM-');
      onChange('accounting_treatment', config.defaultAccountingTreatment);
      onChange('item_classification', config.defaultItemClassification);
      onChange('uses_variant', false);
      onChange('track_inventory', false);
      if (needsCodeReset) {
        onChange('item_code', generateItemCode(config.codePrefix));
      }
    } else {
      onChange('accounting_treatment', 'INVENTORY_STOCK');
      onChange('item_classification', 'STOCK_IN_TRADE');
    }
  };

  // Keyboard shortcut listener (Ctrl+S for save, Ctrl+Shift+S for save & another)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (e.shiftKey && onSaveAndCreateAnother) {
          onSaveAndCreateAnother(e);
        } else {
          onSubmit(e);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSubmit, onSaveAndCreateAnother]);

  if (!open) return null;

  const saveLabel = materialSavePending
    ? 'Saving...'
    : (editingMaterial ? 'Update Item' : 'Save Item');

  // Navigation anchors for full mode
  const navItems = [
    { id: 'basic', label: '1. Basic Info', ref: basicRef },
    { id: 'pricing', label: '2. Pricing & Variants', ref: pricingRef },
    { id: 'inventory', label: '3. Inventory', ref: inventoryRef },
    { id: 'accounting', label: '4. Accounting & GL', ref: accountingRef },
    { id: 'technical', label: '5. Technical Specs', ref: technicalRef },
    { id: 'warranty', label: '6. Warranty', ref: warrantyRef },
    { id: 'clients', label: '7. Vendors & Clients', ref: clientVendorRef },
  ];

  const content = (
    <div className="space-y-6">
      {/* Mode Switcher Pill Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-gradient-to-r from-blue-50/70 via-indigo-50/60 to-purple-50/70 rounded-xl border border-blue-100/80 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
              <span>Item Editor Experience V2</span>
              <span className="px-1.5 py-0.2 text-[10px] font-bold bg-blue-100 text-blue-700 rounded-md">New</span>
            </div>
            <p className="text-[11px] text-slate-500">
              {editorMode === 'quick' 
                ? 'Quick Mode: essentials only for fast item entry.' 
                : 'Master Mode: complete ERP master with accounting and vendor/client rates.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <div className="inline-flex p-0.5 bg-white/90 rounded-lg border border-slate-200/90 shadow-2xs">
            <button
              type="button"
              onClick={() => setEditorMode('quick')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                editorMode === 'quick'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Zap className="h-3.5 w-3.5" />
              Quick Add
            </button>
            <button
              type="button"
              onClick={() => setEditorMode('full')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                editorMode === 'full'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Settings className="h-3.5 w-3.5" />
              Complete Master
            </button>
          </div>

          {onSwitchToClassic && (
            <button
              type="button"
              onClick={onSwitchToClassic}
              className="text-[11px] text-slate-500 hover:text-slate-700 underline px-2 py-1"
            >
              Switch to Classic
            </button>
          )}
        </div>
      </div>

      {/* Item Type Selector */}
      <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-xs">
        <label className="block text-xs font-semibold text-slate-700 mb-2">Item Type</label>
        <div className="inline-flex p-1 bg-slate-100 rounded-lg border border-slate-200">
          {(Object.keys(MATERIAL_TYPES) as Array<keyof typeof MATERIAL_TYPES>).map((key) => {
            const typeValue = MATERIAL_TYPES[key].toLowerCase() as MaterialEditorFormData['item_type'];
            const isSelected = currentType === typeValue;
            return (
              <button
                key={typeValue}
                type="button"
                onClick={() => handleItemTypeChange(typeValue)}
                className={`inline-flex items-center px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  isSelected
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {MATERIAL_TYPES[key]}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          {formData.item_type === 'service'
            ? 'Service items skip physical inventory tracking.'
            : formData.item_type === 'kit'
            ? 'Kits bundle multiple materials for Quotations and BOQ.'
            : 'Standard physical item tracked in stock and warehouse inventory.'}
        </p>
      </div>

      {/* Quick Anchor Bar (in full master mode) */}
      {editorMode === 'full' && (
        <div className="sticky top-0 z-10 flex items-center gap-1 overflow-x-auto py-2 px-3 bg-white/95 backdrop-blur-md rounded-xl border border-slate-200/80 shadow-xs">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => scrollTo(item.ref as any, item.id)}
              className={`px-3 py-1 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                activeSection === item.id
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* SECTION 1: Basic Information */}
      <div ref={basicRef}>
        <BasicInformationSection
          color="green"
          formData={formData}
          categoryOptions={categoryOptions}
          unitOptions={unitOptions}
          onChange={onChange}
          onCategoryCreated={onCategoryCreated}
          onUnitCreated={onUnitCreated}
        />
      </div>

      {/* SECTION 2: Pricing & Commercial + Inline Variants */}
      <div ref={pricingRef} className="space-y-4">
        <CommercialSection
          formData={formData}
          onChange={onChange}
          usesVariant={formData.uses_variant}
          hsnLabel={typeConfig.hsnLabel}
        />

        {/* Inline Variant Management */}
        <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-xs font-semibold text-slate-800">Variant Pricing Matrix</div>
              <div className="text-[11px] text-slate-500">Enable when rates vary by size, rating, or manufacturer.</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600 font-medium">{formData.uses_variant ? 'Enabled' : 'Disabled'}</span>
              <Switch
                size="default"
                checked={formData.uses_variant}
                onCheckedChange={onUsesVariantChange}
                className="data-checked:border-blue-600 data-checked:bg-blue-600"
              />
            </div>
          </div>

          {formData.uses_variant && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <VariantPricingSection
                number={undefined as any}
                variantPricing={variantPricing}
                variants={variants}
                usesVariant={formData.uses_variant}
                onToggleVariant={onUsesVariantChange}
                onAddRow={onAddVariantRow}
                onRemoveRow={onRemoveVariantRow}
                onRowChange={onVariantRowChange}
                subtitle="Specify separate purchase and selling rates for each variant and make combination."
              />
            </div>
          )}
        </div>
      </div>

      {/* SECTION 3: Stock & Inventory */}
      <div ref={inventoryRef}>
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

      {/* Progressive Disclosure Toggle in Quick Mode */}
      {editorMode === 'quick' && !showAdvancedInQuick && (
        <div className="p-5 bg-gradient-to-r from-slate-50 to-indigo-50/40 rounded-xl border border-dashed border-slate-300 text-center">
          <h4 className="text-sm font-semibold text-slate-800">Need Advanced Setup?</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-lg mx-auto">
            Standard inventory accounting is applied automatically. Open advanced options to configure General Ledger accounts, technical specifications, warranties, or client-specific rates.
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAdvancedInQuick(true)}
              className="text-xs text-indigo-700 bg-white border-indigo-200 hover:bg-indigo-50 font-semibold"
            >
              Expand Advanced Fields Below
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => setEditorMode('full')}
              className="text-xs font-semibold"
            >
              Switch to Complete Master View
            </Button>
          </div>
        </div>
      )}

      {/* ADVANCED SECTIONS (Rendered in Full Mode or when expanded in Quick Mode) */}
      {(editorMode === 'full' || showAdvancedInQuick) && (
        <>
          {/* SECTION 4: Accounting Treatment & General Ledger */}
          <div ref={accountingRef}>
            <EditorSection
              color="indigo"
              title="Accounting & General Ledger Classification"
              badge="Standard Auto-Assigned"
              description="Governs balance sheet asset vs. profit & loss expense posting on bills and invoices."
              headerActions={
                <div className="flex items-center gap-2">
                  <Switch
                    size="default"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => onChange('is_active', checked)}
                    className="data-checked:border-emerald-600 data-checked:bg-emerald-600"
                  />
                  <span className="text-xs font-medium text-slate-500">Active</span>
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
                      className={`group relative flex min-h-[90px] items-start gap-3 rounded-xl px-4 py-3.5 text-left transition-all ${
                        isSelected
                          ? 'border-2 border-indigo-600 bg-indigo-50/60 shadow-xs'
                          : 'border border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50'
                      }`}
                    >
                      <span
                        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                        style={{ backgroundColor: colors.bg, color: colors.icon }}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-semibold text-slate-900">{opt.label}</div>
                        <div className="mt-1 text-[11px] leading-4 text-slate-500">{opt.desc}</div>
                      </div>
                      <span
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                          isSelected ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Chart of Accounts Overrides */}
              {typeConfig.showAccountingTreatment && (
                <div className="mt-6 border-t border-slate-100 pt-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Landmark className="h-4 w-4 text-indigo-600" />
                    <h4 className="text-[13px] font-semibold text-slate-800">Chart of Accounts Overrides</h4>
                    <span className="text-xs text-slate-400 font-normal">(Optional GL overrides)</span>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700">Sales Income Account</label>
                      <select
                        className={selectField}
                        value={formData.sales_income_account_id || ''}
                        onChange={(e) => onChange('sales_income_account_id', e.target.value || null)}
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
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700">Purchase Account Override</label>
                      <select
                        className={selectField}
                        value={formData.purchase_account_id || ''}
                        onChange={(e) => onChange('purchase_account_id', e.target.value || null)}
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
                    </div>
                  </div>
                </div>
              )}
            </EditorSection>
          </div>

          {/* SECTION 5: Technical Attributes */}
          <div ref={technicalRef}>
            <TechnicalSection
              color="purple"
              customAttributes={customAttributes}
              attributeDefinitions={attributeDefinitions}
              onCustomAttributesChange={onCustomAttributesChange}
              showTechnical={showTechnical}
              onToggleTechnical={onToggleTechnical}
            />
          </div>

          {/* SECTION 6: Warranty & Serial Tracking */}
          {typeConfig.showWarranty && (
            <div ref={warrantyRef}>
              <EditorSection color="orange" title="Warranty & Serial Number Tracking" description="Configure warranty period and individual unit serial number tracking.">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Has Warranty</div>
                      <div className="text-xs text-slate-500 mt-0.5">Enable warranty period tracking for customer support</div>
                    </div>
                    <Switch
                      size="default"
                      checked={formData.has_warranty}
                      onCheckedChange={(checked) => onChange('has_warranty', checked)}
                      className="data-checked:border-amber-500 data-checked:bg-amber-500"
                    />
                  </div>

                  {formData.has_warranty && (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 pl-2">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700">Warranty Period *</label>
                        <input
                          type="number"
                          className={selectField}
                          value={formData.warranty_period}
                          onChange={(e) => onChange('warranty_period', e.target.value)}
                          placeholder="e.g. 12"
                          min="1"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700">Unit</label>
                        <select
                          className={selectField}
                          value={formData.warranty_unit}
                          onChange={(e) => onChange('warranty_unit', e.target.value)}
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
                      <div className="text-xs text-slate-500 mt-0.5">Track individual units on inward and delivery</div>
                    </div>
                    <Switch
                      size="default"
                      checked={formData.has_serial_number}
                      onCheckedChange={(checked) => onChange('has_serial_number', checked)}
                      className="data-checked:border-amber-500 data-checked:bg-amber-500"
                    />
                  </div>
                </div>
              </EditorSection>
            </div>
          )}

          {/* SECTION 7: Vendor & Client Rates */}
          <div ref={clientVendorRef} className="space-y-4">
            {typeConfig.showVendorMapping && (
              <VendorSection
                number={undefined as any}
                vendorMappings={vendorMappings}
                vendors={vendors}
                variants={variants}
                variantPricing={variantPricing}
                onAddRow={onAddVendorRow}
                onRemoveRow={onRemoveVendorRow}
                onRowChange={onVendorRowChange}
              />
            )}

            {typeConfig.showClientMapping && (
              <ClientSection
                number={undefined as any}
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
            )}
          </div>
        </>
      )}
    </div>
  );

  // Full Page Variant
  if (asPage) {
    return (
      <div className="flex flex-col h-full bg-white overflow-hidden">
        {/* Sticky Top Bar */}
        <header className="shrink-0 bg-white border-b border-slate-200 shadow-2xs z-20">
          <div className="flex items-center justify-between gap-3 px-4 sm:px-8 py-3 max-w-[1450px] mx-auto w-full">
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" size="icon" onClick={onClose} aria-label="Back">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 leading-tight">
                  {editingMaterial ? 'Edit Material' : 'Add New Material'}
                </h1>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                  V2 Experience
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={materialSavePending} className={secondaryButton}>
                Cancel
              </Button>

              {onSaveAndCreateAnother && !editingMaterial && (
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={onSaveAndCreateAnother} 
                  disabled={materialSavePending}
                  className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold border-indigo-300 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100/60"
                  title="Save current item and keep category/unit for next entry (Ctrl+Shift+S)"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Save & Add Another
                </Button>
              )}

              <Button type="button" variant="default" className={primaryButton} onClick={onSubmit} disabled={materialSavePending} title="Save Item (Ctrl+S)">
                <Save className="h-4 w-4" />
                {saveLabel}
              </Button>
            </div>
          </div>
        </header>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto bg-slate-50/50">
          <main className="max-w-[1450px] mx-auto p-4 sm:p-8">
            {content}
          </main>
        </div>
      </div>
    );
  }

  // Modal Overlay Variant
  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="modal-content item-modal"
        onClick={e => e.stopPropagation()}
        style={{ width: '94vw', maxWidth: '820px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', background: '#FFFFFF' }}
      >
        <div className="modal-header shrink-0 border-b border-slate-200 px-6 py-4">
          <div className="flex justify-between items-center w-full">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                {editingMaterial ? 'Edit Material' : 'Add New Material'}
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                V2
              </span>
            </div>
            <Button variant="default" size="icon-xs" type="button" onClick={onClose} aria-label="Close">
              {'\u00D7'}
            </Button>
          </div>
        </div>

        <div className="modal-body flex-1 overflow-y-auto p-5 sm:p-6 bg-slate-50/60">
          {content}
        </div>

        <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 p-4 border-t border-slate-200 bg-white/95 backdrop-blur-md shrink-0">
          <Button variant="default" size="sm" type="button" className={secondaryButton} onClick={onClose} disabled={materialSavePending}>
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            {onSaveAndCreateAnother && !editingMaterial && (
              <Button 
                type="button" 
                variant="outline" 
                onClick={onSaveAndCreateAnother} 
                disabled={materialSavePending}
                className="text-xs font-semibold text-indigo-700 border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100/60"
              >
                <Plus className="h-3.5 w-3.5" />
                Save & Add Another
              </Button>
            )}

            <Button type="button" variant="default" className={primaryButton} onClick={onSubmit} disabled={materialSavePending}>
              <Save className="h-4 w-4" />
              {saveLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
export default ItemEditorDialogV2;