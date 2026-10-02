import { supabase } from '@/lib/supabase';
import {
  buildChecklistPolicy,
  CHECKLIST_DOCUMENT_TYPES,
  type ChecklistConfiguration,
  type ChecklistConfigurationSnapshot,
  type ChecklistDocumentType,
  type ChecklistGroup,
  type ChecklistPolicy,
  validateChecklistConfiguration,
} from './domain';

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Checklist configuration is invalid (${label}).`);
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Checklist configuration is invalid (${label}).`);
  return value;
}

function asOrder(value: unknown, label: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) throw new Error(`Checklist configuration is invalid (${label}).`);
  return value as number;
}

export function parseChecklistConfiguration(value: unknown): ChecklistConfiguration {
  const raw = asRecord(value, 'root');
  if (!Array.isArray(raw.groups)) throw new Error('Checklist configuration is invalid (groups).');
  const rawAssignments = asRecord(raw.assignments, 'assignments');
  if (Object.keys(rawAssignments).some((assignmentType) =>
    !CHECKLIST_DOCUMENT_TYPES.some((documentType) => documentType === assignmentType))) {
    throw new Error('Checklist configuration is invalid (unsupported document type).');
  }

  const groups: ChecklistGroup[] = raw.groups.map((entry, groupIndex) => {
    const group = asRecord(entry, `group ${groupIndex + 1}`);
    if (!Array.isArray(group.items)) throw new Error(`Checklist configuration is invalid (items in group ${groupIndex + 1}).`);
    return {
      id: asString(group.id, `group ${groupIndex + 1} ID`),
      name: asString(group.name, `group ${groupIndex + 1} name`),
      displayOrder: asOrder(group.display_order, `group ${groupIndex + 1} order`),
      items: group.items.map((entryItem, itemIndex) => {
        const item = asRecord(entryItem, `item ${itemIndex + 1}`);
        return {
          id: asString(item.id, `item ${itemIndex + 1} ID`),
          label: asString(item.label, `item ${itemIndex + 1} label`),
          displayOrder: asOrder(item.display_order, `item ${itemIndex + 1} order`),
          required: true,
        };
      }),
    };
  });

  const assignments = Object.fromEntries(CHECKLIST_DOCUMENT_TYPES.map((documentType) => {
    const valueForType = rawAssignments[documentType];
    if (!Array.isArray(valueForType)) throw new Error(`Checklist configuration is invalid (${documentType} assignments).`);
    return [documentType, valueForType.map((id) => asString(id, `${documentType} assignment`))];
  })) as ChecklistConfiguration['assignments'];

  const configuration = { groups, assignments };
  const validationError = validateChecklistConfiguration(configuration);
  if (validationError) throw new Error(`Checklist configuration is invalid. ${validationError}`);
  return configuration;
}

export class ChecklistRevisionConflictError extends Error {
  constructor() {
    super('Checklist settings changed in another tab. Review the latest configuration before saving.');
    this.name = 'ChecklistRevisionConflictError';
  }
}

function parseChecklistConfigurationSnapshot(value: unknown): ChecklistConfigurationSnapshot {
  const raw = asRecord(value, 'snapshot');
  if (!Number.isInteger(raw.revision) || (raw.revision as number) < 0) throw new Error('Checklist configuration is invalid (revision).');
  return { revision: raw.revision as number, configuration: parseChecklistConfiguration(raw.configuration) };
}

export async function loadChecklistConfiguration(organisationId: string): Promise<ChecklistConfigurationSnapshot> {
  if (!organisationId) throw new Error('Organisation ID is required to load checklists.');
  const { data, error } = await supabase.rpc('get_document_checklist_configuration', {
    p_organisation_id: organisationId,
  });
  if (error) throw new Error(error.message || 'Could not load checklist configuration.');
  return parseChecklistConfigurationSnapshot(data);
}

export async function loadChecklistPolicy(
  organisationId: string,
  documentType: ChecklistDocumentType,
): Promise<ChecklistPolicy> {
  const snapshot = await loadChecklistConfiguration(organisationId);
  return buildChecklistPolicy(snapshot.configuration, documentType);
}

export async function saveChecklistConfiguration(
  organisationId: string,
  configuration: ChecklistConfiguration,
  expectedRevision: number,
): Promise<number> {
  if (!organisationId) throw new Error('Organisation ID is required to save checklists.');
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) throw new Error('Checklist revision is invalid.');
  const validationError = validateChecklistConfiguration(configuration);
  if (validationError) throw new Error(validationError);

  const payload = {
    groups: configuration.groups.map((group) => ({
      id: group.id,
      name: group.name.trim(),
      display_order: group.displayOrder,
      items: group.items.map((item) => ({
        id: item.id,
        label: item.label.trim(),
        display_order: item.displayOrder,
      })),
    })),
    assignments: configuration.assignments,
  };
  const { data, error } = await supabase.rpc('save_document_checklist_configuration', {
    p_organisation_id: organisationId,
    p_config: payload,
    p_expected_revision: expectedRevision,
  });
  if (error) {
    if (error.code === '40001' && error.message?.includes('CHECKLIST_REVISION_CONFLICT')) {
      throw new ChecklistRevisionConflictError();
    }
    throw new Error(error.message || 'Could not save checklist configuration.');
  }
  if (!Number.isInteger(data)) throw new Error('Checklist save returned an invalid revision.');
  return data;
}
