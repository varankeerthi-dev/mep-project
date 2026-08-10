import React, { useMemo, useState } from 'react';
import { CheckCircle2, Wallet, BadgeAlert, Timer, ChevronLeft, ChevronRight, CalendarDays, Table2, Trash2, RotateCcw, CircleDollarSign } from 'lucide-react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Table, ColumnDef, StatusBadge, BulkAction } from '@/components/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useAppDateFormat } from '@/contexts/DateFormatContext';
import { useApprovedPaymentsForAccountant, useReleasePayment, useReleaseSubcontractorPayment, useSubcontractorPaymentsForAccountant, useApprovedPaymentRequests, useReleasedPayments, useReleasedSubcontractorPayments, useRecordPaymentForRequest, useBulkMarkPaid, useBulkSoftDelete, useBulkResendReapproval } from '../hooks/usePurchaseQueries';
import { toast } from '@/lib/logger';
import { cn } from '@/lib/utils';

type PaymentType = 'vendor' | 'subcontractor';
type PaymentMode = 'Bank Transfer' | 'GPAY' | 'Cash' | 'Cheque';

const recordPaymentSchema = z.object({
  paymentDate: z.string().min(1, 'Payment date is required'),
  paymentMode: z.enum(['Bank Transfer', 'GPAY', 'Cash', 'Cheque'], {
    errorMap: () => ({ message: 'Select a payment mode' }),
  }),
  referenceNo: z.string().optional(),
  chequeNo: z.string().optional(),
  chequeDate: z.string().optional(),
  chequeDueDate: z.string().optional(),
  issuedToClient: z.boolean().optional(),
  reason: z.string().optional(),
});

type RecordPaymentValues = z.infer<typeof recordPaymentSchema>;

type UnifiedRow = {
  id: string;
  _type: PaymentType;
  isRequest?: boolean;
  voucher_no: string;
  payment_date: string;
  due_date?: string | null;
  cheque_due_date?: string | null;
  payee_name: string;
  payee_id: string;
  amount: number;
  payment_mode: string;
  approved_by: string | null;
  approved_at: string | null;
  project_name?: string | null;
  reference_no?: string | null;
};

const ACCOUNTANT_ROLES = new Set([
  'ACCOUNTS_MANAGER',
  'ACCOUNTANT',
  'Finance',
  'Accounts Manager',
]);

const PAYMENT_MODES: PaymentMode[] = ['Bank Transfer', 'GPAY', 'Cash', 'Cheque'];

const PAYMENT_MODE_CONFIG: Record<PaymentMode, { color: string; activeBg: string }> = {
  'Bank Transfer': { color: 'text-blue-700', activeBg: 'bg-blue-100 border-blue-300 shadow-sm shadow-blue-100' },
  'GPAY': { color: 'text-emerald-700', activeBg: 'bg-emerald-100 border-emerald-300 shadow-sm shadow-emerald-100' },
  'Cash': { color: 'text-amber-700', activeBg: 'bg-amber-100 border-amber-300 shadow-sm shadow-amber-100' },
  'Cheque': { color: 'text-violet-700', activeBg: 'bg-violet-100 border-violet-300 shadow-sm shadow-violet-100' },
};

