import type { ChecklistGateResult } from '../../features/document-checklists/domain';
import type { useDocumentChecklistGate } from '../../features/document-checklists/useDocumentChecklistGate';

export type InvoiceV2ChecklistRunner = ReturnType<typeof useDocumentChecklistGate>['run'];
export type InvoiceV2ChecklistActionResult<T> =
  | ChecklistGateResult<T>
  | { kind: 'busy' }
  | { kind: 'failed'; error: string };

/**
 * Run Invoice V2 persistence under the checklist's busy lock. The shared hook
 * normalizes action exceptions as checklist failures, so restore action errors
 * for the editor's existing save-error handling.
 */
export async function runInvoiceV2ChecklistAction<T>(input: {
  organisationId?: string | null;
  runChecklist: InvoiceV2ChecklistRunner;
  action: () => T | Promise<T>;
}): Promise<InvoiceV2ChecklistActionResult<T>> {
  if (!input.organisationId) {
    return { kind: 'failed', error: 'Organisation is unavailable.' };
  }

  let actionFailed = false;
  let actionFailure: unknown;
  const actionUnderGate = async () => {
    try {
      return await input.action();
    } catch (error) {
      actionFailed = true;
      actionFailure = error;
      throw error;
    }
  };

  let result: InvoiceV2ChecklistActionResult<T>;
  try {
    result = await input.runChecklist({
      organisationId: input.organisationId,
      documentType: 'invoice_v2',
      action: actionUnderGate,
    });
  } catch (error) {
    if (actionFailed) throw actionFailure;
    throw error;
  }

  if (actionFailed) throw actionFailure;
  return result;
}
