import { describe, it, expect } from 'vitest';
import { calculateFinance } from './financeCalculator';

describe('financeCalculator V2', () => {
  it('calculates intrastate GST (CGST/SGST) correctly', () => {
    const result = calculateFinance({
      lineItems: [{ amount: 1000 }, { amount: 2000 }],
      taxType: 'GST',
      cgstPercent: 9,
      sgstPercent: 9,
      igstPercent: 0,
      retentionHeld: false
    });

    expect(result.subtotal).toBe(3000);
    expect(result.cgstAmount).toBe(270);
    expect(result.sgstAmount).toBe(270);
    expect(result.igstAmount).toBe(0);
    expect(result.tdsAmount).toBe(0);
    expect(result.totalAmount).toBe(3540);
  });

  it('calculates interstate GST (IGST) correctly', () => {
    const result = calculateFinance({
      lineItems: [{ amount: 5000 }],
      taxType: 'GST',
      cgstPercent: 0,
      sgstPercent: 0,
      igstPercent: 18,
      retentionHeld: false
    });

    expect(result.subtotal).toBe(5000);
    expect(result.cgstAmount).toBe(0);
    expect(result.sgstAmount).toBe(0);
    expect(result.igstAmount).toBe(900);
    expect(result.totalAmount).toBe(5900);
  });

  it('calculates TDS deduction correctly without altering totalAmount', () => {
    const result = calculateFinance({
      lineItems: [{ amount: 10000 }],
      taxType: 'TDS',
      tdsPercent: 2,
      retentionHeld: false
    });

    expect(result.subtotal).toBe(10000);
    expect(result.tdsAmount).toBe(200);
    expect(result.totalAmount).toBe(10000);
  });

  it('calculates retention amount correctly when enabled', () => {
    const result = calculateFinance({
      lineItems: [{ amount: 100000 }],
      taxType: 'None',
      retentionHeld: true,
      retentionPercent: 5
    });

    expect(result.subtotal).toBe(100000);
    expect(result.retentionAmount).toBe(5000);
  });

  it('ignores retention calculation when retentionHeld is disabled', () => {
    const result = calculateFinance({
      lineItems: [{ amount: 100000 }],
      taxType: 'None',
      retentionHeld: false,
      retentionPercent: 5
    });

    expect(result.retentionAmount).toBe(0);
  });

  it('handles rounding logic at half-cents and precision thresholds', () => {
    const result = calculateFinance({
      lineItems: [{ amount: 12.33 }],
      taxType: 'GST',
      cgstPercent: 9,
      sgstPercent: 9,
      retentionHeld: false
    });
    expect(result.cgstAmount).toBe(1.1097);
  });

  it('handles zero-value items correctly', () => {
    const result = calculateFinance({
      lineItems: [],
      taxType: 'GST',
      cgstPercent: 9,
      sgstPercent: 9,
      retentionHeld: true,
      retentionPercent: 5
    });

    expect(result.subtotal).toBe(0);
    expect(result.totalAmount).toBe(0);
    expect(result.retentionAmount).toBe(0);
  });

  it('handles negative adjustments correctly', () => {
    const result = calculateFinance({
      lineItems: [{ amount: -5000 }],
      taxType: 'GST',
      cgstPercent: 18,
      retentionHeld: false
    });

    expect(result.subtotal).toBe(-5000);
    expect(result.cgstAmount).toBe(-900);
    expect(result.totalAmount).toBe(-5900);
  });

  it('handles 100% advance percent limit', () => {
    const result = calculateFinance({
      lineItems: [{ amount: 10000 }],
      taxType: 'None',
      advancePercent: 100,
      retentionHeld: false
    });

    expect(result.advanceAmount).toBe(10000);
  });

  it('freezes output object in development environment', () => {
    const result = calculateFinance({
      lineItems: [{ amount: 100 }],
      taxType: 'None',
      retentionHeld: false
    });
    expect(Object.isFrozen(result)).toBe(true);
  });
});
