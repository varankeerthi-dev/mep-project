export const CHECKLIST_DOCUMENT_TYPES = ['quotation', 'sales_order', 'purchase_order', 'invoice_v2'] as const;

export type ChecklistDocumentType = (typeof CHECKLIST_DOCUMENT_TYPES)[number];

export interface ChecklistItem {
  id: string;
  label: string;
  displayOrder: number;
  required: true;
}

export interface ChecklistGroup {
  id: string;
  name: string;
  displayOrder: number;
  items: ChecklistItem[];
}

export interface ChecklistConfigurationSnapshot {
  revision: number;
  configuration: ChecklistConfiguration;
}

export interface ChecklistConfiguration {
  groups: ChecklistGroup[];
  assignments: Record<ChecklistDocumentType, string[]>;
}

export interface ChecklistPolicy {
  documentType: ChecklistDocumentType;
  groups: ChecklistGroup[];
}

export interface ChecklistSelection {
  kind: 'confirmed';
  checkedItemIds: string[];
}

export type ChecklistResponse = ChecklistSelection | { kind: 'cancelled' };

export type ChecklistGateResult<T> =
  | { kind: 'completed'; value: T }
  | { kind: 'cancelled' }
  | { kind: 'incomplete' };

export const EMPTY_CHECKLIST_CONFIGURATION: ChecklistConfiguration = {
	groups: [],
	assignments: { quotation: [], sales_order: [], purchase_order: [], invoice_v2: [] },
};

export function buildChecklistPolicy(
  configuration: ChecklistConfiguration,
  documentType: ChecklistDocumentType,
): ChecklistPolicy {
  const groupsById = new Map(configuration.groups.map((group) => [group.id, group]));
  const groups = configuration.assignments[documentType]
    .map((id, index) => {
      const group = groupsById.get(id);
      if (!group) return null;
      return {
        ...group,
        displayOrder: index,
        items: [...group.items]
          .sort((left, right) => left.displayOrder - right.displayOrder || left.id.localeCompare(right.id))
          .map((item, itemIndex) => ({ ...item, displayOrder: itemIndex, required: true as const })),
      };
    })
    .filter((group): group is ChecklistGroup => group !== null && group.items.length > 0);

  return { documentType, groups };
}

export function requiredChecklistItemIds(policy: ChecklistPolicy): string[] {
  return policy.groups.flatMap((group) => group.items.map((item) => item.id));
}

export function hasRequiredChecklistItems(policy: ChecklistPolicy): boolean {
  return requiredChecklistItemIds(policy).length > 0;
}

export function isChecklistComplete(policy: ChecklistPolicy, selectedIds: readonly string[]): boolean {
  const requiredIds = requiredChecklistItemIds(policy);
  if (selectedIds.length !== requiredIds.length) return false;
  const selected = new Set(selectedIds);
  return selected.size === requiredIds.length && requiredIds.every((id) => selected.has(id));
}

export function toggleChecklistItem(
  policy: ChecklistPolicy,
  selectedIds: readonly string[],
  itemId: string,
): string[] {
  const requiredIds = requiredChecklistItemIds(policy);
  if (!requiredIds.includes(itemId)) return [...selectedIds];
  const selected = new Set(selectedIds.filter((id) => requiredIds.includes(id)));
  if (selected.has(itemId)) selected.delete(itemId);
  else selected.add(itemId);
  return requiredIds.filter((id) => selected.has(id));
}

export function toggleAllChecklistItems(policy: ChecklistPolicy, selectedIds: readonly string[]): string[] {
  return isChecklistComplete(policy, selectedIds) ? [] : requiredChecklistItemIds(policy);
}

export function sameChecklistPolicy(left: ChecklistPolicy, right: ChecklistPolicy): boolean {
  return checklistPolicyFingerprint(left) === checklistPolicyFingerprint(right);
}

export function checklistPolicyFingerprint(policy: ChecklistPolicy): string {
  return JSON.stringify({
    documentType: policy.documentType,
    groups: policy.groups.map((group) => ({
      id: group.id,
      name: group.name,
      displayOrder: group.displayOrder,
      items: group.items.map((item) => ({
        id: item.id,
        label: item.label,
        displayOrder: item.displayOrder,
        required: item.required,
      })),
    })),
  });
}

export function validateChecklistConfiguration(configuration: ChecklistConfiguration): string | null {
  const groupIds = new Set<string>();
  for (const group of configuration.groups) {
    if (!group.id || groupIds.has(group.id)) return 'Checklist groups must have unique IDs.';
    groupIds.add(group.id);
    if (!group.name.trim()) return 'Enter a name for every checklist group.';
    if (!Number.isInteger(group.displayOrder) || group.displayOrder < 0) return 'Checklist group order is invalid.';

    const itemIds = new Set<string>();
    for (const item of group.items) {
      if (!item.id || itemIds.has(item.id)) return `Items in “${group.name}” must have unique IDs.`;
      itemIds.add(item.id);
      if (!item.label.trim()) return `Enter a label for every item in “${group.name}”.`;
      if (!Number.isInteger(item.displayOrder) || item.displayOrder < 0) return `Item order in “${group.name}” is invalid.`;
    }
  }

  for (const documentType of CHECKLIST_DOCUMENT_TYPES) {
    const assignedIds = configuration.assignments[documentType];
    if (new Set(assignedIds).size !== assignedIds.length) return 'A checklist group cannot be assigned more than once to the same document.';
    for (const groupId of assignedIds) {
      const group = configuration.groups.find((candidate) => candidate.id === groupId);
      if (!group) return 'A checklist assignment refers to a group that no longer exists.';
      if (group.items.length === 0) return `Add at least one item to “${group.name}” before assigning it.`;
    }
  }

  return null;
}

export function createChecklistId(): string {
  if (!globalThis.crypto?.randomUUID) throw new Error('This browser cannot create checklist IDs.');
  return globalThis.crypto.randomUUID();
}
