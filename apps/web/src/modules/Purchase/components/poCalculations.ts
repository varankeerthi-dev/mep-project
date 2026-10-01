/**
 * Pure purchase-order business calculations.
 *
 * Deliberately free of React, Supabase and browser concerns so they can be
 * unit-tested in isolation — same contract as
 * pages/CreateQuotation/utils/quotationCalculations.ts.
 *
 * NOTE ON numberToWords: the quotation implementation
 * (quotationCalculations.ts:107) has a latent bug — it evaluates
 * ONES[hundred] / TENS[hundred] for the hundreds place, both of which are
 * undefined for values >= 10, so '1,234' renders as "Two Thousand  Only"
 * and drops the hundreds. The correct lookup is ONES[hundred % 10].
 * That bug is NOT reproduced here. Flagged for a separate fix in the
 * quotation module; not changed, since that is out of scope for this work.
 */

export interface PurchaseOrderItem {
  item_id?: string | null;
  variant_id?: string | null;
  description?: string;
  /** HSN code (goods). PO uses HSN; quotations use SAC. */
  hsn_code?: string | null;
  qty?: number | null;
  uom?: string;
  rate?: number;
  discount_percent?: number;
  tax_percent?: number;
  make?: string | null;
  variant?: string | null;
  notes?: string | null;
  /**
   * Section-header row (quotation pattern). Renders as a spanning heading, has
   * no financial effect. V1 had a `section` text field on every line and only
   * grouped by it; here sections are explicit rows, matching QuotationItemsTable.
   */
  is_header?: boolean;
  /** Sub-total row. Amount is derived, never typed. */
  is_subtotal?: boolean;
  subtotal_label?: string | null;
  [key: string]: any;
}

export interface LineCalculationResult {
  qty: number;
  baseRate: number;
  grossBase: number;
  discountAmount: number;
  net: number;
  taxable: number;
  taxPercent: number;
  taxAmount: number;
  lineTotal: number;
}

export interface PurchaseOrderTotalsInput {
  items: PurchaseOrderItem[];
  extraDiscountPercent: number;
  extraDiscountAmount: number;
  roundOffEnabled: boolean;
  /** Vendor state — decides intra-state (CGST+SGST) vs inter-state (IGST). */
  vendorState: string;
  /** Own organisation state. */
  companyState: string;
}

export interface PurchaseOrderTotalsResult {
  subtotal: number;
  totalItemDiscount: number;
  totalDiscount: number;
  extraDiscountAmount: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  isInterState: boolean;
  totalTax: number;
  roundOff: number;
  grandTotal: number;
  baseTotal: number;
  taxGroups: Record<number, { baseAmount: number; taxAmount: number; sgst: number; cgst: number; igst: number }>;
  /** Per-sub-total-row amount, keyed by the row's client id. */
  subtotalByKey: Record<string, number>;
  amountInWords: string;
}

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
];

const TENS = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety',
];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n] || '';
  const t = TENS[Math.floor(n / 10)];
  const o = ONES[n % 10];
  return (t + (o ? ' ' + o : '')).trim();
}

function inWords(n: number | string): string {
  const num = Number(n);
  if (!isFinite(num)) return '';
  if (num === 0) return 'Zero Only';
  const str = String(Math.round(num));
  if (str.length > 9) return '';
  const padded = ('000000000' + str).slice(-9);
  const match = padded.match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!match) return '';

  const crore = parseInt(match[1], 10);
  const lakh = parseInt(match[2], 10);
  const thousand = parseInt(match[3], 10);
  const hundred = parseInt(match[4], 10);
  const rest = parseInt(match[5], 10);

  let result = '';
  if (crore !== 0) result += twoDigits(crore) + ' Crore ';
  if (lakh !== 0) result += twoDigits(lakh) + ' Lakh ';
  if (thousand !== 0) result += twoDigits(thousand) + ' Thousand ';
  // hundreds place: ONES[hundred % 10] — see header note on the quotation bug
  if (hundred !== 0) result += (ONES[hundred % 10] || '') + ' Hundred ';
  if (rest !== 0) {
    result += (result !== '' ? 'and ' : '') + twoDigits(rest);
  }
  return result.trim() + ' Only';
}

