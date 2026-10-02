import {
  CHECKLIST_DOCUMENT_TYPES,
  type ChecklistConfiguration,
  type ChecklistDocumentType,
  type ChecklistGroup,
} from '../../document-checklists/domain';

export const CHECKLIST_DOCUMENT_LABELS: Record<ChecklistDocumentType, string> = {
  quotation: 'Quotation',
  sales_order: 'Sales Order',
  purchase_order: 'Purchase Order',
  invoice_v2: 'Invoice V2',
};

export const CHECKLIST_DOCUMENT_OPTIONS = CHECKLIST_DOCUMENT_TYPES.map((type) => ({
  type,
  label: CHECKLIST_DOCUMENT_LABELS[type],
}));

export function copyChecklistConfiguration(configuration: ChecklistConfiguration): ChecklistConfiguration {
  return {
    groups: configuration.groups.map((group) => ({
      ...group,
      items: group.items.map((item) => ({ ...item })),
    })),
    assignments: Object.fromEntries(CHECKLIST_DOCUMENT_TYPES.map((documentType) => [
      documentType,
      [...configuration.assignments[documentType]],
    ])) as ChecklistConfiguration['assignments'],
  };
}

export function orderChecklistAssignments(
  groups: ChecklistGroup[],
  assignments: ChecklistConfiguration['assignments'],
): ChecklistConfiguration['assignments'] {
  const groupOrder = new Map(groups.map((group, index) => [group.id, index]));
  return Object.fromEntries(CHECKLIST_DOCUMENT_TYPES.map((documentType) => [
    documentType,
    [...assignments[documentType]].sort((left, right) => (groupOrder.get(left) ?? 0) - (groupOrder.get(right) ?? 0)),
  ])) as ChecklistConfiguration['assignments'];
}

export function removeChecklistGroupAssignments(
  assignments: ChecklistConfiguration['assignments'],
  groupId: string,
): ChecklistConfiguration['assignments'] {
  return Object.fromEntries(CHECKLIST_DOCUMENT_TYPES.map((documentType) => [
    documentType,
    assignments[documentType].filter((assignedGroupId) => assignedGroupId !== groupId),
  ])) as ChecklistConfiguration['assignments'];
}
