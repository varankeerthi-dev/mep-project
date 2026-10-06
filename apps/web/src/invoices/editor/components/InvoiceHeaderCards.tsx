import { Briefcase, FileText, User } from 'lucide-react';
import type { UseFormReturn } from 'react-hook-form';
import { ArcPricingStatusBadge, ArcPricingToggle } from '@/components/ArcPricingToggle';
import {
  CustomDatePicker,
  HeaderCard,
  HeaderField,
  HeaderFormGrid,
  sharedStyles,
} from '@/components/document-editor';
import type {
  ClientShippingAddress,
  InvoiceClientOption,
  InvoiceEditorFormValues,
} from '../../ui-utils';

export function fieldErrorMessage(error: any): string | undefined {
  return typeof error?.message === 'string' ? error.message : undefined;
}

interface InvoiceHeaderCardsProps {
  form: UseFormReturn<InvoiceEditorFormValues>;
  errors: Record<string, any>;
  clients: InvoiceClientOption[];
  selectedClient: InvoiceClientOption | null;
  selectedClientAddress: string;
  selectedClientState: string | null | undefined;
  templates: { id: string; name: string }[];
  warehouses: { id: string; name: string }[];
  variantRows: any[];
  shippingAddresses: ClientShippingAddress[];
  invoiceNo: string;
  disableShipping: boolean;
  headerDiscounts: Record<string, number>;
  onDiscountInputChange: (variantId: string, value: number) => void;
  onHeaderDiscountChange: (variantId: string, value: number) => void;
  arcPricing: {
    enabled: boolean;
    map: Record<string, any>;
    totalItems: number;
    clientId?: string;
    onToggle: (enabled: boolean) => void;
  };
  onOpenAddShipping: () => void;
}

/**
 * The 3-column invoice header (Client / Document / Project & Pricing) as
 * HeaderCard composition, shared by the V2 invoice editor page.
 */
