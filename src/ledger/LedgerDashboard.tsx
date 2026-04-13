import { useEffect, useMemo, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { endOfMonth, format, subMonths, subYears, startOfMonth } from 'date-fns';
import { ChevronDown, FileText, Filter, Landmark, Loader2, Pencil, Plus, Save, Search, Trash2, Wallet, X, Calculator } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableRowDense,
  TableCellDense,
} from '@/components/ui/table';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import LedgerModal from './LedgerModal';
import OpeningBalanceTab from './OpeningBalanceTab';
import {
  createReceipt,
  listLedgerClients,
  listLedgerInvoices,
  listLedgerReceipts,
  updateReceipt,
  deleteReceipt,
  getOpeningBalances,
  bulkUpsertOpeningBalances,
  getOrAutoCreateOpeningBalance,
  getPreviousFinancialYear,
  type LedgerClient,
  type LedgerReceipt,
  type OpeningBalance,
  type BulkOpeningBalanceInput,
} from './api';
import { buildLedgerSummaries, formatCurrency, formatDisplayDate, generateFyOptions, type LedgerSummaryRow } from './utils';

const DEFAULT_STORAGE_KEY = 'ledger.dashboard.default-range.v1';

type RangePreset = 'monthly' | 'financial-year' | 'last-3-months' | 'last-6-months' | 'last-2-years';
type TabType = 'ledger' | 'details' | 'opening-balance';
type EditingReceipt = {
  id: string;
  amount: number;
  receipt_date: string;
  payment_type: string;
  remarks: string;
};

