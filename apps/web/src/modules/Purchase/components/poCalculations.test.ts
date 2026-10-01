/**
 * Unit tests for poCalculations.
 *
 * Mirrors the intent of pages/CreateQuotation/utils/quotationCalculations.test.ts.
 * Pure functions only — no React, no Supabase.
 *
 * Run: vitest run src/modules/Purchase/components/poCalculations.test.ts
 */
import { describe, it, expect } from 'vitest';
import {
  calculateLineItem,
  calculatePurchaseOrderTotals,
  buildPurchaseOrderItemPayload,
  extractBillableLines,
  sectionForLine,
  numberToWords,
  round2,
  type PurchaseOrderItem,
} from './poCalculations';

const TN = 'Tamil Nadu';
const MH = 'Maharashtra';

const line = (over: Partial<PurchaseOrderItem> = {}): PurchaseOrderItem => ({
  description: 'Item',
  qty: 1,
  uom: 'Nos',
  rate: 100,
  tax_percent: 18,
  ...over,
});

describe('numberToWords', () => {
  it('handles the hundreds place (the quotation bug this must not repeat)', () => {
    // quotationCalculations.ts:107 yields "Two Thousand  Only" for this — drops
    // the 'Three Hundred'. This implementation must render it.
    expect(numberToWords(2300)).toBe('Two Thousand Three Hundred Only');
  });

  it('renders single hundreds', () => {
    expect(numberToWords(500)).toBe('Five Hundred Only');
  });

  it('renders tens and units', () => {
    expect(numberToWords(42)).toBe('Forty Two Only');
    expect(numberToWords(9)).toBe('Nine Only');
  });

  it('renders thousands and lakhs', () => {
    expect(numberToWords(1000)).toBe('One Thousand Only');
    expect(numberToWords(150000)).toBe('One Lakh Fifty Thousand Only');
  });

  it('handles zero', () => {
    expect(numberToWords(0)).toBe('Zero Only');
  });

  it('returns empty for out-of-range values rather than garbage', () => {
    expect(numberToWords(9999999999)).toBe('');
  });
});

describe('round2', () => {
  it('rounds half away from zero at 2dp', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(2.675)).toBe(2.68);
  });
});

describe('calculateLineItem', () => {
  it('computes gross, tax and line total', () => {
    const r = calculateLineItem(line({ qty: 2, rate: 100, tax_percent: 18 }));
    expect(r.grossBase).toBe(200);
    expect(r.discountAmount).toBe(0);
    expect(r.taxable).toBe(200);
    expect(r.taxAmount).toBe(36);
    expect(r.lineTotal).toBe(236);
  });

  it('applies a percentage discount before tax', () => {
    const r = calculateLineItem(line({ qty: 2, rate: 100, discount_percent: 10, tax_percent: 18 }));
    expect(r.grossBase).toBe(200);
    expect(r.discountAmount).toBe(20);
    expect(r.taxable).toBe(180);
    expect(r.taxAmount).toBe(32.4);
    expect(r.lineTotal).toBe(212.4);
  });

  it('treats a zero rate as zero rather than NaN', () => {
    const r = calculateLineItem(line({ rate: 0 }));
    expect(r.grossBase).toBe(0);
    expect(r.taxAmount).toBe(0);
    expect(r.lineTotal).toBe(0);
  });

  it('handles missing tax percent as zero tax', () => {
    const r = calculateLineItem(line({ tax_percent: undefined }));
    expect(r.taxPercent).toBe(0);
    expect(r.taxAmount).toBe(0);
  });
});

