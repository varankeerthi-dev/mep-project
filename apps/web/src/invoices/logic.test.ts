import { describe, it, expect } from 'vitest';
import {
  calculateInvoiceTotals,
  effectiveLineRate,
  isStructuralRow,
  calculateTotals,
} from './logic';
import { calculateDraftTotals, composeInvoiceInput, normalizeItemMeta } from './ui-utils';
import { InvoiceSchema } from './schemas';

/**
 * These tests pin the single canonical totals engine against the behaviours
 * that previously diverged. `finalize_sales_invoice` in SQL is the authority:
 * it skips structural rows and splits CGST/SGST per line with per-line
 * rounding. Every case below is annotated with the server result it mirrors.
 */

/** A minimal but complete editor line: description is required by Zod. */
function line(over: Record<string, unknown> = {}) {
  return {
    description: 'Test item',
    qty: 1,
    rate: 100,
    amount: 100,
    discount_percent: 0,
    is_header: false,
    is_subtotal: false,
    hsn_code: null,
    meta_json: { tax_percent: 18 },
    ...over,
  } as never;
}

describe('isStructuralRow', () => {
  it('treats header and subtotal rows as non-financial', () => {
    expect(isStructuralRow({ is_header: true })).toBe(true);
    expect(isStructuralRow({ is_subtotal: true })).toBe(true);
    expect(isStructuralRow({ is_header: false, is_subtotal: false })).toBe(false);
    expect(isStructuralRow({})).toBe(false);
  });
});

describe('effectiveLineRate', () => {
  it('discounts from the catalog base rate when present', () => {
    expect(effectiveLineRate({ rate: 100, discount_percent: 10, meta_json: { base_rate: 200 } })).toBe(180);
  });

  it('falls back to rate when no base rate is recorded', () => {
    expect(effectiveLineRate({ rate: 100, discount_percent: 10 })).toBe(90);
  });

  it('returns the full rate at zero discount', () => {
    expect(effectiveLineRate({ rate: 250, discount_percent: 0, meta_json: { base_rate: 250 } })).toBe(250);
  });
});

describe('calculateInvoiceTotals — parity with finalize_sales_invoice', () => {
  it('splits CGST/SGST per line, matching the server on 10.50 @ 18%', () => {
    // Server: ROUND(10.50 * 18/2/100, 2) = 0.95 for each half.
    // The old client split the tax total: 0.95 / 0.94. That 0.01 is the bug.
    const t = calculateInvoiceTotals([line({ qty: 1, rate: 10.5 })], 'Maharashtra', 'Maharashtra');

    expect(t.cgst).toBe(0.95);
    expect(t.sgst).toBe(0.95);
    expect(t.total).toBe(12.4);
  });

  it('excludes section-header rows from every figure', () => {
    const items = [
      line({ qty: 2, rate: 100 }),
      line({ is_header: true, qty: 1, rate: 999, subtotal_label: 'Pipes' }),
    ];

    const t = calculateInvoiceTotals(items, 'Maharashtra', 'Maharashtra');

    expect(t.subtotal).toBe(200);
    expect(t.total).toBe(236);
  });

  it('excludes subtotal rows even when they carry qty and a section total', () => {
    // A subtotal row holding qty 1 and the section sum used to be counted on
    // top of its own section, double-counting the document.
    const items = [
      line({ qty: 2, rate: 100 }),
      line({ is_subtotal: true, qty: 1, rate: 200, subtotal_label: 'Section total' }),
    ];

    const t = calculateInvoiceTotals(items, 'Maharashtra', 'Maharashtra');

    expect(t.subtotal).toBe(200);
    expect(t.cgst).toBe(18);
    expect(t.sgst).toBe(18);
    expect(t.total).toBe(236);
  });

  it('uses IGST alone when the client state differs', () => {
    const t = calculateInvoiceTotals([line({ qty: 1, rate: 100 })], 'Maharashtra', 'Karnataka');

    expect(t.interstate).toBe(true);
    expect(t.igst).toBe(18);
    expect(t.cgst).toBe(0);
    expect(t.sgst).toBe(0);
  });

  it('defaults to intra-state when either state is missing, like the server', () => {
    const t = calculateInvoiceTotals([line({ qty: 1, rate: 100 })], 'Maharashtra', null);

    expect(t.interstate).toBe(false);
    expect(t.cgst).toBe(9);
    expect(t.sgst).toBe(9);
  });

  it('honours per-line tax percentages', () => {
    const t = calculateInvoiceTotals(
      [
        line({ qty: 1, rate: 100, meta_json: { tax_percent: 18 } }),
        line({ qty: 1, rate: 100, meta_json: { tax_percent: 5 } }),
      ],
      'Maharashtra',
      'Maharashtra',
    );

    expect(t.cgst).toBe(9 + 2.5);
    expect(t.sgst).toBe(9 + 2.5);
  });

  it('falls back to 18% when tax_percent is absent or unparseable', () => {
    const t = calculateInvoiceTotals(
      [line({ qty: 1, rate: 100, meta_json: {} })],
      'Maharashtra',
      'Maharashtra',
    );

    expect(t.cgst).toBe(9);
  });

  it('applies the line discount before tax, matching the persisted rate', () => {
    // composeInvoiceInput persists rate already net of discount, and the
    // server multiplies qty * rate. The footer must agree with that.
    const t = calculateInvoiceTotals(
      [line({ qty: 2, rate: 90, discount_percent: 10, meta_json: { base_rate: 100, tax_percent: 18 } })],
      'Maharashtra',
      'Maharashtra',
    );

    expect(t.subtotal).toBe(180);
    expect(t.cgst).toBe(16.2);
    expect(t.total).toBe(212.4);
  });
});

