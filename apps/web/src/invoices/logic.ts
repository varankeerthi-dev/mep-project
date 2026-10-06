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

/**
 * Round half away from zero at 2dp, the way Postgres `ROUND(numeric, 2)` does.
 *
 * `toFixed` cannot be used for parity: 10.50 * 18 / 2 / 100 evaluates to
 * 0.9449999999999999511 in binary floating point, so `toFixed(2)` yields 0.94
 * while the database yields 0.95. That single cent is the difference between
 * what the editor footer shows and what the invoice stores. The epsilon nudge
 * pushes the float back onto the decimal value the server sees.
 */
export function roundHalfUp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const scaled = value * 100;
  // 1e-9 is far below any real currency magnitude and only compensates for
  // binary representation error.
  const nudged = scaled >= 0 ? scaled + 1e-9 : scaled - 1e-9;
  const rounded = nudged >= 0 ? Math.floor(nudged + 0.5) : Math.ceil(nudged - 0.5);
  return rounded / 100;
}

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

/**
 * A section-header or subtotal row is presentation only and carries no
 * financial value. Both the client draft totals and the persisted payload must
 * exclude them, exactly as `finalize_sales_invoice` does server-side.
 */
export function isStructuralRow(item: { is_header?: boolean | null; is_subtotal?: boolean | null }): boolean {
  return Boolean(item?.is_header) || Boolean(item?.is_subtotal);
}

/**
 * The rate actually charged for a line.
 *
 * Two representations exist and both must produce the same money:
 *
 * - Editor items: `rate` is the pre-discount figure, with `base_rate` in
 *   meta_json and `discount_percent` on the row.
 * - Persisted items: `rate` is already net of the discount. `discount_percent`
 *   is not part of InvoiceItemSchema, so normalising a stored row drops it and
 *   leaves only `meta_json.base_rate` behind.
 *
 * Re-deriving from `base_rate` while ignoring a zero `discount_percent` makes
 * the payload engine use the undiscounted 100 where the persisted rate says 90,
 * which is exactly the client/server disagreement this function exists to
 * remove. So the discount is applied only when a discount is actually recorded;
 * otherwise the line's own `rate` is authoritative.
 */
export function effectiveLineRate(item: {
  rate?: number | string | null;
  discount_percent?: number | string | null;
  meta_json?: { base_rate?: number | string | null } | null;
}): number {
  const rate = Number(item?.rate) || 0;
  const discountPercent = Number(item?.discount_percent) || 0;

  if (discountPercent === 0) {
    return roundHalfUp(rate);
  }

  const baseRate = Number(item?.meta_json?.base_rate) || rate;
  return roundHalfUp(baseRate - (baseRate * discountPercent / 100));
}

export interface InvoiceTotals {
  subtotal: number;
  taxTotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalBeforeRoundOff: number;
  roundOff: number;
  total: number;
  interstate: boolean;
}

/**
 * The single canonical invoice totals engine.
 *
 * Both prior engines disagreed with each other and with the database:
 *
 * 1. The client (`calculateDraftTotals`) and the payload builder
 *    (`logic.calculateTotals`) each aggregated a tax total and then split it
 *    50/50. `finalize_sales_invoice` instead splits *per line* and rounds each
 *    half to 2dp. On a single 10.50 @ 18% line the server yields
 *    cgst 0.95 / sgst 0.95 while the client yields cgst 0.95 / sgst 0.94.
 * 2. Neither JS engine skipped structural (header/subtotal) rows, so a subtotal
 *    row carrying qty 1 and the section total was counted on top of its own
 *    section. The server has skipped them since the rows were introduced.
 * 3. Round-off existed only in the client, was never persisted, and was
 *    therefore silently discarded on save.
 *
 * This mirrors the server: skip structural rows, split per line with per-line
 * rounding, and expose round-off as data rather than a UI-only concept.
 */
export function calculateInvoiceTotals(
  items: Array<{
    qty?: number | string | null;
    rate?: number | string | null;
    discount_percent?: number | string | null;
    is_header?: boolean | null;
    is_subtotal?: boolean | null;
    meta_json?: { base_rate?: number | string | null; tax_percent?: number | string | null } | null;
  }>,
  companyState?: string | null,
  clientState?: string | null,
  enableRoundOff = false,
  defaultTaxPercent = DEFAULT_GST_PERCENT,
): InvoiceTotals {
  const interstate = isInterstate(companyState, clientState);

  let subtotal = 0;
  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  for (const item of items ?? []) {
    if (isStructuralRow(item)) continue;

    const qty = Number(item?.qty) || 0;
    const rate = effectiveLineRate(item);
    const amount = roundHalfUp(qty * rate);
    subtotal = roundHalfUp(subtotal + amount);

    const rawTaxPercent = item?.meta_json?.tax_percent;
    const parsedTax = typeof rawTaxPercent === 'number' ? rawTaxPercent : Number(rawTaxPercent);
    const taxPercent = Number.isFinite(parsedTax) ? parsedTax : defaultTaxPercent;

    if (interstate) {
      igst = roundHalfUp(igst + roundHalfUp((amount * taxPercent) / 100));
    } else {
      // Per-line half split, matching finalize_sales_invoice.
      const halfTax = roundHalfUp((amount * taxPercent) / 2 / 100);
      cgst = roundHalfUp(cgst + halfTax);
      sgst = roundHalfUp(sgst + halfTax);
    }
  }

  const taxTotal = roundHalfUp(cgst + sgst + igst);
  const totalBeforeRoundOff = roundHalfUp(subtotal + taxTotal);

  let roundOff = 0;
  let total = totalBeforeRoundOff;
  if (enableRoundOff) {
    const roundedTotal = Math.round(totalBeforeRoundOff);
    roundOff = roundHalfUp(roundedTotal - totalBeforeRoundOff);
    total = roundHalfUp(roundedTotal);
  }

  return { subtotal, taxTotal, cgst, sgst, igst, totalBeforeRoundOff, roundOff, total, interstate };
}

export function calculateTotals(
  invoice: Pick<Invoice, 'items' | 'company_state' | 'client_state'>,
  options?: { defaultTaxPercent?: number; enableRoundOff?: boolean },
): Pick<Invoice, 'subtotal' | 'cgst' | 'sgst' | 'igst' | 'total'> & {
  taxTotal: number;
  roundOff: number;
  items: InvoiceItem[];
} {
  const defaultTaxPercent = options?.defaultTaxPercent ?? DEFAULT_GST_PERCENT;
  const items = normalizeInvoiceItems(invoice.items, defaultTaxPercent);

  const totals = calculateInvoiceTotals(
    items,
    invoice.company_state,
    invoice.client_state,
    options?.enableRoundOff ?? false,
    defaultTaxPercent,
  );

  return {
    subtotal: totals.subtotal,
    cgst: totals.cgst,
    sgst: totals.sgst,
    igst: totals.igst,
    total: totals.total,
    taxTotal: totals.taxTotal,
    roundOff: totals.roundOff,
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
    // Use actual PO line items instead of creating single lot item
    items = source.items.map((item) =>
      InvoiceItemSchema.parse({
        description: item.description,
        hsn_code: item.hsn_code ?? null,
        qty: item.qty,
        rate: item.rate,
        amount: item.amount ?? roundCurrency(item.qty * item.rate),
        meta_json: {
          tax_percent: item.tax_percent ?? defaultTaxPercent,
          po_id: source.header.id,
          po_line_item_id: item.id ?? item.item_id ?? null,
          ...(item.meta_json ?? {}),
        },
      }),
    );

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
