import { InvoiceItemSchema, InvoiceMaterialSchema, InvoiceSchema, type Invoice, type InvoiceItem, type InvoiceMaterial } from './schemas';
import type {
  ChallanInvoiceSource,
  InvoiceSourceDocument,
  InvoiceSourceMapOptions,
  InvoiceStatus,
  InvoiceTemplateType,
} from './types';

const DEFAULT_GST_PERCENT = 18;

export const roundCurrency = (value: number): number => Number(value.toFixed(2));

export function normalizeState(value?: string | null): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function isInterstate(companyState?: string | null, clientState?: string | null): boolean {
  if (!companyState || !clientState) return false;
  return normalizeState(companyState) !== normalizeState(clientState);
}

export function getItemTaxPercent(item: Pick<InvoiceItem, 'meta_json'>, fallbackPercent = DEFAULT_GST_PERCENT): number {
  const value = item.meta_json?.tax_percent;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallbackPercent;
  return parsed;
}

export function normalizeInvoiceItems(items: InvoiceItem[], defaultTaxPercent = DEFAULT_GST_PERCENT): InvoiceItem[] {
  return items.map((item) => {
    const amount = roundCurrency(item.qty * item.rate);
    const metaJson = {
      tax_percent: getItemTaxPercent(item, defaultTaxPercent),
      ...item.meta_json,
    };

    return InvoiceItemSchema.parse({
      ...item,
      amount,
      meta_json: metaJson,
    });
  });
}

export function calculateTotals(
  invoice: Pick<Invoice, 'items' | 'company_state' | 'client_state'>,
  options?: { defaultTaxPercent?: number },
): Pick<Invoice, 'subtotal' | 'cgst' | 'sgst' | 'igst' | 'total'> & { taxTotal: number; items: InvoiceItem[] } {
  const defaultTaxPercent = options?.defaultTaxPercent ?? DEFAULT_GST_PERCENT;
  const items = normalizeInvoiceItems(invoice.items, defaultTaxPercent);

  const subtotal = roundCurrency(items.reduce((sum, item) => sum + item.amount, 0));
  const taxTotal = roundCurrency(
    items.reduce((sum, item) => sum + item.amount * (getItemTaxPercent(item, defaultTaxPercent) / 100), 0),
  );

  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  if (isInterstate(invoice.company_state, invoice.client_state)) {
    igst = taxTotal;
  } else {
    cgst = roundCurrency(taxTotal / 2);
    sgst = roundCurrency(taxTotal - cgst);
  }

  return {
    subtotal,
    cgst,
    sgst,
    igst,
    total: roundCurrency(subtotal + taxTotal),
    taxTotal,
    items,
  };
}

function getTemplateTypeForSource(source: InvoiceSourceDocument, requested?: InvoiceTemplateType): InvoiceTemplateType {
  if (requested) return requested;
  return source.type === 'po' ? 'lot' : 'standard';
}

function getModeForSource(source: InvoiceSourceDocument, requested?: Invoice['mode']): Invoice['mode'] {
  if (requested) return requested;
  return source.type === 'po' ? 'lot' : 'itemized';
}

function getStatus(requested?: InvoiceStatus): InvoiceStatus {
  return requested ?? 'draft';
}

function buildLotDescription(source: ChallanInvoiceSource | Extract<InvoiceSourceDocument, { type: 'po' }>): string {
  if (source.type === 'po') {
    return `As per PO #${source.header.po_number}`;
  }

  if (source.header.po_no) {
    return `As per Delivery Challan / PO #${source.header.po_no}`;
  }

  return `As per Delivery Challan ${source.header.challan_number || source.header.id}`;
}

export function mapSourceToInvoice(source: InvoiceSourceDocument, options: InvoiceSourceMapOptions = {}): Invoice {
  const mode = getModeForSource(source, options.mode);
  const templateType = getTemplateTypeForSource(source, options.templateType);
  const defaultTaxPercent = options.defaultTaxPercent ?? DEFAULT_GST_PERCENT;

  let items: InvoiceItem[] = [];
  let materials: InvoiceMaterial[] = [];

  if (source.type === 'quotation') {
    items = source.items.map((item) =>
      InvoiceItemSchema.parse({
        description: item.description,
        hsn_code: item.hsn_code ?? null,
        qty: item.qty,
        rate: item.rate,
        amount: item.amount ?? roundCurrency(item.qty * item.rate),
        meta_json: {
          ...(item.meta_json ?? {}),
          tax_percent: item.tax_percent ?? defaultTaxPercent,
          source_item_id: item.id ?? item.item_id ?? null,
        },
      }),
    );
  }

  if (source.type === 'challan') {
    if (mode === 'lot') {
      const totalAmount = source.items.reduce((sum, item) => sum + (item.amount ?? roundCurrency(item.qty * item.rate)), 0);
      items = [
        InvoiceItemSchema.parse({
          description: buildLotDescription(source),
          hsn_code: null,
          qty: 1,
          rate: roundCurrency(totalAmount),
          amount: roundCurrency(totalAmount),
          meta_json: {
            tax_percent: defaultTaxPercent,
            challan_id: source.header.id,
          },
        }),
      ];
      materials = source.items
        .filter((item) => item.product_id)
        .map((item) =>
          InvoiceMaterialSchema.parse({
            product_id: item.product_id,
            qty_used: item.qty,
          }),
        );
    } else {
      items = source.items.map((item) =>
        InvoiceItemSchema.parse({
          description: item.description,
          hsn_code: item.hsn_code ?? null,
          qty: item.qty,
          rate: item.rate,
          amount: item.amount ?? roundCurrency(item.qty * item.rate),
          meta_json: {
            ...(item.meta_json ?? {}),
            tax_percent: item.tax_percent ?? defaultTaxPercent,
            challan_item_id: item.id ?? item.product_id ?? null,
          },
        }),
      );
    }
  }

  if (source.type === 'po') {
    items = [
      InvoiceItemSchema.parse({
        description: buildLotDescription(source),
        hsn_code: null,
        qty: 1,
        rate: roundCurrency(source.header.po_total_value),
        amount: roundCurrency(source.header.po_total_value),
        meta_json: {
          tax_percent: defaultTaxPercent,
          po_id: source.header.id,
        },
      }),
    ];

    materials = (source.materials ?? []).map((material) =>
      InvoiceMaterialSchema.parse({
        product_id: material.product_id,
        qty_used: material.qty_used,
      }),
    );
  }

  const totals = calculateTotals(
    {
      items,
      company_state: options.companyState ?? null,
      client_state: source.header.client_state ?? null,
    },
    { defaultTaxPercent },
  );

  return InvoiceSchema.parse({
    client_id: source.header.client_id,
    source_type: source.type,
    source_id: source.header.id,
    template_type: templateType,
    mode,
    subtotal: totals.subtotal,
    cgst: totals.cgst,
    sgst: totals.sgst,
    igst: totals.igst,
    total: totals.total,
    status: getStatus(options.status),
    company_state: options.companyState ?? null,
    client_state: source.header.client_state ?? null,
    items: totals.items,
    materials,
  });
}
