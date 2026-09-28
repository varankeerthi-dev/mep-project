import { z } from 'zod';
import type { Invoice, InvoiceInput, InvoiceItem, InvoiceMaterial } from './schemas';
import { invoiceModes, invoiceSourceTypes, invoiceStatuses, invoiceTemplateTypes } from './types';
import type { InvoiceTemplateRecord, InvoiceWithRelations } from './api';

export const DEFAULT_COMPANY_STATE = 'Maharashtra';

const CustomValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

// Form writers (conversion hydration, PO/quotation/proforma line import) store
// `null` (and selects emit `''`) for empty optionals — coerce those to
// `undefined` so `.optional()` / `.uuid()` fields validate cleanly.
const emptyToUndefined = (val: unknown) => (val === null || val === '' ? undefined : val);

export const InvoiceEditorItemSchema = z.object({
  description: z.string().trim().min(1, 'Description is required.'),
  hsn_code: z.string().trim().nullable().optional(),
  qty: z.coerce.number().min(0, 'Qty cannot be negative.'),
  rate: z.coerce.number().min(0, 'Rate cannot be negative.'),
  amount: z.coerce.number().min(0).default(0),
  discount_percent: z.coerce.number().min(0).max(100).optional().default(0),
  is_header: z.boolean().optional(),
  is_subtotal: z.boolean().optional(),
  subtotal_label: z.string().trim().min(1).nullable().optional(),
  display_order: z.coerce.number().int().optional(),
  custom1: z.string().trim().nullable().optional(),
  custom2: z.string().trim().nullable().optional(),
  meta_json: z.object({
    tax_percent: z.coerce.number().optional().default(18),
    uom: z.string().optional().default('Nos'),
    make: z.string().nullish(),
    variant: z.string().nullish(),
    base_rate: z.coerce.number().optional(),
    rate_after_discount: z.coerce.number().optional(),
    client_custom_label: z.string().optional(),
    client_custom_value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
    material_id: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
    warehouse_id: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
    variant_id: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
    is_service: z.boolean().optional(),
    batch_no: z.string().optional(),
    expiry_date: z.string().optional(),
    serial_numbers: z.array(z.string()).optional(),
  }).catchall(z.unknown()).optional().default({ tax_percent: 18, uom: 'Nos' }),
}).superRefine((item, ctx) => {
  if (!item.is_header && !item.is_subtotal && !(item.qty > 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['qty'],
      message: 'Qty must be greater than zero.',
    });
  }
});

export const InvoiceEditorMaterialSchema = z.object({
  product_id: z.string().uuid('Product is required.'),
  qty_used: z.coerce.number().positive('Qty used must be greater than zero.'),
  warehouse_id: z.preprocess(emptyToUndefined, z.string().uuid().nullable().optional()),
  variant_id: z.preprocess(emptyToUndefined, z.string().uuid().nullable().optional()),
  description: z.string().optional(),
});

