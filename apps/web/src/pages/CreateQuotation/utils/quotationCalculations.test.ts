import { describe, it, expect } from 'vitest';
import {
  numberToWords,
  calculateLineItem,
  calculateQuotationTotals,
  buildQuotationItemPayload,
} from './quotationCalculations';

describe('numberToWords', () => {
  it('converts zero', () => {
    expect(numberToWords(0)).toBe('Zero Only');
  });

  it('converts simple numbers', () => {
    expect(numberToWords(1)).toBe('One Only');
    expect(numberToWords(25)).toBe('Twenty Five Only');
    expect(numberToWords(100)).toBe('One Hundred Only');
  });

  it('rounds before converting', () => {
    expect(numberToWords(1234.56)).toBe('One Thousand Two Hundred and Thirty Five Only');
  });

  it('handles large numbers up to crore', () => {
    expect(numberToWords(12345678)).toBe('One Crore Twenty Three Lakh Forty Five Thousand Six Hundred and Seventy Eight Only');
  });
});

describe('calculateLineItem', () => {
  it('computes line totals from qty/rate/tax', () => {
    const result = calculateLineItem({
      qty: 2,
      rate: 100,
      tax_percent: 18,
      base_rate_snapshot: 100,
    });
    expect(result.qty).toBe(2);
    expect(result.finalRate).toBe(100);
    expect(result.baseRate).toBe(100);
    expect(result.grossBase).toBe(200);
    expect(result.net).toBe(200);
    expect(result.discountAmount).toBe(0);
    expect(result.taxable).toBe(200);
    expect(result.taxPercent).toBe(18);
    expect(result.taxAmount).toBe(36);
    expect(result.lineTotal).toBe(236);
  });

  it('uses base_rate_snapshot for discount when rate is overridden', () => {
    const result = calculateLineItem({
      qty: 1,
      rate: 80,
      base_rate_snapshot: 100,
      tax_percent: 10,
    });
    expect(result.baseRate).toBe(100);
    expect(result.grossBase).toBe(100);
    expect(result.net).toBe(80);
    expect(result.discountAmount).toBe(20);
    expect(result.taxable).toBe(80);
    expect(result.taxAmount).toBe(8);
    expect(result.lineTotal).toBe(88);
  });

  it('defaults missing numeric fields to zero', () => {
    const result = calculateLineItem({});
    expect(result.qty).toBe(0);
    expect(result.finalRate).toBe(0);
    expect(result.baseRate).toBe(0);
    expect(result.net).toBe(0);
    expect(result.taxAmount).toBe(0);
    expect(result.lineTotal).toBe(0);
  });
});