describe('calculatePurchaseOrderTotals — tax split', () => {
  it('splits CGST+SGST when vendor state equals company state', () => {
    const t = calculatePurchaseOrderTotals({
      items: [line({ qty: 1, rate: 1000, tax_percent: 18 })],
      extraDiscountPercent: 0,
      extraDiscountAmount: 0,
      roundOffEnabled: false,
      vendorState: TN,
      companyState: TN,
    });
    expect(t.isInterState).toBe(false);
    expect(t.totalTax).toBe(180);
    expect(t.cgst).toBe(90);
    expect(t.sgst).toBe(90);
    expect(t.igst).toBe(0);
    expect(t.grandTotal).toBe(1180);
  });

  it('uses IGST when states differ', () => {
    const t = calculatePurchaseOrderTotals({
      items: [line({ qty: 1, rate: 1000, tax_percent: 18 })],
      extraDiscountPercent: 0,
      extraDiscountAmount: 0,
      roundOffEnabled: false,
      vendorState: MH,
      companyState: TN,
    });
    expect(t.isInterState).toBe(true);
    expect(t.igst).toBe(180);
    expect(t.cgst).toBe(0);
    expect(t.sgst).toBe(0);
    expect(t.grandTotal).toBe(1180);
  });

  it('is case and whitespace insensitive on state names', () => {
    const t = calculatePurchaseOrderTotals({
      items: [line({ qty: 1, rate: 1000, tax_percent: 18 })],
      extraDiscountPercent: 0,
      extraDiscountAmount: 0,
      roundOffEnabled: false,
      vendorState: '  tamil nadu ',
      companyState: 'TAMIL NADU',
    });
    expect(t.isInterState).toBe(false);
    expect(t.cgst).toBe(90);
  });

  it('defaults to intra-state when either state is unknown', () => {
    const t = calculatePurchaseOrderTotals({
      items: [line({ qty: 1, rate: 1000, tax_percent: 18 })],
      extraDiscountPercent: 0,
      extraDiscountAmount: 0,
      roundOffEnabled: false,
      vendorState: '',
      companyState: TN,
    });
    expect(t.isInterState).toBe(false);
    expect(t.cgst).toBe(90);
    expect(t.sgst).toBe(90);
  });

  it('keeps per-tax-rate groups consistent with the header split', () => {
    const t = calculatePurchaseOrderTotals({
      items: [
        line({ qty: 1, rate: 1000, tax_percent: 18 }),
        line({ qty: 1, rate: 500, tax_percent: 5 }),
      ],
      extraDiscountPercent: 0,
      extraDiscountAmount: 0,
      roundOffEnabled: false,
      vendorState: TN,
      companyState: TN,
    });
    const g18 = t.taxGroups[18];
    const g5 = t.taxGroups[5];
    expect(g18.baseAmount).toBe(1000);
    expect(g18.taxAmount).toBe(180);
    expect(g5.baseAmount).toBe(500);
    expect(g5.taxAmount).toBe(25);
    // header split must equal the sum of group splits
    expect(t.cgst + t.sgst).toBe(round2(g18.cgst + g5.cgst + g18.sgst + g5.sgst));
    expect(t.totalTax).toBe(205);
  });
});

describe('calculatePurchaseOrderTotals — discounts', () => {
  it('applies a header percentage discount', () => {
    const t = calculatePurchaseOrderTotals({
      items: [line({ qty: 1, rate: 1000, tax_percent: 0 })],
      extraDiscountPercent: 10,
      extraDiscountAmount: 0,
      roundOffEnabled: false,
      vendorState: TN,
      companyState: TN,
    });
    expect(t.extraDiscountAmount).toBe(100);
    expect(t.taxableAmount).toBe(900);
    expect(t.grandTotal).toBe(900);
  });

  it('applies a header manual discount', () => {
    const t = calculatePurchaseOrderTotals({
      items: [line({ qty: 1, rate: 1000, tax_percent: 0 })],
      extraDiscountPercent: 0,
      extraDiscountAmount: 250,
      roundOffEnabled: false,
      vendorState: TN,
      companyState: TN,
    });
    expect(t.extraDiscountAmount).toBe(250);
    expect(t.grandTotal).toBe(750);
  });

  it('never drives the taxable base negative', () => {
    const t = calculatePurchaseOrderTotals({
      items: [line({ qty: 1, rate: 100, tax_percent: 0 })],
      extraDiscountPercent: 0,
      extraDiscountAmount: 500,
      roundOffEnabled: false,
      vendorState: TN,
      companyState: TN,
    });
    expect(t.taxableAmount).toBe(0);
  });
});

describe('calculatePurchaseOrderTotals — round off', () => {
  it('rounds up to the nearest rupee when enabled', () => {
    const t = calculatePurchaseOrderTotals({
      items: [line({ qty: 3, rate: 33.33, tax_percent: 0 })],
      extraDiscountPercent: 0,
      extraDiscountAmount: 0,
      roundOffEnabled: true,
      vendorState: TN,
      companyState: TN,
    });
    // 99.99 -> rounds to 100, roundOff +0.01
    expect(t.baseTotal).toBe(99.99);
    expect(t.roundOff).toBe(0.01);
    expect(t.grandTotal).toBe(100);
  });

  it('is zero when disabled', () => {
    const t = calculatePurchaseOrderTotals({
      items: [line({ qty: 3, rate: 33.33, tax_percent: 0 })],
      extraDiscountPercent: 0,
      extraDiscountAmount: 0,
      roundOffEnabled: false,
      vendorState: TN,
      companyState: TN,
    });
    expect(t.roundOff).toBe(0);
    expect(t.grandTotal).toBe(99.99);
  });
});

describe('calculatePurchaseOrderTotals — invariants', () => {
  const totalsFor = (items: PurchaseOrderItem[], vendorState = TN) =>
    calculatePurchaseOrderTotals({
      items,
      extraDiscountPercent: 0,
      extraDiscountAmount: 0,
      roundOffEnabled: false,
      vendorState,
      companyState: TN,
    });

  it('sums lines to the grand total', () => {
    const t = totalsFor([
      line({ qty: 2, rate: 100, tax_percent: 18 }),
      line({ qty: 1, rate: 250.5, tax_percent: 12 }),
    ]);
    expect(t.subtotal).toBe(450.5);
    expect(t.grandTotal).toBe(round2(t.taxableAmount + t.totalTax + t.roundOff));
  });

  it('handles an empty item list without producing NaN', () => {
    const t = totalsFor([]);
    expect(t.subtotal).toBe(0);
    expect(t.grandTotal).toBe(0);
    expect(t.amountInWords).toBe('Zero Only');
  });

  it('produces finite numbers for empty rows', () => {
    const t = totalsFor([line({ rate: 0, qty: 0 })]);
    expect(Number.isFinite(t.grandTotal)).toBe(true);
    expect(t.grandTotal).toBe(0);
  });
});