export const InvoiceEditorSchema = z
  .object({
    client_id: z.string().uuid('Client is required.'),
    template_id: z.preprocess(
      (val) => (val === '' ? null : val),
      z.string().uuid('Template is required.').nullable().optional()
    ),
    invoice_no: z.preprocess(emptyToUndefined, z.string().optional()),
    invoice_date: z.string().optional(),
    po_number: z.preprocess(emptyToUndefined, z.string().optional()),
    po_date: z.preprocess(emptyToUndefined, z.string().optional()),
    prepared_by: z.preprocess(emptyToUndefined, z.string().optional()),
    remarks: z.string().optional(),
    authorized_signatory_id: z.preprocess(
      (val) => (val === '' ? null : val),
      z.string().uuid().nullable().optional()
    ),
    terms_text: z.string().optional(),
    terms_template_id: z.preprocess(
      (val) => (val === '' ? null : val),
      z.string().uuid().nullable().optional()
    ),
    source_type: z.enum(invoiceSourceTypes),
    source_id: z.string().uuid('Source document is required.').optional().or(z.literal('')),
    template_type: z.enum(invoiceTemplateTypes),
    mode: z.enum(invoiceModes),
    status: z.enum(invoiceStatuses),
    company_state: z.string().trim().min(1, 'Company state is required.'),
    client_state: z.preprocess(
      (val) => (val === '' ? null : val),
      z.string().trim().nullable().optional()
    ),
    shipping_address_id: z.preprocess(
      (val) => (val === '' ? null : val),
      z.string().uuid().nullable().optional()
    ),
    default_warehouse_id: z.preprocess(
      (val) => (val === '' ? null : val),
      z.string().uuid().nullable().optional()
    ),
    deduct_stock_on_finalize: z.boolean().optional().default(false),
    allow_insufficient_stock: z.boolean().optional().default(false),
    items: z.array(InvoiceEditorItemSchema).min(1, 'At least one line item is required.').optional(),
    materials: z.array(InvoiceEditorMaterialSchema).default([]),
  })
  .superRefine((value, ctx) => {
    // Skip items length validation for PO-based invoices
    const isPOBased = value.source_type === 'po';
    
    if (value.mode === 'lot' && value.items.length !== 1 && !isPOBased) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['items'],
        message: 'Lot invoices must contain exactly one line item.',
      });
    }
    
    if (value.mode !== 'lot' && value.materials.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['materials'],
        message: 'Materials are only used in lot mode.',
      });
    }
    
    // Ensure PO-based invoices have at least one item
    if (isPOBased && value.items.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['items'],
        message: 'PO-based invoices must have at least one line item.',
      });
    }
    
    // For non-PO invoices, ensure at least one item
    if (!isPOBased && value.items.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['items'],
        message: 'At least one line item is required.',
      });
    }

    if (value.source_type !== 'direct' && !value.source_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['source_id'],
        message: 'Source document is required.',
      });
    }

    if (value.status === 'final' && !value.invoice_no) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['invoice_no'],
        message: 'Invoice number is required for final invoices.',
      });
    }
  });

export type InvoiceEditorFormValues = z.infer<typeof InvoiceEditorSchema>;
export type InvoiceClientOption = {
  id: string;
  name: string;
  state: string | null;
  gst_number: string | null;
  contact?: string | null;
  email?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  pincode?: string | null;
  default_template_id: string | null;
  discount_type: string | null;
  standard_pricelist_id: string | null;
  custom_discounts: Record<string, number>;
  discount_profile_id: string | null;
};

export type MaterialVariant = {
  variant_id?: string | null;
  variant_name: string | null;
  make: string;
  sale_price: number;
};

export type InvoiceMaterialOption = {
  id: string;
  name: string;
  display_name: string | null;
  hsn_code: string | null;
  make: string | null;
  unit: string | null;
  sale_price: number | null;
  item_type: string;
  item_classification?: string;
  discount_category_id?: string | null;
  variants: MaterialVariant[];
  material_units?: { unit_name: string; conversion_factor: number }[];
};

export type InvoiceSourceOption = {
  id: string;
  label: string;
  sublabel: string;
  po_total_value?: number;
  po_available_value?: number;
};

export type ClientShippingAddress = {
  id: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  pincode: string;
  contact_person: string | null;
  contact_phone: string | null;
  is_default: boolean;
};

export function round2(value: number): number {
  return Number((Number.isFinite(value) ? value : 0).toFixed(2));
}

export function normalizeState(value?: string | null): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function isInterstateStates(companyState?: string | null, clientState?: string | null): boolean {
  if (!companyState || !clientState) return false;
  return normalizeState(companyState) !== normalizeState(clientState);
}