export function numberToWords(num: number): string {
  return inWords(Math.round(num));
}

/** round2 — every money figure in this module goes through here. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function calculateLineItem(item: PurchaseOrderItem): LineCalculationResult {
  const qty = parseFloat(String(item.qty)) || 0;
  const rate = parseFloat(String(item.rate)) || 0;
  const discountPercent = parseFloat(String(item.discount_percent)) || 0;

  const grossBase = round2(qty * rate);
  // Discount is a percentage of the line gross, matching the PO server-side
  // model: v_line_taxable = ROUND(qty*rate - discount_amount, 2).
  const discountAmount = round2(grossBase * (discountPercent / 100));
  const net = round2(grossBase - discountAmount);
  const taxable = Math.max(0, net);
  const taxPercent = parseFloat(String(item.tax_percent)) || 0;
  const taxAmount = round2(taxable * (taxPercent / 100));
  const lineTotal = round2(taxable + taxAmount);

  return { qty, baseRate: rate, grossBase, discountAmount, net, taxable, taxPercent, taxAmount, lineTotal };
}

export function calculatePurchaseOrderTotals(input: PurchaseOrderTotalsInput): PurchaseOrderTotalsResult {
  let subtotal = 0;
  let totalItemDiscount = 0;
  let totalTax = 0;
  const taxGroups: Record<number, { baseAmount: number; taxAmount: number; sgst: number; cgst: number; igst: number }> = {};
  const subtotalByKey: Record<string, number> = {};
  // Running total of line items since the last sub-total row, so a sub-total
  // reflects the lines above it rather than every line in the document.
  let runningSinceSubtotal = 0;

  for (const item of input.items) {
    if (!item) continue;
    if (item.is_header) continue;

    if (item.is_subtotal) {
      if (item._key) subtotalByKey[item._key] = round2(runningSinceSubtotal);
      runningSinceSubtotal = 0;
      continue;
    }

    const line = calculateLineItem(item);
    subtotal = round2(subtotal + line.grossBase);
    totalItemDiscount = round2(totalItemDiscount + line.discountAmount);
    totalTax = round2(totalTax + line.taxAmount);
    runningSinceSubtotal = round2(runningSinceSubtotal + line.lineTotal);

    if (line.taxPercent > 0) {
      const key = line.taxPercent;
      if (!taxGroups[key]) taxGroups[key] = { baseAmount: 0, taxAmount: 0, sgst: 0, cgst: 0, igst: 0 };
      taxGroups[key].baseAmount = round2(taxGroups[key].baseAmount + line.taxable);
      taxGroups[key].taxAmount = round2(taxGroups[key].taxAmount + line.taxAmount);
    }
  }

  // Resolve the tax split per group AFTER knowing intra vs inter-state, so the
  // group figures and the header figures can never disagree.
  const vendorState = (input.vendorState || '').trim().toLowerCase();
  const companyState = (input.companyState || '').trim().toLowerCase();
  // No state known on either side => treat as intra-state (CGST+SGST), which is
  // the safe default for an Indian domestic supplier and matches the server.
  const isInterState = !!(vendorState && companyState && vendorState !== companyState);

  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  for (const key of Object.keys(taxGroups)) {
    const g = taxGroups[Number(key)];
    if (isInterState) {
      g.igst = g.taxAmount;
      g.sgst = 0;
      g.cgst = 0;
      igst = round2(igst + g.taxAmount);
    } else {
      g.igst = 0;
      g.sgst = round2(g.taxAmount / 2);
      g.cgst = round2(g.taxAmount - g.sgst);
      sgst = round2(sgst + g.sgst);
      cgst = round2(cgst + g.cgst);
    }
  }

  const afterItemDiscount = round2(subtotal - totalItemDiscount);
  const extraDiscountPercentVal = parseFloat(String(input.extraDiscountPercent)) || 0;
  const extraDiscountPercentAmount = round2(afterItemDiscount * (extraDiscountPercentVal / 100));
  const extraDiscountManual = parseFloat(String(input.extraDiscountAmount)) || 0;
  const totalExtraDiscount = round2(extraDiscountPercentAmount + extraDiscountManual);
  const totalDiscount = round2(totalItemDiscount + totalExtraDiscount);

  const taxableAmount = Math.max(0, round2(afterItemDiscount - totalExtraDiscount));

  // Tax was computed per line on the pre-header-discount taxable base, exactly as
  // the quotation does. Re-deriving it here would silently disagree with the
  // per-line figures shown in the table, so it is deliberately NOT recomputed.
  const baseTotal = round2(taxableAmount + totalTax);

  let roundOffValue = 0;
  if (input.roundOffEnabled) {
    roundOffValue = round2(Math.round(baseTotal) - baseTotal);
  }
  const grandTotal = round2(baseTotal + roundOffValue);

  return {
    subtotal,
    totalItemDiscount,
    totalDiscount,
    extraDiscountAmount: totalExtraDiscount,
    taxableAmount,
    cgst,
    sgst,
    igst,
    isInterState,
    totalTax,
    roundOff: roundOffValue,
    grandTotal,
    baseTotal,
    taxGroups,
    subtotalByKey,
    amountInWords: numberToWords(grandTotal),
  };
}

// ---------------------------------------------------------------------------
// Section / sub-total row helpers (quotation row-behaviour parity)
// ---------------------------------------------------------------------------

/** Strip non-persistable rows and return only the lines the server should store. */
export function extractBillableLines(items: PurchaseOrderItem[]): PurchaseOrderItem[] {
  return items.filter(i => !i.is_header && !i.is_subtotal);
}

