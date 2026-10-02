import { describe, expect, it } from 'vitest';
import { CHECKLIST_DOCUMENT_TYPES, type ChecklistConfiguration, type ChecklistGroup } from '../../document-checklists/domain';
import { SETTINGS_TABS } from '../types';
import {
  CHECKLIST_DOCUMENT_OPTIONS,
  copyChecklistConfiguration,
  orderChecklistAssignments,
  removeChecklistGroupAssignments,
} from './checklistAssignmentHelpers';

const groups: ChecklistGroup[] = [
  { id: 'group-a', name: 'A', displayOrder: 0, items: [] },
  { id: 'group-b', name: 'B', displayOrder: 1, items: [] },
];

const assignments: ChecklistConfiguration['assignments'] = {
  quotation: ['group-a', 'group-b'],
  sales_order: ['group-b', 'group-a'],
  purchase_order: ['group-a', 'group-b'],
  invoice_v2: ['group-b', 'group-a'],
};

describe('checklist Settings assignment helpers', () => {
  it('derives labeled options from the full tuple and exposes searchable names', () => {
    expect(CHECKLIST_DOCUMENT_OPTIONS.map(({ type }) => type)).toEqual(CHECKLIST_DOCUMENT_TYPES);
    expect(CHECKLIST_DOCUMENT_OPTIONS.map(({ label }) => label)).toEqual([
      'Quotation',
      'Sales Order',
      'Purchase Order',
      'Invoice V2',
    ]);
    const searchIndex = SETTINGS_TABS.find((tab) => tab.id === 'checklist-groups')?.searchIndex;
    expect(searchIndex).toContain('purchase order checklist');
    expect(searchIndex).toContain('invoice v2 checklist');
  });

  it('copies every assignment key without sharing nested mutable data', () => {
    const configuration: ChecklistConfiguration = {
      groups: [{ ...groups[0], items: [{ id: 'item-a', label: 'Check A', displayOrder: 0, required: true }] }],
      assignments,
    };

    const copy = copyChecklistConfiguration(configuration);
    copy.assignments.invoice_v2.push('group-b');
    copy.groups[0].items[0].label = 'Changed';

    expect(Object.keys(copy.assignments)).toEqual(CHECKLIST_DOCUMENT_TYPES);
    expect(copy.assignments.invoice_v2).toEqual(['group-b', 'group-a', 'group-b']);
    expect(configuration.assignments.invoice_v2).toEqual(['group-b', 'group-a']);
    expect(configuration.groups[0].items[0].label).toBe('Check A');
  });

  it('reorders every document assignment with the group order', () => {
    const reordered = orderChecklistAssignments([...groups].reverse(), assignments);

    expect(Object.keys(reordered)).toEqual(CHECKLIST_DOCUMENT_TYPES);
    for (const documentType of CHECKLIST_DOCUMENT_TYPES) {
      expect(reordered[documentType]).toEqual(['group-b', 'group-a']);
    }
    expect(assignments.quotation).toEqual(['group-a', 'group-b']);
  });

  it('removes the deleted group from every document while preserving all keys', () => {
    const remaining = removeChecklistGroupAssignments(assignments, 'group-a');

    expect(Object.keys(remaining)).toEqual(CHECKLIST_DOCUMENT_TYPES);
    expect(remaining).toEqual({
      quotation: ['group-b'],
      sales_order: ['group-b'],
      purchase_order: ['group-b'],
      invoice_v2: ['group-b'],
    });
  });
});
