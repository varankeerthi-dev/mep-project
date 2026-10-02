import { describe, expect, it, vi } from 'vitest';
import { requestSalesOrderImportClose, runSalesOrderImportBatch } from './SalesOrderImportModal';

vi.mock('../../../supabase', () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }));
vi.mock('../../../lib/logger', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('../hooks', () => ({ useCreateSalesOrder: vi.fn() }));
vi.mock('../../../features/document-checklists/useDocumentChecklistGate', () => ({
  useDocumentChecklistGate: vi.fn(() => ({})),
}));
vi.mock('../../../features/document-checklists/ChecklistConfirmationDialog', () => ({
  ChecklistConfirmationDialog: () => null,
}));

describe('sales-order import modal close guard', () => {
  it('ignores close requests while importing or waiting on a checklist', () => {
    const onClose = vi.fn();

    requestSalesOrderImportClose(onClose, true, false);
    requestSalesOrderImportClose(onClose, false, true);

    expect(onClose).not.toHaveBeenCalled();
  });

  it('allows the importer to close when no batch or checklist is busy', () => {
    const onClose = vi.fn();

    requestSalesOrderImportClose(onClose, false, false);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('sales-order CSV import checklist cancellation', () => {
  it('imports confirmed clients, then cancels that client and the rest of the batch without opening another checklist', async () => {
    const createdClients: string[] = [];
    const preparedClients: string[] = [];
    let checklistPrompts = 0;
    const runChecklist = vi.fn(async (input: any) => {
      if (input.organisationId !== 'org-42' || input.documentType !== 'sales_order') {
        throw new Error('The sales-order checklist was not scoped to the importing organisation');
      }

      checklistPrompts++;
      if (checklistPrompts === 1) {
        return { kind: 'completed', value: await input.action() };
      }
      return { kind: 'cancelled' };
    });

    const groups: Array<[string, Array<{
      line: number;
      client_name: string;
      item_ref: string;
      qty: number;
      rate: number;
      uom: string;
      delivery_date: string;
      remarks: string;
    }>]> = [
      ['Northwind', [{ line: 2, client_name: 'Northwind', item_ref: 'SKU-1', qty: 1, rate: 25, uom: 'ea', delivery_date: '', remarks: '' }]],
      ['Contoso', [{ line: 3, client_name: 'Contoso', item_ref: 'SKU-1', qty: 2, rate: 25, uom: 'ea', delivery_date: '', remarks: '' }]],
      ['Fabrikam', [{ line: 4, client_name: 'Fabrikam', item_ref: 'SKU-1', qty: 3, rate: 25, uom: 'ea', delivery_date: '', remarks: '' }]],
    ];

    const result = await runSalesOrderImportBatch(
      'org-42',
      groups,
      runChecklist as any,
      async (clientName) => {
        preparedClients.push(clientName);
        return { clientName };
      },
      { mutateAsync: async (payload: { clientName: string }) => {
        createdClients.push(payload.clientName);
        return `created-${payload.clientName}`;
      } },
    );

    expect(preparedClients).toEqual(['Northwind', 'Contoso']);
    expect(createdClients).toEqual(['Northwind']);
    expect(result).toEqual({ importedCount: 1, failed: [], cancelledCount: 2 });
    expect(checklistPrompts).toBe(2);
    expect(runChecklist).toHaveBeenCalledTimes(2);
  });
});