describe('section headers and sub-total rows', () => {
  const header = (label: string) => ({ _key: 'h1', is_header: true, description: label });
  const subtotal = (key: string) => ({ _key: key, is_subtotal: true, subtotal_label: 'Sub-total:' });
  const l = (key: string, over: Partial<PurchaseOrderItem> = {}) =>
    ({ _key: key, description: 'x', qty: 1, rate: 100, tax_percent: 0, ...over });

  it('ignores section headers in the money totals', () => {
    const t = calculatePurchaseOrderTotals({
      items: [header('Civil'), l('a'), l('b', { rate: 200 })],
      extraDiscountPercent: 0, extraDiscountAmount: 0, roundOffEnabled: false,
      vendorState: TN, companyState: TN,
    });
    expect(t.subtotal).toBe(300);
  });

  it('a sub-total row carries no money of its own', () => {
    const t = calculatePurchaseOrderTotals({
      items: [l('a'), l('b', { rate: 50 })],
      extraDiscountPercent: 0, extraDiscountAmount: 0, roundOffEnabled: false,
      vendorState: TN, companyState: TN,
    });
    const withSubtotal = calculatePurchaseOrderTotals({
      items: [l('a'), l('b', { rate: 50 }), subtotal('s1')],
      extraDiscountPercent: 0, extraDiscountAmount: 0, roundOffEnabled: false,
      vendorState: TN, companyState: TN,
    });
    expect(withSubtotal.grandTotal).toBe(t.grandTotal);
  });

  it('a sub-total sums only the lines above it, and resets for the next group', () => {
    const t = calculatePurchaseOrderTotals({
      items: [
        l('a', { rate: 100 }),
        l('b', { rate: 200 }),
        subtotal('s1'),
        l('c', { rate: 50 }),
        subtotal('s2'),
      ],
      extraDiscountPercent: 0, extraDiscountAmount: 0, roundOffEnabled: false,
      vendorState: TN, companyState: TN,
    });
    expect(t.subtotalByKey['s1']).toBe(300);
    expect(t.subtotalByKey['s2']).toBe(50);
    expect(t.grandTotal).toBe(350);
  });

  it('extractBillableLines drops header and sub-total rows', () => {
    const kept = extractBillableLines([header('Civil'), l('a'), subtotal('s1'), l('b')]);
    expect(kept).toHaveLength(2);
    expect(kept.every(i => !i.is_header && !i.is_subtotal)).toBe(true);
  });

  it('sectionForLine walks back to the nearest header', () => {
    const items = [header('Civil'), l('a'), header('Electrical'), l('b')];
    expect(sectionForLine(items, 1)).toBe('Civil');
    expect(sectionForLine(items, 3)).toBe('Electrical');
  });

  it('sectionForLine returns empty with no preceding header', () => {
    expect(sectionForLine([l('a')], 0)).toBe('');
  });
});

describe('buildPurchaseOrderItemPayload', () => {
  it('maps a line to the RPC shape', () => {
    const p = buildPurchaseOrderItemPayload(
      line({ qty: 2, rate: 100, discount_percent: 10, tax_percent: 18, hsn_code: '8471' })
    );
    expect(p.item_name).toBe('Item');
    expect(p.quantity).toBe(2);
    expect(p.rate).toBe(100);
    expect(p.discount_amount).toBe(20);
    expect(p.tax_percent).toBe(18);
    expect(p.hsn_code).toBe('8471');
    expect(p.unit).toBe('Nos');
  });

  it('defaults a missing description to "Item" so the server can accept it', () => {
    const p = buildPurchaseOrderItemPayload(line({ description: '' }));
    expect(p.item_name).toBe('Item');
  });

  it('nulls optional identity fields rather than sending empty strings', () => {
    const p = buildPurchaseOrderItemPayload(line({ hsn_code: undefined, make: undefined }));
    expect(p.hsn_code).toBeNull();
    expect(p.make).toBeNull();
  });

  it('keeps item_name (what the line is) separate from description (what it says)', () => {
    const p = buildPurchaseOrderItemPayload(
      line({ description: 'For pump room' }) as any,
    );
    // line() defaults description to 'Item'; an explicit item_name wins.
    const q = buildPurchaseOrderItemPayload({ ...line({ description: 'For pump room' }), item_name: 'PPR PIPE' } as any);
    expect(q.item_name).toBe('PPR PIPE');
    expect(q.description).toBe('For pump room');
    expect(p.description).toBe('For pump room');
  });
});
