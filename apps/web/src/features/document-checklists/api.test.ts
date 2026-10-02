import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from '@/lib/supabase';
import { parseChecklistConfiguration, saveChecklistConfiguration } from './api';
import {
  CHECKLIST_DOCUMENT_TYPES,
  EMPTY_CHECKLIST_CONFIGURATION,
  type ChecklistConfiguration,
} from './domain';

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: vi.fn() },
}));

const rpcMock = vi.mocked(supabase.rpc);

const wireConfiguration = {
  groups: [{
    id: 'commercial',
    name: 'Commercial review',
    display_order: 0,
    items: [{ id: 'price', label: 'Confirm price', display_order: 0 }],
  }],
  assignments: {
    quotation: ['commercial'],
    sales_order: [],
    purchase_order: [],
    invoice_v2: [],
  },
};

describe('document checklist API contract', () => {
  beforeEach(() => rpcMock.mockReset());

  it('parses and round-trips all four assignment arrays', () => {
    expect(parseChecklistConfiguration(wireConfiguration)).toEqual({
      groups: [{
        id: 'commercial',
        name: 'Commercial review',
        displayOrder: 0,
        items: [{ id: 'price', label: 'Confirm price', displayOrder: 0, required: true }],
      }],
      assignments: {
        quotation: ['commercial'],
        sales_order: [],
        purchase_order: [],
        invoice_v2: [],
      },
    });
  });

  it('requires every read key and rejects unknown invoice aliases', () => {
    const { purchase_order: _purchaseOrder, ...withoutPurchaseOrder } = wireConfiguration.assignments;
    const { invoice_v2: _invoiceV2, ...withoutInvoiceV2 } = wireConfiguration.assignments;
    expect(() => parseChecklistConfiguration({ ...wireConfiguration, assignments: withoutPurchaseOrder })).toThrow(/purchase_order assignments/i);
    expect(() => parseChecklistConfiguration({ ...wireConfiguration, assignments: withoutInvoiceV2 })).toThrow(/invoice_v2 assignments/i);

    for (const alias of ['invoice', 'invoice_v1']) {
      expect(() => parseChecklistConfiguration({
        ...wireConfiguration,
        assignments: { ...wireConfiguration.assignments, [alias]: [] },
      })).toThrow(/unsupported document type/i);
    }
  });

  it('sends all supported assignment keys in the save payload', async () => {
    rpcMock.mockResolvedValue({ data: 6, error: null } as any);
    const configuration: ChecklistConfiguration = EMPTY_CHECKLIST_CONFIGURATION;

    await expect(saveChecklistConfiguration('org-id', configuration, 5)).resolves.toBe(6);

    expect(rpcMock).toHaveBeenCalledWith('save_document_checklist_configuration', {
      p_organisation_id: 'org-id',
      p_config: {
        groups: [],
        assignments: {
          quotation: [],
          sales_order: [],
          purchase_order: [],
          invoice_v2: [],
        },
      },
      p_expected_revision: 5,
    });
    const payload = rpcMock.mock.calls[0][1]?.p_config as { assignments: Record<string, string[]> };
    expect(Object.keys(payload.assignments)).toEqual(CHECKLIST_DOCUMENT_TYPES);
  });
});
