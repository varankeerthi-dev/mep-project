import { useEffect, useMemo, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { endOfMonth, format, subMonths, subYears, startOfMonth } from 'date-fns';
import { ChevronDown, FileText, Filter, Landmark, Loader2, Pencil, Plus, Save, Search, Trash2, Wallet, X, Calculator, Eye } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { toast } from '@/lib/logger';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '../supabase';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '../../lib/utils';
import LedgerModal from './LedgerModal';
import OpeningBalanceTab from './OpeningBalanceTab';
import {
  createReceipt,
  listLedgerClients,
  listLedgerInvoices,
  listLedgerReceipts,
  listLedgerCreditNotes,
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
import { Party360 } from '../components/Party360';

const DEFAULT_STORAGE_KEY = 'ledger.dashboard.default-range.v1';

type RangePreset = 'monthly' | 'financial-year' | 'last-3-months' | 'last-6-months' | 'last-2-years';
type TabType = 'ledger' | 'payments' | 'opening-balance';
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

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('ledger');
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);
  const [editingReceiptId, setEditingReceiptId] = useState<string | null>(null);
  const [editingForm, setEditingForm] = useState<EditingReceipt | null>(null);
  const [selectedFy, setSelectedFy] = useState<string>(generateFyOptions('FY24-25')[2]);
  const [showLedger, setShowLedger] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentsSearch, setPaymentsSearch] = useState('');
  const [paymentsStartDate, setPaymentsStartDate] = useState('');
  const [paymentsEndDate, setPaymentsEndDate] = useState('');
  const [openingBalanceEditMode, setOpeningBalanceEditMode] = useState(false);
  const [openingBalanceDrafts, setOpeningBalanceDrafts] = useState<Record<string, BulkOpeningBalanceInput>>({});
  const [party360Open, setParty360Open] = useState(false);
  const [party360Data, setParty360Data] = useState<{ name: string; vendorId: string | null; clientId: string } | null>(null);

  const clientsQuery = useQuery({
    queryKey: ['ledger', 'clients', orgId],
    queryFn: () => listLedgerClients(orgId),
    enabled: Boolean(orgId) && showLedger,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch linked vendor info for clients
  const clientVendorLinksQuery = useQuery({
    queryKey: ['ledger', 'client-vendor-links', orgId],
    queryFn: async () => {
      const { data } = await supabase
        .from('clients')
        .select('id, linked_vendor_id')
        .eq('organisation_id', orgId)
        .not('linked_vendor_id', 'is', null);
      const map: Record<string, string> = {};
      data?.forEach(c => { map[String(c.id)] = String(c.linked_vendor_id); });
      return map;
    },
    enabled: Boolean(orgId) && showLedger,
    staleTime: 5 * 60 * 1000,
  });

  const clientVendorLinks = clientVendorLinksQuery.data ?? {};



  const openingBalancesQuery = useQuery({
    queryKey: ['ledger', 'opening-balances', orgId, selectedFy],
    queryFn: () => getOpeningBalances(orgId, selectedFy),
    enabled: Boolean(orgId) && Boolean(selectedFy) && showLedger,
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
      void qc.invalidateQueries({ queryKey: ['ledger', 'clients', orgId] });
      void qc.invalidateQueries({ queryKey: ['ledger', 'invoices', orgId] });
      void qc.invalidateQueries({ queryKey: ['ledger', 'receipts', orgId] });
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
      void qc.invalidateQueries({ queryKey: ['ledger', 'clients', orgId] });
      void qc.invalidateQueries({ queryKey: ['ledger', 'invoices', orgId] });
      void qc.invalidateQueries({ queryKey: ['ledger', 'receipts', orgId] });
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
    queryKey: ['ledger', 'invoices', orgId, 'all-time'],
    queryFn: () => listLedgerInvoices(orgId, { startDate: '2000-01-01', endDate: '2099-12-31' }),
    enabled: Boolean(orgId) && showLedger,
  });

  const receiptsQuery = useQuery({
    queryKey: ['ledger', 'receipts', orgId, 'all-time'],
    queryFn: () => listLedgerReceipts(orgId, { startDate: '2000-01-01', endDate: '2099-12-31' }),
    enabled: Boolean(orgId) && showLedger,
  });

  const creditNotesQuery = useQuery({
    queryKey: ['ledger', 'credit-notes', orgId, 'all-time'],
    queryFn: () => listLedgerCreditNotes(orgId, { startDate: '2000-01-01', endDate: '2099-12-31' }),
    enabled: Boolean(orgId) && showLedger,
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

      void qc.invalidateQueries({ queryKey: ['ledger'] });
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
      void qc.invalidateQueries({ queryKey: ['ledger'] });
    },
    onError: (error: any) => {
      toast.error(error?.message ?? 'Unable to update receipt.');
    },
  });

  const deleteReceiptMutation = useMutation({
    mutationFn: deleteReceipt,
    onSuccess: () => {
      toast.success('Receipt deleted successfully.');
      void qc.invalidateQueries({ queryKey: ['ledger'] });
    },
    onError: (error: any) => {
      toast.error(error?.message ?? 'Unable to delete receipt.');
    },
  });



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
      creditNotesQuery.data ?? [],
      openingBalances,
    ),
    [clients, invoicesQuery.data, receiptsQuery.data, creditNotesQuery.data, openingBalances],
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
    const totalCredits = (receiptsQuery.data ?? []).reduce((sum, row) => sum + Number(row.amount || 0), 0)
      + (creditNotesQuery.data ?? []).reduce((sum, row) => sum + Number(row.total_amount || 0), 0);

    return {
      totalOutstanding,
      totalDebits,
      totalCredits,
    };
  }, [invoicesQuery.data, receiptsQuery.data, creditNotesQuery.data, summaries]);

  const filteredSummaries = useMemo(() => {
    if (!searchTerm.trim()) return summaries;
    const lower = searchTerm.toLowerCase();
    return summaries.filter((s) => s.clientName.toLowerCase().includes(lower));
  }, [summaries, searchTerm]);

  const filteredPayments = useMemo(() => {
    if (!receiptsQuery.data) return [];
    let list = [...receiptsQuery.data]; // Clone to prevent mutating frozen react-query cache

    if (paymentsStartDate) {
      list = list.filter(r => r.receipt_date && r.receipt_date >= paymentsStartDate);
    }
    if (paymentsEndDate) {
      list = list.filter(r => r.receipt_date && r.receipt_date <= paymentsEndDate);
    }
    if (paymentsSearch.trim()) {
      const lower = paymentsSearch.toLowerCase();
      list = list.filter(r => {
        const clientName = clients.find(c => c.id === r.client_id)?.name?.toLowerCase() || '';
        return clientName.includes(lower) || 
               (r.remarks && r.remarks.toLowerCase().includes(lower)) ||
               (r.payment_type && r.payment_type.toLowerCase().includes(lower));
      });
    }
    return list.sort((a, b) => {
      const timeA = new Date(a.receipt_date || 0).getTime() || 0;
      const timeB = new Date(b.receipt_date || 0).getTime() || 0;
      return timeB - timeA;
    });
  }, [receiptsQuery.data, paymentsStartDate, paymentsEndDate, paymentsSearch, clients]);

  const handleView = (clientId: string) => {
    setSelectedClientId(clientId);
    setActiveTab('ledger');
    setModalOpen(true);
  };

  const handleEditLedger = (clientId: string) => {
    setSelectedClientId(clientId);
    setDetailsDrawerOpen(true);
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
  };

  const handleCancelEdit = () => {
    setEditingReceiptId(null);
    setEditingForm(null);
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
              Finance
            </span>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-700">
              Ledger
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              View client outstanding, invoices, and payment history
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <section className="mb-6 grid gap-3 md:grid-cols-3">
          <div className="bg-white p-5">
            <div className="text-xs font-medium text-zinc-500">Outstanding</div>
            <div className="mt-1 text-2xl font-semibold text-zinc-700">
              {formatCurrency(dashboardTotals.totalOutstanding)}
            </div>
          </div>

          <div className="bg-white p-5">
            <div className="text-xs font-medium text-zinc-500">Invoice Debits</div>
            <div className="mt-1 text-2xl font-semibold text-zinc-700">
              {formatCurrency(dashboardTotals.totalDebits)}
            </div>
          </div>

          <div className="bg-white p-5">
            <div className="text-xs font-medium text-zinc-500">Receipt Credits</div>
            <div className="mt-1 text-2xl font-semibold text-zinc-700">
              {formatCurrency(dashboardTotals.totalCredits)}
            </div>
          </div>
        </section>

        {/* Main Content */}
        <section className="bg-white shadow-sm">
          {/* Header with Filter Dropdown and Tabs */}
          <div className="border-b border-zinc-200 px-5 py-3">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                {/* Tabs - Segmented Control */}
                <div className="inline-flex rounded-md bg-zinc-100 p-0.5">
                  <button
                    type="button"
                    onClick={() => setActiveTab('ledger')}
                    className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-[13px] font-medium transition ${
                      activeTab === 'ledger'
                        ? 'bg-white text-zinc-900 shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-700'
                    }`}
                  >
                    <FileText size={14} />
                    Client Ledger
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('payments')}
                    className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-[13px] font-medium transition ${
                      activeTab === 'payments'
                        ? 'bg-white text-zinc-900 shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-700'
                    }`}
                  >
                    <Wallet size={14} />
                    Payments
                  </button>
                </div>


                {activeTab === 'opening-balance' && (
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedFy}
                      onChange={(e) => setSelectedFy(e.target.value)}
                      className="h-9 rounded border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400"
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

                {/* Show Ledger / Opening Balance Buttons */}
                {activeTab !== 'opening-balance' && (
                  <div className="flex gap-2">
                    {!showLedger && (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => setShowLedger(true)}
                        leftIcon={<Filter size={14} />}
                      >
                        Show Ledger
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setActiveTab('opening-balance')}
                      leftIcon={<Calculator size={14} />}
                    >
                      Opening Balance
                    </Button>
                  </div>
                )}

              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="grid gap-5 p-5 xl:grid-cols-[1fr_320px]">
            {/* Main Table Area */}
            <div className="overflow-hidden bg-white">
              {activeTab === 'payments' && (
                <div className="flex flex-col font-sans" style={{ fontFamily: 'Roboto, sans-serif' }}>
                  <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-4 py-2.5">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
                      <input
                        type="text"
                        placeholder="Search payments..."
                        value={paymentsSearch}
                        onChange={(e) => setPaymentsSearch(e.target.value)}
                        className="h-9 w-64 rounded border border-zinc-200 bg-white pl-8 pr-3 text-sm outline-none transition-all focus:border-zinc-400"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="date"
                        value={paymentsStartDate}
                        onChange={(e) => setPaymentsStartDate(e.target.value)}
                        className="h-9 rounded border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                      />
                      <span className="text-sm font-medium text-zinc-400">to</span>
                      <input
                        type="date"
                        value={paymentsEndDate}
                        onChange={(e) => setPaymentsEndDate(e.target.value)}
                        className="h-9 rounded border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                      />
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b border-zinc-200 bg-zinc-50 hover:bg-zinc-50">
                          <TableHead className="h-10 px-4 text-left align-middle text-[12px] font-semibold text-zinc-600">Date</TableHead>
                          <TableHead className="h-10 px-4 text-left align-middle text-[12px] font-semibold text-zinc-600">Client Name</TableHead>
                          <TableHead className="h-10 px-4 text-left align-middle text-[12px] font-semibold text-zinc-600">Payment Type</TableHead>
                          <TableHead className="h-10 px-4 text-left align-middle text-[12px] font-semibold text-zinc-600">Remarks</TableHead>
                          <TableHead className="h-10 px-4 text-right align-middle text-[12px] font-semibold text-zinc-600">Amount</TableHead>
                          <TableHead className="h-10 px-4 text-right align-middle text-[12px] font-semibold text-zinc-600">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="[&_tr:last-child]:border-0">
                        {!showLedger ? (
                          <TableRow>
                            <TableCell colSpan={6} className="py-12 text-center">
                              <div className="mx-auto max-w-sm space-y-2">
                                <div className="text-sm font-medium text-zinc-700">Payments hidden</div>
                                <div className="text-xs text-zinc-500">
                                  Click the "Show Ledger" button above to load and display all payment data.
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : filteredPayments.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="py-8 text-center text-xs text-zinc-500">No payments found.</TableCell>
                          </TableRow>
                        ) : (
                          filteredPayments.map(receipt => {
                            const isEditing = editingReceiptId === receipt.id;

                            if (isEditing && editingForm) {
                              return (
                                <TableRow key={receipt.id} className="bg-amber-50/50 border-b border-amber-100">
                                  <TableCell className="py-2.5 px-4">
                                    <input
                                      type="date"
                                      value={editingForm.receipt_date}
                                      onChange={(e) => setEditingForm({ ...editingForm, receipt_date: e.target.value })}
                                      className="h-9 w-full rounded border border-zinc-200 bg-white px-2.5 text-sm"
                                    />
                                  </TableCell>
                                  <TableCell className="py-2.5 px-4">
                                    <div className="text-sm font-medium text-zinc-800">
                                      {clients.find(c => c.id === receipt.client_id)?.name || 'Unknown'}
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-2.5 px-4">
                                    <select
                                      value={editingForm.payment_type}
                                      onChange={(e) => setEditingForm({ ...editingForm, payment_type: e.target.value })}
                                      className="h-9 w-full rounded border border-zinc-200 bg-white px-2.5 text-sm"
                                    >
                                      <option value="">-</option>
                                      <option value="Opening Balance">Opening Balance</option>
                                      <option value="Advance">Advance</option>
                                    </select>
                                  </TableCell>
                                  <TableCell className="py-2.5 px-4">
                                    <input
                                      type="text"
                                      value={editingForm.remarks}
                                      onChange={(e) => setEditingForm({ ...editingForm, remarks: e.target.value })}
                                      className="h-9 w-full rounded border border-zinc-200 bg-white px-2.5 text-sm"
                                    />
                                  </TableCell>
                                  <TableCell className="py-2.5 px-4">
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={editingForm.amount}
                                      onChange={(e) => setEditingForm({ ...editingForm, amount: parseFloat(e.target.value) || 0 })}
                                      className="h-9 w-full rounded border border-zinc-200 bg-white px-2.5 text-right text-sm tabular-nums"
                                    />
                                  </TableCell>
                                  <TableCell className="py-2.5 px-4 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                      <button
                                        type="button"
                                        onClick={handleSaveEdit}
                                        className="inline-flex items-center gap-1 rounded bg-zinc-900 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-zinc-800 transition"
                                      >
                                        Save
                                      </button>
                                      <button
                                        type="button"
                                        onClick={handleCancelEdit}
                                        className="inline-flex items-center gap-1 rounded px-3 py-1.5 text-[13px] font-medium text-zinc-600 hover:bg-zinc-100 transition"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            }

                            return (
                              <TableRow key={receipt.id} className="group border-b border-zinc-100 hover:bg-zinc-50/80">
                                <TableCell className="py-3 px-4 text-sm tabular-nums text-zinc-600">{formatDisplayDate(receipt.receipt_date)}</TableCell>
                                <TableCell className="py-3 px-4 text-sm font-medium text-zinc-800">
                                  {clients.find(c => c.id === receipt.client_id)?.name || 'Unknown'}
                                </TableCell>
                                <TableCell className="py-3 px-4 text-sm text-zinc-600">{receipt.payment_type || '-'}</TableCell>
                                <TableCell className="py-3 px-4 text-sm text-zinc-500">{receipt.remarks || '-'}</TableCell>
                                <TableCell className="py-3 px-4 text-right text-sm font-medium tabular-nums text-emerald-600">
                                  {formatCurrency(receipt.amount)}
                                </TableCell>
                                <TableCell className="py-3 px-4 text-right">
                                  <div className="flex items-center justify-end gap-3 opacity-0 transition-opacity group-hover:opacity-100">
                                    <button
                                      type="button"
                                      onClick={() => handleStartEdit(receipt)}
                                      className="text-zinc-400 hover:text-zinc-900 transition-colors"
                                      title="Edit Payment"
                                    >
                                      <Pencil size={14} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (window.confirm('Are you sure you want to delete this payment? This action cannot be undone.')) {
                                          deleteReceiptMutation.mutate(receipt.id);
                                        }
                                      }}
                                      className="text-rose-400 hover:text-rose-600 transition-colors"
                                      title="Delete Payment"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {activeTab === 'ledger' && (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-zinc-200 bg-zinc-50">
                        <TableHead className="h-12 w-[350px] px-5 text-left align-middle">
                          <div className="flex items-center gap-3">
                            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Client Name</span>
                            {showLedger && (
                              <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
                                <input
                                  type="text"
                                  placeholder="Filter..."
                                  value={searchTerm}
                                  onChange={(e) => setSearchTerm(e.target.value)}
                                  className="h-9 w-36 rounded border border-zinc-200 bg-white pl-9 pr-3 text-sm text-zinc-700 outline-none transition-all placeholder:text-zinc-400 focus:w-48 focus:border-zinc-400"
                                />
                              </div>
                            )}
                          </div>
                        </TableHead>
                        <TableHead className="h-12 w-[180px] px-5 text-right align-middle text-[11px] font-medium uppercase tracking-wider text-zinc-500">Outstanding</TableHead>
                        <TableHead className="h-12 w-[160px] px-5 text-left align-middle text-[11px] font-medium uppercase tracking-wider text-zinc-500">Due Date</TableHead>
                        <TableHead className="h-12 w-[160px] px-5 text-left align-middle text-[11px] font-medium uppercase tracking-wider text-zinc-500">Status</TableHead>
                        <TableHead className="h-12 w-auto px-5 text-right align-middle text-[11px] font-medium uppercase tracking-wider text-zinc-500">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="[&_tr:last-child]:border-0">
                      {isLoading && showLedger && (
                        Array.from({ length: 5 }).map((_, i) => (
                          <tr key={i} className="border-b border-zinc-100 bg-white">
                            <td className="px-5 py-5"><Skeleton className="h-4 w-32 bg-zinc-200" /></td>
                            <td className="px-5 py-5"><Skeleton className="h-4 w-24 ml-auto bg-zinc-200" /></td>
                            <td className="px-5 py-5"><Skeleton className="h-4 w-20 bg-zinc-200" /></td>
                            <td className="px-5 py-5"><Skeleton className="h-4 w-16 bg-zinc-200" /></td>
                            <td className="px-5 py-5"><Skeleton className="h-4 w-24 ml-auto bg-zinc-200" /></td>
                          </tr>
                        ))
                      )}

                      {!showLedger && (
                        <tr>
                          <td colSpan={5} className="px-5 py-12 text-center">
                            <div className="mx-auto max-w-sm space-y-2">
                              <div className="text-sm font-medium text-zinc-700">Ledger hidden</div>
                              <div className="text-xs text-zinc-500">
                                Click the "Show Ledger" button above to load and display the client ledger data.
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}

                      {!isLoading && showLedger && summaries.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-12 text-center">
                            <div className="mx-auto max-w-sm space-y-2">
                              <div className="text-sm font-medium text-zinc-700">No ledger data found</div>
                              <div className="text-xs text-zinc-500">
                                Make sure your clients are linked to this organisation, then record invoices and receipts.
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}

                      {filteredSummaries.map((summary) => (
                        <tr key={summary.clientId} className="group relative border-b border-zinc-100 transition-colors hover:bg-zinc-50">
                          <td className="px-5 py-5 align-middle cursor-pointer" onClick={() => handleView(summary.clientId)}>
                            <span className="text-sm font-medium text-zinc-800 transition-colors group-hover:text-zinc-950 group-hover:underline decoration-zinc-300 underline-offset-4">{summary.clientName}</span>
                          </td>
                          <td className="px-5 py-5 text-right align-middle">
                            <span className="tabular-nums tracking-tight text-sm font-semibold text-zinc-800">{formatCurrency(summary.outstanding)}</span>
                          </td>
                          <td className="px-5 py-5 align-middle">
                            <span className="tabular-nums text-sm text-zinc-500">{formatDisplayDate(summary.oldestDueDate)}</span>
                          </td>
                          <td className="px-5 py-5 align-middle">
                            {(() => {
                              const status = statusBadge(summary);
                              const dotColors = {
                                emerald: 'bg-emerald-500',
                                rose: 'bg-rose-500',
                                amber: 'bg-amber-500',
                              };
                              const bgColors = {
                                emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
                                rose: 'bg-rose-50 text-rose-700 ring-rose-600/20',
                                amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
                              };
                              const variant = status.icon as keyof typeof dotColors;
                              return (
                                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium ring-1 ring-inset ${bgColors[variant]}`}>
                                  <span className={`h-1.5 w-1.5 rounded-full ${dotColors[variant]}`} />
                                  {status.label}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="px-5 py-5 text-right align-middle opacity-0 transition-opacity group-hover:opacity-100">
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleView(summary.clientId)}
                                className="inline-flex h-9 items-center justify-center rounded bg-zinc-100 px-4 text-sm font-medium text-zinc-700 transition-all hover:bg-zinc-200"
                              >
                                Open
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEditLedger(summary.clientId)}
                                className="inline-flex h-9 items-center justify-center rounded border border-zinc-200 px-3 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
                              >
                                Edit
                              </button>
                              {clientVendorLinks[summary.clientId] && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const client = clients.find(c => c.id === summary.clientId);
                                    setParty360Data({ name: summary.clientName, vendorId: clientVendorLinks[summary.clientId], clientId: summary.clientId });
                                    setParty360Open(true);
                                  }}
                                  className="inline-flex h-9 items-center justify-center rounded border border-purple-200 px-3 text-sm font-medium text-purple-600 transition-colors hover:bg-purple-50"
                                  title="Party 360°"
                                >
                                  <Eye size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {detailsDrawerOpen && (
                <div className="fixed inset-0 z-50 flex justify-end bg-zinc-900/20 backdrop-blur-sm transition-all duration-300">
                  <div className="w-full max-w-2xl bg-white shadow-2xl flex flex-col h-full animate-in slide-in-from-right overflow-y-auto">
                    <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 sticky top-0 bg-white z-10">
                      <div>
                        <h2 className="text-lg font-semibold text-zinc-800">
                          Manage Details
                        </h2>
                        {selectedClient && <p className="text-xs text-zinc-500">{selectedClient.name}</p>}
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setDetailsDrawerOpen(false)}
                          className="text-zinc-500 hover:text-zinc-700 bg-zinc-100 hover:bg-zinc-200 p-1.5 rounded transition"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="p-6">
                  {!selectedClient && (
                    <div className="py-12 text-center">
                      <div className="mx-auto max-w-sm space-y-2">
                        <div className="text-sm font-medium text-zinc-700">Select a client</div>
                        <div className="text-xs text-zinc-500">
                          Click on a client from the Client Ledger tab, or select "Edit Details" from the actions menu.
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedClient && selectedClientReceipts.length === 0 && !isLoading && (
                    <div className="py-12 text-center">
                      <div className="mx-auto max-w-sm space-y-2">
                        <div className="text-sm font-medium text-zinc-700">No receipts found</div>
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
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-b border-zinc-200 bg-zinc-50">
                              <TableHead className="h-10 px-4 text-left align-middle text-[12px] font-medium text-zinc-500">Date</TableHead>
                              <TableHead className="h-10 px-4 text-left align-middle text-[12px] font-medium text-zinc-500">Payment Type</TableHead>
                              <TableHead className="h-10 px-4 text-left align-middle text-[12px] font-medium text-zinc-500">Remarks</TableHead>
                              <TableHead className="h-10 px-4 text-right align-middle text-[12px] font-medium text-zinc-500">Amount</TableHead>
                              <TableHead className="h-10 px-4 text-right align-middle text-[12px] font-medium text-zinc-500">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody className="[&_tr:last-child]:border-0">
                            {selectedClientReceipts.map((receipt) => {
                              const isEditing = editingReceiptId === receipt.id;

                              if (isEditing && editingForm) {
                                return (
                                  <tr key={receipt.id} className="bg-amber-50/50 border-b border-amber-100">
                                    <td className="px-4 py-2.5">
                                      <input
                                        type="date"
                                        value={editingForm.receipt_date}
                                        onChange={(e) => setEditingForm({ ...editingForm, receipt_date: e.target.value })}
                                        className="h-9 w-full rounded border border-zinc-200 bg-white px-2.5 text-sm"
                                      />
                                    </td>
                                    <td className="px-4 py-2.5">
                                      <select
                                        value={editingForm.payment_type}
                                        onChange={(e) => setEditingForm({ ...editingForm, payment_type: e.target.value })}
                                        className="h-9 w-full rounded border border-zinc-200 bg-white px-2.5 text-sm"
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
                                        className="h-9 w-full rounded border border-zinc-200 bg-white px-2.5 text-sm"
                                      />
                                    </td>
                                    <td className="px-4 py-2.5">
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={editingForm.amount}
                                        onChange={(e) => setEditingForm({ ...editingForm, amount: parseFloat(e.target.value) || 0 })}
                                        className="h-9 w-24 rounded border border-zinc-200 bg-white px-2.5 text-right text-sm"
                                      />
                                    </td>
                                    <td className="px-4 py-2.5 text-right">
                                      <div className="inline-flex items-center gap-1.5">
                                        <button
                                          type="button"
                                          onClick={handleSaveEdit}
                                          disabled={updateReceiptMutation.isPending}
                                          className="inline-flex h-9 w-9 items-center justify-center rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
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
                                          className="inline-flex h-9 w-9 items-center justify-center rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-100"
                                        >
                                          <X size={14} />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              }

                              return (
                                <tr key={receipt.id} className="border-b border-zinc-100 hover:bg-zinc-50/50">
                                  <td className="px-4 py-3 text-sm text-zinc-600">{formatDisplayDate(receipt.receipt_date)}</td>
                                  <td className="px-4 py-3 text-sm text-zinc-600">{receipt.payment_type || '-'}</td>
                                  <td className="px-4 py-3 text-sm text-zinc-700">{receipt.remarks || 'Receipt'}</td>
                                  <td className="px-4 py-3 text-right text-sm font-medium text-zinc-700">{formatCurrency(receipt.amount)}</td>
                                  <td className="px-4 py-3 text-right">
                                    <div className="inline-flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => handleStartEdit(receipt)}
                                        className="inline-flex h-9 w-9 items-center justify-center rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-100"
                                      >
                                        <Pencil size={14} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (window.confirm('Are you sure you want to delete this payment? This action cannot be undone.')) {
                                            deleteReceiptMutation.mutate(receipt.id);
                                          }
                                        }}
                                        className="inline-flex h-9 w-9 items-center justify-center rounded border border-rose-200 text-rose-600 hover:bg-rose-50"
                                      >
                                        <Trash2 size={14} />
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
                  </div>
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
            <div ref={paymentCardRef} className="h-fit bg-white">
              <div className="p-5">
                <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Record Payment</span>
                <h2 className="mt-1.5 text-lg font-semibold tracking-tight text-zinc-700">Add receipt</h2>
                <p className="mt-1 text-sm leading-relaxed text-zinc-500">
                  Receipts refresh the ledger immediately after save.
                </p>

                <form
                  onSubmit={paymentForm.handleSubmit((values) => recordPaymentMutation.mutate(values))}
                  className="mt-4 space-y-3"
                >
                  <div className="space-y-1.5">
                    <label className="block text-[12px] font-semibold uppercase tracking-wider text-zinc-500">Client</label>
                    <select
                      {...paymentForm.register('client_id')}
                      className="h-9 w-full rounded border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-white"
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
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="block text-[12px] font-semibold uppercase tracking-wider text-zinc-500">Amount</label>
                      <input
                        type="number"
                        step="0.01"
                        {...paymentForm.register('amount')}
                        className="h-9 w-full rounded border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-white"
                        placeholder="0.00"
                      />
                      {paymentForm.formState.errors.amount && (
                        <p className="text-[12px] text-rose-600">{paymentForm.formState.errors.amount.message}</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[12px] font-semibold uppercase tracking-wider text-zinc-500">Date</label>
                      <input
                        type="date"
                        {...paymentForm.register('receipt_date')}
                        className="h-9 w-full rounded border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-white"
                      />
                      {paymentForm.formState.errors.receipt_date && (
                        <p className="text-[12px] text-rose-600">{paymentForm.formState.errors.receipt_date.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[12px] font-semibold uppercase tracking-wider text-zinc-500">Payment Type</label>
                    <select
                      {...paymentForm.register('payment_type')}
                      className="h-9 w-full rounded border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-white"
                    >
                      <option value="">-- Select (Optional) --</option>
                      <option value="Opening Balance">Opening Balance</option>
                      <option value="Advance">Advance</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[12px] font-semibold uppercase tracking-wider text-zinc-500">Remarks</label>
                    <textarea
                      {...paymentForm.register('remarks')}
                      rows={2}
                      className="w-full rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-white resize-none"
                      placeholder="Advance, part payment, retention release..."
                    />
                    {paymentForm.formState.errors.remarks && (
                      <p className="text-[12px] text-rose-600">{paymentForm.formState.errors.remarks.message}</p>
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
          onManageDetails={handleEditLedger}
          openingBalance={selectedClientId ? openingBalancesMap[selectedClientId] ?? null : null}
        />

        {party360Open && party360Data && (
          <Party360
            partyName={party360Data.name}
            vendorId={party360Data.vendorId}
            clientId={party360Data.clientId}
            onClose={() => setParty360Open(false)}
          />
        )}
      </div>
    </div>
  );
}