describe('calculateQuotationTotals', () => {
  const baseItems = [
    { description: 'Item A', qty: 2, rate: 100, tax_percent: 18, base_rate_snapshot: 100 },
    { description: 'Item B', qty: 1, rate: 200, tax_percent: 12, base_rate_snapshot: 200 },
  ];

  it('computes subtotal, tax, and grand total for a simple quotation', () => {
    const result = calculateQuotationTotals({
      items: baseItems,
      extraDiscountPercent: 0,
      extraDiscountAmount: 0,
      roundOffEnabled: false,
      roundOff: 0,
      state: 'Maharashtra',
      companyState: 'Maharashtra',
    });

    expect(result.subtotal).toBeCloseTo(400);
    expect(result.totalItemDiscount).toBeCloseTo(0);
    expect(result.totalTax).toBeCloseTo(60);
    expect(result.grandTotal).toBeCloseTo(460);
    expect(result.isInterState).toBe(false);
    expect(result.cgst).toBeCloseTo(30);
    expect(result.sgst).toBeCloseTo(30);
    expect(result.igst).toBeCloseTo(0);
  });

  it('applies extra percentage discount before tax', () => {
    const result = calculateQuotationTotals({
      items: baseItems,
      extraDiscountPercent: 10,
      extraDiscountAmount: 0,
      roundOffEnabled: false,
      roundOff: 0,
      state: 'Karnataka',
      companyState: 'Karnataka',
    });

    expect(result.subtotal).toBeCloseTo(400);
    expect(result.extraDiscountAmount).toBeCloseTo(40);
    expect(result.totalTax).toBeCloseTo(60);
    expect(result.grandTotal).toBeCloseTo(420); // 400 - 40 + 60
    expect(result.isInterState).toBe(false);
  });

  it('applies fixed extra discount', () => {
    const result = calculateQuotationTotals({
      items: baseItems,
      extraDiscountPercent: 0,
      extraDiscountAmount: 50,
      roundOffEnabled: false,
      roundOff: 0,
      state: 'Gujarat',
      companyState: 'Gujarat',
    });

    expect(result.grandTotal).toBeCloseTo(410); // 400 - 50 + 60
  });

  it('switches to IGST for inter-state', () => {
    const result = calculateQuotationTotals({
      items: baseItems,
      extraDiscountPercent: 0,
      extraDiscountAmount: 0,
      roundOffEnabled: false,
      roundOff: 0,
      state: 'Karnataka',
      companyState: 'Maharashtra',
    });

    expect(result.isInterState).toBe(true);
    expect(result.cgst).toBeCloseTo(0);
    expect(result.sgst).toBeCloseTo(0);
    expect(result.igst).toBeCloseTo(60);
    expect(result.grandTotal).toBeCloseTo(460);
  });

  it('applies round-off when enabled', () => {
    const result = calculateQuotationTotals({
      items: [{ description: 'X', qty: 1, rate: 10.5, tax_percent: 0, base_rate_snapshot: 10.5 }],
      extraDiscountPercent: 0,
      extraDiscountAmount: 0,
      roundOffEnabled: true,
      roundOff: 0,
      state: 'Maharashtra',
      companyState: 'Maharashtra',
    });

    expect(result.subtotal).toBeCloseTo(10.5);
    expect(result.baseTotal).toBeCloseTo(10.5);
    expect(result.roundOff).toBeCloseTo(0.5);
    expect(result.grandTotal).toBeCloseTo(11);
  });

  it('uses manual round-off when disabled', () => {
    const result = calculateQuotationTotals({
      items: [{ description: 'X', qty: 1, rate: 10.5, tax_percent: 0, base_rate_snapshot: 10.5 }],
      extraDiscountPercent: 0,
      extraDiscountAmount: 0,
      roundOffEnabled: false,
      roundOff: 2.5,
      state: 'Maharashtra',
      companyState: 'Maharashtra',
    });

    expect(result.roundOff).toBeCloseTo(2.5);
    expect(result.grandTotal).toBeCloseTo(13);
  });

  it('skips header and subtotal rows from totals', () => {
    const result = calculateQuotationTotals({
      items: [
        { description: 'A', qty: 1, rate: 100, tax_percent: 0, is_header: true },
        { description: 'B', qty: 1, rate: 100, tax_percent: 0 },
        { description: 'Sub', qty: 0, rate: 0, tax_percent: 0, is_subtotal: true, subtotal_label: 'Sub-total:' },
      ],
      extraDiscountPercent: 0,
      extraDiscountAmount: 0,
      roundOffEnabled: false,
      roundOff: 0,
      state: 'Maharashtra',
      companyState: 'Maharashtra',
    });

    expect(result.subtotal).toBeCloseTo(100);
    expect(result.subTotalGroups['Sub-total:']).toBeCloseTo(100);
  });

  it('handles zero-quantity items as zero contribution', () => {
    const result = calculateQuotationTotals({
      items: [{ description: 'Free', qty: 0, rate: 100, tax_percent: 18, base_rate_snapshot: 100 }],
      extraDiscountPercent: 0,
      extraDiscountAmount: 0,
      roundOffEnabled: false,
      roundOff: 0,
      state: 'Maharashtra',
      companyState: 'Maharashtra',
    });

    expect(result.subtotal).toBeCloseTo(0);
    expect(result.totalTax).toBeCloseTo(0);
    expect(result.grandTotal).toBeCloseTo(0);
  });

  it('preserves existing tax-group aggregation behavior', () => {
    const result = calculateQuotationTotals({
      items: [
        { description: 'A', qty: 1, rate: 100, tax_percent: 18 },
        { description: 'B', qty: 1, rate: 100, tax_percent: 18 },
        { description: 'C', qty: 1, rate: 100, tax_percent: 12 },
      ],
      extraDiscountPercent: 0,
      extraDiscountAmount: 0,
      roundOffEnabled: false,
      roundOff: 0,
      state: 'Maharashtra',
      companyState: 'Maharashtra',
    });

    expect(result.taxGroups[18].taxAmount).toBeCloseTo(36);
    expect(result.taxGroups[18].sgst).toBeCloseTo(18);
    expect(result.taxGroups[18].cgst).toBeCloseTo(18);
    expect(result.taxGroups[12].taxAmount).toBeCloseTo(12);
    expect(result.totalTax).toBeCloseTo(48);
  });
});

