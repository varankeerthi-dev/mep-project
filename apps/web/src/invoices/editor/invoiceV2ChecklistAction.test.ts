import { describe, expect, it } from 'vitest';
import { runDocumentChecklistGate } from '../../features/document-checklists/gate';
import { buildChecklistPolicy, type ChecklistConfiguration, type ChecklistResponse } from '../../features/document-checklists/domain';
import type { InvoiceV2ChecklistRunner } from './invoiceV2ChecklistAction';
import { runInvoiceV2ChecklistAction } from './invoiceV2ChecklistAction';

const configuration: ChecklistConfiguration = {
  groups: [{
    id: 'invoice-review',
    name: 'Invoice review',
    displayOrder: 0,
    items: [{ id: 'verify-invoice', label: 'Verify invoice details', displayOrder: 0, required: true }],
  }],
  assignments: { quotation: [], sales_order: [], purchase_order: [], invoice_v2: ['invoice-review'] },
};
const policy = buildChecklistPolicy(configuration, 'invoice_v2');

function makeChecklistRunner(response: ChecklistResponse): InvoiceV2ChecklistRunner {
  return async <T,>(input) => runDocumentChecklistGate({
    ...input,
    loadPolicy: async (organisationId, documentType) => {
      expect(organisationId).toBe('org-42');
      expect(documentType).toBe('invoice_v2');
      return policy;
    },
    confirm: async () => response,
  });
}

describe('Invoice V2 checklist action', () => {
  it('does not save a new draft or sync terms or navigate when cancelled', async () => {
    const sideEffects: string[] = [];

    const result = await runInvoiceV2ChecklistAction({
      organisationId: 'org-42',
      runChecklist: makeChecklistRunner({ kind: 'cancelled' }),
      action: () => sideEffects.push('draft write', 'terms sync', 'navigation'),
    });

    expect(result).toEqual({ kind: 'cancelled' });
    expect(sideEffects).toEqual([]);
  });

  it('does not save an edit revision snapshot or draft when cancelled', async () => {
    const sideEffects: string[] = [];

    const result = await runInvoiceV2ChecklistAction({
      organisationId: 'org-42',
      runChecklist: makeChecklistRunner({ kind: 'cancelled' }),
      action: () => sideEffects.push('revision snapshot', 'draft update', 'terms sync', 'navigation'),
    });

    expect(result).toEqual({ kind: 'cancelled' });
    expect(sideEffects).toEqual([]);
  });

  it('does not generate a number or write/finalize an invoice or update related records when cancelled', async () => {
    const sideEffects: string[] = [];

    const result = await runInvoiceV2ChecklistAction({
      organisationId: 'org-42',
      runChecklist: makeChecklistRunner({ kind: 'cancelled' }),
      action: () => sideEffects.push(
        'invoice number generation',
        'invoice mutation and finalization',
        'source conversion link/status',
        'PO billing',
        'terms sync',
        'navigation',
      ),
    });

    expect(result).toEqual({ kind: 'cancelled' });
    expect(sideEffects).toEqual([]);
  });

  it('proceeds with a new draft only after confirmation', async () => {
    const sideEffects: string[] = [];

    const result = await runInvoiceV2ChecklistAction({
      organisationId: 'org-42',
      runChecklist: makeChecklistRunner({ kind: 'confirmed', checkedItemIds: ['verify-invoice'] }),
      action: () => sideEffects.push('draft write', 'terms sync', 'navigation'),
    });

    expect(result.kind).toBe('completed');
    expect(sideEffects).toEqual(['draft write', 'terms sync', 'navigation']);
  });

  it('creates the revision snapshot before the draft update after confirmation', async () => {
    const sideEffects: string[] = [];

    const result = await runInvoiceV2ChecklistAction({
      organisationId: 'org-42',
      runChecklist: makeChecklistRunner({ kind: 'confirmed', checkedItemIds: ['verify-invoice'] }),
      action: () => sideEffects.push('revision snapshot', 'draft update', 'terms sync', 'navigation'),
    });

    expect(result.kind).toBe('completed');
    expect(sideEffects).toEqual(['revision snapshot', 'draft update', 'terms sync', 'navigation']);
  });

  it('proceeds through final-save side effects only after confirmation', async () => {
    const sideEffects: string[] = [];

    const result = await runInvoiceV2ChecklistAction({
      organisationId: 'org-42',
      runChecklist: makeChecklistRunner({ kind: 'confirmed', checkedItemIds: ['verify-invoice'] }),
      action: () => sideEffects.push(
        'invoice number generation',
        'invoice mutation and finalization',
        'source conversion link/status',
        'PO billing',
        'terms sync',
        'navigation',
      ),
    });

    expect(result.kind).toBe('completed');
    expect(sideEffects).toEqual([
      'invoice number generation',
      'invoice mutation and finalization',
      'source conversion link/status',
      'PO billing',
      'terms sync',
      'navigation',
    ]);
  });

  it('does not run an action if the organisation is unavailable', async () => {
    const sideEffects: string[] = [];

    const result = await runInvoiceV2ChecklistAction({
      organisationId: null,
      runChecklist: makeChecklistRunner({ kind: 'confirmed', checkedItemIds: ['verify-invoice'] }),
      action: () => sideEffects.push('invoice write'),
    });

    expect(result).toEqual({ kind: 'failed', error: 'Organisation is unavailable.' });
    expect(sideEffects).toEqual([]);
  });

  it('preserves persistence exceptions for the editor save-error handler', async () => {
    const saveError = new Error('invoice save failed');

    await expect(runInvoiceV2ChecklistAction({
      organisationId: 'org-42',
      runChecklist: makeChecklistRunner({ kind: 'confirmed', checkedItemIds: ['verify-invoice'] }),
      action: () => { throw saveError; },
    })).rejects.toBe(saveError);
  });
});
