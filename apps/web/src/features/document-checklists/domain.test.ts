import { describe, expect, it } from 'vitest';
import {
  buildChecklistPolicy,
  CHECKLIST_DOCUMENT_TYPES,
  EMPTY_CHECKLIST_CONFIGURATION,
  isChecklistComplete,
  sameChecklistPolicy,
  toggleAllChecklistItems,
  toggleChecklistItem,
  validateChecklistConfiguration,
  type ChecklistConfiguration,
} from './domain';

const configuration: ChecklistConfiguration = {
  groups: [
    {
      id: 'quote-group',
      name: 'Commercial review',
      displayOrder: 0,
      items: [
        { id: 'quote-item-2', label: 'Confirm tax', displayOrder: 1, required: true },
        { id: 'quote-item-1', label: 'Confirm price', displayOrder: 0, required: true },
      ],
    },
    {
      id: 'sales-group',
      name: 'Dispatch review',
      displayOrder: 1,
      items: [{ id: 'sales-item', label: 'Confirm delivery date', displayOrder: 0, required: true }],
    },
    {
      id: 'purchase-group',
      name: 'Supplier review',
      displayOrder: 2,
      items: [{ id: 'purchase-item', label: 'Confirm supplier terms', displayOrder: 0, required: true }],
    },
    {
      id: 'invoice-v2-group',
      name: 'Billing review',
      displayOrder: 3,
      items: [{ id: 'invoice-v2-item', label: 'Confirm invoice coding', displayOrder: 0, required: true }],
    },
  ],
  assignments: {
    quotation: ['quote-group'],
    sales_order: ['sales-group'],
    purchase_order: ['purchase-group'],
    invoice_v2: ['invoice-v2-group'],
  },
};

describe('document checklist domain', () => {
  it('exposes the exact finite document-key set and initializes every assignment key', () => {
    expect(CHECKLIST_DOCUMENT_TYPES).toEqual(['quotation', 'sales_order', 'purchase_order', 'invoice_v2']);
    expect(Object.keys(EMPTY_CHECKLIST_CONFIGURATION.assignments)).toEqual(CHECKLIST_DOCUMENT_TYPES);
    expect(EMPTY_CHECKLIST_CONFIGURATION).toEqual({
      groups: [],
      assignments: { quotation: [], sales_order: [], purchase_order: [], invoice_v2: [] },
    });
  });

  it('builds distinct policies for all four document types with stable item ordering', () => {
    const policies = CHECKLIST_DOCUMENT_TYPES.map((documentType) => buildChecklistPolicy(configuration, documentType));

    expect(policies.map((policy) => policy.groups.map((group) => group.id))).toEqual([
      ['quote-group'],
      ['sales-group'],
      ['purchase-group'],
      ['invoice-v2-group'],
    ]);
    expect(policies[0].groups[0].items.map((item) => item.id)).toEqual(['quote-item-1', 'quote-item-2']);
    expect(policies.every((policy) => policy.groups[0].items.every((item) => item.required))).toBe(true);
    expect(policies[2].documentType).toBe('purchase_order');
    expect(policies[3].documentType).toBe('invoice_v2');
  });

  it('requires every assigned item, supports Mark all and individual toggles', () => {
    const policy = buildChecklistPolicy(configuration, 'quotation');
    expect(isChecklistComplete(policy, [])).toBe(false);

    const allSelected = toggleAllChecklistItems(policy, []);
    expect(allSelected).toEqual(['quote-item-1', 'quote-item-2']);
    expect(isChecklistComplete(policy, allSelected)).toBe(true);
    expect(toggleAllChecklistItems(policy, allSelected)).toEqual([]);

    const oneSelected = toggleChecklistItem(policy, [], 'quote-item-1');
    expect(oneSelected).toEqual(['quote-item-1']);
    expect(isChecklistComplete(policy, oneSelected)).toBe(false);
    expect(toggleChecklistItem(policy, oneSelected, 'quote-item-1')).toEqual([]);
  });

  it('does not treat an empty assigned group as a valid checklist', () => {
    const emptyAssigned: ChecklistConfiguration = {
      groups: [{ id: 'empty', name: 'Empty group', displayOrder: 0, items: [] }],
      assignments: { quotation: ['empty'], sales_order: [], purchase_order: [], invoice_v2: [] },
    };
    expect(validateChecklistConfiguration(emptyAssigned)).toMatch(/at least one item/i);
  });

  it('detects changes to the exact wording shown for confirmation', () => {
    const before = buildChecklistPolicy(configuration, 'quotation');
    const after = buildChecklistPolicy({
      ...configuration,
      groups: configuration.groups.map((group) => group.id === 'quote-group'
        ? { ...group, items: group.items.map((item) => item.id === 'quote-item-1' ? { ...item, label: 'Confirm revised price' } : item) }
        : group),
    }, 'quotation');

    expect(sameChecklistPolicy(before, after)).toBe(false);
  });
});
