import { z } from 'zod';
import type { Invoice, InvoiceInput, InvoiceItem, InvoiceMaterial } from './schemas';
import { invoiceModes, invoiceSourceTypes, invoiceStatuses, invoiceTemplateTypes } from './types';
import type { InvoiceTemplateRecord, InvoiceWithRelations } from './api';

export const DEFAULT_COMPANY_STATE = 'Maharashtra';

const CustomValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const InvoiceEditorItemSchema = z.object({
  description: z.string().trim().min(1, 'Description is required.'),
  hsn_code: z.string().trim().nullable().optional(),
  qty: z.coerce.number().positive('Qty must be greater than zero.'),
  rate: z.coerce.number().min(0, 'Rate cannot be negative.'),
  amount: z.coerce.number().min(0).default(0),
  meta_json: z
    .object({
      tax_percent: z.coerce.number().min(0).max(100).optional(),
      client_custom_label: z.string().trim().optional(),
      client_custom_value: CustomValueSchema.optional(),
    })
    .catchall(z.any())
    .default({}),
});

export const InvoiceEditorMaterialSchema = z.object({
  product_id: z.string().uuid('Product is required.'),
  qty_used: z.coerce.number().positive('Qty used must be greater than zero.'),
});

export const InvoiceEditorSchema = z
  .object({
    client_id: z.string().uuid('Client is required.'),
    template_id: z.string().uuid('Template is required.').nullable().optional(),
    source_type: z.enum(invoiceSourceTypes),
    source_id: z.string().uuid('Source document is required.'),
    template_type: z.enum(invoiceTemplateTypes),
    mode: z.enum(invoiceModes),
    status: z.enum(invoiceStatuses),
    company_state: z.string().trim().min(1, 'Company state is required.'),
    client_state: z.string().trim().nullable().optional(),
    items: z.array(InvoiceEditorItemSchema).min(1, 'At least one line item is required.'),
    materials: z.array(InvoiceEditorMaterialSchema).default([]),
  })
  .superRefine((value, ctx) => {
    if (value.mode === 'lot' && value.items.length !== 1) {
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
  });

export type InvoiceEditorFormValues = z.infer<typeof InvoiceEditorSchema>;
export type InvoiceClientOption = {
  id: string;
  name: string;
  state: string | null;
  gst_number: string | null;
  default_template_id: string | null;
};

export type InvoiceMaterialOption = {
  id: string;
  name: string;
  hsn_code: string | null;
};

export type InvoiceSourceOption = {
  id: string;
  label: string;
  sublabel: string;
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

export function createEmptyItem(overrides: Partial<InvoiceItem> = {}): InvoiceEditorFormValues['items'][number] {
  return {
    description: overrides.description ?? '',
    hsn_code: overrides.hsn_code ?? '',
    qty: overrides.qty ?? 1,
    rate: overrides.rate ?? 0,
    amount: overrides.amount ?? 0,
    meta_json: (overrides.meta_json as Record<string, unknown> | undefined) ?? {},
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
  overrides: Partial<InvoiceMaterial> = {},
): InvoiceEditorFormValues['materials'][number] {
  return {
    product_id: overrides.product_id ?? '',
    qty_used: overrides.qty_used ?? 1,
  };
}

export function createEmptyInvoiceFormValues(): InvoiceEditorFormValues {
  return {
    client_id: '',
    template_id: null,
    source_type: 'quotation',
    source_id: '',
    template_type: 'standard',
    mode: 'itemized',
    status: 'draft',
    company_state: DEFAULT_COMPANY_STATE,
    client_state: null,
    items: [createEmptyItem()],
    materials: [],
  };
}

export function invoiceToFormValues(invoice: InvoiceWithRelations): InvoiceEditorFormValues {
  return {
    client_id: invoice.client_id,
    template_id: invoice.template_id ?? null,
    source_type: invoice.source_type,
    source_id: invoice.source_id,
    template_type: invoice.template_type,
    mode: invoice.mode,
    status: invoice.status,
    company_state: invoice.company_state ?? DEFAULT_COMPANY_STATE,
    client_state: invoice.client_state ?? null,
    items: invoice.items.map((item) => createEmptyItem(item)),
    materials: invoice.materials.map((material) => createEmptyMaterial(material)),
  };
}

export function composeInvoiceInput(
  values: InvoiceEditorFormValues,
  totals: Pick<Invoice, 'subtotal' | 'cgst' | 'sgst' | 'igst' | 'total'>,
): InvoiceInput {
  return {
    client_id: values.client_id,
    template_id: values.template_id ?? null,
    source_type: values.source_type,
    source_id: values.source_id,
    template_type: values.template_type,
    mode: values.mode,
    subtotal: totals.subtotal,
    cgst: totals.cgst,
    sgst: totals.sgst,
    igst: totals.igst,
    total: totals.total,
    status: values.status,
    company_state: values.company_state,
    client_state: values.client_state ?? null,
    items: values.items.map((item) => ({
      description: item.description.trim(),
      hsn_code: item.hsn_code?.trim() ? item.hsn_code.trim() : null,
      qty: round2(item.qty),
      rate: round2(item.rate),
      amount: round2(item.qty * item.rate),
      meta_json: item.meta_json ?? {},
    })),
    materials: values.materials.map((material) => ({
      product_id: material.product_id,
      qty_used: round2(material.qty_used),
    })),
  };
}

export function formatCurrency(value?: number | null): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value ?? 0);
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
  return 'Client PO';
}

export function calculateDraftTotals(
  values: Pick<InvoiceEditorFormValues, 'items' | 'company_state' | 'client_state'>,
) {
  const subtotal = round2(
    values.items.reduce((sum, item) => sum + round2((Number(item.qty) || 0) * (Number(item.rate) || 0)), 0),
  );

  const taxTotal = round2(
    values.items.reduce((sum, item) => {
      const amount = round2((Number(item.qty) || 0) * (Number(item.rate) || 0));
      const taxPercentRaw = item.meta_json?.tax_percent;
      const taxPercent = typeof taxPercentRaw === 'number' ? taxPercentRaw : Number(taxPercentRaw ?? 18);
      return sum + amount * ((Number.isFinite(taxPercent) ? taxPercent : 18) / 100);
    }, 0),
  );

  const interstate = isInterstateStates(values.company_state, values.client_state);
  const cgst = interstate ? 0 : round2(taxTotal / 2);
  const sgst = interstate ? 0 : round2(taxTotal - cgst);
  const igst = interstate ? taxTotal : 0;
  const total = round2(subtotal + taxTotal);

  return {
    subtotal,
    cgst,
    sgst,
    igst,
    total,
    interstate,
  };
}
