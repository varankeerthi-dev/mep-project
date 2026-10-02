import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runDocumentChecklistGate } from '../features/document-checklists/gate';
import {
  buildChecklistPolicy,
  type ChecklistConfiguration,
  type ChecklistResponse,
} from '../features/document-checklists/domain';
import type { useDocumentChecklistGate } from '../features/document-checklists/useDocumentChecklistGate';
import { duplicateQuotationWithChecklist, runQuotationChecklistAction } from './QuotationList';

vi.mock('@tanstack/react-query', () => ({ useQuery: vi.fn(), useQueryClient: vi.fn() }));
vi.mock('../supabase', () => ({ supabase: {} }));
vi.mock('react-router-dom', () => ({ useNavigate: vi.fn() }));
vi.mock('../App', () => ({ useAuth: vi.fn() }));
vi.mock('../rbac', () => ({ PermissionGuard: ({ children }: { children: unknown }) => children }));
vi.mock('../utils/queryTimeout', () => ({ timedSupabaseQuery: vi.fn() }));
vi.mock('../approvals/api', () => ({ ApprovalAPI: {} }));
vi.mock('../lib/quotation-workflow', () => ({ initiateQuotationRevision: vi.fn() }));
vi.mock('../api', () => ({ duplicateQuotation: vi.fn() }));
vi.mock('../components/document/DocumentListShell', () => ({ DocumentListShell: () => null }));
vi.mock('../components/RevisionHistoryDialog', () => ({ RevisionHistoryDialog: () => null }));
vi.mock('../components/QuotationRevisionCompareModal', () => ({ QuotationRevisionCompareModal: () => null }));
vi.mock('../features/document-checklists/ChecklistConfirmationDialog', () => ({ ChecklistConfirmationDialog: () => null }));
vi.mock('../features/document-checklists/useDocumentChecklistGate', () => ({ useDocumentChecklistGate: vi.fn() }));

const checklistConfiguration: ChecklistConfiguration = {
  groups: [{
    id: 'quotation-review',
    name: 'Quotation review',
    displayOrder: 0,
    items: [{ id: 'verify-quote', label: 'Verify quotation details', displayOrder: 0, required: true }],
  }],
  assignments: { quotation: ['quotation-review'], sales_order: [], purchase_order: [], invoice_v2: [] },
};
const policy = buildChecklistPolicy(checklistConfiguration, 'quotation');
const sourceQuotation = { id: 'quotation-source', quotation_no: 'Q-001' };

type ChecklistRunner = ReturnType<typeof useDocumentChecklistGate>['run'];

function makeChecklistRunner(response: ChecklistResponse): ChecklistRunner {
  return async (input) => {
    try {
      return await runDocumentChecklistGate({
        ...input,
        loadPolicy: async (organisationId, documentType) => {
          expect(organisationId).toBe('org-42');
          expect(documentType).toBe('quotation');
          return policy;
        },
        confirm: async () => response,
      });
    } catch (error) {
      return { kind: 'failed', error: error instanceof Error ? error.message : String(error) };
    }
  };
}

function runQuotationAction(response: ChecklistResponse, action: () => unknown | Promise<unknown>) {
  return runQuotationChecklistAction({
    organisationId: 'org-42',
    runChecklist: makeChecklistRunner(response),
    action,
  });
}

describe('quotation-list checklist actions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('duplicates and invalidates only after every required checklist item is confirmed', async () => {
    const quotations = [sourceQuotation];
    const invalidate = vi.fn(async () => undefined);
    const onError = vi.fn();

    await duplicateQuotationWithChecklist({
      organisationId: 'org-42',
      quotationId: sourceQuotation.id,
      runChecklist: makeChecklistRunner({ kind: 'confirmed', checkedItemIds: ['verify-quote'] }),
      duplicate: async (quotationId) => {
        const copy = { id: 'quotation-copy', sourceQuotationId: quotationId, quotation_no: 'Q-002' };
        quotations.push(copy);
        return copy;
      },
      invalidate,
      onError,
    });

    expect(quotations).toEqual([
      sourceQuotation,
      { id: 'quotation-copy', sourceQuotationId: sourceQuotation.id, quotation_no: 'Q-002' },
    ]);
    expect(invalidate).toHaveBeenCalledOnce();
    expect(onError).not.toHaveBeenCalled();
  });

  it('leaves quotations and query state unchanged and reports no error when the checklist is cancelled', async () => {
    const quotations = [sourceQuotation];
    const invalidate = vi.fn(async () => undefined);
    const onError = vi.fn();

    await duplicateQuotationWithChecklist({
      organisationId: 'org-42',
      quotationId: sourceQuotation.id,
      runChecklist: makeChecklistRunner({ kind: 'cancelled' }),
      duplicate: async (quotationId) => {
        const copy = { id: 'quotation-copy', sourceQuotationId: quotationId, quotation_no: 'Q-002' };
        quotations.push(copy);
        return copy;
      },
      invalidate,
      onError,
    });

    expect(quotations).toEqual([sourceQuotation]);
    expect(invalidate).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('does not mark a quotation as sent when the checklist is cancelled', async () => {
    const quotation = { id: 'quotation-source', status: 'Draft', sent_at: null as string | null, updated_at: null as string | null };

    const result = await runQuotationAction({ kind: 'cancelled' }, () => {
      quotation.status = 'Sent';
      quotation.sent_at = 'confirmed-at';
      quotation.updated_at = 'confirmed-at';
    });

    expect(result).toEqual({ kind: 'cancelled' });
    expect(quotation).toEqual({ id: 'quotation-source', status: 'Draft', sent_at: null, updated_at: null });
  });

  it('marks a draft quotation as sent only after checklist confirmation', async () => {
    const quotation = { id: 'quotation-source', status: 'Draft', sent_at: null as string | null, updated_at: null as string | null };

    const result = await runQuotationAction({ kind: 'confirmed', checkedItemIds: ['verify-quote'] }, () => {
      quotation.status = 'Sent';
      quotation.sent_at = 'confirmed-at';
      quotation.updated_at = 'confirmed-at';
    });

    expect(result.kind).toBe('completed');
    expect(quotation).toEqual({ id: 'quotation-source', status: 'Sent', sent_at: 'confirmed-at', updated_at: 'confirmed-at' });
  });

  it('creates no revision workflow records when the checklist is cancelled', async () => {
    const workflowRecords: string[] = [];

    const result = await runQuotationAction({ kind: 'cancelled' }, () => {
      workflowRecords.push('communication', 'revision', 'approval');
    });

    expect(result).toEqual({ kind: 'cancelled' });
    expect(workflowRecords).toEqual([]);
  });

  it('creates the revision workflow records only after checklist confirmation', async () => {
    const workflowRecords: string[] = [];

    const result = await runQuotationAction({ kind: 'confirmed', checkedItemIds: ['verify-quote'] }, () => {
      workflowRecords.push('communication', 'revision', 'approval');
    });

    expect(result.kind).toBe('completed');
    expect(workflowRecords).toEqual(['communication', 'revision', 'approval']);
  });

  it('reports duplicate failures without invalidating the quotation list', async () => {
    const invalidate = vi.fn(async () => undefined);
    const onError = vi.fn();

    await duplicateQuotationWithChecklist({
      organisationId: 'org-42',
      quotationId: sourceQuotation.id,
      runChecklist: makeChecklistRunner({ kind: 'confirmed', checkedItemIds: ['verify-quote'] }),
      duplicate: async () => { throw new Error('database unavailable'); },
      invalidate,
      onError,
    });

    expect(invalidate).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0][0]).toMatchObject({ message: 'database unavailable' });
  });
});
