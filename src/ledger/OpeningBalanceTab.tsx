import React, { memo } from 'react';
import { Loader2, Pencil, Plus, Save } from 'lucide-react';
import { Table, TableBody, TableCellDense, TableHead, TableHeader, TableRow, TableRowDense } from '@/components/ui/table';
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
    <div className="p-6">
      <div className="mb-4">
        <div className="font-display text-sm font-semibold text-navy-500 uppercase tracking-wider">
          Opening Balances for {selectedFy}
        </div>
        <div className="font-body mt-1 text-xs text-navy-600">
          Set the opening balance for each client at the start of the financial year.
          <span className="ml-2 text-navy-400">
            (Positive = Debit/Owed, Negative = Credit/Advance)
          </span>
        </div>
      </div>
      
      {openingBalancesQuery.isLoading && (
        <div className="py-12 text-center">
          <span className="font-body inline-flex items-center gap-2 text-sm text-navy-500">
            <Loader2 className="animate-spin" size={14} />
            Loading opening balances...
          </span>
        </div>
      )}

      {!openingBalancesQuery.isLoading && clients.length === 0 && (
        <div className="py-12 text-center">
          <div className="mx-auto max-w-md space-y-3">
            <div className="font-display text-base font-semibold text-navy-950">No clients found</div>
            <div className="font-body text-sm text-navy-600">
              Add clients to your organisation first.
            </div>
          </div>
        </div>
      )}

      {!openingBalancesQuery.isLoading && clients.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead className="text-right">Opening Balance</TableHead>
              <TableHead>As of Date</TableHead>
              <TableHead>Remarks</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client) => {
              const existingOb = openingBalancesMap[client.id];
              const draftOb = openingBalanceDrafts[client.id];
              const obValue = draftOb ?? existingOb;
              
              return (
                <TableRowDense key={client.id}>
                  <TableCellDense>
                    <div className="font-display font-medium text-navy-950">{client.name}</div>
                  </TableCellDense>
                  <TableCellDense className="text-right">
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
                        className="font-body h-8 w-32 rounded border border-navy-200 px-2 text-right text-sm"
                      />
                    ) : (
                      <span className={`font-display font-medium ${(obValue?.amount ?? 0) < 0 ? 'text-emerald-600' : 'text-navy-950'}`}>
                        {formatCurrency(obValue?.amount ?? 0)}
                      </span>
                    )}
                  </TableCellDense>
                  <TableCellDense>
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
                        className="font-body h-8 rounded border border-navy-200 px-2 text-sm"
                      />
                    ) : (
                      <span className="font-body text-sm text-navy-600">
                        {obValue?.as_of_date ? formatDisplayDate(obValue.as_of_date) : '-'}
                      </span>
                    )}
                  </TableCellDense>
                  <TableCellDense>
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
                        className="font-body h-8 w-full rounded border border-navy-200 px-2 text-sm"
                        placeholder="Remarks..."
                      />
                    ) : (
                      <span className="font-body text-sm text-navy-600">
                        {obValue?.remarks || '-'}
                      </span>
                    )}
                  </TableCellDense>
                </TableRowDense>
              );
            })}
          </TableBody>
        </Table>
      )}
      
      {clients.length > 0 && (
        <div className="mt-4 border-t border-navy-100 pt-4">
          <div className="flex items-center justify-between">
            <span className="font-body text-sm text-navy-600">Total Opening Balance:</span>
            <span className="font-display text-lg font-semibold text-navy-950">
              {formatCurrency(
                Object.values(openingBalanceDrafts).reduce((sum, ob) => sum + (ob?.amount ?? 0), 0) ||
                openingBalances.reduce((sum, ob) => sum + ob.amount, 0)
              )}
            </span>
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center gap-3 border-t border-navy-100 pt-4">
        {!openingBalanceEditMode && (
          <>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => autoPopulateMutation.mutate()}
              isLoading={autoPopulateMutation.isPending}
              leftIcon={<Plus size={14} />}
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
                leftIcon={<Pencil size={14} />}
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
              leftIcon={<Save size={14} />}
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