/**
 * Human-readable section label for a line, walking backwards to the nearest
 * section-header row. Returns '' when the line has no section.
 */
export function sectionForLine(items: PurchaseOrderItem[], index: number): string {
  for (let i = index; i >= 0; i--) {
    if (items[i]?.is_header) return String(items[i]?.description || items[i]?.subtotal_label || '');
  }
  return '';
}

// ---------------------------------------------------------------------------
// RPC payload
// ---------------------------------------------------------------------------

export interface PurchaseOrderRpcItem {
  item_id: string | null;
  variant_id: string | null;
  item_name: string;
  description: string | null;
  hsn_code: string | null;
  quantity: number;
  unit: string;
  rate: number;
  discount_percent: number;
  discount_amount: number;
  discount_category_id: string | null;
  tax_percent: number;
  make: string | null;
  variant: string | null;
  notes: string | null;
}

/**
 * Build the p_items jsonb array the save RPC expects.
 * The server recomputes every figure from quantity/rate/discount/tax; these
 * values are sent for display consistency and are not trusted for posting.
 *
 * item_name is the MATERIAL name (what the line is); description is the
 * free user text from the pen-icon editor (what the line says). They are
 * separate columns because CreateQuotation keeps them separate too — an
 * earlier revision auto-filled description with the material name, which is
 * exactly what the pen-icon pattern exists to avoid.
 *
 * discount_category_id is provenance for the line: the header's Pricing Rules
 * set a percentage per category and the line inherits it. The applied number
 * travels in discount_percent; the id is what lets the editor re-show the
 * category badge on reload.
 */
export function buildPurchaseOrderItemPayload(item: PurchaseOrderItem): PurchaseOrderRpcItem {
  const line = calculateLineItem(item);
  return {
    item_id: item.item_id || null,
    variant_id: item.variant_id || null,
    item_name: (item as any).item_name || item.description || 'Item',
    description: item.description || null,
    hsn_code: item.hsn_code || null,
    quantity: line.qty,
    unit: item.uom || 'Nos',
    rate: line.baseRate,
    discount_percent: parseFloat(String(item.discount_percent)) || 0,
    discount_amount: line.discountAmount,
    discount_category_id: item.discount_category_id || null,
    tax_percent: line.taxPercent,
    make: item.make || null,
    variant: item.variant || null,
    notes: item.notes || null,
  };
}
