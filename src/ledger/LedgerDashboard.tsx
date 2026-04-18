import { useEffect, useMemo, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { endOfMonth, format, subMonths, subYears, startOfMonth } from 'date-fns';
import { ChevronDown, FileText, Filter, Landmark, Loader2, Pencil, Plus, Save, Search, Trash2, Wallet, X, Calculator } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { toast } from '@/lib/logger';
import { useAuth } from '@/contexts/AuthContext';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
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
    if (organisation?.current_financial_year) {
      setSelectedFy(String(organisation.current_financial_year));
    }
  }, [organisation]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (filtersOpen && !target.closest('.filter-dropdown-container')) {
        setFiltersOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [filtersOpen]);

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
    () => buildLedgerSummaries(
      clients,
      invoicesQuery.data ?? [],
      receiptsQuery.data ?? [],
      openingBalances,
    ),
    [clients, invoicesQuery.data, receiptsQuery.data, openingBalances],
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

  const isLoading = 
    (clientsQuery.isPending && !clientsQuery.data) ||
    (invoicesQuery.isPending && !invoicesQuery.data) ||
    (receiptsQuery.isPending && !receiptsQuery.data);

  if (!orgId) {
    return (
      <div className="mx-auto max-w-4xl px-8 py-16">
        <div className="rounded-lg border border-zinc-200 bg-white p-8 text-sm text-zinc-500 shadow-sm">
          Select an organisation to open the ledger dashboard.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50/50">
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="text-xs font-medium uppercase tracking-widest text-zinc-400">
              Ledger Overview
            </span>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
              Outstanding & Receipts
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-500">
              Org-scoped client ledger with outstanding balances, overdue aging, payment capture, and printable statements.
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <section className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-3 inline-flex rounded-lg bg-zinc-100 p-2.5 text-zinc-600">
              <Wallet size={16} strokeWidth={1.5} />
            </div>
            <div className="text-xs font-medium uppercase tracking-wider text-zinc-400">Outstanding</div>
            <div className="mt-1.5 text-2xl font-semibold tracking-tight text-zinc-950">
              {formatCurrency(dashboardTotals.totalOutstanding)}
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-3 inline-flex rounded-lg bg-zinc-100 p-2.5 text-zinc-600">
              <Landmark size={16} strokeWidth={1.5} />
            </div>
            <div className="text-xs font-medium uppercase tracking-wider text-zinc-400">Invoice Debits</div>
            <div className="mt-1.5 text-2xl font-semibold tracking-tight text-zinc-950">
              {formatCurrency(dashboardTotals.totalDebits)}
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-3 inline-flex rounded-lg bg-zinc-100 p-2.5 text-zinc-600">
              <Filter size={16} strokeWidth={1.5} />
            </div>
            <div className="text-xs font-medium uppercase tracking-wider text-zinc-400">Receipt Credits</div>
            <div className="mt-1.5 text-2xl font-semibold tracking-tight text-zinc-950">
              {formatCurrency(dashboardTotals.totalCredits)}
            </div>
          </div>
        </section>

        {/* Main Content */}
        <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
          {/* Header with Filter Dropdown and Tabs */}
          <div className="relative border-b border-zinc-200 p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                {/* Tabs */}
                <div className="flex rounded-md border border-zinc-200 bg-zinc-50/50 p-0.5">
                  <button
                    type="button"
                    onClick={() => setActiveTab('ledger')}
                    className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition ${
                      activeTab === 'ledger'
                        ? 'bg-white text-zinc-950 shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-700'
                    }`}
                  >
                    <FileText size={13} />
                    Client Ledger
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('details')}
                    className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition ${
                      activeTab === 'details'
                        ? 'bg-white text-zinc-950 shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-700'
                    }`}
                  >
                    <Pencil size={13} />
                    Details
                    {hasPendingDetailsChanges && (
                      <span className="ml-1 h-1.5 w-1.5 rounded-full bg-amber-500" />
                    )}
                  </button>
                </div>

                {activeTab === 'ledger' && (
                  <button
                    type="button"
                    onClick={() => setFiltersOpen(!filtersOpen)}
                    className="filter-dropdown-container inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
                  >
                    <span>{rangeLabel}</span>
                    <ChevronDown size={11} className={`transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
                  </button>
                )}
                {activeTab === 'details' && selectedClient && (
                  <span className="text-sm font-medium text-zinc-950">
                    {selectedClient.name}
                  </span>
                )}
                {activeTab === 'opening-balance' && (
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedFy}
                      onChange={(e) => setSelectedFy(e.target.value)}
                      className="h-7 rounded border border-zinc-200 bg-white px-2 text-xs text-zinc-900 outline-none focus:border-zinc-400"
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

              <div className="flex items-center gap-2">
                {activeTab === 'details' && hasPendingDetailsChanges && (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={handleSaveAllChanges}
                    isLoading={deleteReceiptMutation.isPending}
                    leftIcon={<Save size={12} />}
                  >
                    Save Changes
                  </Button>
                )}

                {activeTab === 'opening-balance' && !openingBalanceEditMode && selectedFy && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleStartOpeningBalanceEdit}
                    leftIcon={<Pencil size={12} />}
                  >
                    Edit
                  </Button>
                )}

                {/* Opening Balance Button */}
                {activeTab !== 'opening-balance' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setActiveTab('opening-balance')}
                    leftIcon={<Calculator size={12} />}
                  >
                    Opening Balance
                  </Button>
                )}

                {activeTab === 'ledger' && filtersOpen && (
                  <div className="filter-dropdown-container absolute right-6 top-full z-50 mt-2 w-72 rounded-lg border border-zinc-200 bg-white p-3 shadow-lg">
                    <div className="space-y-3">
                      <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                        Presets
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(['monthly', 'financial-year', 'last-3-months', 'last-6-months', 'last-2-years'] as RangePreset[]).map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => handlePreset(preset)}
                            className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                              selectedPreset === preset
                                ? 'bg-zinc-900 text-white'
                                : 'border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
                            }`}
                          >
                            {getPresetLabel(preset)}
                          </button>
                        ))}
                      </div>

                      <div className="border-t border-zinc-100 pt-3">
                        <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                          Custom Range
                        </div>
                        <div className="grid gap-2">
                          <div className="space-y-1">
                            <label className="block text-[11px] font-medium text-zinc-500">From</label>
                            <input
                              type="date"
                              value={startDate}
                              onChange={(event) => {
                                setSelectedPreset(null);
                                setStartDate(event.target.value);
                              }}
                              className="h-8 w-full rounded border border-zinc-200 bg-white px-2.5 text-xs text-zinc-900 outline-none transition focus:border-zinc-400"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[11px] font-medium text-zinc-500">To</label>
                            <input
                              type="date"
                              value={endDate}
                              onChange={(event) => {
                                setSelectedPreset(null);
                                setEndDate(event.target.value);
                              }}
                              className="h-8 w-full rounded border border-zinc-200 bg-white px-2.5 text-xs text-zinc-900 outline-none transition focus:border-zinc-400"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-zinc-100 pt-3">
                        <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-600">
                          <input
                            type="checkbox"
                            checked={saveAsDefault}
                            onChange={(event) => setSaveAsDefault(event.target.checked)}
                            className="h-3.5 w-3.5 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500"
                          />
                          Save as default
                        </label>
                      </div>

                      <Button
                        size="sm"
                        onClick={handleApplyFilters}
                        disabled={!hasPendingFilterChanges}
                        leftIcon={<Search size={12} />}
                        className="w-full"
                      >
                        Apply Filters
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="grid gap-5 p-4 xl:grid-cols-[1fr_320px]">
            {/* Main Table Area */}
            <div className="overflow-hidden rounded-lg border border-zinc-200">
              {activeTab === 'ledger' && (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-zinc-200 bg-zinc-50/80">
                        <TableHead className="h-10 px-4 text-left align-middle text-[11px] font-medium text-zinc-500">Client</TableHead>
                        <TableHead className="h-10 px-4 text-right align-middle text-[11px] font-medium text-zinc-500">Outstanding</TableHead>
                        <TableHead className="h-10 px-4 text-left align-middle text-[11px] font-medium text-zinc-500">Due Date</TableHead>
                        <TableHead className="h-10 px-4 text-left align-middle text-[11px] font-medium text-zinc-500">Status</TableHead>
                        <TableHead className="h-10 px-4 text-right align-middle text-[11px] font-medium text-zinc-500">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="[&_tr:last-child]:border-0">
                      {isLoading && (
                        <tr>
                          <td colSpan={5} className="px-4 py-12 text-center">
                            <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
                              <Loader2 size={12} className="animate-spin" />
                              Loading ledger data...
                            </span>
                          </td>
                        </tr>
                      )}

                      {!isLoading && summaries.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-12 text-center">
                            <div className="mx-auto max-w-sm space-y-2">
                              <div className="text-sm font-medium text-zinc-950">No ledger data found</div>
                              <div className="text-xs text-zinc-500">
                                Make sure your clients are linked to this organisation, then record invoices and receipts.
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}

                      {summaries.map((summary) => (
                        <tr key={summary.clientId} className="border-b border-zinc-100 hover:bg-zinc-50/50">
                          <td className="px-4 py-3.5 align-middle">
                            <span className="text-sm font-medium text-zinc-950">{summary.clientName}</span>
                          </td>
                          <td className="px-4 py-3.5 text-right align-middle">
                            <span className="text-sm font-medium text-zinc-950">{formatCurrency(summary.outstanding)}</span>
                          </td>
                          <td className="px-4 py-3.5 align-middle">
                            <span className="text-xs text-zinc-500">{formatDisplayDate(summary.oldestDueDate)}</span>
                          </td>
                          <td className="px-4 py-3.5 align-middle">
                            {(() => {
                              const status = statusBadge(summary);
                              const dotColors = {
                                emerald: 'bg-emerald-500',
                                rose: 'bg-rose-500',
                                amber: 'bg-amber-500',
                              };
                              return (
                                <span className={`inline-flex items-center gap-1.5 text-xs ${status.color}`}>
                                  <span className={`h-1.5 w-1.5 rounded-full ${dotColors[status.icon as keyof typeof dotColors]}`} />
                                  {status.label}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="px-4 py-3.5 text-right align-middle">
                            <button
                              type="button"
                              onClick={() => handleView(summary.clientId)}
                              className="text-[11px] text-zinc-500 underline underline-offset-2 hover:text-zinc-700"
                            >
                              View Ledger
                            </button>
                            <span className="mx-1.5 text-zinc-300">·</span>
                            <button
                              type="button"
                              onClick={() => handleEditLedger(summary.clientId)}
                              className="text-[11px] text-zinc-500 underline underline-offset-2 hover:text-zinc-700"
                            >
                              Edit Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {activeTab === 'details' && (
                <div className="p-4">
                  {!selectedClient && (
                    <div className="py-12 text-center">
                      <div className="mx-auto max-w-sm space-y-2">
                        <div className="text-sm font-medium text-zinc-950">Select a client</div>
                        <div className="text-xs text-zinc-500">
                          Click on a client from the Client Ledger tab, or select "Edit Details" from the actions menu.
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedClient && selectedClientReceipts.length === 0 && !isLoading && (
                    <div className="py-12 text-center">
                      <div className="mx-auto max-w-sm space-y-2">
                        <div className="text-sm font-medium text-zinc-950">No receipts found</div>
                        <div className="text-xs text-zinc-500">
                          This client has no receipt records in the selected date range.
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedClient && selectedClientReceipts.length > 0 && (
                    <div className="space-y-4">
                      <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                        Receipts for {selectedClient.name}
                      </div>
                      <div className="overflow-x-auto rounded-lg border border-zinc-200">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-b border-zinc-200 bg-zinc-50/80">
                              <TableHead className="h-10 px-4 text-left align-middle text-[11px] font-medium text-zinc-500">Date</TableHead>
                              <TableHead className="h-10 px-4 text-left align-middle text-[11px] font-medium text-zinc-500">Payment Type</TableHead>
                              <TableHead className="h-10 px-4 text-left align-middle text-[11px] font-medium text-zinc-500">Remarks</TableHead>
                              <TableHead className="h-10 px-4 text-right align-middle text-[11px] font-medium text-zinc-500">Amount</TableHead>
                              <TableHead className="h-10 px-4 text-right align-middle text-[11px] font-medium text-zinc-500">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody className="[&_tr:last-child]:border-0">
                            {selectedClientReceipts.map((receipt) => {
                              const isEditing = editingReceiptId === receipt.id;
                              const isPendingDelete = pendingDeletes.has(receipt.id);

                              if (isPendingDelete) {
                                return (
                                  <tr key={receipt.id} className="bg-rose-50/50 border-b border-rose-100">
                                    <td colSpan={4} className="px-4 py-3 text-xs text-rose-600">
                                      <span className="line-through opacity-60">
                                        {formatDisplayDate(receipt.receipt_date)} — {receipt.remarks || 'Receipt'}
                                      </span>
                                      <span className="ml-2 text-[10px] font-semibold">(Marked for deletion)</span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                      <button
                                        type="button"
                                        onClick={() => handleUndoDelete(receipt.id)}
                                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-100"
                                      >
                                        <X size={10} />
                                        Undo
                                      </button>
                                    </td>
                                  </tr>
                                );
                              }

                              if (isEditing && editingForm) {
                                return (
                                  <tr key={receipt.id} className="bg-amber-50/50 border-b border-amber-100">
                                    <td className="px-4 py-2.5">
                                      <input
                                        type="date"
                                        value={editingForm.receipt_date}
                                        onChange={(e) => setEditingForm({ ...editingForm, receipt_date: e.target.value })}
                                        className="h-8 w-full rounded border border-zinc-200 px-2 text-xs"
                                      />
                                    </td>
                                    <td className="px-4 py-2.5">
                                      <select
                                        value={editingForm.payment_type}
                                        onChange={(e) => setEditingForm({ ...editingForm, payment_type: e.target.value })}
                                        className="h-8 w-full rounded border border-zinc-200 px-2 text-xs"
                                      >
                                        <option value="">-</option>
                                        <option value="Opening Balance">Opening Balance</option>
                                        <option value="Advance">Advance</option>
                                      </select>
                                    </td>
                                    <td className="px-4 py-2.5">
                                      <input
                                        type="text"
                                        value={editingForm.remarks}
                                        onChange={(e) => setEditingForm({ ...editingForm, remarks: e.target.value })}
                                        className="h-8 w-full rounded border border-zinc-200 px-2 text-xs"
                                      />
                                    </td>
                                    <td className="px-4 py-2.5">
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={editingForm.amount}
                                        onChange={(e) => setEditingForm({ ...editingForm, amount: parseFloat(e.target.value) || 0 })}
                                        className="h-8 w-24 rounded border border-zinc-200 px-2 text-right text-xs"
                                      />
                                    </td>
                                    <td className="px-4 py-2.5 text-right">
                                      <div className="inline-flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={handleSaveEdit}
                                          disabled={updateReceiptMutation.isPending}
                                          className="inline-flex h-7 w-7 items-center justify-center rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                                        >
                                          {updateReceiptMutation.isPending ? (
                                            <Loader2 size={10} className="animate-spin" />
                                          ) : (
                                            <Save size={10} />
                                          )}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={handleCancelEdit}
                                          className="inline-flex h-7 w-7 items-center justify-center rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-100"
                                        >
                                          <X size={10} />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              }

                              return (
                                <tr key={receipt.id} className="border-b border-zinc-100 hover:bg-zinc-50/50">
                                  <td className="px-4 py-3.5 text-xs text-zinc-600">{formatDisplayDate(receipt.receipt_date)}</td>
                                  <td className="px-4 py-3.5 text-xs text-zinc-600">{receipt.payment_type || '-'}</td>
                                  <td className="px-4 py-3.5 text-sm text-zinc-950">{receipt.remarks || 'Receipt'}</td>
                                  <td className="px-4 py-3.5 text-right text-sm font-medium text-zinc-950">{formatCurrency(receipt.amount)}</td>
                                  <td className="px-4 py-3.5 text-right">
                                    <div className="inline-flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => handleStartEdit(receipt)}
                                        className="inline-flex h-7 w-7 items-center justify-center rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-100"
                                      >
                                        <Pencil size={10} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleMarkDelete(receipt.id)}
                                        className="inline-flex h-7 w-7 items-center justify-center rounded border border-rose-200 text-rose-600 hover:bg-rose-50"
                                      >
                                        <Trash2 size={10} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
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
            <div ref={paymentCardRef} className="h-fit rounded-lg border border-zinc-200 bg-zinc-50/50 p-0.5">
              <div className="rounded-md border border-zinc-200 bg-white p-4 shadow-sm">
                <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">Record Payment</span>
                <h2 className="mt-1.5 text-lg font-semibold tracking-tight text-zinc-950">Add receipt</h2>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                  Receipts refresh the ledger immediately after save.
                </p>

                <form
                  onSubmit={paymentForm.handleSubmit((values) => recordPaymentMutation.mutate(values))}
                  className="mt-4 space-y-3"
                >
                  <div className="space-y-1">
                    <span className="block text-[11px] font-medium uppercase tracking-wider text-zinc-400">Client</span>
                    <select
                      {...paymentForm.register('client_id')}
                      className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2.5 text-xs text-zinc-900 outline-none transition focus:border-zinc-400"
                    >
                      <option value="">Select client</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name}
                        </option>
                      ))}
                    </select>
                    {paymentForm.formState.errors.client_id && (
                      <p className="text-[11px] text-rose-600">{paymentForm.formState.errors.client_id.message}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <span className="block text-[11px] font-medium uppercase tracking-wider text-zinc-400">Amount</span>
                      <input
                        type="number"
                        step="0.01"
                        {...paymentForm.register('amount')}
                        className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2.5 text-xs text-zinc-900 outline-none transition focus:border-zinc-400"
                        placeholder="0.00"
                      />
                      {paymentForm.formState.errors.amount && (
                        <p className="text-[11px] text-rose-600">{paymentForm.formState.errors.amount.message}</p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <span className="block text-[11px] font-medium uppercase tracking-wider text-zinc-400">Date</span>
                      <input
                        type="date"
                        {...paymentForm.register('receipt_date')}
                        className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2.5 text-xs text-zinc-900 outline-none transition focus:border-zinc-400"
                      />
                      {paymentForm.formState.errors.receipt_date && (
                        <p className="text-[11px] text-rose-600">{paymentForm.formState.errors.receipt_date.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="block text-[11px] font-medium uppercase tracking-wider text-zinc-400">Payment Type</span>
                    <select
                      {...paymentForm.register('payment_type')}
                      className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2.5 text-xs text-zinc-900 outline-none transition focus:border-zinc-400"
                    >
                      <option value="">-- Select (Optional) --</option>
                      <option value="Opening Balance">Opening Balance</option>
                      <option value="Advance">Advance</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <span className="block text-[11px] font-medium uppercase tracking-wider text-zinc-400">Remarks</span>
                    <textarea
                      {...paymentForm.register('remarks')}
                      rows={2}
                      className="w-full rounded-md border border-zinc-200 bg-white px-2.5 py-2 text-xs text-zinc-900 outline-none transition focus:border-zinc-400"
                      placeholder="Advance, part payment, retention release..."
                    />
                    {paymentForm.formState.errors.remarks && (
                      <p className="text-[11px] text-rose-600">{paymentForm.formState.errors.remarks.message}</p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={recordPaymentMutation.isPending || clients.length === 0}
                    isLoading={recordPaymentMutation.isPending}
                    leftIcon={<Plus size={12} />}
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
