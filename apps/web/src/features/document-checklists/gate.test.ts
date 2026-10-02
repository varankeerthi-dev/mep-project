import { describe, expect, it, vi } from 'vitest';
import { runDocumentChecklistGate } from './gate';
import { buildChecklistPolicy, type ChecklistConfiguration, type ChecklistPolicy } from './domain';

const configured: ChecklistConfiguration = {
  groups: [{
    id: 'group-1',
    name: 'Review',
    displayOrder: 0,
    items: [{ id: 'item-1', label: 'Check the document', displayOrder: 0, required: true }],
  }],
  assignments: { quotation: ['group-1'], sales_order: ['group-1'], purchase_order: ['group-1'], invoice_v2: [] },
};

const policy = (label = 'Check the document'): ChecklistPolicy => buildChecklistPolicy({
  ...configured,
  groups: [{
    ...configured.groups[0],
    items: [{ ...configured.groups[0].items[0], label }],
  }],
}, 'quotation');

const run = <T,>(overrides: Partial<Parameters<typeof runDocumentChecklistGate<T>>[0]> = {}) =>
  runDocumentChecklistGate<T>({
    organisationId: 'org-1',
    documentType: 'quotation',
    loadPolicy: async (_organisationId, documentType) => buildChecklistPolicy(configured, documentType),
    confirm: async () => ({ kind: 'confirmed', checkedItemIds: ['item-1'] }),
    action: () => 'saved' as T,
    ...overrides,
  });

describe('document checklist gate', () => {
  it.each(['quotation save', 'sales-order approval submit'])('does not run the %s action when the user cancels', async (actionName) => {
    const action = vi.fn(() => actionName);
    const result = await run({
      documentType: actionName.startsWith('sales-order') ? 'sales_order' : 'quotation',
      confirm: async () => ({ kind: 'cancelled' }),
      action,
    });

    expect(result).toEqual({ kind: 'cancelled' });
    expect(action).not.toHaveBeenCalled();
  });

  it('runs the save/submit action only after all current required items are checked', async () => {
    const action = vi.fn(() => 'saved');
    const confirm = vi.fn(async (current: ChecklistPolicy) => ({
      kind: 'confirmed' as const,
      checkedItemIds: current.groups.flatMap((group) => group.items.map((item) => item.id)),
    }));
    const result = await run({ confirm, action });

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ kind: 'completed', value: 'saved' });
  });

  it('leaves PO records untouched when the purchase-order checklist is cancelled', async () => {
    const writes: string[] = [];
    const confirm = vi.fn(async () => ({ kind: 'cancelled' as const }));
    const result = await run({
      documentType: 'purchase_order',
      confirm,
      action: () => { writes.push('purchase_orders header', 'purchase_order_items line'); },
    });

    expect(result).toEqual({ kind: 'cancelled' });
    expect(confirm).toHaveBeenCalledOnce();
    expect(writes).toEqual([]);
  });

  it('performs the PO save and returns the persisted result after confirmation', async () => {
    const result = await run({
      documentType: 'purchase_order',
      confirm: async () => ({ kind: 'confirmed', checkedItemIds: ['item-1'] }),
      action: () => ({ poNumber: 'PO-042', status: 'Draft', itemNames: ['Cable'] }),
    });

    expect(result).toEqual({
      kind: 'completed',
      value: { poNumber: 'PO-042', status: 'Draft', itemNames: ['Cable'] },
    });
  });

  it('refreshes changed policy and requests confirmation again with the current wording', async () => {
    const loadPolicy = vi.fn()
      .mockResolvedValueOnce(policy('Check the document'))
      .mockResolvedValue(policy('Check the updated document'));
    const seenLabels: string[] = [];
    const action = vi.fn(() => 'submitted');
    const onPolicyChanged = vi.fn();
    const result = await run({
      loadPolicy,
      confirm: async (current) => {
        seenLabels.push(current.groups[0].items[0].label);
        return { kind: 'confirmed', checkedItemIds: ['item-1'] };
      },
      onPolicyChanged,
      action,
    });

    expect(seenLabels).toEqual(['Check the document', 'Check the updated document']);
    expect(onPolicyChanged).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ kind: 'completed', value: 'submitted' });
  });

  it('does not run the action if the confirmation is incomplete', async () => {
    const action = vi.fn();
    const result = await run({ confirm: async () => ({ kind: 'confirmed', checkedItemIds: [] }), action });

    expect(result).toEqual({ kind: 'incomplete' });
    expect(action).not.toHaveBeenCalled();
  });

  it('fails closed when configuration cannot be loaded', async () => {
    const action = vi.fn();
    await expect(run({ loadPolicy: async () => { throw new Error('offline'); }, action })).rejects.toThrow('offline');
    expect(action).not.toHaveBeenCalled();
  });

  it('runs without opening a modal when no group is assigned to the document', async () => {
    const emptyPolicy = buildChecklistPolicy({
      ...configured,
      assignments: { quotation: [], sales_order: [], purchase_order: [], invoice_v2: [] },
    }, 'quotation');
    const confirm = vi.fn();
    const action = vi.fn(() => 'saved');
    const result = await run({ loadPolicy: async () => emptyPolicy, confirm, action });

    expect(confirm).not.toHaveBeenCalled();
    expect(action).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ kind: 'completed', value: 'saved' });
  });

  it('re-reads an initially empty policy and confirms a checklist assigned before the write', async () => {
    const emptyPolicy = buildChecklistPolicy({
      ...configured,
      assignments: { quotation: [], sales_order: [], purchase_order: [], invoice_v2: [] },
    }, 'purchase_order');
    const assignedPolicy = buildChecklistPolicy(configured, 'purchase_order');
    const loadPolicy = vi.fn()
      .mockResolvedValueOnce(emptyPolicy)
      .mockResolvedValueOnce(assignedPolicy)
      .mockResolvedValue(assignedPolicy);
    const seenLabels: string[] = [];
    const action = vi.fn(() => 'purchase-order-saved');
    const onPolicyChanged = vi.fn();

    const result = await run({
      documentType: 'purchase_order',
      loadPolicy,
      confirm: async (current) => {
        seenLabels.push(current.groups[0].items[0].label);
        return { kind: 'confirmed', checkedItemIds: ['item-1'] };
      },
      onPolicyChanged,
      action,
    });

    expect(seenLabels).toEqual(['Check the document']);
    expect(loadPolicy).toHaveBeenCalledTimes(3);
    expect(onPolicyChanged).toHaveBeenCalledOnce();
    expect(action).toHaveBeenCalledOnce();
    expect(result).toEqual({ kind: 'completed', value: 'purchase-order-saved' });
  });
});