export const PaymentsHub: React.FC<{ scope?: 'all' | 'vendor' | 'subcontractor' }> = ({ scope = 'all' }) => {
  const { organisation } = useAuth();
  const { formatDate } = useAppDateFormat();
  const fmtDate = (v?: string | null): string => (v ? formatDate(v) : '—');
  const orgId = organisation?.id as string | undefined;
  const [typeFilter, setTypeFilter] = useState<PaymentType | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showRecent, setShowRecent] = useState(false);

  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<UnifiedRow | null>(null);
  const [recordPaymentMode, setRecordPaymentMode] = useState<PaymentMode>('Bank Transfer');
  const [recordPaymentDate, setRecordPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [recordTransactionNo, setRecordTransactionNo] = useState('');
  const [recordChequeNo, setRecordChequeNo] = useState('');
  const [recordChequeDate, setRecordChequeDate] = useState('');
  const [recordChequeDueDate, setRecordChequeDueDate] = useState('');
  const [recordIssuedToClient, setRecordIssuedToClient] = useState(false);
  const [recordReason, setRecordReason] = useState('');
  const [recordPaymentErrors, setRecordPaymentErrors] = useState<Record<string, string>>({});

  const [duesView, setDuesView] = useState<'table' | 'calendar'>('table');
  const [duesMonth, setDuesMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [hiddenColumnIds, setHiddenColumnIds] = useState<string[]>([]);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string | number>>(new Set());

  // Filter panel state
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | PaymentMode>('all');

  // Bulk actions state
  const [bulkMarkPaidOpen, setBulkMarkPaidOpen] = useState(false);
  const [bulkRows, setBulkRows] = useState<UnifiedRow[]>([]);
  const [bulkDates, setBulkDates] = useState<Record<string, string>>({});
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteReason, setBulkDeleteReason] = useState('');
  const [bulkDeleteError, setBulkDeleteError] = useState('');
  const [bulkResendOpen, setBulkResendOpen] = useState(false);

  const { data: vendorPayments = [], isLoading: vendorLoading } = useApprovedPaymentsForAccountant(orgId);
  const { data: subPayments = [], isLoading: subLoading } = useSubcontractorPaymentsForAccountant(orgId);
  const { data: paymentRequests = [], isLoading: reqLoading } = useApprovedPaymentRequests(orgId);
  const { data: releasedVendorPayments = [], isLoading: releasedVendorLoading } = useReleasedPayments(orgId);
  const { data: releasedSubPayments = [], isLoading: releasedSubLoading } = useReleasedSubcontractorPayments(orgId);
  const releaseVendor = useReleasePayment();
  const releaseSub = useReleaseSubcontractorPayment();
  const recordPayment = useRecordPaymentForRequest();
  const bulkMarkPaid = useBulkMarkPaid();
  const bulkSoftDelete = useBulkSoftDelete();
  const bulkResend = useBulkResendReapproval();

  const role = (organisation?.user?.role as string | undefined) ?? '';
  const canRelease = ACCOUNTANT_ROLES.has(role);

  const effectiveTypeFilter = scope !== 'all' ? scope : typeFilter;

  const unified = useMemo<UnifiedRow[]>(() => {
    if (showRecent) {
      const rVendor: UnifiedRow[] = releasedVendorPayments.map((p: any) => ({
        id: p.id,
        _type: 'vendor' as PaymentType,
        voucher_no: p.voucher_no || '',
        payment_date: p.released_at || p.payment_date,
        cheque_due_date: p.cheque_due_date || null,
        payee_name: p.vendor?.company_name || '-',
        payee_id: p.vendor_id,
        amount: Number(p.released_amount ?? p.amount),
        payment_mode: p.payment_mode,
        approved_by: p.approved_by,
        approved_at: p.approved_at,
        project_name: p.project_name,
        reference_no: p.reference_no,
      }));
      const rSub: UnifiedRow[] = releasedSubPayments.map((p: any) => ({
        id: p.id,
        _type: 'subcontractor' as PaymentType,
        voucher_no: p.voucher_no || '',
        payment_date: p.released_at || p.payment_date,
        cheque_due_date: p.cheque_due_date || null,
        payee_name: p.subcontractor?.company_name || '-',
        payee_id: p.subcontractor_id,
        amount: Number(p.amount),
        payment_mode: p.payment_mode,
        approved_by: p.approved_by,
        approved_at: p.approved_at,
        project_name: p.project_name,
        reference_no: p.reference_no,
      }));
      const all = [...rVendor, ...rSub];
      all.sort((a, b) => new Date(b.payment_date || '').getTime() - new Date(a.payment_date || '').getTime());
      return all;
    }

    const vendor: UnifiedRow[] = vendorPayments.map((p: any) => ({
      id: p.id,
      _type: 'vendor' as PaymentType,
      voucher_no: p.voucher_no || '',
      payment_date: p.payment_date,
      cheque_due_date: p.cheque_due_date || null,
      payee_name: p.vendor?.company_name || '-',
      payee_id: p.vendor_id,
      amount: Number(p.amount),
      payment_mode: p.payment_mode,
      approved_by: p.approved_by,
      approved_at: p.approved_at,
      project_name: p.project_name,
      reference_no: p.reference_no,
    }));

    const sub: UnifiedRow[] = subPayments.map((p: any) => ({
      id: p.id,
      _type: 'subcontractor' as PaymentType,
      voucher_no: p.voucher_no || '',
      payment_date: p.payment_date,
      cheque_due_date: p.cheque_due_date || null,
      payee_name: p.subcontractor?.company_name || '-',
      payee_id: p.subcontractor_id,
      amount: Number(p.amount),
      payment_mode: p.payment_mode,
      approved_by: p.approved_by,
      approved_at: p.approved_at,
      project_name: p.project_name,
      reference_no: p.reference_no,
    }));

    const req: UnifiedRow[] = paymentRequests.map((p: any) => ({
      id: p.id,
      _type: (p.subcontractor_id ? 'subcontractor' : 'vendor') as PaymentType,
      isRequest: true,
      voucher_no: p.request_no || '',
      payment_date: p.due_date || p.request_date,
      due_date: p.due_date || null,
      payee_name: p.vendor?.company_name || p.subcontractor?.company_name || '-',
      payee_id: p.vendor_id || p.subcontractor_id,
      amount: Number(p.amount_requested || 0),
      payment_mode: p.payment_mode || '-',
      approved_by: p.approved_by,
      approved_at: p.approved_at,
      project_name: null,
      reference_no: p.request_no,
    }));

    const all = [...vendor, ...sub, ...req];
    all.sort((a, b) => new Date(b.approved_at || b.payment_date).getTime() - new Date(a.approved_at || a.payment_date).getTime());
    return all;
  }, [vendorPayments, subPayments, paymentRequests, releasedVendorPayments, releasedSubPayments, showRecent]);

  const filtered = useMemo(() => {
    let list = unified;
    if (effectiveTypeFilter !== 'all') {
      list = list.filter(r => r._type === effectiveTypeFilter);
    }
    if (showRecent) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      list = list.filter(r => {
        const date = r.approved_at ? new Date(r.approved_at) : r.payment_date ? new Date(r.payment_date) : null;
        return date && date >= sevenDaysAgo;
      });
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(r =>
        r.payee_name.toLowerCase().includes(term) ||
        r.voucher_no.toLowerCase().includes(term) ||
        r.payment_mode.toLowerCase().includes(term)
      );
    }
    if (filterFrom) {
      const from = new Date(filterFrom);
      list = list.filter(r => {
        const d = r.approved_at ? new Date(r.approved_at) : r.payment_date ? new Date(r.payment_date) : null;
        return d && d >= from;
      });
    }
    if (filterTo) {
      const to = new Date(filterTo);
      to.setHours(23, 59, 59, 999);
      list = list.filter(r => {
        const d = r.approved_at ? new Date(r.approved_at) : r.payment_date ? new Date(r.payment_date) : null;
        return d && d <= to;
      });
    }
    if (filterMode !== 'all') {
      list = list.filter(r => r.payment_mode === filterMode);
    }
    return list;
  }, [unified, effectiveTypeFilter, searchTerm, showRecent, filterFrom, filterTo, filterMode]);

  const pagedData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const typeFilterOptions = useMemo(() => [
    { id: 'all', label: `All (${unified.length})` },
    { id: 'vendor', label: `Vendor (${unified.filter(r => r._type === 'vendor').length})` },
    { id: 'subcontractor', label: `Subcontractor (${unified.filter(r => r._type === 'subcontractor').length})` },
  ], [unified]);

  const handleRowSelect = (row: UnifiedRow, checked: boolean) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(row.id);
      else next.delete(row.id);
      return next;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) setSelectedRowIds(new Set(pagedData.map((r) => r.id)));
    else setSelectedRowIds(new Set());
  };

  const openBulkMarkPaid = (rows: UnifiedRow[]) => {
    const initial: Record<string, string> = {};
    rows.forEach((r) => {
      initial[r.id] = new Date().toISOString().split('T')[0];
    });
    setBulkRows(rows);
    setBulkDates(initial);
    setBulkMarkPaidOpen(true);
  };

  const openBulkDelete = (rows: UnifiedRow[]) => {
    setBulkRows(rows);
    setBulkDeleteReason('');
    setBulkDeleteError('');
    setBulkDeleteOpen(true);
  };

  const openBulkResend = (rows: UnifiedRow[]) => {
    setBulkRows(rows);
    setBulkResendOpen(true);
  };

  const bulkActions: BulkAction<UnifiedRow>[] = useMemo(() => [
    {
      label: 'Mark as paid',
      variant: 'primary',
      icon: <CircleDollarSign size={13} />,
      onClick: (rows) => openBulkMarkPaid(rows),
    },
    {
      label: 'Delete',
      variant: 'danger',
      icon: <Trash2 size={13} />,
      onClick: (rows) => openBulkDelete(rows),
    },
    {
      label: 'Send again for reapproval',
      icon: <RotateCcw size={13} />,
      onClick: (rows) => openBulkResend(rows),
    },
  ], []);

  const confirmBulkMarkPaid = () => {
    const items = bulkRows.map((r) => ({
      id: r.id,
      type: r._type,
      isRequest: r.isRequest,
      paymentDate: bulkDates[r.id],
    }));
    bulkMarkPaid.mutate(
      { items, userId: organisation?.user?.id },
      {
        onSuccess: () => {
          toast.success(`${bulkRows.length} payment(s) marked as paid`);
          setBulkMarkPaidOpen(false);
          setSelectedRowIds(new Set());
        },
        onError: (e: any) => toast.error(e?.message ?? 'Failed to mark payments as paid'),
      }
    );
  };

  const confirmBulkDelete = () => {
    if (!bulkDeleteReason.trim()) {
      setBulkDeleteError('Reason is required to delete');
      return;
    }
    const items = bulkRows.map((r) => ({ id: r.id, type: r._type, isRequest: r.isRequest }));
    bulkSoftDelete.mutate(
      { items, reason: bulkDeleteReason.trim(), userId: organisation?.user?.id },
      {
        onSuccess: () => {
          toast.success(`${bulkRows.length} payment(s) deleted`);
          setBulkDeleteOpen(false);
          setSelectedRowIds(new Set());
        },
        onError: (e: any) => toast.error(e?.message ?? 'Failed to delete payments'),
      }
    );
  };

  const confirmBulkResend = () => {
    const items = bulkRows.map((r) => ({ id: r.id, type: r._type, isRequest: r.isRequest }));
    bulkResend.mutate(
      { items },
      {
        onSuccess: () => {
          toast.success(`${bulkRows.length} payment(s) sent for re-approval`);
          setBulkResendOpen(false);
          setSelectedRowIds(new Set());
        },
        onError: (e: any) => toast.error(e?.message ?? 'Failed to resend for re-approval'),
      }
    );
  };

  const totalPayable = useMemo(() => filtered.reduce((s, r) => s + r.amount, 0), [filtered]);
  const vendorCount = filtered.filter(r => r._type === 'vendor').length;
  const subCount = filtered.filter(r => r._type === 'subcontractor').length;

  const dues = useMemo(() => {
    const allCheques = unified.filter(r => r.payment_mode === 'Cheque' && r.cheque_due_date);
    const mapped = allCheques.map(r => ({
      id: r.id,
      dueDate: r.cheque_due_date as string,
      type: 'Cheque' as const,
      amount: r.amount,
      payeeName: r.payee_name,
      voucherNo: r.voucher_no,
    }));
    mapped.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    return mapped;
  }, [unified]);

  const handleRelease = (row: UnifiedRow) => {
    if (row._type === 'vendor') {
      releaseVendor.mutate(
        { paymentId: row.id, releasedBy: organisation?.user?.id },
        { onSuccess: () => toast.success(`${row.payee_name} — payment released`), onError: (e: any) => toast.error(e?.message ?? 'Release failed') }
      );
    } else {
      releaseSub.mutate(
        { paymentId: row.id, releasedBy: organisation?.user?.id },
        { onSuccess: () => toast.success(`${row.payee_name} — payment released`), onError: (e: any) => toast.error(e?.message ?? 'Release failed') }
      );
    }
  };

  const openRecordModal = (row: UnifiedRow) => {
    setSelectedRow(row);
    setRecordPaymentMode(row.payment_mode as PaymentMode || 'Bank Transfer');
    setRecordPaymentDate(new Date().toISOString().split('T')[0]);
    setRecordTransactionNo('');
    setRecordChequeNo('');
    setRecordChequeDate('');
    setRecordChequeDueDate('');
    setRecordIssuedToClient(false);
    setRecordReason('');
    setRecordPaymentErrors({});
    setRecordModalOpen(true);
  };

  const isDateDifferent = useMemo(() => {
    if (!selectedRow?.due_date || !recordPaymentDate) return false;
    const due = new Date(selectedRow.due_date).toISOString().split('T')[0];
    const actual = new Date(recordPaymentDate).toISOString().split('T')[0];
    return due !== actual;
  }, [selectedRow?.due_date, recordPaymentDate]);

  const handleRecordPayment = () => {
    if (!selectedRow) return;

    const values: RecordPaymentValues = {
      paymentDate: recordPaymentDate,
      paymentMode: recordPaymentMode,
      referenceNo: recordTransactionNo || undefined,
      chequeNo: recordChequeNo || undefined,
      chequeDate: recordChequeDate || undefined,
      chequeDueDate: recordChequeDueDate || undefined,
      issuedToClient: recordIssuedToClient || undefined,
      reason: recordReason || undefined,
    };

    const result = recordPaymentSchema.safeParse(values);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const key = issue.path[0] as string;
        fieldErrors[key] = issue.message;
      });
      setRecordPaymentErrors(fieldErrors);
      return;
    }

    if (isDateDifferent && !recordReason.trim()) {
      setRecordPaymentErrors({ reason: 'Reason is required when payment date differs from due date' });
      return;
    }

    setRecordPaymentErrors({});

    const refNo = (recordPaymentMode === 'Bank Transfer' || recordPaymentMode === 'GPAY')
      ? recordTransactionNo || null
      : recordPaymentMode === 'Cheque'
        ? recordChequeNo || null
        : null;

    recordPayment.mutate(
      {
        requestId: selectedRow.id,
        requestType: selectedRow._type,
        paymentDate: recordPaymentDate,
        paymentMode: recordPaymentMode,
        referenceNo: refNo,
        chequeNo: recordPaymentMode === 'Cheque' ? recordChequeNo : null,
        chequeDate: recordPaymentMode === 'Cheque' ? recordChequeDate : null,
        chequeDueDate: recordPaymentMode === 'Cheque' ? recordChequeDueDate : null,
        issuedToClient: recordPaymentMode === 'Cheque' ? recordIssuedToClient : false,
        createdBy: organisation?.user?.id,
      },
      {
        onSuccess: () => {
          toast.success(`Payment recorded for ${selectedRow.payee_name} — ₹${selectedRow.amount.toLocaleString('en-IN')}`);
          setRecordModalOpen(false);
          setSelectedRow(null);
        },
        onError: (e: any) => {
          toast.error(e?.message ?? 'Failed to record payment');
        },
      }
    );
  };

  const summaryCards = [
    { label: 'Pending Release', value: `₹${totalPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, icon: Wallet, color: 'text-rose-600', bg: 'bg-rose-50' },
    { label: 'Vendor Payments', value: `${vendorCount} pending`, icon: BadgeAlert, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Subcontractor', value: `${subCount} pending`, icon: Timer, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ];

  const columns: ColumnDef<UnifiedRow>[] = [
    {
      header: 'Payment Type',
      accessorKey: '_type',
      id: 'type',
      type: 'status',
      align: 'center',
      statusType: (r) => (r._type === 'vendor' ? 'blue' : 'success'),
      cell: ({ getValue }) => (getValue() === 'vendor' ? 'Vendor' : 'Subcontractor'),
    },
    {
      header: 'Voucher',
      accessorKey: 'voucher_no',
      id: 'voucher_no',
      type: 'id',
      align: 'left',
    },
    {
      header: 'Payee',
      accessorKey: 'payee_name',
      id: 'payee_name',
      type: 'text',
      align: 'left',
    },
    {
      header: 'Project',
      accessorKey: 'project_name',
      id: 'project_name',
      type: 'text',
      align: 'left',
      cell: ({ getValue }) => (getValue() as string) || '—',
    },
    {
      header: showRecent ? 'Released' : 'Approved',
      accessorKey: 'approved_at',
      id: 'approved_at',
      type: 'date',
      align: 'left',
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        return fmtDate(v);
      },
      secondaryText: (r) => {
        if (!r.approved_at) return '';
        const d = new Date(r.approved_at);
        const days = Math.ceil((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
        return days > 0 ? `${days}d ago` : 'Today';
      },
    },
    {
      header: 'Amount',
      accessorKey: 'amount',
      id: 'amount',
      type: 'money',
      align: 'right',
      cell: ({ getValue }) => `₹${(getValue() as number).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    },
    {
      header: 'Mode',
      accessorKey: 'payment_mode',
      id: 'payment_mode',
      type: 'status',
      align: 'center',
      statusType: () => 'neutral',
    },
    {
      header: 'Due',
      accessorKey: 'cheque_due_date',
      id: 'cheque_due_date',
      type: 'text',
      align: 'left',
      cell: ({ row }) => {
        const r = row;
        if (r.payment_mode !== 'Cheque' || !r.cheque_due_date) return <span className="text-xs text-zinc-300">—</span>;
        const due = new Date(r.cheque_due_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const isOverdue = diffDays < 0;
        const isToday = diffDays === 0;
        const isSoon = diffDays > 0 && diffDays <= 7;
        return (
          <div className="flex flex-col gap-0.5">
            <span className={cn(
              'text-[13px] font-medium',
              isOverdue ? 'text-red-600' : isToday ? 'text-amber-600' : isSoon ? 'text-amber-600' : 'text-zinc-700'
            )}>
              {fmtDate(r.cheque_due_date)}
            </span>
            <span className={cn(
              'text-[11px]',
              isOverdue ? 'text-red-500 font-semibold' : isToday ? 'text-amber-600 font-semibold' : isSoon ? 'text-amber-500' : 'text-zinc-400'
            )}>
              {isOverdue ? `${Math.abs(diffDays)}d overdue` : isToday ? 'Today' : isSoon ? `${diffDays}d left` : `${diffDays}d`}
            </span>
          </div>
        );
      },
    },
    {
      header: '',
      id: 'actions',
      type: 'text',
      align: 'right',
      cell: ({ row }) => {
        if (showRecent) return <StatusBadge status="success">Released</StatusBadge>;
        const r = row;
        if (r.isRequest) {
          return (
            <button
              onClick={() => openRecordModal(r)}
              className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-1.5 leading-5 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-all active:scale-[0.97] cursor-pointer"
            >
              Record payment
            </button>
          );
        }
        return canRelease ? (
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => handleRelease(row)}
            disabled={releaseVendor.isPending || releaseSub.isPending}
            className="h-7 px-2.5 text-xs font-semibold gap-1"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Release
          </Button>
        ) : (
          <span className="text-[10px] text-zinc-400 italic">—</span>
        );
      },
    },
  ];

  const isLoading = showRecent ? (releasedVendorLoading || releasedSubLoading) : (vendorLoading || subLoading || reqLoading);

  return (
    <div className="flex flex-col h-full bg-white w-full max-w-[1000px] mx-auto" style={{ width: '100%', maxWidth: '1000px' }}>
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
        <div>
          <h1 className="text-base font-semibold text-zinc-900">
            {scope === 'vendor' ? 'Vendor Payment Queue' : scope === 'subcontractor' ? 'Subcontractor Payment Queue' : 'Payments Hub'}
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            {scope === 'all' ? 'Treasury — pay vendors & subcontractors' : 'Payments approved and ready for release'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!canRelease && scope === 'all' && (
            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-md font-medium">
              Accountant access required to release
            </span>
          )}
          <button
            onClick={() => { setShowRecent(!showRecent); setTypeFilter('all'); setPage(1); }}
            className={cn(
              'px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors',
              showRecent
                ? 'bg-zinc-900 text-white border-zinc-900'
                : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
            )}
          >
            Recent Payments
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 px-6 py-4">
        {summaryCards.map((card, i) => (
          <div key={i} className="!bg-white !border-zinc-200 border rounded-xl overflow-hidden" style={{ backgroundColor: 'white !important', borderColor: '#E4E4E7 !important' }}>
            <div className="p-4 flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{card.label}</p>
                <h4 className={cn('text-lg font-bold tracking-tight', card.color)}>{card.value}</h4>
              </div>
              <div className={cn('p-2 rounded-lg', card.bg)}>
                <card.icon className={cn('h-4 w-4', card.color)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-auto min-h-0 px-6 pb-4">
        <Table<UnifiedRow>
          data={pagedData}
          columns={columns}
          loading={isLoading}
          page={page}
          pageSize={pageSize}
          totalRows={filtered.length}
          searchable
          selectable
          sortable
          pagination
          onPageChange={setPage}
          onPageSizeChange={(sz) => { setPageSize(sz); setPage(1); }}
          onSearch={(val) => { setSearchTerm(val); setPage(1); }}
          selectedRowIds={selectedRowIds}
          onRowSelectChange={handleRowSelect}
          onSelectAllChange={handleSelectAll}
          filterOptions={scope === 'all' ? typeFilterOptions : undefined}
          selectedFilterId={scope === 'all' ? effectiveTypeFilter : undefined}
          onFilterSelect={(id) => { setTypeFilter(id as PaymentType | 'all'); setPage(1); }}
          hiddenColumnIds={hiddenColumnIds}
          onColumnVisibilityChange={setHiddenColumnIds}
          mandatoryColumnIds={['voucher_no', 'payee_name', 'amount', 'actions']}
          bulkActions={bulkActions}
          filterPanel={
            <div className="flex flex-wrap items-end gap-3 py-1">
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">From</Label>
                <Input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="h-8 text-xs border-zinc-200 rounded-lg" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">To</Label>
                <Input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className="h-8 text-xs border-zinc-200 rounded-lg" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Mode</Label>
                <select
                  value={filterMode}
                  onChange={(e) => setFilterMode(e.target.value as 'all' | PaymentMode)}
                  className="h-8 text-xs border-zinc-200 rounded-lg bg-white px-2"
                >
                  <option value="all">All modes</option>
                  {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <button
                onClick={() => { setFilterFrom(''); setFilterTo(''); setFilterMode('all'); setPage(1); }}
                className="h-8 px-3 text-xs font-medium text-zinc-500 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
              >
                Clear filters
              </button>
            </div>
          }
          emptyTitle={showRecent ? 'No recent payments this week' : scope === 'vendor' ? 'No vendor payments awaiting release' : scope === 'subcontractor' ? 'No subcontractor payments awaiting release' : 'No payments awaiting release'}
          emptySubtitle={scope === 'all' && !showRecent ? 'Everything is up to date.' : undefined}
        />
      </div>

      {/* Dues Section */}
      {scope === 'all' && (
        <div className="border-t border-zinc-200">
          <div className="px-6 pt-6 pb-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900">Dues</h2>
                <p className="text-[11px] text-zinc-400 mt-0.5">{dues.length} upcoming</p>
              </div>
              <div className="flex items-center bg-zinc-100 rounded-lg p-0.5">
                <button
                  onClick={() => setDuesView('table')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-md transition-all',
                    duesView === 'table' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                  )}
                >
                  <Table2 className="w-3.5 h-3.5" />
                  Table
                </button>
                <button
                  onClick={() => setDuesView('calendar')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-md transition-all',
                    duesView === 'calendar' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                  )}
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                  Calendar
                </button>
              </div>
            </div>

            {duesView === 'table' ? (
              <div className="rounded-xl border border-zinc-200 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-zinc-50/80">
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-400 px-6 py-3">Due Date</th>
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-400 px-6 py-3">Type</th>
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-400 px-6 py-3">Payee</th>
                      <th className="text-right text-[10px] font-semibold uppercase tracking-wider text-zinc-400 px-6 py-3">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dues.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-10 text-xs text-zinc-400">
                          No cheque dues tracked yet
                        </td>
                      </tr>
                    ) : (
                      dues.map((d) => {
                        const due = new Date(d.dueDate);
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                        const isOverdue = diffDays < 0;
                        const isToday = diffDays === 0;
                        const isSoon = diffDays > 0 && diffDays <= 7;
                        return (
                          <tr key={d.id} className="border-t border-zinc-100 hover:bg-zinc-50/50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className={cn(
                                  'text-sm font-medium',
                                  isOverdue ? 'text-red-600' : isToday ? 'text-amber-600' : isSoon ? 'text-amber-600' : 'text-zinc-900'
                                )}>
                                  {fmtDate(d.dueDate)}
                                </span>
                                <span className={cn(
                                  'text-[11px] mt-0.5',
                                  isOverdue ? 'text-red-500 font-medium' : isToday ? 'text-amber-600 font-medium' : isSoon ? 'text-amber-500' : 'text-zinc-400'
                                )}>
                                  {isOverdue ? `${Math.abs(diffDays)} days overdue` : isToday ? 'Due today' : isSoon ? `${diffDays} days left` : `in ${diffDays} days`}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="inline-flex text-[11px] font-medium px-2.5 py-1 rounded-md bg-violet-50 text-violet-700 border border-violet-200/60">
                                {d.type}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="text-sm text-zinc-900">{d.payeeName}</span>
                                <span className="text-[11px] text-zinc-400 mt-0.5">{d.voucherNo}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className="text-sm font-semibold text-zinc-900 tabular-nums">
                                ₹{d.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-xl border border-zinc-200 overflow-hidden">
                {/* Calendar Header */}
                <div className="flex items-center justify-between px-6 py-4 bg-zinc-50/80 border-b border-zinc-200">
                  <button
                    onClick={() => setDuesMonth(prev => {
                      const m = prev.month - 1;
                      return m < 0 ? { year: prev.year - 1, month: 11 } : { year: prev.year, month: m };
                    })}
                    className="p-1.5 rounded-lg hover:bg-zinc-200/60 text-zinc-500 hover:text-zinc-700 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <h3 className="text-sm font-semibold text-zinc-900">
                    {new Date(duesMonth.year, duesMonth.month).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                  </h3>
                  <button
                    onClick={() => setDuesMonth(prev => {
                      const m = prev.month + 1;
                      return m > 11 ? { year: prev.year + 1, month: 0 } : { year: prev.year, month: m };
                    })}
                    className="p-1.5 rounded-lg hover:bg-zinc-200/60 text-zinc-500 hover:text-zinc-700 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Calendar Grid */}
                <div className="p-6">
                  <div className="grid grid-cols-7 gap-px bg-zinc-200/60 rounded-lg overflow-hidden">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                      <div key={d} className="bg-zinc-50/80 text-center py-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{d}</span>
                      </div>
                    ))}
                    {(() => {
                      const firstDay = new Date(duesMonth.year, duesMonth.month, 1).getDay();
                      const daysInMonth = new Date(duesMonth.year, duesMonth.month + 1, 0).getDate();
                      const cells: React.ReactNode[] = [];

                      for (let i = 0; i < firstDay; i++) {
                        cells.push(<div key={`empty-${i}`} className="bg-white min-h-[80px]" />);
                      }

                      for (let day = 1; day <= daysInMonth; day++) {
                        const dateStr = `${duesMonth.year}-${String(duesMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const dayDues = dues.filter(d => d.dueDate === dateStr);
                        const today = new Date();
                        const isToday = today.getFullYear() === duesMonth.year && today.getMonth() === duesMonth.month && today.getDate() === day;

                        cells.push(
                          <div key={day} className={cn(
                            'bg-white min-h-[80px] px-2 py-1.5 relative',
                            isToday && 'bg-amber-50/50'
                          )}>
                            <span className={cn(
                              'text-xs font-medium',
                              isToday ? 'text-amber-700 bg-amber-100 w-6 h-6 rounded-full flex items-center justify-center' : 'text-zinc-700'
                            )}>
                              {day}
                            </span>
                            {dayDues.length > 0 && (
                              <div className="mt-1 space-y-0.5">
                                {dayDues.slice(0, 2).map(d => (
                                  <div key={d.id} className="text-[10px] font-medium text-violet-700 bg-violet-50 border border-violet-200/60 rounded px-1.5 py-0.5 truncate">
                                    ₹{d.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                  </div>
                                ))}
                                {dayDues.length > 2 && (
                                  <span className="text-[9px] text-zinc-400">+{dayDues.length - 2} more</span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      }

                      const remaining = 7 - ((firstDay + daysInMonth) % 7);
                      if (remaining < 7) {
                        for (let i = 0; i < remaining; i++) {
                          cells.push(<div key={`end-${i}`} className="bg-white min-h-[80px]" />);
                        }
                      }

                      return cells;
                    })()}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      <Dialog open={recordModalOpen} onOpenChange={(open) => !open && setRecordModalOpen(false)}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b bg-amber-50/40">
            <DialogTitle className="text-base font-bold text-zinc-900">Record Payment</DialogTitle>
            {selectedRow && (
              <p className="text-xs text-zinc-500 mt-1">
                {selectedRow.payee_name} — ₹{selectedRow.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
            )}
          </DialogHeader>

          <div className="p-[50px] space-y-5">
            {/* Payment Date */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-zinc-600">Payment Date</Label>
              <Input
                type="date"
                value={recordPaymentDate}
                onChange={(e) => setRecordPaymentDate(e.target.value)}
                className="h-10 text-sm border-zinc-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>

            {/* Payment Mode Toggle */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-zinc-600">Payment Mode</Label>
              <div className="grid grid-cols-4 gap-1.5 p-1 bg-zinc-100/80 rounded-xl border border-zinc-200/60">
                {PAYMENT_MODES.map((mode) => {
                  const cfg = PAYMENT_MODE_CONFIG[mode];
                  const isActive = recordPaymentMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setRecordPaymentMode(mode)}
                      className={cn(
                        'px-2 py-2 text-[11px] font-semibold rounded-lg border transition-all duration-150',
                        isActive
                          ? cn(cfg.activeBg, cfg.color, 'border-current')
                          : 'bg-white/70 text-zinc-500 border-transparent hover:bg-white hover:text-zinc-700 hover:shadow-sm'
                      )}
                    >
                      {mode}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Conditional Fields */}
            {(recordPaymentMode === 'Bank Transfer' || recordPaymentMode === 'GPAY') && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-zinc-600">
                  {recordPaymentMode === 'Bank Transfer' ? 'Transaction / UTR No.' : 'Transaction No.'}
                </Label>
                <Input
                  type="text"
                  placeholder={recordPaymentMode === 'Bank Transfer' ? 'Enter UTR or transaction reference' : 'Enter GPAY transaction ID'}
                  value={recordTransactionNo}
                  onChange={(e) => setRecordTransactionNo(e.target.value)}
                  className="h-10 text-sm border-zinc-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
              </div>
            )}

            {recordPaymentMode === 'Cheque' && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-zinc-600">Cheque No.</Label>
                  <Input
                    type="text"
                    placeholder="Enter cheque number"
                    value={recordChequeNo}
                    onChange={(e) => setRecordChequeNo(e.target.value)}
                    className="h-10 text-sm border-zinc-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-zinc-600">Cheque Date</Label>
                  <Input
                    type="date"
                    value={recordChequeDate}
                    onChange={(e) => setRecordChequeDate(e.target.value)}
                    className="h-10 text-sm border-zinc-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-zinc-600">Cheque Due Date <span className="text-zinc-400 font-normal">(PDC)</span></Label>
                  <Input
                    type="date"
                    value={recordChequeDueDate}
                    onChange={(e) => setRecordChequeDueDate(e.target.value)}
                    placeholder="When will this cheque be deposited?"
                    className="h-10 text-sm border-zinc-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                </div>
                <div className="flex items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setRecordIssuedToClient(!recordIssuedToClient)}
                    className={cn(
                      'w-4.5 h-4.5 rounded border-2 flex items-center justify-center transition-all',
                      recordIssuedToClient
                        ? 'bg-amber-500 border-amber-500 text-white'
                        : 'bg-white border-zinc-300 hover:border-zinc-400'
                    )}
                  >
                    {recordIssuedToClient && <CheckCircle2 className="w-3 h-3" />}
                  </button>
                  <Label className="text-xs font-medium text-zinc-600 cursor-pointer" onClick={() => setRecordIssuedToClient(!recordIssuedToClient)}>
                    Issued to client?
                  </Label>
                </div>
              </>
            )}

            {/* Reason for early/late payment */}
            {isDateDifferent && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-amber-700">
                  Reason for early/late payment *
                </Label>
                <p className="text-[10px] text-amber-600">
                  Due date: {fmtDate(selectedRow?.due_date)} but recording for: {fmtDate(recordPaymentDate)}
                </p>
                <textarea
                  value={recordReason}
                  onChange={(e) => { setRecordReason(e.target.value); setRecordPaymentErrors((prev) => ({ ...prev, reason: '' })); }}
                  placeholder="e.g. Vendor requested early settlement, critical material needed..."
                  rows={2}
                  className={cn(
                    'w-full text-sm border rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none',
                    recordPaymentErrors.reason ? 'border-red-300 bg-red-50' : 'border-zinc-200'
                  )}
                />
                {recordPaymentErrors.reason && (
                  <p className="text-[10px] text-red-500">{recordPaymentErrors.reason}</p>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t bg-zinc-50/50">
            <Button
              variant="outline"
              onClick={() => setRecordModalOpen(false)}
              className="px-5 h-9 text-xs font-semibold border-zinc-200"
            >
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={handleRecordPayment}
              disabled={recordPayment.isPending}
              className="px-5 h-9 text-xs font-semibold gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {recordPayment.isPending ? 'Recording...' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Mark as Paid Dialog (per-row dates) */}
      <Dialog open={bulkMarkPaidOpen} onOpenChange={(open) => !open && !bulkMarkPaid.isPending && setBulkMarkPaidOpen(false)}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b bg-emerald-50/40">
            <DialogTitle className="text-base font-bold text-zinc-900">Mark {bulkRows.length} payment(s) as paid</DialogTitle>
            <p className="text-xs text-zinc-500 mt-1">Set a payment date for each row</p>
          </DialogHeader>
          <div className="p-5 space-y-2 max-h-[50vh] overflow-auto">
            {bulkRows.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-zinc-200 bg-white">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-zinc-800 truncate">{r.payee_name}</p>
                  <p className="text-[10px] text-zinc-400">
                    {r.voucher_no} · ₹{r.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <Input
                  type="date"
                  value={bulkDates[r.id] || ''}
                  onChange={(e) => setBulkDates((prev) => ({ ...prev, [r.id]: e.target.value }))}
                  className="h-8 w-40 text-xs border-zinc-200 rounded-lg"
                />
              </div>
            ))}
          </div>
          <DialogFooter className="px-6 py-4 border-t bg-zinc-50/50">
            <Button variant="outline" onClick={() => setBulkMarkPaidOpen(false)} className="px-5 h-9 text-xs font-semibold border-zinc-200">
              Cancel
            </Button>
            <Button variant="default" onClick={confirmBulkMarkPaid} disabled={bulkMarkPaid.isPending} className="px-5 h-9 text-xs font-semibold gap-1.5 bg-emerald-700 hover:bg-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {bulkMarkPaid.isPending ? 'Updating...' : 'Confirm payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Dialog (soft-delete with reason) */}
      <Dialog open={bulkDeleteOpen} onOpenChange={(open) => !open && !bulkSoftDelete.isPending && setBulkDeleteOpen(false)}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b bg-red-50/40">
            <DialogTitle className="text-base font-bold text-zinc-900">Delete {bulkRows.length} payment(s)?</DialogTitle>
            <p className="text-xs text-zinc-500 mt-1">These rows will be hidden from the queue. The record is retained in the database.</p>
          </DialogHeader>
          <div className="p-5 space-y-3">
            <div className="rounded-lg border border-red-100 bg-red-50/50 px-3 py-2 text-[11px] text-red-600">
              {bulkRows.slice(0, 5).map((r) => r.payee_name).join(', ')}
              {bulkRows.length > 5 && ` +${bulkRows.length - 5} more`}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-zinc-600">Reason for deletion *</Label>
              <textarea
                value={bulkDeleteReason}
                onChange={(e) => { setBulkDeleteReason(e.target.value); setBulkDeleteError(''); }}
                placeholder="e.g. Duplicate entry, wrong amount, cancelled by approver..."
                rows={3}
                className={cn(
                  'w-full text-sm border rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none',
                  bulkDeleteError ? 'border-red-300 bg-red-50' : 'border-zinc-200'
                )}
              />
              {bulkDeleteError && <p className="text-[10px] text-red-500">{bulkDeleteError}</p>}
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t bg-zinc-50/50">
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)} className="px-5 h-9 text-xs font-semibold border-zinc-200">
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={confirmBulkDelete}
              disabled={bulkSoftDelete.isPending}
              className="px-5 h-9 text-xs font-semibold gap-1.5 bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {bulkSoftDelete.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Send again for reapproval Dialog */}
      <Dialog open={bulkResendOpen} onOpenChange={(open) => !open && !bulkResend.isPending && setBulkResendOpen(false)}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b bg-amber-50/40">
            <DialogTitle className="text-base font-bold text-zinc-900">Send {bulkRows.length} payment(s) for re-approval?</DialogTitle>
            <p className="text-xs text-zinc-500 mt-1">Rows are reset to pending and routed through the approval flow again.</p>
          </DialogHeader>
          <div className="p-5">
            <div className="rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2 text-[11px] text-amber-700">
              {bulkRows.slice(0, 5).map((r) => r.payee_name).join(', ')}
              {bulkRows.length > 5 && ` +${bulkRows.length - 5} more`}
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t bg-zinc-50/50">
            <Button variant="outline" onClick={() => setBulkResendOpen(false)} className="px-5 h-9 text-xs font-semibold border-zinc-200">
              Cancel
            </Button>
            <Button variant="default" onClick={confirmBulkResend} disabled={bulkResend.isPending} className="px-5 h-9 text-xs font-semibold gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" />
              {bulkResend.isPending ? 'Sending...' : 'Send for re-approval'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PaymentsHub;
