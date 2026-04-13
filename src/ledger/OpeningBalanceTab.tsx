import React, { memo } from 'react';
import { Loader2, Pencil, Plus, Save } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDisplayDate } from './utils';
import type { LedgerClient, OpeningBalance, BulkOpeningBalanceInput } from './api';

type OpeningBalanceTabProps = {
  clients: LedgerClient[];
  selectedFy: string;
  openingBalances: OpeningBalance[];
  openingBalancesMap: Record<string, OpeningBalance>;
  openingBalanceDrafts: Record<string, BulkOpeningBalanceInput>;
  openingBalanceEditMode: boolean;
  openingBalancesQuery: { isLoading: boolean };
  autoPopulateMutation: { mutate: () => void; isPending: boolean };
  saveOpeningBalancesMutation: { mutate: (drafts: BulkOpeningBalanceInput[]) => void; isPending: boolean };
  setOpeningBalanceEditMode: (value: boolean) => void;
  setOpeningBalanceDrafts: React.Dispatch<React.SetStateAction<Record<string, BulkOpeningBalanceInput>>>;
};

const OpeningBalanceTab = memo(function OpeningBalanceTab({
  clients,
  selectedFy,
  openingBalances,
  openingBalancesMap,
  openingBalanceDrafts,
  openingBalanceEditMode,
  openingBalancesQuery,
  autoPopulateMutation,
  saveOpeningBalancesMutation,
  setOpeningBalanceEditMode,
  setOpeningBalanceDrafts,
}: OpeningBalanceTabProps) {
  return (
    <div className="p-4">
      <div className="mb-4">
        <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
          Opening Balances for {selectedFy}
        </div>
        <div className="mt-1 text-xs text-zinc-500">
          Set the opening balance for each client at the start of the financial year.
          <span className="ml-1.5 text-zinc-400">
            (Positive = Debit/Owed, Negative = Credit/Advance)
          </span>
        </div>
      </div>
      
      {openingBalancesQuery.isLoading && (
        <div className="py-12 text-center">
          <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
            <Loader2 size={12} className="animate-spin" />
            Loading opening balances...
          </span>
        </div>
      )}

      {!openingBalancesQuery.isLoading && clients.length === 0 && (
        <div className="py-12 text-center">
          <div className="mx-auto max-w-sm space-y-2">
            <div className="text-sm font-medium text-zinc-950">No clients found</div>
            <div className="text-xs text-zinc-500">
              Add clients to your organisation first.
            </div>
          </div>
        </div>
      )}

      {!openingBalancesQuery.isLoading && clients.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-zinc-200">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-zinc-200 bg-zinc-50/80">
                <TableHead className="h-9 px-3 text-left align-middle text-[11px] font-medium text-zinc-500">Client</TableHead>
                <TableHead className="h-9 px-3 text-right align-middle text-[11px] font-medium text-zinc-500">Opening Balance</TableHead>
                <TableHead className="h-9 px-3 text-left align-middle text-[11px] font-medium text-zinc-500">As of Date</TableHead>
                <TableHead className="h-9 px-3 text-left align-middle text-[11px] font-medium text-zinc-500">Remarks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="[&_tr:last-child]:border-0">
              {clients.map((client) => {
                const existingOb = openingBalancesMap[client.id];
                const draftOb = openingBalanceDrafts[client.id];
                const obValue = draftOb ?? existingOb;
                
                return (
                  <tr key={client.id} className="border-b border-zinc-100 hover:bg-zinc-50/50">
                    <td className="px-3 py-2.5 align-middle">
                      <span className="text-sm font-medium text-zinc-950">{client.name}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right align-middle">
                      {openingBalanceEditMode ? (
                        <input
                          type="number"
                          step="0.01"
                          value={draftOb?.amount ?? obValue?.amount ?? 0}
                          onChange={(e) => {
                            const val = e.target.value;
                            const amount = val === '' ? 0 : parseFloat(val);
                            const fyYear = parseInt(selectedFy.match(/\d{2}$/)?.[0] || '0');
                            const century = Math.floor(new Date().getFullYear() / 100) * 100;
                            const fullYear = century - 100 + fyYear;
                            const defaultDate = `${fullYear}-04-01`;
                            setOpeningBalanceDrafts(prev => ({
                              ...prev,
                              [client.id]: {
                                client_id: client.id,
                                amount: isNaN(amount) ? 0 : amount,
                                as_of_date: prev[client.id]?.as_of_date ?? obValue?.as_of_date ?? defaultDate,
                                remarks: prev[client.id]?.remarks ?? obValue?.remarks ?? '',
                              }
                            }));
                          }}
                          className="h-7 w-28 rounded border border-zinc-200 px-2 text-right text-xs"
                        />
                      ) : (
                        <span className={`text-sm font-medium ${(obValue?.amount ?? 0) < 0 ? 'text-emerald-600' : 'text-zinc-950'}`}>
                          {formatCurrency(obValue?.amount ?? 0)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      {openingBalanceEditMode ? (
                        <input
                          type="date"
                          value={draftOb?.as_of_date ?? obValue?.as_of_date ?? ''}
                          onChange={(e) => {
                            setOpeningBalanceDrafts(prev => ({
                              ...prev,
                              [client.id]: {
                                client_id: client.id,
                                amount: prev[client.id]?.amount ?? obValue?.amount ?? 0,
                                as_of_date: e.target.value,
                                remarks: prev[client.id]?.remarks ?? obValue?.remarks ?? '',
                              }
                            }));
                          }}
                          className="h-7 rounded border border-zinc-200 px-2 text-xs"
                        />
                      ) : (
                        <span className="text-xs text-zinc-500">
                          {obValue?.as_of_date ? formatDisplayDate(obValue.as_of_date) : '-'}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      {openingBalanceEditMode ? (
                        <input
                          type="text"
                          value={draftOb?.remarks ?? obValue?.remarks ?? ''}
                          onChange={(e) => {
                            const fyYear = parseInt(selectedFy.match(/\d{2}$/)?.[0] || '0');
                            const century = Math.floor(new Date().getFullYear() / 100) * 100;
                            const fullYear = century - 100 + fyYear;
                            const defaultDate = `${fullYear}-04-01`;
                            setOpeningBalanceDrafts(prev => ({
                              ...prev,
                              [client.id]: {
                                client_id: client.id,
                                amount: prev[client.id]?.amount ?? obValue?.amount ?? 0,
                                as_of_date: prev[client.id]?.as_of_date ?? obValue?.as_of_date ?? defaultDate,
                                remarks: e.target.value,
                              }
                            }));
                          }}
                          className="h-7 w-full rounded border border-zinc-200 px-2 text-xs"
                          placeholder="Remarks..."
                        />
                      ) : (
                        <span className="text-xs text-zinc-500">
                          {obValue?.remarks || '-'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      
      {clients.length > 0 && (
        <div className="mt-4 flex items-center justify-between border-t border-zinc-200 pt-4">
          <span className="text-xs text-zinc-500">Total Opening Balance:</span>
          <span className="text-base font-semibold text-zinc-950">
            {formatCurrency(
              Object.values(openingBalanceDrafts).reduce((sum, ob) => sum + (ob?.amount ?? 0), 0) ||
              openingBalances.reduce((sum, ob) => sum + ob.amount, 0)
            )}
          </span>
        </div>
      )}

      <div className="mt-4 flex items-center gap-2 border-t border-zinc-200 pt-4">
        {!openingBalanceEditMode && (
          <>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => autoPopulateMutation.mutate()}
              isLoading={autoPopulateMutation.isPending}
              leftIcon={<Plus size={12} />}
            >
              Auto-populate from Previous FY
            </Button>
            {selectedFy && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  const event = new CustomEvent('startOpeningBalanceEdit');
                  window.dispatchEvent(event);
                }}
                leftIcon={<Pencil size={12} />}
              >
                Edit / Add New Client
              </Button>
            )}
          </>
        )}
        {openingBalanceEditMode && (
          <>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setOpeningBalanceEditMode(false);
                setOpeningBalanceDrafts({});
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                const drafts = Object.values(openingBalanceDrafts);
                console.log('Saving opening balances:', { drafts, selectedFy });
                if (drafts.length > 0 && selectedFy) {
                  saveOpeningBalancesMutation.mutate(drafts);
                } else {
                  console.warn('Cannot save:', { draftsLength: drafts.length, selectedFy });
                  alert('Please select a Financial Year and ensure there are balances to save.');
                }
              }}
              isLoading={saveOpeningBalancesMutation.isPending}
              leftIcon={<Save size={12} />}
            >
              Save All
            </Button>
          </>
        )}
      </div>
    </div>
  );
});

export default OpeningBalanceTab;
