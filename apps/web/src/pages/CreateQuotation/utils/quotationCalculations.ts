/**
 * Pure quotation business calculations.
 *
 * These functions are intentionally free of React, Supabase, and any
 * browser/component concerns so they can be unit-tested in isolation.
 */

export interface QuotationItem {
  id?: any;
  item_id?: string | null;
  variant_id?: string | null;
  description?: string;
  qty?: number | null;
  uom?: string;
  rate?: number;
  discount_percent?: number;
  tax_percent?: number;
  base_rate_snapshot?: number;
  applied_discount_percent?: number;
  is_override?: boolean;
  final_rate_snapshot?: number;
  is_header?: boolean;
  is_subtotal?: boolean;
  subtotal_label?: string | null;
  line_total?: number;
  tax_amount?: number;
  discount_amount?: number;
  section?: string;
  [key: string]: any;
}

export interface LineCalculationResult {
  qty: number;
  finalRate: number;
  baseRate: number;
  grossBase: number;
  net: number;
  discountAmount: number;
  taxable: number;
  taxPercent: number;
  taxAmount: number;
  lineTotal: number;
}

export interface QuotationTotalsInput {
  items: QuotationItem[];
  extraDiscountPercent: number;
  extraDiscountAmount: number;
  roundOffEnabled: boolean;
  roundOff: number;
  state: string;
  companyState: string;
}

export interface QuotationTotalsResult {
  subtotal: number;
  totalItemDiscount: number;
  extraDiscountAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  isInterState: boolean;
  totalTax: number;
  roundOff: number;
  grandTotal: number;
  baseTotal: number;
  taxGroups: Record<number, { baseAmount: number; taxAmount: number; sgst: number; cgst: number }>;
  subTotalGroups: Record<string, number>;
  amountInWords: string;
}

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
];

const TENS = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety',
];

function inWords(n: number | string): string {
  const num = Number(n);
  if (num === 0) return 'Zero Only';
  const str = String(Math.round(num));
  if (str.length > 9) return 'overflow';
  const padded = ('000000000' + str).substr(-9);
  const match = padded.match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!match || match.length < 6) return '';
  let result = '';
  const crore = parseInt(match[1], 10);
  const lakh = parseInt(match[2], 10);
  const thousand = parseInt(match[3], 10);
  const hundred = parseInt(match[4], 10);
  const tens = parseInt(match[5], 10);

  if (crore !== 0) {
    result += (ONES[crore] || TENS[Math.floor(crore / 10)] + ' ' + ONES[crore % 10]) + ' Crore ';
  }
  if (lakh !== 0) {
    result += (ONES[lakh] || TENS[Math.floor(lakh / 10)] + ' ' + ONES[lakh % 10]) + ' Lakh ';
  }
  if (thousand !== 0) {
    result += (ONES[thousand] || TENS[Math.floor(thousand / 10)] + ' ' + ONES[thousand % 10]) + ' Thousand ';
  }
  if (hundred !== 0) {
    result += (ONES[hundred] || TENS[hundred] || '') + ' Hundred ';
  }
  if (tens !== 0) {
    result += (result !== '' ? 'and ' : '') + (ONES[tens] || TENS[Math.floor(tens / 10)] + ' ' + ONES[tens % 10]);
  }
  return result.trim() + ' Only';
}

export function numberToWords(num: number): string {
  return inWords(Math.round(num));
}

export function calculateLineItem(item: QuotationItem): LineCalculationResult {
  const qty = parseFloat(String(item.qty)) || 0;
  const finalRate = parseFloat(String(item.rate)) || 0;
  const baseRate = parseFloat(String(item.base_rate_snapshot)) || finalRate;
  const grossBase = qty * baseRate;
  const net = qty * finalRate;
  const discountAmount = Math.max(0, grossBase - net);
  const taxable = net;
  const taxPercent = parseFloat(String(item.tax_percent)) || 0;
  const taxAmount = (taxable * taxPercent) / 100;
  const lineTotal = taxable + taxAmount;
  return { qty, finalRate, baseRate, grossBase, net, discountAmount, taxable, taxPercent, taxAmount, lineTotal };
}

