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
  if (summary.outstanding <= 0) return 'bg-emerald-100 text-emerald-800';
  if (summary.overdue) return 'bg-rose-100 text-rose-800';
  return 'bg-amber-100 text-amber-800';
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
      <div className="mx-auto max-w-4xl px-8 py-16">
        <div className="rounded-2xl border border-indigo-100 bg-white p-8 text-sm text-indigo-900/70 shadow-sm">
          Select an organisation to open the ledger dashboard.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-50">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap');
        
        .font-display { font-family: 'Space Grotesk', system-ui, sans-serif; }
        .font-body { font-family: 'IBM Plex Sans', system-ui, sans-serif; }
        
        .bg-cream-50 { background-color: oklch(0.97 0.01 85); }
        .bg-cream-100 { background-color: oklch(0.94 0.02 85); }
        .bg-navy-950 { background-color: oklch(0.18 0.03 260); }
        .bg-navy-900 { background-color: oklch(0.25 0.04 260); }
        .bg-navy-800 { background-color: oklch(0.32 0.05 260); }
        .text-navy-950 { color: oklch(0.18 0.03 260); }
        .text-navy-900 { color: oklch(0.25 0.04 260); }
        .text-navy-600 { color: oklch(0.45 0.06 260); }
        .text-navy-500 { color: oklch(0.55 0.06 260); }
        .border-navy-200 { border-color: oklch(0.85 0.04 260); }
        .border-navy-100 { border-color: oklch(0.91 0.03 260); }
        .bg-amber-accent { background-color: oklch(0.75 0.15 80); }
        .text-amber-accent { color: oklch(0.55 0.12 80); }
        
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-up { animation: fadeUp 0.5s ease-out forwards; }
        .animation-delay-1 { animation-delay: 0.1s; }
        .animation-delay-2 { animation-delay: 0.2s; }
        .animation-delay-3 { animation-delay: 0.3s; }
      `}</style>

      <div className="mx-auto max-w-7xl px-8 py-12">
        {/* Header */}
        <div className="mb-10 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-navy-500">
              Ledger Overview
            </span>
            <h1 className="font-display mt-3 text-4xl font-semibold tracking-tight text-navy-950">
              Outstanding & Receipts
            </h1>
            <p className="font-body mt-2 max-w-xl text-sm leading-relaxed text-navy-600">
              Org-scoped client ledger with outstanding balances, overdue aging, payment capture, and printable statements.
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <section className="mb-10 grid gap-5 md:grid-cols-3">
          <div className="animate-fade-up rounded-2xl border border-navy-100 bg-white p-6 shadow-sm">
            <div className="mb-4 inline-flex rounded-xl bg-cream-100 p-3 text-navy-900">
              <Wallet size={18} strokeWidth={1.5} />
            </div>
            <div className="font-body text-xs font-semibold uppercase tracking-wider text-navy-500">Outstanding</div>
            <div className="font-display mt-2 text-3xl font-semibold tracking-tight text-navy-950">
              {formatCurrency(dashboardTotals.totalOutstanding)}
            </div>
          </div>

          <div className="animate-fade-up animation-delay-1 rounded-2xl border border-navy-100 bg-white p-6 shadow-sm">
            <div className="mb-4 inline-flex rounded-xl bg-cream-100 p-3 text-navy-900">
              <Landmark size={18} strokeWidth={1.5} />
            </div>
            <div className="font-body text-xs font-semibold uppercase tracking-wider text-navy-500">Invoice Debits</div>
            <div className="font-display mt-2 text-3xl font-semibold tracking-tight text-navy-950">
              {formatCurrency(dashboardTotals.totalDebits)}
            </div>
          </div>

          <div className="animate-fade-up animation-delay-2 rounded-2xl border border-navy-100 bg-white p-6 shadow-sm">
            <div className="mb-4 inline-flex rounded-xl bg-cream-100 p-3 text-navy-900">
              <Filter size={18} strokeWidth={1.5} />
            </div>
            <div className="font-body text-xs font-semibold uppercase tracking-wider text-navy-500">Receipt Credits</div>
            <div className="font-display mt-2 text-3xl font-semibold tracking-tight text-navy-950">
              {formatCurrency(dashboardTotals.totalCredits)}
            </div>
          </div>
        </section>

        {/* Main Content */}
        <section className="animate-fade-up animation-delay-3 rounded-2xl border border-navy-100 bg-white shadow-sm">
          {/* Filters */}
          <div className="border-b border-navy-100 p-6">
            <div className="grid gap-6 lg:grid-cols-[1fr_auto_auto] lg:items-end">
              <div className="space-y-3">
                <span className="font-body text-xs font-semibold uppercase tracking-[0.15em] text-navy-500">
                  Date Range
                </span>
                <div className="flex flex-wrap gap-2">
                  {(['monthly', 'financial-year', 'last-3-months', 'last-6-months', 'last-2-years'] as RangePreset[]).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handlePreset(preset)}
                      className={`font-body rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                        selectedPreset === preset
                          ? 'bg-navy-950 text-white'
                          : 'border border-navy-200 bg-white text-navy-600 hover:bg-cream-50'
                      }`}
                    >
                      {getPresetLabel(preset)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <div className="space-y-1.5">
                  <span className="font-body block text-xs font-semibold uppercase tracking-[0.15em] text-navy-500">From</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(event) => {
                      setSelectedPreset(null);
                      setStartDate(event.target.value);
                    }}
                    className="font-body h-10 w-36 rounded-lg border border-navy-200 bg-white px-3 text-sm text-navy-900 outline-none transition focus:border-navy-500 focus:ring-2 focus:ring-navy-100"
                  />
                </div>
                <div className="space-y-1.5">
                  <span className="font-body block text-xs font-semibold uppercase tracking-[0.15em] text-navy-500">To</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(event) => {
                      setSelectedPreset(null);
                      setEndDate(event.target.value);
                    }}
                    className="font-body h-10 w-36 rounded-lg border border-navy-200 bg-white px-3 text-sm text-navy-900 outline-none transition focus:border-navy-500 focus:ring-2 focus:ring-navy-100"
                  />
                </div>
              </div>

              <div className="flex items-end gap-3">
                <label className="font-body flex cursor-pointer items-center gap-2 rounded-lg border border-navy-200 px-3 py-2.5 text-sm text-navy-600 transition hover:bg-cream-50">
                  <input
                    type="checkbox"
                    checked={saveAsDefault}
                    onChange={(event) => setSaveAsDefault(event.target.checked)}
                    className="h-4 w-4 rounded border-navy-300 text-navy-950 focus:ring-navy-500"
                  />
                  Save as default
                </label>

                <button
                  type="button"
                  onClick={handleSearch}
                  disabled={!hasPendingFilterChanges}
                  className="font-body inline-flex items-center justify-center gap-2 rounded-lg bg-navy-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-900 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Search size={14} />
                  Apply
                </button>
              </div>
            </div>
          </div>

          {/* Table + Payment Form */}
          <div className="grid gap-6 p-6 xl:grid-cols-[1fr_340px]">
            {/* Table */}
            <div className="overflow-hidden rounded-xl border border-navy-100">
              <table className="w-full">
                <thead>
                  <tr className="bg-cream-100 font-body text-left text-xs font-semibold uppercase tracking-[0.15em] text-navy-600">
                    <th className="px-5 py-4">Client Name</th>
                    <th className="px-4 py-4 text-right">Outstanding</th>
                    <th className="px-4 py-4">Oldest Due</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && (
                    <tr>
                      <td colSpan={5} className="px-5 py-16 text-center">
                        <span className="font-body inline-flex items-center gap-2 text-sm text-navy-500">
                          <Loader2 className="animate-spin" size={14} />
                          Loading ledger data...
                        </span>
                      </td>
                    </tr>
                  )}

                  {!isLoading && summaries.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-16 text-center">
                        <div className="mx-auto max-w-md space-y-3">
                          <div className="font-display text-base font-semibold text-navy-950">No ledger data found</div>
                          <div className="font-body text-sm text-navy-600">
                            Make sure your clients are linked to this organisation, then record invoices and receipts.
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}

                  {summaries.map((summary, idx) => (
                    <tr 
                      key={summary.clientId} 
                      className="font-body border-t border-navy-100 text-sm text-navy-700 transition hover:bg-cream-50"
                      style={{ animationDelay: `${idx * 0.05}s` }}
                    >
                      <td className="px-5 py-4">
                        <div className="font-display font-medium text-navy-950">{summary.clientName}</div>
                      </td>
                      <td className="px-4 py-4 text-right font-display font-medium text-navy-950">
                        {formatCurrency(summary.outstanding)}
                      </td>
                      <td className="px-4 py-4 text-navy-600">{formatDisplayDate(summary.oldestDueDate)}</td>
                      <td className="px-4 py-4">
                        <span className={`font-body inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusBadge(summary)}`}>
                          {summary.outstanding <= 0 ? 'Settled' : summary.overdue ? 'Overdue' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleView(summary.clientId)}
                          className="font-body inline-flex items-center gap-2 rounded-lg border border-navy-200 px-3 py-1.5 text-xs font-semibold text-navy-700 transition hover:border-navy-400 hover:bg-cream-50"
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

            {/* Payment Form */}
            <div ref={paymentCardRef} className="h-fit rounded-xl border border-navy-100 bg-cream-50 p-1">
              <div className="rounded-lg border border-navy-100 bg-white p-5 shadow-sm">
                <span className="font-body text-xs font-semibold uppercase tracking-[0.15em] text-navy-500">Record Payment</span>
                <h2 className="font-display mt-2 text-xl font-semibold tracking-tight text-navy-950">Add receipt</h2>
                <p className="font-body mt-1 text-sm leading-relaxed text-navy-600">
                  Receipts refresh the ledger immediately after save.
                </p>

                <form
                  onSubmit={paymentForm.handleSubmit((values) => recordPaymentMutation.mutate(values))}
                  className="mt-5 space-y-4"
                >
                  <div className="space-y-1.5">
                    <span className="font-body block text-xs font-semibold uppercase tracking-[0.15em] text-navy-500">Client</span>
                    <select
                      {...paymentForm.register('client_id')}
                      className="font-body h-11 w-full rounded-lg border border-navy-200 bg-white px-3 text-sm text-navy-900 outline-none transition focus:border-navy-500 focus:ring-2 focus:ring-navy-100"
                    >
                      <option value="">Select client</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name}
                        </option>
                      ))}
                    </select>
                    {paymentForm.formState.errors.client_id && (
                      <p className="font-body text-xs text-rose-600">{paymentForm.formState.errors.client_id.message}</p>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <span className="font-body block text-xs font-semibold uppercase tracking-[0.15em] text-navy-500">Amount</span>
                      <input
                        type="number"
                        step="0.01"
                        {...paymentForm.register('amount')}
                        className="font-body h-11 w-full rounded-lg border border-navy-200 bg-white px-3 text-sm text-navy-900 outline-none transition focus:border-navy-500 focus:ring-2 focus:ring-navy-100"
                        placeholder="0.00"
                      />
                      {paymentForm.formState.errors.amount && (
                        <p className="font-body text-xs text-rose-600">{paymentForm.formState.errors.amount.message}</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <span className="font-body block text-xs font-semibold uppercase tracking-[0.15em] text-navy-500">Date</span>
                      <input
                        type="date"
                        {...paymentForm.register('receipt_date')}
                        className="font-body h-11 w-full rounded-lg border border-navy-200 bg-white px-3 text-sm text-navy-900 outline-none transition focus:border-navy-500 focus:ring-2 focus:ring-navy-100"
                      />
                      {paymentForm.formState.errors.receipt_date && (
                        <p className="font-body text-xs text-rose-600">{paymentForm.formState.errors.receipt_date.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="font-body block text-xs font-semibold uppercase tracking-[0.15em] text-navy-500">Remarks</span>
                    <textarea
                      {...paymentForm.register('remarks')}
                      rows={3}
                      className="font-body w-full rounded-lg border border-navy-200 bg-white px-3 py-2.5 text-sm text-navy-900 outline-none transition focus:border-navy-500 focus:ring-2 focus:ring-navy-100"
                      placeholder="Advance, part payment, retention release..."
                    />
                    {paymentForm.formState.errors.remarks && (
                      <p className="font-body text-xs text-rose-600">{paymentForm.formState.errors.remarks.message}</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={recordPaymentMutation.isPending || clients.length === 0}
                    className="font-body inline-flex w-full items-center justify-center gap-2 rounded-lg bg-navy-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-navy-900 disabled:cursor-not-allowed disabled:opacity-40"
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
    </div>
  );
}
