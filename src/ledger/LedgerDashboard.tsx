import { useEffect, useMemo, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { endOfMonth, format, subMonths, subYears, startOfMonth } from 'date-fns';
import { Eye, Filter, Landmark, Loader2, Search, Wallet } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import LedgerModal from './LedgerModal';
import { createReceipt, listLedgerClients, listLedgerInvoices, listLedgerReceipts, type LedgerClient } from './api';
import { buildLedgerSummaries, formatCurrency, formatDisplayDate, type LedgerSummaryRow } from './utils';

const DEFAULT_STORAGE_KEY = 'ledger.dashboard.default-range.v1';

type RangePreset = 'monthly' | 'financial-year' | 'last-3-months' | 'last-6-months' | 'last-2-years';

const recordPaymentSchema = z.object({
  client_id: z.string().min(1, 'Select a client'),
  amount: z.coerce.number().positive('Amount must be greater than zero'),
  receipt_date: z.string().min(1, 'Date is required'),
  remarks: z.string().min(2, 'Remarks are required'),
});

type RecordPaymentValues = z.infer<typeof recordPaymentSchema>;

function toDateInput(date: Date) {
  return format(date, 'yyyy-MM-dd');
}

function getFinancialYearRange(baseDate: Date) {
  const year = baseDate.getMonth() >= 3 ? baseDate.getFullYear() : baseDate.getFullYear() - 1;
  return {
    startDate: `${year}-04-01`,
    endDate: `${year + 1}-03-31`,
  };
}

function getPresetRange(preset: RangePreset) {
  const now = new Date();
  if (preset === 'monthly') {
    return {
      startDate: toDateInput(startOfMonth(now)),
      endDate: toDateInput(endOfMonth(now)),
    };
  }
  if (preset === 'financial-year') {
    return getFinancialYearRange(now);
  }
  if (preset === 'last-3-months') {
    return {
      startDate: toDateInput(subMonths(now, 3)),
      endDate: toDateInput(now),
    };
  }
  if (preset === 'last-6-months') {
    return {
      startDate: toDateInput(subMonths(now, 6)),
      endDate: toDateInput(now),
    };
  }

  return {
    startDate: toDateInput(subYears(now, 2)),
    endDate: toDateInput(now),
  };
}

function getPresetLabel(preset: RangePreset) {
  if (preset === 'monthly') return 'Monthly';
  if (preset === 'financial-year') return 'Financial Year';
  if (preset === 'last-3-months') return 'Last 3 Months';
  if (preset === 'last-6-months') return 'Last 6 Months';
  return 'Last 2 Years';
}

function readStoredDefault() {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(DEFAULT_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as { preset: RangePreset | null; startDate: string; endDate: string };
    if (!parsed.startDate || !parsed.endDate) return null;
    return parsed;
  } catch {
    return null;
  }
}

function statusBadge(summary: LedgerSummaryRow) {
  if (summary.outstanding <= 0) return 'bg-emerald-50 text-emerald-700';
  if (summary.overdue) return 'bg-rose-50 text-rose-700';
  return 'bg-amber-50 text-amber-700';
}

export default function LedgerDashboard() {
  const { organisation } = useAuth();
  const orgId = String(organisation?.id ?? '');
  const paymentCardRef = useRef<HTMLDivElement | null>(null);
  const qc = useQueryClient();

  const storedDefault = useMemo(() => readStoredDefault(), []);
  const [selectedPreset, setSelectedPreset] = useState<RangePreset | null>(storedDefault?.preset ?? 'monthly');
  const [startDate, setStartDate] = useState(storedDefault?.startDate ?? getPresetRange('monthly').startDate);
  const [endDate, setEndDate] = useState(storedDefault?.endDate ?? getPresetRange('monthly').endDate);
  const [appliedStartDate, setAppliedStartDate] = useState(storedDefault?.startDate ?? getPresetRange('monthly').startDate);
  const [appliedEndDate, setAppliedEndDate] = useState(storedDefault?.endDate ?? getPresetRange('monthly').endDate);
  const [saveAsDefault, setSaveAsDefault] = useState(Boolean(storedDefault));
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const clientsQuery = useQuery({
    queryKey: ['ledger', 'clients', orgId],
    queryFn: () => listLedgerClients(orgId),
    enabled: Boolean(orgId),
    staleTime: 5 * 60 * 1000,
  });

  const invoicesQuery = useQuery({
    queryKey: ['ledger', 'invoices', orgId, appliedStartDate, appliedEndDate],
    queryFn: () => listLedgerInvoices(orgId, { startDate: appliedStartDate, endDate: appliedEndDate }),
    enabled: Boolean(orgId),
  });

  const receiptsQuery = useQuery({
    queryKey: ['ledger', 'receipts', orgId, appliedStartDate, appliedEndDate],
    queryFn: () => listLedgerReceipts(orgId, { startDate: appliedStartDate, endDate: appliedEndDate }),
    enabled: Boolean(orgId),
  });

  const paymentForm = useForm<RecordPaymentValues>({
    resolver: zodResolver(recordPaymentSchema),
    defaultValues: {
      client_id: '',
      amount: undefined,
      receipt_date: toDateInput(new Date()),
      remarks: '',
    },
  });

  const recordPaymentMutation = useMutation({
    mutationFn: (values: RecordPaymentValues) =>
      createReceipt({
        org_id: orgId,
        client_id: values.client_id,
        amount: values.amount,
        receipt_date: values.receipt_date,
        remarks: values.remarks,
      }),
    onSuccess: () => {
      toast.success('Payment recorded successfully.');
      paymentForm.reset({
        client_id: '',
        amount: undefined,
        receipt_date: toDateInput(new Date()),
        remarks: '',
      });

      // Refresh in the background so the mutation does not stay pending
      // while downstream queries refetch.
      void qc.invalidateQueries({ queryKey: ['ledger', 'receipts', orgId] });
      void qc.invalidateQueries({ queryKey: ['ledger', 'invoices', orgId] });
    },
    onError: (error: any) => {
      toast.error(error?.message ?? 'Unable to record payment.');
    },
  });

  useEffect(() => {
    if (saveAsDefault) {
      window.localStorage.setItem(
        DEFAULT_STORAGE_KEY,
        JSON.stringify({
          preset: selectedPreset,
          startDate: appliedStartDate,
          endDate: appliedEndDate,
        }),
      );
      return;
    }

    window.localStorage.removeItem(DEFAULT_STORAGE_KEY);
  }, [appliedEndDate, appliedStartDate, saveAsDefault, selectedPreset]);

  const clients = clientsQuery.data ?? [];
  const summaries = useMemo(
    () => buildLedgerSummaries(clients, invoicesQuery.data ?? [], receiptsQuery.data ?? []),
    [clients, invoicesQuery.data, receiptsQuery.data],
  );

  const selectedSummary = useMemo(
    () => summaries.find((item) => item.clientId === selectedClientId) ?? null,
    [selectedClientId, summaries],
  );

  const selectedClient = useMemo<LedgerClient | null>(
    () => clients.find((client) => client.id === selectedClientId) ?? null,
    [clients, selectedClientId],
  );

  const dashboardTotals = useMemo(() => {
    const totalOutstanding = summaries.reduce((sum, row) => sum + row.outstanding, 0);
    const totalDebits = (invoicesQuery.data ?? []).reduce((sum, row) => sum + Number(row.total || 0), 0);
    const totalCredits = (receiptsQuery.data ?? []).reduce((sum, row) => sum + Number(row.amount || 0), 0);

    return {
      totalOutstanding,
      totalDebits,
      totalCredits,
    };
  }, [invoicesQuery.data, receiptsQuery.data, summaries]);

  const rangeLabel = `${formatDisplayDate(appliedStartDate)} to ${formatDisplayDate(appliedEndDate)}`;
  const hasPendingFilterChanges = startDate !== appliedStartDate || endDate !== appliedEndDate;

  const handlePreset = (preset: RangePreset) => {
    const range = getPresetRange(preset);
    setSelectedPreset(preset);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
  };

  const handleSearch = () => {
    setAppliedStartDate(startDate);
    setAppliedEndDate(endDate);
  };

  const handleView = (clientId: string) => {
    setSelectedClientId(clientId);
    setModalOpen(true);
  };

  const handleEditLedger = (clientId: string) => {
    setSelectedClientId(clientId);
    paymentForm.setValue('client_id', clientId, { shouldDirty: true, shouldValidate: true });
    setModalOpen(false);
    paymentCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const isLoading = clientsQuery.isLoading || invoicesQuery.isLoading || receiptsQuery.isLoading;

  if (!orgId) {
    return (
      <div className="mx-auto max-w-[960px] px-6 py-8">
        <div className="rounded-[24px] border border-slate-200 bg-white p-6 text-[13px] text-slate-600 shadow-sm">
          Select an organisation to open the ledger dashboard.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-5 px-6 py-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-400">Ledger Overview</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Outstanding & Receipts</h1>
          <p className="mt-2 max-w-3xl text-[13px] leading-6 text-slate-500">
            Org-scoped client ledger with outstanding balances, overdue aging, payment capture, and printable statements.
          </p>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="inline-flex rounded-full bg-slate-100 p-2 text-slate-700">
            <Wallet size={16} />
          </div>
          <div className="mt-4 text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-400">Outstanding</div>
          <div className="mt-2 text-[28px] font-semibold tracking-tight text-slate-950">
            {formatCurrency(dashboardTotals.totalOutstanding)}
          </div>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="inline-flex rounded-full bg-slate-100 p-2 text-slate-700">
            <Landmark size={16} />
          </div>
          <div className="mt-4 text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-400">Invoice Debits</div>
          <div className="mt-2 text-[28px] font-semibold tracking-tight text-slate-950">
            {formatCurrency(dashboardTotals.totalDebits)}
          </div>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="inline-flex rounded-full bg-slate-100 p-2 text-slate-700">
            <Filter size={16} />
          </div>
          <div className="mt-4 text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-400">Receipt Credits</div>
          <div className="mt-2 text-[28px] font-semibold tracking-tight text-slate-950">
            {formatCurrency(dashboardTotals.totalCredits)}
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-4 border-b border-slate-200 px-5 py-5 lg:grid-cols-[1.2fr_1fr_auto_auto] lg:items-end">
          <div className="space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Presets</div>
            <div className="flex flex-wrap gap-2">
              {(['monthly', 'financial-year', 'last-3-months', 'last-6-months', 'last-2-years'] as RangePreset[]).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handlePreset(preset)}
                  className={`rounded-full px-3 py-2 text-[12px] font-semibold transition ${
                    selectedPreset === preset
                      ? 'bg-slate-950 text-white'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {getPresetLabel(preset)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Start Date</span>
              <input
                type="date"
                value={startDate}
                onChange={(event) => {
                  setSelectedPreset(null);
                  setStartDate(event.target.value);
                }}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">End Date</span>
              <input
                type="date"
                value={endDate}
                onChange={(event) => {
                  setSelectedPreset(null);
                  setEndDate(event.target.value);
                }}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              />
            </label>
          </div>

          <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-[12px] font-medium text-slate-600">
            <input
              type="checkbox"
              checked={saveAsDefault}
              onChange={(event) => setSaveAsDefault(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Set as Default
          </label>

          <button
            type="button"
            onClick={handleSearch}
            disabled={!hasPendingFilterChanges}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Search size={14} />
            Search
          </button>
        </div>

        <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="overflow-hidden rounded-[24px] border border-slate-200">
            <table className="min-w-full table-fixed">
              <thead>
                <tr className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <th className="px-5 py-3">Client Name</th>
                  <th className="px-4 py-3 text-right">Total Outstanding</th>
                  <th className="px-4 py-3">Oldest Due Date</th>
                  <th className="px-4 py-3">Aging</th>
                  <th className="px-5 py-3 text-right">View</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={5} className="px-5 py-14 text-center text-[13px] text-slate-500">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="animate-spin" size={14} />
                        Loading ledger dashboard...
                      </span>
                    </td>
                  </tr>
                )}

                {!isLoading && summaries.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-14 text-center">
                      <div className="mx-auto max-w-md space-y-2">
                        <div className="text-[15px] font-semibold text-slate-900">No ledger data found</div>
                        <div className="text-[13px] text-slate-500">
                          Make sure your clients are linked to this organisation via `clients.org_id`, then record invoices and receipts.
                        </div>
                      </div>
                    </td>
                  </tr>
                )}

                {summaries.map((summary) => (
                  <tr key={summary.clientId} className="border-t border-slate-100 text-[13px] text-slate-700">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-slate-950">{summary.clientName}</div>
                    </td>
                    <td className="px-4 py-4 text-right font-semibold text-slate-950">
                      {formatCurrency(summary.outstanding)}
                    </td>
                    <td className="px-4 py-4 text-slate-600">{formatDisplayDate(summary.oldestDueDate)}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusBadge(summary)}`}>
                        {summary.outstanding <= 0 ? 'Settled' : summary.overdue ? 'Overdue' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleView(summary.clientId)}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        <Eye size={14} />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div ref={paymentCardRef} className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
            <div className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Record Payment</div>
              <h2 className="mt-2 text-[22px] font-semibold tracking-tight text-slate-950">Add receipt</h2>
              <p className="mt-2 text-[13px] leading-6 text-slate-500">
                Receipts refresh the ledger and dashboard totals immediately after save.
              </p>

              <form
                onSubmit={paymentForm.handleSubmit((values) => recordPaymentMutation.mutate(values))}
                className="mt-5 space-y-4"
              >
                <label className="block space-y-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Client</span>
                  <select
                    {...paymentForm.register('client_id')}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                  >
                    <option value="">Select client</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                  {paymentForm.formState.errors.client_id && (
                    <p className="text-[12px] text-rose-600">{paymentForm.formState.errors.client_id.message}</p>
                  )}
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Amount</span>
                    <input
                      type="number"
                      step="0.01"
                      {...paymentForm.register('amount')}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                      placeholder="0.00"
                    />
                    {paymentForm.formState.errors.amount && (
                      <p className="text-[12px] text-rose-600">{paymentForm.formState.errors.amount.message}</p>
                    )}
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Date</span>
                    <input
                      type="date"
                      {...paymentForm.register('receipt_date')}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                    />
                    {paymentForm.formState.errors.receipt_date && (
                      <p className="text-[12px] text-rose-600">{paymentForm.formState.errors.receipt_date.message}</p>
                    )}
                  </label>
                </div>

                <label className="block space-y-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Remarks</span>
                  <textarea
                    {...paymentForm.register('remarks')}
                    rows={4}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-[13px] text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                    placeholder="Advance, part payment, retention release..."
                  />
                  {paymentForm.formState.errors.remarks && (
                    <p className="text-[12px] text-rose-600">{paymentForm.formState.errors.remarks.message}</p>
                  )}
                </label>

                <button
                  type="submit"
                  disabled={recordPaymentMutation.isPending || clients.length === 0}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {recordPaymentMutation.isPending ? <Loader2 className="animate-spin" size={14} /> : <Wallet size={14} />}
                  Record Payment
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      <LedgerModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        organisation={(organisation as Record<string, unknown>) ?? null}
        client={selectedClient}
        summary={selectedSummary}
        rangeLabel={rangeLabel}
        onEditLedger={handleEditLedger}
      />
    </div>
  );
}