describe('round-off is data, not a UI-only concept', () => {
  it('reports the adjustment so it can be persisted', () => {
    const t = calculateInvoiceTotals([line({ qty: 1, rate: 10.5 })], 'Maharashtra', 'Maharashtra', true);

    // 12.40 rounds to 12; the -0.40 adjustment must survive to the row.
    expect(t.totalBeforeRoundOff).toBe(12.4);
    expect(t.roundOff).toBe(-0.4);
    expect(t.total).toBe(12);
  });

  it('keeps total equal to subtotal + tax + roundOff in both modes', () => {
    const items = [line({ qty: 3, rate: 33.33 })];

    for (const enabled of [false, true]) {
      const t = calculateInvoiceTotals(items, 'Maharashtra', 'Maharashtra', enabled);
      expect(t.total).toBeCloseTo(t.subtotal + t.taxTotal + t.roundOff, 2);
    }
  });

  it('leaves roundOff at zero when disabled', () => {
    const t = calculateInvoiceTotals([line({ qty: 1, rate: 10.5 })], 'Maharashtra', 'Maharashtra', false);

    expect(t.roundOff).toBe(0);
    expect(t.total).toBe(12.4);
  });
});

describe('the two JS engines no longer disagree', () => {
  it('calculateDraftTotals and calculateTotals produce identical figures', () => {
    // One discounted line, one structural row, one line whose per-line tax
    // split used to round differently. Both engines must land on one answer.
    const formItems = [
      line({ qty: 2, rate: 90, discount_percent: 10, meta_json: { base_rate: 100, tax_percent: 18 } }),
      line({ is_subtotal: true, qty: 1, rate: 180 }),
      line({ qty: 1, rate: 10.5, meta_json: { tax_percent: 18 } }),
    ];

    const draft = calculateDraftTotals(
      { items: formItems, company_state: 'Maharashtra', client_state: 'Maharashtra' },
      false,
    );

    const payload = calculateTotals({
      items: formItems as never,
      company_state: 'Maharashtra',
      client_state: 'Maharashtra',
    });

    expect(payload.subtotal).toBe(draft.subtotal);
    expect(payload.cgst).toBe(draft.cgst);
    expect(payload.sgst).toBe(draft.sgst);
    expect(payload.igst).toBe(draft.igst);
    expect(payload.total).toBe(draft.total);
  });
});

describe('normalizeItemMeta preserves lineage', () => {
  it('keeps po/quotation/proforma line ids through normalisation', () => {
    const meta = normalizeItemMeta({
      po_line_item_id: 'po-line-1',
      quotation_item_id: 'quote-line-1',
      client_custom_label: 'Grade',
      serial_numbers: ['SN-1'],
      batch_no: 'B-9',
    });

    expect(meta.po_line_item_id).toBe('po-line-1');
    expect(meta.quotation_item_id).toBe('quote-line-1');
    expect(meta.serial_numbers).toEqual(['SN-1']);
    expect(meta.batch_no).toBe('B-9');
  });

  it('still applies the tax and uom defaults', () => {
    const meta = normalizeItemMeta({ po_line_item_id: 'x' });

    expect(meta.tax_percent).toBe(18);
    expect(meta.uom).toBe('Nos');
  });

  it('defaults tax to 18 when absent but respects a stored 0', () => {
    expect(normalizeItemMeta({}).tax_percent).toBe(18);
    expect(normalizeItemMeta({ tax_percent: 0 }).tax_percent).toBe(0);
  });
});