export function createEmptyItem(overrides: any = {}): InvoiceEditorFormValues['items'][number] {
  const meta = overrides.meta_json as Record<string, unknown> | undefined;
  return {
    description: overrides.description ?? '',
    hsn_code: overrides.hsn_code ?? '',
    qty: overrides.qty ?? 1,
    rate: overrides.rate ?? 0,
    amount: overrides.amount ?? 0,
    discount_percent: overrides.discount_percent ?? 0,
    is_header: overrides.is_header ?? false,
    is_subtotal: overrides.is_subtotal ?? false,
    subtotal_label: overrides.subtotal_label ?? null,
    display_order: overrides.display_order ?? 0,
    custom1: overrides.custom1 ?? null,
    custom2: overrides.custom2 ?? null,
    meta_json: {
      tax_percent: Number(meta?.tax_percent) || 18,
      uom: String(meta?.uom || 'Nos'),
      make: meta?.make as string | undefined,
      variant: meta?.variant as string | undefined,
      base_rate: meta?.base_rate as number | undefined,
      material_id: meta?.material_id as string | undefined,
      warehouse_id: meta?.warehouse_id as string | undefined,
      variant_id: meta?.variant_id as string | undefined,
      is_service: meta?.is_service as boolean | undefined,
    },
  };
}

export function createLotItem(description = 'As per PO'): InvoiceEditorFormValues['items'][number] {
  return createEmptyItem({
    description,
    qty: 1,
    rate: 0,
    amount: 0,
  });
}

export function createEmptyMaterial(
  overrides: Partial<InvoiceEditorFormValues['materials'][number]> = {},
): InvoiceEditorFormValues['materials'][number] {
  return {
    product_id: overrides.product_id ?? '',
    qty_used: overrides.qty_used ?? 1,
    warehouse_id: overrides.warehouse_id ?? null,
    variant_id: overrides.variant_id ?? null,
    description: overrides.description ?? '',
  };
}

export function createEmptyInvoiceFormValues(companyState?: string | null): InvoiceEditorFormValues {
  const today = new Date().toISOString().split('T')[0];
  return {
    client_id: '',
    template_id: null,
    invoice_no: '',
    invoice_date: today,
    po_number: '',
    po_date: '',
    source_type: 'direct',
    source_id: '',
    template_type: 'standard',
    mode: 'itemized',
    status: 'draft',
    company_state: companyState || DEFAULT_COMPANY_STATE,
    client_state: null,
    shipping_address_id: null,
    default_warehouse_id: null,
    deduct_stock_on_finalize: false,
    allow_insufficient_stock: false,
    remarks: '',
    authorized_signatory_id: null,
    terms_text: '',
    terms_template_id: null,
    items: [createEmptyItem()],
    materials: [],
  };
}

export function invoiceToFormValues(invoice: InvoiceWithRelations): InvoiceEditorFormValues {
  return {
    client_id: invoice.client_id,
    template_id: invoice.template_id ?? null,
    invoice_no: invoice.invoice_no ?? '',
    invoice_date: invoice.invoice_date ?? new Date().toISOString().split('T')[0],
    po_number: invoice.po_number ?? '',
    po_date: invoice.po_date ?? '',
    source_type: invoice.source_type,
    source_id: invoice.source_id ?? '',
    template_type: invoice.template_type,
    mode: invoice.mode,
    status: invoice.status,
    prepared_by: invoice.prepared_by ?? '',
    company_state: invoice.company_state ?? DEFAULT_COMPANY_STATE,
    client_state: invoice.client_state ?? null,
    default_warehouse_id: null,
    deduct_stock_on_finalize: false,
    allow_insufficient_stock: false,
    remarks: invoice.remarks ?? '',
    authorized_signatory_id: invoice.authorized_signatory_id ?? null,
    terms_text: '',
    terms_template_id: null,
    items: invoice.items.map((item: any) => ({
      description: item.description,
      hsn_code: item.hsn_code ?? '',
      qty: item.qty,
      rate: item.rate,
      amount: item.amount,
      discount_percent: 0,
      is_header: item.is_header ?? false,
      is_subtotal: item.is_subtotal ?? false,
      subtotal_label: item.subtotal_label ?? null,
      display_order: item.display_order ?? 0,
      custom1: item.custom1 ?? null,
      custom2: item.custom2 ?? null,
      meta_json: {
        tax_percent: item.meta_json?.tax_percent ?? 18,
        uom: item.meta_json?.uom ?? 'Nos',
        make: item.meta_json?.make,
        variant: item.meta_json?.variant,
        base_rate: item.rate,
        material_id: item.meta_json?.material_id,
        warehouse_id: item.meta_json?.warehouse_id,
        variant_id: item.meta_json?.variant_id,
        is_service: item.meta_json?.is_service,
      },
    })),
    materials: invoice.materials.map((material) => createEmptyMaterial(material)),
  };
}

