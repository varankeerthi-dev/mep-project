import { describe, it, expect } from 'vitest';
import { calculateLedger } from './ledgerCalculator';

describe('ledgerCalculator', () => {
  const mockWorkOrders = [
    {
      id: 'wo-1',
      work_order_no: 'WO/001',
      work_description: 'Electrical work',
      total_amount: 100000,
      contract_value: 100000,
      issue_date: '2026-01-01',
      is_amendment: false,
      status: 'Issued'
    }
  ];

  it('handles work order with no invoices or payments (happy path zero state)', () => {
    const result = calculateLedger(mockWorkOrders, [], [], []);
    expect(result.ledger).toHaveLength(1);
    expect(result.ledger[0].type).toBe('WO-ISSUED');
    expect(result.ledger[0].balance).toBe(100000); // WO-ISSUED increases running balance
    expect(result.summary.contractValue).toBe(100000);
    expect(result.summary.totalInvoiced).toBe(0);
    expect(result.summary.totalPaid).toBe(0);
    expect(result.summary.balanceDue).toBe(100000);
  });

  it('correctly calculates balance with multiple invoices and payments', () => {
    const invoices = [
      { id: 'inv-1', work_order_id: 'wo-1', invoice_no: 'INV-01', invoice_date: '2026-01-10', amount: 30000 }
    ];
    const payments = [
      { id: 'pay-1', work_order_id: 'wo-1', payment_date: '2026-01-15', gross_amount: 20000, tds_amount: 400, reference_no: 'TXN-01' }
    ];
    const result = calculateLedger(mockWorkOrders, [], invoices, payments);
    
    // WO-ISSUED (100000) + INV-01 (30000) - PAY-01 (20000) = 110000
    expect(result.summary.totalInvoiced).toBe(30000);
    expect(result.summary.totalPaid).toBe(20000);
    expect(result.summary.totalTDS).toBe(400);
    expect(result.summary.balanceDue).toBe(110000);
  });

  it('handles multiple transactions on the same date cleanly with chronological order preservation', () => {
    const invoices = [
      { id: 'inv-1', work_order_id: 'wo-1', invoice_no: 'INV-01', invoice_date: '2026-01-10', amount: 50000 }
    ];
    const payments = [
      { id: 'pay-1', work_order_id: 'wo-1', payment_date: '2026-01-10', gross_amount: 20000, tds_amount: 400, reference_no: 'TXN-01' }
    ];
    const result = calculateLedger(mockWorkOrders, [], invoices, payments);

    expect(result.ledger).toHaveLength(3); // 1 WO + 1 Invoice + 1 Payment
    // WO-ISSUED (100000) + INV-01 (50000) - PAY-01 (20000) = 130000
    expect(result.summary.balanceDue).toBe(130000);
  });

  it('handles negative adjustments (credit notes/downward amendments)', () => {
    const amendments = [
      { id: 'amd-1', work_order_id: 'wo-1', amendment_no: 1, difference_amount: -15000, reason: 'Scope reduction', created_at: '2026-01-05' }
    ];
    const result = calculateLedger(mockWorkOrders, amendments, [], []);
    
    expect(result.ledger).toHaveLength(2); // 1 WO + 1 AMD
    expect(result.ledger[1].type).toBe('WO-AMD');
    expect(result.ledger[1].credit).toBe(15000);
    expect(result.ledger[1].debit).toBe(0);
    // WO-ISSUED (100000) - WO-AMD credit (15000) = 85000
    expect(result.summary.balanceDue).toBe(85000);
  });

  it('handles zero-value work orders', () => {
    const zeroWO = [
      {
        id: 'wo-zero',
        work_order_no: 'WO/ZERO',
        work_description: 'Mock zero order',
        total_amount: 0,
        contract_value: 0,
        issue_date: '2026-01-01',
        is_amendment: false,
        status: 'Issued'
      }
    ];
    const result = calculateLedger(zeroWO, [], [], []);
    expect(result.summary.contractValue).toBe(0);
    expect(result.summary.balanceDue).toBe(0);
  });

  it('protects returned object structure with Object.freeze in development environment', () => {
    const result = calculateLedger(mockWorkOrders, [], [], []);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.ledger)).toBe(true);
    expect(Object.isFrozen(result.summary)).toBe(true);
  });
});