const recordPaymentSchema = z.object({
  client_id: z.string().min(1, 'Select a client'),
  amount: z.coerce.number().positive('Amount must be greater than zero'),
  receipt_date: z.string().min(1, 'Date is required'),
  payment_type: z.string().optional(),
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

function statusBadge(summary: LedgerSummaryRow): { color: string; bg: string; label: string; icon: string } {
  if (summary.outstanding <= 0) {
    return { color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Settled', icon: 'emerald' };
  }
  if (summary.overdue) {
    return { color: 'text-rose-600', bg: 'bg-rose-50', label: 'Overdue', icon: 'rose' };
  }
  return { color: 'text-amber-600', bg: 'bg-amber-50', label: 'Pending', icon: 'amber' };
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('ledger');
  const [editingReceiptId, setEditingReceiptId] = useState<string | null>(null);
  const [editingForm, setEditingForm] = useState<EditingReceipt | null>(null);
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(new Set());
  const [selectedFy, setSelectedFy] = useState<string>('');
  const [openingBalanceEditMode, setOpeningBalanceEditMode] = useState(false);
  const [openingBalanceDrafts, setOpeningBalanceDrafts] = useState<Record<string, BulkOpeningBalanceInput>>({});

  const clientsQuery = useQuery({
    queryKey: ['ledger', 'clients', orgId],
    queryFn: () => listLedgerClients(orgId),
    enabled: Boolean(orgId),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (organisation?.current_financial_year && !selectedFy) {
      setSelectedFy(String(organisation.current_financial_year));
    }
  }, [organisation, selectedFy]);

  const openingBalancesQuery = useQuery({
    queryKey: ['ledger', 'opening-balances', orgId, selectedFy],
    queryFn: () => getOpeningBalances(orgId, selectedFy),
    enabled: Boolean(orgId) && Boolean(selectedFy),
  });

  const saveOpeningBalancesMutation = useMutation({
    mutationFn: async (balances: BulkOpeningBalanceInput[]) => {
      console.log('Mutation called with:', { orgId, selectedFy, balances });
      await bulkUpsertOpeningBalances(orgId, selectedFy, balances);
    },
    onSuccess: () => {
      toast.success('Opening balances saved successfully.');
      setOpeningBalanceEditMode(false);
      setOpeningBalanceDrafts({});
      void qc.invalidateQueries({ queryKey: ['ledger', 'opening-balances', orgId, selectedFy] });
    },
    onError: (error: any) => {
      console.error('Save error:', error);
      toast.error(error?.message ?? 'Unable to save opening balances.');
    },
  });

  const autoPopulateMutation = useMutation({
    mutationFn: async () => {
      const prevFy = getPreviousFinancialYear(selectedFy);
      const clientIds = clients.map((c) => c.id);
      const promises = clientIds.map((clientId) =>
        getOrAutoCreateOpeningBalance(clientId, orgId, selectedFy, prevFy)
      );
      await Promise.all(promises);
    },
    onSuccess: () => {
      toast.success('Opening balances auto-populated from previous year.');
      void qc.invalidateQueries({ queryKey: ['ledger', 'opening-balances', orgId, selectedFy] });
    },
    onError: (error: any) => {
      toast.error(error?.message ?? 'Unable to auto-populate opening balances.');
    },
  });

  const openingBalances = openingBalancesQuery.data ?? [];
  const openingBalancesMap = useMemo(() => {
    const map: Record<string, OpeningBalance> = {};
    openingBalances.forEach((ob) => {
      map[ob.client_id] = ob;
    });
    return map;
  }, [openingBalances]);

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
      payment_type: '',
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
        payment_type: values.payment_type || null,
        remarks: values.remarks,
      }),
    onSuccess: () => {
      toast.success('Payment recorded successfully.');
      paymentForm.reset({
        client_id: '',
        amount: undefined,
        receipt_date: toDateInput(new Date()),
        payment_type: '',
        remarks: '',
      });

      void qc.invalidateQueries({ queryKey: ['ledger', 'receipts', orgId] });
      void qc.invalidateQueries({ queryKey: ['ledger', 'invoices', orgId] });
    },
    onError: (error: any) => {
      toast.error(error?.message ?? 'Unable to record payment.');
    },
  });

  const updateReceiptMutation = useMutation({
    mutationFn: updateReceipt,
    onSuccess: () => {
      toast.success('Receipt updated successfully.');
      setEditingReceiptId(null);
      setEditingForm(null);
      void qc.invalidateQueries({ queryKey: ['ledger', 'receipts', orgId] });
    },
    onError: (error: any) => {
      toast.error(error?.message ?? 'Unable to update receipt.');
    },
  });

  const deleteReceiptMutation = useMutation({
    mutationFn: deleteReceipt,
    onSuccess: () => {
      toast.success('Receipt deleted successfully.');
      void qc.invalidateQueries({ queryKey: ['ledger', 'receipts', orgId] });
    },
    onError: (error: any) => {
      toast.error(error?.message ?? 'Unable to delete receipt.');
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

  useEffect(() => {
    const handleStartEdit = () => handleStartOpeningBalanceEdit();
    window.addEventListener('startOpeningBalanceEdit', handleStartEdit);
    return () => window.removeEventListener('startOpeningBalanceEdit', handleStartEdit);
  }, [clients, openingBalancesMap, selectedFy]);

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

  const selectedClientReceipts = useMemo(() => {
    if (!selectedClientId) return [];
    return (receiptsQuery.data ?? []).filter((r) => r.client_id === selectedClientId);
  }, [receiptsQuery.data, selectedClientId]);

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
  const hasPendingDetailsChanges = editingReceiptId !== null || pendingDeletes.size > 0;

  const handlePreset = (preset: RangePreset) => {
    const range = getPresetRange(preset);
    setSelectedPreset(preset);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
  };

  const handleApplyFilters = () => {
    setAppliedStartDate(startDate);
    setAppliedEndDate(endDate);
    setFiltersOpen(false);
  };

  const handleView = (clientId: string) => {
    setSelectedClientId(clientId);
    setActiveTab('ledger');
    setModalOpen(true);
  };

  const handleEditLedger = (clientId: string) => {
    setSelectedClientId(clientId);
    setActiveTab('details');
  };

  const handleStartEdit = (receipt: LedgerReceipt) => {
    setEditingReceiptId(receipt.id);
    setEditingForm({
      id: receipt.id,
      amount: receipt.amount,
      receipt_date: receipt.receipt_date,
      payment_type: receipt.payment_type || '',
      remarks: receipt.remarks || '',
    });
    setPendingDeletes((prev) => {
      const next = new Set(prev);
      next.delete(receipt.id);
      return next;
    });
  };

  const handleCancelEdit = () => {
    setEditingReceiptId(null);
    setEditingForm(null);
  };

  const handleMarkDelete = (id: string) => {
    setPendingDeletes((prev) => new Set(prev).add(id));
    if (editingReceiptId === id) {
      setEditingReceiptId(null);
      setEditingForm(null);
    }
  };

  const handleUndoDelete = (id: string) => {
    setPendingDeletes((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleSaveEdit = () => {
    if (!editingForm) return;
    updateReceiptMutation.mutate({
      id: editingForm.id,
      amount: editingForm.amount,
      receipt_date: editingForm.receipt_date,
      payment_type: editingForm.payment_type || null,
      remarks: editingForm.remarks,
    });
  };

  const handleSaveAllChanges = async () => {
    const deletePromises = Array.from(pendingDeletes).map((id) => deleteReceiptMutation.mutateAsync(id));
    await Promise.all(deletePromises);
    setPendingDeletes(new Set());
    toast.success('All changes saved successfully.');
  };

  const handleStartOpeningBalanceEdit = () => {
    setOpeningBalanceEditMode(true);
    const drafts: Record<string, BulkOpeningBalanceInput> = {};
    const fyYear = parseInt(selectedFy.match(/\d{2}$/)?.[0] || '0');
    const century = Math.floor(new Date().getFullYear() / 100) * 100;
    const fullYear = century - 100 + fyYear;
    const defaultDate = `${fullYear}-04-01`;
    
    clients.forEach((client) => {
      const existingOb = openingBalancesMap[client.id];
      drafts[client.id] = {
        client_id: client.id,
        amount: existingOb?.amount ?? 0,
        as_of_date: existingOb?.as_of_date ?? defaultDate,
        remarks: existingOb?.remarks || '',
      };
    });
    setOpeningBalanceDrafts(drafts);
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
          {/* Header with Filter Dropdown and Tabs */}
          <div className="border-b border-navy-100 p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-6">
                {/* Tabs */}
                <div className="flex rounded-lg border border-navy-200 bg-white p-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab('ledger')}
                    className={`font-body inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition ${
                      activeTab === 'ledger'
                        ? 'bg-navy-950 text-white'
                        : 'text-navy-600 hover:bg-cream-50'
                    }`}
                  >
                    <FileText size={16} />
                    Client Ledger
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('details')}
                    className={`font-body inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition ${
                      activeTab === 'details'
                        ? 'bg-navy-950 text-white'
                        : 'text-navy-600 hover:bg-cream-50'
                    }`}
                  >
                    <Pencil size={16} />
                    Details
                    {hasPendingDetailsChanges && (
                      <span className="ml-1 h-2 w-2 rounded-full bg-amber-500" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('opening-balance')}
                    className={`font-body inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition ${
                      activeTab === 'opening-balance'
                        ? 'bg-navy-950 text-white'
                        : 'text-navy-600 hover:bg-cream-50'
                    }`}
                  >
                    <Calculator size={16} />
                    Opening Balance
                  </button>
                </div>

                {activeTab === 'ledger' && (
                  <span className="font-body text-sm text-navy-500">
                    {rangeLabel}
                  </span>
                )}
                {activeTab === 'details' && selectedClient && (
                  <span className="font-display text-sm font-medium text-navy-950">
                    {selectedClient.name}
                  </span>
                )}
                {activeTab === 'opening-balance' && (
                  <div className="flex items-center gap-2">
                    <span className="font-body text-sm text-navy-500">FY:</span>
                    <select
                      value={selectedFy}
                      onChange={(e) => setSelectedFy(e.target.value)}
                      className="font-body h-8 rounded border border-navy-200 bg-white px-2 text-sm text-navy-900 outline-none focus:border-navy-500"
                    >
                      <option value="">Select FY</option>
                      {generateFyOptions(
                        String(organisation?.financial_year_format || 'FY24-25'),
                        Number(organisation?.financial_year_start_month ?? 4)
                      ).map((fy) => (
                        <option key={fy} value={fy}>{fy}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                {activeTab === 'details' && hasPendingDetailsChanges && (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={handleSaveAllChanges}
                    isLoading={deleteReceiptMutation.isPending}
                    leftIcon={<Save size={14} />}
                  >
                    Save Changes
                  </Button>
                )}

                {activeTab === 'opening-balance' && !openingBalanceEditMode && selectedFy && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleStartOpeningBalanceEdit}
                    leftIcon={<Pencil size={14} />}
                  >
                    Edit
                  </Button>
                )}

                {activeTab === 'ledger' && (
                  <DropdownMenu open={filtersOpen} onOpenChange={setFiltersOpen}>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="font-body inline-flex items-center gap-2 rounded-lg border border-navy-200 bg-white px-4 py-2.5 text-sm font-semibold text-navy-700 transition hover:bg-cream-50"
                      >
                        <Filter size={16} />
                        Filters
                        <ChevronDown size={14} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-80 p-4">
                      <div className="space-y-4">
                        <div className="font-body text-xs font-semibold uppercase tracking-[0.15em] text-navy-500">
                          Presets
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(['monthly', 'financial-year', 'last-3-months', 'last-6-months', 'last-2-years'] as RangePreset[]).map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => handlePreset(preset)}
                              className={`font-body rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                                selectedPreset === preset
                                  ? 'bg-navy-950 text-white'
                                  : 'border border-navy-200 bg-white text-navy-600 hover:bg-cream-50'
                              }`}
                            >
                              {getPresetLabel(preset)}
                            </button>
                          ))}
                        </div>

                        <div className="border-t border-slate-200 pt-4">
                          <div className="font-body text-xs font-semibold uppercase tracking-[0.15em] text-navy-500 mb-3">
                            Custom Range
                          </div>
                          <div className="grid gap-3">
                            <div className="space-y-1">
                              <label className="font-body block text-xs font-medium text-navy-600">From</label>
                              <input
                                type="date"
                                value={startDate}
                                onChange={(event) => {
                                  setSelectedPreset(null);
                                  setStartDate(event.target.value);
                                }}
                                className="font-body h-9 w-full rounded-md border border-navy-200 bg-white px-3 text-sm text-navy-900 outline-none transition focus:border-navy-500 focus:ring-1 focus:ring-navy-100"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="font-body block text-xs font-medium text-navy-600">To</label>
                              <input
                                type="date"
                                value={endDate}
                                onChange={(event) => {
                                  setSelectedPreset(null);
                                  setEndDate(event.target.value);
                                }}
                                className="font-body h-9 w-full rounded-md border border-navy-200 bg-white px-3 text-sm text-navy-900 outline-none transition focus:border-navy-500 focus:ring-1 focus:ring-navy-100"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-slate-200 pt-4">
                          <label className="font-body flex cursor-pointer items-center gap-2 text-sm text-navy-600">
                            <input
                              type="checkbox"
                              checked={saveAsDefault}
                              onChange={(event) => setSaveAsDefault(event.target.checked)}
                              className="h-4 w-4 rounded border-navy-300 text-navy-950 focus:ring-navy-500"
                            />
                            Save as default
                          </label>
                        </div>

                        <Button
                          size="sm"
                          onClick={handleApplyFilters}
                          disabled={!hasPendingFilterChanges}
                          leftIcon={<Search size={14} />}
                          className="w-full"
                        >
                          Apply Filters
                        </Button>
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="grid gap-6 p-6 xl:grid-cols-[1fr_340px]">
            {/* Main Table Area */}
            <div className="overflow-hidden rounded-xl border border-navy-100">
              {activeTab === 'ledger' && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-gray-400 font-normal">Client</TableHead>
                      <TableHead className="text-right text-gray-400 font-normal">Outstanding</TableHead>
                      <TableHead className="text-gray-400 font-normal">Due Date</TableHead>
                      <TableHead className="text-gray-400 font-normal">Status</TableHead>
                      <TableHead className="text-right text-gray-400 font-normal">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading && (
                      <TableRow>
                        <TableCell colSpan={5} className="py-16 text-center">
                          <span className="font-body inline-flex items-center gap-2 text-sm text-navy-500">
                            <Loader2 className="animate-spin" size={14} />
                            Loading ledger data...
                          </span>
                        </TableCell>
                      </TableRow>
                    )}

                    {!isLoading && summaries.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="py-16 text-center">
                          <div className="mx-auto max-w-md space-y-3">
                            <div className="font-display text-base font-semibold text-navy-950">No ledger data found</div>
                            <div className="font-body text-sm text-navy-600">
                              Make sure your clients are linked to this organisation, then record invoices and receipts.
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}

                    {summaries.map((summary) => (
                      <TableRowDense key={summary.clientId}>
                        <TableCellDense>
                          <div className="font-display font-medium text-navy-950">{summary.clientName}</div>
                        </TableCellDense>
                        <TableCellDense className="text-right font-display font-medium text-navy-950">
                          {formatCurrency(summary.outstanding)}
                        </TableCellDense>
                        <TableCellDense className="text-navy-600">
                          {formatDisplayDate(summary.oldestDueDate)}
                        </TableCellDense>
                        <TableCellDense>
                          {(() => {
                            const status = statusBadge(summary);
                            const dotColors = {
                              emerald: 'bg-emerald-400',
                              rose: 'bg-rose-400',
                              amber: 'bg-amber-400',
                            };
                            return (
                              <span className={`font-body inline-flex items-center gap-2 text-xs ${status.color}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${dotColors[status.icon as keyof typeof dotColors]}`} />
                                {status.label}
                              </span>
                            );
                          })()}
                        </TableCellDense>
                        <TableCellDense className="text-right">
                          <button
                            type="button"
                            onClick={() => handleView(summary.clientId)}
                            className="font-body text-xs text-navy-600 underline underline-offset-2 hover:text-navy-900"
                          >
                            View Ledger
                          </button>
                          <span className="mx-2 text-gray-300">·</span>
                          <button
                            type="button"
                            onClick={() => handleEditLedger(summary.clientId)}
                            className="font-body text-xs text-navy-600 underline underline-offset-2 hover:text-navy-900"
                          >
                            Edit Details
                          </button>
                        </TableCellDense>
                      </TableRowDense>
                    ))}
                  </TableBody>
                </Table>
              )}

              {activeTab === 'details' && (
                <div className="p-6">
                  {!selectedClient && (
                    <div className="py-12 text-center">
                      <div className="mx-auto max-w-md space-y-3">
                        <div className="font-display text-base font-semibold text-navy-950">Select a client</div>
                        <div className="font-body text-sm text-navy-600">
                          Click on a client from the Client Ledger tab, or select "Edit Details" from the actions menu.
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedClient && selectedClientReceipts.length === 0 && !isLoading && (
                    <div className="py-12 text-center">
                      <div className="mx-auto max-w-md space-y-3">
                        <div className="font-display text-base font-semibold text-navy-950">No receipts found</div>
                        <div className="font-body text-sm text-navy-600">
                          This client has no receipt records in the selected date range.
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedClient && selectedClientReceipts.length > 0 && (
                    <div className="space-y-4">
                      <div className="font-display text-sm font-semibold text-navy-500 uppercase tracking-wider">
                        Receipts for {selectedClient.name}
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Payment Type</TableHead>
                            <TableHead>Remarks</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedClientReceipts.map((receipt) => {
                            const isEditing = editingReceiptId === receipt.id;
                            const isPendingDelete = pendingDeletes.has(receipt.id);

                            if (isPendingDelete) {
                              return (
                                <TableRow key={receipt.id} className="bg-rose-50/50">
                                  <TableCellDense colSpan={4} className="text-rose-600">
                                    <span className="line-through opacity-60">
                                      {formatDisplayDate(receipt.receipt_date)} — {receipt.remarks || 'Receipt'}
                                    </span>
                                    <span className="ml-2 text-xs font-semibold">(Marked for deletion)</span>
                                  </TableCellDense>
                                  <TableCellDense className="text-right">
                                    <button
                                      type="button"
                                      onClick={() => handleUndoDelete(receipt.id)}
                                      className="font-body inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-navy-600 hover:bg-cream-100"
                                    >
                                      <X size={12} />
                                      Undo
                                    </button>
                                  </TableCellDense>
                                </TableRow>
                              );
                            }

                            if (isEditing && editingForm) {
                              return (
                                <TableRow key={receipt.id} className="bg-amber-50/50">
                                  <TableCellDense>
                                    <input
                                      type="date"
                                      value={editingForm.receipt_date}
                                      onChange={(e) => setEditingForm({ ...editingForm, receipt_date: e.target.value })}
                                      className="font-body h-8 w-full rounded border border-navy-200 px-2 text-sm"
                                    />
                                  </TableCellDense>
                                  <TableCellDense>
                                    <select
                                      value={editingForm.payment_type}
                                      onChange={(e) => setEditingForm({ ...editingForm, payment_type: e.target.value })}
                                      className="font-body h-8 w-full rounded border border-navy-200 px-2 text-sm"
                                    >
                                      <option value="">-</option>
                                      <option value="Opening Balance">Opening Balance</option>
                                      <option value="Advance">Advance</option>
                                    </select>
                                  </TableCellDense>
                                  <TableCellDense>
                                    <input
                                      type="text"
                                      value={editingForm.remarks}
                                      onChange={(e) => setEditingForm({ ...editingForm, remarks: e.target.value })}
                                      className="font-body h-8 w-full rounded border border-navy-200 px-2 text-sm"
                                    />
                                  </TableCellDense>
                                  <TableCellDense className="text-right">
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={editingForm.amount}
                                      onChange={(e) => setEditingForm({ ...editingForm, amount: parseFloat(e.target.value) || 0 })}
                                      className="font-body h-8 w-28 rounded border border-navy-200 px-2 text-sm text-right"
                                    />
                                  </TableCellDense>
                                  <TableCellDense className="text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <button
                                        type="button"
                                        onClick={handleSaveEdit}
                                        disabled={updateReceiptMutation.isPending}
                                        className="font-body inline-flex h-7 w-7 items-center justify-center rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                                      >
                                        {updateReceiptMutation.isPending ? (
                                          <Loader2 size={14} className="animate-spin" />
                                        ) : (
                                          <Save size={14} />
                                        )}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={handleCancelEdit}
                                        className="font-body inline-flex h-7 w-7 items-center justify-center rounded-md border border-navy-200 text-navy-600 hover:bg-cream-100"
                                      >
                                        <X size={14} />
                                      </button>
                                    </div>
                                  </TableCellDense>
                                </TableRow>
                              );
                            }

                            return (
                              <TableRowDense key={receipt.id}>
                                <TableCellDense className="text-navy-600">
                                  {formatDisplayDate(receipt.receipt_date)}
                                </TableCellDense>
                                <TableCellDense className="text-navy-600">
                                  {receipt.payment_type || '-'}
                                </TableCellDense>
                                <TableCellDense className="text-navy-950">
                                  {receipt.remarks || 'Receipt'}
                                </TableCellDense>
                                <TableCellDense className="text-right font-display font-medium text-navy-950">
                                  {formatCurrency(receipt.amount)}
                                </TableCellDense>
                                <TableCellDense className="text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleStartEdit(receipt)}
                                      className="font-body inline-flex h-7 w-7 items-center justify-center rounded-md border border-navy-200 text-navy-600 hover:bg-cream-100"
                                    >
                                      <Pencil size={14} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleMarkDelete(receipt.id)}
                                      className="font-body inline-flex h-7 w-7 items-center justify-center rounded-md border border-rose-200 text-rose-600 hover:bg-rose-50"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </TableCellDense>
                              </TableRowDense>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'opening-balance' && (
                <OpeningBalanceTab
                  clients={clients}
                  selectedFy={selectedFy}
                  openingBalances={openingBalances}
                  openingBalancesMap={openingBalancesMap}
                  openingBalanceDrafts={openingBalanceDrafts}
                  openingBalanceEditMode={openingBalanceEditMode}
                  openingBalancesQuery={openingBalancesQuery}
                  autoPopulateMutation={autoPopulateMutation}
                  saveOpeningBalancesMutation={saveOpeningBalancesMutation}
                  setOpeningBalanceEditMode={setOpeningBalanceEditMode}
                  setOpeningBalanceDrafts={setOpeningBalanceDrafts}
                />
              )}
            </div>

            {/* Payment Form - Hidden for opening-balance tab */}
            {activeTab !== 'opening-balance' && (
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
                    <span className="font-body block text-xs font-semibold uppercase tracking-[0.15em] text-navy-500">Payment Type</span>
                    <select
                      {...paymentForm.register('payment_type')}
                      className="font-body h-11 w-full rounded-lg border border-navy-200 bg-white px-3 text-sm text-navy-900 outline-none transition focus:border-navy-500 focus:ring-2 focus:ring-navy-100"
                    >
                      <option value="">-- Select (Optional) --</option>
                      <option value="Opening Balance">Opening Balance</option>
                      <option value="Advance">Advance</option>
                    </select>
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

                  <Button
                    type="submit"
                    disabled={recordPaymentMutation.isPending || clients.length === 0}
                    isLoading={recordPaymentMutation.isPending}
                    leftIcon={<Plus size={14} />}
                    className="w-full"
                  >
                    Record Payment
                  </Button>
                </form>
              </div>
            </div>
            )}
          </div>
        </section>

        <LedgerModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          organisation={(organisation as Record<string, unknown>) ?? null}
          client={selectedClient}
          summary={selectedSummary}
          rangeLabel={rangeLabel}
          onManageDetails={handleEditLedger}
          openingBalance={selectedClientId ? openingBalancesMap[selectedClientId] ?? null : null}
        />
      </div>
    </div>
  );
}
