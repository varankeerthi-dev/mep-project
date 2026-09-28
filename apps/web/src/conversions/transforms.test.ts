import { describe, expect, it, vi } from 'vitest';

vi.mock('../supabase', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));

import {
  transformSalesOrderToInvoice,
  transformSalesOrderToChallan,
  type SalesOrderSourceData,
} from './api';

const baseSource: SalesOrderSourceData = {
  id: 'aaaaaaaa-0000-4000-8000-000000000001',
  sales_order_no: 'SO-2026-0007',
  client_id: 'bbbbbbbb-0000-4000-8000-000000000002',
  client_state: 'Tamil Nadu',
  project_id: null,
  billing_address: 'Buyer street 1',
  shipping_address: 'Site street 9',
  gstin: '33ABCDE1234F1Z5',
  state: 'Tamil Nadu',
  order_date: '2026-09-27',
  payment_terms: null,
  remarks: 'Handle with care',
  subtotal: 900,
  grand_total: 1062,
  client_po_number: 'PO-C-11',
  client_po_date: '2026-09-20',
  items: [
    {
      id: 'cccccccc-0000-4000-8000-000000000003',
      item_id: 'dddddddd-0000-4000-8000-000000000004',
      variant_id: null,
      description: 'PPR Pipe 160mm',
      hsn_code: null,
      qty: 10,
      uom: 'nos',
      rate: 100,
      discount_percent: 10,
      tax_percent: 18,
      line_total: 1062,
      make: null,
    },
  ],
};

describe('transformSalesOrderToInvoice', () => {
  it('derives the net rate from base rate and discount (no double discount)', () => {
    const res = transformSalesOrderToInvoice(baseSource);
    expect(res.conversionType).toBe('sales-order-to-invoice');
    expect(res.sourceType).toBe('Sales Order');
    expect(res.sourceNumber).toBe('SO-2026-0007');
    expect(res.targetDocumentType).toBe('invoice');
    const item = (res.data as any).items[0];
    expect(item.rate).toBeCloseTo(90, 6);
    expect(item.amount).toBeCloseTo(900, 6);
    expect(item.tax_percent).toBe(18);
  });

  it('passes provenance and commercial references through', () => {
    const res = transformSalesOrderToInvoice(baseSource);
    const data = res.data as any;
    expect(data.client_id).toBe(baseSource.client_id);
    expect(data.source_type).toBe('sales-order');
    expect(data.source_id).toBe(baseSource.id);
    expect(data.po_number).toBe('PO-C-11');
    expect(data.po_date).toBe('2026-09-20');
    expect(data.items[0].meta_json.item_id).toBe('dddddddd-0000-4000-8000-000000000004');
  });

  it('passes zero-discount lines through unchanged', () => {
    const src = {
      ...baseSource,
      items: [{ ...baseSource.items[0], rate: 50, discount_percent: 0, qty: 4 }],
    };
    const res = transformSalesOrderToInvoice(src);
    const item = (res.data as any).items[0];
    expect(item.rate).toBeCloseTo(50, 6);
    expect(item.amount).toBeCloseTo(200, 6);
  });
});

describe('transformSalesOrderToChallan', () => {
  it('maps lines with net rates and ship-to details', () => {
    const res = transformSalesOrderToChallan(baseSource);
    expect(res.conversionType).toBe('sales-order-to-challan');
    expect(res.targetDocumentType).toBe('dc');
    const data = res.data as any;
    expect(data.ship_to_address).toBe('Site street 9');
    expect(data.ship_to_state).toBe('Tamil Nadu');
    expect(data.po_number).toBe('PO-C-11');
    expect(data.remarks).toBe('Handle with care');
    expect(data.items[0]).toMatchObject({
      material_id: 'dddddddd-0000-4000-8000-000000000004',
      material_name: 'PPR Pipe 160mm',
      quantity: 10,
      rate: 90,
      amount: 900,
    });
  });
});