export function InvoiceHeaderCards(props: InvoiceHeaderCardsProps) {
  const {
    form,
    errors,
    clients,
    selectedClient,
    selectedClientAddress,
    selectedClientState,
    templates,
    warehouses,
    variantRows,
    shippingAddresses,
    invoiceNo,
    disableShipping,
    headerDiscounts,
    onDiscountInputChange,
    onHeaderDiscountChange,
    arcPricing,
    onOpenAddShipping,
  } = props;

  const { register, setValue, watch } = form;

  return (
    <HeaderFormGrid columns={3}>
      {/* Card 1: Client */}
      <HeaderCard icon={<User size={14} style={{ color: '#2563eb' }} />} title="Client">
        <HeaderField label="Client" required labelWidth="100px">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
            <select
              className="form-select"
              style={sharedStyles.inputStyle}
              {...register('client_id')}
            >
              <option value="">Select client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
            {errors.client_id && (
              <span style={{ fontSize: '10px', color: '#dc2626', fontWeight: 500 }}>
                {fieldErrorMessage(errors.client_id)}
              </span>
            )}
          </div>
        </HeaderField>

        <HeaderField label="GSTIN" labelWidth="100px">
          <input
            type="text"
            className="form-input"
            style={{ ...sharedStyles.inputStyle, background: '#f3f4f6' }}
            value={selectedClient?.gst_number || 'N/A'}
            readOnly
            placeholder="Client GSTIN"
          />
        </HeaderField>

        <HeaderField label="Contact" labelWidth="100px">
          <input
            type="text"
            className="form-input"
            style={{ ...sharedStyles.inputStyle, background: '#f3f4f6' }}
            value={selectedClient?.contact || selectedClient?.email || 'N/A'}
            readOnly
            placeholder="Client contact"
          />
        </HeaderField>

        <HeaderField label="Address" labelWidth="100px">
          <div
            style={{
              ...sharedStyles.inputStyle,
              minHeight: '32px',
              background: '#f3f4f6',
              whiteSpace: 'pre-wrap',
              lineHeight: 1.4,
            }}
          >
            {selectedClientAddress || 'Auto-populated from client'}
          </div>
        </HeaderField>

        <HeaderField label="Shipping" labelWidth="100px">
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <select
              className="form-select"
              style={{ ...sharedStyles.inputStyle, flex: 1 }}
              {...register('shipping_address_id')}
              disabled={disableShipping}
            >
              <option value="">Select shipping address</option>
              {shippingAddresses.map((address) => (
                <option key={address.id} value={address.id}>
                  {[address.address_line1, address.city, address.state].filter(Boolean).join(', ')}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md border border-zinc-200 bg-white px-2 py-1 text-zinc-600 hover:bg-zinc-50"
              onClick={onOpenAddShipping}
              disabled={disableShipping}
              title="Add shipping address"
            >
              +
            </button>
          </div>
        </HeaderField>

        <HeaderField label="State" labelWidth="100px">
          <input
            type="text"
            className="form-input"
            style={{ ...sharedStyles.inputStyle, background: '#f3f4f6' }}
            value={selectedClientState || 'N/A'}
            readOnly
            placeholder="Client state"
          />
        </HeaderField>

        <HeaderField label="Source" labelWidth="100px">
          <select
            className="form-select"
            style={sharedStyles.inputStyle}
            {...register('source_type')}
          >
            <option value="direct">Direct</option>
            <option value="quotation">Quotation</option>
            <option value="challan">Challan</option>
            <option value="po">PO</option>
            {/*
              'proforma' is deliberately absent. It is not a legal source_type:
              the database CHECK constraint `invoices_source_type_check` allows
              only quotation/challan/po/direct, and InvoiceEditorSchema validates
              against the same enum. The conversion path already maps a proforma
              to source_type 'quotation' (conversions/api.ts transformProformaToInvoice)
              and records the lineage in invoices.proforma_id instead. Offering the
              option made the form unsavable, and the option loader's catch-all
              quietly listed client POs in its place.
            */}
          </select>
        </HeaderField>

        {arcPricing.clientId && (
          <HeaderField label="" labelWidth="100px" last>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <ArcPricingToggle
                clientId={arcPricing.clientId}
                enabled={arcPricing.enabled}
                onChange={arcPricing.onToggle}
              />
              <ArcPricingStatusBadge
                totalItems={arcPricing.totalItems}
                itemsWithArcRate={Object.values(arcPricing.map).filter(Boolean).length}
                itemsWithoutArcRate={arcPricing.totalItems - Object.values(arcPricing.map).filter(Boolean).length}
              />
            </div>
          </HeaderField>
        )}
      </HeaderCard>

      {/* Card 2: Document */}
      <HeaderCard icon={<FileText size={14} style={{ color: '#2563eb' }} />} title="Document">
        <HeaderField label="Invoice No" labelWidth="100px">
          <div style={{ ...sharedStyles.staticFieldStyle, background: '#f3f4f6' }}>
            {invoiceNo || 'Auto-generating...'}
          </div>
        </HeaderField>

        <HeaderField label="Invoice Date" required labelWidth="100px">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
            <CustomDatePicker
              value={watch('invoice_date') || ''}
              onChange={(val) => setValue('invoice_date', val, { shouldDirty: true })}
              inputStyle={sharedStyles.inputStyle}
            />
            {errors.invoice_date && (
              <span style={{ fontSize: '10px', color: '#dc2626', fontWeight: 500 }}>
                {fieldErrorMessage(errors.invoice_date)}
              </span>
            )}
          </div>
        </HeaderField>

        <HeaderField label="Due Date" labelWidth="100px">
          <CustomDatePicker
            value={(watch as any)('due_date') || ''}
            onChange={(val) => (setValue as any)('due_date', val, { shouldDirty: true })}
            inputStyle={sharedStyles.inputStyle}
          />
        </HeaderField>

        <HeaderField label="Template" labelWidth="100px">
          <select
            className="form-select"
            style={sharedStyles.inputStyle}
            {...register('template_id')}
          >
            <option value="">Select template</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>{template.name}</option>
            ))}
          </select>
        </HeaderField>

        <HeaderField label="Prepared By" labelWidth="100px" last>
          <input
            type="text"
            className="form-input"
            style={sharedStyles.inputStyle}
            {...register('prepared_by')}
            placeholder="Name"
          />
        </HeaderField>
      </HeaderCard>

      {/* Card 3: Project & Pricing */}
      <HeaderCard icon={<Briefcase size={14} style={{ color: '#2563eb' }} />} title="Project & Pricing">
        <HeaderField label="Mode" labelWidth="100px">
          <select
            className="form-select"
            style={sharedStyles.inputStyle}
            {...register('mode')}
          >
            <option value="itemized">Itemized</option>
            <option value="lot">Lot</option>
          </select>
        </HeaderField>

        <HeaderField label="Warehouse" labelWidth="100px">
          <select
            className="form-select"
            style={sharedStyles.inputStyle}
            {...register('default_warehouse_id')}
          >
            <option value="">Select warehouse</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
            ))}
          </select>
        </HeaderField>

        <HeaderField label="PO Number" labelWidth="100px">
          <input
            type="text"
            className="form-input"
            style={sharedStyles.inputStyle}
            {...register('po_number')}
            placeholder="PO number"
          />
        </HeaderField>

        <HeaderField label="PO Date" labelWidth="100px">
          <CustomDatePicker
            value={watch('po_date') || ''}
            onChange={(val) => setValue('po_date', val, { shouldDirty: true })}
            inputStyle={sharedStyles.inputStyle}
          />
        </HeaderField>

        <HeaderField label="Discounts" labelWidth="100px" last>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {variantRows.length > 0 ? variantRows.map((variant: any) => (
              <div key={variant.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #e5e5e5', background: '#fff', borderRadius: '4px', height: '30px' }}>
                <div style={{ padding: '0 6px', flex: 1, borderLeft: '2px solid #3b82f6', height: '100%', display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#1d4ed8' }}>
                    {variant.variant_name}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', height: '100%', borderLeft: '1px solid #e5e5e5' }}>
                  <input
                    type="number"
                    style={{ width: '48px', padding: '0 4px', textAlign: 'right', fontSize: '10px', fontWeight: 700, color: '#1d4ed8', border: 'none', background: 'transparent', height: '100%', outline: 'none' }}
                    value={headerDiscounts[variant.id] || 0}
                    onChange={(e) => {
                      const val = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0));
                      onDiscountInputChange(variant.id, val);
                    }}
                    onBlur={(e) => {
                      const val = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0));
                      onHeaderDiscountChange(variant.id, val);
                    }}
                    min="0" max="100" step="0.01"
                  />
                  <span style={{ padding: '0 4px', fontSize: '10px', fontWeight: 700, color: '#2563eb', borderLeft: '1px solid #e5e5e5', height: '100%', display: 'flex', alignItems: 'center' }}>%</span>
                </div>
              </div>
            )) : (
              <div style={{ fontSize: '10px', color: '#737373', fontStyle: 'italic', padding: '4px' }}>
                No categories
              </div>
            )}
          </div>
        </HeaderField>
      </HeaderCard>
    </HeaderFormGrid>
  );
}