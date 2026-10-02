import {
  hasRequiredChecklistItems,
  isChecklistComplete,
  sameChecklistPolicy,
  type ChecklistDocumentType,
  type ChecklistPolicy,
  type ChecklistResponse,
  type ChecklistGateResult,
} from './domain';

export interface RunDocumentChecklistGateInput<T> {
  organisationId: string;
  documentType: ChecklistDocumentType;
  loadPolicy: (organisationId: string, documentType: ChecklistDocumentType) => Promise<ChecklistPolicy>;
  confirm: (policy: ChecklistPolicy) => Promise<ChecklistResponse>;
  onPolicyChanged?: () => void;
  action: () => Promise<T> | T;
}

export async function runDocumentChecklistGate<T>(
  input: RunDocumentChecklistGateInput<T>,
): Promise<ChecklistGateResult<T>> {
  let policy = await input.loadPolicy(input.organisationId, input.documentType);

  if (!hasRequiredChecklistItems(policy)) {
    const currentPolicy = await input.loadPolicy(input.organisationId, input.documentType);
    if (!sameChecklistPolicy(policy, currentPolicy) && hasRequiredChecklistItems(currentPolicy)) {
      input.onPolicyChanged?.();
    }
    policy = currentPolicy;
  }

  while (hasRequiredChecklistItems(policy)) {
    const response = await input.confirm(policy);
    if (response.kind === 'cancelled') return { kind: 'cancelled' };

    const currentPolicy = await input.loadPolicy(input.organisationId, input.documentType);
    if (!sameChecklistPolicy(policy, currentPolicy)) {
      input.onPolicyChanged?.();
      policy = currentPolicy;
      continue;
    }

    if (!isChecklistComplete(currentPolicy, response.checkedItemIds)) return { kind: 'incomplete' };
    return { kind: 'completed', value: await input.action() };
  }

  return { kind: 'completed', value: await input.action() };
}
