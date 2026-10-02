import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runDocumentChecklistGate } from '../../features/document-checklists/gate';
import { buildChecklistPolicy, type ChecklistConfiguration, type ChecklistResponse } from '../../features/document-checklists/domain';
import type { useDocumentChecklistGate } from '../../features/document-checklists/useDocumentChecklistGate';
import { toast } from '../../lib/logger';
import { duplicateSalesOrderWithChecklist } from './SalesOrderList';

vi.mock('../../lib/logger', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../rbac', () => ({ PermissionGuard: ({ children }: { children: unknown }) => children }));
vi.mock('../../components/ui/button', () => ({ Button: () => null }));
vi.mock('../../components/document/DocumentListShell', () => ({ DocumentListShell: () => null }));
vi.mock('./hooks', () => ({
  useSalesOrders: vi.fn(),
  useDeleteSalesOrders: vi.fn(),
  useDuplicateSalesOrder: vi.fn(),
}));
vi.mock('./components/SalesOrderImportModal', () => ({ SalesOrderImportModal: () => null }));
vi.mock('../../features/document-checklists/ChecklistConfirmationDialog', () => ({ ChecklistConfirmationDialog: () => null }));
vi.mock('../../features/document-checklists/useDocumentChecklistGate', () => ({ useDocumentChecklistGate: vi.fn() }));

const checklistConfiguration: ChecklistConfiguration = {
  groups: [{
    id: 'sales-review',
    name: 'Sales review',
    displayOrder: 0,
    items: [{ id: 'verify-order', label: 'Verify the order', displayOrder: 0, required: true }],
  }],
  assignments: { quotation: [], sales_order: ['sales-review'], purchase_order: [], invoice_v2: [] },
};
const policy = buildChecklistPolicy(checklistConfiguration, 'sales_order');
const sourceOrder = { id: 'so-source', sales_order_no: 'SO-001', status: 'open' };

function makeChecklistRunner(response: ChecklistResponse): ReturnType<typeof useDocumentChecklistGate>['run'] {
  return (input) => runDocumentChecklistGate({
    ...input,
    loadPolicy: async (organisationId, documentType) => {
      expect(organisationId).toBe('org-42');
      expect(documentType).toBe('sales_order');
      return policy;
    },
    confirm: async () => response,
  });
}

describe('sales-order duplicate checklist behavior', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates and reports a duplicate only after checklist confirmation', async () => {
    const orders = [sourceOrder];
    const createdOrder = { id: 'so-copy', sales_order_no: 'SO-002', status: 'draft' };
    const mutation = {
      mutateAsync: vi.fn(async () => {
        orders.push(createdOrder);
        return createdOrder;
      }),
    };

    await duplicateSalesOrderWithChecklist(
      'org-42',
      sourceOrder.id,
      makeChecklistRunner({ kind: 'confirmed', checkedItemIds: ['verify-order'] }),
      mutation as any,
    );

    expect(orders).toEqual([sourceOrder, createdOrder]);
    expect(toast.success).toHaveBeenCalledWith('Duplicated as SO-002');
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('leaves the source/order list unchanged and shows no error when the checklist is cancelled', async () => {
    const orders = [sourceOrder];
    const mutation = {
      mutateAsync: vi.fn(async () => {
        const createdOrder = { id: 'so-copy', sales_order_no: 'SO-002', status: 'draft' };
        orders.push(createdOrder);
        return createdOrder;
      }),
    };

    await duplicateSalesOrderWithChecklist(
      'org-42',
      sourceOrder.id,
      makeChecklistRunner({ kind: 'cancelled' }),
      mutation as any,
    );

    expect(orders).toEqual([sourceOrder]);
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });
});