describe('buildQuotationItemPayload', () => {
  it('builds a standard material payload', () => {
    const payload = buildQuotationItemPayload({
      item_id: 'mat-1',
      variant_id: 'var-1',
      description: 'Pipe',
      qty: 5,
      uom: 'nos',
      rate: 120,
      discount_percent: 10,
      tax_percent: 18,
      base_rate_snapshot: 120,
      applied_discount_percent: 10,
      is_override: false,
      final_rate_snapshot: 108,
      is_header: false,
      is_subtotal: false,
      subtotal_label: null,
      custom1: 'c1',
      custom2: 'c2',
    });

    expect(payload.item_id).toBe('mat-1');
    expect(payload.variant_id).toBe('var-1');
    expect(payload.description).toBe('Pipe');
    expect(payload.qty).toBe(5);
    expect(payload.rate).toBe(120);
    expect(payload.discount_percent).toBe(10);
    expect(payload.tax_percent).toBe(18);
    expect(payload.sac_code).toBeNull();
    expect(payload.base_rate_snapshot).toBe(120);
    expect(payload.final_rate_snapshot).toBe(108);
    expect(payload.is_header).toBe(false);
    expect(payload.is_subtotal).toBe(false);
  });

  it('builds an erection payload with default sac_code and null item_id', () => {
    const payload = buildQuotationItemPayload(
      {
        description: 'Erection',
        qty: 1,
        rate: 500,
        tax_percent: 18,
        base_rate_snapshot: 500,
        final_rate_snapshot: 500,
      },
      true,
    );

    expect(payload.item_id).toBeNull();
    expect(payload.description).toBe('Erection');
    expect(payload.sac_code).toBe('995419');
    expect(payload.rate).toBe(500);
  });

  it('falls back to rate when snapshot fields are missing', () => {
    const payload = buildQuotationItemPayload({
      qty: 1,
      rate: 75,
      tax_percent: 0,
    });

    expect(payload.base_rate_snapshot).toBe(75);
    expect(payload.final_rate_snapshot).toBe(75);
    expect(payload.rate).toBe(75);
  });

  it('coerces booleans and nulls safely', () => {
    const payload = buildQuotationItemPayload({
      description: '',
      qty: null,
      rate: '',
      tax_percent: '',
      is_header: 'true',
      is_subtotal: 1,
      subtotal_label: '',
    });

    expect(payload.qty).toBeNull();
    expect(payload.rate).toBe(0);
    expect(payload.tax_percent).toBe(0);
    expect(payload.is_header).toBe(true);
    expect(payload.is_subtotal).toBe(true);
    expect(payload.description).toBe('');
    expect(payload.subtotal_label).toBeNull();
  });
});

describe('MRP-driven totals contract (updateItem must derive rate from MRP first)', () => {
  const totalsInput = (items: any[]) => ({
    items,
    extraDiscountPercent: 0,
    extraDiscountAmount: 0,
    roundOffEnabled: false,
    roundOff: 0,
    state: 'Karnataka',
    companyState: 'Karnataka',
  });

  it('MRP 500 with 0% discount totals qty*MRP plus tax (never zero)', () => {
    const totals = calculateQuotationTotals(
      totalsInput([{ description: 'MRP item', qty: 2, rate: 500, tax_percent: 18, base_rate_snapshot: 500 }]),
    );
    expect(totals.subtotal).toBe(1000);
    expect(totals.totalItemDiscount).toBe(0);
    expect(totals.totalTax).toBe(180);
    expect(totals.grandTotal).toBe(1180);
  });

  it('MRP 500 with 10% discount nets 450/unit with 50/unit discount', () => {
    const totals = calculateQuotationTotals(
      totalsInput([{ description: 'Disc item', qty: 2, rate: 450, tax_percent: 18, base_rate_snapshot: 500 }]),
    );
    expect(totals.subtotal).toBe(900);
    expect(totals.totalItemDiscount).toBe(100);
    expect(totals.grandTotal).toBe(900 + 162);
  });

  it('a zero-rate line contributes zero (the pre-fix symptom)', () => {
    const totals = calculateQuotationTotals(
      totalsInput([{ description: 'Unpriced', qty: 2, rate: 0, tax_percent: 18, base_rate_snapshot: 500 }]),
    );
    expect(totals.subtotal).toBe(0);
    expect(totals.grandTotal).toBe(0);
  });
});