export function composeInvoiceInput(
  values: InvoiceEditorFormValues,
  totals: Pick<Invoice, 'subtotal' | 'cgst' | 'sgst' | 'igst' | 'total'>,
): InvoiceInput {
  const effectiveSourceId = values.source_type === 'direct' ? null : values.source_id;
  
  return {
    client_id: values.client_id,
    template_id: values.template_id ?? null,
    invoice_no: values.invoice_no || null,
    invoice_date: values.invoice_date || null,
    po_number: values.po_number || null,
    po_date: values.po_date || null,
    source_type: values.source_type,
    source_id: effectiveSourceId,
    template_type: values.template_type,
    mode: values.mode,
    subtotal: totals.subtotal,
    cgst: totals.cgst,
    sgst: totals.sgst,
    igst: totals.igst,
    total: totals.total,
    status: values.status,
    prepared_by: values.prepared_by || null,
    remarks: values.remarks?.trim() ? values.remarks.trim() : null,
    authorized_signatory_id: values.authorized_signatory_id ?? null,
    company_state: values.company_state,
    client_state: values.client_state ?? null,
    items: values.items.map((item, index) => {
      const baseRate = Number(item.meta_json?.base_rate) || Number(item.rate) || 0;
      const discountPercent = Number(item.discount_percent) || 0;
      const rateAfterDiscount = baseRate - (baseRate * discountPercent / 100);
      const meta = item.meta_json as any;
      
      return {
        description: item.description.trim(),
        hsn_code: item.hsn_code?.trim() ? item.hsn_code.trim() : null,
        qty: round2(item.qty),
        rate: round2(rateAfterDiscount),
        amount: round2(item.qty * rateAfterDiscount),
        is_header: item.is_header ?? false,
        is_subtotal: item.is_subtotal ?? false,
        subtotal_label: item.subtotal_label ?? null,
        display_order: index,
        custom1: item.custom1 ?? null,
        custom2: item.custom2 ?? null,
        meta_json: {
          tax_percent: Number(meta?.tax_percent) || 18,
          uom: String(meta?.uom || 'Nos'),
          make: meta?.make,
          variant: meta?.variant,
          base_rate: baseRate,
          discount_percent: discountPercent,
          material_id: meta?.material_id,
          variant_id: meta?.variant_id,
          warehouse_id: meta?.warehouse_id,
          is_service: meta?.is_service,
        },
      };
    }),
    materials: values.materials.map((material) => ({
      product_id: material.product_id,
      qty_used: round2(material.qty_used),
      warehouse_id: material.warehouse_id,
      variant_id: material.variant_id ?? null,
    })),
  } as InvoiceInput;
}

export function formatCurrency(value?: number | null): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

/**
 * Flatten stored terms content (free `{text}` or full template
 * `{sections: [{title, items: [{content}]}]}`) into textarea text.
 */
export function flattenInvoiceTermsText(customContent: unknown): string {
  if (!customContent) return '';
  if (typeof customContent === 'string') {
    try {
      return flattenInvoiceTermsText(JSON.parse(customContent));
    } catch {
      return customContent;
    }
  }
  if (typeof customContent !== 'object') return String(customContent);
  const content = customContent as { text?: unknown; sections?: unknown };
  if (typeof content.text === 'string' && content.text.trim()) return content.text;
  if (!Array.isArray(content.sections)) return '';
  const lines: string[] = [];
  content.sections.forEach((section: any) => {
    if (section?.title) lines.push(String(section.title));
    (Array.isArray(section?.items) ? section.items : []).forEach((item: any) => {
      if (item?.content) lines.push(`- ${String(item.content)}`);
    });
  });
  return lines.join('\n');
}