describe('composeInvoiceInput round-trip', () => {
  const baseValues = {
    client_id: '11111111-1111-1111-1111-111111111111',
    template_id: null,
    invoice_no: 'INV-1',
    invoice_date: '2026-01-01',
    due_date: '2026-02-01',
    po_number: '',
    po_date: '',
    prepared_by: '',
    remarks: '',
    authorized_signatory_id: null,
    terms_text: '',
    terms_template_id: '',
    source_type: 'quotation' as const,
    source_id: '22222222-2222-2222-2222-222222222222',
    template_type: 'standard' as const,
    mode: 'itemized' as const,
    status: 'draft' as const,
    company_state: 'Maharashtra',
    client_state: 'Maharashtra',
    shipping_address_id: null,
    default_warehouse_id: null,
    deduct_stock_on_finalize: false,
    allow_insufficient_stock: false,
    materials: [],
  };

  it('carries due_date into the persisted payload', () => {
    const composed = composeInvoiceInput(
      {
        ...baseValues,
        items: [line({ qty: 1, rate: 100, meta_json: { tax_percent: 18, po_line_item_id: 'po-1' } }) as never],
      },
      { subtotal: 100, cgst: 9, sgst: 9, igst: 0, total: 118, roundOff: 0 },
    );

    expect(composed.due_date).toBe('2026-02-01');
  });

  it('preserves lineage keys on the item it persists', () => {
    const composed = composeInvoiceInput(
      {
        ...baseValues,
        items: [
          line({ qty: 1, rate: 100, meta_json: { tax_percent: 18, po_line_item_id: 'po-1', quotation_item_id: 'q-1' } }) as never,
        ],
      },
      { subtotal: 100, cgst: 9, sgst: 9, igst: 0, total: 118, roundOff: 0 },
    );

    expect(composed.items[0].meta_json.po_line_item_id).toBe('po-1');
    expect(composed.items[0].meta_json.quotation_item_id).toBe('q-1');
  });

  it('passes round_off through so the server can honour it', () => {
    const composed = composeInvoiceInput(
      { ...baseValues, items: [line({ qty: 1, rate: 10.5 }) as never] },
      { subtotal: 10.5, cgst: 0.95, sgst: 0.95, igst: 0, total: 12, roundOff: -0.4 },
    );

    expect(composed.round_off).toBe(-0.4);
  });

  it('nets the discount into the persisted rate so the server reproduces it', () => {
    const composed = composeInvoiceInput(
      {
        ...baseValues,
        items: [
          line({ qty: 2, rate: 90, discount_percent: 10, meta_json: { base_rate: 100, tax_percent: 18 } }) as never,
        ],
      },
      { subtotal: 180, cgst: 16.2, sgst: 16.2, igst: 0, total: 212.4, roundOff: 0 },
    );

    // The server recomputes qty * rate, so rate must already be net.
    expect(composed.items[0].rate).toBe(90);
    expect(composed.items[0].amount).toBe(180);
  });
});

describe('InvoiceSchema total identity now includes round-off', () => {
  const valid = {
    client_id: '11111111-1111-1111-1111-111111111111',
    source_type: 'direct' as const,
    template_type: 'standard' as const,
    mode: 'itemized' as const,
    subtotal: 10.5,
    cgst: 0.95,
    sgst: 0.95,
    igst: 0,
    total: 12.4,
    items: [{ description: 'x', qty: 1, rate: 10.5, amount: 10.5 }],
    materials: [],
  };

  it('rejects a total that implies hidden round-off', () => {
    // The old tolerance was +/-1.0 precisely to accommodate round-off that was
    // never persisted. Now it is a column, so the identity is exact.
    const result = InvoiceSchema.safeParse({ ...valid, total: 13 });
    expect(result.success).toBe(false);
  });

  it('accepts a total that includes the persisted round-off', () => {
    const result = InvoiceSchema.safeParse({ ...valid, total: 12, round_off: -0.4 });
    expect(result.success).toBe(true);
  });

  it('accepts an exact total with no round-off', () => {
    expect(InvoiceSchema.safeParse(valid).success).toBe(true);
  });
});