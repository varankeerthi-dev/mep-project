import { ProformaItemSchema, ProformaSchema, type Proforma, type ProformaItem } from './schemas';

const DEFAULT_GST_PERCENT = 18;

export const roundCurrency = (value: number): number => Number(value.toFixed(2));

export function normalizeState(value?: string | null): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function isInterstate(companyState?: string | null, clientState?: string | null): boolean {
  if (!companyState || !clientState) return false;
  return normalizeState(companyState) !== normalizeState(clientState);
}

export function getItemTaxPercent(item: Pick<ProformaItem, 'meta_json'>, fallbackPercent = DEFAULT_GST_PERCENT): number {
  const value = item.meta_json?.tax_percent;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallbackPercent;
  return parsed;
}

export function normalizeProformaItems(items: ProformaItem[], defaultTaxPercent = DEFAULT_GST_PERCENT): ProformaItem[] {
  return items.map((item) => {
    const amount = roundCurrency(item.qty * item.rate);
    const metaJson = {
      tax_percent: getItemTaxPercent(item, defaultTaxPercent),
      ...item.meta_json,
    };

    return ProformaItemSchema.parse({
      ...item,
      amount,
      meta_json: metaJson,
    });
  });
}

export function calculateTotals(
  proforma: Pick<Proforma, 'items' | 'company_state' | 'client_state'>,
  options?: { defaultTaxPercent?: number },
): Pick<Proforma, 'subtotal' | 'cgst' | 'sgst' | 'igst' | 'total'> & { taxTotal: number; items: ProformaItem[] } {
  const defaultTaxPercent = options?.defaultTaxPercent ?? DEFAULT_GST_PERCENT;
  const items = normalizeProformaItems(proforma.items, defaultTaxPercent);

  const subtotal = roundCurrency(items.reduce((sum, item) => sum + item.amount, 0));
  const taxTotal = roundCurrency(
    items.reduce((sum, item) => sum + item.amount * (getItemTaxPercent(item, defaultTaxPercent) / 100), 0),
  );

  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  if (isInterstate(proforma.company_state, proforma.client_state)) {
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

export function buildProformaFromSource(
  sourceItems: Array<{
    description: string;
    hsn_code?: string | null;
    qty: number;
    rate: number;
    amount?: number;
    tax_percent?: number;
  }>,
  options: {
    companyState?: string | null;
    clientState?: string | null;
    sourceType?: 'quotation' | 'challan' | 'po' | 'manual';
    sourceId?: string;
    defaultTaxPercent?: number;
  } = {},
): Proforma {
  const defaultTaxPercent = options.defaultTaxPercent ?? DEFAULT_GST_PERCENT;

  const items = sourceItems.map((item) =>
    ProformaItemSchema.parse({
      description: item.description,
      hsn_code: item.hsn_code ?? null,
      qty: item.qty,
      rate: item.rate,
      amount: item.amount ?? roundCurrency(item.qty * item.rate),
      meta_json: {
        tax_percent: item.tax_percent ?? defaultTaxPercent,
      },
    }),
  );

  const totals = calculateTotals(
    {
      items,
      company_state: options.companyState ?? null,
      client_state: options.clientState ?? null,
    },
    { defaultTaxPercent },
  );

  return ProformaSchema.parse({
    client_id: '',
    source_type: options.sourceType ?? 'manual',
    source_id: options.sourceId ?? null,
    subtotal: totals.subtotal,
    cgst: totals.cgst,
    sgst: totals.sgst,
    igst: totals.igst,
    total: totals.total,
    company_state: options.companyState ?? null,
    client_state: options.clientState ?? null,
    items: totals.items,
  });
}