export function formatDate(value?: string | null): string {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function getInvoiceDisplayNumber(invoice: Pick<InvoiceWithRelations, 'id' | 'created_at'>): string {
  const shortId = (invoice.id ?? '').replace(/-/g, '').slice(0, 8).toUpperCase();
  const date = invoice.created_at ? new Date(invoice.created_at) : new Date();
  const year = String(date.getFullYear()).slice(-2);
  return `INV-${year}-${shortId || 'DRAFT'}`;
}

export function getTemplateExtraColumnLabel(
  template: InvoiceTemplateRecord | null | undefined,
  items: InvoiceEditorFormValues['items'],
): string {
  const fromTemplate = template?.layout_json?.extra_column_label;
  if (typeof fromTemplate === 'string' && fromTemplate.trim()) {
    return fromTemplate.trim();
  }

  const fromItem = items.find((item) => typeof item.meta_json?.client_custom_label === 'string')
    ?.meta_json?.client_custom_label;

  if (typeof fromItem === 'string' && fromItem.trim()) {
    return fromItem.trim();
  }

  return 'Custom';
}

export function getTemplateTypeFromTemplate(
  template: InvoiceTemplateRecord | null | undefined,
): InvoiceEditorFormValues['template_type'] | null {
  const raw = template?.layout_json?.template_type;
  if (raw === 'standard' || raw === 'lot' || raw === 'client_custom') {
    return raw;
  }
  return null;
}

export function getSourceLabel(value: InvoiceEditorFormValues['source_type']): string {
  if (value === 'quotation') return 'Quotation';
  if (value === 'challan') return 'Delivery Challan';
  if (value === 'direct') return 'Direct';
  return 'Client PO';
}

export function calculateDraftTotals(
  values: Pick<InvoiceEditorFormValues, 'items' | 'company_state' | 'client_state'>,
  enableRoundOff: boolean = false,
) {
  const subtotal = round2(
    values.items.reduce((sum, item) => {
      const baseRate = Number(item.meta_json?.base_rate) || Number(item.rate) || 0;
      const discountPercent = Number(item.discount_percent) || 0;
      const rateAfterDiscount = baseRate - (baseRate * discountPercent / 100);
      return sum + round2((Number(item.qty) || 0) * rateAfterDiscount);
    }, 0),
  );

  const taxTotal = round2(
    values.items.reduce((sum, item) => {
      const baseRate = Number(item.meta_json?.base_rate) || Number(item.rate) || 0;
      const discountPercent = Number(item.discount_percent) || 0;
      const rateAfterDiscount = baseRate - (baseRate * discountPercent / 100);
      const amount = round2((Number(item.qty) || 0) * rateAfterDiscount);
      const taxPercentRaw = item.meta_json?.tax_percent;
      const taxPercent = typeof taxPercentRaw === 'number' ? taxPercentRaw : Number(taxPercentRaw ?? 18);
      return sum + amount * ((Number.isFinite(taxPercent) ? taxPercent : 18) / 100);
    }, 0),
  );

  const interstate = isInterstateStates(values.company_state, values.client_state);
  const cgst = interstate ? 0 : round2(taxTotal / 2);
  const sgst = interstate ? 0 : round2(taxTotal - cgst);
  const igst = interstate ? taxTotal : 0;
  
  const totalBeforeRoundOff = round2(subtotal + taxTotal);
  let roundOff = 0;
  let total = totalBeforeRoundOff;
  
  if (enableRoundOff) {
    const roundedTotal = Math.round(totalBeforeRoundOff);
    roundOff = round2(roundedTotal - totalBeforeRoundOff);
    total = round2(roundedTotal);
  }

  return {
    subtotal,
    cgst,
    sgst,
    igst,
    total,
    interstate,
    roundOff,
  };
}