export function calculateQuotationTotals(input: QuotationTotalsInput): QuotationTotalsResult {
  let subtotal = 0;
  let totalItemDiscount = 0;
  let totalTax = 0;
  const subTotalGroups: Record<string, number> = {};
  let runningGroupTotal = 0;
  const taxGroups: Record<number, { baseAmount: number; taxAmount: number; sgst: number; cgst: number }> = {};

  for (const item of input.items) {
    if (item.is_header) continue;
    if (item.is_subtotal) {
      const label = item.subtotal_label || 'Sub-total:';
      subTotalGroups[label] = runningGroupTotal;
      runningGroupTotal = 0;
      continue;
    }
    const line = calculateLineItem(item);
    subtotal += line.net;
    totalItemDiscount += line.discountAmount;
    totalTax += line.taxAmount;
    runningGroupTotal += line.net;
    if (line.taxPercent > 0) {
      if (!taxGroups[line.taxPercent]) {
        taxGroups[line.taxPercent] = { baseAmount: 0, taxAmount: 0, sgst: 0, cgst: 0 };
      }
      const sgst = line.taxAmount / 2;
      const cgst = line.taxAmount / 2;
      taxGroups[line.taxPercent].baseAmount += line.taxable;
      taxGroups[line.taxPercent].taxAmount += line.taxAmount;
      taxGroups[line.taxPercent].sgst += sgst;
      taxGroups[line.taxPercent].cgst += cgst;
    }
  }

  const afterItemDiscount = subtotal;
  const extraDiscountPercentVal = parseFloat(String(input.extraDiscountPercent)) || 0;
  const extraDiscountAmountVal = (afterItemDiscount * extraDiscountPercentVal) / 100;
  const extraDiscountManual = parseFloat(String(input.extraDiscountAmount)) || 0;
  const isInterState = !!(
    input.state &&
    input.companyState &&
    input.state.trim().toLowerCase() !== input.companyState.trim().toLowerCase()
  );
  const cgst = isInterState ? 0 : totalTax / 2;
  const sgst = isInterState ? 0 : totalTax / 2;
  const igst = isInterState ? totalTax : 0;
  const subtotalAfterDiscounts = afterItemDiscount - extraDiscountAmountVal - extraDiscountManual;
  const baseTotal = subtotalAfterDiscounts + totalTax;
  let roundOffValue = 0;
  if (input.roundOffEnabled) {
    roundOffValue = Math.round(baseTotal) - baseTotal;
  } else {
    roundOffValue = parseFloat(String(input.roundOff)) || 0;
  }
  const grandTotal = baseTotal + roundOffValue;

  return {
    subtotal,
    totalItemDiscount,
    extraDiscountAmount: extraDiscountAmountVal,
    cgst,
    sgst,
    igst,
    isInterState,
    totalTax,
    roundOff: roundOffValue,
    grandTotal,
    baseTotal,
    taxGroups,
    subTotalGroups,
    amountInWords: numberToWords(grandTotal),
  };
}

export interface QuotationRpcItemPayload {
  item_id: string | null;
  variant_id: string | null;
  description: string;
  qty: number | null;
  uom: string;
  rate: number;
  discount_percent: number;
  tax_percent: number;
  sac_code: string | null;
  display_order: number;
  custom1: string;
  custom2: string;
  base_rate_snapshot: number;
  applied_discount_percent: number;
  is_override: boolean;
  final_rate_snapshot: number;
  is_header: boolean;
  is_subtotal: boolean;
  subtotal_label: string | null;
}

export function buildQuotationItemPayload(item: QuotationItem, isErection = false): QuotationRpcItemPayload {
  return {
    item_id: isErection ? null : (item.item_id || null),
    variant_id: item.variant_id || null,
    description: isErection ? (item.description || 'Erection Charges') : (item.description || ''),
    qty: item.qty === null ? null : (parseFloat(String(item.qty)) || 0),
    uom: item.uom || '',
    rate: parseFloat(String(item.rate)) || 0,
    discount_percent: parseFloat(String(item.discount_percent)) || 0,
    tax_percent: parseFloat(String(item.tax_percent)) || 0,
    sac_code: isErection ? (item.sac_code || '995419') : (item.sac_code || null),
    display_order: 0,
    custom1: item.custom1 || '',
    custom2: item.custom2 || '',
    base_rate_snapshot: parseFloat(String(item.base_rate_snapshot)) || parseFloat(String(item.rate)) || 0,
    applied_discount_percent: parseFloat(String(item.applied_discount_percent)) || 0,
    is_override: item.is_override || false,
    final_rate_snapshot: parseFloat(String(item.final_rate_snapshot)) || parseFloat(String(item.rate)) || 0,
    is_header: !!item.is_header,
    is_subtotal: !!item.is_subtotal,
    subtotal_label: item.subtotal_label || null,
  };
}
